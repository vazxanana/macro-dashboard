// Edge research · gold-vol-breakout-h4-side: the gold volatility breakout (gold-vol-breakout T1, unchanged) taken only on the
// side of the H4 trend (last 20-close Donchian break of H4 candles closed before 00:00 UTC), as fixed in PREREGISTRATION.md.
// Every trading function comes from original.mjs, a verbatim copy of the gold-vol-breakout study's run.mjs; this file builds
// the H4 state, splits the base trades by it, runs the two tests, the placebo and the report.
//   node research/edge/gold-vol-breakout-h4-side/run.mjs <dir>   (<dir>/xau-5m.json.gz, OANDA mid M5 rows [t,o,h,l,c] 2006-11 →,
//                                                                 out of git; writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const BASE = O.TESTS.T1;
export const WIN = ['2007-01-01', '2026-10-31'];
export const HALVES = { H1: ['2007-01-01', '2016-12-31'], H2: ['2017-01-01', '2026-10-31'] };
export const H4 = 4 * 3600, DON = 20, LOOK = 60, MIN_M5 = 12;
// the replication's 2007-15 T1, the harness gate (must be equal)
export const GATE = { win: ['2007-01-01', '2015-12-31'], n: 1657, netR: 0.111, grossR: 0.203, t: 3.19 };
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ─── H4 candles aligned to 17:00 New York (grid 01, 05, 09, 13, 17, 21 New York wall clock) ───
export const blockKey = (t) => { const loc = t - nyOffsetH(t) * 3600; return t - ((((loc - 3600) % H4) + H4) % H4); };
export function buildH4(rows) {
  const out = []; let cur = null;
  for (const r of rows) {
    const k = blockKey(r[0]);
    if (!cur || cur.time !== k) { if (cur) out.push(cur); cur = { time: k, close: r[4], n: 0 }; }
    cur.close = r[4]; cur.n++;
  }
  if (cur) out.push(cur);
  return out.filter((b) => b.n >= MIN_M5);
}
// break direction of each H4 candle: +1 close above the highest of the 20 closes before, −1 below the lowest, 0 otherwise
export function breaks(h4) {
  return h4.map((b, i) => {
    if (i < DON) return 0;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - DON; j < i; j++) { hi = Math.max(hi, h4[j].close); lo = Math.min(lo, h4[j].close); }
    return b.close > hi ? 1 : b.close < lo ? -1 : 0;
  });
}
// the state at each day's 00:00 UTC from H4 candles whose nominal end (start + 4 h) is at or before it
export function stateAt(h4, d0s) {
  const br = breaks(h4), out = new Map(); let i = -1, last = -1;   // i = last used candle, last = index of its latest break
  for (const d0 of [...d0s].sort((a, b) => a - b)) {
    while (i + 1 < h4.length && h4[i + 1].time + H4 <= d0) { i++; if (br[i]) last = i; }
    out.set(d0, i < DON || last < 0 || i - last >= LOOK ? 0 : br[last]);
  }
  return out;
}

// ─── the base trades, tagged ───
export function daysOf(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, full = rows.filter((r) => r[0] < lastFull);
  const days = O.buildDays(full), st = stateAt(buildH4(full), days.map((d) => d.d0));
  return { days: days.map((d) => ({ ...d, h4: st.get(d.d0) })), dataEnd: ymdOf(lastFull - DAY) };
}
export function baseTrades(days, w) {
  const tr = [], skips = {};
  for (const d of days) {
    if (!inW(d.day, w)) continue;
    const s = O.daySkip(d); if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    const x = O.vbTrade(d.bars, { ...BASE, prevRange: d.prevRange });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, h4: d.h4, ...x });
  }
  return { tr, skips };
}
// T1: side agrees with the state; T2: agrees, or the state is none; against: the side disagrees with a set state
export const keepT1 = (x) => x.h4 !== 0 && x.side === x.h4;
export const keepT2 = (x) => x.h4 === 0 || x.side === x.h4;
export const against = (x) => x.h4 !== 0 && x.side !== x.h4;

export function welch(a, b) {
  const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length;
  return { diff: r3(mean(a) - mean(b)), t: r2((mean(a) - mean(b)) / Math.sqrt(va + vb)) };
}
export function placebo(base, k, seeds = O.SEEDS) {
  const res = [];
  for (let s = 1; s <= seeds; s++) {
    const rand = O.rng(s), a = base.map((x) => x.net);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    res.push(r3(mean(a.slice(0, k))));
  }
  return res;
}
const bySplit = (tr) => ({ all: O.summary(tr), H1: O.summary(tr.filter((x) => inW(x.day, HALVES.H1))), H2: O.summary(tr.filter((x) => inW(x.day, HALVES.H2))) });
export function decide(res, pl) {
  const ks = ['T1', 'T2'], ps = ks.map((k) => O.normP(res[k].all.t)), adj = O.holm(ps), out = {};
  ks.forEach((k, i) => {
    const s = res[k], b = res.base, a = res.against, beaten = pl[k].filter((v) => s.all.netR > v).length;
    const checks = { t2: s.all.t >= 2, holm: adj[i] < 0.05, beatsBaseH1: s.H1.netR > b.H1.netR, beatsBaseH2: s.H2.netR > b.H2.netR,
      posH1: s.H1.netR > 0, posH2: s.H2.netR > 0, cost2x: s.all.net2R > 0, againstLowerH1: a.H1.netR < s.H1.netR, againstLowerH2: a.H2.netR < s.H2.netR,
      placebo: beaten >= 38, n30: s.all.n >= 30 };
    out[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), placeboBeaten: beaten, checks, pass: Object.values(checks).every(Boolean) };
  });
  return out;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
const failed = (d) => Object.entries(d.checks).filter(([, v]) => !v).map(([k]) => k);
export function verdictLine(res, dec) {
  const n = Object.values(dec).filter((x) => x.pass).length, s = res.T1.all, f = failed(dec.T1);
  return `${dec.T1.pass ? 'PASS' : 'FAIL'}, ${n} of 2: H4-side gold breakout 2007-26 ${sg(s.netR)}R a trade net (n ${s.n}, month t ${s2(s.t)}) vs base ${sg(res.base.all.netR)}R${f.length ? `; failed ${f.slice(0, 3).join(', ')}` : ''}`;
}
export function report(R) {
  const L = [], T = R.tests, yn = (b) => (b ? 'yes' : 'no');
  const row = (lab, per, x) => `| ${lab} | ${per} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.maxDD)} |`;
  L.push('# Gold: the volatility breakout taken only on the side of the H4 trend', '');
  L.push('Paper research only. A filter on a stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of its records were read). Nothing live changed, no proposal. The filter, tests and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The base rule is the `gold-vol-breakout` study\'s T1, its functions imported from `original.mjs`, a verbatim copy (sha256 in `result.json`). Every window of the base rule had already been read; the H4 split had not. This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Harness gate', '', `Base rule on ${GATE.win[0]} → ${GATE.win[1]}: n ${R.gate.got.n}, ${sg(R.gate.got.netR)}R net, gross ${sg(R.gate.got.grossR)}R, month t ${s2(R.gate.got.t)} (replication: n ${GATE.n}, ${sg(GATE.netR)}R, ${sg(GATE.grossR)}R, t ${s2(GATE.t)}): ${R.gate.ok ? 'equal' : 'DIFFERENT'}.`, '');
  L.push('## Streams', '');
  L.push('| Stream | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Total R | t (months) | Gross t | Max DD R |', '|---|---|---|---|---|---|---|---|---|---|---|');
  const lab = { base: 'Base (no filter)', T1: 'T1 H4 side only', T2: 'T2 H4 side or none', against: 'Against-side (dropped by T1)', none: 'State none' };
  for (const k of ['base', 'T1', 'T2', 'against', 'none']) for (const [w, per] of [['all', `2007 → ${R.window[1]}`], ['H1', '2007-2016'], ['H2', `2017 → ${R.window[1]}`]]) L.push(row(lab[k], per, T[k][w]));
  L.push('', '## Decision (T1 primary; Holm over T1 and T2 on the whole record)', '');
  L.push('| Test | p | Holm p | t ≥ 2 | Holm < 0.05 | beats base H1 | beats base H2 | > 0 H1 | > 0 H2 | 2x cost > 0 | against lower H1 | against lower H2 | placebos beaten (need 38) | n ≥ 30 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const c = d.checks; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.beatsBaseH1)} | ${yn(c.beatsBaseH2)} | ${yn(c.posH1)} | ${yn(c.posH2)} | ${yn(c.cost2x)} | ${yn(c.againstLowerH1)} | ${yn(c.againstLowerH2)} | ${d.placeboBeaten} | ${yn(c.n30)} | **${d.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Kept against dropped (T1 kept minus against-side, net R a trade, Welch t)', '', '| Period | Difference | Welch t |', '|---|---|---|');
  for (const [w, per] of [['all', 'whole'], ['H1', '2007-2016'], ['H2', `2017 → ${R.window[1]}`]]) L.push(`| ${per} | ${sg(R.keptVsAgainst[w].diff)} | ${s2(R.keptVsAgainst[w].t)} |`);
  L.push('', '## What the filter drops', '', `Base trades ${R.counts.base}; H4 state at those days: bullish ${R.counts.bull}, bearish ${R.counts.bear}, none ${R.counts.none}. T1 keeps ${R.counts.T1} (drops ${R.counts.base - R.counts.T1}: ${R.counts.against} against the state, ${R.counts.none} on a none day); T2 keeps ${R.counts.T2}. Buys kept by T1 ${R.counts.T1buys}, sells ${R.counts.T1sells}.`);
  const p = R.placebo;
  L.push('', '## Placebo (whole record, 40 seeds)', '', 'Random subsets of the base trades, the same size as T1\'s kept set, drawn without replacement.', '');
  L.push('| T1 net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |', '|---|---|---|---|', `| ${sg(T.T1.all.netR)} | ${sg(p.T1.median)} | ${sg(p.T1.p95)} | ${sg(p.T1.min)} / ${sg(p.T1.max)} |`);
  L.push('', '## By year (net R a trade, n)', '', '| Year | Base | T1 | T2 | Against |', '|---|---|---|---|---|');
  for (const y of Object.keys(T.base.all.byYear)) L.push(`| ${y} | ` + ['base', 'T1', 'T2', 'against'].map((k) => { const b = T[k].all.byYear[y]; return b ? `${sg(b.netR)} (${b.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '', `- ${R.data}`, `- Base rule: ${R.rule}`, `- H4 state: ${R.state}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce, 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys (no trade crosses the 22:00 UTC rollover: 0).`);
  L.push('- To repeat: `node research/edge/gold-vol-breakout-h4-side/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy, kept out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))));
  const g = O.summary(baseTrades(days, GATE.win).tr), gate = { got: { n: g.n, netR: g.netR, grossR: g.grossR, t: g.t }, ok: g.n === GATE.n && g.netR === GATE.netR && g.grossR === GATE.grossR && g.t === GATE.t };
  console.log('gate', gate.ok, JSON.stringify(gate.got));
  if (!gate.ok) { console.log('harness gate failed: stop'); process.exit(2); }
  const { tr: base, skips } = baseTrades(days, WIN);
  const sets = { base, T1: base.filter(keepT1), T2: base.filter(keepT2), against: base.filter(against), none: base.filter((x) => x.h4 === 0) };
  const res = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, bySplit(v)]));
  const pl = { T1: placebo(base, sets.T1.length), T2: placebo(base, sets.T2.length) }, dec = decide(res, pl);
  const kv = (w) => { const f = (a) => (w === 'all' ? a : a.filter((x) => inW(x.day, HALVES[w]))).map((x) => x.net); return welch(f(sets.T1), f(sets.against)); };
  const keptVsAgainst = { all: kv('all'), H1: kv('H1'), H2: kv('H2') };
  const counts = { base: base.length, bull: base.filter((x) => x.h4 === 1).length, bear: base.filter((x) => x.h4 === -1).length, none: sets.none.length,
    T1: sets.T1.length, T2: sets.T2.length, against: sets.against.length, T1buys: sets.T1.filter((x) => x.side === 1).length, T1sells: sets.T1.filter((x) => x.side === -1).length };
  const daysIn = days.filter((d) => inW(d.day, WIN)), stateShare = { bull: daysIn.filter((d) => d.h4 === 1).length, bear: daysIn.filter((d) => d.h4 === -1).length, none: daysIn.filter((d) => d.h4 === 0).length, days: daysIn.length };
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const T = res, f1 = failed(dec.T1), f2 = failed(dec.T2);
  const reading = (dec.T1.pass ? 'T1 passes every pre-registered check. The base rule\'s windows had all been read before, so this is at most a candidate for a forward paper record, by the owner\'s decision; nothing live changes. '
    : `T1 does not pass (failed: ${f1.join(', ')}). `)
    + `Whole record 2007 → ${WIN[1]}: base ${sg(T.base.all.netR)}R a trade net (n ${T.base.all.n}, month t ${s2(T.base.all.t)}); T1 (H4 side only) ${sg(T.T1.all.netR)}R (n ${T.T1.all.n}, month t ${s2(T.T1.all.t)}, gross ${sg(T.T1.all.grossR)}R, 2x cost ${sg(T.T1.all.net2R)}R); `
    + `T2 (side or none) ${sg(T.T2.all.netR)}R (n ${T.T2.all.n}, t ${s2(T.T2.all.t)})${dec.T2.pass ? ', passes' : `, fails (${f2.join(', ')})`}; against-side trades ${sg(T.against.all.netR)}R (n ${T.against.all.n}, t ${s2(T.against.all.t)}). `
    + `By half, T1 against the base: 2007-16 ${sg(T.T1.H1.netR)}R vs ${sg(T.base.H1.netR)}R, 2017-26 ${sg(T.T1.H2.netR)}R vs ${sg(T.base.H2.netR)}R; kept minus against ${sg(keptVsAgainst.H1.diff)}R (Welch t ${s2(keptVsAgainst.H1.t)}) and ${sg(keptVsAgainst.H2.diff)}R (t ${s2(keptVsAgainst.H2.t)}). `
    + (counts.none === 0 ? `The state was never "none": a 20-close H4 break always occurred within 60 H4 candles, so T2 is the same set as T1 (as the pre-registered definition gives). ` : '')
    + `T1 beats ${dec.T1.placeboBeaten} of 40 random subsets of the same size (median ${sg(r3(O.quantile(pl.T1, 0.5)))}R). `
    + (dec.T1.pass ? '' : 'The H4 trend side does not improve the breakout measurably and repeatably; the base rule stays as it is, nothing live changes and no proposal is written.');
  const result = { study: 'gold-vol-breakout-h4-side', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-h4-side/PREREGISTRATION.md', planSha256: sha,
    original: { study: 'gold-vol-breakout', runSha256: ORIG_SHA, how: 'run.mjs copied verbatim as original.mjs (from branch gold-vol-breakout-replicate); its functions imported, none changed' },
    claim: 'taking the gold volatility breakout only on the side of the H4 trend (owner\'s market-cycle idea) improves it',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out at the 20:55 candle close',
    state: 'H4 candles from M5 on 4-hour blocks aligned to 17:00 New York (council/histdata.mjs nyOffsetH), blocks of 12+ M5 candles, only those ended by 00:00 UTC; bullish / bearish = direction of the latest close beyond the 20 prior H4 closes\' high / low, none if no such break in the last 60 H4 candles',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} weekdays built ${days[0].day} → ${days.at(-1).day}; D1 = complete UTC days folded with council/fills.mjs foldWeekend`,
    dataEnd, cost: O.COST, window: WIN, halves: HALVES, verdict: verdictLine(res, dec), decision: dec, gate, tests: res, skips, counts, stateShare, keptVsAgainst,
    placebo: Object.fromEntries(Object.entries(pl).map(([k, v]) => [k, { seeds: O.SEEDS, size: sets[k].length, means: v, min: Math.min(...v), max: Math.max(...v), median: r3(O.quantile(v, 0.5)), p95: r3(O.quantile(v, 0.95)) }])),
    reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  console.log(JSON.stringify({ counts, stateShare, keptVsAgainst }));
  for (const k of Object.keys(res)) console.log(k, ['all', 'H1', 'H2'].map((w) => `${w} n${res[k][w].n} net${res[k][w].netR} g${res[k][w].grossR} 2x${res[k][w].net2R} t${res[k][w].t}`).join(' | '));
}
