// The owner's demo-account settings (27 Nov 2026, owner: "In my profile make me available to manage the demo account settings
// risk, assign strategies etc"). The Profile card "Demo accounts: settings" reads and saves them here.
//   GET  /api/demo-settings                 the owner's session: { settings, current, accounts, books, jobs, canWrite }
//   POST /api/demo-settings { settings }    the owner's session, same origin: checks every field (api/_demo-settings.js clean)
//                                            and writes council-data owner/demo-settings.json; the council reads it on its next
//                                            round and quick pass (council/owner-config.mjs)
// The file is written through the GitHub contents API with the Worker's GH_MCP_TOKEN, else GH_TOKEN (Contents: write on this
// repository). Without one the card says so and saves nothing. Demo only: the live account's code never reads the file, and the
// mirror and the demo jobs still refuse any account whose isLive is true. Nothing here moves or removes a stop.
'use strict';
const S = require('./_session.js');
const DS = require('./_demo-settings.js');
const { readFile } = require('./data.js');
const REPO = 'vazxanana/macro-dashboard', BRANCH = 'council-data';
const scrub = (e) => String(e && e.message || e).replace(/gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/g, '***').replace(/Bearer\s+\S+/g, 'Bearer ***').slice(0, 200);
const writeTok = (env) => env.GH_MCP_TOKEN || env.GH_TOKEN || '';

async function json(p, env, f) { try { const r = await readFile(p, env, f); return r.ok ? JSON.parse(r.buf.toString('utf8')) : null; } catch (e) { return null; } }
// the demo accounts the owner can pick: the mirror's accounts (its own file names the account ids and their books), with the
// label, the last digits of the login and the balance from the account snapshot; a live account is never listed
function accountsOf(groups, snaps) {
  const S2 = (snaps && Array.isArray(snaps.accounts)) ? snaps.accounts : [];
  return (groups && Array.isArray(groups.groups) ? groups.groups : []).map((g) => {
    const sn = S2.find((x) => Array.isArray(x.books) && Array.isArray(g.books) && x.books.join() === g.books.join()) || null, a = sn && sn.account || {};
    if (a.live === true) return null;
    return { id: String(g.account), books: g.books || [], login: a.login || null, label: (sn && sn.label) || null, balance: sn && Number.isFinite(+sn.balance) ? +sn.balance : null, currency: a.currency || null, drain: !!g.drain };
  }).filter(Boolean);
}
async function writeSettings(env, body, f) {
  const tok = writeTok(env); if (!tok) { const e = new Error('the site has no GitHub token that can write the council\'s data (GH_MCP_TOKEN or GH_TOKEN, Contents: write)'); e.status = 503; throw e; }
  const u = `https://api.github.com/repos/${REPO}/contents/${DS.PATH.split('/').map(encodeURIComponent).join('/')}`;
  const H = { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aureum-demo-settings' };
  for (let i = 0; i < 2; i++) {
    const cur = await f(`${u}?ref=${BRANCH}`, { headers: H, signal: AbortSignal.timeout(10000) });
    if (!cur.ok && cur.status !== 404) { const e = new Error(`GitHub ${cur.status} reading the settings file`); e.status = cur.status === 401 || cur.status === 403 ? 503 : 502; throw e; }
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const r = await f(u, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ message: 'Owner: demo account settings (Profile)', branch: BRANCH, content: Buffer.from(JSON.stringify(body, null, 1)).toString('base64'), ...(sha ? { sha } : {}) }) });
    if (r.ok) return;
    if (r.status === 409 || r.status === 422) continue;   // the file moved in between: read it again once
    const e = new Error(r.status === 401 || r.status === 403 || r.status === 404 ? 'the site\'s GitHub token may not write the council\'s data (it needs Contents: write on this repository)' : `GitHub ${r.status} saving the settings`); e.status = r.status === 401 || r.status === 403 || r.status === 404 ? 503 : 502; throw e;
  }
  const e = new Error('the settings file moved twice while saving; try again'); e.status = 409; throw e;
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env, f = d.fetch || fetch; res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await (d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env))))(req);
    if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (acct.u !== 'owner') return res.status(403).json({ error: 'only the owner manages the demo accounts' });
    if (req.method === 'GET') {
      const [settings, config, groups, snaps] = await Promise.all([DS.PATH, 'config.json', 'ctrader/mirror-accounts.json', 'ctrader/accounts.json'].map((p) => json(p, env, f)));
      const C = config || {}, jobs = {}; for (const k of Object.keys(DS.JOBS)) { const c = C[k] && typeof C[k] === 'object' ? C[k] : {}; jobs[k] = { on: c.on !== false, account: c.account ? String(c.account) : '', risk: Number.isFinite(+c.risk) && c.risk != null ? +c.risk : null, ...(DS.JOBS[k].uj ? { ujRisk: Number.isFinite(+c.ujRisk) && c.ujRisk != null ? +c.ujRisk : null } : {}) }; }
      const map = {}; for (const g of (groups && groups.groups) || []) for (const b of g.books || []) map[b] = String(g.account);
      return res.status(200).json({ settings: settings || { v: 1, books: {}, jobs: {} }, current: { books: map, jobs }, accounts: accountsOf(groups, snaps),
        books: DS.BOOKS, jobs: DS.JOBS, riskMin: DS.RISK_MIN, bookMin: DS.BOOK_MIN, bookMax: DS.BOOK_MAX, canWrite: !!writeTok(env) });
    }
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    let clean; try { clean = DS.clean(b && b.settings); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    clean.at = new Date(d.now || Date.now()).toISOString();
    await (d.write || writeSettings)(env, clean, f);
    return res.status(200).json({ ok: true, settings: clean });
  } catch (e) {
    return res.status(e && e.status && e.status < 600 ? e.status : 500).json({ error: e && e.status ? e.message : 'could not reach the council\'s data' + (d.debug ? ': ' + scrub(e) : '') });
  }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.accountsOf = accountsOf;
