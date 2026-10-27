// ══ PAGOS ══
var adminPagosCache=[];
var pagoPlanesCache=[];
var pagoClientesCache=[];
var pagoClientesLoaded=false;

// Convención: periodo_hasta (inclusivo) = periodo_desde + (duracion_dias - 1). Igual que el backend.
function calcPeriodoHasta(desde,dias){return sumarDiasISO(desde,dias-1);}

function pagoFiltersQuery(){
  var parts=[];
  var c=document.getElementById('pfCliente').value;
  var d=document.getElementById('pfDesde').value;
  var h=document.getElementById('pfHasta').value;
  if(c)parts.push('cliente_id='+encodeURIComponent(c));
  if(d)parts.push('desde='+encodeURIComponent(d));
  if(h)parts.push('hasta='+encodeURIComponent(h));
  return parts.length?'?'+parts.join('&'):'';
}

// Carga clientes y planes para los selects (filtro y formulario)
async function loadPagoOptions(){
  try {
    var res=await Promise.all([apiRequest('/clientes'),apiRequest('/planes')]);
    pagoClientesCache=res[0].clientes||[];
    pagoPlanesCache=res[1].planes||[];
    pagoClientesLoaded=true;
    var fsel=document.getElementById('pfCliente');
    var keep=fsel.value;
    fsel.innerHTML='<option value="">Todos los clientes</option>'+pagoClientesCache.map(function(c){
      return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>';
    }).join('');
    fsel.value=keep;
  } catch(e) {
    adminToast(e.message||'Error al cargar clientes y planes','err');
  }
}

async function renderPagos(){
  var tbody=document.getElementById('pagoTable');
  tbody.innerHTML='<tr><td colspan="9" style="color:var(--amuted);padding:1rem">Cargando pagos...</td></tr>';
  try {
    if(!pagoClientesLoaded)await loadPagoOptions();
    var data=await apiRequest('/pagos'+pagoFiltersQuery());
    adminPagosCache=data.pagos||[];
    paintPagos();
    renderTransaccionesOnline();
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="9" style="color:var(--red);padding:1rem">Error al cargar pagos.</td></tr>';
    adminToast(e.message||'Error al cargar pagos','err');
  }
}

function paintPagos(){
  var validos=adminPagosCache.filter(function(p){return p.estado==='pagado';});
  var suma=validos.reduce(function(a,p){return a+p.monto;},0);
  document.getElementById('pagoCount').textContent=adminPagosCache.length+' pago'+(adminPagosCache.length!==1?'s':'')+' · '+formatCLP(suma)+' (sin anulados)';
  var tbody=document.getElementById('pagoTable');
  if(!adminPagosCache.length){
    tbody.innerHTML='<tr><td colspan="9" style="color:var(--amuted);padding:1rem">No hay pagos con ese criterio.</td></tr>';
    return;
  }
  tbody.innerHTML=adminPagosCache.map(function(p){
    var anulado=p.estado==='anulado';
    return '<tr'+(anulado?' style="opacity:.55"':'')+'>'
      +'<td>'+esc(formatFechaCL(p.fecha_pago))+'</td>'
      +'<td style="color:var(--atext);font-weight:500"><div style="display:flex;align-items:center;gap:8px">'+avatarHtml(p.cliente_id,p.cliente_nombre,28,10)+'<span>'+esc(p.cliente_nombre)+'</span></div></td>'
      +'<td>'+esc(p.plan_nombre)+'</td>'
      +'<td style="color:var(--atext);font-weight:600">'+esc(formatCLP(p.monto))+'</td>'
      +'<td>'+esc(p.metodo==='webpay'?'Webpay':p.metodo)+'</td>'
      +'<td><span class="abadge '+(p.origen==='online'?'blue':'muted')+'">'+esc(p.origen==='online'?'online':'manual')+'</span></td>'
      +'<td style="white-space:nowrap">'+esc(formatFechaCL(p.periodo_desde))+' → '+esc(formatFechaCL(p.periodo_hasta))+'</td>'
      +'<td><span class="abadge '+(anulado?'muted':'green')+'">'+esc(p.estado)+'</span></td>'
      +'<td><div class="abtn-row">'
      +(p.transaccion_id?'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="descargarComprobante('+p.transaccion_id+')">Comprobante</button>':'')
      +(anulado?(p.transaccion_id?'':'—'):'<button class="abtn danger" style="font-size:11px;padding:5px 10px" onclick="anularPagoUI('+p.id+')">Anular</button>')
      +'</div></td></tr>';
  }).join('');
  hidratarAvatares(tbody);
}

function applyPagoFilters(){renderPagos();}

function clearPagoFilters(){
  document.getElementById('pfCliente').value='';
  document.getElementById('pfDesde').value='';
  document.getElementById('pfHasta').value='';
  renderPagos();
}

async function openAddPago(){
  try {
    await loadPagoOptions(); // clientes y planes al día
  } catch(e) {}
  document.getElementById('pgCliente').innerHTML='<option value="">Selecciona un cliente</option>'+pagoClientesCache.map(function(c){
    return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>';
  }).join('');
  var activos=pagoPlanesCache.filter(function(p){return p.activo;});
  document.getElementById('pgPlan').innerHTML='<option value="">Selecciona un plan</option>'+activos.map(function(p){
    return '<option value="'+p.id+'">'+esc(p.nombre)+' — '+esc(formatCLP(p.precio))+'</option>';
  }).join('');
  var hoy=hoyChileISO();
  document.getElementById('pgMonto').value='';
  document.getElementById('pgMetodo').value='efectivo';
  document.getElementById('pgFecha').value=hoy;
  document.getElementById('pgDesde').value=hoy;
  document.getElementById('pgNotas').value='';
  document.getElementById('pgVigencia').textContent='';
  openAModal('modalPago');
}

// Al elegir plan: autocompleta monto y vigencia. Con soloVigencia=true (cambio de fechas) no toca el monto.
function onPagoPlanChange(soloVigencia){
  var id=parseInt(document.getElementById('pgPlan').value,10);
  var plan=pagoPlanesCache.find(function(p){return p.id===id;});
  var vig=document.getElementById('pgVigencia');
  if(!plan){vig.textContent='';if(soloVigencia!==true)document.getElementById('pgMonto').value='';return;}
  if(soloVigencia!==true)document.getElementById('pgMonto').value=plan.precio;
  var desde=document.getElementById('pgDesde').value;
  if(!desde){vig.textContent='Duración: '+plan.duracion_dias+' días';return;}
  vig.textContent='Vigencia: '+formatFechaCL(desde)+' → '+formatFechaCL(calcPeriodoHasta(desde,plan.duracion_dias))+' ('+plan.duracion_dias+' días)';
}

async function savePago(){
  var cliente=document.getElementById('pgCliente').value;
  var plan=document.getElementById('pgPlan').value;
  var monto=document.getElementById('pgMonto').value.trim();
  if(!cliente){adminToast('Selecciona un cliente','err');return;}
  if(!plan){adminToast('Selecciona un plan','err');return;}
  if(monto!==''&&!/^\d+$/.test(monto)){adminToast('El monto debe ser un número entero en pesos (0 o más)','err');return;}
  var body={
    cliente_id:parseInt(cliente,10),
    plan_id:parseInt(plan,10),
    metodo:document.getElementById('pgMetodo').value,
    fecha_pago:document.getElementById('pgFecha').value||undefined,
    periodo_desde:document.getElementById('pgDesde').value||undefined,
    notas:document.getElementById('pgNotas').value.trim()
  };
  if(monto!=='')body.monto=parseInt(monto,10);
  try {
    await apiRequest('/pagos',{method:'POST',body:JSON.stringify(body)});
    adminToast('Pago registrado','ok');
    closeAModal('modalPago');
    renderPagos();
  } catch(e) {
    adminToast(e.message||'Error al registrar pago','err');
  }
}

async function anularPagoUI(id){
  var p=adminPagosCache.find(function(x){return x.id===id;});
  if(!p)return;
  if(!confirm('¿Anular el pago de '+p.cliente_nombre+' por '+formatCLP(p.monto)+'? Dejará de contar para la membresía y no se puede deshacer.'))return;
  var nota=prompt('Motivo de la anulación (opcional):','');
  if(nota===null)return;
  try {
    await apiRequest('/pagos/'+id+'/anular',{method:'PATCH',body:JSON.stringify({nota:nota.trim()})});
    adminToast('Pago anulado','info');
    renderPagos();
  } catch(e) {
    adminToast(e.message||'Error al anular pago','err');
  }
}

// ── Transacciones online (Webpay) ──
var TX_ESTADO_CLASE={autorizada:'green',iniciada:'blue',rechazada:'red',anulada:'muted',expirada:'muted'};

async function renderTransaccionesOnline(){
  var tbody=document.getElementById('txTable');
  if(!tbody)return;
  try {
    var data=await apiRequest('/pagos-online?limit=100');
    var rows=data.transacciones||[];
    if(!rows.length){
      tbody.innerHTML='<tr><td colspan="7" style="color:var(--amuted);padding:1rem">Aún no hay transacciones online.</td></tr>';
      return;
    }
    tbody.innerHTML=rows.map(function(t){
      var docTxt='—';
      if(t.documento_estado){
        docTxt='<span class="abadge '+(t.documento_estado==='emitido'?'green':'red')+'">'+esc(t.documento_estado)+'</span>'
          +(t.documento_folio?' '+esc(t.documento_folio):'')
          +(t.documento_detalle&&t.documento_estado==='error'?'<div style="font-size:11px;color:var(--amuted)">'+esc(t.documento_detalle)+'</div>':'');
      }
      var acc='';
      if(t.documento_disponible)acc+='<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="descargarComprobante('+t.id+')">Descargar</button>';
      if(t.estado==='autorizada'&&t.documento_estado!=='emitido')acc+='<button class="abtn primary" style="font-size:11px;padding:5px 10px" onclick="reintentarDocumentoUI('+t.id+')">Reintentar</button>';
      return '<tr><td>'+esc(fechaNotif(t.creado_en))+'</td>'
        +'<td style="color:var(--atext);font-weight:500"><div style="display:flex;align-items:center;gap:8px">'+avatarHtml(t.cliente_id,t.cliente_nombre,28,10)+'<span>'+esc(t.cliente_nombre)+'</span></div></td>'
        +'<td>'+esc(t.plan_nombre)+'</td>'
        +'<td style="color:var(--atext);font-weight:600">'+esc(formatCLP(t.monto))+'</td>'
        +'<td><span class="abadge '+(TX_ESTADO_CLASE[t.estado]||'muted')+'">'+esc(t.estado)+'</span></td>'
        +'<td>'+docTxt+'</td>'
        +'<td><div class="abtn-row">'+(acc||'—')+'</div></td></tr>';
    }).join('');
    hidratarAvatares(tbody);
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="7" style="color:var(--red);padding:1rem">Error al cargar las transacciones.</td></tr>';
  }
}

async function reintentarDocumentoUI(id){
  try {
    var data=await apiRequest('/pagos-online/'+id+'/reintentar-documento',{method:'POST'});
    adminToast(data.message||'Listo',data.ok?'ok':'err');
  } catch(e) {
    adminToast(e.message||'No se pudo reintentar','err');
  }
  renderTransaccionesOnline();
}
