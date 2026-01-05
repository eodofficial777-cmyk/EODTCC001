
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Trophy, Database, Wrench } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { resetSeason } from '@/app/actions/reset-season';
import { updateMaintenanceStatus } from '@/app/actions/update-maintenance-status';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { MaintenanceStatus } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

function ConflictManagement() {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);

  const handleResetSeason = async () => {
    setIsResetting(true);
    try {
      const result = await resetSeason();
      if (result.error) throw new Error(result.error);
      toast({
        title: '成功',
        description: '賽季已成功重置，並已封存舊賽季資料。',
      });
      // Consider adding a refresh function passed as a prop if immediate update is needed
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '重置失敗',
        description: error.message,
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
     <Card>
        <CardHeader>
            <CardTitle>陣營對抗管理</CardTitle>
            <CardDescription>
                重置陣營積分以開啟新賽季，並存檔當前賽季的結果。
            </CardDescription>
        </CardHeader>
        <CardContent>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isResetting}>
                      {isResetting ? '重置中...' : '重置賽季積分'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>您確定嗎？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此操作將會封存當前賽季的所有積分與活躍玩家資料，並開啟一個全新的賽季。此操作無法復原。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetSeason}>確定重置</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
    </Card>
  )
}

function DatabaseManagement() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const maintenanceDocRef = useMemoFirebase(() => doc(firestore, 'globals', 'maintenance'), [firestore]);
    const { data: maintenanceStatus, isLoading } = useDoc<MaintenanceStatus>(maintenanceDocRef);
    const [isSaving, setIsSaving] = useState(false);

    const handleMaintenanceToggle = async (enabled: boolean) => {
        setIsSaving(true);
        try {
            const result = await updateMaintenanceStatus(enabled);
            if (result.error) throw new Error(result.error);
            toast({
                title: '成功',
                description: `維護模式已${enabled ? '開啟' : '關閉'}。`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: '操作失敗',
                description: error.message,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> 伺服器維修模式</CardTitle>
                <CardDescription>開啟後，所有非管理員玩家將看到維修頁面，無法存取遊戲內容。</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-10 w-48" />
                ) : (
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="maintenance-mode"
                            checked={maintenanceStatus?.isMaintenance || false}
                            onCheckedChange={handleMaintenanceToggle}
                            disabled={isSaving}
                        />
                        <Label htmlFor="maintenance-mode" className={maintenanceStatus?.isMaintenance ? 'text-destructive' : 'text-green-500'}>
                            {isSaving ? '更新中...' : maintenanceStatus?.isMaintenance ? '維修模式已開啟' : '維修模式已關閉'}
                        </Label>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function HistoryPage() {
  const [archivedSeasons, setArchivedSeasons] = useState<ArchivedSeason[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<ArchivedSeason | null>(null);
  
  const yeluMVP = useMemo(() => {
    if (!selectedSeason) return null;
    // This is a placeholder, real implementation would need to fetch task logs for the period
    return selectedSeason.yelu.activePlayers[0] || "N/A";
  }, [selectedSeason]);

  const associationMVP = useMemo(() => {
    if (!selectedSeason) return null;
    // Placeholder
    return selectedSeason.association.activePlayers[0] || "N/A";
  }, [selectedSeason]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const archiveResult = await getArchivedSeasons();
      if (archiveResult.error) throw new Error(archiveResult.error);
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
        <Tabs defaultValue="history">
            <TabsList className="grid grid-cols-2">
                <TabsTrigger value="history">歷史賽季</TabsTrigger>
                <TabsTrigger value="database">資料庫與維護</TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-4">
                <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="font-headline text-2xl">過往月度紀錄</CardTitle>
                        <Button onClick={fetchData} variant="ghost" size="icon" disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                      <CardDescription>查看過往賽季的戰績與貢獻 MVP。</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                <TableHead className="text-right">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {archivedSeasons.map(season => (
                                <TableRow key={season.id}>
                                  <TableCell>{new Date(season.archivedAt).toLocaleDateString()}</TableCell>
                                  <TableCell>{season.yelu?.rawScore.toLocaleString() ?? 0}</TableCell>
                                  <TableCell>{season.association?.rawScore.toLocaleString() ?? 0}</TableCell>
                                  <TableCell className="text-center">{getWinnerBadge(season)}</TableCell>
                                  <TableCell className="text-right">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="sm" onClick={() => setSelectedSeason(season)}>查詢貢獻 MVP</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>當期貢獻 MVP</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    此處顯示在 {selectedSeason && new Date(selectedSeason.archivedAt).toLocaleDateString()} 結算的賽季中，各陣營貢獻最高的玩家。此功能目前僅供查詢。
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            {selectedSeason && (
                                                <div className="grid grid-cols-2 gap-4 py-4">
                                                    <div className="flex flex-col items-center gap-2 p-4 rounded-md border">
                                                        <h4 className="font-semibold" style={{color: FACTIONS.yelu.color}}>夜鷺 MVP</h4>
                                                        <p className="font-mono">{yeluMVP}</p>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2 p-4 rounded-md border">
                                                        <h4 className="font-semibold" style={{color: FACTIONS.association.color}}>協會 MVP</h4>
                                                        <p className="font-mono">{associationMVP}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>關閉</AlertDialogCancel>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                  </TableCell>
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
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="database" className="mt-4 space-y-6">
                <ConflictManagement />
                <DatabaseManagement />
            </TabsContent>
        </Tabs>
    </div>
  );
}
