// Multiple testing, update of the 13-14 Nov count (#904) with the studies pushed since (PREREGISTRATION.md, pushed alone first).
//   node research/edge/multiple-testing-update/run.mjs collect   reads each study's result.json from its own branch
//                                                                 (`git show origin/<branch>:…`, fetch first) and #904's
//                                                                 inputs.json, writes collected.json (the fixed snapshot)
//   node research/edge/multiple-testing-update/run.mjs           reads collected.json only (offline), writes result.json, RESULT.md
// Paper research only. No market data is fetched, no study is re-run, no stored figure is changed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- pure statistics (the same functions as #904's run.mjs, copied: nothing is imported across branches) ----------
export function erfc(x) {
  const z = Math.abs(x); const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
export const pOneSided = (t) => 1 - Phi(t);
export function PhiInv(p) {
  let lo = -40, hi = 40;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export const tOfP = (p) => (p >= 1 ? -Infinity : p <= 0 ? Infinity : -PhiInv(p));
export function holm(ps) {
  const m = ps.length; const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(m); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); adj[i] = run; });
  return adj;
}
export function bh(ps, c = 1) {
  const m = ps.length; const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(m); let run = 1;
  for (let k = m - 1; k >= 0; k--) { const [p, i] = idx[k]; run = Math.min(run, Math.min(1, (p * m * c) / (k + 1))); q[i] = run; }
  return q;
}
export const by = (ps) => { let c = 0; for (let i = 1; i <= ps.length; i++) c += 1 / i; return bh(ps, c); };
export function chi2SfEven(x, df) {
  if (df % 2) throw new Error('even df only');
  let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; }
  return Math.exp(-x / 2) * sum;
}
export function fisher(ps) { const x = -2 * ps.reduce((a, p) => a + Math.log(p), 0); const df = 2 * ps.length; return { x, df, p: chi2SfEven(x, df) }; }
export function poisson95(mu) {
  let pmf = Math.exp(-mu), cdf = pmf, k = 0, lo = null;
  while (true) { if (lo == null && cdf >= 0.025) lo = k; if (cdf >= 0.975) return [lo, k]; k++; pmf *= mu / k; cdf += pmf; }
}
// One stored test -> { p, t, pFrom }. kind 't': p = 1 - Phi(t). kind 'p': a stored one-sided p. kind 'p2': a stored TWO-sided
// p of a test whose pre-registration named no direction (#919): that p as is. For 'p' and 'p2' the t is the normal equivalent.
export function testP(x) {
  if (x.kind === 't' && typeof x.t === 'number') return { p: pOneSided(x.t), t: x.t, pFrom: 't (normal, one-sided)' };
  if (x.kind === 'p' && typeof x.p === 'number') return { p: x.p, t: tOfP(x.p), pFrom: 'stored one-sided p (t = its normal equivalent)' };
  if (x.kind === 'p2' && typeof x.p === 'number') return { p: x.p, t: tOfP(x.p), pFrom: 'stored two-sided p, no direction pre-registered (t = its one-sided normal equivalent)' };
  return null;
}
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : v);
const r6 = (v) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v);
export function family(tests, alpha = 0.05) {
  const N = tests.length; const ps = tests.map((x) => x.p);
  const h = holm(ps), q = bh(ps), qy = by(ps);
  const share = 1 - Phi(2); const expected = N * share;
  const rows = tests.map((x, i) => ({ ...x, holm: h[i], bh: q[i], by: qy[i] }));
  const sorted = [...rows].sort((a, b) => a.p - b.p);
  return {
    N, alpha,
    bonferroni: { p: alpha / N, t: tOfP(alpha / N) },
    t2: { observed: rows.filter((x) => x.t >= 2).length, expected, range95: poisson95(expected), share, ids: rows.filter((x) => x.t >= 2).map((x) => x.id) },
    tNeg2: { observed: rows.filter((x) => x.t <= -2).length, expected },
    pBelow05: { observed: rows.filter((x) => x.p < 0.05).length, expected: N * 0.05 },
    holmPass: rows.filter((x) => x.holm <= alpha).map((x) => x.id),
    bh05: rows.filter((x) => x.bh <= 0.05).map((x) => x.id),
    bh10: rows.filter((x) => x.bh <= 0.10).map((x) => x.id),
    by10: rows.filter((x) => x.by <= 0.10).map((x) => x.id),
    smallest: sorted.slice(0, 15).map((x) => ({ id: x.id, t: r4(x.t), p: r6(x.p), holm: r4(x.holm), bh: r4(x.bh), by: r4(x.by), n: x.n ?? null, src: x.src })),
    rows,
  };
}

// ---------- what is collected from each new study (role, decisive window, the path of each test's statistic) ----------
// role: family | replication | robustness | excluded (PREREGISTRATION.md "Roles"). kind: t | p | p2 (see testP).
const T = (test, path, kind = 't', extra = {}) => ({ test, path, kind, ...extra });
const ks = (keys, f) => keys.map(f);
export const NEW = [
  { pr: 900, branch: 'index-futures-cost', role: 'excluded', why: 'cost accounting of existing trades, no rule tested' },
  { pr: 901, branch: 'cb-days-other', window: 'decisive 2018 →', what: 'month t per bank, BOE BOC SNB RBA RBNZ (Holm over 5)',
    tests: (j) => j.banks.map((b, i) => T(b.bank || b.id || ['BOE', 'BOC', 'SNB', 'RBA', 'RBNZ'][i], `banks.${i}.monthT`, 't', { nPath: `banks.${i}.n` })) },
  { pr: 902, branch: 'fx-home-hours', window: 'decisive 2016-26', what: 'month t, T1-T4 (Holm over 4; T5 pooled not in Holm)',
    tests: () => ks(['T1', 'T2', 'T3', 'T4'], (k) => T(k, `tests.${k}.dec.t`, 't', { nPath: `tests.${k}.dec.n` })) },
  { pr: 905, branch: 'gold-haven-shock', window: 'decisive', what: 'month t, three tests (Holm over 3)',
    tests: () => [0, 1, 2].map((i) => T(`T${i + 1}`, `tests.${i}.dec.tMonth`, 't', { nPath: `tests.${i}.dec.n` })) },
  { pr: 906, branch: 'bond-fomc-drift', window: 'B 2016 →', what: 'month t, USB10Y and USB30Y (Holm over 2; pooled reported beside)',
    tests: () => ks(['T1', 'T2'], (k) => T(k, `tests.${k}.b.t`, 't', { nPath: `tests.${k}.b.n` })) },
  { pr: 907, branch: 'gold-month-of-year', window: 'decisive', what: 't, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.decisive.${k}.t`)) },
  { pr: 908, branch: 'gotobi-timing', role: 'robustness', of: 878, window: 'same days as #878 T2 (OANDA M1)', what: 'entry-minute grid of the frozen rule; a report, no test',
    report: (j) => ({ verdict: 'the result sits on the 00:55 entry minute', base: { t: 2.74 }, oneMinuteLate: { netR: j.entryGrid.find((r) => r.entry === '00:56').netR, t: j.entryGrid.find((r) => r.entry === '00:56').t }, held: false, src: 'entryGrid' }) },
  { pr: 909, branch: 'vol-managed-index', window: 'decisive', what: 'Jobson-Korkie-Memmel z of the Sharpe gain, three tests (Holm over 3)',
    tests: (j) => j.tests.map((x, i) => T(x.id || `T${i + 1}`, `tests.${i}.zJKM`)) },
  { pr: 910, branch: 'wmr-fix-reversal', window: 'decisive 2016-26', what: 'month t, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.dec.t`, 't', { nPath: `tests.${k}.dec.n` })) },
  { pr: 911, branch: 'index-52w-high', window: 'decisive 2016 →', what: 'month t, three tests (Holm over 3)',
    tests: () => [0, 1, 2].map((i) => T(`T${i + 1}`, `tests.${i}.decisive.t`, 't', { nPath: `tests.${i}.decisive.n` })) },
  { pr: 912, branch: 'gotobi-minute-histdata', role: 'robustness', of: 878, window: 'HistData USD/JPY 2018-26 (same days as #894)', what: 'entry-minute grid on the second feed; a report, no test',
    report: (j) => ({ verdict: j.verdict, clearMax: j.reading.clearMax, lateShare: j.reading.lateShare, held: j.reading.word === 'FEED-CONFIRMED', src: 'reading' }) },
  { pr: 913, branch: 'us-asia-lead', window: 'decisive 2016-26', what: 'month t, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.decisive.t`, 't', { nPath: `tests.${k}.decisive.n` })) },
  { pr: 914, branch: 'index-midday-turn', window: 'decisive', what: 't, T1-T4 (Holm over 4)',
    tests: () => ks(['T1', 'T2', 'T3', 'T4'], (k) => T(k, `tests.${k}.decisive.t`, 't', { nPath: `tests.${k}.decisive.n` })) },
  { pr: 915, branch: 'gotobi-limit-entry', role: 'robustness', of: 878, window: 'same days as #878 T2', what: 'resting limit entries; a report, no test',
    report: (j) => ({ verdict: j.reading, held: false, src: 'reading' }) },
  { pr: 916, branch: 'eu-gap-fade', window: 'decisive 2016 →', what: 'month t, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.decisive.t`, 't', { nPath: `tests.${k}.decisive.n` })) },
  { pr: 917, branch: 'tokyo-fix-daily', window: 'decisive 2016-26', what: 'T1 fix fade on days that are not gotobi days (month t); T2 gotobi minus other days (Welch t); Holm over 2',
    tests: () => [T('T1 other days', 'T1.t', 't', { nPath: 'T1.n' }), T('T2 gotobi vs other', 'T2.t', 't', { nPath: 'T2.other.n' })] },
  { pr: 918, branch: 'fx-december-usd', window: 'decisive', what: 't, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.decisive.t`)) },
  { pr: 919, branch: 'fx-weekday', window: 'decisive', what: 'two-sided p per weekday (Holm over 5)',
    tests: () => [0, 1, 2, 3, 4].map((i) => T(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i], `weekdays.${i}.decisive.p`, 'p2', { nPath: `weekdays.${i}.decisive.n` })) },
  { pr: 920, branch: 'vol-spike-replicate', role: 'replication', of: 860, window: 'R1 seven other indices 2016-26 (Holm with R3); R2 the same 2005-15', what: 'trade t of the frozen 10-day rule',
    tests: () => [T('R1 other indices 2016-26', 'R1.t', 't', { nPath: 'R1.n', cell: 'other indices × 2016-26', inFamily: true }),
      T('R3 by entry week 2016-26', 'R3.t', 't', { nPath: 'R3.n', cell: 'other indices × 2016-26 (weeks)', inFamily: true }),
      T('R2 other indices 2005-15', 'R2.t', 't', { nPath: 'R2.n', cell: 'other indices × 2005-15', inFamily: false })] },
  { pr: 921, branch: 'ecb-ref-fix', window: 'decisive 2016-26', what: 't, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.dec.t`, 't', { nPath: `tests.${k}.dec.n` })) },
  { pr: 922, branch: 'santa-rally', window: 'decisive, 1x costs', what: 't over years, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.x1.decisive.t`, 't', { nPath: `tests.${k}.x1.decisive.n` })) },
  { pr: 923, branch: 'gold-us-asia', window: 'decisive', what: 't, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.decisive.t`, 't', { nPath: `tests.${k}.decisive.n` })) },
  { pr: 924, branch: 'ibs-replicate', role: 'replication', of: 895, window: 'R1 seven other indices 2016 → (Holm with R3); R2 the same 2005-15', what: 'month-sum t of the frozen pooled IBS rule',
    tests: () => [T('R1 other indices 2016 →', 'base.tests.R1.monthT', 't', { nPath: 'base.tests.R1.n', cell: 'other indices × 2016-26', inFamily: true }),
      T('R3 by entry day 2016 →', 'base.tests.R3.t', 't', { nPath: 'base.tests.R3.days', cell: 'other indices × 2016-26 (days)', inFamily: true }),
      T('R2 other indices 2005-15', 'base.tests.R2.monthT', 't', { nPath: 'base.tests.R2.n', cell: 'other indices × 2005-15', inFamily: false })],
    extra: (j) => ({ originalPooled: { t: j.gate.pooled.decisive.monthT, n: j.gate.pooled.decisive.n, path: 'gate.pooled.decisive.monthT (#895 pooled, reproduced exactly)' } }) },
  { pr: 925, branch: 'pre-fomc-gold-usd', window: 'B 2016 →', what: 't, T1 gold long and T2 USD short (Holm over 2)',
    tests: () => ks(['T1', 'T2'], (k) => T(k, `tests.${k}.windows.B.t`, 't', { nPath: `tests.${k}.windows.B.n` })) },
  { pr: 926, branch: 'bond-lead-intraday', window: 'decisive', what: 't, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.windows.decisive.t`, 't', { nPath: `tests.${k}.windows.decisive.n` })) },
  { pr: 927, branch: 'cnh-fix', window: 'decisive 2018-26', what: 'month t, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.dec.t`, 't', { nPath: `tests.${k}.dec.n` })) },
  { pr: 928, branch: 'fx-weekend-gap-replicate', role: 'replication', of: 880, window: 'R1 six crosses 2020 →; R2 #880\'s majors 2010-15', what: 'month t of frozen rule G (Holm over 2)',
    tests: () => [T('R1 crosses 2020-26', 'tests.R1.tMonth', 't', { nPath: 'tests.R1.n', cell: 'crosses × 2020-26', inFamily: true }),
      T('R2 majors 2010-15', 'tests.R2.tMonth', 't', { nPath: 'tests.R2.n', cell: 'majors × 2010-15', inFamily: true })],
    extra: (j) => ({ original: { decT: j.gate.published.dec.tMonth, decN: j.gate.published.dec.n, repT: j.gate.published.rep.tMonth, repN: j.gate.published.rep.n, path: 'gate.published (#880 rule G, reproduced exactly)' }, R3pooled: { t: j.tests.R3.tMonth, n: j.tests.R3.n } }) },
  { pr: 929, branch: 'fx-tokyo-orb', window: 'decisive 2016 →', what: 'month t, T1-T3 (Holm over 3)',
    tests: () => ks(['T1', 'T2', 'T3'], (k) => T(k, `tests.${k}.decisive.t`, 't', { nPath: `tests.${k}.decisive.n` })) },
  { pr: 930, branch: 'chf-haven', window: 'decisive', what: 'month-sum t, three shorts (Holm over 3)',
    tests: () => [0, 1, 2].map((i) => T(`T${i + 1}`, `tests.${i}.monthT`, 't', { nPath: `tests.${i}.dec.n` })) },
  { pr: 931, branch: 'fx-round-numbers', window: 'decisive 2016 →', what: 'month t, rules T1 and T2 (Holm over 2)',
    tests: () => ks(['T1', 'T2'], (k) => T(k, `rules.${k}.real.decisive.t`, 't', { nPath: `rules.${k}.real.decisive.n` })) },
  { pr: 932, branch: 'metals-intraday-momentum', window: 'B 2016 →', what: 'month t per market (Holm over 3)',
    tests: () => ks(['xau', 'xag', 'wtico'], (k) => T(k, `tests.${k}.B.tMonth`, 't', { nPath: `tests.${k}.B.n` })) },
  { pr: 933, branch: 'brent-wti-spread', window: 'decisive', what: 'month t of the base rule (one test)',
    tests: () => [T('base', 'base.dec.monthT', 't', { nPath: 'base.dec.n' })] },
  { pr: 934, branch: 'grain-seasonality', window: 'decisive 2016-26 (11 years)', what: 't over years, T1 corn, T2 soybeans, T3 wheat (Holm over 3; judged on a permutation p)',
    tests: () => [0, 1, 2].map((i) => T(['T1 corn', 'T2 soybeans', 'T3 wheat'][i], `tests.${i}.decisive.t`, 't', { nPath: `tests.${i}.decisive.n`, ownPPath: `tests.${i}.decisive.perm.1`, ownHolmPath: `tests.${i}.holmP` })),
    extra: (j) => ({ soyReplicationWindow: { t: j.tests[1].replication.t, n: j.tests[1].replication.n, permP: j.tests[1].replication.perm['1'], path: 'tests.1.replication (2003-15, the same study, pre-registered with it)' } }) },
  { pr: 935, branch: 'commodity-xs-momentum', window: 'decisive 2016 →', what: 'Newey-West t of monthly net (one test)',
    tests: () => [T('book', 'decisive.net.tNW', 't', { nPath: 'decisive.net.n' })] },
  { pr: 936, branch: 'jp-fiscal-yearend', window: 'decisive 2016-26 (11 years)', what: 't over years, T1 and T2',
    tests: () => ks(['T1', 'T2'], (k) => T(k, `tests.${k}.decisive.t`, 't', { nPath: `tests.${k}.decisive.years` })) },
  { pr: 937, branch: 'soybean-short-robust', role: 'robustness', of: 934, window: 'the same years, nearby windows and stops', what: 'frozen robustness checks; a report, no p computed',
    report: (j) => ({ verdict: j.verdict, r1: j.r1.map((x) => ({ shift: x.shift, netR: x.decisive.meanNet, t: x.decisive.t })), r2: j.r2.map((x) => ({ k: x.k, netR: x.decisive.meanNet, t: x.decisive.t })), held: false, src: 'r1, r2' }) },
  { pr: 938, branch: 'fx-weekend-gap-replicate2', role: 'replication', of: 880, window: 'S1 #928\'s crosses 2010-19; S2 six new pairs 2016 →', what: 'month t of frozen rule G (Holm over 2)',
    tests: () => [T('S1 crosses 2010-19', 'tests.S1.tMonth', 't', { nPath: 'tests.S1.n', cell: 'crosses × 2010-19', inFamily: true }),
      T('S2 new pairs 2016-26', 'tests.S2.tMonth', 't', { nPath: 'tests.S2.n', cell: 'new pairs × 2016-26', inFamily: true })],
    extra: (j) => ({ S3pooled: { t: j.tests.S3.tMonth, n: j.tests.S3.n }, sameWeekendShare: { S1: j.tests.S1.overlap.withEither.n / j.tests.S1.n, S2: j.tests.S2.overlap.withEither.n / j.tests.S2.n } }) },
  { pr: 939, branch: 'bond-month-end', window: 'decisive 2016 →', what: 'stored one-sided p, USB10Y and USB30Y (Holm over 2)',
    tests: () => [0, 1].map((i) => T(['T1 usb10y', 'T2 usb30y'][i], `tests.${i}.pOneSided`, 'p')) },
  { pr: 940, branch: 'fx-weekly-reversal', window: 'decisive 2016 →', what: 'month-sum t of weekly net R (one test)',
    tests: () => [T('primary', 'primary.decisive.monthly.net.t', 't', { nPath: 'primary.decisive.monthly.net.n' })] },
  { pr: 941, branch: 'index-long-reversal', window: 'decisive', what: 'Newey-West t of monthly net, 1x costs (one test)',
    tests: () => [T('main', 'main.decisive.x1.tNW', 't', { nPath: 'main.decisive.x1.months' })] },
];

// ---------- the hypotheses that have a replication (output b); every p named by its id in collected.json ----------
// sel: k = the original study's number of decisive tests (for the selection-adjusted sensitivity, not pre-registered).
// For each replication: cell = instruments x calendar; sameCal = shares calendar time with the original (other instruments).
export const HYP = [
  { key: 'gotobi', name: 'Gotobi fade: sell USD/JPY at the 09:55 Tokyo fix on gotobi days, out at 15:00 Tokyo (#878 T2)',
    original: { id: '#878 gotobi: T2', cell: 'USD/JPY × 2016-26', k: 4 },
    reps: [{ id: '#889 gotobi-replicate: R2 USD/JPY 2005-09', cell: 'USD/JPY × 2005-09', sameCal: false },
      { id: '#889 gotobi-replicate: R1 crosses pooled', cell: 'yen crosses × 2010-26', sameCal: true, note: 'the crosses correlate 0.5-0.8 with the USD/JPY leg on the same days (#904)' }],
    robust: [{ id: '#894 gotobi-feed: HistData USD/JPY', what: 'second feed, same 2018-26 days (per-trade correlation 0.997)' }, { pr: 912 }, { pr: 908 }, { pr: 915 }],
    caveats: ['At twice the assumed spread the edge is about zero on every feed (#878, #893, #894); the broker spread at 00:55 UTC (yen spread log, #897) decides whether it is tradable.',
      'It sits on the one entry minute: one minute late keeps about a third of it (#908 OANDA, #912 HistData), and a resting limit placed before the fix does not capture it (#915).',
      'Whether the fix-minute move is special to gotobi days is unclear (#917: on ordinary days the same fade loses, t −2.37; gotobi minus ordinary days at the fix minute t −0.25).'] },
  { key: 'weekend-gap', name: 'Forex Sunday-open gap fade, rule G (#880 G)',
    original: { id: '#880 fx-weekend-gap: G', cell: 'majors × 2020-26', k: 2 },
    reps: [{ id: '#928 fx-weekend-gap-replicate: R1 crosses 2020-26', cell: 'crosses × 2020-26', sameCal: true, note: '228 of 294 trades on weekends #880 also traded' },
      { id: '#928 fx-weekend-gap-replicate: R2 majors 2010-15', cell: 'majors × 2010-15', sameCal: false },
      { id: '#938 fx-weekend-gap-replicate2: S1 crosses 2010-19', cell: 'crosses × 2010-19', sameCal: false, overlapsCal: '#928 R2 (2010-15, other pairs)' },
      { id: '#938 fx-weekend-gap-replicate2: S2 new pairs 2016-26', cell: 'new pairs × 2016-26', sameCal: true, note: '386 of 481 trades on weekends #880 or #928 also traded' }],
    robust: [],
    caveats: ['Both replications read PARTLY: it holds on other pairs over the SAME weekends (R1 t 2.99, S2 t 3.19) and not on years the first study never traded (R2 t 0.03; S1 t 1.02, flat without 2015).',
      'Costs: at 2 pips of slippage a side or twice the base cost most of it goes (R1 2x cost month t 1.44; S2 2x cost +0.013R a trade); crosses\' spreads are assumed, not measured.',
      '2026 carries most of the 2020-26 total (#928: +39.7R of +70.1R).'] },
  { key: 'vol-spike', name: 'Index rebound after a volatility spike, 10-day hold (#860)',
    original: { id: '#860 vol-spike-rebound: 10-day hold', cell: 'US indices × 2016-26', k: 2 },
    reps: [{ id: '#920 vol-spike-replicate: R1 other indices 2016-26', cell: 'other indices × 2016-26', sameCal: true, note: 'volatility spikes fall on the same days across indices' },
      { id: '#920 vol-spike-replicate: R2 other indices 2005-15', cell: 'other indices × 2005-15', sameCal: false }],
    robust: [],
    caveats: ['#920 reads PARTLY: R1 t 1.20, HK33 (n 27) is most of the total; under the random-entry 95th percentile; near zero at 2x costs.'] },
  { key: 'ibs', name: 'Index IBS daily reversal (#895, pooled)',
    original: { id: '#895 index-ibs: pooled (from #924 gate)', cell: 'US indices × 2016-26', k: 3 },
    reps: [{ id: '#924 ibs-replicate: R1 other indices 2016 →', cell: 'other indices × 2016-26', sameCal: true },
      { id: '#924 ibs-replicate: R2 other indices 2005-15', cell: 'other indices × 2005-15', sameCal: false }],
    robust: [], caveats: ['#924: DOES NOT REPLICATE (R1 month t −1.97).'] },
  { key: 'rsi2', name: 'Index RSI(2) pullback (#838)',
    original: { id: '#838 rsi2-pullback: spx500', cell: 'US indices × 2016-26', k: 3, note: 'the study\'s smallest p; the replications froze the rule, not one market' },
    reps: [{ id: '#844 rsi2-replicate: pooled', cell: 'six non-US indices × 2016-26', sameCal: true }, { id: '#873 metals-rsi2: pooled', cell: 'gold, silver × 2016-26', sameCal: true }],
    robust: [], caveats: ['Both frozen replications failed (#844 t 0.85, #873 t −1.79).'] },
  { key: 'turnaround', name: 'Turnaround Tuesday (#857)',
    original: { id: '#857 turnaround-tuesday: nas100-r2', cell: 'US indices × 2016-26', k: 4, note: 'the study\'s smallest p' },
    reps: [{ id: '#862 turnaround-replicate: pooled', cell: 'six other indices × 2016-26', sameCal: true }],
    robust: [], caveats: ['#862 failed its bar (t 1.69).'] },
];
// Shown beside the list: a hypothesis with no replication study but with a frozen robustness check.
export const ROBUST_ONLY = [
  { key: 'soybean', name: 'Short soybeans July to September (#934 T2)', original: { id: '#934 grain-seasonality: T2 soybeans', k: 3 }, robust: [{ pr: 937 }],
    caveats: ['Three of its eleven decisive years were stopped at about −1R (2026 among them).',
      'FRAGILE (#937): ten trading days later the 2016-26 result turns negative (−0.041R a year); −5 days keeps +0.057R. No second feed could be read.',
      'The 2003-15 window (the same study, pre-registered with it) is positive (+1.186R a year, t 1.83), but those years are likely part of what the seasonal was drawn from (#937).'] },
];

// ---------- collect (git; run by hand once) ----------
const HERE = dirname(fileURLToPath(import.meta.url));
const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
async function collect() {
  const { execFileSync } = await import('node:child_process');
  const ROOT = join(HERE, '..', '..', '..');
  const show = (ref) => execFileSync('git', ['show', ref], { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  const prior = JSON.parse(show('origin/multiple-testing-1314nov:research/edge/multiple-testing-1314nov/inputs.json'));
  const priorRows = prior.rows.map((r) => ({ pr: r.pr, branch: r.branch, topic: r.topic, role: r.role, of: r.of, window: r.window, why: r.why,
    tests: r.tests.map((x) => ({ test: x.test, kind: x.kind, t: x.t, p: x.p, n: x.n, path: x.path, why: x.why })) }));
  const rows = [];
  for (const s of NEW) {
    const base = { pr: s.pr, branch: s.branch, topic: s.branch, role: s.role || 'family', of: s.of, window: s.window, what: s.what };
    if (base.role === 'excluded') { rows.push({ ...base, why: s.why, tests: [] }); continue; }
    const j = JSON.parse(show(`origin/${s.branch}:research/edge/${s.branch}/result.json`));
    base.verdict = String(typeof j.verdict === 'string' ? j.verdict : JSON.stringify(j.verdict)).slice(0, 160);
    if (s.report) { rows.push({ ...base, report: s.report(j), tests: [] }); continue; }
    const tests = s.tests(j).map((x) => {
      const v = get(j, x.path);
      const r = { test: x.test, kind: typeof v === 'number' ? x.kind : null, t: null, p: null, n: null, path: x.path };
      if (typeof v === 'number') { if (x.kind === 't') r.t = v; else r.p = v; }
      else r.why = `no number at ${x.path}`;
      const n = x.nPath ? get(j, x.nPath) : null; r.n = typeof n === 'number' ? n : null;
      for (const k of ['cell', 'inFamily']) if (x[k] != null) r[k] = x[k];
      if (x.ownPPath) { r.ownP = get(j, x.ownPPath); r.ownHolm = get(j, x.ownHolmPath); }
      return r;
    });
    rows.push({ ...base, tests, ...(s.extra ? { extra: s.extra(j) } : {}) });
  }
  const out = { built: '2026-11-14', prior: { source: 'origin/multiple-testing-1314nov:research/edge/multiple-testing-1314nov/inputs.json (#904)', rows: priorRows }, rows };
  writeFileSync(join(HERE, 'collected.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(priorRows.length, 'prior rows,', rows.length, 'new rows,', rows.reduce((a, r) => a + r.tests.length, 0), 'new tests');
  for (const r of rows) for (const t of r.tests) if (!t.kind) console.log('unparsed', r.pr, t.test, t.why);
}

// ---------- the analysis (pure, on collected.json) ----------
const idOf = (r, x) => `#${r.pr} ${r.topic}: ${x.test}`;
export function flatten(C) {
  const all = [], unparsed = [], excluded = [], reports = [];
  const take = (r, src) => {
    if (r.role === 'excluded') { excluded.push({ pr: r.pr, branch: r.branch, why: r.why, src }); return; }
    if (r.report) reports.push({ pr: r.pr, branch: r.branch, of: r.of, report: r.report });
    for (const x of r.tests) {
      const tp = testP(x); const id = idOf(r, x);
      if (!tp) { unparsed.push({ id, why: x.why }); continue; }
      all.push({ id, pr: r.pr, topic: r.topic, role: r.role, test: x.test, n: x.n, src, inFamily: x.inFamily !== false, cell: x.cell, ...tp });
    }
  };
  for (const r of C.prior.rows) take(r, '904');
  for (const r of C.rows) take(r, 'new');
  // #895's pooled decisive (the rule #924 froze), reproduced exactly in #924's gate: a test id for output (b) only.
  const ibs = C.rows.find((r) => r.pr === 924);
  if (ibs && ibs.extra) all.push({ id: '#895 index-ibs: pooled (from #924 gate)', pr: 895, topic: 'index-ibs', role: 'original-only', test: 'pooled', n: ibs.extra.originalPooled.n, src: 'new', inFamily: false, ...testP({ kind: 't', t: ibs.extra.originalPooled.t }) });
  return { all, unparsed, excluded, reports };
}
const strip = (F) => ({ ...F, rows: F.rows.map((x) => ({ id: x.id, src: x.src, t: r4(x.t), p: r6(x.p), holm: r4(x.holm), bh: r4(x.bh), by: r4(x.by), n: x.n ?? null })) });

export function hypothesis(H, byId, bonfP, reports) {
  const o = byId.get(H.original.id); if (!o) throw new Error(`missing ${H.original.id}`);
  const reps = H.reps.map((r) => ({ ...r, ...pick(byId.get(r.id), r.id) }));
  const fA = fisher([o.p, ...reps.map((r) => r.p)]); // every replication cell: the upper bound (cells disjoint, calendar not)
  const calFree = reps.filter((r) => !r.sameCal);
  // Calendar-disjoint reading (the pre-registered one): at most one replication per calendar stretch; where two share a
  // stretch on other instruments and no study pooled them, each is combined with the original on its own and both are shown.
  const groups = []; for (const r of calFree) { const g = groups.find((x) => r.overlapsCal && x.some((y) => r.overlapsCal.startsWith(y.id.split(':')[0].split(' ')[0]))); if (g) g.push(r); else groups.push([r]); }
  const variants = cartesian(groups).map((set) => ({ ids: set.map((r) => r.id), ...fisherOut([o.p, ...set.map((r) => r.p)]) }));
  const B = variants.length ? variants.reduce((a, b) => (b.p > a.p ? b : a)) : null; // the weaker of the variants
  const pSel = Math.min(1, H.original.k * o.p); // selection-adjusted original p (not pre-registered, shown)
  const Bsel = B ? fisherOut([pSel, ...B.ids.map((id) => byId.get(id).p)]) : null;
  const robust = (H.robust || []).map((r) => (r.id ? { id: r.id, what: r.what, ...pick(byId.get(r.id), r.id) } : { pr: r.pr, ...(reports.find((x) => x.pr === r.pr) || {}).report }));
  return {
    key: H.key, name: H.name, original: { id: o.id, cell: H.original.cell, t: r4(o.t), p: r6(o.p), n: o.n, k: H.original.k, pSelAdj: r6(pSel), note: H.original.note },
    replications: reps.map((r) => ({ id: r.id, cell: r.cell, sameCalendar: !!r.sameCal, t: r4(r.t), p: r6(r.p), n: r.n, note: r.note })),
    fisherCalendarDisjoint: B ? { ...B, variants, belowBonferroni: B.p < bonfP } : null,
    fisherCalendarDisjointSelAdj: Bsel,
    fisherAllCells: { ...fisherOut([o.p, ...reps.map((r) => r.p)]), ids: [o.id, ...reps.map((r) => r.id)], overstated: reps.some((r) => r.sameCal) },
    robustness: robust, caveats: H.caveats,
  };
  function pick(x, id) { if (!x) throw new Error(`missing ${id}`); return { t: x.t, p: x.p, n: x.n }; }
}
const fisherOut = (ps) => { const f = fisher(ps); return { x: r4(f.x), df: f.df, p: f.p, z: r4(tOfP(f.p)) }; };
const cartesian = (groups) => groups.reduce((acc, g) => acc.flatMap((a) => g.map((x) => [...a, x])), [[]]).filter((s) => s.length);

export function analyse(C) {
  const { all, unparsed, excluded, reports } = flatten(C);
  const fam904 = all.filter((x) => x.role === 'family' && x.src === '904');
  const famNew = all.filter((x) => x.role === 'family' && x.src === 'new');
  const primary = [...fam904, ...famNew];
  const reps = all.filter((x) => x.role === 'replication' && x.inFamily);
  const F = family(primary), Fnew = family(famNew), S = family([...primary, ...reps]);
  const byId = new Map(all.map((x) => [x.id, x]));
  const hyps = HYP.map((H) => hypothesis(H, byId, F.bonferroni.p, reports));
  const robustOnly = ROBUST_ONLY.map((H) => {
    const o = byId.get(H.original.id); const raw = C.rows.find((r) => r.pr === 934).tests.find((x) => idOf({ pr: 934, topic: 'grain-seasonality' }, x) === H.original.id);
    const ex = C.rows.find((r) => r.pr === 934).extra.soyReplicationWindow;
    return { key: H.key, name: H.name, original: { id: o.id, t: r4(o.t), p: r6(o.p), n: o.n, ownPermP: raw.ownP, ownHolm: raw.ownHolm, holmAll: r4(F.rows.find((x) => x.id === o.id).holm), bhAll: r4(F.rows.find((x) => x.id === o.id).bh) },
      inStudyWindow: { ...ex, fisherPostHoc: fisherOut([o.p, pOneSided(ex.t)]) },
      robustness: H.robust.map((r) => ({ pr: r.pr, ...(reports.find((x) => x.pr === r.pr) || {}).report })), caveats: H.caveats };
  });
  const roles = {};
  for (const r of C.rows) (roles[r.role] ||= []).push(r.pr);
  const gotobi = hyps.find((h) => h.key === 'gotobi');
  const standing = hyps.filter((h) => h.fisherCalendarDisjoint && h.fisherCalendarDisjoint.p < F.bonferroni.p).map((h) => h.key);
  return {
    built: C.built,
    verdict: `no test survives a correction across all ${F.N} (the ${fam904.length} of #904 plus ${famNew.length} new): Holm ${F.holmPass.length}, BH q 0.10 ${F.bh10.length}; t >= 2 in ${F.t2.observed} against ${F.t2.expected.toFixed(1)} expected by chance; with an independent replication on other years, only the gotobi fade stays under the family's Bonferroni line (Fisher p ${gotobi.fisherCalendarDisjoint.p.toExponential(1)}, independence assumed), and it is not a net edge until the broker spread at the fix is measured`,
    counts: { prior904: fam904.length, new: famNew.length, total: F.N, newStudies: C.rows.length, roles },
    excluded, unparsed,
    family: strip(F), newOnly: strip(Fnew), withReplications: { ...strip(S), replicationIds: reps.map((x) => x.id) },
    hypotheses: hyps, robustOnly, reports, standing,
  };
}

// ---------- report ----------
const f2 = (v, d = 2) => (!Number.isFinite(v) ? String(v) : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const fp = (p) => (p < 1e-3 ? p.toExponential(2) : p.toFixed(4));
export function report(R) {
  const F = R.family, N = R.newOnly, S = R.withReplications;
  const L = [];
  L.push('# Result: multiple testing, update of the 13-14 Nov count with the studies pushed since (14 Nov 2026)', '');
  L.push(`**Verdict: ${R.verdict}.**`, '');
  L.push(`- **Holm across all ${F.N} decisive tests: ${F.holmPass.length} survive. BH at q 0.10: ${F.bh10.length}${F.bh10.length ? ' (' + F.bh10.join(', ') + ')' : ''}; at q 0.05: ${F.bh05.length}.** Bonferroni needs p < ${fp(F.bonferroni.p)} (t ≥ ${F.bonferroni.t.toFixed(2)}).`);
  L.push(`- **t ≥ 2: ${F.t2.observed} observed against ${F.t2.expected.toFixed(1)} expected by chance** (Poisson 95 % range ${F.t2.range95[0]}-${F.t2.range95[1]}); t ≤ −2: ${F.tNeg2.observed}. The ${N.N} new tests alone: t ≥ 2 in ${N.t2.observed} against ${N.t2.expected.toFixed(1)} expected; t ≤ −2 in ${N.tNeg2.observed}; Holm ${N.holmPass.length}, BH q 0.10 ${N.bh10.length}.`);
  L.push(`- **Hypotheses still standing** (an independent replication on years the original never used, combined evidence under the family's Bonferroni line): ${R.standing.length ? R.standing.join(', ') : 'none'}. Every other replicated hypothesis falls short; details below.`, '');
  L.push('Paper research only: nothing live, no study, rule or stored figure changed; no market data fetched. Pre-registration: `PREREGISTRATION.md` (pushed alone first). Inputs: `collected.json` (built by `node run.mjs collect` from each study\'s own branch and #904\'s `inputs.json`); numbers: `result.json`.', '');
  L.push('## (b) Hypotheses with a replication, and their combined evidence', '');
  L.push('Fisher, −2 Σ ln p on 2k df, assumes independent p\'s. **Calendar-disjoint** (the pre-registered reading): the original plus replications on years it never used; two replications that share years on other instruments (and that no study pooled) are each combined with the original on their own, and the weaker result is shown. **All cells** adds the replications on the same years and other instruments: those share the same days (the studies say so), so that figure overstates the evidence and is an upper bound only. A robustness re-run on the same days is never combined.', '');
  L.push('| Hypothesis | Original (t, one-sided p) | Replications (t) | Fisher, calendar-disjoint | Fisher, all cells (upper bound) |', '|---|---|---|---|---|');
  for (const h of R.hypotheses) {
    const B = h.fisherCalendarDisjoint;
    L.push(`| ${h.name} | ${h.original.id}: t ${f2(h.original.t)}, p ${fp(h.original.p)} | ${h.replications.map((r) => `${r.id.split(': ')[1]} ${f2(r.t)}${r.sameCalendar ? ' (same years)' : ''}`).join('; ')} | ${B ? `p ${fp(B.p)} (z ${f2(B.z)}; ${B.ids.map((i) => i.split(': ')[1]).join(' + ')})${B.belowBonferroni ? ' **under Bonferroni**' : ''}` : 'none on other years'} | p ${fp(h.fisherAllCells.p)} (z ${f2(h.fisherAllCells.z)}) |`);
  }
  L.push('', 'Sensitivity, not pre-registered: the original p multiplied by its own study\'s number of decisive tests (its selection among them), then the calendar-disjoint Fisher: ' +
    R.hypotheses.filter((h) => h.fisherCalendarDisjointSelAdj).map((h) => `${h.key} p ${fp(h.fisherCalendarDisjointSelAdj.p)}`).join('; ') + '.', '');
  L.push('### In plain words', '');
  for (const h of R.hypotheses) {
    const B = h.fisherCalendarDisjoint;
    const vv = B && B.variants.length > 1 ? ` (the other way to pair the shared years gives ${B.variants.filter((v) => v.p !== B.p).map((v) => `p ${fp(v.p)} with ${v.ids.map((i) => i.split(': ')[1]).join(' + ')}`).join('; ')})` : '';
    const up = h.fisherAllCells.p < F.bonferroni.p && !(B && B.belowBonferroni) ? ` Counting the replications on the same years too gives p ${fp(h.fisherAllCells.p)}, under the line, but only by counting the same days again on other instruments.` : '';
    L.push(`**${h.name}.** ${B ? `On years the original never used, combined p ${fp(B.p)}${vv}${B.belowBonferroni ? ', under the family\'s Bonferroni line' : ', not under the family\'s Bonferroni line'} (${fp(F.bonferroni.p)}).` : 'No replication on other years; the replications on the same years cannot be combined honestly.'}${up} ` +
      (h.robustness.length ? 'Robustness on the same days: ' + h.robustness.map((r) => r.id ? `${r.id} t ${f2(r.t)} (${r.what})` : `#${r.pr} ${r.verdict}`).join('; ') + '. ' : '') + h.caveats.join(' '));
    L.push('');
  }
  for (const h of R.robustOnly) {
    L.push(`**${h.name}** (no replication study, one robustness check). Decisive t ${f2(h.original.t)} over ${h.original.n} years, one-sided p ${fp(h.original.p)} by this count's rule (the study's own permutation p ${h.original.ownPermP}, Holm ${h.original.ownHolm}); across all ${F.N}: Holm ${h.original.holmAll.toFixed(4)}, BH q ${h.original.bhAll.toFixed(4)}. Post hoc, shown only: with the study's own 2003-15 window (t ${f2(h.inStudyWindow.t)}) Fisher p ${fp(h.inStudyWindow.fisherPostHoc.p)}. ${h.caveats.join(' ')}`);
    L.push('');
  }
  L.push('Combined evidence for a gross or paper effect is not a net, tradable edge, and nothing here changes a live rule: any use stays the owner\'s decision.', '');
  L.push('## (a) The smallest p across all tests', '', '| Test | n | t | one-sided p | Holm over all | BH q | BY q |', '|---|---|---|---|---|---|---|');
  for (const x of F.smallest) L.push(`| ${x.id}${x.src === 'new' ? ' (new)' : ''} | ${x.n ?? '—'} | ${f2(x.t)} | ${fp(x.p)} | ${x.holm.toFixed(4)} | ${x.bh.toFixed(4)} | ${x.by.toFixed(4)} |`);
  L.push('', `Tests with t ≥ 2: ${F.t2.ids.join('; ')}.`, '');
  L.push('## Sensitivity: replication tests included', '');
  L.push(`N = ${S.N} (the family plus ${S.N - F.N} replication tests: #904's six and the new ones in each replication study's own Holm family). t ≥ 2: ${S.t2.observed} (expected ${S.t2.expected.toFixed(1)}). Holm across all: ${S.holmPass.length ? S.holmPass.join(', ') : 'none'}. BH q 0.05: ${S.bh05.length ? S.bh05.join(', ') : 'none'}; q 0.10: ${S.bh10.length ? S.bh10.join(', ') : 'none'}. Replications of a rule that already passed are not exchangeable with new hypotheses: shown, not judged.`, '');
  L.push('## What went in', '');
  L.push(`- #904's ${R.counts.prior904} family tests exactly as in its \`inputs.json\`, plus ${R.counts.new} decisive tests of ${R.counts.roles.family.length} new studies (#${R.counts.roles.family.join(', #')}).`);
  L.push(`- Replication studies (not in the primary family): #${R.counts.roles.replication.join(', #')}. Robustness reports on the same days (no test, never combined): #${R.counts.roles.robustness.join(', #')}. Left out: ${R.excluded.map((e) => `#${e.pr} ${e.branch} (${e.why})`).join('; ')}.`);
  L.push(`- Not parsed: ${R.unparsed.length ? R.unparsed.map((u) => `${u.id} (${u.why})`).join('; ') : 'none'}.`);
  L.push('- How the pre-registered rule was applied where it needed a reading: (1) #919 pre-registered two-sided weekday tests with no direction: its stored two-sided p is used as is, and its t is the one-sided normal equivalent of that p. (2) #934 stores a t over years and judged on a permutation p; the rule converts the stored t (p 0.084 for the soybean short against the study\'s own 0.012). (3) #909 stores a z (Jobson-Korkie-Memmel) for each test; #939 stores only a one-sided p. (4) #894 (HistData, the same 2018-26 days) was a replication in #904; here it is a robustness re-run and is not in Fisher, so the gotobi figure is #904\'s two-p one. (5) #895\'s original for the IBS hypothesis is its pooled decisive test (the rule #924 froze), read from #924\'s gate, where it is reproduced exactly; #838 and #857 have no single frozen test, so their smallest p stands in (named in the table).');
  L.push('- Tests within a study, and replications on the same days, are correlated: BH is valid under positive dependence only (Benjamini-Yekutieli is beside it), and the Poisson range for the count of t ≥ 2 assumes independence.', '');
  L.push('Tests: `tests/multiple-testing-update.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'collect') await collect();
  else {
    const C = JSON.parse(readFileSync(join(HERE, 'collected.json'), 'utf8'));
    const R = analyse(C);
    writeFileSync(join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    writeFileSync(join(HERE, 'RESULT.md'), report(R));
    console.log(report(R).split('\n').slice(0, 7).join('\n'));
  }
}
