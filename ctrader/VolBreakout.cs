// VolBreakout — standalone cTrader cBot for the desk's daily volatility breakout (rule "T1") on gold and USD/JPY.
// No internet needed: it runs on the broker's own candles. One instance trades every symbol in its list.
//
// These are the two rules that pass the desk's tests at measured costs (the core of the "passing rules" paper book):
//   gold     2021-26 at the measured hourly spread  +0.105R a trade (n 1,121, month t 2.79); at the broker's own ticks
//            Nov 2023 - Nov 2026 +0.184R (n 572, month t 3.54)
//   USD/JPY  2005-15 +0.079R (n 2,089, month t 2.95); 2016-26 +0.063R (n 2,079, month t 2.50); at the broker's own ticks
//            +0.148R (n 564, month t 3.11)
// In-sample years for the tick tests; the forward records are the judge. Drawdowns were long (USD/JPY 33.8R over 574 days).
// The same rule FAILED on indices, other metals, energies, crypto and the other forex pairs: keep the list to these two.
//
// The rule, unchanged from the studies (council/vb-demo.mjs trades the same on the desk's demo account):
//  - O = the open of the UTC day (00:00 UTC). R = the previous trading day's high minus its low (UTC days; weekend candles
//    belong to the next weekday, so Monday holds Sunday evening and Monday's "previous day" is Friday).
//  - In the first 20 minutes of a weekday: a BUY STOP at O + 0.5 x R and a SELL STOP at O - 0.5 x R, each with its stop at O.
//    If the day has already traded through either level, the day is missed (no orders).
//  - The first order to fill cancels the other. No target. Whatever is open is closed at 21:00 UTC; unfilled orders expire then.
//  - One trade a day a symbol. Risk % of equity lost if the stop is hit.
// Tested and rejected, so not here: break-even, trailing stops, partial exits, another stop place, direction or macro filters.
// State lives in the orders and positions (label "VB"), so restarting the bot is safe. Demo accounts only; dry run by default.
using System;
using System.Linq;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None, AddIndicators = false)]
    public class VolBreakout : Robot
    {
        [Parameter("Symbols (comma separated)", DefaultValue = "XAUUSD,USDJPY")] public string SymbolList { get; set; }
        [Parameter("Risk % per trade", DefaultValue = 0.25, MinValue = 0.01, MaxValue = 1)] public double RiskPct { get; set; }
        [Parameter("Dry run (log only, no orders)", DefaultValue = true)] public bool DryRun { get; set; }

        private const string Label = "VB";
        private const double K = 0.5;              // half the previous trading day's range
        private const int PlaceUntilMin = 20;      // orders are placed in the first 20 minutes of the UTC day only
        private const int ExitHour = 21;           // 21:00 UTC: close and cancel
        private const int PollSec = 5;
        private readonly Dictionary<string, DateTime> _done = new Dictionary<string, DateTime>();   // symbol -> the UTC day handled
        private string[] _syms = new string[0];

        // Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account
        // that is not a demo. Checked on start, on every poll and right before every order it sends; on a refusal it says why and
        // stops itself without sending anything. Account.IsLive is the platform's own account-type flag (true for a live account).
        private bool DemoOnly()
        {
            if (!Account.IsLive) return true;
            Print("VolBreakout refused: account {0} is a LIVE account. This program runs on demo accounts only; it stops now and sends nothing.", Account.Number);
            Stop();
            return false;
        }

        protected override void OnStart()
        {
            if (!DemoOnly()) return;
            _syms = SymbolList.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();
            foreach (var s in _syms)
                if (!Symbols.Exists(s)) Print("VolBreakout: symbol {0} not found at this broker, skipped", s);
            _syms = _syms.Where(s => Symbols.Exists(s)).ToArray();
            Print("VolBreakout started on {0}: risk {1}% a trade, dry run {2}. Demo only.", string.Join(", ", _syms), RiskPct, DryRun);
            Timer.Start(TimeSpan.FromSeconds(PollSec));
        }

        protected override void OnTimer()
        {
            if (!DemoOnly()) return;
            foreach (var s in _syms)
            {
                try { Step(s); }
                catch (Exception e) { Print("VolBreakout {0}: {1}", s, e.Message); }
            }
        }

        private void Step(string name)
        {
            DateTime now = Server.Time, day = now.Date;
            var mine = Positions.Where(p => p.Label == Label && p.SymbolName == name).ToArray();
            var orders = PendingOrders.Where(o => o.Label == Label && o.SymbolName == name).ToArray();

            // rule 1 of the desk: no position without a stop
            foreach (var p in mine) if (!p.StopLoss.HasValue) { Print("VolBreakout {0}: closed, it has no stop", name); ClosePosition(p); }
            // one filled: the other order goes
            if (mine.Length > 0) foreach (var o in orders) CancelPendingOrder(o);
            // 21:00 UTC (or a position left from an earlier day): close and cancel
            if (now.Hour >= ExitHour || mine.Any(p => p.EntryTime.Date < day))
            {
                foreach (var p in mine) { Print("VolBreakout {0}: 21:00 UTC exit", name); ClosePosition(p); }
                foreach (var o in orders) CancelPendingOrder(o);
                return;
            }

            // place the day's two orders: weekdays, the first 20 minutes, once
            if (day.DayOfWeek == DayOfWeek.Saturday || day.DayOfWeek == DayOfWeek.Sunday) return;
            if (now.Hour != 0 || now.Minute >= PlaceUntilMin || now.Second < 15 && now.Minute == 0) return;
            DateTime seen; if (_done.TryGetValue(name, out seen) && seen == day) return;
            if (mine.Length > 0 || orders.Length > 0 || History.Any(h => h.Label == Label && h.SymbolName == name && h.EntryTime.Date == day)) { _done[name] = day; return; }

            var sym = Symbols.GetSymbol(name);
            var bars = MarketData.GetBars(TimeFrame.Minute5, name);
            int tries = 0; while (bars.Count < 1500 && tries++ < 4) bars.LoadMoreHistory();
            // today's first candle (its open is the day's open) and the day so far
            double open = double.NaN, hi = double.MinValue, lo = double.MaxValue;
            for (int i = 0; i < bars.Count; i++)
            {
                if (bars.OpenTimes[i] < day) continue;
                if (double.IsNaN(open)) { if ((bars.OpenTimes[i] - day).TotalMinutes >= 60) break; open = bars.OpenPrices[i]; }
                hi = Math.Max(hi, bars.HighPrices[i]); lo = Math.Min(lo, bars.LowPrices[i]);
            }
            if (double.IsNaN(open)) return;                                   // no candle of the day yet: try again on the next poll
            // the previous trading day: the last weekday before today; a Monday starts on Saturday 00:00 (it holds Sunday evening)
            DateTime prev = day.AddDays(-1); while (prev.DayOfWeek == DayOfWeek.Saturday || prev.DayOfWeek == DayOfWeek.Sunday) prev = prev.AddDays(-1);
            DateTime from = prev.DayOfWeek == DayOfWeek.Monday ? prev.AddDays(-2) : prev, to = prev.AddDays(1);
            double ph = double.MinValue, pl = double.MaxValue; int n = 0;
            for (int i = 0; i < bars.Count; i++) { var t = bars.OpenTimes[i]; if (t < from || t >= to) continue; ph = Math.Max(ph, bars.HighPrices[i]); pl = Math.Min(pl, bars.LowPrices[i]); n++; }
            _done[name] = day;
            if (n < 50 || !(ph > pl)) { Print("VolBreakout {0}: no range for the previous trading day ({1} candles), no orders today", name, n); return; }
            double dist = K * (ph - pl), buyAt = open + dist, sellAt = open - dist;
            if (hi >= buyAt || lo <= sellAt) { Print("VolBreakout {0}: the day already traded through a level, missed", name); return; }
            double vol = Units(sym, dist);
            if (vol <= 0) { Print("VolBreakout {0}: the smallest volume would risk more than {1}%, no orders today", name, RiskPct); return; }
            double slPips = Math.Round(dist / sym.PipSize, 1); DateTime exp = day.AddHours(ExitHour);
            Print("VolBreakout {0}: open {1}, previous range {2}: BUY STOP {3}, SELL STOP {4}, stop at the open, {5} units, out at 21:00 UTC{6}",
                name, Math.Round(open, sym.Digits), Math.Round(ph - pl, sym.Digits), Math.Round(buyAt, sym.Digits), Math.Round(sellAt, sym.Digits), vol, DryRun ? " (dry run, nothing sent)" : "");
            if (DryRun) return;
            if (!DemoOnly()) return;
            var b = PlaceStopOrder(TradeType.Buy, name, vol, Math.Round(buyAt, sym.Digits), Label, slPips, null, exp, "vb " + day.ToString("yyyy-MM-dd"));
            if (!b.IsSuccessful) Print("VolBreakout {0}: buy stop failed {1}", name, b.Error);
            if (!DemoOnly()) return;
            var s = PlaceStopOrder(TradeType.Sell, name, vol, Math.Round(sellAt, sym.Digits), Label, slPips, null, exp, "vb " + day.ToString("yyyy-MM-dd"));
            if (!s.IsSuccessful) Print("VolBreakout {0}: sell stop failed {1}", name, s.Error);
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
