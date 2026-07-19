// Manual test for pickCharacterReference / findCharacterReference
// (frontend/src/lib/characterReference.ts).
//
// No test runner is configured for the frontend (see CLAUDE.md), so this
// mirrors the backend's manual test-script convention. Run with:
//   npx tsx test_character_reference.ts
//
// Regression covered: a panel whose Step 3 markdown has no `Characters:`
// line (characterNames empty/undefined) used to always fall back to
// characterRefs[0] — silently picking "Little Red Riding Hood" as the
// reference for a panel whose scene actually describes "The Wolf".

import assert from 'node:assert';
import {
  pickCharacterReference,
  type CharacterReference,
} from './src/lib/characterReference';

const redRidingHood: CharacterReference = {
  character_id: 'char_1',
  name: 'Little Red Riding Hood',
  image_url: 'https://pub-example.r2.dev/char_1.png',
  prompt: 'girl in red hooded cloak, braided hair',
};

const theWolf: CharacterReference = {
  character_id: 'char_2',
  name: 'The Wolf',
  image_url: 'https://pub-example.r2.dev/char_2.png',
  prompt: 'anthropomorphic wolf, sharp teeth, grey fur',
};

const characterRefs = [redRidingHood, theWolf];

// Test 1 — the reported bug: no `characters:` field, but the panel's raw
// prompt clearly names "The Wolf". Must NOT fall back to characterRefs[0].
{
  const aiImagePrompt =
    'Detailed manga character design sheet of The Wolf, medium-wide, lurking in shadow with glowing eyes, dark forest atmosphere';
  const result = pickCharacterReference(characterRefs, undefined, aiImagePrompt);
  assert.strictEqual(result?.character_id, theWolf.character_id, 'Test 1 failed: expected "The Wolf", raw-prompt fallback did not fire');
  console.log('PASS: missing characterNames + prompt names "The Wolf" -> resolves to The Wolf');
}

// Test 2 — explicit characterNames match must still win over raw-prompt
// text, even when the raw prompt also happens to mention another character.
{
  const aiImagePrompt = 'manga style, medium shot, The Wolf lurking behind a tree, watching';
  const result = pickCharacterReference(characterRefs, ['Little Red Riding Hood'], aiImagePrompt);
  assert.strictEqual(
    result?.character_id,
    redRidingHood.character_id,
    'Test 2 failed: explicit characterNames match must take priority over raw-prompt fallback'
  );
  console.log('PASS: explicit characterNames match still wins over raw-prompt fallback');
}

// Test 3 — no characterNames and no name found in the raw prompt at all:
// this is the only case that should fall back to characterRefs[0].
{
  const aiImagePrompt = 'manga style, establishing shot, empty cobblestone village square at dawn';
  const result = pickCharacterReference(characterRefs, undefined, aiImagePrompt);
  assert.strictEqual(
    result?.character_id,
    redRidingHood.character_id,
    'Test 3 failed: expected default characterRefs[0] fallback when nobody is named anywhere'
  );
  console.log('PASS: no name anywhere -> falls back to characterRefs[0] as before');
}

// Test 4 — longest-name-first matching: a shorter name that is a substring
// of a longer one must not steal the match.
{
  const red: CharacterReference = {
    character_id: 'char_3',
    name: 'Red',
    image_url: 'https://pub-example.r2.dev/char_3.png',
    prompt: 'a minor background character literally named Red',
  };
  const refsWithRed = [red, redRidingHood, theWolf];
  const aiImagePrompt = 'manga style, wide shot, Little Red Riding Hood walking through the woods alone';
  const result = pickCharacterReference(refsWithRed, undefined, aiImagePrompt);
  assert.strictEqual(
    result?.character_id,
    redRidingHood.character_id,
    'Test 4 failed: expected the longer, more specific name "Little Red Riding Hood" to win over the substring "Red"'
  );
  console.log('PASS: longest-name-first ordering picks "Little Red Riding Hood" over substring "Red"');
}

// Test 5 — regression: raw prompt names the character without the leading
// article ("wolf" instead of "the wolf"), which is how the LLM naturally
// writes it most of the time. Must still resolve to "The Wolf", not fall
// back to characterRefs[0].
{
  const aiImagePrompt =
    'A massive menacing wolf with slate-gray fur, low angle, emerging from tree';
  const result = pickCharacterReference(characterRefs, undefined, aiImagePrompt);
  assert.strictEqual(
    result?.character_id,
    theWolf.character_id,
    'Test 5 failed: expected "The Wolf" even though the raw prompt never writes the leading article "the"'
  );
  console.log('PASS: prompt names "wolf" without leading article "the" -> still resolves to The Wolf');
}

console.log('\nAll pickCharacterReference tests passed.');
