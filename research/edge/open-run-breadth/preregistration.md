# Open run breadth: pre-registration

Written and pushed before any candle of a new market was downloaded or any result computed. Paper research only: no live
rule, config or tracker changes, whatever the outcome.

## Question

The NQ New York open run (`council/trader.mjs` `nqOpenSweep` + the `nyflip` block) made nothing over 2004-22
(−0.018R a trade, n 1,560) and +0.318R a trade (t 3.45, n 309) over 2023-26 (#511, `research/edge/nq-open-oos`).
Is the 2023+ effect a broad change in how index opens trade (then the same unchanged rule should also work on other
index markets since 2023), or is it specific to NQ (luck or an NQ-only quirk)?

## The rule (unchanged, from #511 `lib.mjs`, made session-generic)

For each market and each local weekday:

1. O = open of the session-open 1-minute candle (local minute `o`).
2. Scan the candles with local minute in (o, o + 90). Track the first cross below O (low < O) and the first cross above O
   (high > O), and the running extreme of each.
3. Signal on the first candle where, for a side whose first cross was at most 15 minutes (900 s) earlier and whose extreme
   is at least **0.08% of O** away from O, the candle closes back across O in the reclaim colour (close > O and
   close > open after a run below; close < O and close < open after a run above).
4. Trade **with** the run (the reclaim is faded): entry at that candle's close. Stop distance r0 = |entry − (extreme ∓ buffer)|,
   stop placed r0 on the other side of entry.
5. Only if the local midnight price lies ahead of the trade (above entry for a buy, below for a sell).
6. 10R cap; from +2R the stop trails 1R behind the best price (`nqRun` [2, 1]).
7. Out at the open of the candle at local minute o + 90.
8. Trade loop exactly as #511 (stop before target within a candle, a gap fills at the open, the first minute after entry
   is not checked, as in the live loop).

**Stop buffer.** The live code uses a fixed 2 NQ points (it computes a 0.011% `buf` but never uses it). A fixed 2 points
does not transfer between markets priced 5,000 to 45,000, so for every market here, NQ included as the reference row, the
buffer is **0.011% of O** (the fraction the live code itself declares; about 2 NQ points at 18,000). The NQ row is also
reported with the live fixed 2 points.

**Midnight price.** The open of the 00:00 local candle; if missing, the close of the last candle before 00:00 local; else
the open of the first candle in 00:00-00:59 local (the #511 fallback). DAX CFD quotes often stop overnight (Eurex
hours), so for DAX this is usually the prior evening's last price. Fixed now, not tuned.

## Markets and session times (fixed now)

| Market | OANDA instrument (site proxy key) | Time zone | Open `o` | Scan | Exit | Midnight |
|---|---|---|---|---|---|---|
| NQ (reference, #511 cache) | NAS100_USD (`nas100`) | America/New_York | 09:30 | 09:31-10:59 | 11:00 | 00:00 NY |
| ES | SPX500_USD (`spx500`) | America/New_York | 09:30 | 09:31-10:59 | 11:00 | 00:00 NY |
| YM | US30_USD (`us30`) | America/New_York | 09:30 | 09:31-10:59 | 11:00 | 00:00 NY |
| DAX | DE30_EUR (`de40`) | Europe/Berlin | 09:00 (Xetra open) | 09:01-10:29 | 10:30 | 00:00 Berlin |
| FTSE | UK100_GBP | Europe/London | 08:00 | – | – | – |

**FTSE is excluded before any data is read:** the site's keyless OANDA proxy (`api/_oanda.js`) does not map UK100, and no
other free FTSE minute source is used. So there are **three new markets: ES, YM, DAX.**

Data: OANDA 1-minute mid candles through `https://meridianx.dev/md/bars` (free), 2003 to 6 Nov 2026.
Clean years: the same thresholds as #511 (open candle on ≥ 93% of weekdays, ≥ 93% of the 90 scan minutes present,
a midnight price on ≥ 90% of weekdays). Unclean years are dropped before results are looked at.

## Windows

- **Early (untouched):** clean years 2004-2022.
- **Late:** clean years 2023 to 6 Nov 2026.

## Costs (round trip, index points, constant across years)

All-in futures-micro figures from the repo's cost study (`research/edge/costs/RESULT.md`: 1 tick spread + fees + 1 tick
slip each way):

| Market | Primary cost | ×2 stress |
|---|---|---|
| NQ | 1.37 (MNQ); also 1.0 as in #511 | 2.74 |
| ES | 1.00 (MES) | 2.00 |
| YM | 5.5 (MYM) | 11.0 |
| DAX | 2.0 (OANDA DE30 ~1.2 spread + slip; FDXS 1-pt tick) | 4.0 |

Gross and a price-scaled cost (primary cost as a fraction of the 2023-26 median price, applied at each trade's price) are
reported too, to separate cost from edge in the early years; the bar uses the primary cost.

## Pass bar (per new market, primary cost)

- **L (late):** 2023-26 net R a trade > 0 **and** t ≥ 2.0.
- **E (early):** 2004-22 net R a trade ≥ 0 (point estimate not negative).
- A market **passes** if L and E.

## Verdict mapping (fixed now)

- **BROAD AND DURABLE**: ≥ 2 of {ES, YM, DAX} pass L and E. At most a paper shadow proposal; the owner decides.
- **BROAD BUT REGIME-BOUND**: ≥ 2 pass L, but fewer than 2 pass L and E. A 2023+ change shared by index opens;
  more markets = more edge only while the regime lasts. Still a regime bet; no live change.
- **NQ-ONLY**: fewer than 2 pass L. The 2023+ open-run effect does not generalise; treat NQ's run as NQ-specific luck
  or quirk.

## Reported alongside (not part of the bar)

- Per market and window: n, R a trade, t, win rate, max drawdown, year by year; halves of the late window.
- Cost ×2, gross, price-scaled cost; midnight filter off; buffer 0; the skipped midnight-behind trades.
- Dependence: the US markets share the clock with NQ. For the late window: share of ES/YM trade days that are also NQ
  trade days, same-side share, and the correlation of R on shared days. If an L pass rests on NQ's own days it is not
  independent evidence, and the RESULT says so.
- Pooled late and early R a trade over the three new markets.
- Calibration gate: the generic code run on the #511 NQ cache with the live fixed 2-point buffer and 1-point cost must
  reproduce #511 (−0.018R early, +0.318R late) before any new-market result is read.
- Cross-check: ES on HistData SPXUSD M1 2018-26 (council-data), same code.
