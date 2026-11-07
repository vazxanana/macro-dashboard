# cTrader bridge (CouncilBridge.cs) — IC Markets or any cTrader broker

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
   - symbol list (default `BTCUSD,ETHUSD,SOLUSD,XRPUSD`; use your broker's names, unknown ones are skipped with a log line);
   - risk % per unit (default 0.25%; the council's sizing guide is 0.5% + 0.5% on the add);
   - which slots to use, the add on/off, and an open-risk cap for all coins (default 3%).
3. **Start with "Dry run" on**: the Log shows what it would buy or close. Switch it off to trade.
4. cTrader Desktop must stay running (VPS); cTrader Web does not run cBots.

**Notes**
- The bot acts once per newly closed daily candle. A breakout found at start-up is acted on only if that candle is the last closed one.
- State lives in the positions: labels CT55 / CT100, adds CT55A / CT100A. Restarting is safe.
- Don't run CouncilBridge with "Mirror crypto trend" on at the same time, or each signal is traded twice.
- Crypto CFDs charge overnight financing on longs. Trend trades last weeks, so check the swap rate first.
