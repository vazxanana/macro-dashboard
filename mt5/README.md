# MT5 bridge (CouncilBridge.mq5)

**Demo accounts only (12 Nov 2026, owner decision 45).** Every program in this folder checks the platform's own account-type flag (`AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO`) when it starts and again right before every order it sends. On a real or contest account it prints why in the log and stops itself (`ExpertRemove()`; `OnInit` returns `INIT_FAILED`) without sending anything.

Mirrors the council's paper trades on a MetaTrader 5 account. The council bot keeps running on GitHub Actions
exactly as before; every run it also writes `mt5/signals.csv` on the `council-data` branch (our live systems only:
gold replica, Mosha BO, crypto trend, with their adds; the NQ open run is included but the feed is ~10 min late,
so it is off by default). The Expert Advisor polls that file every 30 s and mirrors it:

| council record | EA action |
|---|---|
| `pending`, limit (Mosha BO) | buy/sell limit at the entry, stop and target set, expires with the record's `validFor` |
| `open`, market (replica, crypto trend, adds) | market order, only if the signal is younger than `InpMaxLateMin` and price is within `InpMaxSlipR` × R of the signal entry; otherwise skipped (and noted) |
| stop / target changes (breakeven, trailing) | the position's stop and target follow the record; a stop is never loosened |
| `win` / `loss` / `be` / `expired` / `missed` | position closed or order deleted |
| add (`addOf` set) | same lots as its first trade (same notional, as in the research) |

**Sizing.** `InpRisk*` is the % of equity lost if the first unit hits its stop (default 0.25% each; gold trend `InpRiskGoldTrend` 0.5%, twice the other gold legs, as the sizing guide: on 2023-26 that adds about +3% / +6% in the two halves at the same drawdown). Lots are
computed from the symbol's tick value and rounded down to the volume step; a trade whose minimum lot would risk
more is skipped.

**Prop-firm guards (built in, independent of the council).**
- `InpDailyLossPct` (1.5%): when equity falls that far under the day's starting equity, everything is closed and no
  trade is taken until the next server day.
- `InpMaxDDPct` (6%): when equity falls that far under the starting balance (stored on first run, or `InpStartBalance`),
  everything is closed and the EA stops for good (clear the global variable `CB.blockedForever` to restart).
- `InpMaxOpenRiskPct` (2%): no new trade while the open risk (distance to stop × lots, all positions and orders) is above it.

Set these inside the challenge's own limits (for a 3% daily / 10% max rule: 1.5% / 6% leaves room for slippage and
for a stop hit while the EA is offline).

## Setup
1. MT5 → Tools → Options → Expert Advisors: tick **Allow WebRequest for listed URL** and add
   `https://aureumdesk.co.uk` (the site on Cloudflare serves the signals file; the repo is private). Tick **Allow algorithmic trading**.
2. Copy `CouncilBridge.mq5` to `MQL5/Experts/`, open it in MetaEditor, **Compile**. Send any compile error back.
3. Attach it to any chart (one instance per account). Inputs: the broker's symbol names (`InpSymGold` = XAUUSD,
   `InpSymNQ` = NAS100 / USTEC, `InpSymBTC` … leave empty to skip a market), the risk per system, the guards.
4. Watch the **Experts** log: it prints every order it places, skips and why, and the guard events.
5. The terminal must stay on: a VPS or a machine that never sleeps. Offline = no new trades and no stop updates
   (broker-side stops and targets still protect open positions).

## Late entries
The bot runs every 4 min and the EA polls every 30 s, so a gold signal is mirrored 1–5 min after it fired. Replaying the
live gold rules 2023–26 with the entry at the 1-minute close 2 / 4 / 6 min after the signal (council stop and target
unchanged, skip when price has moved more than 0.5R either way): +188.6 / +190.0 / +195.5R vs the council's +185.9R, same
or lower drawdown; the few signals that run more than 0.5R in the first minutes are net losers. A 0.3R band skipped too
many good trades (+173R). Hence `InpMaxSlipR = 0.5`.

## What the replay says at 0.25% risk per trade (2025–26, all systems)
+1.8% a month, worst drawdown −3.9%, worst day −1.3%, +5% reached after ~45 trades (about two months);
shuffled trade orders breach an 8% drawdown before +5% in 0.1% of runs. At 0.5% gold / 0.5% crypto the pace is
+3.0% a month but the worst day is −2.3% and 4.5% of runs breach −8% first. Forward results will be worse than the
replay: expect it, size small, and treat the first month on the account as a test.

## Not in this version
- The NQ open run executed natively from the broker's 1-minute feed (the council's NQ feed is 10 min late). Planned
  as a second module once the mirror runs cleanly.
- Partial closes and a Telegram/ntfy message per MT5 fill.

## NQ open run, executed natively (NQOpenRun.mq5)
The council's main edge cannot be mirrored (its NQ feed is 10 min late), so `NQOpenRun.mq5` runs the rule itself on
the broker's NAS100 / USTEC 1-minute feed. Attach it to the **NAS100 M1 chart** (one instance). It ports
`nqOpenSweep` + the `nyflip` rules exactly: 09:30 ET open, run ≥ 0.08% of the open through it, 1-minute close back
across within 15 min, trade with the run, stop the same distance on the other side, midnight-open filter, after +2R
trail 1R behind the best price (cap 10R), out at 11:00 ET; one trade per New York day; the same prop-firm guards.
It converts server time to New York time itself (US daylight-saving rules included), so no broker-offset input is
needed. Expectation: +0.28R a trade in 2023–26 on the cash index, +0.02R in 2018–22; the CFD's spread at the open
is the main unknown, so compare the first fills against the council's research records (`research.json`, session
`nyflip`) and tell me the spread you see.

# BreakFade.mq5 — the Equinox Break fade on M15 (24 Nov 2026)

The same rule as `ctrader/BreakFade.cs`, for MetaTrader 5, on the broker's own 15-minute candles: a close beyond the last swing
(3 candles each side) is faded at market when the candle closes; stop 1 x ATR(14) from the fill, target 2R, closed after 24 hours.
**Demo accounts only; it starts in dry run. The rule loses after costs in its study (-0.118R a trade, 2015-26): not an edge.**

**Setup**
1. MetaEditor -> open `BreakFade.mq5` in `MQL5/Experts` -> Compile.
2. Attach it to any one chart, allow Algo Trading. Inputs: the symbol list (your broker's names), risk % a trade (default 0.25),
   caps, trading hours in UTC, the spread limit, dry run.
3. Leave dry run on first and read the Experts log; switch it off to trade the demo account.
4. Use a hedging account (on a netting account, overlapping trades of one symbol merge). The terminal must stay running.

# EquinoxBridge.mq5 — follow the Equinox desks with your personal key (24 Nov 2026)

A member's own MetaTrader 5 copies the Equinox desks' paper trades (Break fade, Big-candle fade, FVG return, Gold breakout).
The program reads the member's personal feed address (Profile -> "MetaTrader 5 bridge" on the site) every few seconds. No broker
login or password reaches the site. **Demo accounts only; it starts in dry run. The desks' rules lose after costs in their
studies: not trade advice.**

1. Compile `EquinoxBridge.mq5` in MetaEditor (folder `MQL5/Experts`).
2. Tools -> Options -> Expert Advisors -> allow WebRequest for `https://aureumdesk.co.uk`.
3. Attach it to any chart of a demo account; paste the feed address into the first input. Inputs: risk % a trade (0.25),
   which desks, the broker's symbol suffix, the cap of open copies, how far the price may be from the desk's entry (0.75R).
4. Each desk trade is opened once with the desk's stop and target, closed when the desk closes it, and a copy without a stop
   is closed at once.
