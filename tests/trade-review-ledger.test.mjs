// The trade review's proposal ledger and its forward check, and the pre-registration drafts (council/trade-review.mjs, 17 Nov
// 2026, "improve the brain"). Offline: hand-made rows and the made-up desk of tests/fixtures/trade-review.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../council/trade-review.mjs';

const FX = new URL('./fixtures/trade-review/', import.meta.url).pathname, NOW = 1794700800;
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const copy = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trl-')); fs.cpSync(FX, d, { recursive: true }); return d; };
const row = (t, o = {}) => ({ t, R: o.net ?? 0, net: o.net ?? 0, side: 'sell', session: 'asia', mfe: null, ...o });
const entry = (o = {}) => ({ id: 's|shadow#x', stream: 's|shadow', kind: 'weak-side', field: 'side', value: 'sell', recordedAt: 1000, evidence: { n: 40, mean: -0.2, t: -3 }, ...o });
// one trade every 5 hours: the rows span many UTC days ("held" needs the by-day t too since 20 Nov 2026)
const mk = (n, f) => Array.from({ length: n }, (_, i) => row(2000 + i * 18000, f(i)));

test('ledger: the forward check reads only trades closed AFTER the entry was recorded (no look-ahead, no reuse)', () => {
  const before = [], after = [];
  // up to the recording sells win big and buys lose (the opposite of the claim): they must not count
  for (let i = 0; i < 40; i++) before.push(row(500 + i, { side: i % 2 ? 'buy' : 'sell', net: i % 2 ? -5 : 5 }));
  before.push(row(1000, { side: 'sell', net: 50 }));   // closed exactly when it was recorded: not after it
  before.push(row(undefined, { side: 'sell', net: 50 }));   // no close time: never counted
  for (let i = 0; i < 60; i++) after.push(row(1001 + i * 18000, { side: i % 2 ? 'buy' : 'sell', net: (i % 2 ? 1 : -1) + (i % 3) * 0.1 }));
  const f = T.forwardCheck(entry(), before.concat(after));
  assert.equal(f.n, 30); assert.equal(f.rest.n, 30); assert.ok(f.t < -2); assert.equal(f.status, 'held');
  assert.ok(f.mean < 0 && f.mean > -1.1, 'the mean of the new sells only');
  const none = T.forwardCheck(entry(), before);
  assert.equal(none.n, 0); assert.equal(none.status, 'too few'); assert.equal(none.mean, null);
});

test('ledger: too few / held / faded / unclear', () => {
  assert.equal(T.forwardCheck(entry(), mk(30, (i) => ({ side: i % 2 ? 'buy' : 'sell', net: i % 2 ? 1 : -1 }))).status, 'too few', '15 sells is under 20');
  assert.equal(T.forwardCheck(entry(), mk(60, (i) => ({ side: i % 2 ? 'buy' : 'sell', net: i % 2 ? -1 + (i % 3) * 0.1 : 1 + (i % 3) * 0.1 }))).status, 'faded', 'the sign turned');
  assert.equal(T.forwardCheck(entry(), mk(80, (i) => ({ side: i % 2 ? 'buy' : 'sell', net: i % 4 < 2 ? 1 : -1 }))).status, 'faded', '|t| < 1');
  const u = T.forwardCheck(entry({ kind: 'losing', field: null, value: null }), mk(26, (i) => ({ net: i % 2 ? 0.7 : -1.3 })));
  assert.ok(Math.abs(u.t) >= 1 && Math.abs(u.t) < 2 && u.t < 0, `t ${u.t}`); assert.equal(u.status, 'unclear');
  // a stream-wide flag (losing) is a t against zero; the exit counterfactual is paired on the recorded MFE
  assert.equal(T.forwardCheck(entry({ kind: 'losing', field: null, value: null }), mk(25, (i) => ({ net: -1 + (i % 3) * 0.2 }))).status, 'held');
  assert.equal(T.forwardCheck(entry({ kind: 'exit-lock1R', field: 'exit', value: null, evidence: { n: 30, mean: 0.3, t: 2.5 } }), mk(25, (i) => ({ R: -1 + (i % 3) * 0.2, mfe: 1.2 }))).status, 'held');
});

test('ledger: each proposal recorded once, append-only, the old entries byte for byte', () => {
  const d = copy(), a = T.main(d, { now: NOW });
  assert.equal(a.ledgerWritten, true); assert.equal(a.ledgerAdded, a.proposals);
  const L1 = fs.readFileSync(path.join(d, T.LEDGER), 'utf8'), f1 = JSON.parse(L1);
  assert.equal(f1.entries.length, a.proposals); assert.match(f1.rule, /append-only/);
  for (const e of f1.entries) {
    assert.equal(e.recordedAt, NOW); assert.equal(e.id, T.ledgerId(e.stream, e.flag));
    assert.ok(Number.isFinite(e.evidence.n) && Number.isFinite(e.evidence.t));
  }
  const b = T.main(d, { now: NOW + 86400 });
  assert.equal(b.ledgerAdded, 0); assert.equal(b.ledgerWritten, false); assert.equal(fs.readFileSync(path.join(d, T.LEDGER), 'utf8'), L1);
  assert.equal(b.J.ledger.n, a.proposals); assert.equal(b.J.ledger.counts['too few'], a.proposals, 'no trade closed after the recording yet');
  for (const p of b.J.proposals) { assert.equal(p.forward.status, 'too few'); assert.equal(p.forward.n, 0); }
  // a new proposal later is appended after the old entries, which stay as they were
  const extra = { id: 'old|x#y', stream: 'old|x', flag: 'y', kind: 'losing', recordedAt: NOW - 86400, recorded: 'z', evidence: { n: 10, mean: -1, t: -3 } };
  const R = T.build({ ...T.readData(FX), ledger: { entries: [extra] } }, { now: NOW });
  assert.deepEqual(R.ledgerFile.entries[0], extra); assert.equal(R.ledgerFile.entries.length, 1 + a.proposals);
  assert.equal(R.ledger.items[0].forward.status, 'too few', 'a stream no longer on file: nothing to measure');
});

test('ledger: a proposal whose forward check faded is no longer strong (and gets no draft)', () => {
  const D = T.readData(FX), base = T.build(D, { now: NOW }), strong = base.proposals.find((p) => p.strong);
  assert.ok(strong && strong.prereg);
  const key = strong.flag.split('|').slice(0, 2).join('|'), f = base.flags.find((x) => x.id === strong.flag);
  // recorded before every fixture trade with the OPPOSITE sign: the trades since say the other thing
  const old = { id: T.ledgerId(key, strong.flag), stream: key, flag: strong.flag, kind: f.kind, field: f.field, value: f.value, recordedAt: NOW - 90 * 86400, recorded: 'x', evidence: { n: 40, mean: 0.5, t: -f.t } };
  const R = T.build({ ...D, ledger: { entries: [old] } }, { now: NOW }), p = R.proposals.find((x) => x.flag === strong.flag);
  assert.equal(p.forward.status, 'faded'); assert.equal(p.strong, false); assert.equal(p.fadedForward, true); assert.equal(p.prereg, undefined);
  // the same entry with the same sign: held, still strong
  const H = T.build({ ...D, ledger: { entries: [{ ...old, evidence: { ...old.evidence, t: f.t } }] } }, { now: NOW });
  const ph = H.proposals.find((x) => x.flag === strong.flag);
  assert.equal(ph.forward.status, 'held'); assert.equal(ph.strong, true);
});

test('ledger: a file that does not parse is never overwritten and nothing new is recorded', () => {
  const d = copy(); fs.mkdirSync(path.join(d, 'research'), { recursive: true }); fs.writeFileSync(path.join(d, T.LEDGER), '{ broken');
  const r = T.main(d, { now: NOW });
  assert.equal(r.ledgerWritten, false); assert.equal(fs.readFileSync(path.join(d, T.LEDGER), 'utf8'), '{ broken');
  assert.match(r.J.ledger.error, /could not be read/);
  assert.equal(r.written, true, 'the review itself is still written');
});

test('pre-registration drafts: one per strong proposal, with every part a study needs', () => {
  const R = T.main(FX, { dry: true, now: NOW }).J, S = R.proposals.filter((p) => p.strong);
  assert.ok(S.length >= 1);
  for (const p of R.proposals) assert.equal(!!p.prereg, !!p.strong);
  for (const p of S) {
    for (const h of ['# Pre-registration (draft)', '## Hypothesis', '## Data', '## Costs', '## Test statistic', '## Pass bar', 'H0:', '2020-01-01', 'In sample 2020-01-01 to 2023-12-31', 'out of sample 2024-01-01', 'calendar month', 'Holm', 'net of the council cost model', 'committed ALONE', 'not reused', 'absolute rule 3'])
      assert.ok(p.prereg.toLowerCase().includes(h.toLowerCase()), `${p.id}: ${h}`);
    assert.ok(p.prereg.includes(`n ${p.evidence.n}`));
  }
  // its date is the day the proposal was recorded, so the review's hash does not move from one day to the next
  const D = T.readData(FX), a = T.build(D, { now: NOW });
  const b = T.build({ ...D, ledger: { entries: a.ledgerFile.entries } }, { now: NOW + 3 * 86400 });
  assert.equal(b.proposals.find((p) => p.strong).prereg, a.proposals.find((p) => p.strong).prereg);
  assert.doesNotMatch(src('council/trade-review.mjs'), /mkdirSync/);   // no study folder is made
});

test('ledger: the data check watches the ledger file; the review file carries the summary', () => {
  assert.match(src('council/datahealth.mjs'), /file: 'research\/trade-review-ledger\.json'/);
  const J = T.main(FX, { dry: true, now: NOW }).J;
  assert.equal(J.ledger.file, T.LEDGER); assert.deepEqual(Object.keys(J.ledger.counts).sort(), ['faded', 'held', 'too few', 'unclear']);
  assert.match(J.ledger.rule, /never on the trades that suggested it/);
  assert.ok(!('ledgerFile' in JSON.parse(JSON.stringify(J))), 'the ledger file is not copied into the review file');
});

test('a proposal a committed study already answered is not strong and gets no draft', async () => {
  const { STUDIED, studiedOf } = await import('../council/trade-review.mjs');
  const fs = await import('node:fs');
  for (const [k, v] of Object.entries(STUDIED)) {
    const dir = new URL('../research/edge/' + v.study + '/', import.meta.url);
    assert.ok(fs.existsSync(new URL('RESULT.md', dir)) || fs.existsSync(new URL('result.json', dir)), k + ': study ' + v.study + ' is not in the repository');
  }
  assert.equal(studiedOf({ system: 'replica', action: 'one side only' }).study, 'replica-sides');
  assert.equal(studiedOf({ system: 'geg', action: 'one side only' }), null);
  const src = fs.readFileSync(new URL('../council/trade-review.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(st\) \{ p\.studied = \{ \.\.\.st, link: .+?\}; p\.strong = false; \}/);
  assert.ok(src.indexOf('p.studied =') < src.indexOf('if (p.strong) p.prereg'), 'studied is decided before the drafts are written');
});
