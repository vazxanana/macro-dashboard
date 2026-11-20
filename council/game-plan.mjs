// Game plan (20 Nov 2026, owner: "make it in a way I'm able to use all of our work for the next weeks to increase accuracy").
// Two things, both built only from what the desk already reads or has tested:
//  1. `planOf(days, hd)`: for each top US release of the week one card in three steps (before / at the print / after), so the
//     numbers scattered over the Week ahead (calendar consensus, Cleveland Fed nowcast, what a prediction market prices, the Red
//     folder record, the tested facts about the first minutes) are read in the order they are needed. Plus `ROUTINE`, the week's
//     fixed routine and where each step is on the site.
//  2. A source scorecard (`capture` / `resolve` / `score` / `updateFile`, council-data macro/source-record.json, append-only):
//     before each US CPI / PCE release it writes down what each source said (consensus, nowcast, priced), and after the print
//     how far each was. Over the coming weeks that says which source to lean on. Each figure is captured the FIRST time it is
//     seen before the release and never edited; the print is attached once.
// No imports but the JSON helpers; pure functions with the clock handed in. A plan and a record: no rule, size, call or trade
// reads either, a tested fact is quoted with its study and its n, and nothing here is advice or a forecast.
import { readJson, writeIfChanged } from './jsonio.mjs';

// Tested facts quoted on the cards. Constants so a bundle needs no study file; tests/game-plan.test.mjs compares each with the
// study's own result.json.
export const FACTS = {
  firstFive: { study: 'red-folder-surprise', agree: 60, n: 83, types: ['CPI', 'NFP'],
    text: 'On 60 of 83 past CPI and payrolls releases gold\'s first 5 minutes went the way of the miss (a hot number, gold down). Entering after those 5 minutes and holding to the hour FAILED its test: the move is over before a person can act. Do not chase it.' },
  spread: { study: 'gold-release-quotes', multiple: 18, n: 93, types: ['CPI', 'NFP', 'FOMC'],
    text: 'Five seconds after past releases the demo broker\'s gold spread was about 18 times its normal size (n 93): a market order in the first minute pays it, and a tight stop can be hit by the spread alone.' },
};
export const SCORED = { CPI: ['cpi', 'coreCpi'], PCE: ['pce', 'corePce'] };   // types the scorecard can resolve (the nowcast file carries their prints)
const PRICED_KEY = { CPI: ['cpi', 'coreCpi'], PCE: [null, 'corePce'] };
export const MIN_SCORE = 10;
export const LABEL = 'Source scorecard: before each US CPI / PCE release, what the calendar consensus, the Cleveland Fed nowcast and a prediction market each said, and how far each was from the first print on file. Each figure captured once before the release; append-only; a forward record, not a tested edge.';
export const ROUTINE = [
  { when: 'Sunday evening', what: 'Read the Week ahead top to bottom once: the short weeks, the days with a top US release, the two gold levels, the rules that failed (so they are not chased).', where: 'Macro desk → Week ahead; the Sunday phone digest carries its first lines' },
  { when: 'Each morning, 06:30 London', what: 'Read the morning note: what comes out today, what is expected, how big a normal day is. Decide before the open whether today is a release day or a quiet day.', where: 'The email, or Macro desk → Daily reports' },
  { when: 'The evening before a release', what: 'Open that release\'s card below: write down the numbers the sources give, and which side you take if it prints hot and if it prints cold.', where: 'Macro desk → Week ahead → Your plan for the week' },
  { when: 'At the print', what: 'Know the side at once; do not enter in the first minute (the spread) and do not chase after five (tested, failed). If you trade it, it is a planned level with a stop, on paper or demo.', where: 'The card\'s "At the print" lines' },
  { when: 'After the close', what: 'Compare the print with what each source said. The scorecard keeps the count for CPI and PCE, so in a few weeks it shows which source to trust.', where: 'Macro desk → Week ahead → Your plan for the week → scorecard' },
  { when: 'Friday', what: 'Read the forward records of the rules that passed their tests: they say whether a tested rule is still behaving as measured.', where: 'Edge lab → Forward records' },
];

const iso = (t) => new Date(t * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
const sg = (x, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d) + '%';
const r1 = (x) => Math.round(x * 10) / 10;
const num = (x) => { if (x == null) return null; const m = String(x).replace(/−/g, '-').match(/^\s*([+-]?\d+(?:\.\d+)?)\s*%?\s*$/); return m ? +m[1] : null; };
const isCore = (title) => /\bcore\b/i.test(title || '');
// A row from the council's own schedule (before the week's calendar is published) carries the bare release name: it stands
// for the release's core month-on-month figure, the one the calendar's "Core … m/m" row will carry.
const bare = (r) => r && r.src === 'schedule' && !!SCORED[r.type];
const coreOf = (r) => isCore(r.title) || bare(r);
const scorable = (r) => !!SCORED[r.type] && (monthly(r.title) || bare(r));
export const monthly = (title) => /m\/m/i.test(title || '') && /\b(CPI|PCE)\b|price index/i.test(title || '') && !/income|spending|y\/y|q\/q|year/i.test(title || '');

// What a prediction market's ladder puts first for this release's print: { v, p } or null (same type, closing within 36 h).
export function pricedPrint(hd, type, core, t) {
  const keys = PRICED_KEY[type]; const k = keys && keys[core ? 1 : 0]; if (!k) return null;
  const L = hd && hd.priced && hd.priced.items && hd.priced.items[k]; if (!Array.isArray(L)) return null;
  for (const x of L) { const c = Date.parse(x.close || '') / 1000; if (Number.isFinite(c) && Math.abs(c - t) <= 36 * 3600 && Array.isArray(x.likely) && x.likely[0] && Number.isFinite(x.likely[0].v)) return { v: x.likely[0].v, p: x.likely[0].p }; }
  return null;
}
// The three sources for one release row: { consensus, nowcast, priced, pricedP } (a missing one is null).
export function sourcesOf(r, hd) {
  const core = coreOf(r), ok = scorable(r);
  const pr = ok ? pricedPrint(hd, r.type, core, r.t) : null, nc = ok && r.nowcast ? (core ? r.nowcast.core : r.nowcast.head) : null;
  return { consensus: ok ? num(r.exp) : null, nowcast: Number.isFinite(nc) ? nc : null, priced: pr ? pr.v : null, pricedP: pr ? pr.p : null };
}

// One card per US release of a known type (the day's rows of one type and time share a card, core first).
export function planOf(days, hd) {
  const cards = [];
  for (const d of Array.isArray(days) ? days : []) {
    const seen = new Set();
    for (const r of (d.releases || []).slice().sort((a, b) => (isCore(b.title) ? 1 : 0) - (isCore(a.title) ? 1 : 0))) {
      if (r.country !== 'USD' || !r.type || seen.has(r.type)) continue;
      if (SCORED[r.type] && !scorable(r) && d.releases.some((x) => x.type === r.type && scorable(x))) continue;
      seen.add(r.type);
      const S = sourcesOf(r, hd), before = [], at = [], after = [];
      const have = [];
      if (S.consensus != null) have.push(`the calendar consensus is ${sg(S.consensus)}`);
      else if (r.exp) have.push(`the calendar consensus is ${r.exp}`);
      if (S.nowcast != null) have.push(`the Cleveland Fed nowcast is ${sg(S.nowcast, 2)}`);
      if (S.priced != null) have.push(`a prediction market's most likely print is ${sg(S.priced)}${S.pricedP ? ` (${Math.round(S.pricedP * 100)}%)` : ''}`);
      else if (r.priced && r.priced.short) have.push(`priced on a prediction market: ${r.priced.short}`);
      if (have.length) before.push(`What the sources say: ${have.join('; ')}.`);
      else before.push('No expectation is on file yet: the consensus appears once the week\'s calendar is published (usually over the weekend).');
      const vals = [S.consensus, S.nowcast == null ? null : r1(S.nowcast), S.priced].filter((x) => x != null);
      if (vals.length >= 2) before.push(vals.every((x) => Math.abs(x - vals[0]) < 1e-9) ? 'The sources agree on the print: the number itself is expected, so watch the details and the revisions.' : `The sources differ (${[...new Set(vals.map((x) => sg(x)))].join(' against ')}): one of them is wrong, and the print will say which. That is where a surprise can come from.`);
      if (r.record && r.record.lines && r.record.lines[1]) before.push(`${r.record.lines[1]} Decide now which side you take if it prints hot and if it prints cold.`);
      else before.push('Decide now which side you take if it prints above and if it prints below what is expected.');
      if (r.official === false) before.push('Check the date first: the agency\'s own release calendar does not list this release that day.');
      for (const f of Object.values(FACTS)) if (f.types.includes(r.type)) at.push(`${f.text} (study: ${f.study})`);
      if (!at.length) at.push('No test of the first minutes exists for this release: treat the first move as noise until a candle has closed.');
      if (r.record && r.record.lines && r.record.lines[0]) after.push(r.record.lines[0]);
      if (d.range && d.range.text) after.push(String(d.range.text).split('. ')[0].replace(/\.$/, '') + '.');
      after.push(scorable(r) ? 'Then compare the print with what each source said: the scorecard below records it by itself.' : 'Then write down the print beside what was expected: no scorecard is kept for this release yet.');
      cards.push({ day: d.day, dow: d.dow, t: r.t, type: r.type, title: `${String(r.title).replace(/\s*\(.*\)$/, '')}`, name: r.record && r.record.name ? r.record.name : r.type, sources: S, before, at, after });
    }
  }
  return { routine: ROUTINE, cards, note: 'A plan built from the desk\'s own files and tests. Not advice and not a forecast; paper and demo only.' };
}

// ---------- the source scorecard ----------
const listOf = (prev) => (Array.isArray(prev) ? prev : prev && Array.isArray(prev.records) ? prev.records : []);
export const idOf = (r) => `${r.type}:${r.nowcast.month}:${coreOf(r) ? 'core' : 'headline'}`;
const FIELDS = ['consensus', 'nowcast', 'priced'];
// One record per m/m CPI / PCE row still to come whose reference month is known. A source seen for the first time before the
// release is written with its time (`at.<source>`); a figure already written is never changed.
export function capture(prev, wa, hd, now) {
  const out = listOf(prev).slice(), at = new Map(out.map((x, i) => [x.id, i]));
  const rels = wa && Array.isArray(wa.days) ? wa.days.flatMap((d) => (d && Array.isArray(d.releases) ? d.releases : [])) : [];
  for (const r of rels) {
    if (!r || !SCORED[r.type] || !Number.isFinite(r.t) || !(r.t > now) || !scorable(r)) continue;
    if (!r.nowcast || !/^\d{4}-\d{2}$/.test(r.nowcast.month || '')) continue;
    const S = sourcesOf(r, hd), id = idOf(r);
    if (!FIELDS.some((k) => S[k] != null)) continue;
    let x = at.has(id) ? out[at.get(id)] : { id, type: r.type, core: coreOf(r), month: r.nowcast.month, title: String(r.title || '').slice(0, 80), t: r.t, at: {} };
    if (x.actual != null) continue;
    let changed = !at.has(id);
    for (const k of FIELDS) if (x[k] == null && S[k] != null) { x = { ...x, [k]: S[k], at: { ...x.at, [k]: iso(now) } }; if (k === 'priced' && S.pricedP != null) x.pricedP = S.pricedP; changed = true; }
    if (!changed) continue;
    if (at.has(id)) out[at.get(id)] = x; else { at.set(id, out.length); out.push(x); }
  }
  return out;
}
// Attach the first print once (the nowcast file's "Actual" for the month and series), with each captured source's miss.
export function resolve(records, hd, now) {
  const N = hd && hd.nowcast && Array.isArray(hd.nowcast.months) ? hd.nowcast.months : [];
  return listOf(records).map((x) => {
    if (!x || x.actual != null || !SCORED[x.type] || !(now >= x.t)) return x;
    const m = N.find((y) => y && y.month === x.month), a = m && m.actual ? m.actual[SCORED[x.type][x.core ? 1 : 0]] : null;
    if (a == null || !Number.isFinite(a)) return x;
    const print = r1(a), err = {}, exact = {};
    for (const k of FIELDS) if (x[k] != null) { err[k] = Math.round(Math.abs(x[k] - a) * 1000) / 1000; exact[k] = Math.abs(r1(x[k]) - print) < 1e-9; }
    const best = Object.keys(err).length >= 2 ? Object.keys(err).filter((k) => err[k] <= Math.min(...Object.values(err)) + 1e-9) : [];
    return { ...x, actual: a, print, err, exact, closest: best.length === 1 ? best[0] : best.length ? 'tie' : null, resolvedAt: iso(now) };
  });
}
const NAMES = { consensus: 'the calendar consensus', nowcast: 'the Cleveland Fed nowcast', priced: 'the prediction market' };
export function score(records) {
  const L = listOf(records), R = L.filter((x) => x.actual != null), by = {};
  for (const k of FIELDS) { const xs = R.filter((x) => x.err && x.err[k] != null); by[k] = { n: xs.length, exact: xs.filter((x) => x.exact[k]).length, meanErr: xs.length ? Math.round(xs.reduce((s, x) => s + x.err[k], 0) / xs.length * 1000) / 1000 : null, closest: R.filter((x) => x.closest === k).length }; }
  const out = { captured: L.length, resolved: R.length, open: L.length - R.length, minScore: MIN_SCORE, by,
    last: R.slice(-3).reverse().map((x) => ({ id: x.id, title: x.title, print: x.print, consensus: x.consensus ?? null, nowcast: x.nowcast ?? null, priced: x.priced ?? null, closest: x.closest })) };
  const waiting = L.filter((x) => x.actual == null).map((x) => x.title.replace(/\s*\(.*\)$/, '')).slice(0, 3);
  if (R.length < MIN_SCORE) out.text = `Source scorecard: too few to judge (${R.length} release${R.length === 1 ? '' : 's'} scored, ${MIN_SCORE} needed)${waiting.length ? `; written down and waiting for the print: ${waiting.join(', ')}` : ''}. A forward record, not a tested edge.`;
  else {
    const ks = FIELDS.filter((k) => by[k].n >= MIN_SCORE).sort((a, b) => by[a].meanErr - by[b].meanErr);
    out.text = ks.length ? `Source scorecard over ${R.length} releases: ${ks.map((k) => `${NAMES[k]} missed by ${by[k].meanErr.toFixed(2)} points on average and had the exact print ${by[k].exact} of ${by[k].n} times`).join('; ')}. A forward record, not a tested edge.`
      : `Source scorecard: ${R.length} releases scored, but no single source has ${MIN_SCORE} yet. A forward record, not a tested edge.`;
  }
  return out;
}
// The file step: resolve, capture, write only on a change; a file that does not parse is never overwritten.
export function updateFile(file, wa, hd, now) {
  const f = readJson(file, null);
  if (f.state === 'corrupt') return { error: `the file does not parse (${f.error}); left as it is, nothing recorded` };
  if (f.state === 'ok' && !Array.isArray(f.value) && !(f.value && Array.isArray(f.value.records))) return { error: 'the file has no records list; left as it is, nothing recorded' };
  const records = capture(resolve(f.value, hd, now), wa, hd, now);
  const written = (f.state === 'ok' || records.length > 0) && writeIfChanged(file, JSON.stringify({ v: 1, label: LABEL, records }, null, 1));
  return { score: score(records), records, written };
}
