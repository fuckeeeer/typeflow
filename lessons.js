"use strict";

// ---------------------------------------------------------------------------
// Уроки слепой печати: отрисовка курса, теория, практика, прогресс.
// Данные курса лежат в lessons-data.js (объект typingCourse).
// ---------------------------------------------------------------------------

const LESSON_STORAGE_KEY = "typeflow.lessons.v1";

const els = {
  roadmap: document.getElementById("lesson-roadmap"),
  courseStats: document.getElementById("course-stats"),
  courseNote: document.getElementById("course-note"),

  view: document.getElementById("lesson-view"),
  eyebrow: document.getElementById("lesson-eyebrow"),
  title: document.getElementById("lesson-title"),
  summary: document.getElementById("lesson-summary"),
  accessNote: document.getElementById("lesson-access-note"),
  meta: document.getElementById("lesson-meta"),

  theory: document.getElementById("theory-list"),
  startPractice: document.getElementById("start-practice"),

  drillTitle: document.getElementById("drill-title"),
  drillHint: document.getElementById("drill-hint"),
  stepCounter: document.getElementById("step-counter"),
  lineCounter: document.getElementById("line-counter"),
  progress: document.getElementById("lesson-progress"),
  progressFill: document.getElementById("progress-fill"),

  task: document.getElementById("task-text"),
  input: document.getElementById("lesson-input"),
  inputLabel: document.getElementById("lesson-input-label"),
  accuracy: document.getElementById("stat-accuracy"),
  speedStat: document.getElementById("speed-stat"),
  speed: document.getElementById("stat-speed"),
  time: document.getElementById("stat-time"),
  errors: document.getElementById("stat-errors"),
  restart: document.getElementById("lesson-restart"),

  result: document.getElementById("lesson-result"),
  resultTitle: document.getElementById("result-title"),
  resultBadge: document.getElementById("result-badge"),
  resultAccuracy: document.getElementById("result-accuracy"),
  resultTime: document.getElementById("result-time"),
  resultSpeed: document.getElementById("result-speed"),
  resultSpeedLabel: document.getElementById("result-speed-label"),
  resultSpeedUnit: document.getElementById("result-speed-unit"),
  resultErrors: document.getElementById("result-errors"),
  resultMessage: document.getElementById("result-message"),
  resultBest: document.getElementById("result-best"),
  resultUpsell: document.getElementById("result-upsell"),
  resultAgain: document.getElementById("result-again"),

  unavailable: document.getElementById("lesson-unavailable"),
  unavailableTitle: document.getElementById("unavailable-title"),
  unavailableText: document.getElementById("unavailable-text"),

  paywall: document.getElementById("lesson-paywall"),
  paywallTitle: document.getElementById("paywall-title"),
  paywallText: document.getElementById("paywall-text"),
  paywallBeta: document.getElementById("paywall-beta"),
  paywallNote: document.getElementById("paywall-note")
};

const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const course =
  typeof typingCourse !== "undefined" && typingCourse
    ? typingCourse
    : { lessons: [], note: "" };

const lessons = Array.isArray(course.lessons) ? course.lessons : [];

// --- Прогресс --------------------------------------------------------------

function loadProgress() {
  try {
    const raw = localStorage.getItem(LESSON_STORAGE_KEY);

    if (!raw) return { lessons: {} };

    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { lessons: {} };
    }

    return {
      lessons:
        parsed.lessons && typeof parsed.lessons === "object"
          ? parsed.lessons
          : {}
    };
  } catch {
    return { lessons: {} };
  }
}

const progress = loadProgress();

function saveProgress() {
  try {
    localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Приватный режим или переполненное хранилище — просто не сохраняем.
  }
}

function getLessonRecord(id) {
  const record = progress.lessons[id];

  if (!record || typeof record !== "object") return null;

  return record;
}

// --- Текущий урок и доступ -------------------------------------------------

const BETA_STORAGE_KEY = "typeflow.lessons.beta.v1";

function isPaidLesson(item) {
  return Boolean(item && item.access === "paid");
}

function loadBetaAccess() {
  try {
    return localStorage.getItem(BETA_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveBetaAccess() {
  try {
    localStorage.setItem(BETA_STORAGE_KEY, "1");
  } catch {
    // Приватный режим — доступ останется только на эту сессию.
  }
}

let betaUnlocked = loadBetaAccess();

// "free" — открыт, "beta" — платный, но открыт по бете,
// "paywall" — платный и закрыт, "closed" — урока ещё нет.
function lessonAccessState(item) {
  if (!item || item.status !== "available") return "closed";
  if (!isPaidLesson(item)) return "free";
  if (betaUnlocked) return "beta";

  return "paywall";
}

const params = new URLSearchParams(window.location.search);
const requestedId = params.get("lesson");

const lesson = requestedId
  ? lessons.find((item) => item.id === requestedId)
  : lessons[0];

// Текстовый урок: отрывки берутся из texts.js (как в тренажёре).
const isTextLesson = Boolean(lesson && lesson.textPool);

function shuffleCopy(items) {
  const copy = items.slice();

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function buildTextDrills(item) {
  if (!item || !item.textPool) return null;

  if (typeof textLibrary === "undefined") return [];

  const level = item.textPool.level;
  const pool = level === "mixed"
    ? Object.values(textLibrary).flat()
    : textLibrary[level] || [];

  const wanted = Math.max(1, Number(item.textPool.count) || 1);
  const count = Math.min(wanted, pool.length);
  const passages = shuffleCopy(pool).slice(0, count);

  return passages.map((text, index) => ({
    title: `Абзац ${index + 1} из ${count}`,
    hint:
      "Печатай в своём ритме. Ошибки подсвечиваются, но текст не " +
      "останавливают — как в тренажёре.",
    lines: [text]
  }));
}

const textDrills = buildTextDrills(lesson);

const drills = textDrills
  ? textDrills
  : lesson && Array.isArray(lesson.drills)
    ? lesson.drills.filter(
        (drill) => Array.isArray(drill.lines) && drill.lines.length > 0
      )
    : [];

const totalLines = drills.reduce(
  (sum, drill) => sum + drill.lines.length,
  0
);

// --- Отрисовка курса -------------------------------------------------------

function createBadge(text, variant) {
  const badge = document.createElement("span");
  badge.className = `badge badge-${variant}`;
  badge.textContent = text;

  return badge;
}

function renderCourseStats() {
  const total = lessons.length;
  const free = lessons.filter((item) => !isPaidLesson(item)).length;
  const paid = total - free;
  const completed = lessons.filter((item) => {
    const record = getLessonRecord(item.id);
    return record && record.completed;
  }).length;

  els.courseStats.textContent =
    `Бесплатно: ${free} · Платно: ${paid} · Пройдено: ${completed}`;
}

function renderRoadmap() {
  const cards = lessons.map((item) => {
    const record = getLessonRecord(item.id);
    const paid = isPaidLesson(item);
    const beta = paid && betaUnlocked;
    const isAvailable = item.status === "available";
    const isOpen = isAvailable && (!paid || betaUnlocked);
    const isCompleted = Boolean(record && record.completed);
    const isActive = lesson && item.id === lesson.id;

    const card = document.createElement(isAvailable ? "a" : "div");
    card.className = "roadmap-card";

    if (isAvailable) {
      card.href = `lessons.html?lesson=${encodeURIComponent(item.id)}`;
      card.classList.add(isOpen ? "is-available" : "is-premium");
    } else {
      card.classList.add("is-locked");
      card.setAttribute("aria-disabled", "true");
    }

    if (isActive) card.classList.add("is-active");
    if (isCompleted) card.classList.add("is-completed");

    const number = document.createElement("span");
    number.className = "roadmap-number";
    number.textContent = String(item.number).padStart(2, "0");

    const body = document.createElement("div");
    body.className = "roadmap-body";

    const kicker = document.createElement("span");
    kicker.className = "roadmap-kicker";
    kicker.textContent =
      `Урок ${item.number} · ` + (paid ? "Премиум" : "Бесплатно");
    body.append(kicker);

    const title = document.createElement("h3");
    title.className = "roadmap-title";
    title.textContent = item.title;
    body.append(title);

    const subtitle = document.createElement("p");
    subtitle.className = "roadmap-subtitle";
    subtitle.textContent = item.subtitle;
    body.append(subtitle);

    const footer = document.createElement("div");
    footer.className = "roadmap-footer";

    if (!isAvailable) {
      footer.append(createBadge("Скоро", "soon"));
    } else if (isCompleted) {
      const accuracy = Number(record.bestAccuracy);
      footer.append(
        createBadge(
          Number.isFinite(accuracy) && accuracy > 0
            ? `Пройден · ${accuracy}%`
            : "Пройден",
          "done"
        )
      );
    } else if (isOpen) {
      footer.append(createBadge("Доступен", "ready"));
    } else {
      footer.append(createBadge("Платно", "paid"));
    }

    if (isAvailable && paid) {
      if (beta) {
        footer.append(createBadge("Доступ по бете", "free"));
      } else if (isCompleted) {
        footer.append(createBadge("Платно", "paid"));
      }
    }

    body.append(footer);
    card.append(number, body);

    const arrow = document.createElement("span");
    arrow.className = "roadmap-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = isAvailable ? "↗" : "⌁";
    card.append(arrow);

    if (isActive) card.setAttribute("aria-current", "page");

    return card;
  });

  els.roadmap.replaceChildren(...cards);
}

// --- Отрисовка урока -------------------------------------------------------

function renderMeta() {
  const record = getLessonRecord(lesson.id);

  const chips = [
    { text: `≈ ${lesson.minutes} мин` },
    isTextLesson
      ? { text: "Текст из тренажёра" }
      : { text: "Теория + практика" },
    isTextLesson
      ? { text: `${drills.length} отрывка` }
      : { text: `${drills.length} упражнения` }
  ];

  if (isTextLesson) {
    chips.push({ text: "скорость в WPM", variant: "is-record" });
  }

  if (isPaidLesson(lesson)) {
    chips.push({ text: "Премиум", variant: "is-paid" });

    if (betaUnlocked) {
      chips.push({ text: "доступ по бете", variant: "is-free" });
    }
  } else {
    chips.push({ text: "Бесплатно", variant: "is-free" });
  }

  const elements = chips.map((chip) => {
    const element = document.createElement("span");
    element.className = "lesson-chip" + (chip.variant ? ` ${chip.variant}` : "");
    element.textContent = chip.text;

    return element;
  });

  if (record && record.completed) {
    const accuracy = Number(record.bestAccuracy);

    if (Number.isFinite(accuracy) && accuracy > 0) {
      const chip = document.createElement("span");
      chip.className = "lesson-chip is-record";
      chip.textContent = `Лучший результат: ${accuracy}%`;
      elements.push(chip);
    }
  }

  els.meta.replaceChildren(...elements);
}

function createKeyboard(data) {
  const keyboard = document.createElement("div");
  keyboard.className = "keyboard";

  data.groups.forEach((group) => {
    const hand = document.createElement("div");
    hand.className = "keyboard-hand";

    const label = document.createElement("span");
    label.className = "keyboard-hand-label";
    label.textContent = group.label;
    hand.append(label);

    const keys = document.createElement("div");
    keys.className = "keyboard-keys";

    group.keys.forEach((key) => {
      const keyElement = document.createElement("div");
      keyElement.className =
        `keyboard-key finger-${key.finger}` +
        (key.bump ? " has-bump" : "");

      const letter = document.createElement("span");
      letter.className = "keyboard-letter";
      letter.textContent = key.key;

      const finger = document.createElement("span");
      finger.className = "keyboard-finger";
      finger.textContent = key.name;

      keyElement.append(letter, finger);
      keys.append(keyElement);
    });

    hand.append(keys);
    keyboard.append(hand);
  });

  if (data.space) {
    const space = document.createElement("div");
    space.className = "keyboard-space";

    const key = document.createElement("span");
    key.className = "keyboard-space-key";
    key.textContent = data.space.key;

    const finger = document.createElement("span");
    finger.className = "keyboard-finger";
    finger.textContent = data.space.name;

    space.append(key, finger);
    keyboard.append(space);
  }

  if (data.caption) {
    const caption = document.createElement("p");
    caption.className = "keyboard-caption";
    caption.textContent = data.caption;
    keyboard.append(caption);
  }

  return keyboard;
}

function createTheoryCard(block, index) {
  const card = document.createElement("article");
  card.className = "theory-card";
  if (block.keyboard) card.classList.add("is-wide");

  const number = document.createElement("span");
  number.className = "theory-index";
  number.textContent = String(index + 1).padStart(2, "0");

  const body = document.createElement("div");
  body.className = "theory-body";

  const title = document.createElement("h3");
  title.textContent = block.title;
  body.append(title);

  if (block.text) {
    const text = document.createElement("p");
    text.textContent = block.text;
    body.append(text);
  }

  if (block.keyboard) body.append(createKeyboard(block.keyboard));

  if (block.tip) {
    const tip = document.createElement("p");
    tip.className = "theory-tip";
    tip.textContent = `Совет. ${block.tip}`;
    body.append(tip);
  }

  card.append(number, body);

  return card;
}

function renderTheory() {
  const blocks = Array.isArray(lesson.theory) ? lesson.theory : [];
  els.theory.replaceChildren(...blocks.map(createTheoryCard));
}

function renderLesson() {
  els.eyebrow.textContent =
    `УРОК ${String(lesson.number).padStart(2, "0")} · ` +
    (isPaidLesson(lesson) ? "ПРЕМИУМ" : "БЕСПЛАТНО");
  els.title.textContent = lesson.title;
  els.summary.textContent = lesson.summary || "";

  if (isPaidLesson(lesson)) {
    els.accessNote.hidden = false;
    els.accessNote.textContent =
      "Доступ по бете: урок входит в платный блок, но открыт бесплатно. " +
      "Прогресс сохранится.";
  }

  renderMeta();
  renderTheory();

  document.title = `${lesson.title} — уроки TypeFlow`;
}

// --- Практика --------------------------------------------------------------

const state = {
  drillIndex: 0,
  lineIndex: 0,
  target: "",
  accepted: "",
  attempts: 0,
  correct: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
  finished: false,
  timerId: null
};

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function elapsedMs() {
  if (state.startedAt === null) return 0;

  const end = state.finished ? state.finishedAt : performance.now();

  return Math.max(0, end - state.startedAt);
}

function currentDrill() {
  return drills[state.drillIndex];
}

function linesBefore(index) {
  let total = 0;

  for (let i = 0; i < index; i += 1) total += drills[i].lines.length;

  return total;
}

function accuracyPercent() {
  return state.attempts > 0
    ? Math.round((state.correct / state.attempts) * 100)
    : 100;
}

function wpmNow() {
  const seconds = elapsedMs() / 1000;

  if (seconds <= 0) return 0;

  return Math.round((state.correct / 5) / (seconds / 60));
}

function updateStats() {
  els.accuracy.textContent = `${accuracyPercent()}%`;
  els.errors.textContent = String(state.errors);
  els.time.textContent = formatTime(elapsedMs());

  if (isTextLesson) {
    els.speed.textContent = String(wpmNow());
  }
}

function updateLabels() {
  const finished = state.drillIndex >= drills.length;
  const index = Math.min(state.drillIndex, drills.length - 1);
  const drill = drills[index];

  els.stepCounter.textContent = finished
    ? `Готово · ${drills.length} из ${drills.length}`
    : isTextLesson
      ? `Отрывок ${state.drillIndex + 1} из ${drills.length}`
      : `Шаг ${state.drillIndex + 1} из ${drills.length}`;

  els.drillTitle.textContent = finished
    ? "Урок пройден"
    : drill.title;

  els.drillHint.textContent = finished
    ? "Все упражнения выполнены. Результат — ниже."
    : drill.hint || "";

  els.lineCounter.textContent = finished
    ? "Все строки пройдены"
    : isTextLesson
      ? "Текст целиком"
      : `Строка ${state.lineIndex + 1} из ${drill.lines.length}`;

  const doneLines = linesBefore(state.drillIndex) + state.lineIndex;
  const percent = totalLines > 0
    ? Math.min(100, Math.round((doneLines / totalLines) * 100))
    : 0;

  els.progressFill.style.width = `${percent}%`;
  els.progress.setAttribute("aria-valuenow", String(percent));

  els.restart.innerHTML = state.finished
    ? '<span aria-hidden="true">↻</span> Пройти заново'
    : isTextLesson
      ? '<span aria-hidden="true">↻</span> Абзац заново'
      : '<span aria-hidden="true">↻</span> Строка заново';
}

function renderTask() {
  const fragment = document.createDocumentFragment();
  const typed = state.accepted;

  for (let i = 0; i < state.target.length; i += 1) {
    const span = document.createElement("span");
    span.textContent = state.target[i];

    if (i < typed.length) {
      span.className = typed[i] === state.target[i]
        ? "letter-correct"
        : "letter-wrong";
    } else if (i === typed.length && !state.finished) {
      span.className = "letter-current";
    }

    fragment.append(span);
  }

  els.task.replaceChildren(fragment);
}

function loadLine() {
  const drill = currentDrill();
  const line = drill.lines[state.lineIndex];

  state.target = line;
  state.accepted = "";

  els.input.value = "";
  els.input.maxLength = line.length;
  els.input.disabled = false;
  els.input.placeholder = "Печатай строку выше…";

  renderTask();
  updateLabels();
  updateStats();
}

function startTimer() {
  state.startedAt = performance.now();
  state.finishedAt = null;

  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.finished) els.time.textContent = formatTime(elapsedMs());
  }, 200);
}

function countChanges(previous, current) {
  let start = 0;
  const shortest = Math.min(previous.length, current.length);

  while (
    start < shortest &&
    previous[start] === current[start]
  ) {
    start += 1;
  }

  let previousEnd = previous.length;
  let currentEnd = current.length;

  while (
    previousEnd > start &&
    currentEnd > start &&
    previous[previousEnd - 1] === current[currentEnd - 1]
  ) {
    previousEnd -= 1;
    currentEnd -= 1;
  }

  for (let i = start; i < currentEnd; i += 1) {
    state.attempts += 1;

    if (current[i] === state.target[i]) {
      state.correct += 1;
    } else {
      state.errors += 1;
    }
  }
}

function advanceLine() {
  const drill = currentDrill();
  state.lineIndex += 1;

  if (state.lineIndex >= drill.lines.length) {
    state.drillIndex += 1;
    state.lineIndex = 0;

    if (state.drillIndex >= drills.length) {
      finishLesson();
      return;
    }

    els.inputLabel.textContent = isTextLesson
      ? "Отрывок пройден. Дальше — следующий."
      : "Упражнение пройдено. Дальше — новое задание.";
  }

  loadLine();
}

function handleInput() {
  if (state.finished) {
    els.input.value = state.accepted;
    return;
  }

  const previous = state.accepted;
  const current = els.input.value;

  if (state.startedAt === null && current.length > 0) startTimer();

  countChanges(previous, current);
  state.accepted = current;

  renderTask();
  updateStats();

  // Текстовые уроки, как тренажёр: ошибки не мешают дойти до конца.
  const complete = isTextLesson
    ? current.length >= state.target.length
    : current === state.target;

  if (complete) advanceLine();
}

function saveLessonResult(result) {
  const previous = getLessonRecord(lesson.id) || {};
  const qualifies = result.accuracy >= 90;

  const bestTimeMs = qualifies
    ? previous.bestTimeMs
      ? Math.min(previous.bestTimeMs, result.timeMs)
      : result.timeMs
    : previous.bestTimeMs || null;

  const bestSpeed = qualifies
    ? Math.max(previous.bestSpeed || 0, result.speed)
    : previous.bestSpeed || 0;

  progress.lessons[lesson.id] = {
    completed: true,
    attemptsCount: (previous.attemptsCount || 0) + 1,
    bestAccuracy: Math.max(previous.bestAccuracy || 0, result.accuracy),
    bestTimeMs,
    bestSpeed,
    updatedAt: new Date().toISOString()
  };

  saveProgress();
  renderRoadmap();
  renderCourseStats();

  return previous;
}

function renderResult(result, previous) {
  els.resultTitle.textContent = `Урок «${lesson.title}» пройден`;
  els.resultAccuracy.textContent = String(result.accuracy);
  els.resultTime.textContent = formatTime(result.timeMs);
  els.resultSpeed.textContent = String(result.speed);

  els.resultSpeedLabel.textContent = isTextLesson ? "Скорость" : "Темп";
  els.resultSpeedUnit.textContent = isTextLesson ? "WPM" : "зн/мин";

  els.resultErrors.textContent = String(result.errors);

  els.resultBadge.textContent = previous.completed
    ? "Урок повторён"
    : "Урок пройден";

  if (result.accuracy >= 97) {
    els.resultMessage.textContent = isTextLesson
      ? "Отличный темп и почти идеальная точность. " +
        "Следующий шаг — удержать WPM на более сложном тексте."
      : "Почти идеально: пальцы уже знают, куда идти. " +
        "Дальше можно закреплять результат в тренажёре.";
  } else if (result.accuracy >= 90) {
    els.resultMessage.textContent =
      "Хорошая работа. Точность выше 90% — это уверенный результат. " +
      "Повтори урок ещё раз, чтобы закрепить.";
  } else {
    els.resultMessage.textContent =
      "Урок пройден, но точность пока ниже 90%. Это нормально: " +
      "верни урок через день и печатай медленнее, следя за пальцами.";
  }

  const record = getLessonRecord(lesson.id);
  const bestAccuracy = Number(record && record.bestAccuracy);
  const previousAccuracy = Number(previous.bestAccuracy) || 0;

  if (record && Number.isFinite(bestAccuracy)) {
    const bestTime = record.bestTimeMs
      ? ` · ${formatTime(record.bestTimeMs)}`
      : "";

    els.resultBest.textContent =
      result.accuracy > previousAccuracy
        ? `Новый лучший результат: ${bestAccuracy}%${bestTime}`
        : `Лучший результат урока: ${bestAccuracy}%${bestTime}`;
  } else {
    els.resultBest.textContent = "";
  }

  const hasPaidAhead = lessons.some(
    (item) => isPaidLesson(item) && item.number > lesson.number
  );

  els.resultUpsell.hidden = !(lesson.access === "free" && hasPaidAhead);

  if (!els.resultUpsell.hidden) {
    els.resultUpsell.textContent = betaUnlocked
      ? "Дальше — платные уроки курса. Бета-доступ уже открыт, можно продолжать."
      : "Дальше — платные уроки курса. Их можно открыть в бете бесплатно.";
  }

  els.result.hidden = false;
  els.result.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "nearest"
  });
}

function finishLesson() {
  if (state.finished) return;

  state.finished = true;
  state.finishedAt = performance.now();
  clearInterval(state.timerId);
  state.timerId = null;

  els.input.disabled = true;
  els.inputLabel.textContent = "Урок пройден. Результат — ниже.";

  const seconds = elapsedMs() / 1000;

  const result = {
    accuracy: accuracyPercent(),
    timeMs: elapsedMs(),
    speed: isTextLesson
      ? wpmNow()
      : seconds > 0
        ? Math.round((state.attempts / seconds) * 60)
        : 0,
    errors: state.errors
  };

  updateStats();
  updateLabels();
  renderTask();

  const previous = saveLessonResult(result);
  renderResult(result, previous);
}

function resetLessonState() {
  clearInterval(state.timerId);

  state.drillIndex = 0;
  state.lineIndex = 0;
  state.target = "";
  state.accepted = "";
  state.attempts = 0;
  state.correct = 0;
  state.errors = 0;
  state.startedAt = null;
  state.finishedAt = null;
  state.finished = false;
  state.timerId = null;
}

function restartLine() {
  state.accepted = "";
  els.input.value = "";

  renderTask();
  updateStats();
  els.input.focus();
}

function restartLesson() {
  resetLessonState();

  els.result.hidden = true;
  els.input.disabled = false;
  els.inputLabel.textContent = isTextLesson
    ? "Печатай текст и не смотри на клавиатуру"
    : "Печатай строку и не смотри на клавиатуру";

  loadLine();
  els.input.focus();
}

function scrollToPractice() {
  const card = document.querySelector(".practice-card");

  card.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start"
  });
  els.input.focus({ preventScroll: true });
}

// --- Запуск ----------------------------------------------------------------

function showUnavailable() {
  els.view.hidden = true;
  els.paywall.hidden = true;
  els.unavailable.hidden = false;

  const title = lesson
    ? `«${lesson.title}» пока недоступен`
    : "Такого урока пока нет";

  els.unavailableTitle.textContent = title;
  els.unavailableText.textContent = lesson
    ? "Этот урок ещё не готов: он появится в следующих обновлениях курса. " +
      "А первый урок уже открыт."
    : "Проверь адрес страницы или вернись к списку уроков.";

  const firstFree = lessons.find(
    (item) => item.status === "available" && !isPaidLesson(item)
  ) || lessons[0];

  const cta = els.unavailable.querySelector(".try-again-button");

  if (cta && firstFree) {
    cta.href = `lessons.html?lesson=${encodeURIComponent(firstFree.id)}`;
  }

  document.title = "Урок недоступен — TypeFlow";
}

function showPaywall() {
  els.view.hidden = true;
  els.unavailable.hidden = true;
  els.paywall.hidden = false;

  els.paywallTitle.textContent = `«${lesson.title}» — платный урок`;

  els.paywallText.textContent = course.betaAccess
    ? "Первый урок курса бесплатный, остальные входят в платный блок. " +
      "Оплату добавим в следующем обновлении. Пока доступ можно открыть " +
      "в бете — прогресс сохранится."
    : "Первый урок курса бесплатный, остальные входят в платный блок. " +
      "Оплата пока не подключена — следи за обновлениями.";

  els.paywallBeta.hidden = !course.betaAccess;

  els.paywallNote.textContent = course.betaAccess
    ? "Оплата появится в следующем обновлении. Бета-доступ открывает все платные уроки бесплатно — прогресс сохранится."
    : "Оплата пока не подключена — следи за обновлениями.";

  document.title = `${lesson.title} — платный урок TypeFlow`;

  els.paywall.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center"
  });
}

let lessonViewStarted = false;

function startLessonView() {
  els.paywall.hidden = true;
  els.unavailable.hidden = true;
  els.view.hidden = false;
  els.speedStat.hidden = !isTextLesson;

  renderLesson();

  if (lessonViewStarted) return;

  lessonViewStarted = true;

  els.input.addEventListener("input", handleInput);
  els.input.addEventListener("paste", (event) => event.preventDefault());
  els.input.addEventListener("drop", (event) => event.preventDefault());

  els.inputLabel.textContent = isTextLesson
    ? "Печатай текст и не смотри на клавиатуру"
    : "Печатай строку и не смотри на клавиатуру";

  els.restart.addEventListener("click", () => {
    if (state.finished) {
      restartLesson();
    } else {
      restartLine();
    }
  });

  els.resultAgain.addEventListener("click", restartLesson);
  els.startPractice.addEventListener("click", scrollToPractice);

  document.querySelector(".lesson-typing").addEventListener("click", () => {
    els.input.focus({ preventScroll: true });
  });

  loadLine();
}

function unlockBeta() {
  betaUnlocked = true;
  saveBetaAccess();

  renderRoadmap();
  renderCourseStats();

  startLessonView();
}

function init() {
  renderRoadmap();
  renderCourseStats();

  els.courseNote.textContent = course.note || "";

  if (!lesson || lesson.status !== "available" || drills.length === 0) {
    showUnavailable();
    return;
  }

  if (lessonAccessState(lesson) === "paywall") {
    showPaywall();
    return;
  }

  startLessonView();
}

els.paywallBeta.addEventListener("click", unlockBeta);

init();
