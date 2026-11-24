// Edge research · fvg-cost5-holdout: the FVG return kept only where cost is at most 5 % of risk, on eight markets no FVG study
// has read (PREREGISTRATION.md, pushed alone first). Paper research only.
//   EDGE_DATA=<cache> node research/edge/fvg-cost5-holdout/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import * as FVG from '../grid7-fvg-wide/run.mjs';
import { walk } from '../../../council/edge-desks-2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud', 'nas100', 'spx500', 'de40'];
export const KEEP = 0.05, CONTEXT = 0.10;
const y = (Y, m = 0) => Date.UTC(Y, m, 1) / 1000;
export const MED_FROM = y(2019), FROM = y(2020), HALF = y(2023), TO = y(2026, 10);
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2020) * 12 + d.getUTCMonth(); };
export const NM = monthOf(TO - 1) + 1;
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
// the market's own median H1 gap (share of ATR) of 2019, the grid's definition on the year before the test
export function median2019(M5, market) {
  const med = {}; for (const tf of FVG.GTF) { const r = FVG.bandsOf(FVG.frames(M5)[tf], market, tf).filter((b) => !b.ctl && b.at >= MED_FROM && b.at < FROM).map((b) => b.ratio).sort((p, q) => p - q); med[tf] = r.length ? r[r.length >> 1] : 0; }
  return med;
}
// rows [month, half, cost ratio, R] of the cell 1h mkt large 1R
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2018-06-01', to: '2026-11-01' }), med = median2019(M5, market), cost = COSTS[market], g1 = FVG.GTF.indexOf('1h'), cap = FVG.CAP['1h'], out = [];
  for (const s of FVG.signals(M5, market, med).sigs) { if (s.ctl || s.g !== g1 || s.kind !== 0 || !s.large) continue; const t = M5[s.fi].t; if (t < FROM || t >= TO) continue;
    const risk = s.s * (s.fill - s.stop); if (!(risk > 0) || risk < cost) continue;
    const o = walk(M5, s.s, s.fi, s.fill, s.stop, s.fill + s.s * risk, t + cap, s.firstFull); if (!o || o.status === 'open') continue;
    out.push([monthOf(t), t < HALF ? 0 : 1, cost / risk, o.R]); }
  return { med, rows: out };
}
export function stat(R, mult = 1, half = null) {
  const X = half == null ? R : R.filter((x) => x[1] === half), n = X.length, ms = new Float64Array(NM); let s = 0, sn = 0, win = 0, c = 0;
  for (const x of X) { const net = x[3] - mult * x[2]; ms[x[0]] += net; s += x[3]; sn += net; c += x[2]; if (x[3] > 0) win++; }
  const a = half === 1 ? monthOf(HALF) : 0, b = half === 0 ? monthOf(HALF) : NM, k = b - a; let m = 0, q = 0; for (let i = a; i < b; i++) { m += ms[i]; q += ms[i] * ms[i]; }
  const mean = m / k, sd = Math.sqrt(Math.max(0, (q - k * mean * mean) / (k - 1)));
  return { n, gross: n ? r3(s / n) : null, net: n ? r3(sn / n) : null, win: n ? r3(win / n) : null, cost: n ? r3(c / n) : null, tNet: sd > 0 ? r2(mean / (sd / Math.sqrt(k))) : null };
}
export const keep = (R, th) => R.filter((x) => x[2] <= th);
export const passOf = (a, h0, h1, x2) => a.n >= 300 && a.net > 0 && a.tNet >= 2 && h0.net > 0 && h1.net > 0 && x2.net > 0;
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const by = {}; let all = []; for (const m of MARKETS) { by[m] = runMarket(m); all = all.concat(by[m].rows); console.log(m, by[m].rows.length, JSON.stringify(by[m].med)); }
  const Kp = keep(all, KEEP), A = stat(Kp), H0 = stat(Kp, 1, 0), H1 = stat(Kp, 1, 1), X2 = stat(Kp, 2), pass = passOf(A, H0, H1, X2), ALL = stat(all), K10 = stat(keep(all, CONTEXT));
  const sg = (v) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`);
  const verdict = `${pass ? 'PASS' : 'FAIL'}. ${pass ? 'The low-cost cut held' : 'The low-cost hint did not hold'} on eight unread markets. The FVG return kept where cost is at most 5 % of risk made ${sg(A.gross)} a trade before costs and ${sg(A.net)} after (n ${A.n}, 2020-26, month t ${A.tNet}); 2020-22 ${sg(H0.net)}, 2023-26 ${sg(H1.net)}; at twice the cost ${sg(X2.net)}.`;
  const markets = Object.fromEntries(MARKETS.map((m) => [m, { med1h: r3(by[m].med['1h']), all: stat(by[m].rows), kept: stat(keep(by[m].rows, KEEP)) }]));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'fvg-cost5-holdout', built: '2026-11-24', verdict, keep: KEEP, kept: { all: A, h2020: H0, h2023: H1, x2: X2 }, context: { allTrades: ALL, keep10: K10 }, markets }, null, 1) + '\n');
  const row = (nm, s) => `| ${nm} | ${s.n} | ${s.win == null ? 'n/a' : (100 * s.win).toFixed(1) + ' %'} | ${sg(s.gross)} | ${sg(s.net)} | ${s.tNet ?? 'n/a'} |`;
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# FVG return with a cost of at most 5 % of the risk, on eight unread markets (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
    'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed. Costs are ASSUMED on all eight markets.', '',
    '| Trades, 2020-26 | n | Winners | Before costs | After costs | Month t |', '|---|---|---|---|---|---|', row('**Kept: cost at most 5 % of risk (the test)**', A), row('the same, 2020-22', H0), row('the same, 2023-26', H1), row('the same at twice the cost', X2), row('context: cost at most 10 %', K10), row('context: all trades of the cell', ALL), '',
    '## Kept trades by market (context)', '', '| Market | Median H1 gap 2019 (x ATR) | All n | All after costs | Kept n | Kept after costs (t) |', '|---|---|---|---|---|---|',
    ...MARKETS.map((m) => { const x = markets[m]; return `| ${m} | ${x.med1h} | ${x.all.n} | ${sg(x.all.net)} | ${x.kept.n} | ${sg(x.kept.net)} (${x.kept.tNet ?? 'n/a'}) |`; }), ''].join('\n'));
  console.log(verdict);
}
