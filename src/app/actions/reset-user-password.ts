'use server';

const admin = require('firebase-admin');
import { firebaseConfig } from '@/firebase/config';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, getApps, App } from 'firebase/app';


// Initialize Admin SDK only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

// Client SDK for admin user authentication, if needed for other admin tasks
let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const clientAuth = getAuth(app);
const ADMIN_EMAIL = 'admin@eodtcc.com';
const ADMIN_PASSWORD = 'password';


// This function ensures that the *server action itself* is being called by an authenticated admin user,
// although the Admin SDK doesn't strictly need it to perform the password reset.
// It's a good practice for securing server actions.
async function ensureAdminAuth() {
  if (clientAuth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(clientAuth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error) {
      console.error('Admin sign-in failed:', error);
      throw new Error('管理員認證失敗，無法重設密碼。');
    }
  }
}

interface ResetPasswordPayload {
  userId: string;
  newPassword: string;
}

export async function resetUserPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; error?: string }> {
  const { userId, newPassword } = payload;

  if (!userId || !newPassword) {
    return { success: false, error: '缺少使用者 ID 或新密碼。' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: '新密碼長度至少需要 6 個字元。' };
  }

  try {
    // 1. Ensure the calling context is from an authenticated admin
    await ensureAdminAuth();

    // 2. Use the Admin SDK to update the user's password
    await admin.auth().updateUser(userId, {
      password: newPassword,
    });

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to reset password for user ${userId}:`, error);
    let errorMessage = '重設密碼失敗。';
    if (error.code === 'auth/user-not-found') {
        errorMessage = '找不到該使用者。'
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
