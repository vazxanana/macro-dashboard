// ICT A-setup book: does a book-level risk rule cut drawdown without cutting the edge? (edge research, 13 Nov 2026)
// Pre-registered in PREREGISTRATION.md (committed and pushed alone, before this file ran).
// Engine: the research lab's runMarket (api/_ictlab.js) = the desk's signals() / isASetup() / sizeOf() / P from ict/tracker.mjs and
// simulate() from ict/replay.mjs, imported read-only; one open trade per market; the lab's round-trip costs; live sizing.
// The book rules are in book.mjs (pure). Candles: OANDA mid H1 through the keyless proxy, cached OUTSIDE git.
//
//   node --use-env-proxy research/edge/ict-equal-lows/run.mjs fetch <cacheDir>   the candles: ict-equal-lows' own fetch stage
//   node research/edge/ict-book-risk/run.mjs full <cacheDir> [outDir]            the test: result.json + tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as B from './book.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [stage, CACHE = '/tmp/claude-0/ict-book-risk', OUT = HERE] = process.argv.slice(2);
const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = ts('2020-01-01'), OOS = ts('2024-01-01'), TO = ts('2026-11-01'), END = ts('2026-11-10');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000', gc: 'xau' };
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// candles: the lab's own cleaning, as ict-equal-lows (positive prices, the 17:00 New York halt hour dropped, D1 = dailyNY)
function load(E) {
  const srcs = {};
  for (const [k, sym] of Object.entries(SYM)) {
    const raw = JSON.parse(fs.readFileSync(path.join(CACHE, `${sym}-1h.json`), 'utf8')), sha = crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 16);
    const H = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))
      .filter((b) => [b.open, b.high, b.low, b.close, b.time].every((v) => isFinite(v) && v > 0) && !E.inHalt(b.time))
      .map((b) => ({ time: b.time, open: +b.open, high: Math.max(b.high, b.open, b.close), low: Math.min(b.low, b.open, b.close), close: +b.close }));
    srcs[k] = { H, D: E.dailyNY(H).filter((b) => b.time + 86400 <= END), index: new Map(H.map((b, i) => [b.time, i])), src: `OANDA ${sym} H1 (mid)`, sha };
  }
  return srcs;
}

async function full() {
  const lab = require('../../../api/_ictlab.js'), E = await lab.engine(), srcs = load(E), meta = {};
  const asIs = [];
  for (const k of B.ORDER) {
    const r = lab.runMarket(E, lab.marketOf(k, E), srcs[k], { from: FROM, to: TO, at: END, rule: 'A', filters: {}, params: {}, sizing: 'live', costOn: true });
    const done = r.trades.filter((t) => t.R != null);
    meta[k] = { open: r.trades.length - done.length, gaps: r.gaps };
    for (const t of done) asIs.push({ id: t.id, market: k, side: t.side, t: t.t, closed: Date.parse(t.closed) / 1000, R: t.R, grade: t.grade, size: t.size });
  }
  const days = B.tradingDays(FROM, END), rules = {
    R1: ['One position per same-side index cluster (first signal wins; gold apart)', B.r1Cluster(asIs)],
    R2: ['Daily loss stop: no new entry after -2R closed that New York trading day', B.r2DayStop(asIs)],
    R3: ['At most 2 open positions in the book', B.r3OpenCap(asIs)],
    R4: ['Inverse-volatility weight per market (60 trading days of daily R, mean weight 1, clipped 1/3 to 3)', B.r4InvVol(asIs, days)],
  };
  const halves = (tr) => ({ all: B.measure(tr, FROM), is: B.measure(tr.filter((x) => x.t < OOS), FROM), oos: B.measure(tr.filter((x) => x.t >= OOS), OOS),
    years: Object.fromEntries(YEARS.map((y) => { const a = tr.filter((x) => new Date(x.t * 1000).getUTCFullYear() === y); return [y, { n: a.length, R: +a.reduce((s, x) => s + x.R, 0).toFixed(2) }]; })) });
  const base = halves(asIs), months = B.monthsBetween(FROM, TO);
  const rows = Object.entries(rules).map(([id, [name, r]]) => ({ id, name, m: halves(r.taken), skipped: r.skipped.length, skippedR: +r.skipped.reduce((s, x) => s + x.R, 0).toFixed(2),
    pBetter: B.bootstrap(asIs, r.taken, months), weights: id === 'R4' ? (() => { const w = r.taken.map((x) => x.w).sort((a, b) => a - b); return { min: w[0], median: w[w.length >> 1], max: w.at(-1), clippedLow: w.filter((v) => v <= B.P.wMin + 1e-6).length, clippedHigh: w.filter((v) => v >= B.P.wMax - 1e-6).length }; })() : undefined }));
  const adj = B.holm(rows.map((r) => 1 - r.pBetter));
  rows.forEach((r, i) => { r.holmP = adj[i]; Object.assign(r, B.judge(base, r.m, r.pBetter, r.holmP)); });

  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const passes = rows.filter((r) => r.verdict === 'PASS');
  const verdict = passes.length ? `PASS for ${passes.map((r) => r.id).join(', ')}; the other ${rows.length - passes.length} do not pass`
    : `FAIL. None of the ${rows.length} pre-registered book rules passes; the A-setup book stays sized as it is`;
  const result = {
    topic: 'ict-book-risk', built: '2026-11-13',
    system: 'ICT desk A-setup book (NQ, ES, YM, RTY, GC pooled): four book-level risk rules against the book as the desk runs it. Lab engine api/_ictlab.js runMarket (the desk\'s signals / isASetup / sizeOf / simulate) on OANDA mid H1: NAS100, SPX500, US30, US2000, XAU',
    preregistered: 'PREREGISTRATION.md (committed and pushed alone before run.mjs ran)', planSha256: sha,
    window: { from: day(FROM), to: day(TO - 1), is: `${day(FROM)} to ${day(OOS - 1)}`, oos: `${day(OOS)} to ${day(TO - 1)}`, candlesTo: day(END - 1) },
    sources: Object.fromEntries(B.ORDER.map((k) => [k, { src: srcs[k].src, h1: srcs[k].H.length, sha256: srcs[k].sha, unresolved: meta[k].open, gaps: meta[k].gaps }])),
    costs: 'lab COST round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5; net R = size x (R - cost / risk); live sizing (sizeOf)',
    params: B.P, testsJudged: rows.length, multipleTesting: 'Holm over the 4 rules on p = 1 - P(better) of the paired monthly block bootstrap, alpha 0.10',
    verdict,
    baseline: base,
    candidates: rows.map((r) => ({ rule: `${r.id}: ${r.name}`, test: r.id, verdict: r.verdict, checks: r.checks, is: r.m.is, oos: r.m.oos, all: r.m.all, years: r.m.years,
      skipped: r.skipped, skippedR: r.skippedR, bootstrap: { pBetter: r.pBetter, draws: B.P.draws, seed: B.P.seed, holmP: r.holmP }, weights: r.weights })),
    notes: 'Pre-registered (sha256 above). IS = entries 2020-23, OOS = entries 2024-01-01 to 2026-10-31. OANDA cash CFDs stand in for the futures the desk trades. A rule only skips a trade or scales its size; every trade keeps the engine\'s own stop. Paper research: nothing under ict/ or the ICT rule book changes.',
  };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1) + '\n');

  const f = (x, d = 2) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(d));
  const L = [`plan sha256 ${sha}`, verdict, '', '| book | half | n | net R | R a trade | max DD | return / DD | monthly Sharpe | t |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [nm, m] of [['as is', base], ...rows.map((r) => [r.id, r.m])]) for (const w of ['is', 'oos']) { const s = m[w]; L.push(`| ${nm} | ${w.toUpperCase()} | ${s.n} | ${f(s.R, 1)} | ${f(s.exp, 3)} | ${s.maxDD.toFixed(1)} | ${s.rdd ?? '-'} | ${s.sharpe ?? '-'} | ${s.t ?? '-'} |`); }
  L.push('');
  for (const r of rows) L.push(`${r.id} ${r.verdict}: skipped ${r.skipped} (${f(r.skippedR, 1)}R as is), P(better) ${r.pBetter}, Holm p ${r.holmP}, checks ${JSON.stringify(r.checks)}${r.weights ? ', weights ' + JSON.stringify(r.weights) : ''}`);
  L.push('', 'sources: ' + B.ORDER.map((k) => `${k} ${srcs[k].H.length} H1 sha ${srcs[k].sha} unresolved ${meta[k].open} gaps ${meta[k].gaps}`).join('; '));
  console.log(L.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith(path.join('ict-book-risk', 'run.mjs'))) {
  if (stage === 'full') await full();
  else { console.error('usage: run.mjs full <cacheDir> [outDir] (candles: node --use-env-proxy research/edge/ict-equal-lows/run.mjs fetch <cacheDir>)'); process.exit(1); }
}
