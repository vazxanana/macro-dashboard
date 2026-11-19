// Red folder study (19 Nov 2026, owner: "a section of the most important red folders, to study and compare previous months:
// the news, what we expected, what came out, how the market reacted, so we can prepare").
// One table per release type, newest first: the date, what was expected (the calendar consensus the council captured before
// the release, or for CPI 2022-24 the Cleveland Fed model from the veteran batch), what printed (the batch's first prints
// 2022-24, else the current FRED value, which can include revisions), the prior month, and how gold and the dollar moved
// (first 5 / 60 minutes from council/event-base.json where it has the release, the UTC release-day close-to-close from the
// council's daily closes). Then the next release of each type with its consensus, and a summary of past reactions.
// Pure apart from loadInputs(); fetches nothing. Descriptive: never a surprise without a captured consensus, never a forecast,
// a tested edge, a rule or a trade.
import fs from 'node:fs';
import { EVENTS as SCHED, HISTORY as SCHED_H } from './events.mjs';

const DAY = 86400;
const REF = new URL('../research/macro-veteran/references/', import.meta.url);
export const HIST_SRC = 'Forex Factory via a community dataset';
export const LABEL = 'What was expected, what printed and how gold reacted, release by release. Descriptive: not a forecast, not a tested edge.';
const num = (x) => { if (x == null || x === '') return null; const v = parseFloat(String(x).replace(/[^\d.+-]/g, '')); return Number.isFinite(v) ? v * (/K\b/i.test(String(x)) ? 1 : 1) : null; };
const r2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const dayOf = (t) => Math.floor(t / DAY) * DAY;
const isoD = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const ym = (t) => isoD(t).slice(0, 7);

// the types: calendar titles (US), the field shown, and how its actual is read from the FRED series
export const TYPES = [
  { k: 'CPI', name: 'CPI', sched: 'CPI', fields: [
    { k: 'core', name: 'Core CPI m/m', re: /^Core CPI m\/m/i, fred: 'CPILFESL', calc: 'mom' },
    { k: 'head', name: 'CPI m/m', re: /^CPI m\/m/i, fred: 'CPIAUCSL', calc: 'mom' }] },
  { k: 'NFP', name: 'Jobs report', sched: 'NFP', fields: [
    { k: 'pay', name: 'Payrolls (k)', re: /^Non-Farm Employment Change/i, fred: 'PAYEMS', calc: 'diff', unit: 'k' },
    { k: 'ur', name: 'Unemployment rate', re: /^Unemployment Rate/i, fred: 'UNRATE', calc: 'level', unit: '%' },
    { k: 'ahe', name: 'Hourly earnings m/m', re: /Average Hourly Earnings m\/m/i, fred: 'CES0500000003', calc: 'mom' }] },
  { k: 'FOMC', name: 'Fed decision', sched: 'FOMC', rose: 'the Fed raised rates', fell: 'it cut', fields: [
    { k: 'rate', name: 'Fed funds (upper)', re: /Federal Funds Rate/i, fred: 'DFEDTARU', calc: 'daily', unit: '%' }] },
  { k: 'PCE', name: 'Core PCE', sched: 'PCE', fields: [
    { k: 'core', name: 'Core PCE m/m', re: /^Core PCE Price Index m\/m/i, fred: 'PCEPILFE', calc: 'mom' }] },
  { k: 'PPI', name: 'PPI', fields: [
    { k: 'head', name: 'PPI m/m', re: /^PPI m\/m/i, fred: 'PPIFIS', calc: 'mom' }] },
  { k: 'RETAIL', name: 'Retail sales', fields: [
    { k: 'head', name: 'Retail sales m/m', re: /^Retail Sales m\/m/i, fred: 'RSAFS', calc: 'mom' }] },
  { k: 'ISM', name: 'ISM manufacturing', sched: 'ISM_M', fields: [
    { k: 'pmi', name: 'ISM manufacturing PMI', re: /^ISM Manufacturing PMI/i, fred: null, unit: '' }] },
  { k: 'GDP', name: 'GDP', fields: [
    { k: 'gdp', name: 'GDP q/q (annualized)', re: /\bGDP q\/q/i, fred: 'A191RL1Q225SBEA', calc: 'quarter', unit: '%' }] },
];
export const typeOf = (title, country = 'USD') => {
  if (country && country !== 'USD') return null;
  for (const T of TYPES) for (const f of T.fields) if (f.re.test(String(title || ''))) return { T, f };
  return null;
};

function csv(text) {
  const L = String(text || '').split(/\r?\n/).filter((l) => l.trim()), h = (L.shift() || '').split(',');
  return L.map((l) => { const c = l.split(','); return Object.fromEntries(h.map((k, i) => [k, c[i] ?? ''])); });
}
export function loadInputs(dir = REF) {
  const rd = (f) => { try { return fs.readFileSync(new URL(f, dir), 'utf8'); } catch (e) { return null; } };
  let bench = null, base = null; try { bench = JSON.parse(rd('cpi-model-benchmark-inputs-2022-2024.json')); } catch (e) { bench = null; }
  try { base = JSON.parse(fs.readFileSync(new URL('./event-base.json', import.meta.url), 'utf8')); } catch (e) { base = null; }
  let hist = null; try { hist = JSON.parse(fs.readFileSync(new URL('./consensus-history.json', import.meta.url), 'utf8')); } catch (e) { hist = null; }
  let surprise = null; try { surprise = JSON.parse(fs.readFileSync(new URL('../research/edge/red-folder-surprise/result.json', import.meta.url), 'utf8')); } catch (e) { surprise = null; }
  return { panel: csv(rd('cpi-ppi-to-pce-release-panel-2022-2024.csv')), jobs: csv(rd('employment-situation-multifield-with-hours-2022-2024.csv')), bench, base, hist, surprise };
}

// FRED series → value of a reference period (monthly m/m, monthly diff / level, a quarter, a daily value)
const series = (rel, id) => ((rel && rel.series && rel.series[id]) || []).map(([d, v]) => ({ d, t: Date.parse(d + 'T00:00:00Z') / 1000, v: +v })).filter((o) => Number.isFinite(o.v));
function refMonth(t, calc) {
  const d = new Date(t * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth() - 1;
  if (calc === 'quarter') { m = Math.floor((d.getUTCMonth() - 1) / 3) * 3; }
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}
export function fredValue(S, calc, ref) {
  if (calc === 'daily') return null;
  const i = S.findIndex((o) => o.d.slice(0, 7) === ref); if (i < 0) return null;
  if (calc === 'level' || calc === 'quarter') return { v: S[i].v, prev: i > 0 ? S[i - 1].v : null };
  if (i < 1) return null;
  if (calc === 'diff') return { v: Math.round(S[i].v - S[i - 1].v), prev: i > 1 ? Math.round(S[i - 1].v - S[i - 2].v) : null };
  const mom = (a, b) => (a / b - 1) * 100;   // to one decimal, as the agencies print it
  return { v: r2(mom(S[i].v, S[i - 1].v), 1), prev: i > 1 ? r2(mom(S[i - 1].v, S[i - 2].v), 1) : null };
}
const dailyAt = (S, t) => { let v = null; for (const o of S) { if (o.t <= t) v = o.v; else break; } return v; };

// the gold / dollar reaction on the release's UTC day: close of that day vs the close before it
function dayMove(closes, t) {
  if (!closes || closes.length < 2) return null; const d = dayOf(t);
  const i = closes.findIndex((o) => o.t === d); if (i < 1) return null;
  return r2((closes[i].v / closes[i - 1].v - 1) * 100, 2);
}

export function build({ inputs, rel, captured = [], calendar = [], gold = [], dxy = [], now, since = Date.UTC(2018, 0, 1) / 1000, keep = 120 }) {
  const I = inputs || {}, rows = new Map();
  const row = (type, t, src) => { const k = `${type}|${isoD(t)}`; if (!rows.has(k)) rows.set(k, { type, t, at: new Date(t * 1000).toISOString(), f: {}, src: new Set() }); const r = rows.get(k); if (src) r.src.add(src); return r; };
  const set = (r, fk, o) => { r.f[fk] = { ...(r.f[fk] || {}), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) }; };
  // 1. release dates and intraday reactions: council/event-base.json (CPI / NFP / FOMC, 2018 to Oct 2026)
  for (const e of (I.base && I.base.rows) || []) if (e.t >= since) { const r = row(e.type, e.t, 'event-base'); r.react = { g5: e.g5, g60: e.g60, dx5: e.dx5, dx60: e.dx60 }; }
  // 1b. the council's own release calendar (council/events.mjs: 2022 history and the 2025-26 schedule) for the dates
  for (const e of [...(SCHED_H || []), ...(SCHED || [])]) { const T = TYPES.find((x) => x.sched === e.type); if (T && e.t >= since && e.t <= now) row(T.k, e.t, 'schedule'); }
  // 2. the batch's first prints 2022-24 (and the Cleveland model for CPI, a model, not a consensus)
  for (const b of (I.bench && I.bench.records) || []) { const t = Date.parse(b.release_date + 'T13:30:00Z') / 1000; if (!Number.isFinite(t)) continue; const r = row('CPI', t, 'batch');
    for (const [fk, mk] of [['core', 'core'], ['head', 'headline']]) { const m = b.measure && b.measure[mk]; if (!m) continue;
      set(r, fk, { actual: m.actual && m.actual.numeric, actSrc: 'first print', model: m.forecasts && m.forecasts.C ? r2(m.forecasts.C.numeric, 2) : null, prev: m.forecasts && m.forecasts.P ? m.forecasts.P.numeric : null }); } }
  for (const p of I.panel || []) {
    const pce = Date.parse(p.pce_embargo_at_utc) / 1000, ppi = Date.parse(p.ppi_scheduled_at_utc) / 1000;
    if (Number.isFinite(pce)) set(row('PCE', pce, 'batch'), 'core', { actual: num(p.pce_core_mom_original_print_percent), actSrc: 'first print' });
    if (Number.isFinite(ppi)) set(row('PPI', ppi, 'batch'), 'head', { actual: num(p.ppi_final_demand_mom_sa_percent), actSrc: 'first print' });
  }
  for (const j of I.jobs || []) { const t = Date.parse(j.scheduled_at_utc) / 1000; if (!Number.isFinite(t)) continue; const r = row('NFP', t, 'batch');
    set(r, 'pay', { actual: num(j.payroll_change_jobs_current_first_release) != null ? Math.round(num(j.payroll_change_jobs_current_first_release) / 1000) : null, actSrc: 'first print', revision: num(j.prior_two_month_revisions_sum_jobs) != null ? Math.round(num(j.prior_two_month_revisions_sum_jobs) / 1000) : null });
    set(r, 'ur', { actual: num(j.unemployment_rate_percent_current_first_release), actSrc: 'first print' });
    set(r, 'ahe', { actual: num(j.ahe_mom_percent_current_as_printed), actSrc: 'first print' }); }
  // 2b. the calendar's consensus, actual and previous 2018 to Apr 2025 (council/consensus-history.json: Forex Factory via a
  // community dataset). Its actual is the print as the calendar showed it, used where the batch has no first print.
  for (const [title, at, cons, act, prev] of (I.hist && I.hist.rows) || []) { const m = typeOf(title, 'USD'), t = Date.parse(at) / 1000; if (!m || !Number.isFinite(t) || t < since) continue;
    const r = row(m.T.k, t, 'history'), have = r.f[m.f.k] || {};
    set(r, m.f.k, { exp: cons, expV: num(cons), expSrc: cons ? HIST_SRC : null, prevCal: prev, ...(have.actual == null && num(act) != null ? { actual: num(act), actSrc: 'calendar' } : {}) }); }
  // 3. the consensus the council captured before each release (veteran-expectations, events.json, the calendar cache)
  for (const c of captured) { const m = typeOf(c.title, c.country); const t = Date.parse(c.at) / 1000; if (!m || !Number.isFinite(t) || t < since) continue;
    const r = row(m.T.k, t, 'captured'), cn = c.consensus != null && c.consensus !== ''; set(r, m.f.k, { exp: cn ? String(c.consensus) : null, expSrc: cn ? 'captured' : null, expV: num(c.consensus), expAt: c.capturedAt || null, prevCal: c.previous != null && c.previous !== '' ? String(c.previous) : null, actualCal: c.actual != null && c.actual !== '' ? String(c.actual) : null }); }
  // 4. actuals not covered by a first print: the current FRED value of the reference period (can include revisions)
  for (const r of rows.values()) {
    if (r.t > now) continue; const T = TYPES.find((x) => x.k === r.type);
    for (const f of T.fields) { if (!f.fred) continue; const S = series(rel, f.fred); if (!S.length) continue; const have = r.f[f.k] || {};
      if (f.calc === 'daily') { const a = dailyAt(S, r.t + DAY), p = dailyAt(S, r.t - DAY); if (a != null) set(r, f.k, { actual: have.actual ?? a, actSrc: have.actSrc || 'FRED', prev: have.prev ?? p }); continue; }
      const v = fredValue(S, f.calc, refMonth(r.t, f.calc)); if (!v) continue;
      set(r, f.k, { actual: have.actual ?? v.v, actSrc: have.actSrc || 'current FRED value', prev: have.prev ?? v.prev, ref: refMonth(r.t, f.calc) }); }
    if (r.f && Object.values(r.f).some((x) => x.actualCal != null && x.actual == null)) for (const x of Object.values(r.f)) if (x.actual == null && x.actualCal != null) { x.actual = num(x.actualCal); x.actSrc = 'calendar'; }
  }
  // 5. reactions, surprises, labels
  const out = {};
  for (const T of TYPES) {
    const R = [...rows.values()].filter((r) => r.type === T.k && r.t <= now).sort((a, b) => b.t - a.t).map((r) => {
      const g = dayMove(gold, r.t), d = dayMove(dxy, r.t);
      const fields = T.fields.map((f) => { const x = r.f[f.k] || {}; const surprise = x.expV != null && x.actual != null ? r2(x.actual - x.expV, 2) : null;
        const dir = x.actual != null && x.prev != null ? (x.actual > x.prev + 1e-9 ? 'up' : x.actual < x.prev - 1e-9 ? 'down' : 'same') : null;
        return { k: f.k, name: f.name, unit: f.unit || '%', exp: x.exp ?? null, expSrc: x.exp != null ? (x.expSrc || 'captured') : null, model: x.model ?? null, actual: x.actual ?? null, actSrc: x.actSrc || null, prev: x.prev ?? (x.prevCal != null ? num(x.prevCal) : null), surprise, dir, revision: x.revision ?? null }; });
      return { at: r.at, day: isoD(r.t), fields, goldDay: g, usdDay: d, react: r.react || null, src: [...r.src] };
    }).filter((r) => r.fields.some((f) => f.actual != null || f.exp != null) || r.react || r.goldDay != null);
    const main = T.fields[0].k, withG = R.filter((r) => r.goldDay != null);
    const avg = (a) => (a.length ? r2(a.reduce((s, x) => s + x, 0) / a.length, 2) : null);
    const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return r2(s[Math.floor(s.length / 2)], 2); };
    const by = (w) => withG.filter((r) => (r.fields.find((f) => f.k === main) || {}).dir === w).map((r) => r.goldDay);
    const sur = (sg) => withG.filter((r) => { const s = (r.fields.find((f) => f.k === main) || {}).surprise; return s != null && Math.sign(s) === sg; }).map((r) => r.goldDay);
    const stats = { n: withG.length, absMed: med(withG.map((r) => Math.abs(r.goldDay))), upShare: withG.length ? r2(withG.filter((r) => r.goldDay > 0).length / withG.length, 2) : null,
      rose: { n: by('up').length, gold: avg(by('up')) }, fell: { n: by('down').length, gold: avg(by('down')) },
      above: { n: sur(1).length, gold: avg(sur(1)) }, below: { n: sur(-1).length, gold: avg(sur(-1)) }, inline: sur(0).length, from: withG.length ? withG[withG.length - 1].day : null };
    // the next release of this type on the calendar (US), with its consensus and the prior value
    const nx = (calendar || []).map((e) => ({ e, m: typeOf(e.title, e.country || 'USD'), t: Date.parse(e.at) / 1000 })).filter((x) => x.m && x.m.T.k === T.k && x.t > now && x.t <= now + 35 * DAY).sort((a, b) => a.t - b.t);
    if (!nx.length && T.sched) { const sc = [...(SCHED || [])].filter((e) => e.type === T.sched && e.t > now).sort((a, b) => a.t - b.t)[0];
      if (sc) nx.push({ e: { title: sc.title }, m: { T, f: T.fields[0] }, t: sc.t, sched: true }); }
    const next = nx.length ? { at: new Date(nx[0].t * 1000).toISOString(), fromSchedule: !!nx[0].sched, items: nx.filter((x) => x.t === nx[0].t).map((x) => ({ name: x.m.f.name, title: x.e.title, exp: x.e.forecast || x.e.consensus || null, prev: x.e.previous || null })) } : null;
    const prep = [];
    if (stats.n >= 6) prep.push(`On ${stats.n} releases since ${stats.from}, gold moved a median ±${stats.absMed}% on the day and closed up ${Math.round(stats.upShare * 100)}% of the time.`);
    const sg = (x) => (x > 0 ? '+' : '') + x;
    if (stats.rose.n >= 4 && stats.fell.n >= 4) prep.push(T.rose ? `When ${T.rose}, gold averaged ${sg(stats.rose.gold)}% on the day (n ${stats.rose.n}); when ${T.fell}: ${sg(stats.fell.gold)}% (n ${stats.fell.n}).`
      : `When ${T.fields[0].name} came in higher than the release before, gold averaged ${sg(stats.rose.gold)}% on the day (n ${stats.rose.n}); lower: ${sg(stats.fell.gold)}% (n ${stats.fell.n}).`);
    if (stats.above.n + stats.below.n >= 6) prep.push(`Against the calendar consensus (${HIST_SRC} to April 2025, the council's own captures from November 2026): above it gold averaged ${stats.above.gold == null ? 'n/a' : sg(stats.above.gold)}% (n ${stats.above.n}), below it ${stats.below.gold == null ? 'n/a' : sg(stats.below.gold)}% (n ${stats.below.n}).`);
    else prep.push(stats.inline >= 6 ? `It printed in line with the calendar consensus on ${stats.inline} of ${stats.inline + stats.above.n + stats.below.n} releases on file: too few misses to compare gold's reaction.` : 'Not enough calendar consensus on file yet to compare gold\'s reaction with the surprise.');
    // the pre-registered surprise study (research/edge/red-folder-surprise): what to do with a miss in the first hour
    const SU = I.surprise; if (SU && SU.events && (T.k === 'CPI' || T.k === 'NFP')) { const ev = SU.events.filter((e) => e.type === T.k), k = ev.filter((e) => Math.sign(e.g5) === e.dir).length;
      if (ev.length >= 10) prep.push(`In the first 5 minutes gold went the way of the miss against consensus (hot = down) on ${k} of ${ev.length} releases; trading on from minute 5 to minute 60 gave no reliable gain (study ${SU.verdict}, t ${(SU.T2.byType[T.k].outOfSample || {}).t ?? 'n/a'} out of sample). Know the side before the print; do not chase after it.`); }
    if (!R.length && !next) continue;
    const mf = (r) => r.fields.find((f) => f.k === main) || {}, cnt = (fn) => R.filter((r) => fn(mf(r))).length;
    const expBasis = { histSrc: HIST_SRC, hist: cnt((f) => f.expSrc === HIST_SRC), captured: cnt((f) => f.expSrc === 'captured'), model: cnt((f) => f.exp == null && f.model != null) };
    out[T.k] = { k: T.k, name: T.name, fields: T.fields.map((f) => ({ k: f.k, name: f.name })), rows: R.slice(0, keep), stats, next, prep, expBasis };
  }
  return { v: 1, at: new Date(now * 1000).toISOString(), label: LABEL, types: TYPES.map((T) => T.k).filter((k) => out[k]), study: out,
    sources: 'Expected: the economic-calendar consensus, from ' + HIST_SRC + ' (council/consensus-history.json: Forex Factory\'s calendar 2018 to 7 Apr 2025 as collected by a third party, MIT as tagged by the uploader) and the consensus the council captured before the release from November 2026 (a calendar value, not a verified survey); nothing is on file between April 2025 and November 2026; for CPI 2022-24 the Cleveland Fed model (a model, not a consensus). Printed: the veteran batch\'s first prints 2022-24, else the calendar\'s printed value to April 2025, else the current FRED value of the reference month (it can include revisions). Gold / dollar: the UTC release-day close vs the close before (council daily closes); first 5 / 60 minutes from council/event-base.json (HistData, to Oct 2026).' };
}

// captured consensus rows from the council's files (veteran-expectations.json, events.json, the calendar cache)
export function capturedFrom({ expectations = [], events = [], cal = [] }) {
  const out = [];
  for (const r of expectations || []) out.push({ title: r.event, country: r.country || 'USD', at: r.scheduledUtc, consensus: r.expectation && r.expectation.consensus, previous: r.expectation && r.expectation.previous, capturedAt: r.expectation && r.expectation.capturedAtUtc, actual: r.firstPrint && r.firstPrint.value });
  for (const e of events || []) { const [country, title] = String(e.key || '').split('|'); out.push({ title, country, at: e.at, consensus: e.forecast, previous: e.previous, actual: e.actual }); }
  for (const e of cal || []) out.push({ title: e.title, country: e.country, at: new Date(+e.at * 1000).toISOString(), consensus: e.forecast, previous: e.previous, actual: e.actual });
  return out;
}
