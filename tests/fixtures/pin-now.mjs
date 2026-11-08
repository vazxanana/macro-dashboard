// Preload for child processes (NODE_OPTIONS=--import): pins Date.now() / new Date() to PIN_NOW (unix seconds), so a test whose
// data window is "the last N days from now" sees the same window every run (8 Nov 2026: tests/backtest-oanda.test.mjs failed
// only at certain hours because its synthetic price had no setup in the window that ended at the clock).
const FIXED = +process.env.PIN_NOW * 1000, RealDate = Date;
if (Number.isFinite(FIXED)) {
  class PinnedDate extends RealDate { constructor(...a) { super(...(a.length ? a : [FIXED])); } static now() { return FIXED; } }
  globalThis.Date = PinnedDate;
}
