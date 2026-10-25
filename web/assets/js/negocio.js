// ══ NEGOCIO ══
async function renderNegocio(){
  document.getElementById('negMetrics').innerHTML='<p style="color:var(--amuted);padding:.5rem">Cargando métricas...</p>';
  document.getElementById('rankingList').innerHTML='';
  document.getElementById('riesgoTable').innerHTML='';
  try {
    var data=await apiRequest('/stats/negocio');
    var negocio=data.negocio;

    // ── KPI cards ────────────────────────────────────────────────────────────
    var attRate=negocio.tasa_asistencia;
    document.getElementById('negMetrics').innerHTML=[
      {l:'Tasa asistencia',  v:attRate+'%',               c:'green', d:attRate>80?'up':'down', t:attRate>80?'↑ Excelente':'↓ Mejorar'},
      {l:'Clientes activos', v:negocio.clientes_activos,  c:'blue',  d:'neu', t:negocio.clientes_activos+' activos'},
      {l:'Reservas promedio',v:negocio.reservas_promedio, c:'amber', d:'neu', t:'por cliente'},
      {l:'Bloqueados',       v:negocio.clientes_bloqueados,c:'red',  d:'neu', t:'sin acceso'},
    ].map(function(m){
      return '<div class="mcard '+m.c+'"><div class="mcard-label">'+m.l+'</div><div class="mcard-val">'+m.v+'</div><div class="mcard-trend '+m.d+'">'+m.t+'</div></div>';
    }).join('');

    // ── Ranking bloques ───────────────────────────────────────────────────────
    var ranked=negocio.ranking_bloques;
    var maxPct=ranked.length>0?ranked[0].pct:100;
    document.getElementById('rankingList').innerHTML=ranked.slice(0,8).map(function(r,i){
      var color=i===0?'var(--gren)':i>=ranked.length-2?'var(--red)':'var(--blue)';
      return '<div class="rank-item"><div class="rank-top"><span class="rank-name">'+esc(r.label)+'</span><span class="rank-val">'+esc(r.pct)+'%</span></div>'
        +'<div class="rank-bg"><div class="rank-fill" style="width:'+Math.round(r.pct/maxPct*100)+'%;background:'+color+'"></div></div></div>';
    }).join('');

    // ── Gráfico: retención ────────────────────────────────────────────────────
    var retLabels=negocio.retencion.map(function(x){return x.label;});
    var retData=negocio.retencion.map(function(x){return x.valor;});
    renderChart('chartRetencion','line',retLabels,retData,'Clientes','rgba(16,185,129,.8)');

    // ── Gráfico: tendencia ────────────────────────────────────────────────────
    var tendLabels=negocio.tendencia.length?negocio.tendencia.map(function(x){return x.label;}):['Sin datos'];
    var tendData=negocio.tendencia.length?negocio.tendencia.map(function(x){return x.valor;}):[0];
    renderChart('chartTendencia','line',tendLabels,tendData,'Reservas','rgba(59,130,246,.7)');

    // ── Clientes en riesgo ────────────────────────────────────────────────────
    var riesgo=negocio.clientes_riesgo;
    document.getElementById('riesgoTable').innerHTML=riesgo.length===0
      ?'<tr><td colspan="4" style="color:var(--amuted2);padding:1rem">Sin clientes en riesgo</td></tr>'
      :riesgo.map(function(c){
          var diasLabel=c.dias_sin_visita===999?'Sin visita registrada':'Hace '+c.dias_sin_visita+' días';
          var tel=(c.telefono||'').replace(/\D/g,'');
          return '<tr><td class="primary">'+esc(c.nombre)+'</td><td><span class="abadge red">'+esc(diasLabel)+'</span></td><td>'+esc(c.reservas)+'</td>'
            +'<td>'+(tel?'<a href="https://wa.me/'+tel+'" target="_blank" class="abtn success" style="text-decoration:none;font-size:11px;padding:5px 10px">💬 Contactar</a>':'-')+'</td></tr>';
        }).join('');

  } catch(e) {
    document.getElementById('negMetrics').innerHTML='<p style="color:var(--red);padding:.5rem">Error al cargar métricas.</p>';
    adminToast(e.message||'Error al cargar negocio','err');
  }
}
