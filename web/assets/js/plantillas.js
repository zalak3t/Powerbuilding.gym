// ══ PLANTILLAS ══
var editPlantillaId=null;
var adminPlantillasCache=[];
var plantillaVariables={};

async function renderPlantillas(){
  var tbody=document.getElementById('plantillaTable');
  tbody.innerHTML='<tr><td colspan="4" style="color:var(--amuted);padding:1rem">Cargando plantillas...</td></tr>';
  try {
    var data=await apiRequest('/plantillas');
    adminPlantillasCache=data.plantillas||[];
    plantillaVariables=data.variables||{};
    paintPlantillas();
  } catch(e) {
    tbody.innerHTML='<tr><td colspan="4" style="color:var(--red);padding:1rem">Error al cargar plantillas.</td></tr>';
    adminToast(e.message||'Error al cargar plantillas','err');
  }
}

function paintPlantillas(){
  var tbody=document.getElementById('plantillaTable');
  if(!adminPlantillasCache.length){
    tbody.innerHTML='<tr><td colspan="4" style="color:var(--amuted);padding:1rem">No hay plantillas.</td></tr>';
    return;
  }
  tbody.innerHTML=adminPlantillasCache.map(function(p){
    return '<tr><td style="color:var(--atext);font-weight:500">'+esc(p.nombre)+'</td>'
      +'<td>'+esc(p.asunto)+'</td>'
      +'<td><span class="abadge '+(p.activo?'green':'amber')+'">'+(p.activo?'activa':'inactiva')+'</span></td>'
      +'<td><div class="abtn-row"><button class="abtn ghost" style="font-size:11px;padding:5px 10px" onclick="openEditPlantilla('+p.id+')">Editar</button></div></td></tr>';
  }).join('');
}

function updatePlantillaCount(){
  var n=document.getElementById('ptCuerpo').value.length;
  document.getElementById('ptCount').textContent='('+n+'/2000)';
}

function openEditPlantilla(id){
  var p=adminPlantillasCache.find(function(x){return x.id===id;});
  if(!p){adminToast('Plantilla no encontrada en caché','err');return;}
  editPlantillaId=id;
  document.getElementById('modalPlantillaTitle').textContent='Editar: '+p.nombre;
  document.getElementById('ptAsunto').value=p.asunto;
  document.getElementById('ptCuerpo').value=p.cuerpo;
  document.getElementById('ptActivo').value=p.activo?'true':'false';
  document.getElementById('ptVars').innerHTML=Object.keys(plantillaVariables).map(function(k){
    return '<div><code style="color:var(--blue)">{{'+esc(k)+'}}</code> — '+esc(plantillaVariables[k])+'</div>';
  }).join('');
  document.getElementById('ptPreview').style.display='none';
  updatePlantillaCount();
  openAModal('modalPlantilla');
}

// Vista previa con el texto actual del formulario (sin guardar). Se muestra con textContent (sin HTML).
async function previewPlantilla(){
  if(!editPlantillaId)return;
  try {
    var data=await apiRequest('/plantillas/'+editPlantillaId+'/preview',{method:'POST',body:JSON.stringify({
      asunto:document.getElementById('ptAsunto').value,
      cuerpo:document.getElementById('ptCuerpo').value
    })});
    document.getElementById('ptPreviewAsunto').textContent=data.preview.asunto;
    document.getElementById('ptPreviewCuerpo').textContent=data.preview.cuerpo;
    document.getElementById('ptPreview').style.display='block';
  } catch(e) {
    adminToast(e.message||'Error al generar vista previa','err');
  }
}

async function savePlantilla(){
  if(!editPlantillaId)return;
  var asunto=document.getElementById('ptAsunto').value.trim();
  var cuerpo=document.getElementById('ptCuerpo').value.trim();
  if(!asunto){adminToast('El asunto es obligatorio','err');return;}
  if(!cuerpo){adminToast('El cuerpo es obligatorio','err');return;}
  try {
    await apiRequest('/plantillas/'+editPlantillaId,{method:'PUT',body:JSON.stringify({
      asunto:asunto,
      cuerpo:cuerpo,
      activo:document.getElementById('ptActivo').value==='true'
    })});
    adminToast('Plantilla actualizada','ok');
    closeAModal('modalPlantilla');
    renderPlantillas();
  } catch(e) {
    adminToast(e.message||'Error al guardar plantilla','err');
  }
}
