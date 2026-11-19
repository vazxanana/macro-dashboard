// Edge research · cycle-gate (PREREGISTRATION.md, committed first): the owner's market-cycle rule, "if we are bullish on H4 and
// the pullback finished, focus only on buys, and vice versa", as a gate that SPLITS each system's own historical trades on
// 2020 → now (H4 direction from the last H4 break of structure, the H1 state move / pullback / resumed as the Desk's msCycle
// reads it). Nothing here edits a system rule or a live file; paper research only.
//   node --use-env-proxy run.mjs candles <dir>                         OANDA H1 + H4 of the six markets (keep <dir> out of git)
//   node run.mjs study <candleDir> <shadowDir> <councilDataDir>        -> result.json (shadowDir = shadow-best's per-trade output;
//                                                                         councilDataDir holds research/replay-2w.json and trades.json)
// Imports, never copies: boEvents (mosha-retrace), positions (supported-book), loadTrades / stats helpers (shadow-best),
// fold / replayNet (council/decay.mjs), FIN / nights (council/fills.mjs).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
// shadow-best (and the replay it imports) run their own command line on import: hide ours from them
const ARGV = SELF ? process.argv.slice(2) : [];
process.argv.length = Math.min(process.argv.length, 2);
const { boEvents } = await import('../mosha-retrace/run.mjs');
const { positions } = await import('../supported-book/run.mjs');
const SB = await import('../shadow-best/run.mjs');
const { fold, replayNet } = await import('../../../council/decay.mjs');
const { FIN, nights } = await import('../../../council/fills.mjs');
const { pOneSided, holm } = SB;

export const K = { W4: 3, W1: 1, H4: 14400, H1: 3600, FROM: Date.UTC(2020, 0, 1) / 1000, SPLIT: Date.UTC(2024, 0, 1) / 1000,
  CANDLES_FROM: Date.UTC(2019, 5, 1) / 1000, MIN_KEPT: 30, MIN_BLOCKED: 10, T_MIN: 2, ALPHA: 0.05, PLACEBO: 40 };
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
export const GATES = { G2: 'side = H4 direction and H1 not in pullback (primary)', G1: 'side = H4 direction', G3: 'side = H4 direction and H1 resumed' };
export const STREAMS = ['gtrend', 'geg', 'gtrend5', 'gtl', 'gmp', 'replica', 'mosha-bo', 'scalp', 'intraday', 'rscalp', 'rintra'];
export const NAME = { gtrend: 'Gold trend', geg: 'Gold daily engulf', gtrend5: 'Gold trend fast', gtl: 'H4 trendline', gmp: 'Momentum pullback',
  replica: 'Gold replica', 'mosha-bo': 'Mosha BO', scalp: 'Engine scalp (gold + 5 forex)', intraday: 'Engine intraday (gold + 5 forex)',
  rscalp: 'Engine retrace scalp (gold + 5 forex)', rintra: 'Engine retrace intraday (gold + 5 forex)' };
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3));
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(4));

// ─── the gate ───
// events of one market: H4 and H1 breaks of structure (closed candles only; boEvents: a close beyond the swing confirmed when the
// candle opened, event time = the breaking candle's close)
export function cycleEvents(H4, H1) {
  return { e4: boEvents(H4, K.W4, K.H4).map((e) => ({ t: e.t, dir: e.dir })), e1: boEvents(H1, K.W1, K.H1).map((e) => ({ t: e.t, dir: e.dir })) };
}
const lastAtOrBefore = (E, T) => { let a = 0, b = E.length; while (a < b) { const m = (a + b) >> 1; if (E[m].t <= T) a = m + 1; else b = m; } return a - 1; };
// the state at T: { d, t4, state: 'move' | 'pullback' | 'resumed' | null } from events with time <= T only (msCycle on the H4 / H1 pair)
export function stateAt(ev, T) {
  const q = lastAtOrBefore(ev.e4, T);
  if (q < 0) return { d: 0, t4: null, state: null };
  const { t: t4, dir: d } = ev.e4[q];
  let a = 0, b = ev.e1.length; while (a < b) { const m = (a + b) >> 1; if (ev.e1[m].t < t4) a = m + 1; else b = m; }
  let choch = false;
  for (let i = a; i < ev.e1.length && ev.e1[i].t <= T; i++) {
    const e = ev.e1[i];
    if (!choch) { if (e.dir === -d) choch = true; }
    else if (e.dir === d) return { d, t4, state: 'resumed' };
  }
  return { d, t4, state: choch ? 'pullback' : 'move' };
}
// does gate g keep a trade of side s given the state st (no direction yet = kept)
export function keeps(g, s, st) {
  if (!st || !st.d) return true;
  if (s !== st.d) return false;
  if (g === 'G1') return true;
  if (g === 'G2') return st.state !== 'pullback';
  if (g === 'G3') return st.state === 'resumed';
  throw new Error(`unknown gate ${g}`);
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const vr = (a) => { const m = mean(a); return a.length > 1 ? a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) : null; };
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, df: null, p: null };
  const va = vr(a) / a.length, vb = vr(b) / b.length, se = Math.sqrt(va + vb), diff = mean(a) - mean(b);
  if (!(se > 0)) return { diff, t: null, df: null, p: null };
  const t = diff / se, df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { diff, t, df, p: pOneSided(t, df) };
}
// worst drawdown of cumulative net R in exit order, peak floored at 0
export function maxDD(trades) {
  let c = 0, pk = 0, dd = 0;
  for (const x of [...trades].sort((p, q) => p.c - q.c || p.t - q.t)) { c += x.R; if (c > pk) pk = c; if (pk - c > dd) dd = pk - c; }
  return dd;
}
const block = (a) => ({ n: a.length, avg: r4(mean(a.map((x) => x.R))), total: r3(a.reduce((s, x) => s + x.R, 0)) });
const halves = (a) => ({ h1: a.filter((x) => x.t < K.SPLIT), h2: a.filter((x) => x.t >= K.SPLIT) });
// month means difference (descriptive): per calendar month with trades on both sides, mean kept − mean blocked; t of those
function monthDiff(kept, blocked) {
  const mo = (t) => new Date(t * 1000).toISOString().slice(0, 7), A = new Map(), B = new Map();
  for (const x of kept) (A.get(mo(x.t)) || A.set(mo(x.t), []).get(mo(x.t))).push(x.R);
  for (const x of blocked) (B.get(mo(x.t)) || B.set(mo(x.t), []).get(mo(x.t))).push(x.R);
  const d = [...A.keys()].filter((m) => B.has(m)).map((m) => mean(A.get(m)) - mean(B.get(m)));
  const sd = Math.sqrt(vr(d) || 0);
  return { months: d.length, avg: r4(mean(d)), t: d.length > 1 && sd > 0 ? r3(mean(d) / (sd / Math.sqrt(d.length))) : null };
}
// one stream, one keep-mask: the figures and the pass rules other than Holm
export function splitStats(trades, mask) {
  const kept = trades.filter((_, i) => mask[i]), blocked = trades.filter((_, i) => !mask[i]);
  const A = halves(trades), Kh = halves(kept), Bh = halves(blocked), w = welch(kept.map((x) => x.R), blocked.map((x) => x.R));
  const ddAll = maxDD(trades), ddKept = maxDD(kept);
  const out = {
    all: { ...block(trades), h1: block(A.h1), h2: block(A.h2), maxDD: r3(ddAll) },
    kept: { ...block(kept), h1: block(Kh.h1), h2: block(Kh.h2), maxDD: r3(ddKept) },
    blocked: { ...block(blocked), h1: block(Bh.h1), h2: block(Bh.h2) },
    share: r3(blocked.length / (trades.length || 1)),
    welch: { diff: r4(w.diff), t: r3(w.t), df: r3(w.df), p: w.p == null ? null : +w.p.toPrecision(4) },
    months: monthDiff(kept, blocked),
  };
  const gt = (k, a) => k.n > 0 && a.n > 0 && k.avg > a.avg;
  out.rules = { halves: gt(out.kept.h1, out.all.h1) && gt(out.kept.h2, out.all.h2), t: w.t != null && w.t >= K.T_MIN, dd: ddKept <= ddAll + 1e-9,
    n: kept.length >= K.MIN_KEPT && blocked.length >= K.MIN_BLOCKED };
  return out;
}
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo: block a random set of the same size as the gate's blocked set, 40 seeded draws; rules halves / t / dd / n
export function placebo(trades, nBlocked, draws = K.PLACEBO, seed = 7) {
  const rnd = mulberry32(seed), ts = [];
  let pass = 0;
  for (let j = 0; j < draws; j++) {
    const idx = trades.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [idx[i], idx[k]] = [idx[k], idx[i]]; }
    const mask = new Array(trades.length).fill(true); for (let i = 0; i < nBlocked; i++) mask[idx[i]] = false;
    const s = splitStats(trades, mask); ts.push(s.welch.t ?? 0);
    if (s.rules.halves && s.rules.t && s.rules.dd && s.rules.n) pass++;
  }
  ts.sort((a, b) => a - b);
  return { draws, pass, t95: r3(ts[Math.floor(0.95 * (ts.length - 1))]), tMax: r3(ts.at(-1)) };
}
// every stream x gate, Holm over all of them, the verdict per stream (G2)
export function evaluate(streams) {
  const rows = [];
  for (const [id, S] of Object.entries(streams)) for (const g of Object.keys(GATES)) {
    const mask = S.trades.map((x) => keeps(g, x.side, x.st));
    rows.push({ stream: id, gate: g, ...splitStats(S.trades, mask) });
  }
  const adj = holm(rows.map((r) => r.welch.p));
  rows.forEach((r, i) => { r.pHolm = adj[i] == null ? null : +adj[i].toPrecision(4); r.rules.holm = r.pHolm != null && r.pHolm <= K.ALPHA; r.pass = Object.values(r.rules).every(Boolean); });
  return rows;
}

// ─── trade sources (each returns [{ t: entry, c: exit, side, R: net }]) ───
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export function legsStreams() {
  const legs = J(path.join(HERE, '../supported-book/legs.json')).units, out = {};
  for (const sys of ['gtrend', 'geg', 'gtrend5'])
    out[sys] = positions(legs, {}, (u) => u.sys === sys).map((p) => ({ t: p.t, c: p.c, side: 1, R: p.n, id: p.id }));
  return out;
}
// the robustness rebuild with financing on buys, as research/edge/decay-monitor/run.mjs rbFin charges it (positions.json checked row for row)
export function rebuildStream(file, key) {
  const j = J(path.join(HERE, `../robustness/out/${file}.json`)), T = key ? j.trades[key] : j.trades, P = J(path.join(HERE, '../decay-monitor/positions.json')).systems[key || file];
  if (!P || P.length !== T.length) throw new Error(`${file}: positions.json does not match the rebuild record`);
  return T.map((x, i) => { const [t, o, c, e, r0, side] = P[i]; if (t !== x.t || side !== x.side) throw new Error(`${file}: position ${i} differs`);
    const fin = side > 0 ? nights(o, c) * FIN.xau.long * e / r0 : 0; return { t: o, c, side, R: x.R - fin }; });
}
export function replicaStream(cd) {
  const rows = J(path.join(cd, 'research/replay-2w.json')).trades.filter((x) => x.k === 'replica' && ['win', 'loss', 'be'].includes(x.status) && Number.isFinite(+x.R) && x.closed);
  const by = new Map(rows.map((x) => [x.id, x]));
  return fold(rows, replayNet).map((p) => { const x = by.get(p.id); return { t: x.filled || x.opened, c: p.t, side: x.side === 'sell' ? -1 : 1, R: p.R, id: p.id }; });
}
// shadow-best's per-trade rows; accepted only when the totals equal its committed result.json
export function shadowStreams(dir) {
  const { rows } = SB.loadTrades(dir), ref = J(path.join(HERE, '../shadow-best/result.json'));
  for (const c of ref.cells) for (const w of ['IS', 'OOS']) {
    const mine = rows.filter((x) => x.k === c.k && x.m === c.m && SB.windowOf(x.opened) === w);
    const net = mine.length ? mine.reduce((s, x) => s + x.net, 0) / mine.length : null;
    if (mine.length !== c[w].n || (net != null && Math.abs(net - c[w].net) > 1e-4)) throw new Error(`shadow rows differ from shadow-best result.json: ${c.k} ${c.m} ${w}`);
  }
  const out = {};
  for (const k of ['scalp', 'intraday', 'rscalp', 'rintra'])
    out[k] = rows.filter((x) => x.k === k && MARKETS.includes(x.m) && SB.windowOf(x.opened)).map((x) => ({ t: x.opened, c: x.opened, side: x.side === 'sell' || x.side < 0 ? -1 : 1, R: x.net, m: x.m }));
  return out;
}

// ─── candles ───
const TF = { '1h': 3600, '4h': 14400 };
export function loadCandles(dir, m, tf) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${m}-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
}
async function fetchCandles(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', END = Math.floor(Date.now() / 1000), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  for (const m of MARKETS) for (const [tf, sec] of Object.entries(TF)) {
    const f = path.join(dir, `${m}-${tf}.json.gz`), got = new Map();
    for (let a = K.CANDLES_FROM; a < END;) {
      const b = Math.min(END, a + 4999 * sec);
      let j = null;
      for (let k = 0; k < 5 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=${m}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; }
        catch { /* retried */ }
        if (!j) await sleep(1500 * (k + 1));
      }
      if (!j) throw new Error(`${m} ${tf} ${a}: no answer`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b && x.time + sec <= END) got.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await sleep(150);
    }
    const rows = [...got.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows)));
    console.log(`${m} ${tf}: ${rows.length} candles ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 16)}`);
  }
}

// ─── the study ───
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
function study(cdir, sdir, cd) {
  const ev = Object.fromEntries(MARKETS.map((m) => [m, cycleEvents(loadCandles(cdir, m, '4h'), loadCandles(cdir, m, '1h'))]));
  const candleEnd = Math.min(...MARKETS.map((m) => loadCandles(cdir, m, '1h').at(-1).time + 3600));
  const src = { ...legsStreams(), gtl: rebuildStream('gtl'), gmp: rebuildStream('gmp'), 'mosha-bo': rebuildStream('mosha'), replica: replicaStream(cd), ...shadowStreams(sdir) };
  const streams = {};
  for (const id of STREAMS) {
    const T = src[id].filter((x) => x.t >= K.FROM && x.t < candleEnd).sort((a, b) => a.t - b.t);
    for (const x of T) x.st = stateAt(ev[x.m || 'xau'], x.t);
    streams[id] = { trades: T, from: iso(T[0].t).slice(0, 10), to: iso(T.at(-1).t).slice(0, 10), states: T.reduce((o, x) => { const k = `${x.st.d > 0 ? 'up' : x.st.d < 0 ? 'down' : 'none'}-${x.st.state}`; o[k] = (o[k] || 0) + 1; return o; }, {}) };
  }
  const rows = evaluate(streams);
  for (const r of rows) if (r.gate === 'G2') { const S = streams[r.stream].trades; r.placebo = placebo(S, r.blocked.n); }
  const systems = STREAMS.map((id) => { const r = rows.find((x) => x.stream === id && x.gate === 'G2'); return { stream: id, name: NAME[id], verdict: r.pass ? 'PASS' : 'FAIL', failed: Object.entries(r.rules).filter(([, v]) => !v).map(([k]) => k) }; });
  // this week, and the live book since 1 Nov 2026 (descriptive)
  const tj = J(path.join(cd, 'trades.json')), TR = Array.isArray(tj) ? tj : tj.trades, since = Date.UTC(2026, 10, 1) / 1000;
  const live = TR.filter((x) => !x.shadow && x.market === 'xau' && (x.filled || x.opened) >= since && ['win', 'loss', 'be', 'open'].includes(x.status))
    .map((x) => { const t = x.filled || x.opened, side = x.side === 'sell' ? -1 : 1, st = stateAt(ev.xau, t);
      return { id: x.id, k: x.k, side: x.side, entry: iso(t), status: x.status, R: x.R ?? null, h4: st.d > 0 ? 'up' : st.d < 0 ? 'down' : 'none', h1: st.state, h4BreakAt: st.t4 ? iso(st.t4) : null,
        G1: keeps('G1', side, st) ? 'take' : 'block', G2: keeps('G2', side, st) ? 'take' : 'block', G3: keeps('G3', side, st) ? 'take' : 'block' }; })
    .sort((a, b) => a.entry.localeCompare(b.entry));
  const WEEK = ['xau-geg-1793664000', 'xau-gtl-1793836800-1794182400', 'xau-geg-1794096000'];
  const pass = systems.filter((s) => s.verdict === 'PASS');
  const g2 = (id) => rows.find((x) => x.stream === id && x.gate === 'G2');
  const verdict = pass.length ? `PASS for ${pass.map((s) => s.name).join(', ')} (G2); FAIL for the other ${systems.length - pass.length} of ${systems.length}`
    : `FAIL, 0 of ${systems.length} systems: the cycle gate (G2) does not improve any system's trades measurably on 2020 → now`;
  const out = { study: 'cycle-gate', topic: 'cycle-gate', title: 'The market-cycle gate: trade only with the H4 move once its pullback is over', built: '2026-11-13',
    preregistration: 'research/edge/cycle-gate/PREREGISTRATION.md', system: 'every gold system with a committed engine, and the engine shadow setups on gold and five forex markets',
    rule: 'paper research only: no live rule, size, filter, stop or config changes', verdict, systems,
    params: K, gates: GATES, window: { from: '2020-01-01', split: '2024-01-01', candlesTo: iso(candleEnd) },
    candles: Object.fromEntries(MARKETS.map((m) => [m, { e4: ev[m].e4.length, e1: ev[m].e1.length }])),
    streams: Object.fromEntries(STREAMS.map((id) => [id, { name: NAME[id], n: streams[id].trades.length, from: streams[id].from, to: streams[id].to, states: streams[id].states }])),
    tests: rows.map(({ stream, gate, ...r }) => ({ stream, gate, ...r })),
    headline: Object.fromEntries(STREAMS.map((id) => { const r = g2(id); return [id, { n: r.all.n, blocked: r.blocked.n, allH1: r.all.h1.avg, keptH1: r.kept.h1.avg, allH2: r.all.h2.avg, keptH2: r.kept.h2.avg, t: r.welch.t, pHolm: r.pHolm, ddAll: r.all.maxDD, ddKept: r.kept.maxDD, placeboPass: r.placebo.pass, placeboT95: r.placebo.t95 }]; })),
    week: live.filter((x) => WEEK.includes(x.id)), liveSinceNov1: live };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const r of rows) console.log([r.stream.padEnd(9), r.gate, 'n', r.all.n, 'blk', r.blocked.n, 'H1', r.all.h1.avg, '→', r.kept.h1.avg, 'H2', r.all.h2.avg, '→', r.kept.h2.avg, 'diff', r.welch.diff, 't', r.welch.t, 'pH', r.pHolm, 'DD', r.all.maxDD, '→', r.kept.maxDD, 'mo', r.months.t, r.pass ? 'PASS' : Object.entries(r.rules).filter(([, v]) => !v).map(([k]) => k).join(','), r.placebo ? `placebo ${r.placebo.pass}/40 t95 ${r.placebo.t95}` : ''].join(' '));
  console.log(JSON.stringify(out.liveSinceNov1, null, 1));
  console.log(verdict);
}

if (SELF) {
  const [cmd, a1, a2, a3] = ARGV;
  if (cmd === 'candles') await fetchCandles(a1);
  else if (cmd === 'study') study(a1, a2, a3);
  else console.error('usage: run.mjs candles <dir> | study <candleDir> <shadowDir> <councilDataDir>');
}
