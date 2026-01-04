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
        const itemSnap = await getDoc(doc(db, 'items', reward.itemId));
        if (itemSnap.exists()) itemName = (itemSnap.data() as Item).name;
    }
    
    let titleName = '';
    if (reward.titleId) {
        const titleSnap = await getDoc(doc(db, 'titles', reward.titleId));
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


export async function awardBattleDamageRewards(payload: AwardPayload): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    await ensureAdminAuth();
    const { battleId, thresholdReward, topYeluPlayerReward, topAssociationPlayerReward } = payload;

    if (!battleId) throw new Error('缺少戰場 ID。');

    // 1. Fetch battle data to get participants' factions
    const battleDoc = await getDoc(doc(db, 'combatEncounters', battleId));
    if (!battleDoc.exists()) throw new Error('找不到指定的戰場資料。');
    const battleData = battleDoc.data();
    const participants = battleData.participants || {};
    
    // Create a mapping from roleName to userId and factionId
    const roleNameToUserInfo: { [key: string]: { userId: string, factionId: string } } = {};
    for (const userId in participants) {
        roleNameToUserInfo[participants[userId].roleName] = { userId, factionId: participants[userId].factionId };
    }

    // 2. Fetch all logs for the battle to aggregate damage
    const logsQuery = query(collection(db, `combatEncounters/${battleId}/combatLogs`));
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map(d => d.data() as CombatLog);
    
    const damageByUser = new Map<string, { totalDamage: number, factionId: string }>();

    for (const log of logs) {
        let userInfo: { userId: string, factionId: string } | null = null;
        for (const roleName in roleNameToUserInfo) {
            if (log.logData.startsWith(roleName)) {
                userInfo = roleNameToUserInfo[roleName];
                break;
            }
        }
        
        if (userInfo && log.damage && log.damage > 0) {
            const currentData = damageByUser.get(userInfo.userId) || { totalDamage: 0, factionId: userInfo.factionId };
            damageByUser.set(userInfo.userId, { 
                totalDamage: currentData.totalDamage + log.damage,
                factionId: currentData.factionId
            });
        }
    }

    let messages: string[] = [];

    await runTransaction(db, async (transaction) => {
        // --- 3a. Process Threshold Reward ---
        if (thresholdReward.enabled) {
            if (!thresholdReward.titleId || thresholdReward.damageThreshold <= 0) {
                throw new Error('傷害閾值獎勵設定不完整。');
            }
            const userIdsToAward = Array.from(damageByUser.entries())
                .filter(([_, data]) => data.totalDamage >= thresholdReward.damageThreshold)
                .map(([userId, _]) => userId);

            if (userIdsToAward.length > 0) {
                 const titleSnap = await getDoc(doc(db, 'titles', thresholdReward.titleId));
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
        const yeluPlayers = Array.from(damageByUser.entries()).filter(([_, data]) => data.factionId === 'yelu');
        const associationPlayers = Array.from(damageByUser.entries()).filter(([_, data]) => data.factionId === 'association');
        
        let topYeluPlayer: [string, { totalDamage: number; factionId: string; }] | undefined;
        if (yeluPlayers.length > 0) {
            topYeluPlayer = yeluPlayers.reduce((max, player) => player[1].totalDamage > max[1].totalDamage ? player : max);
        }
        
        let topAssociationPlayer: [string, { totalDamage: number; factionId: string; }] | undefined;
        if (associationPlayers.length > 0) {
            topAssociationPlayer = associationPlayers.reduce((max, player) => player[1].totalDamage > max[1].totalDamage ? player : max);
        }

        if (topYeluPlayerReward.enabled && topYeluPlayer) {
            const [userId, userData] = topYeluPlayer;
            await awardSingleUser(transaction, userId, topYeluPlayerReward, `作為夜鷺陣營傷害冠軍，在「${battleData.name}」中獲得獎勵。`);
            const user = (await getDoc(doc(db, 'users', userId))).data() as User;
            messages.push(`已為夜鷺陣營傷害冠軍 ${user.roleName} (傷害: ${userData.totalDamage}) 發放獎勵。`);
        }
        
        if (topAssociationPlayerReward.enabled && topAssociationPlayer) {
            const [userId, userData] = topAssociationPlayer;
            await awardSingleUser(transaction, userId, topAssociationPlayerReward, `作為協會陣營傷害冠軍，在「${battleData.name}」中獲得獎勵。`);
            const user = (await getDoc(doc(db, 'users', userId))).data() as User;
            messages.push(`已為協會陣營傷害冠軍 ${user.roleName} (傷害: ${userData.totalDamage}) 發放獎勵。`);
        }
    });

    return { success: true, message: messages.join('\n') || '沒有設定任何獎勵，或無人符合條件。' };

  } catch (error: any) {
    console.error('Battle damage reward distribution failed:', error);
    return { success: false, error: error.message || '發放戰役傷害獎勵時發生未知錯誤。' };
  }
}
