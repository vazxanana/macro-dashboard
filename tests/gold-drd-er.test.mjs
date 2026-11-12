// The Daily-regime filter study on the weekly-bull daily rejection long: the ER, the drawdown, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { er, up, dd } from '../research/edge/gold-drd-er/run.mjs';

const days = (cl) => cl.map((close, i) => ({ d: i, close }));

test('ER20: a straight line is 1, a zig-zag that ends where it began is 0, too few days is null', () => {
  assert.equal(er(days([...Array(21)].map((_, i) => 100 + i)), 20), 1);
  assert.equal(er(days([...Array(21)].map((_, i) => 100 + (i % 2))), 20), 0);
  assert.equal(er(days([...Array(20)].map((_, i) => 100 + i)), 19), null);
  const z = days([100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107, 109, 108, 110, 109, 111, 110]);
  assert.equal(+er(z, 20).toFixed(3), +(10 / 30).toFixed(3));
  assert.equal(up(z, 20), true); assert.equal(up(z, 19), false);
});

test('ER reads only the signal day and the days before it', () => {
  const a = days([...Array(30)].map((_, i) => 100 + Math.sin(i) * 3)), b = a.map((x, i) => i > 22 ? { ...x, close: 999 } : x);
  assert.equal(er(a, 22), er(b, 22));
});

test('drawdown is summed R in entry order', () => {
  assert.equal(dd([{ entryT: 3, net: -2 }, { entryT: 1, net: 1 }, { entryT: 2, net: 1 }, { entryT: 4, net: -1 }]), -3);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-drd-er/result.json', import.meta.url))), md = fs.readFileSync(new URL('../research/edge/gold-drd-er/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.deepEqual(r.checks, { difference: false, bothHalves: true, smallerDrawdown: true });
  const o = r.rows.oos;
  assert.match(md, new RegExp(`\\+${o.pass_vs_fail.lift}R a trade, Welch t ${o.pass_vs_fail.t}`));
  for (const [k, s] of [['all', o.all], ['er>=0.2', o['er>=0.2']], ['er<0.2', o['er<0.2']]]) assert.match(md, new RegExp(`\\| ${s.n} \\| \\+${s.avg.toFixed(3)} \\| ${s.pf.toFixed(2)} \\| ${s.dd}R \\|`), k);
  assert.ok(!/live change|now live/i.test(md.replace(/nothing live changed/i, '')), 'no live change claimed');
});
