// MeridianX Academy API: owner-only persistence, audit trail, cost ledger and the optional language-model explanation.
// Contract: docs/academy/ARCHITECTURE.md (section 5 shapes, section 6 surface). Storage: api/_academy-store.js (private Blob JSON).
//
// Every answer is "Cache-Control: private, no-store". GET and POST only. POST needs the same origin. The session must be the
// OWNER's (acct.u === 'owner'): nobody else gets 2xx. The body is one JSON object of at most 256 KB. Every id is made here
// (time-sortable: base36 milliseconds + random). Every shape is checked against the contract (unknown action or enum -> 400;
// text is length-capped and stripped of control characters; numbers must be finite). Every successful write appends
// { at, who, action, ids, summary } to the month's audit file.
//
// The Academy is replay and paper only and stands alone: this file reads the generated candidate / outcome files and the
// Academy's own store, nothing else. A BUY or SELL without a stop on the losing side is refused (every trade has a stop).
//
// GET  /api/academy?get=
//   edges                                   the registry (academy/edges.mjs, else academy/data/edges.json, else 503)
//   candidates&edge=&pool=train|exam&from=&to=&limit=&offset=     no outcome fields, ever; pool=exam: only ids never marked seen
//                                           flagged setups (rule.clockShift, rule.pre2020) are left out; flagged=1 lists them (train only)
//   corrections&edge=[&cand=]               the mentor's stored corrections
//   research[&edge=&kind=] | research&id=   generated studies (no tables in the list) and draft lessons; one study in full
//   evaluation                              the policy against taking every setup; training: the offline scorers' report
//   calendar[&t=]                           scheduled release times (the dataset's list); with t: { events, schedule } for a snapshot at t
//   history&edge=&cand=|before=             past train-pool cases finished before that time: { t, exitT, netR, features }, no ids
//   outcome&id=&edge=                       403 "decide first" until an attempt for that candidate is stored (no peeking)
//   lessons&edge=&active=1                  all versions, newest first, with stats
//   attempts&edge=&cand=&limit=             oldest first; a blind attempt hides its decision until the mentor has answered
//   sessions · session&id=                  replay session index / one session with its state
//   progress&edge= · mistakes&edge= · exams&edge= · dataset&edge= · notebook · models · cost · audit&month=YYYY-MM
// POST /api/academy { action, ... }
//   attempt · correct · lesson.save · lesson.revise · lesson.deactivate · lesson.stats · session.save · seen · exam.result ·
//   blind.submit · notebook.add · model.register · model.promote · model.rollback · explain
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const S = require('./_session.js');
const ST = require('./_academy-store.js');
const LLM = require('./_academy-llm.js');

const MAX_BODY = 256 * 1024, DATASET_VERSION = 'layer-b-1';
const CAPS = { attempts: 2000, corrections: 4000, exams: 4000, dataset: 4000, blind: 2000, notebook: 1000, audit: 5000, lessons: 5000, sessions: 500 };
const EDGE_IDS = ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open'];   // architecture section 2; the registry wins when it is there
const ACTIONS = ['BUY', 'SELL', 'WAIT', 'MANAGE'], MENTOR_ACTIONS = ['BUY', 'SELL', 'WAIT'], CONFIDENCE = ['low', 'medium', 'high'];
const MODES = ['train', 'replay-same', 'exam', 'blind'], VERDICTS = ['approve', 'reject', 'change'], BIAS = ['up', 'down', 'neutral'];
const REASONS = ['missing-confirmation', 'wrong-structure', 'liquidity', 'htf-bias', 'session', 'volatility', 'rr', 'news', 'late', 'early', 'other'];
const ANNOTATIONS = ['entry', 'stop', 'target', 'liquidity', 'structure', 'sr', 'supply-demand', 'invalidation'];
const OPS = ['eq', 'ne', 'gte', 'lte', 'in', 'between'], THEN = ['WAIT', 'SKIP', 'TAKE', 'FLIP'];
const SESSION_STATUS = ['open', 'paused', 'done'], VALIDATION = ['hypothesis', 'in-sample', 'out-of-sample', 'validated', 'rejected', 'inconclusive'];
const MODEL_STATUS = ['baseline', 'challenger'];
const STAT_KEYS = ['applied', 'replayPass', 'replayFail', 'examN', 'examAgree', 'examNetWith', 'examNetWithout'];
const CAND_FIELDS = ['id', 'edge', 'market', 't', 'side', 'entry', 'stop', 'target', 'tf', 'rule', 'edgeVersion', 'pool'];   // a candidate never carries an outcome
const OUT_FIELDS = ['id', 'R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR'];

// ---- errors and checks ----------------------------------------------------------------------------------------------------
class Bad extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const bad = (msg, status = 400) => { throw new Bad(msg, status); };
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:|@+-]{0,119}$/, EDGE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/, SID_RE = /^se_[a-z0-9]{8,40}$/, KEY_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,59}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const obj = (v, name) => (isObj(v) ? v : bad(`${name} must be an object`));
function text(v, max, name, required) {
  if (v == null || v === '') return required ? bad(`${name} is required`) : '';
  if (typeof v !== 'string' && typeof v !== 'number') bad(`${name} must be text`);
  const s = String(v).replace(CTRL, '').trim().slice(0, max); return !s && required ? bad(`${name} is required`) : s;
}
const textOrNull = (v, max, name) => text(v, max, name) || null;
const numOrNull = (v, name) => (v == null ? null : typeof v === 'number' && Number.isFinite(v) ? v : bad(`${name} must be a finite number`));
const num = (v, name) => (v == null ? bad(`${name} is required`) : numOrNull(v, name));
const intOrNull = (v, name, min = 0, max = 1e9) => { const n = numOrNull(v, name); return n == null ? null : Number.isInteger(n) && n >= min && n <= max ? n : bad(`${name} must be a whole number from ${min} to ${max}`); };
const oneOf = (v, list, name) => (list.includes(v) ? v : bad(`${name} must be one of: ${list.join(', ')}`));
const oneOfOrNull = (v, list, name) => (v == null || v === '' ? null : oneOf(v, list, name));
const idOf = (v, name) => (typeof v === 'string' && ID_RE.test(v) ? v : bad(`${name} is not a valid id`));
const idOrNull = (v, name) => (v == null || v === '' ? null : idOf(v, name));
const boolOrNull = (v, name) => (v == null ? null : typeof v === 'boolean' ? v : bad(`${name} must be true or false`));
function list(v, max, name, fn) {
  if (v == null) return []; if (!Array.isArray(v)) bad(`${name} must be a list`); if (v.length > max) bad(`${name}: ${max} items at most`);
  return v.map((x, i) => fn(x, `${name}[${i}]`));
}
// free-form JSON (a session's state, a candidate's rule tags, the context of an explanation): cleaned, bounded, finite numbers only
function safe(v, name, depth = 0) {
  if (v == null) return null; if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : bad(`${name}: numbers must be finite`);
  if (typeof v === 'string') return v.replace(CTRL, '').slice(0, 4000);
  if (depth >= 10) bad(`${name} is nested too deeply`);
  if (Array.isArray(v)) { if (v.length > 5000) bad(`${name}: lists of 5,000 items at most`); return v.map((x) => safe(x, name, depth + 1)); }
  if (typeof v !== 'object') bad(`${name} holds a value that is not JSON`);
  const ks = Object.keys(v); if (ks.length > 500) bad(`${name}: 500 keys at most`);
  const o = {}; for (const k of ks) { const kk = k.replace(CTRL, '').slice(0, 80); if (kk && kk !== '__proto__' && kk !== 'constructor' && kk !== 'prototype') o[kk] = safe(v[k], name, depth + 1); } return o;
}
// a flat feature object: numbers, short strings, booleans
function featuresOf(v, name) {
  if (v == null) return null; obj(v, name); const ks = Object.keys(v); if (ks.length > 200) bad(`${name}: 200 features at most`);
  const o = {};
  for (const k of ks) {
    if (!KEY_NAME.test(k)) bad(`${name}: "${k.slice(0, 40).replace(CTRL, '')}" is not a feature key`);
    const x = v[k]; o[k] = x == null ? null : typeof x === 'boolean' ? x : typeof x === 'number' ? numOrNull(x, `${name}.${k}`) : typeof x === 'string' ? text(x, 120, `${name}.${k}`) : bad(`${name}.${k} must be a number or a short text`);
  }
  return o;
}
// the trade levels of a decision: a BUY / SELL always has an entry and a stop on the losing side
function levels(d, action, name, need = true) {
  const entry = numOrNull(d.entry, `${name}.entry`), stop = numOrNull(d.stop, `${name}.stop`), target = numOrNull(d.target, `${name}.target`);
  if (action === 'BUY' || action === 'SELL') {
    const dir = action === 'BUY' ? 1 : -1;
    if (entry == null || stop == null) { if (need || entry != null || stop != null) bad(`${name}: a ${action} needs an entry and a stop (every trade has a stop)`); }
    else { if ((stop - entry) * dir >= 0) bad(`${name}: the stop is on the wrong side of the entry`); if (target != null && (target - entry) * dir <= 0) bad(`${name}: the target is on the wrong side of the entry`); }
  }
  return { entry, stop, target };
}
// the short form of a decision (exam results, blind answers, dataset rows)
function decisionLite(v, name, actions = ACTIONS) {
  const d = obj(v, name), action = oneOf(d.action, actions, `${name}.action`);
  return { action, ...levels(d, action, name), confidence: oneOfOrNull(d.confidence, CONFIDENCE, `${name}.confidence`) };
}
const factors = (v, name) => list(v, 40, name, (x, n) => { obj(x, n); return { factor: text(x.factor, 60, `${n}.factor`), text: text(x.text, 500, `${n}.text`), weight: numOrNull(x.weight, `${n}.weight`) }; });
const lines = (v, name, max = 40, len = 400) => list(v, max, name, (x, n) => text(x, len, n));
// a full Decision (contract section 5); unknown fields are dropped, the id is made here
function decisionOf(v, name, X, edge, candidateId) {
  const d = obj(v, name), lite = decisionLite(d, name);
  if (d.edge != null && d.edge !== edge) bad(`${name}.edge does not match the attempt's edge`);
  const risk = d.risk == null ? null : (obj(d.risk, `${name}.risk`), { rr: numOrNull(d.risk.rr, `${name}.risk.rr`), stopAtr: numOrNull(d.risk.stopAtr, `${name}.risk.stopAtr`), riskPct: numOrNull(d.risk.riskPct, `${name}.risk.riskPct`), allowed: boolOrNull(d.risk.allowed, `${name}.risk.allowed`), blocks: lines(d.risk.blocks, `${name}.risk.blocks`, 20) });
  const similar = d.similar == null ? null : (obj(d.similar, `${name}.similar`), { n: numOrNull(d.similar.n, `${name}.similar.n`), winRate: numOrNull(d.similar.winRate, `${name}.similar.winRate`), avgR: numOrNull(d.similar.avgR, `${name}.similar.avgR`), note: text(d.similar.note, 400, `${name}.similar.note`) });
  return { id: X.id('dc'), edge, market: text(d.market, 40, `${name}.market`), t: num(d.t, `${name}.t (the decision time)`), action: lite.action, entry: lite.entry, stop: lite.stop, target: lite.target, candidateId,
    thesis: text(d.thesis, 6000, `${name}.thesis`), supporting: factors(d.supporting, `${name}.supporting`), contradicting: factors(d.contradicting, `${name}.contradicting`),
    waitReasons: lines(d.waitReasons, `${name}.waitReasons`), invalidation: lines(d.invalidation, `${name}.invalidation`), risk, similar,
    lessonsApplied: list(d.lessonsApplied, 60, `${name}.lessonsApplied`, (x, n) => { obj(x, n); const o = { id: idOf(x.id, `${n}.id`), version: intOrNull(x.version, `${n}.version`, 1, 1e6), effect: text(x.effect, 300, `${n}.effect`) }; if (typeof x.applied === 'boolean') o.applied = x.applied; if (x.correctionId != null) o.correctionId = idOf(x.correctionId, `${n}.correctionId`); if (x.title != null) o.title = text(x.title, 200, `${n}.title`); return o; }),   // `applied: false` = the lesson matched but could not change the answer: comparisons need it
    confidence: lite.confidence, uncertainty: lines(d.uncertainty, `${name}.uncertainty`),
    modelVersion: textOrNull(d.modelVersion, 80, `${name}.modelVersion`), policyVersion: textOrNull(d.policyVersion, 80, `${name}.policyVersion`), edgeVersion: textOrNull(d.edgeVersion, 80, `${name}.edgeVersion`),
    dataVersion: textOrNull(d.dataVersion, 80, `${name}.dataVersion`), featuresHash: textOrNull(d.featuresHash, 80, `${name}.featuresHash`) };
}
function whenOf(v, name) {
  return list(v, 20, name, (c, n) => {
    obj(c, n); const f = typeof c.f === 'string' && KEY_NAME.test(c.f) ? c.f : bad(`${n}.f is not a feature key`), op = oneOf(c.op, OPS, `${n}.op`), val = c.v;
    const scalar = (x, m) => (typeof x === 'number' ? numOrNull(x, m) : typeof x === 'string' ? text(x, 120, m) : typeof x === 'boolean' ? x : bad(`${m} must be a number, a short text or true / false`));
    if (op === 'in') return { f, op, v: Array.isArray(val) && val.length && val.length <= 20 ? val.map((x, i) => scalar(x, `${n}.v[${i}]`)) : bad(`${n}.v must be a list of 1 to 20 values for "in"`) };
    if (op === 'between') return { f, op, v: Array.isArray(val) && val.length === 2 && val.every((x) => typeof x === 'number' && Number.isFinite(x)) && val[0] <= val[1] ? [val[0], val[1]] : bad(`${n}.v must be [low, high] for "between"`) };
    if (op === 'gte' || op === 'lte') return { f, op, v: typeof val === 'number' ? num(val, `${n}.v`) : bad(`${n}.v must be a number for "${op}"`) };
    return { f, op, v: val == null ? bad(`${n}.v is required`) : scalar(val, `${n}.v`) };
  });
}
function thenOf(v, name) {
  const t = v == null ? {} : obj(v, name), adjust = {};
  if (t.adjust != null) { obj(t.adjust, `${name}.adjust`); for (const k of ['entry', 'stop', 'target']) { const x = t.adjust[k]; if (x != null) adjust[k] = typeof x === 'number' ? numOrNull(x, `${name}.adjust.${k}`) : typeof x === 'string' ? text(x, 160, `${name}.adjust.${k}`) : safe(x, `${name}.adjust.${k}`, 7); } }
  return { action: oneOfOrNull(t.action, THEN, `${name}.action`), adjust, note: text(t.note, 1000, `${name}.note`) };
}
const sourceOf = (v, name) => { const s = v == null ? {} : obj(v, name); return { ...(s.kind != null ? { kind: oneOf(s.kind, ['mentor', 'research'], `${name}.kind`) } : {}), ...(s.studyId != null ? { studyId: text(s.studyId, 160, `${name}.studyId`) } : {}), attemptId: idOrNull(s.attemptId, `${name}.attemptId`), correctionId: idOrNull(s.correctionId, `${name}.correctionId`), candidateId: idOrNull(s.candidateId, `${name}.candidateId`), sessionId: idOrNull(s.sessionId, `${name}.sessionId`) }; };
const zeroStats = () => ({ applied: 0, replayPass: 0, replayFail: 0, examN: 0, examAgree: 0, examNetWith: 0, examNetWithout: 0 });

// ---- the generated files (candidates, outcomes, registry): read-only ---------------------------------------------------------
function fileData(root) {
  const dir = path.join(root, 'academy'), cache = new Map();
  const json = (f) => { let st; try { st = fs.statSync(f); } catch (e) { return null; } const c = cache.get(f); if (c && c.m === st.mtimeMs && c.s === st.size) return c.v; const v = JSON.parse(fs.readFileSync(f, 'utf8')); cache.set(f, { m: st.mtimeMs, s: st.size, v }); return v; };
  return {
    async edges() {
      const mjs = path.join(dir, 'edges.mjs');
      if (fs.existsSync(mjs)) { try { const m = await import(pathToFileURL(mjs).href), v = m.EDGES || m.edges || m.default; if (v) return v; } catch (e) { /* not loadable inside the function: use the generated copy */ } }
      return json(path.join(dir, 'data', 'edges.json'));
    },
    async candidates(edge) { return json(path.join(dir, 'data', `cand-${edge}.json`)); },
    async outcomes(edge) { return json(path.join(dir, 'data', `out-${edge}.json`)); },
    async features(edge) { return json(path.join(dir, 'data', `feat-${edge}.json`)); },
    async calendar() { return json(path.join(dir, 'data', 'calendar.json')); },
    async research() { return json(path.join(dir, 'data', 'research.json')); },
    async evaluation() { return json(path.join(dir, 'data', 'eval.json')); },
    async training() { return json(path.join(root, 'ml', 'models', 'index.json')); },
  };
}
const DATA = new Map();
function defaultData() { const root = fs.existsSync(path.join(process.cwd(), 'academy')) ? process.cwd() : path.join(__dirname, '..'); if (!DATA.has(root)) DATA.set(root, fileData(root)); return DATA.get(root); }
const edgeList = (raw) => { const a = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.edges) ? raw.edges : isObj(raw) ? Object.keys(raw).map((k) => (isObj(raw[k]) ? { id: k, ...raw[k] } : null)) : []; return a.filter((e) => isObj(e) && typeof e.id === 'string' && EDGE_RE.test(e.id)); };
const candList = (raw) => { const a = Array.isArray(raw) ? raw : isObj(raw) ? raw.candidates || raw.rows || raw.items || [] : []; return (Array.isArray(a) ? a : []).filter((c) => isObj(c) && typeof c.id === 'string'); };
const candView = (c) => { const o = {}; for (const k of CAND_FIELDS) if (c[k] !== undefined) o[k] = c[k]; return o; };
function outcomeOf(raw, id) {
  const src = isObj(raw) && raw.outcomes != null ? raw.outcomes : raw, o = Array.isArray(src) ? src.find((x) => isObj(x) && x.id === id) : isObj(src) && Object.prototype.hasOwnProperty.call(src, id) ? src[id] : null;
  if (!isObj(o)) return null; const v = { id }; for (const k of OUT_FIELDS) if (k !== 'id' && o[k] !== undefined) v[k] = o[k]; return v;
}

// ---- small helpers ------------------------------------------------------------------------------------------------------
const K = { lessons: 'lessons.json', attempts: (e) => `attempts/${e}.json`, corrections: (e) => `corrections/${e}.json`, sessions: 'sessions/index.json', session: (id) => `sessions/${id}.json`,
  seen: (e) => `seen/${e}.json`, exams: (e) => `exams/${e}.json`, blind: 'blind.json', dataset: (e) => `dataset/${e}.json`, notebook: 'notebook.json', models: 'models.json', audit: (m) => `audit/${m}.json` };
const emptySeen = () => ({ v: 1, ids: {} });
const seenOf = (doc) => (isObj(doc) && isObj(doc.ids) ? doc : emptySeen());
const emptyModels = () => ({ v: 1, models: [], championId: null, promotions: [], history: [] });
const R = (doc, key) => ST.asRows(doc, key);
function weekOf(iso) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return null;
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), wd = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - wd);
  const y = x.getUTCFullYear(); return `${y}-W${String(Math.ceil(((x - Date.UTC(y, 0, 1)) / 86400e3 + 1) / 7)).padStart(2, '0')}`;
}
const r3 = (v) => Math.round(v * 1000) / 1000;
// a blind attempt keeps its decision hidden until the mentor's own answer is stored
const attemptView = (a, seenEntry) => (a.mode === 'blind' && seenEntry && seenEntry.blindPending ? { ...a, decision: null, hidden: true } : a);
// the action a correction asks for: the mentor's action, or WAIT when a trade was rejected outright
const expected = (c) => (c.action ? c.action : c.verdict === 'reject' && c.was && (c.was.action === 'BUY' || c.was.action === 'SELL') ? 'WAIT' : null);
// R of a short decision on a candidate whose outcome is known: WAIT = 0, the candidate's own trade = its net R, anything else cannot be graded here
function gradeR(dec, side, out) {
  if (!dec || !out) return null; if (dec.action === 'WAIT') return 0;
  if ((dec.action === 'BUY' && side === 'buy') || (dec.action === 'SELL' && side === 'sell')) { const r = typeof out.netR === 'number' ? out.netR : out.R; return typeof r === 'number' && Number.isFinite(r) ? r : null; }
  return null;
}
// candidates the Edges module flags: `clockShift` (the research candles are stamped an hour early in that week, so the setup
// cannot be replayed on another feed) and `pre2020` (outside the 2020 -> now evaluation window). Left out by default; never a test.
const flagOf = (c) => (isObj(c.rule) && c.rule.clockShift ? 'clockShift' : isObj(c.rule) && c.rule.pre2020 ? 'pre2020' : null);
// exam candidates are only for tests, and a test is only on an exam candidate
function poolRule(cand, mode, what) {
  if (!cand) return;
  if (flagOf(cand) && (mode === 'exam' || mode === 'blind')) bad(`${what}: this setup is flagged ${flagOf(cand)} and is never scored as a test`);
  if (cand.pool === 'exam' && (mode === 'train' || mode === 'replay-same')) bad(`${what}: an exam candidate is only for tests on new setups`);
  if (cand.pool !== 'exam' && mode === 'exam') bad(`${what}: a test on a new setup needs an exam-pool candidate`);
}

// ---- request context ------------------------------------------------------------------------------------------------------
function context(req, d, env, acct) {
  const now = () => (d.now ? (typeof d.now === 'function' ? d.now() : d.now) : Date.now()), data = d.data || defaultData();
  let store = d.store || null, known = null, seq = 0;
  const X = {
    env, who: acct.u, now, data, iso: () => new Date(now()).toISOString(),
    // time-sortable id: prefix + base36 milliseconds + a counter inside this request + random
    id: (p) => `${p}_${now().toString(36).padStart(9, '0')}${(seq++).toString(36)}${crypto.randomBytes(5).toString('hex')}`,
    get store() {
      if (!store) store = env.ACADEMY_STORE_DIR && !env.VERCEL ? ST.fileStore(env.ACADEMY_STORE_DIR) : env.BLOB_READ_WRITE_TOKEN ? ST.blobStore(env) : bad('storage not set up', 503);
      return store;
    },
    registry: async () => { const raw = await data.edges(); const a = raw == null ? [] : edgeList(raw); return a.length ? a : null; },
    async edges() { if (!known) { const reg = await X.registry(); known = reg ? reg.map((e) => e.id) : EDGE_IDS; } return known; },
    async edge(v, name = 'edge', star = false) { if (star && v === '*') return '*'; if (typeof v !== 'string' || !EDGE_RE.test(v) || !(await X.edges()).includes(v)) bad(`${name}: unknown edge`); return v; },
    async cand(edge, id) { const raw = await data.candidates(edge); return raw == null ? null : candList(raw).find((c) => c.id === id) || null; },
    // one write step: the files in spec plus the month's audit file. fn(values) -> { write, result, audit: { action, ids, summary } }
    write(spec, fn) {
      const at = X.iso(), aKey = K.audit(at.slice(0, 7));
      return X.store.tx({ ...spec, _audit: [aKey, ST.emptyRows(), CAPS.audit] }, async (vals) => {
        const out = await fn(vals, at), w = { ...(out.write || {}) };
        if (out.audit) { const A = R(vals._audit, aKey); w._audit = { ...A, rows: A.rows.concat({ at, who: X.who, action: out.audit.action, ids: (out.audit.ids || []).filter(Boolean).slice(0, 20), summary: String(out.audit.summary || '').replace(CTRL, '').slice(0, 240) }) }; }
        return { write: w, result: out.result };
      });
    },
  };
  return X;
}

// ---- GET ------------------------------------------------------------------------------------------------------------------
const qInt = (v, name, def, min, max) => { if (v == null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : bad(`${name} must be a number`); };
const qNum = (v, name) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : bad(`${name} must be a number`); };
const GET = {
  async edges(X) { const reg = await X.registry(); return reg ? { edges: reg } : bad('edges not generated yet', 503); },

  async candidates(X, q) {
    const edge = await X.edge(q.edge), pool = q.pool == null || q.pool === '' ? 'train' : oneOf(q.pool, ['train', 'exam'], 'pool');
    const raw = await X.data.candidates(edge); if (raw == null) bad(`candidates not generated yet for ${edge}`, 503);
    const from = qNum(q.from, 'from'), to = qNum(q.to, 'to'), limit = qInt(q.limit, 'limit', 500, 1, 5000), offset = qInt(q.offset, 'offset', 0, 0, 1e7);
    const seen = seenOf(await X.store.get(K.seen(edge), emptySeen())).ids;
    let rows = candList(raw).filter((c) => (pool === 'exam' ? c.pool === 'exam' : c.pool !== 'exam') && (from == null || c.t >= from) && (to == null || c.t <= to));
    // flagged setups (clock-shifted week, before 2020) are left out; flagged=1 lists them for study in the train pool, never in a test
    const flagged = pool === 'train' && (q.flagged === '1' || q.flagged === 'true'), excluded = { clockShift: 0, pre2020: 0 };
    rows = rows.filter((c) => { const f = flagOf(c); if (!f) return true; excluded[f]++; return flagged; });
    if (pool === 'exam') rows = rows.filter((c) => !Object.prototype.hasOwnProperty.call(seen, c.id));   // a test is only ever on a setup never shown before
    rows.sort((a, b) => a.t - b.t);
    const page = rows.slice(offset, offset + limit).map(candView), out = { edge, pool, total: rows.length, count: page.length, excluded: flagged ? { clockShift: 0, pre2020: 0 } : excluded, candidates: page };
    if (pool === 'train') { out.seen = {}; for (const c of page) if (seen[c.id]) out.seen[c.id] = { mode: seen[c.id].mode, attempts: seen[c.id].attempts || 0, last: seen[c.id].last }; }
    return out;
  },

  // The release calendar the dataset rows were built with (scheduled times of public releases, never a result). With t: what a
  // snapshot at t may hold, cut the same way as the dataset (events of the last 7 days, schedule of the next 72 hours; null
  // outside the calendar's span, so "no calendar" is never read as "no event").
  async calendar(X, q) {
    const cal = typeof X.data.calendar === 'function' ? await X.data.calendar() : null;
    if (!isObj(cal) || !Array.isArray(cal.items)) return { available: false, events: null, schedule: null, note: 'the release calendar is not generated yet' };
    const head = { available: true, types: cal.types || [], from: cal.from, to: cal.to, hash: cal.hash || null }, t = qNum(q.t, 't');
    if (t == null) return { ...head, items: cal.items };
    if (t < cal.from || t > cal.to) return { ...head, t, events: null, schedule: null };
    return { ...head, t, events: cal.items.filter((e) => e.t <= t && e.t > t - 7 * 86400), schedule: cal.items.filter((e) => e.t > t && e.t <= t + 72 * 3600) };
  },

  // Past cases for "similar history": train-pool setups of this edge whose trade had FINISHED before the moment asked about
  // (cand = that candidate's own signal time, or before = a replay time). Rows carry no id and no price: only the time, the
  // net result and the small feature set (academy/data/feat-<edge>.json, written by the dataset step). Exam-pool and flagged
  // setups are never in it, so a test setup's result cannot be read here.
  async history(X, q) {
    const edge = await X.edge(q.edge), raw = await X.data.candidates(edge); if (raw == null) bad(`candidates not generated yet for ${edge}`, 503);
    const all = candList(raw); let before = qNum(q.before, 'before');
    if (q.cand != null && q.cand !== '') { const c = all.find((x) => x.id === idOf(q.cand, 'cand')); if (!c) bad('no such candidate', 404); before = c.t; }
    if (before == null) bad('history needs cand or before');
    const outs = await X.data.outcomes(edge), feats = typeof X.data.features === 'function' ? await X.data.features(edge) : null;
    if (outs == null || !isObj(feats)) return { edge, before, available: false, total: 0, rows: [], note: 'past-case features are not generated yet for this edge' };
    const F = isObj(feats.features) ? feats.features : isObj(feats.rows) ? feats.rows : feats, rows = [];
    for (const c of all) {
      if (c.pool === 'exam' || flagOf(c) || !(c.t < before)) continue;
      const o = outcomeOf(outs, c.id), f = Object.prototype.hasOwnProperty.call(F, c.id) ? F[c.id] : null;
      if (!o || typeof o.netR !== 'number' || !Number.isFinite(o.netR) || !(o.exitT < before) || !isObj(f)) continue;
      if (o.reason === 'missed' || o.reason === 'expired' || o.reason === 'cancelled') continue;   // an order that never filled is not a past trade
      rows.push({ t: c.t, exitT: o.exitT, netR: o.netR, features: f });
    }
    rows.sort((a, b) => a.t - b.t);
    return { edge, before, available: true, version: feats.version || null, total: rows.length, rows };
  },

  async outcome(X, q) {
    const id = idOf(q.id, 'id'); let edge = null, entry = null;
    if (q.edge != null && q.edge !== '') { edge = await X.edge(q.edge); entry = seenOf(await X.store.get(K.seen(edge), emptySeen())).ids[id] || null; }
    else for (const e of await X.edges()) { const s = seenOf(await X.store.get(K.seen(e), emptySeen())).ids[id]; if (s && s.attempts > 0) { edge = e; entry = s; break; } }
    if (!entry || !(entry.attempts > 0)) bad('decide first: the outcome is shown once an attempt for this candidate is stored', 403);
    if (entry.blindPending) bad('answer first: submit the blind answer before the outcome is shown', 403);
    const raw = await X.data.outcomes(edge); if (raw == null) bad(`outcomes not generated yet for ${edge}`, 503);
    const o = outcomeOf(raw, id); return o ? { edge, candidateId: id, outcome: o } : bad('no outcome for this candidate', 404);
  },

  async lessons(X, q) {
    const edge = q.edge == null || q.edge === '' ? null : await X.edge(q.edge, 'edge', true);
    let rows = (await X.store.rows(K.lessons, true)).slice().reverse();
    if (edge) rows = rows.filter((l) => l.edge === edge || l.edge === '*');
    if (q.active === '1' || q.active === 'true') rows = rows.filter((l) => l.active);
    return { lessons: rows };
  },

  async attempts(X, q) {
    const edge = await X.edge(q.edge), cand = q.cand == null || q.cand === '' ? null : idOf(q.cand, 'cand'), limit = qInt(q.limit, 'limit', 200, 1, 2000), key = K.attempts(edge);
    const seen = seenOf(await X.store.get(K.seen(edge), emptySeen())).ids; let rows = await X.store.rows(key);
    if (cand) { rows = rows.filter((a) => a.candidateId === cand); if (seen[cand] && seen[cand].attempts > rows.length) rows = (await X.store.rows(key, true)).filter((a) => a.candidateId === cand); }
    else rows = rows.slice(-limit);
    return { edge, attempts: rows.map((a) => attemptView(a, seen[a.candidateId])) };
  },

  async sessions(X) { return { sessions: (await X.store.rows(K.sessions)).slice().reverse() }; },
  async session(X, q) { const id = typeof q.id === 'string' && SID_RE.test(q.id) ? q.id : bad('id is not a session id'); const s = await X.store.get(K.session(id), null); return s ? { session: s } : bad('no such session', 404); },

  async progress(X, q) {
    const edge = await X.edge(q.edge), st = X.store;
    const [att, cor, les, exams, seenRaw, ds] = await Promise.all([st.rows(K.attempts(edge), true), st.rows(K.corrections(edge), true), st.rows(K.lessons, true), st.rows(K.exams(edge), true), st.get(K.seen(edge), emptySeen()), st.rows(K.dataset(edge), true)]), seenDoc = seenOf(seenRaw);
    const mine = les.filter((l) => l.edge === edge || l.edge === '*'), outRaw = await X.data.outcomes(edge);
    const weeks = {}, wk = (iso) => { const k = weekOf(iso) || 'unknown'; return (weeks[k] = weeks[k] || { week: k, attempts: 0, corrections: 0, lessons: 0, replayN: 0, replayPass: 0, examN: 0, examNetWith: 0, examNetWithout: 0 }); };
    const byMode = {}; for (const m of MODES) byMode[m] = 0;
    // same-trade replays: pass = the replay took the action the latest earlier correction of that candidate asked for
    const corBy = {}; for (const c of cor) (corBy[c.candidateId] = corBy[c.candidateId] || []).push(c);
    const replay = { n: 0, graded: 0, pass: 0, fail: 0, passRate: null };
    for (const a of att) {
      byMode[a.mode] = (byMode[a.mode] || 0) + 1; const w = wk(a.at); w.attempts++;
      if (a.mode !== 'replay-same') continue; replay.n++; w.replayN++;
      const prev = (corBy[a.candidateId] || []).filter((c) => c.at < a.at).pop(), want = prev ? expected(prev) : null;
      if (!want || !a.decision) continue; replay.graded++;
      if (a.decision.action === want) { replay.pass++; w.replayPass++; } else replay.fail++;
    }
    replay.passRate = replay.graded ? r3(replay.pass / replay.graded) : null;
    replay.lessonStats = { pass: mine.reduce((s, l) => s + ((l.stats && l.stats.replayPass) || 0), 0), fail: mine.reduce((s, l) => s + ((l.stats && l.stats.replayFail) || 0), 0) };
    const verdicts = { approve: 0, reject: 0, change: 0 }; for (const c of cor) { verdicts[c.verdict] = (verdicts[c.verdict] || 0) + 1; wk(c.at).corrections++; }
    for (const l of mine) wk(l.createdAt).lessons++;
    // tests on new setups, with and without the lessons, graded against the outcome file
    const side = () => ({ taken: 0, wins: 0, netR: 0, avgR: null });
    const exam = { n: exams.length, graded: 0, ungraded: 0, agree: 0, withLessons: side(), withoutLessons: side(), deltaNetR: 0, note: outRaw == null ? 'outcomes not generated yet: nothing is graded' : null };
    for (const e of exams) {
      const w = wk(e.at); w.examN++; if (e.withLessons && e.withoutLessons && e.withLessons.action === e.withoutLessons.action) exam.agree++;
      const out = outRaw == null ? null : outcomeOf(outRaw, e.candidateId), a = gradeR(e.withLessons, e.side, out), b = gradeR(e.withoutLessons, e.side, out);
      if (a == null || b == null) { exam.ungraded++; continue; } exam.graded++;
      for (const [s, r, dec, wkKey] of [[exam.withLessons, a, e.withLessons, 'examNetWith'], [exam.withoutLessons, b, e.withoutLessons, 'examNetWithout']]) { if (dec.action !== 'WAIT') { s.taken++; if (r > 0) s.wins++; } s.netR = r3(s.netR + r); w[wkKey] = r3(w[wkKey] + r); }
    }
    for (const s of [exam.withLessons, exam.withoutLessons]) s.avgR = s.taken ? r3(s.netR / s.taken) : null;
    exam.deltaNetR = r3(exam.withLessons.netR - exam.withoutLessons.netR);
    return { edge, counts: { attempts: att.length, corrections: cor.length, lessons: mine.length, lessonsActive: mine.filter((l) => l.active).length, seen: Object.keys(seenDoc.ids).length, exams: exams.length, datasetRows: ds.length },
      byMode, verdicts, replaySame: replay, exam, byWeek: Object.values(weeks).sort((a, b) => (a.week < b.week ? -1 : 1)),
      note: 'A same-trade replay pass shows the lesson is recalled, not that it generalises. Only tests on new setups count towards progression.' };
  },

  async mistakes(X, q) {
    const edge = await X.edge(q.edge), cor = await X.store.rows(K.corrections(edge), true), byClass = {}, byReason = {}, byVerdict = {};
    for (const c of cor) { byVerdict[c.verdict] = (byVerdict[c.verdict] || 0) + 1; if (c.verdict !== 'approve') { const k = c.errorClass || 'unclassified'; byClass[k] = (byClass[k] || 0) + 1; } for (const r of c.reasons || []) byReason[r] = (byReason[r] || 0) + 1; }
    return { edge, n: cor.length, byClass, byReason, byVerdict };
  },

  async exams(X, q) {
    const edge = await X.edge(q.edge), rows = await X.store.rows(K.exams(edge), true), outRaw = await X.data.outcomes(edge);
    return { edge, graded: outRaw != null, exams: rows.slice().reverse().map((e) => { const out = outRaw == null ? null : outcomeOf(outRaw, e.candidateId); return { ...e, outcome: out, rWith: gradeR(e.withLessons, e.side, out), rWithout: gradeR(e.withoutLessons, e.side, out) }; }) };
  },

  // Layer B rows for the offline training service: the mentor label and the outcome label are separate fields
  async dataset(X, q) {
    const edge = await X.edge(q.edge), rows = await X.store.rows(K.dataset(edge), true), seen = seenOf(await X.store.get(K.seen(edge), emptySeen())).ids, outRaw = await X.data.outcomes(edge);
    return { edge, datasetVersion: DATASET_VERSION, rows: rows.filter((r) => !(seen[r.candidateId] && seen[r.candidateId].blindPending)).map((r) => { const o = outRaw == null ? null : outcomeOf(outRaw, r.candidateId); return { ...r, outcome: o ? { R: o.R, netR: o.netR, reason: o.reason } : null }; }) };
  },

  // the mentor's corrections for one edge (cand= narrows to one setup): what the page needs to show a correction again after a reload
  async corrections(X, q) {
    const edge = await X.edge(q.edge), cand = q.cand == null || q.cand === '' ? null : idOf(q.cand, 'cand'), limit = qInt(q.limit, 'limit', 200, 1, 2000);
    let rows = await X.store.rows(K.corrections(edge), !!cand); rows = cand ? rows.filter((c) => c.candidateId === cand) : rows.slice(-limit);
    return { edge, corrections: rows };
  },

  // Generated research (academy/gen/research.mjs): pre-registered studies on the train pool. A list without the tables, or one
  // study in full with id=. Draft lessons are proposals only: nothing here is active until the mentor saves it.
  async research(X, q) {
    const r = typeof X.data.research === 'function' ? await X.data.research() : null;
    if (!isObj(r) || !Array.isArray(r.studies)) return { available: false, studies: [], proposedLessons: [], note: 'research is not generated yet' };
    if (q.id != null && q.id !== '') { const st = r.studies.find((x) => x.id === q.id); return st ? { available: true, version: r.version, study: st } : bad('no such study', 404); }
    const edge = q.edge == null || q.edge === '' ? null : await X.edge(q.edge, 'edge', true), kind = q.kind == null || q.kind === '' ? null : String(q.kind).slice(0, 40);
    const rows = r.studies.filter((x) => (!edge || edge === '*' || x.edge === edge || x.edge === '*' || x.edge == null) && (!kind || x.kind === kind)).map((x) => { const o = { ...x }; delete o.table; return o; });
    return { available: true, version: r.version, generated: r.generated, what: r.what || null, preregistration: r.preregistration, counts: r.counts, summary: r.summary || null, studies: rows,
      proposedLessons: (r.proposedLessons || []).filter((l) => !edge || edge === '*' || l.edge === edge || l.edge === '*'), proposedLessonsNote: r.proposedLessonsNote || null };
  },

  // The decision policy measured against taking every setup (the generated eval.json), train pool only
  async evaluation(X) { const e = typeof X.data.evaluation === 'function' ? await X.data.evaluation() : null; return isObj(e) ? { available: true, evaluation: e } : { available: false, note: 'the evaluation is not generated yet' }; },

  // What the offline training service produced (ml/models/index.json): every scorer with its walk-forward numbers and verdict.
  // These are files, not the registry: a scorer is only ever used after the owner registers and promotes it (get=models).
  async training(X) {
    const t = typeof X.data.training === 'function' ? await X.data.training() : null; if (!isObj(t) || !Array.isArray(t.models)) return { available: false, models: [], skipped: [], note: 'no training report is shipped with this build' };
    const slim = (m) => ({ id: m.id, edge: m.edge, scope: m.scope, status: m.status, verdict: m.verdict, beatsBaseline: m.beatsBaseline, promoted: m.promoted, calibrated: m.calibrated, trainRows: m.trainRows, from: m.from, to: m.to, winRate: m.winRate, netRPerTrade: m.netRPerTrade,
      features: Array.isArray(m.featureNames) ? m.featureNames.length : null, validation: m.validation, outOfFold: m.outOfFold, exam: m.exam, hash: m.hash });
    return { available: true, generated: t.generated, trainer: t.trainer, data: t.data, target: t.target, verdictRule: t.verdictRule, promotion: t.promotion, models: t.models.map(slim), skipped: t.skipped || [] };
  },

  async notebook(X) { return { notes: (await X.store.rows(K.notebook, true)).slice().reverse() }; },
  async models(X) { const m = await X.store.get(K.models, emptyModels()); return { models: m.models || [], championId: m.championId || null, history: (m.history || []).slice().reverse() }; },
  async cost(X, q, d) { return LLM.status({ env: X.env, store: X.store, now: X.now }); },
  async audit(X, q) {
    const month = q.month == null || q.month === '' ? X.iso().slice(0, 7) : /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month) ? q.month : bad('month must be YYYY-MM');
    return { month, rows: (await X.store.rows(K.audit(month), true)).slice().reverse() };
  },
};

// ---- POST ---------------------------------------------------------------------------------------------------------------
const POST = {
  // { action: 'attempt', attempt: { candidateId, edge, mode, decision, sessionId?, lessonsAvailable?, snapshotHash? }, features? }
  async attempt(X, b) {
    const a = obj(b.attempt, 'attempt'), edge = await X.edge(a.edge, 'attempt.edge'), candidateId = idOf(a.candidateId, 'attempt.candidateId'), mode = oneOf(a.mode, MODES, 'attempt.mode');
    const sessionId = idOrNull(a.sessionId, 'attempt.sessionId'), decision = decisionOf(a.decision, 'attempt.decision', X, edge, candidateId);
    const lessonsAvailable = list(a.lessonsAvailable, 500, 'attempt.lessonsAvailable', idOf), snapshotHash = textOrNull(a.snapshotHash, 80, 'attempt.snapshotHash'), features = featuresOf(b.features != null ? b.features : a.features, 'features');
    poolRule(await X.cand(edge, candidateId), mode, 'attempt');
    const kA = K.attempts(edge), kD = K.dataset(edge);
    return X.write({ att: [kA, ST.emptyRows(), CAPS.attempts], seen: [K.seen(edge), emptySeen()], ds: [kD, ST.emptyRows(), CAPS.dataset] }, ({ att, seen, ds }, at) => {
      const A = R(att, kA), D = R(ds, kD), Sn = seenOf(seen), prev = Sn.ids[candidateId] || null;
      const done = Math.max(prev ? prev.attempts || 0 : 0, A.rows.filter((r) => r.candidateId === candidateId).length);
      if (mode === 'exam' && done > 0) bad('this candidate was already decided: a test needs a setup never seen before', 409);
      const n = done + 1, row = { id: X.id('at'), candidateId, edge, sessionId, n, at, mode, decision, lessonsAvailable, snapshotHash };
      const entry = { ...(prev || {}), mode, first: (prev && prev.first) || at, last: at, attempts: n, modes: { ...((prev && prev.modes) || {}), [mode]: (((prev && prev.modes) || {})[mode] || 0) + 1 } };
      if (mode === 'blind' && !entry.blindDone) entry.blindPending = true;
      const dsRow = { id: row.id, candidateId, snapshotHash, t: decision.t, edge, edgeVersion: decision.edgeVersion, features, decision: { action: decision.action, entry: decision.entry, stop: decision.stop, target: decision.target, confidence: decision.confidence },
        modelVersion: decision.modelVersion, datasetVersion: DATASET_VERSION, mode, n, at, mentor: null, outcome: null };
      return { write: { att: { ...A, rows: A.rows.concat(row) }, seen: { ...Sn, ids: { ...Sn.ids, [candidateId]: entry } }, ds: { ...D, rows: D.rows.concat(dsRow) } },
        result: { ok: true, n, attempt: attemptView(row, entry) }, audit: { action: 'attempt', ids: [row.id, candidateId, sessionId], summary: `${edge} ${mode} attempt ${n}: ${entry.blindPending ? 'hidden until the blind answer' : decision.action}` } };
    });
  },

  // { action: 'correct', edge, correction: { attemptId, verdict, action, entry, stop, target, bias, edge, reasons, text, annotations, errorClass? } }
  async correct(X, b) {
    const edge = await X.edge(b.edge), c = obj(b.correction, 'correction'), attemptId = idOf(c.attemptId, 'correction.attemptId'), verdict = oneOf(c.verdict, VERDICTS, 'correction.verdict');
    let action = oneOfOrNull(c.action, MENTOR_ACTIONS, 'correction.action');
    if (verdict === 'change' && !action) bad('correction.action is required when the verdict is change');
    const lv = levels(c, action, 'correction', verdict === 'change'), bias = oneOfOrNull(c.bias, BIAS, 'correction.bias'), fixedEdge = c.edge == null || c.edge === '' ? null : await X.edge(c.edge, 'correction.edge');
    const reasons = [...new Set(list(c.reasons, REASONS.length, 'correction.reasons', (r, n) => oneOf(r, REASONS, n)))], body = text(c.text, 6000, 'correction.text');
    const errorClass = c.errorClass == null || c.errorClass === '' ? null : /^[a-z][a-z0-9-]{0,39}$/.test(c.errorClass) ? c.errorClass : bad('correction.errorClass must be a short lower-case name');
    const annotations = list(c.annotations, 60, 'correction.annotations', (x, n) => { obj(x, n); return { kind: oneOf(x.kind, ANNOTATIONS, `${n}.kind`), t: num(x.t, `${n}.t`), price: num(x.price, `${n}.price`), t2: numOrNull(x.t2, `${n}.t2`), price2: numOrNull(x.price2, `${n}.price2`), note: text(x.note, 400, `${n}.note`) }; });
    const kA = K.attempts(edge), kC = K.corrections(edge), kD = K.dataset(edge);
    return X.write({ att: [kA, ST.emptyRows()], seen: [K.seen(edge), emptySeen()], cor: [kC, ST.emptyRows(), CAPS.corrections], ds: [kD, ST.emptyRows(), CAPS.dataset] }, async ({ att, seen, cor, ds }, at) => {
      const A = R(att, kA), C = R(cor, kC), D = R(ds, kD);
      const attempt = A.rows.find((r) => r.id === attemptId) || (A.archives ? (await X.store.rows(kA, true)).find((r) => r.id === attemptId) : null) || bad('no such attempt for this edge', 404);
      const se = seenOf(seen).ids[attempt.candidateId]; if (attempt.mode === 'blind' && se && se.blindPending) bad('answer first: submit the blind answer before correcting the engine', 409);
      const was = { action: attempt.decision.action, entry: attempt.decision.entry, stop: attempt.decision.stop, target: attempt.decision.target };
      if (verdict === 'approve') { if (action && action !== was.action) bad('an approval cannot change the action: use the verdict change'); action = was.action; levels(lv, action, 'correction', false); }
      const row = { id: X.id('co'), attemptId, at, verdict, action, entry: lv.entry, stop: lv.stop, target: lv.target, bias, edge: fixedEdge, reasons, text: body, annotations, errorClass, candidateId: attempt.candidateId, was };
      // Layer B: the mentor's label goes in its own field; the outcome label is a different field and is never touched here
      const i = D.rows.findIndex((r) => r.id === attemptId), rows = D.rows.slice();
      if (i >= 0) rows[i] = { ...rows[i], mentor: { correctionId: row.id, at, verdict, action: expected(row), bias, reasons, errorClass } };
      return { write: { cor: { ...C, rows: C.rows.concat(row) }, ...(i >= 0 ? { ds: { ...D, rows } } : {}) }, result: { ok: true, correction: row, datasetUpdated: i >= 0 },
        audit: { action: 'correct', ids: [row.id, attemptId, attempt.candidateId], summary: `${edge} ${verdict}${action ? ` -> ${action}` : ''}${reasons.length ? ` (${reasons.join(', ')})` : ''}` } };
    });
  },

  // { action: 'lesson.save', lesson: { edge | '*', title, text, when, then, source, active? } } -> version 1
  async 'lesson.save'(X, b) {
    const l = obj(b.lesson, 'lesson'), edge = await X.edge(l.edge, 'lesson.edge', true);
    const base = { edge, title: text(l.title, 160, 'lesson.title', true), text: text(l.text, 6000, 'lesson.text'), when: whenOf(l.when, 'lesson.when'), then: thenOf(l.then, 'lesson.then'), source: sourceOf(l.source, 'lesson.source'), active: boolOrNull(l.active, 'lesson.active') !== false };
    return X.write({ les: [K.lessons, ST.emptyRows(), CAPS.lessons] }, ({ les }, at) => {
      const L = R(les, K.lessons), id = X.id('ls'), row = { id, root: id, edge: base.edge, version: 1, active: base.active, title: base.title, text: base.text, createdAt: at, updatedAt: at, when: base.when, then: base.then, source: base.source, supersedes: null, supersededBy: null, stats: zeroStats() };
      return { write: { les: { ...L, rows: L.rows.concat(row) } }, result: { ok: true, lesson: row }, audit: { action: 'lesson.save', ids: [id, base.source.attemptId, base.source.correctionId], summary: `${edge} v1: ${base.title}` } };
    });
  },

  // { action: 'lesson.revise', id, patch: { title?, text?, when?, then?, edge?, active? } } -> a new version; the old one is kept, switched off
  async 'lesson.revise'(X, b) {
    const id = idOf(b.id, 'id'), p = obj(b.patch != null ? b.patch : b.lesson, 'patch'), patch = {};
    if (p.edge != null) patch.edge = await X.edge(p.edge, 'patch.edge', true);
    if (p.title != null) patch.title = text(p.title, 160, 'patch.title', true);
    if (p.text != null) patch.text = text(p.text, 6000, 'patch.text');
    if (p.when != null) patch.when = whenOf(p.when, 'patch.when');
    if (p.then != null) patch.then = thenOf(p.then, 'patch.then');
    if (p.source != null) patch.source = sourceOf(p.source, 'patch.source');
    const active = boolOrNull(p.active, 'patch.active') !== false;
    if (!Object.keys(patch).length) bad('patch changes nothing');
    return X.write({ les: [K.lessons, ST.emptyRows(), CAPS.lessons] }, ({ les }, at) => {
      const L = R(les, K.lessons), i = L.rows.findIndex((r) => r.id === id); if (i < 0) bad('no such lesson', 404);
      const old = L.rows[i]; if (old.supersededBy) bad(`this lesson already has a newer version (${old.supersededBy}): revise that one`, 409);
      const nid = X.id('ls'), next = { ...old, ...patch, id: nid, root: old.root || old.id, version: (old.version || 1) + 1, active, createdAt: at, updatedAt: at, supersedes: old.id, supersededBy: null, stats: zeroStats() };
      const prev = { ...old, active: false, supersededBy: nid, updatedAt: at }, rows = L.rows.slice(); rows[i] = prev;
      return { write: { les: { ...L, rows: rows.concat(next) } }, result: { ok: true, lesson: next, previous: prev }, audit: { action: 'lesson.revise', ids: [nid, old.id], summary: `${next.edge} v${next.version} replaces v${old.version}: ${next.title}` } };
    });
  },

  // { action: 'lesson.deactivate', id, active? (false), reason? }
  async 'lesson.deactivate'(X, b) {
    const id = idOf(b.id, 'id'), active = boolOrNull(b.active, 'active') === true, reason = text(b.reason, 400, 'reason');
    return X.write({ les: [K.lessons, ST.emptyRows(), CAPS.lessons] }, ({ les }, at) => {
      const L = R(les, K.lessons), i = L.rows.findIndex((r) => r.id === id); if (i < 0) bad('no such lesson', 404);
      if (active && L.rows[i].supersededBy) bad('a replaced version cannot be switched back on: revise the newest version instead', 409);
      const row = { ...L.rows[i], active, updatedAt: at, ...(active ? {} : { deactivatedAt: at, deactivatedWhy: reason || null }) }, rows = L.rows.slice(); rows[i] = row;
      return { write: { les: { ...L, rows } }, result: { ok: true, lesson: row }, audit: { action: 'lesson.deactivate', ids: [id], summary: `${row.edge} v${row.version} ${active ? 'switched on' : 'switched off'}${reason ? `: ${reason}` : ''}` } };
    });
  },

  // { action: 'lesson.stats', id, inc: { applied?, replayPass?, replayFail?, examN?, examAgree?, examNetWith?, examNetWithout? } }
  async 'lesson.stats'(X, b) {
    const id = idOf(b.id, 'id'), inc = obj(b.inc, 'inc'), add = {};
    for (const k of Object.keys(inc)) { if (!STAT_KEYS.includes(k)) bad(`inc.${k.slice(0, 40).replace(CTRL, '')} is not a lesson counter`); add[k] = k.startsWith('examNet') ? (Math.abs(num(inc[k], `inc.${k}`)) <= 1000 ? inc[k] : bad(`inc.${k} is out of range`)) : intOrNull(inc[k], `inc.${k}`, 0, 1000); }
    if (!Object.keys(add).length) bad('inc is empty');
    return X.write({ les: [K.lessons, ST.emptyRows(), CAPS.lessons] }, ({ les }, at) => {
      const L = R(les, K.lessons), i = L.rows.findIndex((r) => r.id === id); if (i < 0) bad('no such lesson', 404);
      const stats = { ...zeroStats(), ...(L.rows[i].stats || {}) }; for (const k of Object.keys(add)) stats[k] = r3(stats[k] + add[k]);
      const rows = L.rows.slice(); rows[i] = { ...rows[i], stats, updatedAt: at };
      return { write: { les: { ...L, rows } }, result: { ok: true, id, stats }, audit: { action: 'lesson.stats', ids: [id], summary: Object.keys(add).map((k) => `${k} +${add[k]}`).join(', ') } };
    });
  },

  // { action: 'session.save', session: { id? (update), edge, title?, kind?, status?, candidateId?, t?, summary?, state } }
  async 'session.save'(X, b) {
    const s = obj(b.session, 'session'), isNew = s.id == null || s.id === '', id = isNew ? X.id('se') : (typeof s.id === 'string' && SID_RE.test(s.id) ? s.id : bad('session.id is not a session id'));
    const head = { edge: await X.edge(s.edge, 'session.edge'), title: text(s.title, 160, 'session.title'), kind: s.kind == null || s.kind === '' ? 'replay' : /^[a-z][a-z0-9-]{0,39}$/.test(s.kind) ? s.kind : bad('session.kind must be a short lower-case name'),
      status: s.status == null ? 'open' : oneOf(s.status, SESSION_STATUS, 'session.status'), candidateId: idOrNull(s.candidateId, 'session.candidateId'), t: numOrNull(s.t, 'session.t'), summary: text(s.summary, 400, 'session.summary') };
    const state = s.state == null ? {} : safe(obj(s.state, 'session.state'), 'session.state'), kOne = K.session(id);
    return X.write({ idx: [K.sessions, ST.emptyRows(), CAPS.sessions], one: [kOne, null] }, ({ idx, one }, at) => {
      const I = R(idx, K.sessions), i = I.rows.findIndex((r) => r.id === id);
      if (!isNew && !one) bad('no such session', 404);
      const row = { id, ...head, createdAt: (one && one.createdAt) || at, updatedAt: at, rev: ((one && one.rev) || 0) + 1 }, rows = I.rows.slice();
      if (i >= 0) rows.splice(i, 1); rows.push(row);   // the index stays ordered by last save
      return { write: { one: { ...row, state }, idx: { ...I, rows } }, result: { ok: true, session: { ...row, state } }, audit: { action: 'session.save', ids: [id, head.candidateId], summary: `${head.edge} ${head.kind} ${isNew ? 'created' : `saved (rev ${row.rev})`}${head.title ? `: ${head.title}` : ''}` } };
    });
  },

  // { action: 'seen', edge, ids: [candidate ids] | id, mode }
  async seen(X, b) {
    const edge = await X.edge(b.edge), mode = oneOf(b.mode, MODES, 'mode'), ids = [...new Set(list(b.ids != null ? b.ids : b.id != null ? [b.id] : null, 500, 'ids', idOf))];
    if (!ids.length) bad('ids is empty');
    const raw = await X.data.candidates(edge); if (raw != null) { const by = new Map(candList(raw).map((c) => [c.id, c])); for (const id of ids) poolRule(by.get(id), mode, 'seen'); }
    return X.write({ seen: [K.seen(edge), emptySeen()] }, ({ seen }, at) => {
      const Sn = seenOf(seen), next = { ...Sn.ids };
      for (const id of ids) { const p = next[id]; next[id] = { ...(p || {}), mode, first: (p && p.first) || at, last: at, attempts: (p && p.attempts) || 0 }; }
      return { write: { seen: { ...Sn, ids: next } }, result: { ok: true, marked: ids.length }, audit: { action: 'seen', ids, summary: `${edge}: ${ids.length} candidate${ids.length === 1 ? '' : 's'} shown (${mode})` } };
    });
  },

  // { action: 'exam.result', result: { edge, candidateId, lessonIds, withLessons: { action, entry, stop, target }, withoutLessons: {...}, sessionId?, attemptId? } }
  async 'exam.result'(X, b) {
    const r = obj(b.result, 'result'), edge = await X.edge(r.edge, 'result.edge'), candidateId = idOf(r.candidateId, 'result.candidateId');
    const withLessons = decisionLite(r.withLessons, 'result.withLessons'), withoutLessons = decisionLite(r.withoutLessons, 'result.withoutLessons'), lessonIds = [...new Set(list(r.lessonIds, 200, 'result.lessonIds', idOf))];
    const sessionId = idOrNull(r.sessionId, 'result.sessionId'), attemptId = idOrNull(r.attemptId, 'result.attemptId'), cand = await X.cand(edge, candidateId), kE = K.exams(edge);
    poolRule(cand, 'exam', 'exam.result');
    return X.write({ ex: [kE, ST.emptyRows(), CAPS.exams], seen: [K.seen(edge), emptySeen()] }, async ({ ex, seen }, at) => {
      const E = R(ex, kE), Sn = seenOf(seen), p = Sn.ids[candidateId];
      if (E.rows.some((x) => x.candidateId === candidateId) || (E.archives && (await X.store.rows(kE, true)).some((x) => x.candidateId === candidateId))) bad('this candidate already has a test result', 409);
      const row = { id: X.id('ex'), at, edge, candidateId, side: cand && (cand.side === 'buy' || cand.side === 'sell') ? cand.side : null, t: cand && typeof cand.t === 'number' ? cand.t : null, lessonIds, withLessons, withoutLessons, sessionId, attemptId };
      return { write: { ex: { ...E, rows: E.rows.concat(row) }, seen: { ...Sn, ids: { ...Sn.ids, [candidateId]: { ...(p || {}), mode: 'exam', first: (p && p.first) || at, last: at, attempts: (p && p.attempts) || 0 } } } },
        result: { ok: true, result: row }, audit: { action: 'exam.result', ids: [row.id, candidateId, attemptId], summary: `${edge} test: ${withLessons.action} with ${lessonIds.length} lesson${lessonIds.length === 1 ? '' : 's'}, ${withoutLessons.action} without` } };
    });
  },

  // { action: 'blind.submit', blind: { edge, candidateId, action: BUY|SELL|WAIT, entry, stop, target, bias?, text?, confidence? } }
  // The mentor's answer is stored first; only then is the engine's stored decision (its blind attempt) given back.
  async 'blind.submit'(X, b) {
    const m = obj(b.blind, 'blind'), edge = await X.edge(m.edge, 'blind.edge'), candidateId = idOf(m.candidateId, 'blind.candidateId');
    const mentor = { ...decisionLite(m, 'blind', MENTOR_ACTIONS), bias: oneOfOrNull(m.bias, BIAS, 'blind.bias'), text: text(m.text, 6000, 'blind.text') }, kA = K.attempts(edge);
    return X.write({ bl: [K.blind, ST.emptyRows(), CAPS.blind], att: [kA, ST.emptyRows()], seen: [K.seen(edge), emptySeen()] }, async ({ bl, att, seen }, at) => {
      const B = R(bl, K.blind), Sn = seenOf(seen), p = Sn.ids[candidateId];
      if (B.rows.some((x) => x.edge === edge && x.candidateId === candidateId) || (p && p.blindDone)) bad('the blind answer for this candidate is already stored', 409);
      const eng = R(att, kA).rows.filter((x) => x.candidateId === candidateId && x.mode === 'blind').pop() || null;
      const row = { id: X.id('bl'), at, edge, candidateId, mentor, attemptId: eng ? eng.id : null, agree: eng ? eng.decision.action === mentor.action : null };
      const entry = { ...(p || {}), mode: 'blind', first: (p && p.first) || at, last: at, attempts: (p && p.attempts) || 0, blindDone: true, blindPending: false };
      return { write: { bl: { ...B, rows: B.rows.concat(row) }, seen: { ...Sn, ids: { ...Sn.ids, [candidateId]: entry } } }, result: { ok: true, blind: row, engine: eng ? eng.decision : null, engineAttemptId: eng ? eng.id : null },
        audit: { action: 'blind.submit', ids: [row.id, candidateId, row.attemptId], summary: `${edge} blind: mentor ${mentor.action}${eng ? `, engine ${eng.decision.action}` : ', no engine answer stored yet'}` } };
    });
  },

  // { action: 'notebook.add', note: { title, hypothesis, dataset, sampleSize, method, results, limitations, validation, reproducibility, edge?, tags? } }
  async 'notebook.add'(X, b) {
    const n = obj(b.note, 'note'), validation = oneOf(n.validation, VALIDATION, 'note.validation'), sampleSize = intOrNull(n.sampleSize, 'note.sampleSize', 0, 1e9);
    if ((validation === 'out-of-sample' || validation === 'validated') && !(sampleSize > 0)) bad('note.sampleSize is required for an out-of-sample or validated result (never an edge without n)');
    const note = { title: text(n.title, 160, 'note.title', true), hypothesis: text(n.hypothesis, 4000, 'note.hypothesis', true), dataset: text(n.dataset, 2000, 'note.dataset', true), sampleSize, method: text(n.method, 4000, 'note.method', true),
      results: text(n.results, 6000, 'note.results'), limitations: text(n.limitations, 4000, 'note.limitations'), validation, reproducibility: text(n.reproducibility, 2000, 'note.reproducibility'),
      edge: n.edge == null || n.edge === '' ? null : await X.edge(n.edge, 'note.edge', true), tags: [...new Set(list(n.tags, 12, 'note.tags', (x, m) => text(x, 40, m, true)))] };
    return X.write({ nb: [K.notebook, ST.emptyRows(), CAPS.notebook] }, ({ nb }, at) => {
      const N = R(nb, K.notebook), row = { id: X.id('nb'), at, ...note };
      return { write: { nb: { ...N, rows: N.rows.concat(row) } }, result: { ok: true, note: row }, audit: { action: 'notebook.add', ids: [row.id], summary: `${validation}: ${note.title}` } };
    });
  },

  // { action: 'model.register', model: { name, version, kind?, edge?, status?: baseline|challenger, metrics, datasetVersion?, trainedOn?, artifact?, hash?, notes? } }
  // A registry only. Nothing is ever promoted here: a model becomes champion only through model.promote, by the owner.
  async 'model.register'(X, b) {
    const m = obj(b.model, 'model'); if (m.status === 'champion') bad('a model becomes champion only through model.promote');
    const metrics = {}; if (m.metrics != null) { obj(m.metrics, 'model.metrics'); const ks = Object.keys(m.metrics); if (ks.length > 60) bad('model.metrics: 60 values at most'); for (const k of ks) { if (!KEY_NAME.test(k)) bad(`model.metrics: "${k.slice(0, 40).replace(CTRL, '')}" is not a metric name`); metrics[k] = typeof m.metrics[k] === 'string' ? text(m.metrics[k], 80, `model.metrics.${k}`) : numOrNull(m.metrics[k], `model.metrics.${k}`); } }
    const model = { name: text(m.name, 80, 'model.name', true), version: text(m.version, 40, 'model.version', true), kind: text(m.kind, 40, 'model.kind'), edge: m.edge == null || m.edge === '' ? null : await X.edge(m.edge, 'model.edge', true),
      status: m.status == null ? 'challenger' : oneOf(m.status, MODEL_STATUS, 'model.status'), metrics, datasetVersion: textOrNull(m.datasetVersion, 40, 'model.datasetVersion'), trainedOn: m.trainedOn == null ? null : safe(obj(m.trainedOn, 'model.trainedOn'), 'model.trainedOn', 7),
      artifact: textOrNull(m.artifact, 200, 'model.artifact'), hash: textOrNull(m.hash, 80, 'model.hash'), notes: text(m.notes, 2000, 'model.notes') };
    return X.write({ md: [K.models, emptyModels()] }, ({ md }, at) => {
      const M = { ...emptyModels(), ...md }; if (M.models.some((x) => x.name === model.name && x.version === model.version)) bad('this model version is already registered', 409);
      const row = { id: X.id('md'), ...model, createdAt: at, updatedAt: at };
      return { write: { md: { ...M, models: M.models.concat(row) } }, result: { ok: true, model: row }, audit: { action: 'model.register', ids: [row.id], summary: `${model.name} ${model.version} registered as ${model.status}` } };
    });
  },

  // { action: 'model.promote', id, confirm: true, reason? }   an explicit owner action, never automatic
  async 'model.promote'(X, b) {
    const id = idOf(b.id, 'id'), reason = text(b.reason, 400, 'reason'); if (b.confirm !== true) bad('promotion is an explicit owner action: send confirm: true');
    return X.write({ md: [K.models, emptyModels()] }, ({ md }, at) => {
      const M = { ...emptyModels(), ...md }, m = M.models.find((x) => x.id === id) || bad('no such model', 404);
      if (m.status === 'champion') bad('this model is already the champion', 409); if (m.status !== 'challenger') bad('only a challenger can be promoted');
      const prev = M.championId || null, models = M.models.map((x) => (x.id === id ? { ...x, status: 'champion', promotedAt: at, updatedAt: at } : x.id === prev ? { ...x, status: 'challenger', updatedAt: at } : x));
      return { write: { md: { ...M, models, championId: id, promotions: (M.promotions || []).concat({ at, id, prev }).slice(-100), history: (M.history || []).concat({ at, who: X.who, action: 'promote', id, prev, reason }).slice(-300) } },
        result: { ok: true, championId: id, previousChampionId: prev, model: models.find((x) => x.id === id) }, audit: { action: 'model.promote', ids: [id, prev], summary: `${m.name} ${m.version} promoted to champion${reason ? `: ${reason}` : ''}` } };
    });
  },

  // { action: 'model.rollback', confirm: true, reason? }   undoes the last promotion
  async 'model.rollback'(X, b) {
    const reason = text(b.reason, 400, 'reason'); if (b.confirm !== true) bad('a rollback is an explicit owner action: send confirm: true');
    return X.write({ md: [K.models, emptyModels()] }, ({ md }, at) => {
      const M = { ...emptyModels(), ...md }, stack = (M.promotions || []).slice(), last = stack.pop() || bad('nothing to roll back: no promotion is recorded', 409);
      const back = last.prev && M.models.some((x) => x.id === last.prev) ? last.prev : null;
      const models = M.models.map((x) => (x.id === last.id ? { ...x, status: 'challenger', updatedAt: at } : x.id === back ? { ...x, status: 'champion', updatedAt: at } : x));
      return { write: { md: { ...M, models, championId: back, promotions: stack, history: (M.history || []).concat({ at, who: X.who, action: 'rollback', id: last.id, prev: back, reason }).slice(-300) } },
        result: { ok: true, championId: back, rolledBack: last.id }, audit: { action: 'model.rollback', ids: [last.id, back], summary: `champion rolled back${back ? ' to the previous one' : ': no champion now'}${reason ? `: ${reason}` : ''}` } };
    });
  },

  // { action: 'explain', question, context? }   commentary from the optional language model; never a made-up answer
  async explain(X, b, d) {
    const question = text(b.question, 2000, 'question', true), ctx = b.context == null ? null : safe(b.context, 'context');
    const why = LLM.unavailable(LLM.config(X.env)); if (why) return { ok: true, available: false, reason: why };
    const ctxText = ctx == null ? '' : JSON.stringify(ctx); if (ctxText.length > 16000) bad('context is too large (16,000 characters at most)');
    const system = 'You explain a paper-trading apprentice\'s recorded decision to its mentor in plain English. Use only the facts in the context. Never invent prices, statistics or outcomes, and never give a trade instruction. If the context does not answer the question, say so. Keep it under 180 words.';
    const out = await LLM.complete({ system, prompt: `${question}${ctxText ? `\n\nContext (JSON):\n${ctxText}` : ''}`, maxTokens: intOrNull(b.maxTokens, 'maxTokens', 16, 4000) }, { env: X.env, store: X.store, fetch: d.fetch, now: X.now });
    if (!out.available) return { ok: true, ...out };
    await X.write({}, () => ({ audit: { action: 'explain', ids: [], summary: out.text != null ? (out.cached ? 'answered from the cache (no cost)' : `answered, cost $${(out.costUsd || 0).toFixed(4)}`) : out.skipped ? `skipped: ${out.skipped}${out.scope ? ` (${out.scope})` : ''}` : 'the call failed' } }));
    return { ok: true, ...out };
  },
};

// ---- the handler ----------------------------------------------------------------------------------------------------------
function queryOf(req) {
  let q = req.query; if (!isObj(q)) { try { q = Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams); } catch (e) { q = {}; } }
  const o = {}; for (const k of Object.keys(q)) { const v = Array.isArray(q[k]) ? q[k][0] : q[k]; if (typeof v === 'string') o[k] = v.slice(0, 400); } return o;
}
function bodyOf(req) {
  if (Number(req.headers && req.headers['content-length']) > MAX_BODY) bad('the body is too large (256 KB at most)', 413);
  let b; try { b = req.body; } catch (e) { bad('bad JSON'); }
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') { if (Buffer.byteLength(b) > MAX_BODY) bad('the body is too large (256 KB at most)', 413); try { b = JSON.parse(b || 'null'); } catch (e) { bad('bad JSON'); } }
  else if (b && typeof b === 'object' && Buffer.byteLength(JSON.stringify(b)) > MAX_BODY) bad('the body is too large (256 KB at most)', 413);
  return isObj(b) ? b : bad('the body must be a JSON object');
}
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'GET or POST' }); }
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env))))(req);
    if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (acct.u !== 'owner') return res.status(403).json({ error: 'the Academy is for the owner only' });
    const X = context(req, d, env, acct);
    if (req.method === 'GET') {
      const q = queryOf(req), fn = Object.prototype.hasOwnProperty.call(GET, q.get || '') ? GET[q.get] : null;
      if (!fn) bad(`unknown get: use one of ${Object.keys(GET).join(', ')}`);
      return res.status(200).json(await fn(X, q, d));
    }
    const b = bodyOf(req), fn = typeof b.action === 'string' && Object.prototype.hasOwnProperty.call(POST, b.action) ? POST[b.action] : null;
    if (!fn) bad(`unknown action: use one of ${Object.keys(POST).join(', ')}`);
    return res.status(200).json(await fn(X, b, d));
  } catch (e) {
    if (e instanceof Bad) return res.status(e.status).json({ error: e.message });
    if (e && e.store) return res.status(503).json({ error: 'the Academy store is unavailable: nothing was saved' });
    return res.status(e && e.status === 503 ? 503 : 500).json({ error: 'the Academy is unavailable' });
  }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports._t = { GET, POST, CAPS, EDGE_IDS, DATASET_VERSION, fileData, weekOf, gradeR, expected, safe, decisionLite };
