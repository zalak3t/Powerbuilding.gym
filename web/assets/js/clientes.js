// ══ CLIENTES ══
var clientFilter='';
var editClientId=null;
var adminClientsCache=[];

async function renderClients(filter){
  if(filter!==undefined)clientFilter=filter;
  var search=clientFilter?'?search='+encodeURIComponent(clientFilter):'';
  document.getElementById('clientTable').innerHTML='<tr><td colspan="8" style="color:var(--amuted);padding:1rem">Cargando clientes...</td></tr>';
  try {
    var data=await apiRequest('/clientes'+search);
    adminClientsCache=data.clientes||[];
    var total=adminClientsCache.length;
    document.getElementById('clientCount').textContent=total+' cliente'+(total!==1?'s':'')+(clientFilter?' encontrados':' registrados');
    if(!total){
      document.getElementById('clientTable').innerHTML='<tr><td colspan="8" style="color:var(--amuted);padding:1rem">No hay clientes'+(clientFilter?' con ese criterio':'')+'.</td></tr>';
      return;
    }
    document.getElementById('clientTable').innerHTML=adminClientsCache.map(function(c){
      var ini=getInitials(c.nombre);
      var bg=getAvatarColor(c.id);
      var statusBadge=getClientStatusClass(c);
      return '<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="av" style="background:'+bg+'">'+esc(ini)+'</div><span style="color:var(--atext);font-weight:500">'+esc(c.nombre)+'</span></div></td>'
        +'<td>'+esc(c.email)+'</td><td>'+(esc(c.telefono)||'—')+'</td>'
        +'<td><span class="abadge blue">'+esc(c.reservas)+'</span></td>'
        +'<td><span class="abadge green">'+esc(c.asistencias)+'</span></td>'
        +'<td><span class="abadge '+statusBadge+'">'+esc(c.estado)+'</span></td>'
        +'<td>'+membresiaBadge(c)+(c.vence_el?'<div style="font-size:10px;color:var(--amuted2);margin-top:3px">vence '+esc(formatFechaCL(c.vence_el))+'</div>':'')+'</td>'
        +'<td><div class="abtn-row">'
        +'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openFicha('+c.id+')">Ver ficha</button>'
        +'<button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openEditClient('+c.id+')">Editar</button>'
        +'<button class="abtn '+(c.estado==='bloqueado'?'success':'danger')+'" style="font-size:11px;padding:5px 10px" onclick="toggleBlock_Client('+c.id+')">'+(c.estado==='bloqueado'?'Desbloquear':'Bloquear')+'</button>'
        +'<button class="abtn danger" style="font-size:11px;padding:5px 10px;background:rgba(239,68,68,.2)" onclick="deleteClient('+c.id+')">Eliminar</button>'
        +'</div></td></tr>';
    }).join('');
  } catch(e) {
    document.getElementById('clientTable').innerHTML='<tr><td colspan="8" style="color:var(--red);padding:1rem">Error al cargar clientes.</td></tr>';
    adminToast(e.message||'Error al cargar clientes','err');
  }
}

function filterClients(v){renderClients(v);}

function openAddClient(){
  editClientId=null;
  document.getElementById('modalClientTitle').textContent='Nuevo Cliente';
  ['cName','cEmail','cPhone','cNotes'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('cStatus').value='activo';
  openAModal('modalClient');
}

function openEditClient(id){
  var c=adminClientsCache.find(function(x){return x.id===id;});
  if(!c){adminToast('Cliente no encontrado en caché','err');return;}
  editClientId=id;
  document.getElementById('modalClientTitle').textContent='Editar Cliente';
  document.getElementById('cName').value=c.nombre;
  document.getElementById('cEmail').value=c.email;
  document.getElementById('cPhone').value=c.telefono||'';
  document.getElementById('cNotes').value=c.notas||'';
  document.getElementById('cStatus').value=c.estado;
  openAModal('modalClient');
}

async function saveClient(){
  var nombre=document.getElementById('cName').value.trim();
  var email=document.getElementById('cEmail').value.trim();
  var telefono=document.getElementById('cPhone').value.trim();
  var notas=document.getElementById('cNotes').value.trim();
  var estado=document.getElementById('cStatus').value;
  if(!nombre||!email){adminToast('Nombre y email son obligatorios','err');return;}
  var body=JSON.stringify({nombre:nombre,email:email,telefono:telefono,notas:notas,estado:estado});
  try {
    if(editClientId){
      await apiRequest('/clientes/'+editClientId,{method:'PUT',body:body});
      adminToast('Cliente actualizado','ok');
    } else {
      await apiRequest('/clientes',{method:'POST',body:body});
      adminToast('Cliente creado','ok');
    }
    closeAModal('modalClient');
    renderClients(clientFilter);
  } catch(e) {
    adminToast(e.message||'Error al guardar cliente','err');
  }
}

async function toggleBlock_Client(id){
  var c=adminClientsCache.find(function(x){return x.id===id;});
  if(!c)return;
  var nuevoEstado=c.estado==='activo'?'bloqueado':'activo';
  try {
    await apiRequest('/clientes/'+id+'/estado',{method:'PATCH',body:JSON.stringify({estado:nuevoEstado})});
    adminToast('Acceso '+(nuevoEstado==='bloqueado'?'bloqueado':'restaurado'),(nuevoEstado==='bloqueado'?'err':'ok'));
    renderClients(clientFilter);
  } catch(e) {
    adminToast(e.message||'Error al cambiar estado','err');
  }
}

async function deleteClient(id){
  if(!confirm('¿Eliminar este cliente? También se eliminarán sus reservas y asistencias asociadas.'))return;
  try {
    await apiRequest('/clientes/'+id,{method:'DELETE'});
    adminToast('Cliente eliminado','ok');
    renderClients(clientFilter);
  } catch(e) {
    adminToast(e.message||'Error al eliminar cliente','err');
  }
}

async function openFicha(id){
  try {
    var data=await apiRequest('/clientes/'+id);
    var cliente=data.cliente;
    var ini=getInitials(cliente.nombre);
    var bg=getAvatarColor(cliente.id);
    var attPct=cliente.reservas>0?Math.round(cliente.asistencias/cliente.reservas*100):0;
    var statusBadge=getClientStatusClass(cliente);
    var bloques=cliente.bloques_reservados||[];
    var html='<div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem">'
      +'<div class="av" style="width:52px;height:52px;background:'+bg+';font-size:18px">'+esc(ini)+'</div>'
      +'<div><div style="font-size:17px;font-weight:700;color:var(--atext)">'+esc(cliente.nombre)+'</div>'
      +'<div style="font-size:12px;color:var(--amuted2);margin-top:2px">'+esc(cliente.email)+' · '+(esc(cliente.telefono)||'—')+'</div>'
      +'<span class="abadge '+statusBadge+'" style="margin-top:6px">'+esc(cliente.estado)+'</span></div></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:1.25rem">'
      +'<div style="background:var(--abg3);border-radius:10px;padding:.75rem;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--blue)">'+esc(cliente.reservas)+'</div><div style="font-size:10px;color:var(--amuted2);margin-top:2px;text-transform:uppercase">Reservas</div></div>'
      +'<div style="background:var(--abg3);border-radius:10px;padding:.75rem;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--gren)">'+esc(cliente.asistencias)+'</div><div style="font-size:10px;color:var(--amuted2);margin-top:2px;text-transform:uppercase">Asistencias</div></div>'
      +'<div style="background:var(--abg3);border-radius:10px;padding:.75rem;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--amber)">'+attPct+'%</div><div style="font-size:10px;color:var(--amuted2);margin-top:2px;text-transform:uppercase">Tasa</div></div>'
      +'</div>';
    if(cliente.notas)html+='<div style="background:var(--amber-dim);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:.875rem;margin-bottom:1rem;font-size:13px;color:var(--amber)">📝 '+esc(cliente.notas)+'</div>';
    var pagos=cliente.pagos||[];
    html+='<div style="background:var(--abg3);border-radius:10px;padding:.75rem;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">'
      +'<div><div style="font-size:10px;color:var(--amuted2);text-transform:uppercase;letter-spacing:.06em">Membresía</div>'
      +'<div style="font-size:13px;color:var(--atext);margin-top:3px">'+(cliente.vence_el?'Vence el '+esc(formatFechaCL(cliente.vence_el)):'Sin plan registrado')+'</div></div>'
      +membresiaBadge(cliente)+'</div>';
    html+='<div style="font-size:10px;color:var(--amuted2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Bloques reservados ('+bloques.length+')</div>';
    html+=bloques.slice(0,5).map(function(br){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--aborder)">'
        +'<span style="font-size:13px;color:var(--atext)">'+esc(br.dia)+' '+esc(br.horario)+'</span>'
        +'<span class="abadge '+(br.asistio?'green':'blue')+'">'+(br.asistio?'Asistió':'Reservado')+'</span></div>';
    }).join('');
    html+='<div style="font-size:10px;color:var(--amuted2);text-transform:uppercase;letter-spacing:.06em;margin:1rem 0 .5rem">Historial de pagos ('+pagos.length+')</div>';
    if(!pagos.length)html+='<div style="font-size:12px;color:var(--amuted)">Sin pagos registrados.</div>';
    html+=pagos.slice(0,5).map(function(pg){
      var anulado=pg.estado==='anulado';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--aborder)'+(anulado?';opacity:.55':'')+'">'
        +'<div style="min-width:0"><div style="font-size:13px;color:var(--atext)">'+esc(pg.plan_nombre)+' · '+esc(formatCLP(pg.monto))+'</div>'
        +'<div style="font-size:11px;color:var(--amuted2)">'+esc(formatFechaCL(pg.periodo_desde))+' → '+esc(formatFechaCL(pg.periodo_hasta))+' · '+esc(pg.metodo)+'</div></div>'
        +'<span class="abadge '+(anulado?'muted':'green')+'">'+esc(pg.estado)+'</span></div>';
    }).join('');
    if(pagos.length>5)html+='<div style="font-size:11px;color:var(--amuted2);padding-top:6px">y '+(pagos.length-5)+' más en la sección Pagos.</div>';
    html+='<div style="margin-top:1rem;display:flex;gap:8px;flex-wrap:wrap">'
      +'<a href="https://wa.me/'+(cliente.telefono||'').replace(/\D/g,'')+'" target="_blank" class="abtn success" style="text-decoration:none;font-size:12px">💬 WhatsApp</a>'
      +'<button class="abtn ghost" onclick="openEditClient('+cliente.id+');closeAModal(\'modalFicha\')">Editar ficha</button>'
      +'<button class="abtn '+(cliente.estado==='bloqueado'?'success':'danger')+'" onclick="closeAModal(\'modalFicha\');toggleBlock_Client('+cliente.id+')">'+(cliente.estado==='bloqueado'?'Desbloquear':'Bloquear acceso')+'</button>'
      +'<button class="abtn danger" style="background:rgba(239,68,68,.2)" onclick="closeAModal(\'modalFicha\');deleteClient('+cliente.id+')">Eliminar</button>'
      +'</div>';
    document.getElementById('fichaContent').innerHTML=html;
    openAModal('modalFicha');
  } catch(e) {
    adminToast(e.message||'Error al cargar ficha','err');
  }
}
