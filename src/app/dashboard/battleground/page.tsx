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
import { Heart, Shield, Sword, Zap, Target, Timer, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FACTIONS } from '@/lib/game-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CombatEncounter } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const PreparationCountdown = ({ preparationEndTime, battleName }: { preparationEndTime: Date, battleName: string }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const difference = preparationEndTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        // In a real app, you might want to trigger a state refresh here
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
  
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
  const { data: userData } = useDoc(userDocRef);

  const latestBattleQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'combatEncounters'), orderBy('startTime', 'desc'), limit(1)) : null),
    [firestore]
  );
  const { data: battleData, isLoading: isBattleLoading } = useCollection<CombatEncounter>(latestBattleQuery);
  const currentBattle = battleData?.[0];

  const [supportedFaction, setSupportedFaction] = useState<'yelu' | 'association' | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  
  const isWanderer = userData?.factionId === 'wanderer';
  const playerFaction = isWanderer ? supportedFaction : userData?.factionId;
  
  const combatStatus = currentBattle?.status;
  const preparationEndTime = currentBattle?.preparationEndTime?.toDate();

  const handleSupportFaction = (factionId: 'yelu' | 'association') => {
    if (isWanderer && combatStatus !== 'ended') {
      setSupportedFaction(factionId);
      setSelectedTarget(null); // Reset target when switching factions
    }
  }
  
  const renderContent = (factionId: 'yelu' | 'association') => {
    if (isBattleLoading) {
      return (
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
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

    const monsters = currentBattle.monsters.filter(m => m.factionId === factionId);

    if (combatStatus === 'preparing' && preparationEndTime) {
        return (
            <div className="space-y-6">
                <PreparationCountdown preparationEndTime={preparationEndTime} battleName={currentBattle.name} />
                 {isWanderer && !supportedFaction && (
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>流浪者請注意</AlertTitle>
                        <AlertDescription>
                          共鬥開始前，請在下方選擇您想支援的陣營。
                        </AlertDescription>
                    </Alert>
                )}
                 <Card>
                  <CardHeader><CardTitle>戰場災獸</CardTitle></CardHeader>
                  <CardContent>
                    {monsters.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {monsters.map((monster, index) => (
                          <MonsterCard 
                            key={index} 
                            monster={monster}
                            isTargeted={false}
                            onSelectTarget={() => {}}
                            isSelectable={false}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">此陣營目前沒有災獸。</p>
                    )}
                  </CardContent>
                 </Card>
            </div>
        )
    }

    if (combatStatus === 'active') {

       if (!playerFaction || playerFaction !== factionId) {
         return (
            <Card className="flex flex-col items-center justify-center min-h-[300px]">
                <CardHeader className="text-center">
                    <CardTitle>請選擇支援陣營</CardTitle>
                    <CardDescription>身為流浪者，您需要選擇一方勢力以加入戰鬥。</CardDescription>
                </CardHeader>
            </Card>
         )
       }
        
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{FACTIONS[factionId]?.name} 災獸</CardTitle>
              <CardDescription>當前回合：1 | 下一回合：20秒</CardDescription>
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
                      isSelectable={true}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">此陣營目前沒有災獸。</p>
              )}
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>共鬥紀錄</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3 text-sm font-mono">
                  <p><span className="text-primary">[回合 1]</span> 戰鬥開始！</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )
    }
    
    // Default fallback
    return <p>載入中或狀態錯誤...</p>
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
                        <span className="font-mono">95 / 120</span>
                        </div>
                        <Progress value={(95/120) * 100} className="h-3 bg-green-500/20 [&>div]:bg-green-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2"><Sword className="h-4 w-4 text-muted-foreground"/> 攻擊力: 35</div>
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground"/> 防禦力: 18</div>
                    </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle>行動</CardTitle>
                    <CardDescription>冷卻時間：20秒</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                    <Button disabled={combatStatus !== 'active' || !selectedTarget}>攻擊</Button>
                    <Button variant="outline" disabled={combatStatus !== 'active'}>技能</Button>
                    <Button variant="outline" disabled={combatStatus !== 'active'}>道具</Button>
                    <Button variant="ghost" disabled={combatStatus !== 'active'}>防禦</Button>
                </CardContent>
                </Card>
                
                 <Tabs defaultValue="equipment" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="equipment">裝備</TabsTrigger>
                        <TabsTrigger value="skills">技能</TabsTrigger>
                        <TabsTrigger value="items">道具</TabsTrigger>
                    </TabsList>
                    <div className="mt-4">
                        <TabsContent value="equipment">
                            <Card><CardContent className="p-4"><p className="text-muted-foreground text-sm text-center py-4">此處顯示已裝備的物品。戰鬥準備期間可更換。</p></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="skills">
                            <Card><CardContent className="p-4"><p className="text-muted-foreground text-sm text-center py-4">此處顯示可使用的技能。</p></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="items">
                           <Card><CardContent className="p-4"><p className="text-muted-foreground text-sm text-center py-4">此處顯示可使用的道具。</p></CardContent></Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    </div>
  );
}
