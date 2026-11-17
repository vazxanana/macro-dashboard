// ChronosTrade's AI coach (17 Nov 2026, owner: the API connected "to use in the edges and in ChronosTrade"). Pure: the request
// is built here from what the page sends, every field checked and capped (the page is never trusted), and the answer is checked
// in code. The endpoint (api/chronos-coach.js) calls the shared language-model adapter (api/_academy-llm.js).
//
// Paper only. A language model's reading of a BACKTEST REPLAY, never a tested edge: it places, changes or refuses no order,
// moves no stop, and nothing on the page or the council reads it. No model name is written here: the model id comes from the
// environment.
//
// Two questions:
//   trade    one trade as the page holds it (side, entry, the stop it OPENED with, target, exit, R, the coach's context at
//            entry, its behaviour flags, the trader's tags / mistakes / note), the last <= 120 candles that CLOSED by the entry,
//            and, for a closed trade, the candles from the entry to the exit (it is after the fact). For an OPEN trade only
//            candles closed by the replay moment: nothing after it, and no exit or result.
//   session  the session's closed trades: the coach's splits (BT.coachSplits) and the last 40 trades' sentence and R. No candles.
//   live     (17 Nov 2026, "the live coach") a short comment while the trader replays: at an entry, at an exit, or when asked
//            "What do you see?". The chart as it stands at the replay moment: the last <= 60 candles that CLOSED by it (none after),
//            the open positions (opening stop on the losing side, floating R), drafts, the drawings read against the price, the
//            last 10 closed trades' R and sentences and the session's largest difference. The answer is 2-4 plain sentences
//            (not the JSON card), checked by parseLive.
// Smaller prompts (17 Nov 2026, "faster"): 60 candles before the entry (was 120), entry to exit capped at 120 (was 400).
'use strict';

const LIM = { before: 60, after: 120, live: 60, livePos: 5, liveDrafts: 2, liveTrades: 10, liveText: 900, str: 400, note: 600, tag: 30, tags: 8, flags: 8, trades: 40, groups: 10, features: 10, ctxKeys: 40, depth: 3, arr: 8 };
const KINDS = ['good', 'risk', 'habit', 'idea'];
const MIN_N = 20;
const TFS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 86400, 604800];
const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);
const str = (v, n = LIM.str) => (v == null ? '' : String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const rd = (v, dec) => (v == null ? null : +v.toFixed(Math.max(0, Math.min(6, dec))));

// any small JSON value: finite numbers, booleans, short strings, objects / arrays to a fixed depth and size
function cleanVal(v, depth = 0) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return str(v, 60);
  if (depth >= LIM.depth) return null;
  if (Array.isArray(v)) return v.slice(0, LIM.arr).map((x) => cleanVal(x, depth + 1)).filter((x) => x != null);
  if (isObj(v)) { const o = {}; let n = 0; for (const [k, x] of Object.entries(v)) { if (n >= LIM.ctxKeys) break; if (!/^[A-Za-z][\w]{0,24}$/.test(k)) continue; const c = cleanVal(x, depth + 1); if (c != null) { o[k] = c; n++; } } return o; }
  return null;
}
// candles [[t, o, h, l, c]] (or { time, open, high, low, close }) of timeframe sec; only those that ENDED by `until` and start at
// or after `from` are kept, the last `max` of them (or the first, with first: true)
function cleanBars(list, sec, { from = -Infinity, until, max, first = false, dec = 5 }) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const b of list.slice(0, 5000)) {
    const a = Array.isArray(b) ? b : isObj(b) ? [b.time, b.open, b.high, b.low, b.close] : null; if (!a) continue;
    const [t, o, h, l, c] = a.map(fin); if ([t, o, h, l, c].some((x) => x == null) || !(h >= l) || t < from || t + sec > until) continue;
    out.push([Math.round(t), rd(o, dec), rd(h, dec), rd(l, dec), rd(c, dec)]);
  }
  out.sort((x, y) => x[0] - y[0]);
  return first ? out.slice(0, max) : out.slice(-max);
}
const strList = (v, n, len = LIM.tag) => (Array.isArray(v) ? v.slice(0, n).map((x) => str(x, len)).filter(Boolean) : []);

// the trade question -> { payload } or throws a 400
function tradePayload(b) {
  const t = isObj(b.trade) ? b.trade : null; if (!t) throw bad('no trade');
  const side = t.side === 'buy' || t.side === 'sell' ? t.side : null; if (!side) throw bad('side must be buy or sell');
  const sec = TFS.includes(fin(b.tf)) ? fin(b.tf) : null; if (!sec) throw bad('unknown timeframe');
  const dec = Math.max(0, Math.min(6, Math.round(fin(b.dec) ?? 5)));
  const entry = fin(t.entry), stop0 = fin(t.stop0), openedAt = fin(t.openedAt), moment = fin(b.moment);
  if (entry == null || stop0 == null || openedAt == null || moment == null) throw bad('entry, opening stop, open time and moment are needed');
  // every trade has a stop (absolute rule 1): an opening stop on the wrong side or at the entry is not a trade the coach reviews
  if ((side === 'buy' && !(stop0 < entry)) || (side === 'sell' && !(stop0 > entry))) throw bad('the opening stop must be on the losing side of the entry');
  if (moment < openedAt) throw bad('the moment is before the entry');
  const closedAt = fin(t.closedAt), closed = closedAt != null && closedAt >= openedAt && closedAt <= moment;
  const target = fin(t.target);
  const trade = { status: closed ? 'closed' : 'open', market: str(b.market, 24), timeframeSec: sec, side, entry: rd(entry, dec), openingStop: rd(stop0, dec),
    target: target == null ? null : rd(target, dec), riskPoints: rd(Math.abs(entry - stop0), dec), openedAtUtc: new Date(openedAt * 1000).toISOString(),
    coachSentence: str(t.sentence), context: isObj(t.ctx) ? cleanVal(t.ctx) : null,
    behaviourFlags: Array.isArray(t.flags) ? t.flags.slice(0, LIM.flags).map((f) => (isObj(f) ? str(f.text, 200) : str(f, 200))).filter(Boolean) : [],
    tags: strList(t.tags, LIM.tags), mistakesTicked: strList(t.mistakes, 10), reviewed: t.reviewed === true, note: str(t.note, LIM.note),
    mfeR: fin(t.mfe), maeR: fin(t.mae) };
  if (closed) Object.assign(trade, { exit: rd(fin(t.exit), dec), closedAtUtc: new Date(closedAt * 1000).toISOString(), exitReason: str(t.reason, 40), R: fin(t.R), net: fin(t.net) });
  else Object.assign(trade, { replayMomentUtc: new Date(moment * 1000).toISOString() });   // no exit, no result: the trade is not over
  // never a candle after the replay moment; after the fact only for a closed trade (entry to exit)
  const before = cleanBars(b.before, sec, { until: Math.min(openedAt, moment), max: LIM.before, dec });
  const after = cleanBars(b.after, sec, { from: openedAt, until: closed ? Math.min(closedAt + sec, moment) : moment, max: LIM.after, first: closed, dec });   // an open trade: the latest candles
  return { kind: 'trade', trade, candles: { timeframeSec: sec, columns: ['timeUnix', 'open', 'high', 'low', 'close'], closedBeforeEntry: before, [closed ? 'entryToExit' : 'sinceEntryClosedByNow']: after } };
}
// the session question -> { payload } or throws a 400
function sessionPayload(b) {
  const s = isObj(b.splits) ? b.splits : null; if (!s) throw bad('no splits');
  const features = (Array.isArray(s.features) ? s.features : []).slice(0, LIM.features).map((f) => ({ name: str(f && f.name, 60),
    groups: (Array.isArray(f && f.groups) ? f.groups : []).slice(0, LIM.groups).map((g) => ({ label: str(g && g.label, 60), n: Math.max(0, Math.round(fin(g && g.n) || 0)), winRate: fin(g && g.winRate), meanR: fin(g && g.meanR), t: fin(g && g.t), judge: str(g && g.judge, 60) })) }))
    .filter((f) => f.name && f.groups.length);
  const trades = (Array.isArray(b.trades) ? b.trades : []).slice(-LIM.trades).map((t) => (isObj(t) ? { R: fin(t.R), side: t.side === 'buy' || t.side === 'sell' ? t.side : null, sentence: str(t.sentence), mistakes: strList(t.mistakes, 10), tags: strList(t.tags, 4) } : null)).filter((t) => t && (t.R != null || t.sentence));
  const n = Math.max(0, Math.round(fin(s.n) || 0));
  if (!trades.length && !n) throw bad('no closed trades');
  return { kind: 'session', session: { closedTrades: n, withoutContext: Math.max(0, Math.round(fin(s.noCtx) || 0)), tooFewBelow: MIN_N, largestDifference: str(s.lead, 400) || null, splits: features, lastTrades: trades } };
}

const SHAPE = '{"summary":"1-2 sentences","points":[{"kind":"good|risk|habit|idea","text":"…"}],"question":"one question back to the trader, or an empty string"}';
const SCHEMA = { type: 'object', additionalProperties: false, required: ['summary', 'points', 'question'], properties: {
  summary: { type: 'string' }, question: { type: 'string' },
  points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'text'], properties: { kind: { type: 'string', enum: KINDS }, text: { type: 'string' } } } } } };
function systemText(lang) {
  return [
    'You are a trading coach reviewing a PAPER backtest replay in ChronosTrade, a practice tool: the trader replays past candles and places paper trades. Nothing you say places, changes or refuses an order.',
    lang === 'fr' ? 'Answer in French. Keep the trading terms in English (stop, target, entry, R, ATR, trend, session names such as London, New York, Asia, timeframes such as H1, M15).' : 'Answer in plain English, short sentences.',
    'Say what you see in this trade or in the trader\'s habits, and tie every point to the numbers given (the context, R, ATR, the candles, the splits). Never invent a number, a price or a statistic.',
    'Never present anything as a tested edge and never promise or predict results. A split or a group with fewer than 20 trades is too small to judge: say so when you use it.',
    'Never suggest removing a stop, widening a stop, moving a stop further from the entry or trading without one. Every trade keeps a stop.',
    'For an OPEN trade you only have candles up to the replay moment: do not guess what comes next.',
    `Answer with ONE JSON object and nothing else, exactly this shape: ${SHAPE}. 1 to 6 points; kind good = something done well, risk = a risk in this trade, habit = a pattern across trades, idea = something to try in the next replay.`,
  ].join('\n');
}
// the live question -> { payload } or throws a 400. Nothing after the replay moment: candles that end after it, positions or
// drafts opened after it and trades closed after it are dropped here, whatever the page sent.
const TRIGGERS = ['open', 'close', 'ask', 'event'];
const EVENT_KINDS = ['level', 'stop', 'target', 'swing', 'session', 'big', 'r', 'draft'], STALE_BARS = 10;
function livePayload(b) {
  const trigger = TRIGGERS.includes(b.trigger) ? b.trigger : null; if (!trigger) throw bad('trigger must be open, close, ask or event');
  const sec = TFS.includes(fin(b.tf)) ? fin(b.tf) : null; if (!sec) throw bad('unknown timeframe');
  const moment = fin(b.moment); if (moment == null) throw bad('the replay moment is needed');
  const dec = Math.max(0, Math.min(6, Math.round(fin(b.dec) ?? 5)));
  const bars = cleanBars(b.bars, sec, { until: moment, max: LIM.live, dec });
  if (!bars.length) throw bad('no closed candles');
  const positions = [];
  for (const p of (Array.isArray(b.positions) ? b.positions : []).slice(0, LIM.livePos)) {
    if (!isObj(p)) continue; const side = p.side === 'buy' || p.side === 'sell' ? p.side : null, entry = fin(p.entry), stop0 = fin(p.stop0), stop = fin(p.stop), at = fin(p.openedAt);
    if (!side || entry == null || stop0 == null || at == null || at > moment) continue;
    // every trade has a stop (absolute rule 1): an opening stop at or past the entry is not a position the coach comments on
    if ((side === 'buy' && !(stop0 < entry)) || (side === 'sell' && !(stop0 > entry))) throw bad('an opening stop must be on the losing side of its entry');
    const target = fin(p.target);
    positions.push({ side, entry: rd(entry, dec), openingStop: rd(stop0, dec), stopNow: stop == null ? null : rd(stop, dec), target: target == null ? null : rd(target, dec), openedAtUtc: new Date(at * 1000).toISOString(), floatingR: fin(p.floatR), coachSentence: str(p.sentence) });
  }
  const drafts = [];
  for (const x of (Array.isArray(b.drafts) ? b.drafts : []).slice(0, LIM.liveDrafts)) {
    if (!isObj(x)) continue; const side = x.side === 'buy' || x.side === 'sell' ? x.side : null, entry = fin(x.entry), stop = fin(x.stop), target = fin(x.target);
    if (!side || entry == null || stop == null || (side === 'buy' ? !(stop < entry) : !(stop > entry))) continue;
    drafts.push({ side, entry: rd(entry, dec), stop: rd(stop, dec), target: target == null ? null : rd(target, dec), coachSentence: str(x.sentence) });
  }
  const lastTrades = (Array.isArray(b.trades) ? b.trades : []).filter((t) => isObj(t) && !(fin(t.closedAt) > moment)).slice(-LIM.liveTrades)
    .map((t) => ({ R: fin(t.R), side: t.side === 'buy' || t.side === 'sell' ? t.side : null, sentence: str(t.sentence), flags: strList(t.flags, 4, 160) })).filter((t) => t.R != null || t.sentence);
  // a market event (the page's free note): only one of the known kinds, at or before the moment and no more than 10 candles old
  if (trigger === 'event') { const e = isObj(b.event) ? b.event : {}, at = fin(e.at);
    if (!EVENT_KINDS.includes(e.kind) || !str(e.text)) throw bad('an event needs a known kind and its text');
    if (at == null || at > moment || moment - at > STALE_BARS * sec) throw bad('a stale event: more than 10 candles before the replay moment, or after it'); }
  const ev = trigger === 'event' ? { kind: 'market event', what: str(b.event.kind, 20), text: str(b.event.text, 200), atUtc: new Date(fin(b.event.at) * 1000).toISOString() } : isObj(b.event) && trigger !== 'ask' ? { kind: trigger, side: b.event.side === 'buy' || b.event.side === 'sell' ? b.event.side : null, ...(trigger === 'close' ? { R: fin(b.event.R), exitReason: str(b.event.reason, 40) } : {}), coachSentence: str(b.event.sentence), flags: strList(b.event.flags, 6, 160) } : null;
  const closedN = Math.max(0, Math.round(fin(b.closedN) || 0));
  return { kind: 'live', trigger, live: { market: str(b.market, 24), timeframeSec: sec, replayMomentUtc: new Date(moment * 1000).toISOString(), lastClose: bars[bars.length - 1][4],
    event: ev, openPositions: positions, drafts, drawings: isObj(b.drawings) ? cleanVal(b.drawings) : null, closedTradesInSession: closedN, tooFewBelow: MIN_N, lastTrades, largestDifference: str(b.lead, 300) || null },
    candles: { timeframeSec: sec, columns: ['timeUnix', 'open', 'high', 'low', 'close'], closedByNow: bars } };
}
function liveSystem(lang) {
  return [
    'You are a calm trading coach watching a trader practise on a PAPER backtest replay in ChronosTrade. You see the chart as it stands at the replay moment and the trader\'s own positions, drafts, drawn levels and recent trades. Nothing you say places, changes or refuses an order.',
    lang === 'fr' ? 'Answer in French. Keep the trading terms in English (stop, target, entry, R, ATR, trend, session names, timeframes such as H1, M15).' : 'Answer in plain English.',
    'Write 2 to 4 short sentences of plain text: no list, no heading, no JSON. Comment on what the trader is doing relative to their own context: the trend, the levels and their drawn levels, the stop size, the reward to risk, and habits such as a trade soon after a loss or a close before the target. Ask at most one question.',
    'Tie what you say to the numbers given. Never invent a price or a statistic. Never say what the next candle or the price will do as a fact: you may name what would change the picture.',
    'Never present anything as a tested edge and never promise a result. With fewer than 20 closed trades in the session, say the sample is too small when you speak of habits.',
    'Never suggest removing a stop, widening a stop, moving a stop further from the entry or trading without one. Every trade keeps a stop.',
  ].join('\n');
}
const LIVE_ASK = { open: 'The trader just opened a position. Comment on it.', close: 'The trader just closed a position. Comment on it.', ask: 'The trader asks: "What do you see?" Comment on the chart and on what they are doing now.', event: 'Something just happened on the chart (the event below). Comment on it briefly, in the context of what the trader is doing.' };
// -> { system, prompt, schema, payload } or throws a 400
function buildRequest(b) {
  if (!isObj(b)) throw bad('bad request');
  const kind = b.kind === 'trade' ? 'trade' : b.kind === 'session' ? 'session' : b.kind === 'live' ? 'live' : null; if (!kind) throw bad('kind must be trade, session or live');
  const lang = b.lang === 'fr' ? 'fr' : 'en';
  if (kind === 'live') { const payload = livePayload(b); return { kind, lang, trigger: payload.trigger, system: liveSystem(lang), prompt: `${LIVE_ASK[payload.trigger]}\n\n${JSON.stringify(payload)}`, schema: null, payload }; }
  const payload = kind === 'trade' ? tradePayload(b) : sessionPayload(b);
  return { kind, lang, system: systemText(lang), prompt: `${kind === 'trade' ? 'Review this trade.' : 'Review this replay session.'}\n\n${JSON.stringify(payload)}`, schema: SCHEMA, payload };
}

// stop advice the coach must never give (absolute rule 1), and claims it must never make
const STOP_BAD = /\b(remove|removing|drop|dropping|delete|without|no)\s+(the\s+|a\s+|your\s+)?stop\b|\bwiden(ing)?\s+(the\s+|your\s+)?stop\b|\bstop\s+(further|farther)\s+(away|from)\b|\bmove\s+(the\s+|your\s+)?stop\s+(further|farther|away|back)\b|\b(retirer|supprimer|enlever|élargir|elargir)\s+(le\s+|ton\s+|votre\s+)?stop\b/i;
const CLAIM_BAD = /\b(guarantee[ds]?|risk[- ]free|sure thing|proven edge|tested edge)\b/i;
// -> { ok: true, answer } | { ok: false, why: [...] }
function parseAnswer(text) {
  const why = []; let j = null, s = String(text == null ? '' : text).trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) s = m[1].trim();
  const a = s.indexOf('{'), z = s.lastIndexOf('}'); if (a >= 0 && z > a) s = s.slice(a, z + 1);
  try { j = JSON.parse(s); } catch (e) { return { ok: false, why: ['not JSON'] }; }
  if (!isObj(j)) return { ok: false, why: ['not an object'] };
  const summary = str(j.summary, 500); if (!summary) why.push('no summary');
  const pts = Array.isArray(j.points) ? j.points : []; if (!pts.length || pts.length > 6) why.push('1 to 6 points');
  const points = pts.slice(0, 6).map((p) => (isObj(p) && KINDS.includes(p.kind) && str(p.text) ? { kind: p.kind, text: str(p.text) } : null));
  if (points.some((p) => !p)) why.push('a point without a known kind or text');
  const question = j.question == null ? '' : str(j.question, 300);
  const all = [summary, question, ...points.filter(Boolean).map((p) => p.text)].join(' ');
  // a sentence that says NOT to remove / widen the stop is fine; only advice to do it is refused
  const advice = all.split(/(?<=[.!?;])\s+/).filter((x) => STOP_BAD.test(x) && !/\b(never|don'?t|do not|not|avoid|keep|ne\s+pas|jamais)\b/i.test(x));
  if (advice.length) why.push('stop advice the coach may not give');
  if (CLAIM_BAD.test(all.replace(/\b(not|never|no)\s+(a\s+)?(guarantee[ds]?|proven edge|tested edge)\b/gi, ''))) why.push('a claim the coach may not make');
  if (why.length) return { ok: false, why };
  return { ok: true, answer: { summary, points, question } };
}

// a live comment: plain text, the same stop and claim rules, and no forecast stated as fact -> { ok, text } | { ok: false, why }
const FORECAST_BAD = /\b(price|gold|it|the market|the next candle|this candle)\s+will\s+(definitely\s+|surely\s+|certainly\s+)?(go|rise|fall|drop|reach|hit|break|bounce|reverse|rally|close)\b/i;
function parseLive(text) {
  let s = String(text == null ? '' : text).replace(/```[a-z]*\s*|```/gi, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
  if (!s) return { ok: false, why: ['no text'] };
  s = s.replace(/\n{3,}/g, '\n\n').slice(0, LIM.liveText);
  const why = [], sentences = s.split(/(?<=[.!?;])\s+/);
  if (sentences.some((x) => STOP_BAD.test(x) && !/\b(never|don'?t|do not|not|avoid|keep|ne\s+pas|jamais)\b/i.test(x))) why.push('stop advice the coach may not give');
  if (CLAIM_BAD.test(s.replace(/\b(not|never|no)\s+(a\s+)?(guarantee[ds]?|proven edge|tested edge)\b/gi, ''))) why.push('a claim the coach may not make');
  if (sentences.some((x) => FORECAST_BAD.test(x) && !/\b(if|could|may|might|would|whether|not|unless|si|pourrait)\b/i.test(x))) why.push('a forecast stated as fact');
  return why.length ? { ok: false, why } : { ok: true, text: s };
}

module.exports = { LIM, KINDS, MIN_N, TFS, SCHEMA, TRIGGERS, EVENT_KINDS, STALE_BARS, buildRequest, parseAnswer, parseLive, systemText, liveSystem, cleanBars, _t: { tradePayload, sessionPayload, livePayload, cleanVal } };
