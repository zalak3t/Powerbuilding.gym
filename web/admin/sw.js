// Service worker PWA admin: cachea SOLO el shell estático.
// Nunca cachea respuestas de la API (datos personales, Ley 19.628): las peticiones
// cross-origin y cualquier método distinto de GET no se interceptan.
var CACHE = 'pb-admin-shell-v2'; // subir al cambiar el shell: el activate borra los pb-admin-shell-* anteriores
var SHELL = [
  '/admin/',
  '/admin/index.html',
  '/admin/app.js',
  '/admin/app.css',
  '/admin/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/apple-touch-icon-180.png',
  '/assets/icons/favicon-32.png'
];

self.addEventListener('install', function (event) {
  // Cada recurso por separado: si falta un ícono aún, el resto igual se cachea
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('pb-admin-shell-') === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API (otro origen): sin interceptar
  if (SHELL.indexOf(url.pathname) === -1) return;  // solo el shell conocido

  // Red primero (para recibir actualizaciones); caché solo si no hay conexión.
  // cache:'no-cache' obliga a revalidar con el servidor y no usar una copia vieja del caché HTTP del navegador.
  event.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true });
    })
  );
});
