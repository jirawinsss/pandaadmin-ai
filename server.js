// Custom Node.js server for Hostinger / Phusion Passenger / any Node host
// that needs a single JS entrypoint (not the `next start` CLI).
//
// Phusion Passenger sets `process.env.PORT`; we listen on it.
// In dev keep using `npm run dev`; this file is only for production.
//
// Important: the HTTP server starts listening BEFORE next.prepare() resolves
// so Phusion sees a live worker right away. /api/health/early is handled
// directly by Node, bypassing Next entirely — useful when something inside
// Next is broken (missing .next/, env error, module crash) and you need to
// confirm the process itself is up.

const { createServer } = require('node:http');
const { parse } = require('node:url');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const startedAt = Date.now();

console.log(
  `[startup] node=${process.version} pid=${process.pid} port=${port} hostname=${hostname} cwd=${process.cwd()}`,
);

const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(
    `[startup] WARNING missing env: ${missingEnv.join(', ')} — features depending on these will fail at request time`,
  );
} else {
  console.log('[startup] env=ok');
}

// Surface uncaught errors so Hostinger logs make the cause obvious.
// Without these, an unhandled rejection on Node 16+ silently terminates
// the worker and Phusion shows it as 503.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err);
});

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

let nextReady = false;
let nextError = null;

console.log('[startup] preparing Next…');
app
  .prepare()
  .then(() => {
    nextReady = true;
    console.log(
      `[startup] Next ready after ${Date.now() - startedAt}ms`,
    );
  })
  .catch((err) => {
    nextError = err;
    console.error('[startup] prepare failed:', err);
  });

// Start listening IMMEDIATELY — don't wait for Next.prepare().
// While Next is starting, /api/health/early responds; everything else
// returns 503 with Retry-After so Phusion clients back off.
const server = createServer((req, res) => {
  // Bypass Next for the early health check — works even if Next never
  // managed to prepare()
  if (req.url === '/api/health/early') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(
      JSON.stringify({
        ok: true,
        ts: Date.now(),
        pid: process.pid,
        uptime_s: Math.round(process.uptime()),
        node: process.version,
        next_ready: nextReady,
        next_error: nextError ? String(nextError.message || nextError) : null,
        env: {
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          supabase_service: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        },
      }),
    );
    return;
  }

  if (!nextReady) {
    res.writeHead(503, {
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '5',
    });
    res.end(
      nextError
        ? 'Next.js failed to start — check /api/health/early for details'
        : 'Next.js is starting — try again in a few seconds',
    );
    return;
  }

  try {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  } catch (err) {
    console.error('[fatal] request handler threw:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.listen(port, hostname, (err) => {
  if (err) {
    console.error('[startup] listen error:', err);
    throw err;
  }
  console.log(
    `[startup] LISTENING http://${hostname}:${port} — accepting requests (next_ready=${nextReady})`,
  );
});

// Graceful shutdown — Phusion may send SIGTERM during deploy
function shutdown(signal) {
  console.log(`[shutdown] received ${signal} — closing server`);
  server.close(() => {
    console.log('[shutdown] server closed');
    process.exit(0);
  });
  // Force exit after 10s if close hangs
  setTimeout(() => {
    console.error('[shutdown] forced exit after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
