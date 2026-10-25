const {
  getClientes, getClienteById, getClienteFicha,
  createCliente, updateCliente, updateClienteEstado, deleteCliente,
} = require('../services/clientes.service');
const v = require('../utils/validate');

const VALID_ESTADO = ['activo', 'bloqueado', 'suspendido'];
function isValidEstado(e) { return typeof e === 'string' && VALID_ESTADO.includes(e); }

// Valida el cuerpo de crear/editar cliente. Devuelve { error } o los campos normalizados.
function validarClienteBody(body) {
  const { nombre, email, telefono, notas, estado } = body || {};
  if (!v.isNonEmptyString(nombre) || !v.isNonEmptyString(email)) {
    return { error: 'nombre y email son obligatorios' };
  }
  if (!v.maxLen(nombre.trim(), 100)) return { error: 'El nombre no puede superar 100 caracteres' };
  if (!v.isEmail(email) || !v.maxLen(email.trim(), 150)) return { error: 'Email inválido (máximo 150 caracteres)' };
  if (!v.isOptionalString(telefono, 20)) return { error: 'El teléfono no puede superar 20 caracteres' };
  if (!v.isOptionalString(notas, 1000)) return { error: 'Las notas no pueden superar 1000 caracteres' };
  const est = estado || 'activo';
  if (!isValidEstado(est)) return { error: 'estado debe ser activo, bloqueado o suspendido' };
  return { nombre: nombre.trim(), email: email.toLowerCase().trim(), telefono, notas, estado: est };
}

// GET /api/clientes?search=...
async function listarClientes(req, res) {
  const { search } = req.query;
  if (search !== undefined && !(typeof search === 'string' && search.length <= 100)) {
    return res.status(400).json({ ok: false, error: 'Búsqueda inválida (máximo 100 caracteres)' });
  }
  const clientes = await getClientes({ search: search || null });
  return res.json({ ok: true, clientes });
}

// GET /api/clientes/:id
async function fichaCliente(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const cliente = await getClienteFicha(id);
  if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  return res.json({ ok: true, cliente });
}

// POST /api/clientes
async function crearCliente(req, res) {
  const val = validarClienteBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });

  try {
    const cliente = await createCliente(val);
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
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const val = validarClienteBody(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });

  const existing = await getClienteById(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  try {
    const cliente = await updateCliente(id, val);
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
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const { estado } = req.body || {};
  if (!isValidEstado(estado)) {
    return res.status(400).json({ ok: false, error: 'estado debe ser activo, bloqueado o suspendido' });
  }

  const existing = await getClienteById(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  const cliente = await updateClienteEstado(id, estado);
  return res.json({ ok: true, message: 'Estado del cliente actualizado', cliente });
}

// DELETE /api/clientes/:id
async function eliminarCliente(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const deleted = await deleteCliente(id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Cliente no encontrado' });

  return res.json({ ok: true, message: 'Cliente eliminado correctamente' });
}

module.exports = { listarClientes, fichaCliente, crearCliente, editarCliente, cambiarEstado, eliminarCliente };
