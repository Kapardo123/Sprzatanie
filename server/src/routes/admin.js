'use strict';
const { config } = require('../config');
const files = require('../services/files');
const calls = require('../services/calls');
const { newId, nowIso, v, fail, notFound, conflict, hmac, safeEqual, json } = require('../util');
const { outbox } = require('../services/sms');

module.exports = function adminRoutes(r, { db, domain, notifier }) {
  const { notify } = notifier;
  const audit = (actor, action, target, data = {}) => db.run('INSERT INTO audit_log (id, actor_id, action, target, data, created_at) VALUES (?,?,?,?,?,?)', newId('aud_'), actor ? actor.id : null, action, target, JSON.stringify(data), nowIso());
  const A = { auth: 'admin' };

  r.get('/api/admin/overview', A, () => {
    const c = sql => db.get(sql).c;
    return {
      users: c('SELECT COUNT(*) c FROM users'), providers: c('SELECT COUNT(*) c FROM providers WHERE published = 1'),
      bookingsByStatus: Object.fromEntries(db.all('SELECT status, COUNT(*) c FROM bookings GROUP BY status').map(x => [x.status, x.c])),
      openReports: c("SELECT COUNT(*) c FROM reports WHERE status IN ('open','escalated')"),
      escalatedReports: c("SELECT COUNT(*) c FROM reports WHERE status = 'escalated'"),
      pendingVerifications: c("SELECT COUNT(*) c FROM verifications WHERE status = 'pending'"),
      pendingReviews: c("SELECT COUNT(*) c FROM reviews WHERE status = 'pending' OR reply_status = 'pending'"),
      noshows: c("SELECT COUNT(*) c FROM noshows WHERE status = 'reported'"),
      waitlist: db.all('SELECT area, COUNT(*) c FROM waitlist GROUP BY area ORDER BY c DESC').map(x => ({ area: x.area, count: x.c })),
      activeBoosts: c(`SELECT COUNT(*) c FROM boosts WHERE ends_at > '${new Date().toISOString().slice(0, 16)}'`)
    };
  });

  // ---------- zgłoszenia ----------
  r.get('/api/admin/reports', A, ({ query }) => db.all(`SELECT r.*, u.name reporter, p.display_name provider FROM reports r JOIN users u ON u.id = r.reporter_id JOIN providers p ON p.user_id = r.provider_id ${query.status ? 'WHERE r.status = ?' : ''} ORDER BY r.created_at DESC LIMIT 200`, ...(query.status ? [query.status] : []))
    .map(x => ({ id: x.id, bookingId: x.booking_id, reporter: x.reporter, provider: x.provider, category: x.category, description: x.description, want: x.want, photos: json(x.photos, []).length, status: x.status, adminNote: x.admin_note, createdAt: x.created_at })));
  r.post('/api/admin/reports/:id', A, ({ user, params, body }) => {
    const x = db.get('SELECT * FROM reports WHERE id = ?', params.id) || notFound();
    const status = v.oneOf(body.status, 'status', ['open', 'answered', 'resolved', 'escalated']); const note = v.str(body.note, 'notatka', { max: 1000, optional: true });
    db.run('UPDATE reports SET status = ?, admin_note = ?, resolved_at = CASE WHEN ? = \'resolved\' THEN ? ELSE resolved_at END WHERE id = ?', status, note || x.admin_note, status, nowIso(), x.id);
    if (status === 'resolved') notify(x.reporter_id, { kind: 'report_resolved', title: 'Zgłoszenie zamknięte przez zespół Lśni', body: note || 'Dziękujemy za cierpliwość.', link: `booking:${x.booking_id}` });
    audit(user, 'report.update', x.id, { status, note });
    return { ok: true };
  });
  r.get('/api/admin/reports/:id/photos/:n', A, ({ params, res }) => {
    const x = db.get('SELECT photos FROM reports WHERE id = ?', params.id) || notFound();
    const f = json(x.photos, [])[Number(params.n)] || notFound(); const buf = files.readFile(f.name) || notFound();
    res.writeHead(200, { 'Content-Type': f.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(buf);
  });

  // ---------- nieobecności klientów ----------
  r.get('/api/admin/noshows', A, () => db.all('SELECT n.*, c.name client, c.noshow_count, p.display_name provider, b.starts_at, b.address_text FROM noshows n JOIN users c ON c.id = n.client_id JOIN providers p ON p.user_id = n.provider_id JOIN bookings b ON b.id = n.booking_id ORDER BY n.created_at DESC LIMIT 200'));
  r.post('/api/admin/noshows/:id', A, ({ user, params, body }) => {
    const n = db.get('SELECT * FROM noshows WHERE id = ?', params.id) || notFound();
    const status = v.oneOf(body.status, 'status', ['accepted', 'rejected']);
    if (n.status === status) return { ok: true };
    db.tx(() => {
      db.run('UPDATE noshows SET status = ? WHERE id = ?', status, n.id);
      if (status === 'rejected') db.run('UPDATE users SET noshow_count = MAX(0, noshow_count - 1) WHERE id = ?', n.client_id);
    });
    audit(user, 'noshow.' + status, n.id);
    return { ok: true };
  });

  // ---------- weryfikacje ----------
  r.get('/api/admin/verifications', A, ({ query }) => db.all(`SELECT v.*, p.display_name provider FROM verifications v JOIN providers p ON p.user_id = v.provider_id ${query.status ? 'WHERE v.status = ?' : ''} ORDER BY v.created_at DESC`, ...(query.status ? [query.status] : []))
    .map(x => ({ id: x.id, provider: x.provider, kind: x.kind, status: x.status, files: json(x.files, []).map((f, i) => ({ n: i, type: f.type, size: f.size })), note: x.note, createdAt: x.created_at, decidedAt: x.decided_at })));
  r.get('/api/admin/verifications/:id/files/:n', A, ({ params, res }) => {
    const x = db.get('SELECT files FROM verifications WHERE id = ?', params.id) || notFound();
    const f = json(x.files, [])[Number(params.n)] || notFound(); const buf = files.readFile(f.name) || notFound();
    res.writeHead(200, { 'Content-Type': f.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(buf);
  });
  function decideVerification(x, status, note, actor) {
    const col = x.kind === 'id' ? 'id_status' : 'insurance_status';
    db.tx(() => {
      db.run('UPDATE verifications SET status = ?, note = ?, decided_by = ?, decided_at = ? WHERE id = ?', status, note, actor ? actor.id : 'external', nowIso(), x.id);
      db.run(`UPDATE providers SET ${col} = ?${x.kind === 'insurance' ? ', insured = ' + (status === 'verified' ? 1 : 0) : ''} WHERE user_id = ?`, status, x.provider_id);
    });
    notify(x.provider_id, { kind: 'verification', title: status === 'verified' ? (x.kind === 'id' ? 'Tożsamość potwierdzona' : 'Polisa OC potwierdzona') : 'Weryfikacja odrzucona', body: status === 'verified' ? 'Odznaka jest już widoczna na Twoim profilu.' : (note || 'Prześlij wyraźniejsze zdjęcia dokumentu.'), link: 'listing' });
  }
  r.post('/api/admin/verifications/:id', A, ({ user, params, body }) => {
    const x = db.get('SELECT * FROM verifications WHERE id = ?', params.id) || notFound();
    if (x.status !== 'pending') conflict('Ta weryfikacja jest już rozstrzygnięta', 'decided');
    const status = v.oneOf(body.status, 'status', ['verified', 'rejected']);
    decideVerification(x, status, v.str(body.note, 'notatka', { max: 500, optional: true }), user);
    audit(user, 'verification.' + status, x.id);
    return { ok: true };
  });

  // ---------- moderacja opinii ----------
  r.get('/api/admin/reviews', A, ({ query }) => db.all(`SELECT r.*, u.name client, p.display_name provider FROM reviews r JOIN users u ON u.id = r.client_id JOIN providers p ON p.user_id = r.provider_id ${query.status === 'pending' ? "WHERE r.status = 'pending' OR r.reply_status = 'pending'" : ''} ORDER BY r.created_at DESC LIMIT 200`)
    .map(x => ({ id: x.id, client: x.client, provider: x.provider, stars: x.stars, body: x.body, status: x.status, flagReason: x.flag_reason, reply: x.reply, replyStatus: x.reply_status, createdAt: x.created_at })));
  r.post('/api/admin/reviews/:id', A, ({ user, params, body }) => {
    const x = db.get('SELECT * FROM reviews WHERE id = ?', params.id) || notFound();
    db.tx(() => {
      if (body.status) {
        const s = v.oneOf(body.status, 'status', ['published', 'hidden']);
        if (s === 'published' && x.status !== 'published') db.run('UPDATE providers SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE user_id = ?', x.stars, x.provider_id);
        if (s === 'hidden' && x.status === 'published') db.run('UPDATE providers SET rating_sum = rating_sum - ?, rating_count = rating_count - 1 WHERE user_id = ?', x.stars, x.provider_id);
        db.run('UPDATE reviews SET status = ? WHERE id = ?', s, x.id);
      }
      if (body.replyStatus) db.run('UPDATE reviews SET reply_status = ? WHERE id = ?', v.oneOf(body.replyStatus, 'status odpowiedzi', ['published', 'hidden']), x.id);
    });
    audit(user, 'review.moderate', x.id, { status: body.status, replyStatus: body.replyStatus });
    return { ok: true };
  });

  // ---------- użytkownicy ----------
  r.get('/api/admin/users', A, ({ query }) => {
    const q = `%${String(query.q || '').trim()}%`;
    return db.all('SELECT id, phone, name, role, blocked, noshow_count, late_cancel_count, created_at FROM users WHERE (name LIKE ? OR phone LIKE ?) AND simulated = 0 ORDER BY created_at DESC LIMIT 100', q, q);
  });
  r.post('/api/admin/users/:id', A, ({ user, params, body }) => {
    const u = db.get('SELECT * FROM users WHERE id = ?', params.id) || notFound();
    if (u.id === user.id) fail(400, 'self', 'Nie możesz zablokować samego siebie');
    const fields = {};
    if (body.blocked !== undefined) fields.blocked = v.bool(body.blocked) ? 1 : 0;
    if (body.resetNoshows) fields.noshow_count = 0;
    Object.entries(fields).forEach(([k, val]) => db.run(`UPDATE users SET ${k} = ? WHERE id = ?`, val, u.id));
    if (fields.blocked) db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
    audit(user, 'user.update', u.id, fields);
    return { ok: true };
  });
  r.get('/api/admin/waitlist', A, () => db.all('SELECT area, COUNT(*) count, SUM(notified) notified FROM waitlist GROUP BY area ORDER BY count DESC'));
  r.get('/api/admin/audit', A, () => db.all('SELECT a.*, u.name actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 200'));
  r.get('/api/admin/sms', A, () => db.all('SELECT phone, body, provider, status, created_at FROM sms_log ORDER BY created_at DESC LIMIT 100'));

  // ---------- integracje zewnętrzne ----------
  // Dostawca weryfikacji tożsamości wysyła wynik na ten adres. Podpis: HMAC-SHA256 surowego body w nagłówku X-Signature.
  r.post('/api/kyc/webhook', { raw: true }, ({ req, raw }) => {
    const sig = String(req.headers['x-signature'] || '');
    if (!config.kycWebhookSecret || !safeEqual(sig, hmac(config.kycWebhookSecret, raw))) fail(401, 'bad_signature', 'Nieprawidłowy podpis');
    let body; try { body = JSON.parse(raw.toString('utf8')); } catch (e) { fail(400, 'bad_json', 'Nieprawidłowy JSON'); }
    const x = db.get('SELECT * FROM verifications WHERE id = ? OR (external_ref != \'\' AND external_ref = ?)', String(body.verificationId || ''), String(body.externalRef || '')) || notFound('Nie ma takiej weryfikacji');
    if (x.status !== 'pending') return { ok: true, alreadyDecided: true };
    const status = v.oneOf(body.status, 'status', ['verified', 'rejected']);
    decideVerification(x, status, v.str(body.note, 'notatka', { max: 500, optional: true }), null);
    audit(null, 'kyc.webhook.' + status, x.id);
    return { ok: true };
  });
  // Bramka telefoniczna pyta, z kim połączyć dzwoniącego, który wpisał PIN.
  r.post('/api/calls/route', ({ req, body }) => {
    if (!config.callsSecret || !safeEqual(String(req.headers['x-calls-secret'] || ''), config.callsSecret)) fail(401, 'bad_secret', 'Brak dostępu');
    const s = calls.route(db, v.str(String(body.pin || ''), 'PIN', { min: 4, max: 4 })) || notFound('PIN nieaktywny');
    return { dial: s.callee_phone, callerId: s.proxy_number };
  });

  // tylko w trybie deweloperskim: ostatnie SMS-y (do testów logowania bez telefonu)
  if (!config.isProd) r.get('/api/dev/sms', () => outbox.slice(-20));

  return { decideVerification };
};
