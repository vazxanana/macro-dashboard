// Builds result.json (edge-research schema) from analyse.mjs output. Usage: node build-result.mjs <analysis.json> <analysis-stress2.json> <out>
import fs from 'node:fs';
const [a, s2] = [process.argv[2], process.argv[3]].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const pick = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t });
const cands = [];
for (const [k, v] of Object.entries(a.filters)) {
  if (!v.selectedIS && !/NY PM|London/.test(v.rule)) continue;
  cands.push({ rule: `${v.pop === 'A' ? 'A-setups' : 'all graded signals'}: ${v.rule}`, is: pick(v.is), oos: pick(v.oos), years: v.years,
    droppedPart: { is: pick(v.dropped.is), oos: pick(v.dropped.oos) }, oosAt2xCost: pick(s2.filters[k].oos), chosenInSample: v.selectedIS,
    verdict: v.selectedIS && v.passesOOS ? 'PASS (weak)' : v.selectedIS ? 'FAIL OOS' : v.passesOOS ? 'not chosen in-sample (IS says the opposite) - hindsight only' : 'not chosen in-sample; fails OOS' });
}
for (const [pop, c] of Object.entries(a.combos)) cands.push({ rule: `${pop === 'A' ? 'A-setups' : 'all graded signals'}: greedy IS combo [${c.rules.join(' + ')}]`, is: pick(c.is), oos: pick(c.oos), years: c.years, chosenInSample: true, verdict: c.passesOOS ? 'PASS' : 'FAIL OOS' });
const out = { topic: 'ict-filters', system: 'ICT desk H1 iFVG reversal (ict/tracker.mjs signals + ict/replay.mjs simulate, post-#413) on HistData NSXUSD/SPXUSD/XAUUSD M1 2018 - Oct 2026 as NQ/ES/GC',
  baseline: { A: { is: pick(a.baseline.A.is), oos: pick(a.baseline.A.oos) }, ALL: { is: pick(a.baseline.ALL.is), oos: pick(a.baseline.ALL.oos) } },
  candidates: cands, variantsTried: a.variantsTried,
  sessions: Object.fromEntries(Object.entries(a.specific).map(([k, v]) => [k, v.is ? { is: pick(v.is), oos: pick(v.oos), years: v.years } : pick(v)])),
  notes: 'IS = 2018-2023, OOS = 2024 - Oct 2026. Net of 2 ticks a round trip (NQ/ES 0.5 pt, GC 0.2); oosAt2xCost doubles it. R per unit (A-setup sizing ignored for the filter study). One open trade per market among the filtered signals. Index A-rule was designed on 2023-26 cash indices and the gold rule on 2019-26 spot gold, so the A baseline itself is not out-of-sample; only the filters on top of it are walk-forward. YM/RTY have no pre-2023 history and are not included.' };
fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 1));
