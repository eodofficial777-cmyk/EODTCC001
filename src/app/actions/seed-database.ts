'use server';

import { getFirestore, writeBatch } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import { FACTIONS, RACES, TASK_TYPES } from '@/lib/game-data';

// Helper to initialize Firebase Admin SDK
// This should be outside the action function to be initialized only once per server instance.
if (!getApps().length) {
  initializeApp({
    // Use projectId from the client-side config
    // You might need to set up service account credentials in your environment
    // for this to work in a real deployed environment.
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore();

export async function seedDatabase() {
  try {
    const batch = writeBatch(db);

    // 1. Seed Factions
    for (const faction of Object.values(FACTIONS)) {
      const factionRef = db.collection('factions').doc(faction.id);
      batch.set(factionRef, {
        id: faction.id,
        name: faction.name,
        score: 0,
      });
    }

    // 2. Seed Races
    for (const race of Object.values(RACES)) {
      const raceRef = db.collection('races').doc(race.id);
      batch.set(raceRef, race);
    }

    // 3. Seed Task Types
    for (const taskType of Object.values(TASK_TYPES)) {
      const taskTypeRef = db.collection('taskTypes').doc(taskType.id);
      batch.set(taskTypeRef, taskType);
    }

    // 4. Seed Item Types
    const itemTypes = [
      { id: 'equipment', name: '裝備', description: '可以穿戴以增強能力的物品。' },
      { id: 'consumable', name: '戰鬥道具', description: '在戰鬥中消耗以產生效果的物品。' },
      { id: 'special', name: '特殊道具', description: '具有特殊用途或劇情價值的物品。' },
    ];
    for (const itemType of itemTypes) {
        const itemTypeRef = db.collection('itemTypes').doc(itemType.id);
        batch.set(itemTypeRef, itemType);
    }

    // 5. Seed Items
     const items = [
        { id: 'item-1', name: '回復藥水', price: 100, description: '恢復少量HP。', category: '道具', itemTypeId: 'consumable', factionId: 'yelu' },
        { id: 'item-2', name: '遠古之劍', price: 5000, description: '一把鋒利的舊時代武器。', category: '裝備', itemTypeId: 'equipment', factionId: 'yelu' },
        { id: 'item-3', name: '神秘護符', price: 2500, description: '據說能帶來好運。', category: '飾品', itemTypeId: 'special', factionId: 'association' },
        { id: 'item-4', name: '皮製護甲', price: 1200, description: '提供基礎的防護。', category: '裝備', itemTypeId: 'equipment', factionId: 'association' },
    ];
    for (const item of items) {
      const itemRef = db.collection('items').doc(item.id);
      batch.set(itemRef, {
        id: item.id,
        name: item.name,
        description: item.description,
        itemTypeId: item.itemTypeId,
        price: item.price,
        factionId: item.factionId,
      });
    }

    // 6. Seed Titles
    const titles = [
        { id: 'title-1', name: '初入荒漠', description: '完成新手教學', isHidden: false },
        { id: 'title-2', name: '夜鷺之友', description: '完成夜鷺陣營任務', isHidden: false },
        { id: 'title-3', name: '協會之星', description: '完成協會陣營任務', isHidden: false },
        { id: 'title-4', name: '荒漠英雄', description: '完成主線劇情', isHidden: true },
    ];
    for (const title of titles) {
        const titleRef = db.collection('titles').doc(title.id);
        batch.set(titleRef, title);
    }


    // Create an empty tasks collection by adding and immediately deleting a document
    // This ensures the collection exists for list queries.
    const tempTaskRef = db.collection('tasks').doc('init');
    batch.set(tempTaskRef, { initialized: true });
    batch.delete(tempTaskRef);


    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Database seeding failed:', error);
    return { error: error.message || '資料庫植入失敗。' };
  }
}
