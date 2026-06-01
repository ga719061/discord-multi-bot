import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetHealthServerForTests, startHealthServer } from '../src/utils/healthServer.js';

test('startHealthServer starts once and responds to health requests', () => {
  resetHealthServerForTests();

  const logs = [];
  const responses = [];
  const server = {
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
