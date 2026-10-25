const { query } = require('../config/db');

async function getPlantillas() {
  const result = await query('SELECT * FROM plantillas_notificacion ORDER BY id ASC');
  return result.rows;
}

async function getPlantillaById(id) {
  const result = await query('SELECT * FROM plantillas_notificacion WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// Solo asunto, cuerpo y activo son editables (clave y nombre son fijos). activo null => no cambia.
async function updatePlantilla(id, { asunto, cuerpo, activo }) {
  const result = await query(
    `UPDATE plantillas_notificacion
     SET asunto=$1, cuerpo=$2, activo=COALESCE($3::boolean, activo), actualizado_en=NOW()
     WHERE id=$4 RETURNING *`,
    [asunto, cuerpo, activo, id]
  );
  return result.rows[0] || null;
}

module.exports = { getPlantillas, getPlantillaById, updatePlantilla };
