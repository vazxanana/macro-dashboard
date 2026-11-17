// Edge research · geg-silver: the live Gold daily engulf rule (council/trader.mjs block config.goldEG, trading days since 12 Nov 2026)
// on silver, as pre-registered in PREREGISTRATION.md (committed alone before this file). The harness is the geg block and the
// management loop of research/edge/gold-weekend/replay-intended.mjs, run alone, with council/fills.mjs foldWeekend for the days.
//   node run.mjs <candle dir> > result.json        (candles from fetch.mjs: xag-5m / xag-1d / xau-5m / xau-1d .json.gz)
// Pure pieces are exported for tests/geg-silver.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { stopFill, exitR, fillBarAmbiguous, spotSkip, spotClosed, foldWeekend, nights } from '../../../council/fills.mjs';

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const EG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 };   // config.goldEG (trader.mjs USER_RULES 'gold-daily-engulf')
// silver, fixed in PREREGISTRATION.md before any run
export const SILVER = { pad: 0.004, dp: 4, costPct: 0.001, finNight: 0.00015 };
export const GOLD_GATE = { pad: 0.3, dp: 2, costAbs: 0.3, finNight: 0, end: T('2026-11-07'),
  ref: { oos: { from: '2006-07-01', to: '2018-01-01', n: 247, mean: 0.207 }, cal: { from: '2018-01-01', to: '2026-11-07', n: 176, mean: 0.326 } }, tolN: 0.03, tolMean: 0.03 };
export const WINDOWS = { rep: ['2006-07-01', '2020-01-01'], is: ['2020-01-01', '2024-01-01'], oos: ['2024-01-01', '2026-11-17'] };
const FIRST_ENTRY = T('2006-07-01'), START = T('2006-03-20');

// ─── management: the live "Manage open trades" loop for one M5 candle (gold-weekend replay-intended.mjs manage, buys only) ───
function manage(tr, b, skip, fx) {
  if (skip) return;
  if (tr.status === 'pending') {
    if (b.low <= tr.entry) {
      if (fillBarAmbiguous(b, false, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; tr.exit = 'fill and target in one candle'; return; }
      tr.status = 'open'; tr.filled = b.time;
    } else if (b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; return; }
    else return;
  }
  const r0 = tr.r0;
  if (b.low <= tr.stop) {
    const px = stopFill(b, false, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
    if (tr.trail && tr.trailMoved) { tr.R = exitR(false, tr.entry, px, r0); tr.exit = 'trailing stop'; }
    else { tr.R = gapped ? exitR(false, tr.entry, px, r0) : -1; tr.exit = 'stop'; }
    tr.exitPx = px; tr.status = 'closed'; tr.closed = b.time; return;
  }
  if (b.high >= tr.t1) { tr.status = 'closed'; tr.closed = b.time; tr.R = tr.rr; tr.exitPx = tr.t1; tr.exit = 'target'; return; }
  if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { tr.R = +((b.close - tr.entry) / r0).toFixed(2); tr.status = 'closed'; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; tr.exitPx = b.close; return; }
  tr.mfe = +Math.max(tr.mfe || 0, (b.high - tr.entry) / r0).toFixed(2);
  if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = tr.entry + (tr.mfe - tr.trail[1]) * r0; if (ns > tr.stop) { tr.stop = fx(ns); tr.trailMoved = true; } }
}
const isLive = (x) => x.status === 'open' || x.status === 'pending';

// ─── the replay: one run at the close of every M5 candle (gold-weekend replay-intended.mjs, geg block only) ───
export function simulate(M5, D1raw, { pad, dp, maxOpen = EG.maxOpen, key = 'm' }) {
  const fx = (v) => +v.toFixed(dp), NM = M5.length, D1 = foldWeekend(D1raw);
  const SKIP = new Uint8Array(NM); for (let i = 0; i < NM; i++) SKIP[i] = spotSkip(M5[i].time) ? 1 : 0;
  let p = 0; const nd1 = (c) => { while (p < D1.length && D1[p].time + 86400 <= c) p++; return p; };
  const REOPEN = new Float64Array(D1.length); { let q0 = 0;
    for (let i = 0; i < D1.length; i++) { const e = D1[i].time + 86400; while (q0 < NM && M5[q0].time < e) q0++; let q = q0; while (q < NM && spotClosed(M5[q].time)) q++; REOPEN[i] = q < NM ? M5[q].time : e; } }
  const trades = [], ids = new Set(); let book = [];
  for (let j = 0; j < NM - 1; j++) {
    const c = M5[j].time + 300, now = c + 240;
    for (const tr of book) { for (let i = tr.ptr; i <= j && isLive(tr); i++) { manage(tr, M5[i], SKIP[i], fx); tr.ptr = i + 1; } if (tr.ptr <= j) tr.ptr = j + 1; }
    for (const tr of book) if (tr.status === 'pending' && now - tr.opened > tr.validFor) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
    book = book.filter(isLive);
    if (M5[j].time < START) continue;
    const nd = nd1(c);
    if (nd < 40) continue;
    const hasEntry = M5[j + 1].time === c, price = hasEntry ? M5[j + 1].close : M5[j].close, k0 = j + 2;
    const canEnterW = hasEntry && now >= FIRST_ENTRY && !spotClosed(M5[j + 1].time);
    const last = D1[nd - 1], n = Math.min(nd, 719);
    const mine = book;
    for (const tr of mine.filter((x) => x.status === 'pending')) if (tr.zone && last.time > (tr.lastD || 0) && last.close < tr.zone[0]) { tr.status = 'expired'; tr.closed = now; tr.R = 0; tr.exit = 'zone failed'; }
    for (const tr of mine.filter((x) => x.status === 'pending')) tr.lastD = last.time;
    if (n > EG.sma + EG.k + 2 && now - REOPEN[nd - 1] < 86400) {
      let sma = 0; for (let q = nd - EG.sma; q < nd; q++) sma += D1[q].close; sma /= EG.sma; const up = last.close > sma;
      let base = null;
      if (last.close > last.open) for (let q = nd - 2; q >= nd - 1 - EG.k && q >= 0; q--) { const b = D1[q]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } if (b.close < b.open) break; }
      const id = base ? `${key}-geg-${base.time}` : null;
      const openCnt = mine.filter(isLive).length;
      if (base && up && !ids.has(id) && openCnt < maxOpen && canEnterW) {
        const entry = fx(base.high), stop = fx(base.low - pad), r0 = entry - stop;
        if (r0 > 0 && price > entry) { const t = { id, k: 'geg', side: 'buy', entry, stop, t1: fx(entry + 10 * r0), rr: 10, trail: [2, 1], opened: now, status: 'pending', R: null, r0, validFor: EG.life * 86400, maxHold: EG.hold * 3600,
          zone: [fx(base.low), fx(base.high)], lastD: last.time, ptr: k0 }; trades.push(t); ids.add(id); book.push(t); }
      }
    }
  }
  const lastBar = M5[NM - 1];
  for (const tr of book) { if (tr.status === 'pending') { tr.status = 'expired'; tr.R = 0; } else { tr.R = +((lastBar.close - tr.entry) / tr.r0).toFixed(2); tr.exit = 'end (marked)'; tr.status = 'closed'; tr.atEnd = true; } tr.closed = lastBar.time; }
  return trades.map(({ ptr, ...t }) => t);
}

// ─── positions and statistics ───
export function positions(legs, { costAbs = null, costPct = null, finNight = 0 }) {
  return legs.filter((x) => x.status === 'closed').map((x) => {
    const cost = costAbs != null ? costAbs / x.r0 : costPct * x.entry / x.r0, nn = nights(x.filled, x.closed), fin = finNight * nn * x.entry / x.r0;
    return { id: x.id, t: x.filled, c: x.closed, r0: x.r0, entry: x.entry, exit: x.exit, atEnd: !!x.atEnd, g: x.R, n: x.R - cost - fin, n2: x.R - 2 * cost - fin, n0: x.R - cost, fin, nights: nn };
  }).sort((a, b) => a.t - b.t);
}
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
export function stats(rows, key = 'n') {
  const a = rows.slice().sort((x, y) => x.c - y.c), v = a.map((x) => x[key]), n = v.length;
  if (!n) return { n: 0 };
  const R = v.reduce((p, x) => p + x, 0), mean = R / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
  return { n, win: r3(v.filter((x) => x > 0).length / n), mean: r3(mean), R: r2(R), t: n > 1 && sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, maxDD: r2(dd) };
}
// calendar-month sums: every month of [from, to) one value; a position of the window adds its R to its close month, a close
// after the window's end counts in the window's last month; t = mean / sd x sqrt(months)
export function monthT(rows, from, to, key = 'n') {
  const months = []; const d = new Date(T(from) * 1000);
  while (d.getTime() / 1000 < T(to)) { months.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  const m = new Map(months.map((x) => [x, 0]));
  for (const p of rows) { let mo = new Date(p.c * 1000).toISOString().slice(0, 7); if (mo > months.at(-1)) mo = months.at(-1); if (m.has(mo)) m.set(mo, m.get(mo) + p[key]); }
  const v = months.map((x) => m.get(x)), M = v.length, mean = v.reduce((a, x) => a + x, 0) / M, sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (M - 1));
  return { months: M, mean: r3(mean), t: sd > 0 ? r2(mean / sd * Math.sqrt(M)) : null, positive: v.filter((x) => x > 0).length };
}
const inW = (rows, [a, b]) => rows.filter((x) => x.t >= T(a) && x.t < T(b));
export function windowStats(P, w) {
  const r = inW(P, w);
  return { from: w[0], to: w[1], x1: stats(r), x2: stats(r, 'n2'), noFin: stats(r, 'n0'), gross: stats(r, 'g'), month: monthT(r, w[0], w[1]), month2: monthT(r, w[0], w[1], 'n2'), atEnd: r.filter((x) => x.atEnd).length };
}
export function verdictOf(S) {
  const tests = {
    '1 OOS mean net > 0': (S.oos.x1.mean ?? -1) > 0,
    '2 OOS month-sum t >= 2': (S.oos.month.t ?? -9) >= 2,
    '3 IS mean net > 0': (S.is.x1.mean ?? -1) > 0,
    '4 OOS mean net > 0 at x2 costs': (S.oos.x2.mean ?? -1) > 0,
    '5 OOS n >= 30': S.oos.x1.n >= 30,
  };
  const pass = Object.values(tests).every(Boolean);
  return { tests, missed: Object.entries(tests).filter(([, v]) => !v).map(([k]) => k), verdict: pass ? 'PASS' : 'FAIL' };
}

const load = (dir, f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

if (import.meta.url === `file://${process.argv[1]}`) {
  const DIR = process.argv[2];
  if (!DIR) throw new Error('usage: node run.mjs <candle dir>');
  const out = { study: 'geg-silver', built: '2026-11-17', question: 'Does the live Gold daily engulf rule work on silver (OANDA XAG/USD), net of costs, out of sample?', params: { rule: EG, silver: SILVER, windows: WINDOWS } };
  // 1. parity gate on gold
  const gM5 = load(DIR, 'xau-5m.json.gz').filter((b) => b.time < GOLD_GATE.end), gD1 = load(DIR, 'xau-1d.json.gz').filter((b) => b.time < GOLD_GATE.end);
  const gP = positions(simulate(gM5, gD1, { pad: GOLD_GATE.pad, dp: GOLD_GATE.dp, key: 'xau' }), { costAbs: GOLD_GATE.costAbs });
  const gate = { ref: 'research/edge/gold-weekend/result.json systems.geg.windows (intended)', windows: {} };
  for (const [k, ref] of Object.entries(GOLD_GATE.ref)) {
    const s = stats(inW(gP, [ref.from, ref.to]));
    gate.windows[k] = { ref: { n: ref.n, mean: ref.mean }, got: { n: s.n, mean: s.mean, t: s.t }, ok: Math.abs(s.n - ref.n) <= GOLD_GATE.tolN * ref.n && Math.abs(s.mean - ref.mean) <= GOLD_GATE.tolMean };
  }
  gate.passed = Object.values(gate.windows).every((w) => w.ok);
  out.gate = gate;
  console.error('gate', JSON.stringify(gate));
  // 2. silver
  const sM5 = load(DIR, 'xag-5m.json.gz'), sD1 = load(DIR, 'xag-1d.json.gz');
  const cand = { m5: sM5.length, d1: sD1.length, first: new Date(sM5[0].time * 1000).toISOString(), last: new Date(sM5.at(-1).time * 1000).toISOString() };
  const legs = simulate(sM5, sD1, { pad: SILVER.pad, dp: SILVER.dp, key: 'xag' });
  const P = positions(legs, { costPct: SILVER.costPct, finNight: SILVER.finNight });
  const S = Object.fromEntries(Object.entries(WINDOWS).map(([k, w]) => [k, windowStats(P, w)]));
  const legs1 = simulate(sM5, sD1, { pad: SILVER.pad, dp: SILVER.dp, key: 'xag', maxOpen: 1 });
  const P1 = positions(legs1, { costPct: SILVER.costPct, finNight: SILVER.finNight });
  const years = {}; for (let y = 2006; y <= 2026; y++) { const s = stats(P.filter((x) => new Date(x.t * 1000).getUTCFullYear() === y)); if (s.n) years[y] = { n: s.n, mean: s.mean, R: s.R }; }
  const exits = {}; for (const x of P) { const e = x.exit === 'stop' ? 'stop' : x.exit === 'trailing stop' ? 'trailing stop' : x.exit === 'target' ? 'target' : x.atEnd ? 'end (marked)' : 'time'; exits[e] = (exits[e] || 0) + 1; }
  const stopPct = P.map((x) => x.r0 / x.entry).sort((a, b) => a - b);
  const orders = legs.reduce((m, x) => ({ ...m, [x.status + (x.exit === 'zone failed' ? ' (zone failed)' : '')]: (m[x.status + (x.exit === 'zone failed' ? ' (zone failed)' : '')] || 0) + 1 }), {});
  const silver = { candles: cand, orders, windows: S, reported: { maxOpen1: Object.fromEntries(Object.entries(WINDOWS).map(([k, w]) => [k, windowStats(P1, w)])), years, exits,
    medianStopPctOfPrice: r3(100 * stopPct[Math.floor(stopPct.length / 2)]), meanFinR: r3(P.reduce((a, x) => a + x.fin, 0) / P.length), meanCostR: r3(P.reduce((a, x) => a + (x.n0 - x.g) * -1, 0) / P.length) } };
  if (gate.passed) { const v = verdictOf(S); out.silver = silver; out.decision = v; out.verdict = v.verdict; }
  else { out.uninterpreted = silver; out.verdict = 'HARNESS NOT VALIDATED'; }
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
}
