import React, { useRef } from 'react';
import { FileText, Download, Copy, Printer, CheckCircle, Info, Save, Upload } from 'lucide-react';

interface ExportToolbarProps {
  onExportDocx: () => void;
  onExportPdf: () => void;
  onExportPng: () => void;
  onCopyClipboard: () => void;
  onPrint: () => void;
  onExportJson?: () => void;
  onImportJson?: (file: File) => void;
  copied: boolean;
  isExporting: boolean;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  onExportDocx,
  onExportPdf,
  onExportPng,
  onCopyClipboard,
  onPrint,
  onExportJson,
  onImportJson,
  copied,
  isExporting,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-blue-600" />
          Export & Backup Options
        </h3>
        {copied && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Copied Word Table to Clipboard!
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Word Docx */}
        <button
          onClick={onExportDocx}
          disabled={isExporting}
          className="flex flex-col items-start p-3 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-lg text-left transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-bold text-blue-900">Word Document (.docx)</span>
          </div>
          <p className="text-[11px] text-blue-700/80 leading-tight">
            Downloads native .docx with editable tables & vector diagram.
          </p>
        </button>

        {/* Copy to Word Clipboard */}
        <button
          onClick={onCopyClipboard}
          className="flex flex-col items-start p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Copy className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900">Copy Table for Word</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Copies formatted HTML table to paste directly into Word (Ctrl+V).
          </p>
        </button>

        {/* PDF Export */}
        <button
          onClick={onExportPdf}
          disabled={isExporting}
          className="flex flex-col items-start p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900">PDF Document (.pdf)</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Print-ready A4 PDF document with exact visual spacing.
          </p>
        </button>

        {/* PNG Export */}
        <button
          onClick={onExportPng}
          disabled={isExporting}
          className="flex flex-col items-start p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Printer className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900">High-Res PNG</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Export 2x high resolution image for messaging or printing.
          </p>
        </button>
      </div>

      {/* Backup & Transfer Project file across devices */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 text-[11px] font-medium">
          💾 <strong>Auto-Saved</strong> in browser. Save backup file to open on other devices:
        </span>

        <div className="flex items-center gap-2">
          {onExportJson && (
            <button
              type="button"
              onClick={onExportJson}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md border border-slate-300 transition"
              title="Download editable project backup file (.tdraw.json)"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              Save Project File
            </button>
          )}

          {onImportJson && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportJson(file);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md border border-blue-200 transition"
                title="Open a saved project file (.tdraw.json) from another device"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                Open Project File
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
