'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Trophy } from 'lucide-react';
import { getConflictData, ConflictData } from '@/app/actions/get-conflict-data';
import { getArchivedSeasons, ArchivedSeason } from '@/app/actions/get-archived-seasons';
import { FACTIONS } from '@/lib/game-data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


function FactionDisplay({ factionData, totalScore }: { factionData: any; totalScore: number }) {
    if (!factionData) return null;
    const factionInfo = FACTIONS[factionData.id as keyof typeof FACTIONS];

    return (
        <div className="flex flex-col items-center gap-2">
            <h3 className="text-2xl font-bold font-headline" style={{ color: factionInfo.color }}>
                {factionInfo.name}
            </h3>
            <p>活躍人數：{factionData.activePlayers}</p>
            <p>陣營加權：x{factionData.weight.toFixed(2)}</p>
            <div 
                className="w-full text-center text-2xl font-bold py-2 rounded"
                style={{ backgroundColor: `${factionInfo.color}33`}}
            >
                {Math.round(factionData.weightedScore).toLocaleString()}
            </div>
        </div>
    )
}

export default function ConflictPage() {
  const [data, setData] = useState<ConflictData | null>(null);
  const [archivedSeasons, setArchivedSeasons] = useState<ArchivedSeason[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [conflictResult, archiveResult] = await Promise.all([
        getConflictData(),
        getArchivedSeasons()
      ]);
      
      if (conflictResult.error) throw new Error(conflictResult.error);
      if (archiveResult.error) throw new Error(archiveResult.error);

      setData(conflictResult.data || null);
      setArchivedSeasons(archiveResult.seasons || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const yelu = data?.yelu;
  const association = data?.association;
  const totalWeightedScore = (yelu?.weightedScore ?? 0) + (association?.weightedScore ?? 0);
  const yeluPercentage = totalWeightedScore > 0 ? (yelu?.weightedScore ?? 0) / totalWeightedScore * 100 : 50;

  const getWinnerBadge = (season: ArchivedSeason) => {
    const yeluScore = season.yelu?.rawScore ?? 0;
    const associationScore = season.association?.rawScore ?? 0;
    if (yeluScore > associationScore) {
      return <Badge style={{ backgroundColor: FACTIONS.yelu.color, color: 'white' }}>夜鷺</Badge>;
    }
    if (associationScore > yeluScore) {
      return <Badge style={{ backgroundColor: FACTIONS.association.color, color: 'white' }}>協會</Badge>;
    }
    return <Badge variant="secondary">平手</Badge>;
  }

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="font-headline text-3xl">陣營發展情形</CardTitle>
            <div className="flex items-center gap-4">
                <Button onClick={fetchData} variant="ghost" size="icon" disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-24 w-full"/>
                    <Skeleton className="h-10 w-full"/>
                    <Skeleton className="h-8 w-3/4 mx-auto"/>
                </div>
            ) : error ? (
                <div className="text-center text-destructive">{error}</div>
            ) : data && yelu && association ? (
            <>
                <div className="grid grid-cols-2 gap-8">
                    <FactionDisplay factionData={yelu} totalScore={totalWeightedScore}/>
                    <FactionDisplay factionData={association} totalScore={totalWeightedScore}/>
                </div>

                <div className="w-full bg-muted rounded-full h-8 flex overflow-hidden border border-border">
                    <div 
                        className="h-full flex items-center justify-start pl-4" 
                        style={{ width: `${yeluPercentage}%`, backgroundColor: FACTIONS.yelu.color, transition: 'width 0.5s ease-in-out' }}
                    >
                    </div>
                     <div 
                        className="h-full flex items-center justify-end pr-4" 
                        style={{ width: `${100 - yeluPercentage}%`, backgroundColor: FACTIONS.association.color, transition: 'width 0.5s ease-in-out' }}
                    >
                    </div>
                </div>

                 <div className="text-center bg-black/30 p-4 rounded-md text-sm text-muted-foreground">
                    <p className="font-mono font-bold text-foreground">加權分數 = 該陣營累計榮譽點 × (總活躍人數) ÷ 該陣營活躍人數</p>
                    <p className="mt-1">說明：人數較少的陣營將獲得較高的積分加權，以平衡戰局。活躍人數指當期繳交過任務的玩家。</p>
                </div>
            </>
            ) : (
                 <div className="text-center text-muted-foreground py-10">暫無資料</div>
            )}


            <div>
                <h4 className="font-headline text-xl mb-4 text-center">過往月度紀錄</h4>
                <div className="border rounded-md">
                {isLoading ? <Skeleton className="h-48 w-full"/> : 
                 archivedSeasons && archivedSeasons.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>紀錄結束日期</TableHead>
                        <TableHead>夜鷺分數</TableHead>
                        <TableHead>協會分數</TableHead>
                        <TableHead className="text-center">當期贏家</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedSeasons.map(season => (
                        <TableRow key={season.id}>
                          <TableCell>{new Date(season.archivedAt).toLocaleDateString()}</TableCell>
                          <TableCell>{season.yelu?.rawScore.toLocaleString() ?? 0}</TableCell>
                          <TableCell>{season.association?.rawScore.toLocaleString() ?? 0}</TableCell>
                          <TableCell className="text-center">{getWinnerBadge(season)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <Trophy className="mx-auto h-8 w-8 mb-2" />
                    沒有過往月度紀錄
                  </div>
                )}
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
