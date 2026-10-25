const { query } = require('../config/db');
const { HOY_CL_SQL } = require('../utils/fechas');
const { getPagosByCliente } = require('./pagos.service');

// Membresía derivada: vence el MAX(periodo_hasta) de los pagos no anulados (fecha de Chile).
// por_vencer = faltan 7 días o menos (vence_el - hoy <= 7); vigente incluye el día del vencimiento.
const MEMBRESIA_JOIN = `
    LEFT JOIN LATERAL (
      SELECT MAX(p.periodo_hasta) AS vence
      FROM pagos p
      WHERE p.cliente_id = c.id AND p.estado = 'pagado'
    ) m ON TRUE`;

const MEMBRESIA_COLS = `
      to_char(m.vence, 'YYYY-MM-DD') AS vence_el,
      CASE
        WHEN m.vence IS NULL                  THEN 'sin_plan'
        WHEN m.vence < ${HOY_CL_SQL}          THEN 'vencida'
        WHEN m.vence - ${HOY_CL_SQL} <= 7     THEN 'por_vencer'
        ELSE 'vigente'
      END AS estado_membresia`;

async function getClientes({ search } = {}) {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search}%`);
    where = 'WHERE c.nombre ILIKE $1 OR c.email ILIKE $1';
  }

  const sql = `
    SELECT
      c.id, c.usuario_id, c.nombre, c.email, c.telefono,
      c.notas, c.estado, c.fecha_ingreso, c.ultima_visita,
      c.creado_en, c.actualizado_en,
      COUNT(DISTINCT r.id)::int  AS reservas,
      COUNT(DISTINCT a.id)::int  AS asistencias,
      ${MEMBRESIA_COLS}
    FROM clientes c
    LEFT JOIN reservas   r ON r.cliente_id  = c.id
    LEFT JOIN asistencias a ON a.reserva_id = r.id
    ${MEMBRESIA_JOIN}
    ${where}
    GROUP BY c.id, m.vence
    ORDER BY c.nombre ASC
  `;
  const result = await query(sql, params);
  return result.rows;
}

async function getClienteById(id) {
  const result = await query(
    `SELECT c.id, c.usuario_id, c.nombre, c.email, c.telefono,
            c.notas, c.estado, c.fecha_ingreso, c.ultima_visita,
            c.creado_en, c.actualizado_en,
            COUNT(DISTINCT r.id)::int  AS reservas,
            COUNT(DISTINCT a.id)::int  AS asistencias,
            ${MEMBRESIA_COLS}
     FROM clientes c
     LEFT JOIN reservas   r ON r.cliente_id  = c.id
     LEFT JOIN asistencias a ON a.reserva_id = r.id
     ${MEMBRESIA_JOIN}
     WHERE c.id = $1
     GROUP BY c.id, m.vence`,
    [id]
  );
  return result.rows[0] || null;
}

async function getClienteFicha(id) {
  const cliente = await getClienteById(id);
  if (!cliente) return null;

  const bloques = await query(
    `SELECT
       r.id  AS reserva_id,
       b.id  AS bloque_id,
       b.dia, b.horario,
       b.estado AS estado_bloque,
       (a.id IS NOT NULL) AS asistio,
       a.id AS asistencia_id
     FROM reservas r
     JOIN bloques b ON b.id = r.bloque_id
     LEFT JOIN asistencias a ON a.reserva_id = r.id
     WHERE r.cliente_id = $1
     ORDER BY
       ARRAY_POSITION(ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'], b.dia),
       b.horario`,
    [id]
  );

  const pagos = await getPagosByCliente(id);

  return { ...cliente, bloques_reservados: bloques.rows, pagos };
}

async function createCliente({ nombre, email, telefono, notas, estado }) {
  const result = await query(
    `INSERT INTO clientes (nombre, email, telefono, notas, estado)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nombre, email, telefono || null, notas || '', estado || 'activo']
  );
  return result.rows[0];
}

async function updateCliente(id, { nombre, email, telefono, notas, estado }) {
  const result = await query(
    `UPDATE clientes
     SET nombre=$1, email=$2, telefono=$3, notas=$4, estado=$5, actualizado_en=NOW()
     WHERE id=$6
     RETURNING *`,
    [nombre, email, telefono || null, notas || '', estado, id]
  );
  return result.rows[0] || null;
}

async function updateClienteEstado(id, estado) {
  const result = await query(
    `UPDATE clientes
     SET estado=$1, actualizado_en=NOW()
     WHERE id=$2
     RETURNING *`,
    [estado, id]
  );
  return result.rows[0] || null;
}

async function deleteCliente(id) {
  const result = await query(
    'DELETE FROM clientes WHERE id=$1 RETURNING id',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  getClientes, getClienteById, getClienteFicha,
  createCliente, updateCliente, updateClienteEstado, deleteCliente,
};
