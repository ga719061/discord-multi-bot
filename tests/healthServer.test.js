import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetHealthServerForTests, startHealthServer, stopHealthServer } from '../src/utils/healthServer.js';

test('startHealthServer starts once and responds to health requests', () => {
  resetHealthServerForTests();

  const logs = [];
  const responses = [];
  const server = {
    on() { return this; },
    listen(port, onListen) {
      this.port = port;
      onListen();
      return this;
    },
  };

  const createServer = (handler) => {
    server.handler = handler;
    return server;
  };

  const first = startHealthServer({
    createServer,
    logger: { info: (message) => logs.push(message) },
    port: 4321,
  });
  const second = startHealthServer({ createServer, port: 1234 });

  first.handler({}, {
    writeHead: (status) => responses.push(['status', status]),
    end: (body) => responses.push(['body', body]),
  });

  assert.equal(second, first);
  assert.equal(first.port, 4321);
  assert.deepEqual(responses, [['status', 200], ['body', 'Bot is alive!']]);
  assert.deepEqual(logs, ['HTTP health server listening on port 4321']);
});

test('stopHealthServer closes active server', () => {
  resetHealthServerForTests();
  const server = {
    closed: false,
    on() { return this; },
    listen(port, onListen) { onListen(); return this; },
    close() { this.closed = true; }
  };
  startHealthServer({
    createServer: () => server,
    logger: { info: () => {} }
  });
  stopHealthServer();
  assert.equal(server.closed, true);
});

test('healthServer handles EADDRINUSE error gracefully', () => {
  resetHealthServerForTests();
  const logs = [];
  const server = {
    events: {},
    on(event, cb) {
      this.events[event] = cb;
      return this;
    },
    listen(port, onListen) { return this; }
  };
  startHealthServer({
    createServer: () => server,
    logger: {
      error: (msg) => logs.push(msg)
    },
    port: 3000
  });

  server.events['error']({ code: 'EADDRINUSE' });

  assert.equal(logs.length, 1);
  assert.match(logs[0], /failed to start: Port 3000 is already in use/);
});
