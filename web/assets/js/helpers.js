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

// ── Bloque 2b: planes, pagos y membresía ──
// Formatea pesos chilenos enteros: 35000 -> $35.000
function formatCLP(n){
  var num=parseInt(n,10);
  if(isNaN(num))return '—';
  return '$'+String(num).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}

// Fecha 'AAAA-MM-DD' -> 'DD-MM-AAAA' (sin pasar por Date, evita desfases de zona horaria)
function formatFechaCL(iso){
  if(!iso||typeof iso!=='string'||iso.length<10)return '—';
  return iso.substr(8,2)+'-'+iso.substr(5,2)+'-'+iso.substr(0,4);
}

// Hoy en Chile como 'AAAA-MM-DD'
function hoyChileISO(){
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }catch(e){
    var d=new Date();
    return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  }
}

// Suma n días a una fecha 'AAAA-MM-DD' (UTC, sin desfases)
function sumarDiasISO(iso,n){
  var p=iso.split('-');
  var d=new Date(Date.UTC(parseInt(p[0],10),parseInt(p[1],10)-1,parseInt(p[2],10)));
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}

// Badge de membresía a partir de estado_membresia / vence_el de la API
function membresiaBadge(c){
  var map={vigente:['green','vigente'],por_vencer:['amber','por vencer'],vencida:['red','vencida'],sin_plan:['muted','sin plan']};
  var m=map[c.estado_membresia]||map.sin_plan;
  return '<span class="abadge '+m[0]+'">'+m[1]+'</span>';
}
