import test from 'node:test';
import assert from 'node:assert/strict';
import { ComponentType, MessageFlags } from 'discord.js';
import { buildSteamSearchModal, buildSteamSearchResultPayload, buildSteamSelectionPayload, data } from '../src/commands/steam/steam.js';
import { countV2Components } from '../src/utils/componentsV2.js';

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

test('Steam candidate selector keeps the Discord maximum of 25 choices', () => {
  const candidates = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    name: `Royal Game ${index + 1}`,
  }));
  const payload = buildSteamSelectionPayload('session', 'Royal', candidates);
  const select = findCustomId(payload.components.map((component) => component.toJSON()), 'steam_search:session:select');

  assert.equal(select.options.length, 25);
  assert.equal(select.options.at(-1).value, '25');
  assert.ok(countV2Components(payload.components) <= 40);
});

test('Steam result is private until the owner publishes it once', () => {
  const privatePayload = buildSteamSearchResultPayload(42, details, {
    ephemeral: true,
    publishCustomId: 'steam_search:session:publish',
    backCustomId: 'steam_search:session:back',
    requeryCustomId: 'steam_search:session:requery',
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
  assert.match(serialize(privatePayload), /返回候選清單/);
  assert.match(serialize(privatePayload), /重新搜尋/);
  assert.ok(countV2Components(privatePayload.components) <= 40);
  assert.match(serialize(publishedPayload), /聖旨已頒布/);
  assert.equal(serialize(publicPayload).includes('頒布至目前頻道'), false);
  assert.match(serialize(publicPayload), /公開採購情報/);
  assert.equal(serialize(publicPayload).includes('私人情報呈報'), false);
});

test('expired Steam details disable navigation and publishing actions', () => {
  const payload = buildSteamSearchResultPayload(42, details, {
    ephemeral: true,
    publishCustomId: 'steam_search:session:publish',
    backCustomId: 'steam_search:session:back',
    requeryCustomId: 'steam_search:session:requery',
    expired: true,
  });
  const json = payload.components.map((component) => component.toJSON());

  assert.equal(findCustomId(json, 'steam_search:session:publish').disabled, true);
  assert.equal(findCustomId(json, 'steam_search:session:back').disabled, true);
  assert.equal(findCustomId(json, 'steam_search:session:requery').disabled, true);
});

function findCustomId(value, customId) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCustomId(item, customId);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  if (value.custom_id === customId) return value;
  return findCustomId(Object.values(value), customId);
}
