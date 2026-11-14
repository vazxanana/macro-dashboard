// Edge research · fx-round-numbers: round numbers on four forex majors, T1 stall (fade the first touch of a fresh "00" level)
// and T2 break (follow an M15 close 5 pips beyond it). Rules, costs and the pass bar: PREREGISTRATION.md (committed before this
// file read any candle). Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/<pair>-15m.json.gz (OANDA mid M15 from 2005-12-01, kept out of git)
//   node run.mjs full <dir>                    -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PAIRS = ['eurusd', 'gbpusd', 'audusd', 'usdjpy'];
export const K = { M15: 900, GRID_PIPS: 100, X_PIPS: 15, Y_PIPS: 5, T2_TGT: 1.5, FRESH_S: 24 * 3600, HOLD_S: 8 * 3600,
  EPS: 1e-9, SPREAD_PIP: 0.3, COMM_SIDE: 22.5e-6, SLIP_PIP: 0.5, SEEDS: 40, MIN_N: 300,
  DATA_FROM: Date.UTC(2005, 11, 1) / 1000, REP_FROM: Date.UTC(2006, 0, 1) / 1000, DEC_FROM: Date.UTC(2016, 0, 1) / 1000 };
export const RULES = { T1: 'stall: limit at the first touch of a level untouched for 24 h, against the approach, stop and target 15 pips, out after 8 h',
  T2: 'break: first M15 close 5+ pips beyond a level it touched, market at the next open, stop 15 pips back past the level, target 1.5R, out after 8 h' };
export const pipOf = (pair) => (/jpy$/.test(pair) ? 0.01 : 0.0001);

// ─── the grid: level k of a grid shifted by `off` (fraction of a step) ───
export const gridOf = (pair, off = 0) => { const G = K.GRID_PIPS * pipOf(pair); return { G, off, at: (k) => (k + off) * G }; };
const kLo = (g, p) => Math.ceil(p / g.G - g.off - 1e-7), kHi = (g, p) => Math.floor(p / g.G - g.off + 1e-7);
// levels a candle touches (low <= L <= high, within EPS)
export function touched(g, c) { const out = []; for (let k = kLo(g, c.low); k <= kHi(g, c.high); k++) { const L = g.at(k); if (c.low <= L + K.EPS && c.high >= L - K.EPS) out.push(k); } return out; }

// ─── costs (price) and R ───
export function costPx(pair, entry, nMkt, mult = 1) { const p = pipOf(pair); return mult * (K.SPREAD_PIP * p + 2 * K.COMM_SIDE * entry + K.SLIP_PIP * p * nMkt); }
const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// manage from candle i (the fill / entry candle) to `end` (clock time): first candle = `stopOnly` (T1: only the stop counts)
// or both (T2: the entry is that candle's open, stop first); later candles: gaps at the open, then stop first, then target.
export function manage(B, pos, end) {
  const { side, stop, target } = pos, E = K.EPS;
  for (let j = pos.i; j < B.length && B[j].time < end; j++) {
    const c = B[j], first = j === pos.i;
    if (!first) {
      if (side > 0 ? c.open <= stop + E : c.open >= stop - E) return { kind: 'stop', px: c.open, at: c.time, mkt: true };
      if (side > 0 ? c.open >= target - E : c.open <= target + E) return { kind: 'target', px: c.open, at: c.time, mkt: false };
    }
    if (side > 0 ? c.low <= stop + E : c.high >= stop - E) return { kind: 'stop', px: stop, at: c.time, mkt: true };
    if (!(first && pos.stopOnly) && (side > 0 ? c.high >= target - E : c.low <= target + E)) return { kind: 'target', px: target, at: c.time, mkt: false };
  }
  let j = lowerT(B, end) - 1; if (j < pos.i) j = pos.i;
  return { kind: 'time', px: B[j].close, at: B[j].time, mkt: true };
}
function book(pair, rule, k, side, entry, stop, target, at, ex, nEntryMkt) {
  const r0 = Math.abs(entry - stop), gross = side * (ex.px - entry) / r0, nM = nEntryMkt + (ex.mkt ? 1 : 0);
  return { pair, rule, k, at, side, entry, stop, target, r0, exit: ex.kind, exitPx: ex.px, exitAt: ex.at, gross,
    net: gross - costPx(pair, entry, nM) / r0, net2: gross - costPx(pair, entry, nM, 2) / r0 };
}
const dayOf = (t) => Math.floor(t / 86400);

// T1: fade the first touch of a fresh level (no candle after the touch candle is read to decide it)
export function stall(pair, B, off = 0) {
  const g = gridOf(pair, off), p = pipOf(pair), X = K.X_PIPS * p, last = new Map(), done = new Set(), out = [];
  if (!B.length) return out;
  const t0 = B[0].time;
  for (let i = 1; i < B.length; i++) {
    const c = B[i], ks = touched(g, c);
    for (const k of ks) {
      const L = g.at(k), lt = last.get(k), fresh = c.time - t0 >= K.FRESH_S && (lt == null || lt < c.time - K.FRESH_S);
      if (!fresh) continue;
      const pc = B[i - 1].close, side = pc < L - K.EPS ? -1 : pc > L + K.EPS ? 1 : 0;
      if (!side) continue;
      const key = `${k}:${dayOf(c.time)}`; if (done.has(key)) continue;
      const stop = L - side * X, target = L + side * X;
      if (side < 0 ? c.open >= stop - K.EPS : c.open <= stop + K.EPS) continue;
      const entry = side < 0 ? Math.max(L, c.open) : Math.min(L, c.open);
      done.add(key);
      const ex = manage(B, { side, stop, target, i, stopOnly: true }, c.time + K.HOLD_S);
      out.push(book(pair, 'T1', k, side, entry, stop, target, c.time, ex, 0));
    }
    for (const k of ks) last.set(k, c.time);
  }
  return out;
}

// T2: the first M15 close 5+ pips beyond a level touched by that candle or the one before; market at the next open
export function breaks(pair, B, off = 0) {
  const g = gridOf(pair, off), p = pipOf(pair), X = K.X_PIPS * p, Y = K.Y_PIPS * p, done = new Set(), out = [], E = K.EPS;
  for (let i = 1; i + 1 < B.length; i++) {
    const c = B[i], pv = B[i - 1], n = B[i + 1];
    const cand = [];
    const ku = kHi(g, c.close - Y), Lu = g.at(ku);
    if (c.close >= Lu + Y - E && pv.close < Lu + Y - E && Math.min(c.low, pv.low) <= Lu + E) cand.push([1, ku, Lu]);
    const kd = kLo(g, c.close + Y), Ld = g.at(kd);
    if (c.close <= Ld - Y + E && pv.close > Ld - Y + E && Math.max(c.high, pv.high) >= Ld - E) cand.push([-1, kd, Ld]);
    for (const [side, k, L] of cand) {
      const key = `${k}:${dayOf(c.time)}`; if (done.has(key)) continue;
      const entry = n.open, stop = L - side * X;
      if (side > 0 ? entry <= stop + E : entry >= stop - E) continue;
      done.add(key);
      const r0 = Math.abs(entry - stop), target = entry + side * K.T2_TGT * r0;
      const ex = manage(B, { side, stop, target, i: i + 1, stopOnly: false }, n.time + K.HOLD_S);
      const t = book(pair, 'T2', k, side, entry, stop, target, n.time, ex, 1); if (cand.length > 1) t.both = true;
      out.push(t);
    }
  }
  return out;
}
export const tradesOf = (pair, B, rule, off = 0) => (rule === 'T1' ? stall(pair, B, off) : breaks(pair, B, off));

// seeded uniform draws in [0, 1) (mulberry32): seed = the pre-registered seed number 1-40, nothing else mixed in
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const placeboOff = (seed) => rng(seed)();

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
export function normSf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; }
const monthKey = (t) => { const x = new Date(t * 1000); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthKey(from), m1 = monthKey(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const t of trades) if (t.at >= from && t.at < to) sums[monthKey(t.at) - m0] += t[key];
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
export function summ(trades, from, to) {
  const x = trades.filter((t) => t.at >= from && t.at < to), m = monthT(x, from, to);
  return { n: x.length, net: r3(mean(x.map((t) => t.net))), gross: r3(mean(x.map((t) => t.gross))), net2: r3(mean(x.map((t) => t.net2))),
    total: r2(x.reduce((s, t) => s + t.net, 0)), win: x.length ? r3(x.filter((t) => t.net > 0).length / x.length) : 0,
    months: m.months, t: r2(m.t), tGross: r2(monthT(x, from, to, 'gross').t), t2: r2(monthT(x, from, to, 'net2').t), median: r3(median(x.map((t) => t.net))) };
}
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }

// ─── the report, written from result.json (a reading written by hand is appended from READING.md) ───
export function report(R, reading = '') {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, rs = Object.keys(R.rules), L = [], W = { decisive: '2016 on', replication: R.window.replicationShort };
  L.push('# Round numbers on forex majors (stall and break): result', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Four pairs (${R.pairs.join(', ')}), OANDA mid M15,`,
    `decisive window ${R.window.decisive}, replication ${R.window.replication}. Levels = multiples of 100 pips ("00"); control = the "50" grid;`,
    `placebo = the grid shifted by a random fraction of a step (40 seeds). Costs: ${R.costs}. t on calendar-month sums. Paper research only:`,
    'nothing live changed.', '');
  L.push('## The two rules, real "00" levels, pooled', '', '| Rule | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs | t at 2x |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rs) for (const w of ['decisive', 'replication']) { const s = R.rules[r].real[w]; L.push(`| ${r} | ${W[w]} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${s.t.toFixed(2)} | ${s.tGross.toFixed(2)} | ${f(s.total, 1)} | ${(s.win * 100).toFixed(1)} % | ${f(s.net2)} | ${s.t2.toFixed(2)} |`); }
  L.push('', rs.map((r) => `${r}: ${R.rules[r].rule}.`).join(' '));
  L.push('', '## The pass bar', '', '| Rule | Verdict | ' + Object.keys(R.rules[rs[0]].tests).join(' | ') + ' | p (one-sided) | Holm p |', '|---|---|' + Object.keys(R.rules[rs[0]].tests).map(() => '---').join('|') + '|---|---|');
  for (const r of rs) { const V = R.rules[r]; L.push(`| ${r} | ${V.verdict} | ` + Object.values(V.tests).map((x) => (x ? 'yes' : 'no')).join(' | ') + ` | ${V.p} | ${V.pHolm} |`); }
  L.push('', '## Control: the "50" levels (reported, not judged)', '', '| Rule | Window | n | Gross R a trade | Net R a trade | t (months, net) |', '|---|---|---|---|---|---|');
  for (const r of rs) for (const w of ['decisive', 'replication']) { const s = R.rules[r].control50[w]; L.push(`| ${r} | ${W[w]} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${s.t.toFixed(2)} |`); }
  L.push('', '## Placebo: the grid shifted by a random fraction of a step (decisive window, 40 seeds)', '', '| Rule | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Placebo gross 95th pct | Real rank among 41 |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of rs) { const V = R.rules[r], P = V.placebo; L.push(`| ${r} | ${f(V.real.decisive.net)} | ${f(P.mean)} | ${f(P.p95)} | ${f(P.min)} to ${f(P.max)} | ${f(V.real.decisive.gross)} | ${f(P.grossMean)} | ${f(P.grossP95)} | ${P.rank} |`); }
  L.push('', '## Per pair (net R a trade, n, t on months)', '', '| Rule | Pair | 2016 on | n | gross | t | ' + W.replication + ' | n | gross | t |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rs) for (const p of R.pairs) { const a = R.rules[r].byPair[p].decisive, b = R.rules[r].byPair[p].replication; L.push(`| ${r} | ${p} | ${f(a.net)} | ${a.n} | ${f(a.gross)} | ${a.t.toFixed(2)} | ${f(b.net)} | ${b.n} | ${f(b.gross)} | ${b.t.toFixed(2)} |`); }
  L.push('', '## By year (net R a trade / total, real levels)', '', '| Year | ' + rs.join(' | ') + ' |', '|---|' + rs.map(() => '---').join('|') + '|');
  for (const y of Object.keys(R.rules[rs[0]].years)) L.push(`| ${y} | ` + rs.map((r) => { const s = R.rules[r].years[y]; return `${f(s.net)} / ${f(s.total, 1)} (n ${s.n})`; }).join(' | ') + ' |');
  L.push('', '## Exits, decisive window', '', ...rs.map((r) => `- ${r}: ` + Object.entries(R.rules[r].exits).map(([k, n]) => `${k} ${n}`).join(', ') + `; median r0 ${R.rules[r].r0Pips} pips`));
  L.push(`- T2 breaks where one candle broke a level up and another down (both taken, as pre-registered): ${R.rules.T2.both}.`);
  L.push('', '## Data', '', '| Pair | Candles | First | Last |', '|---|---|---|---|');
  for (const p of R.pairs) { const q = R.funnel[p]; L.push(`| ${p} | ${q.candles} | ${q.from} | ${q.to} |`); }
  if (reading) L.push('', reading.trim());
  L.push('', 'To repeat: `node --use-env-proxy research/edge/fx-round-numbers/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-round-numbers/run.mjs full <dir>`. Tests: `tests/fx-round-numbers.test.mjs`.', '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(sym, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * K.M15); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=15m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`${sym} 15m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const load = (dir, p) => toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${p}-15m.json.gz`)))));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  const end = Math.floor(Date.now() / 1000 / 86400) * 86400, list = process.argv[4] ? process.argv[4].split(',') : PAIRS;
  await Promise.all([0, 1].map(async (w) => { for (let k = w; k < list.length; k += 2) { const p = list[k], f = path.join(OUT, `${p}-15m.json.gz`); if (fs.existsSync(f)) continue;
    const rows = await range(p, K.DATA_FROM, end); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`${p}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); } }));
}
if (MODE === 'full') {
  const DIR = process.argv[3], data = {}, funnel = {};
  for (const p of PAIRS) { data[p] = load(DIR, p); funnel[p] = { candles: data[p].length, from: iso(data[p][0].time), to: iso(data[p].at(-1).time) }; }
  const END = Math.min(...PAIRS.map((p) => data[p].at(-1).time)) + K.M15, endDay = Math.floor(END / 86400) * 86400;
  const REP = Math.max(K.REP_FROM, Math.ceil(Math.max(...PAIRS.map((p) => data[p][0].time)) / 86400) * 86400 + 86400);
  const repLabel = `${iso(REP).slice(0, 10)} to 2015-12-31`, repShort = `${new Date(REP * 1000).getUTCFullYear()}-15`;
  const run = (rule, off) => { const x = []; for (const p of PAIRS) x.push(...tradesOf(p, data[p], rule, off)); return x.filter((t) => t.at >= REP && t.at < endDay).sort((a, b) => a.at - b.at); };
  const out = { topic: 'fx-round-numbers', built: '2026-11-14', at: new Date().toISOString(), system: 'Round-number stall (fade the first touch) and break (follow the close beyond), four forex majors, OANDA mid M15',
    window: { replication: repLabel, replicationShort: repShort, decisive: `2016-01-01 to ${iso(endDay - 86400).slice(0, 10)}` }, params: K, pairs: PAIRS, funnel,
    costs: 'spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage per market order (T2 entry, stop and time exits; none on the T1 limit entry or a target)', rules: {} };
  for (const r of Object.keys(RULES)) {
    const x = run(r, 0), c50 = run(r, 0.5), dec = summ(x, K.DEC_FROM, endDay), rep = summ(x, REP, K.DEC_FROM);
    const byPair = Object.fromEntries(PAIRS.map((p) => [p, { decisive: summ(x.filter((t) => t.pair === p), K.DEC_FROM, endDay), replication: summ(x.filter((t) => t.pair === p), REP, K.DEC_FROM) }]));
    const years = {}; for (let y = new Date(REP * 1000).getUTCFullYear(); y <= new Date(endDay * 1000).getUTCFullYear(); y++) { const a = Math.max(REP, Date.UTC(y, 0, 1) / 1000), b = Math.min(Date.UTC(y + 1, 0, 1) / 1000, endDay); const s = summ(x, a, b); years[y] = { n: s.n, net: s.net, total: s.total }; }
    const decT = x.filter((t) => t.at >= K.DEC_FROM), exits = {}; for (const t of decT) exits[t.exit] = (exits[t.exit] || 0) + 1;
    const pl = [], plG = [], offs = [];
    for (let s = 1; s <= K.SEEDS; s++) { const off = placeboOff(s), y = run(r, off).filter((t) => t.at >= K.DEC_FROM); offs.push(+off.toFixed(4)); pl.push(mean(y.map((t) => t.net))); plG.push(mean(y.map((t) => t.gross))); }
    const p95 = pctl(pl, 0.95);
    out.rules[r] = { rule: RULES[r], real: { decisive: dec, replication: rep }, control50: { decisive: summ(c50, K.DEC_FROM, endDay), replication: summ(c50, REP, K.DEC_FROM) },
      byPair, years, exits, r0Pips: r2(median(decT.map((t) => t.r0 / pipOf(t.pair)))), both: x.filter((t) => t.both).length, p: +normSf(dec.t).toFixed(5),
      placebo: { seeds: K.SEEDS, offsets: offs, means: pl.map(r3), mean: r3(mean(pl)), p95: r3(p95), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), grossMean: r3(mean(plG)), grossP95: r3(pctl(plG, 0.95)),
        rank: `${1 + pl.filter((v) => v > mean(decT.map((t) => t.net))).length}`, beats: dec.net > p95 } };
  }
  const rs = Object.keys(out.rules), ph = holm(rs.map((r) => out.rules[r].p));
  for (const [i, r] of rs.entries()) { const V = out.rules[r]; V.pHolm = +ph[i].toFixed(5);
    V.tests = { 'decisive n >= 300': V.real.decisive.n >= K.MIN_N, 'decisive net R a trade > 0': V.real.decisive.net > 0, 'replication net R a trade > 0': V.real.replication.net > 0,
      'decisive month-sum t >= 2': V.real.decisive.t >= 2, 'Holm-adjusted p < 0.05': V.pHolm < 0.05, 'beats the placebo 95th percentile': V.placebo.beats };
    V.verdict = Object.values(V.tests).every(Boolean) ? 'PASS' : 'FAIL'; }
  const sg = (z) => `${z >= 0 ? '+' : ''}${z}`;
  const nPass = rs.filter((r) => out.rules[r].verdict === 'PASS').length;
  out.verdict = `${nPass ? 'PASS' : 'FAIL'}: ${nPass} of ${rs.length} rules pass. ` + rs.map((r) => { const V = out.rules[r]; return `${r} ${V.verdict} (2016 on ${sg(V.real.decisive.net)}R a trade net, n ${V.real.decisive.n}, t ${V.real.decisive.t}; ${repShort} ${sg(V.real.replication.net)}R, n ${V.real.replication.n})`; }).join('; ');
  out.candidates = rs.map((r) => ({ rule: `${r}: ${RULES[r]}`, verdict: out.rules[r].verdict, is: out.rules[r].real.replication, oos: out.rules[r].real.decisive }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out, fs.existsSync(path.join(HERE, 'READING.md')) ? fs.readFileSync(path.join(HERE, 'READING.md'), 'utf8') : ''));
  for (const r of rs) console.log(r, JSON.stringify(out.rules[r].real), JSON.stringify(out.rules[r].control50.decisive), JSON.stringify({ ...out.rules[r].placebo, offsets: undefined, means: undefined }), out.rules[r].pHolm, out.rules[r].verdict);
  console.log(out.verdict);
}
