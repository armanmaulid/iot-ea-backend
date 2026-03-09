# iOT EA — Vercel Backend

## Setup Cepat

### 1. Env Variables di Vercel
Pergi ke Project → Settings → Environment Variables, tambahkan:

```
EA_SECRET_TOKEN   = buat-token-acak-kamu (contoh: iotEA-x9k2-2026)
```

Env vars Upstash sudah auto-inject saat Connect Project:
```
iOT_DataStore_KV_REST_API_URL    ← sudah ada otomatis
iOT_DataStore_KV_REST_API_TOKEN  ← sudah ada otomatis
```

### 2. Setup MT5
- Tools → Options → Expert Advisors → Allow WebRequest
- Tambahkan URL Vercel kamu (contoh: https://iot-ea-backend.vercel.app)
- Copy `iOT_WebPush.mqh` ke `MQL5/Include/`

### 3. Deploy
Push ke GitHub → Vercel auto-deploy.

---

## API Endpoints

| Method | Path             | Auth      | Fungsi                        |
|--------|------------------|-----------|-------------------------------|
| POST   | /api/push        | EA Token  | EA kirim state ke server      |
| GET    | /api/status      | -         | Mini App baca state           |
| POST   | /api/command     | EA Token  | Mini App kirim command ke EA  |
| GET    | /api/cmd         | EA Token  | EA poll + consume command     |
| GET    | /api/history     | -         | Trade history + summary       |
| GET    | /api/instances   | -         | List semua EA instance        |

## KV Schema (Upstash Redis)
```
ea:{magic}:{symbol}    → EAState          TTL: 5 menit
cmd:{magic}:{symbol}   → PendingCommand   TTL: 60 detik
hist:{magic}:{symbol}  → TradeHistory[]   max: 500
eq:{magic}:{symbol}    → EquityPoint[]    max: 200, TTL: 24 jam
instances              → InstanceInfo[]
```
