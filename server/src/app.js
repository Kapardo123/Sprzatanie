'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('./config');
const db = require('./db');
const { createRouter, createHandler, serveFile, SECURITY_HEADERS } = require('./http');
const { createSms } = require('./services/sms');
const { createNotifier } = require('./services/notify');
const { createDomain } = require('./domain');
const { createScheduler } = require('./scheduler');
const { createMapbox } = require('./services/mapbox');

function createApp({ dbFile } = {}) {
  const database = db.open(dbFile);
  const sms = createSms(database);
  const ctx = { db: database, sms, notifier: createNotifier(database, sms), domain: createDomain(database), mapbox: createMapbox(database) };
  const router = createRouter();
  require('./routes/account')(router, ctx);
  require('./routes/catalog')(router, ctx);
  require('./routes/bookings')(router, ctx);
  require('./routes/social')(router, ctx);
  require('./routes/pro')(router, ctx);
  require('./routes/admin')(router, ctx);
  const scheduler = createScheduler(ctx);
  const handler = createHandler(ctx, router, statics);
  return { handler, ctx, scheduler, close: () => database.close() };
}

// Pliki aplikacji (makieta z warstwą API), panel zespołu i strony dokumentów prawnych.
const APP_FILES = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/api.js': 'api.js' };
const LEGAL = { regulamin: 'regulamin.md', prywatnosc: 'polityka-prywatnosci.md', ranking: 'zasady-rankingu.md' };
function statics(req, res, url) {
  if (req.method !== 'GET') return false;
  const p = url.pathname;
  if (APP_FILES[p]) return serveFile(res, path.join(config.publicDir, APP_FILES[p]));
  // Biblioteka Mapbox GL JS z node_modules (bez zależności od zewnętrznego CDN)
  const gl = /^\/vendor\/(mapbox-gl\.(js|css))$/.exec(p);
  if (gl) return serveFile(res, path.join(__dirname, '..', 'node_modules', 'mapbox-gl', 'dist', gl[1]), 'public, max-age=86400');
  if (p === '/admin' || p === '/admin/') return serveFile(res, path.join(__dirname, '..', 'admin', 'index.html'));
  const inv = /^\/z\/([\w-]+)$/.exec(p);
  if (inv) { res.writeHead(302, { Location: `/?invite=${inv[1]}` }); res.end(); return true; }
  const lg = /^\/legal\/([\w-]+)$/.exec(p);
  if (lg && LEGAL[lg[1]]) {
    const md = fs.readFileSync(path.join(__dirname, '..', 'legal', LEGAL[lg[1]]), 'utf8');
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, SECURITY_HEADERS));
    res.end(legalPage(md)); return true;
  }
  return false;
}

// Minimalny konwerter Markdown → HTML dla dokumentów prawnych (nagłówki, listy, akapity, pogrubienia).
function legalPage(md) {
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '', list = false;
  for (const line of md.split('\n')) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line), li = /^\s*[-*]\s+(.*)$/.exec(line) || /^\s*\d+\.\s+(.*)$/.exec(line);
    if (!li && list) { html += '</ul>'; list = false; }
    if (h) html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(li[1])}</li>`; }
    else if (line.startsWith('> ')) html += `<p class="note">${inline(line.slice(2))}</p>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  if (list) html += '</ul>';
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lśni</title>
<style>body{margin:0;background:#F1F3F6;color:#0E1828;font:16px/1.6 system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:32px 20px}h1{font-size:30px;line-height:1.15}h2{margin-top:32px}.note{background:#FFF2C2;padding:12px 16px;border-radius:12px}@media (prefers-color-scheme:dark){body{background:#0A101C;color:#EDF1F7}.note{background:#3A3115}}</style>
</head><body><main>${html}</main></body></html>`;
}

module.exports = { createApp };
