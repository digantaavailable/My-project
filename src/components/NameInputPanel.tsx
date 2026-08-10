import React, { useState } from 'react';
import { BracketConfig } from '../types';
import {
  ListOrdered,
  Type,
  Settings2,
  Plus,
  Trash2,
  ArrowRightLeft,
  Palette,
  ChevronUp,
  ChevronDown,
  GripVertical,
  LayoutList,
  FileText,
} from 'lucide-react';

interface NameInputPanelProps {
  rawText: string;
  onChangeRawText: (text: string) => void;
  config: BracketConfig;
  onUpdateConfig: (newConfig: Partial<BracketConfig>) => void;
  onAutoPadByes: () => void;
  onSwapPlayers?: (index1: number, index2: number) => void;
  onMovePlayer?: (index: number, direction: 'up' | 'down') => void;
  entryCount: number;
}

export const NameInputPanel: React.FC<NameInputPanelProps> = ({
  rawText,
  onChangeRawText,
  config,
  onUpdateConfig,
  onAutoPadByes,
  onSwapPlayers,
  onMovePlayer,
  entryCount,
}) => {
  const [viewMode, setViewMode] = useState<'text' | 'cards'>('text');

  const lines = rawText ? rawText.split('\n').filter((l) => l.trim().length > 0) : [];
  const lineCount = lines.length;

  const handleAddBye = () => {
    const updated = rawText ? `${rawText.trim()}\nBye` : 'Bye';
    onChangeRawText(updated);
  };

  const handleClear = () => {
    onChangeRawText('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4 text-slate-800">
      {/* Title & Subtitle Fields */}
      <div className="space-y-3 pb-3 border-b border-slate-100">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-blue-600" />
            Tournament / Draw Title
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => onUpdateConfig({ title: e.target.value })}
            placeholder="e.g. Boys U9 Draw Kamrup District"
            className="w-full text-sm font-semibold border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition shadow-inner"
          />
        </div>
      </div>

      {/* Raw Text Names Input Area */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4 text-blue-600" />
            Player / Entry Order
          </label>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('text')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition flex items-center gap-1 ${
                viewMode === 'text'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              Text
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3 h-3" />
              Rearrange
            </button>
          </div>
        </div>

        {viewMode === 'text' ? (
          <>
            <p className="text-[11px] text-slate-500 mb-2">
              Paste or type names line-by-line in seed order. Type <code className="bg-slate-100 px-1 py-0.5 rounded border text-slate-700 font-mono">Bye</code> for bye slots.
            </p>

            <textarea
              rows={12}
              value={rawText}
              onChange={(e) => onChangeRawText(e.target.value)}
              placeholder={`1. Mitran\n2. Bye\n3. Prayash\n4. Anshuman...`}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none leading-relaxed shadow-inner transition"
            />
          </>
        ) : (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 border border-slate-200 rounded-lg p-2 bg-slate-50">
            <p className="text-[11px] text-slate-500 mb-2 px-1">
              Click ▲ or ▼ to move entries up or down, or drag rectangles in the canvas.
            </p>
            {lines.map((line, i) => {
              let cleanName = line.replace(/^\d+[\.\)\-\:]\s*/, '').trim();
              if (!cleanName) cleanName = line.trim();
              const isBye = cleanName.toLowerCase() === 'bye' || cleanName.toLowerCase() === 'by';

              return (
                <div
                  key={`card-${i}`}
                  className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs hover:border-blue-400 transition"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className={`truncate font-medium ${isBye ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                      {cleanName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {i > 0 && onMovePlayer && (
                      <button
                        type="button"
                        onClick={() => onMovePlayer(i, 'up')}
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {i < lines.length - 1 && onMovePlayer && (
                      <button
                        type="button"
                        onClick={() => onMovePlayer(i, 'down')}
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick List Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddBye}
              className="text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md border border-slate-300 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              Add Bye
            </button>
            <button
              type="button"
              onClick={onAutoPadByes}
              className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md border border-blue-200 transition flex items-center gap-1"
              title="Pad entries to 4, 8, 16, or 32 with Byes automatically"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              Auto-Pad
            </button>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-md transition flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Format & Style Customization */}
      <div className="pt-3 border-t border-slate-200 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 text-blue-600" />
          Format & Appearance
        </h4>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Number Format */}
          <div>
            <label className="text-slate-600 font-medium block mb-1">Number Prefix</label>
            <select
              value={config.showNumbers ? config.numberFormat : 'none'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'none') {
                  onUpdateConfig({ showNumbers: false });
                } else {
                  onUpdateConfig({ showNumbers: true, numberFormat: val as any });
                }
              }}
              className="w-full text-xs border border-slate-300 rounded-md p-1.5 bg-slate-50 font-medium text-slate-800"
            >
              <option value="dot">1. Mitran (Dot)</option>
              <option value="paren">1) Mitran (Paren)</option>
              <option value="none">Mitran (No Number)</option>
            </select>
          </div>

          {/* Line Color */}
          <div>
            <label className="text-slate-600 font-medium block mb-1 flex items-center gap-1">
              <Palette className="w-3 h-3 text-slate-500" />
              Line Color
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={config.lineColor}
                onChange={(e) => onUpdateConfig({ lineColor: e.target.value })}
                className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
              />
              <select
                value={config.lineColor}
                onChange={(e) => onUpdateConfig({ lineColor: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-md p-1.5 bg-slate-50 text-slate-800"
              >
                <option value="#1d4ed8">Blue (Original)</option>
                <option value="#000000">Black</option>
                <option value="#1e3a8a">Dark Navy</option>
                <option value="#475569">Slate Gray</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          {/* Box Width */}
          <div>
            <label className="text-slate-600 font-medium block mb-1">
              Box Width: <span className="font-semibold text-slate-900">{config.boxWidth}px</span>
            </label>
            <input
              type="range"
              min={140}
              max={320}
              step={5}
              value={config.boxWidth}
              onChange={(e) => onUpdateConfig({ boxWidth: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Font Size */}
          <div>
            <label className="text-slate-600 font-medium block mb-1">
              Font Size: <span className="font-semibold text-slate-900">{config.fontSize}px</span>
            </label>
            <input
              type="range"
              min={10}
              max={16}
              value={config.fontSize}
              onChange={(e) => onUpdateConfig({ fontSize: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
