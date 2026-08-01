import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  imageFileToDataUri,
  imageUrlToDataUri,
  svgToPngAttachment,
  fetchWithLimit,
} from '../src/utils/imageRendering.js';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==',
  'base64'
);

test('svgToPngAttachment returns a named PNG buffer', async () => {
  const card = await svgToPngAttachment(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#fff"/></svg>',
    'card.png'
  );

  assert.equal(card.filename, 'card.png');
  assert.equal(card.attachment.name, 'card.png');
  assert.equal(card.buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('imageFileToDataUri reads existing assets without modifying them', async () => {
  const assetPath = path.join(process.cwd(), 'assets', 'king-chihuahua.png');
  const before = await fs.stat(assetPath);
  const dataUri = await imageFileToDataUri(assetPath, {
    width: 64,
    height: 64,
    fit: 'cover',
    withoutEnlargement: false,
  });
  const after = await fs.stat(assetPath);

  assert.match(dataUri, /^data:image\/png;base64,/);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.size, before.size);
});

test('imageUrlToDataUri returns null for failed remote assets and caches successful loads', async () => {
  const cache = new Map();
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (String(url).includes('missing')) return new Response('', { status: 404 });
    return new Response(tinyPng, { status: 200, headers: { 'content-type': 'image/png' } });
  };

  assert.equal(await imageUrlToDataUri('https://assets.test/missing.png', fetchImpl, { cache }), null);

  const first = await imageUrlToDataUri('https://assets.test/card.png', fetchImpl, { cache, width: 16, height: 16 });
  const second = await imageUrlToDataUri('https://assets.test/card.png', fetchImpl, { cache, width: 16, height: 16 });

  assert.match(first, /^data:image\/png;base64,/);
  assert.equal(second, first);
  assert.equal(calls, 2);
});

test('fetchWithLimit downloads within size limits', async () => {
  const fetchImpl = async () => new Response('hello world');
  const response = await fetchWithLimit('http://test', fetchImpl, { maxBytes: 20 });
  const text = new TextDecoder().decode(await response.arrayBuffer());
  assert.equal(text, 'hello world');
});

test('fetchWithLimit throws error if content-length exceeds maxBytes', async () => {
  const fetchImpl = async () => new Response('large file', {
    headers: { 'content-length': '100' }
  });
  await assert.rejects(
    fetchWithLimit('http://test', fetchImpl, { maxBytes: 20 }),
    /File size limit exceeded/
  );
});

test('fetchWithLimit throws error if stream chunks exceed maxBytes', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.enqueue(new Uint8Array([4, 5, 6]));
      controller.close();
    }
  });
  const fetchImpl = async () => new Response(stream);
  await assert.rejects(
    fetchWithLimit('http://test', fetchImpl, { maxBytes: 4 }),
    /File size limit exceeded during stream download/
  );
});

test('fetchWithLimit fallback to arrayBuffer throws if size exceeds maxBytes', async () => {
  const response = new Response('large fallback');
  Object.defineProperty(response, 'body', { value: null });
  const fetchImpl = async () => response;
  await assert.rejects(
    fetchWithLimit('http://test', fetchImpl, { maxBytes: 5 }),
    /File size limit exceeded after arrayBuffer download/
  );
});

test('fetchWithLimit handles timeout abort', async () => {
  const fetchImpl = () => new Promise((resolve) => setTimeout(resolve, 100));
  await assert.rejects(
    fetchWithLimit('http://test', fetchImpl, { timeoutMs: 10 }),
    /Download timed out or aborted/
  );
});
