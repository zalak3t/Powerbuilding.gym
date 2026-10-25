const { query } = require('../config/db');

async function getInstructores() {
  const result = await query(
    `SELECT i.id, i.nombre, i.email, i.telefono, i.especialidad, i.activo,
            i.creado_en, i.actualizado_en,
            COUNT(b.id)::int AS bloques
     FROM instructores i
     LEFT JOIN bloques b ON b.instructor_id = i.id
     GROUP BY i.id
     ORDER BY i.nombre ASC`
  );
  return result.rows;
}

async function getInstructorById(id) {
  const result = await query('SELECT * FROM instructores WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createInstructor({ nombre, email, telefono, especialidad }) {
  const result = await query(
    `INSERT INTO instructores (nombre, email, telefono, especialidad)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [nombre, email, telefono, especialidad]
  );
  return result.rows[0];
}

async function updateInstructor(id, { nombre, email, telefono, especialidad }) {
  const result = await query(
    `UPDATE instructores
     SET nombre=$1, email=$2, telefono=$3, especialidad=$4, actualizado_en=NOW()
     WHERE id=$5 RETURNING *`,
    [nombre, email, telefono, especialidad, id]
  );
  return result.rows[0] || null;
}

async function updateInstructorActivo(id, activo) {
  const result = await query(
    `UPDATE instructores SET activo=$1, actualizado_en=NOW() WHERE id=$2 RETURNING *`,
    [activo, id]
  );
  return result.rows[0] || null;
}

async function countBloquesByInstructor(id) {
  const result = await query('SELECT COUNT(id)::int AS n FROM bloques WHERE instructor_id = $1', [id]);
  return result.rows[0].n;
}

async function deleteInstructor(id) {
  const result = await query('DELETE FROM instructores WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

module.exports = {
  getInstructores, getInstructorById, createInstructor, updateInstructor,
  updateInstructorActivo, countBloquesByInstructor, deleteInstructor,
};
