// Hard-to-find data (council/hard-data.mjs, 20 Nov 2026): the parsers on the shapes the probe saw from a GitHub runner on
// 20 Nov 2026 (scripts/macro-probe.mjs), the fetch with a fake network, a failed source keeping its last copy, and the Week ahead's
// use of it. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../council/hard-data.mjs';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const ser = (name, vals, labels) => ({ seriesname: name, data: vals.map((v, i) => ({ value: v == null ? '' : String(v), tooltext: `${name}{br}${labels[i]}` })) });
const NOWCAST = [
  { chart: { subcaption: '2026-09', _comment: '2026-11-19 00:00' }, dataset: [ser('Core PCE Inflation', [0.2, 0.21], ['a', 'b']), ser('Actual Core PCE Inflation', [null, 0.22], ['a', 'b'])] },
  { chart: { subcaption: '2026-10', _comment: '2026-11-19 00:00' }, categories: [{ category: [{ label: '11/18' }, { label: '11/19' }] }], dataset: [
    ser('CPI Inflation', [0.24, 0.242106165709167], ['11/06', '11/09']), ser('Core CPI Inflation', [0.21, 0.211437433436468], ['11/06', '11/09']),
    ser('PCE Inflation', [0.30, 0.305122016244831], ['11/18', '11/19']), ser('Core PCE Inflation', [0.26, 0.266892604972387], ['11/18', '11/19']),
    ser('Actual CPI Inflation', [null, 0.350284569042936], ['', '11/10']), ser('Actual Core CPI Inflation', [null, 0.296256078560964], ['', '11/10']),
    ser('Actual PCE Inflation', [null, null], ['', '']), ser('Actual Core PCE Inflation', [null, null], ['', ''])] },
  { chart: { subcaption: '2026-11', _comment: '2026-11-19 00:00' }, dataset: [ser('CPI Inflation', [0.0652828566316712], ['11/19']), ser('Core CPI Inflation', [0.21114452794251], ['11/19']),
    ser('PCE Inflation', [0.173306112792956], ['11/19']), ser('Core PCE Inflation', [0.263952783409193], ['11/19'])] },
];
const KALSHI = { markets: [
  { ticker: 'KXFEDDECISION-26DEC-C25', yes_sub_title: 'Cut 25bps', last_price_dollars: '0.0100', yes_bid_dollars: '0.0000', yes_ask_dollars: '0.0100', open_interest_fp: '915335.44' },
  { ticker: 'KXFEDDECISION-26DEC-H25', yes_sub_title: 'Hike 25bps', last_price_dollars: '0.9200', yes_bid_dollars: '0.9100', yes_ask_dollars: '0.9200', open_interest_fp: '2351756.25' },
  { ticker: 'KXFEDDECISION-26DEC-H0', yes_sub_title: 'Fed maintains rate', last_price_dollars: '0.0400', yes_bid_dollars: '0.0400', yes_ask_dollars: '0.0500', open_interest_fp: '3723991.08' }] };
const POLY = { events: [
  { slug: 'how-many-dissent', title: 'How many dissent at the December Fed meeting?', endDate: '2026-12-10T04:59:00Z', markets: [] },
  { slug: 'fed-decision-in-december-2026', title: 'Fed Decision in December?', endDate: '2026-12-10T04:59:00Z', markets: [
    { groupItemTitle: '25 bps increase', outcomePrices: '["0.925", "0.075"]' }, { groupItemTitle: 'No change', outcomePrices: '["0.037", "0.963"]' }] }] };
const FEDCAL = { events: [
  { title: 'Speech - Governor Christopher J. Waller', time: '8:25 a.m.', month: '2026-11', days: '24', type: 'Speeches', description: 'Welcoming &quot;Remarks&quot;' },
  { title: 'Speech - Chairman Kevin Warsh', time: '12:00 p.m.', month: '2026-11', days: '24', type: 'Speeches', description: 'Outlook' },
  { title: 'Board meeting', time: '', month: '2026-11', days: '24', type: 'Board' },
  { title: 'FOMC Minutes', time: '2:00 p.m.', month: '2026-11', days: '25', type: 'FOMC' },
  { title: 'Old speech', time: '9:00 a.m.', month: '2026-10', days: '2', type: 'Speeches' }] };

test('Cleveland Fed nowcast: the latest value of each series per target month, the actual prints apart', () => {
  const n = H.parseNowcast(NOWCAST);
  const oct = n.months.find((m) => m.month === '2026-10');
  assert.deepEqual(oct.now, { cpi: 0.24, coreCpi: 0.21, pce: 0.31, corePce: 0.27 });
  assert.deepEqual(oct.actual, { cpi: 0.35, coreCpi: 0.3 });
  assert.equal(oct.asOf, '2026-11-19');
  assert.equal(n.months[n.months.length - 1].month, '2026-11');
  assert.equal(H.parseNowcast({}), null);
});

test('GDPNow, Fed odds and the Fed calendar parse the probe\'s shapes', () => {
  assert.deepEqual(H.parseGdpNow('observation_date,GDPNOW\n2026-07-01,3.2721\n2026-10-01,3.2093\n'), { quarter: '2026 Q4', value: 3.21, prev: 3.27 });
  const k = H.parseKalshi(KALSHI);
  assert.equal(k[0].label, 'Hike 25bps'); assert.equal(k[0].p, 0.92); assert.equal(k.find((m) => /maintains/.test(m.label)).p, 0.05);
  const M = H.nextFomc(T('2026-11-20T10:00:00Z'));
  assert.equal(M.day, '2026-12-09'); assert.equal(M.kalshi, 'KXFEDDECISION-26DEC');
  const p = H.parsePoly(POLY, M.t);
  assert.equal(p.markets[0].label, '25 bps increase'); assert.equal(p.markets[0].p, 0.93);
  const line = H.oddsLine({ meeting: M.day, kalshi: k, polymarket: p });
  assert.ok(/Kalshi Hike 25bps 92%/.test(line) && /Polymarket 25 bps increase 93%/.test(line) && /not a forecast of ours/.test(line));
  const f = H.parseFedCal(FEDCAL, '2026-11-23', '2026-11-27');
  assert.deepEqual(f.map((e) => e.title), ['Speech - Governor Christopher J. Waller', 'Speech - Chairman Kevin Warsh', 'FOMC Minutes']);
  assert.equal(f[0].topic, 'Welcoming "Remarks"');
});

test('collect: every source read through the injected fetch; a failing one keeps its last good copy and says so', async () => {
  const body = { nowcast: JSON.stringify(NOWCAST), gdpnow: 'observation_date,GDPNOW\n2026-10-01,3.2093\n', fedcal: '﻿' + JSON.stringify(FEDCAL), kalshi: JSON.stringify(KALSHI), poly: JSON.stringify(POLY) };
  const fake = (fail = []) => async (url) => {
    const k = /clevelandfed/.test(url) ? 'nowcast' : /GDPNOW/.test(url) ? 'gdpnow' : /federalreserve/.test(url) ? 'fedcal' : /kalshi/.test(url) ? 'kalshi' : 'poly';
    if (fail.includes(k)) return { ok: false, status: 503, text: async () => '' };
    return { ok: true, status: 200, text: async () => body[k] };
  };
  const now = T('2026-11-20T10:00:00Z');
  const a = await H.collect({ now, fetchFn: fake() });
  assert.deepEqual(Object.values(a.sources), ['ok', 'ok', 'ok', 'ok']);
  assert.equal(a.odds.meeting, '2026-12-09'); assert.ok(a.odds.line);
  assert.equal(a.fed.events.length, 3);
  const b = await H.collect({ now: now + 3600, fetchFn: fake(['nowcast']), prev: a });
  assert.match(b.sources.nowcast, /failed: HTTP 503 \(last good copy kept\)/);
  assert.deepEqual(b.nowcast, a.nowcast);
  const c = await H.collect({ now, fetchFn: fake(['kalshi', 'poly']) });
  assert.equal(c.odds, null); assert.match(c.sources.odds, /failed/);
});

test('the Week ahead puts the nowcast on Wednesday\'s PCE, the Fed calendar on its days and the odds in the frame', () => {
  const hd = { nowcast: H.parseNowcast(NOWCAST), gdpnow: { quarter: '2026 Q4', value: 3.21, prev: 3.27 },
    fed: { events: H.parseFedCal(FEDCAL, '2026-11-23', '2026-11-27') },
    odds: { meeting: '2026-12-09', kalshi: H.parseKalshi(KALSHI), polymarket: H.parsePoly(POLY, H.nextFomc(T('2026-11-20T10:00:00Z')).t), line: 'Prediction markets …' } };
  const A = WA.build({ now: T('2026-11-20T10:00:00Z'), cal: [], rf: null, fc: null, v: null, hd });
  const wed = A.days.find((d) => d.day === '2026-11-25'), pce = wed.releases.find((r) => r.type === 'PCE');
  assert.ok(pce.nowcast && pce.nowcast.month === '2026-10' && pce.nowcast.core === 0.27 && /not the consensus/.test(pce.nowcast.text));
  assert.ok(A.lines.some((l) => /Before the print: PCE/.test(l)));
  assert.equal(A.days.find((d) => d.day === '2026-11-24').fed.length, 2);
  assert.equal(wed.fed[0].title, 'FOMC Minutes');
  assert.equal(A.frame.odds.kalshi[0].label, 'Hike 25bps');
  assert.ok(A.frame.lines.some((l) => /GDPNow for 2026 Q4: 3.21%/.test(l)));
  // a month whose actual print is out is not shown as a nowcast (October CPI printed on 10 Nov)
  assert.equal(WA.nowcastFor(hd, { type: 'CPI', t: T('2026-11-10T13:30:00Z') }), null);
});

test('the loop runs it before the veteran, and the desk draws the nowcast, the Fed calendar and the odds as text', async () => {
  const fs = await import('node:fs');
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  const a = yml.indexOf('node council/hard-data.mjs data'), b = yml.indexOf('node council/veteran.mjs data');
  assert.ok(a > 0 && b > a, 'hard data before the veteran');
  const md = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.ok(md.includes('esc(r.nowcast.text)') && md.includes("'<li><b>Fed: ' + esc(e.title)") && md.includes('Prediction markets on the'));
});
