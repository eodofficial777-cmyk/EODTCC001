
'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import type { TaskType } from '@/lib/types';

// Use a singleton pattern to initialize Firebase Admin
let adminApp: App;
if (!getApps().length) {
  adminApp = initializeApp({
    projectId: firebaseConfig.projectId,
  });
} else {
  adminApp = getApps()[0];
}

const db = getFirestore(adminApp);

export async function getTaskTypes(): Promise<{ taskTypes?: TaskType[]; error?: string }> {
  try {
    const snapshot = await db.collection('taskTypes').get();
    
    if (snapshot.empty) {
      return { taskTypes: [] };
    }

    const taskTypes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
        } as TaskType;
    });

    return { taskTypes };
  } catch (error: any) {
    console.error('Error fetching task types:', error);
     // Adding the specific error from the screenshot for better debugging
    if (error.message && error.message.includes('Could not refresh access token')) {
        return { error: `後端認證失敗，無法讀取任務類型： ${error.message}` };
    }
    return { error: error.message || '無法獲取任務類型列表。' };
  }
}
