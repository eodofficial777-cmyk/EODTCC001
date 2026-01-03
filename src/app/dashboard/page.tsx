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
import { Shield, Gem, Heart, Sword, Brain, Zap, Dna, User as UserIcon } from 'lucide-react';
import { useDoc, useFirebase, useUser, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
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

  const stats = [
    { name: 'HP', value: userData?.attributes?.hp ?? 0, icon: Heart },
    { name: '攻擊力', value: userData?.attributes?.atk ?? 0, icon: Sword },
    { name: '防禦力', value: userData?.attributes?.def ?? 0, icon: UserIcon },
    { name: '智力', value: userData?.attributes?.intel ?? 0, icon: Brain },
    { name: '敏捷', value: userData?.attributes?.agi ?? 0, icon: Zap },
  ];

  const resources = [
    { name: '榮譽點', value: userData?.honorPoints?.toLocaleString() ?? '0', icon: Shield },
    { name: '貨幣', value: userData?.currency?.toLocaleString() ?? '0', icon: Gem },
  ];

  const recentMissions = [
    { id: 'M001', name: '首篇故事', date: '2024-07-20', status: '已批准', points: 100 },
    { id: 'M002', name: '陣營插畫', date: '2024-07-22', status: '審核中', points: 0 },
    { id: 'M003', name: '角色二創', date: '2024-07-25', status: '已批准', points: 50 },
  ];
  
  const equipment = [
    { slot: "武器", name: "初始長劍"},
    { slot: "盾牌", name: "無"},
    { slot: "頭部", name: "無"},
    { slot: "身體", name: "布衣"},
    { slot: "飾品", name: "新兵臂章"},
  ];

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
                  {faction && <Badge variant="secondary">陣營：{faction.name}</Badge>}
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
            <CardTitle className="font-headline">資源</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resources.map((res) => (
              <div key={res.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <res.icon className="h-6 w-6 text-primary" />
                  <span className="font-medium">{res.name}</span>
                </div>
                {isLoading ? <Skeleton className="h-7 w-20" /> : <span className="text-xl font-bold font-mono">{res.value}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
           <Card>
            <CardHeader>
              <CardTitle className="font-headline">屬性</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.name} className="flex items-center gap-3 bg-card-foreground/5 p-3 rounded-lg">
                  <stat.icon className="h-6 w-6 text-accent-foreground/70" />
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                     {isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold font-mono">{stat.value}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">裝備</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {equipment.map(item => (
                  <li key={item.slot} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.slot}:</span>
                    <span className="font-medium">{item.name}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">近期任務</CardTitle>
            <CardDescription>您最近提交的任務及其狀態</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任務名稱</TableHead>
                  <TableHead>提交日期</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">榮譽點</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMissions.map((mission) => (
                  <TableRow key={mission.id}>
                    <TableCell className="font-medium">{mission.name}</TableCell>
                    <TableCell>{mission.date}</TableCell>
                    <TableCell>
                       <Badge
                        variant={mission.status === '已批准' ? 'default' : 'secondary'}
                        className={mission.status === '已批准' ? 'bg-green-600/20 text-green-400 border-green-600/30' : 'bg-amber-600/20 text-amber-400 border-amber-600/30'}
                      >
                        {mission.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">+{mission.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard/missions">提交新任務</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

    