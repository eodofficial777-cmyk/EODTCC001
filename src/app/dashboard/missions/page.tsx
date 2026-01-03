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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function MissionsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">任務提交</CardTitle>
          <CardDescription>
            提交您的創意任務以獲得榮譽點。請確保您的連結是公開的。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mission-url">任務網址</Label>
              <Input
                id="mission-url"
                placeholder="https://example.com/my-artwork"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mission-category">任務類別</Label>
              <Select>
                <SelectTrigger id="mission-category">
                  <SelectValue placeholder="選擇任務類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="art">美術作品</SelectItem>
                  <SelectItem value="writing">寫作</SelectItem>
                  <SelectItem value="music">音樂</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="mission-description">任務描述 (選填)</Label>
              <Textarea id="mission-description" placeholder="簡短描述您的創作..." />
            </div>
            <Button type="submit" className="w-full">
              提交審核
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
