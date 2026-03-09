const { kv, Keys, getInstances } = require("../lib/kv");
module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(204).end();
  const { magic, symbol, eq } = req.query;
  if (!magic || !symbol) { const i=await getInstances(); return res.json({ok:true,instances:i}); }
  try {
    const [state, eqH] = await Promise.all([
      kv.get(Keys.state(magic, symbol)),
      eq==='1' ? kv.get(Keys.equity(magic, symbol)) : Promise.resolve(null),
    ]);
    if (!state) return res.json({ ok:true, online:false, message:"EA belum push data" });
    const lagSecs = Math.floor(Date.now()/1000) - (state.serverTime||0);
    res.json({ ok:true, online:lagSecs<=30, lagSecs, state, equityHistory:eqH||[] });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
