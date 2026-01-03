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
import { useState, useEffect, useMemo } from 'react';
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
import { RefreshCw, Trash2, Edit, Plus, X, Hammer, ArrowRight, WandSparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import Image from 'next/image';
import type { User, TaskType, Item, AttributeEffect, TriggeredEffect, CraftRecipe, Skill, SkillEffect, SkillEffectType } from '@/lib/types';
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

function AccountApproval() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
    } catch (error: any) {
      setError(error.message);
      setTaskTypes([]);
      setItems([]);
      setTitles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);
  
  const handleSave = async (taskData: Partial<TaskType>) => {
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
          無法從後端讀取任務類型。請檢查伺服器日誌以獲取更多詳細資訊。
          <pre className="mt-2 text-xs bg-black/20 p-2 rounded-md font-mono">{error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

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
                items={items}
                titles={titles}
            />
        )}
        
        <div className="border rounded-md mt-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>名稱</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead>榮譽</TableHead>
                        <TableHead>貨幣</TableHead>
                        <TableHead>操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                 {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : taskTypes.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">尚未建立任何任務類型</TableCell>
                    </TableRow>
                ) : (
                    taskTypes.map(task => (
                        <TableRow key={task.id}>
                            <TableCell className="font-mono">{task.id}</TableCell>
                            <TableCell className="font-medium">{task.name}</TableCell>
                            <TableCell>{task.category}</TableCell>
                            <TableCell>{task.honorPoints}</TableCell>
                            <TableCell>{task.currency}</TableCell>
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
                                            <Button variant="destructive" onClick={() => handleSave({...task, id: task.id, _delete: true})}>刪除</Button>
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

const itemTypeTranslations: { [key: string]: string } = {
  equipment: '裝備',
  consumable: '戰鬥道具',
  special: '特殊道具',
};

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
          <Select value={editedItem.itemTypeId} onValueChange={(value) => setEditedItem({ ...editedItem, itemTypeId: value as Item['itemTypeId'] })}>
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
              {Object.values(FACTIONS).map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
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
                { (isEquipment || isConsumable) && <Button size="sm" variant="outline" onClick={() => setEditedItem(prev => ({ ...prev, effects: [...(prev.effects || []), isEquipment ? { attribute: 'atk', operator: '+', value: 0 } : { trigger: 'on_use', probability: 100, effectType: 'hp_recovery', value: 0 }] }))}><Plus className="mr-2 h-4 w-4"/>新增效果</Button>}
            </div>

            { (editedItem.effects || []).map((effect, index) => (
                <div key={index} className="p-3 border rounded-md bg-background/50 space-y-4 relative">
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setEditedItem(prev => ({ ...prev, effects: prev.effects?.filter((_, i) => i !== index) }))}><X className="h-4 w-4"/></Button>
                   
                    {isEquipment && 'attribute' in effect && (
                        <div className="grid grid-cols-3 gap-2">
                            <Select value={effect.attribute} onValueChange={v => setEditedItem(prev => ({...prev, effects: prev.effects?.map((e, i) => i === index ? {...e, attribute: v} : e)}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="atk">ATK</SelectItem>
                                    <SelectItem value="def">DEF</SelectItem>
                                    <SelectItem value="hp">HP</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select value={effect.operator} onValueChange={v => setEditedItem(prev => ({...prev, effects: prev.effects?.map((e, i) => i === index ? {...e, operator: v} : e)}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="+">+</SelectItem>
                                    <SelectItem value="*">*</SelectItem>
                                    <SelectItem value="d">d (骰)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="number" value={effect.value} onChange={e => setEditedItem(prev => ({...prev, effects: prev.effects?.map((ef, i) => i === index ? {...ef, value: parseFloat(e.target.value) || 0} : ef)}))} />
                        </div>
                    )}

                    {isConsumable && 'trigger' in effect && (
                        <div className="space-y-3">
                           <div className="grid grid-cols-3 gap-2">
                             <Select value={effect.effectType} onValueChange={v => setEditedItem(prev => ({...prev, effects: prev.effects?.map((e, i) => i === index ? {...e, effectType: v} : e)}))}>
                                <SelectTrigger><SelectValue placeholder="效果類型"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hp_recovery">恢復HP</SelectItem>
                                    <SelectItem value="damage_enemy">造成傷害</SelectItem>
                                    <SelectItem value="atk_buff">攻擊加成</SelectItem>
                                    <SelectItem value="def_buff">防禦加成</SelectItem>
                                    <SelectItem value="hp_cost">扣除HP</SelectItem>
                                </SelectContent>
                            </Select>
                             <Input type="number" placeholder="數值" value={effect.value} onChange={e => setEditedItem(prev => ({...prev, effects: prev.effects?.map((ef, i) => i === index ? {...ef, value: parseFloat(e.target.value) || 0} : ef)}))} />
                             <Input type="number" placeholder="機率 (0-100)%" value={effect.probability} onChange={e => setEditedItem(prev => ({...prev, effects: prev.effects?.map((ef, i) => i === index ? {...ef, probability: parseFloat(e.target.value) || 0} : ef)}))} />
                           </div>
                           <Input type="number" placeholder="持續回合數 (選填)" value={effect.duration} onChange={e => setEditedItem(prev => ({...prev, effects: prev.effects?.map((ef, i) => i === index ? {...ef, duration: parseInt(e.target.value) || undefined} : ef)}))} />
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
     <div>
        <h3 className="text-lg font-semibold">陣營對抗管理</h3>
        <p className="text-muted-foreground mt-2">
            重置陣營積分以開啟新賽季，並存檔當前賽季的結果。
        </p>
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4" disabled={isResetting}>
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
    </div>
  )
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
        <AlertTitle>讀取失敗</AlertTitle>
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
    owner: { type: 'faction' | 'race'; id: string };
}) {
    const [editedSkill, setEditedSkill] = useState<Partial<Skill>>({
        ...skill,
        factionId: owner.type === 'faction' ? owner.id : skill.factionId,
        raceId: owner.type === 'race' ? owner.id : skill.raceId,
        effects: skill.effects || [],
    });

    const handleEffectChange = (index: number, field: keyof SkillEffect, value: any) => {
        const newEffects = [...(editedSkill.effects || [])];
        const effect = { ...newEffects[index], [field]: value };

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
        const newEffect: SkillEffect = { effectType: 'hp_recovery' };
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
                            <Input type="number" placeholder="數值" value={effect.value || ''} onChange={e => handleEffectChange(index, 'value', parseInt(e.target.value))} />
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
    const [activePrimaryTab, setActivePrimaryTab] = useState<'faction' | 'race'>('faction');
    const [activeSecondaryTab, setActiveSecondaryTab] = useState<string>('yelu');

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

    const handlePrimaryTabChange = (value: string) => {
        const tab = value as 'faction' | 'race';
        setActivePrimaryTab(tab);
        setEditingSkill(null);
        setActiveSecondaryTab(tab === 'faction' ? 'yelu' : 'corruptor');
    };
    
    const handleSecondaryTabChange = (value: string) => {
        setActiveSecondaryTab(value);
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
        return skills.filter(skill => {
            if (activePrimaryTab === 'faction') return skill.factionId === activeSecondaryTab;
            return skill.raceId === activeSecondaryTab;
        });
    }, [skills, activePrimaryTab, activeSecondaryTab]);
    
    const secondaryTabs = activePrimaryTab === 'faction' ? FACTIONS : RACES;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold">技能管理</h3>
                    <p className="text-muted-foreground mt-1 text-sm">管理不同陣營和種族的可用技能。</p>
                </div>
                 <Button onClick={() => setEditingSkill({ cooldown: 0, effects: [] })} disabled={!!editingSkill}>新增技能</Button>
            </div>
            
            <Tabs value={activePrimaryTab} onValueChange={handlePrimaryTabChange}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="faction">陣營技能</TabsTrigger>
                    <TabsTrigger value="race">種族技能</TabsTrigger>
                </TabsList>
            </Tabs>

            <Tabs value={activeSecondaryTab} onValueChange={handleSecondaryTabChange} className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                    {Object.values(secondaryTabs).map(tab => (
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
                    owner={{type: activePrimaryTab, id: activeSecondaryTab}}
                />
            )}

            <div className="border rounded-md mt-4">
                <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>名稱</TableHead><TableHead>冷卻</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                        ) : currentSkills.length > 0 ? (
                            currentSkills.map(skill => (
                                <TableRow key={skill.id}>
                                    <TableCell>{skill.id}</TableCell>
                                    <TableCell>{skill.name}</TableCell>
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
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 md:grid-cols-5 lg:w-max lg:grid-flow-col">
              <TabsTrigger value="accounts">帳號審核</TabsTrigger>
              <TabsTrigger value="missions">任務管理</TabsTrigger>
              <TabsTrigger value="store">商店道具</TabsTrigger>
              <TabsTrigger value="crafting">裝備合成</TabsTrigger>
              <TabsTrigger value="battle">共鬥管理</TabsTrigger>
              <TabsTrigger value="conflict">陣營對抗</TabsTrigger>
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
              <TabsContent value="store">
                 <StoreManagement />
              </TabsContent>
               <TabsContent value="crafting">
                 <CraftingManagement />
              </TabsContent>
              <TabsContent value="battle">
                 <h3 className="text-lg font-semibold">共鬥管理</h3>
                <p className="text-muted-foreground mt-2">
                  開啟新的共鬥戰場，設定怪物屬性，並查看過去的戰鬥紀錄。
                </p>
              </TabsContent>
              <TabsContent value="conflict">
                <ConflictManagement />
              </TabsContent>
               <TabsContent value="skills">
                 <SkillManagement />
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
    </div>
  );
}

    