export const IMAGE_API_URL_KEY = 'mohiom-image-api-url';

// Locked to the permanent, named GPU tunnel — no longer user-overridable.
const IMAGE_API_URL = process.env.NEXT_PUBLIC_GPU_API_URL || 'https://gpu.mohiom.me';

export function getImageApiUrl(): string {
  return IMAGE_API_URL;
}

// No-op: kept so existing call sites don't need to change, but the image
// API URL is now a fixed constant and can no longer be overridden.
export function setImageApiUrl(_url: string): void {}

// OmniGen2 (multi-character backend) is still on a rented vast.ai instance,
// so — unlike the locked SD1.5 tunnel above — its URL is genuinely
// user-editable and persisted the way localImageApiUrl used to work.
export const MULTI_CHARACTER_API_URL_KEY = 'mohiom-multi-character-api-url';
export const DEFAULT_MULTI_CHARACTER_API_URL = 'https://gpu-omnigen2.mohiom.me';

export function getMultiCharacterApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_MULTI_CHARACTER_API_URL;
  return window.localStorage.getItem(MULTI_CHARACTER_API_URL_KEY) || DEFAULT_MULTI_CHARACTER_API_URL;
}

export function setMultiCharacterApiUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed) {
    window.localStorage.setItem(MULTI_CHARACTER_API_URL_KEY, trimmed);
  } else {
    window.localStorage.removeItem(MULTI_CHARACTER_API_URL_KEY);
  }
}

// Whether panels with 2+ characters should route to the Omni backend above.
// Shared via localStorage (not React context) because the Settings page and
// the comic-generation pipeline don't share a component tree/provider.
export const ENABLE_MULTI_CHARACTER_MODE_KEY = 'mohiom-enable-multi-character-mode';

export function getEnableMultiCharacterMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ENABLE_MULTI_CHARACTER_MODE_KEY) === 'true';
}

export function setEnableMultiCharacterMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ENABLE_MULTI_CHARACTER_MODE_KEY, enabled ? 'true' : 'false');
}
