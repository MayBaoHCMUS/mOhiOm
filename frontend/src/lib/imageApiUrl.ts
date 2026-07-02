export const IMAGE_API_URL_KEY = 'mohiom-image-api-url';

export function getImageApiUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(IMAGE_API_URL_KEY) ?? '';
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
