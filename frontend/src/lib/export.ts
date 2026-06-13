import JSZip from 'jszip';
import jsPDF from 'jspdf';

export interface ExportPanel {
  panelNumber: number;
  contextLabel: string;
  shotType?: string;
  dialogueSfx: string;
  aiImagePrompt: string;
}

export interface ExportPage {
  pageNumber: number;
  imageUrl: string;
  panels: ExportPanel[];
}

interface ExportOpts {
  includeMetadata: boolean;
  projectId: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stripDataPrefix(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: 'image/png', base64: dataUrl };
}

export async function exportAsZip(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const zip = new JSZip();

  for (const page of pages) {
    const { base64 } = stripDataPrefix(page.imageUrl);
    zip.file(`page-${page.pageNumber}.png`, base64, { base64: true });
  }

  if (opts.includeMetadata) {
    const manifest = {
      project_id: opts.projectId,
      exported_at: new Date().toISOString(),
      page_count: pages.length,
      pages: pages.map((p) => ({
        page_number: p.pageNumber,
        panels: p.panels.map((pan) => ({
          panel_number: pan.panelNumber,
          label: pan.contextLabel,
          shot_type: pan.shotType ?? '',
          dialogue_sfx: pan.dialogueSfx,
          ai_image_prompt: pan.aiImagePrompt,
        })),
      })),
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `comic-${opts.projectId}.zip`);
}

export async function exportAsPdf(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;

  pages.forEach((page, i) => {
    if (i > 0) doc.addPage();
    const { mimeType, base64 } = stripDataPrefix(page.imageUrl);
    const fmt = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'JPEG' : 'PNG';
    doc.addImage(`data:${mimeType};base64,${base64}`, fmt, 0, 0, W, H);
  });

  if (opts.includeMetadata) {
    const hasText = pages.some((p) =>
      p.panels.some((pan) => pan.dialogueSfx.trim() || pan.aiImagePrompt.trim())
    );
    if (hasText) {
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Panel Script', 14, 20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      let y = 32;
      const maxY = H - 14;
      const lineH = 5;

      const addText = (text: string, x: number, width: number) => {
        const lines = doc.splitTextToSize(text, width) as string[];
        for (const line of lines) {
          if (y + lineH > maxY) { doc.addPage(); y = 20; }
          doc.text(line, x, y);
          y += lineH;
        }
      };

      for (const page of pages) {
        if (y + lineH > maxY) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Page ${page.pageNumber}`, 14, y);
        y += lineH + 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        for (const pan of page.panels) {
          if (y + lineH * 3 > maxY) { doc.addPage(); y = 20; }
          const shotPart = pan.shotType ? ` [${pan.shotType}]` : '';
          const labelPart = pan.contextLabel ? ` · ${pan.contextLabel}` : '';
          doc.setFont('helvetica', 'bold');
          doc.text(`Panel ${pan.panelNumber}${shotPart}${labelPart}`, 18, y);
          y += lineH;
          doc.setFont('helvetica', 'normal');

          if (pan.dialogueSfx.trim()) {
            addText(`Dialogue: ${pan.dialogueSfx}`, 22, W - 36);
          }
          if (pan.aiImagePrompt.trim()) {
            addText(`Prompt: ${pan.aiImagePrompt}`, 22, W - 36);
          }
          y += 2;
        }
        y += 3;
      }
    }
  }

  doc.save(`comic-${opts.projectId}.pdf`);
}
