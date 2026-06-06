import test from 'node:test';
import assert from 'node:assert/strict';

import { readingCards, wordDefinitions } from '../src/reading-data.mjs';
import {
  buildRemoteTtsUrl,
  findDefinition,
  normalizeForLookup,
  normalizeVolume,
  splitIntoSpeakableWords,
} from '../src/reading-utils.mjs';

test('reading cards include translations and child-friendly phrase chunks', () => {
  assert.equal(readingCards.length, 11);

  for (const card of readingCards) {
    assert.ok(card.id);
    assert.ok(card.english.length > 0);
    assert.ok(card.chinese.length > 0);
    assert.ok(card.phrases.length > 0);
    assert.equal(card.phrases.join(' '), card.english);
  }
});

test('splitIntoSpeakableWords keeps contractions readable and removes punctuation', () => {
  assert.deepEqual(
    splitIntoSpeakableWords("I’m glad to join the competition. Thank you!"),
    ['I’m', 'glad', 'to', 'join', 'the', 'competition', 'Thank', 'you'],
  );
});

test('normalizeForLookup maps common punctuation and contractions to dictionary keys', () => {
  assert.equal(normalizeForLookup('I’ve'), "i've");
  assert.equal(normalizeForLookup('family;'), 'family');
  assert.equal(normalizeForLookup('strawberries'), 'strawberries');
});

test('word definitions cover every spoken word in the configured reading cards', () => {
  const missing = new Set();

  for (const card of readingCards) {
    for (const word of splitIntoSpeakableWords(card.english)) {
      if (!findDefinition(word, wordDefinitions)) {
        missing.add(word);
      }
    }
  }

  assert.deepEqual([...missing], []);
});

test('normalizeVolume converts a 0-10 slider value to Web Speech volume', () => {
  assert.equal(normalizeVolume(0), 0);
  assert.equal(normalizeVolume(5), 0.5);
  assert.equal(normalizeVolume(10), 1);
  assert.equal(normalizeVolume(-4), 0);
  assert.equal(normalizeVolume(24), 1);
});

test('buildRemoteTtsUrl creates an HTTPS American English audio fallback URL', () => {
  const url = buildRemoteTtsUrl('Hello everyone!');

  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'dict.youdao.com');
  assert.equal(url.searchParams.get('type'), '2');
  assert.equal(url.searchParams.get('audio'), 'Hello everyone!');
});
