// The trade review, part 1 and its rule-based review (council/trade-review.mjs, 17 Nov 2026). Offline: a made-up desk in
// tests/fixtures/trade-review (built by make.mjs there), a temporary copy for the file side.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../council/trade-review.mjs';

const FX = new URL('./fixtures/trade-review/', import.meta.url).pathname, NOW = 1794700800;
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const J = () => T.main(FX, { dry: true, now: NOW }).J;
const copy = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trv-')); fs.cpSync(FX, d, { recursive: true }); return d; };

test('trade review: statistics helpers (Student t tail, Welch, Holm)', () => {
  assert.ok(Math.abs(T.pOfT(2, 10) - 0.0734) < 0.0005, `p ${T.pOfT(2, 10)}`);
  assert.ok(Math.abs(T.pOfT(1.96, 1e6) - 0.05) < 0.0005);
  assert.ok(Math.abs(T.pOfT(-2.228, 10) - 0.05) < 0.0005);
  assert.equal(T.pOfT(0, 5), 1);
  const w = T.welch([1, 2, 3, 4], [1, 2, 3, 4]); assert.equal(w.t, 0);
  assert.ok(T.welch([2, 3, 2, 3, 2], [-1, 0, -1, 0, -1]).t > 5);
  assert.deepEqual(T.holm([0.01, 0.04, 0.03]), [true, false, false]);
  assert.deepEqual(T.holm([0.001, 0.01, 0.2]), [true, true, false]);
  assert.equal(T.sessionOf(Date.UTC(2026, 10, 16, 2) / 1000), 'asia');
  assert.equal(T.sessionOf(Date.UTC(2026, 10, 16, 13) / 1000), 'overlap');
  assert.equal(T.hourBlock(Date.UTC(2026, 10, 16, 13) / 1000), '12-16');
});

test('trade review: exits are read by type', () => {
  assert.equal(T.exitType({ exitKind: 'target', status: 'win' }), 'target');
  assert.equal(T.exitType({ exitKind: 'stop', status: 'win', trailMoved: true }), 'trail');
  assert.equal(T.exitType({ exit: 'trailing stop', status: 'win' }), 'trail');
  assert.equal(T.exitType({ exitKind: 'time', status: 'loss' }), 'time');
  assert.equal(T.exitType({ exit: '48 h', status: 'win' }), 'time');
  assert.equal(T.exitType({ status: 'be' }), 'breakeven');
  assert.equal(T.exitType({ status: 'loss' }), 'stop');
  assert.equal(T.exitType({ status: 'win', R: 2, rr: 2 }), 'target');
});

test('trade review: streams by system and book; ICT, duplicates, replay rows and open trades never counted', () => {
  const R = J(), keys = R.systems.map((s) => s.key).sort();
  assert.deepEqual(keys, ['geg|live', 'nq-open:nyflip|live', 'replica|research', 'scalp|shadow']);
  assert.ok(!JSON.stringify(R.systems).includes('ict:nq-b-1'), 'no ICT record');
  const geg = R.systems.find((s) => s.key === 'geg|live');
  assert.equal(geg.windows.all.n, 3);   // the replay row and the open trade are not in it
  assert.equal(geg.windows.all.gross.sum, 0.4); assert.equal(geg.windows.all.net.sum, 0.22);
  assert.equal(geg.whereR.exits.trail.n, 1); assert.equal(geg.whereR.exits.stop.n, 2);
  assert.equal(geg.decay.status, 'healthy');
  const sc = R.systems.find((s) => s.key === 'scalp|shadow');
  assert.equal(sc.windows.all.n, 80); assert.equal(sc.windows.all.cost.known, 80); assert.equal(sc.windows.all.cost.perTrade, 0.08);
  assert.ok(sc.windows.d7.n < sc.windows.d30.n && sc.windows.d30.n < sc.windows.all.n);
  // demo slippage: the shadow book's account only (the ICT account's 9R copy is never read)
  assert.equal(sc.slippage.n, 30); assert.ok(Math.abs(sc.slippage.mean - 0.047) < 0.001);
  // loss reasons: the owner's tags first, else the Analyst's
  assert.deepEqual(sc.reviews.tags, { hunt: 2, noise: 3 });
  const rep = R.systems.find((s) => s.key === 'replica|research');
  assert.equal(rep.windows.all.cost.known, 0); assert.match(rep.review.head, /no cost on record/);
  assert.equal(R.systems[0].book, 'live');   // live streams first
});

test('trade review: every flag carries n and t; a split carries p and its Holm result', () => {
  const R = J();
  assert.ok(R.flags.length >= 3);
  for (const f of R.flags) {
    assert.ok(Number.isInteger(f.n) && f.n > 0, `${f.id} n`); assert.ok(Number.isFinite(f.t), `${f.id} t`);
    assert.ok(Math.abs(f.t) >= T.TR.FLAG_T, `${f.id} |t| >= 2`);
    if (f.split) { assert.ok(Number.isFinite(f.p), `${f.id} p`); assert.equal(typeof f.holm, 'boolean'); }
    assert.match(f.text, /t −?\d/);
  }
  const asia = R.flags.find((f) => f.id === 'scalp|shadow|weak-session:asia');
  assert.ok(asia && asia.n === 20 && asia.t < -2 && asia.holm === true);
  assert.equal(R.thresholds.splitTests > 0, true);
});

test('trade review: proposals carry evidence, the in-sample warning and the pre-registered test; never applied', () => {
  const R = J();
  assert.ok(R.proposals.length >= 2);
  for (const p of R.proposals) {
    assert.ok(p.flag && R.flags.some((f) => f.id === p.flag), 'names a flag of the file');
    assert.ok(Number.isFinite(p.evidence.n) && Number.isFinite(p.evidence.t));
    assert.equal(p.evidence.inSample, true); assert.match(p.evidence.warning, /In sample/);
    assert.equal(p.test.data, '2020-01-01 → now'); assert.match(p.test.split, /in sample 2020-2023, out of sample 2024/); assert.match(p.test.costs, /net of/);
    assert.match(p.test.how, /PREREGISTRATION\.md/);
    if (p.strong) assert.ok(p.evidence.n >= T.TR.STRONG_N && Math.abs(p.evidence.t) >= 2);
  }
  // the Asia session and the 00-04 UTC block are the same 20 trades here: proposed once
  assert.equal(R.proposals.filter((p) => /Asia|00-04/.test(p.change)).length, 1);
  assert.match(R.rule, /proposals only/); assert.match(R.rule, /ICT/);
});

test('trade review: the file side writes only research/trade-review.json, and an unchanged reading only every 6 hours', () => {
  const d = copy(), before = fs.readFileSync(path.join(d, 'config.json'), 'utf8');
  const a = T.main(d, { now: NOW });
  assert.equal(a.written, true);
  const f = JSON.parse(fs.readFileSync(path.join(d, T.OUT), 'utf8'));
  assert.equal(f.v, 1); assert.match(f.hash, /^[0-9a-f]{16}$/); assert.equal(f.at, new Date(NOW * 1000).toISOString());
  assert.equal(T.main(d, { now: NOW + 600 }).written, false);   // the same content 10 minutes later: left alone
  assert.equal(T.main(d, { now: NOW + T.REFRESH_S + 1 }).written, true);   // re-stamped after 6 hours
  assert.equal(fs.readFileSync(path.join(d, 'config.json'), 'utf8'), before);
  assert.equal(T.main(d, { now: NOW, dry: true }).written, false);
});

test('trade review: proposals only and ICT out, in the code itself', () => {
  const s = src('council/trade-review.mjs');
  assert.doesNotMatch(s, /writeAtomic\([^)]*config/); assert.doesNotMatch(s, /from '\.\/trader\.mjs'|ctrader-mirror|from '\.\.\/ict\//);
  assert.doesNotMatch(s, /'ict\/[a-z-]+\.json'/);   // no ICT file is read
  assert.equal((s.match(/writeAtomic\(/g) || []).length, 1);
});

test('trade review: the council loop runs it every 6th round under a timeout, and the data check watches its file', () => {
  const y = src('.github/workflows/council.yml');
  assert.match(y, /if \[ \$\(\(i % 6\)\) -eq 1 \]; then timeout 60 node council\/trade-review\.mjs data \|\| echo "Trade review round \$i failed"; fi/);
  assert.match(src('council/datahealth.mjs'), /file: 'research\/trade-review\.json'/);
});

test('trade review: nothing is proposed for a rule that no longer trades live or a shadow the owner stopped recording', () => {
  const D = T.readData(FX);
  const cut = T.build({ ...D, config: { shadowCut: { setups: ['scalp'], keep: [] } } }, { now: NOW });
  const sc = cut.systems.find((s) => s.key === 'scalp|shadow');
  assert.equal(sc.stopped, true); assert.match(sc.review.head, /no longer recorded/);
  assert.ok(sc.flags.length > 0, 'its flags are still reported');
  assert.equal(cut.proposals.filter((p) => p.system === 'scalp').length, 0);
  const live = { ...D, trades: D.trades.map((x) => (x.k === 'scalp' ? { ...x, shadow: false } : x)), config: { focusSetups: ['intraday'] } };
  const r = T.build(live, { now: NOW }), s2 = r.systems.find((s) => s.key === 'scalp|live');
  assert.equal(s2.retired, true); assert.equal(r.proposals.filter((p) => p.system === 'scalp').length, 0);
  assert.ok(T.build({ ...live, config: { focusSetups: ['scalp'] } }, { now: NOW }).proposals.some((p) => p.system === 'scalp' && p.book === 'live'));
});
