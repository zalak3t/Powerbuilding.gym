// ══ PLANES ══
var planFilter='';
var editPlanId=null;
var adminPlanesCache=[];

async function renderPlanes(){
  var tbody=document.getElementById('planTable');
  tbody.innerHTML='<tr><td colspan="6" style="color:var(--amuted);padding:1rem">Cargando planes...</td></tr>';
  try {
    var data=await apiRequest('/planes');
    adminPlanesCache=data.planes||[];
    paintPlanes();
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="6" style="color:var(--red);padding:1rem">Error al cargar planes.</td></tr>';
    adminToast(e.message||'Error al cargar planes','err');
  }
}

function paintPlanes(){
  var q=planFilter.toLowerCase();
  var list=adminPlanesCache.filter(function(p){
    return !q||p.nombre.toLowerCase().indexOf(q)>-1||(p.descripcion||'').toLowerCase().indexOf(q)>-1;
  });
  var total=adminPlanesCache.length;
  document.getElementById('planCount').textContent=total+' plan'+(total!==1?'es':'')+' registrado'+(total!==1?'s':'');
  var tbody=document.getElementById('planTable');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="6" style="color:var(--amuted);padding:1rem">No hay planes'+(q?' con ese criterio':' todavía. Crea el primero con «+ Nuevo plan»')+'.</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(function(p){
    return '<tr><td><div style="color:var(--atext);font-weight:500">'+esc(p.nombre)+'</div>'
      +(p.descripcion?'<div style="font-size:11px;color:var(--amuted2);margin-top:2px">'+esc(p.descripcion)+'</div>':'')+'</td>'
      +'<td>'+esc(p.duracion_dias)+' día'+(p.duracion_dias!==1?'s':'')+'</td>'
      +'<td style="color:var(--atext);font-weight:600">'+esc(formatCLP(p.precio))+'</td>'
      +'<td><span class="abadge blue">'+esc(p.pagos)+'</span></td>'
      +'<td><span class="abadge '+(p.activo?'green':'amber')+'">'+(p.activo?'activo':'inactivo')+'</span></td>'
      +'<td><div class="abtn-row">'
      +'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openEditPlan('+p.id+')">Editar</button>'
      +'<button class="abtn '+(p.activo?'danger':'success')+'" style="font-size:11px;padding:5px 10px" onclick="togglePlan('+p.id+')">'+(p.activo?'Desactivar':'Activar')+'</button>'
      +'<button class="abtn danger" style="font-size:11px;padding:5px 10px;background:rgba(239,68,68,.2)" onclick="deletePlan('+p.id+')">Eliminar</button>'
      +'</div></td></tr>';
  }).join('');
}

function filterPlanes(v){planFilter=v||'';paintPlanes();}

function openAddPlan(){
  editPlanId=null;
  document.getElementById('modalPlanTitle').textContent='Nuevo Plan';
  ['plName','plDias','plPrecio','plDesc','plBenef'].forEach(function(id){document.getElementById(id).value='';});
  openAModal('modalPlan');
}

function openEditPlan(id){
  var p=adminPlanesCache.find(function(x){return x.id===id;});
  if(!p){adminToast('Plan no encontrado en caché','err');return;}
  editPlanId=id;
  document.getElementById('modalPlanTitle').textContent='Editar Plan';
  document.getElementById('plName').value=p.nombre;
  document.getElementById('plDias').value=p.duracion_dias;
  document.getElementById('plPrecio').value=p.precio;
  document.getElementById('plDesc').value=p.descripcion||'';
  document.getElementById('plBenef').value=p.beneficios||'';
  openAModal('modalPlan');
}

async function savePlan(){
  var nombre=document.getElementById('plName').value.trim();
  var dias=document.getElementById('plDias').value.trim();
  var precio=document.getElementById('plPrecio').value.trim();
  if(!nombre){adminToast('El nombre es obligatorio','err');return;}
  if(!/^\d+$/.test(dias)||parseInt(dias,10)<1){adminToast('La duración debe ser un número entero de días (mínimo 1)','err');return;}
  if(!/^\d+$/.test(precio)){adminToast('El precio debe ser un número entero en pesos (0 o más)','err');return;}
  var body=JSON.stringify({
    nombre:nombre,
    duracion_dias:parseInt(dias,10),
    precio:parseInt(precio,10),
    descripcion:document.getElementById('plDesc').value.trim(),
    beneficios:document.getElementById('plBenef').value.trim()
  });
  try {
    if(editPlanId){
      await apiRequest('/planes/'+editPlanId,{method:'PUT',body:body});
      adminToast('Plan actualizado','ok');
    } else {
      await apiRequest('/planes',{method:'POST',body:body});
      adminToast('Plan creado','ok');
    }
    closeAModal('modalPlan');
    renderPlanes();
  } catch(e) {
    adminToast(e.message||'Error al guardar plan','err');
  }
}

async function togglePlan(id){
  var p=adminPlanesCache.find(function(x){return x.id===id;});
  if(!p)return;
  try {
    await apiRequest('/planes/'+id+'/estado',{method:'PATCH',body:JSON.stringify({activo:!p.activo})});
    adminToast('Plan '+(p.activo?'desactivado':'activado'),'info');
    renderPlanes();
  } catch(e) {
    adminToast(e.message||'Error al cambiar estado','err');
  }
}

async function deletePlan(id){
  if(!confirm('¿Eliminar este plan?'))return;
  try {
    await apiRequest('/planes/'+id,{method:'DELETE'});
    adminToast('Plan eliminado','ok');
    renderPlanes();
  } catch(e) {
    // El 409 por pagos llega con el mensaje del servidor (sugiere desactivar)
    adminToast(e.message||'Error al eliminar plan','err');
  }
}
