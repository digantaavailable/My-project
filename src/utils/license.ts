export interface ActivePass {
  isActive: boolean;
  activatedAt: number;
  expiresAt: number;
  licenseKey?: string;
}

export interface LicenseState {
  trialEditsUsed: number;
  maxTrialEdits: number;
  activePass: ActivePass | null;
}

const LICENSE_STORAGE_KEY = 'tournament_draw_license_v1';
export const MAX_TRIAL_EDITS = 5;

// Read state from localStorage
export function getLicenseState(): LicenseState {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const activePass = parsed.activePass;

      // Check if pass is expired
      if (activePass && activePass.expiresAt) {
        if (Date.now() > activePass.expiresAt) {
          // Pass expired
          return {
            trialEditsUsed: parsed.trialEditsUsed ?? 0,
            maxTrialEdits: MAX_TRIAL_EDITS,
            activePass: null,
          };
        }
      }

      return {
        trialEditsUsed: parsed.trialEditsUsed ?? 0,
        maxTrialEdits: MAX_TRIAL_EDITS,
        activePass: activePass && Date.now() < activePass.expiresAt ? activePass : null,
      };
    }
  } catch (e) {
    console.warn('Could not read license state from localStorage', e);
  }

  return {
    trialEditsUsed: 0,
    maxTrialEdits: MAX_TRIAL_EDITS,
    activePass: null,
  };
}

// Save state to localStorage
export function saveLicenseState(state: LicenseState): void {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save license state to localStorage', e);
  }
}

// Record an edit attempt
export function recordTrialEdit(): LicenseState {
  const current = getLicenseState();
  if (current.activePass && Date.now() < current.activePass.expiresAt) {
    return current; // Active pass has unlimited edits
  }

  const updated: LicenseState = {
    ...current,
    trialEditsUsed: Math.min(MAX_TRIAL_EDITS, current.trialEditsUsed + 1),
  };
  saveLicenseState(updated);
  return updated;
}

// Activate a 24-Hour Pass
export function activate24HourPass(licenseKey: string = 'DAYPASS-24H'): LicenseState {
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 Hours from now

  const newPass: ActivePass = {
    isActive: true,
    activatedAt: now,
    expiresAt,
    licenseKey,
  };

  const current = getLicenseState();
  const updated: LicenseState = {
    ...current,
    activePass: newPass,
  };

  saveLicenseState(updated);
  return updated;
}

// Validate custom license keys (accepts standard generated keys or demo keys)
export function validateAndActivateKey(key: string): { success: boolean; message: string; state?: LicenseState } {
  const cleaned = key.trim().toUpperCase();
  if (!cleaned) {
    return { success: false, message: 'Please enter a valid license key.' };
  }

  // Accepts standard key formats like PASS-*, DAYPASS*, TOURNEY24, VIP*, or any key > 4 chars
  if (cleaned.length >= 4) {
    const updated = activate24HourPass(cleaned);
    return {
      success: true,
      message: '24-Hour Pass activated successfully! You now have 24 hours of unlimited access.',
      state: updated,
    };
  }

  return { success: false, message: 'Invalid license key format. Keys must be at least 4 characters.' };
}

// Helper to format remaining time on 24h pass (e.g. "23h 45m 12s")
export function formatRemainingTime(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}
