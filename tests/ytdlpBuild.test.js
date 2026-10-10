import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installYtdlp } from '../scripts/install-ytdlp.mjs';

const data = Buffer.from('synthetic standalone executable');
const artifact = { version: 'synthetic', url: 'https://example.test/fixture', sha256: createHash('sha256').update(data).digest('hex') };

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'gigi-ytdlp-build-'));
  const destination = join(directory, 'yt-dlp');
  const logs = [];
  const options = { artifact, destination, log: message => logs.push(message), retryDelayMs: 1,
    timeoutMs: 500, connectTimeoutMs: 100, progressIntervalMs: 5 };
  try { await run({ directory, destination, logs, options }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('verified build download streams to an executable file and reports progress and completion', async () => {
  await fixture(async ({ directory, destination, logs, options }) => {
    const body = new ReadableStream({ async start(controller) {
      controller.enqueue(data.subarray(0, 10));
      await new Promise(resolve => setTimeout(resolve, 20));
      controller.enqueue(data.subarray(10));
      controller.close();
    } });
    const bytes = await installYtdlp({ ...options, fetchImpl: async (url, request) => {
      assert.equal(url, artifact.url);
      assert.equal(request.redirect, 'follow');
      return new Response(body, { headers: { 'content-length': String(data.length) } });
    } });
    assert.equal(bytes, data.length);
    assert.deepEqual(await readFile(destination), data);
    assert.deepEqual(await readdir(directory), ['yt-dlp']);
    assert.ok(logs.some(message => message.includes('connecting')));
    assert.ok(logs.some(message => message.includes('downloading') && message.includes('%')));
    assert.ok(logs.at(-1).includes('SHA256 verified'));
  });
});

test('a stalled connection emits progress, aborts and retries only up to the configured limit', async () => {
  await fixture(async ({ directory, logs, options }) => {
    const signals = [];
    await assert.rejects(installYtdlp({ ...options, connectTimeoutMs: 25, attempts: 2,
      fetchImpl: (_url, { signal }) => { signals.push(signal); return new Promise(() => {}); },
    }), /CONNECT_TIMEOUT/);
    assert.equal(signals.length, 2);
    assert.ok(signals.every(signal => signal.aborted));
    assert.ok(logs.some(message => message.includes('connecting,') && message.includes('elapsed')));
    assert.equal(logs.filter(message => message.includes('retrying')).length, 1);
    assert.deepEqual(await readdir(directory), []);
  });
});

test('a body that stops sending bytes hits the total deadline and removes its partial file', async () => {
  await fixture(async ({ directory, logs, options }) => {
    let cancelled = false;
    const body = new ReadableStream({
      start(controller) { controller.enqueue(data.subarray(0, 10)); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(installYtdlp({ ...options, attempts: 1, timeoutMs: 30,
      fetchImpl: async () => new Response(body),
    }), /DOWNLOAD_TIMEOUT/);
    assert.equal(cancelled, true);
    assert.ok(logs.some(message => message.includes('downloading')));
    assert.deepEqual(await readdir(directory), []);
  });
});

test('transient HTTP failures retry and publish only the subsequent verified download', async () => {
  await fixture(async ({ options, destination }) => {
    let calls = 0;
    await installYtdlp({ ...options, fetchImpl: async () => ++calls === 1
      ? new Response('upstream failure', { status: 503 }) : new Response(data) });
    assert.equal(calls, 2);
    assert.deepEqual(await readFile(destination), data);
  });
});

test('the inactivity deadline interrupts a stalled body even when its total budget is longer', async () => {
  await fixture(async ({ options, directory }) => {
    let cancelled = false;
    const body = new ReadableStream({
      start(controller) { controller.enqueue(data.subarray(0, 10)); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(installYtdlp({ ...options, attempts: 1, idleTimeoutMs: 20,
      fetchImpl: async () => new Response(body),
    }), /DOWNLOAD_STALLED/);
    assert.equal(cancelled, true);
    assert.deepEqual(await readdir(directory), []);
  });
});

test('checksum failure and oversize responses preserve an existing executable and leave no partial files', async () => {
  for (const scenario of ['checksum', 'header', 'stream']) {
    await fixture(async ({ options, directory, destination, logs }) => {
      await writeFile(destination, 'previous verified executable');
      let calls = 0;
      await assert.rejects(installYtdlp({ ...options, maxBytes: 32, fetchImpl: async () => {
        calls++;
        return scenario === 'checksum' ? new Response('modified binary')
          : scenario === 'header' ? new Response('x', { headers: { 'content-length': '33' } })
            : new Response(Buffer.alloc(33));
      } }), scenario === 'checksum' ? /CHECKSUM_MISMATCH/ : /SIZE_LIMIT/);
      assert.equal(calls, 1);
      assert.equal(await readFile(destination, 'utf8'), 'previous verified executable');
      assert.deepEqual(await readdir(directory), ['yt-dlp']);
      assert.ok(!logs.some(message => message.includes('SHA256 verified')));
    });
  }
});

test('a missing pinned release fails immediately without echoing upstream response content', async () => {
  await fixture(async ({ options, logs }) => {
    let calls = 0;
    await assert.rejects(installYtdlp({ ...options, fetchImpl: async () => {
      calls++;
      return new Response('raw upstream credentials=hidden', { status: 404 });
    } }), /HTTP_404/);
    assert.equal(calls, 1);
    assert.doesNotMatch(logs.join('\n'), /credentials|hidden|raw upstream/);
  });
});
