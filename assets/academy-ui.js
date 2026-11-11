// MeridianX Academy page (MXAC): the Train loop of academy.html. Contract: docs/academy/ARCHITECTURE.md + MODULES.md.
//
// What this file does, in order: checks the owner (window.MX_ME), reads the setup, loads real candles with MXR.load, runs the
// replay clock (MXR.clock), pauses on each edge candidate, builds the Snapshot the decision is allowed to see (MXR.snapshot +
// MXR.guard + MXA.assertNoFuture), asks the risk engine (MXK.check) and the decision policy (MXA.decide), stores the attempt,
// takes the mentor's correction, drafts and saves the lesson, replays the same decision point to prove the lesson was applied
// (MXA.compare), and tests the lessons on unseen exam-pool setups. Everything shown is real persisted data from /api/academy.
// Replay and paper only: nothing in this file talks to a broker, and no order leaves the page.
//
// Look-ahead rules kept here: a candidate reaches a snapshot only at its own time t; charts show bars closed at the replay
// time plus one forming bar that is display only; an outcome is read only after the attempt for that setup is stored, and it
// goes to the paper ledger, never into a decision. window.MXAC.lastSnapshot is the last snapshot handed to a decision and
// window.MXAC.checks counts every one of them (future = snapshots holding a bar that ends after t; it must stay 0).
//
// The other sections (session, blind, progress, lessons, research, models, costs, audit) are filled by
// assets/academy-tabs.js through window.MXAC.registerTab(id, { title, render(section, ctx) }).
// ctx = { api: { get(query), post(body) }, edge() (the chosen edge id), edges() (the registry), me, kit, go(tab) }.
// ctx.kit holds the pieces the Train loop and those sections share: the DOM helpers, a chart on the page's look, candle
// loading, the one snapshot builder, the decision call, the decision panel, the lesson form, and per-run caches.
//
// The site's firewall allows 30 requests a minute per IP on /api. Every Academy call goes through MXAC.makeApi: at most
// PACE (24) calls in any minute, a wait and a retry on HTTP 429, POSTs one at a time. A replay run reads the candidates,
// the lessons, the calendar and the past cases once; one train decision then costs two calls (the stored attempt, then the session position, so a reload keeps the place). The Session tab does the same since round 3.
//
// The pure helpers at the top are also loaded by Node (tests/academy-ui.test.mjs, scripts/academy-dev.mjs).
(function (root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports;
  const MXR = NODE ? require('./academy-replay.js') : root.MXR;
  const MXA = NODE ? require('./academy-core.js') : root.MXA;
  const MXK = NODE ? require('./academy-risk.js') : root.MXK;

  // ---- pure helpers -------------------------------------------------------------------------------------------------
  const TFS = ['5m', '15m', '1h', '4h', '1d'];            // the timeframes every snapshot carries
  const HTFS = ['1h', '4h', '1d'];
  const DAY = 86400, LOOKBACK_BARS = 300, THESIS_EVERY = 12;   // candles between two no-candidate thesis updates
  const DIFFICULTY = ['beginner', 'intermediate', 'advanced', 'expert'];
  const TABS = [['train', 'Train'], ['session', 'Session'], ['blind', 'Blind arena'], ['progress', 'Progress'], ['lessons', 'Lessons'], ['research', 'Research'], ['models', 'Models'], ['costs', 'Costs'], ['audit', 'Audit']];
  const REASONS = [['missing-confirmation', 'missing confirmation'], ['wrong-structure', 'wrong structure'], ['liquidity', 'liquidity'], ['htf-bias', 'higher-timeframe bias'], ['session', 'session'],
    ['volatility', 'volatility'], ['rr', 'reward to risk'], ['news', 'news'], ['late', 'too late'], ['early', 'too early'], ['other', 'other']];
  const ANNOTATIONS = [['entry', 'entry'], ['stop', 'stop'], ['target', 'target'], ['liquidity', 'liquidity'], ['structure', 'structure'], ['sr', 'support / resistance'], ['supply-demand', 'supply / demand'], ['invalidation', 'invalidation']];
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const isTake = (a) => a === 'BUY' || a === 'SELL';
  const actOf = (side) => (side === 'buy' ? 'BUY' : side === 'sell' ? 'SELL' : null);

  // Seconds of history to load before a time so that a timeframe has its 300 closed bars: 300 bar widths, 45 % more for
  // weekends and holidays, and three days so a Monday start still reaches back over the weekend.
  const lookbackSec = (tf) => Math.round(LOOKBACK_BARS * MXR.TF[tf] * 1.45) + 3 * DAY;
  const dayStart = (t) => Math.floor(t / DAY) * DAY;
  const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  const dayToSec = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000; return Number.isFinite(t) ? t : null; };
  const fmtTime = (t) => (fin(t) ? new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'n/a');
  const fmtPrice = (v) => (fin(v) ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'none');
  const fmtR = (v) => (fin(v) ? (v > 0 ? '+' : '') + v.toFixed(2) + 'R' : 'n/a');
  const fmtCash = (v) => (fin(v) ? (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'n/a');
  // the chart timeframe an edge starts on: its signal timeframe when the page offers it, else 5 minutes (nq-open fires on 1m)
  const chartTfOf = (edge) => (edge && TFS.indexOf(edge.signalTf) >= 0 ? edge.signalTf : '5m');
  const htfFor = (tf) => (tf === '5m' || tf === '15m' ? '1h' : tf === '1h' ? '4h' : '1d');
  // Default range: the last `days` days of the candidates (sorted by t), never earlier than the first one. to is exclusive.
  function defaultRange(cands, days) {
    if (!Array.isArray(cands) || !cands.length) return null;
    const first = cands[0].t, last = cands[cands.length - 1].t;
    return { from: dayStart(Math.max(last - (days || 60) * DAY, first)), to: dayStart(last) + DAY };
  }
  // The first candidate not yet handled whose time lies in [fromT, t]: the one the clock has just reached.
  function dueCandidate(cands, fromT, t, done) {
    for (const c of cands) { if (c.t > t) break; if (c.t >= fromT && !(done && done.has(c.id))) return c; }
    return null;
  }
  const difficultyAllows = (level, d) => { const a = DIFFICULTY.indexOf(level), b = DIFFICULTY.indexOf(d); return a < 0 || b < 0 ? true : b <= a; };
  const costTotal = (c) => Math.round(['spread', 'commission', 'slippage'].reduce((s, k) => s + (c && fin(c[k]) && c[k] > 0 ? c[k] : 0), 0) * 1e6) / 1e6;
  const unfilled = (o) => !!o && (o.reason === 'missed' || o.reason === 'expired' || o.reason === 'cancelled');
  // Net R of an outcome at the costs set on the page. The outcome file charges the edge's own cost (R - netR); a different
  // cost per round trip scales that charge in proportion.
  function netRAt(o, edgeCost, userCost) {
    if (!o || !fin(o.netR)) return null;
    if (!fin(o.R) || !(edgeCost > 0) || !fin(userCost) || userCost === edgeCost) return o.netR;
    return Math.round((o.R - (o.R - o.netR) * (userCost / edgeCost)) * 10000) / 10000;
  }

  // lessons in plain English
  const REL = { biasAlign: 'higher-timeframe bias', ltfAlign: 'lower-timeframe structure', dispFor: 'displacement', sweepFor: 'the liquidity sweep', momFor: 'momentum' };
  const FEATURE_LABEL = { regime: 'regime', session: 'session', confirm: 'trigger candle', oppLiq: 'levels in the way', volState: 'volatility', rr: 'reward to risk', stopAtr: 'stop distance (ATR)',
    eventNear: 'high-impact event near', entryOffset: 'entry distance from the last close (ATR)', locFor: 'entry location', htfLtfConflict: 'higher and lower timeframes disagree', htfBias: 'higher-timeframe bias',
    side: 'side', volAbnormal: 'abnormal volatility', dow: 'day of week', hourUtc: 'hour (UTC)', biasAlign: 'higher-timeframe bias vs the trade', ltfAlign: 'lower-timeframe structure vs the trade',
    dispFor: 'displacement vs the trade', sweepFor: 'liquidity sweep vs the trade', momFor: 'momentum vs the trade', regimeHtf: 'higher-timeframe regime', entryZone: 'entry zone', displacement: 'displacement', sweep: 'sweep', momentum: 'momentum' };
  const featLabel = (k) => FEATURE_LABEL[k] || String(k);
  const valText = (v) => (v === true ? 'yes' : v === false ? 'no' : Array.isArray(v) ? v.join(', ') : String(v));
  function condText(c) {
    if (!c) return '';
    if (c.op === 'eq' && REL[c.f] && (c.v === 'with' || c.v === 'against')) return `${REL[c.f]} ${c.v} the trade`;
    const L = featLabel(c.f);
    if (c.op === 'eq') return `${L} = ${valText(c.v)}`;
    if (c.op === 'ne') return `${L} is not ${valText(c.v)}`;
    if (c.op === 'gte') return `${L} at least ${c.v}`;
    if (c.op === 'lte') return `${L} at most ${c.v}`;
    if (c.op === 'in') return `${L} is one of ${valText(c.v)}`;
    if (c.op === 'between') return `${L} between ${Array.isArray(c.v) ? c.v[0] + ' and ' + c.v[1] : '?'}`;
    return `${L} ${c.op} ${valText(c.v)}`;
  }
  const THEN_WORD = { WAIT: 'WAIT', SKIP: 'REFUSE the setup (wait)', TAKE: 'TAKE the edge\'s trade', FLIP: 'take the OTHER side' };
  function thenText(th) {
    const t = th || {}, parts = [];
    if (t.action) parts.push(THEN_WORD[t.action] || t.action);
    for (const k of ['entry', 'stop', 'target']) { const r = t.adjust && t.adjust[k]; if (r) parts.push(r.text || `${k}: ${r.k} ${r.unit === 'r' ? 'R' : 'ATR'} from ${r.ref}`); }
    return parts.length ? parts.join('; ') : 'nothing yet';
  }
  const lessonText = (l) => `When: ${((l && l.when) || []).map(condText).join(' AND ') || 'no condition yet'} → Then: ${thenText(l && l.then)}`;
  // a condition value typed by the mentor → the value the contract wants for that operator
  function parseValue(op, raw) {
    const s = String(raw == null ? '' : raw).trim(), one = (x) => { const y = x.trim(); if (y === 'true' || y === 'yes') return true; if (y === 'false' || y === 'no') return false; return y !== '' && Number.isFinite(+y) ? +y : y; };
    if (s === '') return { ok: false, error: 'give a value' };
    if (op === 'in') { const v = s.split(',').map(one).filter((x) => x !== ''); return v.length ? { ok: true, v } : { ok: false, error: 'give a list, separated by commas' }; }
    if (op === 'between') { const m = s.split(/\s*(?:\.\.|,|\bto\b|\band\b)\s*/).map((x) => +x); return m.length === 2 && m.every(Number.isFinite) && m[0] <= m[1] ? { ok: true, v: m } : { ok: false, error: 'give two numbers, low .. high' }; }
    if (op === 'gte' || op === 'lte') return Number.isFinite(+s) ? { ok: true, v: +s } : { ok: false, error: 'give a number' };
    return { ok: true, v: one(s) };
  }
  const valueToInput = (c) => (c.op === 'between' && Array.isArray(c.v) ? c.v[0] + ' .. ' + c.v[1] : Array.isArray(c.v) ? c.v.join(', ') : String(c.v));

  // The API stores a decision's lessonsApplied as { id, version, effect } only, so a stored decision has lost whether each
  // lesson was applied (MXA.compare then counts every listed lesson as applied). The engine's effect text still says it:
  // this puts `applied` back from that text. See the note in tests/academy-ui.test.mjs.
  const NOT_APPLIED = /not applied|rule rejected|matched, nothing to change/;
  function restoreApplied(decision) {
    if (!decision || !Array.isArray(decision.lessonsApplied)) return decision;
    return Object.assign({}, decision, { lessonsApplied: decision.lessonsApplied.map((l) => (typeof l.applied === 'boolean' ? l : Object.assign({}, l, { applied: String(l.effect || '').split('; ').some((p) => p && !NOT_APPLIED.test(p)) }))) });
  }

  // the mentor's form → the Correction the API takes (levels only on a changed BUY / SELL)
  function buildCorrection(form, attemptId) {
    const f = form || {}, verdict = f.choice === 'approve' ? 'approve' : f.choice === 'reject' ? 'reject' : 'change', action = verdict === 'change' ? f.choice : null, take = isTake(action);
    const n = (v) => (fin(v) ? v : null);
    return { attemptId, verdict, action, entry: take ? n(f.entry) : null, stop: take ? n(f.stop) : null, target: take ? n(f.target) : null, bias: f.bias || null, edge: f.edge || null,
      reasons: (f.reasons || []).slice(), text: String(f.text || '').trim(), annotations: (f.annotations || []).map((a) => ({ kind: a.kind, t: a.t, price: a.price, t2: fin(a.t2) ? a.t2 : null, price2: fin(a.price2) ? a.price2 : null, note: a.note || '' })) };
  }
  // why a correction cannot be saved yet (plain sentences), or [] when it can
  function correctionProblems(c, decision) {
    const out = [], d = decision || {};
    if (!c || !c.verdict || (c.verdict === 'change' && !c.action)) return ['Choose Approve, Reject or the action you would have taken.'];
    if (c.verdict === 'change' && c.action === 'WAIT' && d.action === 'WAIT') out.push('The engine already said WAIT: use Approve.');
    if (isTake(c.action)) {
      const dir = c.action === 'BUY' ? 1 : -1;
      if (!fin(c.entry) || !fin(c.stop)) out.push(`A ${c.action} needs an entry and a stop (every trade has a stop).`);
      else {
        if ((c.stop - c.entry) * dir >= 0) out.push(`The stop must be ${dir > 0 ? 'below' : 'above'} the entry for a ${c.action}.`);
        if (fin(c.target) && (c.target - c.entry) * dir <= 0) out.push(`The target must be ${dir > 0 ? 'above' : 'below'} the entry for a ${c.action}.`);
        if (c.action === d.action && c.entry === d.entry && c.stop === d.stop && (c.target == null ? null : c.target) === (d.target == null ? null : d.target)) out.push('That is the engine\'s own answer: use Approve, or move a level.');
      }
    }
    if (c.verdict !== 'approve' && !c.reasons.length && !c.text) out.push('Say why: pick a reason or write a line, so the lesson has something to learn from.');
    return out;
  }

  // Exam rows (GET ?get=exams) → the numbers of the "new setups" panel. A row is graded when both answers can be read off
  // the outcome file (WAIT = 0R, the candidate's own trade = its net R).
  const sameAnswer = (a, b) => !!a && !!b && a.action === b.action && (!isTake(a.action) || (a.entry === b.entry && a.stop === b.stop && (a.target == null ? null : a.target) === (b.target == null ? null : b.target)));
  function examSummary(rows) {
    const s = { n: 0, matched: 0, changed: 0, graded: 0, netWith: 0, netWithout: 0, neverFilled: 0, tooFew: true };
    for (const r of Array.isArray(rows) ? rows : []) {
      s.n++; if ((r.lessonIds || []).length) s.matched++; if (!sameAnswer(r.withLessons, r.withoutLessons)) s.changed++;
      if (unfilled(r.outcome)) s.neverFilled++;
      if (fin(r.rWith) && fin(r.rWithout)) { s.graded++; s.netWith += r.rWith; s.netWithout += r.rWithout; }
    }
    s.netWith = Math.round(s.netWith * 1000) / 1000; s.netWithout = Math.round(s.netWithout * 1000) / 1000; s.tooFew = s.graded < 20;
    return s;
  }
  const VERDICT_WORD = { learned: 'Learned', partly: 'Partly learned', 'not-learned': 'Not learned' };
  // The control of a same-trade replay: the same snapshot decided again with EVERY lesson switched off (a fresh thesis, the
  // same paper account). If that already gives the first answer, the only thing left to explain a changed answer is the
  // lessons in force. If it does not (the first sitting had a running thesis; the replay starts a fresh one), the change
  // cannot be credited to a lesson: a "learned" whose control already gives the mentor's answer is taken back to "partly".
  // → cmp with { control: { action, sameAsFirst, matchesCorrection, text } }
  function proveWithControl(cmp, first, control, correction) {
    const k = correction || {}, c = MXA.compare(first, control, k), m = c.matchesCorrection, lv = ['action', 'entry', 'stop', 'target'];
    const sameAsFirst = !c.changed.some((x) => lv.indexOf(x.field) >= 0), matches = k.verdict !== 'approve' && m.action === true && m.entry !== false && m.stop !== false && m.target !== false;
    const text = `Control: the same replay with every lesson switched off gives ${control.action}` + (sameAsFirst ? ', the first answer. Whatever changed came from the lessons in force and from nothing else.'
      : ', which is not the first answer. The first attempt was made with the running thesis of its sitting and this replay starts a fresh one, so part of the change is there without any lesson.');
    const out = Object.assign({}, cmp, { control: { action: control.action, sameAsFirst, matchesCorrection: matches, text } });
    if (cmp.verdict === 'learned' && matches) { out.verdict = 'partly'; out.note = 'the second attempt matches the correction, but the same replay with every lesson switched off gives that answer too: this replay does not show the lesson at work'; }
    return out;
  }
  // a candle-loading error in words the owner can act on
  function candleError(e) {
    const c = e && e.code;
    if (c === 'NO_SOURCE') return 'The server has no candle source configured (the market-data token is not set), so the replay cannot load candles.';
    if (c === 'NETWORK') return 'The candle service could not be reached. Check the connection and try again.';
    if (c === 'UPSTREAM') return 'The candle feed behind the server failed. Try again in a moment.';
    if (c === 'NO_BARS') return e.message;
    if (c === 'BAD_RANGE') return 'The date range is not valid: the end must be after the start.';
    return 'The candles could not be loaded: ' + String((e && e.message) || e);
  }
  // true when every bar of a snapshot had closed at its decision time
  function snapshotClean(snap) {
    if (!snap || !snap.bars) return false;
    for (const tf of Object.keys(snap.bars)) { const sec = MXR.TF[tf]; for (const b of snap.bars[tf]) if (!(b.time + sec <= snap.t)) return false; }
    return !(snap.cand && snap.cand.t > snap.t);
  }

  // The series a snapshot is built from: the edge's context timeframes from the registry (the same set the past-case
  // features were built with, so a live decision and its "similar past cases" are measured alike). Never a 1m series.
  function snapshotSeries(edge, series) {
    const tfs = edge && Array.isArray(edge.contextTfs) && edge.contextTfs.length ? edge.contextTfs.filter((tf) => TFS.indexOf(tf) >= 0) : TFS, out = {};
    for (const tf of tfs) if (Array.isArray(series[tf])) out[tf] = series[tf];
    return out;
  }
  // The release calendar (scheduled times of CPI, payrolls and FOMC, never a result) cut for a snapshot at t, by the same
  // rule as the dataset and GET ?get=calendar&t=: releases of the last 7 days at or before t, those due within 72 hours
  // after t, and nothing at all outside the calendar's span ("no calendar" is never read as "no event").
  function calendarCut(cal, t) {
    if (!cal || !Array.isArray(cal.items) || !fin(cal.from) || !fin(cal.to) || !fin(t) || t < cal.from || t > cal.to) return { events: null, schedule: null };
    const pick = (e) => ({ t: e.t, title: e.title, impact: e.impact });
    return { events: cal.items.filter((e) => e.t <= t && e.t > t - 7 * DAY).map(pick), schedule: cal.items.filter((e) => e.t > t && e.t <= t + 72 * 3600).map(pick) };
  }
  // The core writes one time as raw epoch seconds into text the mentor reads ("bias down since 1714608000"): show a date.
  // It also names lessons by their id ("conflicting lessons: ls_… vs ls_…"): with the lessons at hand the title is shown
  // instead (an id that is not among them stays as it is), and a doubled full stop left by a note ending in one is mended.
  // Display only: the stored text is never changed.
  const humanize = (s, lessons) => String(s == null ? '' : s).replace(/\bsince (\d{9,10})\b/g, (m, n) => 'since ' + fmtTime(+n))
    .replace(/\b(?:candidate )?[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-(\d{9,10})([sb])\b/g, (m, t, sd) => `the ${sd === 's' ? 'sell' : 'buy'} setup of ${fmtTime(+t)}`)   // a setup id (<edge>-<time><s|b>) in plain words
    .replace(/\bls_[0-9a-z]{6,}\b/g, (id) => { const l = Array.isArray(lessons) ? lessons.find((x) => x && x.id === id) : null; return l && l.title ? `"${l.title}"` : id; })
    .replace(/([^.\s])\.\.(?=\s|$)/g, '$1.');
  // Is a verdict being written that Continue would throw away? m = the mentor's form; m.dirty is set by every edit and
  // cleared when the correction is stored. True from the first choice, reason, word or mark until it is saved.
  const mentorUnsaved = (m) => !!m && !!m.dirty && !!(m.choice || (m.reasons || []).length || String(m.text || '').trim() || (m.annotations || []).length);
  // One question for every way of leaving a half-written answer (Train, Session, Blind arena). leaveGuard({ unsaved(), tell(),
  // now?, ms? }) → ok(): true when nothing unsaved is on the form, or when asked a second time within LEAVE_MS; the first
  // time it calls tell() (the page says "not saved") and returns false. ok.reset() forgets a first press. It only delays a
  // click: it stores nothing, sends nothing and decides nothing.
  const LEAVE_MS = 10000;
  function leaveGuard(o) {
    const now = o.now || (() => Date.now()), ms = o.ms || LEAVE_MS; let asked = 0;
    const ok = () => { if (!o.unsaved()) { asked = 0; return true; } const t = now(); if (asked && t - asked < ms) { asked = 0; return true; } asked = t; if (o.tell) o.tell(); return false; };
    ok.reset = () => { asked = 0; }; return ok;
  }
  // the one line under the chart when the clock stops on a setup: what was decided and where to go next
  function pointLine(o) {
    const x = o || {}, a = x.action || 'n/a', conf = x.confidence ? ` (${x.confidence} confidence)` : '';
    if (x.exam) return `Exam setup reached: the engine says ${a}. Its result is in the decision card.`;
    if (x.corrected) return `Setup reached: the engine says ${a}${conf}. Your verdict is saved: continue when you are ready.`;
    return `Setup reached: the engine says ${a}${conf}. Read why, then give your verdict.`;
  }

  // Past cases a decision at t may lean on, out of a list read once for a whole run (GET ?get=history&before=<end of the
  // range>): only cases whose trade had finished before t. The same cut the API makes for cand=, and MXA.decide drops
  // anything not finished by t again.
  const historyAt = (rows, t) => (Array.isArray(rows) ? rows.filter((r) => r && r.t < t && r.exitT < t) : []);

  // ---- the API wrapper ----------------------------------------------------------------------------------------------
  // makeApi({ fetch, sleep(ms), now(), perMinute (number or function), onWait(kind, seconds), base }) → { get, post, stats }
  //  - a sliding window: at most perMinute calls in any 60 seconds (0 = no pacing); a call over it waits its turn, in order;
  //  - HTTP 429: wait for Retry-After (else 5 s, doubling) and try again, TRIES in all. A blocked request never reached
  //    the handler, so sending it again cannot store anything twice. After the last try the call fails with status 429 and
  //    the caller says so: a write is retried or reported, never dropped silently;
  //  - POSTs run one at a time (the store has no compare-and-swap).
  // onWait('pace' | 'limit', seconds) is called before a wait and onWait(null, 0) after it.
  const PACE = 24, TRIES = 4, RETRY_MS = 5000;
  function makeApi(o) {
    const send = o.fetch, sleep = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))), now = o.now || (() => Date.now()), onWait = o.onWait || (() => {}), base = o.base || '/api/academy';
    const stamps = [], stats = { calls: 0, paced: 0, retries: 0 }; let chain = Promise.resolve(), gate = Promise.resolve();
    const limit = () => { const n = typeof o.perMinute === 'function' ? o.perMinute() : o.perMinute; return n > 0 ? n : 0; };
    function slot() {
      const run = async () => {
        for (;;) {
          const lim = limit(), t = now(); while (stamps.length && t - stamps[0] >= 60000) stamps.shift();
          if (!lim || stamps.length < lim) { stamps.push(t); return; }
          const ms = 60000 - (t - stamps[0]) + 50; stats.paced++; onWait('pace', Math.ceil(ms / 1000)); await sleep(ms); onWait(null, 0);
        }
      };
      const p = gate.then(run, run); gate = p.catch(() => {}); return p;
    }
    async function call(url, init) {
      let wait = RETRY_MS;
      for (let n = 1; ; n++) {
        await slot(); stats.calls++;
        let r; try { r = await send(url, init); } catch (e) { throw Object.assign(new Error('the Academy service could not be reached'), { status: 0 }); }
        if (r.status === 429 && n < TRIES) {
          const ra = parseFloat(r.headers && typeof r.headers.get === 'function' ? r.headers.get('Retry-After') : ''); let ms;
          if (Number.isFinite(ra) && ra >= 0) ms = Math.min(ra, 120) * 1000; else { ms = wait; wait *= 2; }
          stats.retries++; onWait('limit', Math.ceil(ms / 1000)); await sleep(ms); onWait(null, 0); continue;
        }
        let j = null; try { j = await r.json(); } catch (e) { /* no JSON body */ }
        if (!r.ok) throw Object.assign(new Error(r.status === 429 ? `the server is still limiting requests after ${TRIES} tries: wait a minute and try again` : (j && j.error) || 'the Academy service answered ' + r.status), { status: r.status });
        return j || {};
      }
    }
    const get = (q) => call(base + '?' + new URLSearchParams(q).toString(), { cache: 'no-store', credentials: 'same-origin' });
    const post = (body) => { const run = () => call(base, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const p = chain.then(run, run); chain = p.catch(() => {}); return p; };
    return { get, post, stats };
  }

  // A correction that could not be saved never costs the mentor's work: the form stays exactly as it is and the button
  // becomes "Try again". e = the failed call, fails = how many times in a row the server said it has no stored attempt for
  // this verdict (404), mode = the attempt's mode. → { text (plain words: what happened, what to do), restore }.
  // restore: after the second such answer the next press stores the page's own decision for this setup once more through
  // the usual attempt call (so every check of the server applies) and then saves the verdict on it. Never for a test on a
  // new setup or a blind attempt: those are decided once.
  function correctionFailure(e, fails, mode) {
    const st = e && e.status, msg = String((e && e.message) || 'unknown error'), keep = ' Your verdict is still here: nothing you chose, wrote or marked was lost.';
    if (st === 404 && /no such attempt/.test(msg)) {
      const restore = fails >= 2 && (mode == null || mode === 'train' || mode === 'replay-same');
      return { restore, text: 'The correction was not saved: the server could not find the stored decision this verdict belongs to.' + keep
        + (restore ? ' Press Try again: the page will store its decision for this setup once more, then save your verdict on it.' : ' Wait a few seconds, then press Try again.') };
    }
    const again = st === 0 || st === 429 || st >= 500;
    return { restore: false, text: 'The correction was not saved: ' + msg + '.' + keep + (again ? ' Check the connection, then press Try again.' : ' Change what the message names, then press Try again.') };
  }
  // The verdicts offered on a decision. The engine's own answer is never offered as a "change": a WAIT it already gave is
  // left out (that is Approve), and its own BUY / SELL is offered as the same trade on other levels.
  function mentorChoices(engineAction) {
    const out = [['approve', 'Approve'], ['reject', 'Reject']];
    for (const a of ['BUY', 'SELL']) out.push([a, a === engineAction ? `Keep ${a}, other levels` : `Change to ${a}`]);
    if (engineAction !== 'WAIT') out.push(['WAIT', 'Change to WAIT']);
    return out;
  }
  // the levels a changed BUY / SELL starts from: the setup's own, mirrored when the mentor takes the other side
  function mentorLevelsOf(c, choice) {
    if (!c || !isTake(choice)) return { entry: null, stop: null, target: null };
    if (actOf(c.side) === choice) return { entry: c.entry, stop: c.stop, target: c.target };
    return { entry: c.entry, stop: +(c.entry + (c.entry - c.stop)).toFixed(2), target: fin(c.target) ? +(c.entry - (c.target - c.entry)).toFixed(2) : null };
  }

  // ---- "What if": alternatives on the candles AFTER a stored decision (study only) -------------------------------------
  // Nothing here is part of a decision. The card exists only once the attempt for the setup is stored (whatIfAllowed), the
  // candles it loads never enter a snapshot, and its numbers are not stored anywhere.
  const WHATIF_CAP_BARS = 96, WHATIF_MAX_BARS = 2000, WHATIF_TOL = 0.15;
  // may the candles after this decision be read yet? train / same-trade replay: the attempt is stored; a test on a new setup:
  // the attempt AND its result (both answers) are stored; the blind arena: the attempt AND the mentor's answer are stored
  function whatIfAllowed(o) {
    const x = o || {}, c = x.cand || {}; if (!x.attemptId || !x.edge || !fin(c.t)) return false;
    if (x.mode === 'exam') return !!x.resultId; if (x.mode === 'blind') return !!x.blindId;
    return true;
  }
  // The candles to read: the edge's signal timeframe (5m when the page has no such series), from the candle that opens at
  // the decision time (or within 2 % of a candle before it: daily signals are stamped a few minutes after the open) for the
  // edge's maximum hold (plus the life of its resting order), else WHATIF_CAP_BARS candles.
  function whatIfWindow(edge, t) {
    const tf = chartTfOf(edge), sec = MXR.TF[tf], ex = (edge && edge.exit) || {}, hold = fin(ex.maxHoldH) && ex.maxHoldH > 0 ? ex.maxHoldH + (fin(ex.orderValidH) && ex.orderValidH > 0 ? ex.orderValidH : 0) : null;
    const floor = Math.floor(t / sec) * sec, from = t - floor <= sec * 0.02 ? floor : floor + sec, bars = Math.min(WHATIF_MAX_BARS, hold ? Math.ceil(hold * 3600 / sec) + 1 : WHATIF_CAP_BARS);
    return { tf, sec, from, to: from + bars * sec, bars, hold, why: hold ? `the edge's maximum hold (${hold} hours` + (fin(ex.orderValidH) && ex.orderValidH > 0 ? ', the life of its resting order included)' : ')') : `a cap of ${WHATIF_CAP_BARS} candles (the registry gives this edge no maximum hold)` };
  }
  const sameLevels = (a, b) => !!a && !!b && a.side === b.side && a.entry === b.entry && a.stop === b.stop && (a.target == null ? null : a.target) === (b.target == null ? null : b.target);
  // The rows of the table. o = { cand, engine: { action, entry, stop, target } | null, mentor: the same shape | null, mentorLabel }
  // → [{ key, label, side, entry, stop, target, afterBars, type?, wait? }]; a WAIT is a row that trades nothing (0R).
  function whatIfAlternatives(o) {
    const c = (o && o.cand) || {}, out = [], r2 = (v) => Math.round(v * 100) / 100, dir = c.side === 'buy' ? 1 : c.side === 'sell' ? -1 : 0;
    if (!dir || !fin(c.entry) || !fin(c.stop) || !((c.entry - c.stop) * dir > 0)) return out;
    const base = { side: c.side, entry: c.entry, stop: c.stop, target: fin(c.target) ? c.target : null, afterBars: 0 }, risk = Math.abs(c.entry - c.stop);
    out.push(Object.assign({ key: 'setup', label: 'The setup as the edge proposed it' }, base));
    const answer = (key, who, a) => {
      if (!a || !a.action) return;
      if (a.action === 'WAIT') { if (!out.some((x) => x.wait)) out.push({ key, label: `${who}: WAIT`, wait: true, side: null, entry: null, stop: null, target: null, afterBars: 0 }); return; }
      if (!isTake(a.action) || !fin(a.entry) || !fin(a.stop)) return;
      const row = { side: a.action === 'BUY' ? 'buy' : 'sell', entry: a.entry, stop: a.stop, target: fin(a.target) ? a.target : null, afterBars: 0 };
      if (!out.some((x) => sameLevels(x, row))) out.push(Object.assign({ key, label: `${who}: ${a.action}` + (row.side !== c.side ? ', the other side' : ' on other levels') }, row));
    };
    answer('engine', 'The engine\'s answer', o.engine); answer('mentor', o.mentorLabel || 'Your correction', o.mentor);
    out.push(Object.assign({}, base, { key: 'stop-half', label: 'Stop at half the distance', stop: r2(c.entry - dir * risk * 0.5) }));
    out.push(Object.assign({}, base, { key: 'stop-wide', label: 'Stop at one and a half times the distance', stop: r2(c.entry - dir * risk * 1.5) }));
    for (const k of [1, 2, 3]) out.push(Object.assign({}, base, { key: 'target-' + k + 'r', label: `Target at ${k}R`, target: r2(c.entry + dir * risk * k) }));
    out.push(Object.assign({}, base, { key: 'late', label: 'Entry one candle later, at its open', entry: null, type: 'market', afterBars: 1 }));
    return out;
  }
  // run the rows through MXA.simulate (evaluation only). costs = { spread, commission, slippage } in price units a round trip.
  function whatIfRun(alts, futureBars, costs) {
    const live = (alts || []).filter((a) => !a.wait), res = MXA.simulate(live.map((a) => ({ label: a.key, side: a.side, entry: a.entry, stop: a.stop, target: a.target, afterBars: a.afterBars, type: a.type })), futureBars, costs); let i = 0;
    return (alts || []).map((a) => Object.assign({}, a, { result: a.wait ? { filled: false, R: 0, netR: 0, exitT: null, reason: 'wait', mfeR: 0, maeR: 0, entryT: null, fill: null } : res[i++] }));
  }
  const WHATIF_REASON = { stop: 'stop', target: 'target', open: 'still open at the last candle read', 'no-fill': 'never filled', 'no-trade': 'no trade', 'bad-stop': 'not valid: the stop is not on the losing side of the fill', wait: 'no trade (a WAIT is 0R)' };
  // the simulated "setup as proposed" beside the stored outcome of the same setup: said plainly when they differ
  function whatIfNote(row, outcome) {
    const r = row && row.result, why = ' They can differ because the candles differ (these are the candle feed\'s, the stored result was made on the study\'s research candles) and because the study manages the trade its own way (break-even, trailed stop, pyramid adds, time exit), which a fixed stop and target does not copy.';
    if (!r) return 'Nothing was simulated.'; if (!outcome) return 'No stored result is on file for this setup, so there is nothing to compare the first row with.';
    const stored = unfilled(outcome) ? `the order never filled (${outcome.reason})` : `${fmtR(outcome.netR)} after costs, exit by ${outcome.reason || 'rule'}`, sim = r.filled ? `${fmtR(r.netR)}, exit by ${WHATIF_REASON[r.reason] || r.reason}` : WHATIF_REASON[r.reason] || 'never filled';
    if (unfilled(outcome) !== !r.filled) return `The first row does NOT match the stored result of this setup: simulated ${sim}; stored: ${stored}.` + why;
    if (!r.filled) return `The first row agrees with the stored result: the order did not fill in either (stored: ${outcome.reason}).`;
    const d = Math.round((r.netR - outcome.netR) * 100) / 100;
    return Math.abs(d) <= WHATIF_TOL ? `The first row agrees with the stored result of this setup within ${WHATIF_TOL}R: simulated ${sim}; stored ${stored}.`
      : `The first row does NOT match the stored result of this setup: simulated ${sim}; stored ${stored} (a difference of ${fmtR(d)}).` + why;
  }

  // The few lines of a decision kept in sight when its detail is folded: a WAIT's first reasons to wait, or the heaviest
  // evidence for a trade. → { kind: 'wait' | 'take', items: [text], more: how many of the same list are not shown }
  function mainReasons(d, n) {
    const k = n || 3, x = d || {};
    if (x.action === 'WAIT') { const all = (x.waitReasons || []).map(String); return { kind: 'wait', items: all.slice(0, k), more: Math.max(0, all.length - k) }; }
    const all = (x.supporting || []).slice().sort((a, b) => (fin(b.weight) ? b.weight : 0) - (fin(a.weight) ? a.weight : 0)).map((e) => String(e.text || e.factor || ''));
    return { kind: 'take', items: all.slice(0, k), more: Math.max(0, all.length - k) };
  }
  // the two lessons a decision names as conflicting (the engine's own words carry their ids), or null
  function conflictIds(d) {
    const x = d || {}, texts = [x.thesis].concat(x.waitReasons || [], x.uncertainty || [], x.notes || []);
    for (const t of texts) { const m = /conflicting lessons: (ls_[0-9a-z]+) vs (ls_[0-9a-z]+)/.exec(String(t || '')); if (m) return [m[1], m[2]]; }
    return null;
  }
  // saved sessions, the one saved last first (the API lists them in the order they were created)
  const latestFirst = (rows) => (Array.isArray(rows) ? rows.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))) : []);
  // kinds: 'replay' (a Train replay, the default), 'session' (a Session-tab sitting), or a list of both
  const unfinished = (rows, kinds) => { const ks = [].concat(kinds || 'replay'); return Array.isArray(rows) ? rows.find((s) => s && ks.indexOf(s.kind) >= 0 && s.status !== 'done') || null : null; };
  const REG = {};        // tabs registered by other files: id → { title, render }
  let onRegister = null;
  const MXAC = {
    VERSION: '1.1.0', PACE, TRIES, makeApi, historyAt, mentorLevelsOf, whatIfAllowed, whatIfWindow, whatIfAlternatives, whatIfRun, whatIfNote, WHATIF_REASON, WHATIF_CAP_BARS, WHATIF_TOL, fmtCash, isTake, actOf, fin, featLabel, VERDICT_WORD, TFS, HTFS, DIFFICULTY, TABS, REASONS, ANNOTATIONS, LOOKBACK_BARS, THESIS_EVERY,
    lookbackSec, dayStart, isoDay, dayToSec, fmtTime, fmtPrice, fmtR, chartTfOf, htfFor, defaultRange, dueCandidate, difficultyAllows, costTotal, unfilled, netRAt,
    condText, thenText, lessonText, parseValue, valueToInput, restoreApplied, proveWithControl, buildCorrection, correctionProblems, examSummary, sameAnswer, candleError, snapshotClean, snapshotSeries, calendarCut, humanize, mentorUnsaved, correctionFailure, leaveGuard, LEAVE_MS, pointLine, latestFirst, unfinished, mainReasons, conflictIds, mentorChoices,
    lastSnapshot: null, checks: { snapshots: 0, future: 0 }, whatIfLoads: [],
    registerTab(id, def) {
      if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,30}$/.test(id) || !def || typeof def.render !== 'function') throw new Error('MXAC.registerTab(id, { title, render }) needs a short id and a render function');
      REG[id] = { title: def.title ? String(def.title) : null, render: def.render };
      if (onRegister) onRegister(id);
    },
  };
  if (NODE) { module.exports = MXAC; return; }
  root.MXAC = MXAC;
  if (typeof document === 'undefined') return;

  // ---- the page -----------------------------------------------------------------------------------------------------
  // The ONLY browser storage of this page: three display preferences of this device (the edge used last, which parts of the
  // decision card are open, and the site's phone view `ms-phone`: "full", or no key for the simple view; the Desk, the Macro
  // desk and ChronosTrade use the same key, so one choice covers the site). Never a decision, a result, a lesson or anything
  // read from the API: those live on the server.
  const PREFS = ['mxacEdge', 'mxacFold', 'ms-phone'];
  function prefGet(k) { if (PREFS.indexOf(k) < 0) return null; try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function prefSet(k, v) { if (PREFS.indexOf(k) < 0) return; try { root.localStorage.setItem(k, String(v).slice(0, 400)); } catch (e) { /* private mode: not remembered */ } }
  function prefDel(k) { if (PREFS.indexOf(k) < 0) return; try { root.localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  const $ = (id) => document.getElementById(id);
  function el(tag, props) {
    const n = document.createElement(tag), p = props || {};
    for (const k of Object.keys(p)) {
      const v = p[k]; if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v; else if (k === 'disabled' || k === 'hidden' || k === 'checked' || k === 'selected') n[k] = !!v; else n.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, kid) { if (kid == null || kid === false) return; if (Array.isArray(kid)) kid.forEach((x) => add(n, x)); else n.appendChild(typeof kid === 'object' ? kid : document.createTextNode(String(kid))); }
  const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  const listOr = (ul, items, none, fn) => { clear(ul); if (!items.length) ul.appendChild(el('li', { class: 'none', text: none })); else items.forEach((x, i) => ul.appendChild(fn(x, i))); return ul; };
  const actClass = (a) => (a === 'BUY' ? 'buy' : a === 'SELL' ? 'sell' : 'wait');
  const actBadge = (a, small, id) => el('span', { class: 'act ' + actClass(a) + (small ? ' sm' : ''), id: id || null, text: a || 'n/a' });

  // /api/academy through the paced wrapper. While it waits, one calm line says so (it is not an error).
  const api = makeApi({ fetch: (url, init) => fetch(url, init), perMinute: () => (typeof root.MXAC_PACE === 'number' ? root.MXAC_PACE : PACE),
    onWait: (kind, sec) => { const n = $('ac-net'); if (!n) return; n.hidden = !kind; n.textContent = kind ? `Waiting for the server's rate limit… about ${sec} s. Nothing is lost: the page carries on by itself.` : ''; } });
  MXAC.api = api;

  const S = { me: null, edges: [], setup: null, cands: [], series: null, clock: null, account: null, thesis: null, lessons: [], cur: null, done: new Set(), open: [], closed: [], fromT: 0, sinceThesis: 0,
    pending: null, busy: false, loading: false, wasPlaying: false, future: null, sessionId: null, htf: '1h', dataVersion: null, poolToken: 0, lastBlock: null, exams: null, calendar: undefined };
  const CH = { main: null, series: null, htf: null, htfSeries: null, edgeLines: [], mentorLines: {}, annLines: [] };
  const M = { choice: null, entry: null, stop: null, target: null, bias: '', edge: '', reasons: [], text: '', annotations: [], arm: null, dirty: false };   // the mentor's form
  MXAC.point = () => (S.cur ? { cur: S.cur, setup: S.setup, thesis: S.thesis, lessons: S.lessons, cands: S.cands, done: S.done, open: S.open, sessionId: S.sessionId } : null);   // read-only view of the open decision point, for assets/academy-analyst.js

  // ---- the phone's simple view (11 Nov 2026) ---------------------------------------------------------------------------
  // Display only: no call, no decision, nothing stored but the one preference. The rules live in assets/academy.css under
  // `@media (max-width: 640px)` and `html[data-phone="simple"]` (the attribute the page head sets, on a phone only, unless
  // this device chose the full view); outside them every piece below is inert:
  //   .pm-host > .pm     parts of a host that wait behind its `button.pmore` (the host gets .pm-open)
  //   .pcard             a card that folds to its heading, opened by the chevron `pfold` puts in that heading
  //   #tab-more          the sections a learner seldom opens sit behind "More" in the tab bar (TAB_MORE)
  //   #pv                the "Phone view: Simple | Full" switch; Full is the phone page as it was
  const TAB_MORE = ['research', 'models', 'costs', 'audit'];
  const isSimple = () => document.documentElement.getAttribute('data-phone') === 'simple';
  function moreToggle(btn) { const host = btn.closest('.pm-host'); if (!host) return; const on = !host.classList.contains('pm-open'); host.classList.toggle('pm-open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  // a "more" button for a host drawn by the page code; it comes back in the state the host was left in
  const moreBtn = (host, id, label) => el('button', { type: 'button', class: 'btn sm pmore', id, 'aria-expanded': host.classList.contains('pm-open') ? 'true' : 'false', text: label, onclick: (e) => moreToggle(e.currentTarget) });
  const PF = {};   // which folded cards were opened, this visit only (a section is drawn again each time it is shown)
  function pfold(card, name) {
    const head = card && card.firstElementChild; if (!head || card.querySelector(':scope > * > .pc-t')) return card;
    const key = card.id || name, label = name || (head.querySelector('b') || head).firstChild.textContent.trim();
    const set = (on) => { card.classList.toggle('pm-open', on); b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.setAttribute('aria-label', (on ? 'Hide: ' : 'Show: ') + label); };
    const b = el('button', { type: 'button', class: 'pmore pc-t', onclick: () => { PF[key] = !card.classList.contains('pm-open'); set(PF[key]); } });
    card.classList.add('pcard'); head.appendChild(b); set(!!PF[key]); return card;
  }
  function setPhoneView(v) {
    if (v === 'full') prefSet('ms-phone', 'full'); else prefDel('ms-phone');   // the site's convention: "full", or no key
    if (typeof root.msPhoneSet === 'function') root.msPhoneSet();               // the head script reads the key and sets the attribute
    syncPhoneView(); resizeCharts();
  }
  function syncPhoneView() { document.querySelectorAll('#pv [data-pv]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.pv === 'full') !== isSimple()))); }
  document.querySelectorAll('#pv [data-pv]').forEach((b) => b.addEventListener('click', () => { setPhoneView(b.dataset.pv); const t = $('ac-tabs'); if (t) t.scrollIntoView({ block: 'start' }); }));
  document.querySelectorAll('button.pmore[id]').forEach((b) => b.addEventListener('click', () => moreToggle(b)));
  document.querySelectorAll('#ac-train .pcard').forEach((c) => pfold(c));
  syncPhoneView(); document.addEventListener('ms:phone', syncPhoneView);

  // ---- tabs -----------------------------------------------------------------------------------------------------------
  let activeTab = 'train', tabsMore = false;
  const ctx = () => ({ api, edge: () => (S.setup ? S.setup.edge.id : $('f-edge').value || null), edges: () => S.edges.slice(), me: S.me, kit: MXAC.kit, go: showTab });
  function tabList() { const ids = TABS.map((t) => t[0]); for (const id of Object.keys(REG)) if (ids.indexOf(id) < 0) ids.push(id); return ids; }
  const tabTitle = (id) => (REG[id] && REG[id].title) || (TABS.find((t) => t[0] === id) || [id, id])[1];
  function renderTabs() {
    const bar = clear($('ac-tabs'));
    for (const id of tabList()) {
      if (!$('ac-' + id)) $('ac-app').appendChild(el('section', { id: 'ac-' + id, role: 'tabpanel', 'aria-labelledby': 'tab-' + id, tabindex: '-1', hidden: true }));
      bar.appendChild(el('button', { type: 'button', role: 'tab', id: 'tab-' + id, class: TAB_MORE.indexOf(id) >= 0 ? 'tab-2' : null, 'aria-controls': 'ac-' + id, 'aria-selected': id === activeTab ? 'true' : 'false', tabindex: id === activeTab ? '0' : '-1', onclick: () => showTab(id) }, tabTitle(id)));
    }
    // phones, simple view: the sections in TAB_MORE wait behind this button (it is not drawn anywhere else)
    bar.appendChild(el('button', { type: 'button', id: 'tab-more', class: 'pmore', 'aria-expanded': 'false', text: 'More', onclick: () => { tabsMore = !bar.classList.contains('more-open'); syncTabsMore(); } }));
    syncTabsMore();
  }
  function syncTabsMore() { const bar = $('ac-tabs'), b = $('tab-more'), on = tabsMore || TAB_MORE.indexOf(activeTab) >= 0; bar.classList.toggle('more-open', on); if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  function showTab(id) {
    activeTab = id; tabsMore = false; syncTabsMore();
    { const m = document.querySelector('main'); if (m) m.classList.toggle('hero-min', id !== 'train'); }   // the hero keeps its full size on Train only
    for (const t of tabList()) { const sec = $('ac-' + t), btn = $('tab-' + t); if (sec) sec.hidden = t !== id; if (btn) { btn.setAttribute('aria-selected', t === id ? 'true' : 'false'); btn.tabIndex = t === id ? 0 : -1; } }
    if (id === 'train') { resizeCharts(); return; }
    if (S.clock && S.clock.state().playing) { S.clock.pause(); draw(); }
    const sec = $('ac-' + id);
    if (REG[id]) { try { const r = REG[id].render(sec, ctx()); if (r && typeof r.catch === 'function') r.catch((e) => { clear(sec).appendChild(el('p', { class: 'ac-err', text: 'This section failed to draw: ' + e.message })); }); } catch (e) { clear(sec).appendChild(el('p', { class: 'ac-err', text: 'This section failed to draw: ' + e.message })); } }
    else clear(sec).appendChild(el('p', { class: 'ac-err', text: 'This section did not load (assets/academy-tabs.js is missing). Reload the page.' }));
  }
  $('ac-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    const ids = tabList(), i = ids.indexOf(activeTab), j = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length;
    e.preventDefault(); e.stopPropagation(); showTab(ids[j]); $('tab-' + ids[j]).focus();
  });
  onRegister = () => { if (!$('ac-app').hidden) { renderTabs(); if (REG[activeTab]) showTab(activeTab); } };

  // ---- setup ----------------------------------------------------------------------------------------------------------
  const edgeSel = () => S.edges.find((e) => e.id === $('f-edge').value) || null;
  const modeVal = () => (document.querySelector('input[name="mode"]:checked') || {}).value || 'train';
  const speedVal = () => +((document.querySelector('input[name="speed"]:checked') || {}).value || 10);
  const numVal = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number.isFinite(+v) ? +v : NaN; };
  function setupErr(msg) { const n = $('setup-err'); n.hidden = !msg; n.textContent = msg || ''; if (msg) n.scrollIntoView({ block: 'nearest' }); }
  function readRange() { const from = dayToSec($('f-from').value), to = dayToSec($('f-to').value); return from == null || to == null || to < from ? null : { from, to: to + DAY }; }

  // The edges as cards over the select, which stays the value the page reads and sets: built once, and the selection follows
  // every renderEdgeInfo (so a resumed session or "Replay this setup" moves the card too).
  function renderEdgeCards() {
    const box = $('edge-cards'), sel = $('f-edge'); if (!box || !sel) return;
    if (!box.childElementCount && S.edges.length) {
      for (const e of S.edges) box.appendChild(el('button', { type: 'button', class: 'ecard', 'data-edge': e.id, 'aria-pressed': 'false', onclick: () => { if (sel.disabled || sel.value === e.id) return; sel.value = e.id; sel.dispatchEvent(new Event('change', { bubbles: true })); } },
        el('b', { text: e.name || e.id }), el('span', { class: 'ecard-m', text: e.marketLabel || e.market || '' }),
        el('small', { text: [e.signalTf ? e.signalTf + ' signal' : '', e.sides === 'long' ? 'buys only' : e.sides === 'short' ? 'sells only' : 'buys and sells'].filter(Boolean).join(' · ') })));
      sel.closest('.f').classList.add('has-cards'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    }
    box.querySelectorAll('.ecard').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.edge === sel.value)));
  }
  // A look at the market before the replay starts: one-hour candles of the two weeks BEFORE the From date. Nothing at or after
  // the first replay day is asked for or drawn, and no decision ever reads this chart.
  let PV = null, pvTok = 0, pvTimer = null;
  function previewSoon() { clearTimeout(pvTimer); pvTimer = setTimeout(preview, 350); }
  async function preview() {
    const box = $('preview'); if (!box) return; const e = edgeSel(), r = readRange(), tok = ++pvTok; if (!e || !r) { box.hidden = true; return; }
    try {
      const got = await MXR.load({ sym: e.market, tf: '1h', from: r.from - 14 * DAY, to: r.from }); if (tok !== pvTok) return;
      const rows = (Array.isArray(got) ? got : got.bars || []).filter((b) => b.time < r.from).map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
      if (rows.length < 5) { box.hidden = true; return; }
      box.hidden = false; if (!PV) PV = newChart($('preview-chart')); PV.setBars(rows); PV.chart.timeScale().fitContent();
      say('preview-note', `${e.marketLabel || e.market} · 1h candles up to ${isoDay(r.from)} 00:00 UTC`);
    } catch (err) { if (tok === pvTok) box.hidden = true; }
  }

  function renderEdgeInfo() {
    renderEdgeCards();
    const e = edgeSel(), box = clear($('edge-info')); if (!e) return;
    const def = e.definition || {}, st = e.study || {};
    box.appendChild(el('div', { class: 'pills' },
      el('span', { class: 'pill' }, 'Market ', el('b', { text: e.marketLabel || e.market })),
      el('span', { class: 'pill' }, 'Signal timeframe ', el('b', { text: e.signalTf || 'n/a' })),
      el('span', { class: 'pill' }, 'Sides ', el('b', { text: e.sides === 'long' ? 'buys only' : e.sides === 'short' ? 'sells only' : 'buys and sells' })),
      el('span', { class: 'pill' }, 'Rule version ', el('b', { class: 'num', text: e.version || 'n/a' })),
      e.status === 'partial' ? el('span', { class: 'pill warn' }, el('b', { text: 'Partial' })) : null));
    if (e.status === 'partial') box.appendChild(el('p', { class: 'ac-warn', text: 'This edge is only partly rebuilt: ' + (e.why || 'see its notes.') }));
    box.appendChild(el('p', {}, el('b', { text: 'What it trades. ' }), def.trigger || 'No definition in the registry.'));
    const dl = el('dl', { class: 'kv' });
    for (const [k, label] of [['filters', 'Filters'], ['entry', 'Entry'], ['stop', 'Stop'], ['exit', 'Exit']]) if (def[k]) { dl.appendChild(el('dt', { text: label })); dl.appendChild(el('dd', { text: def[k] })); }
    if (fin(st.n)) { dl.appendChild(el('dt', { text: 'Study' })); dl.appendChild(el('dd', { text: `n = ${st.n} trades, net ${fmtR(st.netR)} a trade after costs (${st.data || 'research candles'})` })); }
    if (e.notes) { dl.appendChild(el('dt', { text: 'Limits' })); dl.appendChild(el('dd', { text: e.notes })); }
    box.appendChild(el('details', { class: 'more' }, el('summary', { text: 'Filters, entry, stop, exit and limits' }), dl));
    $('f-cost-unit').textContent = e.costUnit ? '(' + e.costUnit + ')' : '(price units)';
    $('f-spread').value = fin(e.costPerRoundTrip) ? e.costPerRoundTrip : 0; $('f-comm').value = 0; $('f-slip').value = 0; renderCostNote();
    $('f-tf').value = chartTfOf(e);
  }
  function renderCostNote() {
    const e = edgeSel(), tot = costTotal({ spread: numVal('f-spread'), commission: numVal('f-comm'), slippage: numVal('f-slip') });
    $('f-cost-note').textContent = `Total ${tot.toFixed(2)} a round trip` + (e && fin(e.costPerRoundTrip) ? `; the study charged ${e.costPerRoundTrip.toFixed(2)}. Reward to risk and paper results use your total.` : '.');
  }
  function renderModeNote() {
    $('f-mode-note').textContent = modeVal() === 'exam'
      ? 'Exam: the replay stops on unseen exam-pool setups. The engine answers with and without your lessons, both answers are stored, then the result is shown. No corrections and no paper trades: an exam setup is decided once.'
      : 'Train: the replay stops on train-pool setups. You approve or correct each decision, save the lesson and replay the same trade to check it.';
    $('start').textContent = modeVal() === 'exam' ? 'Start exam replay' : 'Start replay';
  }
  // Per-run caches (the firewall allows few calls): the setups of an edge and pool, the lessons in force, the past cases.
  const CACHE = { pool: {}, lessons: {}, hist: {} }, DECIDED = new Set();   // DECIDED: setups this page stored an attempt for
  async function poolFor(edgeId, pool, force) {
    const k = edgeId + '|' + pool; if (force || !CACHE.pool[k]) CACHE.pool[k] = api.get({ get: 'candidates', edge: edgeId, pool, limit: 5000 }).catch((e) => { delete CACHE.pool[k]; throw e; });
    return CACHE.pool[k];
  }
  async function lessonsFor(edgeId, force) {
    if (force || !CACHE.lessons[edgeId]) CACHE.lessons[edgeId] = api.get({ get: 'lessons', edge: edgeId, active: '1' }).then((j) => (Array.isArray(j.lessons) ? j.lessons : [])).catch((e) => { delete CACHE.lessons[edgeId]; throw e; });
    return CACHE.lessons[edgeId];
  }
  const lessonsChanged = () => { CACHE.lessons = {}; };
  // the lesson already saved from a stored correction (in force or switched off), or null: one read of the edge's lessons
  async function savedLessonOf(edgeId, correctionId) { if (!correctionId) return null; const all = (await api.get({ get: 'lessons', edge: edgeId })).lessons || []; return all.filter((l) => l && l.source && l.source.correctionId === correctionId).pop() || null; }
  // past cases up to `before`, read once and cut per decision with historyAt. A wider list already read is reused.
  async function historyFor(edgeId, before) {
    const c = CACHE.hist[edgeId]; if (c && c.before >= before) return c;
    try { const j = await api.get({ get: 'history', edge: edgeId, before }); return (CACHE.hist[edgeId] = { before, rows: Array.isArray(j.rows) ? j.rows : [], available: j.available !== false }); }
    catch (e) { return { before, rows: [], available: false }; }   // the route may be missing or its data not built: no sample
  }
  // An attempt was just stored for a setup: remember it for this page, and in the pool list every section shares, with the
  // mode it was stored in. The Blind arena reads that mode: a setup whose engine answer was shown in Train or Session since
  // its hidden attempt is answered as recall (a fresh hidden attempt, left out of every score), never as a blind answer.
  function decidedAs(id, pool, mode) { DECIDED.add(id); if (pool && mode) { pool.seen = pool.seen || {}; const p = pool.seen[id]; pool.seen[id] = Object.assign({}, p, { mode, attempts: ((p && p.attempts) || 0) + 1 }); } }
  const seenBefore = (pool, id) => DECIDED.has(id) || !!(pool && pool.seen && pool.seen[id] && pool.seen[id].attempts > 0);
  async function refreshPool(resetRange) {
    const e = edgeSel(); if (!e) return; const token = ++S.poolToken, pool = modeVal() === 'exam' ? 'exam' : 'train', note = $('f-count');
    try {
      if (resetRange) note.textContent = 'Counting setups…';
      const all = await poolFor(e.id, pool); if (token !== S.poolToken) return;
      if (resetRange) {
        const r = defaultRange(all.candidates || [], 60);
        if (r) { $('f-from').value = isoDay(r.from); $('f-to').value = isoDay(r.to - DAY); } else { $('f-from').value = ''; $('f-to').value = ''; }
        if (!r) { note.textContent = pool === 'exam' ? 'No unseen exam setup is left for this edge.' : 'No train setup is available for this edge.'; return; }
      }
      const r = readRange(); if (!r) { note.textContent = 'Pick a start and an end date (the end on or after the start).'; return; }
      previewSoon();
      const rows = (all.candidates || []).filter((c) => c.t >= r.from && c.t < r.to), total = rows.length, seen = rows.filter((c) => seenBefore(all, c.id)).length, ex = all.excluded || {}, left = (ex.clockShift || 0) + (ex.pre2020 || 0);
      note.textContent = `${total} ${pool} setup${total === 1 ? '' : 's'} in this range` + (pool === 'train' && seen ? ` (${seen} already decided before)` : '') + (pool === 'exam' ? ' (unseen only)' : '') + '.'
        + (left ? ` ${left} setup${left === 1 ? '' : 's'} of this edge ${left === 1 ? 'is' : 'are'} left out of every list: ${[ex.clockShift ? ex.clockShift + ' in weeks whose research clock could not be checked' : '', ex.pre2020 ? ex.pre2020 + ' before 2020' : ''].filter(Boolean).join(', ')}.` : '')
        + (total === 0 ? ' The replay would not stop on anything.' : '');
    } catch (err) { if (token === S.poolToken) note.textContent = 'The setups could not be counted: ' + err.message + '.'; }
  }
  async function renderLessonsList() {
    const e = edgeSel(), ul = $('lessons-list'); if (!e) return;
    try {
      const ls = await lessonsFor(e.id); $('lessons-n').textContent = `(${ls.length})`;
      listOr(ul, ls, 'No lesson saved yet. A lesson appears here after you correct a decision and save it.', (l) => el('li', { 'data-lesson': l.id },
        el('div', {}, el('b', { text: l.title }), el('br'), lessonText(l), el('br'), el('small', { text: `version ${l.version} · applied ${(l.stats && l.stats.applied) || 0} · same-trade replays passed ${(l.stats && l.stats.replayPass) || 0}, failed ${(l.stats && l.stats.replayFail) || 0} · new setups ${(l.stats && l.stats.examN) || 0}` }))));
    } catch (err) { listOr(ul, [], 'The lessons could not be read: ' + err.message + '.', () => null); }
  }
  async function renderSessions() {
    const ul = $('sess-list');
    try {
      const j = await api.get({ get: 'sessions' }), all = latestFirst(j.sessions || []), rows = all.filter((s) => s.kind === 'replay').slice(0, 12);
      renderResumeNow(unfinished(all, ['replay', 'session']));   // whichever was saved last: a Train replay, or a sitting of the Session tab
      listOr(ul, rows, 'No saved session yet. Use "Save session" during a replay.', (s) => el('li', { 'data-session': s.id },
        el('div', {}, el('b', { text: s.title || s.edge }), el('br'), el('small', { text: (s.summary || '') + ' · saved ' + String(s.updatedAt || '').slice(0, 16).replace('T', ' ') + ' UTC' })),
        el('button', { type: 'button', class: 'btn sm', text: 'Resume', onclick: () => resumeSession(s.id) })));
    } catch (err) { listOr(ul, [], 'The saved sessions could not be read: ' + err.message + '.', () => null); }
  }
  // "Pick up where you left off": the unfinished replay saved last, offered at the top of the setup after a reload. It reads
  // the list the page already asks for (no call of its own) and loads nothing until Resume is pressed.
  let resumeHidden = false;
  function renderResumeNow(s) {
    const box = $('resume-now'); if (!box) return; clear(box);
    if (!s || S.clock || S.loading || resumeHidden) { box.hidden = true; return; }
    box.hidden = false;
    const sit = s.kind === 'session';   // a sitting of the Session tab is resumed there (MXAC.sessionResume is read once by that tab)
    box.appendChild(el('div', { class: 'resume-t' }, el('b', { text: 'Pick up where you left off' }), el('span', { id: 'resume-now-text', text: `${sit ? 'Session tab · ' : ''}${s.title || s.edge} · ${sit && fin(s.t) ? 'paused at ' + fmtTime(s.t) : s.summary || 'a saved replay'} · saved ${String(s.updatedAt || '').slice(0, 16).replace('T', ' ')} UTC` })));
    box.appendChild(el('div', { class: 'resume-go' }, el('button', { type: 'button', class: 'btn primary', id: 'resume-now-go', 'data-kind': s.kind, text: sit ? 'Resume in the Session tab' : 'Resume', onclick: () => { box.hidden = true; if (sit) { resumeHidden = true; MXAC.sessionResume = s.id; showTab('session'); } else resumeSession(s.id); } }),
      el('button', { type: 'button', class: 'btn', id: 'resume-now-no', text: 'Not now', onclick: () => { resumeHidden = true; box.hidden = true; } })));
  }
  // The edge used last is remembered on this device (pref mxacEdge), so the page and its sections open on it.
  const lastEdge = () => prefGet('mxacEdge');
  function rememberEdge(id) { if (id) prefSet('mxacEdge', String(id)); }
  MXAC.rememberEdge = rememberEdge; MXAC.lastEdge = lastEdge;
  async function initSetup() {
    try { S.edges = (await api.get({ get: 'edges' })).edges || []; }
    catch (e) { setupErr(e.status === 503 ? 'The Academy data is not set up on this server yet (' + e.message + ').' : 'The Academy data could not be loaded: ' + e.message + '.'); $('start').disabled = true; return; }
    if (!S.edges.length) { setupErr('The edge registry is empty.'); $('start').disabled = true; return; }
    const sel = clear($('f-edge')); for (const e of S.edges) sel.appendChild(el('option', { value: e.id, text: `${e.name} · ${e.marketLabel || e.market}` }));
    const last = lastEdge(); if (last && S.edges.some((e) => e.id === last)) sel.value = last;   // the edge used last, on this device
    renderEdgeInfo(); renderModeNote(); renderSessions(); renderLessonsList(); refreshPool(true);
  }
  $('f-edge').addEventListener('change', () => { rememberEdge($('f-edge').value); renderEdgeInfo(); renderLessonsList(); refreshPool(true); });
  for (const id of ['f-from', 'f-to']) $(id).addEventListener('change', () => refreshPool(false));
  for (const id of ['f-spread', 'f-comm', 'f-slip']) $(id).addEventListener('input', renderCostNote);
  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => { renderModeNote(); refreshPool(true); }));
  $('setup-form').addEventListener('submit', (e) => { e.preventDefault(); startReplay(null); });
  $('setup-toggle').addEventListener('click', () => foldSetup($('setup-body').hidden === false));
  function foldSetup(fold) { $('setup-body').hidden = fold; $('setup-toggle').hidden = !S.clock; $('setup-toggle').setAttribute('aria-expanded', fold ? 'false' : 'true'); $('setup-toggle').textContent = fold ? 'Change setup' : 'Hide setup'; }

  function readSetup() {
    const e = edgeSel(), r = readRange(), balance = numVal('f-balance'), riskPct = numVal('f-risk'), costs = { spread: numVal('f-spread') || 0, commission: numVal('f-comm') || 0, slippage: numVal('f-slip') || 0 };
    if (!e) return { error: 'Choose an edge.' };
    if (!r) return { error: 'Pick a start and an end date (the end on or after the start).' };
    if (!(balance > 0)) return { error: 'The starting balance must be a positive number.' };
    if (!(riskPct > 0) || riskPct > 5) return { error: 'Risk per trade must be between 0.01 % and 5 %.' };
    if ([costs.spread, costs.commission, costs.slippage].some((v) => !(v >= 0))) return { error: 'Costs cannot be negative.' };
    return { edge: e, from: r.from, to: r.to, tf: $('f-tf').value, speed: speedVal(), balance, riskPct, costs, cost: costTotal(costs), difficulty: $('f-diff').value, mode: modeVal() };
  }

  // ---- candles, snapshots, decisions ----------------------------------------------------------------------------------
  async function loadSeries(sym, from, to, say) {
    const series = {}; let src = null, inst = null;
    for (const tf of TFS) {
      say(`Loading ${tf} candles…`);
      const bars = await MXR.load({ sym, tf, from: from - lookbackSec(tf), to, onProgress: (d, n) => say(`Loading ${tf} candles: part ${d} of ${n}`) });
      series[tf] = bars; src = src || bars.src; inst = inst || bars.inst;
    }
    return { series, dataVersion: [src, inst].filter(Boolean).join(' ') || 'unknown feed' };
  }
  // The only way a snapshot is made on this page. cand is passed only at the candidate's own time.
  function snapOf(edge, series, dataVersion, t, cand) {
    const o = { edge: edge.id, market: edge.market, t, cand: cand || null, series: snapshotSeries(edge, series), dataVersion }, cal = calendarCut(S.calendar, t);
    if (cal.events) o.events = cal.events; if (cal.schedule) o.schedule = cal.schedule;
    const snap = MXR.snapshot(o);
    MXR.guard(snap); MXA.assertNoFuture(snap);
    MXAC.lastSnapshot = snap; MXAC.checks.snapshots++; if (!snapshotClean(snap)) MXAC.checks.future++;
    return snap;
  }
  function decideOn(snap, o) {
    const c = snap.cand, st = o.setup, acct = MXK.roll(o.account, snap.t);
    const risk = c ? MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: snap.t }, acct, { riskPct: st.riskPct }) : null;
    const d = MXA.decide(snap, { lessons: o.lessons || [], thesis: o.thesis || null, history: o.history || [], risk: risk || undefined, edgeDef: { version: st.edge.version, cost: st.cost } });
    return { decision: d, risk, acct };
  }
  // the release calendar: read once (the whole list), cut per snapshot by calendarCut. Missing or unreadable: no calendar.
  async function ensureCalendar() {
    if (S.calendar !== undefined) return;
    try { const j = await api.get({ get: 'calendar' }); S.calendar = j && j.available !== false && Array.isArray(j.items) ? { from: j.from, to: j.to, items: j.items, types: j.types || [] } : null; }
    catch (e) { S.calendar = null; }
  }
  const attemptBody = (cand, edgeId, mode, d, lessons, hash, f, sessionId) => ({ action: 'attempt', attempt: { candidateId: cand.id, edge: edgeId, mode, decision: d, sessionId: sessionId === undefined ? S.sessionId : sessionId, lessonsAvailable: lessons.map((l) => l.id), snapshotHash: hash }, features: f });

  // ---- replay ---------------------------------------------------------------------------------------------------------
  const say = (id, msg) => { $(id).textContent = msg || ''; };
  function log(text0, strong) { const h = humanize(text0, S.lessons), text = h !== text0 && !strong ? h.charAt(0).toUpperCase() + h.slice(1) : h, ol = $('log'), li = el('li', {}, strong ? el('b', { text: strong + ' ' }) : null, text); ol.insertBefore(li, ol.firstChild); while (ol.children.length > 80) ol.removeChild(ol.lastChild); }

  async function startReplay(resume, opts) {
    if (S.loading) return;
    const st = resume ? resume.setup : readSetup(); if (st.error) { setupErr(st.error); return; }
    setupErr(''); S.loading = true; $('start').disabled = true;
    try {
      say('load-msg', 'Reading the setups…');
      const pj = await poolFor(st.edge.id, st.mode === 'exam' ? 'exam' : 'train', st.mode === 'exam'), cj = { candidates: (pj.candidates || []).filter((c) => c.t >= st.from && c.t < st.to) };
      const { series, dataVersion } = await loadSeries(st.edge.market, st.from, st.to, (m) => say('load-msg', m));
      if (!series[st.tf].length || !series['5m'].length) throw Object.assign(new Error('No candles came back for this market and range, so there is nothing to replay. Try other dates.'), { code: 'NO_BARS' });
      say('load-msg', 'Reading the lessons, the past cases and the release calendar…');
      const lessons = await lessonsFor(st.edge.id, true), hist = await historyFor(st.edge.id, st.to); await ensureCalendar();
      // everything is loaded: swap the replay in
      if (S.clock) S.clock.pause();
      rememberEdge(st.edge.id); S.setup = st; S.cands = (cj.candidates || []).slice().sort((a, b) => a.t - b.t); S.series = series; S.dataVersion = dataVersion; S.lessons = lessons; S.hist = hist; S.pool = pj;
      S.cur = null; S.pending = null; S.busy = false; S.sinceThesis = 0; S.lastBlock = null;
      S.sessionId = resume ? resume.id : null; S.done = new Set(resume ? resume.done : []); S.closed = resume ? resume.closed : []; S.open = [];
      S.account = resume ? resume.account : MXK.account(st.balance, { t: st.from });
      S.htf = resume && HTFS.indexOf(resume.htf) >= 0 ? resume.htf : htfFor(st.tf);
      const t0 = resume ? Math.min(st.to, Math.max(st.from, resume.t)) : st.from;
      S.fromT = t0;
      S.clock = MXR.clock({ from: st.from, to: st.to, stepSec: st.tf, speed: st.speed, t: t0, onTick, onBatch, onDone: () => { log('The replay reached the end of the range.'); draw(); } });
      S.thesis = resume && resume.thesis ? resume.thesis : MXA.thesis.start(snapOf(st.edge, series, dataVersion, t0, null));
      clear($('log')); $('replay').hidden = false; $('resume-now').hidden = true; foldSetup(true); hidePoint();
      $('setup-sum').textContent = `${st.edge.name} · ${isoDay(st.from)} to ${isoDay(st.to - DAY)} · ${st.tf} · ${st.mode === 'exam' ? 'exam' : 'train'} · ${S.cands.length} setup${S.cands.length === 1 ? '' : 's'}`;
      $('chart-meta').textContent = `Candles: ${dataVersion}. Setups: the study's research candles (prices can differ by a small feed basis).`;
      say('chart-legend', 'Grey candle = still forming at the replay time (display only). Decisions only ever see closed candles (' + Object.keys(snapshotSeries(st.edge, series)).join(', ') + '). '
        + (S.calendar ? `Calendar: scheduled ${S.calendar.types.join(', ') || 'release'} times only` + (st.from < S.calendar.from || st.to > S.calendar.to ? ' (it does not cover this whole range, so event checks are blank outside it). ' : '. ') : 'No release calendar could be read, so event checks are blank. ')
        + 'No dollar-index series is supplied in this build, so the dollar check is blank.');
      makeCharts(); markSpeed(); markHtf(); draw(); renderAccount(); renderThesis(); say('load-msg', ''); $('exam-out').hidden = true; say('exam-msg', ''); renderExams().catch(() => {});
      log(`${resume ? 'Session resumed' : 'Replay ready'}: ${st.edge.name}, ${isoDay(st.from)} to ${isoDay(st.to - DAY)}, ${S.cands.length} ${st.mode === 'exam' ? 'exam' : 'train'} setup${S.cands.length === 1 ? '' : 's'} in range.`);
      if (resume) { for (const tr of resume.open || []) await reopenTrade(tr); if (resume.cur) await restorePoint(resume.cur); }
      say('replay-msg', S.cur ? '' : 'Press Play, or Space.');
      $('replay').scrollIntoView({ block: 'start' });
      if (opts && fin(opts.at) && !S.cur) {   // asked for one setup (a mistake due again): go to the candle before it and run onto it
        const at = Math.min(st.to, Math.max(st.from, opts.at)); S.fromT = at; S.clock.jump(Math.max(st.from, at - MXR.TF[st.tf])); S.sinceThesis = 0; draw(); S.clock.play(); say('replay-msg', ''); draw();
      }
    } catch (e) { setupErr(e && e.code ? candleError(e) : 'The replay could not start: ' + ((e && e.message) || e) + '.'); say('load-msg', ''); }
    finally { S.loading = false; $('start').disabled = false; }
  }

  function onTick(t, info) {
    if (info.kind === 'jump' || info.kind === 'restart') return;      // repositioning: no setup fires while the clock is being moved
    const c = dueCandidate(S.cands, S.fromT, t, S.done);
    if (c) {                                                           // pause ON the setup: the clock goes back to the exact moment it fired
      S.wasPlaying = info.kind === 'play'; S.clock.pause(); S.clock.jump(c.t); S.pending = c; closeDue(c.t); return;
    }
    closeDue(t);
  }
  function onBatch(t, n, kind) {
    draw();
    if (S.pending && !S.busy) { const c = S.pending; S.pending = null; openPoint(c); return; }
    if (kind === 'play' || kind === 'step') {
      S.sinceThesis += n;
      if (S.sinceThesis >= THESIS_EVERY && !S.busy && !S.cur) {       // between setups: keep the thesis current, a few times a session, never per candle
        S.sinceThesis = 0;
        try { const snap = snapOf(S.setup.edge, S.series, S.dataVersion, t, null), r = decideOn(snap, { setup: S.setup, account: S.account, lessons: S.lessons, thesis: S.thesis }); S.thesis = MXA.thesis.update(S.thesis, snap, r.decision); renderThesis(); }
        catch (e) { log('The thesis could not be updated here: ' + e.message); }
      }
    }
    const openN = S.account.positions.length; renderAccount();
    if (openN !== S.shownOpen) { S.shownOpen = openN; renderThesis(); }   // the thesis line says whether a paper trade is open
  }

  // the paper ledger: trades taken by the engine, closed from the stored Outcome once the clock passes its exit time
  function closeDue(t) {
    const due = S.open.filter((x) => x.exitT <= t).sort((a, b) => a.exitT - b.exitT); if (!due.length) return;
    for (const x of due) {
      let cash = 0;
      if (x.unfilled) S.account = Object.assign({}, MXK.roll(S.account, x.exitT), { positions: S.account.positions.filter((p) => p.id !== x.id) });
      else { const before = S.account.balance; S.account = MXK.apply(S.account, { id: x.id, netR: x.netR, riskCash: x.riskCash, exitT: x.exitT }); cash = S.account.balance - before; }
      S.closed.push({ id: x.id, side: x.side, t: x.t, exitT: x.exitT, riskCash: x.riskCash, netR: x.unfilled ? null : x.netR, cash, unfilled: x.unfilled, reason: x.reason || null });
      log(x.unfilled ? `${x.id}: the order never filled (${x.reason}). No result.` : `${x.id} closed ${fmtTime(x.exitT)}: ${fmtR(x.netR)} after costs (${fmtCash(cash)}), exit by ${x.reason || 'rule'}.`, 'Paper trade.');
    }
    S.open = S.open.filter((x) => x.exitT > t);
  }
  async function reopenTrade(tr) {   // a session saved with an open paper trade: its outcome is read again (its attempt is stored)
    try { const out = (await api.get({ get: 'outcome', id: tr.id, edge: S.setup.edge.id })).outcome; S.open.push(Object.assign({}, tr, { exitT: out.exitT, netR: netRAt(out, S.setup.edge.costPerRoundTrip, S.setup.cost), reason: out.reason, unfilled: unfilled(out) })); }
    catch (e) { S.account = Object.assign({}, S.account, { positions: S.account.positions.filter((p) => p.id !== tr.id) }); log(`${tr.id}: its result could not be read after resuming (${e.message}); the paper position was dropped.`); }
  }

  function renderAccount() {
    const a = S.account; if (!a) return; const dl = clear($('acct')), pl = a.balance - a.start;
    const cell = (k, v, sub, cls) => dl.appendChild(el('div', {}, el('dt', { text: k }), el('dd', { class: cls || null }, v, sub ? el('small', { text: sub }) : null)));
    cell('Balance', fmtCash(a.balance), `${pl >= 0 ? 'up' : 'down'} ${fmtCash(Math.abs(pl))} since the start`, 'bal');
    cell('Day P&L', (a.dayPnl > 0 ? '+' : '') + fmtCash(a.dayPnl), a.dayPnl > 0 ? 'profit today' : a.dayPnl < 0 ? 'loss today' : 'flat today');
    cell('Drawdown', a.drawdownPct.toFixed(2) + ' %', `worst ${a.maxDrawdownPct.toFixed(2)} % under the peak`);
    cell('Open / closed', `${a.positions.length} / ${S.closed.length}`, 'paper trades');
    const blk = $('acct-block'); blk.hidden = !S.lastBlock; blk.textContent = S.lastBlock ? 'The risk engine blocked the last setup: ' + S.lastBlock : '';
    const rows = S.open.map((x) => ({ x, open: true })).concat(S.closed.slice().reverse().map((x) => ({ x })));
    $('trades-box').hidden = !rows.length;
    const tb = clear($('trades').tBodies[0]);
    for (const r of rows.slice(0, 30)) tb.appendChild(el('tr', {}, el('td', { text: fmtTime(r.x.t) }), el('td', {}, actBadge(actOf(r.x.side), true)), el('td', { class: 'num', text: fmtCash(r.x.riskCash) }),
      el('td', { class: 'num', text: r.open ? 'open' : r.x.unfilled ? 'never filled' : `${fmtR(r.x.netR)} (${fmtCash(r.x.cash)})` })));
  }
  function renderThesis() {
    const th = S.thesis; if (!th) return;
    say('thesis-line', `Bias ${th.bias}. Expecting ${th.expecting}.` + (th.status === 'invalidated' ? ' The thesis was invalidated and is being rebuilt.' : th.status === 'in-trade' && S.account && S.account.positions.length ? ' A paper trade is open.' : ''));
    listOr($('thesis-changes'), (th.changes || []).slice(-4).reverse(), 'No change yet.', (c) => el('li', {}, el('div', {}, el('small', { text: fmtTime(c.t) + ' ' }), humanize(c.text, S.lessons) + (c.n > 1 ? ` (${c.n} checks)` : ''))));
  }

  // ---- charts ---------------------------------------------------------------------------------------------------------
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const look = () => ({ layout: { background: { type: 'solid', color: 'transparent' }, textColor: css('--ink-dim') || '#a4abb8', fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }, grid: { vertLines: { color: css('--line-soft') }, horzLines: { color: css('--line-soft') } },
    rightPriceScale: { borderColor: css('--line') }, timeScale: { borderColor: css('--line'), timeVisible: true, secondsVisible: false, rightOffset: 6 } });
  const candleLook = () => ({ upColor: css('--buy'), downColor: css('--sell'), wickUpColor: css('--buy'), wickDownColor: css('--sell'), borderVisible: false, priceLineVisible: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } });
  // Every chart on the page comes from here, so they share one look and a theme change reaches all of them.
  // → { chart, series, setBars(bars), line(price, title, color, solid), clearLines(), fit() }
  const CHARTS = [];
  function newChart(host) {
    const LW = root.LightweightCharts; if (!LW) throw new Error('the chart library did not load');
    const chart = LW.createChart(host, { autoSize: true, crosshair: { mode: 0 }, handleScroll: { vertTouchDrag: false } }), series = chart.addCandlestickSeries(candleLook()), lines = [];
    const c = { chart, series, setBars: (bars) => series.setData(bars), fit: () => chart.timeScale().resetTimeScale(),
      line(price, title, color, solid) { if (fin(price)) lines.push(series.createPriceLine({ price, color, lineWidth: solid ? 2 : 1, lineStyle: solid ? 0 : 2, axisLabelVisible: true, title })); },
      clearLines() { while (lines.length) { try { series.removePriceLine(lines.pop()); } catch (e) { /* already gone */ } } } };
    chart.applyOptions(look());
    if (!CHARTS.length) { const mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: light)') : null; if (mq && mq.addEventListener) mq.addEventListener('change', themeCharts); }
    CHARTS.push(c); return c;
  }
  function makeCharts() {
    if (!CH.main) {
      const a = newChart($('chart')), b = newChart($('htf'));
      CH.main = a.chart; CH.series = a.series; CH.htf = b.chart; CH.htfSeries = b.series;
      CH.main.timeScale().subscribeVisibleLogicalRangeChange(placeZones);
      wireChartPointer();
    }
    themeCharts(); clearLines(CH.edgeLines); clearMentorLines(); clearLines(CH.annLines);
    CH.main.timeScale().resetTimeScale(); CH.htf.timeScale().resetTimeScale();
  }
  function themeCharts() { for (const c of CHARTS) { c.chart.applyOptions(look()); c.series.applyOptions(candleLook()); } }
  function resizeCharts() { if (CH.main) { draw(); } }
  // bars of one timeframe as a chart may show them at t: closed bars, plus the forming bar built from closed 5m bars (grey)
  function viewBarsOf(series, tf, t, keep) {
    const all = series[tf], n = MXR.closedCount(all, tf, t), out = all.slice(Math.max(0, n - keep), n);
    if (tf !== '5m') { const f = MXR.formingAt(series['5m'], tf, t, '5m'), grey = css('--ink-faint'); if (f && (!out.length || f.time > out[out.length - 1].time)) out.push({ time: f.time, open: f.open, high: f.high, low: f.low, close: f.close, color: grey, wickColor: grey, borderColor: grey }); }
    return out;
  }
  const viewBars = (tf, t, keep) => viewBarsOf(S.series, tf, t, keep);
  function draw() {
    if (!CH.main || !S.clock) return; const st = S.clock.state();
    const fut = S.future && S.cur && !S.cur.closed ? S.future : null, shown = viewBars(S.setup.tf, st.t, 500);   // fut: candles AFTER the decision, shown only on request, for study
    CH.series.setData(fut ? shown.filter((b) => b.time < fut.bars[0].time).concat(fut.bars) : shown); CH.htfSeries.setData(viewBars(S.htf, st.t, 240));
    if (fut || CH.marked) { CH.series.setMarkers(fut ? [{ time: fut.bars[0].time, position: 'aboveBar', color: css('--gold'), shape: 'arrowDown', text: 'after the decision' }] : []); CH.marked = !!fut; }
    say('clock-time', fmtTime(st.t));
    const pill = $('clock-state'); pill.textContent = st.done ? 'end of range' : S.cur && !S.cur.closed ? 'paused on a setup' : S.busy ? 'working…' : st.playing ? `playing ${st.speed}×` : 'paused';
    $('c-play').textContent = st.playing ? 'Pause' : S.cur && !S.cur.closed ? 'Continue replay' : st.steps > 0 || st.t > st.from ? 'Resume' : 'Play';
    $('c-play').setAttribute('aria-pressed', st.playing ? 'true' : 'false');
    placeZones();
  }
  function clearLines(arr) { while (arr.length) { try { CH.series.removePriceLine(arr.pop()); } catch (e) { /* already gone */ } } }
  function clearMentorLines() { for (const k of Object.keys(CH.mentorLines)) { try { CH.series.removePriceLine(CH.mentorLines[k]); } catch (e) { /* gone */ } delete CH.mentorLines[k]; } $('chart').style.touchAction = M.arm ? 'none' : ''; }
  function drawEdgeLines(d) {
    clearLines(CH.edgeLines); if (!d) return;
    const mk = (price, title, color) => { if (fin(price)) CH.edgeLines.push(CH.series.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title })); };
    mk(d.entry, 'Edge entry', css('--accent')); mk(d.stop, 'Edge stop', css('--sell')); mk(d.target, 'Edge target', css('--buy'));
  }
  function drawMentorLines() {
    clearMentorLines(); if (!isTake(M.choice)) return;
    for (const [k, title, color] of [['entry', 'Mentor entry', css('--accent')], ['stop', 'Mentor stop', css('--sell')], ['target', 'Mentor target', css('--buy')]])
      if (fin(M[k])) CH.mentorLines[k] = CH.series.createPriceLine({ price: M[k], color, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title });
    $('chart').style.touchAction = 'none';
  }
  function drawAnnotations() {
    clearLines(CH.annLines);
    for (const a of M.annotations) if (!fin(a.price2)) CH.annLines.push(CH.series.createPriceLine({ price: a.price, color: css('--gold'), lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: (ANNOTATIONS.find((x) => x[0] === a.kind) || [0, a.kind])[1] }));
    placeZones();
  }
  function placeZones() {
    const box = $('zones'); if (!box || !CH.main) return; clear(box);
    const zs = M.annotations.filter((a) => fin(a.price2)); if (!zs.length || !S.setup) return;
    const ts = CH.main.timeScale(), sec = MXR.TF[S.setup.tf], w = ts.width();
    const xOf = (t, dflt) => { const x = ts.timeToCoordinate(Math.floor(t / sec) * sec); return x == null ? dflt : x; };
    for (const a of zs) {
      const y1 = CH.series.priceToCoordinate(a.price), y2 = CH.series.priceToCoordinate(a.price2); if (y1 == null || y2 == null) continue;
      const x1 = xOf(Math.min(a.t, a.t2), 0), x2 = xOf(Math.max(a.t, a.t2), w), left = Math.max(0, Math.min(x1, x2)), right = Math.min(w, Math.max(x1, x2));
      box.appendChild(el('i', { style: `left:${left}px;top:${Math.min(y1, y2)}px;width:${Math.max(8, right - left)}px;height:${Math.max(6, Math.abs(y2 - y1))}px`, text: (ANNOTATIONS.find((x) => x[0] === a.kind) || [0, a.kind])[1] }));
    }
  }
  // pointer work on the main chart: drag a mentor line, or place an annotation (a click = a level, a drag = a zone)
  function wireChartPointer() {
    const host = $('chart'); let drag = null, ann = null;
    const at = (e) => { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const lock = (on) => CH.main.applyOptions({ handleScroll: on ? false : { vertTouchDrag: false }, handleScale: !on });
    const timeAt = (x) => { const tm = CH.main.timeScale().coordinateToTime(x); return typeof tm === 'number' ? tm : S.clock ? S.clock.state().t : null; };
    host.addEventListener('pointerdown', (e) => {
      if (!S.cur || S.cur.closed || !CH.series) return; const p = at(e); if (p.x > CH.main.timeScale().width()) return;
      if (M.arm) { const price = CH.series.coordinateToPrice(p.y); if (price == null) return; ann = { kind: M.arm, x: p.x, y: p.y, price: +price.toFixed(2), t: timeAt(p.x) }; lock(true); e.preventDefault(); return; }
      let best = null;
      for (const k of Object.keys(CH.mentorLines)) { const y = CH.series.priceToCoordinate(M[k]); if (y != null && Math.abs(y - p.y) <= 9 && (!best || Math.abs(y - p.y) < best.d)) best = { k, d: Math.abs(y - p.y) }; }
      if (best) { drag = best.k; lock(true); e.preventDefault(); }
    }, true);
    root.addEventListener('pointermove', (e) => {
      if (!drag) return; const v = CH.series.coordinateToPrice(at(e).y); if (v == null) return;
      M[drag] = +v.toFixed(2); M.dirty = true; CH.mentorLines[drag].applyOptions({ price: M[drag] }); const inp = $('m-' + drag); if (inp) inp.value = M[drag]; mentorCheck();
    });
    const end = (e) => {
      if (drag) { drag = null; lock(false); }
      if (ann) {
        const p = at(e), a = ann; ann = null; lock(false);
        const moved = Math.abs(p.x - a.x) > 6 || Math.abs(p.y - a.y) > 6, price2 = moved ? CH.series.coordinateToPrice(p.y) : null;
        M.dirty = true; M.annotations.push({ kind: a.kind, t: a.t, price: a.price, t2: moved && price2 != null ? timeAt(p.x) : null, price2: moved && price2 != null ? +price2.toFixed(2) : null, note: '' });
        M.arm = null; host.classList.remove('arm'); if (!isTake(M.choice)) host.style.touchAction = ''; renderAnnotations(); drawAnnotations();
      }
    };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', () => { drag = null; ann = null; if (CH.main) lock(false); });
  }
  // for the end-to-end check: where a price sits on the main chart, in page coordinates
  MXAC.chartPoint = (price, frac) => { if (!CH.series) return null; const r = $('chart').getBoundingClientRect(), y = CH.series.priceToCoordinate(price); return y == null ? null : { x: r.left + CH.main.timeScale().width() * (frac == null ? 0.5 : frac), y: r.top + y }; };

  MXAC.laterShown = () => (S.future ? S.future.bars.length : 0);   // for the end-to-end check: candles after the decision on the main chart right now

  // ---- controls -------------------------------------------------------------------------------------------------------
  function markSpeed() { const sp = S.clock ? S.clock.state().speed : 0; document.querySelectorAll('#c-speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.speed === sp ? 'true' : 'false')); }
  function markHtf() { document.querySelectorAll('#htf-sw [data-htf]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.htf === S.htf ? 'true' : 'false')); }
  async function playPause() {
    if (!S.clock || S.busy) return;
    if (S.clock.state().playing) { S.clock.pause(); draw(); return; }
    if (!leaveOk()) return;
    if (S.cur && !S.cur.closed) await settlePoint();
    S.clock.play(); say('replay-msg', ''); draw();
  }
  async function stepOne() { if (!S.clock || S.busy || !leaveOk()) return; if (S.cur && !S.cur.closed) await settlePoint(); S.clock.step(1); }
  // Leaving a decision point while a verdict is half written would throw it away without a word. The first press says so
  // (beside both Continue buttons) and changes nothing; a second press within LEAVE_MS leaves. A saved verdict never asks.
  // The guard itself is MXAC.leaveGuard, shared with the Session tab and the Blind arena.
  const trainUnsaved = () => !!S.cur && !S.cur.closed && mentorUnsaved(M);
  const leaveOk = leaveGuard({ unsaved: trainUnsaved, tell: () => {
    const msg = 'Your verdict is not saved yet. Press "Save correction" to keep it, or press Continue again to leave without it.';
    say('replay-msg', msg); renderPointBar(msg); const c = $('continue-msg'); if (c) c.textContent = msg;
  } });
  // Closing or reloading the page with a half-written answer on any section: the browser asks first (its own question; the
  // page stores nothing). Sections add their own check with kit.watchUnsaved.
  const UNSAVED = [trainUnsaved];
  root.addEventListener('beforeunload', (e) => { if (UNSAVED.some((f) => { try { return !!f(); } catch (x) { return false; } })) { e.preventDefault(); e.returnValue = ''; } });
  // ---- the line under the chart at a decision point, and scrolling between the chart and the cards ------------------------
  const calm = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function goTo(id) { const n = $(id); if (!n || n.hidden) return; n.scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' }); if (!n.hasAttribute('tabindex')) n.setAttribute('tabindex', '-1'); try { n.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
  // bring a node back on screen when none of it, or only its edge, is in view (one column on a phone: the chart is far above the cards)
  function showNode(n, anchor) { if (!n || !n.getBoundingClientRect) return; const h = root.innerHeight || 0; const out = () => { const q = n.getBoundingClientRect(); return q.top < 50 || q.bottom > h; }; if (!out()) return; (anchor || n).scrollIntoView({ block: 'start' }); if (out()) n.scrollIntoView({ block: 'nearest' }); }   // the second step reaches a node inside a column that scrolls by itself
  function renderPointBar(warn) {
    const bar = $('point-bar'), cur = S.cur; if (!bar) return; clear(bar);
    if (!cur || cur.closed || !cur.latest) { bar.hidden = true; return; }
    const d = cur.latest.decision; bar.hidden = false; bar.classList.toggle('warn', !!warn);
    bar.appendChild(actBadge(d.action, true, 'point-action'));
    bar.appendChild(el('span', { class: 'point-t', id: 'point-text', text: warn || pointLine({ action: d.action, confidence: d.confidence, exam: !!cur.exam, corrected: !!cur.correction }) }));
    bar.appendChild(el('span', { class: 'point-go' }, el('button', { type: 'button', class: 'btn sm', id: 'point-decision', text: cur.exam ? 'See the result' : 'See the decision', onclick: () => goTo('decision') }),
      !cur.exam && !$('mentor').hidden ? el('button', { type: 'button', class: 'btn sm' + (cur.correction ? '' : ' primary'), id: 'point-verdict', text: cur.correction ? 'Your verdict' : 'Give your verdict', onclick: () => goTo('mentor') }) : null));
  }
  $('c-play').addEventListener('click', playPause);
  $('c-step').addEventListener('click', stepOne);
  $('c-restart').addEventListener('click', () => {
    if (!S.clock || S.busy || !leaveOk()) return;
    S.cur = null; hidePoint(); S.done = new Set(); S.open = []; S.closed = []; S.account = MXK.account(S.setup.balance, { t: S.setup.from }); S.fromT = S.setup.from; S.sinceThesis = 0; S.lastBlock = null;
    S.clock.restart(); S.thesis = MXA.thesis.start(snapOf(S.setup.edge, S.series, S.dataVersion, S.setup.from, null));
    log('Restarted from the beginning: the paper account and the thesis start again. Stored attempts and lessons are kept.'); renderAccount(); renderThesis(); draw();
  });
  $('c-speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (!b || !S.clock) return; S.clock.setSpeed(+b.dataset.speed); S.setup.speed = +b.dataset.speed; markSpeed(); draw(); });
  $('htf-sw').addEventListener('click', (e) => { const b = e.target.closest('[data-htf]'); if (!b || !S.clock) return; S.htf = b.dataset.htf; markHtf(); CH.htf.timeScale().resetTimeScale(); draw(); });
  $('c-jump').addEventListener('click', async () => {
    if (!S.clock || S.busy) return; const v = $('c-jump-at').value, t = v ? Date.parse(v + (v.length <= 16 ? ':00' : '') + 'Z') / 1000 : NaN;
    if (!Number.isFinite(t)) { say('replay-msg', 'Give a date and time (UTC) to jump to.'); return; }
    if (!leaveOk()) return;
    if (S.cur && !S.cur.closed) await settlePoint();
    const was = S.clock.state().t; S.clock.jump(t); const now = S.clock.state().t; S.fromT = now; S.sinceThesis = THESIS_EVERY; closeDue(now);
    log(`Jumped from ${fmtTime(was)} to ${fmtTime(now)}.` + (now > was ? ' Setups in between were not shown.' : ' Setups already decided stay decided.')); renderAccount(); draw();
  });
  document.addEventListener('keydown', (e) => {
    if (activeTab !== 'train' || !S.clock || e.altKey || e.ctrlKey || e.metaKey) return;
    const on = (sel) => !!(e.target && e.target.closest && e.target.closest(sel));
    if (on('input, textarea, select, [role="tab"], [contenteditable]')) return;      // typing, or moving along the tabs
    if (e.code === 'Space') { if (on('button, a, summary')) return; e.preventDefault(); playPause(); }   // Space on a button presses that button
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepOne(); }
  });

  // ---- sessions -------------------------------------------------------------------------------------------------------
  // curId: the setup the clock is on when its decision point is not built yet (the first save of a run is made before the
  // attempt, to have the session id the attempt carries).
  async function saveSession(quiet, curId) {
    const st = S.setup, cs = S.clock.state();
    const replay = MXR.session.save({ id: S.sessionId, edge: st.edge.id, market: st.edge.market, tf: st.tf, t: cs.t, from: st.from, to: st.to, speed: cs.speed, balance: S.account.balance, risk: { riskPct: st.riskPct }, costs: st.costs,
      difficulty: st.difficulty, mode: st.mode, openDecisions: S.cur && !S.cur.closed && S.cur.first.row ? [S.cur.first.row.id] : [], savedAt: new Date().toISOString() });
    const state = { replay, startBalance: st.balance, htf: S.htf, account: S.account, thesis: S.thesis, done: Array.from(S.done), closed: S.closed.slice(-200),
      open: S.open.map((x) => ({ id: x.id, side: x.side, t: x.t, units: x.units, riskCash: x.riskCash })), cur: S.cur && !S.cur.closed ? S.cur.cand.id : curId || null };
    const session = { edge: st.edge.id, title: `${st.edge.name} · ${isoDay(st.from)} to ${isoDay(st.to - DAY)}`, kind: 'replay', status: cs.done ? 'done' : 'paused', candidateId: state.cur, t: cs.t,
      summary: `at ${fmtTime(cs.t)} · balance ${fmtCash(S.account.balance)} · ${S.done.size} setup${S.done.size === 1 ? '' : 's'} decided`, state };
    if (S.sessionId) session.id = S.sessionId;
    const res = await api.post({ action: 'session.save', session }); S.sessionId = res.session.id;
    if (!quiet) { say('replay-msg', `Session saved at ${fmtTime(cs.t)}.`); log(`Session saved (${S.sessionId}).`); renderSessions(); }
    return S.sessionId;
  }
  $('sess-save').addEventListener('click', async () => { if (!S.clock || S.busy) return; try { await saveSession(false); } catch (e) { say('replay-msg', 'The session was not saved: ' + e.message + '.'); } });
  $('sess-resume').addEventListener('click', () => { if (S.clock && S.clock.state().playing) { S.clock.pause(); draw(); } foldSetup(false); renderSessions(); $('resume-box').scrollIntoView({ block: 'center' }); });
  async function resumeSession(id) {
    if (S.loading) return; setupErr('');
    try {
      const s = (await api.get({ get: 'session', id })).session, st0 = s.state || {}, rp = MXR.session.restore(st0.replay), edge = S.edges.find((e) => e.id === rp.edge);
      if (!edge) throw new Error('its edge is no longer in the registry');
      const costs = rp.costs || { spread: edge.costPerRoundTrip || 0, commission: 0, slippage: 0 };
      const setup = { edge, from: rp.from, to: rp.to, tf: rp.tf, speed: rp.speed, balance: st0.startBalance || rp.balance, riskPct: (rp.risk && rp.risk.riskPct) || 0.25, costs, cost: costTotal(costs), difficulty: rp.difficulty || 'expert', mode: rp.mode === 'exam' ? 'exam' : 'train' };
      // show the saved setup in the form too
      $('f-edge').value = edge.id; renderEdgeInfo(); renderLessonsList(); $('f-from').value = isoDay(setup.from); $('f-to').value = isoDay(setup.to - DAY); $('f-tf').value = setup.tf; $('f-diff').value = setup.difficulty; $('f-balance').value = setup.balance; $('f-risk').value = setup.riskPct;
      $('f-spread').value = costs.spread || 0; $('f-comm').value = costs.commission || 0; $('f-slip').value = costs.slippage || 0; renderCostNote();
      document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === setup.mode; }); document.querySelectorAll('input[name="speed"]').forEach((r) => { r.checked = +r.value === setup.speed; }); renderModeNote(); refreshPool(false);
      await startReplay({ id: s.id, setup, t: rp.t, account: st0.account || MXK.account(setup.balance, { t: setup.from }), thesis: st0.thesis || null, done: st0.done || [], closed: st0.closed || [], open: st0.open || [], htf: st0.htf, cur: st0.cur || null });
    } catch (e) { setupErr('That session could not be resumed: ' + e.message + '.'); }
  }

  // ---- a decision point -----------------------------------------------------------------------------------------------
  function hidePoint() {
    for (const id of ['decision', 'mentor', 'lesson', 'prove', 'whatif']) { $(id).hidden = true; clear($(id)); }
    S.future = null; if (CH.series && CH.marked) { CH.series.setMarkers([]); CH.marked = false; }
    if (CH.series) { clearLines(CH.edgeLines); clearMentorLines(); clearLines(CH.annLines); }
    Object.assign(M, { choice: null, entry: null, stop: null, target: null, bias: '', edge: '', reasons: [], text: '', annotations: [], arm: null, dirty: false, tried: false }); clear($('zones'));
    leaveOk.reset(); renderPointBar();
  }
  function pointError(c, e) {
    S.cur = null; hidePoint(); const box = $('decision'); box.hidden = false;
    box.appendChild(el('h2', { text: 'Decision' })); box.appendChild(el('p', { class: 'ac-err', text: `The setup at ${fmtTime(c.t)} could not be decided or stored: ${e.message}. Nothing was recorded for it.` }));
    box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', text: 'Try again', onclick: () => { S.done.delete(c.id); openPoint(c); } }), el('button', { type: 'button', class: 'btn', text: 'Skip this setup', onclick: () => { hidePoint(); draw(); } })));
  }
  // The clock has just reached candidate c and is paused on it.
  async function openPoint(c) {
    S.busy = true; S.done.add(c.id); hidePoint(); draw(); say('replay-msg', `Setup at ${fmtTime(c.t)}: deciding…`);
    const st = S.setup;
    try {
      const snap = snapOf(st.edge, S.series, S.dataVersion, c.t, c), f = MXA.features(snap), hash = MXR.hash(snap);
      if (st.mode === 'exam') { await examPoint(c, snap, f, hash); return; }
      const lessons = (S.lessons = await lessonsFor(st.edge.id)), hist = { rows: historyAt(S.hist.rows, c.t), available: S.hist.available };   // from the run's cache: read again only after a lesson changed
      const r = decideOn(snap, { setup: st, account: S.account, lessons, thesis: S.thesis, history: hist.rows }), d = r.decision, diff = MXA.difficulty(f, d);
      if (!difficultyAllows(st.difficulty, diff)) {
        log(`Setup at ${fmtTime(c.t)} passed by: it is ${diff}, harder than the ${st.difficulty} level chosen. Nothing was stored.`); say('replay-msg', '');
        S.busy = false; if (S.wasPlaying) S.clock.play(); draw(); return;
      }
      S.thesis = MXA.thesis.update(S.thesis, snap, d); renderThesis();
      const firstSave = !S.sessionId; if (firstSave) await saveSession(true, c.id);
      const again = seenBefore(S.pool, c.id);   // decided in an earlier sitting: this one is a same-trade replay (recall), and is stored as one
      const res = await api.post(attemptBody(c, st.edge.id, again ? 'replay-same' : 'train', d, lessons, hash, f)); decidedAs(c.id, S.pool, again ? 'replay-same' : 'train');
      if (again) log(`The setup at ${fmtTime(c.t)} was decided in an earlier sitting: this answer is stored as a same-trade replay (recall, not a new setup).`);
      S.cur = { cand: c, snap, hash, features: f, diff, acctAt: r.acct, historyAvailable: hist.available, first: { decision: d, risk: r.risk, row: res.attempt, n: res.n }, latest: null, correction: null, lesson: null, savedLesson: null, cmp: null, closed: false };
      S.cur.latest = S.cur.first; S.lastBlock = r.risk && !r.risk.allowed ? r.risk.blocks.join('; ') : null;
      if (!firstSave) await keepPlace();
      log(`${d.action} (${d.confidence} confidence) on the ${c.side} setup at ${fmtTime(c.t)}. Attempt ${res.n} stored.`, 'Decision.');
      showPoint(); say('replay-msg', 'Paused on a setup. Approve or correct the decision, then continue.');
    } catch (e) { pointError(c, e); say('replay-msg', ''); }
    finally { S.busy = false; draw(); renderAccount(); }
  }
  // A reload keeps your place: the session's position (the clock, the setups decided, the paper account, the setup the
  // clock is on) is saved with every decision, so "Resume" returns to the latest setup and not to the first one. ONE extra
  // call a decision: the first decision of a run already saves the session before its attempt (for the session id) and that
  // save carries the position, so it adds none; every later one saves after its attempt. A failed save never costs the
  // decision: it is logged and the next decision saves again.
  async function keepPlace() { try { await saveSession(true); } catch (e) { log('The session position was not saved here (' + e.message + '): a reload would return to the setup before this one.'); } }
  // A session saved while paused on a setup: show that decision point again from the stored attempts.
  async function restorePoint(candId) {
    const c = S.cands.find((x) => x.id === candId); if (!c) return; const st = S.setup;
    try {
      const snap = snapOf(st.edge, S.series, S.dataVersion, c.t, c), f = MXA.features(snap), hash = MXR.hash(snap);
      const rows = (await api.get({ get: 'attempts', edge: st.edge.id, cand: c.id })).attempts || []; if (!rows.length) return;
      const acct = MXK.roll(S.account, c.t), risk = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: c.t }, acct, { riskPct: st.riskPct });
      const wrap = (row) => ({ decision: Object.assign({ side: c.side }, restoreApplied(row.decision)), risk, row, n: row.n, stored: true });
      S.cur = { cand: c, snap, hash, features: f, diff: MXA.difficulty(f, rows[0].decision), acctAt: acct, historyAvailable: null, first: wrap(rows[0]), latest: wrap(rows[rows.length - 1]), correction: null, lesson: null, savedLesson: null, cmp: null, closed: false, restored: true };
      // the verdict already stored on its first attempt comes back with it (one read, on resume only), so the point is not
      // shown as unjudged
      try { const ks = ((await api.get({ get: 'corrections', edge: st.edge.id, cand: c.id })).corrections || []).filter((k) => k.attemptId === rows[0].id); if (ks.length) S.cur.correction = ks[ks.length - 1]; } catch (e) { /* shown as unjudged */ }
      // The lesson draft comes back too, with nothing kept in the browser: the proposal is a pure function of the stored
      // attempt, the stored correction and the features of the snapshot rebuilt here, so it is simply made again (edits typed
      // into a draft that was never saved are not kept: a draft carries the corrected answer, which must not sit in browser
      // storage). One read, on resume only, says whether a lesson was already saved from this correction.
      if (S.cur.correction) {
        S.cur.lesson = MXA.lessons.fromCorrection(S.cur.first.decision, Object.assign({}, S.cur.correction, { sessionId: S.sessionId }), f);
        try { S.cur.savedLesson = await savedLessonOf(st.edge.id, S.cur.correction.id); } catch (e) { S.cur.lesson = null; }   // not known: no draft is offered, rather than a second copy of a saved lesson
      }
      S.done.add(c.id); showPoint(); if (S.cur.correction) { if (S.cur.lesson) { renderLesson(); if (S.cur.savedLesson) say('lesson-msg', `Lesson saved ✓ (version ${S.cur.savedLesson.version}).`); } renderProve(); } renderAttempts(rows);
      log(`Back on the setup at ${fmtTime(c.t)}: ${rows.length} stored attempt${rows.length === 1 ? '' : 's'}.`);
    } catch (e) { log(`The decision point of ${candId} could not be shown again: ${e.message}`); }
  }
  function showPoint() { renderDecision(); drawEdgeLines(S.cur.latest.decision); if (S.setup.mode !== 'exam') renderMentor(); renderWhatIf(); renderPointBar(); draw(); }

  const txtList = (items, none, lessons) => listOr(el('ul', { class: 'txt-list' }), items || [], none, (x) => el('li', { text: humanize(x, lessons) }));
  // The decision panel. o = { idp (id prefix), edge, cand, d, risk, diff, stored (text), firstAction, hash, historyAvailable, lessons, title,
  //   fold (true: the detail sits behind disclosures whose open state is remembered), onLessons(ids) (opens lessons by id) }
  // Folded (the Train card): the answer, its sentence, the levels and the main reasons stay in sight; the evidence, the full
  // reasons, uncertainty, risk, similar cases, lessons and the setup's facts are each one click away. Nothing is left out.
  const foldState = () => { try { const v = JSON.parse(prefGet('mxacFold') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  function foldBox(idp, key, title, sub) {
    const d = el('details', { class: 'more dfold', id: `${idp}-fold-${key}`, 'data-fold': key, open: !!foldState()[key] }, el('summary', {}, el('b', { text: title }), sub ? el('small', { text: sub }) : null));
    d.addEventListener('toggle', () => { const v = foldState(); if (d.open) v[key] = true; else delete v[key]; prefSet('mxacFold', JSON.stringify(v)); });
    return d;
  }
  function decisionView(box, o) {
    const d = o.d, c = o.cand, risk = o.risk, e = o.edge, idp = o.idp || 'dec', lessons = o.lessons || [], fold = !!o.fold;
    // a section: folded, a disclosure with the title as its summary; else the heading and the content straight in the card
    const part = (key, title, sub) => { if (fold) { const f = foldBox(idp, key, title, sub); box.appendChild(f); return f; } box.appendChild(el('h3', { text: title })); return box; };
    box.appendChild(el('h2', {}, o.title || 'Decision', el('small', { text: `${e.name} · ${c ? c.side + ' setup' : 'no setup'} · ${fmtTime(d.t)}` + (o.diff ? ` · ${o.diff} difficulty` : '') })));
    box.appendChild(el('div', { class: 'dec-top' }, actBadge(d.action, false, idp + '-action'), el('span', { class: 'pill', id: idp + '-conf' }, 'confidence ', el('b', { text: d.confidence || 'n/a' })),
      el('span', { class: 'ac-ok', id: idp + '-stored', text: o.stored || '' }), o.firstAction ? el('span', { class: 'pill', text: `first answer: ${o.firstAction}` }) : null));
    box.appendChild(el('p', { class: 'dec-thesis', id: idp + '-thesis', text: humanize(d.thesis, lessons) }));
    const clash = conflictIds(d);
    if (clash && typeof o.onLessons === 'function') {
      const name = (id) => { const l = lessons.find((x) => x.id === id); return l && l.title ? `"${l.title}"` : id; };
      box.appendChild(el('p', { class: 'ac-warn', id: idp + '-conflict' }, `Two lessons disagree on this setup: ${name(clash[0])} and ${name(clash[1])}. You settle which one holds: revise one or switch one off. `,
        el('button', { type: 'button', class: 'link', id: idp + '-conflict-open', text: 'Open them in the Lessons tab', onclick: () => o.onLessons(clash) })));
    }
    if (c) {
      const lv = el('dl', { class: 'kv' }); for (const [k, v] of [['Entry', fmtPrice(d.entry)], ['Stop', fmtPrice(d.stop)], ['Target', d.target == null ? 'none (the stop is trailed)' : fmtPrice(d.target)]]) { lv.appendChild(el('dt', { text: k })); lv.appendChild(el('dd', { class: 'num', text: v })); }
      box.appendChild(lv); if (d.action === 'WAIT') box.appendChild(el('p', { class: 'note', text: 'On WAIT these are the levels of the setup that was not taken. They are drawn on the chart as dashed lines.' }));
    }
    const ev = d.evidence || {};
    if (fold) {
      const m = mainReasons(d);
      box.appendChild(el('h3', {}, 'Main reasons', el('small', { text: m.kind === 'wait' ? 'why it waits' : 'the strongest evidence for it' })));
      box.appendChild(listOr(el('ul', { class: 'txt-list', id: idp + '-main' }), m.items, m.kind === 'wait' ? 'No reason to wait was recorded.' : 'Nothing supports it.', (x) => el('li', { text: humanize(x, lessons) })));
      if (m.more > 0) box.appendChild(el('p', { class: 'note', id: idp + '-main-more', text: `${m.more} more ${m.more === 1 ? 'is' : 'are'} in the full lists below.` }));
    }
    const evItem = (sign) => (x) => el('li', {}, el('span', { text: humanize(x.text || x.factor, lessons) }), el('span', { class: 'w', title: 'weight of this item', text: fin(x.weight) ? sign + x.weight : 'n/a' }));
    const evBox = fold ? part('evidence', 'Evidence for and against', fin(ev.support) && fin(ev.contradiction) ? `weights ${ev.support} for, ${ev.contradiction} against` : '') : box;
    evBox.appendChild(el('div', { class: 'ev' },
      el('div', {}, el('h3', {}, 'Evidence for', el('small', { text: fin(ev.support) ? `weights add to ${ev.support}` : '' })), listOr(el('ul', { class: 'ev-list for', id: idp + '-support' }), d.supporting || [], 'Nothing supports it.', evItem('+'))),
      el('div', {}, el('h3', {}, 'Evidence against', el('small', { text: fin(ev.contradiction) ? `weights add to ${ev.contradiction}` : '' })), listOr(el('ul', { class: 'ev-list against', id: idp + '-against' }), d.contradicting || [], 'Nothing contradicts it.', evItem('−')))));
    if (fin(ev.needMargin)) evBox.appendChild(el('p', { class: 'note', text: `This edge takes a trade when the evidence for it beats the evidence against it by ${ev.needMargin} and nothing blocks it.` }));
    const nWait = (d.waitReasons || []).length, nFor = (d.waitingFor || []).length;
    if (nWait || nFor) {
      const w = fold ? part('wait', 'Reasons to wait, and what it is waiting for', `${nWait} reason${nWait === 1 ? '' : 's'}`) : box;
      if (nWait) { w.appendChild(el('h3', { text: 'Reasons to wait' })); w.appendChild(txtList(d.waitReasons, '', lessons)); }
      if (nFor) { w.appendChild(el('h3', { text: 'What it is waiting for' })); w.appendChild(txtList(d.waitingFor, '', lessons)); }
    }
    { const u = fold ? part('doubt', 'Uncertainty, and what would prove it wrong') : box;
      u.appendChild(el('h3', { text: 'Uncertainty' })); u.appendChild(txtList((d.uncertainty || []).concat(d.notes || []), 'Nothing flagged.', lessons));
      u.appendChild(el('h3', { text: 'What would prove it wrong' })); u.appendChild(txtList(d.invalidation, 'No invalidation level could be named.', lessons)); }
    if (!c) return;
    const R = d.risk || {};
    const rkBox = part('risk', 'Risk', fold ? (risk ? (risk.allowed ? 'the risk engine allows it' : 'blocked by the risk engine') : '') : null);
    const rk = el('dl', { class: 'kv' }), put = (k, v) => { rk.appendChild(el('dt', { text: k })); rk.appendChild(el('dd', { text: v })); };
    put('Reward to risk', fin(R.rr) ? `${R.rr}` + (fin(R.rrNet) ? ` (${R.rrNet} after costs)` : '') : 'no fixed target');
    put('Stop distance', fin(R.stopAtr) ? `${R.stopAtr} ATR` : 'n/a');
    if (risk) { const p = risk.allowed ? risk : risk.proposed || {}; put('Size', risk.allowed ? `${risk.size} units, risking ${fmtCash(risk.riskCash)} (${risk.riskPct} % of the balance)` : `none (would be ${p.units || 0} units)`); put('Risk engine', risk.allowed ? 'allowed' : 'blocked: ' + risk.blocks.join('; ')); }
    rkBox.appendChild(rk);
    const sm = d.similar || {};
    part('similar', 'Similar past cases', fold ? (sm.n > 0 ? `n = ${sm.n}` : 'no sample') : null)
      .appendChild(el('p', { id: idp + '-similar', text: (sm.n > 0 ? `n = ${sm.n}, win rate ${fin(sm.winRate) ? Math.round(sm.winRate * 100) + ' %' : 'n/a'}, average ${fmtR(sm.avgR)} after costs. ` : 'No past-case sample to lean on. ') + (sm.note ? sm.note.charAt(0).toUpperCase() + sm.note.slice(1) + '.' : '') + (o.historyAvailable === false ? ' The past-case file for this edge could not be read.' : '') + (fin(sm.total) && sm.total > 0 ? ` Out of ${sm.total} earlier train setups of this edge that had finished by then.` : '') }));
    const la = d.lessonsApplied || [], nApplied = la.filter((l) => l.applied !== false).length;
    part('lessons', 'Lessons applied', fold ? (la.length ? `${nApplied} applied` + (la.length - nApplied ? `, ${la.length - nApplied} matched but not applied` : '') : 'none matched') : null)
      .appendChild(listOr(el('ul', { class: 'txt-list', id: idp + '-lessons' }), la, 'No lesson matched this setup.', (l) => { const full = lessons.find((x) => x.id === l.id); return el('li', { 'data-applied': l.applied === false ? 'no' : 'yes' }, el('b', { text: (l.title || (full && full.title) || l.id) + ': ' }), l.effect || '', l.applied === false ? ' (not applied)' : ''); }));
    const rule = c.rule && typeof c.rule === 'object' ? Object.keys(c.rule) : [];
    if (rule.length) { const dl = el('dl', { class: 'kv' }); for (const k of rule) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', { text: typeof c.rule[k] === 'object' ? JSON.stringify(c.rule[k]) : String(c.rule[k]) })); } box.appendChild(el('details', { class: 'more pm' }, el('summary', { text: 'Facts about this setup from the edge' }), dl)); }
    box.appendChild(el('p', { class: 'versions pm', text: `model ${d.modelVersion || 'none (policy only)'} · policy ${d.policyVersion || 'n/a'} · edge ${d.edgeVersion || 'n/a'} · data ${d.dataVersion || 'n/a'}` + (o.hash ? ` · snapshot ${o.hash}` : '') }));
  }
  function renderDecision() {
    const cur = S.cur, box = clear($('decision')), a = cur.latest; box.hidden = false;
    decisionView(box, { idp: 'dec', edge: S.setup.edge, cand: cur.cand, d: Object.assign({ t: cur.cand.t }, a.decision), risk: a.risk, diff: cur.diff, stored: a.row ? `Attempt ${a.n} stored ✓` : '', firstAction: a !== cur.first ? cur.first.decision.action : null, hash: cur.hash, historyAvailable: cur.historyAvailable, lessons: S.lessons, fold: true, onLessons: (ids) => { MXAC.lessonFocus = { edge: S.setup.edge.id, ids: ids.slice() }; showTab('lessons'); } });
    if (cur.exam) renderExamPoint(box);
    box.appendChild(moreBtn(box, 'dec-more', 'Setup facts and versions'));
    box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'continue', text: 'Continue replay', onclick: playPause }), el('span', { class: 'ac-status', id: 'continue-msg', role: 'status' })));
    renderPointBar();
  }

  // ---- mentor controls ------------------------------------------------------------------------------------------------
  const mentorLevels = (choice) => mentorLevelsOf(S.cur.cand, choice);
  // What is still missing is said in a calm line while the form is being filled; the red "Problem" appears only once Save was
  // pressed with something missing (show = true), and stays current from then on. Save is offered as soon as a choice is made.
  function mentorCheck(show) {
    const c = buildCorrection(M, S.cur.first.row ? S.cur.first.row.id : null), probs = M.choice ? correctionProblems(c, S.cur.first.decision) : [];
    if (show) M.tried = true;
    const n = $('m-err'), on = !!M.tried && probs.length > 0; if (n) { n.hidden = !on; n.textContent = on ? probs.join(' ') : ''; }
    const h = $('m-hint'), calm = !M.tried && probs.length > 0; if (h) { h.hidden = !calm; h.textContent = calm ? 'Before you save: ' + probs.join(' ') : ''; }
    const b = $('m-save'); if (b) b.disabled = !M.choice;
    return probs;
  }
  function renderAnnotations() {
    const ul = $('a-list'); if (!ul) return;
    listOr(ul, M.annotations, 'No mark yet.', (a, i) => el('li', {}, el('div', {}, el('b', { text: (ANNOTATIONS.find((x) => x[0] === a.kind) || [0, a.kind])[1] }), fin(a.price2) ? ` zone ${fmtPrice(Math.min(a.price, a.price2))} to ${fmtPrice(Math.max(a.price, a.price2))}` : ` level ${fmtPrice(a.price)}`, el('small', { text: ' · ' + fmtTime(a.t) })),
      el('button', { type: 'button', class: 'btn sm danger', 'aria-label': 'Delete this mark', text: 'Delete', onclick: () => { M.annotations.splice(i, 1); M.dirty = true; renderAnnotations(); drawAnnotations(); } })));
  }
  function renderMentor() {
    const box = clear($('mentor')), cur = S.cur; box.hidden = false;
    box.appendChild(el('h2', {}, 'Mentor controls', el('small', { text: `your verdict on attempt ${cur.first.n}` })));
    const choices = el('div', { class: 'choices', role: 'group', 'aria-label': 'Your verdict' });
    for (const [v, label] of mentorChoices(cur.first.decision.action)) choices.appendChild(el('button', { type: 'button', class: 'btn', 'data-choice': v, 'aria-pressed': 'false', text: label, onclick: () => choose(v) }));
    box.appendChild(choices);
    const numIn = (k, label) => el('label', { class: 'f' }, el('span', { text: label }), el('input', { type: 'number', step: '0.01', id: 'm-' + k, inputmode: 'decimal', disabled: true, oninput: (e) => { const v = e.target.value.trim(); M.dirty = true; M[k] = v === '' || !Number.isFinite(+v) ? null : +v; if (CH.mentorLines[k] && fin(M[k])) CH.mentorLines[k].applyOptions({ price: M[k] }); else drawMentorLines(); mentorCheck(); } }));
    box.appendChild(el('div', { class: 'lv' }, numIn('entry', 'Entry'), numIn('stop', 'Stop'), numIn('target', 'Target')));
    box.appendChild(el('p', { class: 'note', text: 'For a changed BUY or SELL, type the levels or drag the solid Mentor lines on the chart.' }));
    const bias = el('select', { id: 'm-bias', onchange: (e) => { M.bias = e.target.value; M.dirty = true; } }, el('option', { value: '', text: 'not given' }), el('option', { value: 'up', text: 'up' }), el('option', { value: 'down', text: 'down' }), el('option', { value: 'neutral', text: 'neutral' }));
    const edge = el('select', { id: 'm-edge', onchange: (e) => { M.edge = e.target.value; M.dirty = true; } }, el('option', { value: '', text: 'the same edge' }), S.edges.filter((x) => x.id !== S.setup.edge.id).map((x) => el('option', { value: x.id, text: x.name })));
    box.appendChild(el('div', { class: 'f-grid pm' }, el('label', { class: 'f' }, el('span', { text: 'Your bias' }), bias), el('label', { class: 'f' }, el('span', {}, 'Corrected edge ', el('small', { text: '(optional)' })), edge)));
    box.appendChild(el('h3', { text: 'Why' }));
    box.appendChild(el('div', { class: 'chips', role: 'group', 'aria-label': 'Reasons' }, REASONS.map(([id, label]) => el('button', { type: 'button', class: 'chip', 'data-reason': id, 'aria-pressed': 'false', text: label, onclick: (e) => { const i = M.reasons.indexOf(id); if (i >= 0) M.reasons.splice(i, 1); else M.reasons.push(id); M.dirty = true; e.currentTarget.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true'); mentorCheck(); } }))));
    box.appendChild(el('label', { class: 'f', style: 'margin-top:10px' }, el('span', { text: 'Your explanation' }), el('textarea', { id: 'm-text', maxlength: '4000', placeholder: 'What should it have seen?', oninput: (e) => { M.text = e.target.value; M.dirty = true; mentorCheck(); } })));
    box.appendChild(moreBtn(box, 'm-more', 'Bias, another edge, marks on the chart'));
    box.appendChild(el('h3', { class: 'pm' }, 'Marks on the chart', el('small', { text: 'click the chart for a level, drag for a zone' })));
    const kind = el('select', { id: 'a-kind', 'aria-label': 'Kind of mark' }, ANNOTATIONS.map(([id, label]) => el('option', { value: id, text: label })));
    box.appendChild(el('div', { class: 'f-actions pm', style: 'margin-top:6px' }, el('span', { style: 'flex:1 1 160px;max-width:240px' }, kind), el('button', { type: 'button', class: 'btn', id: 'a-arm', 'aria-pressed': 'false', text: 'Mark on chart', onclick: (e) => { M.arm = M.arm ? null : kind.value; e.currentTarget.setAttribute('aria-pressed', M.arm ? 'true' : 'false'); $('chart').classList.toggle('arm', !!M.arm); $('chart').style.touchAction = M.arm || isTake(M.choice) ? 'none' : ''; } })));
    box.appendChild(el('ul', { class: 'plain-list small pm', id: 'a-list' })); renderAnnotations();
    box.appendChild(el('p', { class: 'note', id: 'm-hint', hidden: true })); box.appendChild(el('p', { class: 'ac-err', id: 'm-err', role: 'alert', hidden: true }));
    box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'm-save', disabled: true, text: 'Save correction', onclick: saveCorrection }), el('span', { class: 'ac-status', id: 'm-msg', role: 'status' })));
  }
  function choose(v) {
    M.choice = v; M.dirty = true; M.tried = false; leaveOk.reset(); document.querySelectorAll('#mentor [data-choice]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.choice === v ? 'true' : 'false'));
    const lv = mentorLevels(v), take = isTake(v);
    for (const k of ['entry', 'stop', 'target']) { M[k] = lv[k]; const inp = $('m-' + k); inp.disabled = !take; inp.value = take && fin(lv[k]) ? lv[k] : ''; }
    drawMentorLines(); mentorCheck();
  }
  async function saveCorrection() {
    const cur = S.cur; if (!cur || S.busy) return; if (mentorCheck(true).length) { const n = $('m-err'); if (n) n.scrollIntoView({ block: 'nearest' }); return; } S.busy = true; $('m-save').disabled = true; say('m-msg', 'Saving…');
    try {
      if (cur.corRestore) {   // twice the server had no stored attempt for this verdict: the decision the page holds is stored again (the usual attempt call), once
        const was = cur.first.row, r = await api.post(attemptBody(cur.cand, S.setup.edge.id, was.mode === 'replay-same' ? 'replay-same' : 'train', cur.first.decision, (was.lessonsAvailable || []).map((id) => ({ id })), cur.hash, cur.features, was.sessionId || S.sessionId));
        cur.first.row = r.attempt; cur.first.n = r.n; cur.corRestore = false; cur.corFails = 0;
        const sm = document.querySelector('#mentor h2 small'); if (sm) sm.textContent = `your verdict on attempt ${r.n}`;
        log(`The stored decision of the setup at ${fmtTime(cur.cand.t)} could not be found, so it was stored again as attempt ${r.n}.`);
      }
      const c = buildCorrection(M, cur.first.row.id), errorClass = MXA.classifyError(cur.first.decision, c, null);
      const res = await api.post({ action: 'correct', edge: S.setup.edge.id, correction: Object.assign({}, c, { errorClass }) });
      cur.corFails = 0; $('m-save').textContent = 'Save correction'; $('m-err').hidden = true;
      cur.correction = res.correction; cur.cmp = null; M.dirty = false; leaveOk.reset(); renderPointBar(); say('replay-msg', 'Verdict saved. Continue when you are ready.'); if ($('continue-msg')) say('continue-msg', '');
      say('m-msg', `Correction saved ✓ (${c.verdict}${c.action ? ' → ' + c.action : ''}; classed as ${errorClass}).`);
      log(`${c.verdict}${c.action ? ', change to ' + c.action : ''}${c.reasons.length ? ' (' + c.reasons.join(', ') + ')' : ''}. Stored.`, 'Correction.');
      const draft = MXA.lessons.fromCorrection(cur.first.decision, Object.assign({}, res.correction, { sessionId: S.sessionId }), cur.features);
      cur.lesson = draft; cur.savedLesson = null; renderLesson(); renderProve(); renderWhatIf();
      $('lesson').scrollIntoView({ block: 'nearest' });
    } catch (e) {   // nothing on the form is touched: the choice, the levels, the reasons, the words and the marks all stay
      cur.corFails = e && e.status === 404 ? (cur.corFails || 0) + 1 : 0;
      const f = correctionFailure(e, cur.corFails, S.setup.mode === 'exam' ? 'exam' : cur.first.row.mode); cur.corRestore = f.restore;
      say('m-msg', ''); const n = $('m-err'), b = $('m-save'); if (n) { n.hidden = false; n.textContent = f.text; n.scrollIntoView({ block: 'nearest' }); } if (b) b.textContent = 'Try again';
    }
    finally { S.busy = false; if ($('m-save')) $('m-save').disabled = false; }
  }

  // ---- lesson draft ---------------------------------------------------------------------------------------------------
  const LESSON_KEYS = Object.keys(MXA.FEATURE_DOC).filter((k) => MXA.PRICE_KEYS.indexOf(k) < 0).sort((a, b) => featLabel(a).localeCompare(featLabel(b)));
  function lessonProblemsOf(L) {
    const errs = MXA.lessons.validate(L); if (!String(L.title || '').trim()) errs.push('give the lesson a title');
    for (const c of L.when || []) if (c.v == null || c.v === '' || (Array.isArray(c.v) && !c.v.length)) errs.push(`the condition on ${featLabel(c.f)} has no usable value`);
    return errs;
  }
  // The lesson editor (the Train tab's draft and the Lessons tab's revision): the sentence, the title, the conditions, the
  // effect and its note, the level rules. It edits L in place. o = { idp, features, onChange(errors) } → { refresh, problems }
  function lessonForm(box, L, o) {
    const idp = (o && o.idp) || 'lesson', feats = (o && o.features) || {}; L.when = L.when || []; L.then = L.then || { action: null, adjust: {}, note: '' }; L.then.adjust = L.then.adjust || {};
    const plain = el('p', { class: 'plain', id: idp + '-plain' }), err = el('p', { class: 'ac-err', id: idp + '-err', role: 'alert', hidden: true });
    const refresh = () => { plain.textContent = lessonText(L); const errs = lessonProblemsOf(L); err.hidden = !errs.length; err.textContent = errs.length ? 'This lesson cannot be saved yet: ' + errs.join('; ') + '.' : ''; if (o && o.onChange) o.onChange(errs); return errs; };
    box.appendChild(plain);
    box.appendChild(el('label', { class: 'f' }, el('span', { text: 'Title' }), el('input', { type: 'text', id: idp + '-title', maxlength: '160', value: L.title, oninput: (e) => { L.title = e.target.value; refresh(); } })));
    box.appendChild(el('h3', {}, 'When', el('small', { text: 'every condition must hold' })));
    const conds = el('div', { id: idp + '-conds' }); box.appendChild(conds);
    const drawConds = () => {
      clear(conds);
      L.when.forEach((c, i) => {
        const fSel = el('select', { 'aria-label': 'Feature', onchange: (e) => { c.f = e.target.value; refresh(); } }, LESSON_KEYS.map((k) => el('option', { value: k, text: featLabel(k), selected: k === c.f, title: MXA.FEATURE_DOC[k] })));
        const oSel = el('select', { 'aria-label': 'Comparison', onchange: (e) => { c.op = e.target.value; const p = parseValue(c.op, vIn.value); if (p.ok) c.v = p.v; refresh(); } }, [['eq', 'is'], ['ne', 'is not'], ['gte', 'at least'], ['lte', 'at most'], ['in', 'one of'], ['between', 'between']].map(([v, t]) => el('option', { value: v, text: t, selected: v === c.op })));
        const vIn = el('input', { type: 'text', 'aria-label': 'Value', value: valueToInput(c), oninput: (e) => { const p = parseValue(c.op, e.target.value); e.target.setAttribute('aria-invalid', p.ok ? 'false' : 'true'); c.v = p.ok ? p.v : null; refresh(); } });
        conds.appendChild(el('div', { class: 'cond', 'data-cond': c.f }, fSel, oSel, vIn, el('button', { type: 'button', class: 'btn sm danger', 'data-del': c.f, 'aria-label': `Remove the condition on ${featLabel(c.f)}`, text: 'Remove', onclick: () => { L.when.splice(i, 1); drawConds(); refresh(); } })));
      });
      if (!L.when.length) conds.appendChild(el('p', { class: 'note', text: 'No condition: a lesson needs at least one, or it would fire on every setup.' }));
    };
    drawConds();
    box.appendChild(el('div', { class: 'f-actions', style: 'margin-top:8px' }, el('button', { type: 'button', class: 'btn sm', id: idp + '-add', text: 'Add a condition', onclick: () => { const k = LESSON_KEYS.find((x) => !L.when.some((c) => c.f === x) && feats[x] != null && typeof feats[x] !== 'number') || 'session'; L.when.push({ f: k, op: 'eq', v: feats[k] == null ? '' : feats[k] }); drawConds(); refresh(); } })));
    box.appendChild(el('h3', { text: 'Then' }));
    const adj = el('ul', { class: 'plain-list small', id: idp + '-adjust' });
    const drawAdj = () => { const ks = Object.keys(L.then.adjust || {}); listOr(adj, ks, 'No level rule.', (k) => el('li', {}, el('div', { text: L.then.adjust[k].text || k }), el('button', { type: 'button', class: 'btn sm danger', text: 'Remove', 'aria-label': `Remove the ${k} rule`, onclick: () => { delete L.then.adjust[k]; drawAdj(); refresh(); } }))); };
    box.appendChild(el('div', { class: 'f-grid' },
      el('label', { class: 'f' }, el('span', { text: 'Effect' }), el('select', { id: idp + '-action', onchange: (e) => { L.then.action = e.target.value || null; refresh(); } }, [['WAIT', 'WAIT'], ['SKIP', 'Refuse the setup'], ['TAKE', 'Take the edge\'s trade'], ['FLIP', 'Take the other side'], ['', 'No action (level rules only)']].map(([v, t]) => el('option', { value: v, text: t, selected: (L.then.action || '') === v })))),
      el('label', { class: 'f' }, el('span', { text: 'Note shown when it applies' }), el('input', { type: 'text', id: idp + '-note', maxlength: '400', value: L.then.note || '', oninput: (e) => { L.then.note = e.target.value; } }))));
    box.appendChild(el('h3', {}, 'Level rules', el('small', { text: 'relative to features, never raw prices' }))); box.appendChild(adj); drawAdj();
    box.appendChild(err);
    return { refresh, problems: () => lessonProblemsOf(L) };
  }
  const lessonProblems = () => lessonProblemsOf(S.cur.lesson);
  function renderLesson() {
    const cur = S.cur, L = cur.lesson, box = clear($('lesson')); box.hidden = false;
    box.appendChild(el('h2', {}, 'Lesson draft', el('small', { text: cur.correction.verdict === 'approve' ? 'optional: an approval can be kept as a rule too' : 'proposed from your correction: edit it before saving' })));
    const form = lessonForm(box, L, { idp: 'lesson', features: cur.features, onChange: (errs) => { const b = $('lesson-save'); if (b) b.disabled = !!errs.length || !!cur.savedLesson; } });
    box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'lesson-save', text: 'Save lesson', onclick: saveLesson }), el('span', { class: 'ac-status', id: 'lesson-msg', role: 'status' })));
    form.refresh();
  }
  async function saveLesson() {
    const cur = S.cur, L = cur.lesson; if (lessonProblems().length || cur.savedLesson || S.busy) return; S.busy = true; $('lesson-save').disabled = true; say('lesson-msg', 'Saving…');
    try {
      const res = await api.post({ action: 'lesson.save', lesson: { edge: L.edge, title: String(L.title).trim(), text: L.text || '', when: L.when, then: { action: L.then.action || null, adjust: L.then.adjust || {}, note: L.then.note || '' }, source: Object.assign({}, L.source, { sessionId: S.sessionId }), active: true } });
      cur.savedLesson = res.lesson; say('lesson-msg', `Lesson saved ✓ (version ${res.lesson.version}). It is in force from now on.`);
      log(`"${res.lesson.title}" saved: ${lessonText(res.lesson)}`, 'Lesson.'); S.lessons = await lessonsFor(S.setup.edge.id, true); renderLessonsList(); renderProve();
    } catch (e) { say('lesson-msg', ''); const n = $('lesson-err'); n.hidden = false; n.textContent = 'The lesson was not saved: ' + e.message + '.'; $('lesson-save').disabled = false; }
    finally { S.busy = false; }
  }

  // ---- replay and prove -----------------------------------------------------------------------------------------------
  function renderProve() {
    const cur = S.cur, box = clear($('prove')); if (!cur || !cur.correction) { box.hidden = true; return; } box.hidden = false;
    box.appendChild(el('h2', {}, 'Replay and prove', el('small', { text: 'the same decision point, the lessons now in force, a fresh thesis' })));
    box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'prove-run', text: cur.latest === cur.first ? 'Replay same trade' : 'Replay same trade again', onclick: replaySame }), el('span', { class: 'ac-status', id: 'prove-msg', role: 'status' })));
    box.appendChild(el('p', { class: 'ac-err', id: 'prove-err', role: 'alert', hidden: true }));
    if (cur.cmp) {
      const A = cur.first.decision, B = cur.latest.decision, k = cur.correction, cmp = cur.cmp, exp = MXA._internals.expectedOf(k, A);
      const row = (label, a, b, m) => el('tr', {}, el('td', { text: label }), el('td', {}, a), el('td', {}, b), el('td', {}, m));
      const lv = (d, key) => fmtPrice(d[key]), ex = (key) => (exp[key] == null ? (isTake(exp.action) ? 'the setup\'s own' : 'n/a') : fmtPrice(exp[key]));
      const applied = (d) => { const ls = (d.lessonsApplied || []).filter((l) => l.applied !== false); return ls.length ? ls.map((l) => l.title || (S.lessons.find((x) => x.id === l.id) || {}).title || l.id).join('; ') : 'none'; };
      box.appendChild(el('p', { id: 'prove-hash', class: 'ac-ok', text: 'same decision point ✓ (snapshot ' + cur.hash + ')' }));
      box.appendChild(el('div', { class: 'tbl' }, el('table', { class: 'cmp', id: 'prove-table' }, el('thead', {}, el('tr', {}, el('th', { text: '' }), el('th', { text: `Attempt ${cur.first.n}` }), el('th', { text: `Attempt ${cur.latest.n}` }), el('th', { text: 'Mentor' }))),
        el('tbody', {}, row('Action', actBadge(A.action, true), actBadge(B.action, true), exp.action ? actBadge(exp.action, true) : k.verdict), row('Entry', lv(A, 'entry'), lv(B, 'entry'), ex('entry')), row('Stop', lv(A, 'stop'), lv(B, 'stop'), ex('stop')), row('Target', lv(A, 'target'), lv(B, 'target'), ex('target')),
          row('Confidence', A.confidence || 'n/a', B.confidence || 'n/a', ''), row('Lessons applied', applied(A), applied(B), (k.reasons || []).join(', ') || '')))));
      box.appendChild(el('p', { id: 'prove-changed', text: cmp.changed.length ? 'Changed between the two attempts: ' + cmp.changed.map((c) => (c.field === 'waitReasons' ? 'reasons to wait' : c.field === 'lessonsApplied' ? 'lessons applied' : c.field) + (typeof c.from === 'string' || typeof c.from === 'number' || c.from === null ? ` (${c.from === null ? 'none' : c.from} → ${c.to === null ? 'none' : c.to})` : '')).join(', ') + '.' : 'Nothing changed between the two attempts.' }));
      if (cmp.control) box.appendChild(el('p', { id: 'prove-control', 'data-same': cmp.control.sameAsFirst ? 'yes' : 'no', text: cmp.control.text }));
      box.appendChild(el('p', { id: 'prove-lesson', text: cmp.lessonApplied ? 'Lesson applied: yes (' + cmp.lessonIds.map((id) => (S.lessons.find((x) => x.id === id) || {}).title || id).join('; ') + ').' : 'Lesson applied: no.' }));
      box.appendChild(el('p', { class: 'verdict ' + cmp.verdict, id: 'prove-verdict', 'data-verdict': cmp.verdict }, el('b', { text: (VERDICT_WORD[cmp.verdict] || cmp.verdict) + '. ' }), cmp.note ? cmp.note.charAt(0).toUpperCase() + cmp.note.slice(1) + '.' : ''));
    } else if (!cur.savedLesson) box.appendChild(el('p', { class: 'note', text: 'No lesson from this correction is saved yet: a replay now would only use the lessons already in force.' }));
    box.appendChild(el('p', { class: 'honest', text: 'Passing the same trade shows recall, not generalisation.' }));
    box.appendChild(el('h3', { text: 'All attempts on this decision point' }));
    box.appendChild(el('div', { class: 'tbl' }, el('table', { id: 'attempts-table' }, el('thead', {}, el('tr', {}, ['#', 'Mode', 'Stored (UTC)', 'Action', 'Confidence', 'Lessons', 'Same snapshot'].map((h) => el('th', { text: h })))), el('tbody', {}))));
    api.get({ get: 'attempts', edge: S.setup.edge.id, cand: cur.cand.id }).then((j) => renderAttempts(j.attempts || []), () => {});
  }
  function renderAttempts(rows) {
    let t = $('attempts-table');
    if (!t) { const box = $('prove'); box.hidden = false; box.appendChild(el('h2', { text: 'Stored attempts on this decision point' })); box.appendChild(el('div', { class: 'tbl' }, t = el('table', { id: 'attempts-table' }, el('thead', {}, el('tr', {}, ['#', 'Mode', 'Stored (UTC)', 'Action', 'Confidence', 'Lessons', 'Same snapshot'].map((h) => el('th', { text: h })))), el('tbody', {})))); box.appendChild(el('p', { class: 'honest', text: 'Passing the same trade shows recall, not generalisation.' })); }
    const tb = clear(t.tBodies[0]);
    for (const a of rows) { const d = a.decision || {}; tb.appendChild(el('tr', { 'data-n': a.n }, el('td', { class: 'num', text: a.n }), el('td', { text: a.mode === 'replay-same' ? 'same-trade replay' : a.mode }), el('td', { class: 'num', text: String(a.at || '').slice(0, 16).replace('T', ' ') }), el('td', {}, actBadge(d.action, true)), el('td', { text: d.confidence || 'n/a' }), el('td', { class: 'num', text: (d.lessonsApplied || []).length }), el('td', { text: a.snapshotHash === S.cur.hash ? 'yes ✓' : 'no' }))); }
  }
  async function replaySame() {
    const cur = S.cur; if (!cur || S.busy) return; S.busy = true; $('prove-run').disabled = true; say('prove-msg', 'Replaying…'); const perr = $('prove-err'); perr.hidden = true;
    const st = S.setup, c = cur.cand;
    try {
      const snap = snapOf(st.edge, S.series, S.dataVersion, c.t, c), hash = MXR.hash(snap), want = cur.first.row.snapshotHash;
      if (hash !== want) throw new Error(`this is not the same decision point: the candles give snapshot ${hash}, the first attempt saw ${want}. The replay was refused and nothing was stored`);
      const lessons = (S.lessons = await lessonsFor(st.edge.id)), hist = { rows: historyAt(S.hist.rows, c.t) };
      const f = MXA.features(snap), r = decideOn(snap, { setup: st, account: cur.acctAt, lessons, thesis: MXA.thesis.start(snap), history: hist.rows }), d = r.decision;   // a fresh thesis: nothing carried over
      const res = await api.post(attemptBody(c, st.edge.id, 'replay-same', d, lessons, hash, f));
      cur.latest = { decision: d, risk: r.risk, row: res.attempt, n: res.n };
      // the control: the same snapshot with no lesson at all (pure, nothing stored), so the change can be pinned on the lessons
      const control = decideOn(snap, { setup: st, account: cur.acctAt, lessons: [], thesis: MXA.thesis.start(snap), history: hist.rows }).decision;
      cur.cmp = proveWithControl(MXA.compare(cur.first.decision, d, cur.correction), cur.first.decision, control, cur.correction);
      // the lesson's counters: the lessons this replay applied, or the lesson saved from this correction when it did not fire
      const ids = cur.cmp.lessonIds.length ? cur.cmp.lessonIds : cur.savedLesson ? [cur.savedLesson.id] : [];
      for (const id of ids) { const inc = cur.cmp.verdict === 'learned' ? { replayPass: 1 } : { replayFail: 1 }; if (cur.cmp.lessonIds.indexOf(id) >= 0) inc.applied = 1; try { const sr = await api.post({ action: 'lesson.stats', id, inc }), L = S.lessons.find((x) => x.id === id); if (L && sr.stats) L.stats = sr.stats; } catch (e) { log('A lesson counter could not be updated: ' + e.message); } }
      log(`Attempt ${res.n} (same trade): ${d.action}. Verdict: ${VERDICT_WORD[cur.cmp.verdict] || cur.cmp.verdict}.`, 'Replay.');
      renderDecision(); drawEdgeLines(d); renderProve(); renderWhatIf(); renderLessonsList(); $('prove').scrollIntoView({ block: 'nearest' });
    } catch (e) { perr.hidden = false; perr.textContent = e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.'; say('prove-msg', ''); if ($('prove-run')) $('prove-run').disabled = false; }
    finally { S.busy = false; draw(); }
  }

  // "Continue replay": the decision point is closed. The paper account follows the engine's latest answer on it.
  async function settlePoint() {
    const cur = S.cur; if (!cur || cur.closed) return; cur.closed = true; S.busy = true;
    const d = cur.latest.decision, c = cur.cand, risk = cur.latest.risk, edge = S.setup.edge;
    try {
      if (isTake(d.action) && !cur.exam) {
        const own = d.action === actOf(c.side) && d.entry === c.entry && d.stop === c.stop;
        if (!risk || !risk.allowed || !(risk.size > 0)) log(`${c.id}: not opened on paper, the risk engine did not allow it.`);
        else if (!own) log(`${c.id}: the paper account could not follow this trade. Its side or levels differ from the setup's own, and the outcome file only covers those.`);
        else {
          try {
            const out = (await api.get({ get: 'outcome', id: c.id, edge: edge.id })).outcome;
            S.account = MXK.open(MXK.roll(S.account, c.t), { id: c.id, market: c.market, side: c.side, units: risk.size, entry: c.entry, stop: c.stop, target: c.target, t: c.t });
            S.open.push({ id: c.id, side: c.side, t: c.t, units: risk.size, riskCash: risk.riskCash, exitT: out.exitT, netR: netRAt(out, edge.costPerRoundTrip, S.setup.cost), reason: out.reason, unfilled: unfilled(out) });
            log(`${d.action} ${risk.size} units at ${fmtPrice(c.entry)}, stop ${fmtPrice(c.stop)}, risking ${fmtCash(risk.riskCash)}.`, 'Paper trade opened.');
          } catch (e) { log(`${c.id}: the paper account could not follow this trade, its result could not be read (${e.message}).`); }
        }
      }
    } finally { S.busy = false; }
    S.cur = null; hidePoint(); renderAccount(); const col = document.querySelector('.ac-chart-col'); if (col) col.scrollTop = 0; showNode($('chart-wrap'), $('replay'));
  }

  // ---- what if ------------------------------------------------------------------------------------------------------------
  const greyBars = (bars) => { const g = css('--ink-faint'); return bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: g, wickColor: g, borderColor: g })); };
  // The card. o = { idp, edge, cand, attemptId, mode, resultId | blindId, engine, mentor, mentorLabel, costs, outcome (undefined = read
  // it from the API, which allows it once the attempt is stored), judged (false = no verdict yet), chart: { tf, show(bars), clear() } | null }
  // Before the attempt is stored it draws nothing at all: no card, no button.
  function whatIfCard(box, o) {
    clear(box); if (!whatIfAllowed(o)) { box.hidden = true; return null; }
    box.hidden = false; const idp = o.idp || 'whatif', w = whatIfWindow(o.edge, o.cand.t), alts = whatIfAlternatives(o), costs = o.costs || { spread: 0, commission: 0, slippage: 0 }, total = costTotal(costs);
    const msg = el('span', { class: 'ac-status', id: idp + '-msg', role: 'status', 'aria-live': 'polite' }), out = el('div', { id: idp + '-out' });
    box.appendChild(el('h2', { class: 'c-h' }, 'What if', el('small', { text: 'other ways to have played this setup, on the candles that came after it' })));
    box.appendChild(el('p', { text: 'The attempt for this setup is stored, so the candles after the decision may now be read. One setup is one sample: hindsight is for study, not evidence. Nothing here changes a lesson or a score, and nothing here is stored.' }));
    if (o.judged === false) box.appendChild(el('p', { class: 'ac-warn', id: idp + '-hindsight', text: 'You have not judged this decision yet. If you look now, your verdict will be made with hindsight.' }));
    if (!alts.length) { box.appendChild(el('p', { class: 'note', text: 'This setup has no entry and stop to build alternatives from.' })); return box; }
    const run = el('button', { type: 'button', class: 'btn', id: idp + '-run', text: 'Simulate the alternatives', onclick: async () => {
      run.disabled = true; msg.textContent = `Loading ${w.tf} candles after the decision…`; if (o.chart) o.chart.clear();
      try {
        MXAC.whatIfLoads.push({ candidateId: o.cand.id, attemptId: o.attemptId, from: w.from, to: w.to, tf: w.tf });   // every read of later candles is listed (the audit checks each came after its attempt)
        const bars = await MXR.load({ sym: o.edge.market, tf: w.tf, from: w.from, to: w.to });
        if (!bars.length) { msg.textContent = ''; clear(out).appendChild(el('p', { class: 'note', id: idp + '-none', text: `No ${w.tf} candle after ${fmtTime(o.cand.t)} could be loaded, so nothing can be simulated here.` })); return; }
        let outcome = o.outcome; if (outcome === undefined) { try { outcome = (await api.get({ get: 'outcome', id: o.cand.id, edge: o.edge.id })).outcome; } catch (e) { outcome = null; } }
        const rows = whatIfRun(alts, bars, costs), last = bars[bars.length - 1], n2 = (v) => (fin(v) ? (v > 0 ? '+' : '') + v.toFixed(2) + 'R' : 'n/a');
        clear(out); msg.textContent = '';
        out.appendChild(el('div', { class: 'tbl' }, el('table', { class: 'wi', id: idp + '-table' }, el('thead', {}, el('tr', {}, ['Alternative', 'Net R after costs', 'Exit', 'Filled', 'Levels', 'Best', 'Worst', 'Exit time (UTC)'].map((h) => el('th', { text: h })))),
          el('tbody', {}, rows.map((r) => { const x = r.result; return el('tr', { 'data-alt': r.key, 'data-filled': x.filled ? 'yes' : 'no' }, el('td', {}, el('b', { text: r.label })), el('td', { class: 'num', text: x.filled || r.wait ? n2(x.netR) : 'n/a' }), el('td', { text: WHATIF_REASON[x.reason] || x.reason }),
            el('td', { text: r.wait ? 'no trade' : x.filled ? 'filled at ' + fmtPrice(x.fill) : 'not filled' }), el('td', { class: 'num', text: r.wait ? 'none' : `${r.side} ${r.entry == null ? 'at the open' : fmtPrice(r.entry)}, stop ${fmtPrice(r.stop)}, target ${r.target == null ? 'none' : fmtPrice(r.target)}` }), el('td', { class: 'num', text: x.filled ? n2(x.mfeR) : 'n/a' }), el('td', { class: 'num', text: x.filled ? n2(x.maeR) : 'n/a' }), el('td', { class: 'num', text: x.filled && fin(x.exitT) ? fmtTime(x.exitT).replace(' UTC', '') : 'n/a' })); })))));
        out.appendChild(el('p', { class: 'note', id: idp + '-rules', text: `Conservative rules: candles are read as bid prices and the spread is paid; when one candle touches both the stop and the target, the stop is taken; a stop that gaps is filled at the open (worse); a resting entry never fills better than its price, and on the candle that fills it only the stop can be hit. Costs: ${total.toFixed(2)} a round trip. Best and worst are the furthest the trade went for and against it, in R.` }));
        out.appendChild(el('p', { class: 'note', id: idp + '-window', text: `Candles: ${bars.length} of ${w.tf} from ${fmtTime(bars[0].time)} to ${fmtTime(last.time)} (${bars.src || 'candle feed'}), read for ${w.why}. A row "still open" had not reached its stop or target by the last candle read.` }));
        out.appendChild(el('p', { id: idp + '-compare', 'data-match': /does NOT match/.test(whatIfNote(rows[0], outcome)) ? 'no' : outcome ? 'yes' : 'none', text: whatIfNote(rows[0], outcome) }));
        if (o.chart) {
          const note = el('span', { class: 'ac-status', id: idp + '-shown', role: 'status' });
          const show = el('button', { type: 'button', class: 'btn', id: idp + '-show', 'aria-pressed': 'false', text: 'Show these candles on the chart', onclick: async () => {
            if (show.getAttribute('aria-pressed') === 'true') { o.chart.clear(); show.setAttribute('aria-pressed', 'false'); show.textContent = 'Show these candles on the chart'; note.textContent = ''; return; }
            try {
              const cb = o.chart.tf === w.tf ? bars : await MXR.load({ sym: o.edge.market, tf: o.chart.tf, from: Math.floor(w.from / MXR.TF[o.chart.tf]) * MXR.TF[o.chart.tf], to: w.to }); if (!cb.length) { note.textContent = 'No candle to show on this chart timeframe.'; return; }
              o.chart.show(greyBars(cb)); show.setAttribute('aria-pressed', 'true'); show.textContent = 'Hide the later candles'; note.textContent = 'Grey candles from the "after the decision" mark came AFTER the decision. They go away when you continue.';
            } catch (e) { note.textContent = 'The candles could not be shown: ' + ((e && e.message) || e) + '.'; }
          } });
          out.appendChild(el('div', { class: 'f-actions' }, show, note));
        }
        run.textContent = 'Simulate again';
      } catch (e) { msg.textContent = ''; clear(out).appendChild(el('p', { class: 'ac-err', text: e && e.code ? candleError(e) : 'The alternatives could not be simulated: ' + ((e && e.message) || e) + '.' })); }
      finally { run.disabled = false; }
    } });
    box.appendChild(el('div', { class: 'f-actions' }, run, msg)); box.appendChild(out);
    return box;
  }
  // the Train tab's card: for the decision point the clock is on, once its attempt is stored
  function renderWhatIf() {
    const cur = S.cur, box = $('whatif'); if (!cur || cur.closed || !cur.first || !cur.first.row) { box.hidden = true; clear(box); return; }
    const lv = (d) => (d ? { action: d.action, entry: d.entry, stop: d.stop, target: d.target } : null), k = cur.correction;
    if (S.future) { S.future = null; draw(); }   // the card is drawn afresh: later candles leave the chart until asked for again
    whatIfCard(box, { idp: 'whatif', edge: S.setup.edge, cand: cur.cand, attemptId: cur.first.row.id, mode: cur.exam ? 'exam' : 'train', resultId: cur.exam && cur.exam.row ? cur.exam.row.id : null,
      engine: lv(cur.latest.decision), mentor: k && k.verdict !== 'approve' && k.action ? lv(k) : null, costs: S.setup.costs, outcome: cur.exam ? (cur.exam.row && cur.exam.row.outcome) || null : undefined, judged: cur.exam ? undefined : !!k,
      chart: { tf: S.setup.tf, show: (bars) => { S.future = { bars }; draw(); }, clear: () => { S.future = null; draw(); } } });
  }

  // ---- tests on new setups ----------------------------------------------------------------------------------------------
  // One unseen exam-pool setup: decided without lessons and with them (a fresh thesis and a fresh paper account each time),
  // the attempt and the result stored, and only then may its outcome be read (through ?get=exams).
  async function examOne(c, edge, series, dataVersion, setup, lessons, histAll) {
    const snap = snapOf(edge, series, dataVersion, c.t, c), f = MXA.features(snap), hash = MXR.hash(snap), acct = MXK.account(setup.balance, { t: c.t });
    const hist = { rows: historyAt(histAll.rows, c.t) }, run = (ls) => decideOn(snap, { setup, account: acct, lessons: ls, thesis: MXA.thesis.start(snap), history: hist.rows }).decision;
    const without = run([]), withL = run(lessons), lite = (d) => ({ action: d.action, entry: d.entry, stop: d.stop, target: d.target, confidence: d.confidence });
    const att = await api.post(attemptBody(c, edge.id, 'exam', withL, lessons, hash, f));
    const lessonIds = (withL.lessonsApplied || []).map((l) => l.id).filter((x, i, a) => a.indexOf(x) === i);
    const res = await api.post({ action: 'exam.result', result: { edge: edge.id, candidateId: c.id, lessonIds, withLessons: lite(withL), withoutLessons: lite(without), sessionId: S.sessionId, attemptId: att.attempt.id } });
    return { snap, hash, features: f, without, withL, attempt: att, result: res.result, lessonIds };
  }
  // after a batch: each matched lesson's exam counters, from the graded rows of this batch
  async function examLessonStats(edgeId, ids, all) {
    const rows = (all || []).filter((r) => ids.indexOf(r.candidateId) >= 0), by = {};
    for (const r of rows) for (const id of r.lessonIds || []) { const b = (by[id] = by[id] || { examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 }); b.examN++; if (sameAnswer(r.withLessons, r.withoutLessons)) b.examAgree++; if (fin(r.rWith) && fin(r.rWithout)) { b.examNetWith += r.rWith; b.examNetWithout += r.rWithout; } }
    for (const id of Object.keys(by)) { const b = by[id], inc = { examN: b.examN }; if (b.examAgree) inc.examAgree = b.examAgree; if (b.examNetWith) inc.examNetWith = Math.round(b.examNetWith * 1000) / 1000; if (b.examNetWithout) inc.examNetWithout = Math.round(b.examNetWithout * 1000) / 1000; try { await api.post({ action: 'lesson.stats', id, inc }); } catch (e) { /* a counter, not a result */ } }
  }
  async function renderExams(have) {
    const edge = S.setup ? S.setup.edge : edgeSel(); if (!edge) return;
    const j = have || await api.get({ get: 'exams', edge: edge.id }), rows = j.exams || [], s = examSummary(rows); S.exams = rows;
    $('exam-out').hidden = !rows.length; if (!rows.length) return;
    const dl = clear($('exam-summary')), cell = (k, v, sub, id) => dl.appendChild(el('div', {}, el('dt', { text: k }), el('dd', { id: id || null }, v, sub ? el('small', { text: sub }) : null)));
    cell('New setups tested', String(s.n), `${edge.name}, all runs`, 'exam-n');
    cell('A lesson matched', `${s.matched} of ${s.n}`, null, 'exam-matched');
    cell('Decision changed', `${s.changed} of ${s.n}`, 'with lessons vs without', 'exam-changed');
    cell('Net R with lessons', fmtR(s.netWith), `n = ${s.graded} graded`, 'exam-with');
    cell('Net R without', fmtR(s.netWithout), `n = ${s.graded} graded`, 'exam-without');
    say('exam-note', (s.tooFew ? `Too few to judge: ${s.graded} graded setup${s.graded === 1 ? '' : 's'}, and 20 is the least this page reads anything into. ` : '') + (j.graded === false ? 'The outcome file is missing, so nothing is graded. ' : '') + (s.n - s.graded ? `${s.n - s.graded} not graded (an answer on other levels than the setup's own cannot be read off the outcome file). ` : '') + (s.neverFilled ? `${s.neverFilled} order${s.neverFilled === 1 ? '' : 's'} never filled (no result, counted as 0R). ` : '') + 'A WAIT counts as 0R. These numbers are separate from same-trade replays.');
    const tb = clear($('exam-table').tBodies[0]);
    for (const r of rows.slice(0, 200)) { const nf = unfilled(r.outcome), rr = (v) => (fin(v) ? fmtR(v) : 'not graded'); tb.appendChild(el('tr', { 'data-cand': r.candidateId, 'data-changed': sameAnswer(r.withLessons, r.withoutLessons) ? 'no' : 'yes' }, el('td', { class: 'num', text: fmtTime(r.t) }), el('td', { text: r.side || 'n/a' }), el('td', {}, actBadge(r.withoutLessons.action, true)), el('td', {}, actBadge(r.withLessons.action, true), sameAnswer(r.withLessons, r.withoutLessons) ? null : ' changed'),
      el('td', { class: 'num', text: (r.lessonIds || []).length }), el('td', { class: 'num', text: nf && isTake(r.withoutLessons.action) ? 'never filled' : rr(r.rWithout) }), el('td', { class: 'num', text: nf && isTake(r.withLessons.action) ? 'never filled' : rr(r.rWith) }),
      el('td', {}, el('button', { type: 'button', class: 'btn sm', 'data-whatif': r.candidateId, text: 'What if', onclick: () => examWhatIf(edge, r) })))); }
    clear($('exam-whatif')).hidden = true;
  }
  // a tested setup's alternatives: both answers and the result are stored, so its later candles may be read. The setup's own
  // levels are the ones the answer without lessons carries (a WAIT keeps the levels of the setup it did not take).
  function examWhatIf(edge, r) {
    const wo = r.withoutLessons || {}, st = S.setup && S.setup.edge.id === edge.id ? S.setup : null;
    whatIfCard($('exam-whatif'), { idp: 'xwhatif', edge, cand: { id: r.candidateId, t: r.t, side: r.side, entry: wo.entry, stop: wo.stop, target: wo.target }, attemptId: r.attemptId, mode: 'exam', resultId: r.id,
      engine: r.withLessons, mentor: null, costs: st ? st.costs : { spread: fin(edge.costPerRoundTrip) ? edge.costPerRoundTrip : 0, commission: 0, slippage: 0 }, outcome: r.outcome || null, chart: null });
    const h = $('exam-whatif').querySelector('h2 small'); if (h) h.textContent = `the setup of ${fmtTime(r.t)}, tested with and without lessons`;
    $('exam-whatif').scrollIntoView({ block: 'nearest' });
  }
  async function runExamBatch() {
    const edge = S.setup ? S.setup.edge : edgeSel(); if (!edge || S.busy || S.loading) return;
    const setup = S.setup || readSetup(); if (setup.error) { say('exam-msg', setup.error); return; }
    if (S.clock && S.clock.state().playing) S.clock.pause();
    S.busy = true; $('exam-run').disabled = true; let done = 0, failed = 0; const ids = [];
    try {
      say('exam-msg', 'Reading the unseen setups…');
      const pool = (await poolFor(edge.id, 'exam', true)).candidates || [], pick = pool.slice().sort((a, b) => b.t - a.t).slice(0, 10);
      if (!pick.length) { say('exam-msg', 'No unseen exam setup is left for this edge.'); return; }
      const lessons = await lessonsFor(edge.id), histAll = await historyFor(edge.id, pick[0].t); await ensureCalendar();   // read once for the batch; each setup then costs two calls
      for (const c of pick) {
        say('exam-msg', `Setup ${done + failed + 1} of ${pick.length} (${fmtTime(c.t)}): loading its candles…`);
        try {
          const { series, dataVersion } = await loadSeries(edge.market, c.t, c.t + 1, () => {});
          if (!series['5m'].length) throw new Error('no candles for its date');
          say('exam-msg', `Setup ${done + failed + 1} of ${pick.length} (${fmtTime(c.t)}): deciding and storing…`);
          await examOne(c, edge, series, dataVersion, setup, lessons, histAll); done++; ids.push(c.id);
        } catch (e) { failed++; log(`New setup at ${fmtTime(c.t)} was not tested: ${e && e.code ? candleError(e) : e.message}. Nothing was stored for it.`); }
      }
      delete CACHE.pool[edge.id + '|exam'];
      let ej = await api.get({ get: 'exams', edge: edge.id });
      if (ids.length) { await examLessonStats(edge.id, ids, ej.exams); lessonsChanged(); }
      await renderExams(ej); renderLessonsList();
      say('exam-msg', `${done} new setup${done === 1 ? '' : 's'} tested and stored` + (failed ? `, ${failed} could not be tested (see the replay log)` : '') + '.'); $('exam-run').textContent = 'Test on 10 more';
      log(`${done} unseen setup${done === 1 ? '' : 's'} decided with and without lessons. Results stored.`, 'Test on new setups.');
    } catch (e) { say('exam-msg', 'The test could not run: ' + e.message + '.'); }
    finally { S.busy = false; $('exam-run').disabled = false; draw(); }
  }
  $('exam-run').addEventListener('click', runExamBatch);
  // exam mode of the replay: the clock stopped on an unseen exam setup
  async function examPoint(c, snap, f, hash) {
    const st = S.setup;
    try {
      const lessons = (S.lessons = await lessonsFor(st.edge.id));
      const firstSave = !S.sessionId; if (firstSave) await saveSession(true);
      const x = await examOne(c, st.edge, S.series, S.dataVersion, st, lessons, S.hist); delete CACHE.pool[st.edge.id + '|exam']; if (!firstSave) await keepPlace();   // an exam setup is decided once: the place kept is after it
      const ej = await api.get({ get: 'exams', edge: st.edge.id }), row = (ej.exams || []).find((r) => r.candidateId === c.id) || null;
      S.cur = { cand: c, snap, hash, features: f, diff: MXA.difficulty(f, x.withL), acctAt: null, historyAvailable: null, first: { decision: x.withL, risk: null, row: x.attempt.attempt, n: x.attempt.n }, latest: null, exam: { without: x.without, row }, closed: false };
      S.cur.latest = S.cur.first; S.thesis = MXA.thesis.update(S.thesis, snap, x.withL); renderThesis();
      log(`Exam setup at ${fmtTime(c.t)}: ${x.without.action} without lessons, ${x.withL.action} with. Stored.`, 'Exam.');
      showPoint(); renderExams(ej).catch(() => {}); say('replay-msg', 'Paused on an exam setup. Its result is shown; continue when ready.');
    } catch (e) { pointError(c, e); say('replay-msg', ''); }
    finally { S.busy = false; draw(); }
  }
  function renderExamPoint(box) {
    const x = S.cur.exam, r = x.row, out = r && r.outcome;
    box.appendChild(el('h3', { text: 'Exam answer' }));
    box.appendChild(el('p', { id: 'exam-point' }, 'Without lessons: ', actBadge(x.without.action, true), ' With lessons: ', actBadge(S.cur.first.decision.action, true), sameAnswer(x.without, S.cur.first.decision) ? ' (the same answer)' : ' (changed by a lesson)'));
    box.appendChild(el('p', { text: !out ? 'The result of this setup could not be read.' : unfilled(out) ? `Result (read after both answers were stored): the order never filled (${out.reason}).` : `Result (read after both answers were stored): the setup's own trade made ${fmtR(out.netR)} after costs, exit by ${out.reason || 'rule'}. Without lessons ${fin(r.rWithout) ? fmtR(r.rWithout) : 'not graded'}, with lessons ${fin(r.rWith) ? fmtR(r.rWith) : 'not graded'}.` }));
    box.appendChild(el('p', { class: 'note', text: 'An exam setup is decided once and cannot be corrected or replayed.' }));
  }

  // ---- shared with the other sections -------------------------------------------------------------------------------------
  // "Replay this setup": the Train tab on that setup's day, the clock run onto the setup itself.
  async function openInTrain(edgeId, t) {
    showTab('train'); const edge = S.edges.find((e) => e.id === edgeId); if (!edge || !fin(t) || S.loading) return false;
    if (S.clock && S.clock.state().playing) S.clock.pause();
    $('f-edge').value = edgeId; renderEdgeInfo(); renderLessonsList(); document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === 'train'; }); renderModeNote();
    $('f-from').value = isoDay(t); $('f-to').value = isoDay(t); refreshPool(false);
    await startReplay(null, { at: t }); return true;
  }
  MXAC.kit = { pfold, showNode, el, add, clear, listOr, actBadge, actClass, css, say, newChart, viewBarsOf, loadSeries, snapOf, decideOn, ensureCalendar, poolFor, lessonsFor, lessonsChanged, historyFor, seenBefore, attemptBody, decisionView, lessonForm, lessonProblemsOf, openInTrain, whatIfCard,
    decided: decidedAs, leaveGuard, watchUnsaved: (fn) => { if (typeof fn === 'function') UNSAVED.push(fn); }, savedLessonOf, calendar: () => S.calendar, lessonKeys: () => LESSON_KEYS.slice() };

  // ---- boot -----------------------------------------------------------------------------------------------------------
  function boot(me) {
    $('ac-wait').hidden = true;
    if (!me || me.u !== 'owner') { $('ac-gate').hidden = false; return; }          // not the owner: the card, and nothing is loaded
    if (!MXR || !MXA || !MXK || !root.LightweightCharts) { $('ac-gate').hidden = false; clear($('ac-gate')).appendChild(el('p', { class: 'ac-err', text: 'A part of the Academy did not load. Reload the page.' })); return; }
    S.me = me; $('ac-app').hidden = false; renderTabs(); showTab('train'); initSetup();
  }
  (root.MX_ME && typeof root.MX_ME.then === 'function' ? root.MX_ME : Promise.resolve(null)).then(boot, () => boot(null));
})(typeof globalThis !== 'undefined' ? globalThis : this);
