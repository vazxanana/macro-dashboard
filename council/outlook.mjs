// Council · Veteran outlook (8 Nov 2026, owner: "he should be able to tell what's his predictions for the week and month, be
// specific on it and give 0-100% of that happening; council macro can help him as well").
// Specific, checkable calls for the week (5 trading days) and the month (20 trading days): named price levels and dates, each
// with a probability. Every probability starts from gold's own empirical frequency over the last 10 years for the same horizon
// (the reference class), then moves by the council's tilt: the veteran's ledger probability minus its base rate, which carries
// the Macro strategist's tested Gold Macro Score and the veteran's agreement with it (half the tilt for the week). Paper only.
const DAY = 86400;
const clamp = (p) => Math.min(0.95, Math.max(0.05, p));
const r0 = (x) => Math.round(x);
// trading-day date h sessions after t (weekends skipped)
export function addSessions(t, h) { let d = new Date(t * 1000), n = 0; while (n < h) { d = new Date(d.getTime() + DAY * 1000); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; } return d.toISOString().slice(0, 10); }
// empirical paths: for each start in the window, the h-day close return and the max / min close return along the way
export function paths(closes, h, { now = Infinity, years = 10 } = {}) {
  const s = (closes || []).filter((o) => o.t <= now && o.t >= now - years * 365 * DAY), out = [];
  for (let i = 0; i + h < s.length; i++) { let hi = -Infinity, lo = Infinity; for (let j = 1; j <= h; j++) { const r = s[i + j].v / s[i].v - 1; if (r > hi) hi = r; if (r < lo) lo = r; } out.push({ end: s[i + h].v / s[i].v - 1, hi, lo }); }
  return out.length >= 100 ? out : null;
}
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
const freq = (P, f) => P.filter(f).length / P.length;
// one horizon's calls for a close series
export function calls({ closes, now, h, tilt = 0, name = 'Gold', dp = 0, unit = '', asset = null }) {
  const P = paths(closes, h, { now }); const s = (closes || []).filter((o) => o.t <= now); if (!P || !s.length) return null;
  const px = s[s.length - 1].v, by = addSessions(Math.min(now, s[s.length - 1].t), h), fmt = (v) => (unit === '$' ? '$' : '') + v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const up0 = freq(P, (p) => p.end > 0), up = clamp(up0 + tilt);
  const step = px > 1000 ? 10 : px > 100 ? 0.5 : 0.005, rnd = (v) => Math.round(v / step) * step;
  const lvl = (qq, k) => { const L = rnd(px * (1 + q(P.map((p) => p[k]), qq))), r = L / px - 1; const f0 = freq(P, (p) => (k === 'hi' ? p.hi >= r : p.lo <= r)); return { L, p: clamp(f0 + (k === 'hi' ? 1 : -1) * tilt * 0.8), b: +f0.toFixed(3) }; };
  const U = lvl(0.5, 'hi'), U2 = lvl(0.85, 'hi'), D = lvl(0.5, 'lo'), D2 = lvl(0.15, 'lo');
  const lo = q(P.map((p) => p.end), 0.2 - tilt / 2), hi = q(P.map((p) => p.end), 0.8 - tilt / 2);
  const big = Math.max(Math.abs(q(P.map((p) => p.end), 0.1)), q(P.map((p) => p.end), 0.9)), pBig = freq(P, (p) => Math.abs(p.end) >= big);
  const A = asset || name.toLowerCase(), r4 = (v) => +(+v).toPrecision(8);
  return { horizon: h, by, from: fmt(px), n: P.length, list: [
    { claim: `${name} closes ${by} above ${fmt(px)} (today's close)`, p: +up.toFixed(2), baseP: +up0.toFixed(3), asset: A, kind: 'closeAbove', level: r4(px), by },
    { claim: `${name} closes at or above ${fmt(U.L)} on some day by ${by}`, p: +U.p.toFixed(2), baseP: U.b, asset: A, kind: 'touchUp', level: r4(U.L), by },
    { claim: `${name} closes at or above ${fmt(U2.L)} on some day by ${by} (stretch)`, p: +U2.p.toFixed(2), baseP: U2.b, asset: A, kind: 'touchUp', level: r4(U2.L), by },
    { claim: `${name} closes at or below ${fmt(D.L)} on some day by ${by}`, p: +D.p.toFixed(2), baseP: D.b, asset: A, kind: 'touchDown', level: r4(D.L), by },
    { claim: `${name} closes at or below ${fmt(D2.L)} on some day by ${by} (stretch)`, p: +D2.p.toFixed(2), baseP: D2.b, asset: A, kind: 'touchDown', level: r4(D2.L), by },
    { claim: `${name}'s ${by} close lands between ${fmt(px * (1 + lo))} and ${fmt(px * (1 + hi))}`, p: 0.6, baseP: 0.6, asset: A, kind: 'range', lo: r4(px * (1 + lo)), hi: r4(px * (1 + hi)), by },
    { claim: `${name} moves ${(big * 100).toFixed(1)}% or more either way by ${by}`, p: +pBig.toFixed(2), baseP: +pBig.toFixed(3), asset: A, kind: 'bigMove', level: r4(px), pct: +big.toFixed(4), by },
  ] };
}
// the registry digest: what the hard-to-get public data says right now, in plain words, and what the council cannot see
export function digest(ch, fc) {
  const by = Object.fromEntries((ch.list || []).map((r) => [r.k, r])), out = [], lw = (v) => (v == null ? 'no reading' : v > 0 ? 'supportive for gold' : v < 0 ? 'against gold' : 'neutral for gold');
  const add = (src, r, extra) => { if (r && r.lean !== undefined && !/^no observation|^not observed/.test(r.obs)) out.push({ src, read: r.obs + (r.asOf && !r.obs.includes(r.asOf) ? ` (as of ${r.asOf}${r.stale ? ', stale' : ''})` : ''), says: lw(r.lean) + (extra ? '. ' + extra : ''), limit: r.cannot }); };
  add('CFTC Commitments of Traders', by.pos, by.pos && /(\d+)th percentile/.test(by.pos.obs) ? (+RegExp.$1 >= 80 ? 'Crowded long: a hawkish surprise would hit harder than usual' : +RegExp.$1 <= 20 ? 'Light positioning: room for buyers to return' : 'Not crowded either way') : '');
  add('Fed H.4.1 / funding (SOFR, VIX curve, HY spreads)', by.risk, 'Stress first sells gold for cash, then buys it');
  add('CME FedWatch / 2Y (policy path)', by.policy, 'The direction of repricing is the signal, not the level');
  add('TIPS real yield (opportunity cost)', by.real, '');
  add('Dollar (DXY, broad USD)', by.usd, '');
  add('Breakevens (inflation expectations)', by.infl, '');
  if (fc && fc.goldScore && fc.goldScore.score != null) out.push({ src: 'Council strategist: Gold Macro Score', read: `score ${(+fc.goldScore.score).toFixed(2)} (tested 2007-26, 4-week horizon)`, says: fc.goldScore.score > 0.25 ? 'a tested long edge' : 'no tested edge (auction)', limit: 'Never a sell signal: a negative score did not predict falls.' });
  const missing = ['LBMA vaults', 'COMEX warehouse stocks', 'Shanghai withdrawals and SHFE warrants', 'Swiss customs flows', 'WGC reserves and ETF flows', 'Treasury TIC', 'NY Fed ACM term premium'];
  return { list: out, missing };
}
export function outlook({ gold, dxy, now, tilt20 = 0, ch, fc }) {
  const w = calls({ closes: gold, now, h: 5, tilt: tilt20 / 2, unit: '$', asset: 'gold' }), m = calls({ closes: gold, now, h: 20, tilt: tilt20, unit: '$', asset: 'gold' });
  const dw = calls({ closes: dxy, now, h: 5, tilt: 0, name: 'DXY', dp: 2, asset: 'dxy' }), dm = calls({ closes: dxy, now, h: 20, tilt: 0, name: 'DXY', dp: 2, asset: 'dxy' });
  const take = (c) => (c ? c.list[0] : null);
  return { week: w && { ...w, list: [...w.list, take(dw)].filter(Boolean) }, month: m && { ...m, list: [...m.list, take(dm)].filter(Boolean) }, tilt: +tilt20.toFixed(3),
    digest: digest(ch || {}, fc), method: 'Each probability is gold\'s own frequency for the same horizon over the last 10 years, moved by the council\'s tilt (the veteran\'s calibrated probability minus its base rate, carrying the strategist\'s Gold Macro Score); half the tilt for the week. The range call is the middle 60% of past outcomes. DXY calls carry no tilt.' };
}

// ---- the calls' own record (9 Nov, owner: "keep improving our veteran macro"): every dated call is kept once, resolved on the
// daily closes after its date, and scored (hit rate and Brier against the stated probability). Append-only; never edited after.
const dayOf = (iso) => Date.parse(iso + 'T23:59:59Z') / 1000;
export function resolveCall(c, closes, now) {
  const end = dayOf(c.by); if (now < end + 86400) return null;   // the date's close must be final
  // the event playbook's release-day call (9 Nov): the UTC daily close of `by` against the close before it; `by` must not be
  // before the issue date, and the close of `by` must exist (a missing day stays unresolved, never guessed)
  if (c.kind === 'dayUp' || c.kind === 'dayDown') {
    if (c.by < c.issued) return null;
    const S = (closes || []).filter((o) => o.t <= end), i = S.findIndex((o) => new Date(o.t * 1000).toISOString().slice(0, 10) === c.by); if (i < 1) return null;
    return c.kind === 'dayUp' ? S[i].v > S[i - 1].v : S[i].v < S[i - 1].v;
  }
  const S = (closes || []).filter((o) => o.t > dayOf(c.issued) && o.t <= end); if (!S.length) return null;
  const last = S[S.length - 1].v;
  switch (c.kind) {
    case 'closeAbove': return last > c.level;
    case 'touchUp': return S.some((o) => o.v >= c.level);
    case 'touchDown': return S.some((o) => o.v <= c.level);
    case 'range': return last >= c.lo && last <= c.hi;
    case 'bigMove': return Math.abs(last / c.level - 1) >= c.pct;
    case 'pairDown': return last < c.level;
    case 'pairUp': return last > c.level;
    // the veteran's hypotheses (9 Nov): which comes first on the daily closes, the target or the guard; and a range held on every close
    case 'firstTouchUp': for (const o of S) { if (o.v <= c.guard) return false; if (o.v >= c.level) return true; } return false;
    case 'firstTouchDown': for (const o of S) { if (o.v >= c.guard) return false; if (o.v <= c.level) return true; } return false;
    case 'stayInside': return S.every((o) => o.v >= c.lo && o.v <= c.hi);
    default: return null;
  }
}
export function callsLedger(ledger, { outlook, closesBy, now, extra = [] }) {
  const L = (ledger || []).slice(), today = new Date(now * 1000).toISOString().slice(0, 10), have = new Set(L.map((r) => r.id));
  const all = [...((outlook && outlook.week && outlook.week.list) || []), ...((outlook && outlook.month && outlook.month.list) || []), ...((outlook && outlook.cot) || []), ...(extra || [])];
  // a call may carry its own id (the veteran's hypotheses: one per slot and week, so the first version of the week is the one kept)
  for (const c of all) { if (!c.kind || !c.by) continue; const id = c.id || `${c.asset}:${c.kind}:${c.level ?? c.lo}:${c.by}`; if (have.has(id)) continue;
    // one record per call: issued the first day it appears (the same call re-issued on later days is not counted twice)
    L.push({ id, issued: today, claim: c.claim, p: c.p, asset: c.asset, kind: c.kind, level: c.level ?? null, lo: c.lo ?? null, hi: c.hi ?? null, pct: c.pct ?? null, by: c.by, src: c.src || 'base rate + council tilt',
      ...(Number.isFinite(c.baseP) ? { baseP: c.baseP } : {}), ...(Number.isFinite(c.pRaw) && c.pRaw !== c.p ? { pRaw: c.pRaw } : {}),
      ...(c.guard != null ? { guard: c.guard } : {}), ...(c.base ? { base: { analog: c.base.analog, n: c.base.n, all: c.base.all } } : {}) }); have.add(id); }
  for (const r of L) if (r.hit == null) { const h = resolveCall(r, closesBy[r.asset], now); if (h != null) { r.hit = h; r.resolvedAt = today; r.brier = +((r.p - (h ? 1 : 0)) ** 2).toFixed(4); } }
  return L.slice(-600);
}
export function callsScore(L) {
  const done = (L || []).filter((r) => r.hit != null); if (!done.length) return { n: 0, open: (L || []).length };
  const brier = done.reduce((a, r) => a + r.brier, 0) / done.length, exp = done.reduce((a, r) => a + r.p, 0) / done.length, hits = done.filter((r) => r.hit).length / done.length;
  // calibration: high-probability calls (>= 60%) should come true more often than low ones (<= 40%)
  const band = (f) => { const b = done.filter(f); return b.length ? { n: b.length, hit: +(b.filter((r) => r.hit).length / b.length).toFixed(2), p: +(b.reduce((a, r) => a + r.p, 0) / b.length).toFixed(2) } : null; };
  return { n: done.length, open: L.length - done.length, brier: +brier.toFixed(4), expected: +exp.toFixed(2), hitRate: +hits.toFixed(2), high: band((r) => r.p >= 0.6), low: band((r) => r.p <= 0.4), weekly: callsByWeek(done) };
}
// hit rate over time for the desk's chart: scored calls grouped by the ISO week (Monday) of their due date, with the running
// totals; `expected` is the mean stated probability, so a calibrated record keeps the two lines together
export function callsByWeek(L) {
  const done = (L || []).filter((r) => r.hit != null && /^\d{4}-\d\d-\d\d/.test(r.by || '')), g = new Map();
  for (const r of done) { const d = new Date(r.by.slice(0, 10) + 'T00:00:00Z'), wk = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
    const x = g.get(wk) || { week: wk, n: 0, hits: 0, p: 0 }; x.n++; x.hits += r.hit ? 1 : 0; x.p += r.p; g.set(wk, x); }
  let n = 0, h = 0, p = 0;
  return [...g.values()].sort((a, b) => (a.week < b.week ? -1 : 1)).map((x) => { n += x.n; h += x.hits; p += x.p;
    return { week: x.week, n: x.n, hit: +(x.hits / x.n).toFixed(2), expected: +(x.p / x.n).toFixed(2), cumN: n, cumHit: +(h / n).toFixed(2), cumExpected: +(p / n).toFixed(2) }; });
}
// COT signals that passed the desk's historical test (n >= 15, hit >= base + 8 pts, t >= 2) become dated, scored calls
export function cotCalls(cot, pxByAsset, now) {
  const out = []; if (!cot || !cot.markets) return out;
  for (const m of cot.markets) for (const s of m.signals || []) { const t = s.tested; if (!t || !t.edge || s.pairDir == null) continue;
    const h = s.kind === 'extreme' ? 20 : 5, closes = pxByAsset[m.k] || []; const last = closes.filter((o) => o.t <= now).at(-1); if (!last) continue;
    const by = addSessions(Math.min(now, last.t), h), dp = last.v > 50 ? 2 : 4;
    out.push({ claim: `${m.name} closes ${by} ${s.pairDir > 0 ? 'above' : 'below'} ${last.v.toFixed(dp)} (COT ${s.kind} signal; tested ${t.n} times since 2020, right ${Math.round(t.win * 100)}%)`,
      p: +Math.min(0.75, Math.max(0.5, t.win)).toFixed(2), ...(Number.isFinite(t.base) ? { baseP: +(s.pairDir > 0 ? t.base : 1 - t.base).toFixed(3) } : {}), asset: m.k, kind: s.pairDir > 0 ? 'pairUp' : 'pairDown', level: +last.v.toPrecision(8), by, src: `COT ${s.kind}` }); }
  return out;
}
