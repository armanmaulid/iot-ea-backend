const { getInstances } = require("../lib/kv");
module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(204).end();
  try {
    const instances = await getInstances();
    res.json({ ok: true, instances });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
