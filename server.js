// Production entrypoint for Hostinger / LiteSpeed Node.js / any Node host.
//
// Design goals:
//   1. Bind the HTTP port BEFORE anything that can fail — Next module load,
//      Next.prepare(), env validation. LiteSpeed sees a live worker
//      immediately and never returns 503 for a missing backend.
//   2. /api/health/early is answered by THIS file (raw Node), not Next, so
//      it works even when:
//        - .next/ is missing (build didn't run)
//        - the `next` package isn't installed
//        - Next throws inside prepare()
//        - Required env vars are unset
//   3. Loud, structured startup logs so a 503 from LiteSpeed never has to
//      be debugged blind.

const http = require('node:http');
const { parse } = require('node:url');
const fs = require('node:fs');
const pathLib = require('node:path');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const startedAt = Date.now();
const cwd = process.cwd();

// ===== Startup log =====================================================
console.log('========================================');
console.log('[startup] แม่ค้า AI booting');
console.log(`[startup] node=${process.version} pid=${process.pid}`);
console.log(`[startup] cwd=${cwd}`);
console.log(`[startup] script=${process.argv[1] || '(unknown)'}`);
console.log(`[startup] PORT(env)=${process.env.PORT ?? '(unset)'}`);
console.log(`[startup] HOSTNAME(env)=${process.env.HOSTNAME ?? '(unset)'}`);
console.log(`[startup] NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`);
console.log(`[startup] resolved port=${port} hostname=${hostname}`);

// Check required env vars — log only, don't crash
const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(
    `[startup] WARNING missing env: ${missingEnv.join(', ')} — features that need these will fail at request time`,
  );
} else {
  console.log('[startup] env=ok');
}

// Check whether `next build` has produced .next/BUILD_ID
const nextBuildIdPath = pathLib.join(cwd, '.next', 'BUILD_ID');
const hasNextBuild = fs.existsSync(nextBuildIdPath);
console.log(`[startup] .next/BUILD_ID exists: ${hasNextBuild}`);
if (!hasNextBuild) {
  console.error(
    '[startup] WARNING .next/ is missing — run `npm run build` (or set NODE_ENV=production so postinstall builds automatically)',
  );
}

// Crash-safe handlers — without these, an unhandled rejection can kill
// the worker silently and LiteSpeed sees an absent backend → 503
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err);
});

// ===== Try to load Next (don't fail startup if it errors) ===============
let nextApp = null;
let nextHandler = null;
let nextLoadError = null;
let nextReady = false;
let nextPrepareError = null;

try {
  const next = require('next');
  console.log('[startup] next module loaded');
  nextApp = next({ dev: false, hostname, port });
  nextHandler = nextApp.getRequestHandler();
  console.log('[startup] next app instance created');
} catch (err) {
  nextLoadError = err;
  console.error(
    `[startup] next module load FAILED: ${err && err.message ? err.message : err}`,
  );
}

// ===== HTTP server — listen FIRST, then prepare Next ====================
const server = http.createServer((req, res) => {
  const reqUrl = req.url || '/';
  const url = parse(reqUrl, false);
  const pathname = url.pathname;

  // Raw-Node health endpoint — never touches Next, DB, or AI.
  // If this returns 200 the Node process is alive on the right port.
  if (pathname === '/api/health/early') {
    const body = {
      ok: true,
      source: 'raw-node',
      ts: Date.now(),
      pid: process.pid,
      uptime_s: Math.round(process.uptime()),
      node: process.version,
      port: port,
      port_env: process.env.PORT ?? null,
      hostname,
      cwd,
      script: process.argv[1] || null,
      node_env: process.env.NODE_ENV ?? null,
      has_next_build: hasNextBuild,
      next_module_loaded: nextLoadError === null,
      next_module_error: nextLoadError
        ? String(nextLoadError.message || nextLoadError)
        : null,
      next_ready: nextReady,
      next_prepare_error: nextPrepareError
        ? String(nextPrepareError.message || nextPrepareError)
        : null,
      env: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        supabase_service: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    };
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify(body, null, 2));
    return;
  }

  // If Next never loaded, every other path tells the operator why
  if (nextLoadError) {
    res.writeHead(503, {
      'content-type': 'text/plain; charset=utf-8',
    });
    res.end(
      `Next.js module failed to load: ${nextLoadError.message}\n` +
        `See /api/health/early for diagnostic JSON.\n`,
    );
    return;
  }

  // Next loaded but prepare hasn't resolved yet (or failed)
  if (!nextReady) {
    res.writeHead(503, {
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '5',
    });
    res.end(
      nextPrepareError
        ? `Next.js prepare failed: ${nextPrepareError.message}\nSee /api/health/early.\n`
        : 'Next.js is starting — try again in a few seconds.\nSee /api/health/early.\n',
    );
    return;
  }

  // Normal flow — hand off to Next
  try {
    nextHandler(req, res, parse(reqUrl, true));
  } catch (err) {
    console.error('[fatal] request handler threw:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.on('error', (err) => {
  console.error('[fatal] server error:', err);
});

server.listen(port, hostname, (err) => {
  if (err) {
    console.error('[startup] server.listen FAILED:', err);
    return;
  }
  console.log(
    `[startup] LISTENING http://${hostname}:${port} — ready for requests (next_ready=${nextReady})`,
  );
});

// ===== Now prepare Next (in the background) =============================
if (nextApp) {
  console.log('[startup] preparing Next…');
  nextApp
    .prepare()
    .then(() => {
      nextReady = true;
      console.log(
        `[startup] Next ready after ${Date.now() - startedAt}ms — full app online`,
      );
    })
    .catch((err) => {
      nextPrepareError = err;
      console.error(
        `[startup] Next.prepare FAILED: ${err && err.message ? err.message : err}`,
      );
      console.error(
        '[startup] /api/health/early still works — other routes will 503 until this is fixed',
      );
    });
}

// ===== Graceful shutdown ================================================
function shutdown(signal) {
  console.log(`[shutdown] received ${signal} — closing server`);
  server.close(() => {
    console.log('[shutdown] server closed cleanly');
    process.exit(0);
  });
  // Force exit after 10s if close hangs (unref so it doesn't block exit on its own)
  setTimeout(() => {
    console.error('[shutdown] forced exit after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
