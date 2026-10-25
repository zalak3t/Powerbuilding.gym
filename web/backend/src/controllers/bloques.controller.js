const {
  getBloques, getClienteByUserId,
  getAdminBloques, getBloqueById, getInscritosByBloqueId,
  createBloque, updateBloque, updateBloqueEstado, deleteBloque,
} = require('../services/bloques.service');
const { getDisciplinaById } = require('../services/disciplinas.service');
const { getInstructorById } = require('../services/instructores.service');
const v = require('../utils/validate');

const VALID_DAYS   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const VALID_ESTADO = ['activo', 'suspendido'];

function isValidDay(dia)    { return VALID_DAYS.includes(dia); }
function isValidEstado(est) { return VALID_ESTADO.includes(est); }

// Valida el cuerpo de crear/editar bloque. Devuelve { error } o los campos normalizados.
function validarBloqueBody(body) {
  const { dia, horario, capacidad, estado, mensaje } = body || {};
  if (!dia || !v.isNonEmptyString(horario) || capacidad === undefined) {
    return { error: 'dia, horario y capacidad son obligatorios' };
  }
  if (typeof dia !== 'string' || !isValidDay(dia)) return { error: 'Día inválido' };
  if (!v.maxLen(horario.trim(), 30)) return { error: 'El horario no puede superar 30 caracteres' };
  const cap = v.parsePositiveInt(capacidad);
  if (!cap || cap > 200) return { error: 'capacidad debe ser un número entero entre 1 y 200' };
  const est = estado || 'activo';
  if (typeof est !== 'string' || !isValidEstado(est)) {
    return { error: 'estado debe ser "activo" o "suspendido"' };
  }
  if (!v.isOptionalString(mensaje, 200)) return { error: 'El mensaje no puede superar 200 caracteres' };
  const disciplina_id = parseRelacionId(body.disciplina_id);
  if (disciplina_id === false) return { error: 'disciplina_id inválido' };
  const instructor_id = parseRelacionId(body.instructor_id);
  if (instructor_id === false) return { error: 'instructor_id inválido' };
  return { dia, horario: horario.trim(), cap, est, mensaje, disciplina_id, instructor_id };
}

// undefined -> undefined (no enviado); null o '' -> null (sin asignar); entero positivo -> id; otro -> false
function parseRelacionId(val) {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  return v.parsePositiveInt(val) || false;
}

// Valida que la disciplina/instructor exista y este activo. Se acepta uno inactivo solo si ya
// estaba asignado al bloque (actual), para poder seguir editando el bloque.
// Devuelve un mensaje de error o null.
async function validarRelaciones(disciplina_id, instructor_id, actual) {
  if (disciplina_id && !(actual && actual.disciplina_id === disciplina_id)) {
    const d = await getDisciplinaById(disciplina_id);
    if (!d) return 'La disciplina indicada no existe';
    if (!d.activo) return 'La disciplina indicada está inactiva';
  }
  if (instructor_id && !(actual && actual.instructor_id === instructor_id)) {
    const i = await getInstructorById(instructor_id);
    if (!i) return 'El instructor indicado no existe';
    if (!i.activo) return 'El instructor indicado está inactivo';
  }
  return null;
}

// ── Público ───────────────────────────────────────────────────────────────────
async function listarBloques(req, res) {
  const { dia } = req.query;
  if (dia !== undefined && !(typeof dia === 'string' && isValidDay(dia))) {
    return res.status(400).json({ ok: false, error: 'Día inválido' });
  }
  let userId = null;
  if (req.user) {
    const cliente = await getClienteByUserId(req.user.id);
    if (cliente) userId = req.user.id;
  }
  const bloques = await getBloques({ dia: dia || null, userId });
  return res.json({ ok: true, bloques });
}

// ── Admin: GET /api/bloques/admin ─────────────────────────────────────────────
async function listarBloquesAdmin(req, res) {
  const { dia } = req.query;
  if (dia !== undefined && !(typeof dia === 'string' && isValidDay(dia))) {
    return res.status(400).json({ ok: false, error: 'Día inválido' });
  }
  const bloques = await getAdminBloques({ dia: dia || null });
  return res.json({ ok: true, bloques });
}

// ── Admin: POST /api/bloques ──────────────────────────────────────────────────
async function crearBloque(req, res) {
  const val = validarBloqueBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  const { dia, horario, cap, est, mensaje } = val;
  const disciplina_id = val.disciplina_id || null;
  const instructor_id = val.instructor_id || null;

  const relError = await validarRelaciones(disciplina_id, instructor_id, null);
  if (relError) return res.status(400).json({ ok: false, error: relError });

  try {
    const bloque = await createBloque({
      dia, horario, capacidad: cap, estado: est, mensaje: mensaje || '', disciplina_id, instructor_id,
    });
    return res.status(201).json({ ok: true, message: 'Bloque creado correctamente', bloque });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Ya existe un bloque con ese día y horario' });
    }
    throw err;
  }
}

// ── Admin: PUT /api/bloques/:id ───────────────────────────────────────────────
async function editarBloque(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const val = validarBloqueBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  const { dia, horario, cap, est, mensaje } = val;

  const bloque = await getBloqueById(id);
  if (!bloque) return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });

  // Si no se envían, se conservan los valores actuales; null los deja sin asignar.
  const disciplina_id = val.disciplina_id === undefined ? bloque.disciplina_id : val.disciplina_id;
  const instructor_id = val.instructor_id === undefined ? bloque.instructor_id : val.instructor_id;
  const relError = await validarRelaciones(disciplina_id, instructor_id, bloque);
  if (relError) return res.status(400).json({ ok: false, error: relError });

  const inscritos = await getInscritosByBloqueId(id);
  if (cap < inscritos) {
    return res.status(409).json({
      ok: false,
      error: `La capacidad no puede ser menor a los inscritos actuales (${inscritos})`,
    });
  }

  try {
    const updated = await updateBloque(id, {
      dia, horario, capacidad: cap, estado: est, disciplina_id, instructor_id,
      mensaje: mensaje !== undefined ? mensaje : (bloque.mensaje || ''),
    });
    return res.json({ ok: true, message: 'Bloque actualizado correctamente', bloque: updated });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Ya existe un bloque con ese día y horario' });
    }
    throw err;
  }
}

// ── Admin: PATCH /api/bloques/:id/estado ──────────────────────────────────────
async function cambiarEstado(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const { estado, mensaje } = req.body || {};
  if (typeof estado !== 'string' || !isValidEstado(estado)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser "activo" o "suspendido"' });
  }
  if (!v.isOptionalString(mensaje, 200)) {
    return res.status(400).json({ ok: false, error: 'El mensaje no puede superar 200 caracteres' });
  }

  const bloque = await getBloqueById(id);
  if (!bloque) return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });

  // Al activar, limpiar el mensaje de suspensión
  const mensajeFinal = estado === 'activo' ? '' : (mensaje || '');
  const updated = await updateBloqueEstado(id, { estado, mensaje: mensajeFinal });
  return res.json({ ok: true, message: 'Estado del bloque actualizado', bloque: updated });
}

// ── Admin: DELETE /api/bloques/:id ────────────────────────────────────────────
async function eliminarBloque(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const deleted = await deleteBloque(id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });

  return res.json({ ok: true, message: 'Bloque eliminado correctamente' });
}

module.exports = { listarBloques, listarBloquesAdmin, crearBloque, editarBloque, cambiarEstado, eliminarBloque };
