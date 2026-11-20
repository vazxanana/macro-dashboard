// Week ahead, the nowcast beside the consensus (council/week-ahead.mjs `prepFor`, 20 Nov 2026): consensus parsing, core vs
// headline, the in-line threshold, the Red folder record (left out under 6 a side), the honesty words, and the wiring into build.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const NC = { core: 0.27, head: 0.31 };
const REC = { stats: { above: { n: 15, gold: 0.06 }, below: { n: 24, gold: -0.13 } } };
const pce = (exp, title = 'Core PCE Price Index m/m') => ({ type: 'PCE', title, exp });

test('consensus parsing: plain, negative, a space before the sign, the minus glyph, missing or text', () => {
  assert.equal(WA.parseExp('0.2%'), 0.2);
  assert.equal(WA.parseExp('-0.1%'), -0.1);
  assert.equal(WA.parseExp('\u22120.1%'), -0.1);
  assert.equal(WA.parseExp('0.25 %'), 0.25);
  assert.equal(WA.parseExp('0.3'), 0.3);
  assert.equal(WA.parseExp(null), null);
  assert.equal(WA.parseExp(''), null);
  assert.equal(WA.parseExp('n/a'), null);
  assert.equal(WA.parseExp('243K'), null);
});

test('no consensus or no nowcast: nothing prepared', () => {
  assert.equal(WA.prepFor(pce(null), NC, REC), null);
  assert.equal(WA.prepFor(pce('n/a'), NC, REC), null);
  assert.equal(WA.prepFor(pce('0.2%'), null, REC), null);
  assert.equal(WA.prepFor(pce('0.2%'), { core: null, head: 0.31 }, REC), null);   // core title, no core nowcast
});

test('core title reads the core nowcast, a headline title the headline one', () => {
  const c = WA.prepFor(pce('0.2%'), NC, REC);
  assert.equal(c.core, true); assert.equal(c.nowcast, 0.27); assert.equal(c.side, 'above'); assert.equal(c.gap, 0.07);
  assert.match(c.text, /The nowcast \(\+0\.27%\) sits above the 0\.2% consensus by 0\.07 points\./);
  const h = WA.prepFor(pce('0.4%', 'PCE Price Index m/m'), NC, REC);
  assert.equal(h.core, false); assert.equal(h.nowcast, 0.31); assert.equal(h.side, 'below');
  assert.match(h.text, /below the 0\.4% consensus by 0\.09 points/);
  const cpi = WA.prepFor({ type: 'CPI', title: 'Core CPI m/m', exp: '0.3%' }, { core: 0.21, head: 0.25 }, null);
  assert.equal(cpi.nowcast, 0.21); assert.equal(cpi.side, 'below');
});

test('in line under 0.05 points either way', () => {
  assert.equal(WA.prepFor(pce('0.25 %'), NC, REC).side, 'in line');            // 0.02 away
  assert.equal(WA.prepFor(pce('0.3%'), NC, REC).side, 'in line');              // 0.03 below
  assert.equal(WA.prepFor(pce('0.23%'), NC, REC).side, 'in line');             // 0.04 above
  assert.equal(WA.prepFor(pce('0.21%'), NC, REC).side, 'above');               // 0.06 above
  assert.match(WA.prepFor(pce('0.25 %'), NC, REC).text, /in line with the 0\.25 % consensus/);
});

test('the record: its own numbers and n, left out under 6 on either side', () => {
  const p = WA.prepFor(pce('0.2%'), NC, REC);
  assert.match(p.text, /past core PCE releases that printed above consensus gold averaged \+0\.06% on the day \(n 15\); below, -0\.13% \(n 24\)/);
  assert.deepEqual(p.record, { above: { n: 15, gold: 0.06 }, below: { n: 24, gold: -0.13 } });
  const few = WA.prepFor(pce('0.2%'), NC, { stats: { above: { n: 5, gold: 0.1 }, below: { n: 24, gold: -0.13 } } });
  assert.equal(few.record, null); assert.doesNotMatch(few.text, /past .* releases/);
  const few2 = WA.prepFor(pce('0.2%'), NC, { above: { n: 9, gold: 0.1 }, below: { n: 4, gold: -0.13 } });
  assert.equal(few2.record, null);
  assert.equal(WA.prepFor(pce('0.2%'), NC, null).record, null);
});

test('honesty: the three caveats are said, no claim of an edge or a direction', () => {
  for (const p of [WA.prepFor(pce('0.2%'), NC, REC), WA.prepFor(pce('0.25%'), NC, null), WA.prepFor(pce('0.4%', 'PCE Price Index m/m'), NC, REC)]) {
    assert.match(p.text, /A model's estimate, not a forecast/);
    assert.match(p.text, /a calendar consensus, not a survey/);
    assert.match(p.text, /descriptive, not a tested edge/);
    const bare = p.text.replace(/not a tested edge/g, '');
    assert.doesNotMatch(bare, /\bedge\b/i);
    assert.doesNotMatch(p.text, /will (rise|fall|go|move)|expect gold|buy|sell|proven/i);
  }
});

test('build: each prepared release carries prep and gets one top line', () => {
  const at = T('2026-11-25T13:30:00Z');
  const cal = [{ title: 'Core PCE Price Index m/m', country: 'USD', at, impact: 'High', forecast: '0.2%', previous: '0.3%' }];
  const hd = { nowcast: { months: [{ month: '2026-10', now: { cpi: 0.3, coreCpi: 0.25, pce: 0.31, corePce: 0.27 }, actual: null, asOf: '2026-11-20' }] } };
  const rf = { study: { PCE: { name: 'Core PCE', stats: { n: 40, absMed: 0.6, upShare: 0.55, from: '2018-01-31', above: { n: 15, gold: 0.06 }, below: { n: 24, gold: -0.13 } } } } };
  const plan = WA.build({ now: T('2026-11-20T10:00:00Z'), cal, rf, fc: null, v: null, hd });
  const r = plan.days.flatMap((d) => d.releases).find((x) => x.type === 'PCE' && x.src === 'calendar');
  assert.ok(r && r.prep); assert.equal(r.prep.side, 'above');
  const line = plan.lines.find((l) => /^Before Wednesday's Core PCE Price Index m\/m:/.test(l));
  assert.ok(line, plan.lines.join('\n'));
  assert.match(line, /nowcast \+0\.27% above the 0\.2% consensus; past prints above it: gold \+0\.06% \(n 15\), below: −0\.13% \(n 24\)/);
  assert.match(line, /descriptive only/);
  const noCons = WA.build({ now: T('2026-11-20T10:00:00Z'), cal: [], rf, fc: null, v: null, hd });   // schedule only, no consensus
  assert.ok(noCons.days.flatMap((d) => d.releases).every((x) => x.prep == null));
  assert.ok(!noCons.lines.some((l) => /^Before Wednesday's/.test(l)));
});
