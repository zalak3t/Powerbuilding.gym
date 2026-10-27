// Pruebas Bloque 7 (pago en linea Webpay Plus + comprobante). Solo BD local, SIN red:
// el SDK de Webpay se reemplaza por un doble y el correo queda simulado.
// Uso:  cd web/backend && node --env-file=.env.dev scripts/test-bloque7.js
// Requiere la migracion 004 aplicada (npm run migrate:local). Crea datos "zz_b7_*" y los borra al final.
// No imprime secretos ni tokens.
process.env.PB_LOCAL = '1';
process.env.NOTIF_JOBS = 'off';
process.env.EMAIL_PROVIDER = 'simulado';
process.env.EMAIL_API_KEY = '';
process.env.PAGOS_PROVIDER = 'webpay_integracion';
process.env.BOLETA_PROVIDER = 'simulado';
process.env.FRONTEND_URL = 'http://front.test';

const { getDbHost, isLocalHost } = require('../src/config/dbHost');
if (process.env.NODE_ENV === 'production') { console.error('ABORTA: NODE_ENV=production.'); process.exit(1); }
const host = getDbHost();
if (!host || !isLocalHost(host)) { console.error('ABORTA: DATABASE_URL no apunta a localhost.'); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error('ABORTA: JWT_SECRET no esta definido (usa --env-file=.env.dev).'); process.exit(1); }

// Captura de logs para comprobar que no se filtran tokens
const logs = [];
['log', 'warn', 'error'].forEach((m) => { const o = console[m]; console[m] = (...a) => { logs.push(a.map(String).join(' ')); o.apply(console, a); }; });

const jwt = require('jsonwebtoken');
const { query, pool } = require('../src/config/db');
const app = require('../src/app');
const webpay = require('../src/services/webpay.service');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('PASS ' + msg); } else { fail++; console.log('FAIL ' + msg); } };
const firmar = (u) => jwt.sign({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre }, process.env.JWT_SECRET, { expiresIn: '10m' });

// ── Doble del SDK de Webpay ──
const fake = {
  creates: [], commits: [], statuses: [], failCreate: false, respuestas: {}, n: 0,
  create(buyOrder, sessionId, amount, returnUrl) {
    if (fake.failCreate) throw new Error('Proveedor caido');
    const token = 'zz_b7_tok_' + (++fake.n);
    fake.creates.push({ buyOrder, sessionId, amount, returnUrl, token });
    return { token, url: 'https://webpay.test/init' };
  },
  commit(token) {
    fake.commits.push(token);
    const c = fake.creates.find((x) => x.token === token);
    const base = {
      status: 'AUTHORIZED', response_code: 0, amount: c.amount, buy_order: c.buyOrder,
      authorization_code: '123456', payment_type_code: 'VN', installments_number: 0,
      card_detail: { card_number: '6623' }, vci: 'TSY', transaction_date: '2026-10-26T12:00:00.000Z', accounting_date: '1026',
    };
    return Object.assign(base, fake.respuestas[token] || {});
  },
  status(token) { fake.statuses.push(token); return fake.commit(token); },
};
webpay.setClienteWebpay(fake);

const ids = { usuarios: [], clientes: [], plan: null };
let plantillaActivaOriginal = null;

async function q1(sql, p) { return (await query(sql, p)).rows[0]; }

async function main() {
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  process.env.BACKEND_PUBLIC_URL = base;

  async function http(method, ruta, { token, json, form } = {}) {
    const headers = {};
    let body;
    if (token) headers.Authorization = 'Bearer ' + token;
    if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    const r = await fetch(base + ruta, { method, headers, body, redirect: 'manual' });
    const ct = r.headers.get('content-type') || '';
    let data = null; let buf = null;
    if (ct.includes('application/json')) data = await r.json(); else buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, data, buf, ct, location: r.headers.get('location') };
  }

  try {
    // Migracion 004 aplicada?
    const t = await q1(`SELECT to_regclass('transacciones_pago') AS a, to_regclass('documentos_pago') AS b`);
    if (!t.a || !t.b) throw new Error('Falta la migracion 004: ejecuta npm run migrate:local');

    // ── Datos zz_b7_* ──
    const admin = await q1(`SELECT id, nombre, email, rol FROM usuarios WHERE rol = 'admin' AND activo = TRUE ORDER BY id LIMIT 1`);
    if (!admin) throw new Error('No hay un administrador activo en la BD local.');
    const mkAlumno = async (tag) => {
      const u = await q1(`INSERT INTO usuarios (nombre, email, telefono, password_hash, rol, activo)
                          VALUES ($1, $2, '+56900000000', 'x', 'alumno', TRUE) RETURNING id, nombre, email, rol`,
        ['ZZ B7 ' + tag, 'zz_b7_' + tag + '@test.local']);
      ids.usuarios.push(u.id);
      const c = await q1(`INSERT INTO clientes (usuario_id, nombre, email, telefono) VALUES ($1, $2, $3, '+56900000000') RETURNING id`,
        [u.id, 'ZZ B7 ' + tag, 'zz_b7_c_' + tag + '@test.local']);
      ids.clientes.push(c.id);
      return { user: u, clienteId: c.id, token: firmar(u) };
    };
    const A = await mkAlumno('a');
    const B = await mkAlumno('b');
    const tokAdmin = firmar(admin);
    const plan = await q1(`INSERT INTO planes (nombre, descripcion, duracion_dias, precio) VALUES ('zz_b7_plan', 'prueba', 30, 12345) RETURNING id`);
    ids.plan = plan.id;
    const hoy = (await q1(`SELECT to_char((NOW() AT TIME ZONE 'America/Santiago')::date, 'YYYY-MM-DD') AS d, to_char((NOW() AT TIME ZONE 'America/Santiago')::date + 29, 'YYYY-MM-DD') AS h`));
    const pl = await q1(`SELECT activo FROM plantillas_notificacion WHERE clave = 'pago_confirmado'`);
    if (!pl) throw new Error('Falta la plantilla pago_confirmado (migracion 004).');
    plantillaActivaOriginal = pl.activo;

    const iniciar = (who, body) => http('POST', '/api/pagos-online/iniciar', { token: who.token, json: body });
    const ultimaCreate = () => fake.creates[fake.creates.length - 1];

    // ── Estado y autenticacion ──
    let r = await http('GET', '/api/pagos-online/estado');
    ok(r.status === 200 && r.data.habilitado === true && r.data.proveedor === 'webpay_integracion', 'GET /estado: habilitado con webpay_integracion y sin secretos');
    r = await http('POST', '/api/pagos-online/iniciar', { json: { plan_id: plan.id } });
    ok(r.status === 401, 'iniciar sin token -> 401');
    r = await http('GET', '/api/pagos-online/planes');
    ok(r.status === 401, 'planes sin token -> 401');
    r = await http('POST', '/api/pagos-online/iniciar', { token: tokAdmin, json: { plan_id: plan.id } });
    ok(r.status === 403, 'admin en iniciar -> 403 (solo alumnos)');
    r = await http('GET', '/api/pagos-online/planes', { token: A.token });
    ok(r.status === 200 && r.data.planes.some((p) => p.id === plan.id) && r.data.membresia, 'planes: alumno ve planes activos y su membresia');

    // ── Proveedor apagado ──
    process.env.PAGOS_PROVIDER = 'off';
    r = await iniciar(A, { plan_id: plan.id });
    ok(r.status === 503, 'PAGOS_PROVIDER=off -> 503');
    process.env.PAGOS_PROVIDER = 'webpay_integracion';

    // ── Monto manipulado / cliente ajeno ──
    const ncreate = fake.creates.length;
    r = await iniciar(A, { plan_id: plan.id, monto: 1, cliente_id: String(A.clienteId) });
    ok(r.status === 201 && r.data.url && r.data.token && r.data.id, 'iniciar: devuelve id, url y token');
    ok(fake.creates.length === ncreate + 1 && ultimaCreate().amount === 12345, 'monto manipulado: se ignora el body y se cobra el precio del plan (12345)');
    ok(ultimaCreate().buyOrder.length <= 26, 'buy_order de 26 caracteres o menos');
    ok(ultimaCreate().returnUrl === base + '/api/pagos-online/retorno', 'return_url apunta al backend');
    const tx1 = r.data.id; const tok1 = r.data.token;
    const fila = await q1('SELECT monto, estado FROM transacciones_pago WHERE id = $1', [tx1]);
    ok(fila.monto === 12345 && fila.estado === 'iniciada', 'transaccion guardada con el monto del plan y estado iniciada');
    r = await iniciar(A, { plan_id: plan.id, cliente_id: B.clienteId });
    ok(r.status === 403, 'alumno pagando por otro cliente -> 403');

    // ── Autorizado (POST form-urlencoded) ──
    r = await http('POST', '/api/pagos-online/retorno', { form: { token_ws: tok1 } });
    ok(r.status === 303 && r.location === 'http://front.test/pago-resultado.html?tx=' + tx1, 'retorno autorizado: 303 a pago-resultado.html?tx=<id> sin datos sensibles');
    ok(!String(r.location).includes(tok1), 'la URL de resultado no contiene el token');
    const t1 = await q1('SELECT estado, pago_id, respuesta FROM transacciones_pago WHERE id = $1', [tx1]);
    ok(t1.estado === 'autorizada' && t1.pago_id, 'transaccion autorizada con pago asociado');
    ok(t1.respuesta && !('card_detail' in t1.respuesta) && !JSON.stringify(t1.respuesta).includes('6623'), 'respuesta guardada sin datos de tarjeta');
    const pago1 = await q1(`SELECT metodo, origen, monto, estado, to_char(periodo_desde,'YYYY-MM-DD') AS d, to_char(periodo_hasta,'YYYY-MM-DD') AS h FROM pagos WHERE id = $1`, [t1.pago_id]);
    ok(pago1.metodo === 'webpay' && pago1.origen === 'online' && pago1.monto === 12345 && pago1.estado === 'pagado', 'pago creado: webpay / online / monto del plan / pagado');
    ok(pago1.d === hoy.d && pago1.h === hoy.h, 'periodo: desde hoy, hasta = desde + duracion_dias - 1');
    const doc1 = await q1(`SELECT estado, folio, enviado_en, substring(pdf from 1 for 4) AS cab FROM documentos_pago WHERE pago_id = $1 AND tipo = 'comprobante'`, [t1.pago_id]);
    ok(doc1 && doc1.estado === 'emitido' && /^CP-\d{6}$/.test(doc1.folio) && String(doc1.cab) === '%PDF' && doc1.enviado_en, 'comprobante emitido: PDF valido, folio CP-nnnnnn y correo registrado');
    const nt1 = await q1(`SELECT estado, tipo FROM notificaciones_log WHERE clave_unica = $1`, ['pago:' + t1.pago_id]);
    ok(nt1 && nt1.tipo === 'pago_confirmado' && nt1.estado === 'simulado', 'correo pago_confirmado simulado con clave_unica pago:<id>');

    // ── Acceso a la transaccion ──
    r = await http('GET', '/api/pagos-online/' + tx1, { token: A.token });
    ok(r.status === 200 && r.data.transaccion.estado === 'autorizada' && r.data.transaccion.documento_disponible === true, 'GET /:id del dueño -> 200 con documento disponible');
    ok(!('token' in r.data.transaccion) && !('usuario_id' in r.data.transaccion), 'GET /:id no expone token ni usuario_id');
    r = await http('GET', '/api/pagos-online/' + tx1, { token: B.token });
    ok(r.status === 403, 'GET /:id de otro alumno -> 403');
    r = await http('GET', '/api/pagos-online/' + tx1, { token: tokAdmin });
    ok(r.status === 200, 'GET /:id como admin -> 200');
    r = await http('GET', '/api/pagos-online/' + tx1 + '/documento', { token: A.token });
    ok(r.status === 200 && r.ct.includes('application/pdf') && r.buf.slice(0, 4).toString() === '%PDF', 'GET /:id/documento: PDF del dueño');
    r = await http('GET', '/api/pagos-online/' + tx1 + '/documento', { token: B.token });
    ok(r.status === 403, 'GET /:id/documento de otro alumno -> 403');

    // ── Retorno duplicado (por GET) ──
    const ncommit = fake.commits.length;
    r = await http('GET', '/api/pagos-online/retorno?token_ws=' + encodeURIComponent(tok1));
    ok(r.status === 303, 'retorno duplicado por GET: 303');
    const cuenta = await q1('SELECT COUNT(*)::int AS n FROM pagos WHERE cliente_id = $1', [A.clienteId]);
    const nn = await q1(`SELECT COUNT(*)::int AS n FROM notificaciones_log WHERE clave_unica = $1`, ['pago:' + t1.pago_id]);
    ok(fake.commits.length === ncommit && cuenta.n === 1 && nn.n === 1, 'retorno duplicado: sin nuevo commit, un solo pago y un solo correo');

    // ── Renovacion: desde el dia siguiente al fin del periodo vigente ──
    r = await iniciar(A, { plan_id: plan.id });
    const txR = r.data.id;
    await http('GET', '/api/pagos-online/retorno?token_ws=' + encodeURIComponent(r.data.token));
    const tR = await q1('SELECT pago_id FROM transacciones_pago WHERE id = $1', [txR]);
    const pagoR = await q1(`SELECT to_char(periodo_desde,'YYYY-MM-DD') AS d FROM pagos WHERE id = $1`, [tR.pago_id]);
    const esperado = await q1(`SELECT to_char($1::date + 1, 'YYYY-MM-DD') AS d`, [pago1.h]);
    ok(pagoR.d === esperado.d, 'renovacion: periodo_desde = dia siguiente al fin del periodo vigente');

    // ── Rechazado ──
    r = await iniciar(B, { plan_id: plan.id });
    const txRe = r.data.id;
    fake.respuestas[r.data.token] = { status: 'FAILED', response_code: -1 };
    await http('GET', '/api/pagos-online/retorno?token_ws=' + encodeURIComponent(r.data.token));
    const tRe = await q1('SELECT estado, pago_id FROM transacciones_pago WHERE id = $1', [txRe]);
    ok(tRe.estado === 'rechazada' && !tRe.pago_id, 'rechazado: estado rechazada y sin pago');

    // ── Anulado (TBK_TOKEN) ──
    r = await iniciar(B, { plan_id: plan.id });
    const txAn = r.data.id; const tokAn = r.data.token;
    const nc = fake.commits.length;
    r = await http('POST', '/api/pagos-online/retorno', { form: { TBK_TOKEN: tokAn, TBK_ORDEN_COMPRA: ultimaCreate().buyOrder, TBK_ID_SESION: 'x' } });
    const tAn = await q1('SELECT estado, pago_id FROM transacciones_pago WHERE id = $1', [txAn]);
    ok(tAn.estado === 'anulada' && !tAn.pago_id && fake.commits.length === nc, 'anulado: estado anulada, sin commit y sin pago');
    ok(r.status === 303 && r.location === 'http://front.test/pago-resultado.html?tx=' + txAn, 'anulado: redirige al resultado');

    // ── Expirado (sin token, solo orden de compra) ──
    r = await iniciar(B, { plan_id: plan.id });
    const txEx = r.data.id;
    await http('POST', '/api/pagos-online/retorno', { form: { TBK_ORDEN_COMPRA: ultimaCreate().buyOrder, TBK_ID_SESION: 'x' } });
    const tEx = await q1('SELECT estado FROM transacciones_pago WHERE id = $1', [txEx]);
    ok(tEx.estado === 'expirada', 'expirado: estado expirada');

    // ── Retorno sin ningun dato ──
    r = await http('GET', '/api/pagos-online/retorno');
    ok(r.status === 303 && r.location === 'http://front.test/pago-resultado.html?tx=0', 'retorno sin datos: 303 sin romper');

    // ── Autorizado con datos que no coinciden (monto distinto) ──
    r = await iniciar(B, { plan_id: plan.id });
    const txM = r.data.id;
    fake.respuestas[r.data.token] = { amount: 1 };
    await http('GET', '/api/pagos-online/retorno?token_ws=' + encodeURIComponent(r.data.token));
    const tM = await q1('SELECT estado, pago_id FROM transacciones_pago WHERE id = $1', [txM]);
    ok(tM.estado === 'rechazada' && !tM.pago_id, 'monto devuelto por el proveedor distinto al guardado -> rechazada, sin pago');

    // ── Plan inactivo / falla del proveedor al iniciar ──
    await query('UPDATE planes SET activo = FALSE WHERE id = $1', [plan.id]);
    r = await iniciar(A, { plan_id: plan.id });
    ok(r.status === 409, 'plan inactivo en iniciar -> 409');
    await query('UPDATE planes SET activo = TRUE WHERE id = $1', [plan.id]);
    fake.failCreate = true;
    r = await iniciar(A, { plan_id: plan.id });
    fake.failCreate = false;
    ok(r.status === 502, 'falla del proveedor al crear -> 502');
    const fallida = await q1(`SELECT estado FROM transacciones_pago WHERE cliente_id = $1 ORDER BY id DESC LIMIT 1`, [A.clienteId]);
    ok(fallida.estado === 'rechazada', 'transaccion fallida al iniciar queda rechazada');

    // ── Fallo del correo/documento no revierte el pago; el admin reintenta ──
    await query(`UPDATE plantillas_notificacion SET activo = FALSE WHERE clave = 'pago_confirmado'`);
    r = await iniciar(B, { plan_id: plan.id });
    const txF = r.data.id;
    await http('GET', '/api/pagos-online/retorno?token_ws=' + encodeURIComponent(r.data.token));
    const tF = await q1('SELECT estado, pago_id FROM transacciones_pago WHERE id = $1', [txF]);
    const pF = await q1('SELECT estado FROM pagos WHERE id = $1', [tF.pago_id]);
    const dF = await q1(`SELECT estado, pdf IS NOT NULL AS hay_pdf FROM documentos_pago WHERE pago_id = $1`, [tF.pago_id]);
    ok(tF.estado === 'autorizada' && pF.estado === 'pagado', 'correo fallido: el pago NO se revierte');
    ok(dF.estado === 'error' && dF.hay_pdf, 'correo fallido: documento en estado error (PDF generado)');
    await query(`UPDATE plantillas_notificacion SET activo = TRUE WHERE clave = 'pago_confirmado'`);
    r = await http('POST', '/api/pagos-online/' + txF + '/reintentar-documento', { token: B.token });
    ok(r.status === 403, 'reintentar como alumno -> 403');
    r = await http('POST', '/api/pagos-online/' + txF + '/reintentar-documento', { token: tokAdmin });
    const dF2 = await q1(`SELECT estado, enviado_en FROM documentos_pago WHERE pago_id = $1`, [tF.pago_id]);
    const nF = await q1(`SELECT estado FROM notificaciones_log WHERE clave_unica = $1`, ['pago:' + tF.pago_id]);
    ok(r.status === 200 && r.data.ok && dF2.estado === 'emitido' && dF2.enviado_en && nF.estado === 'simulado', 'reintento del admin: documento emitido y correo reenviado');

    // ── Listado admin ──
    r = await http('GET', '/api/pagos-online?estado=autorizada&limit=100', { token: tokAdmin });
    ok(r.status === 200 && r.data.transacciones.some((x) => x.id === tx1) && r.data.transacciones.every((x) => x.estado === 'autorizada'), 'listado admin con filtro de estado');
    const fTx = r.data.transacciones.find((x) => x.id === tx1);
    ok(fTx && fTx.cliente_nombre && fTx.plan_nombre && Number.isInteger(Number(fTx.monto)) && fTx.creado_en
      && fTx.documento_estado === 'emitido' && fTx.documento_folio && fTx.documento_disponible === true
      && !('token' in fTx) && !('usuario_id' in fTx), 'listado admin: la fila trae los campos que usa la tabla y no expone token ni usuario_id');
    r = await http('GET', '/api/pagos-online', { token: A.token });
    ok(r.status === 403, 'listado de transacciones como alumno -> 403');

    // ── GET /api/pagos expone origen y transaccion_id (columnas Origen y Comprobante del admin) ──
    r = await http('GET', '/api/pagos', { token: tokAdmin });
    const pTx = r.status === 200 && (r.data.pagos || []).find((x) => x.transaccion_id === tx1);
    ok(pTx && pTx.origen === 'online' && pTx.metodo === 'webpay', 'GET /api/pagos: pago online con origen=online, metodo=webpay y transaccion_id');

    // ── Sin secretos en logs ──
    const todos = logs.join('\n');
    ok(!todos.includes('zz_b7_tok_'), 'ningun token aparece en los logs');
  } finally {
    try {
      if (plantillaActivaOriginal !== null) {
        await query(`UPDATE plantillas_notificacion SET activo = $1 WHERE clave = 'pago_confirmado'`, [plantillaActivaOriginal]);
      }
      await query(`DELETE FROM notificaciones_log WHERE destinatario LIKE 'zz_b7_%'`);
      if (ids.clientes.length) {
        await query('DELETE FROM transacciones_pago WHERE cliente_id = ANY($1::int[])', [ids.clientes]);
        await query('DELETE FROM pagos WHERE cliente_id = ANY($1::int[])', [ids.clientes]);
        await query('DELETE FROM clientes WHERE id = ANY($1::int[])', [ids.clientes]);
      }
      if (ids.plan) await query('DELETE FROM planes WHERE id = $1', [ids.plan]);
      if (ids.usuarios.length) await query('DELETE FROM usuarios WHERE id = ANY($1::int[])', [ids.usuarios]);
      await query(`DELETE FROM notificaciones_log WHERE destinatario LIKE 'zz_b7_%'`);
    } catch (e) {
      console.error('Aviso: no se pudo limpiar todo (' + e.message + '). Buscar filas "zz_b7_*".');
    }
    server.close();
    await pool.end();
  }
  console.log('\nResultado: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exitCode = fail ? 1 : 0;
}

main().catch(async (e) => {
  console.error('ERROR: ' + e.message);
  process.exitCode = 1;
});
