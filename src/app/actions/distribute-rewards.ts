
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
import { checkAndAwardTitles } from '../services/check-and-award-titles';

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
  combatEncounterId?: string;
  damageDealt_val?: number;
}

export interface DistributionPayload {
    targetUserIds?: string[];
    filters?: FilterCriteria;
    rewards: RewardPayload;
    isBattleEnd?: boolean;
    battleData?: CombatEncounter;
}

async function getDamageDealtInBattle(battleId: string, damageThreshold: number): Promise<string[]> {
    const logsQuery = query(
        collection(db, `combatEncounters/${battleId}/combatLogs`),
        where('type', '==', 'player_attack')
    );
    const logsSnapshot = await getDocs(logsQuery);
    
    const damageByUser: { [userName: string]: number } = {};

    logsSnapshot.docs.forEach(doc => {
        const log = doc.data() as CombatLog;
        const match = log.logData.match(/^(.*?) 對 .* 造成 (\d+) 點傷害/);
        if (match) {
            const userName = match[1];
            const damage = parseInt(match[2], 10);
            damageByUser[userName] = (damageByUser[userName] || 0) + damage;
        }
    });

    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    const allUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    const userNameToIdMap = new Map(allUsers.map(u => [u.roleName, u.id]));

    const qualifyingUserIds: string[] = [];
    for (const userName in damageByUser) {
        if (damageByUser[userName] > damageThreshold) {
            const userId = userNameToIdMap.get(userName);
            if (userId) {
                qualifyingUserIds.push(userId);
            }
        }
    }
    
    return qualifyingUserIds;
}


export async function distributeRewards(payload: DistributionPayload): Promise<{
    success: boolean;
    error?: string;
    processedCount?: number;
    processedUsers?: { id: string; roleName: string }[]
}> {
  try {
    await ensureAdminAuth();
    const { targetUserIds, filters, rewards, isBattleEnd, battleData } = payload;
    let finalUserIds: string[] = [];

    const allTitlesSnap = await getDocs(collection(db, 'titles'));
    const allTitles = allTitlesSnap.docs.map(doc => doc.data() as Title);

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
        let userPool: User[] = [];

        if (filters.combatEncounterId && filters.damageDealt_val) {
            const damageUserIds = await getDamageDealtInBattle(filters.combatEncounterId, filters.damageDealt_val);
            const userSnaps = await Promise.all(damageUserIds.map(id => getDoc(doc(db, 'users', id))));
            userPool = userSnaps.map(snap => ({ ...snap.data(), id: snap.id } as User));
        } else {
            const usersQuery = query(collection(db, 'users'), where('approved', '==', true));
            const usersSnapshot = await getDocs(usersQuery);
            userPool = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        }
      
        const filtered = userPool.filter(user => {
            if (filters.factionId && user.factionId !== filters.factionId) return false;
            if (filters.raceId && user.raceId !== filters.raceId) return false;
            if (filters.honorPoints_op === '>' && user.honorPoints <= (filters.honorPoints_val || 0)) return false;
            if (filters.honorPoints_op === '<' && user.honorPoints >= (filters.honorPoints_val || 0)) return false;
            if (filters.currency_op === '>' && user.currency <= (filters.currency_val || 0)) return false;
            if (filters.currency_op === '<' && user.currency >= (filters.currency_val || 0)) return false;
            if (filters.taskCount_op === '>' && (user.tasks || []).length <= (filters.taskCount_val || 0)) return false;
            if (filters.taskCount_op === '<' && (user.tasks || []).length >= (filters.taskCount_val || 0)) return false;
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

                const user = userSnap.data() as User;
                const userUpdate: { [key: string]: any } = {};
                let changeLog = [];

                if (rewards.honorPoints) {
                    userUpdate.honorPoints = increment(rewards.honorPoints);
                }
                if (rewards.currency) {
                    userUpdate.currency = increment(rewards.currency);
                }
                if (rewards.itemId) {
                    userUpdate.items = arrayUnion(rewards.itemId);
                    changeLog.push(`獲得道具「${itemName || rewards.itemId}」`);
                }
                if (rewards.titleId) {
                    userUpdate.titles = arrayUnion(rewards.titleId);
                    changeLog.push(`獲得稱號「${titleName || rewards.titleId}」`);
                }

                if (isBattleEnd && battleData) {
                    userUpdate.participatedBattleIds = arrayUnion(battleData.id);
                    const participant = battleData.participants?.[userId];
                    if (participant && participant.hp <= 0) {
                        userUpdate.hpZeroCount = increment(1);
                    }
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

                // Post-update: check for titles
                const updatedUserData = { ...user, ...userUpdate };
                const newTitles = await checkAndAwardTitles(updatedUserData, allTitles, { battleId: battleData?.id });

                if (newTitles.length > 0) {
                    const newTitleIds = newTitles.map(t => t.id);
                    const newTitleNames = newTitles.map(t => t.name).join('、');
                    transaction.update(userRef, { titles: arrayUnion(...newTitleIds) });
                    
                    const titleLogRef = doc(collection(db, `users/${userId}/activityLogs`));
                    transaction.set(titleLogRef, {
                         id: titleLogRef.id,
                         userId: userId,
                         timestamp: serverTimestamp(),
                         description: `達成了新的里程碑！`,
                         change: `獲得稱號：${newTitleNames}`
                    });
                }
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
