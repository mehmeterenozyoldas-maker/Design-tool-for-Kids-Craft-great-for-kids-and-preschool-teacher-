import React, { useState } from 'react';
import { useStore } from './store';
import { Editor2D } from './components/Editor2D';
import { Scene3D } from './components/Scene3D';
import { XRView } from './components/XRView';
import { generatePDF } from './utils/exportPdf';
import { 
  Palette, Undo, Redo, Download, Eye, Grid3X3, 
  Trash2, Eraser, PenTool, PaintBucket, Box, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';

function App() {
  const { 
    viewMode, setViewMode, palette, selectedColorId, setColor,
    activeTool, setTool, undo, redo, clearBoard, exportPattern,
    board, cells, metadata
  } = useStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleDownload = (type: 'kid' | 'teacher') => {
    const pattern = exportPattern();
    generatePDF(pattern, board, palette, type);
    setIsMenuOpen(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      
      {/* Header / Toolbar */}
      <header className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold shadow-brand-500/20 shadow-lg">
            P
          </div>
          <h1 className="font-bold text-slate-800 hidden sm:block">PegPop</h1>
        </div>

        {/* Center Tools */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
          <button 
            onClick={() => setViewMode('2D')}
            className={clsx("p-2 rounded transition", viewMode === '2D' ? "bg-white shadow text-brand-600" : "text-slate-500")}
          >
            <Grid3X3 size={20} />
          </button>
          <button 
            onClick={() => setViewMode('3D')}
            className={clsx("p-2 rounded transition", viewMode === '3D' ? "bg-white shadow text-brand-600" : "text-slate-500")}
          >
            <Box size={20} />
          </button>
           <button 
            onClick={() => setViewMode('XR')}
            className={clsx("p-2 rounded transition", viewMode === 'XR' ? "bg-white shadow text-brand-600" : "text-slate-500")}
          >
            <Eye size={20} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={undo} className="p-2 text-slate-600 hover:bg-slate-100 rounded"><Undo size={20} /></button>
          <button onClick={redo} className="p-2 text-slate-600 hover:bg-slate-100 rounded"><Redo size={20} /></button>
          
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-brand-500 text-white rounded hover:bg-brand-600 flex gap-2 items-center"
            >
              <Download size={18} /> <span className="hidden sm:inline">Export</span>
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50">
                <button onClick={() => handleDownload('kid')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">Kid Sheet (Easy)</button>
                <button onClick={() => handleDownload('teacher')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">Teacher Sheet (Data)</button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button 
                    onClick={() => {
                        const blob = new Blob([JSON.stringify(exportPattern())], {type: "application/json"});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'pattern.json';
                        a.click();
                    }} 
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700"
                >
                    Save JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {viewMode === '2D' && <Editor2D />}
        {viewMode === '3D' && <div className="w-full h-full cursor-move"><Scene3D interactive /></div>}
        {viewMode === 'XR' && <XRView />}
      </main>

      {/* Footer Controls (Toolbox) - Only in 2D/3D */}
      {viewMode !== 'XR' && (
        <footer className="bg-white border-t border-slate-200 p-2 pb-4 sm:pb-2 shrink-0 z-20 flex flex-col gap-2">
            
            {/* Tools Row */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center justify-center">
                <div className="flex bg-slate-100 p-1 rounded-full">
                    <button onClick={() => setTool('pencil')} className={clsx("p-3 rounded-full", activeTool === 'pencil' ? "bg-white shadow text-brand-600" : "text-slate-500")}>
                        <PenTool size={18} />
                    </button>
                    <button onClick={() => setTool('fill')} className={clsx("p-3 rounded-full", activeTool === 'fill' ? "bg-white shadow text-brand-600" : "text-slate-500")}>
                        <PaintBucket size={18} />
                    </button>
                    <button onClick={() => setTool('eraser')} className={clsx("p-3 rounded-full", activeTool === 'eraser' ? "bg-white shadow text-rose-500" : "text-slate-500")}>
                        <Eraser size={18} />
                    </button>
                </div>
                <div className="w-px h-8 bg-slate-300 mx-2"></div>
                <button onClick={clearBoard} className="p-3 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
            </div>

            {/* Colors Row */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide justify-center">
                {palette.map(color => (
                    <button
                        key={color.id}
                        onClick={() => setColor(color.id)}
                        className={clsx(
                            "w-10 h-10 rounded-full border-2 shadow-sm transition-transform active:scale-90 flex-shrink-0",
                            selectedColorId === color.id ? "border-slate-800 scale-110" : "border-white"
                        )}
                        style={{ backgroundColor: color.hex }}
                        aria-label={color.name}
                    />
                ))}
            </div>
        </footer>
      )}
    </div>
  );
}

export default App;
