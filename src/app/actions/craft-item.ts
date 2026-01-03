'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
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

interface CraftItemPayload {
  userId: string;
  baseItemId: string;
  materialItemId: string;
  targetItemId: string;
}

export async function craftItem(payload: CraftItemPayload): Promise<{ success: boolean; error?: string }> {
  const { userId, baseItemId, materialItemId, targetItemId } = payload;
  
  if (!userId || !baseItemId || !materialItemId || !targetItemId) {
    return { success: false, error: '缺少合成所需的所有資訊。' };
  }
  
  if (baseItemId === materialItemId) {
    return { success: false, error: '基底與材料不能是同一個物品。' };
  }

  const userRef = doc(db, 'users', userId);
  const baseItemRef = doc(db, 'items', baseItemId);
  const materialItemRef = doc(db, 'items', materialItemId);
  const targetItemRef = doc(db, 'items', targetItemId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const [userDoc, baseItemDoc, materialItemDoc, targetItemDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(baseItemRef),
        transaction.get(materialItemRef),
        transaction.get(targetItemRef),
      ]);

      if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
      if (!baseItemDoc.exists() || !materialItemDoc.exists() || !targetItemDoc.exists()) {
        throw new Error('合成所選的其中一項物品不存在。');
      }
      
      const user = userDoc.data() as User;
      const baseItem = baseItemDoc.data() as Item;
      const materialItem = materialItemDoc.data() as Item;
      const targetItem = targetItemDoc.data() as Item;

      // 1. Verify item types
      if (baseItem.itemTypeId !== 'equipment') throw new Error('基底物品必須是「裝備」。');
      if (materialItem.itemTypeId !== 'special') throw new Error('材料必須是「特殊道具」。');
      if (targetItem.itemTypeId !== 'equipment' || targetItem.isPublished) throw new Error('合成目標必須是未上架的裝備。');

      // 2. Verify player owns the items
      const userItems = user.items || [];
      if (!userItems.includes(baseItemId)) throw new Error(`您沒有「${baseItem.name}」。`);
      if (!userItems.includes(materialItemId)) throw new Error(`您沒有「${materialItem.name}」。`);

      // 3. Perform atomic update
      // IMPORTANT: arrayRemove removes ALL instances of the value. If a user has multiples, this will consume all.
      // A more complex system is needed for item stacks. For now, this assumes unique items or single consumption.
      transaction.update(userRef, {
        items: arrayRemove(baseItemId, materialItemId)
      });
      // We need to re-fetch the user doc state after the remove to add the new item,
      // to avoid race conditions within the transaction's logic.
      // The below is not ideal, but a simple workaround for array operations.
      const tempUpdatedItems = user.items.filter(id => id !== baseItemId && id !== materialItemId);
      tempUpdatedItems.push(targetItemId);

      transaction.update(userRef, {
          items: arrayUnion(targetItemId)
      });
      

      // 4. Create activity log
      const activityLogRef = doc(collection(db, `users/${userId}/activityLogs`));
      transaction.set(activityLogRef, {
        id: activityLogRef.id,
        userId: userId,
        timestamp: serverTimestamp(),
        description: `合成了裝備「${targetItem.name}」`,
        change: `消耗了 ${baseItem.name} 與 ${materialItem.name}`
      });

      return { baseItemName: baseItem.name, materialItemName: materialItem.name, targetItemName: targetItem.name };
    });

    return { success: true };
  } catch (error: any) {
    console.error('Item crafting failed:', error);
    return { success: false, error: error.message || '合成失敗，請稍後再試。' };
  }
}
