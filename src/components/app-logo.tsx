import { Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AppLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <Gamepad2 className="h-6 w-6 text-primary" />
      <span className="font-headline font-bold text-lg text-primary">
        마리오 교실 챌린지
      </span>
    </Link>
  );
}
