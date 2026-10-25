// ══ LANDING BLOCKS ══
var lActiveDay='Lunes';
function renderLandingDayTabs(){
  renderDayTabs('dayTabs',lActiveDay,'day-tab-l','setLDay');
}
function setLDay(d){lActiveDay=d;renderLandingDayTabs();renderLandingBlocks();}

async function renderLandingBlocks(){
  var el=document.getElementById('bgrid');
  if(!curUser){
    el.innerHTML='<div class="login-prompt"><p>Inicia sesión o crea tu cuenta para reservar un bloque en Powerbuilding.gym.</p><button class="btn-outline" onclick="openAuth()">Iniciar sesión · Registrarse</button></div>';
    return;
  }
  el.innerHTML='<p style="text-align:center;color:var(--muted);padding:2rem">Cargando bloques...</p>';
  try {
    var data=await apiRequest('/bloques?dia='+encodeURIComponent(lActiveDay));
    var dayBlocks=data.bloques;
    if(!dayBlocks||!dayBlocks.length){
      el.innerHTML='<p style="text-align:center;color:var(--muted);padding:2rem">No hay bloques disponibles este día.</p>';
      return;
    }
    el.innerHTML=dayBlocks.map(function(b){
      var taken=b.inscritos, cap=b.capacidad, free=cap-taken;
      var pct=getBlockOccupancyPercent(b);
      var barColor=pct>=100?'#ef4444':pct>=75?'#f59e0b':'#E91E8C';
      var hasRes=b.reservado_por_mi;
      var full=isBlockFull(b)&&!hasRes;
      var susp=isBlockSuspended(b);
      var cls=susp?'susp':hasRes?'cancel':full?'full':'avail';
      var lbl=susp?'⏸ Suspendido':hasRes?'Cancelar':full?'Sin cupos':'Reservar';
      var onclick=susp?'':hasRes?'lCancelBlock('+b.reserva_id+')':full?'':('lReserveBlock('+b.id+')');
      return '<div class="bcard'+(hasRes?' reserved':'')+(susp?' suspended':'')+'">'
        +'<div class="btime">'+esc(b.horario)+'</div>'
        +'<div class="bday">'+esc(b.dia)+(susp?' · <span style="color:#f59e0b">'+esc(b.mensaje)+'</span>':' · '+esc(taken)+'/'+esc(cap)+' inscritos')+'</div>'
        +(b.disciplina_nombre||b.instructor_nombre?'<div class="bday" style="margin-top:-8px">'+(b.disciplina_nombre?esc(b.disciplina_nombre):'')+(b.disciplina_nombre&&b.instructor_nombre?' · ':'')+(b.instructor_nombre?'con '+esc(b.instructor_nombre):'')+'</div>':'')
        +'<div class="bbar-wrap"><div class="bbar" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
        +'<div class="bfoot"><span class="bslots" style="color:'+(full?'#ef4444':hasRes?'var(--pink2)':'var(--muted)')+'">'+
        (susp?'Bloque suspendido':hasRes?'✓ Reservado':full?'Sin cupos':free+' cupo'+(free!==1?'s':''))+'</span>'
        +'<button class="btn-r '+cls+'"'+(onclick?' onclick="'+onclick+'"':'')+'>'+lbl+'</button></div></div>';
    }).join('');
  } catch(e) {
    el.innerHTML='<p style="text-align:center;color:#ef4444;padding:2rem">Error al cargar bloques. Intenta de nuevo.</p>';
    lndToast(e.message||'Error al cargar bloques','err');
  }
}

async function lReserveBlock(id){
  try {
    await apiRequest('/reservas',{method:'POST',body:JSON.stringify({bloque_id:id})});
    lndToast('¡Bloque reservado! 🎉');
    renderLandingBlocks();
  } catch(e) {
    lndToast(e.message||'Error al reservar','err');
  }
}

async function lCancelBlock(reservaId){
  try {
    await apiRequest('/reservas/'+reservaId,{method:'DELETE'});
    lndToast('Reserva cancelada','err');
    renderLandingBlocks();
  } catch(e) {
    lndToast(e.message||'Error al cancelar','err');
  }
}

renderLandingDayTabs();
renderLandingBlocks();
