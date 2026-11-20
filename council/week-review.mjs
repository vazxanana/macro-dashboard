// council/week-review.mjs: the week in review (20 Nov 2026, owner: "Lets make an area for week review of the market").
// The counterpart of the Week ahead: what the markets the desk follows DID in the latest trading week, from files the council
// already has. Pure and deterministic: fetches nothing, no language model, no system or trade names. Built by veteran.mjs
// run() -> council-data macro/week-review.json; shown on the Macro desk ("Week in review"). Descriptive only: no rule, size,
// call or trade reads it.
//
// The week = Monday to Friday (UTC days, the council's daily closes) of the LAST close on file: "so far" until Friday's close
// is in, complete after it. A move is measured from the last close before the week (the Friday before).
const DAY = 86400;
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const dowOf = (t) => new Date(t * 1000).getUTCDay();
const r2 = (x) => Math.round(x * 100) / 100;
const pctOf = (a, b) => (a > 0 && b > 0 ? (a / b - 1) * 100 : null);
const sign = (x, d = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}%`;
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

export const MARKETS = [
  { k: 'gold', name: 'Gold', dec: 0, money: true },
  { k: 'dxy', name: 'US dollar index', dec: 2 },
  { k: 'eurusd', name: 'EUR/USD', dec: 4 },
  { k: 'usdjpy', name: 'USD/JPY', dec: 2 },
  { k: 'spx', name: 'S&P 500', dec: 0 },
  { k: 'nas', name: 'Nasdaq 100', dec: 0 },
];
export const NORMAL_WEEKS = 52, MIN_NORMAL = 12, PAST_WEEKS = 8;

// Monday 00:00 UTC of the week holding t
export const mondayOf = (t) => { const d = Math.floor(t / DAY) * DAY, w = dowOf(d); return d - ((w + 6) % 7) * DAY; };
// a row is { t, c } (bars, with h / l) or { t, v } (the council's close rows); weekend stubs and the forming day are left out
const cl = (r) => (r.c != null ? +r.c : +r.v);
const clean = (rows, now) => (rows || []).filter((r) => r && Number.isFinite(+r.t) && cl(r) > 0 && dowOf(+r.t) >= 1 && dowOf(+r.t) <= 5 && +r.t + DAY <= now)
  .map((r) => ({ t: Math.floor(+r.t / DAY) * DAY, c: cl(r), ...(Number.isFinite(+r.h) && Number.isFinite(+r.l) ? { h: +r.h, l: +r.l } : {}) })).sort((a, b) => a.t - b.t);

// closes grouped by week: [{ mon, rows, prev (the last close before the week) }]
export function weeksOf(rows) {
  const out = []; let cur = null, prev = null;
  for (const r of rows) {
    const m = mondayOf(r.t);
    if (!cur || cur.mon !== m) { cur = { mon: m, rows: [], prev }; out.push(cur); }
    cur.rows.push(r); prev = r;
  }
  return out;
}
const weekPct = (w) => (w && w.prev && w.rows.length ? pctOf(w.rows[w.rows.length - 1].c, w.prev.c) : null);

// One market's week: the move, its days, the week's high / low, how big against a normal week, the run of weeks the same way.
export function marketWeek(M, rows, mon) {
  const W = weeksOf(rows), i = W.findIndex((w) => w.mon === mon);
  if (i < 0 || !W[i].prev) return null;
  const w = W[i], last = w.rows[w.rows.length - 1], pct = r2(weekPct(w));
  const days = w.rows.map((r, j) => { const b = j ? w.rows[j - 1] : w.prev; return { day: iso(r.t), dow: DOW[dowOf(r.t)], close: r.c, pct: r2(pctOf(r.c, b.c)) }; });
  const hi = w.rows.some((r) => r.h != null) ? Math.max(...w.rows.map((r) => (r.h != null ? r.h : r.c))) : Math.max(...w.rows.map((r) => r.c));
  const lo = w.rows.some((r) => r.l != null) ? Math.min(...w.rows.map((r) => (r.l != null ? r.l : r.c))) : Math.min(...w.rows.map((r) => r.c));
  // a normal week: the median absolute move of the complete weeks before this one (a year at most); "n/a" under MIN_NORMAL
  const before = W.slice(Math.max(0, i - NORMAL_WEEKS), i).filter((x) => x.prev && x.rows.length >= 4).map((x) => Math.abs(weekPct(x)));
  const normal = before.length >= MIN_NORMAL ? median(before) : null;
  let streak = 0; const up = pct > 0;
  if (pct !== 0) for (let j = i; j >= 0 && W[j].prev; j--) { const p = r2(weekPct(W[j])); if (p === 0 || (p > 0) !== up) break; streak++; }
  const past = W.slice(Math.max(0, i - PAST_WEEKS + 1), i + 1).filter((x) => x.prev).map((x) => ({ week: iso(x.mon), pct: r2(weekPct(x)) }));
  const big = days.slice().sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
  return { k: M.k, name: M.name, dec: M.dec, money: !!M.money, from: w.prev.c, fromDay: iso(w.prev.t), to: last.c, toDay: iso(last.t), pct, high: hi, low: lo,
    highLow: w.rows.some((r) => r.h != null) ? 'traded' : 'closes', days, normal: normal != null ? r2(normal) : null, times: normal ? r2(Math.abs(pct) / normal) : null,
    normalN: before.length, streak, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', bigDay: big ? { day: big.day, dow: big.dow, pct: big.pct } : null, past };
}

// The week's red-folder releases (macro/redfolder.json): what was expected, what printed, gold and the dollar that day.
export function releasesIn(rf, from, to) {
  const out = [];
  for (const k of Object.keys((rf && rf.study) || {})) {
    const S = rf.study[k]; if (!S || !Array.isArray(S.rows)) continue;
    for (const r of S.rows) {
      if (!r || !r.day || r.day < from || r.day > to) continue;
      const f = (r.fields || []).map((x) => ({ name: String(x.name || '').slice(0, 60), unit: String(x.unit || '').slice(0, 6), exp: x.exp != null ? String(x.exp).slice(0, 20) : null, expSrc: x.expSrc || null,
        actual: Number.isFinite(x.actual) ? x.actual : null, prev: Number.isFinite(x.prev) ? x.prev : null, surprise: Number.isFinite(x.surprise) ? x.surprise : null }));
      out.push({ type: k, name: String(S.name || k).slice(0, 60), day: r.day, at: r.at || null, fields: f, goldDay: Number.isFinite(r.goldDay) ? r.goldDay : null, usdDay: Number.isFinite(r.usdDay) ? r.usdDay : null });
    }
  }
  return out.sort((a, b) => (a.at || a.day).localeCompare(b.at || b.day));
}
const fieldText = (f) => `${f.name} ${f.actual != null ? `${f.actual}${f.unit}` : 'not on file yet'}${f.exp ? ` against ${f.exp} expected` : f.prev != null ? ` (previous ${f.prev}${f.unit})` : ''}`;
export const releaseText = (r) => `${r.name}: ${r.fields.slice(0, 2).map(fieldText).join('; ') || 'no figures on file'}`;

// The veteran's dated calls that came due in the week and are scored (macro/veteran-calls.json): hits, expected hits, each one.
export function callsIn(calls, from, to) {
  const due = (Array.isArray(calls) ? calls : []).filter((c) => c && c.by >= from && c.by <= to && typeof c.hit === 'boolean' && Number.isFinite(c.p));
  if (!due.length) return null;
  return { n: due.length, hits: due.filter((c) => c.hit).length, expected: r2(due.reduce((s, c) => s + c.p, 0)),
    items: due.slice(0, 12).map((c) => ({ claim: String(c.claim || '').slice(0, 200), p: c.p, hit: c.hit, by: c.by })) };
}

// The Gold Macro Score at the week's end against the week before (forecast.json goldScore.hist: [Friday, score])
export function scoreMove(fc, to) {
  const h = fc && fc.goldScore && Array.isArray(fc.goldScore.hist) ? fc.goldScore.hist.filter((x) => Array.isArray(x) && Number.isFinite(x[1]) && x[0] <= to) : [];
  if (h.length < 2) return null;
  const a = h[h.length - 2], b = h[h.length - 1];
  return { from: a[1], fromDay: a[0], to: b[1], toDay: b[0], above: b[1] > 0.25, was: a[1] > 0.25 };
}

const px = (m, v) => (m.money ? '$' : '') + v.toLocaleString('en-US', { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec });
const moved = (m) => (m.pct > 0 ? 'rose' : m.pct < 0 ? 'fell' : 'was flat');
export function marketLine(m) {
  if (m.pct === 0) return `${m.name} ended the week where it started (${px(m, m.to)}).`;
  const size = m.times == null ? '' : m.times >= 1.5 ? `, ${m.times.toFixed(1)} times a normal week (${m.normal.toFixed(1)}%)` : m.times <= 0.5 ? `, a quiet week (a normal one is ${m.normal.toFixed(1)}%)` : `, about a normal week (${m.normal.toFixed(1)}%)`;
  const run = m.streak >= 2 ? `; its ${m.streak === 2 ? 'second' : m.streak === 3 ? 'third' : m.streak === 4 ? 'fourth' : `${m.streak}th`} ${m.dir} week in a row` : '';
  return `${m.name} ${moved(m)} ${Math.abs(m.pct).toFixed(1)}% (${px(m, m.from)} to ${px(m, m.to)})${size}${run}.`;
}

// build: { now, series: { gold, dxy, eurusd, usdjpy, spx, nas } as [{ t, c, h?, l? }], rf, calls, fc }
export function build({ now, series = {}, rf = null, calls = null, fc = null }) {
  const S = {}; for (const M of MARKETS) S[M.k] = clean(series[M.k], now);
  const lead = S.gold.length ? S.gold : (MARKETS.map((M) => S[M.k]).find((r) => r.length) || []);
  if (!lead.length) return null;
  const mon = mondayOf(lead[lead.length - 1].t), from = iso(mon), to = iso(mon + 4 * DAY);
  const markets = MARKETS.map((M) => marketWeek(M, S[M.k], mon)).filter(Boolean);
  if (!markets.length) return null;
  const last = markets.reduce((d, m) => (m.toDay > d ? m.toDay : d), ''), complete = last >= to;
  const releases = releasesIn(rf, from, to), C = callsIn(calls, from, to), score = scoreMove(fc, to);
  const G = markets.find((m) => m.k === 'gold') || null, D = markets.find((m) => m.k === 'dxy') || null;
  // day by day: gold and the dollar, and the releases of that day
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = iso(mon + i * DAY), g = G && G.days.find((x) => x.day === d), u = D && D.days.find((x) => x.day === d), rel = releases.filter((r) => r.day === d);
    if (!g && !u && !rel.length) continue;
    days.push({ day: d, dow: DOW[i + 1], gold: g ? g.pct : null, goldClose: g ? g.close : null, dxy: u ? u.pct : null, releases: rel.map((r) => ({ type: r.type, text: releaseText(r) })) });
  }
  const lines = [];
  if (G) lines.push(marketLine(G));
  if (D) lines.push(marketLine(D));
  const eq = markets.filter((m) => m.k === 'spx' || m.k === 'nas'); if (eq.length) lines.push(eq.map((m) => `${m.name} ${moved(m)}${m.pct ? ` ${Math.abs(m.pct).toFixed(1)}%` : ''}`).join(', ') + '.');
  if (G && G.bigDay && G.days.length > 1) { const rel = releases.filter((r) => r.day === G.bigDay.day);
    lines.push(`Gold's biggest day was ${G.bigDay.dow} (${sign(G.bigDay.pct)})${rel.length ? `, the day of ${rel.map((r) => r.name).join(' and ')}` : ''}.`); }
  if (releases.length) lines.push(`Releases: ${releases.slice(0, 4).map(releaseText).join('. ')}.`);
  if (score) lines.push(`Gold Macro Score ${score.to > 0 ? '+' : ''}${score.to.toFixed(2)} at the week's end (${score.from > 0 ? '+' : ''}${score.from.toFixed(2)} a week before): ${score.above ? 'above +0.25, its tested side for gold rising' : 'no macro edge for gold (a negative score is not a sell)'}.`);
  if (C) lines.push(`${C.hits} of ${C.n} of the veteran's dated calls due this week came true (his odds expected ${C.expected.toFixed(1)}).`);
  const regime = fc && fc.regime && fc.regime.label ? String(fc.regime.label).slice(0, 200) : null;
  return { v: 1, at: new Date(now * 1000).toISOString(), from, to, last, complete, markets, days, releases, calls: C, score, regime, lines,
    note: 'What happened, from the council\'s own daily closes (UTC days) and its release files. A normal week is the median absolute weekly move of the year before. Descriptive: a review, not a signal, and no rule or trade reads it.' };
}
