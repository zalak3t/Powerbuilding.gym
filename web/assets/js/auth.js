// ══ AUTH ══
function openAuth(){document.getElementById('authOverlay').classList.add('show');}
function closeAuth(){document.getElementById('authOverlay').classList.remove('show');}
function switchTab(tab){
  document.getElementById('fLogin').style.display=tab==='login'?'block':'none';
  document.getElementById('fReg').style.display=tab==='reg'?'block':'none';
  document.getElementById('fForgot').style.display=tab==='forgot'?'block':'none';
  document.getElementById('tabsAuth').style.display=tab==='forgot'?'none':'flex';
  document.getElementById('tabLogin').className='tab-auth'+(tab==='login'?' active':'');
  document.getElementById('tabReg').className='tab-auth'+(tab==='reg'?' active':'');
  document.getElementById('lErr').classList.remove('show');
  document.getElementById('rErr').classList.remove('show');
  document.getElementById('rOk').classList.remove('show');
  document.getElementById('rConsent').checked=false;
  document.getElementById('fErr').classList.remove('show');
  document.getElementById('fOk').classList.remove('show');
  if(tab==='forgot'){
    // Reutiliza el correo ya escrito en el login para ahorrar un paso
    var le=document.getElementById('lEmail').value.trim();
    if(le&&!document.getElementById('fEmail').value)document.getElementById('fEmail').value=le;
    document.getElementById('fBtn').disabled=false;
  }
}

// Recuperación de contraseña: el servidor responde siempre lo mismo (exista o no la cuenta).
async function doRecuperar(){
  var email=document.getElementById('fEmail').value.trim().toLowerCase();
  var err=document.getElementById('fErr'),ok=document.getElementById('fOk'),btn=document.getElementById('fBtn');
  err.classList.remove('show');ok.classList.remove('show');
  if(!email||email.indexOf('@')<1){err.textContent='Ingresa un correo válido';err.classList.add('show');return;}
  btn.disabled=true;
  try{
    var r=await apiRequest('/auth/recuperar',{method:'POST',body:JSON.stringify({email:email})});
    ok.textContent=r.message||'Si el correo está registrado, te enviamos un enlace.';ok.classList.add('show');
  }catch(e){
    err.textContent=e.message||'No se pudo enviar. Intenta nuevamente.';err.classList.add('show');
    btn.disabled=false;
  }
}

async function doRegister(){
  var name=document.getElementById('rName').value.trim();
  var email=document.getElementById('rEmail').value.trim().toLowerCase();
  var phone=document.getElementById('rPhone').value.trim();
  var pass=document.getElementById('rPass').value;
  var err=document.getElementById('rErr'),ok=document.getElementById('rOk');
  err.classList.remove('show'); ok.classList.remove('show');
  if(!name||!email||!pass){err.textContent='Completa todos los campos obligatorios';err.classList.add('show');return;}
  var passErr=pwError(pass);
  if(passErr){err.textContent=passErr;err.classList.add('show');return;}
  if(!document.getElementById('rConsent').checked){err.textContent='Debes aceptar la política de privacidad';err.classList.add('show');return;}
  try {
    var resp=await apiRequest('/auth/register',{method:'POST',body:JSON.stringify({nombre:name,email:email,telefono:phone,password:pass})});
    if(resp.pendiente_verificacion){
      // El correo ya tenía ficha en el gimnasio: la cuenta se activa al confirmar el enlace enviado.
      ok.textContent=resp.message;ok.classList.add('show');
      return;
    }
    ok.textContent='¡Cuenta creada! Inicia sesión.';ok.classList.add('show');
    setTimeout(function(){switchTab('login');},1400);
  } catch(e) {
    err.textContent=e.message||'Error al registrar';err.classList.add('show');
  }
}

async function doLogin(){
  var email=document.getElementById('lEmail').value.trim().toLowerCase();
  var pass=document.getElementById('lPass').value;
  var err=document.getElementById('lErr');
  err.classList.remove('show');
  try {
    var data=await apiRequest('/auth/login',{method:'POST',body:JSON.stringify({email:email,password:pass})});
    setToken(data.token);
    curUser=data.user;
    closeAuth();
    if(curUser.rol==='admin'){
      showAdminPanel();
    } else {
      updateNav();
      renderLandingBlocks();
      lndToast('¡Bienvenido, '+curUser.nombre.split(' ')[0]+'! 💪');
    }
  } catch(e) {
    err.textContent=e.message||'Email o contraseña incorrectos';err.classList.add('show');
  }
}

function showAdminPanel(){
  document.getElementById('landing').style.display='none';
  document.getElementById('adminApp').classList.add('show');
  initAdmin();
}

// Admin: vuelve a la landing sin cerrar sesión (el token se conserva)
function showLanding(){
  document.getElementById('adminApp').classList.remove('show');
  document.getElementById('landing').style.display='block';
  updateNav();
  renderLandingBlocks();
  window.scrollTo(0,0);
}

// Token vencido: limpia la sesión y vuelve a la landing
function handleSessionExpired(){
  clearToken();
  curUser=null;
  document.getElementById('adminApp').classList.remove('show');
  document.getElementById('landing').style.display='block';
  updateNav();
  renderLandingBlocks();
  lndToast('Sesión expirada','err');
}

function doLogout(){
  clearToken();
  curUser=null;
  document.getElementById('adminApp').classList.remove('show');
  document.getElementById('landing').style.display='block';
  updateNav();
  renderLandingBlocks();
  lndToast('Sesión cerrada','err');
}

function handleNav(){
  if(curUser){doLogout();}
  else openAuth();
}

function updateNav(){
  var b=document.getElementById('navBtn');
  b.textContent=curUser?(curUser.nombre||curUser.name||'').split(' ')[0]+' · Salir':'Iniciar sesión';
  // "Mi cuenta" solo para alumnos; display explícito para que también se vea en móvil (el CSS oculta los demás enlaces)
  var esAlumno=!!curUser&&curUser.rol==='alumno';
  var li=document.getElementById('navCuentaLi');
  if(li)li.style.display=esAlumno?'list-item':'none';
  var esAdmin=!!curUser&&curUser.rol==='admin';
  var lp=document.getElementById('navPanelLi');
  if(lp)lp.style.display=esAdmin?'list-item':'none';
  var nav=document.querySelector('#landing nav');
  if(nav)nav.classList.toggle('has-cuenta',esAlumno||esAdmin);
  if(typeof actualizarBotonPagar==='function')actualizarBotonPagar();
}

async function checkExistingSession(){
  var token=getToken();
  if(!token){updateNav();renderLandingBlocks();return;}
  try {
    var data=await apiRequest('/auth/me');
    curUser=data.user;
    updateNav();
    if(curUser.rol==='admin'){showAdminPanel();return;}
    renderLandingBlocks();
  } catch(e) {
    clearToken();
    curUser=null;
    updateNav();
    renderLandingBlocks();
  }
}

checkExistingSession();


// Confirmación de correo: el enlace del mensaje abre la web con #verificar=<token>.
// El token viaja en el fragmento (#), que el navegador no envía a ningún servidor.
(function(){
  function procesarEnlaceVerificacion(){
    var m=/^#verificar=([\w-]+\.[\w-]+\.[\w-]+)$/.exec(window.location.hash||'');
    if(!m)return;
    var token=m[1];
    history.replaceState(null,'',window.location.pathname+window.location.search);
    apiRequest('/auth/verificar-correo',{method:'POST',body:JSON.stringify({token:token})})
      .then(function(r){lndToast(r.message||'Correo confirmado. Ya puedes iniciar sesión.');openAuth();switchTab('login');})
      .catch(function(e){lndToast(e.message||'No se pudo confirmar el correo','err');});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',procesarEnlaceVerificacion);
  else procesarEnlaceVerificacion();
})();

// Enlace directo "#recuperar" (lo usa el login de la app de administración).
(function(){
  function abrirRecuperar(){
    if((window.location.hash||'')!=='#recuperar')return;
    history.replaceState(null,'',window.location.pathname+window.location.search);
    openAuth();switchTab('forgot');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',abrirRecuperar);
  else abrirRecuperar();
})();
