// Edge research · usdjpy-vb-feed: USD/JPY T1 on HistData M1 2018 → Oct 2026 (PREREGISTRATION.md, pushed alone first).
// Paper research only.
//   node research/edge/usdjpy-vb-feed/run.mjs fetch <dir>            (git show from origin/council-data, no network)
//   node research/edge/usdjpy-vb-feed/run.mjs run <dir> <oanda usdjpy-5m.json.gz>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';
import { buildDays } from '../index-vol-breakout/original.mjs';
import { trades } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2018-01-02', TO = '2026-10-30';
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

// HistData M1 text -> UTC 5-minute candles [t, o, h, l, c]
export function to5m(text) {
  const m = new Map();
  for (const line of text.split('\n')) {
    const p = line.trim().split(';'); if (p.length < 5) continue;
    const t = histStampUtc(p[0]); const o = +p[1], h = +p[2], l = +p[3], c = +p[4];
    if (!Number.isFinite(t) || !(o > 0)) continue;
    const s = t - (t % 300), x = m.get(s);
    if (!x) m.set(s, [s, o, h, l, c, t, t]);
    else { if (t < x[5]) { x[1] = o; x[5] = t; } if (t >= x[6]) { x[4] = c; x[6] = t; } x[2] = Math.max(x[2], h); x[3] = Math.min(x[3], l); }
  }
  return [...m.values()].map((x) => x.slice(0, 5)).sort((a, b) => a[0] - b[0]);
}
export function monthT(rows) {
  const m = new Map(); for (const x of rows) m.set(x.day.slice(0, 7), (m.get(x.day.slice(0, 7)) || 0) + x.net);
  const v = [...m.values()]; if (v.length < 2) return null; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return sd > 0 ? a / (sd / Math.sqrt(v.length)) : null;
}
export const inWin = (t) => t.day >= FROM && t.day <= TO;
export function stats(tr) { return { n: tr.length, net: r3(mean(tr.map((t) => t.net))), monthT: r3(monthT(tr)) }; }
export function agreement(A, B) {
  const a = new Map(A.map((t) => [t.day, t])), both = B.filter((t) => a.has(t.day)), same = both.filter((t) => a.get(t.day).side === t.side);
  const x = both.map((t) => a.get(t.day).net), y = both.map((t) => t.net), mx = mean(x), my = mean(y);
  const cov = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0), vx = x.reduce((s, v) => s + (v - mx) ** 2, 0), vy = y.reduce((s, v) => s + (v - my) ** 2, 0);
  return { daysA: A.length, daysB: B.length, both: both.length, sameSide: r3(same.length / both.length), corr: r3(cov / Math.sqrt(vx * vy)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir, oanda] = process.argv.slice(2);
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const files = execFileSync('git', ['ls-tree', '--name-only', 'origin/council-data', 'research/candles/USDJPY/'], { encoding: 'utf8' }).trim().split('\n');
    let all = [];
    for (const f of files) all = all.concat(to5m(zlib.gunzipSync(execFileSync('git', ['show', `origin/council-data:${f}`], { maxBuffer: 1 << 30 })).toString()));
    all.sort((a, b) => a[0] - b[0]);
    fs.writeFileSync(path.join(dir, 'usdjpy-hd-5m.json.gz'), zlib.gzipSync(JSON.stringify(all)));
    console.log(files.length, 'files', all.length, '5m candles');
  } else if (mode === 'run') {
    const load = (f) => { const r = JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); r.sort((p, q) => p[0] - q[0]); return r; };
    const H = trades('usdjpy', buildDays(load(path.join(dir, 'usdjpy-hd-5m.json.gz')))).filter(inWin);
    const O = trades('usdjpy', buildDays(load(oanda))).filter(inWin);
    const sH = stats(H), sO = stats(O), ag = agreement(O, H), pass = sH.net > 0 && sH.monthT >= 2;
    const byYear = {}; for (const t of H) (byYear[t.day.slice(0, 4)] = byYear[t.day.slice(0, 4)] || []).push(t.net);
    const years = Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)) }]));
    const verdict = `${pass ? 'PASS' : 'FAIL'}: USD/JPY T1 on HistData M1 ${FROM} → ${TO}, ${sg(sH.net)}R a trade net (n ${sH.n}, month t ${sg(sH.monthT, 2)}); OANDA mid on the same window ${sg(sO.net)}R (n ${sO.n}, t ${sg(sO.monthT, 2)}); same side on ${Math.round(ag.sameSide * 100)} % of the ${ag.both} days both traded, daily R correlation ${ag.corr}`;
    const R = { study: 'usdjpy-vb-feed', built: '2026-11-20', verdict, pass, histdata: sH, oanda: sO, agreement: ag, years };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# USD/JPY T1 on a second candle feed (20 Nov 2026)', '',
      'Paper research only. Data, rule, cost and bar fixed in `PREREGISTRATION.md` before any trade on these candles was computed. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '',
      '| Feed | n | Net R/trade | Month t |', '|---|---|---|---|',
      `| HistData M1 (tested) | ${sH.n} | ${sg(sH.net)} | ${sg(sH.monthT, 2)} |`, `| OANDA mid 5m (reported) | ${sO.n} | ${sg(sO.net)} | ${sg(sO.monthT, 2)} |`, '',
      `Days traded on both feeds: ${ag.both} (OANDA ${ag.daysA}, HistData ${ag.daysB}); same side ${Math.round(ag.sameSide * 100)} %; correlation of daily net R ${ag.corr}.`, '',
      '| Year | n | Net R/trade (HistData) |', '|---|---|---|', ...Object.entries(years).map(([y, v]) => `| ${y} | ${v.n} | ${sg(v.net)} |`), '',
      'Fewer HistData days trade than OANDA days (1,582 against 1,679): the HistData file has missing minutes, most in February-July 2023 (4,000-5,100 five-minute candles a month against about 6,300), so the rule\'s thin-day skip drops those days. On the days both feeds traded, the trade is the same.', '',
      'HistData quotes are bid prices; the cost is the one charged on OANDA mid. 2018-26 overlaps `fx-vol-breakout`\'s in-sample years on OANDA: this checks the feed, not new years.', ''].join('\n'));
    console.log(verdict);
  }
}
