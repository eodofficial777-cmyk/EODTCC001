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
import { Heart, Shield, Sword, Zap, Target, Timer, Info, CheckCircle2 } from 'lucide-react';
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


const PreparationCountdown = ({ preparationEndTime, battleName, onFinished }: { preparationEndTime: Date, battleName: string, onFinished: () => void }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const difference = preparationEndTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        onFinished();
        return;
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [preparationEndTime, onFinished]);

  return (
    <Card className="text-center bg-blue-500/10 border-blue-500/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-blue-300">
          <Timer className="h-6 w-6" />
          準備期間：{battleName}
        </CardTitle>
        <CardDescription>共鬥將在以下時間後開始：</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-6xl font-bold font-mono text-foreground">{timeLeft}</p>
      </CardContent>
    </Card>
  );
};


const MonsterCard = ({ monster, originalHp, isTargeted, onSelectTarget, isSelectable }: { monster: Monster, originalHp: number, isTargeted: boolean, onSelectTarget: (name: string) => void, isSelectable: boolean }) => {
  const currentHpPercentage = originalHp > 0 ? (monster.hp / originalHp) * 100 : 0;
  const isDefeated = monster.hp <= 0;
  
  return (
    <Card className={cn("overflow-hidden transition-all duration-300", 
        isTargeted && isSelectable && "border-primary ring-2 ring-primary",
        isDefeated && "grayscale opacity-50"
      )}
      onClick={() => isSelectable && !isDefeated && onSelectTarget(monster.name)}
    >
       <div className="relative aspect-video w-full">
        {monster.imageUrl && (
          <Image
            src={monster.imageUrl}
            alt={monster.name}
            fill
            className="object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-white">
          <h4 className="font-bold">{monster.name}</h4>
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className='flex items-center gap-1'><Heart className="h-3 w-3 text-red-400" /> HP</span>
            <span>{monster.hp.toLocaleString()} / {originalHp.toLocaleString()}</span>
          </div>
          <Progress value={currentHpPercentage} className="h-2 bg-red-500/20 [&>div]:bg-red-500" />
        </div>
        <div className="text-xs font-mono flex items-center justify-between text-muted-foreground">
           <span className='flex items-center gap-1'><Sword className="h-3 w-3" /> ATK</span>
           <span>{monster.atk}</span>
        </div>
        {isSelectable &&
          <div className="pt-2">
            <Button className="w-full" size="sm" disabled={isTargeted || isDefeated}>
              {isDefeated ? '已擊敗' : isTargeted ? <><CheckCircle2 className="mr-2 h-4 w-4" />已鎖定</> : <><Target className="mr-2 h-4 w-4" />鎖定目標</>}
            </Button>
          </div>
        }
      </CardContent>
    </Card>
  )
}

const ActionCooldown = ({ cooldown, onCooldownEnd }: { cooldown: number, onCooldownEnd: () => void }) => {
    const [progress, setProgress] = useState(100);
    const totalDuration = 20; // 20 seconds

    useEffect(() => {
        if (cooldown > 0) {
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = (now - cooldown) / 1000;
                const remaining = totalDuration - elapsed;
                
                if (remaining <= 0) {
                    setProgress(100);
                    clearInterval(interval);
                    onCooldownEnd();
                } else {
                    setProgress((remaining / totalDuration) * 100);
                }
            }, 100);

            return () => clearInterval(interval);
        } else {
            setProgress(100);
        }
    }, [cooldown, onCooldownEnd]);
    
    if (cooldown === 0) {
        return null;
    }

    return (
        <div className="p-2 absolute inset-x-0 bottom-full bg-background/80 backdrop-blur-sm">
             <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1 px-1">
                <span>行動冷卻中...</span>
                <span>{Math.max(0, totalDuration - ((Date.now() - cooldown) / 1000)).toFixed(1)}s</span>
            </div>
            <Progress value={100 - progress} className="h-2" />
        </div>
    );
};


export default function BattlegroundPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
  const { data: userData } = useDoc<User>(userDocRef);

  const latestBattleQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'combatEncounters'), orderBy('startTime', 'desc'), limit(1)) : null),
    [firestore]
  );
  const { data: battleData, isLoading: isBattleLoading, mutate: mutateBattle } = useCollection<CombatEncounter>(latestBattleQuery);
  const currentBattle = battleData?.[0];

  const battleLogsQuery = useMemoFirebase(
    () => (firestore && currentBattle ? query(collection(firestore, `combatEncounters/${currentBattle.id}/combatLogs`), orderBy('timestamp', 'desc')) : null),
    [firestore, currentBattle]
  );
  const { data: battleLogs } = useCollection<CombatLog>(battleLogsQuery);

  const allItemsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'items') : null), [firestore]);
  const { data: allItems } = useCollection<Item>(allItemsQuery);

  const skillsQuery = useMemoFirebase(() => {
    if (!firestore || !userData) return null;
    return query(collection(firestore, 'skills'), where('factionId', '==', userData.factionId), where('raceId', '==', userData.raceId));
  }, [firestore, userData]);
  const { data: availableSkills } = useCollection<Skill>(skillsQuery);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [actionCooldown, setActionCooldown] = useState<number>(0);
  const [isAttacking, setIsAttacking] = useState(false);
  const [originalMonsterHPs, setOriginalMonsterHPs] = useState<Record<string, number>>({});
  
  // Persisted states
  const participantData = useMemo(() => currentBattle?.participants?.[user?.uid ?? ''], [currentBattle, user]);
  const supportedFaction = useMemo(() => participantData?.supportedFaction || null, [participantData]);
  const battleHP = useMemo(() => participantData?.hp ?? userData?.attributes.hp ?? 0, [participantData, userData]);
  const equippedItems = useMemo(() => participantData?.equippedItems || [], [participantData]);

  const isWanderer = userData?.factionId === 'wanderer';
  const playerFaction = isWanderer ? supportedFaction : userData?.factionId;
  const combatStatus = currentBattle?.status;
  const preparationEndTime = currentBattle?.preparationEndTime?.toDate();
  const hasFallen = battleHP <= 0;
  const isOnCooldown = actionCooldown > 0;

  const { inventoryEquipment, inventoryConsumables } = useMemo(() => {
    if (!userData?.items || !allItems) return { inventoryEquipment: [], inventoryConsumables: [] };
    const userItems = new Set(userData.items);
    return {
        inventoryEquipment: allItems.filter(item => userItems.has(item.id) && item.itemTypeId === 'equipment'),
        inventoryConsumables: allItems.filter(item => userItems.has(item.id) && item.itemTypeId === 'consumable')
    };
  }, [userData?.items, allItems]);
  
  const { baseAtk, baseDef, equipmentAtk, equipmentDef, finalAtk, finalDef } = useMemo(() => {
    const bAtk = userData?.attributes.atk || 0;
    const bDef = userData?.attributes.def || 0;
    let eqAtk = 0;
    let eqDef = 0;

    equippedItems.forEach(itemId => {
        const item = allItems?.find(i => i.id === itemId);
        if (item) {
            item.effects?.forEach(effect => {
                if ('attribute' in effect) {
                    if (effect.attribute === 'atk' && effect.operator === '+') eqAtk += effect.value;
                    if (effect.attribute === 'def' && effect.operator === '+') eqDef += effect.value;
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
        finalDef: bDef + eqDef 
    };
}, [userData, equippedItems, allItems]);

  useEffect(() => {
    if (currentBattle?.monsters) {
      const initialHPs: Record<string, number> = {};
      const newMonsterNames = currentBattle.monsters.map(m => m.name);
      const oldMonsterNames = Object.keys(originalMonsterHPs);

      // Only update if monsters have changed (e.g., new battle)
      if (newMonsterNames.sort().join(',') !== oldMonsterNames.sort().join(',')) {
         currentBattle.monsters.forEach(monster => {
            initialHPs[monster.name] = monster.hp;
         });
         setOriginalMonsterHPs(initialHPs);
      }
    }
  }, [currentBattle?.monsters, currentBattle?.id]);

  const handleAttack = async () => {
    if (!user || !currentBattle || !selectedTarget || isAttacking || isOnCooldown || hasFallen) return;

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

  const handleCountdownFinished = useCallback(() => {
    mutateBattle();
  }, [mutateBattle]);
  
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

  const renderLogOrCountdown = () => {
    if (combatStatus === 'preparing' && preparationEndTime) {
        return <PreparationCountdown preparationEndTime={preparationEndTime} battleName={currentBattle?.name || ''} onFinished={handleCountdownFinished} />;
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>共鬥紀錄</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-48">
                <div className="space-y-3 text-sm font-mono">
                    {battleLogs && battleLogs.length > 0 ? battleLogs.map(log => (
                    <p key={log.id}>
                        <span className="text-muted-foreground mr-2">[{new Date(log.timestamp?.toDate()).toLocaleTimeString()}]</span>
                        {log.logData}
                    </p>
                    )) : (
                    <p><span className="text-muted-foreground mr-2">[{new Date().toLocaleTimeString()}]</span> 戰鬥開始！</p>
                    )}
                    {hasFallen && <p className="text-red-500">[{new Date().toLocaleTimeString()}] 您的HP已歸零，無法繼續行動。</p>}
                </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
  }

  const renderContent = () => {
    if (isBattleLoading) {
      return (
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
      );
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
      <div className="space-y-4">
        {renderLogOrCountdown()}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full">
      <Card className="mb-4">
          <CardHeader>
              <CardTitle>玩家狀態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-green-400">HP</span>
                  <span className="font-mono">{battleHP} / {userData?.attributes.hp || 0}</span>
                  </div>
                  <Progress value={(battleHP / (userData?.attributes.hp || 1)) * 100} className="h-3 bg-green-500/20 [&>div]:bg-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground"><Sword className="h-4 w-4"/> 攻擊力</div>
                      <div className="font-mono pl-6">{finalAtk} <span className="text-xs text-muted-foreground">({baseAtk}+{equipmentAtk})</span></div>
                  </div>
                  <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4"/> 防禦力</div>
                      <div className="font-mono pl-6">{finalDef} <span className="text-xs text-muted-foreground">({baseDef}+{equipmentDef})</span></div>
                  </div>
              </div>
          </CardContent>
      </Card>

      <div className='flex-grow overflow-y-auto space-y-4 pb-32'>
        {isWanderer && combatStatus !== 'ended' && (
            <div className="p-4 border rounded-lg">
                <h4 className="font-bold mb-2">流浪者支援選擇</h4>
                <p className="text-sm text-muted-foreground mb-3">選擇一個陣營進行支援。一旦選定，本次戰鬥中將無法更改。</p>
                <div className="flex gap-4">
                    <Button onClick={() => handleSupportFaction('yelu')} variant={supportedFaction === 'yelu' ? 'default' : 'outline'} className="w-full" disabled={!!supportedFaction}>支援夜鷺</Button>
                    <Button onClick={() => handleSupportFaction('association')} variant={supportedFaction === 'association' ? 'default' : 'outline'} className="w-full" disabled={!!supportedFaction}>支援協會</Button>
                </div>
            </div>
        )}
        <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {currentBattle?.monsters.filter(m => isWanderer ? m.factionId === supportedFaction : m.factionId === userData?.factionId).map((monster, index) => (
                  <CarouselItem key={index} className="pl-2 md:pl-4 basis-1/1 sm:basis-1/2 lg:basis-1/3">
                      <MonsterCard
                          monster={monster}
                          originalHp={originalMonsterHPs[monster.name] || monster.hp}
                          isTargeted={selectedTarget === monster.name}
                          onSelectTarget={setSelectedTarget}
                          isSelectable={combatStatus === 'active' && !hasFallen}
                      />
                  </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
        </Carousel>
        {renderContent()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm z-10 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:border-none lg:bg-transparent lg:backdrop-blur-none">
          <div className="p-4 relative">
             <ActionCooldown cooldown={actionCooldown} onCooldownEnd={() => setActionCooldown(0)} />
            <Tabs defaultValue="actions" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="actions">行動</TabsTrigger>
                    <TabsTrigger value="equipment">裝備</TabsTrigger>
                    <TabsTrigger value="skills">技能</TabsTrigger>
                    <TabsTrigger value="items">道具</TabsTrigger>
                </TabsList>
                 <TooltipProvider>
                    <div className="mt-4">
                        <TabsContent value="actions">
                             <div className="grid grid-cols-2 gap-2">
                                <Button onClick={handleAttack} disabled={combatStatus !== 'active' || !selectedTarget || hasFallen || isOnCooldown || isAttacking}>
                                  {isAttacking ? '攻擊中...' : '攻擊'}
                                </Button>
                                <Button variant="outline" disabled={combatStatus !== 'active' || hasFallen || isOnCooldown}>技能</Button>
                             </div>
                        </TabsContent>
                        <TabsContent value="equipment">
                            <Card><CardContent className="p-4 space-y-2">
                                {inventoryEquipment.length > 0 ? inventoryEquipment.map(item => (
                                    <Tooltip key={item.id}>
                                        <TooltipTrigger asChild>
                                            <div 
                                                className={`flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors ${equippedItems.includes(item.id) ? 'bg-primary/20 border-primary' : 'hover:bg-muted'}`}
                                                onClick={() => handleToggleEquip(item.id)}
                                            >
                                                <span>{item.name}</span>
                                                {equippedItems.includes(item.id) && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-bold">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.description}</p>
                                            <div className="mt-2 text-xs">
                                                  {item.effects.map((effect, i) => 'attribute' in effect && (
                                                    <p key={i}>{effect.attribute.toUpperCase()} +{effect.value}</p>
                                                  ))}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可裝備的物品。</p>}
                            </CardContent></Card>
                        </TabsContent>
                        <TabsContent value="skills">
                            <Card><CardContent className="p-4 space-y-2">
                                  {availableSkills && availableSkills.length > 0 ? availableSkills.map(skill => (
                                      <Tooltip key={skill.id}>
                                          <TooltipTrigger asChild>
                                            <div className="flex items-center justify-between p-2 border rounded-md">
                                                <span>{skill.name}</span>
                                                <span className="text-xs text-muted-foreground">CD: {skill.cooldown}</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p className="font-bold">{skill.name}</p>
                                              <p className="text-xs text-muted-foreground">{skill.description}</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可用的技能。</p>}
                            </CardContent></Card>
                        </TabsContent>
                        <TabsContent value="items">
                        <Card><CardContent className="p-4 space-y-2">
                                  {inventoryConsumables.length > 0 ? inventoryConsumables.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-2 border rounded-md">
                                        <span>{item.name}</span>
                                      </div>
                                  )) : <p className="text-muted-foreground text-sm text-center py-4">沒有可用的戰鬥道具。</p>}
                            </CardContent></Card>
                        </TabsContent>
                    </div>
                 </TooltipProvider>
            </Tabs>
          </div>
      </div>
    </div>
  );
}
