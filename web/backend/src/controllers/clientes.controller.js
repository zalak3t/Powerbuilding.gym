const {
  getClientes, getClienteById, getClienteFicha,
  createCliente, updateCliente, updateClienteEstado, deleteCliente,
} = require('../services/clientes.service');

const VALID_ESTADO = ['activo', 'bloqueado', 'suspendido'];
function isValidEstado(e) { return VALID_ESTADO.includes(e); }

// GET /api/clientes?search=...
async function listarClientes(req, res) {
  const { search } = req.query;
  const clientes = await getClientes({ search: search || null });
  return res.json({ ok: true, clientes });
}

// GET /api/clientes/:id
async function fichaCliente(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const cliente = await getClienteFicha(id);
  if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  return res.json({ ok: true, cliente });
}

// POST /api/clientes
async function crearCliente(req, res) {
  const { nombre, email, telefono, notas, estado } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ ok: false, error: 'nombre y email son obligatorios' });
  }
  const emailLower = email.toLowerCase().trim();
  const est = estado || 'activo';
  if (!isValidEstado(est)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser activo, bloqueado o suspendido' });
  }

  try {
    const cliente = await createCliente({ nombre: nombre.trim(), email: emailLower, telefono, notas, estado: est });
    return res.status(201).json({ ok: true, message: 'Cliente creado correctamente', cliente });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    }
    throw err;
  }
}

// PUT /api/clientes/:id
async function editarCliente(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const { nombre, email, telefono, notas, estado } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ ok: false, error: 'nombre y email son obligatorios' });
  }
  const emailLower = email.toLowerCase().trim();
  const est = estado || 'activo';
  if (!isValidEstado(est)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser activo, bloqueado o suspendido' });
  }

  const existing = await getClienteById(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  try {
    const cliente = await updateCliente(id, { nombre: nombre.trim(), email: emailLower, telefono, notas, estado: est });
    return res.json({ ok: true, message: 'Cliente actualizado correctamente', cliente });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'El email ya está en uso por otro cliente' });
    }
    throw err;
  }
}

// PATCH /api/clientes/:id/estado
async function cambiarEstado(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const { estado } = req.body;
  if (!estado || !isValidEstado(estado)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser activo, bloqueado o suspendido' });
  }

  const existing = await getClienteById(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  const cliente = await updateClienteEstado(id, estado);
  return res.json({ ok: true, message: 'Estado del cliente actualizado', cliente });
}

// DELETE /api/clientes/:id
async function eliminarCliente(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const deleted = await deleteCliente(id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  return res.json({ ok: true, message: 'Cliente eliminado correctamente' });
}

module.exports = { listarClientes, fichaCliente, crearCliente, editarCliente, cambiarEstado, eliminarCliente };
