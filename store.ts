import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BoardSpec, CellKey, DEFAULT_BOARD, DEFAULT_PALETTE, PaletteColor, Pattern, ToolType } from './types';
import { makeKey, parseKey } from './utils/coords';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  // Data
  board: BoardSpec;
  cells: Map<CellKey, string>; // We use Map for runtime perf, convert to Obj for persistence
  palette: PaletteColor[];
  metadata: Pattern['metadata'];
  
  // UI State
  selectedColorId: string;
  activeTool: ToolType;
  showGrid: boolean;
  viewMode: '2D' | '3D' | 'XR';
  
  // History
  history: Array<Map<CellKey, string>>;
  historyPointer: number;

  // Actions
  setCell: (x: number, y: number) => void;
  fill: (x: number, y: number) => void;
  clearBoard: () => void;
  setColor: (id: string) => void;
  setTool: (tool: ToolType) => void;
  undo: () => void;
  redo: () => void;
  setViewMode: (mode: '2D' | '3D' | 'XR') => void;
  loadPattern: (pattern: Pattern) => void;
  exportPattern: () => Pattern;
}

// Helper to serialize map
const mapToRecord = (map: Map<string, string>) => Object.fromEntries(map);
const recordToMap = (record: Record<string, string>) => new Map(Object.entries(record));

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      board: DEFAULT_BOARD,
      cells: new Map(),
      palette: DEFAULT_PALETTE,
      metadata: {
        title: 'My Pattern',
        author: 'Artist',
        difficulty: 'Easy',
        created: Date.now(),
      },
      selectedColorId: DEFAULT_PALETTE[0].id,
      activeTool: 'pencil',
      showGrid: true,
      viewMode: '2D',
      history: [new Map()],
      historyPointer: 0,

      setCell: (x, y) => {
        const { cells, selectedColorId, activeTool, history, historyPointer } = get();
        const key = makeKey(x, y);
        const currentVal = cells.get(key);
        
        // Determine new value based on tool
        let newVal: string | undefined = selectedColorId;
        if (activeTool === 'eraser') newVal = undefined;

        if (currentVal === newVal) return; // No change

        // Clone map for immutability
        const newCells = new Map(cells);
        if (newVal) newCells.set(key, newVal);
        else newCells.delete(key);

        // Update History
        const newHistory = history.slice(0, historyPointer + 1);
        newHistory.push(newCells);

        set({
          cells: newCells,
          history: newHistory,
          historyPointer: newHistory.length - 1
        });
      },

      fill: (startX, startY) => {
         const { cells, board, selectedColorId, history, historyPointer } = get();
         const targetKey = makeKey(startX, startY);
         const targetColor = cells.get(targetKey);
         
         if (targetColor === selectedColorId) return;

         const newCells = new Map(cells);
         const queue = [[startX, startY]];
         const visited = new Set<string>();

         while (queue.length > 0) {
            const [x, y] = queue.pop()!;
            const key = makeKey(x, y);
            
            if (visited.has(key)) continue;
            // Check bounds
            if (x < 0 || x >= board.cols || y < 0 || y >= board.rows) continue;
            
            const currentColor = newCells.get(key);
            if (currentColor === targetColor) {
                newCells.set(key, selectedColorId);
                visited.add(key);
                
                queue.push([x + 1, y]);
                queue.push([x - 1, y]);
                queue.push([x, y + 1]);
                queue.push([x, y - 1]);
            }
         }

         const newHistory = history.slice(0, historyPointer + 1);
         newHistory.push(newCells);
         set({ cells: newCells, history: newHistory, historyPointer: newHistory.length - 1 });
      },

      clearBoard: () => {
         const { history, historyPointer } = get();
         const newCells = new Map<CellKey, string>();
         const newHistory = history.slice(0, historyPointer + 1);
         newHistory.push(newCells);
         set({ cells: newCells, history: newHistory, historyPointer: newHistory.length - 1 });
      },

      setColor: (id) => set({ selectedColorId: id }),
      setTool: (tool) => set({ activeTool: tool }),
      setViewMode: (mode) => set({ viewMode: mode }),

      undo: () => {
        const { historyPointer, history } = get();
        if (historyPointer > 0) {
            const newPointer = historyPointer - 1;
            set({ cells: history[newPointer], historyPointer: newPointer });
        }
      },

      redo: () => {
        const { historyPointer, history } = get();
        if (historyPointer < history.length - 1) {
            const newPointer = historyPointer + 1;
            set({ cells: history[newPointer], historyPointer: newPointer });
        }
      },

      loadPattern: (pattern) => {
        const newCells = recordToMap(pattern.cells);
        set({
            cells: newCells,
            metadata: pattern.metadata,
            history: [newCells],
            historyPointer: 0
        });
      },

      exportPattern: () => {
        const { cells, metadata } = get();
        return {
            id: uuidv4(),
            metadata: { ...metadata, created: Date.now() },
            cells: mapToRecord(cells)
        };
      }
    }),
    {
      name: 'pegpop-storage',
      partialize: (state) => ({
        cells: mapToRecord(state.cells),
        metadata: state.metadata
      }),
      merge: (persisted: any, current) => ({
        ...current,
        cells: persisted.cells ? recordToMap(persisted.cells) : current.cells,
        metadata: persisted.metadata || current.metadata,
      })
    }
  )
);