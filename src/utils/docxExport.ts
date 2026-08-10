import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { PlayerEntry, BracketConfig } from '../types';
import { formatPlayerLabel } from './bracket';

export async function generateDocxBracket(
  title: string,
  entries: PlayerEntry[],
  config: BracketConfig,
  imageBlob?: Blob
) {
  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300, before: 200 },
      children: [
        new TextRun({
          text: title || 'Tournament Draw',
          bold: true,
          size: 32, // 16pt font
          font: 'Arial',
          underline: {},
        }),
      ],
    })
  );

  // If we have an image blob from SVG capture, insert it first as an exact visual replica
  if (imageBlob) {
    try {
      const buffer = await imageBlob.arrayBuffer();
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new ImageRun({
              data: new Uint8Array(buffer),
              transformation: {
                width: 600,
                height: 750,
              },
            } as any),
          ],
        })
      );

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new TextRun({
              text: 'Editable Draw List Table:',
              bold: true,
              size: 24,
              font: 'Arial',
            }),
          ],
        })
      );
    } catch (e) {
      console.warn('Could not embed image in docx:', e);
    }
  }

  // Generate native editable Word Table for players and matches
  // Column 1: Seed # & Player Name (Boxed cell)
  // Column 2: Round 1 Connector
  // Column 3: Round 2 Match Box / Winner
  // Column 4: Round 2 Connector
  // Column 5: Semifinal Match Box
  // Column 6: Semifinal Connector
  // Column 7: Final Match Box

  const totalSlots = Math.pow(2, Math.ceil(Math.log2(Math.max(entries.length, 2))));
  const numRounds = Math.log2(totalSlots);

  // Pad entries to power of 2
  const padded: PlayerEntry[] = [...entries];
  while (padded.length < totalSlots) {
    padded.push({
      id: `pad-${padded.length + 1}`,
      seed: padded.length + 1,
      name: 'Bye',
      isBye: true,
    });
  }

  const tableRows: TableRow[] = [];

  // Header row
  const headerCells: TableCell[] = [
    new TableCell({
      width: { size: 35, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Round 1 / Draw List', bold: true, size: 20, font: 'Arial' })],
        }),
      ],
    }),
  ];

  for (let r = 1; r < numRounds; r++) {
    const roundName =
      r === numRounds - 1
        ? 'Finals'
        : r === numRounds - 2
        ? 'Semi-Finals'
        : r === numRounds - 3
        ? 'Quarter-Finals'
        : `Round ${r + 1}`;
    headerCells.push(
      new TableCell({
        width: { size: Math.floor(65 / (numRounds - 1)), type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [new TextRun({ text: roundName, bold: true, size: 20, font: 'Arial' })],
          }),
        ],
      })
    );
  }

  tableRows.push(
    new TableRow({
      children: headerCells,
      tableHeader: true,
    })
  );

  // Populate table rows (1 row per entry)
  for (let i = 0; i < totalSlots; i++) {
    const entry = padded[i];
    const label = formatPlayerLabel(entry, config);

    const cells: TableCell[] = [];

    // First Column: Player Box (with full rectangular border)
    cells.push(
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        },
        shading: {
          fill: entry.isBye ? 'F3F4F6' : 'FFFFFF',
        },
        children: [
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: label,
                bold: !entry.isBye,
                italics: entry.isBye,
                size: 22, // 11pt
                font: 'Arial',
                color: entry.isBye ? '6B7280' : '000000',
              }),
            ],
          }),
        ],
      })
    );

    // Round columns
    for (let r = 1; r < numRounds; r++) {
      const matchSpan = Math.pow(2, r); // e.g. 2 for R1->R2, 4 for R2->R3
      const isMatchTop = i % matchSpan === 0;
      const isMatchBottom = i % matchSpan === matchSpan - 1;
      const isMatchMiddle = i % matchSpan > 0 && i % matchSpan < matchSpan - 1;

      // Draw connector lines in Word table
      let cellBorders: any = {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      };

      if (isMatchTop) {
        cellBorders.right = { style: BorderStyle.SINGLE, size: 12, color: '1D4ED8' };
        cellBorders.bottom = { style: BorderStyle.SINGLE, size: 6, color: '1D4ED8' };
      } else if (isMatchBottom) {
        cellBorders.right = { style: BorderStyle.SINGLE, size: 12, color: '1D4ED8' };
      } else if (isMatchMiddle) {
        cellBorders.right = { style: BorderStyle.SINGLE, size: 12, color: '1D4ED8' };
      }

      cells.push(
        new TableCell({
          width: { size: Math.floor(65 / (numRounds - 1)), type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: '', size: 20 })],
            }),
          ],
        })
      );
    }

    tableRows.push(
      new TableRow({
        children: cells,
      })
    );
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  children.push(table);

  // Footer note
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 300 },
      children: [
        new TextRun({
          text: `Generated via Tournament Draw Generator (${title})`,
          italics: true,
          size: 16,
          color: '9CA3AF',
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${(title || 'Tournament_Draw').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
  saveAs(blob, fileName);
}
