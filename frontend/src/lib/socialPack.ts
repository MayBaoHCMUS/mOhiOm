import JSZip from 'jszip';
import { triggerDownload } from './export';

export interface Platform {
  name: string;
  label: string;
  size: string;
  w: number;
  h: number;
  bg: string;
  mode: 'single' | 'strip';
}

export const PLATFORMS: Platform[] = [
  { name: 'instagram_square', label: 'Instagram',    size: '1080×1080', w: 1080, h: 1080, bg: '#ffffff', mode: 'single' },
  { name: 'instagram_story',  label: 'Story',        size: '1080×1920', w: 1080, h: 1920, bg: '#000000', mode: 'strip'  },
  { name: 'facebook',         label: 'Facebook',     size: '1200×630',  w: 1200, h:  630, bg: '#ffffff', mode: 'single' },
  { name: 'twitter',          label: 'Twitter / X',  size: '1200×675',  w: 1200, h:  675, bg: '#ffffff', mode: 'single' },
];

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function stripDataPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

async function resizeForPlatform(src: string, w: number, h: number, bg: string): Promise<string> {
  const img = await loadImg(src);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas.toDataURL('image/jpeg', 0.92);
}

async function buildVerticalStrip(pages: string[]): Promise<string> {
  const imgs = await Promise.all(pages.map(loadImg));
  const stripW = 1080;
  const heights = imgs.map(img => Math.round(img.naturalHeight * (stripW / img.naturalWidth)));
  const stripH = heights.reduce((a, b) => a + b, 0);

  const canvas = document.createElement('canvas');
  canvas.width = stripW;
  canvas.height = stripH;
  const ctx = canvas.getContext('2d')!;

  let y = 0;
  for (let i = 0; i < imgs.length; i++) {
    ctx.drawImage(imgs[i], 0, y, stripW, heights[i]);
    y += heights[i];
  }

  return canvas.toDataURL('image/png');
}

export async function downloadSocialPack(
  pages: string[],
  sourcePageIndices: number[],
  selectedPlatformNames: string[],
  projectId: string,
): Promise<void> {
  const activePlatforms = PLATFORMS.filter(p => selectedPlatformNames.includes(p.name));
  if (!activePlatforms.length || !sourcePageIndices.length) return;

  const zip = new JSZip();
  const folder = zip.folder('social_pack') ?? zip;

  // Story: always the full vertical strip, one file
  const stripPlatforms = activePlatforms.filter(p => p.mode === 'strip');
  if (stripPlatforms.length) {
    const stripSrc = await buildVerticalStrip(pages);
    for (const platform of stripPlatforms) {
      const dataUrl = await resizeForPlatform(stripSrc, platform.w, platform.h, platform.bg);
      folder.file(`${platform.name}.jpg`, stripDataPrefix(dataUrl), { base64: true });
    }
  }

  // Single-image platforms: one file per selected page
  const singlePlatforms = activePlatforms.filter(p => p.mode === 'single');
  if (singlePlatforms.length) {
    const selectedPages = sourcePageIndices
      .filter(i => i >= 0 && i < pages.length)
      .sort((a, b) => a - b);

    for (const idx of selectedPages) {
      const pad = String(idx + 1).padStart(2, '0');
      for (const platform of singlePlatforms) {
        const dataUrl = await resizeForPlatform(pages[idx], platform.w, platform.h, platform.bg);
        const filename = selectedPages.length === 1
          ? `${platform.name}.jpg`
          : `${platform.name}_page${pad}.jpg`;
        folder.file(filename, stripDataPrefix(dataUrl), { base64: true });
      }
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const stem = projectId.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_');
  triggerDownload(blob, `${stem}_social_pack.zip`);
}
