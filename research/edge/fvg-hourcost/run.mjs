// research/edge/fvg-hourcost/run.mjs - the FVG return (grid7-fvg-wide cell 1h mkt large 1R) charged at the demo broker's measured
// spread by UTC hour plus its commission (PREREGISTRATION.md, 24 Nov 2026). Paper research only: nothing live imports it,
// nothing is placed. grid7-fvg-wide's signal code and dom-trade-through's manage are imported, never edited.
//   node research/edge/fvg-hourcost/run.mjs profile                           -> profile.json (from council-data, git show)
//   EDGE_DATA=<cache> node research/edge/fvg-hourcost/run.mjs trades <m> <dir> -> <dir>/T-<m>.json
//   node research/edge/fvg-hourcost/run.mjs report <dir>                      -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { manage } from '../dom-trade-through/run.mjs';
import { signals, MARKETS as G7, CAP, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-fvg-wide/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
export const MEASURED = ['xau', 'xag', 'usdjpy'];
export const APART = G7.filter((m) => !MEASURED.includes(m));
export const SYM = { xau: 'XAUUSD', xag: 'XAGUSD', eurusd: 'EURUSD', gbpusd: 'GBPUSD', usdjpy: 'USDJPY', audusd: 'AUDUSD', nzdusd: 'NZDUSD',
  usdcad: 'USDCAD', usdchf: 'USDCHF', eurjpy: 'EURJPY' };
export const HP_COMMIT = { xau: '0459ec37e2', xag: '19c2477d5b' };
export const SYMBOLS_COMMIT = '853060f780536f829f4e3f52ff201e9e81702185';
export const N_MIN = 200;
const G7RES = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'grid7-fvg-wide', 'result.json'), 'utf8'));
export const CELL = '1h mkt large 1R';
const HOUR = (t) => new Date(t * 1000).getUTCHours();
const r6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null), r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const gitShow = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// ---- the measured profiles ---------------------------------------------------------------------------------------------------
export function buildProfile() {
  const slim = (hp) => hp.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac, frac90: h.frac90 }));
  const out = { built: '2026-11-24', markets: {} };
  for (const m of ['xau', 'xag']) { const j = JSON.parse(gitShow(HP_COMMIT[m], `research/probe/ticks-${SYM[m]}.json`));
    out.markets[m] = { source: `council-data ${HP_COMMIT[m]} research/probe/ticks-${SYM[m]}.json hourProfile (at ${j.at})`, hours: slim(j.hourProfile) }; }
  const fl = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'fade-late-hourcost', 'profile.json'), 'utf8'));
  out.markets.usdjpy = { source: `fade-late-hourcost/profile.json (${fl.source})`, hours: slim(fl.markets.usdjpy.hours) };
  out.goldMarks = { source: `fade-late-hourcost/profile.json xau (${fl.source})`, hours: slim(fl.markets.xau.hours) };
  const sy = JSON.parse(gitShow(SYMBOLS_COMMIT, 'ctrader/symbols.json'));
  out.symbols = { source: `council-data ${SYMBOLS_COMMIT} ctrader/symbols.json`, markets: {} };
  for (const m of G7) { const x = sy.symbols[SYM[m]];
    out.symbols.markets[m] = { commissionRT: x.commissionRT, spreadTypical: x.spreadTypical ? { n: x.spreadTypical.n, median: x.spreadTypical.median } : null }; }
  return out;
}

// ---- the 1R walk of manage() slot 0, returning where and how it ended (firstFull true: the mkt entry) ------------------------
export function exitWalk(M5, s, fi, fill, stop, cap) {
  const risk = s * (fill - stop), tgt = fill + s * risk, dl = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) return { R: (s * (b.o - fill)) / risk, at: b.t, kind: 0 };
      if (s * (b.o - tgt) >= 0) return { R: (s * (b.o - fill)) / risk, at: b.t, kind: 1 }; }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { R: -1, at: b.t, kind: 0 };
    if (s * ((s > 0 ? b.h : b.l) - tgt) >= 0) return { R: 1, at: b.t, kind: 1 };
    if (b.e >= dl) return { R: (s * (b.c - fill)) / risk, at: b.e - 1, kind: 2 };
  }
  return null;
}

// rows: [fillT, ctl, R, fill, risk, exitAt, kind(0 stop 1 target 2 time)]
export function runMarket(market, M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' })) {
  const med = G7RES.meta.find((x) => x.market === market).medians;
  const { sigs } = signals(M5, market, med), cost = COSTS[market], X = exclusions(market), cap = CAP['1h'], out = [];
  let mism = 0, open = 0, bad = 0;
  for (const sg of sigs) {
    if (sg.g !== 1 || sg.kind !== 0 || !sg.large) continue;
    const t = M5[sg.fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) continue;
    const risk = sg.s * (sg.fill - sg.stop); if (!(risk > 0)) { bad++; continue; } if (risk < cost) continue;
    const r = manage(M5, sg.s, sg.fi, sg.fill, sg.stop, cap, sg.firstFull); if (!r) { open++; continue; }
    const x = exitWalk(M5, sg.s, sg.fi, sg.fill, sg.stop, cap);
    if (!x || Math.abs(x.R - r.R[0]) > 1e-9) { mism++; continue; }
    out.push([t, sg.ctl, +r.R[0].toFixed(6), sg.fill, +risk.toPrecision(8), x.at, x.kind]);
  }
  return { market, candles: M5.length, open, mism, bad, trades: out };
}

// ---- costs and statistics -------------------------------------------------------------------------------------------------
// cost as a share of price: half the spread of the entry hour and of the exit hour, the commission, another half spread on a stop
export function costFrac(hours, x, comm, key = 'frac') {
  const a = hours[x.inH][key], b = hours[x.outH][key];
  return 0.5 * a + 0.5 * b + comm + (x.kind === 0 ? 0.5 * b : 0);
}
export const asTrade = (row) => ({ t: row[0], ctl: row[1], R: row[2], fill: row[3], risk: row[4], inH: HOUR(row[0]), outH: HOUR(row[5]), kind: row[6] });
export function charge(rows, fn, mult = 1) { return rows.map(asTrade).map((x) => ({ ...x, net: x.R - mult * fn(x) })); }
const W = { d: [0, DM], c: [DM, NM] };
export function stats(list, [ma, mb]) {
  const ms = new Float64Array(NM); let n = 0, net = 0, gross = 0, sq = 0;
  for (const x of list) { const m = monthOf(x.t); if (m < ma || m >= mb) continue; n++; net += x.net; gross += x.R; sq += x.net * x.net; ms[m] += x.net; }
  const t = n ? mstat(ms, ma, mb).t : null;
  return { n, mean: n ? r6(net / n) : null, gross: n ? r6(gross / n) : null, costR: n ? r6((gross - net) / n) : null, t: r2(t),
    p: t == null ? 1 : p1(t, mb - ma - 1), sum: net, sq };
}
const welchT = (a, b) => { if (a.n < 2 || b.n < 2) return null; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1), se = Math.sqrt(va / a.n + vb / b.n); return se > 0 ? (ma - mb) / se : null; };
const slim = (s) => ({ n: s.n, mean: s.mean, gross: s.gross, costR: s.costR, t: s.t });
export function judgeOne(real, real2, ctl) {
  const d = stats(real, W.d), c = stats(real, W.c), c2 = stats(real2, W.c), k = stats(ctl, W.c);
  const vs = welchT(c, k);
  return { d: slim(d), c: slim(c), c2x: slim(c2), control: slim(k), vsControl: r2(vs), p: c.p,
    cond: d.n >= N_MIN && c.n >= N_MIN && d.mean > 0 && c.mean > 0 && c.t >= 2 && c2.mean >= 0 && vs != null && vs >= 2 };
}

export function report(dir) {
  const prof = JSON.parse(fs.readFileSync(path.join(HERE, 'profile.json'), 'utf8'));
  const D = Object.fromEntries(G7.map((m) => [m, JSON.parse(fs.readFileSync(path.join(dir, `T-${m}.json`), 'utf8'))]));
  const g7 = Object.fromEntries(G7RES.perMarket[CELL].map((x) => [x.market, x]));
  const gate = G7.map((m) => { const real = D[m].trades.filter((r) => r[1] === 0).map(asTrade).map((x) => ({ ...x, net: x.R }));
    const d = stats(real, W.d), c = stats(real, W.c), ref = g7[m];
    const ok = Math.abs(d.n - ref.d.n) <= 0.01 * ref.d.n && Math.abs(c.n - ref.c.n) <= 0.01 * ref.c.n && Math.abs(d.mean - ref.d.mean) <= 0.005 && Math.abs(c.mean - ref.c.mean) <= 0.005;
    const tot = D[m].trades.length + D[m].mism;
    return { market: m, d: { n: d.n, mean: d.mean }, c: { n: c.n, mean: c.mean }, ref: { d: { n: ref.d.n, mean: ref.d.mean }, c: { n: ref.c.n, mean: ref.c.mean } },
      mism: D[m].mism, walkOk: D[m].mism <= 0.001 * tot, ok }; });
  const H = (m, key = 'frac', hours = prof.markets[m].hours) => (x) => costFrac(hours, x, prof.symbols.markets[m].commissionRT, key) * x.fill / x.risk;
  const R = (m, fn, mult = 1) => charge(D[m].trades.filter((r) => r[1] === 0), fn, mult);
  const C = (m, fn, mult = 1) => charge(D[m].trades.filter((r) => r[1] === 1), fn, mult);
  const sets = [['pool', MEASURED], ...MEASURED.map((m) => [m, [m]])];
  const tests = sets.map(([k, ms]) => ({ key: k, ...judgeOne(ms.flatMap((m) => R(m, H(m))), ms.flatMap((m) => R(m, H(m), 2)), ms.flatMap((m) => C(m, H(m)))) }));
  const hp = K.holm(tests.map((x) => x.p));
  tests.forEach((x, i) => { x.holm = +hp[i].toPrecision(4); x.p = +x.p.toPrecision(4); x.pass = x.cond && hp[i] < 0.05; });
  const ok = gate.every((g) => g.ok && g.walkOk);
  const T1 = tests[0], verdict = !ok ? 'INCONCLUSIVE' : T1.pass ? 'PASS' : 'FAIL';
  // reported, not judged
  const sens = (name, fnOf) => ({ name, rows: sets.map(([k, ms]) => { const L = ms.flatMap((m) => R(m, fnOf(m))); return { key: k, d: slim(stats(L, W.d)), c: slim(stats(L, W.c)) }; }) });
  const sensitivity = [
    sens('90th percentile spread of each hour', (m) => H(m, 'frac90')),
    sens('gold: the fade marks profile instead of hourProfile', (m) => (m === 'xau' ? H(m, 'frac', prof.goldMarks.hours) : H(m))),
    sens('no cost (mid, before costs)', () => () => 0),
  ];
  const apart = APART.map((m) => { const sm = prof.symbols.markets[m], sp = sm.spreadTypical && sm.spreadTypical.median != null ? sm.spreadTypical.median : 0;
    const a = (x) => COSTS[m] / x.risk, b = (x) => (sm.commissionRT * x.fill + (sp > 0 ? 1.5 * sp : 0)) / x.risk;
    const LA = R(m, a), LB = R(m, b);
    return { market: m, commissionRT: sm.commissionRT, spreadTypical: sp, assumed: { d: slim(stats(LA, W.d)), c: slim(stats(LA, W.c)) }, commission: { d: slim(stats(LB, W.d)), c: slim(stats(LB, W.c)) } }; });
  const byHour = MEASURED.map((m) => { const L = R(m, H(m)); return { market: m, rows: Array.from({ length: 24 }, (_, h) => ({ hour: h, ...slim(stats(L.filter((x) => x.inH === h), [0, NM])) })) }; });
  const byYear = MEASURED.map((m) => { const L = R(m, H(m)); const ys = [...new Set(L.map((x) => new Date(x.t * 1000).getUTCFullYear()))].sort();
    return { market: m, rows: ys.map((y) => ({ year: y, ...slim(stats(L.filter((x) => new Date(x.t * 1000).getUTCFullYear() === y), [(y - 2005) * 12, Math.min((y - 2004) * 12, NM)])) })) }; });
  const exitsTab = MEASURED.map((m) => { const L = R(m, H(m)); return { market: m, n: L.length, stop: L.filter((x) => x.kind === 0).length, target: L.filter((x) => x.kind === 1).length, time: L.filter((x) => x.kind === 2).length,
    medRiskFrac: r6(med(L.map((x) => x.risk / x.fill))) }; });
  const f = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
  const headline = `${verdict}. At measured costs the pooled FVG return (xau, xag, usdjpy) made ${f(T1.d.mean)}R a trade in 2005-14 (n ${T1.d.n}, month t ${T1.d.t}) and ${f(T1.c.mean)}R in 2015-26 (n ${T1.c.n}, t ${T1.c.t}; ${f(T1.c.gross)}R before costs).`;
  const out = { study: 'fvg-hourcost', built: '2026-11-24', verdict, headline, cell: CELL, measured: MEASURED, apart: APART, gate, profile: { xau: prof.markets.xau.source, xag: prof.markets.xag.source, usdjpy: prof.markets.usdjpy.source, symbols: prof.symbols.source },
    tests, sensitivity, unmeasured: apart, byHour, byYear, exits: exitsTab };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, prof));
  return out;
}
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

function resultMd(o, prof) {
  const f = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), N = (x) => Number(x).toLocaleString('en-US');
  const name = { pool: 'T1 pooled (xau, xag, usdjpy)', xau: 'T2 gold', xag: 'T3 silver', usdjpy: 'T4 USD/JPY' };
  const L = [`# The FVG return at the demo broker's measured hourly spreads (result)`, '', `**Verdict: ${o.headline}**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, no rule is proposed. One run, no variants. These years were already read by `grid7-fvg-wide`, which chose the cell:',
    'this is cost accounting on a selection already made. A before-cost tilt is not an edge.', '',
    '## What was run', '',
    '`grid7-fvg-wide` cell `1h mkt large 1R` by its own code (imported): an H1 three-candle gap larger than the market\'s 2005-14',
    'median gap / ATR (the medians stored in its result.json), market entry at the next 5-minute open after the first M15 close',
    'inside the gap, stop past the far side + 0.1 ATR, target 1R, out after 2 days; OANDA mid 5-minute candles. Cost a trade: half',
    'the measured spread of the entry hour and of the exit hour, the broker\'s commission, and on a stop exit another half spread.',
    'Measured profiles: ' + MEASURED.map((m) => `${m} = ${o.profile[m]}`).join('; ') + `. Commission: ${o.profile.symbols}.`, '',
    'Markets with a measured hourly profile: **xau, xag** (`hourProfile`), **usdjpy** (a profile built from the broker\'s own',
    'quotes by `fade-late-hourcost`). No hourly profile: ' + APART.join(', ') + ' (reported apart, not judged).', '',
    '## Gate (before costs, against grid7\'s perMarket figures of the cell)', '',
    '| Market | n 05-14 (grid7) | R 05-14 (grid7) | n 15-26 (grid7) | R 15-26 (grid7) | walk mismatches | ok |', '|---|---:|---:|---:|---:|---:|---|'];
  for (const g of o.gate) L.push(`| ${g.market} | ${N(g.d.n)} (${N(g.ref.d.n)}) | ${f(g.d.mean)} (${f(g.ref.d.mean)}) | ${N(g.c.n)} (${N(g.ref.c.n)}) | ${f(g.c.mean)} (${f(g.ref.c.mean)}) | ${g.mism} | ${g.ok && g.walkOk ? 'yes' : 'NO'} |`);
  L.push('', '## Tests (after measured costs; Holm over four)', '',
    '| Test | n 05-14 | net 05-14 (t) | n 15-26 | before costs 15-26 (t) | cost R | net 15-26 (t) | 2x cost 15-26 | control net 15-26 | vs control | Holm p | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const x of o.tests) L.push(`| ${name[x.key]} | ${N(x.d.n)} | ${f(x.d.mean)} (${x.d.t}) | ${N(x.c.n)} | ${f(x.c.gross)} | ${x.c.costR.toFixed(3)} | ${f(x.c.mean)} (${x.c.t}) | ${f(x.c2x.mean)} | ${f(x.control.mean)} | ${x.vsControl} | ${x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', 'Month-sum t on calendar months (2005-01 to 2014-12, 2015-01 to 2026-10; empty months 0). Pass = n >= 200 in each window,',
    'net > 0 in both windows, month t >= 2 in 2015-26 with Holm p < 0.05, net >= 0 at 2x cost, Welch t >= 2 against the random-band control.', '',
    '## Sensitivity (reported, not judged)', '', '| Row | test | n 15-26 | net 05-14 (t) | net 15-26 (t) |', '|---|---|---:|---:|---:|');
  for (const s of o.sensitivity) for (const r of s.rows) L.push(`| ${s.name} | ${r.key} | ${N(r.c.n)} | ${f(r.d.mean)} (${r.d.t}) | ${f(r.c.mean)} (${r.c.t}) |`);
  L.push('', '## Markets without a measured hourly profile (reported apart, not judged)', '',
    'Two costs: the grid\'s ASSUMED round trip (`combo-grid-2` `COSTS`), and the commission plus 1.5 x the council\'s measured typical spread',
    '(`spreadTypical.median`, not by hour; 0 on most majors: the raw-spread account) as a lower bound.', '',
    '| Market | n 15-26 | before costs 15-26 | assumed: net 05-14 / 15-26 (t) | commission only: net 05-14 / 15-26 (t) |', '|---|---:|---:|---:|---:|');
  for (const a of o.unmeasured) L.push(`| ${a.market} | ${N(a.assumed.c.n)} | ${f(a.assumed.c.gross)} | ${f(a.assumed.d.mean)} / ${f(a.assumed.c.mean)} (${a.assumed.c.t}) | ${f(a.commission.d.mean)} / ${f(a.commission.c.mean)} (${a.commission.c.t}) |`);
  L.push('', '## Exits and stop size (2005-26)', '', '| Market | n | stop | target | time | median stop as a share of price |', '|---|---:|---:|---:|---:|---:|');
  for (const e of o.exits) L.push(`| ${e.market} | ${N(e.n)} | ${N(e.stop)} | ${N(e.target)} | ${N(e.time)} | ${(e.medRiskFrac * 100).toFixed(3)} % |`);
  L.push('', '## Year by year (after measured costs; n, net R a trade, month t)', '', '| Year | ' + MEASURED.join(' | ') + ' |', '|---|' + MEASURED.map(() => '---:').join('|') + '|');
  const ys = [...new Set(o.byYear.flatMap((b) => b.rows.map((r) => r.year)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + o.byYear.map((b) => { const r = b.rows.find((q) => q.year === y); return r ? `${r.n}, ${f(r.mean)} (${r.t})` : ''; }).join(' | ') + ' |');
  L.push('', '## Measured spread by UTC hour (median, share of price x 10^5)', '', '| Hour | ' + MEASURED.join(' | ') + ' |', '|---:|' + MEASURED.map(() => '---:').join('|') + '|');
  for (let h = 0; h < 24; h++) L.push(`| ${String(h).padStart(2, '0')} | ` + MEASURED.map((m) => { const r = prof.markets[m].hours[h]; return r.frac == null ? 'n/a' : `${(r.frac * 1e5).toFixed(2)} (n ${r.n})`; }).join(' | ') + ' |');
  L.push('', '## Caveats', '',
    '- In sample: grid7 chose this cell on these years; a pass would only be a candidate for a forward paper record.',
    '- Profiles are recent (Nov 2026, today\'s relative spread charged on every past year); the gold and silver profiles are the',
    '  first two minutes of each hour on 44 weekdays, USD/JPY\'s are quotes at another rule\'s fills. Slippage beyond the quote is',
    '  only the extra half spread on stops; target fills at the mid level are charged half a spread.',
    '- OANDA mid candles, not broker ticks.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'profile') { fs.writeFileSync(path.join(HERE, 'profile.json'), JSON.stringify(buildProfile(), null, 1) + '\n'); console.log('profile.json'); }
  else if (cmd === 'trades') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, `T-${a}.json`), JSON.stringify(r)); console.log(a, r.trades.length, 'mism', r.mism, 'open', r.open, `${((Date.now() - t0) / 1000).toFixed(0)} s`); }
  else if (cmd === 'report') { const o = report(a); console.log(o.headline); }
  else console.log('usage: profile | trades <m> <dir> | report <dir>');
}
