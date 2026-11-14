// research/edge/gold-box-breakout: the break of gold's multi-day consolidation box (PREREGISTRATION.md, pushed alone first).
// A stand-alone rule on spot gold, not a gate / exit / entry / size of the live gold book (owner item 44: none of its
// positions is read). Paper research only; nothing live reads this file.
//   node --use-env-proxy run.mjs fetch <dir>   OANDA mid XAU/USD H1 through the candle proxy -> <dir>/xau-h1.json (outside git)
//   node run.mjs full <dir>                    the study -> result.json + RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, HOUR = 3600;
export const P = {
  box: 5, box3: 10, look: 60, ratio: 0.6, valid: 5, hold: 20, tgt: 2,
  cost: 0.60, fin: FIN.xau.long,
  isFrom: Date.parse('2007-01-01T00:00:00Z') / 1000, isTo: Date.parse('2017-01-01T00:00:00Z') / 1000,
  oosFrom: Date.parse('2017-01-01T00:00:00Z') / 1000, oosTo: Date.parse('2026-11-01T00:00:00Z') / 1000,
  seeds: 40,
};
export const TESTS = {
  T1: { box: 5, tgt: 2, cond: true, name: 'five-day box, 2R target (primary)' },
  T2: { box: 5, tgt: 0, cond: true, name: 'five-day box, no target' },
  T3: { box: 10, tgt: 2, cond: true, name: 'ten-day box, 2R target' },
};

// ---------- candles -> days ----------
export function loadH1(rows) {
  const m = new Map();
  for (const r of rows) { const [t, o, h, l, c] = r.map(Number); if ([t, o, h, l, c].every(Number.isFinite)) m.set(t, { t, o, h, l, c }); }
  return [...m.values()].sort((a, b) => a.t - b.t);
}
// UTC day of an hour; Saturday / Sunday hours belong to the next Monday (the reopen stub is part of Monday)
export function dayKey(t) {
  const d = Math.floor(t / DAY) * DAY, w = new Date(d * 1000).getUTCDay();
  return w === 6 ? d + 2 * DAY : w === 0 ? d + DAY : d;
}
export function daysOf(bars) {
  const days = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], k = dayKey(b.t), last = days[days.length - 1];
    if (!last || last.time !== k) days.push({ time: k, open: b.o, high: b.h, low: b.l, close: b.c, first: i, last: i });
    else { last.high = Math.max(last.high, b.h); last.low = Math.min(last.low, b.l); last.close = b.c; last.last = i; }
  }
  return days;
}

// ---------- the signal (reads days <= d only) ----------
export function rangeL(days, j, L) {
  let hi = -Infinity, lo = Infinity;
  for (let k = j - L + 1; k <= j; k++) { hi = Math.max(hi, days[k].high); lo = Math.min(lo, days[k].low); }
  return { hi, lo, h: hi - lo };
}
// box of days d-L+1..d and the usual L-day range = mean over the windows ending d-look..d-1; null when history is short
export function boxAt(days, d, L, look = P.look) {
  if (d - look - L + 1 < 0 || d >= days.length) return null;
  let s = 0;
  for (let j = d - look; j <= d - 1; j++) s += rangeL(days, j, L).h;
  const b = rangeL(days, d, L);
  return { ...b, U: s / look, ratio: b.h / (s / look) };
}

// ---------- the bracket on hours after day d ----------
// buy-stop at hi, sell-stop at lo for days d+1..d+valid; stop the other side; target tgt R (0 = none); out at the last close of
// the fill day + hold. Returns null with no fill, { open: true } when the data ends before the exit.
export function bracket(bars, days, d, hi, lo, tgt = P.tgt, valid = P.valid, hold = P.hold) {
  const end = Math.min(days.length - 1, d + valid);
  if (d + 1 > end) return null;
  for (let i = days[d + 1].first; i <= days[end].last; i++) {
    const b = bars[i], up = b.h >= hi, dn = b.l <= lo;
    if (!up && !dn) continue;
    const fd = dayOfBar(days, i);
    if (up && dn) return { side: 1, fill: Math.max(hi, b.o), stop: lo, r0: Math.max(hi, b.o) - lo, t: b.t, c: b.t + HOUR, fillDay: fd, exitDay: fd, R: -1, why: 'both', both: true };
    const side = up ? 1 : -1, fill = up ? Math.max(hi, b.o) : Math.min(lo, b.o), stop = up ? lo : hi, r0 = Math.abs(fill - stop);
    const target = tgt > 0 ? fill + side * tgt * r0 : null;
    const xd = fd + hold, endK = days[Math.min(xd, days.length - 1)].last;
    for (let k = i + 1; k <= endK; k++) {
      const x = bars[k];
      const hitS = side > 0 ? x.l <= stop : x.h >= stop;
      if (hitS) {
        const gap = side > 0 ? x.o < stop : x.o > stop, px = gap ? x.o : stop;
        return mk(side, fill, stop, r0, b.t, x.t + HOUR, px, gap ? 'gap' : 'stop', fd, dayOfBar(days, k));
      }
      if (target != null && (side > 0 ? x.h >= target : x.l <= target)) {
        const px = side > 0 ? Math.max(target, x.o) : Math.min(target, x.o);
        return mk(side, fill, stop, r0, b.t, x.t + HOUR, px, 'target', fd, dayOfBar(days, k));
      }
    }
    if (xd >= days.length) return { open: true, side, fill, t: b.t };
    const lx = bars[days[xd].last];
    return mk(side, fill, stop, r0, b.t, lx.t + HOUR, lx.c, 'time', fd, xd);
  }
  return null;
}
function dayOfBar(days, i) { let lo = 0, hi = days.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (days[m].first <= i) lo = m; else hi = m - 1; } return lo; }
function mk(side, fill, stop, r0, t, c, px, why, fillDay, exitDay) {
  return { side, fill, stop, r0, t, c, exit: px, R: side * (px - fill) / r0, why, fillDay, exitDay };
}

// ---------- a stream: one order or position at a time ----------
// pick(d) -> { hi, lo } or null for the signal at the close of day d
export function stream(bars, days, pick, tgt = P.tgt, onlyDays = null) {
  const out = [];
  let free = 0;
  const list = onlyDays || days.map((_, i) => i);
  for (const d of list) {
    if (d < free) continue;
    const s = pick(d);
    if (!s) continue;
    const tr = bracket(bars, days, d, s.hi, s.lo, tgt);
    if (!tr) { out.push({ d, sigT: days[d].time, hi: s.hi, lo: s.lo, tr: null }); free = d + P.valid; continue; }
    out.push({ d, sigT: days[d].time, hi: s.hi, lo: s.lo, tr });
    if (tr.open) break;
    free = tr.exitDay;
  }
  return out;
}
export const pickBox = (days, L, cond = true) => (d) => {
  const b = boxAt(days, d, L);
  if (!b || !(b.h > 0)) return null;
  if (cond && !(b.ratio < P.ratio)) return null;
  return { hi: b.hi, lo: b.lo, ratio: b.ratio };
};

// ---------- costs and statistics ----------
export function costs(tr, mult = 1) {
  const spread = mult * P.cost / tr.r0;
  const fin = tr.side > 0 ? mult * nights(tr.t, tr.c) * P.fin * tr.fill / tr.r0 : 0;
  return { spread, fin, net: tr.R - spread - fin };
}
const monthIdx = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(rows, from, to, key) {
  if (!rows.length) return { t: 0, months: 0 };
  const m0 = monthIdx(from), m1 = Math.max(monthIdx(to - 1), ...rows.map((r) => monthIdx(r.c)));
  const s = new Array(m1 - m0 + 1).fill(0);
  for (const r of rows) s[monthIdx(r.c) - m0] += r[key];
  const n = s.length, mu = s.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(s.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return { t: sd > 0 ? mu / (sd / Math.sqrt(n)) : 0, months: n };
}
export const phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export const pTwo = (t) => 2 * (1 - phi(Math.abs(t)));
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length);
  let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r3 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000;
const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
export function summarize(trades, from, to) {
  const rows = trades.filter((x) => x.t >= from && x.t < to).map((x) => {
    const c1 = costs(x), c2 = costs(x, 2);
    return { ...x, net: c1.net, net2: c2.net, spreadR: c1.spread, finR: c1.fin };
  });
  const n = rows.length, sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  let eq = 0, pk = 0, dd = 0;
  for (const r of [...rows].sort((a, b) => a.c - b.c)) { eq += r.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const side = (s) => { const q = rows.filter((r) => r.side === s); return { n: q.length, net: r3(q.length ? q.reduce((a, r) => a + r.net, 0) / q.length : null) }; };
  return {
    n, gross: r3(n ? sum('R') / n : null), net: r3(n ? sum('net') / n : null), net2: r3(n ? sum('net2') / n : null),
    win: r2(n ? 100 * rows.filter((r) => r.net > 0).length / n : null), total: r2(sum('net')), dd: r2(dd),
    tNet: r2(monthT(rows, from, to, 'net').t), tGross: r2(monthT(rows, from, to, 'R').t), months: monthT(rows, from, to, 'net').months,
    medR0: r2(med(rows.map((r) => r.r0))), medCostR: r3(med(rows.map((r) => r.spreadR + r.finR))),
    exits: Object.fromEntries(['target', 'stop', 'gap', 'time', 'both'].map((w) => [w, rows.filter((r) => r.why === w).length])),
    buys: side(1), sells: side(-1),
  };
}

// ---------- placebo ----------
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(bars, days, k, from, to, seed) {
  const r = rng(seed), elig = [];
  for (let d = 0; d < days.length - P.valid; d++) if (days[d].time >= from && days[d].time < to && boxAt(days, d, P.box)) elig.push(d);
  const pickD = new Set();
  while (pickD.size < Math.min(k, elig.length)) pickD.add(elig[Math.floor(r() * elig.length)]);
  const list = [...pickD].sort((a, b) => a - b);
  const s = stream(bars, days, pickBox(days, P.box, false), P.tgt, list).filter((x) => x.tr && !x.tr.open).map((x) => x.tr);
  return summarize(s, from, to).net;
}

// ---------- the study ----------
export function study(rows) {
  const bars = loadH1(rows), days = daysOf(bars), res = { tests: {} };
  for (const [k, T] of Object.entries(TESTS)) {
    const s = stream(bars, days, pickBox(days, T.box, T.cond), T.tgt);
    const done = s.filter((x) => x.tr && !x.tr.open).map((x) => x.tr);
    const sigIn = (a, b) => s.filter((x) => x.sigT >= a && x.sigT < b).length;
    res.tests[k] = {
      name: T.name, signals: { is: sigIn(P.isFrom, P.isTo), oos: sigIn(P.oosFrom, P.oosTo) },
      openAtEnd: s.filter((x) => x.tr && x.tr.open).length,
      is: summarize(done, P.isFrom, P.isTo), oos: summarize(done, P.oosFrom, P.oosTo),
      years: Object.fromEntries([...new Set(done.map((x) => new Date(x.t * 1000).getUTCFullYear()))].filter((y) => y >= 2007 && y <= 2026)
        .map((y) => { const q = summarize(done, Date.UTC(y, 0, 1) / 1000, Math.min(P.oosTo, Date.UTC(y + 1, 0, 1) / 1000)); return [y, { n: q.n, net: q.net }]; })),
    };
  }
  const ks = Object.keys(TESTS), hp = holm(ks.map((k) => pTwo(res.tests[k].oos.tNet)));
  ks.forEach((k, i) => { res.tests[k].pOos = r3(pTwo(res.tests[k].oos.tNet)); res.tests[k].holmP = r3(hp[i]); });
  const k1 = res.tests.T1.signals.oos, pl = [];
  for (let s = 1; s <= P.seeds; s++) pl.push(placebo(bars, days, k1, P.oosFrom, P.oosTo, s));
  const t1 = res.tests.T1.oos.net;
  res.placebo = { seeds: P.seeds, draws: pl, beaten: pl.filter((x) => t1 > x).length, median: r3(med(pl)), p95: r3([...pl].sort((a, b) => a - b)[Math.floor(0.95 * pl.length) - 1]) };
  const T1 = res.tests.T1;
  const checks = {
    oosT: T1.oos.tNet >= 2, holm: T1.holmP <= 0.05, isPos: T1.is.net > 0, cost2: T1.oos.net2 > 0, placebo: res.placebo.beaten >= 38,
  };
  res.checks = checks;
  res.pass = Object.values(checks).every(Boolean);
  res.passing = ks.filter((k) => { const t = res.tests[k]; return t.oos.tNet >= 2 && t.holmP <= 0.05 && t.is.net > 0 && t.oos.net2 > 0; });
  res.data = { bars: bars.length, days: days.length, first: new Date(bars[0].t * 1000).toISOString(), last: new Date(bars.at(-1).t * 1000).toISOString() };
  return res;
}

const fmt = (x, d = 3) => x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
export function verdictLine(r) {
  const T = r.tests.T1;
  const n = r.passing.length;
  return `**Verdict: ${r.pass ? 'PASS' : 'FAIL'}, ${n} of 3: the five-day box breakout made ${fmt(T.oos.net)}R a trade net out of sample (n ${T.oos.n}, month t ${fmt(T.oos.tNet, 2)}), ${fmt(T.is.net)}R in sample; ${r.placebo.beaten} of 40 placebos.**`;
}
export function report(r) {
  const L = [];
  L.push('# Gold: the breakout of a multi-day consolidation box (14 Nov 2026)', '');
  L.push(verdictLine(r), '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone rule on spot gold,',
    'not a gate, exit, entry or size of the live gold book; none of its positions was read (docs/owner-decisions.md item 44).',
    'Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Rule (as pre-registered)', '',
    `- OANDA mid XAU/USD H1 (${r.data.bars} candles, ${r.data.first.slice(0, 10)} to ${r.data.last.slice(0, 10)}), UTC days, weekend hours folded into Monday (${r.data.days} days).`,
    '- Signal at a day\'s close: the last five days\' range (box) under 0.6 x the mean five-day range of the 60 windows before it.',
    '- A buy-stop at the box high and a sell-stop at the box low for 5 days, first touch fills (one hour touching both = −1R); stop at',
    '  the other side of the box (every trade has one); T1 target 2R, T2 none, T3 a ten-day box; out at the 20th day\'s last close.',
    '- Costs: $0.60 a round trip in R of each trade\'s risk; financing on buys `nights` x `FIN.xau.long` (0.000148 a rollover); 2x doubles both.',
    '- In sample: entries 2007-2016; out of sample: entries 2017 to 2026-10-31. t on calendar-month sums of net R; Holm over 3; placebo',
    '  = 40 seeded draws of random signal days (no height condition), T1\'s orders and exits.', '');
  L.push('## Results', '',
    '| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net (months) | t gross | Median stop $ | Median cost R |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, T] of Object.entries(r.tests)) for (const [w, s] of [['IS 2007-16', T.is], ['OOS 2017-26', T.oos]])
    L.push(`| ${k} ${T.name} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win ?? 'n/a'} | ${fmt(s.total, 2)} | ${fmt(s.dd, 2)} | ${fmt(s.tNet, 2)} | ${fmt(s.tGross, 2)} | ${s.medR0} | ${fmt(s.medCostR)} |`);
  L.push('', '| Test | OOS p | Holm p | Buys OOS (n, net R) | Sells OOS (n, net R) | Exits OOS (target / stop / gap / time / both) |', '|---|---|---|---|---|---|');
  for (const [k, T] of Object.entries(r.tests)) {
    const e = T.oos.exits;
    L.push(`| ${k} | ${T.pOos} | ${T.holmP} | ${T.oos.buys.n}, ${fmt(T.oos.buys.net)} | ${T.oos.sells.n}, ${fmt(T.oos.sells.net)} | ${e.target} / ${e.stop} / ${e.gap} / ${e.time} / ${e.both} |`);
  }
  L.push('', `Placebo (T1 out of sample, 40 seeds): median ${fmt(r.placebo.median)}R a trade, 95th percentile ${fmt(r.placebo.p95)}R; T1 (${fmt(r.tests.T1.oos.net)}R) beats ${r.placebo.beaten} of 40.`, '');
  L.push('## Checks of the pass bar (T1)', '');
  const C = r.checks;
  L.push(`- Out-of-sample net month t ≥ 2: ${C.oosT ? 'yes' : 'no'} (${fmt(r.tests.T1.oos.tNet, 2)}).`,
    `- Holm p ≤ 0.05: ${C.holm ? 'yes' : 'no'} (${r.tests.T1.holmP}).`,
    `- In-sample net R a trade > 0: ${C.isPos ? 'yes' : 'no'} (${fmt(r.tests.T1.is.net)}).`,
    `- Out of sample positive at 2× costs: ${C.cost2 ? 'yes' : 'no'} (${fmt(r.tests.T1.oos.net2)}).`,
    `- Above at least 38 of 40 placebos: ${C.placebo ? 'yes' : 'no'} (${r.placebo.beaten}).`, '');
  L.push('## Net R a trade by entry year (T1)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(r.tests.T1.years)) L.push(`| ${y} | ${v.n} | ${fmt(v.net)} |`);
  L.push('', '## Reading', '', ...r.reading, '');
  L.push('## To repeat', '', '```sh', 'node --use-env-proxy research/edge/gold-box-breakout/run.mjs fetch <dir>   # candles, kept out of git',
    'node research/edge/gold-box-breakout/run.mjs full <dir>', '```', '');
  return L.join('\n');
}

// Written after the run, from the numbers above (it changes no rule and no number).
export const READING = [
  '- **The box break does not carry.** T1 lost in both windows (in sample −0.096R a trade net, n 83; out of sample −0.299R, n 80,',
  '  month t −2.03) and was already negative before costs (gross −0.022R / −0.218R). Costs are small next to the stop: the median',
  '  stop is $25 in sample and $32 out of sample, so $0.60 and the financing are about 0.04-0.05R a trade.',
  '- Out of sample 58 of 80 trades were stopped at the other side of the box and 18 reached 2R: in a tight gold box a break tends',
  '  to return through the box rather than run. The sells lost most (−0.490R out of sample, n 38; buys −0.125R, n 42).',
  '- T1 sits below the random-day placebo (beats 1 of 40; median +0.030R): the height condition selected worse days than chance.',
  '  The negative t is not a tested fade: reading it as a rule to sell the upper break would be chosen after the result and would',
  '  need its own pre-registration on other data.',
  '- T2 (no target) and T3 (ten-day box) fail too: T3 was +0.065R in sample (n 39, t 0.31) and −0.119R out of sample (n 49).',
  '- Not an edge, no proposal, nothing live changed. No gate, exit, entry or size of the gold book was tested (item 44).',
];

async function fetchH1(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const FROM = Date.parse('2006-03-01T00:00:00Z') / 1000, NOW = Math.floor(Date.now() / 1000), STEP = 4900 * HOUR, m = new Map();
  for (let t = FROM; t < NOW; t += STEP) {
    for (let a = 0; a < 4; a++) {
      try {
        const j = await (await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=1h&from=${t}&to=${Math.min(NOW, t + STEP)}`)).json();
        for (const b of j.bars || []) if (!b.live) m.set(b.time, [b.time, b.open, b.high, b.low, b.close]);
        break;
      } catch { await new Promise((r) => setTimeout(r, 3000)); }
    }
  }
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify([...m.values()].sort((a, b) => a[0] - b[0])));
  console.log('xau h1', m.size);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'full') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
    const r = study(rows);
    r.reading = READING;
    r.verdict = verdictLine(r).replace(/^\*\*|\*\*$/g, '');
    r.built = '2026-11-14';
    r.prereg = 'research/edge/gold-box-breakout/PREREGISTRATION.md';
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
    console.log(verdictLine(r));
    for (const [k, T] of Object.entries(r.tests)) console.log(k, 'IS', JSON.stringify(T.is), '\nOOS', JSON.stringify(T.oos));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
