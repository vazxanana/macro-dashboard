// Nowcast against consensus (pre-registered in PREREGISTRATION.md, 20 Nov 2026): when the Cleveland Fed inflation nowcast sat
// above / below the calendar consensus before a US CPI release in 2022-24, did the first print land on that side?
// A direction-of-surprise test, not a trade (no costs). Reads committed files only, no network:
//   node research/edge/nowcast-vs-consensus/run.mjs        → writes result.json and prints the table
import fs from 'node:fs';
import { IN_LINE, binomP } from '../../../council/prep-record.mjs';

const J = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
export const MIN_JUDGED = 20, ALPHA = 0.05, HALF = 18;
export const MEASURES = { core: { name: 'Core CPI m/m', re: /^Core CPI m\/m/ }, headline: { name: 'CPI m/m', re: /^CPI m\/m/ } };
const num = (x) => { const v = parseFloat(String(x ?? '').replace(/−/g, '-').replace(/[^\d.+-]/g, '')); return Number.isFinite(v) ? v : null; };
const r1 = (x) => Math.round(x * 10) / 10;

// lean of the nowcast against the consensus: the desk's band (week-ahead.mjs prepFor, same guard)
export const leanOf = (nowcast, cons) => Math.abs(nowcast - cons) < IN_LINE - 1e-9 ? 'in line' : nowcast > cons ? 'above' : 'below';
// the print as published (one decimal) against the consensus
export const printSide = (print, cons) => { const d = r1(r1(print) - cons); return d === 0 ? 'on' : d > 0 ? 'above' : 'below'; };

// one row per release of the batch ledger that has a consensus row on its UTC date
export function rows(bench, hist, mk) {
  const M = MEASURES[mk], out = [];
  const recs = ((bench && bench.records) || []).slice().sort((a, b) => (a.release_date < b.release_date ? -1 : 1));
  recs.forEach((b, i) => {
    const m = b.measure && b.measure[mk]; if (!m || !m.forecasts || !m.forecasts.C || !m.actual) return;
    const h = ((hist && hist.rows) || []).find((x) => M.re.test(x[0]) && String(x[1]).slice(0, 10) === b.release_date);
    const cons = h ? num(h[2]) : null, nowcast = +m.forecasts.C.numeric, print = +m.actual.numeric;
    if (cons == null || !Number.isFinite(nowcast) || !Number.isFinite(print)) return;
    const lean = leanOf(nowcast, cons), side = printSide(print, cons), judged = lean !== 'in line' && side !== 'on';
    const calAct = h ? num(h[3]) : null;
    out.push({ d: b.release_date, month: b.reference_month, half: i < HALF ? 1 : 2, chartDate: b.model_chart_date, ageDays: b.model_age_days,
      authenticated: !!b.model_original_delivery_authenticated, nowcast: +nowcast.toFixed(4), cons, gap: +(nowcast - cons).toFixed(4), lean,
      print: r1(print), side, judged, hit: judged ? lean === side : null, calendarActual: calAct, calendarDiffers: calAct != null && r1(calAct) !== r1(print) });
  });
  return out;
}

const tally = (xs) => { const J2 = xs.filter((r) => r.judged), k = J2.filter((r) => r.hit).length, n = J2.length;
  return { n, hits: k, rate: n ? +(k / n).toFixed(3) : null, p: n ? +binomP(k, n).toFixed(4) : null }; };

export function analyse(R) {
  const lean = R.filter((r) => r.lean !== 'in line');
  const all = tally(R), h1 = tally(R.filter((r) => r.half === 1)), h2 = tally(R.filter((r) => r.half === 2));
  return { releases: R.length, lean: lean.length, leanShare: R.length ? +(lean.length / R.length).toFixed(3) : null, inLine: R.length - lean.length,
    leanPrintOnConsensus: lean.filter((r) => r.side === 'on').length, judged: all, halves: { first: h1, second: h2 },
    bySide: { above: tally(R.filter((r) => r.lean === 'above')), below: tally(R.filter((r) => r.lean === 'below')) },
    calendarDiffers: R.filter((r) => r.calendarDiffers).length,
    preRelease: R.every((r) => r.chartDate < r.d), authenticated: R.every((r) => r.authenticated) };
}

// the pre-registered bar, primary (core) only
export function verdictOf(A) {
  if (!A.preRelease) return 'INCONCLUSIVE';
  if (A.judged.n < MIN_JUDGED) return 'INCONCLUSIVE';
  const up = (t) => t.n > 0 && t.rate > 0.5;
  return A.judged.p < ALPHA && up(A.judged) && up(A.halves.first) && up(A.halves.second) ? 'PASS' : 'FAIL';
}

// the one sentence the Week ahead puts beside the prep line (council/week-ahead.mjs PREP_STUDY; a test compares the two)
export function sentence(res) {
  const j = res.core.judged, v = res.verdict;
  const tail = v === 'PASS' ? 'it pointed the right way more often than chance, on a retrospective record of an unauthenticated model history; not a tested trading edge'
    : v === 'FAIL' ? 'no better than a coin on which side the print lands; read the lean as context only'
      : 'too few judged releases to say';
  return `In 2022-24 the nowcast's side matched the print on ${j.hits} of ${j.n} judged core CPI releases (two-sided binomial p ${j.p == null ? 'n/a' : j.p.toFixed(2)}): ${tail}.`;
}

export function build(bench, hist) {
  const core = rows(bench, hist, 'core'), head = rows(bench, hist, 'headline');
  const res = { study: 'nowcast-vs-consensus', title: 'Nowcast against consensus: did the US CPI print land on the side the Cleveland Fed nowcast leaned to?',
    built: '2026-11-20', inLine: IN_LINE, minJudged: MIN_JUDGED, alpha: ALPHA, sample: '36 US CPI releases, Jan 2022 to Dec 2024',
    core: analyse(core), headline: analyse(head) };
  res.verdict = verdictOf(res.core);
  res.sentence = sentence(res);
  res.events = { core, headline: head };
  return res;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const res = build(J('../../macro-veteran/references/cpi-model-benchmark-inputs-2022-2024.json'), J('../../../council/consensus-history.json'));
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ core: res.core, headline: res.headline, verdict: res.verdict, sentence: res.sentence }, null, 1));
}
