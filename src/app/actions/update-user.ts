
'use server';

import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

const ADMIN_EMAIL = 'admin@eodtcc.com';
const ADMIN_PASSWORD = 'password';

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

async function ensureAdminAuth() {
  if (auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error) {
      console.error('Admin sign-in failed during user update:', error);
      throw new Error('管理員登入失敗，無法更新使用者。');
    }
  }
}

interface UserUpdatePayload {
    approved?: boolean;
    factionId?: string;
    raceId?: string;
    titles?: string[];
    // Add other fields that can be updated by an admin here
}

export async function updateUser(userId: string, payload: UserUpdatePayload, asAdmin: boolean = false) {
  if (!userId) {
    return { error: '缺少使用者ID' };
  }

  try {
    // If action is administrative, ensure admin auth.
    // Regular users can update their own data without this check.
    if (asAdmin) {
        await ensureAdminAuth();
    }
    
    const userRef = doc(db, 'users', userId);
    
    const updateData: { [key: string]: any } = {};
    if (payload.approved !== undefined) {
      updateData.approved = payload.approved;
    }
    if (payload.factionId) {
      updateData.factionId = payload.factionId;
    }
    if (payload.raceId) {
      updateData.raceId = payload.raceId;
    }
    if (payload.titles) {
        updateData.titles = payload.titles;
    }


    if (Object.keys(updateData).length === 0) {
        return { error: '沒有提供任何更新資料' };
    }

    await updateDoc(userRef, updateData);

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update user ${userId}:`, error);
    return { error: error.message || '更新使用者失敗。' };
  }
}
