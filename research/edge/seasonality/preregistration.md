# Structural seasonality on NQ, ES and gold: pre-registration

Written and committed **before** any return for any hypothesis below was computed. The 5-minute candles were downloaded first (`fetch.mjs`); no return, mean or t was looked at. Nothing below changes after the results are seen. Anything added later is labelled post-hoc in `RESULT.md`.

## Why this study

Every live edge found so far is regime-bound: it works from 2018 or 2023 and fails on the long untouched history (#511 NQ open run, #512 gold replica, #526 ICT A-setups 2008–17, #508 crypto trend, #530 gold daily systems). This study looks for the opposite kind of edge: a **simple calendar or clock rule with a published economic reason and decades of evidence in the literature**. Nothing is discovered here. The hypotheses come from the papers, the first half of the data (2006–15) tests them, and the second half (2016–26) confirms or rejects them.

Known risk, stated up front: published anomalies often shrink after publication (McLean & Pontiff 2016, *J. Finance*, "Does academic research destroy stock return predictability?"). Most of the papers below appeared before or during the first half. A failure in 2016–26 is a real, expected outcome.

## The family: 6 hypotheses, 10 tests

Direction, entry, exit and market are fixed here. Each (hypothesis, market) pair is one test. NQ = OANDA `nas100`, ES = OANDA `spx500`, gold = OANDA `xau`.

| # | Hypothesis | Rule (entry → exit, all at a fixed clock price) | Side | Markets | Source and economic reason |
|---|---|---|---|---|---|
| H1 | **Overnight drift** | 16:00 ET on a US trading day → 09:30 ET on the next US trading day (weekends and holidays included in the hold) | long | NQ, ES | Cliff, Cooper & Gulen (2008, SSRN, "Return differences between trading and non-trading hours: like night and day"); Lou, Polk & Skouras (2019, *JFE*, "A tug of war: overnight versus intraday expected returns"). US equity index returns accrue mostly while the cash market is shut: a premium for carrying unhedgeable overnight risk, and intraday selling by institutions that rebalance during the session. |
| H2 | **Pre-FOMC drift** | 15 minutes before the scheduled FOMC statement time, on the previous US trading day → 15 minutes before the statement | long | NQ, ES | Lucca & Moench (2015, *J. Finance*, "The pre-FOMC announcement drift"): the S&P 500 rose about 0.5% in the 24 h before scheduled announcements, 1994–2011. Reason: a premium for holding through the resolution of monetary-policy uncertainty. Later work reports it faded after 2015 (Kurov, Wolfe & Gilbert 2021, *Finance Research Letters*), which the second half tests directly. |
| H3 | **Turn of the month** | 16:00 ET on the second-to-last US trading day of month m → 16:00 ET on the 3rd US trading day of month m+1 (trading days −1 to +3) | long | NQ, ES | Ariel (1987, *JFE*, "A monthly effect in stock returns"); Lakonishok & Smidt (1988, *RFS*, "Are seasonal anomalies real? A ninety-year perspective"); McConnell & Xu (2008, *FAJ*, "Equity returns at the turn of the month"). Reason: month-end pay and pension/401(k) contributions flowing into equities, and month-end portfolio rebalancing and window dressing. |
| H4 | **Gold PM fix** | 15:00 London → 15:30 London, every London business day | **short** | gold | Abrantes-Metz & Metz (2014, working paper, "Is the London gold fixing being manipulated?") and Caminschi & Heaney (2014, *J. Futures Markets*, "Fixing a leaky fixing: short-term market reactions to the London PM gold price fixing"): gold moved abnormally, and more often down, around the 15:00 London PM fix. Reason: benchmark-setting dealers with information on net client orders, and hedging of fix-linked flows. The fix became an ICE-run auction in March 2015, which may have removed it. |
| H5 | **Gold Asia-session drift** | 18:00 ET (OANDA reopen after the daily break) → 08:00 London (London open), entries Sunday to Thursday evening | long | gold | Practitioner observation, widely reported in the financial press around 2013–15, that gold rises in Asian hours and falls in London and New York hours. **No peer-reviewed source is claimed.** Reason: physical buying from China and India priced in Asian hours, Western paper selling in London and New York. It is in the family because the request named it; it carries the same Bonferroni weight as the others. |
| H6 | **Weekend (Monday) effect** | 16:00 ET Friday → 16:00 ET Monday (both must be US trading days; weeks where either is a holiday are skipped) | **short** | NQ, ES | French (1980, *JFE*, "Stock returns and the weekend effect"): negative returns from Friday close to Monday close. Reason offered in the literature: bad news held back for the weekend, and short-seller and retail selling patterns on Mondays. Also documented as fading after the 1980s, so this is a test of a known-weak anomaly. |

10 tests: H1, H2, H3 and H6 on NQ and ES (8), H4 and H5 on gold (2). No other hypothesis, window, market or side is part of the verdict.

## Data

- **OANDA 5-minute mid candles** through the site's free proxy `https://meridianx.dev/md/bars?sym=<nas100|spx500|xau>&tf=5m` (no monthly cost), fetched by `fetch.mjs`, from 2006-01-01 to 2026-11-06. Gold reuses the gold-systems-oos (#530) cache, which starts 2006-03-20.
- **Price at a clock time T** = the open of the 5-minute candle that starts at T. If there is none, the close of the last candle before T, if that candle started within 30 minutes of T. Otherwise the trade is skipped (counted and reported as missing). Clock times are converted with `America/New_York` and `Europe/London`, so daylight saving is handled.
- **US trading days**: weekdays that are not NYSE holidays. Holidays are computed: New Year's Day, MLK Day (from 1998), Presidents' Day, Good Friday, Memorial Day, Juneteenth (from 2022), Independence Day, Labor Day, Thanksgiving, Christmas, with the NYSE weekend rules (Saturday → Friday before, except New Year's Day; Sunday → Monday). Plus the special closures: 2007-01-02 (Ford), 2012-10-29 and 2012-10-30 (Sandy), 2018-12-05 (Bush), 2025-01-09 (Carter). Half days (13:00 close) are kept and still use 16:00 ET on the CFD, which keeps trading.
- **London business days** (H4): weekdays except 1 January (or the substitute Monday), Good Friday, Easter Monday, the early-May, spring and summer bank holidays, 25 and 26 December (with substitutes), and the special UK holidays 2011-04-29, 2012-06-04, 2012-06-05, 2020-05-08 (VE Day replaced the early-May Monday), 2022-06-02, 2022-06-03, 2022-09-19, 2023-05-08.
- **FOMC dates (H2).** The Fed's calendar page (federalreserve.gov) does not resolve from this sandbox. So:
  - 2022 to Oct 2026: `council/events.mjs` (HISTORY and EVENTS), statement 14:00 ET.
  - 2006–2021: the scheduled meetings are hard-coded in `run.mjs` from the public Fed calendar (second day of each scheduled meeting). Unscheduled moves and calls (e.g. 2008-01-22, 2008-10-08, 2020-03-03, 2020-03-15) are excluded, and the scheduled March 2020 meeting, which was cancelled, has no entry. Statement times: 14:15 ET through 2012, except the press-conference days of 2011–12 at 12:30 ET (2011-04-27, 2011-06-22, 2011-11-02, 2012-01-25, 2012-04-25, 2012-06-20, 2012-09-13, 2012-12-12); 14:00 ET from 2013.
  - **Every hard-coded date and time is verified on the candles before any H2 return is computed**, the same way `council/events.mjs` checked its HISTORY: the high−low range of the 5-minute candle that starts at the statement minute must be at least 2× the median range of that same candle on the weekdays within ±25 days, on gold **or** on ES. A date that fails is dropped and listed. If more than 10% of the 2006–21 dates fail, H2 is run only on the events.mjs dates (2022–26), reported as untestable on the 2006–15 half, and fails.

## Costs (per trade, round trip, in price units)

The same per-trade costs as the earlier long-history tests:
- **NQ, ES: 0.0002 × price + 0.25** (spread plus one tick of slippage, as in ict-universe and #526).
- **Gold: $0.30** (as in #530).

The trade's net return = (exit − entry) × side ÷ entry − cost ÷ entry. **×1** is the primary cost, **×2** is reported and is part of the bar. Gross is reported.

Financing is not charged in the verdict (micro futures carry no explicit financing; a CFD holder pays it). As a pre-declared diagnostic, each test reports the nights held per trade and the **break-even financing rate**: the annual rate that would bring the 2016–26 net return per trade to zero.

## Unit, statistics

- One trade per event; the return is in percent of the entry price. Trades are dated by entry.
- For each test and each half: n, missing, mean gross / net ×1 / net ×2 (% a trade), sd, t = mean ÷ (sd ÷ √n), one-sided p from Student's t (H0: mean ≤ 0), win rate, total and annualised net return, and a per-year table.
- **Halves:**
  - **A (test): entries 2006-01-01 to 2015-12-31.**
  - **B (confirm): entries 2016-01-01 to 2026-11-06.**

## Pass bar (all must hold; one verdict per test)

1. **Half A:** net ×1 mean > 0 **and** one-sided p < 0.05 / 10 = **0.005** (Bonferroni over the 10 tests).
2. **Half B (only for tests that pass 1):** net ×1 mean > 0 **and** one-sided p < 0.05 / m, where m is the number of tests that passed step 1.
3. **Net ×2 mean > 0 in both halves.**

Verdict labels:
- **PASS**: all three hold. It is described as a candidate **paper shadow stream** only. No live rule changes; the owner decides.
- **CONSISTENT, NOT SIGNIFICANT**: net ×1 mean > 0 in both halves, but step 1 or 2 fails. Not a candidate.
- **FAIL**: net ×1 mean ≤ 0 in either half.

### Pre-declared diagnostics (not part of the verdict)

- **Drift control (long hypotheses H1, H2, H3, H5).** For each, the same-length hold at the comparable non-event times in the same half: H1 against the intraday session (09:30 → 16:00 ET, same days); H2 against all other trading-day-to-next-trading-day holds at the same clock time; H3 against all other non-overlapping holds of 5 US trading days (close to close) that do not overlap a turn-of-month window; H5 against gold from 08:00 London to 17:00 ET (the London and New York session) on the same days. Reported as the difference in mean gross % and a Welch t. A PASS whose control difference is not positive in both halves is labelled "mostly market drift".
- Break-even financing rate (above), and the per-year table.
- The NQ and ES series move together; their tests are not independent, which makes Bonferroni conservative. That is accepted.

## What it feeds

At most a written proposal for a **paper shadow stream**, following the existing shadow pattern. No live rule, config or tracker is changed by this study.
