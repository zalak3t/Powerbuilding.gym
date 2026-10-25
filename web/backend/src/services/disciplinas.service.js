const { query } = require('../config/db');

async function getDisciplinas() {
  const result = await query(
    `SELECT d.id, d.nombre, d.descripcion, d.activo, d.creado_en, d.actualizado_en,
            COUNT(b.id)::int AS bloques
     FROM disciplinas d
     LEFT JOIN bloques b ON b.disciplina_id = d.id
     GROUP BY d.id
     ORDER BY d.nombre ASC`
  );
  return result.rows;
}

async function getDisciplinaById(id) {
  const result = await query('SELECT * FROM disciplinas WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createDisciplina({ nombre, descripcion }) {
  const result = await query(
    `INSERT INTO disciplinas (nombre, descripcion) VALUES ($1, $2) RETURNING *`,
    [nombre, descripcion]
  );
  return result.rows[0];
}

async function updateDisciplina(id, { nombre, descripcion }) {
  const result = await query(
    `UPDATE disciplinas SET nombre=$1, descripcion=$2, actualizado_en=NOW()
     WHERE id=$3 RETURNING *`,
    [nombre, descripcion, id]
  );
  return result.rows[0] || null;
}

async function updateDisciplinaActivo(id, activo) {
  const result = await query(
    `UPDATE disciplinas SET activo=$1, actualizado_en=NOW() WHERE id=$2 RETURNING *`,
    [activo, id]
  );
  return result.rows[0] || null;
}

async function countBloquesByDisciplina(id) {
  const result = await query('SELECT COUNT(id)::int AS n FROM bloques WHERE disciplina_id = $1', [id]);
  return result.rows[0].n;
}

async function deleteDisciplina(id) {
  const result = await query('DELETE FROM disciplinas WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

module.exports = {
  getDisciplinas, getDisciplinaById, createDisciplina, updateDisciplina,
  updateDisciplinaActivo, countBloquesByDisciplina, deleteDisciplina,
};
