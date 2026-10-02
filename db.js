// Camada de armazenamento.
// - Com DATABASE_URL: salva online em PostgreSQL (Supabase, Neon, Railway, Render...).
// - Sem DATABASE_URL: usa o arquivo db.json (apenas para testes locais).
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const EMPTY = () => ({ campeonatos: [] });
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let mode = 'arquivo';

// ---------- Modo arquivo (fallback local) ----------
let fileQueue = Promise.resolve();
function readFileDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return EMPTY(); }
}
function fileMutate(fn) {
  const run = fileQueue.then(async () => {
    const db = readFileDB();
    const result = await fn(db);
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return result;
  });
  fileQueue = run.catch(() => {});
  return run;
}

// ---------- Modo PostgreSQL ----------
async function init() {
  if (!DATABASE_URL) {
    console.warn('[db] DATABASE_URL não definida: usando db.json (os dados NÃO ficam online).');
    return;
  }
  const { Pool } = require('pg');
  const ssl = process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false };
  pool = new Pool({ connectionString: DATABASE_URL, ssl, max: 5 });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id         INTEGER PRIMARY KEY,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  // Primeira execução: importa o db.json existente (se houver) ou cria vazio.
  const inicial = fs.existsSync(DB_FILE) ? readFileDB() : EMPTY();
  await pool.query(
    'INSERT INTO app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING',
    [JSON.stringify(inicial)]
  );
  mode = 'postgres';
  console.log('[db] Conectado ao PostgreSQL. Dados salvos online.');
}

async function read() {
  if (!pool) return readFileDB();
  const { rows } = await pool.query('SELECT data FROM app_state WHERE id = 1');
  return rows[0]?.data || EMPTY();
}

// Lê, altera e grava de forma atômica (trava a linha, evita perder dados
// quando duas pessoas se inscrevem ao mesmo tempo).
async function mutate(fn) {
  if (!pool) return fileMutate(fn);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
    const db = rows[0]?.data || EMPTY();
    const result = await fn(db);
    await client.query('UPDATE app_state SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(db)]);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Erro "de negócio" lançado dentro de mutate() para devolver status HTTP.
class HttpError extends Error {
  constructor(status, body) { super(body?.erro || 'Erro'); this.status = status; this.body = body; }
}

module.exports = { init, read, mutate, HttpError, getMode: () => mode };
