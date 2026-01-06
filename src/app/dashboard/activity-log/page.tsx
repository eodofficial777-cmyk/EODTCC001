
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, startAfter, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollText, Loader2 } from 'lucide-react';
import type { ActivityLog as ActivityLogType } from '@/lib/types';

// Extend the type to be used in the component state
type ActivityLogWithDate = Omit<ActivityLogType, 'timestamp'> & {
  timestamp: Date;
};

export default function ActivityLogPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const [logs, setLogs] = useState<ActivityLogWithDate[]>([]);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user || !firestore) return;

    setIsLoading(true);
    try {
      const first = query(
        collection(firestore, `users/${user.uid}/activityLogs`),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const documentSnapshots = await getDocs(first);

      const newLogs: ActivityLogWithDate[] = documentSnapshots.docs.map(doc => {
        const data = doc.data();
        return {
          ...(data as ActivityLogType),
          id: doc.id,
          timestamp: (data.timestamp as Timestamp).toDate(),
        };
      });

      setLogs(newLogs);
      setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
      setHasMore(documentSnapshots.docs.length === 20);
    } catch (error) {
      console.error("Error fetching logs: ", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, firestore]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const fetchMoreLogs = async () => {
    if (!user || !firestore || !lastVisible) return;

    setIsLoadingMore(true);
    try {
      const next = query(
        collection(firestore, `users/${user.uid}/activityLogs`),
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(20)
      );

      const documentSnapshots = await getDocs(next);

      const newLogs: ActivityLogWithDate[] = documentSnapshots.docs.map(doc => {
        const data = doc.data();
        return {
          ...(data as ActivityLogType),
          id: doc.id,
          timestamp: (data.timestamp as Timestamp).toDate(),
        };
      });

      setLogs(prevLogs => [...prevLogs, ...newLogs]);
      setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
      setHasMore(documentSnapshots.docs.length === 20);
    } catch (error) {
        console.error("Error fetching more logs: ", error);
    } finally {
        setIsLoadingMore(false);
    }
  };


  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">活動紀錄</CardTitle>
          <CardDescription>您的遊戲歷程、任務提交、物品獲取與獎勵紀錄。</CardDescription>
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
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {log.timestamp.toLocaleDateString()}
                      </TableCell>
                       <TableCell className="text-muted-foreground whitespace-nowrap">
                        {log.timestamp.toLocaleTimeString()}
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
        {logs.length > 0 && (
             <CardFooter className="justify-center">
                <Button 
                    onClick={fetchMoreLogs} 
                    disabled={!hasMore || isLoadingMore}
                    variant="outline"
                >
                    {isLoadingMore ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            載入中...
                        </>
                    ) : hasMore ? (
                        '載入更多'
                    ) : (
                        '沒有更多紀錄了'
                    )}
                </Button>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
