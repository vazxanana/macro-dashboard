// Edge research · weekend-gap-duka: the real Sunday-reopen spread and Rule G (research/edge/fx-weekend-gap, #880, frozen
// byte for byte in frozen.mjs) on a second feed, Dukascopy, with bid / ask fills. Method, bar and stop rule: PREREGISTRATION.md
// (committed alone before this file existed).
// Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs probe   -> result.json   (coverage only: asks whether the files can be fetched, reads no price)
// The measurement and Test B run only after a probe that reached the files (PREREGISTRATION.md "Coverage probe"); on
// 14 Nov 2026 it did not, so the study stopped at the probe. The helpers below are the pre-registered mid / side-fill rules,
// tested offline (tests/weekend-gap-duka.test.mjs) so that a runner with access starts from checked code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SETS = {
  M: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'EURJPY'],
  X: ['EURGBP', 'GBPJPY', 'AUDJPY', 'EURAUD', 'GBPAUD', 'EURCHF'],
  N: ['NZDUSD', 'USDCAD', 'CADJPY', 'NZDJPY', 'AUDNZD', 'AUDCAD'],
};
export const PAIRS = [...SETS.M, ...SETS.X, ...SETS.N];
export const pip = (sym) => (/JPY$/.test(sym) ? 0.01 : 0.0001);
export const C = { SLIP_PIPS: 1, STRESS_EXTRA_PIPS: 0.5, COMM_SIDE: 22.5e-6, M5: 300, LAGS: [5, 35, 65, 125] };
const HOST = 'https://datafeed.dukascopy.com/datafeed';
const p2 = (n) => String(n).padStart(2, '0');
// one minute file of one side and UTC day (months 0-based, as council/duka.mjs)
export const m1Url = (sym, side, dayUnix) => { const d = new Date(dayUnix * 1000); return `${HOST}/${sym}/${d.getUTCFullYear()}/${p2(d.getUTCMonth())}/${p2(d.getUTCDate())}/${side}_candles_min_1.bi5`; };

// ─── mid candles: per minute present on both sides, each field averaged; a one-sided minute is dropped ───
export function midM1(bid, ask) {
  const A = new Map(ask.map((b) => [b.time, b])), out = [];
  for (const b of bid) { const a = A.get(b.time); if (!a) continue;
    out.push({ time: b.time, open: (b.open + a.open) / 2, high: (b.high + a.high) / 2, low: (b.low + a.low) / 2, close: (b.close + a.close) / 2 }); }
  return out;
}
// M1 -> M5 by 5-minute UTC bucket (open of the first minute, high max, low min, close of the last)
export function toM5(m1) {
  const out = [];
  for (const b of m1) { const t = b.time - (b.time % C.M5), c = out.at(-1);
    if (!c || c.time !== t) out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close });
    else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; } }
  return out;
}
// the spread (pips) of the close of the last minute present at or before moment T (a minute's close is at time + 60)
export function spreadAt(bid, ask, T, sym) {
  const A = new Map(ask.map((b) => [b.time, b]));
  for (let i = bid.length - 1; i >= 0; i--) { const b = bid[i]; if (b.time + 60 > T) continue; const a = A.get(b.time); if (a) return (a.close - b.close) / pip(sym); }
  return null;
}
// percentiles of a list (nearest rank on the sorted list, as the frozen placebo's q())
export function pct(a, f) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; }

// ─── one trade on the side that fills: entry on the ask (buy) / bid (sell), exits checked on the other side ───
// side +1 buy, -1 sell; levels (target, stop) are the frozen mid levels; exitBars = the exit side's M5 candles after the
// entry candle, in order, ending by endT. Stop first; a gapped open beyond the stop exits at that open.
export function simSide(side, entryFill, r0, target, stop, exitBars, endT) {
  let last = null;
  const done = (t, px, exit) => ({ exitT: t, exitPx: px, exit, R: (side * (px - entryFill)) / r0 });
  for (const b of exitBars) { if (b.time + C.M5 > endT) break;
    if (side > 0 ? b.open <= stop : b.open >= stop) return done(b.time, b.open, 'stop (gap)');
    if (side > 0 ? b.low <= stop : b.high >= stop) return done(b.time, stop, 'stop');
    if (side > 0 ? b.high >= target : b.low <= target) return done(b.time, target, 'target');
    last = b; }
  return last ? done(last.time + C.M5, last.close, 'time') : null;
}
// net R: slippage + commission only (the spread is paid inside R); extra = more pips a side (the stress cost)
export function netR(sym, R, entryFill, r0, extra = 0) { return R - (pip(sym) * 2 * (C.SLIP_PIPS + extra) + 2 * C.COMM_SIDE * entryFill) / r0; }
// Holm across the three sets (one-sided p): adjusted p in the input order
export function holmAdj(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = ps.slice(); let prev = 0;
  o.forEach(([p, i], r) => { prev = Math.min(1, Math.max(prev, (o.length - r) * p)); out[i] = prev; });
  return out;
}

// ─── the coverage probe: one request per file, status and size only, no price decoded ───
export const PROBE = [
  ['EURUSD', 'BID', Date.UTC(2024, 2, 10) / 1000], ['EURUSD', 'ASK', Date.UTC(2024, 2, 10) / 1000], ['EURUSD', 'ASK', Date.UTC(2012, 1, 8) / 1000],
  ['USDJPY', 'ASK', Date.UTC(2024, 2, 10) / 1000], ['AUDNZD', 'ASK', Date.UTC(2024, 2, 10) / 1000], ['EURGBP', 'ASK', Date.UTC(2010, 0, 10) / 1000],
];
export async function probe(fetchFn = fetch) {
  const rows = [];
  for (const [sym, side, day] of PROBE) { const url = m1Url(sym, side, day);
    try { const r = await fetchFn(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) }); const n = (await r.arrayBuffer()).byteLength;
      rows.push({ url, status: r.status, bytes: n, ok: r.status === 200 || r.status === 404 }); }
    catch (e) { rows.push({ url, status: null, error: `${e.message}${e.cause ? `: ${e.cause.code || e.cause.message || e.cause}` : ''}`, ok: false }); } }
  return { reachable: rows.every((r) => r.ok), rows };
}

const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
if (MODE === 'probe') {
  const p = await probe();
  const verdict = p.reachable ? 'PROBE PASSED: run the measurement (not written yet)' : 'NOT MEASURABLE (inconclusive: Dukascopy is not reachable from this runner)';
  const out = { topic: 'weekend-gap-duka', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Forex Sunday-gap fade Rule G (#880, frozen) on Dukascopy bid / ask: the reopen spread and bid / ask fills',
    prereg: 'research/edge/weekend-gap-duka/PREREGISTRATION.md', frozen: { file: 'frozen.mjs', of: 'research/edge/fx-weekend-gap/run.mjs (branch fx-weekend-gap, #880)', sha256: '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273' },
    sets: SETS, coverage: { reachable: p.reachable, probe: p.rows,
      proxy: 'egress proxy refused CONNECT to datafeed.dukascopy.com:443, www.dukascopy.com:443 and freeserv.dukascopy.com:443 (403, connect_rejected); plain http did not resolve (ENOTFOUND)',
      local: 'no Dukascopy forex bid / ask file in the repository, the council-data branch (only research/candles/nq-duka-*.json.gz, NQ) or on this machine' },
    measurementA: null, testB: null, feedCheck: null, placebo: null, verdict };
  if (!p.reachable) fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ reachable: p.reachable, verdict }), '\n' + p.rows.map((r) => JSON.stringify(r)).join('\n'));
}
