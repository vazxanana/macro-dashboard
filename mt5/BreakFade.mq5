//+------------------------------------------------------------------+
//| BreakFade.mq5 — the Equinox "Break fade" on M15 for MetaTrader 5. |
//| Standalone: it reads the broker's own 15-minute candles, needs no |
//| internet and no council feed. One instance trades every symbol in |
//| its list; attach it to any one chart.                             |
//|                                                                  |
//| The rule is the study cell "m15 none atr 2R all" of               |
//| research/edge/grid7-wide-fade (the same rule as ctrader/BreakFade.cs):|
//|  - Structure on CLOSED M15 candles. A swing high is a candle whose|
//|    high is above the 3 candles before it and at or above the 3    |
//|    after it (a swing low mirrors); it counts once those 3 later   |
//|    candles have closed, from the candle after them.               |
//|  - A break = an M15 close above the last confirmed swing high not |
//|    yet closed above, or below the last swing low not yet closed   |
//|    below. Each swing is broken once.                              |
//|  - The trade FADES the break at market when the candle has closed:|
//|    a break up is sold, a break down is bought.                    |
//|  - Stop 1 x ATR(14) of M15 from the fill, target 2R, closed at    |
//|    market 24 hours after the fill.                                |
//|                                                                  |
//| READ THIS FIRST. The study passed BEFORE costs and LOSES AFTER    |
//| costs (2015-26, ten markets: +0.042R a trade before costs,        |
//| -0.118R after). It is not an edge. Demo accounts only: the program|
//| refuses any other account. It starts in dry run (log only).       |
//| Use a hedging account: on a netting account overlapping trades of |
//| one symbol merge into one position.                               |
//+------------------------------------------------------------------+
#property copyright "macro-dashboard council"
#property version   "1.00"
#property strict
#include <Trade\Trade.mqh>

input long   InpMagic        = 261124;
input string InpSymbols      = "XAUUSD,XAGUSD,EURUSD,GBPUSD,USDJPY,AUDUSD,NZDUSD,USDCAD,USDCHF,EURJPY";   // your broker's names
input double InpRiskPct      = 0.25;   // % of equity risked per trade
input int    InpMaxPerSymbol = 3;      // open trades allowed on one symbol
input int    InpMaxOpen      = 30;     // open trades allowed in all
input int    InpFromHour     = 0;      // trade from this hour (UTC, 0-23)
input int    InpUntilHour    = 24;     // until this hour (UTC, 1-24, not included)
input double InpMaxSpreadPct = 100.0;  // skip when the spread is over this % of the stop distance
input bool   InpDryRun       = true;   // log only, send no orders
input int    InpSlippagePts  = 30;

#define BF_SWING 3
#define BF_ATRN 14
#define BF_STOP_ATR 1.0
#define BF_TARGET_R 2.0
#define BF_HOLD_SEC 86400
#define BF_LOOK 600
#define BF_LATE_SEC 90

CTrade trade;
string g_sym[]; datetime g_last[];

// Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account that
// is not a demo (a real or contest account). Checked on start, on every poll and right before every order it sends; on a refusal
// it says why and removes itself without sending anything. ACCOUNT_TRADE_MODE is the platform's own account-type flag.
bool DemoOnly() {
  if (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) return true;
  Print("BreakFade refused: account ", AccountInfoInteger(ACCOUNT_LOGIN), " is not a demo account (real or contest). This program runs on demo accounts only; it stops now and sends nothing.");
  ExpertRemove();
  return false;
}

int OnInit() { if (!DemoOnly()) return INIT_FAILED;
  trade.SetExpertMagicNumber(InpMagic); trade.SetDeviationInPoints(InpSlippagePts);
  string parts[]; int n = StringSplit(InpSymbols, ',', parts); ArrayResize(g_sym, 0); ArrayResize(g_last, 0);
  for (int i = 0; i < n; i++) { string s = parts[i]; StringTrimLeft(s); StringTrimRight(s); if (StringLen(s) == 0) continue;
    if (!SymbolSelect(s, true)) { Print("BreakFade: symbol ", s, " not found at this broker, skipped"); continue; }
    int k = ArraySize(g_sym); ArrayResize(g_sym, k + 1); ArrayResize(g_last, k + 1); g_sym[k] = s; g_last[k] = 0; }
  Print("BreakFade started on ", ArraySize(g_sym), " symbols: risk ", InpRiskPct, "% a trade, hours ", InpFromHour, "-", InpUntilHour, " UTC, dry run ", InpDryRun ? "ON" : "off", ". The rule loses after costs in its study: demo only.");
  EventSetTimer(2);
  return INIT_SUCCEEDED; }
void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() {
  if (!DemoOnly()) return;
  manage();
  for (int i = 0; i < ArraySize(g_sym); i++) checkSymbol(i);
}

int countOurs(string sym) { int c = 0; for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic && (sym == "" || PositionGetString(POSITION_SYMBOL) == sym)) c++; } return c; }

// Rule 1 of the desk: no position without a stop. And the 24-hour time limit.
void manage() {
  for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (!PositionSelectByTicket(t) || PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
    string s = PositionGetString(POSITION_SYMBOL);
    if (PositionGetDouble(POSITION_SL) <= 0) { Print("BreakFade ", s, ": closed, it has no stop"); trade.PositionClose(t); continue; }
    if (TimeTradeServer() >= (datetime)PositionGetInteger(POSITION_TIME) + BF_HOLD_SEC) { Print("BreakFade ", s, ": closed, 24-hour time limit"); trade.PositionClose(t); } }
}

// The study's structure walk over the closed candles r[0..c] (oldest first); returns the break made by candle c (+1 up, -1 down, 0 none).
int breakAt(const MqlRates &r[], int c) {
  int start = MathMax(BF_SWING, c - BF_LOOK); double hi = 0, lo = 0; bool hasHi = false, hasLo = false; int res = 0;
  for (int j = start + BF_SWING + 1; j <= c; j++) {
    int i = j - BF_SWING - 1;                       // the swing confirmed by the candle before j
    if (i >= start) { bool isHi = true, isLo = true;
      for (int k = 1; k <= BF_SWING; k++) { if (!(r[i].high > r[i - k].high && r[i].high >= r[i + k].high)) isHi = false; if (!(r[i].low < r[i - k].low && r[i].low <= r[i + k].low)) isLo = false; }
      if (isHi) { hi = r[i].high; hasHi = true; } if (isLo) { lo = r[i].low; hasLo = true; } }
    double cl = r[j].close; int d = 0;
    if (hasHi && cl > hi) { d = 1; hasHi = false; } else if (hasLo && cl < lo) { d = -1; hasLo = false; }
    if (j == c) res = d; }
  return res;
}

// plain average of the 14 true ranges ending at candle c (the study's atr14)
double atrAt(const MqlRates &r[], int c) { double s = 0; for (int i = c - BF_ATRN + 1; i <= c; i++) s += MathMax(r[i].high - r[i].low, MathMax(MathAbs(r[i].high - r[i - 1].close), MathAbs(r[i].low - r[i - 1].close))); return s / BF_ATRN; }

double lotsFor(string sym, double dist) {
  double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE), tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE), step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), mn = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), mx = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
  if (dist <= 0 || ts <= 0 || tv <= 0) return 0; if (step <= 0) step = 0.01;
  double lots = MathFloor(AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPct / 100.0 / (dist / ts * tv) / step + 1e-9) * step;
  if (lots < mn) return 0; return MathMin(lots, mx);
}

// Act once per newly CLOSED M15 candle per symbol
void checkSymbol(int k) {
  string sym = g_sym[k]; MqlRates r[]; int n = CopyRates(sym, PERIOD_M15, 1, BF_LOOK + 20, r); if (n < 60) return;
  int c = n - 1; datetime t = r[c].time; bool first = g_last[k] == 0; if (g_last[k] == t) return; g_last[k] = t;
  int dir = breakAt(r, c); if (dir == 0) return;
  long late = (long)(TimeTradeServer() - (t + 900));
  if (first || late > BF_LATE_SEC) { Print("BreakFade ", sym, ": a break ", dir > 0 ? "up" : "down", " at the ", TimeToString(t, TIME_MINUTES), " candle was seen ", late, " s after its close, not traded"); return; }
  MqlDateTime g; TimeToStruct(TimeGMT(), g); if (g.hour < InpFromHour || g.hour >= InpUntilHour) return;
  fade(sym, dir, atrAt(r, c), t);
}

void fade(string sym, int dir, double atr, datetime candle) {
  double dist = BF_STOP_ATR * atr; if (dist <= 0) return;
  int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS); double bid = SymbolInfoDouble(sym, SYMBOL_BID), ask = SymbolInfoDouble(sym, SYMBOL_ASK); if (bid <= 0 || ask <= 0) return;
  string what = StringFormat("%s after a break %s at the %s candle, stop %s away, target %.0fR", dir > 0 ? "SELL" : "BUY", dir > 0 ? "up" : "down", TimeToString(candle, TIME_MINUTES), DoubleToString(dist, dg), BF_TARGET_R);
  if (ask - bid > dist * InpMaxSpreadPct / 100.0) { Print("BreakFade ", sym, ": ", what, ": skipped, the spread is over ", InpMaxSpreadPct, "% of the stop"); return; }
  if (countOurs(sym) >= InpMaxPerSymbol) { Print("BreakFade ", sym, ": ", what, ": skipped, ", InpMaxPerSymbol, " already open on this symbol"); return; }
  if (countOurs("") >= InpMaxOpen) { Print("BreakFade ", sym, ": ", what, ": skipped, ", InpMaxOpen, " already open in all"); return; }
  double lots = lotsFor(sym, dist); if (lots <= 0) { Print("BreakFade ", sym, ": ", what, ": skipped, the smallest lot would risk more than ", InpRiskPct, "%"); return; }
  double fill = dir > 0 ? bid : ask, stop = NormalizeDouble(fill + dir * dist, dg), tp = NormalizeDouble(fill - dir * BF_TARGET_R * dist, dg);
  Print("BreakFade ", sym, ": ", what, ", ", lots, " lots, stop ", stop, ", target ", tp);
  if (InpDryRun) return;
  trade.SetTypeFillingBySymbol(sym);
  if (!DemoOnly()) return;
  bool ok = dir > 0 ? trade.Sell(lots, sym, 0, stop, tp, "break-fade") : trade.Buy(lots, sym, 0, stop, tp, "break-fade");
  if (!ok) Print("BreakFade ", sym, ": order failed ", trade.ResultRetcodeDescription());
}
