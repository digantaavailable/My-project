import React, { useRef, useState } from 'react';
import { PlayerEntry, BracketConfig } from '../types';
import { calculateBracketRounds, formatPlayerLabel } from '../utils/bracket';
import { Edit2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

interface BracketViewProps {
  entries: PlayerEntry[];
  config: BracketConfig;
  onSelectPlayer: (player: PlayerEntry, index: number) => void;
  onSwapPlayers?: (index1: number, index2: number) => void;
  onMovePlayer?: (index: number, direction: 'up' | 'down') => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const BracketView: React.FC<BracketViewProps> = ({
  entries,
  config,
  onSelectPlayer,
  onSwapPlayers,
  onMovePlayer,
  containerRef,
}) => {
  const localRef = useRef<HTMLDivElement>(null);
  const actualRef = containerRef || localRef;

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { numRounds, totalSlots } = calculateBracketRounds(entries);

  // Layout Parameters - Calculate dynamic minimum box width to fit the longest player name
  const longestLabelLength = Math.max(
    ...entries.map((e) => formatPlayerLabel(e, config).length),
    12
  );
  const charWidth = (config.fontSize || 13) * 0.62;
  const paddingAndControls = 48; // padding, drag handle, hover edit controls
  const minRequiredWidth = Math.ceil(longestLabelLength * charWidth + paddingAndControls);
  const boxWidth = Math.max(config.boxWidth || 190, minRequiredWidth);

  const boxHeight = (config.fontSize || 13) + (config.boxPaddingY || 6) * 2 + 8; // e.g. 33px
  const slotGapY = config.boxGapY || 10; // Vertical spacing between individual boxes
  const roundWidth = 80; // Horizontal spacing per round step

  // Total dimensions of bracket area
  const bracketContentHeight = totalSlots * boxHeight + (totalSlots - 1) * slotGapY;
  const totalCanvasWidth = boxWidth + numRounds * roundWidth + 80;
  const totalCanvasHeight = bracketContentHeight + 120; // 120px for title & margins

  // Calculate exact Y centers for every slot in Round 0 (start Y = 0 relative to bracket container)
  const r0YCenters: number[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const yCenter = i * (boxHeight + slotGapY) + boxHeight / 2;
    r0YCenters.push(yCenter);
  }

  // Calculate Y centers for subsequent rounds
  const roundYCenters: number[][] = [r0YCenters];
  for (let r = 1; r <= numRounds; r++) {
    const prevCenters = roundYCenters[r - 1];
    const currCenters: number[] = [];
    for (let i = 0; i < prevCenters.length; i += 2) {
      const y1 = prevCenters[i];
      const y2 = prevCenters[i + 1] ?? y1;
      currCenters.push((y1 + y2) / 2);
    }
    roundYCenters.push(currCenters);
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = parseInt(sourceStr, 10);
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex && onSwapPlayers) {
      onSwapPlayers(sourceIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Render bracket connecting lines
  const renderBracketLines = () => {
    const paths: React.ReactNode[] = [];

    for (let r = 0; r < numRounds; r++) {
      const currentCenters = roundYCenters[r];
      const nextCenters = roundYCenters[r + 1];

      // x coordinates for current round step
      const startX = r === 0 ? boxWidth : boxWidth + r * roundWidth;
      const midX = startX + roundWidth * 0.5;
      const endX = startX + roundWidth;

      for (let i = 0; i < currentCenters.length; i += 2) {
        if (i + 1 >= currentCenters.length) break;

        const y1 = currentCenters[i];
        const y2 = currentCenters[i + 1];
        const midY = nextCenters[i / 2];

        // Crisp orthogonal lines
        const d = `
          M ${startX} ${y1} H ${midX}
          M ${startX} ${y2} H ${midX}
          M ${midX} ${y1} V ${y2}
          M ${midX} ${midY} H ${endX}
        `;

        paths.push(
          <path
            key={`line-${r}-${i}`}
            d={d}
            fill="none"
            stroke={config.lineColor || '#1d4ed8'}
            strokeWidth={config.lineWidth || 2}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        );
      }
    }

    return paths;
  };

  return (
    <div className="bracket-outer-wrapper w-full overflow-x-auto bg-slate-100/70 p-4 sm:p-6 rounded-xl border border-slate-200 print:p-0 print:border-none print:bg-transparent">
      <div className="inline-block min-w-full flex justify-center">
        {/* Printable/Exportable Paper Sheet */}
        <div
          ref={actualRef}
          id="bracket-canvas"
          className="bg-white p-8 rounded-lg shadow-sm border border-slate-300 relative font-sans text-slate-900 select-none transition-all"
          style={{
            width: `${totalCanvasWidth}px`,
            minHeight: `${totalCanvasHeight}px`,
            boxSizing: 'border-box',
          }}
        >
          {/* Header Title Bar */}
          <div className="w-full flex justify-end mb-6 pb-2 border-b-2 border-slate-900">
            <div className="text-right">
              <h2
                className="font-bold tracking-tight text-slate-900 uppercase underline"
                style={{ fontSize: '18px', letterSpacing: '0.5px' }}
              >
                {config.title || 'Boys U9 Draw Kamrup District'}
              </h2>
              {config.subtitle && (
                <p className="text-xs text-slate-600 font-medium mt-1">{config.subtitle}</p>
              )}
            </div>
          </div>

          {/* Main Bracket relative container */}
          <div
            className="relative"
            style={{
              height: `${bracketContentHeight}px`,
              width: `${boxWidth + numRounds * roundWidth}px`,
            }}
          >
            {/* SVG Connecting Lines Overlay */}
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
              style={{
                width: `${boxWidth + numRounds * roundWidth}px`,
                height: `${bracketContentHeight}px`,
              }}
            >
              {renderBracketLines()}
            </svg>

            {/* Round 0 Player Entries List */}
            <div
              className="absolute top-0 left-0 z-20 flex flex-col"
              style={{ gap: `${slotGapY}px` }}
            >
              {Array.from({ length: totalSlots }).map((_, i) => {
                const entry = entries[i] || {
                  id: `empty-${i + 1}`,
                  seed: i + 1,
                  name: 'Bye',
                  isBye: true,
                };

                const labelText = formatPlayerLabel(entry, config);
                const isDragging = draggedIndex === i;
                const isDragOver = dragOverIndex === i;

                return (
                  <div
                    key={`slot-${i}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragLeave={() => handleDragLeave(i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`group relative flex items-center px-2 border border-black bg-white cursor-grab active:cursor-grabbing hover:border-blue-600 hover:ring-2 hover:ring-blue-500/30 transition-all rounded-xs ${
                      entry.isBye ? 'bg-slate-50 text-slate-500 font-normal' : 'font-semibold text-slate-900'
                    } ${isDragging ? 'opacity-40 ring-2 ring-amber-500 border-amber-500 scale-98' : ''} ${
                      isDragOver ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/80' : ''
                    }`}
                    style={{
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                      fontSize: `${config.fontSize || 13}px`,
                      boxSizing: 'border-box',
                    }}
                    title="Drag to swap position, or click to edit name"
                  >
                    {/* Drag Handle Icon (hidden in export/print) */}
                    <span
                      data-export-ignore="true"
                      className="print:hidden hidden group-hover:flex items-center text-slate-400 hover:text-slate-600 mr-1 cursor-grab"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>

                    {/* Entry Name Text */}
                    <span
                      onClick={() => onSelectPlayer(entry, i)}
                      className="whitespace-nowrap flex-1 font-medium cursor-pointer overflow-visible"
                    >
                      {labelText}
                    </span>

                    {/* Hover Controls: Move Up, Move Down, Edit (hidden in export/print) */}
                    <div
                      data-export-ignore="true"
                      className="print:hidden opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity bg-white/90 px-1 py-0.5 rounded border border-slate-200 shadow-xs"
                    >
                      {i > 0 && onMovePlayer && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMovePlayer(i, 'up');
                          }}
                          className="p-0.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                      )}

                      {i < totalSlots - 1 && onMovePlayer && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMovePlayer(i, 'down');
                          }}
                          className="p-0.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlayer(entry, i);
                        }}
                        className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Name"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>Draw Size: {totalSlots} Entries</span>
            <span>Formatted for Microsoft Word / PDF Export</span>
          </div>
        </div>
      </div>
    </div>
  );
};
