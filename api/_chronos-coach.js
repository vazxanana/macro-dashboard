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
'use strict';

const LIM = { before: 120, after: 400, str: 400, note: 600, tag: 30, tags: 8, flags: 8, trades: 40, groups: 10, features: 10, ctxKeys: 40, depth: 3, arr: 8 };
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
  const after = cleanBars(b.after, sec, { from: openedAt, until: closed ? Math.min(closedAt + sec, moment) : moment, max: LIM.after, first: true, dec });
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
// -> { system, prompt, schema, payload } or throws a 400
function buildRequest(b) {
  if (!isObj(b)) throw bad('bad request');
  const kind = b.kind === 'trade' ? 'trade' : b.kind === 'session' ? 'session' : null; if (!kind) throw bad('kind must be trade or session');
  const lang = b.lang === 'fr' ? 'fr' : 'en', payload = kind === 'trade' ? tradePayload(b) : sessionPayload(b);
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

module.exports = { LIM, KINDS, MIN_N, TFS, SCHEMA, buildRequest, parseAnswer, systemText, cleanBars, _t: { tradePayload, sessionPayload, cleanVal } };
