// Gold floor pivots as intraday support and resistance (pre-registered in PREREGISTRATION.md, 14 Nov 2026).
// node research/edge/gold-floor-pivots/run.mjs <xau-5m cache .json.gz>   (rows [t, o, h, l, c, v], OANDA mid M5; kept out of git)
// Pure pieces are exported for tests/gold-floor-pivots.test.mjs. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { foldWeekend, FIN, nights } from '../../../council/fills.mjs';

export const DAY = 86400, M5 = 300, START = 7 * 3600, END = 20 * 3600;
export const COST = 0.60, MIN_AWAY = 0.1, STOP_T1 = 0.25, STOP_T2 = 0.25, STOP_T3 = 0.2;
export const IS_FROM = Date.UTC(2016, 0, 1) / 1000, OOS_FROM = Date.UTC(2021, 0, 1) / 1000;
export const TESTS = ['T1', 'T2', 'T3'];
export const PLACEBO = { seeds: 40, lo: 0.3, hi: 0.7, need: 38 };

// UTC daily candles from M5 rows, then weekends folded into the next weekday (council/fills.mjs foldWeekend)
export function dailies(rows) {
  const out = []; let cur = null;
  for (const [t, o, h, l, c] of rows) {
    const d = Math.floor(t / DAY) * DAY;
    if (!cur || cur.time !== d) { cur = { time: d, open: o, high: h, low: l, close: c }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; }
  }
  return foldWeekend(out);
}

// levels of folded day i from day i-1 only; ATR20 = simple mean of the true range of days i-20 .. i-1
export function levelsAt(days, i) {
  if (i < 21) return null;
  const p = days[i - 1], P = (p.high + p.low + p.close) / 3;
  let s = 0;
  for (let j = i - 20; j <= i - 1; j++) s += Math.max(days[j].high - days[j].low, Math.abs(days[j].high - days[j - 1].close), Math.abs(days[j].low - days[j - 1].close));
  return { P, R1: 2 * P - p.low, S1: 2 * P - p.high, atr: s / 20, prevClose: p.close };
}

const shiftLv = (lv, off) => ({ ...lv, P: lv.P + off, R1: lv.R1 + off, S1: lv.S1 + off });

// manage one trade from bar k: { side, entry, stop, target|null, limit } ; stop first; gaps fill at the open
export function manage(bars, k, tr) {
  const dir = tr.side === 'buy' ? 1 : -1;
  for (let j = k; j < bars.length; j++) {
    const [t, o, h, l, c] = bars[j];
    const opensPast = j > k && (dir > 0 ? o <= tr.stop : o >= tr.stop);
    if (opensPast) return { ...tr, exit: o, exitT: t, how: 'stop' };
    if (dir > 0 ? l <= tr.stop : h >= tr.stop) return { ...tr, exit: tr.stop, exitT: t, how: 'stop' };
    const canTarget = tr.target != null && (j > k || !tr.limit);
    if (canTarget) {
      if (j > k && (dir > 0 ? o >= tr.target : o <= tr.target)) return { ...tr, exit: o, exitT: t, how: 'target' };
      if (dir > 0 ? h >= tr.target : l <= tr.target) return { ...tr, exit: tr.target, exitT: t, how: 'target' };
    }
    if (j === bars.length - 1) return { ...tr, exit: c, exitT: t + M5, how: 'time' };
  }
  return null;
}

// one test on one day's 07:00-20:00 UTC bars ([t, o, h, l, c]); lv = levels (maybe shifted); returns a trade or null
export function runDay(test, bars, lv) {
  if (!bars.length || !lv || !(lv.atr > 0)) return null;
  const o7 = bars[0][1], away = MIN_AWAY * lv.atr, mk = (side, entryT, entry, stop, target, limit, k) => {
    if (side === 'buy' ? !(stop < entry) : !(stop > entry)) return null;   // a stop on the losing side, or no trade
    if (target != null && (side === 'buy' ? !(target > entry) : !(target < entry))) return null;
    return manage(bars, k, { test, side, entryT, entry, stop, target, limit, risk: Math.abs(entry - stop) });
  };
  if (test === 'T1' || test === 'T2') {
    const upOk = lv.R1 - o7 >= away, dnOk = o7 - lv.S1 >= away;
    if (!upOk && !dnOk) return null;
    for (let j = 0; j < bars.length; j++) {
      const [t, o, h, l, c] = bars[j];
      if (test === 'T1') {
        const hitR = upOk && h >= lv.R1, hitS = dnOk && l <= lv.S1;
        if (!hitR && !hitS) continue;
        const sell = hitR && (!hitS || Math.abs(o - lv.R1) <= Math.abs(o - lv.S1));
        if (sell) return mk('sell', t, Math.max(lv.R1, o), lv.R1 + STOP_T1 * lv.atr, lv.P, true, j);
        return mk('buy', t, Math.min(lv.S1, o), lv.S1 - STOP_T1 * lv.atr, lv.P, true, j);
      }
      if (j === bars.length - 1) return null;   // no next open inside the window
      if (upOk && c > lv.R1) return mk('buy', bars[j + 1][0], bars[j + 1][1], lv.R1 - STOP_T2 * lv.atr, null, false, j + 1);
      if (dnOk && c < lv.S1) return mk('sell', bars[j + 1][0], bars[j + 1][1], lv.S1 + STOP_T2 * lv.atr, null, false, j + 1);
    }
    return null;
  }
  if (test === 'T3') {
    const above = o7 - lv.P >= away, below = lv.P - o7 >= away;
    if (!above && !below) return null;
    for (let j = 0; j < bars.length; j++) {
      const [t, o, h, l] = bars[j];
      if (above && l <= lv.P) return mk('buy', t, Math.min(lv.P, o), lv.P - STOP_T3 * lv.atr, lv.R1, true, j);
      if (below && h >= lv.P) return mk('sell', t, Math.max(lv.P, o), lv.P + STOP_T3 * lv.atr, lv.S1, true, j);
    }
  }
  return null;
}

// R of a closed trade: gross, financing (buys over a 22:00 UTC rollover; 0 when flat by 20:00), net at a cost multiple
export function score(tr, mult = 1) {
  const dir = tr.side === 'buy' ? 1 : -1, gross = dir * (tr.exit - tr.entry) / tr.risk;
  const nn = tr.side === 'buy' ? nights(tr.entryT, tr.exitT) : 0, fin = nn * FIN.xau.long * tr.entry / tr.risk;
  return { gross, fin, nights: nn, net: gross - mult * COST / tr.risk - fin };
}

// statistics -------------------------------------------------------------------------------------------------------
const lgamma = (z) => { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); };
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d; for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
const ibeta = (a, b, x) => { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
// one-sided p of t with df degrees of freedom (P[T >= t])
export const pOneSided = (t, df) => { const x = df / (df + t * t), tail = 0.5 * ibeta(df / 2, 0.5, x); return t >= 0 ? tail : 1 - tail; };
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; });
  return out;
}
const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t of net R summed by calendar month over every month from..to (0 where no trade)
export function monthT(trades, from, to, key = 'net') {
  const a = monthKey(from), b = monthKey(to), sums = new Array(b - a + 1).fill(0);
  for (const x of trades) { const m = monthKey(x.entryT) - a; if (m >= 0 && m < sums.length) sums[m] += x[key]; }
  const n = sums.length, mean = sums.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(sums.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// whole run on M5 rows: days -> trades per test (offsets: per-day ladder shift in ATR, or null)
export function prepare(rows) {
  const days = dailies(rows), byDay = new Map();
  for (const r of rows) { const d = Math.floor(r[0] / DAY) * DAY, s = r[0] - d; if (s >= START && s + M5 <= END) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(r); } }
  const list = [];
  for (let i = 21; i < days.length; i++) { const lv = levelsAt(days, i), bars = byDay.get(days[i].time); if (lv && bars && bars.length && days[i].time >= IS_FROM) list.push({ time: days[i].time, lv, bars }); }
  return list;
}
export function trades(list, test, offs = null, mult = 1) {
  const out = [];
  list.forEach((d, i) => { const lv = offs ? shiftLv(d.lv, offs[i] * d.lv.atr) : d.lv, tr = runDay(test, d.bars, lv); if (tr) out.push({ ...tr, ...score(tr, mult), net2: score(tr, 2).net }); });
  return out;
}
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
export function summ(tr, from, to) {
  const n = tr.length, s = (k) => tr.reduce((a, x) => a + x[k], 0);
  const mt = monthT(tr, from, to), mg = monthT(tr, from, to, 'gross');
  return { n, gross: n ? r3(s('gross') / n) : null, net: n ? r3(s('net') / n) : null, net2x: n ? r3(s('net2') / n) : null, fin: r3(s('fin')), totalNet: r2(s('net')),
    winRate: n ? r2(100 * tr.filter((x) => x.net > 0).length / n) : null, months: mt.months, tNet: r2(mt.t), tGross: r2(mg.t), rawT: mt.t,
    stops: tr.filter((x) => x.how === 'stop').length, targets: tr.filter((x) => x.how === 'target').length, time: tr.filter((x) => x.how === 'time').length };
}

function main(file) {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
  const list = prepare(rows), last = list[list.length - 1].time;
  const isL = list.filter((d) => d.time < OOS_FROM), oosEnd = last + DAY - 1;
  const res = {}, ps = [];
  for (const T of TESTS) {
    const all = trades(list, T), is = all.filter((x) => x.entryT < OOS_FROM), oos = all.filter((x) => x.entryT >= OOS_FROM);
    const S = { is: summ(is, IS_FROM, OOS_FROM - 1), oos: summ(oos, OOS_FROM, oosEnd) };
    S.bySide = Object.fromEntries(['buy', 'sell'].flatMap((sd) => [[`is_${sd}`, summ(is.filter((x) => x.side === sd), IS_FROM, OOS_FROM - 1)], [`oos_${sd}`, summ(oos.filter((x) => x.side === sd), OOS_FROM, oosEnd)]]));
    S.p = pOneSided(S.oos.rawT, S.oos.months - 1); ps.push(S.p); res[T] = S;
  }
  const hp = holm(ps);
  // placebo: one offset a day (0.3-0.7 x ATR, random sign), shared by the three tests within a seed
  const plc = Object.fromEntries(TESTS.map((T) => [T, []]));
  for (let s = 1; s <= PLACEBO.seeds; s++) {
    const rnd = mulberry32(1000 + s), offs = list.map(() => (rnd() < 0.5 ? -1 : 1) * (PLACEBO.lo + (PLACEBO.hi - PLACEBO.lo) * rnd()));
    for (const T of TESTS) { const o = trades(list, T, offs).filter((x) => x.entryT >= OOS_FROM); plc[T].push({ net: o.length ? o.reduce((a, x) => a + x.net, 0) / o.length : 0, gross: o.length ? o.reduce((a, x) => a + x.gross, 0) / o.length : 0, n: o.length }); }
  }
  const tests = {};
  TESTS.forEach((T, i) => {
    const S = res[T], pl = plc[T], beaten = pl.filter((x) => S.oos.net > x.net).length, sorted = pl.map((x) => x.net).sort((a, b) => a - b);
    const checks = { oosNet: S.oos.net > 0, tHolm: S.oos.rawT >= 2 && hp[i] < 0.05, isNet: S.is.net > 0, cost2x: S.oos.net2x > 0, placebo: beaten >= PLACEBO.need, n: S.oos.n >= 30 };
    for (const k of ['is', 'oos']) delete S[k].rawT; for (const k in S.bySide) delete S.bySide[k].rawT;
    tests[T] = { ...S, p: +S.p.toPrecision(4), holmP: +hp[i].toPrecision(4), placebo: { beaten, of: pl.length, mean: r3(pl.reduce((a, x) => a + x.net, 0) / pl.length), p95: r3(sorted[Math.floor(0.95 * (pl.length - 1))]), min: r3(sorted[0]), max: r3(sorted[sorted.length - 1]), grossMean: r3(pl.reduce((a, x) => a + x.gross, 0) / pl.length) }, checks, pass: Object.values(checks).every(Boolean) };
  });
  const passed = TESTS.filter((T) => tests[T].pass);
  const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const out = {
    topic: 'gold-floor-pivots', built: '2026-11-14', verdict: passed.length ? 'PASS' : 'FAIL', passed,
    data: { src: 'OANDA mid M5 XAU_USD via the site proxy (study cache, out of git)', from: iso(list[0].time), to: iso(last), days: list.length, isDays: isL.length },
    windows: { is: ['2016-01-01', '2020-12-31'], oos: ['2021-01-01', iso(last)] },
    rules: { costUsd: COST, finRateLong: FIN.xau.long, minAway: MIN_AWAY, stops: { T1: STOP_T1, T2: STOP_T2, T3: STOP_T3 }, window: '07:00-20:00 UTC', placebo: PLACEBO },
    tests,
  };
  const dir = new URL('.', import.meta.url);
  fs.writeFileSync(new URL('result.json', dir), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(new URL('RESULT.md', dir), report(out));
  console.log(JSON.stringify({ verdict: out.verdict, ...Object.fromEntries(TESTS.map((T) => [T, { is: tests[T].is, oos: tests[T].oos, holmP: tests[T].holmP, placebo: tests[T].placebo }])) }, null, 1));
}

const sg = (x) => (x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3));
const tg = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
const NAME = { T1: 'T1 fade R1 / S1 to P', T2: 'T2 break of R1 / S1, held to 20:00', T3: 'T3 bounce off P to R1 / S1' };
export function report(r) {
  const T = r.tests, t1 = T.T1.oos;
  const why = r.verdict === 'PASS' ? `${r.passed.join(', ')} met every check` : `fading R1/S1 made ${sg(t1.net)}R a trade net out of sample (n ${t1.n}, month t ${tg(t1.tNet)}); 0 of 3 tests pass`;
  const L = [];
  L.push('# Gold floor pivots as intraday support and resistance: result (14 Nov 2026)', '');
  L.push(`**Verdict: ${r.verdict}: ${why}.**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (pushed before any candle was read). OANDA mid M5 gold, ${r.data.from} to ${r.data.to} (${r.data.days} trading days); in sample 2016-20, out of sample 2021 to ${r.data.to}. Levels from the previous folded UTC day (P = (H+L+C)/3, R1 = 2P - L, S1 = 2P - H), ATR20 of folded days, trading window 07:00-20:00 UTC, a level used only when 0.1 x ATR or more from the 07:00 open, one trade per test a day. Costs $0.60 a round trip in R of each trade's own risk; financing on buys over a rollover is counted and is 0 (every trade is flat by 20:00 UTC). t on calendar-month sums of net R, Holm over the three tests; placebo = the ladder shifted each day by a random 0.3-0.7 x ATR, 40 seeds.`, '');
  L.push('A stand-alone rule: never a gate, exit, entry or size of the live gold book, and nothing live changed.', '');
  L.push('## The three tests', '');
  L.push('| Test | Window | n | Gross R a trade | Net R a trade | Net at 2x costs | t months (net) | t months (gross) | Total net R | Win rate | Stop / target / time |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) { const s = T[k][w]; L.push(`| ${NAME[k]} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${s.n} | ${sg(s.gross)} | ${sg(s.net)} | ${sg(s.net2x)} | ${tg(s.tNet)} | ${tg(s.tGross)} | ${s.totalNet} | ${s.winRate} % | ${s.stops} / ${s.targets} / ${s.time} |`); }
  L.push('', '## By side (net R a trade, n)', '', '| Test | IS buy | IS sell | OOS buy | OOS sell |', '|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3']) { const b = T[k].bySide; L.push(`| ${k} | ${sg(b.is_buy.net)} (${b.is_buy.n}) | ${sg(b.is_sell.net)} (${b.is_sell.n}) | ${sg(b.oos_buy.net)} (${b.oos_buy.n}) | ${sg(b.oos_sell.net)} (${b.oos_sell.n}) |`); }
  L.push('', '## The pass bar', '', '| Test | OOS net > 0 | t >= 2 and Holm p < 0.05 | IS net > 0 | 2x costs > 0 | beats >= 38 of 40 placebos | OOS n >= 30 | p (one-sided) | Holm p | Verdict |', '|---|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of ['T1', 'T2', 'T3']) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.oosNet)} | ${yn(c.tHolm)} | ${yn(c.isNet)} | ${yn(c.cost2x)} | ${yn(c.placebo)} | ${yn(c.n)} | ${T[k].p} | ${T[k].holmP} | ${T[k].pass ? 'PASS' : 'FAIL'} |`); }
  L.push('', '## Placebo (out of sample, 40 seeds)', '', '| Test | Real net | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Placebos beaten |', '|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3']) { const p = T[k].placebo; L.push(`| ${k} | ${sg(T[k].oos.net)} | ${sg(p.mean)} | ${sg(p.p95)} | ${sg(p.min)} to ${sg(p.max)} | ${sg(T[k].oos.gross)} | ${sg(p.grossMean)} | ${p.beaten} of ${p.of} |`); }
  L.push('', '## Reading', '');
  L.push(...readingLines(r));
  L.push('', 'To repeat: build the M5 cache (rows [t, o, h, l, c, v] from the site candle proxy, gzip JSON, outside git), then `node research/edge/gold-floor-pivots/run.mjs <cache>`. Tests: `tests/gold-floor-pivots.test.mjs`.', '');
  return L.join('\n');
}
function readingLines(r) {
  const T = r.tests, out = [];
  for (const k of ['T1', 'T2', 'T3']) {
    const s = T[k], pl = s.placebo;
    out.push(`- ${NAME[k]}: out of sample ${sg(s.oos.gross)}R gross, ${sg(s.oos.net)}R net a trade (n ${s.oos.n}, month t ${tg(s.oos.tNet)}); in sample ${sg(s.is.net)}R net (n ${s.is.n}). The real ladder beats ${pl.beaten} of ${pl.of} shifted ladders (placebo mean ${sg(pl.mean)}R).`);
  }
  out.push(`- ${r.verdict === 'PASS' ? 'A pass on this bar is one stand-alone paper result, not an edge of the gold book; it would need its own forward record before any use.' : 'Not an edge. The levels are neither a fade nor a break worth trading on gold after costs; nothing is proposed and nothing live changed.'}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv[2] || '/tmp/xau-5m-vol.json.gz');
