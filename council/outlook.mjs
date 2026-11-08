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
export function calls({ closes, now, h, tilt = 0, name = 'Gold', dp = 0, unit = '' }) {
  const P = paths(closes, h, { now }); const s = (closes || []).filter((o) => o.t <= now); if (!P || !s.length) return null;
  const px = s[s.length - 1].v, by = addSessions(Math.min(now, s[s.length - 1].t), h), fmt = (v) => (unit === '$' ? '$' : '') + v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const up = clamp(freq(P, (p) => p.end > 0) + tilt);
  const step = px > 1000 ? 10 : px > 100 ? 0.5 : 0.005, rnd = (v) => Math.round(v / step) * step;
  const lvl = (qq, k) => { const L = rnd(px * (1 + q(P.map((p) => p[k]), qq))), r = L / px - 1; return { L, p: clamp(freq(P, (p) => (k === 'hi' ? p.hi >= r : p.lo <= r)) + (k === 'hi' ? 1 : -1) * tilt * 0.8) }; };
  const U = lvl(0.5, 'hi'), U2 = lvl(0.85, 'hi'), D = lvl(0.5, 'lo'), D2 = lvl(0.15, 'lo');
  const lo = q(P.map((p) => p.end), 0.2 - tilt / 2), hi = q(P.map((p) => p.end), 0.8 - tilt / 2);
  const big = Math.max(Math.abs(q(P.map((p) => p.end), 0.1)), q(P.map((p) => p.end), 0.9)), pBig = freq(P, (p) => Math.abs(p.end) >= big);
  return { horizon: h, by, from: fmt(px), n: P.length, list: [
    { claim: `${name} closes ${by} above ${fmt(px)} (today's close)`, p: +up.toFixed(2) },
    { claim: `${name} closes at or above ${fmt(U.L)} on some day by ${by}`, p: +U.p.toFixed(2) },
    { claim: `${name} closes at or above ${fmt(U2.L)} on some day by ${by} (stretch)`, p: +U2.p.toFixed(2) },
    { claim: `${name} closes at or below ${fmt(D.L)} on some day by ${by}`, p: +D.p.toFixed(2) },
    { claim: `${name} closes at or below ${fmt(D2.L)} on some day by ${by} (stretch)`, p: +D2.p.toFixed(2) },
    { claim: `${name}'s ${by} close lands between ${fmt(px * (1 + lo))} and ${fmt(px * (1 + hi))}`, p: 0.6 },
    { claim: `${name} moves ${(big * 100).toFixed(1)}% or more either way by ${by}`, p: +pBig.toFixed(2) },
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
  const w = calls({ closes: gold, now, h: 5, tilt: tilt20 / 2, unit: '$' }), m = calls({ closes: gold, now, h: 20, tilt: tilt20, unit: '$' });
  const dw = calls({ closes: dxy, now, h: 5, tilt: 0, name: 'DXY', dp: 2 }), dm = calls({ closes: dxy, now, h: 20, tilt: 0, name: 'DXY', dp: 2 });
  const take = (c) => (c ? c.list[0] : null);
  return { week: w && { ...w, list: [...w.list, take(dw)].filter(Boolean) }, month: m && { ...m, list: [...m.list, take(dm)].filter(Boolean) }, tilt: +tilt20.toFixed(3),
    digest: digest(ch || {}, fc), method: 'Each probability is gold\'s own frequency for the same horizon over the last 10 years, moved by the council\'s tilt (the veteran\'s calibrated probability minus its base rate, carrying the strategist\'s Gold Macro Score); half the tilt for the week. The range call is the middle 60% of past outcomes. DXY calls carry no tilt.' };
}
