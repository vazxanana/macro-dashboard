// Checks the phone-alert path (council/alerts.mjs) on real trades, with the network stubbed: nothing is sent.
//   git fetch origin council-data && mkdir -p /tmp/cd && git show origin/council-data:trades.json > /tmp/cd/trades.json \
//     && git show origin/council-data:research.json > /tmp/cd/research.json && node council/alerts-test.mjs /tmp/cd
// Prints sample messages and exits 1 if a check fails.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { alertable, alertEvents, sendAlerts } from './alerts.mjs';
const DIR = process.argv[2] || 'data', rd = (f) => JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'));
const trades = rd('trades.json'), research = fs.existsSync(`${DIR}/research.json`) ? rd('research.json') : [];
const FLAGS = ['ntfyP', 'ntfyX', 'ntfyO', 'ntfyC', 'futT'], clean = (x) => { const y = structuredClone(x); FLAGS.forEach((f) => delete y[f]); return y; };
const show = (h, ev) => { console.log(`\n=== ${h}`); for (const e of ev) console.log(`[${e.tags}] ${e.title}\n${e.msg}${e.click ? `\n→ ${e.click}` : ''}\n`); };
let fails = 0; const check = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { fails++; console.log(`FAIL ${name}: ${e.message}`); } };

// which trades may alert
const list = alertable(trades, research);
check('no shadow trade is alertable', () => assert.equal(list.filter((x) => x.shadow).length, 0));
check('every live trade is alertable', () => assert.equal(list.filter((x) => x.k !== 'nq-open').length, trades.filter((x) => !x.shadow).length));
check('NQ variants the live rule skips (-x) are not alertable', () => assert.equal(list.filter((x) => /-x$/.test(x.session || '')).length, 0));
check('shadow trades never produce an event', () => { const sh = trades.filter((x) => x.shadow && x.filled).slice(-50).map(clean);
  let n = 0; for (const x of sh) n += alertEvents(alertable([x], []), x.filled + 60).ev.length; assert.equal(n, 0); });

// replay each live trade's open and close at the time they happened
const opens = [], closes = []; let errs = 0;
for (const x0 of list) {
  if (x0.filled) { const x = { ...clean(x0), status: 'open', R: null, closed: undefined }; const r = alertEvents([x], x.filled + 120); errs += r.errors.length; opens.push(...r.ev);
    check(`open sent once: ${x0.id}`, () => { assert.equal(r.ev.length, 1); assert.equal(alertEvents([x], x.filled + 360).ev.length, 0); }); }
  if (x0.closed && ['win', 'loss', 'be'].includes(x0.status)) { const x = clean(x0); x.ntfyO = 1; const r = alertEvents([x], x.closed + 120); errs += r.errors.length; closes.push(...r.ev);
    check(`close sent once: ${x0.id}`, () => { assert.equal(r.ev.length, 1); assert.equal(alertEvents([x], x.closed + 360).ev.length, 0); }); }
}
check('no formatting errors on real trades', () => assert.equal(errs, 0));
check('a restart an hour later re-sends nothing (old events are outside the window)', () => {
  let n = 0; for (const x0 of list) { const x = clean(x0); n += alertEvents([x], Math.max(x.filled || 0, x.closed || 0, x.opened || 0) + 3600).ev.length; } assert.equal(n, 0); });
check('live scalp-sleeve trades alert', () => assert.ok(opens.some((e) => / Scalp$/.test(e.title) || / Scalp /.test(e.title))));
check('prices are rounded to the market decimals (no float noise)', () => { for (const e of opens) assert.doesNotMatch(e.msg, /\d\.\d{6,}/); });
check('every message has UTC, London and New York times', () => { for (const e of [...opens, ...closes]) assert.match(e.msg, /UTC · London \d\d:\d\d · New York \d\d:\d\d/); });

// a futures limit order: placed, then filled / expired / missed, then closed
const lim = trades.find((x) => !x.shadow && x.market === 'xau' && x.entryMode === 'limit') || trades.find((x) => !x.shadow && x.market === 'xau');
const L = { ...clean(lim), status: 'pending', R: null, closed: undefined, filled: undefined }, T0 = L.opened;
const placed = alertEvents([L], T0 + 60, { basis: 3.4 }).ev;
check('limit ticket on a resting gold order', () => { assert.equal(placed.length, 1); assert.match(placed[0].title, /LIMIT/); assert.ok(L.futT); });
const Lm = { ...structuredClone(L), status: 'missed', closed: T0 + 7200, R: 0 }, Le = { ...structuredClone(L), status: 'expired', closed: T0 + 7200, R: 0 };
const cancels = [...alertEvents([Lm], T0 + 7300).ev, ...alertEvents([Le], T0 + 7300).ev];
check('cancel alert when the limit expires or is missed (target first)', () => assert.equal(cancels.length, 2));
const Lf = { ...structuredClone(L), status: 'open', filled: T0 + 600 }; const filled = alertEvents([Lf], T0 + 700).ev;
check('fill of a ticketed limit says "Limit filled"', () => assert.match(filled[0].title, /^Limit filled/));
const Lc = { ...structuredClone(Lf), status: 'loss', R: -1, closed: T0 + 3600, exit: undefined }; const closedL = alertEvents([Lc], T0 + 3600 + 3 * 3600).ev;
check('close of a held futures position is still sent 3 h late (owner holds it)', () => { assert.equal(closedL.length, 1); assert.match(closedL[0].msg, /^CLOSE \d+ MGC/); });
check('a broken trade record does not throw', () => { const r = alertEvents([{ id: 'bad', market: 'xau', status: 'open', filled: 100 }, null], 160); assert.ok(r.errors.length >= 1); });

// the sends, with the network stubbed
const calls = []; const stub = async (url, o) => { calls.push({ url: url.replace(/bot[^/]+/, 'bot***'), body: JSON.parse(o.body) }); return { ok: true, status: 200 }; };
const sample = [...opens.slice(-2), ...closes.slice(-1), { title: 'Win +2.00R · NQ → test “quotes” _x_ *y*', msg: 'm', tags: 'x', click: null }];
const e1 = await sendAlerts(sample, { topic: 'test-topic', tgTok: 'TOKEN', tgChat: '1', fetchFn: stub });
check('ntfy gets JSON with the title intact (UTF-8, no header)', () => { const n = calls.filter((c) => c.url === 'https://ntfy.sh/'); assert.equal(n.length, sample.length); assert.equal(n.at(-1).body.title, sample.at(-1).title); assert.equal(n.at(-1).body.topic, 'test-topic'); });
check('Telegram is plain text (no parse_mode to escape for)', () => { const t = calls.filter((c) => /telegram/.test(c.url)); assert.equal(t.length, sample.length); assert.ok(t.every((c) => !('parse_mode' in c.body))); });
check('no errors with a working network', () => assert.deepEqual(e1, {}));
const e2 = await sendAlerts(sample, { topic: 't', tgTok: 'SECRET123', tgChat: '1', fetchFn: async (u) => { throw new Error(`boom ${u}`); } });
check('a network failure is returned, not thrown, and hides the bot token', () => { assert.ok(e2.ntfy && e2.telegram); assert.doesNotMatch(JSON.stringify(e2), /SECRET123/); });
const before = calls.length; await sendAlerts(sample, { topic: null, tgTok: null, fetchFn: stub });
check('no topic and no token: nothing sent', () => assert.equal(calls.length, before));

show('Sample: trade opens (last 4)', opens.slice(-4));
show('Sample: trade closes (last 3)', closes.slice(-3));
show('Sample: gold limit ticket, fill, cancel, close', [...placed, ...filled, cancels[0], ...closedL]);
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
