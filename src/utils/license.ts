import {
  recordLocalActivity,
  checkAndRedeemLocalTrialCode,
} from './adminStore';

export interface ActivePass {
  isActive: boolean;
  activatedAt: number;
  expiresAt: number;
  licenseKey?: string;
  isMasterKey?: boolean;
}

export interface LicenseState {
  trialEditsUsed: number;
  maxTrialEdits: number;
  activePass: ActivePass | null;
}

const LICENSE_STORAGE_KEY = 'tournament_draw_license_v1';
const ISSUED_KEYS_STORAGE_KEY = 'tournament_draw_issued_keys_v1';
const BURNED_KEYS_STORAGE_KEY = 'tournament_draw_burned_keys_v1';
export const MAX_TRIAL_EDITS = 5;

// Single Master Developer Key (reusable forever as general user, reset goes back to trial mode, reusable again whenever needed)
export const DEVELOPER_MASTER_KEY = 'MASTER2026';
export const DEVELOPER_MASTER_KEYS = [
  'MASTER2026',
  'DIGANTA2026',
  'ADMIN2026',
  'DEV2026',
];

// Helper to check if key is master developer key
export function isDeveloperMasterKey(key: string): boolean {
  const clean = (key || '').trim().toUpperCase();
  return DEVELOPER_MASTER_KEYS.includes(clean) || clean.startsWith('MASTER-') || clean.startsWith('DEV-');
}

// Helper to log user and system activity to server & local storage
export async function logActivity(
  type: string,
  title: string,
  details?: string
): Promise<void> {
  // Always log locally so static deployments (GitHub / Vercel) have real-time activity feeds
  recordLocalActivity(type as any, title, details);

  try {
    await fetch('/api/activity/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, details }),
    });
  } catch {
    // offline or static fallback handled by recordLocalActivity
  }
}

// Helper to get burned/used payment keys
function getBurnedKeys(): string[] {
  try {
    const raw = localStorage.getItem(BURNED_KEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordBurnedKey(key: string): void {
  try {
    const clean = key.trim().toUpperCase();
    // Developer master key is NEVER burned so developer can use it again anytime
    if (isDeveloperMasterKey(clean)) {
      return;
    }
    const keys = getBurnedKeys();
    if (!keys.includes(clean)) {
      keys.push(clean);
      localStorage.setItem(BURNED_KEYS_STORAGE_KEY, JSON.stringify(keys));
    }
  } catch (e) {
    console.warn('Failed to record burned key', e);
  }
}

// Helper to get stored issued payment keys
function getIssuedKeys(): string[] {
  try {
    const raw = localStorage.getItem(ISSUED_KEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Helper to record a newly generated key upon payment
export function recordIssuedKey(key: string): void {
  try {
    const keys = getIssuedKeys();
    if (!keys.includes(key)) {
      keys.push(key);
      localStorage.setItem(ISSUED_KEYS_STORAGE_KEY, JSON.stringify(keys));
    }
  } catch (e) {
    console.warn('Failed to record issued key', e);
  }
}

// Generate a random 24-Hour License Key upon payment
export function generateRandom24HourKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randSegment = (len: number) =>
    Array.from({ length: len }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  const key = `PASS-${randSegment(4)}-${randSegment(4)}`;
  recordIssuedKey(key);
  return key;
}

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
          if (activePass.licenseKey && !isDeveloperMasterKey(activePass.licenseKey)) {
            recordBurnedKey(activePass.licenseKey);
          }
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

// Reset pass -> automatically returns application to trial mode
export function resetLicenseState(): LicenseState {
  const current = getLicenseState();
  if (current.activePass?.licenseKey) {
    const key = current.activePass.licenseKey;
    // Only burn non-developer keys
    if (!isDeveloperMasterKey(key)) {
      recordBurnedKey(key);
    }
    fetch('/api/license/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeKey: key }),
    }).catch(() => {});
  } else {
    fetch('/api/license/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {});
  }

  const resetState: LicenseState = {
    trialEditsUsed: 0,
    maxTrialEdits: MAX_TRIAL_EDITS,
    activePass: null,
  };
  saveLicenseState(resetState);
  return resetState;
}

// Record an edit attempt
export function recordTrialEdit(): LicenseState {
  const current = getLicenseState();
  if (current.activePass && Date.now() < current.activePass.expiresAt) {
    return current;
  }

  const updated: LicenseState = {
    ...current,
    trialEditsUsed: Math.min(MAX_TRIAL_EDITS, current.trialEditsUsed + 1),
  };
  saveLicenseState(updated);
  return updated;
}

// Activate a Pass (24-Hour or Master Developer Pass)
export function activate24HourPass(
  licenseKey: string,
  isLifetime: boolean = false,
  customExpiresAt?: number
): LicenseState {
  const now = Date.now();
  const isMaster = isDeveloperMasterKey(licenseKey) || isLifetime;
  // Master Developer pass gives permanent active pass until developer clicks reset to go to trial mode
  const durationMs = isMaster ? 100 * 365 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const expiresAt = customExpiresAt || now + durationMs;

  const newPass: ActivePass = {
    isActive: true,
    activatedAt: now,
    expiresAt,
    licenseKey,
    isMasterKey: isMaster,
  };

  const current = getLicenseState();
  const updated: LicenseState = {
    ...current,
    activePass: newPass,
  };

  saveLicenseState(updated);
  return updated;
}

// Convenient helper to activate master developer key
export function activateMasterDeveloperPass(key: string = DEVELOPER_MASTER_KEY): LicenseState {
  return activate24HourPass(key, true);
}

// Validate & activate key (Master key can be used repeatedly even after reset)
export async function validateAndActivateKeyAsync(
  key: string
): Promise<{ success: boolean; message: string; state?: LicenseState }> {
  const cleaned = key.trim().toUpperCase();
  if (!cleaned) {
    return { success: false, message: 'Please enter a valid pass code or key.' };
  }

  // Developer Master Key check (always works, reusable whenever needed)
  if (isDeveloperMasterKey(cleaned)) {
    const updated = activate24HourPass(cleaned, true);
    return {
      success: true,
      message: 'Master Key activated successfully! Full access granted.',
      state: updated,
    };
  }

  const burnedKeys = getBurnedKeys();
  if (burnedKeys.includes(cleaned)) {
    return {
      success: false,
      message: 'This pass key has already been redeemed and has expired.',
    };
  }

  // Server redemption endpoint
  try {
    const res = await fetch('/api/license/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: cleaned }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const updated = activate24HourPass(cleaned, data.isLifetime, data.expiresAt);
      return {
        success: true,
        message: data.message || 'Pass activated successfully!',
        state: updated,
      };
    } else if (!res.ok && data.message) {
      return {
        success: false,
        message: data.message,
      };
    }
  } catch {
    // Backend fetch fallback
  }

  // Check local admin store trial codes (e.g. TRIAL24-XXXX or admin-generated codes)
  const localRedemption = checkAndRedeemLocalTrialCode(cleaned);
  if (localRedemption.success) {
    const updated = activate24HourPass(cleaned, false, localRedemption.expiresAt);
    return {
      success: true,
      message: localRedemption.message,
      state: updated,
    };
  }

  // Check issued payment keys
  const issuedKeys = getIssuedKeys();
  const isIssuedKey = issuedKeys.includes(cleaned);
  const isValidFormatPassKey = /^PASS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned);

  if (isIssuedKey || isValidFormatPassKey) {
    const updated = activate24HourPass(cleaned, false);
    return {
      success: true,
      message: '24-Hour Pass activated successfully! Valid for 24 hours.',
      state: updated,
    };
  }

  return {
    success: false,
    message: localRedemption.message !== 'Code not found.' 
      ? localRedemption.message 
      : 'Invalid pass code. Please check your code or complete payment for a 24-Hour Pass.',
  };
}

// Synchronous version for fallback
export function validateAndActivateKey(key: string): { success: boolean; message: string; state?: LicenseState } {
  const cleaned = key.trim().toUpperCase();
  if (!cleaned) {
    return { success: false, message: 'Please enter a valid key.' };
  }

  if (isDeveloperMasterKey(cleaned)) {
    const updated = activate24HourPass(cleaned, true);
    return {
      success: true,
      message: 'Master Key activated successfully! Full access granted.',
      state: updated,
    };
  }

  const burnedKeys = getBurnedKeys();
  if (burnedKeys.includes(cleaned)) {
    return {
      success: false,
      message: 'This pass key has already been redeemed and has expired.',
    };
  }

  const localRedemption = checkAndRedeemLocalTrialCode(cleaned);
  if (localRedemption.success) {
    const updated = activate24HourPass(cleaned, false, localRedemption.expiresAt);
    return {
      success: true,
      message: localRedemption.message,
      state: updated,
    };
  }

  const issuedKeys = getIssuedKeys();
  if (issuedKeys.includes(cleaned) || /^PASS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned)) {
    const updated = activate24HourPass(cleaned, false);
    return {
      success: true,
      message: '24-Hour Pass activated successfully!',
      state: updated,
    };
  }

  return {
    success: false,
    message: localRedemption.message !== 'Code not found.' ? localRedemption.message : 'Invalid pass code.',
  };
}

// Helper to format remaining time on pass
export function formatRemainingTime(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 8760) {
    return 'Master Key Full Access';
  }

  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}
