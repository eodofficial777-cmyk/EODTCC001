'use client';

import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Shield, Sword, Zap, Target, Timer, Info, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FACTIONS, RACES } from '@/lib/game-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CombatEncounter, User, Item, Skill, AttributeEffect } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


const PreparationCountdown = ({ preparationEndTime, battleName }: { preparationEndTime: Date, battleName: string }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const difference = preparationEndTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [preparationEndTime]);

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


const MonsterCard = ({ monster, isTargeted, onSelectTarget, isSelectable }: { monster: any, isTargeted: boolean, onSelectTarget: (id: string) => void, isSelectable: boolean }) => {
  return (
    <Card className={`overflow-hidden transition-all duration-300 ${isTargeted && isSelectable ? 'border-primary ring-2 ring-primary' : ''}`}>
       <div className="relative aspect-square w-full">
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
      <CardContent className="p-3">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono">
            <span>HP</span>
            <span>{monster.hp.toLocaleString()} / {monster.hp.toLocaleString()}</span>
          </div>
          <Progress value={(monster.hp / monster.hp) * 100} className="h-2 bg-red-500/20 [&>div]:bg-red-500" />
        </div>
      </CardContent>
      {isSelectable &&
        <CardFooter className="p-3 pt-0">
          <Button className="w-full" size="sm" onClick={() => onSelectTarget(monster.name)} disabled={isTargeted}>
            <Target className="mr-2 h-4 w-4" />
            {isTargeted ? '已鎖定' : '鎖定目標'}
          </Button>
        </CardFooter>
      }
    </Card>
  )
}

export default function BattlegroundPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
  const { data: userData } = useDoc<User>(userDocRef);

  const latestBattleQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'combatEncounters'), orderBy('startTime', 'desc'), limit(1)) : null),
    [firestore]
  );
  const { data: battleData, isLoading: isBattleLoading } = useCollection<CombatEncounter>(latestBattleQuery);
  const currentBattle = battleData?.[0];

  const allItemsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'items') : null), [firestore]);
  const { data: allItems } = useCollection<Item>(allItemsQuery);

  const skillsQuery = useMemoFirebase(() => {
    if (!firestore || !userData) return null;
    return query(collection(firestore, 'skills'), where('factionId', '==', userData.factionId), where('raceId', '==', userData.raceId));
  }, [firestore, userData]);
  const { data: availableSkills } = useCollection<Skill>(skillsQuery);

  // --- State Management ---
  const [supportedFaction, setSupportedFaction] = useState<'yelu' | 'association' | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [battleHP, setBattleHP] = useState(0);
  const [equippedItems, setEquippedItems] = useState<string[]>([]);
  
  // --- Computed Values & Memos ---
  const isWanderer = userData?.factionId === 'wanderer';
  const playerFaction = isWanderer ? supportedFaction : userData?.factionId;
  const combatStatus = currentBattle?.status;
  const preparationEndTime = currentBattle?.preparationEndTime?.toDate();
  const hasFallen = battleHP <= 0;

  const { inventoryEquipment, inventoryConsumables } = useMemo(() => {
    if (!userData?.items || !allItems) return { inventoryEquipment: [], inventoryConsumables: [] };
    const userItems = new Set(userData.items);
    return {
        inventoryEquipment: allItems.filter(item => userItems.has(item.id) && item.itemTypeId === 'equipment'),
        inventoryConsumables: allItems.filter(item => userItems.has(item.id) && item.itemTypeId === 'consumable')
    };
  }, [userData?.items, allItems]);
  
  const { finalAtk, finalDef } = useMemo(() => {
    let atk = userData?.attributes.atk || 0;
    let def = userData?.attributes.def || 0;

    equippedItems.forEach(itemId => {
        const item = allItems?.find(i => i.id === itemId);
        if (item) {
            item.effects?.forEach(effect => {
                if ('attribute' in effect) {
                    if (effect.attribute === 'atk' && effect.operator === '+') atk += effect.value;
                    if (effect.attribute === 'def' && effect.operator === '+') def += effect.value;
                }
            });
        }
    });
    return { finalAtk: atk, finalDef: def };
  }, [userData, equippedItems, allItems]);


  // --- Effects ---
  useEffect(() => {
    if (userData?.attributes.hp) {
      setBattleHP(userData.attributes.hp);
    }
  }, [userData?.attributes.hp]);

  useEffect(() => {
    if (combatStatus === 'active' && userData?.attributes.hp) {
      setBattleHP(userData.attributes.hp);
    }
  }, [combatStatus, userData?.attributes.hp]);

  // --- Handlers ---
  const handleSupportFaction = (factionId: 'yelu' | 'association') => {
    if (isWanderer && combatStatus !== 'ended') {
      setSupportedFaction(factionId);
      setSelectedTarget(null); // Reset target when switching factions
    }
  }
  
  const handleToggleEquip = (itemId: string) => {
    setEquippedItems(prev => {
        if (prev.includes(itemId)) {
            return prev.filter(id => id !== itemId);
        }
        if (prev.length < 2) {
            return [...prev, itemId];
        }
        return prev; // Do nothing if already 2 items are equipped
    });
  }

  // --- Render Functions ---
  const renderMonsters = (factionId: 'yelu' | 'association') => {
      const monsters = currentBattle?.monsters.filter(m => m.factionId === factionId) || [];
       return (
         <Card>
            <CardHeader>
              <CardTitle>{FACTIONS[factionId]?.name} 災獸</CardTitle>
              {combatStatus === 'active' && <CardDescription>當前回合：1 | 下一回合：20秒</CardDescription>}
            </CardHeader>
            <CardContent>
              {monsters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {monsters.map((monster, index) => (
                    <MonsterCard 
                      key={index} 
                      monster={monster}
                      isTargeted={selectedTarget === monster.name}
                      onSelectTarget={() => setSelectedTarget(monster.name)}
                      isSelectable={combatStatus === 'active' && !hasFallen}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">此陣營目前沒有災獸。</p>
              )}
            </CardContent>
          </Card>
       )
  }
  
  const renderContent = (factionId: 'yelu' | 'association') => {
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

    if (combatStatus === 'active' && playerFaction && playerFaction !== factionId) {
        return (
          <Card className="flex flex-col items-center justify-center min-h-[300px]">
              <CardHeader className="text-center">
                  <CardTitle>您正在支援另一方的戰場</CardTitle>
                  <CardDescription>請切換到您支援的陣營分頁以參與戰鬥。</CardDescription>
              </CardHeader>
          </Card>
        )
    }
        
    return (
      <div className="space-y-6">
        {/* Monster Display Area */}
        {renderMonsters(factionId)}

        {/* Log / Preparation Area */}
        {combatStatus === 'preparing' && preparationEndTime && (
          <div>
            <PreparationCountdown preparationEndTime={preparationEndTime} battleName={currentBattle.name} />
            {isWanderer && !supportedFaction && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>流浪者請注意</AlertTitle>
                <AlertDescription>共鬥開始前，請在上方選擇您想支援的陣營。</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {combatStatus === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle>共鬥紀錄</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3 text-sm font-mono">
                  <p><span className="text-primary">[回合 1]</span> 戰鬥開始！</p>
                  {hasFallen && <p className="text-red-500">[系統] 您的HP已歸零，無法繼續行動。</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                {isWanderer && (
                    <div className="mb-4 p-4 border rounded-lg">
                        <h4 className="font-bold mb-2">流浪者支援選擇</h4>
                        <p className="text-sm text-muted-foreground mb-3">選擇一個陣營進行支援。一旦選定，本次戰鬥中將無法更改。</p>
                        <div className="flex gap-4">
                            <Button onClick={() => handleSupportFaction('yelu')} variant={supportedFaction === 'yelu' ? 'default' : 'outline'} className="w-full">支援夜鷺</Button>
                            <Button onClick={() => handleSupportFaction('association')} variant={supportedFaction === 'association' ? 'default' : 'outline'} className="w-full">支援協會</Button>
                        </div>
                    </div>
                )}
                 <Tabs defaultValue="yelu" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="yelu">夜鷺戰場</TabsTrigger>
                        <TabsTrigger value="association">協會戰場</TabsTrigger>
                    </TabsList>
                    <div className="mt-4">
                       <TabsContent value="yelu">
                          {renderContent('yelu')}
                        </TabsContent>
                        <TabsContent value="association">
                           {renderContent('association')}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <Card>
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
                        <div className="flex items-center gap-2"><Sword className="h-4 w-4 text-muted-foreground"/> 攻擊力: {finalAtk}</div>
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground"/> 防禦力: {finalDef}</div>
                    </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle>行動</CardTitle>
                    <CardDescription>冷卻時間：20秒</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                    <Button disabled={combatStatus !== 'active' || !selectedTarget || hasFallen}>攻擊</Button>
                    <Button variant="outline" disabled={combatStatus !== 'active' || hasFallen}>技能</Button>
                    <Button variant="outline" disabled={combatStatus !== 'active' || hasFallen}>道具</Button>
                    <Button variant="ghost" disabled={combatStatus !== 'active' || hasFallen}>防禦</Button>
                </CardContent>
                </Card>
                
                 <Tabs defaultValue="equipment" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="equipment">裝備</TabsTrigger>
                        <TabsTrigger value="skills">技能</TabsTrigger>
                        <TabsTrigger value="items">道具</TabsTrigger>
                    </TabsList>
                     <TooltipProvider>
                        <div className="mt-4">
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
                                                     {item.effects.map((effect, i) => (
                                                        <p key={i}>{(effect as AttributeEffect).attribute.toUpperCase()} +{(effect as AttributeEffect).value}</p>
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
