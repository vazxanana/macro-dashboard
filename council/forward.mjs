// Forward tracker of the live paper book (12 Nov 2026): how the book the owner kept live on 11 Nov 2026 (Gold trend + Gold daily
// engulf, docs/owner-decisions.md item 37) stands against the forward-test protocol of research/proposals/2026-11-12-path-to-live.md
// (section 3), ADOPTED by the owner on 12 Nov 2026 ("Yes to all": item 43). The reading itself changes nothing (coach.json
// `forward`, the Systems pane card, one Home line, one digest line). The protocol's one consequence is `stopSwitch` below, which
// the Trader applies as an owner rule: a crossed stop line (S1-S4) sends the book back to a paper shadow (config.ownerShadow), once,
// with a dated history line and one alert; it never closes or changes an open trade or its stop, and never puts the book back by
// itself. A failed execution check (E1-E5) is only reported.
//
// Pure: every input is handed in (trades.json, snapshot.json, the mirror states, ctrader/accounts.json, the proposal's json,
// the previous reading) and the clock is `now`. The band and stop-line numbers are READ from the proposal's json, never typed
// here; the execution checks' thresholds are section 3's table (E1-E5, which the json does not carry), pinned against the
// proposal's text by tests/forward.test.mjs.
//
// What counts: the two systems' OWN forward trades (`alertable` = not a shadow, `ownStream`), filled at or after the protocol's
// clock start, never a replay row; R after costs including overnight financing (the stamped `Rnet`, as the digest's merNet);
// closed positions only for the record, open ones marked to the snapshot's price (before costs) for the marked drawdown. The
// Mosha cycle (`mcycle`, a main paper system by the owner's choice of 11 Nov) is NOT part of the protocol's book and is not counted.
import fs from 'node:fs';
import { alertable } from './alerts.mjs';
import { ownStream, FIN, nights } from './fills.mjs';

export const PROTOCOL_FILE = new URL('../research/proposals/2026-11-12-path-to-live.json', import.meta.url);
export const PROTOCOL_DOC = 'research/proposals/2026-11-12-path-to-live.md';
export const DECISION = 43;
export const ADOPTED = '2026-11-12';
export const LABEL = 'protocol adopted by the owner, 12 Nov 2026 (decision 43)';
// section 3: "Clock start: 12 Nov 2026 (the first full day after item 37)"
export const START = Date.UTC(2026, 10, 12) / 1000;
// the book of the protocol: the json's source line names it "S2 = gtrend + geg" (a test reads it). Not the Mosha cycle.
export const BOOK = { gtrend: 'Gold trend', geg: 'Gold daily engulf' };
// section 3's execution table: the first 30 demo copies; E2 at least 28 of 30 (3 misses fail); E3 within 0.03R, fail worse than
// 0.05R; E4 within a fifth of the cost model's rate; E1 and E5: any case fails
export const EXEC = { n: 30, missFail: 3, slipPass: 0.03, slipFail: 0.05, finTol: 0.2 };
// a fill the mirror has not had a round to copy yet is not a miss (the Trader writes this before the mirror's round, and the
// mirror holds market copies after a reopen, LIMITS.settle): a copy is expected within this many seconds of the paper fill
export const COPY_GRACE = 6 * 3600;
const MONTH = 30.4375 * 86400;
const DONE = new Set(['expired', 'missed', 'duplicate', 'cancelled', 'canceled', 'void', 'skipped']);   // never a position (skipped: a market fill refused, fills.mjs fillCheck)

export function loadProtocol(file = PROTOCOL_FILE) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const r2 = (v) => Math.round(v * 100) / 100;
const r6 = (v) => Math.round(v * 1e6) / 1e6;   // judging a line: drop float noise of summed R, keep everything a record carries
const fillT = (x) => (num(+x.filled) ? +x.filled : num(+x.opened) ? +x.opened : NaN);
// the digest's merNet: after costs (financing included in Rnet / costR since 11 Nov)
export const netR = (x) => (num(x.Rnet) ? x.Rnet : num(x.costR) && num(x.R) ? x.R - x.costR * (x.size || 1) : x.R);
const isClosed = (x) => num(x.R) && num(+x.closed) && x.status !== 'open' && x.status !== 'pending' && !DONE.has(x.status) && !x.void;
const addMonths = (t, m) => { const d = new Date(t * 1000); d.setUTCMonth(d.getUTCMonth() + m); return d.getTime() / 1000; };
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// the book's own forward trades since the clock start (open, closed; pending orders are not positions yet)
export function bookTrades(trades, start = START) {
  return alertable(Array.isArray(trades) ? trades : [], []).filter((x) => x && BOOK[x.k] && ownStream(x) && !x.replay && x.status !== 'pending'
    && !DONE.has(x.status) && !x.void && fillT(x) >= start);
}

// the expected world's band at m months, interpolated between the proposal's checkpoints (0 months = 0R); past the last one it
// holds the last (clamp: true)
export function bandAt(protocol, m) {
  const H = protocol && protocol.worlds && protocol.worlds.expected && protocol.worlds.expected.horizons;
  if (!H) return null;
  const pts = [[0, { p5: 0, p50: 0, p95: 0 }]].concat(Object.keys(H).map(Number).filter(num).sort((a, b) => a - b).map((k) => [k, H[k].cum]));
  const last = pts[pts.length - 1];
  if (m >= last[0]) return { months: m, p5: last[1].p5, p50: last[1].p50, p95: last[1].p95, clamp: m > last[0] };
  let i = 1; while (i < pts.length && pts[i][0] < m) i++;
  const [a, A] = pts[i - 1], [b, B] = pts[i], w = b > a ? (Math.max(0, m) - a) / (b - a) : 0, f = (k) => r2(A[k] + (B[k] - A[k]) * w);
  return { months: m, p5: f('p5'), p50: f('p50'), p95: f('p95'), clamp: false };
}
export const minPositions = (protocol) => Math.min(...Object.keys((protocol && protocol.bands) || {}).map(Number).filter(num));

// closed series and drawdowns: the record's own high starts at 0 (nothing gained yet)
export function record(rows, price) {
  const closed = rows.filter(isClosed).sort((a, b) => +a.closed - +b.closed), open = rows.filter((x) => x.status === 'open');
  let cum = 0, peak = 0, ddMax = 0; const path = [];
  for (const x of closed) { cum += netR(x); peak = Math.max(peak, cum); ddMax = Math.max(ddMax, peak - cum); path.push([+x.closed, r2(cum)]); }
  let floating = 0, priced = 0;
  for (const x of open) {
    const px = price ? price(x.market) : null, r0 = +x.r0 || Math.abs(x.entry - x.stop);
    if (num(px) && r0 > 0) { floating += (x.side === 'sell' ? -1 : 1) * (px - x.entry) / r0 * (x.size || 1); priced++; }
  }
  const marked = cum + floating;
  return { n: closed.filter((x) => !x.addOf).length, units: closed.length, open: open.filter((x) => !x.addOf).length, openUnits: open.length, priced,
    total: r2(cum), floating: r2(floating), marked: r2(marked), peak: r2(peak), dd: r2(peak - cum), ddMax: r2(ddMax),
    ddMarked: r2(Math.max(ddMax, peak - marked)), ddRaw: ddMax, firstAt: closed.length ? +closed[0].closed : null, lastAt: closed.length ? +closed[closed.length - 1].closed : null, path, closed };
}

// S1-S4: S1 every round (the closed record's worst drawdown from its own high); S2-S4 at their checkpoint (the total of the
// positions closed by that date); before it the line is shown with today's figure and "checked on <date>". Each line is judged on
// the unrounded figure (review, 12 Nov 2026: a drawdown of 21.904R is "more than 21.9R" although it shows as 21.90R)
export function stopLines(protocol, rec, now, start = START) {
  const G = (protocol && protocol.gates) || {}, out = [], dd = r6(num(rec.ddRaw) ? rec.ddRaw : rec.ddMax);
  if (num(G.ddStop)) out.push({ id: 'S1', rule: 'Drawdown from the forward record’s own high', line: G.ddStop, value: rec.ddMax, state: dd > G.ddStop ? 'crossed' : 'clear', every: true });
  const F = G.floor || {};
  [12, 24, 36].forEach((m, i) => {
    if (!num(F[m])) return;
    const due = addMonths(start, m), reached = now >= due;
    const raw = reached ? r6(rec.closed.filter((x) => +x.closed <= due).reduce((s, x) => s + netR(x), 0)) : null, value = reached ? r2(raw) : rec.total;
    out.push({ id: 'S' + (i + 2), rule: `Total after ${m} months`, months: m, line: F[m], due, dueDay: day(due), value, state: !reached ? 'later' : raw < F[m] ? 'crossed' : 'clear' });
  });
  return out;
}

// ─── E1-E5 on the demo mirror ───
// mirrors: [{ account, books, state }] (ctrader/mirror-accounts.json groups with each file's state); accounts: ctrader/accounts.json
function copyOf(id, mirrors) {
  for (const g of mirrors || []) { const st = g.state || {}, m = (st.map || {})[id]; if (m) return { g, m }; }
  return null;
}
function reasonOf(id, mirrors) {
  for (const g of mirrors || []) { const st = g.state || {}, sk = (st.skipped || {})[id], w = (st.wait || {})[id];
    if (sk) return 'skipped: ' + (typeof sk === 'string' ? sk : sk.why || JSON.stringify(sk));
    if (w) return 'waiting: ' + (w.why || JSON.stringify(w)); }
  return null;
}
const bookAccount = (accounts) => ((accounts && accounts.accounts) || []).find((a) => (a.books || []).includes('council')) || null;

export function execChecks({ rows, mirrors, accounts, prev, now, start = START, fin = FIN }) {
  const P = (prev && prev.exec) || {}, carried = P.copies || {}, A = bookAccount(accounts), win = rows.slice().sort((a, b) => fillT(a) - fillT(b)).slice(0, EXEC.n);
  const posById = new Map(); for (const p of (A && A.open) || []) posById.set(String(p.id), p);
  const dealByPos = new Map(); for (const d of (A && A.history) || []) dealByPos.set(String(d.positionId), d);
  const copies = {};
  for (const x of win) {
    const c = copyOf(x.id, mirrors), old = carried[x.id] || null, fT = fillT(x);
    let rec = old ? { ...old } : { id: x.id, k: x.k, fill: fT };
    if (c) {
      const m = c.m, pos = posById.get(String(m.positionId)), deal = dealByPos.get(String(m.positionId));
      const noStop = m.stopSetBy === 'guard' || !!m.noStopTries || /^no stop/.test(m.closedWhy || '') || (pos && pos.sl == null);
      rec = { ...rec, account: c.g.account, positionId: m.positionId != null ? String(m.positionId) : rec.positionId || null, status: m.status || rec.status,
        slipR: num(m.slipR) ? m.slipR : rec.slipR ?? null, copied: m.positionId != null || num(m.fillPrice) || !!rec.copied, noStop: !!(rec.noStop || noStop),
        noStopWhy: noStop ? (pos && pos.sl == null ? 'the demo position shows no stop' : m.closedWhy || 'the mirror had to set the missing stop itself') : rec.noStopWhy || null };
      // E4: what the account charged for holding a gold buy over rollovers, against the cost model at the same rate (FIN)
      if (x.market === 'xau' && x.side === 'buy') {
        const swap = pos ? pos.swap : deal ? deal.swap : null, oz = num(+m.volume) ? +m.volume / 100 : num(+m.lots) ? +m.lots * 100 : null;
        const t0 = Date.parse(m.openedAt) / 1000, t1 = deal && deal.closedAt ? Date.parse(deal.closedAt) / 1000 : Date.parse(accounts && accounts.at) / 1000 || now;
        const nn = num(t0) && num(t1) ? nights(t0, t1) : 0, px = num(+m.fillPrice) ? +m.fillPrice : +x.entry;
        if (num(swap) && num(oz) && nn > 0) rec.fin = { nights: nn, charged: r2(-swap), model: r2(nn * fin.xau.long * px * oz), done: !!deal };
      }
    } else if (!rec.copied) {
      const why = reasonOf(x.id, mirrors); if (why) rec.why = why;
    }
    rec.due = now - fT >= COPY_GRACE;
    copies[x.id] = rec;
  }
  const C = Object.values(copies), got = C.filter((c) => c.copied), due = C.filter((c) => !c.copied && c.due), full = win.length >= EXEC.n;
  const checks = [];
  // E1 a stop on every copy
  { const bad = got.filter((c) => c.noStop);
    checks.push({ id: 'E1', label: 'A stop at the broker on every copy', state: !got.length ? 'nodata' : bad.length ? 'fail' : full ? 'pass' : 'running', n: got.length, bad: bad.length,
      text: !got.length ? 'No copy of the book on the demo account yet.' : bad.length ? `${bad.length} of ${got.length} copies were found without a stop (${bad.map((c) => c.id).slice(0, 3).join(', ')}).` : `${got.length} of ${got.length} copies so far held a stop from the fill.` }); }
  // E2 copied n of m, each miss with its reason
  { const m = got.length + due.length, why = due.filter((c) => c.why).length;
    checks.push({ id: 'E2', label: 'Paper trades of the book that reached the demo', state: !m ? 'nodata' : due.length >= EXEC.missFail ? 'fail' : full ? (due.length === why ? 'pass' : 'watch') : due.length > why ? 'watch' : 'running',
      n: got.length, of: m, misses: due.map((c) => ({ id: c.id, why: c.why || null })),
      text: !m ? 'No paper trade of the book filled since the clock start, or none old enough to expect its copy.' : `${got.length} of ${m} copied` + (due.length ? `; not copied: ${due.map((c) => `${c.id} (${c.why || 'no reason on file'})`).slice(0, 3).join('; ')}` : '') + '.' }); }
  // E3 fill against paper, average R
  { const s = got.map((c) => c.slipR).filter(num), a3 = s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length * 1000) / 1000 : null;
    checks.push({ id: 'E3', label: 'Average fill against paper, in R', state: !s.length ? 'nodata' : !full ? 'running' : a3 <= EXEC.slipPass ? 'pass' : a3 > EXEC.slipFail ? 'fail' : 'watch', n: s.length, avg: a3,
      text: !s.length ? 'No copy has a fill yet.' : `Average ${a3 > 0 ? a3.toFixed(3) + 'R worse than' : a3 < 0 ? (-a3).toFixed(3) + 'R better than' : 'equal to'} paper over ${s.length} cop${s.length === 1 ? 'y' : 'ies'} (positive = worse).` }); }
  // E4 financing charged against the cost model
  { const F = C.map((c) => c.fin).filter((f) => f && f.model > 0), ch = F.reduce((a, f) => a + f.charged, 0), mo = F.reduce((a, f) => a + f.model, 0), ratio = mo > 0 ? Math.round(ch / mo * 1000) / 1000 : null;
    checks.push({ id: 'E4', label: 'Financing charged on gold buys against the cost model', state: !F.length ? 'nodata' : !full ? 'running' : ratio <= 1 + EXEC.finTol ? 'pass' : 'fail', n: F.length, ratio, charged: r2(ch), model: r2(mo),
      text: !F.length ? 'Not measurable yet: no copy of a gold buy has been held over a rollover with its swap in the account files.' : `Charged $${r2(ch)} against $${r2(mo)} by the model (${Math.round(ratio * 100)} %) on ${F.length} gold buy cop${F.length === 1 ? 'y' : 'ies'}.` }); }
  // E5 nothing on the book's account the mirror did not place (since the clock start). A flag carried from an earlier reading is
  // dropped once a mirror record holds it (review, 12 Nov 2026: the account file and the mirror state are written at different
  // moments, so a limit that filled in between was flagged for good); a resting limit the mirror has since adopted is matched by
  // its position record (viaLimit: symbol, side, limit price); a position and its closing deal are one item, not two.
  const known = new Set(), orders = new Set(), limits = new Set(), lk = (sym, side, px) => `${sym}|${side}|${num(+px) ? +(+px).toFixed(6) : ''}`;
  for (const g of mirrors || []) { const st = g.state || {};
    for (const m of Object.values(st.map || {})) { if (m && m.positionId != null) known.add(String(m.positionId)); if (m && m.viaLimit && m.limitPrice != null) limits.add(lk(m.symbol, m.side, m.limitPrice)); }
    for (const o of Object.values(st.orders || {})) if (o && o.orderId != null) orders.add(String(o.orderId)); }
  for (const c of Object.values(carried)) if (c && c.positionId) known.add(String(c.positionId));
  const held = (f) => (f.kind === 'order' ? orders.has(String(f.id)) || (f.price != null && limits.has(lk(f.symbol, f.side, f.price))) : known.has(String(f.id)));
  const key = (f) => (f.kind === 'order' ? 'order:' : 'pos:') + f.id;
  const foreign = (Array.isArray(P.foreign) ? P.foreign : []).filter((f) => f && !held(f)).reduce((a, f) => (a.some((x) => key(x) === key(f)) ? a : a.concat([f])), []);
  if (A) {
    const seen = new Set(foreign.map(key)), add = (f) => { if (!held(f) && !seen.has(key(f))) { seen.add(key(f)); foreign.push(f); } };
    for (const p of A.open || []) if (Date.parse(p.openedAt) / 1000 >= start) add({ kind: 'position', id: String(p.id), symbol: p.symbol, side: p.side, lots: p.lots, at: p.openedAt });
    for (const o of A.orders || []) add({ kind: 'order', id: String(o.id), symbol: o.symbol, side: o.side, price: o.price ?? null });
    for (const d of A.history || []) if (Date.parse(d.closedAt) / 1000 >= start) add({ kind: 'deal', id: String(d.positionId), symbol: d.symbol, side: d.side, lots: d.lots, at: d.closedAt });
  }
  checks.push({ id: 'E5', label: 'Nothing on the account the mirror did not place', state: foreign.length ? 'fail' : !A ? 'nodata' : full ? 'pass' : 'running', n: foreign.length,
    text: foreign.length ? `${foreign.length} on the Council demo account with no mirror record: ${foreign.slice(0, 3).map((f) => `${f.kind} ${f.id} ${f.symbol || ''} ${f.side || ''}`.trim()).join('; ')}.` : !A ? 'The account file is not there.' : 'None since the clock start.' });
  return { window: EXEC.n, trades: win.length, copied: got.length, checks, copies, foreign };
}

// ─── the reading ───
export function buildForward({ trades, snapshot, mirrors, accounts, protocol, prev } = {}, { now = Date.now() / 1000, start = START } = {}) {
  const at = new Date(now * 1000).toISOString();
  if (!protocol || !protocol.gates || !protocol.worlds) return { at, v: 1, error: `no protocol file (${PROTOCOL_DOC.replace(/\.md$/, '.json')})`, label: LABEL, decision: DECISION };
  const mk = (snapshot && snapshot.markets) || {}, price = (m) => (mk[m] && num(mk[m].price) ? mk[m].price : null);
  const rows = bookTrades(trades, start), rec = record(rows, price), months = Math.max(0, (now - start) / MONTH), min = minPositions(protocol);
  const b = bandAt(protocol, months), where = rec.total < b.p5 ? 'below' : rec.total > b.p95 ? 'above' : 'inside';
  const stops = stopLines(protocol, rec, now, start), exec = execChecks({ rows, mirrors, accounts, prev, now, start });
  const crossed = stops.filter((s) => s.state === 'crossed'), failed = exec.checks.filter((c) => c.state === 'fail');
  const status = crossed.length ? 'stop' : rec.n < min ? 'few' : where === 'below' ? 'below' : 'ok';
  const span = rec.n ? `${rec.n} position${rec.n === 1 ? '' : 's'} closed, ${day(start)} to ${day(rec.lastAt)}` : `no position closed since ${day(start)}`;
  const head = { stop: 'A stop line is crossed', few: 'Too few trades to say', below: 'Below the expected range', ok: 'On track' }[status];
  const alerts = crossed.map((s) => `Forward book: stop line ${s.id} crossed (${s.rule.toLowerCase()} ${s.id === 'S1' ? `${s.value}R, line more than ${s.line}R` : `${s.value}R, line below ${s.line}R`}); by the protocol you adopted on 12 Nov 2026 (decision 43) the book goes back to a paper shadow; no open trade is closed and every stop stays.`)
    .concat(failed.map((c) => `Forward book: execution check ${c.id} fails (${c.label.toLowerCase()}): ${c.text} Reported only (protocol adopted 12 Nov 2026, decision 43): nothing was changed.`));
  // the chart: the band at the checkpoints up to the horizon shown, and the closed record by month
  const show = Math.max(12, Math.ceil(months / 6) * 6);
  const H = protocol.worlds.expected.horizons, bandPts = [[0, 0, 0, 0]].concat(Object.keys(H).map(Number).filter((k) => num(k) && k <= Math.max(show, 6)).sort((a, c) => a - c).map((k) => [k, H[k].cum.p5, H[k].cum.p50, H[k].cum.p95]));
  if (bandPts[bandPts.length - 1][0] < show) { const e = bandAt(protocol, show); bandPts.push([show, e.p5, e.p50, e.p95]); }
  return { at, v: 1, label: LABEL, decision: DECISION, adopted: ADOPTED, doc: PROTOCOL_DOC,
    protocol: { built: protocol.built, start: day(start), minPositions: min, ddStop: protocol.gates.ddStop, floor: protocol.gates.floor, months: protocol.gates.protocolMonths },
    book: Object.keys(BOOK), names: Object.values(BOOK), status, head, sentence: `${head}: ${span}, ${rec.total >= 0 ? '+' : '−'}${Math.abs(rec.total).toFixed(2)}R after costs.`,
    record: { n: rec.n, units: rec.units, open: rec.open, total: rec.total, floating: rec.floating, marked: rec.marked, peak: rec.peak, dd: rec.dd, ddMax: rec.ddMax, ddMarked: rec.ddMarked,
      firstAt: rec.firstAt, lastAt: rec.lastAt, months: r2(months), from: day(start), path: rec.path.map(([t, c]) => [r2((t - start) / MONTH), c]) },
    band: { ...b, where, show }, bandPts, stops, exec: { window: exec.window, trades: exec.trades, copied: exec.copied, checks: exec.checks, copies: exec.copies, foreign: exec.foreign }, alerts };
}

// one line for the digest / Home row: only when a stop line is crossed or an execution check fails, never otherwise
export function forwardLine(fw) {
  const A = fw && Array.isArray(fw.alerts) ? fw.alerts : [];
  if (!A.length) return null;
  const s = (fw.stops || []).filter((x) => x.state === 'crossed').map((x) => x.id), e = ((fw.exec && fw.exec.checks) || []).filter((c) => c.state === 'fail').map((c) => c.id);
  return `Forward book (protocol adopted 12 Nov 2026: decision 43): ${s.length ? `stop line ${s.join(', ')} crossed` : ''}${s.length && e.length ? '; ' : ''}${e.length ? `execution check ${e.join(', ')} fails` : ''}. ${s.length ? 'The book goes back to a paper shadow (no open trade closed, every stop kept)' : 'Reported only, nothing was changed'}; see Council, Systems.`;
}

// ─── the protocol's consequence (owner, 12 Nov 2026: item 43 adopted) ───
// Section 3: "any one: the book goes back to a paper shadow and you are told; no trade is closed by it, every open trade keeps its
// stop and runs to its own exit". Applied by the Trader at the start of a round, from the LAST reading in coach.json, as an owner
// rule: Gold trend and Gold daily engulf join config.ownerShadow (the supported-book switch of 11 Nov: their NEW trades are paper
// shadows, blockedBy owner-shadow; trades already open or pending run to their own exits with their stops), config.forwardStop
// records why, and config.history gets one `by: 'user'` line quoting the protocol. ONCE: a config that already has `forwardStop`
// is left alone, and nothing here ever removes a system from ownerShadow (putting the book back is the owner's, by a new rule).
// Execution checks never switch anything. Returns null when nothing is done; else { lines, history, alert }.
export const SWITCH_K = ['gtrend', 'geg'];
export const QUOTE = 'any one: the book goes back to a paper shadow and you are told; no trade is closed by it, every open trade keeps its stop and runs to its own exit';
export function stopSwitch(config, fw, now = Date.now() / 1000) {
  if (!config || typeof config !== 'object' || config.forwardStop || !fw || fw.error || !Array.isArray(fw.stops)) return null;
  const crossed = fw.stops.filter((s) => s && s.state === 'crossed' && /^S[1-4]$/.test(s.id));
  if (!crossed.length) return null;
  const at = Math.floor(now), iso = new Date(at * 1000).toISOString(), lines = crossed.map((s) => s.id);
  const what = crossed.map((s) => `${s.id} ${s.rule.toLowerCase()} ${s.id === 'S1' ? `${s.value}R, line more than ${s.line}R` : `${s.value}R, line below ${s.line}R`}`).join('; ');
  config.ownerShadow = { ...(config.ownerShadow || {}) };
  for (const k of SWITCH_K) if (!config.ownerShadow[k]) config.ownerShadow[k] = at;
  const alert = { title: 'Forward book: stop line crossed, the book goes back to a paper shadow',
    msg: `Stop line ${lines.join(', ')} of the forward-test protocol you adopted on 12 Nov 2026 is crossed (${what}). From this round Gold trend and Gold daily engulf trade as paper shadows. No open trade was closed and every stop stays; nothing goes back by itself: putting the book back is your decision.` };
  config.forwardStop = { at, iso, lines, reading: fw.at || null, systems: SWITCH_K.slice(), what, alert };
  const history = { at: iso, by: 'user', change: `Forward-test protocol: stop line ${lines.join(', ')} crossed; Gold trend and Gold daily engulf go back to paper shadows (new trades only; open trades run to their own exits with their stops)`,
    why: `Protocol adopted by the owner on 12 Nov 2026 ("Yes to all", docs/owner-decisions.md item 43; research/proposals/2026-11-12-path-to-live.md section 3): "${QUOTE}". Crossed: ${what}.` };
  if (!Array.isArray(config.history)) config.history = [];
  config.history.push(history);
  return { lines, history, alert };
}
