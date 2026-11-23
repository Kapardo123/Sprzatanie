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
const SERVICE_FEE = 4.99;
const DISTRICTS = ['Mokotów', 'Ursynów', 'Wilanów', 'Śródmieście', 'Wola', 'Ochota', 'Żoliborz', 'Bielany', 'Praga-Płd.', 'Praga-Płn.', 'Bemowo', 'Targówek'];

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
  const total = work - discount + SERVICE_FEE + ownSupplies;
  return { h, baseH: Math.max(0, h - extraH), extraH, work, disc, discount, total };
}

function seed() {
  return {
    role: 'client', tab: 'home', stacks: {},
    favs: ['marta', 'olena'],
    filters: { cat: null, q: '', maxPrice: 100, minRating: 0, verified: false, insured: false, supplies: false, eco: false, pets: false, invoice: false, today: false, sort: 'rec' },
    ordersSeg: 'up',
    orders: [
      { id: 'o1', pro: 'marta', service: 'dom', date: 1, time: '10:00', h: 3.5, m2: 54, total: 138.88, freq: 'biweek', status: 'confirmed', extras: ['lodowka'], addr: 'ul. Puławska 112/14', pay: 'BLIK' },
      { id: 'o2', pro: 'czysto', service: 'remont', date: -20, time: '08:00', h: 5, m2: 54, total: 299.99, freq: 'once', status: 'done', rated: false, extras: ['szafki'], addr: 'ul. Puławska 112/14', pay: 'Karta' },
      { id: 'o3', pro: 'olena', service: 'prasowanie', date: -34, time: '16:00', h: 2, m2: 0, total: 88.99, freq: 'once', status: 'done', rated: 5, extras: [], addr: 'ul. Puławska 112/14', pay: 'BLIK' }
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
        { id: 'r1', client: 'Tomasz', crating: 4.9, service: 'dom', m2: 54, rooms: 2, baths: 1, day: 2, time: '10:00', h: 3.5, pay: 157.5, dist: 1.8, area: 'Mokotów, Stary Mokotów', note: 'Mam psa, jest przyjazny. Najważniejsza kuchnia i łazienka.', freq: 'biweek', expires: 42 },
        { id: 'r2', client: 'Joanna', crating: 5.0, service: 'najem', m2: 38, rooms: 1, baths: 1, day: 1, time: '12:00', h: 2.5, pay: 112.5, dist: 3.1, area: 'Śródmieście, Powiśle', note: 'Między gośćmi: pościel w szafie, raport zdjęciowy po sprzątaniu.', freq: 'week', expires: 18 },
        { id: 'r3', client: 'Firma Kwadrat', crating: 4.7, service: 'biuro', m2: 120, rooms: 4, baths: 2, day: 4, time: '18:00', h: 5, pay: 225, dist: 5.6, area: 'Wola, Rondo Daszyńskiego', note: 'Po godzinach pracy. Potrzebna faktura.', freq: 'week', expires: 95 }
      ],
      jobs: [
        { day: 0, time: '14:00', end: '17:00', client: 'Ewa M.', service: 'dom', area: 'Ursynów', pay: 135, tone: '' },
        { day: 1, time: '09:00', end: '12:00', client: 'Krzysztof', service: 'generalne', area: 'Mokotów', pay: 202.5, tone: 'y' },
        { day: 3, time: '10:00', end: '13:30', client: 'Ania K.', service: 'dom', area: 'Wilanów', pay: 157.5, tone: 'm' }
      ],
      market: [
        { id: 'm1', client: 'Paulina', crating: 4.8, cat: 'remont', desc: 'Mieszkanie po malowaniu i wymianie paneli. Dużo pyłu, również w szafkach kuchennych. 2 pokoje, kuchnia, łazienka.', m2: 48, when: 'w tym tygodniu, elastycznie', dist: 2.4, area: 'Mokotów, Wierzbno', offers: 4, budget: 400, photos: 3, sent: 0 },
        { id: 'm2', client: 'Marek', crating: 5.0, cat: 'okna', desc: '8 okien dwuskrzydłowych i drzwi balkonowe. 3 piętro, bez windy. Rolety do umycia.', m2: 0, when: 'sobota, od 9:00', dist: 4.1, area: 'Ochota, Szczęśliwice', offers: 2, budget: 0, photos: 1, sent: 0 }
      ],
      offerDraft: null,
      avail: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false },
      calDay: 0,
      listing: {
        name: 'Ola Zielińska', tagline: 'Dokładne sprzątanie mieszkań, ekologiczne środki',
        services: ['dom', 'generalne'], rate: 45, minH: 3, areas: ['Mokotów', 'Ursynów', 'Wilanów'],
        supplies: true, eco: true, pets: true, invoice: false, langs: ['PL', 'EN'],
        bio: 'Sprzątam od 3 lat. Pracuję według checklisty pokój po pokoju, przynoszę własne środki.', photos: [],
        idVerified: true, insured: false, published: true
      }
    }
  };
}

let S = Object.assign(seed(), store.get('state', {}));
// zawsze zaczynaj od świeżych stosów nawigacji
S.stacks = {}; S.sheet = null;
// stan zapisany przez starszą wersję makiety może nie mieć nowych pól
(() => { const d = seed(); S.posts ||= []; S.pro = Object.assign(d.pro, S.pro); S.pro.market ||= d.pro.market; S.offerSort ||= 'rec'; })();
const persist = () => {
  const { sheet, stacks, booking, ...rest } = S;
  store.set('state', rest);
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
function go(name, p = {}) { stack().push({ name, p }); anim = 'enter'; S.sheet = null; render(); }
function back() { if (stack().length > 1) { stack().pop(); anim = 'fade'; render(); } }
function setTab(t) { if (S.tab === t) { S.stacks[stackKey()] = [{ name: t }]; } S.tab = t; anim = 'fade'; render(); }
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
    ${avatar(p)}
    <div class="grow">
      <div class="row between" style="gap:8px;align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:5px"><span class="name">${esc(p.name)}</span>${p.verified ? ic('badge-check', 'verified') : ''}</div>
          <div class="tiny faint">${stars(p.rating)} <span>(${p.reviews})</span> · ${p.area}${p.dist ? ' · ' + String(p.dist).replace('.', ',') + ' km' : ''}</div>
        </div>
        ${heart(p.id)}
      </div>
      <div class="small muted mt8" style="line-height:1.35">${esc(p.tagline)}</div>
      <div class="meta">${feats.slice(0, 3).join('')}</div>
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

/* panorama za szybą: dachy Warszawy z Pałacem Kultury */
function skyline() {
  const b = [[0, 22, 28], [24, 16, 40], [42, 26, 22], [88, 20, 34], [112, 30, 24], [146, 18, 46], [250, 22, 36], [274, 16, 54], [292, 28, 26]];
  return `<svg class="sky" viewBox="0 0 320 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="268" cy="34" r="16" fill="var(--glove)"/>
    <path d="M30 40q10-8 22 0q8-6 16 2" fill="none" stroke="var(--surface)" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    <g fill="var(--ink)" opacity=".88" transform="translate(0 30)">${b.map(([x, w, h]) => `<rect x="${x}" y="${90 - h}" width="${w}" height="${h}"/>`).join('')}
      <path d="M70 90V40l14-8v58z"/><path d="M180 90V66h8V54h7V42h5V30h4V20h3v-8h2.2V0h1.6v12H213v8h3v10h4v12h5v12h7v12h8v24z"/></g></svg>`;
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

/* ilustrowana mapa okolicy (bez zewnętrznych map) */
const PIN_XY = { marta: [47, 55], olena: [64, 70], czysto: [20, 26], pawel: [30, 9], babel: [86, 44], agnieszka: [54, 30] };
function mapSVG() {
  return `<svg class="mapsvg" viewBox="0 0 360 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="360" height="420" fill="var(--surface-2)"/>
    <path d="M20 150q30-40 90-20q30 20 10 60q-40 30-90 10q-30-20-10-50z" fill="var(--mint-soft)"/>
    <path d="M210 250q30-20 50 10q10 30-20 40q-40 0-30-50z" fill="var(--mint-soft)"/>
    <path d="M300 -10q-30 80 10 150q50 80 10 160q-20 60 20 140h40V-10z" fill="var(--cloth-soft)"/>
    <g stroke="var(--surface)" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M0 70h300M0 200h290M0 330h300M60 0v420M150 0v420M240 0v420M0 270q100-30 200 10"/></g>
    <path d="M120 -10L210 430" stroke="var(--surface)" stroke-width="13" stroke-linecap="round"/>
    <text x="0" y="0" transform="translate(186 352) rotate(77)" font-size="10" font-weight="700" fill="var(--ink-3)" letter-spacing="2">PUŁAWSKA</text>
    <g font-size="10" font-weight="700" letter-spacing="3" fill="var(--ink-3)" opacity=".8"><text x="72" y="244">MOKOTÓW</text><text x="20" y="44">OCHOTA</text><text x="170" y="40">ŚRÓDMIEŚCIE</text><text x="318" y="210" transform="rotate(90 318 210)">WISŁA</text></g>
    <text x="44" y="166" font-size="9" fill="var(--mint)" font-weight="600">Pole Mokotowskie</text><text x="214" y="276" font-size="9" fill="var(--mint)" font-weight="600">Morskie Oko</text>
  </svg>`;
}
const swipeBtn = (act, arg, label, off) => `<div class="slide ${off ? 'off' : ''}" data-done="${act}" data-a="${arg || ''}" id="slide-${act}">
  <div class="slide-fill"></div><span class="slide-label">${label}</span>
  <button class="slide-knob" type="button" aria-label="${label}">${illo('okna', 'knob-illo')}</button></div>`;

/* ================= CLIENT SCREENS ================= */
const screens = {};

screens.home = () => {
  const next = S.orders.filter(o => o.date >= 0 && !['done', 'cancel'].includes(o.status)).sort((a, b) => a.date - b.date)[0];
  const quick = PROS.filter(p => p.todayFree).sort((a, b) => a.dist - b.dist)[0];
  const qEst = estimate({ service: 'dom', m2: 54, rooms: 2, baths: 1, extras: [], freq: 'once' }, quick);
  const featured = PROS.filter(p => p.super || p.rating > 4.9);
  return `<div class="scroll">
    <div class="hello">
      <button class="loc" data-act="toast" data-a="Zmiana adresu w pełnej wersji">${ic('map-pin', 's')}ul. Puławska 112, Mokotów ${ic('chevron-down', 'xs')}</button>
      <button class="iconbtn" data-act="toast" data-a="Brak nowych powiadomień" aria-label="Powiadomienia">${ic('bell', 's')}</button>
    </div>
    <div class="pad">
      <h1 class="hero-h">Kto dziś u&nbsp;Ciebie posprząta?</h1>
      <form class="searchbox" data-form="search">
        ${ic('search', 's faint')}
        <input id="homeSearch" name="q" placeholder="np. mycie okien, po remoncie, Olena" autocomplete="off">
        <button class="go" type="submit" aria-label="Szukaj">${ic('arrow-right', 's')}</button>
      </form>
      <div class="cats">
        ${CATS.map(c => `<button class="cat" data-act="openCat" data-a="${c.id}"><span class="tile ${c.tone}">${illo(c.id)}</span>${c.short}</button>`).join('')}
      </div>
      <div class="glass ${S.wiped ? 'clean' : ''}" id="glass">
        <div class="behind">${skyline()}
          <div class="coupon"><span class="eyebrow">Szyba czysta</span><b>−20% na mycie okien</b>
            <button class="code" data-act="copyCode">SZYBA20 ${ic('copy', 'xs')}</button></div></div>
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

      <div class="section-h"><h3>Wolne jeszcze dziś</h3></div>
      <div class="quick">
        <span class="quick-illo">${illo(quick.services[0])}</span>
        <div class="eyebrow" style="color:inherit;opacity:.75">${quick.area} · ${String(quick.dist).replace('.', ',')} km od Ciebie</div>
        <h4>${quick.name.split(' ')[0]} może przyjechać ${quick.nextSlot.toLowerCase()}</h4>
        <div class="small" style="opacity:.85">Mieszkanie 54 m² · ok. ${hrs(qEst.h)} · ${zl(qEst.work)}</div>
        <button class="btn sm" data-act="startBooking" data-a="${quick.id}" data-b="today">Zarezerwuj ten termin ${ic('arrow-right', 's')}</button>
      </div>

      <div class="section-h"><h3>Polecani w okolicy</h3><button data-act="openSearch">Wszyscy</button></div>
    </div>
    <div class="pad"><div class="hscroll">
      ${featured.map(p => `<div class="feat" role="button" tabindex="0" data-act="openPro" data-a="${p.id}">
        <div class="cover ${p.tone}"><span class="cover-illo">${illo(p.services[0])}</span>${avatar(p)}<span class="heart">${heart(p.id)}</span></div>
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
        <div>${ic('lock', 's')}<b>Płacisz po</b>Kwota jest blokowana, pobieramy ją po usłudze</div>
        <div>${ic('rotate-ccw', 's')}<b>Poprawka</b>Coś nie tak? Wykonawca wraca w 24 h za darmo</div>
      </div>
      <div class="sp"></div>
    </div>
  </div>`;
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
    return true;
  });
  const sorters = { rec: (a, b) => (b.rating * Math.log(b.reviews)) - (a.rating * Math.log(a.reviews)), price: (a, b) => a.rate - b.rate, dist: (a, b) => a.dist - b.dist, rating: (a, b) => b.rating - a.rating };
  return list.sort(sorters[f.sort]);
}
function activeFilterCount() {
  const f = S.filters; let n = 0;
  if (f.maxPrice < 100) n++; if (f.minRating) n++;
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
        <button class="chip ${f.today ? 'on' : ''}" data-act="toggleF" data-a="today">${ic('zap', 'xs')}Wolne dziś</button>
        <button class="chip ${f.supplies ? 'on' : ''}" data-act="toggleF" data-a="supplies">Własne środki</button>
        <button class="chip ${f.invoice ? 'on' : ''}" data-act="toggleF" data-a="invoice">Faktura VAT</button>
        <button class="chip ${f.pets ? 'on' : ''}" data-act="toggleF" data-a="pets">Zwierzęta OK</button>
        <button class="chip ${f.eco ? 'on' : ''}" data-act="toggleF" data-a="eco">Eco</button>
      </div>
      <div class="resultbar"><span>${list.length} ${list.length === 1 ? 'wykonawca' : list.length < 5 && list.length > 1 ? 'wykonawców' : 'wykonawców'} · Mokotów i okolice</span>
        <label class="row" style="gap:4px">Sortuj:<select id="sort" data-model="filters.sort" data-rr="1">
          ${[['rec', 'polecane'], ['price', 'cena'], ['dist', 'odległość'], ['rating', 'ocena']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label></div>
      <div class="seg mb12"><button class="${S.searchView !== 'map' ? 'on' : ''}" data-act="searchView" data-a="list">${ic('list', 's')} Lista</button><button class="${S.searchView === 'map' ? 'on' : ''}" data-act="searchView" data-a="map">${ic('map', 's')} Mapa</button></div>
      ${S.searchView === 'map' ? mapView(list) : `<div class="stack">${list.length ? list.map(proCard).join('') : `<div class="empty">${ic('search-x')}<div style="font-weight:650;color:var(--ink)">Nikt nie pasuje do filtrów</div><div class="small mt8">Poluzuj limit ceny albo wyłącz część filtrów.</div><button class="btn sm line mt16" data-act="clearFilters">Wyczyść filtry</button></div>`}</div>`}
      <div class="sp"></div>
    </div></div>`;
};

screens.provider = ({ id }) => {
  const p = proById(id);
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(i); const free = SLOTS.filter(s => !slotTaken(p.id, i, s)).length; return { d, free }; });
  const included = ['Odkurzanie i mycie podłóg', 'Kurze na dostępnych powierzchniach', 'Łazienka: wanna, prysznic, WC, lustra', 'Kuchnia: blaty, zlew, front szafek', 'Wyniesienie śmieci', 'Ścielenie łóżek'];
  const svcPrices = p.services.map(s => {
    const c = catById(s);
    if (p.fixed) return [c.name, 'od ' + zl(p.rate)];
    if (s === 'okna' && p.perWindow) return [c.name, `${p.perWindow} zł / okno`];
    const mul = s === 'generalne' ? 1.2 : s === 'remont' ? 1.3 : 1;
    return [c.name, `${Math.round(p.rate * mul)} zł / h`];
  });
  return `<div class="scroll">
    <div class="phead">
      <div class="pcover ${p.tone}"><span class="cover-illo">${illo(p.services[0])}</span><div class="topbtns">${backBtn()}<div class="r"><button class="iconbtn" data-act="share" aria-label="Udostępnij">${ic('share', 's')}</button>${heart(p.id).replace('heartbtn', 'heartbtn iconbtn')}</div></div></div>
      ${avatar(p, 'lg')}
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
      <div class="section-h"><h3>Przed i po</h3><span class="tiny faint">${p.area}, ${p.reviewsList[0].when}</span></div>
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
  const sel = list.find(p => p.id === S.mapSel) || list[0];
  return `<div class="map">${mapSVG()}
    <span class="me-pin" style="left:50%;top:58%"><i></i></span>
    ${list.map((p, i) => { const [x, y] = PIN_XY[p.id]; return `<button class="pin ${sel && sel.id === p.id ? 'on' : ''}" style="left:${x}%;top:${y}%;animation-delay:${i * 70}ms" data-act="mapSel" data-a="${p.id}" aria-label="${esc(p.name)}"><span class="avatar ${p.tone}">${esc(p.ini)}</span><b>${p.fixed || p.perWindow ? 'od ' + (p.perWindow || p.rate) : p.rate} zł</b></button>`; }).join('')}
  </div>
  ${sel ? `<div class="mt12">${proCard(sel)}</div>` : '<div class="empty">Nikt nie pasuje do filtrów</div>'}`;
}

/* ---------- booking ---------- */
function newBooking(proId, preset) {
  const p = proById(proId);
  const svc = S.filters.cat && p.services.includes(S.filters.cat) ? S.filters.cat : p.services[0];
  let day = 1, time = null;
  if (preset === 'today') { day = 0; time = p.nextSlot.split(' ')[1]; }
  return { pro: proId, step: 1, service: svc, m2: 54, rooms: 2, baths: 1, extras: [], supplies: p.supplies ? 'pro' : 'mine', freq: 'once', day, time, addr: 'home', entry: 'home', code: '', pets: 'none', note: '', focus: [], pay: 'blik', blik: '' };
}
const STEP_TITLES = ['Zakres sprzątania', 'Termin', 'Adres i wejście', 'Płatność'];

screens.book = () => {
  const b = S.booking; const p = proById(b.pro); const e = estimate(b, p);
  const body = [null, bookStep1, bookStep2, bookStep3, bookStep4][b.step](b, p, e);
  const canNext = b.step !== 2 || b.time;
  const blikOk = b.step !== 4 || b.pay !== 'blik' || /^\d{6}$/.test(b.blik);
  return `<div class="topbar">${b.step === 1 ? backBtn() : `<button class="iconbtn" data-act="bookPrev" aria-label="Wstecz">${ic('chevron-left')}</button>`}
      <h2>${STEP_TITLES[b.step - 1]}</h2><span class="tiny faint">${b.step} z 4</span></div>
    <div class="steps">${[1, 2, 3, 4].map(i => `<i class="${i <= b.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="scroll"><div class="pad">${body}<div class="sp"></div></div></div>
    <div class="footer" ${b.step === 4 ? 'hidden' : ''}>
      <div class="sum"><b class="num" id="estTotal">${zl(b.step === 4 ? e.total : e.work - e.discount)}</b><span id="estSub">ok. ${hrs(e.h)} · ${p.name.split(' ')[0]}${e.disc ? ' · −' + Math.round(e.disc * 100) + '%' : ''}</span></div>
      ${b.step < 4 ? `<button class="btn primary" data-act="bookNext" ${canNext ? '' : 'disabled'}>${b.step === 2 && !b.time ? 'Wybierz godzinę' : 'Dalej'}</button>`
      : ''}
    </div>
    ${b.step === 4 ? `<div class="footer slidefoot">${swipeBtn('pay', '', `Przesuń, aby zapłacić ${zl(e.total)}`, !blikOk)}</div>` : ''}`;
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
      <button class="opt ${b.addr === 'home' ? 'on' : ''}" data-act="bset" data-a="addr" data-b="home"><span class="radio"></span><div class="grow"><b class="small">Dom</b><div class="tiny faint">ul. Puławska 112/14, Mokotów · 4 piętro, winda</div></div></button>
      <button class="opt ${b.addr === 'mama' ? 'on' : ''}" data-act="bset" data-a="addr" data-b="mama"><span class="radio"></span><div class="grow"><b class="small">Mieszkanie mamy</b><div class="tiny faint">ul. Odyńca 27/3, Mokotów · parter</div></div></button>
      <button class="opt" data-act="toast" data-a="Dodawanie adresu w pełnej wersji">${ic('plus', 's')}<b class="small">Dodaj nowy adres</b></button>
    </div></div>
  <div class="field"><span class="lbl">Jak wykonawca wejdzie?</span>
    <div class="chips">${[['home', 'Będę w domu'], ['concierge', 'Klucz u portiera'], ['lockbox', 'Skrytka na klucz']].map(([v, l]) => `<button class="chip ${b.entry === v ? 'on' : ''}" data-act="bset" data-a="entry" data-b="${v}">${l}</button>`).join('')}</div>
    <div class="two mt12"><input class="input" id="code" placeholder="Kod domofonu" value="${esc(b.code)}" data-model="booking.code"><input class="input" placeholder="Nr mieszkania" value="14"></div>
    <div class="hint">${ic('lock', 'xs')} Kod zobaczy tylko ${p.name.split(' ')[0]}, 2 godziny przed wizytą.</div></div>
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
    <div class="ln"><span>Opłata serwisowa i ubezpieczenie</span><b>${zl(SERVICE_FEE)}</b></div>
    <div class="tot"><span class="muted small">Razem${b.freq !== 'once' ? ' za wizytę' : ''}</span><b class="num">${zl(e.total)}</b></div>
  </div>
  <div class="field"><span class="lbl">Metoda płatności</span>
    <div class="options">
      <button class="opt ${b.pay === 'blik' ? 'on' : ''}" data-act="bset" data-a="pay" data-b="blik"><span class="radio"></span><span class="paylogo blik">BLIK</span><b class="small grow">Kod BLIK</b></button>
      <button class="opt ${b.pay === 'card' ? 'on' : ''}" data-act="bset" data-a="pay" data-b="card"><span class="radio"></span><span class="paylogo card">VISA</span><div class="grow"><b class="small">Karta •••• 4242</b><div class="tiny faint">wygasa 08/28</div></div></button>
      <button class="opt ${b.pay === 'invoice' ? 'on' : ''}" data-act="bset" data-a="pay" data-b="invoice" ${p.invoice ? '' : 'disabled style="opacity:.45"'}><span class="radio"></span><span class="paylogo inv">FV</span><div class="grow"><b class="small">Przelew na fakturę</b><div class="tiny faint">${p.invoice ? '14 dni, dla firm' : 'Ten wykonawca nie wystawia faktur'}</div></div></button>
    </div>
    ${b.pay === 'blik' ? `<div class="blik"><input id="blik" inputmode="numeric" maxlength="6" placeholder="••••••" value="${esc(b.blik)}" data-model="booking.blik" data-live="blik" aria-label="Kod BLIK"></div><div class="hint">Wpisz dowolne 6 cyfr. To makieta, nic nie zostanie pobrane.</div>` : ''}
  </div>
  <div class="note mint mt16">${ic('lock', 's')}<span>Zablokujemy <b>${zl(e.total)}</b> na Twoim koncie. Pieniądze trafią do wykonawcy dopiero, gdy potwierdzisz wykonanie usługi. Bezpłatne odwołanie do 24 h przed.</span></div>`;
}

screens.booked = ({ id }) => {
  const o = S.orders.find(x => x.id === id); const p = proById(o.pro); const d = addDays(o.date);
  return `<div class="scroll"><div class="done">
    <div class="ring">${ic('check')}</div>
    <h1>${o.fromOffer ? 'Termin potwierdzony' : 'Rezerwacja wysłana'}</h1>
    <p class="muted" style="margin:0;max-width:30ch">${o.fromOffer ? `Wybrałaś ofertę: ${esc(p.name)}. Pozostałym wykonawcom podziękowaliśmy w Twoim imieniu.` : `${p.name.split(' ')[0]} potwierdzi ją zwykle w ${p.response}. Dostaniesz powiadomienie.`}</p>
    <div class="receipt mt24" style="width:100%;text-align:left">
      <div class="ln"><span>Kiedy</span><b>${dayLabel(d)}, ${o.time}</b></div>
      <div class="ln"><span>Usługa</span><b>${catById(o.service).name}</b></div>
      <div class="ln"><span>Adres</span><b>${o.addr}</b></div>
      <div class="ln"><span>Zablokowano</span><b>${zl(o.total)}</b></div>
    </div>
  </div></div>
  <div class="footer" style="flex-direction:column;align-items:stretch;gap:8px">
    <button class="btn primary block" data-act="openOrderFromDone" data-a="${o.id}">Zobacz zlecenie</button>
    <button class="btn line block" data-act="openChat" data-a="${p.id}">${ic('message-circle', 's')}Napisz wiadomość</button>
  </div>`;
};

/* ---------- orders ---------- */
const STATUS = {
  pending: ['Czeka na potwierdzenie', 'st-pending'], confirmed: ['Potwierdzone', 'st-confirmed'], enroute: ['W drodze', 'st-enroute'],
  progress: ['W trakcie', 'st-progress'], done: ['Zakończone', 'st-done'], cancel: ['Odwołane', 'st-cancel']
};
const statusText = s => STATUS[s][0];
const statusPill = s => `<span class="status ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

screens.orders = () => {
  const up = S.orders.filter(o => !['done', 'cancel'].includes(o.status)).sort((a, b) => a.date - b.date);
  const past = S.orders.filter(o => ['done', 'cancel'].includes(o.status)).sort((a, b) => b.date - a.date);
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
    ['Zarezerwowane', 'Płatność zablokowana', 'calendar-check'],
    ['Potwierdzone', 'Wykonawca przyjął zlecenie', 'check'],
    ['W drodze', 'Zobaczysz, gdy wyruszy', 'car'],
    ['W trakcie', `${o.time}–${endTime(o.time, o.h)}`, 'sparkles'],
    ['Zakończone', 'Zatwierdzasz i zwalniasz płatność', 'flag']
  ];
  const cur = o.status === 'cancel' ? -2 : o.status === 'done' ? 5 : idx + 1;
  const active = !['done', 'cancel'].includes(o.status);
  const e = { h: o.h };
  return `${topbar('Zlecenie', `<button class="iconbtn" data-act="openChat" data-a="${p.id}" aria-label="Czat">${ic('message-circle', 's')}</button>`)}
  <div class="scroll"><div class="pad">
    <div class="row between"><div><div class="eyebrow">${dayLabel(d)} · ${o.time}</div><h1 class="pagetitle" style="margin:4px 0 6px;font-size:26px">${catById(o.service).name}</h1></div></div>
    <div class="row" style="gap:6px">${statusPill(o.status)}${o.freq !== 'once' ? `<span class="tag">${ic('repeat', 'xs')}${FREQ.find(f => f.id === o.freq).name}</span>` : ''}</div>

    ${o.status === 'enroute' ? `<div class="route mt16"><svg viewBox="0 0 340 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 30 H340 M0 85 H340 M70 0 V120 M190 0 V120 M290 0 V120" stroke="var(--line)" stroke-width="10" fill="none"/>
      <path d="M40 85 H190 V30 H270" stroke="var(--cloth)" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round" fill="none"/>
      <circle cx="120" cy="85" r="9" fill="var(--cloth)"/><circle cx="120" cy="85" r="16" fill="var(--cloth)" opacity=".2"/>
      <circle cx="270" cy="30" r="9" fill="var(--glove)" stroke="var(--ink)" stroke-width="2"/></svg></div>
      <div class="note">${ic('car', 's')}<span><b>${p.name.split(' ')[0]} jest w drodze</b>, dotrze za ok. 12 min.</span></div>` : ''}
    ${o.status === 'done' && !o.rated ? `<div class="note yellow mt16">${ic('hand-coins', 's')}<span>Usługa zakończona. Sprawdź mieszkanie i zatwierdź, wtedy zwolnimy płatność. Masz na to 24 h.</span></div>` : ''}

    ${o.status === 'progress' ? liveBlock(o) : ''}
    ${o.status === 'done' && o.report ? reportBlock(o, p) : ''}
    <div class="card mt16"><div class="timeline">${tl.map((t, i) => `<div class="tl ${cur > i ? 'ok' : cur === i ? 'now' : ''}"><span class="dot">${ic(cur > i ? 'check' : t[2], 'xs')}</span><div><b>${t[0]}</b><span>${t[1]}</span></div></div>`).join('')}</div>
      ${active ? `<button class="btn sm line mt16" data-act="advanceOrder" data-a="${o.id}">${ic('fast-forward', 's')}Symuluj kolejny status</button>` : ''}</div>

    <div class="card mt12"><div class="row">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${stars(p.rating)} · odpowiada w ${p.response}</div></div>
      <button class="iconbtn" data-act="toast" data-a="Połączenie przez numer maskowany w pełnej wersji" aria-label="Zadzwoń">${ic('phone', 's')}</button></div></div>

    <div class="section-h"><h3>Szczegóły</h3></div>
    <div class="receipt">
      <div class="ln"><span>Adres</span><b>${o.addr}</b></div>
      ${o.m2 ? `<div class="ln"><span>Metraż</span><b>${o.m2} m²</b></div>` : ''}
      <div class="ln"><span>Czas</span><b>ok. ${hrs(o.h)}</b></div>
      ${o.extras.length ? `<div class="ln"><span>Dodatki</span><b>${o.extras.map(id => EXTRAS.find(x => x.id === id).name).join(', ')}</b></div>` : ''}
      <div class="ln"><span>Płatność</span><b>${o.pay} · ${o.status === 'done' && o.rated ? 'opłacone' : 'zablokowano'}</b></div>
      <div class="tot"><span class="muted small">Razem</span><b class="num">${zl(o.total)}</b></div>
    </div>
    ${o.status === 'done' ? `<button class="btn line block mt12" data-act="toast" data-a="Rachunek wysłany na e-mail">${ic('download', 's')}Pobierz rachunek</button>` : ''}
    <div class="sp"></div>
  </div></div>
  ${active ? `<div class="footer"><button class="btn line" data-act="toast" data-a="Przełożenie terminu w pełnej wersji">Przełóż</button><button class="btn danger" style="flex:1" data-act="sheet" data-a="cancel" data-b="${o.id}">Odwołaj</button></div>`
    : o.status === 'done' && !o.rated ? `<div class="footer"><button class="btn line" data-act="toast" data-a="Zgłoszenie wysłane. ${p.name.split(' ')[0]} wróci na poprawkę w 24 h" >Zgłoś problem</button><button class="btn primary" style="flex:1" data-act="openRate" data-a="${o.id}">Zatwierdź i oceń</button></div>`
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
    <div class="field" style="text-align:left"><span class="lbl">Napiwek — w całości dla wykonawcy</span>
      <div class="chips">${[0, 10, 20, 30].map(t => `<button class="chip ${r.tip === t ? 'on' : ''}" data-act="rtip" data-a="${t}">${t ? t + ' zł' : 'Bez napiwku'}</button>`).join('')}</div></div>
    <div class="sp"></div>
  </div></div>
  <div class="footer slidefoot">${swipeBtn('submitRate', o.id, `Przesuń, aby zwolnić ${zl(o.total + r.tip)}`)}</div>`;
};

/* ---------- inbox & chat ---------- */
screens.inbox = () => {
  const ids = Object.keys(S.threads);
  const isPro = S.role === 'pro';
  const items = isPro
    ? [{ id: 'c-tomasz', name: 'Tomasz', ini: 'T', tone: 't-blue', last: 'Czy da się w sobotę o 10?', at: '12:40', unread: 1 }, { id: 'c-ewa', name: 'Ewa M.', ini: 'EM', tone: 't-mint', last: 'Klucz zostawię u portiera.', at: 'wczoraj', unread: 0 }]
    : ids.map(id => { const p = proById(id); const t = S.threads[id]; const l = t.msgs[t.msgs.length - 1]; return { id, name: p.name, ini: p.ini, tone: p.tone, last: (l.me ? 'Ty: ' : '') + l.t, at: l.at, unread: t.unread }; });
  return `<div class="scroll"><div class="pad"><h1 class="pagetitle" style="margin-top:12px">Wiadomości</h1></div>
    <div class="threads">${items.map(t => `<button class="thread" data-act="${isPro ? 'toast' : 'openChat'}" data-a="${isPro ? 'Czat z klientem działa tak samo jak po stronie klienta' : t.id}">
      <div class="avatar sm ${t.tone}">${t.ini}</div>
      <div class="grow"><div class="row between"><span class="name">${esc(t.name)}</span><span class="tiny faint">${t.at}</span></div>
      <div class="small ${t.unread ? '' : 'muted'}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${t.unread ? 'font-weight:600' : ''}">${esc(t.last)}</div></div>
      ${t.unread ? '<span class="unread"></span>' : ''}</button>`).join('')}</div>
    <div class="pad"><div class="note mt24">${ic('shield-check', 's')}<span>Rozmawiaj i płać tylko w aplikacji. Wtedy działa gwarancja poprawki i zwrot pieniędzy.</span></div></div>
  </div>`;
};

screens.chat = ({ id }) => {
  const p = proById(id);
  const t = (S.threads[id] ||= { unread: 0, msgs: [{ me: false, t: `Dzień dobry! Tu ${p.name.split(' ')[0]}. W czym mogę pomóc?`, at: nowTime() }] });
  t.unread = 0;
  const o = S.orders.find(x => x.pro === id && !['done', 'cancel'].includes(x.status));
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

/* ---------- profile ---------- */
screens.profile = () => {
  if (S.role === 'pro') return proProfile();
  const done = S.orders.filter(o => o.status === 'done').length;
  return `<div class="scroll"><div class="pad">
    <div class="row mt16" style="gap:14px"><div class="avatar lg t-blue" style="width:72px;height:72px;font-size:26px;border-radius:24px">KN</div>
      <div><h1 class="pagetitle" style="margin:0;font-size:26px">Kasia Nowicka</h1><div class="small muted">Klientka od marca 2025 · ${done} zakończonych zleceń</div></div></div>
    <div class="section-h"><h3>Ulubieni</h3></div>
    <div class="stack">${S.favs.map(id => proById(id)).filter(Boolean).map(p => `<div class="pcard" style="padding:12px;align-items:center" role="button" tabindex="0" data-act="openPro" data-a="${p.id}">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${stars(p.rating)} · ${p.nextSlot}</div></div><button class="btn sm primary" data-act="startBooking" data-a="${p.id}">Rezerwuj</button></div>`).join('') || '<div class="small muted">Dotknij serca przy wykonawcy, żeby dodać go tutaj.</div>'}</div>
    <div class="menu mt24">
      <button class="mi" data-act="toast" data-a="Edycja adresów w pełnej wersji">${ic('map-pin', 's')}Adresy<span class="r">2 ${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Metody płatności w pełnej wersji">${ic('wallet', 's')}Płatności<span class="r">BLIK, Visa ${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Dane do faktury w pełnej wersji">${ic('receipt', 's')}Dane do faktury<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Ustawienia powiadomień w pełnej wersji">${ic('bell', 's')}Powiadomienia<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Centrum pomocy w pełnej wersji">${ic('life-buoy', 's')}Pomoc i gwarancja<span class="r">${ic('chevron-right', 's')}</span></button>
    </div>
    <div class="becomepro mt24">
      <svg viewBox="0 0 120 120" aria-hidden="true"><rect x="38" y="44" width="44" height="64" rx="12" fill="currentColor" opacity=".9"/><rect x="48" y="22" width="24" height="26" rx="6" fill="currentColor" opacity=".9"/><path d="M72 30 h22 v8 h-22z" fill="currentColor" opacity=".9"/><circle cx="104" cy="22" r="4" fill="currentColor" opacity=".5"/><circle cx="110" cy="36" r="3" fill="currentColor" opacity=".4"/><circle cx="100" cy="44" r="2.5" fill="currentColor" opacity=".3"/></svg>
      <h4>Sprzątasz zawodowo?</h4>
      <p>Publikacja ogłoszenia jest darmowa. Prowizja 12% tylko od zrealizowanych zleceń, wypłaty co piątek.</p>
      <button class="btn sm" data-act="becomePro">Dodaj ogłoszenie ${ic('arrow-right', 's')}</button>
    </div>
    <div class="sp"></div></div></div>`;
};

/* ================= PROVIDER SCREENS ================= */
screens.dash = () => {
  const P = S.pro; const L = P.listing;
  const week = [{ d: 'pn', v: 180 }, { d: 'wt', v: 0 }, { d: 'śr', v: 320 }, { d: 'cz', v: 210 }, { d: 'pt', v: 0 }, { d: 'sb', v: 530 }, { d: 'nd', v: 0 }];
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
        <div class="row between"><span class="eyebrow" style="color:inherit;opacity:.6">Ten tydzień</span><span class="tiny" style="opacity:.7">wypłata w piątek</span></div>
        <div class="amt num">${zl(sum)}</div>
        <div class="sub">${P.jobs.length + 4} zlecenia · śr. ${Math.round(sum / 26)} zł/h po prowizji</div>
        <div class="bars">${week.map((w, i) => `<div class="bar ${i === todayIdx ? 'today' : ''}">${w.v === max ? `<em>${w.v}</em>` : ''}<i style="height:${w.v ? Math.max(8, w.v / max * 78) : 4}%"></i>${w.d}</div>`).join('')}</div>
      </div>

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
      <div>${ic('navigation', 's')}${String(r.dist).replace('.', ',')} km · ${r.area.split(',')[0]}</div>
    </div>
    <div class="quote">„${esc(r.note)}”</div>
    <div class="row between" style="margin-bottom:10px;gap:8px"><span class="timer">${ic('timer', 'xs')}Wygasa za ${r.expires} min</span><span class="tiny faint" style="text-align:right">Dla Ciebie <b style="color:var(--ink)">${zl(r.pay * 0.88)}</b></span></div>
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
      <div class="row mt8" style="gap:6px"><button class="btn sm line" style="height:32px" data-act="toast" data-a="Nawigacja otworzy się w aplikacji map">${ic('navigation', 'xs')}Trasa</button><button class="btn sm line" style="height:32px" data-act="toast" data-a="Czat z klientem w pełnej wersji">${ic('message-circle', 'xs')}Czat</button></div></div></div>`).join('')
      : `<div class="card empty" style="padding:22px">${ic('coffee')}<div style="font-weight:650;color:var(--ink)">Wolny dzień</div><div class="small mt8">${P.avail[addDays(P.calDay).getDay()] ? 'Jesteś dostępna, klienci mogą rezerwować ten dzień.' : 'Ten dzień jest zablokowany dla klientów.'}</div></div>`}</div>

    <div class="section-h"><h3>Stała dostępność</h3><span class="tiny faint">widzą ją klienci</span></div>
    <div class="card" style="padding:4px 16px"><div class="avail">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="a"><b class="small">${DAYS[d]}</b><span class="grow small ${P.avail[d] ? 'muted' : 'faint'}">${P.avail[d] ? '8:00 – 18:00' : 'Niedostępna'}</span><button class="switch ${P.avail[d] ? 'on' : ''}" data-act="toggleAvail" data-a="${d}" aria-label="Dostępność ${DAYS_LONG[d]}"></button></div>`).join('')}</div></div>
    <button class="btn line block mt12" data-act="toast" data-a="Urlop zapisany: klienci nie zobaczą tych dni" >${ic('palmtree', 's')}Zaplanuj urlop</button>
    <div class="sp"></div></div></div>`;
};

screens.listing = () => {
  const L = S.pro.listing;
  const fake = { id: 'me', name: L.name, ini: L.name.split(' ').map(w => w[0]).join('').slice(0, 2), tone: 't-mint', kind: 'Osoba prywatna', area: L.areas[0] || 'Mokotów', dist: 0, rating: 4.92, reviews: 38, verified: L.idVerified, insured: L.insured, invoice: L.invoice, supplies: L.supplies, eco: L.eco, pets: L.pets, rate: L.rate, tagline: L.tagline || 'Dodaj krótki opis', nextSlot: 'Jutro 9:00', todayFree: false };
  const month = Math.round(L.rate * 80 * 0.88);
  return `<div class="scroll"><div class="pad">
    <div class="row between mt12"><h1 class="pagetitle" style="margin:0">Ogłoszenie</h1><span class="tag ${L.published ? 'mint' : ''}">${L.published ? 'Opublikowane' : 'Szkic'}</span></div>
    <div class="small muted" style="margin:6px 0 14px">Tak widzą Cię klienci w wynikach wyszukiwania:</div>
    <div class="preview-wrap" id="preview">${proCard(fake).replace(/data-act="openPro"/, 'data-act="noop"').replace(/data-act="fav"/, 'data-act="noop"')}</div>

    <div class="field"><label for="lname">Wyświetlana nazwa</label><input class="input" id="lname" value="${esc(L.name)}" data-model="pro.listing.name" data-live="preview"></div>
    <div class="field"><label for="ltag">Jedno zdanie o Twojej usłudze</label><input class="input" id="ltag" maxlength="80" value="${esc(L.tagline)}" data-model="pro.listing.tagline" data-live="preview"><div class="hint">Napisz konkretnie: co sprzątasz i czym się wyróżniasz.</div></div>

    <div class="field"><span class="lbl">Usługi</span><div class="chips">${CATS.map(c => `<button class="chip ${L.services.includes(c.id) ? 'on' : ''}" data-act="lsvc" data-a="${c.id}">${c.short}</button>`).join('')}</div></div>

    <div class="field"><div class="row between"><span class="lbl" style="margin:0">Stawka godzinowa</span><span class="big-val num" id="rateVal">${L.rate}<small>zł/h</small></span></div>
      <input type="range" id="lrate" min="30" max="90" step="1" value="${L.rate}" data-model="pro.listing.rate" data-type="num" data-live="rate" aria-label="Stawka">
      <div class="market"><span>30 zł</span><span>średnia na Mokotowie: <b style="color:var(--ink)">46 zł/h</b></span><span>90 zł</span></div>
      <div class="note mint mt12">${ic('trending-up', 's')}<span id="rateHint">Przy 20 h tygodniowo zarobisz ok. <b>${zl(month)}</b> miesięcznie po prowizji.</span></div></div>

    <div class="field"><span class="lbl">Minimalny czas wizyty</span>
      <div class="stepper"><span>${hrs(L.minH)}</span><div class="ctl"><button data-act="lmin" data-a="-0.5" aria-label="Mniej">${ic('minus', 's')}</button><button data-act="lmin" data-a="0.5" aria-label="Więcej">${ic('plus', 's')}</button></div></div></div>

    <div class="field"><span class="lbl">Gdzie dojeżdżasz</span><div class="chips">${DISTRICTS.map(d => `<button class="chip ${L.areas.includes(d) ? 'on' : ''}" data-act="larea" data-a="${d}">${d}</button>`).join('')}</div></div>

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

function proProfile() {
  const L = S.pro.listing;
  return `<div class="scroll"><div class="pad">
    <div class="rolebar" style="padding:0;margin-top:4px"><span class="proflag"><i></i>Tryb wykonawcy</span></div>
    <div class="row mt16" style="gap:14px"><div class="avatar lg t-mint" style="width:72px;height:72px;font-size:26px;border-radius:24px">${L.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
      <div><h1 class="pagetitle" style="margin:0;font-size:26px">${esc(L.name)}</h1><div class="small muted">${ic('star', 'xs star')} 4,92 · 38 opinii · 112 zleceń</div></div></div>
    <div class="menu mt24">
      <button class="mi" data-act="toast" data-a="Wypłaty co piątek na konto •••• 0921">${ic('landmark', 's')}Wypłaty<span class="r">•••• 0921 ${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Zestawienie miesięczne wysłane na e-mail">${ic('file-text', 's')}Rozliczenia i PIT<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="previewPro">${ic('eye', 's')}Podgląd mojego profilu<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Poradnik: jak zdobyć pierwszych klientów">${ic('graduation-cap', 's')}Akademia wykonawcy<span class="r">${ic('chevron-right', 's')}</span></button>
      <button class="mi" data-act="toast" data-a="Ubezpieczenie zleceń: do 100 000 zł szkód w cenie prowizji">${ic('shield', 's')}Ochrona zleceń<span class="r">${ic('chevron-right', 's')}</span></button>
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
    <div class="note mt16">${ic('map-pin', 's')}<span>ul. Puławska 112/14, Mokotów. Dokładny adres zobaczy tylko wykonawca, którego wybierzesz.</span></div>
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
    <div class="head"><div class="row" style="gap:10px"><span class="avatar sm ${c.tone}">${ic(c.icon, 's')}</span><div><b class="small">${c.name}</b><div class="tiny faint">${esc(m.client)} · ${ic('star', 'xs star')} ${m.crating.toFixed(1).replace('.', ',')} · ${String(m.dist).replace('.', ',')} km</div></div></div>
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
      <div class="field"><span class="lbl">Minimalna ocena</span><div class="chips">${[[0, 'Dowolna'], [4.8, '4,8+'], [4.9, '4,9+']].map(([v, l]) => `<button class="chip ${f.minRating === v ? 'on' : ''}" data-act="setF" data-a="minRating" data-b="${v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Bezpieczeństwo</span><div class="card" style="padding:2px 16px">${tog('verified', 'Zweryfikowana tożsamość')}${tog('insured', 'Polisa OC', 'Szkody pokrywa ubezpieczyciel')}</div></div>
      <div class="field"><span class="lbl">Wygoda</span><div class="card" style="padding:2px 16px">${tog('today', 'Wolne jeszcze dziś')}${tog('supplies', 'Przynosi własne środki')}${tog('eco', 'Ekologiczne środki')}${tog('pets', 'Zwierzęta OK')}${tog('invoice', 'Faktura VAT')}</div></div>`,
      foot: `<button class="btn line" data-act="clearFilters">Wyczyść</button><button class="btn dark" style="flex:1" data-act="closeSheet">Pokaż ${filteredPros().length} wyników</button>` };
  },
  cancel(id) {
    const o = S.orders.find(x => x.id === id); const free = o.date >= 2;
    return { title: 'Odwołać wizytę?', body: `<p class="muted" style="margin-top:0">${free ? 'Do wizyty zostało ponad 24 h, więc odwołanie jest bezpłatne. Zablokowane pieniądze wrócą od razu.' : 'Do wizyty zostało mniej niż 24 h. Wykonawca otrzyma 50% kwoty jako rekompensatę za zarezerwowany czas.'}</p>
      <div class="field"><span class="lbl">Powód</span><div class="chips">${['Zmiana planów', 'Znalazłem kogoś innego', 'Termin nie pasuje', 'Inny'].map((t, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-act="pickChip">${t}</button>`).join('')}</div></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Zostaw</button><button class="btn danger" style="flex:1" data-act="cancelOrder" data-a="${id}">Odwołaj ${free ? 'bezpłatnie' : 'za ' + zl(o.total / 2)}</button>` };
  },
  pickOffer(arg) {
    const [pid, oid] = arg.split('|'); const x = S.posts.find(y => y.id === pid); const o = x.offers.find(y => y.id === oid); const p = proById(o.pro);
    return { title: 'Wybrać tę ofertę?', body: `<div class="row">${avatar(p, 'sm')}<div class="grow"><div class="name">${esc(p.name)}</div><div class="tiny faint">${dayLabel(addDays(o.day))}, ${o.time} · ok. ${hrs(o.h)}</div></div><b class="num">${zl(o.price)}</b></div>
      <div class="note mint mt16">${ic('lock', 's')}<span>Zablokujemy ${zl(o.price + SERVICE_FEE)} (z opłatą serwisową) na BLIK-u. Pieniądze trafią do wykonawcy po zatwierdzeniu usługi.</span></div>
      <div class="note mt8">${ic('mail', 's')}<span>${x.offers.length - 1 === 1 ? 'Drugiemu wykonawcy' : `Pozostałym ${x.offers.length - 1} wykonawcom`} podziękujemy automatycznie.</span></div>`,
      foot: `<button class="btn line" data-act="closeSheet">Wróć</button><button class="btn primary" style="flex:1" data-act="acceptOffer" data-a="${arg}">Potwierdź za ${zl(o.price + SERVICE_FEE)}</button>` };
  },
  sendOffer(id) {
    const m = S.pro.market.find(y => y.id === id); const L = S.pro.listing;
    const d = S.pro.offerDraft;
    return { title: 'Twoja oferta', body: `<p class="small muted" style="margin-top:0">${esc(m.client)}: ${esc(m.desc)}</p>
      <div class="field" style="margin-top:12px"><div class="row between"><span class="lbl" style="margin:0">Cena całkowita</span><span class="big-val num" id="ofPrice">${d.price}<small>zł</small></span></div>
        <input type="range" id="ofp" min="100" max="900" step="10" value="${d.price}" data-model="pro.offerDraft.price" data-type="num" data-live="ofp" aria-label="Cena">
        <div class="market"><span id="ofNet">Dla Ciebie po prowizji: ${zl(d.price * 0.88)}</span><span>${m.budget ? 'budżet klienta: ' + zl(m.budget) : ''}</span></div></div>
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
  const t = top(); const key = stackKey() + ':' + stack().length + ':' + t.name;
  const sc = $app.querySelector('.scroll');
  if (sc && lastKey) scrollMemo[lastKey] = sc.scrollTop;
  const fn = screens[t.name];
  const html = fn ? fn(t.p || {}) : '<div class="pad">Brak ekranu</div>';
  const showTabs = stack().length === 1;
  const tabs = TABS[S.role];
  const unread = Object.values(S.threads).reduce((a, x) => a + x.unread, 0);
  const needRate = S.orders.some(o => o.status === 'done' && !o.rated);
  let sheetHTML = '';
  if (S.sheet) {
    const s = sheets[S.sheet.name](S.sheet.p);
    sheetHTML = `<div class="sheet-wrap"><div class="sheet-bg" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-label="${s.title}"><div class="grab"></div><div class="sh-h"><h3>${s.title}</h3><button class="iconbtn ghost" data-act="closeSheet" aria-label="Zamknij">${ic('x', 's')}</button></div><div class="sh-b">${s.body}</div>${s.foot ? `<div class="sh-f">${s.foot}</div>` : ''}</div></div>`;
  }
  $app.innerHTML = `<div class="view ${anim}">${html}</div>${showTabs ? `<nav class="tabbar">${tabs.map(tb => `<button class="tab ${S.tab === tb.id ? 'on' : ''}" data-act="setTab" data-a="${tb.id}"><span class="pill">${ic(tb.icon)}</span>${tb.label}${(tb.id === 'inbox' && unread && S.role === 'client') || (tb.id === 'orders' && needRate) || (tb.id === 'dash' && S.pro.requests.length) ? '<span class="dot"></span>' : ''}</button>`).join('')}</nav>` : ''}${sheetHTML}`;
  anim = '';
  const nsc = $app.querySelector('.view .scroll');
  if (nsc && key === lastKey && scrollMemo[key]) nsc.scrollTop = scrollMemo[key];
  else if (nsc && scrollMemo[key] && t.name !== 'chat') nsc.scrollTop = scrollMemo[key];
  if (t.name === 'chat') scrollChat();
  lastKey = key;
  persist();
  syncPitch();
  afterRender();
}

/* ================= interakcje dotykowe ================= */
function afterRender() { initGrime(); initBA(); document.querySelectorAll('#app .slide').forEach(initSlide); initSheetDrag(); }

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
      setTimeout(() => { S.wiped = true; persist(); toast('Lśni! Kod SZYBA20 jest Twój', 'sparkles'); render(); }, 700);
    }
  };
  c.addEventListener('pointerdown', e => { last = pt(e); c.setPointerCapture(e.pointerId); c.parentElement.classList.add('wiping'); wipe(last, [last[0] + .1, last[1]]); });
  c.addEventListener('pointermove', e => { if (!last) return; const p2 = pt(e); wipe(last, p2); last = p2; if (++moves % 8 === 0) check(); });
  const up = () => { if (last) check(); last = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
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
  clearFilters() { Object.assign(S.filters, { maxPrice: 100, minRating: 0, verified: false, insured: false, supplies: false, eco: false, pets: false, invoice: false, today: false, q: '' }); render(); },
  sheet(name, p) {
    if (name === 'sendOffer') { const m = S.pro.market.find(y => y.id === p); S.pro.offerDraft = { price: m.budget ? Math.round(m.budget * 0.85 / 10) * 10 : 300, day: 2, msg: `Dzień dobry, chętnie się tym zajmę. Przyjadę z własnym sprzętem i środkami. Pozdrawiam, ${S.pro.listing.name.split(' ')[0]}` }; }
    S.sheet = { name, p }; render();
  },
  closeSheet() { S.sheet = null; render(); },
  pickChip(_, __, el) { el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); el.classList.add('on'); },

  startBooking(id, preset) { S.booking = newBooking(id, preset); go('book'); },
  bset(k, v) { S.booking[k] = v; render(); },
  bstep(k, d) { const b = S.booking; b[k] = Math.min(k === 'rooms' ? 8 : 5, Math.max(1, b[k] + Number(d))); render(); },
  bextra(id) { const x = S.booking.extras; const i = x.indexOf(id); i >= 0 ? x.splice(i, 1) : x.push(id); render(); },
  bfocus(t) { const x = S.booking.focus; const i = x.indexOf(t); i >= 0 ? x.splice(i, 1) : x.push(t); render(); },
  bday(i) { const b = S.booking; b.day = Number(i); if (b.time && slotTaken(b.pro, b.day, b.time)) b.time = null; render(); },
  bookNext() { S.booking.step++; scrollMemo = {}; anim = 'enter'; render(); },
  bookPrev() { S.booking.step--; anim = 'fade'; render(); },
  pay() {
    const sl = document.getElementById('slide-pay'); if (!sl) return;
    sl.classList.add('busy'); sl.querySelector('.slide-label').textContent = 'Potwierdź w aplikacji banku…';
    setTimeout(() => {
      const b = S.booking; const p = proById(b.pro); const e = estimate(b, p);
      const o = { id: 'o' + Date.now(), pro: b.pro, service: b.service, date: b.day, time: b.time, h: e.h, m2: b.m2, total: Math.round(e.total * 100) / 100, freq: b.freq, status: 'pending', extras: b.extras.slice(), addr: b.addr === 'home' ? 'ul. Puławska 112/14' : 'ul. Odyńca 27/3', pay: b.pay === 'blik' ? 'BLIK' : b.pay === 'card' ? 'Karta' : 'Faktura' };
      S.orders.push(o); S.booking = null;
      S.stacks[stackKey()] = [{ name: S.tab }, { name: 'booked', p: { id: o.id } }]; anim = 'enter'; render();
      setTimeout(() => { if (o.status === 'pending') { o.status = 'confirmed'; toast(`${p.name.split(' ')[0]} potwierdza rezerwację`, 'badge-check'); render(); } }, 4000);
    }, 1300);
  },
  openOrder: id => go('order', { id }),
  openOrderFromDone(id) { S.tab = 'orders'; S.ordersSeg = 'up'; S.stacks[stackKey()] = [{ name: 'orders' }, { name: 'order', p: { id } }]; anim = 'enter'; render(); },
  seg(a) { S.ordersSeg = a; render(); },
  advanceOrder(id) {
    const o = S.orders.find(x => x.id === id); const flow = ['pending', 'confirmed', 'enroute', 'progress', 'done'];
    const wasProgress = o.status === 'progress';
    o.status = flow[Math.min(flow.length - 1, flow.indexOf(o.status) + 1)];
    if (o.status === 'progress') { o.prog = 0; o.started = nowTime(); }
    if (o.status === 'done') { if (wasProgress) o.prog = checklistFor(o).length; finishOrder(o); }
    render();
  },
  cancelOrder(id) { const o = S.orders.find(x => x.id === id); o.status = 'cancel'; S.sheet = null; stack().pop(); toast('Wizyta odwołana, pieniądze wracają na konto', 'undo-2'); anim = 'fade'; render(); },
  openRate(id) { S.rate = { stars: 5, tags: [], tip: 0, comment: '' }; go('rate', { id }); },
  rstar(i) { S.rate.stars = Number(i); render(); },
  rtag(t) { const x = S.rate.tags; const i = x.indexOf(t); i >= 0 ? x.splice(i, 1) : x.push(t); render(); },
  rtip(t) { S.rate.tip = Number(t); render(); },
  submitRate(id) { const o = S.orders.find(x => x.id === id); o.rated = S.rate.stars; o.total += S.rate.tip; S.stacks[stackKey()] = stack().slice(0, 1); S.ordersSeg = 'past'; toast('Dziękujemy! Płatność zwolniona', 'heart-handshake'); anim = 'fade'; render(); },
  rebook(id) { const o = S.orders.find(x => x.id === id); S.booking = Object.assign(newBooking(o.pro), { service: proById(o.pro).services.includes(o.service) ? o.service : proById(o.pro).services[0], m2: o.m2 || 54, extras: o.extras.slice() }); go('book'); },

  openChat(id) { if (S.role !== 'client') return; go('chat', { id }); },
  quickReply(text, id) { sendMsg(id, text); },

  becomePro() { S.role = 'pro'; S.tab = 'listing'; S.stacks = {}; anim = 'enter'; toast('Witaj w trybie wykonawcy', 'sparkles'); render(); },
  setRole(r) { if (S.role === r) return; S.role = r; S.tab = r === 'pro' ? 'dash' : 'home'; S.stacks = {}; S.sheet = null; anim = 'fade'; render(); },

  toggleOnline() { S.pro.online = !S.pro.online; toast(S.pro.online ? 'Znów przyjmujesz zlecenia' : 'Nie pokazujemy Cię w wynikach do odwołania', S.pro.online ? 'zap' : 'moon'); render(); },
  acceptReq(id) {
    const P = S.pro; const r = P.requests.find(x => x.id === id);
    P.requests = P.requests.filter(x => x.id !== id);
    P.jobs.push({ day: r.day, time: r.time, end: endTime(r.time, r.h), client: r.client, service: r.service, area: r.area.split(',')[0], pay: r.pay, tone: 'm' });
    toast(`Przyjęte: ${dayLabel(addDays(r.day))}, ${r.time}. Dodano do grafiku`, 'calendar-check'); render();
  },
  declineReq(id) {
    const P = S.pro; lastDeclined = P.requests.find(x => x.id === id);
    P.requests = P.requests.filter(x => x.id !== id); S.sheet = null; toast('Zapytanie odrzucone', 'x', 'undoDecline'); render();
  },
  undoDecline() { if (lastDeclined) { S.pro.requests.unshift(lastDeclined); lastDeclined = null; $toast.innerHTML = ''; render(); } },
  calDay(i) { S.pro.calDay = Number(i); render(); },
  toggleAvail(d) { S.pro.avail[d] = !S.pro.avail[d]; render(); },
  lsvc(id) { const x = S.pro.listing.services; const i = x.indexOf(id); i >= 0 ? (x.length > 1 && x.splice(i, 1)) : x.push(id); render(); },
  larea(d) { const x = S.pro.listing.areas; const i = x.indexOf(d); i >= 0 ? x.splice(i, 1) : x.push(d); render(); },
  ltoggle(k) { S.pro.listing[k] = !S.pro.listing[k]; render(); },
  lmin(d) { const L = S.pro.listing; L.minH = Math.min(8, Math.max(1, L.minH + Number(d))); render(); },
  lphotoDel(i) { S.pro.listing.photos.splice(Number(i), 1); render(); },
  uploadOC() { S.pro.listing.insured = true; toast('Polisa OC dodana. Odznaka pojawi się po weryfikacji', 'shield-check'); render(); },
  publish() { S.pro.listing.published = true; toast('Ogłoszenie zapisane i widoczne dla klientów', 'megaphone'); render(); },
  previewPro() { go('selfpreview'); },

  searchView(v) { S.searchView = v; render(); },
  mapSel(id) { S.mapSel = id; buzz(8); render(); },
  copyCode() {
    const done = () => toast('Skopiowano kod SZYBA20', 'copy');
    try { navigator.clipboard.writeText('SZYBA20').then(done, done); } catch (e) { done(); }
  },
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
    const ord = { id: 'o' + Date.now(), pro: of.pro, service: x.cat, date: of.day, time: of.time, h: of.h, m2: ['okna', 'tapicerka'].includes(x.cat) ? 0 : x.m2, total: of.price + SERVICE_FEE, freq: 'once', status: 'confirmed', extras: [], addr: 'ul. Puławska 112/14', pay: 'BLIK', fromOffer: true };
    S.orders.push(ord); S.sheet = null; S.posts = S.posts.filter(y => y.id !== pid).concat(x);
    S.stacks[stackKey()] = [{ name: S.tab }, { name: 'booked', p: { id: ord.id } }]; anim = 'enter'; render();
  },
  ofDay(i) { S.pro.offerDraft.day = Number(i); render(); },
  submitOffer(id) { const m = S.pro.market.find(y => y.id === id); m.sent = S.pro.offerDraft.price; S.sheet = null; toast(`Oferta wysłana. ${m.client} dostanie powiadomienie`, 'send'); render(); },
  cycleTheme() {
    const order = [null, 'light', 'dark']; const cur = document.documentElement.getAttribute('data-theme');
    const next = order[(order.indexOf(cur) + 1) % 3];
    if (next) document.documentElement.setAttribute('data-theme', next); else document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeBtn').textContent = 'Motyw: ' + (next === 'light' ? 'jasny' : next === 'dark' ? 'ciemny' : 'systemowy');
    store.set('theme', next);
  },
  resetDemo() { const theme = store.get('theme', null); S = seed(); S.stacks = {}; S.sheet = null; store.set('state', {}); store.set('theme', theme); toast('Dane demo przywrócone', 'rotate-ccw'); render(); }
};
let lastDeclined = null;

/* ================= events ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  fn(el.dataset.a, el.dataset.b, el);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});
function setPath(path, val) { const ks = path.split('.'); let o = S; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = val; }
document.addEventListener('input', e => {
  const el = e.target; const path = el.dataset.model; if (!path) return;
  let v = el.value; if (el.dataset.type === 'num') v = Number(v);
  if (el.dataset.live === 'blik') { v = v.replace(/\D/g, '').slice(0, 6); el.value = v; }
  setPath(path, v);
  liveUpdate(el.dataset.live);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'photoIn') { readPhotos(el.files, S.pro.listing.photos, 8); return; }
  if (el.id === 'postPhotoIn') { readPhotos(el.files, S.draft.photos, 6); return; }
  if (el.dataset.rr) { if (el.dataset.model) { let v = el.value; if (el.dataset.type === 'num') v = Number(v); setPath(el.dataset.model, v); } render(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target; const kind = f.dataset.form;
  if (kind === 'search' || kind === 'search2') { S.filters.q = f.q.value; if (kind === 'search') { S.filters.cat = null; go('search'); } else render(); }
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
  if (kind === 'ofp') { const d = S.pro.offerDraft; document.getElementById('ofPrice').innerHTML = `${d.price}<small>zł</small>`; document.getElementById('ofNet').textContent = 'Dla Ciebie po prowizji: ' + zl(d.price * 0.88); }
  if (kind === 'maxPrice') { const v = document.getElementById('maxPriceVal'); if (v) v.textContent = S.filters.maxPrice >= 100 ? 'bez limitu' : S.filters.maxPrice + ' zł/h'; }
  if (kind === 'rate') {
    const L = S.pro.listing; document.getElementById('rateVal').innerHTML = `${L.rate}<small>zł/h</small>`;
    document.getElementById('rateHint').innerHTML = `Przy 20 h tygodniowo zarobisz ok. <b>${zl(Math.round(L.rate * 80 * 0.88))}</b> miesięcznie po prowizji.`;
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
      if (!(t.name === 'offers' && t.p.id === x.id)) toast(`Nowa oferta: ${proById(of.pro).name.split(' ')[0]}, ${zl(of.price)}`, 'hand-coins');
      x.justAdded = of.id;
      if (t.name === 'orders' || (t.name === 'offers' && t.p.id === x.id)) dirty = true;
    }
  });
  S.orders.forEach(o => {
    if (o.status !== 'progress') return;
    const total = checklistFor(o).length; o.prog = (o.prog || 0) + 1;
    if (o.prog >= total) { o.status = 'done'; finishOrder(o); }
    if (t.name === 'order' && t.p.id === o.id) dirty = true;
  });
  if (dirty && !S.sheet && !document.activeElement.matches('input,textarea')) render();
  S.posts.forEach(x => { x.justAdded = null; });
}, 1300);

/* ================= boot ================= */
const theme = store.get('theme', null);
if (theme) { document.documentElement.setAttribute('data-theme', theme); const tb = document.getElementById('themeBtn'); if (tb) tb.textContent = 'Motyw: ' + (theme === 'light' ? 'jasny' : 'ciemny'); }
const clock = document.getElementById('clock'); const tick = () => { if (clock) clock.textContent = nowTime(); }; tick(); setInterval(tick, 30000);
if (!S.tab || !TABS[S.role].some(t => t.id === S.tab)) S.tab = S.role === 'pro' ? 'dash' : 'home';
icons(document.querySelector('.pitch'));
icons(document.querySelector('.sbar'));
render();
})();
