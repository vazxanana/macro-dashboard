// What the veteran's 1.6-1.8 news batch (research/macro-veteran/references/, 2022-24 release ledgers) says about the NEXT
// release: facts from the dated first-print record, put beside each upcoming red-folder card. Pure apart from loadBatch().
// Owner, 19 Nov 2026: "this cannot be only just notes, he needs to get insights for the next results".
// Rules (the batch's own): never a surprise without a frozen pre-release consensus; every figure is a 2022-24 first-print fact
// or a descriptive fit, with its n; nothing here is a tested edge, a forecast on the record, a rule or a trade.
import fs from 'node:fs';
import { EVENTS } from './events.mjs';

export const DESCRIPTIVE = 'From the 2022-24 first-print record (36 months): descriptive, not a tested edge or a forecast on the record.';
const REF = new URL('../research/macro-veteran/references/', import.meta.url);
const num = (x) => (x === '' || x == null || !Number.isFinite(+x) ? null : +x);
const r2 = (x, d = 2) => (x == null ? null : +x.toFixed(d));
const sg = (x, d = 2) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function csv(text) {
  const L = String(text || '').split(/\r?\n/).filter((l) => l.trim()), h = (L.shift() || '').split(',');
  return L.map((l) => { const c = l.split(','); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ''])); });
}
// the three ledgers this module reads; null when the batch is not on disk (a bundle without research/)
export function loadBatch(dir = REF) {
  try {
    const rd = (f) => fs.readFileSync(new URL(f, dir), 'utf8');
    return { panel: csv(rd('cpi-ppi-to-pce-release-panel-2022-2024.csv')), jobs: csv(rd('employment-situation-multifield-with-hours-2022-2024.csv')),
      ism: JSON.parse(rd('ism-jobs-same-day-verified-2022-2024.json')) };
  } catch (e) { return null; }
}

// which release a calendar title is (wider than the playbook's history types)
export function kindOf(title, country = 'USD') {
  const s = String(title || ''); if (country && country !== 'USD') return null;
  if (/\bPCE\b/i.test(s)) return 'PCE';
  if (/\bPPI\b/i.test(s)) return 'PPI';
  if (/\bCPI\b/i.test(s)) return 'CPI';
  if (/non-?farm|\bNFP\b|employment change|unemployment rate|average hourly/i.test(s)) return 'NFP';
  if (/speaks|testifies|minutes/i.test(s)) return null;
  if (/federal funds rate|FOMC statement|FOMC press conference/i.test(s)) return 'FOMC';
  if (/\bISM\b/i.test(s)) return 'ISM';
  return null;
}

// least squares y = a + b x; with the fit's own in-sample errors
export function ols(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (!sxx) return null;
  const b = sxy / sxx, a = my - b * mx, res = xs.map((x, i) => ys[i] - (a + b * x));
  return { a, b, n, mae: res.reduce((s, e) => s + Math.abs(e), 0) / n };
}

// the batch's standing facts, worked out once from the ledgers
export function facts(B) {
  if (!B) return null;
  const P = (B.panel || []).map((r) => ({ cpi: num(r.cpi_core_mom_sa_first_print_percent), pce: num(r.pce_core_mom_original_print_percent), ppiFirst: r.ppi_before_cpi_scheduled === 'true' }))
    .filter((r) => r.cpi != null && r.pce != null);
  const fit = ols(P.map((r) => r.cpi), P.map((r) => r.pce)), gap = P.map((r) => r.pce - r.cpi);
  const J = B.jobs || [], rev = J.map((r) => num(r.prior_two_month_revisions_sum_jobs)).filter((x) => x != null),
    hrs = J.map((r) => num(r.average_weekly_hours_change_as_stated)).filter((x) => x != null), pay = J.map((r) => num(r.payroll_change_jobs_current_first_release)).filter((x) => x != null);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  return {
    n: P.length, ppiFirst: P.filter((r) => r.ppiFirst).length,
    pce: fit && { a: r2(fit.a, 3), b: r2(fit.b, 3), mae: r2(fit.mae, 3), n: fit.n, gapMean: r2(gap.reduce((s, x) => s + x, 0) / gap.length, 3),
      same: P.filter((r) => Math.abs(r.pce - r.cpi) < 0.05).length, below: P.filter((r) => r.pce < r.cpi - 0.05).length },
    jobs: { n: J.length, revN: rev.length, revDown: rev.filter((x) => x < 0).length, revMedAbs: med(rev.map(Math.abs)), revMean: rev.length ? Math.round(rev.reduce((s, x) => s + x, 0) / rev.length) : null,
      hoursFlat: hrs.filter((x) => x === 0).length, hoursN: hrs.length, payMed: med(pay) },
    ism: { n: ((B.ism && B.ism.events) || []).length },
  };
}

// the strategist's whole calendar (macro/cache.json cal: at in unix seconds) as { title, country, at ISO, actual }
export function calendarOf(cache) {
  return ((cache && cache.cal) || []).filter((e) => e && e.title && Number.isFinite(+e.at))
    .map((e) => ({ title: e.title, country: e.country || null, at: new Date(+e.at * 1000).toISOString(), actual: e.actual === '' ? null : e.actual ?? null }));
}
// the latest first print of a release before t: the veteran's captured record (veteran-expectations.json) first, else the calendar
function lastPrint(E, cal, re, t, maxDays = 40) {
  const R = (E || []).filter((r) => (r.country || 'USD') === 'USD' && re.test(r.event || '') && r.firstPrint && r.firstPrint.value != null)
    .map((r) => ({ title: r.event, value: r.firstPrint.value, at: r.scheduledUtc }))
    .concat((cal || []).filter((e) => (e.country || 'USD') === 'USD' && re.test(e.title || '') && e.actual != null).map((e) => ({ title: e.title, value: e.actual, at: e.at })))
    .map((x) => ({ ...x, t: Date.parse(x.at) / 1000 })).filter((x) => x.t < t && x.t > t - maxDays * 86400).sort((a, b) => b.t - a.t);
  return R.length ? { ...R[0], num: num(String(R[0].value).replace(/[^\d.+-]/g, '')) } : null;
}
// a calendar entry of kind k within [t + a, t + b] seconds of t (the strategist's playbook and the captured records)
function near(cal, k, t, a, b) {
  return (cal || []).filter((e) => (e.country || 'USD') === 'USD' && kindOf(e.title, 'USD') === k).map((e) => ({ e, t: Date.parse(e.at) / 1000 }))
    .filter((x) => Number.isFinite(x.t) && x.t >= t + a && x.t <= t + b).sort((x, y) => x.t - y.t);
}

// 20 Nov 2026: two things the calendar feed cannot give. (1) The feed holds one week (next week's file appears over the weekend),
// so on a Friday nothing was said about the PCE five days away: the council's own schedule (events.mjs, top-tier US releases)
// fills the days the feed does not hold. (2) The feed carries no actuals, so the PCE point could never name the month's core CPI:
// the Cleveland Fed's nowcast file (macro/hard-data.json, already fetched by hard-data.mjs) carries the actual prints per month.
export function scheduleOf(now, days = 7) {
  return EVENTS.filter((e) => e.tier === 1 && e.country === 'USD' && e.t > now && e.t <= now + days * 86400)
    .map((e) => ({ title: e.title, country: 'USD', at: new Date(e.t * 1000).toISOString(), src: 'schedule' }));
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// the core CPI print of the month a PCE release at t refers to (the month before the release month), from hard-data.json
export function cpiPrintFrom(hd, t) {
  const M = hd && hd.nowcast && Array.isArray(hd.nowcast.months) ? hd.nowcast.months : null; if (!M || !Number.isFinite(t)) return null;
  const d = new Date(t * 1000), ref = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const m = M.find((x) => x.month === ref), v = m && m.actual ? m.actual.coreCpi : null;
  return Number.isFinite(v) ? { num: v, month: ref, name: MONTHS[+ref.slice(5) - 1], asOf: m.asOf || null } : null;
}

// the points for one upcoming card { title, country, at, titles }
export function contextFor(card, { F, expectations = [], calendar = [], now, hd = null }) {
  if (!F || !card) return null;
  const k = kindOf(card.title, card.country || 'USD') || (card.titles || []).map((x) => kindOf(x, card.country || 'USD')).find(Boolean); if (!k) return null;
  const t = Date.parse(card.at) / 1000, pts = [], cal = calendar.concat((expectations || []).map((r) => ({ title: r.event, country: r.country || 'USD', at: r.scheduledUtc })));
  const add = (text, kind = 'fact') => pts.push({ text, kind });
  if (k === 'PCE' && F.pce) {
    const cp = lastPrint(expectations, calendar, /core cpi m\/m/i, t);
    if (cp && cp.num != null) { const imp = F.pce.a + F.pce.b * cp.num;
      add(`Core CPI printed ${cp.value} m/m (${cp.at.slice(0, 10)}). On the 2022-24 record a core CPI of ${cp.num.toFixed(1)}% went with core PCE near ${imp.toFixed(2)}% (fit on ${F.pce.n} months, typical miss ±${F.pce.mae.toFixed(2)} pp): a descriptive fit on past months, not a forecast on the record.`, 'lead'); }
    else if (cpiPrintFrom(hd, t)) { const h = cpiPrintFrom(hd, t), imp = F.pce.a + F.pce.b * h.num;
      add(`Core CPI for ${h.name} printed ${h.num.toFixed(2)}% m/m (the Cleveland Fed's file of actual prints${h.asOf ? `, read ${h.asOf}` : ''}). On the 2022-24 record a core CPI of ${h.num.toFixed(1)}% went with core PCE near ${imp.toFixed(2)}% (fit on ${F.pce.n} months, typical miss ±${F.pce.mae.toFixed(2)} pp): a descriptive fit on past months, not a forecast on the record.`, 'lead'); }
    else add(`Read it from this month's core CPI print (not on file here; the calendar feed carries no actuals): on the 2022-24 record core CPI ${[0.2, 0.3, 0.4].map((x) => `${x.toFixed(1)}% went with core PCE near ${(F.pce.a + F.pce.b * x).toFixed(2)}%`).join(', ')} (fit on ${F.pce.n} months, typical miss ±${F.pce.mae.toFixed(2)} pp). A descriptive fit on past months, not a forecast on the record.`, 'lead');
    add(`In 2022-24 core PCE printed on average ${sg(F.pce.gapMean, 2)} pp from core CPI; the same to one decimal in ${F.pce.same} of ${F.n} months, lower in ${F.pce.below}. The CPI and PPI of the month were both out before every PCE release (36 of 36).`);
    add('Adding PPI to core CPI did not reliably improve the PCE read (24 rolling tests): read PPI as colour, not a signal.');
  }
  if (k === 'CPI') {
    const ppi = near(cal, 'PPI', t, -10 * 86400, -60);
    add(ppi.length ? `PPI already came out on ${day(ppi[ppi.length - 1].t)}, before this CPI: that happened in only ${F.ppiFirst} of ${F.n} months in 2022-24.` : `PPI usually comes after CPI (it came first in only ${F.ppiFirst} of ${F.n} months in 2022-24): CPI is the first price news of the month.`);
    if (F.pce) add(`It also sets the core PCE read: in 2022-24 core PCE matched core CPI to one decimal in ${F.pce.same} of ${F.n} months and averaged ${sg(F.pce.gapMean, 2)} pp from it.`);
    const fomc = near(cal, 'FOMC', t, 60, 2 * 86400);
    if (fomc.length) add(`A Fed statement follows within two days (${day(fomc[0].t)}): in 2022-24 that happened before 4 of 24 meetings, all with new projections. Keep the CPI move and the statement move apart.`, 'lead');
  }
  if (k === 'PPI') {
    const cpi = near(cal, 'CPI', t, -10 * 86400, -60);
    add(cpi.length ? `CPI is already out (${day(cpi[cpi.length - 1].t)}): PPI comes second, as in ${F.n - F.ppiFirst} of ${F.n} months in 2022-24.` : `PPI before CPI this month: that happened in only ${F.ppiFirst} of ${F.n} months in 2022-24.`);
    add('In 2022-24 a broad PPI measure added no reliable information about core PCE beyond core CPI (24 rolling tests).');
  }
  if (k === 'NFP' && F.jobs.n) {
    const J = F.jobs;
    add(`The prior two months get revised with this report: in 2022-24 the revisions were negative in ${J.revDown} of ${J.revN} releases (median size ${Math.round(J.revMedAbs / 1000)}k, average ${J.revMean > 0 ? '+' : '−'}${Math.abs(Math.round(J.revMean / 1000))}k). Read the headline with them.`, 'lead');
    add(`Average weekly hours were unchanged in ${J.hoursFlat} of ${J.hoursN} releases; payrolls, unemployment, earnings and hours can disagree, so judge the set, not one field. The median first print of payrolls was ${Math.round(J.payMed / 1000)}k.`);
    const ism = near(cal, 'ISM', t - (t % 86400), 0, 86399);
    add(ism.length ? `An ISM report is out the same day (${ism[0].e.title}): ${F.ism.n} jobs days in 2022-24 had one. Do not credit the later move to payrolls alone.` : `${F.ism.n} jobs days in 2022-24 also had an ISM report the same morning; none is on the calendar for this one.`);
    const fomc = near(cal, 'FOMC', t, 60, 2 * 86400); if (fomc.length) add(`A Fed statement follows within two days: no jobs release was that close to a 2022-24 statement.`);
  }
  if (k === 'FOMC') {
    const cpi = near(cal, 'CPI', t, -2 * 86400, -60);
    if (cpi.length) add(`CPI came out ${((t - cpi[cpi.length - 1].t) / 3600).toFixed(1)} h before this statement: in 2022-24 that happened at 4 of 24 meetings, all with new projections. Keep the CPI move and the statement move apart.`, 'lead');
    add('The statement and the press conference are separate news: after 2022 the press conference sometimes moved rate expectations the other way (San Francisco Fed event study). Judge each window on its own.');
    add('A rate change that was already priced is not news; the change in the expected path is (measured from futures or 2-year yields, not the decision).');
  }
  if (k === 'ISM') {
    const nfp = near(cal, 'NFP', t - (t % 86400), 0, 86399);
    if (nfp.length) add(`Same day as the jobs report: ${F.ism.n} such days in 2022-24. Read the two moves apart.`, 'lead');
    else return null;
  }
  if (!pts.length) return null;
  pts.sort((a, b) => (b.kind === 'lead') - (a.kind === 'lead'));
  return { kind: k, points: pts, label: DESCRIPTIVE, noSurprise: 'No consensus field from the batch is used: a surprise needs the expectation captured before the release.' };
}

// every upcoming release of a known kind in the next `days` days (the playbook's calendar), with its first point
export function ahead({ F, fc, calendar = [], expectations, now, days = 7, hd = null, schedule = scheduleOf(now, days) }) {
  if (!F) return [];
  const cal = ((fc && fc.playbook) || []).concat(calendar, schedule || []), seen = new Set(), out = [];
  for (const e of cal) {
    const t = Date.parse(e.at) / 1000; if (!Number.isFinite(t) || t <= now || t > now + days * 86400 || (e.country || 'USD') !== 'USD') continue;
    const k = kindOf(e.title, 'USD'); if (!k || k === 'ISM') continue;
    const key = `${k}|${String(e.at).slice(0, 13)}`, dkey = `${k}|${String(e.at).slice(0, 10)}`; if (seen.has(key) || (e.src === 'schedule' && seen.has(dkey))) continue; seen.add(key); seen.add(dkey);   // a scheduled release the calendar holds that day is said once
    const c = contextFor({ title: e.title, country: e.country || 'USD', at: e.at }, { F, expectations, calendar: cal, now, hd }); if (!c) continue;
    out.push({ kind: k, title: e.title, at: e.at, point: c.points[0].text, ...(e.src === 'schedule' ? { src: 'schedule' } : {}) });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 8);
}
