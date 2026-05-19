const {
  getClienteActivoByUserId,
  getBloqueCap,
  createReserva,
  getReservaById,
  deleteReserva,
} = require('../services/reservas.service');

async function reservar(req, res) {
  const { bloque_id } = req.body;
  if (!bloque_id) {
    return res.status(400).json({ ok: false, error: 'bloque_id es obligatorio' });
  }

  // Verificar cliente asociado al usuario
  const cliente = await getClienteActivoByUserId(req.user.id);
  if (!cliente) {
    return res.status(404).json({ ok: false, error: 'Cliente no encontrado para este usuario' });
  }
  if (cliente.estado !== 'activo') {
    return res.status(403).json({ ok: false, error: 'Cliente no habilitado para reservar' });
  }

  // Verificar bloque
  const bloque = await getBloqueCap(bloque_id);
  if (!bloque) {
    return res.status(404).json({ ok: false, error: 'Bloque no encontrado' });
  }
  if (bloque.estado !== 'activo') {
    return res.status(409).json({ ok: false, error: 'El bloque está suspendido' });
  }
  if (bloque.inscritos >= bloque.capacidad) {
    return res.status(409).json({ ok: false, error: 'El bloque está lleno' });
  }

  // Crear reserva (la constraint UNIQUE en BD maneja el duplicado)
  try {
    const reserva = await createReserva({ clienteId: cliente.id, bloqueId: bloque_id });
    return res.status(201).json({ ok: true, message: 'Reserva creada correctamente', reserva });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Ya tienes una reserva en este bloque' });
    }
    throw err;
  }
}

async function cancelar(req, res) {
  const reservaId = parseInt(req.params.id, 10);
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
