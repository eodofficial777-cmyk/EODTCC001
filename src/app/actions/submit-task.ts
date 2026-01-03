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
  arrayUnion,
  FieldValue,
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
  factionContribution?: 'yelu' | 'association' | 'none';
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

    const taskTypeRef = doc(db, 'taskTypes', taskTypeId);
    const userRef = doc(db, 'users', userId);
    const seasonRef = doc(db, 'war-seasons', 'current');
    
    // We use a transaction to safely read user data and check conditions before writing.
    const { userDocSnap, taskType } = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error('找不到使用者資料');
      }
      
      const taskTypeSnap = await transaction.get(taskTypeRef);
      if (!taskTypeSnap.exists()) {
        throw new Error('無效的任務類型');
      }
      const taskTypeData = taskTypeSnap.data() as TaskType;

      // For single submission tasks, check if the taskTypeId is already in the user's submitted list
      if (taskTypeData.singleSubmission && (userDoc.data().tasks || []).includes(taskTypeId)) {
        throw new Error('您已經提交過此類型的任務。');
      }
      return { userDocSnap: userDoc, taskType: taskTypeData };
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
      status: taskType.requiresApproval ? 'pending' : 'approved',
      factionContribution: factionContribution || null,
    });
    
    let honorToAward = taskType.honorPoints;
    let currencyToAward = taskType.currency;

    // If the task requires approval, don't award points immediately.
    if (taskType.requiresApproval) {
        honorToAward = 0;
        currencyToAward = 0;
    }

    // 2. Update user's points and currency
    const userTasks = userDocSnap.data()?.tasks || [];
    if (taskType.singleSubmission) {
        userTasks.push(taskTypeId);
    } else {
        userTasks.push(newTaskRef.id);
    }

    // ALL players, including Wanderers, always get their personal honor points.
    const userUpdateData: { [key: string]: any } = {
        tasks: userTasks,
        currency: increment(currencyToAward),
        honorPoints: increment(honorToAward),
    };
    
    if (taskType.titleAwarded) {
        userUpdateData.titles = arrayUnion(taskType.titleAwarded);
    }
    if (taskType.itemAwarded) {
        userUpdateData.items = arrayUnion(taskType.itemAwarded);
    }

    batch.update(userRef, userUpdateData);

    // 3. Update war season score (only if not requiring approval and honor is awarded)
    if (honorToAward > 0) {
        let factionToUpdateId = userFactionId;
        const isWandererContributing = userFactionId === 'wanderer' && factionContribution && factionContribution !== 'none';

        // If the user is a wanderer and chose a faction, the score goes to their chosen faction
        if (isWandererContributing) {
            factionToUpdateId = factionContribution!;
        }

        if (factionToUpdateId === 'yelu' || factionToUpdateId === 'association') {
            const seasonUpdate: { [key: string]: FieldValue } = {
                [`${factionToUpdateId}.rawScore`]: increment(honorToAward)
            };
            // Active players are now defined as anyone contributing to the faction's score
            seasonUpdate[`${factionToUpdateId}.activePlayers`] = arrayUnion(userId);
            batch.update(seasonRef, seasonUpdate);
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
