// Remote MCP server for the ICT edge (owner, 8 Nov 2026: "make an MCP for ChatGPT, my friend will use it, he would be able
// to work on the ICT edge, do changes and read the trades").
//
// Transport: MCP Streamable HTTP, stateless JSON-RPC over POST (ChatGPT connectors, Claude, Cursor all speak it).
//   URL for the friend:  https://meridianx.dev/api/mcp/<key>  (vercel.json rewrites it to /api/mcp?key=<key>; under /api because the
//                        firewall rule "Only reads outside the API" denies every POST elsewhere)
//   Env (Vercel, server only):
//     MCP_KEYS        "fred:<long random>,orlando:<long random>"  one key per person; the name goes on their notes and PRs.
//                     Make a key with: node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
//     GH_READ_TOKEN   reads council-data and main (falls back to GH_TOKEN / GH_DISPATCH_TOKEN, as api/data.js does)
//     GH_MCP_TOKEN    writes: branch + commit (Contents read/write) and the PR (Pull requests write). Falls back to GH_TOKEN;
//                     without PR permission the tool still pushes the branch and returns the compare link for the owner.
//
// What it can do, and what it can never do:
//   READ   ICT rules (the skill file, live parameters), live and replay signals with every feature, the tracker's state, the
//          demo cTrader results by edge LABEL only (no account numbers, no ids), and the ICT source files on main.
//   WRITE  (1) notes on trades, appended to council-data ict/mcp-notes.json; (2) PROPOSED changes to the ICT files only
//          (ict/**, the ICT skill, its tests and research), as a branch mcp/<name>/… + draft PR. Nothing reaches main or the
//          running tracker until the OWNER merges: "ask the owner before changing live trading rules" holds by construction.
//   NEVER  the council systems, api/, workflows, users, tokens, cTrader orders. No secret is ever returned or logged.
const crypto = require('node:crypto');
const REPO = 'vazxanana/macro-dashboard', DATA = 'council-data', MAIN = 'main', VERSION = '1.0.0';
const NOTES = 'ict/mcp-notes.json';
const PROFILE_USERS = ['fred'];   // who may read their own connector URL from the profile page
// files a proposal may touch (the ICT edge and nothing else)
const ALLOW = [/^ict\/[^/]+\.mjs$/, /^\.claude\/skills\/ICT\/[^/]+\.md$/, /^tests\/ict-[^/]+\.test\.mjs$/, /^tests\/fixtures\/ict\/[^/]+$/, /^research\/ict\/[^/]+\.(md|json|csv)$/, /^research\/edge\/ict-[^/]+\/[^/]+$/];
const okPath = (p) => typeof p === 'string' && p.length <= 160 && !p.split('/').some((s) => s === '' || s === '.' || s === '..') && ALLOW.some((re) => re.test(p));
const readTok = () => process.env.GH_READ_TOKEN || process.env.GH_TOKEN || process.env.GH_DISPATCH_TOKEN;
const writeTok = () => process.env.GH_MCP_TOKEN || process.env.GH_TOKEN;
const iso = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') : null);
const scrubErr = (e) => String(e && e.message || e).replace(/gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/g, '***');

// ---- who is calling: MCP_KEYS "name:key,name:key", compared in constant time ----
function whoIs(key) {
  if (!key || typeof key !== 'string' || key.length > 200) return null;
  for (const ent of String(process.env.MCP_KEYS || '').split(',')) {
    const i = ent.indexOf(':'); if (i < 1) continue;
    const name = ent.slice(0, i).trim().toLowerCase(), k = ent.slice(i + 1).trim();
    if (k.length >= 16 && k.length === key.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(key)) && /^[a-z0-9-]{1,24}$/.test(name)) return name;
  }
  return null;
}

// ---- GitHub ----
async function gh(u, o = {}) {
  const tok = o.write ? writeTok() : readTok();
  const r = await fetch(`https://api.github.com/repos/${REPO}${u}`, { method: o.method || 'GET', body: o.body ? JSON.stringify(o.body) : undefined,
    headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), Accept: o.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'meridian-ict-mcp', ...(o.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(o.timeout || 12000) });
  if (!r.ok && !(o.ok || []).includes(r.status)) throw new Error(`GitHub ${r.status} ${u.split('?')[0]}: ${(await r.text()).slice(0, 160)}`);
  return r;
}
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const CACHE = new Map();   // per instance, a minute: replay.json is 2 MB
async function file(branch, p, { json = true, ttl = 60e3 } = {}) {
  const k = `${branch}:${p}`, c = CACHE.get(k); if (c && Date.now() - c.at < ttl) return c.v;
  const r = await gh(`/contents/${enc(p)}?ref=${branch}`, { raw: true, ok: [404], timeout: 20000 });
  const v = r.status === 404 ? null : json ? await r.json() : await r.text();
  CACHE.set(k, { at: Date.now(), v }); return v;
}

// ---- ICT data ----
const outcome = (t) => ['win', 'loss', 'be'].includes(t.status) ? t.status : t.status === 'open' ? 'open' : t.R == null ? 'open' : t.R > 0.05 ? 'win' : t.R < -0.05 ? 'loss' : 'be';
const brief = (t) => ({ id: t.id, market: t.short || t.market, side: t.side, signal: iso(t.signalAt), entry: t.entry, stop: t.stop, target: t.t2 ?? t.t1, r0: t.r0, status: outcome(t), R: t.R, R2: t.R2,
  closed: iso(t.closed), exit: t.exit, grade: t.grade && t.grade.letter, score: t.grade && t.grade.total, aSetup: !!t.aset, aPlus: !!t.aplus, session: t.feat && t.feat.session, bias: t.feat && t.feat.bias, zone: t.feat && t.feat.zone, replay: !!t.replay });
function stats(rows) {
  const closed = rows.filter((t) => outcome(t) !== 'open' && typeof t.R === 'number'), by = (f) => { const o = {}; for (const t of closed) { const k = f(t) || '?'; (o[k] = o[k] || { n: 0, R: 0, wins: 0 }); o[k].n++; o[k].R += t.R; if (t.R > 0.05) o[k].wins++; } for (const v of Object.values(o)) v.R = +v.R.toFixed(2); return o; };
  const netR = closed.reduce((s, t) => s + t.R, 0), wins = closed.filter((t) => t.R > 0.05).length;
  return { n: rows.length, open: rows.length - closed.length, closed: closed.length, wins, losses: closed.filter((t) => t.R < -0.05).length, breakEven: closed.length - wins - closed.filter((t) => t.R < -0.05).length,
    netR: +netR.toFixed(2), winRate: closed.length ? +(wins / closed.length).toFixed(3) : null, avgR: closed.length ? +(netR / closed.length).toFixed(3) : null, byMarket: by((t) => t.short || t.market), byGrade: by((t) => t.grade && t.grade.letter), bySession: by((t) => t.feat && t.feat.session) };
}
async function allTrades(source = 'both') {
  const live = source === 'replay' ? [] : (await file(DATA, 'ict/trades.json')) || [], rep = source === 'live' ? [] : ((await file(DATA, 'ict/replay.json')) || {}).trades || [];
  const liveIds = new Set(live.map((t) => t.id.replace(/-r$/, '')));
  return [...live, ...rep.filter((t) => source !== 'both' || !liveIds.has(t.id.replace(/-r$/, '')))];   // Both never counts a live signal twice
}
function filterTrades(rows, a) {
  let r = rows;
  if (a.market) { const m = String(a.market).toLowerCase(); r = r.filter((t) => t.market === m || String(t.short).toLowerCase() === m); }
  if (a.status) r = r.filter((t) => a.status === 'closed' ? outcome(t) !== 'open' : outcome(t) === a.status);
  if (a.grade) { const g = String(a.grade).toUpperCase(); r = r.filter((t) => g === 'A+' ? t.aplus : g === 'A' ? t.aset : (t.grade && t.grade.letter || '').startsWith(g)); }
  if (a.side) r = r.filter((t) => t.side === a.side);
  if (a.since) { const s = Date.parse(a.since) / 1000; r = r.filter((t) => t.signalAt >= s); }
  if (a.until) { const u = Date.parse(a.until) / 1000 + 86400; r = r.filter((t) => t.signalAt < u); }
  return r.sort((x, y) => y.signalAt - x.signalAt);
}
// the rule document, by numbered section
async function skill() { return (await file(MAIN, '.claude/skills/ICT/SKILL.md', { json: false, ttl: 300e3 })) || ''; }
function sections(md) { const out = []; let cur = null; for (const line of md.split('\n')) { const m = /^## (\d+)\. (.*)$/.exec(line); if (m) { cur = { n: +m[1], title: m[2], text: '' }; out.push(cur); } else if (cur) cur.text += line + '\n'; } return out; }
async function liveParams() {
  const src = (await file(MAIN, 'ict/tracker.mjs', { json: false, ttl: 300e3 })) || '';
  const grab = (re) => { const m = re.exec(src); return m ? m[1].trim() : null; };
  return { P: grab(/export const P = (\{[^\n]*\});/), MIN_GRADE: grab(/export const MIN_GRADE = ([^;]+);/), MARKETS: grab(/export const MARKETS = \{([\s\S]*?)\n\};/) };
}
// cTrader results by edge label only: every id, login and account number is removed, whatever the shape
const SECRET_KEY = /^(id|login|account|accountId|ctidTraderAccountId|positionId|orderId|dealId|base)$/i;
function scrub(v) { if (Array.isArray(v)) return v.map(scrub); if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (!SECRET_KEY.test(k)) o[k] = scrub(x); return o; } return typeof v === 'string' ? v.replace(/\b\d{7,}\b/g, '…') : v; }

// ---- writes ----
async function addNote(who, a) {
  const text = String(a.text || '').trim().slice(0, 2000); if (!text) throw new Error('text is required');
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await gh(`/contents/${enc(NOTES)}?ref=${DATA}`, { ok: [404], write: true }), j = cur.status === 404 ? null : await cur.json();
    const notes = j ? JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) : [];
    const note = { at: new Date().toISOString(), by: who, trade: a.trade_id ? String(a.trade_id).slice(0, 60) : null, text };
    notes.push(note); while (notes.length > 3000) notes.shift();
    const r = await gh(`/contents/${enc(NOTES)}`, { method: 'PUT', write: true, ok: [409, 422], body: { message: `ICT note by ${who} (MCP)`, branch: DATA, content: Buffer.from(JSON.stringify(notes, null, 1)).toString('base64'), ...(j ? { sha: j.sha } : {}) } });
    if (r.ok) { CACHE.delete(`${DATA}:${NOTES}`); return { saved: true, note, total: notes.length }; }
  }
  throw new Error('the notes file moved twice; try again');
}
async function propose(who, a) {
  const files = Array.isArray(a.files) ? a.files : []; if (!files.length) throw new Error('files[] is required');
  if (files.length > 12) throw new Error('at most 12 files per proposal');
  let bytes = 0; for (const f of files) { if (!okPath(f.path)) throw new Error(`path not allowed: ${f.path}. Allowed: ict/*.mjs, .claude/skills/ICT/*.md, tests/ict-*.test.mjs, tests/fixtures/ict/*, research/ict/*, research/edge/ict-*/*`); if (typeof f.content !== 'string') throw new Error(`content must be a string: ${f.path}`); bytes += Buffer.byteLength(f.content); }
  if (bytes > 400e3) throw new Error('proposal over 400 KB');
  const title = String(a.title || '').trim().slice(0, 100), why = String(a.why || '').trim().slice(0, 4000); if (!title || !why) throw new Error('title and why are required');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'change', branch = `mcp/${who}/${Date.now().toString(36)}-${slug}`;
  const head = (await (await gh(`/git/ref/heads/${MAIN}`)).json()).object.sha, base = (await (await gh(`/git/commits/${head}`)).json()).tree.sha;
  const tree = []; for (const f of files) { const b = await (await gh('/git/blobs', { method: 'POST', write: true, body: { content: f.content, encoding: 'utf-8' } })).json(); tree.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha }); }
  const t = await (await gh('/git/trees', { method: 'POST', write: true, body: { base_tree: base, tree } })).json();
  const msg = `${title}\n\n${why}\n\nProposed by ${who} through the ICT MCP. Paper research; nothing changes live until the owner merges.`;
  const c = await (await gh('/git/commits', { method: 'POST', write: true, body: { message: msg, tree: t.sha, parents: [head] } })).json();
  await gh('/git/refs', { method: 'POST', write: true, body: { ref: `refs/heads/${branch}`, sha: c.sha } });
  const body = `**Proposed by ${who}** (ICT MCP, ${new Date().toISOString().slice(0, 16)} UTC). Paper research on the ICT edge; the owner reviews and decides. Nothing changes live until merged.\n\n${why}${a.tests_run ? `\n\n**Tests run by the proposer:** ${String(a.tests_run).slice(0, 1000)}` : ''}\n\nFiles: ${files.map((f) => '`' + f.path + '`').join(', ')}`;
  const pr = await gh('/pulls', { method: 'POST', write: true, ok: [403, 404, 422], body: { title: `ICT (${who}): ${title}`, head: branch, base: MAIN, body, draft: true } });
  const compare = `https://github.com/${REPO}/compare/${MAIN}...${encodeURIComponent(branch)}?expand=1`;
  if (pr.ok) { const j = await pr.json(); return { branch, pr: j.html_url, number: j.number, note: 'Draft PR opened for the owner. Tests run on it automatically.' }; }
  return { branch, compare, note: `Branch pushed; the token could not open the PR (GitHub ${pr.status}). The owner opens it from the compare link.` };
}

// ---- tools ----
const T = (name, description, properties = {}, required = []) => ({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } });
const TOOLS = [
  T('ict_rules', 'The ICT edge rule book (.claude/skills/ICT/SKILL.md) and the live tracker parameters. Without a section: the index of sections and the live parameters. With section (number or words from its title): that section\'s text.', { section: { type: 'string', description: 'section number ("14") or words from the title ("A-setup")' } }),
  T('ict_trades', 'ICT signals with statistics. source: live (the running tracker since 6 Nov 2026), replay (the same rule over history since Aug 2025, ~800 records) or both (default). Filters: market (nq, es, ym, rty, gc), status (open, win, loss, be, closed), grade (A = A-setups, A+ = A+ tier, or a letter like B), side (buy, sell), since / until (YYYY-MM-DD). Returns stats for the whole filtered set and a page of records, newest first.',
    { source: { type: 'string', enum: ['live', 'replay', 'both'] }, market: { type: 'string' }, status: { type: 'string', enum: ['open', 'win', 'loss', 'be', 'closed'] }, grade: { type: 'string' }, side: { type: 'string', enum: ['buy', 'sell'] }, since: { type: 'string' }, until: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 200 }, offset: { type: 'integer', minimum: 0 }, full: { type: 'boolean', description: 'true: every recorded field (features, grade parts, path); default: a brief line per record' } }),
  T('ict_trade', 'One ICT signal with every recorded field (features, grade, sweep, FVG, draw on liquidity, excursion path).', { id: { type: 'string' } }, ['id']),
  T('ict_status', 'The tracker\'s latest state: each market\'s price, last signal, previous day high / low, open paper trades, the shadow variants\' totals, and the notes written through this MCP.', {}),
  T('ctrader_results', 'Demo cTrader results of the mirror accounts by edge label (Council, ICT, Shadows, LIT, Replica): balance, equity, floating, open positions, resting orders, recent history. Account numbers and ids are never included.', {}),
  T('ict_file_list', 'List the ICT source files on main that a proposal may change (tracker, replay, calendar, the skill, tests, research).', {}),
  T('ict_file_read', 'Read one ICT source file from main. Allowed: ict/*.mjs, .claude/skills/ICT/*.md, tests/ict-*.test.mjs, tests/fixtures/ict/*, research/ict/*, research/edge/ict-*/*.', { path: { type: 'string' } }, ['path']),
  T('ict_note', 'Save a note (a review, an observation, a question for the owner), optionally on one trade id. Notes are kept in council-data ict/mcp-notes.json with your name and the time.', { text: { type: 'string' }, trade_id: { type: 'string' } }, ['text']),
  T('ict_propose_change', 'Propose a change to the ICT edge: full new contents of one or more allowed files (read them first with ict_file_read; send the WHOLE file). Creates a branch mcp/<you>/… and a draft pull request for the owner, who decides. Nothing changes live until the owner merges. Say in why what the change does, what you tested and the result; put the numbers in tests_run.',
    { title: { type: 'string' }, why: { type: 'string' }, files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } }, tests_run: { type: 'string' } }, ['title', 'why', 'files']),
  // ChatGPT's deep-research connectors require these two
  T('search', 'Search ICT trades (by id, market, grade, session, outcome) and the rule book sections. Returns ids for fetch.', { query: { type: 'string' } }, ['query']),
  T('fetch', 'Fetch a full document by id from search: trade:<signal id> or rule:<section number>.', { id: { type: 'string' } }, ['id']),
];
const page = (rows, a) => { const limit = Math.min(Math.max(+a.limit || 50, 1), 200), offset = Math.max(+a.offset || 0, 0); return { total: rows.length, offset, limit, records: rows.slice(offset, offset + limit) }; };
async function call(who, name, a = {}) {
  switch (name) {
    case 'ict_rules': { const S = sections(await skill()); if (!a.section) return { live: await liveParams(), sections: S.map((s) => ({ n: s.n, title: s.title })), note: 'Sections 11+ are the owner\'s tests and decisions, dated; the rules in force are the latest dated ones.' };
      const q = String(a.section).toLowerCase(), s = S.find((x) => String(x.n) === q) || S.find((x) => x.title.toLowerCase().includes(q)); if (!s) throw new Error('no such section'); return { n: s.n, title: s.title, text: s.text.trim() }; }
    case 'ict_trades': { const rows = filterTrades(await allTrades(a.source || 'both'), a), p = page(rows, a); return { stats: stats(rows), ...p, records: p.records.map((t) => a.full ? t : brief(t)) }; }
    case 'ict_trade': { const t = (await allTrades('both')).find((x) => x.id === a.id || x.id === `${a.id}-r` || `${x.id}-r` === a.id); if (!t) throw new Error('no such trade'); return t; }
    case 'ict_status': { const [snap, shadow, live, notes] = await Promise.all([file(DATA, 'ict/snapshot.json'), file(DATA, 'ict/shadow.json'), file(DATA, 'ict/trades.json'), file(DATA, NOTES)]);
      return { snapshot: snap, openLive: (live || []).filter((t) => t.status === 'open').map(brief), shadow: shadow && { variant: shadow.variant, since: shadow.since, totals: shadow.totals, variants: Object.fromEntries(Object.entries(shadow.variants || {}).map(([k, v]) => [k, v.totals])) }, notes: (notes || []).slice(-20) }; }
    case 'ctrader_results': { const j = await file(DATA, 'ctrader/accounts.json', { ttl: 10e3 }); if (!j) return { note: 'no snapshot yet' }; return scrub({ at: j.at, accounts: (j.accounts || []).map((x) => ({ label: x.label, books: x.books, balance: x.balance, equity: x.equity, floating: x.floating, open: x.open, orders: x.orders, history: x.history, error: x.error })) }); }
    case 'ict_file_list': { const t = await (await gh(`/git/trees/${MAIN}?recursive=1`, { timeout: 20000 })).json(); return { files: (t.tree || []).filter((x) => x.type === 'blob' && okPath(x.path)).map((x) => ({ path: x.path, bytes: x.size })) }; }
    case 'ict_file_read': { if (!okPath(a.path)) throw new Error('path not allowed'); const s = await file(MAIN, a.path, { json: false, ttl: 30e3 }); if (s == null) throw new Error('not found'); return { path: a.path, content: s }; }
    case 'ict_note': return addNote(who, a);
    case 'ict_propose_change': return propose(who, a);
    case 'search': { const q = String(a.query || '').toLowerCase().split(/\s+/).filter(Boolean), rows = await allTrades('both'), S = sections(await skill());
      const hit = (s) => q.every((w) => s.includes(w)), results = [];
      for (const s of S) if (hit(`${s.n} ${s.title} ${s.text}`.toLowerCase())) results.push({ id: `rule:${s.n}`, title: `§${s.n} ${s.title}`, url: `https://github.com/${REPO}/blob/${MAIN}/.claude/skills/ICT/SKILL.md` });
      for (const t of rows) { const b = brief(t); if (hit(JSON.stringify(b).toLowerCase())) results.push({ id: `trade:${t.id}`, title: `${b.market} ${b.side} ${b.signal} ${b.grade || ''} ${b.status} ${b.R ?? ''}R`.trim(), url: `https://meridianx.dev/#ict` }); if (results.length >= 50) break; }
      return { results }; }
    case 'fetch': { const id = String(a.id || ''); if (id.startsWith('rule:')) { const s = sections(await skill()).find((x) => String(x.n) === id.slice(5)); if (!s) throw new Error('no such rule'); return { id, title: `§${s.n} ${s.title}`, text: s.text.trim(), url: `https://github.com/${REPO}/blob/${MAIN}/.claude/skills/ICT/SKILL.md`, metadata: { section: s.n } }; }
      const tid = id.replace(/^trade:/, ''), t = (await allTrades('both')).find((x) => x.id === tid); if (!t) throw new Error('no such trade'); return { id, title: `${t.short} ${t.side} ${iso(t.signalAt)}`, text: JSON.stringify(t, null, 1), url: 'https://meridianx.dev/#ict', metadata: brief(t) }; }
    default: throw new Error(`unknown tool ${name}`);
  }
}

// ---- JSON-RPC ----
const INSTR = 'Meridian ICT desk. Read the ICT rule book and signals (live + replay), the tracker state and demo cTrader results by label, and the ICT source files. Save notes with ict_note. To change the edge, read the file, edit it and send the WHOLE file to ict_propose_change: it opens a draft PR for the owner; nothing changes live until the owner merges. The ICT edge is separate from the council systems and only ICT files can be proposed. Paper trading only.';
async function rpc(who, m) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return { jsonrpc: '2.0', id: m && m.id != null ? m.id : null, error: { code: -32600, message: 'invalid request' } };
  const res = (result) => ({ jsonrpc: '2.0', id: m.id, result }), err = (code, message) => ({ jsonrpc: '2.0', id: m.id, error: { code, message } });
  if (m.method.startsWith('notifications/')) return null;
  switch (m.method) {
    case 'initialize': { const v = m.params && m.params.protocolVersion; return res({ protocolVersion: ['2025-06-18', '2025-03-26', '2024-11-05'].includes(v) ? v : '2025-03-26', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'meridian-ict', version: VERSION }, instructions: INSTR }); }
    case 'ping': return res({});
    case 'tools/list': return res({ tools: TOOLS });
    case 'tools/call': { const p = m.params || {}; if (!TOOLS.some((t) => t.name === p.name)) return err(-32602, `unknown tool ${p.name}`);
      try { const out = await call(who, p.name, p.arguments || {}); const text = JSON.stringify(out, null, 1); return res({ content: [{ type: 'text', text: text.length > 900e3 ? text.slice(0, 900e3) + '\n…(cut; narrow the filters)' : text }], structuredContent: typeof out === 'object' && !Array.isArray(out) && text.length <= 900e3 ? out : undefined }); }
      catch (e) { return res({ content: [{ type: 'text', text: `Error: ${scrubErr(e)}` }], isError: true }); } }
    default: return err(-32601, 'method not found');
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version'); res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
    // the profile page (owner, 8 Nov: "make it available in Fred's profile, only Fred"): Fred proves his desk password and gets his
  // connector URL; no other user is answered, whatever MCP_KEYS holds. The password check is ctrader-link's (same user list).
  if (req.method === 'POST' && !(req.query && req.query.key) && req.body && (typeof req.body === 'object' ? req.body.action : /"action"\s*:\s*"mykey"/.test(req.body)) ) {
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (b.action !== 'mykey') return res.status(400).json({ error: 'unknown action' });
    const want = String(b.user || '').toLowerCase(); if (!PROFILE_USERS.includes(want)) return res.status(403).json({ error: 'Not available for this account' });
    try {
      const ct = require('./ctrader-link.js')._t, who = await ct.identify({ blobUsers: () => ct.blobUsers(process.env, req.headers.host) }, want, b.pw);
      if (!who || who.u !== want) return res.status(403).json({ error: 'Password not accepted' });
      const ent = String(process.env.MCP_KEYS || '').split(',').map((x) => x.trim()).find((x) => x.toLowerCase().startsWith(want + ':'));
      if (!ent || ent.slice(want.length + 1).length < 16) return res.status(404).json({ error: 'No key has been made for you yet; ask the owner' });
      console.log(`[mcp] key shown to ${want}`);
      return res.status(200).json({ user: want, url: `https://${req.headers.host}/api/mcp/${ent.slice(want.length + 1)}` });
    } catch (e) { return res.status(e.status || 500).json({ error: scrubErr(e) }); }
  }
  const who = whoIs((req.query && req.query.key) || (String(req.headers.authorization || '').match(/^Bearer (.+)$/) || [])[1]);
  if (!who) { console.log('[mcp] refused'); return res.status(401).json({ error: 'unauthorised' }); }
  if (req.method === 'GET') return res.status(405).json({ error: 'this server has no event stream; POST JSON-RPC here' });   // allowed by the spec
  if (req.method === 'DELETE') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  let body; try { body = typeof req.body === 'string' ? JSON.parse(req.body || 'null') : req.body; } catch (e) { return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
  const msgs = Array.isArray(body) ? body : [body], out = [];
  for (const m of msgs) { const r = await rpc(who, m); if (r) out.push(r); if (m && m.method === 'tools/call') console.log(`[mcp] ${who} ${m.params && m.params.name}${r && r.result && r.result.isError ? ' error' : ''}`); }
  if (!out.length) return res.status(202).end();
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Mcp-Protocol-Version', '2025-06-18');
  return res.status(200).json(Array.isArray(body) ? out : out[0]);
};
module.exports.lib = { PROFILE_USERS, whoIs, okPath, scrub, stats, brief, outcome, filterTrades, sections, rpc, TOOLS, call };
