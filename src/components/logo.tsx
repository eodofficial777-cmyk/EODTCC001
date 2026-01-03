import { Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  iconOnly?: boolean;
};

export default function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Terminal className="h-8 w-8 text-primary" />
      {!iconOnly && (
        <span className="text-xl font-bold tracking-wider text-foreground">
          EOD 終端機
        </span>
      )}
    </div>
  );
}
