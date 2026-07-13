import { ATTRIBUTE_CATEGORIES, type AttributeKey, type AttributeState } from '@/components/character/characterOptions';

// A few categories read better in a flowing prompt with a small suffix; everything
// else is used verbatim so it also looks clean as a standalone UI trait chip later
// (CharacterPreviewModal renders each comma-separated prompt segment as one chip).
function formatAttributeValue(key: AttributeKey, value: string): string {
  if (key === 'body') return `${value} build`;
  if (key === 'style') return `${value} style`;
  return value;
}

/** Ordered, comma-joinable trait fragments from the selected attribute pills. Multi-select
 * categories contribute one fragment per selected chip (not a merged blob), so each stays
 * its own trait tag downstream instead of collapsing into one long segment. */
export function buildAttributePrompt(state: AttributeState): string[] {
  const parts: string[] = [];
  for (const category of ATTRIBUTE_CATEGORIES) {
    const value = state[category.key];
    if (Array.isArray(value)) {
      for (const v of value) parts.push(formatAttributeValue(category.key, v));
    } else if (value) {
      parts.push(formatAttributeValue(category.key, value));
    }
  }
  return parts;
}
