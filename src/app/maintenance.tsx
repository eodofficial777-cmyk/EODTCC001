'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import React from "react";
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import type { MaintenanceStatus, User } from "@/lib/types";

function MaintenanceScreen() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="mx-auto w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <Wrench className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="font-headline text-2xl">系統維護中</CardTitle>
                    <CardDescription>為了提供更好的服務，EOD 終端機正在進行系統更新與維護。</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        我們很快就會回來，請稍後再嘗試登入。
                        <br />
                        感謝您的耐心等候！
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}


export default function MaintenanceWrapper({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const maintenanceDocRef = useMemoFirebase(() => doc(firestore, 'globals', 'maintenance'), [firestore]);
    const { data: maintenanceStatus, isLoading: isMaintenanceLoading } = useDoc<MaintenanceStatus>(maintenanceDocRef);
    
    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
    const { data: userData, isLoading: isUserDataLoading } = useDoc<User>(userDocRef);

    const isLoading = isUserLoading || isMaintenanceLoading || isUserDataLoading;
    
    if(isLoading) {
        return (
             <div className="flex min-h-screen items-center justify-center bg-background p-4">
                 <Skeleton className="w-full max-w-md h-72" />
             </div>
        )
    }

    const isMaintenanceMode = maintenanceStatus?.isMaintenance || false;
    const isAdmin = userData?.isAdmin || false;

    if (isMaintenanceMode && !isAdmin) {
        return <MaintenanceScreen />;
    }

    return <>{children}</>;
}
