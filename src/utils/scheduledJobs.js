import { initGiveawayManager, stopPolling } from './giveawayManager.js';
import { initPartyManager, stopPartyManager } from './partyManager.js';
import { initReminderManager, stopReminderManager } from './reminderManager.js';
import { initSteamDealManager, stopSteamDealManager } from './steamDealManager.js';
import { initVoiceXpManager, stopVoiceXpManager } from './voiceXpManager.js';

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

export function stopScheduledJobs() {
  stopReminderManager();
  stopPolling();
  stopPartyManager();
  stopSteamDealManager();
  stopVoiceXpManager();
  started = false;
}

export function resetScheduledJobsForTests() {
  started = false;
}
