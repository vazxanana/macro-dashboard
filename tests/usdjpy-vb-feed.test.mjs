import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { to5m, agreement, stats, FROM, TO } from '../research/edge/usdjpy-vb-feed/run.mjs';
import { histStampUtc } from '../council/histdata.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-vb-feed/result.json', import.meta.url)));

test('to5m groups HistData minutes into UTC 5-minute candles through the audited clock', () => {
  const txt = ['20240102 000000;141.0;141.2;140.9;141.1;0', '20240102 000100;141.1;141.5;141.0;141.4;0', '20240102 000500;141.4;141.4;141.3;141.3;0'].join('\n');
  const c = to5m(txt), t0 = histStampUtc('20240102 000000');
  assert.equal(c.length, 2);
  assert.deepEqual(c[0], [t0 - (t0 % 300), 141.0, 141.5, 140.9, 141.4]);
});

test('agreement and stats on hand-made trades', () => {
  const A = [{ day: '2024-01-02', side: 1, net: 1 }, { day: '2024-01-03', side: -1, net: -1 }];
  const B = [{ day: '2024-01-02', side: 1, net: 0.9 }, { day: '2024-01-03', side: -1, net: -0.8 }];
  const g = agreement(A, B); assert.equal(g.both, 2); assert.equal(g.sameSide, 1); assert.ok(g.corr > 0.99);
  assert.equal(stats(A).n, 2);
});

test('result matches the pre-registered bar', () => {
  assert.equal(R.pass, R.histdata.net > 0 && R.histdata.monthT >= 2);
  assert.match(R.verdict, /^(PASS|FAIL): /);
  assert.ok(R.verdict.includes(FROM) && R.verdict.includes(TO));
  const md = fs.readFileSync(new URL('../research/edge/usdjpy-vb-feed/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(R.verdict));
  assert.ok(fs.existsSync(new URL('../research/edge/usdjpy-vb-feed/PREREGISTRATION.md', import.meta.url)));
});
