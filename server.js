const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { campeonatos: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
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

app.get('/api/campeonatos', (req, res) => res.json(loadDB().campeonatos));

app.post('/api/campeonatos', adminOnly, (req, res) => {
  const { data, nome, formato, valor, descricao, vagas } = req.body;
  if (!data || !nome) return res.status(400).json({ erro: 'Data e nome são obrigatórios.' });
  const db = loadDB();
  const camp = { id: uid(), data, nome, formato: formato || '6x6', valor: Number(valor) || 0, descricao: descricao || '', vagas: Number(vagas) || 16, times: [] };
  db.campeonatos.push(camp); saveDB(db); res.status(201).json(camp);
});

app.delete('/api/campeonatos/:id', adminOnly, (req, res) => {
  const db = loadDB();
  const antes = db.campeonatos.length;
  db.campeonatos = db.campeonatos.filter(c => c.id !== req.params.id);
  if (db.campeonatos.length === antes) return res.status(404).json({ erro: 'Campeonato não encontrado.' });
  saveDB(db); res.json({ ok: true });
});

app.post('/api/campeonatos/:id/inscrever', async (req, res) => {
  const db = loadDB();
  const camp = db.campeonatos.find(c => c.id === req.params.id);
  if (!camp) return res.status(404).json({ erro: 'Campeonato não encontrado.' });
  if (camp.times.length >= camp.vagas) return res.status(400).json({ erro: 'Campeonato lotado.' });

  let { clubName, clubId, jogadores, platform } = req.body;
  platform = platformOf(platform);
  try {
    if (!clubId) {
      if (!clubName) return res.status(400).json({ erro: 'Informe o nome do clube.' });
      const achados = await buscarClubes(clubName, platform);
      const exatos = achados.filter(c => c.nome?.toLowerCase() === clubName.toLowerCase());
      const escolhido = exatos.length === 1 ? exatos[0] : (achados.length === 1 ? achados[0] : null);
      if (!escolhido) return res.status(achados.length ? 409 : 404).json({ erro: achados.length ? 'Mais de um clube encontrado. Escolha o correto.' : 'Clube não encontrado na EA.', opcoes: achados });
      clubId = escolhido.clubId; clubName = escolhido.nome;
    }

    if (camp.times.some(t => t.clubId === String(clubId) && t.platform === platform))
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
    camp.times.push(time); saveDB(db); res.status(201).json(time);
  } catch (e) {
    res.status(502).json({ erro: 'Falha ao consultar a EA.', detalhe: e.message });
  }
});

app.post('/api/campeonatos/:id/times/:timeId/atualizar', async (req, res) => {
  const db = loadDB();
  const camp = db.campeonatos.find(c => c.id === req.params.id);
  const time = camp?.times.find(t => t.id === req.params.timeId);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado.' });
  try {
    time.jogadores = await buscarElenco(time.clubId, time.platform || DEFAULT_PLATFORM);
    time.eaInfo = await buscarInfoClube(time.clubId, time.platform || DEFAULT_PLATFORM).catch(() => time.eaInfo || {});
    time.atualizadoEm = new Date().toISOString();
    saveDB(db); res.json(time);
  } catch (e) { res.status(502).json({ erro: 'Falha ao consultar a EA.', detalhe: e.message }); }
});

app.delete('/api/campeonatos/:id/times/:timeId', adminOnly, (req, res) => {
  const db = loadDB();
  const camp = db.campeonatos.find(c => c.id === req.params.id);
  if (!camp) return res.status(404).json({ erro: 'Campeonato não encontrado.' });
  camp.times = camp.times.filter(t => t.id !== req.params.timeId);
  saveDB(db); res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
