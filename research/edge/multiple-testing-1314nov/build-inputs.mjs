// Builds inputs.json: the decisive tests of every study of the 13-14 Nov 2026 research day, read from each study's own
// branch with `git show origin/<branch>:research/edge/<topic>/result.json` (fetch the branches first). Run once, by hand:
//   node research/edge/multiple-testing-1314nov/build-inputs.mjs
// run.mjs reads only the checked-in inputs.json (offline). Every test names the path in result.json it came from; where a
// figure is only in RESULT.md, the test says so (`src: 'RESULT.md'`) and carries the number as written there.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const show = (branch, topic) => JSON.parse(execFileSync('git', ['show', `origin/${branch}:research/edge/${topic}/result.json`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString());
const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

// One row per study of research/proposals/2026-11-13-research-day.md (branch research-day-13nov). `tests` returns
// [{ test, path (to the t), n?, nPath?, pPath? (stored one-sided p, used only where the decisive t is not stored) }].
// role: family (a new hypothesis), replication (a frozen rule of an earlier study on other data), excluded (with why).
const T = (test, path, extra = {}) => ({ test, path, ...extra });
const STUDIES = [
  { row: 1, pr: 815, branch: 'cycle-gate-study', topic: 'cycle-gate', window: '2020 → now', what: 'Welch t kept vs blocked, 11 systems x 3 gates (Holm over 33)',
    tests: (j) => j.tests.map((x, i) => T(`${x.stream} ${x.gate}`, `tests.${i}.welch.t`, { nPath: `tests.${i}.kept.n` })) },
  { row: 2, pr: 816, branch: 'drd-metals-book', topic: 'drd-metals-book', window: 'A (2006-26), monthly sums', what: 'monthly t of stream A, T1-T3 (Holm over 3)',
    tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `streams.${k}.monthlyA.t`, { nPath: `streams.${k}.A.n` })) },
  { row: 3, pr: 817, branch: 'ict-quarters', topic: 'ict-quarters', window: 'out of sample 2024 →', what: 'Welch t favoured quarter vs the rest, out of sample (Holm over 3)',
    tests: (j) => j.candidates.map((c, i) => T(`${c.test} ${c.cycle}`, `candidates.${i}.vsRest.oos.t`, { nPath: `candidates.${i}.oos.n` })) },
  { row: 'finding', pr: 818, branch: 'mcycle-base-study', topic: 'mcycle-base', window: '2020 → now', what: 'month-sum t of the combined live stream (one test)',
    tests: () => [T('combined', 'legs.combined.all.tMonth', { nPath: 'legs.combined.all.n' })] },
  { row: 4, pr: 819, branch: 'mosha-bo-er', topic: 'mosha-bo-er', window: '2020 → now', what: 'Welch t on positions (Holm over A, B)',
    tests: () => [T('A ER20 filter', 'A.welchTrades.t', { nPath: 'A.kept.all.n' }), T('B market entry', 'B.welchTrades.t', { nPath: 'B.market.all.n' })] },
  { row: 5, pr: 820, branch: 'tl-third-touch', topic: 'tl-third-touch', window: '2020-26', what: 'T1 month-sum t, T2 Welch t vs control (Holm over 2)',
    tests: () => [T('T1 trendline', 'tests.T1.t', { nPath: 'trendline.all.n' }), T('T2 vs control', 'tests.T2.welch', { nPath: 'trendline.all.n' })] },
  { row: 6, pr: 821, branch: 'shadow-best-raw', topic: 'shadow-best-raw', window: 'out of sample 2024-26 (measured costs, 1x)', what: 'OOS month-sum t of 32 cells (Holm over 32)',
    tests: (j) => j.cells.map((c, i) => T(`${c.k} ${c.m}`, `cells.${i}.OOS.t`, { nPath: `cells.${i}.OOS.n` })) },
  { row: 7, pr: 822, branch: 'engulf-ladder', topic: 'engulf-ladder', window: '2020-26', what: 'T1 month t; T2, T3 Welch t (Holm over 3)',
    tests: () => [T('T1 ladder', 'T1.month.t', { nPath: 'T1.all.n' }), T('T2 sideways vs momentum', 'T2.t', { nPath: 'T2.sideways.n' }), T('T3 50% vs edge', 'T3.t', { nPath: 'T3.mid.n' })] },
  { row: 8, pr: 823, branch: 'gold-tsmom', topic: 'gold-tsmom', window: 'confirmation (monthly)', what: 't of monthly returns, two variants (Holm over 2)',
    tests: () => [T('long/short', 'variants.ls.conf.t', { nPath: 'variants.ls.conf.n' }), T('long/flat', 'variants.lf.conf.t', { nPath: 'variants.lf.conf.n' })] },
  { row: 9, pr: 824, branch: 'ict-book-risk', topic: 'ict-book-risk', window: 'out of sample', what: 'bootstrap P(better), four book rules (Holm over 4); p = 1 - P',
    tests: (j) => j.candidates.map((c, i) => T(c.test || c.rule || `R${i + 1}`, null, { pFromP: `candidates.${i}.bootstrap.pBetter`, nPath: `candidates.${i}.oos.n` })) },
  { row: 10, pr: 825, branch: 'swing-day3', topic: 'swing-day3', window: '2020 →', what: 'stored one-sided p of T1-T3 (Holm over 3)',
    tests: () => [T('T1', 'T1.monthly.t', { nPath: 'T1.all.n' }), T('T2', null, { pPath: 'tests.T2.p' }), T('T3', null, { pPath: 'tests.T3.p' })] },
  { row: 11, pr: 826, branch: 'turn-of-month', topic: 'turn-of-month', window: 'out of sample (decisive)', what: 'out-of-sample t per market (Holm over 3)',
    tests: () => ['spx500', 'us30', 'nas100'].map((m) => T(m, `markets.${m}.oos.t`, { nPath: `markets.${m}.oos.n` })) },
  { row: 12, pr: 827, branch: 'vix-term', topic: 'vix-term', role: 'excluded', why: 'not run (Cboe not reachable)' },
  { row: 13, pr: 828, branch: 'tsmom-portfolio', topic: 'tsmom-portfolio', window: 'confirmation 2008-17 (monthly)', what: 'monthly t of the book (one test)',
    tests: () => [T('book', 'confirmation.t', { nPath: 'confirmation.n' })] },
  { row: 14, pr: 829, branch: 'gold-silver-ratio', topic: 'gold-silver-ratio', window: 'confirmation 2006-17', what: 't of trades (one test)',
    tests: () => [T('ratio fade', 'windows.2006-17.tStrict', { nPath: 'windows.2006-17.n' })] },
  { row: 16, pr: 830, branch: 'fx-carry', topic: 'fx-carry', window: 'decisive (revision 2)', what: 'monthly t, two tests (Holm over 2)',
    tests: () => [T('T1', 'tests.T1.decisive.t'), T('T2', 'tests.T2.decisive.t')] },
  { row: 15, pr: 831, branch: 'pre-fomc-drift', topic: 'pre-fomc-drift', window: 'B 2016 → (SPX500 decides)', what: 'SPX500 t in window B (one test; NAS100 and gold descriptive)',
    tests: () => [T('spx500', 'markets.spx500.windows.B.t', { nPath: 'markets.spx500.windows.B.n' })] },
  { row: 17, pr: 833, branch: 'crypto-weekly-mom', topic: 'crypto-weekly-mom', window: 'decisive 2022 →', what: 'month t, two variants (Holm over 2)',
    tests: () => [T('V1 long/flat', 'variants.V1.decisive.monthT'), T('V2 long/short', 'variants.V2.decisive.monthT')] },
  { row: 18, pr: 834, branch: 'fx-reversal', topic: 'fx-reversal', window: 'decisive 2016 →', what: 'month-sum t (one test)',
    tests: () => [T('reversal', 'decisive.tMonth', { nPath: 'decisive.n' })] },
  { row: 19, pr: 835, branch: 'intraday-momentum', topic: 'intraday-momentum', window: 'B (decisive)', what: 't per market (Holm over 2)',
    tests: () => ['spx500', 'nas100'].map((m) => T(m, `markets.${m}.B.t`, { nPath: `markets.${m}.B.n` })) },
  { row: 20, pr: 836, branch: 'overnight-drift', topic: 'overnight-drift', window: 'decisive', what: 'month t per index (Holm over 3)',
    tests: () => ['spx500', 'nas100', 'us30'].map((m) => T(m, `markets.${m}.dec.night.t`, { nPath: `markets.${m}.dec.night.n` })) },
  { row: 21, pr: 837, branch: 'orb-nas100', topic: 'orb-nas100', window: 'B 2021 →', what: 'monthly t per market (Holm over 2)',
    tests: () => ['nas100', 'spx500'].map((m) => T(m, `markets.${m}.windows.B.t`, { nPath: `markets.${m}.windows.B.n` })) },
  { row: 22, pr: 838, branch: 'rsi2-pullback', topic: 'rsi2-pullback', window: 'B 2016 →', what: 'stored one-sided p of the trade t per market (Holm over 3)',
    tests: () => ['spx500', 'nas100', 'us30'].map((m) => T(m, null, { pPath: `markets.${m}.B.p`, nPath: `markets.${m}.B.n` })) },
  { row: 23, pr: 839, branch: 'vol-managed', topic: 'vol-managed', window: '2016-01 → 2026-10', what: 'bootstrap P of the Sharpe difference, two variants (Holm over 2); p = 1 - P',
    tests: () => [T('V c/variance', null, { pRaw: 1 - 0.285, src: 'RESULT.md', note: 'bootstrap P 0.285' }), T('S c/volatility', null, { pRaw: 1 - 0.348, src: 'RESULT.md', note: 'bootstrap P 0.348' })] },
  { row: 24, pr: 840, branch: 'audnzd-revert', topic: 'audnzd-revert', window: 'decisive', what: 'month t, three variants (Holm over 3)',
    tests: () => [0, 1, 2].map((i) => T(`variant ${i + 1}`, `variants.${i}.dec.monthT`, { nPath: `variants.${i}.dec.n` })) },
  { row: 25, pr: 841, branch: 'sma10-timing', topic: 'sma10-timing', window: '2016 → (decisive)', what: 'bootstrap P(better return / drawdown) of the book (one test); p = 1 - P',
    tests: () => [T('book', null, { pFromP: 'windows.W2.book.boot.pBetter' })] },
  { row: 26, pr: 842, branch: 'crypto-hour', topic: 'crypto-hour', window: 'decisive 2024 →', what: 'month t, four tests (Holm over 4)',
    tests: (j) => j.tests.map((x, i) => T(x.id || `test ${i + 1}`, `tests.${i}.monthT`, { nPath: `tests.${i}.n` })) },
  { row: 27, pr: 843, branch: 'gold-week-raid', topic: 'gold-week-raid', window: 'decisive', what: 'month t, three rules (Holm over 3)',
    tests: () => ['R1', 'R2', 'R3'].map((k) => T(k, `rules.${k}.dec.tMonth`, { nPath: `rules.${k}.dec.n` })) },
  { row: 28, pr: 844, branch: 'rsi2-replicate', topic: 'rsi2-replicate', role: 'replication', of: 838, window: 'B 2016 →', what: 'pooled month t (frozen rule, six non-US indices)',
    tests: () => [T('pooled', 'pool.B.tMonthsR', { nPath: 'pool.B.n' })] },
  { row: 29, pr: 845, branch: 'pre-holiday', topic: 'pre-holiday', window: 'out of sample (decisive)', what: 'T1 pooled t; T4 pre-holiday vs ordinary days (Welch t)',
    tests: () => [T('T1 pooled', 'pooled.oos.t', { nPath: 'pooled.oos.n' }), T('T4 vs ordinary days', 'daysOOS.t')] },
  { row: 30, pr: 846, branch: 'fx-month-end', topic: 'fx-month-end', window: 'decisive', what: 't on events, base and variant (Holm over 2)',
    tests: () => [T('base', 'base.decisive.t', { nPath: 'base.decisive.n' }), T('variant', 'variant.decisive.t', { nPath: 'variant.decisive.n' })] },
  { row: 31, pr: 848, branch: 'gold-asia-break', topic: 'gold-asia-break', window: 'decisive 2020 →', what: 'month t, breakout and fade (Holm over 2)',
    tests: () => ['B', 'F'].map((k) => T(k === 'B' ? 'breakout' : 'fade', `rules.${k}.decisive.tMonth`, { nPath: `rules.${k}.decisive.n` })) },
  { row: 32, pr: 849, branch: 'gap-fill', topic: 'gap-fill', window: 'B 2021 →', what: 'monthly t, four tests (Holm over 4)',
    tests: () => ['nas100', 'spx500'].flatMap((m) => ['all', 'against'].map((s) => T(`${m} ${s}`, `markets.${m}.tests.${s}.windows.B.t`, { nPath: `markets.${m}.tests.${s}.windows.B.n` }))) },
  { row: 33, pr: 850, branch: 'gold-shock-revert', topic: 'gold-shock-revert', window: 'decisive 2020 →', what: 'trade t, revert and continue on gold (Holm over 2; silver reported)',
    tests: () => ['R', 'C'].map((k) => T(k === 'R' ? 'revert' : 'continue', `gold.rules.${k}.decisive.t`, { nPath: `gold.rules.${k}.decisive.n` })) },
  { row: 34, pr: 851, branch: 'sell-in-may', topic: 'sell-in-may', window: 'decisive pairs 2016-26', what: 'pooled winter-minus-summer t (one test)',
    tests: () => [T('pooled', 'pooled.dec.t', { nPath: 'pooled.dec.n' })] },
  { row: 35, pr: 852, branch: 'crypto-weekend', topic: 'crypto-weekend', window: 'decisive 2024 →', what: 'month t, four tests (Holm over 4)',
    tests: (j) => j.tests.map((x, i) => T(x.id || `test ${i + 1}`, `tests.${i}.monthT`, { nPath: `tests.${i}.n` })) },
  { row: 36, pr: 853, branch: 'high52-rotation', topic: 'high52-rotation', window: 'decisive 2016 →', what: 'Newey-West t of monthly excess (one test)',
    tests: () => [T('excess', 'decisive.excess.t', { nPath: 'decisive.excess.n' })] },
  { row: 37, pr: 854, branch: 'copper-gold', topic: 'copper-gold', window: 'W2 2016 →', what: 'Welch t on-minus-off weeks (one test)',
    tests: () => [T('equal weight', 'signal.W2.ew.t', { nPath: 'signal.W2.ew.weeks' })] },
  { row: 38, pr: 855, branch: 'dual-momentum', topic: 'dual-momentum', window: 'W2 2016 →', what: 'bootstrap P, two lookbacks (Holm at 0.10); p = 1 - P (stored as holm.p)',
    tests: () => [T('L12', null, { pPath: 'pass.L12.holm.p' }), T('L6', null, { pPath: 'pass.L6.holm.p' })] },
  { row: 39, pr: 856, branch: 'crypto-sma200', topic: 'crypto-sma200', window: 'decisive 2022 →', what: 'bootstrap P, four tests (Holm over 4); p = 1 - P',
    tests: (j) => j.tests.map((x, i) => T(x.id, null, { pPath: `tests.${i}.p` })) },
  { row: 40, pr: 857, branch: 'turnaround-tuesday', topic: 'turnaround-tuesday', window: 'out of sample 2016 →', what: 'trade t per cell (Holm over 4)',
    tests: () => ['spx500-r1', 'spx500-r2', 'nas100-r1', 'nas100-r2'].map((k) => T(k, `cells.${k}.oos.t`, { nPath: `cells.${k}.oos.n` })) },
  { row: 41, pr: 858, branch: 'oil-wednesday', topic: 'oil-wednesday', window: 'decisive 2021 →', what: 'net t, follow and fade (Holm over 2)',
    tests: () => ['F', 'C'].map((k) => T(k === 'F' ? 'fade' : 'follow', `rules.${k}.decisive.net.t`, { nPath: `rules.${k}.decisive.net.n` })) },
  { row: 42, pr: 859, branch: 'risk-spill-jpy', topic: 'risk-spill-jpy', window: 'decisive', what: 't per pair (Holm over 2)',
    tests: () => ['usdjpy', 'audjpy'].map((m) => T(m, `pairs.${m}.dec.t`, { nPath: `pairs.${m}.dec.n` })) },
  { row: 43, pr: 860, branch: 'vol-spike-rebound', topic: 'vol-spike-rebound', window: 'B 2016 →', what: 'stored one-sided p of the trade t, 5- and 10-day holds (Holm over 2)',
    tests: () => ['5', '10'].map((h) => T(`${h}-day hold`, null, { pPath: `holds.${h}.B.p`, nPath: `holds.${h}.B.n` })) },
  { row: 44, pr: 861, branch: 'fomc-follow', topic: 'fomc-follow', window: 'decisive 2020 →', what: 'trade t, six tests (Holm over 6)',
    tests: (j) => j.tests.map((x, i) => T(x.id || [x.market, x.rule].filter(Boolean).join(' ') || `test ${i + 1}`, `tests.${i}.t`, { nPath: `tests.${i}.n` })) },
  { row: 45, pr: 862, branch: 'turnaround-replicate', topic: 'turnaround-replicate', role: 'replication', of: 857, window: 'out of sample', what: 'pooled month t (frozen rule, six indices)',
    tests: () => [T('pooled', 'pool.oos.month.t', { nPath: 'pool.oos.n' })] },
  { row: 46, pr: 863, branch: 'nfp-follow', topic: 'nfp-follow', window: 'decisive 2020 →', what: 'trade t, four tests (Holm over 4)',
    tests: () => ['F-xau', 'R-xau', 'F-nas100', 'R-nas100'].map((k) => T(k, `tests.${k}.dec.t`, { nPath: `tests.${k}.dec.n` })) },
  { row: 47, pr: 864, branch: 'gold-weekend-gap', topic: 'gold-weekend-gap', window: 'decisive 2020 →', what: 'trade t, rules G and H (the stored p)',
    tests: () => ['G', 'H'].map((k) => T(k, `rules.${k}.dec.t`, { nPath: `rules.${k}.dec.n` })) },
  { row: 48, pr: 865, branch: 'rebalance-flow', topic: 'rebalance-flow', window: 'decisive 2016 →', what: 'trade t, four tests (Holm over 4)',
    tests: () => ['A', 'B', 'C', 'D'].map((k) => T(k, `tests.${k}.dec.t`, { nPath: `tests.${k}.dec.n` })) },
  { row: 49, pr: 866, branch: 'crypto-reversal', topic: 'crypto-reversal', window: 'decisive 2022 →', what: 'month t, four tests (Holm over 4)',
    tests: (j) => j.tests.map((x, i) => T(x.id || `test ${i + 1}`, `tests.${i}.decisive.tMonths`, { nPath: `tests.${i}.decisive.n` })) },
  { row: 50, pr: 867, branch: 'nr7-breakout', topic: 'nr7-breakout', window: 'decisive 2016 →', what: 'pooled t, two variants',
    tests: () => ['A', 'B'].map((k) => T(k, `variants.${k}.windows.decisive.pooled.t`, { nPath: `variants.${k}.windows.decisive.pooled.n` })) },
  { row: 51, pr: 868, branch: 'fx-london-orb', topic: 'fx-london-orb', window: 'decisive 2020 →', what: 't, three variants (Holm over 3)',
    tests: () => ['F1', 'F2', 'FADE'].map((k) => T(k, `variants.${k}.decisive.t`, { nPath: `variants.${k}.decisive.n` })) },
  { row: 52, pr: 869, branch: 'fx-xs-momentum', topic: 'fx-xs-momentum', window: 'decisive 2016 →', what: 'net monthly t, two lookbacks (Holm over 2)',
    tests: () => ['21', '63'].map((k) => T(`lookback ${k}`, `lookbacks.${k}.decisive.net.t`, { nPath: `lookbacks.${k}.decisive.net.n` })) },
  { row: 53, pr: 870, branch: 'gold-silver-divergence', topic: 'gold-silver-divergence', window: 'decisive 2020 →', what: 'month t, fade and follow',
    tests: () => ['fade', 'follow'].map((k) => T(k, `variants.${k}.decisive.tMonth`, { nPath: `variants.${k}.decisive.n` })) },
  { row: 54, pr: 871, branch: 'cpi-follow', topic: 'cpi-follow', window: 'decisive 2020 →', what: 't, four tests (Holm over 4)',
    tests: (j) => j.tests.map((x, i) => T(x.id || x.market || `test ${i + 1}`, `tests.${i}.decisive.t`, { nPath: `tests.${i}.decisive.n` })) },
  { row: 55, pr: 872, branch: 'last-hour', topic: 'last-hour', window: 'decisive 2016 →', what: 'month t, fade and follow (Holm over 2)',
    tests: () => ['fade', 'follow'].map((k) => T(k, `variants.${k}.D.tMonths`, { nPath: `variants.${k}.D.n` })) },
  { row: 56, pr: 873, branch: 'metals-rsi2', topic: 'metals-rsi2', role: 'replication', of: 838, window: 'B 2016 →', what: 'pooled month t (frozen rule, gold and silver)',
    tests: () => [T('pooled', 'pooled.B.tMonths', { nPath: 'pooled.B.n' })] },
  { row: 57, pr: 874, branch: 'index-cycle', topic: 'index-cycle', window: 'decisive 2016 →', what: 'month t, exits A and B (Holm over 2)',
    tests: () => [T('exit A', null, { tRaw: -4.26, nRaw: 1174, src: 'verdict text' }), T('exit B', null, { tRaw: -5.6, nRaw: 2907, src: 'verdict text' })] },
  { row: 58, pr: 875, branch: 'gold-session-drift', topic: 'gold-session-drift', window: 'decisive 2020 →', what: 't, three tests (Holm over 3)',
    tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.decisive.t`, { nPath: `tests.${k}.decisive.n` })) },
  { row: 59, pr: 876, branch: 'nas-crypto-spill', topic: 'nas-crypto-spill', window: 'decisive 2022 →', what: 'month t, follow and fade (Holm over 2)',
    tests: () => ['follow', 'fade'].map((k) => T(k, `variants.${k}.month.t`, { nPath: `variants.${k}.dec.n` })) },
  { row: 60, pr: 877, branch: 'fx-cycle', topic: 'fx-cycle', window: 'decisive 2016 →', what: 'month t, exits A and B (Holm over 2)',
    tests: () => ['A', 'B'].map((k) => T(`exit ${k}`, `exits.${k}.decisive.tMonth`, { nPath: `exits.${k}.decisive.n` })) },
  { row: 61, pr: 878, branch: 'gotobi', topic: 'gotobi', window: 'decisive 2016 →', what: 'month t, four tests (Holm over 4)',
    tests: () => ['T1', 'T2', 'T3', 'T4'].map((k) => T(k, `tests.${k}.decisive.t`, { nPath: `tests.${k}.decisive.n` })) },
  { row: 62, pr: 879, branch: 'energy-seasonal', topic: 'energy-seasonal', window: '2016-26 (11 years)', what: 't over years, four tests (Holm over 4)',
    tests: () => [['T1 WTI long', 1.37], ['T2 Brent long', 1.46], ['T3 natgas long', 0.27], ['T4 natgas short', 1.47]].map(([k, t]) => T(k, null, { tRaw: t, nRaw: 11, src: 'RESULT.md' })) },
  { row: 63, pr: 880, branch: 'fx-weekend-gap', topic: 'fx-weekend-gap', window: 'decisive 2020 →', what: 'month t, rules G and H',
    tests: () => ['G', 'H'].map((k) => T(k, `rules.${k}.dec.tMonth`, { nPath: `rules.${k}.dec.n` })) },
  { row: 64, pr: 881, branch: 'index-pair', topic: 'index-pair', window: 'decisive 2016 →', what: 'month t, two pairs (Holm over 2)',
    tests: () => [0, 1].map((i) => T(`pair ${i + 1}`, `pairs.${i}.dec.monthT`, { nPath: `pairs.${i}.dec.n` })) },
  { row: 65, pr: 882, branch: 'opex-week', topic: 'opex-week', window: 'decisive 2016 →', what: 't, four tests (Holm over 4)',
    tests: () => ['T1', 'T2', 'T3', 'T4'].map((k) => T(k, `tests.${k}.dec.t`, { nPath: `tests.${k}.dec.n` })) },
  { row: 66, pr: 883, branch: 'london-fix', topic: 'london-fix', window: 'decisive 2020 →', what: 'month t, follow and fade (Holm over 2)',
    tests: () => ['T1', 'T2'].map((k) => T(k, `tests.${k}.decisive.t`, { nPath: `tests.${k}.decisive.n` })) },
  { row: 67, pr: 884, branch: 'index-spread-momentum', topic: 'index-spread-momentum', window: 'decisive 2016 →', what: 'pooled month t (one test)',
    tests: () => [T('pooled', 'pooled.dec.monthT', { nPath: 'pooled.dec.n' })] },
  { row: 68, pr: 886, branch: 'risk-cross', topic: 'risk-cross', window: '2016 → (charged financing)', what: 'monthly t, three tests',
    tests: () => [['T1 AUD/JPY', -1.30, 52], ['T2 NZD/JPY', -0.94, 52], ['T3 trend only', -0.24, 30]].map(([k, t, n]) => T(k, null, { tRaw: t, nRaw: n, src: 'RESULT.md' })) },
  { row: 69, pr: 887, branch: 'eth-btc-ratio', topic: 'eth-btc-ratio', window: 'decisive 2022 →', what: 't, two tests (Holm over 2)',
    tests: () => [0, 1].map((i) => T(`test ${i + 1}`, `tests.${i}.decisive.t`)) },
  { row: 70, pr: 888, branch: 'crypto-cycle', topic: 'crypto-cycle', window: 'decisive', what: 'month t, exits A and B (Holm over 2)',
    tests: () => ['A', 'B'].map((k) => T(`exit ${k}`, `exits.${k}.decisive.tMonth`, { nPath: `exits.${k}.decisive.n` })) },
  { row: 71, pr: 889, branch: 'gotobi-replicate', topic: 'gotobi-replicate', role: 'replication', of: 878, window: 'R1 crosses 2010 →, R2 USD/JPY 2005-09', what: 'month t',
    tests: () => [T('R1 crosses pooled', 'r1.pooled.all.t', { nPath: 'r1.pooled.all.n' }), T('R2 USD/JPY 2005-09', 'r2.all.t', { nPath: 'r2.all.n' })] },
  { row: 72, pr: 890, branch: 'crypto-weekend-reversal', topic: 'crypto-weekend-reversal', window: 'decisive', what: 'month t, five tests (Holm over 5)',
    tests: () => ['T1-BTC', 'T1-ETH', 'T2-BTC', 'T2-ETH', 'POOL'].map((k) => T(k, `tests.${k}.all.tMonth`, { nPath: `tests.${k}.all.n` })) },
  { row: 73, pr: 891, branch: 'index-overnight', topic: 'index-overnight', window: 'decisive 2016 →', what: 'month-sum t, T1 and T2 (Holm over 2; T3 a control)',
    tests: () => ['T1', 'T2'].map((k) => T(k, `tests.${k}.decisive.t`, { nPath: `tests.${k}.decisive.n` })) },
  { row: 74, pr: 892, branch: 'tsmom', topic: 'tsmom', window: 'decisive 2016 →', what: 'month t, five tests (Holm over 5)',
    tests: () => ['T1', 'T2', 'T3', 'T4', 'T5'].map((k) => T(k, `tests.${k}.decisive.t`)) },
  { row: 75, pr: 893, branch: 'gotobi-cost', topic: 'gotobi-cost', role: 'excluded', why: 'cost accounting, no rule tested' },
  { row: 76, pr: 894, branch: 'gotobi-feed', topic: 'gotobi-feed', role: 'replication', of: 878, window: 'HistData USD/JPY 2018-26', what: 'month t on the independent feed',
    tests: () => [T('HistData USD/JPY', 'hist.all.t', { nPath: 'hist.all.n' })] },
  { row: 77, pr: 895, branch: 'index-ibs', topic: 'index-ibs', window: 'decisive 2016 →', what: 'month t, three tests (Holm over 3)',
    tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.decisive.monthT`, { nPath: `tests.${k}.decisive.n` })) },
  { row: 78, pr: 896, branch: 'ecb-boj-days', topic: 'ecb-boj-days', window: 'decisive', what: 'month t, ECB and BoJ (Holm over 2)',
    tests: () => [T('ECB EUR/USD', 'tests.0.monthT', { nPath: 'tests.0.n' }), T('BoJ USD/JPY', 'tests.1.monthT', { nPath: 'tests.1.n' })] },
  { row: 79, pr: 897, branch: 'yen-spread-log', topic: null, role: 'excluded', why: 'build (spread log), not a study' },
  { row: 80, pr: 898, branch: 'index-weekend-gap', topic: 'index-weekend-gap', window: 'decisive 2016 →', what: 'month t, T1-T3 and pooled',
    tests: () => ['T1', 'T2', 'T3', 'P'].map((k) => T(k, `tests.${k}.dec.tMonth`, { nPath: `tests.${k}.dec.n` })) },
  { row: 81, pr: 899, branch: 'commodity-fx-lead', topic: 'commodity-fx-lead', window: 'decisive', what: 'month-sum t, T1 and T2 (Holm over 2; pooled not in the family)',
    tests: () => ['T1', 'T2'].map((k) => T(k, `tests.${k}.decisive.t`, { nPath: `tests.${k}.decisive.n` })) },
];

const rows = [];
for (const s of STUDIES) {
  const base = { row: s.row, pr: s.pr, branch: s.branch, topic: s.topic, role: s.role || 'family' };
  if (base.role === 'excluded') { rows.push({ ...base, why: s.why, tests: [] }); continue; }
  const j = show(s.branch, s.topic);
  const tests = [];
  for (const x of s.tests(j)) {
    const r = { test: x.test, kind: null, t: null, p: null, n: null, path: x.path || null };
    if (x.path) { const v = get(j, x.path); if (typeof v === 'number') { r.t = v; r.kind = 't'; } }
    else if (x.tRaw != null) { r.t = x.tRaw; r.kind = 't'; r.path = x.src; }
    else if (x.pPath) { const v = get(j, x.pPath); if (typeof v === 'number') { r.p = v; r.kind = 'p'; r.path = x.pPath; } }
    else if (x.pFromP) { const v = get(j, x.pFromP); if (typeof v === 'number') { r.p = 1 - v; r.kind = 'p'; r.path = `1 - ${x.pFromP}`; } }
    else if (x.pRaw != null) { r.p = x.pRaw; r.kind = 'p'; r.path = `${x.src}: ${x.note}`; }
    const n = x.nRaw != null ? x.nRaw : x.nPath ? get(j, x.nPath) : null;
    r.n = typeof n === 'number' ? n : null;
    if (r.kind == null) r.why = 'no t or p stored for this test (not computed: too few blocked trades)';
    tests.push(r);
  }
  rows.push({ ...base, of: s.of, window: s.window, what: s.what, verdict: typeof j.verdict === 'string' ? j.verdict.slice(0, 120) : JSON.stringify(j.verdict), tests });
}
const out = { built: '2026-11-14', source: 'research/proposals/2026-11-13-research-day.md on branch research-day-13nov; each study read from origin/<branch>', rows };
writeFileSync(join(HERE, 'inputs.json'), JSON.stringify(out, null, 1) + '\n');
console.log(rows.length, 'rows,', rows.reduce((a, r) => a + r.tests.length, 0), 'tests');
for (const r of rows) for (const t of r.tests) if (t.kind == null) console.log('unparsed', r.pr, t.test);
