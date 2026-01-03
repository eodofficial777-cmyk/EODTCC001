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
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FACTIONS } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Mock data for monsters
const mockMonsters = {
  yelu: [
    { id: 'yelu-1', name: '夜鷺先鋒', hp: 8500, maxHp: 10000, image: PlaceHolderImages.find(p => p.id === 'monster-1') },
    { id: 'yelu-2', name: '夜鷺斥候', hp: 6000, maxHp: 6000, image: PlaceHolderImages.find(p => p.id === 'monster-2') },
  ],
  association: [
    { id: 'association-1', name: '協會衛士', hp: 9200, maxHp: 10000, image: PlaceHolderImages.find(p => p.id === 'monster-3') },
  ],
}

type CombatStatus = 'closed' | 'preparing' | 'active' | 'ended';

const PreparationCountdown = ({
  preparationEndTime
}: {
  preparationEndTime: Date
}) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const difference = preparationEndTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft('00:00');
        clearInterval(interval);
        // Here you would typically trigger the next state ('active')
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
          準備期間
        </CardTitle>
        <CardDescription>共鬥將在以下時間後開始：</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-6xl font-bold font-mono text-foreground">{timeLeft}</p>
      </CardContent>
    </Card>
  );
};


const MonsterCard = ({ monster, isTargeted, onSelectTarget }: { monster: any, isTargeted: boolean, onSelectTarget: (id: string) => void }) => {
  return (
    <Card className={`overflow-hidden transition-all duration-300 ${isTargeted ? 'border-primary ring-2 ring-primary' : ''}`}>
       <div className="relative aspect-square w-full">
        {monster.image && (
          <Image
            src={monster.image.imageUrl}
            alt={monster.name}
            data-ai-hint={monster.image.imageHint}
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
            <span>{monster.hp.toLocaleString()} / {monster.maxHp.toLocaleString()}</span>
          </div>
          <Progress value={(monster.hp / monster.maxHp) * 100} className="h-2 bg-red-500/20 [&>div]:bg-red-500" />
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0">
        <Button className="w-full" size="sm" onClick={() => onSelectTarget(monster.id)} disabled={isTargeted}>
          <Target className="mr-2 h-4 w-4" />
          {isTargeted ? '已鎖定' : '鎖定目標'}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function BattlegroundPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  
  // Mock state, in a real app this would come from a global combat document in Firestore
  const [combatStatus, setCombatStatus] = useState<CombatStatus>('preparing'); 
  const [preparationEndTime, setPreparationEndTime] = useState(new Date(Date.now() + 30 * 60 * 1000));
  const [supportedFaction, setSupportedFaction] = useState<'yelu' | 'association' | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  
  const isWanderer = userData?.factionId === 'wanderer';
  const playerFaction = isWanderer ? supportedFaction : userData?.factionId;

  const handleSupportFaction = (factionId: 'yelu' | 'association') => {
    if (isWanderer && combatStatus !== 'ended') {
      setSupportedFaction(factionId);
      setSelectedTarget(null); // Reset target when switching factions
    }
  }
  
  const renderContent = () => {
    if (combatStatus === 'closed') {
      return (
        <Card className="lg:col-span-2 flex flex-col items-center justify-center min-h-[300px] bg-muted/50">
           <CardHeader className="text-center">
            <CardTitle>共鬥尚未開放</CardTitle>
            <CardDescription>請等待管理員開啟下一場戰鬥。</CardDescription>
           </CardHeader>
        </Card>
      )
    }

    if (combatStatus === 'preparing') {
        return (
            <div className="lg:col-span-2 space-y-6">
                <PreparationCountdown preparationEndTime={preparationEndTime} />
                 {isWanderer && !supportedFaction && (
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>流浪者請注意</AlertTitle>
                        <AlertDescription>
                          共鬥開始前，請在下方選擇您想支援的陣營。
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        )
    }

    if (combatStatus === 'active') {
       const factionKey = playerFaction as keyof typeof mockMonsters;
       const monsters = factionKey ? mockMonsters[factionKey] : [];

       if (!playerFaction) {
         return (
            <Card className="lg:col-span-2 flex flex-col items-center justify-center min-h-[300px]">
                <CardHeader className="text-center">
                    <CardTitle>請選擇支援陣營</CardTitle>
                    <CardDescription>身為流浪者，您需要選擇一方勢力以加入戰鬥。</CardDescription>
                </CardHeader>
            </Card>
         )
       }
        
      return (
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{FACTIONS[factionKey]?.name} 災獸</CardTitle>
              <CardDescription>當前回合：15 | 下一回合：18秒</CardDescription>
            </CardHeader>
            <CardContent>
              {monsters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {monsters.map(monster => (
                    <MonsterCard 
                      key={monster.id} 
                      monster={monster}
                      isTargeted={selectedTarget === monster.id}
                      onSelectTarget={setSelectedTarget}
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
                  {/* Log entries will go here */}
                  <p><span className="text-primary">[回合 1]</span> 戰鬥開始！</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  return (
    <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Center Column: Monster Info, Battle Log, or Status */}
            <div className="lg:col-span-2">
                <Tabs defaultValue={userData?.factionId !== 'wanderer' ? userData?.factionId : 'yelu'} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="yelu" disabled={!isWanderer && playerFaction !== 'yelu'}>夜鷺災獸</TabsTrigger>
                        <TabsTrigger value="association" disabled={!isWanderer && playerFaction !== 'association'}>協會災獸</TabsTrigger>
                    </TabsList>
                    <div className="mt-4">
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
                        <TabsContent value="yelu">
                            {playerFaction === 'yelu' ? renderContent() : <p className="text-muted-foreground text-center py-8">您未支援此陣營。</p>}
                        </TabsContent>
                        <TabsContent value="association">
                             {playerFaction === 'association' ? renderContent() : <p className="text-muted-foreground text-center py-8">您未支援此陣營。</p>}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Right Column: Player Stats and Actions */}
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
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                    <Button disabled={combatStatus !== 'active' || !selectedTarget}>攻擊</Button>
                    <Button variant="outline" disabled={combatStatus !== 'active'}>技能</Button>
                    <Button variant="outline" disabled={combatStatus !== 'active'}>道具</Button>
                    <Button variant="ghost" disabled={combatStatus !== 'active'}>防禦</Button>
                </CardContent>
                </Card>
                <Card>
                <CardHeader><CardTitle>裝備</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground text-sm">此處顯示已裝備的物品。</p></CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
