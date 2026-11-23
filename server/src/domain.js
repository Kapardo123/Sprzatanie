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

  // ---------- popyt: wyszukiwania z ostatnich 7 dni, nie mniej niż wartość startowa ----------
  function demand(district) {
    const since = new Date(Date.now() - 7 * 86400e3).toISOString();
    const n = db.get('SELECT COUNT(*) c FROM search_log WHERE district = ? AND created_at > ?', district, since).c;
    return Math.max(geo.BASE_DEMAND[district] || 5, Math.round(n / 7));
  }

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
  function boostQuote(p, days) {
    return Object.keys(geo.DISTRICTS).filter(n => geo.servesDistrict(p, n)).map(n => {
      const d = demand(n);
      return { district: n, demand: d, searchers: d * 7, priceZl: boostPriceGr(d, days) / 100, guaranteedViews: boostGuaranteedViews(d, days), competitors: countServing(n) };
    });
  }
  const countServing = n => db.all('SELECT * FROM providers WHERE published = 1').filter(x => geo.servesDistrict(x, n)).length;

  // ---------- widok wykonawcy dla klienta ----------
  function providerView(p, point, { promoted = false, full = false, road = null } = {}) {
    const r = point ? reachWith(p, point, road) : null; const ns = nextSlot(p);
    const out = {
      id: p.slug, name: p.display_name, ini: p.initials, tone: p.tone, kind: p.kind, area: geo.districtAt(p.base_lat, p.base_lng),
      tagline: p.tagline, services: json(p.services, []), langs: json(p.langs, []), rate: p.rate_gr / 100, minH: p.min_hours,
      fixed: !!p.fixed_price, perWindow: p.per_window_gr ? p.per_window_gr / 100 : 0, since: p.since, super: !!p.super,
      verified: p.id_status === 'verified', insured: !!p.insured, invoice: !!p.invoice, supplies: !!p.supplies, eco: !!p.eco, pets: !!p.pets,
      rating: p.rating_count ? Math.round(p.rating_sum / p.rating_count * 100) / 100 : 0, reviews: p.rating_count, jobs: p.jobs_done,
      response: `${p.response_min} min`, base: { lat: p.base_lat, lng: p.base_lng }, radiusKm: p.radius_km, fee: p.fee_gr / 100,
      nextSlot: ns ? ns.label : 'Brak wolnych terminów', todayFree: !!(ns && ns.today), promoted
    };
    if (r) Object.assign(out, { dist: r.km, eta: r.eta, reach: r.reach, distSource: r.source || 'estimate' });
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
    const district = q.district && geo.DISTRICTS[q.district] ? q.district : null;
    const where = district || geo.districtAt(point.lat, point.lng);
    db.run('INSERT INTO search_log (district, created_at) VALUES (?, ?)', where, new Date().toISOString());
    const text = String(q.q || '').trim().toLowerCase();
    let list = db.all('SELECT * FROM providers WHERE published = 1 AND online = 1').map(p => ({ p, v: providerView(p, point, { road: roads && roads.get(p.user_id) }) })).filter(({ p, v }) => {
      if (q.service && !v.services.includes(q.service)) return false;
      if (text && !(v.name + ' ' + v.tagline + ' ' + v.area + ' ' + v.services.map(s => SERVICE_NAMES[s]).join(' ')).toLowerCase().includes(text)) return false;
      if (q.maxPrice && !v.fixed && v.rate > Number(q.maxPrice)) return false;
      if (q.minRating && v.rating < Number(q.minRating)) return false;
      for (const k of ['verified', 'insured', 'supplies', 'eco', 'pets', 'invoice']) if (q[k] === '1' && !v[k]) return false;
      if (q.today === '1' && !v.todayFree) return false;
      if (district) return geo.servesDistrict(p, district);
      if (v.reach === 'out' && q.far !== '1') return false;
      if (q.maxDist && Number(q.maxDist) < 15 && v.dist > Number(q.maxDist)) return false;
      return true;
    });
    const sorters = { rec: (a, b) => b.v.rating * Math.log(b.v.reviews + 1) - a.v.rating * Math.log(a.v.reviews + 1), price: (a, b) => a.v.rate - b.v.rate, dist: (a, b) => a.v.dist - b.v.dist, rating: (a, b) => b.v.rating - a.v.rating };
    const sort = sorters[q.sort] ? q.sort : 'rec';
    list.sort(sorters[sort]);
    if (sort === 'rec') { // najwyżej 2 profile „Promowane”, rotacja: najpierw te z najmniejszą liczbą wyświetleń
      const boosts = activeBoosts().filter(b => b.district === where);
      const promo = list.map(x => ({ x, b: boosts.find(b => b.provider_id === x.p.user_id) })).filter(o => o.b && o.x.v.reach !== 'out')
        .sort((a, b) => a.b.views - b.b.views).slice(0, config.maxPromotedInResults);
      promo.forEach(o => { o.x.v.promoted = true; db.run('UPDATE boosts SET views = views + 1 WHERE id = ?', o.b.id); });
      list = promo.map(o => o.x).concat(list.filter(x => !promo.some(o => o.x === x)));
    }
    return { district: where, results: list.map(x => x.v) };
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

  return { providerBySlug, providerById, mustProvider, demand, slotsFor, nextSlot, activeBoosts, creditGr, boostQuote, countServing, providerView, search, bookingView, ACTIVE };
}

const firstName = name => String(name || 'Klient').split(' ')[0];

module.exports = { createDomain, firstName };
