const input = document.getElementById("typing-input");
const textElement = document.getElementById("text");
const wpmElement = document.getElementById("wpm");
const accuracyElement = document.getElementById("accuracy");
const timerElement = document.getElementById("timer");
const restartButton = document.getElementById("restart");
const durationButtons = document.querySelectorAll(".duration");
const inputLabel = document.querySelector(".input-label");
const hint = document.querySelector(".hint");

const resultCard = document.getElementById("result");
const resultWpm = document.getElementById("result-wpm");
const resultAccuracy = document.getElementById("result-accuracy");
const resultCorrect = document.getElementById("result-correct");
const resultDuration = document.getElementById("result-duration");
const resultMessage = document.getElementById("result-message");
const resultBadge = document.querySelector(".result-badge");
const tryAgainButton = document.getElementById("try-again");

const modeSwitch = document.getElementById("mode-switch");
const modeButtons = document.querySelectorAll(".mode-button");
const difficultyPanel = document.getElementById("difficulty-panel");
const difficultyButtons = document.querySelectorAll(".difficulty-button");
const difficultyDescription = document.getElementById(
  "difficulty-description"
);
const languageButtons = document.querySelectorAll(".language-button");

const recordCard = document.querySelector(".record-card");
const recordMode = document.getElementById("record-mode");
const recordValue = document.getElementById("record-value");
const recordDetails = document.getElementById("record-details");
const recordNotice = document.getElementById("record-notice");

const recordModal = document.getElementById("record-modal");
const recordModalClose = document.getElementById("record-modal-close");
const recordModalContinue = document.getElementById(
  "record-modal-continue"
);

const wordLibraries = {
  ru: [
    "время", "мир", "свет", "человек", "город", "дорога",
    "новый", "день", "мысль", "жизнь", "вода", "ветер",
    "солнце", "утро", "вечер", "небо", "звезда", "мечта",
    "путь", "ритм", "поток", "движение", "тишина", "голос",
    "слово", "история", "музыка", "книга", "окно", "дом",
    "тепло", "радость", "сила", "знание", "вопрос", "ответ",
    "начало", "будущее", "пространство", "возможность",
    "внимание", "практика", "скорость", "точность", "успех",
    "каждый", "сегодня", "завтра", "вместе", "вперёд",
    "берег", "письмо", "лампа", "зима", "весна", "карта",
    "море", "тетрадь", "погода", "проект", "минута",
    "разговор", "интерес", "опыт", "план"
  ],

  en: [
    "time", "world", "light", "person", "city", "road",
    "new", "day", "thought", "life", "water", "wind",
    "sun", "morning", "evening", "sky", "star", "dream",
    "path", "rhythm", "flow", "motion", "silence", "voice",
    "word", "story", "music", "book", "window", "home",
    "warm", "happy", "strong", "learn", "question", "answer",
    "begin", "future", "space", "chance", "focus", "practice",
    "speed", "careful", "success", "every", "today", "tomorrow",
    "together", "forward", "garden", "forest", "river", "walk",
    "small", "quiet", "coffee", "friend", "work", "travel",
    "bridge", "market", "photo", "winter", "summer", "spring",
    "pencil", "island", "traffic", "weekend"
  ]
};

const difficultyNames = {
  easy: "Простой",
  medium: "Средний",
  hard: "Сложный"
};

const difficultyDescriptions = {
  easy: "Заглавные буквы, точки и запятые.",
  medium: "Диалоги, вопросы, числа и кавычки.",
  hard: "Длинные предложения, даты, скобки и больше пунктуации."
};

let selectedMode = "words";
let selectedDifficulty = "easy";
let selectedLanguage = "ru";
let duration = 30;

let target = "";
let acceptedValue = "";
let startedAt = null;
let intervalId = null;
let finished = false;

let totalAttempts = 0;
let correctAttempts = 0;
let errorCount = 0;
let completedCorrect = 0;
let completedPassages = 0;

let resultErrors = document.getElementById("result-errors");

if (!resultErrors) {
  const errorItem = document.createElement("div");
  errorItem.className = "result-item";
  errorItem.innerHTML = `
    <span class="result-label">Допущено ошибок</span>
    <div class="result-number">
      <span id="result-errors">0</span>
    </div>
  `;
  document.querySelector(".result-grid").append(errorItem);
  resultErrors = document.getElementById("result-errors");
}

// Рекорды: сохраняем прежнее хранилище.
const RECORD_STORAGE_KEY = "typeflow.records.v1";
let records = {};
let recordStorageAvailable = true;

try {
  const saved = localStorage.getItem(RECORD_STORAGE_KEY);

  if (saved !== null) {
    const parsed = JSON.parse(saved);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("Некорректный формат рекордов");
    }

    records = parsed;
  }
} catch {
  recordStorageAvailable = false;
}

// --- Случайная выдача заданий -------------------------------------------
// Простой random() даёт повторы: один и тот же текст может выпасть дважды
// подряд, а короткие пулы успевают «залипнуть». Поэтому используем «мешок»:
// коллекция перемешивается, элементы выдаются по одному и не повторяются,
// пока не закончится весь набор. Дальше мешок перемешивается заново.

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function createShuffleBag(getItems) {
  let queue = [];
  let lastItem = null;

  function refill() {
    queue = shuffleInPlace(getItems().slice());

    // Новый круг не должен начинаться с того же элемента,
    // на котором закончился предыдущий.
    if (queue.length > 1 && queue[queue.length - 1] === lastItem) {
      const index = Math.floor(Math.random() * (queue.length - 1));
      [queue[queue.length - 1], queue[index]] =
        [queue[index], queue[queue.length - 1]];
    }
  }

  return {
    next() {
      if (queue.length === 0) refill();

      const item = queue.pop();
      lastItem = item;

      return item;
    }
  };
}

const wordBags = new Map();
const passageBags = new Map();

function getWordBag(language) {
  if (!wordBags.has(language)) {
    wordBags.set(
      language,
      createShuffleBag(() => wordLibraries[language] || [])
    );
  }

  return wordBags.get(language);
}

function getPassageBag(language, difficulty) {
  const key = `${language}:${difficulty}`;

  if (!passageBags.has(key)) {
    passageBags.set(
      key,
      createShuffleBag(() => {
        const library = language === "ru"
          ? textLibrary
          : englishTextLibrary;

        return library[difficulty] || [];
      })
    );
  }

  return passageBags.get(key);
}

// Количество слов в задании зависит от длительности теста.
function getWordCount() {
  return Math.min(60, Math.max(20, Math.round(duration)));
}

function generateWords() {
  const vocabulary = wordLibraries[selectedLanguage] || [];
  const bag = getWordBag(selectedLanguage);
  const count = getWordCount();
  const wantsUnique = new Set(vocabulary).size >= count;

  const words = [];
  const used = new Set();
  const maxDraws = count * 4 + vocabulary.length;
  let draws = 0;

  while (words.length < count && draws < maxDraws) {
    draws += 1;

    const word = bag.next();

    if (!word) break;

    // Одно и то же слово не должно стоять рядом...
    if (word === words[words.length - 1]) continue;

    // ...и, если пула хватает, не должно повторяться внутри попытки.
    if (wantsUnique && used.has(word)) continue;

    words.push(word);
    used.add(word);
  }

  // Страховка на случай слишком маленького словаря.
  while (words.length < count && vocabulary.length > 0) {
    words.push(vocabulary[words.length % vocabulary.length]);
  }

  return words.join(" ");
}

function generateText() {
  if (selectedMode === "words") return generateWords();

  const bag = getPassageBag(selectedLanguage, selectedDifficulty);
  const passage = bag.next();

  // Страховка на случай пустой библиотеки.
  return passage || "";
}

function getModeLabel() {
  const language = selectedLanguage.toUpperCase();

  return selectedMode === "text"
    ? `${language} · Текст · ${difficultyNames[selectedDifficulty]}`
    : `${language} · Слова`;
}

function elapsedSeconds() {
  if (startedAt === null) return 0;
  if (finished) return duration;

  return Math.min(
    (performance.now() - startedAt) / 1000,
    duration
  );
}

function countCurrentCorrect() {
  let correct = 0;

  for (let i = 0; i < input.value.length; i++) {
    if (input.value[i] === target[i]) correct++;
  }

  return correct;
}

function calculateStats() {
  const correct = completedCorrect + countCurrentCorrect();
  const seconds = elapsedSeconds();

  return {
    correct,
    errors: errorCount,
    attempts: totalAttempts,
    wpm: seconds > 0
      ? Math.round((correct / 5) / (seconds / 60))
      : 0,
    accuracy: totalAttempts > 0
      ? Math.round((correctAttempts / totalAttempts) * 100)
      : 100
  };
}

function updateStats() {
  const stats = calculateStats();

  wpmElement.textContent = stats.wpm;
  accuracyElement.textContent = stats.accuracy;
  timerElement.textContent = Math.max(
    0,
    Math.ceil(duration - elapsedSeconds())
  );
}

function renderText() {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < target.length; i++) {
    const span = document.createElement("span");
    span.textContent = target[i];

    if (i < input.value.length) {
      span.className = input.value[i] === target[i]
        ? "letter-correct"
        : "letter-wrong";
    } else if (i === input.value.length && !finished) {
      span.className = "letter-current";
    }

    fragment.append(span);
  }

  textElement.replaceChildren(fragment);
}

function updateHint() {
  hint.textContent =
    `Ошибок: ${errorCount} · Введено: ${totalAttempts}` +
    ` · Пройдено отрывков: ${completedPassages}`;
}

function loadPassage() {
  target = generateText();
  acceptedValue = "";
  input.value = "";
  input.maxLength = target.length;
  renderText();
}

function advancePassage() {
  completedCorrect += countCurrentCorrect();
  completedPassages++;

  loadPassage();
  updateStats();
  updateHint();

  inputLabel.textContent =
    "Новый отрывок. Таймер и статистика продолжаются.";
}

function showResult() {
  const stats = calculateStats();

  resultWpm.textContent = stats.wpm;
  resultAccuracy.textContent = stats.accuracy;
  resultCorrect.textContent = stats.correct;
  resultDuration.textContent = duration;
  resultErrors.textContent = stats.errors;
  resultBadge.textContent = getModeLabel();

  if (stats.attempts === 0) {
    resultMessage.textContent = "В этой попытке не было ввода.";
  } else if (stats.accuracy >= 95) {
    resultMessage.textContent =
      "Очень аккуратная работа! Попробуй сохранить точность и немного ускориться.";
  } else if (stats.accuracy >= 80) {
    resultMessage.textContent =
      "Хорошая практика. В следующей попытке удели чуть больше внимания точности.";
  } else {
    resultMessage.textContent =
      "Попробуй снизить темп и сверяться с подсвеченным символом. Исправленные ошибки тоже учитываются.";
  }

  resultCard.hidden = false;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  resultCard.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "nearest"
  });
}

function finishTest() {
  if (finished || startedAt === null) return;

  finished = true;
  clearInterval(intervalId);
  intervalId = null;
  input.disabled = true;

  updateStats();
  renderText();
  updateHint();

  inputLabel.textContent = "Тест завершён. Результат — ниже.";
  restartButton.classList.add("result-ready");

  showResult();
  saveAttemptRecord();
}

function tick() {
  if (finished || startedAt === null) return;

  if (elapsedSeconds() >= duration) {
    finishTest();
    return;
  }

  updateStats();
}

function startTest() {
  startedAt = performance.now();
  inputLabel.textContent =
    "Печатай по порядку. В конце появится следующий отрывок.";
  intervalId = setInterval(tick, 100);
}

function updateControls() {
  modeSwitch.classList.toggle("is-text", selectedMode === "text");

  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === selectedMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  difficultyPanel.hidden = selectedMode !== "text";

  difficultyButtons.forEach((button) => {
    const selected =
      button.dataset.difficulty === selectedDifficulty;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  difficultyDescription.textContent =
    difficultyDescriptions[selectedDifficulty];

  durationButtons.forEach((button) => {
    const selected = Number(button.dataset.time) === duration;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  languageButtons.forEach((button) => {
    const selected = button.dataset.language === selectedLanguage;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  input.lang = selectedLanguage;
  textElement.lang = selectedLanguage;

  input.placeholder = selectedLanguage === "ru"
    ? "Твой поток начинается здесь…"
    : "Start typing here...";
}

function resetTest(focusInput = false) {
  clearInterval(intervalId);

  intervalId = null;
  startedAt = null;
  finished = false;
  totalAttempts = 0;
  correctAttempts = 0;
  errorCount = 0;
  completedCorrect = 0;
  completedPassages = 0;

  input.disabled = false;
  resultCard.hidden = true;
  restartButton.classList.remove("result-ready");

  inputLabel.textContent = "Начни печатать, чтобы запустить тест";
  hint.textContent =
    "Печатай спокойно. Ошибки сохраняются даже после исправления.";

  updateControls();
  loadPassage();
  updateStats();
  renderRecord();

  if (focusInput) input.focus();
}

function getRecordKey() {
  const level = selectedMode === "text"
    ? selectedDifficulty
    : "none";

  const baseKey = `${selectedMode}:${level}:${duration}`;

  // Русские ключи сохраняем прежними, чтобы не потерять рекорды.
  return selectedLanguage === "ru"
    ? baseKey
    : `en:${baseKey}`;
}

function getCurrentRecord() {
  const record = records[getRecordKey()];

  if (
    !record ||
    !Number.isFinite(record.wpm) ||
    !Number.isFinite(record.accuracy) ||
    record.wpm <= 0 ||
    record.accuracy < 90 ||
    record.accuracy > 100
  ) {
    return null;
  }

  return record;
}

function showRecordNotice(message) {
  recordNotice.textContent = message;
  recordNotice.hidden = false;
}

function renderRecord() {
  recordCard.classList.remove("is-new-record");
  recordNotice.hidden = true;
  recordMode.textContent = `${getModeLabel()} · ${duration} с`;

  const record = getCurrentRecord();

  if (record) {
    recordValue.textContent = record.wpm;
    recordDetails.textContent =
      `Точность: ${record.accuracy}% · Ошибок: ${record.errors}`;
  } else {
    recordValue.textContent = "—";
    recordDetails.textContent =
      "Пройди тест с точностью от 90%, чтобы установить рекорд.";
  }

  if (!recordStorageAvailable) {
    showRecordNotice(
      "Постоянное сохранение недоступно. Новые рекорды останутся только до обновления страницы."
    );
  }
}

function saveAttemptRecord() {
  const stats = calculateStats();
  const preciseAccuracy = totalAttempts > 0
    ? (correctAttempts / totalAttempts) * 100
    : 0;

  if (totalAttempts === 0 || stats.wpm <= 0) {
    showRecordNotice(
      "Для рекорда нужна завершённая попытка с результатом выше 0 WPM."
    );
    return;
  }

  if (preciseAccuracy < 90) {
    showRecordNotice(
      "Попытка завершена. Для записи рекорда нужна точность не ниже 90%."
    );
    return;
  }

  const previous = getCurrentRecord();

  if (previous && stats.wpm <= previous.wpm) {
    showRecordNotice(
      `Личный рекорд пока остаётся прежним: ${previous.wpm} WPM.`
    );
    return;
  }

  records[getRecordKey()] = {
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    errors: stats.errors,
    date: new Date().toISOString()
  };

  try {
    localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records));
    recordStorageAvailable = true;
  } catch {
    recordStorageAvailable = false;
  }

  renderRecord();
  recordCard.classList.add("is-new-record");

  const message = previous
    ? `✦ Новый личный рекорд! +${stats.wpm - previous.wpm} WPM.`
    : "✦ Первый личный рекорд установлен!";

  showRecordNotice(
    recordStorageAvailable
      ? message
      : `${message} Сохранить после закрытия страницы не удалось.`
  );

  openRecordModal(stats, previous);
}

function openRecordModal(stats, previous) {
  document.getElementById("record-modal-title").textContent =
    previous ? "Новый рекорд!" : "Первый рекорд!";

  document.getElementById("record-modal-wpm").textContent = stats.wpm;
  document.getElementById("record-modal-mode").textContent =
    recordMode.textContent;

  document.getElementById("record-modal-gain").textContent = previous
    ? `+${stats.wpm - previous.wpm} WPM к прошлому рекорду`
    : "Отличное начало твоей истории";

  document.getElementById("record-modal-message").textContent = previous
    ? "Ты превзошёл свой лучший результат! Сохраняй точность, находи свой ритм и двигайся дальше."
    : "Первый рубеж пройден! Теперь у тебя есть результат, который можно улучшить. Хорошая работа!";

  const storageMessage = document.getElementById("record-modal-storage");
  storageMessage.hidden = recordStorageAvailable;
  storageMessage.textContent = recordStorageAvailable
    ? ""
    : "Рекорд установлен, но сохранить его после закрытия страницы не удалось.";

  if (!recordModal.open) recordModal.showModal();
}

function closeRecordModal() {
  recordModal.close();
  tryAgainButton.focus({ preventScroll: true });
}

input.addEventListener("input", () => {
  if (finished) {
    input.value = acceptedValue;
    return;
  }

  if (startedAt !== null && elapsedSeconds() >= duration) {
    input.value = acceptedValue;
    finishTest();
    return;
  }

  const previous = acceptedValue;
  const current = input.value;

  if (startedAt === null && current.length > 0) startTest();

  let start = 0;

  while (
    start < previous.length &&
    start < current.length &&
    previous[start] === current[start]
  ) {
    start++;
  }

  let previousEnd = previous.length;
  let currentEnd = current.length;

  while (
    previousEnd > start &&
    currentEnd > start &&
    previous[previousEnd - 1] === current[currentEnd - 1]
  ) {
    previousEnd--;
    currentEnd--;
  }

  for (let i = start; i < currentEnd; i++) {
    totalAttempts++;

    if (current[i] === target[i]) {
      correctAttempts++;
    } else {
      errorCount++;
    }
  }

  acceptedValue = current;

  renderText();
  updateStats();
  updateHint();

  if (current.length === target.length) advancePassage();
});

input.addEventListener("paste", (event) => event.preventDefault());
input.addEventListener("drop", (event) => event.preventDefault());

restartButton.addEventListener("click", () => resetTest(true));
tryAgainButton.addEventListener("click", () => resetTest(true));

durationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = Number(button.dataset.time);
    if (duration === next) return;
    duration = next;
    resetTest();
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.mode;
    if (selectedMode === next) return;
    selectedMode = next;
    resetTest();
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.difficulty;
    if (selectedDifficulty === next) return;
    selectedDifficulty = next;
    resetTest();
  });
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.language;
    if (selectedLanguage === next) return;
    selectedLanguage = next;
    resetTest();
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) tick();
});

recordModalClose.addEventListener("click", closeRecordModal);
recordModalContinue.addEventListener("click", closeRecordModal);

recordModal.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeRecordModal();
});

recordModal.addEventListener("click", (event) => {
  if (event.target !== recordModal) return;

  const bounds = recordModal.getBoundingClientRect();
  const outside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (outside) closeRecordModal();
});

resetTest();