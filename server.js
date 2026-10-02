const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';
const DEFAULT_PLATFORM = process.env.EA_PLATFORM || 'common-gen5';
const EA_BASE = 'https://proclubs.ea.com/api/fc';
const EA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.ea.com/'
};
const uid = () => crypto.randomBytes(6).toString('hex');

function adminOnly(req, res, next) {
  if (req.get('x-admin-token') !== ADMIN_TOKEN)
    return res.status(401).json({ erro: 'Senha de admin inválida.' });
  next();
}

function platformOf(value) {
  const allowed = ['common-gen5', 'common-gen4', 'ps5', 'xbsx', 'pc'];
  return allowed.includes(value) ? value : DEFAULT_PLATFORM;
}

async function eaGet(pathname, params = {}) {
  const qs = new URLSearchParams(params);
  const url = `${EA_BASE}${pathname}?${qs.toString()}`;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers: EA_HEADERS, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`EA respondeu ${r.status}`);
      return await r.json();
    } catch (e) {
      lastError = e;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.members)) return data.members;
  if (Array.isArray(data.clubs)) return data.clubs;
  if (Array.isArray(data.results)) return data.results;
  return Object.values(data).filter(v => v && typeof v === 'object');
}

function normalizeClub(c) {
  const id = c?.clubId ?? c?.clubID ?? c?.clubInfo?.clubId ?? c?.id;
  const nome = c?.name ?? c?.clubName ?? c?.clubInfo?.name ?? c?.clubInfo?.clubName;
  if (id == null || !nome) return null;
  return {
    clubId: String(id),
    nome: String(nome),
    tag: c?.clubTag ?? c?.tag ?? '',
    owner: c?.ownerName ?? c?.owner ?? '',
    division: c?.division ?? c?.currentDivision ?? null,
    platform: c?.platform || null
  };
}

async function buscarClubes(nome, platform) {
  const data = await eaGet('/currentSeasonLeaderboard/search', {
    platform: platformOf(platform),
    clubName: nome,
    maxResultCount: '50'
  });
  const lista = asArray(data).map(normalizeClub).filter(Boolean);
  const seen = new Set();
  return lista.filter(c => !seen.has(c.clubId) && seen.add(c.clubId));
}

function normalizePlayer(j) {
  const nome = j?.name ?? j?.playerName ?? j?.gamertag ?? j?.userName ?? j?.displayName;
  if (!nome) return null;
  return {
    nome: String(nome),
    playerId: j?.playerId ?? j?.blazeId ?? j?.id ?? null,
    posicao: j?.favoritePosition ?? j?.position ?? j?.preferredPosition ?? '',
    overall: Number(j?.proOverall ?? j?.overall ?? j?.rating ?? 0) || 0,
    jogos: Number(j?.gamesPlayed ?? j?.matchesPlayed ?? j?.games ?? 0) || 0,
    gols: Number(j?.goals ?? 0) || 0,
    assistencias: Number(j?.assists ?? j?.assistsMade ?? 0) || 0,
    motm: Number(j?.manOfTheMatch ?? j?.motm ?? 0) || 0
  };
}

async function buscarElenco(clubId, platform) {
  const params = { platform: platformOf(platform), clubId: String(clubId) };
  // Career stats é a rota que retorna os membros do clube; members/stats é fallback.
  let data;
  try {
    data = await eaGet('/members/career/stats', params);
  } catch (_) {
    data = await eaGet('/members/stats', params);
  }
  const jogadores = asArray(data).map(normalizePlayer).filter(Boolean);
  if (!jogadores.length) throw new Error('A EA não retornou membros para este clube.');
  const seen = new Set();
  return jogadores.filter(j => {
    const key = String(j.playerId || j.nome).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

async function buscarInfoClube(clubId, platform) {
  const data = await eaGet('/clubs/info', { platform: platformOf(platform), clubIds: String(clubId) });
  const obj = data?.[clubId] || data?.[String(clubId)] || data;
  return obj && typeof obj === 'object' ? obj : {};
}

// Busca clubes para o front escolher o correto.
app.get('/api/ea/clube/:nome', async (req, res) => {
  try {
    const platform = platformOf(req.query.platform);
    res.json(await buscarClubes(req.params.nome, platform));
  } catch (e) {
    res.status(502).json({ erro: 'Não foi possível consultar a EA agora.', detalhe: e.message });
  }
});

// Detalhes + elenco de um clube antes de inscrever.
app.get('/api/ea/clube/:clubId/elenco', async (req, res) => {
  try {
    const platform = platformOf(req.query.platform);
    const clubId = String(req.params.clubId);
    const info = await buscarInfoClube(clubId, platform);
    const jogadores = await buscarElenco(clubId, platform);
    res.json({ clubId, platform, nome: info.name || info.clubName || '', info, jogadores });
  } catch (e) {
    res.status(502).json({ erro: 'Não foi possível carregar o clube/elenco na EA.', detalhe: e.message });
  }
});

function sendError(res, e, fallback) {
  if (e instanceof db.HttpError) return res.status(e.status).json(e.body);
  console.error(e);
  res.status(500).json({ erro: fallback || 'Erro interno ao acessar o banco de dados.', detalhe: e.message });
}

app.get('/api/saude', async (req, res) => {
  try { await db.read(); res.json({ ok: true, armazenamento: db.getMode() }); }
  catch (e) { res.status(500).json({ ok: false, armazenamento: db.getMode(), detalhe: e.message }); }
});

app.get('/api/campeonatos', async (req, res) => {
  try { res.json((await db.read()).campeonatos); }
  catch (e) { sendError(res, e); }
});

app.post('/api/campeonatos', adminOnly, async (req, res) => {
  const { data, nome, formato, valor, descricao, vagas } = req.body;
  if (!data || !nome) return res.status(400).json({ erro: 'Data e nome são obrigatórios.' });
  try {
    const camp = await db.mutate(d => {
      const novo = { id: uid(), data, nome, formato: formato || '6x6', valor: Number(valor) || 0, descricao: descricao || '', vagas: Number(vagas) || 16, times: [] };
      d.campeonatos.push(novo);
      return novo;
    });
    res.status(201).json(camp);
  } catch (e) { sendError(res, e); }
});

app.delete('/api/campeonatos/:id', adminOnly, async (req, res) => {
  try {
    await db.mutate(d => {
      const antes = d.campeonatos.length;
      d.campeonatos = d.campeonatos.filter(c => c.id !== req.params.id);
      if (d.campeonatos.length === antes) throw new db.HttpError(404, { erro: 'Campeonato não encontrado.' });
    });
    res.json({ ok: true });
  } catch (e) { sendError(res, e); }
});

app.post('/api/campeonatos/:id/inscrever', async (req, res) => {
  let { clubName, clubId, jogadores, platform } = req.body;
  platform = platformOf(platform);
  try {
    // Pré-checagem (sem travar o banco enquanto consulta a EA).
    const atual = (await db.read()).campeonatos.find(c => c.id === req.params.id);
    if (!atual) return res.status(404).json({ erro: 'Campeonato não encontrado.' });
    if (atual.times.length >= atual.vagas) return res.status(400).json({ erro: 'Campeonato lotado.' });

    if (!clubId) {
      if (!clubName) return res.status(400).json({ erro: 'Informe o nome do clube.' });
      const achados = await buscarClubes(clubName, platform);
      const exatos = achados.filter(c => c.nome?.toLowerCase() === clubName.toLowerCase());
      const escolhido = exatos.length === 1 ? exatos[0] : (achados.length === 1 ? achados[0] : null);
      if (!escolhido) return res.status(achados.length ? 409 : 404).json({ erro: achados.length ? 'Mais de um clube encontrado. Escolha o correto.' : 'Clube não encontrado na EA.', opcoes: achados });
      clubId = escolhido.clubId; clubName = escolhido.nome;
    }

    if (atual.times.some(t => t.clubId === String(clubId) && t.platform === platform))
      return res.status(400).json({ erro: 'Esse clube já está inscrito nesta plataforma.' });

    let elenco;
    try {
      elenco = await buscarElenco(clubId, platform);
    } catch (e) {
      if (Array.isArray(jogadores) && jogadores.length) {
        elenco = jogadores.map(n => ({ nome: String(n), playerId: null, posicao: '', overall: 0, jogos: 0, gols: 0, assistencias: 0, motm: 0 }));
      } else {
        return res.status(502).json({ erro: 'A EA não retornou o elenco. Tente novamente ou use o cadastro manual.', detalhe: e.message });
      }
    }

    const info = await buscarInfoClube(clubId, platform).catch(() => ({}));
    clubName = clubName || info.name || info.clubName || `Clube ${clubId}`;
    const time = { id: uid(), clubId: String(clubId), nome: clubName, platform, jogadores: elenco, eaInfo: info, inscritoEm: new Date().toISOString() };

    // Grava de forma atômica, revalidando vagas e duplicidade.
    await db.mutate(d => {
      const camp = d.campeonatos.find(c => c.id === req.params.id);
      if (!camp) throw new db.HttpError(404, { erro: 'Campeonato não encontrado.' });
      if (camp.times.length >= camp.vagas) throw new db.HttpError(400, { erro: 'Campeonato lotado.' });
      if (camp.times.some(t => t.clubId === String(clubId) && t.platform === platform))
        throw new db.HttpError(400, { erro: 'Esse clube já está inscrito nesta plataforma.' });
      camp.times.push(time);
    });
    res.status(201).json(time);
  } catch (e) {
    if (e instanceof db.HttpError) return sendError(res, e);
    res.status(502).json({ erro: 'Falha ao consultar a EA ou salvar no banco.', detalhe: e.message });
  }
});

app.post('/api/campeonatos/:id/times/:timeId/atualizar', async (req, res) => {
  try {
    const camp0 = (await db.read()).campeonatos.find(c => c.id === req.params.id);
    const time0 = camp0?.times.find(t => t.id === req.params.timeId);
    if (!time0) return res.status(404).json({ erro: 'Time não encontrado.' });
    const plat = time0.platform || DEFAULT_PLATFORM;

    const jogadores = await buscarElenco(time0.clubId, plat);
    const eaInfo = await buscarInfoClube(time0.clubId, plat).catch(() => time0.eaInfo || {});

    const atualizado = await db.mutate(d => {
      const time = d.campeonatos.find(c => c.id === req.params.id)?.times.find(t => t.id === req.params.timeId);
      if (!time) throw new db.HttpError(404, { erro: 'Time não encontrado.' });
      time.jogadores = jogadores;
      time.eaInfo = eaInfo;
      time.atualizadoEm = new Date().toISOString();
      return time;
    });
    res.json(atualizado);
  } catch (e) {
    if (e instanceof db.HttpError) return sendError(res, e);
    res.status(502).json({ erro: 'Falha ao consultar a EA ou salvar no banco.', detalhe: e.message });
  }
});

app.delete('/api/campeonatos/:id/times/:timeId', adminOnly, async (req, res) => {
  try {
    await db.mutate(d => {
      const camp = d.campeonatos.find(c => c.id === req.params.id);
      if (!camp) throw new db.HttpError(404, { erro: 'Campeonato não encontrado.' });
      camp.times = camp.times.filter(t => t.id !== req.params.timeId);
    });
    res.json({ ok: true });
  } catch (e) { sendError(res, e); }
});

db.init()
  .then(() => app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`)))
  .catch(e => { console.error('Falha ao iniciar o banco de dados:', e.message); process.exit(1); });
