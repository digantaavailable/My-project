export interface PlayerEntry {
  id: string;
  seed: number;
  name: string;
  isBye: boolean;
}

export interface MatchNode {
  id: string;
  round: number; // 0 = First round, 1 = Quarterfinals (or R2), etc.
  matchIndex: number; // Index within the round
  player1: PlayerEntry | null;
  player2: PlayerEntry | null;
  winner?: PlayerEntry | null;
}

export interface BracketConfig {
  title: string;
  subtitle: string;
  lineColor: string; // e.g. "#1d4ed8" or "#0f172a"
  lineWidth: number; // e.g. 2
  boxBorderColor: string; // e.g. "#000000"
  boxBgColor: string; // e.g. "#ffffff"
  boxTextColor: string; // e.g. "#000000"
  fontSize: number; // e.g. 13
  boxPaddingY: number; // e.g. 6
  boxWidth: number; // e.g. 180
  boxGapY: number; // gap between player pairs
  showNumbers: boolean; // e.g. true (1.Mitran, 2.Bye)
  numberFormat: 'dot' | 'paren' | 'none'; // "1.Name" or "1) Name"
  bracketType: 'single-elimination';
  alignment: 'left' | 'balanced'; // 'left' matches screenshot where all entries are on left
}

export interface TournamentDraw {
  id: string;
  title: string;
  subtitle: string;
  rawText: string;
  entries: PlayerEntry[];
  config: BracketConfig;
}

export interface ActivityEvent {
  id: string;
  type:
    | 'draw_created'
    | 'draw_edited'
    | 'export_docx'
    | 'export_pdf'
    | 'export_png'
    | 'print_draw'
    | 'pass_activated'
    | 'key_redeemed'
    | 'pass_reset'
    | 'payment_created'
    | 'payment_success'
    | 'payment_failed'
    | 'admin_action';
  title: string;
  details?: string;
  timestamp: number;
}

export interface TrialCodeRecord {
  code: string;
  durationHours: number;
  status: 'available' | 'active' | 'used' | 'revoked';
  createdAt: number;
  activatedAt?: number;
  expiresAt?: number;
  notes?: string;
}

export interface PaymentLogRecord {
  id: string;
  orderId?: string;
  paymentId?: string;
  amount: number;
  currency: string;
  email?: string;
  status: 'created' | 'success' | 'failed';
  timestamp: number;
}

export interface AdminDashboardData {
  metrics: {
    totalDrawsCreated: number;
    totalExportsDocx: number;
    totalExportsPdf: number;
    totalExportsPng: number;
    activePassesCount: number;
    totalRevenueInr: number;
    totalPaymentsCount: number;
  };
  trialCodes: TrialCodeRecord[];
  recentPayments: PaymentLogRecord[];
  recentActivities: ActivityEvent[];
}
