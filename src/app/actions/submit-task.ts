
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
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { TaskType, Title } from '@/lib/types';
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
    
    const allTitlesSnap = await getDocs(collection(db, 'titles'));
    const allTitles = allTitlesSnap.docs.map(doc => doc.data() as Title);

    await runTransaction(db, async (transaction) => {
      const duplicateUrlQuery = query(collection(db, 'tasks'), where('submissionUrl', '==', submissionUrl));
      const duplicateSnapshot = await getDocs(duplicateUrlQuery);
      if (!duplicateSnapshot.empty) {
        throw new Error('這個噗浪網址已經被提交過了。');
      }
      
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error('找不到使用者資料');
      }
      
      const taskTypeSnap = await transaction.get(taskTypeRef);
      if (!taskTypeSnap.exists()) {
        throw new Error('無效的任務類型');
      }
      const taskType = taskTypeSnap.data() as TaskType;
      const userData = userDoc.data();

      if (taskType.singleSubmission && (userData.tasks || []).includes(taskTypeId)) {
        throw new Error('您已經提交過此類型的任務。');
      }
      
      const newTaskRef = doc(collection(db, 'tasks'));
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
      
      let honorToAward = taskType.honorPoints;
      let currencyToAward = taskType.currency;
      if (taskType.requiresApproval) {
        honorToAward = 0;
        currencyToAward = 0;
      }

      const userTasks = userData.tasks || [];
      if (taskType.singleSubmission) {
        userTasks.push(taskTypeId);
      } else {
        userTasks.push(newTaskRef.id);
      }

      const userUpdateData: { [key: string]: any } = {
        tasks: userTasks,
      };
      if (currencyToAward > 0) userUpdateData.currency = increment(currencyToAward);
      if (honorToAward > 0) userUpdateData.honorPoints = increment(honorToAward);
      if (taskType.titleAwarded) {
        userUpdateData.titles = arrayUnion(taskType.titleAwarded);
      }
      if (taskType.itemAwarded) {
        userUpdateData.items = arrayUnion(taskType.itemAwarded);
      }

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
            if (userFactionId !== 'wanderer') {
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

      // Post-update: check for titles
      const updatedUserData = { ...userData, ...userUpdateData };
      updatedUserData.tasks = userTasks; // Manually update tasks array for check
      const newTitles = await checkAndAwardTitles(updatedUserData, allTitles);

      if (newTitles.length > 0) {
          const newTitleIds = newTitles.map(t => t.id);
          const newTitleNames = newTitles.map(t => t.name).join('、');
          transaction.update(userRef, { titles: arrayUnion(...newTitleIds) });
          
          const titleLogRef = doc(collection(db, `users/${userId}/activityLogs`));
          transaction.set(titleLogRef, {
               id: titleLogRef.id,
               userId: userId,
               timestamp: serverTimestamp(),
               description: `達成了新的里程碑！`,
               change: `獲得稱號：${newTitleNames}`
          });
      }
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Task submission failed:', error);
    return { error: error.message || '任務提交失敗，請稍後再試。' };
  }
}
