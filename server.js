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
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const E=(c,m)=>{const e=new Error(m);e.code=c;return e};
const clean=(s,n)=>String(s||'').trim().slice(0,n);
const int=(v,d)=>{const n=parseInt(v,10);return Number.isFinite(n)?n:d};
function cfgErr(n,c){
  if(!c.groups)return n<4?'O mata-mata direto precisa de pelo menos 4 times.':null;
  const min=Math.floor(n/c.groups);
  if(min<2)return 'Com '+n+' times não dá para fazer '+c.groups+' grupos (mínimo de 2 times por grupo).';
  if(c.perGroup<1||c.perGroup>min)return 'Quantos passam por grupo: de 1 a '+min+'.';
  if(c.thirds>c.groups)return 'Terceiros que passam: no máximo '+c.groups+' (um por grupo).';
  if(c.thirds>0&&c.perGroup+1>min)return 'Os grupos não têm colocados suficientes para classificar terceiros.';
  const q=c.groups*c.perGroup+c.thirds;
  if(q<4||q>32)return 'Isso classifica '+q+' times para o mata-mata. Precisa ficar entre 4 e 32.';
  return null}
function evData(b,base){
  const name=clean(b.name,50),date=clean(b.date,10),format=clean(b.format,20)||'6x6';
  if(name.length<2)throw E(400,'Digite o nome do campeonato.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw E(400,'Escolha a data do campeonato.');
  const price=Math.max(0,+String(b.price).replace(',','.')||0);
  const maxTeams=int(b.maxTeams,16),groups=int(b.groups,4),sim=b.thirdsOn==='sim';
  if(maxTeams<4||maxTeams>32)throw E(400,'Quantos times: de 4 a 32.');
  if(groups<0||groups>8)throw E(400,'Quantos grupos: de 0 a 8 (0 = mata-mata direto).');
  let rounds=0,perGroup=0,thirds=0;
  if(groups){
    rounds=int(b.rounds,0);perGroup=int(b.perGroup,0);thirds=sim?int(b.thirds,0):0;
    if(rounds<1||rounds>20)throw E(400,'Quantas rodadas: de 1 a 20.');
    if(sim&&thirds<1)throw E(400,'Informe quantos terceiros passam (mínimo 1) ou escolha "Não".');
    const err=cfgErr(maxTeams,{groups,rounds,perGroup,thirds});if(err)throw E(400,err);
  }else{const err=cfgErr(maxTeams,{groups:0});if(err)throw E(400,err)}
  return{...base,name,date,format,price,desc:clean(b.desc,200),maxTeams,groups,rounds,perGroup,thirds};
}

const EA_BASE='https://proclubs.ea.com/api/fc';
const EA_PROXY='https://proxy.corsfix.com/?';
const eaCache=new Map();
const EA_CACHE_MS=5*60*1000;

async function fetchJson(url, useProxy=false){
  const target=useProxy?EA_PROXY+encodeURIComponent(url):url;
  const r=await fetch(target,{
    headers:{
      'Accept':'application/json, text/plain, */*',
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36',
      'Referer':'https://www.ea.com/',
      'Origin':'https://www.ea.com'
    },
    signal:AbortSignal.timeout(10000)
  });
  if(!r.ok)throw new Error('HTTP '+r.status);
  const text=await r.text();
  if(!text)throw new Error('Resposta vazia');
  try{return JSON.parse(text)}catch(_){throw new Error('Resposta não-JSON')}
}

async function eaGet(endpoint, params){
  const qs=new URLSearchParams(params),url=EA_BASE+'/'+endpoint+'?'+qs.toString();
  const key=url;
  const cached=eaCache.get(key);
  if(cached && cached.exp>Date.now())return cached.value;
  let last;
  for(let attempt=0;attempt<2;attempt++){
    for(const proxy of [false,true]){
      try{
        const value=await fetchJson(url,proxy);
        eaCache.set(key,{value,exp:Date.now()+EA_CACHE_MS});
        return value;
      }catch(err){last=err}
    }
  }
  throw E(503,'A consulta automática da EA está indisponível no momento.');
}

const arr=x=>Array.isArray(x)?x:(x&&typeof x==='object'?Object.values(x):[]);
function extractRows(raw, keys=[]){
  if(Array.isArray(raw))return raw;
  if(!raw||typeof raw!=='object')return [];
  for(const k of keys){
    if(Array.isArray(raw[k]))return raw[k];
    if(raw[k]&&typeof raw[k]==='object'){
      const v=Object.values(raw[k]); if(v.length)return v;
    }
  }
  if(raw.clubId||raw.clubID||raw.id||raw.club_id)return [raw];
  return Object.values(raw).flatMap(v=>Array.isArray(v)?v:(v&&typeof v==='object'?[v]:[]));
}
function normalizeClub(x, platform){
  return {id:String(x?.clubId??x?.clubID??x?.id??x?.club_id??''),name:String(x?.clubName??x?.name??x?.clubname??''),tag:String(x?.clubTag??x?.tag??x?.abbreviation??''),owner:String(x?.ownerName??x?.owner??x?.managerName??''),platform};
}
function normalizePlayer(x){
  return {id:String(x.playerId??x.userId??x.memberId??x.id??''),name:String(x.name??x.playerName??x.gamertag??x.username??x.displayName??''),games:x.gamesPlayed??x.games??x.matches??x.appearances??null,goals:x.goals??null,assists:x.assists??null,rating:x.ratingAve??x.averageRating??x.rating??x.avgRating??null,position:String(x.favoritePosition??x.position??x.pos??''),proName:String(x.proName??'')};
}
async function proSearch(name,platform){
  const attempts=[
    ['currentSeasonLeaderboard/search',{platform,clubName:name,maxResultCount:'50'}],
    ['allTimeLeaderboard/search',{platform,clubName:name,maxResultCount:'50'}]
  ];
  const found=[]; let successful=false;
  for(const [endpoint,params] of attempts){
    try{
      const raw=await eaGet(endpoint,params); successful=true;
      const rows=extractRows(raw,['clubs','clubData','results','data','items','entries']).map(x=>normalizeClub(x,platform)).filter(x=>x.id&&x.name);
      for(const club of rows)if(!found.some(x=>x.id===club.id))found.push(club);
      if(found.length>=10)break;
    }catch(_){ }
  }
  if(!found.length)return {clubs:[],automaticAvailable:false,message:successful?'Nenhum clube encontrado. Confira o nome e a plataforma.':'A consulta automática da EA está indisponível no momento. Use o cadastro manual.'};
  return {clubs:found.slice(0,50),automaticAvailable:true,source:'ea'};
}
async function proMembers(clubId,platform){
  // Endpoint documentado para estatísticas de membros do clube usa clubId.
  const endpoints=[
    ['members/career/stats',{platform,clubId:String(clubId)}],
    ['members/stats',{platform,clubId:String(clubId),seasonId:'current'}]
  ];
  for(const [endpoint,params] of endpoints){
    try{
      const raw=await eaGet(endpoint,params);
      const rows=extractRows(raw,['members','players','memberStats','stats','data','results']);
      const players=rows.map(normalizePlayer).filter(x=>x.name);
      if(players.length)return players;
    }catch(_){ }
  }
  return [];
}

async function handle(m,url,b,u,res){
  const need=()=>{if(!u)throw E(401,'Entre na sua conta primeiro.')}, adm=()=>{need();if(!u.admin)throw E(403,'Só administradores podem fazer isso.')};
  if(m==='GET'&&url==='/api/data')return{teams:db.teams,tournament:db.tournament,scorers:db.scorers,events:db.events};
  if(m==='GET'&&url==='/api/me')return{user:u?{id:u.id,name:u.name,email:u.email,admin:u.admin}:null};
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
  if(m==='POST'&&url==='/api/proclubs/search'){
    need();
    const name=clean(b.name||'',50), platform=clean(b.platform||'common-gen5',30);
    if(name.length<2)throw E(400,'Digite pelo menos 2 caracteres do nome do clube.');
    const result=await proSearch(name,platform);
    return{ok:1,...result};
  }
  if(m==='POST'&&url==='/api/proclubs/members'){
    need();
    const clubId=clean(b.clubId||'',30), platform=clean(b.platform||'common-gen5',30);
    if(!clubId)throw E(400,'Club ID inválido.');
    let players=[];
    try{players=await proMembers(clubId,platform)}catch(_){players=[]}
    return{ok:1,players,automaticAvailable:players.length>0,message:players.length?'Elenco importado da EA.':'A EA não retornou o elenco. Use o cadastro manual.'};
  }
  if(m==='POST'&&url==='/api/teams'){
    need();
    const name=clean(b.name,30),captain=clean(b.captain,30);
    const eventId=clean(b.eventId||b.eventID||b.event,30);
    const ev=db.events.find(x=>x.id===eventId);
    if(!ev)throw E(400,'Escolha um campeonato. Atualize a página e selecione o campeonato novamente.');
    const paidOk=b.paid===true||b.paid==='true'||b.paid===1||b.paid==='1';
    if(!paidOk)throw E(400,'Confirme o pagamento ("Já paguei") para continuar a inscrição.');
    const players=(Array.isArray(b.players)?b.players:[]).map(p=>clean(p,30)).filter(Boolean).slice(0,15);
    if(name.length<2||!captain||!players.length)throw E(400,'Preencha o nome do time, o capitão e ao menos um jogador.');
    if(ev.maxTeams&&db.teams.filter(t=>t.eventId===ev.id).length>=ev.maxTeams)throw E(400,'Inscrições encerradas: este campeonato já atingiu o limite de '+ev.maxTeams+' times.');
    if(db.teams.some(t=>t.eventId===ev.id&&t.name.toLowerCase()===name.toLowerCase()))throw E(400,'Já existe um time com esse nome neste campeonato.');
    db.teams.push({id:rnd(6),name,captain,players,owner:u.id,eventId:ev.id,paid:'aguardando',eaClubId:clean(b.eaClubId,30)||null,eaPlatform:clean(b.eaPlatform,30)||null,eaPlayers:Array.isArray(b.eaPlayers)?b.eaPlayers.slice(0,30):[]});save();return{ok:1};
  }
  if(m==='DELETE'&&url.startsWith('/api/teams/')){
    need();const t=db.teams.find(x=>x.id===url.split('/').pop());if(!t)throw E(404,'Time não encontrado.');
    if(t.owner!==u.id&&!u.admin)throw E(403,'Você só pode remover o seu time.');
    db.teams=db.teams.filter(x=>x!==t);
    if(db.tournament&&Array.isArray(db.tournament.teams)&&db.tournament.teams.includes(t.name))db.tournament=null;
    save();return{ok:1};
  }
  if(m==='POST'&&url==='/api/admin/events'){adm();db.events.push(evData(b,{id:rnd(6)}));save();return{ok:1}}
  if(m==='PATCH'&&url.startsWith('/api/admin/events/')){adm();const e=db.events.find(x=>x.id===url.split('/').pop());if(!e)throw E(404,'Campeonato não encontrado.');const nd=evData(b,e),inscritos=db.teams.filter(t=>t.eventId===e.id).length;if(inscritos>nd.maxTeams)throw E(400,'Já há '+inscritos+' times inscritos; o limite não pode ser menor que isso.');Object.assign(e,nd);save();return{ok:1}}
  if(m==='DELETE'&&url.startsWith('/api/admin/events/')){
    adm();
    const id=url.split('/').pop(),e=db.events.find(x=>x.id===id);
    if(!e)throw E(404,'Campeonato não encontrado.');
    const removedTeams=db.teams.filter(t=>t.eventId===id);
    const removedNames=new Set(removedTeams.map(t=>t.name));
    db.teams=db.teams.filter(t=>t.eventId!==id);
    db.events=db.events.filter(x=>x.id!==id);
    if(db.tournament && (db.tournament.event===e.name || (Array.isArray(db.tournament.teams)&&db.tournament.teams.some(name=>removedNames.has(name)))))db.tournament=null;
    save();return{ok:1,removedTeams:removedTeams.length};
  }
  if(m==='POST'&&url.startsWith('/api/admin/teampay/')){adm();const t=db.teams.find(x=>x.id===url.split('/').pop());if(!t)throw E(404,'Time não encontrado.');t.paid=t.paid==='confirmado'?'aguardando':'confirmado';save();return{ok:1}}
  if(m==='DELETE'&&url==='/api/admin/teams'){adm();db.teams=[];db.tournament=null;save();return{ok:1}}
  if(m==='POST'&&url==='/api/admin/tournament'){adm();if(!db.teams.length)throw E(400,'falta time');db.tournament=b;save();return{ok:1}}
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
http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(url.startsWith('/api/')){
    const requestCookie=Object.fromEntries((req.headers.cookie||'').split(';').map(c=>c.trim().split('=')).filter(c=>c[0]));
    const u=db.users.find(x=>x.id===db.sessions[requestCookie.sid]);let raw='';
    req.on('data',c=>{raw+=c;if(raw.length>2e6)req.destroy()});
    return req.on('end',async()=>{let code=200,out;
      try{out=await handle(req.method,url,raw?JSON.parse(raw):{},u,res)}catch(e){code=e.code>=400?e.code:500;out={error:e.code>=400?e.message:'Erro no servidor.'};if(code===500)console.error(e)}
      res.writeHead(code,{'Content-Type':'application/json',...(res.getHeader('Set-Cookie')?{'Set-Cookie':res.getHeader('Set-Cookie')}:{})});res.end(JSON.stringify(out));});
  }
  const f=path.join(PUB,url==='/'?'index.html':path.normalize(url));
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.statusCode=404;return res.end('404')}
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
}).listen(PORT,()=>console.log('Arena Clubs rodando em '+BASE));
