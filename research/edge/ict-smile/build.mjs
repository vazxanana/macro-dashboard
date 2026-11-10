// ICT x Dollar Smile, step 1 (no regime, no FRED): the out-of-sample trades and the daily FX candles for macro.mjs's DXY.
// Pre-registration: preregistration.md (committed before this ran).
//
//   1. ICTU_DATA=<council-data checkout>/research/candles ICTU_ONLY=gc,nas100,spx \
//        node research/edge/ict-universe/universe.mjs /tmp/universe.json
//   2. node research/edge/ict-smile/build.mjs /tmp/universe.json <council-data checkout>/research/candles
//
// Writes research/edge/ict-smile/trades.json (closed A-setups under the desk's rule set for each market, signal candle closing
// 2018-01-01 .. 2025-07-31 UTC) and fx-daily.json (EUR/USD, USD/JPY, GBP/USD, USD/CAD, USD/CHF daily candles from HistData M1,
// stamped at 00:00 UTC of their day like the OANDA feed macro.mjs reads). Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const [uniPath, candleDir, outDir = 'research/edge/ict-smile'] = process.argv.slice(2);
if (!uniPath || !candleDir) { console.error('usage: build.mjs <universe.json> <research/candles dir> [outDir]'); process.exit(2); }
export const FROM = Date.UTC(2018, 0, 1) / 1000, TO = Date.UTC(2025, 7, 1) / 1000;   // [FROM, TO): the #507 sample starts 4 Aug 2025
const PRIMARY = { gc: ['gc', 'gold'], nas100: ['nq', 'index'], spx: ['es', 'index'] };   // universe key -> desk market, rule set

const u = JSON.parse(fs.readFileSync(uniPath, 'utf8')), C = Object.fromEntries(u.cols.map((c, i) => [c, i]));
if (C.closed == null) throw new Error('universe.json has no closed column: re-run universe.mjs');
const trades = u.trades.filter((r) => PRIMARY[r[C.market]] && r[C.cfg] === PRIMARY[r[C.market]][1] && r[C.aset] === 1 && r[C.close] >= FROM && r[C.close] < TO)
  .map((r) => { const size = r[C.size], R = r[C.Rraw], cost = r[C.costR], mk = PRIMARY[r[C.market]][0];
    return { id: `${mk}-${r[C.side] > 0 ? 'b' : 's'}-${r[C.close]}`, market: mk, side: r[C.side] > 0 ? 'buy' : 'sell', signalAt: r[C.close], closed: r[C.closed],
      size, Rraw: R, R: +(size * R).toFixed(4), net: +(size * (R - cost)).toFixed(4), costR: cost, session: r[C.session], grade: r[C.grade], exit: r[C.exit] }; })
  .sort((a, b) => a.signalAt - b.signalAt);

// daily FX candles, UTC days (HistData M1 via council/histdata.mjs; +5 h before 9 Nov)
function dailyUtc(dir, pre) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(pre) && f.endsWith('.csv.gz')).sort(), out = []; let cur = null;
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
    if (ln.length < 20) continue; const p = ln.split(';');
    const t = histStampUtc(ln);
    const o = +p[1], h = +p[2], l = +p[3], c = +p[4]; if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    const k = t - (t % 86400);
    if (cur && cur.time === k) { if (h > cur.high) cur.high = h; if (l < cur.low) cur.low = l; cur.close = c; }
    else if (!cur || k > cur.time) { cur = { time: k, open: o, high: h, low: l, close: c }; out.push(cur); }
  }
  return out;
}
const FX = { eurusd: 'EURUSD', usdjpy: 'USDJPY', gbpusd: 'GBPUSD', usdcad: 'USDCAD', usdchf: 'USDCHF' };
const fx = {};
for (const [k, pre] of Object.entries(FX)) fx[k] = dailyUtc(path.join(candleDir, pre), pre).filter((b) => b.time < TO + 7 * 86400).map((b) => [b.time, b.close]);   // macro.mjs's DXY and USD/JPY use closes only

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'trades.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'research/edge/ict-universe/universe.mjs on council-data research/candles (HistData M1)',
  window: [new Date(FROM * 1000).toISOString(), new Date(TO * 1000).toISOString()], note: 'R = gross R x size (replay convention); net = size x (R - cost/risk)', trades }, null, 0).replace(/\},\{/g, '},\n{'));
fs.writeFileSync(path.join(outDir, 'fx-daily.json'), JSON.stringify({ note: 'HistData M1 -> UTC-day candles [time, close], time = 00:00 UTC of the day', ...fx }));
const by = (m) => trades.filter((t) => t.market === m).length;
console.log(`trades ${trades.length} (gc ${by('gc')}, nq ${by('nq')}, es ${by('es')}); fx days`, Object.fromEntries(Object.entries(fx).map(([k, a]) => [k, a.length])));
