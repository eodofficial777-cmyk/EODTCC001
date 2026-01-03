'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  writeBatch,
  collection,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, Item } from '@/lib/types';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

interface BuyItemPayload {
  userId: string;
  itemId: string;
}

export async function buyItem(payload: BuyItemPayload): Promise<{ success: boolean; error?: string }> {
  const { userId, itemId } = payload;
  if (!userId || !itemId) {
    return { success: false, error: '缺少使用者或道具資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const itemRef = doc(db, 'items', itemId);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const itemDoc = await transaction.get(itemRef);

      if (!userDoc.exists()) {
        throw new Error('找不到您的角色資料。');
      }
      if (!itemDoc.exists()) {
        throw new Error('找不到該道具，可能已被下架。');
      }

      const user = userDoc.data() as User;
      const item = itemDoc.data() as Item;

      // 1. Check if user can afford the item
      if (user.currency < item.price) {
        throw new Error('您的貨幣不足。');
      }

      // 2. Check race requirement
      if (item.raceId !== 'all' && user.raceId !== item.raceId) {
        throw new Error('您的種族不符合裝備此道具的條件。');
      }
      
      // 3. Check faction requirement
      if (item.factionId !== 'wanderer' && user.factionId !== item.factionId) {
         throw new Error('您的陣營無法購買此道具。');
      }


      // All checks passed, perform the updates
      const newCurrency = user.currency - item.price;
      
      transaction.update(userRef, {
        currency: newCurrency,
        items: arrayUnion(itemId),
      });
      
      // Create an activity log entry (not part of the transaction to avoid contention, but will be committed with it)
       const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
       transaction.set(activityLogRef, {
            id: activityLogRef.id,
            userId: userId,
            timestamp: serverTimestamp(),
            description: `購買了道具「${item.name}」`,
            change: `-${item.price} 貨幣`
       });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Item purchase failed:', error);
    return { success: false, error: error.message || '購買失敗，請稍後再試。' };
  }
}
