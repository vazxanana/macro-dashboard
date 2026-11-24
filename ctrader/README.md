# cTrader bridge (CouncilBridge.cs) — IC Markets or any cTrader broker

**Demo accounts only (12 Nov 2026, owner decision 45).** Every program in this folder checks the platform's own account-type flag (`Account.IsLive`) when it starts and again right before every order it sends. On a real account it prints why in the log and stops itself (`Stop()`) without sending anything.

Same behaviour as the MT5 Expert Advisor (`mt5/README.md`): it polls `mt5/signals.csv` on the council-data branch
every 30 s and mirrors the council's paper trades (gold replica, Mosha BO, crypto trend, their adds) with the same
prop-firm guards (daily loss stop, max-drawdown floor, open-risk cap) and the same sizing (risk % of equity per
first unit; an add takes the volume of its first trade).

## Setup
1. cTrader → **Automate** → New cBot → replace the template with `CouncilBridge.cs` → **Build**. The bot needs
   `AccessRights.FullAccess` (already in the file) for the internet request; cTrader asks you to confirm it.
2. Add an instance to any chart. Parameters: the broker's symbol names (IC Markets: XAUUSD, NAS100 / US100,
   BTCUSD, ETHUSD; leave a symbol empty to skip that market), the risk per system, the guards.
3. Start it; the **Log** tab shows every order placed, every skip and why, and the guard events.
4. The platform must stay on (cTrader Desktop on a VPS, or cTrader Web does not run cBots: desktop only).

Notes: cTrader labels (`CB:<id>`) tie a position to its council record, so restarting the bot is safe. Positions
whose record is older than 7 days are left to their broker stop/target.

# CryptoTrend.cs — standalone crypto trend bot (7 Nov 2026)

Trades the council's crypto trend system by itself on the broker's own daily candles: no internet, no council-data feed,
no council bot needed. One instance trades every coin in its list.

**Rules** (council crypto trend v3 + crypto-add; long only):
- **Slots:** two per coin, the 55-day and 100-day breakouts.
- **Entry:** a closed daily candle above the prior N daily highs buys at market.
- **Stop:** a fixed catastrophe stop 5× ATR(20) below.
- **Exit:** at market on a daily close under the N-day channel midpoint, which only ratchets up.
- **Add:** one second unit at +1R, with its own 1R stop; it leaves with the first unit.

**Setup**
1. cTrader → Automate → New cBot → replace the template with `CryptoTrend.cs` → Build. It needs no access rights.
2. Add one instance to any chart (e.g. BTCUSD, D1). Parameters:
   - symbol list (default `BTCUSD,ETHUSD,SOLUSD,XRPUSD,ADAUSD,BNBUSD,LNKUSD`; use your broker's names, unknown ones are skipped with a log line);
   - risk % per unit (default 0.25%; the council's sizing guide is 0.5% + 0.5% on the add);
   - which slots to use, the add on/off, and an open-risk cap for all coins (default 3%).
3. **Start with "Dry run" on**: the Log shows what it would buy or close. Switch it off to trade.
4. cTrader Desktop must stay running (VPS); cTrader Web does not run cBots.

**Notes**
- The bot acts once per newly closed daily candle. A breakout found at start-up is acted on only if that candle is the last closed one.
- State lives in the positions: labels CT55 / CT100, adds CT55A / CT100A. Restarting is safe.
- Don't run CouncilBridge with "Mirror crypto trend" on at the same time, or each signal is traded twice.
- Crypto CFDs charge overnight financing on longs. Trend trades last weeks, so check the swap rate first.

# CryptoScalper.cs — BTC / ETH M15 scalper (7 Nov 2026)

The ICT desk's iFVG reversal on closed M15 candles. A swing is swept, then a candle body closes back through the leg's fair
value gap; the bot enters at market.
- **Filters:** only WITH the daily bias (the last daily close vs its 50-day average), and only when the stop is at least 0.5% of price.
- **Exit:** the stop trails 1.5R behind the best price from +2R; time exit after 24 h.
- **Limits:** one trade per coin, and a daily loss stop (default 2%).

**Research before building** (Binance 5m 2022 - Nov 2026, 0.06% round-trip cost):
- The other crypto scalps lose after costs: H1 momentum pullback, Asia-range breakout, M15 RSI(2) dips, M5 iFVG.
- This rule on BTC+ETH: 2022 +127.5R, 2023 −6.6R, 2024 +68.3R, 2025 +48.8R, 2026 +53.2R. That is about +0.07R a trade, ~900 trades a year, worst drawdown ~64R.
- Stops of at least 0.4 / 0.6% hold too. SOL and XRP lose with the same rule.
- Thin edge: spreads and fees decide it. Default risk 0.1% a trade; run it on demo / dry run first.

**Setup:** Automate → New cBot → paste `CryptoScalper.cs` → Build (no access rights). Add one instance to any chart.
Default symbols `BTCUSD,ETHUSD`; change them to your broker's names. cTrader Desktop must stay on.

**More coins (7 Nov).** Same rules on Binance daily 2018-26, 0.8% costs, 2018-21 | 2022-26:
- Added: ADA +90.9 | +22.1R, BNB +115.7 | +31.0R, LINK +13.7 | +10.7R.
- Left out: DOGE +27.0 | +1.6R, LTC +9.1 | −12.5R, TRX −1.2 | +9.1R.
- CryptoScalper stays BTC + ETH only. Its rule was tested on 11 more IC Markets coins (LTC, BCH, ADA, DOGE, DOT, LINK, XLM, AVAX, UNI, EOS, DASH), Binance 5m 2022-26: every one loses at a 0.1% round-trip cost (best: DOGE about flat).

# BreakFade.cs — the Equinox Break fade on M15 (24 Nov 2026)

The Equinox desk's "Break fade" as a standalone cBot on the broker's own 15-minute candles (study cell `m15 none atr 2R all`
of `research/edge/grid7-wide-fade`). **Demo accounts only; it starts in dry run.**

**The rule loses after costs in its study** (2015-26, ten markets: +0.042R a trade before costs, -0.118R after). It is not an
edge. The bot exists to see the rule trade at a broker's own prices on a demo account.

**Rules**
- **Break:** a closed M15 candle closes above the last confirmed swing high not yet closed above (or below the last swing low).
  A swing has 3 candles each side and counts once the 3 later candles have closed.
- **Trade:** against the break, at market when the break candle closes. A break up is sold, a break down is bought.
- **Stop:** 1 x ATR(14) of M15 from the fill. **Target:** 2R. **Time limit:** closed after 24 hours.
- **Skips:** the spread over a set share of the stop (default 100 %), the per-symbol and total caps, a break seen over 90 s late,
  a volume whose smallest size would risk more than the risk %.

**Setup**
1. cTrader -> Algo -> New cBot -> replace the template with `BreakFade.cs` -> Build. It needs no access rights.
2. Add one instance to any chart. Parameters: the symbol list (your broker's names), risk % a trade (default 0.25), caps,
   trading hours in UTC (for example 20 to 22), the spread limit, dry run.
3. Leave **Dry run** on first: the Log shows each break and what it would do. Switch it off to trade the demo account.
4. cTrader Desktop must stay running, or run the instance in cTrader's cloud.

**Notes:** positions carry the label `BF`, so a restart is safe. A position without a stop is closed at once. To backtest it in
cTrader, use tick data: the stop is a few pips on forex, so candle-only backtests flatter it.

# VolBreakout.cs — the daily volatility breakout on gold and USD/JPY (24 Nov 2026)

The two rules that pass the desk's tests at measured costs, as one standalone program (cTrader -> Algo -> New cBot -> paste -> Build). **Demo accounts only; it starts
in dry run.**

- **Rule:** at the 00:00 UTC open O, a buy stop at O + half the previous trading day's range and a sell stop at O - half of it,
  each with its stop at O; the first fill cancels the other; no target; out at 21:00 UTC; one trade a day a symbol.
- **Record:** gold +0.105R a trade 2021-26 (n 1,121, month t 2.79), +0.184R at the broker's own ticks (n 572, t 3.54);
  USD/JPY +0.079R 2005-15 (n 2,089, t 2.95), +0.063R 2016-26 (n 2,079, t 2.50). Long drawdowns (USD/JPY 33.8R over 574 days).
- **Keep the list to XAUUSD and USDJPY:** the same rule failed on every other market tested. Add no break-even, trail or filter:
  each was tested and lowered the result.
- Not compiled in the build sandbox. The desk's own demo job (`council/vb-demo.mjs`) trades the same rule.
