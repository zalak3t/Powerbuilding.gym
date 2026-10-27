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
  loadHoy();
}

// ══ HOY ══
var DAYS_ES = { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves',
                Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' };
var TZ = 'America/Santiago';
var busy = false; // true mientras hay una petición de marcar/desmarcar o carga

// Día de la semana actual en Santiago, con el formato que espera la API (Lunes…Domingo)
function diaHoy() {
  var en = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(new Date());
  return DAYS_ES[en];
}

function fechaLarga() {
  return new Intl.DateTimeFormat('es-CL', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

function isOffline() { return navigator.onLine === false; }

function setBusy(v) {
  busy = v;
  $('btnRefresh').disabled = v;
  applyButtonsState();
}

// Deshabilita marcar/desmarcar si hay petición en curso o no hay conexión
function applyButtonsState() {
  var btns = document.querySelectorAll('#hoyContent .btn[data-reserva]');
  for (var i = 0; i < btns.length; i++) btns[i].disabled = busy || isOffline();
}

function renderBloque(b) {
  var reservas = b.reservas || [];
  var asist = reservas.filter(function (r) { return r.asistio; }).length;
  var suspendido = b.estado === 'suspendido';
  var filas = reservas.length
    ? reservas.map(function (r) {
        return '<div class="row"><div class="name">' + esc(r.nombre)
          + (r.telefono ? '<span class="tel">' + esc(r.telefono) + '</span>' : '') + '</div>'
          + '<button type="button" class="btn ' + (r.asistio ? 'done' : 'pending') + '"'
          + ' data-reserva="' + esc(r.reserva_id) + '" data-asistencia="' + esc(r.asistencia_id || '') + '">'
          + (r.asistio ? '✓ Asistió' : 'Marcar') + '</button></div>';
      }).join('')
    : '<div class="empty-row">Sin reservas en este bloque.</div>';
  return '<section class="card"><div class="card-head"><div class="h">' + esc(b.horario)
    + (suspendido ? '<span class="tag">Suspendido</span>' : '') + '</div>'
    + '<span class="counter">' + asist + '/' + reservas.length + ' asistentes</span></div>' + filas + '</section>';
}

function loadHoy() {
  var dia = diaHoy();
  $('hoyDia').textContent = dia + ', ' + fechaLarga();
  var el = $('hoyContent');
  el.innerHTML = '<div class="state">Cargando…</div>';
  setBusy(true);
  return apiRequest('/asistencias?dia=' + encodeURIComponent(dia))
    .then(function (data) {
      var bloques = data.bloques || [];
      el.innerHTML = bloques.length
        ? bloques.map(renderBloque).join('')
        : '<div class="empty">No hay bloques programados para hoy.</div>';
    })
    .catch(function (e) {
      if (e.status === 401) return; // ya se mostró el login
      el.innerHTML = '<div class="state error">' + esc(e.message || 'Error al cargar') + '</div>';
    })
    .then(function () { setBusy(false); });
}

function toggleAsistencia(btn) {
  if (busy || isOffline()) return;
  var reservaId = btn.getAttribute('data-reserva');
  var asistenciaId = btn.getAttribute('data-asistencia');
  var req = asistenciaId
    ? apiRequest('/asistencias/' + encodeURIComponent(asistenciaId), { method: 'DELETE' })
    : apiRequest('/asistencias', { method: 'POST', body: JSON.stringify({ reserva_id: Number(reservaId) }) });
  setBusy(true);
  req.then(function () { return null; }, function (e) {
    if (e.status === 401) return 'stop';
    // 409/404: el estado cambió en otro dispositivo; se refresca igual
    if (e.status !== 409 && e.status !== 404) window.alert(e.message || 'Error al actualizar asistencia');
    return null;
  }).then(function (stop) {
    setBusy(false);
    if (stop !== 'stop') loadHoy();
  });
}

// ══ INSTALAR APP (R.21) ══
var deferredPrompt = null;

function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Pinta el bloque de instalación en login y en Hoy; vacío si ya está instalada
function renderInstall() {
  var html = '';
  if (!isStandalone()) {
    if (deferredPrompt) {
      html = '<div class="install"><strong>Instala la app</strong> en tu pantalla de inicio.'
        + '<button type="button" class="btn" data-install="1">Instalar app</button></div>';
    } else if (isIOS()) {
      html = '<div class="install"><strong>Instalar en iPhone/iPad:</strong> toca <em>Compartir</em> y luego '
        + '<em>Añadir a pantalla de inicio</em>. (Compartir &gt; Añadir a pantalla de inicio)</div>';
    }
  }
  $('installBoxLogin').innerHTML = html;
  $('installBoxHoy').innerHTML = html;
}

function onInstallClick(ev) {
  var t = ev.target;
  if (!t.getAttribute || !t.getAttribute('data-install') || !deferredPrompt) return;
  var p = deferredPrompt;
  deferredPrompt = null;
  p.prompt();
  if (p.userChoice && p.userChoice.then) p.userChoice.then(renderInstall, renderInstall);
  else renderInstall();
}

window.addEventListener('beforeinstallprompt', function (ev) {
  ev.preventDefault();
  deferredPrompt = ev;
  renderInstall();
});
window.addEventListener('appinstalled', function () { deferredPrompt = null; renderInstall(); });
$('installBoxLogin').addEventListener('click', onInstallClick);
$('installBoxHoy').addEventListener('click', onInstallClick);
renderInstall();

// ══ SIN CONEXIÓN + SERVICE WORKER ══
function updateOnline() {
  $('offlineBar').hidden = !isOffline();
  applyButtonsState();
}
window.addEventListener('online', function () { updateOnline(); if (!$('viewHoy').hidden) loadHoy(); });
window.addEventListener('offline', updateOnline);
updateOnline();

// Solo en https o localhost
if ('serviceWorker' in navigator
    && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', function () {
    // updateViaCache:'none' + update(): siempre se revisa si hay un service worker nuevo
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/', updateViaCache: 'none' })
      .then(function (reg) { reg.update().catch(function () {}); })
      .catch(function () {});
  });
  // Si ya había un service worker y se instala uno nuevo, recarga una sola vez para no seguir con el JS viejo
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      try { if (sessionStorage.getItem('pb_sw_recarga')) return; sessionStorage.setItem('pb_sw_recarga', '1'); } catch (e) { return; }
      location.reload();
    });
  }
}

// ══ INIT ══
$('loginForm').addEventListener('submit', doLogin);
$('btnLogout').addEventListener('click', doLogout);
$('btnRefresh').addEventListener('click', loadHoy);
$('hoyContent').addEventListener('click', function (ev) {
  var t = ev.target;
  while (t && t !== this && !(t.getAttribute && t.getAttribute('data-reserva'))) t = t.parentNode;
  if (t && t !== this) toggleAsistencia(t);
});
restoreSession();
