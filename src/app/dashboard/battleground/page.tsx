'use client';

import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Shield, Sword, Timer, CheckCircle2, Package, WandSparkles, Bird, Users, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit, where, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FACTIONS, RACES } from '@/lib/game-data';
import type { CombatEncounter, User, Item, Skill, Monster, CombatLog, AttributeEffect, TriggeredEffect, ActiveBuff, SkillEffect } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { performAttack } from '@/app/actions/perform-attack';
import { useSkill } from '@/app/actions/use-skill';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from '@/components/ui/dialog';

// --- Sub-components for better organization ---

function formatEffect(effect: AttributeEffect | TriggeredEffect | ActiveBuff | SkillEffect): string {
    if ('attribute' in effect) { // AttributeEffect
        const op = effect.operator === 'd' ? `d${effect.value}` : `${effect.operator} ${effect.value}`;
        return `${effect.attribute.toUpperCase()} ${op}`;
    }
    // TriggeredEffect / ActiveBuff / SkillEffect
    const effectType = 'effectType' in effect ? effect.effectType : 'unknown';
    let desc = '';
    if ('probability' in effect && effect.probability) {
      desc = `${effect.probability}%機率`;
    }

    switch(effectType) {
        case 'hp_recovery':
            desc += `恢復 ${effect.value} HP`;
            break;
        case 'direct_damage':
            desc += `造成 ${effect.value} 點直接傷害`;
            break;
        case 'probabilistic_damage':
            desc = `${effect.probability || 100}%機率造成 ${effect.value} 點傷害`;
            break;
        case 'atk_buff':
            desc += `提升攻擊力 ${Number(effect.value) * 100}%`;
            break;
        case 'def_buff':
            desc += `提升防禦力 ${Number(effect.value) * 100}%`;
            break;
        case 'hp_cost':
            desc += `消耗 ${effect.value} HP`;
            break;
    }
    if (effect.duration) {
        desc += `，持續 ${effect.duration} 回合`;
    }
     if ('turnsLeft' in effect) {
        desc += ` (剩餘 ${effect.turnsLeft} 回合)`;
    }
    return desc;
}


const BattleTimer = ({ battle }: { battle: CombatEncounter | null }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const firestore = useFirestore();

    const battleCollectionQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'combatEncounters');
    }, [firestore]);
    
    const { mutate: mutateBattle } = useCollection<CombatEncounter>(battleCollectionQuery);


    const onCountdownFinished = useCallback(() => {
        mutateBattle(); // Re-fetch the battle data
    }, [mutateBattle]);


    useEffect(() => {
        if (!battle) return;

        let targetTime: Date | null = null;
        if (battle.status === 'preparing' && battle.preparationEndTime) {
            targetTime = battle.preparationEndTime.toDate();
        } else if (battle.status === 'active' && battle.startTime) {
            const startTime = battle.startTime.toDate();
            targetTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours from start
        }

        if (!targetTime) {
            setTimeLeft('00:00:00');
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const difference = targetTime!.getTime() - now.getTime();

            if (difference <= 0) {
                setTimeLeft('00:00:00');
                clearInterval(interval);
                onCountdownFinished();
                return;
            }

            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(interval);

    }, [battle, onCountdownFinished]);

    if (!battle || (battle.status !== 'preparing' && battle.status !== 'active')) {
        return (
             <Card>
                <CardHeader className="text-center p-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">戰場狀態</CardTitle>
                    <CardDescription className="text-2xl font-mono font-bold">未開啟</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const title = battle?.status === 'preparing' ? '準備倒數' : '戰場剩餘時間';

    return (
        <Card>
            <CardHeader className="text-center p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <CardDescription className="text-3xl font-mono font-bold">{timeLeft}</CardDescription>
            </CardHeader>
        </Card>
    );
};


const PlayerStatus = ({ userData, battleHP, equippedItems, activeBuffs, allItems }: { userData: User | null; battleHP: number | undefined; equippedItems: string[]; activeBuffs: ActiveBuff[], allItems: Item[] | null }) => {
    const { finalAtk, baseAtk, equipAtk, atkMultiplier, diceAtkString, finalDef, baseDef, equipDef, defMultiplier } = useMemo(() => {
        if (!userData || !allItems) {
             return { finalAtk: 0, baseAtk: 0, equipAtk: 0, atkMultiplier: 1, diceAtkString: '', finalDef: 0, baseDef: 0, equipDef: 0, defMultiplier: 1 };
        }

        let baseAtk = userData.attributes.atk;
        let baseDef = userData.attributes.def;
        let equipAtk = 0;
        let atkMultiplier = 1;
        let equipDef = 0;
        let defMultiplier = 1;
        let diceAtkParts: string[] = [];

        (equippedItems || []).forEach(itemId => {
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                item.effects?.forEach(effect => {
                    if ('attribute' in effect) {
                        const attrEffect = effect as AttributeEffect;
                        if (attrEffect.attribute === 'atk') {
                            if (attrEffect.operator === '+') equipAtk += Number(attrEffect.value);
                            else if (attrEffect.operator === '*') atkMultiplier *= Number(attrEffect.value);
                            else if (attrEffect.operator === 'd') diceAtkParts.push(String(attrEffect.value));
                        }
                        if (attrEffect.attribute === 'def') {
                             if (attrEffect.operator === '+') equipDef += Number(attrEffect.value);
                             else if (attrEffect.operator === '*') defMultiplier *= Number(attrEffect.value);
                        }
                    }
                });
            }
        });
        
        (activeBuffs || []).forEach(buff => {
            if (buff.effectType === 'atk_buff') atkMultiplier *= Number(buff.value);
            if (buff.effectType === 'def_buff') defMultiplier *= Number(buff.value);
        });

        const totalAtk = (baseAtk + equipAtk) * atkMultiplier;
        const diceAtkString = diceAtkParts.length > 0 ? `+${diceAtkParts.join('+')}` : '';

        return {
            finalAtk: Math.round(totalAtk), baseAtk, equipAtk, atkMultiplier, diceAtkString,
            finalDef: Math.round((baseDef + equipDef) * defMultiplier), baseDef, equipDef, defMultiplier,
        };
    }, [userData, equippedItems, allItems, activeBuffs]);
    
    if (!userData) {
        return <Skeleton className="h-48 w-full" />;
    }

    const maxHP = userData.attributes.hp;
    const currentHP = battleHP !== undefined ? battleHP : maxHP;

    return (
        <Card>
            <CardHeader>
                <CardTitle>玩家狀態</CardTitle>
                <CardDescription>您目前的戰鬥數值</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {activeBuffs.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-yellow-400" />目前效果</h4>
                        <div className="flex flex-wrap gap-2">
                            {activeBuffs.map((buff, i) => (
                                <TooltipProvider key={i}><Tooltip><TooltipTrigger asChild>
                                    <Badge variant="outline">{formatEffect(buff)}</Badge>
                                </TooltipTrigger><TooltipContent><p>{formatEffect(buff)}</p></TooltipContent></Tooltip></TooltipProvider>
                            ))}
                        </div>
                    </div>
                )}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-green-400">HP</span>
                        <span className="font-mono">{currentHP} / {maxHP}</span>
                    </div>
                    <Progress value={(currentHP / (maxHP || 1)) * 100} className="h-3 bg-green-500/20 [&>div]:bg-green-500" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                   <div className="flex flex-col gap-1 border p-2 rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground"><Sword className="h-4 w-4" /> 攻擊力</div>
                        <div className="font-mono text-lg font-bold">
                            {`${finalAtk}${diceAtkString}`} 
                            <span className="text-sm font-normal text-muted-foreground"> ({baseAtk} + {equipAtk}) * {atkMultiplier.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 border p-2 rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4" /> 防禦力</div>
                         <div className="font-mono text-lg font-bold">
                            {finalDef} 
                            <span className="text-sm font-normal text-muted-foreground"> ({baseDef} + {equipDef}) * {defMultiplier.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const MonsterCard = ({ monster, isAttackable, onSelect, actionContext }: { monster: Monster; isAttackable: boolean; onSelect: (monsterId: string) => void; actionContext: {type: string} | null }) => {
  const isDefeated = monster.hp <= 0;
  const maxHp = monster.originalHp ?? monster.hp;
  const isTargeting = actionContext && (actionContext.type === 'direct_damage' || actionContext.type === 'probabilistic_damage' || actionContext.type === 'attack' || actionContext.type === 'skill_target');
  
  return (
    <Card 
        className={cn("overflow-hidden transition-all duration-300 flex flex-col relative", 
            isDefeated && "grayscale opacity-50",
            isTargeting && isAttackable && !isDefeated && "cursor-pointer ring-2 ring-primary",
            !isAttackable && "cursor-not-allowed"
        )}
        onClick={isTargeting && isAttackable && !isDefeated ? () => onSelect(monster.monsterId) : undefined}
    >
       <div className="relative aspect-square w-full">
        {monster.imageUrl ? (
          <Image
            src={monster.imageUrl}
            alt={monster.name}
            fill
            className="object-cover"
          />
        ) : <div className="bg-muted w-full h-full"/>}
        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-white">
          <h4 className="font-bold">{monster.name}</h4>
        </div>
        {!isAttackable && !isDefeated && (
           <div className="absolute inset-0 bg-black/70 flex items-center justify-center flex-col gap-2 text-primary-foreground">
             <EyeOff className="h-8 w-8" />
             <span className="text-sm font-bold">無法攻擊</span>
           </div>
        )}
      </div>
      <CardContent className="p-3 space-y-2 flex-grow">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className='flex items-center gap-1'><Heart className="h-3 w-3 text-red-400" /> HP</span>
            <span>{monster.hp.toLocaleString()} / {(maxHp || 0).toLocaleString()}</span>
          </div>
          <Progress value={(monster.hp / (maxHp > 0 ? maxHp : 1)) * 100} className="h-2 bg-red-500/20 [&>div]:bg-red-500" />
        </div>
        <div className="text-xs font-mono flex items-center justify-between text-muted-foreground">
           <span className='flex items-center gap-1'><Sword className="h-3 w-3" /> ATK</span>
           <span>{monster.atk}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const ActionCooldown = ({ cooldown, onCooldownEnd }: { cooldown: number, onCooldownEnd: () => void }) => {
    const [progress, setProgress] = useState(100);
    const totalDuration = 20; // 20 seconds

    useEffect(() => {
        if (cooldown > 0) {
            setProgress(0); // Start progress from 0
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = (now - cooldown) / 1000;
                const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
                
                if (newProgress >= 100) {
                    setProgress(100);
                    clearInterval(interval);
                    onCooldownEnd();
                } else {
                    setProgress(newProgress);
                }
            }, 100);
            return () => clearInterval(interval);
        } else {
            setProgress(100);
        }
    }, [cooldown, onCooldownEnd]);
    
    if (cooldown === 0 || progress >= 100) return null;

    const remainingTime = totalDuration - ((Date.now() - cooldown) / 1000);

    return (
        <div className="p-2 space-y-1 w-full">
             <div className="flex justify-between text-xs font-mono text-muted-foreground px-1">
                <span>行動冷卻中...</span>
                <span>{Math.max(0, remainingTime).toFixed(1)}s</span>
            </div>
            <Progress value={progress} className="h-2" />
        </div>
    );
};


export default function BattlegroundPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
  const { data: userData, isLoading: isUserDataLoading, mutate: mutateUser } = useDoc<User>(userDocRef);

  const latestBattleQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'combatEncounters'), orderBy('startTime', 'desc'), limit(1)) : null),
    [firestore]
  );
  const { data: battleData, isLoading: isBattleLoading, mutate: mutateBattle } = useCollection<CombatEncounter>(latestBattleQuery);
  const currentBattle = battleData?.[0];
  const isBattleActiveForState = currentBattle && ['preparing', 'active'].includes(currentBattle.status);

  const battleLogsQuery = useMemoFirebase(
    () => (currentBattle ? query(collection(firestore, `combatEncounters/${currentBattle.id}/combatLogs`), orderBy('timestamp', 'desc')) : null),
    [firestore, currentBattle]
  );
  const { data: battleLogs } = useCollection<CombatLog>(battleLogsQuery);

  const allItemsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'items') : null), [firestore]);
  const { data: allItems, isLoading: areItemsLoading } = useCollection<Item>(allItemsQuery);

  const skillsQuery = useMemoFirebase(() => {
    if (!firestore || !userData?.factionId || !userData?.raceId) return null;
    return query(collection(firestore, 'skills'), where('factionId', '==', userData.factionId), where('raceId', '==', userData.raceId));
  }, [firestore, userData]);
  const { data: availableSkills } = useCollection<Skill>(skillsQuery);

  const [actionContext, setActionContext] = useState<{type: string, skillId?: string} | null>(null);
  const [actionCooldown, setActionCooldown] = useState<number>(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  const participantData = useMemo(() => isBattleActiveForState ? currentBattle?.participants?.[user?.uid ?? ''] : undefined, [currentBattle, user, isBattleActiveForState]);
  const battleHP = participantData?.hp;
  const supportedFaction = participantData?.supportedFaction;
  const equippedItems = participantData?.equippedItems || [];
  const activeBuffs = participantData?.activeBuffs || [];
  const skillCooldowns = participantData?.skillCooldowns || {};
  
  const isWanderer = userData?.factionId === 'wanderer';
  const playerTargetFaction = isWanderer ? supportedFaction : userData?.factionId;
  const combatStatus = currentBattle?.status;
  const hasFallen = battleHP !== undefined && battleHP <= 0;
  const isOnCooldown = actionCooldown > 0;
  
  const battleEndTime = useMemo(() => {
    if (currentBattle?.status === 'active' && currentBattle.startTime) {
      const startTime = currentBattle.startTime.toDate();
      return new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
    }
    return null;
  }, [currentBattle]);
  const isBattleTimeOver = battleEndTime ? new Date() > battleEndTime : false;
  
  const { inventoryEquipment, inventoryConsumables } = useMemo(() => {
    if (!userData?.items || !allItems) return { inventoryEquipment: [], inventoryConsumables: new Map() };
    
    const inventoryMap = new Map<string, number>();
    userData.items.forEach(id => {
      inventoryMap.set(id, (inventoryMap.get(id) || 0) + 1);
    });

    const equipment = allItems.filter(item => userData.items.includes(item.id) && item.itemTypeId === 'equipment');
    
    const consumables = new Map<string, { item: Item, count: number }>();
    allItems.forEach(item => {
      if (item.itemTypeId === 'consumable' && inventoryMap.has(item.id)) {
        consumables.set(item.id, { item, count: inventoryMap.get(item.id)! });
      }
    });

    return { inventoryEquipment: equipment, inventoryConsumables: consumables };
  }, [userData?.items, allItems]);


  const handlePerformAttack = async (targetMonsterId: string) => {
    if (!user || !currentBattle || isProcessingAction || isOnCooldown || hasFallen || isBattleTimeOver) return;

    setIsProcessingAction(true);
    try {
        const { success, error } = await performAttack({
            userId: user.uid,
            battleId: currentBattle.id,
            targetMonsterId: targetMonsterId,
            equippedItemIds: equippedItems,
            supportedFaction: supportedFaction || null
        });
        if (error) throw new Error(error);
        setActionCooldown(Date.now());
    } catch (error: any) {
        toast({ variant: 'destructive', title: '攻擊失敗', description: error.message });
    } finally {
        setIsProcessingAction(false);
        setActionContext(null);
    }
  }

  const handleUseSkill = async (skill: Skill, targetMonsterId?: string) => {
    if (!user || !currentBattle || isProcessingAction || isOnCooldown || hasFallen || isBattleTimeOver || skillCooldowns[skill.id] > 0) return;
    
    setIsProcessingAction(true);
    try {
      const result = await useSkill({
        userId: user.uid,
        battleId: currentBattle.id,
        skillId: skill.id,
        targetMonsterId,
      });
      if (result.error) throw new Error(result.error);
      toast({ title: '技能已使用', description: result.logMessage });
      setActionCooldown(Date.now());
    } catch (error: any) {
      toast({ variant: 'destructive', title: '技能使用失敗', description: error.message });
    } finally {
      setIsProcessingAction(false);
      setActionContext(null);
    }
  };
  
  const handleSkillClick = (skill: Skill) => {
    const requiresTarget = skill.effects.some(e => e.effectType === 'direct_damage' || e.effectType === 'probabilistic_damage');
    if (requiresTarget) {
      setActionContext({ type: 'skill_target', skillId: skill.id });
    } else {
      handleUseSkill(skill);
    }
  };


  const handleToggleEquip = async (itemId: string) => {
    if (!user || !currentBattle || !firestore) return;
    
    let newEquipped = [...equippedItems];
    if (newEquipped.includes(itemId)) {
        newEquipped = newEquipped.filter(id => id !== itemId);
    } else {
        if (newEquipped.length < 2) {
            newEquipped.push(itemId);
        } else {
            toast({ variant: 'destructive', title: '裝備已滿', description: '最多只能裝備兩件物品。'})
            return;
        }
    }
    
    const participants = {
        ...(currentBattle.participants || {}),
        [user.uid]: {
            ...(participantData || { hp: userData?.attributes.hp, roleName: userData?.roleName, factionId: userData?.factionId }),
            equippedItems: newEquipped
        }
    };
    
    const battleDocRef = doc(firestore, 'combatEncounters', currentBattle.id);
    await updateDoc(battleDocRef, { participants });
  }
  
  const handleSupportFaction = async (factionId: 'yelu' | 'association') => {
      if (!isWanderer || combatStatus === 'ended' || supportedFaction || !user || !currentBattle || !firestore) return;

      const participants = {
        ...(currentBattle.participants || {}),
        [user.uid]: {
            ...(participantData || { hp: userData?.attributes.hp, roleName: userData?.roleName, factionId: userData?.factionId }),
            supportedFaction: factionId
        }
      };

      const battleDocRef = doc(firestore, 'combatEncounters', currentBattle.id);
      await updateDoc(battleDocRef, { participants });
  }
  
  const { yeluMonsters, associationMonsters, commonMonsters } = useMemo(() => {
    if (!currentBattle?.monsters) return { yeluMonsters: [], associationMonsters: [], commonMonsters: [] };
    return {
        yeluMonsters: currentBattle.monsters.filter(m => m.factionId === 'yelu'),
        associationMonsters: currentBattle.monsters.filter(m => m.factionId === 'association'),
        commonMonsters: currentBattle.monsters.filter(m => m.factionId === 'common'),
    }
  }, [currentBattle]);


  const isLoading = isUserLoading || isUserDataLoading || areItemsLoading || isBattleLoading;
  
  if (isLoading) {
    return <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Skeleton className="lg:col-span-2 h-screen"/><Skeleton className="lg:col-span-1 h-screen"/></div>
  }
  
  const isBattleActive = currentBattle && !['ended', 'closed'].includes(currentBattle.status);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Battle Area */}
        <div className="lg:col-span-2 space-y-4">
         {isBattleActive ? (
            <>
              <Tabs defaultValue="yelu" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="yelu">夜鷺戰場</TabsTrigger>
                    <TabsTrigger value="association">協會戰場</TabsTrigger>
                </TabsList>
                <TabsContent value="yelu" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[...yeluMonsters, ...commonMonsters].map((monster) => (
                          <MonsterCard 
                              key={monster.monsterId}
                              monster={monster}
                              isAttackable={playerTargetFaction === 'yelu'}
                              onSelect={(monsterId) => {
                                if (actionContext?.type === 'attack') handlePerformAttack(monsterId);
                                else if (actionContext?.type === 'skill_target' && actionContext.skillId) {
                                  const skill = availableSkills?.find(s => s.id === actionContext.skillId);
                                  if (skill) handleUseSkill(skill, monsterId);
                                }
                              }}
                              actionContext={actionContext}
                          />
                      ))}
                    </div>
                </TabsContent>
                <TabsContent value="association" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {[...associationMonsters, ...commonMonsters].map((monster) => (
                          <MonsterCard 
                              key={monster.monsterId}
                              monster={monster}
                              isAttackable={playerTargetFaction === 'association'}
                              onSelect={(monsterId) => {
                                if (actionContext?.type === 'attack') handlePerformAttack(monsterId);
                                else if (actionContext?.type === 'skill_target' && actionContext.skillId) {
                                  const skill = availableSkills?.find(s => s.id === actionContext.skillId);
                                  if (skill) handleUseSkill(skill, monsterId);
                                }
                              }}
                              actionContext={actionContext}
                          />
                      ))}
                    </div>
                </TabsContent>
              </Tabs>


              {isWanderer && combatStatus !== 'ended' && !supportedFaction && (
                  <Card>
                      <CardHeader>
                          <CardTitle>流浪者支援選擇</CardTitle>
                          <CardDescription>選擇一個陣營進行支援。一旦選定，本次戰鬥中將無法更改。</CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-4">
                          <Button onClick={() => handleSupportFaction('yelu')} variant={'outline'} className="w-full">支援夜鷺</Button>
                          <Button onClick={() => handleSupportFaction('association')} variant={'outline'} className="w-full">支援協會</Button>
                      </CardContent>
                  </Card>
              )}
              
              <Card>
                <CardHeader><CardTitle>行動</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-4">
                    <Dialog open={actionContext !== null} onOpenChange={(isOpen) => !isOpen && setActionContext(null)}>
                        <Button size="lg" onClick={() => setActionContext({type: 'attack'})} disabled={combatStatus !== 'active' || hasFallen || isOnCooldown || isProcessingAction || isBattleTimeOver}>
                            {isProcessingAction ? '處理中...' : '攻擊'}
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="lg" variant="outline" disabled={combatStatus !== 'active' || hasFallen || isOnCooldown || isProcessingAction || isBattleTimeOver}>技能</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>選擇技能</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 gap-2 py-4">
                                {availableSkills && availableSkills.length > 0 ? availableSkills.map(skill => {
                                    const cooldownTurns = skillCooldowns[skill.id] || 0;
                                    const isCoolingDown = cooldownTurns > 0;
                                    return (
                                        <TooltipProvider key={skill.id}><Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full justify-between"
                                                    onClick={() => handleSkillClick(skill)}
                                                    disabled={isCoolingDown || hasFallen || isOnCooldown || isProcessingAction || combatStatus !== 'active' || isBattleTimeOver}
                                                >
                                                    <span>{skill.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {isCoolingDown ? `冷卻中 (${cooldownTurns})` : `CD: ${skill.cooldown}`}
                                                    </span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs">
                                                <p className="font-bold">{skill.name}</p>
                                                <p className="text-xs text-muted-foreground mb-2">{skill.description}</p>
                                                <div className="border-t pt-2 mt-2">
                                                    {skill.effects.map((effect, i) => (
                                                        <p key={i} className="text-xs">{formatEffect(effect)}</p>
                                                    ))}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip></TooltipProvider>
                                    )
                                }) : <p className="text-muted-foreground text-sm text-center py-4">沒有可用的技能。</p>}
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button size="lg" variant="outline" disabled>道具</Button>
                        <ActionCooldown cooldown={actionCooldown} onCooldownEnd={() => setActionCooldown(0)} />

                        {/* This Dialog handles the monster targeting */}
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>選擇目標</DialogTitle>
                                <DialogDescription>選擇一隻災獸進行{actionContext?.type === 'attack' ? '攻擊' : '技能施放'}。</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                                {[...yeluMonsters, ...associationMonsters, ...commonMonsters]
                                    .filter(m => m.hp > 0 && (m.factionId === playerTargetFaction || m.factionId === 'common'))
                                    .map((monster) => (
                                    <Button 
                                    key={monster.monsterId} 
                                    variant="outline" 
                                    className="h-auto flex flex-col p-4 gap-2" 
                                    onClick={() => {
                                        if (actionContext?.type === 'attack') handlePerformAttack(monster.monsterId);
                                        if (actionContext?.type === 'skill_target' && actionContext.skillId) {
                                            const skill = availableSkills?.find(s => s.id === actionContext.skillId);
                                            if (skill) handleUseSkill(skill, monster.monsterId);
                                        }
                                    }}
                                    >
                                        <span className="font-bold">{monster.name}</span>
                                        <span className="text-xs text-muted-foreground">HP: {monster.hp.toLocaleString()}</span>
                                    </Button>
                                ))}
                                {[...yeluMonsters, ...associationMonsters, ...commonMonsters].filter(m => m.hp > 0 && (m.factionId === playerTargetFaction || m.factionId === 'common')).length === 0 && (
                                    <p className="col-span-2 text-center text-muted-foreground">沒有可攻擊的目標。</p>
                                )}
                            </div>
                            <DialogClose asChild>
                            <Button type="button" variant="secondary" className="w-full">取消</Button>
                            </DialogClose>
                        </DialogContent>
                    </Dialog>
                </CardContent>
              </Card>

              <Card>
                  <CardHeader><CardTitle>共鬥紀錄</CardTitle></CardHeader>
                  <CardContent>
                      <ScrollArea className="h-64">
                          <div className="space-y-3 text-sm font-mono pr-4">
                              {battleLogs && battleLogs.length > 0 ? battleLogs.map(log => (
                                  <p key={log.id}>
                                      <span className="text-muted-foreground mr-2">[{new Date(log.timestamp?.toDate()).toLocaleTimeString()}]</span>
                                      {log.logData}
                                  </p>
                              )) : <p className="text-muted-foreground text-center">戰鬥尚未開始...</p>}
                              {hasFallen && <p className="text-red-500">[{new Date().toLocaleTimeString()}] 您的HP已歸零，無法繼續行動。</p>}
                          </div>
                      </ScrollArea>
                  </CardContent>
              </Card>
            </>
          ) : (
             <Card className="flex flex-col items-center justify-center min-h-[60vh]">
                <CardHeader className="text-center">
                  <CardTitle className="font-headline text-2xl">共鬥尚未開放</CardTitle>
                  <CardDescription>請等待管理員開啟下一場戰鬥。</CardDescription>
                </CardHeader>
              </Card>
          )}
        </div>

        {/* Right Column: Player Status & Resources */}
        <div className="lg:col-span-1 space-y-6">
            <BattleTimer battle={currentBattle} />
            
            <PlayerStatus userData={userData} battleHP={isBattleActive ? battleHP : userData?.attributes.hp} equippedItems={isBattleActive ? equippedItems : []} activeBuffs={isBattleActive ? activeBuffs : []} allItems={allItems} />
            
            <Tabs defaultValue="equipment" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="equipment">裝備</TabsTrigger>
                    <TabsTrigger value="items">道具</TabsTrigger>
                </TabsList>
                <TabsContent value="equipment" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle className='text-base'>裝備欄</CardTitle>
                            <CardDescription className='text-xs'>點擊以裝備或卸下，最多兩件。</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2">
                             <TooltipProvider>
                                {inventoryEquipment.length > 0 ? inventoryEquipment.map(item => (
                                    <Tooltip key={item.id} delayDuration={100}>
                                        <TooltipTrigger asChild>
                                            <div 
                                                className={cn('flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors', equippedItems.includes(item.id) ? 'bg-primary/20 border-primary' : 'hover:bg-muted')}
                                                onClick={() => handleToggleEquip(item.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={32} height={32} className="rounded-sm object-cover"/>}
                                                    <span>{item.name}</span>
                                                </div>
                                                {equippedItems.includes(item.id) && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            <p className="font-bold">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.description}</p>
                                            <div className="mt-2 text-xs">
                                                {item.effects?.map((effect, i) => <div key={i}>{formatEffect(effect)}</div>)}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可裝備的物品。</p>}
                             </TooltipProvider>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="items" className="mt-4">
                     <Card><CardContent className="p-4 space-y-2">
                        {inventoryConsumables.size > 0 ? Array.from(inventoryConsumables.values()).map(({ item, count }) => (
                             <TooltipProvider key={item.id}><Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2 border rounded-md">
                                        <div className="flex items-center gap-2">
                                            {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={32} height={32} className="rounded-sm object-cover"/>}
                                            <span>{item.name}</span>
                                        </div>
                                         <span className="text-sm text-muted-foreground font-mono">x{count}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                     <p className="font-bold">{item.name}</p>
                                     <p className="text-xs text-muted-foreground">{item.description}</p>
                                </TooltipContent>
                            </Tooltip></TooltipProvider>
                        )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可用的戰鬥道具。</p>}
                     </CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    </div>
  );
}
