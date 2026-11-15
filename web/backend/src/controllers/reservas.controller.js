const {
  getClienteActivoByUserId,
  reservarConCupo,
  getReservaById,
  deleteReserva,
} = require('../services/reservas.service');
const { notificarReserva } = require('../services/notificaciones.service');
const v = require('../utils/validate');

async function reservar(req, res) {
  const bloque_id = v.parsePositiveInt((req.body || {}).bloque_id);
  if (!bloque_id) {
    return res.status(400).json({ ok: false, error: 'bloque_id es obligatorio y debe ser un entero positivo' });
  }

  // Verificar cliente asociado al usuario
  const cliente = await getClienteActivoByUserId(req.user.id);
  if (!cliente) {
    return res.status(404).json({ ok: false, error: 'Cliente no encontrado para este usuario' });
  }
  if (cliente.estado !== 'activo') {
    return res.status(403).json({ ok: false, error: 'Cliente no habilitado para reservar' });
  }

  // Crear la reserva con control de cupo atómico (la constraint UNIQUE en BD maneja el duplicado)
  try {
    const { reserva, error } = await reservarConCupo({ clienteId: cliente.id, bloqueId: bloque_id });
    if (error === 'BLOQUE_NOT_FOUND') return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });
    if (error === 'BLOQUE_SUSPENDIDO') return res.status(409).json({ ok: false, error: 'El bloque está suspendido' });
    if (error === 'BLOQUE_LLENO') return res.status(409).json({ ok: false, error: 'El bloque está lleno' });
    // R.18: confirmación por correo, sin esperar y sin afectar la respuesta.
    notificarReserva(reserva.id).catch(() => {});
    return res.status(201).json({ ok: true, message: 'Reserva creada correctamente', reserva });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Ya tienes una reserva en este bloque' });
    }
    throw err;
  }
}

async function cancelar(req, res) {
  const reservaId = v.parsePositiveInt(req.params.id);
  if (!reservaId) {
    return res.status(400).json({ ok: false, error: 'ID de reserva inválido' });
  }

  const reserva = await getReservaById(reservaId);
  if (!reserva) {
    return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
  }

  // Admin puede cancelar cualquier reserva; alumno solo la suya
  if (req.user.rol !== 'admin' && reserva.usuario_id !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'No tienes permiso para cancelar esta reserva' });
  }

  await deleteReserva(reservaId);
  return res.json({ ok: true, message: 'Reserva cancelada correctamente' });
}

module.exports = { reservar, cancelar };
