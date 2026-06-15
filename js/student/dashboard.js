/* =====================================
   STUDENT DASHBOARD MODULE
   ===================================== */

import { 
    getExams, getSubmissions, getStudentGrades,
    getStudentAnalytics, getSubjects 
} from '../db.js';
import { getCurrentUser } from '../auth.js';
import { showNotification } from '../utils/notifications.js';
import { formatDateTime } from '../utils/helpers.js';
import { startExam } from './exam-taker.js';

const SUBJECT_MAP = {
    'التربية الاسلامية': 'Islamic Education',
    'تاريخ الأردن': 'Jordan History',
    'اللغة العربية': 'Arabic Language',
    'اللغة الانجليزية': 'English Language'
};

export async function initStudentDashboard() {
    await loadStudentDashboard();
}

/* ===== MAIN DASHBOARD ===== */
async function loadStudentDashboard() {
    const content = document.getElementById('student-dashboard-content');
    content.innerHTML = '<p>Loading...</p>';

    const user = getCurrentUser();
    if (!user) return;

    try {
        const [exams, grades, analytics] = await Promise.all([
            getExams(),
            getStudentGrades(user.id),
            getStudentAnalytics(user.id)
        ]);

        // Filter published and not locked exams
        const availableExams = exams.filter(e => e.is_published && !e.is_locked);

        content.innerHTML = `
            <!-- Progress Card -->
            <div class="student-dashboard-card">
                <h3>📊 Your Progress</h3>
                
                <div class="progress-container">
                    <div class="progress-label">
                        <span class="progress-label-text">Exams Completed</span>
                        <span class="progress-label-value">${analytics.completedExams}/${analytics.totalExams}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${analytics.totalExams ? (analytics.completedExams / analytics.totalExams * 100) : 0}%"></div>
                    </div>
                </div>

                <div class="stats-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px;">
                    <div class="stat-item">
                        <div class="stat-item-value">${analytics.averageScore}%</div>
                        <div class="stat-item-label">Average Score</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-value" style="color: var(--success);">${analytics.passedExams}</div>
                        <div class="stat-item-label">Passed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-value" style="color: var(--danger);">${analytics.failedExams}</div>
                        <div class="stat-item-label">Failed</div>
                    </div>
                </div>
            </div>

            <!-- Subjects Grid -->
            <div class="subjects-grid">
                ${await renderSubjects(availableExams, user.id)}
            </div>

            <!-- Recent Grades -->
            ${grades.length ? `
                <div class="student-dashboard-card" style="margin-top: 25px;">
                    <h3>📝 Recent Grades</h3>
                    ${renderRecentGrades(grades.slice(0, 5))}
                </div>
            ` : ''}
        `;

        setupSubjectClicks();

    } catch (error) {
        console.error('Load dashboard error:', error);
        showNotification('❌ Failed to load dashboard', 'error');
    }
}

/* ===== RENDER SUBJECTS ===== */
async function renderSubjects(exams, studentId) {
    const subjects = await getSubjects();
    
    const subjectsHTML = await Promise.all(subjects.map(async (subject) => {
        const subjectExams = exams.filter(e => e.subject_id === subject.id);
        const displayName = SUBJECT_MAP[subject.name] || subject.name;
        
        // Check if student has taken any exam for this subject
        const submissions = await getSubmissions({ 
            studentId: studentId 
        });
        
        const completedCount = submissions.filter(s => 
            subjectExams.some(e => e.id === s.exam_id) && s.is_submitted
        ).length;

        const iconMap = {
            'التربية الاسلامية': 'fa-mosque',
            'تاريخ الأردن': 'fa-landmark',
            'اللغة العربية': 'fa-book',
            'اللغة الانجليزية': 'fa-language'
        };

        const icon = iconMap[subject.name] || 'fa-book';

        return `
            <div class="subject-card" data-subject="${subject.name}">
                <i class="fas ${icon}"></i>
                <h3>${displayName}</h3>
                <div class="subject-card-status">
                    ${subjectExams.length ? `${subjectExams.length} available` : 'No exams'}
                </div>
                ${completedCount ? `
                    <div class="subject-card-exams">
                        ✓ ${completedCount} completed
                    </div>
                ` : ''}
            </div>
        `;
    }));

    return subjectsHTML.join('');
}

/* ===== SETUP SUBJECT CLICKS ===== */
function setupSubjectClicks() {
    const subjectCards = document.querySelectorAll('.subject-card');
    
    subjectCards.forEach(card => {
        card.addEventListener('click', async () => {
            const subjectName = card.dataset.subject;
            await showSubjectExams(subjectName);
        });
    });
}

/* ===== SHOW SUBJECT EXAMS ===== */
async function showSubjectExams(subjectName) {
    const user = getCurrentUser();
    if (!user) return;

    const exams = await getExams();
    const subjects = await getSubjects();
    const subject = subjects.find(s => s.name === subjectName);
    
    if (!subject) return;

    const subjectExams = exams.filter(e => 
        e.subject_id === subject.id && 
        e.is_published && 
        !e.is_locked
    );

    if (!subjectExams.length) {
        showNotification('No exams available for this subject', 'info');
        return;
    }

    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    const displayName = SUBJECT_MAP[subjectName] || subjectName;

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>📚 ${displayName}</h2>
            <button class="modal-close" onclick="closeStudentModal()">×</button>
        </div>

        <div class="exams-list">
            ${await renderExamsList(subjectExams, user.id)}
        </div>
    `;
}

async function renderExamsList(exams, studentId) {
    const submissions = await getSubmissions({ studentId });

    return await Promise.all(exams.map(async (exam) => {
        const submission = submissions.find(s => s.exam_id === exam.id);
        
        let statusHTML = '';
        let actionButton = '';

        if (submission?.is_submitted) {
            statusHTML = `<span class="badge badge-success">✓ Completed</span>`;
            actionButton = `
                <button class="btn btn-secondary btn-sm" disabled>
                    Score: ${submission.score || 0}
                </button>
            `;
        } else if (submission) {
            statusHTML = `<span class="badge badge-warning">In Progress</span>`;
            actionButton = `
                <button class="btn btn-success btn-sm" onclick="resumeExam('${exam.id}')">
                    <i class="fas fa-play"></i> Resume
                </button>
            `;
        } else {
            statusHTML = `<span class="badge badge-primary">Available</span>`;
            actionButton = `
                <button class="btn btn-primary btn-sm" onclick="showExamPassword('${exam.id}')">
                    <i class="fas fa-arrow-right"></i> Start Exam
                </button>
            `;
        }

        return `
            <div class="exam-item ${submission?.is_submitted ? 'completed' : submission ? 'active' : 'available'}">
                <div class="exam-item-info">
                    <div class="exam-item-title">${exam.title}</div>
                    <div class="exam-item-subject">${exam.subjects?.name || '-'}</div>
                    <div class="exam-item-time">
                        Duration: ${exam.duration_minutes} minutes | 
                        Type: ${exam.is_one_way ? 'One Way' : 'Two Way'}
                    </div>
                    <div style="margin-top: 5px;">${statusHTML}</div>
                </div>
                <div class="exam-item-action">
                    ${actionButton}
                </div>
            </div>
        `;
    })).then(items => items.join(''));
}

/* ===== SHOW EXAM PASSWORD ===== */
window.showExamPassword = function(examId) {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="modal-header">
            <h2>🔐 Enter Exam Password</h2>
            <button class="modal-close" onclick="closeStudentModal()">×</button>
        </div>

        <form id="password-form" style="text-align: center;">
            <div class="form-group" style="margin: 30px auto; max-width: 280px;">
                <input type="text" 
                    id="exam-password-input" 
                    placeholder="6-digit password" 
                    maxlength="6" 
                    style="text-align: center; font-size: 24px; letter-spacing: 8px; font-family: monospace;"
                    required 
                    autocomplete="off">
            </div>

            <p id="password-error" style="color: var(--danger); display: none; margin-bottom: 15px;">
                <i class="fas fa-times-circle"></i> Incorrect password
            </p>

            <div style="display: flex; gap: 10px; justify-content: center;">
                <button type="button" class="btn btn-secondary" onclick="closeStudentModal()">
                    Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-arrow-right"></i> Start Exam
                </button>
            </div>
        </form>
    `;

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await verifyAndStartExam(examId);
    });

    setTimeout(() => {
        document.getElementById('exam-password-input')?.focus();
    }, 100);
};

async function verifyAndStartExam(examId) {
    const passwordInput = document.getElementById('exam-password-input');
    const enteredPassword = passwordInput?.value?.trim();

    if (!enteredPassword) return;

    const exams = await getExams();
    const exam = exams.find(e => e.id === examId);

    if (!exam) return;

    if (enteredPassword === exam.exam_password) {
        closeStudentModal();
        await startExam(examId);
    } else {
        document.getElementById('password-error').style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

/* ===== RESUME EXAM ===== */
window.resumeExam = async function(examId) {
    closeStudentModal();
    await startExam(examId);
};

/* ===== RENDER RECENT GRADES ===== */
function renderRecentGrades(grades) {
    return `
        <div style="display: grid; gap: 12px; margin-top: 15px;">
            ${grades.map(grade => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-light); border-radius: 8px;">
                    <div>
                        <div style="font-weight: 600; color: var(--text-dark);">
                            ${grade.exams?.title}
                        </div>
                        <div style="font-size: 12px; color: var(--text-gray); margin-top: 3px;">
                            ${grade.exams?.subjects?.name} • ${formatDateTime(grade.end_time)}
                        </div>
                    </div>
                    <div style="font-size: 20px; font-weight: 700; color: ${grade.score >= 50 ? 'var(--success)' : 'var(--danger)'};">
                        ${grade.score || 0}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/* ===== CLOSE MODAL ===== */
window.closeStudentModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
};

document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
        closeStudentModal();
    }
});