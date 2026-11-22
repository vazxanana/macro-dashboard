// Desk examples for the Academy: two losers and two winners a reading, from the desks' stored records.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GROUPS, groupOf, usable, pick, build, main, exampleOf, PER_SIDE } from '../council/desk-examples.mjs';
import { writeDesk } from '../council/desk-store.mjs';

let n = 0;
const rec = (id, o = {}) => { n++; const side = o.side || 1, entry = 100;
  return { id, market: 'xau', kind: 'sop', label: 'x', h: '1h', l: '15m', side, t: 1795000000 + n * 86400, entry, stop: entry - side, target: entry + 2 * side,
    status: o.R > 0 ? 'target' : 'stopped', R: -1, endT: 1795000000 + n * 86400 + 3600, exit: entry - side,
    log: [{ t: 1, text: 'step' }], marks: [{ kind: 'level', a: 1, at: 2, label: 'BO', p: 100 }], ...o }; };

test('every reading has its own key, and an id goes to the most specific one', () => {
  const keys = [].concat(GROUPS.mosha, GROUPS.eg).map((g) => g[0]);
  assert.equal(new Set(keys).size, keys.length);
  const m = (id) => groupOf('mosha', { id });
  assert.equal(m('gbpusd:sop-nv-15m-s1'), 'mosha-nest-vr');
  assert.equal(m('sop-nc-15m-b1'), 'mosha-nest-cf');
  assert.equal(m('sop-l-i-5m-b1'), 'mosha-seq-limit');
  assert.equal(m('sop-vr-15m-s1'), 'mosha-seq-retest');
  assert.equal(m('sop-vc-15m-s1'), 'mosha-seq-retest');
  assert.equal(m('sop-c2-15m-1'), 'mosha-seq-case2');
  assert.equal(m('sop-i-15m-1'), 'mosha-seq-eg');
  assert.equal(m('eurusd:bar-old-tap-1h-b1'), 'mosha-bar-3r');
  assert.equal(m('bar-tap-1h-b1'), 'mosha-bar-tap');
  assert.equal(m('bar-sop-f-1h-s1'), 'mosha-bar-qmfail');
  assert.equal(m('bar-sop-cf-1h-s1'), 'mosha-bar-rsop');
  assert.equal(m('bar-eg-4h-b1'), 'mosha-bar-1r');
  assert.equal(m('other-1'), null);
  assert.equal(groupOf('eg', { id: 'eg3-4h-b1', kind: 'eg-sop3', h: '4h' }), 'eg-sop3-4h');
  assert.equal(groupOf('eg', { id: 'x', kind: 'eg-plan-n' }), 'eg-plan-n');
  assert.equal(groupOf('eg', { id: 'x', kind: 'msnr-main' }), null);
});

test('only a closed record with a stop on the losing side is an example', () => {
  assert.equal(usable(rec('sop-1')), true);
  assert.equal(usable(rec('sop-1', { status: 'open' })), false);
  assert.equal(usable(rec('sop-1', { R: null })), false);
  assert.equal(usable(rec('sop-1', { stop: 101 })), false);            // a buy with its stop above the entry
  assert.equal(usable(rec('sop-1', { side: -1, stop: 99 })), false);
  assert.equal(usable(rec('sop-1', { side: -1, stop: 101 })), true);
  assert.equal(usable(rec('sop-1', { settled: true })), false);
  assert.equal(usable(null), false);
});

test('the pick is the most recent, spread over markets and days where it can', () => {
  const rows = [rec('a', { t: 100 * 86400, market: 'xau' }), rec('b', { t: 100 * 86400 + 60, market: 'xau' }), rec('c', { t: 99 * 86400, market: 'eurusd' }), rec('d', { t: 98 * 86400, market: 'xau' })];
  assert.deepEqual(pick(rows).map((r) => r.id), ['b', 'c']);
  assert.deepEqual(pick(rows.slice(0, 2)).map((r) => r.id), ['b', 'a']);   // nothing else to choose from
  assert.deepEqual(pick([rec('m', { t: 5, marks: [] }), rec('k', { t: 4 })], 1).map((r) => r.id), ['k']);   // one with chart marks first
  assert.equal(pick([]).length, 0);
});

test('build gives two losers and two winners a reading, with log and marks, never an open trade', () => {
  const recs = [];
  for (let i = 0; i < 5; i++) { recs.push(rec('sop-15m-' + i)); recs.push(rec('sop-15m-w' + i, { R: 2 })); }
  recs.push(rec('sop-15m-open', { status: 'open', R: null, t: 2e9 }));
  recs.push(rec('bar-tap-1h-b9', { R: 1 }));
  const out = build({ mosha: { market: 'xau', records: recs }, eg: null }, 0);
  const g = out.groups.find((x) => x.k === 'mosha-seq-eg');
  assert.equal(g.examples.length, 2 * PER_SIDE);
  assert.deepEqual(g.examples.map((e) => e.outcome), ['loss', 'loss', 'win', 'win']);
  assert.ok(g.examples.every((e) => e.log.length && e.marks.length && e.status !== 'open'));
  assert.equal(g.closed, 10);
  const tap = out.groups.find((x) => x.k === 'mosha-bar-tap');
  assert.deepEqual(tap.examples.map((e) => e.outcome), ['win']);          // a reading with one side only shows what there is
  assert.ok(!out.groups.some((x) => x.desk === 'eg'));
  assert.match(out.note, /never how often it wins/);
  const e = exampleOf(rec('sop-1', { secret: 1, first: 5, src: 'replay' }));
  assert.ok(!('secret' in e) && !('first' in e) && !('src' in e));
});

test('main reads the light desk files with their day files and writes academy/desk-examples.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dex-'));
  writeDesk(dir, 'mosha', { v: 1, market: 'xau', records: [rec('sop-15m-1'), rec('sop-15m-2', { R: 1.5 })] });
  writeDesk(dir, 'eg', { v: 1, records: [rec('eg3-1h-b1', { kind: 'eg-sop3', h: '1h', market: 'eurusd' })] });
  const out = main(dir);
  const file = JSON.parse(fs.readFileSync(path.join(dir, 'academy', 'desk-examples.json'), 'utf8'));
  assert.deepEqual(file.groups.map((g) => g.k), ['mosha-seq-eg', 'eg-sop3-1h']);
  assert.equal(file.groups[0].examples[0].log[0].text, 'step');           // the log came back from the day file
  assert.equal(out.groups.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the script is not in the council loop: the set stays the same while the owner annotates', () => {
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.ok(!yml.includes('desk-examples'));
});
