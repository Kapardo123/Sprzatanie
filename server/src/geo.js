'use strict';
// Geografia Polski na prawdziwych współrzędnych (WGS84).
// Obszar (do popytu, wyróżnień i statystyk) to całe miasto (bez podziału na dzielnice), klucz "Gdańsk",
// albo okolice najbliższego miasta dla miejscowości spoza listy, klucz "Toruń/okolice".
// Odległość drogowa bez Mapbox = odległość w linii prostej × 1,3 (z Mapbox: prawdziwa, patrz services/mapbox.js).
const { CITIES, POLAND } = require('./geo-pl');

const toRad = d => d * Math.PI / 180;
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const roadKm = (a, b) => haversineKm(a, b) * 1.3;
const driveMin = km => Math.round(km / 22 * 60 + 4);

// Promień miasta rośnie z liczbą mieszkańców (Warszawa 15 km, Kraków ok. 11 km, miasto 60 tys. ok. 5 km).
const cityRadius = pop => Math.max(4, Math.min(15, 3 + 0.3 * Math.sqrt(pop)));
// Popyt startowy (wyszukiwania dziennie) rośnie wolniej niż liczba mieszkańców:
// Warszawa ok. 95, Kraków ok. 62, Toruń ok. 31, miasto 60 tys. ok. 17.
const demandFromPop = pop => Math.max(3, Math.round(2.2 * Math.sqrt(pop)));

// ---------- katalog obszarów ----------
const CITY_LIST = CITIES.map(([name, lat, lng, pop, region]) => ({ name, lat, lng, pop, region, radius: cityRadius(pop) }));
const AREAS = new Map();
for (const c of CITY_LIST) {
  AREAS.set(c.name, { key: c.name, name: c.name, city: c.name, region: c.region, kind: 'city', lat: c.lat, lng: c.lng, pop: c.pop, radius: c.radius });
  AREAS.set(`${c.name}/okolice`, { key: `${c.name}/okolice`, name: `${c.name} (okolice)`, city: c.name, region: c.region, kind: 'outskirts', lat: c.lat, lng: c.lng, pop: Math.round(c.pop * 0.25), radius: 0 });
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
  if (best && score <= 1) return AREAS.get(best.name);
  return AREAS.get(`${nearest.name}/okolice`);
}
const areaLabel = a => a.name;

// Miasta, które zaczynają się w promieniu km od punktu (bez „okolic”: nie mają kształtu i nie da się ich wyróżnić).
function areasNear(lat, lng, km) {
  const p = { lat, lng };
  return AREA_LIST.filter(a => a.kind !== 'outskirts' && haversineKm(p, a) - a.radius <= km);
}
// Odległość drogowa (szacunek) od punktu do granicy miasta; 0, gdy punkt jest w mieście.
const kmToArea = (p, area) => Math.max(0, haversineKm(p, area) - area.radius) * 1.3;
// Wykonawca obsługuje miasto, jeśli jego zasięg dojazdu sięga przynajmniej części miasta.
const servesArea = (provider, area) => kmToArea({ lat: provider.base_lat, lng: provider.base_lng }, area) <= provider.radius_km;

// Czy wykonawca dojeżdża pod punkt: w zasięgu, do 5 km dalej z dopłatą, albo wcale.
function reach(provider, point) {
  const km = roadKm({ lat: provider.base_lat, lng: provider.base_lng }, point);
  const r = provider.radius_km;
  const status = km <= r ? 'in' : (provider.fee_gr > 0 && km <= r + 5) ? 'fee' : 'out';
  return { km: Math.round(km * 10) / 10, eta: driveMin(km), reach: status, feeGr: status === 'fee' ? provider.fee_gr : 0 };
}

// ---------- kształty obszarów (GeoJSON) ----------
// Miasto: koło o promieniu miasta (przybliżenie granic).
function circleRing(lat, lng, km, n = 48) {
  const out = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([lng + km / (111.32 * Math.cos(toRad(lat))) * Math.cos(a), lat + km / 110.57 * Math.sin(a)]); }
  return out;
}
const SHAPES = new Map();
function areaShape(a) {
  if (SHAPES.has(a.key)) return SHAPES.get(a.key);
  let ring = circleRing(a.lat, a.lng, a.radius, a.radius > 8 ? 64 : 40);
  ring = ring.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]); ring.push(ring[0]);
  const feature = { type: 'Feature', properties: { key: a.key, name: a.name, city: a.city, kind: a.kind, radiusKm: Math.round(a.radius * 10) / 10 }, geometry: { type: 'Polygon', coordinates: [ring] } };
  SHAPES.set(a.key, feature); return feature;
}

// ---------- adresy bez Mapbox ----------
// Słownik kilku ulic i miast do podpowiedzi oraz adres z punktu: najbliższe miasto.
const STREETS = [
  ['ul. Puławska', 52.1950, 21.0240], ['ul. Odyńca', 52.1925, 21.0130], ['ul. Marszałkowska', 52.2290, 21.0110], ['ul. Nowy Świat', 52.2330, 21.0190],
  ['ul. Grójecka', 52.2140, 20.9800], ['ul. Racławicka', 52.2000, 21.0050], ['ul. Wołoska', 52.1880, 21.0000], ['al. KEN', 52.1450, 21.0450],
  ['ul. Targowa', 52.2550, 21.0360], ['ul. Grochowska', 52.2460, 21.0950], ['ul. Słowackiego', 52.2680, 20.9850], ['ul. Górczewska', 52.2400, 20.9300],
  ['ul. Floriańska (Kraków)', 50.0640, 19.9400], ['ul. Długa (Gdańsk)', 54.3490, 18.6510], ['ul. Piotrkowska (Łódź)', 51.7590, 19.4580],
  ['ul. Święty Marcin (Poznań)', 52.4070, 16.9230], ['ul. Świdnicka (Wrocław)', 51.1060, 17.0310]
];
function reverse(lat, lng) {
  const a = areaAt(lat, lng); const inArea = inPoland(lat, lng);
  return { street: a.name, district: a.name, area: a, inArea };
}
function searchLocal(q) {
  const s = String(q || '').trim().toLowerCase(); if (s.length < 2) return [];
  const streets = STREETS.filter(x => x[0].toLowerCase().includes(s)).map(x => ({ street: x[0], lat: x[1], lng: x[2] }));
  const cities = CITY_LIST.filter(c => c.name.toLowerCase().startsWith(s)).map(c => ({ street: c.name, lat: c.lat, lng: c.lng }));
  return streets.concat(cities).slice(0, 8).map(x => { const a = areaAt(x.lat, x.lng); return Object.assign(x, { full: `${a.name}, woj. ${a.region}`, district: a.name, area: a, inArea: true }); });
}

module.exports = { CITY_LIST, AREAS, AREA_LIST, areaByKey, areaAt, areaLabel, areasNear, areaShape, servesArea, kmToArea, inPoland, haversineKm, roadKm, driveMin, reach, reverse, searchLocal, demandFromPop, cityRadius };
