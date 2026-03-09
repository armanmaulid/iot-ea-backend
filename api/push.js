// api/push.js — POST /api/push
// EA → Server: terima state dari MT5, simpan ke Upstash Redis
import { kv, Keys, ok, err, checkToken,
         registerInstance, appendTrade } from "../lib/kv.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST")   return err("Method not allowed", 405);
  if (!checkToken(req))        return err("Unauthorized", 401);

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON"); }

  const { magic, symbol } = body;
  if (!magic || !symbol) return err("Missing magic or symbol");

  // ── Pisahkan equityHistory & newTrades dari state utama ────────────
  const { equityHistory, newTrades, ...stateClean } = body;

  // ── Simpan state (TTL 5 menit) ────────────────────────────────────
  await kv.set(
    Keys.state(magic, symbol),
    { ...stateClean, serverTime: Math.floor(Date.now() / 1000) },
    { ex: 300 }
  );

  // ── Equity history — merge & trim ke 200 point ────────────────────
  if (Array.isArray(equityHistory) && equityHistory.length > 0) {
    const eqKey  = Keys.equity(magic, symbol);
    const stored = (await kv.get(eqKey)) || [];
    const merged = [...stored, ...equityHistory]
      .filter((v, i, arr) => arr.findIndex(x => x.t === v.t) === i)
      .sort((a, b) => a.t - b.t)
      .slice(-200);
    await kv.set(eqKey, merged, { ex: 86400 });
  }

  // ── Append closed trades ke history ─────────────────────────────
  if (Array.isArray(newTrades)) {
    for (const trade of newTrades) {
      await appendTrade(magic, symbol, trade);
    }
  }

  // ── Update instance registry ──────────────────────────────────────
  await registerInstance(magic, symbol, body.accountType);

  return ok({ saved: true, serverTime: Math.floor(Date.now() / 1000) });
}

export const config = { runtime: "edge" };
