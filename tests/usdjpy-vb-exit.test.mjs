import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { barsTo, tradesExit, reading, report, EXITS, GATE, ALTS } from '../research/edge/usdjpy-vb-exit/run.mjs';

const dir = new URL('../research/edge/usdjpy-vb-exit/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir)));

test('the exit hands over the candles that end by it, and the trade never sees a later one', () => {
  const d0 = 1700006400, bars = [];
  for (let i = 0; i < 252; i++) bars.push({ t: d0 + i * 300, o: 150, h: 150.05, l: 149.95, c: 150 });
  for (let i = 200; i < 252; i++) bars[i] = { t: d0 + i * 300, o: 150.5, h: 150.6, l: 150.45, c: 150.55 };
  bars[200] = { t: d0 + 200 * 300, o: 150, h: 151, l: 150.4, c: 150.9 };        // 16:40: breaks above O + 0.5 × 1
  const day = { day: '2023-11-15', d0, bars, prevRange: 1 };
  assert.equal(barsTo(day, EXITS['12:00']).at(-1).t, d0 + 11 * 3600 + 55 * 60);
  assert.equal(tradesExit([day], EXITS['12:00']).length, 0);                   // the break comes after 12:00
  const [x] = tradesExit([day], EXITS['18:00']);
  assert.equal(x.side, 1); assert.equal(x.entry, 150.5); assert.equal(x.how, 'time'); assert.equal(x.exit, 150.55);
  assert.equal(x.fillT, d0 + 200 * 300);
  const [y] = tradesExit([day]), [z] = tradesExit([day], EXITS['21:00'] - 1);  // the rule's own candles, and the filter path
  assert.deepEqual(z, y);
  assert.ok(y.R > 0 && y.net < y.R);
});

test('the pre-registered reading', () => {
  const ok = { early: { netR: 0.01 }, late: { netR: 0.02 }, pooled: { t: 2.1 } };
  assert.equal(reading([ok, ok, ok, { ...ok, pooled: { t: 1 } }]).broad, true);
  assert.equal(reading([ok, ok, { ...ok, pooled: { t: 1 } }, { ...ok, pooled: { t: 1 } }]).broad, false);
  assert.equal(reading([ok, ok, ok, { ...ok, late: { netR: -0.001 } }]).broad, false);
  assert.equal(R.reading.label, reading(ALTS.map((n) => R.settings.find((s) => s.name === n).row)).label);
  assert.ok(R.verdict.startsWith(R.reading.label));
});

test('gate, plan hash and report against result.json', () => {
  assert.equal(R.gate.ok, true); assert.equal(R.gate.same, R.gate.of);
  for (const w of ['early', 'late']) { assert.equal(R.gate.got[w].n, GATE[w].n); assert.equal(R.gate.got[w].netR, GATE[w].netR); }
  const rule = R.settings.find((s) => s.name === 'exit 21:00 (rule)').row;
  assert.equal(rule.early.n, 2089); assert.equal(rule.late.n, 2079);
  assert.equal(R.planSha256, crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', dir))).digest('hex'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), report(R));
});
