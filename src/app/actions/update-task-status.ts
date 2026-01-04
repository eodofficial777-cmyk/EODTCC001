
'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
  collection,
  FieldValue,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { Task, TaskType } from '@/lib/types';


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
      console.error('Admin sign-in failed during task update:', error);
      throw new Error('管理員登入失敗，無法更新任務狀態。');
    }
  }
}

interface UpdateTaskStatusPayload {
  taskId: string;
  status: 'approved' | 'rejected';
}

export async function updateTaskStatus(payload: UpdateTaskStatusPayload): Promise<{ success: boolean; error?: string }> {
  const { taskId, status } = payload;
  
  if (!taskId) {
    return { success: false, error: '缺少任務 ID。' };
  }

  const taskRef = doc(db, 'tasks', taskId);

  try {
    await ensureAdminAuth();

    await runTransaction(db, async (transaction) => {
      const taskSnap = await transaction.get(taskRef);

      if (!taskSnap.exists()) throw new Error('找不到指定的任務。');

      const task = taskSnap.data() as Task;
      if (task.status !== 'pending') throw new Error(`此任務的狀態已經是「${task.status}」，無法重複審核。`);
      
      const userRef = doc(db, 'users', task.userId);

      if (status === 'rejected') {
        transaction.update(taskRef, { status: 'rejected' });
        // Early return if rejected, no further processing needed.
        return;
      }
      
      // If approved, proceed with reward logic
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error(`找不到提交任務的使用者 (ID: ${task.userId})`);

      const taskTypeRef = doc(db, 'taskTypes', task.taskTypeId);
      const taskTypeSnap = await transaction.get(taskTypeRef);
      if (!taskTypeSnap.exists()) throw new Error(`找不到任務類型 (ID: ${task.taskTypeId})`);
      const taskType = taskTypeSnap.data() as TaskType;

      // Update task status
      transaction.update(taskRef, { status: 'approved' });

      // Prepare user data update
      const userUpdateData: { [key: string]: any } = {};
      if(task.currencyAwarded > 0) userUpdateData.currency = increment(task.currencyAwarded);
      if(task.honorPointsAwarded > 0) userUpdateData.honorPoints = increment(task.honorPointsAwarded);
      if (taskType.titleAwarded) {
        userUpdateData.titles = arrayUnion(taskType.titleAwarded);
      }
      if (taskType.itemAwarded) {
        userUpdateData.items = arrayUnion(taskType.itemAwarded);
      }
      transaction.update(userRef, userUpdateData);

      // Update war season score
      if (task.honorPointsAwarded > 0) {
        let factionToContributeTo = 'none';
        if (task.userFactionId === 'wanderer') {
            if (task.factionContribution && task.factionContribution !== 'none') factionToContributeTo = task.factionContribution;
        } else {
            factionToContributeTo = task.userFactionId;
        }

        if (factionToContributeTo === 'yelu' || factionToContributeTo === 'association') {
            const seasonRef = doc(db, 'war-seasons', 'current');
            const seasonUpdate: { [key: string]: FieldValue } = { [`${factionToContributeTo}.rawScore`]: increment(task.honorPointsAwarded) };
            if (task.userFactionId !== 'wanderer' && task.userId) {
                 seasonUpdate[`${factionToContributeTo}.activePlayers`] = arrayUnion(task.userId);
            }
            transaction.update(seasonRef, seasonUpdate);
        }
      }

      // Create activity log
      const activityLogRef = doc(collection(db, `users/${task.userId}/activityLogs`));
      const changeDescription = `+${task.honorPointsAwarded} 榮譽, +${task.currencyAwarded} 貨幣`;
      transaction.set(activityLogRef, {
        id: activityLogRef.id,
        userId: task.userId,
        timestamp: serverTimestamp(),
        description: `任務「${taskType.name}」審核通過`,
        change: changeDescription
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Task status update failed:', error);
    return { success: false, error: error.message || '更新任務狀態失敗。' };
  }
}
