# Mosha council

Three roles work the Mosha market-structure setups:

| Role | Runs | What it does |
|---|---|---|
| **Analyst** | Claude, Mondays | Reads the week's snapshot of every market and writes `analysis/latest.md`: bias per market, key levels, which setups are likely, news to watch. |
| **Trader** | GitHub Actions, every 15 min (`.github/workflows/council.yml`) | Runs `council/trader.mjs`: the same engine as the page (`council/engine.mjs`), paper-trades every Ready setup, manages fills, stops and targets, writes `trades.json` and `snapshot.json`. |
| **Coach** | Statistics daily in the trader job, plus a Claude daily review | Pauses losing setups, tunes the stop buffer and minimum reward:risk inside fixed limits, logs every change in `config.json` → `history`, and writes `reviews/latest.md`. |

All results live on the `council-data` branch. Limits the Coach may change on its own:
stop buffer 0.10–0.25 × ATR, minimum reward:risk 1.2–2.5, pause a setup for up to 7 days.

`council/engine.mjs` is generated from the market-structure page's engine; regenerate it when the page's setup rules change.

## Scorecard

The Council page groups closed paper trades by setup and by market. A verdict needs at least 5 trades: "trust" averages more than +0.2R a trade, "avoid" loses more than 0.2R.
