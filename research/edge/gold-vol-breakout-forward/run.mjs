// Edge research · gold-vol-breakout-forward: the forward record of gold-vol-breakout's T1 under hourcost's route C1, on days
// from 2026-11-13 (PREREGISTRATION.md). Paper research only: nothing trades, nothing live reads it.
//   node research/edge/gold-vol-breakout-forward/run.mjs baseline <candleDir>   (once: baseline.json = the W4 trades under C1)
//   node research/edge/gold-vol-breakout-forward/run.mjs <candleDir> [out.json]  (the forward record: result.json + RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { tradesIn, stats, daysOf, sessionOf, WINDOWS } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge, ORIG_SHA, COSTS_SHA } from '../gold-vol-breakout-hourcost/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HC = path.join(HERE, '..', 'gold-vol-breakout-hourcost');
export const START = '2026-11-13', SLIP = 0.05, DRAWS = 20000, SEED = 20261120, MIN_N = 20, CHECKS = [120, 240];
export const BASE_WANT = { n: 1121, netR: 0.105, t: 2.79 };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

export function frozenCost() {
  const hc = JSON.parse(fs.readFileSync(path.join(HC, 'result.json'), 'utf8'));
  return { profile: hc.profile, commission: hc.commission, probe: hc.probe };
}
export function checkCopies() {
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(HC, f))).digest('hex');
  if (sha('original.mjs') !== ORIG_SHA || sha('costs.mjs') !== COSTS_SHA) throw new Error('hourcost original.mjs / costs.mjs are not the pinned copies');
}
// T1 trades of the days from `from` on, charged C1 (net), with what the record shows
export function forwardTrades(days, from, cost) {
  const tr = tradesIn(days, [from, '2099-12-31']).tr, net = charge(tr, cost.profile, 'frac', cost.commission, SLIP);
  return tr.map((x, i) => ({ day: x.day, side: x.side > 0 ? 'buy' : 'sell', how: x.how, fillMin: x.fillMin, session: sessionOf(x.fillMin), entry: x.entry, r: r3(x.r), R: r3(x.R), net: r3(net[i].net) }));
}

// month-block bootstrap of the total of n trades; months = [[net, …], …] in calendar order
export function bands(months, n, { draws = DRAWS, seed = SEED, shift = 0 } = {}) {
  if (!(n > 0)) return { p5: 0, p50: 0, p95: 0 };
  const rnd = O.rng(seed), tot = new Float64Array(draws);
  for (let d = 0; d < draws; d++) {
    let left = n, s = 0;
    while (left > 0) { const m = months[Math.floor(rnd() * months.length)]; for (let i = 0; i < m.length && left > 0; i++, left--) s += m[i] - shift; }
    tot[d] = s;
  }
  const v = [...tot];
  return { p5: r2(O.quantile(v, 0.05)), p50: r2(O.quantile(v, 0.5)), p95: r2(O.quantile(v, 0.95)) };
}
export function monthsOf(rows) {
  const m = new Map(); for (const [day, net] of rows) { const k = day.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(net); }
  return [...m.keys()].sort().map((k) => m.get(k));
}
export function reading(n, total, A, B) {
  if (n < MIN_N) return 'too few';
  if (total < A.p5) return 'below the measured range';
  if (total > B.p95) return 'ahead of a no-edge rule';
  return 'undecided';
}
export function checkAt(c, total, A, B, t) {
  if (c === CHECKS[1]) return total < A.p5 ? 'fails' : (total > B.p95 && t >= 2 ? 'confirmed' : 'not shown either way');
  return total < A.p5 ? 'fails' : 'holds so far';
}
export function checkpoint(n, total, A, B, t) {
  const c = [...CHECKS].reverse().find((k) => n >= k);
  return c ? checkAt(c, total, A, B, t) : null;
}
function maxDD(c) { let eq = 0, hi = 0, dd = 0; for (const x of c) { eq += x.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); } return r2(dd); }
const split = (tr, key) => Object.fromEntries([...new Set(tr.map((x) => x[key]))].sort().map((k) => { const a = tr.filter((x) => x[key] === k); return [k, { n: a.length, netR: r3(mean(a.map((x) => x.net))), total: r2(a.reduce((s, x) => s + x.net, 0)) }]; }));

export function verdictOf(cp, crossed, read, n, total) {
  const last = crossed[CHECKS[1]] || crossed[CHECKS[0]], tail = `forward record from ${START}: ${read}, n ${n}, total ${total >= 0 ? '+' : ''}${r2(total)}R after the measured cost`;
  if (last && last.reading === 'fails') return `FAIL (${tail})`;
  if (last && last.reading === 'confirmed') return `PASS (${tail})`;
  return `INCONCLUSIVE so far (${tail})`;
}
export function build(tr, base, dataEnd, prev) {
  const months = monthsOf(base.rows), n = tr.length, total = tr.reduce((s, x) => s + x.net, 0);
  const A = bands(months, n), B = bands(months, n, { shift: base.mean });
  const st = n ? stats(tr) : null, t = st ? st.tRaw : NaN;
  const read = reading(n, total, A, B), cp = checkpoint(n, total, A, B, t);
  // the first crossing of each checkpoint stands (PREREGISTRATION.md)
  const crossed = { ...((prev && prev.crossed) || {}) };
  for (const c of CHECKS) if (n >= c && !crossed[c]) crossed[c] = { at: dataEnd, n, total: r2(total), reading: checkAt(c, total, A, B, t) };
  return { study: 'gold-vol-breakout-forward', start: START, dataEnd, n, wins: tr.filter((x) => x.net > 0).length,
    netR: r3(mean(tr.map((x) => x.net))), grossR: r3(mean(tr.map((x) => x.R))), total: r2(total), monthT: st ? st.t : null, maxDD: maxDD(tr),
    bands: { A, B }, reading: read, checkpoint: cp, crossed,
    verdict: verdictOf(cp, crossed, read, n, total), bySide: split(tr, 'side'), bySession: split(tr, 'session'), trades: tr };
}

function fmt(v, d = 2) { return v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d); }
export function report(R) {
  const L = [`# Gold breakout T1: the forward record (from ${R.start})`, '',
    'Paper research only: nothing is traded, alerted or copied. The rule, cost, expected range and readings were fixed before any forward trade was computed (`PREREGISTRATION.md`). This page is written by `run.mjs`.', '',
    `**Verdict: ${R.verdict}**`, '',
    `**Reading: ${R.reading}${R.checkpoint ? `; checkpoint: ${R.checkpoint}` : ''}.** ${R.n} closed trade${R.n === 1 ? '' : 's'} on candles through ${R.dataEnd}, total ${fmt(R.total)}R after the measured cost (${fmt(R.netR, 3)}R a trade, before costs ${fmt(R.grossR, 3)}R).`, '',
    '## Against the expected range', '', '| | 5th | middle | 95th |', '|---|---|---|---|',
    `| A, as measured 2021-26 (+0.105R a trade) | ${fmt(R.bands.A.p5)} | ${fmt(R.bands.A.p50)} | ${fmt(R.bands.A.p95)} |`,
    `| B, no edge | — | — | ${fmt(R.bands.B.p95)} |`, '',
    `Too few under ${MIN_N} trades; the checkpoints are at ${CHECKS[0]} and ${CHECKS[1]} trades.`, '',
    '## Trades', '', '| Day | Side | Session | Exit | R before costs | R after |', '|---|---|---|---|---|---|',
    ...R.trades.map((x) => `| ${x.day} | ${x.side} | ${x.session} | ${x.how} | ${fmt(x.R, 3)} | ${fmt(x.net, 3)} |`), ''];
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  checkCopies();
  const args = process.argv.slice(2), mode = args[0] === 'baseline' ? 'baseline' : 'forward', dir = mode === 'baseline' ? args[1] : args[0];
  if (!dir) throw new Error('usage: run.mjs [baseline] <candleDir> [out.json]');
  const cost = frozenCost();
  const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))));
  if (mode === 'baseline') {
    const tr = tradesIn(days, WINDOWS.W4).tr.filter((x) => x.day <= '2026-11-12'), net = charge(tr, cost.profile, 'frac', cost.commission, SLIP);
    const st = stats(net), got = { n: st.n, netR: st.netR, t: st.t };
    if (Object.keys(BASE_WANT).some((k) => got[k] !== BASE_WANT[k])) throw new Error(`baseline gate failed: ${JSON.stringify(got)} vs ${JSON.stringify(BASE_WANT)}`);
    const rows = net.map((x) => [x.day, r3(x.net)]);
    fs.writeFileSync(path.join(HERE, 'baseline.json'), JSON.stringify({ window: '2021-01-01 → 2026-11-12', route: 'C1', gate: got, mean: r3(mean(rows.map((r) => r[1]))), rows }) + '\n');
    console.log('baseline', got);
  } else {
    const base = JSON.parse(fs.readFileSync(path.join(HERE, 'baseline.json'), 'utf8'));
    const outPath = args[1] || path.join(HERE, 'result.json');
    const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
    const R = build(forwardTrades(days, START, cost), base, dataEnd, prev);
    fs.writeFileSync(outPath, JSON.stringify(R, null, 1) + '\n');
    if (!args[1]) fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(`${R.reading}: n ${R.n}, total ${R.total}R, A p5 ${R.bands.A.p5}, B p95 ${R.bands.B.p95}`);
  }
}
