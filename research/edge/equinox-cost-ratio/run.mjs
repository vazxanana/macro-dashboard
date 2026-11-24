// Edge research · equinox-cost-ratio: the four other Equinox fade / gap rules, only the trades whose round-trip cost is at
// most 10 % of their risk (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/equinox-cost-ratio/run.mjs market <key> <out dir>   (one market, one process)
//   node research/edge/equinox-cost-ratio/run.mjs report <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { fadeTrades, roundTrades, boxTrades, fvgTrades } from '../../../council/edge-desks-2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KEEP = 0.10, CONTEXT = [0.05, 0.2, 0.3];
export const RULES = [['fade', 'Break fade', fadeTrades], ['roundfade', 'Round-number fade', roundTrades], ['boxfade', 'Box fade', boxTrades], ['fvg', 'FVG return', fvgTrades]];
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
// the closed trades of one rule on one market as [month, window, cost ratio, R]
export function rows(recs, market) {
  const cost = COSTS[market], X = exclusions(market), out = [];
  for (const r of recs) { if (r.status === 'open' || !Number.isFinite(r.R)) continue; if (r.t < FROM || r.t >= TO) continue; if (X.length && inBad(X, r.t)) continue;
    const risk = Math.abs(r.entry - r.stop); if (!(risk > 0)) continue; out.push([monthOf(r.t), r.t < SPLIT ? 0 : 1, cost / risk, r.R]); }
  return out;
}
export function stat(R0, w, mult = 1) {
  const R = R0.filter((x) => x[1] === w), a = w ? DM : 0, b = w ? NM : DM, n = R.length, ms = new Float64Array(NM), msn = new Float64Array(NM); let s = 0, sn = 0, win = 0, c = 0;
  for (const x of R) { const net = x[3] - mult * x[2]; ms[x[0]] += x[3]; msn[x[0]] += net; s += x[3]; sn += net; c += x[2]; if (x[3] > 0) win++; }
  return { n, gross: n ? r3(s / n) : null, net: n ? r3(sn / n) : null, win: n ? r3(win / n) : null, cost: n ? r3(c / n) : null, t: r2(mstat(ms, a, b).t), tNet: r2(mstat(msn, a, b).t) };
}
export const keep = (R, th) => R.filter((x) => x[2] <= th);
export const pOne = (t, df) => { if (!Number.isFinite(t)) return 1; const p2 = K.pFromT(t, df) ?? 1; return t > 0 ? p2 / 2 : 1 - p2 / 2; };
export const passOf = (d, c, c2, h) => d.n >= 300 && c.n >= 300 && d.net > 0 && c.net > 0 && d.tNet >= 2 && c.tNet >= 2 && h < 0.05 && c2.net > 0;

const mode = process.argv[2];
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && mode === 'market') {
  const market = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), B = { '5m': M5.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })) }, out = {};
  for (const [k, , fn] of RULES) { out[k] = rows(fn(B, { from: FROM, market }), market); console.log(market, k, out[k].length); }
  fs.writeFileSync(path.join(dir, market + '.json'), JSON.stringify(out));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && mode === 'report') {
  const dir = process.argv[3], by = Object.fromEntries(MARKETS.map((m) => [m, JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'))]));
  const sg = (v) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`);
  const res = RULES.map(([k, name]) => { const all = MARKETS.flatMap((m) => by[m][k]), Kp = keep(all, KEEP), drop = all.filter((x) => x[2] > KEEP);
    return { k, name, all: { d: stat(all, 0), c: stat(all, 1) }, kept: { d: stat(Kp, 0), c: stat(Kp, 1), c2x: stat(Kp, 1, 2) }, dropped: { d: stat(drop, 0), c: stat(drop, 1) },
      context: CONTEXT.map((th) => ({ th, d: stat(keep(all, th), 0), c: stat(keep(all, th), 1) })),
      markets: Object.fromEntries(MARKETS.map((m) => [m, { d: stat(keep(by[m][k], KEEP), 0), c: stat(keep(by[m][k], KEEP), 1) }])) }; });
  const H = K.holm(res.map((x) => pOne(x.kept.c.tNet, NM - DM - 1))); res.forEach((x, i) => { x.holm = r3(H[i]); x.pass = passOf(x.kept.d, x.kept.c, x.kept.c2x, H[i]); });
  const np = res.filter((x) => x.pass).length;
  const verdict = `${np ? 'PASS for ' + res.filter((x) => x.pass).map((x) => x.name).join(', ') : 'FAIL'}. ${np} of 4 rules pass with only the trades whose cost is at most 10 % of their risk. After costs in 2015-26: ${res.map((x) => `${x.name} ${sg(x.kept.c.net)} (n ${x.kept.c.n}, month t ${x.kept.c.tNet})`).join('; ')}.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'equinox-cost-ratio', built: '2026-11-24', verdict, keep: KEEP, rules: res }, null, 1) + '\n');
  const L = ['# The other Equinox fade and gap rules, only the trades whose cost is small against their risk (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed; the desks stay paper records.', '',
    '| Rule | Trades | 2005-14 n | Before costs | After costs (month t) | 2015-26 n | Before costs | After costs (month t) | Holm p |', '|---|---|---|---|---|---|---|---|---|'];
  for (const x of res) { const row = (nm, d, c, h) => `| ${x.name} | ${nm} | ${d.n} | ${sg(d.gross)} | ${sg(d.net)} (${d.tNet}) | ${c.n} | ${sg(c.gross)} | ${sg(c.net)} (${c.tNet}) | ${h} |`;
    L.push(row('all', x.all.d, x.all.c, ''), row('**kept (the test)**', x.kept.d, x.kept.c, x.holm), row('dropped', x.dropped.d, x.dropped.c, '')); }
  L.push('', 'Average cost of a trade, 2015-26: ' + res.map((x) => `${x.name} ${x.all.c.cost}R (kept ${x.kept.c.cost}R)`).join('; ') + '.', '',
    '## Context only (no verdict; no threshold or market is adopted from this)', '', '| Rule | Cost at most | 2005-14 n | After costs (t) | 2015-26 n | After costs (t) |', '|---|---|---|---|---|---|');
  for (const x of res) for (const q of x.context) L.push(`| ${x.name} | ${Math.round(q.th * 100)} % of the risk | ${q.d.n} | ${sg(q.d.net)} (${q.d.tNet}) | ${q.c.n} | ${sg(q.c.net)} (${q.c.tNet}) |`);
  L.push('', '## Kept trades by market, 2015-26, after costs (n)', '', '| Market | ' + res.map((x) => x.name).join(' | ') + ' |', '|---|' + res.map(() => '---').join('|') + '|',
    ...MARKETS.map((m) => `| ${m}${ASSUMED.includes(m) ? ' (cost assumed)' : ''} | ` + res.map((x) => `${sg(x.markets[m].c.net)} (${x.markets[m].c.n})`).join(' | ') + ' |'), '',
    'Costs: the shared table (assumed, not measured, on five of the ten markets). These windows are the ones the rules were found on.', '');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n')); console.log(verdict);
}
