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

const rosterData = [
  { id: 1, name: '角色A', faction: '涅槃', race: '人類', honorPoints: 1250 },
  { id: 2, name: '角色B', faction: '樂園', race: '獸人', honorPoints: 1100 },
  { id: 3, name: '角色C', faction: '涅槃', race: '精靈', honorPoints: 980 },
  { id: 4, name: '角色D', faction: '中立', race: '改造人', honorPoints: 850 },
  { id: 5, name: '角色E', faction: '樂園', race: '人類', honorPoints: 1300 },
  { id: 6, name: '角色F', faction: '涅槃', race: '獸人', honorPoints: 720 },
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
              <SelectItem value="nirvana">涅槃</SelectItem>
              <SelectItem value="paradise">樂園</SelectItem>
              <SelectItem value="neutral">中立</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="所有種族" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有種族</SelectItem>
              <SelectItem value="human">人類</SelectItem>
              <SelectItem value="beast">獸人</SelectItem>
              <SelectItem value="elf">精靈</SelectItem>
              <SelectItem value="cyborg">改造人</SelectItem>
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
                .map((character) => (
                  <TableRow key={character.id}>
                    <TableCell className="font-medium">{character.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{character.faction}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{character.race}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {character.honorPoints.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
