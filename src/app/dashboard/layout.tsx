'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Swords,
  Store,
  Shield,
  ShieldCheck,
  PanelLeft,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import Logo from '@/components/logo';
import { UserNav } from './user-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDoc } from '@/firebase';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '角色資訊' },
  { href: '/dashboard/roster', icon: Users, label: '角色名冊' },
  { href: '/dashboard/missions', icon: ClipboardList, label: '任務提交' },
  { href: '/dashboard/conflict', icon: Swords, label: '陣營對抗' },
  { href: '/dashboard/store', icon: Store, label: '陣營商店' },
  { href: '/dashboard/battleground', icon: Shield, label: '共鬥戰場' },
  { href: '/dashboard/admin', icon: ShieldCheck, label: '管理後台', admin: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const adminRef = useMemoFirebase(
    () => (user ? doc(firestore, `roles_admin/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: adminData } = useDoc(adminRef);
  const isAdmin = !!adminData;

  const getPageTitle = () => {
    const currentItem = navItems.find((item) => item.href === pathname);
    if (currentItem) return currentItem.label;
    if (pathname.startsWith('/dashboard/roster/')) return '角色檔案';
    return '儀表板';
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Logo iconOnly className="group-data-[collapsible=icon]:hidden" />
            <Logo iconOnly className="hidden group-data-[collapsible=icon]:block" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) =>
                !item.admin || isAdmin ? (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={{ children: item.label, side: 'right' }}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null
              )}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 transition-opacity ease-linear duration-200">
            <UserNav />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-card/50 px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30 backdrop-blur-sm">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold md:text-xl font-headline">
                {getPageTitle()}
              </h1>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
