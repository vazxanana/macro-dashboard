// London Strategic Edge data, for the owner only (19 Nov 2026, owner: "build option 1"; key = Worker secret LSE_API_KEY).
// Their licence: own research, backtesting and trading are allowed; showing their data to anyone else (members, visitors, a
// public repository, the council-data branch) is distribution and needs their Enterprise licence. So this endpoint:
//   - answers the owner's session only (members, guests and the connectors get 403 / 401), GET only, never cached;
//   - reads a short preview or a list, never a download, and stores nothing;
//   - forwards only allowlisted operations and parameters, and never sends the key back or into a log line.
//   GET /api/lse?op=usage                                         → the key's plan and allowance (key name removed)
//   GET /api/lse?op=refs                                          → the reference collections (economic_calendar, cot, ...)
//   GET /api/lse?op=ref&dataset=economic_calendar[&symbol=&country=&from=&to=]  → a preview of one collection
//   GET /api/lse?op=macro&kind=observation|release|yield[&country=&q=&limit=]  → the macro catalogue
//   GET /api/lse?op=series&kind=…&code=US.core_inflation_rate     → a preview of one macro series
const S = require('./_session.js');

const BASE = 'https://download.londonstrategicedge.com';
const OPS = {
  usage: { path: '/v3/usage', params: [] },
  refs: { path: '/v3/reference', params: [] },
  ref: { path: '/v3/reference/preview', params: ['dataset', 'symbol', 'country', 'from', 'to'], need: ['dataset'] },
  macro: { path: '/v3/macro', params: ['kind', 'country', 'q', 'limit', 'offset'], need: ['kind'] },
  series: { path: '/v3/macro/preview', params: ['kind', 'code'], need: ['kind', 'code'] },
};
const CHECK = {
  dataset: /^[a-z][a-z0-9_]{1,40}$/, symbol: /^[A-Za-z0-9._:-]{1,24}$/, country: /^[A-Za-z]{2,3}$/, from: /^\d{4}-\d{2}-\d{2}$/,
  to: /^\d{4}-\d{2}-\d{2}$/, kind: /^(observation|release|yield)$/, q: /^[\w .,%&()-]{1,64}$/, limit: /^\d{1,3}$/, offset: /^\d{1,6}$/,
  code: /^[A-Za-z0-9._:-]{1,80}$/,
};
const PER_MIN = 30, hits = [];

function target(query) {
  const op = Object.hasOwn(OPS, String(query.op)) ? OPS[query.op] : null; if (!op) return { error: 'op must be one of ' + Object.keys(OPS).join(', ') };
  const u = new URL(BASE + op.path);
  for (const k of op.params) { const v = query[k]; if (v == null || v === '') continue;
    if (!CHECK[k].test(String(v))) return { error: `bad ${k}` }; u.searchParams.set(k, String(v)); }
  for (const k of op.need || []) if (!u.searchParams.has(k)) return { error: `${k} is required` };
  return { url: u.toString() };
}
// remove anything that names or carries the key
function scrub(j) { if (j && typeof j === 'object' && !Array.isArray(j)) { const o = { ...j }; delete o.key; delete o.api_key; return o; } return j; }

async function handle(req, res, d = {}) {
  const env = d.env || process.env, F = d.fetch || fetch, now = d.now || Date.now();
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env)));
  let acct; try { acct = await who(req); } catch (e) { return res.status(503).json({ error: 'sign-in check unavailable' }); }
  if (!acct) return res.status(401).json({ error: 'sign in first' });
  if (acct.u !== 'owner') return res.status(403).json({ error: 'owner only: this data is licensed for the owner\'s own use' });
  if (!env.LSE_API_KEY) return res.status(503).json({ error: 'LSE_API_KEY is not set on the Worker' });
  const query = req.query || Object.fromEntries(new URL(req.url, 'https://x').searchParams);
  const t = target(query); if (t.error) return res.status(400).json({ error: t.error });
  while (hits.length && hits[0] < now - 60e3) hits.shift();
  if (hits.length >= PER_MIN) return res.status(429).json({ error: 'slow down: 30 calls a minute' });
  hits.push(now);
  let r; try { r = await F(t.url, { headers: { 'X-API-Key': env.LSE_API_KEY, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
  catch (e) { return res.status(502).json({ error: 'London Strategic Edge did not answer' }); }
  let body = null; try { body = await r.json(); } catch (e) { body = null; }
  if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: 'London Strategic Edge answered ' + r.status, detail: body && (body.code || body.message || body.detail) ? String(body.code || body.message || body.detail).slice(0, 200) : null });
  return res.status(200).json({ source: 'London Strategic Edge (owner\'s own use only)', op: query.op, data: scrub(body) });
}

module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.target = target;
module.exports.OPS = OPS;
module.exports._hits = hits;
