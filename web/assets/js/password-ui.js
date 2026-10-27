// ══ REGLA E INDICADOR DE CONTRASEÑA (registro y Mi cuenta) ══
// Misma regla que el servidor (backend/src/utils/password.js): 10 a 72 caracteres,
// una minúscula, una mayúscula y un número. El servidor siempre vuelve a validar.
function pwRe(unicode,respaldo){
  try{return new RegExp(unicode,'u');}catch(e){return new RegExp(respaldo);}
}
var PW_MIN=pwRe('\\p{Ll}','[a-zà-ÿ]');
var PW_MAY=pwRe('\\p{Lu}','[A-ZÀ-ß]');
var PW_REGLAS=[
  {txt:'10 caracteres o más',ok:function(p){return p.length>=10;}},
  {txt:'Una letra minúscula',ok:function(p){return PW_MIN.test(p);}},
  {txt:'Una letra mayúscula',ok:function(p){return PW_MAY.test(p);}},
  {txt:'Un número',ok:function(p){return /\d/.test(p);}}
];

// Largo en bytes UTF-8 (bcrypt solo usa los primeros 72)
function pwBytes(p){return unescape(encodeURIComponent(p)).length;}

// Devuelve '' si la contraseña cumple, o el mensaje de error (mismos textos que el servidor).
function pwError(p){
  if(!p)return 'La contraseña es obligatoria';
  if(pwBytes(p)>72)return 'La contraseña no puede superar 72 caracteres';
  if(p.length<10)return 'La contraseña debe tener al menos 10 caracteres';
  if(!PW_MIN.test(p))return 'La contraseña debe incluir una letra minúscula';
  if(!PW_MAY.test(p))return 'La contraseña debe incluir una letra mayúscula';
  if(!/\d/.test(p))return 'La contraseña debe incluir un número';
  return '';
}

// Pinta el indicador (barra de 4 tramos + lista de requisitos) dentro de boxId según el valor de inputId.
function pwActualizar(inputId,boxId){
  var p=document.getElementById(inputId).value;
  var box=document.getElementById(boxId);
  if(!box)return;
  var cumple=PW_REGLAS.map(function(r){return r.ok(p);});
  var n=cumple.filter(Boolean).length;
  var ok=n===PW_REGLAS.length&&pwBytes(p)<=72;
  var barra='';
  for(var i=0;i<PW_REGLAS.length;i++)barra+='<i'+(i<n?' class="on"':'')+'></i>';
  var lista=PW_REGLAS.map(function(r,i){return '<li class="'+(cumple[i]?'ok':'')+'">'+r.txt+'</li>';}).join('');
  box.className='pw-meter lv'+(p?(ok?'ok':n<=1?'1':'2'):'0');
  box.innerHTML='<div class="pw-bar">'+barra+'</div><ul class="pw-list">'+lista+'</ul>';
}
