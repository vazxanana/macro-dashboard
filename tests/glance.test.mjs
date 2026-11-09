// node --test tests/glance.test.mjs — the veteran at a glance (council/glance.mjs): the one-sentence summary with the bias
// meter, the event and the two levels; the weekly briefing archive and "what changed since last week"; and the run wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../council/glance.mjs';

const lv = (px, list) => ({ px, asOf: '2026-11-06', unit: '$', dp: 0, list: list.map(([price, label, kind]) => ({ price, label, kind, dist: +((price / px - 1) * 100).toFixed(2), side: price >= px ? 'above' : 'below' })).sort((a, b) => b.price - a.price) });
function vet({ p = 0.57, baseP = 0.567, bias = 'AUCTION', conviction = null, event = true, px = 4070.59, lean = 1, levels } = {}) {
  return { at: '2026-11-09T01:42:31.000Z', base: { upRate: 0.567 },
    verdict: { bias, conviction, eventWithin72h: event ? { title: 'Core CPI m/m', at: '2026-11-10T13:30:00.000Z', consensus: '0.2%' } : null },
    channels: [{ lean: 1 }, { lean: 1 }, { lean: -1 }, { lean: 0 }, { lean: null }],
    outlook: { month: { list: [{ asset: 'gold', kind: 'closeAbove', p, baseP, by: '2026-12-04' }] } },
    briefing: { insights: [...(event ? [{ k: 'event', rank: 1, lean: 0, title: 'USD Core CPI m/m on Tue, 10 Nov is the week\'s pivot', event: { title: 'Core CPI m/m', country: 'USD', at: '2026-11-10T13:30:00.000Z', consensus: '0.2%' } }] : []),
      { k: 'real', rank: event ? 2 : 1, lean, title: 'Real yields fell 27 bp in 4 weeks' }, { k: 'pos', rank: 3, lean: 0, title: 'Speculators middle of range' }],
      levels: { gold: levels || lv(px, [[4146.9, "Last week's high", 'week'], [4100, 'Round number', 'round'], [4082.8, 'Swing high 2026-10-28', 'swing'], [4045.4, '20-day average', 'sma'], [4000, 'Round number', 'round'], [3891.3, "Last week's low", 'week']]), dxy: { px: 102.36 } },
      hypotheses: [{ id: 'hyp:2026-11-07:H1', slot: 'H1', p: 0.52, by: '2026-11-13', claim: 'Gold reaches $4,045 before $4,100' }] } };
}

test('summary: one plain sentence, a neutral bias with no tested edge, the event with its time, the two nearest levels ≥ 0.4% away', () => {
  const s = G.summary(vet());
  assert.equal(s.sentence, 'This week: no macro edge for gold, neutral (57% chance it is higher by 4 Dec, base 57%). USD Core CPI m/m (Tue 10 Nov, 13:30 UTC) is the event that matters most. Watch $4,100 above and $4,045 below.');
  assert.equal(s.bias.lean, 'neutral'); assert.equal(s.bias.confidence, 'low'); assert.ok(Math.abs(s.bias.meter) < 0.1);
  assert.deepEqual(s.bias.channels, { up: 2, down: 1, flat: 1, unobserved: 1, total: 5 });
  assert.equal(s.event.when, 'Tue 10 Nov, 13:30 UTC'); assert.equal(s.levels.above.price, 4100); assert.equal(s.levels.below.price, 4045.4, 'the swing 0.3% away is too close to watch');
  assert.equal(s.publicOnly, true);
});

test('summary: supportive / against from the distance to the base rate; confidence from the tested score, one step lower into an event', () => {
  const up = G.summary(vet({ p: 0.66, bias: 'BUY', conviction: 'High' })); assert.equal(up.bias.lean, 'supportive'); assert.equal(up.bias.confidence, 'medium'); assert.match(up.sentence, /^This week: the macro leans supportive for gold \(66%/);
  assert.equal(G.summary(vet({ p: 0.66, bias: 'BUY', conviction: 'High', event: false })).bias.confidence, 'high');
  const dn = G.summary(vet({ p: 0.53 })); assert.equal(dn.bias.lean, 'against'); assert.ok(dn.bias.meter < 0);
  assert.equal(G.summary(vet({ p: 0.59 })).bias.lean, 'neutral', '2 points is inside the neutral band');
  assert.equal(G.summary(vet({ p: 0.95, baseP: 0.5 })).bias.meter, 1, 'the gauge is capped');
  const ne = G.summary(vet({ event: false })); assert.equal(ne.event, null); assert.match(ne.sentence, /No major release is scheduled this week\./);
  assert.equal(G.summary(null), null);
});

test('what changed: first briefing says so; then bias, price, insights, levels and last week\'s hypotheses with their outcome', () => {
  const a = vet(), prev = G.snapshot({ ...a, summary: G.summary(a) }, '2026-11-07');
  assert.equal(prev.levels.some((l) => l.kind === 'round'), false, 'round numbers are not tracked');
  assert.deepEqual(G.briefDiff(null, prev), { since: null, items: [], first: true, line: 'First briefing on the record: next week this shows what changed.' });
  const b = vet({ p: 0.62, px: 4150, lean: 0, event: false, levels: lv(4150, [[4210, "Last week's high", 'week'], [4100, 'Round number', 'round'], [4061.2, '20-day average', 'sma'], [4003.3, 'Swing high 2026-11-12', 'swing'], [3990, "Last week's low", 'week']]) });
  b.briefing.hypotheses = [{ id: 'hyp:2026-11-14:H1', slot: 'H1', p: 0.55, by: '2026-11-20', claim: 'Gold reaches $4,210 first' }];
  const cur = G.snapshot({ ...b, summary: G.summary(b) }, '2026-11-14');
  const d = G.briefDiff(prev, cur, [{ id: 'hyp:2026-11-07:H1', hit: false }]), txt = d.items.map((x) => x.text);
  assert.equal(d.first, false); assert.equal(d.sinceWeek, '2026-11-07');
  assert.ok(txt.includes('Bias neutral → supportive (57% → 62% chance gold is higher in 20 sessions)'), txt.join('\n'));
  assert.ok(txt.includes('Gold $4,071 → $4,150 (+2.0%)'));
  assert.ok(txt.some((t) => /^Real yields fell 27 bp in 4 weeks: now no lean \(was supports gold\)$/.test(t)));
  assert.ok(txt.includes("Dropped: USD Core CPI m/m on Tue, 10 Nov is the week's pivot"));
  assert.ok(txt.includes("Last week's high $4,147 → $4,210 (+1.5%)")); assert.ok(txt.includes('20-day average $4,045 → $4,061 (+0.4%)'));
  assert.ok(txt.includes('Swing high $4,083 → $4,003 (−1.9%)'), 'the swing is matched without its date');
  assert.ok(txt.includes("Last week's H1 (52%): did not happen · Gold reaches $4,045 before $4,100"));
  assert.ok(txt.includes('New H1 (55%): Gold reaches $4,210 first'));
  assert.equal(d.items.find((x) => x.area === 'price').dir, 1);
  // unchanged week
  const same = G.briefDiff(prev, prev, []); assert.ok(same.items.some((x) => x.text === 'Bias unchanged: neutral (57%)')); assert.equal(same.items.filter((x) => x.area === 'level').length, 0);
});

test('archive: one snapshot per week (the latest run replaces the week), sorted, capped; the previous week is the last one before', () => {
  let H = []; for (const w of ['2026-10-24', '2026-10-31', '2026-11-07']) H = G.archiveWeek(H, { week: w, at: w + 'T00:00:00Z' });
  H = G.archiveWeek(H, { week: '2026-11-07', at: 'later' }); assert.equal(H.length, 3); assert.equal(H.at(-1).at, 'later');
  assert.equal(G.previousOf(H, '2026-11-07').week, '2026-10-31'); assert.equal(G.previousOf(H, '2026-11-14').week, '2026-11-07'); assert.equal(G.previousOf(H, '2026-10-24'), null);
  for (let i = 0; i < 40; i++) H = G.archiveWeek(H, { week: `2027-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + Math.floor(i / 12)).padStart(2, '0')}` });
  assert.equal(H.length, G.KEEP_WEEKS);
});

test('wiring: veteran.json carries summary, calibration and changes; the desk shows the glance first, then the briefing, then the discussion', () => {
  const vsrc = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.match(vsrc, /v\.summary = summary\(v\)/); assert.match(vsrc, /v\.changes = briefDiff\(previousOf\(BH, wk\), snap, CL\)/); assert.match(vsrc, /'veteran-briefings\.json'/);
  assert.match(vsrc, /const cal = calibration\(\{ calls: CL0, ledger: ledgerResolve\(ledger, gold\) \}\)/, 'calibrated from the record before today\'s calls');
  const html = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  for (const id of ['c-glance', 'g-sent', 'g-meter', 'g-event', 'g-levels', 'c-changes', 'c-calib', 'calib-chart']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.indexOf('id="c-glance"') < html.indexOf('id="c-brief"') && html.indexOf('id="c-brief"') < html.indexOf('class="top3"'), 'summary → briefing → discussion');
  for (const f of ['summary', 'sentence', 'bias', 'meter', 'confidence', 'calibration', 'bins', 'changes', 'items']) assert.ok(html.includes(f), f);
  assert.match(html, /Public data only/);
});
