// Pruebas Bloque 8 ("Mi cuenta" del alumno, foto de perfil, marcas, contraseña). Solo BD local, SIN red.
// Uso:  cd web/backend && node --env-file=.env.dev scripts/test-bloque8.js
// Requiere la migracion 005 aplicada (npm run migrate:local). Crea datos "zz_b8_*" y los borra al final.
// No imprime secretos ni tokens.
process.env.PB_LOCAL = '1';
process.env.NOTIF_JOBS = 'off';
process.env.EMAIL_PROVIDER = 'simulado';
process.env.EMAIL_API_KEY = '';

const { getDbHost, isLocalHost } = require('../src/config/dbHost');
if (process.env.NODE_ENV === 'production') { console.error('ABORTA: NODE_ENV=production.'); process.exit(1); }
const host = getDbHost();
if (!host || !isLocalHost(host)) { console.error('ABORTA: DATABASE_URL no apunta a localhost.'); process.exit(1); }
if (!process.env.JWT_SECRET) { console.error('ABORTA: JWT_SECRET no esta definido (usa --env-file=.env.dev).'); process.exit(1); }

const jwt = require('jsonwebtoken');
const { query, pool } = require('../src/config/db');
const app = require('../src/app');
const { hashPassword } = require('../src/services/auth.service');
const { proximaFecha } = require('../src/services/miCuenta.service');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('PASS ' + msg); } else { fail++; console.log('FAIL ' + msg); } };
const firmar = (u) => jwt.sign({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre }, process.env.JWT_SECRET, { expiresIn: '10m' });

// Contraseñas de prueba (solo existen en la BD local de pruebas)
const PASS_A = 'Zz-B8-Clave123';
const PASS_A_NUEVA = 'Zz-B8-Nueva456';
const PASS_LEGADO = 'abcd1234'; // 8 caracteres, valida antes del Bloque 8

// JPEG real de 64x64 (generado con System.Drawing): sirve como foto (min 64) y como miniatura (max 96)
const REAL64_B64 = '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';
const REAL64 = Buffer.from(REAL64_B64, 'base64');

// JPEG sintetico estructuralmente valido (el servidor valida estructura y dimensiones, no decodifica pixeles)
function mkJpeg(w, h, { exif = false, com = false, pad = 0, sinEoi = false } = {}) {
  const p = [Buffer.from([0xff, 0xd8])];
  p.push(Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]));
  if (exif) p.push(Buffer.from([0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]));
  if (com) p.push(Buffer.from([0xff, 0xfe, 0x00, 0x04, 0x68, 0x69]));
  p.push(Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]));
  p.push(Buffer.from([0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]));
  p.push(Buffer.alloc(40 + pad, 0x55));
  if (!sinEoi) p.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(p);
}
const b64 = (b) => b.toString('base64');

const ids = { usuarios: [], clientes: [], plan: null, bloques: [] };

async function q1(sql, p) { return (await query(sql, p)).rows[0]; }

async function main() {
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;

  async function http(method, ruta, { token, json } = {}) {
    const headers = {};
    let body;
    if (token) headers.Authorization = 'Bearer ' + token;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    const r = await fetch(base + ruta, { method, headers, body, redirect: 'manual' });
    const ct = r.headers.get('content-type') || '';
    let data = null; let buf = null;
    if (ct.includes('application/json')) data = await r.json(); else buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, data, buf, ct, headers: r.headers };
  }
  const login = (email, password) => http('POST', '/api/auth/login', { json: { email, password } });

  try {
    // Migracion 005 aplicada?
    const t = await q1(`SELECT to_regclass('clientes_foto') AS a, to_regclass('marcas') AS b`);
    if (!t.a || !t.b) throw new Error('Falta la migracion 005: ejecuta npm run migrate:local');

    // ── Datos zz_b8_* ──
    const admin = await q1(`SELECT id, nombre, email, rol FROM usuarios WHERE rol = 'admin' AND activo = TRUE ORDER BY id LIMIT 1`);
    if (!admin) throw new Error('No hay un administrador activo en la BD local.');
    const hashA = await hashPassword(PASS_A);
    const mkAlumno = async (tag, { hash = hashA, cliente = true } = {}) => {
      const u = await q1(`INSERT INTO usuarios (nombre, email, telefono, password_hash, rol, activo)
                          VALUES ($1, $2, '+56900000000', $3, 'alumno', TRUE) RETURNING id, nombre, email, rol`,
        ['ZZ B8 ' + tag, 'zz_b8_' + tag + '@test.local', hash]);
      ids.usuarios.push(u.id);
      let clienteId = null;
      if (cliente) {
        const c = await q1(`INSERT INTO clientes (usuario_id, nombre, email, telefono) VALUES ($1, $2, $3, '+56900000000') RETURNING id`,
          [u.id, 'ZZ B8 ' + tag, 'zz_b8_c_' + tag + '@test.local']);
        ids.clientes.push(c.id);
        clienteId = c.id;
      }
      return { user: u, clienteId, token: firmar(u) };
    };
    const A = await mkAlumno('a');
    const B = await mkAlumno('b');
    const C = await mkAlumno('c');                       // limitador de contraseña y tope de marcas
    const D = await mkAlumno('d', { hash: await hashPassword(PASS_LEGADO) }); // usuario "antiguo" con clave de 8
    const E = await mkAlumno('e', { cliente: false });   // alumno sin cliente asociado
    const tokAdmin = firmar(admin);

    const f = await q1(`SELECT to_char((NOW() AT TIME ZONE 'America/Santiago')::date, 'YYYY-MM-DD') AS hoy,
                               to_char((NOW() AT TIME ZONE 'America/Santiago')::date - 30, 'YYYY-MM-DD') AS h30,
                               to_char((NOW() AT TIME ZONE 'America/Santiago')::date - 60, 'YYYY-MM-DD') AS h60,
                               to_char((NOW() AT TIME ZONE 'America/Santiago')::date + 1, 'YYYY-MM-DD') AS manana,
                               to_char((NOW() AT TIME ZONE 'America/Santiago')::date - 4000, 'YYYY-MM-DD') AS hace11a,
                               to_char((NOW() AT TIME ZONE 'America/Santiago')::date + 10, 'YYYY-MM-DD') AS mas10,
                               to_char((NOW() AT TIME ZONE 'America/Santiago')::date - 20, 'YYYY-MM-DD') AS h20`);

    // Plan, pagos, transacciones, bloques, reservas y asistencia
    const plan = await q1(`INSERT INTO planes (nombre, descripcion, duracion_dias, precio) VALUES ('zz_b8_plan', 'prueba', 30, 15000) RETURNING id`);
    ids.plan = plan.id;
    const mkPago = async (cli, metodo, origen) => (await q1(
      `INSERT INTO pagos (cliente_id, plan_id, monto, fecha_pago, metodo, periodo_desde, periodo_hasta, estado, origen)
       VALUES ($1, $2, 15000, $3::date, $4, $5::date, $6::date, 'pagado', $7) RETURNING id`,
      [cli, plan.id, f.h20, metodo, f.h20, f.mas10, origen])).id;
    const pagoA = await mkPago(A.clienteId, 'webpay', 'online');
    const pagoA2 = await mkPago(A.clienteId, 'efectivo', 'manual');
    const pagoB = await mkPago(B.clienteId, 'webpay', 'online');
    const mkTx = async (cli, pagoId, tag) => (await q1(
      `INSERT INTO transacciones_pago (cliente_id, plan_id, monto, proveedor, buy_order, token, estado, pago_id)
       VALUES ($1, $2, 15000, 'webpay_integracion', $3, $4, 'autorizada', $5) RETURNING id`,
      [cli, plan.id, 'zz_b8_bo_' + tag, 'zz_b8_tok_' + tag, pagoId])).id;
    const txA = await mkTx(A.clienteId, pagoA, 'a');
    const txB = await mkTx(B.clienteId, pagoB, 'b');
    await query(`INSERT INTO documentos_pago (pago_id, tipo, proveedor, folio, estado, pdf) VALUES ($1, 'comprobante', 'simulado', 'CP-990001', 'emitido', $2)`, [pagoA, Buffer.from('%PDF-zz')]);
    await query(`INSERT INTO documentos_pago (pago_id, tipo, proveedor, folio, estado, pdf) VALUES ($1, 'comprobante', 'simulado', 'CP-990002', 'emitido', $2)`, [pagoB, Buffer.from('%PDF-zz')]);

    const bLunes = await q1(`INSERT INTO bloques (dia, horario, capacidad) VALUES ('Lunes', 'zz_b8_07:00', 5) RETURNING id`);
    const bMartes = await q1(`INSERT INTO bloques (dia, horario, capacidad) VALUES ('Martes', 'zz_b8_08:00', 5) RETURNING id`);
    ids.bloques.push(bLunes.id, bMartes.id);
    const resA = await q1(`INSERT INTO reservas (cliente_id, bloque_id) VALUES ($1, $2) RETURNING id`, [A.clienteId, bLunes.id]);
    const resB = await q1(`INSERT INTO reservas (cliente_id, bloque_id) VALUES ($1, $2) RETURNING id`, [B.clienteId, bMartes.id]);
    await query(`INSERT INTO asistencias (reserva_id, fecha) VALUES ($1, $2::date)`, [resA.id, f.hoy]);

    // ── Acceso: token y rol ──
    let r = await http('GET', '/api/mi-cuenta/perfil');
    ok(r.status === 401, 'mi-cuenta sin token -> 401');
    r = await http('GET', '/api/mi-cuenta/perfil', { token: tokAdmin });
    ok(r.status === 403, 'mi-cuenta como admin -> 403 (solo alumnos)');
    r = await http('GET', '/api/mi-cuenta/perfil', { token: E.token });
    ok(r.status === 404, 'alumno sin cliente asociado -> 404');
    for (const ruta of ['/pagos', '/marcas', '/reservas', '/asistencia', '/foto']) {
      const x = await http('GET', '/api/mi-cuenta' + ruta, { token: tokAdmin });
      ok(x.status === 403, 'GET /mi-cuenta' + ruta + ' como admin -> 403');
    }

    // ── Perfil propio y aislamiento ──
    r = await http('GET', '/api/mi-cuenta/perfil', { token: A.token });
    ok(r.status === 200 && r.data.perfil.email === 'zz_b8_c_a@test.local' && r.data.perfil.nombre === 'ZZ B8 a', 'perfil: devuelve los datos del alumno del token');
    ok(r.data.perfil.membresia.estado === 'vigente' && r.data.perfil.membresia.vence_el === f.mas10 && r.data.perfil.membresia.plan === 'zz_b8_plan', 'perfil: membresia vigente con plan y vencimiento');
    ok(r.data.perfil.miniatura === null && !('password_hash' in r.data.perfil), 'perfil: sin foto -> miniatura null y sin password_hash');
    r = await http('GET', '/api/mi-cuenta/perfil?cliente_id=' + B.clienteId, { token: A.token });
    ok(r.status === 200 && r.data.perfil.email === 'zz_b8_c_a@test.local', 'perfil con ?cliente_id=<B>: se ignora, devuelve el de A');
    r = await http('PATCH', '/api/mi-cuenta/perfil', { token: A.token, json: { nombre: '  ZZ B8 a Editado ', telefono: ' +56911111111 ', cliente_id: B.clienteId, email: 'otro@x.cl' } });
    const filaA = await q1('SELECT c.nombre AS cn, c.telefono AS ct, c.email AS ce, u.nombre AS un, u.telefono AS ut, u.email AS ue FROM clientes c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = $1', [A.clienteId]);
    const filaB = await q1('SELECT nombre FROM clientes WHERE id = $1', [B.clienteId]);
    ok(r.status === 200 && filaA.cn === 'ZZ B8 a Editado' && filaA.un === 'ZZ B8 a Editado' && filaA.ct === '+56911111111' && filaA.ut === '+56911111111', 'editar perfil: nombre y telefono en usuarios y clientes');
    ok(filaA.ce === 'zz_b8_c_a@test.local' && filaA.ue === 'zz_b8_a@test.local', 'editar perfil: el email no cambia');
    ok(filaB.nombre === 'ZZ B8 b', 'editar perfil con cliente_id de B en el body: B no se modifica');
    r = await http('PATCH', '/api/mi-cuenta/perfil', { token: A.token, json: { nombre: '   ' } });
    ok(r.status === 400, 'editar perfil: nombre vacio -> 400');
    r = await http('PATCH', '/api/mi-cuenta/perfil', { token: A.token, json: { nombre: 'X', telefono: '1'.repeat(21) } });
    ok(r.status === 400, 'editar perfil: telefono de mas de 20 caracteres -> 400');

    // ── Marcas ──
    const marca = (who, body) => http('POST', '/api/mi-cuenta/marcas', { token: who.token, json: body });
    r = await marca(A, { ejercicio: 'sentadilla', kg: 10, fecha: f.hoy });
    ok(r.status === 400, 'marca: 10 kg (bajo el minimo) -> 400');
    r = await marca(A, { ejercicio: 'banca', kg: 501, fecha: f.hoy });
    ok(r.status === 400, 'marca: banca 501 kg (sobre el maximo de banca) -> 400');
    r = await marca(A, { ejercicio: 'sentadilla', kg: 601, fecha: f.hoy });
    ok(r.status === 400, 'marca: sentadilla 601 kg -> 400');
    r = await marca(A, { ejercicio: 'sentadilla', kg: 100.3, fecha: f.hoy });
    ok(r.status === 400, 'marca: kg que no es multiplo de 0,5 -> 400');
    r = await marca(A, { ejercicio: 'sentadilla', kg: 'abc', fecha: f.hoy });
    ok(r.status === 400, 'marca: kg no numerico -> 400');
    r = await marca(A, { ejercicio: 'curl', kg: 50, fecha: f.hoy });
    ok(r.status === 400, 'marca: ejercicio desconocido -> 400');
    r = await marca(A, { ejercicio: 'banca', kg: 100, fecha: f.manana });
    ok(r.status === 400, 'marca: fecha futura -> 400');
    r = await marca(A, { ejercicio: 'banca', kg: 100, fecha: f.hace11a });
    ok(r.status === 400, 'marca: fecha de hace mas de 10 años -> 400');
    r = await marca(A, { ejercicio: 'banca', kg: 100, fecha: '2026-02-30' });
    ok(r.status === 400, 'marca: fecha de calendario inexistente -> 400');
    r = await marca(A, { ejercicio: 'banca', kg: 100 });
    ok(r.status === 400, 'marca: sin fecha -> 400');
    const nMarcas = await q1('SELECT COUNT(*)::int AS n FROM marcas WHERE cliente_id = $1', [A.clienteId]);
    ok(nMarcas.n === 0, 'marcas invalidas: no se guardo ninguna');

    r = await marca(A, { ejercicio: 'sentadilla', kg: 140, fecha: f.h60 });
    ok(r.status === 201 && r.data.marca.kg === 140, 'marca valida: sentadilla 140 kg -> 201');
    r = await marca(A, { ejercicio: 'sentadilla', kg: '150.5', fecha: f.h30 });
    ok(r.status === 201 && r.data.marca.kg === 150.5, 'marca valida: kg como texto "150.5" -> 201');
    r = await marca(A, { ejercicio: 'banca', kg: 100, fecha: f.h30 });
    ok(r.status === 201, 'marca valida: banca 100 kg');
    r = await http('GET', '/api/mi-cuenta/marcas', { token: A.token });
    ok(r.status === 200 && r.data.total === null && r.data.faltan.length === 1 && r.data.faltan[0] === 'peso_muerto', 'marcas con 2 ejercicios: total null y falta peso_muerto');
    ok(r.data.mejores.sentadilla.kg === 150.5 && r.data.mejores.banca.kg === 100, 'marcas: la mejor sentadilla es la de mayor kg');
    r = await marca(A, { ejercicio: 'peso_muerto', kg: 180, fecha: f.hoy });
    const idPM = r.data.marca.id;
    r = await http('GET', '/api/mi-cuenta/marcas', { token: A.token });
    ok(r.data.total === 430.5 && r.data.faltan.length === 0, 'marcas con 3 ejercicios: total = 150,5 + 100 + 180 = 430,5');
    const prog = r.data.progreso;
    ok(prog.length === 3 && prog[0].total === null && prog[1].total === null && prog[2].total === 430.5 && prog[2].peso_muerto === 180, 'progreso: acumulado por fecha, total solo cuando existen los tres');
    ok(r.data.historial.length === 4 && r.data.historial[0].id === idPM, 'historial: 4 marcas, la mas reciente primero');

    r = await http('GET', '/api/mi-cuenta/marcas', { token: B.token });
    ok(r.status === 200 && r.data.historial.length === 0 && r.data.total === null, 'B no ve las marcas de A');
    r = await marca(B, { ejercicio: 'banca', kg: 80, fecha: f.hoy });
    const idMarcaB = r.data.marca.id;
    r = await http('DELETE', '/api/mi-cuenta/marcas/' + idMarcaB, { token: A.token });
    const sigue = await q1('SELECT COUNT(*)::int AS n FROM marcas WHERE id = $1', [idMarcaB]);
    ok(r.status === 404 && sigue.n === 1, 'A no puede borrar la marca de B (404 y la marca sigue)');
    r = await http('DELETE', '/api/mi-cuenta/marcas/abc', { token: A.token });
    ok(r.status === 400, 'borrar marca con id invalido -> 400');
    r = await http('GET', '/api/clientes/' + A.clienteId + '/marcas', { token: A.token });
    ok(r.status === 403, 'alumno en /clientes/:id/marcas -> 403');
    r = await http('GET', '/api/clientes/' + A.clienteId + '/marcas', { token: tokAdmin });
    ok(r.status === 200 && r.data.historial.length === 4 && r.data.total === 430.5, 'admin ve las marcas del cliente');
    r = await http('GET', '/api/clientes/99999999/marcas', { token: tokAdmin });
    ok(r.status === 404, 'admin: marcas de cliente inexistente -> 404');
    r = await http('DELETE', '/api/mi-cuenta/marcas/' + idPM, { token: A.token });
    ok(r.status === 200, 'A borra su propia marca');

    // Tope de marcas por cliente
    await query(`INSERT INTO marcas (cliente_id, ejercicio, kg, fecha) SELECT $1, 'banca', 60, $2::date FROM generate_series(1, 500)`, [C.clienteId, f.hoy]);
    r = await marca(C, { ejercicio: 'banca', kg: 61, fecha: f.hoy });
    ok(r.status === 409, 'marca numero 501 -> 409 (tope por cliente)');

    // ── Foto ──
    const put = (who, body) => http('PUT', '/api/mi-cuenta/foto', { token: who.token, json: body });
    r = await http('GET', '/api/mi-cuenta/foto', { token: A.token });
    ok(r.status === 404, 'foto: sin foto -> 404');
    r = await put(A, { foto: REAL64_B64, miniatura: REAL64_B64 });
    ok(r.status === 200 && String(r.data.miniatura).startsWith('data:image/jpeg;base64,'), 'foto: JPEG real valido -> 200 y devuelve la miniatura inline');
    r = await http('GET', '/api/mi-cuenta/foto', { token: A.token });
    ok(r.status === 200 && r.ct === 'image/jpeg' && r.buf.equals(REAL64), 'foto: GET devuelve los mismos bytes como image/jpeg');
    ok(r.headers.get('x-content-type-options') === 'nosniff' && /private/.test(r.headers.get('cache-control') || ''), 'foto: nosniff y cache privada');
    r = await http('GET', '/api/mi-cuenta/foto', { token: B.token });
    ok(r.status === 404, 'B no ve la foto de A (B no tiene foto -> 404)');
    r = await http('GET', '/api/mi-cuenta/foto');
    ok(r.status === 401, 'foto sin token -> 401');
    r = await http('GET', '/api/mi-cuenta/perfil', { token: A.token });
    ok(r.data.perfil.miniatura && r.data.perfil.miniatura.startsWith('data:image/jpeg;base64,'), 'perfil: incluye la miniatura inline');

    const mal = async (nombre, body) => {
      const x = await put(A, body);
      ok(x.status === 400, 'foto rechazada: ' + nombre);
    };
    await mal('texto base64 que no es imagen', { foto: b64(Buffer.from('hola mundo, no soy una imagen')), miniatura: REAL64_B64 });
    await mal('PNG', { foto: b64(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])), miniatura: REAL64_B64 });
    await mal('SVG declarado como imagen', { foto: b64(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')), miniatura: REAL64_B64 });
    await mal('HTML', { foto: b64(Buffer.from('<html><script>alert(1)</script></html>')), miniatura: REAL64_B64 });
    await mal('JPEG con EXIF', { foto: b64(mkJpeg(64, 64, { exif: true })), miniatura: REAL64_B64 });
    await mal('JPEG con comentario incrustado', { foto: b64(mkJpeg(64, 64, { com: true })), miniatura: REAL64_B64 });
    await mal('JPEG truncado (sin EOI)', { foto: b64(mkJpeg(64, 64, { sinEoi: true })), miniatura: REAL64_B64 });
    await mal('no cuadrada (64x32)', { foto: b64(mkJpeg(64, 32)), miniatura: REAL64_B64 });
    await mal('mas de 256 px por lado', { foto: b64(mkJpeg(300, 300)), miniatura: REAL64_B64 });
    await mal('menos de 64 px por lado', { foto: b64(mkJpeg(32, 32)), miniatura: REAL64_B64 });
    await mal('miniatura de mas de 96 px', { foto: REAL64_B64, miniatura: b64(mkJpeg(128, 128)) });
    await mal('foto de mas de 48 KB', { foto: b64(mkJpeg(64, 64, { pad: 60000 })), miniatura: REAL64_B64 });
    await mal('miniatura de mas de 6 KB', { foto: REAL64_B64, miniatura: b64(mkJpeg(64, 64, { pad: 8000 })) });
    await mal('base64 invalido', { foto: 'no es base64!!', miniatura: REAL64_B64 });
    await mal('con prefijo data:', { foto: 'data:image/jpeg;base64,' + REAL64_B64, miniatura: REAL64_B64 });
    await mal('sin miniatura', { foto: REAL64_B64 });
    await mal('sin foto', { miniatura: REAL64_B64 });
    await mal('tipos incorrectos', { foto: 123, miniatura: ['x'] });
    const fotoAun = await q1('SELECT octet_length(foto) AS n FROM clientes_foto WHERE cliente_id = $1', [A.clienteId]);
    ok(fotoAun && fotoAun.n === REAL64.length, 'tras los rechazos, la foto guardada no cambio');

    // Avatares (admin)
    r = await put(B, { foto: REAL64_B64, miniatura: REAL64_B64 });
    ok(r.status === 200, 'B sube su propia foto');
    r = await http('GET', '/api/avatares?ids=' + A.clienteId + ',' + B.clienteId + ',' + C.clienteId + ',99999999', { token: tokAdmin });
    ok(r.status === 200 && Object.keys(r.data.avatares).sort().join() === [A.clienteId, B.clienteId].sort().join()
      && r.data.avatares[A.clienteId].startsWith('data:image/jpeg;base64,'), 'avatares: mapa solo con los clientes que tienen foto');
    r = await http('GET', '/api/avatares?ids=' + A.clienteId, { token: A.token });
    ok(r.status === 403, 'avatares como alumno -> 403');
    r = await http('GET', '/api/avatares?ids=' + A.clienteId);
    ok(r.status === 401, 'avatares sin token -> 401');
    r = await http('GET', '/api/avatares', { token: tokAdmin });
    ok(r.status === 400, 'avatares sin ids -> 400');
    r = await http('GET', '/api/avatares?ids=1,abc', { token: tokAdmin });
    ok(r.status === 400, 'avatares con ids no numericos -> 400');
    r = await http('GET', '/api/avatares?ids=' + Array.from({ length: 301 }, (_, i) => i + 1).join(','), { token: tokAdmin });
    ok(r.status === 400, 'avatares con mas de 300 ids -> 400');
    r = await http('GET', '/api/avatares?ids=' + Array.from({ length: 300 }, (_, i) => i + 1).join(','), { token: tokAdmin });
    ok(r.status === 200, 'avatares con 300 ids -> 200');

    r = await http('DELETE', '/api/mi-cuenta/foto', { token: A.token });
    ok(r.status === 200, 'quitar foto -> 200');
    r = await http('GET', '/api/mi-cuenta/foto', { token: A.token });
    const fotoB = await q1('SELECT COUNT(*)::int AS n FROM clientes_foto WHERE cliente_id = $1', [B.clienteId]);
    ok(r.status === 404 && fotoB.n === 1, 'tras quitar la foto de A, la de B sigue');

    // ── Contraseña: registro ──
    const reg = (email, password) => http('POST', '/api/auth/register', { json: { nombre: 'ZZ B8 Reg', email, password } });
    r = await reg('zz_b8_reg1@test.local', 'Corta1A');
    ok(r.status === 400, 'registro: 7 caracteres -> 400');
    r = await reg('zz_b8_reg1@test.local', 'Abcdefgh1');
    ok(r.status === 400, 'registro: 9 caracteres -> 400');
    r = await reg('zz_b8_reg1@test.local', 'sinmayuscula123');
    ok(r.status === 400, 'registro: sin mayuscula -> 400');
    r = await reg('zz_b8_reg1@test.local', 'SINMINUSCULA123');
    ok(r.status === 400, 'registro: sin minuscula -> 400');
    r = await reg('zz_b8_reg1@test.local', 'SinNumeroAbcdef');
    ok(r.status === 400, 'registro: sin numero -> 400');
    r = await reg('zz_b8_reg1@test.local', 'Aa1' + 'x'.repeat(70));
    ok(r.status === 400, 'registro: mas de 72 caracteres -> 400');
    const huboReg = await q1(`SELECT COUNT(*)::int AS n FROM usuarios WHERE email = 'zz_b8_reg1@test.local'`);
    ok(huboReg.n === 0, 'registros rechazados: no se creo el usuario');
    r = await reg('zz_b8_reg1@test.local', 'Registro-Fuerte1');
    ok(r.status === 201, 'registro: contraseña fuerte -> 201');
    r = await login('zz_b8_reg1@test.local', 'Registro-Fuerte1');
    ok(r.status === 200 && r.data.token, 'login del usuario recien registrado');

    // Usuario antiguo con clave de 8 caracteres sigue entrando
    r = await login(D.user.email, PASS_LEGADO);
    ok(r.status === 200, 'usuario existente con clave de 8 caracteres sigue pudiendo iniciar sesion');

    // ── Contraseña: cambio ──
    const cambiar = (who, actual, nueva) => http('POST', '/api/mi-cuenta/password', { token: who.token, json: { actual, nueva } });
    r = await cambiar(A, 'incorrecta-xx', PASS_A_NUEVA);
    ok(r.status === 400, 'cambiar contraseña: actual incorrecta -> 400 (no 401, para no cerrar la sesion)');
    r = await cambiar(A, PASS_A, 'corta');
    ok(r.status === 400, 'cambiar contraseña: nueva debil -> 400');
    r = await cambiar(A, PASS_A, 'sinmayuscula123');
    ok(r.status === 400, 'cambiar contraseña: nueva sin mayuscula -> 400');
    r = await cambiar(A, PASS_A, PASS_A);
    ok(r.status === 400, 'cambiar contraseña: igual a la actual -> 400');
    r = await http('POST', '/api/mi-cuenta/password', { token: A.token, json: { nueva: PASS_A_NUEVA } });
    ok(r.status === 400, 'cambiar contraseña: sin la actual -> 400');
    r = await login(A.user.email, PASS_A);
    ok(r.status === 200, 'tras los intentos fallidos, la contraseña de A no cambio');
    r = await http('POST', '/api/mi-cuenta/password', { token: tokAdmin, json: { actual: 'x', nueva: PASS_A_NUEVA } });
    ok(r.status === 403, 'cambiar contraseña como admin -> 403');
    r = await cambiar(A, PASS_A, PASS_A_NUEVA);
    ok(r.status === 200, 'cambiar contraseña: correcta -> 200');
    r = await login(A.user.email, PASS_A);
    ok(r.status === 401, 'la contraseña anterior ya no sirve');
    r = await login(A.user.email, PASS_A_NUEVA);
    ok(r.status === 200, 'la contraseña nueva funciona');
    r = await login(B.user.email, PASS_A);
    ok(r.status === 200, 'la contraseña de B no cambio');

    // Limitador de intentos fallidos (usuario C)
    for (let i = 0; i < 5; i++) {
      r = await cambiar(C, 'incorrecta-' + i, PASS_A_NUEVA);
    }
    ok(r.status === 400, 'limitador: los 5 primeros fallos responden 400');
    r = await cambiar(C, PASS_A, PASS_A_NUEVA);
    ok(r.status === 429, 'limitador: tras 5 fallos, incluso la clave correcta -> 429');
    const hashC = await q1('SELECT password_hash FROM usuarios WHERE id = $1', [C.user.id]);
    r = await login(C.user.email, PASS_A);
    ok(hashC.password_hash && r.status === 200, 'limitador: la contraseña de C no se cambio mientras estuvo bloqueado');

    // ── Pagos propios ──
    r = await http('GET', '/api/mi-cuenta/pagos', { token: A.token });
    const pa = r.data.pagos || [];
    ok(r.status === 200 && pa.length === 2 && pa.every((p) => p.id === pagoA || p.id === pagoA2), 'pagos: A ve solo sus 2 pagos');
    const pOnline = pa.find((p) => p.id === pagoA);
    ok(pOnline && pOnline.transaccion_id === txA && pOnline.documento_disponible === true && pOnline.plan_nombre === 'zz_b8_plan' && pOnline.periodo_hasta === f.mas10, 'pagos: el pago online trae transaccion_id y comprobante disponible');
    const pManual = pa.find((p) => p.id === pagoA2);
    ok(pManual && pManual.transaccion_id === null && pManual.documento_disponible === false, 'pagos: el pago manual no tiene transaccion ni comprobante');
    ok(!pa.some((p) => p.id === pagoB) && !JSON.stringify(r.data).includes('zz_b8_tok_'), 'pagos: no aparece el pago de B ni tokens');
    r = await http('GET', '/api/mi-cuenta/pagos', { token: B.token });
    ok(r.status === 200 && r.data.pagos.length === 1 && r.data.pagos[0].id === pagoB, 'pagos: B ve solo el suyo');
    r = await http('GET', '/api/pagos-online/' + txB, { token: A.token });
    ok(r.status === 403, 'A no puede ver la transaccion de B (/pagos-online/:id) -> 403');
    r = await http('GET', '/api/pagos-online/' + txB + '/documento', { token: A.token });
    ok(r.status === 403, 'A no puede descargar el comprobante de B -> 403');
    r = await http('GET', '/api/pagos-online/' + txA + '/documento', { token: A.token });
    ok(r.status === 200 && r.ct.includes('application/pdf'), 'A descarga su propio comprobante (reuso del endpoint existente)');

    // ── Reservas y asistencia propias ──
    r = await http('GET', '/api/mi-cuenta/reservas', { token: A.token });
    const rs = r.data.reservas || [];
    ok(r.status === 200 && rs.length === 1 && rs[0].reserva_id === resA.id && rs[0].dia === 'Lunes', 'reservas: A ve solo la suya (bloque del lunes)');
    const pf = rs[0] && rs[0].proxima_fecha;
    const diaSemana = pf ? (new Date(pf + 'T00:00:00Z').getUTCDay() + 6) % 7 : -1;
    ok(pf >= f.hoy && diaSemana === 0 && pf <= f.mas10, 'reservas: proxima_fecha es un lunes dentro de los proximos 7 dias');
    r = await http('GET', '/api/mi-cuenta/reservas', { token: B.token });
    ok(r.status === 200 && r.data.reservas.length === 1 && r.data.reservas[0].reserva_id === resB.id && r.data.reservas[0].dia === 'Martes', 'reservas: B ve solo la suya');
    ok(proximaFecha('Lunes', '2026-10-26') === '2026-10-26' && proximaFecha('Martes', '2026-10-26') === '2026-10-27'
      && proximaFecha('Domingo', '2026-10-26') === '2026-11-01' && proximaFecha('Domingo', '2026-10-31') === '2026-11-01', 'proximaFecha: calculo del dia de la semana');
    r = await http('GET', '/api/mi-cuenta/asistencia', { token: A.token });
    ok(r.status === 200 && r.data.total === 1 && r.data.mes === 1 && r.data.asistencias.length === 1 && r.data.asistencias[0].fecha === f.hoy, 'asistencia: A ve su asistencia y los conteos');
    r = await http('GET', '/api/mi-cuenta/asistencia', { token: B.token });
    ok(r.status === 200 && r.data.total === 0 && r.data.asistencias.length === 0, 'asistencia: B no ve la de A');
    // Cancelar con el endpoint existente: A no puede cancelar la reserva de B
    r = await http('DELETE', '/api/reservas/' + resB.id, { token: A.token });
    ok(r.status === 403, 'A no puede cancelar la reserva de B (endpoint existente) -> 403');
  } finally {
    try {
      await query(`DELETE FROM clientes WHERE email LIKE 'zz_b8_%'`);
      if (ids.clientes.length) await query('DELETE FROM clientes WHERE id = ANY($1::int[])', [ids.clientes]);
      if (ids.plan) await query('DELETE FROM planes WHERE id = $1', [ids.plan]);
      if (ids.bloques.length) await query('DELETE FROM bloques WHERE id = ANY($1::int[])', [ids.bloques]);
      await query(`DELETE FROM bloques WHERE horario LIKE 'zz_b8_%'`);
      await query(`DELETE FROM usuarios WHERE email LIKE 'zz_b8_%'`);
      if (ids.usuarios.length) await query('DELETE FROM usuarios WHERE id = ANY($1::int[])', [ids.usuarios]);
      await query(`DELETE FROM notificaciones_log WHERE destinatario LIKE 'zz_b8_%'`);
      const resto = await q1(`SELECT (SELECT COUNT(*) FROM usuarios WHERE email LIKE 'zz_b8_%')::int AS u,
                                     (SELECT COUNT(*) FROM clientes WHERE email LIKE 'zz_b8_%')::int AS c,
                                     (SELECT COUNT(*) FROM planes WHERE nombre LIKE 'zz_b8_%')::int AS p,
                                     (SELECT COUNT(*) FROM bloques WHERE horario LIKE 'zz_b8_%')::int AS b`);
      ok(resto.u === 0 && resto.c === 0 && resto.p === 0 && resto.b === 0, 'limpieza: no quedan filas zz_b8_*');
    } catch (e) {
      console.error('Aviso: no se pudo limpiar todo (' + e.message + '). Buscar filas "zz_b8_*".');
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
