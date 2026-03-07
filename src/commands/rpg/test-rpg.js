import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getCharacter, updateCharacter, addGold, addToInventory, addEquipment, getEquipmentList } from '../../rpg/rpgDatabase.js';
import { getXpForLevel, CLASSES } from '../../rpg/data/gameData.js';
import { getDb, getAiSettings } from '../../utils/database.js';
import { calculateTotalStats } from '../../rpg/rpgHelpers.js';

export const data = new SlashCommandBuilder()
    .setName('test-rpg')
    .setNameLocalizations({ 'zh-TW': '測試rpg' })
    .setDescription('🛠️ (管理員) RPG 測試與作弊指令')
    .setDescriptionLocalizations({ 'zh-TW': '🛠️ (管理員) RPG 測試與作弊指令' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
        sub.setName('add-xp')
            .setNameLocalizations({ 'zh-TW': '增加經驗' })
            .setDescription('增加經驗值')
            .setDescriptionLocalizations({ 'zh-TW': '增加經驗值' })
            .addIntegerOption(opt =>
                opt.setName('amount')
                    .setNameLocalizations({ 'zh-TW': '數量' })
                    .setDescription('數量')
                    .setDescriptionLocalizations({ 'zh-TW': '數量' })
                    .setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('add-gold')
            .setNameLocalizations({ 'zh-TW': '增加金幣' })
            .setDescription('增加金幣')
            .setDescriptionLocalizations({ 'zh-TW': '增加金幣' })
            .addIntegerOption(opt =>
                opt.setName('amount')
                    .setNameLocalizations({ 'zh-TW': '數量' })
                    .setDescription('數量')
                    .setDescriptionLocalizations({ 'zh-TW': '數量' })
                    .setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('add-item')
            .setNameLocalizations({ 'zh-TW': '增加道具' })
            .setDescription('增加道具')
            .setDescriptionLocalizations({ 'zh-TW': '增加道具' })
            .addStringOption(opt =>
                opt.setName('item_id')
                    .setNameLocalizations({ 'zh-TW': '道具id' })
                    .setDescription('道具 ID')
                    .setDescriptionLocalizations({ 'zh-TW': '道具 ID' })
                    .setRequired(true))
            .addIntegerOption(opt =>
                opt.setName('amount')
                    .setNameLocalizations({ 'zh-TW': '數量' })
                    .setDescription('數量')
                    .setDescriptionLocalizations({ 'zh-TW': '數量' })
                    .setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName('add-equip')
            .setNameLocalizations({ 'zh-TW': '增加裝備' })
            .setDescription('增加裝備')
            .setDescriptionLocalizations({ 'zh-TW': '增加裝備' })
            .addStringOption(opt =>
                opt.setName('item_id')
                    .setNameLocalizations({ 'zh-TW': '裝備id' })
                    .setDescription('裝備 ID')
                    .setDescriptionLocalizations({ 'zh-TW': '裝備 ID' })
                    .setRequired(true))
            .addStringOption(opt =>
                opt.setName('quality')
                    .setNameLocalizations({ 'zh-TW': '品質' })
                    .setDescription('品質')
                    .setDescriptionLocalizations({ 'zh-TW': '品質' })
                    .setRequired(false)
                    .addChoices(
                        { name: '普通', name_localizations: { 'zh-TW': '普通' }, value: 'common' },
                        { name: '精良', name_localizations: { 'zh-TW': '精良' }, value: 'fine' },
                        { name: '稀有', name_localizations: { 'zh-TW': '稀有' }, value: 'rare' },
                        { name: '史詩', name_localizations: { 'zh-TW': '史詩' }, value: 'epic' },
                        { name: '神話', name_localizations: { 'zh-TW': '神話' }, value: 'mythic' },
                        { name: '傳說', name_localizations: { 'zh-TW': '傳說' }, value: 'legendary' }
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('reset')
            .setNameLocalizations({ 'zh-TW': '重置角色' })
            .setDescription('重置角色資料 (刪除所有進度)')
            .setDescriptionLocalizations({ 'zh-TW': '重置角色資料 (刪除所有進度)' })
            .addUserOption(opt =>
                opt.setName('target')
                    .setNameLocalizations({ 'zh-TW': '目標' })
                    .setDescription('目標玩家 (預設自己)')
                    .setDescriptionLocalizations({ 'zh-TW': '目標玩家 (預設自己)' })
                    .setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName('heal')
            .setNameLocalizations({ 'zh-TW': '恢復狀態' })
            .setDescription('完全恢復 HP 與 MP')
            .setDescriptionLocalizations({ 'zh-TW': '完全恢復 HP 與 MP' })
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const userId = targetUser.id;

    // 🔒 檢查是否有權限 (與 AI 設定共用管理員清單)
    const settings = getAiSettings(guildId);
    const adminIds = settings.admin_ids || [];

    if (!adminIds.includes(interaction.user.id)) {
        return interaction.reply({
            content: '❌ **權限不足！** 此作弊指令已鎖定。',
            flags: ['Ephemeral']
        });
    }

    if (sub === 'reset') {
        const db = getDb();
        db.prepare('DELETE FROM rpg_characters WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        db.prepare('DELETE FROM rpg_inventory WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        db.prepare('DELETE FROM rpg_equipment WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        db.prepare('DELETE FROM rpg_quest_progress WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        db.prepare('DELETE FROM rpg_learned_skills WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        return interaction.reply({ content: `✅ 已刪除玩家 <@${userId}> 的所有 RPG 資料。`, flags: ['Ephemeral'] });
    }

    const char = getCharacter(guildId, userId);
    if (!char) {
        return interaction.reply({ content: `❌ <@${userId}> 尚未建立 RPG 角色！`, flags: ['Ephemeral'] });
    }

    if (sub === 'add-xp') {
        const amount = interaction.options.getInteger('amount');
        let newXp = char.xp + amount;
        let newLevel = char.level;
        let newFreePoints = char.free_points;

        const cls = CLASSES[char.class];
        const growthUpdates = {};

        while (newLevel < 99 && newXp >= getXpForLevel(newLevel + 1)) {
            newXp -= getXpForLevel(newLevel + 1);
            newLevel++;
            newFreePoints += 5;

            // 同步職涯成長數值至資料庫
            if (cls) {
                for (const [stat, val] of Object.entries(cls.growth)) {
                    const key = (stat === 'hp') ? 'max_hp' : (stat === 'mp') ? 'max_mp' : stat;
                    growthUpdates[key] = (growthUpdates[key] ?? char[key]) + val;
                }
            }
        }

        // 計算包含裝備後的最終屬性以補滿血魔
        const finalChar = { ...char, ...growthUpdates, level: newLevel, xp: newXp, free_points: newFreePoints };
        const eqList = getEquipmentList(guildId, userId);
        const total = calculateTotalStats(finalChar, eqList);

        updateCharacter(guildId, userId, {
            ...growthUpdates,
            xp: newXp,
            level: newLevel,
            free_points: newFreePoints,
            hp: total.max_hp,
            mp: total.max_mp
        });

        return interaction.reply({ content: `✅ 給予 <@${userId}> **${amount} XP**\n目前等級：**Lv.${newLevel}** (未分配點數: ${newFreePoints})`, flags: ['Ephemeral'] });
    }

    if (sub === 'add-gold') {
        const amount = interaction.options.getInteger('amount');
        addGold(guildId, userId, amount);
        return interaction.reply({ content: `✅ 給予 <@${userId}> **${amount} 金幣**`, flags: ['Ephemeral'] });
    }

    if (sub === 'add-item') {
        const itemId = interaction.options.getString('item_id');
        const amount = interaction.options.getInteger('amount') || 1;
        addToInventory(guildId, userId, itemId, amount);
        return interaction.reply({ content: `✅ 給予 <@${userId}> 道具 **${itemId}** x${amount}`, flags: ['Ephemeral'] });
    }

    if (sub === 'add-equip') {
        const itemId = interaction.options.getString('item_id');
        const quality = interaction.options.getString('quality') || 'common';
        addEquipment(guildId, userId, itemId, quality, char.level);
        return interaction.reply({ content: `✅ 給予 <@${userId}> 裝備 **${itemId}** (品質: ${quality}，詞條適配等級: ${char.level})`, flags: ['Ephemeral'] });
    }

    if (sub === 'heal') {
        const eqList = getEquipmentList(guildId, userId);
        const total = calculateTotalStats(char, eqList);
        updateCharacter(guildId, userId, { hp: total.max_hp, mp: total.max_mp });
        return interaction.reply({ content: `✅ 已將 <@${userId}> 的 HP 與 MP 恢復至真實全滿 (${total.max_hp}/${total.max_mp})！`, flags: ['Ephemeral'] });
    }
}
