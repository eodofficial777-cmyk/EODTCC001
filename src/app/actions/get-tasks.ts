'use server';

import {
  getFirestore,
  collection,
  getDocs,
  orderBy,
  limit,
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

export async function getTasks() {
  try {
    const tasksSnapshot = await getDocs(
      query(collection(db, 'tasks'), orderBy('submissionDate', 'desc'), limit(10))
    );

    if (tasksSnapshot.empty) {
      return { tasks: [] };
    }

    const tasks = tasksSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        // Firestore Timestamps need to be converted for client-side rendering
        submissionDate: data.submissionDate?.toDate().toISOString() || null,
      };
    });

    return { tasks };
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    // Log the full error but return a user-friendly message
    return { error: `無法獲取任務列表：${error.message}` };
  }
}
