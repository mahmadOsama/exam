/* =====================================
   EXAM TAKER MODULE - FINAL
   ===================================== */

import { 
    getExamById, getExamQuestions, 
    createSubmission, updateSubmission,
    saveAnswer, getSubmissions, autoGradeSubmission
} from '../db.js';
import { getCurrentUser } from '../auth.js';
import { showNotification } from '../utils/notifications.js';
import { getTimeRemaining } from '../utils/helpers.js';
import { initStudentDashboard } from './dashboard.js';

let currentExam = null;
let currentQuestions = [];
let currentSubmission = null;
let currentQuestionIndex = 0;
let timerInterval = null;
let autosaveInterval = null;
let syncPollInterval = null;
let examEndTime = null;
let examChannel = null;

// Listen for exam changes
function setupExamRealtime(examId) {
    if (examChannel) {
        supabase.removeChannel(examChannel);
    }

    examChannel = supabase
        .channel(`exam-changes-${examId}`)
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'exams', filter: `id=eq.${examId}` },
            async (payload) => {
                if (!currentExam) return;
                await handleExamUpdate(payload.new);
            }
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'questions', filter: `exam_id=eq.${examId}` },
            async (payload) => {
                if (!currentExam) return;

                // Reload questions when admin adds/edits/deletes
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                    await handleQuestionsChanged(examId);
                }
            }
        )
        .subscribe((status) => {
            console.log('Exam realtime channel status:', status);
            if (status === 'SUBSCRIBED') {
                // Realtime works - we can rely on it, but keep a slow poll as backup
                startSyncPolling(examId, 15000);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                // Realtime not working - fall back to faster polling
                showNotification('⚠️ Live sync unavailable - using periodic refresh', 'warning');
                startSyncPolling(examId, 3000);
            }
        });
}

/* ===== POLLING FALLBACK / BACKUP SYNC ===== */
function startSyncPolling(examId, intervalMs) {
    if (syncPollInterval) clearInterval(syncPollInterval);

    syncPollInterval = setInterval(async () => {
        if (!currentExam) return;

        try {
            const latestExam = await getExamById(examId);
            if (latestExam) {
                await handleExamUpdate(latestExam);
            }

            const latestQuestions = await getExamQuestions(examId);
            if (questionsChanged(latestQuestions)) {
                currentQuestions = latestQuestions;
                await handleQuestionsChanged(examId, true);
            }
        } catch (err) {
            console.error('Sync poll error:', err);
        }
    }, intervalMs);
}

function questionsChanged(newQuestions) {
    if (newQuestions.length !== currentQuestions.length) return true;
    for (let i = 0; i < newQuestions.length; i++) {
        const a = newQuestions[i];
        const b = currentQuestions[i];
        if (a.id !== b.id || a.content !== b.content || a.points !== b.points ||
            JSON.stringify(a.options) !== JSON.stringify(b.options) ||
            a.question_type !== b.question_type) {
            return true;
        }
    }
    return false;
}

/* ===== HANDLE EXAM-LEVEL CHANGES (lock, time, nav type) ===== */
async function handleExamUpdate(updatedExam) {
    // Handle lock
    if (updatedExam.is_locked && !currentExam.is_locked) {
        currentExam.is_locked = true;
        showNotification('⚠️ Exam has been locked by admin!', 'error');
        setTimeout(() => autoSubmitExam(), 2000);
        return;
    }

    // Handle time extension/reduction
    if (updatedExam.duration_minutes !== currentExam.duration_minutes) {
        const diffMinutes = updatedExam.duration_minutes - currentExam.duration_minutes;
        examEndTime = new Date(examEndTime.getTime() + diffMinutes * 60000);
        currentExam.duration_minutes = updatedExam.duration_minutes;

        if (diffMinutes > 0) {
            showNotification(`⏱️ Time extended by ${diffMinutes} minutes!`, 'success');
        } else if (diffMinutes < 0) {
            showNotification(`⏱️ Time reduced by ${Math.abs(diffMinutes)} minutes!`, 'warning');
        }

        // Reflect immediately in the timer display
        const timerElement = document.getElementById('exam-timer');
        if (timerElement) {
            timerElement.textContent = getTimeRemaining(examEndTime);
        }
    }

    // Handle navigation type change
    if (updatedExam.is_one_way !== currentExam.is_one_way) {
        currentExam.is_one_way = updatedExam.is_one_way;
        showNotification(
            updatedExam.is_one_way
                ? '⚠️ Exam changed to One Way mode'
                : '✓ You can now navigate between questions',
            'info'
        );
        showExamScreen();
        renderQuestion();
    }
}

/* ===== HANDLE QUESTION CHANGES ===== */
async function handleQuestionsChanged(examId, silent = false) {
    if (!silent) {
        showNotification('📝 Questions updated by admin', 'info');
    }
    currentQuestions = await getExamQuestions(examId);

    if (!currentQuestions.length) {
        showNotification('⚠️ No questions remain - auto-submitting', 'warning');
        await autoSubmitExam();
        return;
    }

    // Clamp index if questions were removed
    if (currentQuestionIndex >= currentQuestions.length) {
        currentQuestionIndex = Math.max(0, currentQuestions.length - 1);
    }

    // Rebuild whole exam screen (updates total count, nav grid, etc.)
    showExamScreen();
    renderQuestion();

    if (timerInterval) {
        const remaining = getTimeRemaining(examEndTime);
        const timerElement = document.getElementById('exam-timer');
        if (timerElement) timerElement.textContent = remaining;
    }
}
export async function startExam(examId) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        // Get exam data
        currentExam = await getExamById(examId);
        currentQuestions = await getExamQuestions(examId);

        if (!currentExam || !currentQuestions.length) {
            showNotification('❌ Exam not available', 'error');
            return;
        }

        // ✅ FIX: Check for existing submission
        const submissions = await getSubmissions({ 
            examId, 
            studentId: user.id 
        });

        const existingSubmission = submissions.find(s => s.exam_id === examId && s.student_id === user.id);

        // If already submitted, block access
        if (existingSubmission?.is_submitted) {
            showNotification('⚠️ You have already completed this exam', 'warning');
            return;
        }

        // ✅ Resume if in progress
        if (existingSubmission && !existingSubmission.is_submitted) {
            currentSubmission = existingSubmission;
            currentQuestionIndex = (existingSubmission.current_question_order || 1) - 1;
            
            // Calculate remaining time
            const elapsed = Date.now() - new Date(existingSubmission.start_time).getTime();
            const totalDuration = currentExam.duration_minutes * 60000;
            const remaining = totalDuration - elapsed;
            
            if (remaining <= 0) {
                showNotification('⏰ Time expired - Auto submitting', 'warning');
                await autoSubmitExam();
                return;
            }
            
            examEndTime = new Date(Date.now() + remaining);
            showNotification('📝 Resuming exam from where you left...', 'info');
        } else {
            // Create new submission
            const { data, error } = await createSubmission({
                exam_id: examId,
                student_id: user.id,
                current_question_order: 1,
                is_submitted: false,
                start_time: new Date().toISOString()
            });

            if (error) {
                showNotification('❌ Failed to start exam', 'error');
                console.error('Create submission error:', error);
                return;
            }

            currentSubmission = data;
            currentQuestionIndex = 0;
            examEndTime = new Date(Date.now() + currentExam.duration_minutes * 60000);
            showNotification('📝 Exam started - Good luck!', 'success');
        }

        // Setup realtime
        setupExamRealtime(examId);

      // Show exam screen
showExamScreen();

// Activate exam mode
if (window.setExamActive) window.setExamActive(true);

startTimer();
renderQuestion();

// Periodic autosave (answer + current position)
if (autosaveInterval) clearInterval(autosaveInterval);
autosaveInterval = setInterval(() => {
    if (window.saveCurrentAnswer) window.saveCurrentAnswer();
    updateCurrentQuestionOrder();
}, 15000);

    } catch (error) {
        console.error('Start exam error:', error);
        showNotification('❌ Failed to start exam', 'error');
    }
}
/* ===== EXAM SCREEN ===== */
function showExamScreen() {
    
    // Hide student dashboard
    document.getElementById('student-dashboard').classList.remove('active');
    
    // Show exam taker
    const examTaker = document.getElementById('exam-taker');
    examTaker.classList.add('active');

    // Setup exam header
    const examHeader = document.querySelector('.student-header');
    if (examHeader) {
        examHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <h2 style="margin: 0;">${currentExam.title}</h2>
                <div id="exam-timer" class="timer">00:00</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="badge badge-${currentExam.is_one_way ? 'warning' : 'success'}">
                    ${currentExam.is_one_way ? 'One Way' : 'Two Way'}
                </span>
            </div>
        `;
    }

    // Setup exam content container
    const examContent = document.getElementById('exam-content');
    examContent.innerHTML = `
        <!-- Progress Tracker -->
        <div class="exam-progress">
            <div class="exam-progress-title">Progress</div>
            <div class="exam-progress-stats">
                <div class="progress-stat">
                    <div class="progress-stat-value" id="answered-count">0</div>
                    <div class="progress-stat-label">Answered</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-stat-value" id="current-q-num">1</div>
                    <div class="progress-stat-label">Current</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-stat-value">${currentQuestions.length}</div>
                    <div class="progress-stat-label">Total</div>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-bar-fill" id="exam-progress-bar" style="width: 0%"></div>
            </div>
        </div>

        <!-- Question Navigation Panel -->
        ${!currentExam.is_one_way ? `
            <div class="question-nav-panel">
                <div class="question-nav-title">Questions Navigation</div>
                <div class="question-nav-grid" id="question-nav-grid"></div>
            </div>
        ` : ''}

        <!-- Question Card -->
        <div id="question-display" class="question-card"></div>

        <!-- Navigation Buttons -->
        <div class="exam-navigation">
            <button id="prev-btn" class="btn btn-secondary" ${currentExam.is_one_way ? 'style="display:none;"' : ''}>
                <i class="fas fa-arrow-right"></i> Previous
            </button>
            <button id="next-btn" class="btn btn-primary">
                Next <i class="fas fa-arrow-left"></i>
            </button>
            <button id="submit-btn" class="btn btn-success" style="display:none;">
                <i class="fas fa-check-circle"></i> Submit Exam
            </button>
        </div>
    `;

    // Setup navigation buttons
    document.getElementById('prev-btn')?.addEventListener('click', previousQuestion);
    document.getElementById('next-btn')?.addEventListener('click', nextQuestion);
    document.getElementById('submit-btn')?.addEventListener('click', confirmSubmit);

    // Render question navigation
    if (!currentExam.is_one_way) {
        renderQuestionNavigation();
    }
}

/* ===== TIMER ===== */
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const remaining = getTimeRemaining(examEndTime);
        const timerElement = document.getElementById('exam-timer');

        if (!timerElement) {
            clearInterval(timerInterval);
            return;
        }

        timerElement.textContent = remaining;

        // Calculate minutes remaining
        const now = new Date();
        const diff = examEndTime - now;
        const minutesLeft = Math.floor(diff / 1000 / 60);

        if (diff <= 0) {
            clearInterval(timerInterval);
            autoSubmitExam();
        } else if (minutesLeft <= 2) {
            timerElement.className = 'timer danger';
        } else if (minutesLeft <= 5) {
            timerElement.className = 'timer warning';
        }
    }, 1000);
}

/* ===== RENDER QUESTION ===== */
function renderQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    if (!question) return;

    const questionDisplay = document.getElementById('question-display');
    const isEnglish = currentExam.subjects?.language === 'en';

    questionDisplay.innerHTML = `
        <div class="question-header">
            <span class="question-number">Question ${currentQuestionIndex + 1} / ${currentQuestions.length}</span>
            <span class="question-points">${question.points} ${question.points === 1 ? 'point' : 'points'}</span>
        </div>

        <div class="question-text" ${isEnglish ? 'dir="ltr"' : ''}>
            ${question.content}
        </div>

        ${question.image_url ? `
            <img src="${question.image_url}" alt="Question image" class="question-image">
        ` : ''}

        <div class="options-container" id="options-container">
            ${renderQuestionOptions(question)}
        </div>
    `;

    // Update navigation buttons
    updateNavigationButtons();
    updateProgress();
    loadSavedAnswer(question.id);

    // Update current question number
    document.getElementById('current-q-num').textContent = currentQuestionIndex + 1;

    // Update question navigation if Two Way
    if (!currentExam.is_one_way) {
        updateQuestionNavigation();
    }
}

function renderQuestionOptions(question) {
    const isEnglish = currentExam.subjects?.language === 'en';

    switch (question.question_type) {
        case 'mcq':
            return (question.options || []).map((option, i) => `
                <label class="option-label" ${isEnglish ? 'dir="ltr"' : ''}>
                    <input type="radio" name="answer" value="${option}" onchange="saveCurrentAnswer()">
                    <span>${option}</span>
                </label>
            `).join('');

        case 'true_false':
            return `
                <label class="option-label">
                    <input type="radio" name="answer" value="صح" onchange="saveCurrentAnswer()">
                    <span>✅ صح</span>
                </label>
                <label class="option-label">
                    <input type="radio" name="answer" value="خطأ" onchange="saveCurrentAnswer()">
                    <span>❌ خطأ</span>
                </label>
            `;

        case 'text_input':
            return `
                <textarea 
                    id="text-answer" 
                    class="form-group" 
                    placeholder="Enter your answer here..."
                    onchange="saveCurrentAnswer()"
                    ${isEnglish ? 'dir="ltr"' : ''}
                    style="width: 100%; min-height: 120px; padding: 15px; border: 2px solid var(--border); border-radius: 8px; font-size: 14px; font-family: inherit;"
                ></textarea>
            `;

        default:
            return '<p>Unsupported question type</p>';
    }
}

/* ===== SAVE ANSWER ===== */
window.saveCurrentAnswer = async function() {
    if (!currentSubmission || !currentQuestions.length) return;
    const question = currentQuestions[currentQuestionIndex];
    if (!question) return;
    let answer = '';

    if (question.question_type === 'text_input') {
        answer = document.getElementById('text-answer')?.value?.trim() || '';
    } else {
        const selected = document.querySelector('input[name="answer"]:checked');
        answer = selected?.value || '';
    }

    if (!answer) return;

    await saveAnswer({
        submission_id: currentSubmission.id,
        question_id: question.id,
        answer: answer
    });

    // Update progress
    updateProgress();
};

async function loadSavedAnswer(questionId) {
    const { data, error } = await supabase
        .from('student_answers')
        .select('answer')
        .eq('submission_id', currentSubmission.id)
        .eq('question_id', questionId)
        .maybeSingle();

    if (error) {
        console.error('Error loading saved answer:', error);
        return;
    }

    if (data?.answer) {
        const question = currentQuestions[currentQuestionIndex];

        if (question.question_type === 'text_input') {
            const textarea = document.getElementById('text-answer');
            if (textarea) textarea.value = data.answer;
        } else {
            const radio = document.querySelector(`input[name="answer"][value="${data.answer}"]`);
            if (radio) radio.checked = true;
        }
    }
}

/* ===== NAVIGATION ===== */
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    const isFirst = currentQuestionIndex === 0;
    const isLast = currentQuestionIndex === currentQuestions.length - 1;

    if (prevBtn) {
        prevBtn.disabled = isFirst || currentExam.is_one_way;
    }

    if (nextBtn && submitBtn) {
        if (isLast) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0 && !currentExam.is_one_way) {
        currentQuestionIndex--;
        renderQuestion();
        updateCurrentQuestionOrder();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
        updateCurrentQuestionOrder();
    }
}

async function updateCurrentQuestionOrder() {
    await updateSubmission(currentSubmission.id, {
        current_question_order: currentQuestionIndex + 1
    });
}

/* ===== QUESTION NAVIGATION PANEL ===== */
function renderQuestionNavigation() {
    const navGrid = document.getElementById('question-nav-grid');
    if (!navGrid) return;

    navGrid.innerHTML = currentQuestions.map((q, i) => `
        <button class="question-nav-btn" onclick="jumpToQuestion(${i})" data-q-index="${i}">
            ${i + 1}
        </button>
    `).join('');

    updateQuestionNavigation();
}

function updateQuestionNavigation() {
    const navButtons = document.querySelectorAll('.question-nav-btn');
    
    navButtons.forEach((btn, i) => {
        btn.classList.remove('current', 'answered');
        
        if (i === currentQuestionIndex) {
            btn.classList.add('current');
        }
        
        // Check if answered (placeholder - would need actual check)
        // btn.classList.add('answered');
    });
}

window.jumpToQuestion = function(index) {
    if (!currentExam.is_one_way) {
        currentQuestionIndex = index;
        renderQuestion();
        updateCurrentQuestionOrder();
    }
};

/* ===== PROGRESS ===== */
async function updateProgress() {
    // Get answered count
    const { data } = await supabase
        .from('student_answers')
        .select('id')
        .eq('submission_id', currentSubmission.id);

    const answeredCount = data?.length || 0;
    
    document.getElementById('answered-count').textContent = answeredCount;
    
    const progressBar = document.getElementById('exam-progress-bar');
    const percentage = (answeredCount / currentQuestions.length) * 100;
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
}

/* ===== SUBMIT EXAM ===== */
function confirmSubmit() {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>⚠️ Submit Exam?</h2>
        </div>

        <div style="text-align: center; padding: 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 50px; color: var(--warning); margin-bottom: 15px;"></i>
            <p style="font-size: 16px; margin-bottom: 20px;">
                Are you sure you want to submit? You cannot change your answers after submission.
            </p>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-secondary" onclick="closeSubmitModal()">
                Cancel
            </button>
            <button class="btn btn-success" onclick="submitExam()">
                <i class="fas fa-check"></i> Yes, Submit
            </button>
        </div>
    `;
}

window.closeSubmitModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
};

window.submitExam = async function() {
    closeSubmitModal();
    await finalizeSubmission();
};

async function autoSubmitExam() {
    showNotification('⏰ Time is up! Auto-submitting exam...', 'warning');
    await finalizeSubmission();
}

async function finalizeSubmission() {
    // Stop timer & autosave
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (autosaveInterval) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
    }
    if (syncPollInterval) {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
    }

    // Save current answer one last time before submitting
    if (window.saveCurrentAnswer) {
        await window.saveCurrentAnswer();
    }

    // Update submission
    const { error } = await updateSubmission(currentSubmission.id, {
        is_submitted: true,
        end_time: new Date().toISOString()
    });

    if (error) {
        showNotification('❌ Failed to submit exam - please try again', 'error');
        // Restart timer so the student doesn't lose more time silently
        if (!timerInterval && examEndTime) {
            startTimer();
        }
        if (!autosaveInterval) {
            autosaveInterval = setInterval(() => {
                if (window.saveCurrentAnswer) window.saveCurrentAnswer();
                updateCurrentQuestionOrder();
            }, 15000);
        }
        return;
    }

    // Auto-grade immediately
    try {
        await autoGradeSubmission(currentSubmission.id);
    } catch (err) {
        console.error('Auto-grade error:', err);
    }

    // Show success message
    showSuccessScreen();
}

function showSuccessScreen() {
    const examContent = document.getElementById('exam-content');
    
    examContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 12px; box-shadow: var(--shadow-lg);">
            <i class="fas fa-check-circle" style="font-size: 80px; color: var(--success); margin-bottom: 20px; animation: bounce 1s;"></i>
            <h2 style="color: var(--text-dark); margin-bottom: 15px;">Exam Submitted Successfully! 🎉</h2>
            <p style="color: var(--text-gray); margin-bottom: 30px;">
                Your answers have been saved. Results will be available soon.
            </p>
            <button class="btn btn-primary btn-lg" onclick="returnToDashboard()">
                <i class="fas fa-home"></i> Return to Dashboard
            </button>
        </div>
    `;

    showNotification('✅ Exam submitted successfully!', 'success');
}

window.returnToDashboard = function() {
    // Disable exam mode
    if (window.setExamActive) window.setExamActive(false);
    // ✅ Clean up realtime channel
    if (examChannel) {
        supabase.removeChannel(examChannel);
        examChannel = null;
    }

    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Stop autosave
    if (autosaveInterval) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
    }

    // Stop sync polling
    if (syncPollInterval) {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
    }

    // Reset state
    currentExam = null;
    currentQuestions = [];
    currentSubmission = null;
    currentQuestionIndex = 0;
    examEndTime = null;

    // Hide exam taker
    document.getElementById('exam-taker').classList.remove('active');
    
    // Show dashboard
    document.getElementById('student-dashboard').classList.add('active');

    // Restore header
    const header = document.querySelector('.student-header');
    const user = getCurrentUser();
    if (header) {
        header.innerHTML = `
            <h2>👋 مرحباً، <span id="student-name">${user?.full_name || user?.username}</span></h2>
            <button id="student-logout-btn" class="btn btn-danger-outlined">خروج</button>
        `;
        
        // Re-attach logout
        document.getElementById('student-logout-btn').addEventListener('click', () => {
            import('../auth.js').then(auth => auth.logout());
        });
    }

    // Reload dashboard
    initStudentDashboard();
};

// Import supabase
import { supabase } from '../db.js';