// ══ ASISTENCIA ══
var ciActiveDay='Lunes';

async function renderAsistencia(){
  renderDayTabs('ciDayTabs',ciActiveDay,'day-tab-a','setCiDay');
  var el=document.getElementById('ciBlocks');
  el.innerHTML='<p style="color:var(--amuted);padding:1rem">Cargando asistencia...</p>';
  try {
    var data=await apiRequest('/asistencias?dia='+encodeURIComponent(ciActiveDay));
    var bloques=data.bloques||[];
    var html=bloques.map(function(bloque){
      var inscritos=bloque.reservas.length;
      var asistencias=bloque.reservas.filter(function(r){return r.asistio;}).length;
      var attPct=inscritos>0?Math.round(asistencias/inscritos*100):0;
      var filas=inscritos
        ?bloque.reservas.map(function(r){
            var ini=getInitials(r.nombre);
            return '<div class="ci-row"><div class="av" style="background:#1d4ed8;width:28px;height:28px;font-size:10px">'+esc(ini)+'</div>'
              +'<span class="ci-name">'+esc(r.nombre)+'</span>'
              +'<button class="ci-btn '+(r.asistio?'done':'pending')+'" onclick="toggleAtt('+r.reserva_id+','+r.asistencia_id+')">'+(r.asistio?'✓ Asistió':'Marcar asistencia')+'</button></div>';
          }).join('')
        :'<p style="color:var(--amuted);font-size:13px;padding:.25rem 0">Sin inscritos en este bloque.</p>';
      return '<div class="tcard" style="margin-bottom:1rem">'
        +'<div class="tcard-head"><div><div class="tcard-title">'+esc(bloque.horario)+'</div>'
        +'<div class="tcard-sub">'+inscritos+' reservas · '+asistencias+' asistencias · '+attPct+'% tasa</div></div>'
        +'<span class="abadge '+(attPct>=80?'green':attPct>=50?'amber':'red')+'">'+attPct+'%</span></div>'
        +'<div style="padding:.5rem 1rem">'+filas+'</div></div>';
    }).join('');
    if(!html)html='<div class="aalert info"><span>ℹ️</span><span>No hay bloques para este día.</span></div>';
    el.innerHTML=html;
  } catch(e) {
    el.innerHTML='<p style="color:var(--red);padding:1rem">Error al cargar asistencia.</p>';
    adminToast(e.message||'Error al cargar asistencia','err');
  }
}

function setCiDay(d){ciActiveDay=d;renderAsistencia();}

async function toggleAtt(reservaId,asistenciaId){
  try {
    if(asistenciaId){
      await apiRequest('/asistencias/'+asistenciaId,{method:'DELETE'});
      adminToast('Asistencia removida','info');
    } else {
      await apiRequest('/asistencias',{method:'POST',body:JSON.stringify({reserva_id:reservaId})});
      adminToast('Asistencia marcada','ok');
    }
    renderAsistencia();
  } catch(e) {
    adminToast(e.message||'Error al actualizar asistencia','err');
  }
}
