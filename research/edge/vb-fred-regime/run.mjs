// Edge research · vb-fred-regime: gold and USD/JPY T1 (k 0.5) split by a public gauge known the day before
// (PREREGISTRATION.md, pushed alone first). Paper research only.
//   node --use-env-proxy research/edge/vb-fred-regime/run.mjs fetch <dir>
//   node research/edge/vb-fred-regime/run.mjs run <dir>      (candles: research/edge/_lib/edgekit.mjs DATA_DIR)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { daySkip } from '../index-vol-breakout/original.mjs';
import { load2, tradeOf, welch, monthDiff } from '../vb-vol-regime/run.mjs';
import { parseFred } from '../rulebook-gauges/run.mjs';
import { pFromT, holm } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN), r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// per-observation flag from the series' own past: 'aboveMean20' | 'mean5AboveMedian252' | 'absChg5AboveMedian252'
export function flags(S, kind) {
  const v = S.map((o) => o.v), out = new Array(S.length).fill(null);
  if (kind === 'aboveMean20') { for (let i = 20; i < v.length; i++) out[i] = v[i] > mean(v.slice(i - 20, i)); return out; }
  const x = v.map((_, i) => (i < 5 ? null : kind === 'mean5AboveMedian252' ? mean(v.slice(i - 4, i + 1)) : Math.abs(v[i] - v[i - 5])));
  for (let i = 5 + 252; i < v.length; i++) out[i] = x[i] > median(x.slice(i - 252, i));
  return out;
}
// the flag for trading day `day` (YYYY-MM-DD): the last observation dated strictly before it
export function flagFor(S, fl, day) { let lo = 0, hi = S.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (S[m].d < day) { r = m; lo = m + 1; } else hi = m - 1; } return r < 0 ? null : fl[r]; }
export const TESTS = [
  { id: 'G1', m: 'xau', series: 'GVZCLS', kind: 'aboveMean20', name: 'gold, implied volatility rising', disc: ['2008-07-01', '2016-12-31'], conf: ['2017-01-01', '2099-12-31'] },
  { id: 'G2', m: 'xau', series: 'USEPUINDXD', kind: 'mean5AboveMedian252', name: 'gold, policy uncertainty high' },
  { id: 'G3', m: 'xau', series: 'DFII10', kind: 'absChg5AboveMedian252', name: 'gold, real yields moving' },
  { id: 'J1', m: 'usdjpy', series: 'VIXCLS', kind: 'aboveMean20', name: 'USD/JPY, equity volatility rising' },
  { id: 'J2', m: 'usdjpy', series: 'DGS2', kind: 'absChg5AboveMedian252', name: 'USD/JPY, US 2-year moving' },
];
const WIN = { disc: ['2005-01-01', '2014-12-31'], conf: ['2015-01-01', '2099-12-31'] };
const inW = (d, [a, b]) => d >= a && d <= b;
const cell = (a) => (a.length ? { n: a.length, net: r3(mean(a.map((x) => x.net))), win: r3(a.filter((x) => x.R > 0).length / a.length) } : { n: 0 });
export function judge(rows, T) { // rows: [{ day, on, R, net }]
  const one = (w) => { const R = rows.filter((x) => inW(x.day, w)), A = R.filter((x) => x.on), B = R.filter((x) => !x.on), md = monthDiff(A, B), t = welch(A.map((x) => x.net), B.map((x) => x.net));
    return { on: cell(A), off: cell(B), diff: r3(mean(A.map((x) => x.net)) - mean(B.map((x) => x.net))), welch: r2(t), monthT: r2(md.t), months: md.months }; };
  return { disc: one(T.disc || WIN.disc), conf: one(T.conf || WIN.conf) };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const id of [...new Set(TESTS.map((t) => t.series))]) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    console.log('fetched');
  } else if (cmd === 'run') {
    const D = { xau: load2('xau'), usdjpy: load2('usdjpy') }, TR = {};
    for (const m of ['xau', 'usdjpy']) { TR[m] = []; for (const d of D[m].days) { if (daySkip(d)) continue; const x = tradeOf(m, d); if (x) TR[m].push({ day: d.day, ...x }); } }
    const g = (m, w) => { const a = TR[m].filter((x) => inW(x.day, w)); return { n: a.length, net: r3(mean(a.map((x) => x.net))) }; };
    const gj = g('usdjpy', ['2005-01-04', '2015-12-31']), gg = g('xau', ['2007-01-01', '2026-11-12']), near = (q, n, net) => Math.abs(q.n - n) <= 0.01 * n && Math.abs(q.net - net) <= 0.005;
    const gate = { usdjpy: { got: gj, want: { n: 2089, net: 0.079 }, ok: near(gj, 2089, 0.079) }, xau: { got: gg, want: { n: 3713, net: 0.139 }, ok: near(gg, 3713, 0.139) } };
    console.log('gate', JSON.stringify(gate));
    if (!gate.usdjpy.ok || !gate.xau.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'vb-fred-regime', gate, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); process.exit(2); }
    const out = TESTS.map((T) => { const S = parseFred(fs.readFileSync(path.join(dir, T.series + '.csv'), 'utf8')), fl = flags(S, T.kind);
      const rows = TR[T.m].map((x) => ({ ...x, on: flagFor(S, fl, x.day) })).filter((x) => x.on != null); return { id: T.id, name: T.name, series: T.series, ...judge(rows, T) }; });
    const ps = out.map((o) => (o.conf.welch == null ? 1 : pFromT(o.conf.welch, Math.max(2, Math.min(o.conf.on.n, o.conf.off.n) - 1)))), H = holm(ps);
    out.forEach((o, i) => { o.p = +ps[i].toFixed(4); o.holm = +H[i].toFixed(4); o.pass = o.conf.welch >= 2 && o.conf.monthT >= 2 && o.holm < 0.05 && o.disc.diff > 0; });
    const pass = out.filter((o) => o.pass).length;
    const verdict = `${pass ? 'PASS' : 'FAIL'}, ${pass} of ${out.length}. On minus off, net R a trade in the confirmation window: ` + out.map((o) => `${o.id} ${o.name} ${o.conf.diff >= 0 ? '+' : '−'}${Math.abs(o.conf.diff).toFixed(3)}R (Welch t ${o.conf.welch}, month t ${o.conf.monthT}, Holm ${o.holm}; discovery ${o.disc.diff >= 0 ? '+' : '−'}${Math.abs(o.disc.diff).toFixed(3)}R)`).join('; ') + '.';
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'vb-fred-regime', built: '2026-11-24', verdict, gate, tests: out }, null, 1) + '\n');
    const c = (x) => (x.n ? `${x.net >= 0 ? '+' : '−'}${Math.abs(x.net).toFixed(3)}R (n ${x.n})` : '—');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# The two breakouts by a public gauge known the day before (result, 24 Nov 2026)', '', `**Verdict: ${verdict}**`, '',
      'Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Harness gate reproduced (' + `gold n ${gg.n} / ${gg.net}R, USD/JPY n ${gj.n} / ${gj.net}R). Nothing live changed.`, '',
      '| Test | Discovery on | Discovery off | Confirmation on | Confirmation off | Welch t | Month t | Holm p | |', '|---|---|---|---|---|---|---|---|---|',
      ...out.map((o) => `| ${o.id} ${o.name} (${o.series}) | ${c(o.disc.on)} | ${c(o.disc.off)} | ${c(o.conf.on)} | ${c(o.conf.off)} | ${o.conf.welch} | ${o.conf.monthT} | ${o.holm} | ${o.pass ? 'PASS' : 'FAIL'} |`), '',
      'Net R a trade after the measured costs. Windows: discovery to 2014, confirmation 2015 on (G1: 2008-07 → 2016 and 2017 on).', ''].join('\n'));
    console.log(verdict);
  }
}
