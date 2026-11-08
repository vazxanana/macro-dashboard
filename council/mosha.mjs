// Mosha BO chain state (8 Nov, gold-fidelity drift item: "no moshaBo snapshot block"). The Trader records a Mosha BO trade only at
// the moment the M15 BO completes an H4 -> H1 -> M15 chain, so between trades the site could not say where the chain stood.
// This is the same walk the Trader makes (council/trader.mjs, config.moshaBo), as a pure function of the BO event lists it
// already builds (each event: { t, dir, level }), published as snapshot.moshaBo.state. Status only: nothing here trades.
// E1 = H4 BO events, E2 = H1, E3 = M15, each oldest first and already filtered to closed candles.
const last = (E, f) => { for (let i = E.length - 1; i >= 0; i--) if (f(E[i])) return E[i]; return null; };
const pick = (e) => e ? { t: e.t, dir: e.dir, level: e.level != null ? +(+e.level).toFixed(2) : null } : null;
export function moshaChain(E1 = [], E2 = [], E3 = []) {
  const e1 = E1.length ? E1[E1.length - 1] : null;
  if (!e1) return { stage: 'h4', dir: 0, h4: null, h1: null, m15: null };
  const d = e1.dir;
  const e2 = last(E2, (e) => e.t > e1.t && e.dir === -d);
  if (!e2) return { stage: 'h1', dir: d, h4: pick(e1), h1: null, m15: null };
  const e3 = last(E3, (e) => e.t > e2.t && e.dir === d);
  if (!e3) return { stage: 'm15', dir: d, h4: pick(e1), h1: pick(e2), m15: null };
  return { stage: 'done', dir: d, h4: pick(e1), h1: pick(e2), m15: pick(e3) };
}
// the one-line reading the site shows (also used by the test); w1 is the weekly direction (+1 / -1 / null)
export function moshaChainText(c, w1) {
  const side = (d) => (d < 0 ? 'sell' : 'buy'), when = (t) => new Date(t * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' UTC';
  if (!c || c.stage === 'h4') return 'Mosha BO chain: waiting for an H4 BO.';
  const w = w1 == null ? '' : w1 === c.dir ? ' Weekly structure agrees.' : ` Weekly structure is against it: the trade would be recorded as a shadow.`;
  if (c.stage === 'h1') return `Mosha BO chain: H4 BO ${side(c.dir)} at ${c.h4.level} (${when(c.h4.t)}); waiting for the H1 BO the other way (the retracement).${w}`;
  if (c.stage === 'm15') return `Mosha BO chain: H4 BO ${side(c.dir)} (${when(c.h4.t)}), H1 retracement BO (${when(c.h1.t)}); waiting for the M15 BO back ${side(c.dir)}.${w}`;
  return `Mosha BO chain complete: M15 BO ${side(c.dir)} at ${c.m15.level} (${when(c.m15.t)}) after the H4 BO (${when(c.h4.t)}) and H1 retracement (${when(c.h1.t)}); the trade is in the record below, or blocked (weekly, cap, price or momentum) as a shadow.${w}`;
}
