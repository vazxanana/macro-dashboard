//+------------------------------------------------------------------+
//| EquinoxBridge.mq5 — follows the Aureum Desk's Equinox desks from  |
//| your own MetaTrader 5. It reads YOUR feed address (Profile ->     |
//| "MetaTrader 5 bridge" on the site) every few seconds and copies   |
//| the desks' paper trades to this account. No broker login or       |
//| password ever leaves your computer: the address is your key, keep |
//| it to yourself.                                                   |
//|                                                                  |
//| What it does with each line of the feed:                          |
//|  open   -> opens the trade at market with the desk's own stop and |
//|            target, unless the price has already moved more than   |
//|            InpMaxDriftR x the risk from the desk's entry, or is   |
//|            past the stop or the target. Each desk trade is opened |
//|            once, never again after it closed here.                |
//|  closed -> closes the copy if it is still open.                   |
//|  hold   -> opens nothing (the desk's trade is too old to copy).   |
//| A copy without a stop is closed at once.                          |
//|                                                                  |
//| READ THIS FIRST. The desks are paper records of rules that LOSE   |
//| AFTER costs in their studies. This is not trade advice and not an |
//| edge. Demo accounts only: the program refuses any other account.  |
//| It starts in dry run (log only).                                  |
//| Setup: Tools -> Options -> Expert Advisors -> allow WebRequest for|
//| https://aureumdesk.co.uk , then paste your feed address below.    |
//+------------------------------------------------------------------+
#property copyright "macro-dashboard council"
#property version   "1.00"
#property strict
#include <Trade\Trade.mqh>

input string InpUrl          = "";      // your feed address from the Profile page
input long   InpMagic        = 261125;
input double InpRiskPct      = 0.25;    // % of equity risked per trade
input string InpDesks        = "";      // desks to follow: fade,bigfade,fvg,goldvb (empty = all four)
input string InpSuffix       = "";      // your broker's symbol suffix, e.g. ".r" or "m"
input int    InpMaxOpen      = 30;      // open copies allowed in all
input double InpMaxDriftR    = 0.75;    // do not open when the price is this many R from the desk's entry
input int    InpPollSec      = 10;      // seconds between reads (5-60)
input bool   InpDryRun       = true;    // log only, send no orders
input int    InpSlippagePts  = 30;

CTrade trade;
string GVP = "EQ.";

// Paper and demo only (absolute rule 2; owner, 12 Nov 2026, docs/owner-decisions.md item 45): this program refuses an account that
// is not a demo (a real or contest account). Checked on start, on every poll and right before every order it sends; on a refusal
// it says why and removes itself without sending anything. ACCOUNT_TRADE_MODE is the platform's own account-type flag.
bool DemoOnly() {
  if (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO) return true;
  Print("EquinoxBridge refused: account ", AccountInfoInteger(ACCOUNT_LOGIN), " is not a demo account (real or contest). This program runs on demo accounts only; it stops now and sends nothing.");
  ExpertRemove();
  return false;
}

int OnInit() { if (!DemoOnly()) return INIT_FAILED;
  if (StringLen(InpUrl) < 20 || StringFind(InpUrl, "https://") != 0 || StringFind(InpUrl, "/api/eqx-bridge?key=") < 0) { Print("EquinoxBridge: paste your feed address (Profile -> MetaTrader 5 bridge on the site) into the first input."); return INIT_PARAMETERS_INCORRECT; }
  trade.SetExpertMagicNumber(InpMagic); trade.SetDeviationInPoints(InpSlippagePts);
  EventSetTimer((int)MathMax(5, MathMin(60, InpPollSec)));
  Print("EquinoxBridge started: risk ", InpRiskPct, "% a trade, dry run ", InpDryRun ? "ON" : "off", ". The desks' rules lose after costs in their studies: demo only.");
  return INIT_SUCCEEDED; }
void OnDeinit(const int reason) { EventKillTimer(); }

// a short tag for a desk trade's id (a position comment holds 31 characters): "eq:" + 8 hex of a 32-bit FNV-1a hash
string tagOf(string id) { uint h = 2166136261; for (int i = 0; i < StringLen(id); i++) { h ^= (uint)StringGetCharacter(id, i); h *= 16777619; } return StringFormat("eq:%08x", h); }
string symOf(string market) { string s = market; StringToUpper(s); if (market == "xau") s = "XAUUSD"; if (market == "xag") s = "XAGUSD"; return s + InpSuffix; }
bool wanted(string desk) { if (StringLen(InpDesks) == 0) return true; return StringFind("," + InpDesks + ",", "," + desk + ",") >= 0; }
ulong findOurs(string tag) { for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic && PositionGetString(POSITION_COMMENT) == tag) return t; } return 0; }
int countOurs() { int c = 0; for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (PositionSelectByTicket(t) && PositionGetInteger(POSITION_MAGIC) == InpMagic) c++; } return c; }
bool once(string key) { if (GlobalVariableCheck(GVP + key)) return false; GlobalVariableSet(GVP + key, (double)TimeCurrent()); return true; }

double lotsFor(string sym, double dist) {
  double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE), tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE), step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP), mn = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), mx = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
  if (dist <= 0 || ts <= 0 || tv <= 0) return 0; if (step <= 0) step = 0.01;
  double lots = MathFloor(AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPct / 100.0 / (dist / ts * tv) / step + 1e-9) * step;
  if (lots < mn) return 0; return MathMin(lots, mx);
}

// Rule 1 of the desk: no position without a stop.
void guardStops() {
  for (int i = PositionsTotal() - 1; i >= 0; i--) { ulong t = PositionGetTicket(i); if (!PositionSelectByTicket(t) || PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
    if (PositionGetDouble(POSITION_SL) <= 0) { Print("EquinoxBridge ", PositionGetString(POSITION_SYMBOL), ": closed, it has no stop"); trade.PositionClose(t); } }
}

void OnTimer() {
  if (!DemoOnly()) return;
  guardStops();
  char post[], body[]; string hdr; ResetLastError();
  int code = WebRequest("GET", InpUrl, "", 8000, post, body, hdr);
  if (code == -1) { if (once("err.web")) Print("EquinoxBridge: WebRequest failed (", GetLastError(), "). Allow https://aureumdesk.co.uk in Tools -> Options -> Expert Advisors."); return; }
  if (code != 200) { Print("EquinoxBridge: the site answered ", code, (code == 401 || code == 403) ? " (the address is not accepted: copy it again from your Profile)" : ""); return; }
  string text = CharArrayToString(body, 0, WHOLE_ARRAY, CP_UTF8), rows[]; int n = StringSplit(text, '\n', rows);
  if (n < 2 || StringFind(rows[0], "# eqx-bridge v1") != 0) { Print("EquinoxBridge: the feed has another format, nothing done"); return; }
  for (int i = 2; i < n; i++) { string f[]; if (StringSplit(rows[i], ',', f) != 9) continue; handleLine(f); }
}

// f: id, desk, market, side, entry, stop, target, filled, state
void handleLine(string &f[]) {
  if (!wanted(f[1])) return;
  string tag = tagOf(f[0]), sym = symOf(f[2]), state = f[8]; StringTrimRight(state);
  ulong pos = findOurs(tag);
  if (state == "closed") { if (pos > 0) { Print("EquinoxBridge ", sym, ": the desk closed ", f[0], ", closing the copy"); if (!InpDryRun) trade.PositionClose(pos); } return; }
  if (state != "open" || pos > 0) return;
  if (GlobalVariableCheck(GVP + tag)) return;                 // opened here before: never a second time
  int dir = f[3] == "buy" ? 1 : f[3] == "sell" ? -1 : 0; double entry = StringToDouble(f[4]), stop = StringToDouble(f[5]), tgt = StringToDouble(f[6]);
  if (dir == 0 || entry <= 0 || stop <= 0 || dir * (entry - stop) <= 0) return;   // a stop on the losing side or no trade
  if (!SymbolSelect(sym, true)) { if (once("nosym." + sym)) Print("EquinoxBridge: symbol ", sym, " not found at this broker (set the suffix input?)"); return; }
  double bid = SymbolInfoDouble(sym, SYMBOL_BID), ask = SymbolInfoDouble(sym, SYMBOL_ASK); if (bid <= 0 || ask <= 0) return;
  double px = dir > 0 ? ask : bid, r0 = MathAbs(entry - stop), drift = dir * (px - entry) / r0;
  string why = "";
  if (dir * (px - stop) <= 0) why = "the price is past the stop";
  else if (tgt > 0 && dir * (tgt - px) <= 0) why = "the price is past the target";
  else if (MathAbs(drift) > InpMaxDriftR) why = StringFormat("the price is %.2fR from the desk's entry", drift);
  else if (countOurs() >= InpMaxOpen) why = "the cap of open copies is reached";
  double lots = lotsFor(sym, MathAbs(px - stop)); if (why == "" && lots <= 0) why = "the smallest lot would risk more than the risk %";
  if (why != "") { if (once("skip." + tag)) Print("EquinoxBridge ", sym, ": ", f[0], " not opened: ", why); return; }
  int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS); stop = NormalizeDouble(stop, dg); tgt = tgt > 0 ? NormalizeDouble(tgt, dg) : 0;
  Print("EquinoxBridge ", sym, ": ", dir > 0 ? "BUY " : "SELL ", lots, " lots for ", f[0], ", stop ", stop, ", target ", tgt, InpDryRun ? " (dry run, nothing sent)" : "");
  if (InpDryRun) return;
  trade.SetTypeFillingBySymbol(sym);
  if (!DemoOnly()) return;
  bool ok = dir > 0 ? trade.Buy(lots, sym, 0, stop, tgt, tag) : trade.Sell(lots, sym, 0, stop, tgt, tag);
  if (!ok) { Print("EquinoxBridge ", sym, ": order failed ", trade.ResultRetcodeDescription()); return; }
  GlobalVariableSet(GVP + tag, (double)TimeCurrent());
}
