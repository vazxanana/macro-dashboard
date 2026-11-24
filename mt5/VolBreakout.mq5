//+------------------------------------------------------------------+
//| VolBreakout.mq5 — the desk's daily volatility breakout ("T1") on  |
//| gold and USD/JPY for MetaTrader 5. Standalone: the broker's own   |
//| candles, no internet. One instance trades every symbol in its     |
//| list; attach it to any one chart. Same rule as ctrader/VolBreakout.cs.|
//|                                                                  |
//| These are the two rules that pass the desk's tests at measured    |
//| costs: gold +0.105R a trade 2021-26 (n 1,121, month t 2.79) and   |
//| +0.184R at the broker's own ticks (n 572, t 3.54); USD/JPY +0.079R|
//| 2005-15 (n 2,089, t 2.95), +0.063R 2016-26 (n 2,079, t 2.50).     |
//| Drawdowns were long (USD/JPY 33.8R over 574 days). The rule FAILED|
//| on every other market tested: keep the list to these two.         |
//|                                                                  |
//| The rule: O = the open of the UTC day. R = the previous trading   |
//| day's high minus low (UTC days; weekend candles belong to the next|
//| weekday). In the first 20 minutes of a weekday: BUY STOP at       |
//| O + 0.5 x R and SELL STOP at O - 0.5 x R, each with its stop at O.|
//| A day that already traded through a level is missed. The first    |
//| fill cancels the other order. No target. Out at 21:00 UTC.        |
//| Demo accounts only. It starts in dry run (log only).              |
//+------------------------------------------------------------------+
#property copyright "macro-dashboard council"
#property version   "1.00"
#property strict
#include <Trade\Trade.mqh>

input long   InpMagic       = 261126;
input string InpSymbols     = "XAUUSD,USDJPY";   // your broker's names
input double InpRiskPct     = 0.25;              // % of equity risked per trade
input bool   InpDryRun      = true;              // log only, send no orders
input int    InpSlippagePts = 30;

#define VB_K 0.5
#define VB_PLACE_UNTIL_S 1200
#define VB_EXIT_S 75600

CTrade trade;
string g_sym[]; datetime g_done[];

// Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account that
// is not a demo (a real or contest account). Checked on start, on every poll and right before every order it sends; on a refusal
// it says why and removes itself without sending anything. ACCOUNT_TRADE_MODE is the platform's own account-type flag.
bool DemoOnly() {
  if (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) return true;
  Print("VolBreakout refused: account ", AccountInfoInteger(ACCOUNT_LOGIN), " is not a demo account (real or contest). This program runs on demo accounts only; it stops now and sends nothing.");
  ExpertRemove();
  return false;
}

int OnInit() { if (!DemoOnly()) return INIT_FAILED;
  trade.SetExpertMagicNumber(InpMagic); trade.SetDeviationInPoints(InpSlippagePts);
  string parts[]; int n = StringSplit(InpSymbols, ',', parts); ArrayResize(g_sym, 0); ArrayResize(g_done, 0);
  for (int i = 0; i < n; i++) { string s = parts[i]; StringTrimLeft(s); StringTrimRight(s); if (StringLen(s) == 0) continue;
    if (!SymbolSelect(s, true)) { Print("VolBreakout: symbol ", s, " not found at this broker, skipped"); continue; }
    int k = ArraySize(g_sym); ArrayResize(g_sym, k + 1); ArrayResize(g_done, k + 1); g_sym[k] = s; g_done[k] = 0; }
  Print("VolBreakout started on ", ArraySize(g_sym), " symbols: risk ", InpRiskPct, "% a trade, dry run ", InpDryRun ? "ON" : "off", ". Demo only.");
  EventSetTimer(5);
  return INIT_SUCCEEDED; }
void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() {
  if (!DemoOnly()) return;
  for (int i = 0; i < ArraySize(g_sym); i++) stepSymbol(i);
}

double lotsFor(string sym, double dist) {
  double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE), tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE), step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), mn = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), mx = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
  if (dist <= 0 || ts <= 0 || tv <= 0) return 0; if (step <= 0) step = 0.01;
  double lots = MathFloor(AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPct / 100.0 / (dist / ts * tv) / step + 1e-9) * step;
  if (lots < mn) return 0; return MathMin(lots, mx);
}
int ourPositions(string sym, bool closeAll, datetime dayServer) { int c = 0;
  for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (!PositionSelectByTicket(t) || PositionGetInteger(POSITION_MAGIC) != InpMagic || PositionGetString(POSITION_SYMBOL) != sym) continue; c++;
    bool old = (datetime)PositionGetInteger(POSITION_TIME) < dayServer;
    if (PositionGetDouble(POSITION_SL) <= 0) { Print("VolBreakout ", sym, ": closed, it has no stop"); trade.PositionClose(t); }
    else if (closeAll || old) { Print("VolBreakout ", sym, ": 21:00 UTC exit"); trade.PositionClose(t); } }
  return c; }
int ourOrders(string sym, bool cancelAll) { int c = 0;
  for (int i = OrdersTotal() - 1; i >= 0; i--) { ulong t = OrderGetTicket(i); if (!OrderSelect(t) || OrderGetInteger(ORDER_MAGIC) != InpMagic || OrderGetString(ORDER_SYMBOL) != sym) continue; c++; if (cancelAll) trade.OrderDelete(t); }
  return c; }
bool tradedToday(string sym, datetime dayServer) { if (!HistorySelect(dayServer, TimeTradeServer() + 60)) return false;
  for (int i = HistoryDealsTotal() - 1; i >= 0; i--) { ulong d = HistoryDealGetTicket(i); if (HistoryDealGetInteger(d, DEAL_MAGIC) == InpMagic && HistoryDealGetString(d, DEAL_SYMBOL) == sym) return true; }
  return false; }

void stepSymbol(int k) {
  string sym = g_sym[k]; datetime gmt = TimeGMT(), off = TimeTradeServer() - gmt;                 // server clock minus UTC, measured now
  datetime day = gmt - gmt % 86400, dayServer = day + off; int sec = (int)(gmt - day);
  bool exit = sec >= VB_EXIT_S;
  int pos = ourPositions(sym, exit, dayServer), ord = ourOrders(sym, exit || pos > 0);            // one filled, or 21:00: the orders go
  if (exit) return;
  MqlDateTime d; TimeToStruct(day, d); if (d.day_of_week == 0 || d.day_of_week == 6) return;
  if (sec < 15 || sec > VB_PLACE_UNTIL_S || g_done[k] == day) return;
  if (pos > 0 || ord > 0 || tradedToday(sym, dayServer)) { g_done[k] = day; return; }
  // today's candles so far: the first one's open is the day's open
  MqlRates r[]; int n = CopyRates(sym, PERIOD_M5, dayServer, TimeTradeServer() + 60, r); if (n < 1) return;       // none yet: next poll
  if (r[0].time - dayServer >= 3600) { g_done[k] = day; Print("VolBreakout ", sym, ": the day has no candle in its first hour, no orders today"); return; }
  double O = r[0].open, hi = r[0].high, lo = r[0].low; for (int i = 1; i < n; i++) { hi = MathMax(hi, r[i].high); lo = MathMin(lo, r[i].low); }
  // the previous trading day: the last weekday before today; a Monday starts on Saturday 00:00 (it holds Sunday evening)
  datetime prev = day - 86400; MqlDateTime p; TimeToStruct(prev, p); while (p.day_of_week == 0 || p.day_of_week == 6) { prev -= 86400; TimeToStruct(prev, p); }
  datetime from = (p.day_of_week == 1 ? prev - 2 * 86400 : prev) + off, to = prev + 86400 + off;
  MqlRates q[]; int m = CopyRates(sym, PERIOD_M5, from, to - 1, q);
  g_done[k] = day;
  if (m < 50) { Print("VolBreakout ", sym, ": no range for the previous trading day (", m, " candles), no orders today"); return; }
  double ph = q[0].high, pl = q[0].low; for (int i = 1; i < m; i++) { ph = MathMax(ph, q[i].high); pl = MathMin(pl, q[i].low); }
  double dist = VB_K * (ph - pl); if (dist <= 0) return;
  int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS); double buyAt = NormalizeDouble(O + dist, dg), sellAt = NormalizeDouble(O - dist, dg), stop = NormalizeDouble(O, dg);
  if (hi >= buyAt || lo <= sellAt) { Print("VolBreakout ", sym, ": the day already traded through a level, missed"); return; }
  double lots = lotsFor(sym, dist); if (lots <= 0) { Print("VolBreakout ", sym, ": the smallest lot would risk more than ", InpRiskPct, "%, no orders today"); return; }
  datetime exp = dayServer + VB_EXIT_S;
  Print("VolBreakout ", sym, ": open ", O, ", previous range ", ph - pl, ": BUY STOP ", buyAt, ", SELL STOP ", sellAt, ", stop at the open, ", lots, " lots, out at 21:00 UTC", InpDryRun ? " (dry run, nothing sent)" : "");
  if (InpDryRun) return;
  trade.SetTypeFillingBySymbol(sym);
  if (!DemoOnly()) return;
  if (!trade.BuyStop(lots, buyAt, sym, stop, 0, ORDER_TIME_SPECIFIED, exp, "vol-breakout")) Print("VolBreakout ", sym, ": buy stop failed ", trade.ResultRetcodeDescription());
  if (!DemoOnly()) return;
  if (!trade.SellStop(lots, sellAt, sym, stop, 0, ORDER_TIME_SPECIFIED, exp, "vol-breakout")) Print("VolBreakout ", sym, ": sell stop failed ", trade.ResultRetcodeDescription());
}
