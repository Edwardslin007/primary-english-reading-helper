import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readingCards } from '../src/reading-data.mjs';
import {
  buildRemoteTtsUrl,
  getPhraseAudioPath,
  getSentenceAudioPath,
  getWordAudioPath,
  splitIntoSpeakableWords,
} from '../src/reading-utils.mjs';

const rootDir = process.cwd();
const userAgent = 'Mozilla/5.0 Mobile Safari/604.1';

const jobs = [];

for (const card of readingCards) {
  jobs.push({
    kind: 'sentence',
    path: getSentenceAudioPath(card.id),
    text: card.english,
  });

  card.phrases.forEach((phrase, index) => {
    jobs.push({
      kind: 'phrase',
      path: getPhraseAudioPath(card.id, index),
      text: phrase,
    });
  });
}

const words = new Map();
for (const card of readingCards) {
  for (const word of splitIntoSpeakableWords(card.english)) {
    words.set(getWordAudioPath(word), word);
  }
}

for (const [audioPath, word] of words) {
  jobs.push({
    kind: 'word',
    path: audioPath,
    text: word,
  });
}

for (const job of jobs) {
  const target = path.join(rootDir, job.path);
  await mkdir(path.dirname(target), { recursive: true });

  const response = await fetch(buildRemoteTtsUrl(job.text), {
    headers: { 'user-agent': userAgent },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || !contentType.includes('audio/') || buffer.length < 1000) {
    throw new Error(
      `Failed to generate ${job.kind} audio: ${job.text} (${response.status}, ${contentType}, ${buffer.length} bytes)`,
    );
  }

  await writeFile(target, buffer);
  console.log(`${job.kind}\t${buffer.length}\t${job.path}\t${job.text}`);
}
