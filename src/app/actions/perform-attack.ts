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
import type { User, Item, CombatEncounter, Monster } from '@/lib/types';

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
  targetMonsterName: string;
  equippedItemIds: string[];
}

export interface PerformAttackResult {
    success: boolean;
    error?: string;
    playerDamageDealt?: number;
    monsterDamageDealt?: number;
    logMessage?: string;
}


// Helper function to parse dice notation like "1d6" or "2d10" and return the sum of rolls
function rollDice(diceNotation: string): number {
  if (!diceNotation || !diceNotation.includes('d')) return 0;
  const [numDice, numSides] = diceNotation.toLowerCase().split('d').map(Number);
  if (isNaN(numDice) || isNaN(numSides)) return 0;
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * numSides) + 1;
  }
  return total;
}

// Helper function to parse ATK strings like "20+1d10"
function parseAtk(atkString: string): number {
  if(!atkString) return 0;
  const parts = atkString.split('+');
  let totalAtk = parseInt(parts[0], 10) || 0;
  if (parts[1]) {
    totalAtk += rollDice(parts[1]);
  }
  return totalAtk;
}


export async function performAttack(payload: PerformAttackPayload): Promise<PerformAttackResult> {
  const { userId, battleId, targetMonsterName, equippedItemIds } = payload;
  if (!userId || !battleId || !targetMonsterName) {
    return { success: false, error: '缺少必要的戰鬥資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const battleRef = doc(db, 'combatEncounters', battleId);

  try {
    const { playerDamage, monsterDamage, logMessage } = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const battleDoc = await transaction.get(battleRef);

      if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
      if (!battleDoc.exists()) throw new Error('找不到指定的戰場。');

      const user = userDoc.data() as User;
      const battle = battleDoc.data() as CombatEncounter;
      
      // We will manage HP on the client-side for immediate feedback, so we don't need to read it here.
      // But we must check the battle status.
      if (battle.status !== 'active') throw new Error('戰場目前不是戰鬥狀態。');
      
      const targetMonsterIndex = battle.monsters.findIndex(m => m.name === targetMonsterName);
      if (targetMonsterIndex === -1) throw new Error('找不到指定的目標。');
      
      const targetMonster = { ...battle.monsters[targetMonsterIndex] };
      if (targetMonster.hp <= 0) throw new Error('目標已經被擊敗了。');

      // --- 1. Calculate Player Damage ---
      let playerBaseAtk = user.attributes.atk;

      // Fetch equipped items and calculate bonuses
      if (equippedItemIds.length > 0) {
        const itemDocs = await Promise.all(equippedItemIds.map(id => transaction.get(doc(db, 'items', id))));
        itemDocs.forEach(itemDoc => {
            if(itemDoc.exists()) {
                const item = itemDoc.data() as Item;
                item.effects.forEach(effect => {
                    if ('attribute' in effect && effect.attribute === 'atk' && effect.operator === '+') {
                        playerBaseAtk += effect.value;
                    }
                     if ('attribute' in effect && effect.attribute === 'atk' && effect.operator === 'd') {
                        playerBaseAtk += rollDice(`1d${effect.value}`);
                    }
                });
            }
        });
      }
      
      const finalPlayerDamage = playerBaseAtk;
      targetMonster.hp = Math.max(0, targetMonster.hp - finalPlayerDamage);
      
      // --- 2. Calculate Monster Damage ---
      const monsterBaseAtkString = targetMonster.atk;
      const finalMonsterDamage = parseAtk(monsterBaseAtkString);

      // --- 3. Update Firestore Battle Document ---
      const updatedMonsters = [...battle.monsters];
      updatedMonsters[targetMonsterIndex] = targetMonster;
      transaction.update(battleRef, { monsters: updatedMonsters });
      
      // --- 4. Create a single, consolidated Battle Log Entry ---
      const consolidatedLogMessage = `您對 ${targetMonster.name} 造成 ${finalPlayerDamage} 點傷害，並受到 ${finalMonsterDamage} 點反擊傷害。`;
      const battleLogRef = doc(collection(db, `combatEncounters/${battleId}/combatLogs`));
      transaction.set(battleLogRef, {
           logData: consolidatedLogMessage,
           timestamp: serverTimestamp(),
           turn: battle.turn, // Turn can still be useful for other mechanics
           type: 'player_attack'
      });

      return { playerDamage: finalPlayerDamage, monsterDamage: finalMonsterDamage, logMessage: consolidatedLogMessage };
    });

    return { success: true, playerDamageDealt: playerDamage, monsterDamageDealt: monsterDamage, logMessage };
  } catch (error: any) {
    console.error('Attack failed:', error);
    return { success: false, error: error.message || '攻擊失敗，請稍後再試。' };
  }
}
