import {
  handleMusicInteraction, handleMusicVoiceState, handleMusicMessageDelete,
  handleMusicMessageDeleteBulk, stopMusicPlayback,
} from '../commands/music/music.js';

let activeClient = null;

export function register(client) {
  if (activeClient) return;
  activeClient = client;
  client.on('interactionCreate', handleMusicInteraction);
  client.on('voiceStateUpdate', handleMusicVoiceState);
  client.on('messageDelete', handleMusicMessageDelete);
  client.on('messageDeleteBulk', handleMusicMessageDeleteBulk);
}

export async function stop() {
  activeClient?.off('interactionCreate', handleMusicInteraction);
  activeClient?.off('voiceStateUpdate', handleMusicVoiceState);
  activeClient?.off('messageDelete', handleMusicMessageDelete);
  activeClient?.off('messageDeleteBulk', handleMusicMessageDeleteBulk);
  activeClient = null;
  await stopMusicPlayback();
}
