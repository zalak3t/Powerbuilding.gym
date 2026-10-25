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

// Entero >= 0 (y dentro del rango INTEGER de PostgreSQL) desde número o string de dígitos; null si no es válido.
function parseNonNegativeInt(v) {
  const MAX = 2147483647;
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= MAX ? v : null;
  if (typeof v === 'string' && /^\d{1,10}$/.test(v.trim())) {
    const n = parseInt(v.trim(), 10);
    return n <= MAX ? n : null;
  }
  return null;
}

// Fecha calendario 'YYYY-MM-DD' real (rechaza 2026-02-30). Devuelve el string o null.
function parseFechaISO(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

module.exports = {
  parseNonNegativeInt,
  parseFechaISO,
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
