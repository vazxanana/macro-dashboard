// cTrader demo mirror: a read-only reconciliation of what the edges have open against what the demo accounts hold.
//
//   node council/ctrader-reconcile.mjs <council-data dir> [--json]
//
// It reads files only (trades.json, ict/trades.json, research.json, ctrader/mirror*.json, ctrader/accounts.json): it never
// contacts the broker and changes nothing. For every open or pending trade of every book it says whether the demo account of
// that book holds the copy, and whether side, stop and target match; and for every demo position and resting order whether a
// council trade stands behind it. A demo position without a stop is always an error (rule 1).
//
// How levels are compared (the mirror's own design, see ctrader-mirror.mjs): a market copy carries the council's stop and
// target DISTANCES, measured from the council's price at the copy and applied at the broker's fill, because the broker's price
// differs from the council's feed by a small basis and the spread. So the expected stop is fill + (council stop - council
// price at the copy). Once the council moves a stop, or the copy was a resting limit, the council's absolute level is sent
// (also when the stop guard had to set the stop itself) and that is what is expected. An ICT copy carries the desk's stop distance (futures levels, a cash CFD at the broker).
import fs from 'node:fs';
import path from 'node:path';
import { bookOf, ictCandidates, replicaCandidates, replicaHasOwnAccount, replicaMarkets, SYMBOLS } from './ctrader-mirror.mjs';

const rd = (dir, f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return d; } };
// "owner rule: replica gold only since 2026-11-11" (the markets and the date from config.json mirrorReplica)
export function replicaRuleWhy(cfg) {
  const R = (cfg && cfg.mirrorReplica) || {}, mk = Array.isArray(R.markets) ? R.markets : [], since = Number.isFinite(+R.since) ? new Date(+R.since * 1000).toISOString().slice(0, 10) : null;
  const names = mk.map((m) => (m === 'xau' ? 'gold' : m)).join(', ') || 'none';
  return `owner rule: replica ${names} only${since ? ` since ${since}` : ''}`;
}
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;

export function reconcile(dir) {
  const raw = rd(dir, 'trades.json', []), own = Array.isArray(raw) ? raw : raw.trades || [], ict = rd(dir, 'ict/trades.json', []), research = rd(dir, 'research.json', []), cfg = rd(dir, 'config.json', {}) || {};
  const map = rd(dir, 'ctrader/mirror-accounts.json', { groups: [] }), accounts = rd(dir, 'ctrader/accounts.json', { accounts: [] }), shadows = cfg.mirrorShadow !== false;
  const byBook = {}; for (const g of map.groups) for (const b of g.books) byBook[b] = g;
  const trades = own.concat(ictCandidates(ict), replicaHasOwnAccount(Object.fromEntries(Object.entries(byBook).map(([b, g]) => [b, g.account]))) ? replicaCandidates(research, own, replicaMarkets(cfg)) : []);
  const state = new Map(); for (const g of map.groups) state.set(g.account, (rd(dir, 'ctrader/' + g.file, {}).state) || {});
  const acct = (g) => (accounts.accounts || []).find((a) => (a.books || []).some((b) => g.books.includes(b))) || { open: [], orders: [] };
  const rows = [], usedPos = new Set(), usedOrd = new Set();
  // where a trade was copied: any account may hold it (a copy made before the books were split stays where it is)
  const held = (id) => { for (const g of map.groups) { const st = state.get(g.account), m = (st.map || {})[id], o = (st.orders || {})[id]; if (m || o) return { g, m, o, st }; } return null; };
  for (const t of trades) {
    const open = t.status === 'open', pending = t.status === 'pending' && !String(t.id).startsWith('ict:'); if (!open && !pending) continue;
    const book = bookOf(t), g = byBook[book], row = { id: t.id, book, market: t.market, side: t.side, status: t.status, shadow: !!t.shadow, entry: t.entry, stop: t.stop, t1: t.t1 ?? null, issues: [] };
    rows.push(row);
    if (t.stop == null) { row.issues.push('the council trade has no stop'); }
    if (!SYMBOLS[t.market]) { row.state = 'not mirrored'; row.why = 'no broker symbol for this market'; continue; }
    if (t.shadow && !shadows) { row.state = 'not mirrored'; row.why = 'shadows are switched off (config.json mirrorShadow)'; continue; }
    const h = held(t.id), stHome = g ? state.get(g.account) : {};
    if (!h) {
      const sk = (stHome.skipped || {})[t.id], w = (stHome.wait || {})[t.id];
      row.state = 'not copied'; row.why = sk ? `skipped: ${typeof sk === 'string' ? sk : sk.why || JSON.stringify(sk)}` : w ? `waiting: ${w.why || JSON.stringify(w)}` : null;
      // the owner rule replica-mirror-gold-only (11 Nov 2026, config.mirrorReplica): the mirror opens nothing new for a replica
      // research trade outside its market list (replicaCandidates marks it noCopy); that is the mirror's reason, not a gap
      if (!row.why && t.noCopy) row.why = replicaRuleWhy(cfg);
      if (!row.why) row.issues.push('open at the council, no copy and no recorded reason'); continue;
    }
    row.account = h.g.books.join('+'); const A = acct(h.g);
    if (h.o && !h.m) {   // a resting limit
      const bo = (A.orders || []).find((x) => String(x.id) === String(h.o.orderId)); row.state = 'resting order';
      if (!bo) { row.issues.push(`the mirror records order ${h.o.orderId} but the account shows no such order`); continue; }
      usedOrd.add(String(bo.id)); const tol = Math.pow(10, -(h.o.digits ?? 2)) * 2;
      if (bo.side !== t.side) row.issues.push(`side ${bo.side} at the broker`);
      if (!near(bo.price, t.entry, tol)) row.issues.push(`limit ${bo.price} against the council entry ${t.entry}`);
      if (bo.sl == null) row.issues.push('the resting order has NO stop'); else if (!near(bo.sl, t.stop, tol)) row.issues.push(`stop ${bo.sl} against ${t.stop}`);
      if (t.t1 != null && !near(bo.tp, t.t1, tol)) row.issues.push(`target ${bo.tp} against ${t.t1}`);
      if (!pending) row.issues.push('the council trade is open but the copy is still a resting order');
      continue;
    }
    const m = h.m; row.copy = m.status;
    if (m.status !== 'open' && m.status !== 'sent') {
      row.state = `copy ${m.status}`;
      if (open && m.status === 'closed at broker') {   // the broker's own stop or target was reached first (bid / ask and its own feed), or it was closed by hand
        const d = (A.history || []).find((x) => String(x.positionId) === String(m.positionId)), tol = Math.max(Math.abs(t.entry - t.stop) * 0.08, Math.pow(10, -(m.digits ?? 2)) * 5);
        const wantSL = m.brokerStop ?? (m.fillPrice != null && m.mark != null ? m.fillPrice + (m.stop - m.mark) : m.stop), wantTP = m.t1 == null ? null : m.fillPrice != null && m.mark != null ? m.fillPrice + (m.t1 - m.mark) : m.t1;
        row.brokerClose = d ? { exit: d.exit, at: d.closedAt, net: d.net, how: near(d.exit, wantSL, tol) ? 'at its stop' : wantTP != null && near(d.exit, wantTP, tol) ? 'at its target' : 'away from its stop and target (closed by hand, or a level moved since)' } : { how: 'no deal found in the account history' };
        row.note = `the broker closed the copy ${row.brokerClose.how}${d ? ` (${d.exit}, ${d.closedAt.slice(0, 16)}Z, ${d.net >= 0 ? '+' : ''}${d.net})` : ''}; the council's paper trade is still open`;
      } else if (open) row.issues.push(`the council trade is still open but its copy is "${m.status}"`);
      continue;
    }
    const bp = (A.open || []).find((x) => String(x.id) === String(m.positionId)); row.state = 'position';
    if (!bp) { row.issues.push(`the mirror records position ${m.positionId} but the account shows none`); continue; }
    usedPos.add(String(bp.id)); const tol = Math.pow(10, -(m.digits ?? 2)) * 2;
    if (bp.side !== t.side) row.issues.push(`side ${bp.side} at the broker`);
    if (bp.sl == null) row.issues.push('the demo position has NO stop');
    else if (String(t.id).startsWith('ict:')) {   // futures levels at the desk, a cash CFD at the broker: the stop DISTANCE is what is copied
      const want = Math.abs(t.entry - t.stop), got = Math.abs((m.fillPrice ?? bp.entry) - bp.sl), moved = t.stop !== (t.stop0 ?? t.stop);
      if (!moved && Math.abs(want - got) > Math.max(tol, want * 0.02)) row.issues.push(`stop distance ${got.toFixed(2)} against the desk's ${want.toFixed(2)}`);
      if ((t.side === 'buy') !== (bp.sl < bp.entry) && !moved) row.issues.push('the stop is on the wrong side of the entry');
    } else {
      // distances from the fill until the council moves a level (or for a limit copy: absolute levels from the start)
      const rel = m.levelsFrom === 'mark' && m.mark != null && m.fillPrice != null && !m.amended && !m.viaLimit && !m.stopSetBy, moved = Math.abs((+t.stop) - (+m.stop)) > tol;
      const wantSL = rel ? m.fillPrice + (m.stop - m.mark) : moved ? null : +t.stop, wantTP = t.t1 == null || t.rr >= 50 ? null : rel ? m.fillPrice + (m.t1 - m.mark) : +t.t1, tolR = Math.max(tol * 3, Math.abs(t.entry - t.stop) * 0.03);
      row.basis = rel ? +(m.fillPrice - m.mark).toFixed(m.digits ?? 2) : null;
      if (moved) row.note = `the council moved its stop ${m.stop} -> ${t.stop}; the mirror follows on its next round`;
      else if (!near(bp.sl, wantSL, tolR)) row.issues.push(`stop ${bp.sl}, expected ${(+wantSL).toFixed(m.digits ?? 2)} (${rel ? 'the council\'s distance from the fill' : 'the council\'s level'})`);
      if ((t.side === 'buy') !== (bp.sl < bp.entry) && Math.abs(bp.sl - bp.entry) > tol && !m.amended) row.issues.push('the stop is on the wrong side of the entry');
      if (!moved && wantTP != null && !near(bp.tp, wantTP, tolR)) row.issues.push(`target ${bp.tp}, expected ${(+wantTP).toFixed(m.digits ?? 2)}`);
    }
    row.broker = { symbol: bp.symbol, lots: bp.lots, entry: bp.entry, sl: bp.sl, tp: bp.tp, pnl: bp.pnl };
  }
  // the other direction: what the accounts hold that no open council trade stands behind
  const orphans = [], noStop = [];
  for (const g of map.groups) {
    const A = acct(g), st = state.get(g.account);
    for (const p of A.open || []) {
      if (p.sl == null) noStop.push({ account: g.books.join('+'), id: p.id, symbol: p.symbol });
      if (usedPos.has(String(p.id))) continue;
      const e = Object.entries(st.map || {}).find(([, m]) => String(m.positionId) === String(p.id)), t = e ? trades.find((x) => x.id === e[0]) : null;
      orphans.push({ account: g.books.join('+'), kind: 'position', id: p.id, symbol: p.symbol, side: p.side, sl: p.sl, trade: e ? e[0] : null, why: !e ? 'the mirror has no record of it' : !t ? 'its council trade is gone from the list' : `its council trade is ${t.status}` });
    }
    for (const o of A.orders || []) if (!usedOrd.has(String(o.id))) { const e = Object.entries(st.orders || {}).find(([, m]) => String(m.orderId) === String(o.id)), t = e ? trades.find((x) => x.id === e[0]) : null;
      orphans.push({ account: g.books.join('+'), kind: 'order', id: o.id, symbol: o.symbol, side: o.side, sl: o.sl, trade: e ? e[0] : null, why: !e ? 'the mirror has no record of it' : !t ? 'its council trade is gone from the list' : `its council trade is ${t.status}` }); }
  }
  return { at: new Date().toISOString(), accountsAt: accounts.at || null, rows, orphans, noStop };
}

if (process.argv[1] && process.argv[1].endsWith('ctrader-reconcile.mjs')) {
  const r = reconcile(process.argv[2] || 'data');
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
  const by = {}; for (const x of r.rows) { const k = `${x.book} · ${x.state}`; by[k] = (by[k] || 0) + 1; }
  console.log(`Accounts read at ${r.accountsAt}. Open or pending at the edges: ${r.rows.length}`);
  for (const [k, n] of Object.entries(by).sort()) console.log(`  ${k}: ${n}`);
  const bad = r.rows.filter((x) => x.issues.length);
  console.log(`\nMismatches: ${bad.length}`); for (const x of bad) console.log(`  ${x.book} ${x.id} (${x.side} ${x.market}, ${x.status}): ${x.issues.join('; ')}`);
  const notes = r.rows.filter((x) => x.note && !x.issues.length); console.log(`\nExplained differences: ${notes.length}`); for (const x of notes) console.log(`  ${x.book} ${x.id}: ${x.note}`);
  const basis = r.rows.filter((x) => x.basis != null && x.basis !== 0).length; console.log(`\nMarket copies whose levels sit a small basis away from the council's (same distances, by design): ${basis}`);
  const nc = r.rows.filter((x) => x.state === 'not copied' && x.why); console.log(`\nNot copied, with the mirror's reason: ${nc.length}`); for (const x of nc) console.log(`  ${x.book} ${x.id}: ${x.why}`);
  console.log(`\nDemo positions or orders with no open council trade behind them: ${r.orphans.length}`); for (const o of r.orphans) console.log(`  ${o.account} ${o.kind} ${o.id} ${o.symbol} ${o.side}${o.trade ? ' (' + o.trade + ')' : ''}: ${o.why}${o.sl == null ? ' · NO STOP' : ''}`);
  console.log(`\nDemo positions without a stop: ${r.noStop.length}`); for (const p of r.noStop) console.log(`  ${p.account} ${p.id} ${p.symbol}`);
  process.exit(bad.length || r.noStop.length ? 1 : 0);
}
