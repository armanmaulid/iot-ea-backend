const { kv, Keys, checkToken, registerInstance, appendTrade } = require("../lib/kv");
module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-EA-Token');
  if (req.method==='OPTIONS') return res.status(204).end();
  if (req.method!=='POST')   return res.status(405).json({ ok:false, error:'Method not allowed' });
  if (!checkToken(req))      return res.status(401).json({ ok:false, error:'Unauthorized' });
  const body = req.body||{};
  const { magic, symbol } = body;
  if (!magic||!symbol) return res.status(400).json({ ok:false, error:'Missing magic/symbol' });
  try {
    const { equityHistory, newTrades, ...clean } = body;
    await kv.set(Keys.state(magic,symbol), {...clean, serverTime:Math.floor(Date.now()/1000)}, { ex:300 });
    if (Array.isArray(equityHistory)&&equityHistory.length>0) {
      const eqKey=Keys.equity(magic,symbol);
      const stored=(await kv.get(eqKey))||[];
      const merged=[...stored,...equityHistory].filter((v,i,a)=>a.findIndex(x=>x.t===v.t)===i).sort((a,b)=>a.t-b.t).slice(-200);
      await kv.set(eqKey, merged, { ex:86400 });
    }
    if (Array.isArray(newTrades)) for(const t of newTrades) await appendTrade(magic,symbol,t);
    await registerInstance(magic,symbol,body.accountType);
    res.json({ ok:true, saved:true, serverTime:Math.floor(Date.now()/1000) });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
