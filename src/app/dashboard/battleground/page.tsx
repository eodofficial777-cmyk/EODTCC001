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
import { Heart, Shield, Sword, Target, Timer, Info, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit, where, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FACTIONS, RACES } from '@/lib/game-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CombatEncounter, User, Item, Skill, AttributeEffect, Monster, CombatLog } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { performAttack } from '@/app/actions/perform-attack';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

// --- Sub-components for better organization ---

const BattleTimer = ({ battle }: { battle: CombatEncounter | null }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const { mutate: mutateBattle } = useCollection<CombatEncounter>(
        useMemoFirebase(() => collection(useFirestore(), 'combatEncounters'), [])
    );

    useEffect(() => {
        if (!battle) return;

        const getTargetTime = () => {
            if (battle.status === 'preparing' && battle.preparationEndTime) {
                return battle.preparationEndTime.toDate();
            }
            if (battle.status === 'active' && battle.startTime) {
                const startTime = battle.startTime.toDate();
                return new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
            }
            return null;
        }

        const targetTime = getTargetTime();
        if (!targetTime) {
            setTimeLeft('00:00:00');
            return;
        }
        
        const interval = setInterval(() => {
            const now = new Date();
            const difference = targetTime.getTime() - now.getTime();

            if (difference <= 0) {
                setTimeLeft('00:00:00');
                clearInterval(interval);
                mutateBattle();
                return;
            }

            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(interval);

    }, [battle, mutateBattle]);

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


const PlayerStatus = ({ userData, battleHP, equippedItems, allItems }) => {
     const { baseAtk, baseDef, equipmentAtk, equipmentDef, finalAtk, finalDef, diceAtkString, diceDefString } = useMemo(() => {
        if (!userData || !allItems) return { baseAtk: 0, baseDef: 0, equipmentAtk: 0, equipmentDef: 0, finalAtk: 0, finalDef: 0, diceAtkString: '', diceDefString: '' };

        const bAtk = userData.attributes.atk;
        const bDef = userData.attributes.def;
        let eqAtk = 0;
        let eqDef = 0;
        let atkDice: string[] = [];
        let defDice: string[] = [];

        (equippedItems || []).forEach(itemId => {
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                item.effects?.forEach(effect => {
                    if ('attribute' in effect) {
                         if (effect.attribute === 'atk') {
                            if (effect.operator === '+') eqAtk += effect.value;
                            if (effect.operator === 'd') atkDice.push(`1d${effect.value}`);
                         }
                         if (effect.attribute === 'def') {
                            if (effect.operator === '+') eqDef += effect.value;
                            if (effect.operator === 'd') defDice.push(`1d${effect.value}`);
                         }
                    }
                });
            }
        });
        
        return {
            baseAtk: bAtk,
            baseDef: bDef,
            equipmentAtk: eqAtk,
            equipmentDef: eqDef,
            finalAtk: bAtk + eqAtk,
            finalDef: bDef + eqDef,
            diceAtkString: atkDice.length > 0 ? `+${atkDice.join('+')}` : '',
            diceDefString: defDice.length > 0 ? `+${defDice.join('+')}` : ''
        };
    }, [userData, equippedItems, allItems]);
    
    if (!userData) {
        return <Skeleton className="h-48 w-full"/>
    }

    const maxHP = userData.attributes.hp;

    return (
        <Card>
            <CardHeader>
                <CardTitle>玩家狀態</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-green-400">HP</span>
                        <span className="font-mono">{battleHP} / {maxHP}</span>
                    </div>
                    <Progress value={(battleHP / (maxHP || 1)) * 100} className="h-3 bg-green-500/20 [&>div]:bg-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="flex flex-col gap-1 border p-2 rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground justify-center"><Sword className="h-4 w-4" /> 攻擊力</div>
                        <div className="font-mono text-xl font-bold">{finalAtk}{diceAtkString}</div>
                        <div className="text-xs text-muted-foreground font-mono">({baseAtk} + {equipmentAtk})</div>
                    </div>
                    <div className="flex flex-col gap-1 border p-2 rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground justify-center"><Shield className="h-4 w-4" /> 防禦力</div>
                        <div className="font-mono text-xl font-bold">{finalDef}{diceDefString}</div>
                        <div className="text-xs text-muted-foreground font-mono">({baseDef} + {equipmentDef})</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const MonsterCard = ({ monster, isTargeted, onSelectTarget, isSelectable }: { monster: Monster, isTargeted: boolean, onSelectTarget: (name: string) => void, isSelectable: boolean }) => {
  const isDefeated = monster.hp <= 0;
  
  return (
    <Card className={cn("overflow-hidden transition-all duration-300 w-full flex flex-col", 
        isTargeted && isSelectable && "border-primary ring-2 ring-primary",
        isDefeated && "grayscale opacity-50"
      )}
      onClick={() => isSelectable && !isDefeated && onSelectTarget(monster.name)}
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
      </div>
      <CardContent className="p-3 space-y-2 flex-grow">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className='flex items-center gap-1'><Heart className="h-3 w-3 text-red-400" /> HP</span>
            <span>{monster.hp.toLocaleString()} / {monster.originalHp.toLocaleString()}</span>
          </div>
          <Progress value={(monster.hp / monster.originalHp) * 100} className="h-2 bg-red-500/20 [&>div]:bg-red-500" />
        </div>
        <div className="text-xs font-mono flex items-center justify-between text-muted-foreground">
           <span className='flex items-center gap-1'><Sword className="h-3 w-3" /> ATK</span>
           <span>{monster.atk}</span>
        </div>
      </CardContent>
       {isSelectable &&
          <CardFooter className="p-3">
            <Button className="w-full" size="sm" variant={isTargeted ? 'default' : 'outline'} disabled={isDefeated}>
              {isDefeated ? '已擊敗' : isTargeted ? <><CheckCircle2 className="mr-2 h-4 w-4" />已鎖定</> : <><Target className="mr-2 h-4 w-4" />鎖定目標</>}
            </Button>
          </CardFooter>
        }
    </Card>
  )
}

const ActionCooldown = ({ cooldown, onCooldownEnd }) => {
    const [progress, setProgress] = useState(100);
    const totalDuration = 20;

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

  const battleLogsQuery = useMemoFirebase(
    () => (currentBattle ? query(collection(firestore, `combatEncounters/${currentBattle.id}/combatLogs`), orderBy('timestamp', 'desc')) : null),
    [firestore, currentBattle]
  );
  const { data: battleLogs } = useCollection<CombatLog>(battleLogsQuery);

  const allItemsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'items') : null), [firestore]);
  const { data: allItems, isLoading: areItemsLoading } = useCollection<Item>(allItemsQuery);

  const skillsQuery = useMemoFirebase(() => {
    if (!firestore || !userData) return null;
    return query(collection(firestore, 'skills'), where('factionId', '==', userData.factionId), where('raceId', '==', userData.raceId));
  }, [firestore, userData]);
  const { data: availableSkills } = useCollection<Skill>(skillsQuery);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [actionCooldown, setActionCooldown] = useState<number>(0);
  const [isAttacking, setIsAttacking] = useState(false);
  
  const participantData = useMemo(() => currentBattle?.participants?.[user?.uid ?? ''], [currentBattle, user]);
  const battleHP = useMemo(() => participantData?.hp, [participantData]);
  
  const supportedFaction = useMemo(() => participantData?.supportedFaction, [participantData]);
  const equippedItems = useMemo(() => participantData?.equippedItems || [], [participantData]);
  
  const isWanderer = userData?.factionId === 'wanderer';
  const playerFaction = isWanderer ? supportedFaction : userData?.factionId;
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
    if (!userData?.items || !allItems) return { inventoryEquipment: [], inventoryConsumables: [] };
    const userItemIds = new Set(userData.items);
    return {
        inventoryEquipment: allItems.filter(item => userItemIds.has(item.id) && item.itemTypeId === 'equipment'),
        inventoryConsumables: allItems.filter(item => userItemIds.has(item.id) && item.itemTypeId === 'consumable')
    };
  }, [userData?.items, allItems]);


  const handleAttack = async () => {
    if (!user || !currentBattle || !selectedTarget || isAttacking || isOnCooldown || hasFallen || isBattleTimeOver) return;

    setIsAttacking(true);
    try {
        const result = await performAttack({
            userId: user.uid,
            battleId: currentBattle.id,
            targetMonsterName: selectedTarget,
            equippedItemIds: equippedItems,
            supportedFaction: supportedFaction
        });

        if (result.error) throw new Error(result.error);
        
        setActionCooldown(Date.now());
    } catch (error: any) {
        toast({ variant: 'destructive', title: '攻擊失敗', description: error.message });
    } finally {
        setIsAttacking(false);
    }
  }

  const handleToggleEquip = async (itemId: string) => {
    if (!user || !currentBattle) return;
    
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
            ...(currentBattle.participants?.[user.uid] || { hp: userData?.attributes.hp, roleName: userData?.roleName, factionId: userData?.factionId }),
            equippedItems: newEquipped
        }
    };
    
    const battleDocRef = doc(firestore, 'combatEncounters', currentBattle.id);
    await updateDoc(battleDocRef, { participants });
  }
  
  const handleSupportFaction = async (factionId: 'yelu' | 'association') => {
      if (!isWanderer || combatStatus === 'ended' || supportedFaction || !user || !currentBattle) return;

      const participants = {
        ...(currentBattle.participants || {}),
        [user.uid]: {
            ...(currentBattle.participants?.[user.uid] || { hp: userData?.attributes.hp, roleName: userData?.roleName, factionId: userData?.factionId }),
            supportedFaction: factionId
        }
      };

      const battleDocRef = doc(firestore, 'combatEncounters', currentBattle.id);
      await updateDoc(battleDocRef, { participants });
      
      setSelectedTarget(null); // Reset target when switching factions
  }
  
  const monstersToDisplay = useMemo(() => {
    if (!currentBattle?.monsters) return [];
    if (!playerFaction) {
      return isWanderer ? [] : currentBattle.monsters;
    }
    return currentBattle.monsters.filter(m => m.factionId === playerFaction);
  }, [currentBattle, playerFaction, isWanderer]);


  const isLoading = isUserLoading || isUserDataLoading || areItemsLoading || isBattleLoading;
  
  if (isLoading) {
    return <div className="grid grid-cols-3 gap-6"><Skeleton className="col-span-2 h-screen"/><Skeleton className="col-span-1 h-screen"/></div>
  }
  
  if (!currentBattle || combatStatus === 'ended' || combatStatus === 'closed') {
      return (
        <Card className="flex flex-col items-center justify-center min-h-[300px] bg-muted/50">
           <CardHeader className="text-center">
            <CardTitle>共鬥尚未開放</CardTitle>
            <CardDescription>請等待管理員開啟下一場戰鬥。</CardDescription>
           </CardHeader>
        </Card>
      )
  }
  
  return (
    <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Battle Area */}
        <div className="col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monstersToDisplay.map((monster, index) => (
                    <MonsterCard 
                        key={`${monster.name}-${index}`}
                        monster={monster}
                        isTargeted={selectedTarget === monster.name}
                        onSelectTarget={setSelectedTarget}
                        isSelectable={combatStatus === 'active' && !hasFallen && !isBattleTimeOver}
                    />
                ))}
            </div>

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
                     <Button size="lg" onClick={handleAttack} disabled={combatStatus !== 'active' || !selectedTarget || hasFallen || isOnCooldown || isAttacking || isBattleTimeOver}>
                        {isAttacking ? '攻擊中...' : '攻擊'}
                    </Button>
                     <Button size="lg" variant="outline" disabled>技能</Button>
                     <Button size="lg" variant="outline" disabled>道具</Button>
                     <ActionCooldown cooldown={actionCooldown} onCooldownEnd={() => setActionCooldown(0)} />
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
        </div>

        {/* Right Column: Player Status & Resources */}
        <div className="col-span-1 space-y-6">
            <BattleTimer battle={currentBattle} />
            
            <PlayerStatus userData={userData} battleHP={battleHP ?? userData?.attributes.hp} equippedItems={equippedItems} allItems={allItems} />
            
            <Tabs defaultValue="equipment" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="equipment">裝備</TabsTrigger>
                    <TabsTrigger value="skills">技能</TabsTrigger>
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
                                    <Tooltip key={item.id}>
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
                                        </TooltipContent>
                                    </Tooltip>
                                )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可裝備的物品。</p>}
                             </TooltipProvider>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="skills" className="mt-4">
                     <Card><CardContent className="p-4 space-y-2">
                        {availableSkills && availableSkills.length > 0 ? availableSkills.map(skill => (
                            <Tooltip key={skill.id}>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2 border rounded-md">
                                        <span>{skill.name}</span>
                                        <span className="text-xs text-muted-foreground">CD: {skill.cooldown}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    <p className="font-bold">{skill.name}</p>
                                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                                </TooltipContent>
                            </Tooltip>
                        )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可用的技能。</p>}
                     </CardContent></Card>
                </TabsContent>
                 <TabsContent value="items" className="mt-4">
                     <Card><CardContent className="p-4 space-y-2">
                        {inventoryConsumables.length > 0 ? inventoryConsumables.map(item => (
                             <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-between p-2 border rounded-md">
                                        <div className="flex items-center gap-2">
                                            {item.imageUrl && <Image src={item.imageUrl} alt={item.name} width={32} height={32} className="rounded-sm object-cover"/>}
                                            <span>{item.name}</span>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                     <p className="font-bold">{item.name}</p>
                                     <p className="text-xs text-muted-foreground">{item.description}</p>
                                </TooltipContent>
                            </Tooltip>
                        )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可用的戰鬥道具。</p>}
                     </CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    </div>
  );
}
