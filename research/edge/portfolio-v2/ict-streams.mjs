// Portfolio v2, step 1: the ICT desk's live A-setup stream and its four shadow streams (dip, nofri, h1opp, strail) on
// OANDA 5m mid candles 2007-06 .. 2026-10 (the #526 cache, research/edge/ict-oos-2008/fetch.mjs). Drives the desk's own code,
// unchanged: signals / isASetup / sizeOf / isDip / variantRule / SHADOW / inHalt / cmeShut / agg / dailyNY from ict/tracker.mjs,
// simulate from ict/replay.mjs, with the same one-open-trade rules as ict/replay.mjs. Costs as #526 (one round trip in price).
// Paper research only.
//   node research/edge/portfolio-v2/ict-streams.mjs <cacheDir> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, MIN_GRADE, SHADOW, signals, isASetup, sizeOf, isDip, variantRule, loadMeridian, inHalt, cmeShut, agg, dailyNY } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';

const [DIR, OUT] = process.argv.slice(2);
if (!DIR || !OUT) { console.error('usage: ict-streams.mjs <cacheDir> <out.json>'); process.exit(1); }
const U = {
  gc: { sym: 'xau', cost: () => 0.5 },
  nq: { sym: 'nas100', cost: (p) => p * 0.0002 + 0.25 },
  es: { sym: 'spx500', cost: (p) => p * 0.0002 + 0.25 },
  ym: { sym: 'us30', cost: (p) => p * 0.0002 + 1 },
};
function load(sym) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort(), m5 = [];
  for (const f of files) for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
    if (inHalt(t) || cmeShut(t)) continue;
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  }
  return m5.sort((a, b) => a.time - b.time);
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

const ms = await loadMeridian();
const out = { at: new Date().toISOString(), src: {}, cols: ['stream', 'market', 'side', 'signal', 'closed', 'size', 'Rraw', 'costR'], trades: [] };
for (const [key, u] of Object.entries(U)) {
  const t0 = Date.now(), M = MARKETS[key], m5 = load(u.sym), H = agg(m5, 3600), D = dailyNY(H);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
  const sim = (g, mk, opt) => { const i = lb(H, g.close), j = lb(m5, g.close);
    return simulate(g, mk, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days }, Infinity, opt); };
  const push = (stream, g, t, size) => out.trades.push([stream, key, g.side, g.close, t.closed, size, t.R, +(u.cost(g.entry) / g.r0).toFixed(4)]);
  const n0 = out.trades.length;
  // live A-setups: an A-setup is blocked only by an open A-setup; a non-A signal by any open trade (ict/replay.mjs)
  { let busyAll = 0, busyA = 0;
    for (const g of sig) { const a = isASetup(g, key); if (g.close < (a ? busyA : busyAll)) continue;
      const t = sim(g, M, {}); if (!t || !t.closed) continue;
      if (a) push('ict_a', g, t, sizeOf(g, key));
      busyAll = Math.max(busyAll, t.closed); if (a) busyA = t.closed; } }
  // shadow 'dip' (NQ/ES): size 1, no break-even, gold exit (simulate with an aRule), its own one-open rule
  if (SHADOW.dip.markets.includes(key)) { let busy = 0;
    for (const g of sig) { if (g.close < busy || !isDip(g, key, D)) continue; const t = sim(g, { ...M, aRule: 'dip' }, {}); if (!t || !t.closed) continue;
      push('ict_dip', g, t, 1); busy = t.closed; } }
  // shadows 'nofri' / 'h1opp' / 'strail': the A-setup rule plus one condition (strail: another exit), own one-open rule, A sizing
  for (const v of ['nofri', 'h1opp', 'strail']) { if (!SHADOW[v].markets.includes(key)) continue;
    const ctx = { H, D, ms }; let busy = 0;
    for (const g of sig) { if (g.close < busy || !variantRule(v, g, key, ctx)) continue;
      const t = sim(g, M, v === 'strail' ? { strail: [SHADOW.strail.from, SHADOW.strail.piv] } : {}); if (!t || !t.closed) continue;
      push('ict_' + v, g, t, sizeOf(g, key)); busy = t.closed; } }
  out.src[key] = { sym: u.sym, m5: m5.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10), signals: sig.length, trades: out.trades.length - n0 };
  console.log(key, JSON.stringify(out.src[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('trades', out.trades.length, '->', OUT);
