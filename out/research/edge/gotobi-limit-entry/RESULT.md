# Gotobi fade: can a resting sell limit placed before the fix capture the 00:55 result?

**Verdict: NOT CAPTURABLE.** Read on the strict fill rule as pre-registered: E1 k=2 strict keeps 5.4 % of E3's net R per day (+0.0080R against +0.1481R), month t +0.24, filling 54.5 % of days. An execution study on the frozen gotobi fade (#878 T2), not an edge verdict, and no live proposal. Paper research only; nothing live changed.

**Gate: PASSED.** E3 on these files gives n 771, +0.1481R a trade, month t +2.74 (gotobi-timing's M1 base: 771, +0.1481, +2.74). Universe: 771 gotobi days 2016-01-01 to 2026-11-11.

## Every variant

| Row | Fill rate | Net R per filled trade | Gross R | Cost R | Trade month t | Net R per day | Day month t | Total net R | Share of E3 per day | Stopped % |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 k=0 lenient | 91.6 % | +0.0368 | +0.1475 | 0.1107 | +0.74 | +0.0337 | +0.74 | +26.0 | 22.8 % | 30.7 |
| E1 k=0 strict | 84.2 % | +0.0076 | +0.1166 | 0.1090 | +0.15 | +0.0064 | +0.15 | +5.0 | 4.3 % | 31.7 |
| E1 k=1 lenient | 73.5 % | +0.0136 | +0.1193 | 0.1056 | +0.25 | +0.0100 | +0.25 | +7.7 | 6.8 % | 31.6 |
| E1 k=1 strict | 68.9 % | −0.0077 | +0.0954 | 0.1031 | −0.13 | −0.0053 | −0.13 | −4.1 | −3.6 % | 32.2 |
| E1 k=2 lenient | 58.8 % | +0.0401 | +0.1407 | 0.1007 | +0.67 | +0.0235 | +0.67 | +18.1 | 15.9 % | 31.1 |
| E1 k=2 strict | 54.5 % | +0.0147 | +0.1137 | 0.0990 | +0.24 | +0.0080 | +0.24 | +6.2 | 5.4 % | 31.9 |
| E2 | 100.0 % | +0.0720 | +0.1846 | 0.1126 | +1.46 | +0.0720 | +1.46 | +55.5 | 48.6 % | 29.7 |
| E3 | 100.0 % | +0.1481 | +0.2607 | 0.1126 | +2.74 | +0.1481 | +2.74 | +114.2 | 100.0 % | 27.6 |

"Net R per day" counts every universe day, an unfilled one as 0R; "Day month t" is on calendar-month sums of that. "Trade month t" is the frozen `monthT` over filled trades only.

## The limit's fills and misses

| Row | Fills at 00:54 | 00:55 | 00:56 | 00:57 | No 00:53 candle | Not filled | E3 net R on the filled days | E3 net R on the missed days |
|---|---|---|---|---|---|---|---|---|
| E1 k=0 lenient | 686 | 13 | 6 | 1 | 0 | 65 | +0.1407 | +0.2280 |
| E1 k=0 strict | 601 | 34 | 11 | 3 | 0 | 122 | +0.1357 | +0.2138 |
| E1 k=1 lenient | 499 | 40 | 17 | 11 | 0 | 204 | +0.1229 | +0.2180 |
| E1 k=1 strict | 446 | 54 | 19 | 12 | 0 | 240 | +0.1192 | +0.2119 |
| E1 k=2 lenient | 373 | 49 | 20 | 11 | 0 | 318 | +0.1424 | +0.1562 |
| E1 k=2 strict | 331 | 55 | 24 | 10 | 0 | 351 | +0.1408 | +0.1568 |

## Notes

- The fill rules are on M1 highs: a high may have lasted a moment and a real queue may not have reached the order, so even the strict rule (0.3 pip through) is an estimate, not a measured broker fill. Mid prices: a real sell limit fills on the bid, about half a spread lower.
- A fill is credited at the limit price even when the candle opened above it (no price improvement), and a stop reached inside the fill candle counts as stopped (the order inside the candle is unknown). Both are the worse case.
- The frozen costs (spread plus 0.5 pip slippage a side) are charged on the limit fills too: no rebate is taken for a resting order.
- What the misses cost: on the days E1 k=0 strict did not fill, E3 made +0.2138R a trade; on the days it filled, E3 made +0.1357R. A limit above the market fills on the days the price ticks up into the fix, which are not a random half of the days.
- Read after the reading, descriptive only: most fills come in the 00:54 candle, before the fix minute. The 00:55 open sits on average +0.29 pips from the 00:53 close (median +0.20, above it on 52.1 % of days), and E2 (00:54 market) already loses about half of E3. A limit near the 00:53 close sells at roughly the 00:54 price, not the 00:55 one; a higher limit fills less often and misses days E3 made money on.
- Month t on per-day net R is a measure of noise, not a test: no Holm, no placebo. Nothing here is chosen; any live use would need its own proposal and the owner.
