/* ──────────────────────────────────────────────
   Landing page — nothing to do
   ────────────────────────────────────────────── */
if (!document.querySelector('.quiz-page')) {
  // landing page loaded
}

/* ──────────────────────────────────────────────
   Quiz page logic
   ────────────────────────────────────────────── */
if (document.querySelector('.quiz-page')) {
  const CIRCUMFERENCE = 2 * Math.PI * 20; // r=20

  let questions = [];
  let currentIndex = 0;
  let score = 0;
  let answers = {};        // { id: chosenAnswer }
  let duration = 60;
  let timeLeft = 60;
  let timerInterval = null;
  let pointsCorrect = 10;
  let pointsIncorrect = -3;
  let quizEnded = false;

  // DOM refs
  const loadingEl      = document.getElementById('loading');
  const questionCard   = document.getElementById('question-card');
  const resultsCard    = document.getElementById('results-card');
  const questionNum    = document.getElementById('question-number');
  const questionCount  = document.getElementById('question-count');
  const questionText   = document.getElementById('question-text');
  const optionsGrid    = document.getElementById('options-grid');
  const scoreDisplay   = document.getElementById('score-display');
  const timerText      = document.getElementById('timer-text');
  const ringFill       = document.getElementById('ring-fill');
  const progressBar    = document.getElementById('progress-bar');
  const playAgainBtn   = document.getElementById('play-again-btn');

  // ── Fetch questions ─────────────────────────
  fetch('/api/questions')
    .then(r => r.json())
    .then(data => {
      questions       = data.questions;
      duration        = data.duration;
      timeLeft        = duration;
      pointsCorrect   = data.points_correct;
      pointsIncorrect = data.points_incorrect;

      loadingEl.classList.add('hidden');
      questionCard.classList.remove('hidden');
      renderQuestion();
      startTimer();
    });

  // ── Timer ────────────────────────────────────
  function startTimer() {
    updateTimerUI();
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimerUI();
      if (timeLeft <= 0) endQuiz('timeout');
    }, 1000);
  }

  function updateTimerUI() {
    timerText.textContent = timeLeft;

    const ratio = timeLeft / duration;
    ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);

    if (ratio <= 0.25)      ringFill.style.stroke = 'var(--wrong)';
    else if (ratio <= 0.5)  ringFill.style.stroke = 'var(--warn)';
    else                    ringFill.style.stroke = 'var(--accent)';
  }

  // ── Render question ──────────────────────────
  const LETTERS = ['A', 'B', 'C', 'D'];

  function renderQuestion() {
    const q = questions[currentIndex];
    questionNum.textContent  = `Question ${currentIndex + 1}`;
    questionCount.textContent = `${currentIndex + 1} / ${questions.length}`;
    questionText.textContent = q.question;
    progressBar.style.width  = `${(currentIndex / questions.length) * 100}%`;

    optionsGrid.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span class="opt-letter">${LETTERS[i]}</span>${opt}`;
      btn.dataset.value = opt;
      btn.addEventListener('click', () => selectOption(btn, q.id));
      optionsGrid.appendChild(btn);
    });

    // Restore previous selection if navigating back (not implemented but harmless)
  }

  // ── Select an option ─────────────────────────
  function selectOption(btn, questionId) {
    if (quizEnded) return;

    const chosen = btn.dataset.value;
    answers[questionId] = chosen;

    // Disable all options and show feedback
    const allBtns = optionsGrid.querySelectorAll('.option-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      b.classList.remove('selected');
    });

    // POST to server to check answer
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: { [questionId]: chosen } }),
    })
      .then(r => r.json())
      .then(data => {
        const result = data.results.find(r => r.id === questionId);
        const delta  = result.is_correct ? pointsCorrect : pointsIncorrect;
        score += delta;

        // Visual feedback
        allBtns.forEach(b => {
          if (b.dataset.value === result.correct) b.classList.add('correct');
          else if (b.dataset.value === chosen && !result.is_correct) b.classList.add('wrong');
        });

        updateScore();

        // Advance after short delay
        setTimeout(() => {
          if (currentIndex + 1 >= questions.length) {
            endQuiz('complete');
          } else {
            currentIndex++;
            renderQuestion();
          }
        }, 900);
      });
  }

  function updateScore() {
    scoreDisplay.textContent = score;
    scoreDisplay.classList.remove('bump');
    void scoreDisplay.offsetWidth; // reflow to restart animation
    scoreDisplay.classList.add('bump');
  }

  // ── End quiz ─────────────────────────────────
  function endQuiz(reason) {
    if (quizEnded) return;
    quizEnded = true;
    clearInterval(timerInterval);

    // Collect all answers and submit for full breakdown
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
      .then(r => r.json())
      .then(data => {
        questionCard.classList.add('hidden');
        resultsCard.classList.remove('hidden');
        progressBar.style.width = '100%';
        showResults(data, reason);
      });
  }

  function showResults(data, reason) {
    const icon      = document.getElementById('results-icon');
    const title     = document.getElementById('results-title');
    const subtitle  = document.getElementById('results-subtitle');
    const finalScore = document.getElementById('final-score');
    const breakdown  = document.getElementById('results-breakdown');

    finalScore.textContent = data.score;

    const correct  = data.results.filter(r => r.is_correct).length;
    const answered = data.answered;

    if (data.score >= 80) {
      icon.textContent = '🏆';
      title.textContent = 'Excellent!';
    } else if (data.score >= 40) {
      icon.textContent = '👍';
      title.textContent = 'Nice Work!';
    } else if (data.score >= 0) {
      icon.textContent = '📚';
      title.textContent = 'Keep Practising';
    } else {
      icon.textContent = '😅';
      title.textContent = 'Better Luck Next Time';
    }

    subtitle.textContent = reason === 'timeout'
      ? `Time's up! You answered ${answered} of ${data.total} questions (${correct} correct).`
      : `You answered all ${data.total} questions (${correct} correct).`;

    breakdown.innerHTML = '';
    data.results.forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'breakdown-item';

      let icon, badgeClass, badgeText;
      if (r.chosen === null) {
        icon = '—'; badgeClass = 'skipped'; badgeText = 'Skipped';
      } else if (r.is_correct) {
        icon = '✓'; badgeClass = 'correct'; badgeText = `+${pointsCorrect}`;
      } else {
        icon = '✗'; badgeClass = 'wrong'; badgeText = `${pointsIncorrect}`;
      }

      item.innerHTML = `
        <span class="bi-icon">${icon}</span>
        <span class="bi-question">Q${i + 1}: ${r.question}</span>
        <span class="bi-badge ${badgeClass}">${badgeText}</span>
      `;
      breakdown.appendChild(item);
    });
  }

  // ── Play again ───────────────────────────────
  playAgainBtn.addEventListener('click', () => {
    window.location.href = '/quiz';
  });
}
