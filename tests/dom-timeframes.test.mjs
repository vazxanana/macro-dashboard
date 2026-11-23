// tests/dom-timeframes.test.mjs - the dominant-zone limit on four key timeframes (research/edge/dom-timeframes): stops on the
// losing side, no look-ahead by cutting the series, the bar, and RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHAINS, orders, judge, summ } from '../research/edge/dom-timeframes/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/dom-timeframes/', import.meta.url);
function seeded(n, seed = 7) {
  let a = seed, px = 1.2; const out = []; const t0 = Date.UTC(2014, 0, 6) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0015);
    const h = Math.max(o, px) + Math.abs(r) * 0.0005, l = Math.min(o, px) - Math.abs(r) * 0.0005; const t = t0 + i * 300;
    if (new Date(t * 1000).getUTCDay() === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}
const M5 = seeded(90000), FROM = M5[20000].t, TO = M5[M5.length - 1].t;

test('the four chains of the pre-registration', () => {
  assert.deepEqual(CHAINS, { T1: ['1d', '1h'], T2: ['4h', '15m'], T3: ['1h', '5m'], T4: ['30m', '5m'] });
});

test('every order has its stop on the losing side, past the zone', () => {
  const F = frames(M5); let n = 0;
  for (const [key, touch] of Object.values(CHAINS)) for (const o of orders(F, key, touch, 0.00006, FROM, TO)) {
    n++; assert.ok(o.d * (o.entry - o.stop) >= 2 * 0.00006); }
  assert.ok(n > 50, 'orders found: ' + n);
});

test('no look-ahead: orders known before a cut equal those of the series cut there', () => {
  const F = frames(M5); let n = 0;
  for (const [key, touch] of Object.values(CHAINS)) {
    const sec = { '5m': 300, '15m': 900, '1h': 3600 }[touch];
    for (const cut of [M5[45000].t, M5[70000].t]) {
      const Fc = frames(M5.filter((b) => b.t < cut));
      const a = orders(F, key, touch, 0.00006, FROM, TO).filter((o) => o.ts + sec <= cut).map((o) => JSON.stringify(o));
      const b = new Set(orders(Fc, key, touch, 0.00006, FROM, TO).filter((o) => o.ts + sec <= cut).map((o) => JSON.stringify(o)));
      for (const s of a) { n++; assert.ok(b.has(s), s); } } }
  assert.ok(n > 20);
});

test('the bar: both halves t >= 2 and Holm', () => {
  const mk = (t, v) => ({ t, trail: v, '2R': v, cr: 0.1 });
  const rows = []; for (let m = 0; m < 120; m++) { const t = Date.UTC(2010, m, 3) / 1000; rows.push(mk(t, 0.3 + (m % 3) * 0.1), mk(t + 86400, 0.2)); }
  const flat = rows.map((r, i) => ({ ...r, trail: i % 2 ? 1 : -1 }));
  const J = judge({ T1: rows, T2: flat, T3: flat, T4: flat });
  assert.equal(J.tests.T1.pass, true); assert.equal(J.tests.T2.pass, false); assert.equal(J.verdict, 'PARTIAL');
  assert.equal(summ(rows, 'trail').after, +(summ(rows, 'trail').before - 0.1).toFixed(4));
});

test('RESULT.md and result.json agree', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  assert.match(md[2], new RegExp(`^\\*\\*Verdict: ${R.verdict}\\. `));
  assert.ok(['PASS', 'FAIL', 'PARTIAL'].includes(R.verdict)); assert.equal(typeof R.headline, 'string');
  const txt = md.join('\n');
  for (const t of Object.values(R.tests)) {
    for (const h of ['early', 'late']) { assert.ok(txt.includes(t[h].n.toLocaleString('en-US')), t.chain + ' ' + h + ' n'); assert.ok(txt.includes(t[h].before.toFixed(3).replace('-', '−')) || txt.includes(t[h].before.toFixed(3)), t.chain + ' mean'); }
    assert.equal(t.pass, t.early.before > 0 && t.early.tBefore >= 2 && t.late.before > 0 && t.late.tBefore >= 2 && t.holm < 0.05);
  }
  assert.equal(R.passed, Object.values(R.tests).filter((t) => t.pass).length);
});
