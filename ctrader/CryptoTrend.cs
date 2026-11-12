// CryptoTrend — standalone cTrader cBot for the council's crypto trend system (no internet needed, runs on the broker's own candles)
//
// Rules (council/trader.mjs, crypto trend v3 + crypto-add, 5 Nov 2026), long only, one instance trades every listed coin:
//  - Two slots per coin: the 55-day breakout and the 100-day breakout.
//  - Entry: a CLOSED daily candle closes above the highest high of the N daily candles before it -> buy at market.
//  - Catastrophe stop: 5 x ATR(20) below the entry, fixed (never moved).
//  - Exit: a closed daily candle closes under the midpoint of the N-day channel (highest high + lowest low of the N candles before
//    it) / 2. The exit level only ratchets up from the entry day on. Exit at market.
//  - Add: once per trade, when a closed daily candle is at least +1R (1R = the entry's 5 ATR) above the entry, a second unit buys at
//    market with its own stop 1R below; it leaves together with the first unit.
//  - Sizing: Risk % of equity lost if the stop is hit, per unit.
// Research (council research log): council coins 2018-26 with 0.8% costs, the 55+100 pair with the midpoint exit had Sharpe
// 1.67 (2018-21) / 0.81 (2022-26); the add raised profit with a small rise in drawdown. Crypto CFDs charge overnight financing:
// a trend system holds for weeks, so check your broker's swap on long crypto before going live.
//
// More coins (7 Nov, Binance daily 2018-26, these rules, 0.8% costs; 2018-21 | 2022-26): ADA +90.9R | +22.1R, BNB +115.7R | +31.0R,
// LINK +13.7R | +10.7R added; DOGE +27.0 | +1.6 (flat lately), LTC +9.1 | -12.5, TRX -1.2 | +9.1 left out. Names differ by broker
// (IC Markets e.g. LNKUSD for Chainlink); a name the broker doesn't have is skipped with a log line.
// State lives in the positions themselves (label CT55 / CT100, adds CT55A / CT100A), so restarting the bot is safe.
using System;
using System.Linq;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(AccessRights = AccessRights.None, AddIndicators = false)]
    public class CryptoTrend : Robot
    {
        [Parameter("Symbols (comma separated)", DefaultValue = "BTCUSD,ETHUSD,SOLUSD,XRPUSD,ADAUSD,BNBUSD,LNKUSD")] public string SymbolList { get; set; }
        [Parameter("Risk % per unit", DefaultValue = 0.25, MinValue = 0.01, MaxValue = 5)] public double RiskPct { get; set; }
        [Parameter("Use the 55-day slot", DefaultValue = true)] public bool Use55 { get; set; }
        [Parameter("Use the 100-day slot", DefaultValue = true)] public bool Use100 { get; set; }
        [Parameter("Add a unit at +1R", DefaultValue = true)] public bool UseAdd { get; set; }
        [Parameter("ATR multiple for the stop", DefaultValue = 5.0, MinValue = 1)] public double AtrMult { get; set; }
        [Parameter("Max open risk % (all coins)", DefaultValue = 3.0, MinValue = 0.1)] public double MaxOpenRiskPct { get; set; }
        [Parameter("Check every (seconds)", DefaultValue = 60, MinValue = 10)] public int PollSec { get; set; }
        [Parameter("Dry run (log only, no orders)", DefaultValue = false)] public bool DryRun { get; set; }

        private const int AtrN = 20;
        private readonly Dictionary<string, DateTime> _lastBar = new Dictionary<string, DateTime>();
        private string[] _syms = new string[0];

        // Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account
        // that is not a demo. Checked on start and right before every order it sends; on a refusal it says why and stops itself
        // without sending anything. Account.IsLive is the platform's own account-type flag (true for a live account).
        private bool DemoOnly()
        {
            if (!Account.IsLive) return true;
            Print("CryptoTrend refused: account {0} is a LIVE account. This program runs on demo accounts only; it stops now and sends nothing.", Account.Number);
            Stop();
            return false;
        }

        protected override void OnStart()
        {
            if (!DemoOnly()) return;
            _syms = SymbolList.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();
            foreach (var s in _syms)
                if (!Symbols.Exists(s)) Print("CryptoTrend: symbol {0} not found at this broker, skipped", s);
            _syms = _syms.Where(s => Symbols.Exists(s)).ToArray();
            Print("CryptoTrend started on {0}: risk {1}% per unit, slots {2}{3}, add {4}, dry run {5}", string.Join(", ", _syms), RiskPct,
                Use55 ? "55 " : "", Use100 ? "100" : "", UseAdd, DryRun);
            Timer.Start(TimeSpan.FromSeconds(PollSec));
            OnTimer();
        }

        protected override void OnTimer()
        {
            if (!DemoOnly()) return;
            foreach (var s in _syms)
            {
                try { CheckSymbol(s); }
                catch (Exception e) { Print("CryptoTrend {0}: {1}", s, e.Message); }
            }
        }

        // Act once per newly CLOSED daily candle per symbol
        private void CheckSymbol(string name)
        {
            var bars = MarketData.GetBars(TimeFrame.Daily, name);
            int tries = 0;
            while (bars.Count < 130 && tries++ < 5) bars.LoadMoreHistory();
            if (bars.Count < 130) { Print("CryptoTrend {0}: only {1} daily candles, need 130", name, bars.Count); return; }
            int c = bars.Count - 2;                       // last closed daily candle
            DateTime t = bars.OpenTimes[c];
            DateTime seen;
            if (_lastBar.TryGetValue(name, out seen) && seen == t) return;
            _lastBar[name] = t;

            var sym = Symbols.GetSymbol(name);
            double close = bars.ClosePrices[c];
            foreach (int n in new[] { 55, 100 })
            {
                if ((n == 55 && !Use55) || (n == 100 && !Use100)) continue;
                string lab = "CT" + n, labAdd = lab + "A";
                var first = Positions.FindAll(lab, name).FirstOrDefault();
                var adds = Positions.FindAll(labAdd, name);

                if (first == null)
                {
                    // an add never stays without its first unit
                    foreach (var a in adds) Close(a, "first unit gone");
                    double hi = Highest(bars, c - n, c - 1);
                    if (close > hi) Enter(sym, lab, bars, c, string.Format("{0}-day breakout: close {1} > high {2}", n, close, hi));
                    continue;
                }

                // exit: close under the ratcheting N-day channel midpoint since the entry day
                double mid = RatchetMid(bars, n, first.EntryTime, c);
                if (close < mid)
                {
                    Close(first, string.Format("close {0} under the {1}-day midpoint {2}", close, n, Math.Round(mid, sym.Digits)));
                    foreach (var a in adds) Close(a, "with the first unit");
                    continue;
                }

                // add: once, when a closed candle is >= +1R above the first entry
                if (UseAdd && adds.Length == 0 && first.StopLoss.HasValue && !AddDone(first))
                {
                    double r0 = first.EntryPrice - first.StopLoss.Value;
                    if (r0 > 0 && close >= first.EntryPrice + r0)
                        AddUnit(sym, labAdd, r0, first, string.Format("close {0} is +1R above the entry {1}", close, first.EntryPrice));
                }
            }
        }

        private void Enter(Symbol sym, string lab, Bars bars, int c, string why)
        {
            double atr = Atr(bars, c), dist = AtrMult * atr, entry = sym.Ask;
            if (dist <= 0) return;
            double vol = Units(sym, dist);
            if (vol <= 0) { Print("CryptoTrend {0} {1}: stop {2} too wide for {3}% risk at the minimum volume, skipped", sym.Name, lab, dist, RiskPct); return; }
            if (OpenRiskPct() + RiskPct > MaxOpenRiskPct) { Print("CryptoTrend {0} {1}: open-risk cap {2}% reached, skipped", sym.Name, lab, MaxOpenRiskPct); return; }
            Print("CryptoTrend {0} {1} BUY {2} units at ~{3}, stop {4} ({5} ATR) - {6}", sym.Name, lab, vol, entry, Math.Round(entry - dist, sym.Digits), AtrMult, why);
            if (DryRun) return;
            if (!DemoOnly()) return;
            var res = ExecuteMarketOrder(TradeType.Buy, sym.Name, vol, lab, dist / sym.PipSize, null, "first");
            if (!res.IsSuccessful) Print("CryptoTrend {0} {1}: order failed {2}", sym.Name, lab, res.Error);
        }

        private void AddUnit(Symbol sym, string labAdd, double r0, Position first, string why)
        {
            double vol = Units(sym, r0);
            if (vol <= 0) return;
            if (OpenRiskPct() + RiskPct > MaxOpenRiskPct) { Print("CryptoTrend {0} {1}: open-risk cap reached, add skipped", sym.Name, labAdd); return; }
            Print("CryptoTrend {0} {1} ADD {2} units at ~{3}, own stop 1R below - {4}", sym.Name, labAdd, vol, sym.Ask, why);
            if (DryRun) return;
            if (!DemoOnly()) return;
            var res = ExecuteMarketOrder(TradeType.Buy, sym.Name, vol, labAdd, r0 / sym.PipSize, null, "add of " + first.Id);
            if (!res.IsSuccessful) Print("CryptoTrend {0} {1}: add failed {2}", sym.Name, labAdd, res.Error);
        }

        // the add is taken once per first unit: remembered in the history (a closed add with this first unit's id)
        private bool AddDone(Position first)
        {
            string tag = "add of " + first.Id;
            return History.Any(h => h.Comment == tag);
        }

        private void Close(Position p, string why)
        {
            Print("CryptoTrend {0} {1} CLOSE ({2})", p.SymbolName, p.Label, why);
            if (DryRun) return;
            var res = ClosePosition(p);
            if (!res.IsSuccessful) Print("CryptoTrend {0} {1}: close failed {2}", p.SymbolName, p.Label, res.Error);
        }

        // highest midpoint of the N-day channel over the closed candles from the entry day to c (the exit only ratchets up)
        private double RatchetMid(Bars bars, int n, DateTime entryTime, int c)
        {
            double best = double.MinValue;
            for (int i = c; i >= n; i--)
            {
                if (bars.OpenTimes[i] < entryTime.Date.AddDays(-1)) break;   // from the breakout candle on, as the council's midStop
                double m = (Highest(bars, i - n, i - 1) + Lowest(bars, i - n, i - 1)) / 2;
                if (m > best) best = m;
            }
            if (best == double.MinValue) best = (Highest(bars, c - n, c - 1) + Lowest(bars, c - n, c - 1)) / 2;
            return best;
        }

        private double Atr(Bars b, int c)
        {
            double s = 0;
            for (int i = c - AtrN + 1; i <= c; i++)
                s += Math.Max(b.HighPrices[i] - b.LowPrices[i], Math.Max(Math.Abs(b.HighPrices[i] - b.ClosePrices[i - 1]), Math.Abs(b.LowPrices[i] - b.ClosePrices[i - 1])));
            return s / AtrN;
        }

        private static double Highest(Bars b, int from, int to) { double v = double.MinValue; for (int i = Math.Max(0, from); i <= to; i++) v = Math.Max(v, b.HighPrices[i]); return v; }
        private static double Lowest(Bars b, int from, int to) { double v = double.MaxValue; for (int i = Math.Max(0, from); i <= to; i++) v = Math.Min(v, b.LowPrices[i]); return v; }

        // units so that the stop distance loses RiskPct of equity; 0 if even the minimum volume risks too much
        private double Units(Symbol sym, double dist)
        {
            double risk = Account.Equity * RiskPct / 100.0;
            double perUnit = dist / sym.PipSize * sym.PipValue;
            if (perUnit <= 0) return 0;
            double u = sym.NormalizeVolumeInUnits(risk / perUnit, RoundingMode.Down);
            if (u < sym.VolumeInUnitsMin) return 0;
            return Math.Min(u, sym.VolumeInUnitsMax);
        }

        // open risk of this bot's positions, % of equity (distance to stop x volume)
        private double OpenRiskPct()
        {
            double r = 0;
            foreach (var p in Positions.Where(p => p.Label != null && p.Label.StartsWith("CT")))
            {
                if (!p.StopLoss.HasValue) continue;
                var s = Symbols.GetSymbol(p.SymbolName);
                double d = Math.Max(0, p.EntryPrice - p.StopLoss.Value);
                r += d / s.PipSize * s.PipValue * p.VolumeInUnits;
            }
            return Account.Equity > 0 ? r / Account.Equity * 100 : 0;
        }
    }
}
