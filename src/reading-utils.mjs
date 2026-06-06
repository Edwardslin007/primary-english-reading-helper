const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

export function splitIntoSpeakableWords(sentence) {
  return sentence.match(WORD_PATTERN) ?? [];
}

export function normalizeForLookup(word) {
  return word
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase('en-US')
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
}

export function findDefinition(word, definitions) {
  return definitions[normalizeForLookup(word)] ?? '';
}

export function normalizeVolume(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0.8;
  }

  return Math.min(1, Math.max(0, numeric / 10));
}

export function buildRemoteTtsUrl(text) {
  const url = new URL('https://fanyi.baidu.com/gettts');
  url.searchParams.set('lan', 'en');
  url.searchParams.set('text', text);
  url.searchParams.set('spd', '3');
  url.searchParams.set('source', 'web');
  return url;
}

export function buildRemoteTtsFallbackTexts(text) {
  const words = splitIntoSpeakableWords(text);
  return [text, ...words.filter((word) => word !== text)];
}

export function buildRemoteTtsPlaybackTexts(text) {
  return buildRemoteTtsFallbackTexts(text);
}

export function estimateSpeechDuration(words, rate = 0.86) {
  const baseMs = 520;
  const perWordMs = 450 / Math.max(rate, 0.4);
  return Math.max(900, baseMs + words.length * perWordMs);
}
