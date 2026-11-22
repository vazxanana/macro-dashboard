// The structure assistant (22 Nov 2026, owner: "build an ai assistant for the dashboard that he will focus is direction/market
// structure and cycle"). Pure: the request is built here from what the Desk's Charts page sends, every field checked and capped
// (the page is never trusted), and the answer is checked in code. The endpoint (api/structure-assistant.js) calls the shared
// language-model adapter (api/_academy-llm.js).
//
// The facts are the structure the PAGE already computes on CLOSED candles of the panes it analyses (msAnalyze, msInternal,
// msInternalLeg, msCycle / msStage / msPath): per timeframe D1, H4, H1, M15, M5 the trend, the breaks (BO / ChoCh) with their
// levels and times, the protected swing, the move's extreme, the internal breaks (iBO) and the internal leg; the market cycle of
// each pair of timeframes (move / pullback / continuation, the 50 % and the origin, the path it points to); and the timeframes'
// alignment. The model explains direction, structure and the cycle in plain words from these facts only.
//
// Display only: a language model's READING of structure, not advice and not a tested edge. It places, changes or refuses no
// order, moves no stop, and nothing in the council reads it. Every figure the answer writes must be in the facts (parseAnswer, the
// rule of api/_daily.js parseBrief); a level it names to watch must be one of the facts' levels. No model name is written here.
'use strict';

const LIM = { str: 200, question: 300, tfs: 5, breaks: 6, internal: 4, cycle: 4, path: 2, watchMax: 4, summary: 700, why: 320, cycleText: 700, what: 260, ask: 220, years: 5 };
const TF_IDS = ['1d', '4h', '1h', '15m', '5m'];
const TF_LABEL = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
const PHASES = ['move', 'pullback', 'resumed', 'none'];
const DIRS = ['up', 'down', 'sideways', 'unclear'];
const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);
const str = (v, n = LIM.str) => (v == null ? '' : String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const sgn = (v) => { const x = fin(v); return x == null ? 0 : x > 0 ? 1 : x < 0 ? -1 : 0; };

// one facts object -> the clean copy (or a 400). `at` = the moment the page read the panes (unix seconds); nothing after it is kept.
function cleanFacts(f, nowS) {
  if (!isObj(f)) throw bad('facts are required');
  const at = fin(f.at);
  if (at == null || at > nowS + 300 || at < nowS - 3600) throw bad('facts.at must be the moment of the reading');
  const dec = Math.max(0, Math.min(6, Math.round(fin(f.dec) == null ? 2 : fin(f.dec))));
  const px = (v) => { const x = fin(v); return x != null && x > 0 && x < 1e7 ? +x.toFixed(dec) : null; };
  const tm = (v) => { const x = fin(v); return x != null && x <= at && x >= at - LIM.years * 366 * 86400 ? Math.round(x) : null; };
  const brk = (e) => { if (!isObj(e)) return null; const level = px(e.level), t = tm(e.t), dir = sgn(e.dir); return level != null && t != null && dir ? { dir, level, t, structure: e.structure === true } : null; };
  const list = (v, n) => (Array.isArray(v) ? v.slice(-n * 4).map(brk).filter(Boolean).slice(-n) : []);
  const out = { at: Math.round(at), dec, price: px(f.price), priceT: tm(f.priceT), tfs: [], cycle: [] };
  const seen = new Set();
  for (const T of Array.isArray(f.tfs) ? f.tfs.slice(0, 10) : []) {
    if (!isObj(T) || !TF_IDS.includes(T.tf) || seen.has(T.tf)) continue; seen.add(T.tf);
    const o = { tf: T.tf, trend: sgn(T.trend), closedThrough: tm(T.closedThrough), breaks: list(T.breaks, LIM.breaks), internal: list(T.internal, LIM.internal) };
    const last = brk(T.last); if (last) o.last = last;
    if (isObj(T.protected) && px(T.protected.level) != null) o.protected = { level: px(T.protected.level), t: tm(T.protected.t), swept: T.protected.swept === true };
    if (isObj(T.extreme) && px(T.extreme.level) != null) o.extreme = { level: px(T.extreme.level), t: tm(T.extreme.t), fixed: T.extreme.fixed === true };
    if (isObj(T.internalLeg)) { const L = T.internalLeg, a = px(L.from), b = px(L.to), m = px(L.p50), d = sgn(L.dir);
      if (a != null && b != null && m != null && d) o.internalLeg = { dir: d, from: a, to: b, p50: m, reached: L.reached === true }; }
    out.tfs.push(o);
  }
  if (!out.tfs.length) throw bad('facts.tfs: no timeframe with structure');
  out.tfs.sort((a, b) => TF_IDS.indexOf(a.tf) - TF_IDS.indexOf(b.tf));
  for (const R of Array.isArray(f.cycle) ? f.cycle.slice(0, 8) : []) {
    if (!isObj(R) || !TF_IDS.includes(R.parent) || !TF_IDS.includes(R.child) || !PHASES.includes(R.phase)) continue;
    const o = { parent: R.parent, child: R.child, dir: sgn(R.dir), phase: R.phase };
    for (const k of ['p50', 'origin', 'ext']) { const v = px(R[k]); if (v != null) o[k] = v; }
    for (const k of ['choch', 'resume']) if (isObj(R[k]) && px(R[k].level) != null) o[k] = { level: px(R[k].level), t: tm(R[k].t) };
    const st = str(R.stage, LIM.str); if (st) o.stage = st;
    const path = Array.isArray(R.path) ? R.path.slice(0, LIM.path).map((g) => (isObj(g) && px(g.to) != null && ['retrace', 'with'].includes(g.kind) ? { to: px(g.to), kind: g.kind } : null)).filter(Boolean) : [];
    if (path.length) o.path = path;
    out.cycle.push(o); if (out.cycle.length >= LIM.cycle) break;
  }
  if (isObj(f.alignment)) { const up = fin(f.alignment.up), dn = fin(f.alignment.down), n = fin(f.alignment.n);
    if ([up, dn, n].every((x) => x != null && x >= 0 && x <= 10)) out.alignment = { up: Math.round(up), down: Math.round(dn), n: Math.round(n) }; }
  return out;
}

// every price level of the facts (what a "watch" level may be)
function levelsOf(F) {
  const L = [];
  for (const T of F.tfs) {
    for (const e of [...T.breaks, ...T.internal]) L.push(e.level);
    if (T.last) L.push(T.last.level); if (T.protected) L.push(T.protected.level); if (T.extreme) L.push(T.extreme.level);
    if (T.internalLeg) L.push(T.internalLeg.from, T.internalLeg.to, T.internalLeg.p50);
  }
  for (const R of F.cycle) { for (const k of ['p50', 'origin', 'ext']) if (R[k] != null) L.push(R[k]); for (const k of ['choch', 'resume']) if (R[k]) L.push(R[k].level); for (const g of R.path || []) L.push(g.to); }
  if (F.price != null) L.push(F.price);
  return [...new Set(L.filter((x) => x != null))];
}

const fx = (v, dec) => (v == null ? 'n/a' : (+v).toFixed(dec));
const when = (t) => (t == null ? 'time n/a' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
const dirWord = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'none');
// the facts in plain lines (the model reads these; the figure check reads the numbers of this text only, never the question)
function factsText(F, market) {
  const d = F.dec, out = [`Market: ${market}. Reading made at ${when(F.at)} from closed candles only.`];
  if (F.price != null) out.push(`Last closed price: ${fx(F.price, d)} (${when(F.priceT)}).`);
  if (F.alignment) out.push(`Alignment: the last break is up on ${F.alignment.up} and down on ${F.alignment.down} of ${F.alignment.n} timeframes.`);
  for (const T of F.tfs) {
    const lab = TF_LABEL[T.tf], b = [`${lab}: trend ${dirWord(T.trend)}${T.closedThrough != null ? `, candles closed through ${when(T.closedThrough)}` : ''}.`];
    if (T.last) b.push(`  Last break: ${T.last.structure ? 'ChoCh (change of character)' : 'BO (break of structure)'} ${dirWord(T.last.dir)} at ${fx(T.last.level, d)} (${when(T.last.t)}).`);
    if (T.protected) b.push(`  Protected swing (a close beyond it flips the trend): ${fx(T.protected.level, d)}${T.protected.t != null ? ` (${when(T.protected.t)})` : ''}${T.protected.swept ? ', swept by a wick without a close beyond' : ''}.`);
    if (T.extreme) b.push(`  Extreme of the move so far: ${fx(T.extreme.level, d)}${T.extreme.fixed ? ' (confirmed)' : ' (still forming)'}.`);
    if (T.breaks.length) b.push(`  Recent breaks, oldest first: ${T.breaks.map((e) => `${e.structure ? 'ChoCh' : 'BO'} ${dirWord(e.dir)} ${fx(e.level, d)} (${when(e.t)})`).join('; ')}.`);
    if (T.internal.length) b.push(`  Internal breaks (iBO), oldest first: ${T.internal.map((e) => `iBO ${dirWord(e.dir)} ${fx(e.level, d)} (${when(e.t)})`).join('; ')}.`);
    if (T.internalLeg) { const L = T.internalLeg; b.push(`  Internal leg ${dirWord(L.dir)}: from ${fx(L.from, d)} to ${fx(L.to, d)}, its 50% ${fx(L.p50, d)}, ${L.reached ? 'already traded back to' : 'not reached yet'}.`); }
    out.push(...b);
  }
  if (F.cycle.length) out.push('Market cycle (each timeframe read against the one under it):');
  for (const R of F.cycle) {
    const ph = R.phase === 'move' ? 'moving (the lower timeframe still agrees)' : R.phase === 'pullback' ? 'pulling back (the lower timeframe broke against it: its ChoCh)' : R.phase === 'resumed' ? 'continuation (the lower timeframe broke back with it)' : 'no reading';
    const parts = [`  ${TF_LABEL[R.parent]} read by ${TF_LABEL[R.child]}: ${dirWord(R.dir)}, ${ph}`];
    if (R.p50 != null) parts.push(`50% of the move ${fx(R.p50, d)}`); if (R.origin != null) parts.push(`origin (the broken level) ${fx(R.origin, d)}`); if (R.ext != null) parts.push(`the move's extreme ${fx(R.ext, d)}`);
    if (R.choch) parts.push(`${TF_LABEL[R.child]} ChoCh at ${fx(R.choch.level, d)} (${when(R.choch.t)})`);
    if (R.resume) parts.push(`${TF_LABEL[R.child]} broke back at ${fx(R.resume.level, d)} (${when(R.resume.t)})`);
    if (R.path) parts.push(`the path the cycle points to: ${R.path.map((g) => `${g.kind === 'retrace' ? 'retrace to' : 'with the move to'} ${fx(g.to, d)}`).join(', then ')}`);
    if (R.stage) parts.push(`stage: ${R.stage}`);
    out.push(parts.join('; ') + '.');
  }
  return out.join('\n');
}

const SCHEMA = { type: 'object', additionalProperties: false, required: ['summary', 'timeframes', 'cycle', 'watch', 'question'], properties: {
  summary: { type: 'string' }, cycle: { type: 'string' }, question: { type: 'string' },
  timeframes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tf', 'direction', 'why'], properties: { tf: { type: 'string' }, direction: { type: 'string', enum: DIRS }, why: { type: 'string' } } } },
  watch: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['level', 'what'], properties: { level: { type: 'number' }, what: { type: 'string' } } } } } };

const SYSTEM = [
  'You are the structure analyst of a small trading desk. You explain DIRECTION, MARKET STRUCTURE and the MARKET CYCLE of one market in plain words, from the facts you are given and nothing else.',
  'The facts are a reading of closed candles: per timeframe the trend, breaks of structure (BO: a close beyond a swing with the trend; ChoCh: the first close against it), the protected swing whose close-through flips the trend, the move\'s extreme, internal breaks (iBO) and the internal leg; and the market cycle: each timeframe read against the one under it as moving, pulling back (the lower timeframe made a ChoCh against it) or in continuation (it broke back with it), with the move\'s 50%, its origin and its extreme.',
  'Work top-down: D1 first, then H4, H1, M15, M5. Say plainly where the timeframes agree and where they disagree, which stage of the cycle each one is in, and what would change the reading: name the level whose CLOSE would flip it.',
  'Every number you write must appear in the facts, written the same way (you may round nothing and invent nothing). Every level in "watch" must be one of the facts\' levels.',
  'Never give a trade instruction: never tell anyone to buy, sell, enter, exit, go long or short, or what size or risk to take; never talk about stops or moving them. Never state a forecast as fact ("price will fall"): speak of what the structure shows and what a close beyond a level would mean ("a close above X would", "the cycle points to"). Never call this a proven, tested or guaranteed edge: it is a reading of structure, not advice and not a tested edge.',
  'Short sentences, everyday words; when you use a term (BO, ChoCh, iBO, 50%, origin) say what it means the first time.',
  'Answer with JSON only: {"summary": "2 to 4 sentences, under 600 characters: the direction top-down and the stage of the cycle", "timeframes": [{"tf": "D1", "direction": "up | down | sideways | unclear", "why": "one sentence"}] one per timeframe in the facts, "cycle": "2 to 3 sentences: where the cycle stands and the path it points to", "watch": [{"level": 0, "what": "what a close beyond this level would change"}] 1 to 4 items, "question": "one short question back, or an empty string"}.',
].join('\n');

// body -> { system, prompt, schema, facts, levels, factsText }; throws a 400 on a bad body
function buildRequest(b, nowS) {
  if (!isObj(b)) throw bad('a JSON object is required');
  const market = str(b.market, 24).toLowerCase(); if (!/^[a-z0-9][a-z0-9_-]{0,23}$/.test(market)) throw bad('market');
  const label = str(b.label, 24).replace(/[^\w /.-]/g, '') || market.toUpperCase();
  const tf = b.tf == null || b.tf === '' ? null : String(b.tf); if (tf != null && !TF_IDS.includes(tf)) throw bad('tf: one of ' + TF_IDS.join(', '));
  const question = str(b.question, LIM.question);
  const F = cleanFacts(b.facts, nowS);
  const ft = factsText(F, label);
  const ask = question ? `The person asks: "${question}". Answer it inside the same JSON, from the facts only.` : 'Read this market: direction, structure and the cycle, top-down.';
  const prompt = `=== FACTS ===\n${ft}\n=== END OF FACTS ===\n${tf ? `The person is looking at the ${TF_LABEL[tf]} chart.\n` : ''}${ask}`;
  return { system: SYSTEM, prompt, schema: SCHEMA, facts: F, levels: levelsOf(F), factsText: ft, market, question };
}

// ---- the answer check ----
const NUM = /\d[\d,]*(?:\.\d+)?/g;
const norm = (x) => { let s = x.replace(/,/g, ''); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s.replace(/^0+(?=\d)/, ''); };
const TF_TOKEN = /\b(?:D1|W1|H1|H4|M1|M5|M15|M30|MN)\b/g;
const SMALL = new Set(['50', '100']);   // "the 50%", "100%" are words of the method, not levels
const ADVICE = /\b(you should|we recommend|i recommend|i suggest|consider (buying|selling|entering|going)|go (long|short)|goes? long|enter (a |the |this )?(long|short|trade|position)|take (a|the|this) (trade|long|short|position)|open (a|the) (long|short|position|trade)|(buy|sell) (now|here|this|it)|position siz|lot size|risk (\d|only|no more))/i;
const STOP = /\b(stop[- ]?loss|stops?|trail(ing)? stop)\b/i;
const CLAIM = /\b(guarantee[sd]?|proven|tested edge|risk[- ]free|sure thing|certain(ly)? to)\b/i;
const FORECAST = /\b(price|gold|it|the market|the pair|the index|this market|silver|the dollar|[A-Z]{3}\/[A-Z]{3})\s+will\s+(definitely\s+|surely\s+|certainly\s+)?(go|rise|fall|drop|reach|hit|break|bounce|reverse|rally|close|climb|decline|continue|turn|head|test|retrace|move)\b/i;
const HEDGE = /\b(if|could|may|might|would|whether|unless|until|once|only|not)\b/i;
function textProblem(k, v, allowed) {
  if (ADVICE.test(v)) return `${k}: a trade instruction`;
  if (STOP.test(v)) return `${k}: talks about stops`;
  if (CLAIM.test(v)) return `${k}: a claim of certainty or of a tested edge`;
  if (/\b(AI|language model|the facts I was given)\b/.test(v)) return `${k}: talks of itself`;
  if (v.split(/(?<=[.!?])\s+/).some((s) => FORECAST.test(s) && !HEDGE.test(s))) return `${k}: a forecast stated as fact`;
  for (const n of v.replace(TF_TOKEN, ' ').match(NUM) || []) { const x = norm(n); if (!allowed.has(x) && !SMALL.has(x) && !(Number.isInteger(+x) && +x <= 10)) return `${k}: the figure ${n} is not in the facts`; }
  return null;
}
// text -> { ok, answer } | { ok: false, why: [..] }
function parseAnswer(text, q) {
  let j = null; const t = String(text || ''), a = t.indexOf('{'), z = t.lastIndexOf('}');
  try { j = JSON.parse(a >= 0 && z > a ? t.slice(a, z + 1) : t); } catch (e) { return { ok: false, why: ['not JSON'] }; }
  if (!isObj(j)) return { ok: false, why: ['not an object'] };
  const why = [], have = new Set(q.facts.tfs.map((T) => TF_LABEL[T.tf]));
  const summary = str(j.summary, LIM.summary + 200), cycle = str(j.cycle, LIM.cycleText + 200), question = str(j.question, LIM.ask + 100);
  if (summary.length < 20 || summary.length > LIM.summary) why.push('summary: 20 to 700 characters');
  if (cycle.length < 10 || cycle.length > LIM.cycleText) why.push('cycle: 10 to 700 characters');
  if (question.length > LIM.ask) why.push('question: too long');
  const tfs = [];
  if (!Array.isArray(j.timeframes) || !j.timeframes.length || j.timeframes.length > LIM.tfs) why.push('timeframes: 1 to 5');
  else for (const x of j.timeframes) {
    const lab = isObj(x) ? (TF_LABEL[x.tf] || str(x.tf, 4).toUpperCase()) : '';
    if (!have.has(lab)) { why.push(`timeframes: ${lab || '?'} is not in the facts`); continue; }
    if (!DIRS.includes(x.direction)) { why.push(`timeframes: ${lab} direction`); continue; }
    const w = str(x.why, LIM.why + 100); if (w.length < 5 || w.length > LIM.why) { why.push(`timeframes: ${lab} why`); continue; }
    if (tfs.some((y) => y.tf === lab)) { why.push(`timeframes: ${lab} twice`); continue; }
    tfs.push({ tf: lab, direction: x.direction, why: w });
  }
  const tol = 0.5 * Math.pow(10, -q.facts.dec) + 1e-9, levelsOut = [];
  const { watch: wl } = j;   // the levels to watch (not the yen watch list of council/ctrader-symbols.mjs)
  if (!Array.isArray(wl) || wl.length > LIM.watchMax) why.push('watch: 0 to 4');
  else for (const x of wl) {
    const lv = isObj(x) ? fin(x.level) : null, w = isObj(x) ? str(x.what, LIM.what + 100) : '';
    if (lv == null || !q.levels.some((L) => Math.abs(L - lv) <= tol)) { why.push(`watch: the level ${lv == null ? '?' : lv} is not one of the facts' levels`); continue; }
    if (w.length < 5 || w.length > LIM.what) { why.push('watch: what'); continue; }
    levelsOut.push({ level: +lv.toFixed(q.facts.dec), what: w });
  }
  const allowed = new Set((q.factsText.match(NUM) || []).map(norm));
  const texts = [['summary', summary], ['cycle', cycle], ['question', question], ...tfs.map((x) => [`timeframes ${x.tf}`, x.why]), ...levelsOut.map((x, i) => [`watch ${i + 1}`, x.what])];
  for (const [k, v] of texts) { const p = v && textProblem(k, v, allowed); if (p) why.push(p); }
  if (why.length) return { ok: false, why: why.slice(0, 8) };
  return { ok: true, answer: { summary, timeframes: tfs, cycle, watch: levelsOut, ...(question ? { question } : {}) } };
}

module.exports = { LIM, TF_IDS, TF_LABEL, PHASES, DIRS, SCHEMA, SYSTEM, buildRequest, parseAnswer, cleanFacts, levelsOf, factsText, textProblem };
