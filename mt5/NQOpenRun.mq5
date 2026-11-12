//+------------------------------------------------------------------+
//| NQOpenRun.mq5 — the council's NQ New York open run, executed      |
//| natively on the broker's NAS100 / USTEC 1-minute feed (the        |
//| council bot's own NQ feed is 10 min late, so it cannot mirror it).|
//| Attach to the NAS100 M1 chart. One trade per New York day.        |
//|                                                                  |
//| Rule (council/trader.mjs nqOpenSweep + nyflip, 5 Nov 2026):       |
//|  O = open of the 09:30 ET minute. From 09:31 to 10:59 ET, price   |
//|  runs at least 0.08% of O through O (either side, the first side  |
//|  to break is tracked from its first break) and within 15 minutes  |
//|  of that first break a 1-minute candle closes back across O in    |
//|  the reclaim direction (bullish close above O after a run below,  |
//|  bearish close below O after a run above). Trade WITH the run     |
//|  (against the reclaim): run below O -> SELL at the close, stop    |
//|  the same distance above the entry as the run extreme + 0.011% of |
//|  O is below it; run above -> BUY. Only when the 00:00 ET open lies |
//|  on the far side ("midnight open ahead"): sell needs the midnight |
//|  open above the entry, buy needs it below. After +2R the stop     |
//|  trails 1R behind the best price (cap 10R); out at 11:00 ET.      |
//+------------------------------------------------------------------+
#property copyright "macro-dashboard council"
#property version   "1.00"
#property strict
#include <Trade\Trade.mqh>

input long   InpMagic        = 260512;
input double InpRiskPct      = 0.25;   // % of equity risked per trade
input double InpMinRunPct    = 0.08;   // run through the open, % of the opening price (council: 0.0008)
input double InpBufPct       = 0.011;  // stop buffer beyond the run extreme, % of the opening price (council: 0.00011)
input int    InpReclaimMin   = 15;     // the close back across the open must come within this many minutes of the first break
input int    InpWindowEndMin = 660;    // last minute of the day (ET minutes) a signal can fire / position is closed: 660 = 11:00 ET
input double InpTrailAtR     = 2.0;    // start trailing after this many R
input double InpTrailBehindR = 1.0;    // trail this many R behind the best price
input double InpCapR         = 10.0;   // take-profit cap
input bool   InpNeedMidnight = true;   // midnight-open filter (council live rule)
input double InpMaxSlipR     = 0.3;    // do not enter if the market moved more than this x R from the signal close
input int    InpSlippagePts  = 50;
// prop-firm guards (same as CouncilBridge; both EAs share the account, keep the limits consistent)
input double InpDailyLossPct = 1.5;
input double InpMaxDDPct     = 6.0;
input double InpStartBalance = 0;

CTrade trade;

// Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account that
// is not a demo (a real or contest account). Checked on start and right before every order it sends; on a refusal it says why and
// removes itself without sending anything. ACCOUNT_TRADE_MODE is the platform's own account-type flag.
bool DemoOnly() {
  if (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) return true;
  Print("NQOpenRun refused: account ", AccountInfoInteger(ACCOUNT_LOGIN), " is not a demo account (real or contest). This program runs on demo accounts only; it stops now and sends nothing.");
  ExpertRemove();
  return false;
}
string GVP = "NQ.";
double gvGet(string k) { return GlobalVariableCheck(GVP + k) ? GlobalVariableGet(GVP + k) : 0; }
void   gvSet(string k, double v) { GlobalVariableSet(GVP + k, v); }

// ---- New York clock: GMT minus 5 h, minus 4 h in US daylight time (2nd Sunday of March 02:00 to 1st Sunday of November 02:00)
int nthSunday(int y, int m, int n) { MqlDateTime d; d.year = y; d.mon = m; d.day = 1; d.hour = 0; d.min = 0; d.sec = 0; datetime t = StructToTime(d); TimeToStruct(t, d); int first = 1 + ((7 - d.day_of_week) % 7); return first + 7 * (n - 1); }
bool nyDst(datetime gmt) { MqlDateTime d; TimeToStruct(gmt - 5 * 3600, d); if (d.mon < 3 || d.mon > 11) return false; if (d.mon > 3 && d.mon < 11) return true;
  int s = d.mon == 3 ? nthSunday(d.year, 3, 2) : nthSunday(d.year, 11, 1); if (d.mon == 3) return d.day > s || (d.day == s && d.hour >= 2); return d.day < s || (d.day == s && d.hour < 2); }
// ET date key and minute of day for a bar time given in SERVER time
void etParts(datetime serverTime, string &day, int &minute, int &wd) {
  datetime gmt = serverTime - (TimeTradeServer() - TimeGMT());   // server offset from GMT, measured now
  datetime et = gmt - (nyDst(gmt) ? 4 : 5) * 3600; MqlDateTime d; TimeToStruct(et, d);
  day = StringFormat("%04d-%02d-%02d", d.year, d.mon, d.day); minute = d.hour * 60 + d.min; wd = d.day_of_week;
}

// ---- state for the current New York day
string g_day = ""; double g_O = 0, g_ndo = 0; bool g_haveO = false, g_haveNdo = false, g_done = false;
bool g_liveL = false, g_liveH = false; datetime g_tL = 0, g_tH = 0; double g_extL = 0, g_extH = 0;
// open position bookkeeping
ulong g_ticket = 0; double g_entry = 0, g_r0 = 0, g_mfe = 0; bool g_sell = false; bool g_trailMoved = false;

double normLots(double lots) { double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP), mn = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), mx = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX); if (step <= 0) step = 0.01; lots = MathFloor(lots / step + 1e-9) * step; if (lots < mn) return 0; return MathMin(lots, mx); }
double lotsForRisk(double entry, double stop) { double dist = MathAbs(entry - stop), ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE), tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE); if (dist <= 0 || ts <= 0 || tv <= 0) return 0; return normLots(AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPct / 100.0 / (dist / ts * tv)); }
double px(double p) { return NormalizeDouble(p, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)); }

bool guardsOk() {
  double bal = AccountInfoDouble(ACCOUNT_BALANCE), eq = AccountInfoDouble(ACCOUNT_EQUITY);
  double start = InpStartBalance > 0 ? InpStartBalance : gvGet("startBalance"); if (start <= 0) { start = bal; gvSet("startBalance", start); }
  if (gvGet("blocked") >= 1) return false;
  if (eq <= start * (1 - InpMaxDDPct / 100.0)) { closeOurs("max drawdown floor"); gvSet("blocked", 1); return false; }
  MqlDateTime dt; TimeToStruct(TimeTradeServer(), dt); string k = StringFormat("day.%04d%02d%02d", dt.year, dt.mon, dt.day);
  double ds = gvGet(k); if (ds <= 0) { ds = MathMax(bal, eq); gvSet(k, ds); }
  if (gvGet(k + ".stop") >= 1) return false;
  if (eq <= ds * (1 - InpDailyLossPct / 100.0)) { closeOurs("daily loss limit"); gvSet(k + ".stop", 1); return false; }
  return true;
}
void closeOurs(string why) { for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic && PositionGetString(POSITION_SYMBOL) == _Symbol) { trade.PositionClose(t); Print("NQOpenRun: closed — ", why); } } g_ticket = 0; }

void resetDay(string day) { g_day = day; g_O = 0; g_ndo = 0; g_haveO = false; g_haveNdo = false; g_done = false; g_liveL = false; g_liveH = false; g_extL = 0; g_extH = 0; }

// find the 00:00 ET open and the 09:30 ET open among today's bars already on the chart (in case the EA started late)
void scanDay(string day, int uptoMinute) {
  MqlRates r[]; int n = CopyRates(_Symbol, PERIOD_M1, 1, 1500, r); if (n <= 0) return;
  for (int i = n - 1; i >= 0; i--) { string d; int m, wd; etParts(r[i].time, d, m, wd); if (d != day) continue;
    if (m == 0 && !g_haveNdo) { g_ndo = r[i].open; g_haveNdo = true; }
    if (m == 570 && !g_haveO) { g_O = r[i].open; g_haveO = true; }
  }
}

int OnInit() { if (!DemoOnly()) return INIT_FAILED;
  trade.SetExpertMagicNumber(InpMagic); trade.SetDeviationInPoints(InpSlippagePts); trade.SetTypeFillingBySymbol(_Symbol);
  // adopt an open position of ours after a restart
  for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic && PositionGetString(POSITION_SYMBOL) == _Symbol) { g_ticket = t; g_entry = PositionGetDouble(POSITION_PRICE_OPEN); g_sell = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL; g_r0 = gvGet("r0"); g_mfe = gvGet("mfe"); g_trailMoved = gvGet("trailMoved") >= 1; } }
  Print("NQOpenRun started on ", _Symbol, ". Demo? ", AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO ? "yes" : "NO");
  return INIT_SUCCEEDED; }
void OnDeinit(const int reason) {}

datetime g_lastBar = 0;
void OnTick() {
  if (!DemoOnly()) return;
  datetime bt = iTime(_Symbol, PERIOD_M1, 0); if (bt == g_lastBar) return; g_lastBar = bt;   // a new M1 bar: work on the one just closed
  MqlRates r[]; if (CopyRates(_Symbol, PERIOD_M1, 1, 1, r) < 1) return; MqlRates b = r[0];
  string day; int m, wd; etParts(b.time, day, m, wd);
  if (day != g_day) { resetDay(day); scanDay(day, m); }
  if (wd == 0 || wd == 6) return;
  if (m == 0) { g_ndo = b.open; g_haveNdo = true; }
  if (m == 570) { g_O = b.open; g_haveO = true; g_liveL = false; g_liveH = false; g_done = false; }
  // ---- manage an open position on each closed minute
  if (g_ticket > 0) {
    if (!PositionSelectByTicket(g_ticket)) { g_ticket = 0; }
    else {
      double fav = (g_sell ? g_entry - b.low : b.high - g_entry) / g_r0; if (fav > g_mfe) { g_mfe = fav; gvSet("mfe", g_mfe); }
      if (m >= InpWindowEndMin || day != g_day) { trade.PositionClose(g_ticket); Print("NQOpenRun: 11:00 ET exit"); g_ticket = 0; return; }
      if (g_mfe >= InpTrailAtR) { double ns = px(g_entry + (g_sell ? -1 : 1) * (g_mfe - InpTrailBehindR) * g_r0), cur = PositionGetDouble(POSITION_SL);
        if (g_sell ? ns < cur : ns > cur) { if (trade.PositionModify(g_ticket, ns, PositionGetDouble(POSITION_TP))) { g_trailMoved = true; gvSet("trailMoved", 1); } } }
      return;
    }
  }
  // ---- signal detection, 09:31 .. window end
  if (!g_haveO || g_done || m <= 570 || m >= InpWindowEndMin) return;
  double minPen = InpMinRunPct / 100.0 * g_O, buf = InpBufPct / 100.0 * g_O;
  if (!g_liveL && b.low < g_O) { g_liveL = true; g_tL = b.time; g_extL = b.low; }
  if (!g_liveH && b.high > g_O) { g_liveH = true; g_tH = b.time; g_extH = b.high; }
  if (g_liveL) g_extL = MathMin(g_extL, b.low);
  if (g_liveH) g_extH = MathMax(g_extH, b.high);
  bool sig = false, sell = false; double ext = 0;
  if (g_liveL && b.time - g_tL <= InpReclaimMin * 60 && MathAbs(g_extL - g_O) >= minPen && b.close > g_O && b.close > b.open) { sig = true; sell = true; ext = g_extL; }      // run below, reclaimed up -> sell WITH the run
  else if (g_liveH && b.time - g_tH <= InpReclaimMin * 60 && MathAbs(g_extH - g_O) >= minPen && b.close < g_O && b.close < b.open) { sig = true; sell = false; ext = g_extH; }   // run above, reclaimed down -> buy
  if (!sig) return;
  g_done = true;   // one signal per day, like the council
  double e0 = b.close, r0 = sell ? (e0 - (ext - buf)) : ((ext + buf) - e0); if (r0 <= 0) return;
  if (InpNeedMidnight) { if (!g_haveNdo) { Print("NQOpenRun: no midnight open on the chart, skipped"); return; } if ((g_ndo - e0) * (sell ? 1 : -1) <= 0) { Print("NQOpenRun: midnight open behind, skipped (council session nyflip-x)"); return; } }
  if (!guardsOk()) return;
  double mkt = sell ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
  if (MathAbs(mkt - e0) > InpMaxSlipR * r0) { Print("NQOpenRun: price moved, skipped"); return; }
  double stop = px(sell ? mkt + r0 : mkt - r0), tp = px(sell ? mkt - InpCapR * r0 : mkt + InpCapR * r0), lots = lotsForRisk(mkt, stop);
  if (lots <= 0) { Print("NQOpenRun: lot size too small, skipped"); return; }
  if (!DemoOnly()) return;
  bool ok = sell ? trade.Sell(lots, _Symbol, 0, stop, tp, "nq-open-run") : trade.Buy(lots, _Symbol, 0, stop, tp, "nq-open-run");
  if (!ok) { Print("NQOpenRun: order failed ", trade.ResultRetcodeDescription()); return; }
  ulong posT = 0; if (HistoryDealSelect(trade.ResultDeal())) posT = (ulong)HistoryDealGetInteger(trade.ResultDeal(), DEAL_POSITION_ID); if (posT == 0) posT = trade.ResultOrder();
  g_ticket = posT; g_entry = trade.ResultPrice() > 0 ? trade.ResultPrice() : mkt; g_r0 = r0; g_sell = sell; g_mfe = 0; g_trailMoved = false; gvSet("r0", r0); gvSet("mfe", 0); gvSet("trailMoved", 0);
  Print("NQOpenRun: ", sell ? "SELL" : "BUY", " ", lots, " @ ", g_entry, " stop ", stop, " (run ", DoubleToString(MathAbs(ext - g_O), 1), " pts through ", g_O, ", midnight open ", g_ndo, ")");
}
