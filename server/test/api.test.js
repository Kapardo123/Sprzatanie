'use strict';
// Testy całych ścieżek przez HTTP, na świeżej bazie w pamięci z danymi startowymi.
process.env.QUIET_SMS = '1';
process.env.OTP_IP_LIMIT = '1000';
process.env.DATA_DIR = require('node:path').join(require('node:os').tmpdir(), 'lsni-test-' + process.pid);
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { seed } = require('../src/seed');
const { outbox } = require('../src/services/sms');
const { hmac, localNow, addDays, addHours } = require('../src/util');
const { config } = require('../src/config');

let app, server, base;
before(async () => {
  app = createApp({ dbFile: ':memory:' }); seed(app.ctx.db);
  server = http.createServer(app.handler); await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); app.close(); });

async function api(method, path, body, token, headers = {}) {
  const res = await fetch(base + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers), body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}
const tokens = {};
async function login(phone, extra = {}) {
  if (tokens[phone] && !extra.fresh) return tokens[phone];
  const c = await api('POST', '/api/auth/code', { phone });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const v = await api('POST', '/api/auth/verify', Object.assign({ phone, code: c.data.devCode }, extra));
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return (tokens[phone] = v.data.token);
}
const db = () => app.ctx.db;
// najbliższy wolny termin u wykonawcy
async function freeSlot(provider) {
  const days = (await api('GET', `/api/providers/${provider}/slots`)).data;
  const d = days.find(x => x.slots.length); return { date: d.date, time: d.slots[0] };
}

test('logowanie kodem SMS: błędny kod, poprawny kod, wylogowanie', async () => {
  const c = await api('POST', '/api/auth/code', { phone: '+48 511 222 333' });
  assert.equal(c.status, 200); assert.match(c.data.devCode, /^\d{6}$/);
  assert.ok(outbox.some(m => m.phone === '+48511222333' && m.body.includes(c.data.devCode)));
  const wrong = await api('POST', '/api/auth/verify', { phone: '511222333', code: '000000' === c.data.devCode ? '111111' : '000000' });
  assert.equal(wrong.status, 400); assert.equal(wrong.data.error.code, 'wrong_code');
  const ok = await api('POST', '/api/auth/verify', { phone: '511222333', code: c.data.devCode, name: 'Paweł Testowy' });
  assert.equal(ok.status, 200); assert.equal(ok.data.created, true); assert.equal(ok.data.user.name, 'Paweł Testowy');
  assert.equal((await api('GET', '/api/me', undefined, ok.data.token)).status, 200);
  await api('POST', '/api/auth/logout', {}, ok.data.token);
  assert.equal((await api('GET', '/api/me', undefined, ok.data.token)).status, 401);
  const bad = await api('POST', '/api/auth/code', { phone: '123' });
  assert.equal(bad.data.error.code, 'invalid_phone');
});

test('limit prób wysłania kodu', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await api('POST', '/api/auth/code', { phone: '522000111' })).status, 200);
  const r = await api('POST', '/api/auth/code', { phone: '522000111' });
  assert.equal(r.status, 429);
});

test('wyszukiwanie: zasięg, najwyżej 2 profile Promowane, filtr dzielnicy', async () => {
  const r = await api('GET', '/api/providers?lat=52.195&lng=21.024');
  assert.equal(r.status, 200); assert.equal(r.data.district, 'Mokotów');
  const promo = r.data.results.filter(p => p.promoted);
  assert.ok(promo.length >= 1 && promo.length <= 2);
  assert.deepEqual(r.data.results.slice(0, promo.length).map(p => p.id), promo.map(p => p.id), 'promowane są na górze');
  assert.ok(r.data.results.every(p => p.reach !== 'out'), 'bez wykonawców spoza zasięgu');
  const far = await api('GET', '/api/providers?lat=52.195&lng=21.024&far=1');
  assert.ok(far.data.results.length > r.data.results.length);
  const priceSorted = await api('GET', '/api/providers?lat=52.195&lng=21.024&sort=price');
  assert.ok(priceSorted.data.results.every(p => !p.promoted), 'bez promowanych przy innym sortowaniu');
  const d = await api('GET', '/api/providers?district=Bielany');
  assert.ok(d.data.results.some(p => p.id === 'kasia'));
  const views = db().get("SELECT SUM(views) v FROM boosts WHERE district = 'Mokotów'").v;
  assert.ok(views > 0, 'wyświetlenia wyróżnień są liczone');
});

test('profil wykonawcy z opiniami i wolnymi terminami, wycena po stronie serwera', async () => {
  const p = await api('GET', '/api/providers/marta?lat=52.195&lng=21.024');
  assert.equal(p.status, 200); assert.ok(p.data.reviewsList.length >= 2); assert.equal(p.data.week.length, 7);
  const q = await api('POST', '/api/quote', { provider: 'marta', service: 'dom', m2: 54, rooms: 2, baths: 1, extras: ['piekarnik'], freq: 'biweek', lat: 52.195, lng: 21.024 });
  assert.equal(q.status, 200); assert.equal(q.data.reach, 'in');
  assert.equal(q.data.totalZl, Math.round((q.data.workZl - q.data.discountZl) * 100) / 100);
  const far = await api('POST', '/api/quote', { provider: 'marta', lat: 52.25, lng: 21.0 });
  assert.equal(far.data.reach, 'fee'); assert.equal(far.data.travelZl, 15);
});

test('pełna wizyta: rezerwacja → akceptacja → w drodze → zakończona → opinia; zaproszenie daje kredyt', async () => {
  const kasia = await login('500100200'); const ola = await login('500100300');
  // nowy klient z linku od Oli
  const ewa = await login('533444555', { name: 'Ewa Testowa', ref: 'ola-zielinska' });
  const adr = await api('POST', '/api/addresses', { label: 'Dom', lat: 52.2005, lng: 21.0105, note: '2 piętro' }, ewa);
  assert.equal(adr.status, 200); assert.equal(adr.data.district, 'Mokotów');
  const slot = await freeSlot('ola-zielinska');
  const b = await api('POST', '/api/bookings', { provider: 'ola-zielinska', service: 'dom', m2: 60, rooms: 3, baths: 1, date: slot.date, time: slot.time, addressId: adr.data.id, payMethod: 'blikphone', doorCode: '1234', onsiteName: 'Mama', onsitePhone: '600 123 120' }, ewa);
  assert.equal(b.status, 201, JSON.stringify(b.data)); assert.equal(b.data.status, 'pending'); assert.equal(b.data.onsite.phone, '+48600123120');
  // ten sam termin drugi raz: zajęty
  const dup = await api('POST', '/api/bookings', { provider: 'ola-zielinska', date: slot.date, time: slot.time, addressId: 'adr_home' }, kasia);
  assert.equal(dup.status, 409); assert.equal(dup.data.error.code, 'slot_taken');
  // wykonawca nie widzi kodu do drzwi wcześniej niż 2 h przed
  const asPro = await api('GET', `/api/bookings/${b.data.id}`, undefined, ola);
  if (asPro.data.startsAt > addHours(localNow(), 2)) assert.equal(asPro.data.doorCode, undefined);
  assert.equal(asPro.data.client.name, 'Ewa');
  // klient nie może akceptować
  assert.equal((await api('POST', `/api/bookings/${b.data.id}/accept`, {}, kasia)).status, 403);
  assert.equal((await api('POST', `/api/bookings/${b.data.id}/accept`, {}, ola)).data.status, 'confirmed');
  assert.equal((await api('POST', `/api/bookings/${b.data.id}/status`, { status: 'done' }, ola)).status, 409, 'nie można przeskoczyć statusów');
  for (const s of ['enroute', 'progress', 'done']) assert.equal((await api('POST', `/api/bookings/${b.data.id}/status`, { status: s }, ola)).data.status, s);
  // kredyt za klienta z linku
  const inv = await api('GET', '/api/pro/invite', undefined, ola);
  assert.ok(inv.data.clients.some(c => c.name === 'Ewa' && c.credited));
  const before = (await api('GET', '/api/pro/boosts', undefined, ola)).data.ledger;
  assert.ok(before.some(l => l.reason.includes('Ewa') && l.amountZl === 20));
  // opinia aktualizuje ocenę
  const r0 = db().get("SELECT rating_count c FROM providers WHERE slug = 'ola-zielinska'").c;
  const rv = await api('POST', '/api/reviews', { bookingId: b.data.id, stars: 5, tags: ['Dokładność'], body: 'Wszystko lśni, polecam.' }, ewa);
  assert.equal(rv.status, 201); assert.equal(rv.data.status, 'published');
  assert.equal(db().get("SELECT rating_count c FROM providers WHERE slug = 'ola-zielinska'").c, r0 + 1);
  assert.equal((await api('POST', '/api/reviews', { bookingId: b.data.id, stars: 4 }, ewa)).status, 409, 'jedna opinia na wizytę');
  const reply = await api('POST', `/api/reviews/${rv.data.id}/reply`, { body: 'Dziękuję, do zobaczenia!' }, ola);
  assert.equal(reply.data.replyStatus, 'published');
});

test('moderacja: opinia z numerem telefonu czeka na zespół, admin ją publikuje', async () => {
  const kasia = await login('500100200'); const admin = await login('500100999');
  const done = db().get("SELECT b.id FROM bookings b WHERE b.client_id = (SELECT id FROM users WHERE phone = '+48500100200') AND b.status = 'done' AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)");
  const rv = await api('POST', '/api/reviews', { bookingId: done.id, stars: 4, body: 'Dobrze, ale lepiej dzwonić na 600 700 800' }, kasia);
  assert.equal(rv.data.status, 'pending');
  const list = await api('GET', '/api/admin/reviews?status=pending', undefined, admin);
  assert.ok(list.data.some(x => x.id === rv.data.id && x.flagReason === 'numer telefonu'));
  assert.equal((await api('GET', '/api/admin/reviews', undefined, kasia)).status, 403, 'panel tylko dla zespołu');
  assert.equal((await api('POST', `/api/admin/reviews/${rv.data.id}`, { status: 'published' }, admin)).status, 200);
  assert.equal(db().get('SELECT status FROM reviews WHERE id = ?', rv.data.id).status, 'published');
  assert.ok((await api('GET', '/api/admin/audit', undefined, admin)).data.some(a => a.action === 'review.moderate'));
});

test('przełożenie, pominięcie i późne odwołanie', async () => {
  const kasia = await login('500100200');
  const up = (await api('GET', '/api/bookings?scope=upcoming', undefined, kasia)).data.find(b => b.provider.id === 'marta');
  const skip = await api('POST', `/api/bookings/${up.id}/skip`, {}, kasia);
  assert.equal(skip.status, 200); assert.equal(skip.data.startsAt, addDays(up.startsAt, 14));
  const slot = await freeSlot('marta');
  const rs = await api('POST', `/api/bookings/${up.id}/reschedule`, slot, kasia);
  assert.equal(rs.status, 200); assert.equal(rs.data.status, 'pending'); assert.equal(rs.data.startsAt, `${slot.date}T${slot.time}`);
  db().run("UPDATE bookings SET status = 'confirmed', starts_at = ? WHERE id = ?", addHours(localNow(), 5), up.id);
  const c = await api('POST', `/api/bookings/${up.id}/cancel`, { reason: 'Zmiana planów' }, kasia);
  assert.equal(c.data.status, 'cancelled'); assert.equal(c.data.late, true);
  assert.equal(db().get("SELECT late_cancel_count c FROM users WHERE phone = '+48500100200'").c, 1);
});

test('nieobecność klienta: za wcześnie, potem zgłoszona; dwie nieobecności blokują rezerwacje', async () => {
  const ola = await login('500100300');
  const job = db().get("SELECT b.id, b.client_id FROM bookings b JOIN providers p ON p.user_id = b.provider_id WHERE p.slug = 'ola-zielinska' AND b.status = 'confirmed' ORDER BY b.starts_at LIMIT 1");
  db().run('UPDATE bookings SET starts_at = ? WHERE id = ?', addHours(localNow(), 1), job.id);
  assert.equal((await api('POST', `/api/bookings/${job.id}/noshow`, {}, ola)).data.error.code, 'too_early');
  db().run('UPDATE bookings SET starts_at = ? WHERE id = ?', addHours(localNow(), -1), job.id);
  const ns = await api('POST', `/api/bookings/${job.id}/noshow`, { distanceM: 40 }, ola);
  assert.equal(ns.data.status, 'noshow');
  db().run('UPDATE users SET noshow_count = 2 WHERE id = ?', job.client_id);
  const phone = db().get('SELECT phone FROM users WHERE id = ?', job.client_id).phone;
  db().run('UPDATE users SET simulated = 0 WHERE id = ?', job.client_id);
  const client = await login(phone.slice(3));
  const slot = await freeSlot('marta');
  const blocked = await api('POST', '/api/bookings', { provider: 'marta', date: slot.date, time: slot.time, lat: 52.195, lng: 21.024, street: 'ul. Puławska 1' }, client);
  assert.equal(blocked.status, 403); assert.equal(blocked.data.error.code, 'too_many_noshows');
});

test('zgłoszenie problemu: zdjęcie, odpowiedź wykonawcy, eskalacja po 24 h', async () => {
  const kasia = await login('500100200'); const admin = await login('500100999');
  const done = db().get("SELECT b.id FROM bookings b JOIN providers p ON p.user_id = b.provider_id WHERE b.client_id = (SELECT id FROM users WHERE phone = '+48500100200') AND b.status = 'done' AND p.slug = 'czysto'");
  const png = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
  const rep = await api('POST', '/api/reports', { bookingId: done.id, category: 'Szkoda lub zniszczenie', description: 'Pękł wazon', want: 'Kontakt telefoniczny', photos: [png] }, kasia);
  assert.equal(rep.status, 201); assert.equal(rep.data.photos, 1);
  assert.equal((await api('POST', '/api/reports', { bookingId: done.id, category: 'Inne' }, kasia)).status, 409, 'jedno otwarte zgłoszenie na wizytę');
  assert.ok((await api('GET', '/api/notifications', undefined, admin)).data.some(n => n.kind === 'admin_report'));
  db().run('UPDATE reports SET created_at = ? WHERE id = ?', new Date(Date.now() - 25 * 3600e3).toISOString(), rep.data.id);
  app.scheduler.escalateReports();
  assert.equal(db().get('SELECT status FROM reports WHERE id = ?', rep.data.id).status, 'escalated');
  const photo = await fetch(`${base}/api/admin/reports/${rep.data.id}/photos/0`, { headers: { Authorization: 'Bearer ' + admin } });
  assert.equal(photo.status, 200); assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.equal((await api('POST', `/api/admin/reports/${rep.data.id}`, { status: 'resolved', note: 'Wykonawca zwrócił koszt wazonu.' }, admin)).status, 200);
});

test('symulowany wykonawca odpowiada na zgłoszenie i w czacie', async () => {
  const kasia = await login('500100200');
  const sent = await api('POST', '/api/threads/marta/messages', { body: 'Czy masz własny odkurzacz?' }, kasia);
  assert.equal(sent.status, 201);
  db().run("UPDATE messages SET created_at = ? WHERE id = ?", new Date(Date.now() - 5000).toISOString(), sent.data.id);
  app.scheduler.simulate();
  const msgs = (await api('GET', '/api/threads/marta/messages', undefined, kasia)).data.messages;
  assert.match(msgs[msgs.length - 1].body, /odkurzacz/);
  assert.equal(msgs[msgs.length - 1].me, false);
  const threads = (await api('GET', '/api/threads', undefined, kasia)).data;
  assert.ok(threads.some(t => t.peerId === 'marta'));
});

test('wykonawca może pisać tylko do swoich klientów', async () => {
  const ola = await login('500100300');
  const stranger = db().get("SELECT id FROM users WHERE phone = '+48500100200'").id;
  assert.equal((await api('POST', `/api/threads/${stranger}/messages`, { body: 'Dzień dobry' }, ola)).status, 403);
  const own = db().get("SELECT client_id FROM bookings b JOIN providers p ON p.user_id = b.provider_id WHERE p.slug = 'ola-zielinska' LIMIT 1").client_id;
  assert.equal((await api('POST', `/api/threads/${own}/messages`, { body: 'Jestem w drodze' }, ola)).status, 201);
});

test('wyróżnienia: wycena, zakup z kredytu, brak kredytu, zwrot z gwarancji', async () => {
  const ola = await login('500100300');
  const q = await api('GET', '/api/pro/boosts?days=7', undefined, ola);
  assert.equal(q.status, 200); assert.ok(q.data.districts.some(d => d.district === 'Mokotów' && d.active));
  const target = q.data.districts.find(d => !d.active);
  const buy = await api('POST', '/api/pro/boosts', { districts: [target.district], days: 3 }, ola);
  assert.equal(buy.status, 201, JSON.stringify(buy.data));
  assert.equal((await api('POST', '/api/pro/boosts', { districts: [target.district], days: 3 }, ola)).data.error.code, 'already_active');
  assert.equal((await api('POST', '/api/pro/boosts', { districts: ['Bielany'], days: 7 }, ola)).data.error.code, 'outside_reach');
  const rest = q.data.districts.filter(d => !d.active && d.district !== target.district).map(d => d.district);
  const tooMuch = await api('POST', '/api/pro/boosts', { districts: rest, days: 14 }, ola);
  assert.equal(tooMuch.status, 402); assert.ok(tooMuch.data.error.missingZl > 0);
  // koniec wyróżnienia z małą liczbą wyświetleń → zwrot kredytu
  const b = buy.data.boosts[0];
  const creditBefore = (await api('GET', '/api/pro/boosts', undefined, ola)).data.creditZl;
  db().run('UPDATE boosts SET ends_at = ?, views = 0 WHERE id = ?', addHours(localNow(), -1), b.id);
  app.scheduler.settleBoosts(localNow());
  const after = (await api('GET', '/api/pro/boosts', undefined, ola)).data;
  assert.equal(after.creditZl, creditBefore + b.priceZl);
  assert.ok(after.ledger.some(l => l.reason.startsWith('Zwrot z gwarancji')));
});

test('weryfikacja tożsamości: przesłanie, decyzja zespołu i webhook dostawcy z podpisem', async () => {
  const user = await login('544555666', { name: 'Nowa Wykonawczyni' });
  const prof = await api('POST', '/api/pro/profile', { displayName: 'Nowa Wykonawczyni', services: ['dom'], rate: 44, baseLat: 52.19, baseLng: 21.02, radiusKm: 6 }, user);
  assert.equal(prof.status, 200, JSON.stringify(prof.data)); assert.equal(prof.data.creditZl, 50);
  const jpg = 'data:image/jpeg;base64,' + Buffer.from('ffd8ffe000104a464946', 'hex').toString('base64');
  const ver = await api('POST', '/api/pro/verification', { kind: 'id', files: [jpg, jpg] }, user);
  assert.equal(ver.status, 201);
  const bad = await api('POST', '/api/kyc/webhook', JSON.stringify({ verificationId: ver.data.id, status: 'verified' }), null, { 'X-Signature': 'zly' });
  assert.equal(bad.status, 401);
  const body = JSON.stringify({ verificationId: ver.data.id, status: 'verified' });
  const ok = await api('POST', '/api/kyc/webhook', body, null, { 'X-Signature': hmac(config.kycWebhookSecret, body) });
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/api/pro/me', undefined, user)).data.idStatus, 'verified');
  // polisa OC przez panel zespołu
  const admin = await login('500100999');
  const oc = await api('POST', '/api/pro/verification', { kind: 'insurance', files: ['data:application/pdf;base64,JVBERi0xLjQ='] }, user);
  assert.equal((await api('POST', `/api/admin/verifications/${oc.data.id}`, { status: 'verified' }, admin)).status, 200);
  assert.equal((await api('GET', '/api/pro/me', undefined, user)).data.insured, true);
});

test('numer maskowany: sesja dla rezerwacji i routing w bramce z sekretem', async () => {
  const kasia = await login('500100200');
  const slot = await freeSlot('olena');
  const b = await api('POST', '/api/bookings', { provider: 'olena', date: slot.date, time: slot.time, addressId: 'adr_home' }, kasia);
  const call = await api('POST', `/api/bookings/${b.data.id}/call`, {}, kasia);
  assert.equal(call.status, 200); assert.match(call.data.pin, /^\d{4}$/);
  assert.equal((await api('POST', '/api/calls/route', { pin: call.data.pin })).status, 401);
  const route = await api('POST', '/api/calls/route', { pin: call.data.pin }, null, { 'X-Calls-Secret': config.callsSecret });
  assert.equal(route.status, 200);
  assert.equal(route.data.dial, db().get("SELECT u.phone FROM users u JOIN providers p ON p.user_id = u.id WHERE p.slug = 'olena'").phone);
});

test('przypomnienia dzień wcześniej, także SMS do osoby na miejscu', async () => {
  const kasia = await login('500100200');
  const slot = await freeSlot('agnieszka');
  const b = await api('POST', '/api/bookings', { provider: 'agnieszka', date: slot.date, time: slot.time, addressId: 'adr_mama', onsiteName: 'Halina', onsitePhone: '600999888' }, kasia);
  db().run("UPDATE bookings SET status = 'confirmed', starts_at = ? WHERE id = ?", addHours(localNow(), 20), b.data.id);
  app.scheduler.reminders(localNow());
  assert.ok(outbox.some(m => m.phone === '+48600999888' && m.body.includes('Agnieszka Wróbel')));
  assert.ok((await api('GET', '/api/notifications', undefined, kasia)).data.some(n => n.kind === 'reminder'));
});

test('lista oczekujących i powiadomienie, gdy ktoś zacznie dojeżdżać', async () => {
  const u = await login('555666777', { name: 'Paweł z Ząbek' });
  const out = await api('POST', '/api/addresses', { lat: 52.29, lng: 21.2, label: 'Dom' }, u);
  assert.equal(out.status, 422); assert.equal(out.data.error.code, 'outside_area');
  const wl = await api('POST', '/api/waitlist', { lat: 52.2245, lng: 20.9055 }, u);
  assert.equal(wl.status, 200); assert.equal(wl.data.area, 'Bemowo');
  const pro = await login('566777888', { name: 'Nowy Wykonawca' });
  await api('POST', '/api/pro/profile', { displayName: 'Nowy Wykonawca', services: ['dom'], rate: 40, baseLat: 52.226, baseLng: 20.91, radiusKm: 5 }, pro);
  assert.ok((await api('GET', '/api/notifications', undefined, u)).data.some(n => n.kind === 'waitlist'));
});

test('RODO: eksport danych i usunięcie konta', async () => {
  const u = await login('577888999', { name: 'Do Usunięcia' });
  const ex = await api('GET', '/api/me/export', undefined, u);
  assert.equal(ex.status, 200); assert.equal(ex.data.account.name, 'Do Usunięcia');
  assert.equal((await api('DELETE', '/api/me', {}, u)).data.error.code, 'confirm_required');
  assert.equal((await api('DELETE', '/api/me', { confirm: 'USUŃ' }, u)).data.deleted, true);
  assert.equal((await api('GET', '/api/me', undefined, u)).status, 401);
});

test('panel zespołu, dokumenty prawne, strona zaproszenia, błędy', async () => {
  const admin = await login('500100999');
  const o = await api('GET', '/api/admin/overview', undefined, admin);
  assert.equal(o.status, 200); assert.ok(o.data.providers >= 13);
  assert.equal((await api('GET', '/api/admin/overview')).status, 401);
  for (const d of ['regulamin', 'prywatnosc', 'ranking']) assert.ok((await api('GET', '/api/legal/' + d)).data.markdown.length > 500);
  assert.equal((await api('GET', '/api/invite/ola-zielinska')).data.provider.name, 'Ola Zielińska');
  assert.equal((await api('GET', '/api/nie-ma')).status, 404);
  assert.equal((await api('POST', '/api/bookings', 'to nie json', admin)).status, 400);
  const page = await fetch(base + '/legal/regulamin'); assert.equal(page.status, 200); assert.match(await page.text(), /<h1>/);
  const z = await fetch(base + '/z/ola-zielinska', { redirect: 'manual' }); assert.equal(z.headers.get('location'), '/?invite=ola-zielinska');
});
