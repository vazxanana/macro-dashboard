// research/edge/apex-entry-2020/run.mjs - the apex and continuation entries of PREREGISTRATION.md (23 Nov 2026).
// node research/edge/apex-entry-2020/run.mjs market <market> <outDir>   one market: signals, trades -> <outDir>/<market>.json
// node research/edge/apex-entry-2020/run.mjs cut <market> <cutDate>      the cut check on one market (prints the result)
// node research/edge/apex-entry-2020/run.mjs report <outDir>             pool the markets, apply the bar, write result.json
// Research only: imports edgekit and the combination grid's cost table and data-quality exclusions; places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions, GRID_MARKETS } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const MARKETS = GRID_MARKETS;
export const TESTS = ['T1', 'T2', 'T3', 'T4'];
export const TEST_NAME = { T1: 'Apex (no Daily close waited for)', T2: 'Low-risk apex (Daily rejection closed)', T3: 'Continuation, instant limit', T4: 'Continuation, after an H1 DC' };
const DAY = 86400;
// pips: gold 1 pip = $0.10; elsewhere the share of price $X is of $4,000
export const pips = (market, n, px) => (market === 'xau' ? n * 0.1 : (n * 0.1 / 4000) * px);
// management per test (stop and break-even in pips, target in R, order life, max hold)
export const PLAN = {
  T1: { stop: 30, tgtR: 4, bePips: 50, life: 10 * DAY, hold: 7 * DAY },
  T2: { stop: 30, tgtR: 4, bePips: 50, life: 10 * DAY, hold: 7 * DAY },
  T3: { stop: 20, tgtR: 2, beR: 1, life: 3 * DAY, hold: 2 * DAY },
  T4: { stop: 30, tgtR: 10 / 3, beR: 1, life: 3 * DAY, hold: 2 * DAY } };
const LOOKBACK = 500, MAX_USES = 4, STORY_MAX = 20 * DAY, REFINE_PIPS = 25;

// ---- frames and key levels -------------------------------------------------------------------------------------------
export function frames(M5) { return { m5: M5, h1: K.resample(M5, 3600), h4: K.resample(M5, 14400), d: K.dailyNY(M5) }; }
const bull = (b) => b.c > b.o, bear = (b) => b.c < b.o;
// key levels of two consecutive candles: A = bullish then bearish, V = bearish then bullish; the level = close of the first
export function levels(B) {
  const out = [];
  for (let k = 0; k + 1 < B.length; k++) {
    if (bull(B[k]) && bear(B[k + 1])) out.push({ k, type: 'A', price: B[k].c });
    else if (bear(B[k]) && bull(B[k + 1])) out.push({ k, type: 'V', price: B[k].c });
  }
  return out;
}
// fresh at the close of candle `to` (inclusive), walking from the candle after the pair
export function freshAt(B, lv, to) {
  let fresh = true, uses = 0;
  for (let x = lv.k + 2; x <= to; x++) {
    const b = B[x], lo = Math.min(b.o, b.c), hi = Math.max(b.o, b.c);
    if (lo <= lv.price && lv.price <= hi) fresh = true;
    else if (b.l <= lv.price && lv.price <= b.h) { if (fresh) uses++; fresh = false; }
  }
  return { fresh, uses };
}
const lastBefore = (arr, k) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].k <= k) lo = m + 1; else hi = m; } return lo - 1; };

// ---- storyline signals (T1 and T2) -----------------------------------------------------------------------------------
// returns { t1: [...], t2: [...] }; a signal: { test, side, day, L, touchT, hk, ext, b, sigT, apex, target }
export function signals(F, { from = -Infinity } = {}) {
  const { m5: M5, h4: H4, d: D } = F;
  const DL = levels(D); const st = DL.map(() => ({ fresh: true, uses: 0 }));
  const H4L = levels(H4); const A4 = H4L.filter((x) => x.type === 'A'), V4 = H4L.filter((x) => x.type === 'V');
  const out = { t1: [], t2: [] };
  let lvFrom = 0;
  for (let i = 1; i < D.length; i++) {
    const day = D[i];
    while (lvFrom < DL.length && DL[lvFrom].k < i - LOOKBACK) lvFrom++;
    // candidates: levels whose pair closed before day i (k + 1 <= i - 1)
    if (day.e > from) for (const side of [1, -1]) {
      let best = null, bestDrd = null;
      for (let q = lvFrom; q < DL.length && DL[q].k + 1 <= i - 1; q++) {
        const lv = DL[q], s = st[q]; if (!s.fresh || s.uses > MAX_USES - 1) continue; // at most 3 uses so far: this touch is at most the 4th
        const p = lv.price;
        const touched = side > 0 ? p < day.o && day.l <= p : p > day.o && day.h >= p;
        if (!touched) continue;
        if (!best || side * (p - best.price) > 0) best = lv;                 // highest support / lowest resistance
        const drd = side > 0 ? day.c > p : day.c < p;
        if (drd && (!bestDrd || side * (p - bestDrd.price) > 0)) bestDrd = lv;
      }
      for (const [kind, lv] of [['t1', best], ['t2', bestDrd]]) {
        if (!lv) continue;
        const sg = setup(F, A4, V4, i, side, lv.price, kind, DL, st, lvFrom);
        if (sg) out[kind].push(sg);
      }
    }
    // update the levels' state with day i (pairs whose second candle is before i)
    for (let q = lvFrom; q < DL.length && DL[q].k + 1 < i; q++) {
      const p = DL[q].price, b = day, lo = Math.min(b.o, b.c), hi = Math.max(b.o, b.c);
      if (lo <= p && p <= hi) st[q].fresh = true;
      else if (b.l <= p && p <= b.h) { if (st[q].fresh) st[q].uses++; st[q].fresh = false; }
    }
  }
  for (const k of ['t1', 't2']) out[k] = out[k].filter((x) => x.sigT > from).sort((a, b) => a.sigT - b.sigT);
  return out;
}

function setup(F, A4, V4, i, side, L, kind, DL, st, lvFrom) {
  const { m5: M5, h4: H4, d: D } = F; const day = D[i];
  // touch moment: the first 5-minute candle of the day at or beyond L
  let x = K.closedCount(M5, day.t); while (x < M5.length && M5[x].t < day.t) x++;
  let touchT = null; for (; x < M5.length && M5[x].t < day.e; x++) if (side > 0 ? M5[x].l <= L : M5[x].h >= L) { touchT = M5[x].t; break; }
  if (touchT == null) return null;
  const hk = K.barAt(H4, touchT); if (hk < 1) return null;
  // external level: the last H4 A (buys) / V (sells) whose pair closed before the touch H4 candle opened, beyond L
  const pool = side > 0 ? A4 : V4; const ei = lastBefore(pool, hk - 2); if (ei < 0) return null;
  const ext = pool[ei]; if (!(side * (ext.price - L) > 0)) return null;
  const winEnd = i + 1 < D.length ? D[i + 1].e : day.e + 3 * DAY;
  let b = -1; for (let j = hk; j < H4.length && H4[j].e <= winEnd; j++) if (side > 0 ? H4[j].c >= ext.price : H4[j].c <= ext.price) { b = j; break; }
  if (b < 0) return null;
  const sigT = kind === 't2' ? Math.max(H4[b].e, day.e) : H4[b].e;
  // apex: the lowest H4 V (buys) / highest A (sells) with its pair from hk-6 to b
  const ap = side > 0 ? V4 : A4; let apex = null;
  for (let q = Math.max(0, lastBefore(ap, hk - 7) + 1); q < ap.length && ap[q].k + 1 <= b; q++) {
    if (ap[q].k < hk - 6) continue;
    if (!apex || side * (apex.price - ap[q].price) > 0) apex = ap[q];
  }
  if (!apex) return null;
  if (!(side * (H4[b].c - apex.price) > 0)) return null;
  const upTo = K.closedCount(H4, sigT) - 1;
  if (!freshAt(H4, apex, upTo).fresh) return null;
  // the target level: the nearest fresh Daily level beyond the breakout close (state at the start of the touch day)
  let target = null;
  for (let q = lvFrom; q < DL.length && DL[q].k + 1 <= i - 1; q++) {
    if (!st[q].fresh || st[q].uses >= MAX_USES) continue; const p = DL[q].price;
    if (side * (p - H4[b].c) > 0 && (target == null || side * (target - p) > 0)) target = p;
  }
  return { test: kind === 't1' ? 'T1' : 'T2', side, day: day.date, L, touchT, hk, ext: ext.price, b, boT: H4[b].e, sigT, apex: apex.price, apexK: apex.k, target };
}

// the first moment after t a 5-minute candle reaches `px` in direction `side`, or null
function reachT(M5, t, px, side, until) {
  if (px == null) return null;
  let x = K.closedCount(M5, t); while (x < M5.length && M5[x].t < t) x++;
  for (; x < M5.length && M5[x].t < until; x++) if (side > 0 ? M5[x].h >= px : M5[x].l <= px) return M5[x].t;
  return null;
}

// orders of T1 / T2 at the apex
export function apexOrders(F, list) {
  const out = [];
  list.forEach((sg, n) => {
    const opp = list.find((o, m) => m > n && o.side === -sg.side && o.sigT > sg.sigT);
    const tReach = reachT(F.m5, sg.sigT, sg.target, sg.side, sg.sigT + PLAN.T1.life);
    const expire = Math.min(sg.sigT + PLAN.T1.life, tReach ?? Infinity, opp ? opp.sigT : Infinity);
    out.push({ test: sg.test, side: sg.side, entry: sg.apex, placeT: sg.sigT, expire, src: sg.day });
  });
  return out;
}

// storylines from T2 signals
export function storylines(F, t2) {
  const H4 = F.h4;
  return t2.map((sg, n) => {
    const next = t2.find((o, m) => m > n && o.sigT > sg.sigT);
    let end = Math.min(sg.sigT + STORY_MAX, next ? next.sigT : Infinity);
    const tReach = reachT(F.m5, sg.sigT, sg.target, sg.side, end); if (tReach != null) end = Math.min(end, tReach);
    for (let j = K.closedCount(H4, sg.sigT); j < H4.length && H4[j].e <= end; j++) if (sg.side > 0 ? H4[j].c < sg.apex : H4[j].c > sg.apex) { end = H4[j].e; break; }
    return { ...sg, end };
  });
}

// continuation candidates of one storyline: { side, level, orderT, end, h4 } (level refined to H1 where the notes say)
export function candidates(F, story, market) {
  const { h4: H4, h1: H1 } = F; const s = story.side; const out = []; let prev = story.apex;
  for (let j = story.b + 2; j < H4.length && H4[j].e <= story.end; j++) {
    const a = H4[j - 1], c = H4[j];
    const isLv = s > 0 ? bear(a) && bull(c) : bull(a) && bear(c); if (!isLv) continue;
    if (c.e < story.sigT) continue;                // known before the storyline started
    const L4 = a.c; if (!(s * (L4 - prev) > 0)) continue;
    prev = L4;
    const orderT = c.e; let level = L4, refined = false;
    // H1 refinement: a fresh H1 level of the same type, pair inside the H4 pair's hours, within 25 pips, on the price's side
    const lim = pips(market, REFINE_PIPS, L4); const to = K.closedCount(H1, orderT) - 1;
    for (let x = K.closedCount(H1, a.t); x + 1 <= to; x++) {
      const p = H1[x], q = H1[x + 1]; if (p.t < a.t || q.e > orderT) continue;
      if (!(s > 0 ? bear(p) && bull(q) : bull(p) && bear(q))) continue;
      const v = p.c; if (Math.abs(v - L4) > lim || !(s * (c.c - v) > 0)) continue;
      if (!freshAt(H1, { k: x, price: v }, to).fresh) continue;
      if (!refined || s * (v - level) > 0) { level = v; refined = true; }
    }
    out.push({ side: s, level, h4: L4, refined, orderT, end: story.end });
  }
  return out;
}
// the H1 DC of a candidate: the first H1 touch must close back on the level's side with a body against the trade
export function dcOf(F, cd) {
  const H1 = F.h1; const s = cd.side, E = cd.level; const until = Math.min(cd.end, cd.orderT + PLAN.T4.life);
  for (let x = K.closedCount(H1, cd.orderT); x < H1.length && H1[x].e <= until; x++) {
    const b = H1[x]; if (b.t < cd.orderT) continue;
    if (!(s > 0 ? b.l <= E : b.h >= E)) continue;
    const ok = s > 0 ? b.o > E && b.c > E && b.c < b.o : b.o < E && b.c < E && b.c > b.o;
    return ok ? b.e : null;
  }
  return null;
}

// ---- one trade on 5-minute candles, with break-even ----------------------------------------------------------------
// tr: { side, entry, stop, target, be (price that moves the stop to the entry, or null), placeT, expire, hold }
export function sim(tr, M5) {
  const s = tr.side, E = tr.entry, risk = s * (E - tr.stop);
  if (!(risk > 0) || !(s * (tr.target - E) > 0)) return { status: 'bad' };
  let i = K.closedCount(M5, tr.placeT); while (i < M5.length && M5[i].t < tr.placeT) i++;
  let fill = null;
  for (; i < M5.length; i++) {
    const b = M5[i]; if (b.t >= tr.expire) return { status: 'nofill' };
    if (s > 0 ? b.l <= E : b.h >= E) { fill = s > 0 ? Math.min(b.o, E) : Math.max(b.o, E); break; }
    if (s > 0 ? b.c < tr.stop : b.c > tr.stop) return { status: 'nofill' };
  }
  if (fill == null) return { status: 'nofill' };
  const fi = i, fillT = M5[fi].t, deadline = fillT + tr.hold;
  const done = (px, at, why) => ({ status: 'done', fillT, fill, exit: px, exitT: at, why, risk, R: (s * (px - fill)) / risk });
  if (s * (fill - tr.stop) <= 0) return done(fill, fillT, 'gap');
  let stop = tr.stop, beArmed = false;
  for (let j = fi; j < M5.length; j++) {
    const b = M5[j], first = j === fi;
    if (beArmed) stop = E;
    if (!first) {
      if (s * (b.o - stop) <= 0) return done(b.o, b.t, stop === E && beArmed ? 'be' : 'stop');
      if (s * (b.o - tr.target) >= 0) return done(b.o, b.t, 'target');
    }
    if (s > 0 ? b.l <= stop : b.h >= stop) return done(stop, b.e, beArmed ? 'be' : 'stop');
    if (!first) {
      if (s > 0 ? b.h >= tr.target : b.l <= tr.target) return done(tr.target, b.e, 'target');
      if (tr.be != null && (s > 0 ? b.h >= tr.be : b.l <= tr.be)) beArmed = true;
    }
    if (b.e >= deadline) return done(b.c, b.e, 'time');
  }
  return { status: 'open' };
}

function orderOf(test, market, side, entry, placeT, expire) {
  const P = PLAN[test]; const S = pips(market, P.stop, entry);
  const stop = entry - side * S, target = entry + side * P.tgtR * S;
  const be = P.bePips != null ? entry + side * pips(market, P.bePips, entry) : entry + side * P.beR * S;
  return { test, side, entry, stop, target, be, placeT, expire, hold: P.hold };
}

// ---- one market ------------------------------------------------------------------------------------------------------
export function allOrders(F, market, { from = -Infinity } = {}) {
  const S = signals(F, { from: from - 30 * DAY });
  const orders = [];
  for (const o of apexOrders(F, S.t1)) orders.push(orderOf('T1', market, o.side, o.entry, o.placeT, o.expire));
  for (const o of apexOrders(F, S.t2)) orders.push(orderOf('T2', market, o.side, o.entry, o.placeT, o.expire));
  const ST = storylines(F, S.t2); const cands = [];
  for (const story of ST) for (const cd of candidates(F, story, market)) {
    cands.push(cd);
    orders.push(orderOf('T3', market, cd.side, cd.level, cd.orderT, Math.min(cd.end, cd.orderT + PLAN.T3.life)));
    const dc = dcOf(F, cd);
    if (dc != null) { cd.dcT = dc; orders.push(orderOf('T4', market, cd.side, cd.level, dc, Math.min(cd.end, dc + PLAN.T4.life))); }
  }
  return { S, ST, cands, orders };
}

export function runMarket(market, { to } = {}) {
  const from = MARKETS.indexOf(market) >= 10 ? '2019-01-01' : '2018-01-01';
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5);
  const { S, ST, cands, orders } = allOrders(F, market, { from: START });
  const cost = COSTS[market], X = exclusions(market);
  const inBad = (t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
  const trades = []; let dropped = 0, nofill = 0, open = 0;
  for (const test of TESTS) {
    const done = orders.filter((o) => o.test === test).map((o) => ({ o, r: sim(o, M5) }))
      .filter(({ r }) => { if (r.status === 'nofill') nofill++; if (r.status === 'open') open++; return r.status === 'done'; })
      .sort((a, b) => a.r.fillT - b.r.fillT);
    let busy = -Infinity;
    for (const { o, r } of done) {
      if (r.fillT < START) continue;
      if (r.fillT < busy) continue;               // one position at a time per market and test
      busy = r.exitT;
      if (X.length && inBad(r.fillT)) { dropped++; continue; }
      const cr = cost / r.risk;
      trades.push({ test, market, side: o.side, t: r.fillT, exitT: r.exitT, why: r.why, R: +r.R.toFixed(4), Rnet: +(r.R - cr).toFixed(4), Rnet2: +(r.R - 2 * cr).toFixed(4) });
    }
  }
  return { market, bars: M5.length, last: new Date(M5[M5.length - 1].e * 1000).toISOString(), signals: { t1: S.t1.length, t2: S.t2.length, storylines: ST.length, candidates: cands.length, dc: cands.filter((c) => c.dcT).length, refined: cands.filter((c) => c.refined).length },
    orders: orders.length, nofill, open, dropped, trades };
}

// the cut check: signals, candidates and DCs known before the cut must not change when later candles are removed
export function cutCheck(market, cut) {
  const from = MARKETS.indexOf(market) >= 10 ? '2019-01-01' : '2018-01-01'; const c = Date.parse(cut + 'T00:00:00Z') / 1000;
  const key = (x) => JSON.stringify(x);
  const pick = (A) => ({ sig: [...A.S.t1, ...A.S.t2].filter((x) => x.sigT < c).map((x) => key([x.test, x.side, x.L, x.ext, x.b, x.sigT, x.apex])),
    cand: A.cands.filter((x) => x.orderT < c).map((x) => key([x.side, x.level, x.orderT])), dc: A.cands.filter((x) => x.dcT != null && x.dcT < c).map((x) => key([x.level, x.dcT])) });
  const full = frames(K.load(market, '5m', { from })), part = frames(K.load(market, '5m', { from, to: cut }));
  const A = pick(allOrders(full, market, { from: START })), B = pick(allOrders(part, market, { from: START }));
  const same = (p, q) => p.length === q.length && p.every((x, n) => x === q[n]);
  // a storyline that ends after the cut may lose a later candidate in the cut copy, never an earlier one; compare the sets
  return { market, cut, signals: A.sig.length, candidates: A.cand.length, dcs: A.dc.length, ok: same(A.sig, B.sig) && same(A.cand.sort(), B.cand.sort()) && same(A.dc.sort(), B.dc.sort()) };
}

// ---- report ----------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
function block(trades, key = 'Rnet') {
  const s = K.stats(trades, { key, time: 't' });
  const f = (o) => ({ n: o.n, wins: o.wins, meanR: r4(o.meanR), total: r2(o.total), tTrade: r2(o.tTrade), tMonth: r2(o.tMonth), months: o.months });
  return { all: f(s), disc: f(s.IS), conf: f(s.OOS) };
}
export function report(dir, markets = MARKETS) {
  const per = markets.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const all = per.flatMap((p) => p.trades);
  const tests = {};
  for (const T of TESTS) {
    const tr = all.filter((x) => x.test === T); const net = block(tr), gross = block(tr, 'R'), two = block(tr, 'Rnet2');
    const gold = block(tr.filter((x) => x.market === 'xau'));
    const byMarket = Object.fromEntries(markets.map((m) => { const b = block(tr.filter((x) => x.market === m)).all; return [m, { n: b.n, meanR: b.meanR, tMonth: b.tMonth }]; }));
    const why = tr.reduce((o, x) => ((o[x.why] = (o[x.why] || 0) + 1), o), {});
    // descriptive only (not part of the bar): the pool without silver, whose round trip is larger than its scaled stop
    const ex = tr.filter((x) => x.market !== 'xag'); const exSilver = { net: block(ex).all, gross: block(ex, 'R').all };
    tests[T] = { name: TEST_NAME[T], net, gross, twice: two, gold, byMarket, exits: why, exSilver };
  }
  // the bar; Holm over the four tests on the one-sided confirmation p of the month-sum t
  const p1 = (t, df) => { if (t == null || !(df > 0)) return 1; const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };
  const ps = TESTS.map((T) => p1(tests[T].net.conf.tMonth, tests[T].net.conf.months - 1)); const adj = K.holm(ps);
  TESTS.forEach((T, n) => {
    const x = tests[T], d = x.net.disc, c = x.net.conf;
    x.pConf = r4(ps[n]); x.holm = r4(adj[n]);
    x.checks = { discN: d.n >= 100, discMean: d.meanR > 0, discT: d.tMonth >= 2, confN: c.n >= 50, confMean: c.meanR > 0, confT: c.tMonth >= 2, holm: adj[n] < 0.05, twiceCost: x.twice.conf.meanR > 0 };
    x.pass = Object.values(x.checks).every(Boolean); x.judged = d.n >= 100;
  });
  const passed = TESTS.filter((T) => tests[T].pass), judged = TESTS.filter((T) => tests[T].judged);
  const verdict = passed.length ? 'PASS' : judged.length ? 'FAIL' : 'INCONCLUSIVE';
  const line = (T) => { const c = tests[T].net.all; return `${T} n ${c.n}, ${c.meanR >= 0 ? '+' : ''}${c.meanR.toFixed(3)}R, month t ${c.tMonth}`; };
  const headline = `${verdict}, ${passed.length} of 4 tests pass: ${TESTS.map(line).join('; ')} (2020-now, 18 markets, after costs).`;
  const meta = Object.fromEntries(per.map((p) => [p.market, { bars: p.bars, last: p.last, signals: p.signals, orders: p.orders, nofill: p.nofill, open: p.open, dropped: p.dropped, trades: p.trades.length }]));
  return { study: 'apex-entry-2020', built: '2026-11-23', verdict, headline, window: '2020-01-01 to the last candle; discovery 2020-2023, confirmation 2024 on', markets, plan: PLAN, tests, meta };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(out));
    console.log(a, JSON.stringify(out.signals), 'trades', out.trades.length, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') console.log(JSON.stringify(cutCheck(a, b)));
  else if (cmd === 'report') { const R = report(a); const cutF = path.join(a, 'cut.json'); if (fs.existsSync(cutF)) R.cut = JSON.parse(fs.readFileSync(cutF, 'utf8'));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n'); console.log(R.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <YYYY-MM-DD> | report <dir>');
}
