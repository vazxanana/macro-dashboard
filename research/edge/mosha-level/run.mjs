// Edge research · mosha-level: the owner's reading of a Mosha trade (10 Nov 2026), written down as one mechanical rule and tested
// on spot gold 2020 → October 2026. The rule, the variants and the verdict are fixed in PREREGISTRATION.md (committed before this
// file produced a number). Paper research only: nothing here trades or changes a live rule.
//   GOLD_DIR=<folder with XAUUSD_M1_*.csv.gz> node run.mjs run        -> result.json (+ trades.json when OUT_DIR is set)
//   node run.mjs example                                             -> the detector on the council's OANDA candles of the last days
//                                                                       (does it find the owner's trade of 10 Nov 2026?)
// Sells are the reference; buys are the mirror image. Structure words as in the owner's direction rule book: A-level = swing high,
// V-level = swing low, BO sell = a close below a V-level, external BO = the break of the last level formed before the tap.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const K = { W4: 3, W5: 1, TOL: 0.0005, PAD: 0.30, BASE: 3, LEVEL_AGE: 30 * 86400, EPISODE: 24 * 3600, VALID: 24 * 3600, HOLD: 72 * 3600,
  MIN_R0: 1.0, MIN_RR: 2, COST: 0.30, H4: 14400, M5: 300, FROM: Date.UTC(2020, 0, 1) / 1000, SPLIT: Date.UTC(2024, 0, 1) / 1000, TO: Date.UTC(2026, 10, 1) / 1000 };
export const VARIANTS = { P: {}, W: { wide: true }, T3: { fixed: 3 }, F: { first: true } };

// swing highs (side -1: an A-level, sold from) and swing lows (side +1: a V-level, bought from) of size w: not beyond the w candles
// before it, strictly beyond the w candles after it. Returns one Int8Array per kind (1 = swing at that candle).
export function swings(B, w) {
  const n = B.length, hi = new Int8Array(n), lo = new Int8Array(n);
  for (let j = w; j < n - w; j++) {
    let h = 1, l = 1;
    for (let k = 1; k <= w && (h || l); k++) {
      if (B[j - k].high > B[j].high || B[j + k].high >= B[j].high) h = 0;
      if (B[j - k].low < B[j].low || B[j + k].low <= B[j].low) l = 0;
    }
    hi[j] = h; lo[j] = l;
  }
  return { hi, lo };
}

// H4 key levels and H4 engulf zones (the barriers), each with the time it comes to exist (a candle's close)
export function h4Context(H4) {
  const { hi, lo } = swings(H4, K.W4), levels = [], zones = [];
  for (let j = 0; j < H4.length; j++) {
    const born = j + K.W4 < H4.length ? H4[j + K.W4].time + K.H4 : null;
    if (hi[j] && born) levels.push({ side: -1, p: H4[j].high, at: H4[j].time, born });
    if (lo[j] && born) levels.push({ side: 1, p: H4[j].low, at: H4[j].time, born });
    if (j > 0) {
      const a = H4[j - 1], b = H4[j], born2 = b.time + K.H4;
      if (b.close > b.open && a.close < a.open && b.close > a.high) zones.push({ side: 1, bot: Math.min(a.low, b.low), top: a.high, born: born2 });      // bullish engulf: a barrier under price
      if (b.close < b.open && a.close > a.open && b.close < a.low) zones.push({ side: -1, bot: a.low, top: Math.max(a.high, b.high), born: born2 });   // bearish engulf: a barrier over price
    }
  }
  levels.sort((x, y) => x.born - y.born);
  return { levels, zones };
}

// first index with T[i] >= t (T: array of numbers, or of candles when key is set)
const lower = (n, at, t) => { let a = 0, b = n; while (a < b) { const m = (a + b) >> 1; if (at(m) < t) a = m + 1; else b = m; } return a; };

// one order from placement to its end, on the fine candles F (M1 in the study, M5 in the example). s = -1 sell, +1 buy.
export function simulate(F, o) {
  const n = F.length, s = o.side;
  let k = lower(n, (i) => F[i].time, o.placed), filled = null;
  for (; k < n; k++) {
    const b = F[k];
    if (filled == null) {
      if (b.time >= o.placed + K.VALID) return { status: 'expired', closed: b.time, R: 0 };
      const touch = s < 0 ? b.high >= o.entry : b.low <= o.entry;
      const tgt = s < 0 ? b.low <= o.target : b.high >= o.target;
      if (!touch) { if (tgt) return { status: 'missed', closed: b.time, R: 0 }; continue; }
      if (tgt) return { status: 'missed', closed: b.time, R: 0, note: 'fill and target in one candle' };
      filled = b.time;
      if (s < 0 ? b.high >= o.stop : b.low <= o.stop) { const px = s < 0 ? Math.max(o.stop, b.open) : Math.min(o.stop, b.open); return done(o, filled, b.time, px, 'stop'); }
      continue;
    }
    if (s < 0 ? b.open >= o.stop : b.open <= o.stop) return done(o, filled, b.time, b.open, 'stop (gap)');
    if (s < 0 ? b.high >= o.stop : b.low <= o.stop) return done(o, filled, b.time, o.stop, 'stop');
    if (s < 0 ? b.low <= o.target : b.high >= o.target) return done(o, filled, b.time, o.target, 'target');
    if (b.time >= filled + K.HOLD) return done(o, filled, b.time, b.close, 'time');
  }
  return filled == null ? { status: 'expired', closed: F[n - 1].time, R: 0, atEnd: true } : done(o, filled, F[n - 1].time, F[n - 1].close, 'end (marked)');
}
function done(o, filled, closed, px, exit) {
  const R = (o.side * (px - o.entry)) / o.r0;
  return { status: 'closed', filled, closed, exitPx: +px.toFixed(3), exit, R: +R.toFixed(4), net: +(R - K.COST / o.r0).toFixed(4), net2: +(R - 2 * K.COST / o.r0).toFixed(4) };
}

// the detector and the one-at-a-time book. M5, H4: candles oldest first; F: the candles fills are judged on.
export function run(M5, H4, F, variant = 'P') {
  const V = VARIANTS[variant], n = M5.length, { hi, lo } = swings(M5, K.W5), { levels, zones } = h4Context(H4);
  const funnel = { levels: 0, taps: 0, external: 0, entryBo: 0, small: 0, noBarrier: 0, lowRR: 0, busy: 0, orders: 0 };
  const orders = [], live = [];
  // the most recent M5 swing that existed when candle i opened (its 3rd candle after it had closed): index <= i - W5 - 1
  const lastLo = new Int32Array(n).fill(-1), lastHi = new Int32Array(n).fill(-1);
  for (let i = 1; i < n; i++) { const j = i - K.W5 - 1; lastLo[i] = j >= 0 && lo[j] ? j : lastLo[i - 1]; lastHi[i] = j >= 0 && hi[j] ? j : lastHi[i - 1]; }
  let li = 0, h4i = 0, busyUntil = -Infinity;
  const zoneLive = zones.map(() => true);
  const barrier = (side, entry, now) => {   // sells: the top of the nearest live bullish zone under the entry; buys: the bottom of the nearest live bearish zone over it
    let best = null;
    for (let z = zones.length - 1; z >= 0; z--) {
      const Z = zones[z]; if (Z.born > now) continue; if (now - Z.born > K.LEVEL_AGE) break; if (!zoneLive[z] || Z.side !== -side) continue;
      const px = side < 0 ? Z.top : Z.bot; if (side < 0 ? px >= entry : px <= entry) continue;
      if (best == null || (side < 0 ? px > best : px < best)) best = px;
    }
    return best;
  };
  const place = (L, i, entry, edge) => {   // edge: the zone's far side (top for a sell)
    const s = L.side, now = M5[i].time + K.M5, stop = +(edge - s * K.PAD).toFixed(3), r0 = Math.abs(stop - entry);
    funnel.entryBo++;
    if (r0 < K.MIN_R0) { funnel.small++; return false; }
    const target = V.fixed ? entry + s * V.fixed * r0 : barrier(s, entry, now);
    if (target == null) { funnel.noBarrier++; return false; }
    if (Math.abs(target - entry) < K.MIN_RR * r0) { funnel.lowRR++; return false; }
    if (now < busyUntil) { funnel.busy++; return false; }
    const o = { id: `xau-ml-${s < 0 ? 's' : 'b'}-${now}`, side: s, level: +L.p.toFixed(3), levelAt: L.at, tap: M5[L.ep.tapI].time, external: M5[L.ep.xI].time + K.M5, placed: now,
      entry: +entry.toFixed(3), stop, target: +target.toFixed(3), r0: +r0.toFixed(3), rr: +(Math.abs(target - entry) / r0).toFixed(2) };
    Object.assign(o, simulate(F, o)); orders.push(o); funnel.orders++; busyUntil = o.closed; L.retired = true;
    return true;
  };
  for (let i = 0; i < n; i++) {
    const b = M5[i], t = b.time;
    // H4 candles that closed by this candle's open: levels closed through die, zones closed through die
    for (; h4i < H4.length && H4[h4i].time + K.H4 <= t; h4i++) {
      const c = H4[h4i].close, ct = H4[h4i].time + K.H4;
      for (; li < levels.length && levels[li].born <= ct; li++) { live.push({ ...levels[li], ep: null }); funnel.levels++; }   // a level meets every H4 close after its own
      for (const L of live) if (!L.dead && (L.side < 0 ? c > L.p : c < L.p)) { L.dead = true; if (L.ep && L.ep.stage === 1) L.ep = null; }
      for (let z = 0; z < zones.length; z++) if (zoneLive[z] && zones[z].born <= ct && (zones[z].side > 0 ? c < zones[z].bot : c > zones[z].top)) zoneLive[z] = false;
    }
    for (; li < levels.length && levels[li].born <= t; li++) { live.push({ ...levels[li], ep: null }); funnel.levels++; }
    for (let q = live.length - 1; q >= 0; q--) {
      const L = live[q], s = L.side;
      if (L.retired || (L.dead && !L.ep) || (t - L.born > K.LEVEL_AGE && !L.ep)) { live.splice(q, 1); continue; }
      const E = L.ep;
      if (!E) {
        if (L.dead || t - L.born > K.LEVEL_AGE) continue;
        if (s < 0 ? b.high >= L.p * (1 - K.TOL) : b.low <= L.p * (1 + K.TOL)) {
          const j = s < 0 ? lastLo[i] : lastHi[i]; if (j < 0) continue;
          L.ep = { stage: 1, tapI: i, tapT: t, ext: s < 0 ? b.high : b.low, v: s < 0 ? M5[j].low : M5[j].high }; funnel.taps++;
        }
        continue;
      }
      if (i === E.tapI) continue;
      if (E.stage === 1) {
        E.ext = s < 0 ? Math.max(E.ext, b.high) : Math.min(E.ext, b.low);
        if (t - E.tapT > K.EPISODE) { L.ep = null; continue; }
        if (s < 0 ? b.close < E.v : b.close > E.v) {
          E.stage = 2; E.xI = i; E.xT = t; funnel.external++;
          if (V.first) { let edge = s < 0 ? -Infinity : Infinity; for (let k = Math.max(0, i - K.BASE); k <= i; k++) edge = s < 0 ? Math.max(edge, M5[k].high) : Math.min(edge, M5[k].low);
            place(L, i, E.v, edge); L.ep = null; }
        }
        continue;
      }
      // stage 2: the first swing at or after the external BO candle (V2), then a close through it
      if (s < 0 ? b.high > E.ext : b.low < E.ext) { L.ep = null; continue; }
      if (t - E.xT > K.EPISODE) { L.ep = null; continue; }
      if (E.v2 == null) { const j = i - K.W5; if (j >= E.xI && (s < 0 ? lo[j] : hi[j])) { E.v2 = s < 0 ? M5[j].low : M5[j].high; E.v2I = j; } continue; }
      if (s < 0 ? b.close < E.v2 : b.close > E.v2) {
        let edge = s < 0 ? -Infinity : Infinity;
        for (let k = V.wide ? E.v2I : Math.max(0, i - K.BASE); k <= i; k++) edge = s < 0 ? Math.max(edge, M5[k].high) : Math.min(edge, M5[k].low);
        place(L, i, E.v2, edge); L.ep = null;
      }
    }
  }
  return { orders, funnel };
}

// ─── statistics ───
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
export function stat(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const m = mean(rs), sd = n > 1 ? Math.sqrt(rs.reduce((a, r) => a + (r - m) ** 2, 0) / (n - 1)) : 0, t = sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
  const w = rs.filter((r) => r > 0), l = rs.filter((r) => r <= 0), gw = w.reduce((a, r) => a + r, 0), gl = -l.reduce((a, r) => a + r, 0);
  let cum = 0, peak = 0, dd = 0; for (const r of rs) { cum += r; if (cum > peak) peak = cum; if (peak - cum > dd) dd = peak - cum; }
  const r2 = (v) => +v.toFixed(3);
  return { n, win: r2(w.length / n), avg: r2(m), total: +cum.toFixed(2), t: +t.toFixed(2), pf: gl > 0 ? +(gw / gl).toFixed(2) : null, maxDD: +dd.toFixed(2), avgWin: w.length ? r2(gw / w.length) : null, avgLoss: l.length ? r2(-gl / l.length) : null };
}
// one-sided p for mean > 0 from t (normal approximation; every tested n here is far above 30 or the test is void)
const pOf = (t) => { const x = t / Math.SQRT2, a = 1 / (1 + 0.3275911 * Math.abs(x)), e = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-x * x); return +(0.5 * (1 - Math.sign(x) * e)).toFixed(4); };
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
export function summarize(orders) {
  const inWin = orders.filter((o) => o.placed >= K.FROM && o.placed < K.TO), tr = inWin.filter((o) => o.status === 'closed').sort((a, b) => a.closed - b.closed || a.placed - b.placed);
  const net = (l) => l.map((o) => o.net), is = tr.filter((o) => o.placed < K.SPLIT), oos = tr.filter((o) => o.placed >= K.SPLIT);
  const years = {}; for (const o of tr) (years[yearOf(o.placed)] ||= []).push(o.net);
  const exits = {}; for (const o of tr) { const k = o.exit.replace(' (gap)', ''); exits[k] = (exits[k] || 0) + 1; }
  const all = stat(net(tr));
  return { orders: inWin.length, filled: tr.length, missed: inWin.filter((o) => o.status === 'missed').length, expired: inWin.filter((o) => o.status === 'expired').length,
    all, p: pOf(all.t), x2: stat(tr.map((o) => o.net2)), gross: stat(tr.map((o) => o.R)), is: stat(net(is)), oos: stat(net(oos)),
    years: Object.fromEntries(Object.entries(years).map(([y, l]) => [y, stat(l)])), sells: stat(net(tr.filter((o) => o.side < 0))), buys: stat(net(tr.filter((o) => o.side > 0))),
    exits, medianR0: tr.length ? +[...tr.map((o) => o.r0)].sort((a, b) => a - b)[tr.length >> 1].toFixed(2) : null, medianRR: tr.length ? +[...tr.map((o) => o.rr)].sort((a, b) => a - b)[tr.length >> 1].toFixed(2) : null,
    tightShare: tr.length ? +(tr.filter((o) => o.r0 < 3).length / tr.length).toFixed(3) : null };
}
// the pre-registered verdict, on P
export function verdictOf(S) {
  const oy = Object.entries(S.years).filter(([y]) => +y >= 2024), pos = oy.filter(([, s]) => s.total > 0).length;
  const tests = { 'out-of-sample n >= 30': S.oos.n >= 30, 'in-sample mean net R > 0': S.is.n > 0 && S.is.avg > 0, 'out-of-sample mean net R > 0': S.oos.n > 0 && S.oos.avg > 0,
    'two thirds of out-of-sample years positive': oy.length > 0 && pos / oy.length >= 2 / 3, 'whole-window t >= 2.0': S.all.t >= 2, 'mean net R > 0 at twice the cost': S.x2.n > 0 && S.x2.avg > 0 };
  const fail = !(S.all.n > 0 && S.all.avg > 0) || !(S.oos.n > 0 && S.oos.avg > 0);
  return { verdict: Object.values(tests).every(Boolean) ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE', tests };
}

// ─── modes ───
const MODE = process.argv[2], HERE = path.dirname(fileURLToPath(import.meta.url));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
if (MODE === 'example') {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
  const get = async (tf, n) => { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&n=${n}`, { signal: AbortSignal.timeout(40000) }); const j = await r.json(); return j.bars.filter((b) => !b.live).map((b) => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })); };
  const M5 = await get('5m', 3000), H4 = await get('4h', 400);
  console.log(`OANDA M5 ${iso(M5[0].time)} → ${iso(M5.at(-1).time)} (fills judged on M5 here)`);
  for (const v of Object.keys(VARIANTS)) {
    const { orders, funnel } = run(M5, H4, M5, v);
    console.log(`\n${v}: ${JSON.stringify(funnel)}`);
    for (const o of orders.slice(-8)) console.log(`  ${iso(o.placed)} ${o.side < 0 ? 'SELL' : 'BUY '} level ${o.level} entry ${o.entry} stop ${o.stop} target ${o.target} (${o.rr}R) → ${o.status}${o.exit ? ' ' + o.exit : ''} ${o.net != null ? o.net + 'R' : ''}`);
  }
}
if (MODE === 'run') {
  const { loadM1, aggregate } = await import('../gold-systems/data.mjs');
  const m = loadM1(), M1 = new Array(m.n); for (let i = 0; i < m.n; i++) M1[i] = { time: m.T[i], open: m.O[i], high: m.H[i], low: m.L[i], close: m.C[i] };
  const M5 = aggregate(m, K.M5), H4 = aggregate(m, K.H4);
  console.error(`M1 ${m.n} (${iso(M1[0].time)} → ${iso(M1.at(-1).time)}), M5 ${M5.length}, H4 ${H4.length}`);
  const out = { topic: 'mosha-level', built: '2026-11-10', at: new Date().toISOString(), system: 'Mosha level reversal (H4 key level tap, M5 external BO, limit at the next M5 BO zone, target the H4 engulf barrier), spot gold HistData M1',
    window: { from: '2020-01-01', split: '2024-01-01', to: '2026-10-31' }, params: K, candles: { m1: m.n, m5: M5.length, h4: H4.length, from: iso(M1[0].time), to: iso(M1.at(-1).time) }, variants: {} };
  const keep = {};
  for (const v of Object.keys(VARIANTS)) { const r = run(M5, H4, M1, v); keep[v] = r.orders; out.variants[v] = { funnel: r.funnel, ...summarize(r.orders) }; console.error(v, JSON.stringify(out.variants[v].all), 'IS', JSON.stringify(out.variants[v].is), 'OOS', JSON.stringify(out.variants[v].oos)); }
  // Holm over the four tests (one-sided p, mean net R > 0)
  const ps = Object.keys(VARIANTS).map((v) => [v, out.variants[v].p]).sort((a, b) => a[1] - b[1]); let run_ = 0;
  ps.forEach(([v, p], i) => { run_ = Math.max(run_, Math.min(1, p * (ps.length - i))); out.variants[v].pHolm = +run_.toFixed(4); });
  const vd = verdictOf(out.variants.P); out.primary = vd; out.variantsTried = 4;
  const P = out.variants.P;
  out.verdict = `${vd.verdict}: the pre-registered rule made ${P.all.avg >= 0 ? '+' : ''}${P.all.avg}R a trade after costs over ${P.all.n} trades (2020 to October 2026), t ${P.all.t}; in sample ${P.is.avg >= 0 ? '+' : ''}${P.is.avg}R (n ${P.is.n}), out of sample ${P.oos.avg >= 0 ? '+' : ''}${P.oos.avg}R (n ${P.oos.n})`;
  const label = { P: 'P: the pre-registered rule', W: 'W: wide stop (the whole origin)', T3: 'T3: fixed 3R target', F: 'F: order on the first (external) break' };
  out.candidates = Object.keys(VARIANTS).map((v) => ({ rule: label[v], verdict: v === 'P' ? vd.verdict : 'variant, reported only', is: out.variants[v].is, oos: out.variants[v].oos, years: out.variants[v].years }));
  out.trades = keep.P.filter((o) => o.status === 'closed' && o.placed >= K.FROM && o.placed < K.TO).sort((a, b) => a.closed - b.closed).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) { fs.mkdirSync(process.env.OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT_DIR, 'trades.json'), JSON.stringify(keep)); }
  console.error(out.verdict);
}
