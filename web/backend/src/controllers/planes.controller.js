const {
  getPlanes, getPlanById, createPlan, updatePlan,
  updatePlanActivo, countPagosByPlan, deletePlan,
} = require('../services/planes.service');
const v = require('../utils/validate');

// Valida el cuerpo de crear/editar plan. Devuelve { error } o los campos normalizados.
function validarPlanBody(body) {
  const { nombre, descripcion, beneficios, duracion_dias, precio } = body || {};
  if (!v.isNonEmptyString(nombre)) return { error: 'El nombre es obligatorio' };
  if (!v.maxLen(nombre.trim(), 80)) return { error: 'El nombre no puede superar 80 caracteres' };
  if (!v.isOptionalString(descripcion, 500)) return { error: 'La descripción no puede superar 500 caracteres' };
  if (!v.isOptionalString(beneficios, 1000)) return { error: 'Los beneficios no pueden superar 1000 caracteres' };
  const dias = v.parseNonNegativeInt(duracion_dias);
  if (!dias) return { error: 'La duración debe ser un número entero de días mayor a 0' };
  const pr = v.parseNonNegativeInt(precio);
  if (pr === null) return { error: 'El precio debe ser un número entero en pesos, mayor o igual a 0' };
  return {
    nombre: nombre.trim(),
    descripcion: descripcion && descripcion.trim() ? descripcion.trim() : null,
    beneficios: beneficios && beneficios.trim() ? beneficios.trim() : null,
    duracion_dias: dias,
    precio: pr,
  };
}

function pluralPagos(n) { return n + ' pago' + (n !== 1 ? 's' : ''); }

// GET /api/planes
async function listarPlanes(req, res) {
  const planes = await getPlanes();
  return res.json({ ok: true, planes });
}

// POST /api/planes
async function crearPlan(req, res) {
  const val = validarPlanBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  try {
    const plan = await createPlan(val);
    return res.status(201).json({ ok: true, message: 'Plan creado correctamente', plan });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ya existe un plan con ese nombre' });
    throw err;
  }
}

// PUT /api/planes/:id
async function editarPlan(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const val = validarPlanBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  try {
    const plan = await updatePlan(id, val);
    if (!plan) return res.status(404).json({ ok: false, error: 'Plan no encontrado' });
    return res.json({ ok: true, message: 'Plan actualizado correctamente', plan });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ya existe un plan con ese nombre' });
    throw err;
  }
}

// PATCH /api/planes/:id/estado   body: { activo: boolean }
async function cambiarEstadoPlan(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const { activo } = req.body || {};
  if (typeof activo !== 'boolean') return res.status(400).json({ ok: false, error: 'activo debe ser true o false' });
  const plan = await updatePlanActivo(id, activo);
  if (!plan) return res.status(404).json({ ok: false, error: 'Plan no encontrado' });
  return res.json({ ok: true, message: 'Estado del plan actualizado', plan });
}

// DELETE /api/planes/:id
async function eliminarPlan(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!(await getPlanById(id))) return res.status(404).json({ ok: false, error: 'Plan no encontrado' });

  const n = await countPagosByPlan(id);
  if (n > 0) {
    return res.status(409).json({
      ok: false,
      pagos: n,
      error: 'No se puede eliminar: el plan tiene ' + pluralPagos(n) + ' registrado' + (n !== 1 ? 's' : '') + '. Puedes desactivarlo en su lugar.',
    });
  }
  try {
    await deletePlan(id);
  } catch (err) {
    // Un pago creado entre el conteo y el borrado dispara la FK RESTRICT
    if (err.code === '23503') {
      return res.status(409).json({ ok: false, error: 'No se puede eliminar: el plan tiene pagos registrados. Puedes desactivarlo en su lugar.' });
    }
    throw err;
  }
  return res.json({ ok: true, message: 'Plan eliminado correctamente' });
}

module.exports = { listarPlanes, crearPlan, editarPlan, cambiarEstadoPlan, eliminarPlan };
