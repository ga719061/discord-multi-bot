import { initGiveawayManager } from './giveawayManager.js';
import { initPartyManager } from './partyManager.js';
import { initReminderManager } from './reminderManager.js';
import { initSteamDealManager } from './steamDealManager.js';
import { initVoiceXpManager } from './voiceXpManager.js';

const defaultJobs = [
  initReminderManager,
  initGiveawayManager,
  initPartyManager,
  initSteamDealManager,
  initVoiceXpManager,
];

let started = false;

export function startScheduledJobs(client, jobs = defaultJobs) {
  if (started) return false;

  for (const startJob of jobs) {
    startJob(client);
  }

  started = true;
  return true;
}

export function resetScheduledJobsForTests() {
  started = false;
}
