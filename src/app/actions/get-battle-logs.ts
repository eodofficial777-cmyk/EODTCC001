
'use server';

import {
  getFirestore,
  collection,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { CombatLog } from '@/lib/types';

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
      console.error('Admin sign-in failed:', error);
      throw new Error('管理員登入失敗，無法獲取戰鬥紀錄。');
    }
  }
}

export async function getBattleLogs(
  battleId: string
): Promise<{ logs?: CombatLog[]; error?: string }> {
  try {
    await ensureAdminAuth();

    if (!battleId) {
      throw new Error('缺少戰場 ID。');
    }

    const logsQuery = query(
      collection(db, `combatEncounters/${battleId}/combatLogs`),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(logsQuery);

    if (snapshot.empty) {
      return { logs: [] };
    }

    const logs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString(),
      } as CombatLog;
    });

    return { logs };
  } catch (error: any) {
    console.error(`Error fetching logs for battle ${battleId}:`, error);
    return { error: error.message || '無法獲取戰鬥紀錄。' };
  }
}
