// research/edge/bigfade-hourcost/run.mjs - big-candle-fade cell "m15 k1.5 nobreak half" (the Equinox Big-candle fade desk)
// charged at the demo broker's measured spread by UTC hour + commission (PREREGISTRATION.md, 24 Nov 2026). Paper research only:
// nothing live imports it, nothing is placed. big-candle-fade's signal and trade code is imported, never edited.
//   EDGE_DATA=<cache> node research/edge/bigfade-hourcost/run.mjs trades <m> <dir>   -> <dir>/T-<m>.json (each of the ten markets)
//   node research/edge/bigfade-hourcost/run.mjs report <dir>                         -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { CAP as FCAP } from '../grid7-wide-fade/run.mjs';
import * as BIG from '../big-candle-fade/run.mjs';
import { exitWalk, marksProfile } from '../fade-late-hourcost/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
export const ALL = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const MEASURED = ['xau', 'xag', 'usdjpy'];
export const APART = ALL.filter((m) => !MEASURED.includes(m));
export const PROFILE_SRC = {
  xau: { commit: '0459ec37e2', file: 'research/probe/ticks-XAUUSD.json', kind: 'hourProfile (first two minutes of each UTC hour, last 60 weekdays)' },
  xag: { commit: '19c2477d5b', file: 'research/probe/ticks-XAGUSD.json', kind: 'hourProfile (first two minutes of each UTC hour, last 60 weekdays)' },
  usdjpy: { file: 'research/edge/fade-late-hourcost/profile.json', kind: "median bid / ask at fade-tick-exec's fills and exits, by UTC hour" },
};
export const SYMBOLS_COMMIT = '853060f780';
// broker commissionRT (round trip, share of price), council-data ctrader/symbols.json at SYMBOLS_COMMIT
export const COMM = { xau: 0.000024, xag: 0.000024, usdjpy: 0.000045, eurusd: 0.000045, gbpusd: 0.000045, audusd: 0.000045,
  nzdusd: 0.000045, usdcad: 0.000045, usdchf: 0.000045, eurjpy: 0.000045 };
export const GATE = { d: { n: 47354, mean: 0.307 }, c: { n: 54443, mean: 0.193 } };
export const N_MIN = 200;
const WD = [0, DM], WC = [DM, NM], W15 = [DM, 180], W20 = [180, NM];
const HOUR = (t) => new Date(t * 1000).getUTCHours();
const r6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null), r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

// ---- trades: the cell exactly as council/edge-desks-2.mjs bigTrades selects it, through big-candle-fade's own trade() ----
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const KIND = { stop: 0, target: 1, time: 2 };
// rows: [fillT, R, mirrorR, fill, risk, exitAt, kind, mirrorExitAt, mirrorKind]
export function cellTrades(M5, market) {
  const F = frames(M5), cost = COSTS[market], X = exclusions(market), cap = FCAP['15m'], out = []; let mism = 0;
  for (const g of BIG.signals(F).big) {
    if (g.tf !== 0 || g.kmax < 0 || g.brk) continue;
    const fi0 = startIdx(M5, g.ts); if (fi0 >= M5.length) continue; const t = M5[fi0].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) continue;
    const r = BIG.trade(M5, g, cost); if (!r || r.skip || !Number.isFinite(r.ks[2])) continue;
    const s = r.s, tgt = r.fill + s * r.ks[2] * r.risk, mtgt = r.fill - s * r.ks[2] * r.risk;
    const x = exitWalk(M5, s, r.fi, r.stop, tgt, cap), y = exitWalk(M5, -s, r.fi, r.fill + s * r.risk, mtgt, cap);
    if (!x || !y || Math.abs(x.R - r.R[2]) > 1e-9 || Math.abs(y.R - r.M[2]) > 1e-9) { mism++; continue; }
    out.push([t, +r.R[2].toFixed(6), +r.M[2].toFixed(6), r.fill, +r.risk.toPrecision(8), x.at, KIND[x.kind], y.at, KIND[y.kind]]);
  }
  return { market, candles: M5.length, mism, trades: out };
}

// ---- measured spread by UTC hour -------------------------------------------------------------------------------------
const gitShow = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
export function profiles() {
  const out = {};
  for (const m of ['xau', 'xag']) { const s = PROFILE_SRC[m], j = JSON.parse(gitShow(s.commit, s.file));
    out[m] = { ...s, at: j.at, hours: j.hourProfile.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac, frac90: h.frac90 })) }; }
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, PROFILE_SRC.usdjpy.file), 'utf8'));
  out.usdjpy = { ...PROFILE_SRC.usdjpy, source: p.source, hours: p.markets.usdjpy.hours };
  return out;
}

// cost of one trade, as a share of price, then in R
export function costFrac(hours, inH, outH, kind, comm, key = 'frac') {
  const a = hours[inH][key], b = hours[outH][key];
  return 0.5 * a + 0.5 * b + comm + (kind === 0 ? 0.5 * b : 0);
}
export function charged(rows, hours, comm, { key = 'frac', mult = 1, mirror = false } = {}) {
  return rows.map((r) => { const R = mirror ? r[2] : r[1], outT = mirror ? r[7] : r[5], kind = mirror ? r[8] : r[6];
    const c = (costFrac(hours, HOUR(r[0]), HOUR(outT), kind, comm, key) * r[3]) / r[4];
    return { t: r[0], R, net: R - mult * c }; });
}
export const flat = (rows, cost) => rows.map((r) => ({ t: r[0], R: r[1], net: r[1] - cost / r[4] }));

export function stats(list, [ma, mb]) {
  const ms = new Float64Array(NM), mg = new Float64Array(NM); let n = 0, net = 0, gross = 0;
  for (const x of list) { const m = monthOf(x.t); if (m < ma || m >= mb) continue; n++; net += x.net; gross += x.R; ms[m] += x.net; mg[m] += x.R; }
  const t = n ? mstat(ms, ma, mb).t : null;
  return { n, mean: n ? r6(net / n) : null, t: r2(t), gross: n ? r6(gross / n) : null, tGross: n ? r2(mstat(mg, ma, mb).t) : null,
    costR: n ? r6((gross - net) / n) : null, p: t == null ? 1 : p1(t, mb - ma - 1) };
}

export function report(dir) {
  const D = Object.fromEntries(ALL.map((m) => [m, JSON.parse(fs.readFileSync(path.join(dir, `T-${m}.json`), 'utf8'))]));
  const P = profiles();
  // gate: the ten markets pooled, before costs, against big-candle-fade result.json
  const allRows = ALL.flatMap((m) => D[m].trades.map((r) => ({ t: r[0], R: r[1], net: r[1] })));
  const gd = stats(allRows, WD), gc = stats(allRows, WC);
  const gate = { d: { n: gd.n, mean: gd.gross }, c: { n: gc.n, mean: gc.gross }, want: GATE, mism: ALL.reduce((a, m) => a + D[m].mism, 0) };
  gate.ok = gate.mism === 0 && ['d', 'c'].every((w) => Math.abs(gate[w].n - GATE[w].n) <= 0.005 * GATE[w].n && Math.abs(gate[w].mean - GATE[w].mean) <= 0.005);
  const missing = MEASURED.flatMap((m) => P[m].hours.filter((h) => !Number.isFinite(h.frac)).map((h) => `${m} ${h.hour}`));
  const ch = (m, o) => charged(D[m].trades, P[m].hours, COMM[m], o);
  const sets = { xau: ch('xau'), xag: ch('xag'), usdjpy: ch('usdjpy') }; sets.pool = [...sets.xau, ...sets.xag, ...sets.usdjpy];
  const two = { xau: ch('xau', { mult: 2 }), xag: ch('xag', { mult: 2 }), usdjpy: ch('usdjpy', { mult: 2 }) }; two.pool = [...two.xau, ...two.xag, ...two.usdjpy];
  const mir = { xau: ch('xau', { mirror: true }), xag: ch('xag', { mirror: true }), usdjpy: ch('usdjpy', { mirror: true }) }; mir.pool = [...mir.xau, ...mir.xag, ...mir.usdjpy];
  const p90 = { xau: ch('xau', { key: 'frac90' }), xag: ch('xag', { key: 'frac90' }), usdjpy: ch('usdjpy', { key: 'frac90' }) }; p90.pool = [...p90.xau, ...p90.xag, ...p90.usdjpy];
  const keys = ['xau', 'xag', 'usdjpy', 'pool'];
  const tests = keys.map((k) => { const d = stats(sets[k], WD), c = stats(sets[k], WC), c2 = stats(two[k], WC);
    return { key: k, d, c, twoX: c2.mean, mirror: { d: stats(mir[k], WD).mean, c: stats(mir[k], WC), }, p90: { d: stats(p90[k], WD).mean, c: stats(p90[k], WC).mean, t: stats(p90[k], WC).t },
      halves: { h1519: stats(sets[k], W15), h2026: stats(sets[k], W20) },
      cond: c.n >= N_MIN && d.mean > 0 && c.mean > 0 && c.t >= 2 && c2.mean >= 0 }; });
  const holm = K.holm(tests.map((x) => x.c.p)); tests.forEach((x, i) => { x.holm = +holm[i].toPrecision(4); x.pass = x.cond && holm[i] < 0.05; });
  const ok = gate.ok && !missing.length;
  const passed = tests.filter((x) => x.pass).map((x) => x.key);
  const verdict = !ok ? 'INCONCLUSIVE' : passed.length ? 'PASS' : 'FAIL';
  const apart = APART.map((m) => { const rows = D[m].trades;
    const comm = rows.map((r) => ({ t: r[0], R: r[1], net: r[1] - (COMM[m] * r[3]) / r[4] }));
    const before = rows.map((r) => ({ t: r[0], R: r[1], net: r[1] }));
    return { market: m, n: { d: stats(before, WD).n, c: stats(before, WC).n }, before: { d: stats(before, WD).mean, c: stats(before, WC).mean, tc: stats(before, WC).t },
      flat: { cost: COSTS[m], d: stats(flat(rows, COSTS[m]), WD).mean, c: stats(flat(rows, COSTS[m]), WC).mean, tc: stats(flat(rows, COSTS[m]), WC).t },
      commOnly: { d: stats(comm, WD).mean, c: stats(comm, WC).mean, tc: stats(comm, WC).t } }; });
  const T = (k) => tests.find((x) => x.key === k), f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
  const name = { xau: 'gold', xag: 'silver', usdjpy: 'USD/JPY', pool: 'pooled' };
  const headline = verdict === 'INCONCLUSIVE' ? 'the gate or the spread measurement failed; nothing judged'
    : `${passed.length} of 4 tests pass; at the broker's measured hourly spreads the big-candle fade made ${f3(T('pool').c.mean)}R a trade pooled in 2015-26 (n ${T('pool').c.n}, month t ${T('pool').c.t}; before costs ${f3(T('pool').c.gross)}R), gold ${f3(T('xau').c.mean)}R (t ${T('xau').c.t}), silver ${f3(T('xag').c.mean)}R (t ${T('xag').c.t}), USD/JPY ${f3(T('usdjpy').c.mean)}R (t ${T('usdjpy').c.t})`;
  const slim = (s) => ({ n: s.n, mean: s.mean, t: s.t, gross: s.gross, tGross: s.tGross, costR: s.costR });
  const out = { study: 'bigfade-hourcost', built: '2026-11-24', verdict, headline, passed,
    rule: 'big-candle-fade m15 k1.5 nobreak half (imported signals() and trade(); the cell as council/edge-desks-2.mjs bigTrades)',
    cost: '0.5 x spread(entry hour) + 0.5 x spread(exit hour) + broker commission round trip, + 0.5 x spread(exit hour) on stop exits; share of price x fill',
    windows: { discovery: '2005-01 .. 2014-12', confirmation: '2015-01 .. 2026-10' }, commission: COMM, symbolsCommit: SYMBOLS_COMMIT,
    gate, missingHours: missing,
    profiles: Object.fromEntries(MEASURED.map((m) => [m, { commit: P[m].commit || null, file: P[m].file, kind: P[m].kind, at: P[m].at || null, hours: P[m].hours.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac, frac90: h.frac90 })) }])),
    tests: tests.map((x) => ({ key: x.key, d: slim(x.d), c: { ...slim(x.c), p: +x.c.p.toPrecision(4) }, twoX: x.twoX, mirror: { d: x.mirror.d, c: slim(x.mirror.c) },
      p90: x.p90, halves: { h1519: slim(x.halves.h1519), h2026: slim(x.halves.h2026) }, holm: x.holm, cond: x.cond, pass: x.pass })), apart };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, name, f3));
  return out;
}

function resultMd(o, name, f3) {
  const N = (x) => Math.round(x).toLocaleString('en-US');
  const L = ['# Big-candle fade at the demo broker\'s measured hourly spreads (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live',
    'changed, no rule is proposed. One run, no variants. These years were read by `big-candle-fade`: this is cost accounting on a',
    'rule already chosen. A before-cost tilt is not an edge.', '',
    '## What was run', '',
    '`big-candle-fade` cell `m15 k1.5 nobreak half` (the Equinox Big-candle fade desk) by its own `signals()` and `trade()`,',
    'selected as `council/edge-desks-2.mjs` `bigTrades` does; OANDA mid 5-minute candles, fills 2005-01 to 2026-10. Cost a trade:',
    'half the measured spread of the entry hour and of the exit hour, the broker\'s commission round trip, and on a stop exit another',
    `half spread of the exit hour (as \`fade-late-hourcost\`). Commission from council-data \`ctrader/symbols.json\` at ${o.symbolsCommit}.`, '',
    'Measured spread by UTC hour (median, share of price):', ''];
  for (const m of Object.keys(o.profiles)) { const p = o.profiles[m];
    L.push(`- ${name[m]}: ${p.kind}; ${p.commit ? `council-data ${p.commit} \`${p.file}\`` : `\`${p.file}\``}${p.at ? ` (probe of ${p.at.slice(0, 10)})` : ''}.`); }
  L.push('- No other market of the ten has a measured hourly spread (their `hourProfile` is empty): reported apart, not in the verdict.', '',
    '## Gate', '',
    `- Ten markets pooled, before costs: discovery n ${N(o.gate.d.n)}, ${f3(o.gate.d.mean)}R (study ${N(o.gate.want.d.n)}, +${o.gate.want.d.mean.toFixed(3)}R);`,
    `  confirmation n ${N(o.gate.c.n)}, ${f3(o.gate.c.mean)}R (study ${N(o.gate.want.c.n)}, +${o.gate.want.c.mean.toFixed(3)}R); ${o.gate.mism} trades where the exit walk differs from \`exits()\`: ${o.gate.ok ? 'passed' : 'FAILED'}.`,
    `- Hours with no measured spread: ${o.missingHours.length ? o.missingHours.join(', ') : 'none'}.`, '',
    '## Tests (after measured costs)', '',
    '| Test | n 05-14 | net 05-14 (before) | n 15-26 | net 15-26 (t) | before 15-26 (t) | cost R | 2x cost 15-26 | Holm p | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const x of o.tests) L.push(`| ${name[x.key]} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f3(x.d.gross)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${x.c.t}) | ${f3(x.c.gross)} (${x.c.tGross}) | ${x.c.costR.toFixed(3)} | ${f3(x.twoX)} | ${x.holm < 0.001 ? x.holm.toExponential(1) : x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', 'Month-sum t on calendar months (empty months 0). Pass = n >= 200 in 2015-26, net > 0 in both windows, month t >= 2 in 2015-26,',
    'Holm-adjusted one-sided p < 0.05 over the 4 tests, net at 2 x the measured cost >= 0 in 2015-26.', '',
    '## Control and sensitivity (reported, not judged)', '',
    '| Test | mirror net 05-14 | mirror net 15-26 (t) | 90th pct spread net 05-14 | 90th pct net 15-26 (t) | 2015-19 net (n) | 2020-26 net (n) |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const x of o.tests) L.push(`| ${name[x.key]} | ${f3(x.mirror.d)} | ${f3(x.mirror.c.mean)} (${x.mirror.c.t}) | ${f3(x.p90.d)} | ${f3(x.p90.c)} (${x.p90.t}) | ${f3(x.halves.h1519.mean)} (${N(x.halves.h1519.n)}) | ${f3(x.halves.h2026.mean)} (${N(x.halves.h2026.n)}) |`);
  L.push('', 'Mirror = the same trade WITH the candle (its exit at the cell\'s 50 % distance), same measured cost.', '',
    '## Markets without a measured spread (apart, not in the verdict)', '',
    '| Market | n 05-14 / 15-26 | before 05-14 / 15-26 (t) | flat COSTS (price) | after flat 05-14 / 15-26 (t) | commission only 05-14 / 15-26 (t) |', '|---|---:|---:|---:|---:|---:|');
  for (const a of o.apart) L.push(`| ${a.market} | ${N(a.n.d)} / ${N(a.n.c)} | ${f3(a.before.d)} / ${f3(a.before.c)} (${a.before.tc}) | ${a.flat.cost} | ${f3(a.flat.d)} / ${f3(a.flat.c)} (${a.flat.tc}) | ${f3(a.commOnly.d)} / ${f3(a.commOnly.c)} (${a.commOnly.tc}) |`);
  L.push('', 'Commission only is a floor no real spread is below, not a cost estimate. Flat COSTS are ASSUMED for nzdusd, usdcad, usdchf, eurjpy.', '',
    '## Measured spread by UTC hour (median, share of price x 10^5)', '', '| Hour | gold | silver | USD/JPY |', '|---:|---:|---:|---:|');
  for (let h = 0; h < 24; h++) L.push(`| ${String(h).padStart(2, '0')} | ${(o.profiles.xau.hours[h].frac * 1e5).toFixed(2)} | ${(o.profiles.xag.hours[h].frac * 1e5).toFixed(2)} | ${(o.profiles.usdjpy.hours[h].frac * 1e5).toFixed(2)} |`);
  const T = (k) => o.tests.find((x) => x.key === k);
  L.push('', '## What it means', '',
    `Before costs the cell is positive on all three measured markets in 2015-26 (pooled ${f3(T('pool').c.gross)}R, month t ${T('pool').c.tGross}).`,
    `At the broker's measured spread and commission it is not: the measured cost is ${T('xau').c.costR.toFixed(3)}R a trade on gold,`,
    `${T('xag').c.costR.toFixed(3)}R on silver and ${T('usdjpy').c.costR.toFixed(3)}R on USD/JPY, more than the tilt everywhere. Gold is the`,
    `nearest (2015-26 ${f3(T('xau').c.mean)}R, t ${T('xau').c.t}; 2020-26 ${f3(T('xau').halves.h2026.mean)}R) and fails at 2 x cost (${f3(T('xau').twoX)}R).`,
    'On USD/JPY the quoted spread is about zero, so the cost is almost all commission: the cell\'s stop is a few pips and the',
    'commission alone takes about a third of R. The same holds for the forex markets without a measured spread: commission',
    'alone (no spread at all) leaves 6 of 7 negative in 2015-26. The desk\'s rule is a before-cost tilt, not an edge, on this account.');
  L.push('', '## Limits', '',
    '- Spreads were measured on 2023-26 quotes and applied to 2005-26 as a share of price; earlier years\' relative spreads are unknown',
    '  (probably wider, so the discovery window is, if anything, charged too little).',
    '- OANDA mid candles, not fills: `fade-tick-exec` found real fills about 0.02R a trade worse than mid on a similar fade, on top.',
    '- The trade set keeps the study\'s skip of trades whose risk is under its flat round trip (`COSTS`): the cell as defined.',
    '- These years were read by `big-candle-fade`, which chose the cell: a PASS would only be a hypothesis for a forward paper record.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === 'trades') { fs.mkdirSync(a2, { recursive: true });
  const M5 = K.load(a1, '5m', { from: '2004-01-01', to: '2026-11-01' }); const r = cellTrades(M5, a1);
  fs.writeFileSync(path.join(a2, `T-${a1}.json`), JSON.stringify(r)); console.log(a1, r.trades.length, 'trades, mism', r.mism); }
else if (cmd === 'report') { const o = report(a1); console.log(o.verdict, o.headline); }
}
