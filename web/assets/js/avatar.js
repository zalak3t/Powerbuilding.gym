// ══ AVATARES (panel admin) ══
// Cada fila de las tablas pinta el círculo con iniciales y, después de renderizar, hidratarAvatares()
// pide TODAS las miniaturas faltantes en una sola consulta (GET /avatares?ids=...) y las reemplaza.
var avatarCache={};      // cliente_id -> data URI, o null si no tiene foto
var avatarCacheTs=0;     // el caché se renueva cada minuto para ver fotos cambiadas
var AVATAR_MAX_IDS=300;  // límite del servidor por consulta

// Círculo con iniciales (o la foto, si ya está en caché). px = diámetro, fontPx = tamaño de las iniciales.
function avatarHtml(clienteId,nombre,px,fontPx){
  var id=parseInt(clienteId,10);
  var uri=avatarCache[id];
  return '<div class="av" data-av="'+id+'" style="width:'+px+'px;height:'+px+'px;font-size:'+fontPx+'px;background:'+getAvatarColor(id)+'">'
    +(uri?'<img src="'+esc(uri)+'" alt=""/>':esc(getInitials(nombre)))+'</div>';
}

// Completa los avatares con foto dentro de root (por defecto, todo el documento). Nunca lanza: es cosmético.
async function hidratarAvatares(root){
  try{
    root=root||document;
    if(Date.now()-avatarCacheTs>60000){avatarCache={};avatarCacheTs=Date.now();}
    var nodos=root.querySelectorAll('[data-av]');
    var faltan=[];
    nodos.forEach(function(n){
      var id=parseInt(n.getAttribute('data-av'),10);
      if(id&&avatarCache[id]===undefined&&faltan.indexOf(id)<0)faltan.push(id);
    });
    for(var i=0;i<faltan.length;i+=AVATAR_MAX_IDS){
      var lote=faltan.slice(i,i+AVATAR_MAX_IDS);
      var data=await apiRequest('/avatares?ids='+lote.join(','));
      var mapa=data.avatares||{};
      lote.forEach(function(id){avatarCache[id]=mapa[id]||null;});
    }
    nodos.forEach(function(n){
      var uri=avatarCache[parseInt(n.getAttribute('data-av'),10)];
      if(uri&&!n.querySelector('img'))n.innerHTML='<img src="'+esc(uri)+'" alt=""/>';
    });
  }catch(e){ /* sin foto: se quedan las iniciales */ }
}
