'use server';

import {
  getFirestore,
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

export async function getUserTasks(userId: string) {
  if (!userId) {
    return { error: '缺少使用者 ID。' };
  }

  try {
    const tasksSnapshot = await getDocs(
      query(
        collection(db, 'tasks'),
        where('userId', '==', userId),
        orderBy('submissionDate', 'desc'),
        limit(20) // You can adjust the limit
      )
    );

    if (tasksSnapshot.empty) {
      return { tasks: [] };
    }

    const tasks = tasksSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        submissionDate: data.submissionDate?.toDate().toISOString() || null,
      };
    });

    return { tasks };
  } catch (error: any) {
    console.error(`Error fetching tasks for user ${userId}:`, error);
    return { error: `無法獲取使用者任務列表：${error.message}` };
  }
}
