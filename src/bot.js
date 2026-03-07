import 'dotenv/config';
import dns from 'node:dns';
import { Client, GatewayIntentBits, Collection, Partials, Events, EmbedBuilder } from 'discord.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { initDatabase, getDb } from './utils/database.js';
import { logger } from './utils/logger.js';
import { initRpgTables } from './rpg/rpgDatabase.js';
import { registerRpgRouter } from './rpg/rpgRouter.js';

dns.setDefaultResultOrder('ipv4first');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction],
});

client.commands = new Collection();
client.cooldowns = new Collection();

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(執行指令 \ 時發生錯誤:, error);
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
        const allowedRoles = settings ? JSON.parse(settings.selfrole_roles) : [];

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

        const currentVotes = JSON.parse(poll.votes);
        for (const key of Object.keys(currentVotes)) {
          currentVotes[key] = currentVotes[key].filter(id => id !== interaction.user.id);
        }
        currentVotes[optionIndex].push(interaction.user.id);

        db.prepare('UPDATE polls SET votes = ? WHERE message_id = ?').run(JSON.stringify(currentVotes), messageId);

        const totalVotes = Object.values(currentVotes).reduce((sum, arr) => sum + arr.length, 0);
        const opts = JSON.parse(poll.options);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

        const newDesc = opts.map((opt, idx) => {
          const count = currentVotes[idx]?.length || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const filled = Math.min(20, Math.max(0, Math.round(pct / 5)));
          const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
          return \ **\**\n\ \ 票 (\%);
        }).join('\n\n');

        const originalFooter = interaction.message.embeds[0]?.footer?.text || '';
        const creatorName = originalFooter.split(' | ')[0].replace('建立者：', '') || '未知';
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(newDesc)
          .setFooter({ text: 建立者：\ | 總計 \ 票 });

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
        if (!data) return interaction.editReply({ content: '公告草稿已過期，請重新執行 /announce。' });

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
          .setDescription(# 公告\n\n## \\n\)
          .setAuthor({ name: 由 \ 發佈, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setFooter({ text: footer ? \ | 吉吉國王 : '吉吉國王公告系統', iconURL: 'attachment://stamp.png' });

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
    initRpgTables();
    logger.info('資料庫初始化完成。');

    await loadCommands(client);
    logger.info(已載入 \ 個指令。);

    await loadEvents(client);
    registerRpgRouter(client);
    logger.info('事件與 RPG 路由註冊完成。');

    const { initReminderManager } = await import('./utils/reminderManager.js');
    const { initGiveawayManager } = await import('./utils/giveawayManager.js');
    initReminderManager(client);
    initGiveawayManager(client);

    await client.login(process.env.DISCORD_TOKEN);
    logger.info('機器人已成功登入！');
  } catch (error) {
    logger.error('啟動失敗:', error);
    process.exit(1);
  }
}

import http from 'http';
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
}).listen(port, () => {
  logger.info(HTTP 伺服器監聽於連接埠 \。);
});

start();
