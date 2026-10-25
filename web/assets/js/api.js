// ══ API ══
var API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('pb_token');
}
function setToken(token) {
  localStorage.setItem('pb_token', token);
}
function clearToken() {
  localStorage.removeItem('pb_token');
}
function authHeaders() {
  var token = getToken();
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}
async function apiRequest(path, options) {
  var opts = options || {};
  var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders(), opts.headers || {});
  var res = await fetch(API_BASE_URL + path, Object.assign({}, opts, { headers: headers }));
  var data = await res.json();
  // Token vencido/inválido: cerrar sesión. El login también responde 401 (credenciales malas): se excluye.
  if (res.status === 401 && path !== '/auth/login') {
    handleSessionExpired();
    throw new Error('Sesión expirada');
  }
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}
