import { PlayerEntry, MatchNode, BracketConfig, TournamentDraw } from '../types';

export const INITIAL_RAW_TEXT = Array.from({ length: 16 }, (_, i) => `Player ${i + 1}`).join('\n');

export const DEFAULT_CONFIG: BracketConfig = {
  title: '16-Player Tournament Draw',
  subtitle: '',
  lineColor: '#000000', // Black line
  lineWidth: 2,
  boxBorderColor: '#000000',
  boxBgColor: '#ffffff',
  boxTextColor: '#000000',
  fontSize: 13,
  boxPaddingY: 6,
  boxWidth: 190,
  boxGapY: 10,
  showNumbers: true,
  numberFormat: 'dot',
  bracketType: 'single-elimination',
  alignment: 'left',
};

export function parseRawTextToEntries(text: string, autoPadPowerOf2: boolean = false): PlayerEntry[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let entries: PlayerEntry[] = lines.map((line, index) => {
    // Strip leading numbers like "1.", "1)", "1 - ", "1:" if already present in text
    let cleanName = line.replace(/^\d+[\.\)\-\:]\s*/, '').trim();
    if (!cleanName) cleanName = line.trim();

    const isBye = cleanName.toLowerCase() === 'bye' || cleanName.toLowerCase() === 'by';
    return {
      id: `player-${index + 1}`,
      seed: index + 1,
      name: isBye ? 'Bye' : cleanName,
      isBye,
    };
  });

  if (autoPadPowerOf2 && entries.length > 0) {
    let targetCount = 2;
    while (targetCount < entries.length && targetCount < 128) {
      targetCount *= 2;
    }
    while (entries.length < targetCount) {
      entries.push({
        id: `player-${entries.length + 1}`,
        seed: entries.length + 1,
        name: 'Bye',
        isBye: true,
      });
    }
  }

  return entries;
}

export function formatPlayerLabel(entry: PlayerEntry | null, config: BracketConfig): string {
  if (!entry) return '';
  if (!config.showNumbers) return entry.name;
  const numStr = config.numberFormat === 'paren' ? `${entry.seed}) ` : `${entry.seed}.`;
  return `${numStr}${entry.name}`;
}

export function calculateBracketRounds(entries: PlayerEntry[]): {
  numRounds: number;
  totalSlots: number;
  rounds: MatchNode[][];
} {
  const totalSlots = Math.pow(2, Math.ceil(Math.log2(Math.max(entries.length, 2))));
  const numRounds = Math.log2(totalSlots);

  // Pad entries to totalSlots if fewer
  const paddedEntries: PlayerEntry[] = [...entries];
  while (paddedEntries.length < totalSlots) {
    paddedEntries.push({
      id: `pad-${paddedEntries.length + 1}`,
      seed: paddedEntries.length + 1,
      name: 'Bye',
      isBye: true,
    });
  }

  const rounds: MatchNode[][] = [];

  // Round 0 (First Round)
  const round0Matches: MatchNode[] = [];
  for (let i = 0; i < totalSlots; i += 2) {
    const p1 = paddedEntries[i];
    const p2 = paddedEntries[i + 1];
    
    // Determine default auto-winner for Byes if applicable
    let winner: PlayerEntry | null = null;
    if (p1 && p2) {
      if (p1.isBye && !p2.isBye) winner = p2;
      else if (p2.isBye && !p1.isBye) winner = p1;
    }

    round0Matches.push({
      id: `r0-m${i / 2}`,
      round: 0,
      matchIndex: i / 2,
      player1: p1,
      player2: p2,
      winner,
    });
  }
  rounds.push(round0Matches);

  // Subsequent rounds
  let prevRound = round0Matches;
  for (let r = 1; r < numRounds; r++) {
    const currentRound: MatchNode[] = [];
    const numMatchesInRound = prevRound.length / 2;
    for (let m = 0; m < numMatchesInRound; m++) {
      const prevM1 = prevRound[m * 2];
      const prevM2 = prevRound[m * 2 + 1];

      const p1 = prevM1?.winner || null;
      const p2 = prevM2?.winner || null;

      currentRound.push({
        id: `r${r}-m${m}`,
        round: r,
        matchIndex: m,
        player1: p1,
        player2: p2,
      });
    }
    rounds.push(currentRound);
    prevRound = currentRound;
  }

  return { numRounds, totalSlots, rounds };
}

export function getRoundName(roundIndex: number, totalRounds: number): string {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semi-Finals';
  if (remaining === 3) return 'Quarter-Finals';
  if (remaining === 4) return 'Round of 16';
  if (remaining === 5) return 'Round of 32';
  return `Round ${roundIndex + 1}`;
}
