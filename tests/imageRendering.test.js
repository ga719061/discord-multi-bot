import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  imageFileToDataUri,
  imageUrlToDataUri,
  svgToPngAttachment,
} from '../src/utils/imageRendering.js';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
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
