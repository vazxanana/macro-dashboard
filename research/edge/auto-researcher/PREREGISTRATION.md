# Auto-researcher: five workers searching rule combinations around the clock (pre-registered 24 Nov 2026)

Written and committed alone, before the engine ran. Paper research only: nothing here trades, alerts or changes a rule. Results
go to council-data `research/auto/`, never to main.

## Why

The owner asked for a researcher that never stops, tries "a million simulations of different combinations" and thinks out of the
box, with five workers. A million tries on the same years WILL produce winners by chance, so the protocol below counts every
try and makes a winner prove itself on years it was never searched on.

## The search

Five workers (GitHub Actions jobs, `researcher.yml`), each a seeded random generator of rules over H1 OANDA mid candles of ten
markets (xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag), costs from `research/edge/_lib/edgekit.mjs` `COSTS`
(round trip, charged in R), entry at the next open after the signal, stop first when one candle holds both, a candle opening
beyond the stop exits at its open, one position at a time per rule.

A rule = trigger + filters + exit. Triggers (the worker's family): **brk** (close beyond the prior N-bar high / low, followed),
**fade** (the same, traded the other way), **pull** (a moving-average trend with an RSI pullback), **big** (a candle over k ATR,
faded or followed), **blk** (a break of the previous clock block's range, followed or faded), **dev** (a close z ATR from its
moving average, faded or followed), **eg** (the owner's engulf: a candle closing beyond the high / low of the nearest opposite
candle within the 3 candles before it, first close only; followed or faded), **sweep** (a wick through the prior N-bar high
or low that closes back inside: traded as the reversal, or against it), and for the "wild" worker two triggers that must agree on the side. Filters: UTC hour
window, weekdays, trend with / against the 200-bar average, ATR percentile below / above. Exit: stop 0.5-3 ATR, target 0.5-6R or
none, a time limit of 4-240 candles. Side: long, short or both. The grids are in `engine.mjs` (`SPACE`); nothing is added after
a run starts.

Workers: 1 brk + fade + eg, 2 pull + dev, 3 big + blk + sweep, 4 all families, 5 wild (two triggers). Seeds differ by worker and by chunk. Version `auto-1`; adding the `eg` and `sweep` triggers happened before any run.

## The three stages (windows by entry date)

- **Stage A, search: 2005-2014.** Every try is scored here. It survives with n >= 250, mean net R >= 0.04 and a month-sum t >= 3.0.
- **Stage B, validation: 2015-2019.** A survivor needs n >= 100, mean net R > 0, month-sum t >= 1.5, and its side-flipped twin
  (placebo) must have mean net R < 0 on A. Passing A and B = a candidate.
- **Stage C, holdout: 2020 to the day of the run.** Never searched. Candidates are grouped by market, trigger and side; ONE
  member per group, the first to reach C, is looked at on C, once. Pass: n >= 100, mean net R > 0, month-sum t >= 2.0, and a
  Holm-adjusted p < 0.05 over every group looked at on C so far.

## What is counted and reported

Every worker's counters: tries, A survivors, B candidates, C looks, C passes; the trial count is the SUM over workers. With T
tries the chance count at A is roughly T x 0.0013 (one-sided p at t 3), at B about 7 % of those, so the file reports the
expected number of chance candidates beside the real one. A C pass is the only thing called a **lead**, never an edge: a lead
goes to a pre-registered forward record before anyone trades it.

## Honesty rules

No threshold, grid, window or stage changes after a run starts; a change is a new version (`VERSION`), counted separately.
Results are never edited. The ledger keeps every C look, passes and fails. A rule that depends on a stop being absent is not
generated: every rule has a stop.

## Four more workers (25 Nov 2026, owner: "add more 4 helpers to the researcher to speed it more")

Workers 6-9 join workers 1-5, **version `auto-1` unchanged**: the same grids, windows, bars, stages and Holm rule; nothing in the
search space, a threshold or a stage changed. Only the seeds differ (`worker * 1000003`). Their families: 6 and 7 wild (two
triggers that must agree, the largest space), 8 all families, 9 big + blk + sweep. This is more tries, not another search:
every try is still counted and the report sums all nine files, so the chance count and the Holm correction over every C look
grow with the tries. A group that two workers both reach is looked at once per worker file and each look counts in Holm. No
result so far is edited or discounted by the change.


## Two market-structure workers (26 Nov 2026, owner: "Tell the researcher to look the edges following market structure")

Written and committed before any structure rule is run. Workers **11** and **12** join; the windows, bars, three stages, the
one-look-per-group rule, the costs and the Holm rule over every C look of every file are unchanged, and workers 1-10 draw
exactly the rules they drew before (their generator is not touched). The search space GROWS by three triggers and one filter
that only workers 11 and 12 can draw, so their tries are a new part of the search: they are counted in the same totals and the
same Holm correction (which makes every lead's bar stricter, never looser), and their looks are told apart by the worker number.

**Structure, from closed H1 candles only.** A swing high is a candle whose high is strictly above the highs of the `P` candles
before it and at or above the `P` after it (swing low mirrored); it exists only once its `P`-th following candle has closed. The last
confirmed swing high and swing low not yet closed beyond are the two levels. A close above the swing high is a break up, a
close below the swing low a break down; a broken level is spent. The structure's direction is the direction of the last break.
- **bos** (break of structure): a break in the direction the structure already had (continuation). Followed or faded.
- **choch** (change of character): a break against the direction the structure had (the first break the other way). Followed or faded.
- **mspb** (pullback in structure): with the structure up, a candle that is not a break, closes above its open, and whose low
  has retraced at least `d` of the leg from the leg's origin (the lowest low between the broken swing high's candle and the
  break) to the highest high since the break, without trading below that origin: a buy. Mirrored for a sell.
- Filter **ms** (the larger structure): the direction of the same structure read with a larger swing size `msP`; a rule may
  require its side to agree with it (`with`), to oppose it (`against`), or not read it (`none`).

Grids, fixed now: `P` in {2, 3, 5, 8}; `d` in {0.382, 0.5, 0.618, 0.786}; `msP` in {8, 12, 20, 30}; `ms` none / with / against
(with twice as likely as each other). Every other filter, exit and side grid is the one of `SPACE`.

Worker 11: one structure trigger. Worker 12: a structure trigger together with a second trigger that must agree on the side
(another structure trigger with a different `P`, or one of the eight older kinds). Markets: the ten of `MARKETS` and the Nasdaq
100 (`nas100`, at the NQ worker's cost setting: none charged, so every Nasdaq figure is BEFORE costs). A lead from these
workers is, like every lead, re-priced at the broker's own quotes before it means anything.

Runner budget: the workflow already uses the 20 jobs a free plan allows, so workers 7 and 9 (duplicates of 5 / 6 and of 3)
stop drawing and their runners go to 11 and 12; the files of 7 and 9 stay and are still counted.

## Version auto-2: EG, EF and BO only, 2019 to now, t above 1 (26 Nov 2026)

Owner, 26 Nov 2026: "save what we got now and make it focus only in EG EF BO, and i only want results from 2019 till today t
above 1 is okey". Written and committed alone before the engine changes. `auto-1` stops here and is kept: its worker files are
copied to council-data `research/auto-1/` and its last report is committed as `auto-1-final.json`; nothing of it is counted in
`auto-2`.

**What changes**

- Triggers, four kinds only, on H1 candles, all read from closed candles:
  - `eg`: an engulf completes at this candle (the engine's existing rule: the nearest opposite candle within the 3 before, this
    close the first beyond its high / low): trade its direction.
  - `egr`: the first return to a standing engulf zone (the base candle, wick to wick; alive `life` candles, until a close through
    its far side): this candle trades into the zone and closes back out on the engulf's side: trade the engulf's direction.
  - `ef`: an engulf zone fails: this candle is the first to close through the far side of a standing zone: trade the direction of
    the failure.
  - `bo`: a close beyond the last unbroken swing (`P` candles a side, known `P` candles later; the structure code of workers 11
    and 12): any break, or only a break with the structure, or only one against it. Trade the break's direction.
  A rule is one trigger or two that agree on the same candle. Grids: `life` 12 / 24 / 48 / 96, `P` 2 / 3 / 5 / 8.
- Filters and exits: the same grids as `auto-1` (entry hours, weekdays, 200-hour trend, volatility, stop 0.5-3 ATR, target 0-6R,
  time limit). Markets: the ten of `auto-1` and the Nasdaq 100 (before costs, as worker 10); worker 10 stays Nasdaq only.
- Windows: only 2019-01-01 to now. Search 2019-2022, check 2023 to now (one look per group, a group = market, triggers with their
  settings, side, trend filter, stop and target).
- Bars (the owner's): search n >= 100, mean > 0, month-sum t >= 1, and the side-flipped twin negative; check n >= 50, mean > 0,
  t >= 1; and the whole of 2019 to now t >= 1. A rule that clears all three is a **result** and is listed with all three sets of
  figures.

**What a result is worth, said before any is seen**

A t of 1 is what one rule in six shows by luck in any window. Clearing it in the search window and again in the check window
happens by luck about once in forty tries with no edge at all, and the workers make about a hundred tries a second, so the list
will fill with chance results within minutes. The 2023-now window is also read once per group, and groups are numerous, so it is
not a clean holdout. A result of `auto-2` is therefore a list to look through, never an edge and never evidence by itself. The
strict reading is kept beside it: a **lead** still needs check-window n >= 100, t >= 2 and a Holm p under 0.05 over every check
look made in `auto-2`. Anything taken further is re-priced at the broker's own quotes first, as before.

## Version auto-3: engulf (EG) and engulf failure (EF) only, 2021 to now (27 Nov 2026)

Owner, 27 Nov 2026: "from now on focus only 2021 till today, specially engulfing eg and ef". Written and committed alone before
the engine changes. `auto-2` stops here and is kept: its worker files are copied to council-data `research/auto-2/` and its last
report is committed as `auto-2-final.json`; nothing of it is counted in `auto-3`.

**What changes**

- Triggers, four kinds, all engulf-based, on H1 candles read from closed candles only:
  - `eg`, `egr`, `ef`: exactly as in `auto-2` (an engulf completes; the first return to a standing engulf zone that closes back
    out on the engulf's side; the first close through a standing zone's far side, traded in the direction of the failure).
  - `efr` (new): the first return to a FAILED engulf zone. A zone that failed (`ef`) becomes a zone of the other side, alive
    `life` candles from the failing candle until a close back through it; `efr` = the first candle that trades into it and
    closes back out on the failure's side: trade the failure's direction (the "EF barrier" of the Engulfing desk, on H1).
  `bo` is dropped. A rule is one trigger or two of these that agree on the same candle. Grids: `life` 12 / 24 / 48 / 96.
- Filters and exits: unchanged from `auto-2`. Markets: unchanged (the ten and the Nasdaq 100 before costs; worker 10 Nasdaq
  only; the structure workers 11 and 12 draw the same engulf rules as every other worker now).
- Windows: only 2021-01-01 to now. Search 2021-2023, check 2024 to now (one look per group), and the whole of 2021 to now.
- Bars: unchanged from `auto-2` (search n >= 100, mean > 0, month-sum t >= 1, side-flipped twin negative; check n >= 50,
  mean > 0, t >= 1; 2021-now t >= 1 = a **result**; a **lead** = check n >= 100, t >= 2 and Holm p < 0.05 over every check look
  made in `auto-3`).

**What a result is worth, said before any is seen**

The same as `auto-2`: about one rule in forty clears the result bar with no edge, the windows are shorter (fewer trades, wider
noise), and 2021 to now has already been read by `auto-1`, `auto-2` and the Engulfing desks' studies, so none of it is a clean
holdout. A result is a list to look through, never an edge and never evidence by itself; anything taken further is re-priced at
the broker's own quotes first.

## Version auto-4: engulf and engulf failure across timeframes, higher-timeframe zones and entry types (28 Nov 2026)

Owner, 28 Nov 2026: "Keep researching and do many combinations entry eg ef timeframe etc". Written and committed alone before
the engine changes. `auto-3` stops here and is kept: its worker files are copied to council-data `research/auto-3/` and its last
report is committed as `auto-3-final.json`; nothing of it is counted in `auto-4`.

**What a rule is now** (every part drawn at random, seeded per worker and lane):

- **Working timeframe** `tf`: M15, M30, H1 or H4 (M30, H1 and H4 built from the same candles as M15: UTC-aligned, a candle kept
  only when at least half of its finer candles are there; H4 starts at 00, 04, 08 … UTC).
- **Triggers** on that timeframe: one, or two that agree on the same candle, of `eg`, `egr`, `ef`, `efr` exactly as in `auto-3`
  (zone life 12 / 24 / 48 / 96 candles of the working timeframe).
- **Higher-timeframe zone** (half the rules, else none): one of the timeframes above the working one (M30, H1, H4 or D1; D1 = the
  UTC day), kind `zone` = the newest engulf zone of the trade's side still standing on that timeframe, or `ef` = the newest failed
  zone still serving the trade's side; life 12 / 24 / 48 candles of that timeframe. The working candle must trade into it. Only
  higher-timeframe candles CLOSED by the working candle's close are read.
- **Entry**: `mkt` at the next open (as before); `lim` = a limit `k` x ATR(14) behind the signal close (k 0.25 / 0.5); `mid` = a
  limit at the middle of the signal candle. A limit lives 3 / 6 / 12 candles; a candle opening through it fills at its open; on
  the fill candle only the stop counts (never the target).
- **Stop**: `atr` = 0.5 / 0.75 / 1 / 1.5 / 2 / 3 x ATR(14) from the fill, or `cdl` = past the signal candle's far extreme by 0.1 x
  ATR (a fill already past that level is no trade). Target 0.5-6R or none, time limit in candles of the working timeframe, the
  filters (entry hours, weekdays, 200-candle average, volatility) and the costs as in `auto-3`.
- Group key: market, timeframe, triggers, the higher-timeframe zone, entry, stop mode, side, trend, stop size, target.

**Windows, bars, leads**: unchanged from `auto-3` (search 2021-2023, check 2024 to now once per group, 2021-now; a result = t >= 1
in all three; a lead = check n >= 100, t >= 2 and Holm p < 0.05 over every check look made in `auto-4`). Markets: the ten and the
Nasdaq 100 before costs; worker 10 Nasdaq only.

**What a result is worth, said before any is seen**: the space is about a hundred times larger than `auto-3`'s, so luck finds
more: about one rule in forty clears the result bar with no edge, and the lead bar's Holm count grows with every check. 2021 to
now has been read by every earlier version and the desks; none of it is a clean holdout. A result is a list to look through; a lead
is re-priced at the broker's own quotes, then judged forward. Never an edge on this file alone.

**Amendment, 28 Nov 2026, before any auto-4 result was read** (owner: "And choch"; the local trial burst started earlier was stopped
and its file deleted unread): the trigger list also takes `choch`, a change of character on the working timeframe: a close beyond
the last unbroken swing (2 / 3 / 5 / 8 candles a side, known only that many candles later) AGAINST the structure the breaks had
made (the market-structure workers' `struct`). Followed (trade the new direction) or faded, drawn at random. It can stand alone or
agree with an engulf trigger on the same candle, with every other part of a rule as above. Nothing else changes.
