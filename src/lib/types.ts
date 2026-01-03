
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
  titles: string[];
  equipment: string[];
  items: string[];
  tasks: string[];
  submittedMainQuest: boolean;
  attributes: {
    hp: number;
    atk: number;
    def: number;
  };
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
  operator: '+' | '*' | 'd'; // d for dice roll, e.g., 1d6
  value: number;
};

export type TriggeredEffect = {
  trigger: 'on_use';
  probability: number; // 0-100
  effectType: 'hp_recovery' | 'damage_enemy' | 'atk_buff' | 'def_buff' | 'hp_cost';
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
    itemTypeId: 'equipment' | 'consumable' | 'special';
    factionId: string;
    raceId: string;
    isPublished: boolean;
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
    value?: number;
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
};


export interface Title {
  id: string;
  name: string;
  description: string;
  isHidden: boolean;
  isManual: boolean;
  trigger?: TitleTrigger;
}
    
