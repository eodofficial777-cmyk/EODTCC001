
'use server';

import { getFirestore, collection, getDocs, orderBy, query, Timestamp, where, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { User, Task } from '@/lib/types';


// Define the shape of the archived season data
export interface ArchivedSeason {
    id: string;
    archivedAt: string;
    startDate: string;
    yelu: {
        rawScore: number;
        weightedScore?: number;
        activePlayers: string[];
        mvp?: string; // Add MVP field
    };
    association: {
        rawScore: number;
        weightedScore?: number;
        activePlayers: string[];
        mvp?: string; // Add MVP field
    };
}

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

// Helper function to ensure admin is signed in
async function ensureAdminAuth() {
  if (auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error) {
      console.error('Admin sign-in failed:', error);
      throw new Error('管理員登入失敗，無法獲取歷史資料。');
    }
  }
}

export async function getArchivedSeasons(): Promise<{ seasons?: ArchivedSeason[]; error?: string }> {
  try {
    await ensureAdminAuth();

    const archiveQuery = query(collection(db, 'war-seasons-archive'), orderBy('archivedAt', 'desc'));
    const snapshot = await getDocs(archiveQuery);

    if (snapshot.empty) {
      return { seasons: [] };
    }

    const seasons = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const seasonStartDate = data.startDate ? (data.startDate as Timestamp).toDate() : new Date(0);
      const seasonEndDate = (data.archivedAt as Timestamp).toDate();

      // Get all tasks within the season's timeframe
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('submissionDate', '>=', seasonStartDate),
        where('submissionDate', '<=', seasonEndDate),
        where('status', '==', 'approved')
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const seasonTasks = tasksSnapshot.docs.map(d => d.data() as Task);

      // Calculate contribution per user
      const contributions: { [userId: string]: { honor: number, factionId: string } } = {};
      for (const task of seasonTasks) {
          if (!contributions[task.userId]) {
              contributions[task.userId] = { honor: 0, factionId: task.userFactionId };
          }
          contributions[task.userId].honor += task.honorPointsAwarded;
      }
      
      // Find MVP for each faction
      let yeluMvp: { id: string, honor: number } | null = null;
      let associationMvp: { id: string, honor: number } | null = null;

      for (const userId in contributions) {
          const { honor, factionId } = contributions[userId];
          if (factionId === 'yelu') {
              if (!yeluMvp || honor > yeluMvp.honor) {
                  yeluMvp = { id: userId, honor };
              }
          } else if (factionId === 'association') {
              if (!associationMvp || honor > associationMvp.honor) {
                  associationMvp = { id: userId, honor };
              }
          }
      }

      return {
        ...data,
        id: doc.id,
        archivedAt: seasonEndDate.toISOString(),
        startDate: seasonStartDate.toISOString(),
        yelu: { ...data.yelu, mvp: yeluMvp?.id },
        association: { ...data.association, mvp: associationMvp?.id },
      } as ArchivedSeason;
    }));
    
    return { seasons };

  } catch (error: any) {
    console.error('Error fetching archived seasons:', error);
    return { error: error.message || '無法獲取過往月度紀錄。' };
  }
}

export async function getSeasonMvpDetails(playerIds: string[]): Promise<{ players: Record<string, string>; error?: string }> {
    if (!playerIds || playerIds.length === 0) {
        return { players: {} };
    }
    
    try {
        await ensureAdminAuth();
        const playerDocs = await Promise.all(playerIds.map(id => getDoc(doc(db, 'users', id))));
        
        const players: Record<string, string> = {};
        playerDocs.forEach(docSnap => {
            if (docSnap.exists()) {
                const user = docSnap.data() as User;
                players[docSnap.id] = user.roleName;
            }
        });
        
        return { players };
    } catch (error: any) {
        console.error('Error fetching MVP details:', error);
        return { players: {}, error: error.message || '無法獲取 MVP 玩家資料。' };
    }
}
