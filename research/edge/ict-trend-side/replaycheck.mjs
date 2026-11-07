// Replay-window check (preregistration.md, a check, not the verdict): the live desk's own replay trades (council-data ict/replay.json,
// CNBC futures with the Dukascopy cash fill, A-setups only) with the pre-registered gate applied. The 200-day average is read from
// OANDA cash daily closes (dailyNY of the OANDA 5m cache) because the futures daily history (CNBC) is not reachable from the
// research sandbox; RTY has no such stand-in and is left out. Subtractive: F = U minus the dropped trades (the replay file does not
// hold the A-setups U skipped while busy, so trades F would add are not known). Same costs as run.mjs.
//   node research/edge/ict-trend-side/replaycheck.mjs <replay.json> <oanda5m cacheDir> [fromISO=2025-08-01] [toISO=2026-10-31] [out.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { inHalt, cmeShut, agg, dailyNY } from '../../../ict/tracker.mjs';
import { belowSma } from './gate.mjs';

const [RP, DIR, FROM = '2025-08-01', TO = '2026-10-31', OUT] = process.argv.slice(2);
const w0 = Date.parse(FROM) / 1000, w1 = Date.parse(TO) / 1000;
const SYM = { nq: 'nas100', es: 'spx500', ym: 'us30' }, COST = { nq: (p) => p * 0.0002 + 0.25, es: (p) => p * 0.0002 + 0.25, ym: (p) => p * 0.0002 + 1 };
function dailyOf(sym) {
  const m5 = [];
  for (const f of fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz') && +f.slice(sym.length + 1, sym.length + 5) >= 2023).sort())
    for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) if (!(inHalt(t) || cmeShut(t)) && o > 0 && c > 0) m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  return dailyNY(agg(m5.sort((a, b) => a.time - b.time), 3600));
}
function stats(a) {
  const r = [...a].sort((x, y) => x.closed - y.closed).map((x) => x.net), n = r.length; if (!n) return { n: 0, exp: null, R: 0, t: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
const J = JSON.parse(fs.readFileSync(RP, 'utf8')), D = Object.fromEntries(Object.entries(SYM).map(([k, s]) => [k, dailyOf(s)]));
const all = J.trades.filter((t) => t.aset && t.closed && t.R != null && t.signalAt >= w0 && t.signalAt < w1);
const T = all.filter((t) => SYM[t.market]).map((t) => { const side = t.side === 'buy' ? 1 : -1, size = t.size || 1, Rraw = t.Rraw ?? t.R, costR = COST[t.market](t.entry) / t.r0;
  const below = side < 0 ? belowSma({ side, close: t.signalAt }, D[t.market]) : null;
  return { market: t.market, side, closed: t.closed, signalAt: t.signalAt, size, net: size * (Rraw - costR), below, pass: side > 0 || below === true }; });
const out = { window: `${FROM}..${TO}`, replayAt: J.at, excluded: { rty: all.filter((t) => t.market === 'rty').length, gc: all.filter((t) => t.market === 'gc').length },
  U: stats(T), F: stats(T.filter((t) => t.pass)), dropped: stats(T.filter((t) => !t.pass)), sellsKept: stats(T.filter((t) => t.side < 0 && t.pass)), buys: stats(T.filter((t) => t.side > 0)),
  unknownSma: T.filter((t) => t.side < 0 && t.below == null).length,
  markets: Object.fromEntries(Object.keys(SYM).map((m) => { const a = T.filter((t) => t.market === m); return [m, { U: stats(a), F: stats(a.filter((t) => t.pass)), dropped: stats(a.filter((t) => !t.pass)) }]; })) };
const half = Date.UTC(2026, 2, 1) / 1000;   // reported halves: Aug 2025 - Feb 2026 and Mar - Oct 2026
out.halves = Object.fromEntries([['first', (t) => t.signalAt < half], ['second', (t) => t.signalAt >= half]].map(([k, f]) => { const a = T.filter(f); return [k, { U: stats(a), F: stats(a.filter((t) => t.pass)), dropped: stats(a.filter((t) => !t.pass)) }]; }));
out.consistent = out.dropped.n > 0 && out.dropped.exp <= 0 && out.F.exp > out.U.exp;
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
