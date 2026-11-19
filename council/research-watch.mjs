// The owner's macro research put to work (19 Nov 2026, owner: "all this stuff I've sent you about macro and fundamentals,
// you are not using it"). The veteran batch (research/macro-veteran/references/) holds briefs, research maps and a news
// hypothesis register; until now only the release ledgers fed a council member. This module reads four of the documents and
// checks their OWN stated conditions against the data the council already has (the strategist's forecast and cache, the
// council's daily closes). Pure apart from loadDocs(); fetches nothing.
// Rules (the batch's own): a check of a brief's conditions is not a forecast and not a tested edge; a register hypothesis is
// a test specification, never a validated strategy; a funding-stress claim follows the research map's evidence ladder; a
// positioning note says what COT is (a lagged listed-futures snapshot). Nothing here is a rule, a size or a trade.
import fs from 'node:fs';

const REF = new URL('../research/macro-veteran/references/', import.meta.url);
export const DOCS = {
  register: 'news-trading-strategy-register-v2-2026-11-19.md',
  gold: 'gold-market-brief-2026-11-07.md',
  japan: 'japan-boj-normalization-brief-2026-11-07.md',
  funding: 'funding-collateral-and-sovereign-supply-research-map.md',
  positioning: 'derivatives-positioning-and-flow-research.md',
  cpiPlan: 'us-october-2026-cpi-pre-release-plan.md',
  nyfed: 'nyfed-survey-source-contract-2026-11-09.json',
  chinaHousing: 'china-housing-developer-funding-2026-09.md',
  chinaFiscal: 'china-local-fiscal-pulse-2026-09.md',
  cpiBench: 'cpi-model-benchmark-2022-2024.md',
  gates: 'news-expectation-source-and-timing-gates-2026-11-19.md',
  gdp: 'gdp-revision-and-composition-case-2023-q3.md',
};
export const LABEL = 'Your research, applied: each line checks a document\'s own conditions against today\'s data. Not a forecast, not a tested edge.';
const DAY = 86400;
const strip = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const ord = (n) => { const v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
const sg = (x, d = 2) => (x == null || !Number.isFinite(x) ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));

export function loadDocs(dir = REF) {
  const out = {};
  for (const [k, f] of Object.entries(DOCS)) { try { out[k] = fs.readFileSync(new URL(f, dir), 'utf8'); } catch (e) { out[k] = null; } }
  return out;
}

// markdown table rows under the first header line that matches `head`
export function tableAfter(md, head, nth = 0) {
  const L = String(md || '').split(/\r?\n/), hits = L.map((l, k) => (head.test(l) && l.trim().startsWith('|') ? k : -1)).filter((k) => k >= 0), i = hits[nth] ?? -1; if (i < 0) return [];
  const rows = []; for (let j = i + 2; j < L.length && L[j].trim().startsWith('|'); j++) rows.push(L[j].trim().replace(/^\||\|$/g, '').split('|').map((c) => strip(c)));
  return rows;
}

// the news-trading register (N1..N10): id, priority, setup, the rule to test and its failure gate
export function register(md) {
  return tableAfter(md, /ID \/ priority/i).map((c) => {
    const m = /^(N\d+)\s*\/\s*([\w ]+)/.exec(c[0] || ''); if (!m) return null;
    const title = (/^([^.]+\.)/.exec(c[1] || '') || [null, c[1] || ''])[1].replace(/\.$/, '');
    return { id: m[1], priority: m[2].trim(), title, setup: c[1] || '', rule: c[2] || '', gate: c[3] || '' };
  }).filter(Boolean);
}

// which register hypotheses a calendar release belongs to (wider than news-context's kinds; US releases only)
export function hypIds(title, country = 'USD') {
  const s = String(title || ''); if (country && country !== 'USD') return [];
  if (/speaks|testifies|minutes/i.test(s)) return [];
  if (/\bPCE\b/i.test(s)) return ['N6'];
  if (/\bPPI\b/i.test(s)) return ['N6'];
  if (/\bCPI\b/i.test(s)) return ['N1', 'N4'];
  if (/non-?farm|\bNFP\b|employment change|unemployment rate|average hourly/i.test(s)) return ['N2', 'N4'];
  if (/federal funds rate|FOMC statement|FOMC press conference|FOMC economic projections/i.test(s)) return ['N3'];
  if (/unemployment claims|jobless claims|JOLTS|job openings|employment cost/i.test(s)) return ['N5'];
  if (/retail sales/i.test(s)) return ['N7'];
  if (/bond auction|note auction|treasury auction|\d+-y(ea)?r? (bond|note)/i.test(s)) return ['N8'];
  if (/\bISM\b/i.test(s)) return ['N9'];
  if (/crude oil inventories|\bEIA\b|petroleum/i.test(s)) return ['N10'];
  return [];
}

// what the register says to test on this release (shown beside the event card)
export function hypothesesFor(card, R) {
  if (!card || !R || !R.length) return null;
  const ids = [...new Set([card.title, ...(card.titles || [])].flatMap((t) => hypIds(t, card.country || 'USD')))];
  const H = ids.map((id) => R.find((r) => r.id === id)).filter(Boolean); if (!H.length) return null;
  return { items: H.map((h) => ({ id: h.id, priority: h.priority, title: h.title, rule: h.rule, gate: h.gate })),
    status: 'Test specifications from your news-trading register (V2, 19 Nov 2026): none is validated, none places an order. The register\'s first step is a timestamped consensus and a demo quote log for this release.' };
}

const last = (rows, now) => { const r = (rows || []).filter((o) => o.t <= now); return r[r.length - 1] || null; };
const ago = (rows, now, days) => { const r = (rows || []).filter((o) => o.t <= now - days * DAY); return r[r.length - 1] || null; };
const chg = (rows, now, days) => { const a = last(rows, now), b = ago(rows, now, days); return a && b ? a.v - b.v : null; };
const lchg = (rows, now, days) => { const a = last(rows, now), b = ago(rows, now, days); return a && b && b.v > 0 ? (a.v / b.v - 1) * 100 : null; };

// 7 Nov gold brief: its three scenarios and the conditions it names, checked on today's data
export function goldScenarios({ md, S, gold, now }) {
  const sc = tableAfter(md, /^\|\s*Scenario\s*\|/i); if (sc.length < 3) return null;
  const ry = chg(S.DFII10, now, 28), usd = lchg(S.dxy && S.dxy.length ? S.dxy : S.DTWEXBGS, now, 28);
  // "the late-October area": the brief's own window (its October low before the November rebound), from the council's closes
  const oct = (gold || []).filter((o) => o.t >= Date.UTC(2026, 9, 20) / 1000 && o.t < Date.UTC(2026, 10, 1) / 1000);
  const low = oct.length ? Math.min(...oct.map((o) => o.v)) : null, px = last(gold, now), cot = S.cot;
  const C = [];
  const add = (k, ok, text) => C.push({ k, ok, text });
  if (ry != null) { add('ry', ry < -0.05 ? 'recovery' : ry > 0.05 ? 'correction' : 'range', `10-year real yield ${sg(ry * 100, 0)} bp over 4 weeks (now ${last(S.DFII10, now).v.toFixed(2)}%)`); }
  if (usd != null) { add('usd', usd < -0.5 ? 'recovery' : usd > 0.5 ? 'correction' : 'range', `dollar ${sg(usd, 1)}% over 4 weeks`); }
  if (low != null && px) { add('px', px.v > low ? 'recovery' : 'correction', `gold ${px.v.toFixed(0)} against the late-October low ${low.toFixed(0)} (${px.v > low ? 'holding above it' : 'below it'})`); }
  if (cot) { add('cot', cot.chg4w < 0 ? 'correction' : cot.pct >= 90 ? 'range' : 'recovery', `managed money ${cot.chg4w < 0 ? 'cut' : 'added'} ${Math.abs(Math.round(cot.chg4w)).toLocaleString('en-US')} contracts in 4 weeks (net at the ${ord(cot.pct)} percentile of its last 60 weeks, as of ${cot.asOf})`); }
  if (!C.length) return null;
  // the brief's "correction" asks real yields AND the dollar to rise together; one alone is a mixed read
  const together = C.find((c) => c.k === 'ry')?.ok === 'correction' && C.find((c) => c.k === 'usd')?.ok === 'correction';
  const n = (w) => C.filter((c) => c.ok === w).length;
  let lean = n('recovery') > n('correction') ? 'recovery' : n('correction') > n('recovery') ? 'correction' : 'range';
  if (lean === 'correction' && !together && n('correction') - n('recovery') < 2) lean = 'range';
  const name = { recovery: sc[0][0], correction: sc[1][0], range: sc[2][0] };
  return { doc: DOCS.gold, asOf: '2026-11-07', lean, scenario: name[lean], checks: C, together,
    text: `Your 7 Nov gold brief's conditions now point to "${name[lean]}": ${n('recovery')} of ${C.length} for a recovery, ${n('correction')} for a correction${together ? ', with real yields and the dollar rising together as it asks' : ''}.`,
    strengthen: sc.find((r) => r[0] === name[lean])?.[1] || '', weaken: sc.find((r) => r[0] === name[lean])?.[2] || '' };
}

// 7 Nov Japan brief: is the yen following global yields or the BoJ? (its third scenario, read from the data it names)
export function japanCheck({ md, S, usdjpy, now }) {
  const sc = tableAfter(md, /^\|\s*Scenario\s*\|/i); if (!sc.length) return null;
  const us10 = chg(S.DGS10, now, 28), yen = lchg(usdjpy, now, 28); if (us10 == null || yen == null) return null;
  const glob = sc.find((r) => /global yields/i.test(r[0])), big = Math.abs(us10) >= 0.10, same = Math.sign(us10) === Math.sign(yen) && Math.abs(yen) >= 0.5;
  const dominates = big && same;
  return { doc: DOCS.japan, asOf: '2026-11-07', scenario: glob ? glob[0] : 'Global yields dominate local signal', dominates,
    text: dominates
      ? `US 10-year yields moved ${sg(us10 * 100, 0)} bp in 4 weeks and USD/JPY ${sg(yen, 1)}% the same way: on your Japan brief's terms, global yields are driving the yen more than the BoJ's normalization.`
      : `US 10-year ${sg(us10 * 100, 0)} bp and USD/JPY ${sg(yen, 1)}% over 4 weeks: no clear sign that global yields are overriding the BoJ signal (your Japan brief's third scenario is not confirmed).`,
    watch: 'Your brief\'s next checkpoints: BoJ meetings, the monthly JGB purchase schedule and operation results, MOF benchmark yields.' };
}

// the funding research map's evidence ladder, applied to the strategist's funding gauges
export function fundingLadder({ md, fc, S, now }) {
  const ladder = tableAfter(md, /^\|\s*Level\s*\|/i); if (ladder.length < 3) return null;
  const R = (fc && fc.regime) || {}, hy = chg(S.BAMLH0A0HYM2, now, 20), M = [];
  const add = (market, k, on, text) => M.push({ market, k, on, text });
  if (Number.isFinite(R.sofrEffrBps)) add('funding', 'sofr', R.sofrEffrBps >= 10, `SOFR minus fed funds ${R.sofrEffrBps} bp${R.sofrEffrBps >= 10 ? ' (repo trading rich to policy)' : ' (normal)'}`);
  if (Number.isFinite(R.broadUsd20dPct)) add('fx', 'usd', R.broadUsd20dPct >= 2, `broad dollar ${sg(R.broadUsd20dPct, 1)}% in 20 days`);
  if (hy != null) add('credit', 'hy', hy >= 0.5, `high-yield spread ${sg(hy * 100, 0)} bp in 20 days`);
  if (Number.isFinite(R.vixTermRatio)) add('volatility', 'vix', R.vixTermRatio > 1, `VIX curve ${R.vixTermRatio > 1 ? 'inverted' : 'normal'} (${R.vixTermRatio.toFixed(2)})`);
  if (!M.length) return null;
  const on = M.filter((m) => m.on), mk = new Set(on.map((m) => m.market)), fund = on.some((m) => m.market === 'funding');
  const level = !on.length ? 0 : mk.size >= 3 && fund ? 3 : mk.size >= 2 ? 2 : 1;
  const lang = level ? ladder[Math.min(level, ladder.length) - 1][2] : 'No funding-related indicator is flagged.';
  const smile = R.smile === 'left';
  return { doc: DOCS.funding, level, flagged: on.length, of: M.length, readings: M,
    text: `Funding stress, on your research map's evidence ladder: level ${level} of 4. ${lang}`,
    caution: smile && level < 3 ? `The strategist's regime label reads "Dollar Smile left side (stress)"; the ladder asks for cross-market confirmation with a funding market before calling it a funding squeeze (${level < 1 ? 'nothing' : on.map((m) => m.k).join(', ')} flagged, repo ${fund ? 'confirms' : 'does not'}).` : null };
}

// the positioning research map's "strong weekly note", written from the council's COT reading
export function positioningNote({ S }) {
  const c = S && S.cot; if (!c) return null;
  return { doc: DOCS.positioning,
    text: `As of ${c.asOf}, gold managed-money net length was ${Math.round(c.net).toLocaleString('en-US')} contracts, at the ${ord(c.pct)} percentile of its last 60 weeks; it ${c.chg4w >= 0 ? 'rose' : 'fell'} by ${Math.abs(Math.round(c.chg4w)).toLocaleString('en-US')} contracts over 4 weeks.`,
    caveat: 'A lagged listed-futures snapshot: it excludes OTC exposure and says nothing of a mandate or capacity to add (your positioning research map).' };
}

// NY Fed Survey of Market Expectations (the batch's two verified cells), set beside today's market. The panel's answers were
// collected before the September meeting and published weeks after it: an old snapshot of professional expectations, never
// a pre-release consensus and never usable as public information before that meeting (the source contract's own rule).
export function nyfedSurvey({ json, fc, S, now }) {
  let J; try { J = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return null; } if (!J || !Array.isArray(J.examples)) return null;
  const ex = (id) => J.examples.find((e) => e.example_id === id), ff = ex('expected_sep_fftr_2027'), pce = ex('own_modal_core_pce_2026'); if (!ff) return null;
  const v = +ff.normalized_value, y2 = Number.isFinite(fc && fc.regime && fc.regime.us2y) ? fc.regime.us2y : (last(S.DGS2, now) || {}).v;
  const due = Date.parse(ff.source_response_due_date + 'T18:00:00Z') / 1000, wk = Math.round((now - due) / (7 * DAY));
  const gap = Number.isFinite(y2) ? Math.round((y2 - v) * 100) : null;
  const lines = [`The NY Fed's market-participant panel (Survey of Market Expectations, ${ff.cycle}, answers due ${ff.source_response_due_date}, n ${ff.response_count}) expected the Fed's year-end-${ff.horizon_raw.replace(/\D+/g, '')} median projection at ${v.toFixed(2)}%.`];
  if (gap != null) lines.push(`The 2-year yield is ${y2.toFixed(2)}% today, ${Math.abs(gap)} bp ${gap >= 0 ? 'above' : 'below'} it: the market prices a ${gap >= 0 ? 'higher' : 'lower'} rate path than the panel expected ${wk} weeks ago.`);
  if (pce) lines.push(`The same panel's median forecast for ${pce.horizon_raw} core PCE (Q4 over Q4) was ${(+pce.normalized_value).toFixed(2)}% (n ${pce.response_count}).`);
  return { doc: DOCS.nyfed, asOf: ff.source_response_due_date, gapBp: gap, text: lines.join(' '),
    caveat: `A 2-year yield is not the same quantity as an expected year-end projection (it averages two years of policy and carries a term premium). The panel's results were published after the ${ff.cycle} meeting, so they are an old snapshot of professional expectations, not a consensus for the next release (your NY Fed ingestion note).` };
}

// the October CPI pre-release plan, generalized to every CPI card: its interpretation matrix, its response windows, and the
// confounders it names (an auction the same day, a Fed statement within two days, other US releases in the same hour)
export const CPI_WINDOWS = ['0-1 min', '0-5 min', '0-30 min', '0-55 min (before the cash equity open)', '0-120 min and the close: exploratory'];
export function cpiPlan(md, card, calendar = []) {
  if (!md || !card) return null;
  const titles = [card.title, ...(card.titles || [])]; if (!titles.some((t) => /\bCPI\b/i.test(t || '')) || (card.country && card.country !== 'USD')) return null;
  const M = tableAfter(md, /^\|\s*CPI outcome\s*\|/i).map((r) => ({ outcome: r[0], read: r[1], need: r[2] })); if (!M.length) return null;
  const t = Date.parse(card.at) / 1000, d0 = t - (t % DAY), C = [];
  const at = (e) => Date.parse(e.at) / 1000;
  for (const e of calendar) { const u = at(e); if (!Number.isFinite(u) || (e.country || 'USD') !== 'USD' || titles.includes(e.title)) continue;
    if (/auction/i.test(e.title) && u >= d0 && u < d0 + DAY) C.push(`${e.title} the same day (${new Date(u * 1000).toISOString().slice(11, 16)} UTC): label the afternoon and the close exploratory for CPI.`);
    else if (/federal funds rate|FOMC statement/i.test(e.title) && u > t && u <= t + 2 * DAY) C.push(`${e.title} within two days: keep the CPI move and the statement move apart.`);
    else if (Math.abs(u - t) <= 1800 && /PPI|retail sales|claims|empire|philly|GDP/i.test(e.title)) C.push(`${e.title} in the same half hour: the first minutes are a joint reaction.`); }
  return { doc: DOCS.cpiPlan, matrix: M, windows: CPI_WINDOWS, confounders: [...new Set(C)],
    classify: 'After the print: classify the event clean, mixed, confounded or unusable before reading any move as the CPI\'s.',
    rule: 'Surprise = first-release actual minus a frozen, comparable expectation; no expectation captured means no surprise, only a market response.' };
}

// China: the two September briefs (NBS property, MOF local fiscal), their figures read from their own tables, how old they are,
// and the next China release the strategist's calendar shows. The briefs are data notes, not market forecasts; so is this.
export function chinaBriefs({ housing, fiscal, calendar = [], now }) {
  const H = tableAfter(housing, /^\|\s*NBS measure\s*\|/i), F = tableAfter(fiscal, /^\|\s*Account \/ item\s*\|/i); if (!H.length && !F.length) return null;
  const pick = (rows, re) => { const r = rows.find((x) => re.test(x[0])); return r ? r[2] : null; };
  const inv = pick(H, /development investment/i), funds = pick(H, /developer funds/i), sales = pick(H, /contract sales area/i), resale = pick(H, /second-hand/i);
  const land = pick(F, /^Land-use-right transfer revenue/i), lfund = pick(F, /^Local government-fund budget revenue/i), lspend = pick(F, /^Local general public budget spending/i);
  const per = /\*\*Observation period:\*\*\s*([^\n]+)/.exec(housing || '') || /cumulative values|Jan–Sep/.exec(fiscal || '');
  const facts = [];
  if (inv || funds) facts.push(`property investment ${inv || 'n/a'}, developer funds ${funds || 'n/a'} (domestic loans the steepest fall)`);
  if (sales || resale) facts.push(`new-home sales area ${sales || 'n/a'} while resale area ${resale || 'n/a'}: a shift between channels, not proof of higher demand`);
  if (land || lfund) facts.push(`local land-sale revenue ${land || 'n/a'} and government-fund revenue ${lfund || 'n/a'}, local spending ${lspend || 'n/a'}`);
  if (!facts.length) return null;
  // NBS and MOF publish a month's cumulative figures about mid-month after it: count the releases that should be out since
  const end = Date.UTC(2026, 8, 30) / 1000, age = Math.max(0, Math.floor((now - end - 16 * DAY) / (30.44 * DAY)));
  const next = (calendar || []).map((e) => ({ ...e, t: Date.parse(e.at) / 1000 })).filter((e) => e.country === 'CNY' && e.t > now && e.t <= now + 14 * DAY).sort((a, b) => a.t - b.t)[0];
  return { doc: DOCS.chinaHousing, also: DOCS.chinaFiscal, asOf: '2026-09',
    text: `China, Jan-Sep 2026 (your NBS and MOF briefs, year on year): ${facts.join('; ')}. The briefs read this as a strained property-linked local revenue base, not a measure of home demand.`,
    watch: (age >= 1 ? `${age === 1 ? 'A newer release' : age + ' newer releases'} should be out by now (Jan-${['Oct', 'Nov', 'Dec', 'Jan'][Math.min(3, age - 1)]}): these September figures may be stale; refresh the brief before relying on them. ` : '') + (next ? `Next China release on the calendar: ${next.title}, ${new Date(next.t * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC.` : 'No China release on the calendar in the next two weeks.'),
    caveat: 'Cumulative nominal figures, not seasonally adjusted; a land-transfer receipt is not a home sale, and sales value divided by area is not a price (your briefs\' own limits).' };
}

// your 2022-24 CPI model benchmark (36 releases): which baseline came closest, core and headline, and this release's
// "same as last month" baseline from the calendar's previous value. Retrospective, not a forecast record.
export function cpiBenchmark(md, card) {
  const core = tableAfter(md, /^\|\s*Method\s*\|\s*MSE/i, 0), head = tableAfter(md, /^\|\s*Method\s*\|\s*MSE/i, 1); if (!core.length) return null;
  const row = (rows, re) => { const r = rows.find((x) => re.test(x[0])); return r ? { mse: +r[1], mae: +r[2] } : null; };
  const m = (rows) => ({ nowcast: row(rows, /Cleveland archived/i), persist: row(rows, /persistence$/i), blend: row(rows, /50\/50/i) });
  const C = m(core), H = head.length ? m(head) : null;
  const ex = ((card && card.expectations) || []), coreX = ex.find((x) => /core cpi m\/m/i.test(x.title || '')), headX = ex.find((x) => /^cpi m\/m/i.test(x.title || ''));
  const lines = [];
  if (C.nowcast && C.persist) lines.push(`Core CPI 2022-24 (36 releases): the Cleveland Fed nowcast did not beat "same as last month" (typical miss ${C.nowcast.mae.toFixed(3)} vs ${C.persist.mae.toFixed(3)} pp; the advantage reversed without 2022)${C.blend ? `; a fixed 50/50 blend came closest (${C.blend.mae.toFixed(3)} pp)` : ''}.`);
  if (H && H.nowcast && H.persist) lines.push(`Headline CPI: the nowcast did much better than "same as last month" (${H.nowcast.mae.toFixed(3)} vs ${H.persist.mae.toFixed(3)} pp): it uses oil and gasoline between releases.`);
  if (coreX && coreX.previous != null) lines.push(`"Same as last month" for core this time: ${coreX.previous}${coreX.consensus != null ? ` (calendar consensus ${coreX.consensus})` : ''}.`);
  if (headX && headX.previous != null) lines.push(`For headline: ${headX.previous}${headX.consensus != null ? ` (calendar consensus ${headX.consensus})` : ''}.`);
  return lines.length ? { doc: DOCS.cpiBench, lines, label: 'Your benchmark: a retrospective comparison on archived model paths, not a forecast record or a tested edge.' } : null;
}

// your expectation timing gates, applied to each card's captured consensus: a Forex Factory calendar value captured before the
// release is context; a scored surprise needs a licensed point-in-time snapshot with its fetch clock and hash
export function consensusGate(card, now) {
  if (!card) return null;
  const at = Date.parse(card.at) / 1000, ex = (card.expectations || []).filter((x) => x.consensus != null);
  const cap = ex.map((x) => Date.parse(x.captured || '') / 1000).filter(Number.isFinite), first = cap.length ? Math.min(...cap) : null;
  const before = first != null && first <= at - 300;
  const state = !ex.length ? 'missing' : before ? 'context' : 'late';
  const text = state === 'missing' ? 'No consensus on the calendar: the gate marks this consensus_missing; only a market-response reading is possible.'
    : state === 'late' ? 'The consensus was captured less than 5 minutes before the release (or after it): below your gate even as context.'
    : `Consensus captured ${Math.round((at - first) / 3600)} h before the release from the Forex Factory calendar: usable as context. It is below your gate for a scored surprise (no licensed point-in-time snapshot, fetch clock or hash).`;
  const kind = /\b(CPI|PCE)\b/i.test([card.title, ...(card.titles || [])].join(' ')) ? 'For a nowcast baseline, use the Cleveland Fed value from before 08:30 ET; its 10:00 ET update the same day is after the release.' : null;
  return { doc: DOCS.gates, state, text, nowcast: kind };
}

// your GDP worked case (2023 Q3): revisions and annualization, on any US GDP card
export function gdpCase(md, card) {
  if (!md || !card || (card.country && card.country !== 'USD')) return null;
  const t = [card.title, ...(card.titles || [])].join(' '); if (!/\bGDP\b/i.test(t) || /price index|deflator/i.test(t) && !/GDP q\/q/i.test(t)) return null;
  const R = tableAfter(md, /^\|\s*Comparison\s*\|/i), adv3 = R.find((r) => /Advance → third/i.test(r[0]));
  const x = (card.expectations || []).find((e) => /GDP q\/q/i.test(e.title || '')), cons = x && x.consensus != null ? parseFloat(String(x.consensus)) : null;
  const q = Number.isFinite(cons) ? 100 * ((1 + cons / 100) ** 0.25 - 1) : null;
  const lines = [];
  if (Number.isFinite(cons)) lines.push(`The calendar's ${cons}% is an annualized (SAAR) rate: about ${q.toFixed(2)}% quarter over quarter. Never compare it with a non-annualized figure.`);
  lines.push(adv3 ? `Read the parts, not only the headline: in your 2023 Q3 case GDP ended where the advance estimate began (${adv3[1]} pp) while consumption was revised ${adv3[2]} pp and core PCE inflation ${adv3[4]} pp.` : 'Read the parts, not only the headline: consumption, inventories and the income side can tell another story.');
  lines.push('A revision is not a surprise: compare the print with a consensus captured before it, and say which vintage you score.');
  return { doc: DOCS.gdp, lines };
}

export function watch({ docs, fc, S, gold, usdjpy, now, calendar = [] }) {
  const D = docs || {}, out = { label: LABEL, items: [], used: [] }, R = D.register ? register(D.register) : [];
  const push = (k, x) => { if (x) { out.items.push({ k, ...x }); out.used.push(x.doc); } };
  try { push('gold', D.gold && goldScenarios({ md: D.gold, S, gold, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('funding', D.funding && fundingLadder({ md: D.funding, fc, S, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('japan', D.japan && japanCheck({ md: D.japan, S, usdjpy, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('cot', D.positioning && positioningNote({ S })); } catch (e) { out.error = String(e.message || e); }
  try { push('china', (D.chinaHousing || D.chinaFiscal) && chinaBriefs({ housing: D.chinaHousing, fiscal: D.chinaFiscal, calendar, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('nyfed', D.nyfed && nyfedSurvey({ json: D.nyfed, fc, S, now })); } catch (e) { out.error = String(e.message || e); }
  out.register = R.length ? { n: R.length, doc: DOCS.register, ids: R.map((r) => r.id) } : null;
  return { watch: out, register: R };
}
