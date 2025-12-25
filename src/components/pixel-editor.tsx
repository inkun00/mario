'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Eraser, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const GRID_SIZE = 30;
const PIXEL_SIZE = 16;
const DEFAULT_COLOR = '#000000';
const ERASE_COLOR = ''; // Represents a transparent pixel

const PALETTE_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#800000', '#808000', '#008000', '#800080', '#008080', '#000080', '#808080', '#c0c0c0',
  '#ff4500', '#ffa500', '#ffd700', '#b8860b', '#32cd32', '#4682b4', '#9400d3', '#ff69b4'
];

interface PixelEditorProps {
  initialPixels: string[][] | null | undefined;
  onSave: (pixels: string[][]) => void;
}

export function PixelEditor({ initialPixels, onSave }: PixelEditorProps) {
  const [pixels, setPixels] = useState<string[][]>(() => {
    if (initialPixels) {
      return initialPixels;
    }
    return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(ERASE_COLOR));
  });

  const [currentColor, setCurrentColor] = useState(DEFAULT_COLOR);
  const [isErasing, setIsErasing] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const handlePixelClick = (row: number, col: number) => {
    const newPixels = pixels.map(r => [...r]);
    newPixels[row][col] = isErasing ? ERASE_COLOR : currentColor;
    setPixels(newPixels);
  };

  const handlePixelEnter = (row: number, col: number) => {
    if (isMouseDown) {
      handlePixelClick(row, col);
    }
  };

  const toggleEraser = () => {
    setIsErasing(prev => !prev);
  };

  const clearCanvas = () => {
     setPixels(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(ERASE_COLOR)));
  };


  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <div className="flex-shrink-0">
        <div
          className="grid border-2"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
            width: GRID_SIZE * PIXEL_SIZE,
            height: GRID_SIZE * PIXEL_SIZE,
          }}
          onMouseDown={() => setIsMouseDown(true)}
          onMouseUp={() => setIsMouseDown(false)}
          onMouseLeave={() => setIsMouseDown(false)}
        >
          {pixels.map((row, rowIndex) =>
            row.map((_, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="w-full h-full border-r border-b border-muted"
                style={{ backgroundColor: pixels[rowIndex][colIndex] || 'transparent' }}
                onClick={() => handlePixelClick(rowIndex, colIndex)}
                onMouseEnter={() => handlePixelEnter(rowIndex, colIndex)}
              />
            ))
          )}
        </div>
      </div>
      <div className="flex-grow space-y-4">
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Palette />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <div className="grid grid-cols-6 gap-1 p-2">
                        {PALETTE_COLORS.map(color => (
                            <div 
                                key={color}
                                className={cn(
                                    "h-8 w-8 rounded cursor-pointer ring-2 ring-transparent hover:ring-ring",
                                    currentColor === color && !isErasing && "ring-primary"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setCurrentColor(color);
                                    setIsErasing(false);
                                }}
                            />
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
             <Button
                variant={isErasing ? 'secondary' : 'outline'}
                size="icon"
                onClick={toggleEraser}
                aria-label="Eraser"
            >
                <Eraser />
            </Button>
            <div className="flex items-center gap-2 text-sm">
                <span>Selected:</span>
                 <div
                    className="h-6 w-6 rounded border"
                    style={{ backgroundColor: isErasing ? 'transparent' : currentColor }}
                />
            </div>
        </div>
        
        <div className="flex flex-col gap-2">
            <Button onClick={() => onSave(pixels)}>저장</Button>
            <Button variant="destructive" onClick={clearCanvas}>모두 지우기</Button>
        </div>
      </div>
    </div>
  );
}
