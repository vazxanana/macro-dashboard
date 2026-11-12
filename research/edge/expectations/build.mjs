// What to expect: builds council/expect-base.json from the untouched-data studies (8 Nov 2026). Paper research only: nothing
// live changes. The Trader's Coach build (council/trader.mjs, every 6 h) turns this file + the decay monitor's forward
// record into coach.json `expect` through the pure council/expect.mjs; the page card #ms-expect shows it.
//
//   node research/edge/expectations/build.mjs
//
// Per live system, two windows of the SAME harness and costs (x1), from the study's own per-position record:
//   honest   the untouched window: data the rule never saw
//   builtOn  the window the rule was built or judged on (the in-sample / calibration period)
// plus the decay monitor's baseline (council/decay-base.json: ref, sd, trades a year, worst drawdown, MC95 drawdown) as the
// "backtest" the forward record is watched against, and an authored regime note whose numbers come from the computed stats.
// Records:
//   research/edge/sizing/inputs.json            ict-a (2008-26), nq-open (2004-26), replica (2018-26), gtrend, geg (2006-26)
//   research/edge/gold-systems-oos/result.json  positions: gtrend5, gtl (2006-26; x1 net = `n`)
//   research/edge/mosha-oos/result.json         positions: Mosha BO live combination, OANDA 2006-26 (#560)
//   research/edge/robustness/out/gmp.json       gold momentum pullback 2018-26 rebuild
//   research/edge/crypto-trend-decay/result.json  crypto trend v3 positions (closed only)
import fs from 'node:fs';
import path from 'node:path';
import { loadBase, mcDrawdown, SYSTEMS } from '../../../council/decay.mjs';
import { describe, drawdown, fR } from '../../../council/expect.mjs';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../../..'), EDGE = path.resolve(HERE, '..');
const rdE = (f) => JSON.parse(fs.readFileSync(path.join(EDGE, f), 'utf8'));
const YEAR = 365.25 * 86400, sec = (s) => Math.floor(Date.parse(s.length <= 10 ? `${s}T00:00:00Z` : `${s}:00Z`) / 1000);
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
// window stats from a record of { t (entry, s), c (close, s), R }: n, exp, sd, t, maxDD on the close-ordered curve (as the
// studies measure it), trades a year over the declared window, MC95 drawdown
function win(rec, from, to, label, src) {
  const R = rec.slice().sort((x, y) => (x.c || x.t) - (y.c || y.t)).map((p) => p.R), d = describe(R), a = sec(from), b = sec(to) + 86400, years = (b - a) / YEAR;
  return { src, window: label, from, to, years: r2(years), n: d.n, exp: r3(d.mean), sd: r3(d.sd), t: r2(d.t), R: r2(d.sum), maxDD: r2(drawdown(R).max), perYear: r2(d.n / years), mc95: r2(mcDrawdown(R)) };
}
const inRange = (t, from, to) => t >= sec(from) && t < sec(to) + 86400;

// ─── records ───
const SZ = rdE('sizing/inputs.json'), cN = SZ.cols.indexOf('net1');
const sz = (id) => SZ.systems[id].map((r) => ({ t: r[0], c: r[1], R: r[cN] }));
const GSO = rdE('gold-systems-oos/result.json');
// Financing (11 Nov 2026, owner approved; research/edge/trend-breadth Part A, the same method and rate): every recorded position of
// the four long-only gold systems pays nights x FIN.xau.long x (gold's daily close on its entry day) / r0, on the first unit only
// (the records do not carry the add). R = net after financing; R0 = the study's net before it, kept for the "before" figures.
const G1D = rdE('honest-book/gold-1d.json').bars;
const goldPx = (t) => { let lo = 0, hi = G1D.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (G1D[m][0] <= t) lo = m; else hi = m - 1; } return G1D[lo][1]; };
const gso = (sys) => GSO.positions.filter((p) => p.sys === sys).map((p) => { const t = sec(p.t), c = sec(p.c), nn = nights(t, c), f = nn * FIN.xau.long * goldPx(t) / p.r0; return { t, c, R: p.n - f, R0: p.n, fin: f, nn }; });
// the momentum pullback's rebuild: entry price, risk and exit time of each position from research/edge/decay-monitor/positions.json
// (row for row with the record); a long pays, a short pays nothing
const POS = rdE('decay-monitor/positions.json').systems;
const rb = (f, key) => { const j = rdE(`robustness/out/${f}.json`), T = key ? j.trades[key] : j.trades, P = POS[key || f]; if (!P || P.length !== T.length) throw new Error(`${f}: positions.json does not match the rebuild record`);
  return T.map((x, i) => { const [t, o, c, e, r0, side] = P[i]; if (t !== x.t) throw new Error(`${f}: position ${i} does not line up`); const nn = side > 0 ? nights(o, c) : 0, f1 = nn * FIN.xau.long * e / r0; return { t: x.t, c, R: x.R - f1, R0: x.R, fin: f1, nn }; }); };
const MO = rdE('mosha-oos/result.json');   // Mosha BO live combination on OANDA 2006-26 (#560): positions t / c, x1 net = `n`
// Mosha BO (both sides): a buy pays like the four gold systems (nights x rate x gold's daily close on the entry day / r0, first unit only)
const mosha = MO.positions.map((p) => { const t = sec(p.t), c = sec(p.c), nn = p.side === 'buy' ? nights(t, c) : 0, f = nn * FIN.xau.long * goldPx(t) / p.r0; return { t, c, R: p.n - f, R0: p.n, fin: f, nn }; });
// Gold replica: research/edge/replica-oos/positions.json (side, legs [R, size, r0, exit]) lines up row for row with the sizing record
// (entry and close time); a buy pays on its first leg, at that leg's size (the record is sized as live)
const RPOS = rdE('replica-oos/positions.json');
const replica = SZ.systems.replica.map((r, i) => { const p = RPOS[i]; if (!p || sec(p.at) !== r[0]) throw new Error('replica: positions.json and sizing/inputs.json do not line up at row ' + i);
  const l = p.legs[0], nn = p.side === 'buy' ? nights(r[0], r[1]) : 0, f = nn * FIN.xau.long * goldPx(r[0]) / l[2] * l[1]; return { t: r[0], c: r[1], R: r[cN] - f, R0: r[cN], fin: f, nn }; });
const CR = rdE('crypto-trend-decay/result.json');
const crypto = CR.trades.filter((x) => x.exitKind !== 'open' && Number.isFinite(x.R)).map((x) => ({ t: sec(x.sig), c: sec(x.exit), R: x.R }));
const cut = (rec, from, to) => rec.filter((p) => inRange(p.t, from, to));

const base = loadBase();
const SRC = {
  replica: { rec: replica, honest: ['2017-01-01', '2022-12-31', '2017-22 out of sample'], built: ['2023-01-01', '2026-11-06', '2023-26 built on'],
    study: 'research/edge/replica-oos', note: (h, b) => `fails out of sample: ${fR(h.exp)} a trade after financing on 2017-22 (${h.n} trades, all in 9 months of open gate; no trade in 2017, 2021); ${fR(b.exp)} on 2023-26 with the same harness (#512)` },
  'mosha-bo': { rec: mosha, honest: ['2006-07-01', '2017-12-31', '2006-17 out of sample'], built: ['2018-01-01', '2026-11-06', '2018-26 calibration'],
    study: 'research/edge/mosha-oos', note: (h, b) => `a null result in substance: ${fR(h.exp)} a trade after financing on 2006-17 (${h.n} positions, t ${h.t}; the bull half lost, −16.5R without its best 5) against ${fR(b.exp)} on 2018-26; the independent 2018-26 rebuild made +0.01R with a −39R drawdown (#560, #486)` },
  gtrend: { rec: gso('gtrend'), honest: ['2006-07-01', '2017-12-31', '2006-17 out of sample'], built: ['2018-01-01', '2026-11-06', '2018-26 built on'],
    study: 'research/edge/gold-systems-oos', note: (h, b) => `regime-bound: ${fR(h.exp)} a trade after financing on 2006-17 (+0.49R before it; 8 of 12 years positive) against ${fR(b.exp)} on 2018-26; random long entries with the same exit made +0.28R before financing, so most of it is being long gold with a trailing exit (#530)` },
  gtrend5: { rec: gso('gtrend5'), honest: ['2006-07-01', '2017-12-31', '2006-17 out of sample'], built: ['2018-01-01', '2026-11-06', '2018-26 built on'],
    study: 'research/edge/gold-systems-oos', note: (h, b) => `regime-bound: ${fR(h.exp)} a trade after financing on 2006-17 (+0.37R before it) against ${fR(b.exp)} on 2018-26; moves with Gold trend (0.92 correlation), so it doubles that bet rather than adding one; shadow since 7 Nov (#530)` },
  gtl: { rec: gso('gtl'), honest: ['2006-07-01', '2017-12-31', '2006-17 out of sample'], built: ['2018-01-01', '2026-11-06', '2018-26 built on'],
    study: 'research/edge/gold-systems-oos', note: (h, b) => `regime-bound, and does not survive financing: ${fR(h.exp)} a trade after it on 2006-17 (+0.05R before it; a coin flip at double cost, −${h.maxDD.toFixed(0)}R drawdown, loses without 2016) against ${fR(b.exp)} on 2018-26; shadow since 11 Nov (#530, trend-breadth)` },
  geg: { rec: gso('geg'), honest: ['2006-07-01', '2017-12-31', '2006-17 out of sample'], built: ['2018-01-01', '2026-11-06', '2018-26 built on'],
    study: 'research/edge/gold-systems-oos', note: (h, b) => `regime-bound: ${fR(h.exp)} a trade after financing on 2006-17 (+0.19R before it; near zero when gold is not rising: 2012-17 +0.06R before financing) against ${fR(b.exp)} on 2018-26 (#530)` },
  gmp: { rec: rb('gmp'), honest: ['2018-01-01', '2022-12-31', '2018-22 before the rule was judged'], built: ['2023-01-01', '2026-10-31', '2023-26 built on'],
    study: 'research/edge/robustness', note: (h, b) => `regime-bound: ${fR(h.exp)} a trade after financing on 2018-22 (${h.n} trades) against ${fR(b.exp)} on 2023-26; fragile in the robustness audit (#486)` },
  'nq-open': { rec: sz('nq-open'), honest: ['2004-01-01', '2022-12-31', '2004-22 untouched'], built: ['2023-01-01', '2026-11-03', '2023-26 built on'],
    study: 'research/edge/nq-open-oos', note: (h, b) => `regime-bound: made nothing 2004-22 (${fR(h.exp)} a trade over ${h.n.toLocaleString('en-GB')}, nine flat years 2014-22); ${fR(b.exp)} a trade since 2023; no observable on/off signal (#511)` },
  'ict-a': { rec: sz('ict-a'), honest: ['2008-01-01', '2017-12-31', '2008-17 out of sample'], built: ['2018-01-01', '2026-10-31', '2018-26 built on'],
    study: 'research/edge/ict-oos-2008', note: (h, b) => `fails out of sample: ${fR(h.exp)} a trade on 2008-17 (${h.n.toLocaleString('en-GB')} A-setups, GC/NQ/ES/YM; index sells against a bull market lost); ${fR(b.exp)} on 2018-26 (#526)` },
  trend: { rec: crypto, honest: ['2025-06-01', '2026-10-31', 'June 2025 on (decayed window)'], built: ['2017-08-17', '2023-12-31', '2017-23 built on'],
    study: 'research/edge/crypto-trend-decay', note: (h, b) => `decayed: ${fR(b.exp)} a position before 2024, ${fR(h.exp)} since June 2025 (${h.n} positions; no run of 2R or more in 17 months); shadow since 7 Nov (#508)` },
};

const out = { at: new Date().toISOString(), method: 'research/edge/expectations/build.mjs', costs: 'x1 per study: gold 0.30 a unit, NQ 1 point, ICT the futures round trip, crypto Kraken fees; since 11 Nov 2026 every long gold position also pays overnight financing (the four long-only gold systems, and the buys of the Gold replica, Mosha BO and the momentum pullback)', z: 1.645,
  financing: { rate: FIN.xau.long, asOf: FIN.xau.asOf, src: FIN.xau.src, method: 'research/edge/trend-breadth Part A: rollovers Mon-Fri 22:00 UTC (Wednesday three) x rate x gold close on the entry day / r0, first unit only (the momentum pullback: its rebuild\'s own entry price; the replica: its first leg at the leg\'s size); a sell pays nothing and is credited nothing', systems: ['gtrend', 'gtrend5', 'geg', 'gtl', 'replica', 'mosha-bo', 'gmp'],
    notComputed: 'NQ open run: out before the rollover, none; ICT and crypto: not measured' }, systems: [] };
// financing of a window: what it took per position and the figures before it (null for a system whose record carries none)
const finOf = (rec, from, to) => { const a = cut(rec, from, to); if (!a.length || a[0].R0 == null) return null; const d0 = describe(a.map((p) => p.R0));
  return { perTrade: r3(a.reduce((q, p) => q + p.fin, 0) / a.length), nights: r2(a.reduce((q, p) => q + p.nn, 0) / a.length), before: { exp: r3(d0.mean), t: r2(d0.t) } }; };
const rows = [];
for (const s of SYSTEMS) {
  const S = SRC[s.id]; if (!S) continue;
  const b = base.systems[s.id];
  const h = win(cut(S.rec, S.honest[0], S.honest[1]), S.honest[0], S.honest[1], S.honest[2], S.study);
  const bo = S.built ? win(cut(S.rec, S.built[0], S.built[1]), S.built[0], S.built[1], S.built[2], S.study) : { ...h, sameAsHonest: true };
  const backtest = { src: b.src, window: `${b.from} to ${b.to}`, n: b.n, exp: b.ref, sd: b.sd, perYear: b.perYear, maxDD: b.maxDD, mcDD: b.mcDD };
  const fin = finOf(S.rec, S.honest[0], S.honest[1]);
  const e = { id: s.id, name: s.name, desk: s.desk, live: !s.shadow, ...(s.shadow && s.since ? { shadowSince: s.since } : {}), study: S.study, honest: h, builtOn: bo, backtest, fin,
    dd: { mc95: b.mcDD, worst: r2(Math.max(h.maxDD, b.maxDD)) }, regime: S.note(h, bo) };
  out.systems.push(e);
  rows.push(`| ${s.name}${s.shadow ? ' (shadow)' : ''} | ${h.window} | ${h.n.toLocaleString('en-GB')} | ${fR(h.exp)} (t ${h.t}) | ${h.perYear} | −${h.maxDD}R | ${fR(bo.exp)} (${bo.window}) | ${fR(b.ref)}, MC95 −${b.mcDD}R |`);
}
fs.writeFileSync(path.join(ROOT, 'council/expect-base.json'), JSON.stringify(out, null, 1) + '\n');
console.log('| System | Honest window | n | R a trade | trades/yr | worst DD | built-on window | decay baseline |\n|---|---|---|---|---|---|---|---|\n' + rows.join('\n'));
console.log(`\nwrote council/expect-base.json (${out.systems.length} systems)`);
