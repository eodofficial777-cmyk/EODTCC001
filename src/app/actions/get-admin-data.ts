
'use server';

import { getFirestore, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { User, Task, TaskType, CraftRecipe, Skill, Title, Item } from '@/lib/types';

// IMPORTANT: Use a dedicated admin service account credentials in a real production app.
// For this development environment, we will sign in as a pre-defined admin user.
const ADMIN_EMAIL = 'admin@eodtcc.com';
const ADMIN_PASSWORD = 'password'; // Use a secure password, ideally from env variables

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

// Helper function to ensure admin is signed in
async function ensureAdminAuth() {
  if (auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (error: any) {
       if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          // This is a fallback for the first run or if the admin user doesn't exist.
          // In a real app, you would have a script to create this user.
          console.log('Admin user not found, creating a new one...');
          try {
             await import('firebase/auth').then(fb_auth => fb_auth.createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD));
             await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
          } catch(creationError) {
             console.error('Failed to create admin user:', creationError);
             throw new Error('無法建立或登入管理員帳號。');
          }
       } else {
        console.error('Admin sign-in failed:', error);
        throw new Error('管理員登入失敗，無法獲取資料。');
       }
    }
  }
}

export async function getAdminData(): Promise<{ users?: User[]; taskTypes?: TaskType[]; items?: Item[], titles?: any[], craftRecipes?: CraftRecipe[], skills?: Skill[], pendingTasks?: Task[], error?: string }> {
  try {
    await ensureAdminAuth();

    // Fetch all required data
    const usersPromise = getDocs(query(collection(db, 'users'), orderBy('registrationDate', 'desc')));
    const taskTypesPromise = getDocs(collection(db, 'taskTypes'));
    const itemsPromise = getDocs(collection(db, 'items'));
    const titlesPromise = getDocs(collection(db, 'titles'));
    const craftRecipesPromise = getDocs(collection(db, 'craftRecipes'));
    const skillsPromise = getDocs(collection(db, 'skills'));
    const pendingTasksPromise = getDocs(query(collection(db, 'tasks'), where('status', '==', 'pending'), orderBy('submissionDate', 'asc')));


    const [usersSnapshot, taskTypesSnapshot, itemsSnapshot, titlesSnapshot, craftRecipesSnapshot, skillsSnapshot, pendingTasksSnapshot] = await Promise.all([usersPromise, taskTypesPromise, itemsPromise, titlesPromise, craftRecipesPromise, skillsPromise, pendingTasksPromise]);

    // Process users
    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        registrationDate: data.registrationDate?.toDate().toISOString() || new Date().toISOString(),
      } as User;
    });

    // Process task types
    const taskTypes = taskTypesSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    } as TaskType));

    // Process items
    const items = itemsSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    } as Item));

    // Process titles
    const titles = titlesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
    } as Title));
    
    // Process craft recipes
    const craftRecipes = craftRecipesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
    } as CraftRecipe));

    // Process skills
    const skills = skillsSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    } as Skill));

    // Process pending tasks
    const pendingTasks = pendingTasksSnapshot.docs.map(doc => {
       const data = doc.data();
        return {
            ...data,
            id: doc.id,
            submissionDate: data.submissionDate?.toDate().toISOString() || new Date().toISOString(),
        } as Task;
    });

    return { users, taskTypes, items, titles, craftRecipes, skills, pendingTasks };
  } catch (error: any) {
    console.error('Error fetching admin data:', error);
    let errorMessage = '無法獲取管理員資料。';
    if (error.message) {
        errorMessage = `後端認證失敗，無法讀取資料： ${error.message}`;
    }
    return { error: errorMessage };
  }
}
