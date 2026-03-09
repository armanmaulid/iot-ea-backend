const { Redis } = require("@upstash/redis");

const kv = new Redis({
  url:   process.env.iOT_DataStore_KV_REST_API_URL,
  token: process.env.iOT_DataStore_KV_REST_API_TOKEN,
});

const MAX_HISTORY   = 500;
const STALE_TIMEOUT = 120;

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
  const entry = { id, magic: Number(magic), symbol,
    accountType: accountType || "UNKNOWN",
    lastSeen: Math.floor(Date.now() / 1000) };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  await kv.set(key, list);
}

async function getInstances() {
  const list = (await kv.get(Keys.instances())) || [];
  const now  = Math.floor(Date.now() / 1000);
  return list.map(x => ({
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
