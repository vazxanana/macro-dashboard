// node --test tests/bridge-demo.test.mjs
// 12 Nov 2026, owner decision 45 approved ("Yes to all"): every program in mt5/ and ctrader/ that sends orders refuses an account that
// is not a demo, on start and right before every order, using the platform's own account-type flag, and stops itself without
// sending anything. These programs cannot be compiled here (no MetaTrader or cTrader in the build sandbox): this pins the text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const list = (dir, ext) => fs.readdirSync(new URL('../' + dir, import.meta.url)).filter((f) => f.endsWith(ext)).map((f) => dir + '/' + f);
const MQ = list('mt5', '.mq5'), CS = list('ctrader', '.cs');
const ORDER_MQ = /\btrade\.(Buy|Sell|BuyLimit|SellLimit|BuyStop|SellStop|PositionOpen|OrderOpen)\s*\(|\bOrderSend(Async)?\s*\(/g;
const ORDER_CS = /\b(ExecuteMarketOrder|PlaceLimitOrder|PlaceStopOrder|PlaceStopLimitOrder|ExecuteMarketOrderAsync|PlaceLimitOrderAsync|PlaceStopOrderAsync)\s*\(/g;
// the code line before an order call (skipping comment lines) must be the guard
const prevCode = (src, i) => { const lines = src.slice(0, i).split('\n'); lines.pop(); while (lines.length && /^\s*(\/\/.*)?$/.test(lines[lines.length - 1])) lines.pop(); return lines[lines.length - 1] || ''; };

test('every order-placing program is covered: the two bridges and the four others', () => {
  assert.deepEqual(MQ.sort(), ['mt5/BreakFade.mq5', 'mt5/CouncilBridge.mq5', 'mt5/EquinoxBridge.mq5', 'mt5/NQOpenRun.mq5']);
  assert.deepEqual(CS.sort(), ['ctrader/BreakFade.cs', 'ctrader/CouncilBridge.cs', 'ctrader/CryptoScalper.cs', 'ctrader/CryptoTrend.cs']);
  for (const f of [...MQ, ...CS]) assert.ok([...rd(f).matchAll(f.endsWith('.cs') ? ORDER_CS : ORDER_MQ)].length > 0, f + ' sends orders');
});

test('MetaTrader 5: the guard reads ACCOUNT_TRADE_MODE == ACCOUNT_TRADE_MODE_DEMO, removes the program, OnInit fails, and every order call is guarded', () => {
  for (const f of MQ) {
    const s = rd(f), g = s.slice(s.indexOf('bool DemoOnly() {'), s.indexOf('\n}\n', s.indexOf('bool DemoOnly() {')));
    assert.ok(g.length > 0, f);
    assert.match(g, /if \(AccountInfoInteger\(ACCOUNT_TRADE_MODE\) == ACCOUNT_TRADE_MODE_DEMO\) return true;/);
    assert.match(g, /Print\("[^"]*refused: account /); assert.match(g, /ExpertRemove\(\);\s*return false;/);
    assert.match(s, /int OnInit\(\) \{\s*if \(!DemoOnly\(\)\) return INIT_FAILED;/, f + ': refused on start');
    assert.ok(s.indexOf('bool DemoOnly()') < s.indexOf('int OnInit()'), f + ': defined before it is used');
    for (const m of s.matchAll(ORDER_MQ)) assert.match(prevCode(s, m.index), /^\s*if \(!DemoOnly\(\)\) return;\s*$/, `${f}: ${m[0]} is guarded`);
  }
  assert.match(rd('mt5/CouncilBridge.mq5'), /void OnTimer\(\) \{\s*if \(!DemoOnly\(\)\) return;/);
  assert.match(rd('mt5/NQOpenRun.mq5'), /void OnTick\(\) \{\s*if \(!DemoOnly\(\)\) return;/);
  assert.match(rd('mt5/BreakFade.mq5'), /void OnTimer\(\) \{\s*if \(!DemoOnly\(\)\) return;/);
});

test('cTrader: the guard reads Account.IsLive, stops the bot, OnStart and OnTimer refuse first, and every order call is guarded', () => {
  for (const f of CS) {
    const s = rd(f), i = s.indexOf('private bool DemoOnly()'), g = s.slice(i, s.indexOf('\n        }\n', i));
    assert.ok(i > 0, f);
    assert.match(g, /if \(!Account\.IsLive\) return true;/); assert.match(g, /Print\("[^"]*refused: account \{0\} is a LIVE account/); assert.match(g, /Stop\(\);\s*return false;/);
    assert.match(s, /protected override void OnStart\(\)\s*\{\s*if \(!DemoOnly\(\)\) return;/, f + ': refused on start');
    assert.match(s, /protected override void OnTimer\(\)\s*\{\s*(try\s*\{\s*)?(if \(!DemoOnly\(\)\) return;)/, f + ': every poll');
    for (const m of s.matchAll(ORDER_CS)) assert.match(prevCode(s, m.index), /^\s*if \(!DemoOnly\(\)\) return;\s*$/, `${f}: ${m[0]} is guarded`);
  }
});

test('the READMEs say so, and the owner decision is ticked', () => {
  assert.match(rd('mt5/README.md'), /\*\*Demo accounts only \(12 Nov 2026, owner decision 45\)\.\*\*/);
  assert.match(rd('ctrader/README.md'), /\*\*Demo accounts only \(12 Nov 2026, owner decision 45\)\.\*\*/);
  assert.match(rd('docs/owner-decisions.md'), /### \[x\] 45\. /);
});

test('BreakFade.cs is the Break fade cell of the study: 3-candle swings, ATR 14, 1 ATR stop, 2R, 24 hours, dry run by default', () => {
  const s = rd('ctrader/BreakFade.cs');
  for (const re of [/private const int Swing = 3;/, /private const int AtrN = 14;/, /private const double StopAtr = 1\.0;/, /private const double TargetR = 2\.0;/, /private const int HoldHours = 24;/,
    /\[Parameter\("Dry run \(log only, no orders\)", DefaultValue = true\)\]/, /var side = dir > 0 \? TradeType\.Sell : TradeType\.Buy;/, /if \(!p\.StopLoss\.HasValue\) \{ Close\(p, "it has no stop"\); continue; \}/,
    /LOSES AFTER costs/, /TimeZone = TimeZones\.UTC/]) assert.match(s, re);
  assert.match(rd('ctrader/README.md'), /# BreakFade\.cs/);
});

test('BreakFade.mq5 is the same rule as the cBot: 3-candle swings, ATR 14, 1 ATR stop, 2R, 24 hours, dry run by default, no position without a stop', () => {
  const s = rd('mt5/BreakFade.mq5');
  for (const re of [/#define BF_SWING 3\b/, /#define BF_ATRN 14\b/, /#define BF_STOP_ATR 1\.0/, /#define BF_TARGET_R 2\.0/, /#define BF_HOLD_SEC 86400/, /input bool\s+InpDryRun\s+= true;/,
    /if \(PositionGetDouble\(POSITION_SL\) <= 0\) \{ Print\([^;]*it has no stop"\); trade\.PositionClose\(t\);/, /stop = NormalizeDouble\(fill \+ dir \* dist, dg\)/, /LOSES AFTER/]) assert.match(s, re);
  assert.match(rd('mt5/README.md'), /# BreakFade\.mq5/);
});
