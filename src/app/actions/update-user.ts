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

interface UserUpdatePayload {
    approved?: boolean;
    factionId?: string;
    raceId?: string;
    // Add other fields that can be updated by an admin here
}

export async function updateUser(userId: string, payload: UserUpdatePayload) {
  if (!userId) {
    return { error: '缺少使用者ID' };
  }

  try {
    const userRef = db.collection('users').doc(userId);
    
    // Sanitize payload to only include allowed fields
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

    if (Object.keys(updateData).length === 0) {
        return { error: '沒有提供任何更新資料' };
    }

    await userRef.update(updateData);

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update user ${userId}:`, error);
    return { error: error.message || '更新使用者失敗。' };
  }
}
