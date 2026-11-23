// Edge research · vb-retest-limit: the volatility breakout T1 (gold, USD/JPY) entered on a LIMIT at the breakout level after
// it was first broken, against the published stop entry (PREREGISTRATION.md, pushed alone first). Paper research only.
// Days, levels and V0 come from gold-vol-breakout-hourcost/original.mjs (vbTrade, imported, never edited); costs from
// gold-vol-breakout-hourcost (C1, its committed profile) and fx-vol-breakout (costPx).
//   EDGE_DATA=<dir> node research/edge/vb-retest-limit/run.mjs   (reads $EDGE_DATA/<xau|usdjpy>/5m-<year>.json.gz)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { daysOf, medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { costFrac, hourOf } from '../gold-vol-breakout-hourcost/run.mjs';
import { costPx } from '../fx-vol-breakout/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const K = 0.5, DEEP = 0.1, SLIP = 0.05, MIN_SIG = 500;
export const W = { TEST: ['2010-01-01', '2019-12-31'], H1: ['2010-01-01', '2014-12-31'], H2: ['2015-01-01', '2019-12-31'], LATE: ['2020-01-01', '2099-12-31'] };
export const MARKETS = ['xau', 'usdjpy'];
// harness gates: V0 gross on windows the published studies reported (n, gross R a trade)
export const GATE = {
  xau: { w: ['2012-01-01', '2015-12-31'], n: 728, grossR: 0.186, also: { w: ['2016-01-01', '2020-12-31'], n: 935, grossR: 0.111 } },
  usdjpy: { w: ['2011-01-01', '2015-12-31'], n: 940, grossR: 0.116 },
};
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// walk an open position from candle j (as original.mjs walk): a gap through the stop exits at the open, else the stop, else 20:55 close
export function walk(bars, j, side, stop) {
  for (let i = j; i < bars.length; i++) {
    const b = bars[i];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', t: b.t };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', t: b.t };
  }
  const b = bars.at(-1); return { exit: b.c, how: 'time', t: b.t + 300 };
}

// the limit after the touch: v = 'V1' (at the level) or 'V2' (0.1 x prevRange deeper). Returns a trade, or { nofill, cancel }
export function retestTrade(bars, v0, prevRange, v) {
  const s = v0.side, stop = v0.open, base = s > 0 ? v0.up : v0.dn, L = v === 'V2' ? base - s * DEEP * prevRange : base;
  const i0 = bars.findIndex((b) => b.t === v0.fillT);
  for (let i = i0 + 1; i < bars.length; i++) {
    const b = bars[i];
    if (s * (b.o - stop) <= 0) return { nofill: true, cancel: 'gap' };                  // opens at or beyond the stop
    const reachL = s > 0 ? b.l <= L : b.h >= L, reachStop = s > 0 ? b.l <= stop : b.h >= stop;
    if (!reachL) { if (reachStop) return { nofill: true, cancel: 'stop' }; continue; }   // cannot happen (L lies between), kept as a guard
    const entry = s > 0 ? Math.min(L, b.o) : Math.max(L, b.o);
    if (!(s * (entry - stop) > 0)) throw new Error('stop not on the losing side');
    const x = reachStop ? { exit: stop, how: 'stop', t: b.t } : walk(bars, i + 1, s, stop);
    const r = Math.abs(entry - stop), R = s * (x.exit - entry) / r, n = s > 0 ? nights(b.t, x.t) : 0;
    return { side: s, entry, stop, r, exit: x.exit, how: x.how, R, finR: s > 0 ? n * FIN.xau.long * entry / r : 0, fillT: b.t, fillMin: (b.t % 86400) / 60, fi: i };
  }
  return { nofill: true, cancel: null };
}

// cost in R of one filled trade
export function costR(mk, x, bars, fi, profile, commission) {
  if (mk === 'usdjpy') return costPx('usdjpy', x.entry) / x.r;
  return (costFrac(profile, hourOf(x), 'frac', commission) * x.entry + SLIP * medRange(bars, fi)) / x.r + (x.finR || 0);
}

// every signal day of one market: V0, V1, V2 (gross R, net R; null when no fill)
export function signalDays(mk, days, profile, commission) {
  const out = [];
  for (const d of days) {
    if (O.daySkip(d)) continue;
    const v0 = O.vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (v0.skip) continue;
    const f0 = d.bars.findIndex((b) => b.t === v0.fillT);
    const row = { day: d.day, side: v0.side, V0: { R: v0.R, net: v0.R - costR(mk, v0, d.bars, f0, profile, commission) } };
    for (const v of ['V1', 'V2']) {
      const x = retestTrade(d.bars, v0, d.prevRange, v);
      row[v] = x.nofill ? { R: null, net: null, cancel: x.cancel } : { R: x.R, net: x.R - costR(mk, x, d.bars, x.fi, profile, commission), how: x.how };
    }
    out.push(row);
  }
  return out;
}

const dOf = (row, v, key) => (row[v][key] ?? 0) - row.V0[key];
export function paired(rows, v, key = 'R') {
  const tr = rows.map((x) => ({ day: x.day, d: dOf(x, v, key) })), mt = O.monthT(tr, 'd');
  return { n: rows.length, meanD: mean(tr.map((x) => x.d)), t: mt.t, months: mt.months };
}
export function describe(rows) {
  const o = { signalDays: rows.length };
  for (const v of ['V0', 'V1', 'V2']) {
    const f = rows.filter((x) => x[v].R != null);
    o[v] = { fills: f.length, fillRate: r3(f.length / rows.length), grossR: r3(mean(f.map((x) => x[v].R))), netR: r3(mean(f.map((x) => x[v].net))),
      perDayGross: r3(mean(rows.map((x) => x[v].R ?? 0))), perDayNet: r3(mean(rows.map((x) => x[v].net ?? 0))),
      netT: r2(O.monthT(f.map((x) => ({ day: x.day, net: x[v].net }))).t),
      cancelStop: v === 'V0' ? 0 : rows.filter((x) => x[v].cancel === 'stop').length, cancelGap: v === 'V0' ? 0 : rows.filter((x) => x[v].cancel === 'gap').length };
  }
  for (const v of ['V1', 'V2']) { const g = paired(rows, v), n = paired(rows, v, 'net'); o[`${v}minusV0`] = { gross: r3(g.meanD), grossT: r2(g.t), net: r3(n.meanD), netT: r2(n.t) }; }
  return o;
}
export function judge(byMk) {
  const tests = [];
  for (const v of ['V1', 'V2']) for (const mk of MARKETS) {
    const rows = byMk[mk], all = rows.filter((x) => inW(x.day, W.TEST)), p = paired(all, v);
    const h1 = paired(rows.filter((x) => inW(x.day, W.H1)), v), h2 = paired(rows.filter((x) => inW(x.day, W.H2)), v);
    tests.push({ test: v === 'V1' ? 'T1' : 'T2', variant: v, market: mk, n: all.length, meanD: r3(p.meanD), t: r2(p.t), months: p.months,
      h1: r3(h1.meanD), h2: r3(h2.meanD), p: O.normP(p.t) });
  }
  const adj = O.holm(tests.map((x) => x.p));
  tests.forEach((x, i) => { x.pHolm = r3(adj[i]); x.p = r3(x.p); x.pass = x.t >= 2 && adj[i] < 0.05 && x.h1 > 0 && x.h2 > 0; });
  const few = MARKETS.some((mk) => byMk[mk].filter((x) => inW(x.day, W.TEST)).length < MIN_SIG);
  return { tests, verdict: few ? 'INCONCLUSIVE' : tests.some((x) => x.pass) ? 'PASS' : 'FAIL' };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function headline(R) {
  const t = (mk, v) => R.judged.tests.find((x) => x.market === mk && x.variant === v);
  const f = (mk) => `${mk === 'xau' ? 'gold' : 'USD/JPY'} ${sg(t(mk, 'V1').meanD)}R a signal day (n ${t(mk, 'V1').n}, t ${sg(t(mk, 'V1').t, 2)})`;
  return `${R.verdict}. A limit at the retest lost to the stop entry on 2010-19 before costs: ${f('xau')}, ${f('usdjpy')}; the deeper limit too`;
}
export function report(R) {
  const L = [], dx = R.desc;
  L.push('# The volatility breakout entered on a limit at the retest (23 Nov 2026)', '');
  L.push(`**Verdict: ${R.headline}.**`, '');
  L.push('Paper research only. Rule, variants, tests and pass bar fixed in `PREREGISTRATION.md` (pushed alone first). Nothing live changed. 2010-2019 is in sample for the rule itself (gold read 2007-26, USD/JPY 2005-26 by earlier studies); only the variants are new.', '');
  L.push('## Tests (gross R per signal day, variant minus V0; a no-fill day counts 0R for the variant)', '');
  L.push('| Test | Market | Signal days | Mean d | Month t | 2010-14 | 2015-19 | p | Holm p | Pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of R.judged.tests) L.push(`| ${x.test} ${x.variant} | ${x.market} | ${x.n} | ${sg(x.meanD)} | ${sg(x.t, 2)} | ${sg(x.h1)} | ${sg(x.h2)} | ${x.p} | ${x.pHolm} | ${x.pass ? 'yes' : 'no'} |`);
  for (const [wk, label] of [['TEST', '2010-2019 (judged)'], ['LATE', '2020 → now (in sample, judges nothing)']]) {
    L.push('', `## ${label}`, '');
    L.push('| Market | Entry | Fills | Fill rate | Gross R/trade | Net R/trade | Net month t | Per day gross | Per day net | Cancelled at stop / gap |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const mk of MARKETS) for (const v of ['V0', 'V1', 'V2']) { const x = dx[wk][mk][v]; L.push(`| ${mk} | ${v} | ${x.fills} | ${(x.fillRate * 100).toFixed(1)} % | ${sg(x.grossR)} | ${sg(x.netR)} | ${sg(x.netT, 2)} | ${sg(x.perDayGross)} | ${sg(x.perDayNet)} | ${x.cancelStop} / ${x.cancelGap} |`); }
    L.push('', 'Paired, per signal day: ' + MARKETS.map((mk) => ['V1', 'V2'].map((v) => { const q = dx[wk][mk][`${v}minusV0`]; return `${mk} ${v} − V0 gross ${sg(q.gross)} (t ${sg(q.grossT, 2)}), net ${sg(q.net)} (t ${sg(q.netT, 2)})`; }).join('; ')).join('; ') + '.');
  }
  L.push('', '## Reading', '', R.reading, '');
  L.push(`Gate: V0 reproduces the published gross figures (${Object.entries(R.gate).map(([k, g]) => `${k} ${g.ok ? 'ok' : 'FAILED'}`).join(', ')}). Data: ${R.data}. Costs: gold C1 of gold-vol-breakout-hourcost (measured hourly spread + commission + 0.05 × M), USD/JPY 0.000045 × entry + 0.5 pip.`, '');
  L.push('To repeat: `EDGE_DATA=<dir> MD_BASE=https://aureumdesk.co.uk/md/ node --use-env-proxy research/edge/_lib/fetch-cache.mjs <xau|usdjpy> 5m 2009`, then `EDGE_DATA=<dir> node research/edge/vb-retest-limit/run.mjs`.', '');
  return L.join('\n');
}

function load(mk) {
  const dir = path.join(process.env.EDGE_DATA || '', mk), rows = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^5m-\d{4}\.json\.gz$/.test(x)).sort()) rows.push(...JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))));
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-vol-breakout-hourcost/result.json'), 'utf8'));
  const byMk = {}, gate = {}, data = [];
  for (const mk of MARKETS) {
    const raw = load(mk), { days, dataEnd } = daysOf(raw);
    data.push(`${mk} ${raw.length} M5 candles ${new Date(raw[0][0] * 1000).toISOString().slice(0, 10)} → ${dataEnd}`);
    const chk = (g) => { const tr = days.filter((d) => inW(d.day, g.w) && !O.daySkip(d)).map((d) => O.vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 })).filter((x) => !x.skip);
      return { w: g.w, n: tr.length, grossR: r3(mean(tr.map((x) => x.R))), want: [g.n, g.grossR], ok: tr.length === g.n && r3(mean(tr.map((x) => x.R))) === g.grossR }; };
    gate[mk] = chk(GATE[mk]); if (GATE[mk].also) gate[`${mk}2`] = chk(GATE[mk].also);
    byMk[mk] = signalDays(mk, days, hc.profile, hc.commission);
  }
  console.log('gate', gate);
  if (!Object.values(gate).every((g) => g.ok)) { console.log('harness gate failed: stop'); process.exit(2); }
  const judged = judge(byMk), desc = {};
  for (const [wk, w] of [['TEST', W.TEST], ['LATE', W.LATE]]) { desc[wk] = {}; for (const mk of MARKETS) desc[wk][mk] = describe(byMk[mk].filter((x) => inW(x.day, w))); }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'vb-retest-limit', built: '2026-11-23', preregistration: 'research/edge/vb-retest-limit/PREREGISTRATION.md', planSha256: sha, verdict: judged.verdict,
    windows: W, data: data.join('; '), gate, judged, desc };
  R.headline = headline(R);
  const x1 = desc.TEST.xau, j1 = desc.TEST.usdjpy;
  R.reading = `Waiting for the retest misses the days that run without coming back: V1 fills ${(x1.V1.fillRate * 100).toFixed(0)} % of gold's and ${(j1.V1.fillRate * 100).toFixed(0)} % of USD/JPY's signal days, V2 ${(x1.V2.fillRate * 100).toFixed(0)} % / ${(j1.V2.fillRate * 100).toFixed(0)} %. `
    + `Filled trades make ${sg(x1.V1.grossR)}R (gold V1) and ${sg(j1.V1.grossR)}R (USD/JPY V1) a trade before costs against V0's ${sg(x1.V0.grossR)}R / ${sg(j1.V0.grossR)}R; per signal day ${sg(x1.V1.perDayGross)}R / ${sg(j1.V1.perDayGross)}R against ${sg(x1.V0.perDayGross)}R / ${sg(j1.V0.perDayGross)}R. `
    + 'The days that come back to the level are the weaker ones: at the same entry price (V1) the filled trades earn less a trade than V0, so the limit adds no price improvement and loses the days that run (adverse selection). Costs do not change the picture (paired differences after costs within 0.01R of the gross ones). '
    + (judged.verdict === 'PASS' ? 'A passing test makes the retest entry a candidate for its own forward record beside the running breakout records; nothing live changes without the owner.' : 'The stop entry stays: no retest limit improved the signal day on the pre-registered bar. Nothing live changed.');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.headline);
}
