// The Mosha desk's lessons (owner, 10 Nov 2026: the Mosha desk "will be main page of" Luxus, "he will train u, allow him to send
// you trades images so u can learn"; then: "He needs to be 100% teachable"). Everything a teacher can do to teach the desk, and
// everything the desk gives back so the teacher can check it:
//   - a LESSON is one trade or scenario: a title, a note, up to 12 screenshots with a caption each (or words only), and, when
//     the teacher gives them, the trade's own levels (side, entry, stop, target, time);
//   - under it runs a CONVERSATION: the desk's assistant writes what it understood, the teacher says "right" or "not right" and
//     why, the desk answers again. The assistant can also put its reading on the CHART (marks and steps for the replay);
//   - the BOOK is what the desk knows: terms, steps, rules and things to avoid. The assistant proposes lines from the lessons;
//     only a teacher confirms, corrects or erases them, and a teacher can write a line directly. A confirmed or corrected line
//     is the teacher's word: the assistant reads the book before every lesson and cannot change such a line.
//   GET  /api/mosha-lessons                 a reader -> { lessons (newest first), book, score, canTeach, who }
//   GET  /api/mosha-lessons?img=<id>        a reader -> the screenshot itself
//   GET  /api/mosha-lessons?get=reader      the owner's session -> { key } (the assistant's key, below)
//   POST { add: { lesson?, title?, note?, caption?, image?, trade? } }   a teacher: a new lesson (a picture, or words only), or
//                                                                        one more picture on their own
//   POST { edit: { id, title?, note?, img?, caption?, trade? } }         the lesson's teacher or the owner
//   POST { remove: { id, img? } }                                        the lesson's teacher or the owner
//   POST { say: { id, text?, verdict? } }     the lesson's teacher or the owner: more words, and "right" / "wrong" on the
//                                             desk's last answer
//   POST { reply: { id, text, chart? } }      the assistant or the owner: what was understood (+ its marks for the replay)
//   POST { learn: { kind, text, from? } }     the assistant: a proposed line of the book; a teacher: a line taught directly
//   POST { book: { id, confirm? | text? | remove? } }   a teacher: confirm, correct or erase a line
// Readers: the owner, a member who may open the Mosha desk (api/mosha.js moshaLevel), and the assistant. Teachers: the owner
// and a member whose Mosha level is 'teach'.
// The assistant has no account: it sends "Authorization: Bearer <key>". The key is derived from the server's session secret
// (nothing new to set) and shown to the owner's session only; with it one can read, reply and propose lines, nothing else.
//   MOSHA_READER=off        switches the key off          MOSHA_READER_SALT=<x>   changes the key (the old one stops working)
// Stored privately in the Blob store: mosha/lessons.json (300 kept), mosha/book.json (400 lines), mosha/shots/<id>.<ext>.
// Screenshots must be real JPEG, PNG or WebP files (checked by their first bytes) of at most 1.5 MB; they are served with their
// own image type and nosniff. A trade given with a lesson needs its stop, on the losing side of the entry (absolute rule 1).
// Lessons only: nothing here places, copies or changes a trade, and no council member reads it.
const crypto = require('node:crypto');
const S = require('./_session.js');
const G = require('./_guard.js');
const { moshaLevel } = require('./mosha.js');

const KEEP = 300, MAX_SHOTS = 12, MAX_BYTES = 1.5 * 1024 * 1024, DAY_MAX = 80, MAX_TALK = 60, BOOK_KEEP = 400;
const ID_RE = /^[0-9]{17}[a-z0-9]{4}$/, BOOK_ID = /^(seed-[0-9]{2}|[0-9]{17}[a-z0-9]{4})$/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
// the markets a lesson's trade can be on: the ones ChronosTrade replays (a trade taught from a backtest keeps its market)
const KINDS = ['term', 'step', 'rule', 'avoid'], MARKETS = ['xau', 'xag', 'nas100', 'spx500', 'us30', 'de40', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf', 'nzdusd', 'gbpjpy', 'bco', 'wtico'], TFS = ['1m', '5m', '15m', '1h', '4h'], MARK_KINDS = ['level', 'vr', 'bvr', 'zone', 'htf'], BASE = { '5m': 300, '15m': 900 };
const MIN_T = Date.UTC(2006, 0, 1) / 1000;
const READER = { u: 'assistant', name: 'The desk', role: 'assistant' };
// What the desk starts with: its own reading of the screenshots and answers received before 10 Nov 2026, as PROPOSED lines.
// None is the teacher's word until a teacher confirms or corrects it. Shown until the first change to the book stores it.
const SEED = [
  ['term', 'Level: a prior high or low that matters on a higher timeframe (H4, H1 or M30). Marked as a line.'],
  ['term', 'Sweep: price trades through a level and does not hold beyond it.'],
  ['term', 'VR (the "5 mn" box on M5): for a sell, the range from the extreme high down to the last swing low before it. For a buy, from the extreme low up to the last swing high before it.'],
  ['term', 'CF: a candle that closes out of the VR. A close below it is the CF for a sell, a close above it the CF for a buy.'],
  ['term', 'BO sell: a close below a low. BO buy: a close above a high.'],
  ['term', 'Zone of the break: from the broken level back to the base of the candle that broke it. The return to it is the entry.'],
  ['term', 'Barrier: the next H4 zone or H4 swing in the direction of the trade. It is the target.'],
  ['step', 'Top-down order: H4 first, then H1 shows when the pullback starts, then M15 or M5 gives the trade.'],
  ['step', 'After an H4 BO, wait for the pullback to come back to the broken H4 level. The M5 VR and its CF there give the main trade, with the H4.'],
  ['rule', 'Every trade has a stop: past the extreme of the VR, or past the zone of the break.'],
  ['rule', 'At the barrier: close, then trade with the H4.'],
  ['avoid', 'No VR, no trade: when price only slides under a level without forming a VR, wait for the pullback to give one.'],
].map(([kind, text], i) => ({ id: `seed-${String(i + 1).padStart(2, '0')}`, kind, text, by: 'assistant', name: READER.name, at: '2026-11-10T00:00:00.000Z', status: 'proposed', from: [], was: null, edited: null }));

function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, P = 'mosha/lessons.json', K = 'mosha/book.json', IMG = 'mosha/shots/';
  const find = async (path) => { const { blobs } = await B().list({ prefix: path, token }); return blobs.find((x) => x.pathname === path) || null; };
  const read = async (b) => { const r = await F(b.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(`mosha lessons read ${r.status}`); return r; };
  const json = (path, list) => B().put(path, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token });
  return {
    async get() { const b = await find(P); if (!b) return []; const j = await (await read(b)).json(); return Array.isArray(j) ? j : []; },   // a failed read throws: a save must never overwrite the lessons with an empty list
    async put(list) { await json(P, list); },
    async getBook() { const b = await find(K); if (!b) return null; const j = await (await read(b)).json(); return Array.isArray(j) ? j : null; },   // null = never stored: the desk's first lines stand
    async putBook(list) { await json(K, list); },
    async putImg(id, type, buf) { await B().put(`${IMG}${id}.${TYPES[type]}`, buf, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: type, token }); },
    async getImg(id, type) { const b = await find(`${IMG}${id}.${TYPES[type]}`); if (!b) return null; return Buffer.from(await (await read(b)).arrayBuffer()); },
    async delImg(id, type) { const b = await find(`${IMG}${id}.${TYPES[type]}`); if (b) await B().del(b.url, { token }); },
  };
}

// the assistant's key, or null when the server has no session secret or the key is switched off
const off = (env) => /^(off|0|false|no)$/i.test(String((env && env.MOSHA_READER) || '').trim());
function readerKey(env = process.env) {
  if (off(env)) return null; const base = S.secret(env); if (!base) return null;
  return 'mr' + crypto.createHmac('sha256', base).update(`meridian-x/mosha-reader/v1|${String(env.MOSHA_READER_SALT || '')}`).digest('hex').slice(0, 40);
}

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const newId = (now) => new Date(now).toISOString().replace(/\D/g, '').slice(0, 17) + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const px = (v) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) && n > 0 && n < 1e7 ? +n.toFixed(5) : null; };
const blank = (v) => v == null || v === '';
// a data URL -> { type, buf } when it really is a JPEG, PNG or WebP of an allowed size; { error } otherwise
function imageOf(dataUrl) {
  const m = typeof dataUrl === 'string' && dataUrl.length < MAX_BYTES * 1.4 + 64 ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/) : null;
  if (!m) return { error: 'send a JPEG, PNG or WebP picture of at most 1.5 MB' };
  const buf = Buffer.from(m[2], 'base64'); if (buf.length < 100 || buf.length > MAX_BYTES) return { error: 'send a JPEG, PNG or WebP picture of at most 1.5 MB' };
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), isWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const real = isJpg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null;
  if (real !== m[1]) return { error: 'that file is not the picture it says it is' };
  return { type: real, buf };
}
// The trade a teacher gives with a lesson: null when none is given, { trade } when it is whole, { error } otherwise. A trade
// without a stop on the losing side of its entry is refused, as everywhere on the desk.
function tradeOf(t, now) {
  if (!isObj(t) || (blank(t.entry) && blank(t.stop) && blank(t.target) && blank(t.side))) return { trade: null };
  const side = t.side === 'sell' || t.side === 'buy' ? t.side : null; if (!side) return { error: 'choose buy or sell for the trade' };
  const entry = px(t.entry), stop = px(t.stop), target = blank(t.target) ? null : px(t.target);
  if (entry == null) return { error: 'the trade\'s entry price is missing' };
  if (stop == null) return { error: 'every trade needs a stop: the stop price is missing' };
  if (side === 'sell' ? stop <= entry : stop >= entry) return { error: side === 'sell' ? 'a sell needs its stop above the entry' : 'a buy needs its stop below the entry' };
  if (!blank(t.target) && target == null) return { error: 'the target is not a price' };
  if (target != null && (side === 'sell' ? target >= entry : target <= entry)) return { error: side === 'sell' ? 'a sell needs its target below the entry' : 'a buy needs its target above the entry' };
  const at = Math.floor(Number(t.at)), nowS = Math.floor(now / 1000); if (!Number.isFinite(at) || at < MIN_T || at > nowS + 86400) return { error: 'the trade\'s entry time is missing or out of range' };
  const market = blank(t.market) ? 'xau' : String(t.market).toLowerCase(); if (!MARKETS.includes(market)) return { error: 'the desk does not know that market' };
  const out = { market, side, at, entry, stop, target };
  // how it ended, when the teacher gives it (a trade taken in a ChronosTrade replay): the exit price and time; R is worked out here
  if (!blank(t.exit)) { const exit = px(t.exit), exitAt = Math.floor(Number(t.exitAt)); if (exit == null || !Number.isFinite(exitAt) || exitAt < at || exitAt > nowS + 86400) return { error: 'the trade\'s exit needs its price and a time after the entry' };
    out.exit = exit; out.exitAt = exitAt; out.R = +(((side === 'sell' ? -1 : 1) * (exit - entry)) / Math.abs(entry - stop)).toFixed(2); }
  if (TFS.includes(t.tf)) out.tf = t.tf; if (t.src === 'replay') out.src = 'replay';
  return { trade: out };
}
// The assistant's reading of a lesson for the replay chart: { chart } or { error }. Everything is checked: one candle request,
// a known market, marks and steps inside the window, a position only with its stop on the losing side.
function chartOf(c, lesson, now) {
  if (!isObj(c)) return { error: 'the chart is not an object' };
  const T = lesson && lesson.trade, base = BASE[c.base] ? c.base : '5m', sec = BASE[base], nowS = Math.floor(now / 1000);
  const market = MARKETS.includes(c.market) ? c.market : T ? T.market : 'xau', from = Math.floor(Number(c.from)), to = Math.floor(Number(c.to));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < MIN_T || to > nowS + 86400 || to - from < 20 * sec || to - from > 4900 * sec) return { error: 'the chart window is missing or too long for one candle request' };
  const inWin = (t) => Number.isFinite(t) && t >= from && t <= to;
  let pos = { side: null, entry: null, stop: null, target: null, fillFrom: null };
  if (!blank(c.entry) || !blank(c.stop) || !blank(c.side)) {
    const p = tradeOf({ side: c.side, entry: c.entry, stop: c.stop, target: c.target, at: c.fillFrom != null ? c.fillFrom : from, market }, now); if (p.error) return { error: p.error };
    const ff = Math.floor(Number(c.fillFrom)); if (!inWin(ff)) return { error: 'the chart needs the time the entry is looked for from' };
    pos = { side: p.trade.side, entry: p.trade.entry, stop: p.trade.stop, target: p.trade.target, fillFrom: ff };
  }
  if (!Array.isArray(c.marks) || c.marks.length > 16) return { error: 'the chart takes up to 16 marks' };
  const marks = [];
  for (const m of c.marks) {
    if (!isObj(m) || !MARK_KINDS.includes(m.kind)) return { error: 'a mark is a level, vr, bvr, zone or htf' };
    const a = Math.floor(Number(m.a)), b = Math.floor(Number(m.b)), at = blank(m.at) ? null : Math.floor(Number(m.at)), label = clean(m.label, 40);
    if (!inWin(a) || !inWin(b) || a >= b || (at != null && (at < a || at > b))) return { error: `the mark "${label}" does not sit inside the window` };
    const o = { kind: m.kind, label, a, b, ...(at != null ? { at } : {}), ...(m.under === true ? { under: true } : {}), ...(m.over === true ? { over: true } : {}), ...(m.left === true ? { left: true } : {}), ...(m.keep === true ? { keep: true } : {}) };
    if (m.kind === 'level') { const p = px(m.p); if (p == null) return { error: `the level "${label}" has no price` }; o.p = p; }
    else { const top = px(m.top), bot = px(m.bot); if (top == null || bot == null || top <= bot) return { error: `the box "${label}" needs a top above its bottom` }; o.top = top; o.bot = bot; }
    marks.push(o);
  }
  if (!Array.isArray(c.steps) || !c.steps.length || c.steps.length > 14) return { error: 'the chart takes 1 to 14 steps' };
  const steps = []; let last = from;
  for (const s of c.steps) {
    const text = clean(s && s.text, 260); if (!text) return { error: 'a step needs its words' };
    if (s.t === 'fill' || s.t === 'exit') { if (pos.entry == null) return { error: 'a fill or exit step needs a position' }; steps.push({ t: s.t, text }); continue; }
    const t = Math.floor(Number(s.t)); if (!inWin(t) || t < last) return { error: 'the steps must be in time order, inside the window' }; last = t; steps.push({ t, text });
  }
  return { chart: { market, base, from, to, ...pos, marks, steps, at: new Date(now).toISOString() } };
}
// a stored lesson in today's shape (a first version kept one reply instead of the conversation)
function norm(l) {
  if (!Array.isArray(l.thread)) { l.thread = l.reply && l.reply.text ? [{ by: 'assistant', name: READER.name, at: l.reply.at, text: l.reply.text, shots: l.reply.shots || 0 }] : []; }
  delete l.reply; if (!Array.isArray(l.shots)) l.shots = []; if (l.trade === undefined) l.trade = null; if (l.chart === undefined) l.chart = null; return l;
}
const lastSaid = (l) => { for (let i = l.thread.length - 1; i >= 0; i--) if (l.thread[i].by === 'assistant') return l.thread[i]; return null; };
// where a lesson stands: new (the desk has not answered), more (the teacher added something or said "not right": the desk
// owes an answer), read (the desk answered and waits for the teacher's word), agreed (the teacher said it is right)
function stateOf(l) {
  const th = l.thread || [], la = (() => { for (let i = th.length - 1; i >= 0; i--) if (th[i].by === 'assistant') return th[i]; return null; })();
  if (!la) return 'new'; if ((la.shots || 0) < (l.shots || []).length || la.verdict === 'wrong') return 'more';
  const after = th.slice(th.indexOf(la) + 1);   // what the teacher said since: words sent together with "right" close the lesson, later ones reopen it
  if (after.some((m) => !(la.verdict === 'right' && la.vat && m.at <= la.vat))) return 'more';
  return la.verdict === 'right' ? 'agreed' : 'read';
}
// what a reader sees of a lesson (the stored record as it is: it holds no secret)
const view = (l) => ({ id: l.id, by: l.by, name: l.name, at: l.at, edited: l.edited || null, title: l.title, note: l.note, trade: l.trade || null, chart: l.chart || null,
  shots: (l.shots || []).map((s) => ({ img: s.img, caption: s.caption, at: s.at })), thread: (l.thread || []).map((m) => ({ by: m.by, name: m.name, at: m.at, text: m.text, ...(m.by === 'assistant' ? { shots: m.shots || 0 } : {}), ...(m.verdict ? { verdict: m.verdict, vat: m.vat } : {}) })), state: stateOf(l) });
// how teachable the desk has been so far: of the lessons whose first answer a teacher judged, how many were right first time;
// and how much of the book is the teacher's word
function scoreOf(lessons, book) {
  let judged = 0, right = 0, agreed = 0, waiting = 0;
  for (const l of lessons) { const first = (l.thread || []).find((m) => m.by === 'assistant'); if (first && first.verdict) { judged++; if (first.verdict === 'right') right++; } const st = stateOf(l); if (st === 'agreed') agreed++; if (st === 'new' || st === 'more') waiting++; }
  const taught = book.filter((b) => b.status !== 'proposed').length;
  return { lessons: lessons.length, judged, right, agreed, waiting, book: book.length, taught, proposed: book.length - taught };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 })), now = d.now || Date.now();
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    let q = req.query; if (!q || typeof q !== 'object') { try { q = Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams); } catch (e) { q = {}; } }
    // who is asking: the assistant's key first (a wrong key is counted like a wrong password), else the session
    const auth = req.headers && req.headers.authorization; let acct = null, bot = false;
    if (auth) {
      const secs = G.wait(req, now); if (secs) return G.tooMany(res, secs);
      if (!G.bearerOk(auth, readerKey(env))) { G.failed(req, now); return res.status(401).json({ error: 'key not accepted' }); }
      acct = READER; bot = true;
    } else {
      if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
      acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    }
    const owner = acct.u === 'owner', level = bot ? 'read' : moshaLevel(acct);
    if (!level) return res.status(403).json({ error: 'the Mosha desk is not open to this account' });
    const teach = !bot && level === 'teach';

    if (req.method === 'GET' && q.get === 'reader') {
      if (!owner) return res.status(403).json({ error: 'only the owner sees the assistant\'s key' });
      const key = readerKey(env); return res.status(200).json({ key, off: off(env), host: String((req.headers && req.headers.host) || 'meridianx.dev').replace(/[^A-Za-z0-9.:-]/g, '').slice(0, 120) });
    }
    const list = (await store.get()).map(norm);
    if (req.method === 'GET' && q.img != null) {
      const id = String(q.img); if (!ID_RE.test(id)) return res.status(400).json({ error: 'bad picture id' });
      let shot = null; for (const l of list) { shot = l.shots.find((s) => s.img === id); if (shot) break; }
      const buf = shot && TYPES[shot.type] ? await store.getImg(id, shot.type) : null; if (!buf) return res.status(404).json({ error: 'no such picture' });
      res.setHeader('Content-Type', shot.type); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
      return res.status(200).send(buf);
    }
    const stored = await store.getBook(), book = stored || SEED.map((x) => ({ ...x }));
    if (req.method === 'GET') return res.status(200).json({ lessons: list.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).map(view), book, score: scoreOf(list, book), canTeach: teach, who: acct.u });

    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!isObj(b)) return res.status(400).json({ error: 'bad request' });
    const stamp = new Date(now).toISOString();
    const mine = (l) => owner || (teach && l.by === acct.u);   // a teacher changes only their own lessons
    const find = (id) => list.find((x) => x.id === String(id));

    if (isObj(b.reply)) {   // what the assistant understood, and its marks for the chart (the owner may write it too)
      if (!bot && !owner) return res.status(403).json({ error: 'only the desk\'s assistant writes the desk\'s answer' });
      const l = find(b.reply.id); if (!l) return res.status(404).json({ error: 'no such lesson' });
      const text = clean(b.reply.text, 3000); if (!text) return res.status(400).json({ error: 'the answer is empty' });
      let chart = l.chart; if (b.reply.chart != null) { const c = chartOf(b.reply.chart, l, now); if (c.error) return res.status(400).json({ error: c.error }); chart = c.chart; }
      l.thread.push({ by: 'assistant', name: READER.name, at: stamp, text, shots: l.shots.length }); l.thread = l.thread.slice(-MAX_TALK); l.chart = chart;
      await store.put(list); return res.status(200).json({ ok: true, lesson: view(l) });
    }
    if (isObj(b.learn)) {   // a line of the book: proposed by the assistant, or taught directly by a teacher
      if (!bot && !teach) return res.status(403).json({ error: 'this account cannot teach the desk' });
      const kind = KINDS.includes(b.learn.kind) ? b.learn.kind : null, text = clean(b.learn.text, 600); if (!kind || text.length < 4) return res.status(400).json({ error: 'a line needs a kind (term, step, rule or avoid) and its words' });
      if (book.length >= BOOK_KEEP) return res.status(400).json({ error: `the book holds ${BOOK_KEEP} lines: erase old ones first` });
      if (book.some((x) => x.text.toLowerCase() === text.toLowerCase())) return res.status(409).json({ error: 'the book already has that line' });
      const from = (Array.isArray(b.learn.from) ? b.learn.from : []).map(String).filter((id) => ID_RE.test(id) && find(id)).slice(0, 8);
      const item = { id: newId(now), kind, text, by: acct.u, name: clean(acct.name || acct.u, 24), at: stamp, status: bot ? 'proposed' : 'confirmed', from, was: null, edited: null };
      book.push(item); await store.putBook(book); return res.status(200).json({ ok: true, item, book });
    }
    if (bot) return res.status(403).json({ error: 'the assistant\'s key reads, answers and proposes lines, nothing else' });
    if (!teach) return res.status(403).json({ error: 'this account cannot teach the desk' });

    if (isObj(b.book)) {   // the teacher's word on a line: confirm it, correct it, or erase it
      const id = String(b.book.id), i = BOOK_ID.test(id) ? book.findIndex((x) => x.id === id) : -1; if (i < 0) return res.status(404).json({ error: 'no such line' });
      const it = book[i];
      if (b.book.remove === true) book.splice(i, 1);
      else if (b.book.text != null) { const text = clean(b.book.text, 600); if (text.length < 4) return res.status(400).json({ error: 'the line is empty' }); if (text !== it.text) { if (it.was == null && it.by === 'assistant') it.was = it.text; it.text = text; it.status = 'corrected'; } else if (it.status === 'proposed') it.status = 'confirmed'; if (KINDS.includes(b.book.kind)) it.kind = b.book.kind; it.edited = stamp; it.eby = acct.u; }
      else if (b.book.confirm === true) { if (it.status === 'proposed') it.status = 'confirmed'; it.edited = stamp; it.eby = acct.u; }
      else return res.status(400).json({ error: 'confirm, correct or erase the line' });
      await store.putBook(book); return res.status(200).json({ ok: true, book });
    }
    if (isObj(b.say)) {   // the teacher talks back: more words, and "right" / "wrong" on the desk's last answer
      const l = find(b.say.id); if (!l) return res.status(404).json({ error: 'no such lesson' });
      if (!mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      const text = clean(b.say.text, 2000), verdict = b.say.verdict === 'right' || b.say.verdict === 'wrong' ? b.say.verdict : null, la = lastSaid(l);
      if (!text && !verdict) return res.status(400).json({ error: 'say something, or mark the answer right or not right' });
      if (verdict && !la) return res.status(400).json({ error: 'the desk has not answered this lesson yet' });
      if (verdict === 'wrong' && !text) return res.status(400).json({ error: 'say what is not right, so the desk can learn it' });
      if (verdict) { la.verdict = verdict; la.vby = acct.u; la.vat = stamp; }
      if (text) { l.thread.push({ by: acct.u, name: clean(acct.name || acct.u, 24), at: stamp, text }); l.thread = l.thread.slice(-MAX_TALK); }
      l.edited = stamp; await store.put(list); return res.status(200).json({ ok: true, lesson: view(l) });
    }
    if (isObj(b.add)) {
      const a = b.add, has = !blank(a.image), im = has ? imageOf(a.image) : null; if (im && im.error) return res.status(400).json({ error: im.error });
      let l = a.lesson ? find(a.lesson) : null;
      if (a.lesson && !l) return res.status(404).json({ error: 'no such lesson' });
      if (l && !mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      if (l && !has) return res.status(400).json({ error: 'send a JPEG, PNG or WebP picture of at most 1.5 MB' });
      const title = clean(a.title, 80), note = clean(a.note, 2000), caption = clean(a.caption, 200);
      if (!l && !has && !(title && note)) return res.status(400).json({ error: 'a lesson in words needs a title and what the desk should learn; or send a picture' });
      const tr = l ? { trade: l.trade } : tradeOf(a.trade, now); if (tr.error) return res.status(400).json({ error: tr.error });
      const day = list.reduce((n, x) => n + x.shots.filter((s) => x.by === acct.u && now - Date.parse(s.at) < 86400e3).length, 0);
      if (has && !owner && day >= DAY_MAX) return res.status(429).json({ error: `that is ${DAY_MAX} pictures in a day: send the rest tomorrow` });
      if (l && l.shots.length >= MAX_SHOTS) return res.status(400).json({ error: `a lesson holds ${MAX_SHOTS} pictures: start a new one` });
      if (!l && list.length >= KEEP) return res.status(400).json({ error: `the desk holds ${KEEP} lessons: remove old ones first` });
      const img = has ? newId(now) : null;
      if (has) await store.putImg(img, im.type, im.buf);   // the picture first: a lesson never points at a picture that is not there
      if (!l) { l = { id: newId(now), by: acct.u, name: clean(acct.name || acct.u, 24), at: stamp, edited: null, title: title || caption.slice(0, 80) || 'A trade', note, trade: tr.trade, chart: null, shots: [], thread: [] }; list.push(l); }
      else { l.edited = stamp; if (note) l.note = note; }
      if (has) l.shots.push({ img, type: im.type, caption, at: stamp, bytes: im.buf.length });
      await store.put(list); return res.status(200).json({ ok: true, lesson: view(l), img });
    }
    if (isObj(b.edit)) {
      const l = find(b.edit.id); if (!l) return res.status(404).json({ error: 'no such lesson' });
      if (!mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      if (b.edit.trade !== undefined) { const tr = b.edit.trade === null ? { trade: null } : tradeOf(b.edit.trade, now); if (tr.error) return res.status(400).json({ error: tr.error }); l.trade = tr.trade; }
      if (b.edit.title != null) l.title = clean(b.edit.title, 80) || l.title; if (b.edit.note != null) l.note = clean(b.edit.note, 2000);
      if (b.edit.img != null) { const s = l.shots.find((x) => x.img === String(b.edit.img)); if (!s) return res.status(404).json({ error: 'no such picture' }); s.caption = clean(b.edit.caption, 200); }
      l.edited = stamp; await store.put(list); return res.status(200).json({ ok: true, lesson: view(l) });
    }
    if (isObj(b.remove)) {
      const l = find(b.remove.id); if (!l) return res.status(404).json({ error: 'no such lesson' });
      if (!mine(l)) return res.status(403).json({ error: 'that lesson belongs to someone else' });
      const gone = b.remove.img != null ? l.shots.filter((s) => s.img === String(b.remove.img)) : l.shots.slice();
      if (b.remove.img != null && !gone.length) return res.status(404).json({ error: 'no such picture' });
      const next = b.remove.img != null ? list : list.filter((x) => x !== l);
      if (b.remove.img != null) { l.shots = l.shots.filter((s) => s.img !== String(b.remove.img)); l.edited = stamp; }
      await store.put(next);   // the list first, then the files: a picture the list no longer names is only wasted space
      for (const s of gone) { try { await store.delImg(s.img, s.type); } catch (e) { /* left behind, never served: no lesson names it */ } }
      return res.status(200).json({ ok: true, removed: gone.length, lesson: b.remove.img != null ? view(l) : null });
    }
    return res.status(400).json({ error: 'nothing to do' });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'the Mosha lessons are unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
Object.assign(module.exports, { handle, blobStore, readerKey, imageOf, tradeOf, chartOf, stateOf, scoreOf, view, norm, SEED, KINDS, KEEP, MAX_SHOTS, MAX_BYTES, DAY_MAX, BOOK_KEEP });
