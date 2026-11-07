// Builds result.json from out/sim-m30.json (primary stream) and out/sim-clean.json (second stream) and out/history.json.
// Usage: node report.mjs
import fs from 'node:fs';
const rd = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const A = rd('./out/sim-m30.json'), B = rd('./out/sim-clean.json'), H = rd('./out/history.json');
const pick = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const find = (R, code) => R.results.find((x) => x.name.split(' ')[0] === code);
const base = find(A, 'C1'), baseB = find(B, 'C1');
const candidates = A.results.filter((x) => x.name.split(' ')[0] !== 'C1').map((x) => {
  const code = x.name.split(' ')[0], y = find(B, code);
  const beatsA = x.oos.exp > base.oos.exp, beatsB = y.oos.exp > baseB.oos.exp, pos = x.oos.exp > 0 && y.oos.exp > 0;
  return { rule: x.name, desc: x.desc, is: pick(x.is), oos: pick(x.oos), oosGross: pick(x.oosGross),
    secondStream: { is: pick(y.is), oos: pick(y.oos) },
    years: Object.fromEntries(Object.entries(x.months).map(([m, s]) => [m, pick(s)])),
    randomThinning: x.random, churn: { all: x.churnAll, oos: x.churnOOS }, churnSecondStream: y.churnAll,
    verdict: pos && beatsA && beatsB ? 'PASS' : `FAIL (${!pos ? 'OOS expectancy not > 0' : 'does not beat the coded Coach on both streams'}${beatsA && beatsB ? '; beats the coded Coach OOS on both streams' : ''})` };
});
const out = {
  topic: 'coach-learning',
  system: 'MERIDIAN council Coach (council/trader.mjs learnFilters / rule drop + 21-day re-test / learnFromBacktest / learnPauses / minRR), walk-forward over the 150-day engine replays',
  streams: { primary: { file: 'council-data research/backtest-150d-m30.json', window: A.window, eval: A.eval }, second: { file: 'council-data research/backtest-150d-clean.json', window: B.window, eval: B.eval } },
  baseline: { rule: base.name, is: pick(base.is), oos: pick(base.oos), secondStream: { is: pick(baseB.is), oos: pick(baseB.oos) }, churn: base.churnAll, churnSecondStream: baseB.churnAll },
  frozenNoRules: { is: pick(find(A, 'F0').is), oos: pick(find(A, 'F0').oos), secondStream: { is: pick(find(B, 'F0').is), oos: pick(find(B, 'F0').oos) } },
  candidates,
  liveHistory: { configCommits: H.commits, from: H.first, to: H.last, changes: H.events.length, flips: H.flips },
  variantsTried: 16 * 2,
  notes: [
    'Stats are net of the per-trade spread (R - cost), trades of DEF_KEYS setups only (scalp, rscalp, intraday, rintra, swing, position, rswing, m30m1), portfolio limits ignored.',
    'Evaluation starts after a 30-day warm-up; IS = first 2/3 of the evaluation window, OOS = last 1/3. "years" holds calendar months (the stream is 150 days).',
    'Every learner trades a subset of a stream that loses ~-0.19R a trade, so total R mostly measures how much a variant stops trading. Per-trade expectancy against random thinning (randomThinning.pct = share of 300 random same-size subsets it beats) is the selection test.',
    'F1 (frozen, picked on IS with n>=30, t>=2, both halves) selected no rule at all, so it equals F0.',
    'Not simulated: minRisk/buf (stop width), review lessons (hunt/noise/late/news), dollar cap/exposure, market pauses, second target and market entry.',
  ],
};
fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('baseline', JSON.stringify(out.baseline.oos));
for (const c of candidates) console.log(c.rule.padEnd(55), 'OOS', c.oos.exp, '| 2nd', c.secondStream.oos.exp, '|', c.verdict);
