'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FACTIONS, RACES } from '@/lib/game-data';
import { getRosterData } from '@/app/actions/get-roster-data';
import type { User } from '@/lib/types';
import { RefreshCw, Terminal, Crown, Shield, User as UserIcon, WandSparkles, Bird, Users } from 'lucide-react';

function CharacterCard({ user }: { user: User }) {
  const race = RACES[user.raceId as keyof typeof RACES];
  const title = user.titles?.[0] || '無';
  const faction = FACTIONS[user.factionId as keyof typeof FACTIONS];

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <Dialog>
          <DialogTrigger asChild>
            <div className="relative aspect-square w-32 flex-shrink-0 cursor-pointer">
              <Image
                src={user.avatarUrl}
                alt={user.roleName}
                fill
                className="object-cover transition-transform duration-300 hover:scale-110"
              />
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-0">
            <DialogHeader className="p-4">
              <DialogTitle>{user.roleName} 的角色卡</DialogTitle>
            </DialogHeader>
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={user.characterSheetUrl}
                alt={`${user.roleName} character sheet`}
                fill
                className="object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
        <CardContent className="flex flex-1 flex-col justify-center p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-headline truncate">{user.roleName}</h3>
            {faction && <Badge style={{ backgroundColor: faction.color, color: 'white' }}>{faction.name}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1"><span>{race?.name || user.raceId}</span></div>
            <Badge variant="outline">{title}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm mt-3">
            <Link href={user.plurkInfo} target="_blank" rel="noopener noreferrer">
              <Button variant="link" className="p-0 h-auto text-xs">
                噗浪
              </Button>
            </Link>
            <Badge variant="outline" className="font-mono flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {user.honorPoints.toLocaleString()}
            </Badge>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function CharacterGrid({ users }: { users: User[] | undefined }) {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>該分類目前沒有任何角色。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {users.map((user) => (
        <CharacterCard key={user.id} user={user} />
      ))}
    </div>
  );
}

export default function RosterPage() {
  const [allUsers, setAllUsers] = useState<User[] | null>(null);
  const [rosterData, setRosterData] = useState<Record<string, User[]> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  
  const fetchRoster = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getRosterData();
      if (result.error) throw new Error(result.error);
      setAllUsers(result.allUsers || []);
      setRosterData(result.rosterByFaction || {});
      setCacheTimestamp(result.cacheTimestamp || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const factionTabs = [
    { id: 'all', name: '全體' },
    ...Object.values(FACTIONS)
  ];

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <CardTitle className="font-headline">角色名冊</CardTitle>
          <CardDescription>
            搜尋和篩選所有已批准的角色。資料每 5 分鐘更新一次。
          </CardDescription>
          {cacheTimestamp && !isLoading && <p className="text-xs text-muted-foreground mt-1">當前資料版本：{cacheTimestamp}</p>}
        </div>
        <Button onClick={fetchRoster} variant="ghost" size="icon" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
     
      {error && (
          <Alert variant="destructive" className="mb-4">
              <Terminal className="h-4 w-4" />
              <AlertTitle>讀取失敗</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}

      {!error && (
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {factionTabs.map((faction) => (
            <TabsTrigger key={faction.id} value={faction.id}>
              {faction.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-24 w-24 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <>
            <TabsContent value="all" className="mt-6">
              <CharacterGrid users={allUsers || []} />
            </TabsContent>
            {Object.values(FACTIONS).map((faction) => (
              <TabsContent key={faction.id} value={faction.id} className="mt-6">
                <CharacterGrid users={rosterData?.[faction.id]} />
              </TabsContent>
            ))}
          </>
        )}
      </Tabs>
      )}
  </div>
  );
}
