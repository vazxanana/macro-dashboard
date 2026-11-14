// Edge research · cnh-fix: the PBoC USD/CNY fix (09:15 Beijing = 01:15 UTC). USD/CNH's move 01:15-01:30 UTC, when over 0.5x its
// 20-day median, is followed (T1) or faded (T2) from 01:30 to 03:30 UTC, and followed on AUD/USD with the sign mirrored (T3,
// long AUD when CNH strengthens); stop 1x the 20-day median of the traded market's own 01:15-01:30 |move|; OANDA mid M5; costs
// in R (USD/CNH an assumed 3-pip spread, AUD/USD the raw-spread majors). Rules: PREREGISTRATION.md. Method copied from the
// ecb-ref-fix study's run.mjs (branch ecb-ref-fix) and edited here; nothing is imported across branches. The fix level itself
// is not read (no fix series is available): only price behaviour around 01:15 UTC.
//   node research/edge/cnh-fix/run.mjs run <candleDir>     (candles from fetch.mjs; writes result.json)
//   node research/edge/cnh-fix/run.mjs coverage <candleDir>  (USD/CNH days with the move's candles, by year; no trade)
// Pure pieces are exported for tests/cnh-fix.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, MIN = 60;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

export const P = {
  REP: [T('2010-01-01'), T('2018-01-01')],        // replication: every entry the data allows, to 2017-12-31
  DEC: [T('2018-01-01'), T('2026-11-14')],        // decisive: entries 2018-01-01 .. 2026-11-13
  FROM: T('2010-01-01'),
  START: 75,                                      // the fix: 01:15 UTC, minutes after 00:00 UTC of the day
  MOVE: 15, ENTRY: 15, HOLD: 120,                 // move S..S+15 (close of the S+10 candle), entry S+15, exit S+15+120
  REF_N: 20, REF_SPAN: 42,
  EVENT: 0.5, STOP: 1,
  EXIT_SLACK: 900,
  REFORM: T('2015-08-11'),
  SEEDS: 40,
  // 23:00 (the evening before) .. 05:45 UTC in quarter hours, without 01:00, 01:15, 01:30
  PLACEBO_STARTS: Array.from({ length: 28 }, (_, i) => -60 + 15 * i).filter((m) => ![60, 75, 90].includes(m)),
  BAR: { n: 200, pHolm: 0.05, placeboAbove: 38, repYears: 2 },
};
export const PAIRS = {
  usdcnh: { sym: 'usdcnh', name: 'USD/CNH', pip: 1e-4, spreadPips: 3.0, slipPips: 3.0, commRT: 45e-6, costSrc: 'assumed: no USDCNH in ctrader/symbols.json' },
  audusd: { sym: 'audusd', name: 'AUD/USD', pip: 1e-4, spreadPips: 0.3, slipPips: 0.3, commRT: 45e-6, costSrc: 'raw-spread majors (CLAUDE.md Forex spreads)' },
};
// dir: +1 = with USD/CNH's move on the traded market's price; -1 = against it
export const TESTS = {
  T1: { name: 'USD/CNH, follow the 01:15-01:30 UTC move, 01:30-03:30', sym: 'usdcnh', dir: 1 },
  T2: { name: 'USD/CNH, fade the 01:15-01:30 UTC move, 01:30-03:30', sym: 'usdcnh', dir: -1 },
  T3: { name: 'AUD/USD, long AUD when CNH strengthens (follow, sign mirrored), 01:30-03:30', sym: 'audusd', dir: -1 },
};

export const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const windowOf = (t) => (t >= P.DEC[0] && t < P.DEC[1] ? 'dec' : t >= P.REP[0] && t < P.REP[1] ? 'rep' : null);
export const at = (day, m) => day + m * MIN;            // minutes after 00:00 UTC of the day (negative = the evening before)
export function weekdays(from = P.FROM, to = P.DEC[1]) {
  const out = []; for (let d = from; d < to; d += DAY) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out;
}
export function columns(rows) {
  const n = rows.length, t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), ix = new Map();
  for (let i = 0; i < n; i++) { const r = rows[i]; t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; ix.set(r[0], i); }
  return { n, t, o, h, l, c, at: ix };
}
// the move S..S+15: close of the S+10 candle - open of the S candle; null without both
export function moveOf(B, day, S) {
  const i0 = B.at.get(at(day, S)), i1 = B.at.get(at(day, S + P.MOVE - 5));
  return i0 == null || i1 == null ? null : B.c[i1] - B.o[i0];
}
export function median(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length; if (!n) return null;
  return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
// per day: { day, M, ref } with ref from the 20 earlier days that have a move (all within 42 calendar days), else null
export function moves(B, days, S) {
  const hist = [], out = [];
  for (const d of days) {
    let ref = null;
    if (hist.length >= P.REF_N) { const last = hist.slice(-P.REF_N); if (last[0].day >= d - P.REF_SPAN * DAY) ref = median(last.map((x) => x.a)); }
    const M = moveOf(B, d, S);
    out.push({ day: d, M, ref });
    if (M != null) hist.push({ day: d, a: Math.abs(M) });
  }
  return out;
}
export const tradeCost = (pr, entry, k = 1) => k * ((pr.spreadPips + pr.slipPips) * pr.pip + pr.commRT * entry);

// one trade: side +1 buy / -1 sell at the open of the candle at `start`, stop 1 x ref, out at the close of the last candle before `end`
export function simTrade(B, pr, side, ref, start, end) {
  if (!(ref > 0)) return { skip: 'noref' };
  const i0 = B.at.get(start);
  if (i0 == null) return { skip: 'nodata' };
  let iz = i0; while (iz + 1 < B.n && B.t[iz + 1] < end) iz++;
  if (B.t[iz] < end - P.EXIT_SLACK || B.t[iz] >= end) return { skip: 'nodata' };
  const entry = B.o[i0], r0 = P.STOP * ref, stop = entry - side * r0;
  let exit = null, how = 'time';
  for (let i = i0; i <= iz; i++) {
    if (side > 0 ? B.o[i] <= stop : B.o[i] >= stop) { exit = B.o[i]; how = 'gap'; break; }
    if (side > 0 ? B.l[i] <= stop : B.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  if (exit == null) exit = B.c[iz];
  const gross = side * (exit - entry) / r0, cost = tradeCost(pr, entry);
  return { t: start, side, entry, stop, exit, r0, how, gross, costR: cost / r0, net: gross - cost / r0, net2: gross - 2 * cost / r0, sym: pr.sym };
}
// the rule for one day at start S: event from USD/CNH's move x (with its ref), trade on market D (its own ref y)
export function dayTrade(D, X, x, y, S) {
  if (x.M == null) return { skip: 'nomove' };
  if (x.ref == null) return { skip: 'noref' };
  if (!(x.ref > 0 && Math.abs(x.M) > P.EVENT * x.ref)) return { skip: 'noevent' };
  if (!y || y.ref == null) return { skip: 'noref' };
  const side = (x.M > 0 ? 1 : -1) * X.dir, start = at(x.day, S + P.ENTRY);
  return simTrade(D.B, D.pr, side, y.ref, start, start + P.HOLD * MIN);
}

// ─── statistics ───
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const monthOf = (t) => isoDay(t).slice(0, 7);
export function monthSums(trades, key = 'net') { const m = new Map(); for (const x of trades) m.set(monthOf(x.t), (m.get(monthOf(x.t)) || 0) + x[key]); return m; }
export function tOf(vals) { const s = sd(vals); return s > 0 ? mean(vals) / s * Math.sqrt(vals.length) : null; }
export const monthT = (trades, key = 'net') => tOf([...monthSums(trades, key).values()]);
export function normP(t) {   // one-sided p of a z
  if (t == null) return 1;
  const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z);
  const p = 0.5 * (1 - erf); return t >= 0 ? p : 1 - p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function stats(trades) {
  const net = trades.map((x) => x.net); let cum = 0, peak = 0, dd = 0;
  for (const v of net) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const span = trades.length ? (trades.at(-1).t - trades[0].t) / (365.25 * DAY) : 0;
  return { n: trades.length, months: monthSums(trades).size, years: r2(span), from: trades.length ? isoDay(trades[0].t) : null, to: trades.length ? isoDay(trades.at(-1).t) : null,
    gross: r3(mean(trades.map((x) => x.gross))), costR: r3(mean(trades.map((x) => x.costR))),
    exp: r3(mean(net)), exp2: r3(mean(trades.map((x) => x.net2))), R: r2(cum), grossR: r2(trades.reduce((s, x) => s + x.gross, 0)),
    t: r2(monthT(trades)), tGross: r2(monthT(trades, 'gross')), wr: r3(trades.length ? net.filter((v) => v > 0).length / trades.length : null), maxDD: r2(dd),
    exits: { time: trades.filter((x) => x.how === 'time').length, stop: trades.filter((x) => x.how === 'stop').length, gap: trades.filter((x) => x.how === 'gap').length } };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const placeboStart = (u) => P.PLACEBO_STARTS[Math.floor(u * P.PLACEBO_STARTS.length)];

// ─── the study ───
export function study(candles) {
  const days = weekdays(), data = {};
  for (const s of Object.keys(PAIRS)) {
    const B = columns(candles[s]), mv = {};
    for (const S of [P.START, ...P.PLACEBO_STARTS]) mv[S] = moves(B, days, S);
    data[s] = { B, mv, pr: PAIRS[s] };
  }
  const C = data.usdcnh, tests = {}, keys = Object.keys(TESTS);
  keys.forEach((k, ti) => {
    const X = TESTS[k], D = data[X.sym], list = [], fun = { days: 0, nomove: 0, noref: 0, noevent: 0, nodata: 0, trades: 0 };
    C.mv[P.START].forEach((x, i) => {
      if (!windowOf(at(x.day, P.START + P.ENTRY))) return;
      fun.days++;
      const r = dayTrade(D, X, x, D.mv[P.START][i], P.START);
      if (r.skip) { fun[r.skip]++; return; }
      r.day = x.day; list.push(r);
    });
    fun.trades = list.length;
    const dec = list.filter((x) => windowOf(x.t) === 'dec'), rep = list.filter((x) => windowOf(x.t) === 'rep');
    const years = {}; for (const x of list) { const y = isoDay(x.t).slice(0, 4); (years[y] = years[y] || []).push(x); }
    const means = [], gmeans = [];
    for (let seed = 1; seed <= P.SEEDS; seed++) {
      const u = rng(seed * 1000 + ti), got = [], gg = [];
      C.mv[P.START].forEach((_, i) => {
        const S = placeboStart(u()), x = C.mv[S][i];
        if (windowOf(at(x.day, S + P.ENTRY)) !== 'dec') return;
        const r = dayTrade(D, X, x, D.mv[S][i], S); if (!r.skip) { got.push(r.net); gg.push(r.gross); }
      });
      means.push(mean(got)); gmeans.push(mean(gg));
    }
    const ev = fun.days - fun.nomove - fun.noref;
    tests[k] = { name: X.name, sym: X.sym, dir: X.dir, funnel: fun, eventShare: r3(ev > 0 ? (ev - fun.noevent) / ev : null),
      dec: stats(dec), rep: stats(rep),
      reform: { before: stats(rep.filter((x) => x.t < P.REFORM)), after: stats(rep.filter((x) => x.t >= P.REFORM)) },
      years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, exp: r3(mean(a.map((x) => x.net))), gross: r3(mean(a.map((x) => x.gross))) }])),
      placeboMeans: means, placeboGross: gmeans };
  });
  const ps = keys.map((k) => normP(tests[k].dec.t)), adj = holm(ps);
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
  keys.forEach((k, i) => {
    const X = tests[k], pm = X.placeboMeans;
    X.p = r3(ps[i]); X.pHolm = r3(adj[i]);
    X.placebo = { p5: r3(pct(pm, 0.05)), p50: r3(pct(pm, 0.5)), p95: r3(pct(pm, 0.95)), above: pm.filter((m) => m < X.dec.exp).length, of: pm.length, means: pm.map(r3) };
    // added after the first result, reported only (not part of the bar): the same seeds' mean GROSS R a trade
    const pg = X.placeboGross; X.placeboGrossReported = { note: 'added after the first result; not judged', p5: r3(pct(pg, 0.05)), p50: r3(pct(pg, 0.5)), p95: r3(pct(pg, 0.95)), above: pg.filter((m) => m < X.dec.gross).length, of: pg.length };
    delete X.placeboMeans; delete X.placeboGross;
    X.conditions = { net: X.dec.exp > 0 && X.rep.exp > 0, holm: X.dec.t != null && X.dec.t > 0 && adj[i] < P.BAR.pHolm, n: X.dec.n >= P.BAR.n };
    X.pass = Object.values(X.conditions).every(Boolean);
    X.robust = X.pass && X.dec.exp2 > 0 && X.placebo.above >= P.BAR.placeboAbove;
    X.nearMiss = !X.pass && X.dec.exp > 0 && X.dec.t >= 2;
    X.repWeak = !(X.rep.years >= P.BAR.repYears);
  });
  const passed = keys.filter((k) => tests[k].pass);
  return { tests, verdict: passed.length ? 'PASS' : 'FAIL', passed };
}

// USD/CNH days with both candles of the 01:15-01:30 move, by year (no trade is computed)
export function coverage(rows) {
  const B = columns(rows), out = {};
  for (const d of weekdays()) {
    const y = isoDay(d).slice(0, 4), o = out[y] || (out[y] = { weekdays: 0, withMove: 0 });
    o.weekdays++; if (moveOf(B, d, P.START) != null) o.withMove++;
  }
  return { first: isoDay(rows[0][0]), last: isoDay(rows.at(-1)[0]), candles: rows.length, byYear: out };
}

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const load = (dir, s) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${s}-5m.json.gz`))));
if (MODE === 'coverage') console.log(JSON.stringify(coverage(load(process.argv[3], 'usdcnh')), null, 1));
if (MODE === 'run') {
  const DIR = process.argv[3]; if (!DIR) throw new Error('usage: node run.mjs run <candleDir>');
  const candles = {}, info = {};
  for (const s of Object.keys(PAIRS)) { candles[s] = load(DIR, s); const c = candles[s]; info[s] = { m5: c.length, from: isoDay(c[0][0]), to: isoDay(c.at(-1)[0]) }; }
  const cov = coverage(candles.usdcnh);
  const S = study(candles), sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`);
  const lab = (s) => ({ exp: s.exp, R: s.R, n: s.n, wr: s.wr, maxDD: s.maxDD, t: s.t });
  const head = Object.keys(TESTS).map((k) => `${k} ${sg(S.tests[k].dec.exp)}R a trade (n ${S.tests[k].dec.n}, t ${S.tests[k].dec.t})`).join('; ');
  const weak = Object.values(S.tests).some((x) => x.repWeak);
  const out = { topic: 'cnh-fix', built: '2026-11-14',
    system: 'the PBoC USD/CNY fix at 01:15 UTC (the fix level itself is not read): when USD/CNH moves more than 0.5x its 20-day median between 01:15 and 01:30 UTC, follow it (T1) or fade it (T2) on USD/CNH from 01:30 to 03:30 UTC, or follow it on AUD/USD with the sign mirrored (T3, long AUD when CNH strengthens); stop 1x the 20-day median of the traded market\'s own 01:15-01:30 move; OANDA mid M5',
    window: { rep: 'first USD/CNH day with a 20-day reference (2011) to 2017-12-31 (replication)', dec: '2018-01-01 to 2026-11-13 (decisive)' },
    params: P, pairs: PAIRS, testsDef: TESTS, candles: info, coverage: cov,
    unit: 'exp = mean net R a trade after costs (USD/CNH: an assumed 3.0 pip spread + 3.0 pip slippage + 45 USD a million commission a round trip; AUD/USD: 0.3 + 0.3 pip + 45 USD a million; no financing); 1R = the 20-day median |move| of 01:15-01:30 UTC of the traded market; t = t of calendar-month sums of net R',
    verdict: `${S.verdict}: ${S.verdict === 'PASS' ? `${S.passed.join(', ')} pass the bar${S.passed.every((k) => S.tests[k].robust) ? ' and are robust' : ' (not robust: 2x cost or placebo)'}` : 'no test is positive after costs in both windows with a Holm-adjusted p under 0.05 in 2018-26'}${weak ? ' (replication weak: under 2 years of trades)' : ''}. 2018-26 net: ${head}`,
    tests: S.tests,
    baseline: { is: { exp: S.tests.T1.rep.exp, t: S.tests.T1.rep.t }, oos: { exp: S.tests.T1.dec.exp, t: S.tests.T1.dec.t } },
    candidates: Object.keys(TESTS).map((k) => ({ rule: `${k} ${TESTS[k].name}`, verdict: S.tests[k].pass ? 'PASS' : 'FAIL', is: lab(S.tests[k].rep), oos: lab(S.tests[k].dec), years: S.tests[k].years })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(TESTS)) { const X = S.tests[k]; console.error(k, X.name, JSON.stringify(X.funnel), 'events', X.eventShare, '\n dec', JSON.stringify(X.dec), '\n rep', JSON.stringify(X.rep), '\n p', X.p, 'holm', X.pHolm, 'placebo', JSON.stringify({ ...X.placebo, means: undefined }), JSON.stringify(X.conditions), 'robust', X.robust, 'nearMiss', X.nearMiss, 'repWeak', X.repWeak, '\n reform', JSON.stringify(X.reform), '\n years', JSON.stringify(X.years)); }
  console.error(out.verdict);
}
