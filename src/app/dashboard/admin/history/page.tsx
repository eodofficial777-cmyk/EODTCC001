
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { RefreshCw, Trophy, Database, Wrench, UserPlus } from 'lucide-react';
import { getArchivedSeasons, getSeasonMvpDetails, ArchivedSeason } from '@/app/actions/get-archived-seasons';
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
import { updateRegistrationStatus } from '@/app/actions/update-registration-status';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { MaintenanceStatus, RegistrationStatus } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

function ConflictManagement({ onActionComplete }: { onActionComplete: () => void }) {
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
      onActionComplete();
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
                重置陣營積分以開啟新賽季，並存檔當前賽季的結果。此動作會將目前的原始分數與玩家列表封存，並計算加權分數後一併儲存。
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

function SystemSettingsManagement() {
    const { toast } = useToast();
    const firestore = useFirestore();
    
    const maintenanceDocRef = useMemoFirebase(() => doc(firestore, 'globals', 'maintenance'), [firestore]);
    const { data: maintenanceStatus, isLoading: isMaintenanceLoading } = useDoc<MaintenanceStatus>(maintenanceDocRef);
    
    const registrationDocRef = useMemoFirebase(() => doc(firestore, 'globals', 'registration'), [firestore]);
    const { data: registrationStatus, isLoading: isRegistrationLoading } = useDoc<RegistrationStatus>(registrationDocRef);
    
    const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

    const handleStatusToggle = async (type: 'maintenance' | 'registration', enabled: boolean) => {
        setIsSaving(prev => ({ ...prev, [type]: true }));
        try {
            let result;
            if (type === 'maintenance') {
                 result = await updateMaintenanceStatus(enabled);
            } else {
                 result = await updateRegistrationStatus(enabled);
            }
            if (result.error) throw new Error(result.error);
            toast({
                title: '成功',
                description: `${type === 'maintenance' ? '維護模式' : '註冊功能'}已${enabled ? '開啟' : '關閉'}。`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: '操作失敗',
                description: error.message,
            });
        } finally {
            setIsSaving(prev => ({ ...prev, [type]: false }));
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> 伺服器與系統設定</CardTitle>
                <CardDescription>管理伺服器維護模式與新玩家註冊功能。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {isMaintenanceLoading ? (
                    <Skeleton className="h-10 w-48" />
                ) : (
                    <div className="flex items-center space-x-4 p-4 border rounded-lg">
                        <Wrench className="h-6 w-6 text-muted-foreground" />
                        <div className="flex-1">
                             <Label htmlFor="maintenance-mode" className="font-semibold">維修模式</Label>
                             <p className="text-xs text-muted-foreground">開啟後，所有非管理員玩家將看到維修頁面。</p>
                        </div>
                        <Switch
                            id="maintenance-mode"
                            checked={maintenanceStatus?.isMaintenance || false}
                            onCheckedChange={(checked) => handleStatusToggle('maintenance', checked)}
                            disabled={isSaving['maintenance']}
                        />
                    </div>
                )}
                 {isRegistrationLoading ? (
                    <Skeleton className="h-10 w-48" />
                ) : (
                    <div className="flex items-center space-x-4 p-4 border rounded-lg">
                        <UserPlus className="h-6 w-6 text-muted-foreground" />
                        <div className="flex-1">
                             <Label htmlFor="registration-mode" className="font-semibold">註冊功能</Label>
                             <p className="text-xs text-muted-foreground">關閉後，登入頁面將隱藏註冊表單。</p>
                        </div>
                        <Switch
                            id="registration-mode"
                            checked={registrationStatus?.isOpen ?? true}
                            onCheckedChange={(checked) => handleStatusToggle('registration', checked)}
                            disabled={isSaving['registration']}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function HistoryPage() {
  const { toast } = useToast();
  const [archivedSeasons, setArchivedSeasons] = useState<ArchivedSeason[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<ArchivedSeason | null>(null);
  const [mvpDetails, setMvpDetails] = useState<Record<string, string>>({});
  const [isMvpLoading, setIsMvpLoading] = useState(false);
  
  const yeluMVP = useMemo(() => {
    if (!selectedSeason || !mvpDetails) return "N/A";
    const mvpId = selectedSeason.yelu.mvp;
    return mvpId ? (mvpDetails[mvpId] || mvpId) : "N/A";
  }, [selectedSeason, mvpDetails]);

  const associationMVP = useMemo(() => {
    if (!selectedSeason || !mvpDetails) return "N/A";
    const mvpId = selectedSeason.association.mvp;
    return mvpId ? (mvpDetails[mvpId] || mvpId) : "N/A";
  }, [selectedSeason, mvpDetails]);

  const fetchMvpData = useCallback(async (season: ArchivedSeason | null) => {
    if (!season) return;
    
    const playerIds = [season.yelu.mvp, season.association.mvp].filter((id): id is string => !!id);
    if (playerIds.length === 0) {
      setMvpDetails({});
      return;
    }

    setIsMvpLoading(true);
    try {
      const { players, error } = await getSeasonMvpDetails(playerIds);
      if (error) {
        toast({ variant: 'destructive', title: '獲取 MVP 資料失敗', description: error });
      } else {
        setMvpDetails(players);
      }
    } catch(e: any) {
        toast({ variant: 'destructive', title: '獲取 MVP 資料失敗', description: e.message });
    } finally {
        setIsMvpLoading(false);
    }
  }, [toast]);
  
  const handleMvpModalOpen = (season: ArchivedSeason) => {
    setSelectedSeason(season);
    fetchMvpData(season);
  };

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getWinnerBadge = (season: ArchivedSeason) => {
    const yeluScore = season.yelu?.weightedScore ?? season.yelu?.rawScore ?? 0;
    const associationScore = season.association?.weightedScore ?? season.association?.rawScore ?? 0;

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
                <TabsTrigger value="database">資料庫與系統</TabsTrigger>
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
                      <CardDescription>查看過往賽季的戰績與貢獻 MVP。分數已根據人數進行加權。</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="border rounded-md">
                        {isLoading ? <Skeleton className="h-48 w-full"/> : 
                         archivedSeasons && archivedSeasons.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>紀錄結束日期</TableHead>
                                <TableHead>夜鷺分數 (加權)</TableHead>
                                <TableHead>協會分數 (加權)</TableHead>
                                <TableHead className="text-center">當期贏家</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {archivedSeasons.map(season => (
                                <TableRow key={season.id}>
                                  <TableCell>{new Date(season.archivedAt).toLocaleDateString()}</TableCell>
                                  <TableCell>{(season.yelu?.weightedScore ?? season.yelu?.rawScore ?? 0).toLocaleString()}</TableCell>
                                  <TableCell>{(season.association?.weightedScore ?? season.association?.rawScore ?? 0).toLocaleString()}</TableCell>
                                  <TableCell className="text-center">{getWinnerBadge(season)}</TableCell>
                                  <TableCell className="text-right">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="sm" onClick={() => handleMvpModalOpen(season)}>查詢貢獻 MVP</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>當期貢獻 MVP</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    此處顯示在 {selectedSeason && new Date(selectedSeason.archivedAt).toLocaleDateString()} 結算的賽季中，各陣營貢獻最高的玩家。
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            {isMvpLoading ? <Skeleton className="h-24 w-full"/> : selectedSeason && (
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
                <ConflictManagement onActionComplete={fetchData} />
                <SystemSettingsManagement />
            </TabsContent>
        </Tabs>
    </div>
  );
}
