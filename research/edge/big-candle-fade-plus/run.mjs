// research/edge/big-candle-fade-plus/run.mjs - the two complemented big-candle fades of PREREGISTRATION.md (24 Nov 2026) on ten
// markets the big-candle work never read, judged AFTER costs on month sums. Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/big-candle-fade-plus/run.mjs market <m> <outDir>
//   node research/edge/big-candle-fade-plus/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS as C2 } from '../combo-grid-2/run.mjs';
import { rows } from './explore.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['eurgbp', 'euraud', 'eurchf', 'gbpjpy', 'audjpy', 'cadjpy', 'gbpaud', 'nas100', 'spx500', 'de40'];
export const COSTS = { ...Object.fromEntries(MARKETS.filter((m) => C2[m] != null).map((m) => [m, C2[m]])), eurchf: 0.00010, gbpaud: 0.00016 };
export const HERE_ASSUMED = ['eurchf', 'gbpaud'];
export const SPLIT = Date.UTC(2015, 0, 1) / 1000, NM = 262, DM = 120;
const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };

// the two pre-registered rules: which row variant and exit, and the filter on the row's features
export const RULES = {
  A: { name: 'A overnight shock fade', key: 'mkt|0.1', x: 1, ok: (f) => (f.h < 7 || f.h >= 21) && f.rel >= 0.5 },
  B: { name: 'B rejection wick + confirmation', key: 'conf|0.5', x: 2, ok: (f) => f.wick >= 0.25 && f.rel >= 0.5 && f.conf === 1 },
};
// trades of a rule from rows: { t, m, w, R (before costs), c (cost in R) }
export function tradesOf(list, rule) {
  const out = [];
  for (const r of list) { if (!rule.ok(r.f)) continue; const v = r.R[rule.key]; if (!v || v[rule.x] == null) continue;
    out.push({ t: r.t, m: monthOf(r.t), w: r.t < SPLIT ? 0 : 1, R: v[rule.x], c: v[3] }); }
  return out;
}
const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null);
export function monthT(trades, f, a = 0, b = NM) { const ms = new Float64Array(NM); for (const x of trades) ms[x.m] += f(x);
  const n = b - a; let s = 0, q = 0; for (let i = a; i < b; i++) { s += ms[i]; q += ms[i] * ms[i]; } const m = s / n, sd = Math.sqrt(Math.max(0, (q - n * m * m) / (n - 1)));
  return sd > 0 ? m / (sd / Math.sqrt(n)) : 0; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };

export function stats(tr) {
  const net = (x) => x.R - x.c, w = [0, 1].map((k) => tr.filter((x) => x.w === k));
  const sorted = tr.map(net).sort((p, q) => p - q), cut = Math.floor(sorted.length * 0.01);
  const top10 = sorted.slice(-10).reduce((p, q) => p + q, 0), tot = sorted.reduce((p, q) => p + q, 0);
  return { n: tr.length, win: w.map((a) => ({ n: a.length, gross: mean(a.map((x) => x.R)), net: mean(a.map(net)), tNet: monthT(a, net, a === w[1] ? DM : 0, a === w[1] ? NM : DM) })),
    gross: mean(tr.map((x) => x.R)), net: mean(tr.map(net)), tNet: monthT(tr, net), tGross: monthT(tr, (x) => x.R),
    net15: mean(tr.map((x) => x.R - 1.5 * x.c)), netTrim: mean(sorted.slice(0, sorted.length - cut)), median: sorted.length ? sorted[sorted.length >> 1] : null,
    top10Share: tot > 0 ? top10 / tot : null, costR: mean(tr.map((x) => x.c)) };
}
export function judge(data) {
  const out = Object.entries(RULES).map(([k, rule]) => { const all = data.flatMap((d) => tradesOf(d.rows, rule)); const s = stats(all);
    return { rule: k, name: rule.name, ...s, p: p1(s.tNet, NM - 1),
      perMarket: data.map((d) => { const s2 = stats(tradesOf(d.rows, rule)); return { market: d.market, n: s2.n, gross: s2.gross, net: s2.net, tNet: s2.tNet }; }) }; });
  const H = K.holm(out.map((r) => r.p));
  out.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.win.every((w) => w.n >= 300), net: r.win.every((w) => w.net > 0), t: r.tNet >= 2 && H[i] < 0.05, robust: r.netTrim > 0 && r.net15 > 0 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return out;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const r6 = (x) => (x == null ? null : +x.toFixed(6));
export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json.gz'))).map((m) => ({ market: m, rows: JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '.json.gz')))) }));
  const meta = data.map((d) => ({ market: d.market, cost: COSTS[d.market], first: d.rows.length ? new Date(d.rows[0].t * 1000).toISOString().slice(0, 10) : null, signals: d.rows.length }));
  const res = judge(data), pass = res.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const b = [...res].sort((p, q) => q.tNet - p.tNet)[0];
  const headline = verdict === 'PASS' ? `${pass.map((r) => r.name).join(' and ')} passes after costs: ${f3(pass[0].net)}R a trade (n ${N(pass[0].n)}, month t ${f2(pass[0].tNet)})`
    : `neither rule passes after costs on the ten fresh markets; the better, ${b.name}, made ${f3(b.net)}R a trade after costs (n ${N(b.n)}, month t ${f2(b.tNet)}; before costs ${f3(b.gross)}R)`;
  const J = (r) => ({ rule: r.rule, name: r.name, n: r.n, gross: r6(r.gross), net: r6(r.net), tNet: r6(r.tNet), tGross: r6(r.tGross), holm: r6(r.holm),
    windows: r.win.map((w) => ({ n: w.n, gross: r6(w.gross), net: r6(w.net), tNet: r6(w.tNet) })), net15: r6(r.net15), netTrim: r6(r.netTrim), median: r6(r.median),
    top10Share: r6(r.top10Share), costR: r6(r.costR), checks: r.checks, pass: r.pass,
    perMarket: r.perMarket.map((m) => ({ market: m.market, n: m.n, gross: r6(m.gross), net: r6(m.net), tNet: r6(m.tNet) })) });
  const out = { study: 'big-candle-fade-plus', built: '2026-11-24', verdict, headline, basis: 'judged AFTER costs on calendar-month sums, pooled over ten fresh markets (pre-registered)',
    markets: data.map((d) => d.market), costs: COSTS, assumedHere: HERE_ASSUMED, meta, rules: res.map(J), passed: pass.map((r) => r.name) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  const L = ['# Big-candle fade plus: two complemented fades on fresh markets (result)', '', `**Verdict: ${verdict}. ${headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first; the two rules were picked in',
    '`EXPLORATION.md` on the ten markets `big-candle-fade` read). Research only: nothing live changed, nothing is proposed. One run.', '',
    '## The rules', '',
    '- **A, overnight shock fade**: an M15 candle (body > 1.5 x ATR, range >= 0.5 x D1 ATR) starting 21:00-06:59 UTC, faded at the next',
    '  5-minute open, stop 0.1 ATR past its extreme, target its open (when 1R or more away), 1 day.',
    '- **B, rejection wick + confirmation**: the same size, a wick of 25 % or more, the next M15 candle the other colour; faded after it,',
    '  stop 0.5 ATR past the extreme, 2R, 1 day.', '',
    `Ten markets never read by the big-candle work: ${out.markets.join(', ')}. Costs: \`combo-grid-2\` \`COSTS\`; assumed here for eurchf and`,
    'gbpaud; none measured on these markets at these hours. Bar: after costs, n >= 300 a window, positive in both windows, month t >= 2',
    'over 2005-2026 with Holm over the 2 rules, positive without the best 1 % of trades and at 1.5x costs.', '',
    '## Results (pooled)', '',
    '| Rule | n | R before | R after | month t after | Holm | 2005-14 n / after (t) | 2015-26 n / after (t) | without best 1 % | at 1.5x cost | median | 10 best share | cost R | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of res) L.push(`| ${r.name} | ${N(r.n)} | ${f3(r.gross)} | ${f3(r.net)} | ${f2(r.tNet)} | ${r.holm.toFixed(3)} | ${N(r.win[0].n)} / ${f3(r.win[0].net)} (${f2(r.win[0].tNet)}) | ${N(r.win[1].n)} / ${f3(r.win[1].net)} (${f2(r.win[1].tNet)}) | ${f3(r.netTrim)} | ${f3(r.net15)} | ${f3(r.median)} | ${r.top10Share == null ? 'n/a' : (100 * r.top10Share).toFixed(0) + ' %'} | ${r.costR.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## Per market', '', '| Market | cost | A n | A before | A after (t) | B n | B before | B after (t) |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (let i = 0; i < data.length; i++) { const a = res[0].perMarket[i], bb = res[1].perMarket[i];
    L.push(`| ${a.market}${HERE_ASSUMED.includes(a.market) ? '*' : ''} | ${COSTS[a.market]} | ${N(a.n)} | ${f3(a.gross)} | ${f3(a.net)} (${f2(a.tNet)}) | ${N(bb.n)} | ${f3(bb.gross)} | ${f3(bb.net)} (${f2(bb.tNet)}) |`); }
  L.push('', '* = cost assumed in this study.', '', '## What it means', '');
  if (verdict === 'PASS') L.push('A rule cleared every check after costs on markets it was not picked on. It is a candidate for a forward paper record',
    'that needs the owner, with costs measured at these hours first (overnight spreads are wider than the assumed ones). Not an edge yet.');
  else L.push('Neither complement carries the fade past its costs on markets it was not picked on: what looked positive in the exploration',
    'was selection among many cells. The big-candle fade stays a before-cost tilt. Close this line on M15; do not re-test variants',
    'on these markets.');
  L.push('');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n'));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = rows(a, COSTS[a]); fs.writeFileSync(path.join(b, a + '.json.gz'), zlib.gzipSync(JSON.stringify(r))); console.log(a, r.length); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
}
