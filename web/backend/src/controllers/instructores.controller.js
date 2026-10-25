const {
  getInstructores, getInstructorById, createInstructor, updateInstructor,
  updateInstructorActivo, countBloquesByInstructor, deleteInstructor,
} = require('../services/instructores.service');
const v = require('../utils/validate');

// Valida el cuerpo de crear/editar instructor. Devuelve { error } o los campos normalizados.
function validarInstructorBody(body) {
  const { nombre, email, telefono, especialidad } = body || {};
  if (!v.isNonEmptyString(nombre)) return { error: 'El nombre es obligatorio' };
  if (!v.maxLen(nombre.trim(), 100)) return { error: 'El nombre no puede superar 100 caracteres' };
  if (email !== undefined && email !== null) {
    if (typeof email !== 'string') return { error: 'Email inválido (máximo 150 caracteres)' };
    if (email.trim() !== '' && (!v.isEmail(email) || !v.maxLen(email.trim(), 150))) {
      return { error: 'Email inválido (máximo 150 caracteres)' };
    }
  }
  if (!v.isOptionalString(telefono, 20)) return { error: 'El teléfono no puede superar 20 caracteres' };
  if (!v.isOptionalString(especialidad, 100)) return { error: 'La especialidad no puede superar 100 caracteres' };
  return {
    nombre: nombre.trim(),
    email: email && email.trim() ? email.trim().toLowerCase() : null,
    telefono: telefono && telefono.trim() ? telefono.trim() : null,
    especialidad: especialidad && especialidad.trim() ? especialidad.trim() : null,
  };
}

function pluralBloques(n) { return n + ' bloque' + (n !== 1 ? 's' : ''); }

// GET /api/instructores
async function listarInstructores(req, res) {
  const instructores = await getInstructores();
  return res.json({ ok: true, instructores });
}

// POST /api/instructores
async function crearInstructor(req, res) {
  const val = validarInstructorBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  const instructor = await createInstructor(val);
  return res.status(201).json({ ok: true, message: 'Instructor creado correctamente', instructor });
}

// PUT /api/instructores/:id
async function editarInstructor(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const val = validarInstructorBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  const instructor = await updateInstructor(id, val);
  if (!instructor) return res.status(404).json({ ok: false, error: 'Instructor no encontrado' });
  return res.json({ ok: true, message: 'Instructor actualizado correctamente', instructor });
}

// PATCH /api/instructores/:id/estado   body: { activo: boolean }
async function cambiarEstadoInstructor(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const { activo } = req.body || {};
  if (typeof activo !== 'boolean') return res.status(400).json({ ok: false, error: 'activo debe ser true o false' });
  const instructor = await updateInstructorActivo(id, activo);
  if (!instructor) return res.status(404).json({ ok: false, error: 'Instructor no encontrado' });
  return res.json({ ok: true, message: 'Estado del instructor actualizado', instructor });
}

// DELETE /api/instructores/:id
async function eliminarInstructor(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!(await getInstructorById(id))) return res.status(404).json({ ok: false, error: 'Instructor no encontrado' });

  const n = await countBloquesByInstructor(id);
  if (n > 0) {
    return res.status(409).json({
      ok: false,
      bloques: n,
      error: 'No se puede eliminar: el instructor está asignado a ' + pluralBloques(n) + '. Puedes desactivarlo en su lugar.',
    });
  }
  await deleteInstructor(id);
  return res.json({ ok: true, message: 'Instructor eliminado correctamente' });
}

module.exports = { listarInstructores, crearInstructor, editarInstructor, cambiarEstadoInstructor, eliminarInstructor };
