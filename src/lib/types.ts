

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

export interface TaskType {
  id: string;
  name: string;
  category: 'main' | 'side' | 'general';
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
