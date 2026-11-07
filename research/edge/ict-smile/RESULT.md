# ICT A-setups x Dollar Smile: out-of-sample test of the #507 lead

**Status: pending.** The test runs on GitHub Actions (`.github/workflows/ict-smile.yml`) when this change reaches `main`, because
FRED and Cboe are blocked in the sandbox. It writes council-data `research/ict-smile.json` and `research/ict-smile.md`. This file
will be replaced by the result, whatever it is.

## What is tested

- **Hypothesis (one).** A-setups taken when the Dollar Smile (council/macro.mjs, unchanged) is on its **left or right** side
  lose money. The proposed paper filter `nosmilex` drops them.
- **Bar.** The dropped trades need all three: n ≥ 30, t ≤ −2, and mean R < 0 in both halves.
- **Pre-registration.** `preregistration.md`, committed (9a113d62, pushed to `claude/ict-smile` first) before any out-of-sample trade was generated or classified.

## Trades

- **Count.** 1,137 closed A-setups whose signal closes between 1 Jan 2018 and 31 Jul 2025. #507's sample starts on 4 Aug 2025,
  so no trade is shared.
- **By market:**
  - GC: 456, XAUUSD spot, gold A-rule.
  - NQ: 339, NAS100 cash, index A-rule.
  - ES: 342, SPX500 cash, index A-rule.
- **Code.** Built by the ict-universe code (`universe.mjs`, the desk's own `signals()` / `isASetup()` / `sizeOf()` /
  `simulate()`) on the HistData M1 files in council-data `research/candles/`.
- **Change to that code.** Its only change is an extra last column, each trade's exit time, which the halves need.
- **R.** The primary R is gross R x size, as the replay stores it. Net of costs is reported as a sensitivity.

## Files

- `preregistration.md`: the hypothesis, the bar and the classification, fixed before the run.
- `build.mjs`: writes `trades.json` (the trades, with no regime) and `fx-daily.json` (EUR/USD, USD/JPY, GBP/USD, USD/CAD and
  USD/CHF UTC-day closes from HistData, for macro.mjs's DXY).
- `analyse.mjs`: fetches FRED from 2017 on (falling back to Cboe for VIX), classifies each trade with macro.mjs's
  `features()` / `drivers()`, then tests H and writes the tables. Usage: `node research/edge/ict-smile/analyse.mjs [outDir]`.
- `tests/ict-smile.test.mjs`: synthetic checks of the classification, the lag (no look-ahead), the bar and the
  incomplete-data path.
