// Edge research · gold-rsi-divergence: at a confirmed swing high (low) of spot gold that exceeds the previous swing while RSI(14)
// makes a lower high (higher low), trade the reversal: stop past the swing + 0.25 ATR, target 2R, out after 30 bars. Both sides.
// Rules: PREREGISTRATION.md (pushed alone first). A stand-alone rule: not a gate, exit, entry or size of the live gold book
// (owner decision 44). Paper research only.
//
//   node research/edge/gold-rsi-divergence/run.mjs <xau-h1.json>   -> result.json + RESULT.md in this folder
//
// The candle file ([[t, o, h, l, c], ...], OANDA mid H1 XAU_USD, UTC hour start) is kept out of git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H1 = 3600, H4 = 4 * H1;
export const P = {
  RSI: 14, ATR: 14, PIV: 3, MIN_BACK: 5, MAX_BACK: 60, RSI_HI: 60, RSI_LO: 40, RSI_HI3: 70, RSI_LO3: 30,
  BUF: 0.25, MIN_R: 0.50, TGT: 2, HOLD: 30, COST: 0.60, FIN: FIN.xau.long,
  WARM: '2007-01-01', IS: ['2007-01-01', '2017-01-01'], OOS: ['2017-01-01', '2026-11-01'], HALF: '2022-01-01',
  SEEDS: 40, BEATS: 38, MIN_N: 30,
};

const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inW = (t, w) => day(t) >= w[0] && day(t) < w[1];

// ── candles ──
export const dropSunday = (rows) => rows.filter((r) => new Date(r[0] * 1000).getUTCDay() !== 0);
export function toBars(rows) { return rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c })); }
export function buildH4(rows) {
  const out = []; let cur = null;
  for (const [t, o, h, l, c] of rows) {
    const b = Math.floor(t / H4) * H4;
    if (!cur || cur.t !== b) { cur = { t: b, o, h, l, c }; out.push(cur); } else { cur.h = Math.max(cur.h, h); cur.l = Math.min(cur.l, l); cur.c = c; }
  }
  return out;
}

// ── indicators (value at i uses bars <= i) ──
export function rsi(B, n = P.RSI) {
  const out = new Array(B.length).fill(null); let ag = 0, al = 0;
  for (let i = 1; i < B.length; i++) {
    const d = B[i].c - B[i - 1].c, g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= n) { ag += g; al += l; if (i === n) { ag /= n; al /= n; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } continue; }
    ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
export function atr(B, n = P.ATR) {
  const out = new Array(B.length).fill(null); let a = 0;
  for (let i = 1; i < B.length; i++) {
    const tr = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
    if (i <= n) { a += tr; if (i === n) { a /= n; out[i] = a; } continue; }
    a = (a * (n - 1) + tr) / n; out[i] = a;
  }
  return out;
}
export function isPivot(B, j, hi, k = P.PIV) {
  if (j - k < 0 || j + k >= B.length) return false;
  const v = hi ? B[j].h : B[j].l;
  for (let i = j - k; i < j; i++) if (hi ? B[i].h >= v : B[i].l <= v) return false;
  for (let i = j + 1; i <= j + k; i++) if (hi ? B[i].h > v : B[i].l < v) return false;
  return true;
}
// divergence signals, each known at its confirmation bar c = j + PIV; lo/hi = the RSI bounds on the earlier pivot
export function signals(B, R, A, opt = {}) {
  const hiMin = opt.hiMin ?? P.RSI_HI, loMax = opt.loMax ?? P.RSI_LO, out = [], ph = [], pl = [];
  for (let j = 0; j + P.PIV < B.length; j++) {
    for (const hi of [true, false]) {
      if (!isPivot(B, j, hi)) continue;
      const list = hi ? ph : pl; let k = null;
      for (let q = list.length - 1; q >= 0; q--) { const d = j - list[q]; if (d < P.MIN_BACK) continue; if (d <= P.MAX_BACK) k = list[q]; break; }
      list.push(j);
      if (k == null || R[j] == null || R[k] == null) continue;
      const c = j + P.PIV;
      if (hi && B[j].h > B[k].h && R[j] < R[k] && R[k] >= hiMin) out.push({ c, j, k, side: -1, t: B[c].t });
      if (!hi && B[j].l < B[k].l && R[j] > R[k] && R[k] <= loMax) out.push({ c, j, k, side: 1, t: B[c].t });
    }
  }
  return out.sort((a, b) => a.c - b.c || a.side - b.side);
}

// ── one trade (cm = cost multiple); a placebo signal carries `dist` in ATR units instead of a pivot ──
export function sim(B, A, s, tf, cm = 1) {
  const e = s.c + 1; if (e >= B.length || A[s.c] == null) return { skip: 'data end' };
  const E = B[e].o, side = s.side;
  const stop = s.dist != null ? E - side * s.dist * A[s.c] : side < 0 ? B[s.j].h + P.BUF * A[s.c] : B[s.j].l - P.BUF * A[s.c];
  const r0 = (E - stop) * side;
  if (!(r0 > 0)) return { skip: 'stop side' };
  if (r0 < P.MIN_R) return { skip: 'stop too close' };
  const target = E + side * P.TGT * r0;
  let px = null, why = null, xi = null, xt = null;
  for (let j = e; j < B.length && j < e + P.HOLD; j++) {
    const b = B[j];
    if (side > 0 ? b.l <= stop : b.h >= stop) { const gap = side > 0 ? b.o <= stop : b.o >= stop; px = gap ? b.o : stop; why = 'stop'; xi = j; xt = gap ? b.t : b.t + tf; break; }
    if (side > 0 ? b.h >= target : b.l <= target) { const gap = side > 0 ? b.o >= target : b.o <= target; px = gap ? b.o : target; why = 'target'; xi = j; xt = gap ? b.t : b.t + tf; break; }
    if (j === e + P.HOLD - 1) { px = b.c; why = 'time'; xi = j; xt = b.t + tf; }
  }
  if (px == null) return { skip: 'data end' };
  const gross = (px - E) * side / r0, nn = side > 0 ? nights(B[e].t, xt) : 0, fin = nn * P.FIN * E / r0;
  const net = gross - (P.COST / r0 + fin) * cm;
  return { c: s.c, te: B[e].t, side, E, stop, target, r0, atrR: r0 / A[s.c], px, why, xi, nights: nn, gross, fin, net };
}
export function stream(B, A, sigs, tf, cm = 1) {
  const out = [], funnel = { signals: sigs.length, busy: 0 }; let free = -1;
  for (const s of sigs) {
    if (s.c < free) { funnel.busy++; continue; }
    const r = sim(B, A, s, tf, cm);
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
const mean = (tr, k) => (tr.length ? tr.reduce((a, r) => a + r[k], 0) / tr.length : null);
export function summary(tr, tr2 = []) {
  const mt = monthT(tr, 'net'), mg = monthT(tr, 'gross'), ex = {};
  let run = 0, pk = 0, dd = 0; for (const r of tr) { run += r.net; pk = Math.max(pk, run); dd = Math.min(dd, run - pk); ex[r.why] = (ex[r.why] || 0) + 1; }
  const st = tr.map((r) => r.r0).sort((a, b) => a - b);
  return { n: tr.length, gross: r3(mean(tr, 'gross')), net: r3(mean(tr, 'net')), net2: r3(mean(tr2, 'net')), win: tr.length ? r3(tr.filter((r) => r.net > 0).length / tr.length) : null,
    total: r2(run), maxDD: r2(dd), stop$: st.length ? r2(st[st.length >> 1]) : null, months: mt.months, t: r2(mt.t), tGross: r2(mg.t), exits: ex };
}

const NAMES = { T1: 'H4, RSI(P1) >= 60 / <= 40', T2: 'H1, same rule', T3: 'H4, RSI(P1) >= 70 / <= 30' };
export function prepare(rows) {
  const r = dropSunday(rows).filter((x) => day(x[0]) >= '2006-01-01'), h1 = toBars(r), h4 = buildH4(r);
  const mk = (B, tf) => ({ B, tf, R: rsi(B), A: atr(B) });
  return { H4: mk(h4, H4), H1: mk(h1, H1) };
}
export function runAll(rows, opts = {}) {
  const seeds = opts.seeds ?? P.SEEDS, D = prepare(rows), span = [P.IS[0], P.OOS[1]];
  const cfg = { T1: { d: D.H4, o: {} }, T2: { d: D.H1, o: {} }, T3: { d: D.H4, o: { hiMin: P.RSI_HI3, loMax: P.RSI_LO3 } } };
  const tests = {};
  for (const T of ['T1', 'T2', 'T3']) {
    const { B, R, A, tf } = cfg[T].d;
    const sigs = signals(B, R, A, cfg[T].o).filter((s) => s.c + 1 < B.length && inW(B[s.c + 1].t, span));
    const all = stream(B, A, sigs, tf), all2 = stream(B, A, sigs, tf, 2);
    const by = (w, src = all.trades) => src.filter((r) => inW(r.te, w));
    const is = summary(by(P.IS), by(P.IS, all2.trades)), oos = summary(by(P.OOS), by(P.OOS, all2.trades));
    const half = { a: summary(by([P.OOS[0], P.HALF])), b: summary(by([P.HALF, P.OOS[1]])) };
    const sides = {}; for (const [nm, sd] of [['buy', 1], ['sell', -1]]) sides[nm] = { is: summary(by(P.IS).filter((r) => r.side === sd)), oos: summary(by(P.OOS).filter((r) => r.side === sd)) };
    oos.p = oos.t == null ? 1 : normSf(oos.t);
    // placebo: every OOS trade moved to a random OOS bar, same side and stop distance in ATR units
    const pool = []; for (let i = 0; i + 1 + P.HOLD < B.length; i++) if (A[i] != null && inW(B[i + 1].t, P.OOS)) pool.push(i);
    const oosTr = by(P.OOS), pm = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const rnd = mulberry32(seed), used = new Set(), picks = [];
      for (const r of oosTr) { let i; do { i = pool[Math.floor(rnd() * pool.length)]; } while (used.has(i)); used.add(i); picks.push({ c: i, side: r.side, dist: r.atrR }); }
      picks.sort((a, b) => a.c - b.c); pm.push(mean(stream(B, A, picks, tf).trades, 'net') ?? 0);
    }
    const ps = [...pm].sort((a, b) => a - b);
    const placebo = { seeds, mean: r3(pm.reduce((a, v) => a + v, 0) / (pm.length || 1)), q95: r3(ps[Math.ceil(0.95 * ps.length) - 1]), max: r3(ps.at(-1)), beats: pm.filter((v) => oos.net != null && oos.net > v).length };
    const years = {}; for (const r of all.trades) { const y = day(r.te).slice(0, 4); (years[y] ||= { n: 0, net: 0 }); years[y].n++; years[y].net += r.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    tests[T] = { name: NAMES[T], is, oos, halves: half, sides, placebo, years, funnel: all.funnel,
      trades: all.trades.map((r) => [r.te, r.side, r2(r.r0), r.why, r3(r.net)]) };
  }
  const ks = Object.keys(tests), hp = holm(ks.map((k) => tests[k].oos.p));
  ks.forEach((k, j) => {
    const x = tests[k]; x.holm = r3(hp[j]);
    x.checks = { oosPos: (x.oos.net ?? -1) > 0, t2: (x.oos.t ?? -9) >= 2 && hp[j] <= 0.05, isPos: (x.is.net ?? -1) > 0,
      costs2: (x.oos.net2 ?? -1) > 0, placebo: x.placebo.beats >= P.BEATS, n: x.oos.n >= P.MIN_N };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const passed = ks.filter((k) => tests[k].pass);
  return { verdict: tests.T1.pass ? 'PASS' : 'FAIL', passed, data: { from: day(rows[0][0]), to: day(rows.at(-1)[0]), candles: rows.length, h4: D.H4.B.length }, tests };
}

const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const ft = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
export function headline(res) {
  const T = res.tests, a = T.T1, others = ['T2', 'T3'].filter((k) => !T[k].pass).length;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3 pass: T1 (H4) made ${fmt(a.oos.net)}R a trade net out of sample (n ${a.oos.n}, month t ${ft(a.oos.t)}, Holm p ${a.holm.toFixed(2)}), ${fmt(a.is.net)}R in sample; ${others === 2 ? 'T2 and T3 fail too' : 'see the table'}.**`;
}
export function report(res, built) {
  const T = res.tests, L = [`# RSI divergence at gold's swing highs and lows: result (${built})`, '', headline(res), '',
    'Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone rule on spot gold that trades both sides, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44); none of that book\'s positions was read. Paper research only: nothing live changed and no proposal is written.', '',
    '## Rule', '',
    `- OANDA mid H1 XAU/USD, ${res.data.from} to ${res.data.to} (${res.data.candles} H1 candles; Sunday UTC stub hours dropped; ${res.data.h4} H4 candles built by UTC 4-hour bucket). Windows: IS 2007-16, OOS 2017 to 2026-10.`,
    '- Pivot = a high (low) beyond the 3 bars on each side, known 3 bars later. Bearish divergence: the new pivot high is above the previous pivot high 5-60 bars back while RSI(14) is lower there and that earlier RSI was at least 60 (T3: 70); bullish mirrors it (40 / 30).',
    '- Entry at the next bar\'s open after the confirmation bar; stop 0.25 x ATR(14) beyond the new pivot; target 2R; out at the 30th bar\'s close; stop first when one bar holds both; one position at a time per test.',
    `- Costs: $0.60 a round trip; buys pay \`FIN.xau.long\` (${P.FIN} of price a rollover) per \`nights()\`; 2× = $1.20 and twice the financing.`, '',
    '## Results (R of the stop distance; t on calendar-month sums of net R)', '',
    '| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median 1R $ | t net | t gross | Holm p (OOS) | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const k of Object.keys(T)) for (const [w, s] of [['IS 2007-16', T[k].is], ['OOS 2017-26', T[k].oos]])
    L.push(`| ${k} ${T[k].name} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1)} | ${fmt(s.total, 2)} | ${fmt(s.maxDD, 2)} | ${s.stop$ ?? 'n/a'} | ${ft(s.t)} | ${ft(s.tGross)} | ${w.startsWith('OOS') ? T[k].holm.toFixed(4) : ''} | ${w.startsWith('OOS') ? (T[k].pass ? 'yes' : 'no') : ''} |`);
  L.push('', '## By side (net R a trade, month t)', '', '| Test | Side | IS n | IS net R | IS t | OOS n | OOS net R | OOS t |', '|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) for (const sd of ['buy', 'sell']) { const s = T[k].sides[sd]; L.push(`| ${k} | ${sd} | ${s.is.n} | ${fmt(s.is.net)} | ${ft(s.is.t)} | ${s.oos.n} | ${fmt(s.oos.net)} | ${ft(s.oos.t)} |`); }
  L.push('', '## OOS halves (reported)', '', '| Test | 2017-21 n | net R | t | 2022-26 n | net R | t |', '|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) { const a = T[k].halves.a, b = T[k].halves.b; L.push(`| ${k} | ${a.n} | ${fmt(a.net)} | ${ft(a.t)} | ${b.n} | ${fmt(b.net)} | ${ft(b.t)} |`); }
  L.push('', '## Placebo (40 seeds: each OOS trade moved to a random OOS bar, same side and stop distance in ATR units, same exits and costs)', '',
    '| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) { const p = T[k].placebo; L.push(`| ${k} | ${fmt(T[k].oos.net)} | ${fmt(p.mean)} | ${fmt(p.q95)} | ${fmt(p.max)} | ${p.beats} of ${p.seeds} |`); }
  L.push('', '## Pass checks (all needed: OOS net > 0; OOS t ≥ 2 and Holm p ≤ 0.05; IS net > 0; positive at 2× costs; beats ≥ 38 of 40 placebos; OOS n ≥ 30)', '',
    '| Test | OOS > 0 | t / Holm | IS > 0 | 2× costs | Placebo | n |', '|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of Object.keys(T)) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.oosPos)} | ${yn(c.t2)} | ${yn(c.isPos)} | ${yn(c.costs2)} | ${yn(c.placebo)} | ${yn(c.n)} |`); }
  L.push('');
  for (const k of Object.keys(T)) {
    const f = T[k].funnel, ex = (s) => Object.entries(s.exits).map(([a, v]) => `${a} ${v}`).join(', ');
    L.push(`- ${k} funnel: ${f.signals} signals, ${f.trades} trades; skipped: busy ${f.busy || 0}, stop too close ${f['stop too close'] || 0}, stop side ${f['stop side'] || 0}, data end ${f['data end'] || 0}. Exits IS: ${ex(T[k].is)}; OOS: ${ex(T[k].oos)}.`);
  }
  L.push('', '| Year | ' + Object.keys(T).map((k) => `${k} n | ${k} net R`).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|---|').join(''));
  const ys = [...new Set(Object.values(T).flatMap((x) => Object.keys(x.years)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const v = T[k].years[y]; return v ? `${v.n} | ${fmt(v.net, 2)}` : '0 | n/a'; }).join(' | ') + ' |');
  L.push('', '## What this means', '', opts(res), '', '## Repeat', '', '`node research/edge/gold-rsi-divergence/run.mjs <xau-h1.json>` (OANDA mid H1 XAU_USD `[[t, o, h, l, c], ...]`, kept out of git).', '');
  return L.join('\n');
}
function opts(res) {
  const T = res.tests, g = Math.max(...Object.values(T).map((x) => Math.abs(x.oos.tGross ?? 0)));
  if (res.verdict === 'PASS') return 'The primary test passed the pre-registered bar: a proposal for the owner at most, never a live change.';
  return [`No test meets the pre-registered bar. Before costs the largest out-of-sample gross month t is ${g.toFixed(2)}:`,
    'a new swing high (low) that RSI fails to confirm is not followed by a reversal often enough to pay a 2R trade with the stop past the swing.',
    'The placebo keeps the buy / sell mix and the stop size, so it carries the same drift and the same costs; the seeds beaten say how the rule compares with random bars, not that it makes money when its own net R is not positive.',
    'Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.'].join(' ');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const f = process.argv[2]; if (!f) { console.error('usage: node run.mjs <xau-h1.json>'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')), built = new Date().toISOString().slice(0, 10);
  const res = runAll(rows); res.built = built;
  res.rule = { piv: P.PIV, back: [P.MIN_BACK, P.MAX_BACK], rsi: [P.RSI_HI, P.RSI_LO], rsi3: [P.RSI_HI3, P.RSI_LO3], buffer: P.BUF, target: P.TGT, hold: P.HOLD, cost: P.COST, fin: P.FIN, is: P.IS, oos: P.OOS };
  res.headline = headline(res);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res, built));
  for (const k of Object.keys(res.tests)) { const x = res.tests[k]; console.log(k, 'IS', x.is.n, x.is.gross, x.is.net, x.is.t, '| OOS', x.oos.n, x.oos.gross, x.oos.net, x.oos.t, x.oos.tGross, 'x2', x.oos.net2, 'holm', x.holm, 'plc', x.placebo.beats, x.placebo.mean, 'pass', x.pass); }
  console.log(res.headline, res.headline.length);
}
