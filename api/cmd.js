const { kv, Keys, checkToken } = require("../lib/kv");
module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(204).end();
  if (!checkToken(req)) return res.status(401).json({ ok:false, error:'Unauthorized' });
  const { magic, symbol } = req.query;
  if (!magic||!symbol) return res.status(400).json({ ok:false, error:'Missing params' });
  try {
    const key = Keys.command(magic, symbol);
    const cmd = await kv.get(key);
    if (!cmd) return res.json({ ok:true, cmd:null });
    await kv.del(key);
    res.json({ ok:true, cmd });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
