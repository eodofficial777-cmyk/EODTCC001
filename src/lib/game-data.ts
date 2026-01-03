export const RACES = {
  corruptor: {
    id: 'corruptor',
    name: '侵蝕者',
    hp: 200,
    atk: 20,
    def: 10,
  },
  esper: {
    id: 'esper',
    name: '超能者',
    hp: 150,
    atk: 15,
    def: 15,
  },
  human: {
    id: 'human',
    name: '純人類',
    hp: 100,
    atk: 10,
    def: 10,
  },
};

export const FACTIONS = {
  yelu: {
    id: 'yelu',
    name: '夜鷺',
    color: 'hsl(var(--destructive))',
  },
  association: {
    id: 'association',
    name: '協會',
    color: 'hsl(221.2 83.2% 53.3%)', // Blue
  },
  wanderer: {
    id: 'wanderer',
    name: '流浪者',
    color: 'hsl(47.9 95.8% 53.1%)', // Yellow
  },
};

export const TASK_TYPES = {
    general: {
        id: 'general',
        name: '一般圖文任務',
        description: '完成後獲得榮譽點+1，遊戲貨幣+10。',
        honorPoints: 1,
        currency: 10,
    },
    main: {
        id: 'main',
        name: '主線圖文任務',
        description: '完成後獲得榮譽點+3，貨幣+20。每個角色僅限提交一次。',
        honorPoints: 3,
        currency: 20,
    },
    premium: {
        id: 'premium',
        name: '精緻圖文任務',
        description: '完成後獲得榮譽點+10，貨幣+40。代表高品質或特別創作。',
        honorPoints: 10,
        currency: 40,
    },
}

