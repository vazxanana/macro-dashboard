# Gold: when the day's extreme was made (pre-registration, 14 Nov 2026)

Written and pushed alone, before any candle was fetched or any trade computed. Paper research only: nothing live reads or
changes. **A new stand-alone daily rule on spot gold, not a gate, exit, entry or size of the live gold book** (owner item 44
respected: no live position is read, no live rule is compared or changed).

## Hypothesis

A gold day that closes up AND made its high in the last hours of the session (buyers still in control into the close, no
pullback from the high) is followed by a better next day than an ordinary day; the mirror for a down day with its low made
late. The question is whether the TIME of the extreme carries information beyond the day's direction and beyond gold's
drift. No earlier study here used the hour in which a day's extreme was set (`gold-ibs`, `gold-wick-pressure`,
`gold-key-reversal` use where the close sits in the range, not when the extreme was made; `gold-late-ny` and `last-hour`
trade the last hours themselves, not the next day).

## Data (fixed before any result)

- Market: spot gold only, `xau` (XAU/USD), OANDA mid H1 candles through the site's keyless candle proxy (`/md/bars`,
  `tf=1h`), from the first candle served (March 2006) to 2026-10-31. Complete candles only. Cache kept outside git, deleted
  at the end.
- Trading day: 17:00 New York to 17:00 New York (New York daylight time from `council/histdata.mjs` `nyOffsetH`, imported,
  not edited). A day is used only with at least 20 H1 candles (holidays and half days dropped). Daily open / high / low /
  close are built from its H1 candles.
- ATR14: mean true range of the 14 usable New York days ending at the signal day.

## Rule

At the close of day D (17:00 New York):
- **Late-high buy**: D closes above its open AND the H1 candle holding D's high (first one if tied) is one of D's last
  `LATE` = 4 candles (13:00-17:00 New York).
- **Late-low sell**: D closes below its open AND the H1 candle holding D's low is one of D's last 4 candles.
- Entry at the open of the first H1 candle of D+1 (the next usable day). Stop 1.0 x ATR14(D) from the entry (every trade has
  a stop; 1R = that distance). Exit at the close of D+1 (17:00 New York) or at the stop, checked on H1 candles (a gap through
  the stop fills at the candle's open). One position at a time.
- Costs: $0.60 a round trip on every trade, plus on buys `nights(entry, exit)` x `FIN.xau.long` x entry (council/fills.mjs,
  imported: the demo broker's measured gold swap, 0.000148 of price a rollover). At 2x costs both are doubled.

## Baselines and tests (three, Holm over the three)

- **B0 every-day baseline**: on every usable day of the window, a buy and a sell entered at the next day's first H1 open,
  same stop, same exit, same costs. Mean net R per side per window.
- **B1 same-direction baseline**: the same, but buys only after every up-close day and sells only after every down-close
  day (whatever the hour of the extreme).
- **T1 (primary)**: rule net R minus B0 of the same side and window (excess over gold's drift), 1-day hold.
- **T2**: rule net R minus B1 of the same side (does the TIME add anything beyond the day's direction), 1-day hold.
- **T3**: the same signals held 5 usable days (exit at the close of the 5th day, or the stop), excess over B0 computed with
  the same 5-day hold.
- t on calendar-month sums of the per-trade value (every month of the window counted, months with no trade = 0), two-sided
  p from the normal, Holm over T1-T3 on the out-of-sample t.
- Windows: in sample 2007-01-01 to 2016-12-31 (by entry day), out of sample 2017-01-01 to 2026-10-31.
- Placebo: 40 seeded draws (mulberry32, seeds 1-40): the same number of OOS trades with the same buy / sell mix placed on
  days drawn at random from the OOS usable days; the month-sum t of their excess over B0. Reported: how many of 40 reach the
  actual T1 t.

## Pass bar (all lines)

T1 out of sample: excess t >= 2 and Holm p < 0.05; in sample excess of the same sign (> 0); out-of-sample excess still
> 0 at 2x costs. Otherwise FAIL. T2 and T3 are reported; they cannot rescue T1. Expected n: roughly a quarter to a third of
days qualify on one side or the other, several hundred a window.

## Reported also (descriptive, no verdict)

Buy and sell sides apart, by year, gross and net; the early-extreme control (up day with the high in the FIRST 4 candles,
down day with the low in the first 4) as a description only; stop size in dollars; cost share.
