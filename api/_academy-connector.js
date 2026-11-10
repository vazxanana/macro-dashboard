// MeridianX Academy: the owner's assistant connector (10 Nov 2026, owner: use my own assistant, "no need API").
//
// The analyst (docs/academy/LLM.md) is a second opinion on a decision the engine has already stored. With a provider key the
// site asks the provider itself. Without one, the question WAITS in a queue and the owner's own assistant answers it: the owner
// adds this connector to their assistant app (their own subscription, no API key, no bill from this site) and says "answer my
// Academy questions". The assistant reads each queued question and sends its answer back; the site checks that answer with the
// same code as a provider's answer (api/_academy-analyst.js parseAnswer) before it counts.
//
// This file holds only the connector's key. The key is derived from the server's session secret, so there is nothing new to
// set; it is shown to the owner's session only (GET /api/academy?get=connector) and travels in the connector URL.
//   ACADEMY_CONNECTOR_SECRET=<16+ characters>   optional: a secret of the connector's own, used instead of the session secret
//   ACADEMY_CONNECTOR=off        switches the connector off (the URL then answers 401 and nothing is queued)
//   ACADEMY_CONNECTOR_SALT=<x>   changes the key: the old URL stops working (use it if the URL was shared by mistake)
// Paper only: the connector can read queued questions (which never hold a result) and send answers. Nothing else.
'use strict';
const crypto = require('node:crypto');
const S = require('./_session.js');

const NAME = 'connector';   // the provider label of an answer that came through the connector
const LABEL = 'meridian-x/academy-connector/v1';
// the secret the key is derived from: the connector's own when one is set, else the session's
const baseOf = (env) => { const own = env && env.ACADEMY_CONNECTOR_SECRET; return own && String(own).length >= 16 ? crypto.createHash('sha256').update(String(own)).digest() : S.secret(env); };
const off = (env) => /^(off|0|false|no)$/i.test(String((env && env.ACADEMY_CONNECTOR) || '').trim());
// the key, or null when the server has no session secret or the connector is switched off
function keyOf(env = process.env) {
  if (off(env)) return null;
  const base = baseOf(env); if (!base) return null;
  return crypto.createHmac('sha256', base).update(`${LABEL}|${String(env.ACADEMY_CONNECTOR_SALT || '')}`).digest('hex').slice(0, 40);
}
// constant time; never true without a key
function keyOk(env, given) {
  const k = keyOf(env); if (!k || typeof given !== 'string' || given.length !== k.length) return false;
  return crypto.timingSafeEqual(Buffer.from(k), Buffer.from(given));
}
// why the connector cannot be used, or null
const unavailable = (env = process.env) => (off(env) ? 'the connector is switched off on the server' : baseOf(env) ? null : 'the server has no session secret yet, so the connector has no key');
const urlOf = (env, host) => { const k = keyOf(env), h = String(host || '').replace(/[^A-Za-z0-9.:-]/g, '').slice(0, 120) || 'meridianx.dev'; return k ? `https://${h}/api/academy-mcp/${k}` : null; };

module.exports = { NAME, keyOf, keyOk, unavailable, urlOf };
