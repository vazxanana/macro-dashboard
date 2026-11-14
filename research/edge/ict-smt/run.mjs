// ICT index A-setups: SMT divergence at the sweep (edge research, 14 Nov 2026).
// Pre-registered in PREREGISTRATION.md before the `full` stage, the only stage that computes an outcome, ran.
// Engine: the research lab's runMarket (api/_ictlab.js) = the desk's own signals() / isASetup() / sizeOf() / P from ict/tracker.mjs and
// simulate() from ict/replay.mjs, imported read-only; one open trade per market per stream; the lab's round-trip costs.
// Built on research/edge/ict-equal-lows (its swing detector is imported; nothing there is edited).
// Candles: OANDA mid H1 through the site's keyless proxy, cached OUTSIDE git.
//
//   node --use-env-proxy research/edge/ict-smt/run.mjs fetch <cacheDir>     download the H1 candles (paced)
//   node research/edge/ict-smt/run.mjs count <cacheDir>                     signal counts only, no outcome
//   node research/edge/ict-smt/run.mjs full  <cacheDir> [outDir]            the test: result.json + tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SMT, PARTNER, tagSignal } from './smt.mjs';

const require = createRequire(import.meta.url);
const lab = require('../../../api/_ictlab.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [stage, CACHE = '/tmp/claude-0/ict-smt', OUT = HERE] = process.argv.slice(2);
const MD = process.env.ICT_MD_BARS || 'https://meridianx.dev/md/bars';

const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const WARM = ts('2019-06-01'), FROM = ts('2020-01-01'), OOS = ts('2024-01-01'), TO = ts('2026-11-01'), END = ts('2026-11-10');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], OOSY = [2024, 2025, 2026];
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000' };
const MK = ['nq', 'es', 'ym', 'rty'];
const PLACEBO = 40;
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

// ---- candles: the lab's own cleaning (positive prices, the 17:00 New York halt hour dropped, D1 = dailyNY), as ict-equal-lows ----
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
const keyOf = (side, close) => side + ':' + close;
const tagger = (srcs, k) => { const s = srcs[k], p = srcs[PARTNER[k]], memo = new Map(), fn = (g) => { const id = keyOf(g.side, g.close); if (!memo.has(id)) memo.set(id, tagSignal(g, s.H, p.H, s.index)); return memo.get(id); }; fn.memo = memo; return fn; };
const aSignals = (E, srcs, k) => { const s = srcs[k], mk = lab.marketOf(k, E);
  return E.signals(s.H, s.D, 1, mk.M.tick).concat(E.signals(s.H, s.D, -1, mk.M.tick)).filter((g) => g.close >= FROM && g.close < TO && g.grade.total >= E.MIN_GRADE && E.isASetup(g, k)); };

// ---- stage count: how many A-setup signals, and how many have SMT. No trade is simulated, no outcome is read. ----
async function count() {
  const E = await lab.engine(), srcs = load(E), rows = [];
  for (const k of MK) {
    const tag = tagger(srcs, k), A = aSignals(E, srcs, k), c = (f) => A.filter(f).length, isIS = (g) => g.close < OOS;
    rows.push({ k, p: PARTNER[k], h1: srcs[k].H.length, a: A.length, aIS: c(isIS), aOOS: c((g) => !isIS(g)), smIS: c((g) => isIS(g) && tag(g).smt), smOOS: c((g) => !isIS(g) && tag(g).smt), unj: c((g) => !tag(g).judged) });
  }
  console.log('market | partner | H1 | A-setup signals | A IS | A OOS | SMT IS | SMT OOS | share | not judged');
  for (const r of rows) console.log(`${r.k} | ${r.p} | ${r.h1} | ${r.a} | ${r.aIS} | ${r.aOOS} | ${r.smIS} | ${r.smOOS} | ${Math.round(100 * (r.smIS + r.smOOS) / r.a)}% | ${r.unj}`);
  const T = rows.reduce((a, r) => ({ a: a.a + r.a, aIS: a.aIS + r.aIS, aOOS: a.aOOS + r.aOOS, smIS: a.smIS + r.smIS, smOOS: a.smOOS + r.smOOS, unj: a.unj + r.unj }), { a: 0, aIS: 0, aOOS: 0, smIS: 0, smOOS: 0, unj: 0 });
  console.log(`all | | | ${T.a} | ${T.aIS} | ${T.aOOS} | ${T.smIS} | ${T.smOOS} | ${Math.round(100 * (T.smIS + T.smOOS) / T.a)}% | ${T.unj}`);
}

// ---- statistics ----
export const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
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
// t on calendar-month sums: every month of [from, to) counts, a month with no trade is 0. trades: [{ t, R }].
export function monthT(trades, from, to, f = 'R') {
  const keys = []; for (let d = new Date(from * 1000); d.getTime() / 1000 < to; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) keys.push(d.toISOString().slice(0, 7));
  const sum = new Map(keys.map((k) => [k, 0])); for (const t of trades) { const k = new Date(t.t * 1000).toISOString().slice(0, 7); if (sum.has(k)) sum.set(k, sum.get(k) + t[f]); }
  const x = [...sum.values()], n = x.length, m = x.reduce((a, v) => a + v, 0) / n, sd = Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, n - 1));
  const t = sd > 0 ? m / (sd / Math.sqrt(n)) : null;
  return { months: n, mean: +m.toFixed(3), t: t == null ? null : +t.toFixed(2), p: t == null ? null : +(1 - phi(t)).toFixed(4) };
}
// seeded RNG for the placebo
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

async function full() {
  const E = await lab.engine(), srcs = load(E);
  const st = (a, f = 'R') => { const s = lab.stats(a.map((t) => t[f])); return { n: s.n, wr: s.winRate, exp: s.avgR, R: s.netR, pf: s.pf, maxDD: s.maxDD, t: s.t }; };
  const yearOf = (t) => new Date(t.t * 1000).getUTCFullYear(), sorted = (a) => [...a].sort((x, y) => x.t - y.t);
  const isOf = (a) => a.filter((t) => t.t < OOS), oosOf = (a) => a.filter((t) => t.t >= OOS);
  const block = (trades) => { const a = sorted(trades), is = isOf(a), oos = oosOf(a);
    return { all: st(a), is: st(is), oos: st(oos), isGross: st(is, 'gross'), oosGross: st(oos, 'gross'), oosFlat: st(oos, 'flat'), isFlat: st(is, 'flat'), is2x: st(is, 'R2'), oos2x: st(oos, 'R2'),
      isM: monthT(is, FROM, OOS), oosM: monthT(oos, OOS, TO), oosM2x: monthT(oos, OOS, TO, 'R2'), oosMGross: monthT(oos, OOS, TO, 'gross'), isMGross: monthT(is, FROM, OOS, 'gross'),
      years: Object.fromEntries(YEARS.map((y) => [y, st(a.filter((t) => yearOf(t) === y))])) }; };
  // one stream on one market: the A-rule AND a predicate, checked before the one-open rule (as the lab's filters are)
  const run = (k, pred) => { const mk = lab.marketOf(k, E), Ev = pred ? { ...E, isASetup: (g, m) => E.isASetup(g, m) && pred(g) } : E;
    const r = lab.runMarket(Ev, mk, srcs[k], { from: FROM, to: TO, at: END, rule: 'A', filters: {}, params: {}, sizing: 'live', costOn: true });
    return { open: r.trades.filter((t) => t.R == null).length, gaps: r.gaps, trades: r.trades.filter((t) => t.R != null).map((t) => ({ ...t, market: k, flat: +(t.R / t.size).toFixed(3), R2: +(2 * t.R - t.gross).toFixed(3) })) }; };
  const pool = (by) => MK.flatMap((k) => by[k]);
  const tags = Object.fromEntries(MK.map((k) => [k, tagger(srcs, k)]));
  const streams = (label) => { const S = { base: {}, smt: {}, non: {} }, meta = {};
    for (const k of MK) { const b = run(k, (g) => (label(k, g), true)), e = run(k, (g) => label(k, g)), n = run(k, (g) => !label(k, g));
      S.base[k] = b.trades; S.smt[k] = e.trades; S.non[k] = n.trades; meta[k] = { open: b.open, gaps: b.gaps };
      for (const t of b.trades) t.smt = !!label(k, { side: t.side === 'buy' ? 1 : -1, close: t.t, memoOnly: true }); }
    return { S, meta }; };
  const real = (k, g) => (g.memoOnly ? tags[k].memo.get(keyOf(g.side, g.close)) || {} : tags[k](g)).smt;
  const { S, meta } = streams(real);
  const B = block(pool(S.base)), V = block(pool(S.smt)), N = block(pool(S.non));
  const R = (a) => a.map((t) => t.R);
  const dO = welch(R(oosOf(pool(S.smt))), R(oosOf(pool(S.non)))), dI = welch(R(isOf(pool(S.smt))), R(isOf(pool(S.non))));
  const pT1 = V.oosM.p, raw = [pT1, dO.p, dI.p], adj = holm(raw);
  const posY = OOSY.filter((y) => V.years[y].n && V.years[y].R > 0).length;

  // placebo: 40 seeded random labels, each signal "SMT" with the market's observed SMT share (whole window); same streams, same tests
  const share = Object.fromEntries(MK.map((k) => { const A = aSignals(E, srcs, k); return [k, A.filter((g) => tags[k](g).smt).length / A.length]; }));
  const plac = [];
  for (let d = 0; d < PLACEBO; d++) {
    const rng = mulberry32(1000 + d), lab2 = {};
    for (const k of MK) { lab2[k] = new Map(); for (const g of aSignals(E, srcs, k).sort((a, b) => a.close - b.close || a.side - b.side)) lab2[k].set(keyOf(g.side, g.close), rng() < share[k]); }
    const q = streams((k, g) => !!lab2[k].get(keyOf(g.side, g.close))).S, Vq = pool(q.smt), Nq = pool(q.non);
    plac.push({ seed: 1000 + d, t1: monthT(oosOf(Vq), OOS, TO).t, oosExp: st(oosOf(Vq)).exp, n: oosOf(Vq).length, t2: welch(R(oosOf(Vq)), R(oosOf(Nq))).t, diff: welch(R(oosOf(Vq)), R(oosOf(Nq))).diff });
  }
  const atLeast = (f, x) => plac.filter((p) => p[f] != null && x != null && p[f] >= x).length;
  const placebo = { draws: PLACEBO, seeds: '1000..1039', share: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, +v.toFixed(3)])),
    t1AtLeastObserved: atLeast('t1', V.oosM.t), diffAtLeastObserved: atLeast('diff', dO.diff),
    t1Range: [Math.min(...plac.map((p) => p.t1 ?? 0)), Math.max(...plac.map((p) => p.t1 ?? 0))], draws_: plac };

  const checks = {
    oosN30: V.oos.n >= 30,
    t1Holm: adj[0] < 0.05, t1MonthT2: V.oosM.t != null && V.oosM.t >= 2,
    isSameSign: V.is.exp != null && V.is.exp > 0,
    oos2xPositive: V.oos2x.exp != null && V.oos2x.exp > 0,
    t2Holm: adj[1] < 0.05, t3SameSign: dI.diff != null && dI.diff > 0,
    placebo: placebo.t1AtLeastObserved <= 2,
  };
  const tooFew = !checks.oosN30;
  const fail = !(V.oos.exp > 0) || !(dO.diff > 0);
  const verdict = tooFew ? 'INCONCLUSIVE' : Object.values(checks).every(Boolean) ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE';

  // reported, not judged: the split inside the unfiltered stream's own trades; per market; any taken swing instead of the latest
  const baseAll = pool(S.base), split = (per, f = 'R') => ({ smt: st(baseAll.filter((t) => per(t) && t.smt), f), non: st(baseAll.filter((t) => per(t) && !t.smt), f) });
  const inBase = { is: split((t) => t.t < OOS), oos: split((t) => t.t >= OOS), isFlat: split((t) => t.t < OOS, 'flat'), oosFlat: split((t) => t.t >= OOS, 'flat') };
  const markets = Object.fromEntries(MK.map((k) => [k, { partner: PARTNER[k], base: { is: st(isOf(S.base[k])), oos: st(oosOf(S.base[k])) }, smt: { is: st(isOf(S.smt[k])), oos: st(oosOf(S.smt[k])) }, others: { is: st(isOf(S.non[k])), oos: st(oosOf(S.non[k])) } }]));
  const why = {}; for (const k of MK) for (const v of tags[k].memo.values()) why[v.why] = (why[v.why] || 0) + 1;

  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const ys = (b) => Object.fromEntries(YEARS.map((y) => [y, b.years[y].R]));
  const result = {
    topic: 'ict-smt', built: '2026-11-14',
    system: 'ICT desk index A-setups (H1 iFVG reversal) split by SMT divergence at the sweep: did the correlated index (NQ/ES, YM/ES, RTY/ES) hold its own low / high while the signal market swept? Lab engine api/_ictlab.js runMarket on OANDA mid H1: NAS100, SPX500, US30, US2000',
    preregistered: 'PREREGISTRATION.md (committed and pushed alone before the full stage ran)', planSha256: sha,
    window: { from: day(FROM), to: day(TO - 1), is: `${day(FROM)} to ${day(OOS - 1)}`, oos: `${day(OOS)} to ${day(TO - 1)}`, candlesTo: day(END - 1) },
    definition: { ...SMT, partners: PARTNER, text: 'buy: the sweep candle takes a confirmed, untouched H1 swing low (3 a side, last 96 candles; the most recent one taken) while the partner index, on its own candles up to and including the sweep candle, never trades below its lowest low of the swing\'s 7-candle window; sells mirror. GC excluded (no clean partner: silver is paper only)' },
    sources: Object.fromEntries(MK.map((k) => [k, { src: srcs[k].src, h1: srcs[k].H.length, first: day(srcs[k].H[0].time), last: new Date(srcs[k].H.at(-1).time * 1000).toISOString().slice(0, 16), sha256: srcs[k].sha, unresolved: meta[k].open, gaps: meta[k].gaps }])),
    costs: 'lab COST round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points; net R = size x (R - cost / risk); live sizing (sizeOf); 2x costs = 2 x net - gross; no financing (trades last at most 36 H1 candles; the desk trades futures)',
    variantsTried: 1, testsJudged: 3, multipleTesting: 'Holm over T1 (monthly-sum t, one-sided), T2 (one-sided Welch OOS), T3 (one-sided Welch IS)',
    verdict: '',
    tests: {
      T1: { what: 'SMT A-setups, OOS net > 0 (t on calendar-month sums)', n: V.oos.n, exp: V.oos.exp, R: V.oos.R, tTrades: V.oos.t, month: V.oosM, holmP: adj[0], is: { n: V.is.n, exp: V.is.exp, month: V.isM }, x2: { exp: V.oos2x.exp, month: V.oosM2x }, gross: { oos: V.oosGross, is: V.isGross } },
      T2: { what: 'SMT minus other A-setups, OOS (one-sided Welch)', ...dO, holmP: adj[1], nSmt: V.oos.n, nOther: N.oos.n },
      T3: { what: 'SMT minus other A-setups, IS (sign agreement; one-sided Welch)', ...dI, holmP: adj[2], nSmt: V.is.n, nOther: N.is.n },
    },
    checks, oosYearsPositive: `${posY} of 3`, tooFewToJudge: tooFew, placebo,
    streams: { unfiltered: { is: B.is, oos: B.oos, isM: B.isM, oosM: B.oosM, oosGross: B.oosGross, years: ys(B), yearStats: B.years },
      smt: { is: V.is, oos: V.oos, isM: V.isM, oosM: V.oosM, isGross: V.isGross, oosGross: V.oosGross, oos2x: V.oos2x, is2x: V.is2x, oosFlat: V.oosFlat, years: ys(V), yearStats: V.years },
      others: { is: N.is, oos: N.oos, isM: N.isM, oosM: N.oosM, isGross: N.isGross, oosGross: N.oosGross, oos2x: N.oos2x, years: ys(N), yearStats: N.years } },
    candidates: [{ rule: 'index A-setups with SMT divergence at the sweep', test: 'T1', verdict, is: V.is, oos: V.oos, all: V.all, years: ys(V) }],
    markets, reportedNotJudged: { insideTheUnfilteredStream: inBase, tagReasons: why },
    trades: sorted(pool(S.smt)).map((t) => ({ d: day(t.t), m: t.market, side: t.side, R: t.R })),
    notes: 'Pre-registered (sha256 above). IS 2020-23, OOS 2024-01-01 to 2026-10-31. OANDA cash CFDs stand in for the futures the desk trades. Every simulated trade keeps the engine\'s own stop. Paper research: no live rule, tracker, replay or desk change.',
  };
  const f = (x, d = 3) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(d));
  result.verdict = verdict === 'PASS' ? 'PASS: SMT A-setups pass T1 after Holm, beat the other A-setups (T2) with the same sign in sample (T3)'
    : tooFew ? `INCONCLUSIVE: too few to judge (${V.oos.n} out-of-sample SMT trades, under 30)`
    : `${verdict}: SMT A-setups ${f(V.oos.exp)}R a trade net out of sample (n ${V.oos.n}, monthly t ${V.oosM.t}) against ${f(N.oos.exp)}R for the others (n ${N.oos.n}); difference t ${dO.t}`;
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1) + '\n');

  const row = (s) => `${s.n} | ${s.wr == null ? '-' : Math.round(100 * s.wr) + '%'} | ${f(s.exp)} | ${f(s.R, 1)} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
  const L = [`plan sha256 ${sha}`, result.verdict, '', '| stream | window | n | win | R a trade net | total R | max DD | t (trades) | t (months) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [nm, b] of [['all A-setups', B], ['SMT', V], ['no SMT', N]]) { L.push(`| ${nm} | IS | ${row(b.is)} | ${b.isM.t} |`, `| ${nm} | OOS | ${row(b.oos)} | ${b.oosM.t} |`); }
  L.push('', `T1 OOS monthly t ${V.oosM.t} p ${pT1} Holm ${adj[0]}; IS ${f(V.is.exp)} monthly t ${V.isM.t}; 2x costs OOS ${f(V.oos2x.exp)} (monthly t ${V.oosM2x.t}); gross OOS ${f(V.oosGross.exp)} IS ${f(V.isGross.exp)}`,
    `T2 OOS diff ${f(dO.diff)} t ${dO.t} p ${dO.p} Holm ${adj[1]}`, `T3 IS diff ${f(dI.diff)} t ${dI.t} p ${dI.p} Holm ${adj[2]}`, `checks ${JSON.stringify(checks)}; OOS years positive ${posY} of 3`,
    `placebo: ${placebo.t1AtLeastObserved} of 40 draws reach the observed T1 monthly t; ${placebo.diffAtLeastObserved} of 40 reach the observed OOS difference; placebo T1 t range ${placebo.t1Range.join(' .. ')}`, '',
    '| year | ' + YEARS.join(' | ') + ' |', '|---|' + YEARS.map(() => '---|').join(''));
  for (const [nm, b] of [['all', B], ['SMT', V], ['no SMT', N]]) L.push(`| ${nm} | ` + YEARS.map((y) => `${f(b.years[y].R, 1)} (${b.years[y].n})`).join(' | ') + ' |');
  L.push('', '| market | partner | IS: all / SMT / no SMT | OOS: all / SMT / no SMT |', '|---|---|---|---|');
  for (const k of MK) { const m = markets[k], c = (w) => ['base', 'smt', 'others'].map((q) => `${f(m[q][w].exp)} (${m[q][w].n})`).join(' / '); L.push(`| ${k} | ${PARTNER[k]} | ${c('is')} | ${c('oos')} |`); }
  L.push('', ...[['is', 'IS sized'], ['oos', 'OOS sized'], ['isFlat', 'IS per unit'], ['oosFlat', 'OOS per unit']].map(([w, nm]) => `inside the unfiltered stream, ${nm}: SMT ${f(inBase[w].smt.exp)} (${inBase[w].smt.n}, t ${inBase[w].smt.t}) | no SMT ${f(inBase[w].non.exp)} (${inBase[w].non.n}, t ${inBase[w].non.t})`));
  L.push(`tag reasons: ${JSON.stringify(why)}`, '', 'sources: ' + MK.map((k) => `${k} ${srcs[k].H.length} H1 sha ${srcs[k].sha} unresolved ${meta[k].open} gaps ${meta[k].gaps}`).join('; '));
  console.log(L.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith(path.join('ict-smt', 'run.mjs'))) {
  if (stage === 'fetch') await fetchAll(); else if (stage === 'count') await count(); else if (stage === 'full') await full();
  else { console.error('usage: run.mjs fetch|count|full <cacheDir> [outDir]'); process.exit(1); }
}
