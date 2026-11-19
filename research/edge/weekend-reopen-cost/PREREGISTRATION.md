# What a Sunday-reopen fade really costs: the spread at Rule G's entry and exit. Pre-registration

Written and committed **alone, before** any `.mjs` file of this folder exists, before any spread was turned into a cost and
before any trade was re-costed (14 Nov 2026). Everything below is fixed here; anything added later is labelled post hoc in
`RESULT.md`.

Cost measurement only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant, mirror setting or API
changes, whatever the outcome. No rule is tested: Rule G's entries and exits are taken as the three studies booked them.

## What this is

Rule G (the forex Sunday-reopen gap fade) was tested three times, every time with an **assumed** quoted spread:

| Study | Branch | Headline test (decisive) | n | net R a trade | monthly t | assumed quoted spread |
|---|---|---|---|---|---|---|
| #880 | `fx-weekend-gap` | Rule G, six majors, 2020 to now | 243 | +0.194 | 2.14 | 0.3 pip |
| #928 | `fx-weekend-gap-replicate` | R1, six crosses, 2020 to now | 294 | +0.238 | 2.99 | 0.4-1.3 pip by pair |
| #938 | `fx-weekend-gap-replicate2` | S2, six new pairs, 2016 to now | 481 | +0.153 | 3.19 | 0.3-1.0 pip by pair |

Secondary tests, reported the same way, not in the verdict: #880 Rule G 2016-19 (n 173), #928 R2 (n 297), #938 S1 (n 588).

All three use #880's `run.mjs` cost, byte for byte (`costPx`): a round trip in price =
`pip x (SPREAD_PIPS + 2 x SLIP_PIPS) + 2 x 22.5e-6 x entry`, slippage 1 pip a side (base), 2 pips a side (stress).

**When Rule G trades** (read from the frozen code, `weeks()` and `ruleG()`): the reopen candle is the first OANDA mid M5
candle starting at or after Sunday 17:00 New York; Rule G **enters at that candle's close**, i.e. at **Sunday 17:05 New
York** (22:05 UTC while New York is on standard time, 21:05 UTC on daylight time) or 5 minutes after a later reopen candle
(the week is skipped when the reopen candle starts at or after 21:00 New York). It **exits** at the stop or the target on the
first later M5 candle that reaches it (stop first; a candle opening beyond the stop exits at its open), else at the close of
the last M5 candle ending by Monday 12:00 New York. So the entry is at the widest-spread minute of the forex week and the
exit any time from Sunday 17:10 to Monday 12:00 New York.

## Spread sources looked for (listed before any cost was computed)

To find out what exists, the sources below were opened and their contents listed; the raw reads of the one reopen in (b)
were seen while checking which minutes they cover. No spread was converted to R, no trade was re-costed and no break-even
was computed before this file was committed.

- **(a) The site's candle proxy** (`/md/bars`, `api/bars.js`): it asks OANDA for **mid prices only** (`price: 'M'` is
  fixed in the request and the answer keeps `c.mid` alone). It cannot return bid or ask candles. It is **not modified**
  (this study touches no `api/` file). OANDA's own API does serve bid / ask candles (`price=BA`) back to 2005, so a
  proxy that passed that through would cover every Sunday of every pair of the three studies (at OANDA's spread, not the
  demo broker's): that is an owner decision about the API, outside this study.
- **(b) The demo broker's quotes**, council-data `ctrader/symbols.json`: per symbol a `bid`, `ask` and `quoteAt` per
  council round, and since 12 Nov 2026 a `spreadLog` (the last 300 reads). Its git history on `origin/council-data` (906
  commits, the first on 7 Nov 2026 21:05 UTC) gives every round's quote since then. Forex symbols in it: **EUR/USD,
  GBP/USD, AUD/USD, USD/CAD, USD/CHF only** (no JPY pair, no cross, no NZD/USD). Sunday reopens inside the history: **one,
  8 Nov 2026**; reads come about every 5-10 minutes (the council loop's rounds), so a read lands near, not at, a minute.
  The next reopen (15 Nov 2026) is after this study.
- **(c) Anything else in council-data with timestamps and spreads**: none. `research/candles/*` are HistData M1 candles (one
  price, no spread); `research/probe/*-1m.json` are Kraken OHLC (no spread); `trades.json` carries `costR` / `costSrc`
  (the cost model's output, not a quote); `snapshot.json` and `config.json` mention spreads only as model figures or text;
  the mirror and account files hold fills, not quotes.

## The measurement (fixed)

Source (b) only (the only real bid / ask on file). One read = one distinct (symbol, `quoteAt`) with `bid` and `ask`, from any
copy of `ctrader/symbols.json` in the history; spread = `ask - bid` in pips (pip = 10^-`pipPosition`, i.e. 0.0001 for these
five). For each Sunday reopen in the history and each pair:

- **Entry spread** = the read nearest Rule G's entry minute (reopen + 5 min: Sunday 17:05 New York) within **±10 minutes**
  of it (the read before it when two are equally near).
- **Exit spreads** = reads between Sunday 17:10 and Monday 12:00 New York; for each re-costed trade, the read nearest its
  exit time within ±10 minutes.
- Reported per pair and per year: the number of reopens with an entry read, the median and the 90th percentile (the
  nearest-rank value at 0.9 x n, rounded up) of the entry spreads and of the exit-window spreads.

**A pair is measured** when the source holds an entry read for **at least 20 distinct Sunday reopens**. For a measured pair
the base entry spread of a trade is the pair's median for that trade's year, or the pair's median over all years when that
year has fewer than 5 reopens; the stress entry spread is the 90th percentile chosen the same way. Exit spreads likewise,
from the exit-window reads (a pair-year with fewer than 5 reopens uses all years).

## The re-costing rule (fixed)

`frozen.mjs` = #880's `research/edge/fx-weekend-gap/run.mjs` **byte for byte** (the same file #928 and #938 copied), sha256
`3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273`, pinned by the test; nothing in it is edited and nothing
is imported across branches. Re-costing needs no candle: Rule G's entries, stops, targets and exits do not depend on the
cost, so each study's own published trade list (`result.json` `trades`: pair, Friday, side, entry, risk in pips, exit,
exit kind, gross R, base net R, stress net R) is re-costed.

- **Gate (before any re-costed figure is read)**: for every trade of the six tests, `R − frozen costPx(pair, entry) /
  (r0Pips x pip)` with the study's own quoted spread for that pair equals its published base net R within 0.0001 (the
  published rounding), and the frozen `stats()` on the published rows reproduces each study's published n, gross R, base
  net R, stress net R, trade t and monthly-sum t exactly. If the gate fails, the study stops and RESULT.md says so.
- **Re-cost**: the quoted spread `SPREAD_PIPS` of the frozen formula is a round-trip spread charged once; with mid-price
  fills a trade crosses half the spread at the entry and half at the exit, so it is replaced, trade by trade, by
  **(entry spread + exit spread) / 2** (measured, base = medians, stress = 90th percentiles). Slippage (1 pip a side) and
  commission (22.5 per million a side) unchanged. Net R = published base net R + pip x (assumed spread − new spread) /
  (r0Pips x pip). Statistics by the frozen `stats()` (n, net R a trade, trade t, monthly-sum t).
- **A study is re-costable** only when every pair of its headline test is measured. A pair that is not measured is never
  given a guessed, borrowed or extrapolated spread.

## Verdict (wording fixed in advance)

- **NOT MEASURABLE**: no study is re-costable (no real spread source covers the reopen for the pairs and years the headline
  tests trade). RESULT.md then says exactly what is missing and what would be needed.
- Otherwise, on the re-costable studies: **SURVIVES** if every re-costable study's headline test keeps net R a trade > 0
  **and** monthly-sum t ≥ 2 at the measured median; **DOES NOT SURVIVE** otherwise. If only some studies are re-costable,
  the verdict names which were judged and which were not.

Whatever the verdict, nothing is called an edge.

## Also reported (not in the verdict)

- **What one weekend shows** (descriptive, n = 1 reopen): the 8 Nov 2026 reads of the five pairs, the read nearest the
  entry minute and the reads of the first hour, against each pair's assumed quoted spread; the exit-window reads' median and
  90th percentile.
- **Break-even spreads** (pure arithmetic on the frozen formula, no measurement): for each of the six tests, the round-trip
  spread cost `C` = (entry spread + exit spread) / 2 in pips, the same for every pair of the test, in place of the assumed
  one, at which (1) net R a trade reaches 0 and (2) the monthly-sum t falls to 2 (found by bisection, 0.01 pip). Read with
  the raw-spread account's measured outside-rollover median of 0 at the exit (CLAUDE.md "Forex spreads"), an entry spread of
  `2 C` is the break-even. These say how wide the reopen spread may be, not how wide it is.

## Files

`frozen.mjs` (byte copy, pinned), `run.mjs` (`node run.mjs run <council-data quotes json> <dir of the three result.json>` →
`result.json`; the quotes are extracted from the history of `ctrader/symbols.json`, kept outside git), `RESULT.md` (verdict
first), `result.json`, `tests/weekend-reopen-cost.test.mjs` (offline: the frozen hash, the spread measurement on a hand-made
bid / ask series, the re-costing arithmetic, RESULT.md against result.json).
