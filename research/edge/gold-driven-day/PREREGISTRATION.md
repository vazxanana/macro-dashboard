# Pre-registration: gold-driven days against dollar-driven days (14 Nov 2026)

Written and pushed alone, before any candle was read for a result. Paper research only: a **stand-alone rule on gold**, not a
gate, entry, exit or size of the live gold book (owner decision 44); nothing here is compared with or applied to that book. No
live rule, file, cost constant or council member changes.

## The idea

Gold priced in dollars moves for two reasons: gold itself is bid or offered, or the dollar moves. On a day the dollar is the
cause, gold rises in dollars but falls in euros and pounds; on a day gold itself is the cause, it moves the same way in all
three currencies. The hypothesis: a **gold-driven** move (the same sign, clearly, in USD, EUR and GBP) carries on over the next
days, and a **dollar-driven** rise in dollar gold (gold up in USD, down in EUR and GBP) fades. The rule is measured against the
same-side trade taken on every eligible day, so gold's own drift is not counted as signal.

Nearest earlier studies, and the difference: `gold-currency-breadth` (the 20-day TREND of gold in six currencies agreeing; this
is one day's move and its split by cause), `gold-dollar-divergence` (gold and the dollar index both up on one day; this asks
whether gold moved in the other currencies, not whether the dollar rose), `gold-dollar-lead` (a weekly dollar move that gold
lagged), `gold-haven-catchup` (gold's weekly gap to the yen, franc and Treasuries). No study has split a gold day by whether it
also showed in gold priced in euros and pounds.

## Data (named before any result)

- OANDA mid daily candles (UTC days) from council-data `research/daily/`: `xau` (XAU/USD), `xaueur` (XAU/EUR), `xaugbp`
  (XAU/GBP), read with `git show origin/council-data:…` (no network), cache kept outside git. Saturday / Sunday candles folded
  into the next weekday with `council/fills.mjs` `foldWeekend` (imported, not edited).
- Only days with all three closes; a return across a hole of more than 5 days starts the look-back again.

## Signal

- For each of the three series, the close-to-close return of day D divided by the sample sd of its 20 previous daily returns
  (day D itself excluded): z_usd, z_eur, z_gbp.
- **Gold-driven up day**: z_usd > +0.5 and z_eur > +0.5 and z_gbp > +0.5. **Gold-driven down day**: all three < -0.5.
- **Dollar-driven up day**: z_usd > +0.5 and z_eur < 0 and z_gbp < 0.

## Tests (three, Holm over the three)

- **T1 (primary)**: gold-driven up day: buy XAU/USD at the next daily open, hold 3 daily candles.
- **T2**: gold-driven down day: sell at the next open, hold 3 candles.
- **T3**: dollar-driven up day: sell (fade) at the next open, hold 3 candles.

## Trade and costs

- Entry at the next UTC daily open after day D; stop 1.5 x ATR(14) of the 14 candles before the entry (1R); a gap through the
  stop fills at the open, a touch at the stop; otherwise out at the close of the 3rd candle. One position at a time per test.
- Costs: $0.60 a round trip, plus financing on buys = `nights()` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`; today's rate charged for every year, as earlier studies did). Sells
  are charged and credited nothing. Also reported at 2x these costs.

## Baseline and statistics

- Baseline per test and window: the same trade (same side, same hold, same stop and costs) taken on every eligible day (every
  day with a full 20-day look-back), with no one-at-a-time rule. **Excess** of a trade = its net R minus the baseline's mean net
  R in that window.
- t on calendar-month sums (months with no trade count as 0) of excess R, and also of net R; one-sided p from the excess t;
  Holm over T1-T3 on the out-of-sample p.
- Windows by signal day: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.
- Placebo: 40 seeded draws per test of the same number of days as the real signals, drawn at random from out-of-sample days
  with the same dollar-gold condition (z_usd > +0.5 for T1 and T3, z_usd < -0.5 for T2) but WITHOUT the euro / pound
  condition, run through the same trade; so the placebo keeps one-day momentum in dollar gold and removes only the cross-
  currency split. Reported: how many of the 40 placebo excess month t the real one beats.

## Pass bar

A test passes only with all of: out-of-sample excess month t >= 2 and Holm p < 0.05; out-of-sample net R a trade > 0 and
excess > 0; in-sample excess > 0 (the same sign); out-of-sample net R a trade > 0 at 2x costs; beats at least 38 of 40
placebos; out-of-sample n >= 30. **PASS** = T1 passes; **PARTIAL** = only T2 or T3 passes; otherwise **FAIL**. Even a pass
would be a lead, not an edge, until replicated on data it did not use.

## Repeat

`node research/edge/gold-driven-day/run.mjs fetch <dir>` (git show, no network), then `… full <dir>`; writes `result.json`.
