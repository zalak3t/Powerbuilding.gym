// ══ NOTIFICACIONES ══
var NOTIF_TIPOS={confirmacion_reserva:'Confirmación de reserva',recordatorio_bloque:'Recordatorio de bloque',vencimiento_membresia:'Vencimiento de membresía',pago_confirmado:'Pago confirmado'};
var NOTIF_ESTADO_CLASE={enviado:'green',simulado:'blue',error:'red'};

function fechaNotif(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return '';
  return d.toLocaleString('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

async function renderNotificacionesEstado(){
  var box=document.getElementById('notifEstado');
  try {
    var e=await apiRequest('/notificaciones/estado');
    var prov=e.proveedor==='brevo'
      ?'<span class="abadge green">Brevo (envío real)</span>'
      :'<span class="abadge blue">Simulado (no envía correos)</span>';
    var jobs=e.jobs?'<span class="abadge green">activos</span>':'<span class="abadge muted">desactivados</span>';
    box.innerHTML='Proveedor: '+prov+' &nbsp; Revisión automática (cada 10 min): '+jobs;
  } catch(err) {
    box.textContent='No se pudo leer el estado del proveedor.';
  }
}

async function renderNotificaciones(){
  var tbody=document.getElementById('notifTable');
  tbody.innerHTML='<tr><td colspan="6" style="color:var(--amuted);padding:1rem">Cargando registro...</td></tr>';
  renderNotificacionesEstado();
  var qs=['limit=100'];
  var tipo=document.getElementById('notifFiltroTipo').value;
  var estado=document.getElementById('notifFiltroEstado').value;
  if(tipo)qs.push('tipo='+encodeURIComponent(tipo));
  if(estado)qs.push('estado='+encodeURIComponent(estado));
  try {
    var data=await apiRequest('/notificaciones?'+qs.join('&'));
    var rows=data.notificaciones||[];
    if(!rows.length){
      tbody.innerHTML='<tr><td colspan="6" style="color:var(--amuted);padding:1rem">No hay notificaciones registradas.</td></tr>';
      return;
    }
    tbody.innerHTML=rows.map(function(n){
      return '<tr><td>'+esc(fechaNotif(n.creado_en))+'</td>'
        +'<td>'+esc(NOTIF_TIPOS[n.tipo]||n.tipo)+'</td>'
        +'<td>'+esc(n.destinatario)+'</td>'
        +'<td>'+esc(n.asunto)+'</td>'
        +'<td><span class="abadge '+(NOTIF_ESTADO_CLASE[n.estado]||'muted')+'">'+esc(n.estado)+'</span></td>'
        +'<td style="color:var(--amuted)">'+esc(n.detalle||'')+'</td></tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="6" style="color:var(--red);padding:1rem">Error al cargar el registro.</td></tr>';
    adminToast(e.message||'Error al cargar notificaciones','err');
  }
}

async function ejecutarNotificaciones(){
  var btn=document.getElementById('notifEjecutarBtn');
  btn.disabled=true;
  try {
    var r=await apiRequest('/notificaciones/ejecutar',{method:'POST',body:JSON.stringify({})});
    adminToast('Revisión lista: '+r.recordatorios+' recordatorio(s) y '+r.vencimientos+' aviso(s) de vencimiento generados','ok');
    renderNotificaciones();
  } catch(e) {
    adminToast(e.message||'Error al ejecutar la revisión','err');
  } finally {
    btn.disabled=false;
  }
}
