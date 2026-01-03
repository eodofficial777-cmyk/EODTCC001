'use server';

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

interface FactionConflictData {
    id: string;
    rawScore: number;
    activePlayers: number;
    weight: number;
    weightedScore: number;
}

export interface ConflictData {
    yelu: FactionConflictData;
    association: FactionConflictData;
    totalActivePlayers: number;
}

export async function getConflictData(): Promise<{ data?: ConflictData, error?: string }> {
  try {
    // 1. Get start of the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthTimestamp = Timestamp.fromDate(startOfMonth);

    // 2. Fetch all tasks submitted this month
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('submissionDate', '>=', startOfMonthTimestamp)
    );
    const tasksSnapshot = await getDocs(tasksQuery);

    const activePlayersYelu = new Set<string>();
    const activePlayersAssociation = new Set<string>();

    tasksSnapshot.forEach(taskDoc => {
      const task = taskDoc.data();
      // Only count active players from yelu and association
      if (task.userFactionId === 'yelu') {
        activePlayersYelu.add(task.userId);
      } else if (task.userFactionId === 'association') {
        activePlayersAssociation.add(task.userId);
      }
    });

    const yeluPlayerCount = activePlayersYelu.size;
    const associationPlayerCount = activePlayersAssociation.size;
    const totalActivePlayers = yeluPlayerCount + associationPlayerCount;

    // 3. Fetch current faction scores
    const yeluDoc = await getDoc(doc(db, 'factions', 'yelu'));
    const associationDoc = await getDoc(doc(db, 'factions', 'association'));

    if (!yeluDoc.exists() || !associationDoc.exists()) {
        throw new Error("無法讀取陣營資料");
    }

    const yeluRawScore = yeluDoc.data().score || 0;
    const associationRawScore = associationDoc.data().score || 0;

    // 4. Calculate weights and weighted scores
    // Avoid division by zero
    const yeluWeight = yeluPlayerCount > 0 ? totalActivePlayers / yeluPlayerCount : 1;
    const associationWeight = associationPlayerCount > 0 ? totalActivePlayers / associationPlayerCount : 1;

    const yeluWeightedScore = yeluRawScore * yeluWeight;
    const associationWeightedScore = associationRawScore * associationWeight;
    
    const data: ConflictData = {
        yelu: {
            id: 'yelu',
            rawScore: yeluRawScore,
            activePlayers: yeluPlayerCount,
            weight: yeluWeight,
            weightedScore: yeluWeightedScore
        },
        association: {
            id: 'association',
            rawScore: associationRawScore,
            activePlayers: associationPlayerCount,
            weight: associationWeight,
            weightedScore: associationWeightedScore
        },
        totalActivePlayers: totalActivePlayers,
    }

    return { data };
  } catch (error: any) {
    console.error('Error fetching conflict data:', error);
    return { error: `無法獲取陣營對抗資料: ${error.message}` };
  }
}
