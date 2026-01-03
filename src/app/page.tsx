'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Logo from '@/components/logo';

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登入 Login</TabsTrigger>
              <TabsTrigger value="register">註冊 Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <CardHeader className="p-2 text-center">
                <CardTitle className="text-2xl font-headline">登入 Login</CardTitle>
                <CardDescription>
                  輸入您的憑證以存取您的帳戶
                </CardDescription>
              </CardHeader>
              <div className="grid gap-4 p-2">
                <div className="grid gap-2">
                  <Label htmlFor="email">電子郵件</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">密碼</Label>
                    <Link
                      href="#"
                      className="ml-auto inline-block text-sm underline"
                    >
                      忘記密碼？
                    </Link>
                  </div>
                  <Input id="password" type="password" required />
                </div>
                <Button type="submit" className="w-full" asChild>
                  <Link href="/dashboard">登入</Link>
                </Button>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  帳戶需要經過管理員批准後才能啟用登入。
                </div>
              </div>
            </TabsContent>
            <TabsContent value="register">
               <CardHeader className="p-2 text-center">
                <CardTitle className="text-2xl font-headline">註冊 Register</CardTitle>
                <CardDescription>
                  建立您的新角色帳戶
                </CardDescription>
              </CardHeader>
              <div className="grid gap-4 p-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="register-account">登入帳號</Label>
                    <div className="flex items-center">
                      <Input id="register-account" placeholder="帳號" required className="rounded-r-none" />
                      <span className="flex h-10 items-center rounded-r-md border border-l-0 border-input bg-background px-3 text-sm text-muted-foreground">
                        @eodtcc.com
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="character-name">角色名稱</Label>
                    <Input id="character-name" placeholder="您的角色名稱" required />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="register-password">自定義密碼</Label>
                  <Input id="register-password" type="password" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="faction">陣營</Label>
                    <Select>
                      <SelectTrigger id="faction">
                        <SelectValue placeholder="選擇陣營" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yelu">夜鷺</SelectItem>
                        <SelectItem value="association">協會</SelectItem>
                        <SelectItem value="wanderer">流浪者</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="race">種族</Label>
                    <Select>
                      <SelectTrigger id="race">
                        <SelectValue placeholder="選擇種族" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corruptor">侵蝕者</SelectItem>
                        <SelectItem value="esper">超能者</SelectItem>
                        <SelectItem value="human">純人類</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plurk-account">噗浪帳號</Label>
                  <Input id="plurk-account" placeholder="https://www.plurk.com/您的ID" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="character-sheet">角色卡</Label>
                  <Input id="character-sheet" placeholder="https://images.plurk.com/..." required />
                </div>
                 <div className="grid gap-2">
                  <Label htmlFor="avatar">大頭貼</Label>
                  <Input id="avatar" placeholder="https://images.plurk.com/..." required />
                </div>
                <Button type="submit" className="w-full">
                  建立帳戶
                </Button>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  帳戶需要經過管理員批准後才能啟用登入。
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
