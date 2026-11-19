// Edge research · gold-h1-vortex: trade a turn of the Vortex indicator on spot gold's H1 candles for 24 hours, against the
// same-side trade taken on every eligible hour of the month (gold's own drift). Rules: PREREGISTRATION.md (pushed alone first).
// A stand-alone rule: not a gate, exit, entry or size of the live gold book (owner decision 44). Paper research only.
//
//   node research/edge/gold-h1-vortex/run.mjs <xau-h1.json>   -> result.json + RESULT.md in this folder
//
// Candle file ([[t, o, h, l, c], ...], OANDA mid XAU_USD, UTC candle start) is kept out of the repository.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H1 = 3600;
export const P = {
  N1: 14, N2: 42, ATR: 14, WARM: 200, STOP: 1.5, HOLD: 24, NEXT: 3 * H1, GAP: 6 * H1,
  COST: 0.60, FIN: FIN.xau.long, IS: ['2007-01-01', '2017-01-01'], OOS: ['2017-01-01', '2026-11-01'], HALF: '2022-01-01',
  SEEDS: 40, BEATS: 38, MIN_N: 200,
};

// ── indicators: ATR(14) Wilder and Vortex(N) for each N, each from candles at or before i ──
export function prepare(rows, Ns = [P.N1, P.N2]) {
  const C = rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c, vi: {} }));
  const n = C.length, A = P.ATR, tr = new Array(n).fill(0), vp = new Array(n).fill(0), vm = new Array(n).fill(0);
  let atr = null; const first = [];
  for (let i = 1; i < n; i++) {
    const b = C[i], a = C[i - 1];
    tr[i] = Math.max(b.h - b.l, Math.abs(b.h - a.c), Math.abs(b.l - a.c));
    vp[i] = Math.abs(b.h - a.l); vm[i] = Math.abs(b.l - a.h);
    if (atr == null) { first.push(tr[i]); if (first.length === A) atr = first.reduce((x, y) => x + y, 0) / A; } else atr = (atr * (A - 1) + tr[i]) / A;
    b.atr = atr;
  }
  for (const N of Ns) {
    let sT = 0, sP = 0, sM = 0;
    for (let i = 1; i < n; i++) {
      sT += tr[i]; sP += vp[i]; sM += vm[i];
      if (i > N) { sT -= tr[i - N]; sP -= vp[i - N]; sM -= vm[i - N]; }
      if (i >= N && sT > 0) C[i].vi[N] = [sP / sT, sM / sT];
    }
  }
  return C;
}

// an entry may follow candle i: ATR known, warm-up done, next candle within 3 h
export const eligible = (C, i) => i >= P.WARM && i < C.length - 1 && C[i].atr != null && C[i + 1].t - C[i].t <= P.NEXT;

// crosses of VI+ against VI-: a sign that differs from the last non-zero sign
export function signals(C, N, sideOnly = null) {
  const out = []; let last = 0;
  for (let i = 0; i < C.length; i++) {
    const v = C[i].vi[N]; if (!v) continue;
    const s = Math.sign(v[0] - v[1]); if (s === 0) continue;
    if (last !== 0 && s !== last && eligible(C, i) && (sideOnly == null || s === sideOnly)) out.push({ i, t: C[i].t, side: s });
    last = s;
  }
  return out;
}

// one trade entered at the open after candle i: stop 1.5 x ATR(i), out at the close of the 24th candle
export function sim(C, i, side, cm = 1) {
  const e = i + 1, E = C[e].o, r0 = P.STOP * C[i].atr, stop = E - side * r0;
  if (!(r0 > 0)) return { skip: 'no risk' };
  let x = null;
  for (let j = e; j < C.length && j < e + P.HOLD; j++) {
    const b = C[j];
    if (j > e && b.t - C[j - 1].t > P.GAP) { x = { px: b.o, why: (side > 0 ? b.o <= stop : b.o >= stop) ? 'stop' : 'gap', xi: j, xt: b.t }; break; }
    if (side > 0 ? b.o <= stop : b.o >= stop) { x = { px: b.o, why: 'stop', xi: j, xt: b.t }; break; }
    if (side > 0 ? b.l <= stop : b.h >= stop) { x = { px: stop, why: 'stop', xi: j, xt: b.t + H1 }; break; }
    if (j === e + P.HOLD - 1) x = { px: b.c, why: 'time', xi: j, xt: b.t + H1 };
  }
  if (!x) return { skip: 'data end' };
  const gross = (x.px - E) * side / r0, nn = side > 0 ? nights(C[e].t, x.xt) : 0;
  const cost = (P.COST / r0 + nn * P.FIN * E / r0) * cm;
  return { i, te: C[e].t, xi: x.xi, side, E, r0, px: x.px, why: x.why, nights: nn, gross, cost, net: gross - cost };
}

// one position at a time: a signal on or before the exit candle is skipped
export function stream(C, sigs, cm = 1) {
  const out = [], funnel = { signals: sigs.length, busy: 0 }; let free = -1;
  for (const s of sigs) {
    if (s.i <= free) { funnel.busy++; continue; }
    const r = sim(C, s.i, s.side, cm);
    if (r.skip) { funnel[r.skip] = (funnel[r.skip] || 0) + 1; continue; }
    out.push(r); free = r.xi;
  }
  funnel.trades = out.length; return { trades: out, funnel };
}

const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const mon = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export const inW = (t, w) => day(t) >= w[0] && day(t) < w[1];

// drift baseline: mean net R of every eligible hour's trade, by side and month of entry
export function baseline(C, w) {
  const acc = new Map();
  for (let i = P.WARM; i < C.length - 1; i++) {
    if (!eligible(C, i) || !inW(C[i + 1].t, w)) continue;
    for (const side of [1, -1]) {
      const r = sim(C, i, side); if (r.skip) continue;
      const k = `${side}|${mon(r.te)}`, a = acc.get(k) || [0, 0]; a[0] += r.net; a[1]++; acc.set(k, a);
    }
  }
  const out = new Map(); for (const [k, [s, n]] of acc) out.set(k, s / n); return out;
}
export const excessOf = (r, base) => r.net - (base.get(`${r.side}|${mon(r.te)}`) ?? 0);

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, t: null };
  const m = xs.reduce((a, x) => a + x, 0) / n, v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return { n, mean: m, t: v > 0 ? m / Math.sqrt(v / n) : null };
}
export function monthT(tr, key = 'net') { const m = new Map(); for (const r of tr) m.set(mon(r.te), (m.get(mon(r.te)) || 0) + r[key]); const s = tstat([...m.values()]); return { months: s.n, t: s.t }; }
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) { const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0; idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; }); return out; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const mean = (tr, k) => (tr.length ? tr.reduce((a, r) => a + r[k], 0) / tr.length : null);
export function summary(tr, tr2 = []) {
  const ex = {}; let run = 0, pk = 0, dd = 0; for (const r of tr) { run += r.net; pk = Math.max(pk, run); dd = Math.min(dd, run - pk); ex[r.why] = (ex[r.why] || 0) + 1; }
  const hasX = tr.length > 0 && tr[0].excess != null;
  const st = tr.map((r) => r.r0).sort((a, b) => a - b), mt = monthT(tr, 'net'), mg = monthT(tr, 'gross'), mx = hasX ? monthT(tr, 'excess') : { t: null };
  return { n: tr.length, gross: r3(mean(tr, 'gross')), net: r3(mean(tr, 'net')), net2: r3(mean(tr2, 'net')), excess: hasX ? r3(mean(tr, 'excess')) : null,
    win: tr.length ? r3(tr.filter((r) => r.net > 0).length / tr.length) : null, total: r2(run), maxDD: r2(dd), stop$: st.length ? r2(st[st.length >> 1]) : null,
    cost: r3(mean(tr, 'cost')), months: mt.months, t: r2(mt.t), tGross: r2(mg.t), tExcess: r2(mx.t), exits: ex };
}

const NAMES = { T1: 'Vortex(14), both sides', T2: 'Vortex(42), both sides', T3: 'Vortex(14), buys only' };
export function runAll(rows, opts = {}) {
  const seeds = opts.seeds ?? P.SEEDS, C = prepare(rows);
  const all = [P.IS[0], P.OOS[1]], inAll = (s) => inW(C[s.i + 1].t, all);
  const sets = { T1: signals(C, P.N1).filter(inAll), T2: signals(C, P.N2).filter(inAll), T3: signals(C, P.N1, 1).filter(inAll) };
  const base = baseline(C, all);
  const elig = []; for (let i = P.WARM; i < C.length - 1; i++) if (eligible(C, i) && inW(C[i + 1].t, P.OOS)) elig.push(i);
  const tests = {};
  for (const T of Object.keys(sets)) {
    const s1 = stream(C, sets[T]), s2 = stream(C, sets[T], 2);
    for (const r of s1.trades) r.excess = excessOf(r, base);
    const by = (w, src = s1.trades) => src.filter((r) => inW(r.te, w));
    const is = summary(by(P.IS), by(P.IS, s2.trades)), oos = summary(by(P.OOS), by(P.OOS, s2.trades));
    oos.p = oos.t == null ? 1 : normSf(oos.t);
    const halves = { a: summary(by([P.OOS[0], P.HALF])), b: summary(by([P.HALF, P.OOS[1]])) };
    const sides = {}; for (const [nm, sd] of [['buy', 1], ['sell', -1]]) { const f = (r) => r.side === sd; sides[nm] = { is: summary(by(P.IS).filter(f)), oos: summary(by(P.OOS).filter(f)) }; }
    // placebo: each OOS signal moved to a random eligible OOS candle, side kept
    const oosSigs = sets[T].filter((s) => inW(C[s.i + 1].t, P.OOS)), pm = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const rnd = mulberry32(seed);
      const ps = oosSigs.map((s) => { const i = elig[Math.floor(rnd() * elig.length)]; return { i, t: C[i].t, side: s.side }; }).sort((a, b) => a.i - b.i);
      pm.push(mean(stream(C, ps).trades, 'net') ?? 0);
    }
    const ps = [...pm].sort((a, b) => a - b);
    const placebo = { seeds, mean: r3(pm.reduce((a, v) => a + v, 0) / pm.length), q95: r3(ps[Math.ceil(0.95 * ps.length) - 1]), max: r3(ps.at(-1)), beats: pm.filter((v) => oos.net != null && oos.net > v).length };
    const years = {}; for (const r of s1.trades) { const y = day(r.te).slice(0, 4); (years[y] ||= { n: 0, gross: 0, net: 0, excess: 0 }); years[y].n++; years[y].gross += r.gross; years[y].net += r.net; years[y].excess += r.excess; }
    for (const y in years) for (const k of ['gross', 'net', 'excess']) years[y][k] = r2(years[y][k]);
    tests[T] = { name: NAMES[T], is, oos, halves, sides, placebo, years, funnel: s1.funnel,
      trades: s1.trades.map((r) => [r.te, r.side, r2(r.r0), r.why, r3(r.gross), r3(r.net), r3(r.excess)]) };
  }
  const ks = Object.keys(tests), hp = holm(ks.map((k) => tests[k].oos.p));
  ks.forEach((k, j) => {
    const x = tests[k]; x.holm = r3(hp[j]);
    x.checks = { t2: (x.oos.t ?? -9) >= 2 && hp[j] <= 0.05, isSame: (x.is.net ?? -1) > 0, costs2: (x.oos.net2 ?? -1) > 0,
      excess: (x.oos.excess ?? -1) > 0 && (x.oos.tExcess ?? -9) >= 2, placebo: x.placebo.beats >= P.BEATS, n: x.oos.n >= P.MIN_N };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const passed = ks.filter((k) => tests[k].pass);
  const verdict = tests.T1.pass ? 'PASS' : passed.length ? 'PARTLY' : 'FAIL';
  return { verdict, passed, data: { from: day(rows[0][0]), to: day(rows.at(-1)[0]), candles: rows.length, eligibleOOS: elig.length }, tests };
}

const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const ft = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
export function headline(res) {
  const T = res.tests, s = (k) => `${k} ${fmt(T[k].oos.net)} (n ${T[k].oos.n}, t ${ft(T[k].oos.t)})`;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3 pass: OOS 2017-26 net R a trade ${s('T1')}, ${s('T2')}, ${s('T3')}.**`;
}
export function report(res, built) {
  const T = res.tests, ks = Object.keys(T), yn = (b) => (b ? 'yes' : 'no');
  const L = [`# Gold H1 Vortex crossover, against gold's own drift: result (${built})`, '', headline(res), '',
    'Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot gold, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.', '',
    '## Rule (as pre-registered)', '',
    `- OANDA mid H1 XAU/USD ${res.data.from} to ${res.data.to} (${res.data.candles} candles).`,
    '- Vortex(N): VI+ = Σ|high − previous low| / ΣTR, VI− = Σ|low − previous high| / ΣTR over the last N candles. A cross (the sign of VI+ − VI− changes) buys or sells at the next H1 open.',
    '- Stop 1.5 × ATR(14) Wilder from the entry, no target, out at the close of the 24th H1 candle (or at the first open after a closure). An open past the stop fills there. One position at a time; a cross met while in a trade is skipped.',
    `- Costs: $0.60 a round trip; buys pay \`FIN.xau.long\` (${P.FIN} of price a rollover) per \`nights()\`; 2× = $1.20 and twice the financing. IS = entries 2007-16, OOS = entries 2017 to 31 Oct 2026.`,
    '- Excess = a trade\'s net R minus the mean net R of the same-side trade (same stop, hold and costs) entered on every eligible H1 candle of its month: what the turn adds over gold\'s own drift.', '',
    '## Results (R of the stop distance; t on calendar-month sums)', '',
    '| Test | Window | n | Gross R | Net R | Net at 2× | Excess R | t excess | Win % | Total net R | Worst DD R | Median 1R $ | Cost R | t net | t gross | Holm p | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const k of ks) for (const [w, s] of [['IS 2007-16', T[k].is], ['OOS 2017-26', T[k].oos]])
    L.push(`| ${k} ${T[k].name} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${fmt(s.excess)} | ${ft(s.tExcess)} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1)} | ${fmt(s.total, 2)} | ${fmt(s.maxDD, 2)} | ${s.stop$ ?? 'n/a'} | ${fmt(s.cost)} | ${ft(s.t)} | ${ft(s.tGross)} | ${w.startsWith('OOS') ? T[k].holm.toFixed(4) : ''} | ${w.startsWith('OOS') ? yn(T[k].pass) : ''} |`);
  L.push('', '## Pass checks (all needed)', '', '| Test | OOS t ≥ 2, Holm p ≤ 0.05 | IS net > 0 | OOS net at 2× > 0 | OOS excess > 0, t ≥ 2 | Placebo ≥ 38 of 40 | OOS n ≥ 200 |', '|---|---|---|---|---|---|---|');
  for (const k of ks) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.t2)} | ${yn(c.isSame)} | ${yn(c.costs2)} | ${yn(c.excess)} | ${yn(c.placebo)} (${T[k].placebo.beats}) | ${yn(c.n)} |`); }
  L.push('', '## Placebo (40 seeds: each OOS signal moved to a random eligible OOS H1 candle, side kept, one at a time)', '',
    '| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const k of ks) { const p = T[k].placebo; L.push(`| ${k} | ${fmt(T[k].oos.net)} | ${fmt(p.mean)} | ${fmt(p.q95)} | ${fmt(p.max)} | ${p.beats} of ${p.seeds} |`); }
  L.push('', '## By side (reported)', '', '| Test | Side | IS n | IS net | IS excess | OOS n | OOS gross | OOS net | OOS excess | OOS t |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ks) for (const sd of ['buy', 'sell']) { const a = T[k].sides[sd]; if (!a.is.n && !a.oos.n) continue; L.push(`| ${k} | ${sd} | ${a.is.n} | ${fmt(a.is.net)} | ${fmt(a.is.excess)} | ${a.oos.n} | ${fmt(a.oos.gross)} | ${fmt(a.oos.net)} | ${fmt(a.oos.excess)} | ${ft(a.oos.t)} |`); }
  L.push('', '## OOS halves (reported)', '', '| Test | 2017-21 n | net R | excess R | t | 2022-26 n | net R | excess R | t |', '|---|---|---|---|---|---|---|---|---|');
  for (const k of ks) { const a = T[k].halves.a, b = T[k].halves.b; L.push(`| ${k} | ${a.n} | ${fmt(a.net)} | ${fmt(a.excess)} | ${ft(a.t)} | ${b.n} | ${fmt(b.net)} | ${fmt(b.excess)} | ${ft(b.t)} |`); }
  L.push('', '## By year (net and excess R totals, entries)', '', '| Year | ' + ks.map((k) => `${k} n | ${k} net | ${k} excess`).join(' | ') + ' |', '|---|' + ks.map(() => '---|---|---|').join(''));
  const ys = [...new Set(ks.flatMap((k) => Object.keys(T[k].years)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + ks.map((k) => { const v = T[k].years[y]; return v ? `${v.n} | ${fmt(v.net, 2)} | ${fmt(v.excess, 2)}` : '0 | n/a | n/a'; }).join(' | ') + ' |');
  L.push('');
  for (const k of ks) {
    const f = T[k].funnel, ex = (s) => Object.entries(s.exits).map(([a, v]) => `${a} ${v}`).join(', ');
    L.push(`- ${k} funnel (2007-26): ${f.signals} crosses, ${f.trades} trades; skipped while in a trade ${f.busy || 0}, data end ${f['data end'] || 0}. Exits IS: ${ex(T[k].is)}; OOS: ${ex(T[k].oos)}.`);
  }
  L.push('', '## What this means', '', meaning(res), '',
    '## Repeat', '', '`node research/edge/gold-h1-vortex/run.mjs <xau-h1.json>` (OANDA mid XAU_USD H1 `[[t, o, h, l, c], ...]`, kept out of the repository).', '');
  return L.join('\n');
}
function meaning(res) {
  const T = res.tests;
  if (res.verdict === 'PASS') return 'The primary test passed the pre-registered bar: a proposal for the owner at most, never a live change.';
  return [`The primary test does not meet the pre-registered bar${res.passed.length ? ` (${res.passed.join(', ')} alone does)` : ', nor does any other'}.`,
    `Before costs the Vortex turn made ${fmt(T.T1.oos.gross)}R a trade out of sample on T1 (month t ${ft(T.T1.oos.tGross)}) and ${fmt(T.T1.is.gross)}R in sample (t ${ft(T.T1.is.tGross)});`,
    `against the same-side trade on every hour of the month it adds ${fmt(T.T1.oos.excess)}R (t ${ft(T.T1.oos.tExcess)}) out of sample and ${fmt(T.T1.is.excess)}R (t ${ft(T.T1.is.tExcess)}) in sample.`,
    `The stop sits a median $${T.T1.oos.stop$} from the entry out of sample, so the round trip and the buys' financing cost ${fmt(T.T1.oos.cost).replace('+', '')}R a trade.`,
    `The same signals moved to random hours: T1 beats ${T.T1.placebo.beats} of 40 seeds, T2 ${T.T2.placebo.beats}, T3 ${T.T3.placebo.beats}.`,
    'Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.'].join(' ');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [f] = process.argv.slice(2); if (!f) { console.error('usage: node run.mjs <xau-h1.json>'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')), built = new Date().toISOString().slice(0, 10);
  const res = runAll(rows); res.built = built;
  res.rule = { vortex: [P.N1, P.N2], atr: P.ATR, stopAtr: P.STOP, hold: P.HOLD, cost: P.COST, fin: P.FIN, is: P.IS, oos: P.OOS };
  res.headline = headline(res);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res, built));
  for (const k of Object.keys(res.tests)) { const x = res.tests[k]; console.log(k, 'IS', x.is.n, x.is.gross, x.is.net, x.is.excess, x.is.t, '| OOS', x.oos.n, x.oos.gross, x.oos.net, x.oos.excess, x.oos.t, x.oos.tExcess, 'x2', x.oos.net2, 'holm', x.holm, 'plc', x.placebo.beats, 'pass', x.pass); }
  console.log(res.headline, res.headline.length);
}
