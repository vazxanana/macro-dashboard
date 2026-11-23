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

// 23 Nov 2026: the loop's saves fell at 00:23:37, 00:38:21 and 00:50:11, so only ONE check landed inside 00:25-00:49; a slow
// round or a hand-over there leaves the morning with no start (GitHub's own cron fired 7.5 h late that day). The loop's window
// opens at 00:10 (the job's 360-minute limit still reaches the 06:00 exit from a 00:10 start); the end stays 00:49.
test('the loop\'s window opens at 00:10 UTC, so two or three rounds land in it; the job\'s time limit still reaches 06:00', async () => {
  const none = runs([]);
  for (const t of ['00:10:00', '00:12:00', '00:23:37', '00:38:21', '00:49:00']) assert.equal((await main({ env: {}, now: at(`2026-11-25T${t}Z`), fetchFn: none })).due, true, t);
  for (const t of ['00:09:59', '00:50:11']) assert.equal((await main({ env: {}, now: at(`2026-11-25T${t}Z`), fetchFn: none })).due, false, t);
  assert.equal((await main({ env: {}, now: at('2026-11-25T00:30:00Z'), fetchFn: runs([{ status: 'in_progress', created_at: '2026-11-25T00:12:00Z' }]) })).due, false, 'a run already going');
  assert.equal((await main({ env: {}, now: at('2026-11-28T00:30:00Z'), fetchFn: none })).due, false, 'Saturday');
  const wf = fs.readFileSync(new URL('../.github/workflows/gotobi.yml', import.meta.url), 'utf8'), lim = +(/timeout-minutes:\s*(\d+)/.exec(wf) || [])[1];
  assert.ok(lim <= 360, 'GitHub\'s limit for a hosted job'); assert.ok(10 + lim >= 6 * 60 + 5, `a job started at 00:10 must still be alive at 06:05 (limit ${lim} min)`);
});
