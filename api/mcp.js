// Remote MCP server for the ICT edge (owner, 8 Nov 2026: "make an MCP for ChatGPT, my friend will use it, he would be able
// to work on the ICT edge, do changes and read the trades"; 9 Nov: "make a proper good MCP for Fred for him to be able to work on
// the ICT with ChatGPT"). Guide for the helper: docs/fred-mcp.md.
//
// Transport: MCP Streamable HTTP, stateless JSON responses over POST (ChatGPT developer-mode connectors, Claude, Cursor).
//   URL:  https://meridianx.dev/api/mcp/<key>  (vercel.json rewrites it to /api/mcp?key=<key>; under /api because the firewall rule
//         "Only reads outside the API" denies every POST elsewhere). Authorization: Bearer <key> works too.
//   Protocol: protocol versions 2025-11-25 / 2025-06-18 / 2025-03-26 / 2024-11-05 negotiated in initialize; an unsupported
//         MCP-Protocol-Version header → 400; notifications and client responses → 202 without a body; GET / DELETE → 405 (no SSE
//         stream, no sessions: allowed by the spec); OPTIONS → 204 with CORS; a browser Origin outside ORIGINS → 403; batches (the
//         2025-03-26 form) up to 20 messages; JSON-RPC errors -32700 / -32600 / -32601 / -32602; tool failures and bad arguments are
//         tool results with isError (so the model can correct itself). Tools carry title, annotations (readOnlyHint,
//         destructiveHint, idempotentHint, openWorldHint), input schemas with descriptions / enums / defaults, and an outputSchema
//         with structuredContent where the shape is fixed. search / fetch follow OpenAI's company-knowledge shapes (one text item
//         holding JSON: { results: [{ id, title, url }] } and { id, title, text, url, metadata }).
//   Env (Vercel, server only):
//     (no key env needed for members: a key is derived from CTRADER_LINK_KEY / CRON_SECRET, see whoIs)
//     MCP_KEYS        optional "name:<long random>,…" for more people or to override a derived key; the name goes on notes and PRs.
//     MCP_ORIGINS     optional extra browser origins ("https://a.example,https://b.example")
//     GH_READ_TOKEN   reads council-data and main (falls back to GH_TOKEN / GH_DISPATCH_TOKEN, as api/data.js does)
//     GH_MCP_TOKEN    writes: branch + commit (Contents write), the PR and PR comments (Pull requests write; Issues write for
//                     comments), check runs read (Checks read) for ict_my_proposals. Falls back to GH_TOKEN; without PR
//                     permission the proposal still pushes the branch and returns the compare link for the owner.
//     OANDA_TOKEN     candles for ict_bars / ict_backtest / ict_compare (as api/bars.js); without it NQ / ES / YM fall back to the
//                     council-data research candles (2023 on) and the answer says so.
//
// What it can do, and what it can never do:
//   READ   the guide, ICT rules (the skill file, live parameters), live and replay signals, the tracker's state, demo cTrader results
//          by edge LABEL only, the ICT source files, candles, backtests of the desk's own engine with proposed parameters
//          (api/_ictlab.js), and the caller's own proposals with their CI state and the owner's comments.
//   WRITE  (members with ICT 'write' only) notes on trades (council-data ict/mcp-notes.json); PROPOSED changes to the ICT files only,
//          validated (allowlisted paths, a tests/ict-*.test.mjs test, node --check, no new network / env / process access), as a
//          branch mcp/<name>/… + draft PR with a structured body; comments on the caller's own PRs. Nothing reaches main or the
//          running tracker until the OWNER merges: "ask the owner before changing live trading rules" holds by construction.
//   NEVER  the council systems, api/, workflows, users, tokens, cTrader orders. No secret is ever returned or logged; logs carry
//          the member, the tool and the time only. Rate limits per key (in memory per instance) and output caps on every answer.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const pathM = require('node:path');
const { execFileSync } = require('node:child_process');
const { BUILT_IN } = require('./_accounts.js');
const lab = require('./_ictlab.js');
const REPO = 'vazxanana/macro-dashboard', OWNER = 'vazxanana', DATA = 'council-data', MAIN = 'main', VERSION = '2.0.0';
const NOTES = 'ict/mcp-notes.json';
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];   // newest first; an unknown request gets the newest
const PROFILE_USERS = ['fred'];   // who may read their own connector URL from the profile page
// files a proposal may touch (the ICT edge and nothing else)
const ALLOW = [/^ict\/[^/]+\.mjs$/, /^\.claude\/skills\/ICT\/[^/]+\.md$/, /^tests\/ict-[^/]+\.test\.mjs$/, /^tests\/fixtures\/ict\/[^/]+$/, /^research\/ict\/[^/]+\.(md|json|csv)$/, /^research\/edge\/ict-[^/]+\/[^/]+$/];
const ALLOW_TEXT = 'ict/*.mjs, .claude/skills/ICT/*.md, tests/ict-*.test.mjs, tests/fixtures/ict/*, research/ict/*.md|json|csv, research/edge/ict-*/*';
const okPath = (p) => typeof p === 'string' && p.length <= 160 && !p.split('/').some((s) => s === '' || s === '.' || s === '..') && ALLOW.some((re) => re.test(p));
const TEST_RE = /^tests\/ict-[^/]+\.test\.mjs$/, RULE_RE = /^(ict\/[^/]+\.mjs|\.claude\/skills\/ICT\/[^/]+\.md)$/;
const readTok = () => process.env.GH_READ_TOKEN || process.env.GH_TOKEN || process.env.GH_DISPATCH_TOKEN;
const writeTok = () => process.env.GH_MCP_TOKEN || process.env.GH_TOKEN;
const iso = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') : null);
const scrubErr = (e) => String(e && e.message || e).replace(/gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/g, '***').replace(/Bearer\s+\S+/g, 'Bearer ***');
const noPing = (s) => String(s).replace(/(^|[^\w`])@([A-Za-z0-9][\w-]*)/g, '$1`@$2`');   // no GitHub notifications from helper text
const TEXT_CAP = 150e3;   // characters in one tool answer

// ---- who is calling ----
// Keys come from two places: MCP_KEYS "name:key,name:key" (optional, for anyone), and a key DERIVED from a secret already on the
// server (owner, 8 Nov: "for Fred the key should be there already without him adding"): "<name>.<HMAC(secret, name)>", so a
// member's URL exists from the first deploy. A derived key also needs the owner's grant on the member's record (Users page:
// mcp flag or perms.mcp; Fred has it built in), checked on every call and cached a minute. Compared in constant time.
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const NAME_RE = /^[a-z0-9-]{1,24}$/;
function derivedKey(name, env = process.env) { const sec = env.CTRADER_LINK_KEY || env.CRON_SECRET; return sec && NAME_RE.test(name) && name !== 'owner' ? `${name}.${crypto.createHmac('sha256', sec).update(`mcp:${name}`).digest('base64url').slice(0, 32)}` : null; }
function keyFor(name, env = process.env) {
  const ent = String(env.MCP_KEYS || '').split(',').map((x) => x.trim()).find((x) => x.toLowerCase().startsWith(name + ':'));
  const k = ent ? ent.slice(name.length + 1) : null; return k && k.length >= 16 ? k : derivedKey(name, env);
}
// the name an MCP_KEYS entry or a derived key stands for, or null
function whoIs(key, env = process.env) {
  if (!key || typeof key !== 'string' || key.length > 200) return null;
  for (const ent of String(env.MCP_KEYS || '').split(',')) {
    const i = ent.indexOf(':'); if (i < 1) continue;
    const name = ent.slice(0, i).trim().toLowerCase(), k = ent.slice(i + 1).trim();
    if (k.length >= 16 && same(k, key) && NAME_RE.test(name)) return name;
  }
  const dot = key.indexOf('.'); if (dot > 0) { const name = key.slice(0, dot), k = derivedKey(name, env); if (k && same(k, key)) return name; }
  return null;
}
// is the member granted the connector? the record's mcp flag or perms.mcp (an explicit perms.mcp === false revokes a built-in)
const GRANT = { at: 0, users: null };
const explicitKey = (name, env) => String(env.MCP_KEYS || '').split(',').some((e) => e.trim().toLowerCase().startsWith(name + ':'));
async function granted(name, host, env = process.env) {
  if (explicitKey(name, env)) return true;   // an explicit key is the owner's grant
  let users = GRANT.users;
  if (!users || Date.now() - GRANT.at > 60e3) { try { const ct = require('./ctrader-link.js')._t; const r = await ct.blobUsers(env, host); users = (r && r.users) || {}; GRANT.users = users; GRANT.at = Date.now(); } catch (e) { if (!GRANT.users) return false; users = GRANT.users; } }   // fails closed: no list read yet, no grant (a built-in member disabled on the Users page stays out)
  const u = users[name]; if (u && u.disabled) return false;
  if (u && (u.mcp || (u.perms && u.perms.mcp))) return true;
  if (u && u.perms && u.perms.mcp === false) return false;
  return PROFILE_USERS.includes(name);
}
// ICT permission of the member (Users page: perms.ict false | 'read' | 'write', else the record's ict flag, else the built-in record).
// 'write' unlocks the write tools; a name known only from MCP_KEYS reads. Read from the list granted() just loaded.
function ictLevel(name) {
  const v = (x) => (x === true || x === 'write' ? 'write' : x === 'read' ? 'read' : 'none');
  const u = GRANT.users && GRANT.users[name];
  if (u && u.perms && 'ict' in u.perms) return v(u.perms.ict);
  if (u) return v(u.ict);
  if (BUILT_IN[name]) return v(BUILT_IN[name].ict);
  return 'read';
}

// ---- rate limits, per key, in memory per instance (a cold start resets them; enough against a runaway loop) ----
const LIMITS = { all: [90, 60e3], heavy: [12, 600e3], bars: [40, 600e3], write: [20, 3600e3], propose: [6, 3600e3] };
const RL = new Map();
// returns 0 (and counts the call) or the seconds to wait; peek only looks (a proposal counts once it is opened, so a refused patch
// does not use up the budget)
function limited(who, cls, now = Date.now(), peek = false) {
  const [n, win] = LIMITS[cls], k = `${who}:${cls}`, a = (RL.get(k) || []).filter((t) => now - t < win);
  if (a.length >= n) { RL.set(k, a); return Math.max(1, Math.ceil((win - (now - a[0])) / 1000)); }
  if (!peek) a.push(now); RL.set(k, a); return 0;
}

// ---- GitHub ----
async function gh(u, o = {}) {
  const tok = o.write ? writeTok() : readTok();
  const r = await fetch(`https://api.github.com/repos/${REPO}${u}`, { method: o.method || 'GET', body: o.body ? JSON.stringify(o.body) : undefined,
    headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), Accept: o.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'meridian-ict-mcp', ...(o.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(o.timeout || 12000) });
  if (!r.ok && !(o.ok || []).includes(r.status)) throw new Error(`GitHub ${r.status} ${u.split('?')[0]}: ${scrubErr((await r.text()).slice(0, 160))}`);
  return r;
}
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const CACHE = new Map();   // per instance, a minute: replay.json is 2 MB
async function file(branch, p, { json = true, buf = false, ttl = 60e3 } = {}) {
  const k = `${branch}:${p}:${buf ? 'b' : json ? 'j' : 't'}`, c = CACHE.get(k); if (ttl && c && Date.now() - c.at < ttl) return c.v;
  const r = await gh(`/contents/${enc(p)}?ref=${branch}`, { raw: true, ok: [404], timeout: 20000 });
  const v = r.status === 404 ? null : buf ? Buffer.from(await r.arrayBuffer()) : json ? await r.json() : await r.text();
  if (ttl) { CACHE.set(k, { at: Date.now(), v }); while (CACHE.size > 80) CACHE.delete(CACHE.keys().next().value); }
  return v;
}
const labIO = { dataBuf: (p) => file(DATA, p, { buf: true, ttl: 3600e3 }) };

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

// ---- the guide (also the server instructions, shortened) ----
const GUIDE = {
  desk: 'The Meridian ICT desk paper-trades one model: the H1 iFVG reversal (.claude/skills/ICT/SKILL.md §9, coded in ict/tracker.mjs). A confirmed H1 swing low (P.piv candles each side, within the last P.look candles) is swept; within P.vmax candles a candle BODY closes above the most recent bearish FVG of the down-leg (the inversion) → buy at that close; stop 2 ticks under the sweep low; no fixed target: from +2R the stop trails 1.5R behind the best price (P.trail), index futures move the stop to entry at +1.5R (P.be), out after 36 closed H1 candles (P.holdH). Sells mirror. One open trade per market. Markets: NQ, ES, YM, RTY futures and GC gold (live paper), spot silver XAG (paper-only shadow).',
  aSetup: 'Every signal graded >= 3/10 is recorded; the desk acts on A-SETUPS. Indices (§14, §20, §22, §23, §25, §27): against the daily bias (prior close vs its 50-day average), grade >= 7 (B+), stop 0.3-0.75x the daily ATR (0.15-0.3x allowed at half size with A+ quality), not a jobs-report morning; sized 1.5x when the draw on liquidity is >= 2R away, else 0.5x. Gold (§26): buys only, stop 0.3-0.75x the daily ATR, size 1, no break-even.',
  rules: [
    'Paper only. Nothing here places an order; the cTrader accounts are demo mirrors you can read by label.',
    'Every trade has a stop. No proposal may remove the stop, move it away from the sweep extreme, or loosen a trailed stop.',
    'An edge must pass out of sample on 2020-now data: in sample 2020-2023, out of sample 2024-now (the default split of ict_backtest / ict_compare); OOS n >= 30, average R > 0 in sample AND out of sample, most OOS years positive; t >= 2 is strong. Net of costs.',
    'Report every variant you tried, not only the best one: the 6 Nov search found that most filters that looked good in sample failed out of sample (§14). Fewer, pre-stated ideas beat many tried ones.',
    'The owner approves every rule change. ict_propose_change opens a DRAFT pull request; CI runs the tests; nothing reaches the live tracker until the owner merges.',
    'ICT is a separate edge (§11): never use the council systems to filter it, never change council files.',
  ],
  workflow: [
    '1. ict_guide (this) and ict_rules: read the model and the latest dated sections (11+ are the owner\'s tests and decisions).',
    '2. ict_status and ict_trades: what the desk did lately (live + replay); ict_trade for one record with every feature; ict_bars for the candles around it.',
    '3. Form ONE idea (a parameter or a filter) and write down why before testing it.',
    '4. ict_backtest on 2020-now with the idea (params / filters); then ict_compare: the live rule vs your idea on the same candles, IS vs OOS, by year and market.',
    '5. If it passes the screen: ict_file_read the code, write the change AND a test (tests/ict-<topic>.test.mjs), and ict_propose_change with what / why / evidence (or evidence_run so the server reruns the comparison on 2020-now) / risk.',
    '6. ict_my_proposals: CI state and the owner\'s comments; reply with ict_proposal_comment; save observations with ict_note.',
  ],
  data: 'Trades: council-data ict/trades.json (live since 6 Nov 2026) and ict/replay.json (the same rule over CNBC futures since Aug 2025). Backtests: OANDA mid H1 cash CFDs 2020-now (NQ → NAS100, ES → SPX500, YM → US30, RTY → US2000, GC → XAU spot, XAG), D1 built from H1 at 17:00 New York; cost a round trip NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5, silver 0.03. Levels differ from the futures; the structure is the same.',
  params: 'ict_backtest params: piv (swing candles each side, 3), look (candles a swing stays active, 96), vmax (max candles sweep → inversion, 6), maxAtr (max stop in H1 ATRs, 8), holdH (H1 candles before the time exit, 36), be (R for break-even on indices, 1.5; 0 = off), trail_from / trail_dist (trail start and distance in R, 2 / 1.5; trail_from 0 = no trail), mark (the R mark recorded, 2).',
  limits: 'Per key: 90 calls a minute; 12 backtests / comparisons per 10 minutes; 40 candle requests per 10 minutes; 20 writes an hour (6 proposals). Backtests: 1-5 markets, 2020-01-01 to now, about 40 s of candle download. Answers are capped at 150 000 characters: narrow filters or use limit / offset.',
};
const INSTR = 'Meridian ICT desk (paper trading, one model: the H1 iFVG reversal). Call ict_guide first: it explains the desk, the rules and the workflow. Rules: every trade has a stop; paper only; an edge must pass out of sample on 2020-now data (ict_backtest / ict_compare: in sample 2020-2023, out of sample 2024-now); the owner approves every rule change. Research with ict_rules, ict_trades, ict_bars, ict_backtest and ict_compare; propose a change with ict_propose_change (a draft PR with a test and the 2020-now evidence; nothing changes live until the owner merges); follow it with ict_my_proposals. Only ICT files can be changed; the council systems, api/, workflows, users and orders are out of reach.';

// ---- writes ----
async function addNote(who, a) {
  const text = String(a.text || '').trim().slice(0, 2000); if (!text) throw new Error('text is required');
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await gh(`/contents/${enc(NOTES)}?ref=${DATA}`, { ok: [404], write: true }), j = cur.status === 404 ? null : await cur.json();
    const notes = j ? JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) : [];
    const note = { at: new Date().toISOString(), by: who, trade: a.trade_id ? String(a.trade_id).slice(0, 60) : null, text };
    notes.push(note); while (notes.length > 3000) notes.shift();
    const r = await gh(`/contents/${enc(NOTES)}`, { method: 'PUT', write: true, ok: [409, 422], body: { message: `ICT note by ${who} (MCP)`, branch: DATA, content: Buffer.from(JSON.stringify(notes, null, 1)).toString('base64'), ...(j ? { sha: j.sha } : {}) } });
    if (r.ok) { CACHE.delete(`${DATA}:${NOTES}:j`); return { saved: true, note, total: notes.length }; }
  }
  throw new Error('the notes file moved twice; try again');
}
// new network / environment / process access in an ICT file needs the owner, not a helper's PR (CI runs the code of the branch)
const RISKY = [['child_process', /child_process|\bspawn\s*\(|\bexecSync\s*\(/g], ['process.env', /process\.env/g], ['eval / new Function', /\beval\s*\(|new\s+Function\s*\(/g],
  ['network access', /\bfetch\s*\(|node:https?\b|node:net\b|node:dgram\b|\bXMLHttpRequest\b|\bWebSocket\b/g], ['an import from api/ or council/', /['"](?:\.\.\/)+(?:api|council)\//g]];
const count = (s, re) => (String(s || '').match(re) || []).length;
function syntaxCheck(p, content) {
  if (/\.json$/.test(p)) { try { JSON.parse(content); } catch (e) { throw new Error(`${p} is not valid JSON: ${e.message}`); } return 'JSON ok'; }
  if (!/\.mjs$/.test(p)) return null;
  const f = pathM.join(os.tmpdir(), `mcp-check-${crypto.randomBytes(6).toString('hex')}.mjs`);
  fs.writeFileSync(f, content);
  try { execFileSync(process.execPath, ['--check', f], { timeout: 10000, stdio: 'pipe' }); return 'node --check ok'; }
  catch (e) { const msg = String((e.stderr && e.stderr.toString()) || e.message).split(f).join(p).split('\n').filter(Boolean).slice(0, 6).join('\n'); throw new Error(`syntax error in ${p}:\n${msg}`); }
  finally { try { fs.unlinkSync(f); } catch (e) {} }
}
// everything checked before a single GitHub write; returns what the PR body reports
async function validateProposal(files) {
  if (!Array.isArray(files) || !files.length) throw new Error('files[] is required');
  if (files.length > 12) throw new Error('at most 12 files per proposal');
  let bytes = 0; const seen = new Set();
  for (const f of files) {
    if (!f || !okPath(f.path)) throw new Error(`path not allowed: ${f && f.path}. Allowed: ${ALLOW_TEXT}`);
    if (seen.has(f.path)) throw new Error(`${f.path} twice`); seen.add(f.path);
    if (typeof f.content !== 'string') throw new Error(`content must be a string: ${f.path}`);
    if (Buffer.byteLength(f.content) > 200e3) throw new Error(`${f.path} over 200 KB`); bytes += Buffer.byteLength(f.content);
  }
  if (bytes > 400e3) throw new Error('proposal over 400 KB');
  const old = await Promise.all(files.map((f) => file(MAIN, f.path, { json: false, ttl: 0 })));
  const report = [];
  files.forEach((f, i) => {
    if (old[i] === f.content) throw new Error(`${f.path} is identical to main: send only the files you changed`);
    const chk = syntaxCheck(f.path, f.content);
    if (/\.mjs$/.test(f.path)) for (const [what, re] of RISKY) if (count(f.content, re) > count(old[i], re)) throw new Error(`${f.path} adds ${what}. That needs the owner: describe it with ict_note instead of a proposal.`);
    report.push({ path: f.path, status: old[i] == null ? 'new' : 'changed', check: chk });
  });
  const rule = files.filter((f) => RULE_RE.test(f.path)), tests = files.filter((f, i) => TEST_RE.test(f.path) && /from ['"]node:test['"]/.test(f.content) && /\b(test|it)\s*\(/.test(f.content));
  if (rule.length && !tests.length) throw new Error('a change to ict/*.mjs or the ICT skill must add or update a test: tests/ict-<topic>.test.mjs using node:test, which fails without your change and passes with it');
  return { report, tests: tests.map((f) => f.path) };
}
const fx = (v, d = 2) => (v == null ? '-' : (+v).toFixed(d));
function evidenceMd(c) {
  const row = (k, lbl) => `| ${lbl} | ${c.live[k].n} | ${fx(c.live[k].avgR, 3)} | ${fx(c.live[k].netR, 1)} | ${fx(c.live[k].pf)} | ${fx(c.live[k].maxDD, 1)} | ${c.proposed[k].n} | ${fx(c.proposed[k].avgR, 3)} | ${fx(c.proposed[k].netR, 1)} | ${fx(c.proposed[k].pf)} | ${fx(c.proposed[k].maxDD, 1)} |`;
  return [`Server run of \`ict_compare\` (the desk's own engine, ${c.markets.join(', ')}, ${c.window.from} to ${c.window.to}; out of sample from ${c.window.oos_from}), proposal: \`${JSON.stringify(c.proposal)}\``, '',
    '| set | live n | live avg R | live net R | live PF | live max DD | prop. n | prop. avg R | prop. net R | prop. PF | prop. max DD |', '|---|---|---|---|---|---|---|---|---|---|---|',
    row('all', 'all'), row('is', 'in sample'), row('oos', 'out of sample'), '', '| year | live n | live net R | prop. n | prop. net R |', '|---|---|---|---|---|',
    ...c.byYear.map((y) => `| ${y.year} | ${y.live ? y.live.n : 0} | ${fx(y.live && y.live.netR, 1)} | ${y.proposed ? y.proposed.n : 0} | ${fx(y.proposed && y.proposed.netR, 1)} |`), '',
    `Verdict: ${c.verdict}. Proposal OOS screen: ${c.proposed.verdict}.`, ...(c.notes || []).map((n) => `> ${n}`)].join('\n');
}
async function propose(who, a) {
  const title = String(a.title || '').trim().slice(0, 100), why = String(a.why || '').trim().slice(0, 4000), what = String(a.what || title).trim().slice(0, 3000), risk = String(a.risk || '').trim().slice(0, 2000);
  if (!title || !why) throw new Error('title and why are required');
  if (!risk) throw new Error('risk is required: what could go wrong live (more trades, wider stops, drawdown), and what you did not test');
  if (!a.evidence && !a.evidence_run) throw new Error('evidence is required: the ict_backtest / ict_compare numbers on 2020-now with in sample vs out of sample, or evidence_run so the server reruns the comparison');
  const v = await validateProposal(a.files), files = a.files;
  let ev = a.evidence ? noPing(String(a.evidence).slice(0, 6000)) : '';
  if (a.evidence_run) {
    try { const c = await lab.compare({ markets: a.evidence_run.markets, rule: a.evidence_run.rule, params: a.evidence_run.params, filters: a.evidence_run.filters, from: '2020-01-01' }, process.env, { ...labIO, budgetMs: 30e3 }); ev = `${evidenceMd(c)}${ev ? `\n\n**From the proposer:**\n\n${ev}` : ''}`; }
    catch (e) { if (!ev) throw new Error(`the evidence run failed (${scrubErr(e)}); send evidence as text from your own ict_compare run`); ev += `\n\n> The server's evidence run failed: ${scrubErr(e)}`; }
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'change', branch = `mcp/${who}/${Date.now().toString(36)}-${slug}`;
  const head = (await (await gh(`/git/ref/heads/${MAIN}`)).json()).object.sha, base = (await (await gh(`/git/commits/${head}`)).json()).tree.sha;
  const tree = []; for (const f of files) { const b = await (await gh('/git/blobs', { method: 'POST', write: true, body: { content: f.content, encoding: 'utf-8' } })).json(); tree.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha }); }
  const t = await (await gh('/git/trees', { method: 'POST', write: true, body: { base_tree: base, tree } })).json();
  const msg = `${title}\n\n${why}\n\nProposed by ${who} through the ICT MCP. Paper research; nothing changes live until the owner merges.`;
  const c = await (await gh('/git/commits', { method: 'POST', write: true, body: { message: msg, tree: t.sha, parents: [head] } })).json();
  await gh('/git/refs', { method: 'POST', write: true, body: { ref: `refs/heads/${branch}`, sha: c.sha } });
  const body = [`**Proposed by ${who}** through the ICT MCP (${new Date().toISOString().slice(0, 16)} UTC). Paper research on the ICT edge; the owner reviews and decides. Nothing changes live until merged.`, '',
    '## What', noPing(what), '', '## Why', noPing(why), '', '## Evidence (2020-now, in sample vs out of sample)', ev || '-', '', '## Risk', noPing(risk), '',
    ...(a.tests_run ? ['## Tests the proposer ran', noPing(String(a.tests_run).slice(0, 1500)), ''] : []),
    '## Server checks', ...v.report.map((r) => `- \`${r.path}\` (${r.status})${r.check ? `: ${r.check}` : ''}`), `- paths: ICT allowlist only; no new network, environment or process access`, `- test: ${v.tests.length ? v.tests.map((x) => '`' + x + '`').join(', ') : 'none needed (research files only)'}`, '',
    '## Owner checklist', '- [ ] CI green', '- [ ] the out-of-sample numbers hold (rerun `ict_compare` or the replay)', '- [ ] every trade still has a stop; paper only', '- [ ] the decision is recorded as a dated section in .claude/skills/ICT/SKILL.md'].join('\n').slice(0, 60000);
  const pr = await gh('/pulls', { method: 'POST', write: true, ok: [403, 404, 422], body: { title: `ICT (${who}): ${title}`, head: branch, base: MAIN, body, draft: true } });
  const compare = `https://github.com/${REPO}/compare/${MAIN}...${encodeURIComponent(branch)}?expand=1`;
  if (pr.ok) { const j = await pr.json(); return { branch, pr: j.html_url, number: j.number, checks: v.report, note: 'Draft PR opened for the owner. CI runs the tests on it; follow it with ict_my_proposals.' }; }
  return { branch, compare, checks: v.report, note: `Branch pushed; the token could not open the PR (GitHub ${pr.status}). The owner opens it from the compare link.` };
}
const mine = (who, pr) => pr && pr.head && typeof pr.head.ref === 'string' && pr.head.ref.startsWith(`mcp/${who}/`) && (!pr.head.repo || pr.head.repo.full_name === REPO);
async function myProposals(who, a) {
  const limit = Math.min(Math.max(a.limit || 10, 1), 20), want = a.state || 'all';
  const all = await (await gh(`/pulls?state=${want === 'merged' ? 'closed' : want}&per_page=100&sort=created&direction=desc`)).json();
  const prs = (all || []).filter((p) => mine(who, p) && (want !== 'merged' || p.merged_at)).slice(0, limit);
  const out = await Promise.all(prs.map(async (p, i) => {
    const row = { number: p.number, title: p.title, state: p.merged_at ? 'merged' : p.state, draft: !!p.draft, url: p.html_url, branch: p.head.ref, created: p.created_at, updated: p.updated_at };
    if (i >= 5) return row;   // details for the newest five
    const [cr, cm, rv] = await Promise.all([gh(`/commits/${p.head.sha}/check-runs?per_page=50`, { ok: [403, 404] }), gh(`/issues/${p.number}/comments?per_page=50`, { ok: [403, 404] }), gh(`/pulls/${p.number}/reviews?per_page=50`, { ok: [403, 404] })]);
    const runs = cr.ok ? ((await cr.json()).check_runs || []) : null;
    row.ci = runs == null ? 'unknown (the token cannot read check runs)' : !runs.length ? 'no checks yet' : runs.some((r) => r.status !== 'completed') ? 'running' : runs.every((r) => ['success', 'skipped', 'neutral'].includes(r.conclusion)) ? 'passed' : 'failed';
    if (runs && runs.length) row.checks = runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
    const cmt = (c) => ({ by: c.user && c.user.login, owner: !!c.user && c.user.login === OWNER, mine: /^\*\*[a-z0-9-]+\*\* \(ICT MCP\)/.test(c.body || '') && (c.body || '').startsWith(`**${who}**`), at: c.created_at || c.submitted_at, ...(c.state ? { review: c.state } : {}), text: scrubErr(String(c.body || '').slice(0, 1500)) });
    row.comments = [...(cm.ok ? await cm.json() : []), ...(rv.ok ? (await rv.json()).filter((r) => r.body || r.state !== 'COMMENTED') : [])].map(cmt).sort((x, y) => String(x.at).localeCompare(String(y.at))).slice(-8);
    return row;
  }));
  return { total: out.length, proposals: out, note: out.length ? 'CI = the repo tests on your branch. Comments from the owner carry owner: true.' : 'No proposals yet: ict_propose_change opens one.' };
}
async function proposalComment(who, a) {
  const n = a.number, text = String(a.text || '').trim().slice(0, 4000); if (!Number.isInteger(n) || n < 1) throw new Error('number is the PR number'); if (!text) throw new Error('text is required');
  const r = await gh(`/pulls/${n}`, { ok: [404] }); if (r.status === 404) throw new Error('no such pull request');
  const pr = await r.json(); if (!mine(who, pr)) throw new Error('you can comment only on your own proposals (branches mcp/<you>/…)');
  const c = await (await gh(`/issues/${n}/comments`, { method: 'POST', write: true, body: { body: `**${who}** (ICT MCP): ${noPing(text)}` } })).json();
  return { saved: true, url: c.html_url, number: n };
}

// ---- tools ----
// annotations (MCP 2025-06-18+): read tools are read-only and idempotent; writes add, never delete (destructiveHint false). Data
// tools are a closed world (this repo); proposals and comments reach GitHub, where other people see them (openWorldHint true).
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WR = (open) => ({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: open });
const T = (name, title, description, properties = {}, required = [], o = {}) => ({ name, title, description, inputSchema: { type: 'object', properties, required, additionalProperties: false },
  ...(o.out ? { outputSchema: o.out } : {}), annotations: { title, ...(o.ann || RO) }, _cls: o.cls || 'read', _write: !!o.write });
const S = (description, x = {}) => ({ type: 'string', description, ...x });
const N = (description, x = {}) => ({ type: 'number', description, ...x });
const I = (description, x = {}) => ({ type: 'integer', description, ...x });
const B = (description, x = {}) => ({ type: 'boolean', description, ...x });
const STATS = { type: 'object', properties: { n: { type: 'integer' }, winRate: { type: ['number', 'null'] }, avgR: { type: ['number', 'null'] }, netR: { type: 'number' }, pf: { type: ['number', 'null'] }, maxDD: { type: 'number' }, t: { type: ['number', 'null'] } } };
const MARKET = S('desk market: nq, es, ym, rty, gc; paper market xag; or any OANDA key (eurusd, de40, jp225 …, index A-setup rule)');
const LAB_PARAMS = { type: 'object', additionalProperties: false, description: 'overrides of the tracker parameters P for this run only (the live rule never changes)', properties: {
  piv: I('swing confirmation candles each side', { minimum: 1, maximum: 6, default: 3 }), look: I('H1 candles a swing stays active', { minimum: 24, maximum: 240, default: 96 }),
  vmax: I('max H1 candles from the sweep to the inversion', { minimum: 1, maximum: 12, default: 6 }), maxAtr: N('max stop size in H1 ATRs (bigger: no trade)', { minimum: 1, maximum: 20, default: 8 }),
  holdH: I('closed H1 candles before the time exit', { minimum: 6, maximum: 120, default: 36 }), be: N('R at which index trades move the stop to entry; 0 = no break-even', { minimum: 0, maximum: 5, default: 1.5 }),
  trail_from: N('R at which the trailing stop starts; 0 = no trail', { minimum: 0, maximum: 6, default: 2 }), trail_dist: N('trail distance behind the best price, in R', { minimum: 0.25, maximum: 5, default: 1.5 }),
  mark: N('the R mark recorded as R2', { minimum: 1, maximum: 5, default: 2 }) } };
const LAB_FILTERS = { type: 'object', additionalProperties: false, description: 'extra conditions on the signals (all must hold), on top of the rule', properties: {
  min_grade: I('minimum candle-closure grade /10', { minimum: 3, maximum: 10 }), sides: { type: 'array', items: { type: 'string', enum: ['buy', 'sell'] }, maxItems: 2, description: 'only these sides' },
  sessions: { type: 'array', items: { type: 'string', enum: lab.SESSIONS }, maxItems: 5, description: 'only signals in these New York sessions' },
  atr_min: N('stop >= this x the daily ATR', { minimum: 0, maximum: 3 }), atr_max: N('stop < this x the daily ATR', { minimum: 0, maximum: 5 }),
  bias: S('daily bias vs the trade', { enum: ['with', 'against', 'any'] }), zone: S('premium / discount of the 20-day range', { enum: ['discount', 'premium', 'any'] }),
  min_body: N('inversion candle body share of its range', { minimum: 0, maximum: 1 }), max_speed: I('max candles from the sweep to the inversion', { minimum: 0, maximum: 12 }),
  htf_fvg: B('only when the sweep traded into an unfilled D1 / H4 FVG'), skip_friday: B('skip signals closing on a New York Friday'), min_room_r: N('the draw on liquidity at least this many R away', { minimum: 0, maximum: 10 }) } };
const LAB_COMMON = { markets: { type: 'array', items: MARKET, minItems: 1, maxItems: 5, description: 'markets to test together (default nq, es, ym, rty, gc)' }, market: { ...MARKET, description: 'one market (or use markets)' },
  from: S('first day, YYYY-MM-DD, 2020-01-01 or later', { default: '2020-01-01' }), to: S('last day, YYYY-MM-DD (default today)'), oos_from: S('first out-of-sample day', { default: '2024-01-01' }),
  rule: S('A = the live A-setup rule of each market; all = every signal graded >= 3', { enum: ['A', 'all'], default: 'A' }), params: LAB_PARAMS, filters: LAB_FILTERS,
  sizing: S('live = the desk\'s A-setup sizing (DOL room, half size on tight stops); flat = 1 unit a trade', { enum: ['live', 'flat'], default: 'live' }), cost: B('net of a round-trip cost a trade', { default: true }) };
const RUN_OUT = (extra) => ({ type: 'object', required: ['window', ...Object.keys(extra)], properties: { window: { type: 'object' }, notes: { type: 'array', items: { type: 'string' } }, ...extra } });
const TOOLS = [
  T('ict_guide', 'ICT desk guide', 'Start here. How the ICT desk works, its model and A-setup rules, the research rules (every trade has a stop, paper only, an edge must pass out of sample on 2020-now data, the owner approves rule changes), the suggested workflow, the backtest parameters, the data sources and the limits.', {}, [],
    { out: { type: 'object', required: ['desk', 'rules', 'workflow'], properties: { desk: { type: 'string' }, rules: { type: 'array', items: { type: 'string' } }, workflow: { type: 'array', items: { type: 'string' } } } } }),
  T('ict_rules', 'ICT rule book', 'The ICT edge rule book (.claude/skills/ICT/SKILL.md) and the live tracker parameters. Without a section: the index of sections and the live parameters. With section (number or words from its title): that section\'s text.', { section: S('section number ("14") or words from the title ("A-setup")') }),
  T('ict_trades', 'ICT trades and stats', 'ICT signals with statistics. source: live (the running tracker since 6 Nov 2026), replay (the same rule over CNBC futures since Aug 2025) or both (default; a live signal is never counted twice). Filters: market, status, grade (A = A-setups, A+ = A+ tier, or a letter like B), side, since / until. Returns stats for the whole filtered set and a page of records, newest first.',
    { source: S('which records', { enum: ['live', 'replay', 'both'], default: 'both' }), market: S('nq, es, ym, rty or gc'), status: S('outcome', { enum: ['open', 'win', 'loss', 'be', 'closed'] }), grade: S('A, A+ or a grade letter'), side: S('side', { enum: ['buy', 'sell'] }), since: S('YYYY-MM-DD'), until: S('YYYY-MM-DD'),
      limit: I('records in the page', { minimum: 1, maximum: 200, default: 50 }), offset: I('records to skip', { minimum: 0, default: 0 }), full: B('every recorded field (features, grade parts, path) instead of a brief line', { default: false }) }),
  T('ict_trade', 'One ICT trade', 'One ICT signal with every recorded field (features, grade, sweep, FVG, draw on liquidity, excursion path).', { id: S('trade id from ict_trades') }, ['id']),
  T('ict_status', 'ICT tracker status', 'The tracker\'s latest state: each market\'s price, last signal, previous day high / low, open paper trades, the shadow variants\' totals, and the notes written through this MCP.'),
  T('ctrader_results', 'Demo cTrader results', 'Demo cTrader results of the mirror accounts by edge label (Council, ICT, Shadows, LIT, Replica): balance, equity, floating, open positions, resting orders, recent history. Account numbers and ids are never included.'),
  T('ict_bars', 'Candles', 'OHLC candles (OANDA mid) for a market, timeframe and window: rows [time UTC, open, high, low, close, volume], at most 1500. Without from / to: the latest count candles. Desk markets map to cash CFDs (NQ → NAS100, ES → SPX500, YM → US30, RTY → US2000, GC → XAU spot).',
    { market: MARKET, tf: S('timeframe', { enum: Object.keys(lab.TF), default: '1h' }), from: S('start, YYYY-MM-DD or ISO time'), to: S('end, YYYY-MM-DD or ISO time (default now)'), count: I('max candles returned', { minimum: 1, maximum: 1500, default: 300 }) }, ['market'],
    { cls: 'bars', out: { type: 'object', required: ['market', 'tf', 'cols', 'rows'], properties: { market: { type: 'string' }, tf: { type: 'string' }, count: { type: 'integer' }, cols: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array' } } } } }),
  T('ict_backtest', 'Backtest the ICT model', 'Run the desk\'s own ICT iFVG engine (the code ict/replay.mjs uses) on 2020-now H1 candles with your parameter overrides and filters. Returns n, win rate, average R, net R, profit factor, max drawdown (R), t, by year, by side, in sample vs out of sample (default split 2024-01-01), the out-of-sample screen and a sample of trades. Paper research: the live rules never change.',
    { ...LAB_COMMON, sample: S('which trades to show', { enum: ['recent', 'worst', 'best'], default: 'recent' }), sample_size: I('trades in the sample', { minimum: 0, maximum: 50, default: 20 }) }, [],
    { cls: 'heavy', out: RUN_OUT({ combined: { type: 'object', properties: { all: STATS, is: STATS, oos: STATS, byYear: { type: 'object' }, verdict: { type: 'string' } } }, markets: { type: 'object' }, sample: { type: 'array' } }) }),
  T('ict_compare', 'Live rule vs your proposal', 'The live rule (A-setups, today\'s parameters) against your proposal (rule / params / filters) on the same candles and window: both stats sets, the deltas in sample and out of sample, year by year and market by market, and a verdict. Use it before ict_propose_change.',
    LAB_COMMON, [], { cls: 'heavy', out: RUN_OUT({ live: { type: 'object' }, proposed: { type: 'object' }, delta: { type: 'object' }, byYear: { type: 'array' }, verdict: { type: 'string' } }) }),
  T('ict_file_list', 'ICT source files', 'List the ICT source files on main that a proposal may change (tracker, replay, calendar, the skill, tests, research).'),
  T('ict_file_read', 'Read an ICT file', `Read one ICT source file from main. Allowed: ${ALLOW_TEXT}.`, { path: S('repository path, e.g. ict/tracker.mjs') }, ['path']),
  T('ict_my_proposals', 'My proposals', 'Your proposals (pull requests from branches mcp/<you>/…): state (open / merged / closed), draft, CI result and check runs, and the latest comments and reviews (the owner\'s carry owner: true).',
    { state: S('which ones', { enum: ['open', 'closed', 'merged', 'all'], default: 'all' }), limit: I('how many, newest first', { minimum: 1, maximum: 20, default: 10 }) }, [],
    { out: { type: 'object', required: ['proposals'], properties: { total: { type: 'integer' }, proposals: { type: 'array' }, note: { type: 'string' } } } }),
  T('ict_note', 'Save a note', 'Save a note (a review, an observation, a question for the owner), optionally on one trade id. Kept in council-data ict/mcp-notes.json with your name and the time; shown in ict_status.', { text: S('the note', { maxLength: 2000 }), trade_id: S('optional trade id') }, ['text'], { ann: WR(false), cls: 'write', write: true }),
  T('ict_propose_change', 'Propose a change', 'Propose a change to the ICT edge as a DRAFT pull request for the owner (branch mcp/<you>/…). Send the WHOLE new content of each changed file (read it first with ict_file_read). The server checks: allowlisted paths only; a change to ict/*.mjs or the skill must add or update a test tests/ict-<topic>.test.mjs (node:test); node --check on every .mjs and JSON parse on .json; no new network / environment / process access. The PR body has What / Why / Evidence (2020-now, in sample vs out of sample) / Risk; pass evidence_run and the server reruns ict_compare on 2020-now and puts the table in. Nothing changes live until the owner merges.',
    { title: S('short title', { maxLength: 100 }), what: S('what the change does, in plain words'), why: S('why: the idea and the ICT reasoning'), evidence: S('your numbers: ict_backtest / ict_compare on 2020-now, IS vs OOS, every variant you tried'),
      evidence_run: { type: 'object', additionalProperties: false, description: 'optional: the server runs ict_compare 2020-now with these and puts the table in the PR', properties: { markets: LAB_COMMON.markets, rule: LAB_COMMON.rule, params: LAB_PARAMS, filters: LAB_FILTERS } },
      risk: S('what could go wrong live, and what you did not test'), files: { type: 'array', minItems: 1, maxItems: 12, description: 'changed files with their whole new content', items: { type: 'object', additionalProperties: false, properties: { path: S('allowed repository path'), content: S('the whole new file') }, required: ['path', 'content'] } },
      tests_run: S('optional: tests you ran and their result') }, ['title', 'why', 'risk', 'files'], { ann: WR(true), cls: 'propose', write: true }),
  T('ict_proposal_comment', 'Comment on my proposal', 'Comment on one of YOUR proposals (pull request number from ict_my_proposals), e.g. to answer the owner. Your name is put in front.', { number: I('pull request number', { minimum: 1 }), text: S('the comment', { maxLength: 4000 }) }, ['number', 'text'], { ann: WR(true), cls: 'write', write: true }),
  // ChatGPT deep research / company knowledge: exactly these two shapes
  T('search', 'Search the ICT desk', 'Search ICT trades (by id, market, grade, session, outcome), the rule book sections and the guide. Returns { results: [{ id, title, url }] }; pass an id to fetch.', { query: S('words to look for') }, ['query']),
  T('fetch', 'Fetch an ICT document', 'Fetch a full document by id from search: trade:<signal id>, rule:<section number> or guide:desk. Returns { id, title, text, url, metadata }.', { id: S('an id from search') }, ['id']),
];
const TOOL = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
const publicTool = ({ _cls, _write, ...t }) => t;
const page = (rows, a) => { const limit = Math.min(Math.max(+a.limit || 50, 1), 200), offset = Math.max(+a.offset || 0, 0); return { total: rows.length, offset, limit, records: rows.slice(offset, offset + limit) }; };

// arguments against the tool's input schema (types, enums, ranges, required, unknown keys): a bad argument is a tool error the
// model can read and fix, not a protocol error (MCP 2025-11-25)
function check(s, v, p = 'arguments') {
  const types = [].concat(s.type || []), is = (t) => t === 'null' ? v === null : t === 'array' ? Array.isArray(v) : t === 'integer' ? Number.isInteger(v) : t === 'number' ? typeof v === 'number' && isFinite(v) : t === 'object' ? !!v && typeof v === 'object' && !Array.isArray(v) : typeof v === t;
  if (types.length && !types.some(is)) return `${p} must be ${types.join(' or ')}`;
  if (s.enum && !s.enum.includes(v)) return `${p} must be one of ${s.enum.join(', ')}`;
  if (typeof v === 'number') { if (s.minimum != null && v < s.minimum) return `${p} must be >= ${s.minimum}`; if (s.maximum != null && v > s.maximum) return `${p} must be <= ${s.maximum}`; }
  if (typeof v === 'string' && s.maxLength != null && v.length > s.maxLength) return `${p} is longer than ${s.maxLength} characters`;
  if (Array.isArray(v)) { if (s.maxItems != null && v.length > s.maxItems) return `${p}: at most ${s.maxItems} items`; if (s.minItems != null && v.length < s.minItems) return `${p}: at least ${s.minItems} item(s)`; if (s.items) for (let i = 0; i < v.length; i++) { const e = check(s.items, v[i], `${p}[${i}]`); if (e) return e; } }
  if (v && typeof v === 'object' && !Array.isArray(v) && s.properties) {
    for (const r of s.required || []) if (v[r] === undefined) return `${p}.${r} is required`;
    for (const [k, x] of Object.entries(v)) { if (!s.properties[k]) { if (s.additionalProperties === false) return `${p}.${k} is not a known argument (known: ${Object.keys(s.properties).join(', ') || 'none'})`; continue; } if (x === undefined) continue; const e = check(s.properties[k], x, `${p}.${k}`); if (e) return e; }
  }
  return null;
}
async function call(who, name, a = {}) {
  switch (name) {
    case 'ict_guide': return GUIDE;
    case 'ict_rules': { const S2 = sections(await skill()); if (!a.section) return { live: await liveParams(), sections: S2.map((s) => ({ n: s.n, title: s.title })), note: 'Sections 11+ are the owner\'s tests and decisions, dated; the rules in force are the latest dated ones.' };
      const q = String(a.section).toLowerCase(), s = S2.find((x) => String(x.n) === q) || S2.find((x) => x.title.toLowerCase().includes(q)); if (!s) throw new Error('no such section'); return { n: s.n, title: s.title, text: s.text.trim() }; }
    case 'ict_trades': { const rows = filterTrades(await allTrades(a.source || 'both'), a), p = page(rows, a); return { stats: stats(rows), ...p, records: p.records.map((t) => a.full ? t : brief(t)) }; }
    case 'ict_trade': { const t = (await allTrades('both')).find((x) => x.id === a.id || x.id === `${a.id}-r` || `${x.id}-r` === a.id); if (!t) throw new Error('no such trade'); return t; }
    case 'ict_status': { const [snap, shadow, live, notes] = await Promise.all([file(DATA, 'ict/snapshot.json'), file(DATA, 'ict/shadow.json'), file(DATA, 'ict/trades.json'), file(DATA, NOTES)]);
      return { snapshot: snap, openLive: (live || []).filter((t) => t.status === 'open').map(brief), shadow: shadow && { variant: shadow.variant, since: shadow.since, totals: shadow.totals, variants: Object.fromEntries(Object.entries(shadow.variants || {}).map(([k, v]) => [k, v.totals])) }, notes: (notes || []).slice(-20) }; }
    case 'ctrader_results': { const j = await file(DATA, 'ctrader/accounts.json', { ttl: 10e3 }); if (!j) return { note: 'no snapshot yet' }; return scrub({ at: j.at, accounts: (j.accounts || []).map((x) => ({ label: x.label, books: x.books, balance: x.balance, equity: x.equity, floating: x.floating, open: x.open, orders: x.orders, history: x.history, error: x.error })) }); }
    case 'ict_bars': return lab.bars(a, process.env);
    case 'ict_backtest': return lab.backtest(a, process.env, labIO);
    case 'ict_compare': return lab.compare(a, process.env, labIO);
    case 'ict_file_list': { const t = await (await gh(`/git/trees/${MAIN}?recursive=1`, { timeout: 20000 })).json(); return { files: (t.tree || []).filter((x) => x.type === 'blob' && okPath(x.path)).map((x) => ({ path: x.path, bytes: x.size })) }; }
    case 'ict_file_read': { if (!okPath(a.path)) throw new Error(`path not allowed. Allowed: ${ALLOW_TEXT}`); const s = await file(MAIN, a.path, { json: false, ttl: 30e3 }); if (s == null) throw new Error('not found'); return { path: a.path, bytes: Buffer.byteLength(s), content: s }; }
    case 'ict_my_proposals': return myProposals(who, a);
    case 'ict_note': return addNote(who, a);
    case 'ict_propose_change': return propose(who, a);
    case 'ict_proposal_comment': return proposalComment(who, a);
    case 'search': { const q = String(a.query || '').toLowerCase().split(/\s+/).filter(Boolean), rows = await allTrades('both'), S2 = sections(await skill());
      const hit = (s) => q.every((w) => s.includes(w)), results = [];
      if (hit(`guide workflow rules desk how ${GUIDE.desk} ${GUIDE.rules.join(' ')}`.toLowerCase())) results.push({ id: 'guide:desk', title: 'ICT desk guide: model, rules, workflow', url: `https://github.com/${REPO}/blob/${MAIN}/docs/fred-mcp.md` });
      for (const s of S2) if (hit(`${s.n} ${s.title} ${s.text}`.toLowerCase())) results.push({ id: `rule:${s.n}`, title: `§${s.n} ${s.title}`, url: `https://github.com/${REPO}/blob/${MAIN}/.claude/skills/ICT/SKILL.md` });
      for (const t of rows) { if (results.length >= 50) break; const b = brief(t); if (hit(JSON.stringify(b).toLowerCase())) results.push({ id: `trade:${t.id}`, title: `${b.market} ${b.side} ${b.signal} ${b.grade || ''} ${b.status} ${b.R ?? ''}R`.trim(), url: 'https://meridianx.dev/#ict' }); }
      return { results: results.slice(0, 50) }; }
    case 'fetch': { const id = String(a.id || '');
      if (id === 'guide:desk') return { id, title: 'ICT desk guide', text: [GUIDE.desk, GUIDE.aSetup, 'Rules:', ...GUIDE.rules, 'Workflow:', ...GUIDE.workflow, GUIDE.params, GUIDE.data, GUIDE.limits].join('\n\n'), url: `https://github.com/${REPO}/blob/${MAIN}/docs/fred-mcp.md`, metadata: { kind: 'guide' } };
      if (id.startsWith('rule:')) { const s = sections(await skill()).find((x) => String(x.n) === id.slice(5)); if (!s) throw new Error('no such rule'); return { id, title: `§${s.n} ${s.title}`, text: s.text.trim(), url: `https://github.com/${REPO}/blob/${MAIN}/.claude/skills/ICT/SKILL.md`, metadata: { kind: 'rule', section: s.n } }; }
      const tid = id.replace(/^trade:/, ''), t = (await allTrades('both')).find((x) => x.id === tid); if (!t) throw new Error('no such trade'); return { id, title: `${t.short} ${t.side} ${iso(t.signalAt)}`, text: JSON.stringify(t, null, 1), url: 'https://meridianx.dev/#ict', metadata: { kind: 'trade', ...brief(t) } }; }
    default: throw new Error(`unknown tool ${name}`);
  }
}

// ---- JSON-RPC ----
// ctx: { who, level ('read' | 'write'), version }. Returns the response object, or null for a notification / client response.
async function rpc(who, m, ctx = {}) {
  const level = ctx.level || 'read';
  if (!m || typeof m !== 'object' || Array.isArray(m) || m.jsonrpc !== '2.0') return { jsonrpc: '2.0', id: m && typeof m === 'object' && (typeof m.id === 'string' || typeof m.id === 'number') ? m.id : null, error: { code: -32600, message: 'invalid request: a JSON-RPC 2.0 object is expected' } };
  if (m.method === undefined && ('result' in m || 'error' in m)) return null;   // a client's response to a server request: nothing to say
  if (typeof m.method !== 'string') return { jsonrpc: '2.0', id: m.id ?? null, error: { code: -32600, message: 'invalid request: method missing' } };
  if (m.id === undefined) return null;   // a notification (notifications/initialized, cancelled, …): no response
  if (!(typeof m.id === 'string' || typeof m.id === 'number')) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'invalid request: id must be a string or a number' } };
  const res = (result) => ({ jsonrpc: '2.0', id: m.id, result }), err = (code, message) => ({ jsonrpc: '2.0', id: m.id, error: { code, message } });
  if (m.params !== undefined && (m.params === null || typeof m.params !== 'object')) return err(-32602, 'params must be an object');
  const p = m.params || {};
  switch (m.method) {
    case 'initialize': { const v = p.protocolVersion; return res({ protocolVersion: VERSIONS.includes(v) ? v : VERSIONS[0], capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'meridian-ict', title: 'Meridian ICT desk', version: VERSION, description: 'Research, backtest and propose changes to the Meridian ICT edge (paper trading).', websiteUrl: 'https://meridianx.dev' }, instructions: INSTR }); }
    case 'ping': return res({});
    case 'tools/list': return res({ tools: TOOLS.filter((t) => !t._write || level === 'write').map(publicTool) });
    case 'tools/call': {
      if (typeof p.name !== 'string') return err(-32602, 'params.name (the tool name) is required');
      const tool = TOOL[p.name]; if (!tool || (tool._write && level !== 'write')) return err(-32602, tool ? `${p.name} needs ICT write permission; ask the owner` : `unknown tool ${p.name}`);
      if (p.arguments !== undefined && (p.arguments === null || typeof p.arguments !== 'object' || Array.isArray(p.arguments))) return err(-32602, 'params.arguments must be an object');
      const a = p.arguments || {}, fail = (text) => res({ content: [{ type: 'text', text }], isError: true });
      const bad = check(tool.inputSchema, a); if (bad) return fail(`Invalid arguments: ${bad}`);
      const wait = limited(who, 'all') || (tool._cls !== 'read' && limited(who, tool._cls, Date.now(), tool._cls === 'propose')) || (tool._write && tool._cls !== 'write' && limited(who, 'write'));
      if (wait) return fail(`Rate limit: try again in ${wait} s (limits: ${GUIDE.limits.split('.')[0]}).`);
      try {
        const out = await call(who, p.name, a); if (tool._cls === 'propose') limited(who, 'propose');
        let text = JSON.stringify(out, null, 1), cut = false;
        if (text.length > TEXT_CAP) { text = JSON.stringify(out); if (text.length > TEXT_CAP) { text = text.slice(0, TEXT_CAP) + '\n…(cut at 150 000 characters; narrow the filters or use limit / offset)'; cut = true; } }
        return res({ content: [{ type: 'text', text }], ...(!cut && out && typeof out === 'object' && !Array.isArray(out) ? { structuredContent: out } : {}) });
      } catch (e) { return fail(`Error: ${scrubErr(e)}`); }
    }
    default: return err(-32601, `method not found: ${m.method}`);
  }
}

// browser origins allowed to call (no Origin = a server-side client such as ChatGPT, Claude or Cursor: allowed)
const ORIGINS = [/^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|claude\.com|meridianx\.dev)$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const originOk = (o, env = process.env) => !o || ORIGINS.some((re) => re.test(o)) || String(env.MCP_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean).includes(o);
const rpcErr = (res, code, rpcCode, message) => res.status(code).json({ jsonrpc: '2.0', id: null, error: { code: rpcCode, message } });

module.exports = async (req, res) => {
  const t0 = Date.now(), H = req.headers || {};
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID'); res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originOk(H.origin)) return rpcErr(res, 403, -32600, 'origin not allowed');
  // the profile page (owner, 8 Nov: "make it available in Fred's profile, only Fred"): a member proves the desk password and gets the
  // connector URL; no other user is answered, whatever MCP_KEYS holds. The password check is ctrader-link's (same user list).
  if (req.method === 'POST' && !(req.query && req.query.key) && req.body && (typeof req.body === 'object' ? req.body.action : /"action"\s*:\s*"mykey"/.test(req.body))) {
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (b.action !== 'mykey') return res.status(400).json({ error: 'unknown action' });
    const want = String(b.user || '').toLowerCase(); if (!/^[a-z0-9-]{1,24}$/.test(want) || want === 'owner') return res.status(403).json({ error: 'Not available for this account' });
    try {
      const ct = require('./ctrader-link.js')._t, blobUsers = () => ct.blobUsers(process.env, H.host), who = await ct.identify({ blobUsers }, want, b.pw);
      if (!who || who.u !== want) return res.status(403).json({ error: 'Password not accepted' });
      // the owner grants the connector per member (Users page, 8 Nov): the record's mcp flag or perms.mcp; Fred has it built in
      if (!(await granted(want, H.host))) return res.status(403).json({ error: 'The owner has not switched the connector on for you' });
      const k = keyFor(want); if (!k) return res.status(503).json({ error: 'The server has no key secret yet; ask the owner' });
      console.log(`[mcp] key shown to ${want}`);
      return res.status(200).json({ user: want, url: `https://${H.host}/api/mcp/${k}` });
    } catch (e) { return res.status(e.status || 500).json({ error: scrubErr(e) }); }
  }
  const who = whoIs((req.query && req.query.key) || (String(H.authorization || '').match(/^Bearer (.+)$/) || [])[1]);
  if (!who) { console.log('[mcp] refused'); return rpcErr(res, 401, -32001, 'unauthorised: the connector URL carries your key'); }
  if (!(await granted(who, H.host))) { console.log(`[mcp] ${who} not granted`); return rpcErr(res, 403, -32001, 'The owner has not switched the connector on for this account'); }
  const level = ictLevel(who); if (level === 'none') { console.log(`[mcp] ${who} no ict`); return rpcErr(res, 403, -32001, 'The owner has not given this account the ICT desk'); }
  if (req.method === 'GET' || req.method === 'DELETE') { res.setHeader('Allow', 'POST, OPTIONS'); return rpcErr(res, 405, -32000, 'method not allowed: this server answers POST JSON-RPC only (no event stream, no sessions)'); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return rpcErr(res, 405, -32000, 'method not allowed'); }
  let body; try { body = typeof req.body === 'string' ? JSON.parse(req.body || 'null') : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body; } catch (e) { return rpcErr(res, 400, -32700, 'parse error'); }
  if (body === undefined || body === null) return rpcErr(res, 400, -32600, 'invalid request: empty body');
  const msgs = Array.isArray(body) ? body : [body];
  if (!msgs.length) return rpcErr(res, 400, -32600, 'invalid request: empty batch');
  if (msgs.length > 20) return rpcErr(res, 400, -32600, 'invalid request: at most 20 messages in a batch');
  // MCP-Protocol-Version (2025-06-18+): an unsupported value is a 400; none means 2025-03-26. initialize negotiates in its body.
  const hv = H['mcp-protocol-version'], init = msgs.some((m) => m && m.method === 'initialize');
  if (hv && !VERSIONS.includes(hv) && !init) return rpcErr(res, 400, -32600, `unsupported MCP-Protocol-Version ${hv}; supported: ${VERSIONS.join(', ')}`);
  const out = [];
  for (const m of msgs) {
    const r = await rpc(who, m, { level }); if (r) out.push(r);
    if (m && m.method === 'tools/call') console.log(`[mcp] ${who} ${m.params && typeof m.params.name === 'string' ? m.params.name.slice(0, 40) : '?'} ${r && r.result && r.result.isError ? 'error' : r && r.error ? 'rpc-error' : 'ok'} ${Date.now() - t0}ms`);
  }
  if (!out.length) return res.status(202).end();
  const negotiated = (out.find((r) => r.result && r.result.protocolVersion) || {}).result;
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Mcp-Protocol-Version', negotiated ? negotiated.protocolVersion : VERSIONS.includes(hv) ? hv : '2025-03-26');
  return res.status(200).json(Array.isArray(body) ? out : out[0]);
};
module.exports.lib = { PROFILE_USERS, VERSIONS, derivedKey, keyFor, whoIs, granted, ictLevel, GRANT, okPath, scrub, stats, brief, outcome, filterTrades, sections, rpc, TOOLS, call, check, limited, RL, LIMITS, validateProposal, syntaxCheck, noPing, originOk, GUIDE, CACHE, evidenceMd };
