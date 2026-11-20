// The hard-to-find data on the desk and in the reports (20 Nov 2026): the board of titled groups in the Week ahead, the priced
// line on the release it belongs to, the morning report's lines, and the Macro desk's markup. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../council/hard-sources.mjs';
import * as WA from '../council/week-ahead.mjs';
import { worldReport } from '../council/daily-report.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const at = '2026-12-04T18:00:00Z';
const hd = { at,
  priced: { at, src: 'Kalshi', items: {
    coreCpi: [{ key: 'coreCpi', period: 'November 2026', close: '2026-12-10T13:25:00Z', likely: [{ v: 0.2, p: 0.41 }, { v: 0.3, p: 0.33 }], text: 'core CPI for November 2026: most likely +0.2% (41%), then +0.3% (33%)' }],
    fed: [{ key: 'fed', period: '9 Dec 2026', close: '2026-12-09T18:55:00Z', likely: [{ v: 4.25, p: 0.92 }], text: 'the Fed\'s target rate (upper bound) for 9 Dec 2026: most likely 4.25% (92%)' }],
    recession: [{ key: 'recession', period: '2027', p: 0.25, text: 'a US recession in 2027: 25%' }] } },
  auctionResults: { at, list: [{ day: '2026-12-03', term: '10-Year', type: 'Note', text: '3 Dec 10-Year Note, $42bn: high yield 5.020%, bid-to-cover 2.46 (the 2 before averaged 2.66). Softer demand than the earlier ones.' }] },
  plumbing: { at, netLiquidity: { day: '2026-12-02', bn: 5846.74, chg4w: -100 }, tga: { day: '2026-12-02', bn: 892.31 }, rrp: { day: '2026-12-04', bn: 0.4 } },
  vol: { at, gvz: { day: '2026-12-03', value: 28.7, weekAgo: 27.1, pctile: 0.95, dayMovePct: 1.81 } },
  under: { at, claims: { day: '2026-11-28', value: 203000, prev: 202000 } } };

test('the board: one titled group per part, each with its source and the time it was read', () => {
  const B = S.board(hd, { goldPx: 3575 });
  assert.deepEqual(B.map((g) => g.k), ['priced', 'auctions', 'plumbing', 'vol', 'under']);
  for (const g of B) { assert.ok(g.title && g.src && g.lines.length, g.k); assert.equal(g.at, '2026-12-04 18:00 UTC'); }
  const p = B[0].lines;
  assert.equal(p[0], 'Core CPI for November 2026: most likely +0.2% (41%), then +0.3% (33%).');
  assert.equal(p[1], 'The Fed\'s target rate after 9 Dec 2026: most likely 4.25% upper bound (92%).');
  assert.equal(p[p.length - 1], S.PRICED_TAIL);
  assert.match(B[3].lines[0], /about ±1\.8% \(about \$65\)/);
  assert.deepEqual(S.board(null), []); assert.deepEqual(S.board({ at }), [], 'nothing read, nothing shown');
});

test('a priced ladder sits on its own release only: same type, closing within a day and a half', () => {
  const cpi = T('2026-12-10T13:30:00Z');
  assert.match(S.pricedFor(hd, 'CPI', cpi).text, /^core CPI for November 2026: most likely \+0\.2% \(41%\).*not a forecast of ours\.$/);
  assert.equal(S.pricedFor(hd, 'CPI', cpi + 30 * 86400), null, 'next month\'s CPI is another print');
  assert.equal(S.pricedFor(hd, 'PCE', cpi), null); assert.equal(S.pricedFor(hd, 'ISM', cpi), null); assert.equal(S.pricedFor(null, 'CPI', cpi), null);
});

test('the Week ahead carries the board, the release its priced line and one top line', () => {
  const now = T('2026-12-04T19:00:00Z');   // a Friday: the plan is next week
  const cal = [{ title: 'Core CPI m/m', country: 'USD', impact: 'High', at: T('2026-12-10T13:30:00Z'), forecast: '0.3%', previous: '0.2%' }];
  const wa = WA.build({ now, cal, rf: null, fc: { assets: { gold: { expMovePct: 0.9, last: 3575 } } }, v: null, hd });
  assert.deepEqual(wa.hard.map((g) => g.k), ['priced', 'auctions', 'plumbing', 'vol', 'under']);
  const r = wa.days.flatMap((d) => d.releases).find((x) => x.type === 'CPI');
  assert.ok(r && r.priced, 'the CPI release has its priced line');
  assert.ok(wa.lines.some((l) => /^Priced on a prediction market for this week's prints \(Wednesday: the Fed's target rate \(upper bound\) for 9 Dec 2026: most likely 4\.25% \(92%\) \| Thursday: core CPI for November 2026: most likely \+0\.2% \(41%\)/.test(l)), wa.lines.join('\n'));
  const bare = WA.build({ now, cal, rf: null, fc: null, v: null, hd: null });
  assert.deepEqual(bare.hard, []); assert.ok(!bare.lines.some((l) => /Priced on/.test(l)));
});

test('the morning report: what is priced and gold\'s implied day under "what we expect", yesterday\'s auction under "what happened"', () => {
  const now = T('2026-12-04T06:10:00Z');
  const rep = worldReport({ fc: { assets: { gold: { last: 3575 } } }, vet: null, cal: [], now, hd });
  const all = rep.sections.flatMap((s) => s.lines).join('\n');
  assert.match(all, /Priced for the next prints \(Kalshi\): core CPI for November 2026: most likely \+0\.2% \(41%\)/);
  assert.match(all, /Gold options \(Cboe GVZ, 3 Dec\): 28\.7% implied volatility/);
  assert.match(all, /US Treasury auction, 3 Dec 10-Year Note, \$42bn/);
  const none = worldReport({ fc: null, vet: null, cal: [], now, hd: null }).sections.flatMap((s) => s.lines).join('\n');
  assert.ok(!/Kalshi|GVZ|Treasury auction,/.test(none));
});

test('the Macro desk draws the board as text, with each group\'s source', () => {
  const page = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="wa-hard" hidden'), 'hidden until there is something to show');
  const i = page.indexOf('var HG = Array.isArray(A.hard)'), blk = page.slice(i, i + 700);
  assert.ok(i > 0 && /esc\(g\.title\)/.test(blk) && /esc\(l\)/.test(blk) && /esc\(g\.src/.test(blk) && /esc\(g\.at\)/.test(blk), 'every string goes through esc');
  assert.ok(/r\.priced && r\.priced\.text \? '<span class="wa-r wa-nc"><b>Priced on a prediction market:<\/b> ' \+ esc\(r\.priced\.text\)/.test(page));
});

test('a release the agency\'s own calendar does not hold that day gets one "check the date" line; silent when it does or was not read', () => {
  const now = T('2026-12-04T19:00:00Z');
  const cal = [{ title: 'Core CPI m/m', country: 'USD', impact: 'High', at: T('2026-12-10T13:30:00Z'), forecast: '0.3%', previous: '0.2%' }];
  const off = (list) => ({ official: { read: ['BLS'], from: '2026-12-02', to: '2026-12-25', list } });
  const good = WA.build({ now, cal, rf: null, fc: null, v: null, hd: off([{ t: T('2026-12-10T13:30:00Z'), day: '2026-12-10', agency: 'BLS', type: 'CPI', title: 'Consumer Price Index' }]) });
  assert.ok(!good.lines.some((l) => /^Check the date/.test(l)));
  const moved = WA.build({ now, cal, rf: null, fc: null, v: null, hd: off([{ t: T('2026-12-15T13:30:00Z'), day: '2026-12-15', agency: 'BLS', type: 'CPI', title: 'Consumer Price Index' }]) });
  const hits = moved.lines.filter((l) => /^Check the date/.test(l));
  assert.equal(hits.length, 1); assert.match(hits[0], /^Check the date: Core CPI m\/m is listed for Thursday, but the agency's own release calendar has no such release that day\.$/);
  const unread = WA.build({ now, cal, rf: null, fc: null, v: null, hd: { official: { read: ['BEA'], from: '2026-12-02', to: '2026-12-25', list: [] } } });
  assert.ok(!unread.lines.some((l) => /^Check the date/.test(l)));
});
