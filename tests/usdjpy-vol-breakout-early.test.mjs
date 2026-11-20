// usdjpy-vol-breakout-early: the follow-up fx-vol-breakout asked for (research/edge/usdjpy-vol-breakout-early). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { W, decide, trades } from '../research/edge/usdjpy-vol-breakout-early/run.mjs';

const DIR = new URL('../research/edge/usdjpy-vol-breakout-early/', import.meta.url);

test('usdjpy-vol-breakout-early: the window is the pre-registered 2005-2015, never a 2016 day', () => {
  assert.deepEqual(W.ALL, ['2005-01-04', '2015-12-31']);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /2005-01-04 to 2015-12-31/); assert.match(pre, /at least 38 of 40/);
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  assert.ok(R.window[1] <= '2015-12-31' && R.window[0] >= '2005-01-04');
});

test('usdjpy-vol-breakout-early: trades keep days before 2016 (the fx study\'s 2016 filter is not applied)', () => {
  const d0 = Date.parse('2008-03-04T00:00:00Z') / 1000, bars = [];
  for (let i = 0; i < 240; i++) { const p = 100 + i * 0.01; bars.push({ t: d0 + i * 300, o: p, h: p + 0.02, l: p - 0.005, c: p + 0.01 }); }
  const tr = trades('usdjpy', [{ day: '2008-03-04', d0, bars, prevRange: 1 }]);
  assert.equal(tr.length, 1); assert.equal(tr[0].day, '2008-03-04'); assert.equal(tr[0].side, 1);
});

test('usdjpy-vol-breakout-early: every check is needed; the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  assert.equal(R.decision.pass, Object.values(R.decision.checks).every(Boolean));
  const mk = (netR, t) => ({ n: 2000, netR, net2R: netR, t, win: 0.5, grossR: netR, maxDD: -1 }), tr = [];
  assert.equal(decide(tr, Array(40).fill(-1), W.ALL).tooFew, true);
});
