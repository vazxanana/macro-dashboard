// AUD/NZD z-score mean reversion on daily candles (research/edge/audnzd-revert/PREREGISTRATION.md, committed first).
// Research only: nothing here is read by the council, the mirror or any page; no order code.
//   node research/edge/audnzd-revert/run.mjs fetch <dir>   copies council-data research/daily/{audnzd,audcad,eurgbp}.json
//                                                         (git show origin/council-data, no network) into <dir>, outside git
//   node research/edge/audnzd-revert/run.mjs full <dir>    writes result.json and RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const VARIANTS = [
  { id: 'V1', name: 'SMA20 / SD20, z beyond ±2', N: 20, Z: 2 },
  { id: 'V2', name: 'SMA20 / SD20, z beyond ±2.5', N: 20, Z: 2.5 },
  { id: 'V3', name: 'SMA50 / SD50, z beyond ±2', N: 50, Z: 2 },
];
export const P = { atrN: 14, stopAtr: 1.5, hold: 10 };
export const COST = { spreadPx: 0.0001, slipPx: 0.0001, commRT: 0.000045, finYear: 0.02 };
export const WINDOWS = { rep: { from: '2008-01-01', to: '2016-01-01' }, dec: { from: '2016-01-01', to: null } };
export const BAR = { minN: 60, minT: 2, alpha: 0.05 };
export const PLACEBO = { draws: 40, seed: 20261113 };
export const MAIN = 'audnzd', SIDE = ['audcad', 'eurgbp'];

const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

// candle file rows [t, o, h, l, c, v] -> trading-day bars (weekend stubs folded into the next weekday)
export function barsOf(file) {
  return foldWeekend(file.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}

// indicators at each close i, from closes / candles up to and including i only
export function indicators(bars, N, atrN = P.atrN) {
  const n = bars.length, sma = new Array(n).fill(null), sd = new Array(n).fill(null), atr = new Array(n).fill(null);
  for (let i = N - 1; i < n; i++) {
    let s = 0; for (let k = i - N + 1; k <= i; k++) s += bars[k].close;
    const m = s / N; let v = 0; for (let k = i - N + 1; k <= i; k++) v += (bars[k].close - m) ** 2;
    sma[i] = m; sd[i] = Math.sqrt(v / (N - 1));
  }
  for (let i = atrN; i < n; i++) {
    let s = 0;
    for (let k = i - atrN + 1; k <= i; k++) { const pc = bars[k - 1].close; s += Math.max(bars[k].high, pc) - Math.min(bars[k].low, pc); }
    atr[i] = s / atrN;
  }
  return { sma, sd, atr, z: sma.map((m, i) => (m == null || !(sd[i] > 0) ? null : (bars[i].close - m) / sd[i])) };
}

// one trade from a signal at close i in direction dir (+1 buy, -1 sell); null when it has not closed by the end of the data
export function tradeFrom(bars, ind, i, dir) {
  const e = i + 1; if (e >= bars.length || !(ind.atr[i] > 0)) return null;
  const entry = bars[e].open, risk = P.stopAtr * ind.atr[i], stop = entry - dir * risk;
  for (let j = e; j < bars.length; j++) {
    const b = bars[j];
    if (dir > 0 ? b.open <= stop : b.open >= stop) return done(j, b.open, 'stop-gap', b.time);
    if (dir > 0 ? b.low <= stop : b.high >= stop) return done(j, stop, 'stop', b.time + 43200);
    const m = ind.sma[j];
    if (m != null && (dir > 0 ? b.close >= m : b.close <= m)) return done(j, b.close, 'mean', b.time + 86400);
    if (j - e + 1 >= P.hold) return done(j, b.close, 'time', b.time + 86400);
  }
  return null;
  function done(j, px, why, closed) {
    return { sig: i, e, x: j, dir, entry, stop, risk, exit: px, why, opened: bars[e].time, closed, R: (px - entry) * dir / risk };
  }
}

// cost of one trade in R: spread + slippage + commission + financing (rate a year, either side)
export function costOf(t, finYear = COST.finYear) {
  const px = COST.spreadPx + COST.slipPx + COST.commRT * t.entry + finYear / 365 * t.entry * nights(t.opened, t.closed);
  return px / t.risk;
}

// every trade of a variant, one position at a time, over the whole series
export function simulate(bars, v) {
  const ind = indicators(bars, v.N), out = [];
  let free = 0;
  for (let i = 0; i < bars.length - 1; i++) {
    if (i < free) continue;
    const z = ind.z[i]; if (z == null || ind.atr[i] == null) continue;
    const dir = z >= v.Z ? -1 : z <= -v.Z ? 1 : 0; if (!dir) continue;
    const t = tradeFrom(bars, ind, i, dir); if (!t) break;
    out.push(t); free = t.x; // a signal from the exit bar's close on
  }
  return out;
}

const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthsBetween(fromT, toT) {
  const out = []; const d = new Date(fromT * 1000); d.setUTCDate(1);
  while (d.getTime() / 1000 < toT) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}
export function tStat(xs) {
  const n = xs.length; if (n < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / n, v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  return v > 0 ? m / Math.sqrt(v / n) : null;
}
// one-sided p of a t from the normal approximation
export function pOneSided(t) {
  if (!Number.isFinite(t)) return 1;
  const x = t / Math.SQRT2, a = 1 / (1 + 0.3275911 * Math.abs(x));
  const erf = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-x * x);
  return 0.5 * (1 - (x >= 0 ? erf : -erf));
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, out = new Array(m);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; });
  return out;
}

// statistics of the trades entered in [fromT, toT); months from fromT to toT (exclusive)
export function stats(trades, fromT, toT, finYear = COST.finYear) {
  const ts = trades.filter((t) => t.opened >= fromT && t.opened < toT);
  const net = ts.map((t) => t.R - costOf(t, finYear)), n = ts.length, sum = (a) => a.reduce((x, y) => x + y, 0);
  const months = monthsBetween(fromT, toT), byM = Object.fromEntries(months.map((m) => [m, 0]));
  ts.forEach((t, k) => { const m = monthOf(t.closed); if (m in byM) byM[m] += net[k]; else byM[m] = net[k]; });
  const mt = tStat(Object.values(byM));
  let cum = 0, hi = 0, dd = 0; for (const x of net) { cum += x; hi = Math.max(hi, cum); dd = Math.min(dd, cum - hi); }
  const win = net.filter((x) => x > 0), loss = net.filter((x) => x <= 0);
  const why = {}; for (const t of ts) why[t.why] = (why[t.why] || 0) + 1;
  return {
    n, avg: n ? r3(sum(net) / n) : null, gross: n ? r3(sum(ts.map((t) => t.R)) / n) : null, cost: n ? r3(sum(ts.map((t) => costOf(t, finYear))) / n) : null,
    total: r2(sum(net)), wr: n ? r2(win.length / n * 100) : null, pf: loss.length && sum(loss) < 0 ? r2(sum(win) / -sum(loss)) : null,
    months: Object.keys(byM).length, monthT: r2(mt), p: mt == null ? 1 : Math.round(pOneSided(mt) * 10000) / 10000, dd: r2(dd), exits: why,
  };
}

// seeded random numbers
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// random entries with the same exits: `draws` draws of n trades each, net R a trade per draw
export function placebo(bars, v, n, fromT, toT, { draws = PLACEBO.draws, seed = PLACEBO.seed } = {}) {
  const ind = indicators(bars, v.N), rnd = mulberry32(seed), ok = [];
  for (let i = 0; i < bars.length - 1; i++) if (ind.z[i] != null && ind.atr[i] != null && bars[i + 1].time >= fromT && bars[i + 1].time < toT) ok.push(i);
  const out = [];
  if (!n || !ok.length) return out;
  for (let d = 0; d < draws; d++) {
    let s = 0, k = 0, tries = 0;
    while (k < n && tries < n * 20) {
      tries++;
      const i = ok[Math.floor(rnd() * ok.length)], dir = rnd() < 0.5 ? 1 : -1, t = tradeFrom(bars, ind, i, dir);
      if (!t) continue; s += t.R - costOf(t); k++;
    }
    out.push(k ? s / k : null);
  }
  return out;
}
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

// the whole study on loaded files { audnzd, audcad, eurgbp }
export function evaluate(files) {
  const main = barsOf(files[MAIN]), end = main.at(-1).time + 86400;
  const rep = [day(WINDOWS.rep.from), day(WINDOWS.rep.to)], dec = [day(WINDOWS.dec.from), end];
  const rows = VARIANTS.map((v) => {
    const tr = simulate(main, v), d = stats(tr, ...dec), r = stats(tr, ...rep);
    const pl = placebo(main, v, d.n, ...dec).filter((x) => x != null);
    return {
      id: v.id, name: v.name, N: v.N, Z: v.Z, rep: r, dec: d,
      fin0: stats(tr, ...dec, 0).avg, fin4: stats(tr, ...dec, 0.04).avg,
      placebo: { draws: pl.length, median: r3(pct(pl, 0.5)), p5: r3(pct(pl, 0.05)), p95: r3(pct(pl, 0.95)), atLeastReal: pl.filter((x) => x >= d.avg).length },
    };
  });
  const adj = holm(rows.map((x) => x.dec.p));
  rows.forEach((x, k) => {
    x.holmP = Math.round(adj[k] * 10000) / 10000;
    x.pass = x.dec.n >= BAR.minN && x.dec.avg > 0 && x.dec.monthT >= BAR.minT && x.holmP < BAR.alpha && x.rep.avg > 0;
    x.aboveRandom = x.dec.avg > x.placebo.p95;
  });
  const side = {};
  for (const k of SIDE) {
    if (!files[k]) continue;
    const b = barsOf(files[k]), e = b.at(-1).time + 86400;
    side[k] = VARIANTS.map((v) => { const tr = simulate(b, v); return { id: v.id, rep: stats(tr, ...rep), dec: stats(tr, day(WINDOWS.dec.from), e) }; });
  }
  const passed = rows.filter((x) => x.pass).map((x) => x.id);
  return {
    study: 'audnzd-revert', title: 'AUD/NZD daily z-score mean reversion', built: '2026-11-13', preregistration: 'PREREGISTRATION.md',
    system: 'AUD/NZD daily z-score fade (not a council system)',
    verdict: passed.length ? `PASS, ${passed.length} of 3 variants (${passed.join(', ')})` : 'FAIL, 0 of 3 variants: the AUD/NZD z-score fade is not an edge after costs',
    data: { src: 'OANDA mid daily AUD_NZD, council-data research/daily/audnzd.json', from: new Date(main[0].time * 1000).toISOString().slice(0, 10), to: new Date(main.at(-1).time * 1000).toISOString().slice(0, 10), bars: main.length },
    params: P, cost: COST, windows: WINDOWS, bar: BAR, placeboSpec: PLACEBO, variants: rows, descriptive: side,
  };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
export function report(res) {
  const V = res.variants, L = [];
  const best = [...V].sort((a, b) => (b.dec.monthT ?? -9) - (a.dec.monthT ?? -9))[0];
  L.push('# Result: AUD/NZD daily z-score mean reversion (13 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone first). The best decisive month-sum t is ${f2(best.dec.monthT)} (${best.id}, n ${best.dec.n}, ${f3(best.dec.avg)}R a trade net). Nothing live changed.`, '');
  L.push(`Data: ${res.data.src}, ${res.data.from} to ${res.data.to}, ${res.data.bars} trading days (weekend stubs folded). Entry at the next daily open after z reaches the threshold either side, stop 1.5 x ATR(14), exit at the SMA cross, the stop or after 10 days, one position at a time. Costs stated (AUD/NZD is not in the demo broker's symbol file): 2.0 pips a round trip (1.0 spread + 1.0 slippage), commission 0.000045 x price, financing 2.0 % a year on either side.`, '');
  L.push('| Variant | Window | n | Net R a trade | Gross | Cost | Win % | PF | Month-sum t | p (one-sided) | Holm p | Worst drawdown |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const x of V) for (const [w, s] of [['2016-now (decisive)', x.dec], ['2008-15', x.rep]])
    L.push(`| ${x.id} ${x.name} | ${w} | ${s.n} | ${f3(s.avg)} | ${f3(s.gross)} | ${f3(s.cost)} | ${f2(s.wr)} | ${f2(s.pf)} | ${f2(s.monthT)} | ${w.startsWith('2016') ? s.p : '-'} | ${w.startsWith('2016') ? x.holmP : '-'} | ${f2(s.dd)}R |`);
  L.push('', '## Against the bar', '');
  for (const x of V) L.push(`- **${x.id}**: ${x.pass ? 'PASS' : 'fail'} (decisive n ${x.dec.n} vs 60, net ${f3(x.dec.avg)}R, month-sum t ${f2(x.dec.monthT)} vs 2, Holm p ${x.holmP}, 2008-15 net ${f3(x.rep.avg)}R).`);
  L.push('', '## Exits (decisive window)', '');
  for (const x of V) L.push(`- ${x.id}: ${Object.entries(x.dec.exits).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  L.push('', '## Financing sensitivity (decisive net R a trade; not judged)', '');
  for (const x of V) L.push(`- ${x.id}: 0 % ${f3(x.fin0)}, 2 % ${f3(x.dec.avg)}, 4 % ${f3(x.fin4)}`);
  L.push('', '## Placebo: random entries with the same exits (decisive window, 40 seeded draws each)', '');
  L.push('| Variant | Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |', '|---|---|---|---|---|---|');
  for (const x of V) L.push(`| ${x.id} | ${f3(x.dec.avg)} | ${f3(x.placebo.median)} | ${f3(x.placebo.p5)} | ${f3(x.placebo.p95)} | ${x.placebo.atLeastReal} of ${x.placebo.draws} |`);
  L.push('', '## AUD/CAD and EUR/GBP (descriptive only, not judged)', '');
  L.push('| Market | Variant | 2016-now n | Net R a trade | Month-sum t | 2008-15 n | Net R a trade | Month-sum t |', '|---|---|---|---|---|---|---|---|');
  for (const [k, rows] of Object.entries(res.descriptive)) for (const x of rows)
    L.push(`| ${k} | ${x.id} | ${x.dec.n} | ${f3(x.dec.avg)} | ${f2(x.dec.monthT)} | ${x.rep.n} | ${f3(x.rep.avg)} | ${f2(x.rep.monthT)} |`);
  L.push('', '## What it means', '');
  L.push(res.variants.some((x) => x.pass)
    ? 'A variant cleared the pre-registered bar. At most a proposal for a paper shadow, for the owner to decide; no live change.'
    : 'No variant clears the pre-registered bar: fading a daily z-score stretch on AUD/NZD is not a tradeable edge after costs on this data. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; any other threshold, length, stop or exit would need its own pre-registration on other data.');
  L.push('', 'To repeat: `node research/edge/audnzd-revert/run.mjs fetch <dir>` (git show from origin/council-data, no network; kept out of git), then `node research/edge/audnzd-revert/run.mjs full <dir>`. Tests: `tests/audnzd-revert.test.mjs`.', '');
  return L.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir || !['fetch', 'full'].includes(cmd)) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of [MAIN, ...SIDE]) {
      const txt = execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { cwd: path.join(HERE, '../../..'), maxBuffer: 64 << 20 });
      fs.writeFileSync(path.join(dir, `${k}.json`), txt); console.log('saved', k);
    }
  } else {
    const files = {};
    for (const k of [MAIN, ...SIDE]) { const f = path.join(dir, `${k}.json`); if (fs.existsSync(f)) files[k] = JSON.parse(fs.readFileSync(f, 'utf8')); }
    const res = evaluate(files);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict); for (const x of res.variants) console.log(x.id, JSON.stringify(x.dec), 'rep', x.rep.avg, x.rep.n, 'holm', x.holmP, 'pl', JSON.stringify(x.placebo));
  }
}
