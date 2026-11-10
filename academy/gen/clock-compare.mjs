// Before -> after of the clock correction (10 Nov 2026), from the files alone: academy/archive/pre-clock/data (the Academy
// data as generated on the old clock, git 81f35f51) against academy/data (regenerated on council/histdata.mjs).
//
//   node academy/gen/clock-compare.mjs            prints the tables docs/academy/DATA-CLOCK.md quotes
//   node academy/gen/clock-compare.mjs --json     the same numbers as JSON
//
// "study" = every filled trade of the edge's source study, 2018 on (what the generator must reproduce exactly).
// "usable" = since 2020, not flagged (rule.clockShift, rule.pre2020), filled: what the Academy trains and tests on.
// "certified" = usable and inside a symbol-year that passed every pre-registered criterion of research/edge/histdata-clock.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './study.mjs';
import { EDGES, EVAL_FROM } from '../edges.mjs';

const AUDIT = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/histdata-clock/result.json'), 'utf8')), SYM = { xau: 'XAUUSD', nas100: 'NSXUSD' };
const certifiedYear = (market, t) => AUDIT.symbols[SYM[market]].years[new Date(t * 1000).getUTCFullYear()]?.status === 'CERTIFIED';
const NOFILL = new Set(['missed', 'expired', 'cancelled']);
const st = (R) => { const n = R.length; if (!n) return { n: 0, avg: null, sum: 0, t: null }; const sum = R.reduce((a, b) => a + b, 0), avg = sum / n, sd = n > 1 ? Math.sqrt(R.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;
  return { n, avg: +avg.toFixed(3), sum: +sum.toFixed(1), t: sd > 0 ? +(avg / (sd / Math.sqrt(n))).toFixed(2) : null }; };
function load(dir, e) {
  const cands = JSON.parse(fs.readFileSync(path.join(dir, `cand-${e.id}.json`), 'utf8')), outs = JSON.parse(fs.readFileSync(path.join(dir, `out-${e.id}.json`), 'utf8'));
  const rows = cands.map((c) => ({ t: c.t, pool: c.pool, flag: !!(c.rule.clockShift || c.rule.pre2020), shift: !!c.rule.clockShift, filled: !NOFILL.has(outs[c.id].reason), R: outs[c.id].netR, cert: certifiedYear(e.market, c.t) }));
  const filled = rows.filter((r) => r.filled), usable = filled.filter((r) => r.t >= EVAL_FROM && !r.flag), R = (a) => a.map((r) => r.R);
  const years = {}; for (const r of filled) (years[new Date(r.t * 1000).getUTCFullYear()] ||= []).push(r.R);
  return { candidates: rows.length, flagged: rows.filter((r) => r.shift).length, study: st(R(filled)), since2020: st(R(filled.filter((r) => r.t >= EVAL_FROM))), usable: st(R(usable)), certified: st(R(usable.filter((r) => r.cert))),
    train: rows.filter((r) => r.t >= EVAL_FROM && !r.flag && r.pool === 'train').length, exam: rows.filter((r) => r.t >= EVAL_FROM && !r.flag && r.pool === 'exam').length,
    trainFilled: st(R(usable.filter((r) => r.pool === 'train'))), byYear: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, st(a)])) };
}
const OLD = path.join(ROOT, 'academy/archive/pre-clock/data'), NEW = path.join(ROOT, 'academy/data');
const out = Object.fromEntries(EDGES.map((e) => [e.id, { before: load(OLD, e), after: load(NEW, e) }]));
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
const f = (s) => (s.n ? `${s.n}, ${s.avg >= 0 ? '+' : ''}${s.avg.toFixed(3)}, ${s.sum >= 0 ? '+' : ''}${s.sum}, ${s.t ?? 'n/a'}` : '0');
console.log('| Edge | Study, all years: n, net R a trade, total R, t (before) | (after) | Usable since 2020 (before) | (after) | Certified years only (after) | Usable train / exam setups (before) | (after) | Flagged (before → after) |');
console.log('|---|---|---|---|---|---|---|---|---|');
const tot = { b: [0, 0], a: [0, 0], fb: 0, fa: 0 };
for (const e of EDGES) { const { before: b, after: a } = out[e.id]; tot.b[0] += b.train; tot.b[1] += b.exam; tot.a[0] += a.train; tot.a[1] += a.exam; tot.fb += b.flagged; tot.fa += a.flagged;
  console.log(`| ${e.id} | ${f(b.study)} | ${f(a.study)} | ${f(b.usable)} | ${f(a.usable)} | ${f(a.certified)} | ${b.train} / ${b.exam} | ${a.train} / ${a.exam} | ${b.flagged} → ${a.flagged} |`); }
console.log(`| all | | | | | | ${tot.b[0]} / ${tot.b[1]} | ${tot.a[0]} / ${tot.a[1]} | ${tot.fb} → ${tot.fa} |`);
console.log('\n| Edge | ' + [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].join(' | ') + ' |'); console.log('|---|' + '---|'.repeat(9));
for (const e of EDGES) for (const k of ['before', 'after']) console.log(`| ${e.id} ${k} | ` + [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => { const s = out[e.id][k].byYear[y]; return s ? `${s.n}, ${s.sum >= 0 ? '+' : ''}${s.sum}` : '0'; }).join(' | ') + ' |');
