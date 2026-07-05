export const IMAGE_API_URL_KEY = 'mohiom-image-api-url';

const DEFAULT_IMAGE_API_URL =
  process.env.NEXT_PUBLIC_GPU_API_URL || 'https://gpu.mohiom.me';

export function getImageApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_IMAGE_API_URL;
  return window.localStorage.getItem(IMAGE_API_URL_KEY) ?? DEFAULT_IMAGE_API_URL;
}

export function setImageApiUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed) {
    window.localStorage.setItem(IMAGE_API_URL_KEY, trimmed);
  } else {
    window.localStorage.removeItem(IMAGE_API_URL_KEY);
  }
}
