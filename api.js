/* Lśni: klient API. Gdy aplikacja jest otwarta z serwera (katalog server/), wykrywa /api/health
   i przełącza się w tryb online. W podglądzie albo z pliku zostaje tryb demo. */
(function () {
  'use strict';
  const KEY = 'lsni:token';
  let token = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) { }

  function setToken(t) {
    token = t || '';
    try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch (e) { }
  }

  async function call(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error ? data.error.message : 'Nie udało się połączyć z serwerem (' + res.status + ')');
      err.status = res.status; err.code = data.error && data.error.code; err.data = data.error || {};
      if (res.status === 401) setToken('');
      throw err;
    }
    return data;
  }

  async function detect() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return false;
      const data = await res.json();
      return !!(data && data.ok);
    } catch (e) { return false; }
  }

  window.LsniAPI = { call, detect, setToken, get token() { return token; } };
})();
