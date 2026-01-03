'use client';

import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreditCard, LogOut, Settings, User, Gem, Shield } from 'lucide-react';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { FACTIONS, RACES } from '@/lib/game-data';
import { Skeleton } from '@/components/ui/skeleton';

export function UserNav() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);

  const faction = userData?.factionId ? FACTIONS[userData.factionId as keyof typeof FACTIONS] : null;

  const isLoading = isUserLoading || isUserDataLoading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-auto w-full justify-start gap-2 px-2 py-1.5">
          {isLoading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarImage src={userData?.avatarUrl} alt={userData?.roleName ?? ''} />
              <AvatarFallback>{userData?.roleName?.charAt(0) ?? 'U'}</AvatarFallback>
            </Avatar>
          )}
          <div className="flex flex-col items-start truncate">
            {isLoading ? (
              <>
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <span className="text-sm font-medium truncate">{userData?.roleName}</span>
                <span className="text-xs text-muted-foreground">{faction?.name}</span>
              </>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userData?.roleName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-1 p-1">
           <div className="flex flex-col items-center justify-center p-2 rounded-md bg-muted/50">
              <Shield className="h-5 w-5 text-primary mb-1"/>
              <p className="text-xs text-muted-foreground">榮譽點</p>
              <p className="font-mono font-bold text-sm">{userData?.honorPoints?.toLocaleString() ?? 0}</p>
           </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-md bg-muted/50">
              <Gem className="h-5 w-5 text-primary mb-1"/>
              <p className="text-xs text-muted-foreground">貨幣</p>
              <p className="font-mono font-bold text-sm">{userData?.currency?.toLocaleString() ?? 0}</p>
           </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>個人檔案</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>稱號管理</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>設定</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">
            <LogOut className="mr-2 h-4 w-4" />
            <span>登出</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
