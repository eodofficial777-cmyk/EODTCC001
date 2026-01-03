'use server';

import {
  getFirestore,
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
    const seasonDocRef = doc(db, 'war-seasons', 'current');
    const seasonDocSnap = await getDoc(seasonDocRef);

    if (!seasonDocSnap.exists()) {
        throw new Error("找不到當前賽季資料。請先從管理後台植入初始資料。");
    }

    const seasonData = seasonDocSnap.data();

    const yeluPlayerCount = seasonData.yelu.activePlayers.length;
    const associationPlayerCount = seasonData.association.activePlayers.length;
    const totalActivePlayers = yeluPlayerCount + associationPlayerCount;

    const yeluRawScore = seasonData.yelu.rawScore || 0;
    const associationRawScore = seasonData.association.rawScore || 0;

    // Calculate weights and weighted scores based on the new formula
    const yeluWeight = totalActivePlayers > 0 && yeluPlayerCount > 0 ? totalActivePlayers / yeluPlayerCount : 1;
    const associationWeight = totalActivePlayers > 0 && associationPlayerCount > 0 ? totalActivePlayers / associationPlayerCount : 1;

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
