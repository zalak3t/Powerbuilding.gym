const { query } = require('../config/db');

const ORDER_SQL = `ORDER BY
  ARRAY_POSITION(ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'], b.dia),
  b.horario`;

// ── Público: landing ──────────────────────────────────────────────────────────
async function getBloques({ dia, userId }) {
  const params = [];
  let whereClause = '';

  if (dia) {
    params.push(dia);
    whereClause = 'WHERE b.dia = $1';
  }

  const sql = `
    SELECT
      b.id, b.dia, b.horario, b.capacidad, b.estado, b.mensaje,
      b.disciplina_id, b.instructor_id,
      d.nombre AS disciplina_nombre, i.nombre AS instructor_nombre,
      COUNT(r.id)::int AS inscritos,
      ${userId
        ? `MAX(CASE WHEN c.usuario_id = $${params.length + 1} THEN r.id END) AS reserva_id,
           BOOL_OR(c.usuario_id = $${params.length + 1}) AS reservado_por_mi`
        : `NULL AS reserva_id, FALSE AS reservado_por_mi`
      }
    FROM bloques b
    LEFT JOIN disciplinas d ON d.id = b.disciplina_id
    LEFT JOIN instructores i ON i.id = b.instructor_id
    LEFT JOIN reservas r ON r.bloque_id = b.id
    ${userId ? `LEFT JOIN clientes c ON c.id = r.cliente_id` : ''}
    ${whereClause}
    GROUP BY b.id, d.id, i.id
    ${ORDER_SQL}
  `;

  if (userId) params.push(userId);

  const result = await query(sql, params);
  return result.rows.map((row) => ({
    ...row,
    reservado_por_mi: Boolean(row.reservado_por_mi),
    reserva_id: row.reserva_id || null,
  }));
}

async function getClienteByUserId(userId) {
  const result = await query(
    'SELECT id, estado FROM clientes WHERE usuario_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

// ── Admin ─────────────────────────────────────────────────────────────────────
async function getAdminBloques({ dia } = {}) {
  const params = [];
  let where = '';
  if (dia) { params.push(dia); where = 'WHERE b.dia = $1'; }

  const sql = `
    SELECT b.id, b.dia, b.horario, b.capacidad, b.estado, b.mensaje,
           b.disciplina_id, b.instructor_id,
           d.nombre AS disciplina_nombre, i.nombre AS instructor_nombre,
           COUNT(r.id)::int AS inscritos, b.creado_en, b.actualizado_en
    FROM bloques b
    LEFT JOIN disciplinas d ON d.id = b.disciplina_id
    LEFT JOIN instructores i ON i.id = b.instructor_id
    LEFT JOIN reservas r ON r.bloque_id = b.id
    ${where}
    GROUP BY b.id, d.id, i.id
    ${ORDER_SQL}
  `;
  const result = await query(sql, params);
  return result.rows;
}

async function getBloqueById(id) {
  const result = await query('SELECT * FROM bloques WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getInscritosByBloqueId(id) {
  const result = await query(
    'SELECT COUNT(id)::int AS inscritos FROM reservas WHERE bloque_id = $1',
    [id]
  );
  return result.rows[0].inscritos;
}

async function createBloque({ dia, horario, capacidad, estado, mensaje, disciplina_id, instructor_id }) {
  const result = await query(
    `INSERT INTO bloques (dia, horario, capacidad, estado, mensaje, disciplina_id, instructor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [dia, horario, capacidad, estado, mensaje, disciplina_id, instructor_id]
  );
  return result.rows[0];
}

async function updateBloque(id, { dia, horario, capacidad, estado, mensaje, disciplina_id, instructor_id }) {
  const result = await query(
    `UPDATE bloques
     SET dia=$1, horario=$2, capacidad=$3, estado=$4, mensaje=$5,
         disciplina_id=$6, instructor_id=$7, actualizado_en=NOW()
     WHERE id=$8
     RETURNING *`,
    [dia, horario, capacidad, estado, mensaje, disciplina_id, instructor_id, id]
  );
  return result.rows[0] || null;
}

async function updateBloqueEstado(id, { estado, mensaje }) {
  const result = await query(
    `UPDATE bloques
     SET estado=$1, mensaje=$2, actualizado_en=NOW()
     WHERE id=$3
     RETURNING *`,
    [estado, mensaje, id]
  );
  return result.rows[0] || null;
}

async function deleteBloque(id) {
  const result = await query(
    'DELETE FROM bloques WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  getBloques, getClienteByUserId,
  getAdminBloques, getBloqueById, getInscritosByBloqueId,
  createBloque, updateBloque, updateBloqueEstado, deleteBloque,
};
