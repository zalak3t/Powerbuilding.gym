// En modo local (PB_LOCAL=1, via `npm run dev:local`) las variables vienen solo de .env.dev;
// nunca se carga .env para no mezclar valores de produccion.
if (!process.env.PB_LOCAL) require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pingRouter    = require('./routes/ping.routes');
const dbTestRouter  = require('./routes/dbTest.routes');
const authRouter    = require('./routes/auth.routes');
const bloquesRouter     = require('./routes/bloques.routes');
const reservasRouter    = require('./routes/reservas.routes');
const clientesRouter    = require('./routes/clientes.routes');
const asistenciasRouter = require('./routes/asistencias.routes');
const statsRouter       = require('./routes/stats.routes');

const app = express();

// ── Middlewares globales ──────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('No permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'Powerbuilding API', version: '1.0.0' });
});

app.use('/api/ping',     pingRouter);
app.use('/api/db-test',  dbTestRouter);
app.use('/api/auth',     authRouter);
app.use('/api/bloques',      bloquesRouter);
app.use('/api/reservas',     reservasRouter);
app.use('/api/clientes',     clientesRouter);
app.use('/api/asistencias',  asistenciasRouter);
app.use('/api/stats',        statsRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// ── Manejo de errores ─────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Error interno del servidor' });
});

module.exports = app;
