
'use server';

import {
  getFirestore,
  collection,
  query,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment,
  DocumentReference,
  Transaction,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { CombatLog, Title, User, Item } from '@/lib/types';

const ADMIN_EMAIL = 'admin@eodtcc.com';
const ADMIN_PASSWORD = 'password';

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

async function ensureAdminAuth() {
  if (auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error) {
      console.error('Admin sign-in failed during reward distribution:', error);
      throw new Error('管理員登入失敗，無法發放獎勵。');
    }
  }
}

interface RewardPayload {
    titleId?: string;
    itemId?: string;
    honorPoints?: number;
    currency?: number;
}

interface AwardPayload {
  battleId: string;
  isPreview?: boolean; 
  thresholdReward: {
    enabled: boolean;
    damageThreshold: number;
    titleId: string;
  };
  topYeluPlayerReward: {
    enabled: boolean;
  } & RewardPayload;
  topAssociationPlayerReward: {
    enabled: boolean;
  } & RewardPayload;
   topWandererPlayerReward: {
    enabled: boolean;
  } & RewardPayload;
}


async function awardSingleUser(
    transaction: Transaction, 
    userRef: DocumentReference,
    reward: RewardPayload, 
    logMessage: string,
    dataNames: { itemName: string, titleName: string }
) {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) return;

    const user = userSnap.data() as User;
    const updates: { [key: string]: any } = {};
    const changeLog: string[] = [];

    // --- Manual Calculation for all fields ---
    if (reward.honorPoints) {
        updates.honorPoints = (user.honorPoints || 0) + reward.honorPoints;
        changeLog.push(`+${reward.honorPoints} 榮譽點`);
    }
    if (reward.currency) {
        updates.currency = (user.currency || 0) + reward.currency;
        updates.totalCurrencyEarned = (user.totalCurrencyEarned || 0) + reward.currency;
        changeLog.push(`+${reward.currency} 貨幣`);
    }
    if (reward.itemId) {
        updates.items = [...(user.items || []), reward.itemId];
        changeLog.push(`獲得道具「${dataNames.itemName || reward.itemId}」`);
    }
    if (reward.titleId) {
        const newTitles = [...(user.titles || [])];
        if (!newTitles.includes(reward.titleId)) {
            newTitles.push(reward.titleId);
        }
        updates.titles = newTitles;
        changeLog.push(`獲得稱號「${dataNames.titleName || reward.titleId}」`);
    }
    
    if (Object.keys(updates).length > 0) {
        transaction.update(userRef, updates);
    }

    const activityLogRef = doc(collection(db, `users/${user.id}/activityLogs`));
    transaction.set(activityLogRef, {
        id: activityLogRef.id,
        userId: user.id,
        timestamp: serverTimestamp(),
        description: logMessage,
        change: changeLog.join(', ') || '系統紀錄'
    });
}


function parseDamageFromLog(logData: string): number {
    const damageMatch = logData.match(/造成 (\d+) 點傷害/);
    if (damageMatch && damageMatch[1]) {
        return parseInt(damageMatch[1], 10);
    }
    return 0;
}


export async function awardBattleDamageRewards(payload: AwardPayload): Promise<{ success: boolean; error?: string; message?: string, damageStats?: any[] }> {
  try {
    await ensureAdminAuth();
    const { battleId, isPreview, thresholdReward, topYeluPlayerReward, topAssociationPlayerReward, topWandererPlayerReward } = payload;

    if (!battleId) throw new Error('缺少戰場 ID。');

    const battleDoc = await getDoc(doc(db, 'combatEncounters', battleId));
    if (!battleDoc.exists()) throw new Error('找不到指定的戰場資料。');
    const battleData = battleDoc.data();
    const participants = battleData.participants || {};
    
    const userIdToUserInfo: { [key: string]: { factionId: string, roleName: string } } = {};
    for (const userId in participants) {
        userIdToUserInfo[userId] = { 
            factionId: participants[userId].factionId, 
            roleName: participants[userId].roleName 
        };
    }

    const logsQuery = query(collection(db, `combatEncounters/${battleId}/combatLogs`));
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map(d => d.data() as CombatLog);
    
    const damageByUser = new Map<string, number>();

    for (const log of logs) {
        if (log.userId) {
            let damageDealt = 0;
            if (log.damage && typeof log.damage === 'number' && log.damage > 0) {
                damageDealt = log.damage;
            } else if (log.logData) {
                damageDealt = parseDamageFromLog(log.logData);
            }

            if (damageDealt > 0) {
                 const currentDamage = damageByUser.get(log.userId) || 0;
                 damageByUser.set(log.userId, currentDamage + damageDealt);
            }
        }
    }
    
    const damageStats = Array.from(damageByUser.entries()).map(([userId, totalDamage]) => ({
        userId,
        roleName: userIdToUserInfo[userId]?.roleName || '未知玩家',
        factionId: userIdToUserInfo[userId]?.factionId || '未知',
        totalDamage,
    })).sort((a,b) => b.totalDamage - a.totalDamage);

    if (isPreview) {
        return { success: true, damageStats };
    }

    const allRewardPayloads = [thresholdReward, topYeluPlayerReward, topAssociationPlayerReward, topWandererPlayerReward];
    const uniqueTitleIds = [...new Set(allRewardPayloads.map(r => r.titleId).filter(Boolean))] as string[];
    const uniqueItemIds = [...new Set(allRewardPayloads.map(r => r.itemId).filter(Boolean))] as string[];
    
    const titleDocs = uniqueTitleIds.length > 0 ? await Promise.all(uniqueTitleIds.map(id => getDoc(doc(db, 'titles', id)))) : [];
    const itemDocs = uniqueItemIds.length > 0 ? await Promise.all(uniqueItemIds.map(id => getDoc(doc(db, 'items', id)))) : [];

    const titleNames = new Map(titleDocs.map(d => [d.id, (d.data() as Title)?.name || '']));
    const itemNames = new Map(itemDocs.map(d => [d.id, (d.data() as Item)?.name || '']));

    let messages: string[] = [];

    const yeluPlayers = damageStats.filter(p => p.factionId === 'yelu');
    const associationPlayers = damageStats.filter(p => p.factionId === 'association');
    const wandererPlayers = damageStats.filter(p => p.factionId !== 'yelu' && p.factionId !== 'association');

    const topYeluPlayer = yeluPlayers.length > 0 ? yeluPlayers[0] : undefined;
    const topAssociationPlayer = associationPlayers.length > 0 ? associationPlayers[0] : undefined;
    const topWandererPlayer = wandererPlayers.length > 0 ? wandererPlayers[0] : undefined;


    // --- Process Threshold Reward in a separate transaction ---
    if (thresholdReward.enabled && thresholdReward.titleId && thresholdReward.damageThreshold > 0) {
        const userIdsToAward = Array.from(damageByUser.entries())
            .filter(([_, totalDamage]) => totalDamage >= thresholdReward.damageThreshold)
            .map(([userId, _]) => userId);
        
        const titleName = titleNames.get(thresholdReward.titleId) || '未知稱號';
        if (userIdsToAward.length > 0) {
            for (const userId of userIdsToAward) {
                try {
                    await runTransaction(db, async (transaction) => {
                        const userRef = doc(db, 'users', userId);
                        const userSnap = await transaction.get(userRef);
                        if (!userSnap.exists()) return;

                        const user = userSnap.data() as User;
                        const newTitles = [...(user.titles || [])];
                        if (!newTitles.includes(thresholdReward.titleId)) {
                             newTitles.push(thresholdReward.titleId);
                             transaction.update(userRef, { titles: newTitles });
                        }
                        
                        const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
                        transaction.set(activityLogRef, {
                            id: activityLogRef.id,
                            userId: userId,
                            timestamp: serverTimestamp(),
                            description: `在戰役「${battleData.name}」中造成大量傷害，獲得了特殊成就。`,
                            change: `獲得稱號「${titleName}」`
                        });
                    });
                } catch (e: any) {
                     console.error(`Failed to award threshold title to ${userId}:`, e.message);
                }
            }
            messages.push(`已為 ${userIdsToAward.length} 位傷害超過 ${thresholdReward.damageThreshold} 的玩家授予「${titleName}」稱號。`);
        } else {
             messages.push(`沒有玩家達到 ${thresholdReward.damageThreshold} 的傷害閾值。`);
        }
    }

    // --- Process MVP Rewards in individual transactions ---
    const mvpAwards = [
      { condition: topYeluPlayerReward.enabled && topYeluPlayer, player: topYeluPlayer, reward: topYeluPlayerReward, label: `夜鷺陣營傷害冠軍` },
      { condition: topAssociationPlayerReward.enabled && topAssociationPlayer, player: topAssociationPlayer, reward: topAssociationPlayerReward, label: `協會陣營傷害冠軍` },
      { condition: topWandererPlayerReward.enabled && topWandererPlayer, player: topWandererPlayer, reward: topWandererPlayerReward, label: `流浪者傷害冠軍` },
    ];

    for (const award of mvpAwards) {
      if (award.condition) {
        try {
          await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', award.player!.userId);
            const dataNames = {
              itemName: itemNames.get(award.reward.itemId || '') || '',
              titleName: titleNames.get(award.reward.titleId || '') || ''
            };
            await awardSingleUser(transaction, userRef, award.reward, `作為${award.label}，在「${battleData.name}」中獲得獎勵。`, dataNames);
          });
          messages.push(`已為${award.label} ${award.player!.roleName} (傷害: ${award.player!.totalDamage}) 發放獎勵。`);
        } catch (e: any) {
          messages.push(`為${award.label} ${award.player!.roleName}發放獎勵時失敗: ${e.message}`);
          console.error(`Failed to award MVP reward to ${award.player!.userId}:`, e.message);
        }
      }
    }

    return { success: true, message: messages.join('\n') || '沒有設定任何獎勵，或無人符合條件。' };

  } catch (error: any) {
    console.error('Battle damage reward distribution failed:', error);
    return { success: false, error: error.message || '發放戰役傷害獎勵時發生未知錯誤。' };
  }
}
