// Ejecutar: node src/db/generateHashes.js
// Imprime los hashes bcrypt para copiar en seed.sql
const bcrypt = require('bcrypt');

const usuarios = [
  { email: 'admin@powerbuilding.gym', password: 'admin123' },
  { email: 'carlos@gmail.com',        password: 'carlos123' },
  { email: 'ana@gmail.com',           password: 'ana123' },
  { email: 'felipe@gmail.com',        password: 'felipe123' },
  { email: 'maria@gmail.com',         password: 'maria123' },
  { email: 'diego@gmail.com',         password: 'diego123' },
];

(async () => {
  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.password, 12);
    console.log(`${u.email} → '${hash}'`);
  }
})();
