// Council · The veteran's event playbook (9 Nov 2026, owner: "be the best of all times veteran", "keep improving all the bits").
//
// For each red-folder release on the strategist's calendar within WINDOW_H hours (macro/forecast.json `playbook`), one
// card: the expectations (the calendar consensus the veteran captured before the release, the forecast cluster where the
// repository has one, n/a where it has none: never an invented number), a hot / in-line / cool table (Fed path, USD, gold,
// the action: act after the release, not before; a quarter-size starter per the skill's rule G), what happened on past
// releases of the same type (council/event-base.json, built by research/edge/event-reaction/build.mjs from HistData M1;
// the release-day move from the council's daily closes), and one dated, scored call: P(gold's release-day UTC close is
// above the prior close), recorded once in macro/veteran-calls.json with its base rate so calibration.mjs scores it.
// Deterministic, no fetches. Every statistic is cut at `now` (no look-ahead). Descriptive, not a tested edge, unless the
// one pre-registered test (research/edge/event-reaction/preregistration.md) passed. Paper only: no rule, size or trade.
const DAY = 86400;
export const WINDOW_H = 72;          // the skill's 72-hour event rule
export const KEEP_H = 12;            // a released event stays on the card this long (its call waits for the close)
export const READ_PCT = 0.05;        // the dollar index's first 5 minutes: ≥ +0.05% hot read, ≤ −0.05% cool read (pre-registered)
export const SHRINK = 20;            // pseudo-days pulling the release-day frequency toward all weekdays
export const P_BAND = [0.3, 0.7];    // a one-day call never leaves this band
export const CALL_SRC = 'event playbook';
export const DESCRIPTIVE = 'Descriptive, not a tested edge.';
const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r = (v, d = 2) => (v == null || !Number.isFinite(+v) ? null : +(+v).toFixed(d));

export function median(a) { const s = (a || []).filter(Number.isFinite).slice().sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
// the dollar's first read of a print
export const readOf = (dx5) => (!Number.isFinite(dx5) ? null : dx5 >= READ_PCT ? 'hot' : dx5 <= -READ_PCT ? 'cool' : 'inline');
// P(X ≥ k) for X ~ Binomial(n, 1/2)
export function binomUpper(k, n) { if (!n) return null; let pmf = Math.pow(0.5, n), s = 0; for (let i = 0; i <= n; i++) { if (i >= k) s += pmf; pmf = pmf * (n - i) / (i + 1); } return Math.min(1, s); }
// the pre-registered test: gold T+5→T+60 against the dollar's first read (|dx5| ≥ READ_PCT); hit = the opposite sign
export function testRows(rows) {
  const R = (rows || []).filter((x) => Number.isFinite(x.dx5) && Math.abs(x.dx5) >= READ_PCT && Number.isFinite(x.g5to60));
  const hitOf = (x) => Math.sign(x.g5to60) === -Math.sign(x.dx5) && x.g5to60 !== 0;
  const cnt = (S) => { const h = S.filter(hitOf).length; return { n: S.length, hits: h, hit: S.length ? r(h / S.length) : null }; };
  const all = cnt(R), a = cnt(R.filter((x) => x.d < '2022-01-01')), b = cnt(R.filter((x) => x.d >= '2022-01-01')), p = all.n ? r(binomUpper(all.hits, all.n), 4) : null;
  return { ...all, p, halves: { a, b }, pass: !!(all.n >= 30 && all.hit >= 0.6 && p < 0.05 && a.n && a.hit > 0.5 && b.n && b.hit > 0.5) };
}
// which release history a calendar title belongs to (only these have rows in event-base.json)
export function typeOf(title, country = 'USD') {
  const s = String(title || ''); if (country && country !== 'USD') return null;
  if (/\bCPI\b/i.test(s)) return 'CPI';
  if (/non-?farm|\bNFP\b|employment change/i.test(s)) return 'NFP';
  if (/\bFOMC\b|federal funds rate/i.test(s)) return 'FOMC';
  return null;
}
const BANK = { USD: 'Fed', EUR: 'ECB', GBP: 'BoE', JPY: 'BoJ', AUD: 'RBA', NZD: 'RBNZ', CAD: 'BoC', CHF: 'SNB', CNY: 'PBoC' };
// "hot if ≥ 0.3%, cool if ≤ 0.1%" → { hot: '≥ 0.3%', cool: '≤ 0.1%' }
export function ruleOf(rule) { const s = String(rule || ''), h = /hot if ([≥>]=?\s*[^,;]+)/.exec(s), c = /cool if ([≤<]=?\s*[^,;]+)/.exec(s);
  return { hot: h ? h[1].trim() : 'above consensus', cool: c ? c[1].trim() : 'below consensus' }; }

// the same rule as numbers for the desk's expectation scale: { cool: 0.1, hot: 0.3 } (null when the rule has none)
export function bandsOf(rule) { const R = ruleOf(rule), n = (x) => { const m = /(-?\d+(?:\.\d+)?)/.exec(x); return m ? +m[1] : null; };
  return { cool: /^[≤<]/.test(R.cool) ? n(R.cool) : null, hot: /^[≥>]/.test(R.hot) ? n(R.hot) : null }; }
// Releases on the calendar from now − KEEP_H to now + WINDOW_H, grouped by time and country (Core CPI and CPI are one event)
export function upcoming(playbook, now, { hours = WINDOW_H, keep = KEEP_H } = {}) {
  const G = new Map();
  for (const e of playbook || []) { const t = Date.parse(e.at) / 1000; if (!Number.isFinite(t) || !e.title || t > now + hours * 3600 || t <= now - keep * 3600) continue;
    const key = `${String(e.at).slice(0, 16)}|${e.country || ''}`; const g = G.get(key) || { key, at: new Date(t * 1000).toISOString(), t, country: e.country || null, items: [] }; g.items.push(e); G.set(key, g); }
  return [...G.values()].map((g) => { g.items.sort((a, b) => (/core/i.test(b.title) ? 1 : 0) - (/core/i.test(a.title) ? 1 : 0));
    const p = g.items[0]; return { ...g, title: p.title, type: g.items.map((x) => typeOf(x.title, g.country)).find(Boolean) || null, released: g.t <= now }; }).sort((a, b) => a.t - b.t);
}

// Gold's release-day move: the UTC daily close of `date` vs the close before it (the same series the call resolves on)
export function dayMove(closes, date) { const i = (closes || []).findIndex((o) => isoDay(o.t) === date); if (i < 1) return null; return (closes[i].v / closes[i - 1].v - 1) * 100; }
// every weekday's up-rate over `years` before today (the call's base rate); today's unfinished candle is excluded
export function dayBase(closes, now, years = 10) {
  const today = isoDay(now), S = (closes || []).filter((o) => o.t >= now - years * 365 * DAY && isoDay(o.t) < today); let n = 0, up = 0;
  for (let i = 1; i < S.length; i++) { const w = new Date(S[i].t * 1000).getUTCDay(); if (w === 0 || w === 6) continue; n++; if (S[i].v > S[i - 1].v) up++; }
  return n >= 250 ? { n, up: r(up / n, 3), from: isoDay(S[0].t), to: isoDay(S.at(-1).t) } : null;
}
// n, median, share up and the points ([release date, %]) of one cell; non-numbers are left out
const cellOf = (pairs) => { const P = pairs.filter((x) => Number.isFinite(x[1])), v = P.map((x) => x[1]);
  return { n: v.length, median: r(median(v), 3), up: v.length ? r(v.filter((x) => x > 0).length / v.length) : null, pts: P.map((x) => [x[0], r(x[1], 3)]) }; };
// What happened on past releases of this type, as of `now`: rows before now only, release days whose close is final only
export function reaction(base, type, closes, now) {
  if (!base || !type) return null;
  const today = isoDay(now), rows = (base.rows || []).filter((x) => x.type === type && x.t < now);
  if (!rows.length) return null;
  const day = new Map(rows.filter((x) => x.d < today).map((x) => [x.d, dayMove(closes, x.d)]));
  const val = (x, k) => [x.d, k === 'day' ? day.get(x.d) : x[k]];
  const by = (k) => Object.fromEntries(['hot', 'inline', 'cool'].map((b) => [b, cellOf(rows.filter((x) => readOf(x.dx5) === b).map((x) => val(x, k)))]));
  const nc = rows.filter((x) => x.nowcast), ncBy = Object.fromEntries([['hot', (d) => d >= 0.05], ['inline', (d) => d > -0.05 && d < 0.05], ['cool', (d) => d <= -0.05]].map(([b, f]) => [b, cellOf(nc.filter((x) => f(x.nowcast.diff)).map((x) => val(x, 'g60')))]));
  const dayAll = cellOf(rows.map((x) => val(x, 'day'))), test = base.test && base.test[type] ? base.test[type] : null, tested = !!(type === 'CPI' && test && test.pass);
  return { type, n: rows.length, from: rows[0].d, to: rows.at(-1).d,
    firstHour: { all: cellOf(rows.map((x) => val(x, 'g60'))), ...by('g60') }, after5: { all: cellOf(rows.map((x) => val(x, 'g5to60'))), ...by('g5to60') },
    day: { all: dayAll, ...by('day'), absMedian: r(median(dayAll.pts.map((x) => Math.abs(x[1]))), 3) },
    nowcast: nc.length ? { n: nc.length, from: nc[0].d, to: nc.at(-1).d, ...ncBy, note: 'CPI 2022-24: core first print minus the Cleveland Fed core nowcast of the day before (a model benchmark, not survey consensus)' } : null,
    test: test ? { n: test.n, hits: test.hits, hit: test.hit, p: test.p, pass: !!test.pass, halves: test.halves, primary: type === 'CPI' } : null,
    tested, label: tested ? 'The T+5→T+60 continuation passed its pre-registered test; the other figures stay descriptive.' : DESCRIPTIVE,
    readNote: `"Hot read" = the dollar index rose ≥ ${READ_PCT}% in the first 5 minutes (the market's own first read of the surprise, not a consensus surprise); "cool read" = fell ≥ ${READ_PCT}%.` };
}

// The hot / in-line / cool table. Directions follow the skill's inflation-fighting reading (hot CPI → currency up, gold
// down) and the strategist's playbook scenarios; each row carries what history says for that read when there is one.
const fmtPct = (x) => (x == null ? 'n/a' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}%`);
const hist = (c) => (c && c.n ? `n ${c.n}: gold's first hour median ${fmtPct(c.median)}, up ${Math.round(c.up * 100)}%` : 'no past release in this read');
export function scenarios(g, stats) {
  const p = g.items[0], R = ruleOf(p.rule), cb = BANK[g.country] || 'the central bank', usd = g.country === 'USD', cur = g.country || 'the currency';
  const sc = Object.fromEntries((p.scenarios || []).map((s) => [s.name === 'in line' ? 'inline' : s.name, s]));
  const goldMove = (k, dflt) => (sc[k] && sc[k].moves && sc[k].moves.gold) || dflt;
  const fh = stats && stats.firstHour;
  const path = { CPI: ['Fewer or later cuts priced (hike odds up); 2Y and real yields up', 'Path unchanged; the 3-month trend decides', 'More or earlier cuts priced; 2Y and real yields down'],
    NFP: ['Labour strong: cuts priced out; 2Y up', 'Path unchanged; score the unemployment change, not the headline', 'Labour soft: cuts priced in; 2Y down'],
    FOMC: ['Hawkish guidance (statement bias, vote split, dots): 2Y up', 'As priced: the press conference decides', 'Dovish guidance: 2Y down'] }[g.type] ||
    [`${cb}: hawkish repricing`, `${cb}: path unchanged`, `${cb}: dovish repricing`];
  const act = { hot: `Act after the release, not before. After the first hour, only a retest of a level marked before the release, in the reaction's direction, at ¼ starter size. A gold short is never a macro call: it needs this hawkish surprise and a bearish reaction (rule G); if gold closes up anyway, cancel any sell bias.`,
    inline: 'No event trade. Volatility runs about an hour even on an in-line print; after it, the desks\' own setups decide.',
    cool: 'Act after the release, not before. After the first hour, only a retest of a level marked before the release, in the reaction\'s direction, at ¼ starter size; full size only once price confirms (rule G).' };
  return [
    { k: 'hot', name: 'Hot', when: R.hot, path: path[0], usd: usd ? 'USD up' : `${cur} up`, gold: usd ? 'Down first, through real yields' : `Little direct effect (strategist: ${goldMove('hot', 'n/a')})`, action: act.hot, history: fh ? hist(fh.hot) : null },
    { k: 'inline', name: 'In line', when: /^[≤<]/.test(R.cool) && /^[≥>]/.test(R.hot) ? `> ${R.cool.replace(/[≤<]=?\s*/, '')} and < ${R.hot.replace(/[≥>]=?\s*/, '')}` : 'near consensus', path: path[1], usd: 'Little; the trend resumes', gold: 'Little; the prevailing trend resumes', action: act.inline, history: fh ? hist(fh.inline) : null },
    { k: 'cool', name: 'Cool', when: R.cool, path: path[2], usd: usd ? 'USD down' : `${cur} down`, gold: usd ? 'Up, through real yields' : `Little direct effect (strategist: ${goldMove('cool', 'n/a')})`, action: act.cool, history: fh ? hist(fh.cool) : null },
  ];
}

// The expectations: the consensus captured before the release (else the calendar's), the forecast cluster where the
// repository has one (the batch's pre-registered CPI pilot and its Cleveland nowcast comparator), n/a otherwise.
export function expectationsOf(g, expHist, pilot) {
  const by = new Map((expHist || []).map((x) => [x.key, x]));
  return g.items.map((e) => {
    const rec = by.get(`${String(e.at).slice(0, 16)}|${String(e.title).trim()}`), ex = rec && rec.expectation;
    const out = { title: e.title, consensus: (ex && ex.consensus) ?? e.consensus ?? null, previous: (ex && ex.previous) ?? e.previous ?? null,
      captured: ex && ex.capturedAtUtc ? ex.capturedAtUtc : null, source: ex ? 'captured before the release from the strategist\'s calendar (not a verified survey)' : e.consensus != null ? 'calendar consensus, not yet captured' : null,
      range: null, rangeNote: 'n/a: the calendar publishes no forecast range', actual: e.actual ?? (rec && rec.firstPrint ? rec.firstPrint.value : null), cluster: [] };
    if (pilot && Date.parse(pilot.releaseUtc) === Date.parse(e.at) && /core/i.test(e.title) && /\bCPI\b/i.test(e.title)) {
      if (Number.isFinite(pilot.point)) out.cluster.push({ label: `Veteran batch pilot forecast (issued ${String(pilot.issuedAt || '').slice(0, 16).replace('T', ' ')} UTC; ${pilot.status})`, value: pilot.point });
      if (pilot.comparator && Number.isFinite(pilot.comparator.value)) out.cluster.push({ label: `Cleveland Fed core nowcast (a model, captured ${String(pilot.comparator.capturedAt || '').slice(0, 10)})`, value: pilot.comparator.value });
      const c = /(-?\d+(?:\.\d+)?)/.exec(String(out.consensus || '')); if (c) out.cluster.unshift({ label: 'Calendar consensus', value: +c[1] });
    }
    return out;
  });
}

// The dated call: P(gold's release-day UTC close is above the prior close). Base rate = every weekday over 10 years; the
// call = the same-type release days' frequency shrunk toward it. Issued only before the release; one per release day.
export function eventCall(g, { closes, now, stats }) {
  if (!g || g.released || g.t <= now || !g.type) return null;
  const b = dayBase(closes, now); if (!b) return null;
  const d = stats && stats.day && stats.day.all, n = d ? d.n : 0, k = n ? Math.round(d.up * n) : 0;
  const raw = n ? (k + SHRINK * b.up) / (n + SHRINK) : b.up, p = +Math.min(P_BAND[1], Math.max(P_BAND[0], raw)).toFixed(2), date = isoDay(g.t);
  return { id: `evt:${date}:gold:dayUp`, claim: `Gold's ${date} close (UTC day of ${g.country} ${g.title}) is above the previous close`, p, baseP: b.up, asset: 'gold', kind: 'dayUp', by: date, src: CALL_SRC,
    level: null, event: g.key, why: `${n ? `Gold rose on ${k} of ${n} past ${g.type} release days` : `No past ${g.type} release day in the record`}; every weekday over 10 years: ${Math.round(b.up * 100)}% (n ${b.n}). The release-day rate is shrunk toward it by ${SHRINK} pseudo-days.` };
}

// All cards for veteran.json.events
export function playbooks({ fc, expectations, closes, base, now, pilot = null }) {
  const out = [], days = new Set();
  for (const g of upcoming(fc && fc.playbook, now)) {
    const stats = reaction(base, g.type, closes, now);
    let call = eventCall(g, { closes, now, stats }); const d = isoDay(g.t);
    if (call && days.has(d)) call = null; if (call) days.add(d);
    out.push({ key: g.key, title: g.title, country: g.country, at: g.at, type: g.type, released: g.released, titles: g.items.map((x) => x.title),
      expMovePct: (g.items[0].expMovePct && g.items[0].expMovePct.gold) ?? null, note: g.items[0].note || null, bands: bandsOf(g.items[0].rule),
      expectations: expectationsOf(g, expectations, pilot), scenarios: scenarios(g, stats), stats, call,
      callNote: call ? null : g.released ? 'Released: no new call after the release.' : !g.type ? 'No release history for this event in the repository: no call.' : days.has(d) ? 'One call per release day: it is on the earlier card.' : 'Not enough gold history for a call.',
      label: stats ? stats.label : DESCRIPTIVE, publicOnly: true, paperOnly: true });
  }
  return out;
}
// one line for the brief and analysis/latest.md
export function playbookLine(ev) {
  if (!ev) return '';
  const e = ev.expectations[0] || {}, c = ev.call, s = ev.stats;
  return `${ev.country} ${ev.title} ${ev.at.slice(0, 16).replace('T', ' ')} UTC: consensus ${e.consensus ?? 'n/a'} (previous ${e.previous ?? 'n/a'})${c ? `; P(gold up on the day) ${Math.round(c.p * 100)}% vs base ${Math.round(c.baseP * 100)}%` : ''}${s ? `; past ${s.type} days n ${s.day.all.n}, gold up ${s.day.all.up == null ? 'n/a' : Math.round(s.day.all.up * 100) + '%'}, median |move| ${s.day.absMedian ?? 'n/a'}%` : ''}. Act after the release, not before (¼ starter). ${ev.label}`;
}
