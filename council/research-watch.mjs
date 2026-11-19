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
export function tableAfter(md, head) {
  const L = String(md || '').split(/\r?\n/), i = L.findIndex((l) => head.test(l) && l.trim().startsWith('|')); if (i < 0) return [];
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

export function watch({ docs, fc, S, gold, usdjpy, now }) {
  const D = docs || {}, out = { label: LABEL, items: [], used: [] }, R = D.register ? register(D.register) : [];
  const push = (k, x) => { if (x) { out.items.push({ k, ...x }); out.used.push(x.doc); } };
  try { push('gold', D.gold && goldScenarios({ md: D.gold, S, gold, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('funding', D.funding && fundingLadder({ md: D.funding, fc, S, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('japan', D.japan && japanCheck({ md: D.japan, S, usdjpy, now })); } catch (e) { out.error = String(e.message || e); }
  try { push('cot', D.positioning && positioningNote({ S })); } catch (e) { out.error = String(e.message || e); }
  out.register = R.length ? { n: R.length, doc: DOCS.register, ids: R.map((r) => r.id) } : null;
  return { watch: out, register: R };
}
