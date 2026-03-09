const { kv, Keys, checkToken } = require("../lib/kv");
const VA=['pause','resume','trail_on','trail_off','news_on','news_off','set_param'];
const VP=['risk','tp','sl','tsl','tsltrig','orderdist','barsn','starthour','endhour','stopbefore','startafter','currencies'];

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-EA-Token');
  if (req.method==='OPTIONS') return res.status(204).end();
  if (req.method!=='POST')   return res.status(405).json({ ok:false, error:'Method not allowed' });
  if (!checkToken(req))      return res.status(401).json({ ok:false, error:'Unauthorized' });
  const { magic, symbol, action, param, value } = req.body||{};
  if (!magic||!symbol)         return res.status(400).json({ ok:false, error:'Missing magic/symbol' });
  if (!VA.includes(action))    return res.status(400).json({ ok:false, error:'Unknown action' });
  if (action==='set_param'&&!VP.includes(param)) return res.status(400).json({ ok:false, error:'Unknown param' });
  try {
    const state = await kv.get(Keys.state(magic, symbol));
    if (!state) return res.status(404).json({ ok:false, error:'EA tidak online' });
    const cmd = { id:`${Date.now()}`, action, param:param||null, value:value!=null?String(value):null, sentAt:Math.floor(Date.now()/1000) };
    await kv.set(Keys.command(magic, symbol), cmd, { ex:60 });
    res.json({ ok:true, queued:true, cmdId:cmd.id });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
