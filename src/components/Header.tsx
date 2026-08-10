import React from 'react';
import { Trophy, FileText, Download, Printer, Copy, Sparkles } from 'lucide-react';
import { BracketConfig } from '../types';
import { LicenseBadge } from './LicenseBadge';
import { LicenseState } from '../utils/license';

interface HeaderProps {
  config: BracketConfig;
  onUpdateConfig: (newConfig: Partial<BracketConfig>) => void;
  onLoadPreset: (presetName: string) => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
  onExportPng: () => void;
  onCopyClipboard: () => void;
  onPrint: () => void;
  isExporting: boolean;
  licenseState: LicenseState;
  onOpenLicenseModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadPreset,
  onExportDocx,
  onExportPdf,
  onExportPng,
  onCopyClipboard,
  onPrint,
  isExporting,
  licenseState,
  onOpenLicenseModal,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Tournament Draw Generator
              <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-medium">
                Word Editable
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Create & export exact knockout draw brackets in editable Word (.docx), PDF & image formats
            </p>
          </div>
        </div>

        {/* Quick Presets & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* License Status Badge */}
          <LicenseBadge licenseState={licenseState} onOpenModal={onOpenLicenseModal} />

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 rounded-lg p-1 border border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-400 ml-1.5" />
            <select
              onChange={(e) => {
                if (e.target.value) onLoadPreset(e.target.value);
              }}
              defaultValue="preset16"
              className="bg-transparent text-xs text-slate-200 font-medium py-1 px-2 focus:outline-none cursor-pointer"
              title="Load Pre-built Templates"
            >
              <option value="preset8" className="bg-slate-800 text-white">
                Preset: 8 Players Draw
              </option>
              <option value="preset16" className="bg-slate-800 text-white">
                Preset: 16 Players Draw
              </option>
              <option value="preset32" className="bg-slate-800 text-white">
                Preset: 32 Players Draw
              </option>
              <option value="clear" className="bg-slate-800 text-white">
                Clear / Blank Draw
              </option>
            </select>
          </div>

          {/* Primary Export Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onExportDocx}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
              title="Download editable Microsoft Word (.docx) document"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Word (.docx)</span>
            </button>

            <button
              onClick={onExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition disabled:opacity-50"
              title="Export as PDF"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={onExportPng}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition disabled:opacity-50"
              title="Export high quality image"
            >
              <span className="hidden sm:inline">PNG</span>
            </button>

            <button
              onClick={onCopyClipboard}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-700 transition"
              title="Copy editable table for Word Ctrl+V"
            >
              <Copy className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden md:inline">Copy Word Table</span>
            </button>

            <button
              onClick={onPrint}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
              title="Print Draw Sheet"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
