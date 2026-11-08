# Meridian X

**A trading desk run by an AI council: gold, FX and index futures, paper-traded around the clock and tested before trusted.**
Live at [meridianx.dev](https://meridianx.dev). Paper trading and demo accounts only. Not financial advice.

## What it is

Meridian X is a web app with three desks behind one sign-in. You switch between them from the header.

| Desk | What you do there |
|---|---|
| **Desk** | Watch the markets, the council's trades, the charts and your account |
| **Macro** | Read the macro view: the strategist, the veteran, their predictions and the pros' data |
| **ChronosTrade** | Practise trading by replaying past markets candle by candle, including prop-firm challenges |

## The AI council

A group of automated "members" that run every few minutes on GitHub Actions. Each one has a single job:

- **Analyst**: reads market structure on every timeframe, from the daily (D1) down to the 1-minute (M1): breakouts, origins and the next setup.
- **Trader**: places, manages and closes **paper** trades on the setups. Every trade has a stop-loss, with no exceptions.
- **Coach and reviewers**: review losses, track mistakes and suggest rule changes. The owner decides on any change.
- **Macro strategist**: fetches yields, the dollar, Fed pricing and positioning data, then runs the tested **Gold Macro Score**. That score is the only macro direction signal that held up on 20 years of data.
- **Macro veteran**: argues with the strategist topic by topic and gives **dated week and month calls with a % chance**. It keeps a forecast ledger, so its accuracy is scored.
- **COT desk**: shows what the big speculators hold in each market and how that changed week on week. It tests whether that positioning has an edge before calling it one.
- **Watchdog and data health**: alert when a feed or the loop breaks.

Trades are copied to a **cTrader demo account** at the same time: limit orders, stop-loss and take-profit, own orders only. They are never copied to a live account.

## Separate edges

- **ICT desk**: an H1 iFVG reversal model on index futures and gold, kept apart from the council's rules.
- **LIT and NQ desks**: paper "shadow" streams for other approaches, tracked but not mixed in.
- **Gold playbook**: a dashboard for the owner's gold skill.

## ChronosTrade (backtesting)

A TradeZella-style replay lab:
- Smooth candle-by-candle replay at 1×–12× speed, plus a jump to any date.
- Drag-to-place orders: entry, stop-loss and take-profit lines, with risk sized as a % of the account.
- Drawings: lines, trend lines and zones. Higher-timeframe context, session shading and previous-day levels.
- **Prop-firm simulations**: FTMO, Funding Pips, Topstep and Lucid rules, checked on every bar.
- Analytics: journal, mistakes, sessions, a Monte Carlo of your results and the best risk per trade.
- Full screen with floating docks, a quick Buy/Sell bar on the chart, and effects and sounds on wins and stop-outs.

## Members

The owner invites members and sets per-member permissions: what each one can see and do. Guests get a public view with a live gold chart and the P&L calendar. Fred has a built-in MCP key, so ChatGPT can read the ICT trades and rules and propose changes as pull requests.

## Ground rules

- Paper trading and demo accounts only. No live money.
- Every trade has a stop-loss.
- Backtests cover 2020 to now. A signal is called an edge only after it passes a test on data it wasn't designed on.
- Live trading rules change only when the owner approves.

## Under the hood

Static pages served by Vercel, with serverless functions under `/api` and private Blob storage for users and profiles. The council runs on GitHub Actions and publishes its data to the `council-data` branch. Prices come from an OANDA proxy, with Kraken as a fallback. Working notes for developers are in `CLAUDE.md`.
