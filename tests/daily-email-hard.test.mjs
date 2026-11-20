// The 06:30 morning email on a day that carries every hard-data line of 20 Nov 2026 (council/daily-report.mjs worldReport: the
// nowcast before the print, the Fed's own events, Treasury auctions, the Fed odds, GDPNow and how they moved). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as DR from '../council/daily-report.mjs';
import * as X from './fixtures/daily-email-hard.mjs';
const require = createRequire(import.meta.url);
const D = require('../api/_daily.js'), N = require('../api/notify.js');

const rep = DR.buildReports({ fc: X.fc, vet: X.vet, cache: X.cache, cot: X.cot, snap: null, now: X.now, hd: X.hd });
const sec = (re) => rep.world.sections.find((s) => re.test(s.h)).lines;

test('the fixture day really carries the new lines', () => {
  const today = sec(/^Today/), exp = sec(/^What we expect/);
  assert.ok(today.some((l) => /^Before the print: /.test(l)) && today.filter((l) => /^Fed: /.test(l)).length === 2 && today.filter((l) => /^US Treasury .* auction/.test(l)).length === 2);
  assert.ok(exp.some((l) => /^Prediction markets/.test(l)) && exp.some((l) => /GDPNow for 2026 Q4: 3\.21% a year/.test(l)) && exp.filter((l) => / now, .* a day ago/.test(l)).length === 4);
});

test('"Coming out today" keeps the high-impact releases (written "High · 13:30 · …") and marks them; no note becomes a release', () => {
  const A = D.agenda(rep);
  assert.deepEqual(A.map((e) => e.what), ['German ifo Business Climate', 'Core PCE Price Index m/m', 'Unemployment Claims', 'Core Durable Goods Orders m/m', 'Prelim GDP q/q', 'New Home Sales']);
  assert.deepEqual(A.filter((e) => e.hi).map((e) => e.what), ['Core PCE Price Index m/m', 'Unemployment Claims', 'Prelim GDP q/q']);
  assert.deepEqual(A[1], { at: '13:30', where: 'United States', what: 'Core PCE Price Index m/m', more: 'expected 0.2%, previous 0.3%', hi: true });
  assert.ok(A.every((e) => /^\d\d:\d\d$/.test(e.at) && !/Before the print|Fed|Treasury/.test(e.what + e.where)));
  // over the limit the high-impact rows stay, in time order
  const many = { world: { sections: [{ h: 'Today, x', lines: [...Array.from({ length: 9 }, (_, i) => `0${i}:00 · Japan · Minor ${i}`), 'High · 13:30 · United States · Core PCE Price Index m/m', 'High · 19:00 · United States · Federal Funds Rate'] }] } };
  const M = D.agenda(many); assert.equal(M.length, 8);
  assert.deepEqual(M.slice(-2).map((e) => e.what), ['Core PCE Price Index m/m', 'Federal Funds Rate']); assert.deepEqual(M.map((e) => e.at), [...M.map((e) => e.at)].sort());
});

test('the nowcast, the Fed events and the auctions reach the email as "Also today", in that order, in the HTML too', () => {
  const TN = D.todayNotes(rep);
  assert.equal(TN.length, 5); assert.match(TN[0], /^Before the print: the Cleveland Fed nowcast for October is core \+0\.27%/);
  assert.deepEqual(TN.slice(1).map((l) => l.slice(0, 12)), ['Fed: Beige B', 'Fed: Speech ', 'US Treasury ', 'US Treasury ']);
  const m = D.emailOf(rep, null), h = m.html;
  const ag = h.slice(h.indexOf('Coming out today'), h.indexOf('World economy</h2>'));
  assert.ok(ag.includes('Also today') && ag.includes('Before the print: the Cleveland Fed nowcast') && ag.includes('Fed: Beige Book · 19:00 London (2:00 p.m. New York)') && ag.includes('US Treasury 7-Year Note auction, $44 billion'));
  assert.ok(ag.indexOf('Core PCE Price Index m/m') < ag.indexOf('Also today') && (ag.match(/key release/g) || []).length === 3);
  assert.ok(m.text.includes('13:30  United States: Core PCE Price Index m/m (expected 0.2%, previous 0.3%) · key release'));
  assert.ok(m.text.includes('Fed: Beige Book') && m.text.includes('US Treasury 7-Year Note auction'));
  // a day with no release still shows its notes
  const quiet = DR.buildReports({ fc: X.fc, vet: X.vet, cache: { cal: [] }, cot: X.cot, snap: null, now: X.now, hd: X.hd });
  assert.deepEqual(D.agenda(quiet), []); const q = D.emailOf(quiet, null).html;
  assert.ok(q.includes('Coming out today') && q.includes('Fed: Beige Book') && q.includes('No high- or medium-impact release is scheduled today.'));
  // and a report without a Today section shows neither
  assert.ok(!D.emailOf({ ...rep, world: { ...rep.world, sections: [] } }, null).html.includes('Coming out today'));
});

test('"What we expect" in the email: the week sentence, the score, the Fed odds and GDPNow are the four lines kept', () => {
  const h = D.emailOf(rep, null).html, part = h.slice(h.indexOf('>What we expect<'), h.indexOf('Markets</h2>'));
  for (const s of ['This week: gold is under pressure', 'Gold Macro Score', 'Prediction markets on the 9 Dec Fed decision', 'Atlanta Fed GDPNow for 2026 Q4: 3.21% a year']) assert.ok(part.includes(s), s);
  assert.ok(!part.includes('a day ago') && part.includes(`${sec(/^What we expect/).length - 4} more on the Macro desk`));
});

test('plain words: every new term of the report is explained once', () => {
  const W = D.glossary(rep, null).map((x) => x.w);
  for (const w of ['Nowcast', 'PCE', 'GDPNow', 'Prediction markets (Kalshi, Polymarket)', 'Beige Book', 'Treasury auction', 'bp (basis point)']) assert.ok(W.includes(w), w);
  assert.equal(new Set(W).size, W.length);
  // "25bps" alone (the odds line) brings the basis-point entry; a report without the new lines brings none of the new words
  const only = (line) => D.glossary({ world: { sections: [{ h: 'x', lines: [line] }] }, markets: {} }, null).map((x) => x.w);
  assert.deepEqual(only('Kalshi Hike 25bps 92%'), ['bp (basis point)', 'Prediction markets (Kalshi, Polymarket)']);
  assert.deepEqual(only('Gold 3,547.8 is quiet this morning.'), []);
  const words = D.glossary(rep, null).map((x) => x.m).join(' ');
  assert.ok(!/\b(buy|sell) (now|it)\b|guarantee|proven/i.test(words));
  const m = D.emailOf(rep, null); assert.ok(m.html.includes('<b style="color:#16181b">Nowcast</b>') && m.text.includes('• GDPNow: '));
});

test('the summary check accepts the figures the report now carries, and still refuses one it does not', () => {
  const ok = { headline: 'Core PCE at 13:30: the Cleveland Fed estimate says +0.27%, the calendar 0.2%.',
    points: ['Traders put a 92% chance on a rate rise on 9 Dec, up from 85% a week ago.', 'Polymarket has it at 92.5%; a 25bps move is what is priced.', 'Growth estimate 3.21%, down from 3.27% a day ago and 3.4% a week ago.'],
    world: 'Traders put a 92% chance on a rate rise at the 9 Dec meeting, up from 90% a day ago; the Cleveland Fed estimate has core prices up 0.27% in October.',
    markets: 'Gold sits near 3,547.8; the US sells $44 billion of 7-Year debt, with results about 13:00 New York, and $28 billion of 2-Year paper.' };
  const p = D.parseBrief(JSON.stringify(ok), rep); assert.equal(p.ok, true, p.why);
  assert.match(D.parseBrief(JSON.stringify({ ...ok, points: ['Traders put a 97% chance on a rate rise on 9 Dec.', 'Gold near 3,547.8 this morning.'] }), rep).why, /point 1: the figure 97 is not in the report/);
  assert.match(D.parseBrief(JSON.stringify({ ...ok, headline: 'Rates will rise on 9 Dec: the odds are 92%.' }), rep).why, /headline/);
});

test('the bell notice is still two short lines: the leads, none of the new detail', () => {
  const n = N.dailyNotice({ reports: [rep] }, [], Date.parse(rep.publishAt) + 60e3);
  assert.deepEqual(n.body.split('\n').map((l) => l.split(':')[0]), ['World economy', 'Markets']);
  assert.match(n.body, /Today: United States Core PCE Price Index m\/m at 13:30 London\./); assert.ok(n.body.length < 400 && !/nowcast|Kalshi|auction/i.test(n.body));
});
