import http from 'http';

let activeServer = null;

export function startHealthServer(options = {}) {
  if (activeServer) return activeServer;

  const {
    createServer = http.createServer,
    logger,
    port = process.env.PORT || 3000,
  } = options;

  activeServer = createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
  });

  activeServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger?.error?.(`HTTP health server failed to start: Port ${port} is already in use.`);
    } else {
      logger?.error?.(`HTTP health server error: ${err.message}`);
    }
  });

  activeServer.listen(port, () => {
    logger?.info?.(`HTTP health server listening on port ${port}`);
  });

  return activeServer;
}

export function stopHealthServer() {
  if (activeServer) {
    activeServer.close();
    activeServer = null;
  }
}

export function resetHealthServerForTests() {
  activeServer = null;
}
