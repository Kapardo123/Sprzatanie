'use strict';
// Automatyczna wstępna moderacja tekstów (opinie, odpowiedzi, czat).
// Treść z danymi kontaktowymi, linkami albo wulgaryzmami trafia do ręcznej moderacji zamiast od razu na profil.
const PROFANITY = ['kurw', 'chuj', 'huj', 'pierdol', 'jeban', 'jebać', 'skurwys', 'pizd', 'debil', 'idiot'];
const PHONE = /(?:\+?48[\s-]?)?(?:\d[\s-]?){9}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const URL = /(https?:\/\/|www\.|\b[\w-]+\.(pl|com|eu|net|org)\b)/i;

function check(text) {
  const t = String(text || '').toLowerCase();
  if (PHONE.test(t)) return { ok: false, reason: 'numer telefonu' };
  if (EMAIL.test(t)) return { ok: false, reason: 'adres e-mail' };
  if (URL.test(t)) return { ok: false, reason: 'link' };
  const bad = PROFANITY.find(w => t.includes(w));
  if (bad) return { ok: false, reason: 'wulgaryzm' };
  return { ok: true, reason: '' };
}

module.exports = { check };
