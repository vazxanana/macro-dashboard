// The numbers behind research/proposals/2026-11-12-path-to-live.md (12 Nov 2026). Paper research: reads committed study
// records only, changes nothing, tests no rule. Not a study: no hypothesis, no verdict. It answers arithmetic questions about
// the owner's two-system paper book (Gold trend + Gold daily engulf) from the supported-book study's own records:
//   - how long a forward record needs before it can prove the book (council/expect.mjs nVerdict), and
//   - what a forward record of 6 to 60 months looks like if the book is "as measured", has no edge, or loses, so that
//     stop rules can be fixed before the record exists (month-block bootstrap of the untouched 2006-17 daily book R), and
//   - what each risk-per-trade setting means in % of an account, and the smallest account the broker's minimum lot allows.
// Everything is net of spread, slippage and financing on every unit (supported-book run.mjs, council/fills.mjs).
//   node research/proposals/2026-11-12-path-to-live.mjs          → writes 2026-11-12-path-to-live.json beside this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, WINDOWS, COST, RATE, positions, daily, weekdays, drawdown, tOf, unitNet } from '../edge/supported-book/run.mjs';
import { describe, nVerdict, seBand } from '../../council/expect.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(HERE, '2026-11-12-path-to-live.json');
export const HORIZONS = [6, 12, 24, 36, 60];          // months of forward record
export const PROTOCOL_M = 36;                         // the protocol's length: three years
export const DRAWS = 20000, SEED = 12;
export const RISKS = [0.001, 0.0025, 0.005, 0.01];    // risk a unit, share of the account
export const GOLD = 4000;                             // gold price used for the size examples ($ an ounce, November 2026)
export const MIN_OZ = 1, MICRO_OZ = 10;               // broker minimum lot 0.01 = 1 oz (ctrader/symbols.json); micro future = 10 oz
// worlds: what is taken off every position's net R (in units of the measured mean R a position)
export const RECENT = Date.UTC(2025, 0, 1) / 1000;      // 'recent' stops: first units opened from 2025 (gold's wider ranges)
export const WORLDS = { expected: 0, none: 1, negative: 2 };

const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r1 = rN(1), r2 = rN(2), r3 = rN(3);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : null; };
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const quant = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];

// the book's months: each a list of that month's daily net R (weekdays), in order
export function monthsOf(days, v) { const m = new Map(); days.forEach((d, i) => { const k = d.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(v[i]); }); return [...m.values()]; }
// one forward path of H months: months drawn with replacement; returns the cumulative R at the end and the worst closed
// drawdown from the path's own high (the forward record starts at 0)
export function path1(months, H, rnd) {
  let c = 0, pk = 0, dd = 0;
  for (let j = 0; j < H; j++) for (const x of months[Math.floor(rnd() * months.length)]) { c += x; if (c > pk) pk = c; else if (pk - c > dd) dd = pk - c; }
  return { c, dd };
}
// DRAWS paths in one world, kept at every horizon up to the longest: cum[h] and dd[h] are arrays over the draws
export function simulate(months, horizons = HORIZONS, draws = DRAWS, seed = SEED) {
  const rnd = mulberry32(seed), H = Math.max(...horizons), cum = {}, dd = {};
  for (const h of horizons) { cum[h] = new Float64Array(draws); dd[h] = new Float64Array(draws); }
  for (let k = 0; k < draws; k++) {
    let c = 0, pk = 0, d = 0;
    for (let j = 1; j <= H; j++) {
      for (const x of months[Math.floor(rnd() * months.length)]) { c += x; if (c > pk) pk = c; else if (pk - c > d) d = pk - c; }
      if (cum[j]) { cum[j][k] = c; dd[j][k] = d; }
    }
  }
  return { cum, dd, draws };
}
const share = (arr, f) => { let n = 0; for (const x of arr) if (f(x)) n++; return n / arr.length; };
const sorted = (arr) => Array.from(arr).sort((a, b) => a - b);

export function build() {
  const legs = JSON.parse(fs.readFileSync(path.join(HERE, '../edge/supported-book/legs.json'), 'utf8')).units;
  const W = WINDOWS.W1, S = BOOKS.S2, days = weekdays(W.from, W.to), years = days.length / 261;
  const L = legs.filter((u) => S.includes(u.sys));
  const pos = positions(L).filter((p) => p.day >= W.from && p.day <= W.to);
  const st = describe(pos.map((p) => p.n)), perYear = pos.length / years;
  const v0 = daily(pos, days).v, dd0 = drawdown(v0);

  // ── how long until the forward record could PROVE the book (t >= 2), if the book is exactly as measured ──
  const nv = nVerdict(st.mean, st.sd, perYear, { capYears: 1e9 });
  const tDaily = tOf(v0), yearsDaily = years * (2 / tDaily) ** 2;

  // ── the three worlds ──
  const world = {};
  for (const [name, k] of Object.entries(WORLDS)) {
    const p2 = pos.map((p) => ({ ...p, n: p.n - k * st.mean }));
    world[name] = simulate(monthsOf(days, daily(p2, days).v));
    world[name].perYear = sum(p2.map((p) => p.n)) / years;
  }
  const E = world.expected;
  // gates, fixed from the "expected" world only
  const floor = Object.fromEntries(HORIZONS.map((h) => [h, quant(sorted(E.cum[h]), 0.05)]));          // 5th percentile of the total
  const ddStop = quant(sorted(E.dd[PROTOCOL_M]), 0.95);                                              // 95th percentile of the worst drawdown in the protocol
  const rows = {};
  for (const name of Object.keys(WORLDS)) {
    const X = world[name];
    rows[name] = { perYear: r2(X.perYear), horizons: Object.fromEntries(HORIZONS.map((h) => {
      const c = sorted(X.cum[h]), d = sorted(X.dd[h]);
      return [h, { trades: Math.round(perYear * h / 12), cum: { p5: r1(quant(c, 0.05)), p50: r1(quant(c, 0.5)), p95: r1(quant(c, 0.95)) }, pLoss: r3(share(X.cum[h], (x) => x < 0)),
        dd: { p50: r1(quant(d, 0.5)), p95: r1(quant(d, 0.95)) },
        belowFloor: r3(share(X.cum[h], (x) => x < floor[h])), ddStopHit: r3(share(X.dd[h], (x) => x > ddStop)) }];
    })) };
    // the whole protocol: stopped by the drawdown rule at any time in 36 months, OR under the floor at the 12 / 24 / 36-month checks
    let any = 0; for (let i = 0; i < X.draws; i++) if (X.dd[PROTOCOL_M][i] > ddStop || X.cum[12][i] < floor[12] || X.cum[24][i] < floor[24] || X.cum[36][i] < floor[36]) any++;
    rows[name].stoppedIn36 = r3(any / X.draws);
  }

  // ── risk a unit → % of the account (simple, not compounded) ──
  const SB = JSON.parse(fs.readFileSync(path.join(HERE, '../edge/supported-book/result.json'), 'utf8'));
  const w1 = SB.windows.W1.S2.x1F1;
  const ddLong = quant(sorted(simulate(monthsOf(days, v0), [120], DRAWS, SEED + 1).dd[120]), 0.95);   // 95th percentile of the worst drawdown in ten years
  const ref = { total: sum(v0), perYear: sum(v0) / years, ddClosed: dd0.dd, ddDays: dd0.len, ddRegained: dd0.regained, ddTenYears95: ddLong };
  const maxUnits = w1.inMarket.maxUnits, ddMarked = w1.marked.maxDD;
  const risk = RISKS.map((r) => ({ risk: r, perYearPct: r2(ref.perYear * r * 100), ddClosedPct: r2(ref.ddClosed * r * 100), ddMarkedPct: r2(ddMarked * r * 100), ddTenYears95Pct: r2(ddLong * r * 100), yearsUnder: r1(ref.ddDays / 261), maxOpenPct: maxUnits ? r2(maxUnits * r * 100) : null }));

  // ── the smallest size: stop distance as a share of price, per system, first units and adds ──
  const size = {};
  for (const s of S) {
    const U = L.filter((u) => u.sys === s), first = U.filter((u) => !u.of), adds = U.filter((u) => u.of);
    const one = (A) => { if (!A.length) return null; const sh = median(A.map((u) => u.r0 / u.e)), stop = sh * GOLD, nn = median(A.map((u) => unitNet(u).nights));
      return { units: A.length, stopShare: r3(sh * 100), stopUsd: r1(stop), minLotRiskUsd: r1(stop * MIN_OZ), microRiskUsd: r1(stop * MICRO_OZ), costR: r3(COST / stop), finNightR: r3(RATE * GOLD / stop), medianNights: nn,
        account: Object.fromEntries(RISKS.map((r) => [r, Math.round(stop * MIN_OZ / r)])), accountMicro: Object.fromEntries(RISKS.map((r) => [r, Math.round(stop * MICRO_OZ / r)])) }; };
    size[s] = { first: one(first), add: one(adds), recent: one(first.filter((u) => u.t >= RECENT)) };
  }

  return {
    built: '2026-11-12', rule: 'paper research only: no live rule, size, filter, stop or config changes; nothing here is a study verdict',
    source: 'research/edge/supported-book/legs.json (S2 = gtrend + geg, untouched 2006-07 to 2017-12, net of $0.30 a unit and financing on every unit)',
    book: { positions: pos.length, years: r2(years), perYearTrades: r2(perYear), perPosition: r3(st.mean), sd: r3(st.sd), tPosition: r2(st.t), tDaily: r2(tDaily), total: r1(ref.total), perYear: r2(ref.perYear),
      ddClosed: r1(ref.ddClosed), ddWeekdays: ref.ddDays, ddRegained: ref.ddRegained, ddMarked, ddTenYears95: r1(ddLong), maxUnits, months: monthsOf(days, v0).length },
    prove: { tradesForT2: nv.n, yearsForT2: r1(nv.n / perYear), yearsForT2Daily: r1(yearsDaily) },
    bands: Object.fromEntries([10, 29, 57, 86].map((n) => { const b = seBand(st.mean, st.sd, n); return [n, { lo: r2(b.lo), hi: r2(b.hi) }]; })),
    gates: { protocolMonths: PROTOCOL_M, ddStop: r1(ddStop), floor: Object.fromEntries(HORIZONS.map((h) => [h, r1(floor[h])])), draws: DRAWS, seed: SEED, method: 'month-block bootstrap of the untouched daily book R; "none" and "negative" take 1x and 2x the mean R a position off every position' },
    worlds: rows, risk, size, gold: GOLD,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = build();
  fs.writeFileSync(OUT, JSON.stringify(o, null, 1) + '\n');
  console.log(JSON.stringify(o, null, 1));
}
