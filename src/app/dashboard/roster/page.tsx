import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ListOrdered, Search } from 'lucide-react';
import { FACTIONS, RACES } from '@/lib/game-data';

const rosterData = [
  { id: 1, name: '角色A', faction: 'yelu', race: 'human', honorPoints: 1250 },
  { id: 2, name: '角色B', faction: 'association', race: 'esper', honorPoints: 1100 },
  { id: 3, name: '角色C', faction: 'yelu', race: 'corruptor', honorPoints: 980 },
  { id: 4, name: '角色D', faction: 'wanderer', race: 'human', honorPoints: 850 },
  { id: 5, name: '角色E', faction: 'association', race: 'esper', honorPoints: 1300 },
  { id: 6, name: '角色F', faction: 'yelu', race: 'corruptor', honorPoints: 720 },
];

export default function RosterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">角色名冊</CardTitle>
        <CardDescription>
          搜尋和篩選所有已批准的角色。
        </CardDescription>
        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜尋角色名稱..." className="pl-8" />
          </div>
          <Select>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="所有陣營" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有陣營</SelectItem>
              {Object.values(FACTIONS).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="所有種族" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有種族</SelectItem>
              {Object.values(RACES).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="w-full sm:w-auto">
            <ListOrdered className="mr-2 h-4 w-4" />
            按榮譽點排序
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色名稱</TableHead>
                <TableHead>陣營</TableHead>
                <TableHead>種族</TableHead>
                <TableHead className="text-right">榮譽點</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rosterData
                .sort((a, b) => b.honorPoints - a.honorPoints)
                .map((character) => {
                  const faction = FACTIONS[character.faction as keyof typeof FACTIONS];
                  const race = RACES[character.race as keyof typeof RACES];
                  return (
                    <TableRow key={character.id}>
                      <TableCell className="font-medium">{character.name}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: faction?.color, color: 'white' }}>{faction?.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{race?.name}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {character.honorPoints.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
