import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { buildSteamSearchModal, buildSteamSearchResultPayload, buildSteamSelectionPayload, data } from '../src/commands/steam/steam.js';

const details = {
  name: 'Royal Game',
  short_description: 'A royal discount.',
  header_image: 'https://cdn.example.test/royal.jpg',
  price_overview: {
    discount_percent: 60,
    final_formatted: 'NT$ 200',
  },
  release_date: { date: '2026 年 5 月 27 日' },
  metacritic: { score: 88 },
};

function serialize(payload) {
  return JSON.stringify(payload.components.map((component) => component.toJSON()));
}

test('/特價查詢 opens a direct royal search modal without legacy slash parameters', () => {
  const command = data.toJSON();
  const modalJson = buildSteamSearchModal('session').toJSON();
  const modal = JSON.stringify(modalJson);
  const textDisplay = modalJson.components.find((component) => component.type === ComponentType.TextDisplay);
  const textInputs = modalJson.components
    .filter((component) => component.type === ComponentType.ActionRow)
    .flatMap((row) => row.components)
    .filter((component) => component.type === ComponentType.TextInput);

  assert.equal(command.options?.length ?? 0, 0);
  assert.match(command.description, /皇家採購/);
  assert.match(modal, /game_name/);
  assert.match(modal, /功能說明/);
  assert.match(modal, /候選清單/);
  assert.match(modal, /台灣價格/);
  assert.match(modal, /Stardew Valley/);
  assert.equal(modal.includes('feature_note'), false);
  assert.equal(textDisplay.content.includes('功能說明'), true);
  assert.equal(textInputs.length, 1);
  assert.equal(textInputs[0].custom_id, 'game_name');
});

test('Steam keyword search offers a private candidate game selector before showing details', () => {
  const payload = buildSteamSelectionPayload('session', 'Royal', [
    { id: 42, name: 'Royal Game' },
    { id: 43, name: 'Royal Game Deluxe' },
  ]);
  const text = serialize(payload);

  assert.equal((payload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.match(text, /皇家採購搜尋結果/);
  assert.match(text, /Royal Game/);
  assert.match(text, /Royal Game Deluxe/);
  assert.match(text, /steam_search:session:select/);
});

test('Steam result is private until the owner publishes it once', () => {
  const privatePayload = buildSteamSearchResultPayload(42, details, {
    ephemeral: true,
    publishCustomId: 'steam_search:session:publish',
  });
  const publishedPayload = buildSteamSearchResultPayload(42, details, {
    ephemeral: true,
    publishCustomId: 'steam_search:session:publish',
    published: true,
  });
  const publicPayload = buildSteamSearchResultPayload(42, details);
  const publicCard = serialize(publicPayload);

  assert.equal((privatePayload.flags & MessageFlags.Ephemeral) !== 0, true);
  assert.equal(publicCard.includes('](https://store.steampowered.com'), false);
  assert.match(publicCard, /"url":"https:\/\/store\.steampowered\.com\/app\/42\/"/);
  assert.match(serialize(privatePayload), /皇家採購廳/);
  assert.match(serialize(privatePayload), /頒布至目前頻道/);
  assert.match(serialize(publishedPayload), /情報已頒布/);
  assert.equal(serialize(publicPayload).includes('頒布至目前頻道'), false);
  assert.match(serialize(publicPayload), /公開採購情報/);
  assert.equal(serialize(publicPayload).includes('私人情報呈報'), false);
});
