// research/edge/storyline-pairs-2020/run.mjs - the pre-registered storyline pairs study (PREREGISTRATION.md, 23 Nov 2026).
// Research only: nothing live imports this, nothing is placed. Candles: the overnight toolkit cache (outside git).
//   node research/edge/storyline-pairs-2020/run.mjs cut           the no-look-ahead check (orders before a cut, 3 markets)
//   node research/edge/storyline-pairs-2020/run.mjs run [out.json] every market, the six tests, result.json in this folder
// Every rule is the pre-registration's, in code; readings where its text is silent are in READINGS. Nothing was searched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { weekly, GRID_MARKETS, COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { K: 2, m5K: 2, win5: 24, rr: 3, hold: { D: 120 * 3600, W: 240 * 3600 }, life: { D: 10, W: 8 }, m15Win: 2 * 3600, minRiskX: 2 };
export const PAIRS = ['D', 'W'];                    // D: level D1, break H1; W: level W1, break H4
export const SETUPS = ['qm', 'rbs', 'gap'];
export const CONFS = ['m5', 'm15', 'none'];         // m5 = tested; m15 and none = reported only
export const TESTS = [['D', 'qm'], ['D', 'rbs'], ['D', 'gap'], ['W', 'qm'], ['W', 'rbs'], ['W', 'gap']].map(([p, s]) => p + '-' + s);
export const MARKETS = GRID_MARKETS;
export const DISC = [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000];
export const READINGS = [
  'A weekly candle ends at the Friday 17:00 New York close of its week (also in a week whose Friday is a holiday), so a week that is still running never counts as closed; the weeks themselves are the Monday-Friday groups of `weekly` (combo-grid-2).',
  'An H candle counts as closed only when its end is at or before the end of the last 5-minute candle on file.',
  'The external break window ends at the close of the H candle after the rejection candle; an L close above the rejected level (below for a buy) inside that window before the break voids the storyline.',
  'The touch moment is the start of the first 5-minute candle of the rejecting H candle that reaches the level; the L candle holding that moment opens the break leg.',
  'The "next airport" end uses the nearest H level of the other kind (a V for a sell) below the break close that is known at the start and whose first touch comes at or after the start; the storyline ends at the start of that 5-minute touch candle.',
  'An opposite storyline of the same pairing ends the older one at its start; storylines of the same side may overlap, each with its own setups (the one-position rule then keeps one trade at a time).',
  'M5 QM: the first QM of the side (edgekit qms, swing size 2) whose breaking candle index is in [touch, touch + 23] and whose head candle index is at or after the touch candle; entry = its shoulder (the swept level), stop = its head + half the round trip.',
  'A limit order expires at the earliest of 24 M5 candles after the QM close, the end of the first M5 candle closing beyond the head, and the storyline end.',
  'M15 rejection (reported only): the M15 candles from the one holding the touch moment to those starting within 2 hours after it; the first that reaches the level and closes back is the signal; the 1:3 target is set from that candle close.',
  'No confirmation (reported only): the limit rests from the storyline start to its end; stop = the leg head + half the round trip.',
  'One position at a time per stream (pairing x setup x confirmation) and market; a resting order blocks until it fills, expires or is cancelled; orders are taken in order-time order.',
];

const lb = (arr, t, f) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(arr[m]) < t) lo = m + 1; else hi = m; } return lo; };

// ---- frames ----------------------------------------------------------------------------------------------------------
export function weeks(D) {
  return weekly(D).map((w) => {
    const day = Math.floor((w.e - 1) / 86400); const wd = new Date(day * 86400e3).getUTCDay();
    const fri = (day + ((5 - wd + 7) % 7)) * 86400; // the Friday of that week (UTC date)
    const e = fri + 17 * 3600 + K.nyOffsetH(fri + 21 * 3600) * 3600;
    return { t: w.t, o: w.o, h: w.h, l: w.l, c: w.c, e: Math.max(e, w.e) };
  });
}
export function framesOf(B5) {
  const D = K.dailyNY(B5);
  return { B5, D, W: weeks(D), H4: K.resample(B5, 14400), H1: K.resample(B5, 3600), M15: K.resample(B5, 900) };
}

// A / V levels on closes, swing size k: side -1 = A (resistance), +1 = V (support); known at the close of candle i + k.
export function avLevels(X, k = P.K) {
  const out = [];
  for (let i = k; i + k < X.length; i++) {
    let a = true, v = true; const c = X[i].c;
    for (let j = 1; j <= k; j++) {
      if (!(c > X[i - j].c && c >= X[i + j].c)) a = false;
      if (!(c < X[i - j].c && c <= X[i + j].c)) v = false;
    }
    if (a) out.push({ i, side: -1, price: c, known: X[i + k].e });
    if (v) out.push({ i, side: 1, price: c, known: X[i + k].e });
  }
  return out;
}

// first touch of each H level (from candle i + k + 1 on): H index, and the 5-minute candle index inside it
function firstTouches(H, B5, levels, lastE, k = P.K) {
  for (const L of levels) {
    L.tH = -1; L.t5 = -1; L.tT = Infinity;
    for (let x = L.i + k + 1; x < H.length; x++) {
      const b = H[x]; const hit = L.side < 0 ? b.h >= L.price : b.l <= L.price;
      if (!hit) continue;
      const a = lb(B5, b.t, (q) => q.t), z = lb(B5, b.e, (q) => q.t);
      for (let y = a; y < z; y++) if (L.side < 0 ? B5[y].h >= L.price : B5[y].l <= L.price) { L.t5 = y; L.tT = B5[y].t; break; }
      if (L.t5 >= 0) L.tH = x; // a touch inside the H candle on the 5-minute candles (always, the H candle is built from them)
      break;
    }
    L.closedTouch = L.tH >= 0 && H[L.tH].e <= lastE;
  }
}

// ---- storylines of one pairing ----------------------------------------------------------------------------------------
export function storylines(F, pair) {
  const B5 = F.B5, H = pair === 'D' ? F.D : F.W, L = pair === 'D' ? F.H1 : F.H4;
  const lastE = B5[B5.length - 1].e;
  const HL = avLevels(H); firstTouches(H, B5, HL, lastE);
  const LL = avLevels(L); const LLk = [...LL].sort((a, b) => a.known - b.known);
  const out = [];
  for (const lv of HL) {
    if (!lv.closedTouch) continue;
    const r = H[lv.tH]; const s = lv.side; // a rejected A (side -1) gives a sell (-1)
    const rejected = lv.side < 0 ? r.c < lv.price : r.c > lv.price;
    if (!rejected) continue;
    const touchT = lv.tT;
    // external level: the last L level of the far kind (V for a sell) confirmed at or before the touch moment
    let ext = null;
    for (let x = lb(LLk, touchT + 1, (q) => q.known) - 1; x >= 0; x--) if (LLk[x].side === (s < 0 ? 1 : -1)) { ext = LLk[x]; break; }
    if (!ext) continue;
    const winEnd = lv.tH + 1 < H.length ? H[lv.tH + 1].e : r.e;
    let tk = K.barAt(L, touchT); if (tk < 0) continue;
    let bk = -1;
    for (let x = tk; x < L.length && L[x].e <= winEnd && L[x].e <= lastE; x++) {
      const c = L[x].c;
      if (s < 0 ? c > lv.price : c < lv.price) break;           // back beyond the rejected level: void
      if (s < 0 ? c < ext.price : c > ext.price) { bk = x; break; }
    }
    if (bk < 0) continue;
    const start = Math.max(r.e, L[bk].e);
    // end: H close beyond the level, next airport, life (opposite storylines below)
    const lifeI = lv.tH + P.life[pair];
    let end = lifeI < H.length ? H[lifeI].e : Infinity;
    for (let x = lv.tH + 1; x < H.length && H[x].e < end; x++) if (s < 0 ? H[x].c > lv.price : H[x].c < lv.price) { end = H[x].e; break; }
    let air = null; const bc = L[bk].c;
    for (const o of HL) {
      if (o.side !== (s < 0 ? 1 : -1) || o.known > start || !(o.tT >= start)) continue;
      if (!(s * (o.price - bc) > 0)) continue;                 // ahead of the break close
      if (air == null || s * (o.price - air.price) < 0) air = o; // the nearest ahead
    }
    if (air && air.tT < end) end = air.tT;
    // the break leg
    let headI = tk; for (let x = tk; x <= bk; x++) if (s < 0 ? L[x].h > L[headI].h : L[x].l < L[headI].l) headI = x;
    const head = s < 0 ? L[headI].h : L[headI].l;
    const setups = {};
    // QM: left shoulder = the most recent L level of the near kind before the head candle, known by the break close
    for (let x = lb(LL, headI, (q) => q.i) - 1; x >= 0; x--) {
      const q = LL[x]; if (q.i >= headI || q.side !== (s < 0 ? -1 : 1) || q.known > L[bk].e) continue;
      if (s * (q.price - head) > 0 && s * (q.price - ext.price) < 0) { setups.qm = q.price; break; } // between the external level and the head
    }
    setups.rbs = ext.price;
    for (let x = bk; x >= tk + 1; x--) {
      const a = L[x - 1], b = L[x];
      if (s < 0 ? a.c < a.o && b.c < b.o : a.c > a.o && b.c > b.o) { if (s * (a.c - bc) < 0) setups.gap = a.c; break; } // behind the break close (above it for a sell)
    }
    out.push({ pair, side: s, level: lv.price, rejT: r.e, touchT, ext: ext.price, breakT: L[bk].e, start, end, head, setups, air: air ? air.price : null });
  }
  out.sort((a, b) => a.start - b.start);
  for (const x of out) { const o = out.find((y) => y.side !== x.side && y.start > x.start); if (o && o.start < x.end) x.end = o.start; }
  return out;
}

// ---- orders --------------------------------------------------------------------------------------------------------
// every order: { stream: 'D-qm-m5', pair, setup, conf, side, entry, stop, target, t, type, expire, hold, touchT, sl }
export function orders(F, cost, sls = null) {
  const B5 = F.B5, M15 = F.M15, lastE = B5[B5.length - 1].e, buf = cost / 2;
  const QM = new Map(); for (const q of K.qms(B5, P.m5K)) { const a = QM.get(q.i) || []; a.push(q); QM.set(q.i, a); }
  const out = [];
  const all = sls || [...storylines(F, 'D'), ...storylines(F, 'W')];
  for (const S of all) {
    const s = S.side, hold = P.hold[S.pair];
    for (const setup of SETUPS) {
      const lvl = S.setups[setup]; if (lvl == null) continue;
      // first touch of the setup level after the start
      let tI = -1;
      for (let x = lb(B5, S.start, (q) => q.t); x < B5.length && B5[x].t < S.end; x++) if (s < 0 ? B5[x].h >= lvl : B5[x].l <= lvl) { tI = x; break; }
      const base = { pair: S.pair, setup, side: s, touchT: tI >= 0 ? B5[tI].t : null, sl: S.start, level: lvl, hold };
      // no confirmation: a limit at the level from the start
      { const entry = lvl, stop = S.head - s * buf; const rk = s * (entry - stop);
        if (rk >= P.minRiskX * cost) out.push({ ...base, stream: `${S.pair}-${setup}-none`, conf: 'none', entry, stop, target: entry + s * P.rr * rk, t: S.start, type: 'limit', expire: S.end }); }
      if (tI < 0) continue;
      // M5 QM confirmation
      let got = null;
      for (let x = tI; x <= tI + P.win5 - 1 && x < B5.length && !got; x++) for (const q of QM.get(x) || []) if (q.side === s && q.headI >= tI && s * (q.head - lvl) <= 0) { got = q; break; }
      if (got && got.t <= lastE) {
        const entry = got.shoulder, stop = got.head - s * buf, rk = s * (entry - stop);
        if (rk >= P.minRiskX * cost) {
          let expire = Math.min(got.t + P.win5 * 300, S.end);
          for (let x = got.i + 1; x < B5.length && B5[x].t < expire; x++) if (s < 0 ? B5[x].c > got.head : B5[x].c < got.head) { expire = Math.min(expire, B5[x].e); break; }
          out.push({ ...base, stream: `${S.pair}-${setup}-m5`, conf: 'm5', entry, stop, target: entry + s * P.rr * rk, t: got.t, type: 'limit', expire });
        }
      }
      // M15 rejection candle (reported only)
      const tT = B5[tI].t;
      for (let m = lb(M15, Math.floor(tT / 900) * 900, (q) => q.t); m < M15.length && M15[m].t <= tT + P.m15Win; m++) {
        const b = M15[m]; if (b.e > lastE || b.e > S.end) break;
        if ((s < 0 ? b.h >= lvl && b.c < lvl : b.l <= lvl && b.c > lvl)) {
          const stop = (s < 0 ? b.h : b.l) - s * buf, rk = s * (b.c - stop);
          if (rk >= P.minRiskX * cost) out.push({ ...base, stream: `${S.pair}-${setup}-m15`, conf: 'm15', entry: b.c, stop, target: b.c + s * P.rr * rk, t: b.e, type: 'market', expire: null });
          break;
        }
      }
    }
  }
  return out.sort((a, b) => a.t - b.t || (a.stream < b.stream ? -1 : 1));
}

// ---- trades --------------------------------------------------------------------------------------------------------
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export function trades(F, ords, cost, market, X = []) {
  const busy = new Map(), out = []; let dropped = 0;
  for (const o of ords) {
    if ((busy.get(o.stream) ?? -Infinity) > o.t) continue;
    const r = K.simulate({ side: o.side, entry: o.entry, stop: o.stop, target: o.target, t: o.t, type: o.type, expire: o.expire, maxHold: o.hold }, F.B5, {});
    if (r.status === 'nofill' || r.status === 'bad') { busy.set(o.stream, o.type === 'limit' ? o.expire : o.t); continue; }
    busy.set(o.stream, r.status === 'open' ? Infinity : r.exitT);
    if (r.status === 'open') continue;
    if (X.length && inBad(X, r.fillT)) { dropped++; continue; }
    out.push({ market, stream: o.stream, pair: o.pair, setup: o.setup, conf: o.conf, side: o.side, fillT: r.fillT, exitT: r.exitT, reason: r.reason,
      R: r.R, Rnet: r.R - cost / r.risk, R2: r.R - 2 * cost / r.risk, risk: r.risk });
  }
  return { trades: out, dropped };
}

// ---- statistics on fixed month grids ---------------------------------------------------------------------------------
export function monthGrid(from, to) { const out = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  while (Date.UTC(y, m, 1) / 1000 < to) { out.push(`${y}-${String(m + 1).padStart(2, '0')}`); m === 11 ? (y++, (m = 0)) : m++; } return out; }
export function win(tr, from, to, key = 'Rnet') {
  const xs = tr.filter((x) => x.fillT >= from && x.fillT < to && Number.isFinite(x[key]));
  const grid = monthGrid(from, to); const ms = new Map(grid.map((k) => [k, 0]));
  for (const x of xs) { const k = new Date(x.fillT * 1000).toISOString().slice(0, 7); ms.set(k, (ms.get(k) || 0) + x[key]); }
  const v = [...ms.values()], n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  const total = xs.reduce((a, x) => a + x[key], 0);
  const p1 = t == null ? null : (t > 0 ? K.pFromT(t, n - 1) / 2 : 1 - K.pFromT(t, n - 1) / 2);
  return { n: xs.length, wins: xs.filter((x) => x[key] > 0).length, meanR: xs.length ? total / xs.length : null, total, months: n, tMonth: t, p1 };
}

export function judge(tests, holmP) {
  return tests.map((x, i) => { const d = x.disc, c = x.conf;
    const pass = d.n >= 100 && d.meanR > 0 && d.tMonth >= 2 && c.n >= 50 && c.meanR > 0 && c.tMonth >= 2 && holmP[i] < 0.05 && x.disc2.meanR > 0 && x.conf2.meanR > 0;
    return { ...x, holm: holmP[i], enough: d.n >= 100 && c.n >= 50, pass }; });
}
export function verdictOf(J) { return J.some((x) => x.pass) ? 'PASS' : J.some((x) => x.enough) ? 'FAIL' : 'INCONCLUSIVE'; }

// ---- commands ------------------------------------------------------------------------------------------------------
const key = (o) => [o.stream, o.side, o.t, +o.entry.toFixed(8), +o.stop.toFixed(8), +o.target.toFixed(8)].join('|');
export function cutCheck(B5, cost, cut) {
  const A = orders(framesOf(B5), cost).filter((o) => o.t < cut - 3 * 86400).map(key);
  const B = orders(framesOf(B5.filter((b) => b.e <= cut)), cost).filter((o) => o.t < cut - 3 * 86400).map(key);
  const sa = new Set(A), sb = new Set(B);
  return { compared: A.length, onlyFull: A.filter((x) => !sb.has(x)).length, onlyCut: B.filter((x) => !sa.has(x)).length };
}

function main(cmd) {
  if (cmd === 'cut') {
    const res = {};
    for (const m of ['xau', 'eurusd', 'nas100']) { const B5 = K.load(m, '5m', { from: '2019-01-01', to: '2023-01-01' }); res[m] = cutCheck(B5, COSTS[m], Date.UTC(2022, 5, 15) / 1000); console.log(m, res[m]); }
    fs.writeFileSync(path.join(HERE, 'cut.json'), JSON.stringify({ cut: '2022-06-15', from: '2019-01-01', to: '2023-01-01', res }, null, 1));
    return;
  }
  const cut = fs.existsSync(path.join(HERE, 'cut.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'cut.json'), 'utf8')) : null;
  const all = [], perMarket = {}; let lastT = 0;
  for (const m of MARKETS) {
    const t0 = Date.now();
    const B5 = K.load(m, '5m', { from: '2018-01-01' }); const F = framesOf(B5); lastT = Math.max(lastT, B5[B5.length - 1].e);
    const sls = [...storylines(F, 'D'), ...storylines(F, 'W')];
    const ords = orders(F, COSTS[m], sls);
    const { trades: tr, dropped } = trades(F, ords, COSTS[m], m, exclusions(m));
    for (const x of tr) if (x.fillT >= DISC[0]) all.push(x);
    const sl20 = sls.filter((x) => x.start >= DISC[0]);
    perMarket[m] = { first: new Date(B5[0].t * 1000).toISOString().slice(0, 10), last: new Date(B5[B5.length - 1].e * 1000).toISOString(), storylines: { D: sl20.filter((x) => x.pair === 'D').length, W: sl20.filter((x) => x.pair === 'W').length },
      setups: Object.fromEntries(SETUPS.map((s) => [s, sl20.filter((x) => x.setups[s] != null).length])), orders: ords.filter((o) => o.t >= DISC[0]).length, dropped };
    console.error(m, perMarket[m].storylines, tr.length, 'trades', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const END = lastT + 1;
  const streams = {}; for (const p of PAIRS) for (const s of SETUPS) for (const c of CONFS) streams[`${p}-${s}-${c}`] = null;
  const block = (tr) => ({ disc: win(tr, DISC[0], DISC[1]), conf: win(tr, DISC[1], END), disc2: win(tr, DISC[0], DISC[1], 'R2'), conf2: win(tr, DISC[1], END, 'R2'),
    discBefore: win(tr, DISC[0], DISC[1], 'R'), confBefore: win(tr, DISC[1], END, 'R') });
  for (const k of Object.keys(streams)) { const tr = all.filter((x) => x.stream === k);
    streams[k] = { pool: block(tr), xau: block(tr.filter((x) => x.market === 'xau')), buys: block(tr.filter((x) => x.side > 0)), sells: block(tr.filter((x) => x.side < 0)),
      byMarket: Object.fromEntries(MARKETS.map((m) => { const t = tr.filter((x) => x.market === m); return [m, { disc: win(t, DISC[0], DISC[1]), conf: win(t, DISC[1], END) }]; })),
      byYear: Object.fromEntries([2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => { const w = win(tr, Date.UTC(y, 0, 1) / 1000, Math.min(Date.UTC(y + 1, 0, 1) / 1000, END)); return [y, { n: w.n, meanR: w.meanR, total: w.total }]; })) }; }
  const T = TESTS.map((k) => ({ test: k, ...streams[k + '-m5'].pool }));
  const H = K.holm(T.map((x) => x.conf.p1)); const J = judge(T, H); const verdict = verdictOf(J);
  const r4 = (x) => (x == null ? null : +x.toFixed(4));
  const best = [...J].sort((a, b) => (b.conf.tMonth ?? -9) - (a.conf.tMonth ?? -9))[0];
  const headline = `${verdict === 'PASS' ? 'PASS' : verdict === 'FAIL' ? 'FAIL, 0 of 6' : 'INCONCLUSIVE'}: best confirmation ${best.test} ${r4(best.conf.meanR)}R a trade after costs (n ${best.conf.n}, month t ${best.conf.tMonth?.toFixed(2)}).`;
  const res = { study: 'storyline-pairs-2020', verdict, headline, built: new Date().toISOString(), params: P, readings: READINGS, markets: MARKETS, end: new Date(lastT * 1000).toISOString(),
    windows: { discovery: ['2020-01-01', '2023-12-31'], confirmation: ['2024-01-01', new Date(lastT * 1000).toISOString().slice(0, 10)] }, cut,
    tests: J.map((x) => ({ test: x.test, pass: x.pass, enough: x.enough, holm: r4(x.holm), disc: x.disc, conf: x.conf, disc2: x.disc2, conf2: x.conf2, discBefore: x.discBefore, confBefore: x.confBefore })),
    streams, perMarket, trades: all.length };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(6) : v), 1));
  console.log(headline);
  for (const x of J) console.log(x.test, 'disc', x.disc.n, r4(x.disc.meanR), x.disc.tMonth?.toFixed(2), '| conf', x.conf.n, r4(x.conf.meanR), x.conf.tMonth?.toFixed(2), 'holm', r4(x.holm), x.pass ? 'PASS' : '');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2] || 'run');
