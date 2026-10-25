// ══ HELPERS REUTILIZABLES ══

// Días de la semana (orden de las pestañas y del selector de bloques)
var DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// Escapa texto para insertarlo en innerHTML o en atributos HTML (& < > " ')
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Retorna las 2 primeras iniciales de un nombre completo en mayúsculas
function getInitials(name) {
  return String(name || '').split(' ').map(function(n){return n[0];}).join('').substring(0,2).toUpperCase();
}

// Retorna el color de fondo del avatar según el ID del cliente
function getAvatarColor(id) {
  var avColors=['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444'];
  return avColors[id % avColors.length];
}

// Retorna la clase CSS de badge según el estado del cliente (activo/suspendido/bloqueado)
// Soporta formato API (estado) y formato local (status)
function getClientStatusClass(client) {
  var est=client.estado||client.status;
  return est==='activo'?'green':est==='suspendido'?'amber':'red';
}

// Retorna el porcentaje de ocupación de un bloque (0-100)
// Soporta formato API (inscritos/capacidad) y formato local (reservations/capacity)
function getBlockOccupancyPercent(block) {
  var taken=block.inscritos!==undefined?block.inscritos:block.reservations.length;
  var cap=block.capacidad!==undefined?block.capacidad:block.capacity;
  return cap>0?Math.round(taken/cap*100):0;
}

// Retorna true si el bloque no tiene cupos disponibles
function isBlockFull(block) {
  var taken=block.inscritos!==undefined?block.inscritos:block.reservations.length;
  var cap=block.capacidad!==undefined?block.capacidad:block.capacity;
  return taken>=cap;
}

// Retorna true si el bloque está suspendido
function isBlockSuspended(block) {
  return (block.estado||block.status)==='suspendido';
}

// Renderiza los botones de tabs de días en el contenedor indicado
function renderDayTabs(containerId,activeDay,cssClass,onClickFn) {
  document.getElementById(containerId).innerHTML=DAYS.map(function(d){
    return '<button class="'+cssClass+(d===activeDay?' active':'')+'" onclick="'+onClickFn+'(\''+d+'\')">'+d+'</button>';
  }).join('');
}
