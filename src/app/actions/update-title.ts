
'use server';

import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { Title } from '@/lib/types';

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
      console.error('Admin sign-in failed during title update:', error);
      throw new Error('管理員登入失敗，無法更新稱號。');
    }
  }
}

export async function updateTitle(payload: Partial<Title> & { _delete?: boolean }): Promise<{ success?: boolean; error?: string }> {
  const { id, _delete, ...data } = payload;
  
  if (!id) {
    return { error: '缺少稱號 ID' };
  }

  try {
    await ensureAdminAuth();
    const docRef = doc(db, 'titles', id);
    
    if (_delete) {
        await deleteDoc(docRef);
        return { success: true };
    }
    
    // If it's a manual title, remove the trigger field.
    if (data.isManual) {
        delete data.trigger;
    }


    await setDoc(docRef, data, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update title ${id}:`, error);
    return { error: error.message || '更新稱號失敗。' };
  }
}
