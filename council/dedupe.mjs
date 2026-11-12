// One order, recorded once (12 Nov 2026, owner: "count duplicates once"). Pure, no imports.
//
// The council's setups are built from shared structure, so two setup keys can produce the SAME order in the same round: on
// council-data of 1-12 Nov the Intraday (H1 → M5) and the Scalp (M15 → M1) gave five orders that were identical in market,
// side, second, entry, stop and target, and every one of them was recorded twice (once per setup key) and counted twice.
//
// An EXACT DUPLICATE is a record that equals another in all six of:
//   market, side, `opened` (the same second: the same Trader round), entry, stop and target (`t1`),
// prices equal within `DUP_TOL` of the entry (float noise only; a tick apart is NOT a duplicate), and neither record a pyramid
// add (`addOf`). Every price the Trader manages a trade by is the same, so both records fill, stop and reach the target on the
// same candle and their R is the same by construction: one order. (The one way two such records could still part is a resting
// limit's life, `WAIT` by timeframe: a Scalp's order lapses after 3 h, an Intraday's after 12 h. Not seen in the data: every
// pending twin of 1-12 Nov filled within minutes. The kept record's own life applies.)
//
// NOT duplicates, on purpose (each is a different trade, and some are a rule question for the owner):
//   - the same entry, stop and second with ANOTHER target (Position vs Swing / Retrace, Intraday vs Retrace scalp): six such
//     pairs on 1-12 Nov, with different results (BTC 4 Nov: Position -1R, Retrace +0.43R): two exits, two records;
//   - the same market and side a few minutes apart (a setup re-firing, or another setup with other levels): distinct signals.
//
// A duplicate is never deleted: it is kept for the record with status 'duplicate' (no tally counts that status), `void`,
// `dupOf` naming the record it copies and `voidWhy`. Which record is kept: a live one over a shadow (a duplicate never hides
// a live trade), else the one recorded first.

export const DUP_TOL = 1e-9;
const num = (v) => v != null && v !== '' && Number.isFinite(+v);
const same = (a, b, ref) => (a == null && b == null) || (num(a) && num(b) && Math.abs(+a - +b) <= Math.abs(+ref || 1) * DUP_TOL);

export const isDup = (x) => !!x && (x.status === 'duplicate' || !!x.dupOf);

// a and b are one order (the definition above)
export function sameOrder(a, b) {
  return !!a && !!b && a !== b && !a.addOf && !b.addOf && a.market === b.market && a.side === b.side
    && num(a.opened) && +a.opened === +b.opened && num(a.entry) && same(a.entry, b.entry, a.entry)
    && num(a.stop) && same(a.stop, b.stop, a.entry) && same(a.t1, b.t1, a.entry);
}

// the record `x` duplicates in `list` (a record that is itself a duplicate or void never counts as the original)
export const twinOf = (x, list) => (list || []).find((y) => y !== x && !isDup(y) && !y.void && sameOrder(x, y)) || null;

// which of two twins is kept: the live one over a shadow, else `first`
export const keepOf = (first, second) => (first.shadow && !second.shadow ? [second, first] : [first, second]);

export function markDuplicate(dup, keep, why) {
  dup.status = 'duplicate'; dup.dupOf = keep.id; dup.void = true;
  dup.voidWhy = why || `the same order as ${keep.id} (same market, side, second, entry, stop and target), recorded under another setup`;
  return dup;
}

// The Trader's step for a NEW record `tr` of round `now` (called right before it is pushed): if an earlier record is the
// same order, one of the two becomes the duplicate. A new duplicate is never managed (status 'duplicate'), never alerted
// (shadow, blockedBy 'duplicate'), never copied (the mirror takes open / pending only) and closes at once with no R.
// Returns the duplicate record, or null.
export function recordOnce(trades, tr, now) {
  const tw = twinOf(tr, trades); if (!tw) return null;
  const [keep, dup] = keepOf(tw, tr);
  const was = dup.status;
  markDuplicate(dup, keep);
  if (was === 'pending' || was === 'open') { dup.R = null; dup.closed = now; }
  dup.shadow = true; dup.blockedBy = Array.from(new Set([...(Array.isArray(dup.blockedBy) ? dup.blockedBy : []), 'duplicate']));
  dup.note = `Duplicate of ${keep.id}: the same order (market, side, entry, stop and target, same second) from another setup, recorded once. ${dup.note || ''}`.trim();
  return dup;
}

// The cTrader mirror's guard: of the candidates `list`, drop a duplicate record, a candidate whose twin is already copied
// (`copied(id)` true for an id held on any demo account) and the second of two twins in the same round.
export function dropTwins(list, all, copied) {
  const kept = [], pool = all || list;
  for (const t of list || []) {
    if (isDup(t)) continue;
    if (pool.some((u) => u !== t && copied(u.id) && sameOrder(t, u))) continue;
    if (kept.some((u) => sameOrder(t, u))) continue;
    kept.push(t);
  }
  return kept;
}

// Past records (report, and the one-time repair in council/repairs.mjs): every exact duplicate in `trades` with the record it
// copies, keeping the live one over a shadow, else the first in the file. Records already 'duplicate' or void are left alone.
export function findDuplicates(trades) {
  const groups = new Map(), out = [];
  for (const x of trades || []) {
    if (!x || isDup(x) || x.void || x.addOf || !num(x.opened)) continue;
    const k = `${x.market}|${x.side}|${+x.opened}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(x);
  }
  for (const g of groups.values()) {
    const done = new Set();
    for (let i = 0; i < g.length; i++) {
      if (done.has(g[i])) continue;
      const set = [g[i]];
      for (let j = i + 1; j < g.length; j++) if (!done.has(g[j]) && sameOrder(g[i], g[j])) set.push(g[j]);
      if (set.length < 2) continue;
      set.forEach((x) => done.add(x));
      const keep = set.find((x) => !x.shadow) || set[0];
      for (const x of set) if (x !== keep) out.push({ dup: x, keep });
    }
  }
  return out;
}
