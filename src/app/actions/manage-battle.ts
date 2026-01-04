'use server';

import { getFirestore, doc, setDoc, serverTimestamp, collection, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { CombatEncounter, Monster } from '@/lib/types';
import { randomUUID } from 'crypto';


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
}

export async function createBattle(payload: CreateBattlePayload): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdminAuth();

    const { name, monsters } = payload;
    const now = new Date();
    const prepTimeMinutes = 30;
    const preparationEndTime = new Date(now.getTime() + prepTimeMinutes * 60000);

    const newBattleRef = doc(collection(db, 'combatEncounters'));
    
    const processedMonsters: Monster[] = monsters.map(m => ({
        ...m,
        monsterId: randomUUID(), // Assign a unique ID to each monster
        originalHp: m.hp, // Set originalHp to the initial HP
    }))

    const newBattle: CombatEncounter = {
      id: newBattleRef.id,
      name,
      status: 'preparing',
      startTime: serverTimestamp(),
      preparationEndTime: preparationEndTime,
      monsters: processedMonsters,
      turn: 0,
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
    if (!battleId) {
      throw new Error('缺少戰場 ID。');
    }
    
    const battleRef = doc(db, 'combatEncounters', battleId);
    await updateDoc(battleRef, {
      status: 'active',
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to start battle:', error);
    return { success: false, error: error.message || '開始戰場失敗。' };
  }
}
