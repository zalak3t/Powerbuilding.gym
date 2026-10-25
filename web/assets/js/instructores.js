// ══ INSTRUCTORES ══
var instructorFilter='';
var editInstructorId=null;
var adminInstructoresCache=[];

async function renderInstructores(){
  var tbody=document.getElementById('instructorTable');
  tbody.innerHTML='<tr><td colspan="6" style="color:var(--amuted);padding:1rem">Cargando instructores...</td></tr>';
  try {
    var data=await apiRequest('/instructores');
    adminInstructoresCache=data.instructores||[];
    paintInstructores();
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="6" style="color:var(--red);padding:1rem">Error al cargar instructores.</td></tr>';
    adminToast(e.message||'Error al cargar instructores','err');
  }
}

function paintInstructores(){
  var q=instructorFilter.toLowerCase();
  var list=adminInstructoresCache.filter(function(i){
    return !q||i.nombre.toLowerCase().indexOf(q)>-1||(i.email||'').toLowerCase().indexOf(q)>-1||(i.especialidad||'').toLowerCase().indexOf(q)>-1;
  });
  var total=adminInstructoresCache.length;
  document.getElementById('instructorCount').textContent=total+' instructor'+(total!==1?'es':'')+' registrado'+(total!==1?'s':'');
  var tbody=document.getElementById('instructorTable');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="6" style="color:var(--amuted);padding:1rem">No hay instructores'+(q?' con ese criterio':'')+'.</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(function(i){
    return '<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="av" style="background:'+getAvatarColor(i.id)+'">'+esc(getInitials(i.nombre))+'</div><span style="color:var(--atext);font-weight:500">'+esc(i.nombre)+'</span></div></td>'
      +'<td>'+(esc(i.email)||'—')+'</td><td>'+(esc(i.telefono)||'—')+'</td><td>'+(esc(i.especialidad)||'—')+'</td>'
      +'<td><span class="abadge '+(i.activo?'green':'amber')+'">'+(i.activo?'activo':'inactivo')+'</span></td>'
      +'<td><div class="abtn-row">'
      +'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openEditInstructor('+i.id+')">Editar</button>'
      +'<button class="abtn '+(i.activo?'danger':'success')+'" style="font-size:11px;padding:5px 10px" onclick="toggleInstructor('+i.id+')">'+(i.activo?'Desactivar':'Activar')+'</button>'
      +'<button class="abtn danger" style="font-size:11px;padding:5px 10px;background:rgba(239,68,68,.2)" onclick="deleteInstructor('+i.id+')">Eliminar</button>'
      +'</div></td></tr>';
  }).join('');
}

function filterInstructores(v){instructorFilter=v||'';paintInstructores();}

function openAddInstructor(){
  editInstructorId=null;
  document.getElementById('modalInstructorTitle').textContent='Nuevo Instructor';
  ['iName','iEmail','iPhone','iSpec'].forEach(function(id){document.getElementById(id).value='';});
  openAModal('modalInstructor');
}

function openEditInstructor(id){
  var i=adminInstructoresCache.find(function(x){return x.id===id;});
  if(!i){adminToast('Instructor no encontrado en caché','err');return;}
  editInstructorId=id;
  document.getElementById('modalInstructorTitle').textContent='Editar Instructor';
  document.getElementById('iName').value=i.nombre;
  document.getElementById('iEmail').value=i.email||'';
  document.getElementById('iPhone').value=i.telefono||'';
  document.getElementById('iSpec').value=i.especialidad||'';
  openAModal('modalInstructor');
}

async function saveInstructor(){
  var nombre=document.getElementById('iName').value.trim();
  var email=document.getElementById('iEmail').value.trim();
  var telefono=document.getElementById('iPhone').value.trim();
  var especialidad=document.getElementById('iSpec').value.trim();
  if(!nombre){adminToast('El nombre es obligatorio','err');return;}
  var body=JSON.stringify({nombre:nombre,email:email,telefono:telefono,especialidad:especialidad});
  try {
    if(editInstructorId){
      await apiRequest('/instructores/'+editInstructorId,{method:'PUT',body:body});
      adminToast('Instructor actualizado','ok');
    } else {
      await apiRequest('/instructores',{method:'POST',body:body});
      adminToast('Instructor creado','ok');
    }
    closeAModal('modalInstructor');
    renderInstructores();
  } catch(e) {
    adminToast(e.message||'Error al guardar instructor','err');
  }
}

async function toggleInstructor(id){
  var i=adminInstructoresCache.find(function(x){return x.id===id;});
  if(!i)return;
  try {
    await apiRequest('/instructores/'+id+'/estado',{method:'PATCH',body:JSON.stringify({activo:!i.activo})});
    adminToast('Instructor '+(i.activo?'desactivado':'activado'),'info');
    renderInstructores();
  } catch(e) {
    adminToast(e.message||'Error al cambiar estado','err');
  }
}

async function deleteInstructor(id){
  if(!confirm('¿Eliminar este instructor?'))return;
  try {
    await apiRequest('/instructores/'+id,{method:'DELETE'});
    adminToast('Instructor eliminado','ok');
    renderInstructores();
  } catch(e) {
    // El 409 por asignación llega con el mensaje del servidor (indica cuántos bloques y sugiere desactivar)
    adminToast(e.message||'Error al eliminar instructor','err');
  }
}
