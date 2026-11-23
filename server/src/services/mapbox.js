'use strict';
// Integracja z Mapbox: geokodowanie adresów (Search/Geocoding v6), czasy dojazdu (Matrix) i trasy (Directions).
// Każde wywołanie ma limit czasu i pamięć podręczną w bazie. Gdy Mapbox nie jest skonfigurowany albo nie odpowiada,
// funkcje zwracają null, a reszta serwera używa przybliżenia (odległość w linii prostej × 1,3).
const { config } = require('../config');
const geo = require('../geo');

// Prostokąt obejmujący Warszawę z okolicą: zawęża wyniki geokodowania.
const BBOX = '20.82,52.08,21.30,52.38';
const PROXIMITY = '21.0122,52.2297';
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function createMapbox(db) {
  const enabled = () => !!config.mapboxServerToken;
  const stats = { calls: 0, cacheHits: 0, failures: 0 };

  function cacheGet(key) {
    const row = db.get('SELECT value, expires_at FROM geo_cache WHERE key = ?', key);
    if (!row || row.expires_at < new Date().toISOString()) return undefined;
    stats.cacheHits++; return JSON.parse(row.value);
  }
  function cachePut(key, value, ttlSec) {
    db.run('INSERT INTO geo_cache (key, value, expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at', key, JSON.stringify(value), new Date(Date.now() + ttlSec * 1000).toISOString());
  }

  async function call(path, params) {
    const url = new URL(config.mapboxApi + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('access_token', config.mapboxServerToken);
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), config.mapboxTimeoutMs);
    stats.calls++;
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'lsni-server/0.1' } });
      if (!res.ok) throw new Error(`Mapbox ${path.split('/')[1]}: HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }
  // Wywołanie z pamięcią podręczną; błąd = null (wtedy działa przybliżenie)
  async function cached(key, ttlSec, fn) {
    if (!enabled()) return null;
    const hit = cacheGet(key); if (hit !== undefined) return hit;
    try { const value = await fn(); if (value !== null) cachePut(key, value, ttlSec); return value; }
    catch (e) { stats.failures++; if (!process.env.QUIET_SMS) console.warn('[mapbox]', e.message); return null; }
  }

  // ---------- geokodowanie ----------
  const toAddress = f => {
    const [lng, lat] = f.geometry.coordinates; const p = f.properties || {};
    return { street: p.name || p.full_address || '', full: p.full_address || p.place_formatted || '', lat: round(lat, 6), lng: round(lng, 6), district: geo.districtAt(lat, lng), inArea: geo.inWarsaw(lat, lng) };
  };
  async function search(q) {
    const text = String(q || '').trim(); if (text.length < 3) return null;
    return cached(`fwd:${text.toLowerCase()}`, 30 * 86400, async () => {
      const d = await call('/search/geocode/v6/forward', { q: text, country: 'pl', language: 'pl', limit: '6', types: 'address,street', bbox: BBOX, proximity: PROXIMITY, autocomplete: 'true' });
      return (d.features || []).map(toAddress);
    });
  }
  async function reverse(lat, lng) {
    return cached(`rev:${round(lat)},${round(lng)}`, 30 * 86400, async () => {
      const d = await call('/search/geocode/v6/reverse', { longitude: String(lng), latitude: String(lat), types: 'address', language: 'pl', limit: '1' });
      const f = (d.features || [])[0]; return f ? toAddress(f) : null;
    });
  }

  // ---------- czasy dojazdu: jedno źródło do wielu celów (Matrix, maks. 25 punktów) ----------
  // Zwraca Map(id → { km, min }) albo null.
  async function matrix(origins, dest) {
    const list = origins.slice(0, 24);
    if (!list.length) return new Map();
    const coords = list.map(o => `${round(o.lng)},${round(o.lat)}`).concat(`${round(dest.lng)},${round(dest.lat)}`).join(';');
    const key = `mtx:${coords}`;
    const out = await cached(key, 600, async () => {
      const d = await call(`/directions-matrix/v1/mapbox/driving/${coords}`, { sources: list.map((_, i) => i).join(';'), destinations: String(list.length), annotations: 'distance,duration' });
      if (d.code !== 'Ok') throw new Error('Matrix: ' + d.code);
      return list.map((_, i) => ({ km: d.distances[i][0] == null ? null : round(d.distances[i][0] / 1000, 1), min: d.durations[i][0] == null ? null : Math.round(d.durations[i][0] / 60) }));
    });
    if (!out) return null;
    return new Map(list.map((o, i) => [o.id, out[i]]).filter(([, v]) => v.km !== null));
  }

  // ---------- trasy (Directions, do 25 punktów po drodze) ----------
  async function route(points) {
    if (points.length < 2) return null;
    const coords = points.slice(0, 25).map(p => `${round(p.lng, 5)},${round(p.lat, 5)}`).join(';');
    return cached(`dir:${coords}`, 3600, async () => {
      const d = await call(`/directions/v5/mapbox/driving/${coords}`, { geometries: 'geojson', overview: 'full', language: 'pl' });
      const r = (d.routes || [])[0]; if (!r) return null;
      return { coordinates: r.geometry.coordinates, km: round(r.distance / 1000, 1), min: Math.round(r.duration / 60), legs: r.legs.map(l => ({ km: round(l.distance / 1000, 1), min: Math.round(l.duration / 60) })) };
    });
  }

  return { enabled, search, reverse, matrix, route, stats };
}

// Zasięg na podstawie prawdziwej odległości drogowej (z Matrix) albo przybliżenia.
function reachWith(provider, point, road) {
  if (!road) return geo.reach(provider, point);
  const r = provider.radius_km;
  const status = road.km <= r ? 'in' : (provider.fee_gr > 0 && road.km <= r + 5) ? 'fee' : 'out';
  return { km: road.km, eta: road.min, reach: status, feeGr: status === 'fee' ? provider.fee_gr : 0, source: 'mapbox' };
}

module.exports = { createMapbox, reachWith };
