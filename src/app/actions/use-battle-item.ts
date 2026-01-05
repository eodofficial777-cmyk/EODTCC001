
'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  collection,
} from 'firebase/firestore';
import { getDatabase, ref, push } from 'firebase/database';
import { initializeApp, getApps, App } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, Item, CombatEncounter, Participant, ActiveBuff, Monster, TriggeredEffect } from '@/lib/types';


let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);
const rtdb = getDatabase(app);

interface UseItemPayload {
  userId: string;
  battleId: string;
  itemId: string;
  targetMonsterId?: string;
}

export interface UseItemResult {
    success: boolean;
    error?: string;
    logMessage?: string;
}

export async function useBattleItem(payload: UseItemPayload): Promise<UseItemResult> {
  const { userId, battleId, itemId, targetMonsterId } = payload;
  if (!userId || !battleId || !itemId) {
    return { success: false, error: '缺少必要的使用道具資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const itemRef = doc(db, 'items', itemId);
  const battleRef = doc(db, 'combatEncounters', battleId);

  try {
    const { logMessage, logEntry } = await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const itemDoc = await transaction.get(itemRef);
        const battleDoc = await transaction.get(battleRef);

        if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
        if (!itemDoc.exists()) throw new Error('找不到指定的道具。');
        if (!battleDoc.exists()) throw new Error('找不到指定的戰場。');

        let user = userDoc.data() as User;
        const item = itemDoc.data() as Item;
        const battle = battleDoc.data() as CombatEncounter;

        if (battle.status !== 'active') throw new Error('戰場目前不是戰鬥狀態。');
        
        let participant = battle.participants?.[userId];
        if (!participant) {
            participant = { hp: user.attributes.hp, roleName: user.roleName, factionId: user.factionId, equippedItems: [], activeBuffs: [], skillCooldowns: {} };
        }
        
        if (participant.hp <= 0) throw new Error('您的HP已歸零，無法使用道具。');
        
        const userItems = [...(user.items || [])];
        const itemIndex = userItems.indexOf(itemId);
        if (itemIndex === -1) throw new Error(`您的背包中沒有「${item.name}」。`);

        let logMessages: string[] = [`${user.roleName} 使用了「${item.name}」。`];
        const monsters = [...battle.monsters];
        const activeBuffs = [...(participant.activeBuffs || [])];
        let totalDamageDealtThisAction = 0;

        for (const effect of item.effects as TriggeredEffect[]) {
            if (effect.trigger !== 'on_use') continue;
            
            const roll = Math.random() * 100;
            if (roll > effect.probability) {
                logMessages.push(`但什麼也沒發生...`);
                continue;
            }

            switch(effect.effectType) {
                case 'hp_recovery':
                    participant.hp = Math.min(user.attributes.hp, participant.hp + effect.value);
                    logMessages.push(`恢復了 ${effect.value} 點 HP。`);
                    break;
                case 'hp_cost':
                    participant.hp = Math.max(0, participant.hp - effect.value);
                    logMessages.push(`消耗了 ${effect.value} 點 HP。`);
                    break;
                case 'damage_enemy':
                    if (!targetMonsterId) throw new Error('此道具需要指定一個目標。');
                    const targetIndex = monsters.findIndex(m => m.monsterId === targetMonsterId);
                    if (targetIndex === -1) throw new Error('找不到指定的目標。');
                    if (monsters[targetIndex].hp <= 0) throw new Error('目標已經被擊敗了。');
                    
                    const damage = effect.value;
                    totalDamageDealtThisAction += damage;
                    monsters[targetIndex].hp = Math.max(0, monsters[targetIndex].hp - damage);
                    logMessages.push(`對 ${monsters[targetIndex].name} 造成了 ${damage} 點傷害。`);
                    break;
                case 'atk_buff':
                case 'def_buff':
                    if(effect.duration) {
                        const newBuff: ActiveBuff = { ...effect, turnsLeft: effect.duration };
                        activeBuffs.push(newBuff);
                         logMessages.push(`獲得了 ${effect.effectType === 'atk_buff' ? '攻擊' : '防禦'} 增益效果，持續 ${effect.duration} 回合。`);
                    }
                    break;
            }
        }
        
        userItems.splice(itemIndex, 1);
        const userUpdateData: {[key: string]: any} = {
            items: userItems,
            [`itemUseCount.${itemId}`]: increment(1)
        };
        transaction.update(userRef, userUpdateData);

        transaction.update(battleRef, {
            monsters,
            [`participants.${userId}`]: {
              ...participant,
              activeBuffs,
            },
        });
        
        const finalLogMessage = logMessages.join(' ');
        
        const logData: any = {
            encounterId: battleId,
            userId: userId,
            userFaction: user.factionId,
            logData: finalLogMessage,
            timestamp: serverTimestamp(),
            turn: battle.turn,
            type: 'item_used',
            itemId,
        };

        if (totalDamageDealtThisAction > 0) {
            logData.damage = totalDamageDealtThisAction;
        }

        const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
        transaction.set(activityLogRef, {
            id: activityLogRef.id,
            userId,
            timestamp: serverTimestamp(),
            description: `在戰鬥中使用了「${item.name}」`,
            change: `消耗 1 個 ${item.name}`,
        });
        
        return { logMessage: finalLogMessage, logEntry: logData };
    });
    
    // --- Write to Realtime Database (outside transaction) ---
    if (logEntry) {
        const battleLogRtdbRef = ref(rtdb, `battle_buffer/${battleId}`);
        const rtdbLogEntry = { ...logEntry, timestamp: new Date().toISOString() };
        await push(battleLogRtdbRef, rtdbLogEntry);
    }

    return { success: true, logMessage };

  } catch (error: any) {
    console.error('Item usage failed:', error);
    return { success: false, error: error.message || '使用道具失敗，請稍後再試。' };
  }
}
