
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
import { seedDatabase } from '@/app/actions/seed-database';
import { useState, useEffect } from 'react';
import { getAllUsers } from '@/app/actions/get-all-users';
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
import { RefreshCw, Trash2, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import Image from 'next/image';
import type { User, TaskType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTaskTypes } from '@/app/actions/get-task-types';
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

function AccountApproval() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const result = await getAllUsers();
      if (result.error) {
        throw new Error(result.error);
      }
      setUsers(result.users || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '錯誤',
        description: `讀取使用者列表失敗: ${error.message}`,
      });
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
      });

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
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateUser(user.id)}
                      disabled={isUpdating[user.id]}
                    >
                      {isUpdating[user.id] ? '更新中...' : '更新'}
                    </Button>
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

function TaskTypeEditor({
  taskType,
  onSave,
  onCancel,
  isSaving,
}: {
  taskType: Partial<TaskType>;
  onSave: (task: Partial<TaskType>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [editedTask, setEditedTask] = useState(taskType);

  const handleSave = () => {
    // Basic validation
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
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label htmlFor="task-id">ID</Label>
            <Input id="task-id" value={editedTask.id || ''} onChange={e => setEditedTask({...editedTask, id: e.target.value })} disabled={!!taskType.id} placeholder="例如：main, general, premium"/>
        </div>
        <div className="space-y-2">
            <Label htmlFor="task-name">名稱</Label>
            <Input id="task-name" value={editedTask.name || ''} onChange={e => setEditedTask({...editedTask, name: e.target.value })} placeholder="例如：主線任務"/>
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
            <Input id="task-title" value={editedTask.titleAwarded || ''} onChange={e => setEditedTask({...editedTask, titleAwarded: e.target.value })} placeholder="例如：荒漠英雄"/>
        </div>
        <div className="space-y-2">
            <Label htmlFor="task-item">物品獎勵 (選填)</Label>
            <Input id="task-item" value={editedTask.itemAwarded || ''} onChange={e => setEditedTask({...editedTask, itemAwarded: e.target.value })} placeholder="例如：item_id_123"/>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TaskType> | null>(null);

  const fetchTaskTypes = async () => {
    setIsLoading(true);
    try {
      const result = await getTaskTypes();
      if (result.error) throw new Error(result.error);
      setTaskTypes(result.taskTypes || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: '讀取失敗', description: error.message });
      setTaskTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskTypes();
  }, []);
  
  const handleSave = async (taskData: Partial<TaskType>) => {
    setIsSaving(true);
    try {
        const result = await updateTaskType(taskData as TaskType);
        if (result.error) throw new Error(result.error);
        toast({ title: '成功', description: '任務類型已儲存。' });
        setEditingTask(null);
        fetchTaskTypes(); // Refresh list
    } catch (error: any) {
        toast({ variant: 'destructive', title: '儲存失敗', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div>
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
                onSave={handleSave}
                onCancel={() => setEditingTask(null)}
                isSaving={isSaving}
            />
        )}
        
        <div className="border rounded-md mt-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>名稱</TableHead>
                        <TableHead>榮譽</TableHead>
                        <TableHead>貨幣</TableHead>
                        <TableHead>稱號</TableHead>
                        <TableHead>物品</TableHead>
                        <TableHead>操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                 {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : taskTypes.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center h-24">尚未建立任何任務類型</TableCell>
                    </TableRow>
                ) : (
                    taskTypes.map(task => (
                        <TableRow key={task.id}>
                            <TableCell className="font-mono">{task.id}</TableCell>
                            <TableCell className="font-medium">{task.name}</TableCell>
                            <TableCell>{task.honorPoints}</TableCell>
                            <TableCell>{task.currency}</TableCell>
                            <TableCell>{task.titleAwarded || '無'}</TableCell>
                            <TableCell>{task.itemAwarded || '無'}</TableCell>
                            <TableCell className="space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => setEditingTask(task)}>
                                    <Edit className="h-4 w-4"/>
                                </Button>
                                 <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                        <DialogTitle>確認刪除</DialogTitle>
                                        <DialogDescription>
                                            您確定要刪除「{task.name}」這個任務類型嗎？此操作無法復原。
                                        </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
                                            <Button variant="destructive" onClick={() => handleSave({...task, _delete: true})}>刪除</Button>
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


export default function AdminPage() {
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      const result = await seedDatabase();
      if (result.error) {
        throw new Error(result.error);
      }
      toast({
        title: '成功',
        description: '資料庫已成功植入初始資料。',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '錯誤',
        description: `植入資料時發生錯誤：${error.message}`,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">管理員後台</CardTitle>
        <CardDescription>
          管理遊戲的各個方面。此頁面僅供管理員存取。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="accounts">
           <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:w-max lg:grid-flow-col">
            <TabsTrigger value="accounts">帳號審核</TabsTrigger>
            <TabsTrigger value="missions">任務管理</TabsTrigger>
            <TabsTrigger value="battle">共鬥管理</TabsTrigger>
            <TabsTrigger value="conflict">陣營對抗</TabsTrigger>
            <TabsTrigger value="store">商店道具</TabsTrigger>
            <TabsTrigger value="crafting">裝備合成</TabsTrigger>
            <TabsTrigger value="skills">技能管理</TabsTrigger>
            <TabsTrigger value="titles">稱號管理</TabsTrigger>
            <TabsTrigger value="rewards">獎勵發放</TabsTrigger>
            <TabsTrigger value="database">資料庫</TabsTrigger>
          </TabsList>

          <div className="mt-4 p-4 border rounded-md min-h-[400px]">
            <TabsContent value="accounts">
              <AccountApproval />
            </TabsContent>
            <TabsContent value="missions">
              <TaskManagement />
            </TabsContent>
            <TabsContent value="battle">
               <h3 className="text-lg font-semibold">共鬥管理</h3>
              <p className="text-muted-foreground mt-2">
                開啟新的共鬥戰場，設定怪物屬性，並查看過去的戰鬥紀錄。
              </p>
            </TabsContent>
            <TabsContent value="conflict">
               <h3 className="text-lg font-semibold">陣營對抗管理</h3>
              <p className="text-muted-foreground mt-2">
                重置陣營積分以開啟新賽季，並存檔當前賽季的結果。
              </p>
               <Button variant="destructive" className="mt-4">重置賽季積分</Button>
            </TabsContent>
            <TabsContent value="store">
               <h3 className="text-lg font-semibold">商店道具管理</h3>
              <p className="text-muted-foreground mt-2">
                新增、編輯和上下架商店中的商品。
              </p>
            </TabsContent>
             <TabsContent value="crafting">
               <h3 className="text-lg font-semibold">裝備合成管理</h3>
              <p className="text-muted-foreground mt-2">
                定義裝備合成配方。例如：某裝備 + 某物品 = 新裝備。
              </p>
            </TabsContent>
             <TabsContent value="skills">
               <h3 className="text-lg font-semibold">技能管理</h3>
              <p className="text-muted-foreground mt-2">
                管理不同陣營和種族的可用技能。
              </p>
            </TabsContent>
             <TabsContent value="titles">
               <h3 className="text-lg font-semibold">稱號管理</h3>
              <p className="text-muted-foreground mt-2">
                新增和管理一般及隱藏稱號的達成條件。
              </p>
            </TabsContent>
             <TabsContent value="rewards">
               <h3 className="text-lg font-semibold">特殊獎勵發放</h3>
              <p className="text-muted-foreground mt-2">
                使用複合篩選條件向特定玩家群體發放獎勵。
              </p>
            </TabsContent>
            <TabsContent value="database">
               <h3 className="text-lg font-semibold">資料庫管理</h3>
              <p className="text-muted-foreground mt-2">
                執行資料庫維護操作。請謹慎使用。
              </p>
              <Button onClick={handleSeedDatabase} disabled={isSeeding} className="mt-4">
                {isSeeding ? '植入資料中...' : '植入初始遊戲資料'}
              </Button>
               <p className="text-xs text-muted-foreground mt-2">
                點擊此按鈕將會在您的資料庫中建立或覆蓋基礎遊戲資料，例如陣營、種族、任務類型和物品等。
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
