'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  collection,
  writeBatch,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

// Helper function to parse dice notation like "1d6" or "2d10" and return the sum of rolls
function rollDice(diceNotation: string): number {
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
  const parts = atkString.split('+');
  let totalAtk = parseInt(parts[0], 10) || 0;
  if (parts[1]) {
    totalAtk += rollDice(parts[1]);
  }
  return totalAtk;
}


export async function performAttack(payload: PerformAttackPayload): Promise<{ success: boolean; error?: string }> {
  const { userId, battleId, targetMonsterName, equippedItemIds } = payload;
  if (!userId || !battleId || !targetMonsterName) {
    return { success: false, error: '缺少必要的戰鬥資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const battleRef = doc(db, 'combatEncounters', battleId);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const battleDoc = await transaction.get(battleRef);

      if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
      if (!battleDoc.exists()) throw new Error('找不到指定的戰場。');

      const user = userDoc.data() as User;
      const battle = battleDoc.data() as CombatEncounter;
      const playerCurrentHp = user.attributes.hp; // This will need to be tracked separately in a future update

      if (playerCurrentHp <= 0) throw new Error('您的 HP 已歸零，無法行動。');
      if (battle.status !== 'active') throw new Error('戰場目前不是戰鬥狀態。');
      
      const targetMonsterIndex = battle.monsters.findIndex(m => m.name === targetMonsterName);
      if (targetMonsterIndex === -1) throw new Error('找不到指定的目標。');
      
      const targetMonster = { ...battle.monsters[targetMonsterIndex] };
      if (targetMonster.hp <= 0) throw new Error('目標已經被擊敗了。');

      // --- 1. Calculate Player Damage ---
      let playerBaseAtk = user.attributes.atk;
      let playerDamageLog = `玩家 ${user.roleName} 的基礎攻擊力為 ${playerBaseAtk}。`;

      // Fetch equipped items and calculate bonuses
      if (equippedItemIds.length > 0) {
        const itemDocs = await Promise.all(equippedItemIds.map(id => transaction.get(doc(db, 'items', id))));
        itemDocs.forEach(itemDoc => {
            if(itemDoc.exists()) {
                const item = itemDoc.data() as Item;
                item.effects.forEach(effect => {
                    if ('attribute' in effect && effect.attribute === 'atk' && effect.operator === '+') {
                        playerBaseAtk += effect.value;
                        playerDamageLog += ` 裝備 ${item.name} 增加 ${effect.value} 攻擊力。`;
                    }
                });
            }
        });
      }
      const playerFinalDamage = playerBaseAtk; // For now, no dice rolls on player side
      playerDamageLog += ` 最終對 ${targetMonster.name} 造成 ${playerFinalDamage} 點傷害。`;
      
      targetMonster.hp = Math.max(0, targetMonster.hp - playerFinalDamage);
      playerDamageLog += ` ${targetMonster.name} 剩餘 HP: ${targetMonster.hp}。`;

      // --- 2. Calculate Monster Damage ---
      const monsterBaseAtkString = targetMonster.atk;
      const monsterFinalDamage = parseAtk(monsterBaseAtkString);
      const playerNewHp = Math.max(0, playerCurrentHp - monsterFinalDamage);
      const monsterDamageLog = `災獸 ${targetMonster.name} 反擊，對 ${user.roleName} 造成 ${monsterFinalDamage} 點傷害。玩家剩餘 HP: ${playerNewHp}。`;

      // --- 3. Update Firestore Documents ---
      const updatedMonsters = [...battle.monsters];
      updatedMonsters[targetMonsterIndex] = targetMonster;
      
      transaction.update(battleRef, { monsters: updatedMonsters });
      // In a future update, we'll track battle-specific HP on the user or a subcollection.
      // For now, we are not persisting player HP change.
      
      // --- 4. Create Battle Log Entries ---
      const logBatch = writeBatch(db);
      const playerLogRef = doc(collection(battleRef, 'combatLogs'));
      logBatch.set(playerLogRef, {
        id: playerLogRef.id,
        encounterId: battleId,
        logData: playerDamageLog,
        timestamp: serverTimestamp(),
        turn: battle.turn,
        type: 'player_attack'
      });
      
      const monsterLogRef = doc(collection(battleRef, 'combatLogs'));
      logBatch.set(monsterLogRef, {
        id: monsterLogRef.id,
        encounterId: battleId,
        logData: monsterDamageLog,
        timestamp: serverTimestamp(),
        turn: battle.turn,
        type: 'monster_attack'
      });

      // This is a separate batch, but transactions guarantee it won't commit if the above fails.
      // However, we need to commit this outside the transaction. We'll handle this in the calling function.
      // For now, let's just create the logs. The transaction ensures we read consistent data.
       const battleLogRefPlayer = doc(collection(db, `combatEncounters/${battleId}/combatLogs`));
       transaction.set(battleLogRefPlayer, {
           logData: playerDamageLog,
           timestamp: serverTimestamp(),
           turn: battle.turn,
           type: 'player_attack'
       });
       
       const battleLogRefMonster = doc(collection(db, `combatEncounters/${battleId}/combatLogs`));
       transaction.set(battleLogRefMonster, {
           logData: monsterDamageLog,
           timestamp: serverTimestamp(),
           turn: battle.turn,
           type: 'monster_attack'
       });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Attack failed:', error);
    return { success: false, error: error.message || '攻擊失敗，請稍後再試。' };
  }
}
