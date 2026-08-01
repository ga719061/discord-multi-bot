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
