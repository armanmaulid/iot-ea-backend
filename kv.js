// lib/kv.js
// ─────────────────────────────────────────────────────────────────────
//  KV client + key schema helpers.
//
//  Env vars (auto-inject dari Upstash "iOT_DataStore" database):
//    iOT_DataStore_KV_REST_API_URL    = https://devoted-heron-19215.upstash.io
//    iOT_DataStore_KV_REST_API_TOKEN  = AusPAAIncDE4MjY3...
//
//  Key schema:
//    ea:{magic}:{symbol}      → EAState (TTL 5 min)
//    cmd:{magic}:{symbol}     → PendingCommand (TTL 60s)
//    hist:{magic}:{symbol}    → TradeHistory[] (max 500)
//    eq:{magic}:{symbol}      → EquityPoint[] (max 200, TTL 24h)
//    instances                → InstanceInfo[]
// ─────────────────────────────────────────────────────────────────────
import { Redis } from "@upstash/redis";

// Upstash Redis client — pakai env vars dari Vercel integration
export const kv = new Redis({
  url:   process.env.iOT_DataStore_KV_REST_API_URL,
  token: process.env.iOT_DataStore_KV_REST_API_TOKEN,
});

// ── Constants ────────────────────────────────────────────────────────
export const MAX_HISTORY   = 500;
export const STALE_TIMEOUT = 120; // detik

// ── Key builders ─────────────────────────────────────────────────────
export const Keys = {
  state:     (magic, symbol) => `ea:${magic}:${symbol}`,
  command:   (magic, symbol) => `cmd:${magic}:${symbol}`,
  history:   (magic, symbol) => `hist:${magic}:${symbol}`,
  equity:    (magic, symbol) => `eq:${magic}:${symbol}`,
  instances: ()              => `instances`,
};

// ── Instance registry ─────────────────────────────────────────────────
export async function registerInstance(magic, symbol, accountType) {
  const key  = Keys.instances();
  const list = (await kv.get(key)) || [];
  const id   = `${magic}:${symbol}`;
  const idx  = list.findIndex(x => x.id === id);
  const entry = {
    id,
    magic:       Number(magic),
    symbol,
    accountType: accountType || "UNKNOWN",
    lastSeen:    Math.floor(Date.now() / 1000),
  };
  if (idx >= 0) list[idx] = entry;
  else          list.push(entry);
  await kv.set(key, list);
}

export async function getInstances() {
  const list = (await kv.get(Keys.instances())) || [];
  const now  = Math.floor(Date.now() / 1000);
  return list.map(x => ({
    ...x,
    online:   (now - x.lastSeen) <= STALE_TIMEOUT,
    staleFor: Math.max(0, now - x.lastSeen - STALE_TIMEOUT),
  }));
}

// ── Trade history ─────────────────────────────────────────────────────
export async function appendTrade(magic, symbol, trade) {
  const key  = Keys.history(magic, symbol);
  const hist = (await kv.get(key)) || [];
  if (hist.some(t => t.ticket === trade.ticket)) return; // skip duplikat
  hist.unshift({ ...trade, addedAt: Date.now() });
  if (hist.length > MAX_HISTORY) hist.splice(MAX_HISTORY);
  await kv.set(key, hist);
}

// ── Response helpers ─────────────────────────────────────────────────
export const ok  = (data)        => Response.json({ ok: true,  ...data });
export const err = (msg, status=400) => Response.json({ ok: false, error: msg }, { status });

// ── Auth ─────────────────────────────────────────────────────────────
export function checkToken(req) {
  const expected = process.env.EA_SECRET_TOKEN;
  if (!expected) return true; // dev mode — skip auth jika belum di-set
  const header = req.headers.get("x-ea-token");
  const url    = new URL(req.url);
  const query  = url.searchParams.get("token");
  return header === expected || query === expected;
}
