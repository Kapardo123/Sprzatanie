'use strict';
// Zapis załączników (dokumenty do weryfikacji, zdjęcia do zgłoszeń) przesłanych jako data URL.
// Pliki nie są serwowane publicznie: odczyt tylko przez endpointy z kontrolą dostępu.
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../config');
const { newId, badRequest } = require('../util');

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const MAX_BYTES = 4 * 1024 * 1024;

function saveDataUrls(list, folder, { max = 4 } = {}) {
  if (!Array.isArray(list)) return [];
  if (list.length > max) badRequest(`Możesz dodać najwyżej ${max} plików`, 'too_many_files');
  const dir = path.join(config.dataDir, 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  return list.map(item => {
    const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(item || ''));
    if (!m || !TYPES[m[1]]) badRequest('Dozwolone są zdjęcia JPG, PNG, WebP lub PDF', 'bad_file');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BYTES) badRequest('Plik jest większy niż 4 MB', 'file_too_large');
    const name = `${newId()}.${TYPES[m[1]]}`;
    fs.writeFileSync(path.join(dir, name), buf, { mode: 0o600 });
    return { name: `${folder}/${name}`, type: m[1], size: buf.length };
  });
}

function readFile(rel) {
  const full = path.join(config.dataDir, 'uploads', rel);
  if (!full.startsWith(path.join(config.dataDir, 'uploads') + path.sep)) return null;
  return fs.existsSync(full) ? fs.readFileSync(full) : null;
}

module.exports = { saveDataUrls, readFile, TYPES };
