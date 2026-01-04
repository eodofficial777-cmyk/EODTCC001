'use server';

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { CraftRecipe } from '@/lib/types';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

export async function getCraftRecipes(): Promise<{ recipes?: CraftRecipe[], error?: string }> {
  try {
    const q = query(
      collection(db, 'craftRecipes'),
      where('isPublished', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { recipes: [] };
    }

    const recipes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CraftRecipe));
    
    return { recipes };

  } catch (error: any) {
    console.error('Error fetching craft recipes:', error);
    return { error: '無法獲取合成配方列表' };
  }
}
