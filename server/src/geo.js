'use strict';
// Geografia na prawdziwych współrzędnych (WGS84), bez podziału na dzielnice i miasta.
// Wykonawca ma punkt bazy (zwykle centrum swojej miejscowości), promień dojazdu i opcjonalną stawkę za kilometr.
// Klient widzi tych, którzy dojeżdżają pod jego adres. Lista miejscowości z geo-pl.js służy tylko do nazwania
// miejsca (gdy Mapbox nie odpowiada) i do startowego oszacowania popytu; w aplikacji nie ma żadnych obszarów.
// Odległość drogowa bez Mapbox = odległość w linii prostej × 1,3 (z Mapbox: prawdziwa, patrz services/mapbox.js).
const { CITIES, POLAND } = require('./geo-pl');

const toRad = d => d * Math.PI / 180;
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const ROAD = 1.3;
const roadKm = (a, b) => haversineKm(a, b) * ROAD;
const driveMin = km => Math.round(km / 22 * 60 + 4);
const PLACES = CITIES.map(([name, lat, lng, pop, region]) => ({ name, lat, lng, pop, region }));

function inPoland(lat, lng) {
  let inside = false;
  for (let i = 0, j = POLAND.length - 1; i < POLAND.length; j = i++) {
    const [yi, xi] = POLAND[i], [yj, xj] = POLAND[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Nazwa miejsca dla punktu, gdy nie ma jej z Mapbox: najbliższa większa miejscowość („okolice: …”, gdy daleko).
function placeName(lat, lng) {
  let best = null, d = Infinity;
  for (const c of PLACES) { const x = haversineKm({ lat, lng }, c); if (x < d) { d = x; best = c; } }
  const near = d <= 3 + 0.3 * Math.sqrt(best.pop);
  return { name: near ? best.name : `okolice: ${best.name}`, region: best.region };
}

// Opłata za dojazd: stawka za każdy km powyżej darmowych, zaokrąglona do pełnych złotych.
function travelFeeGr(provider, km) {
  if (!provider.km_rate_gr) return 0;
  return Math.round(provider.km_rate_gr * Math.max(0, km - (provider.free_km || 0)) / 100) * 100;
}
// Czy wykonawca dojeżdża pod punkt (w promieniu) i ile kosztuje dojazd.
function reachFrom(provider, km, eta, source) {
  const status = km <= provider.radius_km ? 'in' : 'out';
  return { km: Math.round(km * 10) / 10, eta, reach: status, feeGr: status === 'in' ? travelFeeGr(provider, km) : 0, source };
}
const reach = (provider, point) => { const km = roadKm({ lat: provider.base_lat, lng: provider.base_lng }, point); return reachFrom(provider, km, driveMin(km), 'estimate'); };

// Startowy popyt (wyszukiwania dziennie) w kole: rośnie z pierwiastkiem z liczby mieszkańców miejscowości w zasięgu.
function baselineDemand(lat, lng, radiusKm) {
  const p = { lat, lng }; const straight = radiusKm / ROAD;
  let pop = 0;
  for (const c of PLACES) { const d = haversineKm(p, c); if (d <= straight) pop += c.pop; else if (d <= straight + 8) pop += c.pop * 0.25; }
  return Math.max(3, Math.round(2.2 * Math.sqrt(pop || 10)));
}

// ---------- adresy bez Mapbox ----------
const STREETS = [
  ['ul. Puławska', 52.1950, 21.0240], ['ul. Odyńca', 52.1925, 21.0130], ['ul. Marszałkowska', 52.2290, 21.0110], ['ul. Nowy Świat', 52.2330, 21.0190],
  ['ul. Grójecka', 52.2140, 20.9800], ['ul. Racławicka', 52.2000, 21.0050], ['ul. Wołoska', 52.1880, 21.0000], ['al. KEN', 52.1450, 21.0450],
  ['ul. Targowa', 52.2550, 21.0360], ['ul. Grochowska', 52.2460, 21.0950], ['ul. Słowackiego', 52.2680, 20.9850], ['ul. Górczewska', 52.2400, 20.9300],
  ['ul. Floriańska (Kraków)', 50.0640, 19.9400], ['ul. Długa (Gdańsk)', 54.3490, 18.6510], ['ul. Piotrkowska (Łódź)', 51.7590, 19.4580],
  ['ul. Święty Marcin (Poznań)', 52.4070, 16.9230], ['ul. Świdnicka (Wrocław)', 51.1060, 17.0310]
];
function reverse(lat, lng) {
  const pl = placeName(lat, lng);
  return { street: pl.name, city: pl.name, full: `${pl.name}, woj. ${pl.region}`, inArea: inPoland(lat, lng) };
}
function searchLocal(q) {
  const s = String(q || '').trim().toLowerCase(); if (s.length < 2) return [];
  const streets = STREETS.filter(x => x[0].toLowerCase().includes(s)).map(x => ({ street: x[0], lat: x[1], lng: x[2], kind: 'address' }));
  const places = PLACES.filter(c => c.name.toLowerCase().startsWith(s)).map(c => ({ street: c.name, lat: c.lat, lng: c.lng, kind: 'place' }));
  return streets.concat(places).slice(0, 8).map(x => { const pl = placeName(x.lat, x.lng); return Object.assign(x, { city: pl.name, full: `${pl.name}, woj. ${pl.region}`, inArea: true }); });
}

module.exports = { ROAD, haversineKm, roadKm, driveMin, inPoland, placeName, travelFeeGr, reachFrom, reach, baselineDemand, reverse, searchLocal };
