// TradingView add-on: a Pine Script (v6) indicator with the council's open trades on one market baked in.
// GET /api/pine?sym=xau[&shadow=1] -> text/plain script to paste into TradingView's Pine Editor. Pine cannot fetch data,
// so the script is a snapshot: copy it again when trades change (the header says when it was made).
const NAME = { xau: 'XAU/USD', xag: 'XAG/USD', eurusd: 'EUR/USD', gbpusd: 'GBP/USD', audusd: 'AUD/USD', usdcad: 'USD/CAD', usdchf: 'USD/CHF', usdjpy: 'USD/JPY', nas100: 'NAS100', spx500: 'US500', nq: 'NQ', btc: 'BTC/USD', eth: 'ETH/USD', sol: 'SOL/USD', xrp: 'XRP/USD' };
const q = (s) => `"${String(s).replace(/["\\\n]/g, ' ').slice(0, 60)}"`;
const num = (v) => (v == null || !isFinite(+v) ? 'na' : String(+(+v).toPrecision(10)));
module.exports = async (req, res) => {
  const sym = String((req.query && req.query.sym) || 'xau').toLowerCase(), shadow = req.query && req.query.shadow === '1';
  if (!/^[a-z0-9]{2,12}$/.test(sym)) return res.status(400).send('bad sym');
  let trades = [];
  try { const r = await fetch(`https://${req.headers.host}/cdata/trades.json`, { signal: AbortSignal.timeout(8000) }); if (r.ok) trades = await r.json(); } catch (e) {}
  const open = (Array.isArray(trades) ? trades : []).filter((t) => t.market === sym && (t.status === 'open' || t.status === 'pending') && (shadow || !t.shadow) && isFinite(t.entry) && isFinite(t.stop));
  const at = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const rows = open.map((t) => {
    const name = `${t.side === 'buy' ? 'BUY' : 'SELL'} ${t.name || t.k}${t.status === 'pending' ? ' (pending)' : ''}${t.shadow ? ' · shadow' : ''}`;
    return `    f_trade(${Math.round((t.filled || t.opened) * 1000)}, ${num(t.entry)}, ${num(t.stop)}, ${num(t.t1)}, ${num(t.t2)}, ${q(name)}, ${t.side === 'buy'})`;
  });
  const src = `// Meridian X · Council trades on ${NAME[sym] || sym.toUpperCase()} (snapshot ${at} UTC, ${open.length} open)
// Paste into TradingView: Pine Editor → New → replace everything → Save → Add to chart.
// Pine scripts cannot load live data, so copy a fresh version from meridianx.dev when the council opens or closes trades.
//@version=6
indicator("Council trades · ${(NAME[sym] || sym.toUpperCase()).replace(/"/g, '')}", overlay = true, max_lines_count = 300, max_labels_count = 150)
showStops   = input.bool(true, "Stops")
showTargets = input.bool(true, "Targets")
showLabels  = input.bool(true, "Labels")
cEntry = input.color(#2962ff, "Entry")
cStop  = input.color(#f23645, "Stop")
cTgt   = input.color(#089981, "Target")

f_trade(int t, float e, float s, float t1, float t2, string name, bool isBuy) =>
    line.new(t, e, t + 60000, e, xloc.bar_time, extend.right, cEntry, line.style_solid, 2)
    if showStops
        line.new(t, s, t + 60000, s, xloc.bar_time, extend.right, cStop, line.style_dashed, 1)
    if showTargets and not na(t1)
        line.new(t, t1, t + 60000, t1, xloc.bar_time, extend.right, cTgt, line.style_dashed, 1)
    if showTargets and not na(t2)
        line.new(t, t2, t + 60000, t2, xloc.bar_time, extend.right, color.new(cTgt, 40), line.style_dotted, 1)
    if showLabels
        r = math.abs(e - s)
        label.new(t, e, name + "  " + str.tostring(e, format.mintick) + (r > 0 ? "  · risk " + str.tostring(r, format.mintick) : ""), xloc.bar_time, yloc.price, isBuy ? cTgt : cStop, label.style_label_right, color.white, size.small)

var bool drawn = false
if barstate.islast and not drawn
    drawn := true
${rows.length ? rows.join('\n') : '    label.new(bar_index, close, "No open council trades on this market at the snapshot", style = label.style_label_left, color = color.gray, textcolor = color.white, size = size.small)'}
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('Content-Disposition', `inline; filename="council-${sym}.pine"`);
  return res.status(200).send(src);
};
