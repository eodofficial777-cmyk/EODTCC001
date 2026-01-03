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
import { Badge } from '@/components/ui/badge';
import { Gem, Users } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Item, AttributeEffect, TriggeredEffect } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RACES } from '@/lib/game-data';
import { useToast } from '@/hooks/use-toast';
import { buyItem } from '@/app/actions/buy-item';
import { useState } from 'react';

function formatEffect(effect: AttributeEffect | TriggeredEffect): string {
    if ('attribute' in effect) { // AttributeEffect
        const op = effect.operator === 'd' ? `d${effect.value}` : `${effect.operator} ${effect.value}`;
        return `${effect.attribute.toUpperCase()} ${op}`;
    }
    // TriggeredEffect
    let desc = `${effect.probability}%機率`;
    switch(effect.effectType) {
        case 'hp_recovery':
            desc += `恢復 ${effect.value} HP`;
            break;
        case 'damage_enemy':
            desc += `造成 ${effect.value} 點傷害`;
            break;
        case 'atk_buff':
            desc += `提升攻擊力 ${effect.value}%`;
            break;
        case 'def_buff':
            desc += `提升防禦力 ${effect.value}%`;
            break;
        case 'hp_cost':
            desc += `消耗 ${effect.value} HP`;
            break;
    }
    if (effect.duration) {
        desc += `，持續 ${effect.duration} 回合`;
    }
    return desc;
}

const itemTypeTranslations: { [key in Item['itemTypeId']]: string } = {
  equipment: '裝備',
  consumable: '戰鬥道具',
  special: '特殊道具',
};


export default function StorePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isBuying, setIsBuying] = useState<Record<string, boolean>>({});

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);
  
  const userFactionId = userData?.factionId;

  const itemsQuery = useMemoFirebase(() => {
    if (!firestore || !userFactionId) {
      return null;
    }
    // Wanderers can see 'wanderer' items, others see their specific faction items.
    const factionsToShow = ['wanderer'];
    if (userFactionId !== 'wanderer') {
        factionsToShow.push(userFactionId);
    }
    
    return query(
      collection(firestore, 'items'),
      where('factionId', 'in', factionsToShow),
      where('isPublished', '==', true)
    );
  }, [firestore, userFactionId]);


  const { data: items, isLoading: areItemsLoading } = useCollection<Item>(itemsQuery);

  const handleBuy = async (item: Item) => {
    if (!user || !userData) {
      toast({ variant: 'destructive', title: '請先登入' });
      return;
    }

    setIsBuying(prev => ({...prev, [item.id]: true}));
    try {
      const result = await buyItem({ userId: user.uid, itemId: item.id });
      if (result.error) {
        throw new Error(result.error);
      }
      toast({ title: '購買成功！', description: `「${item.name}」已加入您的背包。`});
      // The useDoc hook will automatically update userData, no manual refetch is needed.
    } catch(error: any) {
      toast({ variant: 'destructive', title: '購買失敗', description: error.message });
    } finally {
      setIsBuying(prev => ({...prev, [item.id]: false}));
    }
  }

  const isLoading = isUserLoading || isUserDataLoading || areItemsLoading;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {isLoading && Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
            <CardHeader>
                <Skeleton className="aspect-square w-full mb-4"/>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow"></CardContent>
            <CardFooter className="flex justify-between items-center">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-10 w-24" />
            </CardFooter>
        </Card>
      ))}

      {!isLoading && (!items || items.length === 0) && (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center text-muted-foreground py-16">
              <h3 className="text-xl font-semibold">商店目前沒有商品</h3>
              <p>您所屬的陣營目前沒有任何上架的商品。</p>
          </div>
      )}

      {!isLoading && items && userData && items.map((item) => {
        const raceName = item.raceId === 'all' ? '通用' : RACES[item.raceId as keyof typeof RACES]?.name || '未知';
        const itemTypeName = itemTypeTranslations[item.itemTypeId] || '道具';
        const canAfford = userData.currency >= item.price;
        const meetsRaceRequirement = item.raceId === 'all' || userData.raceId === item.raceId;
        const canBuy = canAfford && meetsRaceRequirement && !isBuying[item.id];
        
        let disabledTooltip = '';
        if (!canAfford) disabledTooltip = '貨幣不足';
        else if (!meetsRaceRequirement) disabledTooltip = '種族不符';

        return (
          <Card key={item.id} className="flex flex-col">
            <CardHeader>
              <div className="relative aspect-square w-full mb-4">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover rounded-md"
                  />
                ) : (
                    <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">沒有圖片</span>
                    </div>
                )}
                 <Badge className="absolute top-2 right-2">{itemTypeName}</Badge>
              </div>
              <CardTitle className="font-headline">{item.name}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
               <div className="text-sm text-primary-foreground/80 bg-primary/20 p-2 rounded-md space-y-1">
                <span className="font-semibold">效果：</span>
                {item.effects && item.effects.length > 0 ? (
                    <ul className="list-disc pl-4">
                        {item.effects.map((effect, index) => (
                            <li key={index}>{formatEffect(effect)}</li>
                        ))}
                    </ul>
                ) : <p>無</p>}
               </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                    <Users className="h-4 w-4" />
                    <span>種族限制：{raceName}</span>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-mono text-lg font-bold text-primary">
                <Gem className="h-4 w-4" />
                {item.price.toLocaleString()}
              </div>
              <Button onClick={() => handleBuy(item)} disabled={!canBuy} title={disabledTooltip}>
                {isBuying[item.id] ? '處理中...' : '購買'}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  );
}
