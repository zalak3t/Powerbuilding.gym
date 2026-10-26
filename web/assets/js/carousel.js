// ══ CAROUSEL ══
var ci=0;
var slides=document.querySelectorAll('.slide');
var ctrack=document.getElementById('ctrack');
var cdotsEl=document.getElementById('cdots');
var cauto=null;
slides.forEach(function(_,i){
  var d=document.createElement('div');
  d.className='dot'+(i===0?' active':'');
  d.onclick=function(){goSlide(i);};
  cdotsEl.appendChild(d);
});
function startAuto(){clearInterval(cauto);cauto=setInterval(function(){move(1);},5000);}
function goSlide(n){ci=(n+slides.length)%slides.length;ctrack.style.transform='translateX(-'+ci*100+'%)';document.querySelectorAll('.dot').forEach(function(d,i){d.className='dot'+(i===ci?' active':'');});startAuto();}
function move(dir){goSlide(ci+dir);}
startAuto();

// Swipe táctil: izquierda = siguiente, derecha = anterior (ignora gestos mayormente verticales)
var cCarousel=document.getElementById('top');
var tx=0,ty=0;
cCarousel.addEventListener('touchstart',function(e){
  tx=e.touches[0].clientX;ty=e.touches[0].clientY;
  clearInterval(cauto);
},{passive:true});
cCarousel.addEventListener('touchend',function(e){
  var t=e.changedTouches[0];
  var dx=t.clientX-tx,dy=t.clientY-ty;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){move(dx<0?1:-1);}else{startAuto();}
},{passive:true});
cCarousel.addEventListener('touchcancel',startAuto,{passive:true});
