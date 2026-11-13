// The Asian range breakout into London on gold (pre-registered in PREREGISTRATION.md, pushed before any result).
// Range = the 7 hours before the 07:00 London open (London local clock, so 23:00-05:59 UTC in British summer time); Rule B
// trades the first M15 close beyond it in the 4 hours after the open, Rule F fades a break that closes back inside within two
// M15 candles; out at 12:00 New York. OANDA mid M5 gold, $0.30 a round trip, stop first when one candle holds both.
// A new stand-alone intraday rule decided on 2020 to now: not a test of the gold book (item 44).
//   node --use-env-proxy research/edge/gold-asia-break/run.mjs fetch <dir>   -> <dir>/xau-5m.json.gz (kept out of git)
//   node research/edge/gold-asia-break/run.mjs full <dir>                    -> result.json, RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { usDaylight, euSummer } from '../../../council/histdata.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const H = 3600;
export const K = { M5: 300, M15: 900, RANGE_H: 7, WIN_H: 4, MIN_CANDLES: 70, MED_N: 20, WIDE: 2, B_STOP: 1, B_TGT: 1.5, F_BACK: 2,
  F_BUF: 0.30, COST: 0.30, MIN_N: 300, T_MIN: 2, ALPHA: 0.05, SEEDS: 40, BEAT: 38,
  FROM: Date.UTC(2007, 10, 1) / 1000, REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000], DEC: Date.UTC(2020, 0, 1) / 1000 };

// ─── the clock of one London weekday (day = its UTC midnight) ───
export function clockOf(day) {
  const mid = day + 12 * H, s = euSummer(mid) ? 1 : 0;   // UK summer time = the EU rule (last Sunday of March / October, 01:00 UTC)
  const london0 = day - s * H, open = london0 + K.RANGE_H * H;
  return { day, summer: !!s, rangeFrom: london0, open, winEnd: open + K.WIN_H * H, exitT: day + 12 * H + (usDaylight(mid) ? 4 : 5) * H };
}

// first index with M5[i].time >= t
export function lb(M5, t) { let a = 0, b = M5.length; while (a < b) { const m = (a + b) >> 1; if (M5[m].time < t) a = m + 1; else b = m; } return a; }

export function rangeOf(M5, c) {
  let hi = -Infinity, lo = Infinity, n = 0;
  for (let i = lb(M5, c.rangeFrom); i < M5.length && M5[i].time < c.open; i++) { const b = M5[i]; hi = Math.max(hi, b.high); lo = Math.min(lo, b.low); n++; }
  return { hi, lo, n, size: hi - lo };
}

// an M15 candle from the M5 candles of its quarter hour (null when none)
export function m15(M5, q) {
  let o = null, hi = -Infinity, lo = Infinity, cl = null;
  for (let i = lb(M5, q); i < M5.length && M5[i].time < q + K.M15; i++) { const b = M5[i]; if (o == null) o = b.open; hi = Math.max(hi, b.high); lo = Math.min(lo, b.low); cl = b.close; }
  return o == null ? null : { time: q, open: o, high: hi, low: lo, close: cl };
}

// the first M15 close beyond the range in the break window, and what follows it (only candles that ended before each step)
export function firstBreak(M5, c, R) {
  for (let q = c.open; q < c.winEnd; q += K.M15) {
    const m = m15(M5, q); if (!m) continue;
    if (m.close > R.hi) return { side: 1, q, m };
    if (m.close < R.lo) return { side: -1, q, m };
  }
  return null;
}

// one trade on M5 from the first candle at or after t: stop first, gapped stops at the open, target at its price, time exit
export function sim(M5, { side, t, stop, target, exitT }) {
  const i0 = lb(M5, t); if (i0 >= M5.length || M5[i0].time >= exitT) return null;
  const entry = M5[i0].open, r0 = Math.abs(entry - stop);
  if (!(r0 > 0) || (side > 0 ? entry <= stop || entry >= target : entry >= stop || entry <= target)) return null;
  let px = null, why = 'time', closed = null, last = null;
  for (let i = i0; i < M5.length && M5[i].time + K.M5 <= exitT; i++) {
    const b = M5[i]; last = b;
    if (side > 0 ? b.low <= stop : b.high >= stop) { px = side > 0 ? Math.min(stop, b.open) : Math.max(stop, b.open); why = 'stop'; closed = b.time + K.M5; break; }
    if (side > 0 ? b.high >= target : b.low <= target) { px = target; why = 'target'; closed = b.time + K.M5; break; }
  }
  if (px == null) { if (!last) return null; px = last.close; closed = last.time + K.M5; }
  const gross = (px - entry) * side / r0, nt = side > 0 ? nights(M5[i0].time, closed) : 0, finR = nt * FIN.xau.long * entry / r0;
  return { side, entryT: M5[i0].time, entry, stop, target, r0, exit: px, closed, why, gross, finR, net: gross - K.COST / r0 - finR };
}

// the plan (side, entry time, stop, target) of each rule for one day, before the fill
export function plans(M5, c, R) {
  const out = { B: null, F: null }, br = firstBreak(M5, c, R); if (!br) return out;
  const size = R.size, tB = br.q + K.M15, iB = lb(M5, tB);
  if (iB < M5.length) {
    const e = M5[iB].open, opp = br.side > 0 ? R.lo : R.hi, d = Math.min(Math.abs(e - opp), K.B_STOP * size);
    out.B = { rule: 'B', side: br.side, t: tB, stop: e - br.side * d, target: e + br.side * K.B_TGT * size, brk: br.q };
  }
  let ext = br.side > 0 ? br.m.high : br.m.low;
  for (let k = 1; k <= K.F_BACK; k++) {
    const q = br.q + k * K.M15, m = m15(M5, q); if (!m) continue;
    ext = br.side > 0 ? Math.max(ext, m.high) : Math.min(ext, m.low);
    if (br.side > 0 ? m.close < R.hi : m.close > R.lo) {
      const s = -br.side; out.F = { rule: 'F', side: s, t: q + K.M15, stop: ext + br.side * K.F_BUF, target: s > 0 ? R.hi : R.lo, brk: br.q, back: q }; break;
    }
  }
  return out;
}

// every London weekday: coverage, the skip filter, the two rules' trades
export function run(M5) {
  const days = [], ranges = [], trades = { B: [], F: [] }, skipped = { coverage: 0, wide: 0, warm: 0 };
  const d0 = Math.floor(M5[0].time / 86400) * 86400 + 86400, d1 = Math.floor(M5.at(-1).time / 86400) * 86400;
  for (let day = Math.max(d0, K.FROM); day <= d1; day += 86400) {
    const w = new Date(day * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const c = clockOf(day); if (c.exitT > M5.at(-1).time + K.M5) break;
    const R = rangeOf(M5, c); if (R.n < K.MIN_CANDLES) { skipped.coverage++; continue; }
    const prev = ranges.slice(-K.MED_N); ranges.push(R.size);
    if (prev.length < K.MED_N) { skipped.warm++; continue; }
    const med = median(prev); if (R.size > K.WIDE * med) { skipped.wide++; continue; }
    const p = plans(M5, c, R); days.push({ day, size: R.size });
    for (const k of ['B', 'F']) { if (!p[k]) continue; const x = sim(M5, { ...p[k], exitT: c.exitT }); if (x) trades[k].push({ day, rule: k, range: R.size, ...x }); }
  }
  return { days, trades, skipped };
}

// placebo: the same entry, the rule's stop and target distances, the direction at random
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(M5, trades, seed) {
  const r = rng(seed), out = [];
  for (const x of trades) {
    const s = r() < 0.5 ? 1 : -1, ds = Math.abs(x.entry - x.stop), dt = Math.abs(x.target - x.entry);
    const c = clockOf(x.day), y = sim(M5, { side: s, t: x.entryT, stop: x.entry - s * ds, target: x.entry + s * dt, exitT: c.exitT });
    if (y) out.push({ day: x.day, ...y });
  }
  return out;
}

// ─── statistics ───
export const median = (a) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(trades, from, to) {
  const m0 = ym(from), m1 = ym(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const x of trades) sums[ym(x.entryT) - m0] += x.net;
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
const Phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export const pOne = (t) => 1 - Phi(t);
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; }); return adj; }
export function dd(trades) { let s = 0, hi = 0, w = 0; for (const x of [...trades].sort((a, b) => a.entryT - b.entryT)) { s += x.net; hi = Math.max(hi, s); w = Math.min(w, s - hi); } return w; }
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
export function summ(trades, from, to) {
  const xs = trades.filter((x) => x.entryT >= from && x.entryT < to), net = xs.map((x) => x.net), mt = monthT(xs, from, to);
  const why = {}; for (const x of xs) why[x.why] = (why[x.why] || 0) + 1;
  return { n: xs.length, net: r3(mean(net)), gross: r3(mean(xs.map((x) => x.gross))), totalR: r3(net.reduce((s, v) => s + v, 0)), win: r3(xs.filter((x) => x.net > 0).length / (xs.length || 1)),
    tTrade: xs.length > 1 ? r3(mean(net) / (sd(net) / Math.sqrt(net.length))) : null, months: mt.months, tMonth: r3(mt.t), dd: r3(dd(xs)), exits: why,
    up: xs.filter((x) => x.side > 0).length, down: xs.filter((x) => x.side < 0).length, medRange: r3(median(xs.map((x) => x.range ?? 0))), medRisk: r3(median(xs.map((x) => x.r0))), finR: r3(xs.reduce((s, x) => s + x.finR, 0)) };
}
export function byYear(trades) { const y = {}; for (const x of trades) { const k = new Date(x.entryT * 1000).getUTCFullYear(); (y[k] ||= []).push(x.net); } return Object.fromEntries(Object.entries(y).map(([k, a]) => [k, { n: a.length, net: r3(mean(a)), total: r3(a.reduce((s, v) => s + v, 0)) }])); }

export function judge(M5, R, end) {
  const out = {}, rules = ['B', 'F'];
  for (const k of rules) out[k] = { decisive: summ(R.trades[k], K.DEC, end), replication: summ(R.trades[k], K.REP[0], K.REP[1]), years: byYear(R.trades[k]) };
  const ps = rules.map((k) => pOne(out[k].decisive.tMonth)), adj = holm(ps);
  rules.forEach((k, i) => {
    const dec = R.trades[k].filter((x) => x.entryT >= K.DEC), pm = [];
    for (let s = 1; s <= K.SEEDS; s++) pm.push(mean(placebo(M5, dec, s).map((x) => x.net)));
    const beat = pm.filter((v) => out[k].decisive.net > v).length, d = out[k].decisive;
    out[k].p = r3(ps[i]); out[k].pHolm = r3(adj[i]);
    out[k].placebo = { seeds: K.SEEDS, beat, need: K.BEAT, min: r3(Math.min(...pm)), median: r3(median(pm)), max: r3(Math.max(...pm)) };
    out[k].checks = { positive: d.net > 0, tMonth: d.tMonth >= K.T_MIN && adj[i] < K.ALPHA, n: d.n >= K.MIN_N, replication: out[k].replication.net > 0, placebo: beat >= K.BEAT };
    out[k].pass = Object.values(out[k].checks).every(Boolean);
  });
  return { rules: out, verdict: rules.some((k) => out[k].pass) ? 'PASS' : 'FAIL' };
}

// ─── report ───
const f2 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const yes = (b) => (b ? 'yes' : '**no**');
export function report(r) {
  const L = [], B = r.rules.B, F = r.rules.F;
  L.push('# Asian range breakout into London on gold: result', '', `**Verdict: ${r.verdict}**${r.verdict === 'FAIL' ? ', neither rule passes the pre-registered bar' : ''}. Research only: no live rule, size, filter, stop or config changed.`, '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (pushed before any number was computed). A new stand-alone intraday rule decided on 2020 to now, not a test of the gold book (item 44); it does not repeat \`seasonality\` H5 (a long hold from 18:00 New York to 08:00 London, no range).`, '');
  L.push(`Data: OANDA mid M5 XAU/USD, ${r.candles.from} to ${r.candles.to} (${r.candles.m5.toLocaleString('en-US')} candles). Range = 00:00-06:59 London local (23:00-05:59 UTC in British summer time), break window 07:00-10:59 London, out at 12:00 New York; $0.30 a round trip; financing on buys over 17:00 New York (zero: every trade ends by noon New York, ${f2(B.decisive.finR)}R charged). Days used ${r.days.used.toLocaleString('en-US')}; skipped: ${r.days.skipped.coverage} short of candles, ${r.days.skipped.wide} range over 2x its 20-day median, ${r.days.skipped.warm} warm-up.`, '');
  L.push('| Rule | Window | n | Net R a trade | Gross R | Win % | Month-sum t | Total R | Worst drawdown R | Exits stop / target / time |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, nm] of [['B', 'B breakout'], ['F', 'F fade']]) for (const [w, wn] of [['decisive', '2020-now (decisive)'], ['replication', '2010-19 (replication)']]) {
    const s = r.rules[k][w]; L.push(`| ${nm} | ${wn} | ${s.n} | ${f2(s.net)} | ${f2(s.gross)} | ${(s.win * 100).toFixed(1)} | ${s.tMonth.toFixed(2)} | ${f2(s.totalR)} | ${f2(s.dd)} | ${s.exits.stop || 0} / ${s.exits.target || 0} / ${s.exits.time || 0} |`);
  }
  L.push('', '## The pre-registered checks', '', '| Check | B breakout | F fade |', '|---|---|---|');
  L.push(`| 1. decisive net R a trade > 0 | ${yes(B.checks.positive)} (${f2(B.decisive.net)}) | ${yes(F.checks.positive)} (${f2(F.decisive.net)}) |`);
  L.push(`| 2. month-sum t >= 2 and Holm p < 0.05 | ${yes(B.checks.tMonth)} (t ${B.decisive.tMonth.toFixed(2)}, Holm p ${B.pHolm}) | ${yes(F.checks.tMonth)} (t ${F.decisive.tMonth.toFixed(2)}, Holm p ${F.pHolm}) |`);
  L.push(`| 3. decisive n >= 300 | ${yes(B.checks.n)} (${B.decisive.n}) | ${yes(F.checks.n)} (${F.decisive.n}) |`);
  L.push(`| 4. 2010-19 net R a trade > 0 | ${yes(B.checks.replication)} (${f2(B.replication.net)}) | ${yes(F.checks.replication)} (${f2(F.replication.net)}) |`);
  L.push(`| 5. beats >= 38 of 40 random-direction placebos | ${yes(B.checks.placebo)} (${B.placebo.beat}; placebo ${f2(B.placebo.min)} to ${f2(B.placebo.max)}) | ${yes(F.checks.placebo)} (${F.placebo.beat}; placebo ${f2(F.placebo.min)} to ${f2(F.placebo.max)}) |`);
  L.push(`| **Rule passes** | ${yes(B.pass)} | ${yes(F.pass)} |`, '');
  L.push('## Reported, not tested', '');
  for (const [k, nm] of [['B', 'Rule B'], ['F', 'Rule F']]) {
    const d = r.rules[k].decisive; L.push(`- ${nm}, 2020-now: ${d.up} buys / ${d.down} sells, median range $${d.medRange}, median 1R $${d.medRisk}, per-trade t ${d.tTrade}.`);
    L.push(`  Year by year (n, net R a trade; 2007-09 warm-up, never judged): ${Object.entries(r.rules[k].years).map(([y, v]) => `${y} ${v.n} ${f2(v.net)}`).join('; ')}.`);
  }
  L.push('', r.verdict === 'PASS' ? 'A PASS is a proposal for a paper shadow only; the owner decides.' : 'Not an edge; no proposal is written and nothing live changes.', '');
  L.push('To repeat: `node --use-env-proxy research/edge/gold-asia-break/run.mjs fetch <dir>`, then `node research/edge/gold-asia-break/run.mjs full <dir>`. Tests: `tests/gold-asia-break.test.mjs`.', '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
if (MODE === 'fetch') {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms)), OUT = process.argv[3];
  const m = new Map(), end = Math.floor(Date.now() / 1000 / 86400) * 86400; fs.mkdirSync(OUT, { recursive: true });
  for (let a = K.FROM; a < end;) { const b = Math.min(end, a + 4999 * K.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`xau 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(80); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]); fs.writeFileSync(path.join(OUT, 'xau-5m.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
  console.log(`5m: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'full') {
  const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.argv[3], 'xau-5m.json.gz'))))), end = M5.at(-1).time + K.M5;
  const R = run(M5), j = judge(M5, R, end);
  const out = { topic: 'gold-asia-break', built: '2026-11-13', system: 'Asian range breakout (B) and fade (F) into London on gold, OANDA mid M5, $0.30 a round trip',
    candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }, params: K, days: { used: R.days.length, skipped: R.skipped },
    verdict: j.verdict, rules: j.rules };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(out.verdict, JSON.stringify({ B: j.rules.B.decisive, F: j.rules.F.decisive }));
}
