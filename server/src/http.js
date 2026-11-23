'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { HttpError, sha256, localNow } = require('./util');
const { config } = require('./config');

const MAX_BODY = 8 * 1024 * 1024; // zdjęcia jako data URL

function createRouter() {
  const routes = [];
  const add = (method, pattern, opts, handler) => {
    if (typeof opts === 'function') { handler = opts; opts = {}; }
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handler, auth: opts.auth || null, raw: !!opts.raw });
  };
  const match = (method, pathname) => {
    let allowed = false;
    for (const r of routes) {
      const m = r.re.exec(pathname); if (!m) continue;
      if (r.method !== method) { allowed = true; continue; }
      const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return allowed ? { methodNotAllowed: true } : null;
  };
  return {
    get: (p, o, h) => add('GET', p, o, h), post: (p, o, h) => add('POST', p, o, h),
    patch: (p, o, h) => add('PATCH', p, o, h), del: (p, o, h) => add('DELETE', p, o, h), match
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'too_large', 'Za duże żądanie')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, data, headers = {}) {
  const body = data === undefined ? '' : JSON.stringify(data);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };

function serveFile(res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
  fs.createReadStream(file).pipe(res);
  return true;
}

function createHandler(ctx, router, statics) {
  const { db } = ctx;
  function authenticate(req) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) return null;
    const s = db.get('SELECT s.user_id, s.expires_at FROM sessions s WHERE s.token_hash = ?', sha256(token));
    if (!s || s.expires_at < new Date().toISOString()) return null;
    const user = db.get('SELECT * FROM users WHERE id = ?', s.user_id);
    if (!user) return null;
    user.tokenHash = sha256(token);
    return user;
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const origin = req.headers.origin;
    const cors = origin && config.corsOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Signature, X-Calls-Secret', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE' } : {};
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      if (!url.pathname.startsWith('/api/')) {
        if (statics(req, res, url)) return;
        return send(res, 404, { error: { code: 'not_found', message: 'Nie znaleziono' } });
      }
      const m = router.match(req.method, url.pathname);
      if (!m) throw new HttpError(404, 'not_found', 'Nie ma takiego adresu API');
      if (m.methodNotAllowed) throw new HttpError(405, 'method_not_allowed', 'Niedozwolona metoda');
      const raw = ['POST', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : Buffer.alloc(0);
      let body = {};
      if (raw.length && !m.route.raw) { try { body = JSON.parse(raw.toString('utf8')); } catch (e) { throw new HttpError(400, 'bad_json', 'Nieprawidłowy JSON'); } }
      const user = authenticate(req);
      const need = m.route.auth;
      if (need) {
        if (!user) throw new HttpError(401, 'unauthorized', 'Zaloguj się, żeby kontynuować');
        if (user.blocked) throw new HttpError(403, 'blocked', 'Konto jest zablokowane. Skontaktuj się z pomocą Lśni.');
        if (need === 'pro' && user.role !== 'pro' && user.role !== 'admin') throw new HttpError(403, 'forbidden', 'Ta funkcja jest dla wykonawców');
        if (need === 'admin' && user.role !== 'admin') throw new HttpError(403, 'forbidden', 'Tylko dla zespołu Lśni');
      }
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const out = await m.route.handler({ req, res, url, query: Object.fromEntries(url.searchParams), params: m.params, body, raw, user, ip, now: localNow() });
      if (res.writableEnded || res.headersSent) return;
      send(res, out && out.__status ? out.__status : 200, out && out.__status ? out.data : (out === undefined ? { ok: true } : out), cors);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: Object.assign({ code: e.code, message: e.message }, e.extra || {}) }, cors);
      console.error('[API] błąd', req.method, url.pathname, e);
      send(res, 500, { error: { code: 'server_error', message: 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.' } }, cors);
    }
  };
}

module.exports = { createRouter, createHandler, serveFile, send, SECURITY_HEADERS };
