// Edge research · metals-intraday-momentum: the "market intraday momentum" claim (Gao, Han, Li and Zhou 2018) on gold, silver
// and WTI crude: does the first half hour of the US floor session predict the sign of its last half hour? A trading rule on
// OANDA mid M5 candles, net of costs. Sessions, calendar, rule, stop, costs, windows, placebo and pass bar:
// PREREGISTRATION.md (committed and pushed first). The index study's code (branch intraday-momentum) was copied, not imported.
//   node --use-env-proxy research/edge/metals-intraday-momentum/fetch.mjs <dir>   (OANDA M5 candles, kept out of git)
//   node research/edge/metals-intraday-momentum/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Stand-alone study: not a gate, exit, entry or size on the live gold book, and it reads no gold-book positions (owner
// decision 44). Pure pieces are exported for tests/metals-intraday-momentum.test.mjs. Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { cmeShut } from '../../../ict/calendar.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300;
// Round-trip costs in price units (PREREGISTRATION.md "Costs"):
//   xau  $0.30 an ounce: the repository's standing gold round trip (gold-systems-oos, supported-book, the 11 Nov edge review);
//   xag  $0.03 an ounce: the silver round trip of the ICT lab (api/_ictlab.js COST.xag, from research/edge/ict-universe);
//   wtico $0.04 a barrel: ASSUMED (no crude cost or broker crude spread is on file): ~$0.03 retail CFD spread + $0.01 slippage.
export const COST = Object.freeze({ xau: 0.30, xag: 0.03, wtico: 0.04 });
export const P = Object.freeze({
  K: 1.5, AVG: 20, LOOK: 600, SEEDS: 40, Q: 0.95, ALPHA: 0.05, MIN_N: 300, HALF: 30,
  COST, FROM: '2006-11-01', TO: '2026-11-13',
  WIN: Object.freeze({ A: ['2007-01-01', '2016-01-01'], B: ['2016-01-01', '2026-11-14'] }),
});
export const MARKETS = ['xau', 'xag', 'wtico'];
export const TESTS = Object.freeze({ xau: 'T1', xag: 'T2', wtico: 'T3' });
const NAME = { xau: 'Gold', xag: 'Silver', wtico: 'WTI crude' };
// the US floor session of each market, New York clock
export const SESSION = Object.freeze({
  xau: Object.freeze({ open: '08:20', close: '13:30' }),
  xag: Object.freeze({ open: '08:20', close: '13:30' }),
  wtico: Object.freeze({ open: '09:00', close: '14:30' }),
});

// ── New York clock (council/histdata.mjs nyOffsetH; every time used is after 02:00, so a switch day converts right) ──
const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const wdOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export function nyT(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number), [H, M] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, H, M) / 1000;
  return wall + nyOffsetH(wall + 5 * 3600) * 3600;
}
const plusMin = (hhmm, k) => { const [H, M] = hhmm.split(':').map(Number), x = H * 60 + M + k; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

// ── calendar: weekdays on which the CME is open at every M5 candle start of the session ──
export function eligibleDays(sym, from = P.FROM, to = P.TO) {
  const s = SESSION[sym], out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = wdOf(d); if (w === 0 || w === 6) continue;
    const a = nyT(d, s.open), b = nyT(d, s.close);
    let ok = true; for (let t = a; t < b; t += M5) if (cmeShut(t)) { ok = false; break; }
    if (ok) out.push(d);
  }
  return out;
}

// ── candles ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
// index of the last candle whose END (t + 5 min) is at or before `end` and within LOOK of it; -1 if none
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
const pxAt = (b, end) => { const i = lastEnding(b, end); return i < 0 ? null : b.c[i]; };

// the day's four prices; nothing read ends after the session close
export function dayPrices(b, sym, date) {
  const s = SESSION[sym];
  const tO = nyT(date, s.open), tS = nyT(date, plusMin(s.open, P.HALF)), tE = nyT(date, plusMin(s.close, -P.HALF)), tC = nyT(date, s.close);
  return { tO, tS, tE, tC, pO: pxAt(b, tO), pS: pxAt(b, tS), pE: pxAt(b, tE), pX: pxAt(b, tC) };
}
// the signal: only the open and open + 30 min
export const signalOf = (pO, pS) => pS / pO - 1;

// one trade from close - 30 to the close with a stop; candles that START in [tE, tC)
export function trade(b, { tE, tC, pE, pX }, side, A, cost) {
  const dist = P.K * A, stop = pE - side * dist;
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < tE) lo = m + 1; else hi = m; }
  let exit = pX, how = 'time';
  for (let i = lo; i < b.n && b.t[i] < tC; i++) {
    if (side > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; how = 'gap'; break; }
    if (side > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  const R = side * (exit - pE) / dist, c = cost / dist;
  return { side, entry: pE, stop, dist, exit, how, R, c, net: R - c };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, sd: null, t: null };
  const m = xs.reduce((s, x) => s + x, 0) / n, v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1), sd = Math.sqrt(v);
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
// t on calendar-month sums: rows [{ date, x }]
export function monthT(rows) {
  const m = new Map(); for (const r of rows) { const k = r.date.slice(0, 7); m.set(k, (m.get(k) || 0) + r.x); }
  const s = tstat([...m.values()]); return { months: s.n, mean: s.mean, t: s.t };
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
// placebo: on the traded days (in order), seed s gives each day a random sign; the trade of that sign is taken (rows carry
// the signal side `tr` and the opposite side `alt`, same stop distance and cost). Also the sign hit rate against the placebo's.
export function placebo(rows) {
  const tr = rows.filter((r) => r.tr), n = tr.length;
  const rule = n ? tr.reduce((s, r) => s + r.tr.net, 0) / n : null;
  const use = tr.filter((r) => r.r2 !== 0), hit = use.length ? use.filter((r) => Math.sign(r.r1) === Math.sign(r.r2)).length / use.length : null;
  const nets = [], hits = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const rnd = mulberry32(s); let sum = 0, h = 0, k = 0;
    for (const r of tr) { const side = rnd() < 0.5 ? -1 : 1, x = side === r.tr.side ? r.tr : r.alt; sum += x.net; if (r.r2 !== 0) { k++; if (side === Math.sign(r.r2)) h++; } }
    nets.push(n ? sum / n : null); hits.push(k ? h / k : null);
  }
  const q = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(P.Q * s.length) - 1)]; };
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return { n, rule, netMean: mean(nets), netQ95: q(nets), netMax: Math.max(...nets), beats: nets.filter((x) => rule > x).length,
    hit, hitN: use.length, hitMean: mean(hits), hitQ95: q(hits), hitBeats: hits.filter((x) => hit > x).length };
}
// OLS y = a + b x with OLS and White (HC0) t of the slope
export function ols(xs, ys) {
  const n = xs.length; if (n < 3) return { n, slope: null };
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxy / sxx, a = my - b * mx;
  let sse = 0, sst = 0, hc = 0;
  for (let i = 0; i < n; i++) { const e = ys[i] - a - b * xs[i]; sse += e * e; sst += (ys[i] - my) ** 2; hc += (xs[i] - mx) ** 2 * e * e; }
  const seO = Math.sqrt(sse / (n - 2) / sxx), seW = Math.sqrt(hc) / sxx;
  return { n, intercept: a, slope: b, tOls: b / seO, tWhite: b / seW, r2: 1 - sse / sst };
}

// ── one market: every eligible day, its trade where there is one ──
export function runMarket(b, sym, days = eligibleDays(sym)) {
  const recs = [], skipped = { noPrice: 0, flat: 0, warmup: 0 }, hist = [];
  for (const date of days) {
    const px = dayPrices(b, sym, date);
    if ([px.pO, px.pS, px.pE, px.pX].some((v) => v == null)) { skipped.noPrice++; continue; }
    const r1 = signalOf(px.pO, px.pS), r2 = px.pX / px.pE - 1, move = Math.abs(px.pX - px.pE);
    const rec = { date, r1, r2 };
    if (hist.length < P.AVG) skipped.warmup++;
    else if (r1 === 0) skipped.flat++;
    else {
      const A = hist.slice(-P.AVG).reduce((s, x) => s + x, 0) / P.AVG;
      if (A > 0) { const side = Math.sign(r1); rec.tr = trade(b, px, side, A, P.COST[sym]); rec.alt = trade(b, px, -side, A, P.COST[sym]); }
    }
    recs.push(rec); hist.push(move);
  }
  return { recs, skipped };
}
const r4 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4;
export function summarize(recs, [a, b]) {
  const w = recs.filter((r) => r.date >= a && r.date < b), tr = w.filter((r) => r.tr);
  const net = tstat(tr.map((r) => r.tr.net)), gross = tstat(tr.map((r) => r.tr.R));
  const net2 = tstat(tr.map((r) => r.tr.R - 2 * r.tr.c));
  const mt = monthT(tr.map((r) => ({ date: r.date, x: r.tr.net }))), mt2 = monthT(tr.map((r) => ({ date: r.date, x: r.tr.R - 2 * r.tr.c })));
  const pl = placebo(w);
  const reg = ols(w.map((r) => r.r1 * 100), w.map((r) => r.r2 * 100));
  return {
    from: w[0]?.date ?? null, to: w.at(-1)?.date ?? null,
    days: w.length, n: net.n, net: r4(net.mean), tTrade: r4(net.t), months: mt.months, tMonth: r4(mt.t),
    gross: r4(gross.mean), tGross: r4(gross.t), costR: r4(tr.reduce((s, r) => s + r.tr.c, 0) / (tr.length || 1)),
    net2x: r4(net2.mean), tMonth2x: r4(mt2.t),
    totalNet: r4(tr.reduce((s, r) => s + r.tr.net, 0)), win: r4(tr.filter((r) => r.tr.net > 0).length / (tr.length || 1)),
    stops: tr.filter((r) => r.tr.how !== 'time').length, longs: tr.filter((r) => r.tr.side > 0).length,
    placebo: { netMean: r4(pl.netMean), netQ95: r4(pl.netQ95), netMax: r4(pl.netMax), beats: pl.beats,
      hit: r4(pl.hit), hitN: pl.hitN, hitMean: r4(pl.hitMean), hitQ95: r4(pl.hitQ95), hitBeats: pl.hitBeats },
    reg: { n: reg.n, slope: r4(reg.slope), tOls: r4(reg.tOls), tWhite: r4(reg.tWhite), r2: r4(reg.r2) },
  };
}
export function byYear(recs) {
  const y = {};
  for (const r of recs) if (r.tr) { const k = r.date.slice(0, 4); (y[k] ||= []).push(r.tr.net); }
  return Object.fromEntries(Object.entries(y).map(([k, xs]) => { const s = tstat(xs); return [k, { n: s.n, net: r4(s.mean), total: r4(xs.reduce((a, x) => a + x, 0)) }]; }));
}

export function build(markets) {
  const out = { study: 'metals-intraday-momentum', built: '2026-11-14', preregistration: 'research/edge/metals-intraday-momentum/PREREGISTRATION.md',
    paper: 'Gao, Han, Li and Zhou (2018), Journal of Financial Economics, "Market intraday momentum" (S&P 500); here on gold, silver and WTI crude',
    rule: 'signal = the first 30 minutes of the US floor session (gold / silver 08:20-08:50, crude 09:00-09:30 New York); at 30 minutes before the close (13:00 / 14:00) long if > 0, short if < 0; exit at the close (13:30 / 14:30); stop 1.5 x the 20-day mean |last half-hour move|',
    standAlone: 'A stand-alone study: not a gate, exit, entry or size on the live gold book; it reads no gold-book positions (owner decision 44).',
    sessions: SESSION, costs: { ...P.COST }, costBasis: { xau: 'standing gold round trip of the repository', xag: 'ICT lab silver round trip (api/_ictlab.js)', wtico: 'assumed: ~$0.03 retail CFD spread + $0.01 slippage' },
    windows: { A: '2007 (or first data) - 2015 (replication)', B: '2016 → 2026-11-13 (decides)' }, tests: {} };
  for (const [sym, { recs, skipped }] of Object.entries(markets)) {
    out.tests[sym] = { test: TESTS[sym], name: NAME[sym], skipped, A: summarize(recs, P.WIN.A), B: summarize(recs, P.WIN.B), byYear: byYear(recs) };
  }
  const syms = Object.keys(out.tests), ps = syms.map((s) => { const t = out.tests[s].B.tMonth; return t == null ? 1 : normSf(t); }), hp = holm(ps);
  syms.forEach((s, i) => { const m = out.tests[s], A = m.A, B = m.B;
    m.pass = { p: r4(ps[i]), holm: r4(hp[i]), bothPositive: A.net > 0 && B.net > 0, tOk: B.tMonth != null && B.tMonth >= 2, holmOk: hp[i] < P.ALPHA, nOk: B.n >= P.MIN_N };
    m.pass.ok = m.pass.bothPositive && m.pass.tOk && m.pass.holmOk && m.pass.nOk; });
  out.passed = syms.filter((s) => out.tests[s].pass.ok).map((s) => TESTS[s]);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

// ── report ──
const sg = (v, d = 3) => v == null ? 'n/a' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
const pc = (v) => v == null ? 'n/a' : (v * 100).toFixed(1) + ' %';
const yn = (b) => b ? 'yes' : 'no';
export function render(j) {
  const T = Object.values(j.tests), L = [];
  L.push('# Intraday momentum on gold, silver and crude oil: result', '');
  const line = (m) => `${m.test} ${m.name}, 2016 → now: n ${m.B.n}, ${sg(m.B.net)}R a trade net of costs (before costs ${sg(m.B.gross)}R), month-sum t ${sg(m.B.tMonth, 2)}, Holm p ${m.pass.holm.toFixed(3)}; 2007-2015 ${sg(m.A.net)}R (n ${m.A.n})`;
  L.push(`**Verdict: ${j.verdict}** (${j.passed.length} of ${T.length} tests pass). ${T.map(line).join('. ')}.`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed and pushed alone before any return was computed). Claim from ${j.paper}. Rule: ${j.rule}. Costs, round trip: gold $${j.costs.xau.toFixed(2)}, silver $${j.costs.xag.toFixed(2)}, crude $${j.costs.wtico.toFixed(2)} (crude assumed; no financing, the trade is intraday). Data: OANDA mid M5 candles through the candle proxy; New York time from \`council/histdata.mjs\` \`nyOffsetH\`; CME holidays and early closes skipped with \`ict/calendar.mjs\` \`cmeShut\`.`, '');
  L.push(`${j.standAlone} Nothing live changes.`, '');
  L.push('## Pass bar, per test', '');
  L.push('Window B = 2016 → 2026-11-13 decides; window A = 2007 (or first data) to 2015 replicates. A test passes when net R a trade > 0 in A and B, the B month-sum t ≥ 2, Holm p < 0.05 over the three tests (one-sided p of the B month-sum t), and B n ≥ 300.', '');
  L.push('| test | market | B n | B gross R | B net R | B month-sum t | months | p (one-sided) | Holm p | A net R | A n | net > 0 both | t ≥ 2 | Holm < 0.05 | n ≥ 300 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of T) L.push(`| ${m.test} | ${m.name} | ${m.B.n} | ${sg(m.B.gross)} | ${sg(m.B.net)} | ${sg(m.B.tMonth, 2)} | ${m.B.months} | ${m.pass.p.toFixed(3)} | ${m.pass.holm.toFixed(3)} | ${sg(m.A.net)} | ${m.A.n} | ${yn(m.pass.bothPositive)} | ${yn(m.pass.tOk)} | ${yn(m.pass.holmOk)} | ${yn(m.pass.nOk)} | **${yn(m.pass.ok)}** |`);
  L.push('', '## Per market and window (descriptive beyond the pass bar)', '');
  L.push('| test | window | span | days | trades | net R | t (trades) | month-sum t | gross R | t gross | cost R | win | stops | longs | total net R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of T) for (const [k, lab] of [['A', 'A 2007-2015'], ['B', 'B 2016 → now']]) { const w = m[k];
    L.push(`| ${m.test} ${m.name} | ${lab} | ${w.from ?? 'n/a'} → ${w.to ?? 'n/a'} | ${w.days} | ${w.n} | ${sg(w.net)} | ${sg(w.tTrade, 2)} | ${sg(w.tMonth, 2)} | ${sg(w.gross)} | ${sg(w.tGross, 2)} | ${w.costR.toFixed(3)} | ${pc(w.win)} | ${w.stops} | ${w.longs} | ${sg(w.totalNet, 1)} |`); }
  L.push('', '## Placebo, 40 seeds (reported, decides nothing)', '', 'Same traded days, a random long / short sign per day and seed; same entry, stop, exit and cost.', '');
  L.push('| test | window | rule net R | placebo mean | placebo 95th pct | placebo max | rule beats seeds | sign hit rate | placebo hit mean | placebo hit 95th pct | hit beats seeds |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const m of T) for (const [k, lab] of [['A', '2007-2015'], ['B', '2016 → now']]) { const w = m[k], p = w.placebo;
    L.push(`| ${m.test} ${m.name} | ${lab} | ${sg(w.net)} | ${sg(p.netMean)} | ${sg(p.netQ95)} | ${sg(p.netMax)} | ${p.beats} / 40 | ${pc(p.hit)} | ${pc(p.hitMean)} | ${pc(p.hitQ95)} | ${p.hitBeats} / 40 |`); }
  L.push('', '## At 2× cost (reported, decides nothing)', '');
  L.push('| test | A net R | A month-sum t | B net R | B month-sum t |', '|---|---|---|---|---|');
  for (const m of T) L.push(`| ${m.test} ${m.name} | ${sg(m.A.net2x)} | ${sg(m.A.tMonth2x, 2)} | ${sg(m.B.net2x)} | ${sg(m.B.tMonth2x, 2)} |`);
  L.push('', '## The paper\'s regression (descriptive)', '', 'OLS of the last half-hour return on the first half-hour return of the floor session, both in %, on every eligible day with prices.', '');
  L.push('| test | window | n | slope | t (OLS) | t (White) | R² |', '|---|---|---|---|---|---|---|');
  for (const m of T) for (const [k, lab] of [['A', '2007-2015'], ['B', '2016 → now']]) { const r = m[k].reg;
    L.push(`| ${m.test} ${m.name} | ${lab} | ${r.n} | ${sg(r.slope, 4)} | ${sg(r.tOls, 2)} | ${sg(r.tWhite, 2)} | ${r.r2 == null ? 'n/a' : (r.r2 * 100).toFixed(2) + ' %'} |`); }
  L.push('', '## Net R by year (descriptive)', '');
  L.push(`| year | ${T.map((m) => `${m.name} n | ${m.name} net R | ${m.name} total`).join(' | ')} |`, `|---|${T.map(() => '---|---|---|').join('')}`);
  const yrs = [...new Set(T.flatMap((m) => Object.keys(m.byYear)))].sort();
  for (const y of yrs) L.push(`| ${y} | ${T.map((m) => { const a = m.byYear[y] || {}; return `${a.n ?? 0} | ${sg(a.net)} | ${sg(a.total, 1)}`; }).join(' | ')} |`);
  L.push('', '## Days left out', '');
  for (const m of T) L.push(`- ${m.test} ${m.name}: ${m.skipped.noPrice} eligible days without a price at one of the four times, ${m.skipped.warmup} days of the 20-day warm-up, ${m.skipped.flat} days with a zero signal.`);
  L.push('', '## What it means, and what it does not', '');
  L.push(j.verdict === 'PASS'
    ? `Test(s) ${j.passed.join(', ')} met every pre-registered line. That is a hypothesis for a forward paper shadow the owner decides on, never a live rule; it is not evidence for or about the live gold book.`
    : 'No test met the pre-registered bar. Trading the last half hour of the floor session on the sign of its first half hour is not an edge on these OANDA feeds after costs, on gold, silver or WTI crude. No proposal is written and nothing live changes. Never call it an edge.');
  L.push('', `- Before costs, 2016 → now: ${T.map((m) => `${m.name} ${sg(m.B.gross)}R a trade (t ${sg(m.B.tGross, 2)})`).join(', ')}; 2007-2015: ${T.map((m) => `${m.name} ${sg(m.A.gross)}R (t ${sg(m.A.tGross, 2)})`).join(', ')}. The cost a trade in R (${T.map((m) => `${m.name} ${m.B.costR.toFixed(3)}R`).join(', ')}) is large against a half-hour move, so even a small gross edge would have to clear it.`);
  L.push('- The placebo and the hit rates say the same: in 2016 → now the sign of the first half hour is no better at calling the last half hour than a coin on gold, silver or crude.');
  L.push('- It tests one rule (one predictor half hour, one traded half hour, one stop) as fixed in advance; it does not test other half hours, the overnight gap, volatility or news splits.');
  L.push('- The prices are OANDA spot / CFD mid prices on the futures\' floor-session clock, not the futures; the crude cost is an assumption (the 2× cost line shows its weight).');
  L.push('- It is stand-alone: it says nothing about the live gold book\'s systems and was not used to judge, gate or size them (owner decision 44).');
  L.push('', 'To repeat: `node --use-env-proxy research/edge/metals-intraday-momentum/fetch.mjs <dir>`, then `node research/edge/metals-intraday-momentum/run.mjs <dir>`. Test: `tests/metals-intraday-momentum.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const mk = {};
  for (const sym of MARKETS) mk[sym] = runMarket(toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`))))), sym);
  const j = build(mk);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(j, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(j));
  console.log(render(j).split('\n').slice(0, 3).join('\n'));
}
