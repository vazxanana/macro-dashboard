// ICT A-setups: did the sweep take relative equal lows / highs, or one swing only? (edge research, 11 Nov 2026)
// Pre-registered in PREREGISTRATION.md before the `full` stage, the only stage that computes an outcome, ran.
// Engine: the research lab's runMarket (api/_ictlab.js) = the desk's own signals() / isASetup() / sizeOf() / P from ict/tracker.mjs and
// simulate() from ict/replay.mjs, imported read-only; one open trade per market per stream; the lab's round-trip costs.
// Candles: OANDA mid H1 through the site's keyless proxy, cached OUTSIDE git.
//
//   node --use-env-proxy research/edge/ict-equal-lows/run.mjs fetch <cacheDir>     download the H1 candles (paced)
//   node research/edge/ict-equal-lows/run.mjs count <cacheDir>                     signal counts only, no outcome
//   node research/edge/ict-equal-lows/run.mjs full  <cacheDir> [outDir]            the test: result.json + tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EQ, tagSignal } from './eq.mjs';

const require = createRequire(import.meta.url);
const lab = require('../../../api/_ictlab.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [stage, CACHE = '/tmp/claude-0/ict-gap', OUT = HERE] = process.argv.slice(2);
const MD = process.env.ICT_MD_BARS || 'https://macro-dashboard-xau.vercel.app/md/bars';

const ts = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const WARM = ts('2019-06-01'), FROM = ts('2020-01-01'), OOS = ts('2024-01-01'), TO = ts('2026-11-01'), END = ts('2026-11-10');
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], OOSY = [2024, 2025, 2026];
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30', rty: 'us2000', gc: 'xau' };
const BOOKS = { all: ['nq', 'es', 'ym', 'rty', 'gc'], index: ['nq', 'es', 'ym', 'rty'], gold: ['gc'] };
const TESTS = [['T1', 'all', 'All five markets'], ['T2', 'index', 'Index book (NQ, ES, YM, RTY)'], ['T3', 'gold', 'Gold (GC)']];
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
  }
  return srcs;
}
const tagger = (srcs, k, o = EQ) => { const s = srcs[k], memo = new Map(), fn = (g) => { const id = g.side + ':' + g.t; if (!memo.has(id)) memo.set(id, tagSignal(g, s.H, s.D, s.index, o)); return memo.get(id); }; fn.seen = (side, t) => memo.get(side + ':' + t); return fn; };

// ---- stage count: how many A-setup signals, and how many swept an equal pool. No trade is simulated, no outcome is read. ----
async function count() {
  const E = await lab.engine(), srcs = load(E), rows = [];
  for (const k of BOOKS.all) {
    const s = srcs[k], mk = lab.marketOf(k, E), tag = tagger(srcs, k);
    const sig = E.signals(s.H, s.D, 1, mk.M.tick).concat(E.signals(s.H, s.D, -1, mk.M.tick)).filter((g) => g.close >= FROM && g.close < TO && g.grade.total >= E.MIN_GRADE);
    const A = sig.filter((g) => E.isASetup(g, k)), c = (a, f) => a.filter(f).length, isIS = (g) => g.close < OOS;
    rows.push({ k, h1: s.H.length, signals: sig.length, a: A.length, aIS: c(A, isIS), aOOS: c(A, (g) => !isIS(g)), eqIS: c(A, (g) => isIS(g) && tag(g).eq), eqOOS: c(A, (g) => !isIS(g) && tag(g).eq) });
  }
  console.log('market | H1 | signals | A-setup signals | A IS | A OOS | equal-pool IS | equal-pool OOS | share');
  for (const r of rows) console.log(`${r.k} | ${r.h1} | ${r.signals} | ${r.a} | ${r.aIS} | ${r.aOOS} | ${r.eqIS} | ${r.eqOOS} | ${Math.round(100 * (r.eqIS + r.eqOOS) / r.a)}%`);
  const T = rows.reduce((a, r) => ({ a: a.a + r.a, aIS: a.aIS + r.aIS, aOOS: a.aOOS + r.aOOS, eqIS: a.eqIS + r.eqIS, eqOOS: a.eqOOS + r.eqOOS }), { a: 0, aIS: 0, aOOS: 0, eqIS: 0, eqOOS: 0 });
  console.log(`all | | | ${T.a} | ${T.aIS} | ${T.aOOS} | ${T.eqIS} | ${T.eqOOS} | ${Math.round(100 * (T.eqIS + T.eqOOS) / T.a)}%`);
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

async function full() {
  const E = await lab.engine(), srcs = load(E);
  const st = (a, f = 'R') => { const s = lab.stats(a.map((t) => t[f])); return { n: s.n, wr: s.winRate, exp: s.avgR, R: s.netR, pf: s.pf, maxDD: s.maxDD, t: s.t }; };
  const yearOf = (t) => new Date(t.t * 1000).getUTCFullYear(), sorted = (a) => [...a].sort((x, y) => x.t - y.t);
  const block = (trades) => { const a = sorted(trades), is = a.filter((t) => t.t < OOS), oos = a.filter((t) => t.t >= OOS);
    return { all: st(a), is: st(is), oos: st(oos), oosGross: st(oos, 'gross'), oosFlat: st(oos, 'flat'), isFlat: st(is, 'flat'), years: Object.fromEntries(YEARS.map((y) => [y, st(a.filter((t) => yearOf(t) === y))])) }; };
  // one stream on one market: the A-rule AND a predicate, checked before the one-open rule (as the lab's filters are)
  const run = (k, pred) => { const mk = lab.marketOf(k, E), Ev = pred ? { ...E, isASetup: (g, m) => E.isASetup(g, m) && pred(g) } : E, s = srcs[k];
    const r = lab.runMarket(Ev, mk, s, { from: FROM, to: TO, at: END, rule: 'A', filters: {}, params: {}, sizing: 'live', costOn: true });
    return { open: r.trades.filter((t) => t.R == null).length, gaps: r.gaps, trades: r.trades.filter((t) => t.R != null).map((t) => ({ ...t, market: k, flat: +(t.R / t.size).toFixed(3) })) }; };
  const streams = (o) => { const S = { base: {}, eq: {}, non: {} }, meta = {};
    for (const k of BOOKS.all) { const tag = tagger(srcs, k, o), b = run(k, (g) => (tag(g), true)), e = run(k, (g) => tag(g).eq), n = run(k, (g) => !tag(g).eq);
      S.base[k] = b.trades; S.eq[k] = e.trades; S.non[k] = n.trades; meta[k] = { open: b.open, gaps: b.gaps, tag };
      for (const t of b.trades) t.eq = tag.seen(t.side === 'buy' ? 1 : -1, +t.id.split('-')[2]).eq; }
    return { S, meta }; };
  const pool = (by, ks) => ks.flatMap((k) => by[k]);

  const { S, meta } = streams(EQ);
  const rows = TESTS.map(([id, book, name]) => {
    const ks = BOOKS[book], B = block(pool(S.base, ks)), V = block(pool(S.eq, ks)), N = block(pool(S.non, ks));
    const oosOf = (a) => a.filter((t) => t.t >= OOS).map((t) => t.R), isOf = (a) => a.filter((t) => t.t < OOS).map((t) => t.R);
    const dO = welch(oosOf(pool(S.eq, ks)), oosOf(pool(S.non, ks))), dI = welch(isOf(pool(S.eq, ks)), isOf(pool(S.non, ks)));
    const posY = OOSY.filter((y) => V.years[y].n && V.years[y].R > 0).length;
    const checks = { oosN30: V.oos.n >= 30, isPositive: V.is.exp != null && V.is.exp > 0, oosPositive: V.oos.exp != null && V.oos.exp > 0, oosYears: posY >= 2,
      oosBeatsBase: V.oos.exp != null && V.oos.exp > B.oos.exp, isBeatsBase: V.is.exp != null && V.is.exp > B.is.exp };
    return { id, book, name, B, V, N, dO, dI, posY, checks, markets: Object.fromEntries(ks.map((k) => [k, { base: block(S.base[k]), eq: block(S.eq[k]), non: block(S.non[k]) }])) };
  });
  const adj = holm(rows.map((r) => r.dO.p));
  rows.forEach((r, i) => { r.holmP = adj[i]; r.checks.holm = adj[i] < 0.05;
    const fail = !r.checks.oosBeatsBase || !r.checks.oosPositive;
    r.verdict = Object.values(r.checks).every(Boolean) ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE'; r.strong = r.V.oos.t != null && r.V.oos.t >= 2; });

  // reported, not judged: other tolerances, on the pooled five markets
  const sens = [0.05, 0.2].map((tol) => { const q = streams({ ...EQ, tol }).S; const V = block(pool(q.eq, BOOKS.all)), N = block(pool(q.non, BOOKS.all));
    return { tol, eq: { is: V.is, oos: V.oos }, non: { is: N.is, oos: N.oos }, oosDiff: welch(pool(q.eq, BOOKS.all).filter((t) => t.t >= OOS).map((t) => t.R), pool(q.non, BOOKS.all).filter((t) => t.t >= OOS).map((t) => t.R)) }; });
  // the split inside the unfiltered stream itself (the same trades, tagged), per unit and sized
  const baseAll = pool(S.base, BOOKS.all), split = (f, per) => ({ eq: st(baseAll.filter((t) => per(t) && t.eq), f), non: st(baseAll.filter((t) => per(t) && !t.eq), f) });
  const inBase = { is: split('R', (t) => t.t < OOS), oos: split('R', (t) => t.t >= OOS), isFlat: split('flat', (t) => t.t < OOS), oosFlat: split('flat', (t) => t.t >= OOS) };

  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const passes = rows.filter((r) => r.verdict === 'PASS'), incs = rows.filter((r) => r.verdict === 'INCONCLUSIVE');
  const verdict = passes.length ? `PASS for ${passes.map((r) => r.id + ' ' + r.book).join(', ')}; the other ${rows.length - passes.length} do not pass`
    : `FAIL. None of the ${rows.length} pre-registered tests passes${incs.length ? ` (${incs.length} inconclusive: ${incs.map((r) => r.id + ' ' + r.book).join(', ')})` : ''}; the A-rule stays as it is`;
  const cand = (r, which, label) => ({ rule: `${r.id} · ${r.book}: ${label}`, test: r.id, book: r.book, verdict: which === 'V' ? r.verdict : 'reference', is: r[which].is, oos: r[which].oos, all: r[which].all,
    years: Object.fromEntries(YEARS.map((y) => [y, r[which].years[y].R])), yearStats: r[which].years, oosGross: r[which].oosGross, oosFlat: r[which].oosFlat, isFlat: r[which].isFlat });
  const T1 = rows[0];
  const result = {
    topic: 'ict-equal-lows', built: '2026-11-11',
    system: 'ICT desk A-setups (H1 iFVG reversal) split by what the sweep took: a pool of relative equal lows / highs vs a single low / high. Lab engine api/_ictlab.js runMarket (the desk\'s signals / isASetup / sizeOf / simulate) on OANDA mid H1: NAS100, SPX500, US30, US2000, XAU',
    preregistered: 'PREREGISTRATION.md (committed and pushed before the full stage ran)', planSha256: sha,
    window: { from: day(FROM), to: day(TO - 1), is: `${day(FROM)} to ${day(OOS - 1)}`, oos: `${day(OOS)} to ${day(TO - 1)}`, candlesTo: day(END - 1) },
    definition: { ...EQ, text: 'the sweep candle trades through two or more confirmed, untouched H1 swing lows (3 candles each side, last 96 H1 candles, at least 4 candles apart) whose lows are within 0.1 x the daily ATR(14) of each other; sells mirror' },
    sources: Object.fromEntries(BOOKS.all.map((k) => [k, { src: srcs[k].src, h1: srcs[k].H.length, first: day(srcs[k].H[0].time), last: new Date(srcs[k].H.at(-1).time * 1000).toISOString().slice(0, 16), sha256: srcs[k].sha, unresolved: meta[k].open, gaps: meta[k].gaps }])),
    costs: 'lab COST round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5; net R = size x (R - cost / risk); live sizing (sizeOf)',
    variantsTried: 1, testsJudged: rows.length, multipleTesting: 'Holm over the 3 pre-registered tests (one-sided Welch, equal-pool stream vs the other A-setups, out of sample, normal approximation)',
    verdict,
    baseline: Object.fromEntries(rows.map((r) => [r.book, { is: r.B.is, oos: r.B.oos, all: r.B.all, years: Object.fromEntries(YEARS.map((y) => [y, r.B.years[y].R])), yearStats: r.B.years, oosGross: r.B.oosGross, oosFlat: r.B.oosFlat }])),
    candidates: rows.map((r) => ({ ...cand(r, 'V', 'A-setups whose sweep took relative equal lows / highs'), checks: r.checks, strong: r.strong, oosYearsPositive: `${r.posY} of 3`,
      vsBaseline: { isExp: +(r.V.is.exp - r.B.is.exp).toFixed(3), oosExp: +(r.V.oos.exp - r.B.oos.exp).toFixed(3) },
      vsOthers: { is: r.dI, oos: r.dO, holmP: r.holmP }, others: { is: r.N.is, oos: r.N.oos, all: r.N.all, years: Object.fromEntries(YEARS.map((y) => [y, r.N.years[y].R])) },
      markets: Object.fromEntries(Object.entries(r.markets).map(([k, m]) => [k, { base: { is: m.base.is, oos: m.base.oos }, eq: { is: m.eq.is, oos: m.eq.oos }, others: { is: m.non.is, oos: m.non.oos } }])) })),
    reportedNotJudged: { tolerance: sens, insideTheUnfilteredStream: inBase },
    trades: sorted(pool(S.eq, BOOKS.all)).map((t) => ({ d: day(t.t), m: t.market, side: t.side, R: t.R })),
    notes: 'Pre-registered (sha256 above). IS 2020-23, OOS 2024-01-01 to 2026-10-31. OANDA cash CFDs stand in for the futures the desk trades; levels differ, the structure is the same. Every simulated trade keeps the engine\'s own stop. Paper research: no live rule, tracker, replay or desk change.',
  };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1) + '\n');

  const f = (x, d = 3) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(d));
  const row = (s) => `${s.n} | ${s.wr == null ? '-' : Math.round(100 * s.wr) + '%'} | ${f(s.exp)} | ${f(s.R, 1)} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
  const L = [`plan sha256 ${sha}`, verdict, ''];
  for (const r of rows) {
    L.push(`## ${r.id} ${r.name}: ${r.verdict}${r.strong ? ' (strong)' : ''}`, '', '| stream | window | n | win | R a trade net | total R | max DD | t |', '|---|---|---|---|---|---|---|---|');
    for (const [nm, b] of [['all A-setups (unfiltered)', r.B], ['equal pool swept', r.V], ['other A-setups', r.N]]) for (const w of ['is', 'oos']) L.push(`| ${nm} | ${w.toUpperCase()} | ${row(b[w])} |`);
    L.push('', `equal pool vs others: IS diff ${f(r.dI.diff)} (t ${r.dI.t}), OOS diff ${f(r.dO.diff)} (t ${r.dO.t}, one-sided p ${r.dO.p}, Holm ${r.holmP})`, `checks ${JSON.stringify(r.checks)}; OOS years positive ${r.posY} of 3`, '',
      '| year | ' + YEARS.join(' | ') + ' |', '|---|' + YEARS.map(() => '---|').join(''),
      '| unfiltered | ' + YEARS.map((y) => `${f(r.B.years[y].R, 1)} (${r.B.years[y].n})`).join(' | ') + ' |', '| equal pool | ' + YEARS.map((y) => `${f(r.V.years[y].R, 1)} (${r.V.years[y].n})`).join(' | ') + ' |', '| others | ' + YEARS.map((y) => `${f(r.N.years[y].R, 1)} (${r.N.years[y].n})`).join(' | ') + ' |', '');
  }
  L.push('## By market (R a trade net, n): unfiltered | equal pool | others', '', '| market | IS | OOS |', '|---|---|---|');
  for (const k of BOOKS.all) { const m = T1.markets[k], c = (w) => ['base', 'eq', 'non'].map((q) => `${f(m[q][w].exp)} (${m[q][w].n})`).join(' | '); L.push(`| ${k} | ${c('is')} | ${c('oos')} |`); }
  L.push('', '## Reported, not judged', '');
  for (const s of sens) L.push(`tolerance ${s.tol}: equal pool IS ${f(s.eq.is.exp)} (${s.eq.is.n}) OOS ${f(s.eq.oos.exp)} (${s.eq.oos.n}); others IS ${f(s.non.is.exp)} (${s.non.is.n}) OOS ${f(s.non.oos.exp)} (${s.non.oos.n}); OOS diff ${f(s.oosDiff.diff)} t ${s.oosDiff.t}`);
  for (const [w, lab2] of [['is', 'IS sized'], ['oos', 'OOS sized'], ['isFlat', 'IS per unit'], ['oosFlat', 'OOS per unit']]) L.push(`inside the unfiltered stream, ${lab2}: equal pool ${f(inBase[w].eq.exp)} (${inBase[w].eq.n}, t ${inBase[w].eq.t}) | others ${f(inBase[w].non.exp)} (${inBase[w].non.n}, t ${inBase[w].non.t})`);
  L.push(`flat size, T1: unfiltered IS ${f(T1.B.isFlat.exp)} OOS ${f(T1.B.oosFlat.exp)}; equal pool IS ${f(T1.V.isFlat.exp)} OOS ${f(T1.V.oosFlat.exp)}; gross OOS unfiltered ${f(T1.B.oosGross.exp)} equal pool ${f(T1.V.oosGross.exp)}`);
  L.push('', 'sources: ' + BOOKS.all.map((k) => `${k} ${srcs[k].H.length} H1 ${day(srcs[k].H[0].time)} → ${day(srcs[k].H.at(-1).time)} sha ${srcs[k].sha} unresolved ${meta[k].open} gaps ${meta[k].gaps}`).join('; '));
  console.log(L.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith(path.join('ict-equal-lows', 'run.mjs'))) {
  if (stage === 'fetch') await fetchAll(); else if (stage === 'count') await count(); else if (stage === 'full') await full();
  else { console.error('usage: run.mjs fetch|count|full <cacheDir> [outDir]'); process.exit(1); }
}
