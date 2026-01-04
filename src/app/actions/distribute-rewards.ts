
'use server';

import {
  getFirestore,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  increment,
  arrayUnion,
  doc,
  runTransaction,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { User, Item, Title, CombatLog, CombatEncounter } from '@/lib/types';


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

export interface RewardPayload {
  honorPoints?: number;
  currency?: number;
  itemId?: string;
  titleId?: string;
  logMessage: string;
}

export interface FilterCriteria {
  factionId?: string;
  raceId?: string;
  honorPoints_op?: '>' | '<';
  honorPoints_val?: number;
  currency_op?: '>' | '<';
  currency_val?: number;
  taskCount_op?: '>' | '<';
  taskCount_val?: number;
  participatedBattleCount_op?: '>' | '<';
  participatedBattleCount_val?: number;
  hpZeroCount_op?: '>' | '<';
  hpZeroCount_val?: number;
  itemUse_id?: string;
  itemUse_op?: '>' | '<';
  itemUse_val?: number;
}

export interface DistributionPayload {
    targetUserIds?: string[];
    filters?: FilterCriteria;
    rewards: RewardPayload;
    isBattleEnd?: boolean;
    battleData?: CombatEncounter;
}


export async function distributeRewards(payload: DistributionPayload): Promise<{
    success: boolean;
    error?: string;
    processedCount?: number;
    processedUsers?: { id: string; roleName: string }[]
}> {
  try {
    await ensureAdminAuth();
    const { targetUserIds, filters, rewards } = payload;
    let finalUserIds: string[] = [];

    let itemName = '';
    if (rewards.itemId) {
      const itemSnap = await getDoc(doc(db, 'items', rewards.itemId));
      if (itemSnap.exists()) itemName = (itemSnap.data() as Item).name;
    }
    let titleName = '';
    if (rewards.titleId) {
        const titleSnap = await getDoc(doc(db, 'titles', rewards.titleId));
        if (titleSnap.exists()) titleName = (titleSnap.data() as Title).name;
    }

    if (targetUserIds && targetUserIds.length > 0) {
      finalUserIds = targetUserIds;
    } else if (filters) {
        const usersQuery = query(collection(db, 'users'), where('approved', '==', true));
        const usersSnapshot = await getDocs(usersQuery);
        const userPool = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      
        const filtered = userPool.filter(user => {
            if (filters.factionId && user.factionId !== filters.factionId) return false;
            if (filters.raceId && user.raceId !== filters.raceId) return false;
            if (filters.honorPoints_op === '>' && user.honorPoints <= (filters.honorPoints_val || 0)) return false;
            if (filters.honorPoints_op === '<' && user.honorPoints >= (filters.honorPoints_val || 0)) return false;
            if (filters.currency_op === '>' && user.currency <= (filters.currency_val || 0)) return false;
            if (filters.currency_op === '<' && user.currency >= (filters.currency_val || 0)) return false;
            if (filters.taskCount_op === '>' && (user.tasks || []).length <= (filters.taskCount_val || 0)) return false;
            if (filters.taskCount_op === '<' && (user.tasks || []).length >= (filters.taskCount_val || 0)) return false;
            if (filters.participatedBattleCount_op === '>' && (user.participatedBattleIds || []).length <= (filters.participatedBattleCount_val || 0)) return false;
            if (filters.participatedBattleCount_op === '<' && (user.participatedBattleIds || []).length >= (filters.participatedBattleCount_val || 0)) return false;
            if (filters.hpZeroCount_op === '>' && (user.hpZeroCount || 0) <= (filters.hpZeroCount_val || 0)) return false;
            if (filters.hpZeroCount_op === '<' && (user.hpZeroCount || 0) >= (filters.hpZeroCount_val || 0)) return false;
            if (filters.itemUse_id && filters.itemUse_op === '>' && (user.itemUseCount?.[filters.itemUse_id] || 0) <= (filters.itemUse_val || 0)) return false;
            if (filters.itemUse_id && filters.itemUse_op === '<' && (user.itemUseCount?.[filters.itemUse_id] || 0) >= (filters.itemUse_val || 0)) return false;
            return true;
        });

        finalUserIds = filtered.map(user => user.id);
    }

    if (finalUserIds.length === 0) {
      return { success: true, processedCount: 0, processedUsers: [] };
    }

    const chunkSize = 400;
    let processedCount = 0;
    
    for (let i = 0; i < finalUserIds.length; i += chunkSize) {
        const chunk = finalUserIds.slice(i, i + chunkSize);
        
        for (const userId of chunk) {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', userId);
                const userSnap = await transaction.get(userRef);
                if (!userSnap.exists()) return;

                const userUpdate: { [key: string]: any } = {};
                let changeLog = [];

                if (rewards.honorPoints) {
                    userUpdate.honorPoints = increment(rewards.honorPoints);
                    changeLog.push(`+${rewards.honorPoints} 榮譽點`);
                }
                if (rewards.currency) {
                    userUpdate.currency = increment(rewards.currency);
                     changeLog.push(`+${rewards.currency} 貨幣`);
                }
                if (rewards.itemId) {
                    userUpdate.items = arrayUnion(rewards.itemId);
                    changeLog.push(`獲得道具「${itemName || rewards.itemId}」`);
                }
                if (rewards.titleId) {
                    userUpdate.titles = arrayUnion(rewards.titleId);
                    changeLog.push(`獲得稱號「${titleName || rewards.titleId}」`);
                }

                transaction.update(userRef, userUpdate);

                const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
                transaction.set(activityLogRef, {
                    id: activityLogRef.id,
                    userId: userId,
                    timestamp: serverTimestamp(),
                    description: rewards.logMessage,
                    change: changeLog.join(', ') || '系統發放'
                });
            });
        }
        processedCount += chunk.length;
    }

    const finalUsersData = await Promise.all(finalUserIds.map(id => getDoc(doc(db, 'users', id))));
    const processedUsers = finalUsersData.map(snap => {
        if (!snap.exists()) return { id: snap.id, roleName: 'Unknown User' };
        const userData = snap.data() as User;
        return { id: userData.id, roleName: userData.roleName };
    })
    
    return { success: true, processedCount, processedUsers };
  } catch (error: any) {
    console.error('Reward distribution failed:', error);
    return { success: false, error: error.message || '發放獎勵時發生未知錯誤。' };
  }
}
