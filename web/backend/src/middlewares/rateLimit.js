// Límites de intentos por IP para las rutas más sensibles a fuerza bruta y abuso.
// Se aplican solo donde corresponde (login, registro, inicio de pago); no son globales.
const rateLimit = require('express-rate-limit');

function crearLimitador({ windowMs, limit, mensaje, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ ok: false, error: mensaje });
    },
  });
}

// Login: 10 intentos fallidos cada 15 minutos por IP (los inicios de sesión correctos no cuentan).
const loginLimiter = crearLimitador({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  mensaje: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.',
});

// Registro: 5 cuentas por hora por IP.
const registerLimiter = crearLimitador({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  mensaje: 'Demasiados registros desde esta conexión. Intenta nuevamente más tarde.',
});

// Confirmación de correo: 20 intentos por hora por IP (los tokens son largos y firmados).
const verificarCorreoLimiter = crearLimitador({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  mensaje: 'Demasiados intentos de confirmación. Intenta nuevamente más tarde.',
});

// Inicio de pago en línea: 20 por 15 minutos por IP (evita crear transacciones en masa).
const pagoIniciarLimiter = crearLimitador({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  mensaje: 'Demasiadas solicitudes de pago. Intenta nuevamente en unos minutos.',
});

// Recuperación de contraseña: 5 solicitudes por hora por IP (además hay un tope de 3 por cuenta).
const recuperarLimiter = crearLimitador({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  mensaje: 'Demasiadas solicitudes de recuperación. Intenta nuevamente más tarde.',
});

// Restablecer con token: 10 intentos por hora por IP (los tokens son de 256 bits).
const restablecerLimiter = crearLimitador({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  mensaje: 'Demasiados intentos. Intenta nuevamente más tarde.',
});

module.exports = { loginLimiter, registerLimiter, verificarCorreoLimiter, pagoIniciarLimiter, recuperarLimiter, restablecerLimiter };
