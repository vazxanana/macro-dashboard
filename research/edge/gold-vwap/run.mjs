// Edge research · gold-vwap: does spot gold revert to, or trend away from, its session VWAP (anchored at the 18:00 New York
// daily open, weighted by OANDA tick volume) in a way tradeable after costs? Three tests (T1 fade the 2 sd close, T2 follow it,
// T3 buy / sell the first VWAP touch after a 1.5 sd excursion), as fixed in PREREGISTRATION.md (committed and pushed first).
//   node --use-env-proxy research/edge/gold-vwap/fetch.mjs <dir>   (OANDA M5 with volume, kept out of git)
//   node research/edge/gold-vwap/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Stand-alone study: not a gate, exit, entry or size of the live gold book, no candle before 2016 (owner decision 44).
// Pure pieces are exported for tests/gold-vwap.test.mjs. Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { cmeShut } from '../../../ict/calendar.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300;
export const P = Object.freeze({
  FADE: 2, STOP_FADE: 3, FOLLOW_STOP: 1, EXC: 1.5, PB_STOP: 1, PB_TGT: 1.5,
  MIN_DIST: 1.0, MIN_CANDLES: 150, SPREAD: 0.30, SLIP: 0.15, SEEDS: 40, Q: 0.95,
  FROM: '2016-01-01', TO: '2026-11-13', IS: ['2016-01-01', '2021-01-01'], OOS: ['2021-01-01', '2100-01-01'],
});
export const TESTS = Object.freeze({ T1: 'Fade the 2 sd close, target VWAP, stop 3 sd (primary)', T2: 'Follow the 2 sd close, stop 1 sd band, out 16:00 NY',
  T3: 'First VWAP touch after a 1.5 sd excursion, with the excursion, stop 1 sd, target 1.5 sd' });

// ── New York clock ──
const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const wdOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export function nyT(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number), [H, M] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, H, M) / 1000;
  return wall + nyOffsetH(wall + 5 * 3600) * 3600;
}

// ── trading days: 18:00 NY of the day before → 16:00 NY of D; skipped if any candle start is CME-shut ──
export function daySpan(D) { return { a: nyT(addDays(D, -1), '18:00'), z: nyT(D, '16:00'), e03: nyT(D, '03:00'), e15: nyT(D, '15:00') }; }
export function dayOk(D, shut = cmeShut) {
  const w = wdOf(D); if (w === 0 || w === 6) return false;
  const { a, z } = daySpan(D);
  for (let t = a; t < z; t += M5) if (shut(t)) return false;
  return true;
}
// candles (rows [t,o,h,l,c,v], sorted) of day D: start in [a, z)
export function sliceDay(rows, D, from = 0) {
  const { a, z, e03, e15 } = daySpan(D);
  let lo = from, hi = rows.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m][0] < a) lo = m + 1; else hi = m; }
  const out = []; let i = lo;
  for (; i < rows.length && rows[i][0] < z; i++) out.push(rows[i]);
  return { D, a, z, e03, e15, c: out, next: i };
}

// ── VWAP and volume-weighted sd through each candle (only candles closed at or before it) ──
export function bands(c) {
  let s0 = 0, s1 = 0, s2 = 0; const vw = [], sd = [];
  for (const r of c) {
    const p = (r[2] + r[3] + r[4]) / 3, v = Math.max(0, r[5] || 0);
    s0 += v; s1 += v * p; s2 += v * p * p;
    if (s0 > 0) { const m = s1 / s0; vw.push(m); sd.push(Math.sqrt(Math.max(0, s2 / s0 - m * m))); } else { vw.push(null); sd.push(null); }
  }
  return { vw, sd };
}
const endOf = (r) => r[0] + M5;
const inWin = (day, j) => { const e = endOf(day.c[j]); return e >= day.e03 && e <= day.e15; };

// ── signals (each returns the first trade of the day, or { skip } / null) ──
export function sigFade(day, b, follow = false) {
  const c = day.c;
  for (let j = 0; j < c.length - 1; j++) {
    if (!inWin(day, j) || b.vw[j] == null || !(b.sd[j] > 0)) continue;
    const x = c[j][4], up = x > b.vw[j] + P.FADE * b.sd[j], dn = x < b.vw[j] - P.FADE * b.sd[j];
    if (!up && !dn) continue;
    const k = j + 1, entry = c[k][1];
    let side, stop, target = null;
    if (!follow) { side = up ? -1 : 1; stop = b.vw[j] - side * P.STOP_FADE * b.sd[j]; target = b.vw[j]; }
    else { side = up ? 1 : -1; stop = b.vw[j] + side * P.FOLLOW_STOP * b.sd[j]; }
    if (side * (entry - stop) <= 0) return { skip: 'open beyond stop', j };
    if (target != null && side * (target - entry) <= 0) return { skip: 'open beyond target', j };
    if (Math.abs(entry - stop) < P.MIN_DIST) return { skip: 'stop under $1', j };
    return { j, k, side, entry, stop, target, kind: 'mkt' };
  }
  return null;
}
export function sigPullback(day, b) {
  const c = day.c; let j0 = -1, dir = 0;
  for (let j = 0; j < c.length; j++) {
    if (!inWin(day, j) || b.vw[j] == null || !(b.sd[j] > 0)) continue;
    const x = c[j][4];
    if (x > b.vw[j] + P.EXC * b.sd[j]) { j0 = j; dir = 1; break; }
    if (x < b.vw[j] - P.EXC * b.sd[j]) { j0 = j; dir = -1; break; }
  }
  if (j0 < 0) return null;
  for (let k = j0 + 1; k < c.length && endOf(c[k]) <= day.e15; k++) {
    const L = b.vw[k - 1], s = b.sd[k - 1];
    const hit = dir > 0 ? c[k][3] <= L : c[k][2] >= L;
    if (!hit) continue;
    const entry = dir > 0 ? Math.min(c[k][1], L) : Math.max(c[k][1], L);
    const stop = L - dir * P.PB_STOP * s, target = L + dir * P.PB_TGT * s;
    if (dir * (entry - stop) <= 0) return { skip: 'fill beyond stop', j: j0 };
    if (Math.abs(entry - stop) < P.MIN_DIST) return { skip: 'stop under $1', j: j0 };
    return { j: j0, k, side: dir, entry, stop, target, kind: 'lim' };
  }
  return { skip: 'no touch by 15:00', j: j0 };
}

// ── one trade forward on the day's candles; cm = cost multiple ──
export function sim(day, s, cm = 1) {
  const c = day.c, dist = Math.abs(s.entry - s.stop), side = s.side;
  let exit = null, how = null;
  for (let i = s.k; i < c.length; i++) {
    const r = c[i];
    if (i > s.k || s.kind === 'mkt') {   // a market fill is the open; a limit fill is inside the candle (only stop checked)
      if (side > 0 ? r[1] <= s.stop : r[1] >= s.stop) { exit = r[1]; how = 'gap'; break; }
    }
    if (side > 0 ? r[3] <= s.stop : r[2] >= s.stop) { exit = s.stop; how = 'stop'; break; }
    if (s.target != null && (i > s.k || s.kind === 'mkt') && (side > 0 ? r[2] >= s.target : r[3] <= s.target)) {
      exit = (i > s.k && (side > 0 ? r[1] >= s.target : r[1] <= s.target)) ? r[1] : s.target; how = 'target'; break;
    }
  }
  if (exit == null) { exit = c[c.length - 1][4]; how = 'time'; }
  const slips = (s.kind === 'mkt' ? 1 : 0) + (how === 'target' ? 0 : 1);
  const cost = cm * (P.SPREAD + P.SLIP * slips);
  const gross = side * (exit - s.entry) / dist;
  return { side, entry: s.entry, stop: s.stop, target: s.target, exit, how, dist, gross, cost, net: gross - cost / dist };
}
// mirror a trade around its own entry (placebo side)
export function mirror(s) {
  return { ...s, side: -s.side, stop: 2 * s.entry - s.stop, target: s.target == null ? null : 2 * s.entry - s.target };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, t: null };
  const m = xs.reduce((a, x) => a + x, 0) / n, v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return { n, mean: m, t: v > 0 ? m / Math.sqrt(v / n) : null };
}
export function monthT(rows, key = 'net') {
  const m = new Map(); for (const r of rows) { const k = r.D.slice(0, 7); m.set(k, (m.get(k) || 0) + r[key]); }
  const s = tstat([...m.values()]); return { months: s.n, t: s.t };
}
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
function summary(rows) {
  const n = rows.length, mean = (k) => (n ? rows.reduce((a, r) => a + r[k], 0) / n : null);
  const mt = monthT(rows, 'net'), mg = monthT(rows, 'gross');
  let run = 0, pk = 0, dd = 0; for (const r of rows) { run += r.net; pk = Math.max(pk, run); dd = Math.min(dd, run - pk); }
  const why = {}; for (const r of rows) why[r.how] = (why[r.how] || 0) + 1;
  return { n, buys: rows.filter((r) => r.side > 0).length, gross: r3(mean('gross')), net: r3(mean('net')), net2: r3(mean('net2')),
    totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: r3(n ? rows.filter((r) => r.net > 0).length / n : null), maxDD: r2(dd),
    months: mt.months, t: r2(mt.t), tGross: r2(mg.t), p: mt.t == null ? null : Math.round(normSf(mt.t) * 10000) / 10000, why };
}

// ── whole study ──
export function runAll(rows) {
  const days = []; let from = 0, skipped = { cme: 0, thin: 0 };
  for (let D = P.FROM; D <= P.TO; D = addDays(D, 1)) {
    const w = wdOf(D); if (w === 0 || w === 6) continue;
    const day = sliceDay(rows, D, from); from = Math.max(0, day.next - 400);
    if (!dayOk(D)) { skipped.cme++; continue; }
    if (day.c.length < P.MIN_CANDLES) { skipped.thin++; continue; }
    days.push(day);
  }
  const out = {}; const spec = { T1: (d, b) => sigFade(d, b, false), T2: (d, b) => sigFade(d, b, true), T3: sigPullback };
  for (const T of Object.keys(spec)) out[T] = { trades: [], specs: [], skips: {} };
  for (const day of days) {
    const b = bands(day.c);
    for (const T of Object.keys(spec)) {
      const s = spec[T](day, b);
      if (!s) continue;
      if (s.skip) { out[T].skips[s.skip] = (out[T].skips[s.skip] || 0) + 1; continue; }
      const x = sim(day, s, 1), x2 = sim(day, s, 2);
      out[T].trades.push({ D: day.D, ...x, net2: x2.net });
      out[T].specs.push({ day, s });
    }
  }
  const inW = (r, w) => r.D >= w[0] && r.D < w[1];
  const tests = {};
  for (const T of Object.keys(spec)) {
    const tr = out[T].trades;
    const is = tr.filter((r) => inW(r, P.IS)), oos = tr.filter((r) => inW(r, P.OOS));
    // placebo: random side on the same signals, mirrored exits, same candles and costs
    const oosSpecs = out[T].specs.filter((x) => inW({ D: x.day.D }, P.OOS));
    const means = [];
    for (let seed = 1; seed <= P.SEEDS; seed++) {
      const rnd = mulberry32(seed); let sum = 0;
      for (const { day, s } of oosSpecs) { const flip = rnd() < 0.5; sum += sim(day, flip ? mirror(s) : s, 1).net; }
      means.push(oosSpecs.length ? sum / oosSpecs.length : null);
    }
    const sorted = [...means].sort((a, b) => a - b);
    const byYear = {};
    for (const r of tr) { const y = r.D.slice(0, 4); (byYear[y] = byYear[y] || []).push(r); }
    tests[T] = { label: TESTS[T], skips: out[T].skips, is: summary(is), oos: summary(oos),
      placebo: { seeds: P.SEEDS, mean: r3(means.reduce((a, x) => a + x, 0) / means.length), q95: r3(sorted[Math.ceil(P.Q * sorted.length) - 1]),
        max: r3(sorted.at(-1)), beats: means.filter((x) => (oos.length ? oos.reduce((a, r) => a + r.net, 0) / oos.length : -Infinity) > x).length },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, rs]) => [y, { n: rs.length, net: r3(rs.reduce((a, r) => a + r.net, 0) / rs.length), gross: r3(rs.reduce((a, r) => a + r.gross, 0) / rs.length) }])) };
  }
  const keys = Object.keys(tests), hp = holm(keys.map((T) => tests[T].oos.p ?? 1));
  keys.forEach((T, i) => {
    const x = tests[T]; x.holm = Math.round(hp[i] * 10000) / 10000;
    const c = { t2: (x.oos.t ?? -9) >= 2 && x.holm <= 0.05, isPos: (x.is.net ?? -1) > 0, costs2: (x.oos.net2 ?? -1) > 0,
      placebo: (x.oos.net ?? -9) > x.placebo.q95, n: x.oos.n >= 100 };
    x.checks = c; x.pass = Object.values(c).every(Boolean);
  });
  return { days: days.length, skipped, tests, verdict: tests.T1.pass ? 'PASS' : 'FAIL' };
}

const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export function report(res) {
  const T = res.tests, L = [];
  const passed = Object.keys(T).filter((k) => T[k].pass);
  const t1 = T.T1.oos;
  L.push('# Gold session VWAP: fade, follow or pull back? Result (14 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}, ${passed.length} of 3 tests pass: fading the 2 sd close to VWAP made ${fmt(t1.net)}R a trade net out of sample (2021-now, n ${t1.n}, month t ${fmt(t1.t, 2)}); ${passed.length ? passed.join(', ') + ' passed' : 'follow and pullback failed too'}.**`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot',
    'gold, not a gate, exit, entry or size of the gold book; no candle before 2016 (docs/owner-decisions.md item 44). Paper research',
    'only: nothing live changed and no proposal is written.', '');
  L.push('## Rule (as pre-registered)', '',
    '- OANDA mid XAU/USD M5 with OANDA tick volume, through the candle proxy (`fetch.mjs`), 2016-01-01 to 2026-11-13.',
    `- Trading day = 18:00 New York the day before → 16:00 New York; a day with any CME-shut candle (\`ict/calendar.mjs\`) or under 150 candles is skipped: ${res.days} days kept (${res.skipped.cme} CME-shut, ${res.skipped.thin} thin).`,
    '- VWAP = Σ v·(H+L+C)/3 ÷ Σ v from the 18:00 anchor; sd = volume-weighted standard deviation of the typical price around it; both from candles closed at or before the signal.',
    '- Signals on M5 closes ending 03:00-15:00 New York, first signal of the day only, out by 16:00 New York; every trade has a fixed stop (≥ $1 away).',
    '- T1 fade: close beyond ±2 sd → against it at the next open, target a limit at VWAP, stop at the 3 sd band. T2 follow: with it, stop at the 1 sd band, out at 16:00. T3 pullback: after a close beyond ±1.5 sd, a limit at the last VWAP in the excursion\'s direction, stop 1 sd, target 1.5 sd.',
    '- Costs: $0.30 spread round trip + $0.15 slippage per market order (market entry, stop, time exit; a limit entry or target pays none); no financing (flat before the 17:00 rollover). 2× costs doubles both.', '');
  L.push('## Results (R of the stop distance; t on calendar-month sums of net R)', '');
  L.push('| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net | t gross | Holm p (OOS) | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) {
    for (const [w, s] of [['IS 2016-20', T[k].is], ['OOS 2021-now', T[k].oos]]) {
      const oos = w.startsWith('OOS');
      L.push(`| ${k} ${k === 'T1' ? 'fade (primary)' : k === 'T2' ? 'follow' : 'pullback'} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1)} | ${fmt(s.totalNet, 2)} | ${fmt(s.maxDD, 2)} | ${fmt(s.t, 2)} | ${fmt(s.tGross, 2)} | ${oos ? T[k].holm.toFixed(4) : ''} | ${oos ? (T[k].pass ? 'yes' : 'no') : ''} |`);
    }
  }
  L.push('', '## Placebo (40 seeds, random side on the same signals, exits mirrored around the same entry, out of sample)', '');
  L.push('| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) L.push(`| ${k} | ${fmt(T[k].oos.net)} | ${fmt(T[k].placebo.mean)} | ${fmt(T[k].placebo.q95)} | ${fmt(T[k].placebo.max)} | ${T[k].placebo.beats} of ${T[k].placebo.seeds} |`);
  L.push('', '## Pass checks (all needed: OOS t ≥ 2 and Holm p ≤ 0.05, IS net > 0, OOS net at 2× costs > 0, above the placebo 95th percentile, OOS n ≥ 100)', '');
  L.push('| Test | t / Holm | IS sign | 2× costs | Placebo | n |', '|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of Object.keys(T)) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.t2)} | ${yn(c.isPos)} | ${yn(c.costs2)} | ${yn(c.placebo)} | ${yn(c.n)} |`); }
  L.push('', '## Reported, not tested', '');
  L.push('Exits (IS / OOS):', '');
  for (const k of Object.keys(T)) L.push(`- ${k}: IS ${JSON.stringify(T[k].is.why)}; OOS ${JSON.stringify(T[k].oos.why)}; signals not traded ${JSON.stringify(T[k].skips)}`);
  L.push('', 'Net R a trade by year (n):', '');
  const years = [...new Set(Object.values(T).flatMap((x) => Object.keys(x.byYear)))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---').join('|') + '|');
  for (const y of years) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].byYear[y]; return b ? `${fmt(b.net)} (${b.n})` : ''; }).join(' | ') + ' |');
  L.push('', '## Reading', '');
  const g = (k) => T[k].oos;
  L.push(`Before costs the three rules are ${fmt(g('T1').gross)}R (T1), ${fmt(g('T2').gross)}R (T2) and ${fmt(g('T3').gross)}R (T3) a trade out of sample; the`,
    'cost of a trade sized to a stop of about one session standard deviation is what decides the net. Against the random-side',
    `placebo the rules beat ${T.T1.placebo.beats}, ${T.T2.placebo.beats} and ${T.T3.placebo.beats} of 40 seeds: where a rule sits above its placebo, the side carries a`,
    'little information, but not enough to pay for the spread and slippage on a stop this tight. Not an edge; never call the',
    'session VWAP a filter, gate or bias for any council system on this evidence. Any follow-up needs its own pre-registration on',
    'other data.', '');
  L.push('To repeat: `node --use-env-proxy research/edge/gold-vwap/fetch.mjs <dir>`, then `node research/edge/gold-vwap/run.mjs <dir>`.',
    'Tests: `tests/gold-vwap.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <dir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m-vol.json.gz'))));
  const res = runAll(rows);
  const json = { study: 'gold-vwap', title: 'Gold session VWAP: fade, follow or pull back (OANDA M5, volume-weighted, 18:00 New York anchor)', built: '2026-11-14',
    verdict: res.verdict, data: { candles: rows.length, from: rows[0][0], to: rows.at(-1)[0], days: res.days, skipped: res.skipped },
    params: P, costs: { spread: P.SPREAD, slippagePerMarketOrder: P.SLIP, financing: 'none (flat by 16:00 New York)' }, tests: res.tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(json, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  for (const k of Object.keys(res.tests)) { const x = res.tests[k]; console.log(k, 'IS', x.is.n, x.is.net, x.is.t, 'OOS', x.oos.n, x.oos.gross, x.oos.net, x.oos.t, 'holm', x.holm, 'plc95', x.placebo.q95, x.pass); }
  console.log('verdict', res.verdict);
}
