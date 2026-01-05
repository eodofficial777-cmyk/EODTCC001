
'use server';

import { getDatabase, ref, get, remove } from 'firebase/database';
import { getFirestore, writeBatch, collection, doc, serverTimestamp } from 'firebase/firestore';
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
const rtdb = getDatabase(app);
const auth = getAuth(app);


async function ensureAdminAuth() {
  if (auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error) {
      console.error('Admin sign-in failed during log archival:', error);
      throw new Error('管理員登入失敗，無法封存日誌。');
    }
  }
}

interface ArchiveResult {
    success: boolean;
    message?: string;
    error?: string;
    archivedCount?: number;
    damageStats?: any;
}

export async function archiveAndProcessBattleLogs(battleId: string): Promise<ArchiveResult> {
  try {
    await ensureAdminAuth();
    if (!battleId) {
      throw new Error('缺少戰場 ID。');
    }

    const rtdbRef = ref(rtdb, `battle_buffer/${battleId}`);
    const snapshot = await get(rtdbRef);

    if (!snapshot.exists()) {
      return { success: true, message: 'RTDB 緩衝區中沒有待處理的日誌。', archivedCount: 0 };
    }

    const logsData = snapshot.val();
    const batch = writeBatch(db);
    let archivedCount = 0;
    
    // Process logs for damage stats
    const damageByUser: { [userId: string]: { damage: number, faction: string, roleName: string } } = {};

    for (const key in logsData) {
      const log = logsData[key] as CombatLog;
      
      // Archive log to Firestore
      const firestoreLogRef = doc(collection(db, 'combatEncounters', battleId, 'combatLogs'));
      batch.set(firestoreLogRef, {
        ...log,
        id: firestoreLogRef.id,
        timestamp: serverTimestamp(), // Use server timestamp for consistency
      });
      archivedCount++;
      
      // Calculate damage for stats from the data just read from RTDB
      if (log.userId && log.damage && log.damage > 0) {
        if (!damageByUser[log.userId]) {
            // This is the first time we see this user, we might not know their roleName yet.
            // We'll fill it later if possible, or just use ID.
            damageByUser[log.userId] = { damage: 0, faction: log.userFaction, roleName: 'Unknown' };
        }
        damageByUser[log.userId].damage += log.damage;
      }
    }

    await batch.commit();

    // After successful commit to Firestore, clear the RTDB buffer
    await remove(rtdbRef);

    const damageStats = Object.entries(damageByUser).map(([userId, data]) => ({
      userId,
      ...data,
    })).sort((a, b) => b.damage - a.damage);


    return { 
        success: true, 
        message: `成功封存 ${archivedCount} 條日誌，並已結算傷害統計。`,
        archivedCount,
        damageStats
    };

  } catch (error: any) {
    console.error(`Failed to archive logs for battle ${battleId}:`, error);
    return { success: false, error: error.message || '封存戰鬥日誌時發生未知錯誤。' };
  }
}
