// Blow-off veto on the Gold Macro Score (pre-registered in PREREGISTRATION.md, 19 Nov 2026).
//   node research/edge/blowoff-veto/run.mjs fetch <dir>   → copies the inputs from origin/council-data (git, no network)
//   node research/edge/blowoff-veto/run.mjs run <dir>     → writes result.json and prints the summary
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { dxyDaily, dailyRows, weeklyFrame, expandingZ, goldMacroScore, isoDay, FROM, MIN_OBS } from '../../../council/macroscore.mjs';

const DAY = 86400, H = 4, BUY = 0.25, TEST_END = '2024-12-31', TEST_FROM = '2007-01-01';
export const VETO = { sma: 50, smaMax: 1.15, n20: 20, up20: 0.20, n7: 7, up7: 0.10 };
const FILES = ['research/daily/xau.json', 'research/daily/eurusd.json', 'research/daily/usdjpy.json', 'research/daily/gbpusd.json', 'research/daily/usdcad.json', 'research/daily/usdchf.json', 'macro/cache.json'];

// the blow-off flags of one day, from daily closes up to and including index i
export function flagsAt(closes, i, v = VETO) {
  const c = closes[i], out = { sma: false, up20: false, up7: false };
  if (i >= v.sma - 1) { let s = 0; for (let k = i - v.sma + 1; k <= i; k++) s += closes[k]; out.sma = c > v.smaMax * (s / v.sma); }
  if (i >= v.n20) out.up20 = c / closes[i - v.n20] - 1 > v.up20;
  if (i >= v.n7) out.up7 = c / closes[i - v.n7] - 1 > v.up7;
  out.any = out.sma || out.up20 || out.up7; return out;
}
// the weekly score, exactly the four drivers of council/macroscore.mjs goldMacroScore
export function weeklyScore({ ry, y2, y10, dxy }) {
  const F = weeklyFrame({ ry, y2, y10, dxy }, FROM), C = F.cols;
  const diffN = (a, n, f = (x, y) => x - y) => a.map((x, i) => (i >= n && x != null && a[i - n] != null ? f(x, a[i - n]) : null));
  const cv = C.y10.map((x, i) => (x != null && C.y2[i] != null ? x - C.y2[i] : null));
  const raw = [diffN(C.ry, 4).map((x) => (x == null ? null : -x)), diffN(C.dxy, 4, (a, b) => -(Math.log(a) - Math.log(b))), diffN(C.y2, 13).map((x) => (x == null ? null : -x)), diffN(cv, 13)];
  const z = raw.map((a) => expandingZ(a, MIN_OBS));
  return F.weeks.map((t, i) => ({ t, score: z.every((a) => a[i] != null) ? z.reduce((s, a) => s + a[i], 0) / 4 : null }));
}
// Newey-West slope t of y on a 0/1 dummy x
export function nwSlope(y, x, L = H) {
  const n = y.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  if (!sxx) return { b: null, t: null }; const b = sxy / sxx, a = my - b * mx, u = y.map((v, i) => (v - a - b * x[i]) * (x[i] - mx));
  let S = u.reduce((s, v) => s + v * v, 0); for (let l = 1; l <= L; l++) { let g = 0; for (let i = l; i < n; i++) g += u[i] * u[i - l]; S += 2 * (1 - l / (L + 1)) * g; }
  const se = Math.sqrt(S) / sxx; return { b, t: se ? b / se : null };
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const sharpe = (a) => { if (a.length < 2) return null; const m = mean(a), sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); return sd ? (m / sd) * Math.sqrt(52 / H) : null; };
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const episodes = (rows) => { let n = 0, prev = false; for (const r of rows) { if (r.flag && !prev) n++; prev = r.flag; } return n; };

export function analyse(rows) {
  const part = (fn) => rows.filter(fn), buyW = (rs) => rs.filter((r) => r.score > BUY);
  const block = (rs) => { const B = buyW(rs), y = B.map((r) => r.fwd), x = B.map((r) => (r.flag ? 1 : 0)), nw = nwSlope(y, x);
    const fl = B.filter((r) => r.flag).map((r) => r.fwd), un = B.filter((r) => !r.flag).map((r) => r.fwd);
    // long-or-flat book: each BUY week holds gold for its own 4-week window, weight 1/4 (overlapping quarters) → weekly series
    const book = (veto) => rs.map((r, i) => { let s = 0; for (let k = Math.max(0, i - H + 1); k <= i; k++) { const q = rs[k]; if (q.score > BUY && !(veto && q.flag)) s += (q.w1[i - k] ?? 0) / H; } return s; });
    return { weeks: rs.length, buyWeeks: B.length, flaggedBuy: fl.length, episodes: episodes(B), meanFlagged: r4(mean(fl)), meanUnflagged: r4(mean(un)),
      slope: r4(nw.b), t: nw.t == null ? null : +nw.t.toFixed(2), sharpeNoVeto: r4(sharpe(book(false))), sharpeVeto: r4(sharpe(book(true))),
      clause: Object.fromEntries(['sma', 'up20', 'up7'].map((c) => { const f = B.filter((r) => r.f[c]).map((r) => r.fwd); return [c, { n: f.length, mean: r4(mean(f)) }]; })),
      allWeeks: (() => { const y = rs.map((r) => r.fwd), x = rs.map((r) => (r.flag ? 1 : 0)), w = nwSlope(y, x); return { n: rs.length, flagged: x.filter(Boolean).length, episodes: episodes(rs), slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2), meanFlagged: r4(mean(rs.filter((r) => r.flag).map((r) => r.fwd))) }; })() }; };
  const test = block(part((r) => r.day >= TEST_FROM && r.day <= TEST_END)), late = block(part((r) => r.day > TEST_END));
  const pass = test.slope != null && test.slope < 0 && test.t <= -2 && test.sharpeVeto != null && test.sharpeVeto >= test.sharpeNoVeto;
  return { test, inSample2025: late, verdict: pass ? 'PASS' : 'FAIL' };
}

export function build(dir) {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const goldD = dailyRows(J('research/daily/xau.json')), daily = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) daily[k] = dailyRows(J(`research/daily/${k}.json`));
  const fred = J('macro/cache.json').score.fred, S = (k) => fred[k].map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v: +v }));
  const inp = { ry: S('DFII10'), y2: S('DGS2'), y10: S('DGS10'), dxy: dxyDaily(daily) };
  const W = weeklyScore(inp), parity = goldMacroScore(inp, { asOf: W[W.length - 1].t + DAY });
  const closes = goldD.map((o) => o.v), times = goldD.map((o) => o.t), last = (t) => { let lo = 0, hi = times.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
  const rows = [];
  for (let w = 0; w + H < W.length; w++) { if (W[w].score == null) continue;
    const i = last(W[w].t + DAY - 1); if (i < 0 || times[i] < W[w].t - 3 * DAY) continue;
    const ends = []; for (let k = 1; k <= H; k++) { const j = last(W[w + k].t + DAY - 1); ends.push(j < 0 ? null : closes[j]); } if (ends.some((v) => v == null)) continue;
    const f = flagsAt(closes, i), c0 = closes[i], w1 = ends.map((v, k) => Math.log(v / (k ? ends[k - 1] : c0)));
    rows.push({ day: isoDay(W[w].t), score: +W[w].score.toFixed(3), flag: f.any, f, fwd: +Math.log(ends[H - 1] / c0).toFixed(5), w1 }); }
  // reported AFTER the result, not pre-registered, descriptive only: every DAY the veto fires, gold's next 20 sessions
  const dayRows = []; for (let i = 0; i + 20 < closes.length; i++) { const f = flagsAt(closes, i); dayRows.push({ day: isoDay(times[i]), flag: f.any, fwd20: Math.log(closes[i + 20] / closes[i]) }); }
  const sum = (rs) => { const fl = rs.filter((r) => r.flag), all = rs.map((r) => r.fwd20); let ep = 0, prev = false; for (const r of rs) { if (r.flag && !prev) ep++; prev = r.flag; }
    return { days: rs.length, flaggedDays: fl.length, episodes: ep, meanFlagged: r4(mean(fl.map((r) => r.fwd20))), meanAll: r4(mean(all)), upShareFlagged: fl.length ? +(fl.filter((r) => r.fwd20 > 0).length / fl.length).toFixed(2) : null,
      episodeStarts: rs.filter((r, i) => r.flag && !(i && rs[i - 1].flag)).map((r) => r.day) }; };
  const dailyAfter = { note: 'Added after the pre-registered result; descriptive, not a test.', test: sum(dayRows.filter((r) => r.day >= TEST_FROM && r.day <= TEST_END)), late: sum(dayRows.filter((r) => r.day > TEST_END)) };
  return { rows, dailyAfter, parity: { last: W.filter((x) => x.score != null).slice(-1)[0], card: parity.score } };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', 'origin/council-data:' + f], { maxBuffer: 1 << 28 })); } console.log('fetched', FILES.length); }
  else if (cmd === 'run') { const B = build(dir), A = analyse(B.rows);
    const res = { study: 'blowoff-veto', title: 'Blow-off veto on the Gold Macro Score', built: '2026-11-19', veto: VETO, buy: BUY, horizonWeeks: H, testWindow: [TEST_FROM, TEST_END], parity: B.parity, ...A, dailyAfter: B.dailyAfter, rows: B.rows.map(({ w1, ...r }) => r) };
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n'); console.log(JSON.stringify({ verdict: A.verdict, test: A.test, dailyAfter: B.dailyAfter }, null, 1)); }
}
