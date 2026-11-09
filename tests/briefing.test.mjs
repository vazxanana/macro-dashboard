// node --test tests/briefing.test.mjs — the veteran's briefing (council/briefing.mjs): analog finder (no look-ahead, similarity,
// outcomes), price levels, hypotheses and their record in the calls ledger. Offline, synthetic series.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as B from '../council/briefing.mjs';
import { callsLedger, resolveCall } from '../council/outlook.mjs';
import { freezeHypotheses } from '../council/veteran.mjs';

const DAY = 86400, FRI = Date.UTC(2026, 10, 6) / 1000, NOW = FRI + 22 * 3600;   // Friday 6 Nov 2026, after the close
const START = Date.UTC(2008, 0, 1) / 1000;
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// weekday series from START to `end`, a random walk (multiplicative or additive)
function walk(end, v0, step, add = false) { const out = []; let v = v0; for (let t = START; t <= end; t += DAY) { const d = new Date(t * 1000).getUTCDay(); if (d === 0 || d === 6) continue; v = add ? v + (rnd() - 0.5) * step : v * (1 + (rnd() - 0.5) * step); out.push({ t, v: +v.toFixed(add ? 4 : 5) }); } return out; }
function world(end = FRI + 60 * DAY) { seed = 11; return { gold: walk(end, 900, 0.024), dxy: walk(end, 80, 0.008), spx: walk(end, 1400, 0.025), ry: walk(end, 1.5, 0.06, true), y2: walk(end, 2, 0.06, true) }; }
const cut = (D, t) => Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.filter((o) => o.t <= t)]));
// paste the 420 days before `now` over the same weekdays `shift` days earlier: that past Friday has today's exact fingerprint
function plant(D, shift) { for (const s of Object.values(D)) { const by = new Map(s.map((o) => [o.t, o.v])); for (const o of s) if (o.t <= FRI - shift && o.t >= FRI - shift - 420 * DAY) o.v = by.get(o.t + shift); } return D; }

test('features: computed from data up to the date only (no look-ahead)', () => {
  const D = world(), at = FRI - 300 * DAY + (5 - new Date((FRI - 300 * DAY) * 1000).getUTCDay()) * DAY;
  const a = B.featuresAt(D, at), b = B.featuresAt(cut(D, at), at);
  assert.ok(a); assert.deepEqual(a, b);
  const E = world(); for (const s of Object.values(E)) for (const o of s) if (o.t > at) o.v *= 3;   // rewrite the future
  assert.deepEqual(B.featuresAt(E, at), a);
  for (const F of B.FEATURES) assert.ok(Number.isFinite(a[F.k]), F.k);
  assert.equal(B.featuresAt(cut(D, START + 200 * DAY), START + 200 * DAY), null, 'too little history');
});

test('analogs: the planted twin is found first at 100%, outcomes start after it, nothing after now is used', () => {
  const shift = 7 * 400 * DAY, D = plant(world(), shift), A = B.findAnalogs(D, NOW);
  assert.ok(A && A.top.length >= 10);
  assert.equal(A.top[0].date, new Date((FRI - shift) * 1000).toISOString().slice(0, 10)); assert.equal(A.top[0].sim, 100); assert.equal(A.top[0].dist, 0);
  for (let i = 1; i < A.top.length; i++) assert.ok(A.top[i].dist >= A.top[i - 1].dist, 'sorted by distance');
  // outcomes: from the first close after the analog Friday (the Monday), 5 and 20 closes on
  const g = D.gold, e = g.findIndex((o) => o.t > FRI - shift);
  assert.equal(new Date(g[e].t * 1000).getUTCDay(), 1);
  assert.equal(A.top[0].gold5, +((g[e + 5].v / g[e].v - 1) * 100).toFixed(2)); assert.equal(A.top[0].gold20, +((g[e + 20].v / g[e].v - 1) * 100).toFixed(2));
  // picks are 6+ weeks apart, 13+ weeks before now, with complete outcomes by now
  const ts = A.top.map((t) => Date.parse(t.date + 'T00:00:00Z') / 1000);
  for (const t of ts) { assert.ok(t <= NOW - 13 * 7 * DAY); for (const u of ts) if (u !== t) assert.ok(Math.abs(u - t) >= 6 * 7 * DAY); }
  // no look-ahead: data after now (here 60 more days) changes nothing
  const C = B.findAnalogs(cut(D, NOW), NOW); assert.deepEqual(B.stripPrivate(C), B.stripPrivate(A));
  const E = plant(world(), shift); for (const s of Object.values(E)) for (const o of s) if (o.t > NOW) o.v *= 0.5;
  assert.deepEqual(B.stripPrivate(B.findAnalogs(E, NOW)), B.stripPrivate(A));
  // stats: the analogs' 20-day hit rate and medians are over the picks
  assert.equal(A.stats.gold20.n, A.top.length); assert.equal(A.stats.gold20.up, +(A.top.filter((t) => t.gold20 > 0).length / A.top.length).toFixed(2));
  assert.ok(A.base.gold20.n > A.top.length); assert.ok(!('_paths' in B.stripPrivate(A)));
});

function bars(D, now) { return D.gold.filter((o) => o.t <= now).map((o, i, s) => ({ t: o.t, o: i ? s[i - 1].v : o.v, h: o.v * 1.004, l: o.v * 0.996, c: o.v })); }
test('levels: last week and last month, averages, swings, round numbers, each with a reason', () => {
  const D = world(), bs = bars(D, NOW), L = B.levelsFor({ bars: bs, now: NOW + 2 * DAY, step: 100 });   // Sunday: last week = the week just ended
  const wk = bs.filter((b) => b.t >= FRI - 4 * DAY && b.t <= FRI), oc = bs.filter((b) => b.t >= Date.UTC(2026, 9, 1) / 1000 && b.t < Date.UTC(2026, 10, 1) / 1000);
  const get = (re) => L.list.find((l) => re.test(l.label));
  assert.equal(get(/Last week's high/).price, +Math.max(...wk.map((b) => b.h)).toFixed(1)); assert.equal(get(/Last week's low/).price, +Math.min(...wk.map((b) => b.l)).toFixed(1));
  assert.equal(get(/October high/).price, +Math.max(...oc.map((b) => b.h)).toFixed(1));
  assert.equal(get(/20-day/).price, +(bs.slice(-20).reduce((a, b) => a + b.c, 0) / 20).toFixed(1));
  const rounds = L.list.filter((l) => l.kind === 'round').map((l) => l.price); assert.equal(rounds.length, 2); assert.ok(rounds.every((r) => r % 100 === 0));
  assert.ok(Math.min(...rounds) < L.px && Math.max(...rounds) > L.px);
  for (const l of L.list) { assert.ok(l.why.length > 20, l.label); assert.equal(l.side, l.price >= L.px ? 'above' : 'below'); }
  for (let i = 1; i < L.list.length; i++) assert.ok(L.list[i].price <= L.list[i - 1].price, 'sorted high to low');
  // midweek (Wednesday 11 Nov) the last complete week is still 2-6 Nov
  const M = B.levelsFor({ bars: bs, now: NOW + 5 * DAY, step: 100 }); assert.equal(M.list.find((l) => /Last week's high/.test(l.label)).price, get(/Last week's high/).price);
  const sh = L.list.find((l) => l.kind === 'swing' && l.side === 'above'); if (sh) assert.ok(sh.price > L.px);
  assert.equal(B.nearestLevel(L, 'above').side, 'above'); assert.ok(B.nearestLevel(L, 'above').dist >= 0.4);
});

test('race and range frequencies; the blend shrinks toward all weeks and stays in the band', () => {
  assert.equal(B.raceHit([0.002, 0.011, -0.02], 5, 0.01, 0.01, 1), true);
  assert.equal(B.raceHit([-0.012, 0.02], 5, 0.01, 0.01, 1), false, 'guard first');
  assert.equal(B.raceHit([-0.004, -0.011], 5, 0.01, 0.01, -1), true);
  assert.equal(B.raceHit([0.001, 0.002, 0.003, 0.004, 0.005, 0.02], 5, 0.01, 0.01, 1), false, 'outside the horizon');
  assert.equal(B.stayHit([0.01, -0.01, 0.005], 5, -0.02, 0.02), true); assert.equal(B.stayHit([0.01, -0.03], 5, -0.02, 0.02), false);
  assert.deepEqual(B.blend({ k: 10, n: 20 }, { k: 50, n: 100 }), { p: 0.5, analog: 0.5, k: 10, n: 20, all: 0.5, allN: 100 });
  assert.equal(B.blend({ k: 20, n: 20 }, { k: 95, n: 100 }).p, 0.9, 'clamped'); assert.equal(B.blend({ k: 0, n: 20 }, { k: 0, n: 100 }).p, 0.1);
  assert.equal(B.blend({ k: 15, n: 20 }, { k: 50, n: 100 }).p, 0.67);
});

test('briefing: ranked insights with evidence, dated hypotheses recorded once a week in the calls ledger and scored', () => {
  const shift = 7 * 400 * DAY, D = plant(world(), shift), S = { DFII10: D.ry, DGS2: D.y2, dxy: D.dxy, VIXCLS: D.spx.map((o) => ({ t: o.t, v: 18 })), VXVCLS: D.spx.map((o) => ({ t: o.t, v: 20 })) };
  const fc = { playbook: [{ title: 'Core CPI m/m', country: 'USD', at: new Date((NOW + 4 * DAY) * 1000).toISOString(), consensus: '0.2%', previous: '0.3%', scenarios: [{ name: 'hot', moves: { gold: 'down', eurusd: 'down', usdjpy: 'up' } }, { name: 'cool', moves: { gold: 'up', eurusd: 'up', usdjpy: 'down' } }] }], goldScore: { ok: true, score: 0.1, bias: 'AUCTION', label: 'AUCTION', asOf: '2026-11-06' } };
  const cot = { markets: [{ k: 'gold', name: 'Gold', asOf: '2026-11-03', pct: 92, net: 250000, chg1: 9000, chg4: 30000, z: 1.8, signals: [] }] };
  const b = B.briefing({ S, gold: D.gold.filter((o) => o.t <= NOW), goldBars: bars(D, NOW), dxy: D.dxy, spx: D.spx, fc, cot, now: NOW, week: '2026-10-31', tilt: 0 });
  assert.match(b.publicOnly, /non-public/);
  assert.ok(b.insights.length >= 3 && b.insights.length <= 6);
  assert.ok(b.insights.slice(0, 2).some((i) => i.k === 'event'), 'a CPI this week ranks near the top');
  for (const i of b.insights) { assert.ok(i.evidence.length); for (const e of i.evidence) { assert.ok(e.text && e.asOf && e.source, JSON.stringify(e)); } assert.ok(i.why && i.change); }
  for (let i = 1; i < b.insights.length; i++) assert.ok(b.insights[i].score <= b.insights[i - 1].score);
  assert.match(b.insights.find((i) => i.k === 'pos').title, /crowded long \(92nd percentile/);
  assert.ok(b.hypotheses.length >= 2 && b.hypotheses.length <= 3);
  for (const h of b.hypotheses) { assert.match(h.id, /^hyp:2026-10-31:H[123]$/); assert.ok(h.p >= 0.1 && h.p <= 0.9); assert.match(h.by, /^\d{4}-\d\d-\d\d$/); assert.ok(h.base.n >= 10 && h.base.allN > h.base.n); assert.ok(h.invalid && h.why); assert.equal(h.src, 'veteran hypothesis'); }
  const h1 = b.hypotheses.find((h) => h.slot === 'H1'); assert.ok(/firstTouch(Up|Down)/.test(h1.kind) && h1.guard != null && h1.level != null);
  if (h1.kind === 'firstTouchUp') assert.ok(h1.level > b.levels.gold.px && h1.guard < b.levels.gold.px); else assert.ok(h1.level < b.levels.gold.px && h1.guard > b.levels.gold.px);
  assert.ok(b.analogs && b.analogs.top.length && b.analogs.note.includes('not a tested edge'));
  // recorded once per slot and week, even when the levels move during the week
  const closes = { gold: D.gold, dxy: D.dxy };
  let L = callsLedger([], { outlook: null, closesBy: closes, now: NOW, extra: b.hypotheses });
  assert.equal(L.filter((r) => r.src === 'veteran hypothesis').length, b.hypotheses.length);
  assert.equal(L.find((r) => r.id === h1.id).guard, h1.guard);
  const moved = b.hypotheses.map((h) => ({ ...h, level: h.level != null ? h.level + 5 : h.level, claim: h.claim + ' (moved)' }));
  L = callsLedger(L, { outlook: null, closesBy: closes, now: NOW + DAY, extra: moved }); assert.equal(L.length, b.hypotheses.length, 'not twice');
  const fr = freezeHypotheses({ ...b, hypotheses: moved }, L); assert.equal(fr.hypotheses[0].claim, b.hypotheses[0].claim, 'the recorded version is shown'); assert.ok(fr.hypotheses[0].live); assert.equal(fr.record.open, b.hypotheses.length);
  // scored on the closes after the date like every other call
  L = callsLedger(L, { outlook: null, closesBy: closes, now: NOW + 40 * DAY });
  for (const r of L) { assert.equal(typeof r.hit, 'boolean', r.id); assert.ok(r.brier >= 0 && r.brier <= 1); }
});

test('the hypothesis kinds resolve on daily closes after the issue date', () => {
  const d = (s) => Date.parse(s + 'T00:00:00Z') / 1000, px = [['2026-11-10', 100], ['2026-11-11', 103], ['2026-11-12', 97], ['2026-11-13', 101]].map(([s, v]) => ({ t: d(s), v }));
  const at = d('2026-11-16');
  assert.equal(resolveCall({ kind: 'firstTouchUp', level: 102, guard: 98, issued: '2026-11-09', by: '2026-11-13' }, px, at), true);
  assert.equal(resolveCall({ kind: 'firstTouchUp', level: 104, guard: 98, issued: '2026-11-09', by: '2026-11-13' }, px, at), false);
  assert.equal(resolveCall({ kind: 'firstTouchDown', level: 98, guard: 102, issued: '2026-11-09', by: '2026-11-13' }, px, at), false, 'the guard came first');
  assert.equal(resolveCall({ kind: 'stayInside', lo: 96, hi: 104, issued: '2026-11-09', by: '2026-11-13' }, px, at), true);
  assert.equal(resolveCall({ kind: 'stayInside', lo: 98, hi: 104, issued: '2026-11-09', by: '2026-11-13' }, px, at), false);
  assert.equal(resolveCall({ kind: 'stayInside', lo: 96, hi: 104, issued: '2026-11-09', by: '2026-11-13' }, px, d('2026-11-13')), null, 'not before the date is final');
});

test('desk: the briefing section sits on top with the public-data-only note and reads the fields the briefing writes', () => {
  const html = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="c-brief"') < html.indexOf('class="top3"'), 'above the member cards');
  for (const id of ['brief-ins', 'brief-hyp', 'brief-lv', 'brief-an', 'brief-pub']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /renderBrief\(v\)/);
  for (const f of ['publicOnly', 'insights', 'hypotheses', 'levels', 'analogs', 'evidence', 'invalid', 'zNow', 'since', 'recent']) assert.ok(html.includes(f), f);
  assert.match(B.PUBLIC_ONLY, /Nothing on this page is, or uses, non-public information/);
});
