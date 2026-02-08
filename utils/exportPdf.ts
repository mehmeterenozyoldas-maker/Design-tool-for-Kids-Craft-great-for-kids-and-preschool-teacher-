import jsPDF from 'jspdf';
import { BoardSpec, Pattern, PaletteColor } from '../types';
import { parseKey } from './coords';

export const generatePDF = (
    pattern: Pattern, 
    board: BoardSpec, 
    palette: PaletteColor[],
    type: 'kid' | 'teacher'
) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = 210;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // Header
    doc.setFontSize(18);
    doc.text(pattern.metadata.title, margin, 20);
    doc.setFontSize(12);
    doc.text(`By: ${pattern.metadata.author}`, margin, 28);
    
    // Scale warning
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Ensure 'Scale to Fit' is OFF when printing.", pageWidth - margin - 60, 20);
    doc.line(pageWidth - margin - 30, 25, pageWidth - margin, 25);
    doc.text("3cm Reference", pageWidth - margin - 25, 29);

    // Draw Grid
    const startY = 40;
    
    // Auto-scale grid to fit width
    const maxGridWidthMm = contentWidth;
    const rawGridWidthMm = board.widthMm;
    const scale = Math.min(1, maxGridWidthMm / rawGridWidthMm);
    
    const cellSize = board.pegPitchMm * scale;
    const startX = (pageWidth - (board.cols * cellSize)) / 2;

    // Draw Cells
    for (let x = 0; x < board.cols; x++) {
        for (let y = 0; y < board.rows; y++) {
            const posX = startX + (x * cellSize);
            const posY = startY + (y * cellSize);
            const cx = posX + cellSize/2;
            const cy = posY + cellSize/2;
            const r = (cellSize/2) * 0.8;

            // Check if cell is filled
            const key = `${x},${y}`;
            const colorId = pattern.cells[key];
            
            if (colorId) {
                const color = palette.find(c => c.id === colorId);
                if (color) {
                    doc.setFillColor(color.hex);
                    // If white, draw stroke
                    if (color.hex.toLowerCase() === '#ffffff' || color.id === 'white') {
                        doc.setDrawColor(200);
                        doc.circle(cx, cy, r, 'FD');
                    } else {
                        doc.circle(cx, cy, r, 'F');
                    }
                    
                    // Coordinates for Teacher Mode
                    if (type === 'teacher') {
                        doc.setTextColor(255);
                        doc.setFontSize(scale * 2); 
                        if (color.hex === '#ffffff') doc.setTextColor(0);
                        doc.text(`${x},${y}`, cx, cy, { align: 'center', baseline: 'middle' });
                    }
                }
            } else if (type === 'teacher') {
                // Empty grid dots for teacher
                doc.setFillColor(230);
                doc.circle(cx, cy, 0.5, 'F');
            } else {
                // Faint outline for kids
                doc.setDrawColor(240);
                doc.circle(cx, cy, r, 'S');
            }
        }
    }

    // Color Legend
    let legendY = startY + (board.rows * cellSize) + 10;
    const counts: Record<string, number> = {};
    Object.values(pattern.cells).forEach(c => counts[c] = (counts[c] || 0) + 1);

    doc.setFontSize(10);
    doc.setTextColor(0);
    
    let lX = margin;
    palette.forEach(p => {
        if (counts[p.id]) {
            doc.setFillColor(p.hex);
            doc.circle(lX + 3, legendY - 1, 3, 'F');
            doc.text(`${p.name}: ${counts[p.id]} pcs`, lX + 8, legendY);
            lX += 40;
            if (lX > pageWidth - margin) {
                lX = margin;
                legendY += 8;
            }
        }
    });

    doc.save(`${pattern.metadata.title}_${type}.pdf`);
};