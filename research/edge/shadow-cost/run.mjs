// Shadow streams at realistic costs (pre-registered in preregistration.md): every paper shadow stream re-costed trade by trade
// with costmodel.mjs, judged IS vs OOS, written to result.json. Paper research only; reads council-data, changes nothing.
//   node research/edge/shadow-cost/run.mjs <council-data checkout> [--out research/edge/shadow-cost/result.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trendStrength, REGIME } from '../../../council/regime.mjs';
import { targetExit, limitEntry } from '../../../council/fills.mjs';
import { GATE, BROKER, brokerFrom, costR, mirrorSlippage, judge, groupOf, stats } from './costmodel.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const OOS_FROM = Date.UTC(2020, 0, 1) / 1000;
const ENGINE = ['scalp', 'rscalp', 'intraday', 'rintra', 'swing', 'rswing', 'position', 'm30m1'];
const DONE = new Set(['win', 'loss', 'be']);

export function load(cdir) {
  const C = (p) => rd(path.join(cdir, p));
  const symbols = C('ctrader/symbols.json'), broker = brokerFrom(symbols);
  const maps = []; for (const f of fs.readdirSync(path.join(cdir, 'ctrader')).filter((f) => /^mirror(-\d+)?\.json$/.test(f)).sort()) maps.push(C('ctrader/' + f).state?.map || {});
  const mirror = mirrorSlippage(maps, broker);
  const ref = Object.fromEntries(Object.entries(symbols.symbols || {}).flatMap(([n, s]) => (s.markets || []).map((m) => [m, (+s.bid + +s.ask) / 2])));
  return { symbols, broker, mirror, ref, trades: C('trades.json'), research: C('research.json'), ict: C('ict/replay.json'), ictShadow: C('ict/shadow.json'),
    bt150: C('research/backtest-150d.json'), at: symbols.at };
}

// one row per trade: { t, R (gross, x size), cost (R x size), live, market, parts }
function row(t, R, size, trade, ctx, live) {
  const c = costR(trade, ctx.broker, ctx.mirror.mult); if (!c || !Number.isFinite(R)) return null;
  return { t, R, cost: c.costR * size, live: !!live, market: trade.market, spreadR: c.spreadR * size, commR: c.commR * size, slipR: c.slipR * size };
}
const exitOf = (kind) => kind === 'target' ? 'target' : kind === 'time' || kind === 'dayEnd' || kind === 'eod' ? 'time' : 'stop';

// live paper records in trades.json / research.json (engine setups, LIT, the NQ trend shadow)
function liveRows(recs, ctx, pick) {
  return recs.filter((t) => pick(t) && DONE.has(t.status) && !t.void && Number.isFinite(t.R)).map((t) => {
    const unit = t.rawR != null ? t.rawR : t.R, size = t.rawR != null && t.size ? t.size : 1, r0 = +t.r0 || Math.abs(t.entry - t.stop);
    const exit = targetExit(t) ? 'target' : t.status === 'be' || unit <= -0.98 || t.exitKind === 'stop' ? 'stop' : 'time';
    const when = t.filled || t.opened;
    return row(when, unit * size, size, { market: t.market, entry: t.entry, t: when, r0, marketEntry: !limitEntry(t), exit }, ctx, true);
  }).filter(Boolean);
}

export function streams(ctx) {
  const S = {};
  // ── NQ open run, trend-on only: the regime study's trades gated with council/regime.mjs (|TS| >= 0.295) ──
  const I = rd(path.join(ROOT, 'research/edge/regime-switch/inputs.json')), NQ = I.d1.nq;
  S['nq-trend'] = { name: 'NQ open run, trend-on only (|TS| ≥ 0.295)', backtest: 'regime-switch study trades 2004–Nov 2026', oosFrom: OOS_FROM,
    rows: I.systems.nqopen.map(([entry, , net, net2]) => {
      const tr = trendStrength(NQ, entry); if (!tr || tr.abs < REGIME.trendMin) return null;
      const inv = Math.max(net - net2, 0.0005), r0 = 1 / inv, gross = net + inv;   // net = gross − 1 pt / r0, net2 = gross − 2 pt / r0
      return row(entry, gross, 1, { market: 'nq', entry: 1, t: entry, r0, marketEntry: true, exit: 'stop' }, ctx, false);
    }).filter(Boolean).concat(liveRows(ctx.research, ctx, (t) => /^nq-nyflipt-/.test(t.id) || t.session === 'nyflip-trend')) };
  // ── LIT on gold: the study's pre-registered primary (capped) trades ──
  const L = rd(path.join(ROOT, 'research/edge/lit/result.json')).markets.xau.sets['std:wick-open'].trades;
  S.lit = { name: 'LIT paper shadow (gold, pre-registered primary)', backtest: 'LIT study XAUUSD 2008–Oct 2026', oosFrom: OOS_FROM,
    rows: L.map((x) => row(x.t, x.R, 1, { market: 'xau', entry: x.entry, t: x.t, r0: x.riskFrac * x.entry, marketEntry: false, exit: exitOf(x.kind) }, ctx, false))
      .filter(Boolean).concat(liveRows(ctx.trades, ctx, (t) => t.k === 'lit')) };
  // ── ICT shadow variants and dip-buy: the desk's replay (IS) + forward shadow records (OOS) ──
  const ictRow = (x, live) => {
    if (!DONE.has(x.status) || !Number.isFinite(x.R)) return null;
    const size = x.size || 1, r0 = +x.r0 || Math.abs(x.entry - x.stop0);
    return row(x.opened, x.R, size, { market: x.market, entry: x.entry, t: x.opened, r0, marketEntry: true, exit: exitOf(x.exit) }, ctx, live);
  };
  const fwd = (v) => (v === 'dip' ? ctx.ictShadow.trades : ctx.ictShadow.variants?.[v]?.trades) || [];
  const ICTN = { nofri: 'ICT A-rule, no Friday (shadow)', h1opp: 'ICT A-rule, H1 opposite filter (shadow)', strail: 'ICT A-rule, structure trail exit (shadow)',
    silver: 'ICT gold rule on spot silver (paper market)', dip: 'ICT NQ/ES dip-buy (shadow)' };
  for (const v of ['nofri', 'h1opp', 'strail', 'silver', 'dip']) {
    const bt = v === 'dip' ? ctx.ict.shadow : ctx.ict.shadowByVariant[v];
    S['ict-' + v] = { name: ICTN[v], backtest: 'ICT desk replay Aug 2025–Nov 2026', oosFrom: null,
      rows: bt.map((x) => ictRow(x, false)).concat(fwd(v).map((x) => ictRow(x, true))).filter(Boolean) };
  }
  S['ref-ict-a'] = { name: 'Reference: ICT A-setups (live desk rule, not a shadow)', backtest: 'ICT desk replay Aug 2025–Nov 2026', oosFrom: null, reference: true,
    rows: ctx.ict.trades.filter((x) => x.aset).map((x) => ictRow(x, false)).filter(Boolean) };
  // ── council engine setups: the 150-day replay (IS) + the shadow book (OOS) ──
  const B = ctx.bt150, ix = Object.fromEntries(B.tradeCols.map((c, i) => [c, i]));
  const engSpread = (m) => groupOf(m) === 'forex' ? 1e-4 : m === 'xau' ? 0.3 : 0.0002;   // council/fills.mjs spreadOf (crypto: x price)
  for (const k of ENGINE) {
    const bt = B.trades.filter((r) => r[ix.setup] === k && r[ix.fill] && Number.isFinite(r[ix.R_none]) && r[ix.cost] > 0).map((r) => {
      const m = r[ix.market], crypto = groupOf(m) === 'crypto', px = crypto ? 1 : ctx.ref[m], r0 = engSpread(m) / r[ix.cost];
      const R = r[ix.R_none], exit = Math.abs(R - r[ix.rr]) <= 0.02 ? 'target' : R <= -0.98 ? 'stop' : 'time', t = r[ix.filled] || r[ix.opened];
      return row(t, R, 1, { market: m, entry: px, t, r0, marketEntry: false, exit }, ctx, false);
    }).filter(Boolean);
    S['eng-' + k] = { name: `Council engine ${k} (shadow book)`, backtest: bt.length ? 'engine 150-day replay Jun–Nov 2026' : 'none', oosFrom: null,
      rows: bt.concat(liveRows(ctx.trades, ctx, (t) => t.shadow && t.k === k && t.status !== 'duplicate')),
      stamped: ctx.trades.filter((t) => t.shadow && t.k === k && DONE.has(t.status) && !t.void && Number.isFinite(t.costR)).map((t) => t.costR) };
  }
  return S;
}

const avg = (a) => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(3) : null;
const yearsOf = (rows) => { const y = {}; for (const r of rows) { const k = new Date(r.t * 1000).getUTCFullYear(); (y[k] = y[k] || []).push(r.R - r.cost); } return Object.fromEntries(Object.entries(y).map(([k, a]) => [k, stats(a)])); };

export function analyse(ctx) {
  const S = streams(ctx), out = {};
  for (const [id, s] of Object.entries(S)) {
    const all = s.rows, j = judge(all, { oosFrom: s.oosFrom }), g = all.filter((r) => r.cost <= GATE), jg = judge(g, { oosFrom: s.oosFrom, gated: true });
    const by = {}; for (const r of all) (by[r.market] = by[r.market] || []).push(r.cost);
    out[id] = { name: s.name, backtest: s.backtest, reference: !!s.reference, oosRule: s.oosFrom ? 'backtest from 2020-01-01 + live paper' : 'live paper only',
      ...j, parts: { spread: avg(all.map((r) => r.spreadR)), comm: avg(all.map((r) => r.commR)), slip: avg(all.map((r) => r.slipR)) },
      costByMarket: Object.fromEntries(Object.entries(by).map(([m, a]) => [m, { n: a.length, mean: avg(a) }])),
      stampedCouncilCost: s.stamped && s.stamped.length ? avg(s.stamped) : undefined,
      shareUnderGate: all.length ? +(g.length / all.length).toFixed(3) : null,
      years: s.oosFrom ? Object.fromEntries(Object.entries(yearsOf(all.filter((r) => r.t >= s.oosFrom && !r.live))).map(([k, v]) => [k, v])) : undefined,
      gated: { n: g.length, ...pickJ(jg) },
      // post-hoc diagnostics (not part of any bar): IS / OOS by asset group, gross and net
      diag: { byGroup: Object.fromEntries(['is', 'oos'].map((side) => [side, groupSplit(all.filter((r) => isOosRow(r, s.oosFrom) === (side === 'oos')))])),
        gatedByGroup: Object.fromEntries(['is', 'oos'].map((side) => [side, groupSplit(g.filter((r) => isOosRow(r, s.oosFrom) === (side === 'oos')))])) } };
    if (out[id].reference) { out[id].verdict = 'REFERENCE'; out[id].survives = undefined; }
  }
  // NQ: the open-run rule was built on 2023–26 (research/edge/nq-open-oos `periods.built`), so split its OOS at 2023 (post-hoc)
  const nq = S['nq-trend'].rows.filter((r) => r.t >= OOS_FROM), y23 = Date.UTC(2023, 0, 1) / 1000;
  out['nq-trend'].diag.oos2020to22 = stats(nq.filter((r) => r.t < y23).map((r) => r.R - r.cost));
  out['nq-trend'].diag.oos2023on = stats(nq.filter((r) => r.t >= y23).map((r) => r.R - r.cost));
  return out;
}
const isOosRow = (r, oosFrom) => r.live || (oosFrom != null && r.t >= oosFrom);
function groupSplit(rows) {
  const by = {}; for (const r of rows) (by[groupOf(r.market)] = by[groupOf(r.market)] || []).push(r);
  return Object.fromEntries(Object.entries(by).map(([g, a]) => [g, { n: a.length, cost: avg(a.map((r) => r.cost)), gross: avg(a.map((r) => r.R)), net: stats(a.map((r) => r.R - r.cost)) }]));
}
const pickJ = (j) => ({ verdict: j.verdict, why: j.why, survives: j.survives, cost: j.cost, is: j.is, oos: j.oos, oosX2: j.oosX2, halves: j.halves, live: j.live });

export function build(cdir) {
  const ctx = load(cdir), S = analyse(ctx), ids = Object.keys(S).filter((k) => !S[k].reference);
  const surv = ids.filter((k) => S[k].survives), pass = ids.filter((k) => S[k].verdict === 'PASS');
  const passGated = ids.filter((k) => S[k].gated.verdict === 'PASS'), costOk = ids.filter((k) => S[k].costOk);
  const res = {
    topic: 'shadow-cost', built: '2026-11-09', at: new Date().toISOString(),
    system: 'Every paper shadow stream (NQ trend-on, LIT, ICT variants + dip-buy + silver, council engine setups) re-costed at realistic spread + commission + slippage; council-data ' + (ctx.at || ''),
    question: 'Which shadow streams cost at most 0.10R a trade and keep a positive net expectancy out of sample? (proposal 3, research/proposals/2026-11-09-council-edge.md)',
    verdict: { verdict: pass.length ? 'PASS' : ids.some((k) => S[k].verdict === 'INCONCLUSIVE') ? 'INCONCLUSIVE' : 'FAIL', pass, passGated, costOk, survivesProposal3: surv },
    gate: GATE, oosFrom: '2020-01-01',
    costInputs: { broker: ctx.broker, brokerAt: ctx.at, mirror: { n: ctx.mirror.n, medianLagSec: ctx.mirror.medianLagSec, meanSlipR: ctx.mirror.meanSlipR, groups: ctx.mirror.groups, used: ctx.mirror.mult, fills: ctx.mirror.rows } },
    variantsTried: ids.length * 2,
    candidates: Object.entries(S).map(([id, s]) => ({ rule: `${id}: ${s.name}`, verdict: s.verdict, is: s.is, oos: s.oos, years: s.years })),
    streams: S,
    notes: [
      'Cost = spread + commission + slippage per round trip, in R of the initial risk (costmodel.mjs). x2 = twice that.',
      'IS/OOS: streams with a pre-2020 backtest (nq-trend, lit) use 2020-01-01 onward + live paper as OOS; the others (ICT, engine) have only design-window backtests, so OOS = live paper.',
      'Verdict bar in preregistration.md; "survives" = cost <= 0.10R and net OOS expectancy > 0 as point estimates.',
    ],
  };
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cdir = process.argv[2]; if (!cdir) { console.error('usage: node run.mjs <council-data dir> [--out file]'); process.exit(2); }
  const oi = process.argv.indexOf('--out'), out = oi > 0 ? process.argv[oi + 1] : path.join(HERE, 'result.json');
  const res = build(cdir);
  fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
  for (const [id, s] of Object.entries(res.streams)) console.log(id.padEnd(13), s.verdict.padEnd(12), 'cost', s.cost.mean, 'oos', JSON.stringify(s.oos), 'gated', s.gated.verdict, s.gated.oos.n, s.gated.oos.exp);
}
