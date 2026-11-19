# Two gauges of the macro rule book and gold (pre-registration, 19 Nov 2026)

Written and committed before any result is computed. Owner (19 Nov 2026): "use the other documents too, keep going". Two more
directional claims of the owner's macro rule book that nothing in the repository has tested. A third ("real yields rising while
credit spreads widen = double tightening") is left out: FRED's high-yield spread history starts in 2023.

## Data (fixed)
- FRED (keyless `fredgraph.csv`): VIXCLS, DGS2, DFEDTARU (from 16 Dec 2008) and DFEDTAR (before it). Fetched into a folder
  outside git by `run.mjs fetch <dir>`; the run records each series' first and last date.
- Gold: council-data `research/daily/xau.json` (OANDA daily closes). Reported, not tested: NAS100.
- A FRED value dated D is treated as known only at the close of the next weekday; outcomes run from that close.
- Window: 2007 to the last full outcome; halves 2007-2016 and 2017 on.

## Test A: VIX panic ("VIX 40 or above = panic"; "gold often dips in the first dash for cash, then makes new highs")
- An **episode** starts on a day VIX closes at 40 or above after 20 sessions below it. Outcome: gold's return over the next 60
  sessions from the episode's known day, against gold's average 60-session return over all days of the window.
- **Pass A**: at least 6 episodes, the mean episode outcome above the all-days mean, and at least two thirds of episodes above it.
  (Too few episodes for a t; the bar is the count.) Reported: the 20-session outcome and the dip in between (lowest close).

## Test B: "2Y yield above the policy rate = hikes priced (USD up, gold down); below = cuts priced"
- Each Friday: gap = DGS2 minus the upper policy target. **Hikes priced** = gap > +0.25; **cuts priced** = gap < -0.25.
- Outcome: gold's next 20 sessions. **B1**: hikes-priced weeks lower than the rest (Newey-West t, 4 lags, t <= -2).
  **B2**: cuts-priced weeks higher than the rest (t >= +2). Holm over B1 and B2; each also needs the same sign in both halves.

## Limits said in advance
- Episodes of VIX 40 are few (about a handful since 2007); Test A can only say "consistent with the claim", never prove it.
- The policy gap moves slowly, so the weekly readings are heavily overlapping; Newey-West does not make them independent.
- Nothing live changes whatever the result (absolute rule 3).
