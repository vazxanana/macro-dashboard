// Shadow-book audit (8 Nov 2026): the week report said the SHADOW book lost about −306R over ~500 trades in the week of 2-8 Nov
// against Meridian live −38R (37) and ICT A +19R (9). Where does the loss come from, stream by stream, and how much of it is a
// costing or sizing artefact rather than a paper loss? Paper research only: this script reads council-data files and writes
// result.json; it changes no rule. The one fix it led to is a data repair (council/repairs.mjs voidM30Twins: the pre-dedupe
// m30m1 copies of Scalp entries get status 'duplicate'); it is applied here on a copy so the "after repair" book can be shown.
//
//   node research/edge/shadow-audit/run.mjs <council-data dir> [week Monday, default 2026-11-02] [out result.json]
//
// Streams: one per setup k (and per k x market group, k x session), as the Coach and the scoreboard split them, plus the shadow
// systems that have no closed shadow trade yet (crypto trend, gold trend fast, the ICT variants). Costs are the Trader's own
// (council/fills.mjs: Rnet = R − costR; the week report and digest read the same field, merNet). The "trades needed" bar is the
// robustness audit's: |t| >= 2 at the stream's current expectancy (n = (2 sd / |exp|)^2), capped at 2 years of its own rate.
import fs from 'node:fs';
import path from 'node:path';
import { spreadOf, FEE, SLIP_SPREADS, limitEntry, targetExit } from '../../../council/fills.mjs';
import { merNet, ictNet } from '../../../council/digest.mjs';
import { m30Twin, M30_DEDUPE_AT, voidM30Twins } from '../../../council/repairs.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../../..');
const [CD = 'data', WEEK = '2026-11-02', OUT = path.join(HERE, 'result.json')] = process.argv.slice(2);
const rd = (f, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8')); } catch (e) { return d; } };
const rdR = (f, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return d; } };

const DONE = new Set(['win', 'loss', 'be']);
const from = Date.parse(WEEK + 'T00:00:00Z') / 1000, to = from + 7 * 86400;
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const isClosed = (x) => x && DONE.has(x.status) && Number.isFinite(x.R) && (x.closed || x.exitAt);
const inWeek = (x) => { const t = x.closed || x.exitAt; return t > from && t <= to; };
// the Trader's markets (council/trader.mjs MARKETS): group decides the cost model
const MK = { xau: { group: 'Metals', spot: true }, btc: { group: 'Crypto' }, eth: { group: 'Crypto' }, sol: { group: 'Crypto' }, xrp: { group: 'Crypto' },
  eurusd: { group: 'Forex' }, gbpusd: { group: 'Forex' }, audusd: { group: 'Forex' }, usdcad: { group: 'Forex' }, usdchf: { group: 'Forex' } };
const NAME = { scalp: 'Scalp (M15→M1)', rscalp: 'Retrace scalp (M15→M1)', intraday: 'Intraday (H1→M5)', rintra: 'Retrace intraday (H1→M5)', swing: 'Swing (H4→H1)',
  rswing: 'Retrace swing (H4→H1)', position: 'Position (D1→H1)', m30m1: 'Gold M30→M1', trend: 'Crypto trend v3', gtrend5: 'Gold trend fast (N5)', 'mosha-bo': 'Mosha BO (momentum shadow)' };

function describe(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: 0, sd: 0, t: 0, sum: 0 };
  const sum = xs.reduce((s, x) => s + x, 0), mean = sum / n, sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, sum };
}
// cost of one trade split into its parts, in R of the trade's risk (default cost model, as every trade on record has costSrc 'default')
function costParts(x) {
  const M = MK[x.market]; if (!M) return null;
  const px = +x.entry, r0 = +x.r0 || Math.abs(x.entry - x.stop); if (!(px > 0 && r0 > 0)) return null;
  const sp = spreadOf(M, px), lim = limitEntry(x);
  const fees = M.group === 'Crypto' ? px * ((lim ? FEE.maker : FEE.taker) + FEE.taker) : 0;
  const slip = (lim ? 0 : SLIP_SPREADS * sp) + (targetExit(x) ? 0 : SLIP_SPREADS * sp);
  return { fees: fees / r0, spread: sp / r0, slip: slip / r0, total: (fees + sp + slip) / r0, r0, stopPct: 100 * r0 / px, spreads: r0 / sp, lim };
}
// the same crypto trade at a CFD / raw venue (research/edge/costs: 0.04% round trip instead of Kraken's 0.65-0.80%)
function cfdNet(x) {
  const M = MK[x.market], px = +x.entry, r0 = +x.r0 || Math.abs(x.entry - x.stop); if (!M || M.group !== 'Crypto' || !(r0 > 0)) return merNet(x);
  const sp = spreadOf(M, px), lim = limitEntry(x), slip = (lim ? 0 : SLIP_SPREADS * sp) + (targetExit(x) ? 0 : SLIP_SPREADS * sp);
  return x.R - (sp + 0.0004 * px + slip) / r0;
}
function tally(L, net = merNet) {
  const o = { n: L.length, w: 0, l: 0, gross: 0, net: 0, cost: 0, fees: 0, spread: 0, slip: 0 };
  for (const x of L) { if (x.R > 0) o.w++; else if (x.R < 0) o.l++; o.gross += x.R; o.net += net(x); const c = costParts(x); if (c) { o.fees += c.fees; o.spread += c.spread; o.slip += c.slip; } }
  o.cost = o.gross - o.net; const d = describe(L.map(net));
  return { n: o.n, w: o.w, l: o.l, winPct: o.n ? Math.round(100 * o.w / o.n) : null, gross: r2(o.gross), net: r2(o.net), cost: r2(o.cost), fees: r2(o.fees), spread: r2(o.spread), slip: r2(o.slip),
    expGross: o.n ? r3(o.gross / o.n) : null, expNet: o.n ? r3(o.net / o.n) : null, sdNet: r2(d.sd), tNet: r2(d.t) };
}
const groupBy = (L, f) => { const m = {}; for (const x of L) { const k = f(x); (m[k] = m[k] || []).push(x); } return m; };
const table = (m, net) => Object.fromEntries(Object.entries(m).map(([k, L]) => [k, tally(L, net)]).sort((a, b) => a[1].net - b[1].net));

// ─── data ───
const trades = rd('trades.json', []), ictTrades = rd('ict/trades.json', []), ictReplay = rd('ict/replay.json', {}), ictShadow = rd('ict/shadow.json', {});
const robust = rd('research/robustness.json', {}), shadowReplay = rd('research/shadow-replay.json', null), config = rd('config.json', {});
const base = rdR('council/decay-base.json', { systems: {} }).systems || {};
const at = new Date().toISOString(), snapAt = config.btAt || null;

// ─── 1. the week's shadow book, stream by stream ───
const closedWk = trades.filter((x) => isClosed(x) && inWeek(x));
const sh = closedWk.filter((x) => x.shadow), lv = closedWk.filter((x) => !x.shadow);
const ictWk = (Array.isArray(ictTrades) ? ictTrades : []).filter((x) => isClosed(x) && inWeek(x));
const ictOther = ictWk.filter((x) => !x.aset), ictVariantsWk = Object.values((ictShadow && ictShadow.variants) || {}).flatMap((v) => (v.trades || []).filter((x) => isClosed(x) && inWeek(x)));
const sess = (x) => (x.feat && x.feat.session) || 'n/a', grp = (x) => (MK[x.market] || {}).group || 'other';
const book = {
  week: { from: new Date(from * 1000).toISOString().slice(0, 10), to: new Date((to - 1) * 1000).toISOString().slice(0, 10) },
  shadow: tally(sh), live: tally(lv), ictOtherSignals: tally(ictOther, ictNet), ictVariants: tally(ictVariantsWk, ictNet),
  byK: table(groupBy(sh, (x) => x.k)), byGroup: table(groupBy(sh, grp)), byMarket: table(groupBy(sh, (x) => x.market)),
  byKGroup: table(groupBy(sh, (x) => `${x.k}|${grp(x)}`)), byKSession: table(groupBy(sh, (x) => `${x.k}|${sess(x)}`)), bySession: table(groupBy(sh, sess)),
  liveByK: table(groupBy(lv, (x) => x.k)),
};

// ─── 2. artefact checks ───
// a. the m30m1 copies of Scalp entries recorded before the 6 Nov dedupe (#259)
const twins = trades.filter((x) => x.k === 'm30m1' && x.opened < M30_DEDUPE_AT && m30Twin(x, trades));
const twinsWk = twins.filter((x) => isClosed(x) && inWeek(x)), twinsAfter = trades.filter((x) => x.k === 'm30m1' && x.opened >= M30_DEDUPE_AT && m30Twin(x, trades));
const m30Own = trades.filter((x) => x.k === 'm30m1' && !twins.includes(x));
const copyT = JSON.parse(JSON.stringify(trades)), cfgCopy = {}; const repaired = voidM30Twins(copyT, cfgCopy, at);
const shAfter = copyT.filter((x) => x.shadow && isClosed(x) && inWeek(x));
// b. market fills next to the stop: the engine's stop floor (minRisk x ATR, 5 spreads) is checked on the planned entry, not on the
//    fill; a market fill lands between the planned entry and the stop, so its risk can be a fraction of the planned risk (drift < 0:
//    fills.mjs driftR). R and costR are both per unit of that smaller risk.
const planned = (x) => x.ctx && Number.isFinite(x.ctx.planned) ? Math.abs(x.ctx.planned - x.stop) : null;
const ratio = (x) => { const p = planned(x), r0 = +x.r0 || Math.abs(x.entry - x.stop); return p > 0 ? r0 / p : null; };
const mktFills = sh.filter((x) => x.filled === x.opened && ratio(x) != null);
const subFloor = {
  marketFills: mktFills.length, withPlanned: sh.filter((x) => ratio(x) != null).length,
  under50: tally(sh.filter((x) => ratio(x) != null && ratio(x) < 0.5)), under25: tally(sh.filter((x) => ratio(x) != null && ratio(x) < 0.25)),
  under5Spreads: tally(sh.filter((x) => { const c = costParts(x); return c && c.spreads < 5; })), under15Spreads: tally(sh.filter((x) => { const c = costParts(x); return c && c.spreads < 15; })),
  worst: sh.map((x) => ({ x, c: costParts(x) })).filter((o) => o.c).sort((a, b) => b.c.total - a.c.total).slice(0, 8)
    .map(({ x, c }) => ({ id: x.id, k: x.k, market: x.market, entry: x.entry, stop: x.stop, stopPct: r3(c.stopPct), fillVsPlanned: ratio(x) != null ? r2(ratio(x)) : null, R: x.R, costR: x.costR, Rnet: merNet(x), status: x.status })),
  liveUnder50: lv.filter((x) => ratio(x) != null && ratio(x) < 0.5).length,
};
// c. two setups recording one idea (same market, side, stop and target, open at the same time): the live book takes it once ('duplicate');
//    the shadow book records both
const dupPairs = [];
for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) {
  const a = sh[i], b = sh[j]; if (a.market !== b.market || a.side !== b.side || a.k === b.k) continue;
  const tick = Math.abs(a.entry) * 1e-5;
  if (Math.abs(a.stop - b.stop) <= tick && Math.abs(a.t1 - b.t1) <= tick && a.opened <= (b.closed || b.opened) && b.opened <= (a.closed || a.opened)) dupPairs.push({ a: a.id, b: b.id, ks: [a.k, b.k].sort().join('+'), secondNet: r2(merNet(b)) });
}
const dupByKs = Object.fromEntries(Object.entries(groupBy(dupPairs, (p) => p.ks)).map(([k, L]) => [k, { pairs: L.length, secondNet: r2(L.reduce((s, p) => s + p.secondNet, 0)) }]));
// d. bookkeeping: adds, sizes, r0 vs the stop on record, gapped stops, Rnet = R − costR
const checks = {
  addsInShadow: sh.filter((x) => x.addOf).length, withSize: sh.filter((x) => x.size != null).length, withRawR: sh.filter((x) => x.rawR != null).length,
  r0DiffersFromStop: sh.filter((x) => x.r0 != null && Math.abs(x.r0 - Math.abs(x.entry - x.stop)) > 1e-9 * x.entry).length, rBelowMinus1: sh.filter((x) => x.R < -1).length,
  rnetMismatch: sh.filter((x) => Number.isFinite(x.Rnet) && Number.isFinite(x.costR) && Math.abs(x.Rnet - (x.R - x.costR * (x.size || 1))) > 0.011).length,
  costSrc: Object.fromEntries(Object.entries(groupBy(sh, (x) => x.costSrc || 'none')).map(([k, L]) => [k, L.length])),
  statuses: Object.fromEntries(Object.entries(groupBy(sh, (x) => `${x.status}|${x.R === -1 ? '-1' : x.R === 0 ? '0' : x.R > 0 ? '+' : 'other'}`)).map(([k, L]) => [k, L.length])),
};
// e. venue: the crypto legs at Kraken spot fees (the model on record) vs a CFD / raw venue
const crypto = sh.filter((x) => grp(x) === 'Crypto');
const venue = { kraken: tally(crypto), cfd: tally(crypto, cfdNet), byK: Object.fromEntries(Object.entries(groupBy(crypto, (x) => x.k)).map(([k, L]) => [k, { n: L.length, gross: tally(L).gross, kraken: tally(L).net, cfd: tally(L, cfdNet).net }])),
  medianCostR: { crypto: r2(median(crypto.map((x) => x.costR || 0))), forex: r2(median(sh.filter((x) => grp(x) === 'Forex').map((x) => x.costR || 0))), gold: r2(median(sh.filter((x) => x.market === 'xau').map((x) => x.costR || 0))) },
  medianStopPct: { crypto: r3(median(crypto.map((x) => costParts(x).stopPct))), forex: r3(median(sh.filter((x) => grp(x) === 'Forex').map((x) => costParts(x).stopPct))), gold: r3(median(sh.filter((x) => x.market === 'xau').map((x) => costParts(x).stopPct))) } };
function median(a) { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : 0; }

// ─── 3. research support and trades needed ───
// the record each stream will be judged on: its forward shadow trades (after the twin repair), then the longest replay of the same rule
const recSpan = (L) => { const t = L.map((x) => x.closed || x.exitAt).filter(Boolean); return t.length > 1 ? (Math.max(...t) - Math.min(...t)) / 86400 : 0; };
const allShAfter = copyT.filter((x) => x.shadow && isClosed(x));
const spanDays = Math.max(1, recSpan(allShAfter));
const srCols = shadowReplay && shadowReplay.cols, srRows = shadowReplay ? shadowReplay.rows.map((r) => Object.fromEntries(srCols.map((c, i) => [c, r[i]]))) : [];
const srByK = groupBy(srRows, (r) => r.k), srDays = shadowReplay ? (Date.parse(shadowReplay.to) - Date.parse(shadowReplay.from)) / 86400000 : 147;
// trades needed for |t| >= 2 at expectancy e with SD s, and the time that takes at the stream's own rate (cap 2 years)
function needed(e, s, perYear, have = 0) {
  if (!(s > 0) || !Number.isFinite(e)) return null;
  if (Math.abs(e) < 1e-6) return { n: Infinity, years: Infinity, judgeable: false, note: 'expectancy ~0: no number of trades reaches |t| 2' };
  const n = Math.ceil((2 * s / Math.abs(e)) ** 2), more = Math.max(0, n - have), years = perYear > 0 ? more / perYear : Infinity;
  return { n, have, more, perYear: r2(perYear), years: Number.isFinite(years) ? r2(years) : null, judgeable: years <= 2, alreadyJudged: have >= n };
}
const ictVar = (v) => { const L = ((ictReplay.shadowByVariant || {})[v] || []).filter((x) => isClosed(x) && x.valid !== false); const d = describe(L.map(ictNet)); return { n: d.n, exp: r3(d.mean), sd: r2(d.sd), t: r2(d.t), perYear: r2(d.n / Math.max(0.25, recSpan(L) / 365.25)) }; };
const ictDipL = ((ictReplay.shadow && ictReplay.shadow.trades) || (Array.isArray(ictReplay.shadow) ? ictReplay.shadow : [])).filter((x) => isClosed(x));
const ictDip = (() => { const d = describe(ictDipL.map(ictNet)); return { n: d.n, exp: r3(d.mean), sd: r2(d.sd), t: r2(d.t), perYear: r2(d.n / Math.max(0.25, recSpan(ictDipL) / 365.25)) }; })();
const rob = Object.fromEntries((robust.claims || []).map((c) => [c.id, { verdict: c.verdict, n: c.n, mean: c.mean, t: c.t, status: c.status }]));

// the streams: engine setups (forward record + the 150-day shadow replay), the shadow systems, the ICT variants
const SUPPORT = {
  scalp: { research: ['scalp-filters: FAIL (−0.20R IS / −0.20R OOS after spread, every one of 9 years negative; gross −0.07/−0.06)', 'scalp-exits: FAIL (23 exits all negative)', 'timing: FAIL', 'regime: loses in every regime', 'costs: no edge before costs on 8.8 years', 'setups-promote: FAIL (n 8,943 −0.19 IS, n 4,527 −0.23 OOS)'], robust: ['scalp-30d', 'scalp-30d-fx', 'scalp-150d', 'scalp-histdata'], supported: false },
  rscalp: { research: ['setups-promote: FAIL (−0.225 IS, −0.198 OOS; best condition 0/3 OOS years)', 'costs: "vanishes" under every cost model (rscalp −0.045 engine net on 580; forex −0.087)', 'owner rr ≥ 3 rule: worse in both periods'], robust: [], supported: false },
  intraday: { research: ['setups-promote: FAIL (−0.075 IS, −0.016 OOS, 1/3 OOS years)', 'regime: close to break-even everywhere (gross OOS +0.053)', 'costs: already negative gross on the 30-day replay'], robust: [], supported: false, nearZero: true },
  rintra: { research: ['setups-promote: FAIL (−0.082 IS, −0.079 OOS); gold-only +0.041 IS / +0.119 OOS (regime)', 'costs: +0.186 engine net on 113 (30-day), −0.49 at Kraken on crypto'], robust: [], supported: false, nearZero: true },
  swing: { research: ['meridian-swing: FAIL (−0.095R, t −3.0, n 2,076, negative in both halves and every year; owner rule −0.111, t −2.2)', 'regime: one weak ADX-band lead, "track on paper, not adopt"', 'setups-promote: FAIL'], robust: ['swing-adx', 'swing-adx-fwd'], supported: false, tag: 'D1 ADX band tag (swing-adx) lives on these records' },
  rswing: { research: ['setups-promote: FAIL (−0.116 IS, +0.021 OOS n 74; best condition 1/3)'], robust: [], supported: false },
  position: { research: ['setups-promote: FAIL (−0.156 IS, −0.185 OOS, 0/3); "Position off: yes"', 'owner research-150d: off since 2 Nov'], robust: [], supported: false },
  m30m1: { research: ['setups-promote: PASS, weak (gold, London only: +0.032 IS, +0.222 OOS n 128, 2/3 years; all sessions −0.144 IS / +0.216 OOS under D1 with)', '5,925 of 8,016 replay signals duplicate a Scalp entry: the stream is mostly the Scalp recorded twice'], robust: [], supported: 'weak', londonOnly: true },
  trend: { research: ['crypto-trend-decay (#508): decayed; Jun 2025-Oct 2026 −0.13R over 20 positions (t −0.56), Kraken −0.25 over 24', 'robustness: trend-2018 robust on 2017-26, trend (council replay) fragile'], robust: ['trend', 'trend-2018'], supported: 'decayed' },
  gtrend5: { research: ['gold-systems-oos (#530): regime-bound; 2006-17 +0.37R a position (n 129, t 1.92, both halves positive), misses robust on t only'], robust: ['gtrend5', 'gtrend5-2018'], supported: 'regime-bound' },
  'ict-nofri': { research: ['ict-filters: PASS, weak (no Friday A-setups holds 2018-26 OOS)'], robust: ['ict-nofri'], supported: 'weak' },
  'ict-h1opp': { research: ['desk variant (skill); ict-sessions / ict-filters: no session or structure filter passes the pre-registered bar'], robust: ['ict-h1opp'], supported: false },
  'ict-strail': { research: ['ict-exits: FAIL (no exit variant beat the live exit IS; skill §33 variant added as paper)'], robust: [], supported: false },
  'ict-silver': { research: ['ict-markets: passes the gate (n 82, +0.41R, t 2.02, both halves positive; 16 cells tested, HistData t 1.91, 2018-23 −79.5R)'], robust: [], supported: 'weak' },
  'ict-dip': { research: ['ict-index-longonly: the dip-buy adds little beyond being long equities (see RESULT); robustness fragile'], robust: ['ict-dip'], supported: false },
};
const streams = {};
for (const k of ['scalp', 'rscalp', 'intraday', 'rintra', 'swing', 'rswing', 'position', 'm30m1']) {
  const fwd = allShAfter.filter((x) => x.k === k), d = describe(fwd.map(merNet)), perYear = fwd.length / (spanDays / 365.25);
  const wk = shAfter.filter((x) => x.k === k);
  const rp = srByK[k] || [], rd2 = describe(rp.map((r) => +r.R)), rpPerYear = rp.length / (srDays / 365.25);
  streams[k] = { name: NAME[k], kind: 'engine setup (shadow)', week: tally(wk), forward: { n: d.n, expNet: r3(d.mean), sdNet: r2(d.sd), t: r2(d.t), perYear: r2(perYear), days: r2(spanDays) },
    replay150d: rp.length ? { n: rd2.n, exp: r3(rd2.mean), sd: r2(rd2.sd), t: r2(rd2.t), perYear: r2(rpPerYear), note: 'research/shadow-replay.json, spread-only cost, Jun-Oct 2026' } : null,
    needed: { atForward: needed(d.mean, d.sd, perYear, d.n), atReplay: rp.length ? needed(rd2.mean, rd2.sd, rpPerYear, 0) : null },
    research: SUPPORT[k], robustness: (SUPPORT[k].robust || []).map((id) => ({ id, ...(rob[id] || { verdict: 'not audited' }) })) };
  if (k === 'm30m1') {
    const own = m30Own.filter((x) => isClosed(x)), London = own.filter((x) => sess(x) === 'london');
    streams[k].ownTrades = { n: own.length, net: r2(own.reduce((s, x) => s + merNet(x), 0)), london: London.length, twinsVoided: twins.length };
    streams[k].needed.atSetupsPromote = needed(0.222, 1.8, 128 / 2.83, 0);   // OOS London cell: +0.222R over 128 trades in 2024-Oct 2026; SD ~1.8R as the gold M1 setups run
  }
}
for (const [k, id] of [['trend', 'trend'], ['gtrend5', 'gtrend5']]) {
  const b = base[id] || {}, fwd = trades.filter((x) => x.k === k && x.shadow && isClosed(x)), open = trades.filter((x) => x.k === k && x.shadow && (x.status === 'open' || x.status === 'pending')).length;
  const late = k === 'trend' ? { exp: -0.13, sd: 1.04, n: 20, note: 'Jun 2025-Oct 2026 window of #508 (t −0.56 → sd ≈ 1.0R; the 2017-26 baseline SD is 8.5R)' } : { exp: 0.372, sd: 2.2, n: 129, note: '2006-17 out of sample (#530): +0.372R, t 1.92 → sd ≈ 2.2R' };
  streams[k] = { name: NAME[k], kind: 'system moved to shadow by the owner (7 Nov)', week: tally(fwd.filter(inWeek)), forward: { n: fwd.length, open }, baseline: { ref: b.ref, sd: b.sd, perYear: b.perYear, src: b.src },
    needed: { atRecentExpectancy: { ...needed(late.exp, late.sd, b.perYear || 10, 0), note: late.note }, atBaselineSD: needed(late.exp, b.sd || late.sd, b.perYear || 10, 0) },
    research: SUPPORT[k], robustness: (SUPPORT[k].robust || []).map((id2) => ({ id: id2, ...(rob[id2] || { verdict: 'not audited' }) })) };
}
for (const v of ['nofri', 'h1opp', 'strail', 'silver']) {
  const s = ictVar(v), fwdV = (((ictShadow.variants || {})[v] || {}).trades || []).filter(isClosed);
  streams['ict-' + v] = { name: `ICT variant ${v}`, kind: 'ICT desk paper variant (forward since 7 Nov)', week: tally(fwdV.filter(inWeek), ictNet), forward: { n: fwdV.length, since: ((ictShadow.variants || {})[v] || {}).since || null },
    replay: { ...s, note: 'ict/replay.json shadowByVariant, Aug 2025-Nov 2026, after the CME micro round trip' }, needed: { atReplay: needed(s.exp, s.sd, s.perYear, 0) },
    research: SUPPORT['ict-' + v], robustness: (SUPPORT['ict-' + v].robust || []).map((id) => ({ id, ...(rob[id] || { verdict: 'not audited' }) })) };
}
streams['ict-dip'] = { name: 'ICT dip-buy NQ/ES', kind: 'ICT desk paper variant', week: tally((ictShadow.trades || []).filter((x) => isClosed(x) && inWeek(x)), ictNet), forward: { n: (ictShadow.trades || []).filter(isClosed).length, since: ictShadow.since || null },
  replay: { ...ictDip, note: 'ict/replay.json shadow (dip), after costs' }, needed: { atReplay: needed(ictDip.exp, ictDip.sd, ictDip.perYear, 0) },
  research: SUPPORT['ict-dip'], robustness: [{ id: 'ict-dip', ...(rob['ict-dip'] || { verdict: 'not audited' }) }] };

// ─── 4. the lists (reasons filled from the numbers above) ───
const S = streams, f2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R';
const lists = {
  retire: [
    { stream: 'rscalp (all markets)', why: `forward ${f2(S.rscalp.forward.expNet)} a trade net over ${S.rscalp.forward.n} (t ${S.rscalp.forward.t}); 150-day replay ${f2(S.rscalp.replay150d.exp)} over ${S.rscalp.replay150d.n}; setups-promote FAIL in both halves; the costs study: vanishes under every cost model. Already judged: losing.` },
    { stream: 'scalp, rscalp, rintra, intraday on BTC / ETH / SOL / XRP', why: `${venue.kraken.n} trades: gross ${f2(venue.kraken.gross)}, ${f2(venue.kraken.net)} at Kraken spot fees (median cost ${venue.medianCostR.crypto}R a trade on a median ${venue.medianStopPct.crypto}% stop), ${f2(venue.cfd.net)} at CFD cost. A scalp whose round-trip cost is 1-2x its risk cannot be judged on any venue the council has; the owner already moved crypto trend to shadow.` },
    { stream: 'position', why: `off since the owner's 2 Nov research-150d rule; replay ${f2(S.position.replay150d.exp)} a trade over ${S.position.replay150d.n}; setups-promote FAIL (−0.156 / −0.185). Nothing to learn from 1-2 shadow trades a week.` },
    { stream: 'rswing', why: `setups-promote FAIL; ${S.rswing.forward.n} forward trades in a week, replay ${f2(S.rswing.replay150d.exp)} over ${S.rswing.replay150d.n}; at that rate it cannot reach |t| 2 within 2 years.` },
    { stream: 'scalp on gold + forex (owner decides)', why: `no study supports it anywhere (scalp-filters, scalp-exits, timing, regime, costs all FAIL; every one of 9 years negative after spread). Forward: gold ${f2(book.byKGroup['scalp|Metals'] ? book.byKGroup['scalp|Metals'].net : 0)} over ${book.byKGroup['scalp|Metals'] ? book.byKGroup['scalp|Metals'].n : 0}, forex ${f2(book.byKGroup['scalp|Forex'] ? book.byKGroup['scalp|Forex'].net : 0)} over ${book.byKGroup['scalp|Forex'] ? book.byKGroup['scalp|Forex'].n : 0} this week. It is the Coach's filter-trial sample, so keep it only if the owner wants the Coach to keep learning on it.` },
  ],
  keep: [
    { stream: 'intraday (gold + forex)', why: `the one engine setup research puts near zero rather than negative (regime: gross OOS +0.053; forward ${f2(S.intraday.forward.expNet)} over ${S.intraday.forward.n}); needs ${S.intraday.needed.atReplay ? S.intraday.needed.atReplay.n : '?'} trades at the replay expectancy (${S.intraday.needed.atReplay && S.intraday.needed.atReplay.judgeable ? 'within 2 years' : 'more than 2 years'}). Crypto legs out (venue).` },
    { stream: 'rintra on gold', why: `gold-only +0.119R OOS in setups-promote (regime, not proven); forward gold ${f2(book.byKGroup['rintra|Metals'] ? book.byKGroup['rintra|Metals'].net : 0)} over ${book.byKGroup['rintra|Metals'] ? book.byKGroup['rintra|Metals'].n : 0}. Forex and crypto legs out.` },
    { stream: 'm30m1 (gold, its own trades only, judged on London)', why: `the only formal PASS among the engine setups (weak: +0.222R OOS over 128 London trades, 2/3 years). After the twin repair it has ${S.m30m1.ownTrades.n} trades of its own (${f2(S.m30m1.ownTrades.net)}); it needs about ${S.m30m1.needed.atSetupsPromote.n} London trades (~${S.m30m1.needed.atSetupsPromote.years} years at the replay rate) before |t| 2.` },
    { stream: 'swing (tag only, 1-2 trades a week)', why: 'meridian-swing FAIL, but the D1 ADX band tag (swing-adx, robustness claim swing-adx-fwd) is read off these records; the owner moved it to shadow on 7 Nov. Keep as a tag source, not as an edge candidate.' },
    { stream: 'crypto trend shadow, gold trend fast shadow', why: `the owner's 7 Nov decisions; no closed shadow trade yet. Neither can be judged within 2 years at its own rate (${S.trend.baseline.perYear} and ${S.gtrend5.baseline.perYear} positions a year): crypto trend needs ${S.trend.needed.atRecentExpectancy.n} positions at −0.13R, gold trend fast ${S.gtrend5.needed.atRecentExpectancy.n} at +0.37R. They are owner-watch streams, not council verdicts.` },
    { stream: 'ICT variants nofri, h1opp, strail, silver, dip', why: `each is one open paper position at a time with futures costs of 0.02-0.03R a trade (no costing issue). Replay t 2.1-2.5 but in-sample for the variant choice (robustness: fragile); an independent forward record needs ${['nofri', 'h1opp', 'strail', 'silver'].map((v) => `${v} ${S['ict-' + v].needed.atReplay.n} (${S['ict-' + v].needed.atReplay.years} y)`).join(', ')}, dip ${S['ict-dip'].needed.atReplay.n} (${S['ict-dip'].needed.atReplay.years} y).` },
  ],
};

// ─── 5. verdict ───
const costShare = r2(100 * book.shadow.cost / Math.abs(book.shadow.net));
const cryptoShare = r2(100 * venue.kraken.cost / book.shadow.cost);
const afterRepair = tally(shAfter);
const verdict = `The shadow book did not lose ${f2(book.shadow.net)} of trading: on ${book.shadow.n} closed shadow trades it made ${f2(book.shadow.gross)} gross and paid ${book.shadow.cost.toFixed(2)}R of modelled costs, ${Math.round(cryptoShare)}% of them Kraken spot fees on ${venue.kraken.n} crypto scalps whose stops are a fraction of the 0.8% round trip (the same trades at CFD cost: ${f2(venue.cfd.net)}). One bookkeeping artefact is proven and repaired (${twins.length} m30m1 copies of Scalp entries, ${twinsWk.length} closed this week, counted twice: after the repair the week is ${afterRepair.n} trades, ${f2(afterRepair.gross)} gross / ${f2(afterRepair.net)} net). The near-stop market fills are a sizing artefact for the owner to rule on (${subFloor.under50.n} trades filled at under half the planned risk carry ${subFloor.under50.cost.toFixed(2)}R of the cost). No shadow stream has robust research behind it; rscalp and the crypto legs are already judged (losing / unjudgeable on this venue) and should be retired; intraday, rintra on gold, m30m1 on its own trades and the ICT variants are the streams worth the paper.`;

const result = { at, snapshot: { councilData: CD, btAt: snapAt, note: 'council-data as cloned; the week report figure (−306.66R / 499) was read from a later or earlier snapshot of the same files' },
  verdict, book, artefacts: { m30Twins: { total: twins.length, closedInWeek: twinsWk.length, weekGross: r2(twinsWk.reduce((s, x) => s + x.R, 0)), weekNet: r2(twinsWk.reduce((s, x) => s + merNet(x), 0)), afterDedupe: twinsAfter.length, ownM30: m30Own.length, repaired, bookAfterRepair: afterRepair, byKAfterRepair: table(groupBy(shAfter, (x) => x.k)) },
    subFloorFills: subFloor, crossSetupDuplicates: { pairs: dupPairs.length, secondLegNet: r2(dupPairs.reduce((s, p) => s + p.secondNet, 0)), byKs: dupByKs, note: 'the live book blocks the second idea (duplicate); the shadow book records both; small this week' },
    bookkeeping: checks, venue }, streams, lists, costShareOfNetPct: costShare, cryptoShareOfCostPct: cryptoShare };
fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');

// ─── print ───
const row = (k, t) => `| ${k} | ${t.n} | ${t.winPct == null ? '' : t.winPct + '%'} | ${f2(t.gross)} | ${f2(-t.cost)} (fees ${t.fees}, spread ${t.spread}, slip ${t.slip}) | ${f2(t.net)} | ${t.expNet == null ? '' : f2(t.expNet)} | ${t.tNet} |`;
console.log(verdict + '\n');
console.log(`Week ${book.week.from} – ${book.week.to}: shadow ${book.shadow.n} trades ${f2(book.shadow.gross)} gross / ${f2(book.shadow.net)} net (cost ${f2(-book.shadow.cost)}); live ${book.live.n} ${f2(book.live.gross)} / ${f2(book.live.net)}; ICT other ${book.ictOtherSignals.n}, variants ${book.ictVariants.n}\n`);
for (const [title, m] of [['by setup', book.byK], ['by market group', book.byGroup], ['by setup x group', book.byKGroup], ['by setup x session', book.byKSession], ['by market', book.byMarket]]) {
  console.log(`### ${title}\n| stream | n | win | gross | cost | net | net/trade | t |\n|---|---|---|---|---|---|---|---|`);
  for (const [k, t] of Object.entries(m)) console.log(row(k, t)); console.log();
}
console.log('m30m1 twins', twins.length, 'closed in week', twinsWk.length, 'after repair', JSON.stringify(afterRepair));
console.log('sub-floor <0.5', JSON.stringify(subFloor.under50), '\n<0.25', JSON.stringify(subFloor.under25), '\n<5 spreads', JSON.stringify(subFloor.under5Spreads));
console.log('venue', JSON.stringify(venue, null, 0));
console.log('dups', JSON.stringify(dupByKs), 'checks', JSON.stringify(checks));
for (const [k, s] of Object.entries(streams)) console.log(k.padEnd(12), JSON.stringify({ week: s.week && [s.week.n, s.week.gross, s.week.net], forward: s.forward, needed: s.needed }));
