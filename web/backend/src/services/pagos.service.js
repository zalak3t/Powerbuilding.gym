const { query } = require('../config/db');
const { withTransaction } = require('../utils/tx');

// Las fechas (DATE) salen como texto 'YYYY-MM-DD' para evitar desfases de zona horaria al serializar.
const PAGO_SELECT = `
  SELECT pg.id, pg.cliente_id, c.nombre AS cliente_nombre,
         pg.plan_id, pl.nombre AS plan_nombre, pl.duracion_dias AS plan_duracion_dias,
         pg.monto,
         to_char(pg.fecha_pago, 'YYYY-MM-DD')    AS fecha_pago,
         pg.metodo,
         to_char(pg.periodo_desde, 'YYYY-MM-DD') AS periodo_desde,
         to_char(pg.periodo_hasta, 'YYYY-MM-DD') AS periodo_hasta,
         pg.estado, pg.notas, pg.creado_en, pg.actualizado_en
  FROM pagos pg
  JOIN clientes c ON c.id = pg.cliente_id
  JOIN planes pl  ON pl.id = pg.plan_id`;

async function getPagoById(id, client) {
  const run = client ? client.query.bind(client) : query;
  const result = await run(PAGO_SELECT + ' WHERE pg.id = $1', [id]);
  return result.rows[0] || null;
}

// Filtros opcionales: clienteId, desde, hasta (sobre fecha_pago, inclusivos).
async function getPagos({ clienteId, desde, hasta }) {
  const where = [];
  const params = [];
  if (clienteId) { params.push(clienteId); where.push('pg.cliente_id = $' + params.length); }
  if (desde)     { params.push(desde);     where.push('pg.fecha_pago >= $' + params.length + '::date'); }
  if (hasta)     { params.push(hasta);     where.push('pg.fecha_pago <= $' + params.length + '::date'); }
  const sql = PAGO_SELECT +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY pg.fecha_pago DESC, pg.id DESC';
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Crea un pago. periodo_hasta (inclusivo) = periodo_desde + (duracion_dias - 1).
 * monto null => precio del plan. Devuelve { pago } o { error: 'CLIENTE_NOT_FOUND' | 'PLAN_NOT_FOUND' | 'PLAN_INACTIVE' }.
 */
async function createPago({ clienteId, planId, monto, metodo, fechaPago, periodoDesde, notas }) {
  return withTransaction(async (client) => {
    const cli = await client.query('SELECT id FROM clientes WHERE id = $1', [clienteId]);
    if (!cli.rows[0]) return { error: 'CLIENTE_NOT_FOUND' };

    const plan = await client.query('SELECT id, precio, activo FROM planes WHERE id = $1 FOR SHARE', [planId]);
    if (!plan.rows[0]) return { error: 'PLAN_NOT_FOUND' };
    if (!plan.rows[0].activo) return { error: 'PLAN_INACTIVE' };

    const ins = await client.query(
      `INSERT INTO pagos (cliente_id, plan_id, monto, fecha_pago, metodo, periodo_desde, periodo_hasta, notas)
       SELECT $1, pl.id, COALESCE($3::int, pl.precio), $4::date, $5, $6::date,
              $6::date + (pl.duracion_dias - 1), $7
       FROM planes pl WHERE pl.id = $2
       RETURNING id`,
      [clienteId, planId, monto, fechaPago, metodo, periodoDesde, notas]
    );
    return { pago: await getPagoById(ins.rows[0].id, client) };
  });
}

/**
 * Anula un pago (no se borra). La nota, si viene, se agrega a las notas existentes.
 * Devuelve { pago } o { error: 'NOT_FOUND' | 'YA_ANULADO' }.
 */
async function anularPago(id, nota) {
  return withTransaction(async (client) => {
    const cur = await client.query('SELECT id, estado FROM pagos WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows[0]) return { error: 'NOT_FOUND' };
    if (cur.rows[0].estado === 'anulado') return { error: 'YA_ANULADO' };
    await client.query(
      `UPDATE pagos
       SET estado = 'anulado',
           notas = CASE WHEN $2::text IS NULL THEN notas
                        ELSE COALESCE(notas || E'\\n', '') || 'Anulado: ' || $2::text END,
           actualizado_en = NOW()
       WHERE id = $1`,
      [id, nota]
    );
    return { pago: await getPagoById(id, client) };
  });
}

// Historial de pagos de un cliente (usado por la ficha).
async function getPagosByCliente(clienteId) {
  return getPagos({ clienteId });
}

module.exports = { getPagos, getPagoById, createPago, anularPago, getPagosByCliente };
