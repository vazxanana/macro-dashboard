// The H4 inside-bar breakout on spot gold (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-h4-inside-bar/run.mjs fetch <dir>   OANDA mid H1 gold -> <dir>/xau-h1.json (keep out of git)
//   node research/edge/gold-h4-inside-bar/run.mjs full <dir>                    the study -> result.json + RESULT.md
// A stand-alone rule: never a gate, exit, entry or size of the live gold book. Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600, H4 = 4 * H, DAY = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const ATR_N = 14, LIFE = 24, HOLD = 24, TGT = 2, MIN_ATR = 1;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const SEED = 20261114, SEEDS = 40;

// H4 bucket start, boundaries at 22 / 02 / 06 / 10 / 14 / 18 UTC; Sunday hours before 22:00 go to the Sunday 22:00 candle
export function h4Start(t) {
  const d = new Date(t * 1000);
  if (d.getUTCDay() === 0 && d.getUTCHours() < 22) return Math.floor(t / DAY) * DAY + 22 * H;
  return Math.floor((t - 2 * H) / H4) * H4 + 2 * H;
}
// H4 candles from H1 rows [t, o, h, l, c]; `next` = index of the first H1 candle after this H4 candle; atr = simple ATR(14)
export function toH4(h1) {
  const c = []; let cur = null;
  h1.forEach(([t, o, h, l, cl], j) => {
    const k = h4Start(t);
    if (!cur || cur.time !== k) { cur = { time: k, open: o, high: h, low: l, close: cl, next: j + 1 }; c.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = cl; cur.next = j + 1; }
  });
  const tr = c.map((x, i) => (i ? Math.max(x.high, c[i - 1].close) - Math.min(x.low, c[i - 1].close) : x.high - x.low));
  c.forEach((x, i) => { if (i >= ATR_N - 1) { let s = 0; for (let k = i - ATR_N + 1; k <= i; k++) s += tr[k]; x.atr = s / ATR_N; } else x.atr = null; });
  return c;
}

// inside bar at H4 candle i (mother i-1), mother range >= MIN_ATR x ATR(14) read on candle i
export function inside(c, i) {
  if (i < 1) return false; const m = c[i - 1], x = c[i];
  if (!(x.atr > 0)) return false;
  return x.high < m.high && x.low > m.low && m.high - m.low >= MIN_ATR * x.atr;
}

const cost = (side, fill, risk, fillT, exitT, k = 1) => {
  const nn = side > 0 ? nights(fillT, exitT) : 0, c = RT / risk, fin = side > 0 ? nn * FIN.xau.long * fill / risk : 0;
  return { nights: nn, cost: c, fin };
};
// manage an open trade on H1 from candle j (the fill candle; only the stop is read on it) to the time exit
export function manage(h1, j, side, fill, stop, tgt) {
  const risk = Math.abs(fill - stop), target = tgt == null ? null : fill + side * tgt * risk, last = j + HOLD - 1;
  if (last >= h1.length) return null;
  let exit = null, how = null, k = j;
  for (; k <= last; k++) {
    const [, o, h, l, cl] = h1[k];
    if (side > 0 ? l <= stop : h >= stop) { exit = k === j ? stop : side > 0 ? Math.min(o, stop) : Math.max(o, stop); how = 'stop'; break; }
    if (k > j && target != null && (side > 0 ? h >= target : l <= target)) { exit = side > 0 ? Math.max(o, target) : Math.min(o, target); how = 'target'; break; }
    if (k === last) { exit = cl; how = 'time'; break; }
  }
  return { risk, target, exit, how, exitIdx: k };
}
function book(h1, j, side, fill, stop, m, extra = {}) {
  const fillT = h1[j][0], exitT = h1[m.exitIdx][0] + H, gross = side * (m.exit - fill) / m.risk, c = cost(side, fill, m.risk, fillT, exitT);
  return { ...extra, side, fillIdx: j, exitIdx: m.exitIdx, fillT, exitT, fill, stop, target: m.target, risk: m.risk, exit: m.exit, how: m.how,
    gross, cost: c.cost, fin: c.fin, nights: c.nights, net: gross - c.cost - c.fin, net2: gross - 2 * (c.cost + c.fin) };
}

// one bracket from inside candle i: OCO stops at the mother's high / low for LIFE H1 candles; null = unfilled / no trade
export function bracket(h1, c, i, tgt, buyOnly = false) {
  const m = c[i - 1], hi = m.high, lo = m.low, s = c[i].next, end = Math.min(h1.length, s + LIFE);
  for (let j = s; j < end; j++) {
    const [, o, h, l] = h1[j], up = h >= hi, dn = !buyOnly && l <= lo;
    if (!up && !dn) continue;
    let side;
    if (up && dn) side = Math.abs(o - hi) <= Math.abs(o - lo) ? 1 : -1;
    else side = up ? 1 : -1;
    const fill = side > 0 ? Math.max(o, hi) : Math.min(o, lo), stop = side > 0 ? lo : hi;
    if (side > 0 ? fill <= stop : fill >= stop) return { unfilled: false, none: true, expIdx: j };
    const mg = manage(h1, j, side, fill, stop, tgt); if (!mg) return null;
    return book(h1, j, side, fill, stop, mg, { sig: i, both: up && dn });
  }
  return { unfilled: true, expIdx: end - 1 };
}

export const TESTS = {
  T1: { name: 'T1 both sides, target 2R', tgt: TGT, buyOnly: false },
  T2: { name: 'T2 both sides, no target, time exit after 24 H1 candles', tgt: null, buyOnly: false },
  T3: { name: 'T3 buy stop only, target 2R', tgt: TGT, buyOnly: true },
};
export function runTest(h1, c, test) {
  const out = []; let unfilled = 0, signals = 0, busy = -1;   // busy = last H1 index used by the previous bracket / trade
  for (let i = 1; i < c.length; i++) {
    if (c[i].next <= busy) continue;   // new orders start only after the last bracket / trade's final H1 candle
    if (!inside(c, i)) continue;
    const r = bracket(h1, c, i, test.tgt, test.buyOnly); if (!r) break;
    signals++;
    if (r.unfilled || r.none) { unfilled++; busy = r.expIdx; continue; }
    out.push(r); busy = r.exitIdx;
  }
  out.signals = signals; out.unfilled = unfilled;
  return out;
}

export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.fillT); return s >= f && s <= t; });
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map();
  for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
export function summary(T, w) {
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null), mt = monthT(T, w), mg = monthT(T, w, 'gross'), m2 = monthT(T, w, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const rs = T.map((x) => x.risk).sort((a, b) => a - b);
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, targets: T.filter((x) => x.how === 'target').length, longs: T.filter((x) => x.side > 0).length,
    medianRisk: n ? r2(rs[Math.floor(n / 2)]) : null, months: mt.months, t: r2(mt.t), tGross: r2(mg.t), t2x: r2(m2.t), dd: r2(dd) };
}
// placebo / same-side baseline: each real OOS trade -> a random H1 candle of the same calendar year, same side, same risk as a
// fraction of price, same target multiple, same time exit and costs; the open of that candle is the fill
export function placebo(h1, test, real, seeds = SEEDS) {
  const pool = new Map();
  for (let j = 0; j < h1.length - HOLD; j++) { const y = ymd(h1[j][0]).slice(0, 4); if (!pool.has(y)) pool.set(y, []); pool.get(y).push(j); }
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(SEED + s), T = [];
    for (const x of real) { const P = pool.get(ymd(x.fillT).slice(0, 4)); if (!P) continue;
      const j = P[Math.floor(r() * P.length)], fill = h1[j][1], stop = fill - x.side * fill * x.risk / x.fill;
      const mg = manage(h1, j, x.side, fill, stop, test.tgt); if (mg) T.push(book(h1, j, x.side, fill, stop, mg).net); }
    means.push(T.length ? T.reduce((a, b) => a + b, 0) / T.length : 0); }
  return means;
}

async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const now = Math.floor(Date.now() / 1000), m = new Map();
  for (let a = Math.floor(Date.parse('2006-01-01T00:00:00Z') / 1000); a < now;) {
    const b = Math.min(now, a + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2500 * (k + 1));
    }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(2200);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
  console.log(`xau 1h: ${rows.length} candles`);
}

const f3 = (v) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3));
const f2 = (v) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
export function report(out) {
  const T = out.tests, t1 = T.T1, yn = (b) => (b ? 'yes' : 'no');
  const head = `**Verdict: ${out.verdict}, ${out.passCount} of 3: the gold H4 inside-bar breakout (T1, 2R) made ${f3(t1.oos.net)}R a trade net out of sample (n ${t1.oos.n}, month t ${f2(t1.oos.t)}), ${f3(t1.is.net)}R in sample.**`;
  const row = (k, lab, s) => `| ${k} | ${lab} | ${s.n} | ${f3(s.gross)} | ${f3(s.net)} | ${f3(s.net2x)} | ${s.win} | ${f2(s.total)} | ${f2(s.dd)} | ${f2(s.tGross)} | ${f2(s.t)} | ${s.medianRisk} |`;
  const L = [`# The H4 inside-bar breakout on spot gold: result (${out.built})`, '', head, '',
    'Pre-registered in `PREREGISTRATION.md` (pushed alone before `run.mjs` existed). A new stand-alone rule, not a gate, exit,',
    'entry or size of the gold book (docs/owner-decisions.md item 44); none of that book\'s positions was read. Paper research',
    'only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.', '',
    '## Rule (as pre-registered)', '',
    '- OANDA mid XAU/USD H1 candles, H4 on fixed UTC boundaries 22 / 02 / 06 / 10 / 14 / 18 (Sunday hours before 22:00 with the',
    '  Sunday 22:00 candle). Inside bar: high and low strictly inside the previous (mother) H4 candle, mother range >= 1 x ATR(14).',
    '- At the inside candle\'s close: buy stop at the mother high, sell stop at the mother low, one-cancels-other, live 24 H1 candles.',
    '  **Stop = the other side of the mother candle on every trade.** Fills, stops and targets run on H1 candles; a gapped fill at the',
    '  open; one candle through both levels = the side nearer its open and a full loss; the fill candle reaching the stop = a full',
    '  loss. T1 / T3 target 2R, T2 none; time exit at the close of the 24th H1 candle from the fill. One bracket or trade at a time.',
    '- Costs $0.60 a round trip (2x = $1.20); buys pay `nights` x `FIN.xau.long` (0.000148) financing.',
    `- In sample: fills ${WIN.is[0]} to ${WIN.is[1]}; out of sample (decisive): ${WIN.oos[0]} to ${WIN.oos[1]}. t on calendar-month sums of`,
    '  net R, Holm over the three OOS p values; baseline / placebo = 40 seeds of a same-side trade at a random H1 candle of the same',
    '  year with the same risk (as a fraction of price), target and hold.',
    '- Detail fixed in code, not named in the pre-registration: the target is read from the candle after the fill candle (on the',
    '  fill candle only the stop is read, so a fill candle that also ran to the target is not booked as a win).', '',
    `Data: ${out.data.src}; ${out.data.from} to ${out.data.to}, ${out.data.h1} H1 / ${out.data.h4} H4 candles.`, '',
    '## Results', '',
    '| Test | Window | n | Gross R | Net R | Net at 2x | Win % | Total net R | Worst DD R | Month t gross | Month t net | Median risk $ |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, x] of Object.entries(T)) { L.push(row(k, `IS ${WIN.is[0].slice(0, 4)}-${WIN.is[1].slice(2, 4)}`, x.is)); L.push(row(k, `OOS ${WIN.oos[0].slice(0, 4)}-${WIN.oos[1].slice(2, 4)}`, x.oos)); }
  L.push('', 'Tests: ' + Object.entries(T).map(([k, x]) => `${k} = ${x.name.replace(/^T\d /, '')}`).join('; ') + '.',
    `Signals (whole file): ${Object.entries(T).map(([k, x]) => `${k} ${x.signals} brackets, ${x.unfilled} unfilled`).join('; ')}.`, '',
    '## The checks', '', '| Test | OOS net > 0, t >= 2, Holm p < 0.05 | Holm p | IS net > 0 | OOS at 2x > 0 | Beats >= 38 of 40 placebos | OOS n >= 30 | Pass |',
    '|---|---|---|---|---|---|---|---|');
  for (const [k, x] of Object.entries(T)) L.push(`| ${k} | ${yn(x.checks.oos)} | ${x.holm} | ${yn(x.checks.is)} | ${yn(x.checks.cost2x)} | ${yn(x.checks.placebo)} | ${yn(x.checks.n)} | ${yn(x.pass)} |`);
  L.push('', '## Same-side baseline and placebo (out of sample, 40 seeds)', '',
    'Each seed puts every real OOS trade at a random H1 candle of the same year, same side, same risk as a fraction of price, same target and hold, same costs.', '',
    '| Test | Real net R a trade | Baseline (mean of seeds) | Seeds beaten | 5th pct | Median | 95th pct |', '|---|---|---|---|---|---|---|');
  for (const [k, x] of Object.entries(T)) L.push(`| ${k} | ${f3(x.oos.net)} | ${f3(x.placebo.mean)} | ${x.placebo.beaten} of ${x.placebo.of} | ${f3(x.placebo.p5)} | ${f3(x.placebo.median)} | ${f3(x.placebo.p95)} |`);
  L.push('', '## Buys and sells (out of sample; reported, not judged)', '', '| Test | Side | n | Gross R | Net R | Month t net |', '|---|---|---|---|---|---|');
  for (const [k, x] of Object.entries(T)) for (const [lab, s] of [['buys', x.bySide.oosLong], ['sells', x.bySide.oosShort]]) if (s.n) L.push(`| ${k} | ${lab} | ${s.n} | ${f3(s.gross)} | ${f3(s.net)} | ${f2(s.t)} |`);
  L.push('', '## T1 by year (net R a trade)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(t1.years)) L.push(`| ${y} | ${v.n} | ${f3(v.net)} |`);
  L.push('', '## Reading', '', out.reading, '',
    'To repeat: `node --use-env-proxy research/edge/gold-h4-inside-bar/run.mjs fetch <dir>` (candles outside git), then',
    '`node research/edge/gold-h4-inside-bar/run.mjs full <dir>`. Test: `tests/gold-h4-inside-bar.test.mjs`.', '');
  return L.join('\n');
}

export function readingOf(out) {
  const { T1, T2, T3 } = out.tests, L = T1.bySide;
  return [
    `Before costs the bracket has a small positive drift (T1 ${f3(T1.oos.gross)}R a trade out of sample, month t ${f2(T1.oos.tGross)};`,
    `${f3(T1.is.gross)}R in sample), but with a median risk of $${T1.oos.medianRisk} the $0.60 round trip and the buys' financing take`,
    `${(T1.oos.cost + T1.oos.fin).toFixed(3)}R a trade and leave ${f3(T1.oos.net)}R (t ${f2(T1.oos.t)}); at 2x costs ${f3(T1.oos.net2x)}R.`,
    `The gross drift is the buys (out of sample ${f3(L.oosLong.gross)}R gross, ${f3(L.oosLong.net)}R net, n ${L.oosLong.n}) while the sells`,
    `make ${f3(L.oosShort.gross)}R gross: the same pattern as gold's rise over 2017-26, not a property of the inside bar. T1 beat`,
    `${T1.placebo.beaten} of 40 same-side random trades of equal size and hold (baseline ${f3(T1.placebo.mean)}R), short of the 38 needed.`,
    `T2 (no target) and T3 (buy stop only) fail too: T3 ${f3(T3.oos.net)}R out of sample against a random-buy baseline of`,
    `${f3(T3.placebo.mean)}R (beaten by ${T3.placebo.beaten} of 40) and ${f3(T3.is.net)}R in sample; T2 ${f3(T2.oos.net)}R.`,
    'Like the daily inside day (`gold-inside-day`), the H4 inside bar is not an edge on gold after costs; no follow-up is proposed.',
  ].join(' ');
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
  const c = toH4(h1);
  const pre = fs.readFileSync(new URL('./PREREGISTRATION.md', import.meta.url));
  const out = { built: '2026-11-14', topic: 'gold-h4-inside-bar', system: 'spot gold H4 inside-bar breakout (stand-alone, paper research)',
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy, aggregated to H4 on fixed UTC boundaries 22/02/06/10/14/18',
      from: ymd(h1[0][0]), to: ymd(h1.at(-1)[0]), h1: h1.length, h4: c.length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, side: 'buys only' } },
    rule: { atrN: ATR_N, minMotherAtr: MIN_ATR, orderLifeH1: LIFE, holdH1: HOLD, target: TGT }, windows: WIN, seed: SEED, tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runTest(h1, c, test), oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(h1, test, oos), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const s = ymd(x.fillT); if (s < WIN.is[0] || s > WIN.oos[1]) continue; (years[s.slice(0, 4)] ||= []).push(x); }
    const side = (T, s, w) => summary(T.filter((x) => x.side === s), w);
    out.tests[k] = { name: test.name, signals: all.signals, unfilled: all.unfilled, oos: so, is: si, p: +p.toFixed(4),
      bySide: { oosLong: side(oos, 1, WIN.oos), oosShort: side(oos, -1, WIN.oos), isLong: side(is, 1, WIN.is), isShort: side(is, -1, WIN.is) },
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, net: r3(T.reduce((a, x) => a + x.net, 0) / T.length) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { oos: x.oos.net > 0 && x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38, n: x.oos.n >= 30 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.passCount = Object.values(out.tests).filter((x) => x.pass).length;
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  out.reading = readingOf(out);
  out.preregistration = { file: 'PREREGISTRATION.md', bytes: pre.length };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(out));
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks, bySide: x.bySide }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: run.mjs fetch|full <dir>');
  if (cmd === 'fetch') await fetchH1(dir); else full(dir);
}
