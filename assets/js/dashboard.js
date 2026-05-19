// ══ DASHBOARD ══
async function renderDashboard(){
  document.getElementById('dashMetrics').innerHTML='<p style="color:var(--amuted);padding:.5rem">Cargando métricas...</p>';
  document.getElementById('alertas').innerHTML='';
  document.getElementById('recentRes').innerHTML='';
  try {
    var data=await apiRequest('/stats/dashboard');
    var d=data.dashboard;

    // ── Banner superior ──────────────────────────────────────────────────────
    document.getElementById('dashAlert').innerHTML=
      '📋 Hoy hay <strong>'+d.reservas_hoy+'</strong> reservas · '
      +'<strong>'+d.asistencias_hoy+'</strong> asistencias · '
      +'Ocupación global <strong>'+d.ocupacion_global+'%</strong>';

    // ── KPI cards ────────────────────────────────────────────────────────────
    document.getElementById('dashMetrics').innerHTML=[
      {l:'Clientes totales',    v:d.total_clientes,                c:'blue',  d:'neu', t:d.clientes_activos+' activos'},
      {l:'Reservas totales',    v:d.reservas_totales,              c:'green', d:'up',  t:'Acumuladas en BD'},
      {l:'Asistencia hoy',      v:d.tasa_asistencia_hoy+'%',       c:'amber', d:(d.tasa_asistencia_hoy>=80?'up':'neu'), t:d.tasa_asistencia_hoy>=80?'Excelente':'Mejorable'},
      {l:'Ocupación global',    v:d.ocupacion_global+'%',          c:'pink',  d:(d.ocupacion_global>=70?'up':'down'), t:d.ocupacion_global>=70?'Sobre objetivo':'Bajo objetivo'},
    ].map(function(m){
      return '<div class="mcard '+m.c+'"><div class="mcard-label">'+m.l+'</div><div class="mcard-val">'+m.v+'</div><div class="mcard-trend '+m.d+'">'+m.t+'</div></div>';
    }).join('');

    // ── Gráfico: reservas por día ─────────────────────────────────────────────
    var diasLabels = d.ocupacion_por_dia.length ? d.ocupacion_por_dia.map(function(x){return x.dia.substring(0,3);}) : ['Sin datos'];
    var diasData   = d.ocupacion_por_dia.length ? d.ocupacion_por_dia.map(function(x){return x.reservas;}) : [0];
    renderChart('chartDias','bar',diasLabels,diasData,'Reservas','rgba(59,130,246,.8)');

    // ── Gráfico: ocupación por bloque ─────────────────────────────────────────
    var blqLabels = d.ocupacion_por_bloque.length ? d.ocupacion_por_bloque.slice(0,8).map(function(x){return x.label.split(' ').slice(-1)[0].split('–')[0];}) : ['Sin datos'];
    var blqData   = d.ocupacion_por_bloque.length ? d.ocupacion_por_bloque.slice(0,8).map(function(x){return x.pct;}) : [0];
    renderChart('chartBloques','bar',blqLabels,blqData,'Ocup%','rgba(16,185,129,.8)');

    // ── Alertas ───────────────────────────────────────────────────────────────
    var alertsHtml=d.alertas.map(function(a){
      var cls=a.tipo==='warning'?'warn':a.tipo==='info'?'info':'success';
      var ico=a.tipo==='warning'?'⚠️':a.tipo==='info'?'ℹ️':'✅';
      return '<div class="aalert '+cls+'"><span>'+ico+'</span><span>'+a.mensaje+'</span></div>';
    }).join('');
    if(!alertsHtml)alertsHtml='<div class="aalert success"><span>✅</span><span>Todo en orden. Sin alertas activas.</span></div>';
    document.getElementById('alertas').innerHTML=alertsHtml;

    // ── Actividad reciente ────────────────────────────────────────────────────
    var act=d.actividad_reciente;
    document.getElementById('recentRes').innerHTML=act.length
      ? act.map(function(r){
          return '<tr><td class="primary">'+r.cliente+'</td><td>'+r.horario+'</td><td>'+r.dia+'</td>'
            +'<td><span class="abadge '+(r.asistio?'green':'blue')+'">'+(r.asistio?'Asistió':'Reservado')+'</span></td></tr>';
        }).join('')
      : '<tr><td colspan="4" style="color:var(--amuted2);padding:1rem">Sin actividad reciente.</td></tr>';

  } catch(e) {
    document.getElementById('dashMetrics').innerHTML='<p style="color:var(--red);padding:.5rem">Error al cargar métricas.</p>';
    adminToast(e.message||'Error al cargar dashboard','err');
  }
}

function renderChart(id,type,labels,data,label,color){
  if(charts[id])charts[id].destroy();
  var ctx=document.getElementById(id);if(!ctx)return;
  charts[id]=new Chart(ctx,{type:type,data:{labels:labels,datasets:[{label:label,data:data,backgroundColor:color,borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:10}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:10}}}}}});
}
