// PWA admin móvil — Powerbuilding.gym (ES5 simple, sin dependencias)
// Standalone: no reutiliza api.js/auth.js porque están acoplados al DOM de la landing.

// ══ API ══
var PB_HOST = location.hostname;
var API_BASE_URL = (PB_HOST === 'localhost' || PB_HOST === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://powerbuildinggym-production.up.railway.app/api';

function getToken() { try { return localStorage.getItem('pb_token'); } catch (e) { return null; } }
function setToken(t) { try { localStorage.setItem('pb_token', t); } catch (e) {} }
function clearToken() { try { localStorage.removeItem('pb_token'); } catch (e) {} }

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function $(id) { return document.getElementById(id); }

// Error con status para distinguir 401/409 sin parsear mensajes
function ApiError(message, status, data) {
  var e = new Error(message);
  e.status = status;
  e.data = data;
  return e;
}

function apiRequest(path, options) {
  var opts = options || {};
  var headers = { 'Content-Type': 'application/json' };
  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(API_BASE_URL + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (data) {
      // El login también responde 401 (credenciales malas): no es sesión expirada
      if (res.status === 401 && path !== '/auth/login') {
        showLogin('Sesión expirada. Ingresa nuevamente.');
        throw ApiError('Sesión expirada', 401, data);
      }
      if (!res.ok) throw ApiError(data.error || 'Error del servidor', res.status, data);
      return data;
    });
  }, function () {
    throw ApiError('No se pudo conectar con el servidor', 0, null);
  });
}

// ══ VISTAS ══
function showLogin(msg) {
  clearToken();
  $('viewHoy').hidden = true;
  $('viewLogin').hidden = false;
  $('lPass').value = '';
  setLoginError(msg || '');
}

function showHoy() {
  $('viewLogin').hidden = true;
  $('viewHoy').hidden = false;
}

function setLoginError(msg) {
  var el = $('lErr');
  el.textContent = msg || '';
  el.hidden = !msg;
}

// ══ LOGIN ══
function doLogin(ev) {
  ev.preventDefault();
  var email = $('lEmail').value.trim().toLowerCase();
  var pass = $('lPass').value;
  if (!email || !pass) { setLoginError('Ingresa email y contraseña'); return; }
  var btn = $('lBtn');
  btn.disabled = true;
  setLoginError('');
  apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email: email, password: pass }) })
    .then(function (data) {
      if (!data.user || data.user.rol !== 'admin') {
        clearToken();
        setLoginError('Esta app es solo para administradores. Tu cuenta no tiene ese permiso.');
        return;
      }
      setToken(data.token);
      enterApp();
    })
    .catch(function (e) { setLoginError(e.message || 'Email o contraseña incorrectos'); })
    .then(function () { btn.disabled = false; });
}

function doLogout() {
  showLogin('');
}

// Restaura sesión con /auth/me; solo entra si el usuario es admin
function restoreSession() {
  if (!getToken()) { showLogin(''); return; }
  apiRequest('/auth/me')
    .then(function (data) {
      if (data.user && data.user.rol === 'admin') enterApp();
      else showLogin('Esta app es solo para administradores.');
    })
    .catch(function (e) {
      // 401 ya llevó al login; otros errores (red): mostrar login con aviso
      if (e.status !== 401) showLogin(e.message);
    });
}

function enterApp() {
  showHoy();
}

// ══ INIT ══
$('loginForm').addEventListener('submit', doLogin);
$('btnLogout').addEventListener('click', doLogout);
restoreSession();
