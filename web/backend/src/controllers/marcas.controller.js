// Endpoints de solo admin que exponen datos del Bloque 8 (marcas declaradas y miniaturas).
const { getClienteById } = require('../services/clientes.service');
const { marcasDeCliente } = require('../services/marcas.service');
const { miniaturasDe } = require('../services/fotos.service');
const v = require('../utils/validate');

const MAX_IDS = 300;

// GET /api/clientes/:id/marcas
async function marcasDeClienteAdmin(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const cliente = await getClienteById(id);
  if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });
  return res.json({ ok: true, ...(await marcasDeCliente(id)) });
}

// GET /api/avatares?ids=1,2,3  ->  { ok, avatares: { "<cliente_id>": "data:image/jpeg;base64,..." } }
async function avatares(req, res) {
  const raw = req.query.ids;
  if (typeof raw !== 'string' || !raw.trim()) {
    return res.status(400).json({ ok: false, error: 'ids es obligatorio (lista separada por comas)' });
  }
  const partes = raw.split(',');
  if (partes.length > MAX_IDS) {
    return res.status(400).json({ ok: false, error: 'Máximo ' + MAX_IDS + ' ids por consulta' });
  }
  const ids = [];
  for (const p of partes) {
    const n = v.parsePositiveInt(p.trim());
    if (!n || n > 2147483647) return res.status(400).json({ ok: false, error: 'ids inválidos' });
    ids.push(n);
  }
  return res.json({ ok: true, avatares: await miniaturasDe([...new Set(ids)]) });
}

module.exports = { marcasDeClienteAdmin, avatares };
