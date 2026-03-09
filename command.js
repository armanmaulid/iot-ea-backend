// api/command.js
// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/command
//
//  Dipanggil oleh Mini App saat user tap tombol / edit parameter.
//  Server simpan command ke KV, EA polling via GET /api/cmd.
//
//  Header: X-EA-Token (sama seperti EA token — Mini App juga harus authed)
//
//  Body:
//  {
//    magic:   14091992,
//    symbol:  "#BTCUSDr",
//    action:  "pause" | "resume" | "trail_on" | "trail_off" |
//             "news_on" | "news_off" | "set_param",
//
//    // Untuk action = "set_param":
//    param:   "risk" | "tp" | "sl" | "tsl" | "tsltrig" |
//             "orderdist" | "barsn" | "starthour" | "endhour" |
//             "stopbefore" | "startafter" | "currencies",
//    value:   "2.0"  (selalu string, EA yang parse)
//  }
//
//  Commands yang disupport:
//  ┌─────────────────────────────────────────────────────────────────┐
//  │  pause         → isPaused = true                                │
//  │  resume        → isPaused = false                               │
//  │  trail_on      → trailOn = true                                 │
//  │  trail_off     → trailOn = false                                │
//  │  news_on       → newsFilterOn = true                            │
//  │  news_off      → newsFilterOn = false                           │
//  │  set_param     → set parameter (lihat param list di atas)       │
//  └─────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import { kv }                    from "@vercel/kv";
import { Keys, ok, err, checkToken } from "../lib/kv.js";

const VALID_ACTIONS = [
  "pause", "resume",
  "trail_on", "trail_off",
  "news_on", "news_off",
  "set_param",
];

const VALID_PARAMS = [
  "risk", "tp", "sl", "tsl", "tsltrig",
  "orderdist", "barsn", "starthour", "endhour",
  "stopbefore", "startafter", "currencies",
];

export default async function handler(req) {
  if(req.method === "OPTIONS") return new Response(null, { status: 204 });
  if(req.method !== "POST")    return err("Method not allowed", 405);

  if(!checkToken(req)) return err("Unauthorized", 401);

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON"); }

  const { magic, symbol, action, param, value } = body;

  // ── Validasi ───────────────────────────────────────────────────────────
  if(!magic || !symbol)             return err("Missing magic or symbol");
  if(!VALID_ACTIONS.includes(action)) return err(`Unknown action: ${action}`);
  if(action === "set_param") {
    if(!VALID_PARAMS.includes(param)) return err(`Unknown param: ${param}`);
    if(value === undefined || value === null) return err("Missing value");
  }

  // ── Cek apakah EA online ───────────────────────────────────────────────
  const state = await kv.get(Keys.state(magic, symbol));
  if(!state) return err("EA tidak online atau belum pernah push data", 404);

  // ── Simpan command — expire 60 detik (EA harus ambil dalam 60 detik) ──
  const cmd = {
    id:        `${Date.now()}`,
    action,
    param:     param || null,
    value:     value !== undefined ? String(value) : null,
    sentAt:    Math.floor(Date.now() / 1000),
    status:    "pending",
  };

  await kv.set(Keys.command(magic, symbol), cmd, { ex: 60 });

  return ok({ queued: true, cmdId: cmd.id });
}

export const config = { runtime: "edge" };
