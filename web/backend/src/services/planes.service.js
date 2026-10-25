const { query } = require('../config/db');

async function getPlanes() {
  const result = await query(
    `SELECT pl.id, pl.nombre, pl.descripcion, pl.beneficios, pl.duracion_dias, pl.precio,
            pl.activo, pl.creado_en, pl.actualizado_en,
            COUNT(pg.id)::int AS pagos
     FROM planes pl
     LEFT JOIN pagos pg ON pg.plan_id = pl.id
     GROUP BY pl.id
     ORDER BY pl.nombre ASC`
  );
  return result.rows;
}

async function getPlanById(id) {
  const result = await query('SELECT * FROM planes WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createPlan({ nombre, descripcion, beneficios, duracion_dias, precio }) {
  const result = await query(
    `INSERT INTO planes (nombre, descripcion, beneficios, duracion_dias, precio)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [nombre, descripcion, beneficios, duracion_dias, precio]
  );
  return result.rows[0];
}

async function updatePlan(id, { nombre, descripcion, beneficios, duracion_dias, precio }) {
  const result = await query(
    `UPDATE planes SET nombre=$1, descripcion=$2, beneficios=$3, duracion_dias=$4, precio=$5,
            actualizado_en=NOW()
     WHERE id=$6 RETURNING *`,
    [nombre, descripcion, beneficios, duracion_dias, precio, id]
  );
  return result.rows[0] || null;
}

async function updatePlanActivo(id, activo) {
  const result = await query(
    `UPDATE planes SET activo=$1, actualizado_en=NOW() WHERE id=$2 RETURNING *`,
    [activo, id]
  );
  return result.rows[0] || null;
}

// Cuenta todos los pagos del plan (incluye anulados: la FK es RESTRICT)
async function countPagosByPlan(id) {
  const result = await query('SELECT COUNT(id)::int AS n FROM pagos WHERE plan_id = $1', [id]);
  return result.rows[0].n;
}

async function deletePlan(id) {
  const result = await query('DELETE FROM planes WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

module.exports = {
  getPlanes, getPlanById, createPlan, updatePlan, updatePlanActivo, countPagosByPlan, deletePlan,
};
