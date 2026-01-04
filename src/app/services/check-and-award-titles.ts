
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { User, Title, CombatLog } from '@/lib/types';
import { getFirestore } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

// Helper function to get logs for a specific battle
async function getBattleLogs(battleId: string): Promise<CombatLog[]> {
    const logsQuery = query(collection(db, `combatEncounters/${battleId}/combatLogs`));
    const logsSnapshot = await getDocs(logsQuery);
    return logsSnapshot.docs.map(doc => doc.data() as CombatLog);
}

/**
 * Checks a user's data against all automatic titles and returns any newly awarded titles.
 * @param user The user data object.
 * @param allTitles An array of all available title objects.
 * @param context Optional context, e.g., current battle ID.
 * @returns An array of newly awarded title objects.
 */
export async function checkAndAwardTitles(
  user: User,
  allTitles: Title[],
  context?: { battleId?: string, itemId?: string, damageDealt?: number }
): Promise<Title[]> {
  const awardedTitles: Title[] = [];
  const ownedTitleIds = new Set(user.titles || []);

  const potentialTitles = allTitles.filter(
    (title) => !title.isManual && !ownedTitleIds.has(title.id) && title.trigger
  );

  for (const title of potentialTitles) {
    if (!title.trigger) continue;

    let isAwarded = false;
    const trigger = title.trigger;

    switch (trigger.type) {
      case 'honor_points':
        if (user.honorPoints >= trigger.value) {
          isAwarded = true;
        }
        break;
      case 'currency':
        if (user.currency >= trigger.value) {
          isAwarded = true;
        }
        break;
      case 'tasks_submitted':
        if ((user.tasks || []).length >= trigger.value) {
          isAwarded = true;
        }
        break;
      case 'battles_participated':
        if ((user.participatedBattleIds || []).length >= trigger.value) {
          isAwarded = true;
        }
        break;
      case 'battles_hp_zero':
        if ((user.hpZeroCount || 0) >= trigger.value) {
          isAwarded = true;
        }
        break;
      case 'item_used':
        if (trigger.itemId && (user.itemUseCount?.[trigger.itemId] || 0) >= trigger.value) {
          isAwarded = true;
        }
        break;
      case 'item_damage':
        if (context?.battleId && trigger.itemId) {
            const logs = await getBattleLogs(context.battleId);
            const relevantLogs = logs.filter(
                log => log.type === 'item_used' && 
                       log.itemId === trigger.itemId &&
                       (log.damage || 0) >= (trigger.damageThreshold || 0)
            );
            if (relevantLogs.length >= trigger.value) {
                isAwarded = true;
            }
        }
        break;
    }

    if (isAwarded) {
      awardedTitles.push(title);
    }
  }

  return awardedTitles;
}
