'use strict';
const moderation = require('../services/moderation');
const files = require('../services/files');
const { newId, nowIso, v, fail, badRequest, notFound, forbidden, conflict, json } = require('../util');
const { firstName } = require('../domain');

const REPORT_CATS = ['Niedokładnie posprzątane', 'Szkoda lub zniszczenie', 'Spóźnienie', 'Wykonawca nie przyszedł', 'Inne'];
const REPORT_WANTS = ['Poprawka w ciągu 24 h', 'Kontakt telefoniczny', 'Tylko informuję'];

module.exports = function socialRoutes(r, { db, domain, notifier }) {
  const { notify, notifyAdmins } = notifier;

  // ---------- czat ----------
  // Wątek to para klient–wykonawca. Klient adresuje wykonawcę jego id profilu, wykonawca klienta jego id użytkownika.
  function threadFor(user, peer) {
    if (user.role === 'pro' && !peer.startsWith('p:')) {
      const client = db.get('SELECT id, name FROM users WHERE id = ?', peer) || notFound('Nie ma takiego klienta');
      const allowed = db.get('SELECT 1 FROM bookings WHERE provider_id = ? AND client_id = ?', user.id, client.id) || db.get('SELECT 1 FROM messages WHERE provider_id = ? AND client_id = ?', user.id, client.id);
      if (!allowed) forbidden('Możesz pisać tylko do klientów, z którymi masz rezerwację albo rozmowę');
      return { clientId: client.id, providerId: user.id, peerName: firstName(client.name) };
    }
    const p = domain.mustProvider(peer.replace(/^p:/, ''));
    if (p.user_id === user.id) badRequest('Nie możesz pisać do siebie');
    return { clientId: user.id, providerId: p.user_id, peerName: p.display_name };
  }
  r.get('/api/threads', { auth: 'user' }, ({ user }) => {
    const asPro = user.role === 'pro';
    const rows = db.all(`SELECT m.* FROM messages m WHERE m.${asPro ? 'provider_id' : 'client_id'} = ? ORDER BY m.created_at`, user.id);
    const map = new Map();
    for (const m of rows) { const key = asPro ? m.client_id : m.provider_id; const t = map.get(key) || { unread: 0 }; t.last = m; if (m.sender_id !== user.id && !m.read_at) t.unread++; map.set(key, t); }
    return [...map.entries()].map(([key, t]) => {
      if (asPro) { const c = db.get('SELECT id, name FROM users WHERE id = ?', key); return { peerId: c.id, name: firstName(c.name), ini: firstName(c.name).slice(0, 2).toUpperCase(), tone: 't-blue', last: t.last.body, mine: t.last.sender_id === user.id, at: t.last.created_at, unread: t.unread }; }
      const p = domain.providerById(key); return { peerId: p.slug, name: p.display_name, ini: p.initials, tone: p.tone, last: t.last.body, mine: t.last.sender_id === user.id, at: t.last.created_at, unread: t.unread };
    }).sort((a, b) => b.at.localeCompare(a.at));
  });
  r.get('/api/threads/:peer/messages', { auth: 'user' }, ({ user, params }) => {
    const t = threadFor(user, params.peer);
    db.run('UPDATE messages SET read_at = ? WHERE client_id = ? AND provider_id = ? AND sender_id != ? AND read_at IS NULL', nowIso(), t.clientId, t.providerId, user.id);
    return { peerName: t.peerName, messages: db.all('SELECT id, sender_id, body, created_at FROM messages WHERE client_id = ? AND provider_id = ? ORDER BY created_at', t.clientId, t.providerId).map(m => ({ id: m.id, me: m.sender_id === user.id, body: m.body, at: m.created_at })) };
  });
  r.post('/api/threads/:peer/messages', { auth: 'user' }, ({ user, params, body }) => {
    const t = threadFor(user, params.peer); const text = v.str(body.body, 'wiadomość', { min: 1, max: 2000 });
    const id = newId('msg_'); const flagged = moderation.check(text).ok ? 0 : 1;
    db.run('INSERT INTO messages (id, client_id, provider_id, sender_id, body, flagged, created_at) VALUES (?,?,?,?,?,?,?)', id, t.clientId, t.providerId, user.id, text, flagged, nowIso());
    const fromClient = user.id === t.clientId; const prov = domain.providerById(t.providerId);
    notify(fromClient ? t.providerId : t.clientId, { kind: 'message', title: `Nowa wiadomość: ${fromClient ? firstName(user.name) : prov.display_name}`, body: text.slice(0, 120), link: `thread:${fromClient ? t.clientId : prov.slug}` });
    return { __status: 201, data: { id, me: true, body: text, at: nowIso() } };
  });

  // ---------- powiadomienia ----------
  r.get('/api/notifications', { auth: 'user' }, ({ user }) => db.all('SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', user.id).map(n => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.read_at, at: n.created_at })));
  r.post('/api/notifications/read', { auth: 'user' }, ({ user, body }) => {
    if (body.all) db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), user.id);
    else v.arr(body.ids, 'ids', { max: 200 }).forEach(id => db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', nowIso(), id, user.id));
    return { unread: db.get('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL', user.id).c };
  });

  // ---------- zgłoszenia problemów ----------
  r.post('/api/reports', { auth: 'user' }, ({ user, body }) => {
    const b = db.get('SELECT * FROM bookings WHERE id = ?', v.str(body.bookingId, 'rezerwacja')) || notFound('Nie ma takiej rezerwacji');
    if (b.client_id !== user.id) forbidden('Zgłoszenie może wysłać tylko klient tej wizyty');
    if (['cancelled', 'declined', 'pending'].includes(b.status)) conflict('Dla tej wizyty nie można jeszcze zgłosić problemu', 'bad_status');
    if (db.get("SELECT 1 FROM reports WHERE booking_id = ? AND status IN ('open','answered','escalated')", b.id)) conflict('Masz już otwarte zgłoszenie dla tej wizyty', 'report_open');
    const category = v.oneOf(body.category, 'rodzaj problemu', REPORT_CATS);
    const want = v.oneOf(body.want, 'oczekiwanie', REPORT_WANTS, { optional: true, fallback: REPORT_WANTS[0] });
    const photos = files.saveDataUrls(body.photos, 'reports', { max: 4 });
    const id = newId('rep_');
    db.run('INSERT INTO reports (id, booking_id, reporter_id, provider_id, category, description, want, photos, created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, b.id, user.id, b.provider_id, category,
      v.str(body.description, 'opis', { max: 2000, optional: true }), want, JSON.stringify(photos), nowIso());
    notify(b.provider_id, { kind: 'report', title: 'Klient zgłosił problem', body: `${category}. Odpowiedz w ciągu 24 h.`, link: `report:${id}`, sms: true });
    if (category === 'Szkoda lub zniszczenie' || category === 'Wykonawca nie przyszedł') notifyAdmins({ kind: 'admin_report', title: 'Zgłoszenie wymaga uwagi', body: `${category} · rezerwacja ${b.id}`, link: `admin:report:${id}` });
    return { __status: 201, data: reportView(db.get('SELECT * FROM reports WHERE id = ?', id)) };
  });
  const reportView = x => ({ id: x.id, bookingId: x.booking_id, category: x.category, description: x.description, want: x.want, photos: json(x.photos, []).length, status: x.status, createdAt: x.created_at, answeredAt: x.answered_at, resolvedAt: x.resolved_at });
  r.get('/api/reports', { auth: 'user' }, ({ user }) => db.all('SELECT * FROM reports WHERE reporter_id = ? OR provider_id = ? ORDER BY created_at DESC', user.id, user.id).map(reportView));
  r.post('/api/reports/:id/answer', { auth: 'pro' }, ({ user, params, body }) => {
    const x = db.get('SELECT * FROM reports WHERE id = ?', params.id) || notFound();
    if (x.provider_id !== user.id) forbidden();
    if (x.status === 'resolved') conflict('Zgłoszenie jest już zamknięte', 'bad_status');
    const text = v.str(body.message, 'odpowiedź', { min: 5, max: 2000 });
    db.run('INSERT INTO messages (id, client_id, provider_id, sender_id, body, created_at) VALUES (?,?,?,?,?,?)', newId('msg_'), x.reporter_id, user.id, user.id, text, nowIso());
    db.run("UPDATE reports SET status = 'answered', answered_at = ? WHERE id = ?", nowIso(), x.id);
    notify(x.reporter_id, { kind: 'report_answer', title: 'Wykonawca odpowiedział na zgłoszenie', body: text.slice(0, 140), link: `thread:${domain.providerById(user.id).slug}` });
    return reportView(db.get('SELECT * FROM reports WHERE id = ?', x.id));
  });
  r.post('/api/reports/:id/resolve', { auth: 'user' }, ({ user, params }) => {
    const x = db.get('SELECT * FROM reports WHERE id = ?', params.id) || notFound();
    if (x.reporter_id !== user.id && user.role !== 'admin') forbidden();
    db.run("UPDATE reports SET status = 'resolved', resolved_at = ? WHERE id = ?", nowIso(), x.id);
    notify(x.provider_id, { kind: 'report_resolved', title: 'Zgłoszenie zamknięte', body: 'Klient oznaczył problem jako rozwiązany. Dziękujemy!', link: `report:${x.id}` });
    return reportView(db.get('SELECT * FROM reports WHERE id = ?', x.id));
  });

  // ---------- opinie ----------
  r.post('/api/reviews', { auth: 'user' }, ({ user, body }) => {
    const b = db.get('SELECT * FROM bookings WHERE id = ?', v.str(body.bookingId, 'rezerwacja')) || notFound('Nie ma takiej rezerwacji');
    if (b.client_id !== user.id) forbidden('Opinię wystawia klient tej wizyty');
    if (b.status !== 'done') conflict('Opinię można wystawić po zakończonej wizycie', 'bad_status');
    if (db.get('SELECT 1 FROM reviews WHERE booking_id = ?', b.id)) conflict('Ta wizyta ma już opinię', 'already_reviewed');
    const stars = v.num(body.stars, 'ocena', { min: 1, max: 5, int: true });
    const tags = v.arr(body.tags, 'tagi', { max: 6 }).map(t => v.str(t, 'tag', { max: 30 }));
    const text = v.str(body.body, 'opinia', { max: 1000, optional: true });
    const m = moderation.check(text); const id = newId('rev_');
    db.run('INSERT INTO reviews (id, booking_id, client_id, provider_id, stars, tags, body, status, flag_reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, b.id, user.id, b.provider_id, stars, JSON.stringify(tags), text, m.ok ? 'published' : 'pending', m.reason, nowIso());
    if (m.ok) db.run('UPDATE providers SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE user_id = ?', stars, b.provider_id);
    else notifyAdmins({ kind: 'admin_review', title: 'Opinia do moderacji', body: `Powód: ${m.reason}`, link: `admin:review:${id}` });
    notify(b.provider_id, { kind: 'review', title: `Nowa opinia: ${'★'.repeat(stars)}`, body: m.ok ? text.slice(0, 120) : 'Opinia czeka na moderację.', link: 'reviews' });
    return { __status: 201, data: { id, status: m.ok ? 'published' : 'pending', message: m.ok ? 'Opinia opublikowana' : 'Opinia trafi na profil po sprawdzeniu przez zespół Lśni' } };
  });
  r.post('/api/reviews/:id/reply', { auth: 'pro' }, ({ user, params, body }) => {
    const x = db.get('SELECT * FROM reviews WHERE id = ?', params.id) || notFound();
    if (x.provider_id !== user.id) forbidden('Odpowiadać można tylko na opinie o sobie');
    const text = v.str(body.body, 'odpowiedź', { min: 2, max: 600 }); const m = moderation.check(text);
    db.run('UPDATE reviews SET reply = ?, reply_status = ?, reply_at = ? WHERE id = ?', text, m.ok ? 'published' : 'pending', nowIso(), x.id);
    return { id: x.id, replyStatus: m.ok ? 'published' : 'pending' };
  });
  r.get('/api/pro/reviews', { auth: 'pro' }, ({ user }) => db.all('SELECT r.*, u.name cn FROM reviews r JOIN users u ON u.id = r.client_id WHERE r.provider_id = ? ORDER BY r.created_at DESC', user.id)
    .map(x => ({ id: x.id, who: firstName(x.cn), stars: x.stars, body: x.body, tags: json(x.tags, []), status: x.status, reply: x.reply, replyStatus: x.reply_status, at: x.created_at })));

  return { REPORT_CATS, REPORT_WANTS };
};
