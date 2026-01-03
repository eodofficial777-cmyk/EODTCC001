'use server';

import { getFirestore, doc, setDoc } from 'firebase/firestore';
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
      console.error('Admin sign-in failed during maintenance status update:', error);
      throw new Error('管理員登入失敗，無法更新維護狀態。');
    }
  }
}

export async function updateMaintenanceStatus(isMaintenance: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdminAuth();

    const maintenanceRef = doc(db, 'globals', 'maintenance');
    await setDoc(maintenanceRef, { isMaintenance });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update maintenance status:', error);
    return { success: false, error: error.message || '更新維護狀態失敗。' };
  }
}
