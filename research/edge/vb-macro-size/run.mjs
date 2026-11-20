// Edge research · vb-macro-size: the rule book's "size by the Gold Macro Score" on gold-vol-breakout's T1 (PREREGISTRATION.md,
// pushed alone first). Paper research only.
//   GGO_FROM=2006-12-01T00:00:00Z GGO_TO=2026-11-13T00:00:00Z node --use-env-proxy research/edge/gold-gap-open/fetch.mjs <candleDir>
//   node research/edge/macro-donchian/run.mjs fetch <dataDir>          (council-data files, git show, no network)
//   node research/edge/vb-macro-size/run.mjs <candleDir> <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { tradesIn, daysOf, stats, GATE } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge, ORIG_SHA, COSTS_SHA } from '../gold-vol-breakout-hourcost/run.mjs';
import { frozenCost, SLIP } from '../gold-vol-breakout-forward/run.mjs';
import { load } from '../macro-donchian/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), HC = path.join(HERE, '..', 'gold-vol-breakout-hourcost');
export const P = { FROM: '2007-01-01', TO: '2026-11-12', SPLIT: '2017-01-01', BUY: 0.25 };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const normP = (t) => O.normP(t);

export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { d: NaN, t: NaN };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { d, t: se > 0 ? d / se : NaN };
}
// month-sum t of the difference (post hoc, reported): per calendar month, mean(above) − mean(at or below) where both exist
function monthDiffT(rows) {
  const m = new Map(); for (const x of rows) { const k = x.day.slice(0, 7); if (!m.has(k)) m.set(k, { a: [], b: [] }); m.get(k)[x.above ? 'a' : 'b'].push(x.net); }
  const d = [...m.values()].filter((v) => v.a.length && v.b.length).map((v) => mean(v.a) - mean(v.b));
  return { months: d.length, t: d.length > 1 && sdv(d) > 0 ? r2(mean(d) / (sdv(d) / Math.sqrt(d.length))) : null };
}
const cell = (a) => ({ n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), win: r3(a.filter((x) => x.net > 0).length / a.length) });

export function split(rows, side, want) {
  const S = rows.filter((x) => x.side === side && x.score != null), A = S.filter((x) => x.above), B = S.filter((x) => !x.above);
  const all = welch(A.map((x) => x.net), B.map((x) => x.net));
  const halves = [[P.FROM, P.SPLIT], [P.SPLIT, '9999']].map(([a, b]) => { const H = S.filter((x) => x.day >= a && x.day < b);
    const w = welch(H.filter((x) => x.above).map((x) => x.net), H.filter((x) => !x.above).map((x) => x.net)); return { d: r3(w.d), t: r2(w.t), nAbove: H.filter((x) => x.above).length, nBelow: H.filter((x) => !x.above).length }; });
  const p = normP(want * all.t);   // one-sided, in the claimed direction
  return { above: cell(A), atOrBelow: cell(B), diff: r3(all.d), t: r2(all.t), p, halves, gross: r2(welch(A.map((x) => x.R), B.map((x) => x.R)).t), monthSum: monthDiffT(S) };
}
// the book's sizing on T1: longs ×1 above +0.25 else ×0.5; shorts ×0 above +0.25 else ×1
export function sized(rows) {
  const w = (x) => (x.side === 'buy' ? (x.above ? 1 : 0.5) : (x.above ? 0 : 1));
  const book = (f) => { const c = rows.map((x) => ({ day: x.day, net: f(x) * x.net, R: f(x) * x.R, risk: f(x) })); let eq = 0, hi = 0, dd = 0; for (const x of c) { eq += x.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
    const risk = c.reduce((s, x) => s + x.risk, 0), tot = c.reduce((s, x) => s + x.net, 0); return { total: r2(tot), risk: r2(risk), perRisk: r3(tot / risk), monthT: r2(O.monthT(c).t), maxDD: r2(dd) }; };
  return { flat: book(() => 1), book: book(w) };
}

export function analyse(trades, scoreAt) {
  const rows = trades.map((x) => { const t0 = Date.parse(x.day + 'T00:00:00Z') / 1000, s = scoreAt(t0 - 1); return { ...x, score: s, above: s != null && s > P.BUY }; });
  const H1 = split(rows, 'buy', 1), H2 = split(rows, 'sell', -1), holm = O.holm([H1.p, H2.p]);
  H1.holm = r3(holm[0]); H2.holm = r3(holm[1]); H1.p = r3(H1.p); H2.p = r3(H2.p);
  H1.pass = H1.t >= 2 && H1.holm < 0.05 && H1.halves.every((h) => h.d > 0);
  H2.pass = H2.t <= -2 && H2.holm < 0.05 && H2.halves.every((h) => h.d < 0);
  const scored = rows.filter((x) => x.score != null);
  return { n: rows.length, unscored: rows.length - scored.length, H1, H2, sizing: { pooled: sized(scored), first: sized(scored.filter((x) => x.day < P.SPLIT)), second: sized(scored.filter((x) => x.day >= P.SPLIT)) } };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const c = (x) => `n ${x.n}, ${sg(x.netR)}R net (${sg(x.grossR)}R gross), ${(x.win * 100).toFixed(1)} % won`;
  const h = (name, X, side) => [`### ${name}`, '', `- Score above +0.25: ${c(X.above)}`, `- Score at or below: ${c(X.atOrBelow)}`,
    `- Difference ${sg(X.diff)}R, Welch t ${sg(X.t, 2)}, one-sided p ${X.p}, Holm p ${X.holm}; gross t ${sg(X.gross, 2)}; month-sum t (post hoc) ${sg(X.monthSum.t, 2)} over ${X.monthSum.months} months`,
    `- Halves: 2007-16 ${sg(X.halves[0].d)}R (t ${sg(X.halves[0].t, 2)}, ${X.halves[0].nAbove} / ${X.halves[0].nBelow}); 2017-26 ${sg(X.halves[1].d)}R (t ${sg(X.halves[1].t, 2)}, ${X.halves[1].nAbove} / ${X.halves[1].nBelow})`,
    `- **${X.pass ? 'Passes' : 'Fails'}** (${side})`, ''];
  const s = (k, v) => `| ${k} | ${sg(v.flat.total, 2)} | ${sg(v.flat.monthT, 2)} | ${sg(v.flat.maxDD, 2)} | ${sg(v.book.total, 2)} | ${v.book.risk} | ${sg(v.book.perRisk)} | ${sg(v.book.monthT, 2)} | ${sg(v.book.maxDD, 2)} |`;
  return [`# Gold breakout T1 sized by the Gold Macro Score (20 Nov 2026)`, '',
    'Paper research only. The rule book\'s "size by the score, never short above +0.25" on gold-vol-breakout\'s T1, as fixed in `PREREGISTRATION.md` (pushed before any trade was joined to a score). Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    `T1, 2007-01-01 → 2026-11-12, net of the demo's measured hourly cost (route C1): ${R.n} trades (gate: n ${R.gate.n}, gross ${sg(R.gate.grossR)}R a trade, ${R.gate.ok ? 'reproduced' : 'NOT reproduced'}); ${R.unscored} before the score's first reading.`, '',
    ...h('H1: longs, above +0.25 better', R.H1, 'longs'), ...h('H2: shorts, above +0.25 worse', R.H2, 'shorts'),
    '## The book\'s sizing applied to T1 (reported, not tested)', '',
    '| Window | Flat total R | Flat month t | Flat max DD | Sized total R | Risk units | Sized R per unit | Sized month t | Sized max DD |', '|---|---|---|---|---|---|---|---|---|',
    s('2007-26', R.sizing.pooled), s('2007-16', R.sizing.first), s('2017-26', R.sizing.second), '',
    '## Deviation from the pre-registration (stated)', '', R.deviation, '',
    '## Reading', '', R.reading, '',
    '## Limits', '', '- The score and the rule book were written knowing 2007-26; T1 was found on 2016-26. The split t counts trades of the same week as independent (the month-sum t beside it is post hoc).', '- Today\'s cost profile is charged for every year.', ''].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [candleDir, dataDir] = process.argv.slice(2);
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(HC, f))).digest('hex');
  if (sha('original.mjs') !== ORIG_SHA || sha('costs.mjs') !== COSTS_SHA) throw new Error('original.mjs / costs.mjs are not the pinned copies');
  const { days } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(candleDir, 'xau-5m.json.gz')))));
  const tr = tradesIn(days, [P.FROM, P.TO]).tr, gs = stats(tr.map((x) => ({ ...x, net: x.R })));
  const gate = { n: tr.length, grossR: gs.grossR, ok: tr.length === GATE.pooled.want.n && gs.grossR === GATE.pooled.want.grossR };
  if (!gate.ok) { console.log('gate failed', gate, GATE.pooled.want); process.exit(1); }
  const cost = frozenCost(), net = charge(tr, cost.profile, 'frac', cost.commission, SLIP);
  const trades = tr.map((x, i) => ({ day: x.day, side: x.side > 0 ? 'buy' : 'sell', R: x.R, net: net[i].net }));
  const D = load(dataDir), A = analyse(trades, D.scoreAt);
  const verdict = (A.H1.pass || A.H2.pass ? 'PASS' : 'FAIL') + `: H1 (longs above +0.25 better) ${A.H1.pass ? 'passes' : 'fails'}, difference ${sg(A.H1.diff)}R (t ${sg(A.H1.t, 2)}); H2 (shorts above +0.25 worse) ${A.H2.pass ? 'passes' : 'fails'}, difference ${sg(A.H2.diff)}R (t ${sg(A.H2.t, 2)})`;
  const deviation = 'The plan named `GGO_TO=2026-11-13` for the candle download. The loader drops the last calendar day of a file, so candles ending at midnight on 13 Nov left 12 Nov out and the gate missed by one trade (3,712 against 3,713). The candles of 12-13 Nov were added (a second download, `GGO_FROM=2026-11-12`, merged by time) so that the plan\'s own window, days to 2026-11-12, and its gate hold. No trade was looked at before the gate passed.';
  const reading = `Longs taken with the score above +0.25 did better (${sg(A.H1.above.netR)}R against ${sg(A.H1.atOrBelow.netR)}R a trade, positive in both halves), but by a margin the test cannot separate from luck (t ${sg(A.H1.t, 2)}, Holm p ${A.H1.holm}); counted by calendar months it is nil (t ${sg(A.H1.monthSum.t, 2)}). Shorts above +0.25 were not worse in a way that counts (t ${sg(A.H2.t, 2)}). Sized the book's way, T1 earns ${sg(A.sizing.pooled.book.perRisk)}R per unit of risk against ${sg(A.sizing.pooled.flat.perRisk)}R flat, with the same month t and drawdown: no reason to size T1 by the score. T1's forward record stays flat 1R.`;
  const res = { study: 'vb-macro-size', title: 'Gold breakout T1 sized by the Gold Macro Score', built: '2026-11-20', params: P, gate, weeks: D.weeks, verdict, deviation, reading, ...A };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(verdict); console.log(JSON.stringify({ H1: A.H1, H2: A.H2, sizing: A.sizing.pooled }));
}
