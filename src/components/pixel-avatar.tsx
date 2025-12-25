'use client';

import { cn } from '@/lib/utils';

interface PixelAvatarProps {
  pixels: string[][] | null | undefined;
  className?: string;
  pixelSize?: number;
}

export function PixelAvatar({ pixels, className, pixelSize = 10 }: PixelAvatarProps) {
  const size = 30;

  if (!pixels) {
    // Render a default avatar or nothing
    return <div className={cn("bg-muted rounded-md", className)} />;
  }

  return (
    <svg
      className={cn(className)}
      viewBox={`0 0 ${size * pixelSize} ${size * pixelSize}`}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="hsl(var(--background))" />
      {pixels.map((row, y) =>
        row.map((color, x) => {
          if (color) {
            return (
              <rect
                key={`${y}-${x}`}
                x={x * pixelSize}
                y={y * pixelSize}
                width={pixelSize}
                height={pixelSize}
                fill={color}
              />
            );
          }
          return null;
        })
      )}
    </svg>
  );
}
