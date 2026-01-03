'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import type { User } from '@/lib/types';

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

export async function getAllUsers(): Promise<{ users?: User[]; error?: string }> {
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
            // Convert Firestore Timestamp to a serializable format (ISO string)
            registrationDate: data.registrationDate?.toDate().toISOString() || new Date().toISOString(),
        } as User;
    });

    return { users };
  } catch (error: any) {
    console.error('Error fetching users:', error);
    // Provide a more specific error message if available
    let errorMessage = '無法獲取使用者列表。';
    if (error.code === 'permission-denied') {
        errorMessage = '權限不足，無法讀取使用者列表。請檢查您的伺服器環境憑證。';
    }
    return { error: error.message || errorMessage };
  }
}
