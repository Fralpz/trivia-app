let questions = [];
let current = 0;
let score = 0;
let answerLog = []; 
let requestId = 0;  

const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const categorySelect = document.getElementById("categorySelect");
const difficultySelect = document.getElementById("difficultySelect");
const amountSelect = document.getElementById("amountSelect");
const startBtn = document.getElementById("startBtn");
const menuBtn = document.getElementById("menuBtn");

const questionEl = document.getElementById("question");
const answersEl = document.getElementById("answers");
const categoryEl = document.getElementById("category");
const progressEl = document.getElementById("progress");
const nextBtn = document.getElementById("next");
const playAgainBtn = document.getElementById("playAgain");

const settingsRoot = document.getElementById("settings");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const themeButtons = document.querySelectorAll("[data-theme-choice]");
const soundSwitch = document.getElementById("soundSwitch");
const volumeSlider = document.getElementById("volume");
const volumeLabel = document.getElementById("volumeLabel");


function openSettings() {
  settingsPanel.hidden = false;
  settingsBtn.setAttribute("aria-expanded", "true");
}

function closeSettings() {
  settingsPanel.hidden = true;
  settingsBtn.setAttribute("aria-expanded", "false");
}

settingsBtn.onclick = () => {
  settingsPanel.hidden ? openSettings() : closeSettings();
};

document.addEventListener("click", (e) => {
  if (!settingsPanel.hidden && !settingsRoot.contains(e.target)) {
    closeSettings();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsPanel.hidden) {
    closeSettings();
    settingsBtn.focus();
  }
});


function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function updateThemeUI() {
  const theme = currentTheme();
  themeButtons.forEach((btn) => {
    const active = btn.dataset.themeChoice === theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active);
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("theme", theme); } catch (e) {}
  updateThemeUI();
}

themeButtons.forEach((btn) => {
  btn.onclick = () => setTheme(btn.dataset.themeChoice);
});

updateThemeUI();


let audioCtx = null;
let soundOn = true;
let masterVolume = 0.7;

try {
  soundOn = localStorage.getItem("sound") !== "off";
  const saved = localStorage.getItem("volume");
  if (saved !== null && !isNaN(parseFloat(saved))) {
    masterVolume = Math.min(1, Math.max(0, parseFloat(saved)));
  }
} catch (e) {}

function isSilent() {
  return !soundOn || masterVolume === 0;
}

function saveSound() {
  try {
    localStorage.setItem("sound", soundOn ? "on" : "off");
    localStorage.setItem("volume", masterVolume);
  } catch (e) {}
}

function updateSoundUI() {
  const percent = Math.round(masterVolume * 100);
  volumeSlider.value = percent;
  volumeLabel.textContent = `${percent}%`;

  const silent = isSilent();
  soundSwitch.setAttribute("aria-checked", !silent);
  volumeSlider.classList.toggle("muted", silent);
}

soundSwitch.onclick = () => {
  if (isSilent()) {
    soundOn = true;
    if (masterVolume === 0) masterVolume = 0.7;
  } else {
    soundOn = false;
  }
  saveSound();
  updateSoundUI();
};

volumeSlider.oninput = () => {
  masterVolume = volumeSlider.value / 100;
  if (masterVolume > 0) soundOn = true;
  saveSound();
  updateSoundUI();
};

volumeSlider.onchange = () => {
  playTone(659.25, 0, 0.2);
};

updateSoundUI();

function playTone(freq, start, duration, type = "sine", volume = 0.2) {
  const finalVolume = volume * masterVolume;
  if (!soundOn || finalVolume <= 0) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const t = audioCtx.currentTime + start;

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(finalVolume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function playCorrect() {
  playTone(523.25, 0.00, 0.15);
  playTone(659.25, 0.10, 0.15);
  playTone(783.99, 0.20, 0.30);
}

function playWrong() {
  playTone(330, 0.00, 0.25, "sine", 0.12);
  playTone(262, 0.15, 0.40, "sine", 0.12);
}


function showScreen(name) {
  menuScreen.hidden = name !== "menu";
  gameScreen.hidden = name !== "game";
}


let lastSettings = { category: "", difficulty: "", amount: "5" };

try {
  const saved = JSON.parse(localStorage.getItem("menuSettings"));
  if (saved) {
    categorySelect.value = saved.category ?? "";
    difficultySelect.value = saved.difficulty ?? "";
    amountSelect.value = saved.amount ?? "5";
  }
} catch (e) {}

startBtn.onclick = () => {
  lastSettings = {
    category: categorySelect.value,
    difficulty: difficultySelect.value,
    amount: amountSelect.value,
  };
  try { localStorage.setItem("menuSettings", JSON.stringify(lastSettings)); } catch (e) {}

  showScreen("game");
  loadQuestions();
};

menuBtn.onclick = () => {
  requestId++;
  showScreen("menu");
};

async function loadQuestions() {
  const myRequest = ++requestId;

  current = 0;
  score = 0;
  answerLog = [];
  questionEl.textContent = "Loading...";
  answersEl.innerHTML = "";
  categoryEl.textContent = "";
  progressEl.textContent = "";
  nextBtn.hidden = true;
  playAgainBtn.hidden = true;

  const params = new URLSearchParams({ amount: lastSettings.amount });
  if (lastSettings.category) params.set("category", lastSettings.category);
  if (lastSettings.difficulty) params.set("difficulty", lastSettings.difficulty);

  try {
    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();
    if (myRequest !== requestId) return;

    if (!res.ok) throw new Error(data.error || "Request failed");

    questions = data;
    showQuestion();
  } catch (err) {
    if (myRequest !== requestId) return;
    questionEl.textContent = err.message || "Couldn't load questions. Wait a few seconds and try again.";
    playAgainBtn.textContent = "Try Again";
    playAgainBtn.hidden = false;
  }
}

function showQuestion() {
  const q = questions[current];
  progressEl.textContent = `Question ${current + 1} of ${questions.length}`;
  categoryEl.textContent = `${q.category} (${q.difficulty})`;
  questionEl.textContent = q.question;
  answersEl.innerHTML = "";
  nextBtn.hidden = true;

  q.answers.forEach((answer, index) => {
    const btn = document.createElement("button");
    btn.textContent = answer;
    btn.onclick = () => checkAnswer(btn, index, q.correct_index);
    answersEl.appendChild(btn);
  });
}

function checkAnswer(btn, index, correctIndex) {
  const q = questions[current];
  answerLog.push({
    question: q.question,
    picked: q.answers[index],
    correct: q.answers[correctIndex],
    isCorrect: index === correctIndex,
  });

  const buttons = answersEl.querySelectorAll("button");
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === correctIndex) b.classList.add("correct");
  });

  if (index === correctIndex) {
    score++;
    playCorrect();
  } else {
    btn.classList.add("wrong");
    btn.classList.add("shake");
    playWrong();
  }
  nextBtn.hidden = false;
}

function showResults() {
  const percent = Math.round((score / questions.length) * 100);
  questionEl.textContent = `You scored ${score} out of ${questions.length} (${percent}%)`;
  categoryEl.textContent = "";
  progressEl.textContent = "";
  nextBtn.hidden = true;
  answersEl.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "summary";

  answerLog.forEach((item) => {
    const li = document.createElement("li");
    li.className = item.isCorrect ? "summary-item right" : "summary-item miss";

    const q = document.createElement("div");
    q.className = "summary-q";
    q.textContent = item.question;

    const a = document.createElement("div");
    a.className = "summary-a";
    a.textContent = item.isCorrect
      ? `✓ ${item.correct}`
      : `✗ You answered: ${item.picked} | Correct: ${item.correct}`;

    li.append(q, a);
    list.appendChild(li);
  });

  answersEl.appendChild(list);

  playAgainBtn.textContent = "Play Again";
  playAgainBtn.hidden = false;
}

nextBtn.onclick = () => {
  current++;
  if (current < questions.length) {
    showQuestion();
  } else {
    showResults();
  }
};

playAgainBtn.onclick = loadQuestions;


showScreen("menu");
