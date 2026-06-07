import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { goKartReadingCards, goKartWordDefinitions } from '../src/go-kart-data.mjs';
import {
  findDefinition,
  getPhraseAudioPath,
  getSentenceAudioPath,
  getWordAudioPath,
  splitIntoSpeakableWords,
} from '../src/reading-utils.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('go-kart course contains the OCR text as child-friendly reading cards', () => {
  assert.equal(goKartReadingCards.length, 13);
  assert.equal(
    goKartReadingCards[0].english,
    'This is Ben from the Red team and this is Misty from the Green team.',
  );
  assert.equal(
    goKartReadingCards.at(-2).english,
    'Congratulations, Misty! You’re first!',
  );
  assert.equal(goKartReadingCards.at(-1).english, 'Thank you!');
});

test('go-kart course has phrase chunks and definitions for spoken words', () => {
  const missing = new Set();

  for (const card of goKartReadingCards) {
    assert.equal(card.phrases.join(' '), card.english);
    assert.ok(card.chinese);

    for (const word of splitIntoSpeakableWords(card.english)) {
      if (!findDefinition(word, goKartWordDefinitions)) {
        missing.add(word);
      }
    }
  }

  assert.deepEqual([...missing], []);
});

test('go-kart course maps every sentence, phrase, and word to bundled MP3 assets', () => {
  const missing = [];

  for (const card of goKartReadingCards) {
    const sentencePath = getSentenceAudioPath(card.id);
    if (!existsSync(path.join(rootDir, sentencePath))) {
      missing.push(sentencePath);
    } else {
      assert.ok(statSync(path.join(rootDir, sentencePath)).size > 1000, sentencePath);
    }

    card.phrases.forEach((phrase, index) => {
      assert.ok(phrase);
      const phrasePath = getPhraseAudioPath(card.id, index);
      if (!existsSync(path.join(rootDir, phrasePath))) {
        missing.push(phrasePath);
      } else {
        assert.ok(statSync(path.join(rootDir, phrasePath)).size > 1000, phrasePath);
      }
    });

    for (const word of splitIntoSpeakableWords(card.english)) {
      const wordPath = getWordAudioPath(word);
      if (!existsSync(path.join(rootDir, wordPath))) {
        missing.push(wordPath);
      } else {
        assert.ok(statSync(path.join(rootDir, wordPath)).size > 1000, wordPath);
      }
    }
  }

  assert.deepEqual([...new Set(missing)], []);
});
