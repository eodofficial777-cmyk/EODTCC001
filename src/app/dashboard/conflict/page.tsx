'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useIsClient } from '@/hooks/use-is-client';

const factionData = [
  { name: '涅槃', score: 45000, players: 45 },
  { name: '樂園', score: 42500, players: 42 },
];

const processedData = factionData.map((faction) => ({
  name: faction.name,
  總分: faction.score,
  人均貢獻: Math.round(faction.score / faction.players),
}));

export default function ConflictPage() {
  const isClient = useIsClient();

  if (!isClient) {
    return null;
  }
  
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {factionData.map((faction) => (
        <Card key={faction.name}>
          <CardHeader>
            <CardTitle className="font-headline text-primary">{faction.name}</CardTitle>
            <CardDescription>當前賽季表現</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">總積分</p>
              <p className="text-5xl font-bold font-mono">
                {faction.score.toLocaleString()}
              </p>
            </div>
            <div className="flex justify-around text-center">
              <div>
                <p className="text-sm text-muted-foreground">活躍玩家</p>
                <p className="text-2xl font-semibold font-mono">{faction.players}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">人均貢獻</p>
                <p className="text-2xl font-semibold font-mono">
                  {Math.round(faction.score / faction.players).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">陣營對抗分析</CardTitle>
            <CardDescription>
              比較各陣營的總分和人均貢獻。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                  <YAxis yAxisId="left" stroke="hsl(var(--foreground))" />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--primary))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="總分" fill="hsl(var(--secondary-foreground))" />
                  <Bar yAxisId="right" dataKey="人均貢獻" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
