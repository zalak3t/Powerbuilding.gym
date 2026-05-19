function ping(req, res) {
  res.json({ ok: true, message: 'Powerbuilding API funcionando' });
}

module.exports = { ping };
