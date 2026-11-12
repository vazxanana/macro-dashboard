// The playbook's weekly-bull daily rejection long, out of its own sample (PREREGISTRATION.md, written first).
//   node --use-env-proxy research/edge/gold-drd-long/run.mjs fetch <dir>   OANDA mid H1 gold from 2006 via the site's proxy
//   node research/edge/gold-drd-long/run.mjs full <dir>                   the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';

const H = 3600, D = 86400, COST = 0.35, BUF = 0.3, HOLD = 10;
const nyOff = (() => { const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }); const c = new Map();
  return (t) => { const k = Math.floor(t / H); if (c.has(k)) return c.get(k); const p = Object.fromEntries(f.formatToParts(new Date(k * H * 1000)).map((x) => [x.type, x.value]));
    const loc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24) / 1000, o = (loc - k * H) / H; c.set(k, o); return o; }; })();
// the 17:00 New York trading day an H1 candle belongs to (a number of days since 1970); weekend hours -> null
export function nyDay(t) { const loc = t + nyOff(t) * H + 7 * H, d = Math.floor(loc / D), wd = new Date(d * D * 1000).getUTCDay(); return wd === 0 || wd === 6 ? null : d; }

export function days(h1) {
  const out = []; let cur = null;
  for (const b of h1) { const d = nyDay(b.time); if (d == null) continue;
    if (!cur || cur.d !== d) { cur = { d, t: b.time, open: b.open, high: b.high, low: b.low, close: b.close, i0: null }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
const monday = (d) => d - ((new Date(d * D * 1000).getUTCDay() + 6) % 7);
export function weeks(ds) { const w = []; for (const x of ds) { const k = monday(x.d), c = w.at(-1);
  if (!c || c.k !== k) w.push({ k, high: x.high, low: x.low, close: x.close }); else { c.high = Math.max(c.high, x.high); c.low = Math.min(c.low, x.low); c.close = x.close; } } return w; }
// weekly structure after each completed week: +1 / -1 / 0 (2-bar fractals, confirmed two weeks later)
export function weekState(w) {
  const st = []; let s = 0, sh = null, sl = null;
  for (let i = 0; i < w.length; i++) {
    const j = i - 2;
    if (j >= 2) { if (w[j].high > w[j - 1].high && w[j].high > w[j - 2].high && w[j].high >= w[j + 1].high && w[j].high >= w[j + 2].high) sh = w[j].high;
      if (w[j].low < w[j - 1].low && w[j].low < w[j - 2].low && w[j].low <= w[j + 1].low && w[j].low <= w[j + 2].low) sl = w[j].low; }
    if (sh != null && w[i].close > sh) s = 1; else if (sl != null && w[i].close < sl) s = -1;
    st.push(s);
  }
  return st;
}
// signals: { side, d (index of the signal day), stop } for the rule ('rule') and the baseline ('base')
export function signals(ds, wk, wst, thr = 0.7, side = 1) {
  const wIdx = new Map(wk.map((x, i) => [x.k, i])), out = [];
  for (let i = 1; i < ds.length - 1; i++) {
    const x = ds[i], wi = wIdx.get(monday(x.d)) - 1, s = wi >= 0 ? wst[wi] : 0; if (s !== side) continue;   // the last COMPLETED week
    const rng = x.high - x.low; if (!(rng > 0)) continue;
    const pos = side > 0 ? (x.close - x.low) / rng : (x.high - x.close) / rng, beyond = side > 0 ? x.close > ds[i - 1].low : x.close < ds[i - 1].high;
    const stop = side > 0 ? x.low - BUF : x.high + BUF;
    out.push({ i, d: x.d, stop, base: true, rule: beyond && pos >= thr });
  }
  return out;
}
// one trade on H1 candles from the next day's first candle: stop first in a candle holding both, out at the 10th day's close
export function simulate(h1, dayStartIdx, ds, sg, rr, side = 1) {
  const e = ds[sg.i + 1], k0 = dayStartIdx.get(e.d); if (k0 == null) return null;
  const entry = h1[k0].open, risk = side > 0 ? entry - sg.stop : sg.stop - entry; if (!(risk > 0)) return null;
  const tgt = entry + side * rr * risk, lastDay = ds[Math.min(ds.length - 1, sg.i + HOLD)].d;
  let exit = null, how = 'time', k = k0;
  for (; k < h1.length; k++) { const b = h1[k], d = nyDay(b.time); if (d == null) continue; if (d > lastDay) break;
    const hitS = side > 0 ? b.low <= sg.stop : b.high >= sg.stop, hitT = side > 0 ? b.high >= tgt : b.low <= tgt;
    if (hitS) { exit = side > 0 ? Math.min(b.open, sg.stop) : Math.max(b.open, sg.stop); how = 'stop'; break; }
    if (hitT) { exit = tgt; how = 'target'; break; }
    exit = b.close; }
  if (exit == null) return null;
  const R = side * (exit - entry) / risk;
  return { d: sg.d, entryT: h1[k0].time, entry, stop: sg.stop, risk, R, net: R - COST / risk, how };
}
export function stats(T) {
  const n = T.length, s = T.reduce((a, x) => a + x.net, 0), m = n ? s / n : 0, sd = n > 1 ? Math.sqrt(T.reduce((a, x) => a + (x.net - m) ** 2, 0) / (n - 1)) : 0;
  const win = T.filter((x) => x.net > 0).reduce((a, x) => a + x.net, 0), loss = -T.filter((x) => x.net < 0).reduce((a, x) => a + x.net, 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, avg: +m.toFixed(3), total: +s.toFixed(1), pf: loss ? +(win / loss).toFixed(2) : null, wr: n ? +(T.filter((x) => x.net > 0).length / n * 100).toFixed(1) : null, t: sd ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, dd: +dd.toFixed(1), sd };
}
export function welch(a, b) { const A = stats(a), B = stats(b); const se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n); return { lift: +(A.avg - B.avg).toFixed(3), t: se ? +((A.avg - B.avg) / se).toFixed(2) : null }; }
const oneAtATime = (T) => { const out = []; let free = 0; for (const x of T.sort((a, b) => a.entryT - b.entryT)) { if (x.entryT < free) continue; out.push(x); free = x.exitT || x.entryT + 10 * D; } return out; };

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * H);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`); from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = days(h1), wk = weeks(ds), wst = weekState(wk), start = new Map();
  h1.forEach((b, k) => { const d = nyDay(b.time); if (d != null && !start.has(d)) start.set(d, k); });
  const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
  const run = (side, thr, rr) => { const S = signals(ds, wk, wst, thr, side), R = [], B = [];
    for (const sg of S) { const tr = simulate(h1, start, ds, sg, rr, side); if (!tr) continue; B.push(tr); if (sg.rule) R.push(tr); } return { R, B }; };
  const P = { oos: ['2006-01-01', '2022-10-31'], a: ['2006-01-01', '2019-12-31'], b: ['2020-01-01', '2022-10-31'], skill: ['2022-11-01', '2099-01-01'] };
  const cut = (T, [f, t]) => T.filter((x) => ymd(x.d) >= f && ymd(x.d) <= t);
  const out = { built: new Date().toISOString().slice(0, 10), data: { from: ymd(ds[0].d), to: ymd(ds.at(-1).d), days: ds.length, h1: h1.length, src: 'OANDA mid H1 XAU_USD via the site proxy' }, rows: {} };
  for (const [name, side, thr, rr] of [['long 0.70 3R', 1, 0.7, 3], ['long 0.70 2R', 1, 0.7, 2], ['long 0.80 3R', 1, 0.8, 3], ['short 0.70 3R', -1, 0.7, 3]]) {
    const { R, B } = run(side, thr, rr), row = {};
    for (const [k, p] of Object.entries(P)) { const r = cut(R, p), b = cut(B, p); row[k] = { rule: stats(r), base: stats(b), ...welch(r, b) }; for (const z of [row[k].rule, row[k].base]) delete z.sd; }
    row.years = {}; for (let y = 2006; y <= 2026; y++) { const r = cut(R, [`${y}-01-01`, `${y}-12-31`]); if (r.length) { const s = stats(r); row.years[y] = { n: s.n, total: s.total, pf: s.pf }; } }
    out.rows[name] = row;
  }
  const p = out.rows['long 0.70 3R'];
  out.verdict = p.oos.lift > 0 && p.oos.t >= 2 && p.a.rule.pf > 1 && p.b.rule.pf > 1 ? 'PASS' : 'FAIL';
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [name, row] of Object.entries(out.rows)) { console.log(`\n${name}`); for (const k of Object.keys(P)) { const x = row[k]; console.log(`  ${k.padEnd(6)} rule n ${x.rule.n} avg ${x.rule.avg} pf ${x.rule.pf} wr ${x.rule.wr} dd ${x.rule.dd} | base n ${x.base.n} avg ${x.base.avg} pf ${x.base.pf} | lift ${x.lift} t ${x.t}`); } }
  console.log('\nverdict', out.verdict);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
