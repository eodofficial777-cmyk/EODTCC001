
'use server';

import { getFirestore, doc, setDoc, serverTimestamp, collection, updateDoc, arrayUnion, getDoc, writeBatch, increment } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { CombatEncounter, Monster, EndOfBattleRewards } from '@/lib/types';
import { randomUUID } from 'crypto';
import { distributeRewards } from './distribute-rewards';


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
      console.error('Admin sign-in failed during battle management:', error);
      throw new Error('管理員登入失敗，無法管理戰場。');
    }
  }
}

interface CreateBattlePayload {
  name: string;
  monsters: Omit<Monster, 'originalHp' | 'monsterId'>[];
  rewards: EndOfBattleRewards;
}

export async function createBattle(payload: CreateBattlePayload): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdminAuth();

    const { name, monsters, rewards } = payload;
    const now = new Date();
    const prepTimeMinutes = 30;
    const preparationEndTime = new Date(now.getTime() + prepTimeMinutes * 60000);

    const newBattleRef = doc(collection(db, 'combatEncounters'));
    
    const processedMonsters: Monster[] = monsters.map(m => ({
        ...m,
        monsterId: randomUUID(),
        originalHp: m.hp,
    }));

    const newBattle: CombatEncounter = {
      id: newBattleRef.id,
      name,
      status: 'preparing',
      startTime: serverTimestamp(),
      preparationEndTime: preparationEndTime,
      monsters: processedMonsters,
      turn: 0,
      endOfBattleRewards: rewards,
    };

    await setDoc(newBattleRef, newBattle);

    return { success: true };
  } catch (error: any) {
    console.error('Failed to create battle:', error);
    return { success: false, error: error.message || '開啟戰場失敗。' };
  }
}

export async function startBattle(battleId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdminAuth();
    if (!battleId) throw new Error('缺少戰場 ID。');
    
    const battleRef = doc(db, 'combatEncounters', battleId);
    await updateDoc(battleRef, { status: 'active' });
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to start battle:', error);
    return { success: false, error: error.message || '開始戰場失敗。' };
  }
}

export async function endBattle(battleId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    await ensureAdminAuth();
    if (!battleId) throw new Error('缺少戰場 ID。');

    const battleRef = doc(db, 'combatEncounters', battleId);
    const battleSnap = await getDoc(battleRef);

    if (!battleSnap.exists()) throw new Error('找不到指定的戰場。');
    
    const battleData = battleSnap.data() as CombatEncounter;
    
    if (battleData.status === 'ended' || battleData.status === 'closed') {
      return { success: false, error: '戰場已經結束。' };
    }

    await updateDoc(battleRef, { status: 'ended', endTime: serverTimestamp() });

    // Update participant stats (participatedBattleIds, hpZeroCount)
    const participants = Object.keys(battleData.participants || {});
    if (participants.length > 0) {
        const batch = writeBatch(db);
        participants.forEach(userId => {
            const userRef = doc(db, 'users', userId);
            const participantData = battleData.participants?.[userId];
            const updates: { [key: string]: any } = {
                participatedBattleIds: arrayUnion(battleId)
            };
            if (participantData && participantData.hp <= 0) {
                updates.hpZeroCount = increment(1);
            }
            batch.update(userRef, updates);
        });
        await batch.commit();
    }


    const rewards = battleData.endOfBattleRewards;

    if (rewards && participants.length > 0) {
      const distributionResult = await distributeRewards({
        targetUserIds: participants,
        rewards: {
          honorPoints: rewards.honorPoints,
          currency: rewards.currency,
          itemId: rewards.itemId,
          titleId: rewards.titleId,
          logMessage: rewards.logMessage || `參與戰役「${battleData.name}」獎勵`,
        },
      });
      if (distributionResult.error) {
        throw new Error(`戰場已結束，但獎勵發放失敗：${distributionResult.error}`);
      }
      return { success: true, message: `戰場已結束，並已向 ${distributionResult.processedCount} 位玩家發放獎勵。` };
    }

    return { success: true, message: '戰場已結束，沒有設定獎勵或無人參與。' };
  } catch (error: any) {
    console.error('Failed to end battle:', error);
    return { success: false, error: error.message || '結束戰場失敗。' };
  }
}

export async function addMonsterToBattle(battleId: string, monsterData: Omit<Monster, 'originalHp' | 'monsterId'>): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureAdminAuth();
        if (!battleId) throw new Error('缺少戰場 ID。');
        if (!monsterData) throw new Error('缺少災獸資料。');

        const battleRef = doc(db, 'combatEncounters', battleId);
        
        const newMonster: Monster = {
            ...monsterData,
            monsterId: randomUUID(),
            originalHp: monsterData.hp,
        };

        await updateDoc(battleRef, {
            monsters: arrayUnion(newMonster)
        });

        return { success: true };
    } catch (error: any) {
        console.error('Failed to add monster to battle:', error);
        return { success: false, error: error.message || '增加災獸失敗。' };
    }
}

    
