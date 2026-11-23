/* Lśni — klikalna makieta marketplace'u usług sprzątania.
   Czysty JS bez kroku budowania: stan -> funkcje ekranów zwracające HTML -> render. */
(function () {
'use strict';

/* ================= helpers ================= */
const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const LUC = (window.lucide && window.lucide.icons) || {};
const pascal = n => n.replace(/(^|-)([a-z0-9])/g, (_, __, ch) => ch.toUpperCase());
const svgKids = {};
const ic = (n, c = '') => {
  const node = LUC[pascal(n)];
  if (!node) return `<span class="ic ${c}"></span>`;
  const kids = svgKids[n] || (svgKids[n] = node[2].map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join(''));
  return `<svg class="ic ${c}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kids}</svg>`;
};
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const zl = n => {
  const r = Math.round(n * 100) / 100;
  const s = r % 1 === 0 ? r.toLocaleString('pl-PL') : r.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return s + ' zł';
};
const hrs = h => (h % 1 === 0 ? h : h.toLocaleString('pl-PL')) + ' h';
const DAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const DAYS_LONG = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const today = new Date(); today.setHours(0, 0, 0, 0);
const addDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
const dayLabel = d => {
  const diff = Math.round((d - today) / 864e5);
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Jutro';
  if (diff === -1) return 'Wczoraj';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
};
const nowTime = () => { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
const store = {
  get(k, f) { try { const v = localStorage.getItem('lsni:' + k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
  set(k, v) { try { localStorage.setItem('lsni:' + k, JSON.stringify(v)); } catch (e) { } }
};

/* ================= data ================= */
const CATS = [
  { id: 'dom', name: 'Mieszkanie i dom', short: 'Mieszkanie', icon: 'house', tone: 't-yellow' },
  { id: 'generalne', name: 'Sprzątanie generalne', short: 'Generalne', icon: 'sparkles', tone: 't-blue' },
  { id: 'remont', name: 'Po remoncie', short: 'Po remoncie', icon: 'paint-roller', tone: 't-sand' },
  { id: 'okna', name: 'Mycie okien', short: 'Okna', icon: 'app-window', tone: 't-mint' },
  { id: 'tapicerka', name: 'Pranie tapicerki', short: 'Tapicerka', icon: 'sofa', tone: 't-lilac' },
  { id: 'biuro', name: 'Biura i lokale', short: 'Biura', icon: 'building-2', tone: 't-blue' },
  { id: 'najem', name: 'Najem krótkoterminowy', short: 'Najem', icon: 'bed-double', tone: 't-rose' },
  { id: 'prasowanie', name: 'Prasowanie', short: 'Prasowanie', icon: 'shirt', tone: 't-mint' }
];
const catById = id => CATS.find(c => c.id === id);

const PROS = [
  {
    id: 'marta', name: 'Marta Kowalczyk', ini: 'MK', tone: 't-yellow', kind: 'Osoba prywatna', area: 'Mokotów', dist: 1.2,
    rating: 4.97, reviews: 212, jobs: 540, repeat: 78, response: '8 min', rate: 45, minH: 3, since: 2019,
    verified: true, insured: true, invoice: false, supplies: true, eco: true, pets: true, langs: ['PL', 'EN'],
    services: ['dom', 'generalne', 'okna', 'najem'], super: true, nextSlot: 'Jutro 10:00', todayFree: false,
    tagline: 'Mieszkania i domy, ekologiczne środki, własny odkurzacz z filtrem HEPA',
    bio: 'Sprzątam zawodowo od 2019 roku. Pracuję według stałej checklisty, więc wiesz, co będzie zrobione. Przynoszę własny sprzęt i środki z certyfikatem Ecolabel. Lubię zwierzęta.',
    reviewsList: [
      { who: 'Kasia, Mokotów', stars: 5, when: '12 lis', text: 'Przyszła punktualnie, łazienka wygląda jak w hotelu. Zostawiła nawet notatkę, co warto wymienić w odpływie.', tags: ['Punktualna', 'Łazienka lśni'] },
      { who: 'Michał, Ursynów', stars: 5, when: '3 lis', text: 'Stałe sprzątanie co 2 tygodnie od pół roku. Zero problemów, zawsze dogada się co do terminu.', tags: ['Stały klient'] },
      { who: 'Ania, Wilanów', stars: 4, when: '28 paź', text: 'Bardzo dokładnie, trochę dłużej niż szacowała, ale uprzedziła wcześniej.', tags: ['Dokładna'] }
    ]
  },
  {
    id: 'czysto', name: 'Czysto & Basta', ini: 'CB', tone: 't-blue', kind: 'Firma · zespół 3 osób', area: 'Wola', dist: 4.6,
    rating: 4.88, reviews: 418, jobs: 1320, repeat: 64, response: '15 min', rate: 59, minH: 4, since: 2016,
    verified: true, insured: true, invoice: true, supplies: true, eco: false, pets: true, langs: ['PL'],
    services: ['remont', 'generalne', 'biuro', 'okna'], super: true, nextSlot: 'Pt 8:00', todayFree: false,
    tagline: 'Sprzątanie po remoncie i biura. Faktura VAT, przemysłowe odkurzacze',
    bio: 'Zespół, który usuwa pył budowlany, resztki fug i farby. Mamy przemysłowe odkurzacze i myjki parowe. Wystawiamy fakturę VAT, obsługujemy wspólnoty i biura.',
    reviewsList: [
      { who: 'Piotr, Wola', stars: 5, when: '3 lis', text: 'Po remoncie łazienki i kuchni: pył zniknął nawet z szafek w środku. Trzy osoby, pięć godzin.', tags: ['Po remoncie', 'Szybko'] },
      { who: 'Biuro rachunkowe Sigma', stars: 5, when: '20 paź', text: 'Sprzątają nasze biuro od roku, faktura zawsze na czas.', tags: ['Faktura VAT'] }
    ]
  },
  {
    id: 'olena', name: 'Olena Shevchenko', ini: 'OS', tone: 't-mint', kind: 'Osoba prywatna', area: 'Mokotów', dist: 0.8,
    rating: 4.93, reviews: 96, jobs: 180, repeat: 71, response: '5 min', rate: 42, minH: 3, since: 2021,
    verified: true, insured: false, invoice: false, supplies: true, eco: true, pets: true, langs: ['PL', 'UA', 'EN'],
    services: ['dom', 'prasowanie', 'najem'], super: false, nextSlot: 'Dziś 14:00', todayFree: true,
    tagline: 'Sprzątanie i prasowanie. Wolne terminy jeszcze dziś',
    bio: 'Mieszkam na Mokotowie, więc często mogę przyjechać tego samego dnia. Sprzątam i prasuję, mogę też zrobić pranie w trakcie wizyty.',
    reviewsList: [
      { who: 'Tomek, Służew', stars: 5, when: 'wczoraj', text: 'Zarezerwowałem rano, o 14 już była. Koszule wyprasowane idealnie.', tags: ['Na dziś', 'Prasowanie'] },
      { who: 'Ola, Mokotów', stars: 5, when: '9 lis', text: 'Miła, dokładna i bardzo szybka.', tags: ['Miła'] }
    ]
  },
  {
    id: 'pawel', name: 'Paweł Nowak · Przejrzyście', ini: 'PN', tone: 't-sand', kind: 'Jednoosobowa firma', area: 'Żoliborz', dist: 6.1,
    rating: 4.91, reviews: 154, jobs: 610, repeat: 58, response: '20 min', rate: 55, minH: 2, since: 2017,
    verified: true, insured: true, invoice: true, supplies: true, eco: false, pets: false, langs: ['PL'],
    services: ['okna', 'biuro'], super: false, nextSlot: 'Sob 9:00', todayFree: false, perWindow: 25,
    tagline: 'Okna, witryny, przeszklenia. Woda demineralizowana, bez smug',
    bio: 'Myję okna systemem z wodą demineralizowaną i kijem teleskopowym do 4. piętra od zewnątrz. Ramy, parapety i rolety w cenie.',
    reviewsList: [
      { who: 'Ewa, Bielany', stars: 5, when: '1 lis', text: 'Okna bez jednej smugi, ramy też umyte. Polecam.', tags: ['Bez smug'] }
    ]
  },
  {
    id: 'babel', name: 'Bąbel · pranie tapicerki', ini: 'Bą', tone: 't-lilac', kind: 'Firma', area: 'Praga-Południe', dist: 7.4,
    rating: 4.85, reviews: 233, jobs: 890, repeat: 41, response: '30 min', rate: 99, minH: 1, since: 2018, fixed: true,
    verified: true, insured: true, invoice: true, supplies: true, eco: true, pets: true, langs: ['PL'],
    services: ['tapicerka'], super: false, nextSlot: 'Śr 12:00', todayFree: false,
    tagline: 'Kanapy, materace, dywany i fotele samochodowe. Schnie w 4 godziny',
    bio: 'Pierzemy ekstrakcyjnie urządzeniami Kärcher, środkami bezpiecznymi dla dzieci i zwierząt. Usuwamy plamy z wina, kawy i moczu.',
    reviewsList: [
      { who: 'Magda, Grochów', stars: 5, when: '5 lis', text: 'Kanapa po kocie jak nowa, zapach zniknął.', tags: ['Plamy', 'Zwierzęta'] }
    ]
  },
  {
    id: 'agnieszka', name: 'Agnieszka Wróbel', ini: 'AW', tone: 't-rose', kind: 'Osoba prywatna', area: 'Śródmieście', dist: 3.0,
    rating: 4.79, reviews: 61, jobs: 120, repeat: 66, response: '12 min', rate: 48, minH: 2, since: 2022,
    verified: true, insured: false, invoice: false, supplies: false, eco: false, pets: true, langs: ['PL', 'EN', 'DE'],
    services: ['najem', 'dom', 'prasowanie'], super: false, nextSlot: 'Dziś 18:00', todayFree: true,
    tagline: 'Obsługa mieszkań na wynajem: sprzątanie, pościel, zdjęcia stanu',
    bio: 'Obsługuję mieszkania na Airbnb i Booking między gośćmi: sprzątanie, wymiana pościeli, uzupełnienie kosmetyków i raport zdjęciowy.',
    reviewsList: [
      { who: 'Host, Śródmieście', stars: 5, when: '15 lis', text: 'Zdjęcia po każdym sprzątaniu, goście chwalą czystość w recenzjach.', tags: ['Raport ze zdjęciami'] }
    ]
  }
];
const proById = id => PROS.find(p => p.id === id);

/* ================= GEO: schematyczna mapa Warszawy i okolic w kilometrach (x na wschód, y na południe) ================= */
const mkPro = (o) => Object.assign({ verified: true, minH: 3, jobs: Math.round(o.reviews * 2.2), repeat: 60, response: '12 min', langs: ['PL'], super: false, todayFree: false, insured: false, invoice: false, supplies: true, eco: false, pets: true, kind: 'Osoba prywatna' }, o);
PROS.push(
  mkPro({ id: 'kinga', name: 'Kinga Lis', ini: 'KL', tone: 't-sand', area: 'Ursynów', rating: 4.86, reviews: 74, rate: 40, since: 2022, services: ['dom', 'prasowanie'], nextSlot: 'Dziś 16:00', todayFree: true, response: '10 min', tagline: 'Ursynów i Kabaty. Mop parowy i własne środki', bio: 'Mieszkam na Kabatach, więc na Ursynowie jestem w kwadrans. Sprzątam mieszkania i prasuję, mam mop parowy do podłóg i fug.', reviewsList: [{ who: 'Monika, Kabaty', stars: 5, when: '10 lis', text: 'Szybko i dokładnie, fugi w łazience wreszcie białe.', tags: ['Fugi', 'Szybko'] }] }),
  mkPro({ id: 'tomasz', name: 'Tomasz Wójcik', ini: 'TW', tone: 't-blue', area: 'Praga-Płn.', rating: 4.81, reviews: 58, rate: 44, since: 2021, services: ['dom', 'generalne'], nextSlot: 'Jutro 12:00', tagline: 'Praga i Śródmieście. Generalne porządki w kamienicach', bio: 'Sprzątam głównie mieszkania w kamienicach na Pradze: wysokie sufity, stare parkiety i okna skrzynkowe to moja specjalność.', reviewsList: [{ who: 'Ola, Praga', stars: 5, when: '7 lis', text: 'Parkiet w kamienicy odświeżony, okna skrzynkowe umyte w środku.', tags: ['Kamienica'] }] }),
  mkPro({ id: 'eko', name: 'EkoLśnienie', ini: 'EL', tone: 't-mint', kind: 'Firma · zespół 5 osób', area: 'Wilanów', rating: 4.9, reviews: 189, rate: 52, since: 2018, services: ['dom', 'generalne', 'biuro'], nextSlot: 'Śr 9:00', super: true, insured: true, invoice: true, eco: true, response: '9 min', tagline: 'Wilanów, Mokotów, Ursynów. Tylko środki z certyfikatem Ecolabel', bio: 'Pracujemy wyłącznie na środkach z certyfikatem Ecolabel i ściereczkach z mikrofibry. Obsługujemy domy i małe biura, wystawiamy faktury.', reviewsList: [{ who: 'Paweł, Wilanów', stars: 5, when: '14 lis', text: 'Dom 180 m², dwie osoby, pięć godzin. Bez chemicznego zapachu.', tags: ['Eco', 'Dom'] }] }),
  mkPro({ id: 'iryna', name: 'Iryna Bondar', ini: 'IB', tone: 't-rose', area: 'Bemowo', rating: 4.88, reviews: 102, rate: 41, since: 2020, services: ['dom', 'najem'], nextSlot: 'Dziś 12:00', todayFree: true, langs: ['PL', 'UA'], tagline: 'Bemowo, Wola, Bielany. Mieszkania i wynajem krótkoterminowy', bio: 'Obsługuję mieszkania na wynajem na Woli i Bemowie oraz zwykłe sprzątanie. Zawsze wysyłam zdjęcia po zakończeniu.', reviewsList: [{ who: 'Host, Wola', stars: 5, when: '2 lis', text: 'Niezawodna przy rotacji gości, zdjęcia po każdym sprzątaniu.', tags: ['Najem'] }] }),
  mkPro({ id: 'kasia', name: 'Katarzyna Mazur', ini: 'KM', tone: 't-lilac', area: 'Bielany', rating: 4.95, reviews: 131, rate: 43, since: 2019, services: ['dom', 'okna'], nextSlot: 'Jutro 8:00', super: true, insured: true, response: '7 min', tagline: 'Bielany i Żoliborz. Mieszkania i okna w jednej wizycie', bio: 'Łączę sprzątanie mieszkania z myciem okien, więc wszystko załatwiasz jedną wizytą. Na Bielanach i Żoliborzu dojeżdżam rowerem.', reviewsList: [{ who: 'Jacek, Żoliborz', stars: 5, when: '11 lis', text: 'Mieszkanie i sześć okien w jeden dzień, bez smug.', tags: ['Okna'] }] }),
  mkPro({ id: 'blysk', name: 'Błysk Serwis', ini: 'BS', tone: 't-yellow', kind: 'Firma', area: 'Targówek', rating: 4.74, reviews: 264, rate: 55, minH: 4, since: 2015, services: ['remont', 'biuro', 'okna'], nextSlot: 'Pt 7:00', insured: true, invoice: true, response: '25 min', tagline: 'Praga, Targówek, Białołęka. Remonty, biura, witryny', bio: 'Sprzątamy po remontach i budowach oraz obsługujemy biura i lokale usługowe. Mamy podnośnik do witryn i przemysłowe odkurzacze.', reviewsList: [{ who: 'Sklep Okrąglak', stars: 5, when: '30 paź', text: 'Witryny myte co tydzień, zawsze przed otwarciem.', tags: ['Witryny'] }] })
);
const PRO_GEO = { marta: [13.5, 15.2, 6, 15], czysto: [8.6, 9.8, 14, 0], olena: [13.9, 16.6, 4, 10], pawel: [10.6, 5.2, 10, 20], babel: [19.8, 13, 16, 0], agnieszka: [12.4, 10.8, 6, 20], kinga: [11.4, 22, 7, 15], tomasz: [16.2, 8.2, 8, 15], eko: [16.4, 21, 10, 20], iryna: [3.6, 9.2, 7, 15], kasia: [6.2, 3.2, 6, 15], blysk: [19.6, 5, 13, 25] };
// [x, y, zasięg km, dawna dopłata] → zasięg dojazdu i stawka 2 zł/km powyżej połowy zasięgu u tych, którzy brali dopłatę
PROS.forEach(p => { const g = PRO_GEO[p.id]; Object.assign(p, { x: g[0], y: g[1], r: g[2] + (g[3] ? 5 : 0), kmRate: g[3] ? 2 : 0, freeKm: g[3] ? Math.round(g[2] / 2) : 0 }); });

// wykonawcy z aktywnym wyróżnieniem (obejmuje cały ich zasięg dojazdu)
const PROMO = ['eko', 'kinga', 'kasia'];
PROS.forEach(p => { p.boosted = PROMO.includes(p.id); });
const U = 10; // jednostek SVG na kilometr
// punkty kontrolne do przeliczania współrzędnych schematu na prawdziwe (GEOFIT); nie są obszarami w aplikacji
const SITES = { 'Bielany': [6, 3], 'Żoliborz': [10.6, 5.6], 'Bemowo': [3, 9.5], 'Wola': [8.4, 10], 'Śródmieście': [12.4, 10.4], 'Ochota': [8.8, 14.4], 'Mokotów': [13, 16.2], 'Ursynów': [11.6, 22.6], 'Wilanów': [16, 21.6], 'Praga-Płn.': [16.2, 8.4], 'Targówek': [19.6, 4.8], 'Praga-Płd.': [19.8, 13] };
const CITY = [[3, .6], [8.5, -.4], [13.5, .4], [18.5, .2], [23, 2.2], [24.6, 7.5], [24.2, 13.5], [22.8, 18.2], [20.4, 22], [18.8, 26], [13.5, 26.6], [9.4, 25.2], [8, 20.5], [5.4, 17.2], [1.6, 14.2], [0, 9.4], [.6, 4.2]];
const RIVER = [[10.2, -1], [12.6, 3], [14.3, 7], [15.2, 10.5], [15.8, 13.6], [17, 17], [18.5, 20.6], [19.8, 27]];
const ROADS = [[[12.6, 11], [13, 15], [12.6, 19], [12.2, 26]], [[1, 12.6], [8, 11.6], [12.6, 11], [15.4, 11], [20, 10.8], [24, 10.2]], [[12, 5], [12.4, 8], [12.6, 11]], [[11.6, 9], [11.8, 13], [12, 17], [11.4, 22.6]], [[15.6, 11], [19, 12.6], [24, 14.5]], [[.4, 8], [6, 6.4], [10, 4.6], [16, 4.2], [23, 3.4]], [[.4, 9.2], [8, 9.8], [11.6, 10]], [[13.6, 15], [15, 18.5], [16.2, 21]], [[16, 8.6], [19.6, 5], [22, 2.8]], [[5, 17], [9, 14], [11.8, 13]]];
const PARKS = [[11.2, 13, 1.4, .8, 'Pole Mokotowskie'], [12.8, 25, 2.2, 1.1, 'Las Kabacki'], [17, 11.2, .8, .6, 'Park Skaryszewski'], [8.4, 1.6, 1.2, .8, 'Las Bielański'], [16.8, 23.4, 1.4, .8, ''], [1.8, 7, 1.2, 1, '']];
const STREETS = [['ul. Puławska', 13, 15.6], ['ul. Odyńca', 12.6, 17.4], ['ul. Marszałkowska', 12.3, 9.6], ['ul. Nowy Świat', 13.4, 10.4], ['ul. Grójecka', 9.6, 13.4], ['ul. Racławicka', 10.8, 15.2], ['ul. Wołoska', 11.6, 17.2], ['al. KEN', 11.8, 22.4], ['ul. Wiertnicza', 15.2, 20.2], ['ul. Sobieskiego', 14.6, 17.8], ['ul. Targowa', 15.8, 8.4], ['ul. Grochowska', 19, 12.6], ['ul. Ostrobramska', 21.4, 14.2], ['ul. Kondratowicza', 19.6, 4.6], ['ul. Słowackiego', 10.6, 5.2], ['ul. Marymoncka', 7, 3.2], ['ul. Górczewska', 5, 9.4], ['ul. Wolska', 6.6, 11], ['ul. Prosta', 10.4, 10.6], ['ul. Żelazna', 11, 10.2], ['ul. Saska', 18, 12], ['ul. Francuska', 17.6, 12.8], ['ul. Belwederska', 13.8, 14], ['ul. Dolina Służewiecka', 13.2, 19.4], ['ul. Powsińska', 15, 18.6], ['ul. Radiowa', 3.2, 9.2], ['ul. Broniewskiego', 8, 4.8], ['ul. Kopernika', 13, 9.8], ['ul. Hoża', 12.6, 10.8], ['ul. Rakowiecka', 12, 13.6], ['ul. Branickiego', 15.8, 21.8], ['ul. Kasprowicza', 7.6, 3.6], ['ul. Ząbkowska', 16.4, 8.6], ['ul. Bora-Komorowskiego', 20.4, 11.6]];

const polyD = poly => 'M' + poly.map(q => (q[0] * U).toFixed(1) + ' ' + (q[1] * U).toFixed(1)).join('L') + 'Z';
const smoothD = pts => { let d = `M${pts[0][0] * U} ${pts[0][1] * U}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += `Q${pts[i][0] * U} ${pts[i][1] * U} ${mx * U} ${my * U}`; } const l = pts[pts.length - 1]; return d + `L${l[0] * U} ${l[1] * U}`; };
const kmf = d => (Math.round(d * 10) / 10).toLocaleString('pl-PL');
const roadKm = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * 1.3;
const driveMin = d => Math.round(d / 22 * 60 + 4);
function reverseGeo(x, y) {
  const st = STREETS.reduce((b, s2) => { const d = (s2[1] - x) ** 2 + (s2[2] - y) ** 2; return d < b[1] ? [s2, d] : b; }, [null, 1e9])[0];
  return { street: `${st[0]} ${Math.abs(Math.round(x * 37 + y * 53)) % 140 + 1}`, district: placeNear({ x, y }) };
}
const addrById = id => S.addresses.find(a => a.id === id);
const curAddr = () => addrById(S.addrId) || S.addresses[0];
// Dojeżdża albo nie: w promieniu od bazy. Opłata za dojazd: stawka za km powyżej darmowych km (jak na serwerze).
function reachFor(p, a) { const d = p.lat != null && a.lat != null ? haversine(p.lat, p.lng, a.lat, a.lng) * 1.3 : roadKm(p, a); const reach = d <= p.r ? 'in' : 'out'; return { d, eta: driveMin(d), reach, fee: reach === 'in' ? travelFee(p, d) : 0 }; }
function updateGeo() { const a = curAddr(); PROS.forEach(p => { const r = reachFor(p, a); p.dist = Math.round(r.d * 10) / 10; p.eta = r.eta; p.reach = r.reach; p.travelFee = r.fee; }); }
// Bez podziału na dzielnice i miasta: wykonawca ma bazę (punkt, zwykle centrum swojej miejscowości), promień dojazdu
// i opcjonalną stawkę za kilometr. Klient widzi tych, którzy dojeżdżają pod jego adres. Kilka miejscowości służy tylko
// do nazwania miejsca w demo i do oszacowania popytu w kole (tak samo jak serwer, server/src/geo.js).
const DEMO_PLACES = [['Warszawa', 52.2297, 21.0122, 1860], ['Pruszków', 52.1708, 20.8125, 62], ['Piaseczno', 52.0814, 21.0237, 50], ['Legionowo', 52.4048, 20.9264, 54],
  ['Otwock', 52.1059, 21.2616, 45], ['Marki', 52.3253, 21.1044, 39], ['Ząbki', 52.2926, 21.1061, 38], ['Łomianki', 52.3346, 20.8858, 17], ['Józefów', 52.1370, 21.2350, 20],
  ['Konstancin-Jeziorna', 52.0930, 21.1170, 17], ['Wołomin', 52.3499, 21.2425, 36], ['Grodzisk Mazowiecki', 52.1087, 20.6253, 31]];
const realPt = p => p.lat != null ? p : GEOFIT.toReal(p.x, p.y);
const kmBetween = (a, b) => { const A = realPt(a), B = realPt(b); return haversine(A.lat, A.lng, B.lat, B.lng) * 1.3; };
function placeNear(p) { const r = realPt(p); let best = DEMO_PLACES[0], d = 1e9; DEMO_PLACES.forEach(c => { const x = haversine(r.lat, r.lng, c[1], c[2]); if (x < d) { d = x; best = c; } }); return d <= 3 + 0.3 * Math.sqrt(best[3]) ? best[0] : 'okolice: ' + best[0]; }
const placeOf = a => a.city || placeNear(a);
const zlKm = v => String(v).replace('.', ',') + ' zł';
const travelFee = (p, km) => p.kmRate ? Math.round(p.kmRate * Math.max(0, km - (p.freeKm || 0))) : 0;
const feeText = p => p.kmRate ? `${zlKm(p.kmRate)}/km${p.freeKm ? ` powyżej ${p.freeKm} km` : ''}` : 'dojazd w cenie';
// popyt (wyszukiwania dziennie) w kole: w demo szacunek z liczby mieszkańców, online liczy serwer z prawdziwych wyszukiwań
function demandIn(c, radiusKm) {
  const r = realPt(c); const straight = radiusKm / 1.3; let pop = 0;
  DEMO_PLACES.forEach(([, la, ln, pp]) => { const d = haversine(r.lat, r.lng, la, ln); if (d <= straight) pop += pp; else if (d <= straight + 8) pop += pp * .25; });
  return Math.max(3, Math.round(2.2 * Math.sqrt(pop || 10)));
}
const boostBase = d => Math.round(8 + d * .6);
const boostPrice = (d, days) => days === 3 ? Math.round(boostBase(d) * .5) : days === 14 ? Math.round(boostBase(d) * 1.8) : boostBase(d);
const boostViews = (d, days) => Math.round(d * 3 * days / 7);
// kto dojeżdża pod punkt: liczba, średnia stawka, wolne terminy dziś, ilu liczy opłatę za dojazd
function pointStats(pt) {
  const near = PROS.map(p => Object.assign({ p }, reachFor(p, pt))).filter(r => r.reach === 'in').sort((a, b) => a.d - b.d); const hourly = near.filter(r => !r.p.fixed && !r.p.perWindow);
  return { near, count: near.length, avg: hourly.length ? Math.round(hourly.reduce((x, r) => x + r.p.rate, 0) / hourly.length) : 0,
    free: near.reduce((x, r) => x + SLOTS.filter(t => !slotTaken(r.p.id, 0, t)).length, 0), withFee: near.filter(r => r.fee > 0).length };
}
// punkty mapy cieplnej „gdzie szukają klienci”: w demo z rozkładu mieszkańców, online z prawdziwych wyszukiwań
function demoHeat() {
  const pts = []; DEMO_PLACES.forEach(([, la, ln, pop], k) => { const n = Math.min(40, Math.round(Math.sqrt(pop) * 1.1)); const sp = 0.012 + Math.sqrt(pop) * 0.0012;
    for (let i = 0; i < n; i++) { const a = (i * 137.5 + k * 40) * Math.PI / 180, rr = sp * Math.sqrt((i + 1) / n); pts.push({ lat: la + rr * Math.sin(a) * .62, lng: ln + rr * Math.cos(a), n: 1 + (i % 3) }); } });
  return pts;
}
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mixFill = (tok, pct) => { try { const a = hexRgb(cssVar(tok)), b = hexRgb(cssVar('surface-2')), k = Math.max(0, Math.min(100, pct)) / 100; return `rgb(${a.map((v, i) => Math.round(v * k + b[i] * (1 - k))).join(',')})`; } catch (e) { return `color-mix(in srgb, var(--${tok}) ${Math.round(pct)}%, var(--surface-2))`; } };
const resolveColor = c => { const m = /^var\(--([\w-]+)\)$/.exec(String(c || '')); return m ? cssVar(m[1]) : c; };

/* ---------- komponent mapy: przesuwanie, pinch/kółko, markery HTML w stałym rozmiarze ---------- */
const MAPCFG = {}; let mapDragAt = 0, mapTapAt = 0;
function geoMap(id, o) {
  if (S.mbx) return mbxMap(id, o);
  const c0 = o.center || [12.5, 13];
  if (!S.maps[id] || o.reset) S.maps[id] = { x: c0[0], y: c0[1], z: o.zoom || 13 };
  MAPCFG[id] = o;
  // mapa cieplna popytu (warstwa pod pinezkami)
  const heat = (o.heat || []).map(h => { const g = GEOFIT.toGrid(h.lat, h.lng); return `<circle cx="${(g.x * U).toFixed(1)}" cy="${(g.y * U).toFixed(1)}" r="${(8 + h.n * 3)}" fill="var(--rose)" opacity=".1"/>`; }).join('');
  const parks = PARKS.map(([x, y, rx, ry]) => `<ellipse cx="${x * U}" cy="${y * U}" rx="${rx * U}" ry="${ry * U}" fill="var(--mint-soft)"/>`).join('');
  const base = `<path d="${polyD(CITY)}" fill="var(--surface)"/>
    ${heat}
    ${parks}<g fill="none" stroke="var(--surface)" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${ROADS.map(r => `<path d="${smoothD(r)}" stroke-width="2.6"/>`).join('')}</g>
    <path d="${smoothD(RIVER)}" fill="none" stroke="var(--cloth-soft)" stroke-width="9" stroke-linecap="round"/><path d="${smoothD(RIVER)}" fill="none" stroke="var(--cloth)" stroke-width="1" opacity=".35" stroke-linecap="round"/>
    <path d="${polyD(CITY)}" fill="none" stroke="var(--ink-3)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".6"/>`;
  const labels = o.labels === false ? [] : DEMO_PLACES.slice(1).map(([n, la, ln]) => { const g = GEOFIT.toGrid(la, ln); return { x: g.x, y: g.y, cls: 'gm-label', html: esc(n) }; });
  const marks = labels.concat(o.markers || []);
  return `<div class="gmap ${o.static ? 'static' : ''} ${o.cls || ''}" id="gm-${id}" data-map="${id}" style="height:${o.h || 320}px">
    <svg class="gm-svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${base}<g class="gm-layer">${o.layer || ''}</g></svg>
    <div class="gm-marks">${marks.map(m => { const tag = m.act ? 'button' : 'div'; return `<${tag} class="gm-m ${m.cls || ''}" data-x="${m.x}" data-y="${m.y}" ${m.bottom ? 'data-b="1"' : ''} ${m.id ? `id="${m.id}"` : ''} ${m.act ? `data-act="${m.act}" data-a="${m.a || ''}" aria-label="${esc(m.label || '')}"` : ''}>${m.html}</${tag}>`; }).join('')}</div>
    ${o.fixedPin ? `<div class="gm-center"><span class="gm-cpin">${ic('map-pin', 'l')}</span><i></i></div>` : ''}
    ${o.static ? '' : `<div class="gm-ctl"><button type="button" data-mz="1" aria-label="Przybliż">${ic('plus', 's')}</button><button type="button" data-mz="-1" aria-label="Oddal">${ic('minus', 's')}</button>${o.locate ? `<button type="button" data-mloc aria-label="Wyśrodkuj">${ic('locate-fixed', 's')}</button>` : ''}</div>`}
    ${o.overlay || ''}
  </div>`;
}
class GeoMap {
  constructor(el) { this.el = el; this.id = el.dataset.map; this.cfg = MAPCFG[this.id] || {}; this.v = S.maps[this.id]; this.svg = el.querySelector('svg'); this.marks = [...el.querySelectorAll('.gm-m')]; this.layout(); if (!this.cfg.static) this.bind(); }
  get w() { return this.el.clientWidth; } get h() { return this.el.clientHeight; }
  layout() {
    const { x, y, z } = this.v, w = this.w, h = this.h; if (!w) return;
    this.svg.setAttribute('viewBox', `${(x - w / 2 / z) * U} ${(y - h / 2 / z) * U} ${w / z * U} ${h / z * U}`);
    this.v.w = w; this.v.h = h; this.el.dataset.zl = z < 11 ? 0 : z < 20 ? 1 : 2;
    this.marks.forEach(m => this.place(m, +m.dataset.x, +m.dataset.y));
  }
  toScreen(X, Y) { return [(X - this.v.x) * this.v.z + this.w / 2, (Y - this.v.y) * this.v.z + this.h / 2]; }
  toWorld(px, py) { return [(px - this.w / 2) / this.v.z + this.v.x, (py - this.h / 2) / this.v.z + this.v.y]; }
  place(m, X, Y) { m.dataset.x = X; m.dataset.y = Y; const [sx, sy] = this.toScreen(X, Y); m.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,${m.dataset.b ? '-100%' : '-50%'})`; }
  clamp() { this.v.x = Math.max(-1, Math.min(26, this.v.x)); this.v.y = Math.max(-1, Math.min(28, this.v.y)); }
  zoomAt(f, px, py) { const [wx, wy] = this.toWorld(px, py); const z = Math.max(8, Math.min(80, this.v.z * f)); this.v.z = z; this.v.x = wx - (px - this.w / 2) / z; this.v.y = wy - (py - this.h / 2) / z; this.clamp(); this.layout(); }
  moved() { this.cfg.onMove && this.cfg.onMove(this); }
  bind() {
    const el = this.el, pts = new Map(); let start = null, moved = false, pinch = null;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.gm-ctl')) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, vx: this.v.x, vy: this.v.y }; moved = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.v.z }; moved = true; }
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const r = el.getBoundingClientRect(); this.zoomAt(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d / this.v.z, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); this.moved(); return; }
      if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; try { el.setPointerCapture(e.pointerId); } catch (er) { } el.classList.add('dragging'); }
      if (moved) { this.v.x = start.vx - dx / this.v.z; this.v.y = start.vy - dy / this.v.z; this.clamp(); this.layout(); this.moved(); }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (pts.size) return; el.classList.remove('dragging');
      if (moved) { mapDragAt = Date.now(); persist(); this.cfg.onMoveEnd && this.cfg.onMoveEnd(this); }
      else if (start && !e.target.closest('.gm-m[data-act], .gm-ctl, .gm-over') && this.cfg.onTap) { const r = el.getBoundingClientRect(); const [wx, wy] = this.toWorld(e.clientX - r.left, e.clientY - r.top); mapTapAt = Date.now(); this.cfg.onTap(wx, wy, this); }
      start = null;
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e => { e.preventDefault(); const r = el.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY * .0018), e.clientX - r.left, e.clientY - r.top); this.moved(); }, { passive: false });
    el.querySelectorAll('[data-mz]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.zoomAt(b.dataset.mz === '1' ? 1.5 : 1 / 1.5, this.w / 2, this.h / 2); this.moved(); persist(); }));
    const loc = el.querySelector('[data-mloc]'); if (loc) loc.addEventListener('click', ev => { ev.stopPropagation(); const c = this.cfg.center; Object.assign(this.v, { x: c[0], y: c[1] }); this.layout(); this.moved(); });
  }
}
function initMaps() { document.querySelectorAll('#app .gmap').forEach(el => { if (el.classList.contains('mbx')) mountMapbox(el); else if (!el._m) el._m = new GeoMap(el); }); }

/* ================= MAPBOX: prawdziwa mapa w trybie online ================= */
// Włącza się, gdy serwer poda token Mapbox (/api/config). Pinezki zostają w stylu aplikacji (HTML),
// zasięgi, mapa cieplna i trasy są warstwami mapy. Jedna instancja mapy na id: przy ponownym renderze ekranu
// przenosimy istniejące płótno do nowego miejsca, więc mapa nie wczytuje się od nowa.
const MBX = {};
if (/^(localhost|127\.)/.test(location.hostname)) window.__lsniMBX = MBX; // podgląd instancji map przy testach lokalnych
const MBX_LOCALE = { 'ScrollZoomBlocker.CtrlMessage': 'Przytrzymaj Ctrl i przewiń, żeby przybliżyć mapę', 'ScrollZoomBlocker.CmdMessage': 'Przytrzymaj ⌘ i przewiń, żeby przybliżyć mapę', 'TouchPanBlocker.Message': 'Przesuń mapę dwoma palcami', 'TouchPanBlocker.OnboardingMessage': 'Przesuń mapę dwoma palcami' };
const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const mbxStyle = () => isDark() ? S.mbx.styleDark : S.mbx.styleLight;
const realOf = m => m.lat != null ? { lat: m.lat, lng: m.lng } : GEOFIT.toReal(m.x, m.y);
const zoomFromGrid = z => Math.log2(156543.03 * Math.cos(52.23 * Math.PI / 180) * z / 1000);
function circlePoly(lat, lng, km, n = 56) {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([lng + km / (111.32 * Math.cos(lat * Math.PI / 180)) * Math.cos(a), lat + km / 110.57 * Math.sin(a)]); }
  pts.push(pts[0]); return pts;
}
const ROAD = 1.3;
// Prostokąt obejmujący okrąg (do dopasowania widoku mapy)
const circleBounds = (lat, lng, km) => { const dLat = km / 110.57, dLng = km / (111.32 * Math.cos(lat * Math.PI / 180)); return [[lng - dLng, lat - dLat], [lng + dLng, lat + dLat]]; }; // zasięg wykonawcy jest w km drogi; na mapie rysujemy odpowiadający mu promień w linii prostej
const lineLenScale = Math.cos(52.23 * Math.PI / 180);
function alongLngLat(coords, t) {
  const seg = []; let tot = 0; for (let i = 1; i < coords.length; i++) { const l = Math.hypot((coords[i][0] - coords[i - 1][0]) * lineLenScale, coords[i][1] - coords[i - 1][1]); seg.push(l); tot += l; }
  let d = t * tot; const done = [coords[0]];
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = seg[i] ? d / seg[i] : 0; const p = [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * k, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * k]; done.push(p); return { pos: p, done }; } d -= seg[i]; done.push(coords[i + 1]); }
  return { pos: coords[coords.length - 1], done: coords };
}
// Kodowanie polilinii (precyzja 5) dla Static Images API
function encodePolyline(pts) {
  let out = '', pl = 0, pg = 0; const enc = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  pts.forEach(([lng, lat]) => { const a = Math.round(lat * 1e5), b = Math.round(lng * 1e5); out += enc(a - pl) + enc(b - pg); pl = a; pg = b; });
  return out;
}
// Małe podglądy (ekran główny, ogłoszenie): statyczny obrazek z Mapbox Static Images, bez ładowania całej mapy
function staticMapUrl(o) {
  const style = mbxStyle().replace('mapbox://styles/', ''); const ov = [];
  const hex = t => hexRgb(cssVar(t)).map(v => v.toString(16).padStart(2, '0')).join('');
  ((o.mb && o.mb.circles) || []).forEach(c => ov.push(`path-2+${hex('cloth')}-0.7+${hex('cloth')}-0.12(${encodeURIComponent(encodePolyline(circlePoly(c.lat, c.lng, c.km, 36)))})`));
  (o.markers || []).slice(0, 12).forEach(m => { const r = realOf(m); ov.push(`pin-s${m.cls === 'ghome-w' ? '-home' : ''}+${m.cls === 'ghome-w' ? hex('glove') : hex('cloth')}(${r.lng.toFixed(5)},${r.lat.toFixed(5)})`); });
  const w = 640, h = Math.round(640 * (o.h || 150) / 350);
  return `https://api.mapbox.com/styles/v1/${style}/static/${ov.join(',')}/auto/${w}x${h}@2x?padding=36&access_token=${encodeURIComponent(S.mbx.token)}`;
}
function mbxMap(id, o) {
  MAPCFG[id] = o;
  if (o.static) return `<img class="mbx-static" style="height:${o.h || 150}px" alt="Mapa okolicy" loading="lazy" src="${esc(staticMapUrl(o))}">`;
  return `<div class="gmap mbx ${o.cls || ''}" id="gm-${id}" data-map="${id}" style="height:${o.h || 320}px">
    <div class="mbx-slot"></div>
    ${o.fixedPin ? `<div class="gm-center"><span class="gm-cpin">${ic('map-pin', 'l')}</span><i></i></div>` : ''}
    <div class="gm-ctl"><button type="button" data-mz="1" aria-label="Przybliż">${ic('plus', 's')}</button><button type="button" data-mz="-1" aria-label="Oddal">${ic('minus', 's')}</button>${o.locate ? `<button type="button" data-mloc aria-label="Wyśrodkuj">${ic('locate-fixed', 's')}</button>` : ''}</div>
    ${o.overlay || ''}
  </div>`;
}
function mbxCenter(cfg) { const c = (cfg.mb && cfg.mb.center) || GEOFIT.toReal(...(cfg.center || [12.5, 13])); return [c.lng, c.lat]; }
function mountMapbox(box) {
  if (!window.mapboxgl) return;
  const id = box.dataset.map, cfg = MAPCFG[id]; if (!cfg) return; let e = MBX[id];
  const zoom = (cfg.mb && cfg.mb.zoom) || zoomFromGrid(cfg.zoom || 13);
  if (!e) {
    const el = document.createElement('div'); el.className = 'mbx-canvas'; box.querySelector('.mbx-slot').appendChild(el);
    const map = new mapboxgl.Map({ container: el, style: mbxStyle(), center: mbxCenter(cfg), zoom, minZoom: 5, maxZoom: 18, maxBounds: [[13.2, 48.6], [24.9, 55.2]], // cała Polska z zapasem
      dragRotate: false, pitchWithRotate: false, touchPitch: false, cooperativeGestures: true, attributionControl: false, locale: MBX_LOCALE, fadeDuration: 150 });
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    e = MBX[id] = { map, el, markers: {}, styleReady: false, style: mbxStyle() };
    map.on('style.load', () => { e.styleReady = true; mbxSync(id); });
    map.on('click', ev => {
      const t = ev.originalEvent && ev.originalEvent.target; if (t && t.closest && t.closest('.mbx-m')) return;
      const c = e.cfg; mapTapAt = Date.now();
      if (c.mb && c.mb.onTapReal) c.mb.onTapReal(ev.lngLat.lat, ev.lngLat.lng);
      else if (c.onTap) { const g = GEOFIT.toGrid(ev.lngLat.lat, ev.lngLat.lng); c.onTap(g.x, g.y); }
    });
    map.on('move', ev => { const c = e.cfg; if (!ev.originalEvent) return; const ct = map.getCenter(); if (c.mb && c.mb.onMoveReal) c.mb.onMoveReal(ct.lat, ct.lng, false); else if (c.onMove) c.onMove(); });
    map.on('moveend', () => { const c = e.cfg; const ct = map.getCenter(); if (c.mb && c.mb.onMoveReal) c.mb.onMoveReal(ct.lat, ct.lng, true); });
    map.on('dragstart', () => e.box && e.box.classList.add('dragging')); map.on('dragend', () => { if (e.box) e.box.classList.remove('dragging'); mapDragAt = Date.now(); });
  } else {
    box.querySelector('.mbx-slot').appendChild(e.el); requestAnimationFrame(() => e.map.resize());
    if (cfg.mb && cfg.mb.recenter) e.map.jumpTo({ center: mbxCenter(cfg), zoom });
  }
  e.cfg = cfg; e.box = box;
  if (cfg.mb && cfg.mb.fit && e.fitKey !== cfg.mb.fitKey) { e.fitKey = cfg.mb.fitKey; const b = cfg.mb.fit; e.map.fitBounds(b, { padding: { top: 30, bottom: 30, left: 30, right: 60 }, duration: e.fittedOnce ? 500 : 0, maxZoom: 15.5 }); e.fittedOnce = true; }
  box.querySelectorAll('[data-mz]').forEach(b => { b.onclick = ev => { ev.stopPropagation(); b.dataset.mz === '1' ? e.map.zoomIn() : e.map.zoomOut(); }; });
  const loc = box.querySelector('[data-mloc]'); if (loc) loc.onclick = ev => { ev.stopPropagation(); e.map.flyTo({ center: mbxCenter(e.cfg), zoom, essential: true }); };
  mbxSync(id);
}
const fcol = features => ({ type: 'FeatureCollection', features });
function setSource(map, id, data) { const src = map.getSource(id); if (src) src.setData(data); else map.addSource(id, { type: 'geojson', data }); }
function ensureLayer(map, def, before) { if (!map.getLayer(def.id)) map.addLayer(def, before); }
function mbxSync(id) {
  const e = MBX[id]; if (!e || !e.styleReady) return;
  const map = e.map, c = e.cfg, mb = c.mb || {};
  const firstSymbol = (map.getStyle().layers.find(l => l.type === 'symbol') || {}).id;
  // mapa cieplna: gdzie szukają klienci
  setSource(map, 'lsni-heat', fcol((mb.heat || []).map(h => ({ type: 'Feature', properties: { n: h.n }, geometry: { type: 'Point', coordinates: [h.lng, h.lat] } }))));
  ensureLayer(map, { id: 'lsni-heat', type: 'heatmap', source: 'lsni-heat', paint: { 'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 1, 0.4, 10, 1], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 12, 28],
    'heatmap-opacity': 0.7, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, cssVar('glove'), 1, cssVar('rose')] } }, firstSymbol);
  // zasięgi wykonawców
  const circles = (mb.circles || []).map(ci => ({ type: 'Feature', properties: { kind: ci.kind || 'reach' }, geometry: { type: 'Polygon', coordinates: [circlePoly(ci.lat, ci.lng, ci.km)] } }));
  setSource(map, 'lsni-circles', fcol(circles));
  ensureLayer(map, { id: 'lsni-circles-fill', type: 'fill', source: 'lsni-circles', filter: ['!=', ['get', 'kind'], 'fee'], paint: { 'fill-color': cssVar('cloth'), 'fill-opacity': 0.12 } }, firstSymbol);
  ensureLayer(map, { id: 'lsni-circles-line', type: 'line', source: 'lsni-circles', paint: { 'line-color': ['case', ['==', ['get', 'kind'], 'fee'], cssVar('sand'), cssVar('cloth')], 'line-width': 2, 'line-dasharray': ['case', ['==', ['get', 'kind'], 'fee'], ['literal', [2, 2]], ['literal', [1, 0]]] } });
  // obszar wyszukiwania
  const b = mb.bounds; setSource(map, 'lsni-bounds', fcol(b ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] } }] : []));
  ensureLayer(map, { id: 'lsni-bounds-line', type: 'line', source: 'lsni-bounds', paint: { 'line-color': cssVar('ink'), 'line-width': 2, 'line-dasharray': [2, 2] } });
  // trasa
  setSource(map, 'lsni-route', fcol(mb.route ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: mb.route } }] : []));
  setSource(map, 'lsni-route-done', fcol(mb.routeDone && mb.routeDone.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: mb.routeDone } }] : []));
  ensureLayer(map, { id: 'lsni-route-casing', type: 'line', source: 'lsni-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': cssVar('surface'), 'line-width': 8 } });
  ensureLayer(map, { id: 'lsni-route-line', type: 'line', source: 'lsni-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': cssVar('ink-3'), 'line-width': 4 } });
  ensureLayer(map, { id: 'lsni-route-done', type: 'line', source: 'lsni-route-done', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': cssVar('cloth'), 'line-width': 5 } });
  // pinezki (HTML w stylu aplikacji)
  Object.values(e.markers).forEach(m => m.remove()); e.markers = {};
  (c.markers || []).forEach((m, i) => {
    const r = realOf(m); const el = document.createElement(m.act ? 'button' : 'div');
    el.className = 'mbx-m ' + (m.cls || ''); if (m.act) { el.type = 'button'; el.dataset.act = m.act; el.dataset.a = m.a || ''; el.setAttribute('aria-label', m.label || ''); }
    el.innerHTML = m.html;
    e.markers[m.id || 'm' + i] = new mapboxgl.Marker({ element: el, anchor: m.bottom ? 'bottom' : 'center' }).setLngLat([r.lng, r.lat]).addTo(map);
  });
}
function mbxRestyle() { Object.values(MBX).forEach(e => { const st = mbxStyle(); if (e.style !== st) { e.style = st; e.styleReady = false; e.map.setStyle(st, { diff: false }); } }); }
async function loadMapbox() {
  let cfg; try { cfg = await window.LsniAPI.call('GET', '/api/config'); } catch (e) { return false; }
  if (!cfg.mapbox) return false;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = cfg.mapbox.css; document.head.appendChild(css);
  const ok = await new Promise(res => { const sc = document.createElement('script'); sc.src = cfg.mapbox.js; sc.onload = () => res(true); sc.onerror = () => res(false); document.head.appendChild(sc); setTimeout(() => res(!!window.mapboxgl), 8000); });
  if (!ok || !window.mapboxgl || !mapboxgl.supported || (mapboxgl.supported && !mapboxgl.supported())) return false;
  mapboxgl.accessToken = cfg.mapbox.token;
  S.mbx = cfg.mapbox;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { mbxRestyle(); render(); });
  return true;
}
const mapInst = id => { const el = document.getElementById('gm-' + id); return el && el._m; };
const fitView = (pts, w = 340, h = 240) => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const sx = Math.max(...xs) - Math.min(...xs) + 2.4, sy = Math.max(...ys) - Math.min(...ys) + 2.4; return { center: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2], zoom: Math.min(60, Math.min(w / sx, h / sy)) }; };
const meMark = a => ({ x: a.x, y: a.y, lat: a.lat, lng: a.lng, cls: 'gme-w', html: `<span class="gme"><i></i></span>` });
const homeMark = (a, label) => ({ x: a.x, y: a.y, lat: a.lat, lng: a.lng, bottom: true, cls: 'ghome-w', html: `<span class="ghome">${ic('house', 'xs')}${label ? `<b>${esc(label)}</b>` : ''}</span>` });
const proPin = (p, on, i = 0, act = 'mapSel') => ({ x: p.x, y: p.y, lat: p.lat, lng: p.lng, bottom: true, act, a: p.id, label: p.name, html: `<span class="gpin ${on ? 'on' : ''} ${p.reach === 'out' ? 'far' : ''} ${p._promoted ? 'promo' : ''}" style="animation-delay:${i * 60}ms"><span class="avatar ${p.tone}">${esc(p.ini)}</span><b>${p.fixed || p.perWindow ? 'od ' + (p.perWindow || p.rate) : p.rate} zł</b></span>` });
const circleSVG = (x, y, r, cls = '', id = '') => `<circle ${id ? `id="${id}"` : ''} class="${cls}" cx="${x * U}" cy="${y * U}" r="${r * U}"/>`;


const EXTRAS = [
  { id: 'lodowka', name: 'Wnętrze lodówki', icon: 'refrigerator', h: 0.5 },
  { id: 'piekarnik', name: 'Piekarnik', icon: 'flame', h: 0.75 },
  { id: 'okna', name: 'Okna (do 4 szt.)', icon: 'app-window', h: 1 },
  { id: 'szafki', name: 'Szafki w środku', icon: 'package-open', h: 1 },
  { id: 'balkon', name: 'Balkon / taras', icon: 'flower-2', h: 0.5 },
  { id: 'prasowanie', name: 'Prasowanie 1 h', icon: 'shirt', h: 1 }
];
const FREQ = [
  { id: 'once', name: 'Jednorazowo', sub: 'bez zobowiązań', disc: 0 },
  { id: 'week', name: 'Co tydzień', sub: 'ten sam wykonawca', disc: 0.15 },
  { id: 'biweek', name: 'Co 2 tygodnie', sub: 'najczęściej wybierane', disc: 0.10 },
  { id: 'month', name: 'Co miesiąc', sub: 'odwołasz kiedy chcesz', disc: 0.05 }
];
const SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
const SERVICE_FEE = 0; // klient nic nie płaci w aplikacji, rozlicza się z wykonawcą na miejscu

function slotTaken(proId, dayIdx, slot) {
  let h = 0; const s = proId + dayIdx + slot;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  if (dayIdx === 0) { const hr = parseInt(slot, 10); if (hr <= new Date().getHours() + 1) return true; }
  return h % 3 === 0;
}

function estimate(b, pro) {
  const svcMul = b.service === 'generalne' ? 1.5 : b.service === 'remont' ? 2 : 1;
  let base = (b.m2 / 22 + (b.baths - 1) * 0.5 + Math.max(0, b.rooms - 2) * 0.25) * svcMul;
  let extraH = b.extras.reduce((a, id) => a + (EXTRAS.find(e => e.id === id) || { h: 0 }).h, 0);
  let h = Math.max(pro.minH, Math.ceil((base + extraH) * 2) / 2);
  const work = h * pro.rate;
  const disc = (FREQ.find(f => f.id === b.freq) || FREQ[0]).disc;
  const discount = work * disc;
  const ownSupplies = b.supplies === 'pro' && pro.supplies ? 0 : 0;
  const rf = reachFor(pro, addrById(b.addr) || curAddr()); const travel = rf.fee;
  const total = work - discount + SERVICE_FEE + ownSupplies + travel;
  return { h, baseH: Math.max(0, h - extraH), extraH, work, disc, discount, total, travel, km: rf.d, reach: rf.reach };
}

function seed() {
  return {
    role: 'client', tab: 'home', stacks: {},
    favs: ['marta', 'olena'],
    filters: { cat: null, q: '', maxPrice: 100, minRating: 0, verified: false, insured: false, supplies: false, eco: false, pets: false, invoice: false, today: false, sort: 'rec', maxDist: 15, far: false, district: null, bounds: null },
    addresses: [
      { id: 'home', label: 'Dom', street: 'ul. Puławska 112/14', x: 13.2, y: 15.8, note: '4 piętro, winda' },
      { id: 'mama', label: 'Mieszkanie mamy', street: 'ul. Odyńca 27/3', x: 12.6, y: 17.4, note: 'parter' },
      { id: 'office', label: 'Biuro', street: 'Rondo Daszyńskiego 2', x: 9.4, y: 10.4, note: 'recepcja, 12 piętro' }
    ],
    addrId: 'home', maps: {}, exploreLayer: 'pros', waitlist: [],
    notifs: [
      { id: 'n1', icon: 'bell-ring', t: 'Przypomnienie: jutro 10:00', d: 'Marta Kowalczyk · Mieszkanie i dom. Przygotuj kod do domofonu.', at: '18:00', read: false, act: 'openOrder', a: 'o1' },
      { id: 'n2', icon: 'badge-check', t: 'Rezerwacja potwierdzona', d: 'Marta Kowalczyk przyjęła wizytę na jutro, 10:00.', at: 'wczoraj', read: false, act: 'openOrder', a: 'o1' },
      { id: 'n3', icon: 'star', t: 'Jak było po remoncie?', d: 'Oceń Czysto & Basta. Twoja opinia pomoże innym.', at: '3 lis', read: true, act: 'openOrder', a: 'o2' }
    ],
    notifPrefs: { push: true, sms: true, email: false },
    ordersSeg: 'up',
    orders: [
      { id: 'o1', pro: 'marta', service: 'dom', date: 1, time: '10:00', h: 3.5, m2: 54, total: 133.88, freq: 'biweek', status: 'confirmed', extras: ['lodowka'], addr: 'ul. Puławska 112/14', pay: 'Gotówka' },
      { id: 'o2', pro: 'czysto', service: 'remont', date: -20, time: '08:00', h: 5, m2: 54, total: 299.99, freq: 'once', status: 'done', rated: false, extras: ['szafki'], addr: 'ul. Puławska 112/14', pay: 'Przelew' },
      { id: 'o3', pro: 'olena', service: 'prasowanie', date: -34, time: '16:00', h: 2, m2: 0, total: 88.99, freq: 'once', status: 'done', rated: 5, extras: [], addr: 'ul. Puławska 112/14', pay: 'BLIK na telefon' }
    ],
    threads: {
      marta: { unread: 1, msgs: [
        { me: false, t: 'Dzień dobry! Potwierdzam jutro o 10:00. Czy w budynku jest winda?', at: '18:02' },
        { me: true, t: 'Dzień dobry, tak, winda jest. Kod do domofonu wyślę rano.', at: '18:10' },
        { me: false, t: 'Super, dziękuję. Biorę odkurzacz i środki do kamienia do łazienki.', at: '18:11' }
      ] },
      czysto: { unread: 0, msgs: [
        { me: false, t: 'Dziękujemy za zlecenie. Faktura jest w zakładce Zlecenia.', at: '3 lis' }
      ] }
    },
    booking: null,
    posts: [],
    draft: null,
    offerSort: 'rec',
    rate: { stars: 5, tags: [], tip: 0, comment: '' },
    // tryb wykonawcy
    pro: {
      online: true,
      requests: [
        { id: 'r1', x: 12.9, y: 15.4, client: 'Tomasz', crating: 4.9, service: 'dom', m2: 54, rooms: 2, baths: 1, day: 2, time: '10:00', h: 3.5, pay: 157.5, dist: 1.8, area: 'ul. Puławska 80, Warszawa', note: 'Mam psa, jest przyjazny. Najważniejsza kuchnia i łazienka.', freq: 'biweek', expires: 42 },
        { id: 'r2', x: 13.6, y: 10.2, client: 'Joanna', crating: 5.0, service: 'najem', m2: 38, rooms: 1, baths: 1, day: 1, time: '12:00', h: 2.5, pay: 112.5, dist: 3.1, area: 'ul. Kopernika 30, Warszawa', note: 'Między gośćmi: pościel w szafie, raport zdjęciowy po sprzątaniu.', freq: 'week', expires: 18 },
        { id: 'r3', x: 9.4, y: 10.4, client: 'Firma Kwadrat', crating: 4.7, service: 'biuro', m2: 120, rooms: 4, baths: 2, day: 4, time: '18:00', h: 5, pay: 225, dist: 5.6, area: 'Rondo Daszyńskiego 2, Warszawa', note: 'Po godzinach pracy. Potrzebna faktura.', freq: 'week', expires: 95 }
      ],
      jobs: [
        { day: 0, time: '09:00', end: '11:30', thread: 'marek', client: 'Pan Marek', service: 'dom', area: 'ul. Rakowiecka 21', pay: 112.5, tone: 'y', x: 12.2, y: 14.6 },
        { day: 0, time: '14:00', end: '17:00', thread: 'ewa', client: 'Ewa M.', service: 'dom', area: 'al. KEN 51', pay: 135, tone: '', x: 11.8, y: 21.6 },
        { day: 1, time: '09:00', end: '12:00', client: 'Krzysztof', service: 'generalne', area: 'ul. Belwederska 9', pay: 202.5, tone: 'y', x: 12.4, y: 15 },
        { day: 1, time: '13:30', end: '16:00', client: 'Basia', service: 'dom', area: 'ul. Grójecka 40', pay: 112.5, tone: 'm', x: 9.6, y: 14 },
        { day: 3, time: '10:00', end: '13:30', client: 'Ania K.', service: 'dom', area: 'ul. Wiertnicza 12', pay: 157.5, tone: 'm', x: 15.6, y: 20.8 }
      ],
      market: [
        { id: 'm1', x: 12.2, y: 16.8, client: 'Paulina', crating: 4.8, cat: 'remont', desc: 'Mieszkanie po malowaniu i wymianie paneli. Dużo pyłu, również w szafkach kuchennych. 2 pokoje, kuchnia, łazienka.', m2: 48, when: 'w tym tygodniu, elastycznie', dist: 2.4, area: 'Mokotów, Wierzbno', offers: 4, budget: 400, photos: 3, sent: 0 },
        { id: 'm2', x: 9.2, y: 13.6, client: 'Marek', crating: 5.0, cat: 'okna', desc: '8 okien dwuskrzydłowych i drzwi balkonowe. 3 piętro, bez windy. Rolety do umycia.', m2: 0, when: 'sobota, od 9:00', dist: 4.1, area: 'Ochota, Szczęśliwice', offers: 2, budget: 0, photos: 1, sent: 0 }
      ],
      offerDraft: null,
      threads: {
        tomasz: { name: 'Tomasz', ini: 'T', tone: 't-blue', unread: 1, msgs: [{ me: false, t: 'Dzień dobry, czy da się w sobotę o 10? Mam psa, ale jest przyjazny.', at: '12:40' }] },
        ewa: { name: 'Ewa M.', ini: 'EM', tone: 't-mint', unread: 0, msgs: [{ me: true, t: 'Dzień dobry, będę dziś o 14:00.', at: '9:10' }, { me: false, t: 'Super, klucz zostawię u portiera.', at: '9:12' }] },
        marek: { name: 'Pan Marek', ini: 'PM', tone: 't-sand', unread: 0, msgs: [{ me: false, t: 'Domofon nie działa, proszę zadzwonić na telefon w aplikacji.', at: 'wczoraj' }] }
      },
      boost: { credit: 110, history: [{ t: 'Kredyt na start', v: 50 }, { t: '3 klientów z Twojego linku', v: 60 }],
        active: [{ area: '13 km od: Warszawa', days: 3, left: 2, views: 61, opens: 9, req: 2, goal: 122 }], draft: { days: 7 },
        invite: { link: 'lsni.pl/ola-zielinska', joined: 3, earned: 60 } },
      avail: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false },
      calDay: 0,
      listing: {
        name: 'Ola Zielińska', tagline: 'Dokładne sprzątanie mieszkań, ekologiczne środki',
        services: ['dom', 'generalne'], rate: 45, minH: 3, base: { x: 12.8, y: 16.8 }, baseLabel: '', radius: 13, kmOn: true, kmRate: 2, freeKm: 5,
        supplies: true, eco: true, pets: true, invoice: false, langs: ['PL', 'EN'],
        bio: 'Sprzątam od 3 lat. Pracuję według checklisty pokój po pokoju, przynoszę własne środki.', photos: [],
        idVerified: true, insured: false, published: true
      }
    }
  };
}

let baseQT = null;
let S = Object.assign(seed(), store.get('state3', {})); // state3: zasięg od bazy zamiast dzielnic i miast
// zawsze zaczynaj od świeżych stosów nawigacji
S.stacks = {}; S.sheet = null;
// stan zapisany przez starszą wersję makiety może nie mieć nowych pól
(() => {
  const d = seed(); S.posts ||= []; S.pro = Object.assign(d.pro, S.pro); S.pro.market ||= d.pro.market; S.offerSort ||= 'rec';
  S.filters = Object.assign(d.filters, S.filters); S.addresses ||= d.addresses; S.addrId ||= 'home'; S.maps ||= {}; S.exploreLayer ||= 'pros';
  S.pro.boost ||= d.pro.boost; S.pro.threads ||= d.pro.threads; S.notifs ||= d.notifs; S.notifPrefs ||= d.notifPrefs; S.waitlist ||= [];
  S.pro.listing = Object.assign(d.pro.listing, S.pro.listing);
  if (!S.pro.jobs.every(j => 'x' in j)) S.pro.jobs = d.pro.jobs; if (!S.pro.requests.every(r => 'x' in r)) S.pro.requests = d.pro.requests; if (!S.pro.market.every(m => 'x' in m)) S.pro.market = d.pro.market;
})();
updateGeo();
const persist = () => {
  if (S.online) return; // w trybie online dane są na serwerze; nie nadpisujemy danych demo
  const { sheet, stacks, booking, ...rest } = S;
  store.set('state3', rest);
};

/* ================= navigation ================= */
const TABS = {
  client: [
    { id: 'home', label: 'Odkrywaj', icon: 'compass' },
    { id: 'orders', label: 'Zlecenia', icon: 'calendar-check' },
    { id: 'inbox', label: 'Wiadomości', icon: 'message-circle' },
    { id: 'profile', label: 'Profil', icon: 'user-round' }
  ],
  pro: [
    { id: 'dash', label: 'Panel', icon: 'layout-dashboard' },
    { id: 'calendar', label: 'Grafik', icon: 'calendar-days' },
    { id: 'listing', label: 'Ogłoszenie', icon: 'megaphone' },
    { id: 'inbox', label: 'Wiadomości', icon: 'message-circle' },
    { id: 'profile', label: 'Profil', icon: 'user-round' }
  ]
};
const stackKey = () => S.role + ':' + S.tab;
const stack = () => (S.stacks[stackKey()] ||= [{ name: S.tab }]);
const top = () => stack()[stack().length - 1];
let anim = ''; let popHeart = null;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };
const canVT = () => !!document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
function nav(kind, mutate) {
  if (canVT() && !navBusy) {
    navBusy = true; document.documentElement.dataset.nav = kind;
    const t = document.startViewTransition(() => { mutate(); anim = ''; render(); });
    t.finished.finally(() => { navBusy = false; delete document.documentElement.dataset.nav; });
  } else { mutate(); anim = kind === 'fwd' ? 'enter' : 'fade'; render(); }
}
let navBusy = false;
function go(name, p = {}) { nav('fwd', () => { stack().push({ name, p }); S.sheet = null; }); }
function back() { if (stack().length > 1) nav('back', () => { stack().pop(); }); }
function setTab(t) { nav('tab', () => { if (S.tab === t) { S.stacks[stackKey()] = [{ name: t }]; } S.tab = t; }); }
function replace(name, p = {}) { stack()[stack().length - 1] = { name, p }; anim = 'fade'; render(); }

let toastTimer;
function toast(msg, icon = 'check', undo) {
  clearTimeout(toastTimer);
  $toast.innerHTML = `<div class="t">${ic(icon, 's')}<span>${esc(msg)}</span>${undo ? `<button data-act="${undo}">Cofnij</button>` : ''}</div>`;
  toastTimer = setTimeout(() => { $toast.innerHTML = ''; }, 3200);
}
// statyczne <i data-lucide> z HTML-a (panel boczny, pasek statusu) zamieniamy raz na SVG
function icons(root) { if (!root) return; root.querySelectorAll('i[data-lucide]').forEach(el => { el.outerHTML = ic(el.dataset.lucide, el.getAttribute('class').replace(/\bic\b/, '')); }); }

/* ================= shared components ================= */
const avatar = (p, cls = '') => `<div class="avatar ${p.tone} ${cls}">${esc(p.ini)}</div>`;
const stars = r => `<span class="rating">${ic('star', 'xs star')}${r.toFixed(2).replace('.', ',')}</span>`;
const heart = id => `<button class="heartbtn ${S.favs.includes(id) ? 'on' : ''} ${popHeart === id ? 'pop' : ''}" data-act="fav" data-a="${id}" aria-label="Ulubione">${ic('heart', 's')}</button>`;
const priceLabel = p => p.fixed ? `od ${p.rate} zł <small>/ kanapa</small>` : p.perWindow ? `od ${p.perWindow} zł <small>/ okno</small>` : `${p.rate} zł <small>/ h</small>`;
const backBtn = (ghost) => `<button class="iconbtn ${ghost ? 'ghost' : ''}" data-act="back" aria-label="Wróć">${ic('chevron-left')}</button>`;
const topbar = (title, right = '') => `<div class="topbar">${backBtn()}<h2>${title}</h2>${right}</div>`;

function proCard(p) {
  const feats = [];
  if (p.supplies) feats.push(`<span class="tag">${ic('spray-can', 'xs')}Własne środki</span>`);
  if (p.eco) feats.push(`<span class="tag mint">${ic('leaf', 'xs')}Eco</span>`);
  if (p.invoice) feats.push(`<span class="tag blue">${ic('receipt', 'xs')}Faktura</span>`);
  if (p.insured) feats.push(`<span class="tag">${ic('shield-check', 'xs')}OC</span>`);
  return `<div class="pcard" role="button" tabindex="0" data-act="openPro" data-a="${p.id}">
    ${avatar(p).replace('<div class="avatar', `<div style="view-transition-name:av-${p.id}" class="avatar`)}
    <div class="grow">
      <div class="row between" style="gap:8px;align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:5px"><span class="name">${esc(p.name)}</span>${p.verified ? ic('badge-check', 'verified') : ''}</div>
          <div class="tiny faint">${stars(p.rating)} <span>(${p.reviews})</span> · ${p.area}${p.dist ? ` · ${kmf(p.dist)} km · ${p.eta} min` : ''}</div>
        </div>
        ${heart(p.id)}
      </div>
      <div class="small muted mt8" style="line-height:1.35">${esc(p.tagline)}</div>
      ${p._promoted ? `<button class="promo-tag" data-act="sheet" data-a="ranking">Promowane ${ic('info', 'xs')}</button>` : ''}
      <div class="meta">${p.reach === 'in' && p.travelFee ? `<span class="tag yellow">${ic('car', 'xs')}Dojazd +${p.travelFee} zł</span>` : p.reach === 'out' ? `<span class="tag rose">${ic('map-pin-off', 'xs')}Poza zasięgiem</span>` : ''}${feats.slice(0, p.reach === 'out' || p.travelFee ? 2 : 3).join('')}</div>
      <div class="row between mt12">
        <span class="price">${priceLabel(p)}</span>
        <span class="${p.todayFree ? 'free' : 'tiny faint'}">${p.todayFree ? '' : 'Najbliżej: '}${p.nextSlot}</span>
      </div>
    </div>
  </div>`;
}

/* ================= ILUSTRACJE (własne, rysowane w SVG, kolory z tokenów motywu) ================= */
const spark = (x, y, r, f) => `<path d="M${x} ${y - r}C${x + r * .18} ${y - r * .18} ${x + r * .18} ${y - r * .18} ${x + r} ${y}C${x + r * .18} ${y + r * .18} ${x + r * .18} ${y + r * .18} ${x} ${y + r}C${x - r * .18} ${y + r * .18} ${x - r * .18} ${y + r * .18} ${x - r} ${y}C${x - r * .18} ${y - r * .18} ${x - r * .18} ${y - r * .18} ${x} ${y - r}Z" fill="var(--${f})"/>`;
const ILLO = {
  dom: `<path d="M11 31 32 14l21 17v24H11z" fill="var(--glove)"/><path d="M6 33 32 11l26 22" fill="none" stroke="var(--ink)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="39" width="12" height="16" rx="2" fill="var(--ink)"/><rect x="15" y="35" width="8" height="8" rx="1.5" fill="var(--surface)"/><rect x="41" y="35" width="8" height="8" rx="1.5" fill="var(--surface)"/>${spark(52, 9, 6, 'cloth')}`,
  generalne: `<path d="M21 29h20l4 8v19a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3V37z" fill="var(--cloth)"/><rect x="23" y="40" width="17" height="11" rx="2" fill="var(--surface)"/><path d="M26 44h11M26 47.5h7" stroke="var(--cloth)" stroke-width="1.6" stroke-linecap="round"/><rect x="26" y="21" width="10" height="9" rx="1" fill="var(--ink)"/><path d="M21 12h21l4 7H22z" fill="var(--ink)"/><rect x="44" y="13" width="7" height="4" rx="1" fill="var(--ink)"/><path d="M29 21q-7 2-9 9" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><circle cx="56" cy="12" r="2.2" fill="var(--cloth)"/><circle cx="59" cy="18" r="1.6" fill="var(--cloth)"/><circle cx="57" cy="6" r="1.3" fill="var(--cloth)"/>${spark(10, 20, 5, 'glove')}`,
  remont: `<circle cx="14" cy="49" r="7" fill="var(--surface)"/><circle cx="22" cy="53" r="5" fill="var(--surface)"/><circle cx="50" cy="51" r="4.5" fill="var(--surface)"/><rect x="10" y="9" width="34" height="15" rx="6" fill="var(--glove)"/><path d="M15 13v7" stroke="var(--surface)" stroke-width="2.5" stroke-linecap="round" opacity=".7"/><path d="M44 16.5h7v13H33v8" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/><rect x="29" y="36" width="8" height="21" rx="3" fill="var(--ink)"/>`,
  okna: `<rect x="9" y="9" width="40" height="46" rx="3" fill="var(--ink)"/><rect x="13" y="13" width="15" height="18" fill="var(--cloth-soft)"/><rect x="30" y="13" width="15" height="18" fill="var(--cloth-soft)"/><rect x="13" y="33" width="15" height="18" fill="var(--cloth-soft)"/><rect x="30" y="33" width="15" height="18" fill="var(--cloth-soft)"/><path d="M15 29q14-15 28-3" fill="none" stroke="var(--surface)" stroke-width="4" stroke-linecap="round"/><g transform="rotate(-32 47 45)"><rect x="34" y="39" width="26" height="6" rx="2" fill="var(--mint)"/><rect x="44.5" y="44" width="5" height="16" rx="2.5" fill="var(--ink)"/></g>`,
  tapicerka: `<rect x="13" y="19" width="38" height="18" rx="6" fill="var(--lilac)"/><rect x="9" y="33" width="46" height="13" rx="5" fill="var(--lilac)"/><path d="M32 21v12" stroke="var(--surface)" stroke-width="2" stroke-linecap="round" opacity=".6"/><rect x="5" y="27" width="10" height="21" rx="5" fill="var(--ink)"/><rect x="49" y="27" width="10" height="21" rx="5" fill="var(--ink)"/><rect x="12" y="47" width="4" height="6" rx="1" fill="var(--ink)"/><rect x="48" y="47" width="4" height="6" rx="1" fill="var(--ink)"/><circle cx="49" cy="10" r="5" fill="var(--surface)" stroke="var(--cloth)" stroke-width="2"/><circle cx="40" cy="6" r="2.8" fill="var(--surface)" stroke="var(--cloth)" stroke-width="1.6"/><circle cx="57" cy="18" r="2.2" fill="var(--surface)" stroke="var(--cloth)" stroke-width="1.4"/>`,
  biuro: `<rect x="15" y="9" width="34" height="48" rx="2" fill="var(--cloth)"/>${[0, 1, 2].map(c => [0, 1, 2, 3].map(r => `<rect x="${20 + c * 9}" y="${14 + r * 9}" width="6" height="5" rx="1" fill="var(--surface)"/>`).join('')).join('')}<rect x="27" y="49" width="10" height="8" fill="var(--ink)"/><path d="M8 57h48" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>${spark(54, 12, 5, 'glove')}`,
  najem: `<rect x="7" y="17" width="8" height="32" rx="2" fill="var(--ink)"/><rect x="12" y="32" width="45" height="12" rx="3" fill="var(--surface)"/><rect x="16" y="26" width="13" height="8" rx="3.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/><path d="M30 30h27v14H30z" fill="var(--rose)"/><rect x="7" y="44" width="52" height="5" rx="2" fill="var(--ink)"/><circle cx="48" cy="13" r="5.5" fill="none" stroke="var(--glove)" stroke-width="3"/><path d="M43.5 17 34 25.5m4-3.5 2.5 2.8m1-6.2 2.5 2.8" fill="none" stroke="var(--glove)" stroke-width="3" stroke-linecap="round"/>`,
  prasowanie: `<path class="steam" d="M17 22q4-4 0-8t0-8M25 22q4-4 0-8t0-8" fill="none" stroke="var(--cloth)" stroke-width="2.4" stroke-linecap="round"/><path d="M8 47q2-19 21-21h19q5 0 5 5v16z" fill="var(--mint)"/><path d="M23 26q2-10 12-10h13q4 0 4 4v7" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/><rect x="6" y="46" width="50" height="6" rx="2" fill="var(--ink)"/><circle cx="38" cy="38" r="4" fill="var(--surface)"/>`
};
const illo = (id, cls = '') => { const art = ILLO[id] || ILLO.dom; const shadow = art.replace(/(fill|stroke)="var\(--[a-z-]+\)"/g, '$1="var(--ink)"'); return `<svg class="illo ${cls}" viewBox="0 0 64 64" aria-hidden="true"><g transform="translate(2.2 2.6)" opacity=".13">${shadow}</g>${art}</svg>`; };

/* pora dnia: powitanie, nagłówek i panorama za szybą zmieniają się z zegarem */
const DAYPARTS = { morning: { hello: 'Dzień dobry', icon: 'sunrise', when: 'dziś', sky: ['#FFC9A0', '#FFE9D2', '#FDF6EC'], bld: '#3E4A66', sun: [62, 70, 18, '#FFB347'] },
  day: { hello: 'Dzień dobry', icon: 'sun', when: 'dziś', sky: ['#8EC5FF', '#CFE6FF', '#EEF6FF'], bld: '#1D2840', sun: [268, 34, 16, '#FFC72C'] },
  evening: { hello: 'Dobry wieczór', icon: 'sunset', when: 'jutro', sky: ['#5B3F8C', '#E0708A', '#FFB37A'], bld: '#24183A', sun: [250, 86, 26, '#FF7A45'] },
  night: { hello: 'Dobry wieczór', icon: 'moon', when: 'jutro', sky: ['#060B1E', '#13224A', '#26386A'], bld: '#050913', sun: null } };
function daypart() { if (S.daypart && S.daypart !== 'auto') return S.daypart; const h = new Date().getHours(); return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night'; }
function skyline() {
  const dpk = daypart(), D = DAYPARTS[dpk]; const lit = dpk === 'night' || dpk === 'evening';
  const b = [[0, 22, 28], [24, 16, 40], [42, 26, 22], [88, 20, 34], [112, 30, 24], [146, 18, 46], [250, 22, 36], [274, 16, 54], [292, 28, 26]];
  let seed = 3; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const windows = lit ? b.map(([x, w, h]) => { let o = ''; for (let yy = 90 - h + 4; yy < 86; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (rnd() < (dpk === 'night' ? .32 : .18)) o += `<rect x="${xx}" y="${yy}" width="2.2" height="2.6" fill="#FFD66B" opacity="${.6 + rnd() * .4}"/>`; return o; }).join('') + `<rect x="209" y="-2" width="2" height="2" fill="#FF5A5A"><animate attributeName="opacity" values="1;.1;1" dur="1.6s" repeatCount="indefinite"/></rect>` : '';
  const stars = dpk === 'night' ? Array.from({ length: 26 }, () => `<circle cx="${(rnd() * 320).toFixed(0)}" cy="${(rnd() * 60).toFixed(0)}" r="${(.4 + rnd() * .9).toFixed(1)}" fill="#fff" opacity="${(.4 + rnd() * .6).toFixed(2)}"/>`).join('') : '';
  const sun = D.sun ? `<circle cx="${D.sun[0]}" cy="${D.sun[1]}" r="${D.sun[2]}" fill="${D.sun[3]}"/>${dpk === 'evening' ? `<circle cx="${D.sun[0]}" cy="${D.sun[1]}" r="${D.sun[2] + 12}" fill="${D.sun[3]}" opacity=".18"/>` : ''}`
    : `<circle cx="262" cy="30" r="12" fill="#F3EFD8"/><circle cx="268" cy="26" r="11" fill="${D.sky[1]}"/>`;
  const clouds = dpk === 'night' ? '' : `<path d="M30 40q10-8 22 0q8-6 16 2" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="${dpk === 'evening' ? .35 : .8}"/><path d="M150 26q7-6 15 0q6-4 11 1" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="${dpk === 'evening' ? .25 : .6}"/>`;
  return `<svg class="sky" viewBox="0 0 320 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1">${D.sky.map((c, i) => `<stop offset="${i / (D.sky.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
    <rect width="320" height="120" fill="url(#skyg)"/>${stars}${sun}${clouds}
    <g fill="${D.bld}" transform="translate(0 30)">${b.map(([x, w, h]) => `<rect x="${x}" y="${90 - h}" width="${w}" height="${h}"/>`).join('')}
      <path d="M70 90V40l14-8v58z"/><path d="M180 90V66h8V54h7V42h5V30h4V20h3v-8h2.2V0h1.6v12H213v8h3v10h4v12h5v12h7v12h8v24z"/></g>
    <g transform="translate(0 30)">${windows}</g></svg>`;
}

/* bańki mydlane do przekłuwania (canvas) */
function initBubbles() {
  const c = document.getElementById('bubbles'); if (!c || c.dataset.ready) return; c.dataset.ready = '1';
  const host = c.parentElement; const dpr = Math.min(2, devicePixelRatio || 1);
  const fit = () => { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; }; fit();
  const g = c.getContext('2d'); const W = () => c.clientWidth, H = () => c.clientHeight;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mk = (y) => ({ x: Math.random() * W(), y: y ?? H() + 40, r: 10 + Math.random() * 26, vy: .35 + Math.random() * .8, ph: Math.random() * 6, hue: Math.random() * 360 });
  const bs = Array.from({ length: 12 }, () => mk(H() * (.3 + Math.random() * .9))); const drops = []; let popped = 0;
  const draw = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W(), H());
    bs.forEach(b => {
      const gr = g.createRadialGradient(b.x - b.r * .3, b.y - b.r * .3, b.r * .1, b.x, b.y, b.r);
      gr.addColorStop(0, `hsla(${b.hue},90%,85%,.04)`); gr.addColorStop(.7, `hsla(${b.hue},85%,70%,.12)`); gr.addColorStop(.88, `hsla(${b.hue + 60},85%,62%,.5)`); gr.addColorStop(1, `hsla(${b.hue + 140},85%,70%,.85)`);
      g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(b.x - b.r * .38, b.y - b.r * .42, b.r * .18, b.r * .09, -.7, 0, 7); g.fill();
    });
    drops.forEach(d => { g.fillStyle = `hsla(${d.hue},80%,70%,${d.a})`; g.beginPath(); g.arc(d.x, d.y, 2, 0, 7); g.fill(); });
  };
  const step = () => {
    if (!c.isConnected) return;
    bs.forEach(b => { b.y -= b.vy; b.ph += .03; b.x += Math.sin(b.ph) * .35; b.hue += .4; if (b.y < -b.r - 10) Object.assign(b, mk()); });
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.x += d.vx; d.y += d.vy; d.vy += .12; d.a -= .03; if (d.a <= 0) drops.splice(i, 1); }
    draw(); requestAnimationFrame(step);
  };
  host.addEventListener('pointerdown', e => {
    const r = c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    const i = bs.findIndex(b => Math.hypot(b.x - x, b.y - y) < b.r + 6); if (i < 0) return;
    const b = bs[i]; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; drops.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2 - 1, a: 1, hue: b.hue + k * 20 }); }
    bs[i] = mk(); buzz(10); popped++; if (popped === 7) toast('Siedem baniek. Czysta robota', 'sparkles'); if (still) draw();
  });
  if (still) draw(); else step();
}

/* przed / po: ta sama kuchnia, raz zapuszczona, raz po wizycie */
function kitchen(dirty) {
  const tiles = Array.from({ length: 16 }, (_, i) => `<path d="M${i * 20} 60v50" />`).join('') + [80, 100].map(y => `<path d="M0 ${y}h320"/>`).join('');
  const clean = `${spark(70, 74, 7, 'glove')}${spark(188, 92, 5, 'cloth')}${spark(292, 140, 6, 'glove')}${spark(250, 30, 4, 'surface')}`;
  const dirt = `<rect width="320" height="180" fill="var(--grime)" opacity=".55"/>
    <path d="M0 0l40 30M0 0l20 40M0 0l48 10M8 6q10 10 26 12M4 18q12 6 16 18" stroke="var(--ink-3)" stroke-width="1" fill="none" opacity=".7"/>
    <ellipse cx="62" cy="88" rx="16" ry="9" fill="var(--grime-d)" opacity=".5"/><ellipse cx="120" cy="72" rx="9" ry="6" fill="var(--grime-d)" opacity=".45"/><ellipse cx="270" cy="96" rx="12" ry="5" fill="var(--grime-d)" opacity=".4"/>
    <path d="M96 122v14q0 4 2 6M210 122v22" stroke="var(--grime-d)" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <rect x="214" y="18" width="72" height="44" fill="var(--grime-d)" opacity=".35"/>
    <ellipse cx="172" cy="100" rx="20" ry="4" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/><ellipse cx="174" cy="95" rx="18" ry="3.6" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/><ellipse cx="171" cy="90" rx="16" ry="3.2" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>
    <rect x="132" y="94" width="12" height="16" rx="2" fill="var(--rose)" transform="rotate(14 138 102)"/>
    ${Array.from({ length: 18 }, (_, i) => `<circle cx="${20 + (i * 53) % 290}" cy="${108 + (i * 7) % 5}" r="1.6" fill="var(--grime-d)"/>`).join('')}`;
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="320" height="180" fill="var(--surface-2)"/>
    <rect y="60" width="320" height="50" fill="var(--surface)"/><g stroke="var(--line)" stroke-width="1.5">${tiles}</g>
    <rect x="210" y="14" width="80" height="52" rx="4" fill="var(--cloth-soft)" stroke="var(--ink)" stroke-width="3"/><path d="M250 14v52M210 40h80" stroke="var(--ink)" stroke-width="3"/><circle cx="232" cy="28" r="7" fill="var(--glove)"/>
    <rect x="22" y="34" width="92" height="5" rx="1" fill="var(--ink)"/>
    <rect x="30" y="18" width="12" height="16" rx="2" fill="var(--glove)"/><rect x="48" y="14" width="10" height="20" rx="2" fill="var(--mint)"/><rect x="64" y="22" width="14" height="12" rx="2" fill="var(--cloth)"/><rect x="84" y="16" width="10" height="18" rx="2" fill="var(--rose)"/>
    <path d="M182 104v-22q0-6 6-6h8" fill="none" stroke="var(--ink-2)" stroke-width="4" stroke-linecap="round"/>
    <rect x="148" y="104" width="64" height="7" rx="3" fill="var(--ink-3)"/>
    <path d="M40 110q-6-26 4-30q8 10 0 30M46 110q8-22 18-20q-2 14-12 20" fill="var(--mint)"/><rect x="34" y="100" width="20" height="10" rx="2" fill="var(--sand)"/>
    <rect y="110" width="320" height="12" fill="var(--ink)"/>
    <rect y="122" width="320" height="58" fill="var(--surface)"/><g stroke="var(--line)" stroke-width="2"><path d="M80 122v58M160 122v58M240 122v58"/></g>
    <g fill="var(--ink-2)"><rect x="66" y="136" width="8" height="3" rx="1.5"/><rect x="86" y="136" width="8" height="3" rx="1.5"/><rect x="226" y="136" width="8" height="3" rx="1.5"/><rect x="246" y="136" width="8" height="3" rx="1.5"/></g>
    ${dirty ? dirt : clean}</svg>`;
}

const swipeBtn = (act, arg, label, off) => `<div class="slide ${off ? 'off' : ''}" data-done="${act}" data-a="${arg || ''}" id="slide-${act}">
  <div class="slide-fill"></div><span class="slide-label">${label}</span>
  <button class="slide-knob" type="button" aria-label="${label}">${illo('okna', 'knob-illo')}</button></div>`;

/* ================= CLIENT SCREENS ================= */
const screens = {};

screens.home = () => {
  const next = S.orders.filter(o => o.date >= 0 && !PAST.includes(o.status)).sort((a, b) => a.date - b.date)[0];
  const quick = PROS.filter(p => p.todayFree && p.reach !== 'out').sort((a, b) => a.dist - b.dist)[0] || PROS.filter(p => p.todayFree)[0] || PROS.filter(p => p.reach !== 'out')[0] || PROS[0];
  const ha = curAddr(); const nearCnt = PROS.filter(p => p.reach !== 'out').length; const nearFree = PROS.filter(p => p.reach !== 'out').reduce((x, p) => x + SLOTS.filter(t => !slotTaken(p.id, 0, t)).length, 0);
  const qEst = estimate({ service: 'dom', m2: 54, rooms: 2, baths: 1, extras: [], freq: 'once' }, quick);
  const featured = PROS.filter(p => (p.super || p.rating > 4.85) && p.reach !== 'out').sort((a, b) => a.dist - b.dist);
  return `<div class="ptr" id="ptr"><span class="ptr-drop"><svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 2C12 2 3 13 3 20a9 9 0 0 0 18 0C21 13 12 2 12 2z"/></svg></span><span class="ptr-t">Pociągnij, żeby odświeżyć</span></div>
  <div class="scroll" id="homeScroll"><div class="ptr-inner">
    <div class="hello">
      <button class="loc" data-act="openLocation">${ic('map-pin', 's')}${esc(curAddr().street.split('/')[0])}, ${esc(placeOf(curAddr()))} ${ic('chevron-down', 'xs')}</button>
      <button class="iconbtn" data-act="openNotifs" aria-label="Powiadomienia">${ic('bell', 's')}${S.notifs.some(n => !n.read) ? `<span class="badge">${S.notifs.filter(n => !n.read).length}</span>` : ''}</button>
    </div>
    <div class="pad">
      <div class="greet">${ic(DAYPARTS[daypart()].icon, 's')}${DAYPARTS[daypart()].hello}${S.me ? '' : ', Kasiu'}</div>
      <h1 class="hero-h">Kto ${DAYPARTS[daypart()].when} u&nbsp;Ciebie posprząta?</h1>
      <form class="searchbox" data-form="search">
        ${ic('search', 's faint')}
        <input id="homeSearch" name="q" placeholder="np. mycie okien, po remoncie, Olena" autocomplete="off">
        <button class="go" type="submit" aria-label="Szukaj">${ic('arrow-right', 's')}</button>
      </form>
      <div class="cats">
        ${CATS.map(c => `<button class="cat" data-act="openCat" data-a="${c.id}"><span class="tile ${c.tone}">${illo(c.id)}</span>${c.short}</button>`).join('')}
      </div>
      <div class="glass ${S.wiped ? 'clean' : ''} dp-${daypart()}" id="glass">
        <div class="behind">${skyline()}
          <div class="coupon"><span class="eyebrow">Szyba czysta</span><b>−20% na pierwsze mycie okien</b>
            <button class="code" data-act="openCat" data-a="okna">3 oferty ${ic('arrow-right', 'xs')}</button></div></div>
        ${S.wiped ? '' : `<canvas id="grime" aria-label="Brudna szyba. Przeciągnij palcem, żeby ją przetrzeć"></canvas><div class="glass-hint">${ic('hand', 'xs')}przetrzyj szybę palcem</div>`}
      </div>
      <div class="postcta">
        <div class="faces">${PROS.slice(0, 4).map(p => avatar(p, 'xs')).join('')}<span class="tiny faint">+38 w okolicy</span></div>
        <h4>Nie wiesz, kogo wybrać?</h4>
        <p>Opisz, co trzeba posprzątać. Wykonawcy z okolicy przyślą oferty z ceną, zwykle w ciągu 15 minut.</p>
        <button class="btn sm dark" data-act="newPost">${ic('plus', 's')}Dodaj zlecenie</button>
      </div>
      ${next ? (() => { const p = proById(next.pro); const d = addDays(next.date); return `
      <button class="upnext" data-act="openOrder" data-a="${next.id}">
        <div class="datebox"><b>${d.getDate()}</b><span>${MON[d.getMonth()]}</span></div>
        <div class="grow"><div style="font-weight:650">${dayLabel(d)}, ${next.time} · ${p.name.split(' ')[0]}</div>
        <div class="sub">${catById(next.service).name}${next.m2 ? ' · ' + next.m2 + ' m²' : ''} · ${statusText(next.status)}</div></div>
        ${ic('chevron-right', 's')}
      </button>`; })() : ''}

      <div class="section-h"><h3>${quick.todayFree ? 'Wolne jeszcze dziś' : 'Najbliższy wolny termin'}</h3></div>
      <div class="quick">
        <span class="quick-illo">${illo(quick.services[0])}</span>
        <div class="eyebrow" style="color:inherit;opacity:.75">${quick.area} · ${String(quick.dist).replace('.', ',')} km od Ciebie</div>
        <h4>${quick.name.split(' ')[0]} może przyjechać ${quick.nextSlot.toLowerCase()}</h4>
        <div class="small" style="opacity:.85">Mieszkanie 54 m² · ok. ${hrs(qEst.h)} · ${zl(qEst.work)}</div>
        <button class="btn sm" data-act="startBooking" data-a="${quick.id}" data-b="today">Zarezerwuj ten termin ${ic('arrow-right', 's')}</button>
      </div>

      <div class="section-h"><h3>Twoja okolica</h3><button data-act="openExplore">Mapa</button></div>
      <button class="nearby" data-act="openExplore">
        ${geoMap('home-mini', { h: 150, static: true, reset: true, center: [ha.x, ha.y], zoom: 19, labels: false, mb: { circles: ha.lat != null ? [{ lat: ha.lat, lng: ha.lng, km: 3 / ROAD }] : [] },
          layer: circleSVG(ha.x, ha.y, 3, 'gm-reach faint'),
          markers: [homeMark(ha)].concat(PROS.filter(p => p.reach !== 'out').map(p => ({ x: p.x, y: p.y, html: `<span class="avatar xs ${p.tone}">${esc(p.ini)}</span>` }))) })}
        <div class="nearby-t"><b>${nearCnt} wykonawców dojeżdża pod ${esc(ha.street.split('/')[0])}</b><span>${nearFree} wolnych terminów dziś · najbliżej ${Math.min(...PROS.filter(p => p.reach !== 'out').map(p => p.eta))} min dojazdu</span></div>
      </button>
      <div class="section-h"><h3>Polecani w okolicy</h3><button data-act="openSearch">Wszyscy</button></div>
    </div>
    <div class="pad"><div class="hscroll">
      ${featured.map(p => `<div class="feat" role="button" tabindex="0" data-act="openPro" data-a="${p.id}">
        <div class="cover ${p.tone}"><span class="cover-illo">${illo(p.services[0])}</span>${avatar(p).replace('<div class="avatar', `<div style="view-transition-name:av-${p.id}" class="avatar`)}<span class="heart">${heart(p.id)}</span></div>
        <div class="body">
          <div class="row" style="gap:5px"><span class="name">${esc(p.name)}</span>${ic('badge-check', 'verified')}</div>
          <div class="tiny faint mt8" style="margin-top:2px">${stars(p.rating)} (${p.reviews}) · ${p.jobs} zleceń</div>
          <div class="row between mt12"><span class="price">${priceLabel(p)}</span>${p.super ? '<span class="tag yellow">Superwykonawca</span>' : ''}</div>
        </div></div>`).join('')}
    </div></div>

    <div class="pad">
      <div class="section-h"><h3>Dlaczego bez obaw</h3></div>
      <div class="trust">
        <div>${ic('shield-check', 's')}<b>Sprawdzeni</b>Dowód osobisty i opinie z prawdziwych zleceń</div>
        <div>${ic('hand-coins', 's')}<b>Płacisz na miejscu</b>Zero opłat w aplikacji</div>
        <div>${ic('message-square-quote', 's')}<b>Prawdziwe opinie</b>Tylko po odbytej wizycie</div>
      </div>
      <div class="sp"></div>
    </div>
  </div></div>`;
};

function filteredPros() {
  const f = S.filters; const q = f.q.trim().toLowerCase();
  let list = PROS.filter(p => {
    if (f.cat && !p.services.includes(f.cat)) return false;
    if (q && !(p.name + ' ' + p.tagline + ' ' + p.area + ' ' + p.services.map(s => catById(s).name).join(' ')).toLowerCase().includes(q)) return false;
    if (!p.fixed && p.rate > f.maxPrice) return false;
    if (p.rating < f.minRating) return false;
    for (const k of ['verified', 'insured', 'supplies', 'eco', 'pets', 'invoice']) if (f[k] && !p[k]) return false;
    if (f.today && !p.todayFree) return false;
    if (f.boundsReal && p.lat != null) { if (!(p.lng >= f.boundsReal[0] && p.lng <= f.boundsReal[2] && p.lat >= f.boundsReal[1] && p.lat <= f.boundsReal[3])) return false; }
    else if (f.bounds && !(p.x >= f.bounds[0] && p.x <= f.bounds[2] && p.y >= f.bounds[1] && p.y <= f.bounds[3])) return false;
    if (!f.bounds) { if (p.reach === 'out' && !f.far) return false; if (f.maxDist < 15 && p.dist > f.maxDist) return false; }
    return true;
  });
  const sorters = { rec: (a, b) => (b.rating * Math.log(b.reviews)) - (a.rating * Math.log(a.reviews)), price: (a, b) => a.rate - b.rate, dist: (a, b) => a.dist - b.dist, rating: (a, b) => b.rating - a.rating };
  list.sort(sorters[f.sort]);
  // najwyżej 2 profile „Promowane” na górze, tylko przy domyślnym sortowaniu
  PROS.forEach(p => { p._promoted = false; });
  // najwyżej 2 profile „Promowane” (wyróżnienie działa w całym zasięgu wykonawcy), tylko przy domyślnym sortowaniu
  if (f.sort === 'rec' && !f.bounds) {
    const promo = list.filter(p => p.boosted && p.reach === 'in').slice(0, 2);
    promo.forEach(p => { p._promoted = true; });
    list = promo.concat(list.filter(p => !promo.includes(p)));
  }
  return list;
}
function activeFilterCount() {
  const f = S.filters; let n = 0;
  if (f.maxPrice < 100) n++; if (f.minRating) n++; if (f.maxDist < 15) n++; if (f.far) n++;
  ['verified', 'insured', 'supplies', 'eco', 'pets', 'invoice', 'today'].forEach(k => f[k] && n++);
  return n;
}

screens.search = () => {
  const f = S.filters; const list = filteredPros(); const n = activeFilterCount();
  return `<div class="searchrow">${backBtn()}
      <form class="searchbox" data-form="search2">${ic('search', 's faint')}<input id="q2" name="q" value="${esc(f.q)}" placeholder="Szukaj usługi lub osoby" autocomplete="off"></form>
      <button class="iconbtn" data-act="sheet" data-a="filters" aria-label="Filtry">${ic('sliders-horizontal', 's')}${n ? `<span class="badge">${n}</span>` : ''}</button>
    </div>
    <div class="pad"><div class="hscroll" style="padding-bottom:8px">
      <button class="chip ${!f.cat ? 'on' : ''}" data-act="setCat" data-a="">Wszystko</button>
      ${CATS.map(c => `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-act="setCat" data-a="${c.id}">${c.short}</button>`).join('')}
    </div></div>
    <div class="scroll"><div class="pad">
      <div class="hscroll" style="padding-bottom:4px">
        <button class="chip geo" data-act="openLocation">${ic('map-pin', 'xs')}${esc(curAddr().label)}</button>
        ${f.bounds ? `<button class="chip on" data-act="clearGeo" data-a="bounds">Obszar z mapy ${ic('x', 'xs')}</button>` : ''}
        <button class="chip ${f.today ? 'on' : ''}" data-act="toggleF" data-a="today">${ic('zap', 'xs')}Wolne dziś</button>
        <button class="chip ${f.supplies ? 'on' : ''}" data-act="toggleF" data-a="supplies">Własne środki</button>
        <button class="chip ${f.invoice ? 'on' : ''}" data-act="toggleF" data-a="invoice">Faktura VAT</button>
        <button class="chip ${f.pets ? 'on' : ''}" data-act="toggleF" data-a="pets">Zwierzęta OK</button>
        <button class="chip ${f.eco ? 'on' : ''}" data-act="toggleF" data-a="eco">Eco</button>
      </div>
      <div class="resultbar"><span>${list.length} ${list.length === 1 ? 'wykonawca' : list.length < 5 && list.length > 1 ? 'wykonawców' : 'wykonawców'} ${ f.bounds ? 'w zaznaczonym obszarze' : 'dojeżdża pod adres: ' + esc(curAddr().label)}</span>
        <label class="row" style="gap:4px">Sortuj:<select id="sort" data-model="filters.sort" data-rr="1">
          ${[['rec', 'polecane'], ['price', 'cena'], ['dist', 'odległość'], ['rating', 'ocena']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label></div>
      <div class="seg mb12"><button class="${S.searchView !== 'map' ? 'on' : ''}" data-act="searchView" data-a="list">${ic('list', 's')} Lista</button><button class="${S.searchView === 'map' ? 'on' : ''}" data-act="searchView" data-a="map">${ic('map', 's')} Mapa</button></div>
      ${S.searchView === 'map' ? mapView(list) : `<div class="stack">${list.length ? list.map(proCard).join('') : `${PROS.every(p => p.reach === 'out') ? waitlistCard() : `<div class="empty">${ic('search-x')}<div style="font-weight:650;color:var(--ink)">Nikt nie pasuje do filtrów</div><div class="small mt8">Poluzuj limit ceny albo wyłącz część filtrów.</div><button class="btn sm line mt16" data-act="clearFilters">Wyczyść filtry</button></div>`}`}</div>`}
      <div class="sp"></div>
    </div></div>`;
};

screens.provider = ({ id }) => {
  const p = proById(id);
  const pbar = `<div class="pbar" id="pbar">${backBtn()}<b>${esc(p.name)}</b>${stars(p.rating)}</div>`;
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(i); const free = SLOTS.filter(s => !slotTaken(p.id, i, s)).length; return { d, free }; });
  const included = ['Odkurzanie i mycie podłóg', 'Kurze na dostępnych powierzchniach', 'Łazienka: wanna, prysznic, WC, lustra', 'Kuchnia: blaty, zlew, front szafek', 'Wyniesienie śmieci', 'Ścielenie łóżek'];
  const svcPrices = p.services.map(s => {
    const c = catById(s);
    if (p.fixed) return [c.name, 'od ' + zl(p.rate)];
    if (s === 'okna' && p.perWindow) return [c.name, `${p.perWindow} zł / okno`];
    const mul = s === 'generalne' ? 1.2 : s === 'remont' ? 1.3 : 1;
    return [c.name, `${Math.round(p.rate * mul)} zł / h`];
  });
  return `${pbar}<div class="scroll" id="proScroll">
    <div class="phead">
      <div class="pcover ${p.tone}"><span class="cover-illo">${illo(p.services[0])}</span><div class="topbtns">${backBtn()}<div class="r"><button class="iconbtn" data-act="share" aria-label="Udostępnij">${ic('share', 's')}</button>${heart(p.id).replace('heartbtn', 'heartbtn iconbtn')}</div></div></div>
      ${avatar(p, 'lg').replace('<div class="avatar', `<div style="view-transition-name:av-${p.id}" class="avatar`)}
      <h1>${esc(p.name)} ${p.verified ? ic('badge-check', 'verified') : ''}</h1>
      <div class="small muted">${p.kind} · ${p.area} · na Lśni od ${p.since}</div>
      <div class="chips mt12">${p.super ? '<span class="tag yellow">' + ic('award', 'xs') + 'Superwykonawca</span>' : ''}${p.langs.map(l => `<span class="tag">${l}</span>`).join('')}${p.todayFree ? '<span class="tag mint">Wolne dziś</span>' : ''}</div>
      <div class="stats">
        <div><b class="num">${p.rating.toFixed(2).replace('.', ',')}</b><span>${p.reviews} opinii</span></div>
        <div><b class="num">${p.jobs}</b><span>zleceń</span></div>
        <div><b class="num">${p.repeat}%</b><span>wraca</span></div>
        <div><b>${p.response}</b><span>odpowiedź</span></div>
      </div>
      <p class="muted" style="margin:16px 0 0;font-size:14px">${esc(p.bio)}</p>
      <div class="section-h"><h3>Przed i po</h3><span class="tiny faint">${p.area}${p.reviewsList[0] ? ', ' + p.reviewsList[0].when : ''}</span></div>
      <div class="ba hint" id="ba">
        <div class="ba-after">${kitchen(false)}</div><div class="ba-before">${kitchen(true)}</div>
        <span class="ba-tag l">Przed</span><span class="ba-tag r">Po</span>
        <div class="ba-handle"><span>${ic('chevrons-left-right', 's')}</span></div>
        <input type="range" min="0" max="100" value="50" id="baRange" aria-label="Porównaj przed i po">
      </div>
      <div class="badges">
        <div class="b ${p.verified ? '' : 'off'}">${ic('badge-check', 's')}Tożsamość potwierdzona dowodem</div>
        <div class="b ${p.insured ? '' : 'off'}">${ic(p.insured ? 'shield-check' : 'shield-off', 's')}${p.insured ? 'Polisa OC do 100 000 zł' : 'Brak polisy OC'}</div>
        <div class="b ${p.supplies ? '' : 'off'}">${ic('spray-can', 's')}${p.supplies ? 'Przynosi własne środki i sprzęt' : 'Pracuje na Twoich środkach'}</div>
        <div class="b ${p.pets ? '' : 'off'}">${ic('paw-print', 's')}${p.pets ? 'Zwierzęta w domu nie przeszkadzają' : 'Woli domy bez zwierząt'}</div>
        <div class="b ${p.invoice ? '' : 'off'}">${ic('receipt', 's')}${p.invoice ? 'Wystawia fakturę VAT' : 'Rachunek bez faktury VAT'}</div>
      </div>

      <div class="section-h"><h3>Cennik</h3><span class="tiny faint">min. ${p.fixed ? '1 usługa' : hrs(p.minH)}</span></div>
      <div class="pricelist">${svcPrices.map(([n, v]) => `<div class="li"><span>${n}</span><b>${v}</b></div>`).join('')}
        <div class="li"><span class="faint">Rabat przy stałym sprzątaniu</span><b style="color:var(--mint)">do −15%</b></div></div>

      <div class="section-h"><h3>Dostępność</h3><span class="tiny faint">najbliższe 7 dni</span></div>
      <div class="week">${week.map(({ d, free }) => `<div class="d ${free ? 'ok' : 'no'}">${DAYS[d.getDay()]}<b>${d.getDate()}</b><i>${free ? free + ' wolne' : 'brak'}</i></div>`).join('')}</div>

      <div class="section-h"><h3>Co obejmuje standard</h3></div>
      <div class="included">${included.map(t => `<div>${ic('check', 's')}<span>${t}</span></div>`).join('')}</div>

      <div class="section-h"><h3>Opinie</h3><span class="rating">${ic('star', 's star')} ${p.rating.toFixed(2).replace('.', ',')} · ${p.reviews}</span></div>
      <div class="stack">${p.reviewsList.map(r => `<div class="review">
        <div class="row between"><b class="small">${esc(r.who)}</b><span class="tiny faint">${r.when}</span></div>
        <div class="row" style="gap:2px;margin-top:4px">${Array.from({ length: 5 }, (_, i) => ic('star', 'xs ' + (i < r.stars ? 'star' : 'faint'))).join('')}</div>
        <p>${esc(r.text)}</p><div class="chips">${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div></div>`).join('')}</div>
      <div class="sp"></div>
    </div>
  </div>
  <div class="footer">
    <button class="iconbtn" data-act="openChat" data-a="${p.id}" aria-label="Napisz">${ic('message-circle', 's')}</button>
    <div class="sum"><b>${priceLabel(p).replace(/<small>|<\/small>/g, '')}</b><span>Najbliżej: ${p.nextSlot}</span></div>
    <button class="btn primary" data-act="startBooking" data-a="${p.id}">Zarezerwuj</button>
  </div>`;
};

function mapView(list) {
  const a = curAddr(); const sel = list.find(p => p.id === S.mapSel) || list[0];
  const layer = (sel ? circleSVG(sel.x, sel.y, sel.r, 'gm-reach') : '') + (S.filters.bounds ? (() => { const [x1, y1, x2, y2] = S.filters.bounds; return `<rect class="gm-bounds" x="${x1 * U}" y="${y1 * U}" width="${(x2 - x1) * U}" height="${(y2 - y1) * U}"/>`; })() : '');
  const mbCircles = sel && sel.lat != null ? [{ lat: sel.lat, lng: sel.lng, km: sel.r / ROAD }] : [];
  return `${geoMap('search', { h: 360, center: [a.x, a.y], zoom: 17, locate: true, layer, labelExtra: null,
    mb: { center: a.lat != null ? { lat: a.lat, lng: a.lng } : null, zoom: 11.6, circles: mbCircles, bounds: S.filters.boundsReal },
    markers: [homeMark(a)].concat(list.map((p, i) => proPin(p, sel && sel.id === p.id, i))),
    overlay: `<button class="gm-over gm-area" id="searchAreaBtn" data-act="searchArea" ${S.mapMoved ? '' : 'hidden'}>${ic('scan-search', 's')}Szukaj w tym obszarze</button>`,
    onMove: () => { const b = document.getElementById('searchAreaBtn'); if (b) b.hidden = false; S.mapMoved = true; } })}
  ${sel ? `<div class="reachnote">${sel.reach === 'in' ? `${ic(sel.travelFee ? 'car' : 'circle-check', 's')}<span>${sel.name.split(' ')[0]} dojeżdża do Ciebie: ${kmf(sel.dist)} km, ok. ${sel.eta} min. ${sel.travelFee ? `Dojazd +${sel.travelFee} zł (${feeText(sel)}).` : 'Dojazd w cenie.'}</span>` : `${ic('map-pin-off', 's')}<span>Poza zasięgiem dojazdu (${sel.r} km od bazy).</span>`}</div>
  <div class="mt8">${proCard(sel)}</div>` : '<div class="empty">Nikt nie pasuje do filtrów</div>'}`;
}

/* ---------- lokalizacja: adres klienta ---------- */
screens.location = () => {
  const a = curAddr(); const v = S.maps.loc; const c = v ? [v.x, v.y] : [a.x, a.y]; const rg = reverseGeo(c[0], c[1]);
  const countIn = ad => PROS.filter(p => reachFor(p, ad).reach === 'in').length;
  return `${topbar('Gdzie sprzątamy?')}
  <div class="scroll"><div class="pad">
    <form class="searchbox" data-form="loc" style="height:48px;box-shadow:none">${ic('search', 's faint')}<input id="locq" name="q" placeholder="Wpisz adres, np. Floriańska 10, Kraków" autocomplete="off" data-live="locq"></form>
    <div class="sugg" id="locSug"></div>
    <button class="opt mt8" data-act="useGps">${ic('locate-fixed', 's')}<div class="grow"><b class="small">Użyj mojej lokalizacji</b><div class="tiny faint">W makiecie lokalizacja jest symulowana</div></div></button>
    <div class="section-h"><h3>Zapisane adresy</h3></div>
    <div class="options">${S.addresses.map(ad => { const d = esc(placeOf(ad)); return `<button class="opt ${ad.id === S.addrId ? 'on' : ''}" data-act="pickAddr" data-a="${ad.id}"><span class="radio"></span><div class="grow"><b class="small">${esc(ad.label)}</b><div class="tiny faint">${esc(ad.street)}, ${d}${ad.note ? ' · ' + esc(ad.note) : ''}</div></div><span class="tag ${countIn(ad) > 5 ? 'mint' : ''}">${countIn(ad)} wyk.</span></button>`; }).join('')}</div>
    <div class="section-h"><h3>Wskaż na mapie</h3><span class="tiny faint">przesuń mapę pod pinezkę</span></div>
    ${geoMap('loc', { h: 260, center: [a.x, a.y], zoom: 34, fixedPin: true, labels: true, locate: true,
      mb: { center: S.locReal || (a.lat != null ? { lat: a.lat, lng: a.lng } : null), zoom: 15.5, onMoveReal: (lat, lng, end) => { S.locReal = { lat, lng }; if (end) liveLocReal(lat, lng); } },
      markers: S.addresses.map(ad => homeMark(ad)),
      onMove: m => liveLoc(m.v.x, m.v.y) })}
    <div class="card mt12" id="locCard">${locCardHTML(c[0], c[1])}</div>
    <div class="field"><span class="lbl">Nazwa adresu</span><div class="chips">${['Dom', 'Praca', 'Rodzice', 'Mieszkanie na wynajem'].map(l => `<button class="chip ${S.newAddrLabel === l ? 'on' : ''}" data-act="newAddrLabel" data-a="${l}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="anote">Piętro, kod, wskazówki dojazdu</label><input class="input" id="anote" placeholder="np. 3 piętro, bez windy, parking od podwórza" data-model="newAddrNote" value="${esc(S.newAddrNote || '')}"></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer"><button class="btn primary block" data-act="saveAddr" id="saveAddrBtn">${ic('map-pin-plus', 's')}Zapisz i szukaj tutaj</button></div>`;
};
function waitlistCard() {
  const a = curAddr(); const key = 'addr-' + a.id; const on = S.waitlist.includes(key);
  return `<div class="card waitcard">${illo('dom')}<b>Jeszcze tu nie dojeżdżamy</b><p class="small muted">Działamy w całej Polsce, ale nie wszędzie mamy już wykonawców. Pod adres ${esc(a.street)} nie dojeżdża na razie nikt. Zapisz się, a damy znać, gdy pojawią się pierwsi wykonawcy.</p>
    ${on ? `<span class="tag mint">${ic('check', 'xs')}Jesteś na liście oczekujących</span>` : `<button class="btn primary sm" data-act="joinWaitlist" data-a="${key}">${ic('bell-plus', 's')}Daj mi znać</button>`}
    <button class="btn line sm" data-act="toast" data-a="Link skopiowany. Im więcej osób z okolicy, tym szybciej ruszymy">${ic('share', 's')}Poleć sąsiadom</button></div>`;
}
function statsMinis(st) {
  return `<div class="minis mt12"><div><b class="num">${st.avg || '—'} zł</b><span>śr. stawka</span></div><div><b class="num">${st.free}</b><span>wolne dziś</span></div><div><b class="num">${st.withFee}</b><span>liczy za dojazd</span></div></div>`;
}
function locCardHTML(x, y) {
  const rg = reverseGeo(x, y); const st = pointStats({ x, y });
  if (!st.count) return `<div class="row">${ic('map-pin', 's')}<div class="grow"><b class="small">${rg.street}</b><div class="tiny faint">${esc(rg.district)} · jeszcze nikt tu nie dojeżdża</div>
    ${S.waitlist.includes('out-' + Math.round(x) + '-' + Math.round(y)) ? `<span class="tag mint mt8">${ic('check', 'xs')}Jesteś na liście</span>` : `<button class="btn sm dark mt8" data-act="joinWaitlist" data-a="out-${Math.round(x)}-${Math.round(y)}">${ic('bell-plus', 's')}Daj znać, gdy ktoś się pojawi</button>`}</div></div>`;
  return `<div class="row">${ic('map-pin', 's')}<div class="grow"><b class="small">${rg.street}</b><div class="tiny faint">${esc(rg.district)} · ${st.count} wykonawców dojeżdża · najbliżej ${st.near[0].eta} min</div></div></div>${statsMinis(st)}`;
}
// Adres pod pinezką z serwera (Mapbox reverse geocoding), z krótką zwłoką, żeby nie pytać przy każdym ruchu.
let locTimer = null, locSeq = 0;
function liveLocReal(lat, lng) {
  clearTimeout(locTimer); const seq = ++locSeq;
  locTimer = setTimeout(async () => {
    let rev; try { rev = await window.LsniAPI.call('GET', `/api/geo/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`); } catch (e) { return; }
    if (seq !== locSeq) return;
    const c = document.getElementById('locCard'); if (c) c.innerHTML = locCardReal(lat, lng, rev);
    const b = document.getElementById('saveAddrBtn'); if (b) b.disabled = !rev.inArea;
    S.locRev = rev;
  }, 250);
}
function locCardReal(lat, lng, rev) {
  if (!rev.inArea) return `<div class="row">${ic('map-pin-off', 's')}<div class="grow"><b class="small">${esc(rev.street || 'Poza Polską')}</b><div class="tiny faint">To miejsce jest poza Polską. Działamy w całym kraju, ale tylko pod polskimi adresami.</div></div></div>`;
  const loc = pointStats({ lat, lng }); const s2 = rev.stats || {};
  const st = { count: Math.max(loc.count, s2.providers || 0), avg: s2.avgRate != null ? s2.avgRate : loc.avg, free: s2.freeToday != null ? s2.freeToday : loc.free, withFee: loc.withFee, near: loc.near };
  const where = rev.city || '';
  if (!st.count) return `<div class="row">${ic('map-pin', 's')}<div class="grow"><b class="small">${esc(rev.street)}</b><div class="tiny faint">${esc(where)} · jeszcze nikt tu nie dojeżdża</div>
    ${S.waitlist.includes('out-' + lat.toFixed(2) + '-' + lng.toFixed(2)) ? `<span class="tag mint mt8">${ic('check', 'xs')}Jesteś na liście</span>` : `<button class="btn sm dark mt8" data-act="joinWaitlist" data-a="out-${lat.toFixed(2)}-${lng.toFixed(2)}">${ic('bell-plus', 's')}Daj znać, gdy ktoś się pojawi</button>`}</div></div>`;
  return `<div class="row">${ic('map-pin', 's')}<div class="grow"><b class="small">${esc(rev.street)}</b><div class="tiny faint">${esc(where)} · ${st.count} wykonawców dojeżdża${st.near[0] ? ` · najbliżej ok. ${st.near[0].eta} min` : ''}</div></div></div>${statsMinis(st)}`;
}
const haversine = (la1, ln1, la2, ln2) => { const r = Math.PI / 180, dLa = (la2 - la1) * r, dLn = (ln2 - ln1) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLn / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
function liveLoc(x, y) {
  const c = document.getElementById('locCard'); if (c) c.innerHTML = locCardHTML(x, y);
  const b = document.getElementById('saveAddrBtn'); if (b) b.disabled = false;
}

/* ---------- mapa okolicy z warstwami ---------- */
const LAYERS = { pros: 'Wykonawcy', free: 'Wolni dziś', demand: 'Gdzie szukają klienci' };
screens.explore = () => {
  const a = curAddr(); const lay = S.exploreLayer in LAYERS ? S.exploreLayer : 'pros'; const st = pointStats(a);
  const shown = st.near.map(r => r.p).filter(p => lay !== 'free' || p.todayFree);
  const heat = lay === 'demand' ? (S.online ? (S.heat && S.heat.points) || [] : demoHeat()) : [];
  if (S.online && lay === 'demand' && !S.heatLoading && (!S.heat || S.heat.key !== a.id)) loadHeat(a);
  return `${topbar('Mapa okolicy', `<button class="iconbtn" data-act="openLocation" aria-label="Zmień adres">${ic('map-pin', 's')}</button>`)}
  <div class="scroll"><div class="pad">
    <div class="hscroll" style="padding-bottom:10px">${Object.entries(LAYERS).map(([k, l]) => `<button class="chip ${lay === k ? 'on' : ''}" data-act="exploreLayer" data-a="${k}">${l}</button>`).join('')}</div>
    ${geoMap('explore', { h: 400, center: [a.x, a.y], zoom: 9, locate: true, heat,
      markers: [meMark(a)].concat(lay === 'demand' ? [] : shown.map((p, i) => proPin(p, false, i, 'openPro'))),
      overlay: lay === 'demand' ? `<div class="gm-over gm-legend"><span>mało</span><i style="background:linear-gradient(90deg, ${mixFill('glove', 40)}, ${mixFill('rose', 90)})"></i><span>dużo wyszukiwań</span></div>` : '',
      mb: { center: a.lat != null ? { lat: a.lat, lng: a.lng } : null, zoom: lay === 'demand' ? 9.6 : 11, heat, fit: lay === 'demand' || a.lat == null ? null : fitAround(a, shown), fitKey: `${a.id}-${lay}-${shown.length}` } })}
    <div class="hint" style="text-align:center">${lay === 'demand' ? 'Wyszukiwania z ostatnich 30 dni. Bez podziału na dzielnice czy miasta.' : 'Pokazujemy wykonawców, którzy dojeżdżają pod Twój adres. Dotknij, żeby otworzyć profil.'}</div>
    <div class="card mt16">
      <div class="eyebrow">Pod Twoim adresem</div><b style="font-family:var(--f-display);font-size:20px">${esc(a.street)}, ${esc(placeOf(a))}</b>
      <div class="minis mt12"><div><b class="num">${st.count}</b><span>dojeżdża</span></div><div><b class="num">${st.avg ? st.avg + ' zł' : '—'}</b><span>śr. stawka</span></div><div><b class="num">${st.near[0] ? st.near[0].eta + ' min' : '—'}</b><span>najbliżej</span></div></div>
      ${st.count ? `<button class="btn line block mt12" data-act="openSearch">Pokaż wszystkich (${st.count})</button>` : ''}
    </div>
    <div class="sp"></div>
  </div></div>`;
};
// widok obejmujący adres i pokazanych wykonawców (do 25 km od adresu)
function fitAround(a, list) {
  const pts = [[a.lng, a.lat]].concat(list.filter(p => p.lat != null && haversine(a.lat, a.lng, p.lat, p.lng) < 25).map(p => [p.lng, p.lat]));
  const lngs = pts.map(q => q[0]), lats = pts.map(q => q[1]); const pad = 0.01;
  return [[Math.min(...lngs) - pad, Math.min(...lats) - pad], [Math.max(...lngs) + pad, Math.max(...lats) + pad]];
}
// mapa cieplna z serwera (wyszukiwania w promieniu 25 km od adresu)
async function loadHeat(a) {
  S.heatLoading = true;
  try { const r = await window.LsniAPI.call('GET', `/api/geo/demand?lat=${a.lat.toFixed(4)}&lng=${a.lng.toFixed(4)}&km=25`); S.heat = Object.assign(r, { key: a.id }); } catch (e) { S.heat = { key: a.id, points: [] }; }
  S.heatLoading = false; render();
}

/* ---------- booking ---------- */
function newBooking(proId, preset) {
  const p = proById(proId);
  const svc = S.filters.cat && p.services.includes(S.filters.cat) ? S.filters.cat : p.services[0];
  let day = 1, time = null;
  if (preset === 'today') { day = 0; time = p.nextSlot.split(' ')[1]; }
  return { pro: proId, step: 1, service: svc, m2: 54, rooms: 2, baths: 1, extras: [], supplies: p.supplies ? 'pro' : 'mine', freq: 'once', day, time, addr: S.addrId, entry: 'home', code: '', pets: 'none', note: '', focus: [], pay: 'cash', blik: '', who: S.addrId === 'mama' ? 'other' : 'me', onName: S.addrId === 'mama' ? 'Halina (mama)' : '', onPhone: S.addrId === 'mama' ? '600 123 120' : '' };
}
const STEP_TITLES = ['Zakres sprzątania', 'Termin', 'Adres i wejście', 'Podsumowanie'];

screens.book = () => {
  const b = S.booking; const p = proById(b.pro); const e = estimate(b, p);
  const body = [null, bookStep1, bookStep2, bookStep3, bookStep4][b.step](b, p, e);
  const canNext = b.step !== 2 || b.time;
  return `<div class="topbar">${b.step === 1 ? backBtn() : `<button class="iconbtn" data-act="bookPrev" aria-label="Wstecz">${ic('chevron-left')}</button>`}
      <h2>${STEP_TITLES[b.step - 1]}</h2><span class="tiny faint">${b.step} z 4</span></div>
    <div class="steps">${[1, 2, 3, 4].map(i => `<i class="${i <= b.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="scroll"><div class="pad">${body}<div class="sp"></div></div></div>
    <div class="footer" ${b.step === 4 ? 'hidden' : ''}>
      <div class="sum"><b class="num" id="estTotal">${zl(b.step === 4 ? e.total : e.work - e.discount)}</b><span id="estSub">ok. ${hrs(e.h)} · ${p.name.split(' ')[0]}${e.disc ? ' · −' + Math.round(e.disc * 100) + '%' : ''}</span></div>
      ${b.step < 4 ? `<button class="btn primary" data-act="bookNext" ${canNext ? '' : 'disabled'}>${b.step === 2 && !b.time ? 'Wybierz godzinę' : 'Dalej'}</button>`
      : ''}
    </div>
    ${b.step === 4 ? `<div class="footer slidefoot">${swipeBtn('pay', '', 'Przesuń, aby zarezerwować')}</div>` : ''}`;
};

function bookStep1(b, p, e) {
  return `
  <div class="row mt8" style="gap:10px">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${stars(p.rating)} · ${p.rate} zł/h · min. ${hrs(p.minH)}</div></div></div>
  <div class="field"><span class="lbl">Rodzaj usługi</span>
    <div class="chips">${p.services.map(s => `<button class="chip ${b.service === s ? 'on' : ''}" data-act="bset" data-a="service" data-b="${s}">${catById(s).name}</button>`).join('')}</div></div>
  <div class="field"><div class="row between"><span class="lbl" style="margin:0">Metraż</span><span class="big-val num" id="m2val">${b.m2}<small>m²</small></span></div>
    <input type="range" id="m2" min="20" max="200" step="2" value="${b.m2}" data-model="booking.m2" data-type="num" data-live="m2" aria-label="Metraż">
    <div class="market"><span>20 m²</span><span>200 m²</span></div></div>
  <div class="field">
    <div class="stepper"><span>Pokoje</span><div class="ctl"><button data-act="bstep" data-a="rooms" data-b="-1" aria-label="Mniej">${ic('minus', 's')}</button><b>${b.rooms}</b><button data-act="bstep" data-a="rooms" data-b="1" aria-label="Więcej">${ic('plus', 's')}</button></div></div>
    <div class="stepper"><span>Łazienki</span><div class="ctl"><button data-act="bstep" data-a="baths" data-b="-1" aria-label="Mniej">${ic('minus', 's')}</button><b>${b.baths}</b><button data-act="bstep" data-a="baths" data-b="1" aria-label="Więcej">${ic('plus', 's')}</button></div></div>
  </div>
  <div class="field"><span class="lbl">Dodatki</span>
    <div class="extras">${EXTRAS.map(x => { const on = b.extras.includes(x.id); return `<button class="extra ${on ? 'on' : ''}" data-act="bextra" data-a="${x.id}">
      <span class="tick">${on ? ic('check', 'xs') : ''}</span>${ic(x.icon)}<b>${x.name}</b><span>+${x.h * 60} min · ${zl(x.h * p.rate)}</span></button>`; }).join('')}</div></div>
  <div class="field"><span class="lbl">Środki czystości</span>
    <div class="options">
      ${p.supplies ? `<button class="opt ${b.supplies === 'pro' ? 'on' : ''}" data-act="bset" data-a="supplies" data-b="pro"><span class="radio"></span><div class="grow"><b class="small">${p.name.split(' ')[0]} przynosi swoje</b><div class="tiny faint">Środki i odkurzacz w cenie</div></div></button>` : ''}
      <button class="opt ${b.supplies === 'mine' ? 'on' : ''}" data-act="bset" data-a="supplies" data-b="mine"><span class="radio"></span><div class="grow"><b class="small">Użyj moich</b><div class="tiny faint">Przygotuj odkurzacz, mop i płyny</div></div></button>
    </div></div>
  <div class="note mt16">${ic('info', 's')}<span>Szacujemy ok. <b>${hrs(e.h)}</b> pracy. Jeśli zajmie mniej, zapłacisz mniej. Dłużej tylko po Twojej zgodzie w czacie.</span></div>`;
}

function bookStep2(b, p, e) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(i));
  return `
  <div class="field"><span class="lbl">Jak często?</span>
    <div class="freq">${FREQ.map(f => `<button class="${b.freq === f.id ? 'on' : ''}" data-act="bset" data-a="freq" data-b="${f.id}"><b>${f.name}</b><span>${f.disc ? `<span class="save">−${f.disc * 100}%</span> · ` : ''}${f.sub}</span></button>`).join('')}</div></div>
  <div class="field"><span class="lbl">Dzień</span>
    <div class="dates">${days.map((d, i) => { const free = SLOTS.some(s => !slotTaken(p.id, i, s)); return `<button class="date ${b.day === i ? 'on' : ''}" data-act="bday" data-a="${i}" ${free ? '' : 'disabled style="opacity:.4"'}>${i === 0 ? 'dziś' : DAYS[d.getDay()]}<b>${d.getDate()}</b></button>`; }).join('')}</div></div>
  <div class="field"><span class="lbl">Godzina rozpoczęcia</span>
    <div class="slots">${SLOTS.map(s => { const taken = slotTaken(p.id, b.day, s); return `<button class="slot ${b.time === s ? 'on' : ''}" data-act="bset" data-a="time" data-b="${s}" ${taken ? 'disabled' : ''}>${s}</button>`; }).join('')}</div>
    ${b.time ? `<div class="hint">Koniec ok. ${endTime(b.time, e.h)} · ${DAYS_LONG[addDays(b.day).getDay()]}</div>` : ''}</div>
  ${b.freq !== 'once' ? `<div class="note mint mt16">${ic('repeat', 's')}<span>${p.name.split(' ')[0]} zarezerwuje dla Ciebie ten sam termin ${b.freq === 'week' ? 'co tydzień' : b.freq === 'biweek' ? 'co 2 tygodnie' : 'co miesiąc'}. Każdą wizytę przełożysz lub odwołasz do 24 h przed.</span></div>` : ''}
  <div class="note mt12">${ic('clock', 's')}<span>${p.name.split(' ')[0]} potwierdza rezerwacje średnio w ${p.response}. Do tego czasu nic nie płacisz.</span></div>`;
}
function endTime(t, h) { const [H, M] = t.split(':').map(Number); const m = H * 60 + M + h * 60; return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }

function bookStep3(b, p) {
  return `
  <div class="field"><span class="lbl">Adres</span>
    <div class="options">
      ${S.addresses.map(ad => { const r = reachFor(p, ad); return `<button class="opt ${b.addr === ad.id ? 'on' : ''}" data-act="bset" data-a="addr" data-b="${ad.id}" ${r.reach === 'out' ? 'disabled style="opacity:.5"' : ''}><span class="radio"></span><div class="grow"><b class="small">${esc(ad.label)}</b><div class="tiny faint">${esc(ad.street)}, ${esc(placeOf(ad))}${ad.note ? ' · ' + esc(ad.note) : ''}</div></div>
        <span class="tag ${r.reach === 'out' ? 'rose' : r.fee ? 'yellow' : 'mint'}">${r.reach === 'out' ? 'za daleko' : r.eta + ' min' + (r.fee ? ' · +' + r.fee + ' zł' : '')}</span></button>`; }).join('')}
      <button class="opt" data-act="openLocation">${ic('plus', 's')}<b class="small">Dodaj nowy adres na mapie</b></button>
    </div></div>
  <div class="field"><span class="lbl">Jak wykonawca wejdzie?</span>
    <div class="chips">${[['home', 'Będę w domu'], ['concierge', 'Klucz u portiera'], ['lockbox', 'Skrytka na klucz']].map(([v, l]) => `<button class="chip ${b.entry === v ? 'on' : ''}" data-act="bset" data-a="entry" data-b="${v}">${l}</button>`).join('')}</div>
    <div class="two mt12"><input class="input" id="code" placeholder="Kod domofonu" value="${esc(b.code)}" data-model="booking.code"><input class="input" placeholder="Nr mieszkania" value="14"></div>
    <div class="hint">${ic('lock', 'xs')} Kod zobaczy tylko ${p.name.split(' ')[0]}, 2 godziny przed wizytą.</div></div>
  <div class="field"><span class="lbl">Kto będzie na miejscu?</span>
    <div class="seg"><button class="${b.who === 'me' ? 'on' : ''}" data-act="bset" data-a="who" data-b="me">Ja</button><button class="${b.who === 'other' ? 'on' : ''}" data-act="bset" data-a="who" data-b="other">Ktoś inny</button></div>
    ${b.who === 'other' ? `<div class="two mt12"><input class="input" id="onName" placeholder="Imię, np. mama" value="${esc(b.onName)}" data-model="booking.onName"><input class="input" id="onPhone" inputmode="tel" placeholder="Telefon" value="${esc(b.onPhone)}" data-model="booking.onPhone"></div>
    <div class="hint">${ic('message-square', 'xs')} Wyślemy tej osobie SMS dzień wcześniej z imieniem wykonawcy i godziną wizyty.</div>` : ''}</div>
  <div class="field"><span class="lbl">Zwierzęta w domu</span>
    <div class="chips">${[['none', 'Brak'], ['cat', 'Kot'], ['dog', 'Pies'], ['other', 'Inne']].map(([v, l]) => `<button class="chip ${b.pets === v ? 'on' : ''}" data-act="bset" data-a="pets" data-b="${v}">${l}</button>`).join('')}</div>
    ${b.pets !== 'none' && !p.pets ? `<div class="note yellow mt12">${ic('triangle-alert', 's')}<span>${p.name.split(' ')[0]} woli domy bez zwierząt. Napisz w uwagach, czy zwierzak będzie w osobnym pokoju.</span></div>` : ''}</div>
  <div class="field"><span class="lbl">Na czym zależy Ci najbardziej?</span>
    <div class="chips">${['Kuchnia', 'Łazienka', 'Podłogi', 'Kurze', 'Okna', 'Sypialnia'].map(t => `<button class="chip ${b.focus.includes(t) ? 'on' : ''}" data-act="bfocus" data-a="${t}">${t}</button>`).join('')}</div></div>
  <div class="field"><label for="note">Uwagi dla wykonawcy</label>
    <textarea class="input" id="note" placeholder="np. nie używać chloru na kamieniu w łazience, odkurzacz w szafie w przedpokoju" data-model="booking.note">${esc(b.note)}</textarea></div>`;
}

function bookStep4(b, p, e) {
  const d = addDays(b.day); const f = FREQ.find(x => x.id === b.freq);
  return `
  <div class="receipt mt8">
    <div class="row" style="gap:10px;margin-bottom:12px">${avatar(p, 'sm')}<div class="grow"><div class="name">${catById(b.service).name}</div><div class="tiny faint">${dayLabel(d)}, ${b.time}–${endTime(b.time, e.h)} · ${p.name}</div></div></div>
    <div class="ln"><span>Praca (${hrs(e.baseH)} × ${p.rate} zł)</span><b>${zl(e.baseH * p.rate)}</b></div>
    ${b.extras.map(id => { const x = EXTRAS.find(y => y.id === id); return `<div class="ln"><span>${x.name}</span><b>${zl(x.h * p.rate)}</b></div>`; }).join('')}
    ${e.disc ? `<div class="ln disc"><span>Rabat: ${f.name.toLowerCase()}</span><b>−${zl(e.discount)}</b></div>` : ''}
    ${e.travel ? `<div class="ln"><span>Dojazd: ${kmf(e.km)} km, ${feeText(p)}</span><b>${zl(e.travel)}</b></div>` : ''}
    <div class="ln"><span>Opłata za Lśni</span><b style="color:var(--mint)">0 zł</b></div>
    <div class="tot"><span class="muted small">Do zapłaty na miejscu${b.freq !== 'once' ? ' za wizytę' : ''}</span><b class="num">${zl(e.total)}</b></div>
  </div>
  <div class="field"><span class="lbl">Jak zapłacisz wykonawcy po sprzątaniu?</span>
    <div class="chips">${[['cash', 'Gotówka'], ['blikphone', 'BLIK na telefon'], ['transfer', 'Przelew']].concat(p.invoice ? [['invoice', 'Faktura VAT']] : []).map(([v, l]) => `<button class="chip ${b.pay === v ? 'on' : ''}" data-act="bset" data-a="pay" data-b="${v}">${l}</button>`).join('')}</div>
    <div class="hint">Przekażemy to wykonawcy, żeby wiedział, czego się spodziewać.</div></div>
  <div class="note mint mt16">${ic('hand-coins', 's')}<span>W Lśni nic nie płacisz. Rozliczasz się bezpośrednio z wykonawcą, gdy sprzątanie jest skończone. Bezpłatne odwołanie do 24 h przed.</span></div>`;
}

screens.booked = ({ id }) => {
  const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const d = addDays(o.date);
  return `<canvas class="bubbles" id="bubbles" aria-hidden="true"></canvas><div class="scroll"><div class="done">
    <div class="ring">${ic('check')}</div>
    <h1>${o.fromOffer ? 'Termin potwierdzony' : 'Rezerwacja wysłana'}</h1>
    <p class="muted" style="margin:0;max-width:30ch">${o.fromOffer ? `Wybrałaś ofertę: ${esc(p.name)}. Pozostałym wykonawcom podziękowaliśmy w Twoim imieniu.` : `${p.name.split(' ')[0]} potwierdzi ją zwykle w ${p.response}. Dostaniesz powiadomienie.`}</p>
    <div class="receipt mt24" style="width:100%;text-align:left">
      <div class="ln"><span>Kiedy</span><b>${dayLabel(d)}, ${o.time}</b></div>
      <div class="ln"><span>Usługa</span><b>${catById(o.service).name}</b></div>
      <div class="ln"><span>Adres</span><b>${o.addr}</b></div>
      <div class="ln"><span>Na miejscu</span><b>${zl(o.total)} · ${o.pay || 'gotówka'}</b></div>
    </div>
    <div class="tiny faint mt16">Przekłuj kilka baniek, jeśli masz ochotę.</div>
  </div></div>
  <div class="footer" style="flex-direction:column;align-items:stretch;gap:8px">
    <button class="btn primary block" data-act="openOrderFromDone" data-a="${o.id}">Zobacz zlecenie</button>
    <button class="btn line block" data-act="openChat" data-a="${p.id}">${ic('message-circle', 's')}Napisz wiadomość</button>
  </div>`;
};

/* ---------- orders ---------- */
const PAST = ['done', 'cancel', 'noshow'];
const STATUS = {
  noshow: ['Nieobecność', 'st-cancel'],
  pending: ['Czeka na potwierdzenie', 'st-pending'], confirmed: ['Potwierdzone', 'st-confirmed'], enroute: ['W drodze', 'st-enroute'],
  progress: ['W trakcie', 'st-progress'], done: ['Zakończone', 'st-done'], cancel: ['Odwołane', 'st-cancel']
};
const statusText = s => STATUS[s][0];
const statusPill = s => `<span class="status ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

screens.orders = () => {
  const up = S.orders.filter(o => !PAST.includes(o.status)).sort((a, b) => a.date - b.date);
  const past = S.orders.filter(o => PAST.includes(o.status)).sort((a, b) => b.date - a.date);
  const list = S.ordersSeg === 'up' ? up : past;
  return `<div class="scroll"><div class="pad">
    <div class="row between" style="margin-top:12px"><h1 class="pagetitle" style="margin:0">Zlecenia</h1><button class="btn sm line" data-act="newPost">${ic('plus', 's')}Dodaj zlecenie</button></div><div style="height:14px"></div>
    <div class="seg"><button class="${S.ordersSeg === 'up' ? 'on' : ''}" data-act="seg" data-a="up">Nadchodzące (${up.length})</button><button class="${S.ordersSeg === 'past' ? 'on' : ''}" data-act="seg" data-a="past">Historia</button></div>
    ${S.ordersSeg === 'up' && S.posts.some(x => x.status === 'open') ? `<div class="section-h" style="margin-top:20px"><h3>Twoje ogłoszenia</h3></div><div class="stack">${S.posts.filter(x => x.status === 'open').map(postCard).join('')}</div><div class="section-h"><h3>Rezerwacje</h3></div>` : ''}
    <div class="stack mt16">
    ${list.length ? list.map((o, i) => { const p = proById(o.pro); const d = addDays(o.date); return `
      <button class="ocard ${S.ordersSeg === 'up' && i === 0 ? 'next' : ''}" data-act="openOrder" data-a="${o.id}">
        <div class="datebox"><b>${d.getDate()}</b><span>${MON[d.getMonth()]}</span></div>
        <div class="grow">
          <div class="row between" style="gap:8px"><span class="name">${catById(o.service).name}</span><b class="num small">${zl(o.total)}</b></div>
          <div class="tiny faint" style="margin:2px 0 8px">${dayLabel(d)}, ${o.time} · ${p.name}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${statusPill(o.status)}${o.freq !== 'once' ? `<span class="tag">${ic('repeat', 'xs')}${FREQ.find(f => f.id === o.freq).name}</span>` : ''}
          ${o.status === 'done' && !o.rated ? `<span class="tag yellow">${ic('star', 'xs')}Oceń</span>` : ''}${o.rated ? `<span class="tag">${ic('star', 'xs star')}${o.rated}/5</span>` : ''}</div>
        </div></button>`; }).join('') : `<div class="empty">${ic('calendar-plus')}<div style="font-weight:650;color:var(--ink)">Nic tu jeszcze nie ma</div><button class="btn sm primary mt16" data-act="openSearch">Znajdź wykonawcę</button></div>`}
    </div>
    ${S.ordersSeg === 'past' && past.length ? `<div class="note mt16">${ic('receipt', 's')}<span>Rachunki i faktury znajdziesz w szczegółach każdego zlecenia.</span></div>` : ''}
    <div class="sp"></div></div></div>`;
};

screens.order = ({ id }) => {
  const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const d = addDays(o.date);
  const flow = ['confirmed', 'enroute', 'progress', 'done'];
  const idx = o.status === 'pending' ? -1 : flow.indexOf(o.status);
  const tl = [
    ['Zarezerwowane', 'Wysłane do wykonawcy', 'calendar-check'],
    ['Potwierdzone', 'Wykonawca przyjął zlecenie', 'check'],
    ['W drodze', 'Zobaczysz, gdy wyruszy', 'car'],
    ['W trakcie', `${o.time}–${endTime(o.time, o.h)}`, 'sparkles'],
    ['Zakończone', 'Płacisz na miejscu i oceniasz', 'flag']
  ];
  const cur = o.status === 'cancel' ? -2 : o.status === 'done' ? 5 : idx + 1;
  const active = !PAST.includes(o.status);
  const e = { h: o.h };
  return `${topbar('Zlecenie', `<button class="iconbtn" data-act="openChat" data-a="${p.id}" aria-label="Czat">${ic('message-circle', 's')}</button>`)}
  <div class="scroll"><div class="pad">
    <div class="row between"><div><div class="eyebrow">${dayLabel(d)} · ${o.time}</div><h1 class="pagetitle" style="margin:4px 0 6px;font-size:26px">${catById(o.service).name}</h1></div></div>
    <div class="row" style="gap:6px">${statusPill(o.status)}${o.freq !== 'once' ? `<span class="tag">${ic('repeat', 'xs')}${FREQ.find(f => f.id === o.freq).name}</span>` : ''}</div>

    ${o.status === 'enroute' ? trackBlock(o, p) : ''}
    ${o.status === 'done' && !o.rated ? `<div class="note yellow mt16">${ic('hand-coins', 's')}<span>Sprzątanie zakończone. Rozlicz się z wykonawcą na miejscu i oceń wizytę. Twoja opinia pomoże innym wybrać.</span></div>` : ''}

    ${o.status === 'progress' ? liveBlock(o) : ''}
    ${o.status === 'done' && o.report ? reportBlock(o, p) : ''}
    ${o.issue ? issueBlock(o, p) : ''}
    <div class="card mt16"><div class="timeline">${tl.map((t, i) => `<div class="tl ${cur > i ? 'ok' : cur === i ? 'now' : ''}"><span class="dot">${ic(cur > i ? 'check' : t[2], 'xs')}</span><div><b>${t[0]}</b><span>${t[1]}</span></div></div>`).join('')}</div>
      ${active && !S.online ? `<button class="btn sm line mt16" data-act="advanceOrder" data-a="${o.id}">${ic('fast-forward', 's')}Symuluj kolejny status</button>` : ''}</div>

    <div class="card mt12"><div class="row">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${stars(p.rating)} · odpowiada w ${p.response}</div></div>
      <button class="iconbtn" data-act="toast" data-a="Połączenie przez numer maskowany w pełnej wersji" aria-label="Zadzwoń">${ic('phone', 's')}</button></div></div>

    <div class="section-h"><h3>Szczegóły</h3></div>
    <div class="receipt">
      <div class="ln"><span>Adres</span><b>${o.addr}</b></div>
      ${o.onsite ? `<div class="ln"><span>Na miejscu</span><b>${esc(o.onsite)}</b></div>` : ''}
      ${o.m2 ? `<div class="ln"><span>Metraż</span><b>${o.m2} m²</b></div>` : ''}
      <div class="ln"><span>Czas</span><b>ok. ${hrs(o.h)}</b></div>
      ${o.extras.length ? `<div class="ln"><span>Dodatki</span><b>${o.extras.map(id => EXTRAS.find(x => x.id === id).name).join(', ')}</b></div>` : ''}
      <div class="ln"><span>Płatność</span><b>${o.pay} · na miejscu</b></div>
      <div class="tot"><span class="muted small">Do zapłaty wykonawcy</span><b class="num">${zl(o.total)}</b></div>
    </div>
    ${o.status !== 'cancel' && !o.issue ? `<button class="linkrow mt12" data-act="openProblem" data-a="${o.id}">${ic('flag', 's')}Zgłoś problem z tą wizytą${ic('chevron-right', 's')}</button>` : ''}
    <div class="sp"></div>
  </div></div>
  ${active ? `<div class="footer"><button class="btn line" data-act="openResched" data-a="${o.id}">Przełóż</button><button class="btn danger" style="flex:1" data-act="sheet" data-a="cancel" data-b="${o.id}">Odwołaj</button></div>`
    : o.status === 'done' && !o.rated ? `<div class="footer"><button class="btn line" data-act="openProblem" data-a="${o.id}">Zgłoś problem</button><button class="btn primary" style="flex:1" data-act="openRate" data-a="${o.id}">Oceń wizytę</button></div>`
    : o.status === 'done' ? `<div class="footer"><button class="btn primary block" data-act="rebook" data-a="${o.id}">${ic('repeat', 's')}Zamów ponownie</button></div>` : ''}`;
};

screens.rate = ({ id }) => {
  const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const r = S.rate;
  const tags = ['Punktualność', 'Dokładność', 'Dobry kontakt', 'Kuchnia lśni', 'Łazienka jak nowa', 'Szybko'];
  return `${topbar('Ocena usługi')}
  <div class="scroll"><div class="pad" style="text-align:center">
    ${avatar(p, 'lg').replace('class="avatar', 'style="margin:8px auto 0" class="avatar')}
    <h1 class="pagetitle" style="font-size:24px;margin:14px 0 2px">Jak oceniasz sprzątanie?</h1>
    <div class="small muted">${esc(p.name)} · ${catById(o.service).name} · ${dayLabel(addDays(o.date))}</div>
    <div class="starsel">${[1, 2, 3, 4, 5].map(i => `<button style="--i:${i}" class="${i <= r.stars ? 'on' : ''}" data-act="rstar" data-a="${i}" aria-label="${i} gwiazdek">${ic('star')}</button>`).join('')}</div>
    <div class="small faint">${['', 'Słabo', 'Mogło być lepiej', 'W porządku', 'Dobrze', 'Rewelacyjnie'][r.stars]}</div>
    <div class="field" style="text-align:left"><span class="lbl">Co wyszło najlepiej?</span>
      <div class="chips">${tags.map(t => `<button class="chip ${r.tags.includes(t) ? 'on' : ''}" data-act="rtag" data-a="${t}">${t}</button>`).join('')}</div></div>
    <div class="field" style="text-align:left"><label for="rc">Opinia (opcjonalnie)</label>
      <textarea class="input" id="rc" placeholder="Pomóż innym wybrać" data-model="rate.comment">${esc(r.comment)}</textarea></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer"><button class="btn primary block" data-act="submitRate" data-a="${o.id}">${ic('send', 's')}Opublikuj opinię</button></div>`;
};

/* ---------- inbox & chat ---------- */
screens.inbox = () => {
  const ids = Object.keys(S.threads);
  const isPro = S.role === 'pro';
  const items = isPro
    ? Object.entries(S.pro.threads).map(([id, t]) => { const l = t.msgs[t.msgs.length - 1]; return { id, name: t.name, ini: t.ini, tone: t.tone, last: (l.me ? 'Ty: ' : '') + l.t, at: l.at, unread: t.unread }; })
    : ids.map(id => { const p = proById(id); const t = S.threads[id]; const l = t.msgs[t.msgs.length - 1]; return { id, name: p.name, ini: p.ini, tone: p.tone, last: (l.me ? 'Ty: ' : '') + l.t, at: l.at, unread: t.unread }; });
  return `<div class="scroll"><div class="pad"><h1 class="pagetitle" style="margin-top:12px">Wiadomości</h1></div>
    <div class="threads">${items.map(t => `<button class="thread" data-act="${isPro ? 'openPChat' : 'openChat'}" data-a="${t.id}">
      <div class="avatar sm ${t.tone}">${t.ini}</div>
      <div class="grow"><div class="row between"><span class="name">${esc(t.name)}</span><span class="tiny faint">${t.at}</span></div>
      <div class="small ${t.unread ? '' : 'muted'}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${t.unread ? 'font-weight:600' : ''}">${esc(t.last)}</div></div>
      ${t.unread ? '<span class="unread"></span>' : ''}</button>`).join('')}</div>
    <div class="pad"><div class="note mt24">${ic('shield-check', 's')}<span>${isPro ? 'Ustalenia w czacie zostają zapisane. Gdy klient zgłosi problem albo nie otworzy drzwi, mamy pełną historię.' : 'Rozmawiaj w aplikacji: ustalenia zostają zapisane, a my możemy pomóc, gdy coś pójdzie nie tak.'}</span></div></div>
  </div>`;
};

screens.chat = ({ id }) => {
  const p = proById(id);
  const t = (S.threads[id] ||= { unread: 0, msgs: [{ me: false, t: `Dzień dobry! Tu ${p.name.split(' ')[0]}. W czym mogę pomóc?`, at: nowTime() }] });
  t.unread = 0;
  const o = S.orders.find(x => x.pro === id && !PAST.includes(x.status));
  const qr = ['Czy masz własny odkurzacz?', 'Kod do domofonu: 14K2580', 'Mam kota, będzie w sypialni', 'Czy możesz godzinę wcześniej?'];
  return `<div class="topbar">${backBtn()}${avatar(p, 'sm')}<div class="grow" style="min-width:0"><div class="name">${esc(p.name)}</div><div class="tiny faint">${typingFor === id ? 'pisze…' : 'odpowiada zwykle w ' + p.response}</div></div>
    <button class="iconbtn" data-act="openPro" data-a="${p.id}" aria-label="Profil">${ic('user-round', 's')}</button></div>
    ${o ? `<button class="ctxbar" data-act="openOrder" data-a="${o.id}">${ic('calendar-check', 's')}<span class="grow" style="text-align:left">${catById(o.service).name} · ${dayLabel(addDays(o.date))}, ${o.time}</span>${statusPill(o.status)}</button>` : ''}
    <div class="scroll" id="msgScroll"><div class="msgs">
      <div class="msg sys">Nie podawaj danych karty ani numeru konta w czacie.</div>
      ${t.msgs.map(m => `<div class="msg ${m.me ? 'me' : 'them'}">${esc(m.t)}<time>${m.at}</time></div>`).join('')}
      ${typingFor === id ? '<div class="msg them" style="padding:0"><span class="typing"><i></i><i></i><i></i></span></div>' : ''}
    </div></div>
    <div class="quickreplies">${qr.map(q => `<button class="chip" data-act="quickReply" data-a="${esc(q)}" data-b="${id}">${esc(q)}</button>`).join('')}</div>
    <form class="composer" data-form="chat" data-id="${id}"><button type="button" class="iconbtn ghost" data-act="toast" data-a="Wysyłanie zdjęć w pełnej wersji" aria-label="Zdjęcie">${ic('camera', 's')}</button><input id="chatInput" name="m" placeholder="Wiadomość" autocomplete="off"><button class="send" type="submit" aria-label="Wyślij">${ic('send-horizontal', 's')}</button></form>`;
};
let typingFor = null;
const REPLIES = {
  default: ['Jasne, dziękuję za informację!', 'Dobrze, zanotowałam.', 'Nie ma problemu, do zobaczenia!'],
  odkurzacz: 'Tak, mam własny odkurzacz z filtrem HEPA i mop parowy.',
  kod: 'Dziękuję, kod widzę. Zadzwonię domofonem chwilę przed.',
  kot: 'Super, lubię koty. Sypialnię zostawię na koniec albo pominę, jak wolisz.',
  wcześniej: 'Sprawdzę grafik… Tak, mogę być godzinę wcześniej. Zmienię termin w zleceniu.'
};
function sendMsg(id, text) {
  if (!text.trim()) return;
  const t = S.threads[id]; t.msgs.push({ me: true, t: text.trim(), at: nowTime() });
  typingFor = id; render(); scrollChat();
  setTimeout(() => {
    const low = text.toLowerCase();
    const key = Object.keys(REPLIES).find(k => k !== 'default' && low.includes(k));
    const reply = key ? REPLIES[key] : REPLIES.default[t.msgs.length % 3];
    t.msgs.push({ me: false, t: reply, at: nowTime() }); typingFor = null; persist();
    if (top().name === 'chat') { render(); scrollChat(); } else { t.unread++; toast(`${proById(id).name.split(' ')[0]}: ${reply}`, 'message-circle'); render(); }
  }, 1400);
}
function scrollChat() { const el = document.getElementById('msgScroll'); if (el) el.scrollTop = el.scrollHeight; }

/* ---------- powiadomienia ---------- */
function pushNotif(icon, t, d, act, a) { S.notifs.unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), icon, t, d, at: nowTime(), read: false, act, a }); }
screens.notifs = () => {
  const fresh = S.notifs.filter(n => !n.read), old = S.notifs.filter(n => n.read);
  const row = n => `<button class="notif ${n.read ? '' : 'new'}" data-act="openNotif" data-a="${n.id}"><span class="ni">${ic(n.icon, 's')}</span><div class="grow"><div class="row between" style="gap:8px"><b class="small">${esc(n.t)}</b><span class="tiny faint">${n.at}</span></div><div class="tiny muted">${esc(n.d)}</div></div></button>`;
  const pr = S.notifPrefs; const tog = (k, t, sub) => `<button class="toggle-row" data-act="notifPref" data-a="${k}"><div class="grow"><b>${t}</b><span>${sub}</span></div><span class="switch ${pr[k] ? 'on' : ''}"></span></button>`;
  return `${topbar('Powiadomienia', fresh.length ? `<button class="btn sm line" data-act="readAll">Przeczytane</button>` : '')}
  <div class="scroll"><div class="pad">
    ${fresh.length ? `<div class="eyebrow mt8">Nowe</div><div class="notifs mt8">${fresh.map(row).join('')}</div>` : ''}
    ${old.length ? `<div class="eyebrow mt24">Wcześniej</div><div class="notifs mt8">${old.map(row).join('')}</div>` : ''}
    ${!S.notifs.length ? `<div class="empty">${ic('bell-off')}<div>Na razie cisza</div></div>` : ''}
    <div class="section-h"><h3>Jak mamy przypominać?</h3></div>
    <div class="card" style="padding:2px 16px">${tog('push', 'Powiadomienia w telefonie', 'Potwierdzenia, oferty, odpowiedzi')}${tog('sms', 'SMS dzień przed wizytą', 'Także do osoby, która będzie na miejscu')}${tog('email', 'E-mail z podsumowaniem', 'Raz w tygodniu')}</div>
    <div class="sp"></div>
  </div></div>`;
};

/* ---------- przełożenie i pominięcie wizyty ---------- */
function reschedBody(o) {
  const p = proById(o.pro); const R = S.resched; const days = Array.from({ length: 12 }, (_, i) => addDays(i + 1));
  return `<div class="small muted" style="margin-top:-4px">Teraz: ${dayLabel(addDays(o.date))}, ${o.time} · ${esc(p.name)}</div>
    <div class="field" style="margin-top:14px"><span class="lbl">Nowy dzień</span><div class="dates">${days.map((d, i) => { const di = i + 1; const free = SLOTS.some(t => !slotTaken(p.id, di, t)); return `<button class="date ${R.day === di ? 'on' : ''}" data-act="reschedDay" data-a="${di}" ${free ? '' : 'disabled style="opacity:.4"'}>${DAYS[d.getDay()]}<b>${d.getDate()}</b></button>`; }).join('')}</div></div>
    <div class="field"><span class="lbl">Godzina</span><div class="slots">${SLOTS.map(t => `<button class="slot ${R.time === t ? 'on' : ''}" data-act="reschedTime" data-a="${t}" ${slotTaken(p.id, R.day, t) ? 'disabled' : ''}>${t}</button>`).join('')}</div></div>
    <div class="note mt12">${ic('info', 's')}<span>${p.name.split(' ')[0]} dostanie prośbę o zmianę i potwierdzi ją w aplikacji. Do tego czasu stary termin jest zarezerwowany.</span></div>`;
}

/* ---------- zgłoszenie problemu ---------- */
const ISSUE_CATS = ['Niedokładnie posprzątane', 'Szkoda lub zniszczenie', 'Spóźnienie', 'Wykonawca nie przyszedł', 'Inne'];
const ISSUE_WANTS = ['Poprawka w ciągu 24 h', 'Kontakt telefoniczny', 'Tylko informuję'];
screens.problem = ({ id }) => {
  const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const P = S.problem;
  return `${topbar('Zgłoś problem')}
  <div class="scroll"><div class="pad">
    <div class="small muted">${catById(o.service).name} · ${dayLabel(addDays(o.date))}, ${o.time} · ${esc(p.name)}</div>
    <div class="field"><span class="lbl">Co się stało?</span><div class="chips">${ISSUE_CATS.map(c => `<button class="chip ${P.cat === c ? 'on' : ''}" data-act="probSet" data-a="cat" data-b="${c}">${c}</button>`).join('')}</div></div>
    <div class="field"><label for="pdesc2">Opisz krótko</label><textarea class="input" id="pdesc2" placeholder="np. kamień przy baterii w łazience został, pękł wazon na półce w salonie" data-model="problem.desc">${esc(P.desc)}</textarea></div>
    <div class="field"><span class="lbl">Zdjęcia <span class="faint" style="font-weight:500">(${P.photos.length}/4)</span></span>
      <div class="photos">${P.photos.map(src => `<div class="ph" style="background-image:url(${src})"></div>`).join('')}${P.photos.length < 4 ? `<label class="ph" for="probPhotoIn">${ic('camera')}<input type="file" id="probPhotoIn" accept="image/*" multiple></label>` : ''}</div>
      <div class="hint">Zdjęcia bardzo pomagają, szczególnie przy szkodach.</div></div>
    <div class="field"><span class="lbl">Czego oczekujesz?</span><div class="chips">${ISSUE_WANTS.map(w => `<button class="chip ${P.want === w ? 'on' : ''}" data-act="probSet" data-a="want" data-b="${w}">${w}</button>`).join('')}</div></div>
    <div class="note mt16">${ic('scale', 's')}<span>Płacisz bezpośrednio wykonawcy, więc to on rozwiązuje problem. My przekazujemy zgłoszenie, pilnujemy odpowiedzi w ciągu 24 h, a zgłoszenia wpływają na pozycję wykonawcy w wynikach.${P.cat === 'Szkoda lub zniszczenie' && p.insured ? ` ${p.name.split(' ')[0]} ma polisę OC, która może pokryć szkodę.` : ''}</span></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer"><button class="btn primary block" data-act="sendProblem" data-a="${o.id}" ${P.cat ? '' : 'disabled'}>${ic('send', 's')}Wyślij zgłoszenie</button></div>`;
};
function issueBlock(o, p) {
  const st = o.issue.status; const steps = [['sent', 'Zgłoszenie wysłane', o.issue.at], ['answered', 'Wykonawca odpowiedział', o.issue.answeredAt || 'czeka, max 24 h'], ['resolved', 'Rozwiązane', '']];
  const idx = steps.findIndex(x => x[0] === st);
  return `<div class="card mt16 issue"><div class="row between"><b class="small">${ic('flag', 'xs')} ${esc(o.issue.cat)}</b><span class="tag ${st === 'resolved' ? 'mint' : 'yellow'}">${st === 'resolved' ? 'Rozwiązane' : 'W toku'}</span></div>
    <div class="tiny muted mt8">Oczekujesz: ${esc(o.issue.want)}</div>
    <div class="timeline mt12">${steps.map((x, i) => `<div class="tl ${i < idx || st === 'resolved' ? 'ok' : i === idx ? 'now' : ''}"><span class="dot">${ic(i <= idx ? 'check' : 'circle', 'xs')}</span><div><b>${x[1]}</b><span>${x[2]}</span></div></div>`).join('')}</div>
    ${st === 'answered' ? `<div class="row mt12" style="gap:8px;flex-wrap:wrap"><button class="btn sm line" data-act="openChat" data-a="${p.id}">${ic('message-circle', 's')}Zobacz odpowiedź</button><button class="btn sm dark" data-act="resolveIssue" data-a="${o.id}">Problem rozwiązany</button></div>` : ''}
  </div>`;
}

/* ---------- zaproszenie od wykonawcy: co widzi klient ---------- */
function inviterPro(id) {
  if (id !== 'me') return proById(id);
  const L = S.pro.listing; return { id: 'me', name: L.name, ini: L.name.split(' ').map(w => w[0]).join('').slice(0, 2), tone: 't-mint', rating: 4.92, reviews: 38, rate: L.rate, tagline: L.tagline, services: L.services, area: baseLabelOf(), verified: L.idVerified, insured: L.insured, nextSlot: 'Jutro 9:00' };
}
screens.invited = ({ id }) => {
  const p = inviterPro(id); const first = p.name.split(' ')[0]; const preview = id === 'me';
  return `<div class="topbar">${backBtn()}<h2>${preview ? 'Podgląd zaproszenia' : 'Zaproszenie'}</h2></div>
  <div class="scroll"><div class="pad">
    ${preview ? `<div class="note yellow">${ic('eye', 's')}<span>Tak zobaczy Twój link klient, który nie ma jeszcze aplikacji.</span></div>` : ''}
    <div class="invited">
      <div class="avatar lg ${p.tone}">${esc(p.ini)}</div>
      <div class="eyebrow mt16">Zaproszenie</div>
      <h1>${esc(first)} zaprasza Cię do Lśni</h1>
      <p class="muted">${esc(p.tagline)}</p>
      <div class="row" style="gap:8px;justify-content:center">${stars(p.rating)}<span class="tiny faint">${p.reviews} opinii · ${p.area}</span>${p.verified ? `<span class="tag mint">${ic('badge-check', 'xs')}Zweryfikowana</span>` : ''}</div>
    </div>
    <div class="section-h"><h3>Co się zmienia</h3></div>
    <div class="checklist">${[['calendar-check', 'Widzisz wolne terminy i rezerwujesz w aplikacji, bez SMS-ów'], ['bell-ring', 'Dostajesz przypomnienie dzień przed wizytą'], ['repeat', 'Stałe sprzątanie ustawiasz raz, a terminy same się powtarzają']].map(([i, t]) => `<div>${ic(i, 's')}<span>${t}</span></div>`).join('')}</div>
    <div class="section-h"><h3>Co zostaje bez zmian</h3></div>
    <div class="checklist">${[['hand-coins', 'Płacisz jak dotąd: gotówką, BLIK-iem lub przelewem'], ['user-check', `Umawiasz się bezpośrednio: ${esc(p.name)}. Nie pokazujemy Ci innych wykonawców`], ['gift', 'Aplikacja jest dla Ciebie darmowa']].map(([i, t]) => `<div>${ic(i, 's')}<span>${t}</span></div>`).join('')}</div>
    <div class="sp"></div>
  </div></div>
  <div class="footer" style="flex-direction:column;align-items:stretch;gap:8px">
    <button class="btn primary block" ${preview ? 'data-act="toast" data-a="To tylko podgląd"' : `data-act="startBooking" data-a="${p.id}"`}>Zarezerwuj termin · od ${p.rate} zł/h</button>
    ${preview ? '' : `<button class="btn line block" data-act="openPro" data-a="${p.id}">Zobacz profil i opinie</button>`}
  </div>`;
};

/* ---------- czat po stronie wykonawcy ---------- */
const P_REPLIES = { kod: 'Kod to 14K2580, mieszkanie na 4 piętrze.', park: 'Najlepiej na podwórku od Rakowieckiej, jest miejsce dla gości.', drodze: 'Super, czekam!', skończ: 'Dziękuję bardzo, wygląda świetnie!', default: 'Dobrze, dziękuję!' };
screens.pchat = ({ id }) => {
  const t = S.pro.threads[id]; t.unread = 0;
  const qr = ['Jestem w drodze, będę za 10 min', 'Poproszę o kod do domofonu', 'Gdzie mogę zaparkować?', 'Skończyłam, dziękuję!'];
  return `<div class="topbar">${backBtn()}<div class="avatar sm ${t.tone}">${esc(t.ini)}</div><div class="grow" style="min-width:0"><div class="name">${esc(t.name)}</div><div class="tiny faint">${typingFor === 'p-' + id ? 'pisze…' : 'klient'}</div></div>
    <button class="iconbtn" data-act="toast" data-a="Połączenie przez numer maskowany" aria-label="Zadzwoń">${ic('phone', 's')}</button></div>
    <div class="scroll" id="msgScroll"><div class="msgs">
      ${t.msgs.map(m => `<div class="msg ${m.me ? 'me' : 'them'}">${esc(m.t)}<time>${m.at}</time></div>`).join('')}
      ${typingFor === 'p-' + id ? '<div class="msg them" style="padding:0"><span class="typing"><i></i><i></i><i></i></span></div>' : ''}
    </div></div>
    <div class="quickreplies">${qr.map(q => `<button class="chip" data-act="pQuick" data-a="${esc(q)}" data-b="${id}">${esc(q)}</button>`).join('')}</div>
    <form class="composer" data-form="pchat" data-id="${id}"><input id="chatInput" name="m" placeholder="Wiadomość do klienta" autocomplete="off"><button class="send" type="submit" aria-label="Wyślij">${ic('send-horizontal', 's')}</button></form>`;
};
function sendPMsg(id, text) {
  if (!text.trim()) return; const t = S.pro.threads[id]; t.msgs.push({ me: true, t: text.trim(), at: nowTime() });
  typingFor = 'p-' + id; render(); scrollChat();
  setTimeout(() => {
    const low = text.toLowerCase(); const key = Object.keys(P_REPLIES).find(k => k !== 'default' && low.includes(k));
    t.msgs.push({ me: false, t: P_REPLIES[key || 'default'], at: nowTime() }); typingFor = null;
    if (top().name === 'pchat') { render(); scrollChat(); } else { t.unread++; toast(`${t.name}: ${P_REPLIES[key || 'default']}`, 'message-circle'); render(); }
  }, 1300);
}

/* ---------- profile ---------- */
screens.profile = () => {
  if (S.role === 'pro') return proProfile();
  const done = S.orders.filter(o => o.status === 'done').length;
  return `<div class="scroll"><div class="pad">
    <div class="row mt16" style="gap:14px"><div class="avatar lg t-blue" style="width:72px;height:72px;font-size:26px;border-radius:24px">${S.me ? esc(S.me.name.split(' ').map(w => w[0]).join('').slice(0, 2)) : 'KN'}</div>
      <div><h1 class="pagetitle" style="margin:0;font-size:26px">${esc(S.me ? S.me.name : 'Kasia Nowicka')}</h1><div class="small muted">${S.me ? esc(S.me.phone.replace(/^\+48(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')) : 'Klientka od marca 2025'} · ${done} zakończonych zleceń</div></div></div>
    <div class="section-h"><h3>Ulubieni</h3></div>
    <div class="stack">${S.favs.map(id => proById(id)).filter(Boolean).map(p => `<div class="pcard" style="padding:12px;align-items:center" role="button" tabindex="0" data-act="openPro" data-a="${p.id}">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${stars(p.rating)} · ${p.nextSlot}</div></div><button class="btn sm primary" data-act="startBooking" data-a="${p.id}">Rezerwuj</button></div>`).join('') || '<div class="small muted">Dotknij serca przy wykonawcy, żeby dodać go tutaj.</div>'}</div>
    <div class="menu mt24">
      <button class="mi" data-act="toast" data-a="Edycja adresów w pełnej wersji">${ic('map-pin', 's')}Adresy<span class="r">2 ${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Dane do faktury w pełnej wersji">${ic('receipt', 's')}Dane do faktury<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Ustawienia powiadomień w pełnej wersji">${ic('bell', 's')}Powiadomienia<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Centrum pomocy w pełnej wersji">${ic('life-buoy', 's')}Pomoc i gwarancja<span class="r">${ic('chevron-right', 's')}</span></button>
      ${S.online ? accountMenu() : ''}
    </div>
    <div class="becomepro mt24">
      <svg viewBox="0 0 120 120" aria-hidden="true"><rect x="38" y="44" width="44" height="64" rx="12" fill="currentColor" opacity=".9"/><rect x="48" y="22" width="24" height="26" rx="6" fill="currentColor" opacity=".9"/><path d="M72 30 h22 v8 h-22z" fill="currentColor" opacity=".9"/><circle cx="104" cy="22" r="4" fill="currentColor" opacity=".5"/><circle cx="110" cy="36" r="3" fill="currentColor" opacity=".4"/><circle cx="100" cy="44" r="2.5" fill="currentColor" opacity=".3"/></svg>
      <h4>Sprzątasz zawodowo?</h4>
      <p>Bez prowizji i bez abonamentu. Klienci płacą Ci bezpośrednio. Na start dostajesz 50 zł na wyróżnienia.</p>
      <button class="btn sm" data-act="becomePro">Dodaj ogłoszenie ${ic('arrow-right', 's')}</button>
    </div>
    <div class="sp"></div></div></div>`;
};

/* ================= PROVIDER SCREENS ================= */
screens.dash = () => {
  const P = S.pro; const L = P.listing;
  const week = S.online && S.pro.week ? S.pro.week : [{ d: 'pn', v: 180 }, { d: 'wt', v: 0 }, { d: 'śr', v: 320 }, { d: 'cz', v: 210 }, { d: 'pt', v: 0 }, { d: 'sb', v: 530 }, { d: 'nd', v: 0 }];
  const todayIdx = (today.getDay() + 6) % 7; const max = Math.max(...week.map(w => w.v));
  const sum = week.reduce((a, b) => a + b.v, 0);
  const todos = profileTodos();
  const pct = Math.round(todos.filter(t => t.ok).length / todos.length * 100);
  const nextJob = P.jobs.slice().sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))[0];
  return `<div class="scroll">
    <div class="rolebar"><span class="proflag"><i></i>Tryb wykonawcy</span></div>
    <div class="pad">
      <div class="row between mt12"><div><div class="small muted">Dzień dobry,</div><h1 class="pagetitle" style="margin:0">${esc(L.name.split(' ')[0])}</h1></div>
        <button class="row" style="gap:8px" data-act="toggleOnline"><span class="small ${P.online ? '' : 'faint'}" style="font-weight:600">${P.online ? 'Przyjmuję zlecenia' : 'Niedostępna'}</span><span class="switch ${P.online ? 'on' : ''}"></span></button></div>

      <div class="earn mt16">
        <div class="row between"><span class="eyebrow" style="color:inherit;opacity:.6">Ten tydzień</span><span class="tiny" style="opacity:.7">płatności na miejscu</span></div>
        <div class="amt num">${zl(sum)}</div>
        <div class="sub">${P.jobs.length + 4} zlecenia · śr. ${Math.round(sum / 26)} zł/h · 0 zł prowizji</div>
        <div class="bars">${week.map((w, i) => `<div class="bar ${i === todayIdx ? 'today' : ''}">${w.v === max ? `<em>${w.v}</em>` : ''}<i style="height:${w.v ? Math.max(8, w.v / max * 78) : 4}%"></i>${w.d}</div>`).join('')}</div>
      </div>

      <div class="mt12">${boostCard()}</div>
      <button class="invitecta mt8" data-act="openInvite">${ic('user-plus', 's')}<span class="grow">Zaproś swoich klientów i zdobądź <b>20 zł kredytu</b> za każdego</span>${ic('chevron-right', 's')}</button>

      <div class="section-h"><h3>Nowe zapytania</h3><span class="tag ${P.requests.length ? 'rose' : ''}">${P.requests.length}</span></div>
      <div class="stack">${P.requests.length ? P.requests.map(reqCard).join('') : `<div class="card empty" style="padding:24px">${ic('inbox')}<div style="font-weight:650;color:var(--ink)">Wszystko obsłużone</div><div class="small mt8">Nowe zapytania pojawią się tutaj i w powiadomieniach.</div></div>`}</div>

      <div class="section-h"><h3>Giełda zleceń w okolicy</h3><span class="tiny faint">klienci czekają na oferty</span></div>
      <div class="stack">${P.market.map(marketCard).join('')}</div>

      ${nextJob ? `<div class="section-h"><h3>Następne zlecenie</h3><button data-act="setTab" data-a="calendar">Grafik</button></div>
      <div class="job"><div class="time">${nextJob.time}<span>${dayLabel(addDays(nextJob.day))}</span></div><div class="blk ${nextJob.tone}"><div class="row between"><b class="small">${catById(nextJob.service).name}</b><b class="small num">${zl(nextJob.pay)}</b></div><div class="tiny faint">${nextJob.client} · ${nextJob.area} · do ${nextJob.end}</div></div></div>` : ''}

      <div class="section-h"><h3>Statystyki ogłoszenia</h3><span class="tiny faint">30 dni</span></div>
      <div class="kpis">
        <div class="kpi"><span class="tiny faint">Wyświetlenia profilu</span><b class="num">312</b><span class="d">+18% m/m</span></div>
        <div class="kpi"><span class="tiny faint">Zapytania → zlecenia</span><b class="num">41%</b><span class="d">powyżej średniej</span></div>
        <div class="kpi"><span class="tiny faint">Ocena</span><b class="num">4,92</b><span class="tiny faint">38 opinii</span></div>
        <div class="kpi"><span class="tiny faint">Czas odpowiedzi</span><b>11 min</b><span class="tiny faint">cel: poniżej 15</span></div>
      </div>

      <div class="card mt24">
        <div class="row between"><b>Profil uzupełniony w ${pct}%</b><span class="tiny faint">${todos.filter(t => !t.ok).length} do zrobienia</span></div>
        <div class="meter"><i style="width:${pct}%"></i></div>
        <div class="tiny faint">Pełne profile dostają średnio 2,3× więcej zapytań.</div>
        <div class="mt8">${todos.map(t => `<button class="todo ${t.ok ? 'ok' : ''}" data-act="${t.act}" data-a="${t.arg || ''}"><span class="box">${t.ok ? ic('check', 'xs') : ''}</span><span class="t small">${t.label}</span>${t.ok ? '' : `<span class="boost">${t.boost}</span>`}</button>`).join('')}</div>
      </div>
      <div class="sp"></div>
    </div></div>`;
};
function profileTodos() {
  const L = S.pro.listing;
  return [
    { label: 'Potwierdź tożsamość', ok: L.idVerified, boost: '+ odznaka', act: 'setTab', arg: 'listing' },
    { label: 'Dodaj co najmniej 3 zdjęcia z realizacji', ok: L.photos.length >= 3, boost: '+23% zapytań', act: 'setTab', arg: 'listing' },
    { label: 'Wgraj polisę OC', ok: L.insured, boost: '+ odznaka OC', act: 'uploadOC' },
    { label: 'Opisz siebie w min. 80 znakach', ok: L.bio.length >= 80, boost: '+11% zapytań', act: 'setTab', arg: 'listing' },
    { label: 'Zaproś pierwszych 3 stałych klientów', ok: S.pro.boost.invite.joined >= 3, boost: '+60 zł kredytu', act: 'openInvite' },
    { label: 'Ustaw dostępność na 2 tygodnie', ok: true, boost: '', act: 'setTab', arg: 'calendar' }
  ];
}
function reqCard(r) {
  const c = catById(r.service);
  return `<div class="req">
    <div class="head"><div class="row" style="gap:10px"><span class="avatar sm ${c.tone}">${ic(c.icon, 's')}</span><div><b class="small">${c.name}</b><div class="tiny faint">${esc(r.client)} · ${ic('star', 'xs star')} ${r.crating.toFixed(1).replace('.', ',')} jako klient</div></div></div>
      <div><div class="pay num">${zl(r.pay)}</div><div class="tiny faint" style="text-align:right">${r.freq !== 'once' ? FREQ.find(f => f.id === r.freq).name.toLowerCase() : 'jednorazowo'}</div></div></div>
    <div class="facts">
      <div>${ic('calendar', 's')}${dayLabel(addDays(r.day))}, ${r.time}</div>
      <div>${ic('clock', 's')}ok. ${hrs(r.h)}</div>
      <div>${ic('ruler', 's')}${r.m2} m² · ${r.baths} łaz.</div>
      <div>${ic('navigation', 's')}${kmf(roadKm(S.pro.listing.base, r))} km · ${driveMin(roadKm(S.pro.listing.base, r))} min</div>
    </div>
    <div class="quote">„${esc(r.note)}”</div>
    <div class="row between" style="margin-bottom:10px;gap:8px"><span class="timer">${ic('timer', 'xs')}Wygasa za ${r.expires} min</span><span class="tiny faint" style="text-align:right">Płatność: ${r.payHow || 'gotówka'}, na miejscu</span></div>
    <div class="acts"><button class="btn line sm" data-act="sheet" data-a="decline" data-b="${r.id}">Odrzuć</button><button class="btn primary sm" data-act="acceptReq" data-a="${r.id}">${ic('check', 's')}Przyjmij zlecenie</button></div>
  </div>`;
}

screens.calendar = () => {
  const P = S.pro; const days = Array.from({ length: 14 }, (_, i) => addDays(i));
  const jobs = P.jobs.filter(j => j.day === P.calDay).sort((a, b) => a.time.localeCompare(b.time));
  const dsum = jobs.reduce((a, j) => a + j.pay, 0);
  return `<div class="scroll"><div class="pad">
    <h1 class="pagetitle" style="margin-top:12px">Grafik</h1>
    <div class="dates">${days.map((d, i) => { const has = P.jobs.some(j => j.day === i); return `<button class="date ${P.calDay === i ? 'on' : ''}" data-act="calDay" data-a="${i}" style="position:relative">${i === 0 ? 'dziś' : DAYS[d.getDay()]}<b>${d.getDate()}</b>${has ? '<span style="position:absolute;bottom:6px;left:50%;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--glove)"></span>' : ''}</button>`; }).join('')}</div>
    <div class="row between mt24"><b>${DAYS_LONG[addDays(P.calDay).getDay()][0].toUpperCase() + DAYS_LONG[addDays(P.calDay).getDay()].slice(1)}, ${addDays(P.calDay).getDate()} ${MON[addDays(P.calDay).getMonth()]}</b><span class="small muted">${jobs.length ? `${jobs.length} zlec. · ${zl(dsum)}` : ''}</span></div>
    <div class="stack mt12">${jobs.length ? jobs.map(j => `<div class="job"><div class="time">${j.time}<span>${j.end}</span></div><div class="blk ${j.tone}"><div class="row between"><b class="small">${catById(j.service).name}</b><b class="small num">${zl(j.pay)}</b></div><div class="tiny faint">${j.client} · ${j.area}</div>
      <div class="row mt8" style="gap:6px;flex-wrap:wrap"><button class="btn sm line" style="height:32px" data-act="toast" data-a="Nawigacja otworzy się w aplikacji map">${ic('navigation', 'xs')}Trasa</button><button class="btn sm line" style="height:32px" data-act="openPChat" data-a="${j.thread || ''}" data-b="${esc(j.client)}">${ic('message-circle', 'xs')}Czat</button>${j.noshow ? `<span class="tag rose">${ic('door-closed', 'xs')}Nieobecność zgłoszona</span>` : S.pro.calDay === 0 ? `<button class="btn sm line" style="height:32px" data-act="sheet" data-a="noshow" data-b="${P.jobs.indexOf(j)}">${ic('door-closed', 'xs')}Nie otworzył</button>` : ''}</div></div></div>`).join('')
      : `<div class="card empty" style="padding:22px">${ic('coffee')}<div style="font-weight:650;color:var(--ink)">Wolny dzień</div><div class="small mt8">${P.avail[addDays(P.calDay).getDay()] ? 'Jesteś dostępna, klienci mogą rezerwować ten dzień.' : 'Ten dzień jest zablokowany dla klientów.'}</div></div>`}</div>

    ${dayRoute(jobs)}
    <div class="section-h"><h3>Stała dostępność</h3><span class="tiny faint">widzą ją klienci</span></div>
    <div class="card" style="padding:4px 16px"><div class="avail">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="a"><b class="small">${DAYS[d]}</b><span class="grow small ${P.avail[d] ? 'muted' : 'faint'}">${P.avail[d] ? '8:00 – 18:00' : 'Niedostępna'}</span><button class="switch ${P.avail[d] ? 'on' : ''}" data-act="toggleAvail" data-a="${d}" aria-label="Dostępność ${DAYS_LONG[d]}"></button></div>`).join('')}</div></div>
    <button class="btn line block mt12" data-act="toast" data-a="Urlop zapisany: klienci nie zobaczą tych dni" >${ic('palmtree', 's')}Zaplanuj urlop</button>
    <div class="sp"></div></div></div>`;
};

screens.listing = () => {
  const L = S.pro.listing;
  const fake = { _promoted: S.pro.boost.active.length > 0, id: 'me', name: L.name, ini: L.name.split(' ').map(w => w[0]).join('').slice(0, 2), tone: 't-mint', kind: 'Osoba prywatna', area: baseLabelOf(), dist: 0, rating: 4.92, reviews: 38, verified: L.idVerified, insured: L.insured, invoice: L.invoice, supplies: L.supplies, eco: L.eco, pets: L.pets, rate: L.rate, tagline: L.tagline || 'Dodaj krótki opis', nextSlot: 'Jutro 9:00', todayFree: false };
  const month = Math.round(L.rate * 80);
  return `<div class="scroll"><div class="pad">
    <div class="row between mt12"><h1 class="pagetitle" style="margin:0">Ogłoszenie</h1><span class="tag ${L.published ? 'mint' : ''}">${L.published ? 'Opublikowane' : 'Szkic'}</span></div>
    <div class="small muted" style="margin:6px 0 14px">Tak widzą Cię klienci w wynikach wyszukiwania:</div>
    <div class="preview-wrap" id="preview">${proCard(fake).replace(/data-act="openPro"/, 'data-act="noop"').replace(/data-act="fav"/, 'data-act="noop"')}</div>

    <div class="field"><label for="lname">Wyświetlana nazwa</label><input class="input" id="lname" value="${esc(L.name)}" data-model="pro.listing.name" data-live="preview"></div>
    <div class="field"><label for="ltag">Jedno zdanie o Twojej usłudze</label><input class="input" id="ltag" maxlength="80" value="${esc(L.tagline)}" data-model="pro.listing.tagline" data-live="preview"><div class="hint">Napisz konkretnie: co sprzątasz i czym się wyróżniasz.</div></div>

    <div class="field"><span class="lbl">Usługi</span><div class="chips">${CATS.map(c => `<button class="chip ${L.services.includes(c.id) ? 'on' : ''}" data-act="lsvc" data-a="${c.id}">${c.short}</button>`).join('')}</div></div>

    <div class="field"><div class="row between"><span class="lbl" style="margin:0">Stawka godzinowa</span><span class="big-val num" id="rateVal">${L.rate}<small>zł/h</small></span></div>
      <input type="range" id="lrate" min="30" max="90" step="1" value="${L.rate}" data-model="pro.listing.rate" data-type="num" data-live="rate" aria-label="Stawka">
      <div class="market"><span>30 zł</span><span>średnia w Twoim mieście: <b style="color:var(--ink)">46 zł/h</b></span><span>90 zł</span></div>
      <div class="note mint mt12">${ic('trending-up', 's')}<span id="rateHint">Przy 20 h tygodniowo zarobisz ok. <b>${zl(month)}</b> miesięcznie. Lśni nie bierze prowizji.</span></div></div>

    <div class="field"><span class="lbl">Minimalny czas wizyty</span>
      <div class="stepper"><span>${hrs(L.minH)}</span><div class="ctl"><button data-act="lmin" data-a="-0.5" aria-label="Mniej">${ic('minus', 's')}</button><button data-act="lmin" data-a="0.5" aria-label="Więcej">${ic('plus', 's')}</button></div></div></div>

    <div class="field"><span class="lbl">Obszar pracy</span>
      <button class="nearby" data-act="openArea">
        ${geoMap('listing-mini', { h: 140, static: true, reset: true, center: [L.base.x, L.base.y], zoom: 120 / (L.radius + 1), labels: false, mb: { circles: L.base.lat != null ? [{ lat: L.base.lat, lng: L.base.lng, km: L.radius / ROAD }] : [] },
          layer: circleSVG(L.base.x, L.base.y, L.radius, 'gm-reach strong'), markers: [homeMark(L.base)] })}
        <div class="nearby-t"><b>Dojeżdżam do ${L.radius} km od: ${esc(baseLabelOf())}</b><span>${L.kmOn ? 'Za dojazd: ' + feeText(L) : 'Dojazd w cenie'}</span></div>
      </button></div>

    <div class="field"><span class="lbl">Udogodnienia</span><div class="card" style="padding:2px 16px">
      ${[['supplies', 'Przynoszę własne środki i sprzęt', 'Klienci najczęściej filtrują po tej opcji'], ['eco', 'Ekologiczne środki', 'Bez chloru, bezpieczne dla dzieci'], ['pets', 'Zwierzęta mi nie przeszkadzają', ''], ['invoice', 'Wystawiam fakturę VAT', 'Pokażemy Cię firmom i biurom']].map(([k, t, s]) => `<button class="toggle-row" data-act="ltoggle" data-a="${k}"><div class="grow"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div><span class="switch ${L[k] ? 'on' : ''}"></span></button>`).join('')}
    </div></div>

    <div class="field"><span class="lbl">Zdjęcia z realizacji <span class="faint" style="font-weight:500">(${L.photos.length}/8)</span></span>
      <div class="photos">${L.photos.map((src, i) => `<div class="ph" style="background-image:url(${src})"><button class="iconbtn" style="position:absolute;top:4px;right:4px;width:26px;height:26px" data-act="lphotoDel" data-a="${i}" aria-label="Usuń">${ic('x', 'xs')}</button></div>`).join('')}
        ${L.photos.length < 8 ? `<label class="ph" for="photoIn">${ic('image-plus')}<input type="file" id="photoIn" accept="image/*" multiple></label>` : ''}</div>
      <div class="hint">Zdjęcia „przed i po” zwiększają liczbę zapytań średnio o 23%.</div></div>

    <div class="field"><label for="lbio">O mnie</label><textarea class="input" id="lbio" data-model="pro.listing.bio" data-live="bio">${esc(L.bio)}</textarea><div class="hint" id="bioHint">${L.bio.length} znaków${L.bio.length < 80 ? ' · napisz co najmniej 80' : ''}</div></div>

    <div class="field"><span class="lbl">Weryfikacja</span><div class="badges" style="margin:0">
      <div class="b ${L.idVerified ? '' : 'off'}">${ic('badge-check', 's')}<span class="grow">Dowód osobisty</span><span class="tag mint">Potwierdzony</span></div>
      <div class="b ${L.insured ? '' : 'off'}">${ic('shield-check', 's')}<span class="grow">Polisa OC</span>${L.insured ? '<span class="tag mint">Dodana</span>' : '<button class="btn sm line" style="height:30px" data-act="uploadOC">Wgraj PDF</button>'}</div>
      <div class="b">${ic('file-check', 's')}<span class="grow">Zaświadczenie o niekaralności</span><span class="tag">Opcjonalne</span></div>
    </div></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer"><button class="btn line" data-act="previewPro">Podgląd</button><button class="btn primary" style="flex:1" data-act="publish">${L.published ? 'Zapisz zmiany' : 'Opublikuj ogłoszenie'}</button></div>`;
};

screens.selfpreview = () => {
  const L = S.pro.listing;
  return `${topbar('Podgląd profilu')}<div class="scroll"><div class="pad">
    <div class="note yellow">${ic('eye', 's')}<span>Tak klient zobaczy Twój profil. Zmiany zapiszesz w zakładce Ogłoszenie.</span></div>
    <div class="row mt16" style="gap:14px"><div class="avatar lg t-mint">${L.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div><div><h1 class="pagetitle" style="font-size:24px;margin:0">${esc(L.name)}</h1><div class="small muted">${L.areas.join(', ') || 'Wybierz dzielnice'}</div></div></div>
    <p class="muted">${esc(L.bio)}</p>
    <div class="pricelist">${L.services.map(s => `<div class="li"><span>${catById(s).name}</span><b>${L.rate} zł / h</b></div>`).join('')}</div>
    ${L.photos.length ? `<div class="photos mt12">${L.photos.map(s => `<div class="ph" style="background-image:url(${s})"></div>`).join('')}</div>` : ''}
  </div></div>`;
};

// Obszar pracy bez dzielnic i miast: baza (np. centrum miejscowości), promień dojazdu i opcjonalna stawka za km.
const baseLabelOf = () => S.pro.listing.baseLabel || placeOf(S.pro.listing.base);
const proFee = () => S.pro.listing.kmOn ? S.pro.listing : {};
const proDemand = () => { const L = S.pro.listing; const q = S.pro.areaQ; return S.online && q && q.key === `${L.base.lat},${L.base.lng},${L.radius}` ? q.demand : demandIn(L.base, L.radius); };
const competitors = () => { const L = S.pro.listing; return S.online && S.pro.boost.quote && S.pro.boost.quote.radius === L.radius ? S.pro.boost.quote.competitors : PROS.filter(p => p.id !== 'me' && !(S.online && S.me && p.id === (S.me.provider || {}).id) && kmBetween(p, L.base) <= L.radius).length; };
function areaStatsHTML() {
  const L = S.pro.listing; const d = proDemand(); const comp = competitors();
  const potential = Math.round(d / (comp + 1) * 3.2 * L.rate / 10) * 10;
  return `<div class="minis"><div><b class="num">${d * 7}</b><span>wyszukiwań/tydz.</span></div><div><b class="num">${comp}</b><span>konkurentów</span></div><div><b class="num">${zl(potential)}</b><span>potencjał/tydz.</span></div></div>
    <div class="note mint mt12">${ic('trending-up', 's')}<span>Tyle osób szukało sprzątania w Twoim zasięgu. Potencjał zakłada, że odpowiesz na co najmniej połowę zapytań przy stawce ${L.rate} zł/h.</span></div>
    ${L.kmOn ? `<div class="note mt8">${ic('car', 's')}<span>Przykład: klient ${Math.min(15, L.radius)} km od bazy zapłaci <b>+${zl(travelFee(L, Math.min(15, L.radius)))}</b> za dojazd (${feeText(L)}).</span></div>` : ''}`;
}
screens.area = () => {
  const L = S.pro.listing; const b = L.base; const heat = S.online ? S.pro.heat || [] : demoHeat();
  const free = L.kmOn && L.freeKm ? L.freeKm : 0;
  return `${topbar('Obszar pracy')}
  <div class="scroll"><div class="pad">
    <p class="small muted" style="margin:0 0 12px">Ustaw bazę, z której wyjeżdżasz (najprościej: centrum swojej miejscowości), i jak daleko dojeżdżasz. Klienci spoza tego koła Cię nie zobaczą.</p>
    <div class="field" style="margin-top:0"><span class="lbl">Baza</span>
      <div class="searchbox" style="height:48px;box-shadow:none">${ic('search', 's faint')}<input id="baseq" placeholder="Wpisz miejscowość, np. Piaseczno" data-live="baseq" autocomplete="off"></div>
      <div id="baseSug" class="sugs"></div>
      <div class="hint">Teraz: <b>${esc(baseLabelOf())}</b>. Możesz też dotknąć mapy w dowolnym miejscu.</div></div>
    ${geoMap('area', { h: 330, center: [b.x, b.y], zoom: 120 / (L.radius + 4), locate: true, heat, labels: false,
      layer: circleSVG(b.x, b.y, L.radius, 'gm-reach strong', 'areaCircle') + (free ? circleSVG(b.x, b.y, free, 'gm-reach fee', 'areaFree') : ''),
      markers: [Object.assign(homeMark(b, 'Baza'), { id: 'areaBase' })],
      mb: { center: b.lat != null ? { lat: b.lat, lng: b.lng } : null, zoom: 10, heat,
        fit: b.lat != null ? circleBounds(b.lat, b.lng, L.radius / ROAD) : null, fitKey: `${b.lat},${b.lng},${L.radius}`,
        circles: b.lat != null ? [{ lat: b.lat, lng: b.lng, km: L.radius / ROAD }].concat(free ? [{ lat: b.lat, lng: b.lng, km: free / ROAD, kind: 'fee' }] : []) : [],
        onTapReal: (lat, lng) => A.setBase(`${lat},${lng}`) },
      onTap: (x, y) => { const r = GEOFIT.toReal(x, y); A.setBase(`${r.lat},${r.lng}`); } })}
    <div class="legend-row"><span><i style="background:${mixFill('cloth', 38)}"></i>zasięg dojazdu</span>${free ? `<span><i style="background:${mixFill('sand', 60)}"></i>bez opłaty za dojazd</span>` : ''}<span><i style="background:${mixFill('rose', 50)}"></i>gdzie szukają klienci</span></div>
    <div class="field"><div class="row between"><span class="lbl" style="margin:0">Jak daleko dojeżdżasz</span><span class="big-val num" id="aradVal">${L.radius}<small>km</small></span></div>
      <input type="range" id="arad" min="2" max="50" step="1" value="${L.radius}" data-model="pro.listing.radius" data-type="num" data-live="arad" data-rr="1" aria-label="Zasięg">
      <div class="market"><span>2 km</span><span>liczymy po drogach od bazy</span><span>50 km</span></div></div>
    <div class="card mt12" id="areaStats">${areaStatsHTML()}</div>
    <div class="field"><span class="lbl">Opłata za dojazd</span><div class="card" style="padding:2px 16px">
      <button class="toggle-row" data-act="ltoggle" data-a="kmOn"><div class="grow"><b>Doliczam za kilometr</b><span>Klient widzi opłatę w wycenie przed rezerwacją</span></div><span class="switch ${L.kmOn ? 'on' : ''}"></span></button>
      ${L.kmOn ? `<div class="small muted" style="padding-top:6px">Stawka za km</div><div class="chips" style="padding:6px 0">${[1, 1.5, 2, 2.5, 3].map(v => `<button class="chip ${L.kmRate === v ? 'on' : ''}" data-act="setKmRate" data-a="${v}">${zlKm(v)}/km</button>`).join('')}</div>
        <div class="small muted">Pierwsze kilometry gratis</div><div class="chips" style="padding:6px 0 12px">${[0, 3, 5, 10, 15].map(v => `<button class="chip ${L.freeKm === v ? 'on' : ''}" data-act="setFreeKm" data-a="${v}">${v ? 'do ' + v + ' km' : 'nie'}</button>`).join('')}</div>` : ''}
    </div></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer"><button class="btn primary block" data-act="saveArea">Zapisz obszar</button></div>`;
};
function dayRoute(jobs) {
  const L = S.pro.listing; if (!jobs.length) return '';
  if (S.online && jobs[0].id) {
    const date = ymd(addDays(S.pro.calDay)); const dg = (S.pro.dayGeo ||= {})[date];
    if (!dg) { S.pro.dayGeo[date] = 'loading'; window.LsniAPI.call('GET', `/api/pro/day?date=${date}`).then(r => { S.pro.dayGeo[date] = r; render(); }).catch(() => { delete S.pro.dayGeo[date]; }); }
    if (dg && dg !== 'loading' && S.mbx) {
      const g = dg.geometry; const lngs = g.map(c => c[0]), lats = g.map(c => c[1]);
      return `<div class="section-h"><h3>Trasa dnia</h3><span class="tiny faint">${kmf(dg.totalKm)} km · ok. ${dg.totalDriveMin} min jazdy${dg.source === 'mapbox' ? '' : ' (szacunek)'}</span></div>
        ${geoMap('route-' + date, { h: 240, labels: false, mb: { route: g, fit: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], fitKey: date + g.length },
          markers: [homeMark(L.base, 'Baza')].concat(dg.jobs.map((b, i) => ({ lat: b.lat, lng: b.lng, html: `<span class="gstop">${i + 1}</span>` }))) })}
        <div class="legs">${dg.jobs.map((b, i) => `<div><span class="gstop sm">${i + 1}</span><span class="grow small">${b.startsAt.slice(11, 16)} · ${esc(b.client ? b.client.name : 'Klient')}, ${esc(b.address)}</span><span class="tiny faint">${dg.legs[i] ? dg.legs[i].min : '?'} min dojazdu</span></div>`).join('')}</div>`;
    }
  }
  const pts = [[L.base.x, L.base.y]].concat(jobs.map(j => [j.x, j.y])).concat([[L.base.x, L.base.y]]);
  let km = 0; const legs = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 1.3; km += d; legs.push(d); }
  const mins = legs.reduce((a, d) => a + driveMin(d), 0); const fv = fitView(pts, 340, 200);
  return `<div class="section-h"><h3>Trasa dnia</h3><span class="tiny faint">${kmf(km)} km · ok. ${mins} min jazdy</span></div>
    ${geoMap('route-' + S.pro.calDay, { h: 220, center: fv.center, zoom: fv.zoom, labels: false,
      layer: `<polyline points="${pts.map(q => `${q[0] * U},${q[1] * U}`).join(' ')}" class="gm-route"/>`,
      markers: [homeMark(L.base, 'Baza')].concat(jobs.map((j, i) => ({ x: j.x, y: j.y, html: `<span class="gstop">${i + 1}</span>` }))) })}
    <div class="legs">${jobs.map((j, i) => `<div><span class="gstop sm">${i + 1}</span><span class="grow small">${j.time} · ${esc(j.client)}, ${j.area}</span><span class="tiny faint">${driveMin(legs[i])} min dojazdu</span></div>`).join('')}</div>`;
}
function boostCard() {
  const B = S.pro.boost; const a = B.active[0]; const d = proDemand();
  if (!a) return `<button class="boostcta" data-act="openBoost"><span class="bc-ill">${illo('dom')}</span><div class="grow"><b>Wyróżnij się w swoim zasięgu</b><span>Masz ${zl(B.credit)} kredytu. Wyróżnienie na ${S.pro.listing.radius} km od bazy: od ${boostPrice(d, 3)} zł za 3 dni.</span></div>${ic('chevron-right', 's')}</button>`;
  const goal = a.goal || boostViews(d, a.days);
  return `<button class="boostlive" data-act="openBoost">
    <div class="row between"><span class="livebadge"><i></i>Wyróżnienie: ${esc(a.area)}</span><span class="tiny faint">zostało ${a.left} dni</span></div>
    <div class="minis mt12"><div><b class="num" id="bst-v">${a.views}</b><span>wyświetleń</span></div><div><b class="num" id="bst-o">${a.opens}</b><span>wejść w profil</span></div><div><b class="num" id="bst-r">${a.req}</b><span>zapytań</span></div></div>
    <div class="meter"><i id="bst-m" style="width:${Math.min(100, a.views / goal * 100)}%;background:var(--cloth)"></i></div>
    <div class="tiny faint" id="bst-g">${a.views >= goal ? 'Gwarancja spełniona' : `Gwarancja: ${goal} wyświetleń, inaczej zwrot kredytu`}</div>
  </button>`;
}
screens.boost = () => {
  const L = S.pro.listing; const B = S.pro.boost; const D = B.draft; const b = L.base; const d = proDemand(); const active = B.active[0];
  const price = boostPrice(d, D.days); const fromCredit = Math.min(price, B.credit); const extra = price - fromCredit; const heat = S.online ? S.pro.heat || [] : demoHeat();
  return `${topbar('Wyróżnienie')}
  <div class="scroll"><div class="pad">
    <div class="credit"><div><span class="eyebrow">Twój kredyt</span><b class="num">${zl(B.credit)}</b></div><button class="btn sm line" data-act="openInvite">${ic('user-plus', 's')}Zdobądź więcej</button></div>
    <p class="small muted">Wyróżnienie obejmuje cały Twój zasięg: <b>${L.radius} km od: ${esc(baseLabelOf())}</b>. Klienci, pod których adres dojeżdżasz, zobaczą Cię na górze wyników z oznaczeniem „Promowane”. Wyróżnione mogą być najwyżej 2 profile naraz, a opinie i odznaki zostają bez zmian.</p>
    ${geoMap('boost', { h: 260, center: [b.x, b.y], zoom: 120 / (L.radius + 4), heat, labels: false, layer: circleSVG(b.x, b.y, L.radius, 'gm-reach strong'), markers: [homeMark(b, 'Baza')],
      mb: { center: b.lat != null ? { lat: b.lat, lng: b.lng } : null, zoom: 10, heat, fit: b.lat != null ? circleBounds(b.lat, b.lng, L.radius / ROAD) : null, fitKey: `${b.lat},${L.radius}`,
        circles: b.lat != null ? [{ lat: b.lat, lng: b.lng, km: L.radius / ROAD }] : [] } })}
    <div class="minis mt12"><div><b class="num">${d * 7}</b><span>wyszukiwań/tydz.</span></div><div><b class="num">${competitors()}</b><span>konkurentów</span></div><div><b class="num">${boostViews(d, D.days)}</b><span>gwarantowane wyświetlenia</span></div></div>
    <div class="hint">Zasięg zmienisz w Obszarze pracy. Większe koło to więcej klientów i wyższa cena.</div>
    ${active ? `<div class="note yellow mt12">${ic('rocket', 's')}<span>Wyróżnienie trwa jeszcze ${active.left} dni. Nowe kupisz po jego zakończeniu.</span></div>` : `
    <div class="field"><span class="lbl">Na jak długo?</span><div class="seg">${[3, 7, 14].map(n => `<button class="${D.days === n ? 'on' : ''}" data-act="boostDays" data-a="${n}">${n} dni · ${boostPrice(d, n)} zł</button>`).join('')}</div></div>
    <div class="receipt mt16"><div class="ln"><span>Wyróżnienie, ${D.days} dni · gwarancja ${boostViews(d, D.days)} wyświetleń</span><b>${zl(price)}</b></div>
      <div class="ln"><span>Z kredytu</span><b style="color:var(--mint)">−${zl(fromCredit)}</b></div>
      <div class="tot"><span class="muted small">${extra ? 'Dopłata BLIK-iem' : 'Do zapłaty'}</span><b class="num">${zl(extra)}</b></div></div>
    <div class="note mt12">${ic('shield-check', 's')}<span>Jeśli w tym czasie zobaczy Cię mniej klientów, niż gwarantujemy, oddamy kredyt proporcjonalnie.</span></div>`}
    ${B.history.length ? `<div class="section-h"><h3>Historia kredytu</h3></div><div class="card" style="padding:4px 16px">${B.history.slice().reverse().map(h => `<div class="toggle-row"><span class="grow small">${esc(h.t)}</span><b class="num small" style="color:var(--${h.v > 0 ? 'mint' : 'ink'})">${h.v > 0 ? '+' : ''}${zl(h.v)}</b></div>`).join('')}</div>` : ''}
    <div class="sp"></div>
  </div></div>
  <div class="footer slidefoot">${swipeBtn('buyBoost', '', active ? 'Wyróżnienie już trwa' : `Przesuń, aby wyróżnić za ${zl(price)}`, !!active)}</div>`;
};
function fakeQR(seed) {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const rnd = () => (h = (h * 1103515245 + 12345) >>> 0) / 4294967296;
  const N = 25; let r = ''; const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (finder(x, y)) continue; if (rnd() < .48) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }
  const f = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="var(--surface)"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  return `<svg viewBox="-1 -1 27 27" class="qr" aria-label="Kod QR z linkiem do rezerwacji (podgląd)"><rect x="-1" y="-1" width="27" height="27" fill="var(--surface)"/><g fill="var(--ink)">${r}${f(0, 0)}${f(N - 7, 0)}${f(0, N - 7)}</g></svg>`;
}
screens.invite = () => {
  const L = S.pro.listing; const I = S.pro.boost.invite;
  const msg = `Dzień dobry! Od teraz umawiamy sprzątanie przez aplikację Lśni: ${I.link}. Widzi Pani/Pan mój kalendarz i dostaje przypomnienie dzień wcześniej. Płatność bez zmian, na miejscu. Pozdrawiam, ${L.name.split(' ')[0]}`;
  return `${topbar('Zaproś swoich klientów')}
  <div class="scroll"><div class="pad">
    <div class="invite-hero">
      <div class="grow"><span class="eyebrow">Twój link do rezerwacji</span><b>${I.link}</b><button class="btn sm dark mt12" data-act="copyText" data-a="https://${I.link}">${ic('copy', 's')}Kopiuj link</button></div>
      ${fakeQR(I.link)}
    </div>
    <div class="minis mt12"><div><b class="num">${I.joined}</b><span>klientów dołączyło</span></div><div><b class="num">${zl(I.earned)}</b><span>zdobyty kredyt</span></div><div><b class="num">${I.joined}</b><span>rezerwacji z linku</span></div></div>
    <div class="section-h"><h3>Jak to działa</h3></div>
    <ol class="steps-list">
      <li><b>Wyślij link stałym klientom</b><span>SMS-em, na WhatsAppie albo pokaż kod QR na wizycie.</span></li>
      <li><b>Klient rezerwuje w aplikacji</b><span>Dla niego za darmo. Widzi Twój kalendarz, płaci Ci jak dotąd.</span></li>
      <li><b>Dostajesz 20 zł kredytu</b><span>Po pierwszej wizycie każdego nowego klienta. Wydasz go na wyróżnienia.</span></li>
    </ol>
    <div class="note mint mt12">${ic('lock', 's')}<span>Klienci z Twojego linku trafiają prosto do Ciebie. Na Twoim profilu nie pokazujemy im innych wykonawców.</span></div>
    <div class="field"><label for="invmsg">Gotowa wiadomość</label><textarea class="input" id="invmsg" rows="5">${esc(msg)}</textarea>
      <button class="btn line block mt8" data-act="copyMsg">${ic('message-square', 's')}Kopiuj wiadomość</button>
      <button class="btn line block mt8" data-act="openInvited" data-a="me">${ic('eye', 's')}Zobacz, co zobaczy klient</button></div>
    <div class="section-h"><h3>Wizytówka do zostawienia</h3><span class="tiny faint">podgląd</span></div>
    <div class="bizcard"><div><div class="bz-logo">lśni<span class="dot"></span></div><b>${esc(L.name)}</b><span>${esc(L.tagline)}</span><span class="bz-link">${I.link}</span></div>${fakeQR(I.link + 'card')}</div>
    <button class="btn line block mt12" data-act="toast" data-a="PDF wizytówki zostanie wysłany na Twój e-mail">${ic('printer', 's')}Pobierz wizytówki do druku</button>
    <div class="sp"></div>
  </div></div>`;
};
function proProfile() {
  const L = S.pro.listing;
  return `<div class="scroll"><div class="pad">
    <div class="rolebar" style="padding:0;margin-top:4px"><span class="proflag"><i></i>Tryb wykonawcy</span></div>
    <div class="row mt16" style="gap:14px"><div class="avatar lg t-mint" style="width:72px;height:72px;font-size:26px;border-radius:24px">${L.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
      <div><h1 class="pagetitle" style="margin:0;font-size:26px">${esc(L.name)}</h1><div class="small muted">${ic('star', 'xs star')} 4,92 · 38 opinii · 112 zleceń</div></div></div>
    <div class="menu mt24">
      <button class="mi" data-act="openBoost">${ic('rocket', 's')}Wyróżnienia<span class="r">kredyt ${zl(S.pro.boost.credit)} ${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="openInvite">${ic('user-plus', 's')}Zaproś swoich klientów<span class="r">+20 zł ${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Zestawienie miesięczne wysłane na e-mail">${ic('file-text', 's')}Rozliczenia i PIT<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="previewPro">${ic('eye', 's')}Podgląd mojego profilu<span class="r">${ic('chevron-right', 's')}</span></button>
      ${S.online ? accountMenu() : ''}
      <button class="mi" data-act="toast" data-a="Poradnik: jak zdobyć pierwszych klientów">${ic('graduation-cap', 's')}Akademia wykonawcy<span class="r">${ic('chevron-right', 's')}</span></button>
    </div>
    <button class="btn dark block mt24" data-act="setRole" data-a="client">${ic('repeat', 's')}Przełącz na tryb klienta</button>
    <div class="sp"></div></div></div>`;
}

/* ================= POSTED JOBS & OFFERS ================= */
const OFFER_MSGS = {
  marta: 'Dzień dobry! Mogę przyjść z własnym sprzętem. Przy takim zakresie zaplanowałabym jedną wizytę bez pośpiechu.',
  czysto: 'Przyjedziemy we dwójkę z odkurzaczem przemysłowym, więc będzie szybciej. Fakturę wystawimy od razu.',
  olena: 'Mieszkam niedaleko, mogę przyjść nawet dziś po 14. Cena zawiera środki.',
  pawel: 'Okna myję wodą demineralizowaną, ramy i parapety w cenie. Mogę w sobotę rano.',
  babel: 'Proszę o zdjęcie metki z kanapy. Pierzemy ekstrakcyjnie, schnie ok. 4 godzin.',
  agnieszka: 'Dzień dobry, mam wolny termin w tym tygodniu. Po sprzątaniu wyślę zdjęcia.'
};
function newDraft(cat) { return { cat: cat || 'remont', desc: '', m2: 54, when: 'flex', day: 2, budget: 0, photos: [] }; }
function buildPool(post) {
  let cands = PROS.filter(p => p.services.includes(post.cat));
  if (cands.length < 3) cands = cands.concat(PROS.filter(p => !cands.includes(p) && p.services.includes('generalne')));
  const mul = post.cat === 'remont' ? 2 : post.cat === 'generalne' ? 1.5 : 1;
  return cands.slice(0, 4).map((p, i) => {
    let price;
    if (p.fixed) price = p.rate * 1.6;
    else if (post.cat === 'okna' && p.perWindow) price = p.perWindow * 9;
    else price = Math.max(p.minH, (post.m2 || 40) / 22 * mul) * p.rate * (0.92 + ((i * 37) % 20) / 100);
    price = Math.round(price / 5) * 5;
    const day = post.when === 'day' ? post.day : [1, 2, 2, 3][i % 4];
    const time = SLOTS.find((t, k) => !slotTaken(p.id, day, t) && k > i % 3) || '10:00';
    const h = p.fixed ? 2 : Math.max(p.minH, Math.ceil((post.m2 || 40) / 22 * mul * 2) / 2);
    return { id: post.id + '-' + p.id, pro: p.id, price, day, time, h, msg: OFFER_MSGS[p.id] };
  });
}
function postCard(x) {
  const c = catById(x.cat); const min = x.offers.length ? Math.min(...x.offers.map(o => o.price)) : 0;
  return `<button class="ocard" data-act="openOffers" data-a="${x.id}">
    <span class="avatar sm ${c.tone}">${ic(c.icon, 's')}</span>
    <div class="grow"><div class="row between" style="gap:8px"><span class="name">${c.name}</span><span class="livebadge">${x.offers.length < x.pool.length ? '<i></i>zbieramy' : 'gotowe'}</span></div>
    <div class="tiny faint" style="margin:2px 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.desc || 'Bez opisu')}</div>
    <div class="row" style="gap:6px"><span class="tag blue">${x.offers.length} ${x.offers.length === 1 ? 'oferta' : x.offers.length > 1 && x.offers.length < 5 ? 'oferty' : 'ofert'}</span>${min ? `<span class="tag">od ${zl(min)}</span>` : ''}</div></div></button>`;
}

screens.post = () => {
  const d = S.draft; const days = Array.from({ length: 10 }, (_, i) => addDays(i + 1));
  return `${topbar('Nowe zlecenie')}
  <div class="scroll"><div class="pad">
    <p class="muted small" style="margin:0">Zlecenie zobaczy 9 sprawdzonych wykonawców z Twojej okolicy. Ty wybierasz ofertę, nic nie płacisz za publikację.</p>
    <div class="field"><span class="lbl">Co trzeba zrobić?</span>
      <div class="chips">${CATS.map(c => `<button class="chip ${d.cat === c.id ? 'on' : ''}" data-act="dset" data-a="cat" data-b="${c.id}">${ic(c.icon, 'xs')}${c.short}</button>`).join('')}</div></div>
    <div class="field"><label for="pdesc">Opis</label>
      <textarea class="input" id="pdesc" placeholder="${d.cat === 'remont' ? 'np. Po malowaniu i wymianie paneli, dużo pyłu, okna z naklejkami po ekipie' : d.cat === 'tapicerka' ? 'np. Narożnik 3-osobowy, plamy po kawie, sierść kota' : 'np. 2 pokoje, kuchnia z oknem, łazienka z wanną'}" data-model="draft.desc">${esc(d.desc)}</textarea>
      <div class="hint">Konkretny opis to dokładniejsze ceny w ofertach.</div></div>
    <div class="field"><span class="lbl">Zdjęcia <span class="faint" style="font-weight:500">(opcjonalnie, ${d.photos.length}/6)</span></span>
      <div class="photos">${d.photos.map((src, i) => `<div class="ph" style="background-image:url(${src})"><button class="iconbtn" style="position:absolute;top:4px;right:4px;width:26px;height:26px" data-act="dphotoDel" data-a="${i}" aria-label="Usuń">${ic('x', 'xs')}</button></div>`).join('')}
      ${d.photos.length < 6 ? `<label class="ph" for="postPhotoIn">${ic('camera')}<input type="file" id="postPhotoIn" accept="image/*" multiple></label>` : ''}</div>
      <div class="hint">Zlecenia ze zdjęciami dostają o 40% więcej ofert.</div></div>
    ${!['tapicerka', 'okna'].includes(d.cat) ? `<div class="field"><div class="row between"><span class="lbl" style="margin:0">Metraż</span><span class="big-val num" id="pm2val">${d.m2}<small>m²</small></span></div>
      <input type="range" id="pm2" min="20" max="200" step="2" value="${d.m2}" data-model="draft.m2" data-type="num" data-live="pm2" aria-label="Metraż"></div>` : ''}
    <div class="field"><span class="lbl">Kiedy?</span>
      <div class="seg"><button class="${d.when === 'flex' ? 'on' : ''}" data-act="dset" data-a="when" data-b="flex">Elastycznie</button><button class="${d.when === 'day' ? 'on' : ''}" data-act="dset" data-a="when" data-b="day">Konkretny dzień</button></div>
      ${d.when === 'day' ? `<div class="dates mt12">${days.map((x, i) => `<button class="date ${d.day === i + 1 ? 'on' : ''}" data-act="dset" data-a="day" data-b="${i + 1}">${DAYS[x.getDay()]}<b>${x.getDate()}</b></button>`).join('')}</div>` : '<div class="hint">Wykonawcy zaproponują swoje terminy w ciągu najbliższego tygodnia.</div>'}</div>
    <div class="field"><div class="row between"><span class="lbl" style="margin:0">Budżet</span><b class="num" id="pbudget">${d.budget ? 'do ' + zl(d.budget) : 'nie podaję'}</b></div>
      <input type="range" id="pbud" min="0" max="1000" step="50" value="${d.budget}" data-model="draft.budget" data-type="num" data-live="pbud" aria-label="Budżet">
      <div class="hint">Bez budżetu dostaniesz więcej ofert. Z budżetem będą bardziej dopasowane.</div></div>
    <div class="note mt16">${ic('map-pin', 's')}<span>ul. Puławska 112/14, Warszawa. Dokładny adres zobaczy tylko wykonawca, którego wybierzesz.</span></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer"><button class="btn primary block" data-act="publishPost">${ic('send', 's')}Opublikuj i zbieraj oferty</button></div>`;
};

screens.offers = ({ id }) => {
  const x = S.posts.find(y => y.id === id); const c = catById(x.cat);
  const offers = x.offers.slice();
  const cheapest = offers.length ? Math.min(...offers.map(o => o.price)) : 0;
  const best = offers.length ? Math.max(...offers.map(o => proById(o.pro).rating)) : 0;
  const soonest = offers.length ? Math.min(...offers.map(o => o.day)) : 0;
  const sorters = { rec: (a, b) => (a.price / proById(a.pro).rating) - (b.price / proById(b.pro).rating), price: (a, b) => a.price - b.price, rating: (a, b) => proById(b.pro).rating - proById(a.pro).rating, date: (a, b) => a.day - b.day || a.time.localeCompare(b.time) };
  offers.sort(sorters[S.offerSort]);
  const waiting = x.offers.length < x.pool.length && x.status === 'open';
  return `${topbar('Oferty')}
  <div class="scroll"><div class="pad">
    <div class="card"><div class="row"><span class="avatar sm ${c.tone}">${ic(c.icon, 's')}</span><div class="grow"><div class="name">${c.name}</div>
      <div class="tiny faint">${x.m2 && !['tapicerka', 'okna'].includes(x.cat) ? x.m2 + ' m² · ' : ''}${x.when === 'day' ? dayLabel(addDays(x.day)) : 'termin elastyczny'}${x.budget ? ' · budżet do ' + zl(x.budget) : ''}</div></div></div>
      ${x.desc ? `<p class="small muted" style="margin:10px 0 0">${esc(x.desc)}</p>` : ''}
      ${x.photos.length ? `<div class="photos mt12">${x.photos.slice(0, 4).map(s => `<div class="ph" style="background-image:url(${s})"></div>`).join('')}</div>` : ''}</div>
    <div class="row between mt16"><span class="livebadge big">${waiting ? `<i></i>Zbieramy oferty` : x.status === 'chosen' ? 'Oferta wybrana' : 'Zbieranie zakończone'}</span><b class="small" style="white-space:nowrap">${x.offers.length} ${x.offers.length === 1 ? 'oferta' : x.offers.length > 1 && x.offers.length < 5 ? 'oferty' : 'ofert'}</b></div>
    ${offers.length > 1 ? `<div class="hscroll mt12" style="padding-bottom:2px">${[['rec', 'Najlepszy stosunek'], ['price', 'Cena'], ['rating', 'Ocena'], ['date', 'Termin']].map(([v, l]) => `<button class="chip ${S.offerSort === v ? 'on' : ''}" data-act="offerSort" data-a="${v}">${l}</button>`).join('')}</div>` : ''}
    <div class="stack mt12">
      ${offers.map(o => { const p = proById(o.pro); const labels = [];
        if (offers.length > 1 && o.price === cheapest) labels.push('<span class="tag mint">' + ic('badge-percent', 'xs') + 'Najtańsza</span>');
        if (offers.length > 1 && p.rating === best) labels.push('<span class="tag yellow">' + ic('trophy', 'xs') + 'Najwyżej oceniany</span>');
        if (offers.length > 1 && o.day === soonest) labels.push('<span class="tag blue">' + ic('zap', 'xs') + 'Najszybciej</span>');
        const chosen = x.chosen === o.id;
        return `<div class="offer ${chosen ? 'chosen' : ''} ${x.justAdded === o.id ? 'new' : ''}">
          ${labels.length ? `<div class="chips" style="gap:6px;margin-bottom:10px">${labels.join('')}</div>` : ''}
          <div class="row" style="align-items:flex-start">${avatar(p, 'sm')}<div class="grow"><div class="row" style="gap:5px"><span class="name">${esc(p.name)}</span>${ic('badge-check', 'verified')}</div>
            <div class="tiny faint">${stars(p.rating)} (${p.reviews}) · ${String(p.dist).replace('.', ',')} km${p.insured ? ' · OC' : ''}${p.invoice ? ' · faktura' : ''}</div></div>
            <div style="text-align:right"><div class="oprice num">${zl(o.price)}</div><div class="tiny faint">cena całkowita</div></div></div>
          <div class="ofacts"><span>${ic('calendar', 'xs')}${dayLabel(addDays(o.day))}, ${o.time}</span><span>${ic('clock', 'xs')}ok. ${hrs(o.h)}</span>${x.budget && o.price <= x.budget ? `<span style="color:var(--mint)">${ic('check', 'xs')}w budżecie</span>` : ''}</div>
          <div class="quote small">„${esc(o.msg)}”</div>
          ${x.status === 'open' ? `<div class="acts"><button class="btn line sm" data-act="openPro" data-a="${p.id}">Profil</button><button class="btn line sm" data-act="openChat" data-a="${p.id}" aria-label="Napisz">${ic('message-circle', 's')}</button><button class="btn primary sm" style="flex:1" data-act="sheet" data-a="pickOffer" data-b="${x.id}|${o.id}">Wybierz</button></div>`
            : chosen ? `<div class="tag mint">${ic('check', 'xs')}Wybrana oferta</div>` : ''}
        </div>`; }).join('')}
      ${waiting ? `<div class="offer skeleton"><div class="row"><span class="sk" style="width:40px;height:40px;border-radius:13px"></span><div class="grow"><span class="sk" style="width:60%"></span><span class="sk" style="width:35%;margin-top:6px"></span></div><span class="sk" style="width:70px;height:22px"></span></div><span class="sk" style="width:100%;height:40px;margin-top:14px;border-radius:12px"></span><div class="tiny faint" style="margin-top:10px">${proById(x.pool[x.offers.length].pro).name.split(' ')[0]} przygotowuje ofertę…</div></div>` : ''}
    </div>
    ${x.status === 'open' ? `<button class="btn line block mt16" data-act="closePost" data-a="${x.id}">Zakończ zbieranie ofert</button>` : ''}
    <div class="sp"></div>
  </div></div>`;
};

function marketCard(m) {
  const c = catById(m.cat);
  return `<div class="req">
    <div class="head"><div class="row" style="gap:10px"><span class="avatar sm ${c.tone}">${ic(c.icon, 's')}</span><div><b class="small">${c.name}</b><div class="tiny faint">${esc(m.client)} · ${ic('star', 'xs star')} ${m.crating.toFixed(1).replace('.', ',')} · ${kmf(roadKm(S.pro.listing.base, m))} km od bazy</div></div></div>
      <div style="text-align:right"><div class="tiny faint">budżet</div><b class="small">${m.budget ? 'do ' + zl(m.budget) : 'otwarty'}</b></div></div>
    <p class="small muted" style="margin:12px 0 10px">${esc(m.desc)}</p>
    <div class="facts" style="margin:0 0 14px">
      <div>${ic('calendar', 's')}${m.when}</div>
      <div>${ic('map-pin', 's')}${m.area.split(',')[0]}</div>
      ${m.m2 ? `<div>${ic('ruler', 's')}${m.m2} m²</div>` : ''}
      <div>${ic('images', 's')}${m.photos} zdjęcia</div>
    </div>
    ${m.sent ? `<div class="note mint">${ic('send', 's')}<span>Twoja oferta: <b>${zl(m.sent)}</b>. ${esc(m.client)} widzi ją razem z ${m.offers} innymi.</span></div>`
      : `<div class="row between"><span class="tiny faint">${m.offers} wykonawców już wysłało oferty</span><button class="btn primary sm" data-act="sheet" data-a="sendOffer" data-b="${m.id}">${ic('send', 's')}Wyślij ofertę</button></div>`}
  </div>`;
}

/* ================= LIVE CLEANING ================= */
const ROOMS = [
  { name: 'Kuchnia', icon: 'cooking-pot', tasks: ['Blaty i zlew', 'Fronty szafek', 'Płyta i okap', 'Podłoga'] },
  { name: 'Łazienka', icon: 'bath', tasks: ['Prysznic i wanna', 'WC', 'Lustro i umywalka', 'Podłoga i fugi'] },
  { name: 'Salon', icon: 'sofa', tasks: ['Kurze', 'Odkurzanie', 'Mycie podłogi'] },
  { name: 'Sypialnia', icon: 'bed-double', tasks: ['Kurze', 'Ścielenie łóżka', 'Odkurzanie'] },
  { name: 'Przedpokój', icon: 'door-open', tasks: ['Lustro i drzwi', 'Podłoga', 'Wyniesienie śmieci'] }
];
function checklistFor(o) {
  const rooms = ROOMS.map(r => ({ name: r.name, icon: r.icon, tasks: r.tasks.slice() }));
  o.extras.forEach(id => { const x = EXTRAS.find(e => e.id === id); rooms.push({ name: x.name, icon: x.icon, tasks: [x.name] }); });
  const flat = []; rooms.forEach((r, ri) => r.tasks.forEach(t => flat.push({ room: ri, t }))); flat.rooms = rooms; return flat;
}
function trackRoute(o, p) { const a = addrById(o.addrId) || S.addresses[0]; return { a, pts: [[p.x, p.y], [(p.x + a.x) / 2 + .7, (p.y + a.y) / 2 - .5], [a.x, a.y]] }; }
function alongRoute(pts, t) { const segs = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; } let d = t * tot; for (let i = 0; i < segs.length; i++) { if (d <= segs[i]) { const k = d / segs[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= segs[i]; } return pts[pts.length - 1]; }
function trackBlock(o, p) {
  if (S.mbx) {
    if (!o.routeReal && !o.routeLoading) { o.routeLoading = true; window.LsniAPI.call('GET', `/api/bookings/${o.id}/route`).then(r => { o.routeReal = r; render(); }).catch(() => { o.routeLoading = false; }); }
    const R = o.routeReal;
    if (!R) return `<div class="mt16"><div class="mbx-wait" style="height:240px"><span class="tiny faint">Wczytujemy trasę…</span></div></div>`;
    const { pos, done } = alongLngLat(R.coordinates, o.track || 0); const lngs = R.coordinates.map(c => c[0]), lats = R.coordinates.map(c => c[1]);
    return `<div class="mt16">${geoMap('trk-' + o.id, { h: 240, labels: false,
      mb: { route: R.coordinates, routeDone: done, fit: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], fitKey: o.id },
      markers: [homeMark({ lat: R.to.lat, lng: R.to.lng }, 'Ty'), { lat: pos[1], lng: pos[0], id: 'trk-' + o.id, cls: 'gcar-w', html: `<span class="gcar">${ic('car', 's')}</span>` }] })}
      <div class="note mt8" id="eta-${o.id}">${etaTextReal(o, p)}</div></div>`;
  }
  const { a, pts } = trackRoute(o, p); const t = o.track || 0; const pos = alongRoute(pts, t); const d = roadKm(p, a);
  const fv = fitView(pts, 340, 200);
  const line = pts.map(q => `${q[0] * U},${q[1] * U}`).join(' ');
  return `<div class="mt16">${geoMap('trk-' + o.id, { h: 220, center: fv.center, zoom: fv.zoom, labels: false,
    layer: `<polyline points="${line}" class="gm-route"/><polyline id="trkdone-${o.id}" points="${pts.slice(0, 1).concat([pos]).map(q => `${q[0] * U},${q[1] * U}`).join(' ')}" class="gm-route done"/>`,
    markers: [homeMark(a, 'Ty'), { x: pos[0], y: pos[1], id: 'trk-' + o.id, cls: 'gcar-w', html: `<span class="gcar">${ic('car', 's')}</span>` }] })}
    <div class="note mt8" id="eta-${o.id}">${etaText(o, p, t, d)}</div></div>`;
}
const etaTextReal = (o, p) => { const R = o.routeReal, t = o.track || 0; return `${ic('navigation', 's')}<span><b>${p.name.split(' ')[0]} jest w drodze</b>, dotrze za ok. ${Math.max(1, Math.round((1 - t) * R.min))} min · zostało ${kmf((1 - t) * R.km)} km${R.source === 'mapbox' ? '' : ' (szacunek)'}</span>`; };
const etaText = (o, p, t, d) => `${ic('navigation', 's')}<span><b>${p.name.split(' ')[0]} jest w drodze</b>, dotrze za ok. ${Math.max(1, Math.round((1 - t) * driveMin(d)))} min · zostało ${kmf((1 - t) * d)} km</span>`;
function liveBlock(o) {
  const list = checklistFor(o); const rooms = list.rooms; const done = o.prog || 0;
  const pct = Math.round(done / list.length * 100);
  const cur = list[Math.min(done, list.length - 1)].room;
  const p = proById(o.pro);
  return `<div class="card mt16">
    <div class="row between"><span class="livebadge big"><i></i>Sprzątanie na żywo</span><span class="tiny faint num">${done}/${list.length} zadań</span></div>
    <div class="meter"><i style="width:${pct}%"></i></div>
    <div class="tiny faint">Start o ${o.started || o.time}. Wykonawca odhacza zadania w aplikacji, a Ty widzisz postęp.</div>
    <div class="rooms mt12">${rooms.map((r, ri) => {
      const idx = list.map((x, i) => x.room === ri ? i : -1).filter(i => i >= 0);
      const rd = idx.filter(i => i < done).length; const state = rd === idx.length ? 'ok' : ri === cur ? 'now' : '';
      return `<div class="room ${state}"><span class="rt">${ic(state === 'ok' ? 'check' : r.icon, 's')}</span><div class="grow"><div class="row between"><b class="small">${r.name}</b><span class="tiny faint num">${rd}/${idx.length}</span></div>
        ${state === 'now' ? `<div class="tasks">${idx.map(i => `<span class="${i < done ? 'ok' : i === done ? 'now' : ''}">${ic(i < done ? 'check' : 'circle', 'xs')}${list[i].t}</span>`).join('')}</div>` : ''}</div></div>`;
    }).join('')}</div>
  </div>`;
}
function finishOrder(o) {
  o.rated = false;
  const mins = Math.round(o.h * 60 - 10 + (o.id.length % 3) * 10);
  o.report = { mins, notes: ['Odpływ w wannie wolno spływa, warto go przeczyścić.', 'Skończył się płyn do szyb pod zlewem.'] };
  toast('Sprzątanie zakończone. Zobacz raport', 'sparkles');
}
function reportBlock(o, p) {
  const list = checklistFor(o);
  return `<div class="card mt16 report">
    <div class="row between"><div><div class="eyebrow">Raport ze sprzątania</div><b style="font-family:var(--f-display);font-size:20px">Wszystko zrobione</b></div><span class="avatar sm t-mint">${ic('clipboard-list', 's')}</span></div>
    <div class="kpis mt12"><div class="kpi"><span class="tiny faint">Zadania</span><b class="num">${list.length}/${list.length}</b></div><div class="kpi"><span class="tiny faint">Czas pracy</span><b class="num">${Math.floor(o.report.mins / 60)} h ${o.report.mins % 60} min</b></div></div>
    <div class="chips mt12">${list.rooms.map(r => `<span class="tag mint">${ic('check', 'xs')}${r.name}</span>`).join('')}</div>
    <div class="lbl small mt16" style="font-weight:650">Uwagi wykonawcy</div>
    <div class="checklist mt8">${o.report.notes.map(n => `<div>${ic('scan-eye', 's')}<span>${n}</span></div>`).join('')}</div>
  </div>`;
}

/* ================= sheets ================= */
const sheets = {
  filters() {
    const f = S.filters;
    const tog = (k, t, s) => `<button class="toggle-row" data-act="toggleF" data-a="${k}"><div class="grow"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div><span class="switch ${f[k] ? 'on' : ''}"></span></button>`;
    return { title: 'Filtry', body: `
      <div class="field" style="margin-top:6px"><div class="row between"><span class="lbl" style="margin:0">Maks. stawka</span><b class="num" id="maxPriceVal">${f.maxPrice >= 100 ? 'bez limitu' : f.maxPrice + ' zł/h'}</b></div>
        <input type="range" id="maxPrice" min="35" max="100" step="5" value="${f.maxPrice}" data-model="filters.maxPrice" data-type="num" data-live="maxPrice" data-rr="1" aria-label="Maksymalna stawka"></div>
      <div class="field"><div class="row between"><span class="lbl" style="margin:0">Odległość od: ${esc(curAddr().label)}</span><b class="num" id="maxDistVal">${f.maxDist >= 15 ? 'dowolna' : 'do ' + f.maxDist + ' km'}</b></div>
        <input type="range" id="maxDist" min="2" max="15" step="1" value="${f.maxDist}" data-model="filters.maxDist" data-type="num" data-live="maxDist" data-rr="1" aria-label="Maksymalna odległość">
        <div class="card mt8" style="padding:2px 16px">${tog('far', 'Pokaż też spoza zasięgu', 'Wykonawcy, którzy zwykle tu nie dojeżdżają')}</div></div>
      <div class="field"><span class="lbl">Minimalna ocena</span><div class="chips">${[[0, 'Dowolna'], [4.8, '4,8+'], [4.9, '4,9+']].map(([v, l]) => `<button class="chip ${f.minRating === v ? 'on' : ''}" data-act="setF" data-a="minRating" data-b="${v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Bezpieczeństwo</span><div class="card" style="padding:2px 16px">${tog('verified', 'Zweryfikowana tożsamość')}${tog('insured', 'Polisa OC', 'Szkody pokrywa ubezpieczyciel')}</div></div>
      <div class="field"><span class="lbl">Wygoda</span><div class="card" style="padding:2px 16px">${tog('today', 'Wolne jeszcze dziś')}${tog('supplies', 'Przynosi własne środki')}${tog('eco', 'Ekologiczne środki')}${tog('pets', 'Zwierzęta OK')}${tog('invoice', 'Faktura VAT')}</div></div>`,
      foot: `<button class="btn line" data-act="clearFilters">Wyczyść</button><button class="btn dark" style="flex:1" data-act="closeSheet">Pokaż ${filteredPros().length} wyników</button>` };
  },
  cancel(id) {
    const o = S.orders.find(x => x.id === id); const free = o.date >= 2;
    return { title: 'Odwołać wizytę?', body: `<p class="muted" style="margin-top:0">${free ? 'Do wizyty zostało ponad 24 h, więc odwołanie niczego nie zmienia. Wykonawca dostanie powiadomienie.' : 'Do wizyty zostało mniej niż 24 h. Wykonawca zarezerwował ten czas dla Ciebie, więc późne odwołanie obniży Twoją ocenę rzetelności, którą widzą wykonawcy.'}</p>
      <div class="field"><span class="lbl">Powód</span><div class="chips">${['Zmiana planów', 'Znalazłem kogoś innego', 'Termin nie pasuje', 'Inny'].map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-act="pickChip">${t}</button>`).join('')}</div></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Zostaw</button><button class="btn danger" style="flex:1" data-act="cancelOrder" data-a="${id}">Odwołaj wizytę</button>` };
  },
  resched(id) {
    const o = S.orders.find(x => x.id === id);
    return { title: 'Zmień termin', body: reschedBody(o),
      foot: `${o.freq !== 'once' ? `<button class="btn line" data-act="skipVisit" data-a="${id}">Pomiń tę wizytę</button>` : `<button class="btn line" data-act="closeSheet">Wróć</button>`}<button class="btn dark" style="flex:1" data-act="doResched" data-a="${id}" ${S.resched.time ? '' : 'disabled'}>Poproś o zmianę</button>` };
  },
  noshow(i) {
    const j = S.pro.jobs[Number(i)];
    return { title: 'Klient nie otworzył?', body: `<p class="muted" style="margin-top:0">${esc(j.client)} · ${j.time} · ${j.area}</p>
      <div class="checklist">${['Odczekaj 15 minut od godziny wizyty', 'Zadzwoń przez aplikację (numer maskowany)', 'Napisz wiadomość w czacie'].map(t => `<div>${ic('check', 's')}<span>${t}</span></div>`).join('')}</div>
      <div class="minis mt16"><div><b class="num">${j.time.replace(/:00$/, ':17')}</b><span>czas zgłoszenia</span></div><div><b class="num">40 m</b><span>od adresu</span></div></div>
      <div class="note mt12">${ic('shield-check', 's')}<span>Nieobecność klienta nie wpływa na Twoją ocenę. Klient dostanie powiadomienie, a po dwóch takich zgłoszeniach traci możliwość rezerwacji.</span></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Jeszcze poczekam</button><button class="btn danger" style="flex:1" data-act="reportNoShow" data-a="${i}">Zgłoś</button>` };
  },
  ranking() {
    return { title: 'Jak ustalamy kolejność', body: `<p class="muted" style="margin-top:0">Wyniki układamy według tego, co najbardziej pomaga Ci wybrać:</p>
      <div class="checklist">${['Ocena i liczba opinii z potwierdzonych wizyt', 'Odległość i czas dojazdu do Twojego adresu', 'Wolne terminy w najbliższych dniach', 'Czas odpowiedzi na zapytania', 'Dopasowanie usług do tego, czego szukasz'].map(t => `<div>${ic('check', 's')}<span>${t}</span></div>`).join('')}</div>
      <div class="note yellow mt16">${ic('megaphone', 's')}<span><b>Promowane</b> oznacza, że wykonawca zapłacił za wyższą pozycję w Twoim mieście. Pokazujemy najwyżej 2 takie profile. Płatne wyróżnienie nie wpływa na opinie, oceny ani odznaki weryfikacji.</span></div>` };
  },
  pickOffer(arg) {
    const [pid, oid] = arg.split('|'); const x = S.posts.find(y => y.id === pid); const o = x.offers.find(y => y.id === oid); const p = proById(o.pro);
    return { title: 'Wybrać tę ofertę?', body: `<div class="row">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${dayLabel(addDays(o.day))}, ${o.time} · ok. ${hrs(o.h)}</div></div><b class="num">${zl(o.price)}</b></div>
      <div class="note mint mt16">${ic('hand-coins', 's')}<span>W aplikacji nic nie płacisz. ${zl(o.price)} zapłacisz wykonawcy na miejscu, po sprzątaniu.</span></div>
      <div class="note mt8">${ic('mail', 's')}<span>${x.offers.length - 1 === 1 ? 'Drugiemu wykonawcy' : `Pozostałym ${x.offers.length - 1} wykonawcom`} podziękujemy automatycznie.</span></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Wróć</button><button class="btn primary" style="flex:1" data-act="acceptOffer" data-a="${arg}">Wybierz za ${zl(o.price)}</button>` };
  },
  sendOffer(id) {
    const m = S.pro.market.find(y => y.id === id); const L = S.pro.listing;
    const d = S.pro.offerDraft;
    return { title: 'Twoja oferta', body: `<p class="small muted" style="margin-top:0">${esc(m.client)}: ${esc(m.desc)}</p>
      <div class="field" style="margin-top:12px"><div class="row between"><span class="lbl" style="margin:0">Cena całkowita</span><span class="big-val num" id="ofPrice">${d.price}<small>zł</small></span></div>
        <input type="range" id="ofp" min="100" max="900" step="10" value="${d.price}" data-model="pro.offerDraft.price" data-type="num" data-live="ofp" aria-label="Cena">
        <div class="market"><span id="ofNet">Bez prowizji: całe ${zl(d.price)} dla Ciebie</span><span>${m.budget ? 'budżet klienta: ' + zl(m.budget) : ''}</span></div></div>
      <div class="field"><span class="lbl">Proponowany termin</span><div class="chips">${[1, 2, 3, 5].map(i => `<button class="chip ${d.day === i ? 'on' : ''}" data-act="ofDay" data-a="${i}">${dayLabel(addDays(i))}</button>`).join('')}</div></div>
      <div class="field"><label for="ofmsg">Wiadomość do klienta</label><textarea class="input" id="ofmsg" data-model="pro.offerDraft.msg">${esc(d.msg)}</textarea></div>
      <div class="note">${ic('info', 's')}<span>Oferty z wiadomością i terminem wygrywają 2× częściej. Cenę możesz zmienić do momentu wyboru.</span></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Anuluj</button><button class="btn primary" style="flex:1" data-act="submitOffer" data-a="${id}">${ic('send', 's')}Wyślij ofertę</button>` };
  },
  decline(id) {
    return { title: 'Odrzucić zapytanie?', body: `<p class="muted" style="margin-top:0">Klient dostanie propozycję innych wykonawców. Powód widzisz tylko Ty, pomaga nam lepiej dobierać zapytania.</p>
      <div class="chips">${['Za daleko', 'Termin zajęty', 'Za mało czasu', 'Nie wykonuję tej usługi'].map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-act="pickChip">${t}</button>`).join('')}</div>
      <div class="note mt16">${ic('info', 's')}<span>Częste odrzucanie nie obniża oceny, ale wpływa na pozycję w wynikach.</span></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Wróć</button><button class="btn dark" style="flex:1" data-act="declineReq" data-a="${id}">Odrzuć zapytanie</button>` };
  }
};

/* ================= render ================= */
let lastKey = '', scrollMemo = {};
function render() {
  const t = S.online && !S.loggedIn ? { name: 'login', p: {} } : top(); const key = stackKey() + ':' + stack().length + ':' + t.name;
  const sc = $app.querySelector('.scroll');
  if (sc && lastKey) scrollMemo[lastKey] = sc.scrollTop;
  const fn = screens[t.name];
  const html = fn ? fn(t.p || {}) : '<div class="pad">Brak ekranu</div>';
  const showTabs = stack().length === 1 && t.name !== 'login';
  const tabs = TABS[S.role];
  const unread = Object.values(S.threads).reduce((a, x) => a + x.unread, 0);
  const needRate = S.orders.some(o => o.status === 'done' && !o.rated);
  let sheetHTML = '';
  if (S.sheet) {
    const s = sheets[S.sheet.name](S.sheet.p);
    sheetHTML = `<div class="sheet-wrap"><div class="sheet-bg" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="${s.title}"><div class="grab"></div><div class="sh-h"><h3>${s.title}</h3><button class="iconbtn ghost" data-act="closeSheet" aria-label="Zamknij">${ic('x', 's')}</button></div><div class="sh-b">${s.body}</div>${s.foot ? `<div class="sh-f">${s.foot}</div>` : ''}</div></div>`;
  }
  $app.innerHTML = `<div class="view ${anim}">${html}</div>${S.introSeen ? '' : introHTML()}${showTabs ? `<nav class="tabbar">${tabs.map(tb => `<button class="tab ${S.tab === tb.id ? 'on' : ''}" data-act="setTab" data-a="${tb.id}"><span class="pill">${ic(tb.icon)}</span>${tb.label}${(tb.id === 'inbox' && ((unread && S.role === 'client') || (S.role === 'pro' && Object.values(S.pro.threads).some(x => x.unread)))) || (tb.id === 'orders' && needRate) || (tb.id === 'dash' && S.pro.requests.length) ? '<span class="dot"></span>' : ''}</button>`).join('')}</nav>` : ''}${sheetHTML}`;
  anim = '';
  const nsc = $app.querySelector('.view .scroll');
  if (nsc && key === lastKey && scrollMemo[key]) nsc.scrollTop = scrollMemo[key];
  else if (nsc && scrollMemo[key] && t.name !== 'chat' && t.name !== 'pchat') nsc.scrollTop = scrollMemo[key];
  if (t.name === 'chat' || t.name === 'pchat') scrollChat();
  lastKey = key;
  persist();
  syncPitch();
  afterRender();
}

/* ================= intro przy pierwszym uruchomieniu ================= */
function introHTML() {
  return `<div class="intro" id="intro" role="dialog" aria-label="Witaj w Lśni">
    <div class="intro-stage">
      <div class="intro-logo">lśni<span class="dot"></span></div>
      <div class="intro-grime" aria-hidden="true"><span>lśni.</span></div>
      <svg class="intro-sq" viewBox="0 0 40 200" aria-hidden="true"><rect x="16" y="0" width="10" height="200" rx="5" fill="var(--ink)"/><rect x="4" y="80" width="34" height="40" rx="8" fill="var(--cloth)"/><rect x="26" y="6" width="5" height="188" rx="2.5" fill="var(--paper)" opacity=".35"/></svg>
    </div>
    <p class="intro-tag">Sprawdzeni ludzie od sprzątania w Twojej okolicy. Płacisz dopiero, gdy jest czysto.</p>
    <div class="intro-roles">
      <button class="role" data-act="introRole" data-a="client"><span class="role-illo">${illo('dom')}</span><b>Szukam sprzątania</b><span>Rezerwacja w 2 minuty, płacisz na miejscu</span></button>
      <button class="role" data-act="introRole" data-a="pro"><span class="role-illo">${illo('generalne')}</span><b>Sprzątam zawodowo</b><span>Zlecenia z okolicy, bez prowizji</span></button>
    </div>
    <button class="intro-skip" data-act="introRole" data-a="client">Pomiń</button>
  </div>`;
}

/* ================= interakcje dotykowe ================= */
function afterRender() { initMaps(); initBubbles(); initParallax(); initPullRefresh(); initGrime(); initBA(); document.querySelectorAll('#app .slide').forEach(initSlide); initSheetDrag(); }

// szyba: brud na canvasie, ścierany palcem (destination-out)
function initGrime() {
  const c = document.getElementById('grime'); if (!c || c.dataset.ready) return; c.dataset.ready = '1';
  const r = c.getBoundingClientRect(); const w = r.width, h = r.height; if (!w) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d', { willReadFrequently: true }); g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement); const fog = css.getPropertyValue('--fog').trim(); const dirt = css.getPropertyValue('--grime-d').trim();
  g.fillStyle = fog; g.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.globalAlpha = .22; g.fillStyle = dirt;
  for (let i = 0; i < 46; i++) { const x = rnd() * w, y = rnd() * h, rr = 6 + rnd() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, dirt); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
  g.globalAlpha = .18; g.strokeStyle = dirt; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x = rnd() * w; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); g.moveTo(x, rnd() * h * .4); g.quadraticCurveTo(x + 6, h * .6, x - 4 + rnd() * 8, h * (.6 + rnd() * .4)); g.stroke(); }
  g.globalAlpha = 1;
  // napis „wypisany palcem” w kurzu
  g.globalCompositeOperation = 'destination-out'; g.save(); g.translate(w * .5, h * .5); g.rotate(-.05);
  g.font = `800 ${Math.round(w / 8)}px ${css.getPropertyValue('--f-display')}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000'; g.globalAlpha = .9; g.fillText('umyj mnie', 0, -4);
  g.restore(); g.globalAlpha = 1;
  let last = null, moves = 0, done = false;
  const pt = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const wipe = (a, b2) => {
    g.globalCompositeOperation = 'destination-out';
    [[46, .25], [30, .9]].forEach(([lw, al]) => { g.strokeStyle = '#000'; g.globalAlpha = al; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); });
    g.globalAlpha = 1;
  };
  const check = () => {
    const d = g.getImageData(0, 0, c.width, c.height).data; let clear = 0, n = 0;
    for (let i = 3; i < d.length; i += 4 * 24) { n++; if (d[i] < 90) clear++; }
    if (clear / n > .52 && !done) {
      done = true; buzz([10, 40, 18]); c.classList.add('gone'); document.getElementById('glass').classList.add('clean', 'shine');
      setTimeout(() => { S.wiped = true; persist(); toast('Lśni! Odkryłaś promocję na mycie okien', 'sparkles'); render(); }, 700);
    }
  };
  c.addEventListener('pointerdown', e => { last = pt(e); c.setPointerCapture(e.pointerId); c.parentElement.classList.add('wiping'); wipe(last, [last[0] + .1, last[1]]); });
  c.addEventListener('pointermove', e => { if (!last) return; const p2 = pt(e); wipe(last, p2); last = p2; if (++moves % 8 === 0) check(); });
  const up = () => { if (last) check(); last = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
}

// profil: paralaksa okładki i zwijany pasek z nazwą
function initParallax() {
  const sc = document.getElementById('proScroll'); if (!sc || sc.dataset.ready) return; sc.dataset.ready = '1';
  const bar = document.getElementById('pbar'); const ill = sc.querySelector('.pcover .cover-illo'); const cov = sc.querySelector('.pcover');
  const upd = () => { const y = sc.scrollTop; if (ill) ill.style.transform = `translateY(${y * .45}px) rotate(${-8 + y * .03}deg) scale(${1 + Math.min(y, 200) / 900})`; if (cov) cov.style.setProperty('--fade', Math.max(0, 1 - y / 160)); if (bar) bar.classList.toggle('on', y > 150); };
  sc.addEventListener('scroll', upd, { passive: true }); upd();
}
// ekran główny: pociągnij w dół, żeby odświeżyć (dotyk i mysz)
function initPullRefresh() {
  const sc = document.getElementById('homeScroll'); if (!sc || sc.dataset.ready) return; sc.dataset.ready = '1';
  const ptr = document.getElementById('ptr'); const inner = sc.querySelector('.ptr-inner'); let y0 = null, d = 0, busy = false;
  const set = v => { d = v; inner.style.transform = v ? `translateY(${v}px)` : ''; ptr.style.setProperty('--p', Math.min(1, v / 70)); ptr.classList.toggle('ready', v > 70); ptr.querySelector('.ptr-t').textContent = v > 70 ? 'Puść, żeby odświeżyć' : 'Pociągnij, żeby odświeżyć'; };
  const startOk = t => !busy && sc.scrollTop <= 0 && !t.closest('button, input, canvas, .gmap, .hscroll, form, a, [data-act]');
  const move = (y, ev) => { if (y0 === null) return; const dy = y - y0; if (dy <= 0) { set(0); return; } if (ev && ev.cancelable) ev.preventDefault(); inner.style.transition = 'none'; set(Math.min(110, dy * .5)); };
  const end = () => {
    if (y0 === null) return; y0 = null; inner.style.transition = 'transform .35s cubic-bezier(.2,.8,.2,1)';
    if (d > 70) { busy = true; set(56); ptr.classList.add('busy'); ptr.querySelector('.ptr-t').textContent = 'Sprawdzamy wolne terminy…'; buzz(10);
      setTimeout(() => { busy = false; ptr.classList.remove('busy'); set(0); const n = 1 + Math.floor(Math.random() * 3); toast(`Odświeżono: ${n} ${n === 1 ? 'nowy wolny termin' : 'nowe wolne terminy'} w okolicy`, 'refresh-cw'); }, 1100); }
    else set(0);
  };
  sc.addEventListener('touchstart', e => { if (startOk(e.target)) y0 = e.touches[0].clientY; }, { passive: true });
  sc.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
  sc.addEventListener('touchend', end); sc.addEventListener('touchcancel', end);
  sc.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && startOk(e.target)) { y0 = e.clientY; } });
  window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && y0 !== null) move(e.clientY); });
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); });
}

// suwak przed/po
function initBA() {
  const ba = document.getElementById('ba'); if (!ba || ba.dataset.ready) return; ba.dataset.ready = '1';
  const inp = ba.querySelector('input');
  inp.addEventListener('input', () => { ba.classList.remove('hint'); ba.style.setProperty('--x', inp.value + '%'); });
  inp.addEventListener('pointerdown', () => ba.classList.remove('hint'));
}

// „ściągaczka”: przeciągnij, żeby potwierdzić
function initSlide(sl) {
  if (sl.dataset.ready) return; sl.dataset.ready = '1';
  const knob = sl.querySelector('.slide-knob'); const fill = sl.querySelector('.slide-fill'); const label = sl.querySelector('.slide-label');
  let x0 = null, dx = 0;
  const max = () => sl.clientWidth - knob.offsetWidth - 8;
  const set = v => { knob.style.transform = `translateX(${v}px)`; fill.style.width = (v + knob.offsetWidth + 4) + 'px'; label.style.opacity = Math.max(0, 1 - v / (max() * .6)); };
  const fire = () => { sl.classList.add('done'); set(max()); buzz([8, 30, 14]); const fn = A[sl.dataset.done]; setTimeout(() => fn && fn(sl.dataset.a), 160); };
  knob.addEventListener('pointerdown', e => { if (sl.classList.contains('off') || sl.classList.contains('done')) { sl.classList.remove('nudge'); void sl.offsetWidth; sl.classList.add('nudge'); return; } x0 = e.clientX; knob.setPointerCapture(e.pointerId); sl.classList.add('drag'); });
  knob.addEventListener('pointermove', e => { if (x0 === null) return; dx = Math.max(0, Math.min(max(), e.clientX - x0)); set(dx); });
  const up = () => { if (x0 === null) return; x0 = null; sl.classList.remove('drag'); if (dx > max() * .82) fire(); else { dx = 0; set(0); if (!sl.classList.contains('off')) { sl.classList.remove('nudge'); void sl.offsetWidth; sl.classList.add('nudge'); } } };
  knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
  knob.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !sl.classList.contains('off')) { e.preventDefault(); fire(); } });
}

// arkusz: przeciągnij w dół, żeby zamknąć
function initSheetDrag() {
  const sh = document.querySelector('#app .sheet'); if (!sh || sh.dataset.ready) return; sh.dataset.ready = '1';
  const handle = sh.querySelector('.grab'); const head = sh.querySelector('.sh-h'); let y0 = null, dy = 0;
  [handle, head].forEach(el => {
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; el.setPointerCapture(e.pointerId); sh.style.transition = 'none'; });
    el.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
    const up = () => { if (y0 === null) return; y0 = null; sh.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; if (dy > 90) { sh.style.transform = 'translateY(110%)'; setTimeout(() => A.closeSheet(), 200); } else sh.style.transform = ''; dy = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}
function syncPitch() {
  document.querySelectorAll('.pitch [data-act="setRole"]').forEach(b => { b.className = 'btn sm ' + (b.dataset.a === S.role ? 'dark' : 'line'); });
}

/* ================= actions ================= */
const A = {
  noop() { },
  back,
  setTab: a => setTab(a),
  toast: a => toast(a, 'info'),
  share: () => toast('Link do profilu skopiowany', 'link'),
  fav(id) {
    const i = S.favs.indexOf(id);
    if (i >= 0) { S.favs.splice(i, 1); toast('Usunięto z ulubionych', 'heart-off'); } else { S.favs.push(id); popHeart = id; buzz(12); toast('Dodano do ulubionych', 'heart'); }
    render(); popHeart = null;
  },
  openPro: id => go('provider', { id }),
  openCat(id) { S.filters.cat = id; S.filters.q = ''; go('search'); },
  openSearch() { S.filters.cat = null; go('search'); },
  setCat(id) { S.filters.cat = id || null; render(); },
  toggleF(k) { S.filters[k] = !S.filters[k]; render(); },
  setF(k, v) { S.filters[k] = Number(v); render(); },
  clearFilters() { Object.assign(S.filters, { maxPrice: 100, minRating: 0, verified: false, insured: false, supplies: false, eco: false, pets: false, invoice: false, today: false, q: '', maxDist: 15, far: false, district: null, bounds: null }); render(); },
  sheet(name, p) {
    if (name === 'sendOffer') { const m = S.pro.market.find(y => y.id === p); S.pro.offerDraft = { price: m.budget ? Math.round(m.budget * 0.85 / 10) * 10 : 300, day: 2, msg: `Dzień dobry, chętnie się tym zajmę. Przyjadę z własnym sprzętem i środkami. Pozdrawiam, ${S.pro.listing.name.split(' ')[0]}` }; }
    S.sheet = { name, p }; render();
  },
  closeSheet() { S.sheet = null; render(); },
  pickChip(_, __, el) { el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); el.classList.add('on'); },

  startBooking(id, preset) { S.booking = newBooking(id, preset); go('book'); },
  bset(k, v) {
    const b = S.booking; b[k] = v;
    if (k === 'addr' && v === 'mama' && !b.onName) Object.assign(b, { who: 'other', onName: 'Halina (mama)', onPhone: '600 123 120' });
    render();
  },
  bstep(k, d) { const b = S.booking; b[k] = Math.min(k === 'rooms' ? 8 : 5, Math.max(1, b[k] + Number(d))); render(); },
  bextra(id) { const x = S.booking.extras; const i = x.indexOf(id); i >= 0 ? x.splice(i, 1) : x.push(id); render(); },
  bfocus(t) { const x = S.booking.focus; const i = x.indexOf(t); i >= 0 ? x.splice(i, 1) : x.push(t); render(); },
  bday(i) { const b = S.booking; b.day = Number(i); if (b.time && slotTaken(b.pro, b.day, b.time)) b.time = null; render(); },
  bookNext() { S.booking.step++; scrollMemo = {}; anim = 'enter'; render(); },
  bookPrev() { S.booking.step--; anim = 'fade'; render(); },
  pay() {
    const sl = document.getElementById('slide-pay'); if (!sl) return;
    sl.classList.add('busy'); sl.querySelector('.slide-label').textContent = 'Wysyłamy rezerwację…';
    setTimeout(() => {
      const b = S.booking; const p = proById(b.pro); const e = estimate(b, p);
      const o = { id: 'o' + Date.now(), pro: b.pro, service: b.service, date: b.day, time: b.time, h: e.h, m2: b.m2, total: Math.round(e.total * 100) / 100, freq: b.freq, status: 'pending', extras: b.extras.slice(), addr: (addrById(b.addr) || curAddr()).street, addrId: b.addr, pay: { cash: 'Gotówka', blikphone: 'BLIK na telefon', transfer: 'Przelew', invoice: 'Faktura VAT' }[b.pay] || 'Gotówka', onsite: b.who === 'other' && b.onName ? `${b.onName}${b.onPhone ? ' · ' + b.onPhone : ''}` : '' };
      S.orders.push(o); S.booking = null;
      S.stacks[stackKey()] = [{ name: S.tab }, { name: 'booked', p: { id: o.id } }]; anim = 'enter'; render();
      setTimeout(() => { if (o.status === 'pending') { o.status = 'confirmed'; pushNotif('badge-check', 'Rezerwacja potwierdzona', `${p.name}: ${dayLabel(addDays(o.date))}, ${o.time}.`, 'openOrder', o.id); toast(`${p.name.split(' ')[0]} potwierdza rezerwację`, 'badge-check'); render(); } }, 4000);
    }, 700);
  },
  openOrder: id => go('order', { id }),
  openOrderFromDone(id) { S.stacks[stackKey()] = [{ name: S.tab }]; S.tab = 'orders'; S.ordersSeg = 'up'; S.stacks[stackKey()] = [{ name: 'orders' }, { name: 'order', p: { id } }]; anim = 'enter'; render(); },
  seg(a) { S.ordersSeg = a; render(); },
  advanceOrder(id) {
    const o = S.orders.find(x => x.id === id); const flow = ['pending', 'confirmed', 'enroute', 'progress', 'done'];
    const wasProgress = o.status === 'progress';
    o.status = flow[Math.min(flow.length - 1, flow.indexOf(o.status) + 1)];
    if (o.status === 'progress') { o.prog = 0; o.started = nowTime(); }
    if (o.status === 'enroute') o.track = 0;
    if (o.status === 'done') { if (wasProgress) o.prog = checklistFor(o).length; finishOrder(o); }
    render();
  },
  cancelOrder(id) { const o = S.orders.find(x => x.id === id); o.status = 'cancel'; S.sheet = null; stack().pop(); toast('Wizyta odwołana. Wykonawca dostał powiadomienie', 'undo-2'); anim = 'fade'; render(); },
  openRate(id) { S.rate = { stars: 5, tags: [], tip: 0, comment: '' }; go('rate', { id }); },
  rstar(i) { S.rate.stars = Number(i); render(); },
  rtag(t) { const x = S.rate.tags; const i = x.indexOf(t); i >= 0 ? x.splice(i, 1) : x.push(t); render(); },
  rtip(t) { S.rate.tip = Number(t); render(); },
  submitRate(id) { const o = S.orders.find(x => x.id === id); o.rated = S.rate.stars; o.total += S.rate.tip; S.stacks[stackKey()] = stack().slice(0, 1); S.ordersSeg = 'past'; toast('Dziękujemy! Opinia opublikowana', 'heart-handshake'); anim = 'fade'; render(); },
  rebook(id) { const o = S.orders.find(x => x.id === id); S.booking = Object.assign(newBooking(o.pro), { service: proById(o.pro).services.includes(o.service) ? o.service : proById(o.pro).services[0], m2: o.m2 || 54, extras: o.extras.slice() }); go('book'); },

  openChat(id) { if (S.role !== 'client') return; go('chat', { id }); },
  quickReply(text, id) { sendMsg(id, text); },

  becomePro() { S.role = 'pro'; S.tab = 'listing'; S.stacks = {}; anim = 'enter'; toast('Witaj w trybie wykonawcy', 'sparkles'); render(); },
  setRole(r) { if (S.role === r) return; S.role = r; S.tab = r === 'pro' ? 'dash' : 'home'; S.stacks = {}; S.sheet = null; anim = 'fade'; render(); },

  toggleOnline() { S.pro.online = !S.pro.online; toast(S.pro.online ? 'Znów przyjmujesz zlecenia' : 'Nie pokazujemy Cię w wynikach do odwołania', S.pro.online ? 'zap' : 'moon'); render(); },
  acceptReq(id) {
    const P = S.pro; const r = P.requests.find(x => x.id === id);
    P.requests = P.requests.filter(x => x.id !== id);
    P.jobs.push({ day: r.day, time: r.time, end: endTime(r.time, r.h), client: r.client, service: r.service, area: r.area.split(',')[0], pay: r.pay, tone: 'm', x: r.x, y: r.y });
    toast(`Przyjęte: ${dayLabel(addDays(r.day))}, ${r.time}. Dodano do grafiku`, 'calendar-check'); render();
  },
  declineReq(id) {
    const P = S.pro; lastDeclined = P.requests.find(x => x.id === id);
    P.requests = P.requests.filter(x => x.id !== id); S.sheet = null; toast('Zapytanie odrzucone', 'x', 'undoDecline'); render();
  },
  undoDecline() { if (lastDeclined) { S.pro.requests.unshift(lastDeclined); lastDeclined = null; $toast.innerHTML = ''; render(); } },
  calDay(i) { S.pro.calDay = Number(i); render(); },
  toggleAvail(d) { S.pro.avail[d] = !S.pro.avail[d]; render(); },
  lsvc(id) { S.pro.dirty = true; const x = S.pro.listing.services; const i = x.indexOf(id); i >= 0 ? (x.length > 1 && x.splice(i, 1)) : x.push(id); render(); },
  ltoggle(k) { S.pro.dirty = true; const L = S.pro.listing; L[k] = !L[k]; if (k === 'kmOn' && L.kmOn && !L.kmRate) L.kmRate = 2; render(); },
  lmin(d) { S.pro.dirty = true; const L = S.pro.listing; L.minH = Math.min(8, Math.max(1, L.minH + Number(d))); render(); },
  lphotoDel(i) { S.pro.dirty = true; S.pro.listing.photos.splice(Number(i), 1); render(); },
  uploadOC() { S.pro.listing.insured = true; toast('Polisa OC dodana. Odznaka pojawi się po weryfikacji', 'shield-check'); render(); },
  publish() { S.pro.listing.published = true; toast('Ogłoszenie zapisane i widoczne dla klientów', 'megaphone'); render(); },
  previewPro() { go('selfpreview'); },

  searchView(v) { S.searchView = v; S.mapMoved = false; render(); },
  searchArea() {
    if (S.mbx && MBX.search) { const b = MBX.search.map.getBounds(); S.filters.boundsReal = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; S.filters.bounds = [0, 0, 0, 0]; S.mapMoved = false; buzz(8); toast(`W tym obszarze: ${filteredPros().length} wykonawców`, 'scan-search'); render(); return; }
    const v = S.maps.search; const hw = v.w / 2 / v.z, hh = v.h / 2 / v.z; S.filters.bounds = [v.x - hw, v.y - hh, v.x + hw, v.y + hh]; S.mapMoved = false; buzz(8); toast(`W tym obszarze: ${filteredPros().length} wykonawców`, 'scan-search'); render(); },
  clearGeo(k) { S.filters[k] = null; if (k === 'bounds') S.filters.boundsReal = null; render(); },
  openLocation() {
    delete S.maps.loc; S.locReal = null;
    if (S.mbx) { const a = curAddr(); if (MBX.loc && a.lat != null) MBX.loc.map.jumpTo({ center: [a.lng, a.lat], zoom: 15.5 }); setTimeout(() => { if (a.lat != null) liveLocReal(a.lat, a.lng); }, 350); } S.newAddrLabel = 'Dom'; S.newAddrNote = ''; go('location'); },
  openExplore() { go('explore'); },
  exploreLayer(k) { S.exploreLayer = k; render(); },
  pickAddr(id) { S.addrId = id; updateGeo(); const ad = curAddr(); toast(`Szukamy dla: ${ad.label}, ${placeOf(ad)}`, 'map-pin'); afterAddrChange(id); },
  newAddrLabel(l) { S.newAddrLabel = l; render(); },
  useGps() { S.maps.loc = { x: 12.7, y: 10.1, z: 40 }; toast('Lokalizacja symulowana: Centrum', 'locate-fixed'); render(); },
  locPickReal(ll) {
    const [lat, lng] = ll.split(',').map(Number); S.locReal = { lat, lng }; const q = document.getElementById('locq'); if (q) q.value = ''; const box = document.getElementById('locSug'); if (box) box.innerHTML = '';
    if (S.mbx && MBX.loc) { MBX.loc.map.flyTo({ center: [lng, lat], zoom: 16.5, essential: true }); liveLocReal(lat, lng); return; }
    const g = GEOFIT.toGrid(lat, lng); S.maps.loc = { x: g.x, y: g.y, z: 44 }; render();
  },
  locPick(xy) { const [x, y] = xy.split(',').map(Number); S.maps.loc = { x, y, z: 44 }; const q = document.getElementById('locq'); if (q) q.value = ''; render(); },
  saveAddr() {
    const v = S.maps.loc; if (!v) return; const rg = reverseGeo(v.x, v.y);
    const ad = { id: 'a' + Date.now(), label: S.newAddrLabel || 'Nowy adres', street: rg.street, x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100, note: S.newAddrNote || '' };
    S.addresses.push(ad); S.addrId = ad.id; updateGeo(); buzz([8, 30, 8]); toast(`Zapisano: ${ad.street}, ${rg.district}`, 'map-pin-plus'); afterAddrChange(ad.id);
  },
  openNotifs() { go('notifs'); },
  openNotif(id) { const n = S.notifs.find(x => x.id === id); if (!n) return; n.read = true; if (n.act && A[n.act]) A[n.act](n.a); else render(); },
  readAll() { S.notifs.forEach(n => { n.read = true; }); render(); },
  notifPref(k) { S.notifPrefs[k] = !S.notifPrefs[k]; render(); },
  openResched(id) { const o = S.orders.find(x => x.id === id); S.resched = { day: Math.max(1, o.date + 1), time: null }; A.sheet('resched', id); },
  reschedDay(d) { S.resched.day = Number(d); if (S.resched.time && slotTaken(S.orders.find(x => x.id === S.sheet.p).pro, S.resched.day, S.resched.time)) S.resched.time = null; render(); },
  reschedTime(t) { S.resched.time = t; render(); },
  doResched(id) {
    const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const R = S.resched;
    o.date = R.day; o.time = R.time; o.status = 'pending'; S.sheet = null; buzz(8); toast('Prośba o zmianę wysłana', 'calendar-clock'); render();
    setTimeout(() => { if (o.status === 'pending') { o.status = 'confirmed'; pushNotif('calendar-check', 'Nowy termin potwierdzony', `${p.name}: ${dayLabel(addDays(o.date))}, ${o.time}.`, 'openOrder', o.id); toast(`${p.name.split(' ')[0]} potwierdza nowy termin`, 'calendar-check'); render(); } }, 3500);
  },
  skipVisit(id) {
    const o = S.orders.find(x => x.id === id); const step = { week: 7, biweek: 14, month: 28 }[o.freq] || 14;
    o.date += step; S.sheet = null; pushNotif('calendar-x', 'Wizyta pominięta', `Następna: ${dayLabel(addDays(o.date))}, ${o.time}. Wykonawca wie o zmianie.`, 'openOrder', o.id);
    toast(`Pominięto. Następna wizyta: ${dayLabel(addDays(o.date))}, ${o.time}`, 'calendar-x'); render();
  },
  openProblem(id) { S.problem = { cat: '', want: ISSUE_WANTS[0], desc: '', photos: [] }; go('problem', { id }); },
  probSet(k, v) { S.problem[k] = v; render(); },
  sendProblem(id) {
    const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const P = S.problem;
    o.issue = { cat: P.cat, want: P.want, status: 'sent', at: dayLabel(today) + ', ' + nowTime() }; back(); toast('Zgłoszenie wysłane do wykonawcy', 'flag');
    setTimeout(() => {
      if (!o.issue || o.issue.status !== 'sent') return; o.issue.status = 'answered'; o.issue.answeredAt = nowTime();
      const th = (S.threads[p.id] ||= { unread: 0, msgs: [] });
      th.msgs.push({ me: false, t: P.want.startsWith('Poprawka') ? `Bardzo przepraszam. Mogę przyjechać jutro o 9:00 i poprawić łazienkę bez dodatkowej opłaty. ${P.cat === 'Szkoda lub zniszczenie' ? 'Za wazon odpowiem z mojej polisy OC, proszę o zdjęcie.' : ''}` : 'Przepraszam za kłopot, zadzwonię dziś po 17, żeby to wyjaśnić.', at: nowTime() }); th.unread++;
      pushNotif('message-circle', 'Wykonawca odpowiedział na zgłoszenie', `${p.name} proponuje rozwiązanie.`, 'openChat', p.id);
      toast(`${p.name.split(' ')[0]} odpowiada na zgłoszenie`, 'message-circle'); render();
    }, 4000);
  },
  resolveIssue(id) { const o = S.orders.find(x => x.id === id); o.issue.status = 'resolved'; toast('Dziękujemy, zgłoszenie zamknięte', 'check'); render(); },
  openInvited(id) { go('invited', { id }); },
  demoInvite() { S.introSeen = true; S.role = 'client'; S.tab = 'home'; S.stacks = {}; S.sheet = null; render(); setTimeout(() => go('invited', { id: 'marta' }), 50); },
  openPChat(id, name) {
    if (!id) { id = (name || 'klient').toLowerCase().replace(/[^a-ząćęłńóśźż]+/g, '-'); S.pro.threads[id] ||= { name: name || 'Klient', ini: (name || 'K').split(' ').map(w => w[0]).join('').slice(0, 2), tone: 't-lilac', unread: 0, msgs: [] }; }
    go('pchat', { id });
  },
  pQuick(text, id) { sendPMsg(id, text); },
  reportNoShow(i) { const j = S.pro.jobs[Number(i)]; j.noshow = true; S.sheet = null; buzz([10, 40, 10]); toast('Zgłoszenie zapisane. Klient dostał powiadomienie', 'door-closed'); render(); },
  joinWaitlist(key) { if (!S.waitlist.includes(key)) S.waitlist.push(key); buzz(8); toast('Zapisano. Damy znać, gdy ruszymy w Twojej okolicy', 'bell-plus'); const m = mapInst('loc'); if (m) liveLoc(m.v.x, m.v.y); else render(); },
  openBoost() { go('boost'); },
  openInvite() { go('invite'); },
  boostDays(d) { S.pro.boost.draft.days = Number(d); render(); },
  buyBoost() {
    const B = S.pro.boost; const D = B.draft; const L = S.pro.listing; if (B.active.length) return;
    const d = proDemand(); const price = boostPrice(d, D.days); const fromCredit = Math.min(price, B.credit); const area = `${L.radius} km od: ${baseLabelOf()}`;
    B.credit -= fromCredit; B.history.push({ t: `Wyróżnienie: ${area} (${D.days} dni)`, v: -fromCredit });
    B.active.push({ area, days: D.days, left: D.days, views: 0, opens: 0, req: 0, goal: boostViews(d, D.days) });
    setTimeout(() => { toast(price > fromCredit ? `Wyróżnienie aktywne. Dopłata ${zl(price - fromCredit)} (w makiecie bez płatności)` : `Wyróżnienie aktywne w całym zasięgu (${L.radius} km)`, 'rocket'); back(); }, 250);
  },
  copyText(t) { const done = () => toast('Skopiowano link', 'copy'); try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); } },
  copyMsg() { const el = document.getElementById('invmsg'); const done = () => toast('Wiadomość skopiowana, wklej ją w SMS-ie', 'copy'); try { navigator.clipboard.writeText(el.value).then(done, () => { el.select(); done(); }); } catch (e) { el.select(); done(); } },
  setRadius(r) { S.pro.dirty = true; S.pro.listing.radius = Number(r); buzz(8); render(); },
  setKmRate(v) { S.pro.dirty = true; S.pro.listing.kmRate = Number(v); render(); },
  setFreeKm(v) { S.pro.dirty = true; S.pro.listing.freeKm = Number(v); render(); },
  // nowa baza: punkt z mapy albo miejscowość z wyszukiwarki („lat,lng,nazwa”)
  setBase(arg) { S.pro.dirty = true;
    const [la, ln, ...rest] = String(arg).split(','); const lat = Number(la), lng = Number(ln); const g = GEOFIT.toGrid(lat, lng); const L = S.pro.listing;
    L.base = { x: g.x, y: g.y, lat, lng }; L.baseLabel = rest.join(',') || ''; if (!L.baseLabel && !S.online) L.baseLabel = placeNear(L.base);
    buzz(8); const box = document.getElementById('baseSug'); if (box) box.innerHTML = ''; render(); if (S.online) baseChanged();
  },
  openArea() { delete S.maps.area; go('area'); },
  saveArea() { const L = S.pro.listing; toast(`Zasięg zapisany: ${L.radius} km od: ${baseLabelOf()}`, 'map'); back(); },
  mapSel(id) { S.mapSel = id; buzz(8); render(); },
  newPost() { S.draft = newDraft(S.filters.cat); go('post'); },
  dset(k, v) { S.draft[k] = k === 'day' ? Number(v) : v; render(); },
  dphotoDel(i) { S.draft.photos.splice(Number(i), 1); render(); },
  publishPost() {
    const d = S.draft; const x = Object.assign({ id: 'p' + Date.now(), status: 'open', offers: [], chosen: null }, JSON.parse(JSON.stringify(d)));
    x.pool = buildPool(x); S.posts.unshift(x); S.draft = null; S.offerSort = 'rec';
    stack()[stack().length - 1] = { name: 'offers', p: { id: x.id } }; anim = 'enter';
    toast('Zlecenie opublikowane. Oferty zaraz się pojawią', 'send'); render();
  },
  openOffers(id) { S.offerSort = 'rec'; go('offers', { id }); },
  offerSort(v) { S.offerSort = v; render(); },
  closePost(id) { const x = S.posts.find(y => y.id === id); x.pool = x.offers.slice(); if (!x.offers.length) { S.posts = S.posts.filter(y => y.id !== id); back(); toast('Zlecenie usunięte', 'trash-2'); return; } render(); },
  acceptOffer(arg) {
    const [pid, oid] = arg.split('|'); const x = S.posts.find(y => y.id === pid); const of = x.offers.find(y => y.id === oid);
    x.status = 'chosen'; x.chosen = oid; x.pool = x.offers.slice();
    const ord = { id: 'o' + Date.now(), pro: of.pro, service: x.cat, date: of.day, time: of.time, h: of.h, m2: ['okna', 'tapicerka'].includes(x.cat) ? 0 : x.m2, total: of.price, freq: 'once', status: 'confirmed', extras: [], addr: curAddr().street, addrId: S.addrId, pay: 'Gotówka', fromOffer: true };
    S.orders.push(ord); S.sheet = null; S.posts = S.posts.filter(y => y.id !== pid).concat(x);
    S.stacks[stackKey()] = [{ name: S.tab }, { name: 'booked', p: { id: ord.id } }]; anim = 'enter'; render();
  },
  ofDay(i) { S.pro.offerDraft.day = Number(i); render(); },
  submitOffer(id) { const m = S.pro.market.find(y => y.id === id); m.sent = S.pro.offerDraft.price; S.sheet = null; toast(`Oferta wysłana. ${m.client} dostanie powiadomienie`, 'send'); render(); },
  introRole(r) {
    const el = document.getElementById('intro'); if (el) el.classList.add('leaving'); buzz(8);
    setTimeout(() => { S.introSeen = true; if (r !== S.role) { S.role = r; S.tab = r === 'pro' ? 'dash' : 'home'; S.stacks = {}; } anim = 'fade'; render(); }, 380);
  },
  showIntro() { S.introSeen = false; render(); },
  cyclePart() {
    const order = ['auto', 'morning', 'day', 'evening', 'night']; S.daypart = order[(order.indexOf(S.daypart || 'auto') + 1) % order.length];
    document.getElementById('partBtn').textContent = 'Pora dnia: ' + { auto: 'jak zegar', morning: 'rano', day: 'dzień', evening: 'wieczór', night: 'noc' }[S.daypart];
    if (S.role !== 'client') { S.role = 'client'; S.tab = 'home'; S.stacks = {}; } else if (S.tab !== 'home' || stack().length > 1) { S.tab = 'home'; S.stacks[stackKey()] = [{ name: 'home' }]; }
    render();
  },
  cycleTheme() {
    setTimeout(() => { if (S.mbx) { mbxRestyle(); render(); } }, 0);
    const order = [null, 'light', 'dark']; const cur = document.documentElement.getAttribute('data-theme');
    const next = order[(order.indexOf(cur) + 1) % 3];
    if (next) document.documentElement.setAttribute('data-theme', next); else document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeBtn').textContent = 'Motyw: ' + (next === 'light' ? 'jasny' : next === 'dark' ? 'ciemny' : 'systemowy');
    store.set('theme', next);
  },
  resetDemo() { const theme = store.get('theme', null); S = seed(); S.stacks = {}; S.sheet = null; store.set('state3', {}); store.set('theme', theme); toast('Dane demo przywrócone', 'rotate-ccw'); render(); }
};
let lastDeclined = null;
function afterAddrChange(id) {
  const st = stack(); const prev = st[st.length - 2];
  if (prev && prev.name === 'book' && S.booking) S.booking.addr = id;
  S.mapMoved = false; delete S.maps.search; delete S.maps.explore;
  if (st.length > 1) back(); else render();
}

/* ================= events ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (Date.now() - mapDragAt < 250 && el.closest('.gmap') && !el.closest('.gm-over')) return;
  if (Date.now() - mapTapAt < 450 && el.classList.contains('sheet-bg')) return; // syntetyczny klik po stuknięciu w mapę
  const fn = A[el.dataset.act]; if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  fn(el.dataset.a, el.dataset.b, el);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});
function setPath(path, val) { const ks = path.split('.'); let o = S; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = val; }
document.addEventListener('input', e => {
  const el = e.target; const path = el.dataset.model; if (!path) { if (el.dataset.live) liveUpdate(el.dataset.live); return; }
  let v = el.value; if (el.dataset.type === 'num') v = Number(v);
  if (el.dataset.live === 'blik') { v = v.replace(/\D/g, '').slice(0, 6); el.value = v; }
  setPath(path, v); if (path.startsWith('pro.listing')) S.pro.dirty = true;
  liveUpdate(el.dataset.live);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'photoIn') { readPhotos(el.files, S.pro.listing.photos, 8); return; }
  if (el.id === 'postPhotoIn') { readPhotos(el.files, S.draft.photos, 6); return; }
  if (el.id === 'probPhotoIn') { readPhotos(el.files, S.problem.photos, 4); return; }
  if (el.dataset.rr) { if (el.dataset.model) { let v = el.value; if (el.dataset.type === 'num') v = Number(v); setPath(el.dataset.model, v); } render(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target; const kind = f.dataset.form;
  if (kind === 'login') { loginSubmit(f); return; }
  if (kind === 'loc') { const first = document.querySelector('#locSug .sug'); if (first) first.click(); return; }
  if (kind === 'search' || kind === 'search2') { S.filters.q = f.q.value; if (kind === 'search') { S.filters.cat = null; go('search'); } else render(); }
  if (kind === 'pchat') { const v = f.m.value; f.m.value = ''; sendPMsg(f.dataset.id, v); setTimeout(() => { const i = document.getElementById('chatInput'); i && i.focus(); }, 0); }
  if (kind === 'chat') { const v = f.m.value; f.m.value = ''; sendMsg(f.dataset.id, v); setTimeout(() => { const i = document.getElementById('chatInput'); i && i.focus(); }, 0); }
});

function liveUpdate(kind) {
  if (!kind) return;
  if (kind === 'm2' || kind === 'blik') {
    const b = S.booking; const p = proById(b.pro); const e = estimate(b, p);
    const v = document.getElementById('m2val'); if (v) v.innerHTML = `${b.m2}<small>m²</small>`;
    const t = document.getElementById('estTotal'); if (t) t.textContent = zl(b.step === 4 ? e.total : e.work - e.discount);
    const s = document.getElementById('estSub'); if (s) s.textContent = `ok. ${hrs(e.h)} · ${p.name.split(' ')[0]}${e.disc ? ' · −' + Math.round(e.disc * 100) + '%' : ''}`;
    const pb = document.getElementById('slide-pay'); if (pb && kind === 'blik') pb.classList.toggle('off', !/^\d{6}$/.test(b.blik));
    const note = document.querySelector('.note b'); if (note && b.step === 1) note.textContent = hrs(e.h);
  }
  if (kind === 'pm2') { const v = document.getElementById('pm2val'); if (v) v.innerHTML = `${S.draft.m2}<small>m²</small>`; }
  if (kind === 'pbud') { const v = document.getElementById('pbudget'); if (v) v.textContent = S.draft.budget ? 'do ' + zl(S.draft.budget) : 'nie podaję'; }
  if (kind === 'ofp') { const d = S.pro.offerDraft; document.getElementById('ofPrice').innerHTML = `${d.price}<small>zł</small>`; document.getElementById('ofNet').textContent = 'Bez prowizji: całe ' + zl(d.price) + ' dla Ciebie'; }
  if (kind === 'maxDist') { const v = document.getElementById('maxDistVal'); if (v) v.textContent = S.filters.maxDist >= 15 ? 'dowolna' : 'do ' + S.filters.maxDist + ' km'; }
  if (kind === 'arad') {
    const L = S.pro.listing; const free = L.kmOn && L.freeKm ? L.freeKm : 0;
    if (S.mbx && MBX.area) { const c = MBX.area.cfg; if (c.mb && L.base.lat != null) c.mb.circles = [{ lat: L.base.lat, lng: L.base.lng, km: L.radius / ROAD }].concat(free ? [{ lat: L.base.lat, lng: L.base.lng, km: free / ROAD, kind: 'fee' }] : []); mbxSync('area'); }
    document.getElementById('aradVal').innerHTML = `${L.radius}<small>km</small>`;
    const c = document.getElementById('areaCircle'); if (c) c.setAttribute('r', L.radius * U);
    document.getElementById('areaStats').innerHTML = areaStatsHTML(); if (S.online) baseChanged();
  }
  // wyszukiwanie miejscowości bazy
  if (kind === 'baseq') {
    const q = (document.getElementById('baseq').value || '').trim(); const box = document.getElementById('baseSug'); if (!box) return;
    const show = list => { box.innerHTML = list.map(x => `<button class="sug" data-act="setBase" data-a="${x.lat},${x.lng},${esc(x.name)}">${ic('map-pin', 's')}<span class="grow"><b class="small">${esc(x.name)}</b><span class="tiny faint" style="display:block">${esc(x.sub || '')}</span></span></button>`).join('') || (q.length >= 2 ? '<div class="tiny faint" style="padding:8px 4px">Nie znaleźliśmy takiej miejscowości.</div>' : ''); };
    if (q.length < 2) return show([]);
    if (!S.online) return show(DEMO_PLACES.filter(c => c[0].toLowerCase().startsWith(q.toLowerCase())).map(c => ({ name: c[0], lat: c[1], lng: c[2], sub: 'centrum miejscowości' })));
    clearTimeout(baseQT); baseQT = setTimeout(async () => {
      let r; try { r = await window.LsniAPI.call('GET', `/api/geo/search?q=${encodeURIComponent(q)}&near=${S.pro.listing.base.lat.toFixed(3)},${S.pro.listing.base.lng.toFixed(3)}`); } catch (e) { return; }
      show(r.results.filter(x => x.inArea).map(x => ({ name: x.kind === 'place' || x.kind === 'locality' ? x.street : (x.city || x.street), lat: x.lat, lng: x.lng, sub: x.full })));
    }, 250);
  }
  if (kind === 'locq' && S.online) {
    const q = (document.getElementById('locq').value || '').trim(); const box = document.getElementById('locSug'); if (!box) return;
    clearTimeout(locTimer); if (q.length < 3) { box.innerHTML = ''; return; }
    const seq = ++locSeq;
    locTimer = setTimeout(async () => {
      let r; try { const ad = curAddr(); r = await window.LsniAPI.call('GET', `/api/geo/search?q=${encodeURIComponent(q)}${ad && ad.lat != null ? `&near=${ad.lat.toFixed(3)},${ad.lng.toFixed(3)}` : ''}`); } catch (e) { return; }
      if (seq !== locSeq) return;
      box.innerHTML = r.results.length ? r.results.map(x => `<button class="sug" data-act="locPickReal" data-a="${x.lat},${x.lng}">${ic(x.inArea ? 'map-pin' : 'map-pin-off', 's')}<span class="grow"><b class="small">${esc(x.street)}</b><span class="tiny faint" style="display:block">${esc(x.full || x.district)}</span></span><span class="tiny faint">${x.inArea ? esc(x.city || (x.area ? x.area.name : x.district)) : 'poza Polską'}</span></button>`).join('') : '<div class="tiny faint" style="padding:8px 4px">Nie znaleźliśmy takiego adresu. Wpisz ulicę, numer i miasto, np. Floriańska 10, Kraków.</div>';
    }, 250);
    return;
  }
  if (kind === 'locq') {
    const q = (document.getElementById('locq').value || '').trim().toLowerCase(); const box = document.getElementById('locSug'); if (!box) return;
    const hits = q.length < 2 ? [] : STREETS.filter(st => st[0].toLowerCase().includes(q)).slice(0, 5);
    box.innerHTML = hits.map(st => `<button class="sug" data-act="locPick" data-a="${st[1]},${st[2]}">${ic('map-pin', 's')}<span class="grow">${st[0]}</span><span class="tiny faint">${placeNear({ x: st[1], y: st[2] })}</span></button>`).join('') || (q.length >= 2 ? '<div class="tiny faint" style="padding:8px 4px">Brak takiej ulicy w makiecie. Spróbuj: Grochowska, Targowa, Wolska.</div>' : '');
  }
  if (kind === 'maxPrice') { const v = document.getElementById('maxPriceVal'); if (v) v.textContent = S.filters.maxPrice >= 100 ? 'bez limitu' : S.filters.maxPrice + ' zł/h'; }
  if (kind === 'rate') {
    const L = S.pro.listing; document.getElementById('rateVal').innerHTML = `${L.rate}<small>zł/h</small>`;
    document.getElementById('rateHint').innerHTML = `Przy 20 h tygodniowo zarobisz ok. <b>${zl(Math.round(L.rate * 80))}</b> miesięcznie. Lśni nie bierze prowizji.`;
    refreshPreview();
  }
  if (kind === 'preview') refreshPreview();
  if (kind === 'bio') { const L = S.pro.listing; document.getElementById('bioHint').textContent = `${L.bio.length} znaków${L.bio.length < 80 ? ' · napisz co najmniej 80' : ''}`; }
}
function refreshPreview() {
  const wrap = document.getElementById('preview'); if (!wrap) return;
  const tmp = document.createElement('div'); tmp.innerHTML = screens.listing();
  const np = tmp.querySelector('#preview'); if (np) wrap.innerHTML = np.innerHTML;
}
function readPhotos(files, target, max) {
  const list = Array.from(files).slice(0, max - target.length);
  let left = list.length; if (!left) return;
  list.forEach(f => {
    const r = new FileReader();
    r.onload = () => {
      // pomniejsz zdjęcie, żeby nie zapchać pamięci przeglądarki
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); const s = 240 / Math.max(img.width, img.height);
        c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        target.push(c.toDataURL('image/jpeg', .7)); if (--left === 0) { toast('Zdjęcia dodane', 'image'); render(); }
      };
      img.onerror = () => { if (--left === 0) render(); };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  });
}

/* ================= tickers: oferty spływają, checklista się odhacza ================= */
setInterval(() => {
  let dirty = false; const t = top();
  S.posts.forEach(x => {
    if (x.status !== 'open' || x.offers.length >= x.pool.length) return;
    x.wait = (x.wait || 0) + 1;
    if (x.wait >= 2 + (x.offers.length % 2)) {
      x.wait = 0; const of = x.pool[x.offers.length]; x.offers.push(of);
      pushNotif('hand-coins', `Nowa oferta: ${zl(of.price)}`, `${proById(of.pro).name} · ${catById(x.cat).name}`, 'openOffers', x.id);
      if (!(t.name === 'offers' && t.p.id === x.id)) toast(`Nowa oferta: ${proById(of.pro).name.split(' ')[0]}, ${zl(of.price)}`, 'hand-coins');
      x.justAdded = of.id;
      if (t.name === 'orders' || (t.name === 'offers' && t.p.id === x.id)) dirty = true;
    }
  });
  S.orders.forEach(o => {
    if (o.status !== 'enroute') return;
    const p = proById(o.pro); o.track = Math.min(S.online ? .95 : 1, (o.track || 0) + .06);
    const mbe = MBX['trk-' + o.id];
    if (S.mbx && mbe && o.routeReal) {
      const { pos, done } = alongLngLat(o.routeReal.coordinates, o.track); const mk = mbe.markers['trk-' + o.id]; if (mk) mk.setLngLat(pos);
      const src = mbe.map.getSource('lsni-route-done'); if (src) src.setData(fcol([{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: done } }]));
      if (mbe.cfg.mb) mbe.cfg.mb.routeDone = done; if (mbe.cfg.markers) { const cm = mbe.cfg.markers.find(x => x.id === 'trk-' + o.id); if (cm) { cm.lat = pos[1]; cm.lng = pos[0]; } }
      const et = document.getElementById('eta-' + o.id); if (et) et.innerHTML = etaTextReal(o, p);
    }
    const m = mapInst('trk-' + o.id);
    if (m) { const { a, pts } = trackRoute(o, p); const pos = alongRoute(pts, o.track); const car = document.getElementById('trk-' + o.id); if (car) m.place(car, pos[0], pos[1]);
      const done = document.getElementById('trkdone-' + o.id); if (done) done.setAttribute('points', pts.filter((q, i) => i === 0 || (i === 1 && o.track > .5)).concat([pos]).map(q => `${q[0] * U},${q[1] * U}`).join(' '));
      const et = document.getElementById('eta-' + o.id); if (et) et.innerHTML = etaText(o, p, o.track, roadKm(p, a)); }
    if (o.track >= 1 && !S.online) { o.status = 'progress'; o.prog = 0; o.started = nowTime(); toast(`${p.name.split(' ')[0]} jest na miejscu`, 'map-pin'); if (t.name === 'order' && t.p.id === o.id) dirty = true; }
  });
  S.orders.forEach(o => {
    if (o.status !== 'progress') return;
    const total = checklistFor(o).length; o.prog = Math.min(total - (S.online ? 1 : 0), (o.prog || 0) + 1);
    if (o.prog >= total && !S.online) { o.status = 'done'; finishOrder(o); }
    if (t.name === 'order' && t.p.id === o.id) dirty = true;
  });
  const bA = S.pro.boost.active[0];
  if (bA && !S.online) {
    bA.views += Math.random() < .7 ? 1 + Math.floor(Math.random() * 2) : 0; if (Math.random() < .12) bA.opens++;
    if (Math.random() < .015) { bA.req++; if (S.role === 'pro') toast(`Nowe zapytanie dzięki wyróżnieniu: ${bA.d}`, 'rocket'); }
    const g = boostViews(bA.d, bA.days); const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('bst-v', bA.views); set('bst-o', bA.opens); set('bst-r', bA.req); const m = document.getElementById('bst-m'); if (m) m.style.width = Math.min(100, bA.views / g * 100) + '%';
    if (bA.views >= g) set('bst-g', 'Gwarancja spełniona');
  }
  if (dirty && !S.sheet && !document.activeElement.matches('input,textarea')) render();
  S.posts.forEach(x => { x.justAdded = null; });
}, 1300);

/* ================= TRYB ONLINE: dane z serwera Lśni ================= */
// Otwarta z serwera (katalog server/) aplikacja loguje kodem SMS i działa na prawdziwych danych.
// W podglądzie albo z pliku zostaje tryb demo z danymi w przeglądarce.
const API = window.LsniAPI || null;
const REAL_CENTERS = { 'Bielany': [52.2930, 20.9350], 'Żoliborz': [52.2680, 20.9850], 'Bemowo': [52.2540, 20.9100], 'Wola': [52.2360, 20.9600], 'Śródmieście': [52.2310, 21.0120], 'Ochota': [52.2120, 20.9720], 'Mokotów': [52.1900, 21.0250], 'Ursynów': [52.1500, 21.0450], 'Wilanów': [52.1600, 21.0900], 'Praga-Płn.': [52.2580, 21.0350], 'Targówek': [52.2900, 21.0550], 'Praga-Płd.': [52.2380, 21.0850] };
// Przeliczenie prawdziwych współrzędnych na schematyczną mapę: dopasowanie afiniczne (najmniejsze kwadraty) po środkach dzielnic.
const GEOFIT = (() => {
  const names = Object.keys(SITES); const rows = names.map(n => [REAL_CENTERS[n][1], REAL_CENTERS[n][0], 1]);
  const solve = target => {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    rows.forEach((r, i) => { for (let a = 0; a < 3; a++) { b[a] += r[a] * target[i]; for (let c = 0; c < 3; c++) M[a][c] += r[a] * r[c]; } });
    for (let i = 0; i < 3; i++) { let pv = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[pv][i])) pv = k; [M[i], M[pv]] = [M[pv], M[i]]; [b[i], b[pv]] = [b[pv], b[i]]; for (let k = i + 1; k < 3; k++) { const f = M[k][i] / M[i][i]; for (let c = i; c < 3; c++) M[k][c] -= f * M[i][c]; b[k] -= f * b[i]; } }
    const x = [0, 0, 0]; for (let i = 2; i >= 0; i--) { let sm = b[i]; for (let c = i + 1; c < 3; c++) sm -= M[i][c] * x[c]; x[i] = sm / M[i][i]; } return x;
  };
  const X = solve(names.map(n => SITES[n][0])), Y = solve(names.map(n => SITES[n][1])); const det = X[0] * Y[1] - X[1] * Y[0];
  return {
    toGrid: (lat, lng) => ({ x: X[0] * lng + X[1] * lat + X[2], y: Y[0] * lng + Y[1] * lat + Y[2] }),
    toReal: (x, y) => { const dx = x - X[2], dy = y - Y[2]; return { lng: (dx * Y[1] - X[1] * dy) / det, lat: (X[0] * dy - Y[0] * dx) / det }; }
  };
})();
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayOffset = iso => Math.round((new Date(iso.slice(0, 10) + 'T00:00') - today) / 864e5);
const relTime = iso => { const d = new Date(iso); return ymd(d) === ymd(new Date()) ? `${d.getHours()}:${pad2(d.getMinutes())}` : `${d.getDate()} ${MON[d.getMonth()]}`; };
const PAYL = { cash: 'Gotówka', blikphone: 'BLIK na telefon', transfer: 'Przelew', invoice: 'Faktura VAT' };
const NICON = { booking_request: 'calendar-plus', booking_confirmed: 'badge-check', booking_cancelled: 'calendar-x', booking_declined: 'calendar-x', booking_reschedule: 'calendar-clock', booking_skip: 'calendar-x', booking_enroute: 'car', booking_done: 'sparkles', reminder: 'bell-ring', message: 'message-circle', report: 'flag', report_answer: 'message-circle', report_resolved: 'check', report_escalated: 'flag', review: 'star', review_request: 'star', credit: 'rocket', boost_end: 'rocket', verification: 'badge-check', noshow: 'door-closed', waitlist: 'map-pin' };
const SLOTCACHE = {};
const pointQuery = () => { const a = curAddr(); return a && a.id && !a.id.startsWith('_') ? `addressId=${encodeURIComponent(a.id)}` : `lat=${a.lat}&lng=${a.lng}`; };
function accountMenu() {
  return `${S.me && S.me.role === 'admin' ? `<a class="mi" href="/admin" target="_blank" rel="noopener">${ic('shield', 's')}Panel zespołu<span class="r">${ic('external-link', 's')}</span></a>` : ''}
    <a class="mi" href="/legal/regulamin" target="_blank" rel="noopener">${ic('file-text', 's')}Regulamin i prywatność<span class="r">${ic('external-link', 's')}</span></a>
    <button class="mi" data-act="logout">${ic('log-out', 's')}Wyloguj<span class="r">${esc(S.me ? S.me.phone : '')}</span></button>`;
}

// ---------- mapowanie danych z API na model aplikacji ----------
function mapAddress(a) { const g = GEOFIT.toGrid(a.lat, a.lng); return { id: a.id, label: a.label, street: a.street, note: a.note || '', lat: a.lat, lng: a.lng, x: g.x, y: g.y, city: a.city || '' }; }
function mapProvider(v) {
  const g = GEOFIT.toGrid(v.base.lat, v.base.lng); let p = PROS.find(x => x.id === v.id);
  if (!p) { p = { id: v.id, repeat: 65, reviewsList: [] }; PROS.push(p); }
  Object.assign(p, { name: v.name, ini: v.ini, tone: v.tone, kind: v.kind, area: v.area, rating: v.rating, reviews: v.reviews, jobs: v.jobs, response: v.response, rate: v.rate, minH: v.minH, since: v.since,
    verified: v.verified, insured: v.insured, invoice: v.invoice, supplies: v.supplies, eco: v.eco, pets: v.pets, langs: v.langs, services: v.services, super: v.super, nextSlot: v.nextSlot, todayFree: v.todayFree,
    fixed: v.fixed, perWindow: v.perWindow, tagline: v.tagline, x: g.x, y: g.y, lat: v.base.lat, lng: v.base.lng, r: v.radiusKm, kmRate: v.kmRate || 0, freeKm: v.freeKm || 0, _api: true });
  if (v.dist !== undefined) Object.assign(p, { dist: v.dist, eta: v.eta, reach: v.reach, travelFee: v.travelFee || 0 });
  if (v.bio !== undefined) p.bio = v.bio;
  if (v.reviewsList) p.reviewsList = v.reviewsList.map(r => ({ who: r.who, stars: r.stars, when: `${r.when.slice(8, 10)}.${r.when.slice(5, 7)}`, text: r.text + (r.reply ? `\n\nOdpowiedź: ${r.reply}` : ''), tags: r.tags }));
  return p;
}
function ensureProvider(x) { if (!PROS.find(p => p.id === x.id)) PROS.push({ id: x.id, name: x.name, ini: x.ini, tone: x.tone || 't-blue', rating: 0, reviews: 0, rate: 0, minH: 3, services: ['dom'], reviewsList: [], response: '—', nextSlot: '—', x: 13, y: 15, r: 0, fee: 0, reach: 'out', promo: [], langs: ['PL'], area: '', tagline: '', kind: '' }); }
function mapOrder(b) {
  ensureProvider(b.provider); const old = S.orders.find(o => o.id === b.id) || {};
  const st = b.status === 'cancelled' || b.status === 'declined' ? 'cancel' : b.status;
  return Object.assign(old, { id: b.id, pro: b.provider.id, service: b.service, date: dayOffset(b.startsAt), time: b.startsAt.slice(11, 16), h: b.hours, m2: b.m2, total: b.totalZl, freq: b.freq, status: st, extras: b.extras,
    addr: b.address, addrId: b.addressId, pay: PAYL[b.payMethod] || 'Gotówka', onsite: b.onsite ? `${b.onsite.name} · ${b.onsite.phone}` : '', rated: b.rated,
    issue: b.report ? { cat: b.report.category, want: b.report.want, status: { open: 'sent', escalated: 'sent', answered: 'answered', resolved: 'resolved' }[b.report.status], at: relTime(b.report.at), answeredAt: b.report.answeredAt ? relTime(b.report.answeredAt) : '' } : null });
}
function mapNotif(n) { const [k, v] = String(n.link || '').split(':'); const act = k === 'booking' ? (S.role === 'pro' ? 'noop' : 'openOrder') : k === 'thread' ? (S.role === 'pro' ? 'openPChat' : 'openChat') : k === 'provider' ? 'openPro' : k === 'boosts' ? 'openBoost' : k === 'search' ? 'openSearch' : 'noop'; return { id: n.id, icon: NICON[n.kind] || 'bell', t: n.title, d: n.body, at: relTime(n.at), read: n.read, act, a: v || '' }; }
function mapJob(b) { const g = GEOFIT.toGrid(b.lat, b.lng); return { id: b.id, day: dayOffset(b.startsAt), time: b.startsAt.slice(11, 16), end: b.endsAt.slice(11, 16), client: b.client ? b.client.name : 'Klient', service: b.service, area: b.area || '', pay: b.totalZl, tone: b.status === 'confirmed' ? '' : 'y', x: g.x, y: g.y, lat: b.lat, lng: b.lng, thread: b.client ? b.client.id : '', noshow: b.status === 'noshow' }; }
function mapRequest(b) { const g = GEOFIT.toGrid(b.lat, b.lng); return { id: b.id, client: b.client.name, crating: { wysoka: 5, 'średnia': 4, niska: 3 }[b.client.reliability] || 5, service: b.service, m2: b.m2, rooms: b.rooms, baths: b.baths, day: dayOffset(b.startsAt), time: b.startsAt.slice(11, 16), h: b.hours, pay: b.totalZl, area: `${b.address}${b.area ? ', ' + b.area : ''}`, note: b.note || 'Bez uwag.', freq: b.freq, expires: 60, x: g.x, y: g.y, payHow: (PAYL[b.payMethod] || 'gotówka').toLowerCase() }; }

// ---------- pobieranie danych ----------
async function refreshProviders() {
  const res = await API.call('GET', `/api/providers?${pointQuery()}`);
  const seen = new Set(res.results.map(v => mapProvider(v).id));
  PROS.forEach(p => { if (!seen.has(p.id)) p.reach = 'out'; });
  res.results.forEach(v => { PROS.find(x => x.id === v.id).boosted = !!v.promoted; });
}
// Po zmianie bazy albo zasięgu w edytorze: popyt w nowym kole, mapa cieplna i nazwa miejsca (z krótką zwłoką).
let baseTimer = null;
function baseChanged() {
  clearTimeout(baseTimer);
  baseTimer = setTimeout(async () => {
    const L = S.pro.listing; const { lat, lng } = L.base; const key = `${lat},${lng},${L.radius}`; if (lat == null) return;
    try {
      const [heat, rev] = await Promise.all([API.call('GET', `/api/geo/demand?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&km=${Math.round(L.radius / ROAD + 5)}`),
        L.baseLabel ? null : API.call('GET', `/api/geo/reverse?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`)]);
      const d2 = await API.call('GET', `/api/geo/demand?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&km=${(L.radius / ROAD).toFixed(1)}`);
      S.pro.heat = heat.points; S.pro.areaQ = { key, demand: d2.demandPerDay }; if (rev && rev.city) L.baseLabel = rev.city;
      const st = document.getElementById('areaStats'); if (st && top().name === 'area' && document.activeElement && document.activeElement.id === 'arad') st.innerHTML = areaStatsHTML(); else render();
    } catch (e) { }
  }, 350);
}

async function refreshOrders() { const list = await API.call('GET', '/api/bookings'); S.orders = list.map(mapOrder); }
async function refreshNotifs() { const list = await API.call('GET', '/api/notifications'); S.notifs = list.map(mapNotif); }
async function refreshThreads() {
  const list = await API.call('GET', '/api/threads');
  if (S.role === 'pro') list.forEach(t => { const cur = S.pro.threads[t.peerId]; S.pro.threads[t.peerId] = { name: t.name, ini: t.ini, tone: t.tone, unread: t.unread, msgs: cur && cur.loaded ? cur.msgs : [{ me: t.mine, t: t.last, at: relTime(t.at) }], loaded: cur && cur.loaded }; });
  else list.forEach(t => { ensureProvider({ id: t.peerId, name: t.name, ini: t.ini, tone: t.tone }); const cur = S.threads[t.peerId]; S.threads[t.peerId] = { unread: t.unread, msgs: cur && cur.loaded ? cur.msgs : [{ me: t.mine, t: t.last, at: relTime(t.at) }], loaded: cur && cur.loaded }; });
}
async function loadThread(id, pro) {
  const r = await API.call('GET', `/api/threads/${encodeURIComponent(id)}/messages`);
  const msgs = r.messages.map(m => ({ me: m.me, t: m.body, at: relTime(m.at) }));
  if (pro) S.pro.threads[id] = Object.assign(S.pro.threads[id] || { name: r.peerName, ini: r.peerName.slice(0, 2).toUpperCase(), tone: 't-blue' }, { msgs, unread: 0, loaded: true });
  else S.threads[id] = { msgs, unread: 0, loaded: true };
}
async function loadSlots(id) {
  const days = await API.call('GET', `/api/providers/${encodeURIComponent(id)}/slots`);
  SLOTCACHE[id] = Object.fromEntries(days.map(d => [d.date, d.slots]));
}
async function refreshPro() {
  const [me, dash, jobs, boosts, invite] = await Promise.all([API.call('GET', '/api/pro/me'), API.call('GET', '/api/pro/dashboard'), API.call('GET', '/api/bookings?as=provider&scope=upcoming'), API.call('GET', '/api/pro/boosts'), API.call('GET', '/api/pro/invite')]);
  const L = S.pro.listing; const g = GEOFIT.toGrid(me.base.lat, me.base.lng);
  // niezapisanych zmian w ogłoszeniu i obszarze pracy nie nadpisujemy danymi z serwera
  if (!S.pro.dirty)   Object.assign(L, { name: me.name, tagline: me.tagline, services: me.services, rate: me.rate, minH: me.minH, base: { x: g.x, y: g.y, lat: me.base.lat, lng: me.base.lng }, radius: me.radiusKm, kmOn: me.kmRate > 0, kmRate: me.kmRate || 2, freeKm: me.freeKm || 0, baseLabel: me.baseLabel || '', supplies: me.supplies, eco: me.eco, pets: me.pets, invoice: me.invoice, bio: me.bio || '', idVerified: me.idStatus === 'verified', insured: me.insured, published: me.published });
  S.pro.online = me.online;
  S.pro.requests = dash.requests.map(mapRequest);
  S.pro.jobs = jobs.filter(b => b.status !== 'pending').map(mapJob);
  S.pro.week = dash.week.map((d, i) => ({ d: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'][i], v: d.zl }));
  const now = Date.now();
  S.pro.boost.quote = Object.assign(boosts.quote, { radius: me.radiusKm });
  if (!S.pro.areaQ) S.pro.areaQ = { key: `${me.base.lat},${me.base.lng},${me.radiusKm}`, demand: boosts.quote.demand };
  Object.assign(S.pro.boost, { credit: boosts.creditZl, history: boosts.ledger.slice().reverse().map(l => ({ t: l.reason, v: l.amountZl })),
    active: boosts.active.map(b => ({ id: b.id, area: b.area, days: b.days, left: Math.max(1, Math.ceil((new Date(b.endsAt + ':00') - now) / 864e5)), views: b.views, opens: b.opens, req: b.requests, goal: b.guaranteedViews })),
    invite: { link: `${location.host}${invite.path}`, joined: invite.joined, earned: invite.earnedZl } });
}
async function hydrate() {
  const me = await API.call('GET', '/api/me'); S.me = me;
  S.role = me.role === 'pro' ? 'pro' : 'client'; S.tab = S.role === 'pro' ? 'dash' : 'home'; S.stacks = {}; S.sheet = null;
  S.addresses = me.addresses.map(mapAddress);
  if (!S.addresses.length) S.addresses = [mapAddress({ id: '_default', label: 'Warszawa (dodaj swój adres)', street: 'Centrum', city: 'Warszawa', lat: 52.2297, lng: 21.0122 })];
  if (!S.addresses.some(a => a.id === S.addrId)) S.addrId = S.addresses[0].id;
  S.orders = []; S.threads = {}; S.notifs = []; S.pro.threads = {}; S.pro.requests = []; S.pro.jobs = []; S.favs = S.favs.filter(id => PROS.some(p => p.id === id));
  await refreshProviders();
  await Promise.all([refreshOrders(), refreshNotifs(), refreshThreads(), S.role === 'pro' ? refreshPro() : null]);
  S.introSeen = true; S.wiped = S.wiped || false; S.loggedIn = true;
}

// ---------- logowanie ----------
screens.login = () => {
  const L = S.login || (S.login = { step: 1, phone: '' });
  return `<div class="scroll"><div class="pad login">
    <div class="login-logo">lśni<span class="dot"></span></div>
    <h1 class="pagetitle">${L.step === 1 ? 'Zaloguj się numerem telefonu' : 'Wpisz kod z SMS-a'}</h1>
    <p class="muted small" style="margin:0 0 18px">${L.step === 1 ? 'Wyślemy Ci jednorazowy kod. Bez haseł.' : `Wysłaliśmy kod na ${esc(L.phone)}. Ważny 5 minut.`}</p>
    ${S.inviteFrom ? `<div class="note mint mb12">${ic('user-plus', 's')}<span>Zaproszenie od: <b>${esc(S.inviteFrom.name)}</b>. Po zalogowaniu od razu zarezerwujesz u niej termin.</span></div>` : ''}
    <form data-form="login" class="stack">
      ${L.step === 1 ? `<label class="lbl" for="lphone">Numer telefonu</label><input class="input" id="lphone" name="phone" inputmode="tel" autocomplete="tel" placeholder="500 100 200" value="${esc(L.phone)}">
        <label class="lbl" for="lname">Imię <span class="faint" style="font-weight:500">(tylko przy zakładaniu konta)</span></label><input class="input" id="lname" name="name" autocomplete="given-name" placeholder="np. Kasia" value="${esc(L.name || '')}">`
      : `<label class="lbl" for="lcode">Kod</label><input class="input otp" id="lcode" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(L.devCode || '')}">
        ${L.devCode ? `<div class="hint">Tryb deweloperski: serwer podał kod, więc wpisaliśmy go za Ciebie.</div>` : ''}`}
      <button class="btn primary block mt8" type="submit" ${S.login.busy ? 'disabled' : ''}>${L.step === 1 ? 'Wyślij kod' : 'Zaloguj'}</button>
      ${L.step === 2 ? `<button class="btn line block" type="button" data-act="loginBack">Zmień numer</button>` : ''}
      ${L.error ? `<div class="note yellow">${ic('triangle-alert', 's')}<span>${esc(L.error)}</span></div>` : ''}
    </form>
    <div class="card mt24 small"><b>Konta testowe</b><div class="muted mt8">Klientka: 500 100 200<br>Wykonawczyni: 500 100 300<br>Zespół Lśni: 500 100 999</div></div>
    <p class="tiny faint mt16">Logując się, akceptujesz <a href="/legal/regulamin" target="_blank" rel="noopener">regulamin</a> i <a href="/legal/prywatnosc" target="_blank" rel="noopener">politykę prywatności</a>.</p>
  </div></div>`;
};
async function loginSubmit(f) {
  const L = S.login; const vals = { phone: f.phone ? f.phone.value : '', name: f.name ? f.name.value.trim() : '', code: f.code ? f.code.value.trim() : '' };
  L.error = ''; L.busy = true; render();
  try {
    if (L.step === 1) {
      L.phone = vals.phone; L.name = vals.name; const r = await API.call('POST', '/api/auth/code', { phone: L.phone });
      L.step = 2; L.devCode = r.devCode || '';
    } else {
      const r = await API.call('POST', '/api/auth/verify', { phone: L.phone, code: vals.code, name: L.name || undefined, ref: S.inviteRef || undefined });
      API.setToken(r.token); S.login = null; await hydrate(); toast(r.created ? 'Konto utworzone. Witaj w Lśni!' : 'Zalogowano', 'check');
      if (S.inviteRef && S.inviteFrom) { mapProvider(S.inviteFrom); S.stacks[stackKey()] = [{ name: S.tab }, { name: 'invited', p: { id: S.inviteFrom.id } }]; }
      anim = 'fade'; render(); return;
    }
  } catch (e) { L.error = e.message; }
  L.busy = false; render();
  setTimeout(() => { const i = document.getElementById(L.step === 1 ? 'lphone' : 'lcode'); if (i) i.focus(); }, 30);
}

// ---------- akcje: w trybie online idą do API ----------
const DEMO = Object.assign({}, A);
const failToast = e => { toast(e.message || 'Coś poszło nie tak', 'triangle-alert'); };
const ON = {
  async loginBack() { S.login = { step: 1, phone: S.login.phone }; render(); },
  async logout() { try { await API.call('POST', '/api/auth/logout', {}); } catch (e) { } API.setToken(''); S.loggedIn = false; S.me = null; S.login = { step: 1, phone: '' }; render(); },
  async openPro(id) {
    const p = proById(id);
    try { mapProvider(await API.call('GET', `/api/providers/${encodeURIComponent(id)}?${pointQuery()}${p && p._promoted ? '&src=promo' : ''}`)); } catch (e) { return failToast(e); }
    DEMO.openPro(id);
  },
  async startBooking(id, preset) {
    try { await loadSlots(id); } catch (e) { return failToast(e); }
    DEMO.startBooking(id, preset);
    const b = S.booking; if (b && b.time && b.time.length === 4) b.time = '0' + b.time;
    if (b && b.time && slotTaken(b.pro, b.day, b.time)) b.time = null;
    if (b && curAddr().id) b.addr = curAddr().id;
  },
  async pay() {
    const sl = document.getElementById('slide-pay'); if (sl) { sl.classList.add('busy'); sl.querySelector('.slide-label').textContent = 'Wysyłamy rezerwację…'; }
    const b = S.booking; const ad = addrById(b.addr) || curAddr();
    const body = { provider: b.pro, service: b.service, m2: b.m2, rooms: b.rooms, baths: b.baths, extras: b.extras, freq: b.freq, date: ymd(addDays(b.day)), time: b.time, payMethod: b.pay,
      onsiteName: b.who === 'other' ? b.onName : '', onsitePhone: b.who === 'other' ? b.onPhone : '', entry: b.entry, doorCode: b.code, pets: b.pets, note: b.note };
    if (ad.id && !ad.id.startsWith('_')) body.addressId = ad.id; else Object.assign(body, { lat: ad.lat, lng: ad.lng, street: ad.street });
    try {
      const o = mapOrder(await API.call('POST', '/api/bookings', body)); S.orders.push(o); S.booking = null;
      S.stacks[stackKey()] = [{ name: S.tab }, { name: 'booked', p: { id: o.id } }]; anim = 'enter'; render();
    } catch (e) { failToast(e); if (e.code === 'slot_taken') { await loadSlots(b.pro); b.time = null; b.step = 2; } render(); }
  },
  async cancelOrder(id) { try { mapOrder(await API.call('POST', `/api/bookings/${id}/cancel`, { reason: 'Odwołane w aplikacji' })); S.sheet = null; stack().pop(); toast('Wizyta odwołana. Wykonawca dostał powiadomienie', 'undo-2'); anim = 'fade'; render(); } catch (e) { failToast(e); } },
  async openResched(id) { const o = S.orders.find(x => x.id === id); try { await loadSlots(o.pro); } catch (e) { return failToast(e); } DEMO.openResched(id); },
  async doResched(id) {
    const R = S.resched;
    try { mapOrder(await API.call('POST', `/api/bookings/${id}/reschedule`, { date: ymd(addDays(R.day)), time: R.time })); S.sheet = null; toast('Prośba o zmianę wysłana do wykonawcy', 'calendar-clock'); render(); } catch (e) { failToast(e); }
  },
  async skipVisit(id) { try { const o = mapOrder(await API.call('POST', `/api/bookings/${id}/skip`, {})); S.sheet = null; toast(`Pominięto. Następna wizyta: ${dayLabel(addDays(o.date))}, ${o.time}`, 'calendar-x'); render(); } catch (e) { failToast(e); } },
  async sendProblem(id) {
    const P = S.problem;
    try { await API.call('POST', '/api/reports', { bookingId: id, category: P.cat, description: P.desc, want: P.want, photos: P.photos }); await refreshOrders(); back(); toast('Zgłoszenie wysłane do wykonawcy', 'flag'); } catch (e) { failToast(e); }
  },
  async resolveIssue(id) {
    const o = S.orders.find(x => x.id === id); const b = await API.call('GET', `/api/bookings/${id}`).catch(failToast); if (!b || !b.report) return;
    try { await API.call('POST', `/api/reports/${b.report.id}/resolve`, {}); await refreshOrders(); toast('Dziękujemy, zgłoszenie zamknięte', 'check'); render(); } catch (e) { failToast(e); }
  },
  async submitRate(id) {
    const r = S.rate;
    try { const res = await API.call('POST', '/api/reviews', { bookingId: id, stars: r.stars, tags: r.tags, body: r.comment }); const o = S.orders.find(x => x.id === id); if (o) o.rated = r.stars; S.stacks[stackKey()] = stack().slice(0, 1); S.ordersSeg = 'past'; toast(res.message, 'heart-handshake'); anim = 'fade'; render(); } catch (e) { failToast(e); }
  },
  async openChat(id) { if (S.role !== 'client') return; try { await loadThread(id, false); } catch (e) { return failToast(e); } go('chat', { id }); },
  async readAll() { try { await API.call('POST', '/api/notifications/read', { all: true }); } catch (e) { } S.notifs.forEach(n => { n.read = true; }); render(); },
  async openNotif(id) { API.call('POST', '/api/notifications/read', { ids: [id] }).catch(() => { }); DEMO.openNotif(id); },
  async notifPref(k) { try { const me = await API.call('PATCH', '/api/me', { prefs: { [k]: !S.notifPrefs[k] } }); S.notifPrefs = me.prefs; render(); } catch (e) { failToast(e); } },
  async pickAddr(id) { S.addrId = id; try { await refreshProviders(); } catch (e) { failToast(e); } const ad = curAddr(); toast(`Szukamy dla: ${ad.label}, ${placeOf(ad)}`, 'map-pin'); afterAddrChange(id); },
  async saveAddr() {
    const v = S.maps.loc; if (!v && !S.locReal) return; const real = S.mbx && S.locReal ? S.locReal : GEOFIT.toReal(v.x, v.y);
    try {
      const a = await API.call('POST', '/api/addresses', { label: S.newAddrLabel || 'Adres', lat: real.lat, lng: real.lng, note: S.newAddrNote || '', street: S.mbx && S.locRev && S.locRev.street ? S.locRev.street : undefined, city: S.locRev && S.locRev.city ? S.locRev.city : undefined });
      S.addresses = S.addresses.filter(x => !x.id.startsWith('_')).concat(mapAddress(a)); S.addrId = a.id; await refreshProviders();
      toast(`Zapisano: ${a.street}, ${a.city}`, 'map-pin-plus'); afterAddrChange(a.id);
    } catch (e) { failToast(e); }
  },
  async joinWaitlist(key) {
    let pt; if (key.startsWith('addr-')) pt = curAddr(); else if (S.mbx && S.locReal) pt = S.locReal; else { const v = S.maps.loc; pt = GEOFIT.toReal(v.x, v.y); }
    try { await API.call('POST', '/api/waitlist', { lat: pt.lat, lng: pt.lng }); DEMO.joinWaitlist(key); } catch (e) { failToast(e); }
  },
  async acceptReq(id) { try { await API.call('POST', `/api/bookings/${id}/accept`, {}); await refreshPro(); toast('Przyjęte. Dodano do grafiku', 'calendar-check'); render(); } catch (e) { failToast(e); } },
  async declineReq(id) { try { await API.call('POST', `/api/bookings/${id}/decline`, { reason: 'Odrzucone w aplikacji' }); S.sheet = null; await refreshPro(); toast('Zapytanie odrzucone', 'x'); render(); } catch (e) { failToast(e); } },
  async buyBoost() {
    const D = S.pro.boost.draft;
    try { await API.call('POST', '/api/pro/boosts', { days: D.days }); await refreshPro(); toast(`Wyróżnienie aktywne w całym zasięgu (${S.pro.listing.radius} km)`, 'rocket'); back(); }
    catch (e) { failToast(e.code === 'payment_required' ? { message: `Brakuje ${zl(e.data.missingZl)} kredytu. Zaproś klientów albo wybierz krótszy czas.` } : e); render(); }
  },
  async reportNoShow(i) {
    const j = S.pro.jobs[Number(i)];
    try { await API.call('POST', `/api/bookings/${j.id}/noshow`, { distanceM: 40 }); j.noshow = true; S.sheet = null; toast('Zgłoszenie zapisane. Klient dostał powiadomienie', 'door-closed'); render(); } catch (e) { S.sheet = null; failToast(e); render(); }
  },
  async openPChat(id, name) { if (!id) return toast('Ten klient nie ma jeszcze rozmowy', 'info'); try { await loadThread(id, true); } catch (e) { return failToast(e); } go('pchat', { id }); },
  async toggleOnline() { try { const me = await API.call('POST', '/api/pro/online', { online: !S.pro.online }); S.pro.online = me.online; toast(me.online ? 'Znów przyjmujesz zlecenia' : 'Nie pokazujemy Cię w wynikach do odwołania', me.online ? 'zap' : 'moon'); render(); } catch (e) { failToast(e); } },
  async publish() {
    const L = S.pro.listing; const real = L.base.lat != null ? { lat: L.base.lat, lng: L.base.lng } : GEOFIT.toReal(L.base.x, L.base.y);
    try { await API.call('POST', '/api/pro/profile', { displayName: L.name, tagline: L.tagline, bio: L.bio, services: L.services, rate: L.rate, minHours: L.minH, baseLat: real.lat, baseLng: real.lng, radiusKm: L.radius, kmRate: L.kmOn ? L.kmRate : 0, freeKm: L.freeKm || 0, baseLabel: L.baseLabel || undefined, supplies: L.supplies, eco: L.eco, pets: L.pets, invoice: L.invoice }); S.pro.dirty = false; await refreshPro(); toast('Ogłoszenie zapisane i widoczne dla klientów', 'megaphone'); render(); }
    catch (e) { failToast(e); }
  },
  async saveArea() { await ON.publish(); back(); },
  async openArea() { DEMO.openArea(); baseChanged(); },
  async openBoost() { DEMO.openBoost(); baseChanged(); },
  async uploadOC() { toast('Wgraj polisę jako PDF lub zdjęcie w pełnej wersji aplikacji (endpoint /api/pro/verification jest gotowy)', 'info'); }
};
Object.keys(ON).forEach(k => { A[k] = function (...args) { return S.online ? ON[k].apply(this, args) : (DEMO[k] ? DEMO[k].apply(this, args) : undefined); }; });
// Czat i wolne terminy też przełączamy na API.
const demoSendMsg = sendMsg, demoSendPMsg = sendPMsg, demoSlotTaken = slotTaken, demoUpdateGeo = updateGeo;
sendMsg = function (id, text) {
  if (!S.online) return demoSendMsg(id, text); if (!text.trim()) return;
  const t = S.threads[id] || (S.threads[id] = { msgs: [], unread: 0, loaded: true }); t.msgs.push({ me: true, t: text.trim(), at: nowTime() }); render(); scrollChat();
  API.call('POST', `/api/threads/${encodeURIComponent(id)}/messages`, { body: text.trim() }).then(() => { [3500, 7000].forEach(ms => setTimeout(() => { if (top().name === 'chat' && top().p.id === id) loadThread(id, false).then(() => { render(); scrollChat(); }).catch(() => { }); }, ms)); }).catch(failToast);
};
sendPMsg = function (id, text) {
  if (!S.online) return demoSendPMsg(id, text); if (!text.trim()) return;
  const t = S.pro.threads[id]; t.msgs.push({ me: true, t: text.trim(), at: nowTime() }); render(); scrollChat();
  API.call('POST', `/api/threads/${encodeURIComponent(id)}/messages`, { body: text.trim() }).catch(failToast);
};
slotTaken = function (proId, dayIdx, slot) {
  if (S.online && SLOTCACHE[proId]) return !(SLOTCACHE[proId][ymd(addDays(dayIdx))] || []).includes(slot);
  return demoSlotTaken(proId, dayIdx, slot);
};
updateGeo = function () { if (!S.online) demoUpdateGeo(); };

// Odświeżanie co kilka sekund: powiadomienia, rezerwacje, rozmowy. Renderujemy tylko, gdy coś się zmieniło.
let lastSnap = '';
async function poll() {
  if (!S.online || !S.loggedIn || document.visibilityState === 'hidden') return;
  try {
    await Promise.all([refreshNotifs(), refreshThreads(), S.role === 'pro' ? refreshPro() : refreshOrders()]);
    const t = top();
    if (t.name === 'chat') await loadThread(t.p.id, false); if (t.name === 'pchat') await loadThread(t.p.id, true);
    const snap = JSON.stringify([S.notifs, S.orders.map(o => [o.id, o.status, o.date, o.time, o.issue && o.issue.status, o.rated]), S.pro.requests, S.pro.jobs, t.name === 'chat' ? S.threads[t.p.id] : 0, t.name === 'pchat' ? S.pro.threads[t.p.id] : 0]);
    if (snap !== lastSnap) { const first = !lastSnap; lastSnap = snap; if (!first && !S.sheet && !document.activeElement.matches('input,textarea')) { render(); if (t.name === 'chat' || t.name === 'pchat') scrollChat(); } }
  } catch (e) { if (e.status === 401) { S.loggedIn = false; render(); } }
}

async function bootOnline() {
  if (!API) return false;
  const ok = await API.detect(); if (!ok) return false;
  S.online = true; S.loggedIn = false; S.introSeen = true; PROS.length = 0;
  await loadMapbox().catch(() => false);
  const ref = new URLSearchParams(location.search).get('invite');
  if (ref) { S.inviteRef = ref; try { const inv = await API.call('GET', `/api/invite/${encodeURIComponent(ref)}`); S.inviteFrom = inv.provider; } catch (e) { S.inviteRef = null; } }
  if (API.token) { try { await hydrate(); } catch (e) { S.loggedIn = false; } }
  setInterval(poll, 6000);
  return true;
}

/* ================= boot ================= */
PROS.forEach(p => { if (!p._api) p.area = placeNear(p); }); // nazwa miejsca bazy wykonawców demo
const theme = store.get('theme', null);
if (theme) { document.documentElement.setAttribute('data-theme', theme); const tb = document.getElementById('themeBtn'); if (tb) tb.textContent = 'Motyw: ' + (theme === 'light' ? 'jasny' : 'ciemny'); }
const clock = document.getElementById('clock'); const tick = () => { if (clock) clock.textContent = nowTime(); }; tick(); setInterval(tick, 30000);
if (!S.tab || !TABS[S.role].some(t => t.id === S.tab)) S.tab = S.role === 'pro' ? 'dash' : 'home';
icons(document.querySelector('.pitch'));
icons(document.querySelector('.sbar'));
// Najpierw sprawdzamy, czy działa serwer; do tego czasu ekran aplikacji jest ukryty, żeby nie mignęło demo.
$app.style.visibility = 'hidden';
bootOnline().catch(() => false).then(on => { if (on) { document.body.classList.add('online'); const pb = document.querySelector('.pitch p'); if (pb) pb.textContent = 'Tryb online: aplikacja działa na serwerze Lśni. Zaloguj się kodem SMS (konta testowe są na ekranie logowania).'; } $app.style.visibility = ''; render(); });
})();
