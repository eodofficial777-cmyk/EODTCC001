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

export async function getAllUsers() {
  try {
    const usersSnapshot = await db.collection('users').orderBy('registrationDate', 'desc').get();
    
    if (usersSnapshot.empty) {
      return { users: [] };
    }

    const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            // Firestore Timestamps need to be converted for client-side rendering
            registrationDate: data.registrationDate?.toDate().toISOString() || new Date().toISOString(),
        }
    });

    return { users };
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return { error: error.message || '無法獲取使用者列表。' };
  }
}
