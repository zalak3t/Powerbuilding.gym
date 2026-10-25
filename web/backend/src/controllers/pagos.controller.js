const { getPagos, createPago, anularPago } = require('../services/pagos.service');
const { hoyChile } = require('../utils/fechas');
const v = require('../utils/validate');

const METODOS = ['efectivo', 'transferencia', 'otro'];

const ERRORES_CREAR = {
  CLIENTE_NOT_FOUND: [404, 'Cliente no encontrado'],
  PLAN_NOT_FOUND: [404, 'Plan no encontrado'],
  PLAN_INACTIVE: [409, 'El plan está inactivo; elige un plan activo'],
};

// Valida los filtros de GET. Devuelve { error } o { clienteId, desde, hasta }.
function validarFiltros(q) {
  const out = {};
  if (q.cliente_id !== undefined && q.cliente_id !== '') {
    out.clienteId = v.parsePositiveInt(q.cliente_id);
    if (!out.clienteId) return { error: 'cliente_id inválido' };
  }
  if (q.desde !== undefined && q.desde !== '') {
    out.desde = v.parseFechaISO(q.desde);
    if (!out.desde) return { error: 'desde debe tener formato AAAA-MM-DD' };
  }
  if (q.hasta !== undefined && q.hasta !== '') {
    out.hasta = v.parseFechaISO(q.hasta);
    if (!out.hasta) return { error: 'hasta debe tener formato AAAA-MM-DD' };
  }
  if (out.desde && out.hasta && out.desde > out.hasta) return { error: 'desde no puede ser posterior a hasta' };
  return out;
}

// Valida el cuerpo de POST. Devuelve { error } o los campos normalizados (con valores por defecto).
function validarPagoBody(body) {
  const b = body || {};
  const clienteId = v.parsePositiveInt(b.cliente_id);
  if (!clienteId) return { error: 'cliente_id es obligatorio y debe ser válido' };
  const planId = v.parsePositiveInt(b.plan_id);
  if (!planId) return { error: 'plan_id es obligatorio y debe ser válido' };
  if (!v.isOneOf(b.metodo, METODOS)) return { error: 'El método debe ser: ' + METODOS.join(', ') };

  let monto = null; // null => precio del plan
  if (b.monto !== undefined && b.monto !== null && b.monto !== '') {
    monto = v.parseNonNegativeInt(b.monto);
    if (monto === null) return { error: 'El monto debe ser un número entero en pesos, mayor o igual a 0' };
  }

  const hoy = hoyChile();
  let fechaPago = hoy;
  if (b.fecha_pago !== undefined && b.fecha_pago !== null && b.fecha_pago !== '') {
    fechaPago = v.parseFechaISO(b.fecha_pago);
    if (!fechaPago) return { error: 'fecha_pago debe tener formato AAAA-MM-DD' };
  }
  let periodoDesde = hoy;
  if (b.periodo_desde !== undefined && b.periodo_desde !== null && b.periodo_desde !== '') {
    periodoDesde = v.parseFechaISO(b.periodo_desde);
    if (!periodoDesde) return { error: 'periodo_desde debe tener formato AAAA-MM-DD' };
  }
  if (!v.isOptionalString(b.notas, 500)) return { error: 'Las notas no pueden superar 500 caracteres' };

  return {
    clienteId, planId, monto, metodo: b.metodo, fechaPago, periodoDesde,
    notas: b.notas && b.notas.trim() ? b.notas.trim() : null,
  };
}

// GET /api/pagos?cliente_id=&desde=&hasta=
async function listarPagos(req, res) {
  const f = validarFiltros(req.query || {});
  if (f.error) return res.status(400).json({ ok: false, error: f.error });
  const pagos = await getPagos(f);
  return res.json({ ok: true, pagos });
}

// POST /api/pagos
async function registrarPago(req, res) {
  const val = validarPagoBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  const r = await createPago(val);
  if (r.error) {
    const [status, error] = ERRORES_CREAR[r.error];
    return res.status(status).json({ ok: false, error });
  }
  return res.status(201).json({ ok: true, message: 'Pago registrado correctamente', pago: r.pago });
}

// PATCH /api/pagos/:id/anular   body: { nota?: string }
async function anular(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const nota = (req.body || {}).nota;
  if (!v.isOptionalString(nota, 300)) return res.status(400).json({ ok: false, error: 'La nota no puede superar 300 caracteres' });
  const r = await anularPago(id, nota && nota.trim() ? nota.trim() : null);
  if (r.error === 'NOT_FOUND') return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
  if (r.error === 'YA_ANULADO') return res.status(409).json({ ok: false, error: 'El pago ya está anulado' });
  return res.json({ ok: true, message: 'Pago anulado correctamente', pago: r.pago });
}

module.exports = { listarPagos, registrarPago, anular };
