'use strict';
// Zadania cykliczne. Uruchamiane co minutę (w trybie demo częściej), a w testach wywoływane ręcznie.
const { config } = require('./config');
const { newId, nowIso, localNow, addHours, zl } = require('./util');
const { firstName } = require('./domain');

const REPLIES = [
  [/kod|domofon/i, 'Dziękuję, zapisałam kod. Zadzwonię domofonem chwilę przed.'],
  [/odkurzacz|sprzęt|środk/i, 'Tak, przynoszę własny odkurzacz z filtrem HEPA i środki.'],
  [/kot|pies|zwierz/i, 'Lubię zwierzaki, to żaden problem.'],
  [/wcześniej|później|godzin/i, 'Sprawdzę grafik i dam znać za chwilę.'],
  [/.*/, 'Dzień dobry, dziękuję za wiadomość! Do zobaczenia.']
];

function createScheduler({ db, sms, notifier, domain }) {
  const { notify, notifyAdmins } = notifier;
  const when = at => at.slice(11, 16);

  function reminders(now) {
    db.all("SELECT b.*, p.display_name pname FROM bookings b JOIN providers p ON p.user_id = b.provider_id WHERE b.status = 'confirmed' AND b.reminder_sent = 0 AND b.starts_at > ? AND b.starts_at <= ?", now, addHours(now, 24)).forEach(b => {
      const day = b.starts_at.slice(0, 10) === now.slice(0, 10) ? 'dziś' : 'jutro';
      notify(b.client_id, { kind: 'reminder', title: `Przypomnienie: ${day} ${when(b.starts_at)}`, body: `${b.pname} · ${b.address_text}. Płatność na miejscu: ${zl(b.price_gr)}.`, link: `booking:${b.id}`, sms: true });
      notify(b.provider_id, { kind: 'reminder', title: `${day[0].toUpperCase() + day.slice(1)} ${when(b.starts_at)}: ${b.address_text}`, body: 'Sprawdź szczegóły i trasę w grafiku.', link: `booking:${b.id}` });
      if (b.onsite_phone) sms(b.onsite_phone, `Dzień dobry${b.onsite_name ? ', ' + b.onsite_name.split(' ')[0] : ''}! ${day[0].toUpperCase() + day.slice(1)} o ${when(b.starts_at)} przyjdzie ${b.pname} posprzątać pod adresem ${b.address_text}. Lśni`);
      db.run('UPDATE bookings SET reminder_sent = 1 WHERE id = ?', b.id);
    });
  }

  // Gwarancja wyświetleń: po zakończeniu wyróżnienia zwracamy kredyt proporcjonalnie do brakujących wyświetleń.
  function settleBoosts(now) {
    db.all('SELECT * FROM boosts WHERE settled = 0 AND ends_at <= ?', now).forEach(b => {
      const missing = Math.max(0, 1 - b.views / b.guaranteed_views);
      const refund = Math.round(b.paid_credit_gr * missing / 100) * 100;
      db.tx(() => {
        db.run('UPDATE boosts SET settled = 1, refunded_gr = ? WHERE id = ?', refund, b.id);
        if (refund > 0) db.run('INSERT INTO credit_ledger (id, provider_id, amount_gr, reason, ref, created_at) VALUES (?,?,?,?,?,?)', newId('crd_'), b.provider_id, refund, `Zwrot z gwarancji: ${b.district} (${b.views}/${b.guaranteed_views} wyświetleń)`, b.id, nowIso());
      });
      notify(b.provider_id, { kind: 'boost_end', title: `Wyróżnienie zakończone: ${b.district}`, body: `${b.views} wyświetleń, ${b.opens} wejść w profil, ${b.requests} zapytań.${refund ? ` Zwrot: ${zl(refund)} kredytu.` : ''}`, link: 'boosts' });
    });
  }

  // Zgłoszenie bez odpowiedzi przez 24 h przechodzi do zespołu Lśni.
  function escalateReports() {
    const limit = new Date(Date.now() - 24 * 3600e3).toISOString();
    db.all("SELECT * FROM reports WHERE status = 'open' AND created_at < ?", limit).forEach(x => {
      db.run("UPDATE reports SET status = 'escalated' WHERE id = ?", x.id);
      notifyAdmins({ kind: 'admin_report', title: 'Zgłoszenie bez odpowiedzi od 24 h', body: x.category, link: `admin:report:${x.id}` });
      notify(x.reporter_id, { kind: 'report_escalated', title: 'Zajmujemy się Twoim zgłoszeniem', body: 'Wykonawca nie odpowiedział w ciągu 24 h. Skontaktujemy się z Tobą.', link: `booking:${x.booking_id}` });
    });
  }

  // Tryb demo: wykonawcy z danych startowych reagują sami, żeby dało się przejść całą ścieżkę bez drugiej osoby.
  function simulate() {
    const ago = s => new Date(Date.now() - s * 1000).toISOString();
    db.all("SELECT b.* FROM bookings b JOIN users u ON u.id = b.provider_id WHERE u.simulated = 1 AND b.status = 'pending' AND b.updated_at < ?", ago(3)).forEach(b => {
      db.run("UPDATE bookings SET status = 'confirmed', updated_at = ? WHERE id = ?", nowIso(), b.id);
      notify(b.client_id, { kind: 'booking_confirmed', title: 'Rezerwacja potwierdzona', body: `${domain.providerById(b.provider_id).display_name}: ${b.starts_at.slice(8, 10)}.${b.starts_at.slice(5, 7)}, ${when(b.starts_at)}`, link: `booking:${b.id}` });
    });
    db.all("SELECT m.* FROM messages m JOIN users u ON u.id = m.provider_id WHERE u.simulated = 1 AND m.sender_id = m.client_id AND m.created_at < ? AND NOT EXISTS (SELECT 1 FROM messages x WHERE x.client_id = m.client_id AND x.provider_id = m.provider_id AND x.created_at > m.created_at)", ago(2)).forEach(m => {
      const reply = REPLIES.find(([re]) => re.test(m.body))[1];
      db.run('INSERT INTO messages (id, client_id, provider_id, sender_id, body, created_at) VALUES (?,?,?,?,?,?)', newId('msg_'), m.client_id, m.provider_id, m.provider_id, reply, nowIso());
      notify(m.client_id, { kind: 'message', title: `Nowa wiadomość: ${domain.providerById(m.provider_id).display_name}`, body: reply, link: `thread:${domain.providerById(m.provider_id).slug}` });
    });
    db.all("SELECT r.* FROM reports r JOIN users u ON u.id = r.provider_id WHERE u.simulated = 1 AND r.status = 'open' AND r.created_at < ?", ago(4)).forEach(x => {
      const text = x.want.startsWith('Poprawka') ? `Bardzo przepraszam. Mogę przyjechać jutro o 9:00 i poprawić to bez dodatkowej opłaty.${x.category.startsWith('Szkoda') ? ' Szkodę zgłoszę z mojej polisy OC, proszę o zdjęcie.' : ''}` : 'Przepraszam za kłopot, zadzwonię dziś po 17, żeby to wyjaśnić.';
      db.run('INSERT INTO messages (id, client_id, provider_id, sender_id, body, created_at) VALUES (?,?,?,?,?,?)', newId('msg_'), x.reporter_id, x.provider_id, x.provider_id, text, nowIso());
      db.run("UPDATE reports SET status = 'answered', answered_at = ? WHERE id = ?", nowIso(), x.id);
      notify(x.reporter_id, { kind: 'report_answer', title: 'Wykonawca odpowiedział na zgłoszenie', body: text.slice(0, 140), link: `thread:${domain.providerById(x.provider_id).slug}` });
    });
  }

  function tick(now = localNow()) {
    reminders(now); settleBoosts(now); escalateReports();
    if (config.simulateProviders) simulate();
  }
  return { tick, reminders, settleBoosts, escalateReports, simulate };
}

module.exports = { createScheduler };
