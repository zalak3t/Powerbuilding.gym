const { getDashboardStats, getNegocioStats } = require('../services/stats.service');

async function getDashboard(req, res) {
  const dashboard = await getDashboardStats();
  return res.json({ ok: true, dashboard });
}

async function getNegocio(req, res) {
  const negocio = await getNegocioStats();
  return res.json({ ok: true, negocio });
}

module.exports = { getDashboard, getNegocio };
