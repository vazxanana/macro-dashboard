// Edge research · gold-volume-spike: an H1 candle of spot gold whose OANDA tick volume is over 3x the median of that New York
// hour over the 20 earlier days: does the next four hours continue (T1 every spike, T3 a strong close) or reverse (T2 a close in
// the outer quarter, faded)? As fixed in PREREGISTRATION.md (committed and pushed alone first).
//   node --use-env-proxy research/edge/gold-volume-spike/fetch.mjs <dir>   (OANDA M5 with volume, kept out of git)
//   node research/edge/gold-volume-spike/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Stand-alone study: not a gate, exit, entry or size of the live gold book; no candle before 2016 (owner decision 44).
// Pure pieces are exported for tests/gold-volume-spike.test.mjs. Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { nights, FIN } from '../../../council/fills.mjs';
import { HISTORY, EVENTS } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300, H1 = 3600;
export const P = Object.freeze({
  MULT: 3, LOOK: 20, MIN_M5: 10, Q_HI: 0.75, Q_LO: 0.25, BUF: 0.30, MIN_DIST: 1.0, HOLD: 4 * H1, LATE: 900,
  SPREAD: 0.30, SLIP: 0.15, SEEDS: 40, Q: 0.95, REDRAW: 50,
  FROM: '2016-01-01', IS: ['2016-01-01', '2021-01-01'], OOS: ['2021-01-01', '2100-01-01'],
});
export const TESTS = Object.freeze({
  T1: 'Continuation: every spike, with the candle (primary, listed first)',
  T2: 'Reversal: spike closing in an outer quarter, against the close',
  T3: 'Continuation with a strong close: outer-quarter spike, with the close',
});
const FIN_RATE = FIN.xau.long;

// ── H1 candles from M5 rows [t,o,h,l,c,v] (sorted): one per UTC clock hour with at least MIN_M5 candles ──
export function buildH1(rows) {
  const out = []; let i = 0;
  while (i < rows.length) {
    const hr = Math.floor(rows[i][0] / H1) * H1; let j = i, h = -Infinity, l = Infinity, v = 0;
    while (j < rows.length && rows[j][0] < hr + H1) { h = Math.max(h, rows[j][2]); l = Math.min(l, rows[j][3]); v += Math.max(0, rows[j][5] || 0); j++; }
    if (j - i >= P.MIN_M5) out.push({ t: hr, o: rows[i][1], h, l, c: rows[j - 1][4], v, n: j - i, i0: i, i1: j });
    i = j;
  }
  return out;
}
export const hourKey = (t) => (((Math.floor(t / H1) - nyOffsetH(t)) % 24) + 24) % 24;
const nyDate = (t) => new Date((t - nyOffsetH(t) * H1) * 1000).toISOString().slice(0, 10);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// baseline of each H1 candle: median volume of the LOOK latest earlier candles of its hour key, one per earlier New York day
export function markSpikes(h1) {
  const q = new Map();
  for (const x of h1) {
    const k = hourKey(x.t), d = nyDate(x.t), list = q.get(k) || [];
    const prior = list.filter((e) => e.d !== d).slice(-P.LOOK);
    x.key = k; x.base = prior.length === P.LOOK ? median(prior.map((e) => e.v)) : null;
    x.spike = x.base != null && x.v > P.MULT * x.base;
    x.dir = x.c > x.o ? 1 : x.c < x.o ? -1 : 0;
    x.cl = x.h > x.l ? (x.c - x.l) / (x.h - x.l) : null;
    x.cls = x.cl == null ? null : x.cl >= P.Q_HI ? 1 : x.cl <= P.Q_LO ? -1 : 0;
    if (!list.length || list.at(-1).d !== d) { list.push({ d, v: x.v }); if (list.length > P.LOOK + 5) list.shift(); }
    q.set(k, list);
  }
  return h1;
}

// side of each test for a candle (0 = no trade)
export function sideOf(T, x) {
  if (T === 'T1') return x.dir;
  if (x.cls == null || x.cls === 0) return 0;
  return T === 'T2' ? -x.cls : x.cls;
}
// the trade spec of a candle: entry at the next M5 open (<= LATE after the hour), stop past the far extreme
export function specOf(rows, x, side) {
  if (!side) return { skip: 'no side' };
  const k = x.i1, end = x.t + H1;
  if (k >= rows.length || rows[k][0] - end > P.LATE) return { skip: 'no prompt next open' };
  const entry = rows[k][1], stop = side > 0 ? x.l - P.BUF : x.h + P.BUF;
  if (side * (entry - stop) <= 0) return { skip: 'open beyond stop' };
  if (Math.abs(entry - stop) < P.MIN_DIST) return { skip: 'stop under $1' };
  return { k, side, entry, stop, t0: rows[k][0] };
}
// one trade on the M5 rows; cm = cost multiple
export function sim(rows, s, cm = 1) {
  const { side, entry, stop } = s, dist = Math.abs(entry - stop), tEnd = s.t0 + P.HOLD;
  let exit = null, how = null, tx = null, i = s.k;
  for (; i < rows.length && rows[i][0] < tEnd; i++) {
    const r = rows[i];
    if (i > s.k && (side > 0 ? r[1] <= stop : r[1] >= stop)) { exit = r[1]; how = 'gap'; tx = r[0] + M5; break; }
    if (side > 0 ? r[3] <= stop : r[2] >= stop) { exit = stop; how = 'stop'; tx = r[0] + M5; break; }
  }
  if (exit == null) { const r = rows[Math.max(s.k, i - 1)]; exit = r[4]; how = 'time'; tx = r[0] + M5; }
  const nn = side > 0 ? nights(s.t0, tx) : 0, fin = nn * FIN_RATE * entry;
  const cost = cm * (P.SPREAD + 2 * P.SLIP);
  const gross = side * (exit - entry) / dist;
  return { side, entry, stop, exit, how, dist, t0: s.t0, tx, nights: nn, gross, cost, fin, net: gross - (cost + fin) / dist };
}

// ── release tags: a CPI / NFP / FOMC time inside the H1 candle ──
export function releaseTimes() {
  const ty = new Set(['CPI', 'NFP', 'FOMC']), ts = new Set();
  let base = { rows: [] };
  try { base = JSON.parse(fs.readFileSync(path.join(HERE, '../../../council/event-base.json'), 'utf8')); } catch { /* none */ }
  for (const r of base.rows || []) if (ty.has(r.type) && Number.isFinite(r.t)) ts.add(r.t);
  for (const e of [...HISTORY, ...EVENTS]) if (ty.has(e.type)) ts.add(e.t);
  return [...ts].sort((a, b) => a - b);
}
export const tagged = (x, times) => times.some((t) => t >= x.t && t < x.t + H1);

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, t: null };
  const m = xs.reduce((a, x) => a + x, 0) / n, v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return { n, mean: m, t: v > 0 ? m / Math.sqrt(v / n) : null };
}
const mon = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(tr, key = 'net') {
  const m = new Map(); for (const r of tr) m.set(mon(r.t0), (m.get(mon(r.t0)) || 0) + r[key]);
  const s = tstat([...m.values()]); return { months: s.n, t: s.t };
}
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inW = (t, w) => day(t) >= w[0] && day(t) < w[1];
function summary(tr) {
  const n = tr.length, mean = (k) => (n ? tr.reduce((a, r) => a + r[k], 0) / n : null);
  const mt = monthT(tr, 'net'), mg = monthT(tr, 'gross');
  let run = 0, pk = 0, dd = 0; for (const r of tr) { run += r.net; pk = Math.max(pk, run); dd = Math.min(dd, run - pk); }
  const why = {}; for (const r of tr) why[r.how] = (why[r.how] || 0) + 1;
  return { n, buys: tr.filter((r) => r.side > 0).length, gross: r3(mean('gross')), net: r3(mean('net')), net2: r3(mean('net2')),
    totalNet: r2(tr.reduce((a, r) => a + r.net, 0)), win: r3(n ? tr.filter((r) => r.net > 0).length / n : null), maxDD: r2(dd),
    stop$: r2(n ? median(tr.map((r) => r.dist)) : null), months: mt.months, t: r2(mt.t), tGross: r2(mg.t),
    p: mt.t == null ? null : Math.round(normSf(mt.t) * 10000) / 10000, why };
}

// a stream: spike candles in time order, one position at a time
export function stream(rows, cands, T) {
  const tr = [], skips = {}; let busy = -Infinity;
  for (const x of cands) {
    const side = sideOf(T, x); if (!side) continue;
    const s = specOf(rows, x, side);
    if (s.skip) { skips[s.skip] = (skips[s.skip] || 0) + 1; continue; }
    if (s.t0 < busy) { skips['position open'] = (skips['position open'] || 0) + 1; continue; }
    const a = sim(rows, s, 1), b = sim(rows, s, 2);
    tr.push({ ...a, net2: b.net, key: x.key, cls: x.cls, dir: x.dir, spikeT: x.t, tag: !!x.tag });
    busy = a.tx;
  }
  return { tr, skips };
}

export function runAll(rowsAll, times = releaseTimes()) {
  const from = Date.parse(P.FROM + 'T00:00:00Z') / 1000;
  const rows = rowsAll.filter((r) => r[0] >= from);
  const h1 = markSpikes(buildH1(rows));
  for (const x of h1) x.tag = x.spike && tagged(x, times);
  const spikes = h1.filter((x) => x.spike);
  // placebo pools: OOS non-spike candles with a baseline, by hour key and class
  const pool = { dir: new Map(), cls: new Map() };
  for (const x of h1) {
    if (x.spike || x.base == null || !inW(x.t, P.OOS)) continue;
    if (x.dir) { const k = x.key; (pool.dir.get(k) || pool.dir.set(k, []).get(k)).push(x); }
    if (x.cls) { const k = x.key + ':' + x.cls; (pool.cls.get(k) || pool.cls.set(k, []).get(k)).push(x); }
  }
  const tests = {};
  for (const T of Object.keys(TESTS)) {
    const { tr, skips } = stream(rows, spikes, T);
    const is = tr.filter((r) => inW(r.t0, P.IS)), oos = tr.filter((r) => inW(r.t0, P.OOS));
    const means = [];
    for (let seed = 1; seed <= P.SEEDS; seed++) {
      const rnd = mulberry32(seed); let sum = 0, n = 0;
      for (const r of oos) {
        const pl = T === 'T1' ? pool.dir.get(r.key) : pool.cls.get(r.key + ':' + r.cls);
        if (!pl || !pl.length) continue;
        for (let k = 0; k < P.REDRAW; k++) {
          const x = pl[Math.floor(rnd() * pl.length)], s = specOf(rows, x, sideOf(T, x));
          if (s.skip) continue;
          sum += sim(rows, s, 1).net; n++; break;
        }
      }
      means.push(n ? sum / n : null);
    }
    const sorted = [...means].sort((a, b) => a - b), om = oos.length ? oos.reduce((a, r) => a + r.net, 0) / oos.length : -Infinity;
    const byYear = {};
    for (const r of tr) { const y = day(r.t0).slice(0, 4); (byYear[y] = byYear[y] || []).push(r); }
    const un = stream(rows, spikes.filter((x) => !x.tag), T).tr.filter((r) => inW(r.t0, P.OOS));
    const tg = oos.filter((r) => r.tag);
    tests[T] = { label: TESTS[T], skips, is: summary(is), oos: summary(oos),
      placebo: { seeds: P.SEEDS, mean: r3(means.reduce((a, x) => a + x, 0) / means.length), q95: r3(sorted[Math.ceil(P.Q * sorted.length) - 1]),
        max: r3(sorted.at(-1)), beats: means.filter((x) => om > x).length },
      releases: { untagged: summary(un), tagged: summary(tg) },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, rs]) => [y, { n: rs.length, net: r3(rs.reduce((a, r) => a + r.net, 0) / rs.length), gross: r3(rs.reduce((a, r) => a + r.gross, 0) / rs.length) }])) };
  }
  const keys = Object.keys(tests), hp = holm(keys.map((T) => tests[T].oos.p ?? 1));
  keys.forEach((T, i) => {
    const x = tests[T]; x.holm = Math.round(hp[i] * 10000) / 10000;
    const c = { t2: (x.oos.t ?? -9) >= 2 && x.holm <= 0.05, isPos: (x.is.net ?? -1) > 0, costs2: (x.oos.net2 ?? -1) > 0,
      placebo: (x.oos.net ?? -9) > x.placebo.q95, n: x.oos.n >= 100 };
    x.checks = c; x.pass = Object.values(c).every(Boolean);
  });
  const byHour = {}; for (const x of spikes) byHour[x.key] = (byHour[x.key] || 0) + 1;
  const eligible = h1.filter((x) => x.base != null);
  const passed = keys.filter((T) => tests[T].pass);
  return { rows: rows.length, h1: h1.length, eligible: eligible.length, spikes: spikes.length, spikesIS: spikes.filter((x) => inW(x.t, P.IS)).length,
    spikesOOS: spikes.filter((x) => inW(x.t, P.OOS)).length, tagged: spikes.filter((x) => x.tag).length,
    outer: { top: spikes.filter((x) => x.cls === 1).length, bottom: spikes.filter((x) => x.cls === -1).length },
    outerAll: { share: r3(eligible.filter((x) => x.cls).length / eligible.length) },
    byHour, tests, passed, verdict: passed.length ? 'PASS' : 'FAIL' };
}

const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export function headline(res) {
  const T = res.tests, a = T.T1.oos, b = T.T2.oos, c = T.T3.oos;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3 pass${res.passed.length ? ' (' + res.passed.join(', ') + ')' : ''}: OOS 2021-now net R a trade, continuation ${fmt(a.net)} (n ${a.n}, t ${fmt(a.t, 2)}), reversal ${fmt(b.net)} (t ${fmt(b.t, 2)}), strong-close ${fmt(c.net)} (t ${fmt(c.t, 2)}).**`;
}
export function report(res) {
  const T = res.tests, L = [];
  L.push('# Gold activity spike: does an abnormal-activity H1 candle continue or reverse? Result (14 Nov 2026)', '');
  L.push(headline(res), '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot',
    'gold, not a gate, exit, entry or size of the gold book; no candle before 2016 (docs/owner-decisions.md item 44). Paper research',
    'only: nothing live changed and no proposal is written. Volume is OANDA\'s tick count (price updates), a proxy for activity.', '');
  L.push('## Rule (as pre-registered)', '',
    `- OANDA mid XAU/USD M5 with tick volume (\`fetch.mjs\`), from 2016-01-01: ${res.rows} M5 candles, ${res.h1} H1 candles (UTC hours with 10+ M5 candles), ${res.eligible} with a 20-day baseline.`,
    `- Spike = H1 volume over 3x the median of the same New York hour on the 20 earlier days: ${res.spikes} spikes (${res.spikesIS} in 2016-20, ${res.spikesOOS} in 2021-now); ${res.outer.top} closed in the top quarter and ${res.outer.bottom} in the bottom quarter of their range (all eligible candles: ${(res.outerAll.share * 100).toFixed(1)} % in an outer quarter).`,
    '- Entry at the next M5 open (within 15 min of the hour\'s end), stop $0.30 past the spike candle\'s far extreme for the side (≥ $1 away), out after 4 hours; one position at a time per test.',
    '- T1: with the candle\'s direction. T2: against an outer-quarter close (sell a top-quarter close, stop above its high). T3: with an outer-quarter close (buy a top-quarter close, stop under its low).',
    '- Costs: $0.30 spread + $0.15 slippage on entry and on exit ($0.60 a trade; 2× = $1.20); buys pay `FIN.xau.long` per `nights()` rollover.', '');
  L.push('## Results (R of the stop distance; t on calendar-month sums of net R)', '');
  L.push('| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median stop $ | t net | t gross | Holm p (OOS) | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const nm = { T1: 'continuation (all)', T2: 'reversal (outer close)', T3: 'continuation (outer close)' };
  for (const k of Object.keys(T)) {
    for (const [w, s] of [['IS 2016-20', T[k].is], ['OOS 2021-now', T[k].oos]]) {
      const oos = w.startsWith('OOS');
      L.push(`| ${k} ${nm[k]} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1)} | ${fmt(s.totalNet, 2)} | ${fmt(s.maxDD, 2)} | ${s.stop$ == null ? 'n/a' : s.stop$.toFixed(2)} | ${fmt(s.t, 2)} | ${fmt(s.tGross, 2)} | ${oos ? T[k].holm.toFixed(4) : ''} | ${oos ? (T[k].pass ? 'yes' : 'no') : ''} |`);
    }
  }
  L.push('', '## Placebo (40 seeds: random non-spike OOS H1 candles of the same New York hour and class, same side and stop rule)', '');
  L.push('| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) L.push(`| ${k} | ${fmt(T[k].oos.net)} | ${fmt(T[k].placebo.mean)} | ${fmt(T[k].placebo.q95)} | ${fmt(T[k].placebo.max)} | ${T[k].placebo.beats} of ${T[k].placebo.seeds} |`);
  L.push('', '## Pass checks (all needed: OOS t ≥ 2 and Holm p ≤ 0.05, IS net > 0, OOS net at 2× costs > 0, above the placebo 95th percentile, OOS n ≥ 100)', '');
  L.push('| Test | t / Holm | IS sign | 2× costs | Placebo | n |', '|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of Object.keys(T)) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.t2)} | ${yn(c.isPos)} | ${yn(c.costs2)} | ${yn(c.placebo)} | ${yn(c.n)} |`); }
  L.push('', `## Releases, reported both ways (not a test; ${res.tagged} spike candles hold a CPI / NFP / FOMC time; tags cover CPI from 2018 with gaps, NFP and FOMC from 2022)`, '');
  L.push('| Test | OOS all: n, net R, t | OOS untagged (re-run): n, net R, t | OOS tagged: n, net R, t |', '|---|---|---|---|');
  const st = (s) => `${s.n}, ${fmt(s.net)}, ${fmt(s.t, 2)}`;
  for (const k of Object.keys(T)) L.push(`| ${k} | ${st(T[k].oos)} | ${st(T[k].releases.untagged)} | ${st(T[k].releases.tagged)} |`);
  L.push('', '## Reported, not tested', '');
  L.push('Exits and signals not traded:', '');
  for (const k of Object.keys(T)) L.push(`- ${k}: IS ${JSON.stringify(T[k].is.why)}; OOS ${JSON.stringify(T[k].oos.why)}; not traded ${JSON.stringify(T[k].skips)}`);
  L.push('', 'Spikes by New York hour of the candle\'s start: ' + Object.entries(res.byHour).sort((a, b) => a[0] - b[0]).map(([h, n]) => `${String(h).padStart(2, '0')}h ${n}`).join(', ') + '.', '');
  L.push('Net R a trade by year (n):', '');
  const years = [...new Set(Object.values(T).flatMap((x) => Object.keys(x.byYear)))].sort();
  L.push('| Year | ' + Object.keys(T).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---').join('|') + '|');
  for (const y of years) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const b = T[k].byYear[y]; return b ? `${fmt(b.net)} (${b.n})` : ''; }).join(' | ') + ' |');
  L.push('', '## Reading', '');
  const g = (k) => T[k].oos;
  L.push(`Before costs the three streams make ${fmt(g('T1').gross)}R (T1), ${fmt(g('T2').gross)}R (T2) and ${fmt(g('T3').gross)}R (T3) a trade out of sample.`,
    'T2 and T3 take opposite sides of the same outer-quarter spikes (with different stops), so their gross figures say which way an',
    `abnormal-activity candle with a decisive close tends to go over the next four hours. Before costs, T2 is ${fmt(T.T2.is.gross)}R in 2016-20 and ${fmt(g('T2').gross)}R in 2021-now,`,
    `T3 ${fmt(T.T3.is.gross)}R and ${fmt(g('T3').gross)}R: ${Math.sign(T.T2.is.gross) !== Math.sign(g('T2').gross) ? 'the direction flipped between the two windows, so neither reading is stable' : 'the same direction in both windows'}. The costs, on a stop the size of an`,
    `abnormal H1 candle, decide the net. ${res.passed.length ? 'A pass is a hypothesis for a forward paper record, not an edge.' : 'Not an edge; never use an H1 activity spike as a filter, gate or bias for a council system on this evidence.'}`,
    'Any follow-up needs its own pre-registration on other data.', '');
  L.push('To repeat: `node --use-env-proxy research/edge/gold-volume-spike/fetch.mjs <dir>`, then `node research/edge/gold-volume-spike/run.mjs <dir>`.',
    'Tests: `tests/gold-volume-spike.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <dir>');
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m-vol.json.gz'))));
  const res = runAll(rows);
  const json = { study: 'gold-volume-spike', title: 'Gold activity spike: abnormal-volume H1 candles, continuation or reversal (OANDA M5 tick volume)', built: '2026-11-14',
    verdict: res.verdict, passed: res.passed,
    data: { m5: res.rows, h1: res.h1, eligible: res.eligible, spikes: res.spikes, spikesIS: res.spikesIS, spikesOOS: res.spikesOOS, tagged: res.tagged, outer: res.outer, outerAll: res.outerAll, byHour: res.byHour },
    params: P, costs: { spread: P.SPREAD, slippagePerMarketOrder: P.SLIP, financing: `buys: nights() x ${FIN_RATE} x entry (council/fills.mjs FIN.xau.long)` }, tests: res.tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(json, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  for (const k of Object.keys(res.tests)) { const x = res.tests[k]; console.log(k, 'IS', x.is.n, x.is.gross, x.is.net, x.is.t, 'OOS', x.oos.n, x.oos.gross, x.oos.net, x.oos.t, 'holm', x.holm, 'plc95', x.placebo.q95, x.pass); }
  console.log('verdict', res.verdict, 'spikes', res.spikes);
}
