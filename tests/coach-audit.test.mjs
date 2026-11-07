// node --test tests/coach-audit.test.mjs — regression check: the Coach's new gates against the robustness audit's findings
// (research/robustness.md, #486). Fixture: tests/fixtures/coach-audit.json, built from council-data as of 7 Nov 2026
// (the 9 promotions the old rule made on the 150-day clean replay, with the stats of the 30-day windows that triggered them,
// and the 35 coach-stats / coach-backtest changes in config.json history).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shrink, ebTau, gateHistory, evidenceN } from '../council/coach.mjs';
import { promoteDemote } from '../council/proposals.mjs';
import { coachToggles } from '../research/robustness.mjs';

const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/coach-audit.json', import.meta.url), 'utf8'));
// n values with exactly this mean and sample sd, alternating around the mean (so both halves of the window share it)
function series(n, mean, sd) {
  const a = n % 2 ? 1 : Math.sqrt((n - 1) / n), out = [];
  for (let i = 0; i < n; i++) out.push(n % 2 && i === n - 1 ? mean : mean + sd * a * (i % 2 ? -1 : 1));
  return out;
}

test('fixture matches the audit: 9 promotions, windows at +0.24R, the next week −0.02R over 319', () => {
  const P = FX.promotions, nSel = P.reduce((s, p) => s + p.n, 0), sel = P.reduce((s, p) => s + p.mean * p.n, 0) / nSel;
  assert.equal(P.length, FX.audit.promotions.picks);
  assert.ok(Math.abs(sel - FX.audit.promotions.selMean) < 0.005, `selection mean ${sel}`);
  const fN = P.reduce((s, p) => s + p.fwdN, 0), fwd = P.reduce((s, p) => s + p.fwdExp * p.fwdN, 0) / fN;
  assert.ok(Math.abs(fN - FX.audit.promotions.n) <= 1); assert.ok(fwd < 0.01, `forward ${fwd}`);
});

test('promotions: every one of the 9 is blocked by the new gate (t >= 2 and shrunk expectancy over the bar)', () => {
  let tBlocks = 0, shrinkBlocks = 0;
  for (const p of FX.promotions) {
    const s = shrink(series(p.n, p.mean, p.sd), p.tau), t = s.mean / s.se, bar = p.kind === 'promoteIf' ? 0.15 : 0.10;
    assert.ok(Math.abs(s.mean - p.mean) < 1e-9 && Math.abs(s.sd - p.sd) < 1e-9, 'series reproduces the window');
    assert.ok(p.mean >= bar, `the old raw-mean rule passed ${p.at} ${p.setup}`);
    if (t < 2) tBlocks++;
    if (s.post < bar) shrinkBlocks++;
    assert.ok(t < 2 || s.post < bar, `${p.at} ${p.setup} ${p.value} would still be promoted (t ${t}, shrunk ${s.post})`);
  }
  assert.equal(tBlocks, 9, 'none of the windows had t >= 2 (best 1.68)');
  assert.equal(shrinkBlocks, 9, 'and shrinkage alone also blocks all 9 (best: 0.147 against the 0.15 promoteIf bar)');
  assert.deepEqual(FX.newRuleWalk, { picks: 0, n: 0 }, 'the same walk with the new promoteDemote promotes nothing');
});

test('promoteDemote: the first audited promotion (m15choch 6 Jul) passes the old rule, not the new one', () => {
  const p = FX.promotions[0], R = series(p.n, p.mean, p.sd), t0 = 1.78e9;
  const rows = R.map((r, i) => ({ setup: p.setup, market: 'xau', session: 'london', d1: 'with', rr: 2, opened: t0 + i * 3600, R: r }));
  const mid = t0 + R.length * 1800, m = (A) => A.reduce((s, x) => s + x.R, 0) / (A.length || 1);
  const halves = (A) => { const a = A.filter((x) => x.opened < mid), z = A.filter((x) => x.opened >= mid); return { h1: { n: a.length, exp: m(a) }, h2: { n: z.length, exp: m(z) } }; };
  const old = promoteDemote(rows, { filters: {} }, halves, 'x', { promote: { shrink: false } }).filter((x) => x.kind === 'promote');
  const neu = promoteDemote(rows, { filters: {} }, halves, 'x', { promote: { tau: p.tau } }).filter((x) => x.kind === 'promote');
  assert.equal(old.length, 1); assert.equal(neu.length, 0);
  // a real edge still gets through: 150 trades at +0.40R with sd 1 (t about 4.9)
  const good = series(150, 0.4, 1).map((r, i) => ({ setup: 'good', market: 'xau', session: 'london', d1: 'with', rr: 2, opened: t0 + i * 3600, R: r }));
  const mid2 = t0 + 75 * 3600, h2 = (A) => { const a = A.filter((x) => x.opened < mid2), z = A.filter((x) => x.opened >= mid2); return { h1: { n: a.length, exp: m(a) }, h2: { n: z.length, exp: m(z) } }; };
  const pr = promoteDemote(good, { filters: {} }, h2, 'x').filter((x) => x.kind === 'promote');
  assert.equal(pr.length, 1); assert.ok(pr[0].t > 4 && pr[0].shrunk >= 0.1);
});

test('toggles: the audit numbers before, and what the new gates would have let through', () => {
  const H = FX.history, before = coachToggles(H);
  assert.deepEqual(before, FX.audit.toggles, 'fixture reproduces the audit: 35 changes, median evidence 10, 20 of 26 under 30, 11 topics flipped');
  const { kept, blocked } = gateHistory(H), after = coachToggles(kept);
  assert.equal(kept.length + blocked.length, 35);
  assert.ok(kept.length <= 6, `${kept.length} changes still pass`);
  assert.equal(after.underThirty, 0, 'no change on fewer than 30 trades');
  assert.equal(after.flipped, 0, 'no topic changes twice inside 14 days');
  const why = (re) => blocked.filter((b) => re.test(b.blocked)).length;
  assert.equal(why(/^evidence/), 21, 'under 30 trades of evidence');
  assert.equal(why(/^pauses/), 5, 'pauses (off since the owner rule no-pause)');
  assert.equal(why(/^cool-down/), 3, 'same topic again inside 14 days (the minimum-stop ratchet, the rscalp D1 drop 10 h later)');
  assert.equal(why(/^t /), 1, 'rscalp New York skip: 31 trades at -0.51R is t -1.7 at the audited spread');
  assert.equal(kept.length, 5);
  // the Coach's own statistical changes: all blocked except the one with 30+ trades of evidence (a knob, once)
  const stats = kept.filter((h) => h.by === 'coach-stats');
  assert.ok(stats.length <= 1, stats.map((h) => h.change).join('; '));
});

test('evidence size is read from the change text', () => {
  assert.equal(evidenceN('-0.61R over 10 trades there'), 10);
  assert.equal(evidenceN('1013 trades over the last 30 days: no break-even'), 1013);
  assert.equal(evidenceN('5 of 20 recent losers (live and shadow)'), 20);
  assert.equal(evidenceN('Reviews: 4 losses came from high-impact news; no short-term trades from 15 min before'), 4);
  assert.equal(evidenceN('Four losses in a row'), 0);
});

test('empirical-Bayes tau in the audited windows is tight: dozens of groups that differ by little more than noise', () => {
  for (const p of FX.promotions) { assert.ok(p.groups >= 60); assert.ok(p.tau <= 0.25, `${p.at} tau ${p.tau}`); }
  assert.ok(ebTau([[1, -1, 1, -1, 1, -1, 1, -1, 1, -1]]) === 0.25);
});
