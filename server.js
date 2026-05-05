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

console.log(
  `[startup] node=${process.version} pid=${process.pid} port=${port} hostname=${hostname} cwd=${process.cwd()}`
);

// Required env — log loudly if missing so Hostinger logs make the cause
// obvious. We DON'T process.exit on missing — /api/health still works
// without env, and it's better for the merchant to see clear errors at
// request time than a restart loop.
const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `[startup] WARNING missing env: ${missing.join(', ')} — features depending on these will fail at request time`
  );
} else {
  console.log('[startup] env=ok');
}

// Surface uncaught errors so Hostinger doesn't silently kill the process.
// Without these handlers, an unhandled rejection on Node 16+ can terminate
// the worker — and Phusion Passenger sees the worker disappear.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err);
});

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

console.log('[startup] preparing Next…');
app
  .prepare()
  .then(() => {
    console.log('[startup] Next ready');
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, (err) => {
      if (err) {
        console.error('[startup] listen error:', err);
        throw err;
      }
      console.log(
        `[startup] LISTENING http://${hostname}:${port} — แม่ค้า AI ready`
      );
    });
  })
  .catch((err) => {
    console.error('[startup] prepare failed:', err);
    process.exit(1);
  });
