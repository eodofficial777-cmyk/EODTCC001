'use server';

import {
  getFirestore,
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  where,
  QueryConstraint,
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

export interface TaskFilter {
    category?: string;
    factionId?: string;
}

export async function getTasks(filters: TaskFilter = {}) {
  try {
    const constraints: QueryConstraint[] = [
        orderBy('submissionDate', 'desc'),
        limit(50)
    ];

    if (filters.category) {
        const taskTypeIds = await getTaskTypeIdsForCategory(filters.category);
        if (taskTypeIds.length > 0) {
            constraints.push(where('taskTypeId', 'in', taskTypeIds));
        } else {
            // If no task types match the category, return empty results immediately.
            return { tasks: [] };
        }
    }
    if (filters.factionId) {
        constraints.push(where('userFactionId', '==', filters.factionId));
    }
    
    const tasksQuery = query(collection(db, 'tasks'), ...constraints);
    const tasksSnapshot = await getDocs(tasksQuery);

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
    console.error('Error fetching tasks:', error);
    return { error: `無法獲取任務列表：${error.message}` };
  }
}

async function getTaskTypeIdsForCategory(category: string): Promise<string[]> {
    if (!category) return [];
    
    const q = query(collection(db, 'taskTypes'), where('category', '==', category));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(doc => doc.id);
}
