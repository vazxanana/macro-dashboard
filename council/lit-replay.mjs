// LIT replay (8 Nov 2026, owner: "on the LIT edge fill trades from the last 2 months so I can study them"). The pre-registered LIT
// rule (research/edge/lit, council/lit.mjs: the same detector the paper shadow stream runs) over the last ~2 months of OANDA 5m gold
// candles read through the site's /md/bars proxy in windows, simulated exactly as the study did (fill on a touch past the limit,
// stop first, target, break-even after two swing breaks, closed at the day's end; one order at a time, <= 1 London + 1 NY fill a
// day, stop after a win or -1.5R; costs $0.30 spread + $0.15 slippage on market exits). Paper research only: these are not the
// stream's own records (those live in trades.json, k 'lit'); they say what the rule would have done, so the owner can study them.
//   node council/lit-replay.mjs <dataDir> [--days 63] [--force]     -> <dataDir>/lit/replay.json (skipped while the file is < 20 h old)
import fs from 'node:fs';
import path from 'node:path';
import { cleanBars, agg15, series, fbosCandidates, buildOrder, VARIANT, SESS_TRADE, XAU, funnel, buildCounts } from './lit.mjs';
import { simulateOrder, selectTrades, stats, MARKETS, VARIANTS } from '../research/edge/lit/run.mjs';

const MD_BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const DAYS = 63, WINDOW = 15 * 86400, FRESH = 20 * 3600;

export async function fetchBars(days = DAYS, fetchFn = fetch, now = Math.floor(Date.now() / 1000)) {
  // the week before the window warms the levels (previous week, accumulation) so the first days are judged like the rest
  const from0 = now - (days + 9) * 86400, seen = new Map();
  for (let from = from0; from < now; from += WINDOW) {
    const to = Math.min(now, from + WINDOW);
    const r = await fetchFn(`${MD_BASE}bars?sym=xau&tf=5m&from=${from}&to=${to}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`bars ${from}-${to}: ${r.status}`);
    const j = await r.json(), rows = Array.isArray(j) ? j : j.bars || [];
    for (const b of rows) if (!b.live && b.time + 300 <= now) seen.set(b.time, b);
  }
  return cleanBars([...seen.values()].sort((a, b) => a.time - b.time));
}

// the study's pipeline on one block of candles: candidates on M15, orders on M5, simulated, the trader's gates applied
export function replay(bars, { days = DAYS, now = Math.floor(Date.now() / 1000), M = MARKETS.xau } = {}) {
  const m15 = agg15(bars), since = now - days * 86400;
  const S5 = { short: series(bars, false, M.tick), long: series(bars, true, M.tick) }, S15 = { short: series(m15, false, M.tick), long: series(m15, true, M.tick) };
  const fun = funnel(), bc = buildCounts(), all = [], setups = [], byVariant = {};
  // the short series is the plain one, the long series is mirrored (negated), so prices come back with these signs
  const sgn = (dir) => (dir === 'short' ? 1 : -1), px = (dir, v) => +(sgn(dir) * v).toFixed(2);
  const WHY = { noSwing: 'no M5 swing before MX', mxBroken: 'MX broken before the break', noRbos: 'no M5 real break', rbosSlow: 'break too slow', rbosOverlap: 'break overlaps', rbosFlip: 'break flipped back', noOb: 'no order block', badGeom: 'bad geometry', lowRR: 'R:R under 3', capped: 'stop over 0.08% of price' };
  for (const dir of ['short', 'long']) {
    const cands = fbosCandidates(S15[dir], fun);
    for (const cd of cands) { cd.confEnd = S15[dir].t[cd.conf] + 900; cd.rEnd = S15[dir].t[cd.r] + 900; cd.dir = dir;
      // the primary variant, with the reason a setup produced no order (a fresh counter per candidate tells which gate dropped it)
      const one = buildCounts(), od = buildOrder(S5[dir], cd, M, VARIANT, one);
      for (const k of Object.keys(one)) bc[k] += one[k];
      const why = od ? (od.capOK ? null : 'capped') : Object.keys(one).find((k) => k !== 'orders' && one[k]) || 'noSwing';
      const setup = { t: cd.t, date: new Date(cd.t * 1000).toISOString().slice(0, 16), dir, side: dir === 'short' ? 'sell' : 'buy', sess: cd.sess, level: cd.kind, levelPx: px(dir, cd.L), accLow: px(dir, dir === 'short' ? cd.accLow : cd.accHigh), accHigh: px(dir, dir === 'short' ? cd.accHigh : cd.accLow), accBars: cd.accN, why: why ? WHY[why] || why : null, order: null };
      if (od) { od.dir = dir; od.sim = simulateOrder(S5[dir], M, od); if (od.capOK) all.push(od);
        setup.order = { tJA: od.tJA, entry: px(dir, od.entry), stop: px(dir, od.stop), target: px(dir, od.target), rr: od.rr != null ? +(+od.rr).toFixed(2) : null, capOK: !!od.capOK, outcome: od.sim.filled ? `filled · ${od.sim.kind} ${od.sim.Rnet > 0 ? '+' : ''}${od.sim.Rnet}R` : od.sim.kind }; }
      setups.push(setup);
      // the study's other variants (close trigger, entry at the order block's 50%), for comparison only
      for (const V of VARIANTS) { if (V.id === VARIANT.id) continue; const o2 = buildOrder(S5[dir], cd, M, V, buildCounts()); if (o2 && o2.capOK) { o2.dir = dir; o2.sim = simulateOrder(S5[dir], M, o2); (byVariant[V.id] = byVariant[V.id] || []).push(o2); } }
    }
  }
  const ny = S5.short.ny, taken = selectTrades(all.map((od) => ({ ...od })), ny);
  // finish() in the harness multiplies the fill and exit by the series' sign; the detector's series may not carry one, so the
  // sign is applied here from the direction when it is missing
  const fix = (S, dir, v) => (S.sign != null ? v : sgn(dir) * v);
  const row = (od) => { const s = od.sim, S = S5[od.dir]; return { id: `xau-lit-${od.dir === 'short' ? 's' : 'b'}-${S.t[od.jA]}`, t: s.t, date: new Date(s.t * 1000).toISOString().slice(0, 16), tExit: s.tExit, dir: od.dir, side: od.dir === 'short' ? 'sell' : 'buy', sess: od.sess, level: od.level,
    entry: +fix(S, od.dir, s.fp).toFixed(2), exit: +fix(S, od.dir, s.exit).toFixed(2), stop: px(od.dir, od.stop), target: px(od.dir, od.target), rr: od.rr != null ? +(+od.rr).toFixed(2) : null, kind: s.kind, R: s.R, Rnet: s.Rnet, Rnet2: s.Rnet2, year: new Date(s.t * 1000).getUTCFullYear() }; };
  const trades = taken.filter((od) => od.sim.t >= since).map(row).sort((a, b) => a.t - b.t);
  const orders = all.filter((od) => S5[od.dir].t[od.jA] >= since);
  const unfilled = {}; for (const od of orders) if (!od.sim.filled) unfilled[od.sim.kind] = (unfilled[od.sim.kind] || 0) + 1;
  const notTaken = {}; for (const od of taken.length ? all : []) if (od.why) notTaken[od.why] = (notTaken[od.why] || 0) + 1;
  const st = stats(trades);
  const bySess = {}, byLevel = {}, byKind = {};
  for (const x of trades) { (bySess[x.sess] = bySess[x.sess] || []).push(x); (byLevel[x.level] = byLevel[x.level] || []).push(x); byKind[x.kind] = (byKind[x.kind] || 0) + 1; }
  const sub = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { n: v.length, net: +v.reduce((a, x) => a + x.Rnet, 0).toFixed(2), win: +(v.filter((x) => x.R > 0).length / v.length).toFixed(2) }]));
  const variants = {}; for (const [id, ods] of Object.entries(byVariant)) { const tk = selectTrades(ods.map((od) => ({ ...od })), ny).filter((od) => od.sim.t >= since).map(row); variants[id] = { orders: ods.filter((od) => S5[od.dir].t[od.jA] >= since).length, taken: tk.length, stats: stats(tk), trades: tk }; }
  return { at: new Date(now * 1000).toISOString(), from: new Date(since * 1000).toISOString().slice(0, 10), to: new Date(now * 1000).toISOString().slice(0, 10), days,
    bars: bars.length, m15: m15.length, funnel: fun, build: bc, orders: orders.length, filled: orders.filter((od) => od.sim.filled).length, unfilled, notTaken,
    stats: st, bySession: sub(bySess), byLevel: sub(byLevel), byExit: byKind, trades, setups: setups.filter((x) => x.t >= since).sort((a, b) => a.t - b.t), variants,
    note: 'What the pre-registered LIT rule would have done on OANDA 5m gold over this window, simulated as the study did (costs $0.30 spread + $0.15 slippage on market exits in Rnet; Rnet2 doubles them). Paper research, not the live shadow stream\'s records. The study\'s verdict (inconclusive, 2008-2026) stands.' };
}

if (process.argv[1] && process.argv[1].endsWith('lit-replay.mjs')) {
  const argv = process.argv.slice(2), flags = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; }
  const DIR = argv.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) || 'data', OUT = path.join(DIR, 'lit', 'replay.json'), days = +flags.days || DAYS;
  try {
    let prev = null; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
    if (prev && !flags.force && Date.now() - Date.parse(prev.at) < FRESH * 1000) { console.log(`LIT replay: fresh (${prev.trades.length} trades, ${prev.at})`); process.exit(0); }
    const bars = await fetchBars(days);
    if (bars.length < 2000) throw new Error(`only ${bars.length} candles`);
    const out = replay(bars, { days });
    fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log(`LIT replay: ${out.from} → ${out.to}, ${out.bars} candles, ${out.setups.length} setups, ${out.orders} orders, ${out.filled} filled, ${out.trades.length} taken, net ${out.stats.total ?? 0}R; variants ${Object.entries(out.variants).map(([k, v]) => `${k} ${v.taken}`).join(', ')}`);
  } catch (e) { console.log(`LIT replay failed: ${e.message}`); }
}
