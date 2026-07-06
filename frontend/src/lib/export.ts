import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import type { ComicMetadata } from './metadata';
import { buildFilename } from './metadata';

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
  meta?: ComicMetadata;
  printReady?: boolean;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Pages are now R2 URLs rather than embedded base64, so fetch and encode
// on demand when the source isn't already a data: URL.
async function stripDataPrefix(src: string): Promise<{ base64: string; mimeType: string }> {
  const match = src.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], base64: match[2] };
  if (src.startsWith('http') || src.startsWith('blob:')) {
    const res = await fetch(src);
    const mimeType = res.headers.get('content-type') || 'image/png';
    return { mimeType, base64: arrayBufferToBase64(await res.arrayBuffer()) };
  }
  return { mimeType: 'image/png', base64: src };
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'comic';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stemFor(opts: ExportOpts): string {
  return opts.meta ? buildFilename(opts.meta) : sanitizeFilename(opts.projectId);
}

export async function exportAsZip(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const stem = stemFor(opts);
  const zip = new JSZip();
  const folder = zip.folder(stem) ?? zip;

  for (const page of pages) {
    const { base64 } = await stripDataPrefix(page.imageUrl);
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
  triggerDownload(blob, `${stem}.zip`);
}

export async function exportAsCbz(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const stem = stemFor(opts)
  const zip  = new JSZip()
  for (const page of pages) {
    const { base64 } = await stripDataPrefix(page.imageUrl)
    zip.file(`page_${String(page.pageNumber).padStart(3, '0')}.png`, base64, { base64: true })
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  triggerDownload(blob, `${stem}.cbz`)
}

// 3mm bleed at 300 DPI
const BLEED_PX  = 35;
// crop mark length (fits within bleed, from trim corner outward)
const MARK_LEN  = 25;
// 0.5pt at 300 DPI ≈ 2px
const MARK_W    = 2;

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')
      ? src : `data:image/png;base64,${src}`;
  });
}

async function addBleedAndCropMarks(imageUrl: string): Promise<string> {
  const img = await loadImageEl(imageUrl);
  const pw = img.naturalWidth;
  const ph = img.naturalHeight;
  const cw = pw + 2 * BLEED_PX;
  const ch = ph + 2 * BLEED_PX;

  const canvas = document.createElement('canvas');
  canvas.width  = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  // Fill bleed with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);

  // Draw page image at bleed offset
  ctx.drawImage(img, BLEED_PX, BLEED_PX, pw, ph);

  // Crop marks at trim corners
  ctx.strokeStyle = '#000000';
  ctx.lineWidth   = MARK_W;
  ctx.lineCap     = 'square';

  const corners = [
    { cx: BLEED_PX,      cy: BLEED_PX,      dx: -1, dy: -1 },
    { cx: BLEED_PX + pw, cy: BLEED_PX,      dx:  1, dy: -1 },
    { cx: BLEED_PX,      cy: BLEED_PX + ph, dx: -1, dy:  1 },
    { cx: BLEED_PX + pw, cy: BLEED_PX + ph, dx:  1, dy:  1 },
  ] as const;

  for (const { cx, cy, dx, dy } of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * MARK_LEN, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + dy * MARK_LEN);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

export async function exportAsPdf(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const stem = stemFor(opts);
  const meta = opts.meta;
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle(meta?.title || opts.projectId);
  pdfDoc.setAuthor(meta?.author || '');
  pdfDoc.setSubject(meta?.description || '');
  pdfDoc.setKeywords([meta?.series, meta?.volume].filter(Boolean) as string[]);
  pdfDoc.setCreator('mOhiOm');
  pdfDoc.setProducer('mOhiOm');
  pdfDoc.setCreationDate(new Date());

  for (const page of pages) {
    let imageUrl = page.imageUrl;
    if (opts.printReady) {
      imageUrl = await addBleedAndCropMarks(imageUrl);
    }

    const { base64, mimeType } = await stripDataPrefix(imageUrl);
    const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const pngImage = mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? await pdfDoc.embedJpg(imgBytes)
      : await pdfDoc.embedPng(imgBytes);

    // Print-ready: size page in points so image renders at 300 DPI
    const ptW = opts.printReady ? pngImage.width  / 300 * 72 : pngImage.width;
    const ptH = opts.printReady ? pngImage.height / 300 * 72 : pngImage.height;

    const pdfPage = pdfDoc.addPage([ptW, ptH]);
    pdfPage.drawImage(pngImage, { x: 0, y: 0, width: ptW, height: ptH });
  }

  const pdfBytes = await pdfDoc.save();
  const filename  = opts.printReady ? `${stem}_print_300dpi.pdf` : `${stem}.pdf`;
  triggerDownload(
    new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    filename
  );
}

export async function exportAsEpub(pages: ExportPage[], opts: ExportOpts): Promise<void> {
  const stem = stemFor(opts);
  const meta = opts.meta;
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const zip = new JSZip();

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

    const { base64 } = await stripDataPrefix(page.imageUrl);
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

  const metaXml = [
    `<dc:identifier id="uid">${uid}</dc:identifier>`,
    `<dc:title>${escapeXml(meta?.title || opts.projectId)}</dc:title>`,
    `<dc:language>${escapeXml(meta?.language || 'vi')}</dc:language>`,
    meta?.author      ? `<dc:creator>${escapeXml(meta.author)}</dc:creator>`           : '',
    meta?.description ? `<dc:description>${escapeXml(meta.description)}</dc:description>` : '',
    meta?.publisher   ? `<dc:publisher>${escapeXml(meta.publisher)}</dc:publisher>`     : '',
    meta?.series      ? `<dc:relation>${escapeXml(meta.series)}</dc:relation>`          : '',
    `<dc:date>${meta?.year || new Date().getFullYear()}</dc:date>`,
    `<meta property="dcterms:modified">${now}</meta>`,
  ].filter(Boolean).join('');

  epub.file(
    'content.opf',
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    metaXml +
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
    `${stem}.epub`
  );
}
