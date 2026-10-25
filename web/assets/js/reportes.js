// ══ REPORTES ══
// Descarga de reportes PDF/Excel. El endpoint exige token: fetch + Authorization + Blob + enlace temporal.
var REPORTES = {
  asistencia: { ruta: '/reportes/asistencia', nombre: 'Asistencia' },
  'ocupacion-ingresos': { ruta: '/reportes/ocupacion-ingresos', nombre: 'Ocupación e ingresos' }
};
var reporteDescargando = false;

// Hoy en America/Santiago como AAAA-MM-DD
function hoySantiagoISO(){
  try {
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  } catch(e) {
    var d=new Date();
    return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  }
}

function renderReportes(){
  var d=document.getElementById('repDesde');
  var h=document.getElementById('repHasta');
  if(d.value&&h.value)return; // conserva el rango elegido por el usuario
  setRangoMesActual();
}

function setRangoMesActual(){
  var hoy=hoySantiagoISO();
  var y=parseInt(hoy.slice(0,4),10);
  var m=parseInt(hoy.slice(5,7),10);
  var ultimo=new Date(Date.UTC(y,m,0)).getUTCDate();
  document.getElementById('repDesde').value=hoy.slice(0,7)+'-01';
  document.getElementById('repHasta').value=hoy.slice(0,7)+'-'+('0'+ultimo).slice(-2);
}

function setReportesBusy(busy,msg){
  reporteDescargando=busy;
  document.querySelectorAll('.rep-btn').forEach(function(b){b.disabled=busy;});
  var st=document.getElementById('repEstado');
  st.textContent=busy?(msg||'Generando reporte...'):'';
}

async function descargarReporte(clave,formato){
  if(reporteDescargando)return;
  var rep=REPORTES[clave];
  var desde=document.getElementById('repDesde').value;
  var hasta=document.getElementById('repHasta').value;
  if(!desde||!hasta){adminToast('Selecciona las fechas desde y hasta','err');return;}
  if(desde>hasta){adminToast('La fecha desde no puede ser posterior a hasta','err');return;}
  var url=API_BASE_URL+rep.ruta+'?desde='+encodeURIComponent(desde)+'&hasta='+encodeURIComponent(hasta)+'&formato='+encodeURIComponent(formato);
  setReportesBusy(true,'Generando '+rep.nombre+' ('+formato.toUpperCase()+')...');
  try {
    var res=await fetch(url,{headers:authHeaders()});
    if(res.status===401){handleSessionExpired();return;}
    if(!res.ok){
      var msg='No se pudo generar el reporte';
      try { var j=await res.json(); if(j&&j.error)msg=j.error; } catch(e) {}
      adminToast(msg,'err');
      return;
    }
    var blob=await res.blob();
    var a=document.createElement('a');
    var obj=URL.createObjectURL(blob);
    a.href=obj;
    a.download='reporte-'+clave+'_'+desde+'_'+hasta+'.'+formato;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(obj);},1000);
    adminToast('Reporte descargado','ok');
  } catch(e) {
    adminToast('Error de conexión al generar el reporte','err');
  } finally {
    setReportesBusy(false);
  }
}
