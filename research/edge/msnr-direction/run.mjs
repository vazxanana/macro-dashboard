// Edge research · msnr-direction (11 Nov 2026): does the owner's direction procedure (a structure-switching breakout on the
// working timeframe, accepted only when it is external and price first reached a key level one timeframe above), computed
// mechanically and with no look-ahead, say anything about gold's next daily closes beyond the base rate of the same period?
// A direction FILTER test: no entry, stop or exit is simulated. Everything here is fixed in PREREGISTRATION.md.
//   node run.mjs fetch <dir>            -> <dir>/xau-4h.json.gz (OANDA H4 through the candle proxy; kept out of git)
//   CANDLES=<dir> node run.mjs run      -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const P = { K: 2, ZONE_AGE: 60, WAIT: 10, H4: 14400, DATA_FROM: Date.UTC(2006, 5, 1) / 1000,
  A: ['2007-01-01', '2019-12-31'], B: ['2020-01-01', '2026-10-31'], HORIZONS: [1, 5, 20] };
export const LADDERS = { L1: 'working H4, key levels on the Daily', L2: 'working Daily, key levels on the Weekly' };

// ─── calendar: a day is the UTC date of the candle's open, Sunday (and a stray Saturday) counted into Monday ───
export function dayKey(t) { const d = new Date(t * 1000), w = d.getUTCDay(); let k = Math.floor(t / 86400) * 86400; if (w === 0) k += 86400; else if (w === 6) k += 2 * 86400; return k; }
export function weekKey(t) { const k = dayKey(t), w = new Date(k * 1000).getUTCDay(); return k - (w - 1) * 86400; }
// group candles (time order) into one candle per key; `time` is the key
export function group(bars, keyOf) {
  const out = [];
  for (const b of bars) { const k = keyOf(b.time), g = out.at(-1);
    if (g && g.time === k) { if (b.high > g.high) g.high = b.high; if (b.low < g.low) g.low = b.low; g.close = b.close; g.last = b.time; }
    else out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close, last: b.time }); }
  return out;
}

// ─── the call, candle by candle ───
// work: candles of the working timeframe in time order; keyOf: the higher-timeframe candle a working candle belongs to.
// Returns per working candle, as known at ITS close: call (+1 buy, -1 sell, 0 none), structure (side of the last plain
// breakout), and the events (for the tests and the report). Nothing at index i reads a candle after i.
export function calls(work, keyOf, opt = {}) {
  const K = opt.K ?? P.K, ZONE_AGE = opt.ZONE_AGE ?? P.ZONE_AGE, WAIT = opt.WAIT ?? P.WAIT;
  const n = work.length, call = new Int8Array(n), structure = new Int8Array(n), events = [];
  const H = [];                       // closed higher-timeframe candles
  let cur = null;                     // the higher-timeframe candle still forming
  let zones = [], pend = [];          // live key levels; taps waiting for their external level to break
  let lastA = null, lastV = null;     // most recent existing swing levels of the working timeframe { p, at, broken }
  let st = 0, dir = 0;
  const zoneLog = [];               // every key level made, for the tests and the report
  const addZone = (s, kind, bottom, top) => { if (top >= bottom) { zones.push({ s, kind, bottom, top, born: H.length, tapped: false, dead: false }); zoneLog.push({ s, kind, bottom, top, born: H.length }); } };
  const onHtfClose = () => {
    const c = H.at(-1), flips = [];
    // 1) the candle just closed against the zones that were live
    for (const z of zones) { if (z.dead) continue;
      if (z.s > 0 ? c.close < z.bottom : c.close > z.top) { z.dead = true; if (z.kind === 'eg') flips.push(z); }
      else if (H.length - z.born >= ZONE_AGE) z.dead = true; }
    zones = zones.filter((z) => !z.dead);
    // 2) zones this candle completes
    for (const z of flips) addZone(-z.s, 'ef', z.bottom, z.top);                      // failed engulfing: the other side's level
    const m = H.length - 1 - K;                                                       // swing candle confirmed by this close
    if (m >= K) { const x = H[m]; let lo = true, hi = true;
      for (let j = 1; j <= K; j++) { if (!(x.low <= H[m - j].low) || !(x.low < H[m + j].low)) lo = false; if (!(x.high >= H[m - j].high) || !(x.high > H[m + j].high)) hi = false; }
      if (lo) addZone(1, 'swing', x.low, Math.min(x.open, x.close));
      if (hi) addZone(-1, 'swing', Math.max(x.open, x.close), x.high); }
    if (H.length >= 2) { const p = H.at(-2), up = (b) => b.close > b.open, dn = (b) => b.close < b.open;
      if (up(c) && dn(p) && c.close > p.high) addZone(1, 'eg', Math.min(c.low, p.low), p.high);
      if (dn(c) && up(p) && c.close < p.low) addZone(-1, 'eg', p.low, Math.max(c.high, p.high));
      if (up(c) && up(p) && c.high > p.high && c.close > p.high) addZone(1, 'dom', p.open, p.close);
      if (dn(c) && dn(p) && c.low < p.low && c.close < p.low) addZone(-1, 'dom', p.close, p.open); }
  };
  for (let i = 0; i < n; i++) {
    const b = work[i], k = keyOf(b.time);
    if (!cur || cur.time !== k) { if (cur) { H.push(cur); onHtfClose(); } cur = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; }
    // switches: taps of EARLIER candles whose frozen external level this close breaks
    if (pend.length) { const keep = [];
      for (const q of pend) {
        if (q.zone.dead || H.length - q.tapH > WAIT) continue;
        if (q.s > 0 ? b.close > q.level : b.close < q.level) { if (dir !== q.s) events.push({ i, t: b.time, type: 'switch', s: q.s, kind: q.zone.kind, level: q.level, tapI: q.tapI }); dir = q.s; }
        else keep.push(q); }
      pend = keep; }
    // taps: the first candle whose range overlaps a live zone; structure and levels as they stood at this candle's open
    for (const z of zones) { if (z.tapped || b.low > z.top || b.high < z.bottom) continue;
      z.tapped = true; const L = z.s > 0 ? lastA : lastV;
      if (st === -z.s && L && !L.broken) { pend.push({ s: z.s, zone: z, level: L.p, tapI: i, tapH: H.length }); events.push({ i, t: b.time, type: 'tap', s: z.s, kind: z.kind, level: L.p }); } }
    // plain breakouts
    if (lastA && !lastA.broken && b.close > lastA.p) { lastA.broken = true; st = 1; }
    if (lastV && !lastV.broken && b.close < lastV.p) { lastV.broken = true; st = -1; }
    // a swing level K candles back exists from this close
    const m = i - K;
    if (m >= K) { const x = work[m]; let lo = true, hi = true;
      for (let j = 1; j <= K; j++) { if (!(x.low <= work[m - j].low) || !(x.low < work[m + j].low)) lo = false; if (!(x.high >= work[m - j].high) || !(x.high > work[m + j].high)) hi = false; }
      if (hi) lastA = { p: x.high, at: m, broken: false };
      if (lo) lastV = { p: x.low, at: m, broken: false }; }
    call[i] = dir; structure[i] = st;
  }
  return { call, structure, events, zoneLog };
}

// the call of each ladder at every daily close: { days, L1: { call, structure, switches }, L2: { ... } }
export function dailyCalls(h4) {
  const days = group(h4, dayKey), a = calls(h4, dayKey), b = calls(days, weekKey);
  const at = new Map(h4.map((x, i) => [x.time, i]));
  const pick = (arr) => Int8Array.from(days, (d) => arr[at.get(d.last)]);
  const sw = (r) => r.events.filter((e) => e.type === 'switch');
  return { days, L1: { call: pick(a.call), structure: pick(a.structure), switches: sw(a), events: a.events }, L2: { call: b.call, structure: b.structure, switches: sw(b), events: b.events } };
}

// ─── statistics ───
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
export function plainT(a) { const n = a.length; if (n < 3) return null; const m = mean(a), v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1); return v > 0 ? m / Math.sqrt(v / n) : null; }
// Newey-West t of the mean (Bartlett kernel, lag L)
export function neweyWestT(a, L) {
  const n = a.length; if (n < 3) return null; const m = mean(a), d = a.map((x) => x - m);
  let v = d.reduce((s, x) => s + x * x, 0) / n;
  for (let j = 1; j <= Math.min(L, n - 1); j++) { let g = 0; for (let i = j; i < n; i++) g += d[i] * d[i - j]; v += 2 * (1 - j / (L + 1)) * (g / n); }
  return v > 0 ? m / Math.sqrt(v / n) : null;
}
export function normP(t) {   // one-sided p of a normal t (mean > 0)
  if (t == null) return 1; const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  const up = 0.5 * (1 - erf); return t >= 0 ? up : 1 - up;
}
export const lagOf = (h) => Math.max(5, 2 * (h - 1));
const rd = (x, k = 4) => (x == null || !isFinite(x) ? null : +x.toFixed(k));
// one cell: the call series s (per day) against the forward log return over h daily closes, inside [from, to] (day keys)
export function cell(days, s, h, from, to) {
  const idx = []; for (let i = 0; i + h < days.length; i++) if (days[i].time >= from && days[i + h].time <= to) idx.push(i);
  const r = idx.map((i) => Math.log(days[i + h].close / days[i].close)), m = mean(r);
  const pUp = r.filter((x) => x > 0).length / (r.length || 1), pDn = r.filter((x) => x < 0).length / (r.length || 1);
  const e = [], eNo = []; let nBuy = 0, nSell = 0, hits = 0, sumBuy = 0, sumSell = 0;
  idx.forEach((i, j) => { const c = s[i]; if (!c) return; const x = c * (r[j] - m); e.push(x); if (j % h === 0) eNo.push(x);
    if (c > 0) { nBuy++; sumBuy += r[j]; } else { nSell++; sumSell += r[j]; } if (c * r[j] > 0) hits++; });
  const n = e.length, t = neweyWestT(e, lagOf(h));
  return { days: idx.length, n, nBuy, nSell, basePct: rd(m * 100), buyPct: nBuy ? rd(sumBuy / nBuy * 100) : null, sellPct: nSell ? rd(sumSell / nSell * 100) : null,
    excessPct: n ? rd(mean(e) * 100) : null, t: rd(t, 2), tNoOverlap: rd(plainT(eNo), 2), nNoOverlap: eNo.length,
    hit: n ? rd(hits / n * 100, 1) : null, hitBase: n ? rd((nBuy * pUp + nSell * pDn) / n * 100, 1) : null, p: rd(normP(t), 4) };
}
export function holm(ps) {   // [[key, p]] -> { key: adjusted p }
  const s = [...ps].sort((x, y) => x[1] - y[1]), out = {}; let top = 0;
  s.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (s.length - i))); out[k] = rd(top, 4); }); return out;
}
// the pre-registered bar, from the six tests { key: { a: cell, b: cell, pHolm } }
export function verdictOf(tests) {
  const ks = Object.keys(tests), raw = (k) => tests[k].b.t != null && tests[k].b.t >= 2 && tests[k].a.excessPct > 0;
  for (const k of ks) tests[k].pass = raw(k) && tests[k].pHolm < 0.05;
  return ks.some((k) => tests[k].pass) ? 'PASS' : ks.some(raw) ? 'INCONCLUSIVE' : 'FAIL';
}
export function study(h4) {
  const D = dailyCalls(h4), key = (d) => Date.parse(d + 'T00:00:00Z') / 1000, W = { a: P.A.map(key), b: P.B.map(key) };
  const grid = (field) => { const o = {}; for (const L of Object.keys(LADDERS)) for (const h of P.HORIZONS) o[`${L}-h${h}`] = { ladder: L, h, a: cell(D.days, D[L][field], h, ...W.a), b: cell(D.days, D[L][field], h, ...W.b) }; return o; };
  const tests = grid('call'), adj = holm(Object.keys(tests).map((k) => [k, tests[k].b.p]));
  for (const k of Object.keys(tests)) tests[k].pHolm = adj[k];
  const verdict = verdictOf(tests), states = {};
  for (const L of Object.keys(LADDERS)) { states[L] = {};
    for (const w of ['a', 'b']) { const ix = D.days.map((d, i) => i).filter((i) => D.days[i].time >= W[w][0] && D.days[i].time <= W[w][1]), c = D[L].call, n = ix.length;
      const T = (i) => D.days[i].time, sw = D[L].switches.filter((e) => { const t = dayKey(e.t); return t >= W[w][0] && t <= W[w][1]; });
      states[L][w] = { days: n, from: new Date(T(ix[0]) * 1000).toISOString().slice(0, 10), to: new Date(T(ix.at(-1)) * 1000).toISOString().slice(0, 10), buyPct: rd(ix.filter((i) => c[i] > 0).length / n * 100, 1), sellPct: rd(ix.filter((i) => c[i] < 0).length / n * 100, 1), nonePct: rd(ix.filter((i) => !c[i]).length / n * 100, 1), switches: sw.length, byKind: sw.reduce((o, e) => { o[e.kind] = (o[e.kind] || 0) + 1; return o; }, {}) }; } }
  return { D, tests, verdict, states, breakoutOnly: grid('structure') };
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://macro-dashboard-xau.vercel.app/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (MODE === 'fetch') {
  const OUT = process.argv[3], m = new Map(), end = Math.floor(Date.now() / 1000 / 86400) * 86400; fs.mkdirSync(OUT, { recursive: true });
  for (let a = P.DATA_FROM; a < end;) { const b = Math.min(end, a + 4999 * P.H4); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=4h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2500 * (k + 1)); }
    if (!j) throw new Error(`xau 4h ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(2500); }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(OUT, 'xau-4h.json.gz'), zlib.gzipSync(JSON.stringify(rows))); console.log(`4h: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'run') {
  const h4 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-4h.json.gz')))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const S = study(h4), sg = (x) => `${x >= 0 ? '+' : ''}${x}`;
  const line = (k) => { const T = S.tests[k]; return `${k} ${sg(T.b.excessPct)}% (t ${T.b.t}, n ${T.b.n}; 2007-19 ${sg(T.a.excessPct)}%, t ${T.a.t})`; };
  const best = Object.keys(S.tests).sort((x, y) => S.tests[y].b.t - S.tests[x].b.t)[0];
  const out = { topic: 'msnr-direction', built: '2026-11-11', at: new Date().toISOString(),
    system: 'MSNR direction call (external breakout on the working timeframe after a tap of a key level one timeframe above; H4 / Daily and Daily / Weekly), spot gold OANDA H4, direction filter test: no trades',
    window: { a: `${P.A[0]} to ${P.A[1]} (replication)`, b: `${P.B[0]} to ${P.B[1]} (confirmation)` }, params: P, ladders: LADDERS,
    candles: { h4: h4.length, days: S.D.days.length, from: iso(h4[0].time), to: iso(h4.at(-1).time) },
    unit: 'excessPct = mean of call x (forward log return - the window\'s mean forward return), in %, on the days with a call; t = Newey-West',
    tests: S.tests, states: S.states, breakoutOnly: S.breakoutOnly, variantsTried: 6,
    verdict: `${S.verdict}: ${S.verdict === 'FAIL' ? 'none of the six tests has t >= 2 in 2020-26 with the same sign in 2007-19' : S.verdict === 'PASS' ? 'at least one test passes the bar' : 'a test reaches t >= 2 with the same sign in 2007-19 but does not survive Holm'}; best ${line(best)}`,
    candidates: Object.keys(S.tests).map((k) => { const T = S.tests[k]; return { rule: `${k}: ${LADDERS[T.ladder]}, next ${T.h} daily close${T.h > 1 ? 's' : ''}; excess over the base rate ${sg(T.a.excessPct)}% (2007-19, t ${T.a.t}, ${T.a.n} days), ${sg(T.b.excessPct)}% (2020-26, t ${T.b.t}, ${T.b.n} days)`, verdict: T.pass ? 'PASS' : 'FAIL' }; }) };   // no is / oos stats: the lab reads those as R a trade, and nothing here is a trade
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(S.tests)) console.error(k, 'A', JSON.stringify(S.tests[k].a), '\n   B', JSON.stringify(S.tests[k].b), 'pHolm', S.tests[k].pHolm, S.tests[k].pass);
  for (const k of Object.keys(S.breakoutOnly)) console.error('BO-only', k, 'A', S.breakoutOnly[k].a.excessPct, S.breakoutOnly[k].a.t, 'B', S.breakoutOnly[k].b.excessPct, S.breakoutOnly[k].b.t);
  console.error(JSON.stringify(S.states)); console.error(out.verdict);
}
