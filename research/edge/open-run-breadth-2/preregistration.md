# Open run breadth 2 (cash opens of seven more index markets): pre-registration

Written and pushed before any candle of a new market was downloaded or any result computed. Paper research only: no live
rule, config or tracker changes, whatever the outcome.

## Question

`research/edge/open-run-breadth` (#543) ran the unchanged NQ New York open run on ES, YM and DAX: all three lost money in
2023-26 and the verdict was **NQ-ONLY**. FTSE had to be dropped because the site's OANDA proxy did not map UK100. The proxy's
symbol map now serves every OANDA index CFD (`api/_oanda.js`, CLAUDE.md "OANDA symbol map"). So: does the same rule, applied
at the **cash open** of seven further index markets, show anything that #543's three did not? Is NQ's 2023-26 run echoed at
any other cash open, or is it NQ alone?

## The rule (unchanged: #543 `lib.mjs` is imported, not copied)

`research/edge/open-run-breadth/lib.mjs` (`openSweep`, `midnightPrice`, `dayTrade`, `stats`, `corr`) is imported as is. No
threshold, exit or loop line is changed. For each market and each local weekday:

1. O = open of the session-open 1-minute candle (local minute `o`).
2. Scan the candles with local minute in (o, o + 90). Track the first cross below O (low < O) and above O (high > O) and the
   running extreme of each.
3. Signal on the first candle where, for a side whose first cross was at most 15 minutes (900 s) earlier and whose extreme is
   at least **0.08% of O** away from O, the candle closes back across O in the reclaim colour.
4. Trade **with** the run (the reclaim is faded): entry at that candle's close. Stop distance r0 = |entry − (extreme ∓ buffer)|,
   stop placed r0 on the other side of entry. Buffer = **0.011% of O** (the #543 primary).
5. Only if the local-midnight price lies ahead of the trade (above entry for a buy, below for a sell).
6. 10R cap; from +2R the stop trails 1R behind the best price.
7. Out at the open of the candle at local minute o + 90.
8. Trade loop exactly as #511/#543 (stop before target within a candle, a gap fills at the open, the first minute after entry
   is not checked).

**Midnight price.** The open of the 00:00 local candle; if missing, the close of the last candle before 00:00 local, however
far back; else the open of the first candle in 00:00-00:59 local. Same as #543. The CFDs of Tokyo, Hong Kong and Sydney quote
almost around the clock, so for them this is normally the actual 00:00 local open; for the European markets it is often the
prior evening's last quote (as it was for DAX in #543). Fixed now, not tuned.

## Markets and sessions (fixed now)

Midnight is 00:00 in the market's own time zone. Scan = o + 1 to o + 89 minutes; exit at o + 90.

| Market | OANDA instrument (proxy key) | Time zone | Open `o` | Scan | Exit |
|---|---|---|---|---|---|
| NQ (calibration reference, #511 cache) | NAS100_USD (`nas100`) | America/New_York | 09:30 | 09:31-10:59 | 11:00 |
| FTSE 100 | UK100_GBP (`uk100`) | Europe/London | 08:00 | 08:01-09:29 | 09:30 |
| Nikkei 225 | JP225_USD (`jp225`) | Asia/Tokyo | 09:00 | 09:01-10:29 | 10:30 |
| Hang Seng | HK33_HKD (`hk33`) | Asia/Hong_Kong | 09:30 | 09:31-10:59 | 11:00 |
| ASX 200 | AU200_AUD (`au200`) | Australia/Sydney | 10:00 | 10:01-11:29 | 11:30 |
| Euro Stoxx 50 | EU50_EUR (`eu50`) | Europe/Paris | 09:00 | 09:01-10:29 | 10:30 |
| CAC 40 | FR40_EUR (`fr40`) | Europe/Paris | 09:00 | 09:01-10:29 | 10:30 |
| Russell 2000 | US2000_USD (`us2000`) | America/New_York | 09:30 | 09:31-10:59 | 11:00 |

Seven new markets. The council-data daily index (`research/daily/_index.json`) lists all seven as served with daily history
from 2003-04; no 1-minute candle of any of them has been read before this file was pushed.

## Data

OANDA 1-minute mid candles through the site's keyless proxy (`https://meridianx.dev/md/bars?sym=&tf=1m&from=&to=`, free),
from the first available year to 6 Nov 2026, cached in the session scratchpad (not git). Per local weekday the fetch keeps
the candles from the open to o + 95 min, the last candle before local midnight and the first candle of 00:00-00:59 local
(#543 `fetch.mjs` logic, including its 5-minute lookback fill for the midnight price).

**Clean years** (same thresholds as #511/#543): open candle on ≥ 93% of weekdays, ≥ 93% of the 91 minutes o..o+90 present,
a midnight price on ≥ 90% of weekdays. Unclean years are dropped before results are looked at.

**5-minute fallback.** If a market-year fails the 1-minute coverage test but its 5-minute candles cover ≥ 93% of the scan
(≥ 18 of 19 five-minute candles o..o+90), that year is run on 5-minute candles with the same code (the reclaim is then a
5-minute close). Such years are reported in a separate, labelled table and **do not enter the primary bar**, unless a
market has fewer than 2 clean 1-minute years in the late window: then its bar is judged on the 5-minute series and the
RESULT says so in the verdict line. A market with no clean year in either series is reported as "no data".

## Windows

- **Early (untouched):** clean years from the first clean year (≥ 2004) to 2022.
- **Late:** clean years 2023 to 6 Nov 2026.
- Halves of the late window (by trade count) are reported.

## Costs (round trip, index points, constant across years)

Method of the repo's cost study (`research/edge/costs`): spread + 1 tick of slippage at entry and at exit, fees included
where they are not negligible. For the US market the cost study's own CME-micro figure is used. For the others there is no
micro contract, so, as #543 did for DAX, the primary cost is the OANDA CFD's published typical daytime spread plus one
futures tick each way (the futures contract that sets the market's tick is named). These are approximate published figures,
not measured from bid/ask history (the proxy serves mid candles only); they are fixed here before any result.

| Market | Spread (pts) | Tick / slip each way | Primary cost | ×2 stress |
|---|---|---|---|---|
| FTSE 100 (uk100) | 1.0 | 0.5 (ICE Z) | **2.0** | 4.0 |
| Nikkei 225 (jp225) | 8.0 | 5 (OSE mini) | **18.0** | 36.0 |
| Hang Seng (hk33) | 12.0 | 1 (HKEX mini HSI) | **14.0** | 28.0 |
| ASX 200 (au200) | 2.0 | 1 (ASX SPI 200) | **4.0** | 8.0 |
| Euro Stoxx 50 (eu50) | 1.5 | 1 (Eurex FESX) | **3.5** | 7.0 |
| CAC 40 (fr40) | 1.2 | 0.5 (Euronext FCE) | **2.2** | 4.4 |
| Russell 2000 (us2000) | M2K from the cost study (1 tick spread + fees + 1 tick slip each way) | | **0.55** | 1.1 |
| NQ (reference) | MNQ from the cost study | | 1.37 (and 1.0 as in #511 for the calibration gate) | 2.74 |

Gross and a price-scaled cost (primary cost as a fraction of the 2023-26 median open, applied at each trade's price) are
reported too; the bar uses the primary cost.

## Pass bar (per new market, primary cost; identical to #543)

- **L (late):** 2023-26 net R a trade > 0 **and** t ≥ 2.0.
- **E (early):** early-window net R a trade ≥ 0 (point estimate not negative).
- A market **passes** if L and E.

## Verdict mapping (fixed now)

Seven markets are tested, so the count needed is scaled up from #543's "2 of 3":

- **BROAD AND DURABLE**: ≥ 3 of the 7 pass L and E. At most a paper shadow proposal; the owner decides.
- **BROAD BUT REGIME-BOUND**: ≥ 3 pass L, but fewer than 3 pass L and E.
- **NQ-ONLY**: fewer than 3 pass L. The 2023+ open-run effect does not generalise to cash opens either.

A single market passing L (or L and E) does not change the label: with seven markets about one chance pass is expected
at this bar. It is reported as an isolated pass that could get its own pre-registered follow-up, not as evidence of
breadth. If us2000's result rests on NQ's own days (see dependence below), it is not independent evidence, and the
RESULT says so.

## Reported alongside (not part of the bar)

- Per market and window: n, R a trade, t, win rate, max drawdown, year by year with the count of positive and negative
  years; halves of the late window; median stop in points and the primary cost as a share of the median stop.
- Gross, cost ×1, cost ×2, price-scaled cost; midnight filter off; buffer 0; fixed 2R exit.
- Pooled R a trade over the seven new markets, both windows; also pooled with #543's ES, YM and DAX (from its
  `result.json` trades) as "all ten non-NQ markets".
- Dependence on NQ: for us2000 (same clock as NQ), the share of its trade days that are also NQ trade days, the same-side
  share, the correlation of R on shared same-side days, and R on shared versus non-shared days. For the other six, the
  share of trade dates that are also NQ trade dates (different clocks, so only date overlap).
- Equal-weight daily basket of NQ + the seven, late window.
- **Calibration gate:** the imported code run on the #511 NQ cache with the live fixed 2-point buffer and 1-point cost must
  reproduce #511/#543 exactly (−0.018R early, +0.318R late) before any new-market result is read. The script exits
  otherwise.
