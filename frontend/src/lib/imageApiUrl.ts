export const IMAGE_API_URL_KEY = 'mohiom-image-api-url';

// Locked to the permanent, named GPU tunnel — no longer user-overridable.
const IMAGE_API_URL = process.env.NEXT_PUBLIC_GPU_API_URL || 'https://gpu.mohiom.me';

export function getImageApiUrl(): string {
  return IMAGE_API_URL;
}

// No-op: kept so existing call sites don't need to change, but the image
// API URL is now a fixed constant and can no longer be overridden.
export function setImageApiUrl(_url: string): void {}
