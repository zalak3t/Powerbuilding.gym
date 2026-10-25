// ══ DISCIPLINAS ══
var disciplinaFilter='';
var editDisciplinaId=null;
var adminDisciplinasCache=[];

async function renderDisciplinas(){
  var tbody=document.getElementById('disciplinaTable');
  tbody.innerHTML='<tr><td colspan="5" style="color:var(--amuted);padding:1rem">Cargando disciplinas...</td></tr>';
  try {
    var data=await apiRequest('/disciplinas');
    adminDisciplinasCache=data.disciplinas||[];
    paintDisciplinas();
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="5" style="color:var(--red);padding:1rem">Error al cargar disciplinas.</td></tr>';
    adminToast(e.message||'Error al cargar disciplinas','err');
  }
}

function paintDisciplinas(){
  var q=disciplinaFilter.toLowerCase();
  var list=adminDisciplinasCache.filter(function(d){
    return !q||d.nombre.toLowerCase().indexOf(q)>-1||(d.descripcion||'').toLowerCase().indexOf(q)>-1;
  });
  var total=adminDisciplinasCache.length;
  document.getElementById('disciplinaCount').textContent=total+' disciplina'+(total!==1?'s':'')+' registrada'+(total!==1?'s':'');
  var tbody=document.getElementById('disciplinaTable');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="5" style="color:var(--amuted);padding:1rem">No hay disciplinas'+(q?' con ese criterio':'')+'.</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(function(d){
    return '<tr><td style="color:var(--atext);font-weight:500">'+esc(d.nombre)+'</td>'
      +'<td>'+(esc(d.descripcion)||'—')+'</td>'
      +'<td><span class="abadge blue">'+esc(d.bloques)+'</span></td>'
      +'<td><span class="abadge '+(d.activo?'green':'amber')+'">'+(d.activo?'activa':'inactiva')+'</span></td>'
      +'<td><div class="abtn-row">'
      +'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openEditDisciplina('+d.id+')">Editar</button>'
      +'<button class="abtn '+(d.activo?'danger':'success')+'" style="font-size:11px;padding:5px 10px" onclick="toggleDisciplina('+d.id+')">'+(d.activo?'Desactivar':'Activar')+'</button>'
      +'<button class="abtn danger" style="font-size:11px;padding:5px 10px;background:rgba(239,68,68,.2)" onclick="deleteDisciplina('+d.id+')">Eliminar</button>'
      +'</div></td></tr>';
  }).join('');
}

function filterDisciplinas(v){disciplinaFilter=v||'';paintDisciplinas();}

function openAddDisciplina(){
  editDisciplinaId=null;
  document.getElementById('modalDisciplinaTitle').textContent='Nueva Disciplina';
  document.getElementById('dName').value='';
  document.getElementById('dDesc').value='';
  openAModal('modalDisciplina');
}

function openEditDisciplina(id){
  var d=adminDisciplinasCache.find(function(x){return x.id===id;});
  if(!d){adminToast('Disciplina no encontrada en caché','err');return;}
  editDisciplinaId=id;
  document.getElementById('modalDisciplinaTitle').textContent='Editar Disciplina';
  document.getElementById('dName').value=d.nombre;
  document.getElementById('dDesc').value=d.descripcion||'';
  openAModal('modalDisciplina');
}

async function saveDisciplina(){
  var nombre=document.getElementById('dName').value.trim();
  var descripcion=document.getElementById('dDesc').value.trim();
  if(!nombre){adminToast('El nombre es obligatorio','err');return;}
  var body=JSON.stringify({nombre:nombre,descripcion:descripcion});
  try {
    if(editDisciplinaId){
      await apiRequest('/disciplinas/'+editDisciplinaId,{method:'PUT',body:body});
      adminToast('Disciplina actualizada','ok');
    } else {
      await apiRequest('/disciplinas',{method:'POST',body:body});
      adminToast('Disciplina creada','ok');
    }
    closeAModal('modalDisciplina');
    renderDisciplinas();
  } catch(e) {
    adminToast(e.message||'Error al guardar disciplina','err');
  }
}

async function toggleDisciplina(id){
  var d=adminDisciplinasCache.find(function(x){return x.id===id;});
  if(!d)return;
  try {
    await apiRequest('/disciplinas/'+id+'/estado',{method:'PATCH',body:JSON.stringify({activo:!d.activo})});
    adminToast('Disciplina '+(d.activo?'desactivada':'activada'),'info');
    renderDisciplinas();
  } catch(e) {
    adminToast(e.message||'Error al cambiar estado','err');
  }
}

async function deleteDisciplina(id){
  if(!confirm('¿Eliminar esta disciplina?'))return;
  try {
    await apiRequest('/disciplinas/'+id,{method:'DELETE'});
    adminToast('Disciplina eliminada','ok');
    renderDisciplinas();
  } catch(e) {
    // El 409 por uso llega con el mensaje del servidor (indica cuántos bloques y sugiere desactivar)
    adminToast(e.message||'Error al eliminar disciplina','err');
  }
}
