let D={teams:[],tournament:null,scorers:[],events:[]},ME=null,S=null,tab='home',evSel=null,editEv=null,paid={};
const PIX_NUM='19997262373',PIX_LINK='https://cobranca.c6pix.com.br/01M3QPR3VXBETB80S0CN9GGX9V';
const fdate=d=>String(d).split('-').reverse().join('/'),brl=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const evc=e=>({maxTeams:e.maxTeams||16,groups:e.groups??4,rounds:e.rounds||3,perGroup:e.perGroup||2,thirds:e.thirds||0});
const evInfo=e=>{if(e.maxTeams==null)return'';const p=[e.maxTeams+' times'];
  if(!e.groups)p.push('mata-mata direto');
  else p.push(e.groups+(e.groups>1?' grupos':' grupo'),e.rounds+(e.rounds>1?' rodadas':' rodada'),'passam '+e.perGroup+' por grupo'+(e.thirds?` + ${e.thirds} melhor${e.thirds>1?'es':''} ${e.perGroup+1}º`:''));
  return p.join(' · ')};
function syncEv(f){const g=+f.groups.value||0,on=f.thirdsOn.value==='sim';
  f.querySelectorAll('[data-grp]').forEach(x=>x.hidden=!g);f.querySelectorAll('[data-thr]').forEach(x=>x.hidden=!g||!on)}
function syncUI(){document.querySelectorAll('form[data-act=event]').forEach(syncEv);const g=$('genev'),w=$('modewrap');if(w)w.hidden=!!(g&&g.value)}
const evName=id=>{const e=D.events.find(x=>x.id===id);return e?e.name:''};
const $=id=>document.getElementById(id),view=$('view');
const api=(m,u,b)=>fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Erro');return j});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ADM=()=>ME&&ME.admin;
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const num=v=>v===''||v==null||isNaN(v)?null:+v;
const RULES=["As partidas são disputadas no formato 6x6, contando o goleiro, salvo indicação diferente da organização.","Somente atletas cadastrados na lista oficial podem entrar em campo. É proibido incluir jogadores fora da lista após o início.","É proibido assumir o controle manual do goleiro fora das situações de bola parada permitidas pela competição.","Os capitães devem confirmar presença no canal oficial antes da partida. Quem não confirmar dentro do prazo poderá receber W.O. Após a confirmação dos dois capitães, haverá tolerância de 10 minutos para o início. Nenhum confronto poderá começar sem a confirmação das duas equipes.","Bugs ou falhas técnicas no início serão avaliados pela organização, que poderá autorizar novo confronto conforme as provas.","Quedas de conexão devem ser comunicadas imediatamente. A organização decidirá entre reiniciar, manter o placar ou aplicar W.O., considerando tempo, placar e evidências.","Prints, vídeos ou outras provas solicitadas pela arbitragem devem ser enviados no prazo definido. Sem provas suficientes, o resultado registrado será mantido.","É proibido explorar bugs, glitches ou usar ferramentas externas para obter vantagem. Posicionar jogadores na frente do goleiro em cobranças de falta para burlar a mecânica também será infração.","Todas as equipes devem manter respeito com adversários, árbitros e organização. Discriminação, ameaças, spam e atitudes antidesportivas poderão resultar em advertência, perda de pontos ou desligamento.","Datas, horários, chaveamento e critérios de classificação serão divulgados antes de cada edição, podendo sofrer ajustes.","Em partidas que exigem um vencedor, o empate será decidido pelo critério definido para a fase, como prorrogação ou pênaltis.","A organização analisará denúncias e aplicará as punições previstas, podendo agir conforme o espírito esportivo em situações não previstas.","A premiação será divulgada antes de cada edição e paga conforme os dados e prazos definidos."];
/* ---------- torneio ---------- */
function rr(g,R){const a=[...g];if(a.length%2)a.push(null);const n=a.length,per=n-1,out=[];
  for(let r=0;r<R;r++){const sw=Math.floor(r/per)%2;
    for(let i=0;i<n/2;i++){const x=a[i],y=a[n-1-i];if(x==null||y==null)continue;out.push({a:sw?y:x,b:sw?x:y,sa:null,sb:null,r:r+1})}
    a.splice(1,0,a.pop())}
  return out}
function cfgErr(n,c){
  if(!c.groups)return n<4?'O mata-mata direto precisa de pelo menos 4 times.':null;
  const min=Math.floor(n/c.groups);
  if(min<2)return `Com ${n} times não dá para fazer ${c.groups} grupos (mínimo de 2 times por grupo).`;
  if(c.perGroup<1||c.perGroup>min)return `Quantos passam por grupo: de 1 a ${min}.`;
  if(c.thirds>c.groups)return `Terceiros que passam: no máximo ${c.groups} (um por grupo).`;
  if(c.thirds>0&&c.perGroup+1>min)return 'Os grupos não têm colocados suficientes para classificar terceiros.';
  const q=c.groups*c.perGroup+c.thirds;
  if(q<4||q>32)return `Isso classifica ${q} times para o mata-mata. Precisa ficar entre 4 e 32.`;
  return null}
function fresh(mode,names,cfg){
  const n=names.length,ids=shuf(names.map((_,i)=>i));
  if(mode==='direct'){
    let size=2;while(size<n)size*=2;const byes=size-n,seed=[];
    ids.slice(0,byes).forEach(t=>seed.push(t,-1));
    for(let i=byes;i<n;i++)seed.push(ids[i]);
    return{mode,teams:names,groups:[],gm:[],ko:{},dseed:seed};
  }
  const groups=Array.from({length:cfg.groups},()=>[]);ids.forEach((t,i)=>groups[i%cfg.groups].push(t));
  return{mode,teams:names,groups,gm:groups.map(g=>rr(g,cfg.rounds)),ko:{},dseed:ids,cfg:{groups:cfg.groups,rounds:cfg.rounds,perGroup:cfg.perGroup,thirds:cfg.thirds}};
}
function table(gi){
  const r={};S.groups[gi].forEach(t=>r[t]={t,p:0,j:0,v:0,e:0,d:0,gp:0,gc:0});
  S.gm[gi].forEach(m=>{if(m.sa==null||m.sb==null)return;const A=r[m.a],B=r[m.b];A.j++;B.j++;A.gp+=m.sa;A.gc+=m.sb;B.gp+=m.sb;B.gc+=m.sa;
    if(m.sa>m.sb){A.v++;A.p+=3;B.d++}else if(m.sa<m.sb){B.v++;B.p+=3;A.d++}else{A.e++;B.e++;A.p++;B.p++}});
  return Object.values(r).sort((x,y)=>y.p-x.p||(y.gp-y.gc)-(x.gp-x.gc)||y.gp-x.gp||x.t-y.t);
}
const cmpT=(x,y)=>y.p-x.p||(y.gp-y.gc)-(x.gp-x.gc)||y.gp-x.gp||x.t-y.t;
function extraQ(){const c=S.cfg;if(!c||!c.thirds)return[];return S.groups.map((_,i)=>table(i)[c.perGroup]).filter(Boolean).sort(cmpT).slice(0,c.thirds).map(x=>x.t)}
function seedKO(){
  const c=S.cfg,T=S.groups.map((_,i)=>table(i)),gOf={};S.groups.forEach((g,i)=>g.forEach(t=>gOf[t]=i));
  const seeds=[];for(let p=0;p<c.perGroup;p++)seeds.push(...T.map(t=>t[p]).filter(Boolean).sort(cmpT).map(x=>x.t));
  seeds.push(...extraQ());
  let size=2;while(size<seeds.length)size*=2;
  let ord=[1];while(ord.length<size){const L=ord.length;ord=ord.flatMap(x=>[x,2*L+1-x])}
  const first=ord.map(k=>k<=seeds.length?seeds[k-1]:-1);
  for(let i=0;i<first.length;i+=2){const a=first[i],b=first[i+1];if(b<0||gOf[a]!==gOf[b])continue;
    for(let j=0;j<first.length;j+=2){if(j===i)continue;const c2=first[j],d=first[j+1];
      if(d<0||gOf[a]===gOf[d]||gOf[c2]===gOf[b])continue;first[i+1]=d;first[j+1]=b;break}}
  return first}
const groupsDone=()=>S.gm.every(g=>g.every(m=>m.sa!=null&&m.sb!=null));
function res(m){if(m.b===-1&&m.a!=null&&m.a!==-1)return{w:m.a,l:-1};if(m.a===-1&&m.b!=null&&m.b!==-1)return{w:m.b,l:-1};if(m.a==null||m.b==null||m.sa==null||m.sb==null)return{};let d=m.sa-m.sb;if(!d&&m.pa!=null&&m.pb!=null)d=m.pa-m.pb;if(!d)return{};return d>0?{w:m.a,l:m.b}:{w:m.b,l:m.a}}
function getKO(){
  let first;
  if(S.mode==='direct')first=S.dseed;
  else{if(!groupsDone())return null;if(S.cfg)first=seedKO();else{const T=S.groups.map((_,i)=>table(i).map(x=>x.t));first=[T[0][0],T[1][1],T[2][0],T[3][1],T[1][0],T[0][1],T[3][0],T[2][1]]}}
  const names={32:'16 avos de final',16:'Oitavas',8:'Quartas',4:'Semifinais',2:'Final'},rounds=[];let size=first.length,r=0;
  let cur=[];for(let i=0;i<size;i+=2)cur.push({a:first[i],b:first[i+1]});
  while(size>=2){
    cur=cur.map((m,i)=>{if(r>0)m={a:res(rounds[r-1][2*i]).w,b:res(rounds[r-1][2*i+1]).w};
      const id='r'+r+'m'+i,k=m.a+'-'+m.b;if(!S.ko[id]||S.ko[id].k!==k)S.ko[id]={k};return{...m,...S.ko[id],id}});
    cur.rname=names[size];rounds.push(cur);size/=2;r++;cur=Array.from({length:size/2});
  }
  const sf=rounds[rounds.length-2],t={a:res(sf[0]).l,b:res(sf[1]).l},kk=t.a+'-'+t.b;
  if(!S.ko.third||S.ko.third.k!==kk)S.ko.third={k:kk};
  return{rounds,third:{...t,...S.ko.third,id:'third'}};
}
const nm=t=>t==null?'A definir':t===-1?'Folga':esc(S.teams[t]);
function mh(m,store,key){
  const r=res(m),ok=m.a!=null&&m.b!=null&&m.a!==-1&&m.b!==-1&&ADM(),tie=m.a!=null&&m.b!=null&&m.a!==-1&&m.b!==-1&&m.sa!=null&&m.sa===m.sb;
  const inp=f=>`<input type="number" min="0" ${ok?'':'disabled'} value="${m[f]??''}" data-s="${store}" data-k="${key}" data-f="${f}" aria-label="gols">`;
  return`<div class="m"><span class="${r.w===m.a&&r.w!=null?'w':''}">${nm(m.a)}</span>${inp('sa')}<span>x</span>${inp('sb')}<span class="${r.w===m.b&&r.w!=null?'w':''}">${nm(m.b)}</span>${tie?`<div class="pen">Pênaltis: ${inp('pa')} x ${inp('pb')}</div>`:''}</div>`;
}
function champHTML(){
  if(!S)return`<h2>Campeonato</h2><div class="card"><p>O campeonato ainda não foi gerado. ${ADM()?'Vá na aba Admin e clique em "Gerar torneio".':'A organização vai iniciar em breve. Acompanhe no Discord.'}</p></div>`;
  let h=`<h2>Campeonato${S.event?': '+esc(S.event):''}</h2>`;
  if(S.mode==='groups'){
    const pg=S.cfg?S.cfg.perGroup:2,th=S.cfg?S.cfg.thirds:0,ex=extraQ();
    h+=`<p class="note">Passam ${pg} por grupo${th?` + os ${th} melhor${th>1?'es':''} ${pg+1}º colocado${th>1?'s':''} (linha mais clara)`:''} para o mata-mata.</p><div class="grid">`;
    S.groups.forEach((g,i)=>{h+=`<div class="card"><h3>Grupo ${'ABCDEFGH'[i]}</h3><table><tr><th></th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>`+
      table(i).map((x,p)=>`<tr class="${p<pg?'q':ex.includes(x.t)?'q3':''}"><td>${p+1}</td><td>${nm(x.t)}</td><td><b>${x.p}</b></td><td>${x.j}</td><td>${x.v}</td><td>${x.e}</td><td>${x.d}</td><td>${x.gp-x.gc}</td></tr>`).join('')+
      '</table><h3 style="margin-top:14px">Jogos</h3>'+(l=>S.gm[i].map((m,mi)=>(m.r!=null&&m.r!==l?(l=m.r,`<div class="rd">Rodada ${m.r}</div>`):'')+mh(m,'g'+i,mi)).join(''))(null)+'</div>'});h+='</div>';
  }
  const ko=getKO();h+='<h2>Mata-mata</h2>';
  if(!ko)return h+'<p class="note">O mata-mata é montado quando todos os jogos dos grupos terminarem.</p>';
  h+='<div class="rounds">'+ko.rounds.map(rd=>`<div class="col"><h3>${rd.rname}</h3>${rd.map(m=>`<div class="card">${mh(m,'k',m.id)}</div>`).join('')}</div>`).join('')+'</div>';
  h+=`<h2>Disputa de 3º lugar</h2><div class="card" style="max-width:420px">${mh(ko.third,'k','third')}</div>`;
  const rf=res(ko.rounds[ko.rounds.length-1][0]),r3=res(ko.third);
  if(rf.w!=null)h+=`<div class="champ"><small>Campeão</small>${nm(rf.w)}<small>Vice: ${nm(rf.l)}${r3.w!=null?' · 3º: '+nm(r3.w):''}</small></div>`;
  return h;
}
/* ---------- abas ---------- */
const TABS={
home:()=>`<section class="hero"><h1>Seu clube. Seus jogos. Sua arena.</h1><p>Campeonatos de EA FC Pro Clubs com fase de grupos, mata-mata, artilheiros e resultados sempre atualizados.</p>
<div class="row"><button data-go="events">Inscrever meu time</button><button class="sec" data-go="champ">Ver campeonato</button></div></section>
<div class="grid">${[['Grupos e mata-mata','Sorteio automático dos grupos, tabela ao vivo e chaveamento até a final e o 3º lugar.'],['Artilheiros','Ranking dos goleadores do campeonato, mantido pela organização.'],['Regras claras','Tempos, W.O. e conduta explicados para os capitães.'],['Comunidade','Avisos, ready-check e suporte no Discord e no WhatsApp.']].map(c=>`<div class="card"><h3>${c[0]}</h3><p>${c[1]}</p></div>`).join('')}</div>
<h2>Entre nos grupos</h2><div class="row"><a class="btn dc" href="https://discord.gg/BFzt6FXyV" target="_blank" rel="noopener">Entrar no Discord</a><a class="btn wa" href="https://chat.whatsapp.com/C3XsWoCagV021IYWaE89Gr" target="_blank" rel="noopener">Entrar no WhatsApp</a></div>`,
champ:champHTML,
teams:()=>`<h2>Times inscritos (${D.teams.length})</h2>`+(D.teams.length?`<div class="grid">${D.teams.map(t=>`<div class="card"><h3>${esc(t.name)}</h3><p>Capitão: ${esc(t.captain)}</p>${t.eventId?`<p>Campeonato: ${esc(evName(t.eventId)||'—')}</p>`:''}${t.paid?`<p><span class="tag">${t.paid==='confirmado'?'Pagamento confirmado':'Pagamento aguardando confirmação'}</span></p>`:''}<div>${t.players.map(p=>`<span class="tag">${esc(p)}</span>`).join('')}</div>${ADM()&&t.paid?`<p style="margin-top:10px"><button class="sec" data-tpay="${t.id}">${t.paid==='confirmado'?'Desfazer confirmação':'Confirmar pagamento'}</button></p>`:''}${ME&&(ADM()||t.owner===ME.id)?`<p style="margin-top:10px"><button class="del" data-del="${t.id}">Remover</button></p>`:''}</div>`).join('')}</div>`:'<p class="note">Nenhum time ainda. Seja o primeiro!</p>')+
 `<h2>Inscrever um time</h2><div class="card"><p>As inscrições são feitas dentro de cada campeonato. <a href="#" data-go="events" style="color:var(--lt)">Ver campeonatos</a></p></div>`,
scorers:()=>{const L=[...D.scorers].sort((a,b)=>b.goals-a.goals);return`<h2>Artilheiros</h2>`+(L.length?`<div class="card">${L.map((s,i)=>`<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="rk">${i+1}</span><span style="flex:1"><b>${esc(s.name)}</b> <span class="note">${esc(s.team)}</span></span><b>${s.goals} gols</b>${ADM()?`<button class="sec" data-g="${s.id}" data-d="1">+1</button><button class="sec" data-g="${s.id}" data-d="-1">−1</button><button class="del" data-ds="${s.id}">×</button>`:''}</div>`).join('')}</div>`:'<p class="note">Ainda não há artilheiros registrados.</p>')+
 (ADM()?`<h2>Adicionar artilheiro</h2><form class="f" data-act="scorer"><label>Jogador<input name="name" required maxlength="30"></label><label>Time<select name="team">${D.teams.map(t=>`<option>${esc(t.name)}</option>`).join('')}</select></label><label>Gols<input name="goals" type="number" min="0" value="1"></label><button>Adicionar</button></form>`:'')},
rules:()=>`<h2>Regras</h2><p class="note">Regras da competição.</p><ol class="rules">${RULES.map(r=>`<li>${r}</li>`).join('')}</ol>`,
account:()=>{
  const rt=location.hash.startsWith('#reset=')?location.hash.slice(7):'';
  if(rt)return`<h2>Criar nova senha</h2><form class="f" data-act="reset"><input type="hidden" name="token" value="${esc(rt)}"><label>Nova senha<input name="password" type="password" minlength="6" required></label><button>Salvar senha</button></form>`;
  if(ME)return`<h2>Minha conta</h2><div class="card" style="max-width:420px"><h3>${esc(ME.name)}${ME.admin?' (administrador)':''}</h3><p>${esc(ME.email)}</p><p style="margin-top:12px"><button data-out="1" class="sec">Sair</button></p></div>`;
  return`<div class="grid"><div><h2>Entrar</h2><form class="f" data-act="login"><label>E-mail<input name="email" type="email" required></label><label>Senha<input name="password" type="password" required></label><button>Entrar</button></form>
  <h2>Esqueci a senha</h2><form class="f" data-act="forgot"><label>E-mail da conta<input name="email" type="email" required></label><button class="sec">Recuperar senha</button></form></div>
  <div><h2>Criar conta</h2><form class="f" data-act="register"><label>Nome<input name="name" required maxlength="30"></label><label>E-mail<input name="email" type="email" required></label><label>Senha (mín. 6 caracteres)<input name="password" type="password" minlength="6" required></label><button>Criar conta</button></form></div></div>`},
admin:()=>{if(!ADM())return'<p class="note">Área restrita.</p>';const EL=[...D.events].sort((x,y)=>x.date.localeCompare(y.date));return`<h2>Painel do administrador</h2><div class="grid">
<div class="card"><h3>1. Gerar torneio</h3><p>Escolha o campeonato: o torneio usa os times inscritos nele e a estrutura definida na criação (grupos, rodadas, quantos passam). Apaga o torneio atual.</p><p style="margin-top:10px"><select id="genev">${EL.map(e=>`<option value="${e.id}">${esc(e.name)} (${D.teams.filter(t=>t.eventId===e.id).length} times)</option>`).join('')}<option value="">Todos os times cadastrados (modo manual)</option></select></p>
<p id="modewrap" style="margin-top:10px"><select id="mode"><option value="groups">Grupos + Quartas (8 a 16 times)</option><option value="direct">Mata-mata direto (4 a 16 times)</option></select></p><p style="margin-top:10px"><button data-a="gen">Gerar torneio</button></p></div>
<div class="card"><h3>2. Resultados e artilheiros</h3><p>Digite os placares na aba Chaveamento e gerencie os goleadores na aba Artilheiros. Só administradores editam.</p></div>
<div class="card"><h3>3. Times</h3><p>Remova times um a um na aba Times, ou apague todos de uma vez.</p><p style="margin-top:10px"><button class="del" data-a="delall">Apagar todos os times</button></p></div>
</div>
<div class="card admin-events" style="margin-top:16px"><h3>4. Gerenciar campeonatos</h3><p>Edite ou exclua qualquer campeonato criado. Ao excluir, os times inscritos nele também serão removidos.</p>
<div class="admin-event-list">${EL.length?EL.map(e=>{const n=D.teams.filter(t=>t.eventId===e.id).length;return `<div class="admin-event"><div class="admin-event-info"><div><span class="tag">${fdate(e.date)}</span><span class="tag">${esc(e.format)}</span></div><strong>${esc(e.name)}</strong><span class="note">${n} time${n===1?'':'s'} inscrito${n===1?'':'s'} · ${brl(e.price)}</span></div><div class="row admin-event-actions"><button type="button" class="sec" data-evedit="${e.id}">Editar</button><button type="button" class="del" data-evdel="${e.id}">🗑 Excluir</button></div></div>`}).join(''):'<p class="note">Nenhum campeonato cadastrado.</p>'}</div></div>`}
};

function evForm(){const e=editEv?D.events.find(x=>x.id===editEv):null,c=evc(e||{});
  return`<form class="f" data-act="event"><input type="hidden" name="id" value="${e?e.id:''}"><label>Data<input name="date" type="date" required value="${e?e.date:''}"></label><label>Nome do campeonato<input name="name" required maxlength="50" value="${esc(e?e.name:'')}"></label><label>Formato<input name="format" maxlength="20" value="${esc(e?e.format:'6x6')}"></label><label>Valor da inscrição (R$)<input name="price" type="number" min="0" step="0.01" value="${e?e.price:30}"></label><label>Descrição (opcional)<input name="desc" maxlength="200" value="${esc(e?e.desc:'')}"></label>
<h3 style="margin:10px 0 0">Estrutura do campeonato</h3>
<label>Quantos times<input name="maxTeams" type="number" min="4" max="32" value="${c.maxTeams}"></label>
<label>Quantos grupos <small>(0 = mata-mata direto, sem grupos)</small><input name="groups" type="number" min="0" max="8" value="${c.groups}"></label>
<label data-grp>Quantas rodadas na fase de grupos<input name="rounds" type="number" min="1" max="20" value="${c.rounds}"></label>
<label data-grp>Quantos times passam por grupo<input name="perGroup" type="number" min="1" max="16" value="${c.perGroup}"></label>
<label data-grp>Os melhores terceiros também passam?<select name="thirdsOn"><option value="nao">Não</option><option value="sim"${c.thirds>0?' selected':''}>Sim</option></select></label>
<label data-thr>Quantos terceiros passam<input name="thirds" type="number" min="1" max="8" value="${c.thirds||1}"></label>
<div class="row"><button>${e?'Salvar alterações':'Criar campeonato'}</button>${e?'<button type="button" class="sec" data-evcancel="1">Cancelar</button>':''}</div></form>`}
TABS.events=()=>{const L=[...D.events].sort((x,y)=>x.date.localeCompare(y.date));
  return`<h2>Campeonatos</h2><p class="note">Clique em um campeonato para inscrever seu time.</p>`+(L.length?`<div class="evgrid">${L.map(e=>{const n=D.teams.filter(t=>t.eventId===e.id).length;
    return`<div class="ev" data-ev="${e.id}" role="button" tabindex="0"><div><span class="tag">${fdate(e.date)}</span><span class="tag">${esc(e.format)}</span>${e.maxTeams?`<span class="tag">${e.maxTeams} times</span>`:''}</div><h3>${esc(e.name)}</h3>${e.desc?`<p>${esc(e.desc)}</p>`:''}<div class="evf"><b>${brl(e.price)}</b><span class="note">${e.maxTeams?(n>=e.maxTeams?'Lotado · ':'')+n+'/'+e.maxTeams+' times':n+' time'+(n===1?'':'s')}</span><span class="go">Inscrever time →</span>${ADM()?`<div class="row ev-actions" data-ev-actions="1"><button type="button" class="sec" data-evedit="${e.id}">Editar</button><button type="button" class="del" data-evdel="${e.id}" title="Excluir este campeonato e seus times inscritos">🗑 Excluir campeonato</button></div>`:''}</div></div>`}).join('')}</div>`:'<div class="card"><p>Nenhum campeonato aberto por enquanto.</p></div>')+
  (ADM()?`<h2>${editEv?'Editar campeonato':'Novo campeonato'}</h2>${evForm()}`:'')};
TABS.enroll=()=>{const e=D.events.find(x=>x.id===evSel);
  if(!e)return'<p class="note">Campeonato não encontrado.</p><button data-go="events">Voltar</button>';
  const back='<p><a href="#" data-go="events" style="color:var(--lt)">← Voltar aos campeonatos</a></p>';
  const head=`${back}<h2>${esc(e.name)}</h2><p class="note">${fdate(e.date)} · formato ${esc(e.format)} · inscrição ${brl(e.price)}</p>${evInfo(e)?`<p class="note">${evInfo(e)}</p>`:''}${e.desc?`<p>${esc(e.desc)}</p>`:''}`;
  if(e.maxTeams&&D.teams.filter(t=>t.eventId===e.id).length>=e.maxTeams)return head+`<div class="card"><p>Inscrições encerradas: o limite de ${e.maxTeams} times já foi atingido.</p></div>`;
  if(!ME)return head+'<div class="card"><p>Para inscrever um time, <a href="#" data-go="account" style="color:var(--lt)">entre ou crie sua conta</a>.</p></div>';
  const pay=`<div class="card" style="max-width:460px"><h3>1. Pague a inscrição com Pix — ${brl(e.price)}</h3><img class="qr" src="pix-qr.png" alt="QR Code Pix"><p>Número do Pix: <b>${PIX_NUM}</b> <button class="sec" data-copy="${PIX_NUM}">Copiar</button></p><p style="margin-top:10px"><a class="btn" href="${PIX_LINK}" target="_blank" rel="noopener">Pagar pelo link</a></p><p style="margin-top:12px"><b>Depois de pagar, envie o comprovante para o WhatsApp <a href="https://wa.me/55${PIX_NUM}" target="_blank" rel="noopener" style="color:var(--lt)">${PIX_NUM}</a>.</b></p>${paid[e.id]?'<p style="margin-top:10px"><span class="tag">Pagamento informado</span></p>':'<p style="margin-top:12px"><button data-paid="1">Já paguei</button></p>'}</div>`;
  const form=paid[e.id]?`<h3 style="margin-top:20px">2. Dados do time</h3>
<form class="f" data-act="team">
<input type="hidden" name="eventId" value="${e.id}">
<input type="hidden" name="eaClubId" id="eaClubId">
<input type="hidden" name="eaPlatform" id="eaPlatform">
<label>Nome do time<input name="name" id="teamName" required maxlength="30"></label>
<label>Capitão<input name="captain" required maxlength="30"></label>
<div class="card pro-box" style="padding:14px;margin-top:8px">
<h3 style="margin:0 0 8px">Jogadores do EA SPORTS FC 26</h3>
<p class="note">Primeiro tente importar automaticamente o elenco do seu clube. Se a EA não retornar os jogadores, use a aba <b>Cadastro manual</b>.</p>

<div class="player-tabs" role="tablist" aria-label="Forma de cadastro dos jogadores">
<button type="button" class="player-tab on" data-playermode="auto">⚡ Importar do FC 26</button>
<button type="button" class="player-tab" data-playermode="manual">✍️ Cadastro manual</button>
</div>

<div id="playersAuto">
  <div class="row">
    <label style="flex:1">Plataforma<select id="eaPlatformPick" style="width:100%">
      <option value="common-gen5">PS5 / Xbox Series / PC</option>
      <option value="nx">Nintendo Switch 2</option>
    </select></label>
    <label style="flex:2">Nome do clube no FC 26<input id="eaClubSearch" maxlength="50" placeholder="Ex.: Seu Clube FC"></label>
  </div>
  <button type="button" class="sec" data-prosearch="1" style="margin-top:10px">🔎 Buscar clube</button>
  <div id="proResults" style="margin-top:10px"></div>
  <div id="proRosterStatus" class="note" style="margin-top:10px"></div>
</div>

<div id="playersManual" hidden>
  <p class="note">Digite os jogadores, um por linha. Você pode cadastrar de 1 a 15 jogadores.</p>
</div>
</div>

<label id="playersLabel">Jogadores do time (um nome por linha)
<textarea name="players" id="proPlayers" rows="8" required readonly placeholder="Importe o elenco do FC 26 ou use a aba Cadastro manual."></textarea>
</label>
<button>Inscrever time</button>
</form>`:'<p class="note" style="margin-top:14px">Depois de pagar e clicar em "Já paguei", os dados do time serão liberados.</p>';
  return head+pay+form};
const NAV=[['home','Início'],['events','Campeonatos'],['champ','Chaveamento'],['teams','Times'],['scorers','Artilheiros'],['rules','Regras'],['account',()=>ME?'Conta':'Entrar']];
function render(){
  const nav=[...NAV];if(ADM())nav.push(['admin','Admin']);
  $('nav').innerHTML=nav.map(([k,l])=>`<a data-go="${k}" class="${k===tab||(k==='events'&&tab==='enroll')?'on':''}">${typeof l==='function'?l():l}</a>`).join('');
  S=D.tournament;view.innerHTML=TABS[tab]();syncUI();
}
const menu=$('menu'),burger=$('burger');
const setMenu=o=>{menu.classList.toggle('open',o);burger.classList.toggle('open',o);burger.setAttribute('aria-expanded',o);burger.setAttribute('aria-label',o?'Fechar menu':'Abrir menu')};
burger.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
addEventListener('click',e=>{if(!e.target.closest('header'))setMenu(false)});
matchMedia('(min-width:1101px)').addEventListener('change',e=>{if(e.matches)setMenu(false)});
const go=t=>{tab=t;setMenu(false);render();scrollTo(0,0)};
async function load(){[D,ME]=await Promise.all([api('GET','/api/data'),api('GET','/api/me').then(r=>r.user)]);render()}
document.addEventListener('click',async e=>{
  const d=e.target.closest('[data-go],[data-del],[data-g],[data-ds],[data-out],[data-a],[data-ev],[data-evedit],[data-evdel],[data-evcancel],[data-paid],[data-tpay],[data-copy],[data-prosearch],[data-proselect],[data-playermode]');if(!d)return;const x=d.dataset;
  try{
    if(x.go){e.preventDefault();return go(x.go)}
    if(x.playermode){
      const area=$('proPlayers'),auto=$('playersAuto'),manual=$('playersManual');
      if(!area)return;
      const isManual=x.playermode==='manual';
      area.readOnly=!isManual;
      if(auto)auto.hidden=isManual;
      if(manual)manual.hidden=!isManual;
      document.querySelectorAll('.player-tab').forEach(b=>b.classList.toggle('on',b.dataset.playermode===x.playermode));
      const label=$('playersLabel');
      if(label)label.firstChild.textContent=isManual?'Jogadores cadastrados manualmente (um nome por linha)':'Jogadores do time (um nome por linha)';
      if(isManual && !area.value) area.focus();
      return;
    }
    if(x.evedit){e.stopPropagation();editEv=x.evedit;tab='events';render();return scrollTo(0,document.body.scrollHeight)}
    if(x.evdel){
      e.stopPropagation();
      const ev=D.events.find(y=>y.id===x.evdel);
      if(!ev)return alert('Campeonato não encontrado.');
      const count=D.teams.filter(t=>t.eventId===ev.id).length;
      const msg=count?`Excluir o campeonato "${ev.name}" também removerá ${count} time(s) inscrito(s). Essa ação não pode ser desfeita. Continuar?`:`Excluir o campeonato "${ev.name}"? Essa ação não pode ser desfeita.`;
      if(!confirm(msg))return;
      await api('DELETE','/api/admin/events/'+x.evdel);
      if(editEv===x.evdel)editEv=null;
      await load();
      return;
    }
    if(x.ev){evSel=x.ev;return go('enroll')}
    if(x.evcancel){editEv=null;return render()}
    if(x.paid){paid[evSel]=true;return render()}
    if(x.copy){await navigator.clipboard.writeText(x.copy).catch(()=>{});return alert('Número copiado!')}
    if(x.prosearch){
      const name=$('eaClubSearch')?.value.trim(),platform=$('eaPlatformPick')?.value||'common-gen5',box=$('proResults'),status=$('proRosterStatus'),btn=d;
      if(!name||name.length<2)return alert('Digite pelo menos 2 caracteres do nome do clube.');
      btn.disabled=true;btn.textContent='🔎 Buscando...';box.innerHTML='<p class="note">Consultando os clubes do EA SPORTS FC 26...</p>';status.textContent='';
      try{
        const r=await api('POST','/api/proclubs/search',{name,platform});
        if(!r.clubs?.length){box.innerHTML='<p class="note">Nenhum clube encontrado. Tente o nome exato do clube e confirme a plataforma.</p>';return}
        box.innerHTML='<p class="note">Selecione seu clube:</p>'+r.clubs.slice(0,10).map(c=>`<button type="button" class="sec" style="display:block;width:100%;text-align:left;margin-top:6px" data-proselect="${esc(c.id)}" data-proplatform="${esc(c.platform)}" data-proname="${esc(c.name)}">${esc(c.name)}${c.tag?' · '+esc(c.tag):''}${c.owner?' — '+esc(c.owner):''}</button>`).join('');
      }catch(err){
        box.innerHTML='<p class="note">Não foi possível consultar a EA agora. Tente novamente em alguns segundos.</p>';
        throw err;
      }finally{
        btn.disabled=false;btn.textContent='🔎 Buscar clube';
      }
      return;
    }
    if(x.proselect){
      const id=x.proselect,platform=d.proplatform||'common-gen5',name=d.proname||'';
      $('eaClubId').value=id;$('eaPlatform').value=platform;
      const tn=$('teamName');if(tn&&!tn.value)tn.value=name.slice(0,30);
      const box=$('proResults'),status=$('proRosterStatus'),area=$('proPlayers');
      box.innerHTML=`<p class="note">Clube selecionado: <b>${esc(name)}</b> · ID ${esc(id)}</p>`;
      status.textContent='Carregando jogadores do Pro Clubs...';area.value='';
      try{
        const r=await api('POST','/api/proclubs/members',{clubId:id,platform});
        const players=(r.players||[]).filter(p=>p.name);
        area.value=players.map(p=>p.name).join('\n');
        if(players.length){
          area.readOnly=true;
          status.textContent=`${players.length} jogador(es) importado(s) automaticamente. Você pode trocar para Cadastro manual se precisar editar.`;
        }else{
          area.readOnly=false;
          $('playersAuto').hidden=true;
          $('playersManual').hidden=false;
          document.querySelectorAll('.player-tab').forEach(b=>b.classList.toggle('on',b.dataset.playermode==='manual'));
          area.placeholder='A EA não retornou jogadores. Digite um jogador por linha.';
          status.textContent='A EA não retornou o elenco. O cadastro manual foi liberado automaticamente.';
          area.focus();
        }
      }catch(err){
        area.readOnly=false;
        $('playersAuto').hidden=true;
        $('playersManual').hidden=false;
        document.querySelectorAll('.player-tab').forEach(b=>b.classList.toggle('on',b.dataset.playermode==='manual'));
        area.placeholder='Não foi possível consultar a EA. Digite um jogador por linha.';
        status.textContent='Não foi possível consultar a EA agora. O cadastro manual foi liberado automaticamente.';
        area.focus();
        return;
      }
      return;
    }
    if(x.del){const t=D.teams.find(y=>y.id===x.del),inT=t&&D.tournament&&(D.tournament.teams||[]).includes(t.name);
      if(!confirm(inT?'Este time está no torneio atual. Remover vai apagar o torneio. Continuar?':'Remover este time?'))return;await api('DELETE','/api/teams/'+x.del)}
    else if(x.a==='delall'){if(!D.teams.length)return alert('falta time');if(!confirm(`Apagar TODOS os ${D.teams.length} times${D.tournament?' e o torneio atual':''}? Não dá para desfazer.`))return;await api('DELETE','/api/admin/teams')}
    else if(x.g){const s=D.scorers.find(y=>y.id===x.g);await api('PATCH','/api/admin/scorers/'+x.g,{goals:s.goals+ +x.d})}
    else if(x.ds&&confirm('Remover artilheiro?')){await api('DELETE','/api/admin/scorers/'+x.ds)}
    else if(x.tpay){await api('POST','/api/admin/teampay/'+x.tpay)}
    else if(x.out){await api('POST','/api/logout');ME=null}
    else if(x.a==='gen'){
      const r=await api('GET','/api/data'),evId=$('genev').value;
      if(evId){
        const ev=r.events.find(y=>y.id===evId);if(!ev)return alert('Campeonato não encontrado.');
        if(ev.maxTeams==null)return alert('Esse campeonato ainda não tem a estrutura definida. Clique em Editar na aba Campeonatos e salve com quantos times, grupos, rodadas etc.');
        const ts=r.teams.filter(t=>t.eventId===evId),n=ts.length,c=evc(ev);
        if(!n)return alert('falta time');
        const err=cfgErr(n,c);if(err)return alert(err);
        if(n<c.maxTeams&&!confirm(`Só ${n} de ${c.maxTeams} times estão inscritos. Gerar mesmo assim?`))return;
        if(D.tournament&&!confirm('Isso apaga o torneio atual. Continuar?'))return;
        await api('POST','/api/admin/tournament',{...fresh(c.groups?'groups':'direct',ts.map(t=>t.name),c),event:ev.name});
      }else{
        const mode=$('mode').value,n=r.teams.length,min=mode==='direct'?4:8;
        if(!n)return alert('falta time');
        if(n<min)return alert(`Cadastre pelo menos ${min} times para gerar este formato. Hoje há ${n}.`);
        if(n>16&&!confirm(`Há ${n} times cadastrados, mas o torneio comporta 16. Só os 16 primeiros entram. Continuar?`))return;
        if(D.tournament&&!confirm('Isso apaga o torneio atual. Continuar?'))return;
        const names=r.teams.slice(0,16).map(t=>t.name);
        await api('POST','/api/admin/tournament',fresh(mode,names,{groups:4,rounds:Math.ceil(names.length/4)-1,perGroup:2,thirds:0}));
      }
      tab='champ'}
    await load();
  }catch(err){alert(err.message)}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,a=f.dataset.act,d=Object.fromEntries(new FormData(f));
  try{
    if(a==='login'||a==='register'){await api('POST','/api/'+a,d);tab='home'}
    else if(a==='forgot'){await api('POST','/api/forgot',d);return alert('Se esse e-mail estiver cadastrado, o link de recuperação foi gerado. Confira com a organização (ela recebe o link no terminal do servidor).')}
    else if(a==='reset'){await api('POST','/api/reset',d);location.hash='';alert('Senha alterada! Agora é só entrar.')}
    else if(a==='team'){await api('POST','/api/teams',{...d,players:d.players.split('\n').map(x=>x.trim()).filter(Boolean),eaPlayers:d.players.split('\n').map(x=>x.trim()).filter(Boolean),paid:!!paid[d.eventId]});delete paid[d.eventId];tab='teams';alert('Time inscrito! Lembre-se de enviar o comprovante do Pix para '+PIX_NUM+'.')}
    else if(a==='event'){const id=d.id;delete d.id;if(id)await api('PATCH','/api/admin/events/'+id,d);else await api('POST','/api/admin/events',d);editEv=null}
    else if(a==='scorer'){await api('POST','/api/admin/scorers',d)}
    await load();
  }catch(err){alert(err.message)}
});
document.addEventListener('change',async e=>{
  const d=e.target.dataset;if(!d.f||!ADM())return;
  const m=d.s[0]==='g'?S.gm[+d.s.slice(1)][+d.k]:S.ko[d.k];m[d.f]=num(e.target.value);
  try{await api('POST','/api/admin/tournament',S);render()}catch(err){alert(err.message)}
});
document.addEventListener('input',e=>{const f=e.target.closest&&e.target.closest('form[data-act=event]');if(f)syncEv(f);if(e.target.id==='genev')syncUI()});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.ev){evSel=e.target.dataset.ev;go('enroll')}});
if(location.hash.startsWith('#reset='))tab='account';
load();
