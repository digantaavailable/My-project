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
const ISSUED_KEYS_STORAGE_KEY = 'tournament_draw_issued_keys_v1';
export const MAX_TRIAL_EDITS = 5;

// Official Owner Lifetime License Keys (Only for the Owner of the application)
export const OWNER_LIFETIME_KEYS = [
  'MASTER2026',
  'DIGANTA2026',
  'OWNER-LIFETIME-MASTER',
  'LIFE-OWNER-2026',
  'OWNER2026',
];

export const MASTER_LICENSE_KEY = 'MASTER2026';

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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Readable alphanumeric
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

// Activate a Pass (24-Hour or Lifetime Master Pass)
export function activate24HourPass(licenseKey: string, isLifetime: boolean = false): LicenseState {
  const now = Date.now();
  // Lifetime master pass = 100 years, 24-Hour pass = 24 hours
  const durationMs = isLifetime ? 100 * 365 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const expiresAt = now + durationMs;

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

// Validate custom license keys (accepts Owner Lifetime Keys or payment-issued random 24-hour keys)
export function validateAndActivateKey(key: string): { success: boolean; message: string; state?: LicenseState } {
  const cleaned = key.trim().toUpperCase();
  if (!cleaned) {
    return { success: false, message: 'Please enter a valid license key.' };
  }

  // 1. Owner Lifetime License Key Check (Only for application owner)
  if (OWNER_LIFETIME_KEYS.includes(cleaned) || cleaned.startsWith('OWNER-LIFE-')) {
    const updated = activate24HourPass(cleaned, true);
    return {
      success: true,
      message: 'Owner Lifetime License Key Activated! Permanent Unlimited Access is active.',
      state: updated,
    };
  }

  // 2. Validate Payment-Issued 24-Hour Key
  const issuedKeys = getIssuedKeys();
  const isIssuedKey = issuedKeys.includes(cleaned);
  // Also recognize valid format PASS-XXXX-XXXX if generated in session
  const isValidFormatPassKey = /^PASS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned);

  if (isIssuedKey || isValidFormatPassKey) {
    const updated = activate24HourPass(cleaned, false);
    return {
      success: true,
      message: '24-Hour Pass activated successfully! Valid for 24 hours from activation.',
      state: updated,
    };
  }

  return {
    success: false,
    message: 'Invalid license key. Please check your key or complete payment for a 24-Hour Pass.',
  };
}

// Helper to format remaining time on pass (e.g. "23h 45m 12s" or "Unlimited Access")
export function formatRemainingTime(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 8760) {
    return 'Unlimited Lifetime Access';
  }

  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

