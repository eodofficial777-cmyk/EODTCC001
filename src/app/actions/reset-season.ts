
'use server';

import { getFirestore, doc, runTransaction, collection, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

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
      console.error('Admin sign-in failed during season reset:', error);
      throw new Error('管理員登入失敗，無法重置賽季。');
    }
  }
}

export async function resetSeason(): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdminAuth();

    const currentSeasonRef = doc(db, 'war-seasons', 'current');

    await runTransaction(db, async (transaction) => {
      // 1. Read the current season data
      const currentSeasonSnap = await transaction.get(currentSeasonRef);
      if (!currentSeasonSnap.exists()) {
        throw new Error('找不到當前賽季資料，無法執行重置。');
      }
      const currentSeasonData = currentSeasonSnap.data();

      // 2. Calculate weighted scores before archiving
      const yeluPlayerCount = currentSeasonData.yelu.activePlayers.length;
      const associationPlayerCount = currentSeasonData.association.activePlayers.length;
      const totalActivePlayers = yeluPlayerCount + associationPlayerCount;

      const yeluRawScore = currentSeasonData.yelu.rawScore || 0;
      const associationRawScore = currentSeasonData.association.rawScore || 0;

      const yeluWeight = totalActivePlayers > 0 && yeluPlayerCount > 0 ? totalActivePlayers / yeluPlayerCount : 1;
      const associationWeight = totalActivePlayers > 0 && associationPlayerCount > 0 ? totalActivePlayers / associationPlayerCount : 1;
      
      const yeluWeightedScore = Math.round(yeluRawScore * yeluWeight);
      const associationWeightedScore = Math.round(associationRawScore * associationWeight);


      // 3. Create an archive document
      const archiveId = `season-end-${new Date().toISOString()}`;
      const archiveRef = doc(db, 'war-seasons-archive', archiveId);
      
      const archiveData = {
        ...currentSeasonData,
        yelu: {
            ...currentSeasonData.yelu,
            weightedScore: yeluWeightedScore
        },
        association: {
            ...currentSeasonData.association,
            weightedScore: associationWeightedScore
        },
        archivedAt: Timestamp.now(),
        seasonId: 'current', // To know which season this was
      };
      
      transaction.set(archiveRef, archiveData);

      // 4. Reset the current season document
      const newSeasonData = {
        id: 'current',
        startDate: Timestamp.now(),
        yelu: {
          rawScore: 0,
          activePlayers: [],
        },
        association: {
          rawScore: 0,
          activePlayers: [],
        },
      };
      transaction.set(currentSeasonRef, newSeasonData);
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to reset season:', error);
    return { success: false, error: error.message || '重置賽季失敗。' };
  }
}

