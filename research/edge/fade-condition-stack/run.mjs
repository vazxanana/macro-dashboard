// research/edge/fade-condition-stack/run.mjs - the conditions the fade studies named, stacked on the three Equinox fade rules and
// charged at the demo broker's measured hourly spreads (PREREGISTRATION.md, 24 Nov 2026). Paper research only: nothing live
// imports it, nothing is placed. The rules come from council/edge-desks-2.mjs (each study's own signal code, imported, never edited).
//   node research/edge/fade-condition-stack/run.mjs profile                     -> profile.json (xau / usdjpy / xag spreads by UTC hour)
//   EDGE_DATA=<cache> node research/edge/fade-condition-stack/run.mjs market <m> <dir>   -> <dir>/T-<m>.json
//   EDGE_DATA=<cache> node research/edge/fade-condition-stack/run.mjs cut <m> <dir>      -> <dir>/C-<m>.json
//   node research/edge/fade-condition-stack/run.mjs report <dir>                -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14 } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { volLevel, dowLevel } from '../fade-conditions/run.mjs';
import { costFrac } from '../fade-late-hourcost/run.mjs';
import { fadeTrades, bigTrades, boxTrades } from '../../../council/edge-desks-2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
export const RULES = [
  { key: 'fade', name: 'Break fade (grid7-wide-fade m15 none atr 2R all)', read: fadeTrades, sec: 900 },
  { key: 'big', name: 'Big-candle fade (big-candle-fade m15 k1.5 nobreak half)', read: bigTrades, sec: 900 },
  { key: 'box', name: 'Box fade (fade-breaks-holdout F1)', read: boxTrades, sec: 300 },
];
export const JUDGED = ['xau', 'usdjpy', 'xag'];
export const OTHERS = ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED_FLAT = ['nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const COMM_RT = { xau: 0.000024, usdjpy: 0.000045, xag: 0.000024 };   // xag ASSUMED (gold's)
export const XAG_COMMIT = '19c2477d5b';
export const STACKS = ['S0', 'S1', 'S2', 'S3', 'P1'];   // S0 = control (no stack), P1 = placebo (S1's shape at 08-11)
export const GATE = { xau: 35212, usdjpy: 38596 };
export const N_MIN = 200;
const HOUR = (t) => new Date(t * 1000).getUTCHours();
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : null);

// ---- the stacks (pure): sigT = signal candle start, fillT, vol level (0 low 1 mid 2 high, -1 none), dow level (0 = Monday) ----
export function stackOf(x) {
  const sh = HOUR(x.sigT), fh = HOUR(x.fillT), noRoll = fh !== 21 && fh !== 22;
  const s1 = sh >= 20 && sh <= 23 && noRoll, s2 = s1 && x.vol === 0, s3 = s2 && x.dow === 0, p1 = sh >= 8 && sh <= 11 && noRoll;
  return { S0: true, S1: s1, S2: s2, S3: s3, P1: p1 };
}

// ---- spreads by UTC hour ------------------------------------------------------------------------------------------------
const gitShow = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
export function buildProfile() {
  const fl = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'fade-late-hourcost', 'profile.json'), 'utf8'));
  const xag = JSON.parse(gitShow(XAG_COMMIT, 'research/probe/ticks-XAGUSD.json'));
  return { built: '2026-11-24',
    sources: { xau: 'fade-late-hourcost/profile.json (broker quotes at the fade\'s fills and exits)', usdjpy: 'fade-late-hourcost/profile.json',
      xag: `council-data ${XAG_COMMIT}: research/probe/ticks-XAGUSD.json hourProfile (first two minutes of each UTC hour), at ${xag.at}` },
    hours: { xau: fl.markets.xau.hours.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac })),
      usdjpy: fl.markets.usdjpy.hours.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac })),
      xag: xag.hourProfile.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac })) } };
}

// ---- one market -----------------------------------------------------------------------------------------------------------
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const desk = (M5) => M5.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// tag records of a rule with the conditions known at the signal's close (closed candles only)
export function tagRecords(recs, rule, T15, atr) {
  return recs.map((r) => {
    const sigEnd = r.log[0].t, sigT = sigEnd - rule.sec, j = K.closedCount(T15, sigEnd) - 1;
    return { sigT, fillT: r.t, vol: j >= 0 ? volLevel(atr, j) : -1, dow: dowLevel(sigT), r };
  });
}

// rows: [rule, fillT, sigT, R, costR (flat or measured), vol, dow, exitT, kind (0 stop 1 target 2 time)]
export function runMarket(market, { to = '2026-11-01' } = {}) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to }), B = { '5m': desk(M5) }, F = frames(M5), T15 = F['15m'], atr = atr14(T15);
  const prof = JUDGED.includes(market) ? JSON.parse(fs.readFileSync(path.join(HERE, 'profile.json'), 'utf8')).hours[market] : null;
  const X = exclusions(market), rows = [], counts = {};
  RULES.forEach((rule, ri) => {
    const recs = rule.read(B, { from: FROM, market }); let n = 0, open = 0, excl = 0;
    for (const x of tagRecords(recs, rule, T15, atr)) { const r = x.r;
      if (r.status === 'open') { open++; continue; }
      if (r.t < FROM || r.t >= TO) continue;
      if (X.length && inBad(X, r.t)) { excl++; continue; }
      const s = r.side, risk = s * (r.entry - r.stop); if (!(risk > 0)) throw new Error('stop on the wrong side ' + r.id);
      const kind = r.status === 'stopped' ? 'stop' : r.status === 'target' ? 'target' : 'time';
      const cR = prof ? (costFrac(prof, { inH: HOUR(r.t), outH: HOUR(r.endT), kind }, COMM_RT[market]) * r.entry) / risk : COSTS[market] / risk;
      rows.push([ri, r.t, x.sigT, r4(r.R), r4(cR), x.vol, x.dow, r.endT, kind === 'stop' ? 0 : kind === 'target' ? 1 : 2]); n++; }
    counts[rule.key] = { kept: n, open, excl };
  });
  return { market, measured: !!prof, assumed: ASSUMED_FLAT.includes(market), cost: COSTS[market], counts, rows };
}

// ---- cut test: the tags of the records filled by a date equal on candles cut there -----------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2013-03-13', '2019-09-18', '2024-05-08']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const tagsOf = (bars) => { const B = { '5m': desk(bars) }, F = frames(bars), T15 = F['15m'], atr = atr14(T15), out = new Map();
    RULES.forEach((rule) => { for (const x of tagRecords(rule.read(B, { from: FROM, market }), rule, T15, atr))
      out.set(`${rule.key}|${x.fillT}|${x.r.side}`, [x.sigT, x.vol, x.dow, JSON.stringify(stackOf(x))].join('|')); });
    return out; };
  const full = tagsOf(M5), res = [];
  for (const c of cuts) { const tc = Date.parse(c + 'T00:00:00Z') / 1000, cut = M5.filter((b) => b.e <= tc), part = tagsOf(cut);
    let n = 0, diff = 0; for (const [k, v] of part) { const fillT = +k.split('|')[1]; if (fillT >= tc - 86400) continue; n++; if (full.get(k) !== v) diff++; }
    res.push({ cut: c, n, diff }); }
  return { market, cuts: res };
}

// ---- statistics -----------------------------------------------------------------------------------------------------------
function cell(rows, net) {
  const ms = new Float64Array(NM), w = [{ n: 0, s: 0, b: 0 }, { n: 0, s: 0, b: 0 }];
  for (const x of rows) { const R = x[3], v = net ? R - x[4] : R, k = x[1] < SPLIT ? 0 : 1; w[k].n++; w[k].s += v; w[k].b += R; ms[monthOf(x[1])] += v; }
  const d = mstat(ms, 0, DM), c = mstat(ms, DM, NM);
  return { n1: w[0].n, m1: w[0].n ? w[0].s / w[0].n : null, t1: d.t, n2: w[1].n, m2: w[1].n ? w[1].s / w[1].n : null, t2: c.t, months2: c.months };
}
export function pOne(t, df) { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; }
export function summarize(markets) {
  const out = { judged: {}, others: {} };
  for (const [grp, list] of [['judged', JUDGED], ['others', OTHERS]]) {
    const have = markets.filter((m) => list.includes(m.market)); if (!have.length) continue;
    RULES.forEach((rule, ri) => { for (const st of STACKS) {
      const per = have.map((m) => [m.market, m.rows.filter((x) => x[0] === ri && stackOf({ sigT: x[2], fillT: x[1], vol: x[5], dow: x[6] })[st])]);
      const rows = per.flatMap((p) => p[1]);
      out[grp][`${rule.key}|${st}`] = { gross: cell(rows, false), net: cell(rows, true),
        byMarket: Object.fromEntries(per.map(([m, r]) => [m, cell(r, true)])) }; } });
  }
  return out;
}
export function judge(S) {
  const tests = [];
  for (const rule of RULES) for (const st of ['S1', 'S2', 'S3']) {
    const c = S.judged[`${rule.key}|${st}`], ctl = S.judged[`${rule.key}|S0`];
    tests.push({ rule: rule.key, stack: st, n2: c.net.n2, m1: c.net.m1, m2: c.net.m2, t2: c.net.t2, p: pOne(c.net.t2, c.net.months2 - 1), ctl2: ctl.net.m2 }); }
  const holm = K.holm(tests.map((x) => x.p));
  tests.forEach((x, i) => { x.holm = holm[i]; x.pass = x.m1 > 0 && x.m2 > 0 && x.n2 >= N_MIN && x.holm < 0.05 && x.m2 > x.ctl2; });
  return tests;
}

// ---- report ---------------------------------------------------------------------------------------------------------------
const f3 = (x) => (x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(3)), f2 = (x) => (x == null ? '-' : x.toFixed(2)), nn = (x) => x.toLocaleString('en-GB');
const SNAME = { S0: 'control (no stack)', S1: 'S1 evening, no rollover', S2: 'S2 = S1 + low vol', S3: 'S3 = S2 + Monday', P1: 'placebo: 08-11, no rollover' };
export function report(dir) {
  const markets = [...JUDGED, ...OTHERS].filter((m) => fs.existsSync(path.join(dir, `T-${m}.json`))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, `T-${m}.json`), 'utf8')));
  const cuts = [...JUDGED].filter((m) => fs.existsSync(path.join(dir, `C-${m}.json`))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, `C-${m}.json`), 'utf8')));
  const gate = Object.entries(GATE).map(([m, want]) => { const d = markets.find((x) => x.market === m); const got = d ? d.counts.fade.kept : null;
    return { market: m, want, kept: got, ok: got != null && Math.abs(got - want) <= 5 }; });
  const S = summarize(markets), tests = judge(S), gateOk = gate.every((g) => g.ok);
  const npass = tests.filter((x) => x.pass).length, best = [...tests].sort((a, b) => b.m2 - a.m2)[0];
  const verdict = !gateOk ? 'INCONCLUSIVE' : npass ? 'PASS' : 'FAIL';
  const head = `**Verdict: ${verdict}. ${npass} of 9 stacked tests pass after the measured costs; best confirmation reading ${best.rule} ${best.stack} ${f3(best.m2)}R a trade after costs (n ${nn(best.n2)}, month t ${f2(best.t2)}), discovery ${f3(best.m1)}R.**`;
  const res = { built: '2026-11-24', verdict, gate, cuts, tests, summary: S, counts: Object.fromEntries(markets.map((m) => [m.market, m.counts])) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const L = [];
  L.push('# The fade conditions stacked on the three Equinox fade rules, at measured hourly spreads (result)', '', head, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants. The conditions were chosen by earlier studies on these same years, so a',
    'pass would only be a hypothesis for a forward paper record; never call any of this an edge. A before-cost tilt is not an edge.', '',
    '## Gate and checks', '');
  for (const g of gate) L.push(`- Break fade, ${g.market}, 2005-26: ${nn(g.kept)} trades after data-quality exclusions (fade-late-hourcost gate ${nn(g.want)}, within 5): ${g.ok ? 'passed' : 'FAILED'}.`);
  for (const c of cuts) L.push(`- Cut test ${c.market}: ` + c.cuts.map((x) => `${x.cut} ${x.diff} of ${nn(x.n)} tags differ`).join('; ') + '.');
  L.push('- Every trade has its stop on the losing side (the run throws otherwise).', '',
    '## Primary tests (pooled xau, usdjpy, xag; AFTER measured costs)', '',
    'Measured: xau and usdjpy spreads by UTC hour (the broker\'s quotes at this fade\'s fills and exits), xag the probe\'s hourProfile;',
    'commission gold 0.000024, USD/JPY 0.000045, silver **ASSUMED** 0.000024. Month t = calendar-month sums, empty months 0.', '',
    '| Rule | Stack | n 05-14 | R 05-14 | n 15-26 | R 15-26 (month t) | control 15-26 | Holm p | Pass |', '|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const x of tests) { const c = S.judged[`${x.rule}|${x.stack}`].net;
    L.push(`| ${x.rule} | ${SNAME[x.stack]} | ${nn(c.n1)} | ${f3(c.m1)} | ${nn(c.n2)} | ${f3(c.m2)} (${f2(c.t2)}) | ${f3(x.ctl2)} | ${x.holm < 0.001 ? x.holm.toExponential(1) : x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`); }
  for (const grp of ['judged', 'others']) {
    if (!Object.keys(S[grp]).length) continue;
    L.push('', grp === 'judged' ? '## Every cell, judged markets (before / after measured costs)' : '## Reported only: the seven markets with no measured hourly spread (one flat round trip; ASSUMED for nzdusd, usdcad, usdchf, eurjpy)', '',
      '| Rule | Stack | n 05-14 | before | after (month t) | n 15-26 | before (month t) | after (month t) |', '|---|---|---:|---:|---:|---:|---:|---:|');
    for (const rule of RULES) for (const st of STACKS) { const c = S[grp][`${rule.key}|${st}`];
      L.push(`| ${rule.key} | ${SNAME[st]} | ${nn(c.gross.n1)} | ${f3(c.gross.m1)} | ${f3(c.net.m1)} (${f2(c.net.t1)}) | ${nn(c.gross.n2)} | ${f3(c.gross.m2)} (${f2(c.gross.t2)}) | ${f3(c.net.m2)} (${f2(c.net.t2)}) |`); }
  }
  L.push('', '## By market, after costs, confirmation 2015-26 (n, R a trade, month t)', '', '| Rule | Stack | ' + [...JUDGED, ...OTHERS].join(' | ') + ' |', '|---|---|' + [...JUDGED, ...OTHERS].map(() => '---:').join('|') + '|');
  for (const rule of RULES) for (const st of STACKS) { const a = { ...S.judged[`${rule.key}|${st}`]?.byMarket, ...S.others[`${rule.key}|${st}`]?.byMarket };
    L.push(`| ${rule.key} | ${st} | ` + [...JUDGED, ...OTHERS].map((m) => (a[m] ? `${nn(a[m].n2)}, ${f3(a[m].m2)} (${f2(a[m].t2)})` : '-')).join(' | ') + ' |'); }
  const g = (r, st, w) => S.judged[`${r}|${st}`][w], X = (r, st) => g(r, st, 'gross').m2;
  L.push('', '## What it says', '',
    `- Before costs the evening cut (S1) still lifts every rule in 2015-26 (fade ${f3(X('fade', 'S0'))} -> ${f3(X('fade', 'S1'))}R, big ${f3(X('big', 'S0'))} -> ${f3(X('big', 'S1'))}R, box ${f3(X('box', 'S0'))} -> ${f3(X('box', 'S1'))}R on the judged markets), but after the`,
    '  broker\'s measured evening spreads every S1 cell loses in confirmation. A before-cost tilt is not an edge.',
    `- Stacking makes it worse, not better: low volatility (S2) lowers the before-cost mean in the evening (fade ${f3(X('fade', 'S1'))} -> ${f3(X('fade', 'S2'))}R) and, with a`,
    '  smaller ATR stop, raises the cost in R; Monday (S3) leaves too few trades (big S3: 99 in confirmation, under the 200 bar).',
    '- The placebo (S1\'s shape at 08-11) is flat to negative before costs on the fade, as `fade-conditions` found; the box fade',
    '  (F1) trades only outside 07-17 UTC, so its placebo is empty by construction.',
    '- Single-market cells above zero (gold box S1, by-market table) are slices picked after looking: not tested, not evidence.',
    '- Caveats: today\'s measured spreads are charged on every year; silver\'s commission is ASSUMED; the seven unmeasured markets',
    '  carry one flat round trip (ASSUMED for four) and are reported, not judged; the conditions were chosen on these same years.');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n');
  return res;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'profile') fs.writeFileSync(path.join(HERE, 'profile.json'), JSON.stringify(buildProfile(), null, 1) + '\n');
  else if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, `T-${a}.json`), JSON.stringify(r)); console.log(a, JSON.stringify(r.counts)); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, `C-${a}.json`), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdict, JSON.stringify(r.tests.map((x) => [x.rule, x.stack, x.n2, r4(x.m2), r4(x.t2), x.pass]))); }
  else { console.error('usage: profile | market <m> <dir> | cut <m> <dir> | report <dir>'); process.exit(1); }
}
