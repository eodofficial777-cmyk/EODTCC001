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
import { FACTIONS } from '@/lib/game-data';
import { getRosterData } from '@/app/actions/get-roster-data';
import type { User } from '@/lib/types';
import { RefreshCw, Terminal } from 'lucide-react';

function CharacterCard({ user }: { user: User }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <Dialog>
        <DialogTrigger asChild>
          <div className="relative aspect-square w-full cursor-pointer">
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
      <CardContent className="flex-grow p-4">
        <h3 className="text-lg font-bold font-headline truncate">{user.roleName}</h3>
        <div className="flex items-center justify-between text-sm mt-2">
            <Link href={user.plurkInfo} target="_blank" rel="noopener noreferrer">
              <Button variant="link" className="p-0 h-auto">
                噗浪
              </Button>
            </Link>
            <Badge variant="outline" className="font-mono">
              榮譽 {user.honorPoints.toLocaleString()}
            </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RosterPage() {
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

  const factionTabs = Object.values(FACTIONS);

  return (
    <div className="w-full">
        <CardHeader className="px-0">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline">角色名冊</CardTitle>
              <CardDescription>
                搜尋和篩選所有已批准的角色。資料於每日凌晨 0 點更新。
              </CardDescription>
              {cacheTimestamp && !isLoading && <p className="text-xs text-muted-foreground mt-1">當前資料版本：{cacheTimestamp}</p>}
            </div>
            <Button onClick={fetchRoster} variant="ghost" size="icon" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
       
        {error && (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>讀取失敗</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {!error && (
        <Tabs defaultValue={factionTabs[0].id}>
          <TabsList className="grid w-full grid-cols-3">
            {factionTabs.map((faction) => (
              <TabsTrigger key={faction.id} value={faction.id}>
                {faction.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {factionTabs.map((faction) => (
            <TabsContent key={faction.id} value={faction.id} className="mt-6">
              {isLoading ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square w-full" />
                    ))}
                 </div>
              ) : rosterData && rosterData[faction.id]?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {rosterData[faction.id].map((user) => (
                    <CharacterCard key={user.id} user={user} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p>該陣營目前沒有任何角色。</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        )}
    </div>
  );
}
