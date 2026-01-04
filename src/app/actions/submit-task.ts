
'use server';

import {
  getFirestore,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  runTransaction,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  FieldValue,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { TaskType, Title, User } from '@/lib/types';
import { checkAndAwardTitles } from '../services/check-and-award-titles';


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
  const {
    userId,
    userName,
    userFactionId,
    taskTypeId,
    submissionUrl,
    title,
    factionContribution,
  } = payload;
  
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      const taskTypeRef = doc(db, 'taskTypes', taskTypeId);
      const seasonRef = doc(db, 'war-seasons', 'current');
      
      const duplicateUrlQuery = query(collection(db, 'tasks'), where('submissionUrl', '==', submissionUrl));
      const [userDoc, taskTypeSnap, duplicateSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(taskTypeRef),
        getDocs(duplicateUrlQuery) // This runs outside transaction but is okay for a read-check
      ]);

      if (!duplicateSnapshot.empty) {
        throw new Error('這個噗浪網址已經被提交過了。');
      }
      
      if (!userDoc.exists()) {
        throw new Error('找不到使用者資料');
      }
      
      if (!taskTypeSnap.exists()) {
        throw new Error('無效的任務類型');
      }

      const taskType = taskTypeSnap.data() as TaskType;
      const userData = userDoc.data();
      const existingTasks = userData.tasks || [];

      if (taskType.singleSubmission && existingTasks.some((t: any) => t.taskTypeId === taskTypeId)) {
          throw new Error('您已經提交過此類型的任務。');
      }
      
      const newTaskRef = doc(collection(db, 'tasks'));
      const newTaskDataForUser = { taskId: newTaskRef.id, taskTypeId: taskTypeId };

      transaction.set(newTaskRef, {
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
      
      let honorToAward = 0;
      let currencyToAward = 0;
      if (!taskType.requiresApproval) {
        honorToAward = taskType.honorPoints;
        currencyToAward = taskType.currency;
      }

      const userUpdateData: { [key: string]: any } = {
        tasks: arrayUnion(newTaskDataForUser),
      };

      if (currencyToAward > 0) userUpdateData.currency = increment(currencyToAward);
      if (honorToAward > 0) userUpdateData.honorPoints = increment(honorToAward);
      if (taskType.titleAwarded) userUpdateData.titles = arrayUnion(taskType.titleAwarded);
      if (taskType.itemAwarded) userUpdateData.items = arrayUnion(taskType.itemAwarded);

      transaction.update(userRef, userUpdateData);

      if (honorToAward > 0) {
        let factionToContributeTo = 'none';
        if (userFactionId === 'wanderer') {
            if (factionContribution && factionContribution !== 'none') factionToContributeTo = factionContribution;
        } else {
            factionToContributeTo = userFactionId;
        }

        if (factionToContributeTo === 'yelu' || factionToContributeTo === 'association') {
            const seasonUpdate: { [key: string]: FieldValue } = { [`${factionToContributeTo}.rawScore`]: increment(honorToAward) };
            // Only add non-wanderers to active players list
            if (userFactionId !== 'wanderer' && userId) {
                 seasonUpdate[`${factionToContributeTo}.activePlayers`] = arrayUnion(userId);
            }
            transaction.update(seasonRef, seasonUpdate);
        }
      }
      
      const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
      const changeDescription = taskType.requiresApproval 
        ? '任務已提交審核' 
        : `+${taskType.honorPoints} 榮譽, +${taskType.currency} 貨幣`;
        
      transaction.set(activityLogRef, {
        id: activityLogRef.id,
        userId: userId,
        timestamp: serverTimestamp(),
        description: `提交任務「${taskType.name}」`,
        change: changeDescription
      });
    });

    // --- Post-transaction Title Check ---
    const updatedUserSnap = await getDoc(userRef);
    if (updatedUserSnap.exists()) {
        const updatedUserData = updatedUserSnap.data() as User;
        const allTitlesSnap = await getDocs(collection(db, 'titles'));
        const allTitles = allTitlesSnap.docs.map(doc => doc.data() as Title);

        const newTitles = await checkAndAwardTitles(updatedUserData, allTitles);

        if (newTitles.length > 0) {
            const newTitleIds = newTitles.map(t => t.id);
            const newTitleNames = newTitles.map(t => t.name).join('、');
            
            await updateDoc(userRef, { titles: arrayUnion(...newTitleIds) });
            
            const titleLogRef = doc(collection(db, `users/${userId}/activityLogs`));
            await setDoc(titleLogRef, {
                 id: titleLogRef.id,
                 userId: userId,
                 timestamp: serverTimestamp(),
                 description: `達成了新的里程碑！`,
                 change: `獲得稱號：${newTitleNames}`
            });
        }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Task submission failed:', error);
    return { error: error.message || '任務提交失敗，請稍後再試。' };
  }
}
