// council/copy-due.mjs: the read-only "is there a fresh desk fill to copy" check the council loop runs between quick passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { due, DESKS, FRESH_S } from '../council/copy-due.mjs';
import { EQX } from '../council/ctrader-mirror.mjs';

const now = 1795700000;
const desk = (recs) => ({ records: recs });

test('a fresh open record is due; an old, closed or unreadable one is not', () => {
  const files = {
    boxfade: desk([{ id: 'a', status: 'open', first: now - 30 }, { id: 'b', status: 'stopped', first: now - 10 }, { id: 'c', status: 'open', first: now - FRESH_S - 1 }]),
    fade: desk([{ id: 'd', status: 'open', first: now - FRESH_S }]),
    fvg: { records: 'nope' },
  };
  const read = (k) => { if (k === 'bigfade') throw new Error('does not parse'); return files[k]; };
  assert.deepEqual(due(read, now), ['fade:d', 'boxfade:a']);
  assert.deepEqual(due(() => desk([{ id: 'x', status: 'open', first: now + 3600 }]), now), [], 'a time far in the future is not trusted');
  assert.deepEqual(due(() => null, now), []);
});

test('the list is the desks the mirror copies, and the file holds no order or network code', () => {
  assert.deepEqual([...DESKS].sort(), [...new Set([...EQX.desks, 'bigfade', 'boxfade'])].sort());
  const src = fs.readFileSync(new URL('../council/copy-due.mjs', import.meta.url), 'utf8');
  assert.ok(!/fetch\(|writeFile|ORDER|ctrader-link/.test(src));
});

test('the council loop runs the copied desks and the mirror between quick passes', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(y, /fastcopy\(\) \{/);
  assert.match(y, /nap; fastcopy "wait \$i"; nap; fastcopy "wait \$i"; nap/);
  assert.match(y, /nap\(\) \{ b=\$\(\( 300 - \( \$\(date \+%s\) - 4 \) % 300 \)\)/, 'wakes 4 s after a 5-minute close');
  assert.ok(!/for k in 1 2 3 4; do sleep 60/.test(y));
  assert.ok((y.match(/^\s+fastcopy "round \$i"$/gm) || []).length >= 4, 'between the heavy members of a round');
});
