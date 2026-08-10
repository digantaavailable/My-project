import { toPng, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { PlayerEntry, BracketConfig } from '../types';
import { formatPlayerLabel } from './bracket';

export async function exportToPng(element: HTMLElement, fileName: string = 'tournament_draw.png') {
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    saveAs(dataUrl, fileName);
  } catch (err) {
    console.error('Failed to export PNG', err);
    throw err;
  }
}

export async function getBracketImageBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    const blob = await toBlob(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    return blob;
  } catch (err) {
    console.error('Failed to get bracket image blob', err);
    return null;
  }
}

export async function exportToPdf(
  element: HTMLElement,
  title: string = 'Tournament Draw',
  orientation: 'portrait' | 'landscape' = 'portrait'
) {
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: orientation === 'portrait' ? 'p' : 'l',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Image aspect ratio
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => (img.onload = resolve));

    const imgWidth = img.width;
    const imgHeight = img.height;
    const ratio = Math.min((pageWidth - 20) / imgWidth, (pageHeight - 20) / imgHeight);

    const targetW = imgWidth * ratio;
    const targetH = imgHeight * ratio;
    const x = (pageWidth - targetW) / 2;
    const y = 10;

    pdf.addImage(dataUrl, 'PNG', x, y, targetW, targetH);
    pdf.save(`${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  } catch (err) {
    console.error('Failed to export PDF', err);
    throw err;
  }
}

export function copyHtmlTableToClipboard(
  title: string,
  entries: PlayerEntry[],
  config: BracketConfig
): boolean {
  try {
    const totalSlots = Math.pow(2, Math.ceil(Math.log2(Math.max(entries.length, 2))));
    const numRounds = Math.log2(totalSlots);

    const padded: PlayerEntry[] = [...entries];
    while (padded.length < totalSlots) {
      padded.push({
        id: `pad-${padded.length + 1}`,
        seed: padded.length + 1,
        name: 'Bye',
        isBye: true,
      });
    }

    let html = `<div style="font-family: Arial, sans-serif; color: #000;">
      <h2 style="text-align: center; text-decoration: underline; margin-bottom: 20px;">${title}</h2>
      <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; width: 100%; border: 1px solid #000;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #000; text-align: left; padding: 8px;">Seed & Player Name</th>`;

    for (let r = 1; r < numRounds; r++) {
      const roundName =
        r === numRounds - 1
          ? 'Finals'
          : r === numRounds - 2
          ? 'Semi-Finals'
          : r === numRounds - 3
          ? 'Quarter-Finals'
          : `Round ${r + 1}`;
      html += `<th style="border: 1px solid #000; text-align: center; padding: 8px;">${roundName}</th>`;
    }

    html += `</tr></thead><tbody>`;

    for (let i = 0; i < totalSlots; i++) {
      const entry = padded[i];
      const label = formatPlayerLabel(entry, config);
      const bg = entry.isBye ? 'background-color: #f9fafb; color: #6b7280;' : 'background-color: #ffffff; color: #000000; font-weight: bold;';

      html += `<tr>
        <td style="border: 1px solid #000; padding: 8px; ${bg}">${label}</td>`;

      for (let r = 1; r < numRounds; r++) {
        html += `<td style="border: 1px solid #d1d5db; padding: 8px;"></td>`;
      }

      html += `</tr>`;
    }

    html += `</tbody></table></div>`;

    const blob = new Blob([html], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (err) {
    console.error('Failed to copy HTML table', err);
    return false;
  }
}
