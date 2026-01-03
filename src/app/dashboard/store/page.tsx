import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Gem } from 'lucide-react';

const storeItems = [
  { id: 'item-1', name: '回復藥水', price: 100, imageId: 'store-item-1', description: '恢復少量HP。', category: '道具' },
  { id: 'item-2', name: '遠古之劍', price: 5000, imageId: 'store-item-2', description: '一把鋒利的舊時代武器。', category: '裝備' },
  { id: 'item-3', name: '神秘護符', price: 2500, imageId: 'store-item-3', description: '據說能帶來好運。', category: '飾品' },
  { id: 'item-4', name: '皮製護甲', price: 1200, imageId: 'store-item-4', description: '提供基礎的防護。', category: '裝備' },
];

export default function StorePage() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {storeItems.map((item) => {
        const itemImage = PlaceHolderImages.find((p) => p.id === item.imageId);
        return (
          <Card key={item.id} className="flex flex-col">
            <CardHeader>
              <div className="relative h-40 w-full mb-4">
                {itemImage && (
                  <Image
                    src={itemImage.imageUrl}
                    alt={item.name}
                    data-ai-hint={itemImage.imageHint}
                    fill
                    className="object-cover rounded-md"
                  />
                )}
                 <Badge className="absolute top-2 right-2">{item.category}</Badge>
              </div>
              <CardTitle className="font-headline">{item.name}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow"></CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-mono text-lg font-bold text-primary">
                <Gem className="h-4 w-4" />
                {item.price.toLocaleString()}
              </div>
              <Button>購買</Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
