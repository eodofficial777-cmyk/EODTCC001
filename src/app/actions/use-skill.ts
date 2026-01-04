'use server';

import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { User, CombatEncounter, Skill, ActiveBuff } from '@/lib/types';

let app: App;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

interface UseSkillPayload {
  userId: string;
  battleId: string;
  skillId: string;
}

export interface UseSkillResult {
    success: boolean;
    error?: string;
    logMessage?: string;
}

export async function useSkill(payload: UseSkillPayload): Promise<UseSkillResult> {
  const { userId, battleId, skillId } = payload;
  if (!userId || !battleId || !skillId) {
    return { success: false, error: '缺少必要的使用技能資訊。' };
  }

  const userRef = doc(db, 'users', userId);
  const battleRef = doc(db, 'combatEncounters', battleId);
  const skillRef = doc(db, 'skills', skillId);

  try {
    const { logMessage } = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const battleDoc = await transaction.get(battleRef);
      const skillDoc = await transaction.get(skillRef);

      if (!userDoc.exists()) throw new Error('找不到您的角色資料。');
      if (!battleDoc.exists()) throw new Error('找不到指定的戰場。');
      if (!skillDoc.exists()) throw new Error('找不到指定的技能。');

      const user = userDoc.data() as User;
      const battle = battleDoc.data() as CombatEncounter;
      const skill = skillDoc.data() as Skill;
      
      if (battle.status !== 'active') throw new Error('戰場目前不是戰鬥狀態。');
      
      const participantData = battle.participants?.[userId];
      if (!participantData) throw new Error('您尚未加入這場戰鬥。');
      if (participantData.hp <= 0) throw new Error('您的HP已歸零，無法使用技能。');
      if (participantData.skillCooldowns?.[skillId] > 0) throw new Error(`技能「${skill.name}」仍在冷卻中。`);

      // Initialize fields if they don't exist
      const activeBuffs = participantData.activeBuffs || [];
      const skillCooldowns = participantData.skillCooldowns || {};

      // Apply skill effects
      skill.effects.forEach(effect => {
          if (effect.duration) {
              const newBuff: ActiveBuff = {
                  ...effect,
                  turnsLeft: effect.duration
              };
              activeBuffs.push(newBuff);
          }
          // Handle immediate effects if any in the future
      });
      
      // Set skill cooldown
      if (skill.cooldown > 0) {
          skillCooldowns[skillId] = skill.cooldown;
      }

      // Update participant data
      transaction.update(battleRef, {
        [`participants.${userId}.activeBuffs`]: activeBuffs,
        [`participants.${userId}.skillCooldowns`]: skillCooldowns,
      });

      // Log the action
      const logMessage = `${user.roleName} 使用了技能「${skill.name}」。`;
      const battleLogRef = doc(collection(db, `combatEncounters/${battleId}/combatLogs`));
      transaction.set(battleLogRef, {
        id: battleLogRef.id,
        encounterId: battleId,
        logData: logMessage,
        timestamp: serverTimestamp(),
        turn: battle.turn,
        type: 'skill_used',
      });
      
      return { logMessage };
    });

    return { success: true, logMessage };
  } catch (error: any) {
    console.error('Skill usage failed:', error);
    return { success: false, error: error.message || '使用技能失敗，請稍後再試。' };
  }
}
