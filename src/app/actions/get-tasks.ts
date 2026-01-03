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
        limit(50) // Increase limit for filtering
    ];

    if (filters.category) {
        constraints.push(where('taskTypeId', 'in', await getTaskTypeIdsForCategory(filters.category)));
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

// Helper to get task type IDs for a given category
async function getTaskTypeIdsForCategory(category: string): Promise<string[]> {
    if (!category) return ['']; // Firestore 'in' query cannot have an empty array
    
    const q = query(collection(db, 'taskTypes'), where('category', '==', category));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return [''];
    
    return snapshot.docs.map(doc => doc.id);
}
