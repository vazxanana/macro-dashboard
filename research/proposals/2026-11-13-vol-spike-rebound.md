# Proposal: a paper shadow for "buy US indices after a volatility spike" (13 Nov 2026)

**Open: the owner decides.** Paper research. Nothing here changes a live rule, size, filter, stop, `config.json`, a council
member or the mirror. Not built: if the owner says yes, the shadow is a separate build with its own tests. Source:
`research/edge/vol-spike-rebound/` (PREREGISTRATION.md committed first, RESULT.md, result.json).

## In plain words
1. **What was tested.** On the S&P 500, Nasdaq 100 and Dow CFDs (OANDA daily candles): when the last five days' realised
   volatility is more than twice its usual level (the median of the 120 days before) and the close is under its 20-day
   average, buy the next open, keep a stop 3 x ATR(20) below, and sell after 5 trading days (the pre-stated variant: 10).
   Net of spread and overnight financing. Decisive years 2016 to November 2026; 2008-15 as a replication.
2. **What it found.** The 10-day hold passed the bar written in advance: 165 trades, +0.151R a trade after costs, t 2.53
   (Holm p 0.011). The 5-day hold, the primary, missed (t 1.96).
3. **Why it is weak.** The three indices signal in the same weeks, so the trades are not independent: counted by entry week
   t is 1.68, by month 1.98. 2008-15 was flat (+0.013R, t 0.18). It beat 38 of 40 random-entry runs, only just over the 95th
   percentile. The worst years are the real crashes (2008 -10.9R, 2020 -7.4R): buying the first spike of a crash loses.
   **Positive, not proven; not an edge.**

## The choice
- **(a) A paper shadow** (`shadow: true`, never alerted, never copied to a demo account, never in the main book): the rule
  exactly as pre-registered with the 10-day hold, one position per index, every trade with its 3 x ATR(20) stop; judged on
  its forward record with n and t, pooled by entry week. It would take about 15 trades a year across the three indices, so a
  forward reading needs several years.
- **(b) Nothing**: record the result and move on (the evidence is borderline; a shadow costs little but adds a stream).

The study's author leans to (b) unless the owner wants an index stream to watch: the pass is on the variant, and once the
trades' dependence is counted it is not apart from luck. No live step is proposed either way.
