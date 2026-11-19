// research/edge/gold-box-fade: fading the break of gold's tight five-day box (PREREGISTRATION.md, pushed alone first).
// The idea was chosen after gold-box-breakout (#1097) saw breaks fail out of sample, so 2017-26 is descriptive only and
// 2007-16 decides (option b of the pre-registration). A stand-alone rule on spot gold, not a gate / exit / entry / size of the
// live gold book (owner item 44: none of its positions is read). Paper research only; nothing live reads this file.
//   node --use-env-proxy run.mjs fetch <dir>   OANDA mid XAU/USD H1 through the candle proxy -> <dir>/xau-h1.json (outside git)
//   node run.mjs full <dir>                    the study -> result.json + RESULT.md next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, HOUR = 3600;
export const P = {
  box: 5, look: 60, ratio: 0.6, valid: 5, buf: 0.5, cost: 0.60, fin: FIN.xau.long, seeds: 40,
  // confirmation (decisive) and descriptive windows, by entry time
  cFrom: Date.parse('2007-01-01T00:00:00Z') / 1000, cTo: Date.parse('2017-01-01T00:00:00Z') / 1000,
  dFrom: Date.parse('2017-01-01T00:00:00Z') / 1000, dTo: Date.parse('2026-11-01T00:00:00Z') / 1000,
};
export const TESTS = {
  T1: { tgt: 'edge', hold: 20, name: 'target the box\'s other side, 20 days (primary)' },
  T2: { tgt: 'mid', hold: 20, name: 'target the box midpoint, 20 days' },
  T3: { tgt: 'edge', hold: 5, name: 'target the other side, time exit day 5' },
};

// ---------- candles -> days ----------
export function loadH1(rows) {
  const m = new Map();
  for (const r of rows) { const [t, o, h, l, c] = r.map(Number); if ([t, o, h, l, c].every(Number.isFinite)) m.set(t, { t, o, h, l, c }); }
  return [...m.values()].sort((a, b) => a.t - b.t);
}
// UTC day of an hour; Saturday / Sunday hours belong to the next Monday
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
function dayOfBar(days, i) { let lo = 0, hi = days.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (days[m].first <= i) lo = m; else hi = m - 1; } return lo; }

// ---------- the signal (reads days <= d only) ----------
export function rangeL(days, j, L) {
  let hi = -Infinity, lo = Infinity;
  for (let k = j - L + 1; k <= j; k++) { hi = Math.max(hi, days[k].high); lo = Math.min(lo, days[k].low); }
  return { hi, lo, h: hi - lo };
}
export function boxAt(days, d, L = P.box, look = P.look) {
  if (d - look - L + 1 < 0 || d >= days.length) return null;
  let s = 0;
  for (let j = d - look; j <= d - 1; j++) s += rangeL(days, j, L).h;
  const b = rangeL(days, d, L);
  return { ...b, U: s / look, ratio: b.h / (s / look) };
}

// ---------- manage one position from bar index k (entry at bars[k].o) ----------
// stop first when one hour holds both; a gapped stop fills at the open; a target fills at the target (better at a gap open);
// out at the last H1 close of fill day + hold. Returns { open: true } when the data ends before the exit.
export function manage(bars, days, k, side, entry, stop, target, hold) {
  const r0 = Math.abs(entry - stop), fd = dayOfBar(days, k), xd = fd + hold;
  const endK = days[Math.min(xd, days.length - 1)].last;
  const mk = (px, why, j) => ({ side, fill: entry, stop, target, r0, t: bars[k].t, c: bars[j].t + HOUR, exit: px, R: side * (px - entry) / r0, why, fillDay: fd, exitDay: dayOfBar(days, j) });
  for (let j = k; j <= endK; j++) {
    const x = bars[j];
    if (side > 0 ? x.l <= stop : x.h >= stop) {
      const gap = j > k && (side > 0 ? x.o < stop : x.o > stop);
      return mk(gap ? x.o : stop, gap ? 'gap' : 'stop', j);
    }
    if (side > 0 ? x.h >= target : x.l <= target) {
      const px = j > k ? (side > 0 ? Math.max(target, x.o) : Math.min(target, x.o)) : target;
      return mk(px, 'target', j);
    }
  }
  if (xd >= days.length) return { open: true, side, fill: entry, t: bars[k].t };
  return mk(bars[days[xd].last].c, 'time', days[xd].last);
}

// ---------- the fade after the box of day d ----------
// { trade } | { skip: why, free } | null (no break in d+1..d+valid; free = d+valid)
export function fade(bars, days, d, hi, lo, T) {
  const end = Math.min(days.length - 1, d + P.valid);
  if (d + 1 > end) return null;
  const h = hi - lo;
  for (let i = days[d + 1].first; i <= days[end].last; i++) {
    const b = bars[i], up = b.h >= hi, dn = b.l <= lo;
    if (!up && !dn) continue;
    const bd = dayOfBar(days, i);
    if (up && dn) return { skip: 'both', free: bd + 1, breakT: b.t };
    if (i + 1 >= bars.length) return { skip: 'end', free: days.length, breakT: b.t };
    const side = up ? -1 : 1, entry = bars[i + 1].o;
    const stop = up ? hi + P.buf * h : lo - P.buf * h;
    const target = T.tgt === 'mid' ? (hi + lo) / 2 : (up ? lo : hi);
    if (side < 0 ? entry >= stop : entry <= stop) return { skip: 'past-stop', free: bd + 1, breakT: b.t };
    if (side < 0 ? entry <= target : entry >= target) return { skip: 'past-target', free: bd + 1, breakT: b.t };
    return { trade: { ...manage(bars, days, i + 1, side, entry, stop, target, T.hold), breakT: b.t, up } };
  }
  return null;
}

// ---------- a stream: one box / position at a time ----------
export function stream(bars, days, T) {
  const out = [];
  let free = 0;
  for (let d = 0; d < days.length; d++) {
    if (d < free) continue;
    const b = boxAt(days, d);
    if (!b || !(b.h > 0) || !(b.ratio < P.ratio)) continue;
    const f = fade(bars, days, d, b.hi, b.lo, T);
    const row = { d, sigT: days[d].time, hi: b.hi, lo: b.lo, ratio: b.ratio };
    if (!f) { out.push({ ...row, tr: null, why: 'no-break' }); free = d + P.valid + 1; continue; }
    if (f.skip) { out.push({ ...row, tr: null, why: f.skip }); free = f.free; continue; }
    out.push({ ...row, tr: f.trade });
    if (f.trade.open) break;
    free = f.trade.exitDay + 1;
  }
  return out;
}

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
  const mt = monthT(rows, from, to, 'net');
  return {
    n, gross: r3(n ? sum('R') / n : null), net: r3(n ? sum('net') / n : null), net2: r3(n ? sum('net2') / n : null),
    win: r2(n ? 100 * rows.filter((r) => r.net > 0).length / n : null), total: r2(sum('net')), dd: r2(dd),
    tNet: r2(mt.t), tGross: r2(monthT(rows, from, to, 'R').t), months: mt.months,
    medR0: r2(med(rows.map((r) => r.r0))), medCostR: r3(med(rows.map((r) => r.spreadR + r.finR))),
    costShare: r3(n ? (sum('spreadR') + sum('finR')) / n : null),
    exits: Object.fromEntries(['target', 'stop', 'gap', 'time'].map((w) => [w, rows.filter((r) => r.why === w).length])),
    buys: side(1), sells: side(-1),
  };
}

// ---------- placebo (confirmation window) ----------
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// k random entry days (next-day first H1 open), side with the sell share, stop / target distances copied from a random real trade
export function placebo(bars, days, k, ref, from, to, seed, hold = TESTS.T1.hold) {
  const r = rng(seed), elig = [];
  for (let d = P.look + P.box; d < days.length - 1; d++) if (days[d].time >= from && days[d].time < to) elig.push(d);
  const sellShare = ref.filter((x) => x.side < 0).length / ref.length;
  const pick = new Set();
  while (pick.size < Math.min(k, elig.length)) pick.add(elig[Math.floor(r() * elig.length)]);
  const list = [...pick].sort((a, b) => a - b), out = [];
  let free = 0;
  for (const d of list) {
    if (d < free) continue;
    const side = r() < sellShare ? -1 : 1, src = ref[Math.floor(r() * ref.length)];
    const sd = Math.abs(src.fill - src.stop), td = Math.abs(src.target - src.fill);
    const kk = days[d + 1].first, e = bars[kk].o;
    const tr = manage(bars, days, kk, side, e, e - side * sd, e + side * td, hold);
    if (tr.open) break;
    out.push(tr);
    free = tr.exitDay + 1;
  }
  return summarize(out, from, to).net;
}

// ---------- the study ----------
export function study(rows) {
  const bars = loadH1(rows), days = daysOf(bars), res = { tests: {} }, done = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const s = stream(bars, days, T);
    done[k] = s.filter((x) => x.tr && !x.tr.open).map((x) => x.tr);
    const inW = (a, b) => s.filter((x) => x.sigT >= a && x.sigT < b);
    const skips = (a, b) => { const q = inW(a, b).filter((x) => !x.tr); return Object.fromEntries(['no-break', 'both', 'past-stop', 'past-target'].map((w) => [w, q.filter((x) => x.why === w).length])); };
    res.tests[k] = {
      name: T.name, signals: { conf: inW(P.cFrom, P.cTo).length, desc: inW(P.dFrom, P.dTo).length },
      skips: { conf: skips(P.cFrom, P.cTo), desc: skips(P.dFrom, P.dTo) },
      openAtEnd: s.filter((x) => x.tr && x.tr.open).length,
      conf: summarize(done[k], P.cFrom, P.cTo), desc: summarize(done[k], P.dFrom, P.dTo),
      years: Object.fromEntries([...new Set(done[k].map((x) => new Date(x.t * 1000).getUTCFullYear()))].filter((y) => y >= 2007 && y <= 2026).sort()
        .map((y) => { const q = summarize(done[k], Date.UTC(y, 0, 1) / 1000, Math.min(P.dTo, Date.UTC(y + 1, 0, 1) / 1000)); return [y, { n: q.n, net: q.net }]; })),
    };
  }
  const ks = Object.keys(TESTS), hp = holm(ks.map((k) => pTwo(res.tests[k].conf.tNet)));
  ks.forEach((k, i) => { res.tests[k].pConf = r3(pTwo(res.tests[k].conf.tNet)); res.tests[k].holmP = r3(hp[i]); });
  const ref = done.T1.filter((x) => x.t >= P.cFrom && x.t < P.cTo), k1 = res.tests.T1.signals.conf, pl = [];
  for (let s = 1; s <= P.seeds; s++) pl.push(placebo(bars, days, k1, ref, P.cFrom, P.cTo, s));
  const t1 = res.tests.T1.conf.net;
  res.placebo = { seeds: P.seeds, k: k1, draws: pl, beaten: pl.filter((x) => t1 > x).length, median: r3(med(pl)), p95: r3([...pl].sort((a, b) => a - b)[Math.floor(0.95 * pl.length) - 1]) };
  const T1 = res.tests.T1;
  res.checks = { confT: T1.conf.tNet >= 2, holm: T1.holmP <= 0.05, cost2: T1.conf.net2 > 0, descPos: T1.desc.net > 0, placebo: res.placebo.beaten >= 38 };
  res.pass = Object.values(res.checks).every(Boolean);
  res.passing = ks.filter((k) => { const t = res.tests[k]; return t.conf.tNet >= 2 && t.holmP <= 0.05 && t.conf.net2 > 0 && t.desc.net > 0; });
  res.data = { bars: bars.length, days: days.length, first: new Date(bars[0].t * 1000).toISOString(), last: new Date(bars.at(-1).t * 1000).toISOString() };
  return res;
}

const fmt = (x, d = 3) => x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
export function verdictLine(r) {
  const T = r.tests.T1;
  return `**Verdict: ${r.pass ? 'PASS' : 'FAIL'}, ${r.passing.length} of 3: fading the box break made ${fmt(T.conf.net)}R a trade net in 2007-16 (n ${T.conf.n}, month t ${fmt(T.conf.tNet, 2)}), ${fmt(T.desc.net)}R in 2017-26; ${r.placebo.beaten} of 40 placebos.**`;
}
export function report(r) {
  const L = [];
  L.push('# Gold: fading the break of a tight five-day box (14 Nov 2026)', '');
  L.push(verdictLine(r), '');
  L.push('Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). The fade was chosen after',
    '`gold-box-breakout` (#1097) saw the breaks fail out of sample, so 2017-26 is descriptive here and 2007-16 decides (option b).',
    'A stand-alone rule on spot gold, not a gate, exit, entry or size of the live gold book; none of its positions was read',
    '(docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written. This page is written',
    'by `run.mjs` from `result.json`.', '');
  L.push('## Rule (as pre-registered)', '',
    `- OANDA mid XAU/USD H1 (${r.data.bars} candles, ${r.data.first.slice(0, 10)} to ${r.data.last.slice(0, 10)}), UTC days, weekend hours folded into Monday (${r.data.days} days).`,
    '- Signal at a day\'s close: the five-day range (box) under 0.6 x the mean five-day range of the 60 windows before it.',
    '- The first H1 touch of the box high or low within 5 days is the break (an hour touching both: no trade); enter the OPPOSITE way',
    '  at the next H1 open; stop 0.5 x the box height beyond the broken edge (every trade has one; no trade if the entry is past it).',
    '- T1 target the box\'s other side, out at the 20th day; T2 target the box midpoint, 20 days; T3 T1\'s target, out at the 5th day.',
    '- Costs: $0.60 a round trip in R of each trade\'s risk; financing on buys `nights` x `FIN.xau.long` (0.000148 a rollover); 2x doubles both.',
    '- Confirmation (decisive): entries 2007-2016; descriptive: 2017 to 2026-10-31 (seen by #1097). t on calendar-month sums of net R;',
    '  Holm over 3 on the confirmation p; placebo = 40 seeded draws of random entry days, same sell share, stop and target distances.', '');
  L.push('## Results', '',
    '| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net (months) | t gross | Median stop $ | Median cost R |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, T] of Object.entries(r.tests)) for (const [w, s] of [['conf 2007-16', T.conf], ['desc 2017-26', T.desc]])
    L.push(`| ${k} ${T.name} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win ?? 'n/a'} | ${fmt(s.total, 2)} | ${fmt(s.dd, 2)} | ${fmt(s.tNet, 2)} | ${fmt(s.tGross, 2)} | ${s.medR0} | ${fmt(s.medCostR)} |`);
  L.push('', '| Test | Conf p | Holm p | Buys conf (n, net R) | Sells conf (n, net R) | Exits conf (target / stop / gap / time) | Boxes with no trade, conf (no break / both / past stop / past target) |', '|---|---|---|---|---|---|---|');
  for (const [k, T] of Object.entries(r.tests)) {
    const e = T.conf.exits, s = T.skips.conf;
    L.push(`| ${k} | ${T.pConf} | ${T.holmP} | ${T.conf.buys.n}, ${fmt(T.conf.buys.net)} | ${T.conf.sells.n}, ${fmt(T.conf.sells.net)} | ${e.target} / ${e.stop} / ${e.gap} / ${e.time} | ${s['no-break']} / ${s.both} / ${s['past-stop']} / ${s['past-target']} |`);
  }
  L.push('', `Placebo (T1, 2007-16, 40 seeds, ${r.placebo.k} random entry days): median ${fmt(r.placebo.median)}R a trade, 95th percentile ${fmt(r.placebo.p95)}R; T1 (${fmt(r.tests.T1.conf.net)}R) beats ${r.placebo.beaten} of 40.`, '');
  L.push('## Checks of the pass bar (T1)', '');
  const C = r.checks, T1 = r.tests.T1;
  L.push(`- Confirmation net month t ≥ 2: ${C.confT ? 'yes' : 'no'} (${fmt(T1.conf.tNet, 2)}).`,
    `- Holm p ≤ 0.05: ${C.holm ? 'yes' : 'no'} (${T1.holmP}).`,
    `- Confirmation net R a trade > 0 at 2× costs: ${C.cost2 ? 'yes' : 'no'} (${fmt(T1.conf.net2)}).`,
    `- Descriptive 2017-26 net R a trade > 0: ${C.descPos ? 'yes' : 'no'} (${fmt(T1.desc.net)}).`,
    `- Above at least 38 of 40 placebos: ${C.placebo ? 'yes' : 'no'} (${r.placebo.beaten}).`, '');
  L.push('## Net R a trade by entry year (T1)', '', '| Year | n | Net R |', '|---|---|---|');
  for (const [y, v] of Object.entries(T1.years)) L.push(`| ${y} | ${v.n} | ${fmt(v.net)} |`);
  L.push('', '## Reading', '', ...(r.reading || []), '');
  L.push('## To repeat', '', '```sh', 'node --use-env-proxy research/edge/gold-box-fade/run.mjs fetch <dir>   # candles, kept out of git',
    'node research/edge/gold-box-fade/run.mjs full <dir>', '```', '');
  return L.join('\n');
}

// Written after the run, from the numbers above (it changes no rule and no number).
export const READING = [
  '- **The fade does not pay either.** T1 lost in the decisive window (2007-16: −0.234R a trade net, n 99, month t −1.51; gross',
  '  −0.156R) and only broke even before costs in 2017-26, the window where #1097 saw the breaks fail (gross +0.006R, net −0.076R,',
  '  n 104). 72 of 99 decisive trades were stopped 0.5 box-heights beyond the broken edge; 27 reached the other side.',
  '- Why the failed breaks of #1097 do not make a winning fade: a break that ends back through the box usually runs past the',
  '  broken edge first, far enough to take a stop placed half a box beyond it. The fade\'s stop is tight (median $12.3 in',
  '  2007-16, $16.8 in 2017-26) so costs are about 0.06R a trade, but the loss is there before costs.',
  '- T2 (target the midpoint) lost most: −0.354R net in 2007-16, n 116, month t −3.63, Holm p 0.001. That is a significant loss of',
  '  the fade, not a signal to follow the break: following was #1097\'s rule, and it lost too. T3 (out at day 5) −0.239R, t −1.67.',
  '- T1 beats 3 of 40 random-entry placebos with the same sell share and stop / target distances (placebo median −0.075R): the',
  '  box and its break pick worse entries than chance for a fade. Sells lost in both windows; buys made +0.332R in 2017-26 (n 49)',
  '  after −0.169R in 2007-16 (n 45): a split seen after the result, not a rule to test on this data.',
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
    r.prereg = 'research/edge/gold-box-fade/PREREGISTRATION.md';
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
    console.log(verdictLine(r));
    for (const [k, T] of Object.entries(r.tests)) console.log(k, 'skips', JSON.stringify(T.skips), '\nCONF', JSON.stringify(T.conf), '\nDESC', JSON.stringify(T.desc));
    console.log('placebo', JSON.stringify(r.placebo));
  } else console.log('usage: run.mjs fetch|full <dir>');
}
