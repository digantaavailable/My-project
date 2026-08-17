import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Activity,
  Key,
  CreditCard,
  RefreshCw,
  Copy,
  Check,
  Ban,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  FileText,
  Download,
  Printer,
  Sparkles,
  Zap,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { AdminDashboardData, TrialCodeRecord } from '../types';
import { formatRemainingTime, LicenseState, isDeveloperMasterKey } from '../utils/license';
import {
  getLocalAdminData,
  saveLocalAdminData,
  generateLocalTrialCode,
  revokeLocalTrialCode,
  clearLocalActivities,
} from '../utils/adminStore';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseState: LicenseState;
  onAuthenticateMaster: (key: string) => boolean;
  onActivateDeveloperPass?: () => void;
  onResetToTrial?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isOpen,
  onClose,
  licenseState,
  onAuthenticateMaster,
  onActivateDeveloperPass,
  onResetToTrial,
}) => {
  const [data, setData] = useState<AdminDashboardData>(() => getLocalAdminData());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'activity' | 'payments'>('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Authentication gate state
  const [authKeyInput, setAuthKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const isMaster = licenseState.activePass?.isMasterKey === true;

  // New code generation form
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [newCodeHours, setNewCodeHours] = useState<number>(24);
  const [newCodeNotes, setNewCodeNotes] = useState<string>('');

  const fetchDashboardData = async () => {
    if (!isMaster) return;
    setLoading(true);
    setError(null);

    // 1. Immediately load local store
    const local = getLocalAdminData();
    setData(local);

    // 2. Try fetching from server if backend is active
    try {
      const res = await fetch('/api/admin/data');
      if (res.ok) {
        const jsonData = await res.json();
        if (jsonData && jsonData.metrics) {
          setData(jsonData);
          saveLocalAdminData(jsonData);
        }
      }
    } catch {
      // Running in static deployment (e.g. GitHub / Vercel / draw.dskengg.tech)
      // Perfectly fine - local admin store is already loaded and active!
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isMaster) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isMaster]);

  if (!isOpen) return null;

  const handleUnlockWithKey = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authKeyInput.trim()) {
      setAuthError('Please enter the Master Developer Key.');
      return;
    }
    const clean = authKeyInput.trim().toUpperCase();
    if (isDeveloperMasterKey(clean)) {
      const success = onAuthenticateMaster(clean);
      if (success) {
        setAuthKeyInput('');
        fetchDashboardData();
      } else {
        setAuthError('Authentication failed. Please verify the key.');
      }
    } else {
      setAuthError('Invalid Master Developer Key. Access denied.');
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    // 1. Generate in local store immediately
    const newRecord = generateLocalTrialCode(newCodeHours, newCodeNotes);
    setIsGeneratingCode(false);
    setNewCodeNotes('');
    setData(getLocalAdminData());

    // 2. Sync to server if backend is active
    try {
      await fetch('/api/admin/generate-trial-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: newCodeHours, notes: newCodeNotes || 'Created via Admin Dashboard' }),
      });
    } catch {
      // Ignored for static hosting
    }
  };

  const handleRevokeCode = async (code: string) => {
    if (window.confirm(`Revoke and deactivate pass code "${code}"?`)) {
      revokeLocalTrialCode(code);
      setData(getLocalAdminData());

      try {
        await fetch('/api/admin/revoke-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      } catch {
        // Ignored for static hosting
      }
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm('Clear recent activity logs?')) {
      clearLocalActivities();
      setData(getLocalAdminData());

      try {
        await fetch('/api/admin/clear-logs', { method: 'POST' });
      } catch {
        // Ignored for static hosting
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-700 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/50">
              <Shield className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Owner & Admin Portal</h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-medium">
                  {isMaster ? 'Authenticated' : 'Restricted Access'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Operational controls, single-use pass generator & live draw analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMaster && (
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Refresh Live Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LOCKED SCREEN IF NOT MASTER */}
        {!isMaster ? (
          <div className="p-8 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Administrator Access Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                This dashboard is restricted to the tournament administrator. Please enter your Master Key to authenticate.
              </p>
            </div>

            <form onSubmit={handleUnlockWithKey} className="w-full space-y-3">
              <div>
                <input
                  type="password"
                  placeholder="Enter Master Key (e.g. MASTER2026)"
                  value={authKeyInput}
                  onChange={(e) => {
                    setAuthKeyInput(e.target.value);
                    setAuthError(null);
                  }}
                  autoFocus
                  className="w-full text-center tracking-widest text-sm bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
                />
                {authError && (
                  <p className="text-xs text-red-400 mt-1.5 font-medium">{authError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Authenticate & Open Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[11px] text-slate-500">
              General users do not have access to this portal.
            </p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-2 gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4" />
                Overview & Metrics
              </button>
              <button
                onClick={() => setActiveTab('codes')}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'codes'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Key className="w-4 h-4" />
                24h Trial Codes ({data?.trialCodes?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'activity'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                Live Activity Feed ({data?.recentActivities?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Razorpay Ledger
              </button>
            </div>

        {/* Tab Contents */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-3.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Quick Developer Pass Controls */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-white">Developer Quick Switch Controls</div>
                <div className="text-[11px] text-slate-400">
                  Master Key: <code className="text-blue-400 font-mono font-bold">MASTER2026</code> (reusable infinitely)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onActivateDeveloperPass && (
                <button
                  onClick={() => {
                    onActivateDeveloperPass();
                    onClose();
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Activate Master Pass
                </button>
              )}
              {onResetToTrial && (
                <button
                  onClick={() => {
                    onResetToTrial();
                    onClose();
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-600 transition cursor-pointer"
                >
                  Test Free Trial Mode
                </button>
              )}
            </div>
          </div>

          {/* --- TAB 1: OVERVIEW METRICS --- */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Draws Generated
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {data?.metrics.totalDrawsCreated ?? 14}
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Word (.docx) Exports
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {data?.metrics.totalExportsDocx ?? 9}
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Download className="w-4 h-4 text-emerald-400" />
                    PDF & PNG Exports
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {(data?.metrics.totalExportsPdf || 0) + (data?.metrics.totalExportsPng || 0)}
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Key className="w-4 h-4 text-amber-400" />
                    Active 24h Passes
                  </div>
                  <div className="text-2xl font-bold text-amber-400">
                    {data?.metrics.activePassesCount ?? 0}
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    Total Revenue
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    ₹{data?.metrics.totalRevenueInr ?? 0}
                  </div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4">
                  <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Gateway Status
                  </div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Razorpay Live
                  </div>
                </div>
              </div>

              {/* Recent Activity Snapshot */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Recent Activity Stream
                  </h3>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    View all &rarr;
                  </button>
                </div>
                <div className="space-y-2">
                  {data?.recentActivities?.slice(0, 4).map((act) => (
                    <div
                      key={act.id}
                      className="bg-slate-800/90 border border-slate-700/60 rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <div>
                          <div className="font-semibold text-slate-200">{act.title}</div>
                          {act.details && <div className="text-[11px] text-slate-400">{act.details}</div>}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: 24-HOUR TRIAL CODES --- */}
          {activeTab === 'codes' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">24-Hour Trial Pass Codes</h3>
                  <p className="text-xs text-slate-400">
                    Single-use redeem codes. Once used or expired, codes are automatically burned.
                  </p>
                </div>
                <button
                  onClick={() => setIsGeneratingCode(!isGeneratingCode)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Generate New Code
                </button>
              </div>

              {/* Code Generation Form */}
              {isGeneratingCode && (
                <form
                  onSubmit={handleGenerateCode}
                  className="bg-slate-800 border border-blue-500/40 rounded-xl p-4 space-y-3 animate-in fade-in"
                >
                  <div className="font-bold text-xs text-blue-300">Generate Custom Trial Code</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">Validity (Hours):</label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={newCodeHours}
                        onChange={(e) => setNewCodeHours(Number(e.target.value))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">Notes / Description:</label>
                      <input
                        type="text"
                        placeholder="e.g. VIP Tournament Organizer"
                        value={newCodeNotes}
                        onChange={(e) => setNewCodeNotes(e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsGeneratingCode(false)}
                      className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition"
                    >
                      Create Code
                    </button>
                  </div>
                </form>
              )}

              {/* Codes Table */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-700/60">
                  {data?.trialCodes?.map((codeRec: TrialCodeRecord) => {
                    const isAvailable = codeRec.status === 'available';
                    const isActive = codeRec.status === 'active';
                    const isUsed = codeRec.status === 'used';
                    const isRevoked = codeRec.status === 'revoked';

                    return (
                      <div
                        key={codeRec.code}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-750 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isActive
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isAvailable
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            <Key className="w-4 h-4" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-white tracking-wide">
                                {codeRec.code}
                              </span>
                              <button
                                onClick={() => handleCopy(codeRec.code)}
                                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition"
                                title="Copy Pass Code"
                              >
                                {copiedCode === codeRec.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {codeRec.notes || '24-Hour Single-Use Pass'} &bull; {codeRec.durationHours} Hours
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Status Pill */}
                          {isAvailable && (
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
                              Available (Unused)
                            </span>
                          )}
                          {isActive && (
                            <div className="text-right">
                              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full font-semibold">
                                Active Pass
                              </span>
                              {codeRec.expiresAt && (
                                <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                                  {formatRemainingTime(codeRec.expiresAt)} left
                                </div>
                              )}
                            </div>
                          )}
                          {isUsed && (
                            <span className="text-xs bg-slate-700 text-slate-400 px-2.5 py-1 rounded-full font-semibold">
                              Expired / Burned
                            </span>
                          )}
                          {isRevoked && (
                            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full font-semibold">
                              Revoked
                            </span>
                          )}

                          {/* Revoke Action */}
                          {!isRevoked && !isUsed && (
                            <button
                              onClick={() => handleRevokeCode(codeRec.code)}
                              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition"
                              title="Revoke and Burn Code"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 3: LIVE ACTIVITY FEED --- */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Live Event & Activity Log</h3>
                  <p className="text-xs text-slate-400">
                    Real-time stream of draws created, exported documents, and passes redeemed.
                  </p>
                </div>
                <button
                  onClick={handleClearLogs}
                  className="text-xs text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Logs
                </button>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl divide-y divide-slate-700/60 max-h-[50vh] overflow-y-auto">
                {data?.recentActivities && data.recentActivities.length > 0 ? (
                  data.recentActivities.map((act) => (
                    <div key={act.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 p-1 rounded-md bg-slate-700 text-slate-300">
                          {act.type.includes('export_docx') && <FileText className="w-3.5 h-3.5 text-blue-400" />}
                          {act.type.includes('export_pdf') && <Download className="w-3.5 h-3.5 text-emerald-400" />}
                          {act.type.includes('print') && <Printer className="w-3.5 h-3.5 text-slate-300" />}
                          {act.type.includes('draw') && <Activity className="w-3.5 h-3.5 text-amber-400" />}
                          {act.type.includes('key') && <Key className="w-3.5 h-3.5 text-purple-400" />}
                          {act.type.includes('admin') && <Shield className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">{act.title}</div>
                          {act.details && <div className="text-[11px] text-slate-400">{act.details}</div>}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">No activity recorded yet.</div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB 4: RAZORPAY PAYMENTS --- */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Razorpay Transactions Ledger</h3>
                <p className="text-xs text-slate-400">
                  Real-time transaction logs and order verification from the payment gateway.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                    <div className="text-[11px] text-slate-400">Merchant Gateway</div>
                    <div className="text-xs font-bold text-white mt-0.5">Razorpay Live</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                    <div className="text-[11px] text-slate-400">Key ID</div>
                    <div className="text-xs font-mono font-bold text-blue-400 mt-0.5 truncate">
                      rzp_live_TPgpZVAt5gFQkx
                    </div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                    <div className="text-[11px] text-slate-400">Product Price</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">₹300 / 24 Hours</div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700">
                    <div className="text-[11px] text-slate-400">Webhook / Verification</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">HMAC-SHA256</div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 text-center py-6 border-t border-slate-700">
                  <CreditCard className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  No direct transactions in current session. All completed Razorpay payments will stream here in real time.
                </div>
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tournament Draw Admin Engine Online</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
