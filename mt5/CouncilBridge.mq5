//+------------------------------------------------------------------+
//| CouncilBridge.mq5 — mirrors the Mosha council's paper trades     |
//| (gold replica, Mosha BO, crypto trend, their adds) on an MT5     |
//| account, with prop-firm guards. Reads mt5/signals.csv that the   |
//| council bot publishes on the council-data branch every 4 min.    |
//|                                                                  |
//| Setup: Tools > Options > Expert Advisors > "Allow WebRequest for |
//| listed URL" and add https://meridianx.dev |
//| Attach to any chart (one instance per account). Demo first.      |
//+------------------------------------------------------------------+
#property copyright "macro-dashboard council"
#property version   "1.00"
#property strict
#include <Trade\Trade.mqh>

input string  InpUrl        = "https://meridianx.dev/cdata/mt5/signals.csv"; // signals file
input int     InpPollSec    = 30;        // poll every N seconds
input long    InpMagic      = 260511;    // magic number
// symbols on this broker ("" = do not trade that market)
input string  InpSymGold    = "XAUUSD";
input string  InpSymNQ      = "NAS100";  // NQ open run: the feed is 10 min late, mirrored only if InpMirrorNQ is on
input string  InpSymBTC     = "BTCUSD";
input string  InpSymETH     = "ETHUSD";
input string  InpSymSOL     = "";
input string  InpSymXRP     = "";
// risk (% of equity per first unit; an add uses the same lots as its first trade)
input double  InpRiskGold   = 0.25;
input double  InpRiskGoldTrend = 0.5;  // 7 Nov: gold trend at 2x the other gold legs, as the sizing guide (2023-26: more return, same drawdown)
input double  InpRiskMosha  = 0.25;
input double  InpRiskCrypto = 0.25;
input double  InpRiskNQ     = 0.25;
input bool    InpMirrorGold = true;
input bool    InpMirrorMosha= true;
input bool    InpMirrorCrypto=true;
input bool    InpMirrorNQ   = false;
// prop-firm guards
input double  InpDailyLossPct = 1.5;     // close everything and stop for the day at this loss from the day's starting equity (%)
input double  InpMaxDDPct     = 6.0;     // close everything and stop for good at this loss from the starting balance (%)
input double  InpStartBalance = 0;       // 0 = balance when the EA first runs (stored)
input double  InpMaxOpenRiskPct = 2.0;   // no new trade when the open risk (sum of |entry-stop| x lots) is above this (%)
// execution
input int     InpMaxLateMin   = 10;      // a market signal older than this is not taken (bot round 4 min + poll + fetch)
input double  InpMaxSlipR     = 0.5;     // a market signal is not taken if price moved more than this x R from the signal entry (gold 2023-26: 0.5R keeps the full replay result, 0.3R skipped too many)
input int     InpSlippagePts  = 50;      // deviation in points for market orders

CTrade trade;

// Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account that
// is not a demo (a real or contest account). Checked on start and right before every order it sends; on a refusal it says why and
// removes itself without sending anything. ACCOUNT_TRADE_MODE is the platform's own account-type flag.
bool DemoOnly() {
  if (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) return true;
  Print("CouncilBridge refused: account ", AccountInfoInteger(ACCOUNT_LOGIN), " is not a demo account (real or contest). This program runs on demo accounts only; it stops now and sends nothing.");
  ExpertRemove();
  return false;
}
string GV_PREFIX = "CB.";
bool   g_blocked_forever = false;

//--- helpers -------------------------------------------------------
string gv(string k) { return GV_PREFIX + k; }
double gvGet(string k) { return GlobalVariableCheck(gv(k)) ? GlobalVariableGet(gv(k)) : 0; }
void   gvSet(string k, double v) { GlobalVariableSet(gv(k), v); }
void   gvDel(string k) { if (GlobalVariableCheck(gv(k))) GlobalVariableDel(gv(k)); }

string symFor(string market) {
  if (market == "xau") return InpSymGold;
  if (market == "nq")  return InpSymNQ;
  if (market == "btc") return InpSymBTC;
  if (market == "eth") return InpSymETH;
  if (market == "sol") return InpSymSOL;
  if (market == "xrp") return InpSymXRP;
  return "";
}
double riskFor(string k) {
  if (k == "gtrend") return InpRiskGoldTrend;
  if (k == "replica" || k == "gtrend5" || k == "gtl" || k == "geg") return InpRiskGold;
  if (k == "mosha-bo") return InpRiskMosha;
  if (k == "trend") return InpRiskCrypto;
  if (k == "nq-open") return InpRiskNQ;
  return 0;
}
bool enabledFor(string k) {
  if (k == "replica" || k == "gtrend" || k == "gtrend5" || k == "gtl" || k == "geg") return InpMirrorGold;
  if (k == "mosha-bo") return InpMirrorMosha;
  if (k == "trend") return InpMirrorCrypto;
  if (k == "nq-open") return InpMirrorNQ;
  return false;
}
double normLots(string sym, double lots) {
  double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), mn = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), mx = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
  if (step <= 0) step = 0.01;
  lots = MathFloor(lots / step + 1e-9) * step;
  if (lots < mn) return 0;          // too small for the risk: skip rather than over-risk
  if (lots > mx) lots = mx;
  return NormalizeDouble(lots, 8);
}
// lots so that |entry-stop| loses riskPct% of equity
double lotsForRisk(string sym, double entry, double stop, double riskPct) {
  double dist = MathAbs(entry - stop); if (dist <= 0) return 0;
  double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE), tickVal = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
  if (tickSize <= 0 || tickVal <= 0) return 0;
  double lossPerLot = dist / tickSize * tickVal;
  double risk = AccountInfoDouble(ACCOUNT_EQUITY) * riskPct / 100.0;
  return normLots(sym, risk / lossPerLot);
}
double priceNorm(string sym, double p) { int d = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS); return NormalizeDouble(p, d); }

// sum of the open risk in account currency (positions: |price-sl| x lots; orders: |entry-sl| x lots) as % of equity
double openRiskPct() {
  double tot = 0;
  for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (!PositionSelectByTicket(t) || PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
    string s = PositionGetString(POSITION_SYMBOL); double sl = PositionGetDouble(POSITION_SL), op = PositionGetDouble(POSITION_PRICE_OPEN), v = PositionGetDouble(POSITION_VOLUME);
    if (sl <= 0) continue; double dist = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? op - sl : sl - op; if (dist <= 0) continue;
    tot += dist / SymbolInfoDouble(s, SYMBOL_TRADE_TICK_SIZE) * SymbolInfoDouble(s, SYMBOL_TRADE_TICK_VALUE) * v; }
  for (int i = OrdersTotal() - 1; i >= 0; i--) { ulong t = OrderGetTicket(i); if (!OrderSelect(t) || OrderGetInteger(ORDER_MAGIC) != InpMagic) continue;
    string s = OrderGetString(ORDER_SYMBOL); double sl = OrderGetDouble(ORDER_SL), op = OrderGetDouble(ORDER_PRICE_OPEN), v = OrderGetDouble(ORDER_VOLUME_CURRENT);
    if (sl <= 0) continue; tot += MathAbs(op - sl) / SymbolInfoDouble(s, SYMBOL_TRADE_TICK_SIZE) * SymbolInfoDouble(s, SYMBOL_TRADE_TICK_VALUE) * v; }
  double eq = AccountInfoDouble(ACCOUNT_EQUITY); return eq > 0 ? tot / eq * 100.0 : 0;
}

void closeEverything(string why) {
  Print("CouncilBridge: closing everything — ", why);
  for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic) trade.PositionClose(t); }
  for (int i = OrdersTotal() - 1; i >= 0; i--) { ulong t = OrderGetTicket(i); if (OrderSelect(t) && OrderGetInteger(ORDER_MAGIC) == InpMagic) trade.OrderDelete(t); }
}

// prop guards: returns true when trading is allowed now
bool guardsOk() {
  if (g_blocked_forever) return false;
  double bal = AccountInfoDouble(ACCOUNT_BALANCE), eq = AccountInfoDouble(ACCOUNT_EQUITY);
  double start = InpStartBalance > 0 ? InpStartBalance : gvGet("startBalance");
  if (start <= 0) { start = bal; gvSet("startBalance", start); }
  if (eq <= start * (1 - InpMaxDDPct / 100.0)) { closeEverything(StringFormat("equity %.2f under the max-drawdown floor %.2f", eq, start * (1 - InpMaxDDPct / 100.0))); g_blocked_forever = true; gvSet("blockedForever", 1); return false; }
  MqlDateTime dt; TimeToStruct(TimeTradeServer(), dt);
  string dayKey = StringFormat("day.%04d%02d%02d", dt.year, dt.mon, dt.day);
  double dayStart = gvGet(dayKey);
  if (dayStart <= 0) { dayStart = MathMax(bal, eq); gvSet(dayKey, dayStart); }
  if (eq <= dayStart * (1 - InpDailyLossPct / 100.0)) {
    if (gvGet(dayKey + ".stop") < 1) { closeEverything(StringFormat("equity %.2f under today's loss limit %.2f", eq, dayStart * (1 - InpDailyLossPct / 100.0))); gvSet(dayKey + ".stop", 1); }
    return false;
  }
  if (gvGet(dayKey + ".stop") >= 1) return false;
  return true;
}

//--- the signal file ------------------------------------------------
struct Sig { string id, market, k, side, status, entryMode, addOf, exitRule; double entry, stop, t1, tp1, size, midStop; long opened, filled, closed, validFor, maxHold; };
int col(string &head[], string name) { for (int i = 0; i < ArraySize(head); i++) if (head[i] == name) return i; return -1; }
string fld(string &f[], int i) { return (i >= 0 && i < ArraySize(f)) ? f[i] : ""; }
double fnum(string &f[], int i) { string v = fld(f, i); return v == "" ? 0 : StringToDouble(v); }
long flong(string &f[], int i) { string v = fld(f, i); return v == "" ? 0 : (long)StringToInteger(v); }

bool fetchSignals(Sig &out[]) {
  char data[], result[]; string headers; ResetLastError();
  // raw.githubusercontent.com caches a file for up to 5 min; a changing query string bypasses that cache so a signal is seen within one bot round
  string url = InpUrl + (StringFind(InpUrl, "?") >= 0 ? "&" : "?") + "cb=" + IntegerToString((long)TimeGMT());
  int code = WebRequest("GET", url, "", 5000, data, result, headers);
  if (code != 200) { Print("CouncilBridge: WebRequest ", code, " error ", GetLastError(), " (is https://meridianx.dev in the allowed URL list?)"); return false; }
  string txt = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
  string lines[]; int n = StringSplit(txt, '\n', lines); if (n < 2) return false;
  string head[]; int hi = -1;
  ArrayResize(out, 0);
  for (int i = 0; i < n; i++) {
    string ln = lines[i]; StringTrimRight(ln); StringTrimLeft(ln); if (ln == "" || StringGetCharacter(ln, 0) == '#') continue;
    string f[]; StringSplit(ln, ',', f);
    if (hi < 0) { int hn = ArraySize(f); ArrayResize(head, hn); for (int j = 0; j < hn; j++) { string h = f[j]; StringTrimRight(h); StringTrimLeft(h); head[j] = h; } hi = i; continue; }
    Sig s; s.id = fld(f, col(head, "id")); s.market = fld(f, col(head, "market")); s.k = fld(f, col(head, "k")); s.side = fld(f, col(head, "side")); s.status = fld(f, col(head, "status"));
    s.entryMode = fld(f, col(head, "entryMode")); s.addOf = fld(f, col(head, "addOf")); s.exitRule = fld(f, col(head, "exitRule"));
    s.entry = fnum(f, col(head, "entry")); s.stop = fnum(f, col(head, "stop")); s.t1 = fnum(f, col(head, "t1")); s.tp1 = fnum(f, col(head, "tp1")); s.size = fnum(f, col(head, "size")); s.midStop = fnum(f, col(head, "midStop"));
    s.opened = flong(f, col(head, "opened")); s.filled = flong(f, col(head, "filled")); s.closed = flong(f, col(head, "closed")); s.validFor = flong(f, col(head, "validFor")); s.maxHold = flong(f, col(head, "maxHold"));
    if (s.id == "") continue;
    int m = ArraySize(out); ArrayResize(out, m + 1); out[m] = s;
  }
  return ArraySize(out) > 0 || hi >= 0;
}

//--- mirroring ------------------------------------------------------
bool isClosedStatus(string st) { return st == "win" || st == "loss" || st == "be" || st == "expired" || st == "missed" || st == "skipped" || st == "cancelled"; }
ulong ticketFor(string id) { return (ulong)gvGet("t." + id); }

// the lots of the first trade of an add (same notional), else sized by risk
double lotsFor(Sig &s, string sym) {
  if (s.addOf != "") { ulong pt = ticketFor(s.addOf); if (pt > 0 && PositionSelectByTicket(pt)) return normLots(sym, PositionGetDouble(POSITION_VOLUME)); }
  double sz = (s.size > 0 && s.size < 4) ? s.size : 1.0;   // the Trader's size (replica 0.5 / 1.5 tilts); adds copy the parent's lots above
  return lotsForRisk(sym, s.entry, s.stop, riskFor(s.k) * sz);
}

void handle(Sig &s) {
  if (!enabledFor(s.k)) return;
  string sym = symFor(s.market); if (sym == "") return;
  ulong tk = ticketFor(s.id); bool haveTicket = tk > 0;
  bool isPos = haveTicket && PositionSelectByTicket(tk), isOrd = haveTicket && !isPos && OrderSelect(tk);
  double missed = gvGet("m." + s.id);
  bool buy = (s.side == "buy");
  // 1. the council closed it: close / delete ours
  if (isClosedStatus(s.status)) {
    if (isPos) { trade.PositionClose(tk); Print("CouncilBridge: closed ", s.id, " (", s.status, ")"); }
    else if (isOrd) { trade.OrderDelete(tk); Print("CouncilBridge: deleted order ", s.id, " (", s.status, ")"); }
    if (haveTicket && !isPos && !isOrd) gvDel("t." + s.id);
    return;
  }
  if (!SymbolSelect(sym, true)) return;
  double ask = SymbolInfoDouble(sym, SYMBOL_ASK), bid = SymbolInfoDouble(sym, SYMBOL_BID);
  double sl = priceNorm(sym, s.stop), tp = s.t1 > 0 ? priceNorm(sym, s.t1) : 0;
  // 2. we hold it: keep the stop (breakeven / trailing moves come from the council) and the target in sync
  if (isPos) {
    double curSl = PositionGetDouble(POSITION_SL), curTp = PositionGetDouble(POSITION_TP), pt = SymbolInfoDouble(sym, SYMBOL_POINT);
    bool slBetter = buy ? sl > curSl + pt : (curSl == 0 || sl < curSl - pt);   // never loosen a stop
    if (slBetter || MathAbs(curTp - tp) > pt) { if (!trade.PositionModify(tk, slBetter ? sl : curSl, tp)) Print("CouncilBridge: modify failed ", s.id, " ", trade.ResultRetcodeDescription()); }
    return;
  }
  if (isOrd) {
    if (s.status == "open") return;   // filled on the council side; our limit fills on its own
    double curSl = OrderGetDouble(ORDER_SL), curTp = OrderGetDouble(ORDER_TP), pt = SymbolInfoDouble(sym, SYMBOL_POINT);
    if (MathAbs(curSl - sl) > pt || MathAbs(curTp - tp) > pt) trade.OrderModify(tk, OrderGetDouble(ORDER_PRICE_OPEN), sl, tp, ORDER_TIME_GTC, 0);
    return;
  }
  if (haveTicket) { gvDel("t." + s.id); return; }   // our order/position is gone (stopped out, deleted by hand): forget it
  if (missed > 0) return;
  if (!guardsOk()) return;
  if (openRiskPct() >= InpMaxOpenRiskPct) { Print("CouncilBridge: open risk cap, skipping ", s.id); return; }
  double lots = lotsFor(s, sym); if (lots <= 0) { Print("CouncilBridge: lot size too small for ", s.id, ", skipped"); gvSet("m." + s.id, 1); return; }
  long nowT = (long)TimeGMT();
  // 3. new pending limit (Mosha BO): place it
  if (s.status == "pending" && s.entryMode == "limit") {
    double px = priceNorm(sym, s.entry);
    if (s.validFor > 0 && nowT > s.opened + s.validFor) { gvSet("m." + s.id, 1); return; }
    datetime exp = s.validFor > 0 ? (datetime)(s.opened + s.validFor) : 0;
    if (!DemoOnly()) return;
    bool ok = buy ? trade.BuyLimit(lots, px, sym, sl, tp, exp > 0 ? ORDER_TIME_SPECIFIED : ORDER_TIME_GTC, exp, s.id) : trade.SellLimit(lots, px, sym, sl, tp, exp > 0 ? ORDER_TIME_SPECIFIED : ORDER_TIME_GTC, exp, s.id);
    if (ok && trade.ResultOrder() > 0) { gvSet("t." + s.id, (double)trade.ResultOrder()); Print("CouncilBridge: limit ", s.side, " ", sym, " ", lots, " @ ", px, " ", s.id); }
    else { Print("CouncilBridge: limit failed ", s.id, " ", trade.ResultRetcodeDescription()); gvSet("m." + s.id, 1); }
    return;
  }
  // 4. new open market trade (replica, crypto trend, adds): take it if fresh and close to the signal price
  if (s.status == "open") {
    long t0 = s.filled > 0 ? s.filled : s.opened;
    if (nowT - t0 > (long)InpMaxLateMin * 60) { gvSet("m." + s.id, 1); Print("CouncilBridge: too late for ", s.id); return; }
    double r0 = MathAbs(s.entry - s.stop), px = buy ? ask : bid;
    if (r0 <= 0 || MathAbs(px - s.entry) > InpMaxSlipR * r0) { gvSet("m." + s.id, 1); Print("CouncilBridge: price moved, skipped ", s.id); return; }
    if (buy ? sl >= px : sl <= px) { gvSet("m." + s.id, 1); return; }
    trade.SetDeviationInPoints(InpSlippagePts);
    if (!DemoOnly()) return;
    bool ok = buy ? trade.Buy(lots, sym, 0, sl, tp, s.id) : trade.Sell(lots, sym, 0, sl, tp, s.id);
    if (ok && trade.ResultDeal() > 0) {
      // find the position opened by this deal
      ulong posT = 0; if (HistoryDealSelect(trade.ResultDeal())) posT = (ulong)HistoryDealGetInteger(trade.ResultDeal(), DEAL_POSITION_ID);
      if (posT == 0) posT = trade.ResultOrder();
      gvSet("t." + s.id, (double)posT); Print("CouncilBridge: market ", s.side, " ", sym, " ", lots, " ", s.id);
    } else { Print("CouncilBridge: market order failed ", s.id, " ", trade.ResultRetcodeDescription()); gvSet("m." + s.id, 1); }
  }
}

// positions we hold whose signal row is gone from the file (older than 7 days): leave them to their broker stop/TP

//--- events ---------------------------------------------------------
int OnInit() {
  if (!DemoOnly()) return INIT_FAILED;
  trade.SetExpertMagicNumber(InpMagic); trade.SetDeviationInPoints(InpSlippagePts); trade.SetTypeFillingBySymbol(_Symbol);
  g_blocked_forever = gvGet("blockedForever") >= 1;
  EventSetTimer(MathMax(5, InpPollSec));
  Print("CouncilBridge started. Demo? ", AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO ? "yes" : "NO (real/contest account)");
  return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() {
  if (!DemoOnly()) return;
  if (!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
  guardsOk();   // evaluates the daily / max loss even when no signal is new
  Sig sigs[]; if (!fetchSignals(sigs)) return;
  for (int i = 0; i < ArraySize(sigs); i++) handle(sigs[i]);
}
void OnTick() { }
