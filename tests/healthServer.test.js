import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { resetHealthServerForTests, startHealthServer, stopHealthServer } from '../src/utils/healthServer.js';

function createFakeServer({ listenError } = {}) {
  const server = new EventEmitter();
  server.closed = false;
  server.listen = function listen(port, onListen) {
    this.port = port;
    if (listenError) queueMicrotask(() => this.emit('error', listenError));
    else onListen();
    return this;
  };
  server.close = function close(onClose) {
    this.closed = true;
    onClose?.();
  };
  return server;
}

function invoke(handler, url) {
  return new Promise((resolve) => {
    const response = { status: null, headers: null, body: null };
    handler({ url }, {
      writeHead(status, headers) {
        response.status = status;
        response.headers = headers;
      },
      end(body) {
        response.body = body;
        resolve(response);
      },
    });
  });
}

test('health server starts once and exposes liveness and readiness separately', async () => {
  resetHealthServerForTests();
  const logs = [];
  const server = createFakeServer();
  let handler;
  let createCount = 0;
  const createServer = (requestHandler) => {
    createCount += 1;
    handler = requestHandler;
    return server;
  };

  const first = await startHealthServer({
    createServer,
    isReady: () => true,
    logger: { info: (message) => logs.push(message) },
    port: 4321,
  });
  const second = await startHealthServer({ createServer, port: 1234 });

  assert.equal(second, first);
  assert.equal(createCount, 1);
  assert.equal(first.port, 4321);
  assert.deepEqual(await invoke(handler, '/livez'), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: 'Bot is alive!',
  });
  assert.equal((await invoke(handler, '/readyz')).status, 200);
  assert.equal((await invoke(handler, '/')).status, 200);
  assert.equal((await invoke(handler, '/unknown')).status, 404);
  assert.deepEqual(logs, ['HTTP health server listening on port 4321']);
  await stopHealthServer();
});

test('readiness returns 503 when callback reports not ready', async () => {
  resetHealthServerForTests();
  const server = createFakeServer();
  let handler;
  await startHealthServer({
    createServer: (requestHandler) => {
      handler = requestHandler;
      return server;
    },
    isReady: () => false,
  });

  const response = await invoke(handler, '/readyz');
  assert.equal(response.status, 503);
  assert.equal(response.body, 'Bot is not ready.');
  await stopHealthServer();
});

test('readiness returns 503 when callback throws', async () => {
  resetHealthServerForTests();
  const warnings = [];
  const server = createFakeServer();
  let handler;
  await startHealthServer({
    createServer: (requestHandler) => {
      handler = requestHandler;
      return server;
    },
    isReady: () => { throw new Error('database unavailable'); },
    logger: { warn: (message) => warnings.push(message) },
  });

  const response = await invoke(handler, '/readyz');
  assert.equal(response.status, 503);
  assert.equal(response.body, 'Bot is not ready.');
  assert.match(warnings[0], /database unavailable/);
  await stopHealthServer();
});

test('stopHealthServer closes active server', async () => {
  resetHealthServerForTests();
  const server = createFakeServer();
  await startHealthServer({ createServer: () => server });
  await stopHealthServer();
  assert.equal(server.closed, true);
});

test('EADDRINUSE rejects startup and clears state for a retry', async () => {
  resetHealthServerForTests();
  const logs = [];
  const addressError = Object.assign(new Error('address in use'), { code: 'EADDRINUSE' });
  const failedServer = createFakeServer({ listenError: addressError });

  await assert.rejects(
    startHealthServer({
      createServer: () => failedServer,
      logger: { error: (message) => logs.push(message) },
      port: 3000,
    }),
    { code: 'EADDRINUSE' }
  );
  assert.match(logs[0], /failed to start: Port 3000 is already in use/);

  const retryServer = createFakeServer();
  assert.equal(await startHealthServer({ createServer: () => retryServer }), retryServer);
  await stopHealthServer();
});
