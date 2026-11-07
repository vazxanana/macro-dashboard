// Meridian exits, stage 3: tables from exits.mjs's result. node analyze.mjs <result.json> <config.json> [out.md]
// Net R = gross R minus the trade's cost (backtest.mjs costOf, in R). Halves split at the window's midpoint by fill time.
// Max drawdown on the cumulative net R in fill order. t = mean / (sd / sqrt n). "paired" = mean per-trade change vs live, with t.
// A variant PASSES only if it beats live on net R a trade in BOTH halves AND on most markets (at least 4 of 6, markets with
// 10+ trades), the overfitting guard the owner set; significance of the paired change is reported next to it.
import fs from 'node:fs';

const [RES, CFGF, OUT] = process.argv.slice(2);
const res = JSON.parse(fs.readFileSync(RES)), cfg = JSON.parse(fs.readFileSync(CFGF));
const V = Object.keys(res.variants), MK = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
const mid = (Date.parse(res.from) / 1000 + Date.parse(res.to) / 1000) / 2;
const net = (x, v) => x.R[v] - x.cost;
// the live rule set (trader.mjs): minRR 1.2 and the per-setup config filters
function passes(x) {
  const f = (cfg.filters || {})[x.k] || {};
  if (!(x.rr >= (cfg.minRR || 1.2))) return false;
  if (f.off) return false;
  if (f.d1 && x.feat.d1 !== f.d1) return false;
  if (f.struct && x.feat.struct !== 'n/a' && x.feat.struct !== f.struct) return false;
  if (f.noSession && f.noSession.includes(x.feat.session)) return false;
  if (f.minRR && !(x.rr >= f.minRR)) return false;
  if (f.maxRR && x.rr > f.maxRR) return false;
  if ((f.noMarket || []).includes(x.m)) return false;
  return true;
}
function st(a) {
  const n = a.length; if (!n) return { n: 0 };
  const sum = a.reduce((p, q) => p + q, 0), mean = sum / n, sd = Math.sqrt(a.reduce((p, q) => p + (q - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0; for (const r of a) { eq += r; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, wr: a.filter((r) => r > 0).length / n, exp: mean, R: sum, dd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
}
function judge(arr) {
  arr = arr.slice().sort((p, q) => p.t - q.t);
  const out = {};
  for (const v of V) {
    const all = st(arr.map((x) => net(x, v))), h1 = st(arr.filter((x) => x.t < mid).map((x) => net(x, v))), h2 = st(arr.filter((x) => x.t >= mid).map((x) => net(x, v)));
    const pd = st(arr.map((x) => x.R[v] - x.R.live));
    const byM = {}; for (const m of MK) { const a = arr.filter((x) => x.m === m); if (a.length) byM[m] = { n: a.length, exp: st(a.map((x) => net(x, v))).exp, d: st(a.map((x) => x.R[v] - x.R.live)).exp }; }
    out[v] = { all, h1, h2, paired: { d: pd.exp, t: pd.t }, byM };
  }
  for (const v of V) {
    const o = out[v], L = out.live, mk = Object.entries(o.byM).filter(([, s]) => s.n >= 10);
    o.beatH1 = o.h1.exp > L.h1.exp; o.beatH2 = o.h2.exp > L.h2.exp;
    o.mBeat = mk.filter(([, s]) => s.d > 0).length; o.mN = mk.length;
    o.pass = v !== 'live' && o.beatH1 && o.beatH2 && o.mBeat >= Math.max(4, Math.ceil(o.mN * 2 / 3));
  }
  return out;
}
const f2 = (v, d = 3) => v == null || !isFinite(v) ? '-' : (v >= 0 ? '+' : '') + v.toFixed(d);
const SETUPS = ['scalp', 'intraday', 'swing', 'rscalp', 'rintra', 'rswing'];
const lines = [], J = {};
const P = (s) => { lines.push(s); };
function table(title, arr) {
  const r = judge(arr); J[title] = r;
  P(`\n### ${title}\n`);
  P('| exit | n | win% | net R/trade | total R | max DD | t | 1st half | 2nd half | paired vs live (t) | markets beating live | pass |');
  P('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of V) { const o = r[v];
    P(`| ${v === 'live' ? '**live**' : v} | ${o.all.n} | ${(100 * o.all.wr).toFixed(1)} | ${f2(o.all.exp)} | ${f2(o.all.R, 1)} | ${o.all.dd.toFixed(1)} | ${o.all.t.toFixed(1)} | ${f2(o.h1.exp)} (${o.h1.n}) | ${f2(o.h2.exp)} (${o.h2.n}) | ${v === 'live' ? '' : `${f2(o.paired.d)} (${o.paired.t.toFixed(1)})`} | ${v === 'live' ? '' : `${o.mBeat}/${o.mN}`} | ${v === 'live' ? '' : o.pass ? '**PASS**' : 'no'} |`); }
  P('\nNet R a trade by market:\n');
  P(`| exit | ${MK.join(' | ')} |`); P(`|---|${MK.map(() => '---').join('|')}|`);
  for (const v of V) P(`| ${v} | ${MK.map((m) => r[v].byM[m] ? `${f2(r[v].byM[m].exp)} (${r[v].byM[m].n})` : '-').join(' | ')} |`);
}
P(`Window ${res.from.slice(0, 10)} to ${res.to.slice(0, 10)}, split at ${new Date(mid * 1000).toISOString().slice(0, 10)}. Baseline check: ${res.checks.same}/${res.checks.n} replay results reproduced.`);
P('\nVariants:'); for (const v of V) P(`- \`${v}\`: ${res.variants[v]}`);
const rows = res.rows;
const live = rows.filter(passes);
table('Meridian rule-passing signals, all setups pooled (live rules: config filters + minRR)', live);
table('All engine signals, setups pooled (shadow book)', rows.filter((x) => SETUPS.includes(x.k)));
for (const k of SETUPS) table(`${k}: all signals`, rows.filter((x) => x.k === k));
for (const k of SETUPS) { const a = live.filter((x) => x.k === k); if (a.length >= 30) table(`${k}: rule-passing`, a); }
const passed = Object.entries(J).flatMap(([t, r]) => V.filter((v) => r[v].pass).map((v) => `${t} :: ${v}`));
P(`\nPassing (title :: variant): ${passed.length ? passed.join('; ') : 'none'}`);
if (OUT) { fs.writeFileSync(OUT, lines.join('\n') + '\n'); fs.writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify({ from: res.from, to: res.to, mid, tables: J, passed })); }
console.log(lines.join('\n'));
