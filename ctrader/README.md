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
