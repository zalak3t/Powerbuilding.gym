const {
  VALID_DAYS,
  getAsistenciaPorDia,
  getReservaById,
  getAsistenciaByReservaToday,
  createAsistencia,
  getAsistenciaById,
  deleteAsistencia,
} = require('../services/asistencias.service');
const v = require('../utils/validate');

// GET /api/asistencias?dia=Lunes
async function listarAsistencias(req, res) {
  const dia = req.query.dia === undefined ? 'Lunes' : req.query.dia;

  if (typeof dia !== 'string' || !VALID_DAYS.includes(dia)) {
    return res.status(400).json({ ok: false, error: 'Día inválido' });
  }

  const bloques = await getAsistenciaPorDia(dia);
  return res.json({ ok: true, bloques });
}

// POST /api/asistencias
async function marcarAsistencia(req, res) {
  const reserva_id = v.parsePositiveInt((req.body || {}).reserva_id);
  if (!reserva_id) {
    return res.status(400).json({ ok: false, error: 'reserva_id es obligatorio y debe ser un entero positivo' });
  }

  const reserva = await getReservaById(reserva_id);
  if (!reserva) {
    return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
  }

  const existing = await getAsistenciaByReservaToday(reserva_id);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'La asistencia ya fue marcada hoy', asistencia_id: existing.id });
  }

  const asistencia = await createAsistencia(reserva_id);
  return res.status(201).json({ ok: true, message: 'Asistencia marcada correctamente', asistencia });
}

// DELETE /api/asistencias/:id
async function desmarcarAsistencia(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const existing = await getAsistenciaById(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Asistencia no encontrada' });

  await deleteAsistencia(id);
  return res.json({ ok: true, message: 'Asistencia desmarcada correctamente' });
}

module.exports = { listarAsistencias, marcarAsistencia, desmarcarAsistencia };
