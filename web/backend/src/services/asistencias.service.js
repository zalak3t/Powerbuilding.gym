const { query } = require('../config/db');

const VALID_DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

async function getAsistenciaPorDia(dia) {
  // Query plana: un bloque puede aparecer N veces (una por reserva), o una si no hay reservas
  const result = await query(
    `SELECT
       b.id          AS bloque_id,
       b.dia,
       b.horario,
       b.capacidad,
       b.estado,
       r.id          AS reserva_id,
       c.id          AS cliente_id,
       c.nombre      AS cliente_nombre,
       c.email       AS cliente_email,
       c.telefono    AS cliente_telefono,
       a.id          AS asistencia_id,
       a.fecha       AS asistencia_fecha
     FROM bloques b
     LEFT JOIN reservas    r ON r.bloque_id  = b.id
     LEFT JOIN clientes    c ON c.id         = r.cliente_id
     LEFT JOIN asistencias a ON a.reserva_id = r.id
                             AND a.fecha     = CURRENT_DATE
     WHERE b.dia = $1
     ORDER BY
       b.horario,
       c.nombre ASC NULLS LAST`,
    [dia]
  );

  // Agrupar filas por bloque
  const bloquesMap = new Map();
  for (const row of result.rows) {
    if (!bloquesMap.has(row.bloque_id)) {
      bloquesMap.set(row.bloque_id, {
        id:        row.bloque_id,
        dia:       row.dia,
        horario:   row.horario,
        capacidad: row.capacidad,
        estado:    row.estado,
        reservas:  [],
      });
    }
    // Solo agregar reserva si existe (LEFT JOIN puede traer null)
    if (row.reserva_id) {
      bloquesMap.get(row.bloque_id).reservas.push({
        reserva_id:    row.reserva_id,
        cliente_id:    row.cliente_id,
        nombre:        row.cliente_nombre,
        email:         row.cliente_email,
        telefono:      row.cliente_telefono,
        asistio:       row.asistencia_id !== null,
        asistencia_id: row.asistencia_id || null,
      });
    }
  }

  return Array.from(bloquesMap.values());
}

async function getReservaById(reservaId) {
  const result = await query(
    'SELECT id, cliente_id, bloque_id FROM reservas WHERE id = $1',
    [reservaId]
  );
  return result.rows[0] || null;
}

async function getAsistenciaByReservaToday(reservaId) {
  const result = await query(
    'SELECT id FROM asistencias WHERE reserva_id = $1 AND fecha = CURRENT_DATE',
    [reservaId]
  );
  return result.rows[0] || null;
}

async function createAsistencia(reservaId) {
  const result = await query(
    `INSERT INTO asistencias (reserva_id, fecha)
     VALUES ($1, CURRENT_DATE)
     RETURNING id, reserva_id, fecha`,
    [reservaId]
  );
  return result.rows[0];
}

async function getAsistenciaById(id) {
  const result = await query(
    'SELECT id, reserva_id, fecha FROM asistencias WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function deleteAsistencia(id) {
  const result = await query(
    'DELETE FROM asistencias WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  VALID_DAYS,
  getAsistenciaPorDia,
  getReservaById,
  getAsistenciaByReservaToday,
  createAsistencia,
  getAsistenciaById,
  deleteAsistencia,
};
