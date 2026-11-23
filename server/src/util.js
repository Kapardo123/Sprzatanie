'use strict';
const crypto = require('node:crypto');

const newId = (prefix = '') => prefix + crypto.randomBytes(9).toString('base64url');
const nowIso = () => new Date().toISOString();
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = (secret, body) => crypto.createHmac('sha256', secret).update(body).digest('hex');
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

class HttpError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra); };
const badRequest = (message, code = 'bad_request') => fail(400, code, message);
const notFound = (message = 'Nie znaleziono') => fail(404, 'not_found', message);
const forbidden = (message = 'Brak dostępu') => fail(403, 'forbidden', message);
const conflict = (message, code = 'conflict') => fail(409, code, message);

// ---------- walidacja wejścia ----------
const v = {
  str(val, name, { min = 0, max = 500, optional = false } = {}) {
    if (val === undefined || val === null || val === '') { if (optional) return ''; badRequest(`Pole „${name}” jest wymagane`, 'validation'); }
    if (typeof val !== 'string') badRequest(`Pole „${name}” musi być tekstem`, 'validation');
    const s = val.trim();
    if (s.length < min) badRequest(`Pole „${name}” jest za krótkie`, 'validation');
    if (s.length > max) badRequest(`Pole „${name}” jest za długie (maks. ${max} znaków)`, 'validation');
    return s;
  },
  num(val, name, { min = -Infinity, max = Infinity, optional = false, int = false } = {}) {
    if (val === undefined || val === null || val === '') { if (optional) return undefined; badRequest(`Pole „${name}” jest wymagane`, 'validation'); }
    const n = Number(val);
    if (!Number.isFinite(n) || (int && !Number.isInteger(n))) badRequest(`Pole „${name}” musi być liczbą${int ? ' całkowitą' : ''}`, 'validation');
    if (n < min || n > max) badRequest(`Pole „${name}” musi mieścić się między ${min} a ${max}`, 'validation');
    return n;
  },
  bool: (val) => val === true || val === 1 || val === '1' || val === 'true',
  oneOf(val, name, options, { optional = false, fallback } = {}) {
    if ((val === undefined || val === null || val === '') && optional) return fallback;
    if (!options.includes(val)) badRequest(`Nieprawidłowa wartość pola „${name}”`, 'validation');
    return val;
  },
  arr(val, name, { max = 20, of } = {}) {
    if (val === undefined || val === null) return [];
    if (!Array.isArray(val)) badRequest(`Pole „${name}” musi być listą`, 'validation');
    if (val.length > max) badRequest(`Pole „${name}” ma za dużo elementów`, 'validation');
    if (of) val.forEach(x => { if (!of.includes(x)) badRequest(`Nieprawidłowa wartość w polu „${name}”`, 'validation'); });
    return val;
  },
  // Polskie numery komórkowe: zapis +48XXXXXXXXX
  phone(val) {
    const digits = String(val || '').replace(/[\s()-]/g, '');
    const m = digits.match(/^(?:\+?48)?(\d{9})$/);
    if (!m) badRequest('Podaj 9-cyfrowy numer telefonu', 'invalid_phone');
    return '+48' + m[1];
  },
  date(val, name) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(val || ''))) badRequest(`Pole „${name}” musi mieć format RRRR-MM-DD`, 'validation'); return val; },
  time(val, name) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(val || ''))) badRequest(`Pole „${name}” musi mieć format GG:MM`, 'validation'); return val; }
};

// ---------- czas lokalny Warszawy ----------
// Terminy wizyt trzymamy jako lokalny czas warszawski bez strefy: "2026-11-24T10:00".
// Do arytmetyki traktujemy go jak UTC, więc dodawanie godzin nie zależy od strefy serwera.
const WARSAW = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const localNow = (d = new Date()) => WARSAW.format(d).replace(' ', 'T').slice(0, 16);
const toMs = local => Date.parse(local + ':00Z');
const fromMs = ms => new Date(ms).toISOString().slice(0, 16);
const addHours = (local, h) => fromMs(toMs(local) + h * 3600e3);
const addDays = (local, d) => fromMs(toMs(local) + d * 86400e3);
const weekdayOf = local => new Date(toMs(local)).getUTCDay();
const hoursBetween = (a, b) => (toMs(b) - toMs(a)) / 3600e3;

const zl = gr => (gr / 100).toLocaleString('pl-PL', { minimumFractionDigits: gr % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' zł';
const json = (s, fallback) => { try { return JSON.parse(s); } catch (e) { return fallback; } };

// ---------- prosty limiter zapytań w pamięci ----------
function rateLimiter() {
  const hits = new Map();
  return function hit(key, limit, windowMs) {
    const t = Date.now(); const arr = (hits.get(key) || []).filter(x => t - x < windowMs);
    if (arr.length >= limit) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr); return true;
  };
}

module.exports = { newId, nowIso, sha256, hmac, safeEqual, HttpError, fail, badRequest, notFound, forbidden, conflict, v, localNow, toMs, fromMs, addHours, addDays, weekdayOf, hoursBetween, zl, json, rateLimiter };
