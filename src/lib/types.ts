
export interface User {
  id: string;
  roleName: string;
  plurkInfo: string;
  characterSheetUrl: string;
  avatarUrl: string;
  registrationDate: string;
  approved: boolean;
  factionId: string;
  raceId: string;
  honorPoints: number;
  currency: number;
  totalCurrencyEarned?: number;
  titles: string[];
  equipment: string[];
  items: string[];
  tasks: { taskId: string, taskTypeId: string }[];
  submittedMainQuest: boolean;
  attributes: {
    hp: number;
    atk: number;
    def: number;
  };
  participatedBattleIds?: string[];
  hpZeroCount?: number;
  itemUseCount?: { [itemId: string]: number };
  isAdmin?: boolean;
}

export interface Task {
  id: string;
  userId: string;
  userName: string;
  userFactionId: string;
  taskTypeId: string;
  title: string;
  submissionUrl: string;
  honorPointsAwarded: number;
  currencyAwarded: number;
  submissionDate: string;
  status: 'pending' | 'approved' | 'rejected';
  factionContribution?: string;
}

export interface TaskType {
  id: string;
  name: string;
  category: string;
  description: string;
  honorPoints: number;
  currency: number;
  titleAwarded?: string;
  itemAwarded?: string;
  requiresApproval?: boolean;
  singleSubmission?: boolean;
}

export type AttributeEffect = {
  attribute: 'hp' | 'atk' | 'def';
  operator: '+' | '*' | 'd'; 
  value: number | string;
};

export type TriggeredEffectType = 'hp_recovery' | 'damage_enemy' | 'atk_buff' | 'def_buff' | 'hp_cost';

export type TriggeredEffect = {
  trigger: 'on_use';
  probability: number; // 0-100
  effectType: TriggeredEffectType;
  value: number;
  duration?: number; // in turns
};

export interface Item {
    id: string;
    name: string;
    description: string;
    effects: Array<AttributeEffect | TriggeredEffect>;
    imageUrl: string;
    price: number;
    itemTypeId: 'equipment' | 'consumable' | 'special' | 'stat_boost';
    factionId: string;
    raceId: string;
    isPublished: boolean;
    isUsable?: boolean; // New field for special items
}

export interface CraftRecipe {
    id: string;
    baseItemId: string;
    materialItemId: string;
    resultItemId: string;
    isPublished: boolean;
}

export interface ActivityLog {
  id: string;
  userId: string;
  timestamp: any; // Usually Firestore.Timestamp
  description: string;
  change: string;
}

export type SkillEffectType = 'hp_recovery' | 'direct_damage' | 'atk_buff' | 'def_buff' | 'hp_cost' | 'probabilistic_damage';

export type SkillEffect = {
    effectType: SkillEffectType;
    value?: number | string;
    probability?: number;
    duration?: number;
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    cooldown: number;
    factionId?: string;
    raceId?: string;
    effects: SkillEffect[];
}

export type TitleTriggerType = 'honor_points' | 'currency' | 'tasks_submitted' | 'battles_participated' | 'battles_hp_zero' | 'item_used' | 'item_damage';

export type TitleTrigger = {
  type: TitleTriggerType;
  value: number;
  itemId?: string; // For item-related triggers
  damageThreshold?: number; // For item_damage trigger
};


export interface Title {
  id: string;
  name: string;
  description: string;
  isHidden: boolean;
  isManual: boolean;
  trigger?: TitleTrigger;
}

export interface MaintenanceStatus {
  isMaintenance: boolean;
}

export interface RegistrationStatus {
  isOpen: boolean;
}


export interface Monster {
    monsterId: string;
    name: string;
    factionId: 'yelu' | 'association' | 'common';
    imageUrl: string;
    hp: number;
    originalHp: number;
    atk: string; // e.g. "20+1D10"
}

export interface ActiveBuff extends SkillEffect, TriggeredEffect {
    turnsLeft: number;
}

export interface Participant {
    hp: number;
    roleName: string;
    factionId: string;
    equippedItems?: string[];
    supportedFaction?: 'yelu' | 'association';
    activeBuffs?: ActiveBuff[];
    skillCooldowns?: { [skillId: string]: number };
}

export interface EndOfBattleRewards {
  honorPoints?: number;
  currency?: number;
  itemId?: string;
  titleId?: string;
  logMessage?: string;
}

export interface CombatEncounter {
    id: string;
    name: string;
    status: 'preparing' | 'active' | 'ended' | 'closed';
    startTime: any; // serverTimestamp
    preparationEndTime: any; // Date
    endTime?: any; // Date
    monsters: Monster[];
    turn: number;
    participants?: {
        [userId: string]: Participant;
    }
    endOfBattleRewards?: EndOfBattleRewards;
}

export interface CombatLog {
  id: string;
  encounterId: string;
  userId: string; // The user who performed the action
  userFaction: string;
  logData: string;
  timestamp: any;
  turn: number;
  type: 'player_attack' | 'monster_attack' | 'skill_used' | 'item_used' | 'system';
  itemId?: string;
  damage?: number;
}

export interface AdminNotification {
    id: string;
    type: 'special_item_used';
    userId: string;
    userName: string;
    itemId: string;
    itemName: string;
    timestamp: any; // Firestore.Timestamp
    read: boolean;
}

// Add this type to fix the error
export interface Faction {
    id: string;
    name: string;
    color: string;
}
