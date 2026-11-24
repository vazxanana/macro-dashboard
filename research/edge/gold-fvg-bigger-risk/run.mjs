// research/edge/gold-fvg-bigger-risk/run.mjs - the FVG return (grid7-fvg-wide cell "mkt large 1R") on gold's H4 and D1 gaps,
// charged at the demo broker's measured hourly spread + commission + financing on buys (PREREGISTRATION.md, 24 Nov 2026).
// Research only: nothing live imports it. The signals are fvg-htf-exits' (grid7's code), the exit dom-trade-through's manage,
// the cost model fvg-hourcost's costFrac and profile.json: all imported, never edited.
//   EDGE_DATA=<cache> node research/edge/gold-fvg-bigger-risk/run.mjs trades <dir>   -> <dir>/trades.json
//   EDGE_DATA=<cache> node research/edge/gold-fvg-bigger-risk/run.mjs cut <dir>      -> <dir>/cut.json
//   node research/edge/gold-fvg-bigger-risk/run.mjs report <dir>                     -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { manage } from '../dom-trade-through/run.mjs';
import { signals, CAP } from '../fvg-htf-exits/run.mjs';
import { costFrac, exitWalk } from '../fvg-hourcost/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-fvg-wide/run.mjs';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKET = 'xau', TESTS = [['T1', '4h'], ['T2', '1d']], N_MIN = 200;
export const GATE = { '4h': { n: [1249, 1697], mean: [0.115447, 0.023373] }, '1d': { n: [241, 312] } };
const PROF = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'fvg-hourcost', 'profile.json'), 'utf8'));
export const HOURS = PROF.markets.xau.hours, COMM = PROF.symbols.markets.xau.commissionRT;
const HOUR = (t) => new Date(t * 1000).getUTCHours();
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const q = (lo + hi) >> 1; if (X[q][0] <= t) lo = q + 1; else hi = q; } return lo > 0 && t <= X[lo - 1][1]; };
const r6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null), r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

// rows: [tf, ctl, fillT, s, fill, risk, R, exitAt, kind(0 stop 1 target 2 time)]
export function trades(M5 = K.load(MARKET, '5m', { from: '2004-01-01', to: '2026-11-01' })) {
  const { sigs, med } = signals(M5, MARKET), cost = COSTS[MARKET], X = exclusions(MARKET), out = [];
  let mism = 0, open = 0, small = 0, dropped = 0;
  for (const sg of sigs) {
    if (!sg.large) continue;
    const t = M5[sg.fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) { dropped++; continue; }
    const risk = sg.s * (sg.fill - sg.stop); if (!(risk > 0)) continue; if (risk < cost) { small++; continue; }
    const r = manage(M5, sg.s, sg.fi, sg.fill, sg.stop, CAP[sg.tf], sg.firstFull); if (!r) { open++; continue; }
    const x = exitWalk(M5, sg.s, sg.fi, sg.fill, sg.stop, CAP[sg.tf]);
    if (!x || Math.abs(x.R - r.R[0]) > 1e-9) { mism++; continue; }
    out.push([sg.tf, sg.ctl ? 1 : 0, t, sg.s, sg.fill, +risk.toPrecision(8), +r.R[0].toFixed(6), x.at, x.kind]);
  }
  return { market: MARKET, med, candles: M5.length, open, mism, small, dropped, trades: out };
}

// cost of one trade in R: fvg-hourcost's spread + commission model (key 'frac' or 'frac90') + nights x FIN on a buy
export function costOf(row, { key = 'frac', fin = true, mult = 1 } = {}) {
  const [, , t, s, fill, risk, , at, kind] = row;
  const x = { inH: HOUR(t), outH: HOUR(at), kind };
  const sp = costFrac(HOURS, x, 0, key), cm = COMM, nn = fin && s > 0 ? nights(t, at) : 0, fn = nn * FIN.xau.long;
  return { total: (mult * (sp + cm + fn) * fill) / risk, spread: (sp * fill) / risk, comm: (cm * fill) / risk, fin: (fn * fill) / risk, nights: nn };
}

const W = { d: [0, DM], c: [DM, NM] };
export function stats(rows, [ma, mb], opt = {}) {
  const ms = new Float64Array(NM); let n = 0, net = 0, gross = 0, sq = 0, sp = 0, cm = 0, fn = 0, win = 0;
  for (const row of rows) { const m = monthOf(row[2]); if (m < ma || m >= mb) continue;
    const c = opt.zero ? { total: 0, spread: 0, comm: 0, fin: 0 } : costOf(row, opt), r = row[6] - c.total;
    n++; net += r; gross += row[6]; sq += r * r; sp += c.spread; cm += c.comm; fn += c.fin; if (r > 0) win++; ms[m] += r; }
  const t = n ? mstat(ms, ma, mb).t : null;
  return { n, mean: n ? net / n : null, gross: n ? gross / n : null, spreadR: n ? sp / n : null, commR: n ? cm / n : null, finR: n ? fn / n : null,
    win: n ? win / n : null, t, p: t == null ? 1 : p1(t, mb - ma - 1), sum: net, sq };
}
const welchT = (a, b) => { if (a.n < 2 || b.n < 2) return null; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1), se = Math.sqrt(va / a.n + vb / b.n); return se > 0 ? (ma - mb) / se : null; };
const slim = (s) => ({ n: s.n, mean: r6(s.mean), gross: r6(s.gross), spreadR: r6(s.spreadR), commR: r6(s.commR), finR: r6(s.finR), win: r6(s.win), t: r2(s.t) });

export function judge(T) {
  const rows = TESTS.map(([id, tf]) => {
    const real = T.filter((r) => r[0] === tf && r[1] === 0), ctl = T.filter((r) => r[0] === tf && r[1] === 1);
    const d = stats(real, W.d), c = stats(real, W.c), c2 = stats(real, W.c, { mult: 2 }), k = stats(ctl, W.c), vs = welchT(c, k);
    return { id, tf, d, c, c2, k, vs, p: c.p }; });
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= N_MIN && r.c.n >= N_MIN, positive: r.d.mean > 0 && r.c.mean > 0, tConf: r.c.t >= 2, holm: H[i] < 0.05,
      cost2x: r.c2.mean >= 0, control: r.vs != null && r.vs >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

export function cutTest(cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(MARKET, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const k = (g) => [g.tf, g.ctl, g.bt, g.s, g.et, g.fill, g.stop.toFixed(8), g.large].join('|');
  const full = signals(M5, MARKET), out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000, C5 = M5.filter((b) => b.e <= T);
    const A = new Set(signals(C5, MARKET, full.med).sigs.filter((g) => g.et <= T && g.ft < T && g.rt <= T).map(k));
    const B = new Set(full.sigs.filter((g) => g.et <= T && g.ft < T && g.rt <= T).map(k));
    out.push({ cut: c, n: B.size, missing: [...B].filter((x) => !A.has(x)).length, extra: [...A].filter((x) => !B.has(x)).length }); }
  return out;
}

const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), q = s.length >> 1; return s.length % 2 ? s[q] : (s[q - 1] + s[q]) / 2; };
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), N = (x) => Number(x).toLocaleString('en-US');

export function report(dir) {
  const D = JSON.parse(fs.readFileSync(path.join(dir, 'trades.json'), 'utf8')), T = D.trades;
  const cut = fs.existsSync(path.join(dir, 'cut.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'cut.json'), 'utf8')) : [];
  const gate = ['4h', '1d'].map((tf) => { const R = T.filter((r) => r[0] === tf && r[1] === 0), d = stats(R, W.d, { zero: true }), c = stats(R, W.c, { zero: true }), g = GATE[tf];
    const okN = Math.abs(d.n - g.n[0]) <= 0.01 * g.n[0] && Math.abs(c.n - g.n[1]) <= 0.01 * g.n[1];
    const okM = !g.mean || (Math.abs(d.gross - g.mean[0]) <= 0.005 && Math.abs(c.gross - g.mean[1]) <= 0.005);
    return { tf, n: [d.n, c.n], mean: [r6(d.gross), r6(c.gross)], want: g, ok: okN && okM }; });
  const tot = T.length + D.mism, walkOk = D.mism <= 0.001 * tot, cutOk = cut.length > 0 && cut.every((c) => !c.missing && !c.extra);
  const rows = judge(T), ok = gate.every((g) => g.ok) && walkOk && cutOk;
  const verdict = !ok ? 'INCONCLUSIVE' : rows.some((r) => r.pass) ? 'PASS' : 'FAIL';
  const nm = { '4h': 'H4', '1d': 'D1' };
  const headline = `${verdict}. ${rows.filter((r) => r.pass).length} of 2 pass. ` + rows.map((r) => `${r.id} gold ${nm[r.tf]} large 1R: ${f3(r.c.mean)}R a trade after measured costs in 2015-26 (n ${r.c.n}, month t ${r2(r.c.t)}; ${f3(r.c.gross)}R before costs), ${f3(r.d.mean)}R in 2005-14 (n ${r.d.n})`).join('; ') + '.';
  const sens = (name, opt) => ({ name, rows: TESTS.map(([id, tf]) => { const R = T.filter((r) => r[0] === tf && r[1] === 0); return { id, d: slim(stats(R, W.d, opt)), c: slim(stats(R, W.c, opt)) }; }) });
  const sensitivity = [sens('no financing (the task\'s spread + commission model only)', { fin: false }), sens('90th percentile spread of each hour', { key: 'frac90' }), sens('no cost (mid, before costs)', { zero: true })];
  const detail = TESTS.map(([id, tf]) => { const R = T.filter((r) => r[0] === tf && r[1] === 0);
    const sides = ['buy', 'sell'].map((sd) => { const L = R.filter((r) => (sd === 'buy') === (r[3] > 0)); return { side: sd, d: slim(stats(L, W.d)), c: slim(stats(L, W.c)) }; });
    const ys = [...new Set(R.map((r) => new Date(r[2] * 1000).getUTCFullYear()))].sort();
    const years = ys.map((y) => { const L = R.filter((r) => new Date(r[2] * 1000).getUTCFullYear() === y); return { year: y, ...slim(stats(L, [(y - 2005) * 12, Math.min((y - 2004) * 12, NM)])) }; });
    return { id, tf, medRiskFrac: r6(med(R.map((r) => r[5] / r[4]))), medHoldH: r2(med(R.map((r) => (r[7] - r[2]) / 3600))),
      exits: { stop: R.filter((r) => r[8] === 0).length, target: R.filter((r) => r[8] === 1).length, time: R.filter((r) => r[8] === 2).length }, sides, years }; });
  const out = { study: 'gold-fvg-bigger-risk', built: '2026-11-24', verdict, headline, market: MARKET,
    windows: { discovery: '2005-01 to 2014-12 (gold from 2006-03)', confirmation: '2015-01 to 2026-10' },
    cost: { model: 'fvg-hourcost costFrac (gold hourProfile median frac; half spread in + out, + half on a stop) + commission + nights x FIN.xau.long on buys',
      profile: PROF.markets.xau.source, commission: COMM, finLong: FIN.xau.long },
    medians: D.med, counts: { trades: T.length, mism: D.mism, open: D.open, small: D.small, dropped: D.dropped }, walkOk, gate, cut, cutOk,
    tests: rows.map((r) => ({ id: r.id, tf: r.tf, disc: slim(r.d), conf: slim(r.c), conf2x: slim(r.c2), control: slim(r.k), vsControl: r2(r.vs),
      p: +r.p.toPrecision(4), holm: +r.holm.toPrecision(4), checks: r.checks, pass: r.pass })), sensitivity, detail };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const nm = { '4h': 'H4', '1d': 'D1' }, L = [];
  L.push('# Gold FVG return on H4 and D1 gaps at the broker\'s measured costs (result)', '', `**Verdict: ${o.headline}**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, no rule is proposed. One run, no variants. The H4 before-cost figures were already published by `grid7-fvg-wide`',
    'and the D1 entries already read by `fvg-htf-exits` (other exits): this is cost accounting on entries already seen, not new',
    'evidence. A before-cost tilt is not an edge.', '',
    '## What was run', '',
    '`fvg-htf-exits` `signals` on gold (grid7\'s gap, band and market entry; H4 from 5-minute candles, D1 = 17:00 New York days),',
    `large gaps only (height / ATR above gold's 2005-14 median: H4 ${o.medians['4h'].toFixed(4)}, D1 ${o.medians['1d'].toFixed(4)}),`,
    'market entry at the next 5-minute open after the first M15 close inside the gap, stop past the far side + 0.1 ATR, target 1R,',
    'out at the time limit (H4 5 days, D1 20 days). Cost: ' + o.cost.model + ` (profile ${o.cost.profile}; commission ${o.cost.commission};`,
    `financing ${o.cost.finLong} of price a rollover on buys, council/fills.mjs).`, '',
    '## Checks of the harness', '');
  for (const g of o.gate) L.push(`- Gate ${nm[g.tf]} (before costs): n ${g.n.join(' / ')} (want ${g.want.n.join(' / ')})` + (g.want.mean ? `, R ${g.mean.map(f3).join(' / ')} (want ${g.want.mean.map(f3).join(' / ')})` : '') + `: ${g.ok ? 'ok' : 'MISS'}.`);
  L.push(`- Exit walk reproduces manage's R: ${o.counts.mism} mismatches of ${N(o.counts.trades + o.counts.mism)} (${o.walkOk ? 'ok' : 'MISS'}).`);
  L.push(`- No look-ahead (signals known at five dates, recomputed on candles cut there): ` + o.cut.map((c) => `${c.cut} ${c.n} (${c.missing} missing, ${c.extra} extra)`).join('; ') + ` (${o.cutOk ? 'ok' : 'MISS'}).`, '');
  L.push('## Tests (after measured costs; Holm over two)', '',
    '| Test | n 05-14 | net 05-14 (t) | n 15-26 | before costs 15-26 (t) | spread / comm / fin R | net 15-26 (t) | net at 2x cost | control net 15-26 | vs control | Holm p | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const x of o.tests) L.push(`| ${x.id} gold ${nm[x.tf]} large 1R | ${N(x.disc.n)} | ${f3(x.disc.mean)} (${x.disc.t}) | ${N(x.conf.n)} | ${f3(x.conf.gross)} | ${x.conf.spreadR.toFixed(3)} / ${x.conf.commR.toFixed(3)} / ${x.conf.finR.toFixed(3)} | ${f3(x.conf.mean)} (${x.conf.t}) | ${f3(x.conf2x.mean)} | ${f3(x.control.mean)} | ${x.vsControl} | ${x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', 'Failed checks: ' + o.tests.map((x) => `${x.id}: ${Object.entries(x.checks).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}`).join('; ') + '.', '',
    'Month-sum t on calendar months by fill month (empty months 0). Before costs (2005-14): ' + o.tests.map((x) => `${x.id} ${f3(x.disc.gross)}`).join(', ') + '.', '',
    '## Sensitivity (reported, not judged)', '', '| Row | test | net 05-14 (t) | net 15-26 (t) |', '|---|---|---:|---:|');
  for (const s of o.sensitivity) for (const r of s.rows) L.push(`| ${s.name} | ${r.id} | ${f3(r.d.mean)} (${r.d.t}) | ${f3(r.c.mean)} (${r.c.t}) |`);
  L.push('', '## Stops, holds, exits, sides', '', '| Test | median stop (share of price) | median hold h | stop / target / time | buys net 15-26 (n, t) | sells net 15-26 (n, t) |', '|---|---:|---:|---|---:|---:|');
  for (const d of o.detail) { const b = d.sides[0].c, s = d.sides[1].c;
    L.push(`| ${d.id} ${nm[d.tf]} | ${(d.medRiskFrac * 100).toFixed(3)} % | ${d.medHoldH} | ${d.exits.stop} / ${d.exits.target} / ${d.exits.time} | ${f3(b.mean)} (${b.n}, ${b.t}) | ${f3(s.mean)} (${s.n}, ${s.t}) |`); }
  L.push('', '## Year by year (after measured costs; n, net R a trade)', '', '| Year | H4 | D1 |', '|---|---:|---:|');
  const ys = [...new Set(o.detail.flatMap((d) => d.years.map((y) => y.year)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + o.detail.map((d) => { const r = d.years.find((q) => q.year === y); return r ? `${r.n}, ${f3(r.mean)}` : ''; }).join(' | ') + ' |');
  const [a, b] = o.tests, costR = (x) => x.conf.gross - x.conf.mean;
  L.push('', '## Reading (written after the results)', '',
    `- The larger stop does cut the cost in R: about ${costR(a).toFixed(3)}R a trade on H4 and ${costR(b).toFixed(3)}R on D1 (of which financing`,
    `  ${b.conf.finR.toFixed(3)}R) in 2015-26, against 0.048R on H1 in \`fvg-hourcost\`. But the before-cost return shrinks with it: gold`,
    `  H4 ${f3(a.conf.gross)}R (month t ${o.sensitivity[2].rows[0].c.t}) and D1 ${f3(b.conf.gross)}R (t ${o.sensitivity[2].rows[1].c.t}) in 2015-26; D1 was ${f3(b.disc.gross)}R before costs in 2005-14.`,
    '- No test is positive after costs in both windows, none reaches a confirmation month t of 1, neither beats its random bands.',
    '  The question is answered for gold: a bigger gap timeframe does not rescue the FVG return. Do not test other exits or',
    '  timeframes of this cell on gold on these years.');
  L.push('', '## Caveats', '',
    '- In sample: grid7 chose the cell on these years, and fvg-htf-exits read the D1 entries. Even a pass would only be a candidate for',
    '  a forward paper record.',
    '- Today\'s measured spread (Nov 2026 profile, first two minutes of each hour on 44 weekdays) and today\'s financing rate charged',
    '  on every past year; slippage beyond the quote is only the extra half spread on stops. OANDA mid candles, not broker ticks.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a] = process.argv.slice(2);
  if (cmd === 'trades') { fs.mkdirSync(a, { recursive: true }); const t0 = Date.now(); const r = trades();
    fs.writeFileSync(path.join(a, 'trades.json'), JSON.stringify(r)); console.log('trades', r.trades.length, 'mism', r.mism, 'open', r.open, `${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  else if (cmd === 'cut') { fs.mkdirSync(a, { recursive: true }); const r = cutTest(); fs.writeFileSync(path.join(a, 'cut.json'), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'report') { const o = report(a); console.log(o.headline); }
  else console.log('usage: trades <dir> | cut <dir> | report <dir>');
}
