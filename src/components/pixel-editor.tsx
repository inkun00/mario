
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eraser } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const GRID_SIZE = 30;
const PIXEL_SIZE = 16;
const DEFAULT_COLOR = '#000000';
const ERASE_COLOR = ''; // Represents a transparent pixel

const PALETTE_COLORS = [
    // Grays & White & Black
  '#ffffff', '#f5f5f5', '#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575', '#616161', '#424242', '#212121', '#000000',
  // Reds
  '#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c',
  // Pinks
  '#fce4ec', '#f8bbd0', '#f48fb1', '#f06292', '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457', '#880e4f',
  // Purples
  '#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c',
  // Deep Purples
  '#ede7f6', '#d1c4e9', '#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#4527a0', '#311b92',
  // Indigos
  '#e8eaf6', '#c5cae9', '#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#283593', '#1a237e',
  // Blues
  '#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1',
  // Light Blues
  '#e1f5fe', '#b3e5fc', '#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5', '#0288d1', '#0277bd', '#01579b',
  // Cyan
  '#e0f7fa', '#b2ebf2', '#80deea', '#4dd0e1', '#26c6da', '#00bcd4', '#00acc1', '#0097a7', '#00838f', '#006064',
  // Teal
  '#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b', '#00796b', '#00695c', '#004d40',
  // Greens
  '#e8f5e9', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20',
  // Light Greens
  '#f1f8e9', '#dcedc8', '#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#558b2f', '#33691e',
  // Limes
  '#f9fbe7', '#f0f4c3', '#e6ee9c', '#dce775', '#d4e157', '#cddc39', '#c0ca33', '#afb42b', '#9e9d24', '#827717',
  // Yellows
  '#fffde7', '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835', '#fbc02d', '#f9a825', '#f57f17',
  // Ambers
  '#fff8e1', '#ffecb3', '#ffe082', '#ffd54f', '#ffca28', '#ffc107', '#ffb300', '#ffa000', '#ff8f00', '#ff6f00',
  // Oranges
  '#fff3e0', '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00', '#e65100',
  // Deep Oranges
  '#fbe9e7', '#ffccbc', '#ffab91', '#ff8a65', '#ff7043', '#ff5722', '#f4511e', '#e64a19', '#d84315', '#bf360c',
  // Browns
  '#efebe9', '#d7ccc8', '#bcaaa4', '#a1887f', '#8d6e63', '#795548', '#6d4c41', '#5d4037', '#4e342e', '#3e2723',
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

  const toggleEraser = () => setIsErasing(prev => !prev);

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
        <div className="flex flex-col gap-2">
            <button className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSave(pixels)}>저장</button>
            <button className="w-full px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring" onClick={clearCanvas}>모두 지우기</button>
        </div>
        
        <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleEraser}
                    className={cn(
                        "p-2 rounded border-2",
                        isErasing ? 'border-primary bg-primary/10' : 'border-transparent'
                    )}
                >
                    <Eraser className="w-5 h-5"/>
                </button>
                <div className="flex items-center gap-2 text-sm">
                    <span>Selected:</span>
                    <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: isErasing ? 'transparent' : currentColor }}
                    />
                </div>
            </div>
            <h4 className="text-sm font-medium">Color Palette</h4>
            <div className="grid grid-cols-12 gap-1">
                {PALETTE_COLORS.map(color => (
                    <div 
                        key={color}
                        className={cn(
                            "h-4 w-full rounded-sm cursor-pointer ring-2 ring-transparent hover:ring-ring",
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
