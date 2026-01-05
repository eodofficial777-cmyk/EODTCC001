'use server';

import {
  getFirestore,
  collection,
  query,
  getDocs,
  doc,
  runTransaction,
  arrayUnion,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment,
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
  isPreview?: boolean; // Flag for previewing damage stats
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
}


async function awardSingleUser(transaction: any, userId: string, reward: RewardPayload, logMessage: string) {
    const userRef = doc(db, 'users', userId);
    
    let itemName = '';
    if (reward.itemId) {
        const itemSnap = await transaction.get(doc(db, 'items', reward.itemId));
        if (itemSnap.exists()) itemName = (itemSnap.data() as Item).name;
    }
    
    let titleName = '';
    if (reward.titleId) {
        const titleSnap = await transaction.get(doc(db, 'titles', reward.titleId));
        if (titleSnap.exists()) titleName = (titleSnap.data() as Title).name;
    }

    const userUpdate: { [key: string]: any } = {};
    const changeLog: string[] = [];

    if (reward.honorPoints) {
        userUpdate.honorPoints = increment(reward.honorPoints);
        changeLog.push(`+${reward.honorPoints} 榮譽點`);
    }
    if (reward.currency) {
        userUpdate.currency = increment(reward.currency);
        changeLog.push(`+${reward.currency} 貨幣`);
    }
    if (reward.itemId) {
        userUpdate.items = arrayUnion(reward.itemId);
        changeLog.push(`獲得道具「${itemName || reward.itemId}」`);
    }
    if (reward.titleId) {
        userUpdate.titles = arrayUnion(reward.titleId);
        changeLog.push(`獲得稱號「${titleName || reward.titleId}」`);
    }
    
    if (Object.keys(userUpdate).length > 0) {
        transaction.update(userRef, userUpdate);
    }

    const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
    transaction.set(activityLogRef, {
        id: activityLogRef.id,
        userId: userId,
        timestamp: serverTimestamp(),
        description: logMessage,
        change: changeLog.join(', ') || '系統紀錄'
    });
}


export async function awardBattleDamageRewards(payload: AwardPayload): Promise<{ success: boolean; error?: string; message?: string, damageStats?: any[] }> {
  try {
    await ensureAdminAuth();
    const { battleId, isPreview, thresholdReward, topYeluPlayerReward, topAssociationPlayerReward } = payload;

    if (!battleId) throw new Error('缺少戰場 ID。');

    // 1. Fetch battle data to get participants' factions
    const battleDoc = await getDoc(doc(db, 'combatEncounters', battleId));
    if (!battleDoc.exists()) throw new Error('找不到指定的戰場資料。');
    const battleData = battleDoc.data();
    const participants = battleData.participants || {};
    
    // Create a mapping from userId to factionId and roleName
    const userIdToUserInfo: { [key: string]: { factionId: string, roleName: string } } = {};
    for (const userId in participants) {
        userIdToUserInfo[userId] = { 
            factionId: participants[userId].factionId, 
            roleName: participants[userId].roleName 
        };
    }

    // 2. Fetch all logs for the battle to aggregate damage
    const logsQuery = query(collection(db, `combatEncounters/${battleId}/combatLogs`));
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map(d => d.data() as CombatLog);
    
    const damageByUser = new Map<string, number>();

    for (const log of logs) {
        // Use the userId from the log directly for accurate attribution
        if (log.userId && log.damage && log.damage > 0) {
            const currentDamage = damageByUser.get(log.userId) || 0;
            damageByUser.set(log.userId, currentDamage + log.damage);
        }
    }
    
    // Prepare damage stats for preview
    const damageStats = Array.from(damageByUser.entries()).map(([userId, totalDamage]) => ({
        userId,
        roleName: userIdToUserInfo[userId]?.roleName || '未知玩家',
        factionId: userIdToUserInfo[userId]?.factionId || '未知',
        totalDamage,
    })).sort((a,b) => b.totalDamage - a.totalDamage);

    if (isPreview) {
        return { success: true, damageStats };
    }

    let messages: string[] = [];

    await runTransaction(db, async (transaction) => {
        // --- 3a. Process Threshold Reward ---
        if (thresholdReward.enabled) {
            if (!thresholdReward.titleId || thresholdReward.damageThreshold <= 0) {
                throw new Error('傷害閾值獎勵設定不完整。');
            }
            const userIdsToAward = Array.from(damageByUser.entries())
                .filter(([_, totalDamage]) => totalDamage >= thresholdReward.damageThreshold)
                .map(([userId, _]) => userId);

            if (userIdsToAward.length > 0) {
                 const titleSnap = await transaction.get(doc(db, 'titles', thresholdReward.titleId));
                 if (!titleSnap.exists()) throw new Error(`找不到傷害閾值獎勵的稱號 ID: ${thresholdReward.titleId}`);
                 const titleName = (titleSnap.data() as Title).name;
                
                for (const userId of userIdsToAward) {
                    const userRef = doc(db, 'users', userId);
                    transaction.update(userRef, { titles: arrayUnion(thresholdReward.titleId) });

                    const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
                    transaction.set(activityLogRef, {
                        id: activityLogRef.id,
                        userId: userId,
                        timestamp: serverTimestamp(),
                        description: `在戰役「${battleData.name}」中造成大量傷害，獲得了特殊成就。`,
                        change: `獲得稱號「${titleName}」`
                    });
                }
                messages.push(`已為 ${userIdsToAward.length} 位傷害超過 ${thresholdReward.damageThreshold} 的玩家授予「${titleName}」稱號。`);
            } else {
                 messages.push(`沒有玩家達到 ${thresholdReward.damageThreshold} 的傷害閾值。`);
            }
        }

        // --- 3b. Process Top Player Rewards ---
        const yeluPlayers = Array.from(damageByUser.entries()).filter(([userId, _]) => userIdToUserInfo[userId]?.factionId === 'yelu');
        const associationPlayers = Array.from(damageByUser.entries()).filter(([userId, _]) => userIdToUserInfo[userId]?.factionId === 'association');
        
        let topYeluPlayer: [string, number] | undefined;
        if (yeluPlayers.length > 0) {
            topYeluPlayer = yeluPlayers.reduce((max, player) => player[1] > max[1] ? player : max);
        }
        
        let topAssociationPlayer: [string, number] | undefined;
        if (associationPlayers.length > 0) {
            topAssociationPlayer = associationPlayers.reduce((max, player) => player[1] > max[1] ? player : max);
        }

        if (topYeluPlayerReward.enabled && topYeluPlayer) {
            const [userId, totalDamage] = topYeluPlayer;
            await awardSingleUser(transaction, userId, topYeluPlayerReward, `作為夜鷺陣營傷害冠軍，在「${battleData.name}」中獲得獎勵。`);
            const user = userIdToUserInfo[userId];
            messages.push(`已為夜鷺陣營傷害冠軍 ${user.roleName} (傷害: ${totalDamage}) 發放獎勵。`);
        }
        
        if (topAssociationPlayerReward.enabled && topAssociationPlayer) {
            const [userId, totalDamage] = topAssociationPlayer;
            await awardSingleUser(transaction, userId, topAssociationPlayerReward, `作為協會陣營傷害冠軍，在「${battleData.name}」中獲得獎勵。`);
             const user = userIdToUserInfo[userId];
            messages.push(`已為協會陣營傷害冠軍 ${user.roleName} (傷害: ${totalDamage}) 發放獎勵。`);
        }
    });

    return { success: true, message: messages.join('\n') || '沒有設定任何獎勵，或無人符合條件。' };

  } catch (error: any) {
    console.error('Battle damage reward distribution failed:', error);
    return { success: false, error: error.message || '發放戰役傷害獎勵時發生未知錯誤。' };
  }
}
