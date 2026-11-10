// MeridianX Academy: the sections beside Train (window.MXAT). Each one is registered with MXAC.registerTab and draws real
// persisted data from /api/academy through the page's paced wrapper (ctx.api); the shared pieces come from ctx.kit
// (assets/academy-ui.js). Nothing here is a mock-up: a section shows stored rows, or an empty state that says what will
// appear and what to do.
//
//   lessons   every lesson of the edge and the global ones: versions, record, revise (with the diff), switch off / on,
//             and the research drafts (saved inactive, or dismissed)
//   progress  attempts, corrections, agreement with the mentor by week, recall against new setups (side by side, never
//             added), mistakes by class with examples, and the mistakes due again (spaced repetition)
//   research  generated studies with their pre-registration, the policy against taking every setup, the owner's notebook
//   models    the offline training report and the registry (nothing is promoted; promotion is a manual owner step)
//   costs     the language-model adapter: on or off, spend against the budgets, the ledger
//   audit     the audit trail by month, filtered by action
//   blind     the mentor answers a setup before seeing the engine's answer
//   session   a whole session replayed at speed, with notes on missed opportunities
//
// Rules kept here: an outcome is asked for only after its attempt (and, in the blind arena, the mentor's answer) is stored;
// only train-pool setups are replayed; a same-trade replay is called recall; a number is never shown as a probability;
// every statistic carries its n, and under MIN_N graded results the page says "too few to judge".
// Replay and paper only: this file talks to /api/academy and nothing else.
//
// The pure helpers at the top are also loaded by Node (tests/academy-tabs.test.mjs).
(function (root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports;
  const MXAC = NODE ? require('./academy-ui.js') : root.MXAC;
  const MXA = NODE ? require('./academy-core.js') : root.MXA;
  const MXR = NODE ? require('./academy-replay.js') : root.MXR;
  const MXK = NODE ? require('./academy-risk.js') : root.MXK;
  if (!MXAC) return;

  // ---- pure helpers -------------------------------------------------------------------------------------------------
  const DAY_MS = 86400000, MIN_N = 20;        // the Train tab's threshold: under 20 graded results nothing is read into a number
  const SCHEDULE_DAYS = [1, 3, 7, 21];        // spaced repetition: days until a mistake is due again, by passes in a row
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const isTake = (a) => a === 'BUY' || a === 'SELL';
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const fmtR = MXAC.fmtR, fmtTime = MXAC.fmtTime, fmtPrice = MXAC.fmtPrice;
  const fmtStamp = (iso) => (typeof iso === 'string' && iso.length >= 16 ? iso.slice(0, 16).replace('T', ' ') + ' UTC' : 'n/a');
  const fmtDay = (iso) => (typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : 'n/a');
  const fmtNum = (v, dp) => (fin(v) ? v.toFixed(dp == null ? 2 : dp) : 'n/a');
  const fmtAvgR = (v) => (fin(v) ? (v > 0 ? '+' : '') + v.toFixed(3) + 'R' : 'n/a');
  const fmtPct = (v) => (fin(v) ? Math.round(v * 100) + ' %' : 'n/a');
  const fmtUsd = (v) => '$' + (fin(v) ? v : 0).toFixed(v > 0 && v < 0.01 ? 4 : 2);
  const tooFew = (n) => !(n >= MIN_N);
  const fewText = (n, what) => `Too few to judge: ${plural(n, what || 'graded result')}, and ${MIN_N} is the least this page reads anything into.`;
  // a rate in words: never a bare percentage under the threshold
  const rateText = (k, n) => (n > 0 ? `${k} of ${n}` + (tooFew(n) ? ' (too few to judge)' : ` (${fmtPct(k / n)})`) : 'none yet');
  const MODE_WORD = { train: 'train', 'replay-same': 'same-trade replay (recall)', exam: 'test on a new setup', blind: 'blind arena' };
  const CLASS_WORD = (c) => String(c || 'unclassified').replace(/-/g, ' ');

  // ISO week of a stored time, as the API names it ('2026-W46')
  function weekOf(iso) {
    const d = new Date(iso); if (Number.isNaN(d.getTime())) return null;
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), wd = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - wd);
    const y = x.getUTCFullYear(); return `${y}-W${String(Math.ceil(((x - Date.UTC(y, 0, 1)) / DAY_MS + 1) / 7)).padStart(2, '0')}`;
  }
  // the action a correction asks for: the mentor's action, or WAIT when a trade was rejected outright (as the API reads it)
  const wanted = (c) => (c && c.action ? c.action : c && c.verdict === 'reject' && c.was && isTake(c.was.action) ? 'WAIT' : null);

  // Agreement with the mentor by week: the share of corrections that were approvals.
  function agreementByWeek(corrections) {
    const by = {}; let n = 0, approve = 0;
    for (const c of Array.isArray(corrections) ? corrections : []) { const k = weekOf(c.at) || 'unknown', w = (by[k] = by[k] || { week: k, n: 0, approve: 0 }); w.n++; n++; if (c.verdict === 'approve') { w.approve++; approve++; } }
    const weeks = Object.values(by).sort((a, b) => (a.week < b.week ? -1 : 1)).map((w) => Object.assign(w, { rate: w.n ? r3(w.approve / w.n) : null, tooFew: tooFew(w.n) }));
    return { n, approve, rate: n ? r3(approve / n) : null, tooFew: tooFew(n), weeks };
  }

  // Recall (same-trade replays) beside results on new setups (tests). Two separate records: they are never added together.
  function recallVsNew(progress) {
    const p = progress || {}, rp = p.replaySame || {}, ex = p.exam || {}, wl = ex.withLessons || {}, wo = ex.withoutLessons || {};
    return { recall: { n: rp.n || 0, graded: rp.graded || 0, pass: rp.pass || 0, fail: rp.fail || 0, rate: rp.graded ? r3(rp.pass / rp.graded) : null, tooFew: tooFew(rp.graded || 0) },
      fresh: { n: ex.n || 0, graded: ex.graded || 0, ungraded: ex.ungraded || 0, agree: ex.agree || 0, netWith: fin(wl.netR) ? wl.netR : 0, netWithout: fin(wo.netR) ? wo.netR : 0, delta: fin(ex.deltaNetR) ? ex.deltaNetR : 0, tooFew: tooFew(ex.graded || 0) } };
  }

  // Mistakes by error class, most frequent first, each with its latest examples. counts (GET ?get=mistakes byClass) wins
  // over the count of the rows passed in, which may be only the latest ones.
  function mistakeGroups(corrections, counts, perClass) {
    const by = {}, keep = perClass || 3;
    for (const c of Array.isArray(corrections) ? corrections : []) { if (c.verdict === 'approve') continue; const k = c.errorClass || 'unclassified'; (by[k] = by[k] || []).push(c); }
    const names = new Set(Object.keys(by).concat(Object.keys(counts || {})));
    return Array.from(names).map((cls) => { const rows = (by[cls] || []).slice().sort((a, b) => (a.at < b.at ? 1 : -1)); return { cls, n: counts && fin(counts[cls]) ? counts[cls] : rows.length, examples: rows.slice(0, keep).map((c) => ({ id: c.id, candidateId: c.candidateId, at: c.at, was: c.was ? c.was.action : null, want: wanted(c), verdict: c.verdict, reasons: c.reasons || [], text: c.text || '' })) }; })
      .filter((g) => g.n > 0).sort((a, b) => b.n - a.n || (a.cls < b.cls ? -1 : 1));
  }

  // Spaced repetition of mistakes. A mistake = a setup whose latest correction was not an approval. Every later sitting on
  // that setup (a same-trade replay, in any tab) is a review: giving the answer the mentor asked for is a pass, anything
  // else a fail. The setup is due SCHEDULE_DAYS[passes in a row] days after the last review (or after the correction when
  // it was never reviewed): 1, 3, 7, then 21 days; a fail starts again at 1 day; after four passes in a row it is retired.
  // Train pool only: a setup whose stored attempts are tests or blind answers is never queued.
  // → { due: [...], upcoming: [...], retired: n }, each row { candidateId, t, want, errorClass, reasons, text, wrongAt, lastAt, passes, reviews, dueAt, due }
  function reviewQueue(o) {
    const cors = Array.isArray(o && o.corrections) ? o.corrections : [], atts = Array.isArray(o && o.attempts) ? o.attempts : [], times = (o && o.times) || {}, now = fin(o && o.now) ? o.now : Date.now();
    const attBy = {}; for (const a of atts) (attBy[a.candidateId] = attBy[a.candidateId] || []).push(a);
    const corBy = {}; for (const c of cors) (corBy[c.candidateId] = corBy[c.candidateId] || []).push(c);
    const due = [], upcoming = []; let retired = 0;
    for (const id of Object.keys(corBy)) {
      const list = corBy[id].slice().sort((a, b) => (a.at < b.at ? -1 : 1)), last = list[list.length - 1]; if (last.verdict === 'approve') continue;   // the latest word on this setup is an approval
      const mine = (attBy[id] || []).slice().sort((a, b) => (a.at < b.at ? -1 : 1)); if (mine.some((a) => a.mode === 'exam' || a.mode === 'blind')) continue;
      const want = wanted(last), was = last.was ? last.was.action : null; let step = 0, lastAt = last.at, reviews = 0;
      for (const a of mine) { if (!(a.at > last.at) || !a.decision) continue; reviews++; lastAt = a.at; if (want ? a.decision.action === want : a.decision.action !== was) step++; else step = 0; }
      if (step >= SCHEDULE_DAYS.length) { retired++; continue; }
      const t = fin(times[id]) ? times[id] : mine.length && mine[0].decision && fin(mine[0].decision.t) ? mine[0].decision.t : null;
      const dueAt = Date.parse(lastAt) + SCHEDULE_DAYS[step] * DAY_MS, row = { candidateId: id, t, want, was, errorClass: last.errorClass || 'unclassified', reasons: last.reasons || [], text: last.text || '', wrongAt: last.at, lastAt, passes: step, reviews, dueAt, due: dueAt <= now };
      (row.due ? due : upcoming).push(row);
    }
    const byDue = (a, b) => a.dueAt - b.dueAt; return { due: due.sort(byDue), upcoming: upcoming.sort(byDue), retired };
  }
  const dueText = (row, now) => { const d = Math.ceil((row.dueAt - now) / DAY_MS); return row.due ? (d <= -1 ? `due ${plural(-d, 'day')} ago` : 'due now') : `due in ${plural(Math.max(1, d), 'day')} (${new Date(row.dueAt).toISOString().slice(0, 10)})`; };

  // ---- lessons ------------------------------------------------------------------------------------------------------
  // every version of the lessons, grouped by their first version (root), the newest version first in each group
  function lessonChains(lessons) {
    const by = {}; for (const l of Array.isArray(lessons) ? lessons : []) (by[l.root || l.id] = by[l.root || l.id] || []).push(l);
    return Object.values(by).map((vs) => vs.sort((a, b) => (b.version || 1) - (a.version || 1))).sort((a, b) => (a[0].updatedAt < b[0].updatedAt ? 1 : -1));
  }
  const whenText = (l) => ((l && l.when) || []).map(MXAC.condText).join(' AND ') || 'no condition';
  // what differs between two versions of a lesson, in words: [{ field, from, to }]
  function lessonDiff(a, b) {
    const out = [], put = (field, x, y) => { if (x !== y) out.push({ field, from: x, to: y }); }, A = a || {}, B = b || {};
    put('Title', String(A.title || ''), String(B.title || '')); put('Edge', A.edge === '*' ? 'all edges' : String(A.edge || ''), B.edge === '*' ? 'all edges' : String(B.edge || ''));
    put('When', whenText(A), whenText(B)); put('Then', MXAC.thenText(A.then), MXAC.thenText(B.then));
    put('Note', String((A.then && A.then.note) || ''), String((B.then && B.then.note) || '')); put('Explanation', String(A.text || ''), String(B.text || ''));
    return out;
  }
  const lessonOrigin = (l) => { const s = (l && l.source) || {}; return s.kind === 'research' || s.studyId ? `research study ${s.studyId || '(not named)'}` : s.correctionId || s.attemptId ? 'mentor correction' + (s.sessionId ? ' in a session' : '') : s.sessionId ? 'mentor note in a session' : 'not recorded'; };
  // a lesson's record in two parts that are never added: recall (same-trade replays) and new setups (tests)
  function lessonRecord(l) {
    const s = (l && l.stats) || {}, rn = (s.replayPass || 0) + (s.replayFail || 0), en = s.examN || 0;
    return { applied: s.applied || 0, recall: { n: rn, pass: s.replayPass || 0, fail: s.replayFail || 0 }, fresh: { n: en, agree: s.examAgree || 0, netWith: s.examNetWith || 0, netWithout: s.examNetWithout || 0, tooFew: tooFew(en) },
      recallText: rn ? `Recall on the same trade: passed ${s.replayPass || 0}, failed ${s.replayFail || 0} (n = ${rn}).` : 'Recall on the same trade: not replayed yet.',
      freshText: en ? `New setups it matched: n = ${en}, same answer as without it on ${s.examAgree || 0}; net ${fmtR(s.examNetWith || 0)} with lessons against ${fmtR(s.examNetWithout || 0)} without.` + (tooFew(en) ? ' Too few to judge.' : '') : 'New setups: it has matched none in a test yet.' };
  }
  // where a research draft stands, from the stored lessons that name its study
  function draftStatus(p, lessons) {
    const id = p && p.source && p.source.studyId, hits = (Array.isArray(lessons) ? lessons : []).filter((l) => l.source && l.source.studyId === id && id);
    if (!hits.length) return { state: 'new', text: 'Not saved. It is a proposal only.' };
    const l = hits.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    if (l.active) return { state: 'on', lesson: l, text: `Saved and switched on (version ${l.version}).` };
    if (/^dismissed/i.test(l.deactivatedWhy || '')) return { state: 'dismissed', lesson: l, text: `Dismissed on ${fmtDay(l.deactivatedAt)}. It is kept, switched off, in the list above.` };
    return { state: 'saved', lesson: l, text: `Saved as an inactive lesson on ${fmtDay(l.createdAt)}. Switch it on in the list above once you have tested it.` };
  }
  const STATUS_WORD = { 'out-of-sample': 'out-of-sample only', 'in-sample': 'in-sample only', validated: 'validated', rejected: 'rejected', inconclusive: 'inconclusive', hypothesis: 'a hypothesis' };
  // the evidence behind a research draft: both parts with n and t, and what the status means
  function evidenceText(ev) {
    if (!ev || !ev.discovery) return 'No evidence is attached to this draft.';
    const part = (name, p) => (p ? `${name} (${p.from} to ${p.to}): n ${p.nIn} at ${fmtAvgR(p.rIn)} a trade against n ${p.nOut} at ${fmtAvgR(p.rOut)}, t ${fmtNum(p.t)}.` : `${name}: not run.`);
    const st = STATUS_WORD[ev.validation] || String(ev.validation || 'unknown');
    return `${part('Discovery', ev.discovery)} ${part('Confirmation', ev.confirmation)} Status: ${st}` + (ev.fdrPass === false ? `, did not survive the correction for ${ev.testsInRun} tests (adjusted p ${fmtNum(ev.q)}).` : ev.fdrPass === true ? `, survived the correction for ${ev.testsInRun} tests.` : '.');
  }

  // ---- research, models, costs, audit ---------------------------------------------------------------------------------
  const filterStudies = (studies, f) => (Array.isArray(studies) ? studies : []).filter((s) => (!f || !f.edge || s.edge === f.edge || (f.edge === 'book' && s.edge == null)) && (!f || !f.kind || s.kind === f.kind) && (!f || !f.validation || s.validation === f.validation));
  // the policy against taking every setup, one row an edge and one for the book
  function policyRows(ev) {
    const e = ev || {}, row = (id, x) => { const d = x.diff || {}; return { edge: id, name: x.name || id, every: x.mechanical || {}, take: x.take || {}, wait: x.wait || {}, diff: fin(d.takeMinusWait) ? d.takeMinusWait : null, t: fin(d.t) ? d.t : null, verdict: x.verdict || 'n/a' }; };
    const rows = Object.keys(e.edges || {}).map((id) => row(id, e.edges[id])); if (e.overall) rows.push(row('all', Object.assign({ name: 'All seven' }, e.overall)));
    return rows;
  }
  // a generated study's table → sections a page can draw: { title, cols, rows } for a list of records, { title, pairs } for plain values
  function tableSections(table, title, depth) {
    const out = [], d = depth || 0, isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v), cell = (v) => (v == null ? 'n/a' : typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (Array.isArray(table)) {
      if (table.length && table.every(isO)) { const cols = []; for (const r of table) for (const k of Object.keys(r)) if (cols.indexOf(k) < 0) cols.push(k); out.push({ title: title || 'Rows', cols, rows: table.map((r) => cols.map((k) => cell(r[k]))) }); }
      else if (table.length) out.push({ title: title || 'Values', pairs: [[title || 'values', table.map(cell).join(', ')]] });
      return out;
    }
    if (!isO(table)) return out;
    const pairs = [];
    for (const k of Object.keys(table)) {
      const v = table[k], name = title ? `${title} · ${k}` : k;
      if (Array.isArray(v) && v.length && v.every(isO)) out.push(...tableSections(v, name, d + 1));
      else if (isO(v) && d < 2 && Object.values(v).some((x) => x && typeof x === 'object')) out.push(...tableSections(v, name, d + 1));
      else if (isO(v)) out.push({ title: name, pairs: Object.keys(v).map((kk) => [kk, cell(v[kk])]) });
      else pairs.push([k, Array.isArray(v) ? v.map(cell).join(', ') : cell(v)]);
    }
    if (pairs.length) out.unshift({ title: title || 'Summary', pairs });
    return out;
  }
  // why a notebook note cannot be saved yet (the API enforces the same)
  function noteProblems(n) {
    const out = [], x = n || {}; for (const [k, label] of [['title', 'a title'], ['hypothesis', 'the hypothesis'], ['dataset', 'the dataset'], ['method', 'the method']]) if (!String(x[k] || '').trim()) out.push(`Give ${label}.`);
    if (!x.validation) out.push('Choose where the result stands.');
    if (x.sampleSize != null && x.sampleSize !== '' && !(Number.isInteger(+x.sampleSize) && +x.sampleSize >= 0)) out.push('The sample size must be a whole number.');
    if ((x.validation === 'out-of-sample' || x.validation === 'validated') && !(+x.sampleSize > 0)) out.push('An out-of-sample or validated result needs its sample size (never an edge without n).');
    return out;
  }
  // one line a scorer of the training report: what it was fitted on, how it did out of fold, and the verdict
  function modelRows(training) {
    return ((training && training.models) || []).map((m) => { const g = (m.outOfFold && m.outOfFold.gbt) || {}, tr = g.trading || {}, ex = (m.exam && m.exam.gbt) || {}, et = ex.trading || {};
      return { id: m.id, scope: m.scope || m.edge, rows: m.trainRows, from: m.from, to: m.to, baseWin: m.winRate, baseR: m.netRPerTrade, n: g.n, auc: g.auc, brierSkill: g.brierSkill, kept: tr.kept || {}, skipped: tr.skipped || {}, mechanical: tr.mechanical || {}, t: fin(tr.keptMinusSkippedT) ? tr.keptMinusSkippedT : null,
        verdict: m.verdict || 'n/a', status: m.status || 'n/a', promoted: m.promoted === true, calibrated: m.calibrated === true, beats: m.beatsBaseline === true, features: m.features,
        exam: m.exam ? { n: ex.n, auc: ex.auc, kept: et.kept || {}, mechanical: et.mechanical || {}, from: m.exam.from, to: m.exam.to, limit: m.exam.limit || '', what: m.exam.what || '' } : null }; });
  }
  // the language-model adapter in words
  function costView(c) {
    const x = c || {}, b = x.budgets || {}, tot = x.total || {}, today = x.today || {}, month = x.month || {}, spent = fin(tot.usd) ? tot.usd : 0;
    const noKey = !x.enabled && /no language-model key/.test(String(x.reason || ''));
    const head = x.enabled ? (b.stop ? 'On, but stopped by the kill switch: no call is made.' : 'On.') + ` Spent: ${fmtUsd(spent)}.` : noKey ? `Off. No key is set. Spent: ${fmtUsd(spent)}` : `Off: ${x.reason || 'not configured'}. Spent: ${fmtUsd(spent)}`;
    const ledger = Object.keys(x.days || {}).sort().reverse().map((d) => Object.assign({ day: d }, x.days[d]));
    return { enabled: !!x.enabled, head, spent, today: { usd: today.usd || 0, budget: b.dailyUsd, requests: today.requests || 0 }, month: { usd: month.usd || 0, budget: b.monthlyUsd, requests: month.requests || 0 }, total: { usd: spent, budget: b.hardUsd, requests: tot.requests || 0, cacheHits: tot.cacheHits || 0, skipped: tot.skipped || 0, errors: tot.errors || 0 }, ledger };
  }
  const auditActions = (rows) => Array.from(new Set((Array.isArray(rows) ? rows : []).map((r) => r.action).filter(Boolean))).sort();
  const filterAudit = (rows, action) => (Array.isArray(rows) ? rows : []).filter((r) => !action || r.action === action);
  // the last n months, newest first, as YYYY-MM
  function monthList(now, n) { const d = new Date(now), out = []; for (let i = 0; i < (n || 12); i++) out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7)); return out; }

  // ---- blind arena and sessions ----------------------------------------------------------------------------------------
  // R of a short answer on a setup whose outcome is known, as the API grades it: WAIT = 0, the setup's own side = its net R,
  // the other side = not graded (the outcome file only covers the setup's own trade)
  function gradeLite(dec, side, out) {
    if (!dec || !out) return null; if (dec.action === 'WAIT') return 0;
    if ((dec.action === 'BUY' && side === 'buy') || (dec.action === 'SELL' && side === 'sell')) { const r = fin(out.netR) ? out.netR : out.R; return fin(r) ? r : null; }
    return null;
  }
  const closer = (rMentor, rEngine) => (!fin(rMentor) || !fin(rEngine) ? null : rMentor > rEngine ? 'mentor' : rEngine > rMentor ? 'engine' : 'tie');
  const CLOSER_WORD = { mentor: 'You were closer to the outcome.', engine: 'The engine was closer to the outcome.', tie: 'A tie: both answers were worth the same.' };
  // the running mentor-against-engine table (rows of GET ?get=blind)
  function blindTable(rows) {
    const s = { n: 0, withEngine: 0, agree: 0, graded: 0, mentorR: 0, engineR: 0, mentorCloser: 0, engineCloser: 0, ties: 0, tooFew: true };
    for (const r of Array.isArray(rows) ? rows : []) {
      s.n++; if (r.engine) { s.withEngine++; if (r.engine.action === r.mentor.action) s.agree++; }
      const c = closer(r.rMentor, r.rEngine); if (!c) continue; s.graded++; s.mentorR += r.rMentor; s.engineR += r.rEngine; if (c === 'mentor') s.mentorCloser++; else if (c === 'engine') s.engineCloser++; else s.ties++;
    }
    s.mentorR = r3(s.mentorR); s.engineR = r3(s.engineR); s.tooFew = tooFew(s.graded); return s;
  }
  // a session's running summary from its events: { kind: 'decision', action, verdict } | 'missed' | 'right-wait' | 'lesson' | 'draft'
  function sessionSummary(events) {
    const s = { decisions: 0, takes: 0, waits: 0, judged: 0, agreed: 0, disagreed: 0, noVerdict: 0, missed: 0, rightWait: 0, lessons: 0, drafts: 0 };
    for (const e of Array.isArray(events) ? events : []) {
      if (e.kind === 'decision') { s.decisions++; if (isTake(e.action)) s.takes++; else s.waits++; if (!e.verdict) s.noVerdict++; else { s.judged++; if (e.verdict === 'approve') s.agreed++; else s.disagreed++; } }
      else if (e.kind === 'missed') s.missed++; else if (e.kind === 'right-wait') s.rightWait++; else if (e.kind === 'lesson') s.lessons++; else if (e.kind === 'draft') s.drafts++;
    }
    s.tooFew = tooFew(s.judged);
    s.text = `${plural(s.decisions, 'decision')} (${s.takes} taken, ${s.waits} waited) · you agreed with ${rateText(s.agreed, s.judged)}` + (s.noVerdict ? `, ${s.noVerdict} left without a verdict` : '') + ` · ${plural(s.missed, 'missed opportunity', 'missed opportunities')} · ${plural(s.rightWait, 'right wait')} · ${plural(s.lessons, 'lesson')} saved` + (s.drafts ? `, ${plural(s.drafts, 'draft')}` : '');
    return s;
  }
  // why a trade answer cannot be sent yet (plain sentences), or []
  function answerProblems(a, needText) {
    const x = a || {}, out = []; if (!x.action) return ['Choose an answer.'];
    if (isTake(x.action)) {
      const dir = x.action === 'BUY' ? 1 : -1;
      if (!fin(x.entry) || !fin(x.stop)) out.push(`A ${x.action} needs an entry and a stop (every trade has a stop).`);
      else { if ((x.stop - x.entry) * dir >= 0) out.push(`The stop must be ${dir > 0 ? 'below' : 'above'} the entry for a ${x.action}.`); if (fin(x.target) && (x.target - x.entry) * dir <= 0) out.push(`The target must be ${dir > 0 ? 'above' : 'below'} the entry for a ${x.action}.`); }
    }
    if (needText && !String(x.text || '').trim()) out.push('Say why in a line.');
    return out;
  }

  const MXAT = { VERSION: '1.0.0', MIN_N, SCHEDULE_DAYS, weekOf, wanted, agreementByWeek, recallVsNew, mistakeGroups, reviewQueue, dueText, lessonChains, lessonDiff, lessonOrigin, lessonRecord, draftStatus, evidenceText, filterStudies, policyRows, tableSections, noteProblems,
    modelRows, costView, auditActions, filterAudit, monthList, gradeLite, closer, blindTable, sessionSummary, answerProblems, rateText, fewText, fmtUsd, fmtStamp, fmtAvgR, tooFew, CLASS_WORD, MODE_WORD };
  if (NODE) { module.exports = MXAT; return; }
  root.MXAT = MXAT;
  if (typeof document === 'undefined' || typeof MXAC.registerTab !== 'function' || !MXAC.kit) return;

  // ---- shared page pieces ----------------------------------------------------------------------------------------------
  const K = MXAC.kit, el = K.el, clear = K.clear, listOr = K.listOr, actBadge = K.actBadge, api = MXAC.api;
  const $ = (id) => document.getElementById(id);
  const card = (title, small, id) => el('div', { class: 'card', id: id || null }, el('h2', { class: 'c-h' }, title, small ? el('small', { text: small }) : null));
  const empty = (text, extra) => el('div', { class: 'ac-empty' }, el('p', { text }), extra || null);
  const errBox = (what, e) => el('p', { class: 'ac-err', text: `${what} could not be read: ${(e && e.message) || e}.` });
  const tag = (text, kind) => el('span', { class: 'tag' + (kind ? ' ' + kind : ''), text });
  const kv = (pairs) => { const dl = el('dl', { class: 'kv' }); for (const [k, v] of pairs) { if (v == null || v === '') continue; dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', {}, v)); } return dl; };
  function table(heads, rows, id) {
    const tb = el('tbody', {}); for (const r of rows) tb.appendChild(Array.isArray(r) ? el('tr', {}, r.map((c) => (c && c.nodeType ? (c.tagName === 'TD' ? c : el('td', {}, c)) : el('td', { text: c == null ? 'n/a' : String(c) })))) : r);
    return el('div', { class: 'tbl' }, el('table', { id: id || null }, el('thead', {}, el('tr', {}, heads.map((h) => el('th', { text: h })))), tb));
  }
  const num = (text) => el('td', { class: 'num', text: text == null ? 'n/a' : String(text) });
  function statGrid(cells, id) { const dl = el('dl', { class: 'stats', id: id || null }); for (const [k, v, sub, cid] of cells) dl.appendChild(el('div', {}, el('dt', { text: k }), el('dd', { id: cid || null }, String(v), sub ? el('small', { text: sub }) : null))); return dl; }
  // run an async action from a button: the button waits, a status line says what happened, an error is shown in words
  async function act(btn, msg, fn, okText) {
    if (btn.disabled) return; btn.disabled = true; if (msg) msg.textContent = 'Saving…';
    try { const r = await fn(); if (msg) msg.textContent = typeof okText === 'function' ? okText(r) : okText || ''; return r; }
    catch (e) { if (msg) msg.textContent = 'Not saved: ' + ((e && e.message) || e) + '.'; return null; }
    finally { btn.disabled = false; }
  }
  // The edge a section shows. It follows the Train tab's edge until changed here; one choice is shared by all sections.
  let EDGE = null;
  const edgeOf = (ctx) => (EDGE && ctx.edges().some((e) => e.id === EDGE) ? EDGE : (EDGE = ctx.edge() || (ctx.edges()[0] || {}).id || null));
  const edgeDef = (ctx, id) => ctx.edges().find((e) => e.id === id) || null;
  // own = { get, set }: a section with a sitting in progress (blind, session) keeps its own edge
  function edgeBar(ctx, idp, onChange, note, own) {
    const cur = own ? own.get() : edgeOf(ctx);
    const sel = el('select', { id: idp + '-edge', onchange: (e) => { if (own) own.set(e.target.value); else EDGE = e.target.value; onChange(); } }, ctx.edges().map((e) => el('option', { value: e.id, text: `${e.name} · ${e.marketLabel || e.market}`, selected: e.id === cur })));
    return el('div', { class: 'tb-bar' }, el('label', { class: 'f' }, el('span', { text: 'Edge' }), sel), note ? el('p', { class: 'note', text: note }) : null);
  }
  // a section draws into `sec` after its reads; a newer draw (another edge, another visit) wins over an older one still loading
  const TOKENS = {};
  const fresh = (id) => { const t = (TOKENS[id] = (TOKENS[id] || 0) + 1); return () => TOKENS[id] === t; };
  const loading = (sec, text) => { clear(sec).appendChild(el('p', { class: 'ac-wait', role: 'status', text: text || 'Reading…' })); };

  // ==== sections ========================================================================================================
  // ---- Lessons ---------------------------------------------------------------------------------------------------------
  const diffLi = (x) => el('li', {}, el('b', { text: x.field + ': ' }), el('span', { class: 'was', text: x.from || 'empty' }), ' → ', el('span', { class: 'now', text: x.to || 'empty' }));
  let closeEditor = null;      // one lesson is revised at a time
  function lessonItem(vs, ctx, redraw) {
    const l = vs[0], rec = lessonRecord(l), li = el('li', { class: 'lsn', 'data-lesson': l.id, 'data-active': l.active ? 'yes' : 'no', 'data-version': l.version }), msg = el('span', { class: 'ac-status', role: 'status' }), ed = el('div', { class: 'lsn-edit', hidden: true });
    const dismissed = !l.active && /^dismissed/i.test(l.deactivatedWhy || '');
    li.appendChild(el('div', { class: 'lsn-head' }, el('b', { text: l.title }), tag('version ' + l.version), l.active ? tag('in force', 'ok') : tag(dismissed ? 'dismissed draft, switched off' : 'switched off', 'off'), tag(l.edge === '*' ? 'all edges' : l.edge)));
    li.appendChild(el('p', { class: 'plain', text: MXAC.lessonText(l) }));
    if (l.text) li.appendChild(el('p', { text: l.text }));
    li.appendChild(kv([['From', lessonOrigin(l)], ['Saved', fmtStamp(l.createdAt)], ['Applied', `${plural(rec.applied, 'time')} in same-trade replays`], ['Recall', rec.recallText], ['New setups', rec.freshText],
      l.supersedes ? ['Replaces', `version ${l.version - 1}, kept below`] : null, !l.active && l.deactivatedAt ? ['Switched off', fmtStamp(l.deactivatedAt) + (l.deactivatedWhy ? ': ' + l.deactivatedWhy : '')] : null].filter(Boolean)));
    function openEditor() {
      if (closeEditor) closeEditor(); clear(ed); ed.hidden = false; closeEditor = () => { ed.hidden = true; clear(ed); closeEditor = null; };
      const draft = JSON.parse(JSON.stringify({ id: l.id, version: l.version, edge: l.edge, title: l.title, text: l.text || '', when: l.when || [], then: { action: (l.then && l.then.action) || null, adjust: (l.then && l.then.adjust) || {}, note: (l.then && l.then.note) || '' } }));
      ed.appendChild(el('h3', {}, 'Revise', el('small', { text: `saving makes version ${l.version + 1}; version ${l.version} is kept, switched off` })));
      const diffBox = el('ul', { class: 'diff', id: 'lr-diff' }), m2 = el('span', { class: 'ac-status', id: 'lr-msg', role: 'status' });
      const save = el('button', { type: 'button', class: 'btn primary', id: 'lr-save', text: 'Save as a new version', disabled: true, onclick: (ev) => act(ev.currentTarget, m2, async () => {
        await api.post({ action: 'lesson.revise', id: l.id, patch: { title: String(draft.title).trim(), text: draft.text || '', when: draft.when, then: { action: draft.then.action || null, adjust: draft.then.adjust || {}, note: draft.then.note || '' }, active: !!l.active } });
        K.lessonsChanged(); closeEditor = null; await redraw();
      }) });
      const drawDiff = (errs) => { const d = lessonDiff(l, draft); listOr(diffBox, d, 'Nothing is changed yet.', diffLi); save.disabled = !d.length || !!(errs && errs.length); };
      const form = K.lessonForm(ed, draft, { idp: 'lr', onChange: drawDiff });
      ed.appendChild(el('h3', { text: 'What changes' })); ed.appendChild(diffBox);
      ed.appendChild(el('p', { class: 'note', text: 'A new version starts its own record at zero. The old version keeps its counts and stays in the list, switched off.' }));
      ed.appendChild(el('div', { class: 'f-actions' }, save, el('button', { type: 'button', class: 'btn', id: 'lr-cancel', text: 'Cancel', onclick: () => closeEditor && closeEditor() }), m2));
      $('lr-note').addEventListener('input', () => drawDiff(form.problems()));
      form.refresh();
    }
    const flip = (on) => (ev) => act(ev.currentTarget, msg, async () => { await api.post({ action: 'lesson.deactivate', id: l.id, active: on, reason: on ? '' : 'Switched off by the mentor' }); K.lessonsChanged(); await redraw(); });
    li.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', 'data-act': 'revise', text: 'Revise', onclick: openEditor }),
      l.active ? el('button', { type: 'button', class: 'btn', 'data-act': 'off', text: 'Switch off', onclick: flip(false) }) : el('button', { type: 'button', class: 'btn', 'data-act': 'on', text: 'Switch on', onclick: flip(true) }), msg));
    li.appendChild(ed);
    if (vs.length > 1) {
      const det = el('details', { class: 'more', 'data-versions': vs.length - 1 }, el('summary', { text: `Earlier versions (${vs.length - 1}) and what changed` }));
      for (let i = 0; i < vs.length - 1; i++) {
        const newer = vs[i], older = vs[i + 1];
        det.appendChild(el('p', {}, el('b', { text: `Version ${older.version} → version ${newer.version}` }), ` on ${fmtStamp(newer.createdAt)}`));
        det.appendChild(listOr(el('ul', { class: 'diff' }), lessonDiff(older, newer), 'No field differs.', diffLi));
        det.appendChild(el('p', { class: 'note', text: `Version ${older.version} read: ${MXAC.lessonText(older)}. ${lessonRecord(older).recallText} ${lessonRecord(older).freshText}` }));
      }
      li.appendChild(det);
    }
    return li;
  }
  function draftsCard(research, lessons, ctx, redraw, e) {
    const box = card('Draft lessons from research', 'proposals only: nothing here is in force until you save it and switch it on', 'ls-drafts-card');
    if (!research || research.available === false) { box.appendChild(empty('The research file is not on this server, so there is no draft to show. Drafts appear once the research step has been run and shipped (node academy/gen/research.mjs).')); return box; }
    const ps = research.proposedLessons || [];
    if (!ps.length) { box.appendChild(empty(`No draft for ${e ? e.name : 'this edge'}. A draft is offered only when a pre-registered condition of the edge held up in both parts of its study; none did here. Other edges may have one: change the edge above.`)); return box; }
    const ul = el('ul', { class: 'lsn-list', id: 'ls-drafts' });
    for (const p of ps) {
      const st = draftStatus(p, lessons), li = el('li', { class: 'lsn', 'data-draft': p.id, 'data-state': st.state }), msg = el('span', { class: 'ac-status', role: 'status' });
      const body = () => ({ edge: p.edge, title: p.title, text: p.text || '', when: p.when, then: { action: (p.then && p.then.action) || null, adjust: (p.then && p.then.adjust) || {}, note: (p.then && p.then.note) || '' }, source: { kind: 'research', studyId: p.source && p.source.studyId }, active: false });
      li.appendChild(el('div', { class: 'lsn-head' }, el('b', { text: p.title }), tag('draft, not in force', 'off'), tag(p.edge === '*' ? 'all edges' : p.edge)));
      li.appendChild(el('p', { class: 'plain', text: MXAC.lessonText(p) }));
      li.appendChild(el('p', { 'data-evidence': '1', text: evidenceText(p.evidence) }));
      li.appendChild(el('p', { class: 'note', text: 'One sample on train data and one cut in time. The exam pool has not seen it. It may not be called an edge.' }));
      li.appendChild(el('p', { class: 'honest', 'data-status': '1', text: st.text }));
      const btns = el('div', { class: 'f-actions' });
      if (st.state === 'new') {
        btns.appendChild(el('button', { type: 'button', class: 'btn primary', 'data-act': 'draft-save', text: 'Save as an inactive draft', onclick: (ev) => act(ev.currentTarget, msg, async () => { await api.post({ action: 'lesson.save', lesson: body() }); await redraw(); }) }));
        btns.appendChild(el('button', { type: 'button', class: 'btn', 'data-act': 'draft-dismiss', text: 'Dismiss', onclick: (ev) => act(ev.currentTarget, msg, async () => { const r = await api.post({ action: 'lesson.save', lesson: body() }); await api.post({ action: 'lesson.deactivate', id: r.lesson.id, active: false, reason: 'Dismissed research draft' }); await redraw(); }) }));
      }
      if (p.source && p.source.studyId) btns.appendChild(el('button', { type: 'button', class: 'btn', 'data-act': 'draft-study', text: 'Open its study', onclick: () => { RS.open = p.source.studyId; ctx.go('research'); } }));
      btns.appendChild(msg); li.appendChild(btns); ul.appendChild(li);
    }
    box.appendChild(ul); return box;
  }
  async function lessonsTab(sec, ctx) {
    const live = fresh('lessons'), edge = edgeOf(ctx), e = edgeDef(ctx, edge), redraw = () => lessonsTab(sec, ctx); closeEditor = null; loading(sec, 'Reading the lessons…');
    let lessons, research;
    // the drafts come with any research read; kind=baseline keeps that answer small (one study an edge)
    try { [lessons, research] = await Promise.all([api.get({ get: 'lessons', edge }), api.get({ get: 'research', edge, kind: 'baseline' }).catch(() => null)]); }
    catch (err) { if (live()) { clear(sec).appendChild(edgeBar(ctx, 'ls', redraw)); sec.appendChild(errBox('The lessons', err)); } return; }
    if (!live()) return;
    const all = lessons.lessons || [], chains = lessonChains(all);
    clear(sec).appendChild(edgeBar(ctx, 'ls', redraw, 'Lessons of this edge and the lessons that hold for every edge, newest first. Every version is kept.'));
    const box = card('Lessons', `${e ? e.name : edge} and all edges · ${plural(chains.length, 'lesson')}, ${all.filter((l) => l.active).length} in force`, 'ls-card');
    if (!chains.length) box.appendChild(empty('No lesson yet. A lesson appears here when you correct a decision in the Train tab and save the draft, or when you save a research draft below.', el('button', { type: 'button', class: 'btn', text: 'Go to Train', onclick: () => ctx.go('train') })));
    else { const ul = el('ul', { class: 'lsn-list', id: 'ls-list' }); for (const vs of chains) ul.appendChild(lessonItem(vs, ctx, redraw)); box.appendChild(ul); }
    sec.appendChild(box); sec.appendChild(draftsCard(research, all, ctx, redraw, e));
  }
  MXAC.registerTab('lessons', { title: 'Lessons', render: lessonsTab });

  // ---- Progress and mistakes -----------------------------------------------------------------------------------------------
  async function progressTab(sec, ctx) {
    const live = fresh('progress'), edge = edgeOf(ctx), e = edgeDef(ctx, edge), redraw = () => progressTab(sec, ctx); loading(sec, 'Reading the record…');
    let P, Mk, X, A, C, pool;
    try {
      [P, Mk, X, A, C] = await Promise.all([api.get({ get: 'progress', edge }), api.get({ get: 'mistakes', edge }), api.get({ get: 'exams', edge }), api.get({ get: 'attempts', edge, limit: 2000 }), api.get({ get: 'corrections', edge, limit: 2000 })]);
      pool = await K.poolFor(edge, 'train').catch(() => null);
    } catch (err) { if (live()) { clear(sec).appendChild(edgeBar(ctx, 'pg', redraw)); sec.appendChild(errBox('The record', err)); } return; }
    if (!live()) return;
    const cors = C.corrections || [], atts = A.attempts || [], times = {}; for (const c of (pool && pool.candidates) || []) times[c.id] = c.t;
    for (const a of atts) if (!fin(times[a.candidateId]) && a.decision && fin(a.decision.t)) times[a.candidateId] = a.decision.t;
    const open = (id) => el('button', { type: 'button', class: 'btn sm', 'data-open': id, text: 'Replay this setup', disabled: !fin(times[id]), title: fin(times[id]) ? 'Opens the Train tab on this setup' : 'This setup is not in the list this server can replay', onclick: () => K.openInTrain(edge, times[id]) });
    clear(sec).appendChild(edgeBar(ctx, 'pg', redraw, 'Everything on this page is read from what the Train, Blind and Session tabs stored for this edge.'));
    const cn = P.counts || {}, bm = P.byMode || {}, vd = P.verdicts || {};

    const c1 = card('Where things stand', e ? e.name : edge, 'pg-counts');
    if (!cn.attempts) c1.appendChild(empty('Nothing is stored for this edge yet. Run a replay in the Train tab: each decision is stored as an attempt, and your corrections fill this page.', el('button', { type: 'button', class: 'btn', text: 'Go to Train', onclick: () => ctx.go('train') })));
    c1.appendChild(statGrid([['Attempts', cn.attempts || 0, `${bm.train || 0} train · ${bm['replay-same'] || 0} same-trade replays · ${bm.exam || 0} tests · ${bm.blind || 0} blind`, 'pg-n-attempts'], ['Corrections', cn.corrections || 0, `${vd.approve || 0} approved · ${vd.reject || 0} rejected · ${vd.change || 0} changed`, 'pg-n-corrections'],
      ['Lessons', cn.lessons || 0, `${cn.lessonsActive || 0} in force`, 'pg-n-lessons'], ['Setups seen', cn.seen || 0, 'decided at least once'], ['Tests on new setups', cn.exams || 0, 'unseen exam-pool setups', 'pg-n-exams']]));
    sec.appendChild(c1);

    const ag = agreementByWeek(cors), c2 = card('Agreement with the mentor over time', 'the share of your verdicts that were approvals', 'pg-agree');
    if (!ag.n) c2.appendChild(empty('No verdict yet. Approve or correct a decision in the Train tab and the weeks appear here.'));
    else {
      c2.appendChild(el('p', { id: 'pg-agree-all', text: `Overall you approved ${rateText(ag.approve, ag.n)} of the decisions you judged (n = ${ag.n}).` }));
      c2.appendChild(table(['Week', 'Judged (n)', 'Approved', 'Agreement'], ag.weeks.map((w) => [w.week, num(w.n), num(w.approve), el('td', {}, w.tooFew ? `too few to judge (n = ${w.n})` : el('span', { class: 'meter' }, el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: `width:${Math.round(w.rate * 100)}%` })), fmtPct(w.rate)))]), 'pg-agree-table'));
      c2.appendChild(el('p', { class: 'note', text: 'Agreement says how often you and the engine gave the same answer. It does not say who was right: results on new setups do.' + (C.corrections && cors.length >= 2000 ? ' Only the latest 2,000 corrections are counted here.' : '') }));
    }
    sec.appendChild(c2);

    const rv = recallVsNew(P), c3 = card('Recall against new setups', 'two separate records, side by side', 'pg-rvn');
    const tests = (X.exams || []).slice(0, 5);
    c3.appendChild(el('div', { class: 'two' },
      el('div', { class: 'well', id: 'pg-recall' }, el('h3', { text: 'Same-trade replays (recall)' }), statGrid([['Replays', rv.recall.n, 'stored'], ['Graded', rv.recall.graded, 'had an earlier correction'], ['Passed', rateText(rv.recall.pass, rv.recall.graded)]]),
        el('p', { class: 'note', text: 'A pass means the engine gave the answer you had asked for on a trade it had already been corrected on. That is recall, never generalisation.' })),
      el('div', { class: 'well', id: 'pg-fresh' }, el('h3', { text: 'New setups (tests)' }), statGrid([['Tested', rv.fresh.n, 'unseen setups'], ['Net R with lessons', fmtR(rv.fresh.netWith), `n = ${rv.fresh.graded} graded`], ['Net R without', fmtR(rv.fresh.netWithout), `n = ${rv.fresh.graded} graded`], ['Same answer', `${rv.fresh.agree} of ${rv.fresh.n}`, 'with and without lessons']]),
        el('p', { class: 'note', text: (rv.fresh.n ? (rv.fresh.tooFew ? fewText(rv.fresh.graded, 'graded setup') + ' ' : '') : 'No test yet: use "Test on new setups" in the Train tab. ') + 'A WAIT counts as 0R.' }))));
    c3.appendChild(el('p', { class: 'honest', text: 'These two records are never added together. Only new setups say whether a lesson generalises.' }));
    if (tests.length) c3.appendChild(el('details', { class: 'more' }, el('summary', { text: `Latest tests (${tests.length} of ${(X.exams || []).length})` }), table(['Setup time (UTC)', 'Side', 'Without lessons', 'With lessons', 'R without', 'R with'], tests.map((r) => [num(fmtTime(r.t)), r.side || 'n/a', actBadge(r.withoutLessons.action, true), actBadge(r.withLessons.action, true), num(fin(r.rWithout) ? fmtR(r.rWithout) : 'not graded'), num(fin(r.rWith) ? fmtR(r.rWith) : 'not graded')]))));
    sec.appendChild(c3);

    const groups = mistakeGroups(cors, Mk.byClass), c4 = card('Mistakes by class', `${plural(groups.reduce((s, g) => s + g.n, 0), 'decision')} you rejected or changed`, 'pg-mistakes');
    if (!groups.length) c4.appendChild(empty('No mistake recorded: every decision you judged was approved, or none was judged yet. A rejected or changed decision is classed and listed here.'));
    for (const g of groups) {
      c4.appendChild(el('h3', {}, CLASS_WORD(g.cls), el('small', { text: `n = ${g.n}` })));
      c4.appendChild(listOr(el('ul', { class: 'plain-list small', 'data-class': g.cls }), g.examples, 'Its examples are older than the latest corrections read here.', (x) => el('li', {}, el('div', {}, el('b', { text: fin(times[x.candidateId]) ? fmtTime(times[x.candidateId]) + ' setup' : 'setup' }), `: the engine said ${x.was || 'n/a'}, you ${x.verdict === 'reject' && !x.want ? 'rejected it' : 'asked for ' + (x.want || 'another answer')}` + (x.reasons.length ? ` (${x.reasons.join(', ')})` : '') + '. ', x.text ? el('small', { text: x.text.slice(0, 160) }) : null, el('small', { text: ' · judged ' + fmtStamp(x.at) })), open(x.candidateId))));
    }
    const reasons = Object.keys(Mk.byReason || {}).sort((a, b) => Mk.byReason[b] - Mk.byReason[a]);
    if (reasons.length) c4.appendChild(el('p', { class: 'note', id: 'pg-reasons', text: 'Reasons you gave: ' + reasons.map((r) => `${r} ${Mk.byReason[r]}`).join(' · ') + '.' }));
    sec.appendChild(c4);

    const now = Date.now(), q = reviewQueue({ corrections: cors, attempts: atts, times, now }), c5 = card('Due again', 'spaced repetition of mistakes, train pool only', 'pg-queue');
    c5.appendChild(el('p', { text: `A setup you rejected or changed comes back ${SCHEDULE_DAYS.slice(0, -1).join(', ')} and ${SCHEDULE_DAYS[SCHEDULE_DAYS.length - 1]} days after its last review. Each replay that gives your answer moves it one step on; a wrong answer starts it again at ${SCHEDULE_DAYS[0]} day. After ${SCHEDULE_DAYS.length} passes in a row it is retired.` }));
    const qRow = (r) => el('li', { 'data-cand': r.candidateId, 'data-due': r.due ? 'yes' : 'no' }, el('div', {}, el('b', { text: fin(r.t) ? fmtTime(r.t) + ' setup' : 'setup' }), `: you asked for ${r.want || 'another answer'} (the engine said ${r.was || 'n/a'}) · ${CLASS_WORD(r.errorClass)} · ${plural(r.passes, 'pass', 'passes')} in a row · `, el('b', { text: dueText(r, now) })), open(r.candidateId));
    if (!q.due.length && !q.upcoming.length) c5.appendChild(empty(q.retired ? `Nothing is queued: ${plural(q.retired, 'mistake')} retired after ${SCHEDULE_DAYS.length} passes in a row.` : 'Nothing is queued. A setup joins this list when you reject or change a decision in the Train tab.'));
    else {
      c5.appendChild(el('h3', {}, 'Due now', el('small', { text: `n = ${q.due.length}` }))); c5.appendChild(listOr(el('ul', { class: 'plain-list small', id: 'pg-due' }), q.due, 'Nothing is due today.', qRow));
      c5.appendChild(el('h3', {}, 'Coming up', el('small', { text: `n = ${q.upcoming.length}` }))); c5.appendChild(listOr(el('ul', { class: 'plain-list small', id: 'pg-upcoming' }), q.upcoming, 'Nothing is waiting.', qRow));
      c5.appendChild(el('p', { class: 'note', text: 'A replay from here is stored as a same-trade replay: it shows recall, not generalisation. Replaying early is allowed and counts as a review.' + (q.retired ? ` ${plural(q.retired, 'mistake')} retired.` : '') }));
    }
    sec.appendChild(c5);

    const last = atts.slice(-15).reverse(), c6 = card('Latest attempts', `${last.length} of ${cn.attempts || atts.length}`, 'pg-attempts');
    if (!last.length) c6.appendChild(empty('No attempt is stored yet.'));
    else c6.appendChild(table(['Stored (UTC)', 'Setup time (UTC)', 'Kind', 'Answer', 'Confidence', 'Lessons matched'], last.map((a) => { const d = a.decision; return [num(fmtStamp(a.at).replace(' UTC', '')), num(fin(times[a.candidateId]) ? fmtTime(times[a.candidateId]).replace(' UTC', '') : 'n/a'), MODE_WORD[a.mode] || a.mode, d ? actBadge(d.action, true) : 'hidden until you answer', d ? d.confidence || 'n/a' : 'hidden', num(d ? (d.lessonsApplied || []).length : 'hidden')]; }), 'pg-attempts-table'));
    sec.appendChild(c6);
  }
  MXAC.registerTab('progress', { title: 'Progress', render: progressTab });

  // ---- Research lab and notebook ---------------------------------------------------------------------------------------------
  const RS = { open: null, edge: '', kind: '', validation: '', research: null, evaluation: null };   // the generated files are shipped with the build: read once
  const VALIDATION = [['hypothesis', 'a hypothesis'], ['in-sample', 'in-sample only'], ['out-of-sample', 'out-of-sample only'], ['validated', 'validated'], ['rejected', 'rejected'], ['inconclusive', 'inconclusive']];
  const standWord = (v) => (VALIDATION.find((x) => x[0] === v) || [v, v || 'n/a'])[1];
  const standTag = (v) => tag(standWord(v), v === 'validated' ? 'ok' : v === 'rejected' ? 'bad' : 'off');
  const sectionNode = (s) => el('div', {}, el('h3', { text: s.title }), s.pairs ? kv(s.pairs.map(([k, v]) => [k, String(v)])) : table(s.cols, s.rows.slice(0, 200).map((r) => r.map((c) => num(c)))));
  async function openStudy(id, ctx) {
    const box = $('rs-detail'); if (!box) return; box.hidden = false; clear(box).appendChild(el('p', { class: 'ac-wait', role: 'status', text: 'Reading the study…' }));
    try {
      const s = (await api.get({ get: 'research', id })).study, e = s.edge ? edgeDef(ctx, s.edge) : null; clear(box); box.dataset.study = s.id;
      box.appendChild(el('h2', { class: 'c-h' }, s.title, el('small', { text: `${s.kind} study · ${e ? e.name : 'the whole book'}` })));
      box.appendChild(el('div', { class: 'lsn-head' }, standTag(s.validation), tag(`n = ${fin(s.sampleSize) ? s.sampleSize : 'n/a'}`), (s.tags || []).map((t) => tag(t))));
      box.appendChild(kv([['Hypothesis', s.hypothesis], ['Dataset', s.dataset], ['Method', s.method], ['Results', s.results], ['Limits', s.limitations], ['To reproduce', s.reproducibility]]));
      const secs = tableSections(s.table); if (secs.length) { const wrap = el('div', { id: 'rs-detail-table' }); secs.forEach((x) => wrap.appendChild(sectionNode(x))); box.appendChild(wrap); }
      box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', text: 'Close the study', onclick: () => { box.hidden = true; clear(box); } })));
      box.scrollIntoView({ block: 'nearest' });
    } catch (err) { clear(box).appendChild(errBox('The study', err)); }
  }
  function notebookCard(N, ctx, redraw) {
    const box = card('Notebook', 'your own research notes', 'rs-notebook'), notes = N.notes || [];
    box.appendChild(listOr(el('ul', { class: 'lsn-list', id: 'nb-list' }), notes, 'No note yet. Write down a hypothesis below before you test it: a note records what you expected, on what data, and where the result stands.', (n) => el('li', { class: 'lsn', 'data-note': n.id },
      el('div', { class: 'lsn-head' }, el('b', { text: n.title }), standTag(n.validation), tag(fin(n.sampleSize) ? `n = ${n.sampleSize}` : 'no sample size'), n.edge ? tag(n.edge === '*' ? 'all edges' : n.edge) : null, (n.tags || []).map((t) => tag(t))),
      kv([['Hypothesis', n.hypothesis], ['Dataset', n.dataset], ['Method', n.method], ['Results', n.results], ['Limits', n.limitations], ['To reproduce', n.reproducibility], ['Written', fmtStamp(n.at)]]))));
    const F = { validation: 'hypothesis' }, err = el('p', { class: 'ac-err', id: 'nb-err', role: 'alert', hidden: true }), msg = el('span', { class: 'ac-status', id: 'nb-msg', role: 'status' });
    const inp = (k, label, o) => el('label', { class: 'f' + (o && o.wide ? ' f-all' : '') }, el('span', {}, label, o && o.hint ? el('small', { text: ' ' + o.hint }) : null), o && o.area ? el('textarea', { id: 'nb-' + k, maxlength: String((o && o.max) || 4000), oninput: (e) => { F[k] = e.target.value; } }) : el('input', { type: (o && o.type) || 'text', id: 'nb-' + k, min: o && o.type === 'number' ? '0' : null, step: o && o.type === 'number' ? '1' : null, inputmode: o && o.type === 'number' ? 'numeric' : null, maxlength: o && o.type === 'number' ? null : String((o && o.max) || 2000), oninput: (e) => { F[k] = e.target.value; } }));
    const save = el('button', { type: 'button', class: 'btn primary', id: 'nb-save', text: 'Add the note', onclick: async (ev) => {
      const probs = noteProblems(F); err.hidden = !probs.length; err.textContent = probs.join(' '); if (probs.length) return;
      const note = { title: F.title.trim(), hypothesis: F.hypothesis.trim(), dataset: F.dataset.trim(), method: F.method.trim(), results: F.results || '', limitations: F.limitations || '', reproducibility: F.reproducibility || '', validation: F.validation, sampleSize: F.sampleSize == null || F.sampleSize === '' ? null : +F.sampleSize,
        edge: F.edge || null, tags: String(F.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12) };
      const r = await act(ev.currentTarget, msg, () => api.post({ action: 'notebook.add', note }), 'Note added.'); if (r) redraw();
    } });
    box.appendChild(el('details', { class: 'more', id: 'nb-form', open: !notes.length }, el('summary', { text: 'Add a note' }),
      el('div', { class: 'f-grid' }, inp('title', 'Title', { max: 160 }), el('label', { class: 'f' }, el('span', { text: 'Where it stands' }), el('select', { id: 'nb-validation', onchange: (e) => { F.validation = e.target.value; } }, VALIDATION.map(([v, t]) => el('option', { value: v, text: t })))),
        inp('sampleSize', 'Sample size (n)', { type: 'number', hint: '(needed for out-of-sample or validated)' }), el('label', { class: 'f' }, el('span', {}, 'Edge ', el('small', { text: '(optional)' })), el('select', { id: 'nb-edge', onchange: (e) => { F.edge = e.target.value; } }, el('option', { value: '', text: 'none' }), el('option', { value: '*', text: 'all edges' }), ctx.edges().map((x) => el('option', { value: x.id, text: x.name }))))),
      inp('hypothesis', 'Hypothesis', { area: true, wide: true }), inp('dataset', 'Dataset', { wide: true, hint: '(which trades, which dates, which pool)' }), inp('method', 'Method', { area: true, wide: true }), inp('results', 'Results', { area: true, wide: true, max: 6000, hint: '(with n and t)' }), inp('limitations', 'Limits', { wide: true, max: 4000 }), inp('reproducibility', 'How to reproduce it', { wide: true }), inp('tags', 'Tags', { hint: '(separated by commas)', max: 400 }),
      err, el('div', { class: 'f-actions' }, save, msg)));
    return box;
  }
  async function researchTab(sec, ctx) {
    const live = fresh('research'), redraw = () => researchTab(sec, ctx); loading(sec, 'Reading the research…');
    let R, E, N;
    try { [R, E, N] = await Promise.all([RS.research || api.get({ get: 'research' }), RS.evaluation || api.get({ get: 'evaluation' }).catch(() => ({ available: false })), api.get({ get: 'notebook' })]); }
    catch (err) { if (live()) clear(sec).appendChild(errBox('The research', err)); return; }
    if (!live()) return; RS.research = R; RS.evaluation = E; clear(sec);
    const edges = ctx.edges(), nameOf = (id) => (id ? (edges.find((x) => x.id === id) || { name: id }).name : 'the book');

    const c1 = card('Generated studies', R.available ? `built ${R.generated || 'n/a'} · train pool only, the exam pool is never read` : null, 'rs-studies');
    if (!R.available) c1.appendChild(empty('Research is not generated on this server yet, so there is no study to show. It appears after the research step has been run and shipped (node academy/gen/research.mjs).'));
    else {
      const cn = R.counts || {}, cc = cn.conditions || {}, ch = cn.expectedByChance || {};
      if (R.what) c1.appendChild(el('p', { text: R.what }));
      c1.appendChild(el('p', { id: 'rs-chance' }, el('b', { text: `${cn.tests} of ${cc.registered} registered conditions had enough trades to test. ` }), `${cc.passedDiscovery} passed discovery; about ${ch.passDiscovery} would pass by chance alone. ${cc.survivedCorrection} survived the correction for ${cn.tests} tests. `, ch.note || ''));
      c1.appendChild(el('p', { class: 'honest', id: 'rs-summary', text: (R.summary || []).slice(-1)[0] || '' }));
      const pre = R.preregistration || {}, fam = pre.families || [];
      c1.appendChild(el('details', { class: 'more', id: 'rs-prereg' }, el('summary', { text: 'The pre-registration: what was fixed before any result' }), el('p', { text: pre.statement || 'No statement is recorded.' }),
        kv(fam.map((f) => [f.title, (f.keys || []).join(', ')]).concat(pre.buckets && pre.buckets.rule ? [['Buckets', pre.buckets.rule]] : [], (pre.amendments || []).length ? [['Amendments', pre.amendments.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')]] : [['Amendments', 'none']])),
        tableSections(Object.fromEntries(Object.keys(pre).filter((k) => ['statement', 'families', 'buckets', 'amendments'].indexOf(k) < 0).map((k) => [k, pre[k]]))).map(sectionNode)));
      const kinds = Array.from(new Set(R.studies.map((s) => s.kind))), listBox = el('div', {}), count = el('p', { class: 'note', id: 'rs-count', role: 'status' });
      const drawList = () => {
        const rows = filterStudies(R.studies, RS); count.textContent = `${rows.length} of ${R.studies.length} studies` + (rows.length > 150 ? ', the first 150 shown' : '') + '. Open one to read it in full, with its table.';
        clear(listBox).appendChild(rows.length ? table(['Study', 'Kind', 'Edge', 'n', 'Where it stands'], rows.slice(0, 150).map((s) => el('tr', { 'data-study': s.id }, el('td', {}, el('button', { type: 'button', class: 'link', text: s.title, onclick: () => openStudy(s.id, ctx) })), el('td', { text: s.kind }), el('td', { text: nameOf(s.edge) }), num(fin(s.sampleSize) ? s.sampleSize : 'n/a'), el('td', {}, standTag(s.validation)))), 'rs-table') : empty('No study matches these filters.'));
      };
      const pick = (id, label, key, opts) => el('label', { class: 'f' }, el('span', { text: label }), el('select', { id, onchange: (ev) => { RS[key] = ev.target.value; drawList(); } }, opts.map(([v, t]) => el('option', { value: v, text: t, selected: RS[key] === v }))));
      c1.appendChild(el('div', { class: 'f-grid' }, pick('rs-edge', 'Edge', 'edge', [['', 'every edge']].concat(edges.map((x) => [x.id, x.name]), [['book', 'the book (no single edge)']])), pick('rs-kind', 'Kind of study', 'kind', [['', 'every kind']].concat(kinds.map((k) => [k, k]))), pick('rs-validation', 'Where it stands', 'validation', [['', 'any']].concat(VALIDATION))));
      c1.appendChild(count); c1.appendChild(listBox); drawList();
    }
    sec.appendChild(c1); sec.appendChild(el('div', { class: 'card', id: 'rs-detail', hidden: true }));

    const c2 = card('The policy against taking every setup', 'train pool, net R a trade after costs, no lessons and no model', 'rs-policy'), ev = E && E.available ? E.evaluation : null;
    if (!ev) c2.appendChild(empty('The evaluation is not generated on this server yet (node academy/gen/evaluate.mjs).'));
    else {
      if (ev.what) c2.appendChild(el('p', { text: ev.what }));
      const cell = (x) => [num(fin(x.n) ? x.n : 'n/a'), num(fmtAvgR(x.avg))];
      c2.appendChild(table(['Edge', 'Every setup: n', 'R a trade', 't', 'Policy takes: n', 'R a trade', 'Policy waits: n', 'R a trade', 'Takes minus waits: t', 'Verdict'], policyRows(ev).map((r) => el('tr', { 'data-edge': r.edge }, el('td', {}, el('b', { text: r.name })), cell(r.every), num(fmtNum(r.every.t)), cell(r.take), cell(r.wait), num(fmtNum(r.t)), el('td', { text: r.verdict }))), 'rs-policy-table'));
      const m = ev.method || {}; c2.appendChild(el('p', { class: 'honest', id: 'rs-policy-verdict', text: `Overall: ${(ev.overall && ev.overall.verdict) || 'n/a'}. ${(ev.overall && ev.overall.why) || ''}` }));
      c2.appendChild(el('p', { class: 'note', text: [m.verdictRule ? 'Rule: ' + m.verdictRule + '.' : '', m.caution || ''].join(' ') }));
    }
    sec.appendChild(c2); sec.appendChild(notebookCard(N, ctx, redraw));
    if (RS.open && R.available) { const id = RS.open; RS.open = null; openStudy(id, ctx); }
  }
  MXAC.registerTab('research', { title: 'Research', render: researchTab });

  // ---- Models -------------------------------------------------------------------------------------------------------------
  async function modelsTab(sec) {
    const live = fresh('models'); loading(sec, 'Reading the registry and the training report…');
    let T, M; try { [T, M] = await Promise.all([api.get({ get: 'training' }), api.get({ get: 'models' })]); } catch (err) { if (live()) clear(sec).appendChild(errBox('The models', err)); return; }
    if (!live()) return; clear(sec);
    const reg = M.models || [], champ = reg.find((m) => m.id === M.championId) || null, c1 = card('Model registry', 'what the decision engine may use', 'md-registry');
    c1.appendChild(el('p', { class: 'honest', id: 'md-champion', text: champ ? `Champion: ${champ.name} ${champ.version}, promoted ${fmtStamp(champ.promotedAt)}.` : 'No champion. Nothing is promoted: the decision policy runs without a scorer, and confidence is given in words, never as a probability.' }));
    if (!reg.length) c1.appendChild(empty('The registry is empty: no scorer has been registered. The offline training below produced challengers as files; none was registered, because none beat taking every setup.'));
    else c1.appendChild(table(['Name', 'Version', 'Status', 'Edge', 'Registered (UTC)', 'Metrics'], reg.map((m) => [m.name, m.version, m.status, m.edge || 'all', num(fmtStamp(m.createdAt).replace(' UTC', '')), Object.keys(m.metrics || {}).map((k) => `${k} ${m.metrics[k]}`).join(' · ') || 'none']), 'md-registry-table'));
    if ((M.history || []).length) c1.appendChild(el('details', { class: 'more' }, el('summary', { text: `Promotion history (${M.history.length})` }), table(['When (UTC)', 'Who', 'Action', 'Model', 'Reason'], M.history.map((h) => [num(fmtStamp(h.at).replace(' UTC', '')), h.who, h.action, h.id, h.reason || '']))));
    c1.appendChild(el('h3', { text: 'Promotion is a manual owner step' }));
    c1.appendChild(el('ol', { class: 'steps', id: 'md-manual' }, el('li', { text: 'Train offline (the manual workflow academy-train, or ml/train.py). It commits nothing and promotes nothing.' }), el('li', {}, 'Register the scorer: ', el('code', { text: 'POST /api/academy { "action": "model.register", "model": { "name", "version", "metrics", "hash" } }' }), '.'),
      el('li', {}, 'Promote it yourself: ', el('code', { text: '{ "action": "model.promote", "id": "<model id>", "confirm": true }' }), '. Undo with ', el('code', { text: '{ "action": "model.rollback", "confirm": true }' }), '.'),
      el('li', { text: 'A scorer is used only when it is both promoted and calibrated. This page has no promote button on purpose: scorer files are not uploaded from a browser.' })));
    sec.appendChild(c1);

    const c2 = card('Training report', T.available ? `built ${T.generated || 'n/a'} · trainer ${T.trainer || 'n/a'} · target: ${T.target || 'n/a'}` : null, 'md-training');
    if (!T.available) { c2.appendChild(empty((T.note ? T.note.charAt(0).toUpperCase() + T.note.slice(1) + '. ' : '') + 'The report appears when ml/models/index.json is shipped with the build.')); sec.appendChild(c2); return; }
    const rows = modelRows(T), side = (x) => `n ${fin(x.n) ? x.n : 'n/a'} at ${fmtAvgR(x.avg)}`;
    c2.appendChild(el('p', { class: 'honest', id: 'md-verdict', text: rows.some((r) => r.promoted) ? 'A scorer in this report is marked promoted.' : `None of the ${rows.length} scorers beat taking every setup. All are rejected challengers; none is promoted.` }));
    if (T.verdictRule) c2.appendChild(el('p', { text: 'Rule: ' + T.verdictRule }));
    c2.appendChild(el('h3', {}, 'Walk-forward, out of fold', el('small', { text: 'chronological, expanding window: each block is scored by a scorer fitted on earlier trades only' })));
    c2.appendChild(table(['Scorer', 'Trades fitted (n)', 'Period', 'Every setup', 'Out of fold (n)', 'AUC', 'Kept', 'Skipped', 'Kept minus skipped: t', 'Status'], rows.map((r) => el('tr', { 'data-model': r.id }, el('td', {}, el('b', { text: r.scope })), num(r.rows), num(`${r.from} to ${r.to}`), num(`${fmtPct(r.baseWin)} won, ${fmtAvgR(r.baseR)}`), num(fin(r.n) ? r.n : 'n/a'), num(fmtNum(r.auc, 3)), num(side(r.kept)), num(side(r.skipped)), num(fin(r.t) ? fmtNum(r.t) : 'too few skipped for a t'), el('td', {}, tag(r.status, 'off'), ' ', tag(r.promoted ? 'promoted' : 'not promoted', r.promoted ? 'ok' : 'off')))), 'md-training-table'));
    c2.appendChild(listOr(el('ul', { class: 'txt-list', id: 'md-verdicts' }), rows, '', (r) => el('li', {}, el('b', { text: r.scope + ': ' }), r.verdict + '.')));
    c2.appendChild(el('p', { class: 'note', text: 'AUC 0.5 is a coin flip. These scores rank setups; they are not probabilities and none is shown to the mentor as one.' }));
    const ex = rows.filter((r) => r.exam);
    if (ex.length) {
      c2.appendChild(el('h3', {}, 'The exam block', el('small', { text: 'kept apart: read once, after the verdict was fixed, and used to choose nothing' })));
      c2.appendChild(table(['Scorer', 'Exam setups (n)', 'Period', 'AUC', 'Kept', 'Every setup'], ex.map((r) => [el('b', { text: r.scope }), num(fin(r.exam.n) ? r.exam.n : 'n/a'), num(`${r.exam.from} to ${r.exam.to}`), num(fmtNum(r.exam.auc, 3)), num(side(r.exam.kept)), num(side(r.exam.mechanical))]), 'md-exam-table'));
      if (ex[0].exam.limit) c2.appendChild(el('p', { class: 'note', text: 'Limit: ' + ex[0].exam.limit + '.' }));
    }
    c2.appendChild(el('h3', {}, 'Not fitted', el('small', { text: 'too few trades' })));
    c2.appendChild(listOr(el('ul', { class: 'txt-list', id: 'md-skipped' }), T.skipped || [], 'Every edge had enough trades to fit.', (s) => el('li', {}, el('b', { text: s.edge + ': ' }), `${s.status}. ${s.why} (${s.from} to ${s.to}).`)));
    sec.appendChild(c2);
  }
  MXAC.registerTab('models', { title: 'Models', render: modelsTab });

  // ---- Costs ----------------------------------------------------------------------------------------------------------------
  async function costsTab(sec) {
    const live = fresh('costs'); loading(sec, 'Reading the cost ledger…');
    let C; try { C = await api.get({ get: 'cost' }); } catch (err) { if (live()) clear(sec).appendChild(errBox('The cost ledger', err)); return; }
    if (!live()) return; clear(sec);
    const v = costView(C), box = card('Language-model adapter', 'optional commentary only: it is never in the decision path', 'co-card'), of = (x) => (fin(x.budget) ? `of ${fmtUsd(x.budget)} · ${plural(x.requests, 'request')}` : plural(x.requests, 'request'));
    box.appendChild(el('p', { class: 'honest', id: 'co-head', text: v.head }));
    box.appendChild(statGrid([['Today', fmtUsd(v.today.usd), of(v.today), 'co-today'], ['This month', fmtUsd(v.month.usd), of(v.month), 'co-month'], ['Since the start', fmtUsd(v.total.usd), `hard stop at ${fmtUsd(v.total.budget)} · ${plural(v.total.requests, 'request')}`, 'co-total'], ['Answered from the cache', v.total.cacheHits, 'no cost'], ['Refused on budget', v.total.skipped, 'no call made']]));
    const b = C.budgets || {}, pr = C.prices || {};
    box.appendChild(kv([['Daily budget', fmtUsd(b.dailyUsd)], ['Monthly budget', fmtUsd(b.monthlyUsd)], ['Hard stop', fmtUsd(b.hardUsd)], ['Kill switch', b.stop ? 'on: no call at all' : 'off'], ['Prices used for the ledger', `${fmtUsd(pr.usdPerMTokIn)} a million tokens in, ${fmtUsd(pr.usdPerMTokOut)} out, at most ${pr.maxTokens} tokens an answer`]]));
    box.appendChild(el('h3', { text: 'Ledger by day' }));
    if (!v.ledger.length) box.appendChild(empty(v.enabled ? 'No call has been made yet, so the ledger is empty.' : 'The ledger is empty: the adapter is off, so no call was ever made. Every decision, lesson and grade on this page is deterministic code.'));
    else box.appendChild(table(['Day (UTC)', 'Spent', 'Requests', 'Tokens in', 'Tokens out', 'From the cache', 'Refused', 'Errors'], v.ledger.map((d) => [num(d.day), num(fmtUsd(d.usd)), num(d.requests || 0), num(d.tokensIn || 0), num(d.tokensOut || 0), num(d.cacheHits || 0), num(d.skipped || 0), num(d.errors || 0)]), 'co-ledger'));
    box.appendChild(el('p', { class: 'note', text: 'To switch it on the owner sets ACADEMY_LLM_KEY, ACADEMY_LLM_URL and ACADEMY_LLM_MODEL on the server, with ACADEMY_LLM_DAILY_USD and ACADEMY_LLM_MONTHLY_USD as budgets. The key never reaches this page.' }));
    sec.appendChild(box);
  }
  MXAC.registerTab('costs', { title: 'Costs', render: costsTab });

  // ---- Audit trail ----------------------------------------------------------------------------------------------------------
  const AU = { month: null, action: '' };
  async function auditTab(sec) {
    const live = fresh('audit'), redraw = () => auditTab(sec), months = monthList(Date.now(), 12); if (!AU.month) AU.month = months[0]; loading(sec, 'Reading the audit trail…');
    let J; try { J = await api.get({ get: 'audit', month: AU.month }); } catch (err) { if (live()) clear(sec).appendChild(errBox('The audit trail', err)); return; }
    if (!live()) return; clear(sec);
    const rows = J.rows || [], acts = auditActions(rows); if (AU.action && acts.indexOf(AU.action) < 0) AU.action = '';
    const box = card('Audit trail', 'every write to the Academy store, newest first', 'au-card'), listBox = el('div', {}), count = el('p', { class: 'note', id: 'au-count', role: 'status' });
    const draw = () => {
      const shown = filterAudit(rows, AU.action); count.textContent = `${shown.length} of ${plural(rows.length, 'write')} in ${AU.month}` + (shown.length > 500 ? ', the latest 500 shown' : '') + '.';
      clear(listBox).appendChild(shown.length ? table(['Time (UTC)', 'Who', 'Action', 'Ids', 'Summary'], shown.slice(0, 500).map((r) => el('tr', { 'data-action': r.action }, num(fmtStamp(r.at).replace(' UTC', '')), el('td', { text: r.who || 'n/a' }), el('td', {}, el('b', { text: r.action })), el('td', { class: 'ids', text: (r.ids || []).join(' ') || 'none' }), el('td', { text: r.summary || '' }))), 'au-table')
        : empty(rows.length ? 'No write of that kind in this month.' : `Nothing was written in ${AU.month}. Every stored attempt, correction, lesson, note and session appears here as it happens.`));
    };
    box.appendChild(el('div', { class: 'f-grid' }, el('label', { class: 'f' }, el('span', { text: 'Month (UTC)' }), el('select', { id: 'au-month', onchange: (e) => { AU.month = e.target.value; AU.action = ''; redraw(); } }, months.map((m) => el('option', { value: m, text: m, selected: m === AU.month })))),
      el('label', { class: 'f' }, el('span', { text: 'Action' }), el('select', { id: 'au-action', onchange: (e) => { AU.action = e.target.value; draw(); } }, el('option', { value: '', text: `every action (${rows.length})` }), acts.map((a) => el('option', { value: a, text: `${a} (${rows.filter((r) => r.action === a).length})`, selected: a === AU.action }))))));
    box.appendChild(count); box.appendChild(listBox); draw(); sec.appendChild(box);
  }
  MXAC.registerTab('audit', { title: 'Audit', render: auditTab });

  // ---- shared by the blind arena and the session ------------------------------------------------------------------------------
  const DAY = 86400, RISK_PCT = 0.25, BALANCE = 100000, isoDay = MXAC.isoDay, dayToSec = MXAC.dayToSec;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const setupOf = (edge) => ({ edge, riskPct: RISK_PCT, cost: fin(edge.costPerRoundTrip) ? edge.costPerRoundTrip : 0, balance: BALANCE });
  const lite = (d) => (d ? { action: d.action, entry: d.entry, stop: d.stop, target: d.target, confidence: d.confidence || null } : null);
  const unfilled = MXAC.unfilled;
  const rangeOf = (fromEl, toEl) => { const a = dayToSec(fromEl.value), b = dayToSec(toEl.value); return a == null || b == null || b < a ? null : { from: a, to: b + DAY }; };
  const dateIn = (id, label, onchange) => el('label', { class: 'f' }, el('span', {}, label, el('small', { text: ' (UTC)' })), el('input', { type: 'date', id, onchange }));
  // a chart with its clock line: the same chart factory as the Train tab
  function stage(idp, label) {
    const time = el('b', { class: 'num', id: idp + '-time', text: '—' }), state = el('span', { class: 'pill', id: idp + '-state', text: 'not started' }), host = el('div', { class: 'chart', id: idp + '-chart', role: 'img', 'aria-label': label }), meta = el('div', { class: 'chart-meta', id: idp + '-meta' });
    let ch = null; const chart = () => (ch = ch || K.newChart(host));
    return { node: el('div', { class: 'card chart-card' }, el('div', { class: 'chart-head' }, el('div', {}, time, ' ', state), meta), host), state, meta, chart,
      draw(series, tf, t) { chart().setBars(K.viewBarsOf(series, tf, t, 400)); time.textContent = fmtTime(t); },
      levels(c) { const x = chart(); x.clearLines(); if (!c) return; x.line(c.entry, 'Edge entry', K.css('--accent')); x.line(c.stop, 'Edge stop', K.css('--sell')); x.line(c.target, 'Edge target', K.css('--buy')); } };
  }
  // A trade answer: the action buttons, the levels of a BUY / SELL, a reason. o = { idp, actions: [[value, label]], levels(value) → { entry, stop, target },
  // needText (true | fn(value)), submit(answer) (async), submitLabel, textLabel, placeholder, done }
  function answerForm(box, o) {
    const idp = o.idp, A = { action: null, entry: null, stop: null, target: null, text: '' }, inputs = {};
    const err = el('p', { class: 'ac-err', id: idp + '-err', role: 'alert', hidden: true }), msg = el('span', { class: 'ac-status', id: idp + '-msg', role: 'status' });
    const needText = () => (typeof o.needText === 'function' ? o.needText(A.action) : !!o.needText);
    const save = el('button', { type: 'button', class: 'btn primary', id: idp + '-save', disabled: true, text: o.submitLabel || 'Save' });
    const check = () => { const p = A.action ? answerProblems(A, needText()) : []; err.hidden = !p.length; err.textContent = p.join(' '); save.disabled = !A.action || !!p.length; return p; };
    const numIn = (k, label) => el('label', { class: 'f' }, el('span', { text: label }), (inputs[k] = el('input', { type: 'number', step: '0.01', id: `${idp}-${k}`, inputmode: 'decimal', disabled: true, oninput: (e) => { const v = e.target.value.trim(); A[k] = v === '' || !Number.isFinite(+v) ? null : +v; check(); } })));
    const choices = el('div', { class: 'choices', role: 'group', 'aria-label': o.label || 'Your answer' }, o.actions.map(([v, label]) => el('button', { type: 'button', class: 'btn', 'data-choice': v, 'aria-pressed': 'false', text: label, onclick: () => choose(v) })));
    function choose(v) {
      A.action = v; choices.querySelectorAll('[data-choice]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.choice === v ? 'true' : 'false'));
      const lv = (o.levels && o.levels(v)) || {}, take = isTake(v);
      for (const k of ['entry', 'stop', 'target']) { A[k] = take && fin(lv[k]) ? lv[k] : null; inputs[k].disabled = !take; inputs[k].value = A[k] == null ? '' : A[k]; }
      check();
    }
    const ta = el('textarea', { id: idp + '-text', maxlength: '4000', placeholder: o.placeholder || 'What do you see?', oninput: (e) => { A.text = e.target.value; check(); } });
    save.addEventListener('click', async () => {
      if (check().length || save.disabled) return; save.disabled = true; msg.textContent = 'Saving…';
      try { await o.submit({ action: A.action, entry: A.entry, stop: A.stop, target: A.target, text: A.text.trim() }); msg.textContent = o.done || 'Stored ✓'; choices.querySelectorAll('button').forEach((b) => { b.disabled = true; }); for (const k of Object.keys(inputs)) inputs[k].disabled = true; ta.disabled = true; }
      catch (e) { msg.textContent = ''; err.hidden = false; err.textContent = 'Not stored: ' + ((e && e.message) || e) + '.'; save.disabled = false; }
    });
    box.appendChild(choices); box.appendChild(el('div', { class: 'lv' }, numIn('entry', 'Entry'), numIn('stop', 'Stop'), numIn('target', 'Target')));
    box.appendChild(el('label', { class: 'f', style: 'margin-top:10px' }, el('span', { text: o.textLabel || 'Your reason' }), ta)); box.appendChild(err); box.appendChild(el('div', { class: 'f-actions' }, save, msg));
    return { choose };
  }

  // ---- Blind arena ----------------------------------------------------------------------------------------------------------
  // The mentor answers first. The engine's decision is stored as a hidden attempt (mode blind) and dropped from the page; it
  // comes back only in the answer to blind.submit, after the mentor's own answer is stored. The outcome is asked for last.
  let BL = null;
  function blindTab(sec, ctx) {
    if (BL && BL.sec === sec && sec.firstChild) return;   // a sitting in progress is kept when the tab is shown again
    const B = (BL = { sec, rows: [], done: new Set(), pool: null, queue: [], i: 0, busy: false, clock: null }); clear(sec);
    const note = el('p', { class: 'note', id: 'bl-count', role: 'status' }), msg = el('span', { class: 'ac-status', id: 'bl-msg', role: 'status' }), err = el('p', { class: 'ac-err', id: 'bl-setup-err', role: 'alert', hidden: true });
    const st = stage('bl', 'Blind arena chart: candles closed at the setup time'), live = el('div', { id: 'bl-live', hidden: true }), info = el('div', { class: 'card', id: 'bl-info' }), answer = el('div', { class: 'card', id: 'bl-answer' }), reveal = el('div', { class: 'card', id: 'bl-reveal', hidden: true }), tableBox = el('div', { class: 'card', id: 'bl-table' });
    let myEdge = edgeOf(ctx);
    const edge = () => edgeDef(ctx, myEdge), from = dateIn('bl-from', 'From', () => count()), to = dateIn('bl-to', 'To, included', () => count()), fromEl = from.querySelector('input'), toEl = to.querySelector('input');
    const queue = () => { const r = rangeOf(fromEl, toEl); return !r || !B.pool ? [] : (B.pool.candidates || []).filter((c) => c.t >= r.from && c.t < r.to && !B.done.has(c.id)); };
    const count = () => { const r = rangeOf(fromEl, toEl), q = queue(); note.textContent = !r ? 'Pick a start and an end date (the end on or after the start).' : `${plural(q.length, 'train setup')} in this range without a blind answer yet.` + (q.length ? '' : ' Widen the range, or pick another edge.'); };
    function drawTable() {
      const s = blindTable(B.rows), e = edge(); clear(tableBox).appendChild(el('h2', { class: 'c-h' }, 'You against the engine', el('small', { text: `${e ? e.name : ''} · every blind answer stored for this edge` })));
      if (!s.n) { tableBox.appendChild(empty('No blind answer yet. Start a round above: you answer each setup before the engine\'s answer is shown, and the running score appears here.')); return; }
      tableBox.appendChild(statGrid([['Setups answered', s.n, 'n', 'bl-n'], ['Same answer', `${s.agree} of ${s.withEngine}`, 'you and the engine', 'bl-agree'], ['Your net R', fmtR(s.mentorR), `n = ${s.graded} graded`, 'bl-mentor-r'], ['Engine net R', fmtR(s.engineR), `n = ${s.graded} graded`, 'bl-engine-r'], ['Closer to the outcome', `you ${s.mentorCloser} · engine ${s.engineCloser}`, `${plural(s.ties, 'tie')} · n = ${s.graded}`, 'bl-closer-n']]));
      tableBox.appendChild(el('p', { class: 'note', id: 'bl-table-note', text: (s.tooFew ? fewText(s.graded, 'graded setup') + ' ' : '') + 'A WAIT counts as 0R; a trade on the setup\'s own side counts as the setup\'s net R after costs; a trade on the other side cannot be graded. Train-pool setups only.' }));
      tableBox.appendChild(table(['Setup time (UTC)', 'Side', 'You', 'Engine', 'Your R', 'Engine R', 'Closer'], B.rows.slice(0, 30).map((r) => { const c = closer(r.rMentor, r.rEngine); return el('tr', { 'data-cand': r.candidateId }, num(fin(r.t) ? fmtTime(r.t).replace(' UTC', '') : 'n/a'), el('td', { text: r.side || 'n/a' }), el('td', {}, actBadge(r.mentor.action, true)), el('td', {}, r.engine ? actBadge(r.engine.action, true) : 'no answer stored'), num(fin(r.rMentor) ? fmtR(r.rMentor) : 'not graded'), num(fin(r.rEngine) ? fmtR(r.rEngine) : 'not graded'), el('td', { text: c === 'mentor' ? 'you' : c === 'engine' ? 'the engine' : c === 'tie' ? 'a tie' : 'not judged' })); }), 'bl-rows'));
    }
    async function prepare(reset) {
      const e = edge(); if (!e) return; note.textContent = 'Counting setups…'; if (reset) { fromEl.value = ''; toEl.value = ''; }
      try {
        const [pool, bj] = await Promise.all([K.poolFor(e.id, 'train'), api.get({ get: 'blind', edge: e.id })]);
        B.pool = pool; B.rows = bj.blind || []; B.done = new Set(B.rows.map((r) => r.candidateId));
        const r = MXAC.defaultRange(pool.candidates || [], 60); if (r && !fromEl.value) { fromEl.value = isoDay(r.from); toEl.value = isoDay(r.to - DAY); }
        count(); drawTable();
      } catch (e2) { note.textContent = 'The setups could not be read: ' + e2.message + '.'; }
    }
    async function start() {
      const e = edge(), r = rangeOf(fromEl, toEl), q = queue(); err.hidden = true; if (B.busy) return;
      if (!e || !r) { count(); return; } if (!q.length) { count(); return; }
      B.busy = true; $('bl-start').disabled = true;
      try {
        B.tf = MXAC.chartTfOf(e); msg.textContent = 'Loading candles…';
        const got = await K.loadSeries(e.market, r.from, r.to, (m) => { msg.textContent = m; });
        if (!got.series[B.tf].length || !got.series['5m'].length) throw Object.assign(new Error('No candles came back for this market and range, so there is nothing to show. Try other dates.'), { code: 'NO_BARS' });
        msg.textContent = 'Reading the lessons and the past cases…';
        B.lessons = await K.lessonsFor(e.id); B.hist = await K.historyFor(e.id, r.to); await K.ensureCalendar();
        B.edge = e; B.series = got.series; B.dataVersion = got.dataVersion; B.queue = q; B.i = 0; live.hidden = false; st.meta.textContent = `Candles: ${got.dataVersion}. Setups: the study's research candles.`; st.chart().fit(); msg.textContent = '';
        next();
      } catch (e2) { err.hidden = false; err.textContent = e2 && e2.code ? MXAC.candleError(e2) : 'The round could not start: ' + ((e2 && e2.message) || e2) + '.'; msg.textContent = ''; }
      finally { B.busy = false; $('bl-start').disabled = false; }
    }
    function next() {
      const c = B.queue[B.i]; reveal.hidden = true; clear(reveal); clear(answer); clear(info); st.levels(null);
      if (!c) { info.appendChild(el('h2', { text: 'Round finished' })); info.appendChild(el('p', { text: 'Every train setup of this range has your blind answer. Pick another range above for more.' })); st.state.textContent = 'round finished'; count(); return; }
      info.appendChild(el('h2', { class: 'c-h' }, 'Setup', el('small', { text: `${B.i + 1} of ${B.queue.length} in this round` }))); info.appendChild(el('p', { class: 'ac-wait', text: 'The replay is running to the setup…' }));
      st.state.textContent = 'running to the setup';
      const sec0 = MXR.TF[B.tf], arrive = () => { st.draw(B.series, B.tf, c.t); arrived(c).catch((e2) => { clear(info).appendChild(el('p', { class: 'ac-err', text: `The setup at ${fmtTime(c.t)} could not be prepared: ${e2.message}. Nothing was shown of the engine's answer.` })); info.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', text: 'Skip this setup', onclick: () => { B.i++; next(); } }))); }); };
      if (reduced()) { arrive(); return; }
      B.clock = MXR.clock({ from: c.t - 36 * sec0, to: c.t, stepSec: B.tf, speed: 50, onBatch: (t) => st.draw(B.series, B.tf, t), onDone: arrive }); B.clock.play();
    }
    async function arrived(c) {
      const e = B.edge; B.lessons = await K.lessonsFor(e.id);   // cached: read again only after a lesson changed
      const snap = K.snapOf(e, B.series, B.dataVersion, c.t, c), f = MXA.features(snap), hash = MXR.hash(snap), seen = B.pool.seen && B.pool.seen[c.id];
      const pending = !!(seen && seen.mode === 'blind' && seen.attempts > 0), recall = !pending && K.seenBefore(B.pool, c.id);
      st.state.textContent = 'the engine is answering'; st.levels(c);
      if (!pending) {   // a setup left unanswered in an earlier sitting already has its hidden attempt
        let d = K.decideOn(snap, { setup: setupOf(e), account: MXK.account(BALANCE, { t: c.t }), lessons: B.lessons, thesis: MXA.thesis.start(snap), history: MXAC.historyAt(B.hist.rows, c.t) }).decision;
        await api.post(K.attemptBody(c, e.id, 'blind', d, B.lessons, hash, f, null)); d = null;   // stored hidden; this page keeps no copy
        K.decided(c.id); B.pool.seen = B.pool.seen || {}; B.pool.seen[c.id] = { mode: 'blind', attempts: ((seen && seen.attempts) || 0) + 1 };
      }
      st.state.textContent = 'paused on a setup: your answer first'; clear(info);
      info.appendChild(el('h2', { class: 'c-h' }, 'Setup', el('small', { text: `${B.i + 1} of ${B.queue.length} in this round · ${e.name}` })));
      info.appendChild(kv([['Time', fmtTime(c.t)], ['The edge proposes', `a ${c.side} at ${fmtPrice(c.entry)}, stop ${fmtPrice(c.stop)}, target ${c.target == null ? 'none (the stop is trailed)' : fmtPrice(c.target)}`]]));
      info.appendChild(el('p', { class: 'honest', id: 'bl-hidden', text: 'The engine has answered and its answer is stored. It stays hidden until yours is stored.' }));
      if (recall) info.appendChild(el('p', { class: 'ac-warn', id: 'bl-recall', text: 'This setup was decided before in training, so the engine\'s answer here is recall, not a fresh decision.' }));
      answer.appendChild(el('h2', { class: 'c-h' }, 'Your answer', el('small', { text: 'before you see the engine\'s' })));
      answerForm(answer, { idp: 'bl', actions: [['BUY', 'BUY'], ['SELL', 'SELL'], ['WAIT', 'WAIT']], levels: (v) => MXAC.mentorLevelsOf(c, v), needText: true, submitLabel: 'Store my answer and show the engine\'s', placeholder: 'Why this answer?', done: 'Your answer is stored ✓',
        submit: async (a) => {
          const res = await api.post({ action: 'blind.submit', blind: { edge: e.id, candidateId: c.id, action: a.action, entry: a.entry, stop: a.stop, target: a.target, text: a.text } }); B.done.add(c.id);
          let out = null, outErr = null; try { out = (await api.get({ get: 'outcome', id: c.id, edge: e.id })).outcome; } catch (e2) { outErr = e2.message; }   // allowed now: both answers are stored
          const row = Object.assign({}, res.blind, { t: c.t, side: c.side, engine: lite(res.engine), outcome: out, rMentor: gradeLite(res.blind.mentor, c.side, out), rEngine: gradeLite(res.engine, c.side, out) });
          B.rows.unshift(row); try { showBoth(c, row, res.engine, out, outErr, recall); drawTable(); } catch (e2) { reveal.hidden = false; reveal.appendChild(errBox('The comparison', e2)); }
        } });
    }
    function showBoth(c, row, eng, out, outErr, recall) {
      const m = row.mentor, who = closer(row.rMentor, row.rEngine), r = (label, a, b) => el('tr', {}, el('td', { text: label }), el('td', {}, a), el('td', {}, b)), R = (v, d) => (fin(v) ? fmtR(v) : d && isTake(d.action) ? 'not graded (the other side than the setup)' : 'not graded');
      reveal.hidden = false; clear(reveal); st.state.textContent = 'both answers stored';
      reveal.appendChild(el('h2', { class: 'c-h' }, 'Both answers', el('small', { text: `${c.side} setup · ${fmtTime(c.t)}` })));
      if (!eng) reveal.appendChild(el('p', { class: 'ac-warn', text: 'No engine answer was stored for this setup, so there is nothing to compare.' }));
      reveal.appendChild(el('div', { class: 'tbl' }, el('table', { class: 'cmp', id: 'bl-compare' }, el('thead', {}, el('tr', {}, el('th', { text: '' }), el('th', { text: 'You' }), el('th', { text: 'The engine' }))),
        el('tbody', {}, r('Answer', actBadge(m.action, true, 'bl-you'), eng ? actBadge(eng.action, true, 'bl-engine') : 'none'), r('Entry', fmtPrice(m.entry), eng ? fmtPrice(eng.entry) : 'n/a'), r('Stop', fmtPrice(m.stop), eng ? fmtPrice(eng.stop) : 'n/a'), r('Target', fmtPrice(m.target), eng ? fmtPrice(eng.target) : 'n/a'),
          r('Confidence', 'not asked', eng ? eng.confidence || 'n/a' : 'n/a'), r('Result', R(row.rMentor, m), eng ? R(row.rEngine, eng) : 'n/a')))));
      reveal.appendChild(el('p', { id: 'bl-outcome', text: outErr ? `The result could not be read (${outErr}).` : !out ? 'No result is on file for this setup.' : unfilled(out) ? `Result, read after both answers were stored: the order never filled (${out.reason}).` : `Result, read after both answers were stored: the setup's own trade made ${fmtR(out.netR)} after costs, exit by ${out.reason || 'rule'}.` }));
      reveal.appendChild(el('p', { class: 'verdict ' + (who === 'mentor' ? 'learned' : who === 'engine' ? 'not-learned' : 'partly'), id: 'bl-closer', 'data-closer': who || 'none' }, el('b', { text: who ? CLOSER_WORD[who] : 'Who was closer cannot be judged here.' }), who ? '' : ' An answer on the other side than the setup, or a missing result, cannot be graded.', eng ? ` You and the engine gave ${eng.action === m.action ? 'the same answer' : 'different answers'}.` : ''));
      if (recall) reveal.appendChild(el('p', { class: 'note', text: 'The engine had seen this setup in training: its answer is recall.' }));
      if (eng) { const det = el('div', {}); K.decisionView(det, { idp: 'bl-dec', edge: B.edge, cand: c, d: Object.assign({ t: c.t }, MXAC.restoreApplied(eng)), lessons: B.lessons, title: 'The engine\'s reasoning' }); reveal.appendChild(el('details', { class: 'more', id: 'bl-why' }, el('summary', { text: 'The engine\'s evidence and reasons' }), det)); }
      const more = B.i + 1 < B.queue.length;
      reveal.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'bl-next', text: more ? 'Next setup' : 'Finish the round', onclick: () => { B.i++; next(); } })));
      reveal.scrollIntoView({ block: 'nearest' });
    }
    sec.appendChild(el('div', { class: 'card', id: 'bl-setup' }, el('h2', { class: 'c-h' }, 'Blind arena', el('small', { text: 'you answer first, then the engine\'s answer is shown' })),
      el('p', { text: 'On each train-pool setup the engine decides and its answer is stored out of sight. You give BUY, SELL or WAIT with your levels and a reason. Only then are both shown side by side, and the result is read last.' }),
      edgeBar(ctx, 'bl', () => { if (B.clock) B.clock.pause(); live.hidden = true; prepare(true); }, null, { get: () => myEdge, set: (v) => { myEdge = v; } }), el('div', { class: 'f-grid' }, from, to), note, err, el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'bl-start', text: 'Start a round', onclick: start }), msg)));
    live.appendChild(el('div', { class: 'ac-grid' }, el('div', { class: 'ac-chart-col2' }, st.node), el('div', { class: 'ac-side' }, info, answer, reveal)));
    sec.appendChild(live); sec.appendChild(tableBox); prepare(false);
  }
  MXAC.registerTab('blind', { title: 'Blind arena', render: blindTab });

  // ---- Session training and missed opportunities ---------------------------------------------------------------------------------
  // A whole day or range of one edge replayed at speed. The clock stops on every train setup (the decision is stored at once,
  // as in Train) and the mentor may stop anywhere to note "the engine should have acted here" or "the engine was right to wait".
  let SS = null;
  function sessionTab(sec, ctx) {
    if (SS && SS.sec === sec && sec.firstChild) return;   // a running session is kept when the tab is shown again
    const Z = (SS = { sec, events: [], done: new Set(), sessionId: null, clock: null, cur: null, busy: false, pending: null, fromT: 0, since: 0, ended: false }); clear(sec);
    const note = el('p', { class: 'note', id: 'ss-count', role: 'status' }), msg = el('span', { class: 'ac-status', id: 'ss-msg', role: 'status' }), err = el('p', { class: 'ac-err', id: 'ss-setup-err', role: 'alert', hidden: true }), runMsg = el('p', { class: 'ac-status', id: 'ss-run-msg', role: 'status', 'aria-live': 'polite' });
    const st = stage('ss', 'Session chart: candles closed at the replay time'), live = el('div', { id: 'ss-live', hidden: true });
    const thesisBox = el('div', { class: 'card', id: 'ss-thesis' }), sumBox = el('div', { class: 'card', id: 'ss-summary' }), pointBox = el('div', { class: 'card', id: 'ss-point', hidden: true }), noteBox = el('div', { class: 'card', id: 'ss-note', hidden: true }), notesBox = el('div', { class: 'card', id: 'ss-notes' }), savedList = el('ul', { class: 'plain-list', id: 'ss-saved' });
    const from = dateIn('ss-from', 'From', () => count()), to = dateIn('ss-to', 'To, included', () => count()), fromEl = from.querySelector('input'), toEl = to.querySelector('input');
    const tfSel = el('select', { id: 'ss-tf' }, MXAC.TFS.map((tf) => el('option', { value: tf, text: tf }))), spSel = el('select', { id: 'ss-speed' }, [10, 50, 100].map((x) => el('option', { value: x, text: x + '×', selected: x === 50 })));
    let myEdge = edgeOf(ctx), pool = null;
    const edge = () => edgeDef(ctx, myEdge);
    const inRange = () => { const r = rangeOf(fromEl, toEl); return !r || !pool ? [] : (pool.candidates || []).filter((c) => c.t >= r.from && c.t < r.to); };
    const count = () => { const r = rangeOf(fromEl, toEl); note.textContent = !r ? 'Pick a start and an end date (the end on or after the start).' : `${plural(inRange().length, 'train setup')} in this range: the clock stops on each one.`; };
    const btn = (id, text, onclick, cls) => el('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), id, text, onclick });
    const bPlay = btn('ss-play', 'Play', () => playPause(), 'primary'), bStep = btn('ss-step', 'Step one candle', () => { if (canMove()) { leavePoint(); Z.clock.step(1); } }), bMiss = btn('ss-missed', 'The engine should have acted here', () => openNote('missed')), bRight = btn('ss-right', 'The engine was right to wait', () => openNote('right-wait')), bSave = btn('ss-save', 'Save session', () => save(false).catch((e2) => { runMsg.textContent = 'The session was not saved: ' + e2.message + '.'; })), bEnd = btn('ss-end', 'End session', () => endSession());
    const canMove = () => !!Z.clock && !Z.busy && !Z.ended;
    const decide = (snap) => K.decideOn(snap, { setup: setupOf(Z.edge), account: Z.account, lessons: Z.lessons, thesis: Z.thesis, history: snap.cand ? MXAC.historyAt(Z.hist.rows, snap.t) : [] });

    function draw() {
      if (!Z.clock) return; const cs = Z.clock.state(); st.draw(Z.series, Z.tf, cs.t);
      st.state.textContent = Z.ended ? 'session ended' : cs.done ? 'end of range' : Z.cur ? 'paused on a setup' : Z.busy ? 'working…' : cs.playing ? `playing ${cs.speed}×` : 'paused';
      bPlay.textContent = cs.playing ? 'Pause' : Z.cur ? 'Continue' : cs.steps > 0 || cs.t > cs.from ? 'Resume' : 'Play'; bPlay.setAttribute('aria-pressed', cs.playing ? 'true' : 'false');
      const idle = !cs.playing && !Z.cur && !Z.busy && !Z.ended; bMiss.disabled = !idle; bRight.disabled = !idle; bPlay.disabled = Z.ended || cs.done; bStep.disabled = Z.ended || cs.done || cs.playing; bEnd.disabled = Z.ended;
    }
    function drawThesis() {
      const th = Z.thesis; clear(thesisBox).appendChild(el('h2', { class: 'c-h', text: 'Running thesis' })); if (!th) return;
      thesisBox.appendChild(el('p', { id: 'ss-thesis-line', text: `Bias ${th.bias}. Expecting ${th.expecting}.` + (th.status === 'invalidated' ? ' The thesis was invalidated and is being rebuilt.' : '') }));
      thesisBox.appendChild(listOr(el('ul', { class: 'plain-list small' }), (th.changes || []).slice(-4).reverse(), 'No change yet.', (c) => el('li', {}, el('div', {}, el('small', { text: fmtTime(c.t) + ' ' }), c.text + (c.n > 1 ? ` (${c.n} checks)` : '')))));
    }
    function drawSummary() {
      const s = sessionSummary(Z.events); clear(sumBox).appendChild(el('h2', { class: 'c-h' }, Z.ended ? 'Session summary' : 'Session so far', el('small', { text: Z.sessionId ? 'saved as ' + Z.sessionId : 'not saved yet' })));
      sumBox.appendChild(statGrid([['Decisions', s.decisions, `${s.takes} taken · ${s.waits} waited`, 'ss-n-dec'], ['You agreed with', rateText(s.agreed, s.judged), s.noVerdict ? `${s.noVerdict} without a verdict` : 'of the ones you judged', 'ss-n-agree'], ['Missed opportunities', s.missed, 'your notes', 'ss-n-missed'], ['Right waits', s.rightWait, 'your notes', 'ss-n-right'], ['Lessons saved', s.lessons, s.drafts ? `${plural(s.drafts, 'inactive draft')}` : 'in force', 'ss-n-lessons']]));
      sumBox.appendChild(el('p', { class: 'note', id: 'ss-summary-text', text: s.text + '.' + (s.judged && s.tooFew ? ' ' + fewText(s.judged, 'verdict') : '') }));
      const ns = Z.events.filter((x) => x.kind === 'missed' || x.kind === 'right-wait').slice().reverse();
      clear(notesBox).appendChild(el('h2', { class: 'c-h' }, 'Your notes', el('small', { text: 'stored with the session' })));
      notesBox.appendChild(listOr(el('ul', { class: 'plain-list small', id: 'ss-notes-list' }), ns, 'No note yet. Pause anywhere and use one of the two note buttons under the chart.', (x) => el('li', { 'data-kind': x.kind }, el('div', {}, el('b', { text: fmtTime(x.t) + ': ' }), x.kind === 'missed' ? `the engine should have ${x.action === 'BUY' ? 'bought' : 'sold'} (entry ${fmtPrice(x.entry)}, stop ${fmtPrice(x.stop)}). ` : 'the engine was right to wait. ', x.text ? el('small', { text: x.text.slice(0, 200) }) : null))));
    }
    function onTick(t, i) {
      if (i.kind === 'jump' || i.kind === 'restart') return;
      const c = MXAC.dueCandidate(Z.cands, Z.fromT, t, Z.done); if (c) { Z.clock.pause(); Z.clock.jump(c.t); Z.pending = c; }
    }
    function onBatch(t, n, kind) {
      draw(); if (sec.hidden && Z.clock.state().playing) { Z.clock.pause(); draw(); }   // never run on while another section is open
      if (Z.pending && !Z.busy) { const c = Z.pending; Z.pending = null; openPoint(c); return; }
      if ((kind === 'play' || kind === 'step') && !Z.cur && !Z.busy) {
        Z.since += n;
        if (Z.since >= MXAC.THESIS_EVERY) { Z.since = 0; try { const snap = K.snapOf(Z.edge, Z.series, Z.dataVersion, t, null); Z.thesis = MXA.thesis.update(Z.thesis, snap, decide(snap).decision); drawThesis(); } catch (e2) { runMsg.textContent = 'The thesis could not be updated here: ' + e2.message + '.'; } }
      }
    }
    function leavePoint() { if (Z.cur) { Z.cur = null; pointBox.hidden = true; clear(pointBox); st.levels(null); } noteBox.hidden = true; clear(noteBox); }
    function playPause() { if (!canMove()) return; const cs = Z.clock.state(); if (cs.playing) { Z.clock.pause(); draw(); return; } leavePoint(); runMsg.textContent = ''; Z.clock.play(); draw(); }
    async function save(quiet, status) {
      const cs = Z.clock.state(), s = sessionSummary(Z.events);
      const replay = MXR.session.save({ id: Z.sessionId, edge: Z.edge.id, market: Z.edge.market, tf: Z.tf, t: cs.t, from: Z.from, to: Z.to, speed: cs.speed, mode: 'train', savedAt: new Date().toISOString() });
      const session = { edge: Z.edge.id, title: `${Z.edge.name} session · ${isoDay(Z.from)} to ${isoDay(Z.to - DAY)}`, kind: 'session', status: status || (cs.done ? 'done' : 'paused'), t: cs.t, summary: s.text.slice(0, 400), state: { replay, events: Z.events.slice(-500), done: Array.from(Z.done), thesis: Z.thesis } };
      if (Z.sessionId) session.id = Z.sessionId;
      Z.sessionId = (await api.post({ action: 'session.save', session })).session.id;
      if (!quiet) { runMsg.textContent = `Session saved at ${fmtTime(cs.t)}.`; drawSummary(); listSaved(); }
      return Z.sessionId;
    }
    // a lesson drafted from a verdict or a note: shown as a sentence, saved only when the mentor says so
    function offerLesson(box, draft, active, why) {
      const probs = K.lessonProblemsOf(draft), m2 = el('span', { class: 'ac-status', role: 'status' });
      box.appendChild(el('h3', {}, 'Lesson draft', el('small', { text: active ? 'in force for the rest of the session once saved' : 'saved switched off' })));
      box.appendChild(el('p', { class: 'plain', id: active ? 'ss-lesson-plain' : 'ss-draft-plain', text: MXAC.lessonText(draft) })); if (why) box.appendChild(el('p', { class: 'note', text: why }));
      if (probs.length) { box.appendChild(el('p', { class: 'note', text: `This draft cannot be saved as it stands (${probs.join('; ')}). Nothing was drafted; your ${active ? 'verdict' : 'note'} is stored.` })); return; }
      box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', id: active ? 'ss-lesson-save' : 'ss-draft-save', text: active ? 'Save this lesson' : 'Save as an inactive draft', onclick: (ev) => act(ev.currentTarget, m2, async () => {
        const b = ev.currentTarget; await api.post({ action: 'lesson.save', lesson: { edge: draft.edge, title: String(draft.title).trim(), text: draft.text || '', when: draft.when, then: { action: draft.then.action || null, adjust: draft.then.adjust || {}, note: draft.then.note || '' }, source: Object.assign({}, draft.source, { sessionId: Z.sessionId }), active } });
        Z.events.push({ kind: active ? 'lesson' : 'draft', t: Z.clock.state().t }); if (active) { K.lessonsChanged(); Z.lessons = await K.lessonsFor(Z.edge.id, true); } drawSummary(); b.hidden = true;
      }, active ? 'Lesson saved ✓. Edit or revise it in the Lessons tab.' : 'Draft saved ✓, switched off. It is in the Lessons tab.') }), m2));
    }
    async function openPoint(c) {
      Z.busy = true; Z.done.add(c.id); leavePoint(); draw(); runMsg.textContent = `Setup at ${fmtTime(c.t)}: deciding…`;
      try {
        Z.lessons = await K.lessonsFor(Z.edge.id);   // cached: read again only after a lesson changed
        const snap = K.snapOf(Z.edge, Z.series, Z.dataVersion, c.t, c), f = MXA.features(snap), hash = MXR.hash(snap), r = decide(snap), d = r.decision;
        Z.thesis = MXA.thesis.update(Z.thesis, snap, d); drawThesis(); if (!Z.sessionId) await save(true);
        const again = K.seenBefore(Z.pool, c.id), res = await api.post(K.attemptBody(c, Z.edge.id, again ? 'replay-same' : 'train', d, Z.lessons, hash, f, Z.sessionId)); K.decided(c.id);
        const ev = { kind: 'decision', t: c.t, candidateId: c.id, action: d.action, verdict: null }; Z.events.push(ev);
        Z.cur = { cand: c, d, f, row: res.attempt, ev }; st.levels(c); pointBox.hidden = false; clear(pointBox);
        pointBox.appendChild(el('h2', { class: 'c-h' }, 'Decision', el('small', { text: `${c.side} setup · ${fmtTime(c.t)}` })));
        pointBox.appendChild(el('div', { class: 'dec-top' }, actBadge(d.action, false, 'ss-dec-action'), el('span', { class: 'pill' }, 'confidence ', el('b', { text: d.confidence || 'n/a' })), el('span', { class: 'ac-ok', id: 'ss-dec-stored', text: `Attempt ${res.n} stored ✓` })));
        pointBox.appendChild(el('p', { class: 'dec-thesis', text: MXAC.humanize(d.thesis) }));
        if (again) pointBox.appendChild(el('p', { class: 'note', text: 'This setup was decided in an earlier sitting: this answer is stored as a same-trade replay (recall).' }));
        const full = el('div', {}); K.decisionView(full, { idp: 'ss-full', edge: Z.edge, cand: c, d: Object.assign({ t: c.t }, d), risk: r.risk, hash, lessons: Z.lessons, title: 'In full' });
        pointBox.appendChild(el('details', { class: 'more' }, el('summary', { text: 'Evidence, risk, similar cases and lessons' }), full));
        pointBox.appendChild(el('h3', { text: 'Your verdict' })); const vBox = el('div', {}), lBox = el('div', { id: 'ss-lesson' }); pointBox.appendChild(vBox); pointBox.appendChild(lBox);
        answerForm(vBox, { idp: 'ss-v', label: 'Your verdict', actions: [['approve', 'Approve']].concat(['BUY', 'SELL', 'WAIT'].filter((a) => a !== d.action).map((a) => [a, 'Should be ' + a])), levels: (v) => MXAC.mentorLevelsOf(c, v), needText: (v) => v !== 'approve', submitLabel: 'Save verdict', textLabel: 'Why', placeholder: 'What should it have seen?', done: 'Verdict stored ✓',
          submit: async (a) => {
            const ok = a.action === 'approve', corr = { attemptId: res.attempt.id, verdict: ok ? 'approve' : 'change', action: ok ? null : a.action, entry: ok ? null : a.entry, stop: ok ? null : a.stop, target: ok ? null : a.target, bias: null, edge: null, reasons: [], text: a.text, annotations: [] };
            const saved = (await api.post({ action: 'correct', edge: Z.edge.id, correction: Object.assign({}, corr, { errorClass: MXA.classifyError(d, corr, null) }) })).correction; ev.verdict = saved.verdict; ev.want = saved.action; drawSummary();
            if (!ok) offerLesson(lBox, MXA.lessons.fromCorrection(d, Object.assign({}, saved, { sessionId: Z.sessionId }), f), true, null);
          } });
        pointBox.appendChild(el('div', { class: 'f-actions' }, btn('ss-continue', 'Continue the session', () => playPause(), 'primary')));
        runMsg.textContent = 'Paused on a setup. Give your verdict, or continue.'; drawSummary();
      } catch (e2) {
        Z.done.delete(c.id); pointBox.hidden = false; clear(pointBox).appendChild(el('p', { class: 'ac-err', text: `The setup at ${fmtTime(c.t)} could not be decided or stored: ${e2.message}. Nothing was recorded for it.` }));
        pointBox.appendChild(el('div', { class: 'f-actions' }, btn(null, 'Try again', () => openPoint(c), 'primary'), btn(null, 'Skip this setup', () => { Z.done.add(c.id); pointBox.hidden = true; clear(pointBox); draw(); }))); runMsg.textContent = '';
      } finally { Z.busy = false; draw(); }
    }
    // a note at the replay time, between setups: the engine's own read of that moment is stored beside the mentor's
    async function openNote(kind) {
      if (!canMove() || Z.cur || Z.clock.state().playing) return; const t = Z.clock.state().t; noteBox.hidden = false; clear(noteBox);
      let snap, f, hash, d, cm;
      try { snap = K.snapOf(Z.edge, Z.series, Z.dataVersion, t, null); f = MXA.features(snap); hash = MXR.hash(snap); d = decide(snap).decision; cm = MXA.classifyMiss(d, null, f); }
      catch (e2) { noteBox.appendChild(el('p', { class: 'ac-err', text: 'This moment could not be read: ' + e2.message + '.' })); return; }
      const engine = { action: ['BUY', 'SELL', 'WAIT', 'MANAGE'].indexOf(d.action) >= 0 ? d.action : 'WAIT', confidence: ['low', 'medium', 'high'].indexOf(d.confidence) >= 0 ? d.confidence : null };
      const send = async (m) => { if (!Z.sessionId) await save(true); return (await api.post({ action: 'miss', miss: Object.assign({ edge: Z.edge.id, t, sessionId: Z.sessionId, engine, cls: cm.cls, why: String(cm.why || '').slice(0, 600), snapshotHash: hash }, m) })).miss; };
      if (kind === 'right-wait') {
        noteBox.appendChild(el('h2', { class: 'c-h' }, 'Right to wait', el('small', { text: fmtTime(t) }))); const m2 = el('p', { class: 'ac-status', id: 'ss-right-msg', role: 'status', text: 'Storing…' }); noteBox.appendChild(m2);
        try { await send({ kind: 'right-wait', text: '' }); Z.events.push({ kind: 'right-wait', t }); m2.textContent = `Stored ✓: at ${fmtTime(t)} the engine said ${d.action} and you agree that waiting was right.`; drawSummary(); } catch (e2) { m2.textContent = 'Not stored: ' + e2.message + '.'; }
        return;
      }
      const bars = MXR.closedAt(Z.series[Z.tf], Z.tf, t), lastClose = bars.length ? bars[bars.length - 1].close : null, lBox = el('div', {});
      noteBox.appendChild(el('h2', { class: 'c-h' }, 'Missed opportunity', el('small', { text: fmtTime(t) })));
      noteBox.appendChild(el('p', { id: 'ss-engine-read', text: `No setup of ${Z.edge.name} was on the table at this moment, and the engine said ${d.action}. Its own read: ${cm.why || 'no reason recorded'}.` }));
      answerForm(noteBox, { idp: 'ss-m', label: 'What it should have done', actions: [['BUY', 'It should have bought'], ['SELL', 'It should have sold']], levels: () => ({ entry: lastClose, stop: null, target: null }), needText: true, submitLabel: 'Store the note', textLabel: 'Why here', placeholder: 'What made this a trade?', done: 'Note stored ✓',
        submit: async (a) => {
          const m = await send({ kind: 'missed', action: a.action, entry: a.entry, stop: a.stop, target: a.target, text: a.text }); Z.events.push({ kind: 'missed', t, action: m.action, entry: m.entry, stop: m.stop, text: m.text }); drawSummary();
          offerLesson(lBox, MXA.lessons.fromCorrection(d, { verdict: 'change', action: a.action, entry: a.entry, stop: a.stop, target: a.target, reasons: [], text: a.text, sessionId: Z.sessionId }, f), false, 'A lesson only acts when the edge itself produces a setup: it cannot make a trade where the edge was silent. So this one is saved switched off, for you to judge in the Lessons tab.');
        } });
      noteBox.appendChild(lBox); noteBox.scrollIntoView({ block: 'nearest' });
    }
    async function endSession() {
      if (!Z.clock || Z.ended) return; if (Z.clock.state().playing) Z.clock.pause(); leavePoint(); Z.ended = true; draw();
      try { await save(true, 'done'); runMsg.textContent = 'Session ended and saved. Its summary is below; start another above.'; } catch (e2) { runMsg.textContent = 'The session ended but was not saved: ' + e2.message + '.'; }
      drawSummary(); listSaved(); sumBox.scrollIntoView({ block: 'nearest' });
    }
    async function listSaved() {
      try {
        const rows = ((await api.get({ get: 'sessions' })).sessions || []).filter((s) => s.kind === 'session').slice(0, 12);
        listOr(savedList, rows, 'No saved session yet. A session is saved when the clock first stops on a setup, and when you press "Save session".', (s) => el('li', { 'data-session': s.id }, el('div', {}, el('b', { text: s.title || s.edge }), ' ', tag(s.status === 'done' ? 'ended' : 'paused', s.status === 'done' ? 'off' : 'ok'), el('br'), el('small', { text: (s.summary || '') + ' · saved ' + fmtStamp(s.updatedAt) })),
          s.status === 'done' ? null : el('button', { type: 'button', class: 'btn sm', text: 'Resume', onclick: () => resume(s.id) })));
      } catch (e2) { listOr(savedList, [], 'The saved sessions could not be read: ' + e2.message + '.', () => null); }
    }
    async function resume(id) {
      err.hidden = true;
      try {
        const s = (await api.get({ get: 'session', id })).session, st0 = s.state || {}, rp = MXR.session.restore(st0.replay); if (!edgeDef(ctx, rp.edge)) throw new Error('its edge is no longer in the registry');
        myEdge = rp.edge; const sel = $('ss-edge'); if (sel) sel.value = rp.edge; await prepare(false); fromEl.value = isoDay(rp.from); toEl.value = isoDay(rp.to - DAY); tfSel.value = rp.tf; spSel.value = String([10, 50, 100].indexOf(rp.speed) >= 0 ? rp.speed : 50); count();
        await start({ id: s.id, t: rp.t, events: st0.events || [], done: st0.done || [], thesis: st0.thesis || null });
      } catch (e2) { err.hidden = false; err.textContent = 'That session could not be resumed: ' + e2.message + '.'; }
    }
    async function prepare(reset) {
      const e = edge(); if (!e) return; note.textContent = 'Counting setups…'; if (reset) { fromEl.value = ''; toEl.value = ''; }
      try {
        pool = await K.poolFor(e.id, 'train'); const cs = pool.candidates || [];
        if (cs.length && !fromEl.value) { const lastT = cs[cs.length - 1].t; fromEl.value = isoDay(lastT); toEl.value = isoDay(lastT); }   // the day of the latest setup
        tfSel.value = MXAC.chartTfOf(e); count();
      } catch (e2) { note.textContent = 'The setups could not be read: ' + e2.message + '.'; }
    }
    async function start(res) {
      const e = edge(), r = rangeOf(fromEl, toEl); err.hidden = true; if (Z.busy || !e) return; if (!r) { count(); return; }
      Z.busy = true; $('ss-start').disabled = true;
      try {
        if (Z.clock) Z.clock.pause(); const tf = tfSel.value, speed = +spSel.value; msg.textContent = 'Loading candles…';
        const got = await K.loadSeries(e.market, r.from, r.to, (m) => { msg.textContent = m; });
        if (!got.series[tf].length || !got.series['5m'].length) throw Object.assign(new Error('No candles came back for this market and range, so there is nothing to replay. Try other dates.'), { code: 'NO_BARS' });
        msg.textContent = 'Reading the lessons and the past cases…';
        const lessons = await K.lessonsFor(e.id), hist = await K.historyFor(e.id, r.to); await K.ensureCalendar();
        const t0 = res ? Math.min(r.to, Math.max(r.from, res.t)) : r.from;
        Object.assign(Z, { edge: e, from: r.from, to: r.to, tf, series: got.series, dataVersion: got.dataVersion, lessons, hist, pool, cands: inRange().slice().sort((a, b) => a.t - b.t), events: res ? res.events.slice() : [], done: new Set(res ? res.done : []), sessionId: res ? res.id : null, cur: null, pending: null, fromT: t0, since: 0, ended: false, account: MXK.account(BALANCE, { t: r.from }) });
        Z.clock = MXR.clock({ from: r.from, to: r.to, stepSec: tf, speed, t: t0, onTick, onBatch, onDone: () => { runMsg.textContent = 'The replay reached the end of the range. End the session to save its summary.'; draw(); } });
        Z.thesis = res && res.thesis ? res.thesis : MXA.thesis.start(K.snapOf(e, got.series, got.dataVersion, t0, null));
        live.hidden = false; leavePoint(); st.meta.textContent = `Candles: ${got.dataVersion}. ${plural(Z.cands.length, 'train setup')} in range.`; st.chart().fit(); st.levels(null); msg.textContent = ''; runMsg.textContent = res ? `Session resumed at ${fmtTime(t0)}.` : 'Press Play. The clock stops on every setup; pause anywhere to leave a note.';
        draw(); drawThesis(); drawSummary(); live.scrollIntoView({ block: 'start' });
      } catch (e2) { err.hidden = false; err.textContent = e2 && e2.code ? MXAC.candleError(e2) : 'The session could not start: ' + ((e2 && e2.message) || e2) + '.'; msg.textContent = ''; }
      finally { Z.busy = false; $('ss-start').disabled = false; draw(); }
    }
    const speeds = el('span', { class: 'seg inline', role: 'group', 'aria-label': 'Speed' }, [10, 50, 100].map((x) => el('button', { type: 'button', class: 'btn sm', 'data-speed': x, text: x + '×', onclick: () => { if (Z.clock) { Z.clock.setSpeed(x); draw(); } } })));
    sec.appendChild(el('div', { class: 'card', id: 'ss-setup' }, el('h2', { class: 'c-h' }, 'Session training', el('small', { text: 'a whole day or range of one edge, with your notes on what it missed' })),
      el('p', { text: 'The replay runs through the range with the running thesis. It stops on every train-pool setup, where the decision is stored and you give a verdict. Pause anywhere else to note a missed opportunity or a right wait. No paper account runs here: the Train tab has it.' }),
      edgeBar(ctx, 'ss', () => { if (Z.clock) Z.clock.pause(); live.hidden = true; prepare(true); }, null, { get: () => myEdge, set: (v) => { myEdge = v; } }), el('div', { class: 'f-grid' }, from, to, el('label', { class: 'f' }, el('span', { text: 'Chart timeframe' }), tfSel), el('label', { class: 'f' }, el('span', { text: 'Speed' }), spSel)), note, err,
      el('div', { class: 'f-actions' }, btn('ss-start', 'Start the session', () => start(null), 'primary'), msg), el('div', { class: 'sub' }, el('h3', { text: 'Saved sessions' }), savedList)));
    live.appendChild(el('div', { class: 'ac-grid' }, el('div', { class: 'ac-chart-col2' }, st.node, el('div', { class: 'card' }, el('div', { class: 'ctl', role: 'group', 'aria-label': 'Session controls' }, bPlay, bStep, speeds, bSave, bEnd), el('div', { class: 'ctl', role: 'group', 'aria-label': 'Notes' }, bMiss, bRight), runMsg), notesBox), el('div', { class: 'ac-side' }, sumBox, thesisBox, pointBox, noteBox)));
    sec.appendChild(live); prepare(false); listSaved();
  }
  MXAC.registerTab('session', { title: 'Session', render: sessionTab });

  // ==== end of sections =================================================================================================
})(typeof globalThis !== 'undefined' ? globalThis : this);
