
'use server';

import { getFirestore, collection, getDocs, orderBy, query, Timestamp, where, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { User } from '@/lib/types';


// Define the shape of the archived season data
export interface ArchivedSeason {
    id: string;
    archivedAt: string;
    startDate: string;
    yelu: {
        rawScore: number;
        weightedScore?: number;
        activePlayers: string[];
    };
    association: {
        rawScore: number;
        weightedScore?: number;
        activePlayers: string[];
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

    const seasons = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        archivedAt: (data.archivedAt as Timestamp).toDate().toISOString(),
        startDate: data.startDate ? (data.startDate as Timestamp).toDate().toISOString() : new Date().toISOString(),
        yelu: data.yelu || { rawScore: 0, activePlayers: [] },
        association: data.association || { rawScore: 0, activePlayers: [] },
      } as ArchivedSeason;
    });
    
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

