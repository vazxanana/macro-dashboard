// Edge research · vb-rate-side: the breakout's side with or against the rate trend (PREREGISTRATION.md, pushed alone first)
//   node research/edge/vb-rate-side/run.mjs run <dir>     (<dir> holds DFII10.csv and DGS2.csv: vb-fred-regime's fetch)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { daySkip, vbTrade } from '../index-vol-breakout/original.mjs';
import { load2, tradeOf } from '../vb-vol-regime/run.mjs';
import { judge } from '../vb-fred-regime/run.mjs';
import { parseFred } from '../rulebook-gauges/run.mjs';
import { pFromT, holm } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), N = 20;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN), r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
// trend for trading day `day`: last value dated before it minus the value N observations earlier (null when not enough)
export function trendFor(S, day) { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].d < day) { r = m; lo = m + 1; } else hi = m - 1; } return r < N ? null : S[r].v - S[r - N].v; }
// want: +1 = a buy is WITH a rising rate (USD/JPY), -1 = a buy is WITH a falling rate (gold)
export const withTrend = (side, trend, want) => (trend === 0 || trend == null ? null : Math.sign(trend) * want === side);
export const TESTS = [{ id: 'R1', m: 'xau', series: 'DFII10', want: -1, name: 'gold with falling real yields' }, { id: 'R2', m: 'usdjpy', series: 'DGS2', want: 1, name: 'USD/JPY with a rising US 2-year' }];
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[3], D = { xau: load2('xau'), usdjpy: load2('usdjpy') }, TR = {};
  for (const m of ['xau', 'usdjpy']) { TR[m] = []; for (const d of D[m].days) { if (daySkip(d)) continue; const x = tradeOf(m, d); if (!x) continue; const v = vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); TR[m].push({ day: d.day, side: sideOf(v, d), ...x }); } }
  function sideOf(v, d) { const b = d.bars.find((q) => q.t === v.fillT), hitUp = b.h >= v.up, hitDn = b.l <= v.dn; return hitUp && hitDn ? (Math.abs(v.up - b.o) <= Math.abs(b.o - v.dn) ? 1 : -1) : hitUp ? 1 : -1; }
  const inW = (d, [a, b]) => d >= a && d <= b, g = (m, w) => { const a = TR[m].filter((x) => inW(x.day, w)); return { n: a.length, net: r3(mean(a.map((x) => x.net))) }; };
  const gj = g('usdjpy', ['2005-01-04', '2015-12-31']), gg = g('xau', ['2007-01-01', '2026-11-12']), near = (q, n, net) => Math.abs(q.n - n) <= 0.01 * n && Math.abs(q.net - net) <= 0.005;
  const gate = { usdjpy: { got: gj, ok: near(gj, 2089, 0.079) }, xau: { got: gg, ok: near(gg, 3713, 0.139) } };
  console.log('gate', JSON.stringify(gate));
  if (!gate.usdjpy.ok || !gate.xau.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'vb-rate-side', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const W = { disc: ['2005-01-01', '2014-12-31'], conf: ['2015-01-01', '2099-12-31'] };
  const out = TESTS.map((T) => { const S = parseFred(fs.readFileSync(path.join(dir, T.series + '.csv'), 'utf8'));
    const rows = TR[T.m].map((x) => { const tr = trendFor(S, x.day); return { ...x, trend: tr, on: withTrend(x.side, tr, T.want) }; }).filter((x) => x.on != null);
    const cells = {}; for (const w of ['disc', 'conf']) for (const s of [1, -1]) for (const u of [1, -1]) { const a = rows.filter((x) => inW(x.day, W[w]) && x.side === s && Math.sign(x.trend) === u); cells[`${w}:${s > 0 ? 'buy' : 'sell'}:${u > 0 ? 'up' : 'down'}`] = { n: a.length, net: r3(mean(a.map((x) => x.net))) }; }
    return { id: T.id, name: T.name, series: T.series, ...judge(rows, {}), cells }; });
  const ps = out.map((o) => (o.conf.welch == null ? 1 : pFromT(o.conf.welch, Math.max(2, Math.min(o.conf.on.n, o.conf.off.n) - 1)))), H = holm(ps);
  out.forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.conf.welch >= 2 && o.conf.monthT >= 2 && o.holm < 0.05 && o.disc.diff > 0; });
  const pass = out.filter((o) => o.pass).length, sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`;
  const verdict = `${pass ? 'PASS' : 'FAIL'}, ${pass} of ${out.length}. With minus against the rate trend, net R a trade in 2015 on: ` + out.map((o) => `${o.id} ${o.name} ${sg(o.conf.diff)} (with ${sg(o.conf.on.net)} n ${o.conf.on.n}, against ${sg(o.conf.off.net)} n ${o.conf.off.n}; Welch t ${o.conf.welch}, month t ${o.conf.monthT}, Holm ${o.holm}; to 2014 ${sg(o.disc.diff)})`).join('; ') + '.';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'vb-rate-side', built: '2026-11-24', verdict, gate, tests: out }, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# The breakout\'s side against the rate trend (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first); harness gate reproduced. Nothing live changed.', '',
    '| Cell (net R a trade, n) | Buy, rate up | Buy, rate down | Sell, rate up | Sell, rate down |', '|---|---|---|---|---|',
    ...out.flatMap((o) => ['disc', 'conf'].map((w) => `| ${o.id} ${w === 'disc' ? 'to 2014' : '2015 on'} (${o.series}) | ${['buy:up', 'buy:down', 'sell:up', 'sell:down'].map((k) => { const c = o.cells[`${w}:${k}`]; return c.n ? `${sg(c.net)} (${c.n})` : '—'; }).join(' | ')} |`)), ''].join('\n'));
  console.log(verdict);
}
