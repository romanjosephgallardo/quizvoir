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

// handles pressing Back to home while taking quiz
function goBack() {
    const currentView = viewHistory[viewHistory.length - 1];

    if (currentView === 'quiz') {
        if (!confirm('You have unsaved progress in this quiz. If you go back your answers will be lost. Continue?')) return;
    }

    if (currentView === 'results') {
        switchView('role');
        return;
    }

    if (viewHistory.length > 1) {
        viewHistory.pop();
        switchView(viewHistory[viewHistory.length - 1]);
    } else {
        switchView('role');
    }
}

function handleLogoClick() {
    const currentView = viewHistory[viewHistory.length - 1];
    if (currentView === 'quiz') {
        const ok = confirm('You have unsaved progress in this quiz. If you go back your answers will be lost. Continue?');
        if (!ok) return;
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
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;
    let quizzes = getQuizzes();
    quizzes = quizzes.filter(q => q.id !== id);
    saveQuizzes(quizzes);
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
    document.getElementById(`block-${id}`).remove();
    questionCount--;
    updateCounter();
}

function saveQuiz() {
    const title = document.getElementById('t-title').value.trim();
    const errEl = document.getElementById('t-error');

    if (!title) {
        errEl.textContent = 'Quiz title is required.';
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

    let quizzes = getQuizzes();

    if (editingQuizId) {
        const index = quizzes.findIndex(q => q.id === editingQuizId);
        if (index !== -1) {
            quizzes[index] = { ...quizzes[index], title, questions, updatedAt: new Date().toISOString() };
        }
    } else {
        quizzes.push({ id: Date.now().toString(), title, questions, createdAt: new Date().toISOString() });
    }

    const timer = document.getElementById('t-timer').value.trim();

    if (!/^\d{2}:\d{2}:\d{2}$/.test(timer)) {
        errEl.textContent = 'Timer must be in HH:MM:SS format.';
        errEl.classList.remove('hidden');
        return;
    }

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
}

// Add New Quiz
function startNewQuiz() {
    editingQuizId = null;
    resetTeacherForm();
    switchView('teacher-create');
}

function updateAnsweredCount() {
    const quiz = getQuizzes().find(q => q.id === currentQuizId);
    if (!quiz) return;

    let answered = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
        if (document.querySelector(`input[name="ans-${i}"]:checked`)) answered++;
    }
    document.getElementById('answered-count').textContent = answered;
}

function submitQuiz() {
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

    if (!allAnswered) {
        const errorEl = document.getElementById('q-error');
        errorEl.textContent = 'Please answer all questions before submitting.';
        errorEl.classList.remove('hidden');
        return;
    }

    let correct = 0;
    const reviewData = [];

    quiz.questions.forEach((q, i) => {
        const isCorrect = answers[i] === q.correctIndex;
        if (isCorrect) correct++;
        reviewData.push({
            qNum: i + 1,
            qText: q.text,
            userAns: q.choices[answers[i]],
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

    switchView('results');
    window.scrollTo(0, 0);
}