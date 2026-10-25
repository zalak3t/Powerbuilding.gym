const {
  getDisciplinas, getDisciplinaById, createDisciplina, updateDisciplina,
  updateDisciplinaActivo, countBloquesByDisciplina, deleteDisciplina,
} = require('../services/disciplinas.service');
const v = require('../utils/validate');

// Valida el cuerpo de crear/editar disciplina. Devuelve { error } o los campos normalizados.
function validarDisciplinaBody(body) {
  const { nombre, descripcion } = body || {};
  if (!v.isNonEmptyString(nombre)) return { error: 'El nombre es obligatorio' };
  if (!v.maxLen(nombre.trim(), 60)) return { error: 'El nombre no puede superar 60 caracteres' };
  if (!v.isOptionalString(descripcion, 300)) return { error: 'La descripción no puede superar 300 caracteres' };
  return { nombre: nombre.trim(), descripcion: descripcion ? descripcion.trim() : null };
}

function pluralBloques(n) { return n + ' bloque' + (n !== 1 ? 's' : ''); }

// GET /api/disciplinas
async function listarDisciplinas(req, res) {
  const disciplinas = await getDisciplinas();
  return res.json({ ok: true, disciplinas });
}

// POST /api/disciplinas
async function crearDisciplina(req, res) {
  const val = validarDisciplinaBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  try {
    const disciplina = await createDisciplina(val);
    return res.status(201).json({ ok: true, message: 'Disciplina creada correctamente', disciplina });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ya existe una disciplina con ese nombre' });
    throw err;
  }
}

// PUT /api/disciplinas/:id
async function editarDisciplina(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const val = validarDisciplinaBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  try {
    const disciplina = await updateDisciplina(id, val);
    if (!disciplina) return res.status(404).json({ ok: false, error: 'Disciplina no encontrada' });
    return res.json({ ok: true, message: 'Disciplina actualizada correctamente', disciplina });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ya existe una disciplina con ese nombre' });
    throw err;
  }
}

// PATCH /api/disciplinas/:id/estado   body: { activo: boolean }
async function cambiarEstadoDisciplina(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const { activo } = req.body || {};
  if (typeof activo !== 'boolean') return res.status(400).json({ ok: false, error: 'activo debe ser true o false' });
  const disciplina = await updateDisciplinaActivo(id, activo);
  if (!disciplina) return res.status(404).json({ ok: false, error: 'Disciplina no encontrada' });
  return res.json({ ok: true, message: 'Estado de la disciplina actualizado', disciplina });
}

// DELETE /api/disciplinas/:id
async function eliminarDisciplina(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!(await getDisciplinaById(id))) return res.status(404).json({ ok: false, error: 'Disciplina no encontrada' });

  const n = await countBloquesByDisciplina(id);
  if (n > 0) {
    return res.status(409).json({
      ok: false,
      bloques: n,
      error: 'No se puede eliminar: la disciplina está en uso por ' + pluralBloques(n) + '. Puedes desactivarla en su lugar.',
    });
  }
  await deleteDisciplina(id);
  return res.json({ ok: true, message: 'Disciplina eliminada correctamente' });
}

module.exports = { listarDisciplinas, crearDisciplina, editarDisciplina, cambiarEstadoDisciplina, eliminarDisciplina };
