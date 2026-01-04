
'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  arrayRemove,
  collection,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, Item, AttributeEffect } from '@/lib/types';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

interface UseItemPayload {
  userId: string;
  itemId: string;
}

export async function useItem(payload: UseItemPayload): Promise<{ success: boolean; message: string; error?: string }> {
  const { userId, itemId } = payload;
  if (!userId || !itemId) {
    return { success: false, error: '缺少使用者或道具資訊。', message: '' };
  }

  const userRef = doc(db, 'users', userId);
  const itemRef = doc(db, 'items', itemId);

  try {
    const resultMessage = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const itemDoc = await transaction.get(itemRef);

      if (!userDoc.exists()) {
        throw new Error('找不到您的角色資料。');
      }
      if (!itemDoc.exists()) {
        throw new Error('找不到該道具。');
      }

      const user = userDoc.data() as User;
      const item = itemDoc.data() as Item;
      const userItems = user.items || [];

      // 1. Check if user has the item
      const itemIndexInInventory = userItems.indexOf(itemId);
      if (itemIndexInInventory === -1) {
        throw new Error(`您的背包中沒有「${item.name}」。`);
      }
      
      // 2. Check if item is a stat boost item
      if (item.itemTypeId !== 'stat_boost') {
        throw new Error(`「${item.name}」無法在此處使用。`);
      }
      
      // 3. Apply effects and remove item
      const userUpdate: { [key: string]: any } = {};
      let logChanges: string[] = [];

      item.effects.forEach(effect => {
        if ('attribute' in effect && (effect as AttributeEffect).operator === '+') {
            const attrEffect = effect as AttributeEffect;
            const key = `attributes.${attrEffect.attribute}`;
            const value = Number(attrEffect.value);
            if (!isNaN(value)) {
                 userUpdate[key] = increment(value);
                 logChanges.push(`${attrEffect.attribute.toUpperCase()} +${value}`);
            }
        }
      });
      
      if (Object.keys(userUpdate).length === 0) {
        throw new Error(`「${item.name}」沒有可用的永久提升效果。`);
      }

      // Remove one instance of the item from the user's inventory
      const newItems = [...userItems];
      newItems.splice(itemIndexInInventory, 1);
      userUpdate.items = newItems;

      transaction.update(userRef, userUpdate);

      // Create activity log
      const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
      transaction.set(activityLogRef, {
        id: activityLogRef.id,
        userId: userId,
        timestamp: serverTimestamp(),
        description: `使用了道具「${item.name}」`,
        change: logChanges.join(', '),
      });
      
      return `成功使用「${item.name}」，${logChanges.join(', ')}。`;
    });

    return { success: true, message: resultMessage };

  } catch (error: any) {
    console.error('Item usage failed:', error);
    return { success: false, error: error.message || '使用道具失敗，請稍後再試。', message: '' };
  }
}
