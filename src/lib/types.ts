
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
