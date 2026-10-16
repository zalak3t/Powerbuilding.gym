// ══ TOASTS ══
function lndToast(msg,type){
  var t=document.getElementById('lndToast');
  t.textContent=msg; t.className='lnd-toast '+(type||'ok')+' show';
  setTimeout(function(){t.className='lnd-toast';},2700);
}
function adminToast(msg,type){
  type=type||'info';
  var w=document.getElementById('toastWrap');
  var t=document.createElement('div');
  t.className='ltoast';
  t.textContent=msg;
  w.appendChild(t);
  requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show',type);});});
  setTimeout(function(){t.classList.remove('show');setTimeout(function(){if(w.contains(t))w.removeChild(t);},350);},2800);
}
