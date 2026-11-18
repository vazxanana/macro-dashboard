# Pre-registration: the Gold daily engulf rule on silver (17 Nov 2026)

Written and committed alone, before any silver trade or figure of this study is computed. The owner's brief is
`docs/owner-decisions.md` item 59 ("the one rule question item 44 does not block: does the Gold daily engulf work on
silver?"). Research only: no live rule, Trader code, config, mirror or ICT file changes, whatever the result.

## Question

Does the live Gold daily engulf rule (`geg`), unchanged but for the price scale of its one fixed-dollar buffer, make money
net of costs on silver (OANDA XAG/USD) out of sample?

Prior: low. The Gold trend rule failed on 13 other markets (`trend-breadth-h1`, 0 of 14); the playbook long's cuts held on
silver only without a month-sum t (`gold-drd-silver`); the engulf's own gold record is under t 2 on untouched data
(`supported-book`, engulf +0.141R a position after financing, n 256, t 1.46).

## The rule, copied from the Trader (council/trader.mjs, block `config.goldEG`, as on 17 Nov 2026)

Parameters `config.goldEG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }`.

- **Days:** the closed UTC daily candles, Saturday and Sunday candles (OANDA's Sunday reopen stub) folded into the next
  weekday (`council/fills.mjs` `foldWeekend`, imported); "last" = the last closed trading day.
- **Freshness:** an order may be placed only within 24 h of the reopen after the signal day's end (`gegFresh`: Monday to
  Thursday the day end, Friday the Sunday reopen), and never while spot is shut.
- **Signal:** more than `sma + k + 2` = 25 trading days on file; the last day is green; walking back up to `k` = 3 days, the
  first red day is the base, and the signal needs the last close above the base's HIGH (no opposite candle in between: the
  walk stops at the first red one, as the block's code does); the last close is above the 20-day average of closes.
- **Order:** a limit buy at the base high, stop at the base low minus `pad`, target 10R, valid 20 days; only placed when the
  price now is above the entry and the open / pending count of the system is under `maxOpen` = 3; one order per base day (id).
- **Zone cancel:** a pending order is cancelled when a newly closed trading day closes under the base low.
- **Management** (the live "Manage open trades" loop, as in `research/edge/gold-weekend/replay-intended.mjs`): fills when an
  M5 candle trades at or below the limit (a fill and the target in one candle = missed, 0R), stop first, a gapped stop fills at
  the candle's open (`stopFill`), target 10R, from +2R the stop trails 1R behind the best price, out 240 h after the fill at the
  M5 close; candles in `spotSkip` (weekend shut, rollover minutes) neither fill nor stop.
- **Harness:** the `geg` block of `research/edge/gold-weekend/replay-intended.mjs` (the code path of the 12 Nov trading-day fold,
  which the live block was made equal to, item 52), run alone: one run at the close of every M5 candle, entries checked with the
  price of the candle in progress. Its folding of weekend days and its freshness window equal `foldWeekend` / `gegFresh`; the
  harness imports `foldWeekend` and `spotClosed` / `spotSkip` / `stopFill` / `exitR` / `fillBarAmbiguous` / `nights` from
  `council/fills.mjs`.

### What changes for silver (fixed now, before any run)

- **`pad`:** gold's $0.30 becomes **$0.004** on silver, the same scale `gold-drd-silver` used for the same $0.30 buffer
  (about gold / silver ≈ 75). Prices rounded to **4 decimals** (the Trader's `Math.max(2, dec + 1)` with silver's 3 display
  decimals; OANDA quotes XAG to 4). Nothing else changes: k, life, hold, sma, maxOpen, 10R, the 2R / 1R trail are as on gold.
- **Brief vs rule:** the brief asked for "one position at a time"; the live rule allows up to three open or pending orders. The
  rule is tested as it is (maxOpen 3). One position at a time (maxOpen 1) is **reported only**, never part of the verdict.

## Data

OANDA mid XAG/USD M5 and D1 (and XAU/USD for the gate), March 2006 to 17 Nov 2026, through the site's keyless candle proxy
(`fetch.mjs`), kept out of git. No candle of any window is read before this file is committed.

## Costs (charged per position on its initial risk r0)

- **Round trip:** the demo broker's `ctrader/symbols.json` (council-data, 17 Nov 2026) has no XAGUSD symbol, so its spread and
  commission cannot be read. A stated conservative figure is used instead: **0.10 % of the entry price a round trip** (the
  repository's silver figure in `trend-breadth` / `trend-breadth-h1`: about $0.03 at $30 silver, against a raw-account silver
  spread of $0.02-0.03), charged as cost / r0. x2 doubles it.
- **Financing:** silver longs pay **0.015 % of the entry price for every rollover night** (`council/fills.mjs` `nights`:
  Monday-Friday 22:00 UTC, Wednesday three), charged as nights x 0.00015 x entry / r0. Source: the `trend-breadth` /
  `trend-breadth-h1` assumption for a non-gold long (5.5 % a year); not measured on the broker (no silver swap on file).
- **x1** = the round trip once + financing; **x2** = the round trip twice + financing.

## Windows (a position belongs to the window of its entry: the fill time)

- **Replication:** entries 2006-07-01 to 2019-12-31.
- **In sample (IS):** entries 2020-01-01 to 2023-12-31.
- **Out of sample (OOS):** entries 2024-01-01 to the data's end (17 Nov 2026). A position still open at the end is marked at
  the last M5 close and flagged.

## Test statistic

**OOS calendar-month-sum t**: every calendar month of the window is one value, the sum of the x1 net R of the positions of
that window closed in that month (a close after the window's end counts in its last month; a month with no close is 0);
t = mean / sd x sqrt(months). Per-position t, win rate, R a position and drawdown are reported beside it.

## Pass bar (all five on x1 unless said)

1. OOS mean net R a position > 0;
2. OOS month-sum t >= 2.0;
3. IS mean net R a position > 0;
4. OOS mean net R a position > 0 at **x2** costs;
5. OOS has at least 30 positions (fewer = FAIL, too few to judge).

One market, one rule, one test: no multiple-testing correction. The replication window is reported and read in words (a
pass with a negative replication is called regime-bound in RESULT.md); it does not change the verdict.

**A PASS makes the rule on silver a paper shadow to watch, never live.** A FAIL is said plainly and nothing is tuned.

## Parity gate (before any silver figure is read)

The same harness, with gold's own parameters (pad $0.30, 2 decimals, a flat $0.30 a round trip, no financing, M5 cut at
2026-11-07), must reproduce the committed gold engulf figures of `research/edge/gold-weekend/result.json` (`geg`, "intended"):
2006-07-01 to 2017-12-31 n 247, +0.207R a position; 2018-01-01 to 2026-11-06 n 176, +0.326R. **Gate: in each window n within
3 % and R a position within 0.03R.** If the gate fails, no silver figure is interpreted and the study reports "harness not
validated" (the figures go to result.json under `uninterpreted`).

## Reported, never part of the verdict

Gross R; R without financing; maxOpen 1; each year; the replication window's month t; the share of stops at the base
low; the median stop as a share of price.
