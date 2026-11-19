// Edge research · gold-pre-cpi: gold in the three days before US CPI and payrolls, and the fade of that move after the print.
// Pre-registration: PREREGISTRATION.md (pushed before any candle was read). Paper research only; nothing live reads this.
//   node --use-env-proxy research/edge/gold-pre-cpi/fetch.mjs <dir>     (OANDA H1 gold, cache outside git)
//   node research/edge/gold-pre-cpi/run.mjs <dir>                        (writes result.json and RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const NY = 'America/New_York', H = 3600;
export const COST = 0.30 + 2 * 0.15;            // $0.30 spread + half a spread of slippage on each of two market orders
export const STOP_K = 2, ATR_N = 20, SEED = 20261114, DRAWS = 40;

// ── dates (repository only) ──
// FOMC 2018-21: research/edge/histdata-clock/run.mjs FOMC_EARLY (Federal Reserve meeting calendars); exclusion only.
export const FOMC_EARLY = ['2018-01-31', '2018-03-21', '2018-05-02', '2018-06-13', '2018-08-01', '2018-09-26', '2018-11-08', '2018-12-19',
  '2019-01-30', '2019-03-20', '2019-05-01', '2019-06-19', '2019-07-31', '2019-09-18', '2019-10-30', '2019-12-11',
  '2020-01-29', '2020-04-29', '2020-06-10', '2020-07-29', '2020-09-16', '2020-11-05', '2020-12-16',
  '2021-01-27', '2021-03-17', '2021-04-28', '2021-06-16', '2021-07-28', '2021-09-22', '2021-11-03', '2021-12-15'];
// CPI 2018-21 BLS schedule: research/edge/event-reaction/build.mjs CPI_EARLY; exclusion only (events come from event-base rows).
export const CPI_EARLY = ['2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const dayMs = (s) => Date.parse(s + 'T00:00:00Z');
export const isWeekday = (s) => { const w = new Date(dayMs(s)).getUTCDay(); return w >= 1 && w <= 5; };
export function weekdaysBefore(s, k) { let ms = dayMs(s), n = 0; while (n < k) { ms -= 86400e3; if (isWeekday(ymd(ms))) n++; } return ymd(ms); }

// Times of one release day R (New York date): E, X, F, C as UTC seconds.
export function timesOf(R) {
  return { E: zonedToUtc(weekdaysBefore(R, 3), '17:00', NY), X: zonedToUtc(R, '08:00', NY), F: zonedToUtc(R, '09:00', NY), C: zonedToUtc(R, '16:00', NY) };
}

export function releaseLists(eventBase, last) {
  const cpi = [], nfp = [], other = [];
  for (const r of eventBase.rows) if (r.type === 'CPI' && r.d < '2022-01-01') cpi.push({ type: 'CPI', d: r.d, t: r.t });
  for (const e of [...HISTORY, ...EVENTS]) {
    const d = e.local.slice(0, 10);
    if (e.type === 'CPI' && e.t < last) cpi.push({ type: 'CPI', d, t: e.t });
    if (e.type === 'NFP' && e.t < last) nfp.push({ type: 'NFP', d, t: e.t });
    if (['CPI', 'NFP', 'FOMC'].includes(e.type)) other.push({ type: e.type, d, t: e.t });
  }
  for (const d of CPI_EARLY) other.push({ type: 'CPI', d, t: zonedToUtc(d, '08:30', NY) });
  for (const d of FOMC_EARLY) other.push({ type: 'FOMC', d, t: zonedToUtc(d, '14:00', NY) });
  for (let y = 2017; y <= 2021; y++) for (let m = 0; m < 12; m++) {          // payrolls 2017-21 unknown: first and second Friday
    const first = 1 + ((5 - new Date(Date.UTC(y, m, 1)).getUTCDay() + 7) % 7);
    for (const dd of [first, first + 7]) { const d = ymd(Date.UTC(y, m, dd)); other.push({ type: 'NFP?', d, t: zonedToUtc(d, '08:30', NY) }); }
  }
  const by = (a, b) => a.t - b.t;
  return { cpi: cpi.sort(by), nfp: nfp.sort(by), other: other.sort(by), otherDays: new Set(other.map((x) => x.d)) };
}

// another release after E and at or before C (the event's own release excluded)
export const blocked = (others, tm, ownT) => others.some((o) => o.t !== ownT && o.t > tm.E && o.t <= tm.C);

// ── candles ──
export function indexOf(bars) { const m = new Map(); bars.forEach((b, i) => m.set(b[0], i)); return m; }
// index of the candle that ENDS at t (opens t − 1 h); fallback: the last candle ending within `back` seconds before t
export function endingAt(idx, bars, t, back = 0) {
  for (let s = 0; s <= back; s += H) { const i = idx.get(t - H - s); if (i != null) return i; }
  return -1;
}
// ATR20 of the complete candles ending at or before candle i (true range with the previous close)
export function atr(bars, i, n = ATR_N) {
  if (i < n) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const [, , h, l] = bars[k], pc = bars[k - 1][4]; s += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); }
  return s / n;
}
// One trade: entry at the close of candle i0, managed on candles i0+1..i1, out at the close of i1 unless the stop is reached.
export function trade(bars, i0, i1, dir, holdH) {
  const entry = bars[i0][4], a = atr(bars, i0);
  if (!(a > 0) || i1 <= i0) return null;
  const dist = STOP_K * a * Math.sqrt(holdH), stop = entry - dir * dist;
  let exit = bars[i1][4], how = 'time', tOut = bars[i1][0] + H;
  for (let k = i0 + 1; k <= i1; k++) {
    const [t, o, h, l] = bars[k];
    if (dir > 0 ? o <= stop : o >= stop) { exit = o; how = 'gap'; tOut = t; break; }
    if (dir > 0 ? l <= stop : h >= stop) { exit = stop; how = 'stop'; tOut = t + H; break; }
  }
  const tIn = bars[i0][0] + H, gross = dir * (exit - entry) / dist;
  const nn = dir > 0 ? nights(tIn, tOut) : 0, fin = nn * FIN.xau.long * entry;
  return { tIn, tOut, entry, stop, exit, how, dist, gross, nights: nn, net: gross - (COST + fin) / dist, net2: gross - 2 * (COST + fin) / dist };
}

// Run one release day: { pre: T1/T2 trade, move, fade: T3 trade } (null parts when candles are missing).
export function runDay(bars, idx, R) {
  const tm = timesOf(R), iE = endingAt(idx, bars, tm.E, 3 * H), iX = endingAt(idx, bars, tm.X);
  if (iE < 0 || iX < 0 || iX <= iE) return { R, skip: 'no candles' };
  const holdH = (tm.X - (bars[iE][0] + H)) / H;
  const pre = trade(bars, iE, iX, 1, holdH), move = bars[iX][4] / bars[iE][4] - 1;
  let fade = null;
  const iF = endingAt(idx, bars, tm.F), iC = endingAt(idx, bars, tm.C);
  if (iF >= 0 && iC > iF && move !== 0) fade = trade(bars, iF, iC, move > 0 ? -1 : 1, (tm.C - tm.F) / H);
  if (fade) fade.post = bars[iC][4] / bars[iF][4] - 1;
  return { R, pre, move, fade };
}

// ── statistics ──
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export const tOf = (a) => (a.length > 1 && sd(a) > 0 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : 0);
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; } return h; }
function lgamma(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p of t with df degrees of freedom (H1: mean > 0)
export function pOne(t, df) { if (!(df > 0)) return 1; const x = df / (df + t * t), tail = 0.5 * ibeta(x, df / 2, 0.5); return t > 0 ? tail : 1 - tail; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; }); return out; }
export function monthSums(rows, key = 'net') { const m = new Map(); for (const r of rows) { const k = r.R.slice(0, 7); m.set(k, (m.get(k) || 0) + r[key]); } return [...m.values()]; }
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 1e4) / 1e4;

function summary(rows) {
  const net = rows.map((r) => r.net), ms = monthSums(rows), t = tOf(ms);
  const half = Math.floor(rows.length / 2), h1 = rows.slice(0, half), h2 = rows.slice(half);
  return { n: rows.length, months: ms.length, net: r3(mean(net)), gross: r3(mean(rows.map((r) => r.gross))), net2: r3(mean(rows.map((r) => r.net2))),
    t: r2(t), p: pOne(t, ms.length - 1), tTrades: r2(tOf(net)), total: r2(net.reduce((s, x) => s + x, 0)),
    first: { n: h1.length, from: h1[0]?.R, to: h1.at(-1)?.R, net: r3(mean(h1.map((r) => r.net))), t: r2(tOf(monthSums(h1))) },
    second: { n: h2.length, from: h2[0]?.R, to: h2.at(-1)?.R, net: r3(mean(h2.map((r) => r.net))), t: r2(tOf(monthSums(h2))) },
    stops: rows.filter((r) => r.how !== 'time').length, medianRisk: r2([...rows.map((r) => r.dist)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] || 0) };
}
function byYear(rows) { const m = {}; for (const r of rows) { const y = r.R.slice(0, 4); (m[y] = m[y] || []).push(r.net); }
  return Object.fromEntries(Object.entries(m).map(([y, a]) => [y, { n: a.length, net: r3(mean(a)), sum: r2(a.reduce((s, x) => s + x, 0)) }])); }

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── main ──
export function study(bars, eventBase) {
  const idx = indexOf(bars), last = bars.at(-1)[0] + H;
  const L = releaseLists(eventBase, last);
  const lastOk = (R) => timesOf(R).C <= last;
  const dropped = [], kept = { CPI: [], NFP: [] };
  for (const [type, list] of [['CPI', L.cpi], ['NFP', L.nfp]]) for (const e of list) {
    if (!lastOk(e.d)) continue;
    const tm = timesOf(e.d);
    if (blocked(L.other, tm, e.t)) { const o = L.other.filter((x) => x.t !== e.t && x.t > tm.E && x.t <= tm.C).map((x) => `${x.type} ${x.d}`); dropped.push({ type, d: e.d, why: `another release in the window: ${[...new Set(o)].join(', ')}` }); continue; }
    const day = runDay(bars, idx, e.d);
    if (day.skip || !day.pre) { dropped.push({ type, d: e.d, why: 'missing candles' }); continue; }
    kept[type].push({ ...day, type });
  }
  const T1 = kept.CPI.map((d) => ({ R: d.R, ...d.pre })), T2 = kept.NFP.map((d) => ({ R: d.R, ...d.pre }));
  const allDays = [...kept.CPI, ...kept.NFP].sort((a, b) => (a.R < b.R ? -1 : 1));
  const T3 = allDays.filter((d) => d.fade).map((d) => ({ R: d.R, type: d.type, move: d.move, ...d.fade }));
  const tests = { T1: summary(T1), T2: summary(T2), T3: summary(T3) };
  const hp = holm([tests.T1.p, tests.T2.p, tests.T3.p]);
  ['T1', 'T2', 'T3'].forEach((k, i) => { tests[k].holm = hp[i]; });

  // placebo
  const months = new Map();                                      // 'YYYY-MM' → candidate weekdays
  const cand = (ym) => { if (months.has(ym)) return months.get(ym); const out = [];
    for (let dd = 1; dd <= 31; dd++) { const d = `${ym}-${pad(dd)}`; if (Number.isNaN(dayMs(d)) || ymd(dayMs(d)) !== d || !isWeekday(d) || L.otherDays.has(d) || !lastOk(d)) continue;
      const tm = timesOf(d); if (L.other.some((o) => o.t > tm.E && o.t <= tm.C)) continue; out.push(d); }
    months.set(ym, out); return out; };
  const cache = new Map(), dayRun = (d) => { if (!cache.has(d)) cache.set(d, runDay(bars, idx, d)); return cache.get(d); };
  const plac = { T1: [], T2: [], T3: [] };
  for (let k = 0; k < DRAWS; k++) {
    const rnd = mulberry32(SEED + k), acc = { T1: [], T2: [], T3: [] };
    for (const d of allDays) {
      const c = cand(d.R.slice(0, 7)); if (!c.length) continue;
      const p = dayRun(c[Math.floor(rnd() * c.length)]); if (p.skip || !p.pre) continue;
      acc[d.type === 'CPI' ? 'T1' : 'T2'].push(p.pre.net); if (p.fade) acc.T3.push(p.fade.net);
    }
    for (const t of ['T1', 'T2', 'T3']) plac[t].push(mean(acc[t]));
  }
  for (const t of ['T1', 'T2', 'T3']) {
    const s = [...plac[t]].sort((a, b) => a - b);
    tests[t].placebo = { median: r3(s[19]), p95: r3(s[37]), beats: plac[t].filter((x) => tests[t].net > x).length, means: plac[t].map(r3) };
    const x = tests[t];
    x.checks = { tHolm: x.t >= 2 && x.holm < 0.05 && x.net > 0, halves: x.first.net > 0 && x.second.net > 0, costs2: x.net2 > 0, placebo: x.placebo.beats >= 38 };
    x.pass = Object.values(x.checks).every(Boolean);
    x.holm = r3(x.holm); x.p = r3(x.p);
  }
  // descriptive
  const drift = (rows) => { const a = rows.map((d) => 100 * d.move); return { n: a.length, meanPct: r4(mean(a)), t: r2(tOf(a)) }; };
  const corrOf = (rows) => { const x = rows.map((r) => r.move), y = rows.map((r) => r.post), mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return r3(sxy / Math.sqrt(sxx * syy)); };
  const sub = (rows) => (rows.length ? { n: rows.length, net: r3(mean(rows.map((r) => r.net))), t: r2(tOf(rows.map((r) => r.net))) } : { n: 0 });
  const cpiSplit = { '2018-21': sub(T1.filter((r) => r.R < '2022')), '2022-26': sub(T1.filter((r) => r.R >= '2022')) };
  const desc = {
    drift: { CPI: drift(kept.CPI), NFP: drift(kept.NFP) }, cpiSplit,
    T3: { CPI: sub(T3.filter((r) => r.type === 'CPI')), NFP: sub(T3.filter((r) => r.type === 'NFP')), afterUp: sub(T3.filter((r) => r.move > 0)), afterDown: sub(T3.filter((r) => r.move < 0)), corrPrePost: corrOf(T3) },
    byYear: { T1: byYear(T1), T2: byYear(T2), T3: byYear(T3) },
  };
  const evDropped = eventBase.dropped.map((x) => x.d);
  return { tests, desc, dropped, eventBaseDropped: evDropped,
    events: { CPI: { listed: L.cpi.length, kept: T1.length, from: T1[0]?.R, to: T1.at(-1)?.R }, NFP: { listed: L.nfp.length, kept: T2.length, from: T2[0]?.R, to: T2.at(-1)?.R }, T3: T3.length },
    trades: { T1: T1.map(slim), T2: T2.map(slim), T3: T3.map(slim) } };
}
const slim = (r) => ({ R: r.R, entry: r2(r.entry), stop: r2(r.stop), exit: r2(r.exit), how: r.how, gross: r3(r.gross), net: r3(r.net), nights: r.nights, ...(r.move != null ? { pre: r4(100 * r.move) } : {}) });

function report(res, meta) {
  const T = res.tests, row = (k, name) => { const x = T[k];
    return `| ${k} ${name} | ${x.n} | ${x.months} | ${x.gross >= 0 ? '+' : ''}${x.gross.toFixed(3)} | ${x.net >= 0 ? '+' : ''}${x.net.toFixed(3)} | ${x.t} | ${x.holm} | ${x.net2 >= 0 ? '+' : ''}${x.net2.toFixed(3)} | ${x.first.net >= 0 ? '+' : ''}${x.first.net.toFixed(3)} (n ${x.first.n}) | ${x.second.net >= 0 ? '+' : ''}${x.second.net.toFixed(3)} (n ${x.second.n}) | ${x.placebo.beats} of 40 (p95 ${x.placebo.p95}) | ${x.pass ? 'yes' : 'no'} |`; };
  const passN = ['T1', 'T2', 'T3'].filter((k) => T[k].pass).length;
  const best = ['T1', 'T2', 'T3'].sort((a, b) => T[b].t - T[a].t)[0];
  const verdict = passN ? `**Verdict: PASS: ${passN} of 3 tests meet the pre-registered bar.**` : `**Verdict: FAIL: 0 of 3 tests pass; best ${best} ${T[best].net >= 0 ? '+' : ''}${T[best].net.toFixed(3)}R a trade net (n ${T[best].n}, month t ${T[best].t}, Holm p ${T[best].holm}, ${T[best].placebo.beats} of 40 placebos).**`;
  const D = res.desc;
  return `# Gold in the three days before US CPI and payrolls, and the fade after the print: result

${verdict}

Pre-registered in PREREGISTRATION.md (pushed before any candle was read). Paper research only; a stand-alone event rule, not a gate, exit, entry or size of the live gold book (item 44 untouched: no 2006-17 data is used). Nothing live changed. Not an edge; every figure carries its n and t.

Data: OANDA mid H1 gold through /md/bars (${meta.candles} candles, ${meta.from} to ${meta.to}). Events: CPI ${res.events.CPI.kept} kept of ${res.events.CPI.listed} listed (${res.events.CPI.from} to ${res.events.CPI.to}), NFP ${res.events.NFP.kept} of ${res.events.NFP.listed} (${res.events.NFP.from} to ${res.events.NFP.to}). **Small sample, no untouched out-of-sample**; the last 24 hours of the T1 / T2 window were already read by \`pre-release-drift\`.

## The three tests (net R a trade; t on calendar-month sums, one-sided; Holm over 3)

| Test | n | months | gross R | net R | t | Holm p | 2x costs | first half | second half | placebo beats | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
${row('T1', 'pre-CPI long, 3 days')}
${row('T2', 'pre-NFP long, 3 days')}
${row('T3', 'fade the pre-move, 09:00-16:00')}

Checks (t ≥ 2 and Holm p < 0.05 / both halves > 0 / 2x costs > 0 / 38+ of 40 placebo): ${['T1', 'T2', 'T3'].map((k) => `${k} ${Object.entries(T[k].checks).map(([c, v]) => `${c} ${v ? 'yes' : 'no'}`).join(', ')}`).join('; ')}.

Halves: T1 ${T.T1.first.from}..${T.T1.first.to} | ${T.T1.second.from}..${T.T1.second.to}; T2 ${T.T2.first.from}..${T.T2.first.to} | ${T.T2.second.from}..${T.T2.second.to}; T3 ${T.T3.first.from}..${T.T3.first.to} | ${T.T3.second.from}..${T.T3.second.to}. Stops reached: T1 ${T.T1.stops} of ${T.T1.n}, T2 ${T.T2.stops} of ${T.T2.n}, T3 ${T.T3.stops} of ${T.T3.n}. Median risk a unit: T1 $${T.T1.medianRisk}, T2 $${T.T2.medianRisk}, T3 $${T.T3.medianRisk}.

## Reported, never judged

- Raw three-day drift (E 17:00 New York, three weekdays before, to 08:00 on the day): CPI ${D.drift.CPI.meanPct >= 0 ? '+' : ''}${D.drift.CPI.meanPct} % (n ${D.drift.CPI.n}, t ${D.drift.CPI.t}); NFP ${D.drift.NFP.meanPct >= 0 ? '+' : ''}${D.drift.NFP.meanPct} % (n ${D.drift.NFP.n}, t ${D.drift.NFP.t}).
- T1 by stretch: 2018-21 ${D.cpiSplit['2018-21'].net} R (n ${D.cpiSplit['2018-21'].n}, t ${D.cpiSplit['2018-21'].t}); 2022-26 ${D.cpiSplit['2022-26'].net} R (n ${D.cpiSplit['2022-26'].n}, t ${D.cpiSplit['2022-26'].t}).
- T3 by release: CPI ${D.T3.CPI.net} R (n ${D.T3.CPI.n}, t ${D.T3.CPI.t}); NFP ${D.T3.NFP.net} R (n ${D.T3.NFP.n}, t ${D.T3.NFP.t}). After an up pre-move (sell): ${D.T3.afterUp.net} R (n ${D.T3.afterUp.n}, t ${D.T3.afterUp.t}); after a down one (buy): ${D.T3.afterDown.net} R (n ${D.T3.afterDown.n}, t ${D.T3.afterDown.t}). Correlation of the pre-move with the 09:00-16:00 move: ${D.T3.corrPrePost}.
- By year (net R a trade, n): ${['T1', 'T2', 'T3'].map((k) => `${k} ${Object.entries(D.byYear[k]).map(([y, v]) => `${y} ${v.net} (${v.n})`).join(', ')}`).join('; ')}.

## Placebo

40 seeded draws (mulberry32, seed ${SEED} + draw): each event moved to a random weekday of its own month with no release of the repository's lists on it or in its window, same times, rules and costs. T1 median ${T.T1.placebo.median}, 95th ${T.T1.placebo.p95}; T2 median ${T.T2.placebo.median}, 95th ${T.T2.placebo.p95}; T3 median ${T.T3.placebo.median}, 95th ${T.T3.placebo.p95}.

## Dates dropped

- event-base \`dropped\` (CPI 2018-21 failing its spike check, never events here): ${res.eventBaseDropped.join(', ')}.
- By this study: ${res.dropped.map((x) => `${x.type} ${x.d} (${x.why})`).join('; ') || 'none'}.

## Post hoc (written after the results; descriptive, not a test)

- T2 is the near miss: +${T.T2.net.toFixed(3)}R a trade, month t ${T.T2.t}, but Holm p ${T.T2.holm} and ${T.T2.placebo.beats} of 40 placebo draws (the same three-day hold on ordinary days of the same months has median +${T.T2.placebo.median}R, 95th percentile +${T.T2.placebo.p95}R): part of it is gold's rise over 2022-26, and what is left over the placebo is not told apart from chance on 47 trades. ${D.byYear.T2['2026'] ? `2026 alone gives +${D.byYear.T2['2026'].net}R a trade (n ${D.byYear.T2['2026'].n}).` : ''} A further look needs other data (payrolls before 2022, or another market) and its own pre-registration; nothing here is an edge.
- The stop (2 x ATR20 x √hours, about 16 hourly ATRs over three days) was never reached on T1 / T2, so their R is the three-day move divided by a wide stop: small figures per trade by construction.
- T3: the pre-move and the move after the print are positively correlated (${D.T3.corrPrePost}), the opposite of an unwind; fading it lost a little.

## Notes

- Costs: $0.30 spread + $0.15 slippage on each of two market orders ($0.60 a round trip); gold longs pay financing \`nights\` x \`FIN.xau.long\` (${FIN.xau.long}, ${FIN.xau.asOf}) x entry, today's rate every year. Stop 2 x ATR20(H1) x √(hours held), never moved.
- Payroll dates before 2022 are not in the repository, so T2 is 2022 on only and 2018-21 placebo days avoid the first and second Friday of each month.
- To repeat: \`node --use-env-proxy research/edge/gold-pre-cpi/fetch.mjs <dir>\`, then \`node research/edge/gold-pre-cpi/run.mjs <dir>\`.
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const bars = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).filter((b) => b[0] >= Date.UTC(2017, 11, 1) / 1000);
  const eb = JSON.parse(fs.readFileSync(path.join(ROOT, 'council/event-base.json'), 'utf8'));
  const res = study(bars, eb);
  const meta = { candles: bars.length, from: new Date(bars[0][0] * 1000).toISOString().slice(0, 10), to: new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10) };
  const md = report(res, meta);
  const head = md.split('\n').find((l) => l.startsWith('**Verdict'));
  const out = { study: 'gold-pre-cpi', title: 'Gold in the three days before US CPI and payrolls, and the fade after the print', built: '2026-11-14',
    verdict: res.tests.T1.pass || res.tests.T2.pass || res.tests.T3.pass ? 'PASS' : 'FAIL', headline: head.replace(/\*\*/g, ''), system: 'stand-alone event rule, spot gold (not the live book)',
    data: { ...meta, src: 'OANDA mid H1 via /md/bars' }, cost: { roundTrip: COST, fin: FIN.xau.long, finAsOf: FIN.xau.asOf }, ...res };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(head);
  for (const k of ['T1', 'T2', 'T3']) { const x = res.tests[k]; console.log(k, x.n, 'gross', x.gross, 'net', x.net, 't', x.t, 'holm', x.holm, 'halves', x.first.net, x.second.net, 'x2', x.net2, 'plac', x.placebo.beats, x.placebo.p95); }
}
