const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public'),DB=path.join(__dirname,'data.json');
const BASE=process.env.BASE_URL||('http://localhost:'+PORT);
const db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):{users:[],teams:[],sessions:{},resets:{},tournament:null,scorers:[]};
db.events=db.events||[];
const save=()=>fs.writeFileSync(DB,JSON.stringify(db,null,1));
const rnd=n=>crypto.randomBytes(n).toString('hex');
const hash=(p,s=rnd(16))=>s+':'+crypto.scryptSync(p,s,32).toString('hex');
const okpw=(p,h)=>{const x=hash(p,h.split(':')[0]);return x.length===h.length&&crypto.timingSafeEqual(Buffer.from(x),Buffer.from(h))};
const ADMINS=[{"email":"luisfranciscocaceress@gmail.com","name":"Luis","pass":"05a809d10a54a30665b533c06e146b1e:64c1af97b3b9e5615a9669e9332352c5a4e932097580a5fd74190b9c9ab1a403"},{"email":"vitorsantoschacon@gmail.com","name":"Vitor","pass":"79b3dcc49cc07eed3961596eb926a302:88e761e4ed95da8bd339a853290f0a70dcc0b835c0fc2ee1895c020861fd76a7"},{"email":"nicolascalegon18@gmail.com","name":"Nicolas","pass":"5ba83944dc205cb3171ac77efd4045f2:6c7eb652ae153053719ea5b46977cdd90c211cc47d183a2e9ff46058dcc5ad6c"}];
for(const a of ADMINS){const u=db.users.find(x=>x.email===a.email);if(!u)db.users.push({id:rnd(6),name:a.name,email:a.email,pass:a.pass,admin:true})}
db.users.forEach(u=>u.admin=ADMINS.some(a=>a.email===u.email));save();
const BOTS=['Dragões FC','Lobos da Vila','Tubarões PC','Fênix United','Águias do Sul','Trovão SC','Leões de Ferro','Cobras FC','Titãs Gaming','Falcões PC','Raio Violeta','Gigantes SC','Nômades FC','Furacão Azul','Sombras United','Corsários PC'];
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const E=(c,m)=>{const e=new Error(m);e.code=c;return e};
const clean=(s,n)=>String(s||'').trim().slice(0,n);
function evData(b,base){
  const name=clean(b.name,50),date=clean(b.date,10),format=clean(b.format,20)||'6x6';
  if(name.length<2)throw E(400,'Digite o nome do campeonato.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw E(400,'Escolha a data do campeonato.');
  const price=Math.max(0,+String(b.price).replace(',','.')||0);
  return{...base,name,date,format,price,desc:clean(b.desc,200)};
}
function handle(m,url,b,u,res){
  const need=()=>{if(!u)throw E(401,'Entre na sua conta primeiro.')}, adm=()=>{need();if(!u.admin)throw E(403,'Só administradores podem fazer isso.')};
  if(m==='GET'&&url==='/api/data')return{teams:db.teams,tournament:db.tournament,scorers:db.scorers,events:db.events};
  if(m==='GET'&&url==='/api/me')return{user:u?{name:u.name,email:u.email,admin:u.admin}:null};
  if(m==='POST'&&url==='/api/register'){
    const email=clean(b.email,80).toLowerCase(),name=clean(b.name,30);
    if(name.length<2)throw E(400,'Digite seu nome.');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw E(400,'E-mail inválido.');
    if(String(b.password||'').length<6)throw E(400,'A senha precisa ter pelo menos 6 caracteres.');
    if(db.users.some(x=>x.email===email))throw E(400,'Esse e-mail já está cadastrado.');
    const n={id:rnd(6),name,email,pass:hash(b.password),admin:false};db.users.push(n);return login(n,res);
  }
  if(m==='POST'&&url==='/api/login'){
    const n=db.users.find(x=>x.email===clean(b.email,80).toLowerCase());
    if(!n||!okpw(String(b.password||''),n.pass))throw E(400,'E-mail ou senha incorretos.');return login(n,res);
  }
  if(m==='POST'&&url==='/api/logout'){delete db.sessions[cookie.sid];save();res.setHeader('Set-Cookie','sid=; Path=/; Max-Age=0');return{ok:1}}
  if(m==='POST'&&url==='/api/forgot'){
    const n=db.users.find(x=>x.email===clean(b.email,80).toLowerCase());
    if(n){const t=rnd(24);db.resets[t]={id:n.id,exp:Date.now()+36e5};save();
      console.log('\n=== RECUPERAÇÃO DE SENHA de '+n.email+' ===\nLink (vale por 1 hora): '+BASE+'/#reset='+t+'\n')}
    return{ok:1};
  }
  if(m==='POST'&&url==='/api/reset'){
    const r=db.resets[b.token];if(!r||r.exp<Date.now())throw E(400,'Link inválido ou expirado. Peça um novo.');
    if(String(b.password||'').length<6)throw E(400,'A senha precisa ter pelo menos 6 caracteres.');
    db.users.find(x=>x.id===r.id).pass=hash(b.password);delete db.resets[b.token];save();return{ok:1};
  }
  if(m==='POST'&&url==='/api/teams'){
    need();const name=clean(b.name,30),captain=clean(b.captain,30);
    const ev=db.events.find(x=>x.id===b.eventId);if(!ev)throw E(400,'Escolha um campeonato.');
    if(b.paid!==true)throw E(400,'Confirme o pagamento (\"Já paguei\") para continuar a inscrição.');
    const players=(Array.isArray(b.players)?b.players:[]).map(p=>clean(p,30)).filter(Boolean).slice(0,15);
    if(name.length<2||!captain||!players.length)throw E(400,'Preencha o nome do time, o capitão e ao menos um jogador.');
    if(db.teams.some(t=>t.eventId===ev.id&&t.name.toLowerCase()===name.toLowerCase()))throw E(400,'Já existe um time com esse nome neste campeonato.');
    db.teams.push({id:rnd(6),name,captain,players,owner:u.id,eventId:ev.id,paid:'aguardando'});save();return{ok:1};
  }
  if(m==='DELETE'&&url.startsWith('/api/teams/')){
    need();const t=db.teams.find(x=>x.id===url.split('/').pop());if(!t)throw E(404,'Time não encontrado.');
    if(t.owner!==u.id&&!u.admin)throw E(403,'Você só pode remover o seu time.');
    db.teams=db.teams.filter(x=>x!==t);save();return{ok:1};
  }
  if(m==='POST'&&url==='/api/admin/events'){adm();db.events.push(evData(b,{id:rnd(6)}));save();return{ok:1}}
  if(m==='PATCH'&&url.startsWith('/api/admin/events/')){adm();const e=db.events.find(x=>x.id===url.split('/').pop());if(!e)throw E(404,'Campeonato não encontrado.');Object.assign(e,evData(b,e));save();return{ok:1}}
  if(m==='DELETE'&&url.startsWith('/api/admin/events/')){adm();const id=url.split('/').pop();db.events=db.events.filter(x=>x.id!==id);save();return{ok:1}}
  if(m==='POST'&&url.startsWith('/api/admin/teampay/')){adm();const t=db.teams.find(x=>x.id===url.split('/').pop());if(!t)throw E(404,'Time não encontrado.');t.paid=t.paid==='confirmado'?'aguardando':'confirmado';save();return{ok:1}}
  if(m==='POST'&&url==='/api/admin/autoteams'){
    adm();for(const n of BOTS){if(db.teams.length>=16)break;
      if(!db.teams.some(t=>t.name===n))db.teams.push({id:rnd(6),name:n,captain:'Capitão '+n.split(' ')[0],players:['Jogador 1','Jogador 2','Jogador 3','Jogador 4','Jogador 5'],owner:'auto',auto:true})}
    save();return{ok:1};
  }
  if(m==='POST'&&url==='/api/admin/tournament'){adm();db.tournament=b;save();return{ok:1}}
  if(m==='POST'&&url==='/api/admin/scorers'){
    adm();const name=clean(b.name,30);if(!name)throw E(400,'Digite o nome do jogador.');
    db.scorers.push({id:rnd(6),name,team:clean(b.team,30),goals:Math.max(0,+b.goals||0)});save();return{ok:1};
  }
  if(m==='PATCH'&&url.startsWith('/api/admin/scorers/')){adm();const s=db.scorers.find(x=>x.id===url.split('/').pop());if(s)s.goals=Math.max(0,+b.goals||0);save();return{ok:1}}
  if(m==='DELETE'&&url.startsWith('/api/admin/scorers/')){adm();db.scorers=db.scorers.filter(x=>x.id!==url.split('/').pop());save();return{ok:1}}
  throw E(404,'Rota não encontrada.');
}
function login(n,res){const t=rnd(24);db.sessions[t]=n.id;save();
  res.setHeader('Set-Cookie','sid='+t+'; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000');return{ok:1}}
let cookie={};
http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(url.startsWith('/api/')){
    cookie=Object.fromEntries((req.headers.cookie||'').split(';').map(c=>c.trim().split('=')).filter(c=>c[0]));
    const u=db.users.find(x=>x.id===db.sessions[cookie.sid]);let raw='';
    req.on('data',c=>{raw+=c;if(raw.length>2e6)req.destroy()});
    return req.on('end',()=>{let code=200,out;
      try{out=handle(req.method,url,raw?JSON.parse(raw):{},u,res)}catch(e){code=e.code>=400?e.code:500;out={error:e.code>=400?e.message:'Erro no servidor.'};if(code===500)console.error(e)}
      res.writeHead(code,{'Content-Type':'application/json',...(res.getHeader('Set-Cookie')?{'Set-Cookie':res.getHeader('Set-Cookie')}:{})});res.end(JSON.stringify(out));});
  }
  const f=path.join(PUB,url==='/'?'index.html':path.normalize(url));
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end('404')}
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
}).listen(PORT,()=>console.log('Arena Clubs rodando em '+BASE));
