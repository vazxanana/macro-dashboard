// Edge-decay monitor: baselines and a backtest of the monitor itself (8 Nov 2026). Paper research only: nothing live changes.
//
//   node research/edge/decay-monitor/run.mjs <council-data dir>
//
// 1. Writes council/decay-base.json: one baseline per live system (expectancy after costs, SD, CUSUM allowance, control limit,
//    drawdown limit) from the longest record of the live rule there is:
//      - Gold replica, NQ New York open run: the council's own replay (council-data research/replay-2w.json, 2023-26). Both
//        are regime bets (#511, #512): what is monitored is whether the regime they were built on still holds.
//      - Mosha BO, gold trend N20 / N5, H4 trendline, daily engulf, momentum pullback, crypto trend: the 2018-26 rebuilds of the
//        robustness audit (research/edge/robustness/out/*.json, net R per position).
//      - ICT A-setups: the desk replay (council-data ict/replay.json, aset, after the micro-futures round trip).
//    Worst historical drawdowns quoted from the studies: research/edge/gold-systems/RESULT.md (8-year maxDD), replica-oos
//    (owner allowance 30-40R), crypto-trend-decay (−10.0R), robustness rebuilds (NQ 2018-26 −20R).
// 2. Backtests the monitor (council/decay.mjs, unchanged) on the records where the answer is known:
//      - crypto trend v3, 2017-26 (research/edge/crypto-trend-decay/result.json): should flag mid/late 2025
//      - NQ open run, OANDA 2004-26 net of 1 point (research/edge/nq-open-oos/result.json): should NOT flag 2023-26; the dead
//        2014-22 era shows how fast it would have caught the regime ending
//      - gold replica out of sample 2017-22 (research/edge/replica-oos/positions.json, 0.30 a unit)
//      - every live system: simulated false alarms (a year of trades drawn from its own baseline) and detection delay
//        (the same, shifted to a zero edge)
// Writes result.json next to this file and prints the tables used in RESULT.md.
import fs from 'node:fs';
import path from 'node:path';
import { makeBase, assess, describe, rng, DK, fold, SYSTEMS } from '../../../council/decay.mjs';
import { merNet, ictNet } from '../../../council/digest.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../../..'), EDGE = path.resolve(HERE, '..');
const CD = process.argv[2] || 'data';
const rdE = (f) => JSON.parse(fs.readFileSync(path.join(EDGE, f), 'utf8'));
const rdC = (f) => JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8'));
const YEAR = 365.25 * 86400, day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const perYear = (T) => T.length > 1 ? (T.length - 1) / ((Math.max(...T) - Math.min(...T)) / YEAR) : T.length;
const fR = (v) => `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}${Math.abs(+v || 0).toFixed(2)}R`;
const sec = (s) => Math.floor(Date.parse(s.length <= 10 ? s + 'T00:00:00Z' : s + 'Z') / 1000);

// ─── 1. baselines ───
const replay = rdC('research/replay-2w.json'), ictReplay = rdC('ict/replay.json');
const done = (x) => ['win', 'loss', 'be'].includes(x.status) && Number.isFinite(+x.R) && x.closed;
const rp = (k, s) => fold(replay.trades.filter((x) => x.k === k && (!s || x.session === s) && done(x)), merNet).sort((a, b) => a.t - b.t);
const rb = (f, key) => { const j = rdE(`robustness/out/${f}.json`), T = key ? j.trades[key] : j.trades; return T.map((x) => ({ t: x.t, R: x.R })).sort((a, b) => a.t - b.t); };
const SRC = {
  replica: { rec: rp('replica'), maxDD: 40.2, ddAllow: 40, src: `council replay ${replay.from} to ${replay.to} (research/replay-2w.json)`, note: 'regime bet: worst 8-year drawdown −40.2R (gold-systems), owner allows 30-40R (#512)' },
  'mosha-bo': { rec: rb('mosha'), maxDD: 10.7, src: 'Mosha BO 2018-26 rebuild (research/edge/robustness/out/mosha.json)', hist: true },
  gtrend: { rec: rb('gtrend', 'gtrend20'), maxDD: 3.7, src: 'gold trend N20 2018-26 rebuild (robustness/out/gtrend.json)' },
  gtrend5: { rec: rb('gtrend', 'gtrend5'), maxDD: 6.6, src: 'gold trend N5 2018-26 rebuild (robustness/out/gtrend.json)' },
  gtl: { rec: rb('gtl'), maxDD: 14.1, src: 'gold H4 trendline 2018-26 rebuild (robustness/out/gtl.json)' },
  geg: { rec: rb('geg'), maxDD: 10.2, src: 'gold daily engulf 2018-26 rebuild (robustness/out/geg.json)' },
  gmp: { rec: rb('gmp'), maxDD: 40, src: 'gold momentum pullback 2018-26 rebuild (robustness/out/gmp.json)' },
  'nq-open': { rec: rp('nq-open', 'nyflip'), maxDD: 20, src: `council replay ${replay.from} to ${replay.to}, session nyflip`, note: 'regime bet: 2018-26 rebuild worst drawdown −20R (#511)' },
  'ict-a': { rec: fold(ictReplay.trades.filter((x) => x.aset && done(x) && x.valid !== false), ictNet).sort((a, b) => a.t - b.t), maxDD: 0, src: `ICT desk replay from ${ictReplay.from} (ict/replay.json, A-setups, after the micro round trip)` },
  trend: { rec: rb('crypto'), maxDD: 10.0, src: 'crypto trend v3 2017-26 rebuild (robustness/out/crypto.json)', note: 'shadow since 7 Nov (#508)' },
};
const base = { at: new Date().toISOString(), q: DK.q, method: 'research/edge/decay-monitor/run.mjs', systems: {} };
for (const s of SYSTEMS) {
  const S = SRC[s.id], R = S.rec.map((p) => p.R);
  const b = makeBase(R, { perYear: perYear(S.rec.map((p) => p.t)), maxDD: S.maxDD, ddAllow: S.ddAllow, src: S.src, note: S.note });
  b.from = day(S.rec[0].t); b.to = day(S.rec.at(-1).t);
  // no council replay of this rule: the last two years of the rebuild stand in front of the forward record
  if (S.hist) b.hist = S.rec.filter((p) => p.t >= S.rec.at(-1).t - 2 * YEAR).map((p) => [p.t, +p.R.toFixed(3)]);
  base.systems[s.id] = b;
}
fs.writeFileSync(path.join(ROOT, 'council/decay-base.json'), JSON.stringify(base, null, 1) + '\n');

// ─── 2. backtests of the monitor ───
// the status after every point of a record: [{ t, status, s, dd, roll }]
function timeline(points, b) {
  const out = [];
  for (let i = 0; i < points.length; i++) { const a = assess(points.slice(0, i + 1), b); out.push({ t: points[i].t, R: points[i].R, status: a.status, s: a.cusRef.s, z: a.cusZero.s, dd: a.dd.cur, roll: a.roll.exp, few: !!a.few }); }
  return out;
}
const firstOf = (T, st) => { const i = T.findIndex((x) => x.status === st); return i < 0 ? null : { n: i + 1, date: day(T[i].t), s: T[i].s, dd: T[i].dd }; };
const share = (T, st) => T.length ? +(T.filter((x) => x.status === st).length / T.length).toFixed(3) : 0;
// episodes: runs of the same status (only watch / decaying), with start, end and length in trades
function episodes(T) {
  const E = []; let cur = null;
  for (let i = 0; i < T.length; i++) { const st = T[i].status;
    if (cur && cur.status === st) { cur.to = day(T[i].t); cur.n++; continue; }
    if (cur) E.push(cur); cur = st === 'healthy' ? null : { status: st, from: day(T[i].t), to: day(T[i].t), n: 1, at: i + 1 }; }
  if (cur) E.push(cur); return E;
}
const byQuarter = (T) => { const q = {}; for (const x of T) { const d = day(x.t), k = `${d.slice(0, 4)} Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}`; q[k] = { status: x.status, s: x.s, h: null, dd: x.dd, roll: x.roll }; } return q; };
const res = { at: base.at, base: base.systems, tests: {} };

// a) crypto trend v3: positions in exit order, net of Kraken fees
{
  const C = rdE('crypto-trend-decay/result.json').trades.map((x) => ({ t: sec(x.exit), R: x.R, e: x.entry })).sort((a, b) => a.t - b.t);
  const pre = C.filter((x) => x.e < '2024'), post = C.filter((x) => x.e >= '2024');
  const bWF = makeBase(pre.map((x) => x.R), { perYear: perYear(pre.map((x) => x.t)), maxDD: 10.0, src: 'positions entered 2017-23 (walk-forward)' });
  const T1 = timeline(post, bWF), T2 = timeline(C, base.systems.trend);
  res.tests.crypto = { wf: { base: bWF, first: { watch: firstOf(T1, 'watch'), decaying: firstOf(T1, 'decaying') }, quarters: byQuarter(T1), episodes: episodes(T1), end: T1.at(-1) },
    full: { base: base.systems.trend, episodes: episodes(T2), first2024: (() => { const i = T2.findIndex((x) => x.t >= sec('2024-01-01') && x.status === 'decaying'); return i < 0 ? null : day(T2[i].t); })() } };
}
// b) NQ open run, OANDA 1-minute, net of 1 point
{
  const N = rdE('nq-open-oos/result.json').trades.map((x) => ({ t: sec(x.d) + x.m * 60, R: x.R, y: +x.d.slice(0, 4) }));
  const b = base.systems['nq-open'], late = N.filter((x) => x.y >= 2023);
  const T = timeline(late, b);
  const e1 = N.filter((x) => x.y >= 2023 && x.y <= 2024), e2 = N.filter((x) => x.y >= 2025);
  const bOOS = makeBase(e1.map((x) => x.R), { perYear: perYear(e1.map((x) => x.t)), maxDD: 20, src: 'OANDA 2023-24 only' }), T3 = timeline(e2, bOOS);
  const Td = timeline(N.filter((x) => x.y >= 2014 && x.y <= 2022), b), Te = timeline(N.filter((x) => x.y <= 2013), b);
  res.tests.nq = { live: { base: b, n: late.length, decaying: firstOf(T, 'decaying'), watch: firstOf(T, 'watch'), shareWatch: share(T, 'watch'), shareDecay: share(T, 'decaying'), maxS: Math.max(...T.map((x) => x.s)), maxDD: Math.max(...T.map((x) => x.dd)), episodes: episodes(T), quarters: byQuarter(T) },
    oos: { base: bOOS, n: e2.length, decaying: firstOf(T3, 'decaying'), shareWatch: share(T3, 'watch'), episodes: episodes(T3) },
    dead1422: { n: Td.length, decaying: firstOf(Td, 'decaying'), shareDecay: share(Td, 'decaying'), episodes: episodes(Td).filter((e) => e.status === 'decaying').slice(0, 6) },
    early0413: { n: Te.length, decaying: firstOf(Te, 'decaying'), shareDecay: share(Te, 'decaying') } };
}
// c) gold replica out of sample 2017-22 (0.30 a unit), with the live baseline
{
  const P = rdE('replica-oos/positions.json').map((p) => ({ t: sec(p.at), R: p.legs.reduce((a, l) => a + (l[0] - 0.30 / l[2]) * l[1], 0), y: +p.at.slice(0, 4) })).sort((a, b) => a.t - b.t);
  const oos = P.filter((x) => x.y <= 2022), ins = P.filter((x) => x.y >= 2023), b = base.systems.replica;
  const To = timeline(oos, b), Ti = timeline(ins, b);
  res.tests.replica = { oos: { n: oos.length, exp: +describe(oos.map((x) => x.R)).mean.toFixed(3), decaying: firstOf(To, 'decaying'), watch: firstOf(To, 'watch'), shareDecay: share(To, 'decaying'), episodes: episodes(To) },
    is: { n: ins.length, exp: +describe(ins.map((x) => x.R)).mean.toFixed(3), decaying: firstOf(Ti, 'decaying'), shareDecay: share(Ti, 'decaying'), episodes: episodes(Ti) } };
}
// d) simulation per system: one year of trades from its own baseline (false alarm), and the same with the edge removed
{
  const sim = {}, iters = +(process.env.SIM_ITERS || 300);
  for (const s of SYSTEMS) {
    const b = base.systems[s.id], R = SRC[s.id].rec.map((p) => p.R), H = Math.max(DK.minH, Math.round(b.perYear)), r = rng(99);
    let fa = 0, faW = 0, det = 0; const delay = [];
    for (let i = 0; i < iters; i++) {
      const a = [], z = []; for (let j = 0; j < H; j++) { const x = R[Math.floor(r() * R.length)]; a.push({ t: j, R: x }); }
      for (let j = 0; j < 3 * H; j++) z.push({ t: j, R: R[Math.floor(r() * R.length)] - b.ref });
      const sts = a.map((_, j) => assess(a.slice(0, j + 1), b).status);
      if (sts.includes('decaying')) fa++; if (sts.includes('watch') || sts.includes('decaying')) faW++;
      let d = null; for (let j = 0; j < z.length; j++) if (assess(z.slice(0, j + 1), b).status === 'decaying') { d = j + 1; break; }
      if (d != null) { det++; delay.push(d); }
    }
    delay.sort((x, y) => x - y);
    sim[s.id] = { H, falseAlarmYear: +(fa / iters).toFixed(3), anyFlagYear: +(faW / iters).toFixed(3), caughtIn3Years: +(det / iters).toFixed(3), medianDelay: delay.length ? delay[Math.floor(delay.length / 2)] : null, medianDelayYears: delay.length ? +(delay[Math.floor(delay.length / 2)] / b.perYear).toFixed(2) : null };
  }
  res.tests.sim = sim;
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');

// ─── print ───
console.log('\n## Baselines (council/decay-base.json)\n\n| System | Baseline record | n | R/trade | SD | trades/yr | k | limit h | W | worst DD (hist / MC95 / allowance) | DD limit |\n|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of SYSTEMS) { const b = base.systems[s.id]; console.log(`| ${s.name}${s.shadow ? ' (shadow)' : ''} | ${b.src.replace(/ \(.*\)$/, '')}, ${b.from} to ${b.to} | ${b.n} | ${fR(b.ref)} | ${b.sd} | ${b.perYear} | ${b.k} | ${b.h} | ${b.W} | ${b.maxDD} / ${b.mcDD} / ${b.ddAllow || '–'} | ${b.ddLimit}R |`); }
const C = res.tests.crypto;
console.log('\n## Crypto trend, walk-forward (baseline 2017-23, monitor from Jan 2024)\n', JSON.stringify(C.wf.first), '\n', JSON.stringify(C.wf.base));
console.log('| Quarter | status | CUSUM | drawdown | last W R/trade |\n|---|---|---|---|---|'); for (const [k, v] of Object.entries(C.wf.quarters)) console.log(`| ${k} | ${v.status} | ${v.s} | ${v.dd}R | ${fR(v.roll)} |`);
console.log('episodes', JSON.stringify(C.wf.episodes)); console.log('full-baseline episodes 2017-26', JSON.stringify(C.full.episodes));
const Q = res.tests.nq;
console.log('\n## NQ', JSON.stringify({ n: Q.live.n, decaying: Q.live.decaying, watch: Q.live.watch, shareWatch: Q.live.shareWatch, maxS: Q.live.maxS, maxDD: Q.live.maxDD }), '\nepisodes', JSON.stringify(Q.live.episodes));
console.log('| Quarter | status | CUSUM | drawdown | last W R/trade |\n|---|---|---|---|---|'); for (const [k, v] of Object.entries(Q.live.quarters)) console.log(`| ${k} | ${v.status} | ${v.s} | ${v.dd}R | ${fR(v.roll)} |`);
console.log('oos 2025-26 with 2023-24 base', JSON.stringify({ n: Q.oos.n, decaying: Q.oos.decaying, shareWatch: Q.oos.shareWatch, h: Q.oos.base.h, ref: Q.oos.base.ref }), JSON.stringify(Q.oos.episodes));
console.log('2014-22', JSON.stringify(Q.dead1422)); console.log('2004-13', JSON.stringify(Q.early0413));
console.log('\n## Replica', JSON.stringify(res.tests.replica));
console.log('\n## Simulation\n| System | trades a year | false "decaying" within a year | any flag within a year | zero edge: caught within 3 years | median delay (trades / years) |\n|---|---|---|---|---|---|');
for (const s of SYSTEMS) { const m = res.tests.sim[s.id]; console.log(`| ${s.name} | ${m.H} | ${(m.falseAlarmYear * 100).toFixed(1)}% | ${(m.anyFlagYear * 100).toFixed(1)}% | ${(m.caughtIn3Years * 100).toFixed(0)}% | ${m.medianDelay ?? '–'} / ${m.medianDelayYears ?? '–'} |`); }
