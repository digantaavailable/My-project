import React, { useEffect, useState } from 'react';
import { LicenseState, formatRemainingTime } from '../utils/license';
import { ShieldCheck, Clock, Lock, Sparkles, Key } from 'lucide-react';

interface LicenseBadgeProps {
  licenseState: LicenseState;
  onOpenModal: () => void;
}

export const LicenseBadge: React.FC<LicenseBadgeProps> = ({ licenseState, onOpenModal }) => {
  const [now, setNow] = useState(Date.now());

  // Live timer tick every second if pass is active
  useEffect(() => {
    if (!licenseState.activePass) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [licenseState.activePass]);

  const isActive = !!(
    licenseState.activePass &&
    licenseState.activePass.expiresAt &&
    now < licenseState.activePass.expiresAt
  );

  const trialEditsLeft = Math.max(0, licenseState.maxTrialEdits - licenseState.trialEditsUsed);

  if (isActive && licenseState.activePass) {
    const timeLeftStr = formatRemainingTime(licenseState.activePass.expiresAt);
    const isLifetime = timeLeftStr.includes('Lifetime') || (licenseState.activePass.expiresAt - now > 8760 * 3600 * 1000);

    return (
      <button
        onClick={onOpenModal}
        className="flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition shadow-xs group cursor-pointer"
        title="Pass Active - Click to manage"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="font-mono text-emerald-300 font-bold">{timeLeftStr}</span>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-sans uppercase tracking-wider">
          {isLifetime ? 'Lifetime' : '24h Pass'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpenModal}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${
        trialEditsLeft > 0
          ? 'bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/40 text-amber-200'
          : 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200 animate-pulse'
      }`}
      title="Click to activate 24-Hour Day Pass"
    >
      {trialEditsLeft > 0 ? (
        <Clock className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Lock className="w-3.5 h-3.5 text-rose-400" />
      )}
      <span>
        {trialEditsLeft > 0
          ? `Trial: ${trialEditsLeft}/${licenseState.maxTrialEdits} edits`
          : 'Trial Expired'}
      </span>
      <span className="text-[10px] bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-0.5 font-sans">
        <Key className="w-3 h-3 text-amber-300" />
        Get 24h Pass
      </span>
    </button>
  );
};
