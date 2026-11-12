// CouncilBridge.cs — cTrader cBot (IC Markets or any cTrader broker). Mirrors the Mosha council's paper trades
// (gold replica, Mosha BO, crypto trend, their adds) with prop-firm guards, from mt5/signals.csv on the council-data branch.
// Build: cTrader → Automate → New cBot → paste this file → Build. Needs AccessRights.FullAccess (internet access).
// Add the bot to any chart (one instance per account). Demo first.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class CouncilBridge : Robot
    {
        [Parameter("Signals URL", DefaultValue = "https://meridianx.dev/cdata/mt5/signals.csv")]
        public string Url { get; set; }
        [Parameter("Poll seconds", DefaultValue = 30, MinValue = 5)]
        public int PollSec { get; set; }

        [Parameter("Gold symbol", DefaultValue = "XAUUSD")] public string SymGold { get; set; }
        [Parameter("NQ symbol (empty = off)", DefaultValue = "")] public string SymNQ { get; set; }
        [Parameter("BTC symbol (empty = off)", DefaultValue = "BTCUSD")] public string SymBTC { get; set; }
        [Parameter("ETH symbol (empty = off)", DefaultValue = "ETHUSD")] public string SymETH { get; set; }
        [Parameter("SOL symbol (empty = off)", DefaultValue = "")] public string SymSOL { get; set; }
        [Parameter("XRP symbol (empty = off)", DefaultValue = "")] public string SymXRP { get; set; }

        [Parameter("Risk % gold replica", DefaultValue = 0.25)] public double RiskGold { get; set; }
        [Parameter("Risk % gold trend", DefaultValue = 0.5)] public double RiskGoldTrend { get; set; }   // 7 Nov: 2x the other gold legs, as the sizing guide; 2023-26 more return at the same drawdown
        [Parameter("Risk % Mosha BO", DefaultValue = 0.25)] public double RiskMosha { get; set; }
        [Parameter("Risk % crypto trend", DefaultValue = 0.25)] public double RiskCrypto { get; set; }
        [Parameter("Risk % NQ open run", DefaultValue = 0.25)] public double RiskNQ { get; set; }
        [Parameter("Mirror gold replica", DefaultValue = true)] public bool MirrorGold { get; set; }
        [Parameter("Mirror Mosha BO", DefaultValue = true)] public bool MirrorMosha { get; set; }
        [Parameter("Mirror crypto trend", DefaultValue = true)] public bool MirrorCrypto { get; set; }
        [Parameter("Mirror NQ open run (feed 10 min late)", DefaultValue = false)] public bool MirrorNQ { get; set; }

        [Parameter("Daily loss stop %", DefaultValue = 1.5)] public double DailyLossPct { get; set; }
        [Parameter("Max drawdown stop %", DefaultValue = 6.0)] public double MaxDDPct { get; set; }
        [Parameter("Start balance (0 = first run)", DefaultValue = 0)] public double StartBalance { get; set; }
        [Parameter("Max open risk %", DefaultValue = 2.0)] public double MaxOpenRiskPct { get; set; }
        [Parameter("Max signal age (min)", DefaultValue = 10)] public int MaxLateMin { get; set; }
        [Parameter("Max slippage (x R)", DefaultValue = 0.5)] public double MaxSlipR { get; set; }

        private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        private const string LabelPrefix = "CB:";
        private readonly HashSet<string> _skipped = new HashSet<string>();   // signal ids we decided not to take
        private bool _blockedForever;
        private string _stoppedDay = "";
        private double _dayStartEquity; private string _dayKey = "";

        private class Sig
        {
            public string Id, Market, K, Side, Status, EntryMode, AddOf;
            public double Entry, Stop, T1, Size;
            public long Opened, Filled, ValidFor;
        }

        // Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account
        // that is not a demo. Checked on start and right before every order it sends; on a refusal it says why and stops itself
        // without sending anything. Account.IsLive is the platform's own account-type flag (true for a live account).
        private bool DemoOnly()
        {
            if (!Account.IsLive) return true;
            Print("CouncilBridge refused: account {0} is a LIVE account. This program runs on demo accounts only; it stops now and sends nothing.", Account.Number);
            Stop();
            return false;
        }

        protected override void OnStart()
        {
            if (!DemoOnly()) return;
            Print("CouncilBridge started. Account {0}, {1}", Account.Number, Account.IsLive ? "LIVE/contest" : "demo");
            if (StartBalance <= 0) { var v = LocalStorage.GetString("CB.startBalance", LocalStorageScope.Instance); if (string.IsNullOrEmpty(v)) { LocalStorage.SetString("CB.startBalance", Account.Balance.ToString(CultureInfo.InvariantCulture), LocalStorageScope.Instance); LocalStorage.Flush(LocalStorageScope.Instance); } }
            _blockedForever = LocalStorage.GetString("CB.blockedForever", LocalStorageScope.Instance) == "1";
            Timer.Start(TimeSpan.FromSeconds(Math.Max(5, PollSec)));
        }
        protected override void OnTimer()
        {
            try
            {
                if (!DemoOnly()) return;
                if (!GuardsOk()) return;
                var sigs = Fetch(); if (sigs == null) return;
                foreach (var s in sigs) Handle(s);
            }
            catch (Exception e) { Print("CouncilBridge error: {0}", e.Message); }
        }

        // ---------- guards ----------
        private double StartBal()
        {
            if (StartBalance > 0) return StartBalance;
            var v = LocalStorage.GetString("CB.startBalance", LocalStorageScope.Instance);
            double d; return double.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out d) && d > 0 ? d : Account.Balance;
        }
        private void CloseEverything(string why)
        {
            Print("CouncilBridge: closing everything — {0}", why);
            foreach (var p in Positions) if (p.Label != null && p.Label.StartsWith(LabelPrefix)) ClosePosition(p);
            foreach (var o in PendingOrders) if (o.Label != null && o.Label.StartsWith(LabelPrefix)) CancelPendingOrder(o);
        }
        private bool GuardsOk()
        {
            if (_blockedForever) return false;
            double eq = Account.Equity, bal = Account.Balance, start = StartBal();
            if (eq <= start * (1 - MaxDDPct / 100.0))
            {
                CloseEverything(string.Format("equity {0:F2} under the max-drawdown floor {1:F2}", eq, start * (1 - MaxDDPct / 100.0)));
                _blockedForever = true; LocalStorage.SetString("CB.blockedForever", "1", LocalStorageScope.Instance); LocalStorage.Flush(LocalStorageScope.Instance); return false;
            }
            string day = Server.Time.ToString("yyyyMMdd");
            if (day != _dayKey) { _dayKey = day; _dayStartEquity = Math.Max(bal, eq); }
            if (_stoppedDay == day) return false;
            if (eq <= _dayStartEquity * (1 - DailyLossPct / 100.0))
            {
                CloseEverything(string.Format("equity {0:F2} under today's loss limit {1:F2}", eq, _dayStartEquity * (1 - DailyLossPct / 100.0)));
                _stoppedDay = day; return false;
            }
            return true;
        }
        private double OpenRiskPct()
        {
            double tot = 0;
            foreach (var p in Positions)
            {
                if (p.Label == null || !p.Label.StartsWith(LabelPrefix) || !p.StopLoss.HasValue) continue;
                var sym = Symbols.GetSymbol(p.SymbolName); double dist = p.TradeType == TradeType.Buy ? p.EntryPrice - p.StopLoss.Value : p.StopLoss.Value - p.EntryPrice;
                if (dist > 0) tot += dist / sym.PipSize * sym.PipValue * p.VolumeInUnits;
            }
            foreach (var o in PendingOrders)
            {
                if (o.Label == null || !o.Label.StartsWith(LabelPrefix) || !o.StopLoss.HasValue) continue;
                var sym = Symbols.GetSymbol(o.SymbolName); tot += Math.Abs(o.TargetPrice - o.StopLoss.Value) / sym.PipSize * sym.PipValue * o.VolumeInUnits;
            }
            return Account.Equity > 0 ? tot / Account.Equity * 100.0 : 0;
        }

        // ---------- feed ----------
        private List<Sig> Fetch()
        {
            string txt;
            // raw.githubusercontent.com caches for up to 5 min; a changing query string bypasses that cache
            string url = Url + (Url.Contains("?") ? "&" : "?") + "cb=" + ((long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds).ToString();
            try { txt = _http.GetStringAsync(url).Result; } catch (Exception e) { Print("CouncilBridge: fetch failed {0}", e.Message); return null; }
            var lines = txt.Split('\n'); string[] head = null; var outp = new List<Sig>();
            foreach (var raw in lines)
            {
                var ln = raw.Trim(); if (ln.Length == 0 || ln[0] == '#') continue;
                var f = ln.Split(',');
                if (head == null) { head = f; for (int i = 0; i < head.Length; i++) head[i] = head[i].Trim(); continue; }
                Func<string, string> g = name => { int i = Array.IndexOf(head, name); return i >= 0 && i < f.Length ? f[i].Trim() : ""; };
                Func<string, double> gd = name => { double d; return double.TryParse(g(name), NumberStyles.Any, CultureInfo.InvariantCulture, out d) ? d : 0; };
                Func<string, long> gl = name => { long d; return long.TryParse(g(name), NumberStyles.Any, CultureInfo.InvariantCulture, out d) ? d : 0; };
                var s = new Sig { Id = g("id"), Market = g("market"), K = g("k"), Side = g("side"), Status = g("status"), EntryMode = g("entryMode"), AddOf = g("addOf"), Entry = gd("entry"), Stop = gd("stop"), T1 = gd("t1"), Size = gd("size"), Opened = gl("opened"), Filled = gl("filled"), ValidFor = gl("validFor") };
                if (s.Id.Length > 0) outp.Add(s);
            }
            return outp;
        }

        // ---------- mirroring ----------
        private string SymFor(string m) { switch (m) { case "xau": return SymGold; case "nq": return SymNQ; case "btc": return SymBTC; case "eth": return SymETH; case "sol": return SymSOL; case "xrp": return SymXRP; } return ""; }
        private double RiskFor(string k) { switch (k) { case "gtrend": return RiskGoldTrend; case "replica": case "gtrend5": case "gtl": case "geg": return RiskGold; case "mosha-bo": return RiskMosha; case "trend": return RiskCrypto; case "nq-open": return RiskNQ; } return 0; }
        private bool EnabledFor(string k) { switch (k) { case "replica": case "gtrend": case "gtrend5": case "gtl": case "geg": return MirrorGold; case "mosha-bo": return MirrorMosha; case "trend": return MirrorCrypto; case "nq-open": return MirrorNQ; } return false; }
        private static bool IsClosed(string st) { return st == "win" || st == "loss" || st == "be" || st == "expired" || st == "missed" || st == "skipped" || st == "cancelled"; }
        private Position PosFor(string id) { foreach (var p in Positions) if (p.Label == LabelPrefix + id) return p; return null; }
        private PendingOrder OrdFor(string id) { foreach (var o in PendingOrders) if (o.Label == LabelPrefix + id) return o; return null; }

        private double UnitsForRisk(Symbol sym, double entry, double stop, double riskPct)
        {
            double dist = Math.Abs(entry - stop); if (dist <= 0 || sym.PipValue <= 0) return 0;
            double risk = Account.Equity * riskPct / 100.0, units = risk / (dist / sym.PipSize * sym.PipValue);
            units = sym.NormalizeVolumeInUnits(units, RoundingMode.Down);
            return units < sym.VolumeInUnitsMin ? 0 : Math.Min(units, sym.VolumeInUnitsMax);
        }
        private void Handle(Sig s)
        {
            if (!EnabledFor(s.K)) return;
            string symName = SymFor(s.Market); if (string.IsNullOrEmpty(symName)) return;
            var pos = PosFor(s.Id); var ord = OrdFor(s.Id); bool buy = s.Side == "buy";
            if (IsClosed(s.Status)) { if (pos != null) { ClosePosition(pos); Print("CouncilBridge: closed {0} ({1})", s.Id, s.Status); } else if (ord != null) { CancelPendingOrder(ord); Print("CouncilBridge: cancelled {0}", s.Id); } return; }
            Symbol sym; try { sym = Symbols.GetSymbol(symName); } catch { return; }
            if (sym == null) return;
            double sl = Math.Round(s.Stop, sym.Digits), tp = s.T1 > 0 ? Math.Round(s.T1, sym.Digits) : 0;
            if (pos != null)
            {
                // keep the stop (breakeven / trailing from the council) and the target in sync; never loosen a stop
                double cur = pos.StopLoss ?? (buy ? 0 : double.MaxValue);
                bool better = buy ? sl > cur + sym.TickSize : sl < cur - sym.TickSize;
                if (better) pos.ModifyStopLossPrice(sl);
                if (tp > 0 && (!pos.TakeProfit.HasValue || Math.Abs(pos.TakeProfit.Value - tp) > sym.TickSize)) pos.ModifyTakeProfitPrice(tp);
                return;
            }
            if (ord != null)
            {
                if (s.Status == "open") return;
                if (!ord.StopLoss.HasValue || Math.Abs(ord.StopLoss.Value - sl) > sym.TickSize) ord.ModifyStopLossPrice(sl);
                if (tp > 0 && (!ord.TakeProfit.HasValue || Math.Abs(ord.TakeProfit.Value - tp) > sym.TickSize)) ord.ModifyTakeProfitPrice(tp);
                return;
            }
            if (_skipped.Contains(s.Id)) return;
            // was it ours before (closed by the broker stop / target)? then the id lives in history: do not re-enter
            foreach (var h in History) if (h.Label == LabelPrefix + s.Id) { _skipped.Add(s.Id); return; }
            if (OpenRiskPct() >= MaxOpenRiskPct) { Print("CouncilBridge: open risk cap, skipping {0}", s.Id); return; }
            // lots: an add takes the same volume as its first trade
            double units = 0;
            if (!string.IsNullOrEmpty(s.AddOf)) { var parent = PosFor(s.AddOf); if (parent != null) units = parent.VolumeInUnits; }
            double sz = (s.Size > 0 && s.Size < 4) ? s.Size : 1.0;   // the Trader's size (replica 0.5 / 1.5 tilts); adds copy the parent's volume above
            if (units <= 0) units = UnitsForRisk(sym, s.Entry, s.Stop, RiskFor(s.K) * sz);
            if (units <= 0) { Print("CouncilBridge: volume too small for {0}, skipped", s.Id); _skipped.Add(s.Id); return; }
            long now = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds;
            double slPips = Math.Abs(s.Entry - sl) / sym.PipSize, tpPips = tp > 0 ? Math.Abs(tp - s.Entry) / sym.PipSize : 0;
            if (s.Status == "pending" && s.EntryMode == "limit")
            {
                if (s.ValidFor > 0 && now > s.Opened + s.ValidFor) { _skipped.Add(s.Id); return; }
                DateTime? exp = s.ValidFor > 0 ? (DateTime?)new DateTime(1970, 1, 1).AddSeconds(s.Opened + s.ValidFor) : null;
                if (!DemoOnly()) return;
                var r = PlaceLimitOrder(buy ? TradeType.Buy : TradeType.Sell, symName, units, Math.Round(s.Entry, sym.Digits), LabelPrefix + s.Id, sl, tp > 0 ? (double?)tp : null, exp, s.Id);   // absolute stop / target prices
                if (r.IsSuccessful) Print("CouncilBridge: limit {0} {1} {2} @ {3} {4}", s.Side, symName, units, s.Entry, s.Id); else { Print("CouncilBridge: limit failed {0}: {1}", s.Id, r.Error); _skipped.Add(s.Id); }
                return;
            }
            if (s.Status == "open")
            {
                long t0 = s.Filled > 0 ? s.Filled : s.Opened;
                if (now - t0 > (long)MaxLateMin * 60) { _skipped.Add(s.Id); Print("CouncilBridge: too late for {0}", s.Id); return; }
                double r0 = Math.Abs(s.Entry - s.Stop), px = buy ? sym.Ask : sym.Bid;
                if (r0 <= 0 || Math.Abs(px - s.Entry) > MaxSlipR * r0) { _skipped.Add(s.Id); Print("CouncilBridge: price moved, skipped {0}", s.Id); return; }
                if (buy ? sl >= px : sl <= px) { _skipped.Add(s.Id); return; }
                // stop and target as absolute prices: place with pips from the current price, then set the exact levels
                double slP = Math.Abs(px - sl) / sym.PipSize, tpP = tp > 0 ? Math.Abs(tp - px) / sym.PipSize : 0;
                if (!DemoOnly()) return;
                var r = ExecuteMarketOrder(buy ? TradeType.Buy : TradeType.Sell, symName, units, LabelPrefix + s.Id, slP, tpP > 0 ? (double?)tpP : null, s.Id);
                if (r.IsSuccessful && r.Position != null) { r.Position.ModifyStopLossPrice(sl); if (tp > 0) r.Position.ModifyTakeProfitPrice(tp); Print("CouncilBridge: market {0} {1} {2} {3}", s.Side, symName, units, s.Id); }
                else { Print("CouncilBridge: market order failed {0}: {1}", s.Id, r.Error); _skipped.Add(s.Id); }
            }
        }
    }
}
