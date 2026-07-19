// Pulled out of ComicGenerationContext.tsx so this pure name-matching logic
// can be unit-tested in isolation, without pulling in the context module's
// React/Next.js/axios/export-library dependencies.

export interface CharacterReference {
  character_id: string;
  name: string;
  image_url: string;
  prompt: string;
}

// Strips a leading "the"/"a"/"an" so a character named "The Wolf" still
// matches raw prompt text like "a massive menacing wolf..." that names the
// character without ever writing the article directly in front of it.
const stripLeadingArticle = (name: string): string =>
  name.trim().replace(/^(the|a|an)\s+/i, '').toLowerCase();

// Below this many characters, a stripped "core" name (e.g. "girl" from "A
// Girl") is too generic to safely substring-match against arbitrary prompt
// text, so it's skipped rather than risking a false-positive match.
const MIN_CORE_NAME_LENGTH = 3;

// Tries to identify the character actually named in this panel — first via
// Step 3's per-panel `characters:` field, then (when that's missing or didn't
// match anyone) by spotting a character's name directly in the panel's raw
// prompt text. Returns undefined if neither approach finds anyone, so callers
// that search across several panels (a whole page) can keep looking instead
// of prematurely committing to a default.
export const findCharacterReference = (
  characterRefs: CharacterReference[],
  characterNames?: string[],
  rawPromptText?: string
): CharacterReference | undefined => {
  if (characterNames?.length) {
    for (const wanted of characterNames) {
      const match = characterRefs.find((c) => c.name.trim().toLowerCase() === wanted.trim().toLowerCase());
      if (match) return match;
    }
  }
  // Longest core name first (article stripped) so e.g. "Little Red Riding
  // Hood" wins over a shorter name like "Red" that could otherwise match as
  // a substring first.
  if (rawPromptText) {
    const lower = rawPromptText.toLowerCase();
    const sorted = [...characterRefs].sort(
      (a, b) => stripLeadingArticle(b.name).length - stripLeadingArticle(a.name).length
    );
    const found = sorted.find((c) => {
      const core = stripLeadingArticle(c.name);
      return core.length >= MIN_CORE_NAME_LENGTH && lower.includes(core);
    });
    if (found) return found;
  }
  return undefined;
};

// Picks the reference image for the character actually named in this panel,
// instead of always defaulting to the first character the user selected —
// otherwise every panel/page ends up generated with the same character's
// likeness regardless of who's in it. Falls back to the first selected
// character only once findCharacterReference finds no one at all.
export const pickCharacterReference = (
  characterRefs: CharacterReference[],
  characterNames?: string[],
  rawPromptText?: string
): CharacterReference | undefined =>
  findCharacterReference(characterRefs, characterNames, rawPromptText) ?? characterRefs[0];
