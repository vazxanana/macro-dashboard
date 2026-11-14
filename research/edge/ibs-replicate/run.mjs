// Edge research · ibs-replicate: #895's IBS rule (frozen.mjs, its run.mjs byte for byte) replicated on seven indices it never
// used, on their own OANDA UTC daily candles (PREREGISTRATION.md). Nothing in frozen.mjs is edited; this file only builds the
// day array the frozen `trade()` reads, then pools, tests and reports.
//   node research/edge/ibs-replicate/run.mjs fetch <dir>   (git show of council-data research/daily/<key>.json, no network)
//   node --use-env-proxy research/edge/ibs-replicate/run.mjs gate <h1Dir>   (H1 of spx500 / nas100 / us30 from #895's fetch.mjs)
//   node research/edge/ibs-replicate/run.mjs full <dir> [<h1Dir>]   (writes result.json and RESULT.md; the gate block is kept
//                                                                    from the last result.json when no H1 folder is given)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  trade, stats, monthT, monthsBetween, summ, holm, pOneSided, rng, pctile, rateOf, study, verdictOf,
  LO, SEEDS, SEEDS_NEED, FIRST, SPLIT,
} from './frozen.mjs';
import { foldWeekend } from '../../../council/fills.mjs';

export const NEW = {
  de40: 'Germany 40 (DE30_EUR)', uk100: 'UK 100 (UK100_GBP)', eu50: 'Euro Stoxx 50 (EU50_EUR)', fr40: 'France 40 (FR40_EUR)',
  jp225: 'Japan 225 (JP225_USD)', au200: 'Australia 200 (AU200_AUD)', hk33: 'Hong Kong 33 (HK33_HKD)',
};
export const COST = 0.0005;                        // #895's CFD round trip on NAS100 / US30, applied to all seven
export const HOLE_DAYS = 5;                        // a next candle more than this many calendar days later = no trade
export const COUNCIL_DATA = '1fc946e73';

const ymdOf = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const yr = (d) => +d.slice(0, 4);
const r3 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(3), r2 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(2);

// rows [t, o, h, l, c, v] -> folded weekday candles [t, o, h, l, c]
export function foldRows(rows) {
  return foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })))
    .map((b) => [b.time, b.open, b.high, b.low, b.close]);
}
// the day's close time: the candle's end; a Friday candle closes at 21:00 UTC (the CFD weekend close, before the rollover)
export function closeTime(t) { return new Date(t * 1000).getUTCDay() === 5 ? t + 21 * 3600 : t + 86400; }
// the frozen code's day record, from daily candles: t = close time - 3600 (so trade()'s E.t + 3600 is the entry close)
export function buildDaysD(bars) {
  return bars.map((b, i) => ({ d: ymdOf(b[0]), t: closeTime(b[0]) - 3600, i, close: b[4], hi: b[2], lo: b[3],
    ibs: b[2] > b[3] ? (b[4] - b[3]) / (b[2] - b[3]) : null }));
}
const hole = (D, e) => (Date.parse(D[e + 1].d) - Date.parse(D[e].d)) / 86400e3 > HOLE_DAYS;

// one market: the rule's trades and the placebo draws, the frozen marketRun's logic on the daily day array
export function marketRunD(k, bars, rate, cost, lastDay) {
  const D = buildDaysD(bars), opt = { cost, rate, side: 1 };
  const trades = [], skipped = [], entries = new Set();
  let ibsN = 0;
  for (let e = 0; e + 1 < D.length; e++) {
    if (yr(D[e].d) < FIRST) continue;
    if (D[e].ibs != null) ibsN++;
    if (!(D[e].ibs != null && D[e].ibs < LO)) continue;
    entries.add(e);
    const t = hole(D, e) ? null : trade(bars, D, e, e + 1, opt);
    if (t) trades.push({ ...t, market: k }); else skipped.push(D[e].d);
  }
  const rep = trades.filter((t) => yr(t.entryD) < SPLIT), dec = trades.filter((t) => yr(t.entryD) >= SPLIT);
  const pool = new Map();
  for (let e = 0; e + 1 < D.length; e++) {
    if (yr(D[e].d) < SPLIT || entries.has(e) || hole(D, e)) continue;
    const t = trade(bars, D, e, e + 1, opt);
    if (t) { if (!pool.has(yr(t.entryD))) pool.set(yr(t.entryD), []); pool.get(yr(t.entryD)).push(t.R); }
  }
  const counts = new Map(); for (const t of dec) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
  const draws = [];
  for (let s = 1; s <= SEEDS; s++) {
    const Rn = rng(s), obs = [];
    for (const [y, n] of [...counts].sort((a, b) => a[0] - b[0])) { const P = pool.get(y) || []; for (let j = 0; j < n && P.length; j++) obs.push(P[Math.floor(Rn() * P.length)]); }
    draws.push(obs);
  }
  const allDays = (inW) => { const xs = []; for (let e = 0; e + 1 < D.length; e++) if (inW(D[e].d) && !hole(D, e)) xs.push(100 * (D[e + 1].close / D[e].close - 1)); return stats(xs); };
  const ruleDays = (ts) => stats(ts.map((t) => 100 * (D[D.findIndex((x) => x.d === t.exitD)].close / t.entry - 1)));
  const byYear = {}; for (const t of trades) (byYear[yr(t.entryD)] ||= []).push(t.R);
  const mRep = monthsBetween(FIRST, `${SPLIT - 1}-12-31`), mDec = monthsBetween(SPLIT, lastDay);
  const days = D.filter((x) => yr(x.d) >= FIRST);
  return { dec, rep, draws, out: { market: k, name: NEW[k], decisive: summ(dec, mDec), replication: summ(rep, mRep),
    skipped: skipped.length, noIbs: days.filter((x) => x.ibs == null).length, days: days.length, signalShare: r3(ibsN ? entries.size / ibsN : null),
    allDaysPct: { decisive: r3(allDays((d) => yr(d) >= SPLIT).mean), replication: r3(allDays((d) => yr(d) >= FIRST && yr(d) < SPLIT).mean) },
    ruleDaysPct: { decisive: r3(ruleDays(dec).mean), replication: r3(ruleDays(rep).mean) },
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => { const s = stats(xs); return [y, { n: s.n, R: r3(s.mean) }]; })) } };
}

// R3: one observation per entry date, the mean net R of the markets that fired that day
export function byDay(trades) {
  const m = new Map(); for (const t of trades) { if (!m.has(t.entryD)) m.set(t.entryD, []); m.get(t.entryD).push(t.R); }
  const xs = [...m.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length), s = stats(xs);
  return { days: s.n, R: r3(s.mean), t: r2(s.t), p: pOneSided(s.t) };
}

export function readingOf(T) {
  const adj = holm([T.R1.p, T.R3.p]);
  const rep = T.R1.R > 0 && adj[0] < 0.05 && T.R3.R > 0 && adj[1] < 0.05 && T.R2.R > 0;
  const partly = T.R1.R > 0 && T.R1.monthT != null && T.R1.monthT >= 1;
  return { holm: { R1: +adj[0].toFixed(4), R3: +adj[1].toFixed(4) }, reading: rep ? 'REPLICATES' : partly ? 'PARTLY' : 'DOES NOT REPLICATE' };
}

export function replicate(M, rates, cost = COST) {
  const keys = Object.keys(NEW).filter((k) => M[k]);
  const lastDay = keys.map((k) => ymdOf(M[k].at(-1)[0])).sort().at(-1);
  const rate = rateOf(rates.DGS2, rates.before2006);
  const runs = {}; for (const k of keys) runs[k] = marketRunD(k, M[k], rate, cost, lastDay);
  const dec = keys.flatMap((k) => runs[k].dec), rep = keys.flatMap((k) => runs[k].rep);
  const mDec = monthsBetween(SPLIT, lastDay), mRep = monthsBetween(FIRST, `${SPLIT - 1}-12-31`);
  const s1 = summ(dec, mDec), s2 = summ(rep, mRep);
  const R1 = { ...s1, p: pOneSided(monthT(dec, mDec).t) }, R2 = s2, R3 = byDay(dec);
  const seeds = Array.from({ length: SEEDS }, (_, s) => keys.flatMap((k) => runs[k].draws[s])).map((o) => o.length ? o.reduce((a, b) => a + b, 0) / o.length : null);
  const mean1 = stats(dec.map((t) => t.R)).mean;
  const placebo = { seeds: seeds.map(r3), beaten: seeds.filter((m) => m != null && mean1 > m).length, need: SEEDS_NEED,
    p5: r3(pctile(seeds, 0.05)), p50: r3(pctile(seeds, 0.5)), p95: r3(pctile(seeds, 0.95)) };
  return { lastDay, keys, tests: { R1, R2, R3 }, placebo, markets: Object.fromEntries(keys.map((k) => [k, runs[k].out])) };
}

// the gate: the frozen study on #895's own H1 candles must give #895's published pooled block (and tests) exactly
export function gate(h1Dir, rates, published) {
  const M = {}, sha = {};
  for (const k of ['spx500', 'nas100', 'us30']) { const buf = fs.readFileSync(path.join(h1Dir, `${k}-1h.json.gz`)); M[k] = JSON.parse(zlib.gunzipSync(buf)); sha[k] = crypto.createHash('sha256').update(zlib.gunzipSync(buf)).digest('hex').slice(0, 16); }
  const S = JSON.parse(JSON.stringify(study(M, rates))), v = verdictOf(S), same = {};
  for (const p of ['decisive', 'replication', 'placebo']) same[`pooled.${p}`] = JSON.stringify(S.pooled[p]) === JSON.stringify(published.pooled[p]);
  for (const t of ['T1', 'T2', 'T3']) for (const p of ['decisive', 'replication', 'placebo']) same[`${t}.${p}`] = JSON.stringify(S.tests[t][p]) === JSON.stringify(published.tests[t][p]);
  same.verdict = v.verdict === published.verdict;
  return { pass: Object.values(same).every(Boolean), same, candles: sha, from: S.from, to: S.to, pooled: { decisive: S.pooled.decisive, replication: S.pooled.replication, placeboBeaten: S.pooled.placebo.beaten }, verdict: v.verdict };
}

const f3 = (x) => x == null ? '–' : (x >= 0 ? '+' : '') + x.toFixed(3), f2 = (x) => x == null ? '–' : x.toFixed(2);
export function report(res) {
  const L = [], B = res.base, T = B.tests;
  const tail = !res.gate.pass ? ' (gate failed: not interpreted)' : res.verdict === 'DOES NOT REPLICATE' ? ' (fails the pre-registered reading)' : '';
  L.push(`**Verdict: ${res.verdict}**${tail}. ${res.headline}`, '');
  L.push('# Result: the IBS daily reversal, frozen and replicated on seven other indices (14 Nov 2026)', '');
  L.push(`Pre-registered in PREREGISTRATION.md (pushed alone first, commit ${res.prereg}). Paper only; nothing live changed. Rule (frozen.mjs = #895's run.mjs byte for byte, sha256 \`${res.frozenSha.slice(0, 16)}…\`): IBS = (close - low) / (high - low) of the day < ${LO} → buy the close, sell the next day's close, stop 1 x ATR(20). Day = each market's own OANDA UTC daily candle (weekend folded into Monday; Friday closes 21:00 UTC). Cost ${(100 * COST).toFixed(2)} % a round trip, financing (DGS2 + 2.5 %) / 365 a rollover night, Friday three. Data: council-data \`research/daily/<key>.json\` (commit ${COUNCIL_DATA}), to ${B.lastDay}. Decisive window 2016 to now, replication 2005-2015.`, '');
  L.push('## Gate', '');
  L.push(`frozen.mjs \`study()\` on #895's own OANDA H1 candles (spx500, nas100, us30, ${res.gate.from} to ${res.gate.to}, fetched again with #895's fetch.mjs): **${res.gate.pass ? 'passed' : 'FAILED'}**, ${Object.values(res.gate.same).filter(Boolean).length} of ${Object.keys(res.gate.same).length} blocks deep-equal to #895's published result.json (pooled decisive / replication / placebo, T1-T3 each, verdict). Pooled decisive n ${res.gate.pooled.decisive.n}, net ${f3(res.gate.pooled.decisive.R)}R, month-sum t ${f2(res.gate.pooled.decisive.monthT)}; replication n ${res.gate.pooled.replication.n}, ${f3(res.gate.pooled.replication.R)}R.`, '');
  L.push('## Tests (pooled seven markets, long, IBS < 0.2)', '');
  L.push('| Test | Window | n | Gross R | Net R | Cost R | Financing R | Win % | t | One-sided p | Holm p |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  L.push(`| R1 pooled | 2016-now | ${T.R1.n} | ${f3(T.R1.grossR)} | ${f3(T.R1.R)} | ${f3(T.R1.costR)} | ${f3(T.R1.finR)} | ${f2(T.R1.win)} | ${f2(T.R1.monthT)} (month-sum) | ${T.R1.p.toFixed(4)} | ${res.holm.R1.toFixed(4)} |`);
  L.push(`| R2 pooled | 2005-2015 | ${T.R2.n} | ${f3(T.R2.grossR)} | ${f3(T.R2.R)} | ${f3(T.R2.costR)} | ${f3(T.R2.finR)} | ${f2(T.R2.win)} | ${f2(T.R2.monthT)} (month-sum) | – | – |`);
  L.push(`| R3 by entry day | 2016-now | ${T.R3.days} days | – | ${f3(T.R3.R)} | – | – | – | ${f2(T.R3.t)} (day) | ${T.R3.p.toFixed(4)} | ${res.holm.R3.toFixed(4)} |`);
  L.push('', '## Cost rows (descriptive, decide nothing; financing unchanged)', '');
  L.push('| Cost a round trip | R1 net R | R1 month-sum t | R2 net R | R2 month-sum t | R3 net R | R3 t |');
  L.push('|---|---|---|---|---|---|---|');
  for (const [lab, x] of [['0.05 % (pre-registered)', res.base], ['0.025 % (half: a cheaper futures route, descriptive)', res.half], ['0.10 % (2x)', res.double]]) L.push(`| ${lab} | ${f3(x.tests.R1.R)} | ${f2(x.tests.R1.monthT)} | ${f3(x.tests.R2.R)} | ${f2(x.tests.R2.monthT)} | ${f3(x.tests.R3.R)} | ${f2(x.tests.R3.t)} |`);
  L.push('', '## Placebo (random same-count days per market and year, traded the same way, 2016-now, 40 seeds)', '');
  L.push(`Rule R1 net ${f3(T.R1.R)}R beats ${B.placebo.beaten} of ${SEEDS} seed means (5th pct ${f3(B.placebo.p5)}, median ${f3(B.placebo.p50)}, 95th ${f3(B.placebo.p95)}).`, '');
  L.push('## Per market (reported, not judged)', '');
  L.push('| Market | Window | n | Gross R | Net R | Month-sum t | Rule days % | Every day % | Skipped | Days without IBS |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.values(B.markets)) for (const [w, s, rd, ad] of [['2016-now', c.decisive, c.ruleDaysPct.decisive, c.allDaysPct.decisive], ['2005-2015', c.replication, c.ruleDaysPct.replication, c.allDaysPct.replication]]) L.push(`| ${c.name} | ${w} | ${s.n} | ${f3(s.grossR)} | ${f3(s.R)} | ${f2(s.monthT)} | ${f3(rd)} | ${f3(ad)} | ${w === '2016-now' ? c.skipped : ''} | ${w === '2016-now' ? `${c.noIbs} of ${c.days}` : ''} |`);
  L.push('', '## By year (net R a trade, n)', '');
  const ks = Object.keys(B.markets), years = [...new Set(ks.flatMap((k) => Object.keys(B.markets[k].byYear)))].sort();
  L.push(`| Year | ${ks.join(' | ')} |`); L.push(`|---|${ks.map(() => '---').join('|')}|`);
  for (const y of years) L.push(`| ${y} | ${ks.map((k) => { const b = B.markets[k].byYear[y]; return b ? `${f3(b.R)} (${b.n})` : '–'; }).join(' | ')} |`);
  L.push('', '## What this does and does not say', '', ...res.notes);
  return L.join('\n') + '\n';
}

export function loadDaily(dir) {
  const M = {}; for (const k of Object.keys(NEW)) M[k] = foldRows(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')).rows); return M;
}

// the plain reading, written after the numbers were seen (not part of any test)
export const NOTES = [
  '- **It does not replicate.** On the seven indices #895 never used, 2016-now, the frozen rule lost: R1 −0.041R a trade net (n 3,543, month-sum t −1.97), R3 by entry day −0.024R (1,313 days, t −1.39). Every one of the seven is negative net on 2016-now (Australia 200 worst, −0.080R, t −2.54; Hong Kong 33 least bad, −0.013R).',
  '- **Before costs there is next to nothing left since 2016**: +0.008R a trade gross pooled (#895 had +0.069R on the US indices). The placebo agrees: the rule\'s mean beats 19 of 40 random-day seeds, the middle of the pack, so low-IBS days are not better entries than any other day on these markets.',
  '- **2005-2015 had the effect before costs** (+0.064R gross, +0.021R net, month-sum t 1.06; Japan 225 +0.093R net, t 2.97), the same fade #895 saw on the S&P 500 and the Dow. A reversal that was there before publication and is gone after it, in two separate sets of markets.',
  '- **Cheaper execution does not rescue it here**: with the round trip halved (a stand-in for a futures route, descriptive) R1 is still −0.023R (t −1.10) and R3 −0.006R. At twice the cost R1 is −0.077R (t −3.65). So #900\'s NAS100 futures result, already chosen after seeing the CFD result, gets no support from other indices.',
  '- Limits, fixed before the results: the day here is each market\'s OANDA UTC daily CFD candle, not its exchange cash session (#895\'s New York H1 session cannot be built from council-data and is not these markets\' day); for Japan 225 the UTC day ends at the Tokyo open. The stop is checked on the next daily candle (open, then low), not on H1. Financing uses the US 2-year rate for every market (above the euro and yen rates for most of the sample, so conservative there; financing is 0.013R a trade in all). One cost (0.05 %) for all seven; the half-cost row shows the reading does not hang on it.',
  '- Nothing live changed and no proposal follows. #895\'s FAIL stands, and the IBS reversal is not an edge on these CFDs.',
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, dir, h1] = process.argv.slice(2), here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of Object.keys(NEW)) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `${COUNCIL_DATA}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('written', Object.keys(NEW).join(' '));
  } else if (mode === 'gate' || mode === 'full') {
    const pub = JSON.parse(execFileSync('git', ['show', '4053ff27a:research/edge/index-ibs/result.json'], { maxBuffer: 1 << 28 }));
    const gateDir = mode === 'gate' ? dir : h1;
    const prev = fs.existsSync(path.join(here, 'result.json')) ? JSON.parse(fs.readFileSync(path.join(here, 'result.json'), 'utf8')) : null;
    const G = gateDir ? gate(gateDir, rates, pub) : prev && prev.gate;
    if (!G) throw new Error('no gate: pass the H1 folder');
    console.log('GATE', G.pass, JSON.stringify(G.same));
    if (mode === 'full') {
      const M = loadDaily(dir), base = replicate(M, rates), half = replicate(M, rates, COST / 2), double = replicate(M, rates, COST * 2);
      const r = readingOf(base.tests), verdict = G.pass ? r.reading : 'DOES NOT REPLICATE';
      const frozenSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(here, 'frozen.mjs'))).digest('hex');
      const T = base.tests;
      const headline = `Pooled over seven indices #895 never used, 2016-now: R1 ${f3(T.R1.R)}R a trade net (n ${T.R1.n}, month-sum t ${f2(T.R1.monthT)}, Holm p ${r.holm.R1.toFixed(3)}), R3 by entry day ${f3(T.R3.R)}R (${T.R3.days} days, t ${f2(T.R3.t)}, Holm p ${r.holm.R3.toFixed(3)}), R2 2005-15 ${f3(T.R2.R)}R (n ${T.R2.n}); gate passed: ${G.pass ? 'yes' : 'no'}.`;
      const out = { built: '2026-11-14', study: 'ibs-replicate', title: 'The IBS daily reversal, frozen and replicated on seven other indices', prereg: '3e9c808f1',
        system: 'IBS < 0.2 next-day long, frozen from index-ibs (#895), on DE40 / UK100 / EU50 / FR40 / JP225 / AU200 / HK33 (not a council system)',
        verdict, reading: verdict, headline, holm: r.holm, frozenSha, gate: G, cost: COST,
        data: { src: `OANDA mid daily candles, council-data research/daily/<key>.json at ${COUNCIL_DATA}, weekend folded into Monday`, markets: NEW, financing: '(DGS2 + 2.5 %) / 365 a 22:00 UTC rollover, Friday three (#895, unchanged)' },
        base, half, double, notes: NOTES };
      fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
      fs.writeFileSync(path.join(here, 'RESULT.md'), report(out));
      console.log(verdict, headline);
      for (const [lab, x] of [['base', base], ['half', half], ['double', double]]) console.log(lab, JSON.stringify(x.tests));
      console.log('placebo', JSON.stringify({ b: base.placebo.beaten, p5: base.placebo.p5, p50: base.placebo.p50, p95: base.placebo.p95 }));
      for (const c of Object.values(base.markets)) console.log(c.market, JSON.stringify(c.decisive), JSON.stringify(c.replication), 'skip', c.skipped, 'noIbs', c.noIbs, c.days, JSON.stringify(c.ruleDaysPct), JSON.stringify(c.allDaysPct));
    }
  } else throw new Error('usage: node run.mjs fetch|gate|full <dir> [<h1Dir>]');
}

