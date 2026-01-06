'use client';

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
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollText } from 'lucide-react';
import type { ActivityLog } from '@/lib/types';

export default function ActivityLogPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const activityLogQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, `users/${user.uid}/activityLogs`), orderBy('timestamp', 'desc'), limit(20)) : null),
    [user, firestore]
  );
  
  const { data: logs, isLoading: isLogsLoading } = useCollection<ActivityLog>(activityLogQuery);

  const isLoading = isUserLoading || isLogsLoading;

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">活動紀錄</CardTitle>
          <CardDescription>您最近的 20 筆遊戲歷程、任務提交、物品獲取與獎勵紀錄。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="text-right">變更</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp.toDate()).toLocaleDateString()}
                      </TableCell>
                       <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp.toDate()).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">{log.change}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <ScrollText className="h-12 w-12" />
                        <p>沒有任何活動紀錄</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
