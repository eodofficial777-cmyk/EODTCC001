
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
  honorPoints_op?: '>=' | '<=';
  honorPoints_val?: number;
  currency_op?: '>=' | '<=';
  currency_val?: number;
  taskCount_op?: '>=' | '<=';
  taskCount_val?: number;
  participatedBattleCount_op?: '>=' | '<=';
  participatedBattleCount_val?: number;
  hpZeroCount_op?: '>=' | '<=';
  hpZeroCount_val?: number;
  itemUse_id?: string;
  itemUse_op?: '>=' | '<=';
  itemUse_val?: number;
}

export interface DistributionPayload {
    targetUserIds?: string[];
    filters?: FilterCriteria;
    rewards: RewardPayload;
    isBattleEnd?: boolean;
    battleData?: CombatEncounter;
}

function applyFilters(user: User, filters: FilterCriteria): boolean {
    if (!filters) return true;
    if (user.isAdmin) return false;

    // Faction filter
    if (filters.factionId && user.factionId !== filters.factionId) return false;

    // Race filter
    if (filters.raceId && user.raceId !== filters.raceId) return false;

    // Honor Points filter
    if (filters.honorPoints_op && typeof filters.honorPoints_val === 'number') {
        const value = filters.honorPoints_val;
        if (filters.honorPoints_op === '>=' && user.honorPoints < value) return false;
        if (filters.honorPoints_op === '<=' && user.honorPoints > value) return false;
    }

    // Total Currency Earned filter
    if (filters.currency_op && typeof filters.currency_val === 'number') {
        const totalCurrency = user.totalCurrencyEarned || 0;
        const value = filters.currency_val;
        if (filters.currency_op === '>=' && totalCurrency < value) return false;
        if (filters.currency_op === '<=' && totalCurrency > value) return false;
    }

    // Task Count filter
    if (filters.taskCount_op && typeof filters.taskCount_val === 'number') {
        const taskCount = (user.tasks || []).length;
        const value = filters.taskCount_val;
        if (filters.taskCount_op === '>=' && taskCount < value) return false;
        if (filters.taskCount_op === '<=' && taskCount > value) return false;
    }

    // Battle Participation filter
    if (filters.participatedBattleCount_op && typeof filters.participatedBattleCount_val === 'number') {
        const battleCount = (user.participatedBattleIds || []).length;
        const value = filters.participatedBattleCount_val;
        if (filters.participatedBattleCount_op === '>=' && battleCount < value) return false;
        if (filters.participatedBattleCount_op === '<=' && battleCount > value) return false;
    }
    
    // HP Zero Count filter
    if (filters.hpZeroCount_op && typeof filters.hpZeroCount_val === 'number') {
        const hpZeroCount = user.hpZeroCount || 0;
        const value = filters.hpZeroCount_val;
        if (filters.hpZeroCount_op === '>=' && hpZeroCount < value) return false;
        if (filters.hpZeroCount_op === '<=' && hpZeroCount > value) return false;
    }

    // Item Use filter
    if (filters.itemUse_id && filters.itemUse_op && typeof filters.itemUse_val === 'number') {
        const userItemUseCount = user.itemUseCount?.[filters.itemUse_id] || 0;
        const value = filters.itemUse_val;
        if (filters.itemUse_op === '>=' && userItemUseCount < value) return false;
        if (filters.itemUse_op === '<=' && userItemUseCount > value) return false;
    }

    return true; // User passes all filters
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
    let finalUsersDataForPreview: { id: string; roleName: string }[] = [];

    // --- Preview Logic ---
    if (rewards.logMessage === 'Preview') {
        let userPool: User[] = [];

        if (targetUserIds && targetUserIds.length > 0) {
            const userDocs = await Promise.all(targetUserIds.map(id => getDoc(doc(db, 'users', id))));
            userPool = userDocs
                .filter(snap => snap.exists())
                .map(snap => ({ ...snap.data(), id: snap.id } as User));
        } else if (filters) {
            const usersQuery = query(collection(db, 'users'), where('approved', '==', true));
            const usersSnapshot = await getDocs(usersQuery);
            userPool = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        }
        
        finalUsersDataForPreview = userPool
            .filter(user => applyFilters(user, filters || {}))
            .map(user => ({ id: user.id, roleName: user.roleName }));

        return {
            success: true,
            processedCount: finalUsersDataForPreview.length,
            processedUsers: finalUsersDataForPreview,
        };
    }
    
    // --- Actual Distribution Logic ---
    let finalUserIds: string[] = [];

    if (targetUserIds && targetUserIds.length > 0) {
        // If specific users are targeted, we use them directly
        finalUserIds = targetUserIds;
    } else if (filters) {
        // If filters are provided, we must fetch and filter
        const usersQuery = query(collection(db, 'users'), where('approved', '==', true));
        const usersSnapshot = await getDocs(usersQuery);
        finalUserIds = usersSnapshot.docs
            .map(doc => ({ ...doc.data(), id: doc.id } as User))
            .filter(user => applyFilters(user, filters))
            .map(user => user.id);
    }
       
    if (finalUserIds.length === 0) {
      return { success: true, processedCount: 0, processedUsers: [] };
    }
    
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
                    userUpdate.totalCurrencyEarned = increment(rewards.currency); // Also increment total
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

                if (Object.keys(userUpdate).length > 0) {
                    transaction.update(userRef, userUpdate);
                }

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
    
    return { success: true, processedCount };
  } catch (error: any) {
    console.error('Reward distribution failed:', error);
    return { success: false, error: error.message || '發放獎勵時發生未知錯誤。' };
  }
}
