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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Shield, Gem, ScrollText, Package } from 'lucide-react';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { FACTIONS, RACES } from '@/lib/game-data';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);

  const faction = userData?.factionId ? FACTIONS[userData.factionId as keyof typeof FACTIONS] : null;
  const race = userData?.raceId ? RACES[userData.raceId as keyof typeof RACES] : null;

  const recentLogs = [
    { id: 'L001', description: '提交「首篇故事」任務', change: '+100 榮譽點', date: '2024-07-20' },
    { id: 'L002', description: '管理員發放週末獎勵', change: '+500 貨幣', date: '2024-07-22' },
    { id: 'L003', description: '獲得稱號「初入荒漠」', change: '稱號', date: '2024-07-25' },
    { id: 'L004', description: '從商店購買「回復藥水」', change: '-100 貨幣', date: '2024-07-26' },
  ];
  
  const inventory = userData?.items ?? [];

  const isLoading = isUserLoading || isUserDataLoading;

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
                <Image
                  src={userData.avatarUrl}
                  alt={userData.roleName ?? '角色頭像'}
                  width={150}
                  height={150}
                  className="rounded-full border-4 border-primary/50 shadow-lg mb-4"
                />
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
              <Button size="sm" variant="outline" className="w-full mt-2">更換稱號</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">背包</CardTitle>
             <CardDescription>您目前持有的物品</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : inventory.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {inventory.map((item, index) => (
                  <li key={index} className="flex items-center justify-between bg-card-foreground/5 p-2 rounded-md">
                    <span>{item}</span> 
                    <Badge variant="outline">道具</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <Package className="mx-auto h-8 w-8 mb-2" />
                <p>背包是空的</p>
              </div>
            )}
          </CardContent>
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
            <CardTitle className="font-headline">紀錄</CardTitle>
            <CardDescription>您最近的活動與獲得獎勵</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? (
               <div className="space-y-2">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
               </div>
             ) : (
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
                      <TableCell className="text-muted-foreground">{log.date}</TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell className="text-right font-mono">{log.change}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
