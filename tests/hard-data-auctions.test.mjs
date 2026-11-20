// US Treasury auctions in the hard-to-find data (council/hard-data.mjs `parseAuctions`, `auctionText`, 20 Nov 2026): the parser on
// TreasuryDirect's and Fiscal Data's shapes, collect falling back between addresses and keeping its last good copy, the Week ahead
// placing each auction on its day, and the Macro desk drawing them as text. Offline: the fetch is a fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../council/hard-data.mjs';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;
// TreasuryDirect TA_WS "announced" shape (field names as documented; amounts in dollars as strings, dates with a time part)
const TD = [
  { cusip: '91282CPA3', securityType: 'Note', securityTerm: '2-Year', auctionDate: '2026-11-23T00:00:00', offeringAmount: '69000000000', tips: 'No', floatingRate: 'No', reopening: 'No', type: 'Note' },
  { cusip: '91282CPB1', securityType: 'Note', securityTerm: '5-Year', auctionDate: '2026-11-24T00:00:00', offeringAmount: '70000000000', tips: 'No', floatingRate: 'No', reopening: 'No', type: 'Note' },
  { cusip: '91282CPC9', securityType: 'Note', securityTerm: '7-Year', auctionDate: '2026-11-25T00:00:00', offeringAmount: '44000000000', tips: 'No', floatingRate: 'No', reopening: 'No', type: 'Note' },
  { cusip: '91282CPD7', securityType: 'Note', securityTerm: '2-Year', auctionDate: '2026-11-25T00:00:00', offeringAmount: '28000000000', tips: 'No', floatingRate: 'Yes', reopening: 'Yes', type: 'FRN Note' },
  { cusip: '912810UA4', securityType: 'Bond', securityTerm: '20-Year', auctionDate: '2026-11-18T00:00:00', offeringAmount: '16000000000', tips: 'No', floatingRate: 'No', reopening: 'Yes', type: 'Bond' },
  { cusip: '91282CPE5', securityType: 'Note', securityTerm: '10-Year', auctionDate: '2026-11-20T00:00:00', offeringAmount: '23000000000', tips: 'Yes', floatingRate: 'No', reopening: 'Yes', type: 'TIPS Note' },
  { cusip: '912797AA1', securityType: 'Bill', securityTerm: '13-Week', auctionDate: '2026-11-23T00:00:00', offeringAmount: '82000000000', type: 'Bill' },
  { cusip: '912797AB9', securityType: 'Bill', securityTerm: '52-Week', auctionDate: '2026-11-24T00:00:00', offeringAmount: '48000000000', type: 'Bill' },
  { cusip: '91282CPF2', securityType: 'Note', securityTerm: '3-Year', auctionDate: '2026-12-08T00:00:00', offeringAmount: '58000000000', type: 'Note' },
];
// Fiscal Data shape: { data: [{ security_type, security_term, auction_date, offering_amt }] } (amount here in millions)
const FD = { data: [
  { record_date: '2026-11-19', security_type: 'Note', security_term: '7-Year', reopening: 'No', cusip: '91282CPC9', offering_amt: '44000', auction_date: '2026-11-25' },
  { record_date: '2026-11-19', security_type: 'Bill', security_term: '26-Week', reopening: 'No', cusip: '912797AC7', offering_amt: '73000', auction_date: '2026-11-23' }] };

test('parseAuctions: notes, bonds, TIPS and FRNs in the window, bills left out but the 52-week, date formats and amounts', () => {
  const a = H.parseAuctions(TD, '2026-11-19', '2026-12-04');
  assert.deepEqual(a.map((x) => `${x.day} ${x.term} ${x.type}`), [
    '2026-11-20 10-Year TIPS', '2026-11-23 2-Year Note', '2026-11-24 52-Week Bill', '2026-11-24 5-Year Note',
    '2026-11-25 2-Year FRN', '2026-11-25 7-Year Note']);
  const seven = a.find((x) => x.term === '7-Year');
  assert.equal(seven.amount, 44); assert.equal(seven.cusip, '91282CPC9'); assert.equal(seven.reopening, false);
  assert.equal(H.auctionText(seven), 'US Treasury 7-Year Note auction, $44 billion');
  assert.equal(H.auctionText(a.find((x) => x.type === 'TIPS')), 'US Treasury 10-Year TIPS auction (reopening), $23 billion');
  // the 20-Year bond on 18 Nov and the 3-Year on 8 Dec fall outside the window
  assert.ok(!a.some((x) => x.term === '20-Year' || x.term === '3-Year'));
  assert.ok(H.parseAuctions(TD, '2026-11-17', '2026-11-19').some((x) => x.type === 'Bond' && x.amount === 16));
  // Fiscal Data's shape, amounts in millions; a US-style date; nothing parsable
  const f = H.parseAuctions(FD, '2026-11-19', '2026-12-04');
  assert.deepEqual(f, [{ day: '2026-11-25', term: '7-Year', type: 'Note', amount: 44, reopening: false, cusip: '91282CPC9' }]);
  assert.equal(H.parseAuctions([{ securityType: 'Note', securityTerm: '5-Year', auctionDate: '11/24/2026', offeringAmount: 70 }], '2026-11-19', '2026-12-04')[0].day, '2026-11-24');
  assert.deepEqual(H.parseAuctions({}, '2026-11-19', '2026-12-04'), []);
  assert.deepEqual(H.parseAuctions(null, '2026-11-19', '2026-12-04'), []);
  assert.equal(H.auctionText({ term: '30-Year', type: 'Bond', amount: null }), 'US Treasury 30-Year Bond auction');
});

const fake = (route) => async (url) => {
  const r = route(url);
  if (r == null) return { ok: false, status: 503, text: async () => '' };
  return { ok: true, status: 200, text: async () => r };
};
const now = T('2026-11-20T10:00:00Z');

test('collect: TreasuryDirect first, the next address when it is empty or down, the last good copy kept when all fail', async () => {
  const a = await H.collect({ now, fetchFn: fake((u) => /announced/.test(u) ? JSON.stringify(TD) : null) });
  assert.equal(a.sources.auctions, 'ok'); assert.equal(a.auctions.src, 'www.treasurydirect.gov');
  assert.ok(a.auctions.list.some((x) => x.term === '7-Year' && x.day === '2026-11-25'));
  // announced answers empty, upcoming is down: Fiscal Data is used
  const b = await H.collect({ now, fetchFn: fake((u) => /announced/.test(u) ? '[]' : /fiscaldata/.test(u) ? JSON.stringify(FD) : null) });
  assert.equal(b.auctions.src, 'api.fiscaldata.treasury.gov'); assert.equal(b.auctions.list.length, 1);
  // all fail: the copy of the run before stays, and the sources line says so
  const c = await H.collect({ now: now + 3600, fetchFn: fake(() => null), prev: a });
  assert.match(c.sources.auctions, /^failed: .*HTTP 503.*\(last good copy kept\)$/);
  assert.deepEqual(c.auctions, a.auctions);
  const d = await H.collect({ now, fetchFn: fake(() => null) });
  assert.equal(d.auctions, null); assert.match(d.sources.auctions, /^failed/);
  assert.ok(H.SRC.auctions[0].startsWith('https://www.treasurydirect.gov/TA_WS/securities/announced'));
});

test('the Week ahead puts each auction on its day as text, and names the notes in the day line', () => {
  const hd = { auctions: { list: H.parseAuctions(TD, '2026-11-19', '2026-12-04') } };
  const A = WA.build({ now, cal: [], rf: null, fc: null, v: null, hd });
  const mon = A.days.find((d) => d.day === '2026-11-23'), tue = A.days.find((d) => d.day === '2026-11-24'), wed = A.days.find((d) => d.day === '2026-11-25');
  assert.deepEqual(mon.auctions.map((x) => x.text), ['US Treasury 2-Year Note auction, $69 billion']);
  assert.deepEqual(tue.auctions.map((x) => x.term), ['52-Week', '5-Year']);
  assert.ok(wed.auctions.some((x) => x.text === 'US Treasury 7-Year Note auction, $44 billion'));
  assert.match(wed.line, /Treasury 2-Year FRN, 7-Year auction/);
  assert.ok(!/52-Week/.test(tue.line));
  // no hard data: every day has an empty list
  assert.ok(WA.build({ now, cal: [], rf: null, fc: null, v: null }).days.every((d) => Array.isArray(d.auctions) && !d.auctions.length));
});

test('the Macro desk draws the auctions as escaped text, and the probe workflow checks the sources', () => {
  const md = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.ok(md.includes("(d.auctions || []).length") && md.includes("'<li><b>' + esc(a.text) + '</b>"));
  const probe = fs.readFileSync(new URL('../scripts/macro-probe.mjs', import.meta.url), 'utf8');
  assert.ok(probe.includes('SRC.auctions') && probe.includes('parseAuctions'));
  const yml = fs.readFileSync(new URL('../.github/workflows/macro-probe.yml', import.meta.url), 'utf8');
  assert.ok(yml.includes('node scripts/macro-probe.mjs'));
});
