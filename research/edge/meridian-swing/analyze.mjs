// Edge research · meridian-swing: the pre-registered filter / exit variants of the Swing setups, judged on the replay rows
// (replay.mjs). Net R = R - cost (one spread per round trip, in R). The bar for "solid" (council/trader.mjs Coach evidence
// rule and the earlier edge studies): n >= 30, |t| >= 2, positive in both chronological halves.
//   node analyze.mjs <outDir> [result.json]
import fs from 'node:fs';
import path from 'node:path';
const [DIR, OUT] = process.argv.slice(2);
const KEYS = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
const rows = [];
let from = Infinity, to = 0;
for (const k of KEYS) {
  const f = path.join(DIR, `${k}.json`); if (!fs.existsSync(f)) { console.log(`missing ${k}`); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); from = Math.min(from, Date.parse(j.from) / 1000); to = Math.max(to, Date.parse(j.to) / 1000);
  for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); o.m = k; rows.push(o); }
}
const MID = Math.floor((from + to) / 2);
const closed = rows.filter((x) => x.status === 'closed');
const yr = (t) => new Date(t * 1000).getUTCFullYear();
function stats(arr, exit = 'none') {
  const R = arr.map((x) => x['R_' + exit] - x.cost), n = R.length;
  if (!n) return { n: 0 };
  const sum = R.reduce((a, b) => a + b, 0), mean = sum / n, sd = Math.sqrt(R.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  // day-clustered t: trades on the same UTC day across markets (USD pairs move together) summed into one observation
  const byDay = new Map(); arr.forEach((x, i) => { const d = Math.floor(x.filled / 86400); byDay.set(d, (byDay.get(d) || 0) + R[i]); });
  const D = [...byDay.values()], dm = D.reduce((a, b) => a + b, 0) / D.length, dsd = Math.sqrt(D.reduce((a, b) => a + (b - dm) ** 2, 0) / Math.max(1, D.length - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of arr.map((x, i) => [x.closed, R[i]]).sort((a, b) => a[0] - b[0])) { eq += x[1]; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const h1 = arr.map((x, i) => [x, R[i]]).filter(([x]) => x.filled < MID).map(([, r]) => r), h2 = arr.map((x, i) => [x, R[i]]).filter(([x]) => x.filled >= MID).map(([, r]) => r);
  const avg = (a) => a.length ? a.reduce((p, q) => p + q, 0) / a.length : null;
  const years = {}; arr.forEach((x, i) => { const y = yr(x.filled); years[y] = (years[y] || 0) + R[i]; });
  const out = { n, wr: +(R.filter((r) => r > 0).length / n).toFixed(3), exp: +mean.toFixed(3), gross: +(arr.reduce((a, x) => a + x['R_' + exit], 0) / n).toFixed(3), totalR: +sum.toFixed(1),
    t: +(sd ? mean / sd * Math.sqrt(n) : 0).toFixed(2), tDay: +(dsd ? dm / dsd * Math.sqrt(D.length) : 0).toFixed(2), maxDD: +dd.toFixed(1),
    h1: { n: h1.length, exp: h1.length ? +avg(h1).toFixed(3) : null }, h2: { n: h2.length, exp: h2.length ? +avg(h2).toFixed(3) : null },
    yearsPos: `${Object.values(years).filter((v) => v > 0).length}/${Object.keys(years).length}`, years: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, +v.toFixed(1)])) };
  out.solid = n >= 30 && Math.abs(out.t) >= 2 && out.h1.exp > 0 && out.h2.exp > 0 && out.exp > 0;
  return out;
}
const sw = closed.filter((x) => x.k === 'swing'), rsw = closed.filter((x) => x.k === 'rswing');
const owner = sw.filter((x) => x.d1 === 'against');   // live config: swing filters.d1 = 'against' (owner rule, trader.mjs USER_RULES)
const LON = new Set(['london', 'overlap']);
// pre-registered variants (written before the first replay finished)
const V = [
  ['Swing, all signals (baseline)', sw, 'none'],
  ['Swing, owner rule (against D1)', owner, 'none'],
  ['Retrace swing (rswing), all', rsw, 'none'],
  ['F1 ADX band 19.4-29.2 (existing paper tag)', sw.filter((x) => x.adxBand === true), 'none'],
  ['F1b ADX band, owner rule', owner.filter((x) => x.adxBand === true), 'none'],
  ['F2 session London + overlap (07-16 UTC)', sw.filter((x) => LON.has(x.session)), 'none'],
  ['F3 HTF aligned: D1 and H4 trend with the trade', sw.filter((x) => x.d1 === 'with' && x.h4 === 'with'), 'none'],
  ['F3b W1 trend with the trade', sw.filter((x) => x.w1 === 'with'), 'none'],
  ['E1 break-even at +1R', sw, 'be1'],
  ['E2 half off at +1R, rest to BE, target 1', sw, 'part'],
  ['E3 hold to target 2', sw, 'tp2'],
  ['E4 trail on H1 structure from +1R, no target (10R cap, 10 days)', sw, 'trail'],
  ['E5 trail on H1 structure from +1R, target 1 kept', sw, 'trailT1'],
];
const res = V.map(([name, arr, exit]) => ({ name, exit, ...stats(arr, exit) }));
const fill = { swing: { signals: rows.filter((x) => x.k === 'swing').length, closed: sw.length, unfilled: rows.filter((x) => x.k === 'swing' && (x.status === 'expired' || x.status === 'missed')).length } };
// context tables: every exit on every filter, and by market
const exits = ['none', 'be1', 'part', 'tp2', 'trail', 'trailT1'];
const grid = V.slice(0, 8).map(([name, arr]) => ({ name, ...Object.fromEntries(exits.map((e) => { const s = stats(arr, e); return [e, `${s.exp >= 0 ? '+' : ''}${s.exp} (t ${s.t}, ${s.h1.exp}/${s.h2.exp})`]; })) }));
const byMarket = Object.fromEntries(KEYS.map((k) => [k, Object.fromEntries(exits.map((e) => { const s = stats(sw.filter((x) => x.m === k), e); return [e, `n${s.n} ${s.exp}`]; }))]));
const pct = (x) => (x * 100).toFixed(1) + '%';
console.log(`window ${new Date(from * 1000).toISOString().slice(0, 10)} → ${new Date(to * 1000).toISOString().slice(0, 10)}, halves split ${new Date(MID * 1000).toISOString().slice(0, 10)}; swing signals ${fill.swing.signals}, closed ${sw.length}, unfilled ${fill.swing.unfilled}`);
console.log('| variant | n | win | avg R net | gross | t | t (day) | total R | maxDD | H1 avg | H2 avg | yrs + | solid |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of res) console.log(`| ${r.name} | ${r.n} | ${pct(r.wr)} | ${r.exp >= 0 ? '+' : ''}${r.exp} | ${r.gross} | ${r.t} | ${r.tDay} | ${r.totalR} | ${r.maxDD} | ${r.h1.exp} (n${r.h1.n}) | ${r.h2.exp} (n${r.h2.n}) | ${r.yearsPos} | ${r.solid ? 'PASS' : 'no'} |`);
console.log('\nexit x filter grid (avg R net, t, H1/H2):'); for (const g of grid) console.log(JSON.stringify(g));
console.log('\nswing by market:'); for (const [k, v] of Object.entries(byMarket)) console.log(k, JSON.stringify(v));
// edge-lab card fields (research/edge/build.mjs, edge-lab.html): first half as `is`, second half as `oos`
const half = (arr, exit) => { const h = (sel) => { const s = stats(arr.filter(sel), exit); return { n: s.n, wr: s.wr, exp: s.exp, R: s.totalR, maxDD: s.maxDD != null ? -s.maxDD : null, t: s.t }; };
  return { is: h((x) => x.filled < MID), oos: h((x) => x.filled >= MID) }; };
const lab = { topic: 'meridian-swing', system: 'MERIDIAN Swing (H4→H1) on OANDA M5/H1/H4/D1, gold + 5 forex, 2017-06 to 2026-11; is/oos = first/second chronological half',
  baseline: { rule: 'Swing, all signals, stop / target 1', ...half(V[0][1], 'none') },
  candidates: res.slice(1).map((r, i) => ({ rule: r.name, ...half(V[i + 1][1], r.exit), years: r.years, verdict: r.solid ? 'PASS' : `FAIL: n ${r.n}, ${r.exp >= 0 ? '+' : ''}${r.exp}R, t ${r.t}, halves ${r.h1.exp} / ${r.h2.exp}` })),
  variantsTried: V.length - 3, verdict: res.slice(3).some((r) => r.solid) ? 'PASS' : 'FAIL - no filter or exit variant reaches n>=30, |t|>=2 and positive in both halves; no shadow stream added' };
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ ...lab, at: new Date().toISOString(), from: new Date(from * 1000).toISOString(), to: new Date(to * 1000).toISOString(), mid: new Date(MID * 1000).toISOString(), fill, variants: res, grid, byMarket }, null, 1));
