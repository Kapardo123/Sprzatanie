'use strict';
// Powiadomienia: zapis w aplikacji + kanały (SMS, push, e-mail) zgodnie z ustawieniami użytkownika.
// Push (Web Push / FCM) i e-mail mają tu miejsce na podpięcie dostawcy; na razie zapisują się tylko w aplikacji.
const { newId, nowIso } = require('../util');

function createNotifier(db, sms) {
  function notify(userId, { kind, title, body = '', link = '', sms: viaSms = false }) {
    const user = db.get('SELECT id, phone, pref_sms, simulated FROM users WHERE id = ?', userId);
    if (!user) return null;
    const id = newId('ntf_');
    db.run('INSERT INTO notifications (id, user_id, kind, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)', id, userId, kind, title, body, link, nowIso());
    if (viaSms && user.pref_sms && !user.simulated) sms(user.phone, `${title}. ${body}`.slice(0, 300));
    return id;
  }
  function notifyAdmins(payload) {
    db.all("SELECT id FROM users WHERE role = 'admin' AND blocked = 0").forEach(a => notify(a.id, payload));
  }
  return { notify, notifyAdmins };
}

module.exports = { createNotifier };
