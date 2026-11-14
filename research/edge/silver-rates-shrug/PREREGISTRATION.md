# Pre-registration: spot silver after a 10-year bond shock it shrugged off (14 Nov 2026)

Written and pushed alone, before any return, R or t of this rule on silver was computed. Only the event counts below were looked
at. Paper research only: a **stand-alone rule on silver**, never a gate, entry, exit or size of the live gold book, and none of
the book's positions is read (docs/owner-decisions.md item 44). Nothing live changes; no proposal follows from a FAIL.

## Why this study

`research/edge/gold-rates-shrug` (14 Nov 2026, FAIL 0 of 3) had one near miss: its T3, buy gold for one daily candle after a day
the 10-year Treasury CFD fell at least 1 sd (yields up hard) while gold's own move stayed within +/-0.5 sd. Out of sample
(2017 to Oct 2026) that beat the year's every-day one-day buy by +0.072R a trade (n 115, month t 1.90, one-sided p 0.029,
Holm p 0.086), above 38 of 40 placebos and 39 of 40 controls. It was picked as the closest of three tests AFTER the fact, so it
proves nothing by itself. This study asks one question: **does the same rule, unchanged, work on a market it was not found on?**
Silver is the closest such market (a precious metal, the same rates channel, not used to find the rule). No threshold, window,
hold, stop or measure is re-tuned; only the traded market and its cost change.

## Data (fixed now)

- council-data `research/daily/xag.json` (traded), `research/daily/xau.json` (T2's condition only) and
  `research/daily/usb10y.json` (signal), OANDA mid daily candles, UTC days, at council-data commit `7a4c629a`; weekends folded
  into Monday with `council/fills.mjs` `foldWeekend`. Market set: silver, gold and the 10-year Treasury CFD only; silver is the
  only market traded. `usb10y` is the bond PRICE (down = yields up).
- Common days = UTC days all three have a candle. For each common day: the bond's, silver's and gold's return (close to close
  over the previous common day), each divided by the sample sd of that market's 250 previous common-day returns (the day itself
  excluded) = bond z, silver z, gold z.

## Events

- **Silver-flat shrug** (T1, T3): bond z <= -1.0 AND |silver z| < 0.5 the same day.
- **Gold-flat shrug** (T2): bond z <= -1.0 AND |gold z| < 0.5 the same day (exactly gold-rates-shrug's event; silver is traded).
- Counted before this was written (eligible days from 2007-03-14): silver-flat 146 in sample (2007-16), 139 out of sample
  (2017 to Oct 2026), 285 over 2007-26; gold-flat 135, 115 and 250 (the same counts as gold-rates-shrug). All at least 100 per
  window.

## Trade (gold-rates-shrug's, on silver)

- Entry at silver's next daily open after the event day; stop 2 x ATR(20) of the 20 silver candles before the entry (1R); a gap
  through the stop fills at the open; stop first; otherwise out at the close of the hold's last candle. One trade at a time.
- Costs: **$0.06 a round trip** on silver = silver's $0.03 round trip as `research/edge/gold-drd-silver` scaled it from gold (one
  hundredth of gold's typical price ratio; the cost the ICT lab already uses for silver) in the spread's place, plus half of it
  ($0.015) of slippage on each market order, the same structure as gold-rates-shrug's $0.60 ($0.30 + 2 x $0.15).
- **Financing: none.** `council/fills.mjs` `FIN` holds a gold long rate only; no silver rate is measured, so silver buys are
  charged no overnight financing. This flatters the 5-day hold (T3) a little; the 1-day holds cross one rollover at most.

## Tests (three, Holm over the three)

| Test | Event | Side | Hold |
|---|---|---|---|
| T1 (primary) | silver-flat shrug | buy silver | 1 candle |
| T2 | gold-flat shrug | buy silver | 1 candle |
| T3 | silver-flat shrug | buy silver | 5 candles |

- Measure (as gold-rates-shrug): **excess** = a trade's net R minus the mean net R of the same side and hold entered at every
  silver candle of the same calendar year (the same-side every-day baseline). Also reported: gross and net R, net at 2x costs,
  month t of net and of excess.
- t on calendar-month sums of excess R (every month of the window, empty months 0), by exit month. One-sided normal p for
  excess > 0 out of sample; Holm over T1-T3.
- Windows: in sample 2007-01-01 to 2016-12-31, out of sample 2017-01-01 to 2026-10-31, and the whole 2007-26 period (reported
  only; the pass bar reads the two windows).

## Placebo and control (out of sample, 40 seeds each)

- **Placebo**: the same number of random eligible OOS common days (seeds 1-40), same side, hold, stop and baseline.
- **Control**: the bond's z values shuffled among the common days of each calendar year (seeds 1001-1040); the metal's own days
  and its |z| < 0.5 filter kept real; events taken again and traded the same way. It asks whether the BOND shock adds anything
  beyond "the metal had a quiet day".

## Pass bar (a test passes only if all hold)

1. OOS month-sum t of excess >= 2 and Holm p < 0.05;
2. in-sample excess > 0 (same sign);
3. OOS net R > 0, and OOS net R and excess > 0 at 2x costs;
4. at least 100 events in each window;
5. the real OOS excess t is above at least 38 of the 40 placebo draws;
6. the real OOS excess t is above at least 38 of the 40 control draws.

The verdict is PASS only if T1 passes; T2 and T3 are reported. A PASS would say the gold near miss replicated on silver, a paper
finding, not an edge for live use, until a forward record exists. A FAIL says the gold near miss did not replicate, which
weighs against it as well.

## Files

`run.mjs` (`fetch <dir>` copies the three caches out of origin/council-data, no network; `count <dir>` prints the event counts
only; `full <dir>` runs and writes `result.json`), `RESULT.md`, `result.json`, `tests/silver-rates-shrug.test.mjs`. Candle
caches stay out of git and are deleted.
