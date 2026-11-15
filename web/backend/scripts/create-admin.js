// Crea el primer administrador leyendo las credenciales desde variables de entorno.
// No imprime nunca la contraseña ni el hash. No sobrescribe un usuario que ya exista.
//
// Variables requeridas : ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL
// Variable opcional    : ADMIN_NOMBRE (por defecto "Administrador")
// Uso                  : npm run create-admin
require('dotenv').config({ quiet: true });

const { validarFortaleza } = require('../src/utils/password');
const { hashPassword } = require('../src/services/auth.service');
const { pool } = require('../src/config/db');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const nombre = (process.env.ADMIN_NOMBRE || 'Administrador').trim();

  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL falta o no es un correo válido');
  const errorClave = validarFortaleza(password);
  if (errorClave) throw new Error(`ADMIN_PASSWORD: ${errorClave}`);

  const passwordHash = await hashPassword(password);
  const r = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [nombre, email, passwordHash]
  );

  if (r.rowCount === 0) {
    console.log(`[create-admin] Ya existe un usuario con el correo ${email}. No se modificó nada.`);
  } else {
    console.log(`[create-admin] Administrador creado: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(`[create-admin] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
