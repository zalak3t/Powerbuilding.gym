// ══ AUTH ══
function openAuth(){document.getElementById('authOverlay').classList.add('show');}
function closeAuth(){document.getElementById('authOverlay').classList.remove('show');}
function switchTab(tab){
  document.getElementById('fLogin').style.display=tab==='login'?'block':'none';
  document.getElementById('fReg').style.display=tab==='reg'?'block':'none';
  document.getElementById('tabLogin').className='tab-auth'+(tab==='login'?' active':'');
  document.getElementById('tabReg').className='tab-auth'+(tab==='reg'?' active':'');
  document.getElementById('lErr').classList.remove('show');
  document.getElementById('rErr').classList.remove('show');
  document.getElementById('rOk').classList.remove('show');
  document.getElementById('rConsent').checked=false;
}

async function doRegister(){
  var name=document.getElementById('rName').value.trim();
  var email=document.getElementById('rEmail').value.trim().toLowerCase();
  var phone=document.getElementById('rPhone').value.trim();
  var pass=document.getElementById('rPass').value;
  var err=document.getElementById('rErr'),ok=document.getElementById('rOk');
  err.classList.remove('show'); ok.classList.remove('show');
  if(!name||!email||!pass){err.textContent='Completa todos los campos obligatorios';err.classList.add('show');return;}
  if(pass.length<8){err.textContent='Mínimo 8 caracteres';err.classList.add('show');return;}
  if(!document.getElementById('rConsent').checked){err.textContent='Debes aceptar la política de privacidad';err.classList.add('show');return;}
  try {
    await apiRequest('/auth/register',{method:'POST',body:JSON.stringify({nombre:name,email:email,telefono:phone,password:pass})});
    ok.classList.add('show');
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
