// ══ MI CUENTA (alumno) ══
// Todas las llamadas usan /mi-cuenta/*: el servidor identifica al alumno por su token, nunca por un id.
var mc={perfil:null,marcas:null,pagos:[],pagosTodos:false,chart:null,pagoHabilitado:false,pagando:false};
var MC_EJERCICIOS=[
  {id:'sentadilla',nombre:'Sentadilla',min:20,max:600,color:'#3b82f6'},
  {id:'banca',nombre:'Banca',min:20,max:500,color:'#10b981'},
  {id:'peso_muerto',nombre:'Peso muerto',min:20,max:600,color:'#f59e0b'}
];
var MC_METODOS={efectivo:'Efectivo',transferencia:'Transferencia',webpay:'Webpay',otro:'Otro'};

function mcEl(id){return document.getElementById(id);}
function mcKg(n){return String(n).replace('.',',')+' kg';}
function mcEjercicio(id){return MC_EJERCICIOS.filter(function(e){return e.id===id;})[0];}
function mcMostrarError(id,msg){var e=mcEl(id);e.textContent=msg;e.classList.add('show');}
function mcLimpiarError(id){mcEl(id).classList.remove('show');}

// api.js llama a esta función ante un 401: la sesión terminó, vuelve al inicio.
function handleSessionExpired(){clearToken();location.replace('index.html');}

function mcSalir(){clearToken();location.replace('index.html');}

// Avatar redondo: foto (miniatura) si existe, si no iniciales.
function mcAvatarHtml(nombre,miniatura,px){
  var fs=Math.round(px*0.4);
  return '<span class="mc-av" style="width:'+px+'px;height:'+px+'px;font-size:'+fs+'px">'
    +(miniatura?'<img src="'+esc(miniatura)+'" alt=""/>':esc(getInitials(nombre)))+'</span>';
}

function mcDiasHasta(iso){
  var a=iso.split('-'),h=hoyChileISO().split('-');
  return Math.round((Date.UTC(+a[0],a[1]-1,+a[2])-Date.UTC(+h[0],h[1]-1,+h[2]))/86400000);
}

function mcPlural(n,s,p){return n+' '+(n===1?s:p);}

// ── Inicio ──
async function mcInit(){
  if(!getToken()){location.replace('index.html');return;}
  try{
    var me=await apiRequest('/auth/me');
    if(me.user.rol!=='alumno'){location.replace('index.html');return;}
  }catch(e){
    if(e.message!=='Sesión expirada')mcMostrarError('mcAlert','No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
    return;
  }
  mcEl('mcMarcaFecha').value=hoyChileISO();
  mcEl('mcMarcaFecha').max=hoyChileISO();
  mcEl('mcMarcaFecha').min=(parseInt(hoyChileISO().slice(0,4),10)-10)+hoyChileISO().slice(4);
  mcAjustarKg();
  try{
    var est=await fetch(API_BASE_URL+'/pagos-online/estado').then(function(r){return r.json();});
    mc.pagoHabilitado=!!est.habilitado;
  }catch(e){mc.pagoHabilitado=false;}
  await Promise.all([mcCargarPerfil(),mcCargarPagos(),mcCargarMarcas()]);
}

// ── Perfil y membresía ──
async function mcCargarPerfil(){
  try{
    var d=await apiRequest('/mi-cuenta/perfil');
    mc.perfil=d.perfil;
    mcPintarPerfil();
    mcPintarMembresia();
  }catch(e){
    if(e.message==='Sesión expirada')return;
    mcMostrarError('mcAlert',e.message||'No pudimos cargar tu perfil');
    mcEl('mcPerfilNombre').textContent='No disponible';
    mcEl('mcMembresia').innerHTML='';
  }
}

function mcPintarPerfil(){
  var p=mc.perfil;
  var primero=String(p.nombre||'').split(' ')[0];
  mcEl('mcNombre').value=p.nombre||'';
  mcEl('mcTelefono').value=p.telefono||'';
  mcEl('mcEmail').value=p.email||'';
  mcEl('mcPerfilNombre').textContent=p.nombre||'';
  mcEl('mcPerfilEmail').textContent=p.email||'';
  mcEl('mcPerfilAv').innerHTML=mcAvatarHtml(p.nombre,p.miniatura,72);
  mcEl('mcHeadAv').innerHTML=mcAvatarHtml(p.nombre,p.miniatura,34);
  mcEl('mcSalir').textContent=primero+' · Salir';
}

async function mcGuardarPerfil(){
  mcLimpiarError('mcPerfilErr');
  var nombre=mcEl('mcNombre').value.trim();
  var tel=mcEl('mcTelefono').value.trim();
  if(!nombre){mcMostrarError('mcPerfilErr','El nombre es obligatorio');return;}
  var btn=mcEl('mcPerfilBtn');
  btn.disabled=true;
  try{
    await apiRequest('/mi-cuenta/perfil',{method:'PATCH',body:JSON.stringify({nombre:nombre,telefono:tel})});
    mc.perfil.nombre=nombre;
    mc.perfil.telefono=tel||null;
    mcPintarPerfil();
    lndToast('Datos actualizados');
  }catch(e){
    if(e.message!=='Sesión expirada')mcMostrarError('mcPerfilErr',e.message||'No se pudo guardar');
  }finally{btn.disabled=false;}
}

function mcPintarMembresia(){
  var m=mc.perfil.membresia||{};
  var map={vigente:['ok','Vigente'],por_vencer:['warn','Por vencer'],vencida:['bad','Vencida'],sin_plan:['none','Sin plan']};
  var est=map[m.estado]||map.sin_plan;
  var detalle='';
  if(m.estado==='sin_plan'||!m.vence_el){
    detalle='Aún no tienes un plan activo.';
  }else{
    var d=mcDiasHasta(m.vence_el);
    if(d>=0)detalle='Vence el '+formatFechaCL(m.vence_el)+(d===0?' (hoy)':' · faltan '+mcPlural(d,'día','días'));
    else detalle='Venció el '+formatFechaCL(m.vence_el)+' · hace '+mcPlural(-d,'día','días');
  }
  mcEl('mcMembresia').innerHTML=
    '<div class="mc-mem">'
    +'<div><small>Estado</small><span class="mc-badge '+est[0]+'">'+est[1]+'</span></div>'
    +'<div><small>Plan</small><strong>'+esc(m.plan||'—')+'</strong></div>'
    +'<div style="grid-column:1/-1"><small>Vencimiento</small><strong>'+esc(m.vence_el?formatFechaCL(m.vence_el):'—')+'</strong>'
    +'<div class="mc-muted">'+esc(detalle)+'</div></div></div>';
  var box=mcEl('mcPagarBox');
  if(mc.pagoHabilitado){
    var renueva=m.estado==='vigente'||m.estado==='por_vencer';
    box.innerHTML='<button class="btn-grad" onclick="mcAbrirPago()">'+(renueva?'Renovar plan':'Pagar plan')+'</button>';
  }else{
    box.innerHTML='<p class="mc-muted">El pago en línea no está disponible por ahora. Puedes pagar tu plan directamente en el gimnasio.</p>';
  }
}

// ── Pago en línea (Webpay) ──
function mcCerrarPago(){mcEl('mcPayOverlay').classList.remove('show');}

async function mcAbrirPago(){
  mcLimpiarError('mcPayErr');
  mcEl('mcPayPlanes').innerHTML='<div class="legal-note">Cargando planes...</div>';
  mcEl('mcPayMembresia').textContent='';
  mcEl('mcPayBtn').disabled=false;
  mcEl('mcPayBtn').textContent='Pagar con Webpay';
  mcEl('mcPayOverlay').classList.add('show');
  try{
    var data=await apiRequest('/pagos-online/planes');
    var planes=data.planes||[];
    var m=data.membresia;
    var msg='';
    if(m&&m.estado==='sin_plan')msg='Aún no tienes un plan activo.';
    else if(m&&m.estado==='vencida')msg='Tu plan venció el '+formatFechaCL(m.vence_el)+'.';
    else if(m)msg='Tu plan vence el '+formatFechaCL(m.vence_el)+'. Si pagas ahora, el nuevo período parte al día siguiente.';
    mcEl('mcPayMembresia').textContent=msg;
    if(!planes.length){
      mcEl('mcPayPlanes').innerHTML='<div class="legal-note">No hay planes disponibles para pago en línea por ahora.</div>';
      mcEl('mcPayBtn').disabled=true;
      return;
    }
    mcEl('mcPayPlanes').innerHTML=planes.map(function(p,i){
      return '<label class="pay-plan"><input type="radio" name="mcPayPlan" value="'+esc(p.id)+'"'+(i===0?' checked':'')+'/>'
        +'<span><strong>'+esc(p.nombre)+'</strong> — '+esc(formatCLP(p.precio))
        +'<small>'+esc(p.duracion_dias)+' días'+(p.beneficios?' · '+esc(p.beneficios):'')+'</small></span></label>';
    }).join('');
  }catch(e){
    if(e.message==='Sesión expirada')return;
    mcEl('mcPayPlanes').innerHTML='';
    mcMostrarError('mcPayErr',e.message||'No se pudieron cargar los planes');
    mcEl('mcPayBtn').disabled=true;
  }
}

// Crea la transacción y envía el formulario POST a Webpay con token_ws (sin iframe).
async function mcIniciarPago(){
  if(mc.pagando)return;
  mcLimpiarError('mcPayErr');
  var sel=document.querySelector('input[name="mcPayPlan"]:checked');
  if(!sel){mcMostrarError('mcPayErr','Selecciona un plan');return;}
  mc.pagando=true;
  var btn=mcEl('mcPayBtn');
  btn.disabled=true;btn.textContent='Redirigiendo a Webpay...';
  try{
    var data=await apiRequest('/pagos-online/iniciar',{method:'POST',body:JSON.stringify({plan_id:parseInt(sel.value,10)})});
    if(!data.url||!/^https:\/\//.test(data.url)||!data.token)throw new Error('Respuesta de pago inválida');
    var f=document.createElement('form');
    f.method='POST';f.action=data.url;
    var i=document.createElement('input');
    i.type='hidden';i.name='token_ws';i.value=data.token;
    f.appendChild(i);
    document.body.appendChild(f);
    f.submit();
  }catch(e){
    if(e.message!=='Sesión expirada')mcMostrarError('mcPayErr',e.message||'No se pudo iniciar el pago');
    btn.disabled=false;btn.textContent='Pagar con Webpay';
    mc.pagando=false;
  }
}

// ── Pagos ──
async function mcCargarPagos(){
  try{
    var d=await apiRequest('/mi-cuenta/pagos');
    mc.pagos=d.pagos||[];
    mcPintarPagos();
  }catch(e){
    if(e.message==='Sesión expirada')return;
    mcEl('mcPagos').innerHTML='<p class="mc-muted">No pudimos cargar tus pagos.</p>';
  }
}

function mcPintarPagos(){
  if(!mc.pagos.length){
    mcEl('mcPagos').innerHTML='<p class="mc-muted">Aún no tienes pagos registrados.</p>';
    return;
  }
  var lista=mc.pagosTodos?mc.pagos:mc.pagos.slice(0,6);
  var html=lista.map(function(p){
    var anulado=p.estado==='anulado';
    var comp=(p.transaccion_id&&p.documento_disponible)
      ?'<button class="mc-link" onclick="mcDescargar('+Number(p.transaccion_id)+')">Descargar comprobante</button>':'';
    return '<div class="mc-row"><div class="mc-row-main"><strong>'+esc(p.plan_nombre)+'</strong>'
      +'<span>'+esc(formatFechaCL(p.fecha_pago))+' · '+esc(MC_METODOS[p.metodo]||p.metodo)+'</span><br/>'
      +'<span>Período '+esc(formatFechaCL(p.periodo_desde))+' al '+esc(formatFechaCL(p.periodo_hasta))+'</span></div>'
      +'<div class="mc-row-side"><strong>'+esc(formatCLP(p.monto))+'</strong>'
      +'<span class="mc-badge '+(anulado?'bad':'ok')+'">'+(anulado?'Anulado':'Pagado')+'</span>'+comp+'</div></div>';
  }).join('');
  if(mc.pagos.length>6){
    html+='<button class="mc-btn-ghost" style="margin-top:.8rem" onclick="mcToggleTodos()">'
      +(mc.pagosTodos?'Ver menos':'Ver todos ('+mc.pagos.length+')')+'</button>';
  }
  mcEl('mcPagos').innerHTML=html;
}

function mcToggleTodos(){mc.pagosTodos=!mc.pagosTodos;mcPintarPagos();}

// Descarga el comprobante PDF con el token (fetch + blob).
async function mcDescargar(txId){
  try{
    var res=await fetch(API_BASE_URL+'/pagos-online/'+txId+'/documento',{headers:authHeaders()});
    if(res.status===401){handleSessionExpired();return;}
    if(!res.ok){
      var msg='No se pudo descargar el comprobante';
      try{var j=await res.json();if(j&&j.error)msg=j.error;}catch(e){}
      lndToast(msg,'err');
      return;
    }
    var blob=await res.blob();
    var a=document.createElement('a');
    var obj=URL.createObjectURL(blob);
    a.href=obj;a.download='comprobante-'+txId+'.pdf';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(obj);},1000);
  }catch(e){
    lndToast('Error de conexión al descargar el comprobante','err');
  }
}

// ── Marcas ──
async function mcCargarMarcas(){
  try{
    mc.marcas=await apiRequest('/mi-cuenta/marcas');
    mcPintarMarcas();
  }catch(e){
    if(e.message==='Sesión expirada')return;
    mcEl('mcLifts').innerHTML='<p class="mc-muted">No pudimos cargar tus marcas.</p>';
  }
}

function mcPintarMarcas(){
  var d=mc.marcas;
  var tiles=MC_EJERCICIOS.map(function(ej){
    var m=d.mejores[ej.id];
    return '<div class="mc-lift"><small>'+ej.nombre+'</small><strong>'+(m?esc(mcKg(m.kg)):'—')+'</strong>'
      +'<span>'+(m?esc(formatFechaCL(m.fecha)):'Sin registrar')+'</span></div>';
  }).join('');
  var faltan=d.faltan.map(function(id){return mcEjercicio(id).nombre.toLowerCase();});
  tiles+='<div class="mc-lift total"><small>Total</small><strong>'+(d.total!==null?esc(mcKg(d.total)):'—')+'</strong>'
    +'<span>'+(d.total!==null?'Suma de tus tres mejores':'Falta: '+esc(faltan.join(', ')))+'</span></div>';
  mcEl('mcLifts').innerHTML=tiles;
  mcGrafico();

  var h=d.historial.slice(0,20);
  mcEl('mcHistorial').innerHTML=h.length?h.map(function(m){
    var ej=mcEjercicio(m.ejercicio);
    return '<div class="mc-row"><div class="mc-row-main"><strong>'+esc(ej?ej.nombre:m.ejercicio)+' · '+esc(mcKg(m.kg))+'</strong>'
      +'<span>'+esc(formatFechaCL(m.fecha))+'</span></div>'
      +'<button class="mc-del" aria-label="Eliminar marca" onclick="mcBorrarMarca('+Number(m.id)+')">×</button></div>';
  }).join(''):'<p class="mc-muted">Aún no registras marcas. Agrega tu mejor levantamiento de cada ejercicio para ver tu total y tu progreso.</p>';
}

function mcGrafico(){
  var d=mc.marcas;
  var box=mcEl('mcChartBox');
  if(mc.chart){mc.chart.destroy();mc.chart=null;}
  if(typeof Chart==='undefined'||!d.progreso.length){box.style.display='none';return;}
  box.style.display='block';
  var labels=d.progreso.map(function(p){return formatFechaCL(p.fecha);});
  var ds=MC_EJERCICIOS.map(function(ej){
    return {label:ej.nombre,data:d.progreso.map(function(p){return p[ej.id];}),borderColor:ej.color,backgroundColor:ej.color,
      tension:.25,pointRadius:3,borderWidth:2,spanGaps:true,yAxisID:'y'};
  });
  ds.push({label:'Total',data:d.progreso.map(function(p){return p.total;}),borderColor:'#E91E8C',backgroundColor:'#E91E8C',
    borderDash:[6,4],tension:.25,pointRadius:3,borderWidth:2,spanGaps:true,yAxisID:'y2'});
  mc.chart=new Chart(mcEl('mcChart'),{
    type:'line',
    data:{labels:labels,datasets:ds},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'bottom',labels:{color:'#a8a29e',boxWidth:12,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+mcKg(c.parsed.y);}}}
      },
      scales:{
        x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#777',font:{size:10},maxRotation:0,autoSkip:true}},
        y:{position:'left',grid:{color:'rgba(255,255,255,.06)'},ticks:{color:'#777',font:{size:10},callback:function(v){return v+' kg';}}},
        y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:'#E91E8C',font:{size:10},callback:function(v){return v+' kg';}}}
      }
    }
  });
}

// Ajusta el máximo permitido según el ejercicio (el servidor valida de nuevo).
function mcAjustarKg(){
  var ej=mcEjercicio(mcEl('mcMarcaEj').value);
  var kg=mcEl('mcMarcaKg');
  kg.min=ej.min;kg.max=ej.max;
}

async function mcGuardarMarca(){
  mcLimpiarError('mcMarcaErr');
  var ej=mcEjercicio(mcEl('mcMarcaEj').value);
  var kg=parseFloat(String(mcEl('mcMarcaKg').value).replace(',','.'));
  var fecha=mcEl('mcMarcaFecha').value;
  if(isNaN(kg)){mcMostrarError('mcMarcaErr','Ingresa el peso en kg');return;}
  if(Math.round(kg*2)!==kg*2){mcMostrarError('mcMarcaErr','El peso debe ser múltiplo de 0,5 kg');return;}
  if(kg<ej.min||kg>ej.max){mcMostrarError('mcMarcaErr','El peso de '+ej.nombre.toLowerCase()+' debe estar entre '+ej.min+' y '+ej.max+' kg');return;}
  if(!fecha){mcMostrarError('mcMarcaErr','Elige la fecha de la marca');return;}
  var btn=mcEl('mcMarcaBtn');
  btn.disabled=true;
  try{
    await apiRequest('/mi-cuenta/marcas',{method:'POST',body:JSON.stringify({ejercicio:ej.id,kg:kg,fecha:fecha})});
    mcEl('mcMarcaKg').value='';
    lndToast('Marca registrada');
    await mcCargarMarcas();
  }catch(e){
    if(e.message!=='Sesión expirada')mcMostrarError('mcMarcaErr',e.message||'No se pudo registrar la marca');
  }finally{btn.disabled=false;}
}

async function mcBorrarMarca(id){
  if(!confirm('¿Eliminar esta marca?'))return;
  try{
    await apiRequest('/mi-cuenta/marcas/'+id,{method:'DELETE'});
    lndToast('Marca eliminada');
    await mcCargarMarcas();
  }catch(e){
    if(e.message!=='Sesión expirada')lndToast(e.message||'No se pudo eliminar la marca','err');
  }
}

// ── Seguridad ──
async function mcCambiarPassword(){
  mcLimpiarError('mcPassErr');
  var actual=mcEl('mcPassActual').value;
  var nueva=mcEl('mcPassNueva').value;
  var repite=mcEl('mcPassRepite').value;
  if(!actual){mcMostrarError('mcPassErr','Ingresa tu contraseña actual');return;}
  var err=pwError(nueva);
  if(err){mcMostrarError('mcPassErr',err);return;}
  if(nueva===actual){mcMostrarError('mcPassErr','La nueva contraseña debe ser distinta de la actual');return;}
  if(nueva!==repite){mcMostrarError('mcPassErr','Las contraseñas nuevas no coinciden');return;}
  var btn=mcEl('mcPassBtn');
  btn.disabled=true;
  try{
    await apiRequest('/mi-cuenta/password',{method:'POST',body:JSON.stringify({actual:actual,nueva:nueva})});
    mcEl('mcPassActual').value='';mcEl('mcPassNueva').value='';mcEl('mcPassRepite').value='';
    pwActualizar('mcPassNueva','mcPassMeter');
    lndToast('Contraseña actualizada');
  }catch(e){
    if(e.message!=='Sesión expirada')mcMostrarError('mcPassErr',e.message||'No se pudo cambiar la contraseña');
  }finally{btn.disabled=false;}
}

mcInit();
