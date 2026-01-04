'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  collection,
  writeBatch,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, Item, CombatEncounter } from '@/lib/types';

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

// Helper function to reset a user's equipped items in active battles
async function resetUserEquipmentInActiveBattles(userId: string) {
    const q = query(collection(db, 'combatEncounters'), where('status', 'in', ['preparing', 'active']));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);

    querySnapshot.forEach(docSnap => {
        const encounter = docSnap.data() as CombatEncounter;
        if (encounter.participants && encounter.participants[userId]) {
            const userParticipant = encounter.participants[userId];
            if (userParticipant.equippedItems && userParticipant.equippedItems.length > 0) {
                 const battleDocRef = doc(db, 'combatEncounters', docSnap.id);
                 const fieldPath = `participants.${userId}.equippedItems`;
                 batch.update(battleDocRef, { [fieldPath]: [] });
            }
        }
    });

    await batch.commit();
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
      const itemsToRemove = [baseItemId, materialItemId];
      const updatedItems = userItems.filter(id => !itemsToRemove.includes(id));
      updatedItems.push(targetItemId);

      transaction.update(userRef, {
        items: updatedItems,
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

    // 5. After successful transaction, reset equipped items in active battles
    await resetUserEquipmentInActiveBattles(userId);

    return { success: true };
  } catch (error: any) {
    console.error('Item crafting failed:', error);
    return { success: false, error: error.message || '合成失敗，請稍後再試。' };
  }
}
