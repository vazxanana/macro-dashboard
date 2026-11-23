# Is the 20-23 UTC fade a quote effect? (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/fade-conditions` found that the fade of the first M15 structure break (`research/edge/grid7-wide-fade` cell
`m15 none atr 2R all`) lives mostly in the 20-23 UTC block: +0.169R a trade before costs in 2015-26 (n 27,671, month t 14.09)
against about zero at 08-11 UTC. 20-23 UTC holds the daily rollover (about 21:00-22:00 UTC), when the bid / ask spread widens
and mid quotes jump. A "break" made by a quote jump that then comes back looks like a winning fade on mid candles but may not
be tradable. This study measures the block in ways that separate a quote effect from a price reaction. One run, no variants.

## The rule (unchanged, imported)

`m15 none atr 2R all` by `grid7-wide-fade`'s own code (`signals`, `exits`, `CAP`; `combo-grid-3` `frames`, `dom-trade-through`
`atr14` / `startIdx`), exactly as `fade-conditions` runs it (R1): the first close beyond the last confirmed M15 swing (3 a
side), known at the close of the break candle; fade it at the open of the first 5-minute candle starting at or after that
close; stop 1 x ATR(14) of M15 from the fill (on the losing side; the run throws otherwise); target 2R; out after 1 day; stop
first when one 5-minute candle holds both; a gap fills at the open; a risk under the market's round-trip cost is no trade; a
trade the grid cannot resolve is dropped as in the grid. Closed candles only.

**Hour** = the UTC hour of the break candle's START (the convention of `fade-conditions` `hourLevel`).

## Data

- OANDA mid 5-minute candles (the `edgekit` cache), markets **xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf
  eurjpy**, fills 2005-01-01 to 2026-10-31, windows **2005-14** and **2015-26**; the data-quality exclusions applied
  (`combo-grid-2` `exclusions`).
- HistData M1 grouped to 5 minutes (`fade-new-markets` `histM5`, imported; UTC through `council/histdata.mjs`), the markets
  council-data holds: **xau xag eurusd gbpusd usdjpy audusd usdcad usdchf** (no nzdusd, eurjpy), fills 2018-02-01 to
  2026-10-31 (`fade-new-markets` `B_FROM`, `TO`). No exclusions (as `fade-new-markets` Test B).
- Indices for part (4): **nas100 spx500 de40**, OANDA, from where the cache starts (2019), same rule.
- Costs beside (never judged on): `combo-grid-2` `COSTS` (demo figures; assumed for xag, nzdusd, usdcad, usdchf, eurjpy).
- Spreads for part (5): council-data `research/probe/ticks-XAUUSD.json` (the 20 Nov 00:58 UTC version, the last with an
  `hourProfile`), `ticks-XAGUSD.json`, `ticks-NAS100.json`, `ticks-US500.json`: the median quoted spread in the first two
  minutes of each UTC hour over 60 weekdays. The forex majors have no `hourProfile` on file: not measurable here, said so.

## Gate

The OANDA run's pooled n and mean over all hours equal `grid7-wide-fade/result.json` cell `m15 none atr 2R all` (both windows),
and the 20-23 block equals `fade-conditions` (2015-26: n 27,671, +0.169). Otherwise INCONCLUSIVE, nothing judged.

## Primary tests (fixed now, Holm over the four)

"The block without the rollover" = trades whose break candle starts in hour **20 or 23 UTC** AND whose fill is not in
21:00-22:59 UTC (the 20-23 block with 21:00-22:59 excluded).

- **P1** OANDA 2005-14: the block without the rollover has mean R > 0 and calendar-month-sum t >= 2.
- **P2** OANDA 2015-26: the same.
- **P3** HistData 2018-02 .. 2026-10: the same.
- **P4** HistData: the whole 20-23 block minus the 08-11 block, mean R difference > 0, Welch t >= 2 (per-trade).

One-sided p from each t (month count - 1 df for P1-P3, Welch df for P4); Holm over the four; a test passes with its condition
met and Holm p < 0.05. **PASS** = all four pass (the 20-23 fade survives without the rollover hours on both feeds and is not
a feed's artefact). **FAIL** = any fails. **INCONCLUSIVE** = the gate fails or fewer than 8 OANDA / 6 HistData markets load.
All judged before costs; after-cost figures beside.

## Reported beside (descriptive, not tested)

1. Every UTC hour 0-23, OANDA, both windows: n, mean R, month t, win share, after costs; hours 19, 20, 21, 22, 23, 00 named.
   Also: the whole fade with 21:00-22:59 excluded; and a stricter cut: trades NOT open at any moment between 21:00 and 22:59
   UTC (entered and exited outside it).
2. The same table on HistData (2018-26), and OANDA on the same markets and window beside it.
3. Spike or normal candle: the break candle's range against the median range of the 20 previous M15 candles of the same
   time of day (closed candles only); buckets < 1, 1-2, >= 2; by block (20-23, 08-11, other). On OANDA, both windows.
4. Indices nas100, spx500, de40 by hour (their daily breaks fall at other hours than the forex rollover).
5. Move to target against the measured spread: for trades filled 2025-01 .. 2026-10 on xau, xag, nas100, spx500, per fill
   hour: median target distance (2 x risk, in price), the hour's median quoted spread, their ratio, and mean R before and
   after that hour's spread (charged once a round trip as spread / risk; gold also its commission 0.000024 of price).

No other splits, cut points or rules. Never called an edge.
