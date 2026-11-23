'use strict';
// Konfiguracja z zmiennych środowiskowych. Wartości domyślne są bezpieczne dla lokalnego uruchomienia.
const path = require('node:path');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const config = {
  isProd,
  port: Number(env.PORT || 8080),
  dataDir: env.DATA_DIR || path.join(__dirname, '..', 'data'),
  dbFile: env.DB_FILE || '', // puste = <dataDir>/lsni.db; ':memory:' w testach
  publicDir: env.PUBLIC_DIR || path.join(__dirname, '..', '..'), // index.html i app.js makiety
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),

  // Logowanie
  otpPepper: env.OTP_PEPPER || (isProd ? '' : 'dev-pepper'),
  otpTtlSec: 5 * 60,
  otpMaxAttempts: 5,
  otpIpLimitPerHour: Number(env.OTP_IP_LIMIT || 20),
  otpPhoneLimitPer10Min: 3,
  sessionDays: 60,
  // W trybie deweloperskim kod SMS wraca w odpowiedzi API, żeby dało się zalogować bez telefonu.
  exposeDevCode: !isProd && env.EXPOSE_DEV_CODE !== '0',

  // SMS: 'console' (wypisuje na konsolę) albo 'smsapi' (SMSAPI.pl)
  smsProvider: env.SMS_PROVIDER || 'console',
  smsapiToken: env.SMSAPI_TOKEN || '',
  smsSender: env.SMS_SENDER || 'Lsni',

  // Weryfikacja tożsamości przez zewnętrznego dostawcę: webhook podpisany HMAC
  kycWebhookSecret: env.KYC_WEBHOOK_SECRET || (isProd ? '' : 'dev-kyc-secret'),

  // Numery maskowane: pula numerów platformy i sekret dla bramki telefonicznej
  proxyNumbers: (env.PROXY_NUMBERS || '+48 22 307 00 00').split(',').map(s => s.trim()),
  callsSecret: env.CALLS_SECRET || (isProd ? '' : 'dev-calls-secret'),

  // Tryb demo: wykonawcy bez konta (z danych startowych) sami potwierdzają rezerwacje i odpowiadają w czacie
  simulateProviders: env.SIMULATE_PROVIDERS ? env.SIMULATE_PROVIDERS === '1' : !isProd,
  schedulerIntervalMs: Number(env.SCHEDULER_INTERVAL_MS || 60_000),

  // Wyróżnienia
  inviteCreditGr: 2000, // 20 zł za klienta z linku po jego pierwszej wizycie
  startCreditGr: 5000,  // 50 zł na start
  maxPromotedInResults: 2
};

function assertProductionConfig() {
  if (!isProd) return;
  const missing = [];
  if (!config.otpPepper) missing.push('OTP_PEPPER');
  if (config.smsProvider === 'smsapi' && !config.smsapiToken) missing.push('SMSAPI_TOKEN');
  if (!config.kycWebhookSecret) missing.push('KYC_WEBHOOK_SECRET');
  if (!config.callsSecret) missing.push('CALLS_SECRET');
  if (missing.length) throw new Error('Brak wymaganych zmiennych środowiskowych: ' + missing.join(', '));
}

module.exports = { config, assertProductionConfig };
