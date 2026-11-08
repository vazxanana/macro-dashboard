// Edge research · gtrend-exits: can the EXIT / RE-ENTRY side of Gold trend (gtrend, N20) and Gold trend fast (gtrend5, N5) be
// improved robustly? 12 pre-registered variants (preregistration.md) against the live rule, replayed exactly as
// research/edge/gold-systems-oos/replay.mjs does for the two trend legs (one run 4 minutes after every M5 close, daily signals,
// M5 management with council/fills.mjs stopFill / exitR / spotSkip, the daily chandelier ratchet after management, the add at
// market). Untouched window 2006-07..2017-12 with halves, confirmation 2018-01..2026-11, costs from council/fills.mjs.
//   CANDLES=<dir from research/edge/gold-systems-oos/fetch.mjs> node run.mjs > result.json      (DEBUG_VARIANT=<id> lists that variant's positions on stderr)
// The `live` variant must reproduce #530's figures first (the gate, checked here against gold-systems-oos/result.json).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { stopFill, exitR, spotSkip, spreadOf, SLIP_SPREADS } from '../../../council/fills.mjs';

const DIR = process.env.CANDLES;
if (!DIR) throw new Error('CANDLES=<candle dir> is required');
const here = path.dirname(new URL(import.meta.url).pathname);
const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const M5 = load('5m'), D1 = load('1d');
console.error('candles', { m5: M5.length, d1: D1.length, from: new Date(M5[0].time * 1000).toISOString().slice(0, 10), to: new Date(M5.at(-1).time * 1000).toISOString().slice(0, 10) });
const NM = M5.length, ND = D1.length;
const SKIP = new Uint8Array(NM); for (let i = 0; i < NM; i++) SKIP[i] = spotSkip(M5[i].time) ? 1 : 0;
const fx = (v) => +v.toFixed(2);   // xau dec 1 -> Math.max(2, dec + 1) = 2 decimals, as live

// ─── costs: council/fills.mjs paper-fill model for spot gold. Spread $0.30 a round trip (spreadOf), plus SLIP_SPREADS of a spread
// on every market order: the entry (market) and the exit (a stop / trail / time / marked exit is never a resting target).
const SPREAD = spreadOf({ spot: true }, 2000);                       // 0.30
const COST_X1 = SPREAD + 2 * SLIP_SPREADS * SPREAD;                  // 0.60 a unit round trip
const COSTS = { gross: 0, gate: 0.30, x1: COST_X1, x2: 2 * COST_X1 };

// ─── daily precomputation: ATR14, the prior-N-day high (excluding the day itself), the M-day low (including the day) ───
const tr14 = (i) => Math.max(D1[i].high - D1[i].low, Math.abs(D1[i].high - D1[i - 1].close), Math.abs(D1[i].low - D1[i - 1].close));
const ATR = new Float64Array(ND); for (let i = 14; i < ND; i++) { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); ATR[i] = a / 14; }
const hiPrior = (i, n) => { let h = -Infinity; for (let q = i - n; q < i; q++) h = Math.max(h, D1[q].high); return h; };
const loLast = (i, m) => { let l = Infinity; for (let q = i - m + 1; q <= i; q++) l = Math.min(l, D1[q].low); return l; };
// closed-candle count at time c (a daily candle is closed once its bucket has ended), per M5 run
const ND_AT = new Int32Array(NM); { let p = 0; for (let j = 0; j < NM; j++) { const c = M5[j].time + 300; while (p < ND && D1[p].time + 86400 <= c) p++; ND_AT[j] = p; } }

// ─── variants (preregistration.md) ───
const V = {
  live: {},
  'T1.5': { trailK: 1.5 }, T3: { trailK: 3 }, T4: { trailK: 4 },
  TL10: { trailLow: 10 }, TL20: { trailLow: 20 },
  S20: { timeStop: 20 }, S40: { timeStop: 40 },
  A0: { add: null }, A2: { add: 2 },
  BE1: { be: 1 },
  RF: { freshHigh: true },
  C1: { trailK: 3, be: 1 },
};
const LEGS = { gtrend: { n: 20, k: 2 }, gtrend5: { n: 5, k: 2 } };
const START = Date.parse('2006-03-20T00:00:00Z') / 1000, FIRST_ENTRY = Date.parse('2006-07-01T00:00:00Z') / 1000;

// one leg, one variant: the replay.mjs loop restricted to that leg
function simulate(legKey, vid) {
  const GT = LEGS[legKey], v = V[vid], addAt = v.add === undefined ? 1 : v.add, trailK = v.trailK ?? GT.k;
  const trades = [], ids = new Set();
  let book = [], reentryAbove = -Infinity;
  const push = (t) => { trades.push(t); ids.add(t.id); return t; };
  const isLive = (x) => x.status === 'open';
  function manage(tr, i) {
    const b = M5[i];
    if (SKIP[i]) return;
    tr.peak = Math.max(tr.peak || 0, b.high);
    if (b.low <= tr.stop) {
      const px = stopFill(b, false, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
      if (tr.trailMoved) { tr.R = exitR(false, tr.entry, px, tr.r0); tr.exit = 'trailing stop'; }
      else if (tr.beMoved) { tr.R = exitR(false, tr.entry, px, tr.r0); tr.exit = 'break-even'; }
      else { tr.R = gapped ? exitR(false, tr.entry, px, tr.r0) : -1; tr.exit = 'stop'; }
      tr.exitPx = px; tr.status = 'closed'; tr.closed = b.time; return;
    }
    tr.mfe = +Math.max(tr.mfe || 0, (b.high - tr.entry) / tr.r0).toFixed(2);
  }
  const closeAt = (tr, px, t, kind) => { tr.R = exitR(false, tr.entry, px, tr.r0); tr.exitPx = px; tr.exit = kind; tr.status = 'closed'; tr.closed = t; };
  for (let j = 0; j < NM - 1; j++) {
    const c = M5[j].time + 300, now = c + 240;
    for (const tr of book) { for (let i = tr.ptr; i <= j && isLive(tr); i++) { manage(tr, i); tr.ptr = i + 1; } if (tr.ptr <= j) tr.ptr = j + 1; }
    if (book.length) { const stopped = book.filter((x) => !isLive(x) && !x.addOf); for (const s of stopped) if (v.freshHigh) reentryAbove = Math.max(s.peak || 0, ...book.filter((a) => a.addOf === s.id).map((a) => a.peak || 0)); book = book.filter(isLive); }
    if (M5[j].time < START) continue;
    const nd = ND_AT[j];
    if (nd < 40) continue;
    const hasEntry = M5[j + 1].time === c, price = hasEntry ? M5[j + 1].close : M5[j].close, k0 = j + 2;
    const canEnter = hasEntry && now >= FIRST_ENTRY;
    const last = D1[nd - 1], li = nd - 1;
    const open = book.find((x) => x.status === 'open' && !x.addOf);
    if (open) {
      const gAdd = book.find((x) => x.addOf === open.id && x.status === 'open');
      if (last.time > open.lastD) {
        open.days = (open.days || 0) + 1;
        // the ratchet: chandelier (close - k ATR) or the M-day low; the stop only rises
        const ns = v.trailLow ? fx(loLast(li, v.trailLow)) : fx(last.close - trailK * ATR[li]);
        if (ns > open.stop) { open.stop = ns; open.trailMoved = true; }
        if (gAdd && ns > gAdd.stop) { gAdd.stop = ns; gAdd.trailMoved = true; }
        // break-even: once a closed day is >= be R above the first entry the shared stop is at least the first entry
        if (v.be && last.close - open.entry >= v.be * open.r0) { for (const u of [open, gAdd]) if (u && u.stop < open.entry) { u.stop = open.entry; u.beMoved = true; } }
        open.lastD = last.time;
        if (addAt && !gAdd && !ids.has(`${open.id}-add`) && last.close - open.entry >= addAt * open.r0 && canEnter) {
          const ae = fx(price), rA = ae - open.stop;
          if (rA > 0) book.push(push({ id: `${open.id}-add`, k: legKey, entry: ae, stop: open.stop, opened: now, filled: now, status: 'open', R: null, r0: rA, addOf: open.id, ptr: k0, peak: ae }));
        }
      }
      // time stop: both units out at market on the first run (with an M5 candle) after the N-th closed day since entry
      if (v.timeStop && open.days >= v.timeStop && hasEntry) { const px = fx(price); for (const u of [open, gAdd]) if (u && u.status === 'open') closeAt(u, px, now, 'time'); if (v.freshHigh) reentryAbove = Math.max(open.peak || 0, gAdd ? gAdd.peak || 0 : 0); book = book.filter(isLive); }
    } else {
      const hi = hiPrior(li, GT.n), A = ATR[li], id = `xau-${legKey}-${last.time}`;
      if (last.close > hi && A > 0 && !ids.has(id) && now - (last.time + 86400) < 86400 && canEnter && (!v.freshHigh || last.close > reentryAbove)) {
        const entry = fx(price), stop = fx(entry - GT.k * A), r0 = entry - stop;
        if (r0 > 0) { book.push(push({ id, k: legKey, entry, stop, opened: now, filled: now, status: 'open', R: null, r0, lastD: last.time, days: 0, ptr: k0, peak: entry, feat: { hi: fx(hi), atr: fx(A) } })); reentryAbove = -Infinity; }
      }
    }
  }
  const lastBar = M5[NM - 1];
  for (const tr of book) { closeAt(tr, lastBar.close, lastBar.time, 'end (marked)'); tr.atEnd = true; }
  return trades;
}

// ─── positions and statistics ───
const D = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const P = { oos: [D('2006-07-01'), D('2018-01-01')], h1: [D('2006-07-01'), D('2012-01-01')], h2: [D('2012-01-01'), D('2018-01-01')], conf: [D('2018-01-01'), D('2026-11-07')] };
const yearOf = (t) => new Date(t * 1000).getUTCFullYear(), monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
function positions(legs) {
  const byRoot = new Map();
  for (const x of legs) { const r = x.addOf || x.id; if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(x); }
  const pos = [];
  for (const [id, L] of byRoot) {
    const first = L.find((x) => !x.addOf);
    const net = (c) => L.reduce((a, x) => a + (x.R - c / x.r0), 0);
    pos.push({ id, t: first.filled, c: Math.max(...L.map((x) => x.closed)), gross: net(0), gate: net(COSTS.gate), x1: net(COSTS.x1), x2: net(COSTS.x2), add: L.length > 1, exit: first.exit, days: (Math.max(...L.map((x) => x.closed)) - first.filled) / 86400, atEnd: L.some((x) => x.atEnd) });
  }
  return pos.sort((a, b) => a.t - b.t);
}
const inP = (rows, [a, b]) => rows.filter((x) => x.t >= a && x.t < b);
function stats(rows, key) {
  const a = rows.slice().sort((x, y) => x.c - y.c), v = a.map((x) => x[key]), n = v.length;
  if (!n) return { n: 0, R: 0, mean: null, t: null, maxDD: 0, retDD: null };
  const R = v.reduce((p, x) => p + x, 0), mean = R / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
  return { n, win: r3(v.filter((x) => x > 0).length / n), mean: r3(mean), R: r2(R), t: n > 1 && sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, maxDD: r2(dd), retDD: dd < 0 ? r2(R / -dd) : null };
}
const MONTHS = []; for (let y = 2006; y <= 2017; y++) for (let m = 1; m <= 12; m++) { const s = `${y}-${String(m).padStart(2, '0')}`; if (s >= '2006-07') MONTHS.push(s); }
const monthly = (pos, key) => { const m = new Map(MONTHS.map((x) => [x, 0])); for (const p of inP(pos, P.oos)) { const mo = monthOf(Math.min(p.c, P.oos[1] - 1)); if (m.has(mo)) m.set(mo, m.get(mo) + p[key]); } return MONTHS.map((x) => m.get(x)); };
function diffStats(a, b) {   // monthly a - b: mean, t, block bootstrap P(mean <= 0)
  const d = a.map((x, i) => x - b[i]), n = d.length, mean = d.reduce((p, x) => p + x, 0) / n, sd = Math.sqrt(d.reduce((p, x) => p + (x - mean) ** 2, 0) / (n - 1));
  let s = 987654321; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  let le = 0; const B = 10000; for (let k = 0; k < B; k++) { let sum = 0; for (let i = 0; i < n; i++) sum += d[Math.floor(rnd() * n)]; if (sum <= 0) le++; }
  return { total: r2(mean * n), t: sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, pLE0: r3(le / B) };
}

// ─── run everything ───
const t0 = Date.now();
const RUNS = {};
for (const legKey of Object.keys(LEGS)) for (const vid of Object.keys(V)) { const legs = simulate(legKey, vid); RUNS[`${legKey}:${vid}`] = { legs, pos: positions(legs) }; console.error(`${legKey} ${vid}: ${legs.length} legs, ${RUNS[`${legKey}:${vid}`].pos.length} positions`); }
console.error(`replay ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ─── gate: the live variant against #530 (research/edge/gold-systems-oos/result.json, $0.30 a unit) ───
const ref = JSON.parse(fs.readFileSync(path.join(here, '../gold-systems-oos/result.json'), 'utf8'));
const gate = { cost: COSTS.gate, legs: {}, ok: true };
for (const legKey of Object.keys(LEGS)) {
  const pos = RUNS[`${legKey}:live`].pos, S = ref.systems[legKey].periods;
  const rows = {};
  for (const [pk, rk] of [['oos', 'oos'], ['h1', 'h1'], ['h2', 'h2'], ['conf', 'cal']]) {
    const got = stats(inP(pos, P[pk]), 'gate'), exp = S[rk].x1;
    const ok = got.n === exp.n && Math.abs(got.mean - exp.mean) <= 0.002 && Math.abs(got.maxDD - exp.maxDD) <= 0.02 && (got.t == null || Math.abs(got.t - exp.t) <= 0.02);
    rows[pk] = { expected: { n: exp.n, mean: exp.mean, t: exp.t, maxDD: exp.maxDD }, got: { n: got.n, mean: got.mean, t: got.t, maxDD: got.maxDD }, ok };
    if (!ok) gate.ok = false;
  }
  gate.legs[legKey] = rows;
}
console.error('gate', gate.ok ? 'OK' : 'MISMATCH', JSON.stringify(gate.legs, null, 0));
if (!gate.ok && !process.env.IGNORE_GATE) { console.log(JSON.stringify({ gate }, null, 1)); throw new Error('calibration gate failed: the live replay does not reproduce #530'); }

// ─── tables and the pre-registered bar ───
const out = { topic: 'gtrend-exits', built: new Date().toISOString().slice(0, 10), at: new Date().toISOString(), system: 'Gold trend (gtrend, N20) and Gold trend fast (gtrend5, N5), OANDA XAU/USD M5 + D1 2006-03-20 .. 2026-11-06',
  note: 'net R a position (first unit + add, each unit pays the cost); x1 = $0.60 a unit round trip (spread 0.30 + 0.15 entry slip + 0.15 exit slip, council/fills.mjs), x2 = $1.20; OOS = entries 2006-07-01..2017-12-31, H1 to 2011-12, H2 2012-17, confirmation 2018-01-01..2026-11-06',
  costs: COSTS, gate, variants: V, legs: {} };
const passing = [];
for (const legKey of Object.keys(LEGS)) {
  const live = RUNS[`${legKey}:live`], liveM = { x1: monthly(live.pos, 'x1'), x2: monthly(live.pos, 'x2') };
  const L = { variants: {} };
  for (const vid of Object.keys(V)) {
    const { legs, pos } = RUNS[`${legKey}:${vid}`], S = { periods: {}, years: {} };
    for (const pk of Object.keys(P)) S.periods[pk] = Object.fromEntries(['x1', 'x2', 'gross'].map((ck) => [ck, stats(inP(pos, P[pk]), ck)]));
    for (let y = 2006; y <= 2026; y++) { const r = pos.filter((x) => yearOf(x.t) === y); S.years[y] = { n: r.length, x1: r2(r.reduce((a, x) => a + x.x1, 0)) }; }
    const oos = inP(pos, P.oos), exits = {}; for (const x of legs.filter((l) => !l.addOf && l.filled >= P.oos[0] && l.filled < P.oos[1])) exits[x.exit] = (exits[x.exit] || 0) + 1;
    S.oosExits = exits; S.oosAdds = oos.filter((x) => x.add).length;
    S.oosMedianDays = r2(oos.map((x) => x.days).sort((a, b) => a - b)[Math.floor(oos.length / 2)] || 0);
    S.yearsPositive = `${Object.entries(S.years).filter(([y, v]) => +y <= 2017 && v.n && v.x1 > 0).length}/${Object.entries(S.years).filter(([y, v]) => +y <= 2017 && v.n).length}`;
    if (vid !== 'live') S.vsLiveMonthly = { x1: diffStats(monthly(pos, 'x1'), liveM.x1), x2: diffStats(monthly(pos, 'x2'), liveM.x2) };
    // the bar
    if (vid !== 'live') {
      const lp = L.variants.live.periods, tests = {};
      for (const ck of ['x1', 'x2']) {
        const p = S.periods, l = lp;
        tests[`${ck} 1 OOS total R > live`] = p.oos[ck].R > l.oos[ck].R;
        tests[`${ck} 2 OOS return/DD > live`] = (p.oos[ck].retDD ?? Infinity) > (l.oos[ck].retDD ?? -Infinity);
        tests[`${ck} 3 both halves total R > live`] = p.h1[ck].R > l.h1[ck].R && p.h2[ck].R > l.h2[ck].R;
        tests[`${ck} 4 mean > 0 OOS and both halves`] = (p.oos[ck].mean ?? -1) > 0 && (p.h1[ck].mean ?? -1) > 0 && (p.h2[ck].mean ?? -1) > 0;
        tests[`${ck} 5 confirmation total R > live`] = p.conf[ck].R > l.conf[ck].R;
        tests[`${ck} 6 confirmation return/DD > live`] = (p.conf[ck].retDD ?? Infinity) > (l.conf[ck].retDD ?? -Infinity);
      }
      const beatsOOS = ['1', '2', '3', '4'].every((k) => ['x1', 'x2'].every((ck) => Object.entries(tests).find(([t]) => t.startsWith(`${ck} ${k} `))[1]));
      const confirmed = beatsOOS && ['5', '6'].every((k) => ['x1', 'x2'].every((ck) => Object.entries(tests).find(([t]) => t.startsWith(`${ck} ${k} `))[1]));
      S.bar = { tests, beatsOOS, confirmed, missed: Object.entries(tests).filter(([, v]) => !v).map(([t]) => t) };
      if (confirmed) passing.push({ leg: legKey, variant: vid, retDDx2: S.periods.oos.x2.retDD });
    }
    L.variants[vid] = S;
  }
  if (process.env.DEBUG_VARIANT) for (const p of RUNS[`${legKey}:${process.env.DEBUG_VARIANT}`].pos) console.error(legKey, process.env.DEBUG_VARIANT, new Date(p.t * 1000).toISOString().slice(0, 10), new Date(p.c * 1000).toISOString().slice(0, 10), p.x1.toFixed(2), p.exit, 'peak', RUNS[`${legKey}:${process.env.DEBUG_VARIANT}`].legs.filter((l) => (l.addOf || l.id) === p.id).map((l) => l.peak).reduce((a, b) => Math.max(a, b), 0).toFixed(0));
  L.positionsLive = live.pos.map((p) => ({ id: p.id, t: new Date(p.t * 1000).toISOString().slice(0, 16), c: new Date(p.c * 1000).toISOString().slice(0, 16), gross: r3(p.gross), x1: r3(p.x1), x2: r3(p.x2), add: p.add, exit: p.exit, atEnd: p.atEnd || undefined }));
  out.legs[legKey] = L;
}
const beats = Object.entries(out.legs).flatMap(([lk, L]) => Object.entries(L.variants).filter(([, S]) => S.bar && S.bar.beatsOOS).map(([vid]) => `${lk}:${vid}`));
out.summary = { comparisons: 2 * (Object.keys(V).length - 1), beatOOS: beats, confirmed: passing.map((p) => `${p.leg}:${p.variant}`) };
passing.sort((a, b) => b.retDDx2 - a.retDDx2);
out.verdict = passing.length ? `PASS: ${passing.map((p) => `${p.variant} for ${p.leg}`).join(', ')} beat the live exit on untouched 2006-17 at x1 and x2 and are confirmed on 2018-26`
  : `FAIL / keep the live exit: no exit or re-entry variant beats the live chandelier on untouched 2006-17 and confirms on 2018-26 at x1 and x2 (${beats.length} of ${out.summary.comparisons} cleared the untouched window before confirmation)`;
console.error(out.verdict);
console.log(JSON.stringify(out, null, 1));
