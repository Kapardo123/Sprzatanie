'use strict';
// Logika wspólna dla wielu endpointów: widoki wykonawców i rezerwacji, wolne terminy, ranking, kredyt, popyt.
const geo = require('./geo');
const { reachWith } = require('./services/mapbox');
const { SLOT_HOURS, SERVICE_NAMES, boostPriceGr, boostGuaranteedViews } = require('./pricing');
const { json, localNow, addDays, addHours, toMs, weekdayOf, hoursBetween, notFound } = require('./util');
const { config } = require('./config');

const ACTIVE = ['pending', 'confirmed', 'enroute', 'progress'];
const DAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];

function createDomain(db) {
  const providerBySlug = slug => db.get('SELECT * FROM providers WHERE slug = ?', slug);
  const providerById = id => db.get('SELECT * FROM providers WHERE user_id = ?', id);
  const mustProvider = slug => providerBySlug(slug) || notFound('Nie ma takiego wykonawcy');

  // ---------- popyt w kole: wyszukiwania z ostatnich 7 dni wokół punktu, nie mniej niż wartość startowa ----------
  // Nie ma dzielnic ani miast: popyt liczymy dla koła (baza wykonawcy + promień dojazdu).
  function demandIn(lat, lng, radiusKm) {
    const since = new Date(Date.now() - 7 * 86400e3).toISOString(); const c = { lat, lng }; const straight = radiusKm / geo.ROAD;
    const n = db.all('SELECT lat, lng FROM search_log WHERE created_at > ? AND lat IS NOT NULL', since).filter(r => geo.haversineKm(c, r) <= straight).length;
    return Math.max(geo.baselineDemand(lat, lng, radiusKm), Math.round(n / 7));
  }
  // Nazwa miejsca bazy wykonawcy (do wyświetlania, nie jest obszarem)
  const baseLabel = p => p.base_label || geo.placeName(p.base_lat, p.base_lng).name;

  // ---------- wolne terminy ----------
  function slotsFor(p, date, now = localNow()) {
    const day = date + 'T00:00';
    const av = db.get('SELECT start_hour, end_hour FROM availability WHERE provider_id = ? AND weekday = ?', p.user_id, weekdayOf(day));
    if (!av) return [];
    const busy = db.all(`SELECT starts_at, hours FROM bookings WHERE provider_id = ? AND status IN ('pending','confirmed','enroute','progress') AND substr(starts_at,1,10) = ?`, p.user_id, date);
    return SLOT_HOURS.filter(h => h >= av.start_hour && h < av.end_hour).map(h => `${String(h).padStart(2, '0')}:00`).filter(t => {
      const at = `${date}T${t}`;
      if (toMs(at) <= toMs(now) + 3600e3) return false;
      return !busy.some(b => toMs(at) < toMs(b.starts_at) + b.hours * 3600e3 && toMs(at) + 2 * 3600e3 > toMs(b.starts_at));
    });
  }
  function nextSlot(p, now = localNow()) {
    for (let i = 0; i < 7; i++) {
      const date = addDays(now, i).slice(0, 10); const s = slotsFor(p, date, now);
      if (s.length) return { date, time: s[0], label: `${i === 0 ? 'Dziś' : i === 1 ? 'Jutro' : DAYS[weekdayOf(date + 'T00:00')]} ${s[0].replace(/^0/, '')}`, today: i === 0 };
    }
    return null;
  }

  // ---------- wyróżnienia i kredyt ----------
  const activeBoosts = (now = localNow()) => db.all('SELECT * FROM boosts WHERE starts_at <= ? AND ends_at > ?', now, now);
  const creditGr = providerId => db.get('SELECT COALESCE(SUM(amount_gr),0) s FROM credit_ledger WHERE provider_id = ?', providerId).s;
  // Wyróżnienie obejmuje cały zasięg dojazdu wykonawcy: cena zależy od popytu w tym kole.
  function boostQuote(p, days) {
    const d = demandIn(p.base_lat, p.base_lng, p.radius_km);
    return { demand: d, searchers: d * 7, days, priceZl: boostPriceGr(d, days) / 100, guaranteedViews: boostGuaranteedViews(d, days), competitors: countNear(p),
      prices: Object.fromEntries([3, 7, 14].map(n => [n, boostPriceGr(d, n) / 100])), views: Object.fromEntries([3, 7, 14].map(n => [n, boostGuaranteedViews(d, n)])) };
  }
  // Konkurencja: inni wykonawcy z bazą w zasięgu dojazdu
  const countNear = p => db.all('SELECT base_lat, base_lng, user_id FROM providers WHERE published = 1 AND user_id != ?', p.user_id)
    .filter(x => geo.roadKm({ lat: p.base_lat, lng: p.base_lng }, { lat: x.base_lat, lng: x.base_lng }) <= p.radius_km).length;

  // ---------- widok wykonawcy dla klienta ----------
  function providerView(p, point, { promoted = false, full = false, road = null } = {}) {
    const r = point ? reachWith(p, point, road) : null; const ns = nextSlot(p);
    const out = {
      id: p.slug, name: p.display_name, ini: p.initials, tone: p.tone, kind: p.kind, area: baseLabel(p),
      tagline: p.tagline, services: json(p.services, []), langs: json(p.langs, []), rate: p.rate_gr / 100, minH: p.min_hours,
      fixed: !!p.fixed_price, perWindow: p.per_window_gr ? p.per_window_gr / 100 : 0, since: p.since, super: !!p.super,
      verified: p.id_status === 'verified', insured: !!p.insured, invoice: !!p.invoice, supplies: !!p.supplies, eco: !!p.eco, pets: !!p.pets,
      rating: p.rating_count ? Math.round(p.rating_sum / p.rating_count * 100) / 100 : 0, reviews: p.rating_count, jobs: p.jobs_done,
      response: `${p.response_min} min`, base: { lat: p.base_lat, lng: p.base_lng }, radiusKm: p.radius_km, kmRate: p.km_rate_gr / 100, freeKm: p.free_km,
      nextSlot: ns ? ns.label : 'Brak wolnych terminów', todayFree: !!(ns && ns.today), promoted
    };
    if (r) Object.assign(out, { dist: r.km, eta: r.eta, reach: r.reach, travelFee: r.feeGr / 100, distSource: r.source || 'estimate' });
    if (full) {
      out.bio = p.bio;
      out.reviewsList = db.all("SELECT r.*, u.name client_name FROM reviews r JOIN users u ON u.id = r.client_id WHERE r.provider_id = ? AND r.status = 'published' ORDER BY r.created_at DESC LIMIT 20", p.user_id)
        .map(x => ({ id: x.id, who: firstName(x.client_name), stars: x.stars, when: x.created_at.slice(0, 10), text: x.body, tags: json(x.tags, []), reply: x.reply_status === 'published' ? x.reply : '' }));
      out.week = Array.from({ length: 7 }, (_, i) => { const date = addDays(localNow(), i).slice(0, 10); return { date, free: slotsFor(p, date).length }; });
    }
    return out;
  }

  // ---------- wyszukiwanie i ranking ----------
  function search(q, point, roads = null) {
    db.run("INSERT INTO search_log (district, lat, lng, created_at) VALUES ('', ?, ?, ?)", Math.round(point.lat * 1e3) / 1e3, Math.round(point.lng * 1e3) / 1e3, new Date().toISOString());
    const text = geo.fold(q.q);
    let list = db.all('SELECT * FROM providers WHERE published = 1 AND online = 1').map(p => ({ p, v: providerView(p, point, { road: roads && roads.get(p.user_id) }) })).filter(({ p, v }) => {
      if (q.service && !v.services.includes(q.service)) return false;
      if (text && !geo.fold(v.name + ' ' + v.tagline + ' ' + v.area + ' ' + v.services.map(s => SERVICE_NAMES[s]).join(' ')).includes(text)) return false;
      if (q.maxPrice && !v.fixed && v.rate > Number(q.maxPrice)) return false;
      if (q.minRating && v.rating < Number(q.minRating)) return false;
      for (const k of ['verified', 'insured', 'supplies', 'eco', 'pets', 'invoice']) if (q[k] === '1' && !v[k]) return false;
      if (q.today === '1' && !v.todayFree) return false;
      if (v.reach === 'out' && q.far !== '1') return false;
      if (q.maxDist && Number(q.maxDist) < 15 && v.dist > Number(q.maxDist)) return false;
      return true;
    });
    const sorters = { rec: (a, b) => b.v.rating * Math.log(b.v.reviews + 1) - a.v.rating * Math.log(a.v.reviews + 1), price: (a, b) => a.v.rate - b.v.rate, dist: (a, b) => a.v.dist - b.v.dist, rating: (a, b) => b.v.rating - a.v.rating };
    const sort = sorters[q.sort] ? q.sort : 'rec';
    list.sort(sorters[sort]);
    if (sort === 'rec') { // najwyżej 2 profile „Promowane”, rotacja: najpierw te z najmniejszą liczbą wyświetleń
      // wyróżnienie działa w całym zasięgu wykonawcy: pokazujemy je klientom, pod których adres dojeżdża
      const boosts = activeBoosts();
      const promo = list.map(x => ({ x, b: boosts.find(b => b.provider_id === x.p.user_id) })).filter(o => o.b && o.x.v.reach !== 'out')
        .sort((a, b) => a.b.views - b.b.views).slice(0, config.maxPromotedInResults);
      promo.forEach(o => { o.x.v.promoted = true; db.run('UPDATE boosts SET views = views + 1 WHERE id = ?', o.b.id); });
      list = promo.map(o => o.x).concat(list.filter(x => !promo.some(o => o.x === x)));
    }
    return { results: list.map(x => x.v) };
  }

  // ---------- widok rezerwacji ----------
  function bookingView(b, viewer, now = localNow()) {
    const p = providerById(b.provider_id); const client = db.get('SELECT id, name, noshow_count, late_cancel_count FROM users WHERE id = ?', b.client_id);
    const isProvider = viewer && viewer.id === b.provider_id;
    const report = db.get("SELECT id, category, want, status, created_at, answered_at FROM reports WHERE booking_id = ? ORDER BY created_at DESC", b.id);
    const review = db.get('SELECT id, stars FROM reviews WHERE booking_id = ?', b.id);
    const out = {
      id: b.id, status: b.status, service: b.service, serviceName: SERVICE_NAMES[b.service], startsAt: b.starts_at, endsAt: addHours(b.starts_at, b.hours), hours: b.hours,
      m2: b.m2, rooms: b.rooms, baths: b.baths, extras: json(b.extras, []), freq: b.freq, totalZl: b.price_gr / 100, travelFeeZl: b.travel_fee_gr / 100, payMethod: b.pay_method,
      address: b.address_text, addressId: b.address_id, lat: b.lat, lng: b.lng, onsite: b.onsite_name ? { name: b.onsite_name, phone: b.onsite_phone } : null,
      entry: b.entry, pets: b.pets, note: b.note, viaPromo: !!b.via_promo,
      provider: { id: p.slug, name: p.display_name, ini: p.initials, tone: p.tone, base: { lat: p.base_lat, lng: p.base_lng } },
      report: report ? { id: report.id, category: report.category, want: report.want, status: report.status, at: report.created_at, answeredAt: report.answered_at } : null,
      rated: review ? review.stars : 0
    };
    // Kod do drzwi wykonawca widzi dopiero 2 godziny przed wizytą.
    if (!isProvider || hoursBetween(now, b.starts_at) <= 2) out.doorCode = b.door_code;
    if (isProvider || (viewer && viewer.role === 'admin')) out.client = { id: client.id, name: firstName(client.name), reliability: reliability(client) };
    return out;
  }
  const reliability = u => u.noshow_count >= 2 ? 'niska' : u.noshow_count === 1 || u.late_cancel_count >= 2 ? 'średnia' : 'wysoka';

  return { providerBySlug, providerById, mustProvider, slotsFor, nextSlot, activeBoosts, creditGr, boostQuote, countNear, demandIn, baseLabel, providerView, search, bookingView, ACTIVE };
}

const firstName = name => String(name || 'Klient').split(' ')[0];

module.exports = { createDomain, firstName };
