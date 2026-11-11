# Pre-registration: the playbook's weekly-bull daily rejection long, out of its own sample

Written 11 Nov 2026, before any number of this study was computed. Owner: "keep improving and follow our strategy and learn
more about it" (the gold playbook skill). The skill's best edge was found on Dukascopy H1 gold, November 2022 to October 2026
only, in a gold bull market. This study asks whether the same rule held on gold the skill never looked at.

## The rule (as the skill states it, in this study's own words)
- Days end at 17:00 New York (built from OANDA mid H1 candles; hours of the weekend shut dropped).
- Weekly structure: weeks built from those days, Monday to Friday. A swing high / low is a 2-bar fractal on each side
  (confirmed two weeks after it). Bullish after a completed week closes above the last confirmed swing high, bearish after one
  closes below the last confirmed swing low; it stays until the other break. Only completed weeks before the signal day count.
- Signal day D (closed): weekly structure bullish, close(D) > low(D-1), and (close - low) / (high - low) >= 0.70 on D.
- Entry at the open of the next day. Stop $0.30 under low(D). Target entry + 3R (2R reported as well). Out at the close of the
  10th day if neither is hit. Exits on H1 candles; a candle that holds both stop and target counts as the stop.
- Cost $0.35 an ounce a trade, in R from each trade's own risk. Each signal is its own trade (as the skill tested it).

## The baseline (as the skill judged it)
Every day D in a bullish week, the same trade: buy the next open, stop $0.30 under low(D), 3R, 10 days. The rule's lift is
its average net R a trade minus the baseline's, over the same period.

## The one test
Out of the skill's sample: 2006 (first OANDA candle) to 31 October 2022. Pass = lift > 0 with Welch t >= 2 (rule trades vs
baseline trades, net R), AND the rule's net profit factor above 1 in both 2006-2019 and 2020 to October 2022 (rule 4's window).
Anything else is a fail. Reported, not tested: the skill's own window (November 2022 to now, discovery, as a check that this
code reproduces it), the 2R target, the 0.80 threshold, one trade at a time, years, and the mirror short (bearish week, close
in the bottom 30% below the previous high). Nothing live changes whatever the result; a pass becomes a proposal for the owner.
