// Regla de fortaleza de contraseña (registro y cambio de contraseña).
// Solo se aplica al CREAR o CAMBIAR una contraseña: el login no la valida, así que los
// usuarios existentes con claves anteriores (8 caracteres) siguen entrando.

const MIN_LARGO = 10;
const MAX_BYTES = 72; // límite real de bcrypt

// Devuelve null si es válida o el mensaje de error.
function validarFortaleza(password) {
  if (typeof password !== 'string' || !password) return 'La contraseña es obligatoria';
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) return 'La contraseña no puede superar 72 caracteres';
  if (password.length < MIN_LARGO) return 'La contraseña debe tener al menos 10 caracteres';
  if (!/\p{Ll}/u.test(password)) return 'La contraseña debe incluir una letra minúscula';
  if (!/\p{Lu}/u.test(password)) return 'La contraseña debe incluir una letra mayúscula';
  if (!/\d/.test(password)) return 'La contraseña debe incluir un número';
  return null;
}

module.exports = { validarFortaleza, MIN_LARGO, MAX_BYTES };
