'use strict';
// Geografia Polski na prawdziwych współrzędnych (WGS84).
// Obszar (do popytu, wyróżnień i statystyk) to:
//   - dzielnica w dużym mieście (Warszawa, Kraków, Łódź, Wrocław, Poznań), klucz "Kraków/Krowodrza",
//   - miasto, klucz "Gdańsk",
//   - okolice miasta dla miejscowości poza listą miast, klucz "Toruń/okolice".
// Odległość drogowa bez Mapbox = odległość w linii prostej × 1,3 (z Mapbox: prawdziwa, patrz services/mapbox.js).
const { CITIES, CITY_DISTRICTS, POLAND } = require('./geo-pl');

const toRad = d => d * Math.PI / 180;
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const roadKm = (a, b) => haversineKm(a, b) * 1.3;
const driveMin = km => Math.round(km / 22 * 60 + 4);

// Promień miasta rośnie z liczbą mieszkańców (Warszawa ok. 21 km, miasto 60 tys. ok. 7 km).
const cityRadius = pop => Math.max(4, Math.min(22, 3.5 + 0.42 * Math.sqrt(pop)));
// Popyt startowy (wyszukiwania dziennie) z liczby mieszkańców; górny limit, żeby duże miasta bez podziału na dzielnice nie były drogie.
const demandFromPop = pop => Math.max(3, Math.min(55, Math.round(pop * 0.21)));

// ---------- katalog obszarów ----------
const CITY_LIST = CITIES.map(([name, lat, lng, pop, region]) => ({ name, lat, lng, pop, region, radius: cityRadius(pop), districts: CITY_DISTRICTS[name] || null }));
const AREAS = new Map();
for (const c of CITY_LIST) {
  if (c.districts) c.districts.forEach(([n, lat, lng, pop]) => AREAS.set(`${c.name}/${n}`, { key: `${c.name}/${n}`, name: n, city: c.name, region: c.region, kind: 'district', lat, lng, pop }));
  else AREAS.set(c.name, { key: c.name, name: c.name, city: c.name, region: c.region, kind: 'city', lat: c.lat, lng: c.lng, pop: c.pop });
  AREAS.set(`${c.name}/okolice`, { key: `${c.name}/okolice`, name: `${c.name} (okolice)`, city: c.name, region: c.region, kind: 'outskirts', lat: c.lat, lng: c.lng, pop: Math.round(c.pop * 0.25) });
}
const areaByKey = key => AREAS.get(String(key || '')) || null;
const AREA_LIST = [...AREAS.values()];

function inPoland(lat, lng) {
  let inside = false;
  for (let i = 0, j = POLAND.length - 1; i < POLAND.length; j = i++) {
    const [yi, xi] = POLAND[i], [yj, xj] = POLAND[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Do którego obszaru należy punkt. Miasto wybieramy po stosunku odległości do promienia,
// więc np. centrum Pruszkowa należy do Pruszkowa, a Ursus do Warszawy.
function areaAt(lat, lng) {
  const p = { lat, lng };
  let best = null, score = Infinity, nearest = null, nd = Infinity;
  for (const c of CITY_LIST) {
    const d = haversineKm(p, c); const s = d / c.radius;
    if (s < score) { score = s; best = c; }
    if (d < nd) { nd = d; nearest = c; }
  }
  if (best && score <= 1) {
    if (!best.districts) return AREAS.get(best.name);
    let dn = null, dd = Infinity;
    for (const [n, la, ln] of best.districts) { const d = haversineKm(p, { lat: la, lng: ln }); if (d < dd) { dd = d; dn = n; } }
    return AREAS.get(`${best.name}/${dn}`);
  }
  return AREAS.get(`${nearest.name}/okolice`);
}
const areaLabel = a => a.kind === 'district' ? `${a.name}, ${a.city}` : a.name;

// Obszary w pobliżu punktu (bez „okolic”: nie mają kształtu i nie da się ich wyróżnić).
function areasNear(lat, lng, km) {
  const p = { lat, lng };
  return AREA_LIST.filter(a => a.kind !== 'outskirts' && haversineKm(p, a) <= km);
}
const servesArea = (provider, area) => roadKm({ lat: provider.base_lat, lng: provider.base_lng }, area) <= provider.radius_km;

// Czy wykonawca dojeżdża pod punkt: w zasięgu, do 5 km dalej z dopłatą, albo wcale.
function reach(provider, point) {
  const km = roadKm({ lat: provider.base_lat, lng: provider.base_lng }, point);
  const r = provider.radius_km;
  const status = km <= r ? 'in' : (provider.fee_gr > 0 && km <= r + 5) ? 'fee' : 'out';
  return { km: Math.round(km * 10) / 10, eta: driveMin(km), reach: status, feeGr: status === 'fee' ? provider.fee_gr : 0 };
}

// ---------- kształty obszarów (GeoJSON) ----------
// Dzielnice: komórki Woronoja wokół środków dzielnic przycięte do koła miasta. Miasta bez dzielnic: koło.
const K = Math.cos(52 * Math.PI / 180);
function circleRing(lat, lng, km, n = 48) {
  const out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([lng + km / (111.32 * Math.cos(toRad(lat))) * Math.cos(a), lat + km / 110.57 * Math.sin(a)]); }
  return out;
}
function clipHalf(poly, a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const f = q => (q[0] - mx) * nx + (q[1] - my) * ny; const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
    if (fa <= 0) out.push(A);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  }
  return out;
}
const SHAPES = new Map();
function areaShape(a) {
  if (SHAPES.has(a.key)) return SHAPES.get(a.key);
  const city = CITY_LIST.find(c => c.name === a.city);
  let ring;
  if (a.kind === 'district') {
    const P = ([lng, lat]) => [lng * K, lat];
    let poly = circleRing(city.lat, city.lng, city.radius, 64).map(P);
    city.districts.forEach(([n, la, ln]) => { if (n !== a.name) poly = clipHalf(poly, P([a.lng, a.lat]), P([ln, la])); });
    ring = poly.map(([x, y]) => [x / K, y]);
  } else ring = circleRing(a.lat, a.lng, city.radius);
  ring = ring.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]); ring.push(ring[0]);
  const feature = { type: 'Feature', properties: { key: a.key, name: a.name, city: a.city, kind: a.kind }, geometry: { type: 'Polygon', coordinates: [ring] } };
  SHAPES.set(a.key, feature); return feature;
}

// ---------- adresy bez Mapbox ----------
// Słownik ulic (Warszawa) i miast do podpowiedzi oraz adres z punktu: najbliższe miasto lub dzielnica.
const STREETS = [
  ['ul. Puławska', 52.1950, 21.0240], ['ul. Odyńca', 52.1925, 21.0130], ['ul. Marszałkowska', 52.2290, 21.0110], ['ul. Nowy Świat', 52.2330, 21.0190],
  ['ul. Grójecka', 52.2140, 20.9800], ['ul. Racławicka', 52.2000, 21.0050], ['ul. Wołoska', 52.1880, 21.0000], ['al. KEN', 52.1450, 21.0450],
  ['ul. Targowa', 52.2550, 21.0360], ['ul. Grochowska', 52.2460, 21.0950], ['ul. Słowackiego', 52.2680, 20.9850], ['ul. Górczewska', 52.2400, 20.9300],
  ['ul. Floriańska (Kraków)', 50.0640, 19.9400], ['ul. Długa (Gdańsk)', 54.3490, 18.6510], ['ul. Piotrkowska (Łódź)', 51.7590, 19.4580],
  ['ul. Święty Marcin (Poznań)', 52.4070, 16.9230], ['ul. Świdnicka (Wrocław)', 51.1060, 17.0310]
];
function reverse(lat, lng) {
  const a = areaAt(lat, lng); const inArea = inPoland(lat, lng);
  return { street: areaLabel(a), district: a.name, area: a, inArea };
}
function searchLocal(q) {
  const s = String(q || '').trim().toLowerCase(); if (s.length < 2) return [];
  const streets = STREETS.filter(x => x[0].toLowerCase().includes(s)).map(x => ({ street: x[0], lat: x[1], lng: x[2] }));
  const cities = CITY_LIST.filter(c => c.name.toLowerCase().startsWith(s)).map(c => ({ street: c.name, lat: c.lat, lng: c.lng }));
  return streets.concat(cities).slice(0, 8).map(x => { const a = areaAt(x.lat, x.lng); return Object.assign(x, { full: `${areaLabel(a)}, woj. ${a.region}`, district: a.name, area: a, inArea: true }); });
}

module.exports = { CITY_LIST, AREAS, AREA_LIST, areaByKey, areaAt, areaLabel, areasNear, areaShape, servesArea, inPoland, haversineKm, roadKm, driveMin, reach, reverse, searchLocal, demandFromPop, cityRadius };
