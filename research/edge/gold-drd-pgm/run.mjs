// The playbook's weekly-bull daily rejection long and its two Daily-regime cuts on platinum and palladium (PREREGISTRATION.md,
// pushed first). Judged on calendar-month sums.
//   node --use-env-proxy research/edge/gold-drd-pgm/run.mjs fetch <dir>   OANDA mid H1 XPT_USD / XPD_USD via the site's proxy
//   node research/edge/gold-drd-pgm/run.mjs full <dir>
// Days, weeks, weekly state and statistics are gold-drd-long's, the ER gold-drd-er's, signals / simulate / holm gold-drd-silver's.
import fs from 'node:fs';
import path from 'node:path';
import { nyDay, days, weeks, weekState, stats, welch } from '../gold-drd-long/run.mjs';
import { er, up, dd } from '../gold-drd-er/run.mjs';
import { signals, simulate, holm } from '../gold-drd-silver/run.mjs';

const H = 3600, D = 86400;
export const MARKETS = { xpt: { cost: 0.003 }, xpd: { cost: 0.002 } };   // round trip, share of the entry price
export const BUF = 0.0001;                                                 // share of the signal day's low

const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
export const pOf = (t) => 0.5 * erfc(t / Math.SQRT2);
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
// t of calendar-month sums of net R (months with no trade left out)
export function monthT(T, key = 'net') {
  const m = new Map(); for (const x of T) { const k = ymd(x.d).slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null };
  const a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
// a trade priced with a per-market cost (share of entry) and buffer (share of the signal day's low)
export function trades(h1, cost) {
  const ds = days(h1), wk = weeks(ds), wst = weekState(wk), start = new Map();
  h1.forEach((b, k) => { const d = nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const R = [], B = [];
  for (const sg0 of signals(ds, wk, wst, 0)) {
    const sg = { ...sg0, stop: ds[sg0.i].low * (1 - BUF) };
    const tr = simulate(h1, start, ds, sg, 3, 0); if (!tr) continue;
    const e = er(ds, sg.i); if (e == null) continue;
    const c = cost * tr.entry / tr.risk;
    Object.assign(tr, { net: tr.R - c, net2: tr.R - 2 * c, er: e, up: up(ds, sg.i) });
    B.push(tr); if (sg.rule) R.push(tr);
  }
  return { ds, R, B };
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const sym of Object.keys(MARKETS)) {
    if (fs.existsSync(path.join(dir, `${sym}-h1.json`))) continue;
    let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
    while (from < now) { const to = Math.min(now, from + 4990 * H);
      let r, j;
      for (let a = 0; ; a++) { try { r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=1h&from=${from}&to=${to}`); j = await r.json(); if (r.ok) break; } catch (e) { r = { status: e.message }; j = {}; }
        if (a >= 4) throw new Error(`proxy ${r.status} ${j.error || ''}`); await new Promise((s) => setTimeout(s, 5000 * (a + 1))); }
      for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
      process.stderr.write(`${sym} ${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
    const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(dir, `${sym}-h1.json`), JSON.stringify(rows));
  }
}

function full(dir) {
  const F = { T1: () => true, T2: (x) => x.er >= 0.3, T3: (x) => x.er >= 0.2 && x.up };
  const P = { all: ['2000-01-01', '2099-01-01'], a: ['2000-01-01', '2019-12-31'], b: ['2020-01-01', '2099-01-01'] };
  const cut = (T, [f, t]) => T.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t);
  const S = (T) => { const s = stats(T); delete s.sd; s.dd = dd(T); return s; };
  const out = { built: new Date().toISOString().slice(0, 10), buffer: BUF, markets: {}, tests: {} };
  const ps = [], keys = [];
  for (const [sym, m] of Object.entries(MARKETS)) {
    const h1 = JSON.parse(fs.readFileSync(path.join(dir, `${sym}-h1.json`), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
    const { ds, R, B } = trades(h1, m.cost);
    const o = { cost: m.cost, data: { from: ymd(ds[0].d), to: ymd(ds.at(-1).d), days: ds.length, h1: h1.length, src: `OANDA mid H1 ${sym.toUpperCase()}_USD via the site proxy` }, rows: {}, baseline: {}, years: {} };
    for (const [n, f] of Object.entries(F)) {
      const r = R.filter(f), row = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(cut(r, p))]));
      row.lift = welch(r, B.filter(f)); row.monthly = monthT(r);
      row.cost2 = { avg: r.length ? +(r.reduce((a, x) => a + x.net2, 0) / r.length).toFixed(3) : null };
      const yr = new Map(); for (const x of r) { const y = ymd(x.d).slice(0, 4); yr.set(y, (yr.get(y) || 0) + x.net); }
      const best = [...yr.entries()].sort((a, b) => b[1] - a[1])[0];
      const ex = best ? r.filter((x) => !ymd(x.d).startsWith(best[0])) : r, se = stats(ex);
      row.exBest = { year: best && best[0], yearR: best && +best[1].toFixed(1), n: se.n, avg: +(se.avg || 0).toFixed(3), t: se.t };
      o.rows[n] = row;
    }
    o.baseline = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(cut(B, p))]));
    for (let y = 2006; y <= 2026; y++) { const r = cut(R, [`${y}-01-01`, `${y}-12-31`]); if (!r.length) continue; const s = stats(r), s2 = stats(r.filter(F.T2)), s3 = stats(r.filter(F.T3)); o.years[y] = { n: s.n, total: s.total, totalT2: s2.total, totalT3: s3.total }; }
    out.markets[sym] = o;
    for (const k of ['T2', 'T3']) { keys.push(`${k}-${sym}`); ps.push(pOf(o.rows[k].monthly.t ?? 0)); }
  }
  const adj = holm(ps);
  keys.forEach((key, i) => { const [k, sym] = key.split('-'), r = out.markets[sym].rows[k];
    const pass = r.all.avg > 0 && adj[i] < 0.05 && r.a.pf > 1 && r.b.pf > 1 && r.cost2.avg > 0 && r.exBest.avg > 0;
    out.tests[key] = { monthT: r.monthly.t, p: +ps[i].toFixed(4), pHolm: +adj[i].toFixed(4), pass }; });
  out.verdict = Object.values(out.tests).some((x) => x.pass) ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [sym, o] of Object.entries(out.markets)) { console.log(sym, JSON.stringify(o.data)); for (const [n, r] of Object.entries(o.rows)) console.log(' ', n, JSON.stringify(r)); console.log('  baseline', JSON.stringify(o.baseline)); console.log('  years', JSON.stringify(o.years)); }
  console.log('tests', JSON.stringify(out.tests), out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
