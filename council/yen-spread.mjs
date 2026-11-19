// Yen-pair spreads at the gotobi minutes (14 Nov 2026; proposal research/proposals/2026-11-14-yen-spread-log.md, owner-decisions
// item 60). Pure reader of ctrader/symbols.json `watch` (council/ctrader-symbols.mjs): the quoted spreads around 00:55 and 06:00 UTC
// (+-3 minutes) on weekdays, split gotobi days / other days, in pips. Two sources per symbol: `windows` (the broker's own bid / ask
// tick history read after each window: `atTarget`, the spread in force at the minute) and `spreadLog` reads of council rounds that
// happened to fall inside a window. Not wired into any rule, page, alert or cost model.
//   node council/yen-spread.mjs <dir with ctrader/symbols.json>   prints the table
import fs from 'node:fs';
import path from 'node:path';

import { addD, jpHolidays, tseHolidays, isTokyoBusinessDay, prevBusinessDay, gotobiOfMonth, isGotobi } from './gotobi-calendar.mjs';
export { addD, jpHolidays, tseHolidays, isTokyoBusinessDay, prevBusinessDay, gotobiOfMonth, isGotobi };   // the calendar moved to gotobi-calendar.mjs (19 Nov 2026)

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
