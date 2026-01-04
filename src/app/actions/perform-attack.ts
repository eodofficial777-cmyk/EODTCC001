
'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, Item, CombatEncounter, Monster, AttributeEffect, ActiveBuff, Participant } from '@/lib/types';

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

interface PerformAttackPayload {
  userId: string;
  battleId: string;
  targetMonsterId: string;
  equippedItemIds: string[];
  supportedFaction: 'yelu' | 'association' | null;
}

export interface PerformAttackResult {
    success: boolean;
    error?: string;
    logMessage?: string;
    monsterDamage?: number;
    playerDamage?: number;
}

function rollDice(diceNotation: string): number {
  if (!diceNotation || typeof diceNotation !== 'string' || !diceNotation.toLowerCase().includes('d')) return 0;
  
  const [numDiceStr, numSidesStr] = diceNotation.toLowerCase().split('d');
  const numDice = parseInt(numDiceStr, 10) || 1; // Default to 1 if not specified
  const numSides = parseInt(numSidesStr, 10);
  
  if (isNaN(numDice) || isNaN(numSides) || numDice <= 0 || numSides <= 0) return 0;
  
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * numSides) + 1;
  }
  return total;
}


function parseAtk(atkString: string | undefined): number {
  if(!atkString) return 0;
  
  const parts = atkString.split('+');
  let totalAtk = parseInt(parts[0], 10) || 0;

  if (parts[1]) {
    totalAtk += rollDice(parts[1]);
  }
  return totalAtk;
}


export async function performAttack(payload: PerformAttackPayload): Promise<PerformAttackResult> {
  const { userId, battleId, targetMonsterId, equippedItemIds, supportedFaction } = payload;
  if (!userId || !battleId || !targetMonsterId) {
    return { success: false, error: '缺少必要的戰鬥資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const battleRef = doc(db, 'combatEncounters', battleId);

  try {
    const { logMessage, playerDamage, monsterDamage } = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const battleDoc = await transaction.get(battleRef);

      if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
      if (!battleDoc.exists()) throw new Error('找不到指定的戰場。');

      const user = userDoc.data() as User;
      const battle = battleDoc.data() as CombatEncounter;
      
      if (battle.status !== 'active') throw new Error('戰場目前不是戰鬥狀態。');
      
      const targetMonsterIndex = battle.monsters.findIndex(m => m.monsterId === targetMonsterId);
      if (targetMonsterIndex === -1) throw new Error('找不到指定的目標。');
      
      const targetMonster = { ...battle.monsters[targetMonsterIndex] };
      if (targetMonster.hp <= 0) throw new Error('目標已經被擊敗了。');

      // --- Get or initialize player's participant data ---
      let playerParticipantData = battle.participants?.[userId];
       if (!playerParticipantData) {
        playerParticipantData = {
          hp: user.attributes.hp,
          roleName: user.roleName,
          factionId: user.factionId,
          equippedItems: equippedItemIds,
          activeBuffs: [],
          skillCooldowns: {},
        };
      }


      if (playerParticipantData.hp <= 0) throw new Error('您的HP已歸零，無法行動。');

      // --- 1. Calculate Player Damage ---
      let playerBaseAtk = user.attributes.atk;
      let playerAtkMultiplier = 1;
      let playerDiceDamage = 0;
      let playerBaseDef = user.attributes.def;
      let playerDefMultiplier = 1;

      // Apply item effects
      if (equippedItemIds.length > 0) {
        const itemDocs = await Promise.all(equippedItemIds.map(id => transaction.get(doc(db, 'items', id))));
        itemDocs.forEach(itemDoc => {
            if(itemDoc.exists()) {
                const item = itemDoc.data() as Item;
                item.effects?.forEach(effect => {
                    if ('attribute' in effect) {
                         const attrEffect = effect as AttributeEffect;
                         if (attrEffect.attribute === 'atk') {
                            if (attrEffect.operator === '+') {
                               playerBaseAtk += Number(attrEffect.value);
                            } else if (attrEffect.operator === '*') {
                               playerAtkMultiplier *= Number(attrEffect.value);
                            } else if (attrEffect.operator === 'd') {
                               playerDiceDamage += rollDice(String(attrEffect.value));
                            }
                         }
                         if(effect.attribute === 'def') {
                             if(attrEffect.operator === '+') {
                                playerBaseDef += Number(attrEffect.value);
                             } else if (attrEffect.operator === '*') {
                                playerDefMultiplier *= Number(attrEffect.value);
                             }
                         }
                    }
                });
            }
        });
      }
      
      // Apply active skill buffs
      const activeBuffs = playerParticipantData.activeBuffs || [];
      activeBuffs.forEach(buff => {
        if (buff.effectType === 'atk_buff') {
          playerAtkMultiplier *= Number(buff.value);
        }
        if (buff.effectType === 'def_buff') {
          playerDefMultiplier *= Number(buff.value);
        }
      });
      
      const finalPlayerAtk = Math.round(playerBaseAtk * playerAtkMultiplier);
      const finalPlayerDamage = finalPlayerAtk + playerDiceDamage;
      targetMonster.hp = Math.max(0, targetMonster.hp - finalPlayerDamage);
      
      const finalPlayerDef = Math.round(playerBaseDef * playerDefMultiplier);

      // --- 2. Calculate Monster Damage ---
      const monsterRawDamage = parseAtk(targetMonster.atk);
      const finalMonsterDamage = Math.max(0, monsterRawDamage - finalPlayerDef);
      playerParticipantData.hp = Math.max(0, playerParticipantData.hp - finalMonsterDamage);

      // --- 3. Update buffs and cooldowns ---
      const updatedBuffs = (playerParticipantData.activeBuffs || [])
        .map(buff => ({ ...buff, turnsLeft: buff.turnsLeft - 1 }))
        .filter(buff => buff.turnsLeft > 0);
        
      const updatedCooldowns = { ...playerParticipantData.skillCooldowns };
      for (const skillId in updatedCooldowns) {
        updatedCooldowns[skillId] = Math.max(0, updatedCooldowns[skillId] - 1);
      }

      // --- 4. Update Firestore Battle Document ---
      const updatedMonsters = [...battle.monsters];
      updatedMonsters[targetMonsterIndex] = targetMonster;
      
      const updatedParticipantData: Participant = {
        ...playerParticipantData,
        hp: playerParticipantData.hp,
        equippedItems: equippedItemIds,
        activeBuffs: updatedBuffs,
        skillCooldowns: updatedCooldowns,
      };

      if (user.factionId === 'wanderer' && supportedFaction) {
        updatedParticipantData.supportedFaction = supportedFaction;
      }
      
      const updatedParticipants = {
          ...battle.participants,
          [userId]: updatedParticipantData
      };

      transaction.update(battleRef, { 
          monsters: updatedMonsters,
          participants: updatedParticipants,
      });
      
      // --- 5. Create a single, consolidated Battle Log Entry ---
      const consolidatedLogMessage = `${user.roleName} 對 ${targetMonster.name} 造成 ${finalPlayerDamage} 點傷害，並受到 ${finalMonsterDamage} 點反擊傷害。`;
      const battleLogRef = doc(collection(db, `combatEncounters/${battleId}/combatLogs`));
      transaction.set(battleLogRef, {
           id: battleLogRef.id,
           encounterId: battleId,
           logData: consolidatedLogMessage,
           timestamp: serverTimestamp(),
           turn: battle.turn, 
           type: 'player_attack'
      });

      return { logMessage: consolidatedLogMessage, playerDamage: finalMonsterDamage, monsterDamage: finalPlayerDamage };
    });

    return { success: true, logMessage, playerDamage: playerDamage, monsterDamage: monsterDamage };
  } catch (error: any) {
    console.error('Attack failed:', error);
    return { success: false, error: error.message || '攻擊失敗，請稍後再試。' };
  }
}
