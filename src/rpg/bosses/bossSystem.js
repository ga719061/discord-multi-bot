import { getCharacter, updateCharacter } from '../rpgDatabase.js';
import { broadcastRpgEvent, consumeShield } from '../rpgHelpers.js';
import { fmt, COLORS } from '../../utils/style.js';

export function handleBossDeathIntercept(monsters) {
    let extraLog = '';
    for (const m of monsters) {
        if (m.currentHp <= 0 && m.isBoss && m.skills) {
            // 骸骨領主 / 不死物 復甦機制
            const reviveSkill = m.skills.find(s => s.type === 'revive');
            if (reviveSkill && !m.hasRevived) {
                m.currentHp = Math.floor(m.hp * (reviveSkill.hpPercent / 100));
                m.hasRevived = true;
                if (reviveSkill.buff) {
                    m.buffs = m.buffs || [];
                    m.buffs.push({ ...reviveSkill.buff });
                }
                extraLog += `\n💀👑 **${m.name}** 被擊倒了... 但隨即在一陣綠色焰火中重組！恢復了 ${reviveSkill.hpPercent}% HP 並強化了能力！`;
            }

            // 多階段 (Phases) 轉換機制
            const phaseSkill = m.skills.find(s => s.type === 'phases');
            if (phaseSkill && (m.phase || 1) < (phaseSkill.maxPhases || 3)) {
                m.phase = (m.phase || 1) + 1;
                m.currentHp = m.hp; // 滿血進入下一階段
                extraLog += `\n🌀 **${m.name}** 形態轉換！進入了第 ${m.phase} 階段！散發出更恐怖的壓迫感！`;
            }
        }
    }
    return extraLog;
}

export async function handleBossAttack(boss, battle, potentialTargets, calcDamage, isDodge, interaction) {
    let turnLog = '';
    const turn = battle.turn || 1;
    const bossId = boss.id;

    // 確定行動次數 (Action Points)
    const partySize = Object.keys(battle.player_states).length;
    let actionCount = 1;
    if (partySize >= 5) actionCount = 3;
    else if (partySize >= 3) actionCount = 2;

    // 初始化或取得 Boss 戰鬥狀態
    battle.boss_states = battle.boss_states || {};
    if (!battle.boss_states[bossId]) {
        battle.boss_states[bossId] = { cooldowns: {}, onceTriggers: {} };
    }
    const bState = battle.boss_states[bossId];

    for (let act = 0; act < actionCount; act++) {
        // 每一次行動都要重新確認目標是否存活
        const aliveTargets = potentialTargets.filter(t => {
            const ent = t.type === 'player' ? battle.player_states[t.id] : battle.ally_summons[t.index];
            return ent && ent.hp > 0;
        });
        if (aliveTargets.length === 0) break;

        // 篩選目前可用的技能
        const skills = boss.skills || [];
        let selectedSkill = null;

        // 優先執行條件觸發技能
        for (const sk of skills) {
            if (sk.trigger === 'hp_low') {
                const currentHpPct = (boss.currentHp / boss.hp) * 100;
                if (currentHpPct <= sk.hpThreshold && (!sk.once || !bState.onceTriggers[sk.name])) {
                    selectedSkill = sk;
                    if (sk.once) bState.onceTriggers[sk.name] = true;
                    break;
                }
            }
        }

        if (!selectedSkill) {
            const availableSkills = skills.filter(sk => {
                if (sk.trigger) return false;
                const cd = bState.cooldowns[sk.name] || 0;
                return cd <= 0;
            });
            for (const sk of availableSkills) {
                if (sk.cooldown && turn % sk.cooldown === 0) {
                    selectedSkill = sk;
                    break;
                }
                if (sk.chance && Math.random() * 100 <= sk.chance) {
                    selectedSkill = sk;
                    break;
                }
            }
        }

        // 執行技能或普攻
        if (selectedSkill) {
            if (selectedSkill.cooldown) bState.cooldowns[selectedSkill.name] = selectedSkill.cooldown;
            turnLog += `\n${boss.emoji} **${boss.name}** 施展了 [${selectedSkill.name}]！！`;

            if (selectedSkill.type === 'buff') {
                boss.buffs = boss.buffs || [];
                if (selectedSkill.buffs) boss.buffs.push(...selectedSkill.buffs.map(b => ({ ...b })));
                else if (selectedSkill.stat) boss.buffs.push({ stat: selectedSkill.stat, percent: selectedSkill.percent, turns: selectedSkill.turns || 3 });
                turnLog += ` 其能力獲得了提昇！`;
            } else if (selectedSkill.type === 'shield') {
                const shieldVal = Math.floor(boss.atk * (selectedSkill.shieldMultiplier || 2));
                boss.shield = (boss.shield || 0) + shieldVal;
                turnLog += ` 激發了厚實的護盾量 (${shieldVal})！`;
            } else {
                const targets = selectedSkill.target === 'all' ? aliveTargets : [aliveTargets[Math.floor(Math.random() * aliveTargets.length)]];
                if (selectedSkill.target === 'random' && selectedSkill.hits) {
                    for (let i = 0; i < selectedSkill.hits; i++) {
                        const randTarget = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
                        turnLog += await applyDamage(boss, randTarget, battle, calcDamage, isDodge, selectedSkill.multiplier || 1.0, selectedSkill.name, interaction, selectedSkill.type === 'magical', selectedSkill);
                    }
                } else {
                    for (const targetInfo of targets) {
                        turnLog += await applyDamage(boss, targetInfo, battle, calcDamage, isDodge, selectedSkill.multiplier || 1.0, selectedSkill.name, interaction, selectedSkill.type === 'magical', selectedSkill);
                    }
                }
            }
        } else {
            const isMagicBoss = ['void_lord', 'crystal_emperor', 'bone_lord'].includes(boss.id);
            const targetInfo = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
            turnLog += await applyDamage(boss, targetInfo, battle, calcDamage, isDodge, 1.0, '普通攻擊', interaction, isMagicBoss);
        }
    }

    // 每回合結束減少所有技能冷卻
    for (const skName in bState.cooldowns) {
        if (bState.cooldowns[skName] > 0) bState.cooldowns[skName]--;
    }

    return turnLog;
}

async function applyDamage(boss, targetInfo, battle, calcDamage, isDodge, mult, atkName, interaction, isMagic = false, skill = null) {
    let log = '';
    const isPlayer = targetInfo.type === 'player';
    const target = isPlayer ? battle.player_states[targetInfo.id] : battle.ally_summons[targetInfo.index];
    const targetId = isPlayer ? targetInfo.id : null;
    const targetName = isPlayer ? `<@${targetId}>` : target.name;

    if (isDodge(target)) {
        return `\n${boss.emoji} ${boss.name} 的 [${atkName}] 被 ${targetName} 輕巧地避開了！`;
    }

    const defStat = isMagic ? (target.mdef || Math.floor(target.def * 0.8)) : (target.def || 0);
    let damage = Math.floor(calcDamage(boss.atk, defStat) * mult);
    const finalDmg = consumeShield(target, damage);
    target.hp -= finalDmg;

    log += `\n> ${isPlayer ? '💢' : '💥'} 對 ${targetName} 造成 ${finalDmg} ${isMagic ? '(✨魔法)' : ''} 傷害！`;

    if (skill) {
        if (skill.dot) {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({ name: skill.name, type: 'dot', dot: { ...skill.dot }, turns: skill.dot.turns });
            log += ` 使其陷入持續傷害狀態！`;
        }
        if (skill.debuff) {
            target.debuffs = target.debuffs || [];
            target.debuffs.push({ name: skill.name, ...skill.debuff });
            log += ` 使其 ${skill.debuff.stat.toUpperCase()} 降低了！`;
        }
        if (skill.states) {
            target.debuffs = target.debuffs || [];
            target.debuffs.push(...skill.states.map(s => ({ name: skill.name, ...s })));
            log += ` 受到了多重負面影響！`;
        }
        if (skill.drainHp) {
            const heal = Math.floor(finalDmg * (skill.drainHp || 0));
            if (heal > 0) {
                boss.currentHp = Math.min(boss.hp, boss.currentHp + heal);
                log += ` 並吸取了 ${heal} HP！`;
            }
        }
    }

    if (target.hp <= 0) {
        target.hp = 0;
        if (isPlayer) {
            if (target.isMercenary) {
                log += `\n🛡️ 助戰傭兵 ${targetName} 倒下了！`;
            } else {
                log += `\n💀 ${targetName} 倒下了！`;
                const char = getCharacter(interaction.guildId, targetId);
                const newDeaths = (char.deaths || 0) + 1;
                const newStreak = (char.lose_streak || 0) + 1;
                updateCharacter(interaction.guildId, targetId, { hp: 0, mp: target.mp || 0, deaths: newDeaths, lose_streak: newStreak });

                const victim = await interaction.guild.members.fetch(targetId).catch(() => null);
                const vName = victim ? victim.displayName : interaction.user.username;
                await broadcastRpgEvent(interaction.client, interaction.guildId, {
                    title: '壯烈犧牲',
                    description: `騎士 ${fmt(COLORS.BLUE, vName)} 在對抗 **${boss.name}** 時不幸戰死...`,
                    color: 0x880000
                });
            }
        } else {
            log += `\n👻 ${targetName} 被擊散了！`;
        }
    }
    return log;
}
