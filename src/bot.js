import 'dotenv/config';
import dns from 'node:dns';
import http from 'http';
import { AttachmentBuilder, Client, GatewayIntentBits, Collection, Partials, Events, EmbedBuilder, MessageFlags } from 'discord.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { initDatabase, getDb, updateGuildSetting, getGuildSettings } from './utils/database.js';
import { logger } from './utils/logger.js';
import { initVoiceXpManager } from './utils/voiceXpManager.js';
import { normalizePollVotes, parseJsonArray } from './utils/jsonUtils.js';
import { isV2Message, v2EditPayload, v2Notice } from './utils/componentsV2.js';
import { UI_COLORS } from './utils/style.js';
import { buildPollPayload } from './commands/fun/poll.js';
import { buildAnnouncementPayload, buildAnnouncementPreviewButtons, pendingAnnouncements } from './commands/admin/announce.js';
import { buildSteamDealDetailPayload, fetchSteamAppDetails, getSteamFailureMessage } from './utils/steamDeals.js';

dns.setDefaultResultOrder('ipv4first');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction],
});

client.commands = new Collection();
client.cooldowns = new Collection();
// 暫存領地的邀請連結，用於追蹤是誰邀請的
export const inviteCache = new Collection();
let healthServer = null;

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`執行指令 ${interaction.commandName} 時發生錯誤:`, error);
      const reply = v2Notice('⚠️ 指令執行失敗', '執行此指令時發生錯誤，請稍後再試。', UI_COLORS.DANGER);
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    try {
      if (interaction.customId === 'steam_deal_detail') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const appId = Number(interaction.values[0]);
        if (!Number.isSafeInteger(appId) || appId <= 0) {
          return interaction.editReply(v2EditPayload(v2Notice(
            '🛒 遊戲資料已失效',
            '這筆 Steam 遊戲資料無法辨識，請查看最新發布的特價榜單。',
            UI_COLORS.WARNING
          )));
        }

        try {
          const details = await fetchSteamAppDetails(appId);
          if (!details) {
            return interaction.editReply(v2EditPayload(v2Notice(
              '🛒 詳情暫不可用',
              'Steam 暫時沒有提供這款遊戲的完整情報，請稍後再試。',
              UI_COLORS.WARNING
            )));
          }
          return interaction.editReply(v2EditPayload(buildSteamDealDetailPayload(appId, details)));
        } catch (error) {
          logger.warn(`[SteamDeals] 互動詳情查詢失敗 app=${appId} code=${error.code || 'unavailable'}: ${error.message}`);
          return interaction.editReply(v2EditPayload(v2Notice(
            '🛒 Steam 查詢失敗',
            getSteamFailureMessage(error),
            UI_COLORS.WARNING
          )));
        }
      }

      if (interaction.customId === 'selfrole_select') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const roleIds = interaction.values;
        const member = interaction.member;
        const guild = interaction.guild;

        const db = getDb();
        const settings = db.prepare('SELECT selfrole_roles FROM guild_settings WHERE guild_id = ?').get(guild.id);
        const allowedRoles = settings ? parseJsonArray(settings.selfrole_roles, []) : [];

        const toAdd = roleIds.filter(id => allowedRoles.includes(id));
        const toRemove = allowedRoles.filter(id => !roleIds.includes(id));

        try {
          if (toAdd.length > 0) await member.roles.add(toAdd);
          if (toRemove.length > 0) await member.roles.remove(toRemove);
          await interaction.editReply(v2EditPayload(v2Notice('🏷️ 身分組已更新', '身份組已更新成功！', UI_COLORS.SUCCESS)));
        } catch (err) {
          logger.error('更新身份組失敗:', err);
          await interaction.editReply(v2EditPayload(v2Notice('🏷️ 身分組更新失敗', '更新身份組失敗，請檢查機器人權限。', UI_COLORS.DANGER)));
        }
      }

      if (interaction.customId === 'log_toggle_select') {
        const selected = interaction.values;
        const allCategories = ['message', 'member', 'server', 'voice', 'thread'];
        const newToggles = {};

        allCategories.forEach(cat => {
          newToggles[cat] = selected.includes(cat) ? 1 : 0;
        });

        const json = JSON.stringify(newToggles);
        updateGuildSetting(interaction.guildId, 'log_toggles', json);

        const statusText = allCategories.map(cat => {
          const emoji = newToggles[cat] ? '✅' : '❌';
          const name = { message: '訊息', member: '成員', server: '伺服器', voice: '語音', thread: '討論串' }[cat];
          return `${emoji} ${name}`;
        }).join(' | ');

        const settings = getGuildSettings(interaction.guildId);
        let extra = '';
        if (!settings.log_channel) {
          extra = '\n\n> ⚠️ **提醒：** 您尚未設定日誌頻道！請使用 `/設定紀錄 頻道:#您的頻道` 來安置史官。';
        }

        await interaction.reply(v2Notice(
          '🐕⚙️ 紀錄設定更新完成',
          `當前狀態：${statusText}${extra}`,
          settings.log_channel ? UI_COLORS.SUCCESS : UI_COLORS.WARNING
        ));
      }
    } catch (error) {
      logger.error('選擇選單交互失敗:', error);
    }
  }

  if (interaction.isButton()) {
    try {
      if (interaction.customId.startsWith('poll_')) {
        const optionIndex = parseInt(interaction.customId.split('_')[1], 10);
        const messageId = interaction.message.id;
        const db = getDb();
        const poll = db.prepare('SELECT * FROM polls WHERE message_id = ?').get(messageId);

        if (!poll) return interaction.reply(v2Notice('📊 投票已失效', '此投票已無法再受理選票。', UI_COLORS.WARNING));

        const opts = parseJsonArray(poll.options, []);
        if (optionIndex < 0 || optionIndex >= opts.length) {
          return interaction.reply(v2Notice('📊 選項不存在', '這個投票選項已不存在。', UI_COLORS.WARNING));
        }

        const currentVotes = normalizePollVotes(poll.votes, opts.length);
        for (const key of Object.keys(currentVotes)) {
          currentVotes[key] = currentVotes[key].filter(id => id !== interaction.user.id);
        }
        currentVotes[optionIndex].push(interaction.user.id);

        db.prepare('UPDATE polls SET votes = ? WHERE message_id = ?').run(JSON.stringify(currentVotes), messageId);

        if (isV2Message(interaction.message)) {
          const payload = buildPollPayload({
            question: poll.question,
            options: opts,
            votes: currentVotes,
            creatorId: poll.creator_id,
          });
          await interaction.update({ components: payload.components });
          return;
        }

        const totalVotes = Object.values(currentVotes).reduce((sum, arr) => sum + arr.length, 0);
        const { COLORS, ansiBar, ansiBlock, fmt } = await import('./utils/style.js');
        const pollLines = opts.map((opt, idx) => {
          const count = currentVotes[idx]?.length || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const bar = ansiBar(count, totalVotes || 1, COLORS.CYAN, 15);
          return `${fmt(COLORS.GOLD, (idx + 1) + '️⃣')} **${opt}**\n${bar} ${fmt(COLORS.WHITE, count + ' 票 (' + pct + '%)')}`;
        });

        const originalFooter = interaction.message.embeds[0]?.footer?.text || '';
        const creatorName = originalFooter.split(' | ')[0].replace('建立者：', '') || '未知';
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(ansiBlock(pollLines.join('\n\n')))
          .setFooter({ text: `建立者：${creatorName} | 總計 ${totalVotes} 票` });

        await interaction.update({ embeds: [updatedEmbed] });
      }

      if (interaction.customId.startsWith('announce_preview:')) {
        const [, uuid, action] = interaction.customId.split(':');
        const draft = pendingAnnouncements.get(uuid);
        if (!draft || Date.now() - draft.timestamp > 5 * 60_000) {
          pendingAnnouncements.delete(uuid);
          return interaction.reply(v2Notice('📜 草稿已失效', '公告預覽已逾時，請重新執行 `/發布公告`。', UI_COLORS.WARNING));
        }
        if (draft.userId !== interaction.user.id) {
          return interaction.reply(v2Notice('📜 無法代為頒布', '只有建立草稿的管理員能發布或取消這份公告。', UI_COLORS.WARNING));
        }
        if (action === 'cancel') {
          pendingAnnouncements.delete(uuid);
          const cancelled = v2Notice('📜 公告已取消', '這份聖旨草稿已撤回，不會對外發布。', UI_COLORS.MUTED);
          return interaction.update({ components: cancelled.components });
        }
        if (action === 'publish') {
          await interaction.deferUpdate();
          const targetChannel = await client.channels.fetch(draft.channelId);
          const stamp = new AttachmentBuilder('./assets/stamp.png', { name: 'stamp.png' });
          await targetChannel.send(buildAnnouncementPayload(draft, { files: [stamp] }));
          pendingAnnouncements.delete(uuid);
          const completed = v2Notice('📜 公告已發布', `聖旨已正式張貼至 <#${draft.channelId}>。`, UI_COLORS.SUCCESS);
          return interaction.editReply(v2EditPayload(completed));
        }
      }
    } catch (error) {
      logger.error('按鈕交互失敗:', error);
    }
  }

  if (interaction.isModalSubmit()) {
    try {
      if (interaction.customId.startsWith('announce_modal_')) {
        const uuid = interaction.customId.replace('announce_modal_', '');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const data = pendingAnnouncements.get(uuid);
        if (!data) return interaction.editReply(v2EditPayload(v2Notice('📜 草稿已失效', '公告草稿已過期，請重新執行 `/發布公告`。', UI_COLORS.WARNING)));

        const title = interaction.fields.getTextInputValue('announce_title');
        const content = interaction.fields.getTextInputValue('announce_content');
        const footer = interaction.fields.getTextInputValue('announce_footer');
        const uploads = [...(interaction.fields.getUploadedFiles('announce_images', false)?.values() ?? [])];
        if (uploads.some((file) => !file.contentType?.startsWith('image/'))) {
          pendingAnnouncements.delete(uuid);
          return interaction.editReply(v2EditPayload(v2Notice('📜 圖片格式不符', '公告附件僅接受圖片，請重新建立公告草稿。', UI_COLORS.WARNING)));
        }

        Object.assign(data, {
          title,
          content,
          footer,
          images: uploads.map((file) => file.url),
        });
        const previewButtons = buildAnnouncementPreviewButtons(uuid);
        const preview = buildAnnouncementPayload(data, { preview: true, actionRows: [previewButtons] });
        await interaction.editReply(v2EditPayload(preview));
      }
    } catch (error) {
      logger.error('彈窗提交失敗:', error);
    }
  }
});

async function start() {
  try {
    initDatabase();
    logger.info('資料庫初始化完成。');

    await loadCommands(client);
    logger.info(`已載入 ${client.commands.size} 個指令。`);

    await client.login(process.env.DISCORD_TOKEN);

    await loadEvents(client);
    logger.info('事件註冊完成。');

    const { initReminderManager } = await import('./utils/reminderManager.js');
    const { initGiveawayManager } = await import('./utils/giveawayManager.js');
    const { initPartyManager } = await import('./utils/partyManager.js');
    const { initSteamDealManager } = await import('./utils/steamDealManager.js');
    initReminderManager(client);
    initGiveawayManager(client);
    initPartyManager(client);
    initSteamDealManager(client);
    initVoiceXpManager(client);

    startHealthServer();
    logger.info('機器人已成功登入！');

    // 登入後緩存所有邀請碼
    client.guilds.cache.forEach(async (guild) => {
      try {
        const invites = await guild.invites.fetch();
        inviteCache.set(guild.id, new Collection(invites.map(inv => [inv.code, inv.uses])));
      } catch (e) {
        logger.warn(`[InviteCache] 無法讀取 ${guild.name} 的邀請碼: ${e.message}`);
      }
    });

    // 邀請碼事件監聽
    client.on('inviteCreate', (invite) => {
      const gInvites = inviteCache.get(invite.guild.id) || new Collection();
      gInvites.set(invite.code, invite.uses);
      inviteCache.set(invite.guild.id, gInvites);
    });
    client.on('inviteDelete', (invite) => {
      const gInvites = inviteCache.get(invite.guild.id);
      if (gInvites) gInvites.delete(invite.code);
    });
  } catch (error) {
    logger.error('啟動失敗:', error);
    try {
      client.destroy();
    } catch {}
    process.exitCode = 1;
  }
}

function startHealthServer() {
  if (healthServer) return healthServer;

  const port = process.env.PORT || 3000;
  healthServer = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive!');
  }).listen(port, () => {
    logger.info(`HTTP 伺服器監聽於連接埠 ${port}。`);
  });

  return healthServer;
}

start();
