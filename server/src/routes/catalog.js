'use strict';
const fs = require('node:fs');
const path = require('node:path');
const geo = require('../geo');
const { reachWith } = require('../services/mapbox');
const { quote, SERVICES, EXTRAS, SERVICE_NAMES } = require('../pricing');
const { v, notFound, localNow, addDays, json } = require('../util');

module.exports = function catalogRoutes(r, { db, domain, mapbox }) {
  const { config } = require('../config');
  // Prawdziwe odległości drogowe od punktu do wykonawców, którzy w linii prostej mogą dojeżdżać (z zapasem).
  async function roadsTo(point, providers) {
    if (!mapbox.enabled()) return null;
    const near = providers.filter(p => geo.haversineKm({ lat: p.base_lat, lng: p.base_lng }, point) <= p.radius_km + 6)
      .map(p => ({ id: p.user_id, lat: p.base_lat, lng: p.base_lng }));
    return mapbox.matrix(near, point);
  }
  // Punkt odniesienia: zapisany adres zalogowanego, współrzędne z zapytania albo centrum Mokotowa.
  function pointFrom(query, user) {
    if (query.addressId && user) {
      const a = db.get('SELECT lat, lng FROM addresses WHERE id = ? AND user_id = ?', query.addressId, user.id);
      if (a) return a;
    }
    if (query.lat && query.lng) return { lat: v.num(query.lat, 'lat', { min: 49, max: 55 }), lng: v.num(query.lng, 'lng', { min: 14, max: 25 }) };
    return { lat: geo.DISTRICTS['Mokotów'][0], lng: geo.DISTRICTS['Mokotów'][1] };
  }

  r.get('/api/health', () => ({ ok: true, time: localNow(), version: '0.1.0' }));
  // Konfiguracja map dla aplikacji: token publiczny Mapbox i style. Bez tokenu aplikacja używa schematycznej mapy.
  const fs = require('node:fs'); const pathMod = require('node:path');
  const localGl = fs.existsSync(pathMod.join(__dirname, '..', '..', 'node_modules', 'mapbox-gl', 'dist', 'mapbox-gl.js'));
  r.get('/api/config', () => ({
    mapbox: config.mapboxToken ? { token: config.mapboxToken, styleLight: config.mapboxStyleLight, styleDark: config.mapboxStyleDark,
      js: localGl ? '/vendor/mapbox-gl.js' : 'https://api.mapbox.com/mapbox-gl-js/v3.34.2/mapbox-gl.js',
      css: localGl ? '/vendor/mapbox-gl.css' : 'https://api.mapbox.com/mapbox-gl-js/v3.34.2/mapbox-gl.css' } : null
  }));
  r.get('/api/meta', () => ({ services: SERVICES.map(id => ({ id, name: SERVICE_NAMES[id] })), extras: Object.entries(EXTRAS).map(([id, h]) => ({ id, hours: h })), districts: Object.keys(geo.DISTRICTS) }));

  // ---------- geografia ----------
  r.get('/api/geo/streets', ({ query }) => geo.searchStreets(query.q));
  // Wyszukiwanie prawdziwych adresów (Mapbox), a bez Mapboxa: lokalny słownik ulic.
  r.get('/api/geo/search', async ({ query, ip }) => {
    const q = v.str(query.q, 'adres', { min: 2, max: 120 });
    const found = await mapbox.search(q);
    return { source: found ? 'mapbox' : 'local', results: (found || geo.searchStreets(q).map(x => Object.assign(x, { full: `${x.district}, Warszawa`, inArea: true }))).filter(x => x.street) };
  });
  r.get('/api/geo/reverse', async ({ query }) => {
    const lat = v.num(query.lat, 'lat', { min: 49, max: 55 }), lng = v.num(query.lng, 'lng', { min: 14, max: 25 });
    const found = await mapbox.reverse(lat, lng); const local = geo.reverse(lat, lng);
    return found ? Object.assign({}, local, { street: found.street, full: found.full, source: 'mapbox' }) : Object.assign(local, { source: 'local' });
  });
  r.get('/api/geo/districts/shapes', ({ res }) => geo.districtShapes());
  // Trasa między dwoma punktami (dla zalogowanych, żeby nikt nie zużywał limitów Mapboxa z zewnątrz).
  r.get('/api/geo/route', { auth: 'user' }, async ({ query }) => {
    const [a, b] = ['from', 'to'].map(k => String(query[k] || '').split(',').map(Number));
    if (a.length !== 2 || b.length !== 2 || [...a, ...b].some(n => !Number.isFinite(n))) v.str('', 'from/to (lat,lng)');
    const rt = await mapbox.route([{ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }]);
    const km = Math.round(geo.roadKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 10) / 10;
    return rt ? Object.assign(rt, { source: 'mapbox' }) : { coordinates: [[a[1], a[0]], [b[1], b[0]]], km, min: geo.driveMin(km), source: 'estimate' };
  });
  r.get('/api/geo/districts', () => {
    const today = localNow().slice(0, 10);
    const providers = db.all('SELECT * FROM providers WHERE published = 1');
    const stats = Object.keys(geo.DISTRICTS).map(n => {
      const sv = providers.filter(p => geo.servesDistrict(p, n)); const hourly = sv.filter(p => !p.fixed_price);
      return { district: n, center: geo.DISTRICTS[n], population: geo.POPULATION[n], demand: domain.demand(n), providers: sv.length,
        avgRate: hourly.length ? Math.round(hourly.reduce((a, p) => a + p.rate_gr, 0) / hourly.length / 100) : 0,
        freeToday: sv.reduce((a, p) => a + domain.slotsFor(p, today).length, 0) };
    });
    return stats;
  });

  // ---------- wykonawcy ----------
  r.get('/api/providers', async ({ query, user }) => {
    const point = pointFrom(query, user);
    if (query.service && !SERVICES.includes(query.service)) v.oneOf(query.service, 'usługa', SERVICES);
    const roads = await roadsTo(point, db.all('SELECT * FROM providers WHERE published = 1 AND online = 1'));
    const res = domain.search(query, point, roads);
    return Object.assign(res, { point, inArea: geo.inWarsaw(point.lat, point.lng) });
  });
  r.get('/api/providers/:id', async ({ params, query, user }) => {
    const p = domain.mustProvider(params.id); if (!p.published) notFound('Ten profil nie jest już dostępny');
    const point = pointFrom(query, user);
    if (query.src === 'promo') { const b = domain.activeBoosts().find(x => x.provider_id === p.user_id && x.district === geo.districtAt(point.lat, point.lng)); if (b) db.run('UPDATE boosts SET opens = opens + 1 WHERE id = ?', b.id); }
    const roads = await roadsTo(point, [p]);
    return domain.providerView(p, point, { full: true, road: roads && roads.get(p.user_id) });
  });
  r.get('/api/providers/:id/slots', ({ params, query }) => {
    const p = domain.mustProvider(params.id);
    if (query.date) return { date: query.date, slots: domain.slotsFor(p, v.date(query.date, 'data')) };
    return Array.from({ length: 14 }, (_, i) => { const date = addDays(localNow(), i).slice(0, 10); return { date, slots: domain.slotsFor(p, date) }; });
  });
  r.post('/api/quote', async ({ body, user }) => {
    const p = domain.mustProvider(v.str(body.provider, 'wykonawca'));
    const point = pointFrom(body, user); const roads = await roadsTo(point, [p]);
    const rc = reachWith(p, point, roads && roads.get(p.user_id));
    const q = quote(p, normalizeScope(body, p), rc.reach === 'fee' ? p.fee_gr : 0);
    return { reach: rc.reach, km: rc.km, eta: rc.eta, hours: q.hours, workZl: q.workGr / 100, discountZl: q.discountGr / 100, travelZl: q.travelGr / 100, totalZl: q.totalGr / 100 };
  });

  // ---------- zaproszenie od wykonawcy (strona dla klienta bez konta) ----------
  r.get('/api/invite/:code', ({ params }) => {
    const p = db.get('SELECT * FROM providers WHERE invite_code = ? AND published = 1', params.code) || notFound('Ten link zaproszenia jest nieaktualny');
    return { code: p.invite_code, provider: domain.providerView(p, null) };
  });

  // ---------- dokumenty prawne ----------
  const LEGAL = { regulamin: 'regulamin.md', prywatnosc: 'polityka-prywatnosci.md', ranking: 'zasady-rankingu.md' };
  r.get('/api/legal/:doc', ({ params }) => {
    const f = LEGAL[params.doc] || notFound('Nie ma takiego dokumentu');
    return { doc: params.doc, markdown: fs.readFileSync(path.join(__dirname, '..', '..', 'legal', f), 'utf8') };
  });

  return { pointFrom, roadsTo };
};

function normalizeScope(body, p) {
  const services = JSON.parse(p.services);
  const service = v.oneOf(body.service, 'usługa', services, { optional: true, fallback: services[0] });
  return {
    service,
    m2: v.num(body.m2 ?? 54, 'metraż', { min: 0, max: 1000, int: true }),
    rooms: v.num(body.rooms ?? 2, 'pokoje', { min: 0, max: 20, int: true }),
    baths: v.num(body.baths ?? 1, 'łazienki', { min: 0, max: 10, int: true }),
    extras: v.arr(body.extras, 'dodatki', { of: Object.keys(EXTRAS) }),
    freq: v.oneOf(body.freq, 'częstotliwość', ['once', 'week', 'biweek', 'month'], { optional: true, fallback: 'once' })
  };
}
module.exports.normalizeScope = normalizeScope;
