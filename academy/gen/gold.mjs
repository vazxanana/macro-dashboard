// Candidates and outcomes of the five gold-systems edges (replica, mosha-bo, gtrend, gtl, geg), produced by running the
// study scripts of research/edge/gold-systems unchanged (see study.mjs runStudy) and reading the trades they manage.
// Needs GOLD_DIR (the HistData XAUUSD M1 files) and OUT_DIR (a scratch folder the studies write to); run.mjs sets both.
import { runStudy, recorder, round, lowerBound, excursions, sessionOf, stamps } from './study.mjs';
import { edgeById, poolOf } from '../edges.mjs';

const GS = 'research/edge/gold-systems/';
const PX = 2;          // gold prices to the cent
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
function must(ok, msg) { if (!ok) throw new Error('academy/gen/gold: ' + msg); }

// One study position (first unit + its add legs, as core.mjs step leaves it) -> { cand, out, net } in the contract shape.
// The stop a trade object carries at the end is the trailed one; the initial stop is entry -/+ r0 (how every study sets r0).
function fromPosition(edge, p, m, cost, tags) {
  const side = p.side, r0 = p.r0, entry = p.entry, t = p.opened;
  const cand = { id: null, edge: edge.id, market: edge.market, t, side: side > 0 ? 'buy' : 'sell', entry: round(entry, PX), stop: round(entry - side * r0, PX),
    target: p.rr < 99 ? round(p.t1, PX) : null, tf: edge.signalTf,
    rule: { ...tags, risk: round(r0, PX), ...stamps(t) }, edgeVersion: edge.version, pool: poolOf(edge.id, t) };
  if (p.status === 'expired' || p.status === 'missed') {   // a limit order that never filled: no trade, zero result
    const reason = p.status === 'missed' ? 'missed' : (p.expireAt != null && p.closed < p.expireAt ? 'cancelled' : 'expired');
    return { cand, out: { id: null, R: 0, netR: 0, exitT: p.closed, exit: null, reason, mfeR: null, maeR: null }, filled: false, net: 0, gross: 0 };
  }
  const legs = (p.legs || [p]).filter((x) => x.status !== 'expired' && x.status !== 'missed');
  let g = 0, n = 0; for (const x of legs) { const sz = x.size || 1; g += x.R * sz; n += (x.R - cost / x.r0) * sz; }   // core.mjs unitR, summed as the studies' rows
  const reason = p.exit === 'target' ? 'target' : p.exit === 'time' ? 'time' : p.exit === 'stop' ? (p.trail && p.trailMoved ? 'trail' : p.beMoved ? 'breakeven' : 'stop') : 'end';
  const kFill = lowerBound(m.T, p.filled), kExit = lowerBound(m.T, p.closed);
  const ex = excursions({ side, entry, r0, kFill, kExit, exitR: p.R, bar: (k) => ({ high: m.H[k], low: m.L[k] }) });
  const out = { id: null, R: round(g, 4), netR: round(n, 4), exitT: p.closed, exit: round(entry + side * p.R * r0, PX), reason, ...ex };
  if (legs.length > 1 || (p.size || 1) !== 1) out.unitR = round(p.R, 4);
  if (legs.length > 1) out.add = true;
  if (tags.order === 'limit') out.fillT = p.filled;
  return { cand, out, filled: true, net: n, gross: g };
}

// Turn a variant's positions into sorted candidates + outcomes and prove they are the study's rows (same n, same net R).
function build(edge, run, m, cost, tagsOf) {
  const pos = run.trades.filter((t) => t.legs);
  const recs = pos.map((p) => ({ p, ...fromPosition(edge, p, m, cost, tagsOf(p)) })).sort((a, b) => a.cand.t - b.cand.t);
  const ids = new Set();
  for (const r of recs) { let id = `${edge.id}-${r.cand.t}${r.cand.side[0]}`; for (let k = 2; ids.has(id); k++) id = `${edge.id}-${r.cand.t}${r.cand.side[0]}-${k}`; ids.add(id); r.cand.id = r.out.id = id; }
  const filled = recs.filter((r) => r.filled), sumN = filled.reduce((a, r) => a + r.net, 0), sumRows = run.rows.reduce((a, r) => a + r.n, 0);
  must(filled.length === run.rows.length, `${edge.id}: ${filled.length} filled positions but the study has ${run.rows.length} rows`);
  must(near(sumN, sumRows), `${edge.id}: net R ${sumN} differs from the study's rows ${sumRows}`);
  const exp = round(sumN / filled.length, 3);
  must(filled.length === edge.study.n && exp === edge.study.netR, `${edge.id}: reproduced n ${filled.length}, ${exp}R a trade; published ${edge.study.n}, ${edge.study.netR}R`);
  return { cands: recs.map((r) => r.cand), outs: Object.fromEntries(recs.map((r) => [r.out.id, r.out])), repro: { n: filled.length, orders: recs.length, netR: exp, sumNetR: round(sumN, 2) } };
}
const variantRun = (rec, RES, name) => { const i = Object.keys(RES.variants).indexOf(name); must(i >= 0 && rec.runs[i], `variant ${name} not found`); return rec.runs[i]; };

export async function generateGold() {
  const out = {}; let h1 = null, m1End = null;   // the M1 -> H1 series the studies read, for the data-quality report
  // ── daily.mjs: gold trend N20 + add, H4 trendline, daily engulf ──
  {
    const rec = recorder(), S = await runStudy(GS + 'daily.mjs', { override: rec.override, expose: ['RES', 'ctx', 'LAG', 'LIVE'] });
    const { ctx, RES, LAG } = S, { m, bars } = ctx, D = bars.d1, H4 = bars.h4;
    const { COST } = await import('../../research/edge/gold-systems/core.mjs');
    for (const id of ['gtrend', 'gtl', 'geg']) must(edgeById(id).costPerRoundTrip === COST, `${id}: registry cost differs from core.mjs COST`);
    const dIdx = new Map(D.map((b, i) => [b.time + 86400 + LAG, i])), hIdx = new Map(H4.map((b, i) => [b.time + 14400 + LAG, i]));
    // The tags below re-read the candles the rule looked at; each is checked against the entry / stop the study produced.
    const tr14 = (i) => Math.max(D[i].high - D[i].low, Math.abs(D[i].high - D[i - 1].close), Math.abs(D[i].low - D[i - 1].close));
    const atr14 = (i) => { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); return a / 14; };

    h1 = bars.h1; m1End = m.T[m.n - 1] + 60;
    out.gtrend = build(edgeById('gtrend'), variantRun(rec, RES, 'trend_N20_add'), m, COST, (p) => {
      const i = dIdx.get(p.opened); must(i != null, 'gtrend: no daily candle closes at ' + p.opened);
      const N = 20, hi = Math.max(...D.slice(i - N, i).map((b) => b.high)), A = atr14(i);   // daily.mjs goldTrend: hi, A
      must(D[i].close > hi && near(p.r0, 2 * A), 'gtrend: tags do not match the study trade at ' + p.opened);
      return { order: 'market', breakoutN: N, breakLevel: round(hi, PX), close: round(D[i].close, PX), atr14: round(A, PX), stopAtr: 2, exit: 'ratchet: stop = max(stop, daily close - 2 x ATR14); one add at +1R' };
    });

    out.gtl = build(edgeById('gtl'), variantRun(rec, RES, 'tl_live'), m, COST, (p) => {
      const nh = hIdx.get(p.opened) + 1; must(nh > 0, 'gtl: no H4 candle closes at ' + p.opened);
      const TL = { n: 3, span: 120, pad: 0.3 }, H = H4.slice(Math.max(0, nh - 720), nh), n = H.length, piv = [];   // daily.mjs goldTL: the last two confirmed pivot highs
      for (let i = n - TL.n - 1; i >= TL.n && piv.length < 2; i--) { let ok = true; for (let q = i - TL.n; q <= i + TL.n && ok; q++) if (q !== i && H[q].high >= H[i].high) ok = false; if (ok) piv.push(i); }
      const [b, a] = piv, lv = H[a].high + (H[b].high - H[a].high) / (b - a) * (n - 1 - a), lo = Math.min(...H.slice(b).map((x) => x.low));
      must(H[n - 1].close > lv && near(p.entry - p.r0, lo - TL.pad), 'gtl: tags do not match the study trade at ' + p.opened);
      return { order: 'market', session: sessionOf(p.opened), line: [[H[a].time, round(H[a].high, PX)], [H[b].time, round(H[b].high, PX)]], lineAt: round(lv, PX), close: round(H[n - 1].close, PX), swingLow: round(lo, PX), exit: 'trail 1R behind from +2R; 10R cap; out after 96 h' };
    });

    out.geg = build(edgeById('geg'), variantRun(rec, RES, 'eg_live'), m, COST, (p) => {
      const i = dIdx.get(p.opened); must(i != null, 'geg: no daily candle closes at ' + p.opened);
      const last = D[i]; let base = null;   // daily.mjs goldEG: the nearest red candle within k = 3
      for (let j = i - 1; j >= i - 3 && j >= 0; j--) { const c = D[j]; if (c.open > c.close) { base = c; break; } }
      must(base && near(base.high, p.entry) && near(base.low - 0.3, p.entry - p.r0), 'geg: tags do not match the study order at ' + p.opened);
      const sma = D.slice(i + 1 - 20, i + 1).reduce((s, c) => s + c.close, 0) / 20, k0 = lowerBound(m.T, p.opened);
      return { order: 'limit', base: { time: base.time, low: round(base.low, PX), high: round(base.high, PX) }, close: round(last.close, PX), sma20: round(sma, PX), priceAtSignal: round(m.C[k0 - 1], PX), validDays: 20, exit: 'trail 1R behind from +2R; 10R cap; out 240 h after the fill' };
    });
  }
  // ── mosha.mjs: the live config (weekly + slow 12 + cap, BE / add / run) ──
  {
    const rec = recorder(), S = await runStudy(GS + 'mosha.mjs', { override: rec.override, expose: ['RES', 'ctx', 'chains'] });
    const { ctx, RES, chains } = S, edge = edgeById('mosha-bo');
    const byKey = new Map(chains.map((c) => [`${c.T}|${c.d}|${c.entry}`, c]));
    out['mosha-bo'] = build(edge, variantRun(rec, RES, 'live'), ctx.m, edge.costPerRoundTrip, (p) => {
      const c = byKey.get(`${p.opened}|${p.side}|${p.entry}`); must(c, 'mosha-bo: no chain for the order at ' + p.opened);
      return { order: 'limit', session: sessionOf(p.opened), priceAtSignal: round(c.price, PX), weekly: c.w1 > 0 ? 'up' : 'down', pullH1: c.pull, m15Flip: !!c.flip, validHours: 24, exit: 'BE at +1.5R; add at +1.5R; trail 1R behind from +3R; 10R cap; out 72 h after the fill' };
    });
  }
  // ── replica.mjs: the live rule (gate p80, D1 with, MSNR size, risk rules, news veto, live exits) ──
  {
    const rec = recorder(), S = await runStudy(GS + 'replica.mjs', { override: rec.override, expose: ['RES', 'ctx'] });
    const { ctx, RES } = S, edge = edgeById('replica');
    out.replica = build(edge, variantRun(rec, RES, 'live'), ctx.m, edge.costPerRoundTrip, (p) => {
      const s = p.sig; must(s && s.T === p.opened, 'replica: trade without its signal at ' + p.opened);
      return { order: 'market', session: sessionOf(p.opened), size: p.size, signalClose: s.tc + 300, lagSec: s.lag, star: !!s.star, h1Clear: !!s.h1clear, h4: s.h4, d1: 'with', msnr: s.msnr,
        vol20: round(ctx.vol20[s.nd], 3), volRank: round(ctx.volRank(s.nd), 1), exit: 'BE at +2R; add at +1.5R; trail 1R behind from +4R; 10R cap; out after 48 h' };
    });
  }
  return { edges: out, h1, m1End };
}
