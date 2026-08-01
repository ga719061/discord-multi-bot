import http from 'http';

let activeServer = null;
let pendingStart = null;

export function startHealthServer(options = {}) {
  if (activeServer) return Promise.resolve(activeServer);
  if (pendingStart) return pendingStart;

  const {
    createServer = http.createServer,
    isReady = () => false,
    logger,
    port = process.env.PORT || 3000,
  } = options;

  const server = createServer(async (req, res) => {
    const pathname = req.url?.split('?', 1)[0];
    if (pathname === '/' || pathname === '/livez') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Bot is alive!');
      return;
    }

    if (pathname === '/readyz') {
      try {
        const ready = await isReady();
        res.writeHead(ready ? 200 : 503, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(ready ? 'Bot is ready!' : 'Bot is not ready.');
      } catch (err) {
        logger?.warn?.(`HTTP readiness check failed: ${err.message}`);
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Bot is not ready.');
      }
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found.');
  });

  let resolveStart;
  let rejectStart;
  const startPromise = new Promise((resolve, reject) => {
    resolveStart = resolve;
    rejectStart = reject;
  });
  pendingStart = startPromise;

  const onStartupError = (err) => {
    pendingStart = null;
    if (err.code === 'EADDRINUSE') {
      logger?.error?.(`HTTP health server failed to start: Port ${port} is already in use.`);
    } else {
      logger?.error?.(`HTTP health server error: ${err.message}`);
    }
    rejectStart(err);
  };

  server.once('error', onStartupError);
  try {
    server.listen(port, () => {
      server.removeListener('error', onStartupError);
      server.on('error', (err) => {
        logger?.error?.(`HTTP health server error: ${err.message}`);
      });
      activeServer = server;
      pendingStart = null;
      logger?.info?.(`HTTP health server listening on port ${port}`);
      resolveStart(server);
    });
  } catch (err) {
    server.removeListener('error', onStartupError);
    onStartupError(err);
  }

  return startPromise;
}

export async function stopHealthServer() {
  const server = activeServer;
  activeServer = null;
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

export function resetHealthServerForTests() {
  activeServer = null;
  pendingStart = null;
}
