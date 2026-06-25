import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function stripDataPrefix(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: 'image/png', base64: dataUrl };
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'comic';
}

export async function exportAsZip(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(sanitizeFilename(opts.projectId)) ?? zip;

  for (const page of pages) {
    const { base64 } = stripDataPrefix(page.imageUrl);
    const filename = `page_${String(page.pageNumber).padStart(2, '0')}.png`;
    folder.file(filename, base64, { base64: true });
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
    folder.file('manifest.json', JSON.stringify(manifest, null, 2));
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  triggerDownload(blob, `${sanitizeFilename(opts.projectId)}.zip`);
}

export async function exportAsPdf(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(opts.projectId);
  pdfDoc.setAuthor('mOhiOm AI');
  pdfDoc.setCreationDate(new Date());

  for (const page of pages) {
    const { base64, mimeType } = stripDataPrefix(page.imageUrl);
    const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const pngImage = mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? await pdfDoc.embedJpg(imgBytes)
      : await pdfDoc.embedPng(imgBytes);

    const pdfPage = pdfDoc.addPage([pngImage.width, pngImage.height]);
    pdfPage.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
  }

  const pdfBytes = await pdfDoc.save();
  triggerDownload(
    new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    `${sanitizeFilename(opts.projectId)}.pdf`
  );
}

export async function exportAsEpub(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const zip = new JSZip();
  const safe = sanitizeFilename(opts.projectId);
  const title = opts.projectId;
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // mimetype — MUST be first, MUST NOT be compressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.folder('META-INF')!.file(
    'container.xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>' +
    '</rootfiles></container>'
  );

  const epub = zip.folder('EPUB')!;
  const imgs = epub.folder('images')!;

  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navItems: string[] = [];

  for (const page of pages) {
    const n = String(page.pageNumber).padStart(2, '0');
    const imgFile = `page_${n}.png`;
    const xhtmlFile = `page_${n}.xhtml`;
    const chTitle = `Page ${page.pageNumber}`;

    const { base64 } = stripDataPrefix(page.imageUrl);
    imgs.file(imgFile, base64, { base64: true });

    epub.file(
      xhtmlFile,
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<html xmlns="http://www.w3.org/1999/xhtml">` +
      `<head><title>${chTitle}</title>` +
      `<style>body{margin:0;padding:0;background:#fff}img{width:100%;height:auto;display:block}</style></head>` +
      `<body><img src="images/${imgFile}" alt="${chTitle}"/></body></html>`
    );

    manifestItems.push(
      `<item id="img${n}" href="images/${imgFile}" media-type="image/png"/>`,
      `<item id="ch${n}" href="${xhtmlFile}" media-type="application/xhtml+xml"/>`
    );
    spineItems.push(`<itemref idref="ch${n}"/>`);
    navItems.push(`<li><a href="${xhtmlFile}">${chTitle}</a></li>`);
  }

  epub.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:identifier id="uid">${uid}</dc:identifier>` +
    `<dc:title>${title}</dc:title>` +
    `<dc:language>en</dc:language>` +
    `<dc:creator>mOhiOm AI</dc:creator>` +
    `<meta property="dcterms:modified">${now}</meta>` +
    `</metadata>` +
    `<manifest>` +
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>` +
    manifestItems.join('') +
    `</manifest>` +
    `<spine>${spineItems.join('')}</spine>` +
    `</package>`
  );

  epub.file(
    'nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">` +
    `<head><title>Table of Contents</title></head>` +
    `<body><nav epub:type="toc"><ol>${navItems.join('')}</ol></nav></body></html>`
  );

  const epubBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  triggerDownload(
    new Blob([epubBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/epub+zip' }),
    `${safe}.epub`
  );
}
