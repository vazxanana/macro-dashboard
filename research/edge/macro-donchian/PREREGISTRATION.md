# Pre-registration: macro-donchian (20 Nov 2026)

Paper research only. A test of one claim in the owner's macro rule book (the "Gold Macro Score" document): its **execution
layer**, a daily Donchian swing rule on gold, sized by the Gold Macro Score. A stand-alone rule, not a gate, exit, entry or size
of the live gold book (owner decision 44: none of that book's records are read). Nothing live changes and no proposal is written
by this study.

Written and pushed alone, before any code for it exists or any of its trades has been computed.

## The claim (as the document states it, in my own words)

On daily gold futures 2007-2026, before costs: enter on a close beyond the 20-day Donchian channel in the direction of the
EMA 20 / EMA 50 trend, stop 2 × ATR(14), out after 5 days or at the stop. Longs: 174 trades, +0.24R a trade, 59 % won, profit
factor 1.98, t 3.7. Shorts: 88 trades, −0.01R. Longs taken while the Gold Macro Score is above +0.25: 52 trades, +0.27R, 65 % won;
at or below: 122 trades, +0.23R, 56 % won. The document's advice: gold longs only; full risk when the score is above +0.25, half
otherwise.

The document's sample is 2007-2026, so no window here is untouched by its author. This study asks whether the claim **replicates
on another price source (OANDA spot), net of costs and overnight financing, and beats random long entries in the same trend**.

## Data

- Gold: council-data `research/daily/xau.json` (OANDA mid D1, complete UTC days), read with `git show` (no network), folded to
  trading days with `council/fills.mjs` `foldWeekend` (weekend stubs into the next weekday).
- Score: the weekly Gold Macro Score exactly as `research/edge/blowoff-veto/run.mjs` `weeklyScore` builds it (the four drivers of
  `council/macroscore.mjs`, expanding z), from council-data `macro/cache.json` (FRED) and the five dollar pairs' daily candles.
  The score a trade carries is the latest weekly reading dated on or before its signal day.

## The rule (fixed now)

Day i, closes known at its end:
- EMA20 and EMA50 of the daily closes (seeded with the first close); ATR14 = the simple mean of the last 14 true ranges.
- **Long signal**: close(i) > the highest high of days i−20 … i−1, and EMA20(i) > EMA50(i). **Short**: close(i) < the lowest low
  of days i−20 … i−1, and EMA20(i) < EMA50(i).
- Entry at the open of day i+1. Stop = entry ∓ 2 × ATR14(i). Risk 1R = 2 × ATR14(i).
- Out at the close of day i+5 (the 5th day held), or at the stop: a day whose low (long) reaches the stop exits there, a day that
  opens through it exits at its open.
- One position at a time (a signal while a position is open is skipped); longs and shorts are separate streams.
- **Cost**: 0.0001 × the entry price a round trip (spread + commission; the demo measures about 0.00005) and, on longs, overnight
  financing `nights(entry, exit) × FIN.xau.long × entry` (`council/fills.mjs`, today's demo rate for every year). Shorts are not
  credited. R after cost = (side × (exit − entry) − cost) / 1R.

## Tests (Holm over T1 and T2)

- **T1 (longs)**: on 2007-01-01 → the data's last complete day, net R a trade > 0, calendar-month-sum t ≥ 2, positive in both
  halves (2007-2016 and 2017 → end), and above the 95th percentile of the placebo below.
- **T2 (the score's sizing claim)**: longs with score > +0.25 minus longs with score ≤ +0.25, net R a trade: Welch t ≥ 2.
- **Placebo** (for T1): 40 seeds; on every day with EMA20 > EMA50 and no position open, a long entry at the next open with
  probability equal to the real rule's signal rate on such days, the same stop, exit and cost.

PASS of the rule = T1 passes every check with Holm p < 0.05. T2 is judged on its own line. Shorts are reported, not tested.

## What would change nothing

A pass here is a replication on the author's own years, not an untouched test: at most a proposal for a forward record, never
a live rule without the owner. A fail means the rule book's execution layer is not supported on this data.
