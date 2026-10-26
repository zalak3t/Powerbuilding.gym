// R.28: mide el tiempo de respuesta de los endpoints principales (solo BD local).
// Uso:  cd web/backend && node --env-file=.env.dev scripts/medir-tiempos.js
// 20 llamadas por endpoint (mas 1 de calentamiento descartada). Veredicto: maximo < 2000 ms.
// Unica escritura: datos temporales "zz_r28_*" para medir reservas; se borran al final.
// No imprime URL de BD, JWT_SECRET ni tokens. El correo queda en modo simulado.
process.env.PB_LOCAL = '1';
process.env.NOTIF_JOBS = 'off';
process.env.EMAIL_PROVIDER = 'simulado';
process.env.EMAIL_API_KEY = '';

const { getDbHost, isLocalHost } = require('../src/config/dbHost');

if (process.env.NODE_ENV === 'production') {
  console.error('ABORTA: NODE_ENV=production. Este script solo corre contra la BD local.');
  process.exit(1);
}
const host = getDbHost();
if (!host || !isLocalHost(host)) {
  console.error('ABORTA: DATABASE_URL no apunta a localhost.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('ABORTA: JWT_SECRET no esta definido (usa --env-file=.env.dev).');
  process.exit(1);
}

const jwt = require('jsonwebtoken');
const { query, pool } = require('../src/config/db');
const app = require('../src/app');

const UMBRAL_MS = 2000;
const N = 20;
const TAG = 'zz_r28_';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function firmar(u) {
  return jwt.sign({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}
function restarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function estadisticas(ms) {
  const s = ms.slice().sort((a, b) => a - b);
  const mediana = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const p95 = s[Math.ceil(0.95 * s.length) - 1];
  return { n: s.length, mediana, p95, max: s[s.length - 1] };
}

async function medir(nombre, fn) {
  await fn(); // calentamiento, descartado
  const ms = [];
  let fallos = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const status = await fn();
    ms.push(performance.now() - t0);
    if (status < 200 || status >= 300) fallos++;
  }
  return Object.assign({ nombre, fallos }, estadisticas(ms));
}

async function main() {
  const resultados = [];
  const ids = { usuario: null, cliente: null, bloque: null };
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;

  try {
    const admin = (await query(`SELECT id, nombre, email, rol FROM usuarios WHERE rol = 'admin' AND activo = TRUE ORDER BY id LIMIT 1`)).rows[0];
    if (!admin) throw new Error('No hay un administrador activo en la BD local.');
    const tokAdmin = firmar(admin);
    const hdrAdmin = { Authorization: 'Bearer ' + tokAdmin };

    const conteo = (await query(
      `SELECT (SELECT COUNT(*) FROM clientes)::int AS clientes, (SELECT COUNT(*) FROM bloques)::int AS bloques,
              (SELECT COUNT(*) FROM pagos)::int AS pagos, (SELECT COUNT(*) FROM asistencias)::int AS asistencias,
              (SELECT COUNT(*) FROM notificaciones_log)::int AS notificaciones`
    )).rows[0];

    // Consume el cuerpo completo para medir la respuesta entera.
    const getStatus = (ruta, headers) => async () => {
      const r = await fetch(base + ruta, { headers: headers || {} });
      await r.arrayBuffer();
      return r.status;
    };

    const hasta = hoyChile();
    const desde366 = restarDias(hasta, 365); // rango inclusivo de 366 dias (maximo permitido)

    const pruebas = [
      ['GET /api/bloques (publico)',                   getStatus('/api/bloques')],
      ['GET /api/bloques/admin',                       getStatus('/api/bloques/admin', hdrAdmin)],
      ['GET /api/clientes',                            getStatus('/api/clientes', hdrAdmin)],
      ['GET /api/pagos',                               getStatus('/api/pagos', hdrAdmin)],
      ['GET /api/notificaciones',                      getStatus('/api/notificaciones', hdrAdmin)],
      ['GET /api/reportes/asistencia (mes)',           getStatus('/api/reportes/asistencia', hdrAdmin)],
      ['GET /api/reportes/ocupacion-ingresos (mes)',   getStatus('/api/reportes/ocupacion-ingresos', hdrAdmin)],
      ['GET /api/reportes/asistencia (366 dias)',      getStatus('/api/reportes/asistencia?desde=' + desde366 + '&hasta=' + hasta, hdrAdmin)],
      ['GET /api/reportes/ocupacion-ingresos (366 d)', getStatus('/api/reportes/ocupacion-ingresos?desde=' + desde366 + '&hasta=' + hasta, hdrAdmin)],
    ];
    for (const [nombre, fn] of pruebas) resultados.push(await medir(nombre, fn));

    // ── Reservas: datos temporales aislados (alumno, cliente y bloque zz_r28_*) ──
    const u = (await query(
      `INSERT INTO usuarios (nombre, email, telefono, password_hash, rol, activo)
       VALUES ('ZZ R28', $1, '+56900000000', 'x', 'alumno', TRUE) RETURNING id, nombre, email, rol`,
      [TAG + 'alumno@test.local']
    )).rows[0];
    ids.usuario = u.id;
    ids.cliente = (await query(
      `INSERT INTO clientes (usuario_id, nombre, email, telefono) VALUES ($1, 'ZZ R28', $2, '+56900000000') RETURNING id`,
      [u.id, TAG + 'cliente@test.local']
    )).rows[0].id;
    ids.bloque = (await query(
      `INSERT INTO bloques (dia, horario, capacidad, estado) VALUES ('Domingo', '03:00-03:30 ${TAG}', 50, 'activo') RETURNING id`
    )).rows[0].id;
    const hdrAlumno = { Authorization: 'Bearer ' + firmar(u), 'Content-Type': 'application/json' };

    const crear = async () => {
      const r = await fetch(base + '/api/reservas', { method: 'POST', headers: hdrAlumno, body: JSON.stringify({ bloque_id: ids.bloque }) });
      const j = await r.json();
      crear.ultimoId = j.reserva ? j.reserva.id : null;
      return r.status;
    };
    const cancelar = async () => {
      const r = await fetch(base + '/api/reservas/' + crear.ultimoId, { method: 'DELETE', headers: hdrAlumno });
      await r.arrayBuffer();
      return r.status;
    };

    // Se miden POST y DELETE por separado: cada iteracion crea y luego cancela.
    const msCrear = []; const msCancelar = []; let fCrear = 0; let fCancelar = 0;
    for (let i = 0; i <= N; i++) { // i = 0 es calentamiento
      let t0 = performance.now();
      const sc = await crear();
      const dc = performance.now() - t0;
      t0 = performance.now();
      const sd = await cancelar();
      const dd = performance.now() - t0;
      if (i === 0) continue;
      msCrear.push(dc); msCancelar.push(dd);
      if (sc !== 201) fCrear++;
      if (sd !== 200) fCancelar++;
    }
    resultados.push(Object.assign({ nombre: 'POST /api/reservas (crear)', fallos: fCrear }, estadisticas(msCrear)));
    resultados.push(Object.assign({ nombre: 'DELETE /api/reservas/:id (cancelar)', fallos: fCancelar }, estadisticas(msCancelar)));

    // ── Informe ──
    const f = (x) => x.toFixed(1).padStart(8);
    console.log('\nR.28 - Tiempos de respuesta (' + N + ' llamadas por endpoint, calentamiento descartado)');
    console.log('Datos en la BD local: ' + Object.keys(conteo).map((k) => k + '=' + conteo[k]).join(', '));
    console.log('Medido en la misma maquina (sin latencia de red); no equivale a Railway.\n');
    console.log('Endpoint'.padEnd(48) + 'mediana'.padStart(9) + 'p95'.padStart(9) + 'max'.padStart(9) + '  veredicto');
    let incumple = false;
    for (const r of resultados) {
      const ok = r.max < UMBRAL_MS && r.fallos === 0;
      if (!ok) incumple = true;
      const nota = r.fallos ? ' (' + r.fallos + ' con HTTP != esperado)' : '';
      console.log(r.nombre.padEnd(48) + f(r.mediana) + ' ' + f(r.p95) + ' ' + f(r.max) + '  ' + (ok ? 'CUMPLE' : 'NO CUMPLE') + nota);
    }
    console.log('\nUmbral: ' + UMBRAL_MS + ' ms (se evalua el maximo). Resultado global: ' + (incumple ? 'NO CUMPLE' : 'CUMPLE'));
    process.exitCode = incumple ? 1 : 0;
  } finally {
    await sleep(500); // deja terminar el aviso asincrono de R.18 antes de limpiar
    try {
      await query('DELETE FROM notificaciones_log WHERE destinatario LIKE $1', [TAG + '%']);
      if (ids.bloque) await query('DELETE FROM bloques WHERE id = $1', [ids.bloque]);
      if (ids.cliente) await query('DELETE FROM clientes WHERE id = $1', [ids.cliente]);
      if (ids.usuario) await query('DELETE FROM usuarios WHERE id = $1', [ids.usuario]);
      await query('DELETE FROM notificaciones_log WHERE destinatario LIKE $1', [TAG + '%']);
    } catch (e) {
      console.error('Aviso: no se pudo limpiar todo (' + e.message + '). Buscar filas "' + TAG + '*".');
    }
    server.close();
    await pool.end();
  }
}

main().catch((e) => { console.error('ERROR: ' + e.message); process.exitCode = 1; });
