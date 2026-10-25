// ══ USUARIOS ADMINISTRADORES ══
var adminFilter='';
var editAdminId=null;
var adminAdminsCache=[];

function isSelfAdmin(a){return !!(curUser&&curUser.id===a.id);}

async function renderAdmins(){
  var tbody=document.getElementById('adminTable');
  tbody.innerHTML='<tr><td colspan="5" style="color:var(--amuted);padding:1rem">Cargando administradores...</td></tr>';
  try {
    var data=await apiRequest('/admins');
    adminAdminsCache=data.admins||[];
    paintAdmins();
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="5" style="color:var(--red);padding:1rem">Error al cargar administradores.</td></tr>';
    adminToast(e.message||'Error al cargar administradores','err');
  }
}

function paintAdmins(){
  var q=adminFilter.toLowerCase();
  var list=adminAdminsCache.filter(function(a){
    return !q||a.nombre.toLowerCase().indexOf(q)>-1||a.email.toLowerCase().indexOf(q)>-1;
  });
  var total=adminAdminsCache.length;
  document.getElementById('adminCount').textContent=total+' administrador'+(total!==1?'es':'')+' registrado'+(total!==1?'s':'');
  var tbody=document.getElementById('adminTable');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="5" style="color:var(--amuted);padding:1rem">No hay administradores'+(q?' con ese criterio':'')+'.</td></tr>';
    return;
  }
  tbody.innerHTML=list.map(function(a){
    var self=isSelfAdmin(a);
    return '<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="av" style="background:'+getAvatarColor(a.id)+'">'+esc(getInitials(a.nombre))+'</div><span style="color:var(--atext);font-weight:500">'+esc(a.nombre)+(self?' (tú)':'')+'</span></div></td>'
      +'<td>'+esc(a.email)+'</td><td>'+(esc(a.telefono)||'—')+'</td>'
      +'<td><span class="abadge '+(a.activo?'green':'amber')+'">'+(a.activo?'activo':'inactivo')+'</span></td>'
      +'<td><div class="abtn-row">'
      +'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openEditAdmin('+a.id+')">Editar</button>'
      +(self?'':'<button class="abtn '+(a.activo?'danger':'success')+'" style="font-size:11px;padding:5px 10px" onclick="toggleAdmin('+a.id+')">'+(a.activo?'Desactivar':'Activar')+'</button>'
      +'<button class="abtn danger" style="font-size:11px;padding:5px 10px;background:rgba(239,68,68,.2)" onclick="deleteAdmin('+a.id+')">Eliminar</button>')
      +'</div></td></tr>';
  }).join('');
}

function filterAdmins(v){adminFilter=v||'';paintAdmins();}

function openAddAdmin(){
  editAdminId=null;
  document.getElementById('modalAdminTitle').textContent='Nuevo Administrador';
  ['aName','aEmail','aPhone','aPass'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('aPassLabel').textContent='Contraseña (mín. 8 caracteres)';
  document.getElementById('aStatus').value='true';
  document.getElementById('aStatusWrap').style.display='none';
  openAModal('modalAdmin');
}

function openEditAdmin(id){
  var a=adminAdminsCache.find(function(x){return x.id===id;});
  if(!a){adminToast('Administrador no encontrado en caché','err');return;}
  editAdminId=id;
  document.getElementById('modalAdminTitle').textContent='Editar Administrador';
  document.getElementById('aName').value=a.nombre;
  document.getElementById('aEmail').value=a.email;
  document.getElementById('aPhone').value=a.telefono||'';
  document.getElementById('aPass').value='';
  document.getElementById('aPassLabel').textContent='Nueva contraseña (dejar en blanco para no cambiarla)';
  document.getElementById('aStatus').value=a.activo?'true':'false';
  document.getElementById('aStatusWrap').style.display=isSelfAdmin(a)?'none':'';
  openAModal('modalAdmin');
}

async function saveAdmin(){
  var nombre=document.getElementById('aName').value.trim();
  var email=document.getElementById('aEmail').value.trim();
  var telefono=document.getElementById('aPhone').value.trim();
  var password=document.getElementById('aPass').value;
  if(!nombre||!email){adminToast('Nombre y email son obligatorios','err');return;}
  if(!editAdminId&&!password){adminToast('La contraseña es obligatoria','err');return;}
  if(password&&password.length<8){adminToast('La contraseña debe tener al menos 8 caracteres','err');return;}
  var data={nombre:nombre,email:email,telefono:telefono};
  if(password)data.password=password;
  try {
    if(editAdminId){
      var cur=adminAdminsCache.find(function(x){return x.id===editAdminId;});
      if(!(cur&&isSelfAdmin(cur)))data.activo=document.getElementById('aStatus').value==='true';
      await apiRequest('/admins/'+editAdminId,{method:'PUT',body:JSON.stringify(data)});
      adminToast('Administrador actualizado','ok');
    } else {
      await apiRequest('/admins',{method:'POST',body:JSON.stringify(data)});
      adminToast('Administrador creado','ok');
    }
    document.getElementById('aPass').value='';
    closeAModal('modalAdmin');
    renderAdmins();
  } catch(e) {
    adminToast(e.message||'Error al guardar administrador','err');
  }
}

async function toggleAdmin(id){
  var a=adminAdminsCache.find(function(x){return x.id===id;});
  if(!a)return;
  var body=JSON.stringify({nombre:a.nombre,email:a.email,telefono:a.telefono||'',activo:!a.activo});
  try {
    await apiRequest('/admins/'+id,{method:'PUT',body:body});
    adminToast('Administrador '+(a.activo?'desactivado':'activado'),'info');
    renderAdmins();
  } catch(e) {
    adminToast(e.message||'Error al cambiar estado','err');
  }
}

async function deleteAdmin(id){
  if(!confirm('¿Eliminar este administrador? Esta acción no se puede deshacer.'))return;
  try {
    await apiRequest('/admins/'+id,{method:'DELETE'});
    adminToast('Administrador eliminado','ok');
    renderAdmins();
  } catch(e) {
    // Los 409 (cuenta propia, último admin, cliente vinculado) llegan con el mensaje del servidor
    adminToast(e.message||'Error al eliminar administrador','err');
  }
}
