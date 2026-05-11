let currentQuizId = null;
let editingQuizId = null;
let questionCount = 0;
let viewHistory = ['role'];
const MAX_Q = 10, MIN_Q = 5;

const getQuizzes = () => JSON.parse(localStorage.getItem('qv_quizzes') || '[]');
const saveQuizzes = (data) => localStorage.setItem('qv_quizzes', JSON.stringify(data));

document.addEventListener('DOMContentLoaded', () => {
    switchView('role');
});

// QUIZ TIMER LOGIC
let quizTimerInterval = null;
let quizTimeTotal = 0;
let quizTimeLeft = 0;

function parseTimeToSeconds(timeString) {
    const parts = timeString.split(':').map(Number);
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
}

function formatSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, '0'))
        .join(':');
}

function stopQuizTimer() {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
}

function updateQuizTimerUI() {
    const timeLeftEl = document.getElementById('time-left');
    const progressFill = document.getElementById('time-progress-fill');

    if (!timeLeftEl || !progressFill || quizTimeTotal <= 0) return;

    timeLeftEl.textContent = formatSeconds(quizTimeLeft);

    const percentUsed = Math.max(0, Math.min(100, ((quizTimeTotal - quizTimeLeft) / quizTimeTotal) * 100));
    progressFill.style.width = `${percentUsed}%`;

    if (quizTimeLeft <= 30) {
        progressFill.classList.add('time-low');
    } else {
        progressFill.classList.remove('time-low');
    }
}

function startQuizTimer(durationString) {
    stopQuizTimer();

    quizTimeTotal = parseTimeToSeconds(durationString || '00:00:00');
    quizTimeLeft = quizTimeTotal;

    updateQuizTimerUI();

    quizTimerInterval = setInterval(() => {
        quizTimeLeft -= 1;

        if (quizTimeLeft <= 0) {
            quizTimeLeft = 0;
            updateQuizTimerUI();
            stopQuizTimer();
            submitQuiz(true);
            return;
        }

        updateQuizTimerUI();
    }, 1000);
}

function switchView(view) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');

    const header = document.querySelector('.header');
    const roleBadge = document.getElementById('role-badge');
    const backBtn = document.getElementById('back-btn');
    const roleText = document.getElementById('role-text');

    header.classList.toggle('hidden', view === 'role');

    if (view !== 'quiz') stopQuizTimer();

    if (view === 'role') {
        roleBadge.classList.add('hidden');
        backBtn.classList.add('hidden');
        viewHistory = ['role'];
    } else if (['student', 'teacher-dashboard', 'teacher-create'].includes(view)) {
        roleBadge.classList.remove('hidden');
        backBtn.classList.remove('hidden');
        roleText.textContent = view.includes('teacher') ? 'Teacher' : 'Student';
        viewHistory.push(view);
    }

    if (view === 'student') renderQuizList();
    if (view === 'teacher-dashboard') renderTeacherDashboard();
    if (view === 'teacher-create' && !editingQuizId) {
        resetTeacherForm();
    }
}

// Confirm leaving teacher form with unsaved changes
function confirmLeaveTeacherForm() {
    const isEditing = Boolean(editingQuizId);

    const title = document.getElementById('t-title')?.value.trim() || '';
    const timer = document.getElementById('t-timer')?.value.trim() || '00:00:00';
    const questionBlocks = document.querySelectorAll('.question-block').length;

    const hasQuestionContent = Array.from(
    document.querySelectorAll('#t-questions input[type="text"], #t-questions textarea')
    ).some(el => el.value.trim() !== '');

    const hasChanges = title !== '' || timer !== '00:00:00' || questionBlocks > 0 || hasQuestionContent;

    if (!hasChanges) return true;

    const message = isEditing
    ? 'You have unsaved changes while editing this quiz. Discard changes and go back?'
    : 'Cancel creating this quiz and go back?';

    if (!confirm(message)) return false;

    resetTeacherForm();
    return true;
}



// handles cancel button in teacher create/edit form
function handleTeacherCancel() {
    if (!confirmLeaveTeacherForm()) return;
    switchView('teacher-dashboard');
}

// handles pressing Back to home while taking quiz
function goBack() {
    const currentView = viewHistory[viewHistory.length - 1] || 'role';

    // Guard: leaving teacher form with unsaved changes
    if (currentView === 'teacher-create' && !confirmLeaveTeacherForm()) return;

    // Guard: leaving active quiz
    if (currentView === 'quiz') {
        const ok = confirm('You have unsaved progress in this quiz. If you go back your answers will be lost. Continue?');
        if (!ok) return;
        stopQuizTimer();
        currentQuizId = null;
    }

    // Results should always go back to student list
    if (currentView === 'results') {
        stopQuizTimer();
        currentQuizId = null;
        switchView('student');
        return;
    }

    // Normal back navigation
    if (viewHistory.length > 1) {
        viewHistory.pop();
        const previousView = viewHistory[viewHistory.length - 1] || 'role';
        switchView(previousView);
        return;
    }

    switchView('role');
}

function handleLogoClick() {
    const currentView = viewHistory[viewHistory.length - 1];
    if (currentView === 'quiz') {
        const ok = confirm('You have unsaved progress in this quiz. If you go back your answers will be lost. Continue?');
        if (!ok) return;
        stopQuizTimer();  // Add this line
    }
    switchView('role');
}

function switchView(view) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');

    const header = document.querySelector('.header');
    const roleBadge = document.getElementById('role-badge');
    const backBtn = document.getElementById('back-btn');
    const roleText = document.getElementById('role-text');

    header.classList.toggle('hidden', view === 'role');

    if (view === 'role') {
        roleBadge.classList.add('hidden');
        backBtn.classList.add('hidden');
        viewHistory = ['role'];
    } else {
        roleBadge.classList.remove('hidden');
        backBtn.classList.remove('hidden');
        roleText.textContent = view.includes('teacher') ? 'Teacher' : 'Student';
        viewHistory.push(view);
    }

    if (view === 'student') renderQuizList();
    if (view === 'teacher-dashboard') renderTeacherDashboard();
    if (view === 'teacher-create' && !editingQuizId) resetTeacherForm();
}

// TEACHER DASHBOARD
function renderTeacherDashboard() {
    const quizzes = getQuizzes();
    const container = document.getElementById('teacher-quiz-list');
    document.getElementById('total-quizzes').textContent = quizzes.length;
    const totalQ = quizzes.reduce((sum, q) => sum + q.questions.length, 0);
    document.getElementById('total-questions').textContent = totalQ;

    if (quizzes.length === 0) {
        container.innerHTML = `<p style="text-align: center; padding: 3rem; color: var(--gray-blue-v2);">No quizzes created yet. Click "Create New Quiz" to start!</p>`;
        return;
    }

    container.innerHTML = quizzes.map(q => {
        const date = new Date(q.createdAt).toLocaleDateString();
        return `
            <div class="quiz-list-item">
                <div class="quiz-info">
                    <h3>${q.title}</h3>
                    <div class="quiz-meta">${q.questions.length} Questions • Created: ${date}</div>
                </div>
                <div class="quiz-actions">
                    <button class="btn btn-warning btn-small" onclick="editQuiz('${q.id}')">✎ Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteQuiz('${q.id}')">️🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteQuiz(id) {
    const quizzes = getQuizzes();
    const targetQuiz = quizzes.find(q => q.id === id);
    if (!targetQuiz) {
        alert('Quiz not found.');
        return;
    }

    const ok = confirm(
        `Delete quiz "${targetQuiz.title}"?\n\nThis action cannot be undone.`
    );
    if (!ok) return;

    const updated = quizzes.filter(q => q.id !== id);
    saveQuizzes(updated);
    renderTeacherDashboard();
}


function editQuiz(id) {
    const quiz = getQuizzes().find(q => q.id === id);
    if (!quiz) return;

    editingQuizId = id;
    document.getElementById('form-title').textContent = 'Edit Quiz';
    document.getElementById('t-title').value = quiz.title;
    document.getElementById('t-timer').value = quiz.timer || '00:00:00';

    const container = document.getElementById('t-questions');
    container.innerHTML = '';
    questionCount = 0;

    quiz.questions.forEach((q, index) => {
        questionCount++;
        const qId = `q-${Date.now()}-${index}`;
        const html = `
            <div class="question-block" id="block-${qId}">
                <div class="question-header">
                    <span class="q-badge">Q${index + 1}</span>
                    <button class="btn-remove" onclick="removeQuestion('${qId}')">Remove</button>
                </div>
                <div class="form-group"><label>Question</label><input type="text" class="q-text" value="${q.text}" placeholder="Enter your question here...."></div>
                <div class="form-group"><label>Choices (Mark the correct answer)</label>
                    <div class="choices">${q.choices.map((choice, i) => `
                        <div class="choice-item">
                            <input type="radio" name="correct-${qId}" value="${i}" ${i === q.correctIndex ? 'checked' : ''}>
                            <span class="choice-label">${String.fromCharCode(65 + i)}.</span>
                            <input type="text" class="q-choice" value="${choice}" placeholder="Choice ${String.fromCharCode(65 + i)}">
                        </div>`).join('')}
                    </div>
                </div>
                <div class="form-group"><label>Explanation (Show after Submit)</label><textarea class="q-exp" placeholder="Explain why the correct answer is right...">${q.explanation}</textarea></div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });

    updateCounter();
    switchView('teacher-create');
}

// TEACHER CREATE/EDIT
function resetTeacherForm() {
    editingQuizId = null;
    document.getElementById('form-title').textContent = 'Create a Quiz';
    document.getElementById('t-title').value = '';
    document.getElementById('t-questions').innerHTML = '';
    document.getElementById('t-timer').value = '00:00:00';
    questionCount = 0;
    updateCounter();
}

function updateCounter() {
    document.getElementById('t-count').textContent = questionCount;
    document.getElementById('t-error').classList.add('hidden');
}

function addQuestion() {
    if (questionCount >= MAX_Q) {
        alert('Maximum 10 questions allowed.');
        return;
    }

    questionCount++;
    updateCounter();

    const container = document.getElementById('t-questions');
    const qId = `q-${Date.now()}`;
    const html = `
        <div class="question-block" id="block-${qId}">
            <div class="question-header"><span class="q-badge">Q${questionCount}</span><button class="btn-remove" onclick="removeQuestion('${qId}')">Remove</button></div>
            <div class="form-group"><label>Question</label><input type="text" class="q-text" placeholder="Enter your question here...."></div>
            <div class="form-group"><label>Choices (Mark the correct answer)</label>
                <div class="choices">${['A', 'B', 'C', 'D'].map((c, i) => `
                    <div class="choice-item"><input type="radio" name="correct-${qId}" value="${i}" id="${qId}-opt-${i}"><span class="choice-label">${c}.</span><input type="text" class="q-choice" placeholder="Choice ${c}"></div>`).join('')}
                </div>
            </div>
            <div class="form-group"><label>Explanation (Show after Submit)</label><textarea class="q-exp" placeholder="Explain why the correct answer is right..."></textarea></div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

function removeQuestion(id) {
    const ok = confirm('Remove this question?');
    if (!ok) return;

    const block = document.getElementById(`block-${id}`);
    if (!block) return;

    block.remove();
    questionCount--;
    updateCounter();
}

function saveQuiz() {
    const title = document.getElementById('t-title').value.trim();
    const timer = document.getElementById('t-timer').value.trim();
    const errEl = document.getElementById('t-error');

    if (!title) {
        errEl.textContent = 'Quiz title is required.';
        errEl.classList.remove('hidden');
        return;
    }

    if (!/^\d{2}:\d{2}:\d{2}$/.test(timer)) {
        errEl.textContent = 'Timer must be in HH:MM:SS format.';
        errEl.classList.remove('hidden');
        return;
    }

    if (questionCount < MIN_Q) {
        errEl.textContent = `Minimum ${MIN_Q} questions required.`;
        errEl.classList.remove('hidden');
        return;
    }

    const questions = [];
    const blocks = document.querySelectorAll('.question-block');

    for (let b of blocks) {
        const qText = b.querySelector('.q-text').value.trim();
        const choices = Array.from(b.querySelectorAll('.q-choice')).map(i => i.value.trim());
        const correctRadio = b.querySelector('input[type="radio"]:checked');
        const exp = b.querySelector('.q-exp').value.trim();

        if (!qText || choices.some(c => !c) || !correctRadio || !exp) {
            errEl.textContent = 'Fill all fields, type choices, and select the correct answer.';
            errEl.classList.remove('hidden');
            return;
        }

        questions.push({
            text: qText,
            choices,
            correctIndex: parseInt(correctRadio.value),
            explanation: exp
        });
    }

    const quizzes = getQuizzes();

    if (editingQuizId) {
        const index = quizzes.findIndex(q => q.id === editingQuizId);
        if (index !== -1) {
            quizzes[index] = {
                ...quizzes[index],
                title,
                questions,
                timer,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        quizzes.push({
            id: Date.now().toString(),
            title,
            questions,
            timer,
            createdAt: new Date().toISOString()
        });
    }

    saveQuizzes(quizzes);
    alert(editingQuizId ? '✅ Quiz updated successfully!' : '✅ Quiz saved successfully!');
    resetTeacherForm();
    switchView('teacher-dashboard');
}

// STUDENT LOGIC
function renderQuizList() {
    const list = document.getElementById('s-list');
    const quizzes = getQuizzes();

    if (quizzes.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:3rem;"><p style="color:var(--gray-blue-v2);font-size:var(--fs-base-lg);">No quizzes available yet.</p></div>`;
        return;
    }

    list.innerHTML = quizzes.map(q => `
        <div class="quiz-list-item">
            <div class="quiz-info"><h3>${q.title}</h3><div class="quiz-meta">${q.questions.length} Questions</div></div>
            <button class="btn btn-primary" onclick="startQuiz('${q.id}')">Start Quiz →</button>
        </div>`).join('');
}

function startQuiz(id) {
    const quiz = getQuizzes().find(q => q.id === id);
    if (!quiz) return;

    currentQuizId = id;
    document.getElementById('q-title').textContent = quiz.title;
    document.getElementById('q-count').textContent = `${quiz.questions.length} Questions`;
    document.getElementById('total-count').textContent = quiz.questions.length;

    document.getElementById('q-container').innerHTML = quiz.questions.map((q, i) => `
        <article class="quiz-question-card">
            <div class="quiz-question-top">
                <span class="q-badge">Q${i + 1}</span>
                <div class="question-text">${q.text}</div>
            </div>

            <div class="answer-options">
                ${q.choices.map((c, idx) => `
                    <label class="answer-option">
                        <input type="radio" name="ans-${i}" value="${idx}" onchange="updateAnsweredCount()">
                        <span class="answer-letter">${String.fromCharCode(65 + idx)}.</span>
                        <span class="answer-text">${c}</span>
                    </label>
                `).join('')}
            </div>
        </article>
    `).join('');

    switchView('quiz');
    document.getElementById('q-error').classList.add('hidden');
    updateAnsweredCount();
    startQuizTimer(quiz.timer);
}

// Add New Quiz
function startNewQuiz() {
    editingQuizId = null;
    resetTeacherForm();
    switchView('teacher-create');
}

// Quiz Answering Logic
function updateAnsweredCount() {
    const quiz = getQuizzes().find(q => q.id === currentQuizId);
    if (!quiz) return;

    let answered = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
        if (document.querySelector(`input[name="ans-${i}"]:checked`)) answered++;
    }
    document.getElementById('answered-count').textContent = answered;
}

function submitQuiz(isAutoSubmit = false) {
    const quiz = getQuizzes().find(q => q.id === currentQuizId);
    if (!quiz) return;

    const answers = [];
    let allAnswered = true;

    for (let i = 0; i < quiz.questions.length; i++) {
        const selected = document.querySelector(`input[name="ans-${i}"]:checked`);
        if (!selected) {
            allAnswered = false;
            break;
        }
        answers.push(parseInt(selected.value));
    }

    // SKIP validation if auto-submitting from timer
    if (!isAutoSubmit && !allAnswered) {
        const errorEl = document.getElementById('q-error');
        errorEl.textContent = 'Please answer all questions before submitting.';
        errorEl.classList.remove('hidden');
        return;
    }

    // If auto-submit and not all answered, fill missing answers with -1 (unanswered indicator)
    if (isAutoSubmit && !allAnswered) {
        for (let i = 0; i < quiz.questions.length; i++) {
            if (!document.querySelector(`input[name="ans-${i}"]:checked`)) {
                answers[i] = -1;
            }
        }
    }

    let correct = 0;
    const reviewData = [];

    quiz.questions.forEach((q, i) => {
        const isCorrect = answers[i] === q.correctIndex;
        if (isCorrect) correct++;
        reviewData.push({
            qNum: i + 1,
            qText: q.text,
            userAns: answers[i] >= 0 ? q.choices[answers[i]] : '(Not answered)',
            correctAns: q.choices[q.correctIndex],
            isCorrect,
            explanation: q.explanation
        });
    });

    const percent = Math.round((correct / quiz.questions.length) * 100);
    const msg = percent >= 80 ? 'Excellent work! Keep it up! ' : percent >= 60 ? 'Good effort. Review the explanations below.' : 'Keep practicing. Review the feedback to improve.';

    document.getElementById('res-score').textContent = `${correct} / ${quiz.questions.length}`;
    document.getElementById('res-msg').textContent = msg;
    document.getElementById('res-detail').textContent = `You scored ${percent}% — ${correct} correct out of ${quiz.questions.length} questions.`;

    document.getElementById('res-container').innerHTML = reviewData.map(r => `
        <article class="review-item ${r.isCorrect ? 'review-correct' : 'review-incorrect'}">
            <div class="review-header">
                <div class="review-question-section">
                    <span class="q-badge">Q${r.qNum}</span>
                    <div class="review-question">${r.qText}</div>
                </div>
                <div class="review-status-badge ${r.isCorrect ? 'badge-correct' : 'badge-incorrect'}">
                    ${r.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </div>
            </div>

            <div class="result-choices-section">
                <p class="result-choices-label">Your choices:</p>
                <div class="result-choices">
                    ${Array.from({length: Object.keys(getQuizzes().find(q => q.id === currentQuizId).questions[r.qNum - 1].choices).length}, (_, idx) => {
                        const choice = getQuizzes().find(q => q.id === currentQuizId).questions[r.qNum - 1].choices[idx];
                        const isStudentChoice = getQuizzes().find(q => q.id === currentQuizId).questions[r.qNum - 1].choices.indexOf(r.userAns) === idx;
                        const isCorrect = getQuizzes().find(q => q.id === currentQuizId).questions[r.qNum - 1].choices.indexOf(r.correctAns) === idx;
                        
                        return `
                            <div class="result-choice-item ${isStudentChoice && !r.isCorrect ? 'student-wrong' : ''} ${isCorrect && !r.isCorrect ? 'correct-highlight' : ''} ${isCorrect && r.isCorrect ? 'student-correct' : ''}">
                                <span class="choice-letter">${String.fromCharCode(65 + idx)}.</span>
                                <span class="choice-content">${choice}</span>
                                ${isStudentChoice && !r.isCorrect ? '<span class="choice-marker">✗ Your Answer</span>' : ''}
                                ${isCorrect && !r.isCorrect ? '<span class="choice-marker">✓ Correct</span>' : ''}
                                ${isCorrect && r.isCorrect ? '<span class="choice-marker">✓ Your Answer</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="explanation-box">
                <strong>✴︎ Explanation: </strong>
                <p>${r.explanation}</p>
            </div>
        </article>
    `).join('');

    stopQuizTimer();
    switchView('results');
    window.scrollTo(0, 0);
}