// ══ CAROUSEL ══
var ci=0;
var slides=document.querySelectorAll('.slide');
var ctrack=document.getElementById('ctrack');
var cdotsEl=document.getElementById('cdots');
slides.forEach(function(_,i){
  var d=document.createElement('div');
  d.className='dot'+(i===0?' active':'');
  d.onclick=function(){goSlide(i);};
  cdotsEl.appendChild(d);
});
function goSlide(n){ci=(n+slides.length)%slides.length;ctrack.style.transform='translateX(-'+ci*100+'%)';document.querySelectorAll('.dot').forEach(function(d,i){d.className='dot'+(i===ci?' active':'');});}
function move(dir){goSlide(ci+dir);}
setInterval(function(){move(1);},5000);
