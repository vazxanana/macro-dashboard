// Edge research · gold-h1-bb-fade: in a quiet H1 regime (ADX(14) < 20, or < 15) fade an H1 close outside the Bollinger(20, 2)
// band back to the middle band. Rules: PREREGISTRATION.md (pushed alone first). A stand-alone rule: not a gate, exit, entry or
// size of the live gold book (owner decision 44). Paper research only.
//
//   node research/edge/gold-h1-bb-fade/run.mjs <xau-h1.json> <xau-5m.json.gz>   -> result.json + RESULT.md in this folder
//
// Candle files ([[t, o, h, l, c], ...], OANDA mid XAU_USD, UTC candle start) are kept out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H1 = 3600, M5 = 300;
export const P = {
  BB: 20, K: 2, ATR: 14, ADX: 14, WARM: 200, ADX_T1: 20, ADX_T3: 15, BUF: 0.5, MIN_TGT: 0.5, HOLD: 12, NEXT: 3 * H1, GAP: 6 * H1,
  COST: 0.60, FIN: FIN.xau.long, IS: ['2007-01-01', '2017-01-01'], OOS: ['2017-01-01', '2026-11-01'], HALF: '2022-01-01',
  SEEDS: 40, BEATS: 38, MIN_N: 200, ASIA: [22, 23, 0, 1, 2, 3, 4, 5, 6],
};

// ── indicators, each from candles at or before i ──
export function prepare(rows) {
  const C = rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
  const n = C.length, A = P.ATR;
  // Bollinger: SMA and population sd of the last 20 closes
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    s1 += C[i].c; s2 += C[i].c * C[i].c;
    if (i >= P.BB) { s1 -= C[i - P.BB].c; s2 -= C[i - P.BB].c * C[i - P.BB].c; }
    if (i >= P.BB - 1) { const m = s1 / P.BB, sd = Math.sqrt(Math.max(0, s2 / P.BB - m * m)); C[i].mid = m; C[i].up = m + P.K * sd; C[i].dn = m - P.K * sd; }
  }
  // ATR and ADX, Wilder
  let atr = null, sTR = 0, sP = 0, sM = 0, adx = null; const trs = [], dxs = [];
  for (let i = 1; i < n; i++) {
    const b = C[i], a = C[i - 1];
    const tr = Math.max(b.h - b.l, Math.abs(b.h - a.c), Math.abs(b.l - a.c));
    const upM = b.h - a.h, dnM = a.l - b.l;
    const pdm = upM > dnM && upM > 0 ? upM : 0, mdm = dnM > upM && dnM > 0 ? dnM : 0;
    if (atr == null) { trs.push(tr); if (trs.length === A) atr = trs.reduce((x, y) => x + y, 0) / A; } else atr = (atr * (A - 1) + tr) / A;
    if (i <= A) { sTR += tr; sP += pdm; sM += mdm; } else { sTR = sTR - sTR / A + tr; sP = sP - sP / A + pdm; sM = sM - sM / A + mdm; }
    b.atr = atr;
    if (i >= A) {
      const pdi = sTR > 0 ? 100 * sP / sTR : 0, mdi = sTR > 0 ? 100 * sM / sTR : 0, dx = pdi + mdi > 0 ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0;
      if (adx == null) { dxs.push(dx); if (dxs.length === A) adx = dxs.reduce((x, y) => x + y, 0) / A; } else adx = (adx * (A - 1) + dx) / A;
      b.adx = adx;
    }
  }
  return C;
}

// M5 index: hour start -> [first, last+1) in the sorted M5 array
export function m5Index(m5) {
  const idx = new Map();
  for (let k = 0; k < m5.length; k++) { const h = m5[k][0] - (m5[k][0] % H1); const e = idx.get(h); if (e) e[1] = k + 1; else idx.set(h, [k, k + 1]); }
  return idx;
}

// signal candles: ADX below the cut and a close outside the band; the next candle within 3 h
export function signals(C, adxMax, hours = null) {
  const out = [];
  for (let i = P.WARM; i < C.length - 1; i++) {
    const b = C[i]; if (b.adx == null || b.mid == null || b.atr == null || !(b.adx < adxMax)) continue;
    if (C[i + 1].t - b.t > P.NEXT) continue;
    if (hours && !hours.includes(new Date(b.t * 1000).getUTCHours())) continue;
    if (b.c > b.up) out.push({ i, t: b.t, side: -1 }); else if (b.c < b.dn) out.push({ i, t: b.t, side: 1 });
  }
  return out;
}

// the rule's levels for a signal; side override (placebo) mirrors stop and target around the entry
export function spec(C, s, sideOverride = null) {
  const b = C[s.i], E = C[s.i + 1].o, side0 = s.side;
  const stop0 = side0 < 0 ? b.h + P.BUF * b.atr : b.l - P.BUF * b.atr, r0 = (E - stop0) * side0;
  if (!(r0 > 0)) return { skip: 'stop side' };
  const d = (b.mid - E) * side0;
  if (!(d >= P.MIN_TGT * r0)) return { skip: 'target near' };
  const side = sideOverride ?? side0;
  return { side, E, r0, stop: E - side * r0, target: E + side * d, e: s.i + 1 };
}

// walk one H1 candle on its M5 candles: returns { px, why, xt } or null
function walkHour(b, side, stop, target, m5, idx) {
  const r = idx && idx.get(b.t);
  if (r) for (let k = r[0]; k < r[1]; k++) {
    const [t, o, h, l] = m5[k];
    if (side > 0 ? o <= stop : o >= stop) return { px: o, why: 'stop', xt: t };
    const sH = side > 0 ? l <= stop : h >= stop, tH = side > 0 ? h >= target : l <= target;
    if (sH) return { px: stop, why: 'stop', xt: t + M5 };
    if (tH) return { px: side > 0 ? Math.max(target, o) : Math.min(target, o), why: 'target', xt: t + M5 };
  }
  else {
    if (side > 0 ? b.o <= stop : b.o >= stop) return { px: b.o, why: 'stop', xt: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { px: stop, why: 'stop', xt: b.t + H1 };
    if (side > 0 ? b.h >= target : b.l <= target) return { px: target, why: 'target', xt: b.t + H1 };
  }
  return null;
}

export function sim(C, s, m5, idx, cm = 1, sideOverride = null) {
  const sp = spec(C, s, sideOverride); if (sp.skip) return sp;
  const { side, E, r0, stop, target, e } = sp;
  let x = null, xi = null;
  for (let j = e; j < C.length && j < e + P.HOLD; j++) {
    const b = C[j];
    if (j > e && b.t - C[j - 1].t > P.GAP) {
      const gs = side > 0 ? b.o <= stop : b.o >= stop;
      x = { px: b.o, why: gs ? 'stop' : 'gap', xt: b.t }; xi = j; break;
    }
    const w = walkHour(b, side, stop, target, m5, idx); if (w) { x = w; xi = j; break; }
    if (j === e + P.HOLD - 1) { x = { px: b.c, why: 'time', xt: b.t + H1 }; xi = j; }
  }
  if (!x) return { skip: 'data end' };
  const gross = (x.px - E) * side / r0;
  const nn = side > 0 ? nights(C[e].t, x.xt) : 0, fin = nn * P.FIN * E / r0;
  const cost = (P.COST / r0 + fin) * cm;
  return { t0: C[s.i].t, te: C[e].t, i: s.i, xi, side, E, stop, target, r0, px: x.px, why: x.why, nights: nn, gross, cost, net: gross - cost };
}

// one position at a time: a signal candle before the exit candle is skipped
export function stream(C, sigs, m5, idx, cm = 1, sideOf = null) {
  const out = [], funnel = { signals: sigs.length, busy: 0 }; let free = -1;
  for (const s of sigs) {
    if (s.i < free) { funnel.busy++; continue; }
    const r = sim(C, s, m5, idx, cm, sideOf ? sideOf(s) : null);
    if (r.skip) { funnel[r.skip] = (funnel[r.skip] || 0) + 1; continue; }
    out.push(r); free = r.xi;
  }
  funnel.trades = out.length; return { trades: out, funnel };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, t: null };
  const m = xs.reduce((a, x) => a + x, 0) / n, v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return { n, mean: m, t: v > 0 ? m / Math.sqrt(v / n) : null };
}
const mon = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(tr, key = 'net') { const m = new Map(); for (const r of tr) m.set(mon(r.te), (m.get(mon(r.te)) || 0) + r[key]); const s = tstat([...m.values()]); return { months: s.n, t: s.t }; }
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) { const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0; idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; }); return out; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inW = (t, w) => day(t) >= w[0] && day(t) < w[1];
const mean = (tr, k) => (tr.length ? tr.reduce((a, r) => a + r[k], 0) / tr.length : null);
export function summary(tr, tr2) {
  const mt = monthT(tr, 'net'), mg = monthT(tr, 'gross'), ex = {};
  let run = 0, pk = 0, dd = 0; for (const r of tr) { run += r.net; pk = Math.max(pk, run); dd = Math.min(dd, run - pk); ex[r.why] = (ex[r.why] || 0) + 1; }
  const st = tr.map((r) => r.r0).sort((a, b) => a - b), g = mean(tr, 'gross'), c = mean(tr, 'cost');
  return { n: tr.length, gross: r3(g), net: r3(mean(tr, 'net')), net2: r3(mean(tr2, 'net')), win: tr.length ? r3(tr.filter((r) => r.net > 0).length / tr.length) : null,
    total: r2(run), maxDD: r2(dd), stop$: st.length ? r2(st[st.length >> 1]) : null, cost: r3(c), costShare: g > 0 ? r3(c / g) : null,
    months: mt.months, t: r2(mt.t), tGross: r2(mg.t), exits: ex };
}

const NAMES = { T1: 'ADX < 20, any hour', T2: 'ADX < 20, signals 22:00-06:00 UTC', T3: 'ADX < 15, any hour' };
export function runAll(rows, m5, opts = {}) {
  const seeds = opts.seeds ?? P.SEEDS, C = prepare(rows), idx = m5Index(m5);
  const inAll = (s) => inW(C[s.i + 1].t, [P.IS[0], P.OOS[1]]);
  const sets = { T1: signals(C, P.ADX_T1).filter(inAll), T2: signals(C, P.ADX_T1, P.ASIA).filter(inAll), T3: signals(C, P.ADX_T3).filter(inAll) };
  const tests = {};
  for (const T of Object.keys(sets)) {
    const all = stream(C, sets[T], m5, idx), all2 = stream(C, sets[T], m5, idx, 2);
    const by = (w, src = all.trades) => src.filter((r) => inW(r.te, w));
    const is = summary(by(P.IS), by(P.IS, all2.trades)), oos = summary(by(P.OOS), by(P.OOS, all2.trades));
    const half = { a: summary(by([P.OOS[0], P.HALF]), []), b: summary(by([P.HALF, P.OOS[1]]), []) };
    oos.p = oos.t == null ? 1 : normSf(oos.t);
    const sides = {}; for (const [nm, sd] of [['buy', 1], ['sell', -1]]) { const f = (r) => r.side === sd; sides[nm] = { is: summary(by(P.IS).filter(f), []), oos: summary(by(P.OOS).filter(f), []) }; }
    // placebo: the same OOS signal candles, the side at random, levels mirrored
    const oosSigs = sets[T].filter((s) => inW(C[s.i + 1].t, P.OOS)), pm = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const rnd = mulberry32(seed), side = new Map(); for (const s of oosSigs) side.set(s.i, rnd() < 0.5 ? 1 : -1);
      pm.push(mean(stream(C, oosSigs, m5, idx, 1, (s) => side.get(s.i)).trades, 'net') ?? 0);
    }
    const ps = [...pm].sort((a, b) => a - b);
    const placebo = { seeds, mean: r3(pm.reduce((a, v) => a + v, 0) / pm.length), q95: r3(ps[Math.ceil(0.95 * ps.length) - 1]), max: r3(ps.at(-1)), beats: pm.filter((v) => oos.net != null && oos.net > v).length };
    const years = {}; for (const r of all.trades) { const y = day(r.te).slice(0, 4); (years[y] ||= { n: 0, gross: 0, net: 0 }); years[y].n++; years[y].gross += r.gross; years[y].net += r.net; }
    for (const y in years) { years[y].gross = r2(years[y].gross); years[y].net = r2(years[y].net); }
    tests[T] = { name: NAMES[T], is, oos, halves: half, sides, placebo, years, funnel: all.funnel,
      trades: all.trades.map((r) => [r.te, r.side, r2(r.r0), r.why, r3(r.gross), r3(r.net)]) };
  }
  const ks = Object.keys(tests), hp = holm(ks.map((k) => tests[k].oos.p));
  ks.forEach((k, j) => {
    const x = tests[k]; x.holm = r3(hp[j]);
    x.checks = { t2: (x.oos.t ?? -9) >= 2 && hp[j] <= 0.05, isSame: (x.is.net ?? -1) > 0, costs2: (x.oos.net2 ?? -1) > 0, n: x.oos.n >= P.MIN_N, placebo: x.placebo.beats >= P.BEATS };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const passed = ks.filter((k) => tests[k].pass);
  return { verdict: passed.length ? 'PASS' : 'FAIL', passed, data: { from: day(rows[0][0]), to: day(rows.at(-1)[0]), candles: rows.length, m5: m5.length, m5From: m5.length ? day(m5[0][0]) : null }, tests };
}

const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const ft = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
export function headline(res) {
  const T = res.tests, s = (k) => `${k} ${fmt(T[k].oos.net)} (n ${T[k].oos.n}, t ${ft(T[k].oos.t)})`;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3 pass: OOS 2017-26 net R a trade ${s('T1')}, ${s('T2')}, ${s('T3')}.**`;
}
export function report(res, built) {
  const T = res.tests, ks = Object.keys(T), yn = (b) => (b ? 'yes' : 'no');
  const L = [`# Gold H1 Bollinger band fade in a quiet regime: result (${built})`, '', headline(res), '',
    'Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday mean-reversion rule on spot gold, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.', '',
    '## Rule (as pre-registered)', '',
    `- OANDA mid H1 XAU/USD ${res.data.from} to ${res.data.to} (${res.data.candles} candles); M5 (${res.data.m5} candles from ${res.data.m5From}) only to order a stop and a target inside an hour.`,
    '- Bollinger(20, 2, population sd) on H1 closes, ADX(14) and ATR(14) Wilder, all at the signal close. ADX under the cut and a close outside the band: sell above, buy below, at the next H1 open.',
    '- Stop: the signal candle\'s extreme ± 0.5 × ATR(14). Target: the middle band at the signal close, fixed; skipped under 0.5R away. Out at the close of the 12th H1 candle, or at the first open after a closure. Stop first when one M5 candle holds both; an M5 open past the stop fills there. One position at a time.',
    `- Costs: $0.60 a round trip; buys pay \`FIN.xau.long\` (${P.FIN} of price a rollover) per \`nights()\`; 2× = $1.20 and twice the financing. IS = entries 2007-16, OOS = entries 2017 to 31 Oct 2026.`, '',
    '## Results (R of the stop distance; t on calendar-month sums)', '',
    '| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median 1R $ | Cost R | Cost share | t net | t gross | Holm p | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const k of ks) for (const [w, s] of [['IS 2007-16', T[k].is], ['OOS 2017-26', T[k].oos]])
    L.push(`| ${k} ${T[k].name} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1)} | ${fmt(s.total, 2)} | ${fmt(s.maxDD, 2)} | ${s.stop$ ?? 'n/a'} | ${fmt(s.cost)} | ${s.costShare == null ? 'n/a (gross ≤ 0)' : (s.costShare * 100).toFixed(0) + ' %'} | ${ft(s.t)} | ${ft(s.tGross)} | ${w.startsWith('OOS') ? T[k].holm.toFixed(4) : ''} | ${w.startsWith('OOS') ? yn(T[k].pass) : ''} |`);
  L.push('', '## Pass checks (all needed)', '', '| Test | OOS t ≥ 2, Holm p ≤ 0.05 | IS net > 0 | OOS net at 2× > 0 | OOS n ≥ 200 | Placebo ≥ 38 of 40 |', '|---|---|---|---|---|---|');
  for (const k of ks) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.t2)} | ${yn(c.isSame)} | ${yn(c.costs2)} | ${yn(c.n)} | ${yn(c.placebo)} (${T[k].placebo.beats}) |`); }
  L.push('', '## Placebo (40 seeds: the same OOS signal candles, the side at random, stop and target mirrored around the entry)', '',
    '| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const k of ks) { const p = T[k].placebo; L.push(`| ${k} | ${fmt(T[k].oos.net)} | ${fmt(p.mean)} | ${fmt(p.q95)} | ${fmt(p.max)} | ${p.beats} of ${p.seeds} |`); }
  L.push('', '## By side (reported)', '', '| Test | Side | IS n | IS gross | IS net | OOS n | OOS gross | OOS net | OOS t |', '|---|---|---|---|---|---|---|---|---|');
  for (const k of ks) for (const sd of ['buy', 'sell']) { const a = T[k].sides[sd]; L.push(`| ${k} | ${sd} | ${a.is.n} | ${fmt(a.is.gross)} | ${fmt(a.is.net)} | ${a.oos.n} | ${fmt(a.oos.gross)} | ${fmt(a.oos.net)} | ${ft(a.oos.t)} |`); }
  L.push('', '## OOS halves (reported)', '', '| Test | 2017-21 n | net R | t | 2022-26 n | net R | t |', '|---|---|---|---|---|---|---|');
  for (const k of ks) { const a = T[k].halves.a, b = T[k].halves.b; L.push(`| ${k} | ${a.n} | ${fmt(a.net)} | ${ft(a.t)} | ${b.n} | ${fmt(b.net)} | ${ft(b.t)} |`); }
  L.push('', '## By year (net R total, entries)', '', '| Year | ' + ks.map((k) => `${k} n | ${k} gross | ${k} net`).join(' | ') + ' |', '|---|' + ks.map(() => '---|---|---|').join(''));
  const ys = [...new Set(ks.flatMap((k) => Object.keys(T[k].years)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + ks.map((k) => { const v = T[k].years[y]; return v ? `${v.n} | ${fmt(v.gross, 2)} | ${fmt(v.net, 2)}` : '0 | n/a | n/a'; }).join(' | ') + ' |');
  L.push('');
  for (const k of ks) {
    const f = T[k].funnel, ex = (s) => Object.entries(s.exits).map(([a, v]) => `${a} ${v}`).join(', ');
    L.push(`- ${k} funnel (2007-26): ${f.signals} signal candles, ${f.trades} trades; skipped: busy ${f.busy || 0}, target under 0.5R ${f['target near'] || 0}, stop side ${f['stop side'] || 0}, data end ${f['data end'] || 0}. Exits IS: ${ex(T[k].is)}; OOS: ${ex(T[k].oos)}.`);
  }
  L.push('', '## What this means', '', res.verdict === 'PASS' ? 'A test passed the pre-registered bar: a proposal for the owner at most, never a live change.' : whatItMeans(res), '',
    '## Repeat', '', '`node research/edge/gold-h1-bb-fade/run.mjs <xau-h1.json> <xau-5m.json.gz>` (OANDA mid XAU_USD `[[t, o, h, l, c], ...]`, kept out of git).', '');
  return L.join('\n');
}
function whatItMeans(res) {
  const T = res.tests, ks = Object.keys(T);
  const gmax = Math.max(...ks.flatMap((k) => [T[k].is.tGross, T[k].oos.tGross]).filter((x) => x != null));
  return [`No test meets the pre-registered bar. Every stream loses before costs too: in sample the fade made ${fmt(T.T1.is.gross)}R a trade gross on T1 (month t ${ft(T.T1.is.tGross)}),`,
    `out of sample ${fmt(T.T1.oos.gross)}R (t ${ft(T.T1.oos.tGross)}); the largest gross month t of any stream in either window is ${ft(gmax)}.`,
    `The stop sits a median $${T.T1.oos.stop$} from the entry out of sample, so the $0.60 round trip and the buys' financing cost ${fmt(T.T1.oos.cost).replace('+', '')}R a trade on T1 and turn a flat stream into a steady loss.`,
    'A quiet ADX does not make a close outside the band come back to the middle more often than chance: the rule does no better than the same trades with the side drawn at random (it beats',
    `${T.T1.placebo.beats}, ${T.T2.placebo.beats} and ${T.T3.placebo.beats} of 40 seeds), and the Asian-hours and ADX < 15 versions are no better than T1.`,
    'Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.'].join(' ');
}

export function loadM5(f) { const buf = fs.readFileSync(f); return JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')); }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [f, g] = process.argv.slice(2); if (!f || !g) { console.error('usage: node run.mjs <xau-h1.json> <xau-5m.json.gz>'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')), m5 = loadM5(g), built = new Date().toISOString().slice(0, 10);
  const res = runAll(rows, m5); res.built = built;
  res.rule = { bb: [P.BB, P.K], atr: P.ATR, adx: P.ADX, adxCut: { T1: P.ADX_T1, T2: P.ADX_T1, T3: P.ADX_T3 }, asiaHours: P.ASIA, buffer: P.BUF, minTarget: P.MIN_TGT, hold: P.HOLD, cost: P.COST, fin: P.FIN, is: P.IS, oos: P.OOS };
  res.headline = headline(res);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res, built));
  for (const k of Object.keys(res.tests)) { const x = res.tests[k]; console.log(k, 'IS', x.is.n, x.is.gross, x.is.net, x.is.t, '| OOS', x.oos.n, x.oos.gross, x.oos.net, x.oos.t, x.oos.tGross, 'x2', x.oos.net2, 'holm', x.holm, 'plc', x.placebo.beats, x.placebo.q95, 'pass', x.pass); }
  console.log(res.headline, res.headline.length);
}
