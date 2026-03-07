import { ActionRowBuilder } from 'discord.js';
import { rpgEmbed, rpgButton, backButton, calcDamage, isCrit, isDodge, qualityLabel, broadcastRpgEvent, calculateTotalStats, getJobTitle, formatItemName, executeSetHooks } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';
import { getCharacter, updateCharacter, addGold, addToInventory, addEquipment, registerFirstKill, addMercenaryHistory, getEquipmentList } from '../rpgDatabase.js';
import { logger } from '../../utils/logger.js';
import { MONSTERS, BOSSES, EQUIPMENT, getXpForLevel, getItemDisplayName, SKILL_BOOK_DROP_POOLS, getSkillDef, AREAS, CLASSES, ITEM_NAMES, EQUIP_SELL_PRICES } from '../data/gameData.js';
import { activeMercenaries } from '../screens/mercenary.js';
import { trackQuestProgress } from './questEngine.js';

export async function runAutoFarm(interaction, char, areaId, roundsCount) {
    if (!interaction) return;
    try {
        // 因呼叫端(adventure.js)已經 deferUpdate 了，這裡通常不需重複做，但保留基本的安全確認
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => { });
        }

        if (char.hp <= 0) {
            return interaction.followUp({ content: '🐕 你的生命值已經歸零，無法進行自動探索！請先吃藥回復生命值。', flags: ['Ephemeral'] }).catch(() => { });
        }

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const monstersDef = MONSTERS[areaId];
        if (!monstersDef || monstersDef.length === 0) return;

        let totalGold = 0;
        let totalXp = 0;
        let dropsList = [];

        let autoSkills = [];
        try {
            if (char.auto_skills) autoSkills = JSON.parse(char.auto_skills);
        } catch (e) { }

        let playerHp = char.hp;
        let playerMp = char.mp;

        const hiredMcs = activeMercenaries.get(userId) || [];
        const partyDefs = [];
        const equipList = getEquipmentList(guildId, userId);
        const total = calculateTotalStats(char, equipList);

        let mercEarnedGold = {};
        let mercEarnedXp = {};

        for (const mId of hiredMcs) {
            const mChar = getCharacter(guildId, mId);
            if (mChar && mChar.allow_mercenary === 1) {
                let mName = mId;
                const mMember = await interaction.guild.members.fetch(mId).catch(() => null);
                if (mMember) {
                    mName = mMember.displayName;
                } else {
                    const mUser = await interaction.client.users.fetch(mId).catch(() => null);
                    if (mUser) mName = mUser.username;
                }
                partyDefs.push({ id: mId, ...mChar, isMercenary: true, name: mName });
                mercEarnedGold[mId] = 0;
                mercEarnedXp[mId] = 0;
            }
        }
        const partySize = 1 + partyDefs.length;

        let completedRounds = 0;
        let deathReason = null;
        let bossKillsCount = 0;

        // 用於追蹤 CD 與 狀態 的物件
        let playerCooldowns = {};
        let playerInvulnerableTurns = 0;
        let playerShield = 0;
        let playerBuffs = [];
        let playerDebuffs = [];

        // Wrap player info to pass to hooks smoothly
        const getPlayerState = () => ({
            id: userId,
            name: char.name || interaction.user.username,
            hp: playerHp,
            max_hp: total.max_hp,
            mp: playerMp,
            max_mp: total.max_mp,
            atk: total.atk,
            matk: total.matk,
            def: total.def,
            mdef: total.mdef,
            spd: total.spd,
            shield: playerShield,
            buffs: playerBuffs,
            debuffs: playerDebuffs,
            setHooks: total.setHooks || {}
        });

        for (let currentRound = 1; currentRound <= roundsCount; currentRound++) {
            if (playerHp <= 0) break;

            const encounterRoll = Math.random() * 100;
            if (encounterRoll < 20) {
                const eventGold = Math.floor(Math.random() * 50 + 10);
                totalGold += eventGold;
                playerHp = Math.min(total.max_hp, playerHp + 20);
                playerMp = Math.min(total.max_mp, playerMp + 10);
                completedRounds++;
                continue;
            }

            const bossRoll = Math.random() * 100;
            const bossDef = BOSSES[areaId];
            let encounterMonsters = [];

            if (bossDef && bossRoll < 3) {
                encounterMonsters.push({
                    ...bossDef,
                    currentHp: Math.floor(bossDef.hp * Math.pow(1.5, partySize - 1)),
                    hp: Math.floor(bossDef.hp * Math.pow(1.5, partySize - 1)),
                    isBoss: true
                });
                bossKillsCount++;
            } else {
                let count = 1;
                const roll = Math.random() * 100;
                if (roll < 60) count = 1;
                else if (roll < 90) count = 2;
                else count = 3;
                count = Math.min(5, count + partySize - 1);

                for (let i = 0; i < count; i++) {
                    const template = monstersDef[Math.floor(Math.random() * monstersDef.length)];
                    const hpBoost = Math.floor(template.hp * (1 + (partySize - 1) * 0.3));
                    encounterMonsters.push({
                        ...template,
                        currentHp: hpBoost,
                        hp: hpBoost,
                        isBoss: false,
                        buffs: [],
                        debuffs: []
                    });
                }
            }

            const originalMonsters = [...encounterMonsters];

            let battleOngoing = true;
            let turnLimit = 50;

            while (battleOngoing && turnLimit > 0) {
                turnLimit--;

                const target = encounterMonsters.filter(m => m.currentHp > 0).sort((a, b) => a.currentHp - b.currentHp)[0];
                if (!target) break;

                // 回合開始：減少冷卻與無敵回合
                for (const sid in playerCooldowns) {
                    if (playerCooldowns[sid] > 0) playerCooldowns[sid]--;
                }
                if (playerInvulnerableTurns > 0) playerInvulnerableTurns--;
                if (playerShield > 0) {
                    const decay = Math.max(20, Math.floor(playerShield * 0.1));
                    playerShield = Math.max(0, playerShield - decay);
                }

                const ps = getPlayerState();

                // 回合開始 Hook (onTurnStart)
                const turnCtx = { allies: [ps] }; // autoBattle is solo for now, but pass as array for compat
                executeSetHooks('onTurnStart', ps, null, turnCtx);
                if (turnCtx.all_invulnerable) {
                    playerInvulnerableTurns += 1;
                }
                playerHp = ps.hp; // sync back if healed

                let usedSkill = null;
                for (const skillId of autoSkills) {
                    const sDef = getSkillDef(skillId);
                    const currentCd = playerCooldowns[skillId] || 0;
                    if (sDef && playerMp >= sDef.mp && currentCd === 0) {
                        usedSkill = sDef; break;
                    }
                }

                if (usedSkill) {
                    const skillContext = { skill: { ...usedSkill } };
                    executeSetHooks('onSkill', ps, target, skillContext);
                    playerMp -= skillContext.skill.mp;

                    if (usedSkill.cd) playerCooldowns[usedSkill.id] = usedSkill.cd + 1; // 設置 CD

                    if (usedSkill.effect?.extraTurn && Math.random() < 0.3) {
                        turnLimit++; // 簡單模擬：多給一次行動次數
                    }

                    if (usedSkill.type === 'heal' || usedSkill.type === 'buff' || usedSkill.type === 'shield' || usedSkill.target === 'party') {
                        if (usedSkill.type === 'heal' || usedSkill.healPercent) {
                            const heal = Math.floor(total.max_hp * (usedSkill.healPercent / 100));
                            playerHp = Math.min(total.max_hp, playerHp + heal);
                        }
                        if (usedSkill.effect?.invulnerable) {
                            playerInvulnerableTurns += usedSkill.effect.invulnerable;
                        }
                        if (usedSkill.special === 'life_guard' || usedSkill.special === 'full_revive_guard') {
                            playerInvulnerableTurns += 2;
                        }
                    } else if (usedSkill.special === 'chaos_unity') {
                        // 萬象無間：全屏高傷
                        const totalDmg = Math.floor((total.atk + (total.matk || 0)) * 4.0);
                        encounterMonsters.forEach(m => {
                            if (m.currentHp > 0) m.currentHp -= Math.floor(totalDmg);
                        });
                    } else if (usedSkill.special === 'mage_summon') {
                        // 召喚模擬：給予厚護盾並賦予少許增傷 Buff 當作寵物在場
                        const summonHp = Math.floor(total.max_hp * (0.4 + ((char.level || 1) / 200)));
                        playerShield += summonHp;
                        playerBuffs.push({ atkPercent: 20, matkPercent: 20, turns: 3 });
                    } else {
                        const isPhysical = usedSkill.type === 'physical';
                        const isMagical = usedSkill.type === 'magical';
                        const isMixed = usedSkill.type === 'mixed';
                        let atkStat = 0;
                        if (isMixed) atkStat = (Number(total.atk || 0) * (usedSkill.multiplier || 0)) + (Number(total.matk || 0) * (usedSkill.matkMultiplier || 0));
                        else if (isMagical) atkStat = (total.matk || total.atk) * (usedSkill.multiplier || 1.0);
                        else atkStat = total.atk;

                        if (usedSkill.spdMultiplier) atkStat += total.spd * usedSkill.spdMultiplier;

                        if (usedSkill.target === 'all') {
                            encounterMonsters.filter(m => m.currentHp > 0).forEach(m => {
                                if (usedSkill.ignoreDodge || !isDodge(m)) {
                                    let defStat = (isMagical || isMixed) ? (m.mdef || m.def) : m.def;
                                    if (usedSkill.armorPen) defStat = Math.floor(defStat * (1 - usedSkill.armorPen / 100));

                                    let dmgMult = 1.0;
                                    if (usedSkill.undeadBonus && m.isUndead) dmgMult *= usedSkill.undeadBonus;

                                    let dmg = calcDamage(atkStat, defStat, dmgMult, total.penetration_pct) * (isCrit(total, usedSkill.critBonus || 0) ? (Number(total.crit_dmg) / 100) : 1);

                                    const aliveMonsters = encounterMonsters.filter(m => m.currentHp > 0);
                                    const hitCtx = { actorIsPlayer: true, encounterMonsters: aliveMonsters, originalDamage: dmg, allies: [ps] };
                                    executeSetHooks('onHit', ps, m, hitCtx);
                                    executeSetHooks('onDamaged', m, ps, { originalDamage: dmg, allies: aliveMonsters, encounterMonsters: [ps] });

                                    m.currentHp -= (Number(Math.floor(dmg)) || 0);

                                    // 連擊處理
                                    if (hitCtx.doDoubleStrike && m.currentHp > 0) {
                                        executeSetHooks('onHit', ps, m, { isDoubleStrike: true, actorIsPlayer: true });
                                        executeSetHooks('onDamaged', m, ps, { originalDamage: dmg });
                                        m.currentHp -= (Number(Math.floor(dmg)) || 0);
                                    }

                                    if (m.currentHp <= 0) executeSetHooks('onKill', ps, m);
                                }
                            });
                        } else if (usedSkill.target === 'random') {
                            const hits = usedSkill.hits || 1;
                            let totalLifeStealDmg = 0;

                            for (let i = 0; i < hits; i++) {
                                const validTargets = encounterMonsters.filter(m => m.currentHp > 0);
                                if (validTargets.length === 0) break;
                                const targetHit = validTargets[Math.floor(Math.random() * validTargets.length)];

                                if (usedSkill.ignoreDodge || !isDodge(targetHit)) {
                                    let defStat = (isMagical || isMixed) ? (targetHit.mdef || targetHit.def) : targetHit.def;
                                    if (usedSkill.armorPen) defStat = Math.floor(defStat * (1 - usedSkill.armorPen / 100));

                                    let dmgMult = 1.0;
                                    if (usedSkill.undeadBonus && targetHit.isUndead) dmgMult *= usedSkill.undeadBonus;

                                    let dmg = calcDamage(atkStat, defStat, dmgMult, total.penetration_pct) * (isCrit(total, usedSkill.critBonus || 0) ? (Number(total.crit_dmg) / 100) : 1);

                                    const aliveMonsters = encounterMonsters.filter(m => m.currentHp > 0);
                                    const hitCtx = { actorIsPlayer: true, encounterMonsters: aliveMonsters, originalDamage: dmg, allies: [ps] };
                                    executeSetHooks('onHit', ps, targetHit, hitCtx);
                                    executeSetHooks('onDamaged', targetHit, ps, { originalDamage: dmg, allies: aliveMonsters, encounterMonsters: [ps] });

                                    targetHit.currentHp -= (Number(Math.floor(dmg)) || 0);
                                    totalLifeStealDmg += dmg;

                                    // 連擊處理
                                    if (hitCtx.doDoubleStrike && targetHit.currentHp > 0) {
                                        executeSetHooks('onHit', ps, targetHit, { isDoubleStrike: true, actorIsPlayer: true });
                                        executeSetHooks('onDamaged', targetHit, ps, { originalDamage: dmg });
                                        targetHit.currentHp -= (Number(Math.floor(dmg)) || 0);
                                        totalLifeStealDmg += dmg;
                                    }

                                    if (targetHit.currentHp <= 0) executeSetHooks('onKill', ps, targetHit);
                                }
                            }

                            if (usedSkill.lifeSteal) playerHp = Math.min(total.max_hp, playerHp + Math.floor(totalLifeStealDmg * (usedSkill.lifeSteal / 100)));

                            if (usedSkill.effect) {
                                playerBuffs.push({ ...usedSkill.effect, turns: usedSkill.effect.turns });
                            }
                        } else {
                            if (usedSkill.ignoreDodge || !isDodge(target)) {
                                let defStat = (isMagical || isMixed) ? (target.mdef || target.def) : target.def;
                                if (usedSkill.armorPen) defStat = Math.floor(defStat * (1 - usedSkill.armorPen / 100));

                                let dmgMult = 1.0;
                                if (usedSkill.undeadBonus && target.isUndead) dmgMult *= usedSkill.undeadBonus;

                                let dmg = calcDamage(atkStat, defStat, dmgMult, total.penetration_pct) * (isCrit(total, usedSkill.critBonus || 0) ? (Number(total.crit_dmg) / 100) : 1);

                                let hits = usedSkill.hits || 1;
                                let totalDmg = 0;
                                for (let i = 0; i < hits; i++) {
                                    totalDmg += (Number(Math.floor(dmg)) || 0);
                                }
                                if (usedSkill.lifeSteal) playerHp = Math.min(total.max_hp, playerHp + Math.floor(totalDmg * (usedSkill.lifeSteal / 100)));

                                // 注入狀態
                                if (usedSkill.dot) {
                                    target.debuffs = target.debuffs || [];
                                    target.debuffs.push({ dot: usedSkill.dot, turns: usedSkill.dot.turns });
                                }
                                if (usedSkill.debuff) {
                                    target.debuffs = target.debuffs || [];
                                    target.debuffs.push({ ...usedSkill.debuff, turns: usedSkill.debuff.turns });
                                }
                                if (usedSkill.effect) {
                                    playerBuffs.push({ ...usedSkill.effect, turns: usedSkill.effect.turns });
                                }

                                const hitCtx = { actorIsPlayer: true };
                                executeSetHooks('onHit', ps, target, hitCtx);
                                executeSetHooks('onDamaged', target, ps, { originalDamage: totalDmg });

                                target.currentHp -= totalDmg;

                                // 連擊處理
                                if (hitCtx.doDoubleStrike && target.currentHp > 0) {
                                    const avgDmg = Math.floor(totalDmg / hits);
                                    executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                                    executeSetHooks('onDamaged', target, ps, { originalDamage: avgDmg });
                                    target.currentHp -= avgDmg;
                                }

                                if (target.currentHp <= 0) executeSetHooks('onKill', ps, target);
                            }
                        }
                    }
                } else {
                    if (!isDodge(target)) {
                        const dmg = Math.floor(calcDamage(total.atk, target.def, 1, total.penetration_pct) * (isCrit(total) ? (Number(total.crit_dmg) / 100) : 1));

                        const hitCtx = { actorIsPlayer: true };
                        executeSetHooks('onHit', ps, target, hitCtx);
                        executeSetHooks('onDamaged', target, ps, { originalDamage: dmg });

                        target.currentHp -= (Number(dmg) || 0);

                        // 連擊處理
                        if (hitCtx.doDoubleStrike && target.currentHp > 0) {
                            executeSetHooks('onHit', ps, target, { isDoubleStrike: true, actorIsPlayer: true });
                            executeSetHooks('onDamaged', target, ps, { originalDamage: dmg });
                            target.currentHp -= (Number(dmg) || 0);
                        }

                        if (target.currentHp <= 0) executeSetHooks('onKill', ps, target);

                        // 處理魔劍士附魔
                        const enchant = playerBuffs.find(b => b.enchantType);
                        if (enchant && Math.random() * 100 < (enchant.chance || 100)) {
                            target.debuffs = target.debuffs || [];
                            target.debuffs.push({ dot: { type: enchant.enchantType, percent: 10 }, turns: 2 });
                        }
                    }
                }

                // 同步狀態寫回
                playerHp = ps.hp;
                playerMp = ps.mp;
                playerShield = ps.shield;
                totalGold += (ps.earnedGold || 0);

                encounterMonsters = encounterMonsters.filter(m => m.currentHp > 0);
                if (encounterMonsters.length === 0) { battleOngoing = false; break; }

                for (const mParty of partyDefs) {
                    // 如果玩家血量低於 50%，傭兵有機率發動治療
                    if (playerHp < total.max_hp * 0.5 && Math.random() < 0.3) {
                        const healAmt = Math.floor(total.max_hp * 0.15);
                        playerHp = Math.min(total.max_hp, playerHp + healAmt);
                        continue;
                    }

                    const mTarget = encounterMonsters.filter(m => m.currentHp > 0).sort((a, b) => a.currentHp - b.currentHp)[0];
                    if (!mTarget) break;
                    if (!isDodge(mTarget)) {
                        // 傭兵沒穿透/爆傷加成，維持基礎
                        const dmg = Math.floor(calcDamage(mParty.atk, mTarget.def) * (isCrit(mParty) ? 1.5 : 1));
                        mTarget.currentHp -= (Number(dmg) || 0);
                        executeSetHooks('onHit', mParty, mTarget, { actorIsPlayer: true }); // 傭兵算作 player 的 ally
                        executeSetHooks('onDamaged', mTarget, mParty, { originalDamage: dmg });
                        if (mTarget.currentHp <= 0) executeSetHooks('onKill', mParty, mTarget);
                    }
                }

                encounterMonsters = encounterMonsters.filter(m => m.currentHp > 0);
                if (encounterMonsters.length === 0) { battleOngoing = false; break; }

                for (const m of encounterMonsters) {
                    if (playerInvulnerableTurns > 0) {
                        // 無敵中，不扣血
                        continue;
                    }
                    if (!isDodge(total)) {
                        let mdmg = Math.floor(calcDamage(m.atk, total.def) * (isCrit(m) ? 1.5 : 1));
                        mdmg = Math.floor(mdmg * (1 - (partyDefs.length * 0.1)));

                        if (playerShield > 0) {
                            if (playerShield >= mdmg) {
                                playerShield -= mdmg;
                                mdmg = 0;
                            } else {
                                mdmg -= playerShield;
                                playerShield = 0;
                            }
                        }

                        executeSetHooks('onHit', m, ps, { actorIsPlayer: false });
                        executeSetHooks('onDamaged', ps, m, { originalDamage: mdmg });

                        playerHp -= Math.max(0, mdmg);
                        playerHp = ps.hp; // 寫回
                    }
                    if (playerHp <= 0) break;
                }

                // ===== 週期結算 (DOT & Durations) =====
                // 玩家結算
                const wrapPlayer = { hp: playerHp, max_hp: total.max_hp, buffs: playerBuffs, debuffs: playerDebuffs };
                playerDebuffs = playerDebuffs.filter(d => {
                    if (d.dot && wrapPlayer.hp > 0) {
                        const dotDmg = Math.max(1, Math.floor(wrapPlayer.max_hp * (d.dot.percent / 100)));
                        wrapPlayer.hp -= dotDmg;
                    }
                    d.turns--;
                    return d.turns > 0 || d.turns === -1;
                });
                playerBuffs = playerBuffs.filter(b => {
                    b.turns--;
                    return b.turns > 0 || b.turns === -1;
                });
                playerHp = wrapPlayer.hp;

                // 怪物結算
                for (const m of encounterMonsters) {
                    if (m.currentHp <= 0) continue;
                    m.debuffs = (m.debuffs || []).filter(d => {
                        if (d.dot && m.currentHp > 0) {
                            const dotDmg = Math.max(1, Math.floor(m.hp * (d.dot.percent / 100)));
                            m.currentHp -= dotDmg;
                        }
                        d.turns--;
                        return d.turns > 0 || d.turns === -1;
                    });
                    m.buffs = (m.buffs || []).filter(b => {
                        b.turns--;
                        return b.turns > 0 || b.turns === -1;
                    });
                }

                if (playerHp <= 0) {
                    battleOngoing = false;
                    deathReason = `被 ${encounterMonsters[0].name} 擊倒`;

                    const charAfter = getCharacter(guildId, userId); // 獲取最新死亡數據
                    const newDeaths = (charAfter?.deaths || 0) + 1;
                    const newStreak = (charAfter?.lose_streak || 0) + 1;
                    const vName = interaction.member?.displayName || interaction.user.username;

                    await broadcastRpgEvent(interaction.client, guildId, {
                        title: '壯烈犧牲',
                        description: `冒險者 ${fmt(COLORS.BLUE, vName)} 在自動探索時不幸戰死...\n${fmt(COLORS.RED, '擊殺者: ' + encounterMonsters[0].name)}\n${fmt(COLORS.RED, '當前連敗數: ' + newStreak)}\n${fmt(COLORS.GRAY, '生涯死亡數: ' + newDeaths)}`,
                        color: 0x880000
                    });
                    break;
                }
            } // End of single battle logic

            if (turnLimit <= 0 && encounterMonsters.length > 0) {
                deathReason = `體力透支，無法擊敗 ${encounterMonsters[0].name}`;
                break;
            }

            if (playerHp > 0) {
                completedRounds++;

                // 追蹤任務進度
                trackQuestProgress(guildId, userId, 'win_battle');
                trackQuestProgress(guildId, userId, 'explore_area', { areaId });

                let roundXp = originalMonsters.reduce((acc, m) => acc + (m.xp || 10), 0);
                let roundGold = originalMonsters.reduce((acc, m) => acc + (m.gold || 5), 0);

                const dropMultiplier = 1 + (originalMonsters.length - 1) * 0.2;
                for (const m of originalMonsters) {
                    // 追蹤怪物擊殺任務
                    if (m.isBoss) {
                        const qr = trackQuestProgress(guildId, userId, 'kill_boss', { bossId: m.id });
                        if (qr?.completed) {
                            const vName = interaction.member?.displayName || interaction.user.username;
                            await broadcastRpgEvent(interaction.client, guildId, {
                                title: '⚔️ 章節突破！',
                                description: `重大進展！冒險者 ${fmt(COLORS.BLUE, vName)} 成功完成了任務：\n「${fmt(COLORS.CYAN, qr.quest.name)}」！\n王國的大門已為你進一步敞開！`,
                                color: 0x1ABC9C
                            });
                        }
                    } else if (m.id) {
                        const qr = trackQuestProgress(guildId, userId, 'kill_monster', { monsterId: m.id });
                        if (qr?.completed) {
                            const vName = interaction.member?.displayName || interaction.user.username;
                            await broadcastRpgEvent(interaction.client, guildId, {
                                title: '⚔️ 任務完成！',
                                description: `冒險者 ${fmt(COLORS.BLUE, vName)} 成功完成了任務：\n「${fmt(COLORS.CYAN, qr.quest.name)}」！`,
                                color: 0x1ABC9C
                            });
                        }
                    }

                    if (m.drops) {
                        const leaderName = interaction.member?.displayName || interaction.user.username;
                        const participants = [{ id: userId, level: char.level || 1, name: leaderName }, ...partyDefs.map(p => ({ id: p.id, level: p.level || 1, name: p.name || p.id }))];
                        for (const drop of m.drops) {
                            if (Math.random() * 100 < drop.chance * dropMultiplier) {
                                const receiver = participants[Math.floor(Math.random() * participants.length)];
                                const eqDef = EQUIPMENT[drop.id];
                                const quality = eqDef ? eqDef.quality : 'common';

                                dropsList.push({ id: drop.id, isEquip: !!drop.isEquip, quality, receiverName: receiver.name });
                                if (drop.isEquip) addEquipment(guildId, receiver.id, drop.id, quality, receiver.level);
                                else addToInventory(guildId, receiver.id, drop.id);

                                if (['epic', 'mythic', 'legendary'].includes(quality)) {
                                    let qColor = quality === 'epic' ? 0x9b59b6 : quality === 'mythic' ? 0xe74c3c : 0xe67e22;
                                    let qName = quality === 'epic' ? '🟣 史詩' : quality === 'mythic' ? '🔴 神話' : '🟠 傳說';
                                    let colorCode = quality === 'epic' ? COLORS.MAGENTA : COLORS.RED; // Corrected: mythic and legendary are RED and GOLD respectively

                                    await broadcastRpgEvent(interaction.client, guildId, {
                                        title: '極品裝備現世！',
                                        description: `運氣爆棚！冒險者 ${fmt(COLORS.BLUE, receiver.name)} (自動探索)\n獲得了 ${fmt(colorCode, qName)} 品質的「${fmt(COLORS.WHITE, getItemDisplayName(drop.id))}」！`,
                                        color: qColor
                                    });
                                }
                            }
                        }
                    }
                    if (m.isBoss) {
                        const isFirstKill = registerFirstKill(guildId, m.id, [userId]);
                        if (isFirstKill) {
                            const vName = interaction.member?.displayName || interaction.user.username;
                            await broadcastRpgEvent(interaction.client, guildId, {
                                title: '🏆 傳奇誕生：世界首殺！',
                                description: `${fmt(COLORS.GOLD, '史無前例！')} 「${fmt(COLORS.WHITE, m.name)}」 在自動探索中被擊敗了！\n恭喜 ${fmt(COLORS.BLUE, vName)} 締造了這項成就！\n他的英姿將被銘刻在王國歷代記英雄榜上！`,
                                color: 0xFFD700
                            });
                        }
                    }
                }

                const pool = SKILL_BOOK_DROP_POOLS[areaId];
                if (pool && Math.random() * 100 < pool.chance * (1 + (originalMonsters.length - 1) * 0.5)) {
                    const bookId = pool.books[Math.floor(Math.random() * pool.books.length)];
                    dropsList.push({ id: bookId, isEquip: false, quality: 'common' });
                    addToInventory(guildId, userId, bookId);
                }

                totalXp += roundXp;
                totalGold += roundGold;

                if (partyDefs.length > 0) {
                    const mXp = Math.floor(roundXp * 0.3);
                    const mGold = Math.floor(roundGold * 0.3);
                    for (const mId of hiredMcs) {
                        if (mercEarnedGold[mId] !== undefined) {
                            mercEarnedGold[mId] += mGold;
                            mercEarnedXp[mId] += mXp;
                        }
                    }
                }
            }
        }

        addGold(guildId, userId, totalGold);

        let finalXp = char.xp + totalXp;
        let level = char.level;
        let freePoints = char.free_points;
        let needed = getXpForLevel(level + 1);
        const growthUpdates = {};

        while (finalXp >= needed) {
            finalXp -= needed;
            level++;
            freePoints += 5;
            needed = getXpForLevel(level + 1);

            const cls = CLASSES[char.class];
            if (cls) {
                for (const [stat, val] of Object.entries(cls.growth)) {
                    if (stat === 'hp') { growthUpdates.max_hp = (growthUpdates.max_hp ?? char.max_hp) + val; }
                    else if (stat === 'mp') { growthUpdates.max_mp = (growthUpdates.max_mp ?? char.max_mp) + val; }
                    else { growthUpdates[stat] = (growthUpdates[stat] ?? char[stat]) + val; }
                }
            }

            if ([30, 60, 90, 99].includes(level)) {
                const newTitle = getJobTitle({ class: char.class, level: level });
                const vName = interaction.member?.displayName || interaction.user.username;
                await broadcastRpgEvent(interaction.client, guildId, {
                    title: '位階突破！',
                    description: `太驚人了！冒險者 ${fmt(COLORS.BLUE, vName)} 在自動探索中\n晉升為 ${fmt(COLORS.GOLD, newTitle)}！\n達到了 ${fmt(COLORS.GREEN, 'Lv.' + level)} 的全方位巔峰境界！`,
                    color: level >= 60 ? 0xFFAA00 : 0x00FF00
                });
            }
        }

        updateCharacter(guildId, userId, {
            hp: deathReason ? 0 : Math.min(playerHp, total.max_hp),
            mp: Math.min(playerMp, total.max_mp),
            xp: finalXp, level, free_points: freePoints,
            boss_kills: char.boss_kills + bossKillsCount,
            wins: char.wins + completedRounds,
            deaths: deathReason ? char.deaths + 1 : char.deaths,
            lose_streak: deathReason ? char.lose_streak + 1 : 0,
        });

        for (const mId of hiredMcs) {
            if (mercEarnedGold[mId] > 0 || mercEarnedXp[mId] > 0) {
                addGold(guildId, mId, mercEarnedGold[mId]);
                const mc = getCharacter(guildId, mId);
                if (mc) {
                    let mfinalXp = mc.xp + mercEarnedXp[mId];
                    let mlevel = mc.level;
                    let mfpoints = mc.free_points;
                    let mneeded = getXpForLevel(mlevel + 1);
                    const mG = {};
                    while (mfinalXp >= mneeded) {
                        mfinalXp -= mneeded; mlevel++; mfpoints += 5; mneeded = getXpForLevel(mlevel + 1);
                        const mcls = CLASSES[mc.class];
                        if (mcls) {
                            for (const [stat, val] of Object.entries(mcls.growth)) {
                                if (stat === 'hp') { mG.max_hp = (mG.max_hp ?? mc.max_hp) + val; }
                                else if (stat === 'mp') { mG.max_mp = (mG.max_mp ?? mc.max_mp) + val; }
                                else { mG[stat] = (mG[stat] ?? mc[stat]) + val; }
                            }
                        }
                    }
                    updateCharacter(guildId, mId, { xp: mfinalXp, level: mlevel, free_points: mfpoints, ...mG });
                    addMercenaryHistory(guildId, mId, userId, `${completedRounds}場 自動探索`, mercEarnedGold[mId], mercEarnedXp[mId]);
                }
            }
        }

        const areaName = AREAS.find(a => a.id === areaId)?.name || '未知區域';
        const lines = [
            `> **探索次數:** ${completedRounds} / ${roundsCount} 回 ${deathReason ? `(因 ${deathReason} 提早中斷)` : '(順利完成)'}`,
            `> **獲得金幣:** ${totalGold} 💰`,
            `> **獲得經驗值:** ${totalXp} XP ${partyDefs.length > 0 ? `(傭兵分紅已發放)` : ''}`,
            ''
        ];

        if (dropsList.length > 0) {
            lines.push('**【戰利品】**');
            lines.push('```ansi');
            const itemCounts = {};
            for (const drop of dropsList) {
                const nameStr = getItemDisplayName(drop.id) + (drop.isEquip ? ` [${qualityLabel(drop.quality)}]` : '');
                const coloredName = formatItemName(nameStr, drop.quality);
                itemCounts[coloredName] = (itemCounts[coloredName] || 0) + 1;
            }
            for (const [coloredName, qty] of Object.entries(itemCounts)) {
                lines.push(`📦 ${qty}x ${coloredName}`);
            }
            lines.push('```');
        } else {
            lines.push('> 📦 本次無法收集到任何戰利品');
        }

        if (deathReason) {
            lines.push('');
            lines.push(`💀 你的生命值已經歸零，需要回復血量才能繼續冒險。`);
        }

        const embed = rpgEmbed(
            `🔄 自動探索戰報: ${areaName}`,
            lines.join('\n'),
            deathReason ? 0xE74C3C : 0x2ECC71
        ).setFooter({ text: `🐕👑 吉吉王國冒險者公會 | uid:${userId}` });

        const row = backButton();

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.update({ embeds: [embed], components: [row] });
            } else {
                await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => { });
            }
        } catch (e) {
            logger.error('runAutoFarm update error:', e);
        }
    } catch (e) {
        logger.error('runAutoFarm fatal error:', e);
        const errEmbed = rpgEmbed('🤖 自動探索發生錯誤', `汪！探索中斷了...\n錯誤訊息: ${e.message}`, 0xE74C3C);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errEmbed], flags: ['Ephemeral'] });
            } else {
                await interaction.editReply({ embeds: [errEmbed] });
            }
        } catch (innerErr) {
            logger.error('Failed to report autoFarm error:', innerErr);
        }
    }
}
