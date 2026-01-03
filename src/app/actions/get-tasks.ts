'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';

// Helper to initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore();

export async function getTasks() {
  try {
    const tasksSnapshot = await db.collection('tasks').orderBy('submissionDate', 'desc').limit(10).get();
    
    if (tasksSnapshot.empty) {
      return { tasks: [] };
    }

    const tasks = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            // Firestore Timestamps need to be converted for client-side rendering
            submissionDate: data.submissionDate?.toDate().toISOString() || null,
        }
    });

    return { tasks };
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    // Even if there's an error (like the collection not existing), return an empty array
    // to prevent the client from crashing.
    if (error.code === 'PERMISSION_DENIED' || error.message.includes('not found')) {
        return { tasks: [] };
    }
    return { error: error.message || '無法獲取任務列表。' };
  }
}
