'use strict';
const crypto = require('node:crypto');
const geo = require('../geo');
const { config } = require('../config');
const { newId, nowIso, sha256, v, fail, badRequest, notFound, rateLimiter, json } = require('../util');

module.exports = function accountRoutes(r, { db, sms, domain, mapbox }) {
  const limit = rateLimiter();
  const codeHash = (phone, code) => sha256(`${config.otpPepper}:${phone}:${code}`);

  // ---------- logowanie kodem SMS ----------
  r.post('/api/auth/code', async ({ body, ip }) => {
    const phone = v.phone(body.phone);
    if (!limit('ip:' + ip, config.otpIpLimitPerHour, 3600e3) || !limit('ph:' + phone, config.otpPhoneLimitPer10Min, 10 * 60e3)) fail(429, 'too_many', 'Za dużo prób. Poczekaj kilka minut i spróbuj ponownie.');
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    db.run('INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,0,?) ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at',
      phone, codeHash(phone, code), new Date(Date.now() + config.otpTtlSec * 1000).toISOString(), nowIso());
    await sms(phone, `Twój kod do Lśni: ${code}. Nie podawaj go nikomu, także osobom podającym się za Lśni.`);
    return Object.assign({ sent: true, expiresInSec: config.otpTtlSec }, config.exposeDevCode ? { devCode: code } : {});
  });

  r.post('/api/auth/verify', ({ body }) => {
    const phone = v.phone(body.phone); const code = v.str(body.code, 'kod', { min: 6, max: 6 });
    const row = db.get('SELECT * FROM otp_codes WHERE phone = ?', phone);
    if (!row || row.expires_at < nowIso()) fail(400, 'code_expired', 'Kod wygasł. Poproś o nowy.');
    if (row.attempts >= config.otpMaxAttempts) fail(429, 'too_many', 'Za dużo błędnych prób. Poproś o nowy kod.');
    if (row.code_hash !== codeHash(phone, code)) { db.run('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?', phone); fail(400, 'wrong_code', 'Nieprawidłowy kod'); }
    db.run('DELETE FROM otp_codes WHERE phone = ?', phone);
    let user = db.get('SELECT * FROM users WHERE phone = ?', phone);
    let created = false;
    if (!user) {
      const name = v.str(body.name, 'imię', { max: 60, optional: true });
      user = { id: newId('usr_'), phone, name: name || 'Nowy użytkownik', role: 'client' };
      db.run('INSERT INTO users (id, phone, name, role, created_at) VALUES (?,?,?,?,?)', user.id, phone, user.name, 'client', nowIso());
      created = true;
    }
    if (user.blocked) fail(403, 'blocked', 'Konto jest zablokowane. Skontaktuj się z pomocą Lśni.');
    // Klient z linku od wykonawcy: zapamiętujemy zaproszenie (kredyt dostaje wykonawca po pierwszej wizycie)
    if (body.ref) {
      const p = db.get('SELECT user_id FROM providers WHERE invite_code = ?', String(body.ref));
      if (p && p.user_id !== user.id) db.run('INSERT OR IGNORE INTO invites (id, provider_id, client_id, created_at) VALUES (?,?,?,?)', newId('inv_'), p.user_id, user.id, nowIso());
    }
    const token = crypto.randomBytes(32).toString('base64url');
    db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)', sha256(token), user.id, nowIso(), new Date(Date.now() + config.sessionDays * 86400e3).toISOString());
    return { token, created, user: me(user.id) };
  });

  r.post('/api/auth/logout', { auth: 'user' }, ({ user }) => { db.run('DELETE FROM sessions WHERE token_hash = ?', user.tokenHash); return { ok: true }; });

  // ---------- konto ----------
  function me(id) {
    const u = db.get('SELECT id, phone, name, role, noshow_count, pref_push, pref_sms, pref_email, created_at FROM users WHERE id = ?', id);
    const p = domain.providerById(id);
    return {
      id: u.id, phone: u.phone, name: u.name, role: u.role, createdAt: u.created_at, noshowCount: u.noshow_count,
      prefs: { push: !!u.pref_push, sms: !!u.pref_sms, email: !!u.pref_email },
      addresses: db.all('SELECT id, label, street, lat, lng, note FROM addresses WHERE user_id = ? ORDER BY created_at', id).map(a => { const ar = geo.areaAt(a.lat, a.lng); return Object.assign(a, { district: ar.name, areaKey: ar.key, area: geo.areaLabel(ar), city: ar.city }); }),
      provider: p ? { id: p.slug, name: p.display_name, idStatus: p.id_status, insuranceStatus: p.insurance_status, creditZl: domain.creditGr(id) / 100, inviteCode: p.invite_code } : null
    };
  }
  r.get('/api/me', { auth: 'user' }, ({ user }) => me(user.id));
  r.patch('/api/me', { auth: 'user' }, ({ user, body }) => {
    if (body.name !== undefined) db.run('UPDATE users SET name = ? WHERE id = ?', v.str(body.name, 'imię', { min: 2, max: 60 }), user.id);
    if (body.prefs) for (const k of ['push', 'sms', 'email']) if (body.prefs[k] !== undefined) db.run(`UPDATE users SET pref_${k} = ? WHERE id = ?`, v.bool(body.prefs[k]) ? 1 : 0, user.id);
    return me(user.id);
  });
  // RODO: eksport danych i usunięcie konta (anonimizacja, bo rezerwacje i opinie muszą zostać spójne dla drugiej strony)
  r.get('/api/me/export', { auth: 'user' }, ({ user }) => ({
    exportedAt: nowIso(), account: me(user.id),
    bookings: db.all('SELECT * FROM bookings WHERE client_id = ? OR provider_id = ?', user.id, user.id),
    messages: db.all('SELECT * FROM messages WHERE client_id = ? OR provider_id = ? OR sender_id = ?', user.id, user.id, user.id),
    reviews: db.all('SELECT * FROM reviews WHERE client_id = ? OR provider_id = ?', user.id, user.id),
    reports: db.all('SELECT * FROM reports WHERE reporter_id = ? OR provider_id = ?', user.id, user.id),
    notifications: db.all('SELECT * FROM notifications WHERE user_id = ?', user.id)
  }));
  r.del('/api/me', { auth: 'user' }, ({ user, body }) => {
    if (body.confirm !== 'USUŃ') badRequest('Aby usunąć konto, wyślij confirm: "USUŃ"', 'confirm_required');
    const active = db.get("SELECT COUNT(*) c FROM bookings WHERE (client_id = ? OR provider_id = ?) AND status IN ('pending','confirmed','enroute','progress')", user.id, user.id).c;
    if (active) fail(409, 'active_bookings', 'Masz zaplanowane wizyty. Odwołaj je przed usunięciem konta.');
    db.tx(() => {
      db.run("UPDATE users SET name = 'Usunięte konto', phone = ?, blocked = 1 WHERE id = ?", 'deleted:' + user.id, user.id);
      db.run('DELETE FROM addresses WHERE user_id = ?', user.id);
      db.run('DELETE FROM sessions WHERE user_id = ?', user.id);
      db.run('DELETE FROM notifications WHERE user_id = ?', user.id);
      db.run("UPDATE providers SET published = 0, bio = '', tagline = '' WHERE user_id = ?", user.id);
      db.run("UPDATE bookings SET onsite_name = '', onsite_phone = '', door_code = '', note = '' WHERE client_id = ?", user.id);
    });
    return { deleted: true };
  });

  // ---------- adresy ----------
  r.post('/api/addresses', { auth: 'user' }, async ({ user, body }) => {
    const lat = v.num(body.lat, 'szerokość', { min: 49, max: 55 }), lng = v.num(body.lng, 'długość', { min: 14, max: 25 });
    if (!geo.inPoland(lat, lng)) fail(422, 'outside_area', 'Działamy na terenie Polski. Ten punkt jest poza granicami kraju.');
    const id = newId('adr_'); const rev = geo.reverse(lat, lng);
    if (!body.street && mapbox && mapbox.enabled()) { const mb = await mapbox.reverse(lat, lng); if (mb && mb.street) rev.street = mb.street; }
    db.run('INSERT INTO addresses (id, user_id, label, street, lat, lng, note, created_at) VALUES (?,?,?,?,?,?,?,?)', id, user.id,
      v.str(body.label, 'nazwa', { max: 40, optional: true }) || 'Adres', v.str(body.street, 'ulica', { max: 120, optional: true }) || rev.street, lat, lng, v.str(body.note, 'uwagi', { max: 200, optional: true }), nowIso());
    return Object.assign(db.get('SELECT id, label, street, lat, lng, note FROM addresses WHERE id = ?', id), { district: rev.district, areaKey: rev.area.key, area: geo.areaLabel(rev.area), city: rev.area.city });
  });
  r.del('/api/addresses/:id', { auth: 'user' }, ({ user, params }) => {
    const a = db.get('SELECT id FROM addresses WHERE id = ? AND user_id = ?', params.id, user.id) || notFound('Nie ma takiego adresu');
    db.run('DELETE FROM addresses WHERE id = ?', a.id); return { ok: true };
  });

  // ---------- lista oczekujących ----------
  r.post('/api/waitlist', ({ body, user, req }) => {
    const lat = v.num(body.lat, 'szerokość', { min: 49, max: 55 }), lng = v.num(body.lng, 'długość', { min: 14, max: 25 });
    const phone = body.phone ? v.phone(body.phone) : '';
    const a = geo.areaAt(lat, lng);
    const area = geo.inPoland(lat, lng) ? geo.areaLabel(a) : `poza Polską (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
    db.run('INSERT INTO waitlist (id, user_id, phone, lat, lng, area, created_at) VALUES (?,?,?,?,?,?,?)', newId('wl_'), user ? user.id : null, phone, lat, lng, area, nowIso());
    return { ok: true, area };
  });

  return { me };
};
