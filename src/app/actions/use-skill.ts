
'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getDatabase, ref, push } from 'firebase/database';
import { initializeApp, getApps, App } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, CombatEncounter, Skill, ActiveBuff, CombatLog, Monster } from '@/lib/types';

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Helper function to roll dice, needed for probabilistic damage
function rollDice(diceNotation: string): number {
  if (!diceNotation || typeof diceNotation !== 'string' || !diceNotation.toLowerCase().includes('d')) return 0;
  
  const [numDiceStr, numSidesStr] = diceNotation.toLowerCase().split('d');
  const numDice = parseInt(numDiceStr, 10) || 1;
  const numSides = parseInt(numSidesStr, 10);
  
  if (isNaN(numDice) || isNaN(numSides) || numDice <= 0 || numSides <= 0) return 0;
  
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * numSides) + 1;
  }
  return total;
}

interface UseSkillPayload {
  userId: string;
  battleId: string;
  skillId: string;
  targetMonsterId?: string; // Optional for targeted skills
}

export interface UseSkillResult {
    success: boolean;
    error?: string;
    logMessage?: string;
}

export async function useSkill(payload: UseSkillPayload): Promise<UseSkillResult> {
  const { userId, battleId, skillId, targetMonsterId } = payload;
  if (!userId || !battleId || !skillId) {
    return { success: false, error: '缺少必要的使用技能資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const battleRef = doc(db, 'combatEncounters', battleId);
  const skillRef = doc(db, 'skills', skillId);

  try {
    const { logMessage, logEntry } = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const battleDoc = await transaction.get(battleRef);
      const skillDoc = await transaction.get(skillRef);

      if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
      if (!battleDoc.exists()) throw new Error('找不到指定的戰場。');
      if (!skillDoc.exists()) throw new Error('找不到指定的技能。');

      const user = userDoc.data() as User;
      const battle = battleDoc.data() as CombatEncounter;
      const skill = skillDoc.data() as Skill;
      
      if (battle.status !== 'active') throw new Error('戰場目前不是戰鬥狀態。');
      
      let participantData = battle.participants?.[userId];
      if (!participantData) {
        // Initialize participant if they aren't in the battle yet
        participantData = {
          hp: user.attributes.hp,
          roleName: user.roleName,
          factionId: user.factionId,
          equippedItems: [],
          activeBuffs: [],
          skillCooldowns: {},
        };
      }

      if (participantData.hp <= 0) throw new Error('您的HP已歸零，無法使用技能。');
      if (participantData.skillCooldowns?.[skillId] > 0) throw new Error(`技能「${skill.name}」仍在冷卻中。`);

      // Initialize fields if they don't exist
      const activeBuffs = participantData.activeBuffs || [];
      const skillCooldowns = participantData.skillCooldowns || {};
      const monsters = [...battle.monsters];
      let logMessages: string[] = [];
      let totalDamageDealtThisAction = 0;

      // Apply skill effects
      for (const effect of skill.effects) {
          // --- Effects that apply buffs/debuffs or self-damage ---
          if (effect.duration || effect.effectType === 'hp_cost' || effect.effectType === 'hp_recovery') {
              if (effect.duration) {
                  const newBuff: ActiveBuff = { ...effect, turnsLeft: effect.duration };
                  activeBuffs.push(newBuff);
                  logMessages.push(`${user.roleName} 獲得了「${skill.name}」的增益效果。`);
              }
              if (effect.effectType === 'hp_cost') {
                  const cost = Number(effect.value);
                  participantData.hp = Math.max(0, participantData.hp - cost);
                   logMessages.push(`${user.roleName} 消耗了 ${cost} HP 來發動「${skill.name}」。`);
              }
              if (effect.effectType === 'hp_recovery') {
                  const recovery = Number(effect.value);
                  const maxHP = user.attributes.hp;
                  participantData.hp = Math.min(maxHP, participantData.hp + recovery);
                  logMessages.push(`${user.roleName} 恢復了 ${recovery} HP。`);
              }
          }
          // --- Effects that target a monster ---
          else if (effect.effectType === 'direct_damage' || effect.effectType === 'probabilistic_damage') {
              if (!targetMonsterId) throw new Error('此技能需要指定一個目標。');
              const targetIndex = monsters.findIndex(m => m.monsterId === targetMonsterId);
              if (targetIndex === -1) throw new Error('找不到指定的目標。');
              
              let targetMonster = monsters[targetIndex];
              if (targetMonster.hp <= 0) throw new Error('目標已經被擊敗了。');

              let damageDealt = 0;
              if (effect.effectType === 'direct_damage') {
                   damageDealt = Number(effect.value) || 0;
              } 
              else if (effect.effectType === 'probabilistic_damage') {
                  const roll = Math.random() * 100;
                  if (roll <= (effect.probability || 100)) {
                      damageDealt = Number(effect.value) || 0;
                  }
              }

              if (damageDealt > 0) {
                 totalDamageDealtThisAction += damageDealt;
                 targetMonster.hp = Math.max(0, targetMonster.hp - damageDealt);
                 monsters[targetIndex] = targetMonster;
                 logMessages.push(`${user.roleName} 使用「${skill.name}」對 ${targetMonster.name} 造成了 ${damageDealt} 點直接傷害。`);
              } else {
                 logMessages.push(`${user.roleName} 的「${skill.name}」未對 ${targetMonster.name} 造成傷害。`);
              }
          }
      }
      
      // Set skill cooldown
      if (skill.cooldown > 0) {
          skillCooldowns[skillId] = skill.cooldown;
      }

      // Update participant and battle data
      transaction.update(battleRef, {
        monsters,
        [`participants.${userId}`]: {
          ...participantData,
          activeBuffs: activeBuffs,
          skillCooldowns: skillCooldowns,
        },
      });

      // Log the action
      const finalLogMessage = logMessages.join(' ');
      
      const logEntry: any = {
        encounterId: battleId,
        userId: userId,
        userFaction: user.factionId,
        logData: finalLogMessage,
        timestamp: serverTimestamp(),
        turn: battle.turn,
        type: 'skill_used',
      };

      if (totalDamageDealtThisAction > 0) {
          logEntry.damage = totalDamageDealtThisAction;
      }
      
      return { logMessage: finalLogMessage, logEntry };
    });

    // --- Write to Realtime Database (outside transaction) ---
    if (logEntry) {
        const battleLogRtdbRef = ref(rtdb, `battle_buffer/${battleId}`);
        const rtdbLogEntry = { ...logEntry, timestamp: new Date().toISOString() };
        await push(battleLogRtdbRef, rtdbLogEntry);
    }

    return { success: true, logMessage };
  } catch (error: any) {
    console.error('Skill usage failed:', error);
    return { success: false, error: error.message || '使用技能失敗，請稍後再試。' };
  }
}
