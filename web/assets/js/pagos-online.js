// ══ PAGO EN LÍNEA (alumno, Webpay Plus) ══
var pagoOnlineHabilitado=null; // null = aún no consultado
var pagarPendiente=new URLSearchParams(window.location.search).get('pagar')==='1'; // viene de {{link_pago}}
var pagarAuthAbierto=false;
var pagando=false;

// Muestra u oculta "Pagar mi plan" según rol y si el pago en línea está habilitado.
async function actualizarBotonPagar(){
  var li=document.getElementById('navPagarLi');
  if(!li)return;
  var esAlumno=typeof curUser!=='undefined'&&curUser&&curUser.rol==='alumno';
  if(!esAlumno){
    li.style.display='none';
    // Enlace del correo sin sesión: pedir login una vez (con token guardado se espera a que se valide la sesión)
    if(pagarPendiente&&!getToken()&&!pagarAuthAbierto){pagarAuthAbierto=true;openAuth();}
    return;
  }
  if(pagoOnlineHabilitado===null){
    try {
      var res=await fetch(API_BASE_URL+'/pagos-online/estado');
      var d=await res.json();
      pagoOnlineHabilitado=!!d.habilitado;
    } catch(e) { pagoOnlineHabilitado=false; }
  }
  li.style.display=pagoOnlineHabilitado?'':'none';
  if(pagarPendiente&&pagoOnlineHabilitado){
    pagarPendiente=false;
    try{history.replaceState(null,'',window.location.pathname);}catch(e){}
    openPagar();
  }
}

function closePagar(){document.getElementById('payOverlay').classList.remove('show');}

async function openPagar(){
  if(typeof curUser==='undefined'||!curUser){openAuth();return;}
  var err=document.getElementById('payErr');
  err.classList.remove('show');
  document.getElementById('payPlanes').innerHTML='<div class="legal-note">Cargando planes...</div>';
  document.getElementById('payMembresia').textContent='';
  document.getElementById('payBtn').disabled=false;
  document.getElementById('payOverlay').classList.add('show');
  try {
    var data=await apiRequest('/pagos-online/planes');
    var planes=data.planes||[];
    var m=data.membresia;
    var msg='';
    if(m&&m.estado==='sin_plan')msg='Aún no tienes un plan activo.';
    else if(m&&m.estado==='vencida')msg='Tu plan venció el '+formatFechaCL(m.vence_el)+'.';
    else if(m)msg='Tu plan vence el '+formatFechaCL(m.vence_el)+'. Si pagas ahora, el nuevo período parte al día siguiente.';
    document.getElementById('payMembresia').textContent=msg;
    if(!planes.length){
      document.getElementById('payPlanes').innerHTML='<div class="legal-note">No hay planes disponibles para pago en línea por ahora.</div>';
      document.getElementById('payBtn').disabled=true;
      return;
    }
    document.getElementById('payPlanes').innerHTML=planes.map(function(p,i){
      return '<label class="pay-plan"><input type="radio" name="payPlan" value="'+p.id+'"'+(i===0?' checked':'')+'/>'
        +'<span><strong>'+esc(p.nombre)+'</strong> — '+esc(formatCLP(p.precio))
        +'<small>'+esc(p.duracion_dias)+' días'+(p.beneficios?' · '+esc(p.beneficios):'')+'</small></span></label>';
    }).join('');
  } catch(e) {
    document.getElementById('payPlanes').innerHTML='';
    err.textContent=e.message||'No se pudieron cargar los planes';err.classList.add('show');
    document.getElementById('payBtn').disabled=true;
  }
}

// Crea la transacción y envía el formulario POST a Webpay con token_ws (sin iframe).
async function iniciarPagoOnline(){
  if(pagando)return;
  var err=document.getElementById('payErr');
  err.classList.remove('show');
  var sel=document.querySelector('input[name="payPlan"]:checked');
  if(!sel){err.textContent='Selecciona un plan';err.classList.add('show');return;}
  pagando=true;
  var btn=document.getElementById('payBtn');
  btn.disabled=true;btn.textContent='Redirigiendo a Webpay...';
  try {
    var data=await apiRequest('/pagos-online/iniciar',{method:'POST',body:JSON.stringify({plan_id:parseInt(sel.value,10)})});
    if(!data.url||!/^https:\/\//.test(data.url)||!data.token)throw new Error('Respuesta de pago inválida');
    var f=document.createElement('form');
    f.method='POST';f.action=data.url;
    var i=document.createElement('input');
    i.type='hidden';i.name='token_ws';i.value=data.token;
    f.appendChild(i);
    document.body.appendChild(f);
    f.submit();
  } catch(e) {
    err.textContent=e.message||'No se pudo iniciar el pago';err.classList.add('show');
    btn.disabled=false;btn.textContent='Pagar con Webpay';
    pagando=false;
  }
}

// Descarga el comprobante PDF de una transacción (alumno dueño o admin).
async function descargarComprobante(txId){
  var avisar=function(m,t){if(typeof adminToast==='function'&&document.getElementById('adminApp')&&document.getElementById('adminApp').classList.contains('show'))adminToast(m,t);else if(typeof lndToast==='function')lndToast(m,t);};
  try {
    var res=await fetch(API_BASE_URL+'/pagos-online/'+txId+'/documento',{headers:authHeaders()});
    if(res.status===401){handleSessionExpired();return;}
    if(!res.ok){
      var msg='No se pudo descargar el comprobante';
      try { var j=await res.json(); if(j&&j.error)msg=j.error; } catch(e) {}
      avisar(msg,'err');
      return;
    }
    var blob=await res.blob();
    var a=document.createElement('a');
    var obj=URL.createObjectURL(blob);
    a.href=obj;a.download='comprobante-'+txId+'.pdf';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(obj);},1000);
  } catch(e) {
    avisar('Error de conexión al descargar el comprobante','err');
  }
}
