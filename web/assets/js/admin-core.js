// ══ ADMIN CORE ══
function initAdmin(){renderDashboard();}
function toggleSidebar(){sidebarExpanded=!sidebarExpanded;document.getElementById('sidebar').classList.toggle('expanded',sidebarExpanded);}
var pageTitles={dashboard:'Dashboard',clientes:'Gestión de Clientes',bloques:'Bloques de Entrenamiento',asistencia:'Control de Asistencia',negocio:'Análisis de Negocio',disciplinas:'Disciplinas',instructores:'Instructores',admins:'Administradores',planes:'Planes y Membresías',pagos:'Pagos',plantillas:'Plantillas de Notificación'};
function goTo(page){
  document.querySelectorAll('.apage').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  document.getElementById('apage-'+page).classList.add('active');
  document.getElementById('nav-'+page).classList.add('active');
  document.getElementById('topbarTitle').textContent=pageTitles[page];
  if(page==='dashboard')renderDashboard();
  if(page==='clientes')renderClients();
  if(page==='bloques')renderBlocksPage();
  if(page==='asistencia')renderAsistencia();
  if(page==='negocio')renderNegocio();
  if(page==='disciplinas')renderDisciplinas();
  if(page==='instructores')renderInstructores();
  if(page==='admins')renderAdmins();
  if(page==='planes')renderPlanes();
  if(page==='pagos')renderPagos();
  if(page==='plantillas')renderPlantillas();
}
function openAModal(id){document.getElementById(id).classList.add('show');}
function closeAModal(id){document.getElementById(id).classList.remove('show');}
