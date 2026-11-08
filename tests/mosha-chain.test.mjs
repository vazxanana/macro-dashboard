// node --test tests/mosha-chain.test.mjs — snapshot.moshaBo.state: where the H4 -> H1 -> M15 chain stands between trades
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { moshaChain, moshaChainText } from '../council/mosha.mjs';

const ev = (t, dir, level) => ({ t, dir, level });
test('stages: no H4 BO; H4 only; H4 + H1 the other way; complete chain', () => {
  assert.equal(moshaChain([], [], []).stage, 'h4');
  const E1 = [ev(1000, 1, 4000), ev(5000, -1, 3990)];
  assert.deepEqual(moshaChain(E1, [], []), { stage: 'h1', dir: -1, h4: { t: 5000, dir: -1, level: 3990 }, h1: null, m15: null });
  // an H1 BO before the H4 BO, or in the same direction, is not the retracement
  assert.equal(moshaChain(E1, [ev(4000, 1, 3995), ev(6000, -1, 3985)], []).stage, 'h1');
  const E2 = [ev(4000, 1, 3995), ev(7000, 1, 3993)];
  const c = moshaChain(E1, E2, []); assert.equal(c.stage, 'm15'); assert.equal(c.h1.t, 7000);
  // the M15 BO must come after the H1 BO and point the H4 way
  assert.equal(moshaChain(E1, E2, [ev(6500, -1, 3991), ev(8000, 1, 3996)]).stage, 'm15');
  const d = moshaChain(E1, E2, [ev(8000, 1, 3996), ev(9000, -1, 3992)]);
  assert.equal(d.stage, 'done'); assert.deepEqual(d.m15, { t: 9000, dir: -1, level: 3992 });
});
test('text: one line per stage, with the weekly reading', () => {
  assert.match(moshaChainText(moshaChain([], [], []), 1), /waiting for an H4 BO/);
  const c = moshaChain([ev(1762560000, -1, 3990.456)], [], []);
  assert.match(moshaChainText(c, -1), /H4 BO sell at 3990.46 \(11-08 00:00 UTC\); waiting for the H1 BO the other way.*Weekly structure agrees\./);
  assert.match(moshaChainText(c, 1), /against it.*shadow/);
  assert.doesNotMatch(moshaChainText(c, null), /Weekly/);
});
test('the Trader publishes it as snapshot.moshaBo.state (wiring pin)', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ moshaChain \} from '\.\/mosha\.mjs'/);
  assert.match(src, /snapshot\.moshaBo = \{ state: \{ \.\.\.moshaChain\(E1, E2, E3\)/);
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /id="ms-rep-mosha"/); assert.match(html, /sn\.moshaBo && sn\.moshaBo\.state/);
});

test('heads-up alert: once per H4+H1 pair when the chain is one M15 BO from a trade; silent otherwise (council/alerts.mjs)', async () => {
  const { moshaArmed, moshaArmedKey } = await import('../council/alerts.mjs');
  const now = 1794000000, st = { stage: 'm15', dir: -1, h4: { t: 1793851200, dir: -1, level: 4082.82 }, h1: { t: 1793860000, dir: 1, level: 4095.1 }, m15: null, w1: -1 };
  const a = moshaArmed(st, undefined, now);
  assert.equal(a.ev.title, 'Mosha BO armed: watch for an M15 sell BO on gold'); assert.match(a.ev.msg, /H4 BO sell at 4082.82 .*H1 retracement BO at 4095.1/); assert.match(a.ev.msg, /Weekly structure agrees/);
  assert.equal(a.mark.key, '1793851200|1793860000');
  assert.equal(moshaArmed(st, a.mark, now + 600), null, 'same pair: no resend');
  assert.match(moshaArmed({ ...st, w1: 1 }, undefined, now).ev.msg, /against it: the trade would be recorded as a shadow/);
  assert.equal(moshaArmed({ ...st, stage: 'h1', h1: null }, undefined, now), null); assert.equal(moshaArmed({ ...st, stage: 'done' }, undefined, now), null); assert.equal(moshaArmed(null, undefined, now), null);
  assert.equal(moshaArmedKey({ ...st, h1: { t: 1793870000 } }), '1793851200|1793870000', 'a new H1 BO re-arms');
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /moshaArmed\(snapshot\.moshaBo\.state, state\.moshaArmedSent, now\)/); assert.match(src, /state\.moshaArmedSent = ma\.mark/);
});
