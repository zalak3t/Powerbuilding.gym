// ══ BLOQUES ══
var editBlockId=null;
var blockActiveDay='Lunes';
var adminBlocksCache=[];

async function renderBlocksPage(){
  renderDayTabs('blockDayTabs',blockActiveDay,'day-tab-a','setBlockDay');
  var grid=document.getElementById('blockGrid');
  grid.innerHTML='<p style="color:var(--muted);padding:1rem">Cargando bloques...</p>';
  try {
    var data=await apiRequest('/bloques/admin?dia='+encodeURIComponent(blockActiveDay));
    adminBlocksCache=data.bloques;
    if(!adminBlocksCache.length){
      grid.innerHTML='<p style="color:var(--muted);padding:1rem">No hay bloques para este día.</p>';
      return;
    }
    grid.innerHTML=adminBlocksCache.map(function(b){
      var pct=getBlockOccupancyPercent(b);
      var barColor=pct>=100?'var(--red)':pct>=75?'var(--amber)':'var(--blue)';
      return '<div class="block-card'+(isBlockSuspended(b)?' suspended':'')+'">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">'
        +'<div class="block-time">'+esc(b.horario)+'</div><span class="abadge '+(b.estado==='activo'?'blue':'amber')+'">'+esc(b.estado)+'</span></div>'
        +'<div class="block-day">'+esc(b.dia)+' · Cap. '+esc(b.capacidad)+'</div>'
        +(b.disciplina_nombre||b.instructor_nombre?'<div style="font-size:11px;color:var(--amuted2);margin-bottom:6px">'+(b.disciplina_nombre?'🏋️ '+esc(b.disciplina_nombre):'')+(b.disciplina_nombre&&b.instructor_nombre?' · ':'')+(b.instructor_nombre?'👤 '+esc(b.instructor_nombre):'')+'</div>':'')
        +(b.mensaje?'<div style="font-size:11px;color:var(--amber);margin-bottom:6px">⚠️ '+esc(b.mensaje)+'</div>':'')
        +'<div class="block-bar-bg"><div class="block-bar-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
        +'<div class="block-foot"><span class="block-slots">'+esc(b.inscritos)+'/'+esc(b.capacidad)+' · '+pct+'%</span>'
        +'<div class="block-actions">'
        +'<button class="icon-btn edit" onclick="openEditBlock('+b.id+')" title="Editar">✏️</button>'
        +'<button class="icon-btn suspend" onclick="toggleBlockStatus('+b.id+')" title="'+(b.estado==='activo'?'Suspender':'Activar')+'">'+(b.estado==='activo'?'⏸':'▶️')+'</button>'
        +'<button class="icon-btn del" onclick="deleteBlock('+b.id+')" title="Eliminar">🗑️</button>'
        +'</div></div></div>';
    }).join('');
  } catch(e) {
    grid.innerHTML='<p style="color:var(--red);padding:1rem">Error al cargar bloques.</p>';
    adminToast(e.message||'Error al cargar bloques','err');
  }
}

function setBlockDay(d){blockActiveDay=d;renderBlocksPage();}

// Rellena los selects de disciplina/instructor con los activos (más el ya asignado al bloque, si está inactivo)
var blockOptionsLoaded=false;
async function loadBlockOptions(sel){
  blockOptionsLoaded=false;
  var fill=function(id,items,current){
    var el=document.getElementById(id);
    var html='<option value="">Sin asignar</option>'+items.filter(function(x){return x.activo||x.id===current;}).map(function(x){
      return '<option value="'+x.id+'">'+esc(x.nombre)+(x.activo?'':' (inactivo)')+'</option>';
    }).join('');
    el.innerHTML=html;
    el.value=current?String(current):'';
  };
  try {
    var d=await apiRequest('/disciplinas');
    var i=await apiRequest('/instructores');
    fill('bDisc',d.disciplinas||[],sel.disciplina_id);
    fill('bInst',i.instructores||[],sel.instructor_id);
    blockOptionsLoaded=true;
  } catch(e) {
    adminToast(e.message||'No se pudieron cargar disciplinas e instructores','err');
  }
}

function openAddBlock(){
  editBlockId=null;
  document.getElementById('modalBlockTitle').textContent='Nuevo Bloque';
  document.getElementById('bDay').value='Lunes';
  document.getElementById('bTime').value='';
  document.getElementById('bCap').value='12';
  document.getElementById('bStatus').value='activo';
  document.getElementById('bMsg').value='';
  loadBlockOptions({});
  openAModal('modalBlock');
}

function openEditBlock(id){
  var b=adminBlocksCache.find(function(x){return x.id===id;});
  if(!b)return;
  editBlockId=id;
  document.getElementById('modalBlockTitle').textContent='Editar Bloque';
  document.getElementById('bDay').value=b.dia;
  document.getElementById('bTime').value=b.horario;
  document.getElementById('bCap').value=b.capacidad;
  document.getElementById('bStatus').value=b.estado;
  document.getElementById('bMsg').value=b.mensaje||'';
  loadBlockOptions(b);
  openAModal('modalBlock');
}

async function saveBlock(){
  var dia=document.getElementById('bDay').value;
  var horario=document.getElementById('bTime').value.trim();
  var capacidad=parseInt(document.getElementById('bCap').value)||12;
  var estado=document.getElementById('bStatus').value;
  var mensaje=document.getElementById('bMsg').value.trim();
  if(!horario){adminToast('Ingresa el horario','err');return;}
  var data={dia:dia,horario:horario,capacidad:capacidad,estado:estado,mensaje:mensaje};
  // Si las opciones no cargaron, no se envían: el servidor conserva disciplina/instructor actuales
  if(blockOptionsLoaded){
    var disciplina_id=document.getElementById('bDisc').value;
    var instructor_id=document.getElementById('bInst').value;
    data.disciplina_id=disciplina_id?parseInt(disciplina_id,10):null;
    data.instructor_id=instructor_id?parseInt(instructor_id,10):null;
  }
  var body=JSON.stringify(data);
  try {
    if(editBlockId){
      await apiRequest('/bloques/'+editBlockId,{method:'PUT',body:body});
      adminToast('Bloque actualizado','ok');
    } else {
      await apiRequest('/bloques',{method:'POST',body:body});
      adminToast('Bloque creado','ok');
    }
    closeAModal('modalBlock');
    renderBlocksPage();
  } catch(e) {
    adminToast(e.message||'Error al guardar bloque','err');
  }
}

async function toggleBlockStatus(id){
  var b=adminBlocksCache.find(function(x){return x.id===id;});
  if(!b)return;
  var nuevoEstado=b.estado==='activo'?'suspendido':'activo';
  var mensaje=nuevoEstado==='suspendido'?'Bloque suspendido temporalmente':'';
  try {
    await apiRequest('/bloques/'+id+'/estado',{method:'PATCH',body:JSON.stringify({estado:nuevoEstado,mensaje:mensaje})});
    adminToast('Bloque '+(nuevoEstado==='activo'?'activado':'suspendido'),'info');
    renderBlocksPage();
  } catch(e) {
    adminToast(e.message||'Error al cambiar estado','err');
  }
}

async function deleteBlock(id){
  if(!confirm('¿Eliminar este bloque? También se eliminarán las reservas y asistencias asociadas.'))return;
  try {
    await apiRequest('/bloques/'+id,{method:'DELETE'});
    adminToast('Bloque eliminado','ok');
    renderBlocksPage();
  } catch(e) {
    adminToast(e.message||'Error al eliminar bloque','err');
  }
}
