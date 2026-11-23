'use strict';
// Geografia Warszawy na prawdziwych współrzędnych (WGS84). Odległość drogowa = odległość w linii prostej × 1,3.
// Dzielnica punktu = najbliższy środek dzielnicy (uproszczenie; produkcyjnie: granice z PRG/OSM).

const DISTRICTS = {
  'Bielany': [52.2930, 20.9350], 'Żoliborz': [52.2680, 20.9850], 'Bemowo': [52.2540, 20.9100], 'Wola': [52.2360, 20.9600],
  'Śródmieście': [52.2310, 21.0120], 'Ochota': [52.2120, 20.9720], 'Mokotów': [52.1900, 21.0250], 'Ursynów': [52.1500, 21.0450],
  'Wilanów': [52.1600, 21.0900], 'Praga-Płn.': [52.2580, 21.0350], 'Targówek': [52.2900, 21.0550], 'Praga-Płd.': [52.2380, 21.0850]
};
// tys. mieszkańców (GUS, w zaokrągleniu) i bazowy tygodniowy popyt na start (zastępowany przez dane z wyszukiwań)
const POPULATION = { 'Bielany': 131, 'Żoliborz': 54, 'Bemowo': 126, 'Wola': 140, 'Śródmieście': 103, 'Ochota': 84, 'Mokotów': 217, 'Ursynów': 150, 'Wilanów': 47, 'Praga-Płn.': 62, 'Targówek': 123, 'Praga-Płd.': 180 };
const BASE_DEMAND = { 'Bielany': 19, 'Żoliborz': 14, 'Bemowo': 16, 'Wola': 31, 'Śródmieście': 42, 'Ochota': 17, 'Mokotów': 48, 'Ursynów': 27, 'Wilanów': 23, 'Praga-Płn.': 12, 'Targówek': 9, 'Praga-Płd.': 25 };

// Uproszczony obrys Warszawy (lat, lng) do sprawdzania, czy adres jest w obsługiwanym obszarze.
const CITY = [[52.368, 20.93], [52.36, 21.05], [52.33, 21.12], [52.29, 21.18], [52.24, 21.2], [52.2, 21.25], [52.13, 21.2], [52.1, 21.1], [52.1, 21.0], [52.14, 20.92], [52.17, 20.86], [52.22, 20.85], [52.27, 20.86], [52.31, 20.88]];

// Mały słownik ulic do podpowiedzi adresu bez zewnętrznego geokodera.
const STREETS = [
  ['ul. Puławska', 52.1950, 21.0240], ['ul. Odyńca', 52.1925, 21.0130], ['ul. Marszałkowska', 52.2290, 21.0110], ['ul. Nowy Świat', 52.2330, 21.0190],
  ['ul. Grójecka', 52.2140, 20.9800], ['ul. Racławicka', 52.2000, 21.0050], ['ul. Wołoska', 52.1880, 21.0000], ['al. KEN', 52.1450, 21.0450],
  ['ul. Wiertnicza', 52.1650, 21.0820], ['ul. Sobieskiego', 52.1950, 21.0450], ['ul. Targowa', 52.2550, 21.0360], ['ul. Grochowska', 52.2460, 21.0950],
  ['ul. Ostrobramska', 52.2350, 21.1200], ['ul. Kondratowicza', 52.2900, 21.0400], ['ul. Słowackiego', 52.2680, 20.9850], ['ul. Marymoncka', 52.2850, 20.9550],
  ['ul. Górczewska', 52.2400, 20.9300], ['ul. Wolska', 52.2330, 20.9500], ['ul. Prosta', 52.2320, 20.9900], ['ul. Żelazna', 52.2310, 20.9970],
  ['ul. Saska', 52.2320, 21.0650], ['ul. Francuska', 52.2350, 21.0530], ['ul. Belwederska', 52.2050, 21.0300], ['ul. Dolina Służewiecka', 52.1730, 21.0250],
  ['ul. Powsińska', 52.1850, 21.0600], ['ul. Radiowa', 52.2550, 20.9000], ['ul. Broniewskiego', 52.2700, 20.9600], ['ul. Kopernika', 52.2360, 21.0200],
  ['ul. Hoża', 52.2270, 21.0150], ['ul. Rakowiecka', 52.2060, 21.0050], ['ul. Branickiego', 52.1580, 21.0850], ['ul. Kasprowicza', 52.2850, 20.9450],
  ['ul. Ząbkowska', 52.2520, 21.0430], ['ul. Bora-Komorowskiego', 52.2420, 21.1000]
];

const toRad = d => d * Math.PI / 180;
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const roadKm = (a, b) => haversineKm(a, b) * 1.3;
const driveMin = km => Math.round(km / 22 * 60 + 4);

function districtAt(lat, lng) {
  let best = null, bd = Infinity;
  for (const [n, [la, ln]] of Object.entries(DISTRICTS)) { const d = haversineKm({ lat, lng }, { lat: la, lng: ln }); if (d < bd) { bd = d; best = n; } }
  return best;
}
function inWarsaw(lat, lng) {
  let inside = false;
  for (let i = 0, j = CITY.length - 1; i < CITY.length; j = i++) {
    const [yi, xi] = CITY[i], [yj, xj] = CITY[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Czy wykonawca dojeżdża pod punkt: w zasięgu, do 5 km dalej z dopłatą, albo wcale.
function reach(provider, point) {
  const km = roadKm({ lat: provider.base_lat, lng: provider.base_lng }, point);
  const r = provider.radius_km;
  const status = km <= r ? 'in' : (provider.fee_gr > 0 && km <= r + 5) ? 'fee' : 'out';
  return { km: Math.round(km * 10) / 10, eta: driveMin(km), reach: status, feeGr: status === 'fee' ? provider.fee_gr : 0 };
}
const servesDistrict = (provider, name) => {
  const [lat, lng] = DISTRICTS[name];
  return roadKm({ lat: provider.base_lat, lng: provider.base_lng }, { lat, lng }) <= provider.radius_km;
};

function reverse(lat, lng) {
  let best = STREETS[0], bd = Infinity;
  for (const s of STREETS) { const d = haversineKm({ lat, lng }, { lat: s[1], lng: s[2] }); if (d < bd) { bd = d; best = s; } }
  const no = Math.abs(Math.round(lat * 3700 + lng * 5300)) % 140 + 1;
  return { street: `${best[0]} ${no}`, district: districtAt(lat, lng), inArea: inWarsaw(lat, lng) };
}
function searchStreets(q) {
  const s = String(q || '').trim().toLowerCase(); if (s.length < 2) return [];
  return STREETS.filter(x => x[0].toLowerCase().includes(s)).slice(0, 8).map(x => ({ street: x[0], lat: x[1], lng: x[2], district: districtAt(x[1], x[2]) }));
}

// Kształty dzielnic jako GeoJSON. Jeśli w DATA_DIR leży plik dzielnice-warszawy.geojson (np. z PRG/OSM,
// z właściwością "name"), używamy prawdziwych granic. Inaczej: komórki Woronoja wokół środków dzielnic przycięte do obrysu miasta.
let SHAPES = null;
function districtShapes() {
  if (SHAPES) return SHAPES;
  try {
    const fs = require('node:fs'), path = require('node:path'); const { config } = require('./config');
    const f = path.join(config.dataDir, 'dzielnice-warszawy.geojson');
    if (fs.existsSync(f)) { SHAPES = JSON.parse(fs.readFileSync(f, 'utf8')); SHAPES.approximate = false; return SHAPES; }
  } catch (e) { }
  const K = Math.cos(52.23 * Math.PI / 180); // rzut: x = lng·cos(φ), y = lat
  const P = ([lat, lng]) => [lng * K, lat];
  const clip = (poly, a, b) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
    const f = q => (q[0] - mx) * nx + (q[1] - my) * ny; const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
      if (fa <= 0) out.push(A);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
    return out;
  };
  const city = CITY.map(P); const names = Object.keys(DISTRICTS);
  SHAPES = { type: 'FeatureCollection', approximate: true, features: names.map(n => {
    let poly = city; names.forEach(m => { if (m !== n) poly = clip(poly, P(DISTRICTS[n]), P(DISTRICTS[m])); });
    const ring = poly.map(([x, y]) => [Math.round(x / K * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]); ring.push(ring[0]);
    return { type: 'Feature', properties: { name: n, center: [DISTRICTS[n][1], DISTRICTS[n][0]] }, geometry: { type: 'Polygon', coordinates: [ring] } };
  }) };
  return SHAPES;
}

module.exports = { districtShapes, DISTRICTS, POPULATION, BASE_DEMAND, STREETS, haversineKm, roadKm, driveMin, districtAt, inWarsaw, reach, servesDistrict, reverse, searchStreets };
