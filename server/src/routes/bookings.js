'use strict';
const geo = require('../geo');
const { reachWith } = require('../services/mapbox');
const { quote, SERVICE_NAMES } = require('../pricing');
const { config } = require('../config');
const calls = require('../services/calls');
const { normalizeScope } = require('./catalog');
const { newId, nowIso, v, fail, badRequest, notFound, forbidden, conflict, localNow, addDays, addHours, hoursBetween, toMs, zl, json } = require('../util');
const { firstName } = require('../domain');

const FREQ_STEP = { week: 7, biweek: 14, month: 28 };
const PAY = ['cash', 'blikphone', 'transfer', 'invoice'];
const when = at => `${at.slice(8, 10)}.${at.slice(5, 7)}, ${at.slice(11, 16)}`;

module.exports = function bookingRoutes(r, { db, domain, notifier, mapbox }) {
  const { notify } = notifier;
  const getBooking = id => db.get('SELECT * FROM bookings WHERE id = ?', id) || notFound('Nie ma takiej rezerwacji');
  function participant(b, user) {
    if (user.role === 'admin') return 'admin';
    if (b.client_id === user.id) return 'client';
    if (b.provider_id === user.id) return 'provider';
    forbidden('To nie jest Twoja rezerwacja');
  }
  const touch = (id, fields) => {
    const keys = Object.keys(fields); if (!keys.length) return;
    db.run(`UPDATE bookings SET ${keys.map(k => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map(k => fields[k]), nowIso(), id);
  };
  const isSlotFree = (p, at, ignoreId = '') => domain.slotsFor(p, at.slice(0, 10)).includes(at.slice(11, 16)) &&
    !db.get(`SELECT 1 FROM bookings WHERE provider_id = ? AND id != ? AND starts_at = ? AND status IN ('pending','confirmed','enroute','progress')`, p.user_id, ignoreId, at);

  // ---------- nowa rezerwacja ----------
  r.post('/api/bookings', { auth: 'user' }, async ({ user, body, now }) => {
    if (user.noshow_count >= 2) fail(403, 'too_many_noshows', 'Po dwóch nieobecnościach rezerwacje są wstrzymane. Napisz do pomocy Lśni, żeby je odblokować.');
    const p = domain.mustProvider(v.str(body.provider, 'wykonawca'));
    if (p.user_id === user.id) badRequest('Nie możesz zarezerwować wizyty u siebie');
    if (!p.published || !p.online) conflict('Ten wykonawca nie przyjmuje teraz zleceń', 'provider_unavailable');
    const scope = normalizeScope(body, p);
    // adres: zapisany albo podany wprost
    let addr;
    if (body.addressId) addr = db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', body.addressId, user.id) || notFound('Nie ma takiego adresu');
    else addr = { id: null, lat: v.num(body.lat, 'lat', { min: 49, max: 55 }), lng: v.num(body.lng, 'lng', { min: 14, max: 25 }), street: v.str(body.street, 'adres', { max: 120 }) };
    if (!geo.inPoland(addr.lat, addr.lng)) fail(422, 'outside_area', 'Ten adres jest poza Polską');
    const road = mapbox.enabled() ? await mapbox.matrix([{ id: p.user_id, lat: p.base_lat, lng: p.base_lng }], addr) : null;
    const rc = reachWith(p, addr, road && road.get(p.user_id));
    if (rc.reach === 'out') fail(422, 'out_of_reach', `${p.display_name} nie dojeżdża pod ten adres`);
    const at = `${v.date(body.date, 'data')}T${v.time(body.time, 'godzina')}`;
    if (!isSlotFree(p, at)) conflict('Ten termin jest już zajęty albo niedostępny. Wybierz inny.', 'slot_taken');
    const q = quote(p, scope, rc.feeGr);
    const boost = domain.activeBoosts().find(b => b.provider_id === p.user_id);
    const invite = db.get('SELECT * FROM invites WHERE provider_id = ? AND client_id = ?', p.user_id, user.id);
    const id = newId('bkg_'); const t = nowIso();
    db.tx(() => {
      db.run(`INSERT INTO bookings (id, client_id, provider_id, service, m2, rooms, baths, extras, freq, starts_at, hours, price_gr, travel_fee_gr, pay_method, address_id, address_text, lat, lng,
        onsite_name, onsite_phone, entry, door_code, pets, note, status, via_promo, invited_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, user.id, p.user_id, scope.service, scope.m2, scope.rooms, scope.baths, JSON.stringify(scope.extras), scope.freq, at, q.hours, q.totalGr, q.travelGr,
        v.oneOf(body.payMethod, 'płatność', PAY, { optional: true, fallback: 'cash' }), addr.id, addr.street, addr.lat, addr.lng,
        v.str(body.onsiteName, 'osoba na miejscu', { max: 60, optional: true }), body.onsitePhone ? v.phone(body.onsitePhone) : '',
        v.oneOf(body.entry, 'wejście', ['home', 'concierge', 'lockbox'], { optional: true, fallback: 'home' }), v.str(body.doorCode, 'kod', { max: 30, optional: true }),
        v.oneOf(body.pets, 'zwierzęta', ['none', 'cat', 'dog', 'other'], { optional: true, fallback: 'none' }), v.str(body.note, 'uwagi', { max: 1000, optional: true }),
        'pending', boost ? 1 : 0, invite ? p.user_id : null, t, t);
      if (boost) db.run('UPDATE boosts SET requests = requests + 1 WHERE id = ?', boost.id);
    });
    notify(p.user_id, { kind: 'booking_request', title: 'Nowe zapytanie o sprzątanie', body: `${SERVICE_NAMES[scope.service]}, ${when(at)} · ${String(rc.km).replace(".", ",")} km od bazy · ${zl(q.totalGr)}`, link: `booking:${id}`, sms: true });
    return { __status: 201, data: domain.bookingView(getBooking(id), user, now) };
  });

  r.get('/api/bookings', { auth: 'user' }, ({ user, query, now }) => {
    const asPro = query.as === 'provider' && user.role !== 'client';
    let rows = db.all(`SELECT * FROM bookings WHERE ${asPro ? 'provider_id' : 'client_id'} = ? ORDER BY starts_at`, user.id);
    if (query.scope === 'upcoming') rows = rows.filter(b => domain.ACTIVE.includes(b.status));
    if (query.scope === 'past') rows = rows.filter(b => !domain.ACTIVE.includes(b.status)).reverse();
    if (query.status) rows = rows.filter(b => b.status === query.status);
    if (query.date) rows = rows.filter(b => b.starts_at.startsWith(query.date));
    return rows.map(b => domain.bookingView(b, user, now));
  });
  r.get('/api/bookings/:id', { auth: 'user' }, ({ user, params, now }) => { const b = getBooking(params.id); participant(b, user); return domain.bookingView(b, user, now); });

  // ---------- akcje klienta ----------
  r.post('/api/bookings/:id/cancel', { auth: 'user' }, ({ user, params, body, now }) => {
    const b = getBooking(params.id); const who = participant(b, user);
    if (!['pending', 'confirmed'].includes(b.status)) conflict('Tej wizyty nie można już odwołać', 'bad_status');
    const late = b.status === 'confirmed' && hoursBetween(now, b.starts_at) < 24;
    touch(b.id, { status: 'cancelled', cancel_reason: v.str(body.reason, 'powód', { max: 200, optional: true }) });
    if (who === 'client') {
      if (late) db.run('UPDATE users SET late_cancel_count = late_cancel_count + 1 WHERE id = ?', user.id);
      notify(b.provider_id, { kind: 'booking_cancelled', title: 'Klient odwołał wizytę', body: `${when(b.starts_at)} · ${b.address_text}`, link: `booking:${b.id}`, sms: true });
    } else notify(b.client_id, { kind: 'booking_cancelled', title: 'Wykonawca odwołał wizytę', body: `${when(b.starts_at)}. Przepraszamy. Znajdź inny termin w aplikacji.`, link: `booking:${b.id}`, sms: true });
    return Object.assign(domain.bookingView(getBooking(b.id), user, now), { late });
  });
  r.post('/api/bookings/:id/reschedule', { auth: 'user' }, ({ user, params, body, now }) => {
    const b = getBooking(params.id); if (participant(b, user) !== 'client') forbidden();
    if (!['pending', 'confirmed'].includes(b.status)) conflict('Tej wizyty nie można przełożyć', 'bad_status');
    const p = domain.providerById(b.provider_id); const at = `${v.date(body.date, 'data')}T${v.time(body.time, 'godzina')}`;
    if (!isSlotFree(p, at, b.id)) conflict('Ten termin jest zajęty. Wybierz inny.', 'slot_taken');
    touch(b.id, { starts_at: at, status: 'pending', reminder_sent: 0 });
    notify(b.provider_id, { kind: 'booking_reschedule', title: 'Prośba o zmianę terminu', body: `Z ${when(b.starts_at)} na ${when(at)}. Potwierdź w aplikacji.`, link: `booking:${b.id}`, sms: true });
    return domain.bookingView(getBooking(b.id), user, now);
  });
  r.post('/api/bookings/:id/skip', { auth: 'user' }, ({ user, params, now }) => {
    const b = getBooking(params.id); if (participant(b, user) !== 'client') forbidden();
    if (b.freq === 'once') badRequest('Pomijać można tylko wizyty w stałym sprzątaniu', 'not_recurring');
    if (!['pending', 'confirmed'].includes(b.status)) conflict('Tej wizyty nie można pominąć', 'bad_status');
    const at = addDays(b.starts_at, FREQ_STEP[b.freq]); const p = domain.providerById(b.provider_id);
    if (!isSlotFree(p, at, b.id)) conflict('Następny termin w serii jest zajęty. Przełóż wizytę ręcznie.', 'slot_taken');
    touch(b.id, { starts_at: at, reminder_sent: 0 });
    notify(b.provider_id, { kind: 'booking_skip', title: 'Klient pomija wizytę', body: `Następna wizyta: ${when(at)}`, link: `booking:${b.id}` });
    return domain.bookingView(getBooking(b.id), user, now);
  });

  // ---------- akcje wykonawcy ----------
  const asProvider = (b, user) => { if (participant(b, user) !== 'provider' && user.role !== 'admin') forbidden('Tylko wykonawca może to zrobić'); };
  r.post('/api/bookings/:id/accept', { auth: 'pro' }, ({ user, params, now }) => {
    const b = getBooking(params.id); asProvider(b, user); if (b.status !== 'pending') conflict('To zapytanie jest już obsłużone', 'bad_status');
    touch(b.id, { status: 'confirmed' });
    notify(b.client_id, { kind: 'booking_confirmed', title: 'Rezerwacja potwierdzona', body: `${domain.providerById(b.provider_id).display_name}: ${when(b.starts_at)}`, link: `booking:${b.id}` });
    return domain.bookingView(getBooking(b.id), user, now);
  });
  r.post('/api/bookings/:id/decline', { auth: 'pro' }, ({ user, params, body, now }) => {
    const b = getBooking(params.id); asProvider(b, user); if (b.status !== 'pending') conflict('To zapytanie jest już obsłużone', 'bad_status');
    touch(b.id, { status: 'declined', cancel_reason: v.str(body.reason, 'powód', { max: 200, optional: true }) });
    notify(b.client_id, { kind: 'booking_declined', title: 'Wykonawca nie przyjął zlecenia', body: `${when(b.starts_at)} nie pasuje. Pokażemy Ci innych wykonawców z okolicy.`, link: 'search' });
    return domain.bookingView(getBooking(b.id), user, now);
  });
  const NEXT = { confirmed: 'enroute', enroute: 'progress', progress: 'done' };
  r.post('/api/bookings/:id/status', { auth: 'pro' }, ({ user, params, body, now }) => {
    const b = getBooking(params.id); asProvider(b, user);
    const to = v.oneOf(body.status, 'status', ['enroute', 'progress', 'done']);
    if (NEXT[b.status] !== to) conflict(`Nie można zmienić statusu z „${b.status}” na „${to}”`, 'bad_transition');
    touch(b.id, { status: to });
    const p = domain.providerById(b.provider_id);
    if (to === 'enroute') notify(b.client_id, { kind: 'booking_enroute', title: `${p.display_name} jest w drodze`, body: `Dojazd ok. ${geo.reach(p, b).eta} min`, link: `booking:${b.id}` });
    if (to === 'done') finishBooking(b, p);
    return domain.bookingView(getBooking(b.id), user, now);
  });
  function finishBooking(b, p) {
    db.run('UPDATE providers SET jobs_done = jobs_done + 1 WHERE user_id = ?', p.user_id);
    notify(b.client_id, { kind: 'booking_done', title: 'Sprzątanie zakończone', body: `Rozlicz się z wykonawcą i oceń wizytę: ${zl(b.price_gr)}`, link: `booking:${b.id}` });
    // kredyt za klienta z linku: raz, po pierwszej zakończonej wizycie
    const inv = db.get('SELECT * FROM invites WHERE provider_id = ? AND client_id = ? AND credited = 0', p.user_id, b.client_id);
    if (inv) {
      const client = db.get('SELECT name FROM users WHERE id = ?', b.client_id);
      db.run('UPDATE invites SET credited = 1 WHERE id = ?', inv.id);
      db.run('INSERT INTO credit_ledger (id, provider_id, amount_gr, reason, ref, created_at) VALUES (?,?,?,?,?,?)', newId('crd_'), p.user_id, config.inviteCreditGr, `Klient z Twojego linku: ${firstName(client.name)}`, inv.id, nowIso());
      notify(p.user_id, { kind: 'credit', title: `+${zl(config.inviteCreditGr)} kredytu na wyróżnienia`, body: `${firstName(client.name)} zakończył(a) pierwszą wizytę z Twojego linku.`, link: 'boosts' });
    }
    // stałe sprzątanie: następna wizyta w serii od razu potwierdzona
    if (b.freq !== 'once') {
      const at = addDays(b.starts_at, FREQ_STEP[b.freq]);
      if (!db.get(`SELECT 1 FROM bookings WHERE provider_id = ? AND starts_at = ? AND status IN ('pending','confirmed')`, p.user_id, at)) {
        const t = nowIso(); const nid = newId('bkg_');
        db.run(`INSERT INTO bookings (id, client_id, provider_id, service, m2, rooms, baths, extras, freq, starts_at, hours, price_gr, travel_fee_gr, pay_method, address_id, address_text, lat, lng, onsite_name, onsite_phone, entry, door_code, pets, note, status, created_at, updated_at)
          SELECT ?, client_id, provider_id, service, m2, rooms, baths, extras, freq, ?, hours, price_gr, travel_fee_gr, pay_method, address_id, address_text, lat, lng, onsite_name, onsite_phone, entry, door_code, pets, note, 'confirmed', ?, ? FROM bookings WHERE id = ?`, nid, at, t, t, b.id);
      }
    }
  }
  r.post('/api/bookings/:id/noshow', { auth: 'pro' }, ({ user, params, body, now }) => {
    const b = getBooking(params.id); asProvider(b, user);
    if (!['confirmed', 'enroute'].includes(b.status)) conflict('Nieobecność można zgłosić tylko dla potwierdzonej wizyty', 'bad_status');
    if (toMs(now) < toMs(b.starts_at) + 15 * 60e3) conflict('Odczekaj 15 minut od godziny wizyty, zanim zgłosisz nieobecność', 'too_early');
    db.tx(() => {
      touch(b.id, { status: 'noshow' });
      db.run('INSERT INTO noshows (id, booking_id, provider_id, client_id, distance_m, note, created_at) VALUES (?,?,?,?,?,?,?)', newId('ns_'), b.id, b.provider_id, b.client_id,
        body.distanceM === undefined ? null : v.num(body.distanceM, 'odległość', { min: 0, max: 100000, int: true }), v.str(body.note, 'uwagi', { max: 300, optional: true }), nowIso());
      db.run('UPDATE users SET noshow_count = noshow_count + 1 WHERE id = ?', b.client_id);
    });
    notify(b.client_id, { kind: 'noshow', title: 'Wykonawca nie zastał nikogo', body: `Wizyta ${when(b.starts_at)} została oznaczona jako nieobecność. Jeśli to pomyłka, odpowiedz w aplikacji.`, link: `booking:${b.id}`, sms: true });
    return domain.bookingView(getBooking(b.id), user, now);
  });

  // ---------- trasa dojazdu wykonawcy (do śledzenia na mapie) ----------
  r.get('/api/bookings/:id/route', { auth: 'user' }, async ({ user, params }) => {
    const b = getBooking(params.id); participant(b, user); const p = domain.providerById(b.provider_id);
    const from = { lat: p.base_lat, lng: p.base_lng }, to = { lat: b.lat, lng: b.lng };
    const rt = await mapbox.route([from, to]); const km = Math.round(geo.roadKm(from, to) * 10) / 10;
    return Object.assign(rt || { coordinates: [[from.lng, from.lat], [to.lng, to.lat]], km, min: geo.driveMin(km) }, { from, to, source: rt ? 'mapbox' : 'estimate' });
  });

  // ---------- numer maskowany ----------
  r.post('/api/bookings/:id/call', { auth: 'user' }, ({ user, params }) => {
    const b = getBooking(params.id); const who = participant(b, user);
    if (!domain.ACTIVE.includes(b.status)) conflict('Dzwonić można tylko w sprawie zaplanowanej wizyty', 'bad_status');
    const calleeId = who === 'client' ? b.provider_id : b.client_id;
    const callee = db.get('SELECT phone FROM users WHERE id = ?', calleeId);
    const s = calls.createSession(db, b, user, b.onsite_phone && who === 'provider' ? b.onsite_phone : callee.phone);
    return { proxyNumber: s.proxy_number, pin: s.pin, expiresAt: s.expires_at, howTo: `Zadzwoń na ${s.proxy_number} i wpisz PIN ${s.pin}. Twój numer pozostanie ukryty.` };
  });

  return { finishBooking, getBooking, touch };
};
