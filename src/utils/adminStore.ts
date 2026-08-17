import { AdminDashboardData, ActivityEvent, TrialCodeRecord, PaymentLogRecord } from '../types';

const ADMIN_STORAGE_KEY = 'tournament_draw_admin_data_v2';

const DEFAULT_TRIAL_CODES: TrialCodeRecord[] = [
  {
    code: 'TRIAL24-7X9K',
    durationHours: 24,
    status: 'available',
    createdAt: Date.now() - 86400000,
    notes: '24-Hour Single-Use Trial Code #1',
  },
  {
    code: 'TRIAL24-M3Q8',
    durationHours: 24,
    status: 'available',
    createdAt: Date.now() - 86400000,
    notes: '24-Hour Single-Use Trial Code #2',
  },
  {
    code: 'TRIAL24-B6V2',
    durationHours: 24,
    status: 'available',
    createdAt: Date.now() - 86400000,
    notes: '24-Hour Single-Use Trial Code #3',
  },
];

const DEFAULT_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act_init_1',
    type: 'admin_action',
    title: 'Tournament Draw Engine Online',
    details: 'System initialized & ready for tournament draw generation.',
    timestamp: Date.now() - 3600000,
  },
];

export function getLocalAdminData(): AdminDashboardData {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.metrics) {
        // Clean expired active trial codes
        const now = Date.now();
        let activeCount = 0;
        const updatedCodes = (parsed.trialCodes || DEFAULT_TRIAL_CODES).map((tc: TrialCodeRecord) => {
          if (tc.status === 'active' && tc.expiresAt && now > tc.expiresAt) {
            return { ...tc, status: 'used' as const };
          }
          if (tc.status === 'active') activeCount++;
          return tc;
        });

        return {
          metrics: {
            totalDrawsCreated: parsed.metrics.totalDrawsCreated ?? 14,
            totalExportsDocx: parsed.metrics.totalExportsDocx ?? 9,
            totalExportsPdf: parsed.metrics.totalExportsPdf ?? 6,
            totalExportsPng: parsed.metrics.totalExportsPng ?? 4,
            activePassesCount: activeCount,
            totalRevenueInr: parsed.metrics.totalRevenueInr ?? 0,
            totalPaymentsCount: parsed.metrics.totalPaymentsCount ?? 0,
          },
          trialCodes: updatedCodes,
          recentPayments: parsed.recentPayments || [],
          recentActivities: parsed.recentActivities || DEFAULT_ACTIVITIES,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to read admin data from localStorage', e);
  }

  return {
    metrics: {
      totalDrawsCreated: 14,
      totalExportsDocx: 9,
      totalExportsPdf: 6,
      totalExportsPng: 4,
      activePassesCount: 0,
      totalRevenueInr: 0,
      totalPaymentsCount: 0,
    },
    trialCodes: DEFAULT_TRIAL_CODES,
    recentPayments: [],
    recentActivities: DEFAULT_ACTIVITIES,
  };
}

export function saveLocalAdminData(data: AdminDashboardData): void {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save admin data to localStorage', e);
  }
}

export function recordLocalActivity(
  type: ActivityEvent['type'],
  title: string,
  details?: string
): void {
  try {
    const current = getLocalAdminData();
    const newActivity: ActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      details,
      timestamp: Date.now(),
    };

    const metrics = { ...current.metrics };
    if (type === 'draw_created') metrics.totalDrawsCreated++;
    if (type === 'export_docx') metrics.totalExportsDocx++;
    if (type === 'export_pdf') metrics.totalExportsPdf++;
    if (type === 'export_png') metrics.totalExportsPng++;

    const recentActivities = [newActivity, ...current.recentActivities].slice(0, 100);

    saveLocalAdminData({
      ...current,
      metrics,
      recentActivities,
    });
  } catch (e) {
    console.warn('Failed to record local activity', e);
  }
}

export function generateLocalTrialCode(hours: number = 24, notes: string = ''): TrialCodeRecord {
  const current = getLocalAdminData();
  const randSegment = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `TRIAL24-${randSegment}`;

  const newRecord: TrialCodeRecord = {
    code,
    durationHours: hours || 24,
    status: 'available',
    createdAt: Date.now(),
    notes: notes || 'Created via Admin Dashboard',
  };

  const newActivity: ActivityEvent = {
    id: `act_${Date.now()}`,
    type: 'admin_action',
    title: `New 24h Pass Code Created: ${code}`,
    details: `${hours}h validity code created by Admin`,
    timestamp: Date.now(),
  };

  const updatedCodes = [newRecord, ...current.trialCodes];
  const updatedActivities: ActivityEvent[] = [
    newActivity,
    ...current.recentActivities,
  ].slice(0, 100);

  saveLocalAdminData({
    ...current,
    trialCodes: updatedCodes,
    recentActivities: updatedActivities,
  });

  return newRecord;
}

export function revokeLocalTrialCode(code: string): void {
  const current = getLocalAdminData();
  const clean = code.trim().toUpperCase();

  const updatedCodes = current.trialCodes.map((tc) => {
    if (tc.code.toUpperCase() === clean) {
      return { ...tc, status: 'revoked' as const };
    }
    return tc;
  });

  const revokeActivity: ActivityEvent = {
    id: `act_${Date.now()}`,
    type: 'admin_action',
    title: `Pass Code Revoked: ${clean}`,
    details: 'Code permanently disabled by admin',
    timestamp: Date.now(),
  };

  const updatedActivities: ActivityEvent[] = [
    revokeActivity,
    ...current.recentActivities,
  ].slice(0, 100);

  saveLocalAdminData({
    ...current,
    trialCodes: updatedCodes,
    recentActivities: updatedActivities,
  });
}

export function clearLocalActivities(): void {
  const current = getLocalAdminData();
  saveLocalAdminData({
    ...current,
    recentActivities: [
      {
        id: `act_${Date.now()}`,
        type: 'admin_action',
        title: 'Activity logs reset by admin',
        timestamp: Date.now(),
      },
    ],
  });
}

export function checkAndRedeemLocalTrialCode(code: string): {
  success: boolean;
  message: string;
  durationHours?: number;
  expiresAt?: number;
} {
  const current = getLocalAdminData();
  const clean = code.trim().toUpperCase();
  const record = current.trialCodes.find((tc) => tc.code.toUpperCase() === clean);

  if (!record) {
    return { success: false, message: 'Code not found.' };
  }

  if (record.status === 'revoked') {
    return { success: false, message: 'This trial code has been revoked.' };
  }

  if (record.status === 'used' || (record.expiresAt && Date.now() > record.expiresAt)) {
    return { success: false, message: 'This 24-hour trial code has already been redeemed and has expired.' };
  }

  const now = Date.now();
  const durationHours = record.durationHours || 24;
  const expiresAt = record.expiresAt || now + durationHours * 3600 * 1000;

  record.status = 'active';
  record.activatedAt = record.activatedAt || now;
  record.expiresAt = expiresAt;

  saveLocalAdminData(current);
  recordLocalActivity(
    'key_redeemed',
    `Trial Code Activated: ${clean}`,
    `24-Hour Pass activated. Valid until ${new Date(expiresAt).toLocaleTimeString()}`
  );

  return {
    success: true,
    message: `24-Hour Trial Code Activated! Valid until ${new Date(expiresAt).toLocaleDateString()} ${new Date(expiresAt).toLocaleTimeString()}`,
    durationHours,
    expiresAt,
  };
}
