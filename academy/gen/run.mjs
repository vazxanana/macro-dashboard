// MeridianX Academy: generate the edge candidates, their outcomes and the data-quality report.
//
//   git fetch origin council-data
//   mkdir -p /tmp/academy-candles                          # OUTSIDE the repo: candles are never committed
//   git archive origin/council-data research/candles/xau-histdata research/candles/nsxusd-histdata | tar -x -C /tmp/academy-candles
//   ACADEMY_CANDLES=/tmp/academy-candles node academy/gen/run.mjs            # all seven edges, about a minute
//   node academy/gen/run.mjs --versions                                      # print the version pins for academy/edges.mjs
//
// Optional: ACADEMY_SCRATCH (caches and the studies' own output files; default <candles>/academy-scratch),
//           ACADEMY_CANDLES_REF (the council-data commit the candles came from, recorded in meta.json).
// Writes academy/data/cand-<edge>.json, out-<edge>.json, quality.json and meta.json. Every generator stops with an error
// when its trades do not reproduce the study's published numbers, so a file that is written is the study's own result.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DATA_DIR, computeVersion, grabFunction, writeJson, iso, scanRaw } from './study.mjs';
import { EDGES, EVAL_FROM } from '../edges.mjs';
import { summarize, CALENDARS, THRESHOLDS, usEuDstMismatch, nyClock } from '../quality.mjs';

const versions = Object.fromEntries(EDGES.map((e) => [e.id, computeVersion(e.ruleSource)]));
if (process.argv.includes('--versions')) { console.log(JSON.stringify(versions, null, 1)); process.exit(0); }
if (EDGES.some((e) => e.version !== versions[e.id])) { console.error('The rule files changed. Pin these versions in academy/edges.mjs (VERSIONS) and run again:\n' + JSON.stringify(versions, null, 1)); process.exit(1); }

const CANDLES = process.env.ACADEMY_CANDLES;
if (!CANDLES || !fs.existsSync(path.join(CANDLES, 'research/candles/xau-histdata'))) { console.error('Set ACADEMY_CANDLES to the folder that holds research/candles/xau-histdata and nsxusd-histdata (see the top of this file).'); process.exit(1); }
if (!path.relative(ROOT, path.resolve(CANDLES)).startsWith('..')) { console.error('ACADEMY_CANDLES must be outside the repository: candles are never committed.'); process.exit(1); }
const SCRATCH = process.env.ACADEMY_SCRATCH || path.join(CANDLES, 'academy-scratch'); fs.mkdirSync(SCRATCH, { recursive: true });
const XAU = path.join(CANDLES, 'research/candles/xau-histdata'), NSX = path.join(CANDLES, 'research/candles/nsxusd-histdata');
// what the study modules read from the environment (gold-systems/data.mjs, the study scripts, robustness/lib.mjs)
Object.assign(process.env, { GOLD_DIR: XAU, GOLD_CACHE: path.join(SCRATCH, 'xau_m1.bin'), OUT_DIR: SCRATCH, ROB_DATA: CANDLES });

// ── 1. the edges (each generator proves its trades against the study's published numbers) ──
const log = console.error; console.error = () => {};   // the studies print every variant: keep the run readable
const results = {};
const gold = await (await import('./gold.mjs')).generateGold(); Object.assign(results, gold.edges);
results.gmp = await (await import('./gmp.mjs')).generateGmp();
results['nq-open'] = (await import('./nq.mjs')).generateNq(NSX);
console.error = log;

// ── 2. data quality of the series the studies read: M1 aggregated to H1 in UTC buckets ──
const bar = (b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close });
const slim = (q) => ({ status: q.status, coverage: q.coverage, bars: q.bars, expected: q.expected, missing: q.missing, maxGapHours: +(q.maxGapSec / 3600).toFixed(2), span: q.span, counts: q.counts, worstGaps: q.worstGaps, clockShift: q.clockShift, byYear: q.byYear });
const quality = { thresholds: THRESHOLDS, clock: null, markets: {} };
quality.markets.xau = { source: 'HistData XAUUSD M1 (council-data research/candles/xau-histdata), labels read as New York time and converted to UTC, aggregated to H1', tf: '1h', calendar: CALENDARS.xau.name,
  usedBy: ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp'], rawM1: scanRaw(XAU), ...slim(summarize(gold.h1.map(bar), { tfSec: 3600, calendar: 'xau', now: gold.m1End })) };
{ const lib = await import('../../research/edge/robustness/lib.mjs'), A = lib.loadM1('nsxusd-histdata'), H = lib.aggregate(A, 3600).map(bar);
  const { loadHistData } = await import('../../research/edge/nq-open-oos/load.mjs');
  const M = []; for (const [, a] of loadHistData(NSX)) for (const b of a) if (b.m >= 570 && b.m < 660) M.push(bar(b));
  quality.markets.nas100 = { source: 'HistData NSXUSD M1 (council-data research/candles/nsxusd-histdata), labels read as New York time and converted to UTC, aggregated to H1', tf: '1h', calendar: CALENDARS['nas100-histdata'].name,
    usedBy: ['nq-open'], rawM1: scanRaw(NSX), ...slim(summarize(H, { tfSec: 3600, calendar: 'nas100-histdata', now: A.t[A.n - 1] + 60 })),
    openWindow: { what: 'the 1-minute candles the open-run rule reads: 09:30-11:00 New York on trading days', tf: '1m', calendar: CALENDARS['ny-open-window'].name, ...slim(summarize(M, { tfSec: 60, calendar: 'ny-open-window', now: Infinity })) } }; }

// ── 3. the clock finding: tag the candidates that sit in a week the session-alignment check found shifted ──
// The check finds whole weeks whose daily break is one hour early, all of them inside the weeks when New York is on daylight
// time and Europe is not. A candidate is tagged when it lies in such a mismatch week of a YEAR in which the check found the
// shift for its market (the 2018 files show none: they are on the New York clock).
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
const shiftYears = Object.fromEntries(Object.entries(quality.markets).map(([k, q]) => [k, new Set(q.clockShift.map((x) => +x.week.slice(0, 4)))]));
for (const e of EDGES) for (const c of results[e.id].cands) if (usEuDstMismatch(c.t) && shiftYears[e.market].has(yearOf(c.t))) c.rule.clockShift = true;
{ const ruleWeeks = new Set(), sp = quality.markets.xau.span;
  for (let t = Math.floor(sp.from / 86400) * 86400 + 43200; t <= sp.to; t += 86400) { const c = nyClock(t); if (c.dow >= 1 && c.dow <= 4 && usEuDstMismatch(t)) ruleWeeks.add(new Date((t - (c.dow - 1) * 86400) * 1000).toISOString().slice(0, 10)); }
  const det = (k) => quality.markets[k].clockShift.map((x) => x.week), mk = (f) => ({ xau: f('xau'), nas100: f('nas100') });
  quality.clock = {
    finding: 'From 2019 on, the HistData files are stamped on a clock that changes with Europe\'s daylight-saving dates, and the studies read the labels as New York wall-clock time. The two agree except while New York is on daylight time and Europe is not: from the second Sunday of March to the last Sunday of March, and from the last Sunday of October to the first Sunday of November. In those weeks every bar time the studies used is one hour EARLY. The 2018 files show no shift.',
    evidence: {
      check: 'clock-shift (academy/quality.mjs): a week in which, on at least 3 of Monday-Thursday, the daily break sits one hour before its New York time',
      mismatchWeeksInSpan: ruleWeeks.size, weeksDetected: mk((k) => det(k).length), detectedOutsideMismatchWeeks: mk((k) => det(k).filter((w) => !ruleWeeks.has(w))),
      mismatchWeeksNotDetected: mk((k) => [...ruleWeeks].filter((w) => !det(k).includes(w))),
      notDetectedNote: 'the three 2018 weeks keep the break at 17:00 New York (no shift); the 2023 and 2024 weeks listed have too few complete days for the weekly check',
      yearsWithShift: mk((k) => [...shiftYears[k]].sort()),
      repeatedHourDays: quality.markets.xau.rawM1.repeatedHourDays,
      repeatedHourNote: 'days whose raw gold file repeats one whole hour of minute labels (the file\'s clock going back): each is the last Sunday of October, the European change, not the first Sunday of November',
    },
    crossCheck: (() => { const f = path.join(DATA_DIR, 'clock-check.json'); if (!fs.existsSync(f)) return null; const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const want = (w) => (w.mismatchWeek && +w.week.slice(0, 4) >= 2019 ? 3600 : 0);
      return { file: 'academy/data/clock-check.json', checked: j.checked, feed: j.feed, weeks: j.weeks.length, weeksOneHourEarly: j.weeks.filter((w) => w.studyClockEarlySec === 3600).length, agreesWithTheTags: j.weeks.every((w) => w.studyClockEarlySec === want(w)) }; })(),
    effect: 'The candidates and outcomes are exactly what the studies produced, so they keep the studies\' times. A candidate inside those weeks carries rule.clockShift = true: its t is one hour early against a correctly stamped feed, and a rule that reads the clock (the 09:30 New York open, the 07:00-17:00 UTC window, the news veto, the daily and H4 buckets) looked at the wrong hour. Leave these candidates out of anything replayed on another feed and out of exam scoring until the studies are re-run on a corrected clock.',
    flagged: Object.fromEntries(EDGES.map((e) => [e.id, results[e.id].cands.filter((c) => c.rule.clockShift).length])),
  }; }

// ── 4. write ──
const meta = { generated: new Date().toISOString().slice(0, 10), candles: { branch: 'council-data', ref: process.env.ACADEMY_CANDLES_REF || null, dirs: ['research/candles/xau-histdata', 'research/candles/nsxusd-histdata'] }, evalFrom: EVAL_FROM, edges: {} };
for (const e of EDGES) {
  const r = results[e.id]; if (!r) throw new Error('no result for ' + e.id);
  writeJson(`cand-${e.id}.json`, r.cands); writeJson(`out-${e.id}.json`, r.outs);
  const c = r.cands, filled = c.filter((x) => !['missed', 'expired', 'cancelled'].includes(r.outs[x.id].reason));
  const avg = (a) => (a.length ? +(a.reduce((s, x) => s + r.outs[x.id].netR, 0) / a.length).toFixed(3) : null), cnt = (f) => c.filter(f).length;
  const since = filled.filter((x) => x.t >= EVAL_FROM), clean = since.filter((x) => !x.rule.clockShift);
  meta.edges[e.id] = { version: e.version, candidates: c.length, filled: filled.length, from: c[0].t, to: c.at(-1).t,
    train: cnt((x) => x.pool === 'train'), exam: cnt((x) => x.pool === 'exam'), pre2020: cnt((x) => x.rule.pre2020), clockShift: cnt((x) => x.rule.clockShift),
    study: { path: e.study.path, variant: e.study.variant, n: e.study.n, netR: e.study.netR }, reproduced: { n: r.repro.n, netR: r.repro.netR, sumNetR: r.repro.sumNetR },
    since2020: { n: since.length, netR: avg(since) }, since2020NoClockShift: { n: clean.length, netR: avg(clean) } };
  log(e.id.padEnd(9), 'candidates', String(c.length).padStart(5), 'filled', String(filled.length).padStart(5), iso(c[0].t), '->', iso(c.at(-1).t), 'train', meta.edges[e.id].train, 'exam', meta.edges[e.id].exam,
    'clockShift', meta.edges[e.id].clockShift, '| net R/trade', r.repro.netR, '(study', e.study.netR + ')');
}
// the council code the gold studies pull in at run time (research/edge/gold-systems/live.mjs): recorded, not part of `version`
{ const tsrc = fs.readFileSync(path.join(ROOT, 'council/trader.mjs'), 'utf8'), h = crypto.createHash('sha256');
  for (const n of ['platformEngulfs', 'goldLevels', 'replicaSignals', 'msnrDirection']) h.update(grabFunction(tsrc, n));
  h.update(fs.readFileSync(path.join(ROOT, 'council/engine.mjs')));
  meta.liveCode = { what: 'council/trader.mjs platformEngulfs, goldLevels, replicaSignals, msnrDirection + council/engine.mjs, as run for replica, mosha-bo and gtl', sha: h.digest('hex').slice(0, 12) }; }
fs.writeFileSync(path.join(DATA_DIR, 'quality.json'), JSON.stringify(quality, null, 1) + '\n');
fs.writeFileSync(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 1) + '\n');
for (const [k, q] of Object.entries(quality.markets)) log('quality', k, q.status, 'coverage', q.coverage, JSON.stringify(q.counts), q.openWindow ? `| open window ${q.openWindow.status} ${q.openWindow.coverage} ${JSON.stringify(q.openWindow.counts)}` : '');
