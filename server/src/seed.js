'use strict';
// Dane startowe: te same osoby i sytuacje co w makiecie (Warszawa) oraz wykonawcy w innych miastach Polski.
// Konta do logowania (kod SMS w trybie deweloperskim wraca w odpowiedzi API):
//   klientka  Kasia  500 100 200
//   wykonawca Ola    500 100 300
//   zespół    Admin  500 100 999
const fs = require('node:fs');
const path = require('node:path');
const { newId, nowIso, localNow, addDays, addHours } = require('./util');

const PROS = [
  { slug: 'marta', name: 'Marta Kowalczyk', ini: 'MK', tone: 't-yellow', kind: 'Osoba prywatna', lat: 52.1980, lng: 21.0220, r: 6, fee: 15, rate: 45, minH: 3, since: 2019, rs: 1054, rc: 212, jobs: 540, resp: 8, svc: ['dom', 'generalne', 'okna', 'najem'], f: { insured: 1, eco: 1, sup: 1, pets: 1, inv: 0 }, sup_: 1, langs: ['PL', 'EN'], tag: 'Mieszkania i domy, ekologiczne środki, własny odkurzacz z filtrem HEPA', bio: 'Sprzątam zawodowo od 2019 roku. Pracuję według stałej checklisty, więc wiesz, co będzie zrobione. Przynoszę własny sprzęt i środki z certyfikatem Ecolabel. Lubię zwierzęta.' },
  { slug: 'czysto', name: 'Czysto & Basta', ini: 'CB', tone: 't-blue', kind: 'Firma · zespół 3 osób', lat: 52.2320, lng: 20.9680, r: 14, fee: 0, rate: 59, minH: 4, since: 2016, rs: 2040, rc: 418, jobs: 1320, resp: 15, svc: ['remont', 'generalne', 'biuro', 'okna'], f: { insured: 1, eco: 0, sup: 1, pets: 1, inv: 1 }, sup_: 1, langs: ['PL'], tag: 'Sprzątanie po remoncie i biura. Faktura VAT, przemysłowe odkurzacze', bio: 'Zespół, który usuwa pył budowlany, resztki fug i farby. Mamy przemysłowe odkurzacze i myjki parowe. Wystawiamy fakturę VAT.' },
  { slug: 'olena', name: 'Olena Shevchenko', ini: 'OS', tone: 't-mint', kind: 'Osoba prywatna', lat: 52.1860, lng: 21.0300, r: 4, fee: 10, rate: 42, minH: 3, since: 2021, rs: 473, rc: 96, jobs: 180, resp: 5, svc: ['dom', 'prasowanie', 'najem'], f: { insured: 0, eco: 1, sup: 1, pets: 1, inv: 0 }, langs: ['PL', 'UA', 'EN'], tag: 'Sprzątanie i prasowanie. Wolne terminy jeszcze dziś', bio: 'Mieszkam na Mokotowie, więc często mogę przyjechać tego samego dnia. Sprzątam i prasuję.' },
  { slug: 'pawel', name: 'Paweł Nowak · Przejrzyście', ini: 'PN', tone: 't-sand', kind: 'Jednoosobowa firma', lat: 52.2690, lng: 20.9900, r: 10, fee: 20, rate: 55, minH: 2, since: 2017, rs: 756, rc: 154, jobs: 610, resp: 20, perWindow: 25, svc: ['okna', 'biuro'], f: { insured: 1, eco: 0, sup: 1, pets: 0, inv: 1 }, langs: ['PL'], tag: 'Okna, witryny, przeszklenia. Woda demineralizowana, bez smug', bio: 'Myję okna systemem z wodą demineralizowaną. Ramy, parapety i rolety w cenie.' },
  { slug: 'babel', name: 'Bąbel · pranie tapicerki', ini: 'Bą', tone: 't-lilac', kind: 'Firma', lat: 52.2360, lng: 21.0900, r: 16, fee: 0, rate: 99, minH: 1, since: 2018, rs: 1130, rc: 233, jobs: 890, resp: 30, fixed: 1, svc: ['tapicerka'], f: { insured: 1, eco: 1, sup: 1, pets: 1, inv: 1 }, langs: ['PL'], tag: 'Kanapy, materace, dywany i fotele samochodowe. Schnie w 4 godziny', bio: 'Pierzemy ekstrakcyjnie, środkami bezpiecznymi dla dzieci i zwierząt.' },
  { slug: 'agnieszka', name: 'Agnieszka Wróbel', ini: 'AW', tone: 't-rose', kind: 'Osoba prywatna', lat: 52.2280, lng: 21.0100, r: 6, fee: 20, rate: 48, minH: 2, since: 2022, rs: 292, rc: 61, jobs: 120, resp: 12, svc: ['najem', 'dom', 'prasowanie'], f: { insured: 0, eco: 0, sup: 0, pets: 1, inv: 0 }, langs: ['PL', 'EN', 'DE'], tag: 'Obsługa mieszkań na wynajem: sprzątanie, pościel, zdjęcia stanu', bio: 'Obsługuję mieszkania na wynajem między gośćmi: sprzątanie, wymiana pościeli i raport zdjęciowy.' },
  { slug: 'kinga', name: 'Kinga Lis', ini: 'KL', tone: 't-sand', kind: 'Osoba prywatna', lat: 52.1450, lng: 21.0400, r: 7, fee: 15, rate: 40, minH: 3, since: 2022, rs: 360, rc: 74, jobs: 160, resp: 10, svc: ['dom', 'prasowanie'], f: { insured: 0, eco: 0, sup: 1, pets: 1, inv: 0 }, langs: ['PL'], tag: 'Ursynów i Kabaty. Mop parowy i własne środki', bio: 'Mieszkam na Kabatach, więc na Ursynowie jestem w kwadrans.' },
  { slug: 'tomasz', name: 'Tomasz Wójcik', ini: 'TW', tone: 't-blue', kind: 'Osoba prywatna', lat: 52.2550, lng: 21.0400, r: 8, fee: 15, rate: 44, minH: 3, since: 2021, rs: 279, rc: 58, jobs: 130, resp: 12, svc: ['dom', 'generalne'], f: { insured: 0, eco: 0, sup: 1, pets: 1, inv: 0 }, langs: ['PL'], tag: 'Praga i Śródmieście. Generalne porządki w kamienicach', bio: 'Sprzątam głównie mieszkania w kamienicach na Pradze.' },
  { slug: 'eko', name: 'EkoLśnienie', ini: 'EL', tone: 't-mint', kind: 'Firma · zespół 5 osób', lat: 52.1630, lng: 21.0850, r: 10, fee: 20, rate: 52, minH: 3, since: 2018, rs: 926, rc: 189, jobs: 420, resp: 9, sup_: 1, svc: ['dom', 'generalne', 'biuro'], f: { insured: 1, eco: 1, sup: 1, pets: 1, inv: 1 }, langs: ['PL'], tag: 'Wilanów, Mokotów, Ursynów. Tylko środki z certyfikatem Ecolabel', bio: 'Pracujemy wyłącznie na środkach z certyfikatem Ecolabel. Obsługujemy domy i małe biura.' },
  { slug: 'iryna', name: 'Iryna Bondar', ini: 'IB', tone: 't-rose', kind: 'Osoba prywatna', lat: 52.2470, lng: 20.9100, r: 7, fee: 15, rate: 41, minH: 3, since: 2020, rs: 498, rc: 102, jobs: 220, resp: 12, svc: ['dom', 'najem'], f: { insured: 0, eco: 0, sup: 1, pets: 1, inv: 0 }, langs: ['PL', 'UA'], tag: 'Bemowo, Wola, Bielany. Mieszkania i wynajem krótkoterminowy', bio: 'Obsługuję mieszkania na wynajem na Woli i Bemowie oraz zwykłe sprzątanie.' },
  { slug: 'kasia', name: 'Katarzyna Mazur', ini: 'KM', tone: 't-lilac', kind: 'Osoba prywatna', lat: 52.2900, lng: 20.9400, r: 6, fee: 15, rate: 43, minH: 3, since: 2019, rs: 648, rc: 131, jobs: 300, resp: 7, sup_: 1, svc: ['dom', 'okna'], f: { insured: 1, eco: 0, sup: 1, pets: 1, inv: 0 }, langs: ['PL'], tag: 'Bielany i Żoliborz. Mieszkania i okna w jednej wizycie', bio: 'Łączę sprzątanie mieszkania z myciem okien.' },
  // poza Warszawą
  { slug: 'krakowska-iskra', name: 'Iskra · Kraków', ini: 'IK', tone: 't-yellow', kind: 'Firma · zespół 4 osób', lat: 50.0700, lng: 19.9300, r: 9, fee: 15, rate: 50, minH: 3, since: 2017, rs: 1180, rc: 241, jobs: 760, resp: 14, svc: ['dom', 'generalne', 'najem', 'okna'], f: { insured: 1, eco: 1, sup: 1, pets: 1, inv: 1 }, langs: ['PL', 'EN'], tag: 'Kraków i okolice. Mieszkania i najem krótkoterminowy', bio: 'Obsługujemy mieszkania i apartamenty na wynajem w centrum Krakowa. Faktura VAT.' },
  { slug: 'zuzanna', name: 'Zuzanna Pietrzak', ini: 'ZP', tone: 't-mint', kind: 'Osoba prywatna', lat: 50.0850, lng: 20.0200, r: 7, fee: 10, rate: 42, minH: 3, since: 2021, rs: 402, rc: 84, jobs: 170, resp: 9, svc: ['dom', 'prasowanie'], f: { insured: 0, eco: 1, sup: 1, pets: 1, inv: 0 }, langs: ['PL'], tag: 'Kraków. Sprzątanie i prasowanie', bio: 'Sprzątam mieszkania w Krakowie, najchętniej we wschodniej części miasta.' },
  { slug: 'baltyk', name: 'Bałtyk Clean', ini: 'BC', tone: 't-blue', kind: 'Firma', lat: 54.3800, lng: 18.6000, r: 14, fee: 20, rate: 52, minH: 3, since: 2016, rs: 985, rc: 204, jobs: 650, resp: 18, svc: ['dom', 'generalne', 'remont', 'biuro'], f: { insured: 1, eco: 0, sup: 1, pets: 1, inv: 1 }, langs: ['PL', 'EN'], tag: 'Trójmiasto: Gdańsk, Sopot, Gdynia. Domy, biura, po remoncie', bio: 'Działamy w całym Trójmieście. Mamy sprzęt do sprzątania po remoncie i obsługujemy biura.' },
  { slug: 'odra', name: 'Natalia Szymańska', ini: 'NS', tone: 't-rose', kind: 'Osoba prywatna', lat: 51.1000, lng: 17.0300, r: 8, fee: 15, rate: 46, minH: 3, since: 2020, rs: 540, rc: 112, jobs: 260, resp: 10, svc: ['dom', 'okna', 'najem'], f: { insured: 1, eco: 1, sup: 1, pets: 1, inv: 0 }, langs: ['PL', 'DE'], tag: 'Wrocław. Mieszkania i okna', bio: 'Sprzątam mieszkania we Wrocławiu.' },
  { slug: 'warta', name: 'Warta Serwis', ini: 'WS', tone: 't-sand', kind: 'Firma', lat: 52.4060, lng: 16.9250, r: 10, fee: 0, rate: 48, minH: 3, since: 2018, rs: 770, rc: 160, jobs: 480, resp: 16, svc: ['dom', 'biuro', 'remont'], f: { insured: 1, eco: 0, sup: 1, pets: 0, inv: 1 }, langs: ['PL'], tag: 'Poznań i okolice. Mieszkania, biura, po remoncie', bio: 'Sprzątamy w całym Poznaniu i w gminach dookoła.' },
  { slug: 'piotrkowska', name: 'Monika Kaczmarek', ini: 'MK', tone: 't-lilac', kind: 'Osoba prywatna', lat: 51.7600, lng: 19.4600, r: 8, fee: 10, rate: 40, minH: 3, since: 2022, rs: 310, rc: 66, jobs: 140, resp: 8, svc: ['dom', 'generalne', 'prasowanie'], f: { insured: 0, eco: 0, sup: 1, pets: 1, inv: 0 }, langs: ['PL'], tag: 'Łódź. Mieszkania w kamienicach i blokach', bio: 'Sprzątam mieszkania w łódzkich kamienicach i blokach.' },
  { slug: 'torun', name: 'Pierniczek Sprząta', ini: 'PS', tone: 't-yellow', kind: 'Jednoosobowa firma', lat: 53.0100, lng: 18.6000, r: 10, fee: 15, rate: 44, minH: 3, since: 2019, rs: 450, rc: 95, jobs: 230, resp: 12, svc: ['dom', 'okna'], f: { insured: 1, eco: 0, sup: 1, pets: 1, inv: 1 }, langs: ['PL'], tag: 'Toruń i okolice. Mieszkania i okna', bio: 'Toruń, Lubicz i Wielka Nieszawka.' },
  { slug: 'blysk', name: 'Błysk Serwis', ini: 'BS', tone: 't-yellow', kind: 'Firma', lat: 52.2900, lng: 21.0600, r: 13, fee: 25, rate: 55, minH: 4, since: 2015, rs: 1253, rc: 264, jobs: 700, resp: 25, svc: ['remont', 'biuro', 'okna'], f: { insured: 1, eco: 0, sup: 1, pets: 1, inv: 1 }, langs: ['PL'], tag: 'Praga, Targówek, Białołęka. Remonty, biura, witryny', bio: 'Sprzątamy po remontach i budowach oraz obsługujemy biura i lokale usługowe.' }
];
// Wyróżnienia są w miastach (klucz = nazwa miasta jak w geo-pl.js).
const PROMO = { eko: ['Warszawa', 'Piaseczno'], kinga: ['Warszawa'], kasia: ['Warszawa', 'Łomianki'], 'krakowska-iskra': ['Kraków'], baltyk: ['Gdańsk', 'Sopot'], warta: ['Poznań'] };
const SUPER = ['marta', 'czysto', 'eko', 'kasia'];

function seed(db, { now = localNow() } = {}) {
  if (db.get('SELECT COUNT(*) c FROM users').c > 0) return false;
  const t = nowIso(); const ids = {};
  const user = (key, phone, name, role, simulated = 0) => { const id = newId('usr_'); ids[key] = id; db.run('INSERT INTO users (id, phone, name, role, simulated, created_at) VALUES (?,?,?,?,?,?)', id, phone, name, role, simulated, t); return id; };
  const ledger = (pid, gr, reason, at = t) => db.run('INSERT INTO credit_ledger (id, provider_id, amount_gr, reason, created_at) VALUES (?,?,?,?,?)', newId('crd_'), pid, gr, reason, at);
  const provider = (uid, x) => {
    db.run(`INSERT INTO providers (user_id, slug, display_name, initials, tone, kind, tagline, bio, services, langs, rate_gr, min_hours, fixed_price, per_window_gr, base_lat, base_lng, radius_km, fee_gr, supplies, eco, pets, invoice, insured,
      id_status, insurance_status, rating_sum, rating_count, jobs_done, response_min, since, super, invite_code, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      uid, x.slug, x.name, x.ini, x.tone, x.kind, x.tag, x.bio, JSON.stringify(x.svc), JSON.stringify(x.langs || ['PL']), x.rate * 100, x.minH, x.fixed || 0, (x.perWindow || 0) * 100, x.lat, x.lng, x.r, x.fee * 100,
      x.f.sup, x.f.eco, x.f.pets, x.f.inv, x.f.insured, 'verified', x.f.insured ? 'verified' : 'none', x.rs, x.rc, x.jobs, x.resp, x.since, SUPER.includes(x.slug) ? 1 : 0, x.slug, t);
    for (let d = 1; d <= 6; d++) if (d < 6 || x.rc > 150) db.run('INSERT INTO availability (provider_id, weekday, start_hour, end_hour) VALUES (?,?,8,18)', uid, d);
  };
  const booking = (o) => {
    const id = newId('bkg_');
    db.run(`INSERT INTO bookings (id, client_id, provider_id, service, m2, rooms, baths, extras, freq, starts_at, hours, price_gr, pay_method, address_id, address_text, lat, lng, onsite_name, onsite_phone, door_code, note, status, reminder_sent, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, o.client, o.provider, o.service, o.m2 || 54, o.rooms || 2, o.baths || 1, JSON.stringify(o.extras || []), o.freq || 'once', o.at, o.h, Math.round(o.zl * 100),
      o.pay || 'cash', o.addressId || null, o.address, o.lat, o.lng, o.onsiteName || '', o.onsitePhone || '', o.doorCode || '', o.note || '', o.status, o.reminder ? 1 : 0, t, t);
    return id;
  };
  const day = (n, hm) => `${addDays(now, n).slice(0, 10)}T${hm}`;

  db.tx(() => {
    user('admin', '+48500100999', 'Zespół Lśni', 'admin');
    const kasia = user('kasia', '+48500100200', 'Kasia Nowicka', 'client');
    const ola = user('ola', '+48500100300', 'Ola Zielińska', 'pro');
    // klienci z historią (do opinii i zapytań)
    for (const [k, n] of [['c1', 'Michał Zając'], ['c2', 'Ania Kozłowska'], ['c3', 'Tomasz Lewandowski'], ['c4', 'Joanna Wiśniewska'], ['c5', 'Ewa Malinowska'], ['c6', 'Marek Dąbrowski'], ['c7', 'Krzysztof Wójcik']]) user(k, '+48' + (600000000 + Object.keys(ids).length * 1111), n, 'client', 1);
    // wykonawcy z danych startowych reagują sami w trybie demo
    PROS.forEach((x, i) => provider(user('p_' + x.slug, '+48' + (700000000 + i * 1013), x.name, 'pro', 1), x));
    provider(ola, { slug: 'ola-zielinska', name: 'Ola Zielińska', ini: 'OZ', tone: 't-mint', kind: 'Osoba prywatna', lat: 52.1880, lng: 21.0200, r: 8, fee: 15, rate: 45, minH: 3, since: 2023, rs: 187, rc: 38, jobs: 112, resp: 11, svc: ['dom', 'generalne'], f: { insured: 0, eco: 1, sup: 1, pets: 1, inv: 0 }, tag: 'Dokładne sprzątanie mieszkań, ekologiczne środki', bio: 'Sprzątam od 3 lat. Pracuję według checklisty pokój po pokoju, przynoszę własne środki.' });

    // adresy Kasi
    const adr = (id, label, street, lat, lng, note) => db.run('INSERT INTO addresses (id, user_id, label, street, lat, lng, note, created_at) VALUES (?,?,?,?,?,?,?,?)', id, kasia, label, street, lat, lng, note, t);
    adr('adr_home', 'Dom', 'ul. Puławska 112/14', 52.1950, 21.0240, '4 piętro, winda');
    adr('adr_mama', 'Mieszkanie mamy', 'ul. Odyńca 27/3', 52.1925, 21.0130, 'parter');
    adr('adr_office', 'Biuro', 'Rondo Daszyńskiego 2', 52.2300, 20.9840, 'recepcja, 12 piętro');

    // rezerwacje Kasi: jutro u Marty (stałe), dwie zakończone
    const home = { addressId: 'adr_home', address: 'ul. Puławska 112/14', lat: 52.195, lng: 21.024 };
    booking(Object.assign({ client: kasia, provider: ids.p_marta, service: 'dom', extras: ['lodowka'], freq: 'biweek', at: day(1, '10:00'), h: 3.5, zl: 133.88, status: 'confirmed', doorCode: '14K2580' }, home));
    const b2 = booking(Object.assign({ client: kasia, provider: ids.p_czysto, service: 'remont', extras: ['szafki'], at: day(-20, '08:00'), h: 5, zl: 299.99, status: 'done', pay: 'transfer' }, home));
    const b3 = booking(Object.assign({ client: kasia, provider: ids.p_olena, service: 'prasowanie', m2: 0, at: day(-34, '16:00'), h: 2, zl: 84, status: 'done', pay: 'blikphone' }, home));
    db.run("INSERT INTO reviews (id, booking_id, client_id, provider_id, stars, tags, body, created_at) VALUES (?,?,?,?,5,'[\"Szybko\"]','Koszule wyprasowane idealnie.',?)", newId('rev_'), b3, kasia, ids.p_olena, t);

    // historyczne opinie na profilach
    const rv = (pslug, client, stars, body, tags, daysAgo) => {
      const b = booking({ client: ids[client], provider: ids['p_' + pslug], service: 'dom', at: day(-daysAgo, '10:00'), h: 3, zl: 135, status: 'done', address: 'ul. Wiśniowa 10', lat: 52.205, lng: 21.012 });
      db.run('INSERT INTO reviews (id, booking_id, client_id, provider_id, stars, tags, body, created_at) VALUES (?,?,?,?,?,?,?,?)', newId('rev_'), b, ids[client], ids['p_' + pslug], stars, JSON.stringify(tags), body, addDays(now, -daysAgo) + ':00.000Z');
    };
    rv('marta', 'c2', 5, 'Przyszła punktualnie, łazienka wygląda jak w hotelu. Zostawiła nawet notatkę, co warto wymienić w odpływie.', ['Punktualna', 'Łazienka lśni'], 11);
    rv('marta', 'c1', 5, 'Stałe sprzątanie co 2 tygodnie od pół roku. Zero problemów.', ['Stały klient'], 20);
    rv('czysto', 'c3', 5, 'Po remoncie łazienki i kuchni pył zniknął nawet z szafek w środku.', ['Po remoncie'], 20);
    rv('eko', 'c1', 5, 'Dom 180 m², dwie osoby, pięć godzin. Bez chemicznego zapachu.', ['Eco'], 9);
    rv('kinga', 'c4', 5, 'Szybko i dokładnie, fugi w łazience wreszcie białe.', ['Fugi'], 13);
    rv('ola-zielinska'.replace('ola-zielinska', 'marta'), 'c5', 4, 'Bardzo dokładnie, trochę dłużej niż szacowała, ale uprzedziła wcześniej.', ['Dokładna'], 26);

    // wątek Kasi z Martą
    const msg = (client, provider, sender, body, minsAgo) => db.run('INSERT INTO messages (id, client_id, provider_id, sender_id, body, created_at, read_at) VALUES (?,?,?,?,?,?,?)', newId('msg_'), client, provider, sender, body, new Date(Date.now() - minsAgo * 60e3).toISOString(), sender === client ? null : null);
    msg(kasia, ids.p_marta, ids.p_marta, 'Dzień dobry! Potwierdzam jutro o 10:00. Czy w budynku jest winda?', 300);
    msg(kasia, ids.p_marta, kasia, 'Dzień dobry, tak, winda jest. Kod do domofonu wyślę rano.', 290);
    msg(kasia, ids.p_marta, ids.p_marta, 'Super, dziękuję. Biorę odkurzacz i środki do kamienia do łazienki.', 289);

    // powiadomienia Kasi
    const ntf = (uid, kind, title, body, link, minsAgo, read = false) => db.run('INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?,?,?,?,?,?,?,?)', newId('ntf_'), uid, kind, title, body, link, read ? t : null, new Date(Date.now() - minsAgo * 60e3).toISOString());
    ntf(kasia, 'booking_confirmed', 'Rezerwacja potwierdzona', 'Marta Kowalczyk przyjęła wizytę na jutro, 10:00.', '', 900);
    ntf(kasia, 'review_request', 'Jak było po remoncie?', 'Oceń Czysto & Basta. Twoja opinia pomoże innym.', `booking:${b2}`, 20 * 1440, true);

    // grafik i zapytania Oli
    const job = (client, at, h, zl, status, address, lat, lng, extra = {}) => booking(Object.assign({ client: ids[client], provider: ola, service: 'dom', at, h, zl, status, address, lat, lng }, extra));
    job('c6', day(0, '09:00'), 2.5, 112.5, 'confirmed', 'ul. Rakowiecka 21/4', 52.2060, 21.0050, { note: 'Domofon nie działa, proszę dzwonić przez aplikację.' });
    job('c5', day(0, '14:00'), 3, 135, 'confirmed', 'al. KEN 51/30', 52.1450, 21.0450, { entry: 'concierge' });
    job('c7', day(1, '09:00'), 3, 202.5, 'confirmed', 'ul. Belwederska 9', 52.2050, 21.0300, { service: 'generalne' });
    job('c3', day(2, '10:00'), 3.5, 157.5, 'pending', 'ul. Puławska 80/2', 52.2010, 21.0230, { freq: 'biweek', pets: 'dog', note: 'Mam psa, jest przyjazny. Najważniejsza kuchnia i łazienka.' });
    job('c4', day(1, '12:00'), 2.5, 112.5, 'pending', 'ul. Kopernika 30', 52.2360, 21.0200, { service: 'generalne', note: 'Między gośćmi: pościel w szafie, raport zdjęciowy po sprzątaniu.' });
    for (let i = 0; i < 4; i++) job('c' + (i + 1), day(-(i * 2 + 1), '10:00'), 3, [180, 320, 210, 530][i], 'done', 'ul. Racławicka 99', 52.2000, 21.0050);
    msg(ids.c3, ola, ids.c3, 'Dzień dobry, czy da się w sobotę o 10? Mam psa, ale jest przyjazny.', 120);
    msg(ids.c5, ola, ola, 'Dzień dobry, będę dziś o 14:00.', 400);
    msg(ids.c5, ola, ids.c5, 'Super, klucz zostawię u portiera.', 398);

    // kredyt i zaproszenia Oli, wyróżnienie na Mokotowie
    ledger(ola, 5000, 'Kredyt na start', addDays(now, -40) + ':00.000Z');
    ['c1', 'c2', 'c4'].forEach(c => { db.run('INSERT INTO invites (id, provider_id, client_id, credited, created_at) VALUES (?,?,?,1,?)', newId('inv_'), ola, ids[c], t); ledger(ola, 2000, `Klient z Twojego linku: ${c === 'c1' ? 'Michał' : c === 'c2' ? 'Ania' : 'Joanna'}`); });
    const boost = (pid, district, days, price, views, guaranteed, startOffset) => {
      const id = newId('bst_'); const starts = addDays(now, startOffset);
      db.run('INSERT INTO boosts (id, provider_id, district, days, price_gr, paid_credit_gr, guaranteed_views, views, opens, requests, starts_at, ends_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', id, pid, district, days, price, price, guaranteed, views, Math.round(views / 7), Math.round(views / 30), starts, addDays(starts, days));
      return id;
    };
    boost(ola, 'Warszawa', 3, 3300, 61, 122, -1); ledger(ola, -3300, 'Wyróżnienie: Warszawa (3 dni)');
    Object.entries(PROMO).forEach(([slug, list]) => list.forEach(d => boost(ids['p_' + slug], d, 14, 5000, 40, 200, -3)));
  });
  return true;
}

if (require.main === module) {
  const { config } = require('./config');
  if (process.argv.includes('--reset')) {
    const f = config.dbFile || path.join(config.dataDir, 'lsni.db');
    for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(f + ext)) fs.unlinkSync(f + ext);
  }
  const db = require('./db').open();
  console.log(seed(db) ? 'Dane startowe zapisane.' : 'Baza ma już dane. Użyj --reset, żeby zacząć od nowa.');
  db.close();
}

module.exports = { seed };
