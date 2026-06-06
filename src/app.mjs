import { readingCards, wordDefinitions } from './reading-data.mjs';
import {
  estimateSpeechDuration,
  findDefinition,
  normalizeVolume,
  splitIntoSpeakableWords,
} from './reading-utils.mjs';

const state = {
  currentCardId: '',
  fallbackTimer: null,
  hideBubbleTimer: null,
  lookupEnabled: false,
  phrasesEnabled: false,
  translationsEnabled: false,
  volume: 8,
  voices: [],
};

const elements = {
  list: document.querySelector('#readingList'),
  volumeSlider: document.querySelector('#volumeSlider'),
  volumeValue: document.querySelector('#volumeValue'),
  translationToggle: document.querySelector('#translationToggle'),
  lookupToggle: document.querySelector('#lookupToggle'),
  phraseToggle: document.querySelector('#phraseToggle'),
  lookupBubble: document.querySelector('#lookupBubble'),
};

renderCards();
bindToolbar();
hydrateVoices();

function renderCards() {
  const fragment = document.createDocumentFragment();

  readingCards.forEach((card, index) => {
    const article = document.createElement('article');
    article.className = 'reading-card';
    article.dataset.cardId = card.id;

    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.type = 'button';
    playButton.setAttribute('aria-label', `播放第 ${index + 1} 句英文`);
    playButton.innerHTML = '<span class="play-icon" aria-hidden="true"></span>';
    playButton.addEventListener('click', () => speakText(card.english, card.id));

    const content = document.createElement('div');
    content.className = 'card-content';

    const translation = document.createElement('p');
    translation.className = 'translation';
    translation.textContent = card.chinese;

    const sentence = document.createElement('p');
    sentence.className = 'english-sentence';
    sentence.dataset.sentence = card.english;
    renderSentenceWords(sentence, card.english, card.id);

    const phraseRow = document.createElement('div');
    phraseRow.className = 'phrase-row';
    phraseRow.setAttribute('aria-label', '拆句连读短语');
    card.phrases.forEach((phrase, phraseIndex) => {
      const phraseButton = document.createElement('button');
      phraseButton.className = `phrase-chip phrase-${(phraseIndex % 4) + 1}`;
      phraseButton.type = 'button';
      phraseButton.textContent = phrase;
      phraseButton.addEventListener('click', () => speakText(phrase, card.id, { isPhrase: true }));
      phraseRow.append(phraseButton);
    });

    content.append(translation, sentence, phraseRow);
    article.append(playButton, content);
    fragment.append(article);
  });

  elements.list.append(fragment);
  syncModes();
}

function renderSentenceWords(container, sentence, cardId) {
  const pattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
  let lastIndex = 0;
  let wordIndex = 0;
  let match = pattern.exec(sentence);

  while (match) {
    if (match.index > lastIndex) {
      container.append(document.createTextNode(sentence.slice(lastIndex, match.index)));
    }

    const word = match[0];
    const wordButton = document.createElement('button');
    wordButton.className = 'word';
    wordButton.type = 'button';
    wordButton.dataset.wordIndex = String(wordIndex);
    wordButton.textContent = word;
    wordButton.addEventListener('click', () => handleWordLookup(word, cardId));
    container.append(wordButton);

    wordIndex += 1;
    lastIndex = match.index + word.length;
    match = pattern.exec(sentence);
  }

  if (lastIndex < sentence.length) {
    container.append(document.createTextNode(sentence.slice(lastIndex)));
  }
}

function bindToolbar() {
  elements.volumeSlider.addEventListener('input', () => {
    state.volume = Number(elements.volumeSlider.value);
    elements.volumeValue.textContent = String(state.volume);
  });

  elements.translationToggle.addEventListener('change', () => {
    state.translationsEnabled = elements.translationToggle.checked;
    syncModes();
  });

  elements.lookupToggle.addEventListener('change', () => {
    state.lookupEnabled = elements.lookupToggle.checked;
    syncModes();
  });

  elements.phraseToggle.addEventListener('change', () => {
    state.phrasesEnabled = elements.phraseToggle.checked;
    syncModes();
  });
}

function syncModes() {
  document.body.classList.toggle('show-translations', state.translationsEnabled);
  document.body.classList.toggle('lookup-mode', state.lookupEnabled);
  document.body.classList.toggle('show-phrases', state.phrasesEnabled);
}

function hydrateVoices() {
  if (!('speechSynthesis' in window)) {
    document.body.classList.add('speech-unavailable');
    return;
  }

  const loadVoices = () => {
    state.voices = window.speechSynthesis.getVoices();
  };

  loadVoices();
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  } else {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function speakText(text, cardId, options = {}) {
  if (!('speechSynthesis' in window)) {
    markUnsupported(cardId);
    if (options.isWord) {
      scheduleBubbleHide();
    }
    return;
  }

  window.speechSynthesis.cancel();
  clearPlaybackTimers();
  resetCards();

  const words = splitIntoSpeakableWords(text);
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  const isFullSentence = !options.isPhrase;

  state.currentCardId = cardId;
  card?.classList.add('is-playing');
  card?.querySelector('.play-button')?.classList.add('is-active');

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = options.isWord ? 0.78 : 0.84;
  utterance.pitch = options.isWord ? 1.35 : 1.22;
  utterance.volume = normalizeVolume(state.volume);
  utterance.voice = chooseVoice();

  let usedBoundary = false;

  if (isFullSentence) {
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') {
        return;
      }

      usedBoundary = true;
      const spokenIndex = getWordIndexFromChar(text, event.charIndex);
      paintWords(cardId, spokenIndex);
    };

    state.fallbackTimer = window.setTimeout(() => {
      if (!usedBoundary) {
        runTimedHighlight(cardId, words.length, estimateSpeechDuration(words, utterance.rate));
      }
    }, 220);
  }

  utterance.onend = () => {
    if (isFullSentence) {
      paintWords(cardId, words.length - 1);
    }
    finishPlayback(cardId);
    if (options.isWord) {
      scheduleBubbleHide();
    }
  };

  utterance.onerror = () => {
    finishPlayback(cardId);
    if (options.isWord) {
      scheduleBubbleHide();
    }
  };

  window.speechSynthesis.speak(utterance);
}

function chooseVoice() {
  if (!state.voices.length) {
    state.voices = window.speechSynthesis.getVoices();
  }

  const englishVoices = state.voices.filter((voice) => /^en(-|_)?/i.test(voice.lang));
  const preferredNames = [
    'child',
    'girl',
    'female',
    'jenny',
    'aria',
    'samantha',
    'zira',
    'karen',
    'google us english',
    'microsoft',
  ];

  return (
    englishVoices.find((voice) =>
      preferredNames.some((name) => voice.name.toLocaleLowerCase('en-US').includes(name)),
    ) ??
    englishVoices.find((voice) => /^en-US/i.test(voice.lang)) ??
    englishVoices[0] ??
    null
  );
}

function getWordIndexFromChar(sentence, charIndex) {
  if (!Number.isFinite(charIndex)) {
    return 0;
  }

  const matches = [...sentence.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu)];
  const index = matches.findIndex((match, candidateIndex) => {
    const start = match.index ?? 0;
    const nextStart = matches[candidateIndex + 1]?.index ?? sentence.length + 1;
    return charIndex >= start && charIndex < nextStart;
  });

  return index === -1 ? matches.length - 1 : index;
}

function runTimedHighlight(cardId, totalWords, duration) {
  const interval = Math.max(160, duration / Math.max(totalWords, 1));
  let index = 0;

  paintWords(cardId, index);
  state.fallbackTimer = window.setInterval(() => {
    index += 1;
    paintWords(cardId, index);
    if (index >= totalWords - 1) {
      clearPlaybackTimers();
    }
  }, interval);
}

function paintWords(cardId, activeIndex) {
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  const wordButtons = card?.querySelectorAll('.english-sentence .word') ?? [];

  wordButtons.forEach((word, index) => {
    word.classList.toggle('has-read', index <= activeIndex);
  });
}

function finishPlayback(cardId) {
  clearPlaybackTimers();
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  card?.classList.remove('is-playing');
  card?.querySelector('.play-button')?.classList.remove('is-active');
}

function clearPlaybackTimers() {
  if (state.fallbackTimer) {
    window.clearTimeout(state.fallbackTimer);
    window.clearInterval(state.fallbackTimer);
    state.fallbackTimer = null;
  }
}

function resetCards() {
  document.querySelectorAll('.reading-card').forEach((card) => {
    card.classList.remove('is-playing');
    card.querySelector('.play-button')?.classList.remove('is-active');
    card.querySelectorAll('.word').forEach((word) => word.classList.remove('has-read'));
  });
}

function handleWordLookup(word, cardId) {
  if (!state.lookupEnabled) {
    return;
  }

  const meaning = findDefinition(word, wordDefinitions) || '这个单词稍后补充释义';
  showLookupBubble(word, meaning);
  speakText(word, cardId, { isPhrase: true, isWord: true });
}

function showLookupBubble(word, meaning) {
  window.clearTimeout(state.hideBubbleTimer);
  elements.lookupBubble.querySelector('.bubble-word').textContent = word;
  elements.lookupBubble.querySelector('.bubble-meaning').textContent = meaning;
  elements.lookupBubble.hidden = false;
  elements.lookupBubble.classList.remove('is-leaving');
  elements.lookupBubble.classList.remove('is-showing');
  requestAnimationFrame(() => elements.lookupBubble.classList.add('is-showing'));

  state.hideBubbleTimer = window.setTimeout(scheduleBubbleHide, 2600);
}

function scheduleBubbleHide() {
  window.clearTimeout(state.hideBubbleTimer);
  state.hideBubbleTimer = window.setTimeout(() => {
    elements.lookupBubble.classList.add('is-leaving');
    window.setTimeout(() => {
      elements.lookupBubble.hidden = true;
      elements.lookupBubble.classList.remove('is-showing', 'is-leaving');
    }, 280);
  }, 1000);
}

function markUnsupported(cardId) {
  const card = document.querySelector(`[data-card-id="${cardId}"]`);
  card?.classList.add('speech-warning');
  window.setTimeout(() => card?.classList.remove('speech-warning'), 1300);
}
