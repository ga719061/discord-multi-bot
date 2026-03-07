import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { RACES, CLASSES, SKILLS, getXpForLevel, SKILL_BOOKS, getSkillDef } from '../data/gameData.js';
import { getCharacter, updateCharacter, getEquipmentList, getLearnedSkills, toggleMercenaryStatus, setEquippedSkills } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, charSummary, hpBar, mpBar, xpBar, backButton, qualityLabel, getActualStats, safeReply, calculateTotalStats, getJobTitle, formatItemName, getJobAdvancement, getEquipFullName, getQualityColor } from '../rpgHelpers.js';
import { EQUIPMENT, QUALITY_MULTIPLIER, STAT_LABELS } from '../data/gameData.js';
import * as StyleUtils from '../../utils/style.js';
const { fmt, COLORS, ansi, ansiBar } = StyleUtils;

export async function showProfile(interaction, char) {
    try {
        if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
        const eqList = getEquipmentList(interaction.guildId, interaction.user.id);
        const total = calculateTotalStats(char, eqList); // 取得含屬性加成與裝備的最終數值
        const xpNeeded = getXpForLevel(char.level + 1);
        const getEqName = (eqId) => {
            if (!eqId) return '無';
            const eq = eqList.find(e => e.id === Number(eqId));
            if (!eq) return '無';
            const def = EQUIPMENT[eq.item_id];
            if (!def) return eq.item_id;
            const enh = eq.enhancement || 0;
            const enhStr = enh > 0 ? ` **+${enh}**` : '';

            const actualStats = getActualStats(eq.item_id, eq.quality, enh);
            const statsText = Object.entries(actualStats)
                .filter(([k]) => !k.startsWith('max_'))
                .map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()}${v >= 0 ? '+' : ''}${v}`).join(' ');

            const fullName = getEquipFullName(eq, def);
            return `${def.emoji} **${fullName}${enhStr}** [${qualityLabel(eq.quality)}]\n　 ╰┈> \`${statsText}\``;
        };

        const embed = rpgEmbed(`🐕⚔️ ${interaction.user.displayName} 的冒險者資訊`);

        const basicInfo = [
            `**稱號:**`,
            `\`\`\`ansi\n${getJobTitle(char, true)}\n\`\`\``,
            `**等級:** Lv.${char.level} | **XP:** ${char.xp}/${xpNeeded}`,
            xpBar(char.xp, xpNeeded),
        ].join('\n');

        const mainStats = [
            hpBar(char.hp, total.max_hp),
            mpBar(char.mp, total.max_mp),
            '```ansi\n' + [
                `⚔️ 攻擊: ${String(total.atk).padEnd(4)} 🔮 魔攻: ${total.matk}`,
                `🛡️ 防禦: ${String(total.def).padEnd(4)} 🏰 魔防: ${total.mdef}`,
                `💥 暴擊: ${String(total.crit + '%').padEnd(4)} 🔥 暴傷: ${total.crit_dmg}%`,
                `💨 速度: ${String(total.spd).padEnd(4)} 🎯 點數: ${char.free_points || 0}`
            ].join('\n') + '\n```'
        ].join('\n');

        const attrInfo = '```ansi\n' + [
            `💪 力量: ${String(char.str || 10).padEnd(4)} 🧠 智力: ${char.int || 10}`,
            `🦴 體質: ${String(char.vit || 10).padEnd(4)} ⚡ 敏捷: ${char.agi || 10}`,
            `🍀 幸運: ${char.luk || 10}`
        ].join('\n') + '\n```';

        const careerInfo = [
            `✅ **勝:** ${char.wins || 0} | 👑 **王:** ${char.boss_kills || 0}`,
            `💀 **回:** ${char.deaths || 0} | 💔 **連:** ${char.lose_streak || 0}`
        ].join('\n');

        // 裝備欄位改為更緊緻的格式
        const getEqShort = (slot, eqId) => {
            if (!eqId) return '無';
            const eq = eqList.find(e => e.id === Number(eqId));
            if (!eq) return '無';
            const def = EQUIPMENT[eq.item_id];
            const enh = eq.enhancement || 0;
            const enhStr = enh > 0 ? `+${enh}` : '';
            const fullName = getEquipFullName(eq, def);
            return `${formatItemName(`${fullName}${enhStr}`, eq.quality)}`;
        };

        const armorList = '```ansi\n' + [
            `頭: ${getEqShort('head', char.head_id)}`,
            `身: ${getEqShort('body', char.body_id)}`,
            `手: ${getEqShort('hands', char.hands_id)}`,
            `腿: ${getEqShort('legs', char.legs_id)}`,
            `足: ${getEqShort('feet', char.feet_id)}`
        ].join('\n') + '\n```';

        const weaponList = '```ansi\n' + [
            `主: ${getEqShort('main', char.main_hand_id)}`,
            `副: ${getEqShort('off', char.off_hand_id)}`,
            `飾: ${getEqShort('acc1', char.acc1_id)}`,
            `飾: ${getEqShort('acc2', char.acc2_id)}`,
            `飾: ${getEqShort('acc3', char.acc3_id)}`,
            `飾: ${getEqShort('acc4', char.acc4_id)}`
        ].join('\n') + '\n```';

        const equippedSkillsIds = JSON.parse(char.equipped_skills || '[]');
        const equippedSkillsList = equippedSkillsIds.length > 0
            ? equippedSkillsIds.map(sid => `• ${getSkillDef(sid)?.name || sid}`).join('\n')
            : '（未設定，顯示所有技能）';

        embed.addFields(
            { name: '✨ 冒險者基礎', value: basicInfo, inline: true },
            { name: '📊 核心屬性', value: attrInfo, inline: true },
            { name: '🧬 戰鬥數值', value: mainStats, inline: false },
            { name: '🏆 生涯戰績', value: careerInfo, inline: false },
            { name: '⚔️ 當前上場技能', value: `\`\`\`\n${equippedSkillsList}\n\`\`\``, inline: false },
            { name: '🛡️ 防具裝備', value: armorList, inline: true },
            { name: '🗡️ 武器飾品', value: weaponList, inline: true }
        );

        const rows = [];
        if (char.free_points > 0) {
            rows.push(new ActionRowBuilder().addComponents(
                rpgButton('rpg_stat_str', '力量 (STR)', 2, '💪'),
                rpgButton('rpg_stat_int', '智力 (INT)', 2, '🧠'),
                rpgButton('rpg_stat_vit', '體質 (VIT)', 2, '🛡️'),
                rpgButton('rpg_stat_agi', '敏捷 (AGI)', 2, '⚡'),
                rpgButton('rpg_stat_luk', '幸運 (LUK)', 2, '🍀'),
            ));
            if (char.free_points >= 5) {
                rows.push(new ActionRowBuilder().addComponents(
                    rpgButton('rpg_stat_str_5', 'STR +5', 1, '💪'),
                    rpgButton('rpg_stat_int_5', 'INT +5', 1, '🧠'),
                    rpgButton('rpg_stat_vit_5', 'VIT +5', 1, '🛡️'),
                    rpgButton('rpg_stat_agi_5', 'AGI +5', 1, '⚡'),
                    rpgButton('rpg_stat_luk_5', 'LUK +5', 1, '🍀'),
                ));
            }
        }
        rows.push(new ActionRowBuilder().addComponents(
            rpgButton('rpg_skills', '技能列表', 2, '🔥'),
            rpgButton('rpg_equip_skills', '選用預設技能', 1, '⚔️'),
            rpgButton('rpg_auto_config', '自動戰鬥設定', 2, '⚙️'),
        ));
        rows.push(new ActionRowBuilder().addComponents(
            rpgButton('rpg_profile_merc_toggle', char.allow_mercenary ? '已開啟助戰' : '已關閉助戰', char.allow_mercenary ? 3 : 4, '🛡️'),
            rpgButton('rpg_menu', '返回', 2, '🔙'),
        ));

        await safeReply(interaction, { embeds: [embed], components: rows });
    } catch (e) {
        console.error('showProfile error:', e);
        const errDetail = e.errors ? ` (${JSON.stringify(e.errors)})` : '';
        try {
            if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `🐕 UI產生發生錯誤: ${e.message}${errDetail}`, flags: ['Ephemeral'] });
            else await interaction.reply({ content: `🐕 UI產生發生錯誤: ${e.message}${errDetail}`, flags: ['Ephemeral'] });
        } catch (err) { }
    }
}

export async function handleProfileAction(interaction, char) {
    try {
        if (!char) char = getCharacter(interaction.guildId, interaction.user.id);
        const id = interaction.customId;

        // 屬性分配
        if (id.startsWith('rpg_stat_')) {
            const parts = id.split('_'); // rpg, stat, str, [5]
            const stat = parts[2];
            const amount = parts[3] ? parseInt(parts[3]) : 1;

            if (char.free_points < amount) {
                return interaction.reply({ content: `🐕 點數不足！(需要 ${amount} 點)`, flags: ['Ephemeral'] });
            }

            const updates = {
                free_points: char.free_points - amount,
                [stat]: (char[stat] || 0) + amount
            };

            updateCharacter(interaction.guildId, interaction.user.id, updates);
            const updated = getCharacter(interaction.guildId, interaction.user.id);
            return showProfile(interaction, updated);
        }

        // 技能列表 — 顯示已學技能
        if (id === 'rpg_skills') {
            let learnedIds = getLearnedSkills(interaction.guildId, interaction.user.id);
            const clsDef = CLASSES[char.class];
            if (clsDef?.initialSkill && !learnedIds.includes(clsDef.initialSkill)) {
                learnedIds.push(clsDef.initialSkill);
            }

            // 輔助函式：取得技能對應的等級需求 (從 SKILL_BOOKS 找)
            const getLevelReq = (sid) => {
                const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === sid);
                return bookEntry ? bookEntry[1].levelReq : 0;
            };

            // 輔助函式：取得技能顏色 (根據技能書的品質)
            const getSkillColor = (sid) => {
                const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === sid);
                return bookEntry ? getQualityColor(bookEntry[1].quality) : '0;37';
            };

            // 1. 排序已學技能 (由等級低到高)
            learnedIds.sort((a, b) => getLevelReq(a) - getLevelReq(b));

            const lines = [];
            if (learnedIds.length === 0) {
                lines.push(fmt(COLORS.GRAY, '🐕 你還沒有學會任何技能！'));
                lines.push(fmt(COLORS.CYAN, '💡 打怪時有機率掉落 技能書，在背包中使用即可學習！'));
            } else {
                // 已學習技能：改為更緊實的排版
                lines.push(fmt(COLORS.GOLD, '【 已掌握技能 】'));

                for (const skillId of learnedIds) {
                    const s = getSkillDef(skillId);
                    if (!s) continue;
                    const lv = getLevelReq(skillId);
                    const color = getSkillColor(skillId);

                    // 第一行：圖示 [名稱] 等級 - 消耗
                    lines.push(fmt(color, `${s.emoji} [ ${s.name.padEnd(8)} ] (Lv.${String(lv).padEnd(2)}) - ${String(s.mp).padStart(2)} MP`));
                    // 第二行：簡潔描述 (縮排)
                    const desc = s.desc.length > 30 ? s.desc.slice(0, 28) + '..' : s.desc;
                    lines.push(fmt('2;37', `  └ ${desc}`));
                }
            }

            // 2. 排序並列出還沒學到的本職技能
            const ownClassSkills = SKILLS[char.class] || [];
            let unlearned = ownClassSkills.filter(s => !learnedIds.includes(s.id));
            unlearned.sort((a, b) => getLevelReq(a.id) - getLevelReq(b.id));

            if (unlearned.length > 0) {
                lines.push('');
                lines.push(fmt(COLORS.WHITE, '【 🔒 未解鎖技能 】'));
                for (const s of unlearned) {
                    const lv = getLevelReq(s.id);
                    const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === s.id);
                    const bookDef = bookEntry ? bookEntry[1] : null;
                    const color = bookDef ? getQualityColor(bookDef.quality) : '0;37';

                    // 用更對齊的方式顯示
                    const qLabel = qualityLabel(bookDef?.quality).split(' ')[1] || '普通';
                    lines.push(fmt(color, `· [ ${s.name.padEnd(8)} ] (Lv.${String(lv).padEnd(2)}) [${qLabel}]`));
                }
            }

            const embed = rpgEmbed(
                `🔥 ${interaction.user.displayName} 的技能`,
                '```ansi\n' + lines.join('\n') + '\n```',
                0x3498DB // Blue for profile/skills
            ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

            return safeReply(interaction, {
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(
                    rpgButton('rpg_profile', '返回角色', 2, '📋'),
                    rpgButton('rpg_menu', '返回主選單', 2, '🔙'),
                )],
            });
        }

        // 選用技能
        if (id === 'rpg_equip_skills' || id.startsWith('rpg_active_skill_set_')) {
            let learnedIds = getLearnedSkills(interaction.guildId, interaction.user.id);
            const clsDef = CLASSES[char.class];
            if (clsDef?.initialSkill && !learnedIds.includes(clsDef.initialSkill)) learnedIds.push(clsDef.initialSkill);

            if (learnedIds.length === 0) return interaction.reply({ content: '🐕 你還沒學會任何技能！', flags: ['Ephemeral'] });

            // 如果是下拉選單提交
            if (interaction.isStringSelectMenu() && id.startsWith('rpg_active_skill_set_')) {
                setEquippedSkills(interaction.guildId, interaction.user.id, interaction.values);
                return interaction.reply({ content: `✅ 已成功設定 **${interaction.values.length}** 個上場技能！`, flags: ['Ephemeral'] });
            }

            const equipped = JSON.parse(char.equipped_skills || '[]');

            // 輔助函式：取得技能對應的等級需求 (從 SKILL_BOOKS 找)
            const getLevelReq = (sid) => {
                const bookEntry = Object.entries(SKILL_BOOKS).find(([, b]) => b.skillId === sid);
                return bookEntry ? bookEntry[1].levelReq : 0;
            };

            // 排序已學技能 (由等級低到高)
            learnedIds.sort((a, b) => getLevelReq(a) - getLevelReq(b));

            const options = learnedIds.map(sid => {
                const s = getSkillDef(sid);
                const lv = getLevelReq(sid);
                return {
                    label: `${s?.name || sid} (Lv.${lv})`,
                    value: sid,
                    description: s?.desc?.slice(0, 50) || '',
                    emoji: s?.emoji || '🔥',
                    default: equipped.includes(sid)
                };
            });

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`rpg_active_skill_set_${interaction.user.id}`)
                .setPlaceholder('選擇最多 5 個技能上場...')
                .setMinValues(0)
                .setMaxValues(Math.min(5, options.length))
                .addOptions(options.slice(0, 25));

            const embed = rpgEmbed(
                '⚔️ 設定上場技能',
                `請從下方列表選擇您想在戰鬥中使用的技能 (最多 5 個)。\n若未設定，系統將預設顯示所有已學技能。\n\n**當前選擇:**\n${equipped.map(sid => `• ${getSkillDef(sid)?.name || sid}`).join('\n') || '無'}`
            ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${interaction.user.id}` });

            return safeReply(interaction, {
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(rpgButton('rpg_profile', '返回角色', 2, '📋'))]
            });
        }

        // 傭兵開關
        if (id === 'rpg_profile_merc_toggle') {
            const newStatus = toggleMercenaryStatus(interaction.guildId, interaction.user.id);
            if (newStatus !== null) {
                return showProfile(interaction, getCharacter(interaction.guildId, interaction.user.id));
            }
        }
    } catch (e) {
        console.error('handleProfileAction error:', e);
        try { await interaction.reply({ content: `🐕 操作發生錯誤: ${e.message}`, flags: ['Ephemeral'] }); } catch (err) { }
    }
}
