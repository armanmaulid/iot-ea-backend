# iOT EA — Vercel Backend

Backend relay antara MT5 EA dan Telegram Mini App.

---

## Deploy ke Vercel (5 menit)

### Step 1 — Fork & Clone
```bash
# Clone repo ini ke GitHub kamu, lalu:
git clone https://github.com/USERNAME/iot-ea-backend
cd iot-ea-backend
npm install
```

### Step 2 — Buat Vercel account
1. Buka https://vercel.com
2. Sign up dengan GitHub (satu klik)
3. Import repo `iot-ea-backend`

### Step 3 — Tambah Vercel KV
1. Di Vercel dashboard → Storage → Create KV Database
2. Nama: `iot-ea-kv`
3. Connect ke project → Vercel otomatis isi env vars

### Step 4 — Set Environment Variables
Di Vercel dashboard → Settings → Environment Variables:

```
EA_SECRET_TOKEN   = buat-token-acak-kamu-sendiri
                    (contoh: iot-ea-x9k2m7p1q4)
```

> ⚠️ Token ini HARUS sama di Vercel dan di MT5 input parameter.

### Step 5 — Deploy
```bash
npx vercel --prod
```
Atau push ke GitHub → Vercel auto-deploy.

Vercel akan memberikan URL seperti:
```
https://iot-ea-backend.vercel.app
```

---

## Setup MT5

### 1. Izinkan WebRequest
MT5 → Tools → Options → Expert Advisors
- ✅ Allow WebRequest for listed URL
- Tambahkan: `https://iot-ea-backend.vercel.app`

### 2. Copy file ke MT5
```
MT5/MQL5/Include/iOT_WebPush.mqh
```

### 3. Tambahkan ke iOT.mq5

**Input parameters:**
```mql5
input group "=== Web Dashboard ==="
input bool   WebPushEnabled  = true;
input string WebPushURL      = "https://iot-ea-backend.vercel.app";
input string WebPushToken    = "";  // isi dengan EA_SECRET_TOKEN
input int    WebPushInterval = 5;   // detik
```

**OnInit():**
```mql5
g_webPush.Init(g_ds, WebPushURL, WebPushToken, WebPushInterval);
```

**OnTimer():**
```mql5
g_webPush.Cycle();
```

**OnTick() — setelah IsNewBar():**
```mql5
g_webPush.SampleEquity();
```

**Saat trade closed (di CTelegramAuto::OnTradeClosed atau setelahnya):**
```mql5
g_webPush.QueueTrade(ticket, dir, entry, close, sl, tp,
                     lots, profit, openTime, closeTime,
                     closeReason, pips);
```

---

## API Reference

| Endpoint | Method | Auth | Deskripsi |
|---|---|---|---|
| `/api/push` | POST | EA Token | EA → push state |
| `/api/status` | GET | - | Mini App baca state |
| `/api/command` | POST | EA Token | Mini App kirim command |
| `/api/cmd` | GET | EA Token | EA polling command |
| `/api/history` | GET | - | Trade history |
| `/api/instances` | GET | - | List EA instances |

---

## KV Schema

```
ea:{magic}:{symbol}      → EAState (TTL 5 menit)
cmd:{magic}:{symbol}     → PendingCommand | null (TTL 60 detik)
hist:{magic}:{symbol}    → TradeHistory[] (max 500)
eq:{magic}:{symbol}      → EquityPoint[] (max 200, TTL 24 jam)
instances                → InstanceInfo[]
```

---

## Security Notes

- `EA_SECRET_TOKEN` jangan commit ke GitHub (sudah di `.gitignore`)
- Mini App production build harus HTTPS (Telegram requirement)
- Token dikirim via header `X-EA-Token` — tidak di URL

---

## Project Structure

```
iot-ea-backend/
├── api/
│   ├── push.js          ← POST /api/push
│   ├── status.js        ← GET  /api/status
│   ├── command.js       ← POST /api/command
│   ├── cmd.js           ← GET  /api/cmd
│   ├── history.js       ← GET  /api/history
│   └── instances.js     ← GET  /api/instances
├── lib/
│   └── kv.js            ← KV helpers + key schema
├── iOT_WebPush.mqh      ← MT5 module (copy ke MQL5/Include/)
├── vercel.json
├── package.json
└── README.md
```
