// node --test tests/health.test.mjs — the council loop's own health alert (council/health.mjs + .github/workflows/watchdog.yml):
// one phone message per state change, deduplicated in watchdog.json healthSent; no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { problems, decide, main, weekendShut, CFG } from '../council/health.mjs';

const T = (s) => Date.parse(s) / 1000, iso = (t) => new Date(t * 1000).toISOString();
const NOW = T('2026-11-04T15:02:00Z');   // Wednesday 10:02 New York: every market open
const snap = (agoMin, errors = {}, open = { xau: true, btc: true }) => ({ at: iso(NOW - agoMin * 60), errors, markets: Object.fromEntries(Object.entries(open).map(([k, o]) => [k, { label: k, open: o }])) });
const health = (agoMin, feeds = {}) => ({ at: iso(NOW - agoMin * 60), feeds });
const stale = (label, sym, staleMin) => ({ label, sym, status: 'bad', staleMin, issues: [{ kind: 'stale', sev: 'bad' }] });
const ok = (label, sym) => ({ label, sym, status: 'ok', staleMin: 0, issues: [] });
const fine = () => ({ snapshot: snap(3), health: health(6, { oanda: { label: 'OANDA', markets: { xau: ok('XAU/USD', 'xau') } } }), trades: [{ market: 'xau', status: 'open', checked: NOW - 200 }], ict: { at: iso(NOW - 10 * 60) } });
const ids = (P) => P.problems.map((p) => p.id);

test('a healthy loop has no problems; a stopped loop is one problem and hides the others', () => {
  assert.deepEqual(ids(problems(fine(), null, NOW)), []);
  const d = { ...fine(), snapshot: snap(47, { goldW1: 'fetch failed' }), ict: { at: iso(NOW - 3 * 3600) }, trades: [{ market: 'xau', status: 'open', checked: NOW - 5 * 3600 }] };
  const P = problems(d, { errStreak: { goldW1: 9 } }, NOW);
  assert.deepEqual(ids(P), ['loop']);
  assert.equal(P.problems[0].text, 'Council stopped: last run 47 min ago (expected ≤ 10 min)');
  assert.equal(problems({ snapshot: null }, null, NOW).problems[0].text, 'Council stopped: no snapshot.json saved');
  assert.match(problems({ snapshot: snap(3 * 60) }, null, NOW).problems[0].text, /last run 3\.0 h ago/);
});

test('ICT desk: stopped outside the weekend only; trade records not re-checked on an open market; data check missing', () => {
  const d = { ...fine(), ict: { at: iso(NOW - 50 * 60) } };
  assert.deepEqual(ids(problems(d, null, NOW)), ['ict']);
  const sat = T('2026-11-07T15:00:00Z'), dS = { snapshot: snap(3), ict: { at: iso(sat - 20 * 3600) } };
  assert.equal(weekendShut(sat), true); assert.equal(weekendShut(NOW), false);
  assert.deepEqual(ids(problems({ ...dS, snapshot: { at: iso(sat - 180), errors: {}, markets: {} } }, null, sat)), []);
  // open gold trade not checked for 2 h while the loop saves: a stuck Trader; the same on a closed market is nothing
  const tr = [{ market: 'xau', status: 'open', checked: NOW - 2 * 3600 }, { market: 'btc', status: 'win', checked: NOW - 9 * 3600 }];
  assert.deepEqual(ids(problems({ ...fine(), trades: tr }, null, NOW)), ['trades']);
  assert.deepEqual(ids(problems({ ...fine(), trades: tr, snapshot: snap(3, {}, { xau: false }) }, null, NOW)), []);
  assert.deepEqual(ids(problems({ ...fine(), health: health(95) }, null, NOW)), ['datacheck']);
});

test('snapshot.errors count only on consecutive observed rounds; a feed stale 30+ min escalates; the order is stable', () => {
  const e = { goldW1: 'OANDA 503' };
  let d = { ...fine(), snapshot: snap(3, e) }, prev = null, P;
  P = problems(d, prev, NOW); assert.deepEqual(P.errStreak, { goldW1: 1 }); assert.deepEqual(ids(P), []);
  P = problems(d, P, NOW + 60); assert.deepEqual(P.errStreak, { goldW1: 1 }, 'the same round seen twice is one round');
  d = { ...d, snapshot: snap(-7, e) }; P = problems(d, P, NOW + 600); assert.equal(P.errStreak.goldW1, 2);
  d = { ...d, snapshot: snap(-14, e) }; P = problems(d, P, NOW + 1200); assert.equal(P.errStreak.goldW1, 3);
  assert.deepEqual(ids(P), ['errors:goldW1']); assert.match(P.problems[0].text, /^Trader error 3 rounds in a row: goldW1 — OANDA 503/);
  d = { ...d, snapshot: snap(-20, {}) }; P = problems(d, P, NOW + 1500); assert.deepEqual(P.errStreak, {}, 'a clean round resets the streak');
  const h = health(5, { oanda: { label: 'OANDA spot', markets: { xau: stale('XAU/USD', 'xau', 35), eurusd: stale('EUR/USD', 'eurusd', 16) } } });
  P = problems({ ...fine(), health: h, ict: { at: iso(NOW - 50 * 60) } }, null, NOW);
  assert.deepEqual(ids(P), ['ict', 'feed:xau']); assert.equal(P.problems[1].text, 'Feed stale: XAU/USD 35 min (OANDA spot)');
  const r = problems({ ...fine(), run: { id: '42', conclusion: 'failure', url: 'https://x/42' } }, null, NOW);
  assert.deepEqual(ids(r), ['run:42']); assert.equal(r.problems[0].text, 'Council loop run failure (https://x/42)');
  assert.deepEqual(ids(problems({ ...fine(), run: { id: '43', conclusion: 'success' } }, null, NOW)), []);
});

test('decide: one alert per state change, a reminder after 12 h, "Council back" once, nothing on a healthy first run', () => {
  const stop = [{ id: 'loop', text: 'Council stopped: last run 47 min ago (expected ≤ 10 min)' }];
  assert.equal(decide([], undefined, NOW).ev, null);
  const a = decide(stop, undefined, NOW);
  assert.equal(a.ev.title, 'Council stopped: last run 47 min ago (expected ≤ 10 min)'); assert.equal(a.ev.tags, 'rotating_light');
  assert.match(a.ev.msg, /Restart: GitHub → Actions → Council trader/); assert.match(a.ev.msg, /UTC · London \d\d:\d\d · New York \d\d:\d\d/);
  assert.equal(a.mark.key, 'loop'); assert.deepEqual(a.mark.items, [stop[0].text]);
  assert.equal(decide(stop, a.mark, NOW + 3600).ev, null, 'the same problem an hour later is silent');
  const rem = decide(stop, a.mark, NOW + CFG.remindH * 3600 + 1);
  assert.equal(rem.ev.title, 'Council problem continues: Council stopped');
  const back = decide([], a.mark, NOW + 7200);
  assert.equal(back.ev.title, 'Council back'); assert.match(back.ev.msg, /Running again: Council stopped\./); assert.equal(back.mark.key, '');
  assert.equal(decide([], back.mark, NOW + 9000).ev, null, 'healthy after the all-clear is silent');
  // a new problem next to an old one is named in the title; a partial recovery is reported once as "still"
  const two = [stop[0], { id: 'feed:xau', text: 'Feed stale: XAU/USD 35 min (OANDA)' }];
  const n = decide(two, a.mark, NOW + 1800); assert.equal(n.ev.title, 'Feed stale: XAU/USD 35 min (OANDA)'); assert.equal(n.mark.key, 'feed:xau|loop');
  const part = decide([two[1]], n.mark, NOW + 2400); assert.equal(part.ev.title, 'Council: still 1 problem'); assert.equal(part.ev.tags, 'warning');
  assert.equal(decide([two[1]], part.mark, NOW + 3000).ev, null);
});

test('main: reads the council-data dir, sends through the stubbed network once, marks watchdog.json; dry run writes nothing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-'));
  const wr = (f, v) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), JSON.stringify(v)); };
  wr('snapshot.json', snap(47)); wr('ict/snapshot.json', { at: iso(NOW - 600) }); wr('trades.json', []); wr('health.json', health(5)); wr('state.json', { tgChat: '7' });
  const calls = []; const stub = async (url, o) => { calls.push({ url: url.replace(/bot[^/]+/, 'bot***'), body: JSON.parse(o.body) }); return { ok: true, status: 200 }; };
  const env = { NTFY_TOPIC: 'test-topic', TELEGRAM_BOT_TOKEN: 'TOKEN' };
  const dry = await main(dir, { env, fetchFn: stub, now: NOW, dry: true });
  assert.equal(dry.status, 'problem'); assert.ok(dry.ev); assert.equal(calls.length, 0); assert.equal(fs.existsSync(path.join(dir, 'watchdog.json')), false);
  const h1 = await main(dir, { env, fetchFn: stub, now: NOW });
  assert.equal(calls.length, 2, 'Telegram + ntfy'); assert.equal(calls[0].body.chat_id, '7', 'the chat id falls back to state.json');
  assert.match(calls[1].body.title, /^Council stopped: last run 47 min ago/); assert.equal(calls[1].body.topic, 'test-topic');
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'watchdog.json'), 'utf8'));
  assert.equal(w.healthSent.key, 'loop'); assert.equal(w.lastAlert.title, h1.ev.title); assert.equal(w.snapshotAt, iso(NOW - 47 * 60));
  const h2 = await main(dir, { env, fetchFn: stub, now: NOW + 600 });
  assert.equal(h2.ev, null); assert.equal(calls.length, 2, 'a restart resends nothing');
  // every channel failing keeps the old mark (retried next time); alerts off marks without sending
  wr('snapshot.json', { at: iso(NOW + 1200 - 120), errors: {}, markets: {} }); wr('ict/snapshot.json', { at: iso(NOW + 1200) }); const bad = async () => ({ ok: false, status: 500 });
  const h3 = await main(dir, { env, fetchFn: bad, now: NOW + 1200 });
  assert.ok(h3.ev); assert.deepEqual(h3.alertError, { telegram: 'HTTP 500', ntfy: 'HTTP 500' }); assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'watchdog.json'), 'utf8')).healthSent.key, 'loop');
  const h4 = await main(dir, { env: { ...env, COUNCIL_ALERTS: 'off' }, fetchFn: stub, now: NOW + 1800 });
  assert.equal(h4.ev.title, 'Council back'); assert.equal(calls.length, 2); assert.equal(h4.healthSent.key, '');
  // a failed loop run handed over by the workflow_run trigger
  const h5 = await main(dir, { env: { ...env, LOOP_RUN_ID: '9', LOOP_RUN_CONCLUSION: 'failure', LOOP_RUN_URL: 'https://x/9' }, fetchFn: stub, now: NOW + 2100 });
  assert.equal(h5.ev.title, 'Council loop run failure (https://x/9)'); assert.equal(calls.length, 4);
});

test('the watchdog workflow is its own small cron workflow that reads council-data and runs health.mjs; the loop retries its hand-over', () => {
  const wf = fs.readFileSync(new URL('../.github/workflows/watchdog.yml', import.meta.url), 'utf8');
  assert.match(wf, /cron: '11,41 \* \* \* \*'/); assert.match(wf, /workflow_run:\s*\n\s*workflows: \[Council trader\]/);
  assert.match(wf, /ref: council-data/); assert.match(wf, /run: node council\/health\.mjs data/); assert.match(wf, /timeout-minutes: 5/);
  assert.doesNotMatch(wf, /trader\.mjs|tracker\.mjs/, 'the watchdog never trades');
  const loop = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  // every pull / save of council-data goes through council/datasync.mjs (clears a stuck rebase, conflict policy, JSON check)
  assert.match(loop, /node council\/datasync\.mjs data pull/); assert.match(loop, /node council\/datasync\.mjs data save "Council run /);
  assert.match(loop, /node council\/datasync\.mjs data save "Council quick pass /);
  assert.match(loop, /datasync\.mjs data save "cTrader account [^\n]*ctrader\/account\.json ctrader\/accounts\.json/, 'the minute step commits both account files');
  assert.doesNotMatch(loop, /pull -q --rebase/, 'no plain pull left: it refused every minute with the uncommitted accounts.json');
  assert.match(wf, /node council\/datasync\.mjs data save "Council watchdog [^\n]* watchdog\.json/);
  assert.match(loop, /for a in 1 2 3; do gh workflow run council\.yml/, 'the hand-over dispatch is retried');
});
