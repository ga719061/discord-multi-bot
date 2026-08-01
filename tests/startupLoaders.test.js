import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadCommands } from '../src/handlers/commandHandler.js';
import { loadEvents, stopLoadedEvents } from '../src/handlers/eventHandler.js';

async function createLoaderTree(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'discord-bot-loader-'));
  const category = path.join(root, 'test');
  await mkdir(category);
  await Promise.all(files.map((file) => writeFile(path.join(category, file), '')));
  return root;
}

test('command loader aggregates import failures after loading valid commands', async () => {
  const commandsDir = await createLoaderTree(['good.js', 'broken.js']);
  const commands = new Map();
  const importFailure = new Error('invalid command module');

  try {
    await assert.rejects(
      loadCommands({ commands }, {
        commandsDir,
        importModule: async (filePath) => {
          if (filePath.endsWith('/broken.js')) throw importFailure;
          return { data: { name: '測試' }, execute() {} };
        },
      }),
      (error) => {
        assert.equal(error instanceof AggregateError, true);
        assert.equal(error.errors.length, 1);
        assert.equal(error.errors[0].cause, importFailure);
        return true;
      }
    );
    assert.equal(commands.has('測試'), true);
  } finally {
    await rm(commandsDir, { recursive: true, force: true });
  }
});

test('event loader aggregates register failures after registering valid events', async () => {
  await stopLoadedEvents();
  const eventsDir = await createLoaderTree(['good.js', 'broken.js']);
  const registrations = [];
  const registerFailure = new Error('event registration failed');

  try {
    await assert.rejects(
      loadEvents({}, {
        eventsDir,
        importModule: async (filePath) => ({
          register() {
            if (filePath.endsWith('/broken.js')) throw registerFailure;
            registrations.push(filePath);
          },
        }),
      }),
      (error) => {
        assert.equal(error instanceof AggregateError, true);
        assert.equal(error.errors.length, 1);
        assert.equal(error.errors[0].cause, registerFailure);
        return true;
      }
    );
    assert.equal(registrations.length, 1);
  } finally {
    await stopLoadedEvents();
    await rm(eventsDir, { recursive: true, force: true });
  }
});
