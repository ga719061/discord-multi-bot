import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const dockerfileUrl = new URL('../Dockerfile', import.meta.url);
const composeUrl = new URL('../docker-compose.yml', import.meta.url);
const entrypointUrl = new URL('../docker-entrypoint.sh', import.meta.url);

test('Docker entrypoint repairs mounted data ownership before running as node', async () => {
  const [dockerfile, compose, entrypoint] = await Promise.all([
    readFile(dockerfileUrl, 'utf8'),
    readFile(composeUrl, 'utf8'),
    readFile(entrypointUrl, 'utf8'),
  ]);

  assert.match(dockerfile, /\bgosu\b/);
  assert.match(dockerfile, /ENTRYPOINT \["docker-entrypoint"\]/);
  assert.match(dockerfile, /-c:a libopus/);
  assert.match(dockerfile, /-page_duration 20000 -flush_packets 1/);
  assert.match(compose, /^\s+user: ["']0:0["']$/m);
  assert.match(entrypoint, /chown -R node:node "\$directory"/);
  assert.match(entrypoint, /chmod -R u\+rwX "\$directory"/);
  assert.match(entrypoint, /gosu node test -w "\$path"/);
  assert.match(entrypoint, /verify_node_writable \/app\/data\/bot\.db/);
  assert.match(entrypoint, /Volume permissions prepared; starting bot as node/);
  assert.match(entrypoint, /exec gosu node "\$@"/);

  const entrypointPosition = dockerfile.indexOf('ENTRYPOINT ["docker-entrypoint"]');
  assert.ok(entrypointPosition > 0);
  assert.doesNotMatch(dockerfile.slice(0, entrypointPosition), /^USER node$/m);
});

test('Docker pins and verifies the standalone YouTube tool without another runtime', async () => {
  const dockerfile = await readFile(dockerfileUrl, 'utf8');
  const installer = await readFile(new URL('../scripts/install-ytdlp.mjs', import.meta.url), 'utf8');
  assert.match(dockerfile, /FROM node:24-slim AS youtube-tool/);
  assert.match(dockerfile, /COPY scripts\/install-ytdlp\.mjs \/tmp\/install-ytdlp\.mjs/);
  assert.match(dockerfile, /RUN node \/tmp\/install-ytdlp\.mjs/);
  assert.match(installer, /https:\/\/github\.com\/yt-dlp\/yt-dlp\/releases\/download\/2026\.08\.19\/yt-dlp_linux/);
  assert.match(installer, /createHash\('sha256'\)/);
  assert.match(installer, /58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a/);
  assert.match(dockerfile, /COPY --from=youtube-tool \/usr\/local\/bin\/yt-dlp \/usr\/local\/bin\/yt-dlp/);
  assert.match(dockerfile, /RUN test "\$\(yt-dlp --version\)" = "2026\.08\.19"/);
  const runtime = dockerfile.slice(dockerfile.lastIndexOf('FROM node:24-slim'));
  assert.doesNotMatch(runtime, /\b(?:curl|python3|deno|bun|build-essential)\b/);
  assert.doesNotMatch(dockerfile + installer, /releases\/latest|yt-dlp -U|--update/);
});
