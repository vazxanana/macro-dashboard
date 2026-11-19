# The US 10-year regime table and gold (pre-registration, 19 Nov 2026)

Written and committed before any result is computed. Owner (19 Nov 2026): "use the other documents too, keep going". The owner's
macro rule book opens with a regime table read off the US 10-year yield's speed and direction ("primary gauge"): rising fast =
gold **bearish**, falling slow = gold **bullish**, and, before using the table, "why is the 10Y moving": a rise led by the 2-year
(growth / hawkish Fed) is gold-bearish, a rise in the 10-year while the 2-year lags (fiscal / term-premium stress) is
**bullish** gold. Nothing in the repository has tested the table. Its thresholds are the rule book's own.

## Data (fixed)
- Yields: council-data `macro/cache.json` `score.fred` (weekly Friday values of DGS10, DGS2, 2006 on).
- Gold: council-data `research/daily/xau.json` (OANDA daily closes). Reported, not tested: NAS100 (`research/daily/nas100.json`).
- A Friday's yields are treated as known only at the NEXT weekday's close (publication lag): the outcome runs from that close to
  the close 20 sessions later (log return).

## Classes (each Friday; d2w, d4w, d6w = the 10-year change over 2, 4, 6 weeks, in percentage points)
- **Rising fast**: d2w >= +0.25 or d4w >= +0.50. **Falling fast**: d2w <= -0.25 or d4w <= -0.50.
- **Rising slow**: not fast and d6w >= +0.25. **Falling slow**: not fast and d6w <= -0.25. Else **flat**.
- Among weeks with the 10-year up at least 0.25 over 4 weeks: **2Y-led** when the 2-year rose at least as much as the 10-year,
  **term premium** when the 2-year rose at least 0.15 less.

## Tests (window 2007 to the last full outcome; Holm over three)
- **T1**: rising-fast weeks have a lower gold outcome than all other weeks: slope of the outcome on the class dummy, Newey-West t
  with 4 lags, t <= -2.
- **T2**: falling-slow weeks have a higher gold outcome than all other weeks: t >= +2.
- **T3**: among rising weeks, term-premium weeks have a higher gold outcome than 2Y-led weeks: t >= +2 (dummy = term premium).
- A test **passes** only with its t after Holm (p from the normal) AND the same sign in both halves (2007-2016, 2017 on).
- Reported, not tested: every class's mean and n; falling fast; NAS100 for the same classes.

## Limits said in advance
- Overlapping 20-session outcomes on weekly readings (handled by Newey-West, not removed); few fast weeks in quiet years.
- An earlier study (`research/edge/macro-gold`) found that real yields known with a lag do not time gold; this asks the rule
  book's own, coarser question. Nothing live changes whatever the result (absolute rule 3).
