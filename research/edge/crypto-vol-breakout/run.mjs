// Edge research · crypto-vol-breakout: gold-vol-breakout's T1 rule, unchanged, on BTC and ETH, every UTC day
// (PREREGISTRATION.md, committed alone first). Paper research only.
//   git show origin/council-data:research/candles/crypto5m/BTCUSDT_5m.json.gz > <dir>/BTC.json.gz   (and ETH)
//   node research/edge/crypto-vol-breakout/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { daySkip, vbTrade, placeboTrade, normP, holm, rng, summary } from '../index-vol-breakout/original.mjs';
import { tradeCost } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const COINS = ['BTC', 'ETH'];
export const K = 0.5, EXIT_S = 21 * 3600, DAY = 86400;
export const W = { IS: ['2022-01-01', '2023-12-31'], OOS: ['2024-01-01', '2026-10-31'] };
export const SEEDS = 40, PLACEBO = { from: 3600, to: 18 * 3600 };
const M = { group: 'Crypto' };
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

// every UTC day: its 00:00-20:55 candles, and the whole previous calendar day's range
export function buildDays(rows) {
  const by = new Map();
  for (const r of rows) { const d0 = Math.floor(r[0] / DAY) * DAY; if (!by.has(d0)) by.set(d0, []); by.get(d0).push(r); }
  const days = [];
  for (const d0 of [...by.keys()].sort((a, b) => a - b)) {
    const prev = by.get(d0 - DAY);
    const prevRange = prev ? Math.max(...prev.map((r) => r[2])) - Math.min(...prev.map((r) => r[3])) : null;
    const bars = by.get(d0).filter((r) => r[0] - d0 < EXIT_S).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
    days.push({ day: ymdOf(d0), d0, dow: new Date(d0 * 1000).getUTCDay(), bars, prevRange });
  }
  return days;
}
// the pre-registered cost: fills.mjs tradeCost for a crypto market order with a non-target exit (0.06 % of the entry)
export function costPx(x) { const c = tradeCost({ entry: x.entry, stop: x.stop, entryMode: 'market', exitKind: 'time' }, M); return c.costR * Math.abs(x.entry - x.stop); }
export function charge(x) { const c = costPx(x); return { ...x, cost: c, net: x.R - c / x.r, net2: x.R - 2 * c / x.r }; }
export const pool = (days) => days.filter((d) => (inW(d.day, W.IS) || inW(d.day, W.OOS)) && !daySkip(d));
export function trades(coin, days) {
  const tr = [];
  for (const d of pool(days)) {
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    tr.push({ day: d.day, dow: d.dow, coin, ...charge(x) });
  }
  return tr;
}
export function placeboTrades(coin, days, seed) {
  const P = pool(days).filter((d) => inW(d.day, W.OOS)), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), tr = [];
  for (const d of P) {
    const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (x) tr.push({ day: d.day, coin, ...charge(x) });
  }
  return tr;
}
export function judge(tr, pl) {
  const s = (f) => summary(tr.filter(f)), is = s((t) => inW(t.day, W.IS)), oos = s((t) => inW(t.day, W.OOS));
  const oosTr = tr.filter((t) => inW(t.day, W.OOS));
  return { is, oos, beaten: pl.filter((v) => oos.netR > v).length, placebo: pl, p: normP(oos.t),
    weekend: summary(oosTr.filter((t) => t.dow === 0 || t.dow === 6)).netR, weekday: summary(oosTr.filter((t) => t.dow > 0 && t.dow < 6)).netR };
}
export function decide(series) {
  const keys = Object.keys(series), adj = holm(keys.map((k) => series[k].p));
  keys.forEach((k, i) => {
    const r = series[k]; r.holm = r3(adj[i]);
    r.checks = { bothWindows: r.is.netR > 0 && r.oos.netR > 0, t2: r.oos.t >= 2 && adj[i] < 0.05, cost2x: r.oos.net2R >= 0, placebo: r.beaten >= 38, n200: r.oos.n >= 200 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  return series;
}
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function verdictLine(S) {
  const p = S.pool, n = Object.values(S).filter((r) => r.pass).length;
  return `${p.pass ? 'PASS' : 'FAIL'}, ${n} of 3: T1 breakout on BTC + ETH pooled, confirmation 2024-01 → 2026-10 ${sg(p.oos.netR)}R a trade net (n ${p.oos.n}, month t ${sg(p.oos.t, 2)}; gross ${sg(p.oos.grossR)}R), discovery 2022-23 ${sg(p.is.netR)}R (n ${p.is.n}); ${p.beaten} of 40 placebos beaten`;
}
export function report(R) {
  const L = ['# The T1 volatility breakout on Bitcoin and Ether (24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, data, windows, cost and pass bar were fixed in `PREREGISTRATION.md` (committed alone before this run). `vbTrade` / `placeboTrade` imported from `index-vol-breakout/original.mjs` (sha256 checked). Nothing live changed; no proposal.', '',
    '| Test | Window | n | Win | Net R/trade | Gross R/trade | Net 2x cost | Cost R/trade | Total R | Month t | Max DD R |',
    '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, r] of Object.entries(R.series)) for (const [w, s] of [['2022-23', r.is], ['2024 → 2026-10', r.oos]])
    L.push(`| ${k} | ${w} | ${s.n} | ${(s.win * 100).toFixed(1)} % | ${sg(s.netR)} | ${sg(s.grossR)} | ${sg(s.net2R)} | ${sg(s.costR)} | ${sg(s.total, 2)} | ${sg(s.t, 2)} | ${sg(s.maxDD, 2)} |`);
  L.push('', '| Test | Holm p | Placebos beaten (confirmation) | Placebo median | Both windows > 0 | t ≥ 2 + Holm | 2x cost ≥ 0 | ≥ 38 placebos | n ≥ 200 | Pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(R.series)) { const c = r.checks, y = (b) => (b ? 'yes' : 'no'), med = [...r.placebo].sort((a, b) => a - b)[20];
    L.push(`| ${k} | ${r.holm.toFixed(3)} | ${r.beaten} of 40 | ${sg(med)} | ${y(c.bothWindows)} | ${y(c.t2)} | ${y(c.cost2x)} | ${y(c.placebo)} | ${y(c.n200)} | ${r.pass ? 'yes' : 'no'} |`); }
  L.push('', '## Reported only', '');
  for (const [k, r] of Object.entries(R.series)) L.push(`- ${k}, confirmation: buys ${sg(r.oos.buys.netR)}R (n ${r.oos.buys.n}), sells ${sg(r.oos.sells.netR)}R (n ${r.oos.sells.n}); weekend days ${sg(r.weekend)}R, weekdays ${sg(r.weekday)}R; median stop ${r.oos.medianStop}; by year ${Object.entries({ ...r.is.byYear, ...r.oos.byYear }).map(([y, v]) => `${y} ${sg(v.netR)} (n ${v.n})`).join(', ')}.`);
  L.push('', '## Reading', '', R.reading, '',
    `Cost: \`tradeCost\` of \`council/fills.mjs\` for a crypto market order with a non-target exit = 0.06 % of the entry price a round trip (CFD_CRYPTO 0.04 % + half a 0.02 % spread on entry and exit); ASSUMED, the demo broker's crypto quotes were not measured. No financing (every trade is out by 21:00 UTC). Data: Binance spot M5 from council-data \`research/candles/crypto5m\`, ${R.data.map((d) => `${d.coin} ${d.first} → ${d.last} (${d.candles} candles, ${d.days} days)`).join('; ')}. 2018-21 is not on file and every exchange host was refused by the network proxy, so the discovery window is 2022-23 (pre-registered).`, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd !== 'run' || !dir) { console.error('usage: run.mjs run <dir with BTC.json.gz ETH.json.gz>'); process.exit(1); }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('original.mjs changed');
  const series = {}, data = [], all = [], plAll = Array.from({ length: SEEDS }, () => []);
  for (const coin of COINS) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${coin}.json.gz`))).toString());
    const days = buildDays(rows), tr = trades(coin, days), pl = [];
    for (let s = 1; s <= SEEDS; s++) { const p = placeboTrades(coin, days, s); plAll[s - 1].push(...p); pl.push(r3(mean(p.map((x) => x.net)))); }
    series[coin] = judge(tr, pl); all.push(...tr);
    data.push({ coin, first: ymdOf(rows[0][0]), last: ymdOf(rows.at(-1)[0]), candles: rows.length, days: days.length });
    console.log(coin, tr.length);
  }
  all.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  series.pool = judge(all, plAll.map((p) => r3(mean(p.map((x) => x.net)))));
  decide(series);
  const R = { study: 'crypto-vol-breakout', at: new Date().toISOString(), prereg: crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex'),
    originalSha: sha, windows: W, k: K, costPct: 0.06, data, series };
  R.verdict = verdictLine(series);
  R.reading = process.env.READING || '';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict);
}
