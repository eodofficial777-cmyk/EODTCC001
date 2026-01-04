
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
import { firebaseConfig } from '@/firebase/config';
import type { User } from '@/lib/types';
import { FACTIONS } from '@/lib/game-data';

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

// In-memory cache for development purposes. In production, this could be a file or a cache service.
let rosterCache: {
  data: {
    allUsers: User[];
    rosterByFaction: Record<string, User[]>;
  };
  timestamp: number;
} | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getRosterData(): Promise<{
  allUsers?: User[];
  rosterByFaction?: Record<string, User[]>;
  error?: string;
}> {
  const now = Date.now();
  
  if (rosterCache && now - rosterCache.timestamp < CACHE_DURATION) {
    return {
      allUsers: rosterCache.data.allUsers,
      rosterByFaction: rosterCache.data.rosterByFaction,
    };
  }

  try {
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
          data.registrationDate?.toDate().toISOString() ||
          new Date().toISOString(),
      } as User;
    });

    const rosterByFaction: Record<string, User[]> = {};
    for (const factionId in FACTIONS) {
      rosterByFaction[factionId] = [];
    }

    allUsers.forEach((user) => {
      if (rosterByFaction[user.factionId]) {
        rosterByFaction[user.factionId].push(user);
      }
    });

    // Update the cache
    rosterCache = {
      data: { allUsers, rosterByFaction },
      timestamp: now,
    };

    return {
      allUsers,
      rosterByFaction,
    };
  } catch (error: any) {
    console.error('Error fetching roster data:', error);
    return { error: `無法獲取名冊資料：${error.message}` };
  }
}
