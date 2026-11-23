'use strict';
const http = require('node:http');
const { config, assertProductionConfig } = require('./config');
const { createApp } = require('./app');
const { seed } = require('./seed');

assertProductionConfig();
const app = createApp();
if (!config.isProd && seed(app.ctx.db)) console.log('Wgrano dane startowe (konta: Kasia 500 100 200, Ola 500 100 300, zespół 500 100 999).');

const server = http.createServer(app.handler);
server.listen(config.port, () => {
  console.log(`Lśni działa na http://localhost:${config.port}`);
  console.log(`Panel zespołu: http://localhost:${config.port}/admin`);
  if (!config.isProd) console.log('Tryb deweloperski: kody SMS są wypisywane w konsoli i zwracane przez API.');
});

// W trybie demo zadania w tle chodzą częściej, żeby symulowani wykonawcy reagowali od razu.
const every = config.simulateProviders && !config.isProd ? 2500 : config.schedulerIntervalMs;
const timer = setInterval(() => { try { app.scheduler.tick(); } catch (e) { console.error('[scheduler]', e); } }, every);

function shutdown() { clearInterval(timer); server.close(() => { app.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
