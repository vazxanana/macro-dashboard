// Hard-to-find data, second batch (council/hard-sources.mjs): the parsers on the shapes a GitHub runner read on 20 Nov 2026
// (scripts/macro-probe3.mjs), and the collector on a fake fetch. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../council/hard-sources.mjs';
import * as H from '../council/hard-data.mjs';

const mk = (label, last, bid, ask, vol = 100, extra = {}) => ({ yes_sub_title: label, last_price_dollars: last, yes_bid_dollars: bid, yes_ask_dollars: ask, volume_fp: String(vol), close_time: '2026-12-10T13:25:00Z', ...extra });
// Kalshi KXCPICORE-26NOV as read on 20 Nov 2026
const CORE = { events: [{ event_ticker: 'KXCPICORE-26NOV', title: 'Core CPI in November', sub_title: 'In Nov 2026', strike_period: 'November 2026', markets: [
  mk('Above 0.0%', '0.9500', '0.9400', '0.9500'), mk('Above 0.1%', '0.8700', '0.8600', '0.8700'), mk('Above 0.2%', '0.4600', '0.4500', '0.4600'),
  mk('Above 0.3%', '0.1200', '0.1200', '0.1300'), mk('Above 0.4%', '0.0100', '0.0000', '0.0100')] }] };
const L = (k) => S.LADDERS.find((x) => x.key === k);

test('a ladder becomes the most likely print and its chance', () => {
  const [x] = S.readSeries(L('coreCpi'), CORE);
  assert.equal(x.period, 'November 2026');
  assert.equal(x.close, '2026-12-10T13:25:00Z');
  // P(>0.1) 0.865, P(>0.2) 0.455, P(>0.3) 0.125: a 0.2 print 41%, a 0.3 print 33%
  assert.deepEqual(x.likely.slice(0, 2), [{ v: 0.2, p: 0.41 }, { v: 0.3, p: 0.33 }]);
  assert.match(x.text, /^core CPI for November 2026: most likely \+0\.2% \(41%\), then \+0\.3% \(33%\)$/);
  assert.ok(x.mid > 0.18 && x.mid < 0.2, 'the middle sits just under the 0.2 rung');
});

test('prices: a close bid and ask give their middle, a wide one the last trade; rungs never rise', () => {
  assert.equal(S.priceOf(mk('x', '0.3000', '0.4000', '0.5000')), 0.45);
  assert.equal(S.priceOf(mk('x', '0.3000', '0.0200', '0.6000')), 0.3);
  assert.equal(S.priceOf(mk('x', '0.0000', '0.0200', '0.6000')), 0.31, 'no trade yet: the wide middle');
  assert.equal(S.priceOf(mk('x', null, null, null)), null);
  assert.equal(S.thresholdOf(mk('Above -25,000')), -25000);
  assert.equal(S.thresholdOf(mk('Above $3523.99')), 3523.99);
  assert.equal(S.thresholdOf({ yes_sub_title: 'odd', floor_strike: 4.25 }), 4.25);
  const { rungs } = S.ladderOf([mk('Above 1', '0.90', '0.90', '0.91'), mk('Above 2', '0.95', '0.95', '0.96'), mk('Above 3', '0.20', '0.20', '0.21')]);
  assert.deepEqual(rungs.map((r) => r.p), [0.905, 0.905, 0.205]);
  assert.equal(S.quantile([{ x: 0, p: 0.9 }, { x: 10, p: 0.1 }], 0.5), 5);
  assert.equal(S.quantile([{ x: 0, p: 0.4 }, { x: 10, p: 0.1 }], 0.5), null, 'a ladder that never crosses the middle gives none');
});

test('payrolls, the Fed path, gold and the recession market read as on 20 Nov 2026', () => {
  const pay = { events: [{ event_ticker: 'KXPAYROLLS-26NOV', title: 'Jobs numbers in Nov 2026?', sub_title: 'In Nov 2026', markets: [
    mk('Above 70,000', '0.68', '0.65', '0.66'), mk('Above 80,000', '0.60', '0.56', '0.59'), mk('Above 90,000', '0.50', '0.45', '0.52'), mk('Above 100,000', '0.41', '0.39', '0.43'), mk('Above 125,000', '0.32', '0.28', '0.33')] }] };
  const [p] = S.readSeries(L('payrolls'), pay);
  assert.match(p.text, /^payrolls for November 2026: the middle of the ladder is about 90,000 jobs, 41% on more than 100,000$/);
  const fed = { events: [{ event_ticker: 'KXFED-26DEC', title: 'Fed funds rate after Dec 2026 meeting?', sub_title: 'On Dec 9, 2026', markets: [
    mk('Above 3.75%', '0.99', '0.99', '1.00'), mk('Above 4.00%', '0.95', '0.95', '0.96'), mk('Above 4.25%', '0.03', '0.03', '0.04'), mk('Above 4.50%', '0.01', '0.00', '0.01')] }] };
  const [f] = S.readSeries(L('fed'), fed);
  assert.equal(f.period, '9 Dec 2026');
  assert.deepEqual(f.likely[0], { v: 4.25, p: 0.92 });
  const gold = { events: [{ event_ticker: 'KXGOLDMON-26NOV3017', title: 'Gold price on Nov 30, 2026 at 5:00 PM EST?', sub_title: 'Nov 30, 2026 at 5:00 PM EST', markets: [
    mk('Above $3323.99', '0.85', '0.87', '0.92'), mk('Above $3403.99', '0.77', '0.73', '0.82'), mk('Above $3483.99', '0.70', '0.58', '0.63'), mk('Above $3523.99', '0.56', '0.49', '0.50'), mk('Above $3563.99', '0.39', '0.37', '0.39'), mk('Above $3683.99', '0.28', '0.11', '0.15'), mk('Above $3763.99', '0.12', '0.05', '0.07')] }] };
  const [g] = S.readSeries(L('gold'), gold);
  assert.equal(g.period, '30 Nov 2026');
  assert.ok(g.mid > 3500 && g.mid < 3530, String(g.mid));
  assert.ok(g.lo < g.mid && g.hi > g.mid);
  assert.match(g.text, /^gold on 30 Nov 2026: the middle of the ladder is about \$3,5\d\d, a 60% chance priced between \$3,\d\d\d and \$3,\d\d\d$/);
  const rec = { events: [{ event_ticker: 'KXRECSSNBER-27', title: 'Recession in 2027?', sub_title: 'In 2027', markets: [mk('Yes', '0.25', '0.24', '0.25', 1071981)] }] };
  assert.equal(S.readSeries(L('recession'), rec)[0].text, 'a US recession in 2027: 25%');
  // a thin ladder is not read
  assert.deepEqual(S.readSeries(L('cpi'), { events: [{ event_ticker: 'x', title: 'CPI in May', sub_title: 'In May 2027', markets: [mk('Above 0.1%', '0.5', '0.4', '0.5')] }] }), []);
  const lines = S.pricedLines({ items: { coreCpi: S.readSeries(L('coreCpi'), CORE), payrolls: [p], fed: [f], recession: S.readSeries(L('recession'), rec), gold: [g] } });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Priced for the next prints \(Kalshi\): core CPI for November 2026: most likely \+0\.2% \(41%\).*; payrolls for November 2026.*not a consensus survey and not a forecast of ours\.$/);
  assert.match(lines[1], /after 9 Dec 4\.25% \(92%\)/);
  for (const l of lines) assert.ok(!/\bedge\b|will (rise|fall)/i.test(l));
});

// TreasuryDirect "auctioned", the fields a runner read on 20 Nov 2026 (no auctionDate; awards by bidder group)
const row = (day, type, term, hy, btc, ind, dir, pd, off, re = 'No') => ({ competitiveAuctionCloseDate: day + 'T00:00:00', competitiveAuctionCloseDateYear: day.slice(0, 4), announcementDate: '2026-01-01T00:00:00',
  type, securityType: /Bond/.test(type) ? 'Bond' : 'Note', securityTerm: term, highYield: hy, medianYield: '', bidToCoverRatio: btc, offeringAmount: off, reopening: re, floatingRate: 'No',
  indirectBiddersCompetitiveParAwarded: String(ind), directBiddersCompetitiveParAwarded: String(dir), primaryDealersCompetitiveParAwarded: String(pd), grandTotalParAwarded: String(ind + dir + pd + 1e8) });
const TD = [row('2026-11-18', 'Bond', '20-Year', '5.459', '2.63', 9.5e9, 4.2e9, 2.1e9, '16000000000'), row('2026-11-12', 'Note', '10-Year', '5.020', '2.46', 28e9, 6e9, 8e9, '42000000000'),
  row('2026-10-21', 'Bond', '19-Year 10-Month', '5.469', '2.73', 9e9, 2e9, 2e9, '13000000000', 'Yes'), row('2026-10-14', 'Note', '9-Year 10-Month', '5.300', '2.77', 30e9, 5e9, 4e9, '39000000000', 'Yes'),
  row('2026-09-10', 'Note', '9-Year 11-Month', '5.100', '2.55', 27e9, 6e9, 6e9, '39000000000', 'Yes'),
  { competitiveAuctionCloseDate: '2026-11-17T00:00:00', type: 'Bill', securityType: 'Bill', securityTerm: '52-Week', highYield: '', bidToCoverRatio: '3.1', offeringAmount: '54000000000' },
  { competitiveAuctionCloseDate: '2026-11-24T00:00:00', type: 'Note', securityType: 'Note', securityTerm: '5-Year', highYield: '', bidToCoverRatio: '', offeringAmount: '70000000000' }];

test('auction results: the day, the shares by bidder group, and each auction against the earlier ones of its tenor', () => {
  const A = S.parseAuctionResults(TD);
  assert.deepEqual(A.map((a) => `${a.day} ${a.tenor} ${a.type}`), ['2026-11-18 20 Bond', '2026-11-12 10 Note', '2026-10-21 20 Bond', '2026-10-14 10 Note', '2026-09-10 10 Note'], 'bills and auctions not held yet are left out');
  const ten = A[1];
  assert.equal(ten.yield, 5.02); assert.equal(ten.btc, 2.46); assert.equal(ten.amount, 42);
  assert.equal(ten.indirect, 0.667); assert.equal(ten.dealers, 0.19); assert.equal(ten.direct, 0.143);
  assert.equal(ten.btcPrior, 2.66, 'the two earlier 10-years (reopenings counted as 10-years) averaged 2.66'); assert.equal(ten.priorN, 2);
  assert.equal(S.tenorOf('29-Year 10-Month'), 30); assert.equal(S.tenorOf('2-Year'), 2); assert.equal(S.tenorOf('1-Year 11-Month'), 2);
  const t = S.resultText(ten);
  assert.equal(t, '12 Nov 10-Year Note, $42bn: high yield 5.020%, bid-to-cover 2.46 (the 2 before averaged 2.66), indirect bidders took 67% (73% before), dealers took 19%. Softer demand than the earlier ones.');
  assert.match(S.resultText(A[0]), /20-Year Bond, \$16bn: high yield 5\.459%, bid-to-cover 2\.63 \(the one before had 2\.73\)/);
  assert.deepEqual(S.parseAuctionResults(null), []);
});

const RATES = { refRates: [{ effectiveDate: '2026-11-20', type: 'SOFRAI', average30day: 3.92 }, { effectiveDate: '2026-11-19', type: 'EFFR', percentRate: 3.88, percentPercentile1: 3.85, percentPercentile99: 3.9, targetRateFrom: 3.75, targetRateTo: 4.0, volumeInBillions: 100 },
  { effectiveDate: '2026-11-19', type: 'SOFR', percentRate: 3.91, percentPercentile1: 3.85, percentPercentile99: 3.98, volumeInBillions: 3161 }] };
const RRP = { repo: { operations: [{ operationDate: '2026-11-20', operationType: 'Reverse Repo', totalAmtAccepted: 401000000 }, { operationDate: '2026-10-21', operationType: 'Reverse Repo', totalAmtAccepted: 2401000000 }] } };
const TGA = { data: [{ record_date: '2026-11-18', account_type: 'Treasury General Account (TGA) Closing Balance', close_today_bal: 'null', open_today_bal: '892310' },
  { record_date: '2026-11-18', account_type: 'Treasury General Account (TGA) Opening Balance', close_today_bal: 'null', open_today_bal: '921222' },
  { record_date: '2026-10-21', account_type: 'Treasury General Account (TGA) Closing Balance', close_today_bal: 'null', open_today_bal: '842310' }] };

test('the plumbing: rates against the range, Treasury cash, net liquidity and its four-week change', () => {
  const rates = S.parseNyRates(RATES);
  assert.deepEqual(rates.target, { from: 3.75, to: 4 }); assert.equal(rates.sofr.rate, 3.91); assert.equal(rates.sofrai, undefined);
  assert.deepEqual(S.parseRrp(RRP), [['2026-10-21', 2.4], ['2026-11-20', 0.4]]);
  assert.deepEqual(S.parseTga(TGA), [['2026-10-21', 842.31], ['2026-11-18', 892.31]], 'closing balances only, $ billions');
  const walcl = S.parseCsvSeries('observation_date,WALCL\n2026-10-21,6791452\n2026-11-11,6758867\n2026-11-18,6741452\n');
  const p = S.plumbingOf({ rates, rrp: S.parseRrp(RRP), tga: S.parseTga(TGA), walcl, reserves: [['2026-11-18', 2979656]], iorb: [['2026-11-20', 3.9]] });
  assert.equal(p.sofrOverIorb, 1); assert.equal(p.effrInRange, 0.52);
  // 6741.45 - 892.31 - 2.4 (the reverse-repo reading at or before the balance-sheet day)
  assert.equal(p.netLiquidity.bn, 5846.74);
  assert.equal(p.netLiquidity.chg4w, -100, 'balance sheet down 50, Treasury cash up 50');
  const lines = S.plumbingLines(p);
  assert.match(lines[0], /^Dollar liquidity .*: \$5\.85 trillion, down \$100 billion over four weeks; the Treasury holds \$892 billion at the Fed, reverse repo \$0\.4 billion\. A rough gauge of cash in the system, not a signal\.$/);
  assert.match(lines[1], /^Overnight funding: SOFR 3\.91%, fed funds 3\.88%, inside the Fed's 3\.75-4\.00% range \(SOFR 1 bp over the rate on reserves\)\.$/);
  assert.match(S.plumbingLines({ ...p, sofrOverIorb: 7 })[1], /reserves are getting tighter/);
  assert.equal(S.plumbingOf({}), null);
});

test('what options price: gold volatility as a daily move, with its place in the last year', () => {
  const days = []; for (let i = 0; i < 260; i++) { const d = new Date(Date.UTC(2026, 1, 1) + i * 86400e3); days.push(`${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()},${(15 + i * 0.05).toFixed(6)}`); }
  const gvz = S.parseCsvSeries('DATE,GVZ\n' + days.join('\n'), 260);
  assert.match(gvz[0][0], /^2026-02-0\d$/, 'US dates are read as ISO');
  const ohlc = S.parseCsvSeries('DATE,OPEN,HIGH,LOW,CLOSE\n11/19/2026,17.88,33.08,17.08,32.06\n');
  assert.deepEqual(ohlc, [['2026-11-19', 32.06]], 'an OHLC row gives its close');
  const v = S.volOf({ gvz, vix1d: ohlc, vix9d: [['2026-11-19', 29.26]] });
  assert.equal(v.gvz.value, 27.95); assert.equal(v.gvz.pctile, 1); assert.equal(v.gvz.dayMovePct, 1.76);
  const [a, b] = S.volLines(v, 3575);
  assert.match(a, /^Gold options \(Cboe GVZ, \d+ \w+\): 27\.\d% implied volatility, near the top of its last year; 27\.6% a week before\. That prices a typical day of about ±1\.8% \(about \$63\): the size traders pay for, not a direction\.$/);
  assert.match(b, /one-day S&P volatility 32\.1 against 29\.3 for nine days \(the next session is priced as the risky one\)/);
  assert.equal(S.volOf({}), null);
});

test('under the headline: the published underlying-inflation measures as plain lines', () => {
  const u = S.underOf({ trimPce: [['2026-08-01', 1.96], ['2026-09-01', 2.84]], medianCpi: [['2026-10-01', 3.66]], claims: [['2026-11-07', 202000], ['2026-11-14', 203000]] });
  assert.deepEqual(u.trimPce, { day: '2026-09-01', value: 2.84, prev: 1.96 });
  const l = S.underLines(u);
  assert.match(l[0], /^Inflation under the headline: Dallas Fed trimmed-mean PCE 2\.8% \(2\.0% before\) annualized in September; Cleveland Fed median CPI 3\.7% annualized in October\./);
  assert.match(l[1], /jobless claims 203,000 in the week to 14 Nov \(202,000 the week before\)/);
});

test('the collector: each new part alone, a failed part keeps its last copy, the history records what is priced', async () => {
  const now = Date.parse('2026-11-20T18:00:00Z') / 1000;
  const fake = (drop = []) => async (u) => {
    const ok = (t) => ({ ok: true, status: 200, text: async () => (typeof t === 'string' ? t : JSON.stringify(t)) });
    if (drop.some((d) => u.includes(d))) return { ok: false, status: 503, text: async () => '' };
    if (u.includes('KXCPICORE')) return ok(CORE);
    if (u.includes('kalshi')) return ok({ events: [] });
    if (u.includes('auctioned')) return ok(TD);
    if (u.includes('newyorkfed.org/api/rates')) return ok(RATES);
    if (u.includes('reverserepo')) return ok(RRP);
    if (u.includes('operating_cash_balance')) return ok(TGA);
    if (u.includes('id=WALCL')) return ok('observation_date,WALCL\n2026-10-21,6791452\n2026-11-18,6741452\n');
    if (u.includes('GVZ_History')) return ok('DATE,GVZ\n11/18/2026,28.04\n11/19/2026,28.70\n');
    if (u.includes('id=ICSA')) return ok('observation_date,ICSA\n2026-11-07,202000\n2026-11-14,203000\n');
    return { ok: false, status: 404, text: async () => '' };
  };
  const a = await H.collect({ now, fetchFn: fake() });
  for (const k of ['priced', 'auctionResults', 'plumbing', 'vol', 'under']) assert.equal(a.sources[k], 'ok', k + ': ' + a.sources[k]);
  assert.equal(a.priced.items.coreCpi[0].likely[0].v, 0.2);
  assert.equal(a.auctionResults.list.length, 2, 'the auctions of the last ten days');
  assert.match(a.auctionResults.list[0].text, /^18 Nov 20-Year Bond/);
  assert.equal(a.vol.gvz.value, 28.7); assert.equal(a.under.claims.value, 203000);
  const h = a.hist[a.hist.length - 1];
  assert.deepEqual(h.priced, { coreCpi: { period: 'November 2026', v: 0.2, p: 0.41 } }); assert.equal(h.gvz, 28.7);
  const b = await H.collect({ now: now + 3600, fetchFn: fake(['kalshi', 'auctioned']), prev: a });
  assert.match(b.sources.priced, /^failed.*last good copy kept/); assert.deepEqual(b.priced, a.priced);
  assert.match(b.sources.auctionResults, /^failed/); assert.equal(b.sources.plumbing, 'ok');
  assert.equal(b.hist[b.hist.length - 1].priced, undefined, 'a kept copy is never recorded again as if new');
  // a week later the same print is priced higher: one plain line
  const later = { hist: [{ at: '2026-11-13T18:00:00Z', priced: { coreCpi: { period: 'November 2026', v: 0.2, p: 0.3 } } }, { at: '2026-11-20T18:00:00Z', priced: h.priced }] };
  const mv = H.moves(later, now).filter((m) => m.kind === 'priced');
  assert.equal(mv.length, 1);
  assert.equal(mv[0].text, "Kalshi's chance of a +0.2% print for core CPI (November 2026): 41% now, 30% a week ago. What traders pay, not a forecast of ours.");
});

test('the module fetches only the public sources it names and trades nothing', () => {
  const src = fs.readFileSync(new URL('../council/hard-sources.mjs', import.meta.url), 'utf8');
  assert.ok(!/^import /m.test(src), 'no imports: pure parsers and one collector');
  assert.ok(!/process\.env|child_process|writeFile/.test(src));
  const hosts = [...src.matchAll(/https:\/\/([a-z0-9.-]+)\//g)].map((m) => m[1]);
  assert.deepEqual([...new Set(hosts)].sort(), ['api.elections.kalshi.com', 'api.fiscaldata.treasury.gov', 'apps.bea.gov', 'cdn.cboe.com', 'fred.stlouisfed.org', 'markets.newyorkfed.org', 'www.bls.gov', 'www.financialresearch.gov', 'www.treasurydirect.gov']);
});

test('the nowcast beside what traders price: the same print, or the two differ; nothing once the month has printed', () => {
  const hd = { nowcast: { months: [{ month: '2026-10', now: { corePce: 0.27 }, actual: {} }, { month: '2026-11', now: { coreCpi: 0.21, cpi: 0.07 }, actual: { coreCpi: 0.2 } }] } };
  assert.equal(S.besideNowcast(hd, { key: 'corePce', period: 'October 2026', likely: [{ v: 0.3, p: 0.88 }] }), ' The Cleveland Fed nowcast is +0.27%, which rounds to the same print.');
  assert.equal(S.besideNowcast(hd, { key: 'cpi', period: 'November 2026', likely: [{ v: -0.1, p: 0.44 }] }), ' The Cleveland Fed nowcast is +0.07%, which rounds to +0.1%: the model and the traders differ.');
  assert.equal(S.besideNowcast(hd, { key: 'coreCpi', period: 'November 2026', likely: [{ v: 0.2, p: 0.4 }] }), '', 'already printed');
  assert.equal(S.besideNowcast(hd, { key: 'payrolls', period: 'November 2026', mid: 90000 }), '');
  assert.equal(S.besideNowcast(null, { key: 'cpi', period: 'November 2026', likely: [{ v: 0.1, p: 0.4 }] }), '');
  const B = S.board({ at: '2026-11-20T18:00:00Z', nowcast: hd.nowcast, priced: { at: '2026-11-20T18:00:00Z', items: { corePce: [{ key: 'corePce', period: 'October 2026', likely: [{ v: 0.3, p: 0.88 }], text: 'core PCE for October 2026: most likely +0.3% (88%)' }] } } });
  assert.equal(B[0].lines[0], 'Core PCE for October 2026: most likely +0.3% (88%). The Cleveland Fed nowcast is +0.27%, which rounds to the same print.');
});

const ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART;TZID=US-Eastern:20261204T083000', 'SUMMARY:Employment Situation', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=US-Eastern:20261210T083000', 'SUMMARY:Consumer Price Index', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=US-Eastern:20261218T100000', 'SUMMARY:State Employment and Unemployment (Monthly)', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=US-Eastern:20270702T083000', 'SUMMARY:Employment Situation', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const BEA = { 'Gross Domestic Product': { release_dates: ['2026-11-25T13:30:00+00:00', '2026-12-23T13:30:00+00:00'] }, 'Personal Income and Outlays': { release_dates: ['2026-11-25T13:30:00+00:00'] }, 'Gross Domestic Product by State and Personal Income by State': { release_dates: ['2026-12-22T13:30:00+00:00'] } };

test('the official calendars: New York times become UTC, only the releases the desk follows, each on its New York day', () => {
  assert.equal(new Date(S.nyToUnix(2026, 12, 4, 8, 30) * 1000).toISOString(), '2026-12-04T13:30:00.000Z', 'winter: UTC-5');
  assert.equal(new Date(S.nyToUnix(2027, 7, 2, 8, 30) * 1000).toISOString(), '2027-07-02T12:30:00.000Z', 'summer: UTC-4');
  const all = S.parseBlsIcs(ICS, 0, 9e9);
  assert.deepEqual(all.map((e) => [e.day, e.type]), [['2026-12-04', 'NFP'], ['2026-12-10', 'CPI'], ['2027-07-02', 'NFP']], 'the state release is not one the desk follows');
  const from = Date.parse('2026-11-18T00:00:00Z') / 1000, to = Date.parse('2026-12-11T00:00:00Z') / 1000;
  const list = S.mergeOfficial(S.parseBlsIcs(ICS, from, to), S.parseBea(BEA, from, to));
  assert.deepEqual(list.map(S.officialText), ['Wed 25 Nov, 13:30 UTC: Gross Domestic Product (BEA)', 'Wed 25 Nov, 13:30 UTC: Personal income and outlays (PCE) (BEA)',
    'Fri 4 Dec, 13:30 UTC: Jobs report (Employment Situation) (BLS)', 'Thu 10 Dec, 13:30 UTC: Consumer Price Index (BLS)']);
  const hd = { official: { read: ['BLS', 'BEA'], from: '2026-11-18', to: '2026-12-11', list } };
  const T = (iso) => Date.parse(iso) / 1000;
  assert.equal(S.onOfficial(hd, 'PCE', T('2026-11-25T13:30:00Z')), true);
  assert.equal(S.onOfficial(hd, 'PCE', T('2026-11-26T13:30:00Z')), false, 'listed for a day the agency does not have');
  assert.equal(S.onOfficial(hd, 'CPI', T('2026-12-10T13:30:00Z')), true);
  assert.equal(S.onOfficial(hd, 'ISM', T('2026-12-01T15:00:00Z')), null, 'not an agency release: nothing is said');
  assert.equal(S.onOfficial({ official: { ...hd.official, read: ['BEA'] } }, 'CPI', T('2026-12-09T13:30:00Z')), null, 'the BLS file was not read: nothing is said');
  assert.equal(S.onOfficial(hd, 'CPI', T('2027-01-13T13:30:00Z')), null, 'outside the window read');
  assert.equal(S.onOfficial(null, 'CPI', 0), null);
});

test('the official calendar in the collector: one agency failing still leaves the other', async () => {
  const now = Date.parse('2026-11-20T18:00:00Z') / 1000;
  const ok = (t) => ({ ok: true, status: 200, text: async () => (typeof t === 'string' ? t : JSON.stringify(t)) });
  const a = await H.collect({ now, fetchFn: async (u) => (u.includes('bls.gov') ? ok(ICS) : u.includes('bea.gov') ? ok(BEA) : { ok: false, status: 404, text: async () => '' }) });
  assert.equal(a.sources.official, 'ok'); assert.deepEqual(a.official.read, ['BLS', 'BEA']);
  assert.deepEqual(a.official.list.map((e) => e.type), ['GDP', 'PCE', 'NFP', 'CPI']);
  const g = S.board(a).find((x) => x.k === 'official');
  assert.equal(g.lines[0], 'Wed 25 Nov, 13:30 UTC: Gross Domestic Product (BEA)'); assert.match(g.src, /^BLS and BEA/);
  const b = await H.collect({ now, fetchFn: async (u) => (u.includes('bea.gov') ? ok(BEA) : { ok: false, status: 503, text: async () => '' }) });
  assert.deepEqual(b.official.read, ['BEA']);
  const c = await H.collect({ now, fetchFn: async () => ({ ok: false, status: 503, text: async () => '' }), prev: a });
  assert.match(c.sources.official, /^failed.*last good copy kept/); assert.deepEqual(c.official, a.official);
});

test('more ladders: claims ("At least"), ISM, ADP, and the Bank of Japan decision as named outcomes', () => {
  const mk = (label, bid, ask) => ({ yes_sub_title: label, yes_bid_dollars: bid, yes_ask_dollars: ask, last_price_dollars: 0, close_time: '2026-11-25T13:29:00Z' });
  const claims = S.readEvent(L('claims'), { event_ticker: 'KXJOBLESSCLAIMS-26NOV25', title: 'Initial jobless claims for the week ending November 21, 2026', sub_title: 'For the week ending Nov 21, 2026',
    markets: [mk('At least 195,000', 0.71, 0.8), mk('At least 200,000', 0.49, 0.51), mk('At least 205,000', 0.28, 0.35), mk('At least 210,000', 0.08, 0.1)] });
  assert.equal(S.thresholdOf({ yes_sub_title: 'At least 200,000' }), 200000);
  assert.equal(claims.mid, 200000);
  assert.match(claims.text, /^initial jobless claims for the week to 21 Nov 2026: the middle of the ladder is about 200,000$/);
  const ism = S.readEvent(L('ism'), { event_ticker: 'KXISMPMI-26NOV', title: 'ISM Manufacturing PMI in November', sub_title: 'In Nov 2026',
    markets: [mk('At least 54', 0.81, 0.91), mk('At least 55', 0.58, 0.64), mk('At least 56', 0.29, 0.38)] });
  assert.match(ism.text, /^the ISM manufacturing index for November 2026: the middle of the ladder is about 55\.\d \(above 50 = growing\)$/);
  const adp = S.readEvent(L('adp'), { event_ticker: 'KXADP-26NOV', title: 'ADP employment change in Nov 2026?', sub_title: 'In Nov 2026',
    markets: [mk('Above 50000', 0.81, 0.88), mk('Above 75000', 0.58, 0.67), mk('Above 100000', 0.3, 0.38)] });
  assert.match(adp.text, /^ADP private payrolls for November 2026: the middle of the ladder is about \d+,000 jobs$/);
  const boj = S.readEvent(L('boj'), { event_ticker: 'KXCBDECISIONJAPAN-26DEC17', title: 'Bank of Japan rate decision in December', sub_title: 'Dec 17, 2026 meeting',
    markets: [mk('Cut 25bps', 0, 0.01), mk('Maintain current rate', 0.1, 0.11), mk('Hike 25bps', 0.86, 0.87), mk('<b>Hike</b> more than 25bps', 0, 0.01)] });
  assert.equal(boj.text, 'the Bank of Japan\'s decision on 17 Dec 2026: most likely "Hike 25bps" (87%), then "Maintain current rate" (11%)');
  assert.ok(boj.options.every((o) => !/[<>]/.test(o.label)));
  assert.equal(S.readEvent(L('boj'), { markets: [mk('Hike 25bps', 0.86, 0.87)] }), null, 'one outcome alone is not read');
  const hd = { at: '2026-11-20T19:00:00Z', priced: { at: '2026-11-20T19:00:00Z', items: { claims: [claims], ism: [ism], adp: [adp], boj: [boj] } } };
  const g = S.board(hd).find((x) => x.k === 'priced');
  assert.ok(g.lines.some((l) => /^Initial jobless claims/.test(l)) && g.lines.some((l) => /^The Bank of Japan/.test(l)));
  ism.close = '2026-12-01T14:59:00Z';
  assert.match(S.pricedFor(hd, 'ISM', Date.parse('2026-12-01T15:00:00Z') / 1000).short, /ISM manufacturing index/);
});
