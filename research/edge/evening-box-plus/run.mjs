// research/edge/evening-box-plus/run.mjs - can the 20-23 UTC M15 box close-out fade pay its costs? (PREREGISTRATION.md,
// 24 Nov 2026). The evening-methods R5 signal with 3 stops x 4 targets x 4 filters (48 variants) screened AFTER costs on the ten
// markets evening-methods read; the one chosen variant tested once on five holdout crosses. Research only: nothing is placed.
//   EDGE_DATA=<cache> node --max-old-space-size=6000 research/edge/evening-box-plus/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/evening-box-plus/run.mjs cut <m> <outDir>
//   node research/edge/evening-box-plus/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { FROM, TO, NM, DM, p1 } from '../grid7-wide-core/run.mjs';
import { signals as fadeSignals, exits } from '../grid7-wide-fade/run.mjs';
import { boxEvents, ATRK as BOX_ATRK, CAP as BOX_CAP } from '../grid7-box-fade/run.mjs';
import { specs as emSpecs, HOUR, MARKETS as SCREEN } from '../evening-methods/run.mjs';
import { stats } from '../fade-hour-check/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { SCREEN };
export const HOLDOUT = ['gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud'];
export const STOPS = ['S1', 'S2', 'S3'], TARGETS = ['1R', '2R', '3R', 'box'], FILTERS = ['none', '+fade', '+other', 'no-roll'];
export const OTHER = [1, 6, 8, 9];          // evening-methods R2, R7, R9, R10
export const ROLL = [21, 22];
export const variants = () => STOPS.flatMap((s, si) => TARGETS.flatMap((x, xi) => FILTERS.map((f, fi) => ({ si, xi, fi, name: `${s} ${x} ${f}` }))));
export const MIN_N = 300;

// ---- evening box close-out fades of one 5-minute series: { t, s, fi, flags: { fade, other, roll }, stops: [3] } -------------
export function boxSpecs(M5, market, { withOther = true } = {}) {
  const F = frames(M5), T = F['15m'], out = [];
  const fadeAt = new Set(); for (const g of fadeSignals(F)) if (g.cx === 0 && g.tf === 1) fadeAt.add(g.j + '|' + g.d);
  const oth = { 1: [], [-1]: [] };
  if (withOther) { for (const g of emSpecs(M5, market)) if (OTHER.includes(g.r)) oth[g.s].push(M5[g.fi].t); oth[1].sort((a, b) => a - b); oth[-1].sort((a, b) => a - b); }
  const near = (L, t) => { let lo = 0, hi = L.length; while (lo < hi) { const m = (lo + hi) >> 1; if (L[m] <= t) lo = m + 1; else hi = m; } return lo > 0 && L[lo - 1] > t - 3600; };
  for (const g of boxEvents(T, 0, F['1h'])) {
    if (g.kind !== 'co' || HOUR(g.ts - 900) < 20) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue;
    const t = M5[fi].t, fill = M5[fi].o, s = -g.d;
    const stops = [g.ext + g.d * BOX_ATRK * g.a, fill - s * g.a, fill - s * 2 * g.a];
    out.push({ t, s, fi, tb: g.d > 0 ? g.lo : g.hi, stops, flags: { fade: fadeAt.has(g.j + '|' + g.d), other: near(oth[s], t), roll: ROLL.includes(HOUR(t)) } });
  }
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// one market -> rows [t, fadeFlag, otherFlag, rollFlag, then per stop: costR, R1, R2, R3, Rbox] (null = no trade in that slot)
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const cost = COSTS[market], X = exclusions(market), rows = []; const cnt = { events: 0, dropped: 0, open: 0 };
  for (const g of boxSpecs(M5, market)) {
    cnt.events++; if (g.t < FROM || g.t >= TO) continue; if (X.length && inBad(X, g.t)) { cnt.dropped++; continue; }
    const fill = M5[g.fi].o, row = [g.t, +g.flags.fade, +g.flags.other, +g.flags.roll]; let any = false;
    for (const stop of g.stops) {
      const risk = g.s * (fill - stop);
      if (!(risk > 0) || risk < cost) { row.push(null, null, null, null, null); continue; }
      if (!(g.s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const kb = (g.s * (g.tb - fill)) / risk, ks = [1, 2, 3, kb >= 1 ? kb : NaN];
      const r = exits(M5, g.s, g.fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + g.s * k * risk : NaN)), BOX_CAP['15m']);
      if (!r) { cnt.open++; row.push(null, null, null, null, null); continue; }
      any = true; row.push(+(cost / risk).toPrecision(6), ...r.R.map((x) => (Number.isFinite(x) ? +x.toFixed(6) : null)));
    }
    if (any) rows.push(row);
  }
  return { market, cost, candles: M5.length, ...cnt, rows };
}

export function cutTest(market, cuts = ['2006-06-14', '2007-03-21', '2007-11-14', '2008-08-20', '2009-05-13']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2010-01-01' });
  const key = (g) => [g.t, g.s, ...g.stops.map((x) => x.toFixed(9)), g.tb, +g.flags.fade, +g.flags.other].join('|');
  const full = boxSpecs(M5, market); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const C5 = M5.filter((b) => b.e <= T);
    const A = new Set(boxSpecs(C5, market).filter((g) => C5[g.fi].e <= T).map(key)), B = new Set(full.filter((g) => M5[g.fi].e <= T).map(key));
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------------
const pass = (fi, r) => (fi === 0 ? true : fi === 1 ? r[1] === 1 : fi === 2 ? r[2] === 1 : r[3] === 0);
// trades of one variant in fade-hour-check's shape [t, 0, R, costR x mult]
export function tradesOf(rows, v, mult = 1) {
  const out = []; for (const r of rows) { if (!pass(v.fi, r)) continue; const o = 4 + v.si * 5, c = r[o], R = r[o + 1 + v.xi];
    if (c == null || R == null) continue; out.push([r[0], 0, R, c * mult]); } return out;
}
const r6 = (x) => (x == null ? null : +x.toFixed(6)), r3 = (x) => (x == null ? null : +x.toFixed(3));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: r3(w.t), meanNet: r6(w.meanNet), tNet: r3(w.tNet), win: r3(w.win), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const WA = [0, DM], WB = [DM, NM], WALL = [0, NM];
export function screen(D) {
  const rows = D.flatMap((d) => d.rows);
  const list = variants().map((v) => { const L = tradesOf(rows, v); const A = stats(L, ...WA), B = stats(L, ...WB), all = stats(L, ...WALL);
    const eligible = A.n >= MIN_N && B.n >= MIN_N && A.meanNet > 0 && B.meanNet > 0;
    return { ...v, A: slim(A), B: slim(B), all: slim(all), eligible, score: Math.min(A.tNet, B.tNet) }; });
  const el = list.filter((x) => x.eligible).sort((a, b) => b.score - a.score || b.all.n - a.all.n);
  return { list, chosen: el[0] || null };
}
export function holdoutTest(H, v) {
  const rows = H.flatMap((d) => d.rows), L = tradesOf(rows, v), L15 = tradesOf(rows, v, 1.5);
  const all = stats(L, ...WALL), A = stats(L, ...WA), B = stats(L, ...WB), x15 = stats(L15, ...WALL);
  const per = H.map((d) => ({ market: d.market, ...slim(stats(tradesOf(d.rows, v), ...WALL)) }));
  const nPos = per.filter((p) => p.meanNet > 0).length;
  const checks = [
    { what: 'pooled after costs: mean > 0 and month t >= 2', ok: all.meanNet > 0 && all.tNet >= 2 },
    { what: 'after costs mean > 0 in 2005-14 and in 2015-26', ok: A.meanNet > 0 && B.meanNet > 0 },
    { what: 'after 1.5 x the cost: mean > 0', ok: x15.meanNet > 0 },
    { what: 'positive after costs in at least 3 of 5 markets', ok: nPos >= 3 },
  ];
  return { all: slim(all), A: slim(A), B: slim(B), x15: slim(x15), per, nPos, checks, p: all.tNet == null ? 1 : p1(all.tNet, NM - 1),
    pass: all.n >= MIN_N && checks.every((c) => c.ok), enough: all.n >= MIN_N };
}

const read = (dir, f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
export function report(dir) {
  const D = SCREEN.map((m) => read(dir, `M-${m}.json`)).filter(Boolean);
  if (D.length !== SCREEN.length) throw new Error('screen markets missing');
  const cuts = SCREEN.map((m) => read(dir, `cut-${m}.json`)).filter(Boolean).flat();
  const em = JSON.parse(fs.readFileSync(path.join(HERE, '../evening-methods/result.json'), 'utf8')).rows.find((x) => x.k === 'R5').buckets[0];
  const base = tradesOf(D.flatMap((d) => d.rows), { si: 0, xi: 1, fi: 0 });
  const bA = stats(base, ...WA), bB = stats(base, ...WB);
  const gate = [{ what: 'base S1 2R none = evening-methods R5 evening, 2005-14', want: { n: em.A.n, mean: em.A.mean }, got: { n: bA.n, mean: r6(bA.mean) } },
    { what: 'base S1 2R none = evening-methods R5 evening, 2015-26', want: { n: em.B.n, mean: em.B.mean }, got: { n: bB.n, mean: r6(bB.mean) } }]
    .map((g) => ({ ...g, ok: g.want.n === g.got.n && Math.abs(g.want.mean - g.got.mean) < 0.0005 }));
  const S = screen(D);
  let H = null, hold = null;
  if (S.chosen) { H = HOLDOUT.map((m) => read(dir, `M-${m}.json`)).filter(Boolean); if (H.length !== HOLDOUT.length) throw new Error('holdout markets missing'); hold = holdoutTest(H, S.chosen); }
  const verdict = !S.chosen ? 'FAIL' : !hold.enough ? 'INCONCLUSIVE' : hold.pass ? 'PASS' : 'FAIL';
  const best = [...S.list].sort((a, b) => b.score - a.score)[0];
  const headline = !S.chosen
    ? `none of the 48 variants of the evening M15 box fade is positive after costs in both windows on the ten screen markets; the nearest, ${best.name}, made ${fR(best.A.meanNet)}R / ${fR(best.B.meanNet)}R a trade after costs (2005-14 / 2015-26, n ${N(best.A.n)} / ${N(best.B.n)}); the holdout was not read.`
    : `chosen variant ${S.chosen.name}: screen ${fR(S.chosen.A.meanNet)}R / ${fR(S.chosen.B.meanNet)}R a trade after costs; holdout crosses ${fR(hold.all.meanNet)}R a trade after costs (n ${N(hold.all.n)}, month t ${f2(hold.all.tNet)}), ${hold.pass ? 'every holdout check met' : 'holdout checks not all met'}.`;
  const res = { verdict, headline, built: new Date().toISOString().slice(0, 10), gate, gateOk: gate.every((g) => g.ok), cuts,
    cutsOk: cuts.length > 0 && cuts.every((c) => !c.missing && !c.extra), screen: S.list.map(({ score, ...x }) => ({ ...x, score: r3(score) })),
    chosen: S.chosen ? S.chosen.name : null, holdout: hold, holdoutMarkets: HOLDOUT,
    meta: [...D, ...(H || [])].map((d) => ({ market: d.market, cost: d.cost, candles: d.candles, events: d.events, dropped: d.dropped, open: d.open, rows: d.rows.length })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md(res));
  return res;
}

const fR = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US');
export function md(r) {
  const L = ['# Evening box fade plus: can the 20-23 UTC M15 box close-out fade pay its costs? (result)', '',
    `**Verdict: ${r.verdict}. ${r.headline}**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants outside the 48. Judged AFTER costs (one flat round trip a market; ASSUMED',
    'for xag, nzdusd, usdcad, usdchf, eurjpy and all five holdout crosses).', '',
    '## What was run', '',
    'The evening-methods R5 signal (fade the M15 box close-out when the close-out candle starts 20:00-23:59 UTC) with 3 stops',
    '(S1 past the close-out candle, S2 1 ATR, S3 2 ATR), 4 targets (1R, 2R, 3R, the box\'s other edge) and 4 filters (none; +fade =',
    'the same candle is a first-break fade; +other = another of the owner\'s fades on the same side in the hour; no-roll = fill',
    'outside 21:00-22:59 UTC). Screen on the ten markets evening-methods read; the eligible variant (after costs > 0 in 2005-14 and',
    '2015-26, n >= 300 each) with the largest weaker after-cost month t is tested once on gbpjpy, audjpy, cadjpy, eurgbp, euraud.', '',
    '## Checks', '',
    ...r.gate.map((g) => `- Gate, ${g.what}: n ${N(g.got.n)} mean ${fR(g.got.mean)} (want n ${N(g.want.n)}, ${fR(g.want.mean)}): ${g.ok ? 'equal' : 'DIFFERENT'}.`),
    `- Cut test (${r.cuts.length} cuts): ${r.cutsOk ? 'equal on cut candles' : 'MISMATCH'} (${r.cuts.map((c) => `${c.market} ${c.cut} n ${c.n}`).join('; ')}).`,
    '- Every trade has its stop on the losing side (the run throws otherwise).', '',
    '## The screen (ten markets, in sample)', '',
    'After costs R a trade (month t) | before costs, n. Eligible = after costs > 0 in both windows with n >= 300 each.', '',
    '| Variant | n A | A after (t) | A before | n B | B after (t) | B before | cost R | Eligible |', '|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...r.screen.map((v) => `| ${v.name} | ${N(v.A.n)} | ${fR(v.A.meanNet)} (${f2(v.A.tNet)}) | ${fR(v.A.mean)} | ${N(v.B.n)} | ${fR(v.B.meanNet)} (${f2(v.B.tNet)}) | ${fR(v.B.mean)} | ${v.all.costR == null ? 'n/a' : v.all.costR.toFixed(3)} | ${v.eligible ? (v.name === r.chosen ? 'chosen' : 'yes') : 'no'} |`), ''];
  if (r.holdout) { const h = r.holdout;
    L.push('## The holdout test (five crosses, one variant)', '', `Variant: ${r.chosen}.`, '',
      `- Pooled 2005-26: ${fR(h.all.meanNet)}R a trade after costs (n ${N(h.all.n)}, month t ${f2(h.all.tNet)}); ${fR(h.all.mean)}R before costs.`,
      `- 2005-14: ${fR(h.A.meanNet)}R after costs (n ${N(h.A.n)}); 2015-26: ${fR(h.B.meanNet)}R (n ${N(h.B.n)}).`,
      `- At 1.5 x the cost: ${fR(h.x15.meanNet)}R a trade.`, '',
      '| Check | Met |', '|---|---|', ...h.checks.map((c) => `| ${c.what} | ${c.ok ? 'yes' : 'no'} |`), '',
      '| Market | n | after costs (t) | before | cost R |', '|---|---:|---:|---:|---:|',
      ...h.per.map((p) => `| ${p.market} | ${N(p.n)} | ${fR(p.meanNet)} (${f2(p.tNet)}) | ${fR(p.mean)} | ${p.costR == null ? 'n/a' : p.costR.toFixed(3)} |`), ''); }
  L.push('## What it means', '', ...meaning(r), '');
  return L.join('\n');
}
function meaning(r) {
  const tail = ['', 'Nothing live changed and no rule is proposed. Never call this an edge without the broker\'s own evening bid / ask:',
    'the flat cost a market does not see the wider spreads around the 21:00-22:59 UTC rollover.'];
  if (!r.chosen) return ['No stop, target, confluence with the owner\'s other fades, or leaving out the rollover fills makes the evening box',
    'fade positive after costs in both windows. The before-cost tilt is real but smaller than one round trip at every stop size.', ...tail];
  if (r.verdict === 'PASS') return ['The chosen variant stayed positive after costs on five crosses it was never fitted to. That makes it a candidate for',
    'a forward paper record with its own pre-registration, NOT an edge: the holdout costs are assumed, and the evening hours',
    'include the rollover.', ...tail];
  return ['The variant chosen on the ten screen markets did not hold after costs on the five holdout crosses: what the screen picked',
    'was fitted to the markets it was chosen on.', ...tail];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2); const t0 = Date.now();
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, `M-${a}.json`), JSON.stringify(r));
    console.log(a, r.rows.length, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, `cut-${a}.json`), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
