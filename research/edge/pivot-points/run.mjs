// Edge research · pivot-points: classic floor-trader pivots (P, R1, S1, R2, S2 of the prior day) as intraday support and
// resistance on ten markets. T1 fades the first touch of R1 / S1 to P; T2 follows the first M5 close beyond R1 / S1 to R2 / S2.
// Rules, costs and the pass bar: PREREGISTRATION.md (committed and pushed before this file read any candle). Paper research
// only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir> [m1,m2]   -> <dir>/<market>-5m.json.gz (OANDA mid M5 from 2015-11-01, out of git)
//   node run.mjs full <dir>                            -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// ─── the pre-registered market set, sessions and costs ───
export const MARKETS = {
  spx500: { group: 'indices', tz: 'America/New_York', open: 570, close: 960, full: 78, cost: 0.0004 },
  nas100: { group: 'indices', tz: 'America/New_York', open: 570, close: 960, full: 78, cost: 0.0004 },
  us30: { group: 'indices', tz: 'America/New_York', open: 570, close: 960, full: 78, cost: 0.0004 },
  de40: { group: 'indices', tz: 'Europe/Berlin', open: 540, close: 1050, full: 102, cost: 0.0004 },
  uk100: { group: 'indices', tz: 'Europe/London', open: 480, close: 990, full: 102, cost: 0.0004 },
  eurusd: { group: 'forex', tz: 'America/New_York', nyDay: true, full: 288, cost: 0.00015 },
  gbpusd: { group: 'forex', tz: 'America/New_York', nyDay: true, full: 288, cost: 0.00015 },
  usdjpy: { group: 'forex', tz: 'America/New_York', nyDay: true, full: 288, cost: 0.00015 },
  audusd: { group: 'forex', tz: 'America/New_York', nyDay: true, full: 288, cost: 0.00015 },
  xag: { group: 'metals', tz: 'America/New_York', nyDay: true, full: 288, cost: 0.001 },
};
export const GROUPS = ['all', 'indices', 'forex', 'metals'];
export const K = { M5: 300, VALID: 0.8, ATR_N: 14, T1_STOP: 0.25, T2_STOP: 0.1, SEEDS: 40, U_LO: 0.3, U_HI: 0.7, MIN_N: 300,
  DATA_FROM: Date.UTC(2015, 10, 1) / 1000, IS_FROM: Date.UTC(2016, 0, 1) / 1000, OOS_FROM: Date.UTC(2021, 0, 1) / 1000, END: Date.UTC(2026, 10, 14) / 1000, EPS: 1e-12 };
export const RULES = { T1: 'fade: limit at the first touch of R1 (sell) or S1 (buy), stop 0.25 x ATR(14) past the level, target P, flat at session end',
  T2: 'break: first M5 close beyond R1 (buy) or S1 (sell), market at the next open, stop 0.1 x ATR(14) back past the level, target R2 / S2, flat at session end' };

// ─── time zones: the UTC offset of a zone, read once per UTC day at 12:00 UTC (every transition is on a closed weekend hour) ───
const OFF = new Map();
export function tzOff(tz, t) {
  const d = Math.floor(t / 86400), k = tz + d; let o = OFF.get(k);
  if (o == null) {
    const p = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date((d * 86400 + 43200) * 1000))) p[x.type] = x.value;
    o = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) / 1000 - (d * 86400 + 43200); OFF.set(k, o);
  }
  return o;
}
// session key of a candle (null = outside the session): forex / silver the 17:00 New York day, indices the local cash session
export function sessionKey(M, t) {
  const loc = t + tzOff(M.tz, t);
  if (M.nyDay) return Math.floor((loc + 7 * 3600) / 86400);
  const min = Math.floor((loc % 86400) / 60);
  return min >= M.open && min < M.close ? Math.floor(loc / 86400) : null;
}
// candles (arrays of t,o,h,l,c) -> valid sessions { key, a, b, o, h, l, c } (a..b-1 index the candles)
export function sessions(M, B) {
  const out = []; let cur = null;
  for (let i = 0; i < B.t.length; i++) {
    const k = sessionKey(M, B.t[i]);
    if (k == null) continue;
    if (cur && cur.key === k && i === cur.b) { cur.b = i + 1; if (B.h[i] > cur.h) cur.h = B.h[i]; if (B.l[i] < cur.l) cur.l = B.l[i]; cur.c = B.c[i]; continue; }
    if (cur) out.push(cur);
    cur = { key: k, a: i, b: i + 1, o: B.o[i], h: B.h[i], l: B.l[i], c: B.c[i] };
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.b - s.a >= K.VALID * M.full);
}
// ─── levels: P, R1, S1, R2, S2 of the prior valid session; ATR(14) of the 14 valid sessions before ───
export function pivots(H, L, C) { const P = (H + L + C) / 3; return { P, R1: 2 * P - L, S1: 2 * P - H, R2: P + (H - L), S2: P - (H - L) }; }
export function plans(S) {
  const out = [];
  for (let k = K.ATR_N + 1; k < S.length; k++) {
    const pr = S[k - 1]; if (!(pr.h > pr.l)) continue;
    let tr = 0; for (let j = k - K.ATR_N; j < k; j++) tr += Math.max(S[j].h - S[j].l, Math.abs(S[j].h - S[j - 1].c), Math.abs(S[j].l - S[j - 1].c));
    out.push({ s: S[k], lv: pivots(pr.h, pr.l, pr.c), atr: tr / K.ATR_N });
  }
  return out;
}
export const shift = (lv, d) => ({ P: lv.P + d, R1: lv.R1 + d, S1: lv.S1 + d, R2: lv.R2 + d, S2: lv.S2 + d });

// ─── one session, one rule (flat at the session's last close; one position at a time; each level fires once) ───
function exitOn(B, pos, j) {
  const E = K.EPS, sd = pos.side, o = B.o[j];
  if (j > pos.i || pos.mkt) {   // an open beyond the stop / target fills at the open (on a T2 entry candle the open IS the entry)
    if (j > pos.i && (sd > 0 ? o <= pos.stop + E : o >= pos.stop - E)) return { kind: 'stop', px: o };
    if (j > pos.i && (sd > 0 ? o >= pos.target - E : o <= pos.target + E)) return { kind: 'target', px: o };
  }
  if (sd > 0 ? B.l[j] <= pos.stop + E : B.h[j] >= pos.stop - E) return { kind: 'stop', px: pos.stop };
  if ((j > pos.i || pos.mkt) && (sd > 0 ? B.h[j] >= pos.target - E : B.l[j] <= pos.target + E)) return { kind: 'target', px: pos.target };
  return null;
}
export function runSession(rule, B, s, lv, atr) {
  const out = [], o0 = B.o[s.a];
  let rS = !(o0 < lv.R1), sS = !(o0 > lv.S1), pos = null;   // spent / void flags
  const close = (j, ex) => { out.push({ ...pos, exit: ex.kind, exitPx: ex.px, exitAt: B.t[j] }); pos = null; };
  for (let j = s.a; j < s.b; j++) {
    let busy = false;
    if (pos && j >= pos.i) { busy = true; const ex = exitOn(B, pos, j); if (ex) close(j, ex); }
    if (pos && j < pos.i) busy = true;
    if (rule === 'T1') {
      const tr = !rS && B.h[j] >= lv.R1, ts = !sS && B.l[j] <= lv.S1;
      if (tr) rS = true; if (ts) sS = true;
      if (busy || (tr && ts)) continue;
      if (tr) pos = { side: -1, entry: lv.R1, stop: lv.R1 + K.T1_STOP * atr, target: lv.P, i: j, at: B.t[j], mkt: false };
      else if (ts) pos = { side: 1, entry: lv.S1, stop: lv.S1 - K.T1_STOP * atr, target: lv.P, i: j, at: B.t[j], mkt: false };
      if (pos) { const ex = exitOn(B, pos, j); if (ex) close(j, ex); }
    } else {
      const tr = !rS && B.c[j] > lv.R1, ts = !sS && B.c[j] < lv.S1;
      if (tr) rS = true; if (ts) sS = true;
      if (busy || j + 1 >= s.b || !(tr || ts)) continue;
      const side = tr ? 1 : -1, e = B.o[j + 1], stop = tr ? lv.R1 - K.T2_STOP * atr : lv.S1 + K.T2_STOP * atr, target = tr ? lv.R2 : lv.S2;
      if (side > 0 ? e >= target || e <= stop : e <= target || e >= stop) continue;
      pos = { side, entry: e, stop, target, i: j + 1, at: B.t[j + 1], mkt: true };
    }
  }
  if (pos) close(s.b - 1, { kind: 'time', px: B.c[s.b - 1] });
  return out;
}
export function book(mk, rule, t, mult = 1) {
  const M = MARKETS[mk], r0 = Math.abs(t.entry - t.stop), gross = t.side * (t.exitPx - t.entry) / r0, c = M.cost * t.entry / r0;
  return { mk, group: M.group, rule, at: t.at, side: t.side, entry: t.entry, stop: t.stop, target: t.target, r0, exit: t.exit, gross, net: gross - c * mult, net2: gross - 2 * c * mult };
}
// every trade of one market and rule; `rand` (optional) shifts each session's ladder by s x u x (R1 - P)
export function tradesOf(mk, B, rule, P, rand) {
  const out = [];
  for (const p of P) {
    let lv = p.lv;
    if (rand) { const u = K.U_LO + (K.U_HI - K.U_LO) * rand(), sg = rand() < 0.5 ? -1 : 1; lv = shift(lv, sg * u * (lv.R1 - lv.P)); }
    for (const t of runSession(rule, B, p.s, lv, p.atr)) out.push(book(mk, rule, t));
  }
  return out;
}

// seeded uniform draws in [0, 1) (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ─── statistics ───
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
  const x = trades.filter((t) => t.at >= from && t.at < to);
  return { n: x.length, gross: r3(mean(x.map((t) => t.gross))), net: r3(mean(x.map((t) => t.net))), net2: r3(mean(x.map((t) => t.net2))),
    total: r2(x.reduce((s, t) => s + t.net, 0)), win: x.length ? r3(x.filter((t) => t.net > 0).length / x.length) : 0,
    months: monthT(x, from, to).months, t: r2(monthT(x, from, to).t), tGross: r2(monthT(x, from, to, 'gross').t), t2: r2(monthT(x, from, to, 'net2').t) };
}
export function pctl(a, q) { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }
export const inGroup = (g) => (t) => g === 'all' || t.group === g;

// ─── the report, written from result.json ───
export function report(R) {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, L = [], ids = Object.keys(R.tests);
  L.push('# Floor-trader pivot points as intraday support and resistance: result', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Ten markets (${R.markets.join(', ')}), OANDA mid M5;`,
    `in sample ${R.window.is}, out of sample ${R.window.oos}. Levels from the prior day: the 17:00 New York day for forex and silver, the prior`,
    'cash session for indices (US 09:30-16:00 New York, DAX 09:00-17:30 Frankfurt, FTSE 08:00-16:30 London). Gold left out (item 44).',
    `Costs: ${R.costs}. t on calendar-month sums; Holm over the eight tests; placebo = the whole ladder shifted by a random 0.3-0.7 x (R1 - P), 40 seeds.`,
    'Paper research only: nothing live changed.', '');
  L.push('## The eight tests', '', '| Test | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const id of ids) for (const w of ['is', 'oos']) { const s = R.tests[id][w]; L.push(`| ${id} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${s.t.toFixed(2)} | ${s.tGross.toFixed(2)} | ${f(s.total, 1)} | ${(s.win * 100).toFixed(1)} % | ${f(s.net2)} |`); }
  L.push('', Object.entries(RULES).map(([r, x]) => `${r}: ${x}.`).join(' '));
  const cols = Object.keys(R.tests[ids[0]].checks);
  L.push('', '## The pass bar (T1 all = primary; the rest secondary)', '', `| Test | Verdict | ${cols.join(' | ')} | p (one-sided) | Holm p |`, `|---|---|${cols.map(() => '---').join('|')}|---|---|`);
  for (const id of ids) { const V = R.tests[id]; L.push(`| ${id} | ${V.verdict} | ${Object.values(V.checks).map((x) => (x ? 'yes' : 'no')).join(' | ')} | ${V.p} | ${V.pHolm} |`); }
  L.push('', '## Placebo: ladder shifted by 0.3-0.7 x (R1 - P), out of sample, 40 seeds', '', '| Test | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Real rank among 41 |', '|---|---|---|---|---|---|---|---|');
  for (const id of ids) { const V = R.tests[id], P = V.placebo; L.push(`| ${id} | ${f(V.oos.net)} | ${f(P.mean)} | ${f(P.p95)} | ${f(P.min)} to ${f(P.max)} | ${f(V.oos.gross)} | ${f(P.grossMean)} | ${P.rank} |`); }
  L.push('', '## Per market (net R a trade, n, t on months)', '', '| Rule | Market | IS net | n | IS gross | t | OOS net | n | OOS gross | t |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of Object.keys(RULES)) for (const m of R.markets) { const a = R.byMarket[r][m].is, b = R.byMarket[r][m].oos; L.push(`| ${r} | ${m} | ${f(a.net)} | ${a.n} | ${f(a.gross)} | ${a.t.toFixed(2)} | ${f(b.net)} | ${b.n} | ${f(b.gross)} | ${b.t.toFixed(2)} |`); }
  L.push('', '## By year, all markets (net R a trade / total net R, n)', '', '| Year | T1 | T2 |', '|---|---|---|');
  for (const y of Object.keys(R.years.T1)) L.push(`| ${y} | ` + ['T1', 'T2'].map((r) => { const s = R.years[r][y]; return `${f(s.net)} / ${f(s.total, 1)} (n ${s.n})`; }).join(' | ') + ' |');
  L.push('', '## Exits, out of sample', '', ...Object.keys(RULES).map((r) => `- ${r}: ` + Object.entries(R.exits[r]).map(([k, n]) => `${k} ${n}`).join(', ')));
  L.push('', '## Data', '', '| Market | Candles | First | Last | Valid sessions |', '|---|---|---|---|---|');
  for (const m of R.markets) { const q = R.funnel[m]; L.push(`| ${m} | ${q.candles} | ${q.from} | ${q.to} | ${q.sessions} |`); }
  if (R.reading) L.push('', ...R.reading);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/pivot-points/run.mjs fetch <dir>` (candles outside git), then `node research/edge/pivot-points/run.mjs full <dir>`. Tests: `tests/pivot-points.test.mjs`.', '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(sym, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * K.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`${sym} 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(120); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
export function toCols(rows) { const n = rows.length, B = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n) }; rows.forEach((r, i) => { B.t[i] = r[0]; B.o[i] = r[1]; B.h[i] = r[2]; B.l[i] = r[3]; B.c[i] = r[4]; }); return B; }
const load = (dir, m) => toCols(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${m}-5m.json.gz`)))));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  const list = process.argv[4] ? process.argv[4].split(',') : Object.keys(MARKETS);
  await Promise.all([0, 1, 2].map(async (w) => { for (let k = w; k < list.length; k += 3) { const m = list[k], f = path.join(OUT, `${m}-5m.json.gz`); if (fs.existsSync(f)) continue;
    const rows = await range(m, K.DATA_FROM, K.END); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`${m}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); } }));
}
if (MODE === 'full') {
  const DIR = process.argv[3], MK = Object.keys(MARKETS), data = {}, plan = {}, funnel = {};
  for (const m of MK) { data[m] = load(DIR, m); const S = sessions(MARKETS[m], data[m]); plan[m] = plans(S);
    funnel[m] = { candles: data[m].t.length, from: iso(data[m].t[0]), to: iso(data[m].t.at(-1)), sessions: S.length }; }
  const W = { is: [K.IS_FROM, K.OOS_FROM], oos: [K.OOS_FROM, K.END] }, inWin = (t) => t.at >= K.IS_FROM && t.at < K.END;
  const all = {}; for (const r of Object.keys(RULES)) all[r] = MK.flatMap((m) => tradesOf(m, data[m], r, plan[m])).filter(inWin).sort((a, b) => a.at - b.at);
  // placebo: per seed, per market its own stream rng(seed x 100 + market number), one draw pair per session in order
  const pl = {}; for (const r of Object.keys(RULES)) pl[r] = Object.fromEntries(GROUPS.map((g) => [g, { net: [], gross: [] }]));
  for (let s = 1; s <= K.SEEDS; s++) for (const r of Object.keys(RULES)) {
    const x = MK.flatMap((m, i) => tradesOf(m, data[m], r, plan[m], rng(s * 100 + i + 1))).filter((t) => t.at >= K.OOS_FROM && t.at < K.END);
    for (const g of GROUPS) { const y = x.filter(inGroup(g)); pl[r][g].net.push(mean(y.map((t) => t.net))); pl[r][g].gross.push(mean(y.map((t) => t.gross))); }
  }
  const out = { topic: 'pivot-points', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Classic floor-trader pivots (prior-day P, R1, S1, R2, S2): fade R1 / S1 to P, or follow a close beyond them to R2 / S2; ten markets, OANDA mid M5',
    window: { is: '2016-01-01 to 2020-12-31', oos: `2021-01-01 to ${iso(K.END - 86400).slice(0, 10)}` }, params: K, markets: MK, funnel,
    costs: 'round trip forex 0.015 %, indices 0.04 %, silver 0.10 % of the entry price, in R by each trade\'s own risk; no financing (every trade is flat before its session ends)', tests: {} };
  for (const r of Object.keys(RULES)) for (const g of GROUPS) {
    const x = all[r].filter(inGroup(g)), oos = summ(x, ...W.oos), P = pl[r][g], p95 = pctl(P.net, 0.95);
    out.tests[`${r} ${g}`] = { rule: r, group: g, is: summ(x, ...W.is), oos, p: +normSf(oos.t).toFixed(5),
      placebo: { seeds: K.SEEDS, means: P.net.map(r3), mean: r3(mean(P.net)), p95: r3(p95), min: r3(Math.min(...P.net)), max: r3(Math.max(...P.net)), grossMean: r3(mean(P.gross)), rank: 1 + P.net.filter((v) => v > oos.net).length, beats: oos.net > p95 } };
  }
  const ids = Object.keys(out.tests), ph = holm(ids.map((id) => out.tests[id].p));
  ids.forEach((id, i) => { const V = out.tests[id]; V.pHolm = +ph[i].toFixed(5);
    V.checks = { 'OOS n >= 300': V.oos.n >= K.MIN_N, 'OOS net > 0': V.oos.net > 0, 'OOS month t >= 2': V.oos.t >= 2, 'Holm p < 0.05': V.pHolm < 0.05,
      'IS net > 0': V.is.net > 0, 'OOS net at 2x costs > 0': V.oos.net2 > 0, 'above placebo 95th pct': V.placebo.beats };
    V.verdict = Object.values(V.checks).every(Boolean) ? 'PASS' : 'FAIL'; });
  out.byMarket = {}; out.years = {}; out.exits = {};
  for (const r of Object.keys(RULES)) {
    out.byMarket[r] = Object.fromEntries(MK.map((m) => [m, { is: summ(all[r].filter((t) => t.mk === m), ...W.is), oos: summ(all[r].filter((t) => t.mk === m), ...W.oos) }]));
    out.years[r] = {}; for (let y = 2016; y <= 2026; y++) { const s = summ(all[r], Date.UTC(y, 0, 1) / 1000, Math.min(Date.UTC(y + 1, 0, 1) / 1000, K.END)); out.years[r][y] = { n: s.n, net: s.net, total: s.total }; }
    out.exits[r] = {}; for (const t of all[r]) if (t.at >= K.OOS_FROM) out.exits[r][t.exit] = (out.exits[r][t.exit] || 0) + 1;
  }
  const T1 = out.tests['T1 all'], sg = (z) => `${z >= 0 ? '+' : ''}${z}`, nPass = ids.filter((id) => out.tests[id].verdict === 'PASS');
  out.verdict = `${T1.verdict}: fading R1/S1 to P made ${sg(T1.oos.net)}R a trade net out of sample (n ${T1.oos.n}, t ${T1.oos.t}; in sample ${sg(T1.is.net)}R); placebo 95th pct ${sg(T1.placebo.p95)}R; ${nPass.length} of 8 tests pass.`;
  out.candidates = ids.map((id) => ({ rule: `${id}: ${RULES[out.tests[id].rule]}`, verdict: out.tests[id].verdict, is: out.tests[id].is, oos: out.tests[id].oos }));
  const RD = path.join(HERE, 'READING.md'); if (fs.existsSync(RD)) out.reading = fs.readFileSync(RD, 'utf8').trim().split('\n');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  for (const id of ids) { const V = out.tests[id]; console.log(id, JSON.stringify(V.is), JSON.stringify(V.oos), JSON.stringify({ ...V.placebo, means: undefined }), V.pHolm, V.verdict); }
  console.log(out.verdict, out.verdict.length);
}
