import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { readingCards, wordDefinitions } from '../src/reading-data.mjs';
import {
  getPhraseAudioPath,
  getSentenceAudioPath,
  getWordAudioPath,
  buildRemoteTtsUrl,
  buildRemoteTtsFallbackTexts,
  buildRemoteTtsPlaybackTexts,
  findDefinition,
  normalizeForLookup,
  normalizeVolume,
  splitIntoSpeakableWords,
} from '../src/reading-utils.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

test('favourite fruit content uses apple instead of strawberries', () => {
  const allReadingText = readingCards
    .flatMap((card) => [card.english, card.chinese, ...card.phrases])
    .join('\n')
    .toLocaleLowerCase('en-US');

  assert.match(allReadingText, /apple/);
  assert.doesNotMatch(allReadingText, /strawberries/);
  assert.doesNotMatch(allReadingText, /草莓/);
});

test('normalizeVolume converts a 0-10 slider value to Web Speech volume', () => {
  assert.equal(normalizeVolume(0), 0);
  assert.equal(normalizeVolume(5), 0.5);
  assert.equal(normalizeVolume(10), 1);
  assert.equal(normalizeVolume(-4), 0);
  assert.equal(normalizeVolume(24), 1);
});

test('buildRemoteTtsUrl creates an HTTPS English sentence TTS fallback URL', () => {
  const url = buildRemoteTtsUrl('Hello everyone!');

  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'fanyi.baidu.com');
  assert.equal(url.searchParams.get('lan'), 'en');
  assert.equal(url.searchParams.get('text'), 'Hello everyone!');
  assert.equal(url.searchParams.get('spd'), '3');
  assert.equal(url.searchParams.get('source'), 'web');
});

test('buildRemoteTtsFallbackTexts keeps full text first and then falls back to words', () => {
  assert.deepEqual(
    buildRemoteTtsFallbackTexts('I can sing English songs and draw nice pictures.'),
    [
      'I can sing English songs and draw nice pictures.',
      'I',
      'can',
      'sing',
      'English',
      'songs',
      'and',
      'draw',
      'nice',
      'pictures',
    ],
  );
});

test('buildRemoteTtsPlaybackTexts keeps long sentences natural before word fallback', () => {
  assert.deepEqual(
    buildRemoteTtsPlaybackTexts('I can sing English songs and draw nice pictures.'),
    [
      'I can sing English songs and draw nice pictures.',
      'I',
      'can',
      'sing',
      'English',
      'songs',
      'and',
      'draw',
      'nice',
      'pictures',
    ],
  );
});

test('every sentence and phrase maps to a local MP3 asset', () => {
  const missing = [];

  for (const card of readingCards) {
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
  }

  assert.deepEqual(missing, []);
});

test('every configured lookup word maps to a local MP3 asset', () => {
  const missing = [];

  for (const card of readingCards) {
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

test('frontend playback uses local audio assets instead of live remote TTS URLs', () => {
  const appSource = readFileSync(path.join(rootDir, 'src/app.mjs'), 'utf8');

  assert.match(appSource, /getSentenceAudioPath/);
  assert.match(appSource, /getPhraseAudioPath/);
  assert.match(appSource, /getWordAudioPath/);
  assert.doesNotMatch(appSource, /buildRemoteTtsUrl/);
  assert.doesNotMatch(appSource, /buildRemoteTtsPlaybackTexts/);
});
