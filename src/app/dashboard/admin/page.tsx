
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getAdminData } from '@/app/actions/get-admin-data';
import { updateUser } from '@/app/actions/update-user';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FACTIONS, RACES } from '@/lib/game-data';
import { RefreshCw, Trash2, Edit, Plus, X, Hammer, ArrowRight, WandSparkles, Check, ThumbsUp, ThumbsDown, PackagePlus, Wrench, History, Award, KeyRound, BarChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import Image from 'next/image';
import type { User, Task, TaskType, Item, AttributeEffect, TriggeredEffect, CraftRecipe, Skill, SkillEffect, SkillEffectType, Title, TitleTrigger, TitleTriggerType, MaintenanceStatus, Monster, CombatEncounter, CombatLog, EndOfBattleRewards } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { updateTaskType } from '@/app/actions/update-task-type';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { updateItem } from '@/app/actions/update-item';
import { resetSeason } from '@/app/actions/reset-season';
import { updateCraftRecipe } from '@/app/actions/update-craft-recipe';
import { updateSkill } from '@/app/actions/update-skill';
import { updateTitle } from '@/app/actions/update-title';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateTaskStatus } from '@/app/actions/update-task-status';
import { Badge } from '@/components/ui/badge';
import { distributeRewards, FilterCriteria } from '@/app/actions/distribute-rewards';
import { ScrollArea } from '@/components/ui/scroll-area';
import { updateMaintenanceStatus } from '@/app/actions/update-maintenance-status';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import { createBattle, startBattle, endBattle, addMonsterToBattle } from '@/app/actions/manage-battle';
import { getBattleLogs } from '@/app/actions/get-battle-logs';
import { awardBattleDamageRewards } from '@/app/actions/award-battle-damage-rewards';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { resetUserPassword } from '@/app/actions/reset-user-password';


function PasswordResetDialog({ user, isOpen, onOpenChange }: { user: User, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleReset = async () => {
        if (newPassword.length < 6) {
            toast({ variant: 'destructive', title: '錯誤', description: '新密碼長度至少需要 6 個字元。' });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: '錯誤', description: '兩次輸入的密碼不一致。' });
            return;
        }

        setIsSaving(true);
        try {
            const result = await resetUserPassword({ userId: user.id, newPassword });
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: `玩家 ${user.roleName} 的密碼已成功重設。` });
            setNewPassword('');
            setConfirmPassword('');
            onOpenChange(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: '重設失敗', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>重設玩家密碼</DialogTitle>
                    <DialogDescription>正在為玩家「{user.roleName}」設定新密碼。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">新密碼 (至少6個字元)</Label>
                        <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">確認新密碼</Label>
                        <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleReset} disabled={isSaving}>
                        {isSaving ? '處理中...' : '確認重設'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AccountApproval() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [resettingUser, setResettingUser] = useState<User | null>(null);


  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminData();
      if (result.error) {
        throw new Error(result.error);
      }
      setUsers(result.users || []);
    } catch (error: any) {
      setError(error.message);
      setUsers([]); // Clear users on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleFieldChange = (userId: string, field: keyof User, value: any) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, [field]: value } : user
      )
    );
  };

  const handleUpdateUser = async (userId: string) => {
    const userToUpdate = users.find((user) => user.id === userId);
    if (!userToUpdate) return;

    setIsUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await updateUser(userId, {
        approved: userToUpdate.approved,
        factionId: userToUpdate.factionId,
        raceId: userToUpdate.raceId,
      }, true);

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: '成功',
        description: `已更新使用者 ${userToUpdate.roleName} 的資料。`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '更新失敗',
        description: error.message,
      });
      // Optional: Revert state on failure by re-fetching
      fetchUsers();
    } finally {
      setIsUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };
  
  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>讀取失敗</AlertTitle>
        <AlertDescription>
          無法從後端讀取使用者列表。請檢查伺服器日誌以獲取更多詳細資訊。
          <pre className="mt-2 text-xs bg-black/20 p-2 rounded-md font-mono">{error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">帳號管理</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            審核新註冊的帳號，或手動修改現有使用者的狀態與資料。
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="icon" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>大頭貼</TableHead>
              <TableHead>角色名稱</TableHead>
              <TableHead>噗浪</TableHead>
              <TableHead>角色卡</TableHead>
              <TableHead>註冊日期</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>陣營</TableHead>
              <TableHead>種族</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} className="text-center h-24">沒有待審核或已註冊的使用者</TableCell>
                </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.avatarUrl && (
                      <Image 
                        src={user.avatarUrl}
                        alt={user.roleName}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{user.roleName}</TableCell>
                  <TableCell>
                    <Link href={user.plurkInfo} target="_blank" className="text-primary hover:underline">
                      前往
                    </Link>
                  </TableCell>
                   <TableCell>
                    <Link href={user.characterSheetUrl} target="_blank" className="text-primary hover:underline">
                      查看
                    </Link>
                  </TableCell>
                  <TableCell>
                     {new Date(user.registrationDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2">
                        <Switch
                          checked={user.approved}
                          onCheckedChange={(value) => handleFieldChange(user.id, 'approved', value)}
                          aria-label="啟用帳號"
                        />
                         <span className={user.approved ? 'text-green-500' : 'text-red-500'}>
                             {user.approved ? '已啟用' : '未啟用'}
                         </span>
                     </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.factionId}
                      onValueChange={(value) => handleFieldChange(user.id, 'factionId', value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(FACTIONS).map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.raceId}
                      onValueChange={(value) => handleFieldChange(user.id, 'raceId', value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(RACES).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="space-y-1">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateUser(user.id)}
                      disabled={isUpdating[user.id]}
                      className="w-full"
                    >
                      {isUpdating[user.id] ? '更新中...' : '更新'}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setResettingUser(user)}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        重設密碼
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {resettingUser && (
            <PasswordResetDialog 
                user={resettingUser}
                isOpen={!!resettingUser}
                onOpenChange={(open) => !open && setResettingUser(null)}
            />
      )}
    </div>
  );
}

function TaskTypeEditor({
  taskType,
  onSave,
  onCancel,
  isSaving,
  items,
  titles,
}: {
  taskType: Partial<TaskType>;
  onSave: (task: Partial<TaskType>) => void;
  onCancel: () => void;
  isSaving: boolean;
  items: any[];
  titles: any[];
}) {
  const [editedTask, setEditedTask] = useState(taskType);

  const handleSave = () => {
    if (!editedTask.name || !editedTask.id) {
        alert('ID 和名稱為必填項目');
        return;
    }
    onSave(editedTask);
  };

  return (
    <Card className="mt-4 bg-muted/30">
      <CardHeader>
        <CardTitle>{taskType.id ? '編輯任務類型' : '新增任務類型'}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
            <Label htmlFor="task-id">ID (英文，不可重複)</Label>
            <Input id="task-id" value={editedTask.id || ''} onChange={e => setEditedTask({...editedTask, id: e.target.value })} disabled={!!taskType.id} placeholder="例如：main, general-1"/>
        </div>
        <div className="space-y-2">
            <Label htmlFor="task-name">名稱</Label>
            <Input id="task-name" value={editedTask.name || ''} onChange={e => setEditedTask({...editedTask, name: e.target.value })} placeholder="例如：主線任務、夜鷺主線一"/>
        </div>
        <div className="space-y-2">
             <Label htmlFor="task-category">類型 (自定義分類)</Label>
             <Input id="task-category" value={editedTask.category || ''} onChange={e => setEditedTask({...editedTask, category: e.target.value })} placeholder="例如: 主線, 支線, 活動"/>
        </div>
        <div className="md:col-span-2 space-y-2">
            <Label htmlFor="task-desc">描述</Label>
            <Input id="task-desc" value={editedTask.description || ''} onChange={e => setEditedTask({...editedTask, description: e.target.value })} placeholder="任務的詳細說明"/>
        </div>
         <div className="space-y-2">
            <Label htmlFor="task-honor">榮譽點</Label>
            <Input id="task-honor" type="number" value={editedTask.honorPoints || 0} onChange={e => setEditedTask({...editedTask, honorPoints: parseInt(e.target.value) || 0 })} />
        </div>
         <div className="space-y-2">
            <Label htmlFor="task-currency">貨幣</Label>
            <Input id="task-currency" type="number" value={editedTask.currency || 0} onChange={e => setEditedTask({...editedTask, currency: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="task-title">稱號獎勵 (選填)</Label>
            <Select onValueChange={(value) => setEditedTask({ ...editedTask, titleAwarded: value === 'none' ? undefined : value })} value={editedTask.titleAwarded || 'none'}>
                <SelectTrigger id="task-title">
                    <SelectValue placeholder="選擇稱號獎勵" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">無</SelectItem>
                    {titles.map(title => (
                        <SelectItem key={title.id} value={title.id}>{title.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="task-item">物品獎勵 (選填)</Label>
            <Select onValueChange={(value) => setEditedTask({ ...editedTask, itemAwarded: value === 'none' ? undefined : value })} value={editedTask.itemAwarded || 'none'}>
                <SelectTrigger id="task-item">
                    <SelectValue placeholder="選擇物品獎勵" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">無</SelectItem>
                     {items.map(item => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center space-x-2">
            <Checkbox 
                id="requires-approval" 
                checked={editedTask.requiresApproval} 
                onCheckedChange={checked => setEditedTask({...editedTask, requiresApproval: !!checked})}
            />
            <Label htmlFor="requires-approval" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                任務須經審核
            </Label>
        </div>
        <div className="flex items-center space-x-2">
            <Checkbox 
                id="single-submission" 
                checked={editedTask.singleSubmission}
                onCheckedChange={checked => setEditedTask({...editedTask, singleSubmission: !!checked})}
            />
            <Label htmlFor="single-submission" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                任務只能繳交一次
            </Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>取消</Button>
        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存"}</Button>
      </CardFooter>
    </Card>
  );
}

function TaskManagement() {
  const { toast } = useToast();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [editingTask, setEditingTask] = useState<Partial<TaskType> | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminData();
      if (result.error) throw new Error(result.error);
      setTaskTypes(result.taskTypes || []);
      setItems(result.items || []);
      setTitles(result.titles || []);
      setPendingTasks(result.pendingTasks || []);
    } catch (error: any) {
      setError(error.message);
      setTaskTypes([]);
      setItems([]);
      setTitles([]);
      setPendingTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateStatus = async (task: Task, status: 'approved' | 'rejected') => {
    setIsProcessing(prev => ({...prev, [task.id]: true}));
    try {
        const result = await updateTaskStatus({ taskId: task.id, status });
        if (result.error) throw new Error(result.error);
        toast({ title: '成功', description: `任務「${task.title}」已${status === 'approved' ? '批准' : '拒絕'}`});
        fetchAdminData(); // Refresh all data
    } catch(e: any) {
        toast({ variant: 'destructive', title: '操作失敗', description: e.message });
    } finally {
        setIsProcessing(prev => ({...prev, [task.id]: false}));
    }
  }
  
  const handleSaveType = async (taskData: Partial<TaskType>) => {
    setIsSaving(true);
    try {
        const result = await updateTaskType(taskData as TaskType & { id: string });
        if (result.error) throw new Error(result.error);
        toast({ title: '成功', description: '任務類型已儲存。' });
        setEditingTask(null);
        fetchAdminData(); // Refresh list
    } catch (error: any) {
        toast({ variant: 'destructive', title: '儲存失敗', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  if (error) {
    return (
       <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>讀取失敗</AlertTitle>
        <AlertDescription>
          無法從後端讀取任務資料。請檢查伺服器日誌以獲取更多詳細資訊。
          <pre className="mt-2 text-xs bg-black/20 p-2 rounded-md font-mono">{error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

  const getTaskTypeName = (id: string) => taskTypes.find(t => t.id === id)?.name || id;

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">任務中心</h3>
            <p className="text-muted-foreground mt-1 text-sm">
                審核玩家提交的任務，並管理可用的任務類型。
            </p>
          </div>
          <Button onClick={fetchAdminData} variant="outline" size="icon" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Task Approval Section */}
        <Card>
            <CardHeader><CardTitle>待審核任務</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>提交者</TableHead><TableHead>任務</TableHead><TableHead>連結</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="w-full h-10"/></TableCell></TableRow>
                        : pendingTasks.length > 0 ? pendingTasks.map(task => (
                            <TableRow key={task.id}>
                                <TableCell>{task.userName}</TableCell>
                                <TableCell>
                                    <p className="font-medium">{task.title}</p>
                                    <p className="text-xs text-muted-foreground">{getTaskTypeName(task.taskTypeId)}</p>
                                </TableCell>
                                <TableCell><Link href={task.submissionUrl} target="_blank" className="text-primary hover:underline">查看噗文</Link></TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="icon" variant="ghost" className="text-green-500 hover:text-green-600" onClick={() => handleUpdateStatus(task, 'approved')} disabled={isProcessing[task.id]}><ThumbsUp className="h-4 w-4"/></Button>
                                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleUpdateStatus(task, 'rejected')} disabled={isProcessing[task.id]}><ThumbsDown className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={4} className="h-24 text-center">沒有待審核的任務</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Task Type Management Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
              <div>
                  <h3 className="text-lg font-semibold">任務類型管理</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                      新增、編輯或刪除玩家可提交的任務種類。
                  </p>
              </div>
              <Button onClick={() => setEditingTask({})} disabled={!!editingTask}>
                  新增任務類型
              </Button>
          </div>
          {editingTask && (
              <TaskTypeEditor 
                  taskType={editingTask}
                  onSave={handleSaveType}
                  onCancel={() => setEditingTask(null)}
                  isSaving={isSaving}
                  items={items}
                  titles={titles}
              />
          )}
          <div className="border rounded-md mt-4">
              <Table>
                  <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>名稱</TableHead><TableHead>分類</TableHead><TableHead>榮譽</TableHead><TableHead>貨幣</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                   {isLoading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                  : taskTypes.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center h-24">尚未建立任何任務類型</TableCell></TableRow>
                  : taskTypes.map(task => (
                      <TableRow key={task.id}>
                          <TableCell className="font-mono">{task.id}</TableCell>
                          <TableCell className="font-medium">{task.name}</TableCell>
                          <TableCell>{task.category}</TableCell>
                          <TableCell>{task.honorPoints}</TableCell>
                          <TableCell>{task.currency}</TableCell>
                          <TableCell className="space-x-2">
                              <Button variant="ghost" size="icon" onClick={() => setEditingTask(task)}><Edit className="h-4 w-4"/></Button>
                               <Dialog>
                                  <DialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button></DialogTrigger>
                                  <DialogContent>
                                      <DialogHeader><DialogTitle>確認刪除</DialogTitle><DialogDescription>您確定要刪除「{task.name}」這個任務類型嗎？</DialogDescription></DialogHeader>
                                      <DialogFooter>
                                          <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
                                          <Button variant="destructive" onClick={() => handleSaveType({...task, id: task.id, _delete: true})}>刪除</Button>
                                      </DialogFooter>
                                  </DialogContent>
                              </Dialog>
                          </TableCell>
                      </TableRow>
                  ))}
                  </TableBody>
              </Table>
          </div>
        </div>
    </div>
  );
}

const itemTypeTranslations: { [key: string]: string } = {
  equipment: '裝備',
  consumable: '戰鬥道具',
  special: '特殊道具',
  stat_boost: '能力提升'
};

function formatEffect(effect: AttributeEffect | TriggeredEffect): string {
    if ('attribute' in effect) { // AttributeEffect
        const op = effect.operator === 'd' ? `${effect.value}` : `${effect.operator} ${effect.value}`;
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

function ItemEditor({
  item,
  onSave,
  onCancel,
  isSaving,
}: {
  item: Partial<Item>;
  onSave: (item: Partial<Item>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [editedItem, setEditedItem] = useState<Partial<Item>>(item);

  useEffect(() => {
    if (!editedItem.effects) {
      setEditedItem(prev => ({ ...prev, effects: [] }));
    }
  }, [editedItem.effects]);

  const handleSave = () => {
    if (!editedItem.name || !editedItem.id) {
      alert('ID 和名稱為必填項目');
      return;
    }
    onSave(editedItem);
  };
  
  const isEquipment = editedItem.itemTypeId === 'equipment';
  const isConsumable = editedItem.itemTypeId === 'consumable';
  const isStatBoost = editedItem.itemTypeId === 'stat_boost';

  const handleEffectChange = (index: number, field: keyof AttributeEffect, value: any) => {
    setEditedItem(prev => {
        const newEffects = [...(prev.effects || [])];
        const effect = { ...newEffects[index] } as AttributeEffect;
        (effect as any)[field] = value;
        newEffects[index] = effect;
        return { ...prev, effects: newEffects };
    });
  };
  
  const handleTriggeredEffectChange = (index: number, field: keyof TriggeredEffect, value: any) => {
    setEditedItem(prev => {
        const newEffects = [...(prev.effects || [])];
        const effect = { ...newEffects[index] } as TriggeredEffect;
        (effect as any)[field] = value;
        newEffects[index] = effect;
        return { ...prev, effects: newEffects };
    });
  };

  const addEffect = () => {
    let newEffect: AttributeEffect | TriggeredEffect;
    if (isEquipment || isStatBoost) {
        newEffect = { attribute: 'atk', operator: '+', value: 0 };
    } else if (isConsumable) {
        newEffect = { trigger: 'on_use', probability: 100, effectType: 'hp_recovery', value: 0 };
    } else {
        return;
    }
    setEditedItem(prev => ({ ...prev, effects: [...(prev.effects || []), newEffect] }));
  };

  const removeEffect = (index: number) => {
    setEditedItem(prev => ({...prev, effects: prev.effects?.filter((_, i) => i !== index)}));
  };

  return (
    <Card className="mt-4 bg-muted/30">
      <CardHeader>
        <CardTitle>{item.id ? '編輯道具' : '新增道具'}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="space-y-2">
          <Label htmlFor="item-id">ID (英文，不可重複)</Label>
          <Input id="item-id" value={editedItem.id || ''} onChange={e => setEditedItem({ ...editedItem, id: e.target.value })} disabled={!!item.id} placeholder="例如：potion-1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-name">名稱</Label>
          <Input id="item-name" value={editedItem.name || ''} onChange={e => setEditedItem({ ...editedItem, name: e.target.value })} placeholder="例如：回復藥水" />
        </div>
        <div className="md:col-span-2 space-y-2">
            <Label htmlFor="item-imageUrl">圖片網址</Label>
            <Input id="item-imageUrl" value={editedItem.imageUrl || ''} onChange={e => setEditedItem({...editedItem, imageUrl: e.target.value })} placeholder="https://images.plurk.com/..."/>
        </div>
         <div className="md:col-span-2 space-y-2">
            <Label htmlFor="item-desc">描述</Label>
            <Input id="item-desc" value={editedItem.description || ''} onChange={e => setEditedItem({...editedItem, description: e.target.value })} placeholder="道具的說明文字"/>
        </div>
        
        {/* Categorization and Price */}
        <div className="space-y-2">
          <Label htmlFor="item-type">類型</Label>
          <Select value={editedItem.itemTypeId} onValueChange={(value) => setEditedItem({ ...editedItem, itemTypeId: value as Item['itemTypeId'], effects: [] })}>
            <SelectTrigger id="item-type"><SelectValue placeholder="選擇類型" /></SelectTrigger>
            <SelectContent>
              {Object.entries(itemTypeTranslations).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-price">價格</Label>
          <Input id="item-price" type="number" value={editedItem.price || 0} onChange={e => setEditedItem({ ...editedItem, price: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-faction">陣營</Label>
          <Select value={editedItem.factionId} onValueChange={(value) => setEditedItem({ ...editedItem, factionId: value })}>
            <SelectTrigger id="item-faction"><SelectValue placeholder="選擇陣營" /></SelectTrigger>
            <SelectContent>
              {Object.entries(FACTIONS).map(([id, faction]) => (
                 <SelectItem key={id} value={id}>{id === 'wanderer' ? `${faction.name} / 通用` : faction.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-race">種族限制</Label>
          <Select value={editedItem.raceId} onValueChange={(value) => setEditedItem({ ...editedItem, raceId: value })}>
            <SelectTrigger id="item-race"><SelectValue placeholder="選擇種族" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">通用</SelectItem>
              {Object.values(RACES).map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Effects Editor */}
        <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
                <Label>效果</Label>
                 <Button size="sm" variant="outline" onClick={addEffect}><Plus className="mr-2 h-4 w-4"/>新增效果</Button>
            </div>

            {(editedItem.effects || []).map((effect, index) => (
                <div key={index} className="p-3 border rounded-md bg-background/50 space-y-4 relative">
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeEffect(index)}><X className="h-4 w-4"/></Button>
                   
                    {(isEquipment || isStatBoost) && 'attribute' in effect && (
                        <div className="grid grid-cols-3 gap-2">
                            <Select value={effect.attribute} onValueChange={v => handleEffectChange(index, 'attribute', v)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="atk">ATK</SelectItem>
                                    <SelectItem value="def">DEF</SelectItem>
                                    <SelectItem value="hp">HP</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select value={effect.operator} onValueChange={v => handleEffectChange(index, 'operator', v)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="+">+</SelectItem>
                                    <SelectItem value="*">*</SelectItem>
                                    <SelectItem value="d">d (骰)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="數值或 1d6"
                                value={effect.value}
                                onChange={e => handleEffectChange(index, 'value', e.target.value)}
                            />
                        </div>
                    )}

                    {isConsumable && 'trigger' in effect && (
                         <div className="space-y-3">
                           <div className="grid grid-cols-3 gap-2">
                             <Select value={effect.effectType} onValueChange={v => handleTriggeredEffectChange(index, 'effectType', v)}>
                                <SelectTrigger><SelectValue placeholder="效果類型"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hp_recovery">恢復HP</SelectItem>
                                    <SelectItem value="damage_enemy">造成傷害</SelectItem>
                                    <SelectItem value="atk_buff">攻擊加成</SelectItem>
                                    <SelectItem value="def_buff">防禦加成</SelectItem>
                                    <SelectItem value="hp_cost">扣除HP</SelectItem>
                                </SelectContent>
                            </Select>
                             <Input type="number" placeholder="數值" value={effect.value} onChange={e => handleTriggeredEffectChange(index, 'value', parseInt(e.target.value) || 0)} />
                             <Input type="number" placeholder="機率 (0-100)%" value={effect.probability} onChange={e => handleTriggeredEffectChange(index, 'probability', parseInt(e.target.value) || 0)} />
                           </div>
                           <Input type="number" placeholder="持續回合數 (選填)" value={effect.duration || ''} onChange={e => handleTriggeredEffectChange(index, 'duration', parseInt(e.target.value) || undefined)} />
                        </div>
                    )}
                </div>
            ))}
            { editedItem.itemTypeId === 'special' && <p className="text-sm text-muted-foreground">特殊道具無效果，主要用於合成。</p>}
        </div>

        <div className="md:col-span-2 flex items-center space-x-2">
            <Checkbox id="item-published" checked={editedItem.isPublished} onCheckedChange={checked => setEditedItem({...editedItem, isPublished: !!checked})}/>
            <Label htmlFor="item-published" className="text-sm font-medium">上架於陣營商店</Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>取消</Button>
        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存"}</Button>
      </CardFooter>
    </Card>
  );
}


function StoreManagement() {
    const { toast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<Item> | null>(null);

    const fetchAdminData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAdminData();
            if (result.error) throw new Error(result.error);
            setItems(result.items || []);
        } catch (error: any) {
            setError(error.message);
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    const handleSave = async (itemData: Partial<Item>) => {
        setIsSaving(true);
        try {
            const result = await updateItem(itemData as Item);
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: '道具已儲存。' });
            setEditingItem(null);
            fetchAdminData(); // Refresh list
        } catch (error: any) {
            toast({ variant: 'destructive', title: '儲存失敗', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (error) {
        return (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>讀取失敗</AlertTitle>
                <AlertDescription>
                    無法從後端讀取道具列表。
                    <pre className="mt-2 text-xs bg-black/20 p-2 rounded-md font-mono">{error}</pre>
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold">商店道具管理</h3>
                    <p className="text-muted-foreground mt-1 text-sm">新增、編輯和上下架商店中的商品。</p>
                </div>
                <Button onClick={() => setEditingItem({ isPublished: true, effects: [] })} disabled={!!editingItem}>新增道具</Button>
            </div>

            {editingItem && (
                <ItemEditor 
                    item={editingItem}
                    onSave={handleSave}
                    onCancel={() => setEditingItem(null)}
                    isSaving={isSaving}
                />
            )}

            <div className="border rounded-md mt-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>名稱</TableHead>
                            <TableHead>類型</TableHead>
                            <TableHead>陣營</TableHead>
                            <TableHead>種族</TableHead>
                            <TableHead>效果</TableHead>
                            <TableHead>價格</TableHead>
                            <TableHead>狀態</TableHead>
                            <TableHead>操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ))
                        ) : items.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center h-24">尚未建立任何道具</TableCell></TableRow>
                        ) : (
                            items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{itemTypeTranslations[item.itemTypeId] || '未知'}</TableCell>
                                    <TableCell>{FACTIONS[item.factionId as keyof typeof FACTIONS]?.name || 'N/A'}</TableCell>
                                    <TableCell>{item.raceId === 'all' ? '通用' : RACES[item.raceId as keyof typeof RACES]?.name || '未知'}</TableCell>
                                    <TableCell className="text-xs max-w-[200px] truncate">{item.effects?.map(formatEffect).join(', ') || '無'}</TableCell>
                                    <TableCell>{item.price}</TableCell>
                                    <TableCell>
                                        <span className={item.isPublished ? 'text-green-500' : 'text-red-500'}>
                                            {item.isPublished ? '已上架' : '未上架'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)}><Edit className="h-4 w-4"/></Button>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>確認刪除</DialogTitle>
                                                    <DialogDescription>您確定要刪除「{item.name}」嗎？</DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
                                                    <Button variant="destructive" onClick={() => handleSave({...item, _delete: true})}>刪除</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function RecipeEditor({
  recipe,
  items,
  onSave,
  onCancel,
  isSaving,
}: {
  recipe: Partial<CraftRecipe>;
  items: Item[];
  onSave: (recipe: Partial<CraftRecipe>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [editedRecipe, setEditedRecipe] = useState(recipe);

  const { equipment, specialItems, targettableItems } = useMemo(() => {
    return {
      equipment: items.filter(i => i.itemTypeId === 'equipment' && i.isPublished),
      specialItems: items.filter(i => i.itemTypeId === 'special'),
      targettableItems: items.filter(i => i.itemTypeId === 'equipment' && !i.isPublished),
    };
  }, [items]);

  const handleSave = () => {
    if (!editedRecipe.id || !editedRecipe.baseItemId || !editedRecipe.materialItemId || !editedRecipe.resultItemId) {
      alert('所有欄位皆為必填');
      return;
    }
    onSave(editedRecipe);
  };

  return (
    <Card className="mt-4 bg-muted/30">
      <CardHeader>
        <CardTitle>{recipe.id ? '編輯合成配方' : '新增合成配方'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>ID (英文，不可重複)</Label>
          <Input 
            value={editedRecipe.id || ''} 
            onChange={e => setEditedRecipe({ ...editedRecipe, id: e.target.value })} 
            disabled={!!recipe.id} 
            placeholder="recipe-001"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
            <div className="space-y-2">
                <Label>基底裝備</Label>
                <Select value={editedRecipe.baseItemId} onValueChange={v => setEditedRecipe({...editedRecipe, baseItemId: v})}>
                    <SelectTrigger><SelectValue placeholder="選擇基底裝備"/></SelectTrigger>
                    <SelectContent>{equipment.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="flex justify-center"><Plus className="h-5 w-5"/></div>
            <div className="space-y-2">
                <Label>合成材料</Label>
                 <Select value={editedRecipe.materialItemId} onValueChange={v => setEditedRecipe({...editedRecipe, materialItemId: v})}>
                    <SelectTrigger><SelectValue placeholder="選擇材料"/></SelectTrigger>
                    <SelectContent>{specialItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex justify-center items-center"><ArrowRight className="h-6 w-6"/></div>
        <div className="space-y-2">
             <Label>目標裝備 (僅顯示未上架的裝備)</Label>
             <Select value={editedRecipe.resultItemId} onValueChange={v => setEditedRecipe({...editedRecipe, resultItemId: v})}>
                <SelectTrigger><SelectValue placeholder="選擇目標裝備"/></SelectTrigger>
                <SelectContent>{targettableItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
        </div>
        <div className="flex items-center space-x-2 pt-4">
            <Checkbox 
                id="recipe-published" 
                checked={editedRecipe.isPublished} 
                onCheckedChange={checked => setEditedRecipe({...editedRecipe, isPublished: !!checked})}
            />
            <Label htmlFor="recipe-published">在合成參考表中顯示此配方</Label>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>取消</Button>
        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存"}</Button>
      </CardFooter>
    </Card>
  );
}


function CraftingManagement() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [recipes, setRecipes] = useState<CraftRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Partial<CraftRecipe> | null>(null);

  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminData();
      if (result.error) throw new Error(result.error);
      setItems(result.items || []);
      setRecipes(result.craftRecipes || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);
  
  const handleSave = async (recipeData: Partial<CraftRecipe>) => {
    setIsSaving(true);
    try {
        const result = await updateCraftRecipe(recipeData as CraftRecipe);
        if (result.error) throw new Error(result.error);
        toast({ title: '成功', description: '合成配方已儲存。' });
        setEditingRecipe(null);
        fetchAdminData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: '儲存失敗', description: e.message });
    } finally {
        setIsSaving(false);
    }
  };

  if (error) {
    return (
       <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>讀取失败</AlertTitle>
        <AlertDescription>
          無法讀取資料，請檢查後端日誌。
          <pre className="mt-2 text-xs bg-black/20 p-2 rounded-md font-mono">{error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">裝備合成管理</h3>
          <p className="text-muted-foreground mt-2">
            定義裝備合成配方。例如：某裝備 + 某物品 = 新裝備。
          </p>
        </div>
        <Button onClick={() => setEditingRecipe({ isPublished: true })} disabled={!!editingRecipe}>新增配方</Button>
      </div>

       {editingRecipe && (
        <RecipeEditor 
            recipe={editingRecipe}
            items={items}
            onSave={handleSave}
            onCancel={() => setEditingRecipe(null)}
            isSaving={isSaving}
        />
       )}
      
      <div className="border rounded-md mt-4">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>產物</TableHead>
                    <TableHead>合成公式</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                ) : recipes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">尚未建立任何配方</TableCell></TableRow>
                ) : (
                  recipes.map(recipe => (
                    <TableRow key={recipe.id}>
                        <TableCell className="font-medium">{itemsById.get(recipe.resultItemId)?.name || 'N/A'}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <span>{itemsById.get(recipe.baseItemId)?.name || '?'}</span>
                                <Plus className="h-4 w-4"/>
                                <span>{itemsById.get(recipe.materialItemId)?.name || '?'}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                           <span className={recipe.isPublished ? 'text-green-500' : 'text-red-500'}>
                                {recipe.isPublished ? '已發布' : '未發布'}
                            </span>
                        </TableCell>
                         <TableCell className="space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingRecipe(recipe)}><Edit className="h-4 w-4"/></Button>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>確認刪除</DialogTitle>
                                        <DialogDescription>您確定要刪除此合成配方嗎？</DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
                                        <Button variant="destructive" onClick={() => handleSave({...recipe, _delete: true})}>刪除</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </TableCell>
                    </TableRow>
                  ))
                )}
            </TableBody>
        </Table>
      </div>
    </div>
  )
}

const skillEffectTypes: { value: SkillEffectType; label: string }[] = [
    { value: 'hp_recovery', label: '恢復HP' },
    { value: 'direct_damage', label: '造成直接傷害' },
    { value: 'atk_buff', label: '增加攻擊倍率(%)' },
    { value: 'def_buff', label: '增加防禦倍率(%)' },
    { value: 'hp_cost', label: '扣除HP' },
    { value: 'probabilistic_damage', label: '機率傷害' },
];

function formatSkillEffects(effects: SkillEffect[]): string {
    if (!effects || effects.length === 0) return '無';
    return effects.map(e => {
        const typeLabel = skillEffectTypes.find(t => t.value === e.effectType)?.label || e.effectType;
        if (e.effectType === 'probabilistic_damage') {
            return `${e.probability}%機率造成 ${e.value} 傷害`;
        }
        return `${typeLabel}: ${e.value}`;
    }).join(', ');
}


function SkillEditor({
    skill,
    onSave,
    onCancel,
    isSaving,
    owner,
}: {
    skill: Partial<Skill>;
    onSave: (skill: Partial<Skill>) => void;
    onCancel: () => void;
    isSaving: boolean;
    owner: { factionId: string; raceId: string };
}) {
    const { toast } = useToast();
    const [editedSkill, setEditedSkill] = useState<Partial<Skill>>({
        ...skill,
        factionId: owner.factionId,
        raceId: owner.raceId,
        effects: skill.effects || [],
    });

    const handleEffectChange = (index: number, field: keyof SkillEffect, value: any) => {
        const newEffects = [...(editedSkill.effects || [])];
        const effect = { ...newEffects[index] };
        
        (effect as any)[field] = value;

        // Reset irrelevant fields when effectType changes
        if (field === 'effectType') {
            if (value !== 'probabilistic_damage') {
                delete effect.probability;
            }
            if (value !== 'atk_buff' && value !== 'def_buff') {
                delete effect.duration;
            }
            if (value === 'probabilistic_damage' && !effect.probability) {
                effect.probability = 100;
            }
        }

        newEffects[index] = effect;
        setEditedSkill({ ...editedSkill, effects: newEffects });
    };

    const addEffect = () => {
        const newEffect: SkillEffect = { effectType: 'hp_recovery', value: '0' };
        setEditedSkill({ ...editedSkill, effects: [...(editedSkill.effects || []), newEffect] });
    };

    const removeEffect = (index: number) => {
        setEditedSkill({ ...editedSkill, effects: editedSkill.effects?.filter((_, i) => i !== index) });
    };
    
    const handleSave = () => {
        if (!editedSkill.id || !editedSkill.name) {
            toast({ variant: 'destructive', title: '錯誤', description: '技能 ID 和名稱為必填項目。'});
            return;
        }
        onSave(editedSkill);
    };

    return (
        <Card className="mt-4 bg-muted/30">
            <CardHeader>
                <CardTitle>{skill.id ? '編輯技能' : '新增技能'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>ID (英文，不可重複)</Label>
                        <Input value={editedSkill.id || ''} onChange={e => setEditedSkill({ ...editedSkill, id: e.target.value })} disabled={!!skill.id} placeholder="skill-001" />
                    </div>
                    <div className="space-y-2">
                        <Label>名稱</Label>
                        <Input value={editedSkill.name || ''} onChange={e => setEditedSkill({ ...editedSkill, name: e.target.value })} placeholder="技能名稱" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label>描述</Label>
                        <Input value={editedSkill.description || ''} onChange={e => setEditedSkill({ ...editedSkill, description: e.target.value })} placeholder="技能效果說明" />
                    </div>
                    <div className="space-y-2">
                        <Label>冷卻回合</Label>
                        <Input type="number" value={editedSkill.cooldown || 0} onChange={e => setEditedSkill({ ...editedSkill, cooldown: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>效果</Label>
                        <Button size="sm" variant="outline" onClick={addEffect}><Plus className="mr-2 h-4 w-4" />新增效果</Button>
                    </div>
                    {(editedSkill.effects || []).map((effect, index) => (
                        <div key={index} className="p-3 border rounded-md bg-background/50 space-y-3 relative">
                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeEffect(index)}><X className="h-4 w-4" /></Button>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select value={effect.effectType} onValueChange={(v) => handleEffectChange(index, 'effectType', v)}>
                                    <SelectTrigger><SelectValue placeholder="效果類型" /></SelectTrigger>
                                    <SelectContent>
                                        {skillEffectTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {effect.effectType === 'probabilistic_damage' && (
                                    <Input type="number" placeholder="機率 (0-100)%" value={effect.probability || ''} onChange={e => handleEffectChange(index, 'probability', parseInt(e.target.value))} />
                                )}
                            </div>
                            <Input placeholder="數值 (e.g. 1.5, -10, 2d6)" value={effect.value || ''} onChange={e => handleEffectChange(index, 'value', e.target.value)} />
                            {(effect.effectType === 'atk_buff' || effect.effectType === 'def_buff') && (
                                <Input type="number" placeholder="持續回合數 (選填)" value={effect.duration || ''} onChange={e => handleEffectChange(index, 'duration', parseInt(e.target.value))} />
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>取消</Button>
                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存"}</Button>
            </CardFooter>
        </Card>
    );
}


function SkillManagement() {
    const { toast } = useToast();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Partial<Skill> | null>(null);
    const [activeFactionTab, setActiveFactionTab] = useState<string>('yelu');
    const [activeRaceTab, setActiveRaceTab] = useState<string>('corruptor');

    const fetchAdminData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAdminData();
            if (result.error) throw new Error(result.error);
            setSkills(result.skills || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchAdminData();
    }, []);

    const handleFactionTabChange = (value: string) => {
        setActiveFactionTab(value);
        setEditingSkill(null);
        // Reset race tab to default when faction changes
        setActiveRaceTab(Object.keys(RACES)[0]); 
    };
    
    const handleRaceTabChange = (value: string) => {
        setActiveRaceTab(value);
        setEditingSkill(null);
    };

    const handleSave = async (skillData: Partial<Skill>) => {
        setIsSaving(true);
        try {
            const result = await updateSkill(skillData as Skill);
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: '技能已儲存。' });
            setEditingSkill(null);
            fetchAdminData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: '儲存失敗', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const currentSkills = useMemo(() => {
        return skills.filter(skill => skill.factionId === activeFactionTab && skill.raceId === activeRaceTab);
    }, [skills, activeFactionTab, activeRaceTab]);
    

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold">技能管理</h3>
                    <p className="text-muted-foreground mt-1 text-sm">管理不同陣營和種族的可用技能。</p>
                </div>
                 <Button onClick={() => setEditingSkill({ cooldown: 0, effects: [] })} disabled={!!editingSkill}>新增技能</Button>
            </div>
            
            <Tabs value={activeFactionTab} onValueChange={handleFactionTabChange}>
                <TabsList className="grid w-full grid-cols-3">
                     {Object.values(FACTIONS).map(tab => (
                        <TabsTrigger key={tab.id} value={tab.id}>{tab.name}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <Tabs value={activeRaceTab} onValueChange={handleRaceTabChange} className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                    {Object.values(RACES).map(tab => (
                        <TabsTrigger key={tab.id} value={tab.id}>{tab.name}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            
            {editingSkill && (
                <SkillEditor
                    skill={editingSkill}
                    onSave={handleSave}
                    onCancel={() => setEditingSkill(null)}
                    isSaving={isSaving}
                    owner={{factionId: activeFactionTab, raceId: activeRaceTab}}
                />
            )}

            <div className="border rounded-md mt-4">
                <Table>
                    <TableHeader><TableRow><TableHead>名稱</TableHead><TableHead>效果</TableHead><TableHead>冷卻</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                        ) : currentSkills.length > 0 ? (
                            currentSkills.map(skill => (
                                <TableRow key={skill.id}>
                                    <TableCell>{skill.name}</TableCell>
                                    <TableCell className="text-xs truncate max-w-xs">{formatSkillEffects(skill.effects)}</TableCell>
                                    <TableCell>{skill.cooldown}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => setEditingSkill(skill)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>確認刪除</AlertDialogTitle><AlertDialogDescription>您確定要刪除「{skill.name}」嗎？</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => handleSave({...skill, _delete: true})}>刪除</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">此分類尚無技能</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

const titleTriggerTypes: { value: TitleTriggerType, label: string, requiresItem: boolean }[] = [
    { value: 'honor_points', label: '榮譽點達到 X 點', requiresItem: false },
    { value: 'currency', label: '貨幣達到 X 點', requiresItem: false },
    { value: 'tasks_submitted', label: '提交任務達到 X 篇', requiresItem: false },
    { value: 'battles_participated', label: '參加共鬥 X 次', requiresItem: false },
    { value: 'battles_hp_zero', label: '共鬥血量歸零 X 次', requiresItem: false },
    { value: 'item_used', label: '使用道具 O X 次', requiresItem: true },
    { value: 'item_damage', label: '使用道具 O 造成 A 傷害共 X 次', requiresItem: true },
];

function TitleEditor({ title, items, onSave, onCancel, isSaving }: { title: Partial<Title>, items: Item[], onSave: (data: Partial<Title>) => void, onCancel: () => void, isSaving: boolean }) {
    const { toast } = useToast();
    const [editedTitle, setEditedTitle] = useState<Partial<Title>>(title);

    const handleTriggerTypeChange = (type: TitleTriggerType) => {
        const newTrigger: TitleTrigger = { type, value: 0 };
        const triggerInfo = titleTriggerTypes.find(t => t.value === type);
        if (triggerInfo?.requiresItem) {
            newTrigger.itemId = items[0]?.id;
        }
        setEditedTitle(prev => ({...prev, trigger: newTrigger}));
    };

    const handleSave = () => {
        if (!editedTitle.id || !editedTitle.name) {
            toast({ variant: 'destructive', title: '錯誤', description: 'ID 和名稱為必填項。' });
            return;
        }
        onSave(editedTitle);
    };

    const currentTriggerInfo = titleTriggerTypes.find(t => t.value === editedTitle.trigger?.type);

    return (
        <Card className="mt-4 bg-muted/30">
            <CardHeader><CardTitle>{title.id ? '編輯稱號' : '新增稱號'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>ID (英文，不可重複)</Label>
                        <Input value={editedTitle.id || ''} onChange={e => setEditedTitle({ ...editedTitle, id: e.target.value })} disabled={!!title.id} />
                    </div>
                    <div className="space-y-2">
                        <Label>名稱</Label>
                        <Input value={editedTitle.name || ''} onChange={e => setEditedTitle({ ...editedTitle, name: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label>描述</Label>
                        <Input value={editedTitle.description || ''} onChange={e => setEditedTitle({ ...editedTitle, description: e.target.value })} />
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="title-hidden" checked={editedTitle.isHidden} onCheckedChange={checked => setEditedTitle({ ...editedTitle, isHidden: !!checked })} />
                    <Label htmlFor="title-hidden">達成前隱藏此稱號</Label>
                </div>
                <div className="space-y-3">
                    <Label>發放方式</Label>
                    <RadioGroup value={editedTitle.isManual ? 'manual' : 'auto'} onValueChange={v => setEditedTitle({ ...editedTitle, isManual: v === 'manual', trigger: v === 'manual' ? undefined : { type: 'honor_points', value: 0 }})}>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="manual" id="manual" /><Label htmlFor="manual">手動發放</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="auto" id="auto" /><Label htmlFor="auto">自動發放 (達成條件)</Label></div>
                    </RadioGroup>
                </div>
                {!editedTitle.isManual && (
                    <div className="p-4 border rounded-md bg-background/50 space-y-4">
                        <h4 className="font-semibold">自動發放條件</h4>
                        <Select value={editedTitle.trigger?.type} onValueChange={(v) => handleTriggerTypeChange(v as TitleTriggerType)}>
                            <SelectTrigger><SelectValue placeholder="選擇觸發條件" /></SelectTrigger>
                            <SelectContent>
                                {titleTriggerTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {currentTriggerInfo?.requiresItem && (
                             <Select value={editedTitle.trigger?.itemId} onValueChange={v => setEditedTitle(prev => ({...prev, trigger: prev.trigger ? {...prev.trigger, itemId: v} : undefined}))}>
                                <SelectTrigger><SelectValue placeholder="選擇道具" /></SelectTrigger>
                                <SelectContent>
                                    {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        
                        {editedTitle.trigger?.type === 'item_damage' && (
                            <div className="space-y-2">
                                <Label>每次所需傷害 (A)</Label>
                                <Input type="number" placeholder="傷害閾值" value={editedTitle.trigger.damageThreshold ?? 0} onChange={e => setEditedTitle(prev => ({...prev, trigger: prev.trigger ? {...prev.trigger, damageThreshold: parseInt(e.target.value) || 0} : undefined}))}/>
                            </div>
                        )}

                        <div className="space-y-2">
                             <Label>目標達成次數 / 數值 (X)</Label>
                            <Input type="number" placeholder="目標數值 (例如: 100)" value={editedTitle.trigger?.value ?? 0} onChange={e => setEditedTitle(prev => ({...prev, trigger: prev.trigger ? {...prev.trigger, value: parseInt(e.target.value) || 0} : undefined}))}/>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>取消</Button>
                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "儲存中..." : "儲存"}</Button>
            </CardFooter>
        </Card>
    );
}


function TitleManagement() {
    const { toast } = useToast();
    const [titles, setTitles] = useState<Title[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingTitle, setEditingTitle] = useState<Partial<Title> | null>(null);

    const fetchAdminData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAdminData();
            if (result.error) throw new Error(result.error);
            setTitles(result.titles || []);
            setItems(result.items || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    const handleSave = async (titleData: Partial<Title>) => {
        setIsSaving(true);
        try {
            const result = await updateTitle(titleData as Title);
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: '稱號已儲存。' });
            setEditingTitle(null);
            fetchAdminData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: '儲存失败', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const getTriggerDescription = (title: Title) => {
        if (title.isManual || !title.trigger) return '手動發放';
        
        const triggerInfo = titleTriggerTypes.find(t => t.value === title.trigger.type);
        if (!triggerInfo) return '未知條件';
        
        let desc = triggerInfo.label;
        
        if (triggerInfo.requiresItem) {
            const itemName = items.find(i => i.id === title.trigger?.itemId)?.name || '未知道具';
            desc = desc.replace('O', `「${itemName}」`);
        }
        
        if (title.trigger.type === 'item_damage') {
             desc = desc.replace('A', (title.trigger.damageThreshold ?? 0).toString());
        }

        // Always replace 'X' with the value
        desc = desc.replace('X', (title.trigger.value ?? 0).toString());

        return desc;
    };


    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold">稱號管理</h3>
                    <p className="text-muted-foreground mt-1 text-sm">新增和管理一般及隱藏稱號的達成條件。</p>
                </div>
                <Button onClick={() => setEditingTitle({ isHidden: false, isManual: true })} disabled={!!editingTitle}>新增稱號</Button>
            </div>

            {editingTitle && (
                <TitleEditor
                    title={editingTitle}
                    items={items}
                    onSave={handleSave}
                    onCancel={() => setEditingTitle(null)}
                    isSaving={isSaving}
                />
            )}

             <div className="border rounded-md mt-4">
                <Table>
                    <TableHeader><TableRow><TableHead>名稱</TableHead><TableHead>描述</TableHead><TableHead>達成條件</TableHead><TableHead>狀態</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                        ) : titles.length > 0 ? (
                            titles.map(title => (
                                <TableRow key={title.id}>
                                    <TableCell>{title.name}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{title.description}</TableCell>
                                    <TableCell className="text-xs">{getTriggerDescription(title)}</TableCell>
                                    <TableCell>{title.isHidden ? '隱藏' : '公開'}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => setEditingTitle(title)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>確認刪除</AlertDialogTitle><AlertDialogDescription>您確定要刪除稱號「{title.name}」嗎？</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => handleSave({...title, _delete: true})}>刪除</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">尚未建立任何稱號</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function RewardDistribution() {
    const { toast } = useToast();
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allItems, setAllItems] = useState<Item[]>([]);
    const [allTitles, setAllTitles] = useState<Title[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<'filter' | 'single'>('filter');
    const [filters, setFilters] = useState<FilterCriteria>({});
    const [rewards, setRewards] = useState({ honorPoints: 0, currency: 0, itemId: '', titleId: '', logMessage: '' });
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [preview, setPreview] = useState<{ count: number; users: { id: string; roleName: string }[] } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const data = await getAdminData();
            if (data.users) setAllUsers(data.users.filter(u => !u.isAdmin)); // Exclude admins from list
            if (data.items) setAllItems(data.items);
            if (data.titles) setAllTitles(data.titles);
            setIsLoading(false);
        }
        fetchData();
    }, []);

    const handlePreview = async () => {
        setIsProcessing(true);
        setPreview(null);
        try {
            const payload = {
                targetUserIds: mode === 'single' ? (selectedUser ? [selectedUser] : []) : undefined,
                filters: mode === 'filter' ? filters : undefined,
                rewards: { logMessage: "Preview" },
            };
            
            // Do not distribute to an empty list
            if (mode === 'single' && !selectedUser) {
                toast({ variant: 'destructive', title: '錯誤', description: '請選擇一位玩家。'});
                setIsProcessing(false);
                return;
            }
            
            const result = await distributeRewards(payload);
            if (result.error) throw new Error(result.error);
            
            if (!result.processedUsers || result.processedUsers.length === 0) {
                 toast({ variant: 'default', title: '預覽結果', description: '沒有任何玩家符合條件。'});
                 setPreview({ count: 0, users: [] });
            } else {
                setPreview({
                    count: result.processedCount || 0,
                    users: result.processedUsers || [],
                });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: '預覽失敗', description: e.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDistribute = async () => {
        if (!rewards.logMessage) {
            toast({ variant: 'destructive', title: '錯誤', description: '請輸入獎勵發放的日誌訊息。' });
            return;
        }

        const userIdsToDistribute = mode === 'single' 
            ? (selectedUser ? [selectedUser] : []) 
            : (preview?.users.map(u => u.id) || []);

        if (userIdsToDistribute.length === 0) {
            toast({ variant: 'destructive', title: '錯誤', description: '沒有指定任何發放對象。' });
            return;
        }

        setIsProcessing(true);
        try {
            const result = await distributeRewards({
                targetUserIds: userIdsToDistribute,
                rewards: {
                    honorPoints: rewards.honorPoints || undefined,
                    currency: rewards.currency || undefined,
                    itemId: rewards.itemId || undefined,
                    titleId: rewards.titleId || undefined,
                    logMessage: rewards.logMessage,
                },
            });
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: `已向 ${result.processedCount} 位玩家發放獎勵。` });
            setPreview(null);
            setFilters({});
            setSelectedUser('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: '發放失敗', description: e.message });
        } finally {
            setIsProcessing(false);
        }
    };
    
    if (isLoading) return <Skeleton className="w-full h-64" />;

    return (
        <div>
            <h3 className="text-lg font-semibold">特殊獎勵發放</h3>
            <p className="text-muted-foreground mt-1 text-sm">
                使用複合篩選條件或指定單一玩家來發放獎勵。
            </p>
            
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>1. 選擇目標</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={mode} onValueChange={(v) => { setMode(v as any); setFilters({}); setPreview(null); setSelectedUser('') }} className="mb-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="filter" id="filter" /><Label htmlFor="filter">複合篩選</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="single" id="single" /><Label htmlFor="single">指定單一玩家</Label></div>
                    </RadioGroup>
                    
                    {mode === 'filter' && (
                        <div className="p-4 border rounded-md bg-muted/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* Filters */}
                            <Select onValueChange={v => setFilters(f => ({ ...f, factionId: v === 'all' ? undefined : v }))} value={filters.factionId || 'all'}>
                                <SelectTrigger><SelectValue placeholder="所有陣營" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">所有陣營</SelectItem>
                                    {Object.values(FACTIONS).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                             <Select onValueChange={v => setFilters(f => ({ ...f, raceId: v === 'all' ? undefined : v }))} value={filters.raceId || 'all'}>
                                <SelectTrigger><SelectValue placeholder="所有種族" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">所有種族</SelectItem>
                                    {Object.values(RACES).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 items-center">
                                <Label className="shrink-0">榮譽點</Label>
                                <Select onValueChange={v => setFilters(f => ({ ...f, honorPoints_op: v as any}))} value={filters.honorPoints_op || '>='}><SelectTrigger className="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent></Select>
                                <Input type="number" placeholder="數量" value={filters.honorPoints_val ?? ''} onChange={e => setFilters(f => ({...f, honorPoints_val: e.target.value === '' ? undefined : parseInt(e.target.value)}))}/>
                            </div>
                             <div className="flex gap-2 items-center">
                                <Label className="shrink-0">累計貨幣</Label>
                                <Select onValueChange={v => setFilters(f => ({ ...f, currency_op: v as any}))} value={filters.currency_op || '>='}><SelectTrigger className="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent></Select>
                                <Input type="number" placeholder="數量" value={filters.currency_val ?? ''} onChange={e => setFilters(f => ({...f, currency_val: e.target.value === '' ? undefined : parseInt(e.target.value)}))}/>
                            </div>
                             <div className="flex gap-2 items-center">
                                <Label className="shrink-0">任務數</Label>
                                <Select onValueChange={v => setFilters(f => ({ ...f, taskCount_op: v as any}))} value={filters.taskCount_op || '>='}><SelectTrigger className="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent></Select>
                                <Input type="number" placeholder="數量" value={filters.taskCount_val ?? ''} onChange={e => setFilters(f => ({...f, taskCount_val: e.target.value === '' ? undefined : parseInt(e.target.value)}))}/>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Label className="shrink-0">共鬥次數</Label>
                                <Select onValueChange={v => setFilters(f => ({ ...f, participatedBattleCount_op: v as any}))} value={filters.participatedBattleCount_op || '>='}><SelectTrigger className="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent></Select>
                                <Input type="number" placeholder="次數" value={filters.participatedBattleCount_val ?? ''} onChange={e => setFilters(f => ({...f, participatedBattleCount_val: e.target.value === '' ? undefined : parseInt(e.target.value)}))}/>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Label className="shrink-0">倒下次數</Label>
                                <Select onValueChange={v => setFilters(f => ({ ...f, hpZeroCount_op: v as any}))} value={filters.hpZeroCount_op || '>='}><SelectTrigger className="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent></Select>
                                <Input type="number" placeholder="次數" value={filters.hpZeroCount_val ?? ''} onChange={e => setFilters(f => ({...f, hpZeroCount_val: e.target.value === '' ? undefined : parseInt(e.target.value)}))}/>
                            </div>
                             <div className="flex gap-2 items-center">
                                <Label className="shrink-0">道具使用</Label>
                                <Select onValueChange={v => setFilters(f => ({ ...f, itemUse_id: v === 'none' ? undefined : v as any}))} value={filters.itemUse_id || 'none'}>
                                  <SelectTrigger><SelectValue placeholder="選擇道具"/></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">無</SelectItem>
                                    {allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Select onValueChange={v => setFilters(f => ({ ...f, itemUse_op: v as any}))} value={filters.itemUse_op || '>='}><SelectTrigger className="w-24"><SelectValue placeholder=">=" /></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent></Select>
                                <Input type="number" placeholder="次數" value={filters.itemUse_val ?? ''} onChange={e => setFilters(f => ({...f, itemUse_val: e.target.value === '' ? undefined : parseInt(e.target.value)}))}/>
                            </div>
                        </div>
                    )}
                    {mode === 'single' && (
                        <Select onValueChange={setSelectedUser} value={selectedUser}>
                            <SelectTrigger><SelectValue placeholder="選擇一個玩家..." /></SelectTrigger>
                            <SelectContent>
                                {allUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.roleName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>2. 設定獎勵內容</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2 items-center">
                        <Label className="shrink-0">活動日誌訊息</Label>
                        <Input placeholder="例如：新年紅包" value={rewards.logMessage} onChange={e => setRewards(r => ({ ...r, logMessage: e.target.value }))} />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label>榮譽點</Label>
                             <Input type="number" value={rewards.honorPoints} onChange={e => setRewards(r => ({ ...r, honorPoints: parseInt(e.target.value) || 0}))} />
                        </div>
                        <div className="space-y-2">
                             <Label>貨幣</Label>
                             <Input type="number" value={rewards.currency} onChange={e => setRewards(r => ({ ...r, currency: parseInt(e.target.value) || 0}))} />
                        </div>
                         <div className="space-y-2">
                            <Label>道具</Label>
                            <Select onValueChange={v => setRewards(r => ({ ...r, itemId: v === 'none' ? '' : v}))} value={rewards.itemId || 'none'}>
                                <SelectTrigger><SelectValue placeholder="選擇道具"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">無</SelectItem>
                                    {allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <Label>稱號</Label>
                            <Select onValueChange={v => setRewards(r => ({ ...r, titleId: v === 'none' ? '' : v}))} value={rewards.titleId || 'none'}>
                                <SelectTrigger><SelectValue placeholder="選擇稱號"/></SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="none">無</SelectItem>
                                     {allTitles.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                         </div>
                     </div>
                </CardContent>
            </Card>

             <Card className="mt-4">
                <CardHeader>
                    <CardTitle>3. 預覽與發放</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button onClick={handlePreview} disabled={isProcessing} className="w-full">
                        {isProcessing && !preview ? '預覽中...' : '預覽發放對象'}
                    </Button>
                    {preview && (
                        <div className="mt-4 p-4 border rounded-md">
                            <h4 className="font-semibold">預覽結果：共 {preview.count} 位玩家</h4>
                            {preview.count > 0 ? (
                                <>
                                <ScrollArea className="h-40 mt-2">
                                    <ul className="text-sm text-muted-foreground list-disc pl-5">
                                        {preview.users.map(u => <li key={u.id}>{u.roleName}</li>)}
                                    </ul>
                                </ScrollArea>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full mt-4" disabled={isProcessing}>確認發放</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>您確定要發放獎勵嗎？</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                此操作將會對 {preview.count} 位玩家發放獎勵，此操作無法復原。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>取消</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDistribute}>確定發放</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </>
                            ) : <p className="text-muted-foreground text-center py-4">沒有符合條件的玩家。</p>}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}

function BattleLogViewer({ battleId, battleName }: { battleId: string, battleName: string }) {
    const [logs, setLogs] = useState<CombatLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const result = await getBattleLogs(battleId);
        if (result.error) {
            setError(result.error);
        } else {
            setLogs(result.logs || []);
        }
        setIsLoading(false);
    }, [battleId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return (
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>戰鬥紀錄: {battleName}</DialogTitle>
                <DialogDescription>此戰場的所有事件紀錄。</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] mt-4 pr-4">
                {isLoading && <Skeleton className="h-full w-full" />}
                {error && <Alert variant="destructive"><AlertTitle>錯誤</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                {!isLoading && !error && logs.length === 0 && <p className="text-muted-foreground text-center py-8">沒有紀錄</p>}
                <div className="space-y-2 font-mono text-sm">
                    {logs.map(log => (
                        <p key={log.id}><span className="text-muted-foreground mr-2">[{new Date(log.timestamp).toLocaleString()}]</span>{log.logData}</p>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    )
}

function DamageRewardDialog({ battleId, battleName, allItems, allTitles, onAwarded }: { battleId: string, battleName: string, allItems: Item[], allTitles: Title[], onAwarded: () => void}) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [damageStats, setDamageStats] = useState<any[] | null>(null);

    const [thresholdReward, setThresholdReward] = useState({ enabled: true, damageThreshold: 1000, titleId: ''});
    const [topYeluPlayerReward, setTopYeluPlayerReward] = useState({ enabled: false, titleId: '', itemId: '', honorPoints: 0, currency: 0 });
    const [topAssociationPlayerReward, setTopAssociationPlayerReward] = useState({ enabled: false, titleId: '', itemId: '', honorPoints: 0, currency: 0 });
    const [topWandererPlayerReward, setTopWandererPlayerReward] = useState({ enabled: false, titleId: '', itemId: '', honorPoints: 0, currency: 0 });


    const handlePreviewDamage = async () => {
        setIsProcessing(true);
        setDamageStats(null);
        try {
            const result = await awardBattleDamageRewards({ 
                battleId, 
                isPreview: true, 
                thresholdReward: { enabled: false, damageThreshold: 0, titleId: '' }, 
                topYeluPlayerReward: { enabled: false }, 
                topAssociationPlayerReward: { enabled: false },
                topWandererPlayerReward: { enabled: false },
            });
            if (result.error) throw new Error(result.error);
            setDamageStats(result.damageStats || []);
            if (!result.damageStats || result.damageStats.length === 0) {
                 toast({ variant: 'default', title: '無傷害紀錄', description: '此戰場沒有玩家造成傷害的紀錄。' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: '預覽失敗', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    }

    const handleAward = async () => {
        setIsProcessing(true);
        try {
            const result = await awardBattleDamageRewards({
                battleId,
                thresholdReward,
                topYeluPlayerReward,
                topAssociationPlayerReward,
                topWandererPlayerReward
            });
            if (result.error) throw new Error(result.error);
            toast({ title: '操作成功', description: result.message, duration: 8000 });
            onAwarded();
            setIsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: '操作失敗', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Award className="h-4 w-4 mr-2"/>結算傷害獎勵</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>結算戰役傷害獎勵: {battleName}</DialogTitle>
                    <DialogDescription>為在此戰役中表現出色的玩家授予獎勵。</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    {/* Damage Stats Preview */}
                    <div className="space-y-2">
                        <Button variant="secondary" onClick={handlePreviewDamage} disabled={isProcessing} className="w-full">
                           <BarChart className="h-4 w-4 mr-2"/> {isProcessing && damageStats === null ? '讀取中...' : '預覽傷害統計'}
                        </Button>
                        {damageStats && (
                            <div className="border rounded-md max-h-48 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>玩家</TableHead>
                                            <TableHead>陣營</TableHead>
                                            <TableHead className="text-right">總傷害</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {damageStats.map(stat => (
                                            <TableRow key={stat.userId}>
                                                <TableCell>{stat.roleName}</TableCell>
                                                <TableCell>
                                                    <Badge style={{ backgroundColor: FACTIONS[stat.factionId as keyof typeof FACTIONS]?.color, color: 'white' }}>
                                                        {FACTIONS[stat.factionId as keyof typeof FACTIONS]?.name || stat.factionId}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">{stat.totalDamage}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                    <Separator/>

                    {/* Threshold Reward */}
                    <div className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="threshold-enabled" className="text-base font-semibold flex items-center gap-2">
                                <Award className="h-5 w-5"/> 傷害達標獎
                            </Label>
                            <Switch id="threshold-enabled" checked={thresholdReward.enabled} onCheckedChange={(c) => setThresholdReward(s => ({...s, enabled: c}))} />
                        </div>
                        <div className={cn("space-y-4", !thresholdReward.enabled && "opacity-50 pointer-events-none")}>
                            <div className="space-y-2">
                                <Label>傷害閾值</Label>
                                <Input type="number" value={thresholdReward.damageThreshold} onChange={e => setThresholdReward(s => ({...s, damageThreshold: parseInt(e.target.value) || 0}))} />
                            </div>
                            <div className="space-y-2">
                                <Label>授予稱號</Label>
                                <Select value={thresholdReward.titleId} onValueChange={(v) => setThresholdReward(s => ({...s, titleId: v}))}>
                                    <SelectTrigger><SelectValue placeholder="選擇一個稱號"/></SelectTrigger>
                                    <SelectContent>
                                        {allTitles.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                     <Separator />
                    {/* Top Player Rewards */}
                    {[
                        { id: 'yelu', label: '夜鷺', state: topYeluPlayerReward, setter: setTopYeluPlayerReward },
                        { id: 'association', label: '協會', state: topAssociationPlayerReward, setter: setTopAssociationPlayerReward },
                        { id: 'wanderer', label: '流浪者/其他', state: topWandererPlayerReward, setter: setTopWandererPlayerReward },
                    ].map(({ id, label, state, setter }) => {
                        const factionInfo = FACTIONS[id as keyof typeof FACTIONS];
                        return (
                            <div key={id} className="p-4 border rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={`${id}-mvp-enabled`} className="text-base font-semibold flex items-center gap-2" style={{color: factionInfo?.color}}>
                                        <Award className="h-5 w-5"/> {label} 傷害冠軍獎 (MVP)
                                    </Label>
                                    <Switch id={`${id}-mvp-enabled`} checked={state.enabled} onCheckedChange={(c) => setter(s => ({...s, enabled: c}))} />
                                </div>
                                <div className={cn("grid grid-cols-2 gap-4", !state.enabled && "opacity-50 pointer-events-none")}>
                                     <div className="space-y-2">
                                        <Label>榮譽點</Label>
                                        <Input type="number" value={state.honorPoints} onChange={e => setter(s => ({...s, honorPoints: parseInt(e.target.value) || 0}))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>貨幣</Label>
                                        <Input type="number" value={state.currency} onChange={e => setter(s => ({...s, currency: parseInt(e.target.value) || 0}))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>獎勵道具</Label>
                                         <Select value={state.itemId || 'none'} onValueChange={(v) => setter(s => ({...s, itemId: v === 'none' ? undefined : v}))}>
                                            <SelectTrigger><SelectValue placeholder="無"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">無</SelectItem>
                                                {allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>獎勵稱號</Label>
                                         <Select value={state.titleId || 'none'} onValueChange={(v) => setter(s => ({...s, titleId: v === 'none' ? undefined : v}))}>
                                            <SelectTrigger><SelectValue placeholder="無"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">無</SelectItem>
                                                {allTitles.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
                    <Button onClick={handleAward} disabled={isProcessing}>{isProcessing && damageStats !== null ? '結算中...' : '確認發放'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function BattleManagement({ allItems, allTitles, allCombatEncounters, onRefresh }: { allItems: Item[], allTitles: Title[], allCombatEncounters: CombatEncounter[], onRefresh: () => void }) {
    const { toast } = useToast();
    const [battleName, setBattleName] = useState('');
    const [yeluMonsters, setYeluMonsters] = useState<Partial<Monster>[]>([]);
    const [associationMonsters, setAssociationMonsters] = useState<Partial<Monster>[]>([]);
    const [commonMonsters, setCommonMonsters] = useState<Partial<Monster>[]>([]);
    const [rewards, setRewards] = useState<EndOfBattleRewards>({ honorPoints: 0, currency: 0, logMessage: '' });
    const [isLoading, setIsLoading] = useState(false);
    
    const [newMonster, setNewMonster] = useState<Partial<Omit<Monster, 'monsterId' | 'originalHp'>>>({ name: '', factionId: 'yelu', hp: 1000, atk: '10+1d6', imageUrl: 'https://images.plurk.com/' });
    const [isAddingMonster, setIsAddingMonster] = useState(false);
    
    const currentBattle = useMemo(() => allCombatEncounters?.[0] && allCombatEncounters[0].status !== 'closed' ? allCombatEncounters[0] : null, [allCombatEncounters]);

    const addMonster = (faction: 'yelu' | 'association' | 'common') => {
        const newMonster: Partial<Monster> = { name: '', imageUrl: 'https://images.plurk.com/', hp: 1000, atk: '10+1D6', factionId: faction };
        if (faction === 'yelu') setYeluMonsters([...yeluMonsters, newMonster]);
        else if (faction === 'association') setAssociationMonsters([...associationMonsters, newMonster]);
        else setCommonMonsters([...commonMonsters, newMonster]);
    };

    const updateMonsterList = (setter: React.Dispatch<React.SetStateAction<Partial<Monster>[]>>, index: number, field: keyof Monster, value: any) => {
        setter(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };
    
    const removeMonsterFromList = (setter: React.Dispatch<React.SetStateAction<Partial<Monster>[]>>, index: number) => {
       setter(prev => prev.filter((_, i) => i !== index));
    }

    const handleCreateBattle = async () => {
        if (!battleName) {
            toast({ variant: 'destructive', title: '錯誤', description: '請為戰場命名。' });
            return;
        }
        if (yeluMonsters.length === 0 && associationMonsters.length === 0 && commonMonsters.length === 0) {
            toast({ variant: 'destructive', title: '錯誤', description: '請至少新增一隻災獸。' });
            return;
        }
        
        setIsLoading(true);
        try {
            const allMonsters = [...yeluMonsters, ...associationMonsters, ...commonMonsters];
            const result = await createBattle({ name: battleName, monsters: allMonsters as Omit<Monster, 'monsterId' | 'originalHp'>[], rewards });
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: `戰場「${battleName}」已開啟！準備時間 30 分鐘。` });
            setBattleName('');
            setYeluMonsters([]);
            setAssociationMonsters([]);
            setCommonMonsters([]);
            setRewards({ honorPoints: 0, currency: 0, logMessage: '' });
            onRefresh();
        } catch (error: any) {
             toast({ variant: 'destructive', title: '開啟失敗', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartBattle = async () => {
        if (!currentBattle) return;
        setIsLoading(true);
        try {
            const result = await startBattle(currentBattle.id);
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: '戰場已正式開始！' });
            onRefresh();
        } catch (error: any) {
             toast({ variant: 'destructive', title: '操作失敗', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }

    const handleEndBattle = async () => {
        if (!currentBattle) return;
        setIsLoading(true);
        try {
            const result = await endBattle(currentBattle.id);
            if (result.error) throw new Error(result.error);
            toast({ title: '操作成功', description: result.message });
            onRefresh();
        } catch (error: any) {
             toast({ variant: 'destructive', title: '操作失敗', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleAddMonster = async () => {
        if (!currentBattle || !newMonster.name) {
             toast({ variant: 'destructive', title: '錯誤', description: '請填寫災獸名稱。' });
            return;
        }
        setIsAddingMonster(true);
        try {
            const result = await addMonsterToBattle(currentBattle.id, newMonster as Omit<Monster, 'monsterId' | 'originalHp'>);
            if (result.error) throw new Error(result.error);
            toast({ title: '成功', description: `已將「${newMonster.name}」增援至戰場！` });
            setNewMonster({ name: '', factionId: 'yelu', hp: 1000, atk: '10+1d6', imageUrl: 'https://images.plurk.com/' });
            onRefresh();
        } catch (error: any) {
             toast({ variant: 'destructive', title: '增援失敗', description: error.message });
        } finally {
            setIsAddingMonster(false);
        }
    };


    const renderMonsterForm = (faction: 'yelu' | 'association' | 'common', monsters: Partial<Monster>[], setter: React.Dispatch<React.SetStateAction<Partial<Monster>[]>>) => {
        const factionInfo = faction === 'common' ? { name: '通用', color: 'hsl(var(--primary))' } : FACTIONS[faction];
        return (
            <Card style={{borderColor: factionInfo.color}}>
                <CardHeader className="flex-row items-center justify-between">
                    <CardTitle style={{color: factionInfo.color}}>{factionInfo.name} 災獸</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => addMonster(faction)}><Plus className="h-4 w-4 mr-2" />新增</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {monsters.map((monster, index) => (
                        <div key={index} className="p-4 border rounded-md space-y-3 relative bg-card/50">
                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-muted-foreground" onClick={() => removeMonsterFromList(setter, index)}><X className="h-4 w-4"/></Button>
                            <div className="space-y-1">
                                <Label>災獸名稱</Label>
                                <Input value={monster.name} onChange={(e) => updateMonsterList(setter, index, 'name', e.target.value)} />
                            </div>
                             <div className="space-y-1">
                                <Label>圖片網址</Label>
                                <Input value={monster.imageUrl} onChange={(e) => updateMonsterList(setter, index, 'imageUrl', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>HP</Label>
                                    <Input type="number" value={monster.hp} onChange={(e) => updateMonsterList(setter, index, 'hp', parseInt(e.target.value))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>ATK (格式: 20+1D10)</Label>
                                    <Input value={monster.atk} onChange={(e) => updateMonsterList(setter, index, 'atk', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ))}
                    {monsters.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">此分類尚無災獸</p>}
                </CardContent>
            </Card>
        )
    }

    return (
        <div>
            <h3 className="text-lg font-semibold">共鬥管理</h3>
            <p className="text-muted-foreground mt-2">
                開啟新的共鬥戰場，設定災獸屬性，並查看過去的戰鬥紀錄。
            </p>
            {isLoading ? <Skeleton className="h-48 w-full mt-4" /> : currentBattle && currentBattle.status !== 'ended' && (
              <Card className="mt-4 border-primary">
                  <CardHeader>
                      <CardTitle>當前戰場：{currentBattle.name}</CardTitle>
                      <CardDescription>
                          狀態：<Badge variant={currentBattle.status === 'active' ? 'destructive' : 'secondary'}>{currentBattle.status}</Badge>
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                        <div>
                             <h4 className="font-semibold mb-2">災獸資訊</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {currentBattle.monsters.map((monster, i) => (
                                    <div key={monster.monsterId} className="flex justify-between items-center text-sm p-2 border rounded-md">
                                        <span>{monster.name} ({monster.factionId})</span>
                                        <span className="font-mono text-muted-foreground">HP: {monster.hp} / ATK: {monster.atk}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Plus className="h-4 w-4 mr-2"/>增援災獸</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>新增災獸至目前戰場</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2"><Label>災獸名稱</Label><Input value={newMonster.name} onChange={e => setNewMonster({...newMonster, name: e.target.value})}/></div>
                                    <div className="space-y-2"><Label>圖片網址</Label><Input value={newMonster.imageUrl} onChange={e => setNewMonster({...newMonster, imageUrl: e.target.value})}/></div>
                                    <div className="space-y-2"><Label>HP</Label><Input type="number" value={newMonster.hp} onChange={e => setNewMonster({...newMonster, hp: parseInt(e.target.value)})}/></div>
                                    <div className="space-y-2"><Label>ATK (格式: 20+1d10)</Label><Input value={newMonster.atk} onChange={e => setNewMonster({...newMonster, atk: e.target.value})}/></div>
                                    <div className="space-y-2"><Label>所屬陣營</Label>
                                     <Select value={newMonster.factionId} onValueChange={(v) => setNewMonster({ ...newMonster, factionId: v as any })}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yelu">夜鷺</SelectItem>
                                            <SelectItem value="association">協會</SelectItem>
                                            <SelectItem value="common">通用</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
                                    <Button onClick={handleAddMonster} disabled={isAddingMonster}>{isAddingMonster ? '新增中...' : '確認新增'}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                  </CardContent>
                  <CardFooter className="gap-2">
                        {currentBattle.status === 'preparing' && (
                            <Button onClick={handleStartBattle} disabled={isLoading} variant="destructive">手動開始戰鬥</Button>
                        )}
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isLoading}>結束戰場並發放獎勵</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>確認結束戰場？</AlertDialogTitle>
                                <AlertDialogDescription>此操作將會結束當前戰場，並根據設定發放獎勵給所有參與者。此動作無法復原。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={handleEndBattle}>確認結束</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                  </CardFooter>
              </Card>
            )}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>開啟新戰場</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="battle-name">戰場名稱</Label>
                        <Input id="battle-name" value={battleName} onChange={(e) => setBattleName(e.target.value)} placeholder="例如：月度BOSS戰、緊急討伐任務"/>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {renderMonsterForm('yelu', yeluMonsters, setYeluMonsters)}
                        {renderMonsterForm('association', associationMonsters, setAssociationMonsters)}
                        {renderMonsterForm('common', commonMonsters, setCommonMonsters)}
                    </div>
                    <div>
                        <Label className="text-base font-semibold">結束戰場獎勵</Label>
                        <div className="p-4 mt-2 border rounded-lg space-y-4">
                           <div className="space-y-2">
                             <Label>活動日誌訊息</Label>
                             <Input placeholder="例如：成功討伐ＯＯＯ獎勵" value={rewards.logMessage} onChange={e => setRewards(r => ({ ...r, logMessage: e.target.value }))} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                <Label>榮譽點</Label>
                                <Input type="number" value={rewards.honorPoints} onChange={e => setRewards(r => ({ ...r, honorPoints: parseInt(e.target.value) || 0}))} />
                               </div>
                               <div className="space-y-2">
                                <Label>貨幣</Label>
                                <Input type="number" value={rewards.currency} onChange={e => setRewards(r => ({ ...r, currency: parseInt(e.target.value) || 0}))} />
                               </div>
                           </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>獎勵道具 (選填)</Label>
                                    <Select onValueChange={v => setRewards(r => ({...r, itemId: v === 'none' ? undefined : v}))}>
                                        <SelectTrigger><SelectValue placeholder="選擇道具"/></SelectTrigger>
                                        <SelectContent><SelectItem value="none">無</SelectItem>{allItems?.map(i => <SelectItem value={i.id} key={i.id}>{i.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label>獎勵称號 (選填)</Label>
                                     <Select onValueChange={v => setRewards(r => ({...r, titleId: v === 'none' ? undefined : v}))}>
                                        <SelectTrigger><SelectValue placeholder="選擇稱號"/></SelectTrigger>
                                        <SelectContent><SelectItem value="none">無</SelectItem>{allTitles?.map(t => <SelectItem value={t.id} key={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                           </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleCreateBattle} disabled={isLoading || (!!currentBattle && currentBattle.status !== 'ended')} className="w-full">
                        {isLoading ? "開啟中..." : (!!currentBattle && currentBattle.status !== 'ended') ? '有戰場正在進行中' : "確認并開啟戰場"}
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-8">
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><History /> 歷史戰場紀錄</h3>
                 <div className="border rounded-md">
                     <Table>
                        <TableHeader><TableRow><TableHead>名稱</TableHead><TableHead>狀態</TableHead><TableHead>開始時間</TableHead><TableHead>結束時間</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="w-full h-10"/></TableCell></TableRow>
                            : allCombatEncounters && allCombatEncounters.length > 0 ? allCombatEncounters.map(b => (
                                <TableRow key={b.id}>
                                    <TableCell>{b.name}</TableCell>
                                    <TableCell><Badge variant={b.status === 'ended' ? 'outline' : 'default'}>{b.status}</Badge></TableCell>
                                    <TableCell>{b.startTime ? new Date(b.startTime).toLocaleString() : '-'}</TableCell>
                                    <TableCell>{b.endTime ? new Date(b.endTime).toLocaleString() : '-'}</TableCell>
                                    <TableCell className="space-x-2">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="sm">查看 Log</Button>
                                            </DialogTrigger>
                                            <BattleLogViewer battleId={b.id} battleName={b.name}/>
                                        </Dialog>
                                         {b.status === 'ended' && (
                                            <DamageRewardDialog battleId={b.id} battleName={b.name} allItems={allItems} allTitles={allTitles} onAwarded={onRefresh} />
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="h-24 text-center">沒有任何歷史戰場紀錄</TableCell></TableRow>}
                        </TableBody>
                     </Table>
                 </div>
            </div>
        </div>
    );
}

export default function AdminPage() {
  const [adminData, setAdminData] = useState<Awaited<ReturnType<typeof getAdminData>>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    const data = await getAdminData();
    setAdminData(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  if (isLoading) {
    return (
        <div className="w-full">
            <Card>
                <CardHeader>
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-5 w-72" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-full mb-4" />
                    <Skeleton className="h-96 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  if (adminData.error) {
     return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>讀取管理資料失敗</AlertTitle>
        <AlertDescription>
          <pre className="mt-2 text-xs bg-black/20 p-2 rounded-md font-mono">{adminData.error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

  const tabs = [
    { value: 'accounts', label: '帳號審核' },
    { value: 'tasks', label: '任務中心' },
    { value: 'store', label: '商店道具' },
    { value: 'crafting', label: '裝備合成' },
    { value: 'battle', label: '共鬥管理' },
    { value: 'skills', label: '技能管理' },
    { value: 'titles', label: '稱號管理' },
    { value: 'rewards', label: '獎勵發放' },
    { value: 'history', label: '歷史紀錄' },
  ];

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">管理員後台</CardTitle>
          <CardDescription>
            管理遊戲的各個方面。此頁面僅供管理員存取。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="flex flex-wrap h-auto sm:grid sm:h-auto sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
              {tabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-4 p-4 border rounded-md min-h-[400px]">
              <TabsContent value="accounts">
                <AccountApproval />
              </TabsContent>
              <TabsContent value="tasks">
                <TaskManagement />
              </TabsContent>
              <TabsContent value="store">
                 <StoreManagement />
              </TabsContent>
               <TabsContent value="crafting">
                 <CraftingManagement />
              </TabsContent>
              <TabsContent value="battle">
                 <BattleManagement 
                    allItems={adminData.items || []}
                    allTitles={adminData.titles || []}
                    allCombatEncounters={adminData.combatEncounters || []}
                    onRefresh={fetchAllData}
                 />
              </TabsContent>
              <TabsContent value="history">
                <Link href="/dashboard/admin/history">前往歷史賽季與資料庫管理</Link>
              </TabsContent>
               <TabsContent value="skills">
                 <SkillManagement />
              </TabsContent>
               <TabsContent value="titles">
                 <TitleManagement />
              </TabsContent>
               <TabsContent value="rewards">
                  <RewardDistribution />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
