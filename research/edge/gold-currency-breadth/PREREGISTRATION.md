# Pre-registration: gold rising (or falling) in every major currency at once (14 Nov 2026)

Written and pushed alone, before any candle of this study was read or any number computed. Paper research only: a
**stand-alone rule on gold**, not a gate, entry, exit or size of the live gold book (Gold trend + Gold daily engulf), and
nothing here is compared with or applied to that book (docs/owner-decisions.md item 44). Nothing live changes.

## Hypothesis and why
A move of gold priced in US dollars mixes two things: a move of gold itself and a move of the dollar. When gold's 20-day
return is positive in **every** major currency at once (USD, EUR, GBP, JPY, CHF, AUD), the move cannot be a dollar move: it is
demand for gold itself (official buying, ETF and investment flows), which arrives over weeks and so should persist; the same
in reverse when gold falls in every currency. A dollar-only gold move is a currency move that gold's own buyers did not make.
Precedent: time-series momentum (Moskowitz, Ooi and Pedersen 2012, Journal of Financial Economics) and the practice of
reading gold's strength in several currencies (World Gold Council's gold-price-by-currency reports; Baur and McDermott 2010
on gold's role differing by currency area). The rule trades **both sides**, and its placebo keeps each trade's side and
length while moving its date at random, so gold's 2001-26 rise cannot pass it by itself.

Dedupe: not tested before. Closest studies: `gold-tsmom` (USD gold, 12-month sign, monthly), `gold-weekly-momentum`,
`gold-dollar-divergence` (one day of gold and the dollar index moving together), `gold-eur-vol-breakout` (a breakout of gold in
EUR). None conditions on the agreement of gold's trend across currencies.

## Data (named before any result)
council-data `research/daily/<key>.json` (OANDA mid, UTC days) at the commit of `origin/council-data` when the study runs:
`xau`, `eurusd`, `gbpusd`, `usdjpy`, `usdchf`, `audusd`. Weekend candles folded into the next weekday with
`council/fills.mjs` `foldWeekend`. Gold in each currency on each common day: USD = xau close; EUR = xau / eurusd;
GBP = xau / gbpusd; AUD = xau / audusd; JPY = xau x usdjpy; CHF = xau x usdchf. A day counts only when all six closes exist.
Trades are on XAU/USD.

## Rule
- At each common day d: r_c = close_c(d) / close_c(d - L) - 1 over L common days, for the six currencies. State = +1 if all six
  r_c > 0, -1 if all six < 0, else 0. A hole of more than 5 calendar days between common days restarts the count.
- Entry: on a day whose state turns to +1 (or -1) from anything else, enter the next gold open in that direction; one position
  at a time (a turn while a position is open is ignored).
- Stop: 2 x ATR(20) of the 20 gold candles before the entry candle (1R); a candle that opens through the stop exits at its open,
  otherwise the stop exits at the stop.
- Exit: at the next gold open after the first common day whose state is not the trade's side; at the latest at the close of the
  60th candle of the trade.
- Costs: $0.60 a round trip, plus `nights(entry, exit)` x `FIN.xau.long` x entry price on buys (council/fills.mjs; sells charged
  and credited nothing). R net = (gross move - costs) / 1R.

## Tests (three, Holm over all three)
- **T1 (primary)**: L = 20, both sides.
- T2: L = 20, the sell trades only.
- T3: L = 60, both sides.

Windows by entry date: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31. t = mean / standard error of
calendar-month sums of R net (months with no trade count as 0), by the exit month; one-sided p from the normal, Holm over the
three tests.

A test passes when all hold: out-of-sample net mean > 0 and month t >= 2 with Holm-adjusted p < 0.05; in-sample net mean > 0;
out-of-sample net mean > 0 at 2x costs ($1.20 and twice the financing); out-of-sample n >= 30; and its out-of-sample month t
above at least 38 of 40 placebo draws. Placebo (seeds 1-40): the test's out-of-sample trades keep their sides and lengths (in
candles) and stop rule, but each is moved to an entry day drawn at random from the out-of-sample common days, exiting by time
after its length (or its stop), one at a time skipped only where it would overlap (draws that overlap are re-drawn up to 50
times, then dropped). The study's verdict is PASS only when T1 passes; T2 or T3 passing alone is PARTIAL and proposes nothing.

## Reported, not tested
The same mechanics with the state from gold in USD alone (L = 20), as context for what the agreement adds; long and short
splits of T1; year by year. No variant chosen after seeing results becomes a rule.
