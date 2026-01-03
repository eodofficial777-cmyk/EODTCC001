
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
import type { Task, TaskType, User } from '@/lib/types';

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

  try {
    await ensureAdminAuth();

    await runTransaction(db, async (transaction) => {
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnap = await transaction.get(taskRef);

      if (!taskSnap.exists()) {
        throw new Error('找不到指定的任務。');
      }

      const task = taskSnap.data() as Task;
      if (task.status !== 'pending') {
        throw new Error(`此任務的狀態已經是「${task.status}」，無法重複審核。`);
      }

      // Just update status if rejected
      if (status === 'rejected') {
        transaction.update(taskRef, { status: 'rejected' });
        return;
      }
      
      // --- Approval Logic ---
      
      const userRef = doc(db, 'users', task.userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error(`找不到提交任務的使用者 (ID: ${task.userId})`);
      }
      const user = userSnap.data() as User;

      const taskTypeRef = doc(db, 'taskTypes', task.taskTypeId);
      const taskTypeSnap = await transaction.get(taskTypeRef);
       if (!taskTypeSnap.exists()) {
        throw new Error(`找不到任務類型 (ID: ${task.taskTypeId})`);
      }
      const taskType = taskTypeSnap.data() as TaskType;

      // 1. Update task status
      transaction.update(taskRef, { status: 'approved' });

      // 2. Update user points, currency, and rewards
      const userUpdateData: { [key: string]: any } = {
        currency: increment(task.currencyAwarded),
        honorPoints: increment(task.honorPointsAwarded),
      };
      if (taskType.titleAwarded) {
        userUpdateData.titles = arrayUnion(taskType.titleAwarded);
      }
      if (taskType.itemAwarded) {
        userUpdateData.items = arrayUnion(taskType.itemAwarded);
      }
      transaction.update(userRef, userUpdateData);

      // 3. Update war season score if points were awarded
      if (task.honorPointsAwarded > 0) {
        let factionToContributeTo = 'none';
        if (task.userFactionId === 'wanderer') {
            if (task.factionContribution && task.factionContribution !== 'none') {
                factionToContributeTo = task.factionContribution;
            }
        } else {
            factionToContributeTo = task.userFactionId;
        }

        if (factionToContributeTo === 'yelu' || factionToContributeTo === 'association') {
            const seasonRef = doc(db, 'war-seasons', 'current');
            const seasonUpdate: { [key: string]: FieldValue } = {
                [`${factionToContributeTo}.rawScore`]: increment(task.honorPointsAwarded)
            };
            if (task.userFactionId !== 'wanderer') {
                 seasonUpdate[`${factionToContributeTo}.activePlayers`] = arrayUnion(task.userId);
            }
            transaction.update(seasonRef, seasonUpdate);
        }
      }

      // 4. Create an activity log
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
