/* =====================================
   EXAM MANAGEMENT MODULE
   ===================================== */

import { 
    getExams, createExam, updateExam, deleteExam,
    getExamQuestions, createQuestion, updateQuestion, deleteQuestion,
    getSubjects 
} from '../db.js';
import { showNotification } from '../utils/notifications.js';
import { formatDateTime } from '../utils/helpers.js';

const SUBJECTS = [
    { label: 'Islamic Education', dbName: 'التربية الاسلامية', language: 'ar' },
    { label: 'Jordan History', dbName: 'تاريخ الأردن', language: 'ar' },
    { label: 'Arabic Language', dbName: 'اللغة العربية', language: 'ar' },
    { label: 'English Language', dbName: 'اللغة الانجليزية', language: 'en' }
];

let wizardData = {};
let currentStep = 1;

export async function initExamManager() {
    const content = document.getElementById('exams-content');
    
    // Setup button
    const createBtn = document.getElementById('new-exam-btn');
    if (createBtn) {
        createBtn.onclick = openExamWizard;
    }

    await loadExamsList();
}

/* ===== EXAMS LIST ===== */
async function loadExamsList() {
    const content = document.getElementById('exams-content');
    content.innerHTML = '<p>Loading...</p>';

    try {
        const exams = await getExams();

        if (!exams.length) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-title">No exams yet</div>
                    <div class="empty-state-text">Create your first exam to get started</div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="data-grid">
                ${exams.map(exam => createExamCard(exam)).join('')}
            </div>
        `;

    } catch (error) {
        console.error('Load exams error:', error);
        showNotification('❌ Failed to load exams', 'error');
    }
}

function createExamCard(exam) {
    return `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h3>${exam.title}</h3>
                <span class="badge ${exam.is_published ? 'badge-success' : 'badge-warning'}">
                    ${exam.is_published ? '✓ Published' : 'Draft'}
                </span>
            </div>
            <p><strong>Subject:</strong> ${exam.subjects?.name || '-'}</p>
            <p><strong>Password:</strong> <code style="background: var(--bg-light); padding: 2px 6px; border-radius: 4px;">${exam.exam_password}</code></p>
            <p><strong>Duration:</strong> ${exam.duration_minutes}m | <strong>Type:</strong> ${exam.is_one_way ? 'One Way' : 'Two Way'}</p>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="openQuestionBuilder('${exam.id}')">
                    <i class="fas fa-list"></i> Questions
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openEditExam('${exam.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-${exam.is_published ? 'warning' : 'success'} btn-sm" onclick="togglePublish('${exam.id}', ${!exam.is_published})">
                    ${exam.is_published ? '🙈 Hide' : '👁️ Publish'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteExamConfirm('${exam.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}
/* ===== EDIT EXAM ===== */
window.openEditExam = async function(examId) {
    const exams = await getExams();
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;

    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>⚙️ Edit Exam Settings</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <form id="edit-exam-form" class="wizard-form" style="display: grid; gap: 18px;">
            <div class="form-group">
                <label>Exam Title</label>
                <input type="text" id="edit-title" value="${exam.title}" required>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Password</label>
                    <input type="text" id="edit-password" value="${exam.exam_password}" required maxlength="6">
                </div>
                <div class="form-group">
                    <label>Duration (minutes)</label>
                    <input type="number" id="edit-duration" value="${exam.duration_minutes}" required min="5">
                </div>
            </div>

            <div class="form-group">
                <label>Exam Type</label>
                <div style="display: flex; gap: 20px; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="edit-type" value="false" ${!exam.is_one_way ? 'checked' : ''}> 
                        Two Way
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="edit-type" value="true" ${exam.is_one_way ? 'checked' : ''}> 
                        One Way
                    </label>
                </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            </div>
        </form>
    `;

    document.getElementById('edit-exam-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const updates = {
            title: document.getElementById('edit-title').value.trim(),
            exam_password: document.getElementById('edit-password').value.trim(),
            duration_minutes: parseInt(document.getElementById('edit-duration').value),
            is_one_way: document.querySelector('input[name="edit-type"]:checked').value === 'true'
        };

        showNotification('⏳ Updating exam...', 'info');

        const { error } = await updateExam(examId, updates);

        if (!error) {
            showNotification('✅ Exam updated successfully!', 'success');
            closeModal();
            await loadExamsList();
            // Active students are notified automatically via Supabase
            // Realtime subscription on the `exams` table.
        } else {
            showNotification('❌ Failed to update exam', 'error');
        }
    });
};

// Note: students are notified automatically via Supabase Realtime
// subscriptions on the `exams` and `questions` tables (see exam-taker.js).
// No extra write to exam_submissions is needed.
/* ===== EXAM WIZARD ===== */
function openExamWizard() {
    wizardData = {};
    currentStep = 1;

    const subjectOptions = SUBJECTS.map(s => 
        `<option value="${s.dbName}">${s.label}</option>`
    ).join('');

    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>🎓 Create New Exam</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <div class="stepper">
            <div class="step active" id="step-1">
                <div class="step-number">1</div>
                <div class="step-label">Basic Info</div>
            </div>
            <div class="step" id="step-2">
                <div class="step-number">2</div>
                <div class="step-label">Settings</div>
            </div>
            <div class="step" id="step-3">
                <div class="step-number">3</div>
                <div class="step-label">Confirm</div>
            </div>
        </div>

        <!-- Step 1 -->
        <div class="wizard-step active" id="content-1">
            <div class="wizard-form">
                <div class="form-group">
                    <label>📚 Exam Title</label>
                    <input type="text" id="exam-title" placeholder="e.g. Final Exam - Semester 2" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>📖 Subject</label>
                        <select id="exam-subject" required>
                            <option value="">Select Subject</option>
                            ${subjectOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>⏱️ Duration (minutes)</label>
                        <input type="number" id="exam-duration" min="5" max="180" value="30" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>🔐 Exam Password (6 digits)</label>
                    <input type="text" id="exam-password" maxlength="6" placeholder="123456" required>
                </div>
            </div>
        </div>

        <!-- Step 2 -->
        <div class="wizard-step" id="content-2">
            <div class="wizard-form">
                <div class="form-group">
                    <label>Exam Type</label>
                    <div style="display: flex; gap: 20px; margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="exam-type" value="two-way" checked>
                            <span>Two Way (Can navigate)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="exam-type" value="one-way">
                            <span>One Way (No return)</span>
                        </label>
                    </div>
                </div>
                <div id="summary-box" style="background: var(--bg-light); padding: 20px; border-radius: 8px; margin-top: 20px;">
                    <p style="font-weight: 700; margin-bottom: 10px;">📋 Summary:</p>
                    <p id="summary-title" style="color: var(--text-gray); margin: 5px 0;">-</p>
                    <p id="summary-subject" style="color: var(--text-gray); margin: 5px 0;">-</p>
                    <p id="summary-duration" style="color: var(--text-gray); margin: 5px 0;">-</p>
                </div>
            </div>
        </div>

        <!-- Step 3 -->
        <div class="wizard-step" id="content-3">
            <div style="background: var(--bg-light); padding: 30px; border-radius: 12px; text-align: center;">
                <i class="fas fa-check-circle" style="font-size: 50px; color: var(--success); margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 10px; color: var(--text-dark);">Confirm Creation?</h3>
                <p style="color: var(--text-gray); margin-bottom: 20px;">You can add questions after creation</p>
                <div id="final-summary" style="text-align: right; color: var(--text-gray); font-size: 13px; line-height: 2;"></div>
            </div>
        </div>

        <!-- Navigation -->
        <div style="display: flex; gap: 10px; margin-top: 30px; justify-content: space-between;">
            <button class="btn btn-secondary" id="prev-btn" onclick="previousStep()" style="display: none;">
                ← Previous
            </button>
            <div style="display: flex; gap: 10px; margin-left: auto;">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" id="next-btn" onclick="nextStep()">Next →</button>
                <button class="btn btn-success" id="create-btn" onclick="createExamFinal()" style="display: none;">
                    ✓ Create
                </button>
            </div>
        </div>
    `;

    // Setup listeners
    document.getElementById('exam-title')?.addEventListener('input', updateSummary);
    document.getElementById('exam-subject')?.addEventListener('change', updateSummary);
    document.getElementById('exam-duration')?.addEventListener('input', updateSummary);
}

function updateSummary() {
    const title = document.getElementById('exam-title')?.value || '-';
    const subjectSelect = document.getElementById('exam-subject');
    const subject = subjectSelect?.options[subjectSelect.selectedIndex]?.text || '-';
    const duration = document.getElementById('exam-duration')?.value || '-';

    const summaryTitle = document.getElementById('summary-title');
    const summarySubject = document.getElementById('summary-subject');
    const summaryDuration = document.getElementById('summary-duration');

    if (summaryTitle) summaryTitle.textContent = `📚 Exam: ${title}`;
    if (summarySubject) summarySubject.textContent = `📖 Subject: ${subject}`;
    if (summaryDuration) summaryDuration.textContent = `⏱️ Duration: ${duration} minutes`;

    const finalSummary = document.getElementById('final-summary');
    if (finalSummary) {
        const password = document.getElementById('exam-password')?.value || '-';
        const type = document.querySelector('input[name="exam-type"]:checked')?.value || 'two-way';
        finalSummary.innerHTML = `
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Duration:</strong> ${duration} minutes</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Type:</strong> ${type === 'two-way' ? 'Two Way' : 'One Way'}</p>
        `;
    }
}

window.nextStep = function() {
    if (currentStep === 1) {
        const title = document.getElementById('exam-title')?.value;
        const subject = document.getElementById('exam-subject')?.value;
        const duration = document.getElementById('exam-duration')?.value;
        const password = document.getElementById('exam-password')?.value;

        if (!title || !subject || !duration || !password) {
            showNotification('⚠️ Please fill all fields', 'warning');
            return;
        }

        if (password.length !== 6 || !/^\d+$/.test(password)) {
            showNotification('⚠️ Password must be 6 digits', 'warning');
            return;
        }

        wizardData = { title, subject, duration: parseInt(duration), password };
    }

    if (currentStep < 3) {
        document.getElementById(`content-${currentStep}`).classList.remove('active');
        document.getElementById(`step-${currentStep}`).classList.remove('active');
        
        currentStep++;
        
        document.getElementById(`content-${currentStep}`).classList.add('active');
        document.getElementById(`step-${currentStep}`).classList.add('active');
        
        updateSummary();
        
        document.getElementById('prev-btn').style.display = currentStep > 1 ? 'inline-flex' : 'none';
        document.getElementById('next-btn').style.display = currentStep < 3 ? 'inline-flex' : 'none';
        document.getElementById('create-btn').style.display = currentStep === 3 ? 'inline-flex' : 'none';
    }
};

window.previousStep = function() {
    if (currentStep > 1) {
        document.getElementById(`content-${currentStep}`).classList.remove('active');
        document.getElementById(`step-${currentStep}`).classList.remove('active');
        
        currentStep--;
        
        document.getElementById(`content-${currentStep}`).classList.add('active');
        document.getElementById(`step-${currentStep}`).classList.add('active');
        
        document.getElementById('prev-btn').style.display = currentStep > 1 ? 'inline-flex' : 'none';
        document.getElementById('next-btn').style.display = currentStep < 3 ? 'inline-flex' : 'none';
        document.getElementById('create-btn').style.display = currentStep === 3 ? 'inline-flex' : 'none';
    }
};

window.createExamFinal = async function() {
    const isOneWay = document.querySelector('input[name="exam-type"]:checked')?.value === 'one-way';

    showNotification('⏳ Creating exam...', 'info');

    try {
        // Get subject ID
        const subjects = await getSubjects();
        const subject = subjects.find(s => s.name === wizardData.subject);

        if (!subject) {
            showNotification('❌ Subject not found', 'error');
            return;
        }

        const examData = {
            title: wizardData.title,
            subject_id: subject.id,
            exam_password: wizardData.password,
            duration_minutes: wizardData.duration,
            is_one_way: isOneWay,
            is_published: false,
            is_locked: false,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + wizardData.duration * 60000).toISOString()
        };

        const { error } = await createExam(examData);

        if (!error) {
            showNotification('✅ Exam created successfully!', 'success');
            closeModal();
            await loadExamsList();
        } else {
            showNotification(`❌ Error: ${error.message}`, 'error');
        }

    } catch (error) {
        console.error('Create exam error:', error);
        showNotification('❌ Failed to create exam', 'error');
    }
};

/* ===== QUESTION BUILDER ===== */
window.openQuestionBuilder = async function(examId) {
    const exams = await getExams();
    const exam = exams.find(e => e.id === examId);
    const questions = await getExamQuestions(examId);

    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');

    const questionsHTML = questions.length ? questions.map((q, i) => `
        <div class="question-preview">
            <h4>Q${i+1} (${q.points} pts) - ${q.question_type}</h4>
            <p>${q.content.substring(0, 100)}${q.content.length > 100 ? '...' : ''}</p>
            <p style="color: var(--success); margin-top: 8px;">✓ Answer: ${q.correct_answer}</p>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
                <button class="btn btn-warning btn-sm" onclick="editQuestion('${examId}', '${q.id}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteQuestionConfirm('${q.id}', '${examId}')">🗑️</button>
            </div>
        </div>
    `).join('') : '<p style="color: var(--text-gray); text-align: center;">No questions yet</p>';

    content.innerHTML = `
        <div class="modal-header">
            <h2>Questions: ${exam.title}</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px; padding: 15px; background: var(--bg-light); border-radius: 8px;">
            ${questionsHTML}
        </div>

        <hr style="margin: 20px 0;">

        <h3 style="margin-bottom: 15px; color: var(--text-dark);">➕ Add New Question</h3>

        <form id="add-question-form" class="wizard-form" style="display: grid; gap: 18px;">
            <div class="form-group">
                <label>Question Type</label>
                <select id="q-type" onchange="updateQuestionType()" required>
                    <option value="">Select Type</option>
                    <option value="mcq">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                    <option value="text_input">Text Input</option>
                </select>
            </div>

            <div class="form-group">
                <label>Question Text</label>
                <textarea id="q-content" placeholder="Enter question..." required></textarea>
            </div>

            <div id="mcq-options" style="display: none;">
                <div class="form-group">
                    <label>Options (one per line)</label>
                    <textarea id="q-options" placeholder="Option 1
Option 2
Option 3
Option 4" style="font-family: monospace; font-size: 12px;"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Correct Answer</label>
                    <input type="text" id="q-answer" placeholder="Exact answer" required>
                </div>
                <div class="form-group">
                    <label>Points</label>
                    <input type="number" id="q-points" value="1" min="1" required>
                </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button type="submit" class="btn btn-success">➕ Add</button>
            </div>
        </form>
    `;

    document.getElementById('add-question-form').addEventListener('submit', (e) => handleAddQuestion(e, examId, questions.length + 1));
};

window.updateQuestionType = function() {
    const type = document.getElementById('q-type')?.value;
    const mcqOptions = document.getElementById('mcq-options');
    if (mcqOptions) {
        mcqOptions.style.display = type === 'mcq' ? 'block' : 'none';
    }
};

async function handleAddQuestion(e, examId, nextOrder) {
    e.preventDefault();

    const type = document.getElementById('q-type')?.value;
    const content = document.getElementById('q-content')?.value?.trim();
    const answer = document.getElementById('q-answer')?.value?.trim();
    const points = parseInt(document.getElementById('q-points')?.value) || 1;

    if (!type || !content || !answer) {
        showNotification('⚠️ Please fill all required fields', 'warning');
        return;
    }

    let options = null;

    if (type === 'mcq') {
        const optsText = document.getElementById('q-options')?.value?.trim();
        if (!optsText) {
            showNotification('⚠️ Add options for MCQ', 'warning');
            return;
        }
        options = optsText.split('\n').map(o => o.trim()).filter(o => o);
        if (!options.includes(answer)) {
            showNotification('⚠️ Answer must be one of the options!', 'warning');
            return;
        }
    } else if (type === 'true_false') {
        options = ['صح', 'خطأ'];
    }

    const questionData = {
        exam_id: examId,
        question_type: type,
        content,
        correct_answer: answer,
        points,
        question_order: nextOrder,
        options: options
    };

    showNotification('⏳ Adding question...', 'info');

    const { error } = await createQuestion(questionData);

    if (!error) {
        showNotification('✅ Question added', 'success');
        closeModal();
        setTimeout(() => window.openQuestionBuilder(examId), 500);
    } else {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

/* ===== GLOBAL FUNCTIONS ===== */
window.togglePublish = async function(examId, publishState) {
    const { error } = await updateExam(examId, { is_published: publishState });
    if (!error) {
        showNotification(publishState ? '📢 Exam published' : '🔒 Exam hidden', 'success');
        await loadExamsList();
    }
};

window.deleteExamConfirm = async function(examId) {
    if (!confirm('⚠️ Delete this exam? All questions and submissions will be deleted!')) {
        return;
    }

    showNotification('⏳ Deleting...', 'info');
    const { error } = await deleteExam(examId);

    if (!error) {
        showNotification('✅ Exam deleted', 'success');
        await loadExamsList();
    } else {
        showNotification('❌ Delete failed', 'error');
    }
};

window.closeModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
};

document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
        closeModal();
    }
});