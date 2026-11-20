// Hard-to-find macro data, second batch (20 Nov 2026, owner: "More focus and effort on Hard-to-find data info and sources").
// Every source below answered from a GitHub runner on 20 Nov 2026 (scripts/macro-probe3.mjs) and is keyless and public:
//  - `priced`: what prediction-market traders pay for the NEXT prints (Kalshi "Above x" ladders: CPI and core CPI month on
//    month, core PCE, payrolls, the unemployment rate, real GDP), the Fed's target rate after the next meetings, a US recession
//    next year, and gold's month-end price. A ladder is turned into the most likely print and its chance, or a middle value.
//    What traders pay, never a forecast of ours and never a consensus survey;
//  - `auctionResults`: how the last note and bond auctions went (TreasuryDirect: high yield, bid-to-cover against the earlier
//    auctions of the same term on file, the share taken by indirect bidders and by dealers);
//  - `plumbing`: the Fed's money-market plumbing (NY Fed reference rates against the target range, the overnight reverse-repo
//    balance, the Treasury's cash at the Fed from the Daily Treasury Statement, the Fed's balance sheet and bank reserves from
//    FRED), and "net liquidity" = balance sheet - Treasury cash - reverse repo, with its change over four weeks;
//  - `vol`: what options price (Cboe index histories: GVZ = gold's 30-day implied volatility and the daily move it implies,
//    with its place in the last year; VIX1D / VIX9D, SKEW, VVIX, OVX), and the OFR Financial Stress Index;
//  - `under`: inflation and activity under the headline (FRED: Dallas Fed trimmed-mean PCE, Atlanta Fed sticky CPI and wage
//    tracker, Cleveland Fed median CPI and one-year expected inflation, weekly jobless claims, the Weekly Economic Index, the
//    St. Louis Fed's GDP nowcast, the 10-year term premium).
// Context only: nothing here is a rule, a call or a trade. Pure parsers + one collector; council/hard-data.mjs calls it.
const num = (x) => { if (x == null || x === '' || x === '.') return null; const n = +String(x).replace(/[$,%\s]/g, ''); return Number.isFinite(n) ? n : null; };
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayWord = (ymd) => { const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00Z'); return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}` : String(ymd); };

export const SRC2 = {
  kalshiEvents: (series, n = 4) => `https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${series}&status=open&with_nested_markets=true&limit=${n}`,
  auctioned: 'https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&days=150',
  nyRates: 'https://markets.newyorkfed.org/api/rates/all/latest.json',
  nyRrp: (from) => `https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate=${from}`,
  tga: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=120',
  fred: (id) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
  cboe: (id) => `https://cdn.cboe.com/api/global/us_indices/daily_prices/${id}_History.csv`,
  ofrFsi: 'https://www.financialresearch.gov/financial-stress-index/data/fsi.csv',
};

// ---------- prediction-market ladders ----------
// The series read, in the order they are shown. `step` = the print's own grid (a CPI prints to one decimal), so "Above 0.2%"
// and "Above 0.3%" bracket the print 0.3; without a step the ladder gives a middle value instead of a most likely print.
export const LADDERS = [
  { key: 'coreCpi', series: 'KXCPICORE', name: 'core CPI', unit: '%', step: 0.1, mom: true },
  { key: 'cpi', series: 'KXCPI', name: 'CPI', unit: '%', step: 0.1, mom: true },
  { key: 'corePce', series: 'KXPCECORE', name: 'core PCE', unit: '%', step: 0.1, mom: true },
  { key: 'payrolls', series: 'KXPAYROLLS', name: 'payrolls', unit: 'jobs' },
  { key: 'u3', series: 'KXU3', name: 'the unemployment rate', unit: '%', step: 0.1 },
  { key: 'gdp', series: 'KXGDP', name: 'real GDP growth', unit: '%' },
  { key: 'fed', series: 'KXFED', name: 'the Fed\'s target rate (upper bound)', unit: '%', step: 0.25, many: 3 },
  { key: 'recession', series: 'KXRECSSNBER', name: 'a US recession', binary: true, many: 2 },
  { key: 'gold', series: 'KXGOLDMON', name: 'gold', unit: '$' },
];
export const MIN_RUNGS = 3;      // a ladder with fewer priced rungs is not read
export const WIDE = 0.15;        // a bid / ask further apart than this is not a price: the last trade is used instead

// One market's price: the middle of bid and ask when both stand and are close, else the last trade, else the wide middle.
export function priceOf(m) {
  const bid = num(m.yes_bid_dollars), ask = num(m.yes_ask_dollars), last = num(m.last_price_dollars);
  const two = bid != null && ask != null && ask > 0 && ask >= bid;
  if (two && ask - bid <= WIDE + 1e-9) return (bid + ask) / 2;
  if (last != null && last > 0 && last < 1) return last;
  return two ? (bid + ask) / 2 : null;
}
// The threshold in a rung's label: "Above 0.2%", "Above -25,000", "Above $3523.99", "Above 4.25%"; else the market's floor_strike.
export function thresholdOf(m) {
  const s = String(m.yes_sub_title || m.subtitle || '');
  const a = /(?:above|over|more than|greater than|>)\s*(-?\$?-?[\d,]*\.?\d+)/i.exec(s);
  if (a) return num(a[1]);
  return num(m.floor_strike);
}
// [{ x, p }] by rising threshold; p = P(print above x), forced to never rise with x (thin rungs cross each other).
export function ladderOf(markets) {
  const rows = [];
  for (const m of Array.isArray(markets) ? markets : []) {
    if (!m || typeof m !== 'object') continue;
    const x = thresholdOf(m), p = priceOf(m);
    if (x == null || p == null || p < 0 || p > 1) continue;
    rows.push({ x, p, v: num(m.volume_fp != null ? m.volume_fp : m.volume) || 0 });
  }
  rows.sort((a, b) => a.x - b.x);
  const out = []; let cap = 1;
  for (const r of rows) { if (out.length && out[out.length - 1].x === r.x) continue; cap = Math.min(cap, r.p); out.push({ x: r.x, p: r3(cap) }); }
  return { rungs: out, volume: Math.round(rows.reduce((s, r) => s + r.v, 0)) };
}
// The value the ladder puts a `q` chance above (q 0.5 = the middle), by straight line between the two rungs around it; null
// when the ladder does not cross q (every rung above it or every rung below it).
export function quantile(rungs, q = 0.5) {
  for (let i = 0; i + 1 < rungs.length; i++) {
    const a = rungs[i], b = rungs[i + 1];
    if (a.p >= q && b.p <= q) { if (a.p === b.p) return (a.x + b.x) / 2; return a.x + (b.x - a.x) * (a.p - q) / (a.p - b.p); }
  }
  return null;
}
// For a print on a grid: the chance of each printable value between the rungs, [{ v, p }] by falling chance. "Above 0.2%" at
// 0.455 and "Above 0.3%" at 0.125 put 33% on a 0.3 print. Only between neighbouring rungs exactly one step apart.
export function buckets(rungs, step) {
  const out = [];
  for (let i = 0; i + 1 < rungs.length; i++) {
    const a = rungs[i], b = rungs[i + 1];
    if (Math.abs((b.x - a.x) - step) > step * 0.01) continue;
    out.push({ v: Math.round((a.x + step) * 1000) / 1000, p: r3(a.p - b.p) });
  }
  return out.filter((b) => b.p > 0).sort((a, b) => b.p - a.p);
}
const sign = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const pct = (p) => `${Math.round(p * 100)}%`;
const jobs = (v) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v / 5000) * 5).toLocaleString('en-US')},000`.replace(/^(−?)0,000$/, '0');
// What the event is about, from its own words: "Core CPI in November" + "In Nov 2026" -> "November 2026".
export function periodOf(e) {
  const s = `${e.title || ''} ${e.sub_title || ''}`;
  if (/^[A-Z][a-z]+ 20\d\d$/.test(String(e.strike_period || ''))) return e.strike_period;
  const q = /Q([1-4])\s*(20\d\d)/.exec(s); if (q) return `Q${q[1]} ${q[2]}`;
  const y = (/\b(20\d\d)\b/.exec(s) || [])[1];
  const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m.slice(0, 3)}`).test(s));
  const d = /\b(?:on\s+)?([A-Z][a-z]{2,8})\s+(\d{1,2}),\s*(20\d\d)/.exec(s);
  if (d) { const m = MONTHS.findIndex((x) => x.slice(0, 3).toLowerCase() === d[1].slice(0, 3).toLowerCase()); if (m >= 0) return `${+d[2]} ${MONTHS[m].slice(0, 3)} ${d[3]}`; }
  if (mi >= 0 && y) return `${MONTHS[mi]} ${y}`;
  return y ? String(y) : null;
}
// One Kalshi event -> what it prices, or null when too thin to read.
export function readEvent(L, e) {
  if (!e || !Array.isArray(e.markets)) return null;
  const period = periodOf(e), base = { key: L.key, event: String(e.event_ticker || '').slice(0, 40), period };
  const close = e.markets.map((m) => m.close_time || m.expected_expiration_time).filter(Boolean).sort()[0];
  if (close && /^\d{4}-\d\d-\d\d/.test(close)) base.close = String(close).slice(0, 20);
  if (L.binary) {
    const m = e.markets[0], p = m ? priceOf(m) : null; if (p == null) return null;
    return { ...base, p: r2(p), volume: Math.round(num(m.volume_fp != null ? m.volume_fp : m.volume) || 0), text: `${L.name} in ${period || 'the period'}: ${pct(p)}` };
  }
  const { rungs, volume } = ladderOf(e.markets);
  if (rungs.length < MIN_RUNGS) return null;
  const mid = quantile(rungs, 0.5), out = { ...base, rungs, volume };
  if (mid != null) out.mid = r3(mid);
  if (L.step) {
    const b = buckets(rungs, L.step).slice(0, 3);
    if (!b.length || b[0].p < 0.05) return mid == null ? null : { ...out, text: `${L.name} for ${period}: middle of the ladder ${L.unit === '%' ? sign(mid, 2) + '%' : mid}` };
    out.likely = b;
    const f = (x) => L.key === 'u3' || L.key === 'fed' ? `${x.v.toFixed(L.key === 'fed' ? 2 : 1)}%` : `${sign(x.v)}%`;
    out.text = `${L.name} for ${period}: most likely ${f(b[0])} (${pct(b[0].p)})${b[1] && b[1].p >= 0.1 ? `, then ${f(b[1])} (${pct(b[1].p)})` : ''}`;
    return out;
  }
  if (mid == null) return null;
  if (L.key === 'payrolls') { const k = rungs.find((r) => r.x === 100000); out.text = `${L.name} for ${period}: the middle of the ladder is about ${jobs(mid)} jobs${k ? `, ${pct(k.p)} on more than 100,000` : ''}`; }
  else if (L.key === 'gold') { const lo = quantile(rungs, 0.8), hi = quantile(rungs, 0.2); out.lo = lo == null ? null : Math.round(lo); out.hi = hi == null ? null : Math.round(hi);
    out.text = `${L.name} on ${period}: the middle of the ladder is about $${Math.round(mid).toLocaleString('en-US')}${lo != null && hi != null ? `, a 60% chance priced between $${Math.round(lo).toLocaleString('en-US')} and $${Math.round(hi).toLocaleString('en-US')}` : ''}`; }
  else out.text = `${L.name} for ${period}: the middle of the ladder is ${sign(mid)}%`;
  return out;
}
// The events of one series -> the readable ones, soonest first, `many` at most (1 by default).
export function readSeries(L, J) {
  const evs = J && Array.isArray(J.events) ? J.events : [];
  const out = [];
  for (const e of evs) { const r = readEvent(L, e); if (r) out.push(r); }
  out.sort((a, b) => String(a.close || '9').localeCompare(String(b.close || '9')));
  return out.slice(0, L.many || 1);
}
export const PRICED_TAIL = 'What traders pay on a prediction market: not a consensus survey and not a forecast of ours.';
// Plain lines for the desk and the morning report: the next prints, the rate path, the rest.
export function pricedLines(priced) {
  const P = priced && priced.items ? priced.items : null; if (!P) return [];
  const one = (k) => (P[k] || [])[0], out = [];
  const prints = ['coreCpi', 'cpi', 'corePce', 'payrolls', 'u3', 'gdp'].map(one).filter(Boolean).map((x) => x.text);
  if (prints.length) out.push(`Priced for the next prints (Kalshi): ${prints.join('; ')}. ${PRICED_TAIL}`);
  const fed = (P.fed || []).filter((x) => x.likely);
  if (fed.length) out.push(`Priced for the Fed's target rate, upper bound (Kalshi): ${fed.map((x) => `after ${x.period ? x.period.replace(/\s20\d\d$/, '') : 'the meeting'} ${x.likely[0].v.toFixed(2)}% (${pct(x.likely[0].p)})`).join(', ')}. ${PRICED_TAIL}`);
  const rest = [...(P.recession || []).filter((x) => x.p >= 0.05), one('gold')].filter(Boolean).map((x) => x.text);
  if (rest.length) out.push(`Also priced (Kalshi): ${rest.join('; ')}. ${PRICED_TAIL}`);
  return out;
}

// ---------- Treasury auction results ----------
const pick = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return null; };
const byRe = (o, re) => { const k = Object.keys(o).find((x) => re.test(x) && o[x] != null && o[x] !== ''); return k ? o[k] : null; };
const yes = (x) => x === true || /^(yes|y|true)$/i.test(String(x == null ? '' : x).trim());
// Notes, bonds, TIPS and FRNs already auctioned, newest first: { day, term, tenor, type, yield, btc, indirect, dealers, direct,
// amount } (shares of the competitive amount awarded, 0-1; a field the file does not carry is null).
// The original tenor of a term: a "9-Year 10-Month" reopening is a 10-year, so it is compared with the other 10-years.
export function tenorOf(term) {
  const y = +(/(\d+)-Year/i.exec(term) || [])[1] || 0, m = +(/(\d+)-Month/i.exec(term) || [])[1] || 0, v = y + m / 12;
  if (!v) return null;
  return [2, 3, 5, 7, 10, 20, 30].find((t) => v <= t && v > t - 1.01) || Math.ceil(v);
}
export function parseAuctionResults(J) {
  const rows = Array.isArray(J) ? J : [];
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    // the file has no `auctionDate` (probe of 20 Nov 2026): the auction day is `competitiveAuctionCloseDate`
    let dv = pick(r, ['auctionDate', 'competitiveAuctionCloseDate']);
    if (dv == null) dv = byRe(r, /^(?!.*(year|time|announce)).*auction.*date/i);
    const day = (/^(\d{4}-\d{2}-\d{2})/.exec(String(dv || '')) || [])[1];
    const kind = String(r.type || ''), st = String(r.securityType || ''), term = String(pick(r, ['securityTerm', 'term']) || '').trim().slice(0, 30);
    if (!day || !term) continue;
    const tips = yes(r.tips) || yes(r.inflationProtected) || /TIPS/i.test(kind), frn = yes(r.floatingRate) || /FRN/i.test(kind);
    let type = tips ? 'TIPS' : frn ? 'FRN' : /bond/i.test(kind + st) ? 'Bond' : /note/i.test(kind + st) ? 'Note' : null;
    if (!type || /bill|cmb/i.test(kind)) continue;
    const y = num(pick(r, ['highYield', 'highDiscountMargin', 'highRate'])), btc = num(r.bidToCoverRatio);
    if (y == null && btc == null) continue;                       // announced but not auctioned yet
    const ind = num(byRe(r, /^indirectBidders?Competitive\w*Awarded$/i)), dir = num(byRe(r, /^directBidders?Competitive\w*Awarded$/i)), pd = num(byRe(r, /^primaryDealers?Competitive\w*Awarded$/i));
    // the competitive amount awarded: the three groups together when the file names all three, else the grand total
    const comp = ind != null && dir != null && pd != null ? ind + dir + pd : num(r.grandTotalParAwarded);
    const share = (n) => (n != null && comp > 0 && n <= comp ? r3(n / comp) : null);
    const amt = num(r.offeringAmount);
    out.push({ day, term, tenor: tenorOf(term), type, reopening: yes(r.reopening), yield: y, median: num(r.medianYield), btc: btc == null ? null : r2(btc),
      indirect: share(ind), direct: share(dir), dealers: pd != null ? share(pd) : (ind != null && dir != null && comp > 0 ? r3(Math.max(0, 1 - (ind + dir) / comp)) : null),
      amount: amt == null || amt <= 0 ? null : r2(amt >= 1e8 ? amt / 1e9 : amt) });
  }
  out.sort((a, b) => b.day.localeCompare(a.day) || (a.tenor || 99) - (b.tenor || 99));
  // each auction against the earlier ones of the same original tenor and type on file (three at most)
  const same = (a, x) => x.type === a.type && x.tenor === a.tenor && x.day < a.day;
  for (const a of out) {
    const prior = out.filter((x) => same(a, x) && x.btc != null).slice(0, 3);
    if (prior.length && a.btc != null) { a.btcPrior = r2(prior.reduce((s, x) => s + x.btc, 0) / prior.length); a.priorN = prior.length; }
    const pi = out.filter((x) => same(a, x) && x.indirect != null).slice(0, 3);
    if (pi.length && a.indirect != null) a.indirectPrior = r3(pi.reduce((s, x) => s + x.indirect, 0) / pi.length);
  }
  return out;
}
export const SOFT_BTC = 0.1;   // a bid-to-cover this far under / over the earlier auctions' average is called softer / stronger
export function resultText(a) {
  const parts = [];
  if (a.yield != null) parts.push(a.type === 'FRN' ? `discount margin ${a.yield.toFixed(3)}%` : `high yield ${a.yield.toFixed(3)}%`);
  if (a.btc != null) parts.push(`bid-to-cover ${a.btc.toFixed(2)}${a.btcPrior != null ? ` (the ${a.priorN > 1 ? `${a.priorN} before averaged` : 'one before had'} ${a.btcPrior.toFixed(2)})` : ''}`);
  if (a.indirect != null) parts.push(`indirect bidders took ${pct(a.indirect)}${a.indirectPrior != null ? ` (${pct(a.indirectPrior)} before)` : ''}`);
  if (a.dealers != null) parts.push(`dealers took ${pct(a.dealers)}`);
  const tone = a.btc != null && a.btcPrior != null ? (a.btc <= a.btcPrior - SOFT_BTC ? ' Softer demand than the earlier ones.' : a.btc >= a.btcPrior + SOFT_BTC ? ' Stronger demand than the earlier ones.' : '') : '';
  return `${dayWord(a.day)} ${a.term} ${a.type}${a.reopening ? ' (reopening)' : ''}${a.amount != null ? `, $${Number.isInteger(a.amount) ? a.amount : a.amount.toFixed(1)}bn` : ''}: ${parts.join(', ')}.${tone}`;
}

// ---------- the Fed's plumbing ----------
export function parseCsvSeries(csv, keep = 400) {
  const out = [];
  for (const l of String(csv || '').trim().split('\n').slice(1)) {
    const c = l.split(','); let d = c[0].trim();
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d); if (us) d = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
    const v = num(c[c.length - 1]);                                   // a Cboe OHLC row: the close is the last column
    if (/^\d{4}-\d\d-\d\d$/.test(d) && v != null) out.push([d, v]);
  }
  return out.slice(-keep);
}
export function parseNyRates(J) {
  const rows = J && Array.isArray(J.refRates) ? J.refRates : [], out = {};
  for (const r of rows) {
    const t = String(r.type || '').toUpperCase(); if (!/^(SOFR|EFFR|OBFR|TGCR|BGCR)$/.test(t)) continue;
    const v = num(r.percentRate); if (v == null) continue;
    out[t.toLowerCase()] = { day: String(r.effectiveDate || '').slice(0, 10), rate: v, p1: num(r.percentPercentile1), p99: num(r.percentPercentile99), vol: num(r.volumeInBillions) };
    if (t === 'EFFR' && num(r.targetRateFrom) != null && num(r.targetRateTo) != null) out.target = { from: num(r.targetRateFrom), to: num(r.targetRateTo) };
  }
  return out.sofr || out.effr ? out : null;
}
export function parseRrp(J) {
  const ops = J && J.repo && Array.isArray(J.repo.operations) ? J.repo.operations : [];
  const rows = ops.filter((o) => /reverse/i.test(o.operationType || '') && num(o.totalAmtAccepted) != null).map((o) => [String(o.operationDate).slice(0, 10), r2(num(o.totalAmtAccepted) / 1e9)]).sort((a, b) => a[0].localeCompare(b[0]));
  return rows.length ? rows : null;
}
// The Treasury's cash at the Fed: the closing balance rows of the Daily Treasury Statement, $ billions, oldest first.
export function parseTga(J) {
  const rows = J && Array.isArray(J.data) ? J.data : [], out = [];
  for (const r of rows) {
    if (!/closing balance/i.test(r.account_type || '')) continue;
    const v = num(r.open_today_bal) ?? num(r.close_today_bal);       // the file carries the closing figure in open_today_bal
    if (v != null && /^\d{4}-\d\d-\d\d$/.test(r.record_date || '')) out.push([r.record_date, r2(v / 1000)]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
const lastOf = (s) => (s && s.length ? s[s.length - 1] : null);
const atOrBefore = (s, day) => { let x = null; for (const r of s || []) { if (r[0] <= day) x = r; else break; } return x; };
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
// rates + rrp + tga + the Fed's balance sheet and reserves ($ millions on FRED) -> one reading with its four-week change.
export function plumbingOf({ rates, rrp, tga, walcl, reserves, iorb }) {
  const out = {};
  if (rates) {
    out.rates = rates;
    const T = rates.target, s = rates.sofr, e = rates.effr, io = lastOf(iorb);
    if (io) out.iorb = { day: io[0], rate: io[1] };
    if (s && io) out.sofrOverIorb = r2((s.rate - io[1]) * 100);      // basis points; persistently above = reserves getting scarce
    if (T && e) out.effrInRange = r2((e.rate - T.from) / (T.to - T.from));
  }
  const W = lastOf(walcl), G = lastOf(tga), R = lastOf(rrp);
  if (R) out.rrp = { day: R[0], bn: R[1] };
  if (G) { out.tga = { day: G[0], bn: G[1] }; const g4 = atOrBefore(tga, addDays(G[0], -28)); if (g4) out.tga.chg4w = r2(G[1] - g4[1]); }
  const Rs = lastOf(reserves); if (Rs) { out.reserves = { day: Rs[0], bn: r2(Rs[1] / 1000) }; const r4 = atOrBefore(reserves, addDays(Rs[0], -28)); if (r4) out.reserves.chg4w = r2((Rs[1] - r4[1]) / 1000); }
  if (W) {
    out.balanceSheet = { day: W[0], bn: r2(W[1] / 1000) };
    const w4 = atOrBefore(walcl, addDays(W[0], -28)); if (w4) out.balanceSheet.chg4w = r2((W[1] - w4[1]) / 1000);
    const g = atOrBefore(tga, W[0]), r = atOrBefore(rrp, W[0]) || R;
    if (g && r) {
      out.netLiquidity = { day: W[0], bn: r2(W[1] / 1000 - g[1] - r[1]) };
      const d4 = addDays(W[0], -28), g4 = atOrBefore(tga, d4), rr4 = atOrBefore(rrp, d4);
      if (w4 && g4) out.netLiquidity.chg4w = r2((W[1] - w4[1]) / 1000 - (g[1] - g4[1]) - (rr4 ? r[1] - rr4[1] : 0));
    }
  }
  return Object.keys(out).length ? out : null;
}
const bn = (v) => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(2) + ' trillion' : (Math.abs(v) < 10 ? (Math.round(v * 10) / 10) : Math.round(v)) + ' billion'}`;
const chg = (v) => `${v >= 0 ? 'up' : 'down'} ${bn(Math.abs(v))}`;
export function plumbingLines(p) {
  if (!p) return [];
  const out = [];
  const N = p.netLiquidity;
  if (N) out.push(`Dollar liquidity (the Fed's balance sheet less the Treasury's cash and the reverse-repo balance): ${bn(N.bn)}${N.chg4w != null ? `, ${chg(N.chg4w)} over four weeks` : ''}${p.tga ? `; the Treasury holds ${bn(p.tga.bn)} at the Fed` : ''}${p.rrp ? `, reverse repo ${bn(p.rrp.bn)}` : ''}. A rough gauge of cash in the system, not a signal.`);
  const R = p.rates;
  if (R && R.sofr && R.target) {
    const tight = p.sofrOverIorb != null && p.sofrOverIorb >= 5 ? ' Funding is trading above the rate the Fed pays banks: a sign reserves are getting tighter.' : '';
    out.push(`Overnight funding: SOFR ${R.sofr.rate.toFixed(2)}%${R.effr ? `, fed funds ${R.effr.rate.toFixed(2)}%` : ''}, inside the Fed's ${R.target.from.toFixed(2)}-${R.target.to.toFixed(2)}% range${p.sofrOverIorb != null ? ` (SOFR ${p.sofrOverIorb >= 0 ? p.sofrOverIorb + ' bp over' : -p.sofrOverIorb + ' bp under'} the rate on reserves)` : ''}.${tight}`);
  }
  return out;
}

// ---------- what options price ----------
// A daily series -> the latest value, the one a week before, and its place among the last `n` readings (0 = lowest, 1 = highest).
export function gaugeOf(series, n = 252) {
  const L = lastOf(series); if (!L) return null;
  const win = series.slice(-n).map((r) => r[1]), below = win.filter((v) => v < L[1]).length;
  const w = atOrBefore(series, addDays(L[0], -7));
  return { day: L[0], value: r2(L[1]), weekAgo: w ? r2(w[1]) : null, pctile: win.length >= 60 ? r2(below / (win.length - 1 || 1)) : null, n: win.length };
}
export function volOf(S) {
  const out = {};
  for (const k of ['gvz', 'vix1d', 'vix9d', 'skew', 'vvix', 'ovx']) { const g = gaugeOf(S[k]); if (g) out[k] = g; }
  if (out.gvz) out.gvz.dayMovePct = r2(out.gvz.value / Math.sqrt(252));      // the one-day move a 30-day annual volatility implies
  if (S.fsi) { const g = gaugeOf(S.fsi); if (g) out.fsi = g; }
  return Object.keys(out).length ? out : null;
}
const place = (p) => p == null ? '' : p >= 0.9 ? ', near the top of its last year' : p <= 0.1 ? ', near the bottom of its last year' : `, higher than ${pct(p)} of the last year's readings`;
export function volLines(v, goldPx = null) {
  if (!v) return [];
  const out = [], g = v.gvz;
  if (g) out.push(`Gold options (Cboe GVZ, ${dayWord(g.day)}): ${g.value.toFixed(1)}% implied volatility${place(g.pctile)}${g.weekAgo != null ? `; ${g.weekAgo.toFixed(1)}% a week before` : ''}. That prices a typical day of about ±${g.dayMovePct.toFixed(1)}%${Number.isFinite(goldPx) ? ` (about $${Math.round(goldPx * g.dayMovePct / 100)})` : ''}: the size traders pay for, not a direction.`);
  const s = [];
  if (v.vix1d && v.vix9d) s.push(`one-day S&P volatility ${v.vix1d.value.toFixed(1)} against ${v.vix9d.value.toFixed(1)} for nine days${v.vix1d.value > v.vix9d.value ? ' (the next session is priced as the risky one)' : ''}`);
  if (v.skew) s.push(`SKEW ${Math.round(v.skew.value)}${place(v.skew.pctile).replace(/^, /, ' (') + (v.skew.pctile != null ? ')' : '')}`);
  if (v.fsi) s.push(`the OFR Financial Stress Index ${v.fsi.value.toFixed(2)}${v.fsi.value > 0 ? ' (above zero = more stress than usual)' : ' (below zero = calmer than usual)'}`);
  if (s.length) out.push(`Stress gauges: ${s.join('; ')}.`);
  return out;
}

// ---------- under the headline ----------
export const UNDER = [
  { key: 'trimPce', id: 'PCETRIM1M158SFRBDAL', name: 'Dallas Fed trimmed-mean PCE', unit: '% annualized, one month' },
  { key: 'stickyCpi', id: 'CORESTICKM159SFRBATL', name: 'Atlanta Fed sticky core CPI', unit: '% year on year' },
  { key: 'medianCpi', id: 'MEDCPIM158SFRBCLE', name: 'Cleveland Fed median CPI', unit: '% annualized, one month' },
  { key: 'wages', id: 'FRBATLWGT3MMAUMHWGO', name: 'Atlanta Fed wage tracker', unit: '% year on year' },
  { key: 'expInf1y', id: 'EXPINF1YR', name: 'Cleveland Fed one-year expected inflation', unit: '%' },
  { key: 'claims', id: 'ICSA', name: 'initial jobless claims', unit: 'a week' },
  { key: 'wei', id: 'WEI', name: 'the Weekly Economic Index', unit: '% growth, scaled to GDP' },
  { key: 'stlNow', id: 'STLENI', name: 'the St. Louis Fed GDP nowcast', unit: '% annualized' },
  { key: 'termPremium', id: 'THREEFYTP10', name: 'the 10-year term premium', unit: '%' },
];
export function underOf(S) {
  const out = {};
  for (const U of UNDER) { const s = S[U.key]; const L = lastOf(s); if (!L) continue; const p = s.length > 1 ? s[s.length - 2] : null; out[U.key] = { day: L[0], value: r2(L[1]), prev: p ? r2(p[1]) : null }; }
  return Object.keys(out).length ? out : null;
}
const mon = (ymd) => `${MONTHS[+ymd.slice(5, 7) - 1]}`;
export function underLines(u) {
  if (!u) return [];
  const out = [], f = (k, d = 1) => u[k] ? `${u[k].value.toFixed(d)}%${u[k].prev != null ? ` (${u[k].prev.toFixed(d)}% before)` : ''}` : null;
  const inf = [u.trimPce && `Dallas Fed trimmed-mean PCE ${f('trimPce')} annualized in ${mon(u.trimPce.day)}`, u.medianCpi && `Cleveland Fed median CPI ${f('medianCpi')} annualized in ${mon(u.medianCpi.day)}`,
    u.stickyCpi && `Atlanta Fed sticky core CPI ${f('stickyCpi')} over the year`, u.wages && `wage growth ${f('wages')} (Atlanta Fed tracker, ${mon(u.wages.day)})`].filter(Boolean);
  if (inf.length) out.push(`Inflation under the headline: ${inf.join('; ')}. Published measures that strip out the noisiest prices, not forecasts.`);
  const act = [u.claims && `jobless claims ${Math.round(u.claims.value).toLocaleString('en-US')} in the week to ${dayWord(u.claims.day)}${u.claims.prev != null ? ` (${Math.round(u.claims.prev).toLocaleString('en-US')} the week before)` : ''}`,
    u.wei && `the Weekly Economic Index ${f('wei', 2)}`, u.termPremium && `the 10-year term premium ${f('termPremium', 2)}`].filter(Boolean);
  if (act.length) out.push(`Activity, week by week: ${act.join('; ')}.`);
  return out;
}

// ---------- the collector ----------
async function getText(fetchFn, url, ms = 30000) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetchFn(url, { headers: { 'user-agent': 'Mozilla/5.0 (macro desk; public data)', accept: '*/*' }, signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); } finally { clearTimeout(to); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Reads everything; each part fails alone (`part` is hard-data.mjs's own: a failed part keeps the last good copy).
// `pace` = ms between Kalshi calls (a runner was answered 429 after about 13 calls in a row on 20 Nov 2026).
export async function collectMore({ now, fetchFn, part, at, pace = 700 }) {
  const csv = async (u, keep) => parseCsvSeries(await getText(fetchFn, u), keep);
  const soft = async (fn) => { try { return await fn(); } catch (e) { return null; } };
  await part('priced', async () => {
    const items = {}; let n = 0;
    for (const L of LADDERS) {
      const got = await soft(async () => readSeries(L, JSON.parse(await getText(fetchFn, SRC2.kalshiEvents(L.series, L.many ? 4 : 3)))));
      if (got && got.length) { items[L.key] = got; n++; }
      if (pace) await wait(pace);
    }
    return n ? { at, src: 'Kalshi', items } : null;
  });
  await part('auctionResults', async () => {
    const all = parseAuctionResults(JSON.parse((await getText(fetchFn, SRC2.auctioned, 45000)).replace(/^﻿/, '')));
    const cut = new Date((now - 10 * 86400) * 1000).toISOString().slice(0, 10), list = all.filter((a) => a.day >= cut).slice(0, 8);
    return list.length ? { at, list: list.map((a) => ({ ...a, text: resultText(a) })) } : null;
  });
  await part('plumbing', async () => {
    const from = new Date((now - 45 * 86400) * 1000).toISOString().slice(0, 10);
    const [rates, rrp, tga, walcl, reserves, iorb] = await Promise.all([
      soft(async () => parseNyRates(JSON.parse(await getText(fetchFn, SRC2.nyRates)))), soft(async () => parseRrp(JSON.parse(await getText(fetchFn, SRC2.nyRrp(from))))),
      soft(async () => parseTga(JSON.parse(await getText(fetchFn, SRC2.tga)))), soft(() => csv(SRC2.fred('WALCL'), 12)), soft(() => csv(SRC2.fred('WRESBAL'), 12)), soft(() => csv(SRC2.fred('IORB'), 5))]);
    const p = plumbingOf({ rates, rrp, tga, walcl, reserves, iorb });
    return p ? { at, ...p } : null;
  });
  await part('vol', async () => {
    const S = {};
    for (const [k, id] of [['gvz', 'GVZ'], ['vix1d', 'VIX1D'], ['vix9d', 'VIX9D'], ['skew', 'SKEW'], ['vvix', 'VVIX'], ['ovx', 'OVX']]) S[k] = await soft(() => csv(SRC2.cboe(id), 260));
    S.fsi = await soft(async () => { const t = await getText(fetchFn, SRC2.ofrFsi, 45000); return String(t).trim().split('\n').slice(1).map((l) => { const c = l.split(','); return [c[0], num(c[1])]; }).filter((r) => /^\d{4}-\d\d-\d\d$/.test(r[0]) && r[1] != null).slice(-260); });
    const v = volOf(S); return v ? { at, ...v } : null;
  });
  await part('under', async () => {
    const S = {};
    for (const U of UNDER) S[U.key] = await soft(() => csv(SRC2.fred(U.id), 3));
    const u = underOf(S); return u ? { at, ...u } : null;
  });
}

// ---------- the board: every part as a titled group of plain lines, with its source and its date ----------
// [{ k, title, src, at, lines }] for the Macro desk; a part that was not read gives no group. `goldPx` sizes gold's implied day.
export function board(hd, { goldPx = null } = {}) {
  if (!hd) return [];
  const out = [], day = (x) => (x && typeof x.at === 'string' ? x.at.slice(0, 16).replace('T', ' ') + ' UTC' : null);
  const add = (k, title, src, part, lines) => { if (part && lines.length) out.push({ k, title, src, at: day(part), lines }); };
  const P = hd.priced;
  if (P && P.items) {
    const one = (k) => (P.items[k] || [])[0];
    const prints = ['coreCpi', 'cpi', 'corePce', 'payrolls', 'u3', 'gdp'].map(one).filter(Boolean).map((x) => x.text.replace(/^./, (c) => c.toUpperCase()) + '.');
    const fed = (P.items.fed || []).filter((x) => x.likely).map((x) => `The Fed's target rate after ${x.period}: most likely ${x.likely[0].v.toFixed(2)}% upper bound (${pct(x.likely[0].p)})${x.likely[1] && x.likely[1].p >= 0.1 ? `, then ${x.likely[1].v.toFixed(2)}% (${pct(x.likely[1].p)})` : ''}.`);
    const rest = [...(P.items.recession || []).filter((x) => x.p >= 0.05), one('gold')].filter(Boolean).map((x) => x.text.replace(/^./, (c) => c.toUpperCase()) + '.');
    add('priced', 'What traders price for the next prints', 'Kalshi prediction market', P, [...prints, ...fed, ...rest, PRICED_TAIL]);
  }
  const A = hd.auctionResults;
  if (A && Array.isArray(A.list)) add('auctions', 'How the last Treasury auctions went', 'US Treasury (TreasuryDirect)', A, [...A.list.slice(0, 6).map((a) => a.text || resultText(a)),
    'Bid-to-cover = bids for each dollar sold; indirect bidders are mostly foreign and institutional buyers. Weak demand can lift yields. Context, not a signal.']);
  add('plumbing', 'The Fed\'s plumbing', 'New York Fed, US Treasury daily statement, FRED', hd.plumbing, plumbingLines(hd.plumbing));
  add('vol', 'What options price', 'Cboe index histories, Office of Financial Research', hd.vol, volLines(hd.vol, goldPx));
  add('under', 'Under the headline', 'Dallas, Atlanta, Cleveland and New York Fed series on FRED', hd.under, underLines(hd.under));
  return out;
}
// The priced print(s) for one release: `type` = the Week ahead's release type, `t` = its time (unix seconds). Only a ladder
// that closes within a day and a half of the release is the same print.
const BY_TYPE = { CPI: ['coreCpi', 'cpi'], PCE: ['corePce'], NFP: ['payrolls', 'u3'], GDP: ['gdp'], FOMC: ['fed'] };
export function pricedFor(hd, type, t) {
  const P = hd && hd.priced && hd.priced.items; if (!P || !BY_TYPE[type]) return null;
  const hits = [];
  for (const k of BY_TYPE[type]) for (const x of P[k] || []) { const c = Date.parse(x.close || '') / 1000; if (Number.isFinite(c) && Math.abs(c - t) <= 36 * 3600) hits.push(x.text); }
  return hits.length ? { text: `${hits.join('; ')}. ${PRICED_TAIL}`, short: hits.join('; ') } : null;
}
