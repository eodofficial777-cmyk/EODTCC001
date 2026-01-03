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
import { Gem } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Item, AttributeEffect, TriggeredEffect } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

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


export default function StorePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);
  
  const userFactionId = userData?.factionId;

  const itemsQuery = useMemoFirebase(
    () =>
      firestore && userFactionId && userFactionId !== 'wanderer'
        ? query(
            collection(firestore, 'items'),
            where('factionId', '==', userFactionId),
            where('isPublished', '==', true)
          )
        : null,
    [firestore, userFactionId]
  );

  const { data: items, isLoading: areItemsLoading } = useCollection<Item>(itemsQuery);

  const isLoading = isUserLoading || isUserDataLoading || areItemsLoading;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {isLoading && Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
            <CardHeader>
                <Skeleton className="h-40 w-full mb-4"/>
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

      {!isLoading && (userFactionId === 'wanderer' || !items || items.length === 0) && (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center text-muted-foreground py-16">
              <h3 className="text-xl font-semibold">商店目前沒有商品</h3>
              <p>{userFactionId === 'wanderer' ? '流浪者沒有專屬商店。' : '您所屬的陣營目前沒有任何上架的商品。'}</p>
          </div>
      )}

      {!isLoading && items && items.map((item) => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader>
              <div className="relative h-40 w-full mb-4">
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
                 {item.itemTypeId && <Badge className="absolute top-2 right-2">{item.itemTypeId}</Badge>}
              </div>
              <CardTitle className="font-headline">{item.name}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
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
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-mono text-lg font-bold text-primary">
                <Gem className="h-4 w-4" />
                {item.price.toLocaleString()}
              </div>
              <Button>購買</Button>
            </CardFooter>
          </Card>
        )
      )}
    </div>
  );
}
