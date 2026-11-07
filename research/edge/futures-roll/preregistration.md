# Pre-registration: contract rolls in the ICT desk's CNBC continuous futures (data integrity)

Written on 7 Nov 2026, **before any CNBC candle around a roll was looked at**. This is a data-integrity check, not an edge test:
no trading rule is searched for and no rule changes. Nothing below may change after the first measurement.

## Question

The ICT desk (`ict/tracker.mjs` `cnbcBars` / `feed`, `ict/replay.mjs` `history`) reads CNBC continuous front-month futures
(`@ND.1`, `@SP.1`, `@DJ.1`, `@TFS.1`, `@GC.1`, path `.../adjusted/EST5EDT.json`). When the front month changes, an unadjusted
continuous series steps by the calendar spread (roughly +0.6 to +1.0 % for the index futures each quarter, +0.4 to +0.7 % for
gold every two months). Such a step can fake a sweep, an FVG or an inversion in `signals()`, move the daily bias /
premium-discount / ATR features, and hit or skip stops in `simulate()` / `manageTrade()`. Does that happen in the candles the
desk uses?

## Data (fixed now)

- **CNBC**, fetched by the one-off GitHub Actions workflow `.github/workflows/futures-roll-data.yml` (CNBC refuses this sandbox),
  saved raw to council-data `research/futures-roll/cnbc.json.gz`: 1H from 1 Jan 2025 in 10-day requests (as `replay.mjs`), 5M
  from 1 Mar 2026 in 2-day requests, 1D from 1 Jan 2024; for the five `.1` symbols with the desk's `adjusted` path, the same `.1`
  1H/1D with `unadjusted`, and the `.2` (second month) 1H/1D where CNBC serves it. Raw bars, no filter; the desk's halt / shut
  filters (`inHalt`, `cmeShut`) are applied in the analysis.
- **Cash reference**: OANDA mid 5m (NAS100, SPX500, US30, XAU/USD) through `meridianx.dev/md/bars`, aggregated to H1. RTY has no
  OANDA symbol: its rolls are measured from `@TFS.2 - @TFS.1` if CNBC serves `.2`, otherwise from its own close-to-open gap at
  the scheduled roll against its non-roll gaps (reported as weaker evidence).
- **Replay trades**: council-data `ict/replay.json` (1 Aug 2025 - 7 Nov 2026) at council-data commit `475f6bc3` (7 Nov 2026 21:28 UTC).

## Roll calendar (expected windows, fixed now)

- NQ, ES, YM, RTY: quarterly (Mar, Jun, Sep, Dec). CME roll date = the Thursday 8 calendar days before the 3rd-Friday expiry;
  window = Monday of the roll week through the expiry Friday (a vendor may switch at either end).
- GC: active months Feb, Apr, Jun, Aug, Oct, Dec. Window = the 10 business days before the first business day of the
  delivery month (first notice is the last business day of the month before; volume moves earlier).

## Measurement (fixed now)

1. **Basis** per H1 candle = CNBC H1 close - OANDA H1 close at the same timestamp (both after the desk's halt/shut filter).
   Daily basis = median of that NY day's H1 bases.
2. **A roll is detected** where the daily basis changes from one day to the next by more than
   max(6 x the median absolute day-over-day change of that market's daily basis, 0.15 % of price). Every detected step is
   listed whether or not it falls in an expected window; a step outside a window is reported as "unexplained".
3. **Roll hour**: within the detected day pair, the first H1 candle whose basis differs from the median basis of the 24 candles
   before it by more than half the step.
4. **Jump size** = median basis of the 24 H1 candles after the roll hour - median basis of the 24 before, in points, % of
   price, x the H1 ATR(48) and x the daily ATR(14) at the roll.
5. The same steps on `adjusted` vs `unadjusted` and `.2 - .1` say whether CNBC back-adjusts and when it switches.
6. Daily candles: the roll day's 1D candle is checked the same way against OANDA daily closes.

## Which replay A-setups "touched" a roll (fixed now)

For each detected roll hour `tR` and each replay A-trade (`aset: true`, signals after CNBC's first candle, i.e. not
`cash: true`):

- **signal touched**: `tR` lies in the candles `signals()` used for it: from the swept swing's candle (`<= 96` H1 before the
  sweep; taken as `sweep.t - 96 h` when the swing time is not stored) through the inversion candle (`signalAt`); or the D1
  features (bias SMA50, 20-day range, ATR14) include the roll day.
- **exit touched**: `tR` lies between `signalAt` and `closed`.

Every such trade is listed with its R, and with the R and A-status it gets on corrected data.

## Verdict rule (fixed now)

- **Real** if at least one detected roll step in the series the desk reads is larger than the 95th percentile of the absolute
  non-roll H1 close-to-next-open gaps of that market AND at least one replay A-setup (signal or exit) touched it, OR a step in
  the live window (last 24 days, `feed()`) would do the same at the next roll.
- Otherwise **nothing is wrong**: write that with the evidence and change no code.

## Fix, if real (data layer only, fixed now)

- **Back-adjust** (standard Panama method): in the candle loaders (`feed()` / `history()`), every bar before a detected roll is
  shifted by the measured roll spread (additive, points), so the series is continuous in the CURRENT contract's prices. The
  step is measured inside the data layer from CNBC alone (`.2` vs `.1` overlap, or the scheduled-window gap), never from OANDA,
  so the live desk keeps a single source. Nothing in `signals()`, `isASetup()`, sizing or exits changes.
- Open live trades are stored in the contract prices at entry; if one spans a roll, its levels are shifted by the same spread
  (the only non-candle change, and only if the data show the case can occur).
- **Proof**: chained tracker runs old vs new code on a stubbed CNBC feed built from the CNBC dump (as #504/#505), every 2 h
  across every roll in the dump; every difference in trades.json / snapshot.json / bars.json is listed and must lie within a
  roll's reach (signal window or open trade). Replay old vs new on the same dump: every A-setup that appears, disappears or
  changes R is listed in RESULT.md and the PR. Tests for the roll detector and the adjustment are added.
