// lib/kv.js
// ─────────────────────────────────────────────────────────────────────────────
//  KV key schema + helpers untuk semua API routes.
//
//  Key schema:
//  ┌─────────────────────────────────────────────────────────────────────┐
//  │  ea:{magic}:{symbol}        → EAState object (latest push dari MT5) │
//  │  cmd:{magic}:{symbol}       → PendingCommand | null                 │
//  │  hist:{magic}:{symbol}      → TradeHistory[] (max MAX_HISTORY)      │
//  │  instances                  → InstanceInfo[] (registry semua EA)    │
//  └─────────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_HISTORY   = 500;   // max trade records per instance
export const STALE_TIMEOUT = 120;   // detik — instance dianggap offline

// ── Key builders ─────────────────────────────────────────────────────────────

export const Keys = {
  state:     (magic, symbol) => `ea:${magic}:${symbol}`,
  command:   (magic, symbol) => `cmd:${magic}:${symbol}`,
  history:   (magic, symbol) => `hist:${magic}:${symbol}`,
  instances: ()              => `instances`,
};

// ── Instance registry ─────────────────────────────────────────────────────────
//  Menyimpan list EA yang pernah push data.
//  Mini App pakai ini untuk tampilkan dropdown pair selector.

/**
 * Register / update instance dalam registry.
 * Dipanggil setiap kali /api/push berhasil.
 */
export async function registerInstance(kv, magic, symbol, accountType) {
  const key  = Keys.instances();
  const list = (await kv.get(key)) || [];

  const id  = `${magic}:${symbol}`;
  const idx = list.findIndex(x => x.id === id);
  const entry = {
    id,
    magic:       Number(magic),
    symbol,
    accountType: accountType || "UNKNOWN",
    lastSeen:    Math.floor(Date.now() / 1000),
  };

  if(idx >= 0) list[idx] = entry;
  else         list.push(entry);

  await kv.set(key, list);
}

/**
 * Ambil semua instance. Filter yang sudah stale (offline > STALE_TIMEOUT detik).
 */
export async function getInstances(kv) {
  const list = (await kv.get(Keys.instances())) || [];
  const now  = Math.floor(Date.now() / 1000);
  return list.map(x => ({
    ...x,
    online: (now - x.lastSeen) <= STALE_TIMEOUT,
    staleFor: Math.max(0, now - x.lastSeen - STALE_TIMEOUT),
  }));
}

// ── History helpers ────────────────────────────────────────────────────────────

/**
 * Append trade ke history. Otomatis trim jika > MAX_HISTORY.
 * trade = { ticket, dir, symbol, entry, close, sl, tp, lots, profit,
 *           openTime, closeTime, closeReason, pips }
 */
export async function appendTrade(kv, magic, symbol, trade) {
  const key  = Keys.history(magic, symbol);
  const hist = (await kv.get(key)) || [];

  // Cegah duplikat berdasarkan ticket
  if(hist.some(t => t.ticket === trade.ticket)) return;

  hist.unshift({ ...trade, addedAt: Date.now() }); // newest first
  if(hist.length > MAX_HISTORY) hist.splice(MAX_HISTORY);

  await kv.set(key, hist);
}

// ── Response helpers ───────────────────────────────────────────────────────────

export function ok(data) {
  return Response.json({ ok: true, ...data });
}

export function err(msg, status = 400) {
  return Response.json({ ok: false, error: msg }, { status });
}

// ── Auth helper ────────────────────────────────────────────────────────────────

/**
 * Cek X-EA-Token header atau ?token= query param.
 * Token disimpan di Vercel Environment Variable: EA_SECRET_TOKEN
 */
export function checkToken(req) {
  const expected = process.env.EA_SECRET_TOKEN;
  if(!expected) return true; // tidak di-set = skip auth (dev mode)

  const header = req.headers.get("x-ea-token");
  const url    = new URL(req.url);
  const query  = url.searchParams.get("token");
  return (header === expected || query === expected);
}
