// ICT A-setups: did the sweep run into an open NWOG / NDOG, or not? (edge research, 14 Nov 2026)
// Pre-registered in PREREGISTRATION.md before the `full` stage, the only stage that computes an outcome, ran.
// Engine: the research lab's runMarket (api/_ictlab.js) = the desk's own signals() / isASetup() / sizeOf() / P from ict/tracker.mjs and
// simulate() from ict/replay.mjs, imported read-only; one open trade per market per stream; the lab's round-trip costs.
// Candles: OANDA mid H1 through the site's keyless proxy, cached OUTSIDE git.
//
//   node --use-env-proxy research/edge/ict-nwog/run.mjs fetch <cacheDir>     download the H1 candles (paced)
//   node research/edge/ict-nwog/run.mjs count <cacheDir>                     signal and gap counts only, no outcome
//   node research/edge/ict-nwog/run.mjs full  <cacheDir> [outDir]            the test: result.json + tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { GAP, findGaps, tagSignal } from './gap.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const require = createRequire(import.meta.url);
const lab = require('../../../api/_ictlab.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [stage, CACHE = '/tmp/ict-nwog-cache', OUT = HERE] = process.argv.slice(2);
const MD = process.env.ICT_MD_BARS || 'https://macro-dashboard-xau.vercel.app/md/bars';

const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const WARM = ts('2019-06-01'), FROM = ts('2020-01-01'), OOS = ts('2024-01-01'), TO = ts('2026-11-01'), END = ts('2026-11-10');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000', gc: 'xau' };
const BOOKS = { all: ['nq', 'es', 'ym', 'rty', 'gc'], index: ['nq', 'es', 'ym', 'rty'] };
// Financing (reported, not judged): the one measured CFD rate in the repository, council/fills.mjs FIN.xau.long (a night), charged on
// every position of every market and both sides, per night of council/fills.mjs nights() (22:00 UTC Mon-Fri, Wednesday three).
const FIN_NIGHT = FIN.xau.long;
const PLACEBOS = 40, SEED = 20261114;
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- stage fetch ----
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

// ---- candles: the lab's own cleaning (labSource: positive prices, the 17:00 New York halt hour dropped, D1 = dailyNY) ----
function load(E) {
  const srcs = {};
  for (const [k, sym] of Object.entries(SYM)) {
    const raw = JSON.parse(fs.readFileSync(path.join(CACHE, `${sym}-1h.json`), 'utf8')), sha = crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 16);
    const H = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))
      .filter((b) => [b.open, b.high, b.low, b.close, b.time].every((v) => isFinite(v) && v > 0) && !E.inHalt(b.time))
      .map((b) => ({ time: b.time, open: +b.open, high: Math.max(b.high, b.open, b.close), low: Math.min(b.low, b.open, b.close), close: +b.close }));
    srcs[k] = { H, D: E.dailyNY(H).filter((b) => b.time + 86400 <= END), index: new Map(H.map((b, i) => [b.time, i])), src: `OANDA ${sym} H1 (mid)`, sha };
    srcs[k].gaps = findGaps(H);
  }
  return srcs;
}
const tagger = (srcs, k, o = GAP) => { const s = srcs[k], memo = new Map(), fn = (g) => { const id = g.side + ':' + g.t; if (!memo.has(id)) memo.set(id, tagSignal(g, s.H, s.gaps, s.index, o)); return memo.get(id); }; fn.seen = (side, t) => memo.get(side + ':' + t); return fn; };
// the engine's signals() once per market and side (P is never overridden here, so the memo is exact)
const memoSignals = (E) => { const m = new Map(); return (H, D, side, tick) => { const k = H.length + ':' + H[0].time + ':' + side; if (!m.has(k)) m.set(k, E.signals(H, D, side, tick)); return m.get(k); }; };

// ---- stage count: how many A-setup signals, and how many ran into an open gap. No trade is simulated, no outcome is read. ----
async function count() {
  const E = await lab.engine(), srcs = load(E), rows = [];
  for (const k of BOOKS.all) {
    const s = srcs[k], mk = lab.marketOf(k, E), tag = tagger(srcs, k);
    const sig = E.signals(s.H, s.D, 1, mk.M.tick).concat(E.signals(s.H, s.D, -1, mk.M.tick)).filter((g) => g.close >= FROM && g.close < TO && g.grade.total >= E.MIN_GRADE);
    const A = sig.filter((g) => E.isASetup(g, k)), c = (a, f) => a.filter(f).length, isIS = (g) => g.close < OOS;
    const inW = s.gaps.filter((g) => g.t >= FROM && g.t < TO);
    rows.push({ k, h1: s.H.length, nwog: c(inW, (g) => g.kind === 'nwog'), ndog: c(inW, (g) => g.kind === 'ndog'), a: A.length, aIS: c(A, isIS), aOOS: c(A, (g) => !isIS(g)),
      gIS: c(A, (g) => isIS(g) && tag(g).gap), gOOS: c(A, (g) => !isIS(g) && tag(g).gap), wk: c(A, (g) => tag(g).kinds.includes('nwog')), dy: c(A, (g) => tag(g).kinds.includes('ndog')) });
  }
  console.log('market | H1 | NWOGs | NDOGs | A-setup signals | A IS | A OOS | with-gap IS | with-gap OOS | share | into an NWOG | into an NDOG');
  for (const r of rows) console.log(`${r.k} | ${r.h1} | ${r.nwog} | ${r.ndog} | ${r.a} | ${r.aIS} | ${r.aOOS} | ${r.gIS} | ${r.gOOS} | ${Math.round(100 * (r.gIS + r.gOOS) / r.a)}% | ${r.wk} | ${r.dy}`);
  const T = rows.reduce((a, r) => { for (const q of ['a', 'aIS', 'aOOS', 'gIS', 'gOOS', 'wk', 'dy', 'nwog', 'ndog']) a[q] = (a[q] || 0) + r[q]; return a; }, {});
  console.log(`all | | ${T.nwog} | ${T.ndog} | ${T.a} | ${T.aIS} | ${T.aOOS} | ${T.gIS} | ${T.gOOS} | ${Math.round(100 * (T.gIS + T.gOOS) / T.a)}% | ${T.wk} | ${T.dy}`);
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
// Holm step-down: adjusted p-values in the input order
export function holm(ps) {
  const idx = ps.map((p, i) => [p == null ? 1 : p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = +run.toFixed(4); });
  return out;
}
// t on calendar-month sums: every calendar month of [from, to) counts, a month with no trade is a 0 (trades by signal close)
export function monthT(trades, from, to, f = 'R') {
  const key = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }, a = key(from), b = key(to - 1), sums = new Array(b - a + 1).fill(0);
  for (const x of trades) if (x.t >= from && x.t < to) sums[key(x.t) - a] += x[f];
  const n = sums.length, m = sums.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(sums.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1));
  const t = sd > 0 ? m / (sd / Math.sqrt(n)) : null;
  return { months: n, mean: +m.toFixed(3), t: t == null ? null : +t.toFixed(2), p: t == null ? null : +(1 - phi(t)).toFixed(4) };
}
// seeded uniform [0, 1)
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

async function full() {
  const E0 = await lab.engine(), srcs = load(E0), E = { ...E0, signals: memoSignals(E0) };
  const st = (a, f = 'R') => { const s = lab.stats(a.map((t) => t[f])); return { n: s.n, wr: s.winRate, exp: s.avgR, R: s.netR, pf: s.pf, maxDD: s.maxDD, t: s.t }; };
  const yearOf = (t) => new Date(t.t * 1000).getUTCFullYear(), sorted = (a) => [...a].sort((x, y) => x.t - y.t);
  const block = (trades) => { const a = sorted(trades), is = a.filter((t) => t.t < OOS), oos = a.filter((t) => t.t >= OOS);
    return { all: st(a), is: st(is), oos: st(oos), isGross: st(is, 'gross'), oosGross: st(oos, 'gross'), is2x: st(is, 'net2'), oos2x: st(oos, 'net2'), oosFin: st(oos, 'fin'), isFin: st(is, 'fin'), oosFlat: st(oos, 'flat'),
      mIS: monthT(a, FROM, OOS), mOOS: monthT(a, OOS, TO), mOOSgross: monthT(a, OOS, TO, 'gross'), mISgross: monthT(a, FROM, OOS, 'gross'), mOOS2x: monthT(a, OOS, TO, 'net2'),
      years: Object.fromEntries(YEARS.map((y) => [y, st(a.filter((t) => yearOf(t) === y))])) }; };
  const run = (k, pred) => { const mk = lab.marketOf(k, E), Ev = pred ? { ...E, isASetup: (g, m) => E.isASetup(g, m) && pred(g) } : E, s = srcs[k];
    const r = lab.runMarket(Ev, mk, s, { from: FROM, to: TO, at: END, rule: 'A', filters: {}, params: {}, sizing: 'live', costOn: true });
    return { open: r.trades.filter((t) => t.R == null).length, gaps: r.gaps, trades: r.trades.filter((t) => t.R != null).map((t) => {
      const nt = nights(t.t, Date.parse(t.closed) / 1000), fin = t.size * nt * FIN_NIGHT * t.entry / t.r0;
      return { ...t, market: k, flat: +(t.R / t.size).toFixed(3), net2: +(2 * t.R - t.gross).toFixed(3), nights: nt, fin: +(t.R - fin).toFixed(3) }; }) }; };
  const streams = () => { const S = { base: {}, w: {}, wo: {} }, meta = {};
    for (const k of BOOKS.all) { const tag = tagger(srcs, k), b = run(k, (g) => (tag(g), true)), w = run(k, (g) => tag(g).gap), wo = run(k, (g) => !tag(g).gap);
      S.base[k] = b.trades; S.w[k] = w.trades; S.wo[k] = wo.trades; meta[k] = { open: b.open, gaps: b.gaps, tag };
      for (const t of [...b.trades, ...w.trades]) { const x = tag.seen(t.side === 'buy' ? 1 : -1, +t.id.split('-')[2]); t.gap = x.gap; t.kinds = x.kinds; } }
    return { S, meta }; };
  const pool = (by, ks) => ks.flatMap((k) => by[k]);

  const { S, meta } = streams();
  const BW = block(pool(S.w, BOOKS.all)), BWO = block(pool(S.wo, BOOKS.all)), BB = block(pool(S.base, BOOKS.all)), IW = block(pool(S.w, BOOKS.index)), IB = block(pool(S.base, BOOKS.index)), IWO = block(pool(S.wo, BOOKS.index));
  const oosR = (a) => a.filter((t) => t.t >= OOS).map((t) => t.R), isR = (a) => a.filter((t) => t.t < OOS).map((t) => t.R);
  const dO = welch(oosR(pool(S.w, BOOKS.all)), oosR(pool(S.wo, BOOKS.all))), dI = welch(isR(pool(S.w, BOOKS.all)), isR(pool(S.wo, BOOKS.all)));
  const dOi = welch(oosR(pool(S.w, BOOKS.index)), oosR(pool(S.wo, BOOKS.index))), dIi = welch(isR(pool(S.w, BOOKS.index)), isR(pool(S.wo, BOOKS.index)));
  const ps = [BW.mOOS.p, dO.p, IW.mOOS.p], adj = holm(ps);
  const streamChecks = (V, h) => ({ oosN30: V.oos.n >= 30, oosT2: V.mOOS.t != null && V.mOOS.t >= 2, holm: h < 0.025, isPositive: V.is.exp != null && V.is.exp > 0, oosPositive: V.oos.exp != null && V.oos.exp > 0, oos2xPositive: V.oos2x.exp != null && V.oos2x.exp > 0 });
  const T1c = streamChecks(BW, adj[0]), T3c = streamChecks(IW, adj[2]);
  const T2c = { oosDiffPositive: dO.diff != null && dO.diff > 0, isDiffPositive: dI.diff != null && dI.diff > 0, holm: adj[1] < 0.025 };
  const tests = [
    { id: 'T1', name: 'WITH-gap A-setups, all five markets, OOS net > 0 (t on calendar-month sums)', primary: true, value: BW.oos.exp, t: BW.mOOS.t, p: ps[0], holmP: adj[0], checks: T1c },
    { id: 'T2', name: 'WITH-gap minus WITHOUT-gap A-setups, all five markets, OOS (Welch on trades)', value: dO.diff, t: dO.t, p: ps[1], holmP: adj[1], checks: T2c },
    { id: 'T3', name: 'WITH-gap A-setups, index book (NQ, ES, YM, RTY), OOS net > 0 (t on calendar-month sums)', value: IW.oos.exp, t: IW.mOOS.t, p: ps[2], holmP: adj[2], checks: T3c },
  ];
  for (const x of tests) x.pass = Object.values(x.checks).every(Boolean);

  // placebo: 40 seeded random taggings of the A-setups with each market's own WITH share (A-setup signals in the window)
  const share = {}; for (const k of BOOKS.all) { const mk = lab.marketOf(k, E), s = srcs[k], tag = meta[k].tag;
    const A = E.signals(s.H, s.D, 1, mk.M.tick).concat(E.signals(s.H, s.D, -1, mk.M.tick)).filter((g) => g.close >= FROM && g.close < TO && g.grade.total >= E.MIN_GRADE && E.isASetup(g, k));
    share[k] = +(A.filter((g) => tag(g).gap).length / A.length).toFixed(4); }
  const placebo = [];
  for (let d = 0; d < PLACEBOS; d++) { const R = rng(SEED + d), trades = [];
    for (const k of BOOKS.all) { const draw = new Map(), pick = (g) => { const id = g.side + ':' + g.t; if (!draw.has(id)) draw.set(id, R() < share[k]); return draw.get(id); };
      trades.push(...run(k, pick).trades); }
    const b = block(trades); placebo.push({ seed: SEED + d, oosN: b.oos.n, oosExp: b.oos.exp, oosT: b.mOOS.t, isExp: b.is.exp }); }
  const plAtLeast = placebo.filter((q) => q.oosT != null && BW.mOOS.t != null && q.oosT >= BW.mOOS.t).length, plT2 = placebo.filter((q) => q.oosT != null && q.oosT >= 2).length;
  const plExp = placebo.filter((q) => q.oosExp != null && BW.oos.exp != null && q.oosExp >= BW.oos.exp).length;

  // reported, not judged: NWOG-only and NDOG-only inside the unfiltered stream's own trades; per market
  const baseAll = sorted(pool(S.base, BOOKS.all)), inside = (f) => ({ is: st(baseAll.filter((t) => t.t < OOS && f(t))), oos: st(baseAll.filter((t) => t.t >= OOS && f(t))) });
  const insideBase = { withGap: inside((t) => t.gap), without: inside((t) => !t.gap), nwog: inside((t) => t.kinds.includes('nwog')), ndog: inside((t) => t.kinds.includes('ndog')) };
  const perMarket = Object.fromEntries(BOOKS.all.map((k) => { const b = block(S.base[k]), w = block(S.w[k]), wo = block(S.wo[k]); return [k, { base: { is: b.is, oos: b.oos }, with: { is: w.is, oos: w.oos, mOOS: w.mOOS }, without: { is: wo.is, oos: wo.oos } }]; }));

  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const f = (x, d = 3) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(d));
  const T1 = tests[0];
  const verdict = T1.pass ? `PASS. WITH-gap A-setups made ${f(BW.oos.exp)}R a trade net OOS (n ${BW.oos.n}, month t ${BW.mOOS.t}, Holm p ${adj[0]})`
    : `FAIL. WITH-gap A-setups made ${f(BW.oos.exp)}R a trade net OOS (n ${BW.oos.n}, month t ${BW.mOOS.t}, Holm p ${adj[0]}); WITH minus WITHOUT ${f(dO.diff)}R (t ${dO.t}); 0 of 3 tests pass`.replace('0 of 3', `${tests.filter((x) => x.pass).length} of 3`);
  const pick3 = (b) => ({ is: b.is, oos: b.oos, all: b.all, isGross: b.isGross, oosGross: b.oosGross, is2x: b.is2x, oos2x: b.oos2x, isFin: b.isFin, oosFin: b.oosFin, oosFlat: b.oosFlat, monthT: { is: b.mIS, oos: b.mOOS, isGross: b.mISgross, oosGross: b.mOOSgross, oos2x: b.mOOS2x }, years: Object.fromEntries(YEARS.map((y) => [y, b.years[y].R])), yearStats: b.years });
  const result = {
    topic: 'ict-nwog', built: '2026-11-14',
    system: 'ICT desk A-setups (H1 iFVG reversal) split by whether the sweep candle ran into an open NWOG / NDOG (one of the last 5 of each, not fully filled). Lab engine api/_ictlab.js runMarket (the desk\'s signals / isASetup / sizeOf / simulate) on OANDA mid H1: NAS100, SPX500, US30, US2000, XAU',
    preregistered: 'PREREGISTRATION.md (committed and pushed before the full stage ran)', planSha256: sha,
    window: { from: day(FROM), to: day(TO - 1), is: `${day(FROM)} to ${day(OOS - 1)}`, oos: `${day(OOS)} to ${day(TO - 1)}`, candlesTo: day(END - 1) },
    definition: { ...GAP, text: 'NWOG = last H1 close before a CME break containing a Saturday to the first H1 open after it; NDOG = the same for every other CME break (17:00 New York close to the 18:00 reopen); CME hours from ict/calendar.mjs; a signal is WITH-gap when its sweep candle\'s extreme runs into (or through) one of the 5 most recent NWOGs or 5 most recent NDOGs formed before it and not fully filled before it' },
    sources: Object.fromEntries(BOOKS.all.map((k) => [k, { src: srcs[k].src, h1: srcs[k].H.length, first: day(srcs[k].H[0].time), last: new Date(srcs[k].H.at(-1).time * 1000).toISOString().slice(0, 16), sha256: srcs[k].sha, nwog: srcs[k].gaps.filter((g) => g.kind === 'nwog').length, ndog: srcs[k].gaps.filter((g) => g.kind === 'ndog').length, unresolved: meta[k].open, dataGaps: meta[k].gaps, withShare: share[k] }])),
    costs: `lab COST round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5; net R = size x (R - cost / risk); live sizing (sizeOf). 2x costs reported for the bar. Financing reported, not judged: ${FIN_NIGHT} of price a night (council/fills.mjs FIN.xau.long, ${FIN.xau.src}), every market, both sides, nights() of council/fills.mjs`,
    variantsTried: 1, testsJudged: 3, multipleTesting: 'Holm over the 3 pre-registered tests; T1 and T3 one-sided p from the t on calendar-month sums (normal approximation), T2 one-sided Welch on trades; pass needs Holm p < 0.025 (one-sided, the t >= 2 line)',
    verdict,
    tests,
    baseline: { all: pick3(BB), index: pick3(IB) },
    candidates: [
      { rule: 'T1 · all: A-setups whose sweep ran into an open NWOG / NDOG', test: 'T1', book: 'all', verdict: T1.pass ? 'PASS' : 'FAIL', ...pick3(BW), vsWithout: { is: dI, oos: dO } },
      { rule: 'T1 · all: A-setups whose sweep did not', test: 'T1', book: 'all', verdict: 'reference', ...pick3(BWO) },
      { rule: 'T3 · index: A-setups whose sweep ran into an open NWOG / NDOG', test: 'T3', book: 'index', verdict: tests[2].pass ? 'PASS' : 'FAIL', ...pick3(IW), vsWithout: { is: dIi, oos: dOi } },
      { rule: 'T3 · index: A-setups whose sweep did not', test: 'T3', book: 'index', verdict: 'reference', ...pick3(IWO) },
    ],
    placebo: { draws: PLACEBOS, seed: SEED, share, realOosT: BW.mOOS.t, realOosExp: BW.oos.exp, atLeastRealT: plAtLeast, atLeastRealExp: plExp, reachT2: plT2, rows: placebo },
    reportedNotJudged: { insideTheUnfilteredStream: insideBase, perMarket },
    trades: sorted(pool(S.w, BOOKS.all)).map((t) => ({ d: day(t.t), m: t.market, side: t.side, R: t.R, kinds: t.kinds })),
    notes: 'Pre-registered (sha256 above). IS 2020-23, OOS 2024-01-01 to 2026-10-31. OANDA cash CFDs stand in for the futures the desk trades: their weekend and daily gaps are CFD gaps, not CME futures gaps. Every simulated trade keeps the engine\'s own stop. Paper research: no live rule, tracker, replay or desk change.',
  };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1) + '\n');

  const row = (s) => `${s.n} | ${s.wr == null ? '-' : Math.round(100 * s.wr) + '%'} | ${f(s.exp)} | ${f(s.R, 1)} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
  const L = [`plan sha256 ${sha}`, verdict, ''];
  for (const x of tests) L.push(`${x.id} ${x.name}: value ${f(x.value)} t ${x.t} p ${x.p} Holm ${x.holmP} ${x.pass ? 'PASS' : 'fail'} ${JSON.stringify(x.checks)}`);
  L.push('', '| stream | window | n | win | R a trade net | total R | max DD | trade t | month t | gross R a trade | gross month t | 2x cost R | financing R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [nm, b] of [['all: unfiltered', BB], ['all: WITH gap', BW], ['all: WITHOUT gap', BWO], ['index: unfiltered', IB], ['index: WITH gap', IW], ['index: WITHOUT gap', IWO]])
    for (const w of ['is', 'oos']) { const W = w.toUpperCase(), mt = w === 'is' ? b.mIS : b.mOOS, mg = w === 'is' ? b.mISgross : b.mOOSgross;
      L.push(`| ${nm} | ${W} | ${row(b[w])} | ${mt.t} | ${f(b[w + 'Gross'].exp)} | ${mg.t} | ${f(b[w + '2x'].exp)} | ${f(b[w + 'Fin'].exp)} |`); }
  L.push('', `WITH vs WITHOUT all: IS ${f(dI.diff)} (t ${dI.t}), OOS ${f(dO.diff)} (t ${dO.t}); index: IS ${f(dIi.diff)} (t ${dIi.t}), OOS ${f(dOi.diff)} (t ${dOi.t})`, '',
    '| year | ' + YEARS.join(' | ') + ' |', '|---|' + YEARS.map(() => '---|').join(''));
  for (const [nm, b] of [['unfiltered', BB], ['WITH gap', BW], ['WITHOUT gap', BWO]]) L.push(`| ${nm} | ` + YEARS.map((y) => `${f(b.years[y].R, 1)} (${b.years[y].n})`).join(' | ') + ' |');
  L.push('', `placebo (${PLACEBOS} seeded draws, shares ${JSON.stringify(share)}): OOS month t >= real (${BW.mOOS.t}) in ${plAtLeast}; OOS R a trade >= real in ${plExp}; month t >= 2 in ${plT2}`,
    `  placebo OOS t: ${placebo.map((q) => q.oosT).join(' ')}`, '', '## By market (R a trade net, n): unfiltered | WITH | WITHOUT', '', '| market | IS | OOS |', '|---|---|---|');
  for (const k of BOOKS.all) { const m = perMarket[k], c = (w) => ['base', 'with', 'without'].map((q) => `${f(m[q][w].exp)} (${m[q][w].n})`).join(' | '); L.push(`| ${k} | ${c('is')} | ${c('oos')} |`); }
  L.push('', 'inside the unfiltered stream: ' + Object.entries(insideBase).map(([k2, v]) => `${k2} IS ${f(v.is.exp)} (${v.is.n}, t ${v.is.t}) OOS ${f(v.oos.exp)} (${v.oos.n}, t ${v.oos.t})`).join('; '));
  L.push('', 'sources: ' + BOOKS.all.map((k) => `${k} ${srcs[k].H.length} H1 ${day(srcs[k].H[0].time)} → ${day(srcs[k].H.at(-1).time)} sha ${srcs[k].sha} unresolved ${meta[k].open} gaps ${meta[k].gaps}`).join('; '));
  console.log(L.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith(path.join('ict-nwog', 'run.mjs'))) {
  if (stage === 'fetch') await fetchAll(); else if (stage === 'count') await count(); else if (stage === 'full') await full();
  else { console.error('usage: run.mjs fetch|count|full <cacheDir> [outDir]'); process.exit(1); }
}
