// ICT A-setups split by the quarter of the week / month / year their sweep fell in (edge research, 13 Nov 2026).
// Pre-registered in PREREGISTRATION.md before the `full` stage, the only stage that computes an outcome, ran.
// Engine: the research lab's runMarket (api/_ictlab.js) = the desk's own signals() / isASetup() / sizeOf() / P from ict/tracker.mjs and
// simulate() from ict/replay.mjs, imported read-only; one open trade per market per stream; the lab's round-trip costs.
// Candles: OANDA mid H1 through the site's keyless proxy, cached OUTSIDE git (the same files and format as ict-equal-lows).
//
//   node --use-env-proxy research/edge/ict-quarters/run.mjs fetch <cacheDir>     download the H1 candles (paced)
//   node research/edge/ict-quarters/run.mjs count <cacheDir>                     signal counts per quarter only, no outcome
//   node research/edge/ict-quarters/run.mjs full  <cacheDir> [outDir]            the test: result.json + tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CYCLES, FAVOURED } from './quarters.mjs';

const require = createRequire(import.meta.url);
const lab = require('../../../api/_ictlab.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [stage, CACHE = '/tmp/claude-0/ict-gap', OUT = HERE] = process.argv.slice(2);
const MD = process.env.ICT_MD_BARS || 'https://macro-dashboard-xau.vercel.app/md/bars';

const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const WARM = ts('2019-06-01'), FROM = ts('2020-01-01'), OOS = ts('2024-01-01'), TO = ts('2026-11-01'), END = ts('2026-11-10');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000', gc: 'xau' };
const BOOKS = { all: ['nq', 'es', 'ym', 'rty', 'gc'], index: ['nq', 'es', 'ym', 'rty'], gold: ['gc'] };
const TESTS = [['T1', 'week', 'Quarter of the week: Tuesday (Q2) vs the other days'], ['T2', 'month', 'Quarter of the month: week 2 (Q2) vs the rest'], ['T3', 'year', 'Quarter of the year: April-June (Q2) vs the rest']];
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- stage fetch (as ict-equal-lows) ----
async function fetchAll() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const [k, sym] of Object.entries(SYM)) {
    const m = new Map();
    for (let t = WARM; t < END; t += 4999 * 3600) {
      const url = `${MD}?sym=${sym}&tf=1h&from=${t}&to=${Math.min(END, t + 4999 * 3600)}`;
      let j = null;
      for (let a = 0; a < 4 && !j; a++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(40000) }); if (r.ok) j = await r.json(); else await sleep(4000 * (a + 1)); } catch (e) { await sleep(4000 * (a + 1)); } }
      if (!j || !Array.isArray(j.bars)) throw new Error(`${sym}: no answer for ${day(t)}`);
      for (const b of j.bars) if (!b.live && b.time < END) m.set(b.time, [b.time, b.open, b.high, b.low, b.close]);
      await sleep(2500);
    }
    const rows = [...m.values()].sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(CACHE, `${sym}-1h.json`), JSON.stringify(rows));
    console.log(`${k} ${sym}: ${rows.length} H1 ${day(rows[0][0])} → ${day(rows.at(-1)[0])}`);
  }
}

// ---- candles: the lab's own cleaning (positive prices, the 17:00 New York halt hour dropped, D1 = dailyNY) ----
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
// the quarter of a signal = the quarter of its sweep candle
export const quarterOf = (cycle, g) => CYCLES[cycle](g.sweepT);

// ---- stage count: A-setup signals per quarter. No trade is simulated, no outcome is read. ----
async function count() {
  const E = await lab.engine(), srcs = load(E), sig = [];
  for (const k of BOOKS.all) { const s = srcs[k], mk = lab.marketOf(k, E);
    for (const g of E.signals(s.H, s.D, 1, mk.M.tick).concat(E.signals(s.H, s.D, -1, mk.M.tick))) if (g.close >= FROM && g.close < TO && g.grade.total >= E.MIN_GRADE && E.isASetup(g, k)) sig.push({ k, g }); }
  console.log(`A-setup signals ${sig.length} (IS ${sig.filter((x) => x.g.close < OOS).length}, OOS ${sig.filter((x) => x.g.close >= OOS).length})`);
  for (const c of Object.keys(CYCLES)) { const tab = {};
    for (const { g } of sig) { const q = quarterOf(c, g), w = g.close < OOS ? 'IS' : 'OOS'; tab[q] = tab[q] || { IS: 0, OOS: 0 }; tab[q][w]++; }
    console.log(`${c}: ` + Object.keys(tab).sort().map((q) => `${q} ${tab[q].IS}/${tab[q].OOS}`).join(' · ')); }
}

// ---- statistics ----
const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, p: null };
  const m = (x) => x.reduce((s, v) => s + v, 0) / x.length, v = (x, mu) => x.reduce((s, q) => s + (q - mu) ** 2, 0) / (x.length - 1);
  const ma = m(a), mb = m(b), se = Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length);
  if (!(se > 0)) return { diff: +(ma - mb).toFixed(3), t: null, p: null };
  const t = (ma - mb) / se; return { diff: +(ma - mb).toFixed(3), t: +t.toFixed(2), p: +(1 - phi(t)).toFixed(4) };   // one-sided (a > b), normal approximation
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p == null ? 1 : p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = +run.toFixed(4); });
  return out;
}
// the verdict rule of PREREGISTRATION.md section 6
export function judge(c) {
  const all = Object.values(c).every(Boolean), fail = !c.oosDiffPositive || !c.oosPositive;
  return all ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE';
}

async function full() {
  const E = await lab.engine(), srcs = load(E);
  const st = (a, f = 'R') => { const s = lab.stats(a.map((t) => t[f])); return { n: s.n, wr: s.winRate, exp: s.avgR, R: s.netR, pf: s.pf, maxDD: s.maxDD, t: s.t }; };
  const yearOf = (t) => new Date(t.t * 1000).getUTCFullYear(), sorted = (a) => [...a].sort((x, y) => x.t - y.t);
  const block = (trades) => { const a = sorted(trades), is = a.filter((t) => t.t < OOS), oos = a.filter((t) => t.t >= OOS);
    return { all: st(a), is: st(is), oos: st(oos), oosGross: st(oos, 'gross'), years: Object.fromEntries(YEARS.map((y) => [y, st(a.filter((t) => yearOf(t) === y))])) }; };
  // one stream on one market: the A-rule AND a predicate, checked before the one-open rule (as the lab's filters are)
  let gaps = {}, open = {};
  const run = (k, pred) => { const mk = lab.marketOf(k, E), Ev = pred ? { ...E, isASetup: (g, m) => E.isASetup(g, m) && pred(g) } : E, s = srcs[k];
    const r = lab.runMarket(Ev, mk, s, { from: FROM, to: TO, at: END, rule: 'A', filters: {}, params: {}, sizing: 'live', costOn: true });
    return { open: r.trades.filter((t) => t.R == null).length, gaps: r.gaps, trades: r.trades.filter((t) => t.R != null).map((t) => ({ ...t, market: k })) }; };
  const pool = (by, ks) => ks.flatMap((k) => by[k]);
  const streamOf = (pred) => { const by = {}; for (const k of BOOKS.all) { const r = run(k, pred); by[k] = r.trades; if (!pred) { gaps[k] = r.gaps; open[k] = r.open; } } return by; };
  const base = streamOf(null);
  const R = (a, w) => a.filter((t) => (w === 'is' ? t.t < OOS : t.t >= OOS)).map((t) => t.R);

  const rows = TESTS.map(([id, cycle, name]) => {
    const fav = streamOf((g) => quarterOf(cycle, g) === FAVOURED), rest = streamOf((g) => quarterOf(cycle, g) !== FAVOURED);
    const per = (ks) => { const F = pool(fav, ks), N = pool(rest, ks); return { B: block(pool(base, ks)), F: block(F), N: block(N), dI: welch(R(F, 'is'), R(N, 'is')), dO: welch(R(F, 'oos'), R(N, 'oos')) }; };
    const all = per(BOOKS.all);
    // reported, not judged: every quarter of the cycle as its own stream, and the index book and gold apart
    const qs = [...new Set(BOOKS.all.flatMap((k) => { const s = srcs[k], mk = lab.marketOf(k, E); return E.signals(s.H, s.D, 1, mk.M.tick).concat(E.signals(s.H, s.D, -1, mk.M.tick)).map((g) => String(quarterOf(cycle, g))); }))].sort();
    const quarters = Object.fromEntries(qs.map((q) => { const b = block(pool(streamOf((g) => String(quarterOf(cycle, g)) === q), BOOKS.all)); return [q, { is: b.is, oos: b.oos }]; }));
    const books = Object.fromEntries(['index', 'gold'].map((bk) => { const p = per(BOOKS[bk]); return [bk, { fav: { is: p.F.is, oos: p.F.oos }, rest: { is: p.N.is, oos: p.N.oos }, oosDiff: p.dO, isDiff: p.dI }]; }));
    const checks = { oosN30: all.F.oos.n >= 30, isPositive: all.F.is.exp != null && all.F.is.exp > 0, oosPositive: all.F.oos.exp != null && all.F.oos.exp > 0,
      isDiffPositive: all.dI.diff != null && all.dI.diff > 0, oosDiffPositive: all.dO.diff != null && all.dO.diff > 0, oosT2: all.dO.t != null && all.dO.t >= 2 };
    return { id, cycle, name, ...all, checks, quarters, books };
  });
  const adj = holm(rows.map((r) => r.dO.p));
  rows.forEach((r, i) => { r.holmP = adj[i]; r.checks.holm = adj[i] < 0.05; r.verdict = judge(r.checks); });

  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const passes = rows.filter((r) => r.verdict === 'PASS'), incs = rows.filter((r) => r.verdict === 'INCONCLUSIVE');
  const verdict = passes.length ? `PASS for ${passes.map((r) => r.id + ' ' + r.cycle).join(', ')}; the other ${rows.length - passes.length} do not pass`
    : `FAIL. None of the ${rows.length} pre-registered tests passes${incs.length ? ` (${incs.map((r) => r.id + ' ' + r.cycle).join(', ')}: out-of-sample difference above zero, far from the bar)` : ''}; the A-rule stays as it is`;
  const result = {
    topic: 'ict-quarters', built: '2026-11-13',
    system: 'ICT desk A-setups (H1 iFVG reversal) split by the quarter of the week, month and year their sweep fell in (quarterly theory: Q2 = the manipulation quarter). Lab engine api/_ictlab.js runMarket (the desk\'s signals / isASetup / sizeOf / simulate) on OANDA mid H1: NAS100, SPX500, US30, US2000, XAU',
    preregistered: 'PREREGISTRATION.md (committed and pushed before the full stage ran)', planSha256: sha,
    window: { from: day(FROM), to: day(TO - 1), is: `${day(FROM)} to ${day(OOS - 1)}`, oos: `${day(OOS)} to ${day(TO - 1)}`, candlesTo: day(END - 1) },
    definition: { favoured: FAVOURED, day: 'New York trading day starting 18:00 New York', week: 'Q1 Mon, Q2 Tue, Q3 Wed, Q4 Thu, Friday apart', month: 'weeks by their Monday: 1st-7th Q1, 8th-14th Q2, 15th-21st Q3, 22nd-28th Q4; days before the first Monday (P) and a week from the 29th (X) apart', year: 'calendar quarters', at: 'the signal\'s sweep candle (sweepT)' },
    sources: Object.fromEntries(BOOKS.all.map((k) => [k, { src: srcs[k].src, h1: srcs[k].H.length, first: day(srcs[k].H[0].time), last: new Date(srcs[k].H.at(-1).time * 1000).toISOString().slice(0, 16), sha256: srcs[k].sha, unresolved: open[k], gaps: gaps[k] }])),
    costs: 'lab COST round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5; net R = size x (R - cost / risk); live sizing (sizeOf)',
    variantsTried: 1, testsJudged: rows.length, multipleTesting: 'Holm over the 3 pre-registered tests (one-sided Welch, favoured-quarter stream vs the rest, out of sample, normal approximation)',
    verdict,
    baseline: { all: { is: rows[0].B.is, oos: rows[0].B.oos, all: rows[0].B.all, years: Object.fromEntries(YEARS.map((y) => [y, rows[0].B.years[y].R])), yearStats: rows[0].B.years, oosGross: rows[0].B.oosGross } },
    candidates: rows.map((r) => ({ rule: `${r.id} · ${r.name}`, test: r.id, cycle: r.cycle, book: 'all', verdict: r.verdict, checks: r.checks,
      is: r.F.is, oos: r.F.oos, all: r.F.all, years: Object.fromEntries(YEARS.map((y) => [y, r.F.years[y].R])), yearStats: r.F.years, oosGross: r.F.oosGross,
      vsBaseline: { isExp: +(r.F.is.exp - r.B.is.exp).toFixed(3), oosExp: +(r.F.oos.exp - r.B.oos.exp).toFixed(3) },
      vsRest: { is: r.dI, oos: r.dO, holmP: r.holmP }, rest: { is: r.N.is, oos: r.N.oos, all: r.N.all, years: Object.fromEntries(YEARS.map((y) => [y, r.N.years[y].R])) },
      reportedNotJudged: { quarters: r.quarters, books: r.books } })),
    notes: 'Pre-registered (sha256 above). IS 2020-23, OOS 2024-01-01 to 2026-10-31. OANDA cash CFDs stand in for the futures the desk trades; levels differ, the structure is the same. Every simulated trade keeps the engine\'s own stop. Paper research: no live rule, tracker, replay, rule book or desk change.',
  };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1) + '\n');

  const f = (x, d = 3) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(d));
  const row = (s) => `${s.n} | ${s.wr == null ? '-' : Math.round(100 * s.wr) + '%'} | ${f(s.exp)} | ${f(s.R, 1)} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
  const L = [`plan sha256 ${sha}`, verdict, ''];
  for (const r of rows) {
    L.push(`## ${r.id} ${r.name}: ${r.verdict}`, '', '| stream | window | n | win | R a trade net | total R | max DD | t |', '|---|---|---|---|---|---|---|---|');
    for (const [nm, b] of [['all A-setups', r.B], ['favoured Q2', r.F], ['rest', r.N]]) for (const w of ['is', 'oos']) L.push(`| ${nm} | ${w.toUpperCase()} | ${row(b[w])} |`);
    L.push('', `Q2 vs rest: IS diff ${f(r.dI.diff)} (t ${r.dI.t}), OOS diff ${f(r.dO.diff)} (t ${r.dO.t}, one-sided p ${r.dO.p}, Holm ${r.holmP})`, `checks ${JSON.stringify(r.checks)}`, '',
      'each quarter as its own stream: ' + Object.entries(r.quarters).map(([q, b]) => `${q} IS ${f(b.is.exp)} (${b.is.n}) OOS ${f(b.oos.exp)} (${b.oos.n}, t ${b.oos.t})`).join(' · '),
      'books: ' + Object.entries(r.books).map(([bk, b]) => `${bk} Q2 OOS ${f(b.fav.oos.exp)} (${b.fav.oos.n}) rest ${f(b.rest.oos.exp)} (${b.rest.oos.n}) diff t ${b.oosDiff.t}; IS diff ${f(b.isDiff.diff)} t ${b.isDiff.t}`).join(' · '),
      '| year | ' + YEARS.join(' | ') + ' |', '|---|' + YEARS.map(() => '---|').join(''),
      '| Q2 | ' + YEARS.map((y) => `${f(r.F.years[y].R, 1)} (${r.F.years[y].n})`).join(' | ') + ' |', '| rest | ' + YEARS.map((y) => `${f(r.N.years[y].R, 1)} (${r.N.years[y].n})`).join(' | ') + ' |', '');
  }
  L.push('sources: ' + BOOKS.all.map((k) => `${k} ${srcs[k].H.length} H1 sha ${srcs[k].sha} unresolved ${open[k]} gaps ${gaps[k]}`).join('; '));
  console.log(L.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith(path.join('ict-quarters', 'run.mjs'))) {
  if (stage === 'fetch') await fetchAll(); else if (stage === 'count') await count(); else if (stage === 'full') await full();
  else { console.error('usage: run.mjs fetch|count|full <cacheDir> [outDir]'); process.exit(1); }
}
