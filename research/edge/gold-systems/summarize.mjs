// Builds result.json from replica.json, mosha.json and daily.json (the outputs of replica.mjs, mosha.mjs, daily.mjs).
// Usage: OUT_DIR=<folder with the three outputs> node summarize.mjs > result.json
import fs from 'node:fs';
const OUT = process.env.OUT_DIR || '.';
const rd = (f) => JSON.parse(fs.readFileSync(`${OUT}/${f}`, 'utf8'));
const R = rd('replica.json'), M = rd('mosha.json'), D = rd('daily.json');
const pick = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const yrs = (v) => Object.fromEntries(Object.entries(v.years).map(([y, s]) => [y, { n: s.n, R: s.R }]));
const sys = (v) => ({ is: pick(v.is), oos: pick(v.oos), oosGross: pick(v.oosGross), years: yrs(v), oosYearsPositive: v.oosYearsPos });
const verdict = (base, c) => {
  const oos = c.oos, okN = oos.n >= 100, okE = oos.exp > 0, better = oos.R > base.oos.R && oos.exp >= base.oos.exp, yrsOk = c.oosYearsPos >= 2, isPick = c.is.exp > base.is.exp;
  return okN && okE && better && yrsOk && isPick ? 'PASS' : `FAIL (${[!isPick && 'worse in-sample than the live gate, so a walk-forward choice keeps the live gate', !okN && 'OOS n < 100', !okE && 'OOS expectancy <= 0', !better && 'does not beat the live gate OOS', !yrsOk && 'positive in < 2 of 3 OOS years'].filter(Boolean).join('; ')})`;
};
const base = R.variants.live;
const out = {
  topic: 'gold-systems',
  system: 'MERIDIAN council gold book: gold replica (live config), Mosha BO (weekly), Gold daily engulf, Gold trend N20/N5, Gold H4 trendline',
  baseline: { rule: 'gold replica, live config (goldVolPct 80, goldD1With, BE +2R, add +1.5R, run after +4R trail 1R, MSNR size 1.5/0.5, risk rules, news veto)', is: pick(base.is), oos: pick(base.oos) },
  candidates: ['gate_p67', 'gate_p50', 'gate_none', 'gate_fix15', 'gate_p80or15'].map((k) => {
    const v = R.variants[k];
    return { rule: `replica volatility gate = ${k.replace('gate_', '')} (everything else live)`, is: pick(v.is), oos: pick(v.oos), years: yrs(v), verdict: verdict(base, v) };
  }),
  systems: {
    replica_live: sys(base),
    replica_noMsnrSize: sys(R.variants.live_noMsnrSize),
    replica_v5_d1_unfiltered_units: sys(R.variants.v5_d1_unfiltered),
    mosha_live: sys(M.variants.live),
    mosha_weekly_3R_approved: sys(M.variants.weekly_3R),
    mosha_weekly_slow_3R: sys(M.variants.weekly_slow_3R),
    mosha_weekly_live_noSlow: sys(M.variants.weekly_live_noSlow),
    mosha_fast_arrivals_3R: sys(M.variants.weekly_fast_3R),
    gold_trend_N20_add: sys(D.variants.trend_N20_add),
    gold_trend_N20_noAdd: sys(D.variants.trend_N20_noAdd),
    gold_trend_N5_add: sys(D.variants.trend_N5_add),
    gold_trend_N5_noAdd: sys(D.variants.trend_N5_noAdd),
    gold_h4_trendline_live: sys(D.variants.tl_live),
    gold_h4_trendline_noDir: sys(D.variants.tl_noDir),
    gold_daily_engulf_live: sys(D.variants.eg_live),
    gold_daily_engulf_noSma: sys(D.variants.eg_noSma),
  },
  replicaVolBuckets: R.volBuckets,
  gateNow: R.gateNow,
  gateOpenDays: R.gateOpenDays,
  variantsTried: Object.keys(R.variants).length + Object.keys(M.variants).length + Object.keys(D.variants).length,
  notes: 'Spot gold HistData M1 2018-01 to 2026-10-30 (NY local time -> UTC). In-sample 2018-2023, out-of-sample 2024-2026. Costs 0.30 $/round trip per unit (council/backtest.mjs spreadOf for spot). Stats per position (first unit + add, sized), R net of costs; maxDD on the closed-trade equity curve. The 2024-26 window was used to design most of these rules (approvals judged on 2023+), so it is not a clean out-of-sample for them; 2018-2022 is the less-contaminated check.',
};
console.log(JSON.stringify(out, null, 1));
