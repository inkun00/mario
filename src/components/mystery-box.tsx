
import { cn } from '@/lib/utils';

export function MysteryBox({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-square w-full flex items-center justify-center rounded-lg shadow-md bg-yellow-400 border-b-8 border-yellow-600',
        className
      )}
    >
      <span
        className="text-6xl font-bold text-white"
        style={{
          textShadow:
            '3px 3px 0px rgba(0,0,0,0.2), 6px 6px 0px rgba(133, 77, 14, 0.7)',
        }}
      >
        ?
      </span>
      {/* Corner dots */}
      <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-yellow-700/80"></div>
      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-yellow-700/80"></div>
      <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-yellow-700/80"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-yellow-700/80"></div>
    </div>
  );
}
