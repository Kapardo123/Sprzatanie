'use strict';
// Numery maskowane: klient i wykonawca dzwonią na numer platformy i wpisują 4-cyfrowy PIN.
// Bramka telefoniczna (np. Twilio, Vonage, polski operator z IVR) pyta nasz endpoint /api/calls/route,
// z kim połączyć. Żadna ze stron nie poznaje prywatnego numeru drugiej.
const crypto = require('node:crypto');
const { config } = require('../config');
const { newId, nowIso, addHours, localNow } = require('../util');

let rr = 0;
function createSession(db, booking, caller, calleePhone) {
  const now = localNow();
  const existing = db.get('SELECT * FROM call_sessions WHERE booking_id = ? AND caller_id = ? AND expires_at > ?', booking.id, caller.id, now);
  if (existing) return existing;
  let pin;
  do { pin = String(crypto.randomInt(1000, 10000)); } while (db.get('SELECT 1 FROM call_sessions WHERE pin = ? AND expires_at > ?', pin, now));
  const proxy = config.proxyNumbers[rr++ % config.proxyNumbers.length];
  const row = { id: newId('call_'), booking_id: booking.id, caller_id: caller.id, callee_phone: calleePhone, proxy_number: proxy, pin, expires_at: addHours(booking.starts_at, booking.hours + 24), created_at: nowIso() };
  db.run('INSERT INTO call_sessions (id, booking_id, caller_id, callee_phone, proxy_number, pin, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)', row.id, row.booking_id, row.caller_id, row.callee_phone, row.proxy_number, row.pin, row.expires_at, row.created_at);
  return row;
}
function route(db, pin) {
  return db.get('SELECT callee_phone, proxy_number FROM call_sessions WHERE pin = ? AND expires_at > ?', String(pin), localNow());
}

module.exports = { createSession, route };
