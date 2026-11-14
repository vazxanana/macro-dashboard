// ICT index A-setups split by SMT at the sweep: the replication on 2008-2019 (edge research, 14 Nov 2026; PREREGISTRATION.md).
// research/edge/ict-smt (2020-26) found, after the fact, that A-setups WITHOUT SMT did better out of sample than those with it.
// This runs the same split on years that study never read. smt.mjs is ict-smt's detector, copied byte for byte (sha256 in the
// pre-registration). Engine: the research lab's runMarket (api/_ictlab.js) = the desk's own signals() / isASetup() / sizeOf() /
// P from ict/tracker.mjs and simulate() from ict/replay.mjs, imported read-only; live sizing and exits; one open trade per
// market per stream. Candles: OANDA mid H1 through the site's keyless proxy (ict-oos-2008's source and path), cached OUTSIDE git,
// cleaned as the live futures feed (17:00 New York hour and CME closures dropped, as ict-oos-2008). Costs as ict-oos-2008.
//
//   node --use-env-proxy research/edge/ict-smt-2008/run.mjs fetch <cacheDir>     download the H1 candles (paced)
//   node research/edge/ict-smt-2008/run.mjs count <cacheDir>                     signal counts only, no outcome
//   node research/edge/ict-smt-2008/run.mjs full  <cacheDir> [outDir]            the test: result.json + tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SMT, PARTNER, tagSignal } from './smt.mjs';

const require = createRequire(import.meta.url);
const lab = require('../../../api/_ictlab.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [stage, CACHE = '/tmp/ict-smt-2008', OUT = HERE] = process.argv.slice(2);
const MD = process.env.ICT_MD_BARS || 'https://meridianx.dev/md/bars';

const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const WARM = ts('2007-06-01'), FROM = ts('2008-01-01'), HALF = ts('2014-01-01'), TO = ts('2020-01-01'), END = ts('2020-01-15');
const YEARS = Array.from({ length: 12 }, (_, i) => 2008 + i);
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000' };
const MK = ['nq', 'es', 'ym', 'rty'];
// one round trip in price units: ict-oos-2008's model (0.02 % of price + one futures tick), RTY added the same way (tick 0.1)
export const COST = { nq: (p) => p * 0.0002 + 0.25, es: (p) => p * 0.0002 + 0.25, ym: (p) => p * 0.0002 + 1, rty: (p) => p * 0.0002 + 0.1 };
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
      for (let a = 0; a < 5 && !j; a++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(40000) }); if (r.ok) j = await r.json(); else await sleep(4000 * (a + 1)); } catch (e) { await sleep(4000 * (a + 1)); } }
      if (!j || !Array.isArray(j.bars)) throw new Error(`${sym}: no answer for ${day(t)}`);
      for (const b of j.bars) if (!b.live && b.time < END) m.set(b.time, [b.time, b.open, b.high, b.low, b.close]);
      await sleep(2500);
    }
    const rows = [...m.values()].sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(CACHE, `${sym}-1h.json`), JSON.stringify(rows));
    console.log(`${k} ${sym}: ${rows.length} H1 ${day(rows[0][0])} → ${day(rows.at(-1)[0])}`);
  }
}

// ---- candles: positive prices, the 17:00 New York hour and CME closures dropped (closedBar, as ict-oos-2008), D1 = dailyNY ----
function load(E) {
  const srcs = {};
  for (const [k, sym] of Object.entries(SYM)) {
    const raw = JSON.parse(fs.readFileSync(path.join(CACHE, `${sym}-1h.json`), 'utf8')), sha = crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 16);
    const H = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))
      .filter((b) => [b.open, b.high, b.low, b.close, b.time].every((v) => isFinite(v) && v > 0) && !E.inHalt(b.time) && !E.cmeShut(b.time))
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
    const tag = tagger(srcs, k), A = aSignals(E, srcs, k), c = (f) => A.filter(f).length, h1 = (g) => g.close < HALF;
    rows.push({ k, p: PARTNER[k], h1: srcs[k].H.length, first: day(srcs[k].H[0].time), a: A.length, a1: c(h1), a2: c((g) => !h1(g)), s1: c((g) => h1(g) && tag(g).smt), s2: c((g) => !h1(g) && tag(g).smt), unj: c((g) => !tag(g).judged) });
  }
  console.log('market | partner | H1 | first | A-setup signals | 2008-13 | 2014-19 | SMT 2008-13 | SMT 2014-19 | share | not judged');
  for (const r of rows) console.log(`${r.k} | ${r.p} | ${r.h1} | ${r.first} | ${r.a} | ${r.a1} | ${r.a2} | ${r.s1} | ${r.s2} | ${Math.round(100 * (r.s1 + r.s2) / r.a)}% | ${r.unj}`);
  const T = rows.reduce((a, r) => ({ a: a.a + r.a, a1: a.a1 + r.a1, a2: a.a2 + r.a2, s1: a.s1 + r.s1, s2: a.s2 + r.s2, unj: a.unj + r.unj }), { a: 0, a1: 0, a2: 0, s1: 0, s2: 0, unj: 0 });
  console.log(`all | | | | ${T.a} | ${T.a1} | ${T.a2} | ${T.s1} | ${T.s2} | ${Math.round(100 * (T.s1 + T.s2) / T.a)}% | ${T.unj}`);
}

// ---- statistics (as ict-smt) ----
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
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// net R of one lab trade (run gross): size x (R per unit - cost / risk); 2x costs = 2 x net - gross
export const netOf = (t, costPx) => +(t.size * (t.Rraw - costPx / t.r0)).toFixed(3);

async function full() {
  const E = await lab.engine(), srcs = load(E);
  const st = (a, f = 'R') => { const s = lab.stats(a.map((t) => t[f])); return { n: s.n, wr: s.winRate, exp: s.avgR, R: s.netR, pf: s.pf, maxDD: s.maxDD, t: s.t }; };
  const yearOf = (t) => new Date(t.t * 1000).getUTCFullYear(), sorted = (a) => [...a].sort((x, y) => x.t - y.t);
  const h1Of = (a) => a.filter((t) => t.t < HALF), h2Of = (a) => a.filter((t) => t.t >= HALF);
  const block = (trades) => { const a = sorted(trades);
    return { all: st(a), gross: st(a, 'gross'), flat: st(a, 'flat'), x2: st(a, 'R2'), lab: st(a, 'Rlab'), h1: st(h1Of(a)), h2: st(h2Of(a)),
      m: monthT(a, FROM, TO), mGross: monthT(a, FROM, TO, 'gross'), m2x: monthT(a, FROM, TO, 'R2'), mH1: monthT(h1Of(a), FROM, HALF), mH2: monthT(h2Of(a), HALF, TO),
      years: Object.fromEntries(YEARS.map((y) => [y, st(a.filter((t) => yearOf(t) === y))])) }; };
  // one stream on one market: the A-rule AND a predicate, checked before the one-open rule (as the lab's filters are). Run gross,
  // costs applied here (ict-oos-2008's model); the lab's own fixed-point cost is kept as Rlab, reported only.
  const run = (k, pred) => { const mk = lab.marketOf(k, E), Ev = pred ? { ...E, isASetup: (g, m) => E.isASetup(g, m) && pred(g) } : E;
    const r = lab.runMarket(Ev, mk, srcs[k], { from: FROM, to: TO, at: END, rule: 'A', filters: {}, params: {}, sizing: 'live', costOn: false });
    return { open: r.trades.filter((t) => t.R == null).length, gaps: r.gaps, trades: r.trades.filter((t) => t.R != null).map((t) => { const R = netOf(t, COST[k](t.entry));
      return { ...t, market: k, R, flat: +(t.Rraw - COST[k](t.entry) / t.r0).toFixed(3), R2: +(2 * R - t.gross).toFixed(3), Rlab: netOf(t, ({ nq: 1.5, es: 0.5, ym: 3, rty: 0.4 })[k]) }; }) }; };
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
  // H1: no-SMT minus SMT, whole window (one-sided Welch); H2: no-SMT alone, t on calendar-month sums (one-sided)
  const d = welch(R(pool(S.non)), R(pool(S.smt))), dH1 = welch(R(h1Of(pool(S.non))), R(h1Of(pool(S.smt)))), dH2 = welch(R(h2Of(pool(S.non))), R(h2Of(pool(S.smt))));
  const dGross = welch(pool(S.non).map((t) => t.gross), pool(S.smt).map((t) => t.gross)), d2x = welch(pool(S.non).map((t) => t.R2), pool(S.smt).map((t) => t.R2));
  const raw = [d.p, N.m.p], adj = holm(raw);

  // placebo: 40 seeded random labels, each signal "SMT" with its market's observed SMT share; same streams, same two statistics
  const share = Object.fromEntries(MK.map((k) => { const A = aSignals(E, srcs, k); return [k, A.filter((g) => tags[k](g).smt).length / A.length]; }));
  const plac = [];
  for (let q = 0; q < PLACEBO; q++) {
    const rng = mulberry32(1000 + q), lab2 = {};
    for (const k of MK) { lab2[k] = new Map(); for (const g of aSignals(E, srcs, k).sort((a, b) => a.close - b.close || a.side - b.side)) lab2[k].set(keyOf(g.side, g.close), rng() < share[k]); }
    const Q = streams((k, g) => !!lab2[k].get(keyOf(g.side, g.close))).S, Vq = pool(Q.smt), Nq = pool(Q.non), w = welch(R(Nq), R(Vq));
    plac.push({ seed: 1000 + q, diff: w.diff, t: w.t, h2t: monthT(Nq, FROM, TO).t, nSmt: Vq.length, nOther: Nq.length });
  }
  const atLeast = (f, x) => plac.filter((p) => p[f] != null && x != null && p[f] >= x).length;
  const placebo = { draws: PLACEBO, seeds: '1000..1039', share: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, +v.toFixed(3)])),
    diffAtLeastObserved: atLeast('diff', d.diff), tAtLeastObserved: atLeast('t', d.t), h2tAtLeastObserved: atLeast('h2t', N.m.t),
    diffRange: [Math.min(...plac.map((p) => p.diff)), Math.max(...plac.map((p) => p.diff))], tRange: [Math.min(...plac.map((p) => p.t)), Math.max(...plac.map((p) => p.t))], draws_: plac };

  const checks = {
    nSmt30: V.all.n >= 30,
    h1T2: d.t != null && d.t >= 2, h1Holm: adj[0] < 0.05, h1Placebo: placebo.diffAtLeastObserved <= 2, h1x2: d2x.diff != null && d2x.diff > 0,
    h2T2: N.m.t != null && N.m.t >= 2, h2Holm: adj[1] < 0.05, h2x2: N.x2.exp != null && N.x2.exp > 0,
  };
  const h1Pass = checks.nSmt30 && checks.h1T2 && checks.h1Holm && checks.h1Placebo && checks.h1x2;
  const h2Pass = checks.h2T2 && checks.h2Holm && checks.h2x2;
  const verdict = !checks.nSmt30 ? 'INCONCLUSIVE' : h1Pass ? 'PASS' : !(d.diff > 0) ? 'FAIL' : 'INCONCLUSIVE';

  const baseAll = pool(S.base), split = (per, f = 'R') => ({ smt: st(baseAll.filter((t) => per(t) && t.smt), f), non: st(baseAll.filter((t) => per(t) && !t.smt), f) });
  const inBase = { all: split(() => true), flat: split(() => true, 'flat') };
  const markets = Object.fromEntries(MK.map((k) => [k, { partner: PARTNER[k], base: st(S.base[k]), smt: st(S.smt[k]), others: st(S.non[k]), diff: welch(R(S.non[k]), R(S.smt[k])) }]));
  const why = {}; for (const k of MK) for (const v of tags[k].memo.values()) why[v.why] = (why[v.why] || 0) + 1;

  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const smtSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'smt.mjs'))).digest('hex');
  const ys = (b) => Object.fromEntries(YEARS.map((y) => [y, b.years[y].R]));
  const f = (x, dd = 3) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(dd));
  const result = {
    topic: 'ict-smt-2008', built: '2026-11-14',
    system: 'ICT desk index A-setups (H1 iFVG reversal) split by SMT divergence at the sweep, replicated on 2008-2019: is "skip the SMT setups" (found after the fact by ict-smt on 2020-26) there on years ict-smt never read? Lab engine api/_ictlab.js runMarket on OANDA mid H1: NAS100, SPX500, US30, US2000',
    preregistered: 'PREREGISTRATION.md (committed and pushed alone before the full stage ran)', planSha256: sha, smtSha256: smtSha,
    window: { from: day(FROM), to: day(TO - 1), halves: [`${day(FROM)} to ${day(HALF - 1)}`, `${day(HALF)} to ${day(TO - 1)}`], candlesTo: day(END - 1), split: 'none: the whole window is the replication (no in-sample / out-of-sample split inside it)' },
    definition: { ...SMT, partners: PARTNER, text: 'ict-smt smt.mjs, copied byte for byte: buy = the sweep candle takes a confirmed, untouched H1 swing low (3 a side, last 96 candles; the most recent one taken) while the partner index never trades below its lowest low of the swing\'s 7-candle window, up to and including the sweep candle; sells mirror' },
    sources: Object.fromEntries(MK.map((k) => [k, { src: srcs[k].src, h1: srcs[k].H.length, first: day(srcs[k].H[0].time), last: new Date(srcs[k].H.at(-1).time * 1000).toISOString().slice(0, 16), sha256: srcs[k].sha, unresolved: meta[k].open, gaps: meta[k].gaps }])),
    costs: 'one round trip = 0.02 % of price + one futures tick (NQ, ES 0.25; YM 1; RTY 0.1): ict-oos-2008\'s model, RTY added the same way; net R = size x (R - cost / risk); live sizing (sizeOf); 2x costs = 2 x net - gross; the lab\'s fixed points (NQ 1.5, ES 0.5, YM 3, RTY 0.4) reported only; no financing (out within 36 H1 candles; the desk trades futures)',
    variantsTried: 1, testsJudged: 2, multipleTesting: 'Holm over H1 (one-sided Welch on trades) and H2 (one-sided t on calendar-month sums)',
    verdict: '',
    tests: {
      H1: { what: 'no-SMT minus SMT A-setups, net, 2008-2019 (one-sided Welch)', ...d, holmP: adj[0], nSmt: V.all.n, nOther: N.all.n, smtExp: V.all.exp, otherExp: N.all.exp, gross: dGross, x2: d2x, halves: { first: dH1, second: dH2 } },
      H2: { what: 'no-SMT A-setups alone, net > 0, 2008-2019 (t on calendar-month sums)', n: N.all.n, exp: N.all.exp, R: N.all.R, tTrades: N.all.t, month: N.m, holmP: adj[1], gross: { exp: N.gross.exp, month: N.mGross }, x2: { exp: N.x2.exp, month: N.m2x } },
    },
    checks, h1Pass, h2Pass, placebo,
    streams: {
      unfiltered: { all: B.all, gross: B.gross, x2: B.x2, lab: B.lab, h1: B.h1, h2: B.h2, m: B.m, years: ys(B), yearStats: B.years },
      smt: { all: V.all, gross: V.gross, x2: V.x2, lab: V.lab, flat: V.flat, h1: V.h1, h2: V.h2, m: V.m, mH1: V.mH1, mH2: V.mH2, years: ys(V), yearStats: V.years },
      others: { all: N.all, gross: N.gross, x2: N.x2, lab: N.lab, flat: N.flat, h1: N.h1, h2: N.h2, m: N.m, mH1: N.mH1, mH2: N.mH2, years: ys(N), yearStats: N.years },
    },
    candidates: [{ rule: 'index A-setups WITHOUT SMT at the sweep (skip the SMT ones)', test: 'H1', verdict, all: N.all, smt: V.all, years: ys(N) }],
    markets, reportedNotJudged: { insideTheUnfilteredStream: inBase, tagReasons: why },
    trades: sorted(pool(S.smt).concat(pool(S.non))).map((t) => ({ d: day(t.t), m: t.market, side: t.side, smt: S.smt[t.market].includes(t), R: t.R })),
    notes: 'Pre-registered (sha256 above). 2008-01-01 to 2019-12-31, a window ict-smt (2020-26) never read. The unfiltered A-rule on 2008-17 was already read by ict-oos-2008; the SMT split never was. OANDA cash CFDs stand in for the futures the desk trades. Every simulated trade keeps the engine\'s own stop. Paper research: no live rule, tracker, replay or desk change.',
  };
  result.verdict = verdict === 'PASS' ? `PASS: no-SMT A-setups beat SMT ones by ${f(d.diff)}R a trade net 2008-19 (n ${N.all.n} vs ${V.all.n}, Welch t ${d.t}, Holm p ${adj[0]})`
    : !checks.nSmt30 ? `INCONCLUSIVE: too few SMT trades (${V.all.n})`
    : `${verdict}: no-SMT minus SMT A-setups ${f(d.diff)}R a trade net 2008-19 (Welch t ${d.t}; n ${N.all.n} vs ${V.all.n}); no-SMT alone ${f(N.all.exp)}R, monthly t ${N.m.t}`;
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1) + '\n');

  const row = (s) => `${s.n} | ${s.wr == null ? '-' : Math.round(100 * s.wr) + '%'} | ${f(s.exp)} | ${f(s.R, 1)} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
  const L = [`plan sha256 ${sha}`, `smt.mjs sha256 ${smtSha}`, result.verdict, '', '| stream | window | n | win | R a trade net | total R | max DD | t (trades) | t (months) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [nm, b] of [['all A-setups', B], ['SMT', V], ['no SMT', N]]) L.push(`| ${nm} | 2008-19 | ${row(b.all)} | ${b.m.t} |`, `| ${nm} | 2008-13 | ${row(b.h1)} | ${(b.mH1 || {}).t ?? '-'} |`, `| ${nm} | 2014-19 | ${row(b.h2)} | ${(b.mH2 || {}).t ?? '-'} |`);
  L.push('', `H1 diff ${f(d.diff)} t ${d.t} p ${d.p} Holm ${adj[0]}; halves ${f(dH1.diff)} (t ${dH1.t}) / ${f(dH2.diff)} (t ${dH2.t}); gross ${f(dGross.diff)} (t ${dGross.t}); 2x ${f(d2x.diff)} (t ${d2x.t})`,
    `H2 no-SMT ${f(N.all.exp)} n ${N.all.n} monthly t ${N.m.t} p ${N.m.p} Holm ${adj[1]}; gross ${f(N.gross.exp)} (month t ${N.mGross.t}); 2x ${f(N.x2.exp)} (month t ${N.m2x.t}); lab costs ${f(N.lab.exp)}`,
    `SMT gross ${f(V.gross.exp)} net ${f(V.all.exp)} 2x ${f(V.x2.exp)} lab ${f(V.lab.exp)}; unfiltered gross ${f(B.gross.exp)} net ${f(B.all.exp)} month t ${B.m.t}`,
    `checks ${JSON.stringify(checks)}`,
    `placebo: ${placebo.diffAtLeastObserved} of 40 reach the observed difference (range ${placebo.diffRange.join(' .. ')}); ${placebo.tAtLeastObserved} reach its t (range ${placebo.tRange.join(' .. ')}); ${placebo.h2tAtLeastObserved} reach the H2 monthly t; shares ${JSON.stringify(placebo.share)}`, '',
    '| year | ' + YEARS.join(' | ') + ' |', '|---|' + YEARS.map(() => '---|').join(''));
  for (const [nm, b] of [['all', B], ['SMT', V], ['no SMT', N]]) L.push(`| ${nm} | ` + YEARS.map((y) => `${f(b.years[y].R, 1)} (${b.years[y].n})`).join(' | ') + ' |');
  L.push('', '| market | partner | all | SMT | no SMT | diff (t) |', '|---|---|---|---|---|---|');
  for (const k of MK) { const m = markets[k]; L.push(`| ${k} | ${PARTNER[k]} | ${f(m.base.exp)} (${m.base.n}) | ${f(m.smt.exp)} (${m.smt.n}) | ${f(m.others.exp)} (${m.others.n}) | ${f(m.diff.diff)} (${m.diff.t}) |`); }
  L.push('', `inside the unfiltered stream, sized: SMT ${f(inBase.all.smt.exp)} (${inBase.all.smt.n}) | no SMT ${f(inBase.all.non.exp)} (${inBase.all.non.n}); per unit SMT ${f(inBase.flat.smt.exp)} | no SMT ${f(inBase.flat.non.exp)}`);
  L.push(`tag reasons: ${JSON.stringify(why)}`, '', 'sources: ' + MK.map((k) => `${k} ${srcs[k].H.length} H1 from ${day(srcs[k].H[0].time)} sha ${srcs[k].sha} unresolved ${meta[k].open} gaps ${meta[k].gaps}`).join('; '));
  console.log(L.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith(path.join('ict-smt-2008', 'run.mjs'))) {
  if (stage === 'fetch') await fetchAll(); else if (stage === 'count') await count(); else if (stage === 'full') await full();
  else { console.error('usage: run.mjs fetch|count|full <cacheDir> [outDir]'); process.exit(1); }
}
