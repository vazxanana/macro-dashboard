// Collects out/*.json into result.json (preamble schema) and prints the deflated-Sharpe table.
// Usage: node report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { deflatedSharpe, stats, yearOf } from './lib.mjs';
const here = path.dirname(new URL(import.meta.url).pathname), O = (f) => { try { return JSON.parse(fs.readFileSync(path.join(here, 'out', f + '.json'))); } catch (e) { return null; } };
const pick = (s) => s ? { n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t } : null;
const yrsPos = (S) => { const ys = Object.entries(S.years || {}).filter(([y]) => +y >= 2024); return `${ys.filter(([, s]) => s.R > 0).length}/${ys.length}`; };
const N_TRIALS = [1, 100, 424];   // 1 = no adjustment; 100 ≈ distinct rule families in research/log.md; 424 = result lines in the log
const dsr = (R) => Object.fromEntries(N_TRIALS.map((N) => [N, deflatedSharpe(R, N)?.dsr ?? null]));
const C = [];
const add = (rule, sys, S, trades, extra) => { if (!S) return; C.push({ rule, system: sys, is: pick(S.is), oos: pick(S.oos), w1922: pick(S.w1922), w2324: pick(S.w2324), w2526: pick(S.w2526),
  years: Object.fromEntries(Object.entries(S.years).map(([y, s]) => [y, pick(s)])), oosYearsPositive: yrsPos(S), dsrAll: trades ? dsr(trades.map((x) => x.R)) : null,
  dsrOos: trades ? dsr(trades.filter((x) => yearOf(x.t) >= 2024).map((x) => x.R)) : null, ...extra }); };
const g = O('gtrend'); if (g) { add('Gold trend N20 (+add)', 'council gold', g.gtrend20.live, g.trades.gtrend20, { flip: pick(g.gtrend20.flip.all), random: g.gtrend20.randomLong, randomWin: g.gtrend20.randomLongWin });
  add('Gold trend fast N5 (+add)', 'council gold', g.gtrend5.live, g.trades.gtrend5, { flip: pick(g.gtrend5.flip.all), random: g.gtrend5.randomLong, randomWin: g.gtrend5.randomLongWin }); }
const e = O('geg'); if (e) add('Gold daily engulf', 'council gold', e.live, e.trades, { flip: pick(e.flip.all), random: e.randomLong, noSma: pick(e.noSma.all) });
const t = O('gtl'); if (t) add('Gold H4 trendline', 'council gold', t.live, t.trades, { flip: pick(t.flip.all), random: t.randomLong, noDir: pick(t.noDir.all) });
const q = O('nq'); if (q) add('NQ New York open run', 'council NQ', q.live, q.trades, { flip: pick(q.flip.all), random: q.random, noNdo: pick(q.noNdo.all) });
const c = O('crypto'); if (c) add('Crypto trend v3 (+add)', 'council crypto', c.live, c.trades, { flip: pick(c.flip.all), random: c.randomLong });
const m = O('gmp'); if (m) add('Gold momentum pullback (test)', 'council gold', m.live, m.trades, { flip: pick(m.flip.all), random: m.random, cost30: pick(m.cost30.all) });
const b = O('mosha'); if (b) add('Mosha BO (weekly, slow, add/run)', 'council gold', b.live, b.trades, { flip: pick(b.flip.all), random: b.random, m15only: pick(b.m15only.all) });
const r = O('replica'); if (r) C.push({ rule: 'Gold replica (2023+ replay records only)', system: 'council gold', recorded: r.recorded.all, w2324: pick(r.recorded.w2324), w2526: pick(r.recorded.w2526), plainExit: pick(r.plainExit.all), plainFlip: pick(r.plainFlip.all), random: r.randomSameRegime, randomSide: r.randomSideSameRegime, top10pctShare: r.top10pctShare, dsrAll: (() => { const R = JSON.parse(fs.readFileSync(path.join(process.env.ROB_DATA || '', 'research/replay-2w.json'))).trades.filter((x) => x.k === 'replica' && x.R != null).map((x) => x.R); return dsr(R); })() });
const i = O('ict'); if (i) for (const k of ['nq', 'gc']) if (i[k]) add(`ICT A-setups ${k.toUpperCase()} (HistData 2018-26, net)`, 'ICT desk', i[k].aset, i[k].trades, { flip: pick(i[k].asetFlip.all), random: i[k].random, allSignals: pick(i[k].all.all), gross: i[k].asetGross });
const V = { 'Gold trend N20 (+add)': 'fragile', 'Gold trend fast N5 (+add)': 'fragile', 'Gold daily engulf': 'not supported', 'Gold H4 trendline': 'fragile', 'NQ New York open run': 'fragile', 'Crypto trend v3 (+add)': 'fragile', 'Gold momentum pullback (test)': 'fragile', 'Mosha BO (weekly, slow, add/run)': 'not supported', 'Gold replica (2023+ replay records only)': 'fragile' };
for (const x of C) x.verdict = V[x.rule] || (x.rule.startsWith('ICT') ? 'fragile' : null);
C.push({ rule: 'Scalp against D1, not asia/overlap, not audusd (live)', system: 'council engine', verdict: 'not supported', note: 'council replays: 30d +0.161 n221 (all from 1-7 Nov); 150d -0.011 n915 / clean -0.027 n937; see scalp' });
C.push({ rule: 'coach-stats session/D1/min-stop toggles', system: 'council engine', verdict: 'not supported', note: 'n 5-31 per claim; repeated flip-flops, see coach' });
const out = { topic: 'robustness', system: 'council + ICT desk (all live paper rules)', baseline: { is: null, oos: null, note: 'per rule: random entries with the same exit geometry/exposure (see candidates[].random)' },
  candidates: C, scalp: O('scalp'), coach: O('coach') && { counts: O('coach').counts, repeatedKeys: O('coach').repeatedKeys }, ictDesk: i && i.deskReplay,
  variantsTried: { thisAudit: 'see RESULT.md', councilResearch: O('count') }, notes: 'IS = 2018/19-2023, OOS = 2024-Oct 2026 (preamble); the council itself chose most gold rules on 2023+, so 2019-22 is the untouched sample for those.' };
fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1));
for (const x of C) console.log(x.rule.padEnd(42), 'IS', JSON.stringify(x.is), 'OOS', JSON.stringify(x.oos), 'yrs+', x.oosYearsPositive, 'DSR', JSON.stringify(x.dsrAll), 'DSRoos', JSON.stringify(x.dsrOos), 'rnd', JSON.stringify(x.random));
