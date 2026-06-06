import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJobOverlapGuard } from '../src/utils/jobGuards.js';
import { resetScheduledJobsForTests, startScheduledJobs, stopScheduledJobs } from '../src/utils/scheduledJobs.js';

test('startScheduledJobs starts each job once and ignores duplicate starts', () => {
  resetScheduledJobsForTests();

  const started = [];
  const client = { id: 'client' };
  const jobs = [
    (value) => started.push(['reminder', value]),
    (value) => started.push(['giveaway', value]),
  ];

  assert.equal(startScheduledJobs(client, jobs), true);
  assert.equal(startScheduledJobs(client, jobs), false);
  assert.deepEqual(started, [
    ['reminder', client],
    ['giveaway', client],
  ]);
});

test('stopScheduledJobs resets started status allowing a restart', () => {
  resetScheduledJobsForTests();
  const client = { id: 'client' };
  const jobs = [
    () => {},
    () => {},
  ];

  assert.equal(startScheduledJobs(client, jobs), true);
  assert.equal(startScheduledJobs(client, jobs), false);

  stopScheduledJobs();

  assert.equal(startScheduledJobs(client, jobs), true);
});

test('job overlap guard skips a tick while the previous run is still active', async () => {
  let release;
  let runs = 0;
  const debugLogs = [];
  const guarded = createJobOverlapGuard('TestJob', async () => {
    runs += 1;
    await new Promise((resolve) => {
      release = resolve;
    });
  }, { debug: (message) => debugLogs.push(message) });

  const first = guarded();
  const second = await guarded();

  assert.equal(second, false);
  assert.equal(runs, 1);
  assert.equal(debugLogs.length, 1);

  release();
  assert.equal(await first, true);

  const third = guarded();
  release();
  assert.equal(await third, true);
  assert.equal(runs, 2);
});
