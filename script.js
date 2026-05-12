// Global state variables for quiz management
let currentQuizId = null; 
let editingQuizId = null; 
let questionCount = 0;
let viewHistory = ['role'];
const MAX_Q = 10, MIN_Q = 5; 

// Load quizzes from localStorage with fallback to empty array
const getQuizzes = () => JSON.parse(localStorage.getItem('qv_quizzes') || '[]');
// Save quizzes array to localStorage as JSON string
const saveQuizzes = (data) => localStorage.setItem('qv_quizzes', JSON.stringify(data));

// Initialize app by switching to role selection view on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    switchView('role');
});

// === QUIZ TIMER LOGIC ===
let quizTimerInterval = null; // Interval ID for timer countdown
let quizTimeTotal = 0; // Total quiz duration in seconds
let quizTimeLeft = 0; // Remaining time in seconds

// Convert HH:MM:SS string to total seconds for timer calculation
function parseTimeToSeconds(timeString) {
    const parts = timeString.split(':').map(Number);
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
}

// Format total seconds back to HH:MM:SS string with zero-padding
function formatSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

// Clear timer interval and reset interval reference
function stopQuizTimer() {
    if (quizTimerInterval) {
        clearInterval(quizTimerInterval);
        quizTimerInterval = null;
    }
}

// Update timer display text and progress bar width based on remaining time
function updateQuizTimerUI() {
    const timeLeftEl = document.getElementById('time-left');
    const progressFill = document.getElementById('time-progress-fill');
    if (!timeLeftEl || !progressFill || quizTimeTotal <= 0) return;
    timeLeftEl.textContent = formatSeconds(quizTimeLeft);
    const percentUsed = Math.max(0, Math.min(100, ((quizTimeTotal - quizTimeLeft) / quizTimeTotal) * 100));
    progressFill.style.width = `${percentUsed}%`;
    // Add warning style when 30 seconds or less remain
    if (quizTimeLeft <= 30) {
        progressFill.classList.add('time-low');
    } else {
        progressFill.classList.remove('time-low');
    }
}

// Initialize and start countdown timer with given duration string
function startQuizTimer(durationString) {
    stopQuizTimer(); // Clear any existing timer first
    quizTimeTotal = parseTimeToSeconds(durationString || '00:00:00');
    quizTimeLeft = quizTimeTotal;
    updateQuizTimerUI(); // Set initial display
    // Start 1-second interval for countdown
    quizTimerInterval = setInterval(() => {
        quizTimeLeft -= 1;
        if (quizTimeLeft <= 0) {
            quizTimeLeft = 0;
            updateQuizTimerUI();
            stopQuizTimer();
            submitQuiz(true); // Auto-submit when time expires
            return;
        }
        updateQuizTimerUI();
    }, 1000);
}

// === VIEW NAVIGATION ===
// Switch visible section and update header/back button state
function switchView(view) {
    // Hide all sections, then show target view
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    const header = document.querySelector('.header');
    const roleBadge = document.getElementById('role-badge');
    const backBtn = document.getElementById('back-btn');
    const roleText = document.getElementById('role-text');
    // Hide header only on role selection screen
    header.classList.toggle('hidden', view === 'role');
    // Stop timer when leaving quiz view
    if (view !== 'quiz') stopQuizTimer();
    // Reset navigation history on role view
    if (view === 'role') {
        roleBadge.classList.add('hidden');
        backBtn.classList.add('hidden');
        viewHistory = ['role'];
    } else if (['student', 'teacher-dashboard', 'teacher-create'].includes(view)) {
        roleBadge.classList.remove('hidden');
        backBtn.classList.remove('hidden');
        roleText.textContent = view.includes('teacher') ? 'Teacher' : 'Student';
        viewHistory.push(view); // Track view for back navigation
    }
    // Trigger view-specific render functions
    if (view === 'student') renderQuizList();
    if (view === 'teacher-dashboard') renderTeacherDashboard();
    if (view === 'teacher-create' && !editingQuizId) resetTeacherForm();
}

// === FORM CHANGE CONFIRMATION ===
// Check if teacher form has unsaved changes and confirm before leaving
function confirmLeaveTeacherForm() {
    const isEditing = Boolean(editingQuizId);
    const title = document.getElementById('t-title')?.value.trim() || '';
    const timer = document.getElementById('t-timer')?.value.trim() || '00:00:00';
    const questionBlocks = document.querySelectorAll('.question-block').length;
    const hasQuestionContent = Array.from(
        document.querySelectorAll('#t-questions input[type="text"], #t-questions textarea')
    ).some(el => el.value.trim() !== '');
    // Detect any form modifications
    const hasChanges = title !== '' || timer !== '00:00:00' || questionBlocks > 0 || hasQuestionContent;
    if (!hasChanges) return true; // No changes = safe to leave
    // Show context-aware confirmation message
    const message = isEditing
        ? 'You have unsaved changes while editing this quiz. Discard changes and go back?'
        : 'Cancel creating this quiz and go back?';
    if (!confirm(message)) return false; // User cancelled
    resetTeacherForm(); // Clear form on confirm
    return true;
}

// Handle cancel button: confirm discard then return to dashboard
function handleTeacherCancel() {
    if (!confirmLeaveTeacherForm()) return;
    switchView('teacher-dashboard');
}

// Handle back button with guards for unsaved quiz/progress
function goBack() {
    const currentView = viewHistory[viewHistory.length - 1] || 'role';
    // Guard: confirm before leaving teacher form with changes
    if (currentView === 'teacher-create' && !confirmLeaveTeacherForm()) return;
    // Guard: confirm before abandoning active quiz
    if (currentView === 'quiz') {
        const ok = confirm('You have unsaved progress in this quiz. If you go back your answers will be lost. Continue?');
        if (!ok) return;
        stopQuizTimer();
        currentQuizId = null;
    }
    // Results view always returns to student quiz list
    if (currentView === 'results') {
        stopQuizTimer();
        currentQuizId = null;
        switchView('student');
        return;
    }
    // Pop history stack for normal back navigation
    if (viewHistory.length > 1) {
        viewHistory.pop();
        const previousView = viewHistory[viewHistory.length - 1] || 'role';
        switchView(previousView);
        return;
    }
    switchView('role'); // Fallback to role selection
}

// Handle logo click: confirm if in quiz, then go to role selection
function handleLogoClick() {
    const currentView = viewHistory[viewHistory.length - 1];
    if (currentView === 'quiz') {
        const ok = confirm('You have unsaved progress in this quiz. If you go back your answers will be lost. Continue?');
        if (!ok) return;
        stopQuizTimer();
    }
    switchView('role');
}

// === TEACHER DASHBOARD ===
// Render quiz list with stats and action buttons for teacher
function renderTeacherDashboard() {
    const quizzes = getQuizzes();
    const container = document.getElementById('teacher-quiz-list');
    document.getElementById('total-quizzes').textContent = quizzes.length;
    // Calculate total questions across all quizzes
    const totalQ = quizzes.reduce((sum, q) => sum + q.questions.length, 0);
    document.getElementById('total-questions').textContent = totalQ;
    // Show empty state if no quizzes exist
    if (quizzes.length === 0) {
        container.innerHTML = `<p style="text-align: center; padding: 3rem; color: var(--gray-blue-v2);">No quizzes created yet. Click "Create New Quiz" to start!</p>`;
        return;
    }
    // Generate HTML for each quiz with edit/delete actions
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
                    <button class="btn btn-danger btn-small" onclick="deleteQuiz('${q.id}')">🗑 Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Delete quiz after confirmation and refresh dashboard
function deleteQuiz(id) {
    const quizzes = getQuizzes();
    const targetQuiz = quizzes.find(q => q.id === id);
    if (!targetQuiz) {
        alert('Quiz not found.');
        return;
    }
    // Confirm destructive action with quiz title
    const ok = confirm(`Delete quiz "${targetQuiz.title}"?\n\nThis action cannot be undone.`);
    if (!ok) return;
    // Filter out deleted quiz and save updated list
    const updated = quizzes.filter(q => q.id !== id);
    saveQuizzes(updated);
    renderTeacherDashboard();
}

// Load quiz data into form for editing
function editQuiz(id) {
    const quiz = getQuizzes().find(q => q.id === id);
    if (!quiz) return;
    editingQuizId = id; // Set edit mode flag
    document.getElementById('form-title').textContent = 'Edit Quiz';
    document.getElementById('t-title').value = quiz.title;
    document.getElementById('t-timer').value = quiz.timer || '00:00:00';
    const container = document.getElementById('t-questions');
    container.innerHTML = '';
    questionCount = 0;
    // Rebuild form fields for each existing question
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

// === TEACHER CREATE/EDIT FORM ===
// Reset form to initial empty state for new quiz creation
function resetTeacherForm() {
    editingQuizId = null;
    document.getElementById('form-title').textContent = 'Create a Quiz';
    document.getElementById('t-title').value = '';
    document.getElementById('t-questions').innerHTML = '';
    document.getElementById('t-timer').value = '00:00:00';
    questionCount = 0;
    updateCounter();
}

// Update question counter display and hide error message
function updateCounter() {
    document.getElementById('t-count').textContent = questionCount;
    document.getElementById('t-error').classList.add('hidden');
}

// Add new blank question block if under max limit
function addQuestion() {
    if (questionCount >= MAX_Q) {
        alert('Maximum 10 questions allowed.');
        return;
    }
    questionCount++;
    updateCounter();
    const container = document.getElementById('t-questions');
    const qId = `q-${Date.now()}`;
    // Generate HTML for new question with 4 choice inputs
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

// Remove question block after confirmation and update counter
function removeQuestion(id) {
    const ok = confirm('Remove this question?');
    if (!ok) return;
    const block = document.getElementById(`block-${id}`);
    if (!block) return;
    block.remove();
    questionCount--;
    updateCounter();
}

// Validate form and save quiz to localStorage (create or update)
function saveQuiz() {
    const title = document.getElementById('t-title').value.trim();
    const timer = document.getElementById('t-timer').value.trim();
    const errEl = document.getElementById('t-error');
    // Validate required title field
    if (!title) {
        errEl.textContent = 'Quiz title is required.';
        errEl.classList.remove('hidden');
        return;
    }
    // Validate timer format HH:MM:SS
    if (!/^\d{2}:\d{2}:\d{2}$/.test(timer)) {
        errEl.textContent = 'Timer must be in HH:MM:SS format.';
        errEl.classList.remove('hidden');
        return;
    }
    // Enforce minimum question count
    if (questionCount < MIN_Q) {
        errEl.textContent = `Minimum ${MIN_Q} questions required.`;
        errEl.classList.remove('hidden');
        return;
    }
    const questions = [];
    const blocks = document.querySelectorAll('.question-block');
    // Collect and validate each question's data
    for (let b of blocks) {
        const qText = b.querySelector('.q-text').value.trim();
        const choices = Array.from(b.querySelectorAll('.q-choice')).map(i => i.value.trim());
        const correctRadio = b.querySelector('input[type="radio"]:checked');
        const exp = b.querySelector('.q-exp').value.trim();
        // Ensure all fields filled and correct answer selected
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
    // Update existing quiz or create new one
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

// === STUDENT QUIZ LOGIC ===
// Render available quizzes list for student view
function renderQuizList() {
    const list = document.getElementById('s-list');
    const quizzes = getQuizzes();
    // Show empty state if no quizzes available
    if (quizzes.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:3rem;"><p style="color:var(--gray-blue-v2);font-size:var(--fs-base-lg);">No quizzes available yet.</p></div>`;
        return;
    }
    // Generate quiz cards with start buttons
    list.innerHTML = quizzes.map(q => `
        <div class="quiz-list-item">
            <div class="quiz-info"><h3>${q.title}</h3><div class="quiz-meta">${q.questions.length} Questions</div></div>
            <button class="btn btn-primary" onclick="startQuiz('${q.id}')">Start Quiz →</button>
        </div>`).join('');
}

// Load quiz questions and start timer for student attempt
function startQuiz(id) {
    const quiz = getQuizzes().find(q => q.id === id);
    if (!quiz) return;
    currentQuizId = id; // Track active quiz
    document.getElementById('q-title').textContent = quiz.title;
    document.getElementById('q-count').textContent = `${quiz.questions.length} Questions`;
    document.getElementById('total-count').textContent = quiz.questions.length;
    // Render each question with radio button choices
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
    updateAnsweredCount(); // Initialize progress counter
    startQuizTimer(quiz.timer); // Begin countdown
}

// Reset form and switch to teacher create view for new quiz
function startNewQuiz() {
    editingQuizId = null;
    resetTeacherForm();
    switchView('teacher-create');
}

// Update answered count display as student selects answers
function updateAnsweredCount() {
    const quiz = getQuizzes().find(q => q.id === currentQuizId);
    if (!quiz) return;
    let answered = 0;
    // Count checked radio buttons across all questions
    for (let i = 0; i < quiz.questions.length; i++) {
        if (document.querySelector(`input[name="ans-${i}"]:checked`)) answered++;
    }
    document.getElementById('answered-count').textContent = answered;
}

// Validate answers, calculate score, and show results page
function submitQuiz(isAutoSubmit = false) {
    const quiz = getQuizzes().find(q => q.id === currentQuizId);
    if (!quiz) return;
    const answers = [];
    let allAnswered = true;
    // Collect selected answer indices
    for (let i = 0; i < quiz.questions.length; i++) {
        const selected = document.querySelector(`input[name="ans-${i}"]:checked`);
        if (!selected) {
            allAnswered = false;
            break;
        }
        answers.push(parseInt(selected.value));
    }
    // Block manual submit if questions unanswered (skip for auto-submit)
    if (!isAutoSubmit && !allAnswered) {
        const errorEl = document.getElementById('q-error');
        errorEl.textContent = 'Please answer all questions before submitting.';
        errorEl.classList.remove('hidden');
        return;
    }
    // Mark unanswered as -1 for auto-submit scenario
    if (isAutoSubmit && !allAnswered) {
        for (let i = 0; i < quiz.questions.length; i++) {
            if (!document.querySelector(`input[name="ans-${i}"]:checked`)) {
                answers[i] = -1;
            }
        }
    }
    // Calculate score and build review data
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
    // Generate feedback message based on score percentage
    const percent = Math.round((correct / quiz.questions.length) * 100);
    const msg = percent >= 80 ? 'Excellent work! Keep it up! ' : percent >= 60 ? 'Good effort. Review the explanations below.' : 'Keep practicing. Review the feedback to improve.';
    // Populate results page with score and review items
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
    stopQuizTimer(); // Clear timer before showing results
    switchView('results');
    window.scrollTo(0, 0); // Reset scroll position
}