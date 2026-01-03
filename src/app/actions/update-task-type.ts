
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

// We add a `_delete` property to the payload to handle deletion
export async function updateTaskType(payload: TaskType & { _delete?: boolean }): Promise<{ success?: boolean; error?: string }> {
  const { id, _delete, ...data } = payload;
  
  if (!id) {
    return { error: '缺少任務類型 ID' };
  }

  try {
    const docRef = db.collection('taskTypes').doc(id);
    
    if (_delete) {
        await docRef.delete();
        return { success: true };
    }

    await docRef.set(data, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update task type ${id}:`, error);
    return { error: error.message || '更新任務類型失敗。' };
  }
}

    