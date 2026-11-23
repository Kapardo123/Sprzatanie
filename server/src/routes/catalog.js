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
  // Punkt odniesienia: zapisany adres zalogowanego, współrzędne z zapytania albo centrum Warszawy.
  function pointFrom(query, user) {
    if (query.addressId && user) {
      const a = db.get('SELECT lat, lng FROM addresses WHERE id = ? AND user_id = ?', query.addressId, user.id);
      if (a) return a;
    }
    if (query.lat && query.lng) return { lat: v.num(query.lat, 'lat', { min: 49, max: 55 }), lng: v.num(query.lng, 'lng', { min: 14, max: 25 }) };
    return { lat: 52.2297, lng: 21.0122 };
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
  r.get('/api/meta', () => ({ services: SERVICES.map(id => ({ id, name: SERVICE_NAMES[id] })), extras: Object.entries(EXTRAS).map(([id, h]) => ({ id, hours: h })) }));

  // ---------- geografia (bez dzielnic i miast: tylko punkty, odległości i zasięgi) ----------
  const withPoland = x => Object.assign(x, { inArea: x.inArea !== undefined ? x.inArea : geo.inPoland(x.lat, x.lng) });
  // Wyszukiwanie prawdziwych adresów i miejscowości w całej Polsce (Mapbox), bez Mapboxa: miejscowości i lokalny słownik ulic.
  // near=lat,lng ustawia wyniki najbliżej użytkownika (np. „Długa” w Gdańsku, gdy klient jest w Gdańsku).
  r.get('/api/geo/search', async ({ query }) => {
    const q = v.str(query.q, 'adres', { min: 2, max: 120 });
    const near = String(query.near || '').split(',').map(Number);
    const prox = near.length === 2 && near.every(Number.isFinite) && geo.inPoland(near[0], near[1]) ? { lat: near[0], lng: near[1] } : null;
    const places = query.types === 'place';
    const found = await mapbox.search(q, prox, places);
    return { source: found ? 'mapbox' : 'local', results: (found || geo.searchLocal(q, places)).filter(x => x.street).map(withPoland) };
  });
  // Miejscowość po nazwie: Mapbox (tylko miejscowości w Polsce), a bez niego lista miejscowości. Bez rozróżniania polskich znaków.
  async function resolvePlace(name) {
    const found = await mapbox.search(name, null, true);
    const hit = found && found.filter(x => x.inArea !== false)[0];
    if (hit) return { name: hit.street, lat: hit.lat, lng: hit.lng, full: hit.full };
    const pl = geo.findPlace(name); return pl ? { name: pl.name, lat: pl.lat, lng: pl.lng, full: `${pl.name}, woj. ${pl.region}` } : null;
  }
  r.get('/api/geo/place', async ({ query }) => {
    const name = v.str(query.q, 'miejscowość', { min: 2, max: 80 });
    return (await resolvePlace(name)) || notFound('Nie znamy takiej miejscowości w Polsce');
  });
  // Adres pod punktem i to, co dzieje się wokół: ilu wykonawców tu dojeżdża, średnia stawka, wolne terminy dziś.
  r.get('/api/geo/reverse', async ({ query }) => {
    const lat = v.num(query.lat, 'lat', { min: 49, max: 55 }), lng = v.num(query.lng, 'lng', { min: 14, max: 25 });
    const found = await mapbox.reverse(lat, lng); const local = geo.reverse(lat, lng);
    const out = found ? Object.assign({}, local, { street: found.street, full: found.full, city: found.city || local.city, postcode: found.postcode, inArea: found.inArea, source: 'mapbox' }) : Object.assign(local, { source: 'local' });
    out.stats = pointStats({ lat, lng });
    return out;
  });
  function pointStats(pt) {
    const today = localNow().slice(0, 10);
    const sv = db.all('SELECT * FROM providers WHERE published = 1').filter(p => geo.reach(p, pt).reach === 'in'); const hourly = sv.filter(p => !p.fixed_price);
    return { providers: sv.length, avgRate: hourly.length ? Math.round(hourly.reduce((s, p) => s + p.rate_gr, 0) / hourly.length / 100) : 0,
      freeToday: sv.reduce((s, p) => s + domain.slotsFor(p, today).length, 0) };
  }
  // Gdzie szukają klienci: wyszukiwania z ostatnich 30 dni w promieniu km, zgrupowane w siatkę ok. 1 km (mapa cieplna).
  // Bez danych osobowych: zapisujemy tylko zaokrąglony punkt i czas wyszukiwania.
  r.get('/api/geo/demand', ({ query }) => {
    const lat = v.num(query.lat, 'lat', { min: 49, max: 55 }), lng = v.num(query.lng, 'lng', { min: 14, max: 25 }), km = v.num(query.km ?? 25, 'promień', { min: 1, max: 80 });
    const since = new Date(Date.now() - 30 * 86400e3).toISOString(); const c = { lat, lng }; const cells = new Map();
    db.all('SELECT lat, lng FROM search_log WHERE created_at > ? AND lat IS NOT NULL', since).filter(x => geo.haversineKm(c, x) <= km).forEach(x => {
      const k = `${Math.round(x.lat * 100) / 100},${Math.round(x.lng * 100) / 100}`; cells.set(k, (cells.get(k) || 0) + 1);
    });
    return { demandPerDay: domain.demandIn(lat, lng, km * geo.ROAD), points: [...cells].map(([k, n]) => { const [a, b] = k.split(',').map(Number); return { lat: a, lng: b, n }; }) };
  });
  // Trasa między dwoma punktami (dla zalogowanych, żeby nikt nie zużywał limitów Mapboxa z zewnątrz).
  r.get('/api/geo/route', { auth: 'user' }, async ({ query }) => {
    const [a, b] = ['from', 'to'].map(k => String(query[k] || '').split(',').map(Number));
    if (a.length !== 2 || b.length !== 2 || [...a, ...b].some(n => !Number.isFinite(n))) v.str('', 'from/to (lat,lng)');
    const rt = await mapbox.route([{ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }]);
    const km = Math.round(geo.roadKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * 10) / 10;
    return rt ? Object.assign(rt, { source: 'mapbox' }) : { coordinates: [[a[1], a[0]], [b[1], b[0]]], km, min: geo.driveMin(km), source: 'estimate' };
  });
  // ---------- wykonawcy ----------
  // city=Kraków: wykonawcy, którzy dojeżdżają do tej miejscowości (odległość od jej centrum), zamiast od adresu klienta.
  r.get('/api/providers', async ({ query, user }) => {
    let place = null;
    if (query.city) { place = await resolvePlace(v.str(query.city, 'miejscowość', { min: 2, max: 80 })); if (!place) notFound('Nie znamy takiej miejscowości w Polsce'); }
    const point = place ? { lat: place.lat, lng: place.lng } : pointFrom(query, user);
    if (query.service && !SERVICES.includes(query.service)) v.oneOf(query.service, 'usługa', SERVICES);
    const roads = await roadsTo(point, db.all('SELECT * FROM providers WHERE published = 1 AND online = 1'));
    const res = domain.search(query, point, roads);
    return Object.assign(res, { point, place, inArea: geo.inPoland(point.lat, point.lng) });
  });
  r.get('/api/providers/:id', async ({ params, query, user }) => {
    const p = domain.mustProvider(params.id); if (!p.published) notFound('Ten profil nie jest już dostępny');
    const point = pointFrom(query, user);
    if (query.src === 'promo') { const b = domain.activeBoosts().find(x => x.provider_id === p.user_id); if (b) db.run('UPDATE boosts SET opens = opens + 1 WHERE id = ?', b.id); }
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
    const q = quote(p, normalizeScope(body, p), rc.feeGr);
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
