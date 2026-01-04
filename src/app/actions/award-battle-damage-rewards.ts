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
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { CombatLog, Title } from '@/lib/types';

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

export async function awardBattleDamageRewards(payload: {
  battleId: string;
  damageThreshold: number;
  titleId: string;
}): Promise<{ success: boolean; error?: string; processedCount?: number; awardedUsers?: string[] }> {
  try {
    await ensureAdminAuth();
    const { battleId, damageThreshold, titleId } = payload;

    if (!battleId || !titleId || damageThreshold <= 0) {
      throw new Error('缺少戰場 ID、稱號 ID 或傷害閾值無效。');
    }

    // 1. Fetch all logs for the battle
    const logsQuery = query(collection(db, `combatEncounters/${battleId}/combatLogs`));
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map(d => d.data() as CombatLog);

    // 2. Aggregate damage by user
    const damageByUser = new Map<string, number>();
    const battleDoc = await getDoc(doc(db, 'combatEncounters', battleId));
    if (!battleDoc.exists()) {
        throw new Error('找不到指定的戰場資料。');
    }
    const participants = battleDoc.data().participants || {};

    // Create a mapping from roleName to userId
    const roleNameToUserId: { [key: string]: string } = {};
    for (const userId in participants) {
        roleNameToUserId[participants[userId].roleName] = userId;
    }

    for (const log of logs) {
        // Find the user ID based on who initiated the log
        let userId: string | null = null;
        for (const roleName in roleNameToUserId) {
            if (log.logData.startsWith(roleName)) {
                userId = roleNameToUserId[roleName];
                break;
            }
        }
        
        if (userId && log.damage && log.damage > 0) {
            const currentDamage = damageByUser.get(userId) || 0;
            damageByUser.set(userId, currentDamage + log.damage);
        }
    }
    
    // 3. Filter users who meet the threshold
    const userIdsToAward: string[] = [];
    for (const [userId, totalDamage] of damageByUser.entries()) {
        if (totalDamage >= damageThreshold) {
            userIdsToAward.push(userId);
        }
    }

    if (userIdsToAward.length === 0) {
        return { success: true, processedCount: 0, awardedUsers: [] };
    }

    // 4. Award the title
    const titleSnap = await getDoc(doc(db, 'titles', titleId));
    if (!titleSnap.exists()) {
      throw new Error(`找不到稱號 ID: ${titleId}`);
    }
    const titleName = (titleSnap.data() as Title).name;

    let awardedCount = 0;
    for (const userId of userIdsToAward) {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            transaction.update(userRef, {
                titles: arrayUnion(titleId)
            });

            const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
            transaction.set(activityLogRef, {
                id: activityLogRef.id,
                userId: userId,
                timestamp: serverTimestamp(),
                description: `在戰役中造成大量傷害，獲得了特殊成就。`,
                change: `獲得稱號「${titleName}」`
            });
        });
        awardedCount++;
    }

    return { success: true, processedCount: awardedCount, awardedUsers: userIdsToAward };

  } catch (error: any) {
    console.error('Battle damage reward distribution failed:', error);
    return { success: false, error: error.message || '發放戰役傷害獎勵時發生未知錯誤。' };
  }
}
