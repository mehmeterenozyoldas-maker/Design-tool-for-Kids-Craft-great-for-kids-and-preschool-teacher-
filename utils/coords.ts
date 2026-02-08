import { BoardSpec } from '../types';

/**
 * Converts a grid index (col, row) to 3D world coordinates (x, y, z)
 * centered around (0,0,0).
 */
export const gridToWorld = (
  col: number,
  row: number,
  board: BoardSpec,
  yOffset: number = 0
): [number, number, number] => {
  // Calculate total usable width/height based on pegs
  const totalGridWidth = (board.cols - 1) * board.pegPitchMm;
  const totalGridDepth = (board.rows - 1) * board.pegPitchMm;

  // Center alignment
  const startX = -totalGridWidth / 2;
  const startZ = -totalGridDepth / 2;

  const x = startX + col * board.pegPitchMm;
  const z = startZ + row * board.pegPitchMm;
  
  return [x / 10, yOffset, z / 10]; // Scale down by 10 for Three.js units (1 unit = 1cm approx)
};

export const parseKey = (key: string): { x: number; y: number } => {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
};

export const makeKey = (x: number, y: number): string => `${x},${y}`;
