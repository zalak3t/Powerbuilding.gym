const {
  getBloques, getClienteByUserId,
  getAdminBloques, getBloqueById, getInscritosByBloqueId,
  createBloque, updateBloque, updateBloqueEstado, deleteBloque,
} = require('../services/bloques.service');

const VALID_DAYS   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const VALID_ESTADO = ['activo', 'suspendido'];

function isValidDay(dia)    { return VALID_DAYS.includes(dia); }
function isValidEstado(est) { return VALID_ESTADO.includes(est); }

// ── Público ───────────────────────────────────────────────────────────────────
async function listarBloques(req, res) {
  const { dia } = req.query;
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
  const bloques = await getAdminBloques({ dia: dia || null });
  return res.json({ ok: true, bloques });
}

// ── Admin: POST /api/bloques ──────────────────────────────────────────────────
async function crearBloque(req, res) {
  const { dia, horario, capacidad, estado, mensaje } = req.body;

  if (!dia || !horario || capacidad === undefined) {
    return res.status(400).json({ ok: false, error: 'dia, horario y capacidad son obligatorios' });
  }
  if (!isValidDay(dia)) {
    return res.status(400).json({ ok: false, error: 'Día inválido' });
  }
  const cap = parseInt(capacidad, 10);
  if (isNaN(cap) || cap <= 0) {
    return res.status(400).json({ ok: false, error: 'capacidad debe ser un número mayor a 0' });
  }
  const est = estado || 'activo';
  if (!isValidEstado(est)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser "activo" o "suspendido"' });
  }

  try {
    const bloque = await createBloque({ dia, horario, capacidad: cap, estado: est, mensaje: mensaje || '' });
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
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const { dia, horario, capacidad, estado, mensaje } = req.body;

  if (!dia || !horario || capacidad === undefined) {
    return res.status(400).json({ ok: false, error: 'dia, horario y capacidad son obligatorios' });
  }
  if (!isValidDay(dia)) {
    return res.status(400).json({ ok: false, error: 'Día inválido' });
  }
  const cap = parseInt(capacidad, 10);
  if (isNaN(cap) || cap <= 0) {
    return res.status(400).json({ ok: false, error: 'capacidad debe ser un número mayor a 0' });
  }
  const est = estado || 'activo';
  if (!isValidEstado(est)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser "activo" o "suspendido"' });
  }

  const bloque = await getBloqueById(id);
  if (!bloque) return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });

  const inscritos = await getInscritosByBloqueId(id);
  if (cap < inscritos) {
    return res.status(409).json({
      ok: false,
      error: `La capacidad no puede ser menor a los inscritos actuales (${inscritos})`,
    });
  }

  try {
    const updated = await updateBloque(id, {
      dia, horario, capacidad: cap, estado: est,
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
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const { estado, mensaje } = req.body;
  if (!estado || !isValidEstado(estado)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser "activo" o "suspendido"' });
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
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const deleted = await deleteBloque(id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });

  return res.json({ ok: true, message: 'Bloque eliminado correctamente' });
}

module.exports = { listarBloques, listarBloquesAdmin, crearBloque, editarBloque, cambiarEstado, eliminarBloque };
