// BreakFade — standalone cTrader cBot for the Equinox "Break fade" on M15 (no internet needed, runs on the broker's own candles)
//
// The rule is the study cell "m15 none atr 2R all" of research/edge/grid7-wide-fade, as the Equinox desk records it:
//  - Structure on CLOSED 15-minute candles. A swing high is a candle whose high is above the 3 candles before it and at or above
//    the 3 after it (a swing low mirrors); it counts once those 3 later candles have closed, from the candle after them.
//  - A break = a 15-minute close above the last confirmed swing high not yet closed above (break up), or below the last
//    confirmed swing low not yet closed below (break down). Each swing is broken once.
//  - The trade FADES the break: a break up is sold, a break down is bought, at market as soon as the break candle has closed.
//  - Stop: 1 x ATR(14) of the 15-minute candles (plain average of the 14 true ranges ending at the break candle) from the fill.
//  - Target: 2R (twice the stop distance). Time limit: closed at market 24 hours after the fill.
//  - Trades of one market may overlap, as the study counted them; "Max open per symbol" caps it here.
//  - Skipped when the spread is over a set share of the stop distance (default 100 %: the study's "risk under the cost" rule).
//
// READ THIS FIRST. The study passed BEFORE costs and LOSES AFTER costs: 2015-26 on ten markets +0.042R a trade before costs
// (n 201,769), -0.118R after. It is not an edge. This bot is for a demo account, to see the rule trade at a broker's own prices.
// It refuses a live account (absolute rule 2 of the desk).
//
// Differences from the study, said plainly: the study fills at the open of the next 5-minute candle on mid prices, the bot at
// the broker's bid / ask a moment after the close; the bot reads the last 600 closed candles to find the standing swings (the
// study reads the whole history: the same result unless a swing older than about six days is still unbroken); the broker's
// 15-minute candles are bid candles on the broker's clock, the study's are OANDA mid candles in UTC buckets.
// State lives in the positions (label "BF"), so restarting the bot is safe. It never trades a break it sees late.
using System;
using System.Linq;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None, AddIndicators = false)]
    public class BreakFade : Robot
    {
        [Parameter("Symbols (comma separated)", DefaultValue = "XAUUSD,XAGUSD,EURUSD,GBPUSD,USDJPY,AUDUSD,NZDUSD,USDCAD,USDCHF,EURJPY")] public string SymbolList { get; set; }
        [Parameter("Risk % per trade", DefaultValue = 0.25, MinValue = 0.01, MaxValue = 2)] public double RiskPct { get; set; }
        [Parameter("Max open per symbol", DefaultValue = 3, MinValue = 1, MaxValue = 20)] public int MaxPerSymbol { get; set; }
        [Parameter("Max open in all", DefaultValue = 30, MinValue = 1, MaxValue = 200)] public int MaxOpen { get; set; }
        [Parameter("Trade from hour (UTC, 0-23)", DefaultValue = 0, MinValue = 0, MaxValue = 23)] public int FromHour { get; set; }
        [Parameter("Trade until hour (UTC, 1-24, not included)", DefaultValue = 24, MinValue = 1, MaxValue = 24)] public int UntilHour { get; set; }
        [Parameter("Skip when spread is over this % of the stop", DefaultValue = 100.0, MinValue = 1, MaxValue = 100)] public double MaxSpreadPct { get; set; }
        [Parameter("Dry run (log only, no orders)", DefaultValue = true)] public bool DryRun { get; set; }

        private const string Label = "BF";
        private const int Swing = 3;            // candles each side of a swing
        private const int AtrN = 14;
        private const double StopAtr = 1.0;     // stop = 1 x ATR(14) from the fill
        private const double TargetR = 2.0;     // target = 2R
        private const int HoldHours = 24;       // time limit
        private const int Look = 600;           // closed candles read for the standing swings
        private const int LateSec = 90;         // a break seen later than this after its close is not traded
        private const int PollSec = 2;
        private readonly Dictionary<string, DateTime> _lastBar = new Dictionary<string, DateTime>();
        private string[] _syms = new string[0];

        // Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account
        // that is not a demo. Checked on start, on every poll and right before every order it sends; on a refusal it says why and
        // stops itself without sending anything. Account.IsLive is the platform's own account-type flag (true for a live account).
        private bool DemoOnly()
        {
            if (!Account.IsLive) return true;
            Print("BreakFade refused: account {0} is a LIVE account. This program runs on demo accounts only; it stops now and sends nothing.", Account.Number);
            Stop();
            return false;
        }

        protected override void OnStart()
        {
            if (!DemoOnly()) return;
            _syms = SymbolList.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();
            foreach (var s in _syms)
                if (!Symbols.Exists(s)) Print("BreakFade: symbol {0} not found at this broker, skipped", s);
            _syms = _syms.Where(s => Symbols.Exists(s)).ToArray();
            Print("BreakFade started on {0}: risk {1}% a trade, hours {2}-{3} UTC, at most {4} a symbol and {5} in all, dry run {6}. The rule loses after costs in its study: demo only.",
                string.Join(", ", _syms), RiskPct, FromHour, UntilHour, MaxPerSymbol, MaxOpen, DryRun);
            Timer.Start(TimeSpan.FromSeconds(PollSec));
        }

        protected override void OnTimer()
        {
            if (!DemoOnly()) return;
            Manage();
            foreach (var s in _syms)
            {
                try { CheckSymbol(s); }
                catch (Exception e) { Print("BreakFade {0}: {1}", s, e.Message); }
            }
        }

        // Rule 1 of the desk: no position without a stop. And the 24-hour time limit.
        private void Manage()
        {
            foreach (var p in Positions.Where(p => p.Label == Label).ToArray())
            {
                if (!p.StopLoss.HasValue) { Close(p, "it has no stop"); continue; }
                if (Server.Time >= p.EntryTime.AddHours(HoldHours)) Close(p, "24-hour time limit");
            }
        }

        // Act once per newly CLOSED 15-minute candle per symbol
        private void CheckSymbol(string name)
        {
            var bars = MarketData.GetBars(TimeFrame.Minute15, name);
            int tries = 0;
            while (bars.Count < Look + 2 && tries++ < 5) bars.LoadMoreHistory();
            if (bars.Count < 60) return;
            int c = bars.Count - 2;                       // last closed candle
            DateTime t = bars.OpenTimes[c];
            DateTime seen;
            bool first = !_lastBar.TryGetValue(name, out seen);
            if (!first && seen == t) return;
            _lastBar[name] = t;

            int dir = BreakAt(bars, c);                   // +1 a break up, -1 a break down, 0 none
            if (dir == 0) return;
            double late = (Server.Time - t.AddMinutes(15)).TotalSeconds;
            if (first || late > LateSec) { Print("BreakFade {0}: a break {1} at the {2:HH:mm} candle was seen {3:0} s after its close, not traded", name, dir > 0 ? "up" : "down", t, late); return; }
            int h = Server.Time.Hour;
            if (h < FromHour || h >= UntilHour) return;
            Fade(Symbols.GetSymbol(name), dir, Atr(bars, c), t);
        }

        // The study's structure walk over the last Look closed candles; returns the break (if any) made by candle c.
        private static int BreakAt(Bars b, int c)
        {
            int start = Math.Max(Swing, c - Look);
            double hi = double.NaN, lo = double.NaN;       // the standing swing high / low (NaN = none, or already broken)
            int res = 0;
            for (int j = start + Swing + 1; j <= c; j++)
            {
                int i = j - Swing - 1;                      // the swing confirmed by the candle before j
                if (i >= start)
                {
                    bool isHi = true, isLo = true;
                    for (int k = 1; k <= Swing; k++)
                    {
                        if (!(b.HighPrices[i] > b.HighPrices[i - k] && b.HighPrices[i] >= b.HighPrices[i + k])) isHi = false;
                        if (!(b.LowPrices[i] < b.LowPrices[i - k] && b.LowPrices[i] <= b.LowPrices[i + k])) isLo = false;
                    }
                    if (isHi) hi = b.HighPrices[i];
                    if (isLo) lo = b.LowPrices[i];
                }
                double cl = b.ClosePrices[j];
                int d = 0;
                if (!double.IsNaN(hi) && cl > hi) { d = 1; hi = double.NaN; }
                else if (!double.IsNaN(lo) && cl < lo) { d = -1; lo = double.NaN; }
                if (j == c) res = d;
            }
            return res;
        }

        private void Fade(Symbol sym, int dir, double atr, DateTime candle)
        {
            double dist = StopAtr * atr;
            if (!(dist > 0)) return;
            var side = dir > 0 ? TradeType.Sell : TradeType.Buy;
            string what = string.Format("{0} after a break {1} at the {2:HH:mm} candle, stop {3} ({4} pips), target {5}R", side, dir > 0 ? "up" : "down", candle, Math.Round(dist, sym.Digits), Math.Round(dist / sym.PipSize, 1), TargetR);
            if (sym.Spread > dist * MaxSpreadPct / 100.0) { Print("BreakFade {0}: {1}: skipped, the spread {2} is over {3}% of the stop", sym.Name, what, sym.Spread, MaxSpreadPct); return; }
            if (Positions.Count(p => p.Label == Label && p.SymbolName == sym.Name) >= MaxPerSymbol) { Print("BreakFade {0}: {1}: skipped, {2} already open on this symbol", sym.Name, what, MaxPerSymbol); return; }
            if (Positions.Count(p => p.Label == Label) >= MaxOpen) { Print("BreakFade {0}: {1}: skipped, {2} already open in all", sym.Name, what, MaxOpen); return; }
            double vol = Units(sym, dist);
            if (vol <= 0) { Print("BreakFade {0}: {1}: skipped, the smallest volume would risk more than {2}%", sym.Name, what, RiskPct); return; }
            Print("BreakFade {0}: {1}, {2} units", sym.Name, what, vol);
            if (DryRun) return;
            double slPips = Math.Round(dist / sym.PipSize, 1), tpPips = Math.Round(TargetR * dist / sym.PipSize, 1);
            if (!DemoOnly()) return;
            var res = ExecuteMarketOrder(side, sym.Name, vol, Label, slPips, tpPips, "fade " + candle.ToString("yyyy-MM-dd HH:mm"));
            if (!res.IsSuccessful) { Print("BreakFade {0}: order failed {1}", sym.Name, res.Error); return; }
            if (res.Position != null && !res.Position.StopLoss.HasValue) Close(res.Position, "the broker set no stop");
        }

        private void Close(Position p, string why)
        {
            Print("BreakFade {0} CLOSE {1} ({2})", p.SymbolName, p.Id, why);
            var res = ClosePosition(p);
            if (!res.IsSuccessful) Print("BreakFade {0}: close failed {1}", p.SymbolName, res.Error);
        }

        // plain average of the AtrN true ranges ending at candle c (the study's atr14)
        private static double Atr(Bars b, int c)
        {
            double s = 0;
            for (int i = c - AtrN + 1; i <= c; i++)
                s += Math.Max(b.HighPrices[i] - b.LowPrices[i], Math.Max(Math.Abs(b.HighPrices[i] - b.ClosePrices[i - 1]), Math.Abs(b.LowPrices[i] - b.ClosePrices[i - 1])));
            return s / AtrN;
        }

        // units so that the stop distance loses RiskPct of equity; 0 if even the smallest volume risks more
        private double Units(Symbol sym, double dist)
        {
            double risk = Account.Equity * RiskPct / 100.0;
            double perUnit = dist / sym.PipSize * sym.PipValue;
            if (perUnit <= 0) return 0;
            double u = sym.NormalizeVolumeInUnits(risk / perUnit, RoundingMode.Down);
            if (u < sym.VolumeInUnitsMin) return 0;
            return Math.Min(u, sym.VolumeInUnitsMax);
        }
    }
}
