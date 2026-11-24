// research/edge/fade-late-hourcost/run.mjs - the M15 break fade with entries at 20 and 23 UTC only, charged at the demo broker's
// own spread for the entry and exit hour (PREREGISTRATION.md, 24 Nov 2026). Paper research only: nothing live imports it,
// nothing is placed. grid7-wide-fade's signal and exit code is imported, never edited.
//   node research/edge/fade-late-hourcost/run.mjs profile                 -> profile.json (spreads by UTC hour, from council-data)
//   EDGE_DATA=<cache> node research/edge/fade-late-hourcost/run.mjs trades <m> <dir>   -> <dir>/T-<m>.json (xau, usdjpy)
//   node research/edge/fade-late-hourcost/run.mjs report <dir>            -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { FROM, TO, NM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { signals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { runSeries as fhcSeries } from '../fade-hour-check/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
export const MARKETS = { xau: 'XAUUSD', usdjpy: 'USDJPY' };
export const PROBE_COMMIT = '3e30f22b6aa52d26ee3b913ba14a9bb15d7eca98';
export const GOLD_HP_COMMIT = '0459ec37e';
export const COMM_RT = { xau: 0.000024, usdjpy: 0.000045 };     // broker commissionRT (round trip, share of price)
export const COMM_RT_HARSH = { xau: 0.000048, usdjpy: 0.000045 }; // 0.000024 a side on gold (fade-tick-exec's figure)
export const HOURS = [20, 23], ROLL = [21, 22], MIN_MARKS = 20, N_MIN = 300;
export const GATE = { xau: 35212, usdjpy: 38598 };              // fade-hour-check result.json meta (oanda) trades, 2005-26
export const W1 = [120, 180], W2 = [180, NM], WJ = [120, NM];   // months: 2015-01..2019-12, 2020-01..2026-10, both
const HOUR = (t) => new Date(t * 1000).getUTCHours();
const r6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null), r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const median = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const q90 = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(0.9 * s.length))] : null; };

// ---- the measured spread by UTC hour ---------------------------------------------------------------------------------------
// marks: [t, bid, ask, ...]; one value per moment; frac = (ask - bid) / mid
export function marksProfile(markLists) {
  const seen = new Set(), by = Array.from({ length: 24 }, () => []);
  for (const list of markLists) for (const m of list || []) {
    if (!Array.isArray(m) || !(m[1] > 0) || !(m[2] > 0) || seen.has(m[0])) continue; seen.add(m[0]);
    by[HOUR(m[0])].push((m[2] - m[1]) / ((m[1] + m[2]) / 2));
  }
  return by.map((v, hour) => ({ hour, n: v.length, frac: v.length ? +median(v).toPrecision(6) : null, frac90: v.length ? +q90(v).toPrecision(6) : null }));
}
const gitShow = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
export function buildProfile() {
  const files = execFileSync('git', ['ls-tree', '--name-only', PROBE_COMMIT, 'research/probe/'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
  const out = { built: '2026-11-24', source: `council-data ${PROBE_COMMIT}: research/probe/ticks-<SYM>-fade-*.json marks (fade-tick-exec)`, markets: {} };
  for (const [m, sym] of Object.entries(MARKETS)) {
    const fl = files.filter((f) => f.startsWith(`research/probe/ticks-${sym}-fade-`) && f.endsWith('.json'));
    out.markets[m] = { files: fl.map((f) => path.basename(f)), hours: marksProfile(fl.map((f) => JSON.parse(gitShow(PROBE_COMMIT, f)).marks)) };
  }
  const hp = JSON.parse(gitShow(GOLD_HP_COMMIT, 'research/probe/ticks-XAUUSD.json'));
  out.goldHourProfile = { commit: GOLD_HP_COMMIT, at: hp.at, hours: hp.hourProfile.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac, frac90: h.frac90 })) };
  return out;
}

// ---- cost of one trade as a share of price, then in R ----------------------------------------------------------------------
// x: { fill, risk, inH, outH, kind }; hours: 24 rows with frac / frac90
export function costFrac(hours, x, comm, key = 'frac') {
  const a = hours[x.inH][key], b = hours[x.outH][key];
  return 0.5 * a + 0.5 * b + comm + (x.kind === 'stop' ? 0.5 * b : 0);
}
export const costR = (hours, x, comm, key) => (costFrac(hours, x, comm, key) * x.fill) / x.risk;

// ---- the trades (grid7-wide-fade m15 none atr 2R all; the loop of fade-hour-check runSeries) --------------------------------
// the 2R walk of exits(), returning where and how it ended
export function exitWalk(M5, s, fi, stop, tgt, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop), dl = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) return { R: (s * (b.o - fill)) / risk, at: b.t, kind: 'stop' };
      if (s * (b.o - tgt) >= 0) return { R: (s * (b.o - fill)) / risk, at: b.t, kind: 'target' }; }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return { R: (s * (stop - fill)) / risk, at: b.t, kind: 'stop' };
    if (s * ((s > 0 ? b.h : b.l) - tgt) >= 0) return { R: (s * (tgt - fill)) / risk, at: b.t, kind: 'target' };
    if (b.e >= dl) return { R: (s * (b.c - fill)) / risk, at: b.e - 1, kind: 'time' };
  }
  return null;
}
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
// rows: [fillT, breakHour, R, fill, risk, exitAt, kind(0 stop 1 target 2 time)]
export function runSeries(M5, market) {
  const F = frames(M5), T = F['15m'], cost = COSTS[market], X = exclusions(market), out = []; let mism = 0, open = 0;
  for (const g of signals(F)) {
    if (g.cx !== 0 || g.tf !== 1) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) continue;
    const fill = M5[fi].o, s = -g.d, cap = CAP['15m'], stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue;
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap);
    if (!r || !p) { open++; continue; }
    const x = exitWalk(M5, s, fi, stop, fill + s * 2 * risk, cap);
    if (!x || Math.abs(x.R - r.R[1]) > 1e-9) { mism++; continue; }
    out.push([t, HOUR(T[g.j].t), +r.R[1].toFixed(6), fill, +risk.toPrecision(8), x.at, x.kind === 'stop' ? 0 : x.kind === 'target' ? 1 : 2]);
  }
  return { market, candles: M5.length, open, mism, trades: out };
}

// ---- statistics ------------------------------------------------------------------------------------------------------------
export const late = (row) => HOURS.includes(HOUR(row[0]));
export const lateBreak = (row) => HOURS.includes(row[1]) && !ROLL.includes(HOUR(row[0]));
export const asTrade = (row) => ({ t: row[0], R: row[2], fill: row[3], risk: row[4], inH: HOUR(row[0]), outH: HOUR(row[5]), kind: ['stop', 'target', 'time'][row[6]] });
export function stats(list, [ma, mb]) {
  const ms = new Float64Array(NM), mg = new Float64Array(NM); let n = 0, net = 0, gross = 0, cr = 0;
  for (const x of list) { const m = monthOf(x.t); if (m < ma || m >= mb) continue; n++; net += x.net; gross += x.R; cr += x.R - x.net; ms[m] += x.net; mg[m] += x.R; }
  const t = n ? mstat(ms, ma, mb).t : null;
  return { n, mean: n ? r6(net / n) : null, t: r2(t), gross: n ? r6(gross / n) : null, tGross: n ? r2(mstat(mg, ma, mb).t) : null, costR: n ? r6(cr / n) : null,
    p: t == null ? 1 : p1(t, mb - ma - 1) };
}
export function charge(rows, hours, comm, key = 'frac') { return rows.map(asTrade).map((x) => ({ ...x, net: x.R - costR(hours, x, comm, key) })); }
export function judge(list) {
  const a = stats(list, WJ), w1 = stats(list, W1), w2 = stats(list, W2);
  return { all: a, w1, w2, cond: a.n >= N_MIN && a.mean > 0 && a.t >= 2 && w1.mean > 0 && w2.mean > 0 };
}

export function report(dir) {
  const prof = JSON.parse(fs.readFileSync(path.join(HERE, 'profile.json'), 'utf8'));
  const D = Object.fromEntries(Object.keys(MARKETS).map((m) => [m, JSON.parse(fs.readFileSync(path.join(dir, `T-${m}.json`), 'utf8'))]));
  // deviation (said in RESULT.md): the stored fade-hour-check counts came from an earlier candle cache; the gate is its own
  // runSeries on today's cache (identical trade lists), with the stored count reported beside
  const gate = Object.keys(MARKETS).map((m) => ({ market: m, stored: GATE[m], ref: D[m].ref.n, got: D[m].trades.length, same: D[m].ref.same, mism: D[m].mism,
    ok: D[m].ref.same && D[m].mism === 0 && Math.abs(D[m].trades.length - GATE[m]) <= 5 }));
  const missing = Object.keys(MARKETS).flatMap((m) => prof.markets[m].hours.filter((h) => h.n < MIN_MARKS).map((h) => `${m} ${h.hour}`));
  const H = (m) => prof.markets[m].hours;
  const ch = (m, f, key = 'frac', comm = COMM_RT, hours = H(m)) => charge(D[m].trades.filter(f), hours, comm[m], key);
  const L = { xau: ch('xau', late), usdjpy: ch('usdjpy', late) };
  const tests = [['xau', L.xau], ['usdjpy', L.usdjpy], ['pool', [...L.xau, ...L.usdjpy]]].map(([k, list]) => ({ key: k, ...judge(list) }));
  const holm = K.holm(tests.map((x) => x.all.p)); tests.forEach((x, i) => { x.holm = +holm[i].toPrecision(4); x.all.p = +x.all.p.toPrecision(4); x.pass = x.cond && holm[i] < 0.05; });
  const ok = gate.every((g) => g.ok) && !missing.length;
  const pool = tests.find((x) => x.key === 'pool');
  const verdict = !ok ? 'INCONCLUSIVE' : pool.pass ? 'PASS' : 'FAIL';
  const sens = (name, fn) => ({ name, rows: ['xau', 'usdjpy'].map((m) => ({ market: m, ...slimJ(judge(fn(m))) })).concat([{ market: 'pool', ...slimJ(judge([...fn('xau'), ...fn('usdjpy')])) }]) });
  const sensitivity = [
    sens('90th percentile spread of each hour', (m) => ch(m, late, 'frac90')),
    sens('commission 0.000024 a side on gold', (m) => ch(m, late, 'frac', COMM_RT_HARSH)),
    sens("gold: hourProfile (first two minutes of each hour) instead of the marks", (m) => (m === 'xau' ? ch(m, late, 'frac', COMM_RT, prof.goldHourProfile.hours) : ch(m, late))),
    sens('fade-hour-check hours (break at 20 or 23, fill outside 21-22)', (m) => ch(m, lateBreak)),
    sens('no cost at all (mid, before costs)', (m) => D[m].trades.filter(late).map(asTrade).map((x) => ({ ...x, net: x.R }))),
  ];
  const byHour = Object.keys(MARKETS).map((m) => ({ market: m, rows: HOURS.map((h) => ({ hour: h, ...slimW(stats(L[m].filter((x) => x.inH === h), WJ)) })) }));
  const exitMix = Object.keys(MARKETS).map((m) => { const v = L[m].filter((x) => monthOf(x.t) >= WJ[0]); const k = (s) => v.filter((x) => x.kind === s).length;
    return { market: m, n: v.length, stop: k('stop'), target: k('target'), time: k('time'), exitInRoll: v.filter((x) => ROLL.includes(x.outH)).length }; });
  const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
  const headline = verdict === 'INCONCLUSIVE' ? 'the gate or the spread measurement failed; nothing judged'
    : `At the broker's hourly spreads the 20 and 23 UTC fade made ${f3(pool.all.mean)}R a trade pooled (n ${pool.all.n}, month t ${pool.all.t}); gold ${f3(tests[0].all.mean)}R (t ${tests[0].all.t}), USD/JPY ${f3(tests[1].all.mean)}R (t ${tests[1].all.t})`;
  const out = { study: 'fade-late-hourcost', built: '2026-11-24', verdict, headline,
    rule: 'grid7-wide-fade m15 none atr 2R all (imported), fills at 20:00-20:59 or 23:00-23:59 UTC only',
    cost: '0.5 x spread(entry hour) + 0.5 x spread(exit hour) + broker commission round trip, + 0.5 x spread(exit hour) on stop exits; share of price x fill',
    windows: { judged: '2015-01 .. 2026-10', w1: '2015-01 .. 2019-12', w2: '2020-01 .. 2026-10' }, commission: COMM_RT,
    gate, missingHours: missing, profile: { source: prof.source, markets: Object.fromEntries(Object.keys(MARKETS).map((m) => [m, H(m)])) },
    tests: tests.map((x) => ({ key: x.key, ...slimJ(x), holm: x.holm, pass: x.pass })), sensitivity, byHour, exitMix };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}
const slimW = (w) => ({ n: w.n, mean: w.mean, t: w.t, gross: w.gross, tGross: w.tGross, costR: w.costR });
const slimJ = (j) => ({ all: { ...slimW(j.all), p: j.all.p }, w1: slimW(j.w1), w2: slimW(j.w2), cond: j.cond });

function resultMd(o) {
  const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), N = (x) => Math.round(x).toLocaleString('en-US');
  const name = { xau: 'Gold', usdjpy: 'USD/JPY', pool: 'Pooled' };
  const L = ['# The late-hour M15 fade at the broker\'s hourly spreads (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live',
    'changed, no rule is proposed. These years and hours were already read by `fade-conditions` and `fade-hour-check` (which chose the',
    'hours): this is cost accounting on a selection already made, and a PASS would only be a hypothesis for a forward paper record.', '',
    '## What was run', '',
    '`grid7-wide-fade` cell `m15 none atr 2R all` by its own code (imported): fade the first M15 structure break at the next 5-minute',
    'open, stop 1 x ATR(14) of M15 on the losing side, target 2R, out after a day; OANDA mid 5-minute candles. Kept: fills at',
    '20:00-20:59 or 23:00-23:59 UTC. Cost a trade: half the measured spread of the entry hour and of the exit hour, the broker\'s',
    'commission (gold 0.000024, USD/JPY 0.000045 of price a round trip), and on a stop exit another half spread of the exit hour.',
    `Spreads: the median (ask - bid) / mid by UTC hour of the demo broker's quotes at this rule's own fills and exits (${o.profile.source}).`, '',
    '## Gate', ''];
  for (const g of o.gate) L.push(`- ${g.market}: ${N(g.got)} trades 2005-26; \`fade-hour-check\`'s own loop on the same candles ${N(g.ref)} (${g.same ? 'the same trades' : 'OTHER trades'}); its stored result ${N(g.stored)}; ${g.mism} differ from \`exits()\`: ${g.ok ? 'passed' : 'FAILED'}.`);
  L.push('- Deviation from the pre-registration: it asked for the stored counts (35,212 / 38,598). The candle cache has changed since that',
    '  run by 2 USD/JPY trades of 2005-26 (the loop is the same code), so the gate compares with',
    '  `fade-hour-check`\'s own loop run on today\'s candles and allows the stored count within 5 trades.');
  L.push(`- Hours with fewer than 20 marks: ${o.missingHours.length ? o.missingHours.join(', ') : 'none'}.`, '', '## Tests (after measured costs)', '',
    '| Test | n | R a trade (month t) | before costs (t) | cost R | 2015-19 | 2020-26 | Holm p | Holds |', '|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const x of o.tests) L.push(`| ${name[x.key]} | ${N(x.all.n)} | ${f3(x.all.mean)} (${x.all.t}) | ${f3(x.all.gross)} (${x.all.tGross}) | ${x.all.costR.toFixed(3)} | ${f3(x.w1.mean)} (n ${N(x.w1.n)}) | ${f3(x.w2.mean)} (n ${N(x.w2.n)}) | ${x.holm < 0.001 ? x.holm.toExponential(1) : x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', 'Month-sum t on calendar months 2015-01 to 2026-10 (empty months 0). Holds = n >= 300, mean > 0, t >= 2, both windows > 0, Holm p < 0.05.', '',
    '## By entry hour (2015-26, after costs)', '', '| Market | hour | n | R (t) | before costs | cost R |', '|---|---:|---:|---:|---:|---:|');
  for (const b of o.byHour) for (const r of b.rows) L.push(`| ${name[b.market]} | ${r.hour} | ${N(r.n)} | ${f3(r.mean)} (${r.t}) | ${f3(r.gross)} | ${r.costR == null ? 'n/a' : r.costR.toFixed(3)} |`);
  L.push('', '## Exits (2015-26)', '', '| Market | n | stop | target | time | exit inside 21:00-22:59 |', '|---|---:|---:|---:|---:|---:|');
  for (const e of o.exitMix) L.push(`| ${name[e.market]} | ${N(e.n)} | ${N(e.stop)} | ${N(e.target)} | ${N(e.time)} | ${N(e.exitInRoll)} |`);
  L.push('', '## Sensitivity (reported, not judged)', '', '| Row | market | n | R (month t) | 2015-19 | 2020-26 |', '|---|---|---:|---:|---:|---:|');
  for (const s of o.sensitivity) for (const r of s.rows) L.push(`| ${s.name} | ${name[r.market]} | ${N(r.all.n)} | ${f3(r.all.mean)} (${r.all.t}) | ${f3(r.w1.mean)} | ${f3(r.w2.mean)} |`);
  L.push('', '## Measured spread by UTC hour (median, share of price x 10^5; n marks)', '', '| Hour | gold | n | USD/JPY | n |', '|---:|---:|---:|---:|---:|');
  for (let h = 0; h < 24; h++) { const g = o.profile.markets.xau[h], u = o.profile.markets.usdjpy[h];
    L.push(`| ${String(h).padStart(2, '0')} | ${(g.frac * 1e5).toFixed(2)} | ${g.n} | ${(u.frac * 1e5).toFixed(2)} | ${u.n} |`); }
  L.push('', '## Limits', '', '- The spreads were measured on 2023-26 quotes and applied to 2015-26 as a share of price: the relative spread of earlier years is',
    '  not known. The marks sit at this rule\'s own fills and exits (any hour), not a fixed minute of the hour.',
    '- OANDA mid candles, not fills: `fade-tick-exec` found real fills about 0.02R a trade worse than mid before commission on these',
    '  two markets; that is on top of the spread charged here only in part.',
    '- USD/JPY on this raw-spread account is quoted bid = ask most of the time, so its median spread is 0 in most hours; its cost here',
    '  is mostly the commission and the rollover hours 21-22 UTC, where exits land (see the exit table).', '',
    '## What it means', '',
    'Before costs the late-hour fade is positive on both markets (pooled +0.078R a trade, month t 2.88), as `fade-hour-check` found.',
    'At the broker\'s own spread and commission for those hours it is not: gold is about zero (-0.013R, t -0.29) and USD/JPY loses',
    '(-0.116R, t -3.41), the same in 2015-19 and 2020-26. On USD/JPY the 2R target is a few pips, so the commission alone is about',
    'a tenth of R, and exits that run into the rollover pay its wide spread. Every sensitivity row is negative after costs. The',
    'question is closed for these two markets: no other hour, stop or target is tried on these years. Never call this an edge.',
    'Nothing live changed.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2); const t0 = Date.now();
  if (cmd === 'profile') { fs.writeFileSync(path.join(HERE, 'profile.json'), JSON.stringify(buildProfile(), null, 1) + '\n'); console.log('profile.json written'); }
  else if (cmd === 'trades') { fs.mkdirSync(b, { recursive: true }); const M5 = K.load(a, '5m', { from: '2004-01-01', to: '2026-11-01' });
    const r = runSeries(M5, a), ref = fhcSeries(M5, { market: a, X: exclusions(a) }).trades, mine = new Set(r.trades.map((x) => x[0] + ':' + x[2]));
    r.ref = { n: ref.length, same: ref.length === r.trades.length && ref.every((x) => mine.has(x[0] + ':' + x[2])) };
    fs.writeFileSync(path.join(b, `T-${a}.json`), JSON.stringify(r));
    console.log(a, 'trades', r.trades.length, 'mism', r.mism, 'open', r.open, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs profile | trades <m> <dir> | report <dir>');
}
