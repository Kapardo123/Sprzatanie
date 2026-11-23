'use strict';
// Wycena liczona po stronie serwera. Klient wysyła tylko parametry, nigdy kwotę.
const SERVICES = ['dom', 'generalne', 'remont', 'okna', 'tapicerka', 'biuro', 'najem', 'prasowanie'];
const SERVICE_NAMES = { dom: 'Mieszkanie i dom', generalne: 'Sprzątanie generalne', remont: 'Po remoncie', okna: 'Mycie okien', tapicerka: 'Pranie tapicerki', biuro: 'Biura i lokale', najem: 'Najem krótkoterminowy', prasowanie: 'Prasowanie' };
const EXTRAS = { lodowka: 0.5, piekarnik: 0.75, okna: 1, szafki: 1, balkon: 0.5, prasowanie: 1 };
const FREQ_DISCOUNT = { once: 0, week: 0.15, biweek: 0.10, month: 0.05 };
const SLOT_HOURS = [8, 10, 12, 14, 16, 18];

function quote(provider, { service, m2 = 54, rooms = 2, baths = 1, extras = [], freq = 'once' }, travelFeeGr = 0) {
  if (provider.fixed_price) { // np. pranie tapicerki: cena za usługę
    const work = Math.round(provider.rate_gr * 1.6 / 500) * 500;
    return { hours: 2, baseHours: 2, extraHours: 0, workGr: work, discountGr: 0, travelGr: travelFeeGr, totalGr: work + travelFeeGr };
  }
  const mul = service === 'generalne' ? 1.5 : service === 'remont' ? 2 : 1;
  const base = (m2 / 22 + (baths - 1) * 0.5 + Math.max(0, rooms - 2) * 0.25) * mul;
  const extraHours = extras.reduce((a, id) => a + (EXTRAS[id] || 0), 0);
  const hours = Math.max(provider.min_hours, Math.ceil((base + extraHours) * 2) / 2);
  const workGr = Math.round(hours * provider.rate_gr);
  const discountGr = Math.round(workGr * (FREQ_DISCOUNT[freq] || 0));
  return { hours, baseHours: Math.max(0, hours - extraHours), extraHours, workGr, discountGr, travelGr: travelFeeGr, totalGr: workGr - discountGr + travelFeeGr };
}

// Cennik wyróżnień: zależny od popytu w dzielnicy (jak w makiecie).
const boostBaseGr = demand => Math.round(8 + demand * 0.6) * 100;
function boostPriceGr(demand, days) {
  const base = boostBaseGr(demand);
  return days === 3 ? Math.round(base * 0.5 / 100) * 100 : days === 14 ? Math.round(base * 1.8 / 100) * 100 : base;
}
const boostGuaranteedViews = (demand, days) => Math.round(demand * 3 * days / 7);

module.exports = { SERVICES, SERVICE_NAMES, EXTRAS, FREQ_DISCOUNT, SLOT_HOURS, quote, boostPriceGr, boostGuaranteedViews };
