'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { seedDatabase } from '@/app/actions/seed-database';
import { useState } from 'react';

export default function AdminPage() {
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      const result = await seedDatabase();
      if (result.error) {
        throw new Error(result.error);
      }
      toast({
        title: '成功',
        description: '資料庫已成功植入初始資料。',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '錯誤',
        description: `植入資料時發生錯誤：${error.message}`,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">管理員後台</CardTitle>
        <CardDescription>
          管理遊戲的各個方面。此頁面僅供管理員存取。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="accounts" orientation="vertical" className="flex flex-col md:flex-row gap-6">
          <TabsList className="grid w-full md:w-[200px] h-auto grid-cols-2 md:grid-cols-1 flex-shrink-0">
            <TabsTrigger value="accounts">帳號審核</TabsTrigger>
            <TabsTrigger value="missions">任務管理</TabsTrigger>
            <TabsTrigger value="battle">共鬥管理</TabsTrigger>
            <TabsTrigger value="conflict">陣營對抗</TabsTrigger>
            <TabsTrigger value="store">商店道具</TabsTrigger>
            <TabsTrigger value="crafting">裝備合成</TabsTrigger>
            <TabsTrigger value="skills">技能管理</TabsTrigger>
            <TabsTrigger value="titles">稱號管理</TabsTrigger>
            <TabsTrigger value="rewards">獎勵發放</TabsTrigger>
            <TabsTrigger value="database">資料庫</TabsTrigger>
          </TabsList>

          <div className="flex-1 p-4 border rounded-md min-h-[400px]">
            <TabsContent value="accounts">
              <h3 className="text-lg font-semibold">帳號管理</h3>
              <p className="text-muted-foreground mt-2">
                此處將顯示待審核帳戶列表，以及用於啟用、停用或修改角色的工具。
              </p>
              <Button className="mt-4">刷新待審核列表</Button>
            </TabsContent>
            <TabsContent value="missions">
              <h3 className="text-lg font-semibold">任務管理</h3>
              <p className="text-muted-foreground mt-2">
                用於新增任務類型、審核玩家提交的任務以及分配榮譽點的介面。
              </p>
            </TabsContent>
            <TabsContent value="battle">
               <h3 className="text-lg font-semibold">共鬥管理</h3>
              <p className="text-muted-foreground mt-2">
                開啟新的共鬥戰場，設定怪物屬性，並查看過去的戰鬥紀錄。
              </p>
            </TabsContent>
            <TabsContent value="conflict">
               <h3 className="text-lg font-semibold">陣營對抗管理</h3>
              <p className="text-muted-foreground mt-2">
                重置陣營積分以開啟新賽季，並存檔當前賽季的結果。
              </p>
               <Button variant="destructive" className="mt-4">重置賽季積分</Button>
            </TabsContent>
            <TabsContent value="store">
               <h3 className="text-lg font-semibold">商店道具管理</h3>
              <p className="text-muted-foreground mt-2">
                新增、編輯和上下架商店中的商品。
              </p>
            </TabsContent>
             <TabsContent value="crafting">
               <h3 className="text-lg font-semibold">裝備合成管理</h3>
              <p className="text-muted-foreground mt-2">
                定義裝備合成配方。例如：某裝備 + 某物品 = 新裝備。
              </p>
            </TabsContent>
             <TabsContent value="skills">
               <h3 className="text-lg font-semibold">技能管理</h3>
              <p className="text-muted-foreground mt-2">
                管理不同陣營和種族的可用技能。
              </p>
            </TabsContent>
             <TabsContent value="titles">
               <h3 className="text-lg font-semibold">稱號管理</h3>
              <p className="text-muted-foreground mt-2">
                新增和管理一般及隱藏稱號的達成條件。
              </p>
            </TabsContent>
             <TabsContent value="rewards">
               <h3 className="text-lg font-semibold">特殊獎勵發放</h3>
              <p className="text-muted-foreground mt-2">
                使用複合篩選條件向特定玩家群體發放獎勵。
              </p>
            </TabsContent>
            <TabsContent value="database">
               <h3 className="text-lg font-semibold">資料庫管理</h3>
              <p className="text-muted-foreground mt-2">
                執行資料庫維護操作。請謹慎使用。
              </p>
              <Button onClick={handleSeedDatabase} disabled={isSeeding} className="mt-4">
                {isSeeding ? '植入資料中...' : '植入初始遊戲資料'}
              </Button>
               <p className="text-xs text-muted-foreground mt-2">
                點擊此按鈕將會在您的資料庫中建立或覆蓋基礎遊戲資料，例如陣營、種族、任務類型和物品等。
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
