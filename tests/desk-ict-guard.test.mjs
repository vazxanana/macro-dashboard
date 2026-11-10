// node --test tests/desk-ict-guard.test.mjs — the guard of the ICT edge that a change to the ICT edge cannot edit away.
//
// The ICT edge's own files (api/_ictrules.js: ict/*.mjs, tests/ict-*.test.mjs, …) can be changed through the connector, and,
// once the owner switches it on, applied without the owner's review. THIS file is deliberately NOT named tests/ict-*: it is
// outside that allowlist, so no such change can touch it. The apply workflow runs main's copy of it against the changed ICT
// code (ICT_GUARD_ROOT = the pull request's checkout); the candles are always this copy's pinned fixtures.
//
// What it holds (absolute rules 1 and 2, and "ICT stays a separate edge"):
//   1. every signal signals() finds has a stop on the right side of its entry, a positive distance away;
//   2. every trade the replay simulates has a first stop on the right side of its entry, and a moved stop is never looser;
//   3. the ICT files import only node built-ins, each other, and the two council modules they import on main today;
//      nothing from api/, the mirror or any other council file;
//   4. no order-sending call, no broker API, no request that is not a read;
//   5. MARKETS / SHADOW_MARKETS describe paper markets only: no broker, account or credential in them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.ICT_GUARD_ROOT || path.join(HERE, '..'));   // the repository whose ICT code is checked
const ICT = path.join(ROOT, 'ict');
const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'fixtures', 'ict', 'bars.json.gz'))).toString('utf8'));
const T = await import(pathToFileURL(path.join(ICT, 'tracker.mjs')).href);
const R = await import(pathToFileURL(path.join(ICT, 'replay.mjs')).href);
const rows = (a) => a.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
// a second, longer candle path (deterministic, no network): more swings and sweeps than the pinned week holds
const noise = (t, s) => { let x = Math.imul((t / 60) ^ (s * 0x9e3779b1), 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x / 0xffffffff) * 2 - 1; };
const price = (t) => 10000 + 500 * Math.sin((2 * Math.PI * t) / (86400 * 23)) + 180 * Math.sin((2 * Math.PI * t) / (86400 * 3.1)) + 70 * Math.sin((2 * Math.PI * t) / (3600 * 9.3)) + 30 * noise(t, 1);
function synthetic(sec, from, n) {
  const out = []; for (let t = from; out.length < n; t += sec) { if (new Date(t * 1000).getUTCDay() === 6) continue;
    const o = price(t), c = price(t + sec); out.push({ time: t, open: +o.toFixed(2), high: +(Math.max(o, c) + Math.abs(noise(t, 2)) * 12 * Math.sqrt(sec / 3600)).toFixed(2), low: +(Math.min(o, c) - Math.abs(noise(t, 3)) * 12 * Math.sqrt(sec / 3600)).toFixed(2), close: +c.toFixed(2) }); }
  return out;
}
// every candle set the guard walks: the pinned futures candles of each market, and the synthetic path as an index and as gold
function sets() {
  const out = [];
  for (const [k, M] of Object.entries(T.MARKETS)) if (bars[k]) out.push({ k, M, H: rows(bars[k].h1), D: rows(bars[k].d1), m5: rows(bars[k].m5), src: 'pinned' });
  const t0 = Date.UTC(2024, 0, 1) / 1000, H = synthetic(3600, t0, 3000), D = synthetic(86400, t0 - 200 * 86400, 330);
  for (const k of ['nq', 'gc']) if (T.MARKETS[k]) out.push({ k, M: T.MARKETS[k], H, D, m5: [], src: 'synthetic' });
  return out;
}
const allSignals = (s) => [1, -1].flatMap((side) => T.signals(s.H, s.D, side, s.M.tick));
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

test('guard: every ICT signal has a stop, on the right side of its entry, a positive distance away', () => {
  let n = 0;
  for (const s of sets()) for (const g of allSignals(s)) {
    n++; const at = `${s.k} (${s.src}) signal at ${g.close}`;
    assert.ok(g.side === 1 || g.side === -1, `${at}: a side`);
    assert.ok(fin(g.entry) && fin(g.stop), `${at}: entry and stop are numbers (entry ${g.entry}, stop ${g.stop})`);
    assert.ok(fin(g.r0) && g.r0 > 0, `${at}: the stop distance r0 is positive (${g.r0})`);
    assert.ok(g.side * (g.entry - g.stop) > 0, `${at}: the stop ${g.stop} is on the losing side of the entry ${g.entry}`);
    assert.ok(Math.abs(g.side * (g.entry - g.stop) - g.r0) <= 1e-6 * Math.max(1, Math.abs(g.entry)), `${at}: r0 is the distance from the entry to the stop`);
  }
  assert.ok(n >= 1, 'the guard found no signal to check on its candles: a change that leaves nothing to check is the owner\'s to review');
});

test('guard: every trade the replay simulates has a stop on the right side of its entry; a moved stop is never looser', () => {
  let n = 0;
  for (const s of sets()) {
    const src = { H: s.H, D: s.D, m5: s.m5, m5days: new Set(s.m5.map((b) => Math.floor(b.time / 86400)).flatMap((d) => [d, d + 1])) };
    for (const g of allSignals(s)) for (const opt of [{}, ...(T.SHADOW && T.SHADOW.strail ? [{ strail: [T.SHADOW.strail.from, T.SHADOW.strail.piv] }] : [])]) {
      const x = R.simulate(g, s.M, s.k, src, Infinity, opt); if (!x) continue;   // null = a hole in the candles, no trade recorded
      n++; const at = `${s.k} (${s.src}) trade ${x.id}`, sd = x.side === 'buy' ? 1 : x.side === 'sell' ? -1 : 0, first = x.stop0 ?? x.stop;
      assert.ok(sd !== 0, `${at}: a side`);
      assert.ok(fin(x.entry) && fin(x.stop) && fin(first), `${at}: entry, stop and first stop are numbers`);
      assert.ok(fin(x.r0) && x.r0 > 0, `${at}: the stop distance r0 is positive (${x.r0})`);
      assert.ok(sd * (x.entry - first) > 0, `${at}: the first stop ${first} is on the losing side of the entry ${x.entry}`);
      assert.ok(sd * (x.stop - first) >= 0, `${at}: the stop was moved away from the trade (${first} to ${x.stop}); a stop may only tighten`);
      if (x.exit === 'stop' && fin(x.exitPx)) assert.ok(sd * (x.exitPx - first) >= -1e-9, `${at}: stopped out beyond its first stop`);
    }
  }
  assert.ok(n >= 1, 'the guard found no simulated trade to check on its candles: a change that leaves nothing to check is the owner\'s to review');
});

// ---- static checks on every ict/*.mjs of the checked repository ----
const files = fs.readdirSync(ICT).filter((f) => f.endsWith('.mjs')).sort();
const read = (f) => fs.readFileSync(path.join(ICT, f), 'utf8');
const BUILTIN = /^node:(fs|path|zlib|os|url|crypto|util|assert|assert\/strict|test)$/;
// what the ICT files import from outside ict/ on main today (10 Nov 2026), and nothing more: the news calendar for the
// jobs-report filter, and the Meridian structure reader for the paper-only 'h1opp' shadow variant. Listed per file.
const OUTSIDE = { 'tracker.mjs': ['../council/events.mjs', '../council/engine.mjs'] };
const CHILD = ['audit-test.mjs'];   // the audit starts the tracker on pinned files; no other ICT file may start a process
function specifiers(src) {
  const out = [];
  for (const m of src.matchAll(/\bfrom\s*(['"])([^'"\n]+)\1/g)) out.push(m[2]);
  for (const m of src.matchAll(/(?:^|[;\n])\s*import\s*(['"])([^'"\n]+)\1/g)) out.push(m[2]);
  for (const m of src.matchAll(/\b(?:import|require)\s*\(\s*([^)]*)\)/g)) { const lit = /^(['"])([^'"\n]+)\1$/.exec(m[1].trim()); out.push(lit ? lit[2] : `<computed: ${m[1].trim().slice(0, 40)}>`); }
  return out;
}
test('guard: the ICT files import node built-ins, each other, and only the council modules they import on main today', () => {
  assert.ok(files.includes('tracker.mjs') && files.includes('replay.mjs'), 'ict/tracker.mjs and ict/replay.mjs exist');
  for (const f of files) for (const sp of specifiers(read(f))) {
    const ok = BUILTIN.test(sp) || /^\.\/[A-Za-z0-9_-]+\.mjs$/.test(sp) || (OUTSIDE[f] || []).includes(sp) || (sp === 'node:child_process' && CHILD.includes(f));
    assert.ok(ok, `ict/${f} imports "${sp}": the ICT edge may import node built-ins and its own files only (plus ${JSON.stringify(OUTSIDE)}), never api/, the mirror or other council code`);
  }
});

const ORDERS = [/ProtoOA|NEW_ORDER|NewOrderReq|AMEND_(POSITION|ORDER)|CLOSE_POSITION|CANCEL_ORDER/, /\bctrader\b|\bopenapi\b/i, /\/v3\/accounts/i,
  /\b(place|send|submit|create|market|limit|new)_?Order\b/i, /tradovate|tradestation|interactivebrokers|\bibkr\b|alpaca|metatrader|\bmt[45]\b|fusionmarkets|pepperstone|icmarkets/i,
  /api\.kraken\.com\/0\/private|binance\.com\/api\/v3\/order|api-fxtrade|api-fxpractice/i, /method\s*:\s*(['"`])(POST|PUT|PATCH|DELETE)\1/i];
test('guard: no order-sending call, no broker API and no request that is not a read in the ICT files', () => {
  // whole-line comments may name the mirror (the tracker explains what never reaches it); code and trailing comments may not
  const code = (f) => read(f).split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  for (const f of files) { const src = code(f); for (const re of ORDERS) { const m = re.exec(src); assert.equal(m, null, `ict/${f} contains "${m && m[0]}": the ICT desk is paper only and sends nothing to a broker`); } }
});

const BROKER = /ctrader|fusion|tradovate|tradestation|interactive ?brokers|ibkr|alpaca|pepperstone|ic ?markets|oanda|metatrader|\bmt[45]\b|broker|account|login|password|secret|token|api_?key/i;
test('guard: MARKETS and SHADOW_MARKETS are paper markets only (no broker, account or credential in them)', () => {
  const all = { ...T.MARKETS, ...(T.SHADOW_MARKETS || {}) };
  assert.ok(Object.keys(T.MARKETS).length >= 1, 'MARKETS is not empty');
  for (const [k, M] of Object.entries(all)) {
    assert.match(k, /^[a-z0-9]{1,12}$/, `market key ${k}`);
    assert.ok(M && typeof M === 'object' && typeof M.tick === 'number' && M.tick > 0, `${k}: a positive tick`);
    for (const [key, v] of Object.entries(M)) {
      assert.ok(!BROKER.test(key), `market ${k} has a field "${key}": markets describe a paper feed, never a broker or an account`);
      for (const s of [].concat(v).filter((x) => typeof x === 'string')) assert.ok(!BROKER.test(s), `market ${k}.${key} = "${s}": no broker, account or credential in a market`);
      assert.ok(['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x === 'string')), `market ${k}.${key} is a plain value`);
    }
  }
});
