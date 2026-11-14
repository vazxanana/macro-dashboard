// Edge research · rsi2-early-years (PREREGISTRATION.md, committed first).
// The 2-day RSI pullback (frozen.mjs = the original rsi2-pullback run.mjs, byte for byte) on SPX500 / NAS100 / US30 in the
// years before the original's 2008 start. The pre-registration fixes a 5-year floor for the replication window; OANDA's
// daily history starts 2003-03-24, so after the 200-day warm-up only 2004-01 to 2007-12 (4.0 years) exists. This file
// runs the gate (the original reproduced) and the date inventory, then stops: NO return of 2004-07 is computed.
//   node run.mjs fetch <dir>   copies the daily candles + macro/cache.json out of council-data (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { P, MARKETS, WINDOWS, candles, study } from './frozen.mjs';

export const FLOOR_YEARS = 5.0;                 // pre-registered minimum entry window per market
export const EARLY_END = '2007-12-31';          // the day before the original's first window
export const FROZEN = { branch: 'rsi2-pullback', commit: '4e1b4e1dd', file: 'research/edge/rsi2-pullback/run.mjs',
  sha256: 'edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65' };
// The original's published figures (origin/rsi2-pullback research/edge/rsi2-pullback/result.json, built 2026-11-13).
// A: [n, avgRet, avgR, totalR, tTrades, tMonths]; B: the same + [placebo p95, p]; holm = Holm-adjusted p.
export const ORIGINAL = {
  verdict: 'FAIL',
  spx500: { A: [67, 0.559, 0.134, 8.95, 3.15, 3.23], B: [99, 0.318, 0.112, 11.14, 2.02, 1.83, 0.233, 0.0217], holm: 0.0651 },
  nas100: { A: [75, 0.444, 0.104, 7.82, 2.02, 1.97], B: [99, 0.292, 0.061, 6.03, 1.24, 1.29, 0.477, 0.1073], holm: 0.1073 },
  us30: { A: [67, 0.228, 0.052, 3.45, 1.22, 1.39], B: [102, 0.288, 0.087, 8.82, 1.88, 2.28, 0.175, 0.0301], holm: 0.0651 },
};
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r2 = (v) => +v.toFixed(2);

// ── gate: the frozen study must give the original's published figures exactly ──
export function gate(data, rates) {
  const r = study(data, rates), rows = [];
  let ok = r.verdict === ORIGINAL.verdict;
  for (const k of Object.keys(MARKETS)) {
    const m = r.markets[k], o = ORIGINAL[k];
    const A = [m.A.n, m.A.avgRet, m.A.avgR, m.A.totalR, m.A.tTrades, m.A.tMonths];
    const B = [m.B.n, m.B.avgRet, m.B.avgR, m.B.totalR, m.B.tTrades, m.B.tMonths, m.B.placebo.p95, m.B.p];
    const same = JSON.stringify(A) === JSON.stringify(o.A) && JSON.stringify(B) === JSON.stringify(o.B) && m.holmP === o.holm;
    ok = ok && same;
    rows.push({ market: k, same, A, B, holmP: m.holmP, published: o });
  }
  return { pass: ok, verdict: r.verdict, rows };
}

// ── date inventory: candle times only (no price is read) ──
export function inventory(rows, end = EARLY_END) {
  const D = candles(rows), endT = T(end) + DAY - 1;
  if (D.length <= P.SMA_LONG) return { first: D.length ? ymd(D[0].time) : null, firstSignal: null, years: 0, gapsOver4d: 0, weekdaysToEnd: D.length };
  const firstSignal = D[P.SMA_LONG].time;     // the frozen simulate() starts its loop at index SMA_LONG
  let gaps = 0, n = 0;
  for (let i = 0; i < D.length && D[i].time <= endT; i++) { n++; if (i && (D[i].time - D[i - 1].time) / DAY > 4) gaps++; }
  const years = firstSignal > endT ? 0 : (endT + 1 - firstSignal) / DAY / 365.25;
  return { first: ymd(D[0].time), firstSignal: ymd(firstSignal), years: r2(years), gapsOver4d: gaps, weekdaysToEnd: n };
}
export function measurable(inv) {
  const short = Object.entries(inv).filter(([, v]) => !(v.years >= FLOOR_YEARS)).map(([k]) => k);
  return { floorYears: FLOOR_YEARS, ok: short.length === 0, short };
}
export function verdict(meas, inv, rates) {
  if (meas.ok) return { verdict: 'REPLICATES or DOES NOT REPLICATE: not decided by this file', text: null };
  const yrs = Math.max(...Object.values(inv).map((v) => v.years));
  const rateFrom = rates && rates.length ? rates[0][0] : null;
  return {
    verdict: 'NOT MEASURABLE',
    text: `NOT MEASURABLE (inconclusive: OANDA daily candles start 2003-03-24, so after the 200-day warm-up only ${yrs.toFixed(2)} years of entries exist before 2008, under the pre-registered ${FLOOR_YEARS}-year floor; the financing benchmark starts ${rateFrom}; and 2004-07 lies inside the rule's own development sample)`,
  };
}

// ── CLI ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(2); }
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: HERE, maxBuffer: 1 << 28 });
    for (const k of Object.keys(MARKETS)) fs.writeFileSync(path.join(dir, k + '.json'), show(`research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, 'cache.json'), show('macro/cache.json'));
    console.log('fetched into', dir);
  } else if (mode === 'full') {
    const data = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json')))]));
    const rates = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'))).score.fred.DGS2;
    const g = gate(data, rates);
    const inv = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, inventory(data[k].rows)]));
    const meas = measurable(inv), v = verdict(meas, inv, rates);
    const out = {
      built: '2026-11-14', title: 'The 2-day RSI pullback on US index CFDs, the years before the original study',
      verdict: v.verdict, verdictText: v.text,
      system: 'frozen: the rsi2-pullback rule and cost model, unchanged (frozen.mjs)', frozen: FROZEN,
      src: 'OANDA mid daily candles, council-data research/daily/<key>.json (first candle 2003-03-24; the candle proxy serves nothing earlier); DGS2 from council-data macro/cache.json',
      original: { windows: WINDOWS, params: P },
      gate: g,
      replicationWindow: { from: 'first signal day', to: EARLY_END, floorYears: FLOOR_YEARS, inventory: inv, measurable: meas,
        financingFrom: rates[0][0], rulePublishedOnDataTo: 2008 },
      notComputed: ['2004-07 trades and returns', 'pooled and per-market tests', 'demo-broker cost run', 'placebo', 'Fisher combination with #838'],
      fisher: { computed: false, why: 'no replication p exists; the ledger entry "none on other years" stands', original: { id: '#838 rsi2-pullback: spx500', p: ORIGINAL.spx500.B[7] } },
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ gate: g.pass, inv, meas, verdict: v.text }, null, 1));
  }
}
