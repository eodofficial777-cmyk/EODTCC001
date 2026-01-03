
'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './get-all-users'; // Import the initialized adminApp
import type { TaskType } from '@/lib/types';

// No longer initialize here, use the imported instance
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
