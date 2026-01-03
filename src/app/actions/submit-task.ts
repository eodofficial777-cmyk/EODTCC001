'use server';

import {
  getFirestore,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  runTransaction,
  collection
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { TASK_TYPES } from '@/lib/game-data';

// Helper to initialize Firebase (client SDK)
// This should be outside the action function to be initialized only once per server instance.
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

interface SubmitTaskPayload {
  userId: string;
  userName: string;
  userFactionId: string;
  taskTypeId: string;
  submissionUrl: string;
  title: string;
  factionContribution?: string;
}

export async function submitTask(payload: SubmitTaskPayload) {
  try {
    const {
      userId,
      userName,
      userFactionId,
      taskTypeId,
      submissionUrl,
      title,
      factionContribution,
    } = payload;

    const taskType = TASK_TYPES[taskTypeId as keyof typeof TASK_TYPES];
    if (!taskType) {
      throw new Error('無效的任務類型');
    }
    
    const userRef = doc(db, 'users', userId);
    
    // We are not using a transaction here as we are now using client-side SDK in a server action
    // which has limitations with complex transactions and auth state.
    // We will perform batched writes instead.

    const userDocSnap = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error('找不到使用者資料');
      }
      if (taskTypeId === 'main' && userDoc.data().submittedMainQuest) {
        throw new Error('您已經提交過主線任務');
      }
      return userDoc;
    });


    const batch = writeBatch(db);

    // 1. Create new task document
    const newTaskRef = doc(collection(db, 'tasks'));
    batch.set(newTaskRef, {
      id: newTaskRef.id,
      userId,
      userName,
      userFactionId,
      taskTypeId,
      title,
      submissionUrl,
      honorPointsAwarded: taskType.honorPoints,
      currencyAwarded: taskType.currency,
      submissionDate: serverTimestamp(),
      status: 'approved', // Auto-approved for now
      factionContribution: factionContribution || null,
    });

    // 2. Update user's points and currency
    const userUpdateData: any = {
        honorPoints: increment(taskType.honorPoints),
        currency: increment(taskType.currency),
        tasks: [...(userDocSnap.data()?.tasks || []), newTaskRef.id]
    };
    
    if (taskTypeId === 'main') {
        userUpdateData.submittedMainQuest = true;
    }
    if (taskType.titleAwarded) {
        userUpdateData.titles = [...(userDocSnap.data()?.titles || []), taskType.titleAwarded];
    }
    if (taskType.itemAwarded) {
        userUpdateData.items = [...(userDocSnap.data()?.items || []), taskType.itemAwarded];
    }

    batch.update(userRef, userUpdateData);

    // 3. Update faction score
    let factionToUpdateId = factionContribution; // For wanderers
    if (userFactionId !== 'wanderer') {
        factionToUpdateId = userFactionId; // For yelu or association
    }

    if (factionToUpdateId && factionToUpdateId !== 'none') {
      const factionRef = doc(db, 'factions', factionToUpdateId);
      batch.update(factionRef, {
        score: increment(taskType.honorPoints),
      });
    }
    
    // 4. Create an activity log
    const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
    batch.set(activityLogRef, {
        id: activityLogRef.id,
        userId: userId,
        timestamp: serverTimestamp(),
        description: `提交任務「${taskType.name}」`,
        change: `+${taskType.honorPoints} 榮譽, +${taskType.currency} 貨幣`
    });

    await batch.commit();
    
    return { success: true };
  } catch (error: any) {
    console.error('Task submission failed:', error);
    return { error: error.message || '任務提交失敗，請稍後再試。' };
  }
}
