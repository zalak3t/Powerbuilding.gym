const { getPlantillas, getPlantillaById, updatePlantilla } = require('../services/plantillas.service');
const { VARIABLES, DATOS_EJEMPLO, reemplazarVariables } = require('../utils/plantillas');
const v = require('../utils/validate');

const MAX_ASUNTO = 150;
const MAX_CUERPO = 2000;

// Valida asunto y cuerpo (obligatorios). Devuelve { error } o { asunto, cuerpo }.
function validarTextos(asunto, cuerpo) {
  if (!v.isNonEmptyString(asunto)) return { error: 'El asunto es obligatorio' };
  if (!v.maxLen(asunto.trim(), MAX_ASUNTO)) return { error: 'El asunto no puede superar ' + MAX_ASUNTO + ' caracteres' };
  if (!v.isNonEmptyString(cuerpo)) return { error: 'El cuerpo es obligatorio' };
  if (!v.maxLen(cuerpo.trim(), MAX_CUERPO)) return { error: 'El cuerpo no puede superar ' + MAX_CUERPO + ' caracteres' };
  return { asunto: asunto.trim(), cuerpo: cuerpo.trim() };
}

// GET /api/plantillas
async function listarPlantillas(req, res) {
  const plantillas = await getPlantillas();
  return res.json({ ok: true, plantillas, variables: VARIABLES });
}

// GET /api/plantillas/:id
async function obtenerPlantilla(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const plantilla = await getPlantillaById(id);
  if (!plantilla) return res.status(404).json({ ok: false, error: 'Plantilla no encontrada' });
  return res.json({ ok: true, plantilla, variables: VARIABLES });
}

// PUT /api/plantillas/:id   body: { asunto, cuerpo, activo? }
async function editarPlantilla(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const { asunto, cuerpo, activo } = req.body || {};
  const val = validarTextos(asunto, cuerpo);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  if (activo !== undefined && typeof activo !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'activo debe ser true o false' });
  }
  const plantilla = await updatePlantilla(id, { asunto: val.asunto, cuerpo: val.cuerpo, activo: activo === undefined ? null : activo });
  if (!plantilla) return res.status(404).json({ ok: false, error: 'Plantilla no encontrada' });
  return res.json({ ok: true, message: 'Plantilla actualizada correctamente', plantilla });
}

// POST /api/plantillas/:id/preview   body opcional: { asunto, cuerpo } para previsualizar sin guardar
// Devuelve texto plano con las variables reemplazadas por datos de ejemplo (el front debe escaparlo).
async function previsualizarPlantilla(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const plantilla = await getPlantillaById(id);
  if (!plantilla) return res.status(404).json({ ok: false, error: 'Plantilla no encontrada' });

  const body = req.body || {};
  const val = validarTextos(
    body.asunto === undefined ? plantilla.asunto : body.asunto,
    body.cuerpo === undefined ? plantilla.cuerpo : body.cuerpo
  );
  if (val.error) return res.status(400).json({ ok: false, error: val.error });

  return res.json({
    ok: true,
    preview: {
      asunto: reemplazarVariables(val.asunto, DATOS_EJEMPLO),
      cuerpo: reemplazarVariables(val.cuerpo, DATOS_EJEMPLO),
    },
    datos_ejemplo: DATOS_EJEMPLO,
  });
}

module.exports = { listarPlantillas, obtenerPlantilla, editarPlantilla, previsualizarPlantilla };
