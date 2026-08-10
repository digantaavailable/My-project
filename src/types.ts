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
