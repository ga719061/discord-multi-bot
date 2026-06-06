import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDatabaseForTests, initDatabase } from '../../src/utils/database.js';

let activeTempDir = null;

export function initTestDatabase(label = 'db') {
  cleanupTestDatabase();
  activeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), `gigi-${label}-`));
  const dbPath = path.join(activeTempDir, 'bot.db');
  initDatabase({ dbPath });
  return { dbPath, dir: activeTempDir };
}

export function cleanupTestDatabase() {
  closeDatabaseForTests();
  if (activeTempDir) {
    fs.rmSync(activeTempDir, { recursive: true, force: true });
    activeTempDir = null;
  }
}
