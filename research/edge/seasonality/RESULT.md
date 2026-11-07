# Structural seasonality on NQ, ES and gold: result

Paper research only. No live rule, config or tracker was changed.

**Question.** Every edge the council has found so far is regime-bound: it works from 2018 or 2023 and fails on older data (#511, #512, #526, #508, #530). Is there a simple calendar or clock edge, with a published economic reason, that holds across both 2006–15 and 2016–26 on NQ, ES or gold after costs?

The family, the rules, the costs and the pass bar were pre-registered and pushed before any return was computed (`preregistration.md`, commit 13ac532a). There are 6 hypotheses taken from the literature and 10 tests (hypothesis × market). The bar:
- **Half A, 2006–15:** net mean > 0 and one-sided p < 0.005 (Bonferroni over 10 tests).
- **Half B, 2016–26:** net mean > 0 and p < 0.05 / (number of tests that passed half A).
- **Double costs:** net mean > 0 in both halves.

## Verdict: nothing passes. No candidate shadow stream.

**No test cleared the half-A Bonferroni bar, so none reached confirmation.** Six tests are positive after costs in both halves but not significant. Four fail outright.

| # | Test | Side | A: n | A: net ×1 % a trade (t, p) | B: n | B: net ×1 % a trade (t, p) | Net ×2, A / B | Verdict |
|---|---|---|---|---|---|---|---|---|
| H1 | Overnight 16:00→09:30 ET, NQ | long | 2,488 | +0.006 (0.42, 0.34) | 2,704 | +0.023 (1.41, 0.079) | −0.025 / −0.000 | consistent, not significant |
| H1 | Overnight, ES | long | 2,488 | −0.024 (−1.66) | 2,704 | +0.006 (0.47, 0.32) | −0.062 / −0.021 | **fail** |
| H2 | **Pre-FOMC drift**, NQ | long | 78 | **+0.358** (2.09, **0.020**) | 86 | **+0.280** (2.78, **0.003**) | +0.326 / +0.257 | consistent, not significant (**nearest miss**) |
| H2 | Pre-FOMC drift, ES | long | 78 | +0.345 (2.06, 0.021) | 86 | +0.158 (2.35, 0.011) | +0.307 / +0.131 | consistent, not significant |
| H3 | Turn of month (days −1..+3), NQ | long | 115 | +0.116 (0.50, 0.31) | 126 | +0.279 (1.24, 0.11) | +0.085 / +0.256 | consistent, not significant |
| H3 | Turn of month, ES | long | 115 | +0.030 (0.15, 0.44) | 126 | +0.179 (1.04, 0.15) | −0.009 / +0.152 | consistent, not significant |
| H4 | Gold PM fix 15:00→15:30 London | short | 2,471 | −0.036 (−5.73) | 2,741 | −0.017 (−3.48) | −0.065 / −0.035 | **fail** |
| H5 | Gold Asia 18:00 ET→08:00 London | long | 2,416 | +0.004 (0.40, 0.34) | 2,784 | +0.009 (0.91, 0.18) | −0.024 / −0.008 | consistent, not significant |
| H6 | Weekend, Fri→Mon 16:00 ET, NQ | short | 442 | −0.025 (−0.36) | 477 | −0.183 (−2.75) | −0.056 / −0.206 | **fail** |
| H6 | Weekend, ES | short | 442 | −0.023 (−0.35) | 477 | −0.139 (−2.57) | −0.062 / −0.166 | **fail** |

Returns are in % of the entry price per trade. The bar was p < 0.005 in half A; the best half-A p was 0.020.

### What each hypothesis says

**H2, the pre-FOMC drift, is the only real-looking effect, and its long history is a crisis artefact.**
- Long 24 hours into a scheduled FOMC statement, exit 15 minutes before it.
  - NQ: **+0.36% an event in 2006–15 and +0.28% in 2016–26**.
  - ES: +0.35% and +0.16%.
  - Positive in both halves on both markets, after double costs.
- Pooled over 2006–26 it is clearly significant: NQ t 3.28 (p 0.0006, n 164) and ES t 2.84.
  - That is a post-hoc view. The pre-registered design gave half A its own test, and half A missed (p 0.020 against 0.005).
- **Post-hoc:** half A's result comes entirely from 2008–09.
  - Those two years made +27.6% on NQ, against +27.9% for all of 2006–15.
  - Without them the other 63 events average **+0.005% (t 0.05)** on NQ and +0.04% (t 0.41) on ES.
- **Half B is broader and survives losing its best events.**
  - 8 of its 11 years are positive on NQ.
  - Without its three best events, NQ half B is still +0.19% (t 2.14). ES is +0.10% (t 1.64).
  - The literature says the drift faded after 2015 (Kurov, Wolfe & Gilbert 2021). On NQ in 2016–26 we do not see that fade.
- **Against the drift control** (every other 24-hour hold at the same clock time):
  - It beats ordinary days in both halves: NQ +0.35 / +0.24 points (t 2.03 / 2.30), ES +0.37 / +0.14 (t 2.17 / 1.94).
  - So it is not just being long equities.
- **Reading:** the drift paid in the 2008–09 crisis, did nothing in 2010–15, and has paid again since 2016, mostly on NQ.
  - That is the same pattern as every other edge in this repo: it pays in some regimes and not in others.
  - It is the best candidate for a *prospective* test, but by the pre-registered bar it is not an edge.
  - It is also small and rare: about 8 events a year, about +2.2% a year on NQ in half B.

**H1, overnight drift: too small for the cost.**
- On NQ the gross overnight return is +0.04% a night, and the round-trip cost is about 0.02–0.03%.
  - What is left is +0.006% (A) and +0.023% (B), not significant.
  - At double costs it is negative in both halves.
- On ES half A is negative after costs.
- The literature's "like night and day" split does not appear on these CFDs.
  - In 2016–26 NQ's intraday session (09:30→16:00) made +0.038% a day gross, about the same as overnight (+0.045%).
  - Overnight minus intraday is +0.007 points (t 0.27).
- Holding overnight also costs financing on a CFD. The break-even financing rate in half B is 5.7% a year on NQ and 1.6% on ES, which is below OANDA's typical index financing charge.

**H3, turn of the month: positive, no better than any other week.**
- NQ makes +0.12% / +0.28% per turn-of-month window after costs. ES makes +0.03% / +0.18%.
- Neither is significant: t 0.15–1.24.
- **Same-length control (post-hoc correction).** The rule holds 4 trading days (day −2 close to day +3 close). The pre-registration's control text said "5 trading days", which was a slip. The 4-day control is the like-for-like one. Both are reported:
  - Turn-of-month windows beat ordinary 4-day holds by only +0.02 points on NQ (t 0.08 and 0.07) and −0.01 to +0.02 on ES.
  - Against the 5-day control the difference is −0.02 / −0.03 on NQ.
- So the turn-of-month effect in these 20 years is just the index's ordinary drift.

**H4, the gold PM fix: wrong way round and eaten by costs.**
- Short gold from 15:00 to 15:30 London. Gross it is −0.007% (A) and −0.000% (B): gold did not fall around the fix in either era.
- The $0.30 spread makes it −0.036% and −0.017% a trade. It loses in 20 of 21 years.
- Whatever the 2004–13 fix studies found does not show up as a 30-minute drift on OANDA spot.

**H5, gold's Asian session: a story, not a drift.**
- Long gold from the 18:00 ET reopen to the London open. It makes +0.032% / +0.026% a night gross, and +0.004% / +0.009% after costs.
- Not significant, and negative at double costs.
- In 2006–15, Asia did beat London plus New York (+0.048 points, t 1.85). That gap shrank to +0.013 points (t 0.68) after 2016.
- The half-B median night after costs is negative (−0.006%).

**H6, the weekend effect, reversed after 2016.**
- Short from Friday close to Monday close (French 1980). Half A is flat gross (+0.007% NQ, +0.015% ES) and negative after costs.
- In 2016–26 the short **lost** −0.18% (NQ) and −0.14% (ES) a weekend. Long over the weekend paid instead.
- That reversal was not a pre-registered hypothesis. It is a post-hoc observation and is not tested here. It would need its own pre-registration and fresh data.

## Results in detail

### Data and checks

- **Candles.** OANDA 5-minute mid candles through the site's free `/md/bars` proxy (`fetch.mjs`).
  - NAS100: 1.42 M candles, 2006-01-02 to 2026-11-06.
  - SPX500: 1.41 M candles, same range.
  - XAU/USD: 1.47 M candles, from 2006-03-19. Gold reuses the #530 cache.
- **Missing trades.** A trade is skipped when a needed price is more than 30 minutes stale.
  - NQ/ES overnight: 29 (A) and 23 (B) of about 2,500 a half.
  - Turn of month: 5 / 4.
  - Weekend: 14 / 13.
  - Pre-FOMC: none.
  - Gold PM fix: 56 / 1. Most of the 56 fall before gold data starts in March 2006.
  - Gold Asia: 194 / 46. These include the 2006 pre-data weeks, and early years where the 18:00 ET reopen candle is late.
- **FOMC dates.**
  - federalreserve.gov does not resolve from this sandbox. So 2006–21 was hard-coded from the public Fed meeting calendar, and 2022–26 was taken from `council/events.mjs`.
  - Every date was checked on the candles. The statement-minute 5-minute range had to be ≥ 2× the median of that candle on the weekdays within ±25 days, on gold or ES.
  - **125 of 127 hard-coded dates passed.** Median ratio across all used dates: 8.6×; minimum 2.06×.
  - The two failures were dropped, as pre-registered: 2008-12-16 (14:15) and 2013-01-30 (14:00), both at about 0.9×. Their release minute was probably different from the one assumed.
  - The 12:30 press-conference days of 2011–12 all passed.
  - 164 events were used: 78 in half A, 86 in half B.
- **Costs per round trip.** NQ and ES: 0.0002 × price + 0.25 (as in #526). Gold: $0.30 (as in #530).
  - As a share of price this is 0.023–0.038% a trade on the indices and 0.017–0.029% on gold.
  - For the overnight, fix and Asia rules this is about as large as the gross effect. That is why they fail.

### Per-year net ×1 (sum of % over the year's trades)

| Year | H1 NQ | H1 ES | H2 NQ | H2 ES | H3 NQ | H3 ES | H4 XAU | H5 XAU | H6 NQ | H6 ES |
|---|---|---|---|---|---|---|---|---|---|---|
| 2006 | +3.0 | −1.3 | +1.4 | +1.5 | −4.8 | −1.6 | −2.0 | +2.0 | −3.5 | −3.7 |
| 2007 | +8.8 | +1.5 | +3.9 | +5.6 | −4.9 | −4.2 | −14.1 | +9.4 | +0.9 | −0.9 |
| 2008 | −24.8 | −36.8 | **+14.4** | **+13.3** | −6.2 | −4.4 | −3.3 | −3.9 | +14.2 | +3.7 |
| 2009 | +0.3 | −5.1 | **+13.2** | **+11.2** | +4.9 | −0.8 | −7.2 | +1.8 | −4.7 | −3.0 |
| 2010 | +6.5 | −3.6 | −4.6 | −4.4 | +13.4 | +13.5 | −11.8 | +9.6 | −13.9 | −12.8 |
| 2011 | −5.8 | −7.7 | +0.2 | −0.1 | +4.0 | −1.6 | −9.6 | +3.1 | +3.9 | +8.2 |
| 2012 | +4.0 | −4.3 | +2.7 | +1.0 | +9.1 | +8.4 | −15.0 | +0.6 | −4.3 | −2.5 |
| 2013 | +7.3 | +0.7 | −0.3 | −0.1 | +3.6 | −0.8 | −13.9 | −5.6 | −1.7 | +0.5 |
| 2014 | +9.4 | +1.8 | −2.1 | −1.6 | −4.6 | −4.8 | −5.1 | −6.9 | −1.1 | +0.1 |
| 2015 | +6.7 | −4.7 | −0.8 | +0.6 | −1.0 | −0.3 | −6.6 | +0.0 | −0.6 | +0.1 |
| 2016 | −4.3 | −7.9 | −1.5 | +0.3 | +0.1 | +1.7 | −3.6 | +11.6 | −6.9 | −4.5 |
| 2017 | +11.6 | +4.4 | +0.6 | +0.2 | +5.7 | +4.3 | −7.6 | −6.1 | −9.2 | −6.3 |
| 2018 | +2.7 | +1.1 | +3.4 | +2.0 | +1.8 | −2.5 | −8.3 | −7.9 | +2.2 | −0.1 |
| 2019 | +10.5 | +7.1 | +0.7 | −0.8 | +2.1 | −0.1 | −7.7 | −4.3 | −2.7 | −1.3 |
| 2020 | +35.1 | +24.7 | +5.1 | +3.4 | +18.4 | +13.4 | −4.4 | +2.4 | −15.8 | −6.0 |
| 2021 | +7.9 | +5.8 | −1.2 | −1.2 | −3.4 | −0.0 | −5.9 | +3.0 | −1.8 | −4.9 |
| 2022 | −25.8 | −20.0 | +11.0 | +6.9 | −7.1 | −5.4 | −4.7 | −6.8 | +8.6 | +6.1 |
| 2023 | −1.5 | −8.1 | +2.4 | +1.6 | +6.6 | +4.8 | −5.5 | +4.4 | −19.0 | −14.3 |
| 2024 | +17.4 | +10.3 | +3.4 | +2.4 | −0.4 | −3.0 | −0.2 | +8.3 | −9.5 | −8.0 |
| 2025 | +6.9 | −1.0 | +0.5 | +0.6 | +1.2 | −0.9 | −5.4 | +14.9 | −18.4 | −15.4 |
| 2026 (to 6 Nov) | +0.3 | +0.3 | −0.4 | −1.8 | +10.0 | +10.2 | +6.0 | +5.6 | −14.8 | −11.5 |

### Drift controls (gross, event minus control, points of % a trade; t in brackets)

| Test | Control | A | B |
|---|---|---|---|
| H1 NQ / ES | intraday 09:30→16:00, same days | +0.030 (1.09) / +0.006 (0.22) | +0.007 (0.27) / +0.006 (0.26) |
| H2 NQ / ES | all other 24 h holds at the same clock time | **+0.351 (2.03) / +0.368 (2.17)** | **+0.239 (2.30) / +0.136 (1.94)** |
| H3 NQ / ES | 4-trading-day holds outside turn-of-month windows (5-day as pre-registered) | +0.021 (0.08) / +0.022 (0.10) [−0.021 / +0.005] | +0.019 (0.07) / −0.008 (−0.04) [−0.034 / −0.015] |
| H5 gold | 08:00 London → 17:00 ET, same days | +0.048 (1.85) | +0.013 (0.68) |

### Break-even financing (half B; annual rate that would zero the net return)

| Test | Nights a trade | Break-even rate |
|---|---|---|
| H1 NQ | 1.44 | 5.7% |
| H1 ES | 1.44 | 1.6% |
| H2 NQ | 1 | 102% |
| H2 ES | 1 | 58% |
| H3 NQ | 6.1 | 16.7% |
| H3 ES | 6.1 | 10.7% |

H4 and H5 hold no 17:00 ET rollover. For the short H6, the net return is already negative.

## If the owner wants to follow the pre-FOMC drift

Nothing passed, so there is no candidate stream and nothing was built. If H2 is to be tracked at all, the honest form is a **prospective paper log**:
- **Rule:** long NQ 24 hours before each scheduled FOMC statement, out 15 minutes before it.
- **Data:** recorded on data that does not exist yet.
- **Review:** after about 24 events, roughly 3 years.

It would be a watch item, not an edge, and the owner decides.

## Files

- `preregistration.md`: the family, the rules and the bar, committed before any result.
- `fetch.mjs`: OANDA 5-minute candles through `/md/bars`. Keep the cache out of git.
- `run.mjs`: calendars, FOMC check, the 10 tests, statistics and verdicts.
  - Run it with `node run.mjs <candleDir>`. It takes about 9 seconds.
  - The post-hoc diagnostics are labelled in the code.
- `result.json`: every number above, plus the FOMC check table.
