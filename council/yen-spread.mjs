// Yen-pair spreads at the gotobi minutes (14 Nov 2026; proposal research/proposals/2026-11-14-yen-spread-log.md, owner-decisions
// item 55). Pure reader of ctrader/symbols.json `watch` (council/ctrader-symbols.mjs): the quoted spreads around 00:55 and 06:00 UTC
// (+-3 minutes) on weekdays, split gotobi days / other days, in pips. Two sources per symbol: `windows` (the broker's own bid / ask
// tick history read after each window: `atTarget`, the spread in force at the minute) and `spreadLog` reads of council rounds that
// happened to fall inside a window. Not wired into any rule, page, alert or cost model.
//   node council/yen-spread.mjs <dir with ctrader/symbols.json>   prints the table
import fs from 'node:fs';
import path from 'node:path';

// ---- the Tokyo calendar, copied from research/edge/gotobi/run.mjs (branch gotobi, 14 Nov 2026; itself a copy of
// research/edge/turnaround-replicate/run.mjs). Copied, not imported: a council file never imports a research branch. -----------
const ymdU = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);   // m 1-12, d may overflow
const dowU = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const nthMon = (y, m, n) => { const first = ymdU(y, m, 1); return addD(first, ((1 - dowU(first) + 7) % 7) + 7 * (n - 1)); };
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// Japan's national holidays (the law as amended; the 2019-21 one-off moves), then the Tokyo Stock Exchange's own closed days
export function jpHolidays(y) {
  return memo('j' + y, () => {
    const s = new Set(), add = (d) => s.add(d);
    const vern = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    const aut = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    add(ymdU(y, 1, 1)); add(nthMon(y, 1, 2)); add(ymdU(y, 2, 11));
    if (y <= 2018) add(ymdU(y, 12, 23)); if (y >= 2020) add(ymdU(y, 2, 23));
    add(ymdU(y, 3, vern)); add(ymdU(y, 4, 29)); add(ymdU(y, 5, 3)); add(ymdU(y, 5, 4)); add(ymdU(y, 5, 5));
    add(y === 2020 ? '2020-07-23' : y === 2021 ? '2021-07-22' : nthMon(y, 7, 3));
    if (y >= 2016) add(y === 2020 ? '2020-08-10' : y === 2021 ? '2021-08-08' : ymdU(y, 8, 11));
    add(nthMon(y, 9, 3)); add(ymdU(y, 9, aut));
    add(y === 2020 ? '2020-07-24' : y === 2021 ? '2021-07-23' : nthMon(y, 10, 2));
    add(ymdU(y, 11, 3)); add(ymdU(y, 11, 23));
    if (y === 2019) { add('2019-05-01'); add('2019-10-22'); }
    const base = [...s].sort();
    for (const d of base) if (dowU(d) === 0) { let x = addD(d, 1); while (s.has(x)) x = addD(x, 1); s.add(x); }   // substitute
    for (const d of [...s].sort()) { const x = addD(d, 2); if (s.has(x) && !s.has(addD(d, 1)) && dowU(addD(d, 1)) !== 0) s.add(addD(d, 1)); } // citizen's
    return s;
  });
}
export function tseHolidays(y) {
  return memo('t' + y, () => { const s = new Set(jpHolidays(y)); for (const d of [ymdU(y, 1, 1), ymdU(y, 1, 2), ymdU(y, 1, 3), ymdU(y, 12, 31)]) s.add(d); return s; });
}
export const isTokyoBusinessDay = (ymd) => { const w = dowU(ymd); return w !== 0 && w !== 6 && !tseHolidays(+ymd.slice(0, 4)).has(ymd); };
export const prevBusinessDay = (ymd) => { let d = ymd; while (!isTokyoBusinessDay(d)) d = addD(d, -1); return d; };   // ymd itself if open
// the gotobi days of one month: 5, 10, 15, 20, 25 rolled back, plus the last business day; sorted, each once
export function gotobiOfMonth(y, m) {
  const s = new Set();
  for (const d of [5, 10, 15, 20, 25]) s.add(prevBusinessDay(ymdU(y, m, d)));
  s.add(prevBusinessDay(ymdU(y, m + 1, 0)));
  return [...s].sort();
}
// ---- end of the copy ------------------------------------------------------------------------------------------------------------
// a day is gotobi when its own month or the next one lists it (a 5th rolled back over the New Year can land in December)
export const isGotobi = (ymd) => { const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7);
  return gotobiOfMonth(y, m).includes(ymd) || gotobiOfMonth(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1).includes(ymd); };

// 00:55 UTC = 09:55 Tokyo (the fade's sell), 06:00 UTC = 15:00 Tokyo (its buy back); the Tokyo date equals the UTC date at both
export const MINUTES = [['00:55', 55 * 60], ['06:00', 6 * 3600]], HALF = 180;
// the window a moment (unix sec) falls in: { day, minute } for a UTC weekday within +-HALF of 00:55 or 06:00, else null
export function windowOf(sec) {
  const day = Math.floor(sec / 86400) * 86400, ymd = new Date(day * 1000).toISOString().slice(0, 10), w = new Date(day * 1000).getUTCDay();
  if (w === 0 || w === 6) return null;
  for (const [minute, off] of MINUTES) if (Math.abs(sec - (day + off)) <= HALF) return { day: ymd, minute };
  return null;
}
const med = (a) => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const stats = (a) => (a.length ? { n: a.length, median: +med(a).toFixed(3), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3), max: +Math.max(...a).toFixed(3) } : { n: 0 });

// symbols.json -> per watch symbol: the reads in the windows (pips) and a summary by minute x gotobi / other
export function yenSpreads(file) {
  const out = {};
  for (const [name, e] of Object.entries((file && file.watch) || {})) {
    if (!e) { out[name] = null; continue; }
    const pip = 10 ** -(e.pipPosition != null && Number.isFinite(+e.pipPosition) ? +e.pipPosition : 2), reads = [];
    for (const w of Array.isArray(e.windows) ? e.windows : []) {
      const at = w && Number.isFinite(w.t) ? windowOf(w.t) : null; if (!at || w.atTarget == null) continue;
      reads.push({ ...at, t: w.t, src: 'ticks', pips: +(w.atTarget / pip).toFixed(3), gotobi: isGotobi(at.day) });
    }
    for (const x of Array.isArray(e.spreadLog) ? e.spreadLog : []) {
      const [t, v] = Array.isArray(x) ? x : [], at = Number.isFinite(t) ? windowOf(t) : null;
      if (!at || !Number.isFinite(v) || v < 0) continue;
      reads.push({ ...at, t, src: 'round', pips: +(v / pip).toFixed(3), gotobi: isGotobi(at.day) });
    }
    reads.sort((a, b) => a.t - b.t);
    const mid = e.bid > 0 && e.ask > 0 ? (e.bid + e.ask) / 2 : null;
    const commissionPips = e.commissionRT != null && mid ? +(e.commissionRT * mid / pip).toFixed(3) : null;   // round trip, in pips
    const summary = {};
    for (const [minute] of MINUTES) for (const g of ['gotobi', 'other']) {
      summary[`${minute} ${g}`] = stats(reads.filter((r) => r.minute === minute && r.gotobi === (g === 'gotobi')).map((r) => r.pips));
    }
    out[name] = { pip, commissionPips, reads, summary };
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('yen-spread.mjs')) {
  const f = path.join(process.argv[2] || 'data', 'ctrader', 'symbols.json');
  let file = null; try { file = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`yen spreads: cannot read ${f}`); process.exit(0); }
  const r = yenSpreads(file);
  if (!Object.keys(r).length) console.log('yen spreads: no watch list in this file yet');
  for (const [n, x] of Object.entries(r)) {
    if (!x) { console.log(`${n}: not listed by the broker`); continue; }
    console.log(`${n} (commission round trip ${x.commissionPips ?? '?'} pips)`);
    for (const [k, s] of Object.entries(x.summary)) console.log(`  ${k.padEnd(13)} n ${String(s.n).padStart(3)}${s.n ? `  median ${s.median}  mean ${s.mean}  max ${s.max} pips` : ''}`);
  }
}
