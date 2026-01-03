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
import Logo from '@/components/logo';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">註冊 Register</CardTitle>
          <CardDescription>
            建立您的新角色帳戶
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="character-name">角色名稱</Label>
              <Input id="character-name" placeholder="您的角色名稱" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plurk-info">噗浪資訊</Label>
              <Input id="plurk-info" placeholder="噗浪個人檔案網址" required />
            </div>
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
              <Label htmlFor="password">密碼</Label>
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              建立帳戶
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            已經有帳號了？{' '}
            <Link href="/" className="underline">
              登入
            </Link>
          </div>
           <div className="mt-2 text-center text-xs text-muted-foreground">
            帳戶需要經過管理員批准後才能啟用登入。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
