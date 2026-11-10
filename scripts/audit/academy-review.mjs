#!/usr/bin/env node
// MeridianX Academy: the lead's independent end-to-end review on REAL historical candles (not the recorded fixtures, no fakes).
//
//   node --use-env-proxy scripts/audit/academy-review.mjs [--sample 6] [--base https://meridianx.dev] [--skip-server]
//
// It reads live candles through the site's candle proxy (/md/bars), drives the real modules (MXR, MXA, MXK) and the real
// API handler on a temporary file store, and starts the local server twice to prove that what was saved survives a restart.
// It writes nothing outside a temp folder, places no order and contacts no host but the candle proxy. Exit 1 on any FAIL.
//
// Sections:  A timestamps against the live feed   B no look-ahead   C corrections persist and change later answers,
//            across a restart   D unseen setups stay apart from training   E results are after costs
//            F the risk engine cannot be bypassed   G all seven edges decide   H no route to a live order
//            I policy against the mechanical baseline: expectancy and drawdown (from the generated files)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MXR = require(path.join(ROOT, 'assets/academy-replay.js'));
const MXA = require(path.join(ROOT, 'assets/academy-core.js'));
globalThis.BT = require(path.join(ROOT, 'assets/backtest-engine.js'));
const MXK = require(path.join(ROOT, 'assets/academy-risk.js'));
const { handle } = require(path.join(ROOT, 'api/academy.js'));
const { EDGES } = await import(path.join(ROOT, 'academy/edges.mjs'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SAMPLE = +arg('--sample', 6), BASE = arg('--base', 'https://meridianx.dev'), SKIP_SERVER = process.argv.includes('--skip-server');
const hosts = new Set(); let calls = 0;
const netFetch = async (url, o) => { hosts.add(new URL(url, BASE).host); calls++; return fetch(url, o); };
const results = []; let section = '';
const check = (name, ok, detail = '') => { results.push({ section, name, ok: !!ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${section} ${name}${detail ? '  · ' + detail : ''}`); return !!ok; };
const note = (s) => console.log(`     ${s}`);
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const flagged = (c) => !!(c.rule && (c.rule.clockShift || c.rule.pre2020));
const unfilled = (o) => ['missed', 'expired', 'cancelled'].includes(o.reason);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const tstat = (a) => { const n = a.length, m = mean(a); if (n < 2) return null; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)); return sd ? m / (sd / Math.sqrt(n)) : null; };
const maxDD = (a) => { let eq = 0, peak = 0, dd = 0; for (const r of a) { eq += r; if (eq > peak) peak = eq; if (peak - eq > dd) dd = peak - eq; } return dd; };
const r2 = (v) => (v == null ? 'n/a' : (Math.round(v * 100) / 100).toFixed(2));

// the two clock rules, to find the weeks in which the United States is on daylight time and Europe is not
const nthSunday = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7 + 1; return Date.UTC(y, m, first + 7 * (n - 1)) / 1000; };
const lastSunday = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay()) / 1000; };
const mismatchWeek = (t) => { const y = new Date(t * 1000).getUTCFullYear(); const usOn = nthSunday(y, 2, 2) + 7 * 3600, euOn = lastSunday(y, 2) + 3600, euOff = lastSunday(y, 9) + 3600, usOff = nthSunday(y, 10, 1) + 6 * 3600; return (t >= usOn && t < euOn) || (t >= euOff && t < usOff); };

const cands = {}, outs = {};
for (const e of EDGES) { cands[e.id] = J(`academy/data/cand-${e.id}.json`); outs[e.id] = J(`academy/data/out-${e.id}.json`); }
const usable = (id, pool) => cands[id].filter((c) => !flagged(c) && (pool === 'exam' ? c.pool === 'exam' : c.pool !== 'exam'));
const spread = (rows, n) => { if (rows.length <= n) return rows.slice(); const step = rows.length / n; return Array.from({ length: n }, (_, i) => rows[Math.floor(i * step + step / 2)]); };

async function bars(sym, tf, from, to) { return MXR.load({ sym, tf, from, to, fetch: netFetch, base: BASE }); }
const lookback = (tf) => Math.round(300 * MXR.TF[tf] * 1.45) + 3 * 86400;
const seriesCache = new Map();
async function seriesFor(edge, t, extra = 0) {
  const key = `${edge.id}:${t}:${extra}`; if (seriesCache.has(key)) return seriesCache.get(key);
  const s = {}; let src = null;
  for (const tf of edge.contextTfs) { const b = await bars(edge.market, tf, t - lookback(tf), t + extra); s[tf] = b; src = src || b.src; }
  const v = { series: s, dataVersion: src || 'live proxy' }; seriesCache.set(key, v); return v;
}
const CAL = J('academy/data/calendar.json');
const calAt = (t) => (t < CAL.from || t > CAL.to ? {} : { events: CAL.items.filter((e) => e.t <= t && e.t > t - 7 * 86400), schedule: CAL.items.filter((e) => e.t > t && e.t <= t + 72 * 3600) });
function snap(edge, S, t, cand) { const s = MXR.snapshot({ edge: edge.id, market: edge.market, t, cand, series: S.series, dataVersion: S.dataVersion, ...calAt(t) }); MXR.guard(s); MXA.assertNoFuture(s); return s; }
const candView = (c) => { const o = {}; for (const k of ['id', 'edge', 'market', 't', 'side', 'entry', 'stop', 'target', 'tf', 'rule', 'edgeVersion', 'pool']) if (c[k] !== undefined) o[k] = c[k]; return o; };

// the API handler on a temp file store, called as the page calls it
const STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-review-'));
async function api(method, payload, who = { u: 'owner' }) {
  const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, { env: { ACADEMY_STORE_DIR: STORE }, who: async () => who, sameOrigin: () => true });
  return out;
}
const get = (q, who) => api('GET', q, who), post = (b, who) => api('POST', b, who);
const histFor = async (edge, cand) => ((await get({ get: 'history', edge: edge.id, cand: cand.id })).body.rows) || [];
async function decide(edge, c, lessons, S) {
  S = S || await seriesFor(edge, c.t); const s = snap(edge, S, c.t, candView(c)), acct = MXK.account(100000, { t: c.t });
  const risk = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: c.t }, acct, { riskPct: 0.25 });
  const d = MXA.decide(s, { lessons: lessons || [], history: await histFor(edge, c), risk, edgeDef: { version: edge.version, cost: edge.costPerRoundTrip } });
  return { s, d, risk, f: MXA.features(s) };
}
const attemptBody = (edge, c, mode, r, lessons) => ({ action: 'attempt', attempt: { candidateId: c.id, edge: edge.id, mode, decision: r.d, lessonsAvailable: (lessons || []).map((l) => l.id), snapshotHash: MXR.hash(r.s) }, features: r.f });

// ---------------------------------------------------------------------------------------------------------------- A
section = 'A';
{
  let all = 0, inside = 0, near = 0, off = 0, closed = 0, mm = 0, mmOk = 0; const offs = [];
  for (const e of EDGES) {
    const rows = usable(e.id, 'train').concat(usable(e.id, 'exam')).sort((a, b) => a.t - b.t), inMm = rows.filter((c) => mismatchWeek(c.t));
    const pick = spread(rows, SAMPLE).concat(spread(inMm, Math.min(inMm.length, Math.ceil(SAMPLE / 2))));
    let eIn = 0, eNear = 0, eOff = 0, eClosed = 0;
    for (const c of pick) {
      const b = (await bars(c.market, '5m', c.t - 1800, c.t + 1800)).filter((x) => x.time >= c.t - 600 && x.time <= c.t + 600);
      if (!b.length) { eClosed++; continue; }
      const hi = Math.max(...b.map((x) => x.high)), lo = Math.min(...b.map((x) => x.low)), risk = Math.abs(c.entry - c.stop) || 1, d = c.entry > hi ? c.entry - hi : c.entry < lo ? lo - c.entry : 0;
      const limit = c.rule && c.rule.order === 'limit', ok = d === 0 || limit || d / risk < 0.35;
      if (d === 0) eIn++; else if (ok) eNear++; else { eOff++; offs.push(`${c.id} entry ${c.entry} against ${lo}-${hi} (${r2(d / risk)}R)`); }
      if (mismatchWeek(c.t)) { mm++; if (ok) mmOk++; }
    }
    all += pick.length; inside += eIn; near += eNear; off += eOff; closed += eClosed;
    note(`${e.id}: ${pick.length} setups sampled (${inMm.length} usable in US / Europe mismatch weeks): ${eIn} inside the live candles, ${eNear} resting or within 0.35R, ${eOff} off, ${eClosed} stamped while the market was shut`);
  }
  check('sampled setups sit on the live feed\'s prices at their own signal time', off <= Math.max(1, Math.floor(all * 0.03)), `${inside + near} of ${all - closed} with candles; ${off} off${offs.length ? ': ' + offs.slice(0, 3).join('; ') : ''}`);
  check('setups inside the US / Europe mismatch weeks also sit on the live feed (the corrected clock)', mm === 0 ? true : mmOk === mm, mm === 0 ? 'none usable in those weeks: they are still flagged and left out' : `${mmOk} of ${mm}`);
  const left = EDGES.reduce((n, e) => n + cands[e.id].filter((c) => c.rule && c.rule.clockShift).length, 0);
  note(`setups still flagged clockShift in the generated files: ${left}`);
}

// ---------------------------------------------------------------------------------------------------------------- B + G
section = 'B';
const firstDecision = {};
{
  let snaps = 0, late = 0, same = 0, pairs = 0;
  for (const e of EDGES) {
    const rows = usable(e.id, 'train'), pick = [rows[Math.floor(rows.length * 0.55)], rows[Math.floor(rows.length * 0.9)]];
    for (const c of pick) {
      const r = await decide(e, c, []); snaps++;
      for (const tf of Object.keys(r.s.bars)) for (const b of r.s.bars[tf]) if (b.time + MXR.TF[tf] > c.t) late++;
      // the same decision point with three more days of candles loaded: the snapshot and the answer must not move
      const more = await seriesFor(e, c.t, 3 * 86400), r2nd = await decide(e, c, [], more); pairs++;
      if (MXR.hash(r.s) === MXR.hash(r2nd.s) && r.d.action === r2nd.d.action && JSON.stringify(r.d.supporting) === JSON.stringify(r2nd.d.supporting)) same++;
      if (!firstDecision[e.id]) firstDecision[e.id] = { c, r };
    }
  }
  check('no snapshot holds a bar that closes after its decision time', late === 0, `${snaps} snapshots on live candles`);
  check('loading three more days of candles changes neither the snapshot nor the answer', same === pairs, `${same} of ${pairs}`);
  let threw = 0; const e = EDGES[0], c = usable(e.id, 'train')[5], S = await seriesFor(e, c.t);
  try { snap(e, S, c.t - 3600, candView(c)); } catch (x) { threw++; }
  try { snap(e, S, c.t, { ...candView(c), netR: 1.2, exitT: c.t + 600 }); } catch (x) { threw++; }
  try { MXA.decide({ ...snap(e, S, c.t, candView(c)), bars: { ...snap(e, S, c.t, candView(c)).bars, '5m': [{ time: c.t + 300, open: 1, high: 1, low: 1, close: 1 }] } }, {}); } catch (x) { threw++; }
  check('a setup from the future, a setup carrying its outcome and a snapshot with a later bar are each refused', threw === 3, `${threw} of 3 refused`);
  const out0 = await get({ get: 'outcome', edge: e.id, id: c.id });
  check('the result of a setup is withheld until a decision for it is stored', out0.code === 403, `HTTP ${out0.code}`);
}

section = 'G';
{
  let stored = 0; const acts = [];
  for (const e of EDGES) {
    const { c, r } = firstDecision[e.id], a = await post(attemptBody(e, c, 'train', r, []));
    if (a.code === 200) stored++; acts.push(`${e.id} ${r.d.action}`);
  }
  check('each of the seven edges reaches a stored decision on live candles', stored === 7, acts.join(', '));
}

// ---------------------------------------------------------------------------------------------------------------- C
section = 'C';
let proof = null;
{
  // find a setup the engine takes, correct it to WAIT, save the lesson, then decide again from scratch
  let found = null;
  outer: for (const e of EDGES) { const rows = usable(e.id, 'train'); for (const c of spread(rows.slice(Math.floor(rows.length / 2)), 10)) { const r = await decide(e, c, []); if (r.d.action === 'BUY' || r.d.action === 'SELL') { found = { e, c, r }; break outer; } } }
  if (!check('a setup the engine takes was found to correct', !!found, found ? `${found.c.id}: ${found.r.d.action}` : 'none in the sample')) process.exit(1);
  const { e, c, r } = found, a1 = (await post(attemptBody(e, c, 'train', r, []))).body;
  const cor = (await post({ action: 'correct', edge: e.id, correction: { attemptId: a1.attempt.id, verdict: 'change', action: 'WAIT', reasons: ['session'], text: 'Review: wait here.' } })).body.correction;
  const draft = MXA.lessons.fromCorrection(r.d, cor, r.f), session = (draft.when || []).find((w) => w.f === 'session') || (draft.when || [])[0];
  const les = (await post({ action: 'lesson.save', lesson: { edge: e.id, title: 'Review lesson', text: draft.text || 'wait', when: [session], then: { action: 'WAIT' }, source: { attemptId: a1.attempt.id, correctionId: cor.id, candidateId: c.id } } })).body.lesson;
  check('the correction and the lesson are stored', !!(cor && cor.id && les && les.id && les.active), `${cor && cor.id} → ${les && les.id}`);
  const active = async () => (await get({ get: 'lessons', edge: e.id, active: '1' })).body.lessons;
  const again = await decide(e, c, await active()), a2r = await post(attemptBody(e, c, 'replay-same', again, await active())), a2 = a2r.body; if (a2r.code !== 200) note(`replay-same attempt answered HTTP ${a2r.code}: ${JSON.stringify(a2).slice(0, 200)}`);
  check('the same decision point, decided again from candles with the stored lesson, gives the corrected answer', again.d.action === 'WAIT' && MXR.hash(again.s) === MXR.hash(r.s) && again.d.lessonsApplied.some((l) => l.id === les.id && l.applied !== false), `${r.d.action} → ${again.d.action}, lesson ${les.id} applied, same snapshot`);
  check('the second attempt is a new row; the first is not rewritten', !!a2.attempt && a2.attempt.n === 2 && (await get({ get: 'attempts', edge: e.id, cand: c.id })).body.attempts[0].decision.action === r.d.action);
  const cmp = MXA.compare(r.d, again.d, cor);
  check('the comparison says learned, and says it is recall', cmp.verdict === 'learned' && cmp.lessonApplied === true, cmp.note || cmp.verdict);
  await post({ action: 'lesson.deactivate', id: les.id, reason: 'review' });
  const off = await decide(e, c, await active());
  check('with the lesson switched off a fresh decision returns to the first answer (the lesson, and nothing else, made the change)', off.d.action === r.d.action, `${off.d.action}`);
  await post({ action: 'lesson.deactivate', id: les.id, active: true });
  const onAgain = await decide(e, c, await active());
  check('switched on again, the corrected answer is back', onAgain.d.action === 'WAIT', onAgain.d.action);
  const rev = (await post({ action: 'lesson.revise', id: les.id, patch: { title: 'Review lesson, revised' } })).body, nowActive = await active(), revised = await decide(e, c, nowActive);
  check('a revision is a new version: the old one never fires again and the new one gives the corrected answer', !!rev.lesson && rev.lesson.id !== les.id && nowActive.length === 1 && nowActive[0].id === rev.lesson.id && revised.d.action === 'WAIT' && revised.d.lessonsApplied.every((l) => l.id !== les.id), `v${rev.lesson && rev.lesson.version} ${rev.lesson && rev.lesson.id}: ${revised.d.action}`);
  // an unrelated edge must not be touched by this lesson
  const other = EDGES.find((x) => x.id !== e.id), oc = firstDecision[other.id];
  const withAll = await decide(other, oc.c, (await get({ get: 'lessons', active: '1' })).body.lessons.filter((l) => l.edge === other.id || l.edge === '*'));
  check('the lesson does not fire on another edge', withAll.d.action === oc.r.d.action && !withAll.d.lessonsApplied.length, `${other.id}: ${withAll.d.action}`);
  proof = { e, c, first: r.d.action, lessonRoot: les.root || les.id };

  if (!SKIP_SERVER) {
    // a real restart: the local server is started on the same store, stopped, and started again
    const start = (port) => new Promise((res, rej) => { const p = spawn('node', [path.join(ROOT, 'scripts/academy-dev.mjs')], { env: { ...process.env, PORT: String(port), ACADEMY_STORE_DIR: STORE }, stdio: 'ignore' }); const t0 = Date.now(); const tick = async () => { try { const r = await fetch(`http://127.0.0.1:${port}/api/academy?get=lessons&edge=${e.id}&active=1`); if (r.ok) return res({ p, lessons: (await r.json()).lessons }); } catch (x) { /* not up yet */ } if (Date.now() - t0 > 15000) { p.kill(); return rej(new Error('the local server did not start')); } setTimeout(tick, 250); }; tick(); });
    try {
      const s1 = await start(8791); const att1 = await (await fetch(`http://127.0.0.1:8791/api/academy?get=attempts&edge=${e.id}&cand=${encodeURIComponent(c.id)}`)).json(); s1.p.kill(); await new Promise((r) => setTimeout(r, 400));
      const s2 = await start(8792); const att2 = await (await fetch(`http://127.0.0.1:8792/api/academy?get=attempts&edge=${e.id}&cand=${encodeURIComponent(c.id)}`)).json();
      const cor2 = await (await fetch(`http://127.0.0.1:8792/api/academy?get=corrections&edge=${e.id}&cand=${encodeURIComponent(c.id)}`)).json(); s2.p.kill();
      const afterRestart = await decide(e, c, s2.lessons);
      check('after the application is stopped and started again the lesson, the attempts and the correction are all still there', s2.lessons.length === 1 && JSON.stringify(s1.lessons) === JSON.stringify(s2.lessons) && att2.attempts.length === att1.attempts.length && att2.attempts.length >= 2 && cor2.corrections.length === 1, `${s2.lessons.length} lesson, ${att2.attempts.length} attempts, ${cor2.corrections.length} correction`);
      check('Replay and Prove gives the corrected answer after the restart, from the lessons the restarted server returns', afterRestart.d.action === 'WAIT', afterRestart.d.action);
    } catch (x) { check('the local server restarts on the same store', false, x.message); }
  }
}

// ---------------------------------------------------------------------------------------------------------------- D
section = 'D';
{
  const e = proof.e, ex = usable(e.id, 'exam'), x = ex[Math.floor(ex.length / 2)], rx = await decide(e, x, []);
  const asTrain = await post(attemptBody(e, x, 'train', rx, [])), asReplay = await post(attemptBody(e, x, 'replay-same', rx, []));
  check('an unseen (exam) setup is refused as a training attempt and as a same-trade replay', asTrain.code === 400 && asReplay.code === 400, `HTTP ${asTrain.code}, ${asReplay.code}`);
  const once = await post(attemptBody(e, x, 'exam', rx, [])), twice = await post(attemptBody(e, x, 'exam', rx, []));
  check('an unseen setup is decided once: a second decision is refused', once.code === 200 && twice.code >= 400, `HTTP ${once.code}, then ${twice.code}`);
  const list = (await get({ get: 'candidates', edge: e.id, pool: 'exam', limit: '5000' })).body.candidates;
  check('once decided it leaves the list of unseen setups', !list.some((k) => k.id === x.id), `${list.length} left`);
  const trainOnExam = await post(attemptBody(e, proof.c, 'exam', rx, []));
  check('a training setup can never be scored as an unseen test (a memorised example is not evidence)', trainOnExam.code === 400, `HTTP ${trainOnExam.code}`);
  let leaks = 0, rowsSeen = 0;
  for (const ed of EDGES) {
    const last = usable(ed.id, 'train').at(-1), h = (await get({ get: 'history', edge: ed.id, before: String(last.t + 9e8) })).body, trainDone = usable(ed.id, 'train').filter((c) => { const o = outs[ed.id][c.id]; return o && !unfilled(o); }).length;
    rowsSeen += h.total; if (h.total > trainDone || JSON.stringify(h).includes(`"${ed.id}-`)) leaks++;
  }
  check('past cases served to a decision hold training setups only, and no ids', leaks === 0, `${rowsSeen} rows across the seven edges`);
  const idx = J('ml/models/index.json'); let bad = 0; const seen = [];
  for (const m of idx.models) { if (m.scope === 'pooled' || !cands[m.edge]) continue; const n = usable(m.edge, 'train').filter((c) => { const o = outs[m.edge][c.id]; return o && !unfilled(o); }).length; seen.push(`${m.edge} ${m.trainRows}/${n}`); if (m.trainRows !== n) bad++; if (m.promoted !== false) bad++; }
  check('every scorer was fitted on exactly the filled training setups of its edge, and none is promoted', bad === 0, seen.join(', '));
  const rs = J('academy/data/research.json');
  check('the research file states it never read the unseen pool', /exam/i.test(JSON.stringify(rs.pool || rs.what || '')), String(JSON.stringify(rs.pool || '')).slice(0, 120));
}

// ---------------------------------------------------------------------------------------------------------------- E
section = 'E';
{
  let bad = 0; const lines = [];
  for (const e of EDGES) {
    const rows = cands[e.id].map((c) => ({ c, o: outs[e.id][c.id] })).filter((x) => x.o && !unfilled(x.o));
    const worse = rows.filter((x) => !(x.o.netR < x.o.R)).length;
    // trades without a pyramid add, per unit of size: the charge in price units should be the registry's cost per round trip
    const one = rows.filter((x) => !x.o.add && x.c.rule.risk > 0).map((x) => (x.o.R - x.o.netR) * x.c.rule.risk / (x.c.rule.size || 1)).sort((a, b) => a - b);
    const med = one.length ? one[Math.floor(one.length / 2)] : null, okCost = med == null || Math.abs(med - e.costPerRoundTrip) <= Math.max(0.02, e.costPerRoundTrip * 0.15);
    if (worse || !okCost) bad++;
    lines.push(`${e.id}: ${rows.length} filled, net below gross on all but ${worse}; median charge ${med == null ? 'n/a' : r2(med)} against ${e.costPerRoundTrip} ${e.costUnit || ''}`);
  }
  lines.forEach(note);
  check('every filled trade\'s net R is below its gross R, and the charge matches each edge\'s cost per round trip', bad === 0);
  const ev = J('academy/data/eval.json'); let mism = 0;
  for (const e of EDGES) { const rs = usable(e.id, 'train').map((c) => outs[e.id][c.id]).filter((o) => o && !unfilled(o)).map((o) => o.netR), m = ev.edges[e.id].mechanical; if (m.n !== rs.length || Math.abs(m.avg - mean(rs)) > 0.0006) mism++; }
  check('the published mechanical baselines equal a recomputation from the net results', mism === 0);
}

// ---------------------------------------------------------------------------------------------------------------- F
section = 'F';
{
  const e = proof.e, c = proof.c, acct = MXK.account(100000, { t: c.t });
  const noStop = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: null, target: c.target, t: c.t }, acct, {});
  const wrongSide = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.side === 'buy' ? c.entry + 5 : c.entry - 5, target: c.target, t: c.t }, acct, {});
  const ok = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: c.t }, acct, { riskPct: 0.25 });
  check('an order without a stop, or with the stop on the wrong side, is blocked', noStop.allowed === false && wrongSide.allowed === false, `${noStop.codes}; ${wrongSide.codes}`);
  check('an allowed order risks 0.25 % of the balance, never more', ok.allowed === true && ok.riskPct <= 0.2501, `${r2(ok.riskCash)} of 100,000`);
  const big = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: c.t }, acct, { riskPct: 5 });
  check('a request for more risk than the cap is not honoured', big.allowed === false || big.riskPct <= (MXK.DEFAULTS.maxRiskPct || 1) + 1e-9, `asked 5 %, got ${big.allowed ? r2(big.riskPct) + ' %' : 'blocked: ' + big.codes}`);
  let a = MXK.account(100000, { t: c.t }); a = { ...a, dayPnl: -1100, balance: 98900, equity: 98900 };
  const afterLoss = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: c.t }, a, {});
  note(`after a day loss past the limit: ${afterLoss.allowed ? 'allowed' : 'blocked (' + afterLoss.codes + ')'}`);
  // a lesson that says TAKE cannot push a trade through a risk block
  const S = await seriesFor(e, c.t), s = snap(e, S, c.t, candView(c));
  const take = { id: 'ls_review_take', version: 1, edge: e.id, active: true, title: 'take everything', when: [], then: { action: 'TAKE' } };
  const blocked = MXA.decide(s, { lessons: [take], history: [], risk: { allowed: false, blocks: ['daily loss limit reached'], riskPct: 0.25 }, edgeDef: { version: e.version, cost: e.costPerRoundTrip } });
  check('with the risk engine saying no, the answer is WAIT even when a lesson says take it', blocked.action === 'WAIT', `${blocked.action}: ${(blocked.waitReasons || [])[0] || ''}`.slice(0, 140));
  // the language-model analyst, when the module exists: its output is validated and cannot carry a trade past a hard gate
  const ap = path.join(ROOT, 'api/_academy-analyst.js');
  if (fs.existsSync(ap)) {
    const AN = require(ap), ctx = { edge: e.id, candidate: candView(c), deterministic: blocked, lessons: [], features: MXA.features(s) };
    const tryParse = (obj) => { try { return AN.parseAnswer(JSON.stringify(obj), ctx); } catch (x) { return { refused: [x.message] }; } };
    const forced = tryParse({ action: c.side === 'buy' ? 'BUY' : 'SELL', entry: c.entry, stop: c.stop, target: c.target, thesis: { bias: 'up', text: 'x' }, supporting: [], contradicting: [], uncertainty: [], waitReasons: [], invalidation: [], lessonsUsed: [], confidence: 'high' });
    const noStopAns = tryParse({ action: c.side === 'buy' ? 'BUY' : 'SELL', entry: c.entry, stop: null, target: c.target, thesis: { bias: 'up', text: 'x' }, supporting: [], contradicting: [], uncertainty: [], waitReasons: [], invalidation: [], lessonsUsed: [], confidence: 'high' });
    const finalAct = (v) => (v && (v.decision || v).action) || 'refused';
    check('a language-model answer that wants a trade through a risk block ends as WAIT (or is refused)', finalAct(forced) !== 'BUY' && finalAct(forced) !== 'SELL', finalAct(forced));
    check('a language-model answer without a stop is refused', finalAct(noStopAns) !== 'BUY' && finalAct(noStopAns) !== 'SELL', finalAct(noStopAns));
  } else note('the language-model analyst module is not in this build: its checks are skipped');
}

// ---------------------------------------------------------------------------------------------------------------- H
section = 'H';
{
  const files = ['academy.html', 'api/academy.js', 'api/_academy-store.js', 'api/_academy-llm.js', 'api/_academy-analyst.js', 'scripts/academy-dev.mjs'].concat(fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^academy/.test(f)).map((f) => 'assets/' + f)).filter((f) => fs.existsSync(path.join(ROOT, f)));
  const BAD = /ctrader|ProtoOA|NEW_ORDER|placeOrder|sendOrder|order_send|tradovate|tradestation|metaapi|council\/trader|ctrader-mirror|GH_TOKEN|CTRADER_|api\/run\b|\/api\/bridge|tv-webhook/i;
  const hits = files.filter((f) => BAD.test(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
  check('no Academy file names a broker, an order call, the trader, the mirror or their credentials', hits.length === 0, hits.length ? hits.join(', ') : `${files.length} files read`);
  const posts = Object.keys(require(path.join(ROOT, 'api/academy.js'))._t.POST);
  check('no API action places, sends or mirrors an order', !posts.some((p) => /order|trade\.|execute|broker|mirror|send/i.test(p)), posts.join(', '));
  check('this whole review contacted the candle proxy and nothing else', hosts.size === 1 && hosts.has(new URL(BASE).host), `${[...hosts].join(', ')} (${calls} requests)`);
  const anon = await get({ get: 'lessons' }, null), member = await post({ action: 'lesson.deactivate', id: 'x' }, { u: 'fred', role: 'reviewer' });
  check('signed out the API answers 401 and a member 403', anon.code === 401 && member.code === 403, `${anon.code}, ${member.code}`);
}

// ---------------------------------------------------------------------------------------------------------------- I
section = 'I';
{
  const ev = J('academy/data/eval.json'), tf = path.join(ROOT, 'academy/data/eval-trades.json'), per = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, 'utf8')) : null;
  console.log('     edge        every setup: n, R/trade, t, maxDD  |  policy takes: n, R/trade, t, maxDD  |  take minus wait (t)');
  for (const e of EDGES) {
    const x = ev.edges[e.id], rows = usable(e.id, 'train').map((c) => ({ c, o: outs[e.id][c.id] })).filter((r) => r.o && !unfilled(r.o)).sort((a, b) => (a.o.exitT || a.c.t) - (b.o.exitT || b.c.t)), mech = rows.map((r) => r.o.netR);
    let takeDD = 'n/a';
    if (per && per.edges && per.edges[e.id]) { const act = per.edges[e.id]; takeDD = r2(maxDD(rows.filter((r) => act[r.c.id] === 'TAKE' || act[r.c.id] === 'BUY' || act[r.c.id] === 'SELL').map((r) => r.o.netR))); }
    console.log(`     ${e.id.padEnd(10)}  ${String(mech.length).padStart(4)}, ${r2(mean(mech)).padStart(6)}, ${r2(tstat(mech)).padStart(5)}, ${r2(maxDD(mech)).padStart(6)}  |  ${String(x.take.n).padStart(4)}, ${r2(x.take.avg).padStart(6)}, ${r2(x.take.t).padStart(5)}, ${String(takeDD).padStart(6)}  |  ${r2(x.diff && x.diff.takeMinusWait)} (${r2(x.diff && x.diff.t)})  ${x.verdict || ''}`);
  }
  const better = EDGES.filter((e) => { const d = ev.edges[e.id].diff; return d && d.t >= 2; }).map((e) => e.id);
  note(`policy ${ev.policy || ''}: edges where taking beats waiting with t >= 2: ${better.length ? better.join(', ') : 'none'}`);
  check('the policy comparison is published with n and t for every edge (a negative or inconclusive result is a result)', EDGES.every((e) => ev.edges[e.id] && ev.edges[e.id].mechanical && ev.edges[e.id].take && ev.edges[e.id].diff));
}

const failed = results.filter((r) => !r.ok);
console.log(`\nAcademy review on live candles: ${results.length - failed.length} of ${results.length} checks passed (${calls} candle requests, store ${STORE})`);
fs.rmSync(STORE, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
