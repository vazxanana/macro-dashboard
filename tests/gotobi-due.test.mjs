// council/gotobi-due.mjs: the council loop's trigger for the gotobi job (offline: fake run list and clock).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { main } from '../council/gotobi-due.mjs';

const at = (s) => Date.parse(s);
const runs = (list) => async () => ({ ok: true, json: async () => ({ workflow_runs: list }) });

test('due on a gotobi weekday inside 00:25-00:49 UTC with no active or recent run', async () => {
  const d = await main({ env: {}, now: at('2026-11-25T00:30:00Z'), fetchFn: runs([{ status: 'completed', created_at: '2026-11-20T00:31:00Z' }]) });
  assert.equal(d.due, true, d.why);
});

test('not due: outside the window, not a gotobi day, a run active or started within the hour, or an unreadable list', async () => {
  const none = runs([]);
  assert.equal((await main({ env: {}, now: at('2026-11-25T00:50:00Z'), fetchFn: none })).due, false);
  assert.equal((await main({ env: {}, now: at('2026-11-24T00:30:00Z'), fetchFn: none })).due, false, '24 Nov is not a gotobi day');
  assert.equal((await main({ env: {}, now: at('2026-11-25T00:30:00Z'), fetchFn: runs([{ status: 'queued', created_at: '2026-11-25T00:22:00Z' }]) })).due, false);
  assert.equal((await main({ env: {}, now: at('2026-11-25T00:40:00Z'), fetchFn: runs([{ status: 'completed', created_at: '2026-11-25T00:23:00Z' }]) })).due, false);
  assert.equal((await main({ env: {}, now: at('2026-11-25T00:30:00Z'), fetchFn: async () => ({ ok: false, status: 403 }) })).due, false);
  assert.equal((await main({ env: {}, now: at('2026-11-25T00:30:00Z'), fetchFn: async () => { throw new Error('offline'); } })).due, false);
});

test('the loop dispatches main\'s gotobi.yml after the round, never failing it', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(y, /if timeout 30 node council\/gotobi-due\.mjs; then timeout 30 gh workflow run gotobi\.yml --ref main -R "\$\{\{ github\.repository \}\}" \|\| echo "Gotobi not dispatched/);
  const src = fs.readFileSync(new URL('../council/gotobi-due.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /method: 'POST'|writeFile|placeOrder|ctrader/i, 'the trigger only reads');
});
