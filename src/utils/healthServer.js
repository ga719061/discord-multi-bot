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
  }).listen(port, () => {
    logger?.info?.(`HTTP health server listening on port ${port}`);
  });

  return activeServer;
}

export function resetHealthServerForTests() {
  activeServer = null;
}
