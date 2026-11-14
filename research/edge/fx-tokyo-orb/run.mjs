// Edge research · fx-tokyo-orb: the Tokyo-open range breakout (00:00-01:00 UTC range, first M15 close beyond it before
// 05:45 UTC, enter at the next open, stop the other side, out at 06:00 UTC) on USD/JPY, AUD/USD and NZD/USD.
// Rule, costs and the pass bar: PREREGISTRATION.md (committed and pushed before this file read any test candle). Paper
// research only: nothing here trades or changes a live rule. Pieces copied (not imported) from the London study's run.mjs.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<pair>-15m.json.gz (OANDA mid M15 + tick volume, kept out of git)
//   node run.mjs full <dir>                    -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PAIRS = ['usdjpy', 'audusd', 'nzdusd'];
export const TESTS = { T1: 'usdjpy', T2: 'audusd', T3: 'nzdusd' };
export const K = { M15: 900, RANGE_BARS: 4, VOL_N: 20, VOL_MIN: 0.5, ATR_N: 14, MIN_W: 0.25, EPS: 1e-9,
  SIG_FROM_H: 1, SIG_LAST: 5 * 3600 + 30 * 60, END_H: 6, SPREAD_PIP: 0.3, COMM_SIDE: 22.5e-6, SLIP_PIP: 0.5, SEEDS: 40, N_MIN: 300,
  DATA_FROM: Date.UTC(2007, 5, 1) / 1000, REP_FROM: Date.UTC(2008, 0, 1) / 1000, DEC_FROM: Date.UTC(2016, 0, 1) / 1000 };
export const RULE = 'range = the four M15 candles 00:00-00:45 UTC; first M15 close beyond it from the 01:00-05:30 candles; enter at the next open; stop the other side of the range; no target; exit at the 06:00 UTC close';
export const pipOf = (pair) => (/jpy$/.test(pair) ? 0.01 : 0.0001);

const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const weekday = (d) => { const w = new Date(d * 1000).getUTCDay(); return w !== 0 && w !== 6; };

// UTC daily candles, Monday to Friday, from the M15 candles (weekend candles dropped)
export function dailies(B) {
  const out = [];
  for (const b of B) {
    const d = Math.floor(b.time / 86400) * 86400; if (!weekday(d)) continue;
    const l = out.at(-1);
    if (l && l.day === d) { if (b.high > l.high) l.high = b.high; if (b.low < l.low) l.low = b.low; l.close = b.close; }
    else out.push({ day: d, open: b.open, high: b.high, low: b.low, close: b.close });
  }
  return out;
}
// ATR(14) of the complete daily candles BEFORE day d (today excluded); null while fewer than 15 earlier days exist
export function atrBefore(D, d) {
  const j = D.findIndex((x) => x.day >= d), k = j < 0 ? D.length : j;
  if (k < K.ATR_N + 1) return null;
  let s = 0; for (let i = k - K.ATR_N; i < k; i++) { const c = D[i], pc = D[i - 1].close; s += Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc)); }
  return s / K.ATR_N;
}

// day plans: the range and every skip, reading nothing after 01:00 UTC of the day
export function days(B) {
  const out = [], vols = [], D = dailies(B), seenYear = new Set();
  if (!B.length) return out;
  const d0 = Math.floor(B[0].time / 86400) * 86400, d1 = Math.floor(B.at(-1).time / 86400) * 86400;
  let di = 0;
  for (let d = d0; d <= d1; d += 86400) {
    if (!weekday(d)) continue;
    const i0 = lowerT(B, d), i1 = lowerT(B, d + 3600);
    const ok = i1 - i0 === K.RANGE_BARS && [0, 1, 2, 3].every((q) => B[i0 + q].time === d + q * K.M15);
    if (!ok) continue;
    let hi = -Infinity, lo = Infinity, vol = 0;
    for (let i = i0; i < i1; i++) { if (B[i].high > hi) hi = B[i].high; if (B[i].low < lo) lo = B[i].low; vol += B[i].volume || 0; }
    const prev = vols.slice(-K.VOL_N), vmed = prev.length === K.VOL_N ? median(prev) : null;
    vols.push(vol);
    while (di < D.length && D[di].day < d) di++;
    const atr = atrBefore(D.slice(0, di), d), range = hi - lo, x = new Date(d * 1000), y = x.getUTCFullYear();
    const jan1 = x.getUTCMonth() === 0 && x.getUTCDate() === 1, isNewYear = jan1 || !seenYear.has(y);
    if (!jan1) seenYear.add(y); // 1 January is skipped AND the first other weekday of the year with its range
    const skip = vmed == null || atr == null ? 'warm-up' : isNewYear ? 'new-year' : vol < K.VOL_MIN * vmed ? 'thin' : range < K.MIN_W * atr ? 'narrow' : null;
    out.push({ day: d, hi, lo, range, vol, vmed, atr, skip, iStart: i1, until: d + K.SIG_LAST, end: d + K.END_H * 3600 });
  }
  return out;
}

export function costPx(pair, entry, mult = 1) { const p = pipOf(pair); return mult * (K.SPREAD_PIP * p + 2 * K.COMM_SIDE * entry + 2 * K.SLIP_PIP * p); }

// from the entry candle i to the 06:00 UTC close
export function manage(B, side, stop, i, end) {
  for (let j = i; j < B.length && B[j].time < end; j++) {
    const c = B[j];
    if (j > i && (side > 0 ? c.open <= stop : c.open >= stop)) return { kind: 'stop', px: c.open, at: c.time };
    if (side > 0 ? c.low <= stop : c.high >= stop) return { kind: 'stop', px: stop, at: c.time };
  }
  let j = lowerT(B, end) - 1; if (j < i) j = i;
  return { kind: 'time', px: B[j].close, at: B[j].time };
}
export function book(pair, day, side, entry, stop, at, ex, extra = {}) {
  const r0 = Math.abs(entry - stop), gross = side * (ex.px - entry) / r0;
  return { pair, day, at, side, entry, stop, r0, exit: ex.kind, exitPx: ex.px, exitAt: ex.at, gross,
    net: gross - costPx(pair, entry) / r0, net2: gross - costPx(pair, entry, 2) / r0, ...extra };
}
// the rule for one day plan
export function trade(pair, B, d) {
  for (let i = d.iStart; i < B.length && B[i].time <= d.until; i++) {
    const c = B[i]; if (c.time < d.day + K.SIG_FROM_H * 3600) continue;
    const side = c.close > d.hi ? 1 : c.close < d.lo ? -1 : 0;
    if (!side) continue;
    const n = B[i + 1];
    if (!n || n.time !== c.time + K.M15) return null;
    const stop = side > 0 ? d.lo : d.hi, entry = n.open;
    if (side > 0 ? entry <= stop + K.EPS : entry >= stop - K.EPS) return null;
    return book(pair, d.day, side, entry, stop, n.time, manage(B, side, stop, i + 1, d.end), { sigAt: c.time, range: d.range });
  }
  return null;
}
export function tradesOf(pair, B) { const out = []; for (const d of days(B)) { if (d.skip) continue; const t = trade(pair, B, d); if (t) out.push(t); } return out; }

// placebo: the real trade's pair, day, entry candle and stop distance, the side drawn at random
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboTrade(pair, B, t, u) {
  const side = u < 0.5 ? 1 : -1, i = lowerT(B, t.at), stop = t.entry - side * t.r0;
  return book(pair, t.day, side, t.entry, stop, t.at, manage(B, side, stop, i, t.day + K.END_H * 3600));
}

// statistics
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export function normSf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; }
const monthKey = (t) => { const x = new Date(t * 1000); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthKey(from), m1 = monthKey(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const t of trades) if (t.at >= from && t.at < to) sums[monthKey(t.at) - m0] += t[key];
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
export function summ(trades, from, to) {
  const x = trades.filter((t) => t.at >= from && t.at < to), m = monthT(x, from, to);
  return { n: x.length, gross: r3(mean(x.map((t) => t.gross))), net: r3(mean(x.map((t) => t.net))), net2: r3(mean(x.map((t) => t.net2))),
    total: r2(x.reduce((s, t) => s + t.net, 0)), win: x.length ? r3(x.filter((t) => t.net > 0).length / x.length) : 0,
    months: m.months, t: r2(m.t), tGross: r2(monthT(x, from, to, 'gross').t), t2: r2(monthT(x, from, to, 'net2').t) };
}
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }

// the report, written from result.json (a reading written by hand is appended from READING.md)
export function report(R, reading = '') {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, tt = (x) => `${x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}`, ts = Object.keys(R.tests), L = [];
  L.push('# Tokyo-open range breakout on USD/JPY, AUD/USD and NZD/USD: result', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed and pushed before any trade was computed). OANDA mid M15, decisive window`,
    `${R.window.decisive}, replication ${R.window.replication}. Range = the 00:00-01:00 UTC candles (09:00-10:00 Tokyo, no daylight`,
    'saving in Japan); the first M15 close beyond it from the 01:00-05:30 candles; entry at the next open; stop the other side of the range;',
    `exit at the 06:00 UTC close. Costs: ${R.costs}. t on calendar-month sums. Paper research only: nothing live changed.`, '');
  L.push('## The three tests, net of costs', '', '| Test | Pair | Window | n | Gross R a trade | Net R a trade | t (months, net) | Total net R | Win rate | Net at 2x costs | t at 2x |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ts) for (const w of ['decisive', 'replication']) { const s = R.tests[k][w]; L.push(`| ${k} | ${R.tests[k].pair} | ${w === 'decisive' ? '2016 on' : 'to 2015'} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${tt(s.t)} | ${f(s.total, 1)} | ${(s.win * 100).toFixed(1)} % | ${f(s.net2)} | ${tt(s.t2)} |`); }
  L.push('', 't of the gross (before costs) month sums, 2016 on: ' + ts.map((k) => `${k} ${tt(R.tests[k].decisive.tGross)}`).join(', ') + '; to 2015: ' + ts.map((k) => `${k} ${tt(R.tests[k].replication.tGross)}`).join(', ') + '.');
  L.push('', '## The pass bar', '', '| Test | Verdict | ' + Object.keys(R.tests[ts[0]].checks).join(' | ') + ' | one-sided p | Holm p |', '|---|---|' + Object.keys(R.tests[ts[0]].checks).map(() => '---').join('|') + '|---|---|');
  for (const k of ts) { const V = R.tests[k]; L.push(`| ${k} | ${V.verdict} | ` + Object.values(V.checks).map((x) => (x ? 'yes' : 'no')).join(' | ') + ` | ${V.p} | ${V.pHolm} |`); }
  L.push('', '## Placebo (decisive window, 40 seeds: same pair, day, entry candle and stop distance, side at random)', '', '| Test | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real above the 95th pct |', '|---|---|---|---|---|---|');
  for (const k of ts) { const P = R.tests[k].placebo; L.push(`| ${k} | ${f(R.tests[k].decisive.net)} | ${f(P.mean)} | ${f(P.p95)} | ${f(P.min)} to ${f(P.max)} | ${P.above ? 'yes' : 'no'} |`); }
  L.push('', `Pooled, not judged (the three pairs together): 2016 on ${f(R.pooled.decisive.net)}R a trade net (n ${R.pooled.decisive.n}, t ${tt(R.pooled.decisive.t)}, gross ${f(R.pooled.decisive.gross)}); to 2015 ${f(R.pooled.replication.net)}R (n ${R.pooled.replication.n}, t ${tt(R.pooled.replication.t)}, gross ${f(R.pooled.replication.gross)}).`);
  L.push('', '## By year (net R a trade / total net R, n)', '', '| Year | ' + ts.map((k) => `${k} ${R.tests[k].pair}`).join(' | ') + ' |', '|---|' + ts.map(() => '---').join('|') + '|');
  for (const y of Object.keys(R.tests[ts[0]].years)) L.push(`| ${y} | ` + ts.map((k) => { const s = R.tests[k].years[y]; return s.n ? `${f(s.net)} / ${f(s.total, 1)} (n ${s.n})` : '—'; }).join(' | ') + ' |');
  L.push('', '## Exits and costs, decisive window', '', ...ts.map((k) => `- ${k}: ` + Object.entries(R.tests[k].exits).map(([e, n]) => `${e} ${n}`).join(', ') + `; median stop distance ${R.tests[k].medR0Pips} pips, median cost ${R.tests[k].medCostR} R a trade`));
  L.push('', '## Days', '', '| Pair | Candles | First | Last | Days with the range | Warm-up | New year | Thin (holiday proxy) | Narrow | Kept | Trades |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of R.pairs) { const q = R.funnel[p]; L.push(`| ${p} | ${q.candles} | ${q.from} | ${q.to} | ${q.days} | ${q.warmup} | ${q.newyear} | ${q.thin} | ${q.narrow} | ${q.kept} | ${q.trades} |`); }
  if (reading) L.push('', reading.trim());
  L.push('', 'To repeat: `node --use-env-proxy research/edge/fx-tokyo-orb/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-tokyo-orb/run.mjs full <dir>`. Tests: `tests/fx-tokyo-orb.test.mjs`.', '');
  return L.join('\n');
}

// modes
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRange(sym, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * K.M15); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=15m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`${sym} 15m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close, +(x.volume || 0)]);
    a = b; await sleep(150); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
const load = (dir, p) => toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-15m.json.gz`)))));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  const end = Math.floor(Date.now() / 1000 / 86400) * 86400;
  await Promise.all(PAIRS.map(async (p) => { const f = path.join(OUT, `${p}-15m.json.gz`); if (fs.existsSync(f)) return;
    const rows = await fetchRange(p, K.DATA_FROM, end); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`${p}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); }));
}
if (MODE === 'full') {
  const DIR = process.argv[3], data = {}, T = {}, funnel = {};
  for (const p of PAIRS) data[p] = load(DIR, p);
  const END = Math.min(...PAIRS.map((p) => data[p].at(-1).time)) + K.M15, endDay = Math.floor(END / 86400) * 86400;
  for (const p of PAIRS) {
    const ds = days(data[p]);
    T[p] = tradesOf(p, data[p]).filter((t) => t.at >= K.REP_FROM && t.at < endDay);
    funnel[p] = { candles: data[p].length, from: iso(data[p][0].time), to: iso(data[p].at(-1).time), days: ds.length,
      warmup: ds.filter((d) => d.skip === 'warm-up').length, newyear: ds.filter((d) => d.skip === 'new-year').length, thin: ds.filter((d) => d.skip === 'thin').length,
      narrow: ds.filter((d) => d.skip === 'narrow').length, kept: ds.filter((d) => !d.skip).length, trades: T[p].length };
  }
  const repStart = Math.min(...PAIRS.map((p) => (T[p][0] ? T[p][0].at : K.DEC_FROM)));
  const out = { topic: 'fx-tokyo-orb', built: '2026-11-14', at: new Date().toISOString(), system: 'Tokyo-open range breakout (00:00-01:00 UTC range, M15 close beyond it, exit 06:00 UTC), USD/JPY, AUD/USD, NZD/USD, OANDA mid M15',
    rule: RULE, window: { replication: `${iso(Math.max(K.REP_FROM, Math.floor(repStart / 86400) * 86400)).slice(0, 10)} to 2015-12-31`, decisive: `2016-01-01 to ${iso(endDay - 86400).slice(0, 10)}` },
    params: K, pairs: PAIRS, funnel,
    costs: 'spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage on the entry and on the exit (all market)', tests: {} };
  for (const [k, p] of Object.entries(TESTS)) {
    const x = T[p], dec = summ(x, K.DEC_FROM, endDay), rep = summ(x, K.REP_FROM, K.DEC_FROM);
    const years = {}; for (let y = 2008; y <= new Date(endDay * 1000).getUTCFullYear(); y++) { const a = Date.UTC(y, 0, 1) / 1000, b = Math.min(Date.UTC(y + 1, 0, 1) / 1000, endDay); const s = summ(x, a, b); years[y] = { n: s.n, net: s.net, gross: s.gross, total: s.total }; }
    const real = x.filter((t) => t.at >= K.DEC_FROM), exits = {}; for (const t of real) exits[t.exit] = (exits[t.exit] || 0) + 1;
    const pl = []; for (let s = 1; s <= K.SEEDS; s++) { const u = rng(s); pl.push(mean(real.map((t) => placeboTrade(p, data[p], t, u()).net))); }
    const p95 = pctl(pl, 0.95);
    out.tests[k] = { pair: p, decisive: dec, replication: rep, years, exits,
      medR0Pips: r2(median(real.map((t) => t.r0 / pipOf(p)))), medCostR: r3(median(real.map((t) => t.gross - t.net))),
      p: +normSf(dec.t).toFixed(5), placebo: { seeds: K.SEEDS, mean: r3(mean(pl)), p95: r3(p95), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), above: dec.net > p95 } };
  }
  const all = PAIRS.flatMap((p) => T[p]).sort((a, b) => a.at - b.at);
  out.pooled = { note: 'reported, not judged', decisive: summ(all, K.DEC_FROM, endDay), replication: summ(all, K.REP_FROM, K.DEC_FROM) };
  const ks = Object.keys(out.tests), ph = holm(ks.map((k) => out.tests[k].p));
  for (const [i, k] of ks.entries()) { const V = out.tests[k]; V.pHolm = +ph[i].toFixed(5);
    V.checks = { 'decisive n >= 300': V.decisive.n >= K.N_MIN, 'decisive net R a trade > 0': V.decisive.net > 0, 'replication net R a trade > 0': V.replication.net > 0,
      'decisive month-sum t >= 2': V.decisive.t >= 2, 'Holm-adjusted p < 0.05': V.pHolm < 0.05 };
    V.verdict = Object.values(V.checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  const sg = (z) => `${z >= 0 ? '+' : ''}${z}`, npass = ks.filter((k) => out.tests[k].verdict === 'PASS').length;
  out.verdict = `${npass ? 'PASS' : 'FAIL'}: ${npass} of ${ks.length} tests pass. ` + ks.map((k) => { const V = out.tests[k]; return `${k} ${V.pair} ${V.verdict} (2016 on ${sg(V.decisive.net)}R a trade net, n ${V.decisive.n}, t ${V.decisive.t}; to 2015 ${sg(V.replication.net)}R, n ${V.replication.n})`; }).join('; ');
  out.candidates = ks.map((k) => ({ rule: `${k} ${out.tests[k].pair}: ${RULE}`, verdict: out.tests[k].verdict, is: out.tests[k].replication, oos: out.tests[k].decisive }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out, fs.existsSync(path.join(HERE, 'READING.md')) ? fs.readFileSync(path.join(HERE, 'READING.md'), 'utf8') : ''));
  console.log(JSON.stringify(funnel)); for (const k of ks) console.log(k, JSON.stringify(out.tests[k].decisive), JSON.stringify(out.tests[k].replication), JSON.stringify(out.tests[k].placebo), out.tests[k].pHolm, out.tests[k].verdict);
  console.log(JSON.stringify(out.pooled)); console.log(out.verdict);
}
