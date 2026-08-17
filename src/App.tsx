import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { NameInputPanel } from './components/NameInputPanel';
import { BracketView } from './components/BracketView';
import { EditPlayerModal } from './components/EditPlayerModal';
import { ExportToolbar } from './components/ExportToolbar';
import { LicenseModal } from './components/LicenseModal';
import { AdminPortal } from './components/AdminPortal';
import { BracketConfig, PlayerEntry } from './types';
import {
  INITIAL_RAW_TEXT,
  DEFAULT_CONFIG,
  parseRawTextToEntries,
} from './utils/bracket';
import { generateDocxBracket } from './utils/docxExport';
import {
  exportToPng,
  exportToPdf,
  copyHtmlTableToClipboard,
  getBracketImageBlob,
} from './utils/pdfExport';
import { saveAs } from 'file-saver';
import {
  getLicenseState,
  recordTrialEdit,
  LicenseState,
  activateMasterDeveloperPass,
  resetLicenseState,
  logActivity,
  isDeveloperMasterKey,
} from './utils/license';

const STORAGE_KEY = 'tournament_draw_saved_state_v1';

export default function App() {
  const [licenseState, setLicenseState] = useState<LicenseState>(() => getLicenseState());
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState<boolean>(false);

  // Hidden Keyboard Shortcut (Ctrl+Shift+A or Cmd+Shift+A) to open Admin Portal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminPortalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [rawText, setRawText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.rawText === 'string') return parsed.rawText;
      }
    } catch (e) {
      console.warn('Could not read saved draw from localStorage', e);
    }
    return INITIAL_RAW_TEXT;
  });

  const [config, setConfig] = useState<BracketConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.config) return { ...DEFAULT_CONFIG, ...parsed.config };
      }
    } catch (e) {
      console.warn('Could not read saved config from localStorage', e);
    }
    return DEFAULT_CONFIG;
  });

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Auto-save state to localStorage on changes
  useEffect(() => {
    try {
      const payload = { rawText, config, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save draw to localStorage', e);
    }
  }, [rawText, config]);

  // Check trial edit permission before applying text changes
  const checkTrialAndApplyText = (newText: string) => {
    const active = licenseState.activePass && Date.now() < licenseState.activePass.expiresAt;
    if (active) {
      setRawText(newText);
      return;
    }

    if (licenseState.trialEditsUsed >= licenseState.maxTrialEdits) {
      setIsLicenseModalOpen(true);
      return;
    }

    // Record trial edit & update
    const updatedLicense = recordTrialEdit();
    setLicenseState(updatedLicense);
    setRawText(newText);
  };

  // Edit Modal State
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntry | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number>(-1);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const bracketRef = useRef<HTMLDivElement>(null);

  // Parse entries from raw text
  const entries = useMemo(() => {
    return parseRawTextToEntries(rawText, false);
  }, [rawText]);

  const handleUpdateConfig = (newConfig: Partial<BracketConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const handleLoadPreset = (presetName: string) => {
    if (presetName === 'preset8' || presetName === 'u11') {
      const names = Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`).join('\n');
      checkTrialAndApplyText(names);
      setConfig({
        ...DEFAULT_CONFIG,
        title: '8-Player Tournament Draw',
      });
    } else if (presetName === 'preset16' || presetName === 'kamrup') {
      const names = Array.from({ length: 16 }, (_, i) => `Player ${i + 1}`).join('\n');
      checkTrialAndApplyText(names);
      setConfig({
        ...DEFAULT_CONFIG,
        title: '16-Player Tournament Draw',
      });
    } else if (presetName === 'preset32' || presetName === 'open32') {
      const names = Array.from({ length: 32 }, (_, i) => `Player ${i + 1}`).join('\n');
      checkTrialAndApplyText(names);
      setConfig({
        ...DEFAULT_CONFIG,
        title: '32-Player Tournament Draw',
        boxWidth: 170,
      });
    } else if (presetName === 'clear' || presetName === 'blank') {
      checkTrialAndApplyText('');
      setConfig({
        ...DEFAULT_CONFIG,
        title: 'Tournament Draw',
      });
    }
  };

  // Auto-pad list to next power of 2 with "Bye"
  const handleAutoPadByes = () => {
    const paddedEntries = parseRawTextToEntries(rawText, true);
    const updatedText = paddedEntries.map((e) => e.name).join('\n');
    checkTrialAndApplyText(updatedText);
  };

  // Swap two players at index1 and index2
  const handleSwapPlayers = (index1: number, index2: number) => {
    const lines = rawText.split('\n');
    if (index1 < 0 || index1 >= lines.length || index2 < 0 || index2 >= lines.length) return;
    const temp = lines[index1];
    lines[index1] = lines[index2];
    lines[index2] = temp;
    checkTrialAndApplyText(lines.join('\n'));
  };

  // Move a player up or down by 1 spot
  const handleMovePlayer = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    handleSwapPlayers(index, targetIndex);
  };

  // Open player edit modal
  const handleSelectPlayer = (player: PlayerEntry, index: number) => {
    setSelectedPlayer(player);
    setSelectedPlayerIndex(index);
    setIsEditModalOpen(true);
  };

  // Save changes from EditPlayerModal
  const handleSavePlayer = (index: number, updatedName: string) => {
    const lines = rawText.split('\n');
    while (lines.length <= index) {
      lines.push('Bye');
    }
    lines[index] = updatedName;
    checkTrialAndApplyText(lines.join('\n'));
    logActivity('draw_edited', 'Player Name Edited', `Slot ${index + 1}: "${updatedName}"`);
  };

  // Developer Quick Controls
  const handleAuthenticateMaster = (key: string): boolean => {
    const clean = (key || '').trim().toUpperCase();
    if (isDeveloperMasterKey(clean)) {
      const activated = activateMasterDeveloperPass(clean);
      setLicenseState(activated);
      logActivity('key_redeemed', 'Master Developer Authenticated', `Key: ${clean}`);
      return true;
    }
    return false;
  };

  const handleActivateDeveloperPass = () => {
    const activated = activateMasterDeveloperPass('MASTER2026');
    setLicenseState(activated);
    logActivity('key_redeemed', 'Master Developer Pass Activated', 'Key: MASTER2026');
  };

  const handleResetToTrial = () => {
    const reset = resetLicenseState();
    setLicenseState(reset);
    logActivity('pass_reset', 'Application Reset to Free Trial', '5 Free Edits Re-enabled');
  };

  // Export Handlers
  const handleExportDocx = async () => {
    try {
      let imgBlob: Blob | undefined;
      if (bracketRef.current) {
        const blob = await getBracketImageBlob(bracketRef.current);
        if (blob) imgBlob = blob;
      }
      await generateDocxBracket(config.title, entries, config, imgBlob);
      logActivity('export_docx', 'Word Document (.docx) Exported', `Title: "${config.title || 'Draw'}"`);
    } catch (err) {
      console.error('Word export failed:', err);
      alert('Failed to generate Word document. Please try again.');
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      if (bracketRef.current) {
        await exportToPdf(bracketRef.current, config.title || 'Tournament_Draw');
        logActivity('export_pdf', 'PDF Document Exported', `Title: "${config.title || 'Draw'}"`);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPng = async () => {
    try {
      setIsExporting(true);
      if (bracketRef.current) {
        await exportToPng(bracketRef.current, `${(config.title || 'Tournament_Draw').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`);
        logActivity('export_png', 'PNG Image Exported', `Title: "${config.title || 'Draw'}"`);
      }
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('Failed to export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async () => {
    const success = await copyHtmlTableToClipboard(config.title, entries, config);
    if (success) {
      setCopied(true);
      logActivity('export_docx', 'Copied Table for Word', 'Word-formatted table placed in clipboard');
      setTimeout(() => setCopied(false), 3000);
    } else {
      alert('Clipboard copy not supported by your browser. Please use Word (.docx) export.');
    }
  };

  const handlePrint = () => {
    logActivity('print_draw', 'Print Tournament Draw', `Title: "${config.title || 'Draw'}"`);
    window.print();
  };

  // Export JSON project file
  const handleExportJson = () => {
    const project = {
      title: config.title,
      rawText,
      config,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const fileName = `${(config.title || 'Tournament_Draw').replace(/[^a-zA-Z0-9_-]/g, '_')}.tdraw.json`;
    saveAs(blob, fileName);
  };

  // Import JSON project file
  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.rawText === 'string') {
          setRawText(parsed.rawText);
          if (parsed.config) setConfig({ ...DEFAULT_CONFIG, ...parsed.config });
          alert('Tournament draw project loaded successfully!');
        } else {
          alert('Invalid tournament draw file format.');
        }
      } catch (err) {
        console.error('Failed to parse draw file', err);
        alert('Could not read tournament draw file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Navigation Header */}
      <Header
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onLoadPreset={handleLoadPreset}
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
        onExportPng={handleExportPng}
        onCopyClipboard={handleCopyClipboard}
        onPrint={handlePrint}
        isExporting={isExporting}
        licenseState={licenseState}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Control Panel: List Input & Settings */}
        <div className="lg:col-span-4 space-y-6 print:hidden">
          <NameInputPanel
            rawText={rawText}
            onChangeRawText={checkTrialAndApplyText}
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onAutoPadByes={handleAutoPadByes}
            onSwapPlayers={handleSwapPlayers}
            onMovePlayer={handleMovePlayer}
            entryCount={entries.length}
          />

          <ExportToolbar
            onExportDocx={handleExportDocx}
            onExportPdf={handleExportPdf}
            onExportPng={handleExportPng}
            onCopyClipboard={handleCopyClipboard}
            onPrint={handlePrint}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            copied={copied}
            isExporting={isExporting}
          />
        </div>

        {/* Right Canvas: Visual Draw Bracket */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Live Bracket Visualizer (Drag & drop or use ▲ ▼ arrows to re-arrange)
            </span>
            <div className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
              💡 Drag rectangles to swap order
            </div>
          </div>

          <BracketView
            entries={entries}
            config={config}
            onSelectPlayer={handleSelectPlayer}
            onSwapPlayers={handleSwapPlayers}
            onMovePlayer={handleMovePlayer}
            containerRef={bracketRef}
          />
        </div>
      </main>

      {/* Modal for In-Place Player Edit */}
      <EditPlayerModal
        player={selectedPlayer}
        index={selectedPlayerIndex}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSavePlayer}
      />

      {/* Modal for 24-Hour Pass License Activation */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        licenseState={licenseState}
        onUpdateLicense={setLicenseState}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
      />

      {/* Admin Operations & Live Metrics Portal */}
      <AdminPortal
        isOpen={isAdminPortalOpen}
        onClose={() => setIsAdminPortalOpen(false)}
        licenseState={licenseState}
        onAuthenticateMaster={handleAuthenticateMaster}
        onActivateDeveloperPass={handleActivateDeveloperPass}
        onResetToTrial={handleResetToTrial}
      />
    </div>
  );
}
