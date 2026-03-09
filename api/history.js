const { kv, Keys } = require("../lib/kv");
module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(204).end();
  const { magic, symbol, limit='50', page='0' } = req.query;
  if (!magic||!symbol) return res.status(400).json({ ok:false, error:'Missing params' });
  try {
    const all=(await kv.get(Keys.history(magic,symbol)))||[];
    const lim=Math.min(parseInt(limit),100), pg=Math.max(parseInt(page),0);
    const wins=all.filter(t=>t.profit>0).length;
    const gp=all.filter(t=>t.profit>0).reduce((s,t)=>s+t.profit,0);
    const gl=all.filter(t=>t.profit<0).reduce((s,t)=>s+t.profit,0);
    res.json({ ok:true, trades:all.slice(pg*lim,pg*lim+lim), total:all.length, page:pg, limit:lim,
      summary:{ total:all.length, wins, losses:all.length-wins,
        winRate:all.length>0?(wins/all.length*100).toFixed(1):'0.0',
        netProfit:(gp+gl).toFixed(2), profitFactor:gl<0?(gp/Math.abs(gl)).toFixed(2):'∞' }});
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
