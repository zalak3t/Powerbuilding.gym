// Pruebas de recuperación de contraseña (alumnos y administradores). Solo BD local, SIN red.
// Uso:  cd web/backend && node --env-file=.env.dev scripts/test-recuperacion.js
// Requiere la migración 008 aplicada (npm run migrate:local). Crea usuarios "zz_rec_*" y los borra al final.
// No imprime contraseñas ni tokens.
process.env.PB_LOCAL = '1';
process.env.NOTIF_JOBS = 'off';
process.env.EMAIL_PROVIDER = 'simulado';
process.env.EMAIL_API_KEY = '';

const { getDbHost, isLocalHost } = require('../src/config/dbHost');
if (process.env.NODE_ENV === 'production') { console.error('ABORTA: NODE_ENV=production.'); process.exit(1); }
const host = getDbHost();
if (!host || !isLocalHost(host)) { console.error('ABORTA: DATABASE_URL no apunta a localhost.'); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error('ABORTA: JWT_SECRET no esta definido (usa --env-file=.env.dev).'); process.exit(1); }

const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/db');
const app = require('../src/app');
const { hashPassword } = require('../src/services/auth.service');
const { hashToken } = require('../src/services/recuperacion.service');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('PASS ' + msg); } else { fail++; console.log('FAIL ' + msg); } };

const CLAVE_VIEJA = 'Zz-Rec-Vieja123';
const CLAVE_NUEVA = 'Zz-Rec-Nueva456';
const CLAVE_NUEVA2 = 'Zz-Rec-Otra789x';
const EMAIL_A = 'zz_rec_alumno@example.test';
const EMAIL_ADMIN = 'zz_rec_admin@example.test';
const EMAIL_OFF = 'zz_rec_off@example.test';
const EMAIL_NOEXISTE = 'zz_rec_noexiste@example.test';

async function q1(sql, p) { return (await query(sql, p)).rows[0]; }
async function crearUsuario(nombre, email, rol, activo = true) {
  return q1(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES ($1,$2,$3,$4,$5) RETURNING id, email`,
    [nombre, email, await hashPassword(CLAVE_VIEJA), rol, activo]
  );
}
const tokenDe = (enlace) => (/#t=([A-Za-z0-9_-]+)$/.exec(enlace || '') || [])[1];

async function main() {
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  let ipN = 10;
  // Cada prueba usa una IP distinta (X-Forwarded-For; el servidor confía en 1 proxy) para no mezclar el límite por IP.
  async function http(ruta, json, ip) {
    const r = await fetch(base + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip || ('10.9.0.' + (ipN++)) },
      body: JSON.stringify(json),
    });
    return { status: r.status, data: await r.json() };
  }
  const recuperar = (email, ip) => http('/api/auth/recuperar', { email }, ip);
  const restablecer = (token, password) => http('/api/auth/restablecer', { token, password });
  const login = (email, password) => http('/api/auth/login', { email, password });

  try {
    const t = await q1(`SELECT to_regclass('password_resets') AS a`);
    if (!t.a) throw new Error('Falta la migracion 008 (npm run migrate:local).');

    await query(`DELETE FROM usuarios WHERE email LIKE 'zz_rec_%'`);
    const alumno = await crearUsuario('ZZ Rec Alumno', EMAIL_A, 'alumno');
    const admin = await crearUsuario('ZZ Rec Admin', EMAIL_ADMIN, 'admin');
    await crearUsuario('ZZ Rec Desactivado', EMAIL_OFF, 'alumno', false);

    // 1. Mensaje idéntico exista o no la cuenta (no revela qué correos están registrados)
    const rA = await recuperar(EMAIL_A);
    const rX = await recuperar(EMAIL_NOEXISTE);
    ok(rA.status === 200 && rX.status === 200, '1a. /recuperar responde 200 con cuenta existente y con correo inexistente');
    ok(rA.data.ok === true && rA.data.message === rX.data.message, '1b. el mensaje es idéntico en ambos casos');
    const n0 = await q1(`SELECT COUNT(*)::int AS n FROM password_resets pr JOIN usuarios u ON u.id=pr.usuario_id WHERE u.email=$1`, [EMAIL_NOEXISTE]);
    ok(n0.n === 0 && !('enlace_desarrollo' in rX.data), '1c. correo inexistente: no se crea token ni se entrega enlace');

    // 2. Cuenta desactivada: misma respuesta, sin token
    const rOff = await recuperar(EMAIL_OFF);
    const nOff = await q1(`SELECT COUNT(*)::int AS n FROM password_resets pr JOIN usuarios u ON u.id=pr.usuario_id WHERE u.email=$1`, [EMAIL_OFF]);
    ok(rOff.status === 200 && rOff.data.message === rA.data.message && nOff.n === 0, '2. cuenta desactivada: misma respuesta y no se crea token');

    // 3. Correo mal formado
    const rBad = await recuperar('esto-no-es-correo');
    ok(rBad.status === 400, '3. correo mal formado: 400');

    // 4. El token no se guarda en claro: solo su hash SHA-256
    const tokA = tokenDe(rA.data.enlace_desarrollo);
    ok(!!tokA && tokA.length === 43, '4a. el token tiene 43 caracteres (256 bits en base64url)');
    const fila = await q1(`SELECT token_hash, expira_en > NOW() AS vigente, expira_en < NOW() + INTERVAL '31 minutes' AS max31, usado_en FROM password_resets WHERE usuario_id=$1`, [alumno.id]);
    ok(fila.token_hash === hashToken(tokA) && fila.token_hash !== tokA, '4b. en la base de datos solo está el hash del token, no el token');
    ok(fila.vigente === true && fila.max31 === true && fila.usado_en === null, '4c. vence en 30 minutos y aún no está usado');

    // 5. Contraseña débil: rechaza y el enlace sigue sirviendo
    const rDebil = await restablecer(tokA, 'corta');
    ok(rDebil.status === 400, '5a. contraseña débil: 400');
    const aun = await q1(`SELECT usado_en FROM password_resets WHERE usuario_id=$1`, [alumno.id]);
    ok(aun.usado_en === null, '5b. una contraseña rechazada no consume el enlace');

    // 6. Restablecer con enlace válido
    const rOk = await restablecer(tokA, CLAVE_NUEVA);
    ok(rOk.status === 200 && rOk.data.ok === true, '6a. enlace válido + contraseña fuerte: 200');
    ok((await login(EMAIL_A, CLAVE_NUEVA)).status === 200, '6b. se puede iniciar sesión con la contraseña nueva');
    ok((await login(EMAIL_A, CLAVE_VIEJA)).status === 401, '6c. la contraseña vieja ya no sirve');

    // 7. Reutilizar el enlace
    const rReuso = await restablecer(tokA, CLAVE_NUEVA2);
    ok(rReuso.status === 400, '7a. reutilizar el enlace: 400');
    ok((await login(EMAIL_A, CLAVE_NUEVA)).status === 200, '7b. la contraseña no cambió con el intento de reutilización');

    // 8. Enlace vencido
    const rV = await recuperar(EMAIL_A);
    const tokV = tokenDe(rV.data.enlace_desarrollo);
    await query(`UPDATE password_resets SET expira_en = NOW() - INTERVAL '1 minute' WHERE token_hash=$1`, [hashToken(tokV)]);
    const rVenc = await restablecer(tokV, CLAVE_NUEVA2);
    ok(rVenc.status === 400 && rVenc.data.error === rReuso.data.error, '8a. enlace vencido: 400 con el mismo mensaje que el reutilizado');
    ok((await login(EMAIL_A, CLAVE_NUEVA)).status === 200, '8b. la contraseña no cambió con el enlace vencido');

    // 9. Tokens inexistentes o mal formados
    const rFalso = await restablecer('A'.repeat(43), CLAVE_NUEVA2);
    const rForma = await restablecer('no-es-un-token', CLAVE_NUEVA2);
    const rJwt = await restablecer('aaa.bbb.ccc', CLAVE_NUEVA2);
    ok(rFalso.status === 400 && rForma.status === 400 && rJwt.status === 400, '9. token inexistente o con formato inválido: 400');

    // 10. Un enlace nuevo invalida el anterior (se limpia el historial para no chocar con el tope por hora)
    await query(`DELETE FROM password_resets WHERE usuario_id=$1`, [alumno.id]);
    const r1 = await recuperar(EMAIL_A); const tok1 = tokenDe(r1.data.enlace_desarrollo);
    const r2 = await recuperar(EMAIL_A); const tok2 = tokenDe(r2.data.enlace_desarrollo);
    ok(tok1 && tok2 && tok1 !== tok2, '10a. cada solicitud genera un token distinto');
    ok((await restablecer(tok1, CLAVE_NUEVA2)).status === 400, '10b. el enlace anterior queda sin efecto');
    ok((await restablecer(tok2, CLAVE_NUEVA2)).status === 200, '10c. el enlace más reciente funciona');

    // 11. Tope de 3 solicitudes por hora por cuenta
    await query(`DELETE FROM password_resets WHERE usuario_id=$1`, [alumno.id]);
    for (let i = 0; i < 5; i++) await recuperar(EMAIL_A);
    const nTope = await q1(`SELECT COUNT(*)::int AS n FROM password_resets WHERE usuario_id=$1`, [alumno.id]);
    ok(nTope.n === 3, '11. tope por cuenta: 5 solicitudes seguidas crean solo 3 tokens (' + nTope.n + ')');

    // 12. Administradores
    const rAd = await recuperar(EMAIL_ADMIN);
    const tokAd = tokenDe(rAd.data.enlace_desarrollo);
    ok(!!tokAd, '12a. un administrador también recibe enlace');
    ok((await restablecer(tokAd, CLAVE_NUEVA)).status === 200, '12b. el administrador restablece su contraseña');
    const lAd = await login(EMAIL_ADMIN, CLAVE_NUEVA);
    ok(lAd.status === 200 && lAd.data.user.rol === 'admin', '12c. el administrador inicia sesión con la nueva (rol admin)');

    // 13. Límite por IP (5 solicitudes por hora) en /recuperar
    const ipLim = '10.77.0.1';
    const codigos = [];
    for (let i = 0; i < 7; i++) codigos.push((await recuperar(EMAIL_NOEXISTE, ipLim)).status);
    ok(codigos.slice(0, 5).every((c) => c === 200) && codigos[5] === 429 && codigos[6] === 429, '13a. límite por IP en /recuperar: 5 pasan y la 6.ª recibe 429 (' + codigos.join(',') + ')');
    const ipLim2 = '10.77.0.2';
    const cod2 = [];
    for (let i = 0; i < 12; i++) cod2.push((await http('/api/auth/restablecer', { token: 'A'.repeat(43), password: CLAVE_NUEVA }, ipLim2)).status);
    ok(cod2.slice(0, 10).every((c) => c === 400) && cod2[10] === 429, '13b. límite por IP en /restablecer: 10 pasan y la 11.ª recibe 429');

    // 14. La página de restablecimiento no filtra el token por Referer
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'restablecer.html'), 'utf8');
    ok(/<meta name="referrer" content="no-referrer"\/>/.test(html), '14. restablecer.html declara Referrer-Policy no-referrer');
  } catch (e) {
    fail++; console.log('FAIL excepcion: ' + e.message);
  } finally {
    await query(`DELETE FROM usuarios WHERE email LIKE 'zz_rec_%'`).catch(() => {});
    server.close();
    await pool.end();
    console.log(`\nRESULTADO: ${pass} PASS, ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
  }
}
main();
