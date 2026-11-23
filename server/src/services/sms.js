'use strict';
// Wysyłka SMS przez wymienny moduł.
//  - console: wypisuje treść na konsolę (lokalnie i w testach)
//  - smsapi: SMSAPI.pl (https://www.smsapi.pl), token w SMSAPI_TOKEN
const { config } = require('../config');
const { newId, nowIso } = require('../util');

const outbox = []; // ostatnie wiadomości w pamięci, przydatne w testach

async function sendViaSmsapi(phone, body) {
  const params = new URLSearchParams({ to: phone.replace('+', ''), message: body, from: config.smsSender, format: 'json', encoding: 'utf-8' });
  const res = await fetch('https://api.smsapi.pl/sms.do', { method: 'POST', headers: { Authorization: 'Bearer ' + config.smsapiToken, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error('SMSAPI: ' + (data.message || res.status));
  return 'sent';
}

function createSms(db) {
  return async function send(phone, body) {
    let status = 'sent';
    try {
      if (config.smsProvider === 'smsapi') status = await sendViaSmsapi(phone, body);
      else if (!process.env.QUIET_SMS) console.log(`[SMS → ${phone}] ${body}`);
    } catch (e) { status = 'failed: ' + e.message; console.error('[SMS] błąd wysyłki', e.message); }
    outbox.push({ phone, body, status }); if (outbox.length > 200) outbox.shift();
    db.run('INSERT INTO sms_log (id, phone, body, provider, status, created_at) VALUES (?,?,?,?,?,?)', newId('sms_'), phone, body, config.smsProvider, status, nowIso());
    return status;
  };
}

module.exports = { createSms, outbox };
