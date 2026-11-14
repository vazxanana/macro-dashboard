// Drift in the 24 hours before US CPI and payrolls (gold and the dollar). Pre-registered in PREREGISTRATION.md (pushed before
// any candle was fetched or any return computed). Paper research only: nothing live reads this.
//
//   node --use-env-proxy research/edge/pre-release-drift/run.mjs fetch <dir>   OANDA mid M5 + H1 from the site's proxy (out of git)
//   node research/edge/pre-release-drift/run.mjs full <dir>                     writes result.json and RESULT.md next to this file
//
// A stand-alone event rule, never a gate / exit / entry / size of the live gold book (owner decision 44).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
export const MARKETS = ['xau', 'eurusd', 'usdjpy', 'gbpusd'];
export const TYPES = ['CPI', 'NFP'];
export const CELLS = ['xau', 'eurusd', 'usdjpy', 'gbpusd', 'usd'];   // usd = long-USD basket: short EUR/USD, long USD/JPY, short GBP/USD
export const BASKET = [['eurusd', -1], ['usdjpy', 1], ['gbpusd', -1]];
export const P = { lead: 86400, lag: 300, back: 1800, atrN: 14, stopK: 1, runs: 40, minN: 20, near: 48 * 3600 };
const H1 = 3600, M5 = 300;

// ── events: council/event-base.json rows only ──
export function loadEvents(root = ROOT) {
  const eb = JSON.parse(fs.readFileSync(path.join(root, 'council/event-base.json'), 'utf8'));
  const ev = {}; for (const ty of TYPES) ev[ty] = eb.rows.filter((r) => r.type === ty).map((r) => ({ d: r.d, t: r.t })).sort((a, b) => a.t - b.t);
  // every release time to keep placebo days away from (event-base rows, missing, dropped; events.mjs CPI / NFP / FOMC)
  const rel = new Set(eb.rows.map((r) => r.t));
  for (const m of [...eb.missing, ...eb.dropped.map((x) => ({ d: x.d, type: 'CPI' }))]) rel.add(zonedToUtc(m.d, m.type === 'FOMC' ? '14:00' : '08:30', 'America/New_York'));
  for (const e of [...HISTORY, ...EVENTS]) if (['CPI', 'NFP', 'FOMC'].includes(e.type)) rel.add(e.t);
  return { ev, rel: [...rel].sort((a, b) => a - b), built: eb.built };
}

// ── candles: { t: Int array (opening second), o, h, l, c } + index by time ──
export function series(rows) {
  const s = { t: rows.map((r) => r[0]), o: rows.map((r) => r[1]), h: rows.map((r) => r[2]), l: rows.map((r) => r[3]), c: rows.map((r) => r[4]) };
  s.ix = new Map(s.t.map((t, i) => [t, i])); return s;
}
// index of the candle that ENDS at x (opens x - tf); else the last one ending in the `back` seconds before x; null if none
export function endingAt(s, x, tf, back = P.back) {
  for (let o = x - tf; o >= x - tf - back; o -= tf) { const i = s.ix.get(o); if (i != null) return i; }
  return null;
}
// ATR(n) on H1: simple mean of true range of the n most recent H1 candles that CLOSED at or before t
export function atrH1(h, t, n = P.atrN) {
  let j = endingAt(h, Math.floor(t / H1) * H1, H1, 6 * H1); if (j == null || j < n) return null;
  let s = 0; for (let k = j - n + 1; k <= j; k++) s += Math.max(h.h[k] - h.l[k], Math.abs(h.h[k] - h.c[k - 1]), Math.abs(h.l[k] - h.c[k - 1]));
  return s / n;
}
// one leg's window for release time T: start and end candle indices (end never later than T - 5 min)
export function windowAt(m5, T) {
  const a = endingAt(m5, T - P.lead, M5), b = endingAt(m5, T - P.lag, M5);
  if (a == null || b == null || b <= a) return null;
  return { a, b, start: m5.c[a], end: m5.c[b], tStart: m5.t[a] + M5, tEnd: m5.t[b] + M5 };
}
export const driftPct = (w) => 100 * (w.end / w.start - 1);
// manage a trade from the candle after the entry candle through the end candle; stop first (gap at the open, else the stop)
export function manage(m5, w, dir, stop) {
  for (let i = w.a + 1; i <= w.b; i++) {
    const o = m5.o[i];
    if (dir > 0 ? o <= stop : o >= stop) return { exit: o, how: 'stop-gap', at: m5.t[i] };
    if (dir > 0 ? m5.l[i] <= stop : m5.h[i] >= stop) return { exit: stop, how: 'stop', at: m5.t[i] };
  }
  return { exit: w.end, how: 'time', at: w.tEnd };
}
export function costOf(mk, px) {                       // the frozen cpi-follow model, a round trip in price
  if (mk === 'xau') return 0.30;
  const pip = mk === 'usdjpy' ? 0.01 : 0.0001;
  return 0.3 * pip + 4.5e-5 * px + 2 * pip;
}
// one leg: dir +1 long the pair, -1 short
export function leg(mk, d, T, dir, costK = 1) {
  const w = windowAt(d.m5, T); if (!w) return null;
  const atr = atrH1(d.h1, w.tStart); if (!(atr > 0)) return null;
  const entry = w.start, stop = entry - dir * P.stopK * atr, risk = Math.abs(entry - stop), x = manage(d.m5, w, dir, stop);
  const gross = dir * (x.exit - entry) / risk;
  const fin = mk === 'xau' && dir > 0 ? nights(w.tStart, x.at) * FIN.xau.long * entry : 0;
  const cost = (costOf(mk, entry) + fin) * costK;
  return { entry, stop, exit: x.exit, how: x.how, risk, drift: driftPct(w), gross, net: gross - cost / risk, costR: cost / risk, finR: fin / risk, tStart: w.tStart, tEnd: w.tEnd };
}
// a cell's long-USD drift (gold: long gold) for release T; null when a leg cannot be priced
export function cellDrift(cell, data, T) {
  if (cell === 'xau') { const w = windowAt(data.xau.m5, T); return w ? driftPct(w) : null; }
  const legs = cell === 'usd' ? BASKET : [[cell, cell === 'usdjpy' ? 1 : -1]];
  let s = 0; for (const [mk, sg] of legs) { const w = windowAt(data[mk].m5, T); if (!w) return null; s += sg * driftPct(w); }
  return s / legs.length;
}
// a cell's trade for release T in USD direction usdDir (+1 long USD; gold: always long)
export function cellTrade(cell, data, T, usdDir, costK = 1) {
  if (cell === 'xau') { const r = leg('xau', data.xau, T, 1, costK); return r && { net: r.net, gross: r.gross, costR: r.costR, finR: r.finR, how: r.how, drift: r.drift }; }
  const legs = cell === 'usd' ? BASKET : [[cell, cell === 'usdjpy' ? 1 : -1]], rs = [];
  for (const [mk, sg] of legs) { const r = leg(mk, data[mk], T, sg * usdDir, costK); if (!r) return null; rs.push(r); }
  const mean = (k) => rs.reduce((s, r) => s + r[k], 0) / rs.length;
  return { net: mean('net'), gross: mean('gross'), costR: mean('costR'), finR: 0, how: rs.map((r) => r.how).join('+'), drift: cellDrift(cell, data, T) };
}
// the whole rule on a list of release times (date order): first half picks the USD direction, then every event is traded
export function runCell(cell, data, times, costK = 1) {
  const ok = times.filter((T) => cellDrift(cell, data, T) != null && cellTrade(cell, data, T, 1) != null);
  const k = Math.floor(ok.length / 2), first = ok.slice(0, k);
  const dIS = first.map((T) => cellDrift(cell, data, T)), mIS = dIS.length ? dIS.reduce((s, x) => s + x, 0) / dIS.length : 0;
  const usdDir = cell === 'xau' ? 1 : (mIS >= 0 ? 1 : -1);
  const ev = ok.map((T, i) => ({ T, half: i < k ? 'IS' : 'OOS', drift: cellDrift(cell, data, T), ...cellTrade(cell, data, T, usdDir, costK) }));
  return { usdDir, ev, skipped: times.length - ok.length };
}

// ── statistics (as cpi-follow) ──
export function tstat(a) { const n = a.length; if (n < 2) return { n, mean: n ? a[0] : null, t: null };
  const m = a.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return { n, mean: m, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null }; }
function betacf(a, b, x) { let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c; aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function pOne(t, df) { if (t == null) return 1; const p2 = ibeta(df / (df + t * t), df / 2, 0.5); return t > 0 ? p2 / 2 : 1 - p2 / 2; }
export const pTwo = (t, df) => (t == null ? 1 : Math.min(1, 2 * pOne(Math.abs(t), df)));
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; }); return adj; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pct(a, q) { const s = [...a].sort((x, y) => x - y), k = (s.length - 1) * q, lo = Math.floor(k); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo); }

// placebo days: Tue-Fri between first and last event date, no release within 48 h of 08:30 New York
export function placeboDays(from, to, rel) {
  const out = [];
  for (let u = Date.parse(from + 'T12:00:00Z'); u <= Date.parse(to + 'T12:00:00Z'); u += 864e5) {
    const dt = new Date(u), w = dt.getUTCDay(); if (w < 2 || w > 5) continue;
    const d = dt.toISOString().slice(0, 10), T = zonedToUtc(d, '08:30', 'America/New_York');
    if (rel.some((r) => Math.abs(r - T) <= P.near)) continue;
    out.push({ d, T });
  }
  return out;
}
export function placebo(cell, data, days, n, seed) {
  const rnd = mulberry32(seed), pool = days.slice(), got = [];
  while (got.length < n && pool.length) {
    const j = Math.floor(rnd() * pool.length), x = pool.splice(j, 1)[0];
    if (cellDrift(cell, data, x.T) != null && cellTrade(cell, data, x.T, 1) != null) got.push(x.T);
  }
  got.sort((a, b) => a - b);
  const r = runCell(cell, data, got);
  return r.ev.reduce((s, e) => s + e.net, 0) / r.ev.length;
}

// ── fetch: continuous M5 and H1 from 1 Jan 2018 ──
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const T0 = Date.UTC(2017, 11, 1) / 1000, NOW = Math.floor(Date.now() / 1000);
  for (const mk of MARKETS) for (const [tf, sec] of [['5m', M5], ['1h', H1]]) {
    const f = path.join(dir, `${mk}-${tf}.json`); if (fs.existsSync(f)) { console.log(mk, tf, 'cached'); continue; }
    const rows = []; let a = T0;
    while (a < NOW) {
      const b = Math.min(NOW, a + 4999 * sec); let j = null, err = '';
      for (let tr = 0; tr < 6 && !j; tr++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${mk}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
        const x = r.ok ? await r.json() : null; if (x && Array.isArray(x.bars)) j = x; else err = `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
        if (!j) await sleep(2000 * (tr + 1)); }
      if (!j) throw new Error(`${mk} ${tf} ${a}: ${err}`);
      for (const c of j.bars) if (!c.live && c.time >= a && c.time < b) rows.push([c.time, c.open, c.high, c.low, c.close]);
      a = b; await sleep(400);
    }
    fs.writeFileSync(f, JSON.stringify(rows)); console.log(mk, tf, rows.length);
  }
}
export function load(dir) {
  const out = {}; for (const mk of MARKETS) out[mk] = { m5: series(JSON.parse(fs.readFileSync(path.join(dir, `${mk}-5m.json`), 'utf8'))), h1: series(JSON.parse(fs.readFileSync(path.join(dir, `${mk}-1h.json`), 'utf8'))) };
  return out;
}

const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const NAME = { xau: 'Gold (XAU/USD), long', eurusd: 'EUR/USD (long USD = short)', usdjpy: 'USD/JPY (long USD = long)', gbpusd: 'GBP/USD (long USD = short)', usd: 'USD basket (3 legs)' };

function full(dir) {
  const data = load(dir), { ev, rel, built } = loadEvents(), cells = [];
  for (const ty of TYPES) {
    const times = ev[ty].map((e) => e.t), days = placeboDays(ev[ty][0].d, ev[ty][ev[ty].length - 1].d, rel);
    for (const cell of CELLS) {
      const ci = cells.length, r = runCell(cell, data, times), r2 = runCell(cell, data, times, 2);
      const net = r.ev.map((e) => e.net), dr = r.ev.map((e) => e.drift), is = r.ev.filter((e) => e.half === 'IS'), oos = r.ev.filter((e) => e.half === 'OOS');
      const T = tstat(net), D = tstat(dr), df = Math.max(1, T.n - 1);
      const pTrade = cell === 'xau' ? pOne(T.t, df) : pTwo(T.t, df), pDrift = cell === 'xau' ? pOne(D.t, Math.max(1, D.n - 1)) : pTwo(D.t, Math.max(1, D.n - 1));
      const plc = []; for (let s = 1; s <= P.runs; s++) plc.push(placebo(cell, data, days, r.ev.length, 1000 * (ci + 1) + s));
      const half = (a) => { const x = tstat(a.map((e) => e.net)); return { n: x.n, net: r4(x.mean), t: r4(x.t), gross: r4(a.reduce((s, e) => s + e.gross, 0) / a.length), from: a[0] && new Date(a[0].T * 1000).toISOString().slice(0, 10), to: a.length ? new Date(a[a.length - 1].T * 1000).toISOString().slice(0, 10) : null }; };
      cells.push({ type: ty, cell, name: NAME[cell], usdDir: cell === 'xau' ? null : r.usdDir, n: T.n, skipped: r.skipped,
        drift: { meanPct: r4(D.mean), t: r4(D.t), p: r4(pDrift), sided: cell === 'xau' ? 'one (long)' : 'two' },
        trade: { net: r4(T.mean), t: r4(T.t), p: r4(pTrade), gross: r4(r.ev.reduce((s, e) => s + e.gross, 0) / r.ev.length), costR: r4(r.ev.reduce((s, e) => s + e.costR, 0) / r.ev.length),
          finR: r4(r.ev.reduce((s, e) => s + (e.finR || 0), 0) / r.ev.length), net2x: r4(tstat(r2.ev.map((e) => e.net)).mean), t2x: r4(tstat(r2.ev.map((e) => e.net)).t),
          stopped: r.ev.filter((e) => /stop/.test(e.how)).length, win: r.ev.filter((e) => e.net > 0).length },
        IS: half(is), OOS: half(oos),
        placebo: { runs: P.runs, days: days.length, median: r4(pct(plc, 0.5)), p95: r4(pct(plc, 0.95)), means: plc.map(r4) },
        events: r.ev.map((e) => ({ d: new Date(e.T * 1000).toISOString().slice(0, 10), half: e.half, drift: r4(e.drift), gross: r4(e.gross), net: r4(e.net), how: e.how })) });
      console.log(ty, cell, T.n, r4(T.mean), r4(T.t));
    }
  }
  const ps = [...cells.map((c) => c.drift.p), ...cells.map((c) => c.trade.p)], adj = holm(ps);
  cells.forEach((c, i) => { c.drift.holm = r4(adj[i]); c.trade.holm = r4(adj[cells.length + i]);
    c.checks = { n: c.n >= P.minN, halves: c.IS.net > 0 && c.OOS.net > 0, t: c.trade.t != null && c.trade.t >= 2 && c.trade.holm < 0.05, placebo: c.trade.net > c.placebo.p95 };
    c.pass = Object.values(c.checks).every(Boolean); });
  const measurable = cells.some((c) => c.n >= P.minN), passed = cells.filter((c) => c.pass);
  const verdict = !measurable ? 'NOT MEASURABLE (inconclusive: no cell reached 20 events)' : passed.length ? 'PASS' : 'FAIL';
  const res = { study: 'pre-release-drift', title: 'Drift in the 24 hours before US CPI and payrolls (gold and the dollar)', built: new Date().toISOString(),
    preregistration: 'research/edge/pre-release-drift/PREREGISTRATION.md', verdict, passed: passed.map((c) => `${c.type} ${c.cell}`),
    headline: '', events: { source: 'council/event-base.json rows (built ' + built + ')', CPI: ev.CPI.length, NFP: ev.NFP.length, from: { CPI: ev.CPI[0].d, NFP: ev.NFP[0].d }, to: { CPI: ev.CPI.at(-1).d, NFP: ev.NFP.at(-1).d } },
    data: { src: 'OANDA mid M5 + H1 via /md/bars', markets: MARKETS, bars: Object.fromEntries(MARKETS.map((m) => [m, { m5: data[m].m5.t.length, h1: data[m].h1.t.length, from: new Date(data[m].m5.t[0] * 1000).toISOString().slice(0, 10), to: new Date(data[m].m5.t.at(-1) * 1000).toISOString().slice(0, 10) }])) },
    params: P, cells };
  const best = cells.slice().sort((a, b) => (b.trade.t ?? -9) - (a.trade.t ?? -9))[0];
  res.headline = `${verdict === 'PASS' ? 'PASS' : verdict.split(' ')[0]}: ${passed.length} of ${cells.length} cells; gold long before CPI ${fmt(cells[0].trade.net)}R a trade net (n ${cells[0].n}, t ${fmt(cells[0].trade.t)}), before payrolls ${fmt(cells[5].trade.net)}R (n ${cells[5].n}, t ${fmt(cells[5].trade.t)}); best t ${best.type} ${best.cell} ${fmt(best.trade.t)}`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(res.headline);
}
const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x.toFixed(d));
export function report(r) {
  const L = [];
  L.push(`# ${r.title}: result`, '', `**Verdict: ${r.verdict}** (${r.passed.length} of ${r.cells.length} cells pass). Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was fetched). Paper research only; nothing live changed.`, '');
  L.push(`Events: ${r.events.source}: CPI ${r.events.CPI} (${r.events.from.CPI} to ${r.events.to.CPI}), NFP ${r.events.NFP} (${r.events.from.NFP} to ${r.events.to.NFP}). Data: ${r.data.src}.`, '');
  L.push('## Trades (entry 24 h before the release, stop 1 x ATR(14) H1, out 5 minutes before it), net R a trade', '');
  L.push('| Release | Cell | USD side | n | net R | t | p | Holm p | gross | cost R | 2x costs | first half | second half | placebo p95 | pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of r.cells) L.push(`| ${c.type} | ${c.name} | ${c.usdDir == null ? 'n/a' : c.usdDir > 0 ? 'long' : 'short'} | ${c.n} | ${fmt(c.trade.net)} | ${fmt(c.trade.t, 2)} | ${c.trade.p.toFixed(3)} | ${c.trade.holm.toFixed(3)} | ${fmt(c.trade.gross)} | ${c.trade.costR.toFixed(3)} | ${fmt(c.trade.net2x)} | ${fmt(c.IS.net)} (n ${c.IS.n}) | ${fmt(c.OOS.net)} (n ${c.OOS.n}) | ${fmt(c.placebo.p95)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## Drift (percent move, 24 h before to 5 minutes before; gold signed long, pairs and basket long USD)', '');
  L.push('| Release | Cell | n | mean % | t | test | p | Holm p |', '|---|---|---|---|---|---|---|---|');
  for (const c of r.cells) L.push(`| ${c.type} | ${c.name} | ${c.n} | ${fmt(c.drift.meanPct, 4)} | ${fmt(c.drift.t, 2)} | ${c.drift.sided} | ${c.drift.p.toFixed(3)} | ${c.drift.holm.toFixed(3)} |`);
  L.push('', '## Placebo', '', `40 seeded runs per cell on Tuesday-Friday days between the type's first and last event, 08:30 New York, no CPI / NFP / FOMC within 48 h; same rule (USD side from each run's own first half).`, '');
  L.push('| Release | Cell | placebo days | median | 95th pct | the cell |', '|---|---|---|---|---|---|');
  for (const c of r.cells) L.push(`| ${c.type} | ${c.cell} | ${c.placebo.days} | ${fmt(c.placebo.median)} | ${fmt(c.placebo.p95)} | ${fmt(c.trade.net)} |`);
  L.push('', '## Notes', '');
  L.push('- Costs: the frozen `cpi-follow` model (gold $0.30, forex 0.3 pip + 0.000045 x price + 2 pip a round trip) plus long-gold financing (`council/fills.mjs` `nights` x `FIN.xau.long`, today\'s rate every year), declared in the pre-registration. Forex swaps are not charged (the frozen model has none).');
  L.push('- Pairs and basket: the USD side is fixed from the first half\'s mean drift; their p is two-sided. Holm runs over all 20 p-values (10 drift, 10 trade).');
  const below = (c) => c.placebo.means.filter((x) => x < c.trade.net).length, g = r.cells.filter((c) => c.cell === 'xau');
  L.push(`- Stops: a 1 x ATR(14) H1 stop over a 24-hour hold is reached on most trades (gold ${g.map((c) => `${c.type} ${c.trade.stopped} of ${c.n}`).join(', ')}), so the trade version measures a tight-stop long, not the drift itself; the drift table is the direct reading and shows no consistent move (largest |t| ${Math.max(...r.cells.map((c) => Math.abs(c.drift.t))).toFixed(2)}).`);
  L.push(`- Post hoc, descriptive only (not a test, not a short-gold hypothesis): gold long (both releases) beats only ${g.map((c) => `${c.type} ${below(c)} of 40`).join(', ')} placebo means. Its drift is not negative (${g.map((c) => `${c.type} ${fmt(c.drift.meanPct, 4)} %`).join(', ')}); the loss comes from stops reached inside the 24 hours. Any short-side or wider-stop reading would need its own pre-registration on other data.`);
  L.push('- The two halves: CPI splits 2018-22 | 2022-26, payrolls 2022-24 | 2024-26 (event-base has payrolls from 2022 only).');
  L.push('- A cell is never called an edge here; every figure carries its n and t. Nothing under `council/`, `api/`, config or any live rule changed.');
  return L.join('\n') + '\n';
}

const [, , cmd, dir] = process.argv;
if (cmd === 'fetch') await fetchAll(dir);
else if (cmd === 'full') full(dir);
