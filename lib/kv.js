const { Redis } = require("@upstash/redis");

const kv = new Redis({
  url:   process.env.iOT_DataStore_KV_REST_API_URL,
  token: process.env.iOT_DataStore_KV_REST_API_TOKEN,
});

const MAX_HISTORY   = 500;
const STALE_TIMEOUT = 120;  // detik — threshold online/offline badge
const STATE_TTL     = 300;  // detik — sama dengan TTL state key di /api/push (ex:300)

const Keys = {
  state:     (magic, symbol) => `ea:${magic}:${symbol}`,
  command:   (magic, symbol) => `cmd:${magic}:${symbol}`,
  history:   (magic, symbol) => `hist:${magic}:${symbol}`,
  equity:    (magic, symbol) => `eq:${magic}:${symbol}`,
  instances: ()              => `instances`,
};

async function registerInstance(magic, symbol, accountType) {
  const key  = Keys.instances();
  const list = (await kv.get(key)) || [];
  const id   = `${magic}:${symbol}`;
  const idx  = list.findIndex(x => x.id === id);
  const entry = {
    id,
    magic: Number(magic),
    symbol,
    accountType: accountType || "UNKNOWN",
    lastSeen: Math.floor(Date.now() / 1000),
  };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  await kv.set(key, list);
}

async function getInstances() {
  const key  = Keys.instances();
  const list = (await kv.get(key)) || [];
  const now  = Math.floor(Date.now() / 1000);

  // Filter: hanya instance yang masih dalam STATE_TTL (5 menit)
  // Kalau EA dihapus dari chart, berhenti push, otomatis hilang setelah 5 menit
  const active = list.filter(x => (now - x.lastSeen) <= STATE_TTL);

  // Auto-cleanup: simpan kembali hanya yang aktif jika ada yang dihapus
  if (active.length !== list.length) {
    if (active.length === 0) await kv.del(key);
    else await kv.set(key, active);
  }

  // Kembalikan dengan online flag (lebih ketat: 2 menit tanpa push = offline)
  return active.map(x => ({
    ...x,
    online:   (now - x.lastSeen) <= STALE_TIMEOUT,
    staleFor: Math.max(0, now - x.lastSeen - STALE_TIMEOUT),
  }));
}

async function appendTrade(magic, symbol, trade) {
  const key  = Keys.history(magic, symbol);
  const hist = (await kv.get(key)) || [];
  if (hist.some(t => t.ticket === trade.ticket)) return;
  hist.unshift({ ...trade, addedAt: Date.now() });
  if (hist.length > MAX_HISTORY) hist.splice(MAX_HISTORY);
  await kv.set(key, hist);
}

function checkToken(req) {
  const expected = process.env.EA_SECRET_TOKEN;
  if (!expected) return true;
  return req.headers['x-ea-token'] === expected ||
         req.query?.token          === expected;
}

module.exports = { kv, Keys, registerInstance, getInstances, appendTrade, checkToken };
