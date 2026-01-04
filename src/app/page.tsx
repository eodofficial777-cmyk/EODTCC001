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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth, useFirestore } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { RACES, FACTIONS } from '@/lib/game-data';

const registerSchema = z.object({
  account: z.string().min(1, '登入帳號為必填'),
  characterName: z.string().min(1, '角色名稱為必填'),
  password: z.string().min(6, '密碼至少需要 6 個字元'),
  faction: z.string({ required_error: '請選擇一個陣營' }),
  race: z.string({ required_error: '請選擇一個種族' }),
  plurkAccount: z
    .string()
    .url('請輸入有效的網址')
    .startsWith('https://www.plurk.com/', '噗浪帳號必須以 https://www.plurk.com/ 開頭'),
  characterSheet: z
    .string()
    .url('請輸入有效的網址')
    .startsWith(
      'https://images.plurk.com/',
      '角色卡必須以 https://images.plurk.com/ 開頭'
    ),
  avatar: z
    .string()
    .url('請輸入有效的網址')
    .startsWith(
      'https://images.plurk.com/',
      '大頭貼必須以 https://images.plurk.com/ 開頭'
    ),
});

const loginSchema = z.object({
  account: z.string().min(1, '帳號為必填'),
  password: z.string().min(1, '密碼為必填'),
});

export default function AuthPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      account: '',
      characterName: '',
      password: '',
      plurkAccount: 'https://www.plurk.com/',
      characterSheet: 'https://images.plurk.com/',
      avatar: 'https://images.plurk.com/',
    },
  });

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: '',
      password: '',
    },
  });

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    const email = `${values.account}@eodtcc.com`;
    const selectedRace = RACES[values.race as keyof typeof RACES];

    if (!selectedRace) {
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: '選擇的種族無效。',
      });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        values.password
      );
      const user = userCredential.user;

      await setDoc(doc(firestore, 'users', user.uid), {
        id: user.uid,
        roleName: values.characterName,
        plurkInfo: values.plurkAccount,
        characterSheetUrl: values.characterSheet,
        avatarUrl: values.avatar,
        factionId: values.faction,
        raceId: values.race,
        registrationDate: serverTimestamp(),
        approved: false,
        honorPoints: 0,
        currency: 50,
        titles: ['title005'],
        equipment: [],
        items: [],
        tasks: [],
        submittedMainQuest: false,
        attributes: {
          hp: selectedRace.hp,
          atk: selectedRace.atk,
          def: selectedRace.def,
        },
      });

      toast({
        title: '註冊成功',
        description: '您的帳戶已建立，正在等待管理員審核。',
      });
      registerForm.reset();
    } catch (error: any) {
      console.error('註冊失敗:', error);
      let description = '發生未知錯誤，請稍後再試。';
      if (error.code === 'auth/email-already-in-use') {
        description = '此登入帳號已被使用。';
      } else if (error.code === 'auth/weak-password') {
        description = '密碼強度不足，請設定更長的密碼。';
      }
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description,
      });
    }
  };

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    const email = `${values.account}@eodtcc.com`;
    try {
      await signInWithEmailAndPassword(auth, email, values.password);
      toast({
        title: '登入成功',
        description: '正在將您導向儀表板...',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('登入失敗:', error);
      let description = '請檢查您的帳號或密碼。';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
         description = '帳號或密碼錯誤。';
      } else if (error.code === 'auth/user-disabled') {
         description = '此帳戶已被停用或尚未審核通過。';
      }
      toast({
        variant: 'destructive',
        title: '登入失敗',
        description,
      });
    }
  };

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
              <TabsTrigger value="login">登入</TabsTrigger>
              <TabsTrigger value="register">註冊</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <CardHeader className="p-2 pt-4 text-center">
                <CardTitle className="text-2xl font-headline">登入</CardTitle>
                <CardDescription>
                  輸入您的憑證以存取您的帳戶
                </CardDescription>
              </CardHeader>
              <Form {...loginForm}>
                <form
                  onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                  className="grid gap-4 p-2"
                >
                  <FormField
                    control={loginForm.control}
                    name="account"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>帳號</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="您的登入帳號"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                         <div className="flex items-center">
                            <FormLabel>密碼</FormLabel>
                            <Link
                              href="#"
                              className="ml-auto inline-block text-sm underline"
                            >
                              忘記密碼？
                            </Link>
                          </div>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                    {loginForm.formState.isSubmitting ? '登入中...' : '登入'}
                  </Button>
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    帳戶需要經過管理員批准後才能啟用登入。
                  </div>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="register">
              <CardHeader className="p-2 pt-4 text-center">
                <CardTitle className="text-2xl font-headline">註冊</CardTitle>
                <CardDescription>建立您的新角色帳戶</CardDescription>
              </CardHeader>
              <Form {...registerForm}>
                <form
                  onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                  className="grid gap-4 p-2"
                >
                  <FormField
                    control={registerForm.control}
                    name="account"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>登入帳號</FormLabel>
                        <FormControl>
                           <Input placeholder="帳號" {...field} />
                        </FormControl>
                        <FormDescription>
                          請使用英文大小寫與數字組合。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="characterName"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>角色名稱</FormLabel>
                        <FormControl>
                          <Input placeholder="您的角色名稱" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>自定義密碼</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                         <FormDescription>
                          請使用英文大小寫與數字組合，至少6碼以上。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="faction"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel>陣營</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選擇陣營" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(FACTIONS).map((faction) => (
                                <SelectItem key={faction.id} value={faction.id}>{faction.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="race"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel>種族</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選擇種族" />
                              </SelectTrigger>
                            </FormControl>
                             <SelectContent>
                              {Object.values(RACES).map((race) => (
                                <SelectItem key={race.id} value={race.id}>{race.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={registerForm.control}
                    name="plurkAccount"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>噗浪帳號</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.plurk.com/您的ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="characterSheet"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>角色卡</FormLabel>
                        <FormControl>
                          <Input placeholder="https://images.plurk.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="avatar"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>大頭貼</FormLabel>
                        <FormControl>
                          <Input placeholder="https://images.plurk.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                    {registerForm.formState.isSubmitting ? '建立中...' : '建立帳戶'}
                  </Button>
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    帳戶需要經過管理員批准後才能啟用登入。
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
