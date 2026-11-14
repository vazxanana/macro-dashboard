// Edge research · gold-pre-nfp-replicate: gold-pre-cpi's T2 (long gold from 17:00 New York three weekdays before payrolls to
// 08:00 New York on release day) replicated on payroll dates 2006-2021. Pre-registration: PREREGISTRATION.md (pushed first).
// Paper research only; a stand-alone event study, not a gate, exit, entry or size of the live gold book. Nothing live reads this.
//   node --use-env-proxy research/edge/gold-pre-nfp-replicate/fetch.mjs <dir>    (candles, cache outside git)
//   node research/edge/gold-pre-nfp-replicate/run.mjs <dir>                       (writes result.json and RESULT.md here)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';
import { FIN, nights } from '../../../council/fills.mjs';
import { payrolls, councilNfp, FOMC_OLD, FOMC_UNSCHEDULED, CPI_MEMORY, CPI_EARLY, ymd } from './dates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NY = 'America/New_York', H = 3600;

// ── copied unchanged from research/edge/gold-pre-cpi/run.mjs (branch gold-pre-cpi) ──
export const COST = 0.30 + 2 * 0.15;            // $0.30 spread + half a spread of slippage on each of two market orders
export const STOP_K = 2, ATR_N = 20, SEED = 20261114, DRAWS = 40;
const pad = (n) => String(n).padStart(2, '0');
const dayMs = (s) => Date.parse(s + 'T00:00:00Z');
export const isWeekday = (s) => { const w = new Date(dayMs(s)).getUTCDay(); return w >= 1 && w <= 5; };
export function weekdaysBefore(s, k) { let ms = dayMs(s), n = 0; while (n < k) { ms -= 86400e3; if (isWeekday(ymd(ms))) n++; } return ymd(ms); }
export function timesOf(R) {
  return { E: zonedToUtc(weekdaysBefore(R, 3), '17:00', NY), X: zonedToUtc(R, '08:00', NY), F: zonedToUtc(R, '09:00', NY), C: zonedToUtc(R, '16:00', NY) };
}
export const blocked = (others, tm, ownT) => others.some((o) => o.t !== ownT && o.t > tm.E && o.t <= tm.C);
export function indexOf(bars) { const m = new Map(); bars.forEach((b, i) => m.set(b[0], i)); return m; }
export function endingAt(idx, bars, t, back = 0) {
  for (let s = 0; s <= back; s += H) { const i = idx.get(t - H - s); if (i != null) return i; }
  return -1;
}
export function atr(bars, i, n = ATR_N) {
  if (i < n) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const [, , h, l] = bars[k], pc = bars[k - 1][4]; s += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); }
  return s / n;
}
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
// the T2 part of gold-pre-cpi's runDay: long from E to X
export function runPre(bars, idx, R) {
  const tm = timesOf(R), iE = endingAt(idx, bars, tm.E, 3 * H), iX = endingAt(idx, bars, tm.X);
  if (iE < 0 || iX < 0 || iX <= iE) return { R, skip: 'no candles' };
  const holdH = (tm.X - (bars[iE][0] + H)) / H;
  return { R, pre: trade(bars, iE, iX, 1, holdH), move: bars[iX][4] / bars[iE][4] - 1 };
}
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
export function pOne(t, df) { if (!(df > 0)) return 1; const x = df / (df + t * t), tail = 0.5 * ibeta(x, df / 2, 0.5); return t > 0 ? tail : 1 - tail; }
export function monthSums(rows, key = 'net') { const m = new Map(); for (const r of rows) { const k = r.R.slice(0, 7); m.set(k, (m.get(k) || 0) + r[key]); } return [...m.values()]; }
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 1e4) / 1e4;
// ── end of the copied part ──

// ── release-minute check (pre-registered): M5 candle opening 08:30 New York on d vs the median of the same candle on the
//    other weekdays of [R − 9 days, R + 8 days], R = the date the window was fetched around ──
export const SPIKE = 2;
export function spikeRatio(m5, R, d) {
  if (!m5 || !m5.length) return null;
  const at = new Map(m5.map((b) => [b[0], b]));
  const rng = (day) => { const b = at.get(zonedToUtc(day, '08:30', NY)); return b ? b[2] - b[3] : null; };
  const own = rng(d); if (own == null) return null;
  const base = [];
  for (let k = -9; k <= 8; k++) { const day = ymd(dayMs(R) + k * 86400e3); if (day === d || !isWeekday(day)) continue; const x = rng(day); if (x != null) base.push(x); }
  if (base.length < 5) return null;
  base.sort((a, b) => a - b);
  const med = base.length % 2 ? base[(base.length - 1) / 2] : (base[base.length / 2 - 1] + base[base.length / 2]) / 2;
  return med > 0 ? own / med : null;
}
// decide each payroll date: { d, status: verified | moved | unverified | exception-verified | exception-unverified, ratio }
export function checkDates(list, m5by) {
  return list.map((p) => {
    if (p.why !== 'rule') { const r = spikeRatio(m5by[p.d], p.d, p.d); return { ...p, ratio: r == null ? null : r2(r), status: r != null && r >= SPIKE ? 'exception-verified' : 'exception-unverified' }; }
    const w = m5by[p.derived], r = spikeRatio(w, p.derived, p.derived);
    if (r != null && r >= SPIKE) return { ...p, ratio: r2(r), status: 'verified' };
    const alts = [-7, 7].map((k) => { const d = ymd(dayMs(p.derived) + k * 86400e3); return { d, r: spikeRatio(w, p.derived, d) }; })
      .filter((a) => a.r != null && a.r >= SPIKE && (r == null || a.r > r));
    if (r != null && alts.length === 1) return { ...p, d: alts[0].d, ratio: r2(alts[0].r), ratioDerived: r2(r), status: 'moved' };
    return { ...p, ratio: r == null ? null : r2(r), status: 'unverified' };
  });
}

// other releases (exclusion only), each { type, d, t }
export function otherList(nfpDates) {
  const o = [], add = (type, d, time) => o.push({ type, d, t: zonedToUtc(d, time, NY) });
  for (const d of nfpDates) add('NFP', d, '08:30');
  for (const d of FOMC_OLD) add('FOMC', d, '14:00');
  for (const [d, time] of FOMC_UNSCHEDULED) add('FOMC*', d, time);
  for (const d of [...CPI_MEMORY, ...CPI_EARLY]) add('CPI', d, '08:30');
  for (const e of [...HISTORY, ...EVENTS]) if (['CPI', 'FOMC'].includes(e.type)) o.push({ type: e.type, d: e.local.slice(0, 10), t: e.t });
  return o.sort((a, b) => a.t - b.t);
}

function summary(rows) {
  const net = rows.map((r) => r.net), ms = monthSums(rows), t = tOf(ms);
  const half = Math.floor(rows.length / 2), h1 = rows.slice(0, half), h2 = rows.slice(half);
  return { n: rows.length, months: ms.length, net: r3(mean(net)), gross: r3(mean(rows.map((r) => r.gross))), net2: r3(mean(rows.map((r) => r.net2))),
    t: r2(t), p: r3(pOne(t, ms.length - 1)), tGross: r2(tOf(monthSums(rows, 'gross'))), total: r2(net.reduce((s, x) => s + x, 0)),
    first: { n: h1.length, from: h1[0]?.R, to: h1.at(-1)?.R, net: r3(mean(h1.map((r) => r.net))), t: r2(tOf(monthSums(h1))) },
    second: { n: h2.length, from: h2[0]?.R, to: h2.at(-1)?.R, net: r3(mean(h2.map((r) => r.net))), t: r2(tOf(monthSums(h2))) },
    stops: rows.filter((r) => r.how !== 'time').length, medianRisk: r2([...rows.map((r) => r.dist)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] || 0) };
}
const sub = (rows) => (rows.length ? { n: rows.length, net: r3(mean(rows.map((r) => r.net))), gross: r3(mean(rows.map((r) => r.gross))), t: r2(tOf(monthSums(rows))) } : { n: 0 });
function byYear(rows) { const m = {}; for (const r of rows) (m[r.R.slice(0, 4)] = m[r.R.slice(0, 4)] || []).push(r);
  return Object.fromEntries(Object.entries(m).map(([y, a]) => [y, { n: a.length, net: r3(mean(a.map((r) => r.net))) }])); }

// run the rule over one list of release dates: kept trades and the dropped list
export function runEvents(bars, idx, dates, others, last) {
  const kept = [], dropped = [];
  for (const R of dates) {
    const tm = timesOf(R);
    if (tm.C > last) continue;
    const ownT = zonedToUtc(R, '08:30', NY);
    if (blocked(others, tm, ownT)) { const o = others.filter((x) => x.t !== ownT && x.t > tm.E && x.t <= tm.C).map((x) => `${x.type} ${x.d}`); dropped.push({ d: R, why: `another release in the window: ${[...new Set(o)].join(', ')}`, types: [...new Set(others.filter((x) => x.t !== ownT && x.t > tm.E && x.t <= tm.C).map((x) => x.type))] }); continue; }
    const day = runPre(bars, idx, R);
    if (day.skip || !day.pre) { dropped.push({ d: R, why: 'missing candles' }); continue; }
    kept.push({ R, move: day.move, ...day.pre });
  }
  return { kept, dropped };
}

export function placebo(bars, idx, kept, others, last) {
  const otherDays = new Set(others.map((x) => x.d)), months = new Map(), cache = new Map();
  const cand = (ym) => { if (months.has(ym)) return months.get(ym); const out = [];
    for (let dd = 1; dd <= 31; dd++) { const d = `${ym}-${pad(dd)}`; if (Number.isNaN(dayMs(d)) || ymd(dayMs(d)) !== d || !isWeekday(d) || otherDays.has(d)) continue;
      const tm = timesOf(d); if (tm.C > last || others.some((o) => o.t > tm.E && o.t <= tm.C)) continue; out.push(d); }
    months.set(ym, out); return out; };
  const run = (d) => { if (!cache.has(d)) cache.set(d, runPre(bars, idx, d)); return cache.get(d); };
  const means = [];
  for (let k = 0; k < DRAWS; k++) {
    const rnd = mulberry32(SEED + k), acc = [];
    for (const e of kept) { const c = cand(e.R.slice(0, 7)); if (!c.length) continue; const p = run(c[Math.floor(rnd() * c.length)]); if (p.skip || !p.pre) continue; acc.push(p.pre.net); }
    means.push(mean(acc));
  }
  return means;
}

export function study(bars, m5by) {
  const idx = indexOf(bars), last = bars.at(-1)[0] + H;
  const checked = checkDates(payrolls(), m5by);
  const rep = checked.map((x) => x.d), recent = councilNfp().filter((d) => zonedToUtc(d, '08:30', NY) < last);
  const others = otherList([...rep, ...recent]);
  const A = runEvents(bars, idx, rep, others, last);
  const B = runEvents(bars, idx, recent, others, last);                  // 2022-26: the harness gate against gold-pre-cpi T2
  const main = summary(A.kept), gateRows = summary(B.kept);
  const gate = { n: gateRows.n, net: gateRows.net, t: gateRows.t, want: { n: 47, net: 0.088 }, ok: gateRows.n === 47 && Math.abs(gateRows.net - 0.088) <= 0.002 };
  const pl = placebo(bars, idx, A.kept, others, last), s = [...pl].sort((a, b) => a - b);
  main.placebo = { median: r3((s[19] + s[20]) / 2), p95: r3(s[37]), beats: pl.filter((x) => main.net > x).length, means: pl.map(r3) };
  main.checks = { tOne: main.net > 0 && main.t >= 2, costs2: main.net2 > 0, placebo: main.placebo.beats >= 38, halves: main.first.net > 0 && main.second.net > 0 };
  main.pass = gate.ok && Object.values(main.checks).every(Boolean);
  const status = (st) => checked.filter((x) => x.status === st).length;
  const verifiedSet = new Set(checked.filter((x) => ['verified', 'moved', 'exception-verified'].includes(x.status)).map((x) => x.d));
  const cpiBlocks = [...A.dropped, ...B.dropped].filter((x) => x.types?.includes('CPI')).map((x) => x.d);
  const pooled = [...A.kept, ...B.kept];
  // post hoc (written after the results): the rule's own dates, with no move by the release-minute check
  const ruleDates = checked.map((x) => (x.why === 'rule' ? x.derived : x.d));
  const R0 = runEvents(bars, idx, ruleDates, otherList([...ruleDates, ...recent]), last);
  const info = {
    pooled: { ...summary(pooled), note: '2006-2026: replication + the 2022-26 recomputation (information only)' },
    verifiedOnly: sub(A.kept.filter((r) => verifiedSet.has(r.R))),
    y2006_16: sub(A.kept.filter((r) => r.R < '2017')), y2017_21: sub(A.kept.filter((r) => r.R >= '2017')),
    drift: { n: A.kept.length, meanPct: r4(mean(A.kept.map((r) => 100 * r.move))), t: r2(tOf(A.kept.map((r) => 100 * r.move))) },
    byYear: byYear(A.kept), cpiBlocks, ruleDatesOnly: { ...sub(R0.kept), net2: r3(mean(R0.kept.map((r) => r.net2))) },
  };
  const slim = (r) => ({ R: r.R, entry: r2(r.entry), stop: r2(r.stop), exit: r2(r.exit), how: r.how, gross: r3(r.gross), net: r3(r.net), nights: r.nights });
  return { test: main, gate, info,
    dates: { n: checked.length, verified: status('verified'), moved: status('moved'), unverified: status('unverified'), exceptionVerified: status('exception-verified'), exceptionUnverified: status('exception-unverified'),
      list: checked.map((x) => ({ report: x.report, derived: x.derived, d: x.d, status: x.status, ratio: x.ratio, ...(x.ratioDerived != null ? { ratioDerived: x.ratioDerived } : {}) })) },
    ruleCheck: ruleCheck(), dropped: A.dropped.map(({ d, why }) => ({ d, why })), droppedRecent: B.dropped.map(({ d, why }) => ({ d, why })),
    trades: A.kept.map(slim) };
}

// the date rule against the repository's payroll dates (2022-26)
import { derive } from './dates.mjs';
export function ruleCheck() {
  const act = councilNfp(), der = new Set();
  for (let y = 2021; y <= 2026; y++) for (let m = 0; m < 12; m++) der.add(derive(y, m));
  return { listed: act.length, match: act.filter((d) => der.has(d)).length, miss: act.filter((d) => !der.has(d)) };
}

const sg = (x, d = 3) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`;
function report(res, meta) {
  const T = res.test, D = res.dates, I = res.info, G = res.gate;
  const fails = Object.entries(T.checks).filter(([, v]) => !v).map(([k]) => ({ tOne: `month t ${T.t} under 2`, costs2: '2x costs not positive', placebo: `${T.placebo.beats} of 40 placebos`, halves: 'a half not positive' }[k]));
  const verdict = !G.ok ? `**Verdict: NO VERDICT: the harness did not reproduce gold-pre-cpi's T2 on 2022-26 (n ${G.n}, ${sg(G.net)}R against 47, +0.088R).**`
    : T.pass ? `**Verdict: PASS: the pre-payrolls gold long replicates on 2006-21, ${sg(T.net)}R a trade net (n ${T.n}, month t ${T.t}, ${T.placebo.beats} of 40 placebos).**`
      : `**Verdict: FAIL: no replication on 2006-21, ${sg(T.net)}R a trade net (n ${T.n}, month t ${T.t}, ${T.placebo.beats} of 40 placebos); ${fails.join(', ')}.**`;
  return { verdict, md: `# Gold in the three days before US payrolls, replicated on 2006-2021: result

${verdict}

Pre-registered in PREREGISTRATION.md (pushed before any 2006-21 candle was read). Paper research only; a stand-alone event study on spot gold, not a gate, exit, entry or size of the live gold book (item 44: no book record or position is read). Nothing live changed. Not an edge; every figure carries its n and t.

The rule is \`gold-pre-cpi\`'s T2 unchanged: long gold at 17:00 New York on the third weekday before the payrolls release, out at 08:00 New York on release day, stop 2 x ATR20(H1) x √hours, $0.60 a round trip plus financing on every night held. Data: OANDA mid H1 gold through /md/bars (${meta.candles} candles, ${meta.from} to ${meta.to}).

## The test (replication window ${T.first.from} to ${T.second.to}; one test, no Holm)

| | n | months | gross R | net R | month t (one-sided p) | 2x costs | first half | second half | placebo beats | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| Pre-payrolls long, 2006-21 | ${T.n} | ${T.months} | ${sg(T.gross)} | ${sg(T.net)} | ${T.t} (${T.p}) | ${sg(T.net2)} | ${sg(T.first.net)} (n ${T.first.n}, t ${T.first.t}) | ${sg(T.second.net)} (n ${T.second.n}, t ${T.second.t}) | ${T.placebo.beats} of 40 (median ${T.placebo.median}, p95 ${T.placebo.p95}) | ${T.pass ? 'yes' : 'no'} |

Checks: net > 0 and month t ≥ 2 ${T.checks.tOne ? 'yes' : 'no'}; 2x costs > 0 ${T.checks.costs2 ? 'yes' : 'no'}; 38+ of 40 placebos ${T.checks.placebo ? 'yes' : 'no'}; both halves > 0 ${T.checks.halves ? 'yes' : 'no'}. Gross month t ${T.tGross}. Halves: ${T.first.from}..${T.first.to} | ${T.second.from}..${T.second.to}. Stops reached: ${T.stops} of ${T.n}. Median risk a unit $${T.medianRisk}.

**Harness gate** (the same code on 2022-26 against gold-pre-cpi's T2, n 47, +0.088R): n ${G.n}, ${sg(G.net)}R, month t ${G.t}: ${G.ok ? 'reproduced' : 'NOT reproduced'}.

## Reported, never judged

- **Pooled 2006-2026** (information only): ${sg(I.pooled.net)}R a trade net (n ${I.pooled.n}, month t ${I.pooled.t}, gross ${sg(I.pooled.gross)}, 2x costs ${sg(I.pooled.net2)}).
- On release-minute-verified dates only: ${I.verifiedOnly.n ? `${sg(I.verifiedOnly.net)}R (n ${I.verifiedOnly.n}, t ${I.verifiedOnly.t})` : 'none'}.
- 2006-2016: ${sg(I.y2006_16.net)}R (n ${I.y2006_16.n}, t ${I.y2006_16.t}); 2017-2021: ${sg(I.y2017_21.net)}R (n ${I.y2017_21.n}, t ${I.y2017_21.t}).
- Raw drift E → X: ${sg(I.drift.meanPct, 4)} % a window (n ${I.drift.n}, t ${I.drift.t}); gold-pre-cpi measured +0.6152 % (n 47, t 2.89) on 2022-26.
- By year (net R a trade, n): ${Object.entries(I.byYear).map(([y, v]) => `${y} ${v.net} (${v.n})`).join(', ')}.

## Payroll dates

BLS pages are refused by the sandbox's proxy, so the dates are derived by the BLS rule (\`dates.mjs\`): the third Friday after the week holding the 12th, a Friday on or before 3 January one week later, a holiday Friday to the Thursday before; the October 2013 shutdown dates by hand (22 Oct, 8 Nov 2013, from memory). **The rule gives ${res.ruleCheck.match} of the ${res.ruleCheck.listed} payroll dates of \`council/events.mjs\` (2022-26)**; the misses are the 2025-26 shutdown changes: ${res.ruleCheck.miss.join(', ')}.

Release-minute check on OANDA M5 (08:30 New York candle range ≥ 2x the median of the same candle on the weekdays around it): of ${D.n} dates April 2006 to December 2021, **${D.verified} verified**, ${D.moved} moved to the adjacent Friday by the check, ${D.exceptionVerified + D.exceptionUnverified} hand-written exceptions (${D.exceptionVerified} verified), **${D.unverified} unverified** (no M5 candles: April and May 2006; or a ratio under 2 and no adjacent Friday passing): ${D.list.filter((x) => x.status === 'unverified' || x.status === 'exception-unverified').map((x) => `${x.d} (${x.ratio ?? 'no M5'})`).join(', ') || 'none'}.${D.moved ? ` Moved: ${D.list.filter((x) => x.status === 'moved').map((x) => `${x.derived} → ${x.d} (${x.ratioDerived} → ${x.ratio})`).join(', ')}.` : ''}

Exclusions: FOMC 2008-21 (fomc-even-week's list) and 2006-07 (from memory, unverified), unscheduled FOMC statements, CPI 2012-17 (cpi-follow's list from memory, unverified) and 2018-21 (BLS schedule list), CPI and FOMC 2022 on from \`council/events.mjs\`. **No CPI list exists for 2006-11.** In 2012-2026 CPI blocked ${I.cpiBlocks.length} payroll window(s)${I.cpiBlocks.length ? ` (${I.cpiBlocks.join(', ')})` : ''}, so the missing list should matter little.

Dropped 2006-21: ${res.dropped.map((x) => `${x.d} (${x.why})`).join('; ') || 'none'}.

## Post hoc (written after the results; descriptive, not a test)

- The check moved ${D.moved} dates to an adjacent Friday, each on a ratio near the bar of 2 (${D.list.filter((x) => x.status === 'moved').map((x) => `${x.derived} ${x.ratioDerived} → ${x.d} ${x.ratio}`).join(', ')}). From memory of the BLS schedule, at least the 2006, 2007 and 2008 moves look wrong (the release was on the derived date): gold's 08:30 candle in 2006-11 is often not much wider than on other days, so a ratio of about 2 cannot tell two Fridays apart. With the rule's own dates and no move: ${sg(I.ruleDatesOnly.net)}R a trade net (n ${I.ruleDatesOnly.n}, month t ${I.ruleDatesOnly.t}, 2x costs ${sg(I.ruleDatesOnly.net2)}). The verdict does not depend on these ${D.moved} dates.
- The 2022-26 effect (+0.088R, raw drift +0.62 % a window) does not show in 2006-21: gross ${sg(T.gross)}R a trade, raw drift ${sg(I.drift.meanPct, 4)} %. The near miss of gold-pre-cpi was most likely its post hoc pick of the best of three tests in a strong gold market; the pooled 2006-26 figure is ${sg(I.pooled.net)}R (t ${I.pooled.t}).

## Placebo

40 seeded draws (mulberry32, seed ${SEED} + draw): each event moved to a random weekday of its own month with no release of the lists on it or in its window, same times, rules and costs. Median ${T.placebo.median}, 95th percentile ${T.placebo.p95}; the rule's mean beats ${T.placebo.beats} of 40.

## Notes

- Costs: $0.30 spread + $0.15 slippage on each of two market orders ($0.60); financing \`nights\` x \`FIN.xau.long\` (${FIN.xau.long}, ${FIN.xau.asOf}) x entry on every night, today's rate in every year (gold was cheaper to hold in the zero-rate years; the gross column shows the trade without it).
- To repeat: \`node --use-env-proxy research/edge/gold-pre-nfp-replicate/fetch.mjs <dir>\`, then \`node research/edge/gold-pre-nfp-replicate/run.mjs <dir>\`.
` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const bars = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
  const m5 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-m5-nfp.json'), 'utf8'));
  const res = study(bars, m5);
  const meta = { candles: bars.length, from: new Date(bars[0][0] * 1000).toISOString().slice(0, 10), to: new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10) };
  const { verdict, md } = report(res, meta);
  const out = { study: 'gold-pre-nfp-replicate', title: 'Gold in the three days before US payrolls, replicated on 2006-2021', built: '2026-11-14',
    verdict: !res.gate.ok ? 'INCONCLUSIVE' : res.test.pass ? 'PASS' : 'FAIL', headline: verdict.replace(/\*\*/g, ''), system: 'stand-alone event rule, spot gold (not the live book)',
    data: { ...meta, src: 'OANDA mid H1 via /md/bars' }, cost: { roundTrip: COST, fin: FIN.xau.long, finAsOf: FIN.xau.asOf }, ...res };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(verdict);
  console.log(JSON.stringify({ test: { ...res.test, placebo: { ...res.test.placebo, means: undefined } }, gate: res.gate, dates: { ...res.dates, list: undefined }, pooled: res.info.pooled.net, pooledT: res.info.pooled.t }));
}
