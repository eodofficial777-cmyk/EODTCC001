'use server';

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { User } from '@/lib/types';
import { FACTIONS } from '@/lib/game-data';

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

// In-memory cache for development purposes. In production, this could be a file or a cache service.
let rosterCache: {
  data: Record<string, User[]>;
  timestamp: number;
} | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function ensureAdminAuth() {
  if (auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error) {
      console.error('Admin sign-in failed during roster fetch:', error);
      throw new Error('管理員登入失敗，無法獲取名冊資料。');
    }
  }
}

export async function getRosterData(): Promise<{
  rosterByFaction?: Record<string, User[]>;
  error?: string;
  cacheTimestamp?: string;
}> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTimestamp = todayStart.getTime();

  // In this simulated version, we check if the cache timestamp is from before today.
  if (rosterCache && rosterCache.timestamp >= todayStartTimestamp) {
    return { 
        rosterByFaction: rosterCache.data,
        cacheTimestamp: new Date(rosterCache.timestamp).toLocaleString(),
    };
  }

  try {
    // await ensureAdminAuth();

    const usersQuery = query(
      collection(db, 'users'),
      where('approved', '==', true),
      orderBy('honorPoints', 'desc')
    );

    const usersSnapshot = await getDocs(usersQuery);

    const allUsers = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        registrationDate:
          data.registrationDate?.toDate().toISOString() || new Date().toISOString(),
      } as User;
    });

    const rosterByFaction: Record<string, User[]> = {};

    for (const factionId in FACTIONS) {
        rosterByFaction[factionId] = [];
    }

    allUsers.forEach(user => {
        if (rosterByFaction[user.factionId]) {
            rosterByFaction[user.factionId].push(user);
        }
    });

    // Update the cache
    rosterCache = {
      data: rosterByFaction,
      timestamp: now,
    };

    return { 
        rosterByFaction,
        cacheTimestamp: new Date(now).toLocaleString(),
    };
  } catch (error: any) {
    console.error('Error fetching roster data:', error);
    return { error: `無法獲取名冊資料：${error.message}` };
  }
}
