import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Shield, Sword, Zap } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function BattlegroundPage() {
  const monsterImage = PlaceHolderImages.find(p => p.id === 'faction-beast');
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
      {/* Center Column: Monster Info and Battle Log */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="p-0">
             <div className="relative aspect-video">
              {monsterImage && (
                <Image 
                  src={monsterImage.imageUrl}
                  alt={monsterImage.description}
                  data-ai-hint={monsterImage.imageHint}
                  fill
                  className="object-cover"
                />
              )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
               <div className="absolute bottom-4 left-4 text-white">
                  <h2 className="text-3xl font-bold font-headline">陣營災獸：吞噬者</h2>
                  <p className="text-lg text-primary">下一回合：20秒</p>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-red-400">災獸血量</span>
                <span className="font-mono">8,750,000 / 10,000,000</span>
              </div>
              <Progress value={87.5} className="h-4 bg-red-500/20 [&>div]:bg-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>共鬥紀錄</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3 text-sm font-mono">
                <p><span className="text-primary">[回合 5]</span> 角色A 使用了 <span className="text-cyan-400">[技能] 強力攻擊</span>，造成 <span className="text-red-400">5,230</span> 傷害。</p>
                <p><span className="text-primary">[回合 5]</span> 角色B 使用了 <span className="text-green-400">[道具] 回復藥水</span>，回復 <span className="text-green-400">15</span> HP。</p>
                <p><span className="text-primary">[回合 4]</span> <span className="text-red-400">[災獸]</span> 發動了 <span className="text-red-400">[範圍攻擊]</span>，對所有玩家造成 <span className="text-red-400">20-30</span> 傷害。</p>
                 <p><span className="text-primary">[回合 4]</span> 角色C 對災獸造成了 <span className="text-red-400">3,120</span> 傷害。</p>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Player Stats and Actions */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>玩家狀態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-green-400">HP</span>
                  <span className="font-mono">95 / 120</span>
                </div>
                <Progress value={95/120 * 100} className="h-3 bg-green-500/20 [&>div]:bg-green-500" />
              </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2"><Sword className="h-4 w-4 text-muted-foreground"/> 攻擊力: 35</div>
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground"/> 防禦力: 18</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>行動</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button>攻擊</Button>
            <Button variant="outline">技能</Button>
            <Button variant="outline">道具</Button>
            <Button variant="ghost">防禦</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
