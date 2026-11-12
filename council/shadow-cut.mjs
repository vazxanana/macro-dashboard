// Shadow cut (owner, 12 Nov 2026: "filter the best shadows", "yes apply the cut when it's done").
// The engine setups below run only as paper shadows (no market is in config.focus, the gold replica trades gold live).
// research/edge/shadow-best (pre-registered) tested every (setup, market) stream of them on 2020-26, net of costs:
// a stream stays recorded only when it passed that study's rule (config.shadowCut.keep); every other NEW shadow signal
// of these setups is not recorded. Trades already open or pending run to their own exits with their stops.
// Live trades are never dropped. Setups outside FAMILY (swing, position, rswing, m30m1, the systems) are untouched.
// Off-switch: a user rule setting c.shadowCut = null.
export const FAMILY = ['scalp', 'intraday', 'rscalp', 'rintra'];

export function dropShadow(cut, k, market, shadow) {
  if (!cut || !shadow) return false;
  if (!(cut.setups || FAMILY).includes(k)) return false;
  return !(cut.keep || []).some((s) => s.setup === k && s.market === market);
}
