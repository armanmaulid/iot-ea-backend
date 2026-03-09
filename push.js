// api/push.js
// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/push
//
//  Dipanggil oleh EA (iOT_WebPush.mqh) setiap OnTimer (tiap 5 detik).
//  Body JSON berisi full EAState. Server simpan ke KV.
//
//  Header wajib: X-EA-Token: {EA_SECRET_TOKEN}
//
//  Body schema:
//  {
//    magic:        14091992,
//    symbol:       "#BTCUSDr",
//    version:      "2.0",
//    accountType:  "REAL" | "DEMO",
//    accountCurrency: "USD",
//    broker:       "...",
//
//    // Runtime state
//    isPaused:     false,
//    trailOn:      true,
//    newsFilterOn: true,
//    riskPercent:  2.0,
//    tpPoints:     200,
//    slPoints:     200,
//    tslPoints:    5,
//    tslTrigger:   20,
//    orderDist:    100,
//    barsN:        5,
//    startHour:    0,
//    endHour:      0,
//    timeframe:    "M5",
//    instrument:   "BTCUSD",
//    stopBeforeMin: 15,
//    startAfterMin: 15,
//    keyCurrencies: "USD",
//    impactFilter:  1,
//    ssOnPlaced:    false,
//    ssOnFilled:    true,
//    ssOnTrail:     false,
//    ssOnClosed:    true,
//
//    // Account snapshot
//    balance:    0.12,
//    equity:     0.12,
//    floatPnL:   0.00,
//    openPositions: 0,
//    pendingOrders: 1,
//    bid:        67978.865,
//
//    // Statistics
//    totalTrades:  100,
//    totalWins:    68,
//    winRate:      68.0,
//    netProfit:    14.50,
//    todayProfit:  2.10,
//    weekProfit:   8.30,
//    monthProfit:  14.50,
//    profitFactor: 1.8,
//    avgWin:       3.20,
//    avgLoss:      2.10,
//    rrRatio:      1.52,
//    bestTrade:    12.50,
//    worstTrade:   -4.20,
//    maxDrawdown:  -8.30,
//    currentStreak: 3,
//    maxWinStreak:  5,
//    maxLoseStreak: 3,
//
//    // News state
//    newsActive:    false,
//    newsEventName: "",
//    newsCurrency:  "",
//    newsImpact:    "",
//    newsEventTime: 0,
//
//    // Equity history (optional — array of {t, v} last 100 points)
//    equityHistory: [{t: 1234567890, v: 0.12}, ...],
//
//    // Trade list delta — baru saja closed (optional)
//    // Kalau ada, server append ke history
//    newTrades: [{ ticket, dir, entry, close, ... }]
//  }
// ─────────────────────────────────────────────────────────────────────────────

import { kv }                                     from "@vercel/kv";
import { Keys, ok, err, checkToken,
         registerInstance, appendTrade }           from "../lib/kv.js";

export default async function handler(req) {
  // ── Preflight ──────────────────────────────────────────────────────────
  if(req.method === "OPTIONS") return new Response(null, { status: 204 });
  if(req.method !== "POST")    return err("Method not allowed", 405);

  // ── Auth ───────────────────────────────────────────────────────────────
  if(!checkToken(req)) return err("Unauthorized", 401);

  // ── Parse body ─────────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON"); }

  const { magic, symbol } = body;
  if(!magic || !symbol) return err("Missing magic or symbol");

  // ── Simpan state ke KV ─────────────────────────────────────────────────
  const stateKey = Keys.state(magic, symbol);
  const state = {
    ...body,
    serverTime: Math.floor(Date.now() / 1000),
  };

  // Jangan simpan equityHistory & newTrades di state utama (besar)
  // Equity history disimpan terpisah dengan merge
  const { equityHistory, newTrades, ...stateClean } = state;
  await kv.set(stateKey, stateClean, { ex: 300 }); // expire 5 menit

  // ── Equity history — merge & trim ─────────────────────────────────────
  if(equityHistory && Array.isArray(equityHistory) && equityHistory.length > 0) {
    const eqKey  = `eq:${magic}:${symbol}`;
    const stored = (await kv.get(eqKey)) || [];
    // Tambah point baru, deduplicate by timestamp, ambil 200 terbaru
    const merged = [...stored, ...equityHistory]
      .filter((v, i, arr) => arr.findIndex(x => x.t === v.t) === i)
      .sort((a, b) => a.t - b.t)
      .slice(-200);
    await kv.set(eqKey, merged, { ex: 86400 }); // expire 24 jam
  }

  // ── Trade history — append baru ────────────────────────────────────────
  if(newTrades && Array.isArray(newTrades)) {
    for(const trade of newTrades) {
      await appendTrade(kv, magic, symbol, trade);
    }
  }

  // ── Update instance registry ───────────────────────────────────────────
  await registerInstance(kv, magic, symbol, body.accountType);

  return ok({ saved: true, serverTime: Math.floor(Date.now() / 1000) });
}

export const config = { runtime: "edge" };
