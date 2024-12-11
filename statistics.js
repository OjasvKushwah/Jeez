// Add Chart.js CDN in index.html first:
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

let currentCharts = {
    daily: [],
    weekly: [],
    chapter: []
};

let currentDate = new Date();
let currentWeek = getWeekNumber(new Date());
let isProcessingDateChange = false;

function openStatisticsModal() {
    // Remove any existing streak cards before opening modal
    removeStreakCards();
    
    document.getElementById('statisticsModal').style.display = 'flex';
    currentDate = new Date();
    currentWeek = getWeekNumber(new Date());
    isProcessingDateChange = false; // Reset the flag
    updateDateDisplay();
    updateNavigationButtons();
    switchTab('daily');
}

function closeStatisticsModal() {
    document.getElementById('statisticsModal').style.display = 'none';
}

function switchTab(tab) {
    // Remove any existing streak cards first
    removeStreakCards();
    
    document.querySelectorAll('.stats-content').forEach(content => {
        content.style.display = 'none';
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tab}Stats`).style.display = 'block';
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    
    // Show/hide date selectors based on tab
    const dailyDateSelector = document.querySelector('.date-selector.daily-selector');
    const weeklyDateSelector = document.querySelector('.date-selector.weekly-selector');
    
    if (dailyDateSelector && weeklyDateSelector) {
        dailyDateSelector.style.display = tab === 'daily' ? 'flex' : 'none';
        weeklyDateSelector.style.display = tab === 'weekly' ? 'flex' : 'none';
    }

    // Handle different tab loads without calling loadDailyStats directly
    if (tab === 'daily') {
        currentDate = new Date();
        updateDateDisplay();
        updateNavigationButtons();
        // Instead of calling loadDailyStats, update stats display directly
        const dateStr = currentDate.toISOString().split('T')[0];
        const dailyStats = JSON.parse(localStorage.getItem(STATS_KEYS.DAILY) || '{}');
        const stats = dailyStats[dateStr] || initializeStatsObject();
        
        updateStatsDisplay(stats, 'daily');
        createCharts(stats, 'daily');
        
        // Only display streak cards if we're on today's date
        if (dateStr === new Date().toISOString().split('T')[0]) {
            displayStreakCards(stats, dailyStats);
        }
    } else if (tab === 'weekly') {
        currentWeek = getWeekNumber(new Date());
        updateDateDisplay();
        updateNavigationButtons();
        loadWeeklyStats();
    } else if (tab === 'chapter') {
        loadChapterStats();
    }
}

function loadStatistics(period) {
    const stats = calculateStats(period);
    if (stats) {
        updateStatsDisplay(stats, period);
        createCharts(stats, period);
    }
}

function calculateStats(period, selectedDate) {
    let stats = initializeStatsObject();
    
    try {
        if (period === 'daily') {
            const dailyStats = JSON.parse(localStorage.getItem(STATS_KEYS.DAILY) || '{}');
            if (dailyStats[selectedDate]) {
                stats = { ...stats, ...dailyStats[selectedDate] };
            }
        } else if (period === 'weekly') {
            const weeklyStats = JSON.parse(localStorage.getItem(STATS_KEYS.WEEKLY) || '{}');
            if (weeklyStats[selectedDate]) {
                stats = { ...stats, ...weeklyStats[selectedDate] };
            }
        }
    } catch (error) {
        console.error('Error calculating stats:', error);
        return stats;
    }

    return {
        ...stats,
        accuracy: calculateAccuracy(stats),
        avgTime: calculateAverageTime(stats)
    };
}

function calculateAccuracy(stats) {
    if (!stats || stats.correct + stats.incorrect === 0) return 0;
    return Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100);
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

    // Convert to minutes (time is already in seconds, just divide by 60)
    const avgTimeInMinutes = (stats.totalTime / 60) / answeredCount;
    console.log('Time calculation:', {
        totalTime: stats.totalTime,
        answeredCount,
        avgTimeInMinutes
    });
    return Math.round(avgTimeInMinutes * 10) / 10;
}

function updateStatsObject(stats, questionData) {
    if (!stats || !questionData.result) return;
    
    // If there was a previous result, subtract it first
    if (questionData.previousResult) {
        if (questionData.previousResult === 'correct') {
            stats.correct = (stats.correct || 0) - 1;
        } else if (questionData.previousResult === 'incorrect') {
            stats.incorrect = (stats.incorrect || 0) - 1;
        } else if (questionData.previousResult === 'discuss') {
            stats.discuss = (stats.discuss || 0) - 1;
        }
        // Don't subtract from total since we're updating the same question
    } else {
        // Only increment total for new questions
        stats.total = (stats.total || 0) + 1;
    }
    
    // Add time only when checking answers (when result is present)
    if (questionData.result && questionData.timeSpent) {
        stats.totalTime = (stats.totalTime || 0) + (questionData.timeSpent || 0);
    }
    
    // Add the new result
    if (questionData.result === 'correct') {
        stats.correct = (stats.correct || 0) + 1;
    } else if (questionData.result === 'incorrect') {
        stats.incorrect = (stats.incorrect || 0) + 1;
    } else if (questionData.result === 'discuss') {
        stats.discuss = (stats.discuss || 0) + 1;
    }

    // Update subject stats similarly
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
    
    // Handle previous result for subject stats
    if (questionData.previousResult) {
        if (questionData.previousResult === 'correct') {
            subjectStats.correct--;
        } else if (questionData.previousResult === 'incorrect') {
            subjectStats.incorrect--;
        } else if (questionData.previousResult === 'discuss') {
            subjectStats.discuss--;
        }
    } else {
        subjectStats.total++;
    }
    
    // Add time to subject stats only when checking answers
    if (questionData.result && questionData.timeSpent) {
        subjectStats.totalTime = (subjectStats.totalTime || 0) + (questionData.timeSpent || 0);
    }

    // Add new result to subject stats
    if (questionData.result === 'correct') {
        subjectStats.correct++;
    } else if (questionData.result === 'incorrect') {
        subjectStats.incorrect++;
    } else if (questionData.result === 'discuss') {
        subjectStats.discuss++;
    }
}

function updateStatsDisplay(stats, period) {
    if (!stats) return;

    document.getElementById(`${period}Total`).textContent = stats.total || 0;
    document.getElementById(`${period}Correct`).textContent = stats.correct || 0;
    document.getElementById(`${period}Incorrect`).textContent = stats.incorrect || 0;
    document.getElementById(`${period}Accuracy`).textContent = `${calculateAccuracy(stats)}%`;
    
    const avgTime = calculateAverageTime(stats);
    document.getElementById(`${period}AvgTime`).textContent = `${avgTime}m`;

    // Add streak calculation for daily stats
    if (period === 'daily') {
        const dailyTotal = stats.total || 0;
        const currentStreak = Math.floor(dailyTotal / 50);
        
        // Remove existing streak card if it exists
        const existingStreakCard = document.querySelector('.streak-card');
        if (existingStreakCard) {
            existingStreakCard.remove();
        }
        
        // Create new streak card
        const streakCard = document.createElement('div');
        streakCard.className = 'streak-card';
        streakCard.innerHTML = `
            <div class="streak-content">
                <h3 class="streak-title">Daily Streak</h3>
                <div class="streak-number">${currentStreak}</div>
                <div class="streak-label">Questions until next streak: ${50 - (dailyTotal % 50)}</div>
                <span class="streak-icon">🔥</span>
            </div>
        `;
        
        // Insert streak card at the beginning of stats overview
        const statsOverview = document.querySelector('.stats-overview');
        if (statsOverview.firstChild) {
            statsOverview.insertBefore(streakCard, statsOverview.firstChild);
        } else {
            statsOverview.appendChild(streakCard);
        }
    }

    // Update subject-wise stats
    const subjectStatsContainer = document.getElementById(`${period}SubjectStats`);
    subjectStatsContainer.innerHTML = '';

    if (stats.bySubject) {
        Object.entries(stats.bySubject).forEach(([subject, subjectStats]) => {
            if (subjectStats && subjectStats.total > 0) {
                const accuracy = calculateAccuracy(subjectStats);
                const avgTime = calculateAverageTime(subjectStats);

                const subjectCard = document.createElement('div');
                subjectCard.className = 'subject-card';
                subjectCard.innerHTML = `
                    <h3>${subject}</h3>
                    <div class="subject-stats-grid">
                        <div>Total: ${subjectStats.total || 0}</div>
                        <div>Correct: ${subjectStats.correct || 0}</div>
                        <div>Incorrect: ${subjectStats.incorrect || 0}</div>
                        <div>Accuracy: ${accuracy}%</div>
                        <div>Avg Time: ${avgTime}m</div>
                    </div>
                `;
                subjectStatsContainer.appendChild(subjectCard);
            }
        });
    }
}

function createCharts(stats, period) {
    // Destroy existing charts
    if (currentCharts[period]) {
        currentCharts[period].forEach(chart => chart.destroy());
    }
    currentCharts[period] = [];

    // Create new charts
    currentCharts[period] = [
        createPieChart(stats, period),
        createSubjectChart(stats, period)
    ];
}

function createPieChart(stats, period) {
    const ctx = document.getElementById(`${period}PieChart`).getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Correct', 'Incorrect', 'Discuss'],
            datasets: [{
                data: [stats.correct, stats.incorrect, stats.discuss],
                backgroundColor: ['#4CAF50', '#f44336', '#2196F3']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Question Results Distribution'
                }
            }
        }
    });
    return chart;
}

function createSubjectChart(stats, period) {
    const ctx = document.getElementById(`${period}SubjectChart`).getContext('2d');
    const subjects = Object.keys(stats.bySubject);
    const correctData = subjects.map(subject => stats.bySubject[subject].correct);
    const incorrectData = subjects.map(subject => stats.bySubject[subject].incorrect);

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: subjects,
            datasets: [
                {
                    label: 'Correct',
                    data: correctData,
                    backgroundColor: '#4CAF50'
                },
                {
                    label: 'Incorrect',
                    data: incorrectData,
                    backgroundColor: '#f44336'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Subject-wise Performance'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true
                },
                x: {
                    stacked: true
                }
            }
        }
    });
    return chart;
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

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function loadChapterStats() {
    const chapterList = document.getElementById('chapterStatsList');
    const selectedSubject = document.getElementById('chapterSubjectFilter').value;
    const chapterStats = JSON.parse(localStorage.getItem(STATS_KEYS.CHAPTER) || '{}');
    
    // Update subject filter dropdown with available subjects
    updateSubjectFilter(chapterStats);
    
    // Filter stats based on selected subject
    const filteredStats = Object.entries(chapterStats).reduce((acc, [key, value]) => {
        const [subject] = key.split('_');
        if (!selectedSubject || subject.toLowerCase() === selectedSubject.toLowerCase()) {
            acc[key] = value;
        }
        return acc;
    }, {});

    // Update overview statistics
    updateChapterOverview(filteredStats);

    // Create/Update chapter performance chart
    createChapterPerformanceChart(filteredStats);

    chapterList.innerHTML = '';
    Object.entries(filteredStats).forEach(([chapterKey, stats]) => {
        const [subject, chapter] = chapterKey.split('_');
        const checksKey = getAnswerChecksKey(subject, chapter);
        const answerChecks = JSON.parse(localStorage.getItem(checksKey) || '{}');

        // Calculate average time (in minutes)
        const totalAnswered = (stats.correct || 0) + (stats.incorrect || 0);
        const chapterAvgTime = totalAnswered > 0 ? ((stats.totalTime / totalAnswered) / 60).toFixed(1) : 0;

        // Add 'Q' prefix to question numbers
        const formatQuestionNumbers = nums => nums.map(num => `Q${num}`).join(', ');

        const incorrectQuestions = Object.entries(answerChecks)
            .filter(([_, data]) => data.result === 'incorrect')
            .map(([qNum]) => parseInt(qNum) + 1)
            .sort((a, b) => a - b);

        const discussQuestions = Object.entries(answerChecks)
            .filter(([_, data]) => data.result === 'discuss')
            .map(([qNum]) => parseInt(qNum) + 1)
            .sort((a, b) => a - b);

        const markedQuestions = Object.entries(answerChecks)
            .filter(([_, data]) => data.marked)
            .map(([qNum]) => parseInt(qNum) + 1)
            .sort((a, b) => a - b);

        const twoAttempts = Object.entries(answerChecks)
            .filter(([_, data]) => data.attempts === '2')
            .map(([qNum]) => parseInt(qNum) + 1)
            .sort((a, b) => a - b);

        const threeAttempts = Object.entries(answerChecks)
            .filter(([_, data]) => data.attempts === '3+')
            .map(([qNum]) => parseInt(qNum) + 1)
            .sort((a, b) => a - b);

        const chapterCard = document.createElement('div');
        chapterCard.className = 'subject-card';
        chapterCard.innerHTML = `
            <h3>${chapter}</h3>
            <div class="subject-stats-grid">
                <div>
                    <div class="detail-label">Total Questions</div>
                    <div class="detail-value">${stats.total || 0}</div>
                </div>
                <div>
                    <div class="detail-label">Correct</div>
                    <div class="detail-value">${stats.correct || 0}</div>
                </div>
                <div>
                    <div class="detail-label">Incorrect</div>
                    <div class="detail-value">${stats.incorrect || 0}</div>
                </div>
                <div>
                    <div class="detail-label">Accuracy</div>
                    <div class="detail-value">${calculateAccuracy(stats)}%</div>
                </div>
                <div>
                    <div class="detail-label">Avg Time</div>
                    <div class="detail-value">${chapterAvgTime}m</div>
                </div>
            </div>
            <div class="question-details">
                ${incorrectQuestions.length ? `
                    <div class="detail-item">
                        <span class="detail-label">Incorrect Questions:</span>
                        <span class="detail-value">${formatQuestionNumbers(incorrectQuestions)}</span>
                    </div>` : ''
                }
                ${discussQuestions.length ? `
                    <div class="detail-item">
                        <span class="detail-label">Discuss Questions:</span>
                        <span class="detail-value">${formatQuestionNumbers(discussQuestions)}</span>
                    </div>` : ''
                }
                ${markedQuestions.length ? `
                    <div class="detail-item">
                        <span class="detail-label">Marked Questions:</span>
                        <span class="detail-value">${formatQuestionNumbers(markedQuestions)}</span>
                    </div>` : ''
                }
                ${twoAttempts.length ? `
                    <div class="detail-item">
                        <span class="detail-label">2 Attempts Questions:</span>
                        <span class="detail-value">${formatQuestionNumbers(twoAttempts)}</span>
                    </div>` : ''
                }
                ${threeAttempts.length ? `
                    <div class="detail-item">
                        <span class="detail-label">3+ Attempts Questions:</span>
                        <span class="detail-value">${formatQuestionNumbers(threeAttempts)}</span>
                    </div>` : ''
                }
            </div>
        `;
        chapterList.appendChild(chapterCard);
    });
}

function updateSubjectFilter(chapterStats) {
    const subjectFilter = document.getElementById('chapterSubjectFilter');
    const subjects = new Set(Object.keys(chapterStats).map(key => key.split('_')[0]));
    
    // Save current selection
    const currentSelection = subjectFilter.value;
    
    // Clear existing options except "All Subjects"
    subjectFilter.innerHTML = '<option value="">All Subjects</option>';
    
    // Add subjects in alphabetical order
    [...subjects].sort().forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectFilter.appendChild(option);
    });
    
    // Restore selection if it still exists
    if ([...subjects].includes(currentSelection)) {
        subjectFilter.value = currentSelection;
    }
}

function filterChapterStats() {
    loadChapterStats();
}

function updateChapterOverview(filteredStats) {
    const stats = Object.values(filteredStats);
    
    // Total Chapters
    document.getElementById('totalChapters').textContent = stats.length;
    
    // Total Questions
    const totalQuestions = stats.reduce((sum, chapterStat) => sum + (chapterStat.total || 0), 0);
    document.getElementById('chapterTotal').textContent = totalQuestions;
    
    // Overall Accuracy
    const totalCorrect = stats.reduce((sum, chapterStat) => sum + (chapterStat.correct || 0), 0);
    const totalAnswered = stats.reduce((sum, chapterStat) => 
        sum + ((chapterStat.correct || 0) + (chapterStat.incorrect || 0) + (chapterStat.discuss || 0)), 0);
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    document.getElementById('chapterAccuracy').textContent = `${accuracy}%`;
    
    // Average Time (in minutes)
    const totalTime = stats.reduce((sum, chapterStat) => sum + (chapterStat.totalTime || 0), 0);
    const avgTime = totalAnswered > 0 ? Math.round((totalTime / totalAnswered / 60) * 10) / 10 : 0;
    document.getElementById('chapterAvgTime').textContent = `${avgTime}m`;
}

function createChapterPerformanceChart(filteredStats) {
    // Destroy existing chart if it exists
    if (window.chapterChart) {
        window.chapterChart.destroy();
    }

    const ctx = document.getElementById('chapterPerformanceChart').getContext('2d');
    const chapters = Object.keys(filteredStats).map(key => key.split('_')[1]); // Get chapter names
    const correctData = chapters.map(chapter => 
        filteredStats[Object.keys(filteredStats).find(k => k.endsWith(chapter))].correct || 0
    );
    const incorrectData = chapters.map(chapter => 
        filteredStats[Object.keys(filteredStats).find(k => k.endsWith(chapter))].incorrect || 0
    );
    const discussData = chapters.map(chapter => 
        filteredStats[Object.keys(filteredStats).find(k => k.endsWith(chapter))].discuss || 0
    );

    window.chapterChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chapters,
            datasets: [
                {
                    label: 'Correct',
                    data: correctData,
                    backgroundColor: '#4CAF50'
                },
                {
                    label: 'Incorrect',
                    data: incorrectData,
                    backgroundColor: '#f44336'
                },
                {
                    label: 'Discuss',
                    data: discussData,
                    backgroundColor: '#2196F3'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Chapter-wise Performance'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true
                },
                x: {
                    stacked: true
                }
            }
        }
    });
}

function getQuestionNumbers(chapter, type){
    const checksKey = getAnswerChecksKey(chapter.split('_')[0], chapter.split('_')[1]);
    const checks = JSON.parse(localStorage.getItem(checksKey) || '{}');
    return Object.entries(checks)
        .filter(([_, data]) => data.result === type || (type === 'marked' && data.marked))
        .map(([questionIndex]) => parseInt(questionIndex) + 1)
        .sort((a, b) => a - b);
}

function getMultipleAttemptsQuestions(chapter) {
    const checksKey = getAnswerChecksKey(chapter.split('_')[0], chapter.split('_')[1]);
    const checks = JSON.parse(localStorage.getItem(checksKey) || '{}');
    
    return {
        twoAttempts: Object.entries(checks)
            .filter(([_, data]) => data.attempts === '2')
            .map(([questionIndex]) => parseInt(questionIndex) + 1)
            .sort((a, b) => a - b),
        threeAttempts: Object.entries(checks)
            .filter(([_, data]) => data.attempts === '3+')
            .map(([questionIndex]) => parseInt(questionIndex) + 1)
            .sort((a, b) => a - b)
    };
}

function navigateDate(direction, period) {
    isProcessingDateChange = true;
    if (period === 'daily') {
        const newDate = new Date(currentDate);
        if (direction === 'prev') {
            newDate.setDate(newDate.getDate() - 1);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        
        if (newDate <= new Date()) {
            currentDate = newDate;
            updateDateDisplay();
            loadDailyStats();
        }
    } else if (period === 'weekly') {
        const currentWeekNum = getWeekNumber(new Date());
        const newWeek = direction === 'prev' ? currentWeek - 1 : currentWeek + 1;
        
        if (newWeek <= currentWeekNum) {
            currentWeek = newWeek;
            updateDateDisplay();
            loadWeeklyStats();
        }
    }
    updateNavigationButtons();
}

function updateDateDisplay() {
    // Update daily display
    const dailyDisplay = document.getElementById('dailyDateDisplay');
    const today = new Date().toISOString().split('T')[0];
    const currentDateStr = currentDate.toISOString().split('T')[0];
    
    if (currentDateStr === today) {
        dailyDisplay.textContent = 'Today';
    } else {
        dailyDisplay.textContent = currentDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
    }
    
    // Update weekly display
    const weeklyDisplay = document.getElementById('weeklyDateDisplay');
    const currentWeekNum = getWeekNumber(new Date());
    
    if (currentWeek === currentWeekNum) {
        weeklyDisplay.textContent = 'This Week';
    } else {
        const weekDates = getWeekDates(new Date().getFullYear(), currentWeek);
        weeklyDisplay.textContent = `${weekDates.start} - ${weekDates.end}`;
    }
}

function updateNavigationButtons() {
    // Update daily navigation
    const nextDayBtn = document.getElementById('nextDayBtn');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nextDayBtn.disabled = currentDate >= today;
    
    // Update weekly navigation
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const currentWeekNum = getWeekNumber(new Date());
    nextWeekBtn.disabled = currentWeek >= currentWeekNum;
}

function loadDailyStats() {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dailyStats = JSON.parse(localStorage.getItem(STATS_KEYS.DAILY) || '{}');
    const stats = dailyStats[dateStr] || initializeStatsObject();
    const today = new Date().toISOString().split('T')[0];
    
    if (stats) {
        // Remove all existing streak cards
        removeStreakCards();

        // Only proceed with streak cards for today's date
        if (dateStr === today && !isProcessingDateChange) {
            displayStreakCards(stats, dailyStats);
        }

        // Update other stats displays
        updateStatsDisplay(stats, 'daily');
        createCharts(stats, 'daily');
    }
    
    // Reset the flag after processing
    isProcessingDateChange = false;
}

function removeStreakCards() {
    const existingContainers = document.querySelectorAll('.streak-cards-container');
    existingContainers.forEach(container => container.remove());
}

function displayStreakCards(stats, dailyStats) {
    const TARGET_QUESTIONS = 50;
    const today = new Date().toISOString().split('T')[0];
    const dailyTotal = stats.total || 0;
    const questionsRemaining = Math.max(0, TARGET_QUESTIONS - dailyTotal);
    
    let streakData = JSON.parse(localStorage.getItem('streakData') || '{"currentStreak": 0, "lastUpdate": "", "highestStreak": 0}');
    console.log('Initial streak data:', streakData);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdayStats = dailyStats[yesterdayStr] || { total: 0 };
    
    console.log('Yesterday stats:', yesterdayStr, yesterdayStats);
    console.log('Today stats:', today, { total: dailyTotal });

    // If this is a new day
   if (streakData.lastUpdate !== today) {
    console.log('New day detected');
    
    if (yesterdayStats.total >= TARGET_QUESTIONS) {
        // Yesterday met the goal
        if (dailyTotal >= TARGET_QUESTIONS) {
            // Today also met the goal
            streakData.currentStreak++;
            console.log('Consecutive days goal met, streak incremented to:', streakData.currentStreak);
        } else {
            // Reset streak if today's goal wasn't met
            streakData.currentStreak = 0;
            console.log('Streak broken, reset to 0');
        }
    } else {
        // Yesterday didn't meet the goal
        streakData.currentStreak = dailyTotal >= TARGET_QUESTIONS ? 1 : 0;
        console.log('Starting or resetting streak:', streakData.currentStreak);
    }
    
    // Update highest streak
    if (streakData.currentStreak > streakData.highestStreak) {
        streakData.highestStreak = streakData.currentStreak;
    }
    
    streakData.lastUpdate = today;
    localStorage.setItem('streakData', JSON.stringify(streakData));
}

    const dailyStatsContent = document.getElementById('dailyStats');
    if (!dailyStatsContent) return;

    const streakCardsContainer = document.createElement('div');
    streakCardsContainer.className = 'streak-cards-container';
    
    streakCardsContainer.innerHTML = `
        <div class="streak-card stats-card">
            <div class="streak-content">
                <h3>Current Streak</h3>
                <p class="streak-number">${streakData.currentStreak}</p>
                <div class="streak-label">
                    ${questionsRemaining <= 0 
                        ? 'Well done! Daily target reached!' 
                        : `${questionsRemaining} questions until next streak`}
                </div>
                <span class="streak-icon">🔥</span>
            </div>
        </div>
        <div class="streak-card stats-card">
            <div class="streak-content">
                <h3>Highest Streak</h3>
                <p class="streak-number">${streakData.highestStreak}</p>
                <div class="streak-label">Your best streak so far!</div>
                <span class="streak-icon">👑</span>
            </div>
        </div>
    `;
    
    dailyStatsContent.insertBefore(streakCardsContainer, dailyStatsContent.firstChild);
}

function loadWeeklyStats() {
    const weeklyStats = JSON.parse(localStorage.getItem(STATS_KEYS.WEEKLY) || '{}');
    const stats = weeklyStats[currentWeek] || initializeStatsObject();
    
    if (stats) {
        updateStatsDisplay(stats, 'weekly');
        createCharts(stats, 'weekly');
    }
}

function getWeekDates(year, weekNumber) {
    const firstDayOfYear = new Date(year, 0, 1);
    const firstWeekday = firstDayOfYear.getDay();
    const firstWeekStartDate = new Date(year, 0, 1 + (8 - firstWeekday) % 7);
    
    const weekStartDate = new Date(firstWeekStartDate);
    weekStartDate.setDate(weekStartDate.getDate() + (weekNumber - 1) * 7);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    
    return {
        start: weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        end: weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
}

// Continue with other functions... ;
    
    dailyStatsContent.insertBefore(streakCardsContainer, dailyStatsContent.firstChild);
}

function loadWeeklyStats() {
    const weeklyStats = JSON.parse(localStorage.getItem(STATS_KEYS.WEEKLY) || '{}');
    const stats = weeklyStats[currentWeek] || initializeStatsObject();
    
    if (stats) {
        updateStatsDisplay(stats, 'weekly');
        createCharts(stats, 'weekly');
    }
}

function getWeekDates(year, weekNumber) {
    const firstDayOfYear = new Date(year, 0, 1);
    const firstWeekday = firstDayOfYear.getDay();
    const firstWeekStartDate = new Date(year, 0, 1 + (8 - firstWeekday) % 7);
    
    const weekStartDate = new Date(firstWeekStartDate);
    weekStartDate.setDate(weekStartDate.getDate() + (weekNumber - 1) * 7);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    
    return {
        start: weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        end: weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
}

// Continue with other functions... 