// Canonical vocabulary for the /character attribute-pill builder. `STYLES` is the
// shared source of truth — CreateCharacterModal.tsx imports it from here rather
// than keeping its own copy.

export type AttributeKey = 'gender' | 'style' | 'age' | 'body' | 'hair' | 'eyes' | 'face' | 'skin';
export type AttributeMode = 'single' | 'multi';

export interface AttributeCategory {
  key: AttributeKey;
  label: string;
  icon: string; // material-symbols-outlined name
  mode: AttributeMode;
  options: string[];
}

export const STYLES = [
  'Photorealistic', 'Digital Art', 'Anime', '3D Render', 'Pixar',
  'Fantasy Art', 'RPG', 'Comic Book', 'Clay', 'Vector Art',
  'Minimalist', 'Watercolor', 'Oil Painting', 'GTA Style',
];

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const AGE_OPTIONS = ['Child', 'Teenager', 'Mature', 'Middle-aged', 'Elderly'];

const BODY_OPTIONS = [
  'Athletic', 'Muscular', 'Curvy', 'Slim', 'Petite', 'Stocky',
  'Tall', 'Short', 'Scrawny', 'Chubby',
];

const HAIR_OPTIONS = [
  'Black Hair', 'Brown Hair', 'Blonde Hair', 'Red Hair', 'Blue Hair',
  'Green Hair', 'Purple Hair', 'Pink Hair', 'Gray Hair', 'White Hair',
  'Maroon Hair', 'Off-white Hair', 'Silver Hair', 'Straight Hair', 'Braids',
  'Ponytail', 'Twintails', 'Bun', 'Long Hair', 'Short Hair',
  'Wavy Hair', 'Curly Hair', 'Frizzy Hair', 'Pigtails', 'Bald',
  'Side-parted Hair', 'Undercut', 'Mohawk', 'Dreadlocks', 'Spiky Hair',
  'Bob Cut', 'Mullet', 'Mushroom Cut',
];

const EYE_OPTIONS = ['Brown Eyes', 'Blue Eyes', 'Green Eyes', 'Red Eyes', 'Purple Eyes', 'Pink Eyes', 'Gray Eyes'];

const FACE_OPTIONS = ['Freckles', 'Dimple', 'Beard', 'Mustache', 'Scar', 'Tattoo'];

const SKIN_OPTIONS = ['Fair Skin', 'Tan Skin', 'Olive Skin', 'Dark Skin', 'Pale Skin'];

// Row order matches the screenshot's pill sequence.
export const ATTRIBUTE_CATEGORIES: AttributeCategory[] = [
  { key: 'gender', label: 'Gender', icon: 'wc', mode: 'single', options: GENDER_OPTIONS },
  { key: 'style', label: 'Style', icon: 'palette', mode: 'single', options: STYLES },
  { key: 'age', label: 'Age', icon: 'cake', mode: 'single', options: AGE_OPTIONS },
  { key: 'body', label: 'Body', icon: 'accessibility_new', mode: 'single', options: BODY_OPTIONS },
  { key: 'hair', label: 'Hair', icon: 'content_cut', mode: 'multi', options: HAIR_OPTIONS },
  { key: 'eyes', label: 'Eyes', icon: 'visibility', mode: 'single', options: EYE_OPTIONS },
  { key: 'face', label: 'Face', icon: 'face', mode: 'multi', options: FACE_OPTIONS },
  { key: 'skin', label: 'Skin', icon: 'tonality', mode: 'single', options: SKIN_OPTIONS },
];

export type AttributeState = Record<AttributeKey, string | string[]>;

export function createEmptyAttributeState(): AttributeState {
  const state = {} as AttributeState;
  for (const category of ATTRIBUTE_CATEGORIES) {
    state[category.key] = category.mode === 'multi' ? [] : '';
  }
  return state;
}

export function isAttributeEmpty(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length === 0 : value === '';
}

export function hasAnyAttribute(state: AttributeState): boolean {
  return ATTRIBUTE_CATEGORIES.some((c) => !isAttributeEmpty(state[c.key]));
}
