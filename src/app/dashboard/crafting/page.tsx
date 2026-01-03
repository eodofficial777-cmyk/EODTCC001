'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Item } from '@/lib/types';
import { craftItem } from '@/app/actions/craft-item';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Hammer } from 'lucide-react';

const formSchema = z.object({
  baseItemId: z.string({ required_error: '請選擇一個基底裝備' }),
  materialItemId: z.string({ required_error: '請選擇一個合成材料' }),
  targetItemId: z.string({ required_error: '請選擇合成目標' }),
});

export default function CraftingPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);

  const itemsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'items') : null), [firestore]);
  const { data: allItems, isLoading: areItemsLoading } = useCollection<Item>(itemsQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { ownedEquipment, ownedSpecialItems } = useMemo(() => {
    if (!userData?.items || !allItems) {
      return { ownedEquipment: [], ownedSpecialItems: [] };
    }
    const inventory = userData.items;
    const equipment = allItems.filter(item => inventory.includes(item.id) && item.itemTypeId === 'equipment');
    const special = allItems.filter(item => inventory.includes(item.id) && item.itemTypeId === 'special');
    return { ownedEquipment: equipment, ownedSpecialItems: special };
  }, [userData, allItems]);

  const targettableItems = useMemo(() => {
    if (!allItems) return [];
    return allItems.filter(item => item.itemTypeId === 'equipment' && !item.isPublished);
  }, [allItems]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: '錯誤', description: '您必須登入才能合成裝備。' });
      return;
    }
    try {
      const result = await craftItem({
        userId: user.uid,
        ...values
      });
      if (result.error) throw new Error(result.error);
      toast({ title: '合成成功！', description: '新裝備已加入您的背包。' });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: '合成失敗', description: error.message });
    }
  };

  const isLoading = isUserLoading || isUserDataLoading || areItemsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2"><Hammer /> 裝備合成</CardTitle>
          <CardDescription>
            選擇一件裝備作為基底，並加入特殊材料來合成全新的強力裝備。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="baseItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1. 選擇基底裝備</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇您擁有的裝備..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ownedEquipment.length > 0 ? ownedEquipment.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        )) : <SelectItem value="none" disabled>沒有可用的裝備</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="materialItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2. 選擇合成材料</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇您擁有的特殊道具..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         {ownedSpecialItems.length > 0 ? ownedSpecialItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        )) : <SelectItem value="none" disabled>沒有可用的特殊道具</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-center items-center">
                 <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              <FormField
                control={form.control}
                name="targetItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>3. 選擇合成目標</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇您想合成的目標裝備..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {targettableItems.length > 0 ? targettableItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                                {item.name}
                            </SelectItem>
                        )) : <SelectItem value="none" disabled>目前沒有可合成的目標</SelectItem>}
                      </SelectContent>
                    </Select>
                     <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? '合成中...' : '開始合成'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
