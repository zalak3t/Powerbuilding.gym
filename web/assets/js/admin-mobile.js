// ══ ADMIN MÓVIL ══
// Solo afecta a pantallas de hasta 768 px (el CSS oculta todo esto en escritorio):
// 1) barra inferior con las secciones principales y un panel «Más»;
// 2) etiquetas en las celdas de las tablas, para verlas como tarjetas;
// 3) tocar una tarjeta de cliente abre su ficha.
(function () {
  var PRINCIPALES = ['dashboard', 'clientes', 'bloques', 'pagos'];
  var mas, panel, fondo;

  function esMovil() {
    return window.matchMedia('(max-width:768px)').matches;
  }

  function crearItem(origen) {
    var esEnlace = origen.tagName === 'A';
    var id = (origen.id || '').replace('nav-', '');
    var el = document.createElement(esEnlace ? 'a' : 'button');
    if (esEnlace) {
      el.href = origen.getAttribute('href');
    } else {
      el.type = 'button';
      el.setAttribute('data-page', id);
    }
    el.className = 'mn-item';
    var icono = origen.querySelector('svg');
    var rotulo = origen.querySelector('.nav-label');
    if (icono) el.appendChild(icono.cloneNode(true));
    var span = document.createElement('span');
    span.textContent = rotulo ? rotulo.textContent : '';
    el.appendChild(span);
    return { el: el, id: id, principal: !esEnlace && PRINCIPALES.indexOf(id) > -1 };
  }

  function abrirMas(abierto) {
    panel.classList.toggle('on', abierto);
    fondo.classList.toggle('on', abierto);
    mas.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  }

  function marcarActivo(pagina) {
    var items = document.querySelectorAll('#mnav .mn-item[data-page], #msheet .mn-item[data-page]');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-page') === pagina);
    }
    mas.classList.toggle('active', PRINCIPALES.indexOf(pagina) === -1);
  }

  function crearNavegacion() {
    var app = document.getElementById('adminApp');
    var barra = document.getElementById('sidebar');
    if (!app || !barra || document.getElementById('mnav')) return;

    var nav = document.createElement('div');
    nav.id = 'mnav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Navegación del panel');
    var rejilla = document.createElement('div');
    rejilla.className = 'mgrid';

    var origenes = barra.querySelectorAll('.nav-item');
    for (var i = 0; i < origenes.length; i++) {
      var it = crearItem(origenes[i]);
      (it.principal ? nav : rejilla).appendChild(it.el);
    }

    mas = document.createElement('button');
    mas.type = 'button';
    mas.id = 'mn-more';
    mas.className = 'mn-item';
    mas.setAttribute('aria-expanded', 'false');
    mas.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><span>Más</span>';
    nav.appendChild(mas);

    panel = document.createElement('div');
    panel.id = 'msheet';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Más secciones');
    panel.appendChild(rejilla);

    fondo = document.createElement('div');
    fondo.id = 'mback';

    app.appendChild(fondo);
    app.appendChild(panel);
    app.appendChild(nav);

    app.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.mn-item') : null;
      if (!b) return;
      if (b === mas) { abrirMas(!panel.classList.contains('on')); return; }
      var pagina = b.getAttribute('data-page');
      if (pagina) window.goTo(pagina);
    });
    fondo.addEventListener('click', function () { abrirMas(false); });

    var irA = window.goTo;
    window.goTo = function (pagina) {
      irA.apply(this, arguments);
      marcarActivo(pagina);
      abrirMas(false);
    };
    marcarActivo('dashboard');
  }

  function esFechaONumero(texto) {
    return /^\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|[\d.,$]+\s*$)/.test(texto);
  }

  function etiquetarTablas() {
    var tablas = document.querySelectorAll('.atbl');
    for (var t = 0; t < tablas.length; t++) {
      var cabeceras = tablas[t].querySelectorAll('thead th');
      var filas = tablas[t].querySelectorAll('tbody tr');
      for (var f = 0; f < filas.length; f++) {
        var celdas = filas[f].children;
        if (celdas.length > 1 && !celdas[0].hasAttribute('data-label')) {
          // Título de la tarjeta: la primera celda, salvo que sea una fecha o un número
          var titulo = 0;
          if (esFechaONumero(celdas[0].textContent) && celdas[1]) titulo = 1;
          celdas[titulo].classList.add('mt');
        }
        for (var c = 0; c < celdas.length; c++) {
          var td = celdas[c];
          if (td.colSpan > 1) { td.classList.add('wide'); continue; }
          if (c > 0 && td.textContent.indexOf('@') > -1) td.classList.add('wide');
          if (!td.children.length && td.textContent.trim() === '') td.classList.add('vacia');
          if (!td.hasAttribute('data-label') && cabeceras[c]) {
            td.setAttribute('data-label', cabeceras[c].textContent.trim());
          }
        }
      }
    }
  }

  function vigilarTablas() {
    var zona = document.querySelector('.acontent');
    if (!zona || !window.MutationObserver) return;
    var pendiente = false;
    new MutationObserver(function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; etiquetarTablas(); });
    }).observe(zona, { childList: true, subtree: true });
    etiquetarTablas();
  }

  function tocarTarjeta() {
    document.addEventListener('click', function (e) {
      if (!esMovil()) return;
      var fila = e.target.closest ? e.target.closest('.atbl tbody tr') : null;
      if (!fila) return;
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      var ficha = fila.querySelector('button[onclick*="openFicha"]');
      if (ficha) ficha.click();
    });
  }

  function iniciar() {
    crearNavegacion();
    vigilarTablas();
    tocarTarjeta();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
