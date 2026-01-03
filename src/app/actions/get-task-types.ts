
'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import type { TaskType } from '@/lib/types';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore();

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
    return { error: error.message || '無法獲取任務類型列表。' };
  }
}

    