// Build result.json (the shared edge-research schema) from detail.json written by portfolio.mjs.
// Usage: node research/edge/portfolio/build-result.mjs [dir=research/edge/portfolio]
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2] || 'research/edge/portfolio';
const d = JSON.parse(fs.readFileSync(path.join(DIR, 'detail.json'), 'utf8'));
const S = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t, sharpe: s.sharpe, rdd: s.rdd });
const C = d.caps.council, I = d.caps.ict, find = (A, f) => A.find(f);
const ictBest = I.bestIS, ictB = I.base;
const out = {
  topic: 'portfolio',
  system: 'MERIDIAN council live sleeve (Scalp against D1, not Asia, no AUD/USD + gold M30->M1 against D1; 150-day engine replay backtest-150d-m30.json, Jun-Nov 2026) and ICT desk A-setups (ict-filters driver on HistData NQ/ES/GC 2018-Oct 2026; CNBC replay Aug 2025-Nov 2026 as a second check)',
  baseline: {
    rule: 'live caps: council 2 trades per market (never both sides), dollar cap 2, Scalp re-entry wait 3 h; ICT one open A-setup per market; fixed 1R per trade',
    council: { is: S(C.base.is), oos: S(C.base.oos), split: d.inputs.councilSplit },
    ict: { is: S(ictB.is), oos: S(ictB.oos), years: ictB.years },
    gross: d.gross,
  },
  candidates: [
    { rule: `council caps chosen in-sample from 80 combinations: ${JSON.stringify(C.bestIS.cap)} (pm = trades per market, usd = dollar cap, re = re-entry hours)`, is: S(C.bestIS.is), oos: S(C.bestIS.oos), years: null,
      verdict: 'FAIL: same OOS daily Sharpe as the live caps (1.56 vs 1.56), less R (+23.9 vs +31.9), lower DD (32.8 vs 62.6). Not a clear improvement; 80 variants on 150 days.' },
    ...['usd', 'pm', 're'].map((k) => ({ rule: `council one knob at a time around live (${k})`, is: null, oos: null,
      grid: C.oneKnob[k].map((g) => ({ cap: g.cap, is: S(g.is), oos: S(g.oos) })),
      verdict: k === 'usd' ? 'live dollar cap 2 is the best setting in-sample AND out-of-sample (keep)' : k === 're' ? 'live 3 h re-entry wait is the in-sample best (keep); 0 h is worse in both halves' : 'per-market cap 2 vs 3/unlimited: small gain in both halves (IS Sharpe -0.12 -> 0.51, OOS 1.56 -> 1.67) - within noise; keep 2' })),
    { rule: 'council uncapped (for reference)', is: S(C.uncapped.is), oos: S(C.uncapped.oos), verdict: 'caps are worth keeping: uncapped is worse in both halves (OOS Sharpe 1.03 vs 1.56, DD 91.7 vs 62.6)' },
    { rule: `ICT caps chosen in-sample (2018-23): ${JSON.stringify(ictBest.cap)} (idx = same-direction open trades across the index futures)`, is: S(ictBest.is), oos: S(ictBest.oos), years: ictBest.years,
      cnbcCheck: d.cnbcCap,
      verdict: 'INCONCLUSIVE: passes on HistData OOS 2024-26 (+0.149 vs +0.125 R/trade, DD 12.6 vs 16.0, 3/3 years positive) but FAILS on the desk CNBC replay with 4 indices (Sharpe 1.73 -> 1.14, R +63 -> +33). Not proposed.' },
    ...Object.entries(d.sizing.ict).map(([k, v]) => ({ rule: `ICT sizing: ${k}`, is: S(v.is), oos: S(v.oos), verdict: k === 'ictSizeOf' ? 'live sizeOf is the best scheme without look-ahead in-sample and OOS (keep)' : k === 'fixed' ? 'baseline' : 'no OOS improvement over fixed / sizeOf' })),
    ...Object.entries(d.sizing.council).map(([k, v]) => ({ rule: `council sizing: ${k}`, is: S(v.is), oos: S(v.oos),
      verdict: k.startsWith('kellyRolling') ? 'INCONCLUSIVE: best in-sample and OOS (OOS Sharpe 2.2 vs 1.56, +53 vs +32R) but only 51 OOS days, one year, and it is mostly a market tilt (gold up, FX/crypto down). Paper-track, do not adopt yet.' : k === 'fixed' ? 'baseline' : k === 'kellyIS' ? 'equals fixed: in-sample pooled Kelly <= 0, nothing to tilt' : 'no improvement' })),
  ],
  monteCarlo: { method: '10,000 paths, 5-day block bootstrap of calendar days, 365-day horizon; i.i.d. trade bootstrap for contrast', results: d.mc, combinedIndependent: d.combined, riskPerTradeFor20pctP95DD: d.riskFor20pct, kellyFraction: d.kellyFraction },
  correlation: { window: d.corr.window, systems: d.corr.systems, avgPairwise: d.corr.avgPairwise, ictLongRun: d.corr.ictLongRun, usdCluster: d.usdCluster },
  variantsTried: 80 + 6 + 5 + 6 + 5 + 17,
  notes: [
    'No candidate PASSES. Recommended: keep the live caps (dollar cap 2, 2 per market, 3 h re-entry) and ICT sizeOf; set risk per R by system so the 95th-percentile one-year drawdown is ~20% of equity: ICT ~0.75% per 1R, council sleeve ~0.1% per trade (or council R = 0.05 of an ICT R in one book).',
    'Expected one-year max DD at 95%: ICT A-setups 26.3R (OOS days) / 29.9R (2018-26 days); council sleeve at 1R per trade 205R (it takes ~2,500 trades a year); ICT + council at 0.05x: 23.3R.',
    'Council stream is 150 days of one regime, forex D1 labels from Kraken (the live trader uses OANDA labels since 7 Nov); the forex Scalp-against sleeve loses in this file in both halves while the 30-day OANDA-labelled backtest.json shows it positive.',
    'Gold-systems (#merged) published stats only, no trade lists, so the gold replica / Mosha / gold trend books are not in the correlation or Monte Carlo.',
  ],
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(out, null, 1));
console.log('wrote result.json, variantsTried', out.variantsTried);
