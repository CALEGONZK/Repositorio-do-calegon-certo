let D={teams:[],tournament:null,scorers:[],events:[]},ME=null,S=null,tab='home',evSel=null,editEv=null,paid={};
const PIX_NUM='19997262373',PIX_LINK='https://cobranca.c6pix.com.br/01M3QPR3VXBETB80S0CN9GGX9V';
const fdate=d=>String(d).split('-').reverse().join('/'),brl=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const evName=id=>{const e=D.events.find(x=>x.id===id);return e?e.name:''};
const $=id=>document.getElementById(id),view=$('view');
const api=(m,u,b)=>fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Erro');return j});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ADM=()=>ME&&ME.admin;
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const num=v=>v===''||v==null||isNaN(v)?null:+v;
const RULES=["As partidas são disputadas no formato 6x6, contando o goleiro, salvo indicação diferente da organização.","Somente atletas cadastrados na lista oficial podem entrar em campo. É proibido incluir jogadores fora da lista após o início.","É proibido assumir o controle manual do goleiro fora das situações de bola parada permitidas pela competição.","Os capitães devem confirmar presença no canal oficial antes da partida. Quem não confirmar dentro do prazo poderá receber W.O. Após a confirmação dos dois capitães, haverá tolerância de 10 minutos para o início. Nenhum confronto poderá começar sem a confirmação das duas equipes.","Bugs ou falhas técnicas no início serão avaliados pela organização, que poderá autorizar novo confronto conforme as provas.","Quedas de conexão devem ser comunicadas imediatamente. A organização decidirá entre reiniciar, manter o placar ou aplicar W.O., considerando tempo, placar e evidências.","Prints, vídeos ou outras provas solicitadas pela arbitragem devem ser enviados no prazo definido. Sem provas suficientes, o resultado registrado será mantido.","É proibido explorar bugs, glitches ou usar ferramentas externas para obter vantagem. Posicionar jogadores na frente do goleiro em cobranças de falta para burlar a mecânica também será infração.","Todas as equipes devem manter respeito com adversários, árbitros e organização. Discriminação, ameaças, spam e atitudes antidesportivas poderão resultar em advertência, perda de pontos ou desligamento.","Datas, horários, chaveamento e critérios de classificação serão divulgados antes de cada edição, podendo sofrer ajustes.","Em partidas que exigem um vencedor, o empate será decidido pelo critério definido para a fase, como prorrogação ou pênaltis.","A organização analisará denúncias e aplicará as punições previstas, podendo agir conforme o espírito esportivo em situações não previstas.","A premiação será divulgada antes de cada edição e paga conforme os dados e prazos definidos."];
/* ---------- torneio ---------- */
function fresh(mode,names){
  const ids=shuf(names.map((_,i)=>i)),groups=[[],[],[],[]];ids.forEach((t,i)=>groups[i%4].push(t));
  const P=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
  return{mode,teams:names,groups,gm:groups.map(g=>P.flatMap((r,ri)=>r.map(([x,y])=>({a:g[x],b:g[y],sa:null,sb:null})))),ko:{},dseed:shuf(names.map((_,i)=>i))};
}
function table(gi){
  const r={};S.groups[gi].forEach(t=>r[t]={t,p:0,j:0,v:0,e:0,d:0,gp:0,gc:0});
  S.gm[gi].forEach(m=>{if(m.sa==null||m.sb==null)return;const A=r[m.a],B=r[m.b];A.j++;B.j++;A.gp+=m.sa;A.gc+=m.sb;B.gp+=m.sb;B.gc+=m.sa;
    if(m.sa>m.sb){A.v++;A.p+=3;B.d++}else if(m.sa<m.sb){B.v++;B.p+=3;A.d++}else{A.e++;B.e++;A.p++;B.p++}});
  return Object.values(r).sort((x,y)=>y.p-x.p||(y.gp-y.gc)-(x.gp-x.gc)||y.gp-x.gp||x.t-y.t);
}
const groupsDone=()=>S.gm.every(g=>g.every(m=>m.sa!=null&&m.sb!=null));
function res(m){if(m.a==null||m.b==null||m.sa==null||m.sb==null)return{};let d=m.sa-m.sb;if(!d&&m.pa!=null&&m.pb!=null)d=m.pa-m.pb;if(!d)return{};return d>0?{w:m.a,l:m.b}:{w:m.b,l:m.a}}
function getKO(){
  let first;
  if(S.mode==='direct')first=S.dseed;
  else{if(!groupsDone())return null;const T=S.groups.map((_,i)=>table(i).map(x=>x.t));first=[T[0][0],T[1][1],T[2][0],T[3][1],T[1][0],T[0][1],T[3][0],T[2][1]]}
  const names={16:'Oitavas',8:'Quartas',4:'Semifinais',2:'Final'},rounds=[];let size=first.length,r=0;
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
const nm=t=>t==null?'A definir':esc(S.teams[t]);
function mh(m,store,key){
  const r=res(m),ok=m.a!=null&&m.b!=null&&ADM(),tie=m.a!=null&&m.b!=null&&m.sa!=null&&m.sa===m.sb;
  const inp=f=>`<input type="number" min="0" ${ok?'':'disabled'} value="${m[f]??''}" data-s="${store}" data-k="${key}" data-f="${f}" aria-label="gols">`;
  return`<div class="m"><span class="${r.w===m.a&&r.w!=null?'w':''}">${nm(m.a)}</span>${inp('sa')}<span>x</span>${inp('sb')}<span class="${r.w===m.b&&r.w!=null?'w':''}">${nm(m.b)}</span>${tie?`<div class="pen">Pênaltis: ${inp('pa')} x ${inp('pb')}</div>`:''}</div>`;
}
function champHTML(){
  if(!S)return`<h2>Campeonato</h2><div class="card"><p>O campeonato ainda não foi gerado. ${ADM()?'Vá na aba Admin e clique em "Gerar torneio".':'A organização vai iniciar em breve. Acompanhe no Discord.'}</p></div>`;
  let h='<h2>Campeonato</h2>';
  if(S.mode==='groups'){
    h+='<p class="note">Os 2 primeiros de cada grupo avançam para as quartas.</p><div class="grid">';
    S.groups.forEach((g,i)=>{h+=`<div class="card"><h3>Grupo ${'ABCD'[i]}</h3><table><tr><th></th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>`+
      table(i).map((x,p)=>`<tr class="${p<2?'q':''}"><td>${p+1}</td><td>${nm(x.t)}</td><td><b>${x.p}</b></td><td>${x.j}</td><td>${x.v}</td><td>${x.e}</td><td>${x.d}</td><td>${x.gp-x.gc}</td></tr>`).join('')+
      '</table><h3 style="margin-top:14px">Jogos</h3>'+S.gm[i].map((m,mi)=>mh(m,'g'+i,mi)).join('')+'</div>'});h+='</div>';
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
admin:()=>{if(!ADM())return'<p class="note">Área restrita.</p>';return`<h2>Painel do administrador</h2><div class="grid">
<div class="card"><h3>1. Completar times</h3><p>Preenche as vagas que faltam até 16 times com times automáticos.</p><p style="margin-top:10px"><button data-a="auto">Adicionar times automaticamente</button></p></div>
<div class="card"><h3>2. Gerar torneio</h3><p>Completa para 16 times, sorteia os grupos e monta o mata-mata. Apaga o torneio atual.</p><p style="margin-top:10px"><select id="mode"><option value="groups">Grupos + Quartas</option><option value="direct">Mata-mata direto (Oitavas)</option></select></p><p style="margin-top:10px"><button data-a="gen">Gerar torneio</button></p></div>
<div class="card"><h3>3. Resultados e artilheiros</h3><p>Digite os placares na aba Campeonato e gerencie os goleadores na aba Artilheiros. Só administradores editam.</p></div></div>`}
};

function evForm(){const e=editEv?D.events.find(x=>x.id===editEv):null;
  return`<form class="f" data-act="event"><input type="hidden" name="id" value="${e?e.id:''}"><label>Data<input name="date" type="date" required value="${e?e.date:''}"></label><label>Nome do campeonato<input name="name" required maxlength="50" value="${esc(e?e.name:'')}"></label><label>Formato<input name="format" maxlength="20" value="${esc(e?e.format:'6x6')}"></label><label>Valor da inscrição (R$)<input name="price" type="number" min="0" step="0.01" value="${e?e.price:30}"></label><label>Descrição (opcional)<input name="desc" maxlength="200" value="${esc(e?e.desc:'')}"></label><div class="row"><button>${e?'Salvar alterações':'Criar campeonato'}</button>${e?'<button type="button" class="sec" data-evcancel="1">Cancelar</button>':''}</div></form>`}
TABS.events=()=>{const L=[...D.events].sort((x,y)=>x.date.localeCompare(y.date));
  return`<h2>Campeonatos</h2><p class="note">Clique em um campeonato para inscrever seu time.</p>`+(L.length?`<div class="evgrid">${L.map(e=>{const n=D.teams.filter(t=>t.eventId===e.id).length;
    return`<div class="ev" data-ev="${e.id}" role="button" tabindex="0"><div><span class="tag">${fdate(e.date)}</span><span class="tag">${esc(e.format)}</span></div><h3>${esc(e.name)}</h3>${e.desc?`<p>${esc(e.desc)}</p>`:''}<div class="evf"><b>${brl(e.price)}</b><span class="note">${n} time${n===1?'':'s'}</span><span class="go">Inscrever time →</span>${ADM()?`<span class="row"><button class="sec" data-evedit="${e.id}">Editar</button><button class="del" data-evdel="${e.id}">Excluir</button></span>`:''}</div></div>`}).join('')}</div>`:'<div class="card"><p>Nenhum campeonato aberto por enquanto.</p></div>')+
  (ADM()?`<h2>${editEv?'Editar campeonato':'Novo campeonato'}</h2>${evForm()}`:'')};
TABS.enroll=()=>{const e=D.events.find(x=>x.id===evSel);
  if(!e)return'<p class="note">Campeonato não encontrado.</p><button data-go="events">Voltar</button>';
  const back='<p><a href="#" data-go="events" style="color:var(--lt)">← Voltar aos campeonatos</a></p>';
  const head=`${back}<h2>${esc(e.name)}</h2><p class="note">${fdate(e.date)} · formato ${esc(e.format)} · inscrição ${brl(e.price)}</p>${e.desc?`<p>${esc(e.desc)}</p>`:''}`;
  if(!ME)return head+'<div class="card"><p>Para inscrever um time, <a href="#" data-go="account" style="color:var(--lt)">entre ou crie sua conta</a>.</p></div>';
  const pay=`<div class="card" style="max-width:460px"><h3>1. Pague a inscrição com Pix — ${brl(e.price)}</h3><img class="qr" src="pix-qr.png" alt="QR Code Pix"><p>Número do Pix: <b>${PIX_NUM}</b> <button class="sec" data-copy="${PIX_NUM}">Copiar</button></p><p style="margin-top:10px"><a class="btn" href="${PIX_LINK}" target="_blank" rel="noopener">Pagar pelo link</a></p><p style="margin-top:12px"><b>Depois de pagar, envie o comprovante para o WhatsApp <a href="https://wa.me/55${PIX_NUM}" target="_blank" rel="noopener" style="color:var(--lt)">${PIX_NUM}</a>.</b></p>${paid[e.id]?'<p style="margin-top:10px"><span class="tag">Pagamento informado</span></p>':'<p style="margin-top:12px"><button data-paid="1">Já paguei</button></p>'}</div>`;
  const form=paid[e.id]?`<h3 style="margin-top:20px">2. Dados do time</h3><form class="f" data-act="team"><input type="hidden" name="eventId" value="${e.id}"><label>Nome do time<input name="name" required maxlength="30"></label><label>Capitão<input name="captain" required maxlength="30"></label><label>Jogadores (um nome por linha)<textarea name="players" rows="6" required placeholder="Jogador 1&#10;Jogador 2"></textarea></label><button>Inscrever time</button></form>`:'<p class="note" style="margin-top:14px">Depois de pagar e clicar em "Já paguei", os dados do time serão liberados.</p>';
  return head+pay+form};
const NAV=[['home','Início'],['events','Campeonatos'],['champ','Campeonato'],['teams','Times'],['scorers','Artilheiros'],['rules','Regras'],['account',()=>ME?'Conta':'Entrar']];
function render(){
  const nav=[...NAV];if(ADM())nav.push(['admin','Admin']);
  $('nav').innerHTML=nav.map(([k,l])=>`<a data-go="${k}" class="${k===tab||(k==='events'&&tab==='enroll')?'on':''}">${typeof l==='function'?l():l}</a>`).join('');
  S=D.tournament;view.innerHTML=TABS[tab]();
}
const go=t=>{tab=t;render();scrollTo(0,0)};
async function load(){[D,ME]=await Promise.all([api('GET','/api/data'),api('GET','/api/me').then(r=>r.user)]);render()}
document.addEventListener('click',async e=>{
  const d=e.target.closest('[data-go],[data-del],[data-g],[data-ds],[data-out],[data-a],[data-ev],[data-evedit],[data-evdel],[data-evcancel],[data-paid],[data-tpay],[data-copy]');if(!d)return;const x=d.dataset;
  try{
    if(x.go){e.preventDefault();return go(x.go)}
    if(x.ev){evSel=x.ev;return go('enroll')}
    if(x.evedit){editEv=x.evedit;render();return scrollTo(0,document.body.scrollHeight)}
    if(x.evcancel){editEv=null;return render()}
    if(x.paid){paid[evSel]=true;return render()}
    if(x.copy){await navigator.clipboard.writeText(x.copy).catch(()=>{});return alert('Número copiado!')}
    if(x.del&&confirm('Remover este time?')){await api('DELETE','/api/teams/'+x.del)}
    else if(x.g){const s=D.scorers.find(y=>y.id===x.g);await api('PATCH','/api/admin/scorers/'+x.g,{goals:s.goals+ +x.d})}
    else if(x.ds&&confirm('Remover artilheiro?')){await api('DELETE','/api/admin/scorers/'+x.ds)}
    else if(x.evdel){if(!confirm('Excluir este campeonato?'))return;await api('DELETE','/api/admin/events/'+x.evdel)}
    else if(x.tpay){await api('POST','/api/admin/teampay/'+x.tpay)}
    else if(x.out){await api('POST','/api/logout');ME=null}
    else if(x.a==='auto'){await api('POST','/api/admin/autoteams')}
    else if(x.a==='gen'){if(D.tournament&&!confirm('Isso apaga o torneio atual. Continuar?'))return;
      await api('POST','/api/admin/autoteams');const r=await api('GET','/api/data');
      await api('POST','/api/admin/tournament',fresh($('mode').value,r.teams.slice(0,16).map(t=>t.name)));tab='champ'}
    await load();
  }catch(err){alert(err.message)}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,a=f.dataset.act,d=Object.fromEntries(new FormData(f));
  try{
    if(a==='login'||a==='register'){await api('POST','/api/'+a,d);tab='home'}
    else if(a==='forgot'){await api('POST','/api/forgot',d);return alert('Se esse e-mail estiver cadastrado, o link de recuperação foi gerado. Confira com a organização (ela recebe o link no terminal do servidor).')}
    else if(a==='reset'){await api('POST','/api/reset',d);location.hash='';alert('Senha alterada! Agora é só entrar.')}
    else if(a==='team'){await api('POST','/api/teams',{...d,players:d.players.split('\n'),paid:!!paid[d.eventId]});delete paid[d.eventId];tab='teams';alert('Time inscrito! Lembre-se de enviar o comprovante do Pix para '+PIX_NUM+'.')}
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
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.ev){evSel=e.target.dataset.ev;go('enroll')}});
if(location.hash.startsWith('#reset='))tab='account';
load();
