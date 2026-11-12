// The playbook's weekly-bull daily rejection long and two Daily-regime cuts on silver (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-drd-silver/run.mjs fetch <dir>   OANDA mid H1 XAG_USD via the site's proxy
//   node research/edge/gold-drd-silver/run.mjs full <dir>
// Days, weeks, the weekly state and the statistics are gold-drd-long's; the ER is gold-drd-er's. Only the buffer and the cost
// are silver's, so signals / simulate take them as arguments here.
import fs from 'node:fs';
import path from 'node:path';
import { nyDay, days, weeks, weekState, stats, welch } from '../gold-drd-long/run.mjs';
import { er, up, dd } from '../gold-drd-er/run.mjs';

const H = 3600, D = 86400, HOLD = 10;
export const BUF = 0.004, COST = 0.03;
const monday = (d) => d - ((new Date(d * D * 1000).getUTCDay() + 6) % 7);
export function signals(ds, wk, wst, buf = BUF, thr = 0.7) {
  const wIdx = new Map(wk.map((x, i) => [x.k, i])), out = [];
  for (let i = 1; i < ds.length - 1; i++) {
    const x = ds[i], wi = wIdx.get(monday(x.d)) - 1, s = wi >= 0 ? wst[wi] : 0; if (s !== 1) continue;
    const rng = x.high - x.low; if (!(rng > 0)) continue;
    out.push({ i, d: x.d, stop: x.low - buf, rule: x.close > ds[i - 1].low && (x.close - x.low) / rng >= thr });
  }
  return out;
}
export function simulate(h1, startOf, ds, sg, rr = 3, cost = COST) {
  const e = ds[sg.i + 1], k0 = startOf.get(e.d); if (k0 == null) return null;
  const entry = h1[k0].open, risk = entry - sg.stop; if (!(risk > 0)) return null;
  const tgt = entry + rr * risk, lastDay = ds[Math.min(ds.length - 1, sg.i + HOLD)].d;
  let exit = null, how = 'time';
  for (let k = k0; k < h1.length; k++) { const b = h1[k], d = nyDay(b.time); if (d == null) continue; if (d > lastDay) break;
    if (b.low <= sg.stop) { exit = Math.min(b.open, sg.stop); how = 'stop'; break; }
    if (b.high >= tgt) { exit = tgt; how = 'target'; break; }
    exit = b.close; }
  if (exit == null) return null;
  const R = (exit - entry) / risk;
  return { d: sg.d, entryT: h1[k0].time, entry, stop: sg.stop, risk, R, net: R - cost / risk, how };
}
// one-sided p from t (normal approximation) and Holm over a list
const pOf = (t) => 0.5 * erfc(t / Math.SQRT2);
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let m = 0;
  o.forEach(([p, i], r) => { m = Math.max(m, Math.min(1, p * (ps.length - r))); adj[i] = m; }); return adj; }

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xag&tf=1h&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xag-h1.json'), JSON.stringify(rows));
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xag-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = days(h1), wk = weeks(ds), wst = weekState(wk), start = new Map();
  h1.forEach((b, k) => { const d = nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
  const R = [], B = [];
  for (const sg of signals(ds, wk, wst)) { const tr = simulate(h1, start, ds, sg); if (!tr) continue; const e = er(ds, sg.i); if (e == null) continue;
    tr.er = e; tr.up = up(ds, sg.i); B.push(tr); if (sg.rule) R.push(tr); }
  const F = { T1: () => true, T2: (x) => x.er >= 0.3, T3: (x) => x.er >= 0.2 && x.up, 'er>=0.2': (x) => x.er >= 0.2 };
  const P = { all: ['2000-01-01', '2099-01-01'], a: ['2000-01-01', '2019-12-31'], b: ['2020-01-01', '2099-01-01'] };
  const cut = (T, [f, t]) => T.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t);
  const S = (T) => { const s = stats(T); delete s.sd; s.dd = dd(T); return s; };
  const out = { built: new Date().toISOString().slice(0, 10), data: { from: ymd(ds[0].d), to: ymd(ds.at(-1).d), days: ds.length, h1: h1.length, src: 'OANDA mid H1 XAG_USD via the site proxy' }, buffer: BUF, cost: COST, rows: {}, baseline: {}, years: {} };
  for (const [n, f] of Object.entries(F)) { const r = R.filter(f); out.rows[n] = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(cut(r, p))])); out.rows[n].lift = welch(r, B.filter(f)); }
  out.baseline = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(cut(B, p))]));
  for (let y = 2006; y <= 2026; y++) { const r = cut(R, [`${y}-01-01`, `${y}-12-31`]); if (!r.length) continue; const s = stats(r), s3 = stats(r.filter(F.T2)); out.years[y] = { n: s.n, total: s.total, nT2: s3.n, totalT2: s3.total }; }
  const tests = ['T1', 'T2', 'T3'], adj = holm(tests.map((k) => pOf(out.rows[k].all.t ?? 0)));
  out.tests = Object.fromEntries(tests.map((k, i) => { const r = out.rows[k], pass = r.all.avg > 0 && adj[i] < 0.05 && r.a.pf > 1 && r.b.pf > 1; return [k, { p: +pOf(r.all.t ?? 0).toFixed(4), pHolm: +adj[i].toFixed(4), pass }]; }));
  // reported, not tested: t on monthly sums (overlapping trades counted once a month) and each stream without 2025
  const mon = (T) => { const m = new Map(); for (const x of T) { const k = ymd(x.d).slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); } const v = [...m.values()], n = v.length, a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1)); return { months: n, t: +(a / (sd / Math.sqrt(n))).toFixed(2) }; };
  out.robust = Object.fromEntries(['T1', 'T2', 'T3'].map((k) => { const r = R.filter(F[k]), ex = r.filter((x) => !ymd(x.d).startsWith('2025')), s = stats(ex); return [k, { monthly: mon(r), ex2025: { n: s.n, avg: +s.avg.toFixed(3), total: s.total, t: s.t } }]; }));
  out.verdict = out.tests.T2.pass || out.tests.T3.pass ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data)); for (const [n, r] of Object.entries(out.rows)) console.log(n, JSON.stringify(r));
  console.log('baseline', JSON.stringify(out.baseline)); console.log('years', JSON.stringify(out.years)); console.log('robust', JSON.stringify(out.robust)); console.log('tests', JSON.stringify(out.tests), out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
