'use strict';
// Integracja z Mapbox na lokalnym serwerze udającym API Mapboxa (bez sieci i bez prawdziwego tokenu).
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const calls = []; let failMatrix = false;
const fake = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); calls.push(u.pathname);
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u.searchParams.get('access_token') !== 'pk.test') return send(401, { message: 'Not Authorized - Invalid Token' });
  if (u.pathname === '/search/geocode/v6/forward') return send(200, { features: [
    { geometry: { coordinates: [21.0021, 52.2006] }, properties: { name: 'Racławicka 99', full_address: 'Racławicka 99, 02-634 Warszawa, Polska', place_formatted: '02-634 Warszawa',
      context: { place: { name: 'Warszawa' }, region: { name: 'mazowieckie' }, postcode: { name: '02-634' }, country: { country_code: 'PL' } } } },
    { geometry: { coordinates: [13.40, 52.52] }, properties: { name: 'Racławicka 1', full_address: 'Racławicka 1, Berlin', context: { place: { name: 'Berlin' }, country: { country_code: 'DE' } } } }] });
  if (u.pathname === '/search/geocode/v6/reverse') return send(200, { features: [{ geometry: { coordinates: [21.024, 52.195] }, properties: { name: 'Puławska 112', full_address: 'Puławska 112, 02-620 Warszawa' } }] });
  if (u.pathname.startsWith('/directions-matrix/v1/mapbox/driving/')) {
    if (failMatrix) return send(500, { message: 'boom' });
    const n = u.pathname.split('/').pop().split(';').length - 1;
    // każdy wykonawca: 3 km i 9 min, poza pierwszym, który jest „za rzeką”: 30 km i 55 min
    return send(200, { code: 'Ok', distances: Array.from({ length: n }, (_, i) => [i === 0 ? 30000 : 3000]), durations: Array.from({ length: n }, (_, i) => [i === 0 ? 3300 : 540]) });
  }
  if (u.pathname.startsWith('/directions/v5/mapbox/driving/')) {
    const pts = u.pathname.split('/').pop().split(';').map(s => s.split(',').map(Number));
    return send(200, { code: 'Ok', routes: [{ distance: 4200 * (pts.length - 1), duration: 660 * (pts.length - 1), geometry: { type: 'LineString', coordinates: [pts[0], [21.01, 52.2], pts[pts.length - 1]] }, legs: pts.slice(1).map(() => ({ distance: 4200, duration: 660 })) }] });
  }
  send(404, {});
});

let app, server, base;
before(async () => {
  await new Promise(r => fake.listen(0, r));
  Object.assign(process.env, { QUIET_SMS: '1', OTP_IP_LIMIT: '1000', MAPBOX_TOKEN: 'pk.test', MAPBOX_API: `http://127.0.0.1:${fake.address().port}`, DATA_DIR: path.join(os.tmpdir(), 'lsni-mbx-' + process.pid) });
  const { createApp } = require('../src/app'); const { seed } = require('../src/seed');
  app = createApp({ dbFile: ':memory:' }); seed(app.ctx.db);
  server = http.createServer(app.handler); await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fake.close(); app.close(); });

async function api(method, p, body, token) {
  const res = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
}
async function login(phone) { const c = await api('POST', '/api/auth/code', { phone }); return (await api('POST', '/api/auth/verify', { phone, code: c.data.devCode })).data.token; }

test('konfiguracja map podaje token publiczny i lokalną bibliotekę Mapbox GL', async () => {
  const r = await api('GET', '/api/config');
  assert.equal(r.data.mapbox.token, 'pk.test');
  assert.equal(r.data.mapbox.js, '/vendor/mapbox-gl.js');
  const js = await fetch(base + '/vendor/mapbox-gl.js'); assert.equal(js.status, 200); assert.match(js.headers.get('content-type'), /javascript/);
});

test('wyszukiwanie adresów przez Mapbox, z pamięcią podręczną', async () => {
  const before = calls.filter(c => c.includes('forward')).length;
  const r = await api('GET', '/api/geo/search?q=Racławicka 99');
  assert.equal(r.data.source, 'mapbox');
  assert.equal(r.data.results[0].street, 'Racławicka 99'); assert.equal(r.data.results[0].inArea, true);
  assert.equal(r.data.results[0].city, 'Warszawa');
  assert.equal(r.data.results[1].inArea, false, 'adres poza Polską jest oznaczony');
  // inne miejsce odniesienia = osobne zapytanie (wyniki najbliżej użytkownika)
  await api('GET', '/api/geo/search?q=Racławicka 99&near=50.06,19.94');
  assert.ok(calls.some(c => c.includes('forward')));
  await api('GET', '/api/geo/search?q=racławicka 99');
  assert.equal(calls.filter(c => c.includes('forward')).length, before + 2, 'powtórzone zapytanie z pamięci podręcznej');
  const rev = await api('GET', '/api/geo/reverse?lat=52.195&lng=21.024');
  assert.equal(rev.data.street, 'Puławska 112'); assert.equal(rev.data.source, 'mapbox');
});

test('wyniki wyszukiwania używają prawdziwych czasów dojazdu (Matrix)', async () => {
  const r = await api('GET', '/api/providers?lat=52.195&lng=21.024&far=1');
  const viaMapbox = r.data.results.filter(p => p.distSource === 'mapbox');
  assert.ok(viaMapbox.length > 0);
  assert.ok(viaMapbox.some(p => p.dist === 3 && p.eta === 9));
  const farOne = viaMapbox.find(p => p.dist === 30); assert.ok(farOne, 'wykonawca za rzeką ma 30 km'); assert.equal(farOne.reach, 'out');
});

test('gdy Mapbox nie odpowiada, wyszukiwanie działa na przybliżeniu', async () => {
  failMatrix = true;
  const r = await api('GET', '/api/providers?lat=52.2&lng=21.0&q=Marta');
  assert.equal(r.status, 200); assert.ok(r.data.results.every(p => p.distSource === 'estimate'));
  failMatrix = false;
});

test('trasa dojazdu do rezerwacji i trasa dnia wykonawcy po drogach', async () => {
  const kasia = await login('500100200'); const ola = await login('500100300');
  const b = (await api('GET', '/api/bookings?scope=upcoming', null, kasia)).data[0];
  const rt = await api('GET', `/api/bookings/${b.id}/route`, null, kasia);
  assert.equal(rt.data.source, 'mapbox'); assert.equal(rt.data.coordinates.length, 3); assert.equal(rt.data.min, 11);
  assert.equal((await api('GET', `/api/bookings/${b.id}/route`, null, ola)).status, 403, 'obcy nie widzi trasy');
  const day = (await api('GET', '/api/bookings?as=provider&scope=upcoming', null, ola)).data.find(x => x.status === 'confirmed');
  const d = await api('GET', `/api/pro/day?date=${day.startsAt.slice(0, 10)}`, null, ola);
  assert.equal(d.data.source, 'mapbox'); assert.ok(d.data.geometry.length >= 3); assert.ok(d.data.legs.every(l => l.min === 11));
});

