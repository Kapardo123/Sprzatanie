'use strict';
const geo = require('../geo');
const { SERVICES, boostPriceGr, boostGuaranteedViews } = require('../pricing');
const { config } = require('../config');
const files = require('../services/files');
const { newId, nowIso, v, fail, badRequest, notFound, conflict, localNow, addDays, addHours, weekdayOf, zl, json } = require('../util');
const { firstName } = require('../domain');

const slugify = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'wykonawca';
const TONES = ['t-yellow', 't-blue', 't-mint', 't-rose', 't-lilac', 't-sand'];

module.exports = function proRoutes(r, { db, domain, notifier, sms, mapbox }) {
  const { notify, notifyAdmins } = notifier;

  // ---------- profil (tworzy konto wykonawcy przy pierwszym zapisie) ----------
  r.post('/api/pro/profile', { auth: 'user' }, ({ user, body }) => {
    const existing = domain.providerById(user.id);
    const name = v.str(body.displayName ?? (existing && existing.display_name), 'wyświetlana nazwa', { min: 3, max: 60 });
    const services = v.arr(body.services ?? (existing && json(existing.services, [])), 'usługi', { of: SERVICES, max: 8 });
    if (!services.length) badRequest('Wybierz co najmniej jedną usługę', 'validation');
    const rate = v.num(body.rate ?? (existing && existing.rate_gr / 100), 'stawka', { min: 25, max: 200 });
    const lat = v.num(body.baseLat ?? (existing && existing.base_lat), 'baza (szerokość)', { min: 49, max: 55 });
    const lng = v.num(body.baseLng ?? (existing && existing.base_lng), 'baza (długość)', { min: 14, max: 25 });
    if (!geo.inPoland(lat, lng)) fail(422, 'outside_area', 'Baza musi być w Polsce');
    const radius = v.num(body.radiusKm ?? (existing ? existing.radius_km : 6), 'zasięg', { min: 2, max: 20 });
    const fee = v.num(body.fee ?? (existing ? existing.fee_gr / 100 : 0), 'dopłata za dojazd', { min: 0, max: 50 });
    const flag = (k, col) => (body[k] !== undefined ? (v.bool(body[k]) ? 1 : 0) : existing ? existing[col] : 0);
    const fields = {
      display_name: name, initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      tagline: v.str(body.tagline ?? (existing && existing.tagline), 'opis w jednym zdaniu', { max: 120, optional: true }),
      bio: v.str(body.bio ?? (existing && existing.bio), 'o mnie', { max: 1500, optional: true }),
      services: JSON.stringify(services), rate_gr: Math.round(rate * 100), min_hours: v.num(body.minHours ?? (existing ? existing.min_hours : 3), 'minimum godzin', { min: 1, max: 8 }),
      base_lat: lat, base_lng: lng, radius_km: radius, fee_gr: Math.round(fee * 100),
      supplies: flag('supplies', 'supplies'), eco: flag('eco', 'eco'), pets: flag('pets', 'pets'), invoice: flag('invoice', 'invoice')
    };
    db.tx(() => {
      if (existing) db.run(`UPDATE providers SET ${Object.keys(fields).map(k => k + ' = ?').join(', ')} WHERE user_id = ?`, ...Object.values(fields), user.id);
      else {
        let slug = slugify(name); while (db.get('SELECT 1 FROM providers WHERE slug = ?', slug)) slug += '-' + Math.floor(Math.random() * 90 + 10);
        const cols = Object.assign({ user_id: user.id, slug, invite_code: slug, tone: TONES[Math.floor(Math.random() * TONES.length)], since: new Date().getFullYear(), created_at: nowIso() }, fields);
        db.run(`INSERT INTO providers (${Object.keys(cols).join(', ')}) VALUES (${Object.keys(cols).map(() => '?').join(', ')})`, ...Object.values(cols));
        for (let d = 1; d <= 5; d++) db.run('INSERT INTO availability (provider_id, weekday, start_hour, end_hour) VALUES (?,?,8,18)', user.id, d);
        db.run("UPDATE users SET role = 'pro' WHERE id = ? AND role = 'client'", user.id);
        db.run('INSERT INTO credit_ledger (id, provider_id, amount_gr, reason, created_at) VALUES (?,?,?,?,?)', newId('crd_'), user.id, config.startCreditGr, 'Kredyt na start', nowIso());
      }
    });
    notifyWaitlist(domain.providerById(user.id));
    return proSelf(user.id);
  });
  // Osoby z listy oczekujących dostają wiadomość, gdy ktoś zacznie dojeżdżać w ich okolicy.
  function notifyWaitlist(p) {
    db.all('SELECT * FROM waitlist WHERE notified = 0').filter(w => geo.reach(p, w).reach === 'in').forEach(w => {
      db.run('UPDATE waitlist SET notified = 1 WHERE id = ?', w.id);
      if (w.user_id) notify(w.user_id, { kind: 'waitlist', title: 'Lśni działa już w Twojej okolicy', body: `${p.display_name} dojeżdża pod Twój adres.`, link: `provider:${p.slug}`, sms: true });
      else if (w.phone) sms(w.phone, `Lśni działa już w Twojej okolicy (${w.area}). Zarezerwuj sprzątanie w aplikacji.`);
    });
  }

  function proSelf(id) {
    const p = domain.providerById(id) || notFound('Nie masz jeszcze profilu wykonawcy');
    return Object.assign(domain.providerView(p, null, { full: true }), {
      published: !!p.published, online: !!p.online, idStatus: p.id_status, insuranceStatus: p.insurance_status, inviteCode: p.invite_code,
      creditZl: domain.creditGr(id) / 100, bio: p.bio,
      coveredDistricts: domain.coveredAreas(p).map(a => a.key),
      coveredAreas: domain.coveredAreas(p).map(domain.areaView), homeArea: domain.areaView(geo.areaAt(p.base_lat, p.base_lng)),
      availability: db.all('SELECT weekday, start_hour, end_hour FROM availability WHERE provider_id = ? ORDER BY weekday', id)
    });
  }
  r.get('/api/pro/me', { auth: 'pro' }, ({ user }) => proSelf(user.id));
  r.post('/api/pro/online', { auth: 'pro' }, ({ user, body }) => { db.run('UPDATE providers SET online = ? WHERE user_id = ?', v.bool(body.online) ? 1 : 0, user.id); return proSelf(user.id); });
  r.patch('/api/pro/availability', { auth: 'pro' }, ({ user, body }) => {
    v.arr(body.days, 'dni', { max: 7 }).forEach(d => {
      const wd = v.num(d.weekday, 'dzień', { min: 0, max: 6, int: true });
      if (!d.on) return db.run('DELETE FROM availability WHERE provider_id = ? AND weekday = ?', user.id, wd);
      const s = v.num(d.start ?? 8, 'od', { min: 6, max: 20, int: true }), e = v.num(d.end ?? 18, 'do', { min: s + 2, max: 22, int: true });
      db.run('INSERT INTO availability (provider_id, weekday, start_hour, end_hour) VALUES (?,?,?,?) ON CONFLICT(provider_id, weekday) DO UPDATE SET start_hour = excluded.start_hour, end_hour = excluded.end_hour', user.id, wd, s, e);
    });
    return proSelf(user.id);
  });

  // ---------- panel ----------
  r.get('/api/pro/dashboard', { auth: 'pro' }, ({ user, now }) => {
    const p = domain.providerById(user.id) || notFound('Nie masz jeszcze profilu wykonawcy');
    const monday = addDays(now, -((weekdayOf(now) + 6) % 7)).slice(0, 10);
    const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(monday + 'T00:00', i).slice(0, 10); return { date: d, zl: db.get("SELECT COALESCE(SUM(price_gr),0) s FROM bookings WHERE provider_id = ? AND status = 'done' AND substr(starts_at,1,10) = ?", user.id, d).s / 100 }; });
    const since30 = addDays(now, -30);
    const boosts = db.all('SELECT * FROM boosts WHERE provider_id = ? ORDER BY starts_at DESC', user.id);
    const stats = boosts.filter(b => b.ends_at > since30).reduce((a, b) => ({ views: a.views + b.views, opens: a.opens + b.opens, requests: a.requests + b.requests }), { views: 0, opens: 0, requests: 0 });
    const requests = db.all("SELECT * FROM bookings WHERE provider_id = ? AND status = 'pending' ORDER BY starts_at", user.id).map(b => domain.bookingView(b, user, now));
    const next = db.get("SELECT * FROM bookings WHERE provider_id = ? AND status IN ('confirmed','enroute','progress') AND starts_at >= ? ORDER BY starts_at", user.id, now.slice(0, 10));
    const todos = [
      { key: 'id', label: 'Potwierdź tożsamość', ok: p.id_status === 'verified', pending: p.id_status === 'pending' },
      { key: 'insurance', label: 'Wgraj polisę OC', ok: p.insurance_status === 'verified', pending: p.insurance_status === 'pending' },
      { key: 'bio', label: 'Opisz siebie w min. 80 znakach', ok: p.bio.length >= 80 },
      { key: 'invite', label: 'Zaproś pierwszych 3 stałych klientów', ok: db.get('SELECT COUNT(*) c FROM invites WHERE provider_id = ?', user.id).c >= 3 }
    ];
    return {
      week, weekTotalZl: week.reduce((a, d) => a + d.zl, 0), requests, next: next ? domain.bookingView(next, user, now) : null,
      stats30d: stats, creditZl: domain.creditGr(user.id) / 100, activeBoosts: boosts.filter(b => b.ends_at > now && b.starts_at <= now).map(boostView),
      rating: p.rating_count ? Math.round(p.rating_sum / p.rating_count * 100) / 100 : 0, reviews: p.rating_count, todos
    };
  });
  // Grafik dnia z trasą: kolejność wizyt, kilometry i czas jazdy od bazy.
  r.get('/api/pro/day', { auth: 'pro' }, async ({ user, query, now }) => {
    const p = domain.providerById(user.id); const date = query.date ? v.date(query.date, 'data') : now.slice(0, 10);
    const jobs = db.all("SELECT * FROM bookings WHERE provider_id = ? AND substr(starts_at,1,10) = ? AND status IN ('confirmed','enroute','progress','done','noshow') ORDER BY starts_at", user.id, date);
    let prev = { lat: p.base_lat, lng: p.base_lng }, km = 0, min = 0;
    const legs = jobs.map(b => { const d = geo.roadKm(prev, b); prev = b; km += d; min += geo.driveMin(d); return { bookingId: b.id, km: Math.round(d * 10) / 10, min: geo.driveMin(d) }; });
    if (jobs.length) { const back = geo.roadKm(prev, { lat: p.base_lat, lng: p.base_lng }); km += back; min += geo.driveMin(back); }
    const base = { lat: p.base_lat, lng: p.base_lng };
    const rt = jobs.length ? await mapbox.route([base, ...jobs.map(b => ({ lat: b.lat, lng: b.lng })), base]) : null;
    if (rt) rt.legs.slice(0, legs.length).forEach((l, i) => Object.assign(legs[i], l));
    return { date, base, jobs: jobs.map(b => domain.bookingView(b, user, now)), legs, totalKm: rt ? rt.km : Math.round(km * 10) / 10, totalDriveMin: rt ? rt.min : min,
      geometry: rt ? rt.coordinates : [base, ...jobs, base].map(x => [x.lng, x.lat]), source: rt ? 'mapbox' : 'estimate' };
  });

  // ---------- weryfikacja: dokument tożsamości / polisa OC ----------
  r.post('/api/pro/verification', { auth: 'pro' }, ({ user, body }) => {
    const kind = v.oneOf(body.kind, 'rodzaj', ['id', 'insurance']);
    const col = kind === 'id' ? 'id_status' : 'insurance_status';
    const p = domain.providerById(user.id) || notFound('Najpierw utwórz profil wykonawcy');
    if (p[col] === 'verified') conflict('Ten dokument jest już zweryfikowany', 'already_verified');
    if (p[col] === 'pending') conflict('Poprzednie zgłoszenie czeka na sprawdzenie', 'pending');
    const saved = files.saveDataUrls(body.files, 'kyc', { max: 3 });
    if (!saved.length) badRequest(kind === 'id' ? 'Dodaj zdjęcie dowodu i selfie' : 'Dodaj polisę OC (PDF lub zdjęcie)', 'files_required');
    const id = newId('ver_');
    db.run('INSERT INTO verifications (id, provider_id, kind, files, created_at) VALUES (?,?,?,?,?)', id, user.id, kind, JSON.stringify(saved), nowIso());
    db.run(`UPDATE providers SET ${col} = 'pending' WHERE user_id = ?`, user.id);
    notifyAdmins({ kind: 'admin_verification', title: kind === 'id' ? 'Nowy dokument tożsamości' : 'Nowa polisa OC', body: p.display_name, link: `admin:verification:${id}` });
    return { __status: 201, data: { id, status: 'pending', message: 'Sprawdzamy zwykle w ciągu 1 dnia roboczego' } };
  });

  // ---------- wyróżnienia i kredyt ----------
  const boostView = b => ({ id: b.id, district: b.district, area: geo.areaByKey(b.district) ? geo.areaLabel(geo.areaByKey(b.district)) : b.district, days: b.days, priceZl: b.price_gr / 100, startsAt: b.starts_at, endsAt: b.ends_at, views: b.views, opens: b.opens, requests: b.requests, guaranteedViews: b.guaranteed_views, settled: !!b.settled, refundedZl: b.refunded_gr / 100 });
  r.get('/api/pro/boosts', { auth: 'pro' }, ({ user, query, now }) => {
    const p = domain.providerById(user.id); const days = [3, 7, 14].includes(Number(query.days)) ? Number(query.days) : 7;
    const active = db.all('SELECT * FROM boosts WHERE provider_id = ? AND starts_at <= ? AND ends_at > ? ORDER BY ends_at', user.id, now, now);
    return {
      creditZl: domain.creditGr(user.id) / 100, days,
      districts: domain.boostQuote(p, days).map(q => Object.assign(q, { active: active.some(b => b.district === q.district) })),
      active: active.map(boostView),
      history: db.all('SELECT * FROM boosts WHERE provider_id = ? AND ends_at <= ? ORDER BY ends_at DESC LIMIT 20', user.id, now).map(boostView),
      ledger: db.all('SELECT amount_gr, reason, created_at FROM credit_ledger WHERE provider_id = ? ORDER BY created_at DESC LIMIT 50', user.id).map(l => ({ amountZl: l.amount_gr / 100, reason: l.reason, at: l.created_at }))
    };
  });
  r.post('/api/pro/boosts', { auth: 'pro' }, ({ user, body, now }) => {
    const p = domain.providerById(user.id) || notFound('Najpierw utwórz profil wykonawcy');
    const days = v.oneOf(Number(body.days), 'czas trwania', [3, 7, 14]);
    // Obszary to miasta, podawane nazwą, np. "Gdańsk".
    const districts = v.arr(body.districts ?? body.areas ?? body.cities, 'miasta', { max: 12 }).map(String);
    if (!districts.length) badRequest('Wybierz co najmniej jedno miasto', 'validation');
    for (const n of districts) {
      const a = geo.areaByKey(n);
      if (!a || a.kind === 'outskirts') badRequest(`Nie znamy miasta „${n}”`, 'validation');
      if (!geo.servesArea(p, a)) fail(422, 'outside_reach', `${geo.areaLabel(a)}: poza Twoim zasięgiem dojazdu`);
      if (db.get('SELECT 1 FROM boosts WHERE provider_id = ? AND district = ? AND ends_at > ?', user.id, n, now)) conflict(`${geo.areaLabel(a)}: wyróżnienie już trwa`, 'already_active');
    }
    const items = districts.map(n => { const d = domain.demand(n); return { n, price: boostPriceGr(d, days), views: boostGuaranteedViews(d, days) }; });
    const total = items.reduce((a, x) => a + x.price, 0); const credit = domain.creditGr(user.id);
    // Dopłata ponad kredyt wymaga płatności (np. Przelewy24); do czasu podpięcia operatora zwracamy kwotę do zapłaty.
    if (total > credit) fail(402, 'payment_required', `Brakuje ${zl(total - credit)} kredytu`, { missingZl: (total - credit) / 100, totalZl: total / 100, creditZl: credit / 100 });
    const created = db.tx(() => items.map(x => {
      const id = newId('bst_');
      db.run('INSERT INTO boosts (id, provider_id, district, days, price_gr, paid_credit_gr, guaranteed_views, starts_at, ends_at) VALUES (?,?,?,?,?,?,?,?,?)', id, user.id, x.n, days, x.price, x.price, x.views, now, addDays(now, days));
      db.run('INSERT INTO credit_ledger (id, provider_id, amount_gr, reason, ref, created_at) VALUES (?,?,?,?,?,?)', newId('crd_'), user.id, -x.price, `Wyróżnienie: ${geo.areaLabel(geo.areaByKey(x.n))} (${days} dni)`, id, nowIso());
      return id;
    }));
    return { __status: 201, data: { boosts: created.map(id => boostView(db.get('SELECT * FROM boosts WHERE id = ?', id))), creditZl: domain.creditGr(user.id) / 100 } };
  });

  // ---------- zaproszenia ----------
  r.get('/api/pro/invite', { auth: 'pro' }, ({ user }) => {
    const p = domain.providerById(user.id) || notFound();
    const rows = db.all('SELECT i.*, u.name FROM invites i JOIN users u ON u.id = i.client_id WHERE i.provider_id = ? ORDER BY i.created_at DESC', user.id);
    return { code: p.invite_code, path: `/z/${p.invite_code}`, joined: rows.length, credited: rows.filter(x => x.credited).length, earnedZl: rows.filter(x => x.credited).length * config.inviteCreditGr / 100,
      clients: rows.map(x => ({ name: firstName(x.name), credited: !!x.credited, at: x.created_at })) };
  });

  return { proSelf, notifyWaitlist };
};
