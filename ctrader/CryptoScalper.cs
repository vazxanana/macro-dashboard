// CryptoScalper — cTrader cBot: M15 iFVG reversal scalper for BTC and ETH (ICT model, research 7 Nov 2026)
//
// Signal (the ICT desk's own signals() logic, on closed M15 candles):
//  - A confirmed swing low (3 candles each side, within the last 96 candles) is swept; within 6 candles a candle BODY closes
//    back above the last bearish fair value gap of the down-leg (the inversion) -> BUY at market. Mirror for sells.
//  - Stop: just beyond the sweep extreme. Skip if the stop is wider than 8x the 48-candle ATR.
// Filters (the only version that held after costs in every period tested):
//  - Trade WITH the daily bias: buys only when the last closed daily candle is above its 50-day average, sells only below.
//  - The stop must be at least 0.5% of price (tighter stops lose to costs).
// Exit: no fixed target; from +2R the stop trails 1.5R behind the best price; out after 96 M15 candles (24 h).
//
// Research (Binance 5m 2022 - Nov 2026, every signal independent, 0.06% round-trip cost):
//   BTC+ETH: 2022 +127.5R, 2023 -6.6R, 2024 +68.3R, 2025 +48.8R, 2026 +53.2R  (~+0.07R a trade, ~900 trades a year,
//   worst drawdown ~64R). SOL and XRP lose with the same rule: keep to BTC and ETH. A THIN edge: costs decide it
//   (at 0.03% the same rule makes ~+0.10R a trade). Use a low-spread account, demo it first, and keep the risk small.
using System;
using System.Linq;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(AccessRights = AccessRights.None, AddIndicators = false)]
    public class CryptoScalper : Robot
    {
        [Parameter("Symbols (comma separated)", DefaultValue = "BTCUSD,ETHUSD")] public string SymbolList { get; set; }
        [Parameter("Risk % per trade", DefaultValue = 0.1, MinValue = 0.01, MaxValue = 2)] public double RiskPct { get; set; }
        [Parameter("Min stop (% of price)", DefaultValue = 0.5, MinValue = 0.1)] public double MinStopPct { get; set; }
        [Parameter("Trail from (R)", DefaultValue = 2.0, MinValue = 0.5)] public double TrailStartR { get; set; }
        [Parameter("Trail distance (R)", DefaultValue = 1.5, MinValue = 0.25)] public double TrailDistR { get; set; }
        [Parameter("Max hold (M15 candles)", DefaultValue = 96, MinValue = 4)] public int MaxHoldBars { get; set; }
        [Parameter("Daily loss stop %", DefaultValue = 2.0, MinValue = 0.1)] public double DailyLossPct { get; set; }
        [Parameter("Check every (seconds)", DefaultValue = 15, MinValue = 5)] public int PollSec { get; set; }
        [Parameter("Dry run (log only, no orders)", DefaultValue = false)] public bool DryRun { get; set; }

        private const int Piv = 3, Look = 96, VMax = 6, Window = 400;
        private const double MaxAtr = 8;
        private const string Lab = "CS";
        private readonly Dictionary<string, DateTime> _lastBar = new Dictionary<string, DateTime>();
        private string[] _syms = new string[0];
        private DateTime _day = DateTime.MinValue;
        private double _dayEquity;

        private class Sig { public int C; public double E, Stop, R0; }

        // Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account
        // that is not a demo. Checked on start and right before every order it sends; on a refusal it says why and stops itself
        // without sending anything. Account.IsLive is the platform's own account-type flag (true for a live account).
        private bool DemoOnly()
        {
            if (!Account.IsLive) return true;
            Print("CryptoScalper refused: account {0} is a LIVE account. This program runs on demo accounts only; it stops now and sends nothing.", Account.Number);
            Stop();
            return false;
        }

        protected override void OnStart()
        {
            if (!DemoOnly()) return;
            _syms = SymbolList.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToArray();
            foreach (var s in _syms.Where(s => !Symbols.Exists(s))) Print("CryptoScalper: symbol {0} not found, skipped", s);
            _syms = _syms.Where(s => Symbols.Exists(s)).ToArray();
            Print("CryptoScalper started on {0}: risk {1}% a trade, min stop {2}%, trail {3}R/{4}R, hold {5} M15 candles, dry run {6}",
                string.Join(", ", _syms), RiskPct, MinStopPct, TrailStartR, TrailDistR, MaxHoldBars, DryRun);
            Timer.Start(TimeSpan.FromSeconds(PollSec));
            OnTimer();
        }

        protected override void OnTimer()
        {
            if (!DemoOnly()) return;
            if (Server.Time.Date != _day) { _day = Server.Time.Date; _dayEquity = Account.Equity; }
            foreach (var s in _syms)
            {
                try { Manage(s); CheckSignal(s); }
                catch (Exception e) { Print("CryptoScalper {0}: {1}", s, e.Message); }
            }
        }

        // ---- entries: once per newly closed M15 candle
        private void CheckSignal(string name)
        {
            var bars = MarketData.GetBars(TimeFrame.Minute15, name);
            int closed = bars.Count - 1;                     // index of the forming candle; closed candles are 0 .. closed-1
            if (closed < Window) { int t = 0; while (bars.Count < Window + 2 && t++ < 5) bars.LoadMoreHistory(); closed = bars.Count - 1; }
            if (closed < 120) return;
            DateTime lastT = bars.OpenTimes[closed - 1];
            DateTime seen;
            if (_lastBar.TryGetValue(name, out seen) && seen == lastT) return;
            _lastBar[name] = lastT;
            if (Positions.FindAll(Lab, name).Length > 0) return;          // one trade per coin
            if (Account.Equity < _dayEquity * (1 - DailyLossPct / 100)) return;

            var sym = Symbols.GetSymbol(name);
            int start = Math.Max(0, closed - Window), N = closed - start;
            foreach (int side in new[] { 1, -1 })
            {
                double[] H = new double[N], L = new double[N], O = new double[N], C = new double[N];
                for (int i = 0; i < N; i++)
                {
                    int k = start + i;
                    if (side > 0) { H[i] = bars.HighPrices[k]; L[i] = bars.LowPrices[k]; O[i] = bars.OpenPrices[k]; C[i] = bars.ClosePrices[k]; }
                    else { H[i] = -bars.LowPrices[k]; L[i] = -bars.HighPrices[k]; O[i] = -bars.OpenPrices[k]; C[i] = -bars.ClosePrices[k]; }
                }
                var sig = Scan(H, L, O, C, N, sym.TickSize).LastOrDefault();
                if (sig == null || sig.C != N - 1) continue;                  // only a signal on the candle that just closed
                double entryRef = side * sig.E, stopPx = side * sig.Stop;
                if (sig.R0 / Math.Abs(entryRef) < MinStopPct / 100) { Print("CryptoScalper {0}: {1} signal skipped, stop {2:P2} under the minimum", name, side > 0 ? "buy" : "sell", sig.R0 / Math.Abs(entryRef)); continue; }
                int bias = DailyBias(name, bars.OpenTimes[closed - 1].AddMinutes(15));
                if (bias != side) { Print("CryptoScalper {0}: {1} signal skipped, against the daily bias", name, side > 0 ? "buy" : "sell"); continue; }
                double px = side > 0 ? sym.Ask : sym.Bid, dist = side * (px - stopPx);
                if (dist <= 0) continue;
                double vol = Units(sym, dist);
                if (vol <= 0) { Print("CryptoScalper {0}: stop too wide for {1}% risk at the minimum volume", name, RiskPct); continue; }
                Print("CryptoScalper {0} {1} {2} units at ~{3}, stop {4} (iFVG after a sweep; R = {5})", name, side > 0 ? "BUY" : "SELL", vol, px, Math.Round(stopPx, sym.Digits), Math.Round(dist, sym.Digits));
                if (DryRun) return;
                if (!DemoOnly()) return;
                var res = ExecuteMarketOrder(side > 0 ? TradeType.Buy : TradeType.Sell, name, vol, Lab, dist / sym.PipSize, null, "r0=" + dist.ToString("R"));
                if (!res.IsSuccessful) Print("CryptoScalper {0}: order failed {1}", name, res.Error);
                return;
            }
        }

        // the ICT tracker's signals(): sweep of a confirmed pivot low, then an inversion of the down-leg's last bearish FVG (mirrored for sells)
        private List<Sig> Scan(double[] H, double[] L, double[] O, double[] C, int N, double tick)
        {
            var outp = new List<Sig>(); var act = new List<int>(); int lastExit = -1;
            Func<int, bool> isPL = j => { if (j < Piv || j + Piv >= N) return false; for (int q = j - Piv; q <= j + Piv; q++) if (L[q] < L[j]) return false; return true; };
            for (int i = Piv; i < N; i++)
            {
                int j = i - Piv; if (j >= 0 && isPL(j)) act.Add(j);
                act.RemoveAll(k => i - k > Look);
                if (!act.Any(k => L[i] < L[k]) || i <= lastExit) continue;
                act.RemoveAll(k => L[i] < L[k]);
                int s = i; double lo = L[s];
                for (int c = s; c < Math.Min(s + VMax + 1, N); c++)
                {
                    lo = Math.Min(lo, L[c]);
                    double top = double.NaN;
                    for (int k = c - 1; k >= Math.Max(s - 12, 2); k--) if (H[k] < L[k - 2]) { top = L[k - 2]; break; }
                    if (double.IsNaN(top) || !(C[c] > top && (O[c] <= top || C[c - 1] <= top))) continue;
                    double e = C[c], stop = lo - 2 * tick, r0 = e - stop;
                    double sum = 0; int cnt = 0;
                    for (int q = Math.Max(1, c - 47); q <= c; q++) { double pc = C[q - 1]; sum += Math.Max(H[q], pc) - Math.Min(L[q], pc); cnt++; }
                    if (r0 <= 0 || r0 > MaxAtr * (sum / cnt)) break;
                    outp.Add(new Sig { C = c, E = e, Stop = stop, R0 = r0 });
                    lastExit = c + 6; break;
                }
            }
            return outp;
        }

        // +1 when the last daily candle closed before t is above its 50-day average, -1 below
        private int DailyBias(string name, DateTime t)
        {
            var d = MarketData.GetBars(TimeFrame.Daily, name);
            int tries = 0; while (d.Count < 60 && tries++ < 5) d.LoadMoreHistory();
            int di = -1; for (int i = d.Count - 1; i >= 0; i--) if (d.OpenTimes[i].AddDays(1) <= t) { di = i; break; }
            if (di < 49) return 0;
            double sma = 0; for (int i = di - 49; i <= di; i++) sma += d.ClosePrices[i]; sma /= 50;
            return d.ClosePrices[di] > sma ? 1 : -1;
        }

        // ---- management: trail from +TrailStartR by TrailDistR (on M15 highs/lows since entry), time exit
        private void Manage(string name)
        {
            foreach (var p in Positions.FindAll(Lab, name))
            {
                double r0; if (p.Comment == null || !p.Comment.StartsWith("r0=") || !double.TryParse(p.Comment.Substring(3), out r0) || r0 <= 0) continue;
                var bars = MarketData.GetBars(TimeFrame.Minute15, name);
                int d = p.TradeType == TradeType.Buy ? 1 : -1; double best = p.EntryPrice; int held = 0;
                for (int i = bars.Count - 1; i >= 0 && bars.OpenTimes[i].AddMinutes(15) > p.EntryTime; i--)
                {
                    best = d > 0 ? Math.Max(best, bars.HighPrices[i]) : Math.Min(best, bars.LowPrices[i]);
                    if (i < bars.Count - 1) held++;
                }
                if (held >= MaxHoldBars) { Print("CryptoScalper {0}: time exit after {1} M15 candles", name, held); if (!DryRun) ClosePosition(p); continue; }
                double peak = d * (best - p.EntryPrice) / r0;
                if (peak >= TrailStartR)
                {
                    double ns = p.EntryPrice + d * (peak - TrailDistR) * r0;
                    var sym = Symbols.GetSymbol(name); ns = Math.Round(ns, sym.Digits);
                    if (!p.StopLoss.HasValue || (ns - p.StopLoss.Value) * d > sym.TickSize)
                    {
                        if (DryRun) Print("CryptoScalper {0}: trail stop to {1}", name, ns);
                        else { var res = ModifyPosition(p, ns, p.TakeProfit); if (!res.IsSuccessful) Print("CryptoScalper {0}: trail failed {1}", name, res.Error); }
                    }
                }
            }
        }

        private double Units(Symbol sym, double dist)
        {
            double risk = Account.Equity * RiskPct / 100.0, perUnit = dist / sym.PipSize * sym.PipValue;
            if (perUnit <= 0) return 0;
            double u = sym.NormalizeVolumeInUnits(risk / perUnit, RoundingMode.Down);
            return u < sym.VolumeInUnitsMin ? 0 : Math.Min(u, sym.VolumeInUnitsMax);
        }
    }
}
