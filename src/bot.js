import 'dotenv/config';
import dns from 'node:dns';
import http from 'http';
import { Client, GatewayIntentBits, Collection, Partials, Events, EmbedBuilder } from 'discord.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { initDatabase, getDb, updateGuildSetting, getGuildSettings } from './utils/database.js';
import { logger } from './utils/logger.js';
import { initVoiceXpManager } from './utils/voiceXpManager.js';
import { normalizePollVotes, parseJsonArray } from './utils/jsonUtils.js';

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
      const reply = { content: '執行此指令時發生錯誤！', flags: ['Ephemeral'] };
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    try {
      if (interaction.customId === 'selfrole_select') {
        await interaction.deferReply({ flags: ['Ephemeral'] });
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
          await interaction.editReply({ content: '身份組已更新成功！' });
        } catch (err) {
          logger.error('更新身份組失敗:', err);
          await interaction.editReply({ content: '更新身份組失敗，請檢查機器人權限。' });
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

        await interaction.reply({
            content: `🐕⚙️ **設定更新完成！**\n當前狀態：${statusText}${extra}`,
            flags: ['Ephemeral']
        });
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

        if (!poll) return interaction.reply({ content: '此投票已失效。', flags: ['Ephemeral'] });

        const opts = parseJsonArray(poll.options, []);
        if (optionIndex < 0 || optionIndex >= opts.length) {
          return interaction.reply({ content: '投票選項不存在。', flags: ['Ephemeral'] });
        }

        const currentVotes = normalizePollVotes(poll.votes, opts.length);
        for (const key of Object.keys(currentVotes)) {
          currentVotes[key] = currentVotes[key].filter(id => id !== interaction.user.id);
        }
        currentVotes[optionIndex].push(interaction.user.id);

        db.prepare('UPDATE polls SET votes = ? WHERE message_id = ?').run(JSON.stringify(currentVotes), messageId);

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
    } catch (error) {
      logger.error('按鈕交互失敗:', error);
    }
  }

  if (interaction.isModalSubmit()) {
    try {
      if (interaction.customId.startsWith('announce_modal_')) {
        const uuid = interaction.customId.replace('announce_modal_', '');
        await interaction.deferReply({ flags: ['Ephemeral'] });

        const { pendingAnnouncements } = await import('./commands/admin/announce.js');
        const data = pendingAnnouncements.get(uuid);
        if (!data) return interaction.editReply({ content: '公告草稿已過期，請重新執行 `/發布公告`。' });

        const title = interaction.fields.getTextInputValue('announce_title');
        const content = interaction.fields.getTextInputValue('announce_content');
        const footer = interaction.fields.getTextInputValue('announce_footer');

        const { AttachmentBuilder } = await import('discord.js');
        const { COLORS, ansiBlock } = await import('./utils/style.js');
        const stamp = new AttachmentBuilder('./assets/stamp.png', { name: 'stamp.png' });

        const ansiText = ansiBlock([
          { color: COLORS.CYAN, text: '=========================================' },
          { color: COLORS.GOLD, text: content },
          { color: COLORS.CYAN, text: '=========================================' },
        ]);

        const embed = new EmbedBuilder()
          .setColor(0xFF2222)
          .setAuthor({ name: `👑 王國宣告 (由 ${interaction.member.displayName} 草擬)`, iconURL: interaction.user.displayAvatarURL() })
          .setDescription(`# 📜 【致全境子民：國王御旨】\n\n**${title}**\n${ansiText}`)
          .setTimestamp()
          .setFooter({ text: `${footer ? `${footer} | ` : ''}🔱 王國正版授權印記`, iconURL: 'attachment://stamp.png' });

        if (data.images?.[0]) embed.setImage(data.images[0]);

        const targetChannel = await client.channels.fetch(data.channelId);
        await targetChannel.send({
          content: data.mentionText || null,
          embeds: [embed, ...(data.images?.slice(1).map(img => new EmbedBuilder().setColor(0xFF2222).setImage(img)) || [])],
          files: [stamp],
        });

        pendingAnnouncements.delete(uuid);
        await interaction.editReply({ content: '公告發送成功！' });
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
