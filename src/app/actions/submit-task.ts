'use server';

import {
  getFirestore,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  runTransaction,
  collection,
  getDoc,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { TaskType } from '@/lib/types';


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

    // Fetch the task type dynamically from Firestore
    const taskTypeRef = doc(db, 'taskTypes', taskTypeId);
    const taskTypeSnap = await getDoc(taskTypeRef);

    if (!taskTypeSnap.exists()) {
      throw new Error('無效的任務類型');
    }
    const taskType = taskTypeSnap.data() as TaskType;
    
    const userRef = doc(db, 'users', userId);
    
    // We use a transaction to safely read user data and check conditions before writing.
    const userDocSnap = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error('找不到使用者資料');
      }
      if (taskType.singleSubmission && (userDoc.data().tasks || []).includes(taskTypeId)) {
        throw new Error('您已經提交過此類型的任務。');
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
      status: taskType.requiresApproval ? 'pending' : 'approved', // Set status based on task type
      factionContribution: factionContribution || null,
    });
    
    let honorToAward = taskType.honorPoints;
    let currencyToAward = taskType.currency;

    // If the task requires approval, don't award points immediately.
    // This logic can be expanded in the admin panel when approving tasks.
    if (taskType.requiresApproval) {
        honorToAward = 0;
        currencyToAward = 0;
    }


    // 2. Update user's points and currency
    const userTasks = userDocSnap.data()?.tasks || [];
    if (taskType.singleSubmission) {
        userTasks.push(taskTypeId); // For single submission tasks, we track by type ID
    } else {
        userTasks.push(newTaskRef.id); // For others, by unique submission ID
    }

    const userUpdateData: any = {
        tasks: userTasks
    };

    if (honorToAward > 0) {
        userUpdateData.honorPoints = increment(honorToAward);
    }
    if (currencyToAward > 0) {
        userUpdateData.currency = increment(currencyToAward);
    }
    
    if (taskType.titleAwarded) {
        userUpdateData.titles = [...(userDocSnap.data()?.titles || []), taskType.titleAwarded];
    }
    if (taskType.itemAwarded) {
        userUpdateData.items = [...(userDocSnap.data()?.items || []), taskType.itemAwarded];
    }

    batch.update(userRef, userUpdateData);

    // 3. Update faction score (only if not requiring approval)
    if (honorToAward > 0) {
        let factionToUpdateId = factionContribution; // For wanderers
        if (userFactionId !== 'wanderer') {
            factionToUpdateId = userFactionId; // For yelu or association
        }

        if (factionToUpdateId && factionToUpdateId !== 'none') {
          const factionRef = doc(db, 'factions', factionToUpdateId);
          batch.update(factionRef, {
            score: increment(honorToAward),
          });
        }
    }
    
    // 4. Create an activity log
    const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
    const changeDescription = taskType.requiresApproval 
        ? '任務已提交審核' 
        : `+${taskType.honorPoints} 榮譽, +${taskType.currency} 貨幣`;
        
    batch.set(activityLogRef, {
        id: activityLogRef.id,
        userId: userId,
        timestamp: serverTimestamp(),
        description: `提交任務「${taskType.name}」`,
        change: changeDescription
    });

    await batch.commit();
    
    return { success: true };
  } catch (error: any) {
    console.error('Task submission failed:', error);
    return { error: error.message || '任務提交失敗，請稍後再試。' };
  }
}
