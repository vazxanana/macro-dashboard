import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows } from '../research/edge/yen-gold/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/yen-gold/result.json', import.meta.url)));
test('rows: signal ends at the Friday close, outcome starts at the next close', () => {
  const fx = [], g = [];
  for (let i = 0; i < 60; i++) { const t = Date.UTC(2007, 0, 1) / 1000 + i * 86400; fx.push({ t, v: 120 - i * 0.2 }); g.push({ t, v: 600 + i }); }
  const r = rows(fx, g); assert.ok(r.length > 0 && r.every((x) => x.cls === 'strong'));
  const x = r[0], t = Date.parse(x.day + 'T00:00:00Z') / 1000, i = g.findIndex((o) => o.t === t);
  assert.ok(Math.abs(x.fwd - Math.log(g[i + 21].v / g[i + 1].v)) < 1e-5);
});
test('verdict follows the tests', () => {
  assert.ok(R.verdict.includes(`gold higher ${R.tests.S.pass ? 'PASS' : 'FAIL'}`) && R.verdict.includes(`gold lower ${R.tests.W.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(fs.readFileSync(new URL('../research/edge/yen-gold/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
