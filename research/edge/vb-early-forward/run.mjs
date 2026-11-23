// Edge research · vb-early-forward: the forward records of gold T1 (gold-vol-breakout-forward) and USD/JPY T1
// (usdjpy-vol-breakout-forward) split by fill hour, early (fill candle before 06:00 UTC) against late, on days from 2026-11-24
// (PREREGISTRATION.md, pushed alone first). Paper research only: nothing trades, nothing live reads it.
//   node research/edge/vb-early-forward/run.mjs baseline <gold candle dir> <usdjpy candle dir>   (once: baseline.json)
//   node research/edge/vb-early-forward/run.mjs run <gold candle dir> <usdjpy candle dir> [out.json]
// Candle files: <gold dir>/xau-5m.json.gz and <usdjpy dir>/usdjpy-5m.json.gz (OANDA mid M5, rows [t,o,h,l,c]).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { rng, quantile, monthT } from '../index-vol-breakout/original.mjs';
import { tradesIn, daysOf as goldDaysOf, WINDOWS } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge as goldCharge } from '../gold-vol-breakout-hourcost/run.mjs';
import * as G from '../gold-vol-breakout-forward/run.mjs';
import * as U from '../usdjpy-vol-breakout-forward/run.mjs';
import { trades as ujTrades } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = '2026-11-24', CUT_MIN = 360, MIN_SIDE = 40, CHECKS = [120, 240], DRAWS = 20000, SEED = 20261120;
export const GATES = { xau: { n: 1121, netR: 0.105, to: '2026-11-12' }, usdjpy: { n: 2079, netR: 0.063, from: '2016-01-01', to: '2026-11-19' } };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const varS = (a) => { const m = mean(a); return a.length > 1 ? a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1) : NaN; };

// early = the fill candle starts before 06:00 UTC of the trade's day (fillMin < 360)
export const isEarly = (x) => Number.isFinite(x.fillMin) && x.fillMin < CUT_MIN;
export function welch(a, b) {
  const d = mean(a) - mean(b), se = Math.sqrt(varS(a) / a.length + varS(b) / b.length);
  return { d, t: Number.isFinite(se) && se > 0 ? d / se : NaN };
}

// the forward trades of both markets, days from START only, with their fill minute
export function goldForward(days, cost) {
  return G.forwardTrades(days.filter((d) => d.day >= START), START, cost).filter((x) => x.day >= START)
    .map((x) => ({ mk: 'xau', day: x.day, side: x.side, how: x.how, fillMin: x.fillMin, entry: x.entry, R: x.R, net: x.net }));
}
export function usdjpyForward(days) {
  return ujTrades('usdjpy', days.filter((d) => d.day >= START))
    .map((x) => ({ mk: 'usdjpy', day: x.day, side: x.side > 0 ? 'buy' : 'sell', how: x.how, fillMin: x.fillMin, entry: x.entry, R: r3(x.R), net: r3(x.net) }));
}

// baseline rows [day, fillMin, net, market]; months = calendar months of both markets pooled
export function monthsOf(rows) {
  const m = new Map();
  for (const [day, fillMin, net] of rows) { const k = day.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push({ fillMin, net }); }
  return [...m.keys()].sort().map((k) => m.get(k));
}
export function measuredD(rows) {
  const e = rows.filter((r) => r[1] < CUT_MIN).map((r) => r[2]), l = rows.filter((r) => r[1] >= CUT_MIN).map((r) => r[2]);
  return mean(e) - mean(l);
}
// month-block bootstrap of D at (ne, nl); world B shifts every early trade by -shift (the measured D)
export function bands(months, ne, nl, { draws = DRAWS, seed = SEED, shift = 0 } = {}) {
  if (!(ne > 0) || !(nl > 0)) return { p5: null, p50: null, p95: null };
  const rnd = rng(seed), D = new Float64Array(draws);
  for (let d = 0; d < draws; d++) {
    let se = 0, sl = 0, ce = 0, cl = 0, guard = 0;
    while ((ce < ne || cl < nl) && guard++ < 1e6) {
      const m = months[Math.floor(rnd() * months.length)];
      for (const x of m) {
        if (x.fillMin < CUT_MIN) { if (ce < ne) { se += x.net - shift; ce++; } }
        else if (cl < nl) { sl += x.net; cl++; }
      }
    }
    D[d] = se / ne - sl / nl;
  }
  const v = [...D];
  return { p5: r3(quantile(v, 0.05)), p50: r3(quantile(v, 0.5)), p95: r3(quantile(v, 0.95)) };
}
export function reading(ne, nl, D, A, B) {
  if (ne < MIN_SIDE || nl < MIN_SIDE) return 'too few';
  if (D < A.p5) return 'below the measured range';
  if (D > B.p95) return 'ahead of no difference';
  return 'undecided';
}
export function checkAt(c, D, A, B, t, earlyMean) {
  if (c === CHECKS[1]) return D < A.p5 ? 'fails' : (D > B.p95 && t >= 2 && earlyMean > 0 ? 'confirmed' : 'not shown either way');
  return D < A.p5 ? 'fails' : 'holds so far';
}
const side = (a) => ({ n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), total: r2(a.reduce((s, x) => s + x.net, 0)), monthT: a.length > 1 ? r2(monthT(a).t) : null });
const pair = (a) => ({ early: side(a.filter(isEarly)), late: side(a.filter((x) => !isEarly(x))) });

export function build(tr, base, dataEnd, prev) {
  tr = tr.filter((x) => x.day >= START);
  const E = tr.filter(isEarly), L = tr.filter((x) => !isEarly(x)), ne = E.length, nl = L.length;
  const w = ne > 1 && nl > 1 ? welch(E.map((x) => x.net), L.map((x) => x.net)) : { d: ne && nl ? mean(E.map((x) => x.net)) - mean(L.map((x) => x.net)) : NaN, t: NaN };
  const months = monthsOf(base.rows), A = bands(months, ne, nl), B = bands(months, ne, nl, { shift: base.D });
  const D = w.d, earlyMean = mean(E.map((x) => x.net)), read = reading(ne, nl, D, A, B);
  const crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (ne >= c && nl >= c && !crossed[c]) crossed[c] = { at: dataEnd, ne, nl, D: r3(D), t: r2(w.t), reading: checkAt(c, D, A, B, w.t, earlyMean) };
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]];
  const tail = `forward split from ${START}: ${read}, early n ${ne}, late n ${nl}, D ${Number.isFinite(D) ? (D >= 0 ? '+' : '') + r3(D) : '—'}R`;
  const verdict = last && last.reading === 'fails' ? `FAIL (${tail})` : last && last.reading === 'confirmed' ? `PASS (${tail})` : `INCONCLUSIVE so far (${tail})`;
  const hours = { '00-03': side(E.filter((x) => x.fillMin < 180)), '03-06': side(E.filter((x) => x.fillMin >= 180)) };
  const bySide = Object.fromEntries(['buy', 'sell'].map((s) => [s, pair(tr.filter((x) => x.side === s))]));
  return { study: 'vb-early-forward', start: START, dataEnd, D: r3(D), t: r2(w.t), early: side(E), late: side(L),
    markets: { xau: pair(tr.filter((x) => x.mk === 'xau')), usdjpy: pair(tr.filter((x) => x.mk === 'usdjpy')) },
    earlyByHour: hours, bySide, bands: { A, B }, measuredD: base.D, reading: read, crossed, verdict, trades: tr };
}

const fmt = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const row = (name, s) => `| ${name} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${fmt(s.total, 2)} | ${fmt(s.monthT, 2)} |`;
  return [`# The breakout's early fills against its late fills: the forward split (from ${R.start})`, '',
    'Paper research only: nothing is traded, alerted or copied. Trades, split, expected range and readings were fixed in `PREREGISTRATION.md` before any trade of the window was computed. Written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `Candles through ${R.dataEnd || '—'}. D = early mean − late mean, net of each market's frozen cost: ${fmt(R.D)}R (Welch t ${fmt(R.t, 2)}).`, '',
    '| | n | Net R/trade | Gross R/trade | Total R | Month t |', '|---|---|---|---|---|---|',
    row('Early (both)', R.early), row('Late (both)', R.late), row('Gold early', R.markets.xau.early), row('Gold late', R.markets.xau.late),
    row('USD/JPY early', R.markets.usdjpy.early), row('USD/JPY late', R.markets.usdjpy.late),
    row('Early 00-03 UTC', R.earlyByHour['00-03']), row('Early 03-06 UTC', R.earlyByHour['03-06']),
    row('Buys early', R.bySide.buy.early), row('Buys late', R.bySide.buy.late), row('Sells early', R.bySide.sell.early), row('Sells late', R.bySide.sell.late), '',
    '| D at this record\'s counts | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured (D ${fmt(R.measuredD)}R on the discovery trades) | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`,
    `| B, no difference | — | — | ${fmt(R.bands.B.p95)} |`, '',
    `Too few while either side has under ${MIN_SIDE} trades; checkpoints when both sides reach ${CHECKS[0]} and ${CHECKS[1]}. The first crossing stands.`, '',
    '| Day | Market | Side | Fill (UTC min) | Early | Exit | R before costs | R after |', '|---|---|---|---|---|---|---|---|',
    ...R.trades.map((x) => `| ${x.day} | ${x.mk} | ${x.side} | ${x.fillMin} | ${isEarly(x) ? 'yes' : 'no'} | ${x.how} | ${fmt(x.R)} | ${fmt(x.net)} |`), ''].join('\n');
}

const load = (dir, f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))));

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  G.checkCopies(); U.checkCopy();
  const [cmd, gdir, udir, out] = process.argv.slice(2);
  if (!gdir || !udir || !['baseline', 'run'].includes(cmd)) { console.log('usage: run.mjs baseline|run <gold candle dir> <usdjpy candle dir> [out.json]'); process.exit(1); }
  const cost = G.frozenCost();
  const gd = goldDaysOf(load(gdir, 'xau-5m.json.gz')), ud = U.daysOf(load(udir, 'usdjpy-5m.json.gz'));
  if (cmd === 'baseline') {
    const gt = tradesIn(gd.days, WINDOWS.W4).tr.filter((x) => x.day <= GATES.xau.to), gn = goldCharge(gt, cost.profile, 'frac', cost.commission, G.SLIP);
    const gRows = gt.map((x, i) => [x.day, x.fillMin, r3(gn[i].net), 'xau']);
    const ut = ujTrades('usdjpy', ud.days.filter((d) => d.day >= GATES.usdjpy.from && d.day <= GATES.usdjpy.to));
    const uRows = ut.map((x) => [x.day, x.fillMin, r3(x.net), 'usdjpy']);
    // gates against the two forward studies' baselines (n, mean net R)
    for (const [mk, rows, file] of [['xau', gRows, '../gold-vol-breakout-forward/baseline.json'], ['usdjpy', uRows, '../usdjpy-vol-breakout-forward/baseline.json']]) {
      const want = JSON.parse(fs.readFileSync(path.join(HERE, file), 'utf8')), got = { n: rows.length, netR: r3(mean(rows.map((r) => r[2]))) };
      if (got.n !== GATES[mk].n || got.netR !== GATES[mk].netR || got.n !== want.rows.length || got.netR !== want.mean) throw new Error(`baseline gate failed (${mk}): ${JSON.stringify(got)}`);
    }
    const rows = [...gRows, ...uRows].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)), D = measuredD(rows);
    const e = rows.filter((r) => r[1] < CUT_MIN), l = rows.filter((r) => r[1] >= CUT_MIN);
    fs.writeFileSync(path.join(HERE, 'baseline.json'), JSON.stringify({ windows: { xau: '2021-01-01 → 2026-11-12 (C1)', usdjpy: '2016-01-01 → 2026-11-19' },
      cols: ['day', 'fillMin', 'net', 'market'], gates: { xau: { n: gRows.length }, usdjpy: { n: uRows.length } },
      early: { n: e.length, netR: r3(mean(e.map((r) => r[2]))) }, late: { n: l.length, netR: r3(mean(l.map((r) => r[2]))) }, D: r3(D), rows }) + '\n');
    console.log(`baseline: early n ${e.length}, late n ${l.length}, D ${r3(D)}`);
  } else {
    const basePath = path.join(HERE, 'baseline.json');
    if (!fs.existsSync(basePath)) throw new Error('baseline.json missing: run the baseline step first');
    const base = JSON.parse(fs.readFileSync(basePath, 'utf8')), outPath = out || path.join(HERE, 'result.json');
    const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const tr = [...goldForward(gd.days, cost), ...usdjpyForward(ud.days)].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.fillMin - b.fillMin));
    const ends = [gd.dataEnd, ud.dataEnd].filter(Boolean).sort();
    const R = build(tr, base, ends[0] || null, prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!out) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(R.verdict);
  }
}
