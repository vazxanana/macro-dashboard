// Accounting, not a study: the risk profile of USD/JPY's T1 breakout from its forward study's committed baseline
// (`research/edge/usdjpy-vol-breakout-forward/baseline.json`, 2016 → 2026-11-19, after the demo's cost). No rule tested, no verdict.
//   node research/proposals/2026-11-20-usdjpy-risk.mjs   -> 2026-11-20-usdjpy-risk.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const r2 = (v) => Math.round(v * 100) / 100;
export function profile(rows) {
  let cum = 0, peak = 0, peakDay = rows[0][0], dd = 0, ddFrom = null, ddTo = null, under = 0, underFrom = null, streak = 0, worstStreak = 0;
  const months = new Map(), years = new Map();
  for (const [d, r] of rows) {
    cum += r; months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) || 0) + r); years.set(d.slice(0, 4), (years.get(d.slice(0, 4)) || 0) + r);
    if (cum > peak) { const days = (Date.parse(d) - Date.parse(peakDay)) / 864e5; if (days > under) { under = days; underFrom = peakDay; } peak = cum; peakDay = d; }
    if (cum - peak < dd) { dd = cum - peak; ddFrom = peakDay; ddTo = d; }
    streak = r < 0 ? streak + 1 : 0; worstStreak = Math.max(worstStreak, streak);
  }
  const m = [...months.values()], y = [...years.entries()];
  return { trades: rows.length, totalR: r2(cum), maxDD: r2(dd), ddFrom, ddTo, longestUnderwaterDays: under, underFrom, worstLosingStreak: worstStreak,
    worstMonth: r2(Math.min(...m)), monthsPositive: `${m.filter((v) => v > 0).length} of ${m.length}`, years: Object.fromEntries(y.map(([k, v]) => [k, r2(v)])) };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/usdjpy-vol-breakout-forward/baseline.json'), 'utf8'));
  const P = profile(B.rows), yrs = Object.keys(P.years).length;
  const risk = [0.1, 0.25, 0.5, 1].map((pc) => ({ riskPct: pc, perYearPct: r2((P.totalR / yrs) * pc), maxDDPct: r2(P.maxDD * pc) }));
  const byDay = (rows) => { const wd = {}; for (const [d, r] of rows) { const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00Z').getUTCDay()]; (wd[w] = wd[w] || []).push(r); }
    return Object.fromEntries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((w) => { const a = wd[w] || [], m = a.reduce((x, v) => x + v, 0) / a.length, sd = Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1)); return [w, { n: a.length, meanR: Math.round(m * 1000) / 1000, t: r2(m / (sd / Math.sqrt(a.length))) }]; })); };
  const goldWeekday = byDay(JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/gold-vol-breakout-forward/baseline.json'), 'utf8')).rows);
  const wd = {}; for (const [d, r] of B.rows) { const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00Z').getUTCDay()]; (wd[w] = wd[w] || []).push(r); }
  const weekday = Object.fromEntries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((w) => { const a = wd[w] || [], m = a.reduce((x, v) => x + v, 0) / a.length, sd = Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / (a.length - 1)); return [w, { n: a.length, meanR: Math.round(m * 1000) / 1000, t: r2(m / (sd / Math.sqrt(a.length))) }]; }));
  const out = { built: '2026-11-20', source: 'research/edge/usdjpy-vol-breakout-forward/baseline.json', window: B.window, profile: P, risk, weekday, goldWeekday, note: 'In-sample years for the rule; simple %, no compounding; before slippage beyond what the study charged.' };
  fs.writeFileSync(path.join(HERE, '2026-11-20-usdjpy-risk.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
