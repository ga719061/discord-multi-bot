import { handleMusicInteraction, handleMusicVoiceState, stopMusicPlayback } from '../commands/music/music.js';

let activeClient = null;

export function register(client) {
  if (activeClient) return;
  activeClient = client;
  client.on('interactionCreate', handleMusicInteraction);
  client.on('voiceStateUpdate', handleMusicVoiceState);
}

export async function stop() {
  activeClient?.off('interactionCreate', handleMusicInteraction);
  activeClient?.off('voiceStateUpdate', handleMusicVoiceState);
  activeClient = null;
  await stopMusicPlayback();
}
