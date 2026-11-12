// The edge analyst endpoint (11 Nov 2026; the logic is api/_edge-analyst.js, which explains what it is).
//   GET /api/edge-analyst?job=scan   Vercel cron (Authorization: Bearer CRON_SECRET): put closed results beside earlier answers,
//                                    then study up to 3 new live entries of the seven edges. Writes only its own store files.
//   GET /api/edge-analyst            owner or reviewer session -> { enabled, reason, cost, since, rows, stats }
// Store: the private Blob store, folder edge-analyst/ (edge-analyst-preview/ off production): reviews.json, state.json, and the
// language-model adapter's own cost.json + llm-cache.json there (never the Academy's).
// Environment:
//   the model: ACADEMY_LLM_KEY / _URL / _MODEL / _FORMAT and the rest of the adapter's settings (docs/academy/LLM.md, section 3)
//   EDGE_LLM_DAILY_USD (default 0.50), EDGE_LLM_MONTHLY_USD (5), EDGE_LLM_HARD_USD (25), EDGE_LLM_MAX_CALLS_DAY (12): this
//   feature's own budgets; EDGE_ANALYST=off or EDGE_LLM_STOP=1 stops every call. OANDA_TOKEN for the candles.
'use strict';
const S = require('./_session.js');
const G = require('./_guard.js');
const LLM = require('./_academy-llm.js');
const ST = require('./_academy-store.js');
const E = require('./_edge-analyst.js');

const ROWS = 'reviews.json', STATE = 'state.json', KEEP = 400;
const rootOf = (env) => (env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'edge-analyst-preview/' : 'edge-analyst/');
const storeOf = (env) => ST.make(ST.blobBackend(env, { root: rootOf(env) }));
// the adapter reads ACADEMY_LLM_* : the key, endpoint and model are shared, the budgets are this feature's own
function llmEnv(env) {
  return { ...env, ACADEMY_LLM_DAILY_USD: env.EDGE_LLM_DAILY_USD || '0.5', ACADEMY_LLM_MONTHLY_USD: env.EDGE_LLM_MONTHLY_USD || '5', ACADEMY_LLM_HARD_USD: env.EDGE_LLM_HARD_USD || '25',
    ACADEMY_LLM_MAX_CALLS_DAY: env.EDGE_LLM_MAX_CALLS_DAY || '12', ACADEMY_LLM_STOP: /^(1|true|yes|on)$/i.test(String(env.EDGE_LLM_STOP || '')) || /^off$/i.test(String(env.EDGE_ANALYST || '')) ? '1' : '' };
}

// one council-data JSON file (null when missing; a failed read throws)
async function cdata(d, p) {
  const r = await (d.readFile || require('./data.js').readFile)(p, d.env, d.fetch || fetch);
  if (r.status === 404) return null; if (!r.ok) throw new Error(`council-data ${p}: ${r.status}`);
  return JSON.parse(r.buf.toString('utf8'));
}
// closed and forming candles of one timeframe ending at `to` (the forming one is dropped later by the cut)
async function candles(d, inst, gran, sec, n, to) {
  const env = d.env, tok = env.OANDA_TOKEN; if (!tok) throw new Error('OANDA_TOKEN not set');
  const host = env.OANDA_ENV === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com';
  const p = new URLSearchParams({ granularity: gran, price: 'M', dailyAlignment: '0', alignmentTimezone: 'Etc/UTC', count: String(n + 3), to: String(to) });
  const r = await (d.fetch || fetch)(`https://${host}/v3/instruments/${inst}/candles?${p}`, { headers: { Authorization: `Bearer ${tok}`, 'Accept-Datetime-Format': 'UNIX' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`OANDA ${r.status}`);
  const j = await r.json();
  return (j.candles || []).filter((c) => c.mid).map((c) => ({ time: Math.floor(+c.time), open: +c.mid.o, high: +c.mid.h, low: +c.mid.l, close: +c.mid.c, complete: !!c.complete }));
}

async function scan(d) {
  const env = d.env, store = d.store, now = Math.floor((d.now ? d.now() : Date.now()) / 1000), out = { results: 0, studied: [], skipped: [] };
  const [trades, research, forecast] = await Promise.all([cdata(d, 'trades.json'), cdata(d, 'research.json'), cdata(d, 'macro/forecast.json').catch(() => null)]);
  const all = (Array.isArray(trades) ? trades : []).concat(Array.isArray(research) ? research : []), byId = new Map(all.filter((x) => x && x.id).map((x) => [x.id, x]));
  let state = await store.get(STATE, null);
  if (!state || !state.since) { state = { since: now }; await store.put(STATE, state); }   // first run: only entries from now on
  // 1. results beside earlier answers
  await store.update(ROWS, { v: 1, rows: [] }, (doc) => {
    const rows = Array.isArray(doc && doc.rows) ? doc.rows : [];
    for (const row of rows) if (!row.result) { const res = E.resultOf(byId.get(row.id)); if (res) { row.result = res; out.results++; } }
    return { v: 1, rows };
  });
  // 2. new entries
  const C = LLM.config(llmEnv(env)), off = LLM.unavailable(C);
  if (off) return { ...out, off };
  const doc = await store.get(ROWS, { v: 1, rows: [] }), done = (doc.rows || []).map((x) => x.id);
  const todo = E.candidates(Array.isArray(trades) ? trades : [], Array.isArray(research) ? research : [], done, now, state.since).slice(0, E.PER_RUN);
  for (const x of todo) {
    const t = E.entryT(x), bars = {};
    try { for (const [lab, gran, sec, n] of E.FRAMES) bars[lab] = await candles(d, E.INST[x.market], gran, sec, n, t); }
    catch (e) { out.skipped.push({ id: x.id, why: String(e.message || e).slice(0, 80) }); continue; }   // tried again next run (within 3 days)
    const q = E.buildRequest(x, bars, forecast && forecast.playbook);
    const ans = await (d.complete || LLM.complete)({ system: q.system, prompt: q.prompt, cap: 'analyst', maxTokens: 900 }, { env: llmEnv(env), store, now: d.now });
    if (!ans || !ans.available || ans.skipped || ans.error) { out.skipped.push({ id: x.id, why: ans && (ans.skipped ? `budget: ${ans.scope || ans.skipped}` : ans.error || ans.reason) }); if (ans && ans.skipped === 'budget') break; continue; }
    const p = E.parseAnswer(ans.text), f = q.payload.trade;
    const row = { id: x.id, k: x.k, system: f.system, market: x.market, side: x.side, entryAt: f.entryTimeUtc, entry: f.entry, stop: f.stop, target: f.target,
      at: new Date(now * 1000).toISOString(), provider: ans.provider || null, model: ans.model || null, costUsd: ans.costUsd || 0,
      ...(p.ok ? { answer: p.answer } : { refused: p.why }), result: E.resultOf(x) };
    await store.update(ROWS, { v: 1, rows: [] }, (D) => { const rows = (Array.isArray(D && D.rows) ? D.rows : []).filter((y) => y.id !== row.id).concat(row); return { v: 1, rows: rows.slice(-KEEP) }; });
    out.studied.push({ id: x.id, verdict: p.ok ? p.answer.verdict : 'refused' });
  }
  return out;
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || storeOf(env), q = req.query || {}, dd = { ...d, env, store };
  try {
    if (q.job === 'scan') {
      if (!G.bearerOk(req.headers && req.headers.authorization, env.CRON_SECRET)) return res.status(401).json({ error: 'unauthorised' });
      return res.status(200).json(await scan(dd));
    }
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })))(req);
    if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (acct.u !== 'owner' && acct.role !== 'reviewer') return res.status(403).json({ error: 'not for this account' });
    const [doc, state, cost] = await Promise.all([store.get(ROWS, { v: 1, rows: [] }), store.get(STATE, null), LLM.status({ env: llmEnv(env), store })]);
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    return res.status(200).json({ enabled: cost.enabled && !/^off$/i.test(String(env.EDGE_ANALYST || '')), reason: cost.reason || (/^off$/i.test(String(env.EDGE_ANALYST || '')) ? 'switched off (EDGE_ANALYST=off)' : null),
      cost: { today: cost.today.usd, month: cost.month.usd, total: cost.total.usd, budgets: cost.budgets, callsLeftToday: cost.calls.leftToday },
      since: state && state.since ? new Date(state.since * 1000).toISOString() : null, rows: rows.slice(-60).reverse(), stats: E.stats(rows) });
  } catch (e) { return res.status(e && e.status === 503 ? 503 : 500).json({ error: 'edge analyst unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.scan = scan;
module.exports.llmEnv = llmEnv;
