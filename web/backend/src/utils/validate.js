// Validaciones reutilizables sin librerías. Cada función devuelve true/false o el valor parseado.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function isString(v) {
  return typeof v === 'string';
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function maxLen(v, n) {
  return typeof v === 'string' && v.length <= n;
}

function minLen(v, n) {
  return typeof v === 'string' && v.length >= n;
}

function isEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

function isOneOf(v, list) {
  return list.includes(v);
}

// Entero positivo (>0) desde número o string de solo dígitos; null si no es válido.
function parsePositiveInt(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v > 0 ? v : null;
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    const n = parseInt(v, 10);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  return null;
}

// Campo de texto opcional: undefined/null/'' son válidos; si viene, debe ser string con largo máximo.
function isOptionalString(v, max) {
  if (v === undefined || v === null) return true;
  return typeof v === 'string' && v.length <= max;
}

module.exports = {
  DIAS,
  isString,
  isNonEmptyString,
  maxLen,
  minLen,
  isEmail,
  isOneOf,
  parsePositiveInt,
  isOptionalString,
};
