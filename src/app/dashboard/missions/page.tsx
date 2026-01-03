'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { FACTIONS } from '@/lib/game-data';
import { submitTask } from '@/app/actions/submit-task';
import { getTasks, TaskFilter } from '@/app/actions/get-tasks';
import { getUserTasks } from '@/app/actions/get-user-tasks';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { RefreshCw, Gift, Award, Heart, Shield, Gem } from 'lucide-react';
import type { TaskType } from '@/lib/types';


const formSchema = z.object({
  taskCategory: z.string({ required_error: '請選擇一個任務類型' }),
  taskTypeId: z.string({ required_error: '請選擇一個任務' }),
  submissionUrl: z
    .string()
    .url('請輸入有效的網址')
    .startsWith('https://www.plurk.com/', '任務網址必須是噗浪貼文'),
  title: z.string().min(1, '請輸入任務標題或描述'),
  factionContribution: z.string().optional(),
});

function MissionSubmitForm({
  user,
  userData,
  taskTypes,
  onTaskSubmitted,
}: {
  user: any;
  userData: any;
  taskTypes: TaskType[];
  onTaskSubmitted: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionUrl: 'https://www.plurk.com/',
      title: '',
    },
  });

  const isSubmitting = form.formState.isSubmitting;
  const isWanderer = userData?.factionId === 'wanderer';

  const userSubmittedTaskIds = userData?.tasks || [];

  const taskCategories = React.useMemo(() => {
    if (!taskTypes) return [];
    const categories = new Set(taskTypes.map(t => t.category));
    return Array.from(categories);
  }, [taskTypes]);

  const selectedCategory = useWatch({
    control: form.control,
    name: 'taskCategory',
  });

  const filteredTasks = React.useMemo(() => {
    if (!selectedCategory || !taskTypes) return [];
    return taskTypes.filter(t => t.category === selectedCategory);
  }, [selectedCategory, taskTypes]);

  const selectedTaskTypeId = useWatch({
    control: form.control,
    name: 'taskTypeId',
  });

  const selectedTaskType = taskTypes.find(t => t.id === selectedTaskTypeId);

  React.useEffect(() => {
    if (form.getValues('taskCategory')) {
      form.setValue('taskTypeId', '');
    }
  }, [selectedCategory, form]);


  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !userData) {
      toast({
        variant: 'destructive',
        title: '錯誤',
        description: '您必須登入才能提交任務。',
      });
      return;
    }

    if (isWanderer && selectedTaskType && !values.factionContribution) {
      form.setError('factionContribution', {
        message: '身為流浪者，請選擇要貢獻的陣營。',
      });
      return;
    }

    try {
      const result = await submitTask({
        userId: user.uid,
        userName: userData.roleName,
        userFactionId: userData.factionId,
        taskTypeId: values.taskTypeId,
        submissionUrl: values.submissionUrl,
        title: values.title,
        factionContribution: values.factionContribution as any,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: '提交成功！',
        description: '您的任務已提交。',
      });
      form.reset({
        submissionUrl: 'https://www.plurk.com/',
        title: '',
        taskCategory: '',
        taskTypeId: '',
        factionContribution: undefined
      });
      onTaskSubmitted();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '提交失敗',
        description: error.message || '發生未知錯誤，請稍後再試。',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">提交新任務</CardTitle>
        <CardDescription>
          提交您的創作以獲得榮譽點與貨幣。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="taskCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任務類型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇任務類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taskCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taskTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任務名稱</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategory}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇任務" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredTasks.map((task) => (
                          <SelectItem
                            key={task.id}
                            value={task.id}
                            disabled={task.singleSubmission && userSubmittedTaskIds.includes(task.id)}
                          >
                            {task.name}
                            {task.singleSubmission && userSubmittedTaskIds.includes(task.id) && ' (已完成)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedTaskType && (
              <Card className="bg-muted/50 p-4 space-y-3">
                <p className="text-sm text-muted-foreground">{selectedTaskType.description}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> 榮譽點: {selectedTaskType.honorPoints}</div>
                  <div className="flex items-center gap-2"><Gem className="h-4 w-4 text-primary" /> 貨幣: {selectedTaskType.currency}</div>
                  {selectedTaskType.titleAwarded && <div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> 稱號: {selectedTaskType.titleAwarded}</div>}
                  {selectedTaskType.itemAwarded && <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> 物品: {selectedTaskType.itemAwarded}</div>}
                </div>
              </Card>
            )}

            {isWanderer && selectedTaskType && (
              <FormField
                control={form.control}
                name="factionContribution"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>陣營貢獻（流浪者限定）</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="yelu" />
                          </FormControl>
                          <FormLabel className="font-normal">協助 夜鷺</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="association" />
                          </FormControl>
                          <FormLabel className="font-normal">協助 協會</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="none" />
                          </FormControl>
                          <FormLabel className="font-normal">僅為自己</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>任務標題</FormLabel>
                  <FormControl>
                    <Input placeholder="簡短描述您的創作..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="submissionUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>任務噗浪網址</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.plurk.com/p/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '提交審核'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function AllSubmissionsFeed({ tasks, isLoading, onRefresh, taskTypes, onFilterChange }: { tasks: any[] | null; isLoading: boolean; onRefresh: () => void; taskTypes: TaskType[]; onFilterChange: (filters: TaskFilter) => void; }) {
  const [filters, setFilters] = React.useState<TaskFilter>({});

  const handleFilterChange = (key: keyof TaskFilter, value: string) => {
    const newFilters = { ...filters, [key]: value === 'all' ? undefined : value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const getFactionBadge = (factionId: string) => {
    const faction = FACTIONS[factionId as keyof typeof FACTIONS];
    if (!faction) return null;
    return <Badge style={{ backgroundColor: faction.color, color: 'white' }}>{faction.name}</Badge>;
  };

  const getTaskInfo = (taskTypeId: string) => {
    const task = taskTypes.find(t => t.id === taskTypeId);
    return { name: task?.name || taskTypeId, category: task?.category || 'N/A' };
  };

  const taskCategories = React.useMemo(() => {
    if (!taskTypes) return [];
    return Array.from(new Set(taskTypes.map(t => t.category)));
  }, [taskTypes]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
                <CardTitle className="font-headline">所有任務</CardTitle>
                <CardDescription>看看大家最近在忙什麼。</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Select onValueChange={(value) => handleFilterChange('category', value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="所有任務類型" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">所有任務類型</SelectItem>
                    {taskCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select onValueChange={(value) => handleFilterChange('factionId', value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="所有陣營" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">所有陣營</SelectItem>
                    {Object.values(FACTIONS).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[40rem]">
           <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>標題</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>提交者</TableHead>
                    <TableHead>陣營</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 10 }).map((_, i) => 
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              )}
              {tasks && tasks.map((task) => {
                const { name, category } = getTaskInfo(task.taskTypeId);
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      <Link href={task.submissionUrl} target="_blank" className="hover:underline">
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>{category}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{task.userName}</TableCell>
                    <TableCell>{getFactionBadge(task.userFactionId)}</TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && tasks?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">目前沒有人提交任務。</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function UserSubmissionsHistory({ userId, taskTypes, refreshTrigger }: { userId: string, taskTypes: TaskType[], refreshTrigger: number }) {
  const { toast } = useToast();
  const [userTasks, setUserTasks] = React.useState<any[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadUserTasks = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const result = await getUserTasks(userId);
        if (result.error) {
          throw new Error(result.error);
        }
        setUserTasks(result.tasks || []);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: '載入您的任務失敗',
          description: error.message,
        });
        setUserTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserTasks();
  }, [userId, toast, refreshTrigger]);

  const getTaskName = (taskTypeId: string) => {
    if (!taskTypes) return taskTypeId;
    return taskTypes.find(t => t.id === taskTypeId)?.name || taskTypeId;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="secondary" className="bg-green-600 text-white">已通過</Badge>;
      case 'rejected': return <Badge variant="destructive">未通過</Badge>;
      default: return <Badge variant="outline">審核中</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">我的提交紀錄</CardTitle>
        <CardDescription>您最近提交的任務列表。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>標題</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>獎勵</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))}
              {userTasks && userTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link href={task.submissionUrl} target="_blank" className="font-medium hover:underline">
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>{getTaskName(task.taskTypeId)}</TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    +{task.honorPointsAwarded} 榮譽 / +{task.currencyAwarded} 貨幣
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(task.status)}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && userTasks?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    您尚未提交任何任務。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MissionsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading, refetch: refetchUserData } = useDoc(userDocRef);

  const [tasks, setTasks] = React.useState<any[] | null>(null);
  const [tasksLoading, setTasksLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const taskTypesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'taskTypes') : null),
    [firestore]
  );
  const { data: taskTypes, isLoading: areTaskTypesLoading } = useCollection<TaskType>(taskTypesQuery);

  const { toast } = useToast();

  const handleTaskSubmitted = () => {
    loadTasks();
    refetchUserData();
    setRefreshTrigger(t => t + 1);
  };

  const loadTasks = React.useCallback(async (filters: TaskFilter = {}) => {
    setTasksLoading(true);
    try {
      const result = await getTasks(filters);
      if (result.error) {
        throw new Error(result.error);
      }
      setTasks(result.tasks || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '載入任務失敗',
        description: error.message,
      });
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const isLoading = isUserLoading || isUserDataLoading || areTaskTypesLoading;
  const safeTaskTypes = taskTypes || [];

  return (
    <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-6">
                {isLoading ? (
                <Card>
                    <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                    <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
                ) : user && userData && taskTypes ? (
                <MissionSubmitForm user={user} userData={userData} taskTypes={safeTaskTypes} onTaskSubmitted={handleTaskSubmitted} />
                ) : (
                <Card>
                    <CardHeader>
                    <CardTitle>請先登入</CardTitle>
                    </CardHeader>
                    <CardContent>
                    <p>您必須登入才能提交任務。</p>
                    </CardContent>
                </Card>
                )}
            </div>
            <div className="lg:col-span-2">
                <AllSubmissionsFeed
                tasks={tasks}
                isLoading={tasksLoading}
                onRefresh={() => loadTasks()}
                taskTypes={safeTaskTypes}
                onFilterChange={loadTasks}
                />
            </div>
            <div className="lg:col-span-3">
                {user && taskTypes && <UserSubmissionsHistory userId={user.uid} taskTypes={safeTaskTypes} refreshTrigger={refreshTrigger} />}
            </div>
        </div>
    </div>
  );
}
