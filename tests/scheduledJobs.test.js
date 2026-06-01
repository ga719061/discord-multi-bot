import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetScheduledJobsForTests, startScheduledJobs } from '../src/utils/scheduledJobs.js';

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
