// Custom Node.js server for Hostinger / Phusion Passenger / any Node host
// that needs a single JS entrypoint (not the `next start` CLI).
//
// Phusion Passenger sets `process.env.PORT`; we listen on it.
// In dev keep using `npm run dev`; this file is only for production.

const { createServer } = require('node:http');
const { parse } = require('node:url');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> PandaAdmin AI ready on http://${hostname}:${port}`);
  });
});
