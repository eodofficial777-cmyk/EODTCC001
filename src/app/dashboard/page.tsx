'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Shield, Gem, ScrollText, Package, Check } from 'lucide-react';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import { FACTIONS, RACES } from '@/lib/game-data';
import { Skeleton } from '@/components/ui/skeleton';
import type { Item, AttributeEffect, TriggeredEffect } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { updateUser } from '../actions/update-user';
import { useToast } from '@/hooks/use-toast';


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

const itemTypeTranslations: { [key in Item['itemTypeId']]: { name: string; color: string } } = {
  equipment: { name: '裝備', color: 'bg-blue-600' },
  consumable: { name: '戰鬥道具', color: 'bg-green-600' },
  special: { name: '特殊道具', color: 'bg-purple-600' },
};

function ChangeTitleDialog({ user, userData, onTitleChanged }: { user: any, userData: any, onTitleChanged: () => void }) {
    const { toast } = useToast();
    const [selectedTitle, setSelectedTitle] = useState<string>(userData.titles?.[0] || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = async () => {
        if (!selectedTitle || selectedTitle === userData.titles?.[0]) {
            setIsOpen(false);
            return;
        }

        setIsSaving(true);
        const otherTitles = userData.titles.filter((t: string) => t !== selectedTitle);
        const newTitlesArray = [selectedTitle, ...otherTitles];

        try {
            const result = await updateUser(user.uid, { titles: newTitlesArray });
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: '您的稱號已更新！' });
            onTitleChanged(); // This should trigger a re-fetch in the parent
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: '更新失敗', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="w-full mt-2">更換稱號</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>更換顯示稱號</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <RadioGroup value={selectedTitle} onValueChange={setSelectedTitle}>
                        {(userData.titles || []).map((title: string) => (
                            <Label key={title} htmlFor={title} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent has-[[data-state=checked]]:border-primary">
                                {title}
                                <RadioGroupItem value={title} id={title} />
                            </Label>
                        ))}
                    </RadioGroup>
                </div>
                <DialogClose asChild>
                  <Button variant="ghost">取消</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "儲存中..." : "設為目前稱號"}
                </Button>
            </DialogContent>
        </Dialog>
    );
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading, mutate } = useDoc(userDocRef);

  const itemsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'items') : null), [firestore]);
  const { data: allItems, isLoading: areItemsLoading } = useCollection<Item>(itemsQuery);

  const activityLogQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, `users/${user.uid}/activityLogs`), orderBy('timestamp', 'desc'), limit(5)) : null),
    [user, firestore]
  );
  const { data: recentLogs, isLoading: isLogsLoading } = useCollection(activityLogQuery);

  const faction = userData?.factionId ? FACTIONS[userData.factionId as keyof typeof FACTIONS] : null;
  const race = userData?.raceId ? RACES[userData.raceId as keyof typeof RACES] : null;
  
  const processedInventory = useMemoFirebase(() => {
    if (!userData?.items || !allItems) return [];
    
    const itemCounts: { [id: string]: number } = userData.items.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {} as { [id: string]: number });

    return Object.keys(itemCounts).map(id => {
        const itemData = allItems.find(item => item.id === id);
        return {
            id: id,
            count: itemCounts[id],
            data: itemData
        }
    }).filter(item => item.data); // Filter out items that might not exist in allItems yet
  }, [userData?.items, allItems]);


  const isLoading = isUserLoading || isUserDataLoading || areItemsLoading;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">角色資訊</CardTitle>
            <CardDescription>您的角色概覽</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            {isLoading ? (
                <Skeleton className="h-[150px] w-[150px] rounded-full mb-4" />
            ) : (
              userData?.avatarUrl && (
                <div className="relative w-[150px] h-[150px] mb-4">
                  <Image
                    src={userData.avatarUrl}
                    alt={userData.roleName ?? '角色頭像'}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-full border-4 border-primary/50 shadow-lg"
                  />
                </div>
              )
            )}
            {isLoading ? (
                <Skeleton className="h-8 w-32 mb-1" />
            ) : (
                <h3 className="text-2xl font-bold font-headline">{userData?.roleName}</h3>
            )}
            {isLoading ? (
                <Skeleton className="h-5 w-24" />
            ) : (
                <p className="text-muted-foreground">{userData?.plurkInfo}</p>
            )}
            <div className="flex gap-2 mt-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </>
              ) : (
                <>
                  {faction && <Badge style={{ backgroundColor: faction.color, color: 'white' }}>{faction.name}</Badge>}
                  {race && <Badge variant="secondary">種族：{race.name}</Badge>}
                </>
              )}
            </div>
            <Separator className="my-4" />
             <div className="text-left w-full">
              <h4 className="font-semibold mb-2 text-center">當前稱號</h4>
               {isLoading ? <Skeleton className="h-7 w-36 mx-auto" /> : <p className="text-center text-primary text-lg font-medium">{userData?.titles?.[0] ?? '無'}</p>}
               {user && userData && <ChangeTitleDialog user={user} userData={userData} onTitleChanged={mutate} />}
            </div>
          </CardContent>
          <CardFooter>
             <Button variant="outline" className="w-full">編輯個人資料</Button>
          </CardFooter>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">資源</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-card-foreground/5">
                <div className="flex items-center gap-3">
                  <Shield className="h-7 w-7 text-primary" />
                  <span className="font-medium text-lg">榮譽點</span>
                </div>
                {isLoading ? <Skeleton className="h-7 w-24" /> : <span className="text-2xl font-bold font-mono">{userData?.honorPoints?.toLocaleString() ?? '0'}</span>}
              </div>
               <div className="flex items-center justify-between p-4 rounded-lg bg-card-foreground/5">
                <div className="flex items-center gap-3">
                  <Gem className="h-7 w-7 text-primary" />
                  <span className="font-medium text-lg">貨幣</span>
                </div>
                {isLoading ? <Skeleton className="h-7 w-24" /> : <span className="text-2xl font-bold font-mono">{userData?.currency?.toLocaleString() ?? '0'}</span>}
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">背包</CardTitle>
             <CardDescription>您目前持有的物品</CardDescription>
          </CardHeader>
          <CardContent>
             <TooltipProvider>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : processedInventory.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {processedInventory.map(({ id, count, data }) => {
                       const itemTypeInfo = data?.itemTypeId ? itemTypeTranslations[data.itemTypeId] : { name: '道具', color: 'bg-gray-500' };
                       return (
                          <Tooltip key={id}>
                            <TooltipTrigger asChild>
                              <li className="flex items-center justify-between bg-card-foreground/5 p-2 rounded-md cursor-default">
                                <div className="flex items-center gap-3">
                                  <Badge className={`${itemTypeInfo.color} text-white`}>{itemTypeInfo.name}</Badge>
                                  <span>{data?.name || '未知物品'}</span>
                                </div>
                                <span className="font-mono text-muted-foreground">x{count}</span>
                              </li>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-bold">{data?.name}</p>
                              <p className="text-xs text-muted-foreground mb-2">{data?.description}</p>
                              <Separator/>
                               <div className="mt-2 text-primary-foreground/80 bg-primary/20 p-2 rounded-md space-y-1">
                                <span className="font-semibold text-foreground">效果：</span>
                                {data?.effects && data.effects.length > 0 ? (
                                    <ul className="list-disc pl-4 text-foreground/90">
                                        {data.effects.map((effect, index) => (
                                            <li key={index}>{formatEffect(effect)}</li>
                                        ))}
                                    </ul>
                                ) : <p className="text-foreground/90">無</p>}
                               </div>
                            </TooltipContent>
                          </Tooltip>
                       )
                    })}
                  </ul>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    <Package className="mx-auto h-8 w-8 mb-2" />
                    <p>背包是空的</p>
                  </div>
                )}
             </TooltipProvider>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">紀錄</CardTitle>
            <CardDescription>您最近的活動與獲得獎勵</CardDescription>
          </CardHeader>
          <CardContent>
             {isLogsLoading || isLoading ? (
               <div className="space-y-2">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
               </div>
             ) : recentLogs && recentLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="text-right">變更</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.timestamp.toDate()).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell className="text-right font-mono">{log.change}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
             ) : (
                <div className="text-center text-muted-foreground py-8">
                  <ScrollText className="mx-auto h-10 w-10 mb-4" />
                  <p>沒有任何活動紀錄</p>
                </div>
             )}
          </CardContent>
           <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard/missions">
                <ScrollText className="mr-2"/>
                查看所有紀錄
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
    