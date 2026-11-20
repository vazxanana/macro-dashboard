// The daily reports' delivery (19 Nov 2026, owner: "daily reports every 6:30 am, everyone will get notification … (those who got
// macro activated)"; "add the 6:30 email too"; "use AI to do the daily brief").
//   GET /api/daily?job=daily     the Worker's 10-minute cron (Bearer CRON_SECRET). Inside the publish window (06:30 London to
//        3 h later) for the latest report of council-data macro/daily-report.json (council/daily-report.mjs), once each:
//        (1) the AI summary, when the language-model adapter is switched on (api/_academy-llm.js; this feature's own budgets
//            DAILY_LLM_DAILY_USD 0.5 / _MONTHLY_USD 5 / _HARD_USD 25 / _MAX_CALLS_DAY 2, model DAILY_LLM_MODEL else
//            ACADEMY_LLM_MODEL else CHRONOS_LLM_MODEL; key DAILY_LLM_KEY, ACADEMY_LLM_KEY, ANTHROPIC_API_KEY or CLAUDE_API_KEY; DAILY_AI=off stops it), checked in code (api/_daily.js parseBrief: every figure must be in the
//            report, no advice, stops or claims of certainty) and stored; a refused or failed one leaves the reports without it;
//        (2) the notice in the desk's bell, for accounts with the macro permission (api/notify.js dailyNotice);
//        (3) the email to the owner (OWNER_EMAIL, else GMAIL_USER) and every stored member with an email and macro on, through
//            the sign-up senders (api/signup.js mailer); DAILY_EMAIL=off stops it. Addresses are never logged or returned.
//   GET /api/daily?brief=1       a signed-in account with macro on: the latest AI summary (for the Macro desk) or { brief: null }
//   GET /api/daily?test=email[&to=address]   the OWNER's session only: sends the latest report now, marked "Test", to `to` (else
//        the owner's address); at most 5 in 10 minutes. Nothing is marked as sent.
const S = require('./_session.js');
const G = require('./_guard.js');
const A = require('./_accounts.js');
const N = require('./notify.js');
const D = require('./_daily.js');
const LLM = require('./_academy-llm.js');
const ST = require('./_academy-store.js');

const WINDOW = 3 * 3600e3, MAX_OUT = 3000, TAILS = new Map(), TESTS = [];
const storeOf = (env, io = {}) => ST.make(ST.blobBackend(env, { ...io, root: env.VERCEL_ENV && env.VERCEL_ENV !== 'production' ? 'daily-preview/' : 'daily/' }), TAILS);
const off = (v) => /^off$/i.test(String(v || ''));
// the provider settings: this feature's own, else the shared adapter's, else a key the owner saved under another usual name
// (owner, 20 Nov 2026: "re use from other variable"); a provider-named key with no address of its own gets that provider's
// messages endpoint and format
const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'], PROVIDER_URL = 'https://api.anthropic.com/v1/messages';
function llmEnv(env) {
  const own = env.DAILY_LLM_KEY || env.ACADEMY_LLM_KEY, alt = PROVIDER_KEYS.map((k) => env[k]).find(Boolean), key = own || alt || '';
  const url = env.DAILY_LLM_URL || env.ACADEMY_LLM_URL || (!own && alt ? PROVIDER_URL : '');
  const format = env.DAILY_LLM_FORMAT || env.ACADEMY_LLM_FORMAT || (!own && alt ? 'messages' : '');
  return { ...env, ACADEMY_LLM_KEY: key, ACADEMY_LLM_URL: url, ACADEMY_LLM_FORMAT: format, ACADEMY_LLM_MODEL: env.DAILY_LLM_MODEL || env.ACADEMY_LLM_MODEL || env.CHRONOS_LLM_MODEL,
    ACADEMY_LLM_DAILY_USD: env.DAILY_LLM_DAILY_USD || '0.5', ACADEMY_LLM_MONTHLY_USD: env.DAILY_LLM_MONTHLY_USD || '5',
    ACADEMY_LLM_HARD_USD: env.DAILY_LLM_HARD_USD || '25', ACADEMY_LLM_MAX_CALLS_DAY: env.DAILY_LLM_MAX_CALLS_DAY || '2', ACADEMY_LLM_STOP: off(env.DAILY_AI) || /^(1|true|yes|on)$/i.test(String(env.DAILY_LLM_STOP || '')) ? '1' : '' };
}
async function latest(env, d) {
  const f = await (d.readFile || require('./data.js').readFile)('macro/daily-report.json', env, d.fetch || fetch);
  if (!f || !f.ok) return null; let j; try { j = JSON.parse(f.buf.toString('utf8')); } catch (e) { return null; }
  const r = j && Array.isArray(j.reports) && j.reports[0]; return r && r.world && r.markets && r.publishAt ? r : null;
}
// the AI summary for a report: stored once per day (a refused billed answer too, so it is never paid twice)
async function brief(rep, env, store, d) {
  const K = `brief-${rep.day}.json`, have = await store.get(K, null); if (have) return have;
  const C = LLM.config(llmEnv(env)); if (LLM.unavailable(C) || off(env.DAILY_AI)) return null;
  const q = D.briefRequest(rep);
  const ans = LLM.cutAtCap(await (d.complete || LLM.complete)({ system: q.system, prompt: q.prompt, cap: 'feature', maxTokens: LLM.featureCap(env.DAILY_LLM_MAX_TOKENS, MAX_OUT), long: true }, { env: llmEnv(env), store, now: d.now }), 'DAILY_LLM_MAX_TOKENS');
  const billed = !!(ans && ans.available && ans.error && (ans.usage || ans.costEstimated || ans.costUsd > 0));
  if (!billed && (!ans || !ans.available || ans.skipped || ans.error)) return null;   // a budget skip or an unbilled error: tried again next run
  const p = billed ? { ok: false, why: String(ans.error).slice(0, 120) } : D.parseBrief(ans.text, rep);
  const doc = { day: rep.day, at: new Date(d.now ? d.now() : Date.now()).toISOString(), costUsd: ans.costUsd || 0, ...(p.ok ? { brief: p.brief } : { refused: p.why }) };
  await store.put(K, doc); return doc;
}
async function send(rep, br, to, env, d, o = {}) {
  const sendFn = d.send || require('./signup.js').mailer(env, {}); if (!sendFn) return { ok: 0, failed: to.length, why: 'no mail sender is set up' };
  const m = D.emailOf(rep, br && br.brief, o); let ok = 0, failed = 0;
  for (const addr of to) { try { await sendFn(addr, m.subject, m.text, m.html); ok++; } catch (e) { failed++; } }
  return { ok, failed };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env, now = d.now ? d.now() : Date.now(), q = req.query || {};
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const store = d.store || storeOf(env), notices = d.notices || N.blobStore(env);
  if (q.job === 'daily') {
    if (!G.bearerOk(req.headers && req.headers.authorization, env.CRON_SECRET)) return res.status(401).json({ error: 'unauthorised' });
    try {
      const rep = await latest(env, d); if (!rep) return res.status(200).json({ ok: true, why: 'no report' });
      const pub = Date.parse(rep.publishAt); if (!(pub <= now) || now - pub > WINDOW) return res.status(200).json({ ok: true, why: 'outside the publish window' });
      const out = { ok: true, day: rep.day };
      const br = await brief(rep, env, store, d).catch(() => null); out.ai = br ? (br.brief ? 'written' : 'refused') : 'off';
      const list = await notices.get(), item = N.dailyNotice({ reports: [rep] }, list, now);
      if (item) { await notices.put(list.concat(item).slice(-100)); out.notice = item.id; }
      const state = (await store.get('state.json', null)) || {};
      if (state.mailed !== rep.day && !off(env.DAILY_EMAIL)) {
        await store.put('state.json', { ...state, mailed: rep.day, mailedAt: new Date(now).toISOString() });   // marked first: a crash mid-way never sends twice
        const users = await A.userList(S.defaultDeps(env)).catch(() => ({}));
        const r = await send(rep, br, D.recipients(d.users || users, env.OWNER_EMAIL || env.GMAIL_USER), env, d);
        await store.put('state.json', { ...state, mailed: rep.day, mailedAt: new Date(now).toISOString(), sent: r.ok, failed: r.failed });
        out.email = { sent: r.ok, failed: r.failed, ...(r.why ? { why: r.why } : {}) };
      }
      return res.status(200).json(out);
    } catch (e) { return res.status(500).json({ error: 'daily job failed' }); }
  }
  const who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 }));
  let acct; try { acct = await who(req); } catch (e) { return res.status(503).json({ error: 'sign-in check unavailable' }); }
  if (!acct) return res.status(401).json({ error: 'sign in first' });
  if (q.brief) {
    if (!N.allowed(acct, 'macro')) return res.status(403).json({ error: 'the Macro desk is off for this account' });
    const rep = await latest(env, d).catch(() => null); if (!rep || Date.parse(rep.publishAt) > now) return res.status(200).json({ brief: null });
    const doc = await store.get(`brief-${rep.day}.json`, null).catch(() => null);
    return res.status(200).json({ day: rep.day, brief: doc && doc.brief ? doc.brief : null });
  }
  if (q.test === 'email') {
    if (acct.u !== 'owner') return res.status(403).json({ error: 'owner only' });
    while (TESTS.length && TESTS[0] < now - 600e3) TESTS.shift(); if (TESTS.length >= 5) return res.status(429).json({ error: 'at most 5 test emails in 10 minutes' });
    const to = q.to ? D.mail(q.to) : D.mail(env.OWNER_EMAIL || env.GMAIL_USER); if (!to) return res.status(400).json({ error: q.to ? 'not an email address' : 'no owner address: pass ?to=' });
    const rep = await latest(env, d).catch(() => null); if (!rep) return res.status(404).json({ error: 'no report yet: the first one is built from 06:00 London' });
    TESTS.push(now);
    const br = await store.get(`brief-${rep.day}.json`, null).catch(() => null);
    const r = await send(rep, br, [to], env, d, { test: true });
    const err = r.ok ? null : (require('./signup.js').lastMailError() || null);
    return res.status(r.ok ? 200 : 502).json({ sent: r.ok === 1, day: rep.day, ai: !!(br && br.brief), ...(r.why ? { why: r.why } : {}), ...(err ? { tries: err.tries } : {}) });
  }
  return res.status(400).json({ error: 'nothing asked' });
}

module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.llmEnv = llmEnv;
module.exports._tests = TESTS;
