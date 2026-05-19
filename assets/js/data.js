// ══ DATOS ══
// DEPRECADO: ADMIN_EMAIL y ADMIN_PASS ya no se usan en auth.js.
// Se mantienen para no romper referencias accidentales. Eliminar cuando todos los módulos usen API.
var ADMIN_EMAIL='admin@powerbuilding.gym';
var ADMIN_PASS='admin123';
var DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
var TW=['9:00–12:00','10:30–13:30','12:00–15:00','13:30–16:30','15:00–18:00','16:30–19:30','18:00–21:00'];
var TS=['9:00–12:00','10:30–13:30','12:00–15:00','13:30–16:30'];
var CAP=12;

var clients=[
  {id:1,name:'Carlos Pérez',email:'carlos@gmail.com',phone:'+56912345678',notes:'Interesado en competencia. Prefiere bloques de mañana.',status:'activo',joined:'2026-01-10',lastVisit:'2026-05-14',reservations:18,attendances:15},
  {id:2,name:'Ana López',email:'ana@gmail.com',phone:'+56923456789',notes:'Lesión leve en hombro derecho. Avisar al coach.',status:'activo',joined:'2026-02-03',lastVisit:'2026-05-15',reservations:22,attendances:20},
  {id:3,name:'María Soto',email:'maria@gmail.com',phone:'+56934567890',notes:'',status:'activo',joined:'2026-01-20',lastVisit:'2026-05-10',reservations:14,attendances:12},
  {id:4,name:'Juan Díaz',email:'juan@gmail.com',phone:'+56945678901',notes:'Paga membresía mensual. No falta casi nunca.',status:'activo',joined:'2025-11-15',lastVisit:'2026-05-15',reservations:31,attendances:29},
  {id:5,name:'Pedro Mora',email:'pedro@gmail.com',phone:'+56956789012',notes:'',status:'activo',joined:'2026-03-01',lastVisit:'2026-04-28',reservations:8,attendances:6},
  {id:6,name:'Carla Ruiz',email:'carla@gmail.com',phone:'+56967890123',notes:'Compite en powerlifting regional.',status:'activo',joined:'2025-12-01',lastVisit:'2026-05-13',reservations:25,attendances:24},
  {id:7,name:'Diego Núñez',email:'diego@gmail.com',phone:'+56978901234',notes:'',status:'bloqueado',joined:'2026-02-15',lastVisit:'2026-04-05',reservations:5,attendances:3},
  {id:8,name:'Valentina Castro',email:'vale@gmail.com',phone:'+56989012345',notes:'Principiante. Requiere mayor seguimiento.',status:'activo',joined:'2026-04-10',lastVisit:'2026-05-12',reservations:10,attendances:9},
  {id:9,name:'Rodrigo Muñoz',email:'rodrigo@gmail.com',phone:'+56990123456',notes:'',status:'activo',joined:'2026-01-05',lastVisit:'2026-03-20',reservations:12,attendances:10},
  {id:10,name:'Francisca Vega',email:'fran@gmail.com',phone:'+56901234567',notes:'Amiga de la coach. Trato preferencial.',status:'activo',joined:'2025-10-01',lastVisit:'2026-05-14',reservations:38,attendances:36},
];
var blocks=[];
var nextBlockId=1;
// Build blocks with sample data
DAYS.forEach(function(d){
  var times=d==='Sábado'?TS:TW;
  times.forEach(function(t){
    var cap=CAP;
    var taken=Math.floor(Math.random()*8)+2;
    var shuffled=clients.slice().sort(function(){return Math.random()-.5;});
    var res=[];
    for(var i=0;i<Math.min(taken,shuffled.length);i++) res.push(shuffled[i].id);
    var att=res.filter(function(){return Math.random()>.2;});
    blocks.push({id:nextBlockId++,day:d,time:t,capacity:cap,reservations:res,attendances:att,status:'activo',msg:''});
  });
});
blocks[3].status='suspendido'; blocks[3].msg='Feriado nacional';

// DEPRECADO: users[] ya no se usa en auth.js (login/register ahora usan API).
// Se mantiene para no romper referencias en otros módulos. Eliminar cuando todos los módulos usen API.
var users=[
  {name:'Carlos Pérez',email:'carlos@gmail.com',phone:'+56912345678',pass:'carlos123',role:'alumno'},
  {name:'Ana López',email:'ana@gmail.com',phone:'+56923456789',pass:'ana123',role:'alumno'},
];
users.push({name:'Fran Rodríguez',email:ADMIN_EMAIL,phone:'+56986105896',pass:ADMIN_PASS,role:'admin'});
