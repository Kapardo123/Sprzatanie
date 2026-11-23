'use strict';
// Warstwa bazy danych: SQLite wbudowany w Node.js (node:sqlite). Cały SQL aplikacji przechodzi przez ten moduł,
// więc przejście na PostgreSQL oznacza podmianę tego pliku i drobne różnice w składni.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('./config');

const SCHEMA = [
  // 1: model podstawowy
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','pro','admin')),
    blocked INTEGER NOT NULL DEFAULT 0,
    noshow_count INTEGER NOT NULL DEFAULT 0,
    late_cancel_count INTEGER NOT NULL DEFAULT 0,
    pref_push INTEGER NOT NULL DEFAULT 1,
    pref_sms INTEGER NOT NULL DEFAULT 1,
    pref_email INTEGER NOT NULL DEFAULT 0,
    simulated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE otp_codes (
    phone TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    label TEXT NOT NULL,
    street TEXT NOT NULL,
    lat REAL NOT NULL, lng REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE providers (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    initials TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 't-blue',
    kind TEXT NOT NULL DEFAULT 'Osoba prywatna',
    tagline TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    services TEXT NOT NULL DEFAULT '[]',
    langs TEXT NOT NULL DEFAULT '["PL"]',
    rate_gr INTEGER NOT NULL,
    min_hours REAL NOT NULL DEFAULT 3,
    fixed_price INTEGER NOT NULL DEFAULT 0,
    per_window_gr INTEGER NOT NULL DEFAULT 0,
    base_lat REAL NOT NULL, base_lng REAL NOT NULL,
    radius_km REAL NOT NULL DEFAULT 6,
    fee_gr INTEGER NOT NULL DEFAULT 0,
    supplies INTEGER NOT NULL DEFAULT 1, eco INTEGER NOT NULL DEFAULT 0, pets INTEGER NOT NULL DEFAULT 1,
    invoice INTEGER NOT NULL DEFAULT 0, insured INTEGER NOT NULL DEFAULT 0,
    id_status TEXT NOT NULL DEFAULT 'none' CHECK (id_status IN ('none','pending','verified','rejected')),
    insurance_status TEXT NOT NULL DEFAULT 'none' CHECK (insurance_status IN ('none','pending','verified','rejected')),
    rating_sum INTEGER NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    jobs_done INTEGER NOT NULL DEFAULT 0,
    response_min INTEGER NOT NULL DEFAULT 15,
    since INTEGER NOT NULL DEFAULT 2024,
    super INTEGER NOT NULL DEFAULT 0,
    invite_code TEXT UNIQUE NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    online INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE availability (
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_hour INTEGER NOT NULL DEFAULT 8,
    end_hour INTEGER NOT NULL DEFAULT 18,
    PRIMARY KEY (provider_id, weekday)
  );
  CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    service TEXT NOT NULL,
    m2 INTEGER NOT NULL DEFAULT 0, rooms INTEGER NOT NULL DEFAULT 0, baths INTEGER NOT NULL DEFAULT 1,
    extras TEXT NOT NULL DEFAULT '[]',
    freq TEXT NOT NULL DEFAULT 'once' CHECK (freq IN ('once','week','biweek','month')),
    starts_at TEXT NOT NULL,
    hours REAL NOT NULL,
    price_gr INTEGER NOT NULL,
    travel_fee_gr INTEGER NOT NULL DEFAULT 0,
    pay_method TEXT NOT NULL DEFAULT 'cash',
    address_id TEXT, address_text TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    onsite_name TEXT NOT NULL DEFAULT '', onsite_phone TEXT NOT NULL DEFAULT '',
    entry TEXT NOT NULL DEFAULT 'home', door_code TEXT NOT NULL DEFAULT '', pets TEXT NOT NULL DEFAULT 'none', note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','enroute','progress','done','cancelled','declined','noshow')),
    via_promo INTEGER NOT NULL DEFAULT 0,
    invited_by TEXT,
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    cancel_reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX bookings_client ON bookings(client_id, starts_at);
  CREATE INDEX bookings_provider ON bookings(provider_id, starts_at);
  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    flagged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX messages_thread ON messages(client_id, provider_id, created_at);
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    read_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX notifications_user ON notifications(user_id, created_at);
  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    reporter_id TEXT NOT NULL REFERENCES users(id),
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    want TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','resolved','escalated')),
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, answered_at TEXT, resolved_at TEXT
  );
  CREATE TABLE noshows (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
    provider_id TEXT NOT NULL, client_id TEXT NOT NULL,
    distance_m INTEGER,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','accepted','rejected')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
    client_id TEXT NOT NULL, provider_id TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    tags TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','hidden')),
    flag_reason TEXT NOT NULL DEFAULT '',
    reply TEXT NOT NULL DEFAULT '',
    reply_status TEXT NOT NULL DEFAULT 'none' CHECK (reply_status IN ('none','published','pending','hidden')),
    reply_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX reviews_provider ON reviews(provider_id, created_at);
  CREATE TABLE verifications (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    kind TEXT NOT NULL CHECK (kind IN ('id','insurance')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
    files TEXT NOT NULL DEFAULT '[]',
    external_ref TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    decided_by TEXT,
    created_at TEXT NOT NULL, decided_at TEXT
  );
  CREATE TABLE credit_ledger (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    amount_gr INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE boosts (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    district TEXT NOT NULL,
    days INTEGER NOT NULL,
    price_gr INTEGER NOT NULL,
    paid_credit_gr INTEGER NOT NULL,
    paid_extra_gr INTEGER NOT NULL DEFAULT 0,
    guaranteed_views INTEGER NOT NULL,
    views INTEGER NOT NULL DEFAULT 0, opens INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
    settled INTEGER NOT NULL DEFAULT 0,
    refunded_gr INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX boosts_active ON boosts(district, ends_at);
  CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(user_id),
    client_id TEXT NOT NULL REFERENCES users(id),
    credited INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (provider_id, client_id)
  );
  CREATE TABLE waitlist (
    id TEXT PRIMARY KEY,
    user_id TEXT, phone TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL, lng REAL NOT NULL, area TEXT NOT NULL,
    notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE call_sessions (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    caller_id TEXT NOT NULL,
    callee_phone TEXT NOT NULL,
    proxy_number TEXT NOT NULL,
    pin TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE TABLE search_log (
    district TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX search_log_d ON search_log(district, created_at);
  CREATE TABLE sms_log (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    body TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // 2: pamięć podręczna odpowiedzi Mapbox (geokodowanie, trasy, czasy dojazdu)
  `
  CREATE TABLE geo_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  `
];

function open(file) {
  let target = file || config.dbFile;
  if (!target) { fs.mkdirSync(config.dataDir, { recursive: true }); target = path.join(config.dataDir, 'lsni.db'); }
  const db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  migrate(db);
  return wrap(db);
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = db.prepare('SELECT v FROM schema_version').get();
  let v = row ? row.v : 0;
  if (!row) db.prepare('INSERT INTO schema_version (v) VALUES (0)').run();
  for (; v < SCHEMA.length; v++) {
    db.exec('BEGIN');
    try { db.exec(SCHEMA[v]); db.prepare('UPDATE schema_version SET v = ?').run(v + 1); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}

// Cienka nakładka: krótsze wywołania i transakcje.
function wrap(db) {
  const cache = new Map();
  const stmt = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const clean = row => row ? Object.assign({}, row) : row;
  return {
    raw: db,
    get: (sql, ...p) => clean(stmt(sql).get(...p)),
    all: (sql, ...p) => stmt(sql).all(...p).map(clean),
    run: (sql, ...p) => stmt(sql).run(...p),
    exec: sql => db.exec(sql),
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close()
  };
}

module.exports = { open };
