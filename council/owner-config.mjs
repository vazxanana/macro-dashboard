// config.json with the owner's demo-account settings on top (27 Nov 2026; the Profile card "Demo accounts: settings").
// The settings file is council-data owner/demo-settings.json, written by api/demo-settings.js for the owner's session only;
// the rules of what it may hold, and how it is laid over config.json, are api/_demo-settings.js (one copy, shared with the
// server). A settings file that is missing or does not parse changes nothing (config.json as it is). Demo only: the live
// account's code (council/live.mjs, the jobs' --live mode) never reads these settings.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DS = require('../api/_demo-settings.js');

export function readSettings(dir) {
  try { const s = JSON.parse(fs.readFileSync(path.join(dir, DS.PATH), 'utf8')); return s && typeof s === 'object' && !Array.isArray(s) ? s : null; } catch (e) { return null; }
}
// accFile: council/ctrader-accounts.json, read here unless handed in
export function readConfig(dir, accFile) {
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')) || {}; } catch (e) {}
  if (accFile === undefined) { accFile = {}; try { accFile = JSON.parse(fs.readFileSync(new URL('./ctrader-accounts.json', import.meta.url), 'utf8')); } catch (e) {} }
  const s = readSettings(dir); return s ? DS.apply(cfg, s, accFile) : cfg;
}
