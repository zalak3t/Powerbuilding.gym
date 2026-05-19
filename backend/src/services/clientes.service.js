const { query } = require('../config/db');

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
      COUNT(DISTINCT a.id)::int  AS asistencias
    FROM clientes c
    LEFT JOIN reservas   r ON r.cliente_id  = c.id
    LEFT JOIN asistencias a ON a.reserva_id = r.id
    ${where}
    GROUP BY c.id
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
            COUNT(DISTINCT a.id)::int  AS asistencias
     FROM clientes c
     LEFT JOIN reservas   r ON r.cliente_id  = c.id
     LEFT JOIN asistencias a ON a.reserva_id = r.id
     WHERE c.id = $1
     GROUP BY c.id`,
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

  return { ...cliente, bloques_reservados: bloques.rows };
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
