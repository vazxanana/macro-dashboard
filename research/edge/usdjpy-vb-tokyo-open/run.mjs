// Edge research · usdjpy-vb-tokyo-open: USD/JPY T1 with the day anchored on the 17:00 New York close or 00:00 Tokyo, against
// the 00:00 UTC rule (PREREGISTRATION.md, pushed alone first). Paper research only: the rule stays the UTC day.
//   node research/edge/usdjpy-vb-tokyo-open/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, summary, normP, holm } from '../index-vol-breakout/original.mjs';
import { charge } from '../fx-vol-breakout/run.mjs';
import { nyKey, anchorOf as nyAnchor, nySkip } from '../gold-vol-breakout-k/run.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const K = 0.5, H = 3600, DAY = 86400, HOLD = 24 * H, TOKYO_H = 15;
export const GATE = { w: { early: ['2005-01-04', '2015-12-31'], late: ['2016-01-01', '2026-11-19'] }, want: { early: { n: 2089, netR: 0.079 }, late: { n: 2079, netR: 0.063 } }, tolN: 0.01, tolR: 0.005 };
export const W = { discovery: ['2005-01-04', '2014-12-31'], confirmation: ['2015-01-01', '2099-12-31'] };
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inW = (day, [a, b]) => day >= a && day <= b;
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };

// ─── anchored days: key → anchor; candles [anchor, anchor + hold); previous day's range from all of the previous key's candles ───
export function buildAnchored(rows, keyOf, anchorAt, labelOf, hold = HOLD) {
  const by = new Map();
  for (const r of rows) { const k = keyOf(r[0]); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const keys = [...by.keys()].sort((a, b) => a - b), days = [];
  keys.forEach((key, i) => {
    const A = anchorAt(key), rs = by.get(key);
    const bars = rs.filter((r) => r[0] >= A && r[0] < A + hold).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
    const prev = i > 0 ? by.get(keys[i - 1]) : null;
    let hi = -Infinity, lo = Infinity; if (prev) for (const r of prev) { if (r[2] > hi) hi = r[2]; if (r[3] < lo) lo = r[3]; }
    days.push({ day: labelOf(key), d0: A, bars, prevRange: prev ? hi - lo : null });
  });
  return days;
}
// fixed UTC hour h: the day starts at h:00 UTC; label = the date of the anchor (Tokyo: the Tokyo date = anchor + 9 h)
export const hourDays = (rows, h, label = (k) => ymd(k + h * H)) => buildAnchored(rows, (t) => Math.floor((t - h * H) / DAY) * DAY, (k) => k + h * H, label);
export const tokyoDays = (rows) => hourDays(rows, TOKYO_H, (k) => ymd(k + DAY));      // key + 15 h = 15:00 UTC = 00:00 Tokyo of key + 1 day
export const nyDays = (rows) => buildAnchored(rows, nyKey, nyAnchor, (k) => ymd(k));

// the exit time of a trade (for the rollover count only; R comes from vbTrade)
function exitT(bars, x) {
  const i = bars.findIndex((b) => b.t === x.fillT);
  if (x.side > 0 ? bars[i].l <= x.stop : bars[i].h >= x.stop) return bars[i].t;
  for (let j = i + 1; j < bars.length; j++) { const b = bars[j]; if (x.side > 0 ? b.l <= x.stop : b.h >= x.stop) return b.t; }
  return bars.at(-1).t + 300;
}
const rollOf = (t) => { const d = Math.floor((t - nyOffsetH(t) * H) / DAY) * DAY; return d + 17 * H + nyOffsetH(d + 22 * H) * H; };  // 17:00 NY of that NY date
export function trades(days, skip) {
  const tr = [];
  for (const d of days) {
    if (skip(d)) continue;
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (x.skip) continue;
    const xt = exitT(d.bars, x);
    let roll = rollOf(x.fillT); if (roll <= x.fillT) roll = rollOf(x.fillT + DAY);
    tr.push({ day: d.day, ...charge('usdjpy', x), overRoll: xt > roll });
  }
  return tr;
}
export const utcTrades = (rows) => trades(buildDays(rows), daySkip);
export const anchoredSkip = (d) => nySkip(d, true);

// ─── statistics ───
export function cell(tr) {
  const s = summary(tr);
  return { n: s.n, win: s.win, grossR: s.grossR, netR: s.netR, net2R: s.net2R, t: s.t, grossT: s.grossT, maxDD: s.maxDD, total: s.total, overRoll: tr.filter((x) => x.overRoll).length };
}
// paired monthly difference: per month, mean net R a trade of v − of u (per trade), and of the month sums
export function paired(v, u) {
  const by = (tr) => { const m = new Map(); for (const x of tr) { const k = x.day.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(x.net); } return m; };
  const A = by(v), B = by(u), dm = [], ds = [];
  for (const [k, a] of A) { const b = B.get(k); if (!b) continue; dm.push(mean(a) - mean(b)); ds.push(a.reduce((s, x) => s + x, 0) - b.reduce((s, x) => s + x, 0)); }
  const tt = (d) => (d.length > 1 && sdv(d) > 0 ? mean(d) / (sdv(d) / Math.sqrt(d.length)) : 0);
  return { months: dm.length, d: r3(mean(dm)), t: r2(tt(dm)), dSum: r3(mean(ds)), tSum: r2(tt(ds)) };
}
// the pre-registered decision for one variant, given Holm-adjusted p (better side) and (worse side)
export function decide(row, pBetter, pWorse) {
  const dPos = row.discovery.pair.d > 0 && row.confirmation.pair.d > 0, dNeg = row.discovery.pair.d < 0 && row.confirmation.pair.d < 0;
  const own = row.discovery.v.netR > 0 && row.confirmation.v.netR > 0 && row.discovery.v.n >= 200 && row.confirmation.v.n >= 200;
  if (dPos && pBetter < 0.05 && own) return 'BETTER';
  if (dNeg && pWorse < 0.05) return 'WORSE';
  return 'NO DIFFERENCE SHOWN';
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# USD/JPY T1: a New York or a Tokyo day instead of the UTC day (24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Days, tests and bar fixed in `PREREGISTRATION.md` (pushed alone before any variant figure; sha256 in `result.json`). The rule\'s functions come unchanged from `index-vol-breakout/original.mjs`, the cost from `fx-vol-breakout` `charge` (commission 0.000045 of the entry, measured, + 0.5 pip, ASSUMED), the New York day from `gold-vol-breakout-k`. Nothing is adopted: the rule stays the 00:00 UTC day with the 21:00 UTC exit. Nothing live changed.', '',
    `Gate: the UTC rule on this cache gives early n ${R.gate.got.early.n} / ${sg(R.gate.got.early.netR)}R and late n ${R.gate.got.late.n} / ${sg(R.gate.got.late.netR)}R against the published 2089 / +0.079R and 2079 / +0.063R: ${R.gate.ok ? 'inside the tolerance' : 'OUTSIDE the tolerance'}.`, '',
    '## The three days, after costs', '',
    '| Day | Window | n | Win | Gross R | Net R | Net 2x cost | Month t (net) | Max DD R | Held over 17:00 NY |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const [name, rows] of Object.entries(R.days)) for (const w of ['discovery', 'confirmation', 'pooled']) {
    const c = rows[w]; L.push(`| ${name} | ${w} | ${c.n} | ${(c.win * 100).toFixed(1)} % | ${sg(c.grossR)} | ${sg(c.netR)} | ${sg(c.net2R)} | ${sg(c.t, 2)} | ${sg(c.maxDD, 1)} | ${c.overRoll} |`);
  }
  L.push('', '## The two tests: variant minus the UTC rule, paired by month', '',
    '| Test | Window | Months | Mean diff, net R a trade | Paired t | Mean diff, month sums (R) | Paired t (sums) |', '|---|---|---|---|---|---|---|');
  for (const t of R.tests) for (const w of ['discovery', 'confirmation']) { const p = t[w].pair; L.push(`| ${t.name} | ${w} | ${p.months} | ${sg(p.d)} | ${sg(p.t, 2)} | ${sg(p.dSum, 2)} | ${sg(p.tSum, 2)} |`); }
  L.push('', '| Test | one-sided p (better) | Holm | one-sided p (worse) | Holm | Decision |', '|---|---|---|---|---|---|');
  for (const t of R.tests) L.push(`| ${t.name} | ${t.pBetter} | ${t.pBetterHolm} | ${t.pWorse} | ${t.pWorseHolm} | **${t.decision}** |`);
  L.push('', '## Control: the same rule on every other whole UTC hour as the day\'s start (24-hour day, pooled 2005 → now)', '',
    '| Anchor (UTC) | n | Net R | Month t |', '|---|---|---|---|');
  for (const c of R.control) L.push(`| ${String(c.h).padStart(2, '0')}:00 | ${c.n} | ${sg(c.netR)} | ${sg(c.t, 2)} |`);
  L.push('', R.controlText, '', '## Reading', '', R.text, '',
    `Data: ${R.data}. To repeat: \`node research/edge/usdjpy-vb-tokyo-open/run.mjs\` (candle cache of \`research/edge/_lib/edgekit.mjs\`, out of git). Test: \`tests/usdjpy-vb-tokyo-open.test.mjs\`.`, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex') !== ORIG_SHA) throw new Error('original.mjs changed');
  const { load } = await import('../_lib/edgekit.mjs');
  const all = load('usdjpy', '5m', { from: '2004-12-01' }).map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const lastFull = Math.floor(all.at(-1)[0] / DAY) * DAY, rows = all.filter((r) => r[0] < lastFull), dataEnd = ymd(lastFull - DAY);
  // gate
  const U = utcTrades(rows), got = { early: cell(U.filter((x) => inW(x.day, GATE.w.early))), late: cell(U.filter((x) => inW(x.day, GATE.w.late))) };
  const ok = ['early', 'late'].every((w) => Math.abs(got[w].n - GATE.want[w].n) <= GATE.tolN * GATE.want[w].n && Math.abs(got[w].netR - GATE.want[w].netR) <= GATE.tolR);
  console.log('gate', ok, JSON.stringify(got));
  if (!ok) { console.log('GATE FAILED: stop'); process.exit(2); }
  const V = { 'A. New York day (17:00 NY, 24 h)': trades(nyDays(rows), anchoredSkip), 'B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h)': trades(tokyoDays(rows), anchoredSkip) };
  const win = (tr, w) => tr.filter((x) => inW(x.day, W[w]));
  const days = { 'UTC (the rule)': { discovery: cell(win(U, 'discovery')), confirmation: cell(win(U, 'confirmation')), pooled: cell(U.filter((x) => x.day >= W.discovery[0])) } };
  for (const [n, tr] of Object.entries(V)) days[n] = { discovery: cell(win(tr, 'discovery')), confirmation: cell(win(tr, 'confirmation')), pooled: cell(tr.filter((x) => x.day >= W.discovery[0])) };
  const tests = Object.entries(V).map(([name, tr]) => {
    const o = { name };
    for (const w of ['discovery', 'confirmation']) o[w] = { v: cell(win(tr, w)), pair: paired(win(tr, w), win(U, w)) };
    o.pBetter = r3(normP(o.confirmation.pair.t)); o.pWorse = r3(normP(-o.confirmation.pair.t));
    return o;
  });
  const hb = holm(tests.map((t) => t.pBetter)), hw = holm(tests.map((t) => t.pWorse));
  tests.forEach((t, i) => { t.pBetterHolm = r3(hb[i]); t.pWorseHolm = r3(hw[i]); t.decision = decide(t, hb[i], hw[i]); });
  // control: every other whole UTC hour
  const control = [];
  for (let h = 0; h < 24; h++) {
    const tr = (h === 0 ? trades(hourDays(rows, 0), anchoredSkip) : h === TOKYO_H ? V['B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h)'] : trades(hourDays(rows, h), anchoredSkip)).filter((x) => x.day >= W.discovery[0]);
    const c = cell(tr); control.push({ h, n: c.n, netR: c.netR, t: c.t, note: h === 0 ? '00:00 UTC, 24-hour day (not the rule: the rule exits at 21:00)' : h === TOKYO_H ? 'Tokyo day (B)' : null });
    console.log('hour', h, c.n, c.netR, c.t);
  }
  const others = control.filter((c) => c.h !== TOKYO_H && c.h !== 0).map((c) => c.netR).sort((a, b) => a - b);
  const rankOf = (v) => others.filter((x) => x < v).length;
  const ruleR = days['UTC (the rule)'].pooled.netR, nyR = days['A. New York day (17:00 NY, 24 h)'].pooled.netR, tkR = days['B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h)'].pooled.netR;
  const controlText = `Among the 22 other whole-hour anchors (pooled net R a trade from ${others[0]} to ${others.at(-1)}, median ${r3((others[10] + others[11]) / 2)}), the UTC rule (${sg(ruleR)}R, its 21-hour day) is above ${rankOf(ruleR)} of 22, the New York day (${sg(nyR)}R) above ${rankOf(nyR)} and the Tokyo day (${sg(tkR)}R) above ${rankOf(tkR)}. Hours 21 and 22 UTC are close to the New York day (its anchor is 21:00 or 22:00 UTC with daylight saving). The control is reported only; it decides nothing.`;
  const dec = tests.map((t) => `${t.name.split(' (')[0]} ${t.decision}`).join('; ');
  const tA = tests[0], tB = tests[1];
  const verdict = `${tests.every((t) => t.decision === 'NO DIFFERENCE SHOWN') ? 'NO DIFFERENCE SHOWN' : dec}: ${dec}. Paired monthly difference against the UTC rule, net R a trade, discovery / confirmation: New York day ${sg(tA.discovery.pair.d)} (t ${sg(tA.discovery.pair.t, 2)}) / ${sg(tA.confirmation.pair.d)} (t ${sg(tA.confirmation.pair.t, 2)}); Tokyo day ${sg(tB.discovery.pair.d)} (t ${sg(tB.discovery.pair.t, 2)}) / ${sg(tB.confirmation.pair.d)} (t ${sg(tB.confirmation.pair.t, 2)}); the rule stays the UTC day`;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'usdjpy-vb-tokyo-open', title: 'USD/JPY T1: New York or Tokyo day instead of the UTC day', built: '2026-11-24', preregistration: 'research/edge/usdjpy-vb-tokyo-open/PREREGISTRATION.md', planSha256: sha,
    verdict, gate: { want: GATE.want, got, ok }, windows: { ...W, confirmation: [W.confirmation[0], dataEnd] }, k: K, days, tests, control, controlText, text: '',
    data: `OANDA mid USD/JPY M5, ${ymd(rows[0][0])} → ${dataEnd} (${rows.length} candles)` };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  const dA = days['A. New York day (17:00 NY, 24 h)'], dB = days['B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h)'], dU = days['UTC (the rule)'];
  R.text = `Neither other open does better. Pooled after costs the UTC rule makes ${sg(dU.pooled.netR)}R a trade (n ${dU.pooled.n}, month t ${sg(dU.pooled.t, 2)}), the New York day ${sg(dA.pooled.netR)}R (n ${dA.pooled.n}, t ${sg(dA.pooled.t, 2)}) and the Tokyo day ${sg(dB.pooled.netR)}R (n ${dB.pooled.n}, t ${sg(dB.pooled.t, 2)}); before costs ${sg(dU.pooled.grossR)} / ${sg(dA.pooled.grossR)} / ${sg(dB.pooled.grossR)}R. `
    + `Both variants trail the UTC rule in both windows (per-trade monthly difference New York ${sg(tA.discovery.pair.d)} / ${sg(tA.confirmation.pair.d)}R, Tokyo ${sg(tB.discovery.pair.d)} / ${sg(tB.confirmation.pair.d)}R), but the confirmation-window paired t (${sg(tA.confirmation.pair.t, 2)} and ${sg(tB.confirmation.pair.t, 2)}) is far from the pre-registered bar, so the result is NO DIFFERENCE SHOWN, not WORSE; in discovery the New York day trails at t ${sg(tA.discovery.pair.t, 2)} (not a test window). `
    + `Neither variant clears the parent bar on its own: New York confirmation ${sg(dA.confirmation.netR)}R (t ${sg(dA.confirmation.t, 2)}), Tokyo ${sg(dB.confirmation.netR)}R (t ${sg(dB.confirmation.t, 2)}); at 2x costs the Tokyo day is ${sg(dB.pooled.net2R)}R and the New York day ${sg(dA.pooled.net2R)}R against the rule's ${sg(dU.pooled.net2R)}R. `
    + `The Tokyo day also holds ${dB.pooled.overRoll} of its ${dB.pooled.n} trades over the 17:00 New York rollover, where financing (not charged here) and the break-hour spread (hidden by mid candles) would cost more, so its true figure is lower than shown. `
    + `What the control adds: the effect is not special to 00:00 UTC; days started anywhere from about 00:00 to 12:00 UTC give similar pooled net R (most +0.04 to +0.06R), while days started 18:00-22:00 UTC (around the New York close) lose. The 00:00 UTC rule with its 21:00 exit is the best of the three tested here mainly because it stops before the rollover hours (the same 00:00 UTC day held 24 hours gives ${sg(control[0].netR)}R). A before-cost tilt common to many anchors is not an edge, and none of these settings is chosen from this reading. Paper research; nothing live changes.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(verdict);
  for (const [n, d] of Object.entries(days)) console.log(n, JSON.stringify(d));
  for (const t of tests) console.log(t.name, JSON.stringify({ d: t.discovery.pair, c: t.confirmation.pair, pb: t.pBetterHolm, pw: t.pWorseHolm, dec: t.decision }));
}
