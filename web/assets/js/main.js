// == ESTADO DE INTERFAZ ==
var curUser=null;
var charts={};
var sidebarExpanded=false;


// Nav scroll highlight
var secs=document.querySelectorAll('section[id]');
var lnks=document.querySelectorAll('.nav-links a');
window.addEventListener('scroll',function(){
  var cur='';
  secs.forEach(function(s){if(window.scrollY>=s.offsetTop-80)cur=s.id;});
  lnks.forEach(function(a){a.style.color=a.getAttribute('href')==='#'+cur?'var(--gold2)':'var(--muted)';});
});
