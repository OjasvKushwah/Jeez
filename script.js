let timer;
let timeLeft;
let currentQuestionIndex = 0;
let answers = [];
let isTimerPaused = false;
let answeredQuestions = new Set();
let pdfDoc = null;
let currentZoom = 1.0;
let currentPage = 1;
let totalPages = 0;

const STORAGE_KEYS = {
    QUIZ_DATA: 'quizData',
    DAILY_STATS: 'dailyStats',
    WEEKLY_STATS: 'weeklyStats'
};

const STATS_KEYS = {
    DAILY: 'dailyStats',
    WEEKLY: 'weeklyStats',
    CHAPTER: 'chapterStats'
};

function getQuizKey(subject, chapter) {
    return `quiz_${subject}_${chapter}`.toLowerCase();
}

function loadExistingQuiz(subject, chapter) {
    const quizKey = getQuizKey(subject, chapter);
    return getFromStorage(quizKey);
}

function saveQuizState(subject, chapter) {
    const quizKey = getQuizKey(subject, chapter);
    const quizState = {
        subject,
        chapter,
        questionCount: answers.length,
        answers,
        answeredQuestions: Array.from(answeredQuestions),
        timestamp: new Date().toISOString()
    };
    saveToStorage(quizKey, quizState);
}

function toggleOtherSubject() {
    const subjectSelect = document.getElementById('subject');
    const otherSubject = document.getElementById('otherSubject');
    
    if (subjectSelect.value === 'other') {
        otherSubject.style.display = 'block';
    } else {
        otherSubject.style.display = 'none';
    }
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function startQuiz() {
    const subject = document.getElementById('subject').value;
    const otherSubject = document.getElementById('otherSubject').value;
    const chapter = document.getElementById('chapter').value;
    const questionCount = parseInt(document.getElementById('questionCount').value);

    // Validate inputs
    if (!subject) {
        alert('Please select a subject');
        return;
    }
    if (subject === 'other' && !otherSubject) {
        alert('Please enter the subject name');
        return;
    }
    if (!chapter) {
        alert('Please enter a chapter');
        return;
    }
    if (!questionCount || questionCount < 1) {
        alert('Please enter a valid number of questions');
        return;
    }

    const finalSubject = subject === 'other' ? otherSubject : subject;
    const existingQuiz = loadExistingQuiz(finalSubject, chapter);

    if (existingQuiz) {
        if (questionCount < existingQuiz.questionCount) {
            alert(`Cannot reduce question count. Previous count was ${existingQuiz.questionCount}`);
            document.getElementById('questionCount').value = existingQuiz.questionCount;
            return;
        }

        // Restore previous state
        answers = existingQuiz.answers;
        if (questionCount > existingQuiz.questionCount) {
            // Extend answers array if new count is higher
            answers = [...answers, ...new Array(questionCount - existingQuiz.questionCount).fill(null)];
        }
        answeredQuestions = new Set(existingQuiz.answeredQuestions);
        currentQuestionIndex = Array.from(answeredQuestions).pop() + 1 || 0;
        
        if (currentQuestionIndex >= answers.length) {
            currentQuestionIndex = 0; // Reset to start if all questions are answered
        }
    } else {
        // Initialize new quiz
        currentQuestionIndex = 0;
        answers = new Array(questionCount).fill(null);
        answeredQuestions = new Set();
    }

    // Show quiz container
    document.querySelector('.quiz-form').style.display = 'none';
    document.querySelector('.quiz-container').style.display = 'block';
    
    // Create navigation bubbles and show navigation
    createNavigationBubbles(answers.length);
    document.querySelector('.question-navigation').style.display = 'block';
    
    loadQuestion();

    // Save initial state
    saveQuizState(finalSubject, chapter);

    // Remove the warning when starting a new quiz
    window.onbeforeunload = null;

    adjustQuizLayout();
}

function createNavigationBubbles(count) {
    const bubblesContainer = document.getElementById('questionBubbles');
    bubblesContainer.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'question-bubble';
        bubble.textContent = i + 1;
        bubble.onclick = () => navigateToQuestion(i);
        bubblesContainer.appendChild(bubble);
    }
    updateBubbleStates();
}

function navigateToQuestion(index) {
    currentQuestionIndex = index;
    loadQuestion();
}

function startTimer() {
    clearInterval(timer);
    isTimerPaused = false;
    timeLeft = 0;
    updateTimerDisplay();
    
    timer = setInterval(() => {
        if (!isTimerPaused) {
            timeLeft++;
            updateTimerDisplay();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timerDisplay').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function selectOption(option) {
    // Don't allow selection if question is already answered
    if (answeredQuestions.has(currentQuestionIndex)) return;
    
    document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
    
    const selectedOption = document.querySelector(`#option${option.toUpperCase()}`).parentElement;
    selectedOption.classList.add('selected');
    selectedOption.querySelector('input[type="radio"]').checked = true;
    
    if (option === 'e') {
        document.getElementById('customAnswer').disabled = false;
    } else {
        document.getElementById('customAnswer').disabled = true;
    }
    
    isTimerPaused = true;
    document.getElementById('submitBtn').disabled = false;
}

function loadQuestion() {
    // Reset UI
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected', 'answered');
        opt.querySelector('input[type="radio"]').checked = false;
    });
    document.getElementById('customAnswer').value = '';
    document.getElementById('customAnswer').disabled = true;
    document.getElementById('submitBtn').disabled = true;

    // Update question text to show just the number
    document.getElementById('questionText').textContent = `Question ${currentQuestionIndex + 1}`;

    // Check if question was already answered
    if (answeredQuestions.has(currentQuestionIndex)) {
        // Show saved answer and time
        const savedAnswer = answers[currentQuestionIndex];
        const savedData = JSON.parse(localStorage.getItem('answersHistory') || '[]')
            .find(a => a.questionNumber === currentQuestionIndex + 1);
        
        if (savedAnswer) {
            if (savedAnswer.length > 1) { // Custom answer
                const customOption = document.querySelector('.custom-option');
                customOption.classList.add('selected', 'answered');
                document.getElementById('customAnswer').value = savedAnswer;
            } else {
                const selectedOption = document.querySelector(`#option${savedAnswer.toUpperCase()}`).parentElement;
                selectedOption.classList.add('selected', 'answered');
            }
        }
        
        // Show saved time
        if (savedData) {
            timeLeft = savedData.timeSpent;
            updateTimerDisplay();
        }
        
        // Disable all options and submit button
        document.querySelectorAll('.option').forEach(opt => {
            opt.classList.add('answered');
            opt.style.cursor = 'not-allowed';
        });
        document.getElementById('submitBtn').disabled = true;
        clearInterval(timer); // Stop timer for answered questions
    } else {
        // Enable all options
        document.querySelectorAll('.option').forEach(opt => {
            opt.style.cursor = 'pointer';
            opt.classList.remove('answered');
        });
        document.getElementById('submitBtn').disabled = false;
        startTimer(); // Start timer for unanswered questions
    }

    // Update question counter
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    document.getElementById('totalQuestions').textContent = answers.length;
    
    updateBubbleStates();
}

function updateBubbleStates() {
    const bubbles = document.querySelectorAll('.question-bubble');
    bubbles.forEach((bubble, index) => {
        bubble.classList.remove('current', 'answered');
        if (index === currentQuestionIndex) {
            bubble.classList.add('current');
        } else if (answeredQuestions.has(index)) {
            bubble.classList.add('answered');
        }
    });
}

function submitAnswer() {
    const selectedOption = document.querySelector('.option.selected');
    if (!selectedOption) return;
    
    const isCustomAnswer = selectedOption.querySelector('#optionE');
    const answer = isCustomAnswer ? 
        document.getElementById('customAnswer').value :
        selectedOption.querySelector('input').id.slice(-1);
    
    // Save answer
    answers[currentQuestionIndex] = answer;
    answeredQuestions.add(currentQuestionIndex);
    
    // Save time
    const answerData = {
        questionNumber: currentQuestionIndex + 1,
        answer: answer,
        timeSpent: timeLeft,
        timestamp: new Date().toISOString()
    };
    
    const answersHistory = JSON.parse(localStorage.getItem('answersHistory') || '[]');
    answersHistory.push(answerData);
    localStorage.setItem('answersHistory', JSON.stringify(answersHistory));
    
    // Disable options
    document.querySelectorAll('.option').forEach(opt => {
        opt.style.cursor = 'not-allowed';
    });
    document.getElementById('submitBtn').disabled = true;
    
    // Move to next unanswered question if available
    let nextUnanswered = currentQuestionIndex + 1;
    while (nextUnanswered < answers.length && answeredQuestions.has(nextUnanswered)) {
        nextUnanswered++;
    }
    
    if (nextUnanswered < answers.length) {
        currentQuestionIndex = nextUnanswered;
        loadQuestion();
    } else if (answeredQuestions.size === answers.length) {
        finishQuiz();
    }

    const subject = document.getElementById('subject').value;
    const otherSubject = document.getElementById('otherSubject').value;
    const finalSubject = subject === 'other' ? otherSubject : subject;
    const chapter = document.getElementById('chapter').value;
    saveQuizState(finalSubject, chapter);

    // Check if all questions are answered
    if (answeredQuestions.size === answers.length) {
        // Remove the warning when quiz is completed
        window.onbeforeunload = null;
    }
}

function finishQuiz() {
    alert('Quiz completed!');
    console.log('Answers:', answers);
}

function viewStats() {
    openStatisticsModal();
}

function getAnswerChecksKey(subject, chapter) {
    return `answerChecks_${subject}_${chapter}`.toLowerCase();
}

function checkAnswers() {
    const subject = document.getElementById('subject').value;
    const otherSubject = document.getElementById('otherSubject').value;
    const finalSubject = subject === 'other' ? otherSubject : subject;
    const chapter = document.getElementById('chapter').value;
    
    const modal = document.getElementById('answersModal');
    const answersList = document.getElementById('answersList');
    answersList.innerHTML = '';

    // Get saved answer checks for this specific subject and chapter
    const checksKey = getAnswerChecksKey(finalSubject, chapter);
    const savedChecks = JSON.parse(localStorage.getItem(checksKey) || '{}');

    Array.from(answeredQuestions).sort((a, b) => a - b).forEach(questionIndex => {
        const answer = answers[questionIndex];
        const savedCheck = savedChecks[questionIndex] || {
            result: 'correct',
            attempts: '1'
        };
        
        const answerItem = document.createElement('div');
        answerItem.className = 'answer-item';
        answerItem.innerHTML = `
            <div class="question-info">
                <strong>Question ${questionIndex + 1}</strong>
                <div>Selected: ${answer}</div>
            </div>
            <div class="answer-options">
                <select class="result-select" data-question="${questionIndex}">
                    <option value="correct" ${savedCheck.result === 'correct' ? 'selected' : ''}>Correct</option>
                    <option value="incorrect" ${savedCheck.result === 'incorrect' ? 'selected' : ''}>Incorrect</option>
                    <option value="discuss" ${savedCheck.result === 'discuss' ? 'selected' : ''}>Discuss</option>
                </select>
                <select class="attempts-select" data-question="${questionIndex}">
                    <option value="1" ${savedCheck.attempts === '1' ? 'selected' : ''}>1</option>
                    <option value="2" ${savedCheck.attempts === '2' ? 'selected' : ''}>2</option>
                    <option value="3+" ${savedCheck.attempts === '3+' ? 'selected' : ''}>3+</option>
                </select>
            </div>
            <div class="mark-question">
                <input type="checkbox" id="mark${questionIndex}" 
                    ${savedCheck.marked ? 'checked' : ''}>
                <label for="mark${questionIndex}">Mark</label>
            </div>
        `;
        answersList.appendChild(answerItem);
    });

    modal.style.display = 'flex';
}

function submitAnswerCheck() {
    // Validate that all questions have result and attempts selected
    let allValid = true;
    document.querySelectorAll('.answer-item').forEach(item => {
        const result = item.querySelector('.result-select').value;
        const attempts = item.querySelector('.attempts-select').value;
        
        if (!result || !attempts) {
            allValid = false;
        }
    });

    if (!allValid) {
        alert('Please select both result and attempts for all questions');
        return;
    }

    const subject = document.getElementById('subject').value;
    const otherSubject = document.getElementById('otherSubject').value;
    const finalSubject = subject === 'other' ? otherSubject : subject;
    const chapter = document.getElementById('chapter').value;
    const checksKey = getAnswerChecksKey(finalSubject, chapter);
    
    // Get existing checks to compare what's new
    const existingChecks = JSON.parse(localStorage.getItem(checksKey) || '{}');
    const checks = {};
    const answersHistory = JSON.parse(localStorage.getItem('answersHistory') || '[]');
    
    document.querySelectorAll('.answer-item').forEach(item => {
        const questionIndex = item.querySelector('.result-select').dataset.question;
        const result = item.querySelector('.result-select').value;
        const attempts = item.querySelector('.attempts-select').value;
        const marked = item.querySelector('input[type="checkbox"]').checked;

        const answerHistory = answersHistory.find(a => a.questionNumber === parseInt(questionIndex) + 1);
        const timeSpent = answerHistory ? answerHistory.timeSpent : 0;

        checks[questionIndex] = {
            result,
            attempts,
            marked,
            timeSpent,
            timestamp: new Date().toISOString()
        };

        // Only track stats if this is a new result or the result has changed
        const existingCheck = existingChecks[questionIndex];
        const isNewOrChanged = !existingCheck || 
                              existingCheck.result !== result || 
                              existingCheck.attempts !== attempts;

        if (result && isNewOrChanged) {
            trackAnswerStats({
                subject: finalSubject,
                chapter,
                result,
                attempts,
                timeSpent,
                questionIndex,
                // If there was a previous result, we need to subtract it
                previousResult: existingCheck ? existingCheck.result : null
            });
        }
    });

    localStorage.setItem(checksKey, JSON.stringify(checks));
    closeAnswersModal();
}

function closeAnswersModal() {
    document.getElementById('answersModal').style.display = 'none';
}

function trackAnswerStats(questionData) {
    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekNumber(new Date());
    
    // Update daily stats
    const dailyStats = JSON.parse(localStorage.getItem(STATS_KEYS.DAILY) || '{}');
    if (!dailyStats[today]) {
        dailyStats[today] = initializeStatsObject();
    }
    updateStatsObject(dailyStats[today], questionData);
    localStorage.setItem(STATS_KEYS.DAILY, JSON.stringify(dailyStats));

    // Update weekly stats
    const weeklyStats = JSON.parse(localStorage.getItem(STATS_KEYS.WEEKLY) || '{}');
    if (!weeklyStats[currentWeek]) {
        weeklyStats[currentWeek] = initializeStatsObject();
    }
    updateStatsObject(weeklyStats[currentWeek], questionData);
    localStorage.setItem(STATS_KEYS.WEEKLY, JSON.stringify(weeklyStats));

    // Update chapter stats
    const chapterKey = `${questionData.subject}_${questionData.chapter}`;
    const chapterStats = JSON.parse(localStorage.getItem(STATS_KEYS.CHAPTER) || '{}');
    if (!chapterStats[chapterKey]) {
        chapterStats[chapterKey] = initializeStatsObject();
    }
    updateStatsObject(chapterStats[chapterKey], questionData);
    localStorage.setItem(STATS_KEYS.CHAPTER, JSON.stringify(chapterStats));
}

function initializeStatsObject() {
    return {
        total: 0,
        correct: 0,
        incorrect: 0,
        discuss: 0,
        totalTime: 0,
        bySubject: {}
    };
}

function updateStatsObject(stats, questionData) {
    if (!stats) return;
    
    stats.total = stats.total || 0;
    stats.correct = stats.correct || 0;
    stats.incorrect = stats.incorrect || 0;
    stats.discuss = stats.discuss || 0;
    stats.totalTime = stats.totalTime || 0;
    stats.bySubject = stats.bySubject || {};

    stats.total++;
    stats.totalTime += questionData.timeSpent || 0;

    // Initialize subject stats if needed
    const subject = questionData.subject || 'Unknown';
    if (!stats.bySubject[subject]) {
        stats.bySubject[subject] = {
            total: 0,
            correct: 0,
            incorrect: 0,
            discuss: 0,
            totalTime: 0
        };
    }

    const subjectStats = stats.bySubject[subject];
    subjectStats.total++;
    subjectStats.totalTime += questionData.timeSpent || 0;

    // Update result counts
    if (questionData.result === 'correct') {
        stats.correct++;
        subjectStats.correct++;
    } else if (questionData.result === 'incorrect') {
        stats.incorrect++;
        subjectStats.incorrect++;
    } else if (questionData.result === 'discuss') {
        stats.discuss++;
        subjectStats.discuss++;
    }
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function toggleQuiz() {
    const quizContainer = document.querySelector('.quiz-container');
    const toggleBtn = document.querySelector('.toggle-quiz-btn');
    
    quizContainer.classList.toggle('hidden');
    // Use HTML entities for arrows
    toggleBtn.innerHTML = quizContainer.classList.contains('hidden') ? '&#9654;' : '&#9664;';
}

function toggleNavigation() {
    const navigation = document.querySelector('.question-navigation');
    const toggleBtn = document.querySelector('.nav-toggle-btn');
    
    navigation.classList.toggle('hidden');
    // Use HTML entities for arrows
    toggleBtn.innerHTML = navigation.classList.contains('hidden') ? '&#9650;' : '&#9660;';
}

function togglePdfControls() {
    const controls = document.querySelector('.pdf-controls');
    const toggleBtn = document.querySelector('.pdf-toggle-btn');
    controls.classList.toggle('hidden');
    toggleBtn.textContent = controls.classList.contains('hidden') ? '▶' : '◀';
}

async function loadPDF(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const typedarray = new Uint8Array(e.target.result);
            pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
            totalPages = pdfDoc.numPages;
            currentPage = 1;
            renderPage(currentPage);
        };
        reader.readAsArrayBuffer(file);
    }
}

async function renderPage(pageNumber) {
    if (!pdfDoc) return;
    
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: currentZoom });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.innerHTML = '';
    pdfViewer.appendChild(canvas);
    
    await page.render(renderContext).promise;
}

function zoomIn() {
    currentZoom += 0.2;
    if (pdfDoc) renderPage(1);
}

function zoomOut() {
    currentZoom = Math.max(0.2, currentZoom - 0.2);
    if (pdfDoc) renderPage(1);
}

async function previousPage() {
    if (!pdfDoc || currentPage <= 1) return;
    currentPage--;
    renderPage(currentPage);
}

async function nextPage() {
    if (!pdfDoc || currentPage >= totalPages) return;
    currentPage++;
    renderPage(currentPage);
}

window.onbeforeunload = function(e) {
    // Check if quiz is in progress (has answers but not all questions answered)
    if (answers.length > 0 && answeredQuestions.size < answers.length) {
        // Cancel the event
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = 'You have an ongoing quiz. Are you sure you want to leave?';
        return e.returnValue;
    }
};

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function calculateAverageTime(stats) {
    if (!stats || !stats.totalTime || !stats.total) {
        console.log('Invalid stats for avg time calc:', stats);
        return 0;
    }
    
    // Get count of questions with results (correct, incorrect, or discuss)
    const answeredCount = (stats.correct || 0) + (stats.incorrect || 0) + (stats.discuss || 0);
    if (answeredCount === 0) {
        console.log('No answered questions for avg time calc');
        return 0;
    }

    // Add detailed logging
    console.log('Average Time Calculation:', {
        totalTimeInSeconds: stats.totalTime,
        answeredQuestions: answeredCount,
        correct: stats.correct,
        incorrect: stats.incorrect,
        discuss: stats.discuss
    });

    // Convert to minutes and round to 1 decimal place
    return Math.round((stats.totalTime / answeredCount / 60) * 10) / 10;
}

function adjustQuizLayout() {
    const quizContainer = document.querySelector('.quiz-container');
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = window.innerWidth <= 1024;
    
    // Reset any previous styles
    quizContainer.style.width = '';
    document.querySelector('.options-container').style.display = 'flex';
    document.querySelector('.options-container').style.flexDirection = 'column';
    document.querySelector('.quiz-buttons').style.display = 'flex';
    document.querySelector('.quiz-buttons').style.flexDirection = 'column';
    
    if (isMobile && isLandscape) {
        // Calculate available width (25% of screen width, but not less than 300px)
        const containerWidth = Math.max(300, window.innerWidth * 0.25);
        quizContainer.style.width = `${containerWidth}px`;
        
        // Scale font sizes and padding based on container width
        const scale = containerWidth / 400;
        document.documentElement.style.setProperty('--quiz-scale', scale);
    } else {
        // Desktop or mobile portrait mode
        quizContainer.style.width = '400px';
        document.documentElement.style.setProperty('--quiz-scale', '1');
    }
}

// Add event listeners for layout changes
window.addEventListener('load', adjustQuizLayout);
window.addEventListener('resize', adjustQuizLayout);
window.addEventListener('orientationchange', adjustQuizLayout);
 