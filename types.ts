export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
  roughness?: number;
  metalness?: number;
}

export interface BoardSpec {
  widthMm: number;
  heightMm: number;
  cols: number;
  rows: number;
  pegPitchMm: number; // Distance between centers
  pegDiameterMm: number;
  pegHeightMm: number;
  marginMm: number; // Edge to first peg center
}

export type CellKey = string; // Format "x,y"

export interface Pattern {
  id: string;
  metadata: {
    title: string;
    author: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    created: number;
  };
  cells: Record<CellKey, string>; // Key: "x,y", Value: colorId
}

export type ToolType = 'pencil' | 'eraser' | 'fill' | 'line';

export const DEFAULT_PALETTE: PaletteColor[] = [
  { id: 'red', name: 'Red', hex: '#ef4444' },
  { id: 'orange', name: 'Orange', hex: '#f97316' },
  { id: 'yellow', name: 'Yellow', hex: '#eab308' },
  { id: 'green', name: 'Green', hex: '#22c55e' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6' },
  { id: 'purple', name: 'Purple', hex: '#a855f7' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
  { id: 'white', name: 'White', hex: '#f8fafc' },
  { id: 'black', name: 'Black', hex: '#1e293b' },
  { id: 'brown', name: 'Brown', hex: '#78350f' },
];

export const DEFAULT_BOARD: BoardSpec = {
  widthMm: 160,
  heightMm: 160,
  cols: 30,
  rows: 30,
  pegPitchMm: 5,
  pegDiameterMm: 2.5,
  pegHeightMm: 3,
  marginMm: 7.5,
};
