// Single source of truth for comic image styles — shared between the Story
// Setup "Image Style" picker (which drives LoRA/trigger words on the image
// server) and the Settings "Default Comic Style" preference, so the two
// never drift out of sync with each other.

export const IMAGE_STYLES = [
  {
    value: 'manga',
    label: 'Manga',
    sub: 'B&W lineart · screentone shading',
    icon: '/images/style-refer/bw.png',
  },
  {
    value: 'webtoon',
    label: 'Webtoon',
    sub: 'Korean manhwa · flat vivid colors',
    icon: '/images/style-refer/webtoon.png',
  },
  {
    value: 'chibi',
    label: 'Chibi',
    sub: 'Super-deformed · pastel kawaii',
    icon: '/images/style-refer/chibi.png',
  },
  {
    value: 'watercolor',
    label: 'Watercolor',
    sub: 'Soft brushstrokes · painterly',
    icon: '/images/style-refer/watercolor.png',
  },
] as const;

export type ImageStyleValue = (typeof IMAGE_STYLES)[number]['value'];

export const DEFAULT_IMAGE_STYLE: ImageStyleValue = 'manga';

export const IMAGE_STYLE_PREF_KEY = 'mohiom-pref-comic-style';
