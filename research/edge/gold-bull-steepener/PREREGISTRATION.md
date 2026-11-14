# Pre-registration: spot gold after a front-end-led US curve move (bull steepener / bear flattener)

Written 14 Nov 2026, before any outcome was computed. The only numbers looked at before this file was pushed are the
signal-day counts below (`run.mjs count`, no gold outcome read). Paper research only: a stand-alone cross-asset rule on spot
gold, not a gate, entry, exit or size of the live gold book; the book's 2006-17 window and positions are not used and
nothing is compared with them (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member
changes, whatever the result.

## Hypothesis and prior

When the US 2-year yield falls sharply on a day AND the curve steepens that day (a "bull steepener": the front end leads,
the market is pricing a lower Fed path), real short rates and the dollar's carry are expected to fall, which should lift
gold over the following days more than an ordinary day does. The mirror, a "bear flattener" (2-year yield up sharply, curve
flattening: a hawkish repricing), should weigh on gold. The prior is the policy-expectations channel (gold as the zero-yield
asset whose opportunity cost is the expected short rate) and the usual decomposition of curve moves into bull / bear and
steepening / flattening by which end of the curve leads.

Why not a duplicate (checked 14 Nov 2026 against `research/edge`, every `rates / yield / bond / curve / steep / macro`
branch and the untested-backlog list):
- `gold-curve-slope` (FAIL): the 4-week change of the slope alone (2s30s / 2s10s z), weekly, whatever the level did; it
  reported a 4-week "bear steepening" cut only as a side line. Here the signal is a DAILY front-end shock with the slope's
  sign as a condition, and the direction comes from the 2-year (policy) move.
- `gold-yield-shock` (FAIL): 10-year shock days, no curve condition. `gold-bond-lead` (FAIL): gold lagging a bond move
  (lead / lag), its T3 a 1-day 2-year lag trade with no curve condition. `gold-rates-shrug` / `silver-rates-shrug`: yields
  jumped and gold held flat (not re-tested here). `gold-rate-spread` (FAIL): US-Bund gap. `gold-bond-vol-spike`,
  `gold-bond-52w-extreme`: volatility and range position. `yield-fx-weekly`: 2-year to the dollar, not gold.

## Data (named before any result)

council-data commit `3cdbcdaa0bd00519e4576f72f4f00c0e5a12ecb2`, `research/daily/xau.json`, `usb02y.json`, `usb10y.json`
(OANDA mid daily candles, UTC days; the bond keys are CFD PRICES), weekends folded into Monday with `council/fills.mjs`
`foldWeekend`. Market traded: XAU/USD only. Days used: those where gold, the 2-year and the 10-year all have a candle.

## Signal

- Yield change proxy: `dy = -ln(P_t / P_t-1) / D`, assumed durations D = 1.9 (2-year) and 8.0 (10-year), as `gold-curve-slope`.
- `z2` = today's 2-year `dy` over the root mean square of the 250 previous common-day 2-year `dy` (only earlier days).
- Slope change = `dy10 - dy2` (positive = 2s10s steepening).
- Bull steepener: `z2 <= -1` and slope change `> 0`. Bear flattener: `z2 >= +1` and slope change `< 0`.
- First z: 2007-03-14.

Signal-day counts (outcomes not computed): bull steepener 168 in sample, 217 out of sample; bear flattener 154 in sample,
246 out of sample (of 2,533 / 2,552 eligible days). Every window has at least 100 signal days.

## Trade

Entry at the open of the first gold candle on a later UTC day than the signal; stop 2 x ATR(20) of the gold candles before
the entry (1R; **every trade has a stop**; a gap through it fills at the open); out at the close of the hold's last candle;
one position at a time per test. Costs: $0.60 a round trip ($0.30 spread + $0.15 slippage on each market order) plus, on
buys, `nights()` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap of 11 Nov 2026, today's rate
for every year) x entry price / risk. 2x costs = both doubled.

## Tests (Holm over these three, one-sided OOS p from the month t)

| Test | Signal | Side | Hold |
|---|---|---|---|
| T1 (primary) | bull steepener | buy | 5 gold candles |
| T2 | bear flattener | sell | 5 gold candles |
| T3 | bull steepener | buy | 10 gold candles |

Measured per trade as **excess** = net R minus the mean net R of the same trade (same side, hold, stop, costs) entered at
every gold candle of the same calendar year (the same-side every-day baseline). t on calendar-month sums of excess R
(empty months count as 0). In sample 2007-03-14 to 2016-12-31, out of sample 2017-01-01 to 2026-10-31.

## Pass bar (per test; the verdict is T1's)

1. OOS month t of excess >= 2 and Holm p < 0.05;
2. in-sample mean excess > 0 (same sign);
3. OOS mean net R > 0 and mean excess > 0 at 2x costs;
4. at least 100 signal days in each window;
5. the real OOS excess t beats at least 38 of 40 placebos: same number of days drawn at random from the window's eligible
   days (seeds 1-40), traded the same way.

Reported, not a pass condition: a **control that keeps drift and volatility**: 40 seeds (1001-1040), each event day
replaced by a random non-event day of the same year, the same sign of gold's 20-day return to that day's close and the
same half of gold's 20-day realised volatility (above / below that year's median); the control's excess t and mean are
shown beside the real one. Also reported: gross figures, cost per trade, stops, the same-day gold move on signal days.

No parameter (threshold 1, durations, holds, stop, look-back) will be changed after this file is pushed; any other cut
seen in the result is a side line, never a finding.
