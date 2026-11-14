// Edge research · commodity-cycle: the owner's market cycle ("bullish on H4 and the pullback finished: buys only, and vice versa")
// as an ENTRY on six commodity CFDs (silver, platinum, palladium, copper, WTI, Brent; gold excluded, owner item 44). Every rule
// step is frozen.mjs's (research/edge/crypto-cycle/run.mjs of branch crypto-cycle, byte for byte, never edited); this file adds
// only step 6's skip window (fx-cycle's, copied), the commodity costs and the windows of PREREGISTRATION.md. Paper research only.
//   node --use-env-proxy research/edge/commodity-cycle/fetch.mjs <dir>   (OANDA H1 candles, kept out of git)
//   node research/edge/commodity-cycle/run.mjs gate <cryptoDir>          (frozen study() on crypto-cycle's data = its result.json)
//   node research/edge/commodity-cycle/run.mjs <dir>                     (writes result.json and RESULT.md beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, spotClosed } from '../../../council/fills.mjs';
import * as F from './frozen.mjs';

const { K } = F;
export const MARKETS = ['xag', 'xpt', 'xpd', 'xcu', 'wtico', 'bco'];
export const EXTRA = ['natgas'];                       // reported only, never pooled
export const SPREAD = { xag: 0.0005, xpt: 0.0015, xpd: 0.0025, xcu: 0.0010, wtico: 0.0005, bco: 0.0005, natgas: 0.0015 };
export const COST_RT = Object.fromEntries(Object.entries(SPREAD).map(([m, s]) => [m, 2 * s]));
export const FIN = { long: 0.00015, short: 0 };
export const WINDOWS = { decisive: { from: F.T('2016-01-01'), to: Infinity }, replication: { from: F.T('2007-01-01'), to: F.T('2016-01-01') } };
export const MIN_MARKETS = 4, MIN_TRADES = 100;

// step 6's skip window (fx-cycle's, copied): the rollover hours 21:00-22:59 UTC and the weekend (Fri 17:00 - Sun 17:00 New York)
export function skipEntry(t) { const h = new Date(t * 1000).getUTCHours(); return h === 21 || h === 22 || spotClosed(t); }
// steps 6-9: the window first (as fx-cycle's plan), then the frozen plan unchanged
export function plan(H1, s, exit) {
  const k = s.fin + 1;
  if (k < H1.length && H1[k].time - s.sigT <= K.MAX_WAIT && skipEntry(H1[k].time)) return { skip: 'window' };
  return F.plan(H1, s, exit);
}
// costs in R: round trip = 2 x the assumed spread of the entry price; financing on longs, fills.mjs nights
export function costR(m, p, x, mult = 1) {
  const fin = (p.dir > 0 ? FIN.long : FIN.short) * nights(p.t, x.t) * p.entry;
  return mult * (COST_RT[m] * p.entry + fin) / p.r0;
}
// the frozen trade / runMarket / placebo, with this study's costR and plan (their code shape kept)
export function trade(m, H1, p) {
  const x = F.simulate(H1, p);
  if (!x) return { m, ...p, open: true };
  const gross = p.dir * (x.px - p.entry) / p.r0, c = costR(m, p, x), c2 = costR(m, p, x, 2);
  return { m, t: p.t, exitT: x.t, dir: p.dir, entry: p.entry, stop: p.stop, target: p.target, r0: p.r0, rm: p.rm, why: x.why, n: x.n,
    nights: nights(p.t, x.t), gross, net: gross - c, net2: gross - c2, cost: c };
}
export function runMarket(m, H1, exit) {
  const H4 = F.toH4(H1), sig = F.cycles(H1, H4), trades = [], skips = {};
  let busy = -Infinity;
  for (const s of sig) {
    const p = plan(H1, s, exit);
    if (p.skip) { skips[p.skip] = (skips[p.skip] || 0) + 1; continue; }
    if (p.t < busy) { skips.busy = (skips.busy || 0) + 1; continue; }
    const tr = trade(m, H1, p);
    trades.push(tr);
    busy = tr.open ? Infinity : tr.exitT;
  }
  return { signals: sig.length, trades, skips };
}
export function placebo(data, real, exit, seeds = K.SEEDS) {
  const pools = {};
  for (const m of new Set(real.map((x) => x.m))) {
    const H1 = data[m], bias = F.biasAtOpen(H1, F.toH4(H1)), P = { 1: [], '-1': [] };
    for (let i = 1; i + K.HOLD - 1 < H1.length; i++) if (H1[i].time >= WINDOWS.decisive.from && bias[i] && !skipEntry(H1[i].time)) P[bias[i]].push(i);
    pools[m] = P;
  }
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const R = F.rng(s), nets = [];
    for (const x of real) {
      const pool = pools[x.m][x.dir], k = pool[Math.floor(R() * pool.length)], H1 = data[x.m], entry = H1[k].open;
      const p = { k, t: H1[k].time, dir: x.dir, entry, r0: x.r0, stop: entry - x.dir * x.r0, rm: exit === 'A' ? x.rm : K.FIXED_R };
      p.target = entry + x.dir * p.rm * x.r0;
      const tr = trade(x.m, H1, p);
      if (!tr.open) nets.push(tr.net);
    }
    out.push(F.mean(nets));
  }
  const real0 = F.mean(real.map((x) => x.net));
  return { seeds: out.map(r4), p5: r4(F.pct(out, 0.05)), median: r4(F.pct(out, 0.5)), p95: r4(F.pct(out, 0.95)), best: r4(Math.max(...out)), better: out.filter((v) => v > real0).length };
}

const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const inWin = (w) => (x) => !x.open && x.exitT >= w.from && x.exitT < w.to;
const sumR = (a) => r2(a.reduce((s, v) => s + v, 0));

export function fromRows(rows) { return rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })); }
export function load(dir, m) {
  const f = path.join(dir, `${m}-1h.json.gz`);
  return fs.existsSync(f) ? fromRows(JSON.parse(zlib.gunzipSync(fs.readFileSync(f)))) : null;
}

export function study(data, extra = {}) {
  const markets = Object.keys(data);
  const last = Math.max(...Object.values(data).map((B) => B.at(-1).time + K.H1));
  const W = { decisive: { ...WINDOWS.decisive, to: last }, replication: WINDOWS.replication };
  const sum = (a, w) => F.summary(a, w.from, w.to - 1);
  const res = { exits: {}, extra: {} }, mPs = [], mKeys = [];
  for (const exit of ['A', 'B']) {
    const all = [], info = {};
    for (const m of markets) { const r = runMarket(m, data[m], exit); all.push(...r.trades); info[m] = { signals: r.signals, skips: r.skips, open: r.trades.filter((x) => x.open).length }; }
    const D = all.filter(inWin(W.decisive)), Rp = all.filter(inWin(W.replication));
    const byM = {}, byWhy = {}, byYear = {};
    for (const m of markets) {
      const f = (x) => x.m === m, d = D.filter(f);
      byM[m] = { decisive: sum(d, W.decisive), replication: sum(Rp.filter(f), W.replication), ...info[m],
        costs: { gross: r4(F.mean(d.map((x) => x.gross))), base: r4(F.mean(d.map((x) => x.net))), x2: r4(F.mean(d.map((x) => x.net2))) },
        meanCostR: r4(F.mean(d.map((x) => x.cost))), meanR0Pct: r4(F.mean(d.map((x) => 100 * x.r0 / x.entry))) };
      mPs.push(byM[m].decisive.p); mKeys.push([exit, m]);
    }
    for (const w of ['target', 'stop', 'gap', 'time']) { const a = D.filter((x) => x.why === w); byWhy[w] = { n: a.length, meanNet: r4(F.mean(a.map((x) => x.net))), meanGross: r4(F.mean(a.map((x) => x.gross))) }; }
    for (const s of [1, -1]) { const a = D.filter((x) => x.dir === s); byWhy[s > 0 ? 'buys' : 'sells'] = { n: a.length, meanNet: r4(F.mean(a.map((x) => x.net))), meanGross: r4(F.mean(a.map((x) => x.gross))) }; }
    for (const x of D) { const y = new Date(x.exitT * 1000).getUTCFullYear(); (byYear[y] ||= []).push(x.net); }
    res.exits[exit] = {
      decisive: sum(D, W.decisive), replication: sum(Rp, W.replication), byMarket: byM, byExit: byWhy,
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { n: a.length, meanNet: r4(F.mean(a)), netR: sumR(a) }])),
      meanCostR: r4(F.mean(D.map((x) => x.cost))), winRate: r4(D.filter((x) => x.gross > 0).length / D.length),
      placebo: placebo(data, D, exit),
    };
    for (const [m, H1] of Object.entries(extra)) {
      const r = runMarket(m, H1, exit), d = r.trades.filter(inWin(W.decisive));
      (res.extra[m] ||= {})[exit] = { signals: r.signals, decisive: sum(d, W.decisive), replication: sum(r.trades.filter(inWin(W.replication)), W.replication),
        costs: { gross: r4(F.mean(d.map((x) => x.gross))), base: r4(F.mean(d.map((x) => x.net))), x2: r4(F.mean(d.map((x) => x.net2))) } };
    }
  }
  const mAdj = F.holm(mPs);
  mKeys.forEach(([e, m], i) => { res.exits[e].byMarket[m].holmP12 = r4(mAdj[i]); });
  const ps = ['A', 'B'].map((e) => res.exits[e].decisive.p), adj = F.holm(ps);
  ['A', 'B'].forEach((e, i) => {
    const x = res.exits[e]; x.holmP = r4(adj[i]);
    x.lines = { meanPositive: x.decisive.meanNet > 0, tMonth2: x.decisive.tMonth >= 2, holm05: adj[i] < 0.05, replicationPositive: x.replication.meanNet > 0, abovePlacebo: x.decisive.meanNet > x.placebo.p95 };
    x.pass = Object.values(x.lines).every(Boolean);
  });
  const measurable = markets.length >= MIN_MARKETS && res.exits.A.decisive.n >= MIN_TRADES && res.exits.B.decisive.n >= MIN_TRADES;
  res.verdict = !measurable ? 'NOT MEASURABLE' : res.exits.A.pass || res.exits.B.pass ? 'PASS' : 'FAIL';
  res.data = Object.fromEntries(Object.entries({ ...data, ...extra }).map(([m, B]) => [m, { candles: B.length, from: new Date(B[0].time * 1000).toISOString().slice(0, 16), to: new Date(B.at(-1).time * 1000).toISOString().slice(0, 16) }]));
  res.windows = { decisive: { from: '2016-01-01', to: new Date(last * 1000).toISOString().slice(0, 16) }, replication: { from: '2007-01-01', to: '2015-12-31' } };
  res.params = { K, spread: SPREAD, costRT: COST_RT, financing: FIN, frozen: 'research/edge/crypto-cycle/run.mjs @ crypto-cycle 0ac837fc0' };
  return res;
}

const f3 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const ft = (v) => (v == null ? 'n/a' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
const yes = (b) => (b ? 'yes' : 'no');
const fp = (v) => (v == null ? 'n/a' : v < 0.0001 ? '< 0.0001' : String(v));
export const NAME = { xag: 'Silver', xpt: 'Platinum', xpd: 'Palladium', xcu: 'Copper', wtico: 'WTI crude', bco: 'Brent crude', natgas: 'Natural gas' };
export function report(r, gate) {
  const L = [], A = r.exits.A, B = r.exits.B, end = r.windows.decisive.to.slice(0, 4);
  L.push('# The owner\'s market cycle as an entry on commodity CFDs (gold excluded): result', '');
  L.push(`**Verdict: ${r.verdict}.** ${r.verdict === 'PASS' ? 'At least one exit passed every pre-registered line.' : r.verdict === 'FAIL' ? 'Neither exit passed every pre-registered line.' : 'Too little data for the pre-registered test.'}`
    + ` Exit A (target the H4 move's extreme): ${f3(A.decisive.meanNet)}R a trade net on 2016-${end} (n ${A.decisive.n}, monthly t ${ft(A.decisive.tMonth)}).`
    + ` Exit B (fixed 2R): ${f3(B.decisive.meanNet)}R (n ${B.decisive.n}, monthly t ${ft(B.decisive.tMonth)}). Six markets pooled: silver, platinum,`
    + ' palladium, copper, WTI and Brent crude (OANDA mid H1).', '');
  L.push('Pre-registration: `PREREGISTRATION.md` (pushed first). The rule is `frozen.mjs` = `research/edge/crypto-cycle/run.mjs` of branch',
    '`crypto-cycle` byte for byte (sha256 pinned in `tests/commodity-cycle.test.mjs`); this study adds only fx-cycle\'s skip window, the',
    'commodity costs (assumed spreads, not measured) and the windows. Paper research only: nothing live changed. Never call this rule an edge',
    'on commodities. Gold is not in this study (owner item 44).', '');
  L.push('## Gate', '', gate
    ? `The frozen file's own \`study()\` on crypto-cycle's own candles (council-data \`research/candles/crypto5m\`) reproduces crypto-cycle's published \`result.json\` ${gate.equal ? '**exactly, every field**' : '**NOT exactly**'}: Exit A n ${gate.A.n}, net R ${f3(gate.A.netR)}, monthly t ${ft(gate.A.tMonth)}; Exit B n ${gate.B.n}, net R ${f3(gate.B.netR)}, monthly t ${ft(gate.B.tMonth)}.`
    : 'Not run in this invocation.', '');
  L.push('## Pass bar', '', '| Line | Exit A | Exit B |', '|---|---|---|');
  const row = (name, k) => L.push(`| ${name} | ${yes(A.lines[k])} | ${yes(B.lines[k])} |`);
  row('Decisive mean net R > 0', 'meanPositive'); row('Monthly t >= 2', 'tMonth2'); row('Holm p < 0.05 (2 exits)', 'holm05'); row('Replication 2007-2015 mean net R > 0', 'replicationPositive'); row('Above the placebo 95th percentile', 'abovePlacebo');
  L.push(`| **Exit passes** | **${yes(A.pass)}** | **${yes(B.pass)}** |`, '');
  if ((A.lines.holm05 && A.decisive.meanNet <= 0) || (B.lines.holm05 && B.decisive.meanNet <= 0))
    L.push('The p is two-sided, as pre-registered: where the Holm line reads "yes" with a negative mean, the result is significant in the losing direction.', '');
  L.push('## Pooled results (six markets, net of costs and financing)', '', '| Exit | Window | n | Net R | Mean net R | Mean gross R | Mean net R at 2x cost | t (trades) | Months | t (monthly) | p | Holm p |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) {
    L.push(`| ${e} | 2016-now (decisive) | ${x.decisive.n} | ${f3(x.decisive.netR)} | ${f3(x.decisive.meanNet)} | ${f3(x.decisive.meanGross)} | ${f3(x.decisive.meanNet2)} | ${ft(x.decisive.tTrade)} | ${x.decisive.months} | ${ft(x.decisive.tMonth)} | ${fp(x.decisive.p)} | ${fp(x.holmP)} |`);
    L.push(`| ${e} | 2007-2015 (replication) | ${x.replication.n} | ${f3(x.replication.netR)} | ${f3(x.replication.meanNet)} | ${f3(x.replication.meanGross)} | ${f3(x.replication.meanNet2)} | ${ft(x.replication.tTrade)} | ${x.replication.months} | ${ft(x.replication.tMonth)} | ${fp(x.replication.p)} | |`);
  }
  const g0 = [A, B].every((x) => x.decisive.meanGross <= 0);
  L.push('', `Before any cost (the 0-cost line), the decisive pooled mean is ${f3(A.decisive.meanGross)}R (Exit A) and ${f3(B.decisive.meanGross)}R (Exit B)`
    + (g0 ? ': the rule loses before costs too, so the verdict does not rest on the assumed spreads.' : ': the assumed spreads matter for the verdict; read the per-market 0 / base / 2x columns.'));
  L.push('', `Win rate before costs (decisive): Exit A ${(100 * A.winRate).toFixed(1)} %, Exit B ${(100 * B.winRate).toFixed(1)} %. Mean cost a trade: Exit A ${f3(A.meanCostR)}R, Exit B ${f3(B.meanCostR)}R.`);
  L.push('', '## Placebo: random entries with the H4 bias, same market, side, stop distance and target in R (40 seeds)', '', '| Exit | Rule, decisive mean net R | Placebo 5th pct | Placebo median | Placebo 95th pct | Placebo best | Seeds better than the rule |', '|---|---|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) L.push(`| ${e} | ${f3(x.decisive.meanNet)} | ${f3(x.placebo.p5)} | ${f3(x.placebo.median)} | ${f3(x.placebo.p95)} | ${f3(x.placebo.best)} | ${x.placebo.better} of ${x.placebo.seeds.length} |`);
  L.push('', `Read: the entry after "the pullback finished" did ${A.decisive.meanNet < A.placebo.median ? 'worse' : 'better'} than the median random entry with the same H4 bias for Exit A`
    + ` and ${B.decisive.meanNet < B.placebo.median ? 'worse' : 'better'} for Exit B.`);
  L.push('', '## Per market, decisive 2016-now (reported, never decisive; Holm over the 12 market x exit tests at base cost)', '',
    '| Exit | Market | Signals (all years) | n | Mean R, no cost | Mean net R, base | Mean net R, 2x cost | t (monthly) | Holm p (12) | Replication n / net R | Mean stop (% of price) | Mean cost (R) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) for (const [m, v] of Object.entries(x.byMarket))
    L.push(`| ${e} | ${NAME[m]} | ${v.signals} | ${v.decisive.n} | ${f3(v.costs.gross)} | ${f3(v.costs.base)} | ${f3(v.costs.x2)} | ${ft(v.decisive.tMonth)} | ${fp(v.holmP12)} | ${v.replication.n} / ${f3(v.replication.meanNet)} | ${v.meanR0Pct} | ${f3(v.meanCostR)} |`);
  for (const [m, ex] of Object.entries(r.extra)) {
    L.push('', `**${NAME[m]} (reported only, not pooled, not in any Holm family):** ` + ['A', 'B'].map((e) => `Exit ${e} n ${ex[e].decisive.n}, mean R no cost ${f3(ex[e].costs.gross)} / base ${f3(ex[e].costs.base)} / 2x ${f3(ex[e].costs.x2)}, monthly t ${ft(ex[e].decisive.tMonth)}; replication n ${ex[e].replication.n} / ${f3(ex[e].replication.meanNet)}`).join('. ') + '.');
  }
  L.push('', '## By exit reason and side, decisive window', '', '| Exit | Group | n | Mean gross R | Mean net R |', '|---|---|---|---|---|');
  for (const [e, x] of [['A', A], ['B', B]]) for (const [w, v] of Object.entries(x.byExit)) L.push(`| ${e} | ${w} | ${v.n} | ${f3(v.meanGross)} | ${f3(v.meanNet)} |`);
  L.push('', '## By year of exit, decisive window (mean net R, n)', '', '| Year | Exit A | Exit B |', '|---|---|---|');
  for (const y of Object.keys(B.byYear)) L.push(`| ${y} | ${A.byYear[y] ? f3(A.byYear[y].meanNet) + ' (' + A.byYear[y].n + ')' : 'n/a'} | ${f3(B.byYear[y].meanNet)} (${B.byYear[y].n}) |`);
  L.push('', '## Costs (assumptions, not measurements)', '', 'Round trip = 2 x an assumed typical spread, as a fraction of the entry price: '
    + Object.entries(COST_RT).map(([m, v]) => `${NAME[m]} ${(100 * v).toFixed(2)} %`).join(', ')
    + '. Financing: long 0.00015 of the entry price a rollover (`council/fills.mjs` `nights`: Monday-Friday 22:00 UTC, Wednesday three), short 0. No broker measurement of these markets exists; the 2x line is in the tables.', '');
  L.push('## Data', '', 'OANDA mid H1 candles through the site\'s candle proxy (`node --use-env-proxy research/edge/commodity-cycle/fetch.mjs <dir>`, kept out of git),',
    'then `node research/edge/commodity-cycle/run.mjs <dir>`. Candles:', '');
  for (const [m, v] of Object.entries(r.data)) L.push(`- ${NAME[m]}: ${v.candles} H1 candles, ${v.from} to ${v.to} UTC`);
  L.push('', '## What follows', '', r.verdict === 'PASS'
    ? 'A PASS is a proposal to the owner at most, unreplicated outside these markets; never a live rule without the owner (absolute rule 3).'
    : 'A FAIL ends this reading on commodities: no parameter will be varied after seeing the result (pre-registered). With index-cycle, fx-cycle, crypto-cycle and cycle-gate-study, the cycle entry / gate has now failed on every market group tested. Not a council rule, not a filter; nothing live changed.', '');
  return L.join('\n');
}

// the gate: the frozen file's study() on crypto-cycle's own candles must equal crypto-cycle's published result.json
export function gate(cryptoDir) {
  const data = Object.fromEntries(F.MARKETS.map((m) => [m, F.load(cryptoDir, m)]));
  const r = F.study(data);
  const pub = JSON.parse(execFileSync('git', ['show', 'origin/crypto-cycle:research/edge/crypto-cycle/result.json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const pick = (x) => ({ n: x.decisive.n, netR: x.decisive.netR, tMonth: x.decisive.tMonth });
  return { equal: JSON.stringify(r) === JSON.stringify(pub), A: pick(r.exits.A), B: pick(r.exits.B), published: { A: pick(pub.exits.A), B: pick(pub.exits.B) } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (process.argv[2] === 'gate') {
    const g = gate(process.argv[3]);
    fs.writeFileSync(path.join(here, 'gate.json'), JSON.stringify(g, null, 1) + '\n');
    console.log(JSON.stringify(g));
    if (!g.equal) process.exit(1);
  } else {
    const dir = process.argv[2];
    if (!dir) throw new Error('usage: node run.mjs <candleDir> | gate <cryptoDir>');
    const data = {}, extra = {};
    for (const m of MARKETS) { const B = load(dir, m); if (B) data[m] = B; }
    for (const m of EXTRA) { const B = load(dir, m); if (B) extra[m] = B; }
    const gf = path.join(here, 'gate.json'), g = fs.existsSync(gf) ? JSON.parse(fs.readFileSync(gf, 'utf8')) : null;
    const res = study(data, extra);
    res.gate = g;
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(here, 'RESULT.md'), report(res, g));
    console.log(res.verdict, JSON.stringify({ A: res.exits.A.decisive, B: res.exits.B.decisive }));
  }
}
