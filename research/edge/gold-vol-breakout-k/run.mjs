// Edge research · gold-vol-breakout-k: parameter stability around the gold-vol-breakout T1 rule (UTC open ± k × the previous
// folded day's range, stop back at the open, out at 21:00 UTC), as fixed in PREREGISTRATION.md. A robustness reading only: it
// never picks a new k, exit or anchor. Every trading function comes from original.mjs, a verbatim copy of the original study's
// run.mjs (commit 72009ebe); this file only changes the rule's parameters (k, the candles handed over), runs the gate, the
// sweeps, the placebo and the Holm table, and writes the report.
//   node research/edge/gold-vol-breakout-k/run.mjs <dir>
//     <dir>/xau-5m.json.gz   OANDA mid M5 rows [t,o,h,l,c] 2006-11 → (the replicate study's cache, out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const KS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0];
export const CORE_KS = [0.3, 0.4, 0.5, 0.6, 0.7];
export const EXITS = { '16:00': 16 * 3600, '18:00': 18 * 3600, '21:00': 21 * 3600, '24:00': 24 * 3600 };
export const RULE = { k: 0.5, exit: '21:00', anchor: '00:00 UTC' };
export const HOLD_S = 21 * 3600, OPEN_WIN = 3600, MIN_BARS = 200;
// the replicate's published T1 main, 2007-2015 (result.json of commit 3360a2cf)
export const GATE = { n: 1657, netR: 0.111, grossR: 0.203, net2R: 0.018, t: 3.19, grossT: 5.96 };
export const GATE_WIN = ['2007-01-01', '2015-12-31'];
const DAY = 86400, H = 3600;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const windowsOf = (end) => ({ '2007-11': ['2007-01-01', '2011-12-31'], '2012-15': ['2012-01-01', '2015-12-31'], '2016-20': ['2016-01-01', '2020-12-31'], '2021-26': ['2021-01-01', end], pooled: ['2007-01-01', end] });

// the original's loader: sort, drop the forming last day, folded UTC days; plus every UTC day's full candles (for other exits)
export function load(rows) {
  rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, keep = rows.filter((r) => r[0] < lastFull);
  const full = new Map();
  for (const r of keep) { const d0 = Math.floor(r[0] / DAY) * DAY; if (!full.has(d0)) full.set(d0, []); full.get(d0).push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }); }
  return { days: O.buildDays(keep), full, rows: keep, dataEnd: ymdOf(lastFull - DAY) };
}

// the candles a day hands to the rule for an exit at exitS seconds after 00:00 UTC (21:00 = the original's own bars)
export function barsFor(d, full, exitS) {
  if (exitS === O.EXIT_S) return d.bars;
  return (full.get(d.d0) || []).filter((b) => b.t - d.d0 < exitS);
}

// T1 with parameters: k, exit; eligible days are the original's (daySkip on its 00:00-20:55 candles)
export function trades(days, full, w, { k = 0.5, exitS = O.EXIT_S } = {}) {
  const tr = [], pool = [];
  for (const d of days) {
    if (!inW(d.day, w) || O.daySkip(d)) continue;
    pool.push(d);
    const x = O.vbTrade(barsFor(d, full, exitS), { k, sides: 'both', prevRange: d.prevRange });
    if (!x.skip) tr.push({ day: d.day, ...x });
  }
  return { tr, pool };
}

// ─── 17:00 New York trading days ───
// key = the New York date the day closes on; Saturday / Sunday keys fold into Monday; anchor = 17:00 New York the evening before
export function nyKey(t) {
  const local = t - nyOffsetH(t) * H;
  let key = Math.floor((local + 7 * H) / DAY) * DAY;
  const wd = new Date(key * 1000).getUTCDay();
  if (wd === 6) key += 2 * DAY; else if (wd === 0) key += DAY;
  return key;
}
export function anchorOf(key) {
  const local = key - 7 * H;                                       // 17:00 New York wall clock the evening before, as a UTC-labelled stamp
  return local + nyOffsetH(local + 5 * H) * H;
}
export function buildNyDays(rows) {
  const by = new Map();
  for (const r of rows) { const k = nyKey(r[0]); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const keys = [...by.keys()].sort((a, b) => a - b), days = [];
  keys.forEach((key, i) => {
    const rs = by.get(key), A = anchorOf(key);
    const bars = rs.filter((r) => r[0] >= A && r[0] < A + HOLD_S).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
    const prev = i > 0 ? by.get(keys[i - 1]) : null;
    days.push({ day: ymdOf(key), d0: A, bars, prevRange: prev ? Math.max(...prev.map((r) => r[2])) - Math.min(...prev.map((r) => r[3])) : null,
      high: Math.max(...rs.map((r) => r[2])), low: Math.min(...rs.map((r) => r[3])) });
  });
  return days;
}
// The market's daily break is 17:00-18:00 New York, so the first candle of a 17:00 New York day starts exactly 60 minutes after
// the anchor on most days since 2015. The original's daySkip counts an open at +60 min as "no open" (strict < 1 h). The
// pre-registered "within 1 hour" is read as inclusive (<= 60 min, `inclusive`, the main figure); the strict reading is reported too.
export function nySkip(d, inclusive = true) {
  if (d.prevRange == null) return 'noprev';
  if (!(d.prevRange > 0)) return 'flatprev';
  if (!d.bars.length || d.bars[0].t - d.d0 > OPEN_WIN || (!inclusive && d.bars[0].t - d.d0 >= OPEN_WIN)) return 'noopen';
  if (d.bars.length < MIN_BARS) return 'thin';
  return null;
}
export function nyTrades(nyDays, w, k = 0.5, inclusive = true) {
  const tr = [];
  for (const d of nyDays) {
    if (!inW(d.day, w) || nySkip(d, inclusive)) continue;       // prev day, open within 1 h of the anchor, 200 candles
    const x = O.vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange });
    if (!x.skip) tr.push({ day: d.day, ...x });
  }
  return tr;
}

// ─── statistics ───
export const cell = (tr) => { const s = O.summary(tr); return { n: s.n, win: s.win, netR: s.netR, grossR: s.grossR, net2R: s.net2R, t: s.t, grossT: s.grossT, t2x: s.t2x, finR: s.finR, stops: s.stops, time: s.time, medianStop: s.medianStop, maxDD: s.maxDD, total: s.total }; };
export function byWindow(tr, W) { const out = {}; for (const [k, w] of Object.entries(W)) out[k] = cell(tr.filter((x) => inW(x.day, w))); return out; }
export function placeboK(pool, k, seeds = O.SEEDS) {
  const grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
      const x = O.placeboTrade(d.bars, { startT, side, dist: k * d.prevRange }); if (x) tr.push(x);
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}
// the pre-registered reading: broad = pooled net > 0 at >= 6 of 8 k AND pooled gross t >= 2 at every k in 0.3-0.7
export function reading(kRows) {
  const pos = KS.filter((k) => kRows[k].pooled.netR > 0).length;
  const core = CORE_KS.map((k) => ({ k, grossT: kRows[k].pooled.grossT })), coreOk = core.every((c) => c.grossT >= 2);
  return { netPositiveK: pos, netNeed: 6, coreGrossT: core, minCoreGrossT: Math.min(...core.map((c) => c.grossT)), coreOk, broad: pos >= 6 && coreOk, label: pos >= 6 && coreOk ? 'broad' : 'narrow' };
}
export function holmTable(rows) {
  const ps = rows.map((r) => O.normP(r.t)), adj = O.holm(ps);
  return rows.map((r, i) => ({ ...r, p: r3(ps[i]), pHolm: r3(adj[i]) }));
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(rd, kRows) {
  const p = kRows['0.5'].pooled;
  return `${rd.label.toUpperCase()}: pooled 2007-26 net R positive at ${rd.netPositiveK} of 8 k values, gross month t ${rd.coreOk ? '≥ 2' : 'not ≥ 2'} across k 0.3-0.7 (lowest ${s2(rd.minCoreGrossT)}); k 0.5 ${sg(p.netR)}R net (n ${p.n}, t ${s2(p.t)}); k stays 0.5`;
}
export function report(R) {
  const L = [], WK = Object.keys(R.windows), yn = (b) => (b ? 'yes' : 'no');
  const tbl = (lab, rows) => {
    L.push(`| ${lab} | Window | n | Net R | Gross R | Net 2x | Month t | Gross t | Win | Stops / time | Median stop $ |`, '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [name, wr] of rows) for (const w of WK) { const x = wr[w]; L.push(`| ${name} | ${w} | ${x.n} | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.net2R)} | ${s2(x.t)} | ${s2(x.grossT)} | ${(x.win * 100).toFixed(1)} % | ${x.stops} / ${x.time} | ${x.medianStop} |`); }
  };
  L.push('# Gold: the intraday volatility breakout, is k = 0.5 a lucky peak?', '');
  L.push('Paper research only. A parameter-stability reading of the `gold-vol-breakout` T1 rule (a stand-alone intraday rule; not a gate, exit, entry or size of the live gold book, none of whose records were read). **It does not choose a new k**: the tested rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC; any other setting would need its own pre-registration on data none of these studies has read, and little is left. Nothing live changed, no proposal. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the rule\'s functions come from `original.mjs`, a verbatim copy of the original study\'s `run.mjs`. This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## Harness gate', '', `k 0.5 on 2007-01-01 → 2015-12-31 against the replicate study's published result: n ${R.gate.got.n} (${R.gate.want.n}), net ${sg(R.gate.got.netR)} (${sg(R.gate.want.netR)}), gross ${sg(R.gate.got.grossR)} (${sg(R.gate.want.grossR)}), 2x ${sg(R.gate.got.net2R)} (${sg(R.gate.want.net2R)}), month t ${s2(R.gate.got.t)} (${s2(R.gate.want.t)}), gross t ${s2(R.gate.got.grossT)} (${s2(R.gate.want.grossT)}): exact ${yn(R.gate.ok)}. The exit code at 21:00 hands over the rule's own candles: ${R.gate.exitSame} of ${R.gate.exitOf} trades identical.`, '');
  L.push('## Heat table: net R a trade (month t), k × window', '', '| k | ' + WK.join(' | ') + ' |', '|---|' + WK.map(() => '---|').join(''));
  for (const k of KS) L.push(`| ${k === RULE.k ? `**${k}** (rule)` : k} | ` + WK.map((w) => { const x = R.k[k][w]; return `${sg(x.netR)} (${s2(x.t)})`; }).join(' | ') + ' |');
  L.push('', 'Gross R a trade (gross month t):', '', '| k | ' + WK.join(' | ') + ' |', '|---|' + WK.map(() => '---|').join(''));
  for (const k of KS) L.push(`| ${k} | ` + WK.map((w) => { const x = R.k[k][w]; return `${sg(x.grossR)} (${s2(x.grossT)})`; }).join(' | ') + ' |');
  L.push('', '## Stability reading (pre-registered, pooled window)', '');
  const rd = R.reading;
  L.push('| k values with net R > 0 (need 6 of 8) | Gross month t at k 0.3 / 0.4 / 0.5 / 0.6 / 0.7 (need all ≥ 2) | Reading |', '|---|---|---|');
  L.push(`| ${rd.netPositiveK} | ${rd.coreGrossT.map((c) => s2(c.grossT)).join(' / ')} | **${rd.label}** |`);
  L.push('', '## 1. k sweep, every window', ''); tbl('k', KS.map((k) => [String(k), R.k[k]]));
  L.push('', '### Placebo per k (pooled, 40 seeds)', '', 'Every eligible day, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop k × the previous day\'s range away, out at 21:00 UTC or the stop, the same costs.', '');
  L.push('| k | Real net R | Placebo median | Placebo 95th pct | Seeds beaten (of 40) |', '|---|---|---|---|---|');
  for (const k of KS) { const p = R.placebo[k]; L.push(`| ${k} | ${sg(R.k[k].pooled.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${p.beaten} |`); }
  L.push('', '## 2. Exit time at k 0.5', '', 'Orders and hold end at the exit. Exits past the 22:00 UTC rollover pay financing on buys (column "Fin R" in the pooled line below).', '');
  tbl('Exit (UTC)', Object.keys(EXITS).map((e) => [e === RULE.exit ? `${e} (rule)` : e, R.exit[e]]));
  L.push('', Object.keys(EXITS).map((e) => `${e}: financing ${sg(R.exit[e].pooled.finR)}R a trade pooled`).join('; ') + '.');
  L.push('', '## 3. Day anchored at 17:00 New York (k 0.5, 21-hour hold)', ''); L.push(R.anchorNote, ''); tbl('Anchor', [['00:00 UTC (rule)', R.k['0.5']], ['17:00 New York', R.anchor], ['17:00 NY, strict < 60 min open', R.anchorStrict]]);
  L.push('', '## Every configuration, pooled, Holm over 12 (descriptive)', '', '| Configuration | n | Net R | Month t | p (one-sided) | Holm p |', '|---|---|---|---|---|---|');
  for (const h of R.holm) L.push(`| ${h.name} | ${h.n} | ${sg(h.netR)} | ${s2(h.t)} | ${h.p < 0.001 ? '< 0.001' : h.p} | ${h.pHolm < 0.001 ? '< 0.001' : h.pHolm} |`);
  L.push('', '## Reading', '', R.text, '');
  L.push('## Data and method', '', `- ${R.data}`, `- Rule: ${R.rule}`, `- Costs: $${R.cost.toFixed(2)} a round trip per ounce, 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys held over 22:00 UTC.`);
  L.push('- To repeat: `node research/edge/gold-vol-breakout-k/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy; out of git).');
  return L.join('\n') + '\n';
}

// ─── main ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const osha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (osha !== ORIG_SHA) throw new Error('original.mjs is not the verbatim copy');
  const { days, full, rows, dataEnd } = load(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))));
  // gate
  const g = cell(trades(days, full, GATE_WIN).tr), gOk = Object.keys(GATE).every((k) => g[k] === GATE[k]);
  const base = trades(days, full, GATE_WIN).tr, alt = trades(days, full, GATE_WIN, { exitS: 21 * 3600 - 1 }).tr;   // 20:59:59 forces the full-day path
  const same = base.filter((x, i) => alt[i] && JSON.stringify(x) === JSON.stringify(alt[i])).length;
  console.log('gate', gOk, JSON.stringify(g), 'exit path', same, '/', base.length, alt.length);
  if (!gOk || same !== base.length || alt.length !== base.length) { console.log('harness gate failed: stop'); process.exit(2); }
  const W = windowsOf(dataEnd), P = W.pooled, kRows = {}, placebo = {}, holmRows = [];
  for (const k of KS) {
    const { tr, pool } = trades(days, full, P, { k }); kRows[k] = byWindow(tr, W);
    const pl = placeboK(pool, k); placebo[k] = { means: pl, median: r3(O.quantile(pl, 0.5)), p95: r3(O.quantile(pl, 0.95)), beaten: pl.filter((v) => kRows[k].pooled.netR > v).length };
    holmRows.push({ name: `k ${k}, exit 21:00`, n: kRows[k].pooled.n, netR: kRows[k].pooled.netR, t: kRows[k].pooled.t });
    console.log('k', k, JSON.stringify(kRows[k].pooled), placebo[k].beaten);
  }
  const exit = {};
  for (const [e, s] of Object.entries(EXITS)) {
    exit[e] = byWindow(trades(days, full, P, { exitS: s }).tr, W);
    if (e !== '21:00') holmRows.push({ name: `k 0.5, exit ${e}`, n: exit[e].pooled.n, netR: exit[e].pooled.netR, t: exit[e].pooled.t });
    console.log('exit', e, JSON.stringify(exit[e].pooled));
  }
  const nyDays = buildNyDays(rows), anchor = byWindow(nyTrades(nyDays, P), W), anchorStrict = byWindow(nyTrades(nyDays, P, 0.5, false), W);
  holmRows.push({ name: 'k 0.5, day from 17:00 New York', n: anchor.pooled.n, netR: anchor.pooled.netR, t: anchor.pooled.t });
  console.log('anchor', JSON.stringify(anchor.pooled));
  const rd = reading(kRows), holm = holmTable(holmRows), verdict = verdictLine(rd, kRows);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const best = KS.reduce((a, k) => (kRows[k].pooled.netR > kRows[a].pooled.netR ? k : a), KS[0]);
  const exBest = Object.keys(EXITS).reduce((a, e) => (exit[e].pooled.netR > exit[a].pooled.netR ? e : a), '21:00');
  const wNeg = (rowsK) => Object.keys(W).filter((w) => w !== 'pooled' && rowsK[w].netR <= 0);
  const text = `The effect around k 0.5 reads **${rd.label}** by the pre-registered test: pooled 2007 → ${dataEnd}, net R a trade is positive at ${rd.netPositiveK} of 8 k values and the gross month t at k 0.3-0.7 is ${rd.coreGrossT.map((c) => `${c.k}: ${s2(c.grossT)}`).join(', ')}. `
    + `Net R a trade by k (pooled): ${KS.map((k) => `${k} ${sg(kRows[k].pooled.netR)}`).join(', ')}; the highest is at k ${best}. `
    + `Before costs every k is ${KS.every((k) => kRows[k].pooled.grossR > 0) ? 'positive' : 'not positive everywhere'} (gross R ${KS.map((k) => sg(kRows[k].pooled.grossR)).join(' / ')}); costs take more R as k falls because the stop (the distance from the open to the entry) is shorter. `
    + `At k 0.5 the windows with net R ≤ 0 are: ${wNeg(kRows['0.5']).join(', ') || 'none'}. `
    + `Exit time at k 0.5, pooled net: ${Object.keys(EXITS).map((e) => `${e} ${sg(exit[e].pooled.netR)} (t ${s2(exit[e].pooled.t)})`).join(', ')}; the 17:00 New York day: ${sg(anchor.pooled.netR)}R (n ${anchor.pooled.n}, t ${s2(anchor.pooled.t)}). `
    + `None of this selects a setting: ${best !== 0.5 || exBest !== '21:00' ? `the best-looking cells (k ${best}, exit ${exBest}) were found by searching these very data and would need their own pre-registration on untouched history, which barely exists. ` : 'the rule\'s own setting is also the best-looking one here; that says nothing either way, since every window has been read at k 0.5 before. '}`
    + `Cautions, said plainly: at 2x costs the pooled net R a trade is ${KS.map((k) => `${k} ${sg(kRows[k].pooled.net2R)}`).join(', ')}, so the margin over costs is thin at every k; 2016-20 is the weak window at every k (net ${KS.map((k) => sg(kRows[k]['2016-20'].netR)).join(' / ')}); and the 17:00 New York day keeps the gross effect (gross ${sg(anchor.pooled.grossR)}R, t ${s2(anchor.pooled.grossT)}) but loses most of the net (${sg(anchor.pooled.netR)}R, t ${s2(anchor.pooled.t)}; strict reading of its open ${sg(anchorStrict.pooled.netR)}R, n ${anchorStrict.pooled.n}), so the result leans on where the day is cut. `
    + 'Every window here has been read at k 0.5 before; Holm p over the 12 configurations is shown for reference only. Paper research; the tested rule stays k 0.5, exit 21:00 UTC; nothing live changes and no proposal is written.';
  const result = { study: 'gold-vol-breakout-k', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-k/PREREGISTRATION.md', planSha256: sha,
    original: { study: 'gold-vol-breakout', commit: '72009ebe62c4aa56ff7d4ea8a621fbe64a643e3e', runSha256: ORIG_SHA, how: 'run.mjs copied verbatim as original.mjs (as in gold-vol-breakout-replicate); its functions imported, none changed' },
    claim: 'whether the gold-vol-breakout T1 effect holds across nearby k, exit and day-anchor settings (a robustness reading; no setting is chosen)',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + k × prevRange and sell stop O − k × prevRange on the candles up to the exit, first filled wins; stop back at O; out at the close of the candle ending at the exit. Tested rule: k 0.5, exit 21:00 UTC',
    data: `OANDA mid XAU/USD M5 through the keyless candle proxy; ${days.length} UTC weekdays built ${days[0].day} → ${days.at(-1).day}, ${nyDays.length} New York trading days`,
    dataEnd, cost: O.COST, ks: KS, exits: Object.keys(EXITS), windows: W, rule0: RULE,
    verdict, reading: rd, gate: { want: GATE, got: g, ok: gOk, exitSame: same, exitOf: base.length },
    k: kRows, placebo, exit, anchor, anchorStrict, anchorNote: 'The daily break is 17:00-18:00 New York, so the first candle of a 17:00 New York day starts at +60 min on most days from 2015; the pre-registered "within 1 hour" is read as inclusive (main figure). Deviation from the strict daySkip (< 60 min), which keeps almost no day after 2015; both shown.', holm, text };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(verdict, verdict.length);
}
