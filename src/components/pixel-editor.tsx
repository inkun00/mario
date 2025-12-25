'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Eraser } from 'lucide-react';

const GRID_SIZE = 30;
const PIXEL_SIZE = 16;
const DEFAULT_COLOR = '#000000';
const ERASE_COLOR = ''; // Represents a transparent pixel

const PALETTE_COLORS = [
    // Reds
    '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935',
    // Oranges
    '#ffccbc', '#ffab91', '#ff8a65', '#ff7043', '#ff5722', '#f4511e',
    // Yellows
    '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835',
    // Greens
    '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047',
    // Light Blues
    '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5',
    // Blues
    '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5',
    // Indigos
    '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab',
    // Purples
    '#d1c4e9', '#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1',
    // Grayscale & Browns
    '#ffffff', '#f5f5f5', '#e0e0e0', '#9e9e9e', '#616161', '#000000',
    '#d7ccc8', '#bcaaa4', '#a1887f', '#8d6e63', '#795548', '#6d4c41'
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
      <div className="flex-grow space-y-4 w-full md:w-auto">
        <div className="flex items-center gap-2">
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
        
        <div className="space-y-2 pt-2">
            <h4 className="text-sm font-medium">Color Palette</h4>
            <div className="grid grid-cols-6 gap-1">
                {PALETTE_COLORS.map(color => (
                    <div 
                        key={color}
                        className={cn(
                            "h-8 w-full rounded cursor-pointer ring-2 ring-transparent hover:ring-ring",
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
        </div>

      </div>
    </div>
  );
}
