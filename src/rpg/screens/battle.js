import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getBattle, updateBattle, deleteBattle, getCharacter, updateCharacter, addGold, addToInventory, addEquipment, getLearnedSkills, registerFirstKill, addMercenaryHistory } from '../rpgDatabase.js';
import { rpgEmbed, rpgButton, hpBar, mpBar, hpBarBare, mpBarBare, battleActionRows, backButton, getUnlockedSkills, qualityLabel, broadcastRpgEvent, calcDamage, isCrit, isDodge, applyBuffsAndStates, processTurnEndStates, hasState, consumeShield, getJobTitle, formatItemName, executeSetHooks, formatBattleLog, safeReply, rollQualityForArea, getBetterQuality } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';
import { logger } from '../../utils/logger.js';
import { SKILLS, EQUIPMENT, SHOP_ITEMS, ITEM_NAMES, getXpForLevel, getItemDisplayName, SKILL_BOOK_DROP_POOLS, SKILL_BOOKS, getSkillDef, AREAS, QUALITY_MULTIPLIER, CLASSES } from '../data/gameData.js';
import { showHub } from './hub.js';
import { handleBossDeathIntercept, handleBossAttack } from '../bosses/bossSystem.js';

// 用來暫存各個戰鬥的 Message references，以便同步多人畫面
const activeBattleMessages = new Map();

/**
 * 將現有的訊息標籤加入戰鬥同步列表
 */
export function addBattleMessages(battleId, messages) {
    if (!messages || messages.length === 0) return;
    const existing = activeBattleMessages.get(battleId) || [];
    const combined = [...existing];
    for (const m of messages) {
        if (!combined.some(c => c.id === m.id)) combined.push(m);
    }
    activeBattleMessages.set(battleId, combined);
}

// ---------- 渲染戰鬥畫面 ----------
export async function renderBattle(interaction, battleId, actionLog = '') {
    const battle = getBattle(battleId);
    if (!battle) return;

    // 支援單一怪物或陣列
    let monsters = Array.isArray(battle.monster_data) ? battle.monster_data : [battle.monster_data];
    // 只顯示存活或剛死的

    // 3. 處理怪物顯示
    const monsterLines = [];
    monsters.forEach((m, idx) => {
        const isDead = m.currentHp <= 0 ? ' 💀' : '';
        monsterLines.push(`${m.emoji} ** ${m.name}** ${isDead} `);
        monsterLines.push('```ansi\n' + hpBarBare(m.currentHp, m.hp) + '\n```');
    });

    // 4. 處理隊員與召喚物顯示
    const playersInfo = battle.player_ids.map(pid => {
        const ps = battle.player_states[pid];
        let p_name = `<@${pid}>`;
        if (pid === interaction.user.id) {
            p_name = `**${interaction.user.displayName}**`;
        } else {
            const member = interaction.guild?.members.cache.get(pid);
            if (member) p_name = `**${member.displayName}**`;
        }
        const status = ps.hp <= 0 ? ' 💀' : '';
        return `${p_name}${status} (Lv.${ps.level})\n\`\`\`ansi\n${hpBarBare(ps.hp, ps.max_hp)}\n${mpBarBare(ps.mp, ps.max_mp)}\n\`\`\``;
    });

    if (battle.ally_summons && battle.ally_summons.length > 0) {
        for (const s of battle.ally_summons) {
            const isDead = s.hp <= 0 ? ' 💀' : '';
            playersInfo.push(
                `**${s.emoji} ${s.name}**${isDead}`,
                '```ansi\n' + hpBarBare(s.hp, s.max_hp) + '\n```'
            );
        }
    }

    // 5. 處理日誌
    let formattedLog = '';
    if (actionLog) {
        // 處理玩家暱稱取代：將 <@ID> 換成暱稱
        let processedLog = actionLog;
        const mentionRegex = /<@(\d+)>/g;
        let match;
        const mentionMap = new Map();
        while ((match = mentionRegex.exec(actionLog)) !== null) {
            const mid = match[1];
            if (!mentionMap.has(mid)) {
                let name = mid;
                const member = interaction.guild?.members.cache.get(mid);
                if (member) name = member.displayName;
                else if (mid === interaction.user.id) name = interaction.user.displayName;
                mentionMap.set(mid, name);
            }
        }
        for (const [mid, name] of mentionMap) {
            processedLog = processedLog.split(`<@${mid}>`).join(name);
        }

        const lines = processedLog.split('\n').filter(Boolean);
        // 如果 actionLog 已經包含 ANSI 代碼 (由 handleBattleAction 生成)，則直接包裹
        // 否則進行基本的預處理
        const stylizedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.includes('\u001b[')) return trimmed; // 已有 ANSI

            if (trimmed.includes('傷害') && !trimmed.includes('回復')) {
                return `🩸 ${trimmed}`;
            } else if (trimmed.includes('回復')) {
                return `💚 ${trimmed}`;
            } else if (trimmed.includes('閃避')) {
                return `💨 ${trimmed}`;
            } else if (trimmed.includes('倒下了') || trimmed.includes('被擊散了')) {
                return `💀 ${trimmed}`;
            } else if (trimmed.includes('遇到') || trimmed.includes('警告')) {
                return `⚠️ ${trimmed}`;
            } else {
                return `🔹 ${trimmed}`;
            }
        });
        formattedLog = `\n**📜 戰鬥日誌：**\n\`\`\`ansi\n${stylizedLines.join('\n')}\n\`\`\``;
    }

    // 6. 處理冷卻顯示 (僅顯示當前玩家的)
    const ps = battle.player_states[interaction.user.id];
    let cooldownText = '';
    if (ps && ps.cooldowns) {
        const cdLines = [];
        for (const [sid, turns] of Object.entries(ps.cooldowns)) {
            if (turns > 0) {
                const sDef = getSkillDef(sid);
                if (sDef) cdLines.push(`${sDef.emoji} **${sDef.name}** (${turns} 回合)`);
            }
        }
        if (cdLines.length > 0) {
            cooldownText = `\n**⏳ 冷卻中技能：**\n> ${cdLines.join('、')}`;
        }
    }

    const embed = rpgEmbed(
        `⚔️ 戰鬥！ — 回合 ${battle.turn}`,
        [
            '**【敵方陣容】**',
            ...monsterLines,
            '',
            '**【我方小隊】**',
            ...playersInfo,
            cooldownText,
            formattedLog,
        ].filter(Boolean).join('\n'),
        0xED4245 // Red for combat
    ).setFooter({ text: `🐕👑 吉吉王國騎士團 | 頻道: ${interaction.channel?.name || '未知'}` });

    const payload = { embeds: [embed], components: battleActionRows(battleId) };

    let messages = activeBattleMessages.get(battleId);
    if (!messages) {
        messages = [];
        activeBattleMessages.set(battleId, messages);
    }

    try {
        await safeReply(interaction, payload).catch(() => { });
    } catch (e) {
        // Fallback for expired interactions or external calls
        try {
            if (interaction.message && !interaction.message.flags.has('Ephemeral')) {
                await interaction.message.edit(payload);
            }
        } catch (err) { }
    }

    // 在私密模式下，同步多人介面已無必要（因為其他人看不到），且 fetchReply 在某些環境對 Ephemeral 限制較多
    // 我們只更新當前互動的訊息即可。
}

// (已替換為高品質 hpBar)

// 輔助函式：產生目標選擇選單
function renderTargetSelection(interaction, battleId, actionType, skillId = null) {
    const battle = getBattle(battleId);

    let options = [];
    if (actionType === 'SKILL_ALLY') {
        // 選擇隊友或召喚物
        options = battle.player_ids.map(pid => {
            const ps = battle.player_states[pid];
            return {
                label: `[隊員] ${ps.hp}/${ps.max_hp}`, // 這裡拿不到 displayName，可以用 ID
                description: `HP: ${ps.hp}/${ps.max_hp}`,
                value: `SKILL_ALLY_TARGET_${pid}_${skillId}`,
                emoji: '🛡️'
            };
        });

        if (battle.ally_summons) {
            battle.ally_summons.forEach((s, idx) => {
                if (s.hp > 0) {
                    options.push({
                        label: `[召喚] ${s.name}`,
                        description: `HP: ${s.hp}/${s.max_hp}`,
                        value: `SKILL_ALLY_TARGET_SUMMON_${idx}_${skillId}`,
                        emoji: s.emoji || '👁️'
                    });
                }
            });
        }
    } else {
        // 選擇怪物
        let monsters = Array.isArray(battle.monster_data) ? battle.monster_data : [battle.monster_data];
        const alives = monsters.map((m, i) => ({ ...m, index: i })).filter(m => m.currentHp > 0);
        options = alives.map(m => ({
            label: `${m.name} (HP: ${m.currentHp}/${m.hp})`,
            value: `${actionType}_TARGET_${m.index}${skillId ? `_${skillId}` : ''}`,
            emoji: m.emoji || '🎯',
        }));
    }

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`rpg_target_select_${battleId}`)
            .setPlaceholder('選擇目標...')
            .addOptions(options.slice(0, 25)),
    );
    const backRow = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_battle_back_${battleId}`, '取消', undefined, '🔙'),
    );

    const payload = { components: [row, backRow] };
    return safeReply(interaction, payload);
}

// ---------- 處理戰鬥行動 ----------
export async function handleBattleAction(interaction) {
    // 立即回應避免交互超時 (由於戰鬥包含廣播與複雜計算，這很重要)
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => { });
    }

    const id = interaction.customId;
    const userId = interaction.user.id;

    // 從 customId 取 battleId
    let battleId;
    if (id.match(/_(\d+)$/)) {
        battleId = parseInt(id.match(/_(\d+)$/)[1]);
    } else return;

    const battle = getBattle(battleId);
    if (!battle || battle.status !== 'active') return;

    if (!battle.player_ids.includes(userId)) {
        return safeReply(interaction, { content: '🚫 閣下並未參與此場戰鬥。', flags: ['Ephemeral'] }).catch(() => {});
    }
    const ps = battle.player_states[userId];
    battle.ally_summons = battle.ally_summons || [];
    if (ps.hp <= 0 && !id.startsWith('rpg_battle_flee_')) {
        return safeReply(interaction, { content: '🚫 意識已模糊，無法下達任何指令。', flags: ['Ephemeral'] }).catch(() => {});
    }


    let monsters = Array.isArray(battle.monster_data) ? battle.monster_data : [battle.monster_data];
    let alives = monsters.map((m, i) => { m.index = i; return m; }).filter(m => m.currentHp > 0);
    let log = '';

    // 取消選擇目標，返回主按鈕
    if (id.startsWith('rpg_battle_back_')) {
        return renderBattle(interaction, battleId);
    }

    try {
        // --- 處理本回合所有實體的 Stat 重算 ---
        Object.values(battle.player_states).forEach(p => {
            applyBuffsAndStates(p);
        });
        if (battle.ally_summons) battle.ally_summons.forEach(applyBuffsAndStates);
        monsters.forEach(applyBuffsAndStates);

        // --- 回合開始 Hook (onTurnStart) ---
        log += executeSetHooks('onTurnStart', ps);

        if (hasState(ps, 'stunned')) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => { });
            log = `💫 <@${userId}> 處於眩暈狀態，本回合無法行動！`;
        } else {
            // ===== 攻擊/技能 目標選擇後處理 (下拉選單) =====
            if (id.startsWith('rpg_target_select_') && interaction.isStringSelectMenu()) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => { });
                const val = interaction.values[0];
                const parts = val.split('_');
                logger.debug(`[Battle] Target selected: ${val}`);

                // Robust parsing
                let actionType, targetIdx, skillId, targetId, isSummon = false;

                if (val.startsWith('ATTACK_TARGET_')) {
                    actionType = 'ATTACK';
                    targetIdx = parseInt(parts[2]);
                } else if (val.startsWith('SKILL_TARGET_')) {
                    actionType = 'SKILL';
                    targetIdx = parseInt(parts[2]);
                    // Skill ID might contain underscores, so we join the rest
                    skillId = parts.slice(3).join('_');
                } else if (val.startsWith('SKILL_ALLY_TARGET_')) {
                    actionType = 'SKILL_ALLY';
                    if (parts[3] === 'SUMMON') {
                        isSummon = true;
                        targetIdx = parseInt(parts[4]);
                        skillId = parts.slice(5).join('_');
                    } else {
                        targetId = parts[3]; // This is the UID
                        skillId = parts.slice(4).join('_');
                    }
                }

                if (actionType === 'SKILL_ALLY') {
                    const skill = getSkillDef(skillId);
                    if (!skill) {
                        logger.error(`[Battle] Skill not found: ${skillId}`);
                        return safeReply(interaction,{ content: '🚫 找不到該技能的祕法記載。', flags: ['Ephemeral'] });
                    }

                    const atkVal = ps.matk || ps.atk;
                    let target;
                    if (isSummon) {
                        target = battle.ally_summons[targetIdx];
                    } else {
                        target = battle.player_states[targetId];
                    }

                    // --- 施放技能前 Hook (onSkill) ---
                    const skillContext = { skill: { ...skill } };
                    log += executeSetHooks('onSkill', ps, target, skillContext);
                    ps.mp -= skillContext.skill.mp;

                    if (!target) {
                        logger.error(`[Battle] Skill target not found: isSummon=${isSummon}, idx=${targetIdx}, id=${targetId}`);
                        return safeReply(interaction,{ content: '🚫 無法感知到指定的目標。', flags: ['Ephemeral'] });
                    }

                    if (skill.effect) target.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                    if (skill.effect?.cleanse) target.debuffs = []; // 新增：支援清除狀態
                    if (skill.immunity) target.buffs.push({ immunity: true, turns: skill.turns || 1 });
                    if (skill.shieldMultiplier) {
                        target.shield = (target.shield || 0) + Math.floor(atkVal * skill.shieldMultiplier);
                    }
                    if (skill.effect?.invulnerable) {
                        target.invulnerableTurns = (target.invulnerableTurns || 0) + skill.effect.invulnerable;
                    }
                    if (skill.effect?.extraTurn && Math.random() < 0.3) {
                        battle.extra_actor_id = userId; // 標記下一個回合還是他的
                    }

                    // 設置冷卻時間
                    if (skill.cd) {
                        ps.cooldowns = ps.cooldowns || {};
                        ps.cooldowns[skill.id] = skill.cd + 1;
                    }

                    if (skill.type === 'heal') {
                        const heal = Math.floor(target.max_hp * (skill.healPercent / 100));
                        target.hp = Math.min(target.max_hp, target.hp + (heal || 0));
                        log = formatBattleLog(`<@${userId}> 使用了 ${skill.emoji} ${skill.name}！回復了 ${isSummon ? target.name : `<@${targetId}>`} ${heal} HP！`, { type: 'heal' });
                    } else if (skill.special === 'sacrifice_heal') {
                        const cost = Math.floor(ps.max_hp * 0.2);
                        const heal = Math.floor(target.max_hp * 0.5);
                        ps.hp = Math.max(1, ps.hp - cost);
                        target.hp = Math.min(target.max_hp, target.hp + (heal || 0));
                        log = formatBattleLog(`<@${userId}> 使用了 ${skill.emoji} ${skill.name}！犧牲生命為 ${isSummon ? target.name : `<@${targetId}>`} 回復了 ${heal} HP！`, { type: 'heal' });
                    } else {
                        log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name} 於 ${isSummon ? target.name : `<@${targetId}>`}！${skill.desc}`;
                    }
                } else {
                    const target = monsters[targetIdx];
                    if (!target) {
                        logger.error(`[Battle] Enemy target not found: idx=${targetIdx}`);
                        return safeReply(interaction,{ content: '🚫 目標魔物已脫離感應範圍。', flags: ['Ephemeral'] });
                    }
                    if (target.currentHp <= 0) {
                        return safeReply(interaction,{ content: '🚫 目標魔物已然崩解，請重新選取。', flags: ['Ephemeral'] });
                    }

                    if (actionType === 'ATTACK') {
                        if (isDodge(target)) {
                            log = `<@${userId}> 發動了普通攻擊！但是被 ${target.emoji} ${target.name} 閃避了！`;
                        } else {
                            const crit = isCrit(ps);
                            const dmg = calcDamage(ps.atk, target.def, 1, ps.penetration_pct) * (crit ? (ps.crit_dmg / 100) : 1);
                            const finalDmg = consumeShield(target, Math.floor(dmg));
                            target.currentHp -= finalDmg;
                            log += formatBattleLog(`<@${userId}> 發動了普通攻擊！對 ${target.emoji} ${target.name} 造成 ${finalDmg} 傷害${crit ? ' 💥暴擊！' : ''}`, { crit, type: 'physical' });

                            // --- 命中後 Hook (onHit) & 受到傷害 Hook (onDamaged) ---
                            const hitCtx = { actorIsPlayer: true };
                            log += executeSetHooks('onHit', ps, target, hitCtx);
                            const damagedCtx = {
                                originalDamage: finalDmg,
                                actorIsMonster: true,
                                allies: Object.values(battle.player_states).filter(p => p.hp > 0),
                                encounterMonsters: monsters.filter(m => m.currentHp > 0)
                            };
                            log += executeSetHooks('onDamaged', target, ps, damagedCtx);

                            // 如果 target 被反彈死亡
                            if (ps.hp <= 0) {
                                log += `\n> 💀 <@${userId}> 被反彈傷害擊倒了！`;
                            }
                            // 如果 target 死亡 (onKill)
                            log += executeSetHooks('onKill', ps, target, { allies: Object.values(battle.player_states), encounterMonsters: monsters });


                            // 處理連擊 Hook
                            if (hitCtx.doDoubleStrike && target.currentHp > 0 && ps.hp > 0) {
                                const crit2 = isCrit(ps);
                                const dmg2 = calcDamage(ps.atk, target.def, 1, ps.penetration_pct) * (crit2 ? (ps.crit_dmg / 100) : 1);
                                const finalDmg2 = consumeShield(target, Math.floor(dmg2));
                                target.currentHp -= finalDmg2;
                                log += '\n> ' + formatBattleLog(`⚔️ 二連擊對 ${target.name} 造成 ${finalDmg2} 傷害${crit2 ? ' 💥暴擊！' : ''}`, { crit: crit2, type: 'physical' });
                                log += executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                                log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmg2 });
                                if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);
                            }

                            // 吸血
                            if (ps.lifesteal > 0) {
                                const heal = Math.floor(finalDmg * (ps.lifesteal / 100));
                                ps.hp = Math.min(ps.max_hp, ps.hp + heal);
                                log += ` 💚吸血(${heal})`;
                            }
                        }
                    } else if (actionType === 'SKILL') {
                        const skill = getSkillDef(skillId);
                        if (!skill) {
                            logger.error(`[Battle] Skill not found: ${skillId}`);
                            return safeReply(interaction,{ content: '🚫 祕法記錄遺失。', flags: ['Ephemeral'] });
                        }

                        // --- 施放技能前 Hook (onSkill) ---
                        const skillContext = { skill: { ...skill } };
                        const skillLog = executeSetHooks('onSkill', ps, target, skillContext);
                        log += skillLog;
                        ps.mp -= skillContext.skill.mp;

                        if (!skill.ignoreDodge && isDodge(target)) {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！被 ${target.name} 閃避了！`;
                        } else {
                            const isMixed = skill.type === 'mixed';
                            const isMagical = skill.type === 'magical';
                            const isPhysical = skill.type === 'physical';

                            let atkStat = 0;
                            if (isMixed) atkStat = (Number(ps.atk || 0) * (skill.multiplier || 0)) + (Number(ps.matk || 0) * (skill.matkMultiplier || 0));
                            else if (isMagical) atkStat = ps.matk * (skill.multiplier || 1.0);
                            else atkStat = ps.atk * (skill.multiplier || 1.0);

                            if (skill.spdMultiplier) atkStat += ps.spd * skill.spdMultiplier;

                            let defStat = isPhysical ? (target.def || 0) : (target.mdef || target.def || 0);
                            if (skill.ignoreDef) defStat = 0;
                            else if (skill.armorPen) defStat = Math.floor(defStat * (1 - (skill.armorPen || 0) / 100));

                            let dmgMult = 1.0; // multiplier already handled for mixed or simple types
                            if (skill.undeadBonus && target.isUndead) dmgMult *= skill.undeadBonus;

                            const crit = isCrit(ps, skill.critBonus || 0);
                            const hits = skill.hits || 1;
                            let totalDmg = 0;

                            for (let i = 0; i < hits; i++) {
                                const critDmgMult = Number(ps.crit_dmg) || 150;
                                const dmg = Math.floor(calcDamage(atkStat, defStat, dmgMult, ps.penetration_pct) * (crit ? (critDmgMult / 100) : 1));
                                totalDmg += (Number(dmg) || 0);
                            }

                            let extraMsg = '';
                            if (skill.holyBurn) {
                                const burnDmg = Math.floor(atkStat * 0.5);
                                totalDmg += burnDmg;
                                extraMsg += `🔥聖光灼傷(${burnDmg}) `;
                            }

                            // 整合吸血
                            const totalLifeSteal = (skill.lifeSteal || 0) + (ps.lifesteal || 0);
                            if (totalLifeSteal > 0) {
                                const heal = Math.floor(totalDmg * (totalLifeSteal / 100));
                                ps.hp = Math.min(ps.max_hp, ps.hp + heal);
                                extraMsg += `💚吸血(${heal}) `;
                            }
                            if (skill.drainMp) {
                                const recMp = Math.max(1, Math.floor(totalDmg * 0.2));
                                ps.mp = Math.min(ps.max_mp, ps.mp + recMp);
                                extraMsg += `💜汲取(${recMp}MP) `;
                            }
                            if (skill.debuff) {
                                target.debuffs = target.debuffs || [];
                                target.debuffs.push({ ...skill.debuff, turns: skill.debuff.turns });
                                extraMsg += ` 📉${(skill.debuff.percent < 0 ? '下降' : '變動')} `;
                            }
                            if (skill.stunChance && Math.random() * 100 < skill.stunChance) {
                                target.debuffs.push({ stunned: true, turns: 1 });
                                extraMsg += ` 💫眩暈 `;
                            }
                            if (skill.dot) {
                                target.debuffs = target.debuffs || [];
                                target.debuffs.push({ dot: skill.dot, turns: skill.dot.turns });
                                extraMsg += ` ☠️中持續傷害 `;
                            }
                            if (skill.effect) {
                                ps.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                            }
                            if (skill.shieldMultiplier) {
                                ps.shield = (ps.shield || 0) + Math.floor(atkStat * skill.shieldMultiplier);
                            }

                            target.currentHp = (Number(target.currentHp) || 0) - (Number(consumeShield(target, totalDmg)) || 0);
                            const sType = skill.holyBurn ? 'holy' : (skill.type === 'magical' ? 'magical' : 'physical');
                            log += formatBattleLog(`<@${userId}> 使用了 ${skill.emoji} ${skill.name}！對 ${target.name} 造成 ${totalDmg} 傷害${crit ? ' 💥暴擊！' : ''}${hits > 1 ? ` (${hits}連擊)` : ''}${extraMsg}`, { crit, type: sType });

                            // 設置冷卻時間
                            if (skill.cd) {
                                ps.cooldowns = ps.cooldowns || {};
                                ps.cooldowns[skill.id] = skill.cd + 1;
                            }

                            // --- 命中後 Hook (onHit) & 受到傷害 Hook (onDamaged) ---
                            const hitCtx = { actorIsPlayer: true };
                            log += executeSetHooks('onHit', ps, target, hitCtx);
                            log += executeSetHooks('onDamaged', target, ps, { originalDamage: totalDmg });

                            // 處理反彈致死
                            if (ps.hp <= 0) log += `\n> 💀 <@${userId}> 被反彈傷害擊倒了！`;
                            // 擊殺 (onKill)
                            if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);

                            // 處理連擊
                            if (hitCtx.doDoubleStrike && target.currentHp > 0 && ps.hp > 0) {
                                // 簡化版二次傷害 (取這波傷害平均值)
                                const avgDmg = Math.floor(totalDmg / hits);
                                const finalDmg2 = consumeShield(target, avgDmg);
                                target.currentHp -= finalDmg2;
                                log += `\n> ⚔️ 二連擊對 ${target.name} 造成 ${finalDmg2} 傷害！`;
                                log += executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                                log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmg2 });
                                if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);
                            }
                        }
                    }
                }
            }

            // ===== 普通攻擊 (按鈕直接點擊) =====
            else if (id.startsWith('rpg_battle_attack_')) {
                if (alives.length > 1) {
                    return renderTargetSelection(interaction, battleId, 'ATTACK');
                } else {
                    if (alives.length === 0) return renderBattle(interaction, battleId, '🐕 目標魔物已消失！');
                    const target = alives[0];
                    if (isDodge(target)) {
                        log = `<@${userId}> 發動了普通攻擊！但是被 ${target.emoji} ${target.name} 閃避了！`;
                    } else {
                        const crit = isCrit(ps);
                        const critDmgMult = Number(ps.crit_dmg) || 150;
                        const dmg = calcDamage(ps.atk, target.def, 1, ps.penetration_pct) * (crit ? (critDmgMult / 100) : 1);
                        const finalDmg = consumeShield(target, Math.floor(dmg));
                        target.currentHp = (Number(target.currentHp) || 0) - (Number(finalDmg) || 0);
                        log = formatBattleLog(`<@${userId}> 發動了普通攻擊！對 ${target.emoji} ${target.name} 造成 ${finalDmg} 傷害${crit ? ' 💥暴擊！' : ''}`, { crit, type: 'physical' });

                        // --- 命中後 Hook (onHit) & 受到傷害 Hook (onDamaged) ---
                        const hitCtx = { actorIsPlayer: true };
                        log += executeSetHooks('onHit', ps, target, hitCtx);
                        log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmg });

                        // 陣亡檢查
                        if (ps.hp <= 0) log += `\n> 💀 <@${userId}> 被反彈傷害擊倒了！`;
                        if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);

                        // 處理連擊
                        if (hitCtx.doDoubleStrike && target.currentHp > 0 && ps.hp > 0) {
                            const crit2 = isCrit(ps);
                            const dmg2 = calcDamage(ps.atk, target.def, 1, ps.penetration_pct) * (crit2 ? (critDmgMult / 100) : 1);
                            const finalDmg2 = consumeShield(target, Math.floor(dmg2));
                            target.currentHp -= finalDmg2;
                            log += '\n> ' + formatBattleLog(`⚔️ 二連擊對 ${target.name} 造成 ${finalDmg2} 傷害${crit2 ? ' 💥暴擊！' : ''}`, { crit: crit2, type: 'physical' });
                            log += executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                            log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmg2 });
                            if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);
                        }

                        // 處理魔劍士附魔 (Enchant)
                        const enchant = (ps.buffs || []).find(b => b.enchantType);
                        if (enchant && Math.random() * 100 < (enchant.chance || 100)) {
                            target.debuffs = target.debuffs || [];
                            target.debuffs.push({ dot: { type: enchant.enchantType, percent: 10 }, turns: 2 });
                            log += ` (附加了 ${enchant.enchantType === 'burn' ? '🔥灼燒' : '☠️劇毒'} 效果！)`;
                        }

                        // 反彈傷害 (Reflection)
                        const reflectBuff = (target.buffs || []).find(b => b.reflect);
                        if (reflectBuff) {
                            const reflectDmg = Math.floor(finalDmg * (reflectBuff.reflect / 100));
                            ps.hp -= reflectDmg;
                            log += `\n> ⚖️ 目標反彈了 ${reflectDmg} 點傷害給您！`;
                        }
                    }
                }
            }

            // ===== 技能選擇 (按鈕) =====
            else if (id.startsWith('rpg_battle_skill_')) {
                const charData = getCharacter(interaction.guildId, userId);
                const learnedIds = getLearnedSkills(interaction.guildId, userId);
                let skills = getUnlockedSkills(charData?.class || 'warrior', charData?.level || 1, learnedIds);

                // 檢查是否有設定「上場技能」
                const equippedIds = JSON.parse(charData?.equipped_skills || '[]');
                if (equippedIds.length > 0) {
                    skills = skills.filter(s => equippedIds.includes(s.id));
                }

                if (skills.length === 0) {
                    return safeReply(interaction,{ content: '📜 尚未將任何招式納入出征序列。', flags: ['Ephemeral'] });
                }

                const options = skills.map(s => {
                    const cdLeft = ps.cooldowns?.[s.id] || 0;
                    const isCD = cdLeft > 0;
                    return {
                        label: isCD ? `[⏳ CD: ${cdLeft}] ${s.name}` : `${s.name} (${s.mp} MP)`,
                        description: s.desc.slice(0, 50),
                        value: s.id,
                        emoji: s.emoji,
                    };
                });

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`rpg_skill_select_${battleId}`)
                        .setPlaceholder('選擇一個技能...')
                        .addOptions(options.slice(0, 25)),
                );
                const backRow = new ActionRowBuilder().addComponents(
                    rpgButton(`rpg_battle_back_${battleId}`, '返回', undefined, '🔙'),
                );

                const payload = { components: [row, backRow] };
                return safeReply(interaction, payload);
            }

            // ===== 技能選擇後處理 (下拉) =====
            else if (id.startsWith('rpg_skill_select_')) {
                if (!interaction.isStringSelectMenu()) return;
                const skillId = interaction.values[0];
                const skill = getSkillDef(skillId);
                if (!skill) return;

                // 檢查是否冷卻中
                if (ps.cooldowns?.[skillId] > 0) {
                    const cd = ps.cooldowns[skillId];
                    const s = getSkillDef(skillId);
                    return renderBattle(interaction, battleId, `❌ 技能「${s?.emoji}${s?.name}」還在冷卻中 (剩 ${cd} 回合)！請重新選擇行動。`);
                }

                if (ps.mp < skill.mp) {
                    log = `<@${userId}> MP 不足！需要 ${skill.mp} MP`;
                    return renderBattle(interaction, battleId, log);
                }

                // 檢查目標類型
                if (skill.target === 'single_ally') {
                    return renderTargetSelection(interaction, battleId, 'SKILL_ALLY', skillId);
                }

                // --- 全局回血/Buff/護盾 (全體或自身) (onSkill 不耗魔判定放外面比較好，統一做) ---
                const skillContext = { skill: { ...skill } };
                const skillLog = executeSetHooks('onSkill', ps, null, skillContext);
                log += skillLog;

                // 回血/Buff/護盾 (全體或自身)
                if (skill.type === 'heal' || skill.type === 'buff' || skill.type === 'shield' || skill.target === 'party') {
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => { });
                    ps.mp -= skillContext.skill.mp;
                    if (skill.hpCost) {
                        ps.hp = Math.max(1, ps.hp - skill.hpCost);
                    }

                    if (skill.target === 'party') {
                        // 全體效果 (例如：聖域、神聖加持、隊友治癒)
                        battle.player_ids.forEach(pid => {
                            const targetPs = battle.player_states[pid];
                            if (targetPs.hp > 0) {
                                if (skill.healPercent) {
                                    const heal = Math.floor(targetPs.max_hp * (skill.healPercent / 100));
                                    targetPs.hp = Math.min(targetPs.max_hp, targetPs.hp + (heal || 0));
                                }
                                if (skill.healHp) {
                                    targetPs.hp = Math.min(targetPs.max_hp, targetPs.hp + skill.healHp);
                                }
                                if (skill.healMp) {
                                    targetPs.mp = Math.min(targetPs.max_mp, targetPs.mp + skill.healMp);
                                }
                                if (skill.effect) {
                                    targetPs.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                                }
                                if (skill.immunity) {
                                    targetPs.buffs.push({ immunity: true, turns: skill.turns || 1 });
                                }
                                if (skill.shieldMultiplier) {
                                    const atkVal = ps.matk || ps.atk;
                                    targetPs.shield = (targetPs.shield || 0) + Math.floor(atkVal * skill.shieldMultiplier);
                                }
                            }
                        });
                        log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！全隊獲得效果！`;
                    } else if (skill.type === 'heal') {
                        const heal = Math.floor(ps.max_hp * (skill.healPercent / 100));
                        ps.hp = Math.min(ps.max_hp, ps.hp + heal);
                        log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！回復了 ${heal} HP！`;
                    } else {
                        let extraLog = '';
                        if (skill.healHp) {
                            ps.hp = Math.min(ps.max_hp, ps.hp + skill.healHp);
                            extraLog += ` 回復了 ${skill.healHp} HP！`;
                        }
                        if (skill.healMp) {
                            ps.mp = Math.min(ps.max_mp, ps.mp + skill.healMp);
                            extraLog += ` 回復了 ${skill.healMp} MP！`;
                        }
                        if (skill.effect) {
                            ps.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                        }
                        if (skill.immunity) {
                            ps.buffs.push({ immunity: true, turns: skill.turns || 1 });
                        }
                        if (skill.shieldMultiplier) {
                            const atkVal = ps.matk || ps.atk;
                            ps.shield = (ps.shield || 0) + Math.floor(atkVal * skill.shieldMultiplier);
                            extraLog += ` 獲得護盾(${Math.floor(atkVal * skill.shieldMultiplier)})！`;
                        }
                        if (extraLog) {
                            log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！${extraLog}`;
                        } else {
                            log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！${skill.desc}`;
                        }
                    }
                } else {
                    // 攻擊型技能
                    if (skill.special === 'life_guard' || skill.special === 'full_revive_guard') {
                        // 復活守護邏輯
                        battle.player_ids.forEach(pid => {
                            const targetPs = battle.player_states[pid];
                            if (skill.special === 'full_revive_guard' && targetPs.hp <= 0) {
                                targetPs.hp = Math.floor(targetPs.max_hp * 0.5); // 復活 50%
                            }
                            if (targetPs.hp > 0) {
                                targetPs.buffs.push({ invulnerable: 1, turns: 2 });
                            }
                        });
                        log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！全隊獲得了神聖守護！`;
                    } else if (skill.special === 'chaos_unity') {
                        ps.mp -= skillContext.skill.mp;
                        // 萬象無間：全屏高傷 + 全屬性機率 Debuff
                        const totalDmg = Math.floor((ps.atk + ps.matk) * 4.0);
                        monsters.forEach(m => {
                            if (m.currentHp > 0) {
                                m.currentHp -= consumeShield(m, totalDmg);
                                m.debuffs.push({ stat: 'all', percent: -20, turns: 3 });
                                log += executeSetHooks('onHit', ps, m, { actorIsPlayer: true });
                                if (m.currentHp <= 0) log += executeSetHooks('onKill', ps, m);
                            }
                        });

                        // 設置冷卻時間
                        if (skill.cd) {
                            ps.cooldowns = ps.cooldowns || {};
                            ps.cooldowns[skill.id] = skill.cd + 1;
                        }
                        log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！混沌之力席捲戰場！`;
                    } else if (skill.special === 'mage_summon') {
                        const char = getCharacter(interaction.guildId, userId);
                        const lvl = char.level || 1;
                        const maxSummons = lvl >= 80 ? 4 : (lvl >= 65 ? 3 : (lvl >= 45 ? 2 : 1)); // 召喚數量隨等級提升
                        const aliveSummons = battle.ally_summons.filter(s => s.hp > 0).length;

                        if (aliveSummons >= maxSummons) {
                            return safeReply(interaction,{ content: `🚫 召喚位階已達上限 (${maxSummons} 尊)。`, flags: ['Ephemeral'] });
                        }

                        ps.mp -= skill.mp;
                        let sName = '骸骨';
                        let sEmoji = '☠️';
                        let sMult = 0.7;

                        if (lvl >= 80) { sName = '死亡騎士'; sEmoji = '💀🔥'; sMult = 4.0; }
                        else if (lvl >= 72) { sName = '黑豹'; sEmoji = '🐆'; sMult = 3.2; }
                        else if (lvl >= 60) { sName = '先烈艾爾摩將軍'; sEmoji = '⚔️💂‍♂️'; sMult = 2.6; }
                        else if (lvl >= 52) { sName = '阿魯巴'; sEmoji = '🦍'; sMult = 2.1; }
                        else if (lvl >= 48) { sName = '魅魔'; sEmoji = '👿'; sMult = 1.7; }
                        else if (lvl >= 40) { sName = '鋼鐵高崙'; sEmoji = '🤖'; sMult = 1.3; }
                        else if (lvl >= 32) { sName = '斯巴托'; sEmoji = '💀'; sMult = 1.0; }

                        const summonAtk = Math.floor((ps.matk || ps.atk) * sMult);
                        const summonHp = Math.floor(ps.max_hp * (0.3 + (lvl / 200))); // 血量略微下調以平衡高攻擊
                        const summonDef = Math.floor((ps.def || 10) * 0.5);

                        battle.ally_summons.push({
                            isSummon: true,
                            name: sName,
                            emoji: sEmoji,
                            hp: summonHp,
                            max_hp: summonHp,
                            atk: summonAtk,
                            matk: summonAtk * 0.5,
                            def: summonDef,
                            mdef: Math.floor(summonDef * 0.8),
                            spd: ps.spd,
                            buffs: [], debuffs: [],
                            b_atk: summonAtk,
                            b_matk: summonAtk * 0.5,
                            b_def: summonDef,
                            b_mdef: Math.floor(summonDef * 0.8),
                            b_spd: ps.spd
                        });

                        // 設置冷卻時間
                        if (skill.cd) {
                            ps.cooldowns = ps.cooldowns || {};
                            ps.cooldowns[skill.id] = skill.cd + 1;
                        }
                        log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！召喚了 ${sEmoji}${sName} 加入戰線！ (上限: ${maxSummons})`;

                    } else if (skill.target === 'random') {
                        // 隨機多段打擊
                        ps.mp -= skillContext.skill.mp;
                        const isMixed = skill.type === 'mixed';
                        const isMagical = skill.type === 'magical';
                        const isPhysical = skill.type === 'physical';

                        let totalDmgGlobal = 0;
                        let critCount = 0;
                        let hitCountMap = {};

                        const hits = skill.hits || 1;
                        for (let i = 0; i < hits; i++) {
                            const validTargets = alives.filter(m => m.currentHp > 0);
                            if (validTargets.length === 0) break;
                            const target = validTargets[Math.floor(Math.random() * validTargets.length)];

                            if (skill.ignoreDodge || !isDodge(target)) {
                                let atkStat = 0;
                                if (isMixed) atkStat = (Number(ps.atk || 0) * (skill.multiplier || 0)) + (Number(ps.matk || 0) * (skill.matkMultiplier || 0));
                                else if (isMagical) atkStat = ps.matk * (skill.multiplier || 1.0);
                                else atkStat = ps.atk * (skill.multiplier || 1.0);

                                if (skill.spdMultiplier) atkStat += ps.spd * skill.spdMultiplier;

                                let defStat = isPhysical ? (target.def || 0) : (target.mdef || target.def || 0);
                                if (skill.ignoreDef) defStat = 0;
                                else if (skill.armorPen) defStat = Math.floor(defStat * (1 - (skill.armorPen || 0) / 100));

                                let dmgMult = 1.0;
                                if (skill.undeadBonus && target.isUndead) dmgMult *= skill.undeadBonus;

                                const crit = isCrit(ps, skill.critBonus || 0);
                                const dmg = Math.floor(calcDamage(atkStat, defStat, dmgMult, ps.penetration_pct) * (crit ? (ps.crit_dmg / 100) : 1));

                                const finalDmgToTarget = consumeShield(target, dmg);
                                monsters[target.index].currentHp -= finalDmgToTarget;
                                totalDmgGlobal += finalDmgToTarget;

                                hitCountMap[target.name] = (hitCountMap[target.name] || 0) + 1;
                                if (crit) critCount++;

                                // Hooks
                                const hitCtx = { actorIsPlayer: true };
                                log += executeSetHooks('onHit', ps, target, hitCtx);
                                log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmgToTarget });
                                if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);

                                if (hitCtx.doDoubleStrike && target.currentHp > 0 && ps.hp > 0) {
                                    const finalDmg2 = consumeShield(target, dmg);
                                    monsters[target.index].currentHp -= finalDmg2;
                                    totalDmgGlobal += finalDmg2;
                                    log += executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                                    log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmg2 });
                                    if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);
                                }
                            }
                        }

                        if (skill.effect) {
                            ps.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                        }

                        // 設置冷卻時間
                        if (skill.cd) {
                            ps.cooldowns = ps.cooldowns || {};
                            ps.cooldowns[skill.id] = skill.cd + 1;
                        }

                        const hitSummaries = Object.entries(hitCountMap).map(([name, count]) => `${name}x${count}`).join(', ');
                        if (hitSummaries) {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！隨機打擊 ${hitSummaries}，共造成 ${totalDmgGlobal} 傷害${critCount > 0 ? ` (${critCount}次暴擊)` : ''}！`;
                        } else {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！但所有攻擊都落空了！`;
                        }
                    } else if (skill.target === 'all' || skill.target === 'party') {
                        // AoE 或 全隊技能
                        ps.mp -= skillContext.skill.mp;
                        const isMixed = skill.type === 'mixed';
                        const isMagical = skill.type === 'magical';
                        const isPhysical = skill.type === 'physical';
                        const isHeal = skill.type === 'heal';

                        let totalDmgGlobal = 0;
                        let critCount = 0;
                        const hitNames = [];

                        // 判斷目標是魔物還是隊友
                        const targets = (skill.target === 'party') ? battle.player_ids.map(id => battle.player_states[id]).filter(p => p.hp > 0) : alives;

                        for (const target of targets) {
                            if (isHeal) {
                                const heal = Math.floor(target.max_hp * (skill.healPercent / 100));
                                target.hp = Math.min(target.max_hp, target.hp + heal);
                                if (skill.effect?.cleanse) target.debuffs = [];
                                hitNames.push(target.id ? `<@${target.id}>` : target.name);
                                continue;
                            }

                            if (skill.ignoreDodge || !isDodge(target)) {
                                let atkStat = 0;
                                if (isMixed) atkStat = (Number(ps.atk || 0) * (skill.multiplier || 0)) + (Number(ps.matk || 0) * (skill.matkMultiplier || 0));
                                else if (isMagical) atkStat = ps.matk * (skill.multiplier || 1.0);
                                else atkStat = ps.atk * (skill.multiplier || 1.0);

                                if (skill.spdMultiplier) atkStat += ps.spd * skill.spdMultiplier;

                                let defStat = isPhysical ? (target.def || 0) : (target.mdef || target.def || 0);
                                if (skill.ignoreDef) defStat = 0;
                                else if (skill.armorPen) defStat = Math.floor(defStat * (1 - (skill.armorPen || 0) / 100));

                                let dmgMult = 1.0;
                                if (skill.undeadBonus && target.isUndead) dmgMult *= skill.undeadBonus;

                                const crit = isCrit(ps, skill.critBonus || 0);
                                const hits = skill.hits || 1;
                                let totalDmgToTarget = 0;

                                for (let i = 0; i < hits; i++) {
                                    const dmg = Math.floor(calcDamage(atkStat, defStat, 1, ps.penetration_pct) * (crit ? (ps.crit_dmg / 100) : 1));
                                    totalDmgToTarget += dmg;
                                }

                                if (skill.debuff) {
                                    target.debuffs.push({ ...skill.debuff, turns: skill.debuff.turns });
                                }
                                if (skill.stunChance && Math.random() * 100 < skill.stunChance) {
                                    target.debuffs.push({ stunned: true, turns: 1 });
                                }
                                if (skill.dot) {
                                    target.debuffs.push({ dot: skill.dot, turns: skill.dot.turns });
                                }


                                const finalDmgToTarget = consumeShield(target, totalDmgToTarget);
                                monsters[target.index].currentHp -= finalDmgToTarget;
                                totalDmgGlobal += finalDmgToTarget;
                                hitNames.push(`${target.emoji} ${target.name}`);
                                if (crit) critCount++;

                                // Hooks
                                const hitCtx = {
                                    actorIsPlayer: true,
                                    encounterMonsters: monsters.filter(m => m.currentHp > 0),
                                    originalDamage: totalDmgToTarget,
                                    allies: Object.values(battle.player_states).filter(p => p.hp > 0)
                                };
                                log += executeSetHooks('onHit', ps, target, hitCtx);
                                log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmgToTarget, allies: monsters.filter(m => m.currentHp > 0) });
                                if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target, { allies: Object.values(battle.player_states).filter(p => p.hp > 0) });
                            }
                        }

                        // 自身 Buff 只放一次
                        if (skill.effect && !isHeal) {
                            ps.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                        }

                        // 設置冷卻時間 (AoE 漏掉的部分)
                        if (skill.cd) {
                            ps.cooldowns = ps.cooldowns || {};
                            ps.cooldowns[skill.id] = skill.cd + 1;
                        }

                        if (isHeal) {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！為全隊回復了大量生命！`;
                        } else if (hitNames.length === 0) {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！但所有目標都閃避了！`;
                        } else {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！對全體魔物共造成 ${totalDmgGlobal} 傷害${critCount > 0 ? ' 💥暴擊！' : ''}`;
                        }
                    } else if (alives.length > 1) {
                        return renderTargetSelection(interaction, battleId, 'SKILL', skillId);
                    } else {
                        if (alives.length === 0) return renderBattle(interaction, battleId, '🐕 無法施放技能：目標已消失！');
                        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => { });
                        ps.mp -= skillContext.skill.mp;
                        const target = alives[0];
                        if (skill.type === 'heal') {
                            const heal = Math.floor(target.max_hp * (skill.healPercent / 100));
                            target.hp = Math.min(target.max_hp, target.hp + heal);
                            if (skill.effect?.cleanse) target.debuffs = [];
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！為 ${target.id === userId ? '自己' : `<@${target.id}>`} 回復了 ${heal} HP！`;
                        } else if (!skill.ignoreDodge && isDodge(target)) {
                            log += `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！但是被 ${target.name} 閃避了！`;
                        } else {
                            const isMixed = skill.type === 'mixed';
                            const isMagical = skill.type === 'magical';
                            const isPhysical = skill.type === 'physical';

                            let atkStat = 0;
                            if (isMixed) atkStat = (Number(ps.atk || 0) * (skill.multiplier || 0)) + (Number(ps.matk || 0) * (skill.matkMultiplier || 0));
                            else if (isMagical) atkStat = ps.matk * (skill.multiplier || 1.0);
                            else atkStat = ps.atk * (skill.multiplier || 1.0);

                            if (skill.spdMultiplier) atkStat += ps.spd * skill.spdMultiplier;

                            let defStat = isPhysical ? (target.def || 0) : (target.mdef || target.def || 0);
                            if (skill.armorPen) defStat = Math.floor(defStat * (1 - (skill.armorPen || 0) / 100));

                            const crit = isCrit(ps, skill.critBonus || 0);
                            const hits = skill.hits || 1;
                            const dmgMult = 1.0; // 因為 atkStat 已經乘過倍率了

                            let totalDmg = 0;
                            for (let i = 0; i < hits; i++) {
                                const critDmgMult = Number(ps.crit_dmg) || 150;
                                const dmg = Math.floor(calcDamage(atkStat, defStat, dmgMult, ps.penetration_pct) * (crit ? (critDmgMult / 100) : 1));
                                totalDmg += (Number(dmg) || 0);
                            }

                            let extraMsg = '';
                            if (skill.recoverMp) {
                                ps.mp = Math.min(ps.max_mp, ps.mp + skill.recoverMp);
                                extraMsg += ` 💙恢復 ${skill.recoverMp} MP `;
                            }
                            if (skill.debuff) {
                                target.debuffs = target.debuffs || [];
                                target.debuffs.push({ ...skill.debuff, turns: skill.debuff.turns });
                                extraMsg += ` 📉負面狀態 `;
                            }
                            if (skill.stunChance && Math.random() * 100 < skill.stunChance) {
                                target.debuffs.push({ stunned: true, turns: 1 });
                                extraMsg += ` 💫眩暈 `;
                            }
                            if (skill.dot) {
                                target.debuffs = target.debuffs || [];
                                target.debuffs.push({ dot: skill.dot, turns: skill.dot.turns });
                                extraMsg += ` ☠️持續傷害 `;
                            }
                            if (skill.effect) {
                                ps.buffs.push({ ...skill.effect, turns: skill.effect.turns });
                            }
                            if (skill.shieldMultiplier) {
                                ps.shield = (ps.shield || 0) + Math.floor(atkStat * skill.shieldMultiplier);
                            }

                            // 設置冷卻時間
                            if (skill.cd) {
                                ps.cooldowns = ps.cooldowns || {};
                                ps.cooldowns[skill.id] = skill.cd + 1; // +1 是因為當前回合結束才算真正冷卻
                            }

                            const finalDmgToTarget = consumeShield(target, totalDmg);
                            target.currentHp = (Number(target.currentHp) || 0) - (Number(finalDmgToTarget) || 0);
                            log = `<@${userId}> 使用了 ${skill.emoji} ${skill.name}！造成 ${totalDmg} 傷害${crit ? ' 💥暴擊！' : ''}${hits > 1 ? ` (${hits}連擊)` : ''}${extraMsg}`;

                            // Hooks
                            const hitCtx = { actorIsPlayer: true };
                            log += executeSetHooks('onHit', ps, target, hitCtx);
                            log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmgToTarget });

                            if (ps.hp <= 0) log += `\n> 💀 <@${userId}> 被反彈傷害擊倒了！`;
                            if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);

                            // 雙重打擊 Hooks
                            if (hitCtx.doDoubleStrike && target.currentHp > 0 && ps.hp > 0) {
                                const avgDmg = Math.floor(totalDmg / hits);
                                const finalDmg2 = consumeShield(target, avgDmg);
                                target.currentHp -= finalDmg2;
                                log += `\n> ⚔️ 二連擊對 ${target.name} 造成 ${finalDmg2} 傷害！`;
                                log += executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                                log += executeSetHooks('onDamaged', target, ps, { originalDamage: finalDmg2 });
                                if (target.currentHp <= 0) log += executeSetHooks('onKill', ps, target);
                            }
                        }
                    }
                }
            }

            // ===== 道具選單 (按鈕) =====
            else if (id.startsWith('rpg_battle_item_')) {
                const { getInventory } = await import('../rpgDatabase.js');
                const inv = getInventory(interaction.guildId, userId);
                const usable = inv.filter(i => {
                    const shopItem = SHOP_ITEMS.consumables.find(s => s.id === i.item_id);
                    const itemDef = ITEM_NAMES[i.item_id];
                    const effect = shopItem?.effect || itemDef?.effect;
                    return effect && (effect.type === 'heal_hp' || effect.type === 'heal_mp' || effect.type === 'escape' || effect.type === 'buff');
                });

                if (usable.length === 0) {
                    return safeReply(interaction,{ content: '🐕 你沒有可以使用的道具！', flags: ['Ephemeral'] });
                }

                const options = usable.map(i => {
                    const def = SHOP_ITEMS.consumables.find(s => s.id === i.item_id);
                    return { label: `${def.name} x${i.quantity}`, description: def.desc, value: i.item_id, emoji: def.emoji };
                });

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId(`rpg_item_select_${battleId}`).setPlaceholder('選擇道具...').addOptions(options.slice(0, 25)),
                );
                const backRow = new ActionRowBuilder().addComponents(rpgButton(`rpg_battle_back_${battleId}`, '返回', undefined, '🔙'));
                const payload = { components: [row, backRow] };
                return safeReply(interaction, payload);
            }

            // ===== 道具使用 (下拉) =====
            else if (id.startsWith('rpg_item_select_')) {
                if (!interaction.isStringSelectMenu()) return;
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => { });
                const itemId = interaction.values[0];
                const def = SHOP_ITEMS.consumables.find(s => s.id === itemId);
                const { removeFromInventory } = await import('../rpgDatabase.js');
                if (!def || !removeFromInventory(interaction.guildId, userId, itemId)) {
                    const failMsg = { content: '🐕 道具使用失敗！', flags: ['Ephemeral'] };
                    return safeReply(interaction, failMsg);
                }

                const itemDefFromNames = ITEM_NAMES[itemId];
                const itemEffect = def?.effect || itemDefFromNames?.effect;

                if (!itemEffect) {
                    logger.error(`[Battle] Item ${itemId} has no effect defined.`);
                    return safeReply(interaction, { content: '🐕 該道具無法在此時使用！', flags: ['Ephemeral'] });
                }

                if (itemEffect.type === 'heal_hp') {
                    const heal = Math.floor(ps.max_hp * (itemEffect.percent / 100));
                    ps.hp = Math.min(ps.max_hp, ps.hp + heal);
                    log = `<@${userId}> 使用了 ${def?.emoji || itemDefFromNames?.emoji} ${def?.name || itemDefFromNames?.name}！回復了 ${heal} HP！`;
                } else if (itemEffect.type === 'heal_mp') {
                    const heal = Math.floor(ps.max_mp * (itemEffect.percent / 100));
                    ps.mp = Math.min(ps.max_mp, ps.mp + heal);
                    log = `<@${userId}> 使用了 ${def?.emoji || itemDefFromNames?.emoji} ${def?.name || itemDefFromNames?.name}！回復了 ${heal} MP！`;
                } else if (itemEffect.type === 'escape') {
                    updateCharacter(interaction.guildId, userId, { hp: ps.hp, mp: ps.mp });
                    battle.player_ids = battle.player_ids.filter(pid => pid !== userId);
                    delete battle.player_states[userId];
                    if (battle.player_ids.length === 0) {
                        deleteBattle(battleId);
                        activeBattleMessages.delete(battleId);
                    } else {
                        updateBattle(battleId, { player_ids: battle.player_ids, player_states: battle.player_states, monster_data: monsters, ally_summons: battle.ally_summons || [] });
                    }
                    const embed = rpgEmbed('🏃 逃跑成功！', `<@${userId}> 使用煙霧彈先行撤退了！`);
                    const payload = { embeds: [embed], components: [backButton()] };
                    return safeReply(interaction, payload);
                } else if (itemEffect.type === 'buff') {
                    ps.buffs = ps.buffs || [];
                    ps.buffs.push({ ...itemEffect, turns: itemEffect.turns, name: def?.name || itemDefFromNames?.name, emoji: def?.emoji || itemDefFromNames?.emoji });
                    log = `<@${userId}> 使用了 ${def?.emoji || itemDefFromNames?.emoji} ${def?.name || itemDefFromNames?.name}！獲得了強效增益！`;
                }
            }

            // ===== 逃跑 (按鈕) =====
            else if (id.startsWith('rpg_battle_flee_')) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => { });
                const escapeChance = 30 + (ps.spd || 0) * 0.5;
                if (Math.random() * 100 < escapeChance) {
                    updateCharacter(interaction.guildId, userId, { hp: ps.hp, mp: ps.mp });
                    battle.player_ids = battle.player_ids.filter(pid => pid !== userId);
                    delete battle.player_states[userId];
                    if (battle.player_ids.length === 0) {
                        deleteBattle(battleId);
                        activeBattleMessages.delete(battleId);
                    } else {
                        updateBattle(battleId, { player_ids: battle.player_ids, player_states: battle.player_states, monster_data: monsters, ally_summons: battle.ally_summons || [] });
                    }
                    const payload = { embeds: [rpgEmbed('🏃 逃跑成功！', `<@${userId}> 成功撤離了戰地。`)], components: [backButton()] };
                    return safeReply(interaction, payload);
                }
                log = `<@${userId}> 逃跑失敗！`;
            }
        }

        // ===== 檢查怪物是否死亡 (玩家攻擊後) =====
        log += handleBossDeathIntercept(monsters);
        alives = monsters.map((m, i) => { m.index = i; return m; }).filter(m => m.currentHp > 0);
        if (alives.length === 0) {
            battle.monster_data = monsters;
            return handleVictory(interaction, battle, battleId, log);
        }

        // ===== 傭兵 AI 戰術階段 =====
        const hiredMercs = battle.player_ids.filter(pid => pid !== userId && battle.player_states[pid].hp > 0 && battle.player_states[pid].isMercenary);
        if (hiredMercs.length > 0) {
            log += '\n';
            for (const mId of hiredMercs) {
                if (alives.length === 0) break;
                const mps = battle.player_states[mId];

                // 找出最需要治療的人 (HP% 最低的)
                const sortedByHp = battle.player_ids
                    .map(pid => ({ id: pid, ps: battle.player_states[pid] }))
                    .filter(p => p.ps.hp > 0)
                    .sort((a, b) => (a.ps.hp / a.ps.max_hp) - (b.ps.hp / b.ps.max_hp));

                const mostWounded = sortedByHp[0];
                let acted = false;

                // 取得傭兵本尊實際學過的技能
                const mySkills = (mps.learnedSkills || []).map(sid => getSkillDef(sid)).filter(s => s && mps.mp >= s.mp);
                const mClass = mps.class || 'warrior';

                // 邏輯 A：如果有人血量低於 60%，優先找治療技能
                if (mostWounded.ps.hp / mostWounded.ps.max_hp < 0.6) {
                    const healSkill = mySkills.find(s => (s.type === 'heal' || s.healPercent) && (s.target === 'single_ally' || s.target === 'party'));
                    if (healSkill) {
                        mps.mp -= healSkill.mp;
                        if (healSkill.target === 'party') {
                            battle.player_ids.forEach(pid => {
                                const targetPs = battle.player_states[pid];
                                if (targetPs.hp > 0) {
                                    const amt = Math.floor(targetPs.max_hp * (healSkill.healPercent / 100));
                                    targetPs.hp = Math.min(targetPs.max_hp, targetPs.hp + amt);
                                }
                            });
                            log += `\n🛡️ 傭兵 <@${mId}> 施放了 **${healSkill.name}**！全隊回復了生命！`;
                        } else {
                            const amt = Math.floor(mostWounded.ps.max_hp * (healSkill.healPercent / 100));
                            mostWounded.ps.hp = Math.min(mostWounded.ps.max_hp, mostWounded.ps.hp + amt);
                            log += `\n🛡️ 傭兵 <@${mId}> 對 ${mostWounded.id === userId ? '您' : `<@${mostWounded.id}>`} 施放了 **${healSkill.name}**！回復了 ${amt} HP！`;
                        }
                        acted = true;
                    }
                }

                // 邏輯 B：如果有複數敵人，優先找群體攻擊
                if (!acted && alives.length >= 2) {
                    const aoeSkill = mySkills.find(s => s.target === 'all' && (s.type === 'physical' || s.type === 'magical'));
                    if (aoeSkill) {
                        mps.mp -= aoeSkill.mp;
                        log += `\n⚔️ 傭兵 <@${mId}> 施放了全體技能 **${aoeSkill.name}**！`;
                        for (const mObj of monsters) {
                            if (mObj.currentHp > 0) {
                                const isPhys = aoeSkill.type === 'physical';
                                const dmg = Math.floor(calcDamage(isPhys ? mps.atk : mps.matk, isPhys ? mObj.def : mObj.mdef, aoeSkill.multiplier || 1));
                                const finalDmg = consumeShield(mObj, dmg);
                                mObj.currentHp -= finalDmg;
                                log += executeSetHooks('onHit', mps, mObj, { actorIsPlayer: true });
                                log += executeSetHooks('onDamaged', mObj, mps, { originalDamage: finalDmg });
                                if (mObj.currentHp <= 0) log += executeSetHooks('onKill', mps, mObj);
                            }
                        }
                        acted = true;
                    }
                }

                // 邏輯 C：單體高倍率技能
                if (!acted) {
                    const bestDmgSkill = mySkills
                        .filter(s => s.target === 'single' && (s.type === 'physical' || s.type === 'magical'))
                        .sort((a, b) => (b.multiplier || 0) - (a.multiplier || 0))[0];

                    if (bestDmgSkill) {
                        const target = alives.sort((a, b) => a.currentHp - b.currentHp)[0];
                        mps.mp -= bestDmgSkill.mp;
                        const isPhys = bestDmgSkill.type === 'physical';
                        const dmg = Math.floor(calcDamage(isPhys ? mps.atk : mps.matk, isPhys ? target.def : target.mdef, bestDmgSkill.multiplier || 1));
                        const finalDmg = consumeShield(target, dmg);
                        target.currentHp -= finalDmg;
                        log += `\n⚔️ 傭兵 <@${mId}> 對 ${target.name} 發動了 **${bestDmgSkill.name}**！造成 ${dmg} 傷害！`;
                        log += executeSetHooks('onHit', mps, target, { actorIsPlayer: true });
                        log += executeSetHooks('onDamaged', target, mps, { originalDamage: finalDmg });
                        if (target.currentHp <= 0) log += executeSetHooks('onKill', mps, target);
                        acted = true;
                    }
                }

                // D. 職業保底技能 (如果沒學到技能或 MP 分配問題)
                if (!acted) {
                    if (mClass === 'paladin' && mps.mp >= 12 && mostWounded.ps.hp / mostWounded.ps.max_hp < 0.7) {
                        const healAmt = Math.floor(mostWounded.ps.max_hp * 0.3);
                        mostWounded.ps.hp = Math.min(mostWounded.ps.max_hp, mostWounded.ps.hp + healAmt);
                        mps.mp -= 12;
                        log += `\n🛡️ [聖騎士] <@${mId}> 對 ${mostWounded.id === userId ? '您' : `<@${mostWounded.id}>`} 使用了 **治癒之光**！回復了 ${healAmt} HP！`;
                        acted = true;
                    } else if (mClass === 'mage' && mps.mp >= 25 && alives.length >= 2) {
                        mps.mp -= 25;
                        log += `\n🔮 [法師] <@${mId}> 施放了 **火焰風暴**！`;
                        for (const mObj of monsters) {
                            if (mObj.currentHp > 0) {
                                const dmg = Math.floor(calcDamage(mps.matk || mps.atk, mObj.mdef || mObj.def) * 1.5);
                                const finalDmg = consumeShield(mObj, dmg);
                                mObj.currentHp -= finalDmg;
                                log += executeSetHooks('onHit', mps, mObj, { actorIsPlayer: true });
                                log += executeSetHooks('onDamaged', mObj, mps, { originalDamage: finalDmg });
                                if (mObj.currentHp <= 0) log += executeSetHooks('onKill', mps, mObj);
                            }
                        }
                        acted = true;
                    } else if (mps.mp >= 10) {
                        const target = alives.sort((a, b) => a.currentHp - b.currentHp)[0];
                        if (mClass === 'warrior') {
                            mps.mp -= 8;
                            const dmg = Math.floor(calcDamage(mps.atk, target.def) * 1.8);
                            const finalDmg = consumeShield(target, dmg);
                            target.currentHp -= finalDmg;
                            log += `\n⚔️ [劍士] <@${mId}> 發動 **猛力斬擊**！對 ${target.name} 造成 ${dmg} 傷害！`;
                            log += executeSetHooks('onHit', mps, target, { actorIsPlayer: true });
                            log += executeSetHooks('onDamaged', target, mps, { originalDamage: finalDmg });
                            if (target.currentHp <= 0) log += executeSetHooks('onKill', mps, target);
                            acted = true;
                        } else if (mClass === 'ranger') {
                            mps.mp -= 15;
                            const dmg = Math.floor(calcDamage(mps.atk, target.def) * 2.2);
                            const finalDmg = consumeShield(target, dmg);
                            target.currentHp -= finalDmg;
                            log += `\n🏹 [遊俠] <@${mId}> 發動 **致命狙擊**！對 ${target.name} 造成 ${dmg} 傷害！`;
                            log += executeSetHooks('onHit', mps, target, { actorIsPlayer: true });
                            log += executeSetHooks('onDamaged', target, mps, { originalDamage: finalDmg });
                            if (target.currentHp <= 0) log += executeSetHooks('onKill', mps, target);
                            acted = true;
                        }
                    }
                }

                // E. 普通攻擊 (絕對保底)
                if (!acted) {
                    const target = alives.sort((a, b) => a.currentHp - b.currentHp)[0];
                    if (isDodge(target)) {
                        log += `\n🛡️ 傭兵 <@${mId}> 試圖攻擊 ${target.name}！但被閃避了！`;
                    } else {
                        const crit = isCrit(mps);
                        const dmg = Math.floor(calcDamage(mps.atk, target.def) * (crit ? 1.5 : 1));
                        const finalDmg = consumeShield(target, dmg);
                        target.currentHp -= finalDmg;
                        log += `\n🛡️ 傭兵 <@${mId}> 攻擊了 ${target.name}！造成 ${finalDmg} 傷害${crit ? ' 💥暴擊' : ''}`;
                        log += executeSetHooks('onHit', mps, target, { actorIsPlayer: true });
                        log += executeSetHooks('onDamaged', target, mps, { originalDamage: finalDmg });
                        if (target.currentHp <= 0) log += executeSetHooks('onKill', mps, target);
                    }
                }

                // 更新目前存活的怪物清單，避免下一個傭兵對已經死亡的怪進行攻擊 (鞭屍)
                alives = alives.filter(m => m.currentHp > 0);
            }

            log += handleBossDeathIntercept(monsters);
            alives = monsters.map((m, i) => { m.index = i; return m; }).filter(m => m.currentHp > 0);
            if (alives.length === 0) {
                battle.monster_data = monsters;
                return handleVictory(interaction, battle, battleId, log);
            }
        }

        // ===== 召喚物攻擊階段 =====
        battle.ally_summons = battle.ally_summons || [];
        const aliveSummons = battle.ally_summons.filter(s => s.hp > 0);
        if (aliveSummons.length > 0) {
            log += '\n';
            for (const s of aliveSummons) {
                const currentAlives = monsters.map((m, i) => { m.index = i; return m; }).filter(m => m.currentHp > 0);
                if (currentAlives.length === 0) break;
                const target = currentAlives[Math.floor(Math.random() * currentAlives.length)];

                if (isDodge(target)) {
                    log += `\n${s.emoji} ${s.name} 攻擊了 ${target.name}！但被閃避了！`;
                } else {
                    const dmg = Math.floor(calcDamage(s.atk, target.def) * 1.5); // Summons magic attack hits harder
                    monsters[target.index].currentHp -= dmg;
                    log += `\n${s.emoji} ${s.name} 攻擊了 ${target.name}！造成 ${dmg} 傷害！`;
                }
            }

            // 再次檢查怪物是否被召喚物打死
            log += handleBossDeathIntercept(monsters);
            alives = monsters.map((m, i) => { m.index = i; return m; }).filter(m => m.currentHp > 0);
            if (alives.length === 0) {
                battle.monster_data = monsters;
                return handleVictory(interaction, battle, battleId, log);
            }
        }

        // ===== 敵人全體輪流反擊 =====
        const survivingPlayers = battle.player_ids.filter(pid => battle.player_states[pid].hp > 0);
        const existingSummons = battle.ally_summons.filter(s => s.hp > 0);

        if (survivingPlayers.length > 0 || existingSummons.length > 0) {
            log += '\n';
            for (const m of alives) {
                // 現存活玩家與召喚物
                const currentSurvivingPlayers = battle.player_ids.filter(pid => battle.player_states[pid].hp > 0).map(id => ({ type: 'player', id }));
                const currentSurvivingSummons = battle.ally_summons.map((s, idx) => ({ type: 'summon', index: idx, hp: s.hp })).filter(s => s.hp > 0);

                const potentialTargets = [...currentSurvivingPlayers, ...currentSurvivingSummons];
                if (potentialTargets.length === 0) break; // 剛好死光了

                // 挑選目標 (考慮 Taunt 嘲諷)
                let targetInfo;
                const tauntedPlayers = currentSurvivingPlayers.filter(p => hasState(battle.player_states[p.id], 'taunt'));
                if (tauntedPlayers.length > 0) {
                    targetInfo = tauntedPlayers[Math.floor(Math.random() * tauntedPlayers.length)];
                } else {
                    targetInfo = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                }

                // 每隻怪物挑一個隨機存活隊員或召喚物攻擊
                if (m.isBoss) {
                    log += await handleBossAttack(m, battle, potentialTargets, calcDamage, isDodge, interaction);
                } else {
                    let skillTriggered = false;

                    if (m.skills && m.skills.length > 0) {
                        for (const sk of m.skills) {
                            if (Math.random() * 100 <= (sk.chance || 0)) {
                                log += await applyMonsterSkill(m, sk, targetInfo, battle, calcDamage, isDodge, interaction);
                                skillTriggered = true;
                                break;
                            }
                        }
                    }

                    if (!skillTriggered) {
                        log += await applyMonsterSkill(m, null, targetInfo, battle, calcDamage, isDodge, interaction);
                    }
                }
            }
        }

        // ===== 結算 DOT 與 Buff 持續時間 =====
        for (const _pid of battle.player_ids) log += processTurnEndStates(battle.player_states[_pid], true) || '';
        if (battle.ally_summons) {
            for (const s of battle.ally_summons) log += processTurnEndStates(s, false) || '';
        }
        for (const m of monsters) log += processTurnEndStates(m, false) || '';

        log += handleBossDeathIntercept(monsters);
        const finalAlivesMonsters = monsters.map((m, i) => { m.index = i; return m; }).filter(m => m.currentHp > 0);
        if (finalAlivesMonsters.length === 0) {
            battle.monster_data = monsters;
            return handleVictory(interaction, battle, battleId, log);
        }

        // 檢查是否團滅
        const finalAlives = battle.player_ids.filter(pid => battle.player_states[pid].hp > 0);
        if (finalAlives.length === 0) {
            deleteBattle(battleId);
            activeBattleMessages.delete(battleId);
            const embed = rpgEmbed('💀 隊伍全滅...', [
                '勇士們全軍覆沒了！',
                '',
                '🚫 行囊中已無藥物，請前往貿易所整備。',
            ].join('\n'));
            const payload = { embeds: [embed], components: [backButton()] };
            return safeReply(interaction, payload);
        }

        // 更新戰鬥狀態
        updateBattle(battleId, {
            monster_data: monsters,
            player_states: battle.player_states,
            ally_summons: battle.ally_summons || [],
            turn: battle.turn + 1,
        });

        await renderBattle(interaction, battleId, log);
    } catch (e) {
        logger.error('[Battle] Action error:', e);
            await safeReply(interaction, { content: '🐕 戰鬥發生錯誤！', flags: ['Ephemeral'] }).catch(() => { });
    }
}

async function applyMonsterSkill(m, skill, targetInfo, battle, calcDamage, isDodge, interaction) {
    let turnLog = '';
    const isPlayer = targetInfo.type === 'player';
    const target = isPlayer ? battle.player_states[targetInfo.id] : battle.ally_summons[targetInfo.index];
    const targetId = isPlayer ? targetInfo.id : null;
    const targetName = isPlayer ? `<@${targetId}>` : target.name;

    // 1. 處理無攻擊性的技能 (Buff/Heal/Shield)
    if (skill) {
        if (skill.type === 'buff') {
            const val = Math.floor(m[skill.stat] * (skill.percent / 100));
            m[skill.stat] += val;
            return `\n✨ ${m.emoji} **${m.name}** 施展了 [${skill.name}]！其 ${skill.stat.toUpperCase()} 提升了 ${skill.percent}%！`;
        }
        if (skill.type === 'heal') {
            const heal = Math.floor(m.hp * (skill.healPercent / 100));
            m.hp = Math.min(m.hp + heal, m.max_hp || m.hp * 2); // 怪物通常沒定義 max_hp，這裡簡單處理
            return `\n💚 ${m.emoji} **${m.name}** 施展了 [${skill.name}]！回復了 ${heal} HP！`;
        }
    }

    // 2. 處理攻擊性技能或普攻
    if (isDodge(target)) {
        return `\n${m.emoji} ${m.name} 對 ${targetName} 的攻擊被閃避了！`;
    }

    const isMagical = skill ? skill.type === 'magical' : ['tree_spirit', 'fire_elemental', 'void_walker', 'crystal_golem'].includes(m.id);
    const multiplier = skill ? (skill.multiplier || 1.0) : 1.0;
    const defStat = isMagical ? (target.mdef || Math.floor(target.def * 0.8)) : (target.def || 0);

    let damage = Math.floor(calcDamage(m.atk, defStat) * multiplier);

    // 多段攻擊
    let hits = skill?.hits || 1;
    let totalDmg = 0;
    for (let i = 0; i < hits; i++) {
        totalDmg += consumeShield(target, damage);
    }
    target.hp -= totalDmg;

    // 反彈傷害 (Reflection)
    let reflectMsg = '';
    const reflectBuff = (target.buffs || []).find(b => b.reflect);
    if (reflectBuff && !isMagical) { // 物理反彈
        const reflectDmg = Math.floor(totalDmg * (reflectBuff.reflect / 100));
        m.currentHp -= reflectDmg;
        reflectMsg = ` (反彈回 ${reflectDmg} 傷害！)`;
    }

    const skillPrefix = skill ? `施展了 [${skill.name}]！` : `發動了反擊！`;
    turnLog += `\n${m.emoji} **${m.name}** ${skillPrefix}對 ${targetName} 造成 ${totalDmg} ${isMagical ? '(✨魔法)' : ''} 傷害！${reflectMsg}`;

    // 額外效果 (DOT/Debuff/Shield) - 考慮免疫
    if (skill) {
        const hasImmunity = (target.buffs || []).findIndex(b => b.debuffImmunity);
        if (hasImmunity !== -1 && (skill.dot || skill.debuff)) {
            target.buffs.splice(hasImmunity, 1);
            turnLog += ` (被神聖領域抵銷了負面狀態！)`;
        } else {
            if (skill.dot) {
                target.debuffs = target.debuffs || [];
                target.debuffs.push({ dot: skill.dot, turns: skill.dot.turns });
                turnLog += ` 使其陷入持續傷害狀態！`;
            }
            if (skill.debuff) {
                target.debuffs = target.debuffs || [];
                target.debuffs.push({ ...skill.debuff, turns: skill.debuff.turns });
                turnLog += ` 使其 ${skill.debuff.stat.toUpperCase()} 降低了！`;
            }
            if ((skill.stunChance && Math.random() * 100 < skill.stunChance) || (skill.stun && Math.random() * 100 < 15)) {
                target.debuffs = target.debuffs || [];
                target.debuffs.push({ stunned: true, turns: 1 });
                turnLog += ` ⚠️ 使其陷入了眩暈！`;
            }
        }
        if (skill.type === 'shield') {
            m.shield = (m.shield || 0) + Math.floor(m.atk * skill.shieldMultiplier);
            turnLog += ` 並為自己加持了護盾！`;
        }
        if (skill.drainMp && isPlayer) {
            const drain = Math.floor(target.mp * 0.2);
            target.mp -= drain;
            turnLog += ` 並吸收了 ${drain} 點 MP！`;
        }
    }

    // 死亡結算
    if (target.hp <= 0) {
        target.hp = 0;
        if (isPlayer) {
            if (target.isMercenary) {
                turnLog += `\n🛡️ 助戰傭兵 ${targetName} 倒下了！`;
            } else {
                const char = getCharacter(interaction.guildId, targetId);
                const newDeaths = (char.deaths || 0) + 1;
                const newStreak = (char.lose_streak || 0) + 1;
                updateCharacter(interaction.guildId, targetId, { hp: 0, mp: target.mp, deaths: newDeaths, lose_streak: newStreak });
                turnLog += `\n💀 ${targetName} 倒下了！`;

                const victim = await interaction.guild.members.fetch(targetId).catch(() => null);
                const vName = victim ? victim.displayName : interaction.user.username;
                await broadcastRpgEvent(interaction.client, interaction.guildId, {
                    title: '壯烈犧牲',
                    description: `冒險者 ${fmt(COLORS.BLUE, vName)} 在對抗 ${fmt(COLORS.WHITE, m.name)} 時不幸戰死...\n${fmt(COLORS.RED, '當前連敗數: ' + newStreak)}\n${fmt(COLORS.GRAY, '生涯死亡數: ' + newDeaths)}`,
                    color: 0x880000,
                    type: 'death'
                });

                if (newStreak === 3) {
                    await broadcastRpgEvent(interaction.client, interaction.guildId, {
                        title: '連敗之恥！',
                        description: `冒險者 ${fmt(COLORS.BLUE, vName)} 已經連續慘死 3 次了！\n${fmt(COLORS.GOLD, '請大家捐獻一點藥水給他吧！')}`,
                        color: 0x555555,
                        type: 'death'
                    });
                } else if (newStreak === 5) {
                    await broadcastRpgEvent(interaction.client, interaction.guildId, {
                        title: '天命煞星！',
                        description: `冒險者 ${fmt(COLORS.BLUE, vName)} 達成了 ${fmt(COLORS.RED, '5 連敗')} 的悲慘成就！\n${fmt(COLORS.GRAY, '他簡直在吸引魔物的攻擊！')}`,
                        color: 0x000000
                    });
                }
            }
        } else { // This else block belongs to `if (isPlayer)`
            turnLog += `\n👻 ${targetName} 被擊散了！`;
        }
    }

    return turnLog;
}

// ---------- 勝利處理 ----------
async function handleVictory(interaction, battle, battleId, log) {
    const guildId = interaction.guildId;
    let monsters = Array.isArray(battle.monster_data) ? battle.monster_data : [battle.monster_data];
    const alives = battle.player_ids.filter(pid => battle.player_states[pid].hp > 0);

    // 獎勵結算 (累加所有怪物的 XP/Gold)
    let xpGain = 0;
    let goldGain = 0;
    for (const m of monsters) {
        xpGain += m.xp || 10;
        goldGain += m.gold || 5;
    }

    // 道具隨機分配
    const distributionLogs = [];
    const drops = [];
    const pickerCache = {};

    const getPickerName = async (pid) => {
        if (pickerCache[pid]) return pickerCache[pid];
        const picker = await interaction.guild.members.fetch(pid).catch(() => null);
        const name = picker ? picker.displayName : interaction.user.username;
        pickerCache[pid] = name;
        return name;
    }

    const awardItem = async (pid, itemId, isEquip, quality = 'common') => {
        if (isEquip) {
            const pLevel = battle.player_states[pid]?.level || 1;
            addEquipment(guildId, pid, itemId, quality, pLevel);
        } else {
            addToInventory(guildId, pid, itemId);
        }

        const pName = await getPickerName(pid);
        const nameStr = getItemDisplayName(itemId) + (isEquip ? ` [${qualityLabel(quality)}]` : '');
        const coloredName = formatItemName(nameStr, quality);

        distributionLogs.push(fmt(COLORS.GRAY, `[${pName}]`) + ` 📦 獲得 ${coloredName}`);

        // 極品掉落廣播
        if (['epic', 'mythic', 'legendary'].includes(quality)) {
            let qColor = quality === 'epic' ? 0x9b59b6 : quality === 'mythic' ? 0xe74c3c : 0xe67e22;
            let qName = quality === 'epic' ? '🟣 史詩' : quality === 'mythic' ? '🔴 神話' : '🟠 傳說';
            let colorCode = quality === 'epic' ? COLORS.MAGENTA : quality === 'mythic' ? COLORS.RED : COLORS.GOLD;

            const picker = await interaction.guild.members.fetch(pid).catch(() => null);
            const pName = picker ? picker.displayName : interaction.user.username;

            await broadcastRpgEvent(interaction.client, guildId, {
                title: '極品裝備現世！',
                description: `運氣爆棚！冒險者 ${fmt(COLORS.BLUE, pName)} 從怪物身上\n獲得了 ${fmt(colorCode, qName)} 品質的「${fmt(COLORS.WHITE, getItemDisplayName(itemId))}」！`,
                color: qColor,
                type: 'rare_drop'
            });
        }

        drops.push({ id: itemId, isEquip, quality });
    };

    // 怪物掉落 (遍歷每隻怪物，多怪有機率加成)
    const dropMultiplier = 1 + (monsters.length - 1) * 0.2; // 每多一隻怪，掉落率增加 20%
    for (const m of monsters) {
        if (m.drops) {
            for (const drop of m.drops) {
                if (Math.random() * 100 < drop.chance * dropMultiplier) {
                    const receiverId = alives[Math.floor(Math.random() * alives.length)];
                    const eqDef = EQUIPMENT[drop.id];
                    let quality = eqDef ? eqDef.quality : 'common';
                    
                    // 5% 機率觸發區域共鳴 (幸運掉落)
                    let resonanceTriggered = false;
                    if (Math.random() < 0.05) {
                        const resonanceQuality = rollQualityForArea(battle.area_id);
                        const betterQuality = getBetterQuality(quality, resonanceQuality);
                        if (betterQuality !== quality) {
                            quality = betterQuality;
                            resonanceTriggered = true;
                        }
                    }

                    if (resonanceTriggered && ['epic', 'mythic', 'legendary'].includes(quality)) {
                        const pName = await getPickerName(receiverId);
                        const qName = qualityLabel(quality);
                        await broadcastRpgEvent(interaction.client, guildId, {
                            title: '🌟 區域共鳴：奇蹟降臨！',
                            description: `大地發出了共鳴！冒險者 ${fmt(COLORS.BLUE, pName)} 在此區域戰鬥時，\n受到英靈的加護，將原本平凡的獎勵昇華為\n${fmt(COLORS.GOLD, qName)} 品質的「${fmt(COLORS.WHITE, getItemDisplayName(drop.id))}」！`,
                            color: 0x00FFFF,
                            type: 'rare_drop'
                        });
                    }

                    await awardItem(receiverId, drop.id, !!drop.isEquip, quality);
                }
            }
        }
    }

    // 技能書掉落 (基於區域，依怪物數量獲得掉率加成)
    const areaId = battle.area_id;
    const pool = SKILL_BOOK_DROP_POOLS[areaId];
    if (pool && Math.random() * 100 < pool.chance * (1 + (monsters.length - 1) * 0.5)) { // 技能書多怪加成更高 (每多一隻 +50%)
        const bookId = pool.books[Math.floor(Math.random() * pool.books.length)];
        const receiverId = alives[Math.floor(Math.random() * alives.length)];
        await awardItem(receiverId, bookId, false);
    }

    // 發放經驗與金幣
    // Employer ID is the first one or the one not `isMercenary`
    const employerId = battle.player_ids.find(id => !battle.player_states[id].isMercenary) || battle.player_ids[0];

    for (const pid of battle.player_ids) {
        const ps = battle.player_states[pid];
        if (ps) {
            let actualGold = goldGain;
            let actualXp = xpGain;

            if (ps.isMercenary) {
                // 傭兵只分到 30% 收成
                actualGold = Math.floor(goldGain * 0.3);
                actualXp = Math.floor(xpGain * 0.3);
                // 記錄歷史
                const monsterNames = Array.from(new Set(monsters.map(m => m.name))).join(', ');
                addMercenaryHistory(guildId, pid, employerId, monsterNames, actualGold, actualXp);
            }

            addGold(guildId, pid, actualGold);
            const char = getCharacter(guildId, pid);
            let xp = char.xp + actualXp;
            let level = char.level;
            let freePoints = char.free_points;
            let leveledUp = false;
            let needed = getXpForLevel(level + 1);
            const growthUpdates = {}; // 累積 class growth 成長
            while (xp >= needed) {
                xp -= needed;
                level++;
                freePoints += 5;
                leveledUp = true;
                needed = getXpForLevel(level + 1);

                // 套用 class growth （每升一級加一次）
                const cls = CLASSES[char.class];
                if (cls) {
                    for (const [stat, val] of Object.entries(cls.growth)) {
                        if (stat === 'hp') {
                            growthUpdates.max_hp = (growthUpdates.max_hp ?? char.max_hp) + val;
                        } else if (stat === 'mp') {
                            growthUpdates.max_mp = (growthUpdates.max_mp ?? char.max_mp) + val;
                        } else {
                            growthUpdates[stat] = (growthUpdates[stat] ?? char[stat]) + val;
                        }
                    }
                }

                // 里程碑廣播
                if ([30, 60, 90, 99].includes(level)) {
                    const leveler = await interaction.guild.members.fetch(pid).catch(() => null);
                    const lName = leveler ? leveler.displayName : interaction.user.username;
                    const newTitle = getJobTitle({ class: char.class, level: level });

                    await broadcastRpgEvent(interaction.client, guildId, {
                        title: '位階突破！',
                        description: `太驚人了！冒險者 ${fmt(COLORS.BLUE, lName)} 晉升為 ${fmt(COLORS.GOLD, newTitle)}！\n達到了 ${fmt(COLORS.GREEN, 'Lv.' + level)} 的全新境界！\n快去看看學會了什麼強大的新技能吧！`,
                        color: level >= 60 ? 0xFFAA00 : 0x00FF00,
                        type: 'milestone'
                    });
                }
            }
            const updateObj = {
                xp, level, free_points: freePoints,
                wins: char.wins + 1,
                lose_streak: 0,
                ...growthUpdates,
            };

            // 只有本人會受到血量魔量消耗影響，傭兵分身不回寫狀態
            if (!ps.isMercenary) {
                // 使用戰場上的實質上限（含裝備）來判斷，若有升級則加上成長值
                const hpGrowth = growthUpdates.max_hp ? (growthUpdates.max_hp - char.max_hp) : 0;
                const mpGrowth = growthUpdates.max_mp ? (growthUpdates.max_mp - char.max_mp) : 0;
                const finalMaxHp = ps.max_hp + hpGrowth;
                const finalMaxMp = ps.max_mp + mpGrowth;

                updateObj.hp = Math.min(ps.hp, finalMaxHp);
                updateObj.mp = Math.min(ps.mp, finalMaxMp);

                // 升級時贈送成長值的補血
                if (hpGrowth > 0) updateObj.hp = Math.min(updateObj.hp + hpGrowth, finalMaxHp);
                if (mpGrowth > 0) updateObj.mp = Math.min(updateObj.mp + mpGrowth, finalMaxMp);
            }

            updateCharacter(guildId, pid, updateObj);
            // 追加 Boss 首殺判斷
            for (const m of monsters) {
                if (m.isBoss) {
                    const isFirstKill = registerFirstKill(guildId, m.id, battle.player_ids);
                    if (isFirstKill) {
                        const members = await Promise.all(battle.player_ids.map(id => interaction.guild.members.fetch(id).catch(() => null)));
                        const playerNames = members.filter(m => m).map(m => m.displayName).join('、');
                        await broadcastRpgEvent(interaction.client, guildId, {
                            title: '🏆 傳奇誕生：世界首殺！',
                            description: `${fmt(COLORS.GOLD, '史無前例！')} ${fmt(COLORS.WHITE, m.name)} 被擊敗了！\n恭喜 ${fmt(COLORS.BLUE, playerNames)} 締造了這項成就！\n他們的英姿將被銘刻在王國歷代記英雄榜上！`,
                            color: 0xFFD700,
                            type: 'first_kill'
                        });
                    }
                }
            }

            // 追蹤任務
            (async () => {
                const { trackQuestProgress } = await import('../engine/questEngine.js');
                const leveler = await interaction.guild.members.fetch(pid).catch(() => null);
                const lName = leveler ? leveler.displayName : interaction.user.username;

                trackQuestProgress(guildId, pid, 'win_battle');
                for (const m of monsters) {
                    let result;
                    if (m.isBoss) {
                        result = trackQuestProgress(guildId, pid, 'kill_boss', { bossId: m.id });
                        updateCharacter(guildId, pid, { boss_kills: (getCharacter(guildId, pid).boss_kills || 0) + 1 });
                    } else if (m.id) {
                        result = trackQuestProgress(guildId, pid, 'kill_monster', { monsterId: m.id });
                    }

                    if (result?.completed) {
                        await broadcastRpgEvent(interaction.client, guildId, {
                            title: '⚔️ 章節突破！',
                            description: `重大進展！冒險者 ${fmt(COLORS.BLUE, lName)} 成功完成了任務：\n「${fmt(COLORS.CYAN, result.quest.name)}」！\n王國的大門已為你進一步敞開！`,
                            color: 0x1ABC9C,
                            type: 'quest_complete'
                        });
                    }
                }
            })();
        }
    }

    deleteBattle(battleId);

    const embed = rpgEmbed(
        '🎉 戰鬥勝利！',
        [
            `${log}`,
            '',
            `成功擊退了 ${monsters.length} 隻怪物！`,
            '',
            `⭐ 每人獲得經驗值 +${xpGain}`,
            `💰 每人獲得金幣 +${goldGain}`,
            '',
            distributionLogs.length > 0 ? `**📦 道具分配：**\n\`\`\`ansi\n${distributionLogs.join('\n')}\n\`\`\`` : '（此次戰鬥無掉落物）',
        ].join('\n'),
    ).setFooter({ text: `🐕👑 吉吉王國騎士團` });

    const row = new ActionRowBuilder().addComponents(
        rpgButton(`rpg_area_${areaId}`, '繼續冒險', undefined, '⚔️'),
        rpgButton('rpg_menu', '返回主選單', undefined, '🔙'),
    );

    const payload = { embeds: [embed], components: [row] };

    try {
        await safeReply(interaction, payload).catch(() => { });
    } catch (e) { }

    // 清除該戰鬥記錄與緩存
    activeBattleMessages.delete(battleId);
}
