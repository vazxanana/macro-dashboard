# Stress and reaction rules of the macro rule book and gold (pre-registration, 19 Nov 2026)

Written and committed before any result is computed. Owner (19 Nov 2026): "keep going with the other documents". Five more
claims of the owner's macro rule book (gold overlay and event rules) that nothing in the repository has tested. Left out:
anything that needs central-bank buying, ETF flows, the Shanghai premium, options or headlines (no history on file).

## Data (fixed)
- FRED (keyless `fredgraph.csv`): DGS2, DFII10, VIXCLS, DTWEXBGS (broad dollar). Fetched into a folder outside git by
  `run.mjs fetch <dir>`; the run records each series' first and last date.
- Gold: council-data `research/daily/xau.json` (OANDA daily closes).
- A FRED value dated D is known only at the close of the next weekday; outcomes run from that close. The same-day gold move of
  C5 is the close of day D against the close before (both known by the next weekday's close).
- Outcome everywhere: gold's log return over the next 20 sessions. Window 2007 to the last full outcome; halves 2007-2016 and
  2017 on.

## Episode tests (few events: a count bar, no t)
An episode is the first qualifying day after 20 sessions without one. **Pass**: at least 6 episodes, the mean episode outcome
above gold's mean 20-session return over all days, and at least two thirds of episodes above that mean.
- **C1 "rescue setup"**: the 2-year yield falls more than 30 bp over 2 sessions.
- **C2 "stress exception"**: the 10-year real yield up 25 bp or more over 5 sessions while VIX closes above 30 and the broad
  dollar is lower than 5 sessions before.

## Weekly tests (Friday readings; Newey-West t on a dummy, 4 lags)
- **C3 "resilience signal"**: gold within 3 % of its highest close of the last 52 weeks AND the 10-year real yield up 15 bp or
  more over 4 weeks. Claim: bullish. Pass: t >= 2 against the other weeks.
- **C4 "deleveraging, hold the bias"**: gold down 3 % or more over the week while the 10-year real yield and the 2-year yield
  are both lower than a week before. Claim: the drop does not continue. Pass: t >= 2 against the other weeks.

## Daily test
- **C5 "reaction beats forecast"**: days the 2-year yield rose 15 bp or more. Claim: if gold closed up that day, the sell bias
  is cancelled. Pass: gold's next 20 sessions after an up-close day higher than after a down-close day, Welch t >= 2.

Holm over C3, C4, C5; each of them also needs the same sign in both halves.

## Limits said in advance
- C1 and C2 have a handful of episodes (2008, 2020, 2023, 2025 at most); they can only be "consistent with the claim".
- Weekly readings overlap (20-session outcomes, weekly steps); Newey-West does not make them independent.
- Nothing live changes whatever the result (absolute rule 3).
