
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
  honorPoints_val?: number;
  currency_val?: number;
  taskCount_val?: number;
  participatedBattleCount_val?: number;
  hpZeroCount_val?: number;
  itemUse_id?: string;
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
    if (typeof filters.honorPoints_val === 'number' && user.honorPoints < filters.honorPoints_val) return false;

    // Total Currency Earned filter
    if (typeof filters.currency_val === 'number' && (user.totalCurrencyEarned || 0) < filters.currency_val) return false;
    
    // Task Count filter
    if (typeof filters.taskCount_val === 'number' && (user.tasks || []).length < filters.taskCount_val) return false;

    // Battle Participation filter
    if (typeof filters.participatedBattleCount_val === 'number' && (user.participatedBattleIds || []).length < filters.participatedBattleCount_val) return false;

    // HP Zero Count filter
    if (typeof filters.hpZeroCount_val === 'number' && (user.hpZeroCount || 0) < filters.hpZeroCount_val) return false;

    // Item Use filter
    if (filters.itemUse_id && typeof filters.itemUse_val === 'number') {
        const userItemUseCount = user.itemUseCount?.[filters.itemUse_id] || 0;
        if (userItemUseCount < filters.itemUse_val) return false;
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
            .filter(user => applyFilters(user, filters || {}))
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

                const user = userSnap.data() as User;
                const updates: { [key: string]: any } = {};
                let changeLog = [];

                // --- MANUALLY CALCULATE AND UPDATE ---
                // This approach avoids mixing increment() with array updates in the same transaction.
                
                // Handle numeric values
                if (rewards.honorPoints) {
                    updates.honorPoints = (user.honorPoints || 0) + rewards.honorPoints;
                    changeLog.push(`+${rewards.honorPoints} 榮譽點`);
                }
                if (rewards.currency) {
                    updates.currency = (user.currency || 0) + rewards.currency;
                    updates.totalCurrencyEarned = (user.totalCurrencyEarned || 0) + rewards.currency;
                    changeLog.push(`+${rewards.currency} 貨幣`);
                }

                // Handle item array (stacking)
                if (rewards.itemId) {
                    const newItems = [...(user.items || [])];
                    newItems.push(rewards.itemId);
                    updates.items = newItems;
                    changeLog.push(`獲得道具「${itemName || rewards.itemId}」`);
                }

                // Handle title array (unique)
                if (rewards.titleId) {
                    const newTitles = [...(user.titles || [])];
                    if (!newTitles.includes(rewards.titleId)) {
                        newTitles.push(rewards.titleId);
                        updates.titles = newTitles;
                        changeLog.push(`獲得稱號「${titleName || rewards.titleId}」`);
                    }
                }
                
                // --- Perform a SINGLE update operation ---
                if (Object.keys(updates).length > 0) {
                    transaction.update(userRef, updates);
                }
                
                // --- Create Activity Log ---
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
