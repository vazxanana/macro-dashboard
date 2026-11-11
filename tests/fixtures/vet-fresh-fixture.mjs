// Fixture for tests/veteran-fresh.test.mjs (and for the one-off comparison with main's code named there): synthetic weekday
// candles through 27 Nov 2026, a council-data folder with the candle cache ending on a chosen day and, optionally, the
// strategist's hand-over of closed days. No network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DAY = 86400, T = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000, iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const NOW = T(2026, 11, 11, 12);   // Wed 11 Nov 2026 12:00 UTC: Mon 9 and Tue 10 are complete, Wed 11 is forming
const wk = (t) => { const d = new Date(t * 1000).getUTCDay(); return d !== 0 && d !== 6; };
// weekday candles ending on `last` (a day start), newest value f(0)
const bars = (n, last, f) => { const out = []; let i = 0; for (let t = last; out.length < n; t -= DAY) { if (!wk(t)) continue; const c = +f(i).toFixed(2); out.unshift({ t, o: c - 3, h: c + 9, l: c - 11, c }); i++; } return out; };
export const TUE = T(2026, 11, 10), FRI = T(2026, 11, 6), END = T(2026, 11, 27);
export const ALL = bars(3013, END, (i) => 4000 * Math.exp(-(i - 13) * 0.0003) * (1 + 0.004 * Math.sin((i - 13) / 7)));   // every day to 27 Nov
export const GOLD = ALL.filter((b) => b.t <= TUE);     // every closed day up to Tuesday 10 Nov
export const FX = { eurusd: 1.1, usdjpy: 150, gbpusd: 1.27, usdcad: 1.36, usdchf: 0.88 };
const PAIRS = Object.fromEntries(Object.keys(FX).map((k) => [k, bars(413, END, (i) => FX[k] * (1 + 0.0004 * (i - 13)) * 100).map((b) => ({ ...b, o: b.o / 100, h: b.h / 100, l: b.l / 100, c: b.c / 100 }))]));
export const PAIR = (k, to = TUE) => PAIRS[k].filter((b) => b.t <= to);
export const rowsOf = (B, to) => B.filter((b) => b.t <= to).map((b) => [b.t, b.o, b.h, b.l, b.c, 1]);
export const handOf = (B, n = 30) => B.slice(-n).map((b) => [b.t, b.o, b.h, b.l, b.c]);
const series = (n, f, now) => { const out = []; let i = 0; for (let t = Math.floor(now / DAY) * DAY - DAY; out.length < n; t -= DAY) { if (!wk(t)) continue; out.unshift([iso(t), +f(i).toFixed(4)]); i++; } return out; };
export const cache = (now = NOW) => ({ fred: { DFII10: series(60, (i) => 2.6 + i * 0.016, now), DGS2: series(60, (i) => 4.46 + i * 0.016, now), DGS10: series(60, () => 4.84, now), T10YIE: series(60, () => 2.23, now), T10Y3M: series(60, () => 0.67, now), BAMLH0A0HYM2: series(60, () => 3.3, now), VIXCLS: series(60, () => 22, now), VXVCLS: series(60, () => 25.5, now), DTWEXBGS: series(60, () => 120, now), SOFR: series(60, () => 3.9, now), EFFR: series(60, () => 3.86, now) },
  cot: Array.from({ length: 30 }, (_, i) => ({ t: NOW - (30 - i) * 7 * DAY - 5 * DAY, net: 100000 + i * 1000 })) });
export const forecast = (o = {}, now = NOW, last = GOLD.at(-1).c) => ({ at: new Date((now - 600) * 1000).toISOString(), assets: { gold: { pUp: 0.54, fit: { base: 0.536 }, drivers: [], last } }, sources: { 'bars:gold': 'OANDA ok (1400 days)' },
  regime: { label: 'Dollar Smile middle' }, drivers: [{ k: 'ry', vote: -1, detail: '10Y TIPS 2.60%, falling' }], playbook: [],
  goldScore: { ok: true, asOf: '2026-11-06', score: 0.13, z: { ry4w: 1.43, dxy4w: -0.03 }, bias: 'AUCTION', conviction: null, label: 'AUCTION (no macro edge)', weeks: 1067 }, ...o });
// writes the inputs of one veteran run into `dir`: the candle cache ending on `cacheTo`; with `hand`, the strategist's closed days up to `handTo`
export function inputs(dir, { cacheTo = FRI, hand = true, handTo = TUE, fc = forecast(), now = NOW } = {}) {
  fs.mkdirSync(path.join(dir, 'macro'), { recursive: true }); fs.mkdirSync(path.join(dir, 'research', 'daily'), { recursive: true });
  const C = cache(now); if (hand) C.daily = { src: 'test', days: { xau: handOf(ALL.filter((b) => b.t <= handTo)), ...Object.fromEntries(Object.keys(FX).map((k) => [k, handOf(PAIR(k, handTo))])) } };
  fs.writeFileSync(path.join(dir, 'macro', 'forecast.json'), JSON.stringify(fc)); fs.writeFileSync(path.join(dir, 'macro', 'cache.json'), JSON.stringify(C));
  fs.writeFileSync(path.join(dir, 'research', 'daily', 'xau.json'), JSON.stringify({ rows: rowsOf(ALL, cacheTo) }));
  for (const k of Object.keys(FX)) fs.writeFileSync(path.join(dir, 'research', 'daily', `${k}.json`), JSON.stringify({ rows: rowsOf(PAIR(k, END), cacheTo) }));
  return dir;
}
export function folder({ calls = null, ledger = null, ...o } = {}) {
  const dir = inputs(fs.mkdtempSync(path.join(os.tmpdir(), 'vetfresh-')), o);
  if (calls) fs.writeFileSync(path.join(dir, 'macro', 'veteran-calls.json'), JSON.stringify(calls));
  if (ledger) fs.writeFileSync(path.join(dir, 'macro', 'veteran-ledger.json'), JSON.stringify(ledger));
  return dir;
}
export const rd = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, 'macro', f), 'utf8'));
// Two weeks of council runs, one a weekday at 12:00 UTC plus the Saturday after each week. `fresh`: the cache is refreshed on
// Saturdays only and the strategist hands over its closed days (this branch). Without it: the cache alone, as on main.
export const TWO_WEEKS = [9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21].map((d) => T(2026, 11, d, 12));
export function simulate(run, { fresh, days = TWO_WEEKS, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vetweeks-')), each = null } = {}) {
  for (const now of days) {
    const day0 = Math.floor(now / DAY) * DAY, sat = day0 - ((new Date(day0 * 1000).getUTCDay() + 1) % 7) * DAY;   // the Saturday on or before: the cache holds the closes before it
    const closed = ALL.filter((b) => b.t + DAY <= now).at(-1);
    inputs(dir, { cacheTo: sat - DAY, hand: !!fresh, handTo: closed.t, now, fc: forecast({}, now, closed.c * 0.99) });
    run({ dir, now, log: () => {} }); if (each) each(now, dir);
  }
  return dir;
}
// what calibration reads of a call, and what identifies it
export const issued = (L) => L.map((r) => [r.id, r.issued, r.src, r.kind, r.by, r.level, r.lo, r.hi, r.p, r.pRaw ?? null, r.baseP ?? null]);
