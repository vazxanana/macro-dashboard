// ICT grades: do the desk's untraded B and C grades carry an edge, does the grade order hold, and would B at half size change
// the desk (preregistration.md, committed before this ran). Extends research/edge/ict-oos-2008/run.mjs (#526): the desk's own
// code, unchanged (signals / isASetup / isAPlus / sizeOf / nfpMorning / letter / MIN_GRADE / MARKETS / inHalt / cmeShut / agg /
// dailyNY from ict/tracker.mjs, simulate from ict/replay.mjs) over the #526 OANDA 5m cache. Every recorded signal (grade >= 3)
// is simulated once, independently; the streams (A = the desk, B, C, A+B half, letter tiers) are then drawn from the same
// simulated trades. Step 1 caches <cacheDir>/grades-trades.json (reused when present); step 2 writes result.json and prints
// the tables for RESULT.md. Paper research only; no desk code is changed.
//   node research/edge/ict-grades/run.mjs <cacheDir> [result.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, MIN_GRADE, signals, isASetup, isAPlus, sizeOf, nfpMorning, letter, inHalt, cmeShut, agg, dailyNY, RISK_FLOOR, RISK_CAP } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';

const [DIR, OUT = 'research/edge/ict-grades/result.json'] = process.argv.slice(2);
if (!DIR) { console.error('usage: run.mjs <cacheDir> [result.json]'); process.exit(1); }
const RAW = path.join(DIR, 'grades-trades.json');
// desk key -> OANDA proxy symbol and one round-trip cost in price units (#526, preregistration.md)
const U = {
  gc: { sym: 'xau', cost: () => 0.5 },
  nq: { sym: 'nas100', cost: (p) => p * 0.0002 + 0.25 },
  es: { sym: 'spx500', cost: (p) => p * 0.0002 + 0.25 },
  ym: { sym: 'us30', cost: (p) => p * 0.0002 + 1 },
};
const MK = Object.keys(U);
const tier = (total) => (total >= 8 ? 'A' : total >= 5 ? 'B' : 'C');   // letter(): A+/A/A- | B+/B/B- | C
// why a non-A signal is not an A-setup (reported for the B-setups): the first failed condition of the desk's rule
function whyNotA(g, key) {
  if (MARKETS[key].aRule === 'gold') return g.side < 0 ? 'sell' : 'stop';
  if (g.feat.bias !== 'against') return 'with-bias';
  if (g.grade.total < 7) return 'grade';
  if (nfpMorning(g.close)) return 'nfp';
  return 'stop';
}

function load(sym) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort(), m5 = [];
  for (const f of files) for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
    if (inHalt(t) || cmeShut(t)) continue;   // the live futures feed's closedBar()
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  }
  return m5.sort((a, b) => a.time - b.time);
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

// ---- step 1: simulate every recorded signal once ----
let J;
if (fs.existsSync(RAW)) { J = JSON.parse(fs.readFileSync(RAW, 'utf8')); console.log('reusing', RAW, J.trades.length, 'trades'); }
else {
  J = { at: new Date().toISOString(), src: {}, trades: [] };
  for (const [key, u] of Object.entries(U)) {
    const t0 = Date.now(), M = MARKETS[key], m5 = load(u.sym), H = agg(m5, 3600), D = dailyNY(H);
    const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
    const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
    const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
    let gaps = 0, open = 0;
    for (const g of sig) {
      const i = lb(H, g.close), j = lb(m5, g.close);
      const t = simulate(g, M, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days }); if (!t) { gaps++; continue; }
      if (!t.closed) { open++; continue; }
      const a = isASetup(g, key);
      J.trades.push([key, g.side, g.close, a ? 1 : 0, a && isAPlus(g, key) ? 1 : 0, a ? sizeOf(g, key) : 1, +t.R.toFixed(3), +(u.cost(g.entry) / g.r0).toFixed(4), g.feat.session, g.feat.atrR, g.feat.bias, g.grade.total, a ? null : whyNotA(g, key), t.exit, t.closed]);
    }
    J.src[key] = { sym: u.sym, m5: m5.length, h1: H.length, d1: D.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10), signals: sig.length, gaps, open };
    console.log(key, JSON.stringify(J.src[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  J.cols = ['market', 'side', 'close', 'aset', 'aplus', 'size', 'Rraw', 'costR', 'session', 'atrR', 'bias', 'grade', 'why', 'exit', 'closed'];
  fs.writeFileSync(RAW, JSON.stringify(J));
}

// ---- step 2: streams, stats, verdicts ----
const T = J.trades.map((r) => Object.fromEntries(J.cols.map((c, i) => [c, r[i]]))).sort((a, b) => a.close - b.close || a.market.localeCompare(b.market));
for (const t of T) { const d = new Date(t.close * 1000); t.year = d.getUTCFullYear(); t.month = `${t.year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; t.tier = tier(t.grade);
  t.cls = t.aset ? 'A' : t.tier === 'A' ? 'A-untraded' : t.tier;   // A-setup | B-setup | C-setup | untraded A-letter
}
const W = { w1: [Date.UTC(2008, 0, 1) / 1000, Date.UTC(2018, 0, 1) / 1000], w2: [Date.UTC(2018, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000] };
const SPLIT = { w1: 2013, w2: 2022 };
const inW = (t, w) => t.close >= W[w][0] && t.close < W[w][1];
const withR = (t, size) => ({ ...t, size, gross: size * t.Rraw, net: size * (t.Rraw - t.costR), net2: size * (t.Rraw - 2 * t.costR) });

// a stream: pick(t) -> size or null; block = 'own' (blocked only by an open trade of the same class) | 'any' (by any open trade of the stream)
// Stream A (the desk) = A-setups, 'own'. Stream A+B half: A blocked only by open A, B blocked by any open trade (the tracker's rule for non-A).
function stream(pick, mode) {
  const out = [], busy = {};   // busy[market] = { A: closedUntil, any: closedUntil }
  for (const t of T) { const size = pick(t); if (size == null) continue;
    const b = busy[t.market] || (busy[t.market] = { A: 0, any: 0 });
    const blockedUntil = mode === 'strict' ? b.any : t.aset ? b.A : b.any;
    if (t.close < blockedUntil) continue;
    out.push(withR(t, size)); b.any = Math.max(b.any, t.closed); if (t.aset) b.A = Math.max(b.A, t.closed); }
  return out;
}
const S = {
  A: stream((t) => (t.aset ? t.size : null)),
  B: stream((t) => (t.cls === 'B' ? 1 : null)),
  C: stream((t) => (t.cls === 'C' ? 1 : null)),
  Aun: stream((t) => (t.cls === 'A-untraded' ? 1 : null)),
  ABhalf: stream((t) => (t.aset ? t.size : t.cls === 'B' ? 0.5 : null)),
  ABhalfStrict: stream((t) => (t.aset ? t.size : t.cls === 'B' ? 0.5 : null), 'strict'),
  ABfull: stream((t) => (t.aset ? t.size : t.cls === 'B' ? 1 : null)),
  letterA: stream((t) => (t.tier === 'A' ? 1 : null), 'strict'),
  letterB: stream((t) => (t.tier === 'B' ? 1 : null), 'strict'),
  letterC: stream((t) => (t.tier === 'C' ? 1 : null), 'strict'),
  all: stream(() => 1, 'strict'),
};

function stats(a, f = 'net') {
  a = [...a].sort((x, y) => x.closed - y.closed);
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
// t of the monthly sums (every calendar month of the window counts, months without a trade as 0)
function monthlyT(a, w, f = 'net') {
  const s = new Map(); for (const x of a) s.set(x.month, (s.get(x.month) || 0) + x[f]);
  const ms = []; for (let t = W[w][0]; t < W[w][1]; ) { const d = new Date(t * 1000), k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; ms.push(s.get(k) || 0); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; }
  const n = ms.length, m = ms.reduce((p, x) => p + x, 0) / n, sd = Math.sqrt(ms.reduce((p, x) => p + (x - m) ** 2, 0) / (n - 1));
  return { months: n, meanR: +m.toFixed(2), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
function block(a, w) {
  const half = SPLIT[w], years = [...new Set(a.map((t) => t.year))].sort();
  return { net: stats(a), net2: stats(a, 'net2'), gross: stats(a, 'gross'), monthly: monthlyT(a, w),
    halves: { split: half, first: stats(a.filter((t) => t.year < half)), second: stats(a.filter((t) => t.year >= half)), first2: stats(a.filter((t) => t.year < half), 'net2'), second2: stats(a.filter((t) => t.year >= half), 'net2') },
    markets: Object.fromEntries(MK.map((m) => { const b = a.filter((t) => t.market === m); return [m, { net: stats(b), net2: stats(b, 'net2'), first: stats(b.filter((t) => t.year < half)), second: stats(b.filter((t) => t.year >= half)) }]; })),
    years: Object.fromEntries(years.map((y) => [y, stats(a.filter((t) => t.year === y))])),
    sides: { buys: stats(a.filter((t) => t.side > 0)), sells: stats(a.filter((t) => t.side < 0)) },
    sessions: Object.fromEntries(['Asia', 'London', 'NY AM', 'NY PM', 'Close'].map((s) => [s, stats(a.filter((t) => t.session === s))])),
    byGrade: Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10].map((g) => [g, stats(a.filter((t) => t.grade === g))]).filter(([, s]) => s.n)) };
}

const out = { built: new Date().toISOString().slice(0, 10), src: J.src, windows: { w1: '2008-01-01..2017-12-31', w2: '2018-01-01..2026-10-31' }, splits: SPLIT,
  cost: 'GC 0.50; NQ, ES 0.0002 x price + 0.25; YM 0.0002 x price + 1 (one round trip, in R = cost / r0)',
  classes: { A: 'isASetup (the desk, sized by sizeOf)', B: 'not an A-setup, grade 5-7', C: 'grade 3-4', 'A-untraded': 'grade >= 8, not an A-setup' },
  counts: {}, streams: {}, verdicts: {} };
for (const w of ['w1', 'w2']) {
  const tw = T.filter((t) => inW(t, w));
  out.counts[w] = { simulated: tw.length, byClass: Object.fromEntries(['A', 'B', 'C', 'A-untraded'].map((c) => [c, tw.filter((t) => t.cls === c).length])),
    byGrade: Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10].map((g) => [g, tw.filter((t) => t.grade === g).length])) };
  out.streams[w] = Object.fromEntries(Object.entries(S).map(([k, a]) => [k, block(a.filter((t) => inW(t, w)), w)]));
  const B = S.B.filter((t) => inW(t, w));
  out.streams[w].B.why = Object.fromEntries(['with-bias', 'grade', 'stop', 'nfp', 'sell'].map((r) => [r, stats(B.filter((t) => t.why === r))]).filter(([, s]) => s.n));
  out.streams[w].B.indices = stats(B.filter((t) => t.market !== 'gc')); out.streams[w].B.indices2 = stats(B.filter((t) => t.market !== 'gc'), 'net2');
  out.streams[w].B.atrBand = { inBand: stats(B.filter((t) => t.atrR != null && t.atrR >= RISK_FLOOR && t.atrR < RISK_CAP)), outOfBand: stats(B.filter((t) => !(t.atrR != null && t.atrR >= RISK_FLOOR && t.atrR < RISK_CAP))) };
  out.streams[w].B.against = stats(B.filter((t) => t.bias === 'against')); out.streams[w].B.with = stats(B.filter((t) => t.bias === 'with'));
}
// the reproduction check (#526: 1,786 closed A-setups, +0.093R a trade net, t 2.58 in 2018-26; 2,235, -0.013, t -0.45 in 2008-17)
out.reproduction = { w2: out.streams.w2.A.net, w1: out.streams.w1.A.net, ref526: { w2: { n: 1786, exp: 0.093, t: 2.58 }, w1: { n: 2235, exp: -0.013, t: -0.45 } },
  ok: out.streams.w2.A.net.n === 1786 && Math.abs(out.streams.w2.A.net.exp - 0.093) < 0.0015 && out.streams.w1.A.net.n === 2235 && Math.abs(out.streams.w1.A.net.exp + 0.013) < 0.0015 };
// H1: Stream B, net x1: exp > 0 and t >= 2 in both windows; exp > 0 at x2 in both; >= 3 of 4 markets > 0 in both
{ const c = {}; for (const w of ['w1', 'w2']) { const b = out.streams[w].B; c[w] = { exp: b.net.exp, t: b.net.t, exp2: b.net2.exp, posMarkets: MK.filter((m) => b.markets[m].net.exp > 0).length,
    p1: b.net.exp > 0 && b.net.t >= 2, p2: b.net2.exp > 0, p3: MK.filter((m) => b.markets[m].net.exp > 0).length >= 3 }; }
  out.verdicts.H1 = { verdict: c.w1.p1 && c.w1.p2 && c.w1.p3 && c.w2.p1 && c.w2.p2 && c.w2.p3 ? 'PASS' : 'FAIL', ...c }; }
// H2: exp A > B > C (net x1) in both windows -> HOLDS; one window -> REGIME-BOUND; else DOES NOT HOLD. Also the letter-tier order.
{ const ord = (w, k = ['A', 'B', 'C']) => { const e = k.map((s) => out.streams[w][s].net.exp); return { exp: Object.fromEntries(k.map((s, i) => [s, e[i]])), holds: e[0] > e[1] && e[1] > e[2] }; };
  const a = ord('w1'), b = ord('w2'), la = ord('w1', ['letterA', 'letterB', 'letterC']), lb2 = ord('w2', ['letterA', 'letterB', 'letterC']);
  out.verdicts.H2 = { verdict: a.holds && b.holds ? 'HOLDS' : a.holds || b.holds ? 'REGIME-BOUND' : 'DOES NOT HOLD', w1: a, w2: b, letterTiers: { w1: la, w2: lb2, verdict: la.holds && lb2.holds ? 'HOLDS' : la.holds || lb2.holds ? 'REGIME-BOUND' : 'DOES NOT HOLD' } }; }
// H3: Stream A+B half vs Stream A: total R and R / maxDD both higher in both windows -> IMPROVES; R or R/DD lower in both -> HURTS; else MIXED
{ const c = {}; for (const w of ['w1', 'w2']) { const a = out.streams[w].A, ab = out.streams[w].ABhalf, s = out.streams[w].ABhalfStrict;
    const rd = (x) => (x.net.maxDD > 0 ? +(x.net.R / x.net.maxDD).toFixed(3) : null);
    c[w] = { A: { n: a.net.n, R: a.net.R, maxDD: a.net.maxDD, rOverDD: rd(a), monthlyT: a.monthly.t }, ABhalf: { n: ab.net.n, R: ab.net.R, maxDD: ab.net.maxDD, rOverDD: rd(ab), monthlyT: ab.monthly.t, aTrades: ab.net.n - S.ABhalf.filter((t) => inW(t, w) && !t.aset).length, bTrades: S.ABhalf.filter((t) => inW(t, w) && !t.aset).length },
      ABhalfStrict: { n: s.net.n, R: s.net.R, maxDD: s.net.maxDD, rOverDD: rd(s), monthlyT: s.monthly.t }, dR: +(ab.net.R - a.net.R).toFixed(1), dDD: +(ab.net.maxDD - a.net.maxDD).toFixed(1),
      better: ab.net.R > a.net.R && rd(ab) > rd(a), worse: ab.net.R < a.net.R || rd(ab) < rd(a) }; }
  out.verdicts.H3 = { verdict: c.w1.better && c.w2.better ? 'IMPROVES' : c.w1.worse && c.w2.worse ? 'HURTS' : 'MIXED', ...c }; }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

// ---- tables ----
const f = (s) => (s.n ? `${s.n} | ${(100 * s.wr).toFixed(0)}% | ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)} | ${s.R >= 0 ? '+' : ''}${s.R.toFixed(1)} | ${s.maxDD.toFixed(1)} | ${s.t}` : '0 | - | - | - | - | -');
console.log('REPRODUCTION', JSON.stringify(out.reproduction));
console.log('H1', JSON.stringify(out.verdicts.H1)); console.log('H2', JSON.stringify(out.verdicts.H2)); console.log('H3', JSON.stringify(out.verdicts.H3));
for (const w of ['w1', 'w2']) { const o = out.streams[w];
  console.log(`\n=== ${w} ${out.windows[w]} counts ${JSON.stringify(out.counts[w])}`);
  console.log('stream | n | wr | exp | R | DD | t || x2 exp (t) | gross exp | monthly t | 1st half exp (t) | 2nd half exp (t) | ' + MK.map((m) => m + ' n/exp').join(' | '));
  for (const k of Object.keys(S)) { const x = o[k]; console.log(`${k} | ${f(x.net)} || ${x.net2.exp} (${x.net2.t}) | ${x.gross.exp} | ${x.monthly.t} | ${x.halves.first.exp} (${x.halves.first.t}) | ${x.halves.second.exp} (${x.halves.second.t}) | ${MK.map((m) => `${x.markets[m].net.n}/${x.markets[m].net.exp}`).join(' | ')}`); }
  console.log('B why:', Object.entries(o.B.why).map(([r, s]) => `${r} ${s.n}/${s.exp}/t${s.t}`).join('  '), '| B indices', f(o.B.indices), '| B against/with', o.B.against.n + '/' + o.B.against.exp, o.B.with.n + '/' + o.B.with.exp, '| B atr in/out', o.B.atrBand.inBand.n + '/' + o.B.atrBand.inBand.exp, o.B.atrBand.outOfBand.n + '/' + o.B.atrBand.outOfBand.exp);
  console.log('by grade (all, strict one-open):', Object.entries(o.all.byGrade).map(([g, s]) => `${g}: ${s.n}/${s.exp}/t${s.t}`).join('  '));
  console.log('B sides', f(o.B.sides.buys), '||', f(o.B.sides.sells), '| B sessions', Object.entries(o.B.sessions).map(([s, x]) => `${s} ${x.n}/${x.exp}`).join('  '));
  console.log('year | A n/R | B n/R | C n/R | A+B½ R');
  for (const y of Object.keys(o.all.years)) console.log(`${y} | ${(o.A.years[y] || { n: 0, R: 0 }).n}/${(o.A.years[y] || { R: 0 }).R} | ${(o.B.years[y] || { n: 0, R: 0 }).n}/${(o.B.years[y] || { R: 0 }).R} | ${(o.C.years[y] || { n: 0, R: 0 }).n}/${(o.C.years[y] || { R: 0 }).R} | ${(o.ABhalf.years[y] || { R: 0 }).R}`);
}
