/* =====================================
   EXAM MANAGEMENT MODULE
   (with JSON Question Import feature)
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
    { label: 'Jordan History',    dbName: 'تاريخ الأردن',      language: 'ar' },
    { label: 'Arabic Language',   dbName: 'اللغة العربية',     language: 'ar' },
    { label: 'English Language',  dbName: 'اللغة الانجليزية',  language: 'en' }
];

let wizardData  = {};
let currentStep = 1;

export async function initExamManager() {
    const createBtn = document.getElementById('new-exam-btn');
    if (createBtn) createBtn.onclick = openExamWizard;
    await loadExamsList();
}

/* ===================================================
   EXAMS LIST
   =================================================== */
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
                </div>`;
            return;
        }

        content.innerHTML = `
            <div class="data-grid">
                ${exams.map(exam => createExamCard(exam)).join('')}
            </div>`;
    } catch (error) {
        console.error('Load exams error:', error);
        showNotification('❌ Failed to load exams', 'error');
    }
}

function createExamCard(exam) {
    return `
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
                <h3>${exam.title}</h3>
                <span class="badge ${exam.is_published ? 'badge-success' : 'badge-warning'}">
                    ${exam.is_published ? '✓ Published' : 'Draft'}
                </span>
            </div>
            <p><strong>Subject:</strong> ${exam.subjects?.name || '-'}</p>
            <p><strong>Password:</strong>
                <code style="background:var(--bg-light);padding:2px 6px;border-radius:4px;">
                    ${exam.exam_password}
                </code>
            </p>
            <p><strong>Duration:</strong> ${exam.duration_minutes}m |
               <strong>Type:</strong> ${exam.is_one_way ? 'One Way' : 'Two Way'}
            </p>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="openQuestionBuilder('${exam.id}')">
                    <i class="fas fa-list"></i> Questions
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openEditExam('${exam.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-${exam.is_published ? 'warning' : 'success'} btn-sm"
                        onclick="togglePublish('${exam.id}', ${!exam.is_published})">
                    ${exam.is_published ? '🙈 Hide' : '👁️ Publish'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteExamConfirm('${exam.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
}

/* ===================================================
   EDIT EXAM
   =================================================== */
window.openEditExam = async function(examId) {
    const exams = await getExams();
    const exam  = exams.find(e => e.id === examId);
    if (!exam) return;

    const modal   = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>⚙️ Edit Exam Settings</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="edit-exam-form" class="wizard-form" style="display:grid;gap:18px;">
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
                <div style="display:flex;gap:20px;margin-top:10px;">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="radio" name="edit-type" value="false" ${!exam.is_one_way ? 'checked' : ''}>
                        Two Way
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="radio" name="edit-type" value="true"  ${exam.is_one_way  ? 'checked' : ''}>
                        One Way
                    </label>
                </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:15px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            </div>
        </form>`;

    document.getElementById('edit-exam-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
            title:            document.getElementById('edit-title').value.trim(),
            exam_password:    document.getElementById('edit-password').value.trim(),
            duration_minutes: parseInt(document.getElementById('edit-duration').value),
            is_one_way:       document.querySelector('input[name="edit-type"]:checked').value === 'true'
        };
        showNotification('⏳ Updating exam...', 'info');
        const { error } = await updateExam(examId, updates);
        if (!error) {
            showNotification('✅ Exam updated successfully!', 'success');
            closeModal();
            await loadExamsList();
        } else {
            showNotification('❌ Failed to update exam', 'error');
        }
    });
};

/* ===================================================
   EXAM WIZARD
   =================================================== */
function openExamWizard() {
    wizardData  = {};
    currentStep = 1;

    const subjectOptions = SUBJECTS.map(s =>
        `<option value="${s.dbName}">${s.label}</option>`
    ).join('');

    const modal   = document.getElementById('modal-overlay');
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
                    <input type="text" id="exam-title" placeholder="e.g. Final Exam – Semester 2" required>
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
                    <div style="display:flex;gap:20px;margin-top:10px;">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="radio" name="exam-type" value="two-way" checked>
                            <span>Two Way (Can navigate)</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="radio" name="exam-type" value="one-way">
                            <span>One Way (No return)</span>
                        </label>
                    </div>
                </div>
                <div id="summary-box" style="background:var(--bg-light);padding:20px;border-radius:8px;margin-top:20px;">
                    <p style="font-weight:700;margin-bottom:10px;">📋 Summary:</p>
                    <p id="summary-title"   style="color:var(--text-gray);margin:5px 0;">-</p>
                    <p id="summary-subject" style="color:var(--text-gray);margin:5px 0;">-</p>
                    <p id="summary-duration"style="color:var(--text-gray);margin:5px 0;">-</p>
                </div>
            </div>
        </div>

        <!-- Step 3 -->
        <div class="wizard-step" id="content-3">
            <div style="background:var(--bg-light);padding:30px;border-radius:12px;text-align:center;">
                <i class="fas fa-check-circle" style="font-size:50px;color:var(--success);margin-bottom:15px;"></i>
                <h3 style="margin-bottom:10px;color:var(--text-dark);">Confirm Creation?</h3>
                <p style="color:var(--text-gray);margin-bottom:20px;">You can add questions after creation</p>
                <div id="final-summary" style="text-align:right;color:var(--text-gray);font-size:13px;line-height:2;"></div>
            </div>
        </div>

        <!-- Navigation -->
        <div style="display:flex;gap:10px;margin-top:30px;justify-content:space-between;">
            <button class="btn btn-secondary" id="prev-btn" onclick="previousStep()" style="display:none;">
                ← Previous
            </button>
            <div style="display:flex;gap:10px;margin-left:auto;">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary"   id="next-btn"   onclick="nextStep()">Next →</button>
                <button class="btn btn-success"   id="create-btn" onclick="createExamFinal()" style="display:none;">
                    ✓ Create
                </button>
            </div>
        </div>`;

    document.getElementById('exam-title')?.addEventListener('input', updateSummary);
    document.getElementById('exam-subject')?.addEventListener('change', updateSummary);
    document.getElementById('exam-duration')?.addEventListener('input', updateSummary);
}

function updateSummary() {
    const title         = document.getElementById('exam-title')?.value || '-';
    const subjectSelect = document.getElementById('exam-subject');
    const subject       = subjectSelect?.options[subjectSelect.selectedIndex]?.text || '-';
    const duration      = document.getElementById('exam-duration')?.value || '-';

    const st = document.getElementById('summary-title');
    const ss = document.getElementById('summary-subject');
    const sd = document.getElementById('summary-duration');
    if (st) st.textContent = `📚 Exam: ${title}`;
    if (ss) ss.textContent = `📖 Subject: ${subject}`;
    if (sd) sd.textContent = `⏱️ Duration: ${duration} minutes`;

    const fs = document.getElementById('final-summary');
    if (fs) {
        const password = document.getElementById('exam-password')?.value || '-';
        const type     = document.querySelector('input[name="exam-type"]:checked')?.value || 'two-way';
        fs.innerHTML = `
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Duration:</strong> ${duration} minutes</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Type:</strong> ${type === 'two-way' ? 'Two Way' : 'One Way'}</p>`;
    }
}

window.nextStep = function() {
    if (currentStep === 1) {
        const title    = document.getElementById('exam-title')?.value;
        const subject  = document.getElementById('exam-subject')?.value;
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
        document.getElementById('prev-btn').style.display  = currentStep > 1 ? 'inline-flex' : 'none';
        document.getElementById('next-btn').style.display  = currentStep < 3 ? 'inline-flex' : 'none';
        document.getElementById('create-btn').style.display= currentStep === 3 ? 'inline-flex' : 'none';
    }
};

window.previousStep = function() {
    if (currentStep > 1) {
        document.getElementById(`content-${currentStep}`).classList.remove('active');
        document.getElementById(`step-${currentStep}`).classList.remove('active');
        currentStep--;
        document.getElementById(`content-${currentStep}`).classList.add('active');
        document.getElementById(`step-${currentStep}`).classList.add('active');
        document.getElementById('prev-btn').style.display  = currentStep > 1 ? 'inline-flex' : 'none';
        document.getElementById('next-btn').style.display  = currentStep < 3 ? 'inline-flex' : 'none';
        document.getElementById('create-btn').style.display= currentStep === 3 ? 'inline-flex' : 'none';
    }
};

window.createExamFinal = async function() {
    const isOneWay = document.querySelector('input[name="exam-type"]:checked')?.value === 'one-way';
    showNotification('⏳ Creating exam...', 'info');

    try {
        const subjects = await getSubjects();
        const subject  = subjects.find(s => s.name === wizardData.subject);
        if (!subject) { showNotification('❌ Subject not found', 'error'); return; }

        const examData = {
            title:            wizardData.title,
            subject_id:       subject.id,
            exam_password:    wizardData.password,
            duration_minutes: wizardData.duration,
            is_one_way:       isOneWay,
            is_published:     false,
            is_locked:        false,
            start_time:       new Date().toISOString(),
            end_time:         new Date(Date.now() + wizardData.duration * 60000).toISOString()
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

/* ===================================================
   QUESTION BUILDER  (with JSON Import)
   =================================================== */
window.openQuestionBuilder = async function(examId) {
    const exams     = await getExams();
    const exam      = exams.find(e => e.id === examId);
    const questions = await getExamQuestions(examId);

    const modal   = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    modal.classList.add('active');

    const questionsHTML = questions.length
        ? questions.map((q, i) => `
            <div class="question-preview">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div style="flex:1;">
                        <h4>Q${i+1} (${q.points} pts) –
                            <span style="font-size:11px;background:var(--bg-light);padding:2px 7px;border-radius:12px;">
                                ${q.question_type}
                            </span>
                        </h4>
                        <p style="margin:6px 0;">${q.content.substring(0, 120)}${q.content.length > 120 ? '…' : ''}</p>
                        <p style="color:var(--success);font-size:13px;">✓ ${q.correct_answer}</p>
                    </div>
                    <div style="display:flex;gap:6px;margin-right:10px;flex-shrink:0;">
                        <button class="btn btn-warning btn-sm" onclick="editQuestion('${examId}','${q.id}')">✏️</button>
                        <button class="btn btn-danger  btn-sm" onclick="deleteQuestionConfirm('${q.id}','${examId}')">🗑️</button>
                    </div>
                </div>
            </div>`).join('')
        : '<p style="color:var(--text-gray);text-align:center;">No questions yet</p>';

    content.innerHTML = `
        <div class="modal-header">
            <h2>Questions: ${exam.title}</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <!-- Existing questions -->
        <div style="max-height:260px;overflow-y:auto;margin-bottom:16px;padding:12px;
                    background:var(--bg-light);border-radius:8px;">
            ${questionsHTML}
        </div>

        <!-- Tab bar: Manual | Import JSON -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">
            <button id="tab-manual" onclick="switchQTab('manual')"
                style="padding:9px 18px;border:none;background:none;font-weight:700;
                       cursor:pointer;border-bottom:3px solid var(--primary);margin-bottom:-2px;
                       color:var(--primary);font-family:inherit;font-size:14px;">
                ✏️ Add manually
            </button>
            <button id="tab-import" onclick="switchQTab('import')"
                style="padding:9px 18px;border:none;background:none;font-weight:600;
                       cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;
                       color:var(--text-gray);font-family:inherit;font-size:14px;">
                📥 Import JSON
            </button>
        </div>

        <!-- ── MANUAL PANEL ── -->
        <div id="panel-manual">
            <form id="add-question-form" class="wizard-form" style="display:grid;gap:18px;">
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
                    <textarea id="q-content" placeholder="Enter question…" required></textarea>
                </div>
                <div id="mcq-options" style="display:none;">
                    <div class="form-group">
                        <label>Options (one per line)</label>
                        <textarea id="q-options"
                            placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"
                            style="font-family:monospace;font-size:12px;"></textarea>
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
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
                    <button type="submit" class="btn btn-success">➕ Add Question</button>
                </div>
            </form>
        </div>

        <!-- ── JSON IMPORT PANEL ── -->
        <div id="panel-import" style="display:none;">
            ${buildImportPanel(examId, questions.length)}
        </div>`;

    /* attach manual-form submit */
    document.getElementById('add-question-form')
        .addEventListener('submit', e => handleAddQuestion(e, examId, questions.length + 1));
};

/* Build the JSON import panel HTML */
function buildImportPanel(examId, existingCount) {
    return `
        <div style="margin-bottom:14px;">
            <p style="font-size:13px;color:var(--text-gray);margin-bottom:12px;">
                Upload a <code>.json</code> file or paste JSON below.
                Questions will be added after the ${existingCount} existing question${existingCount !== 1 ? 's' : ''}.
            </p>

            <!-- Format reference (collapsible) -->
            <details style="margin-bottom:14px;">
                <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary);">
                    📄 JSON format reference
                </summary>
                <pre style="margin-top:10px;background:var(--bg-light);padding:12px;border-radius:8px;
                            font-size:11.5px;overflow-x:auto;line-height:1.6;">[
  {
    "content": "ما عاصمة الأردن؟",
    "type": "mcq",
    "options": ["عمّان","دمشق","بغداد","القاهرة"],
    "answer": "عمّان",
    "points": 2
  },
  {
    "content": "الأردن دولة ساحلية",
    "type": "true_false",
    "answer": "خطأ",
    "points": 1
  },
  {
    "content": "عرّف مفهوم التنمية المستدامة",
    "type": "text_input",
    "answer": "تلبية احتياجات الحاضر دون المساس بالمستقبل",
    "points": 4
  }
]</pre>
                <p style="font-size:12px;color:var(--text-gray);margin-top:8px;">
                    Accepted <code>type</code> values:
                    <code>mcq</code> / <code>multiple_choice</code> &nbsp;·&nbsp;
                    <code>true_false</code> / <code>tf</code> &nbsp;·&nbsp;
                    <code>text_input</code> / <code>text</code> / <code>essay</code>
                </p>
            </details>

            <!-- File upload -->
            <div id="json-drop-zone"
                style="border:2px dashed var(--border);border-radius:10px;padding:22px;
                       text-align:center;cursor:pointer;position:relative;transition:all .2s;
                       margin-bottom:12px;"
                ondragover="event.preventDefault();this.style.borderColor='var(--primary)'"
                ondragleave="this.style.borderColor='var(--border)'"
                ondrop="handleJsonDrop(event,'${examId}',${existingCount})">
                <input type="file" accept=".json"
                    style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;"
                    onchange="handleJsonFile(this.files[0],'${examId}',${existingCount})">
                <div style="font-size:28px;margin-bottom:6px;">📂</div>
                <p style="font-size:14px;font-weight:600;margin-bottom:3px;">Drop JSON file here</p>
                <p style="font-size:12px;color:var(--text-gray);">or click to browse</p>
            </div>

            <!-- OR divider -->
            <div style="display:flex;align-items:center;gap:10px;margin:12px 0;
                        font-size:12px;color:var(--text-gray);">
                <div style="flex:1;height:1px;background:var(--border);"></div>
                OR paste JSON
                <div style="flex:1;height:1px;background:var(--border);"></div>
            </div>

            <!-- Paste area -->
            <textarea id="json-paste-area"
                placeholder='[{"content":"...","type":"mcq","options":[...],"answer":"...","points":2}]'
                style="width:100%;min-height:130px;padding:12px;border:1px solid var(--border);
                       border-radius:8px;font-family:monospace;font-size:12px;resize:vertical;"
                dir="ltr" spellcheck="false"></textarea>

            <!-- Error/preview area -->
            <div id="json-import-feedback" style="margin-top:10px;"></div>

            <!-- Action buttons -->
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
                <button class="btn btn-primary"
                    onclick="previewJsonImport('${examId}',${existingCount})">
                    🔍 Preview
                </button>
            </div>
        </div>`;
}

/* Switch between Manual / Import tabs */
window.switchQTab = function(tab) {
    const isManual = tab === 'manual';
    document.getElementById('panel-manual').style.display = isManual ? 'block' : 'none';
    document.getElementById('panel-import').style.display = isManual ? 'none'  : 'block';

    const tabManual = document.getElementById('tab-manual');
    const tabImport = document.getElementById('tab-import');

    tabManual.style.borderBottomColor = isManual ? 'var(--primary)' : 'transparent';
    tabManual.style.color             = isManual ? 'var(--primary)' : 'var(--text-gray)';
    tabManual.style.fontWeight        = isManual ? '700' : '600';

    tabImport.style.borderBottomColor = !isManual ? 'var(--primary)' : 'transparent';
    tabImport.style.color             = !isManual ? 'var(--primary)' : 'var(--text-gray)';
    tabImport.style.fontWeight        = !isManual ? '700' : '600';
};

/* ===================================================
   JSON IMPORT — helpers
   =================================================== */

/* Normalize any "type" string the user might write */
function normalizeQuestionType(raw) {
    const s = (raw || '').toLowerCase().replace(/[\s_\-]/g, '');
    if (['mcq','multiplechoice','choice','multiple','mc'].includes(s))       return 'mcq';
    if (['truefalse','tf','boolean','yesno'].includes(s))                    return 'true_false';
    if (['textinput','text','essay','open','short','free','written'].includes(s)) return 'text_input';
    return null;
}

/* Parse & validate raw JSON, return { questions, errors } */
function parseAndValidateJson(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        return { questions: null, errors: [`JSON syntax error: ${e.message}`] };
    }

    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const errors   = [];
    const questions = [];

    arr.forEach((q, i) => {
        const num = i + 1;
        const content = (q.content || q.question || q.text || '').toString().trim();
        const type    = normalizeQuestionType(q.type || q.question_type || '');
        const answer  = (q.answer || q.correct_answer || '').toString().trim();
        const points  = parseInt(q.points || q.marks || q.score || 1);
        const options = q.options || null;

        if (!content) { errors.push(`Q${num}: missing "content" (question text)`);   return; }
        if (!type)    { errors.push(`Q${num}: unknown type "${q.type || ''}" — use mcq / true_false / text_input`); return; }
        if (!answer)  { errors.push(`Q${num}: missing "answer"`);                    return; }
        if (isNaN(points) || points < 1) { errors.push(`Q${num}: "points" must be ≥ 1`); return; }

        if (type === 'mcq') {
            if (!Array.isArray(options) || options.length < 2) {
                errors.push(`Q${num}: mcq requires "options" array with at least 2 items`);
                return;
            }
            if (!options.includes(answer)) {
                errors.push(`Q${num}: "answer" must exactly match one of the options`);
                return;
            }
        }

        questions.push({
            content,
            question_type: type,
            correct_answer: answer,
            points,
            options: type === 'mcq'       ? options
                   : type === 'true_false' ? ['صح', 'خطأ']
                   : null
        });
    });

    return { questions: errors.length === 0 ? questions : null, errors };
}

/* Render feedback HTML */
function renderImportFeedback(questions, errors) {
    if (errors.length) {
        return `
            <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);
                        border-radius:8px;padding:12px 14px;">
                <p style="font-weight:700;color:var(--danger);margin-bottom:6px;">
                    ❌ ${errors.length} error${errors.length > 1 ? 's' : ''} found
                </p>
                <ul style="margin:0;padding-right:16px;font-size:13px;color:var(--danger);line-height:1.8;">
                    ${errors.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>`;
    }

    const total  = questions.reduce((s, q) => s + q.points, 0);
    const byType = { mcq: 0, true_false: 0, text_input: 0 };
    questions.forEach(q => byType[q.question_type]++);

    const typeLabels = { mcq: 'MCQ', true_false: 'True/False', text_input: 'Text input' };

    return `
        <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);
                    border-radius:8px;padding:12px 14px;margin-bottom:12px;">
            <p style="font-weight:700;color:var(--success);margin-bottom:8px;">
                ✅ ${questions.length} valid question${questions.length > 1 ? 's' : ''} —
                ${total} pts total
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                ${Object.entries(byType).filter(([,v])=>v>0).map(([k,v])=>`
                    <span style="font-size:11px;padding:2px 10px;border-radius:12px;
                                 background:var(--bg-light);border:1px solid var(--border);">
                        ${v} ${typeLabels[k]}
                    </span>`).join('')}
            </div>
            <!-- Preview list -->
            <div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                ${questions.map((q, i) => `
                    <div style="background:white;border:1px solid var(--border);border-radius:6px;
                                padding:9px 12px;font-size:13px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;
                                    margin-bottom:4px;">
                            <span style="font-weight:600;">Q${i+1}</span>
                            <div style="display:flex;gap:6px;">
                                <span style="font-size:11px;padding:1px 8px;border-radius:12px;
                                             background:var(--bg-light);border:1px solid var(--border);">
                                    ${typeLabels[q.question_type]}
                                </span>
                                <span style="font-size:11px;color:var(--text-gray);">
                                    ${q.points} pt${q.points > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                        <p style="margin:0 0 4px;color:var(--text-dark);">
                            ${q.content.substring(0, 100)}${q.content.length > 100 ? '…' : ''}
                        </p>
                        ${q.question_type === 'mcq' ? `
                            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                                ${q.options.map(o => `
                                    <span style="font-size:11px;padding:1px 8px;border-radius:12px;
                                                 ${o === q.correct_answer
                                                     ? 'background:rgba(16,185,129,.12);color:var(--success);border:1px solid rgba(16,185,129,.4);'
                                                     : 'background:var(--bg-light);border:1px solid var(--border);color:var(--text-gray);'}">
                                        ${o === q.correct_answer ? '✓ ' : ''}${o}
                                    </span>`).join('')}
                            </div>` : `
                            <p style="font-size:12px;color:var(--success);margin:4px 0 0;">
                                ✓ ${q.correct_answer}
                            </p>`}
                    </div>`).join('')}
            </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" id="confirm-import-btn">
                ✅ Import ${questions.length} question${questions.length > 1 ? 's' : ''}
            </button>
        </div>`;
}

/* Called from file input */
window.handleJsonFile = function(file, examId, existingCount) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const textarea = document.getElementById('json-paste-area');
        if (textarea) textarea.value = e.target.result;
        previewJsonImport(examId, existingCount);
    };
    reader.readAsText(file);
};

/* Called from drag-and-drop */
window.handleJsonDrop = function(event, examId, existingCount) {
    event.preventDefault();
    document.getElementById('json-drop-zone').style.borderColor = 'var(--border)';
    const file = event.dataTransfer.files[0];
    if (file) window.handleJsonFile(file, examId, existingCount);
};

/* Preview (validate + render, attach confirm button) */
window.previewJsonImport = function(examId, existingCount) {
    const raw      = document.getElementById('json-paste-area')?.value?.trim();
    const feedback = document.getElementById('json-import-feedback');
    if (!feedback) return;

    if (!raw) {
        feedback.innerHTML = `
            <div style="color:var(--warning);font-size:13px;padding:8px 0;">
                ⚠️ Paste JSON or upload a file first.
            </div>`;
        return;
    }

    const { questions, errors } = parseAndValidateJson(raw);
    feedback.innerHTML = renderImportFeedback(questions || [], errors);

    if (questions) {
        const confirmBtn = document.getElementById('confirm-import-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () =>
                executeJsonImport(examId, questions, existingCount)
            );
        }
    }
};

/* Actually insert the questions into the database */
async function executeJsonImport(examId, questions, existingCount) {
    const confirmBtn = document.getElementById('confirm-import-btn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳ Importing…'; }

    showNotification(`⏳ Importing ${questions.length} questions…`, 'info');

    let successCount = 0;
    let failCount    = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { error } = await createQuestion({
            exam_id:        examId,
            question_type:  q.question_type,
            content:        q.content,
            correct_answer: q.correct_answer,
            points:         q.points,
            question_order: existingCount + i + 1,
            options:        q.options
        });
        if (error) { failCount++; console.error(`Q${i+1} import error:`, error); }
        else        { successCount++; }
    }

    if (failCount === 0) {
        showNotification(`✅ ${successCount} question${successCount > 1 ? 's' : ''} imported successfully!`, 'success');
    } else {
        showNotification(`⚠️ ${successCount} imported, ${failCount} failed.`, 'warning');
    }

    closeModal();
    /* Reopen the builder so the user sees the updated list */
    setTimeout(() => window.openQuestionBuilder(examId), 400);
}

/* ===================================================
   MANUAL QUESTION FORM helpers
   =================================================== */
window.updateQuestionType = function() {
    const type      = document.getElementById('q-type')?.value;
    const mcqOptions= document.getElementById('mcq-options');
    if (mcqOptions) mcqOptions.style.display = type === 'mcq' ? 'block' : 'none';
};

async function handleAddQuestion(e, examId, nextOrder) {
    e.preventDefault();
    const type    = document.getElementById('q-type')?.value;
    const content = document.getElementById('q-content')?.value?.trim();
    const answer  = document.getElementById('q-answer')?.value?.trim();
    const points  = parseInt(document.getElementById('q-points')?.value) || 1;

    if (!type || !content || !answer) {
        showNotification('⚠️ Please fill all required fields', 'warning');
        return;
    }

    let options = null;
    if (type === 'mcq') {
        const optsText = document.getElementById('q-options')?.value?.trim();
        if (!optsText) { showNotification('⚠️ Add options for MCQ', 'warning'); return; }
        options = optsText.split('\n').map(o => o.trim()).filter(o => o);
        if (!options.includes(answer)) {
            showNotification('⚠️ Answer must be one of the options!', 'warning');
            return;
        }
    } else if (type === 'true_false') {
        options = ['صح', 'خطأ'];
    }

    showNotification('⏳ Adding question…', 'info');
    const { error } = await createQuestion({
        exam_id:        examId,
        question_type:  type,
        content,
        correct_answer: answer,
        points,
        question_order: nextOrder,
        options
    });

    if (!error) {
        showNotification('✅ Question added', 'success');
        closeModal();
        setTimeout(() => window.openQuestionBuilder(examId), 500);
    } else {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

/* ===================================================
   EDIT / DELETE QUESTION
   =================================================== */
window.editQuestion = async function(examId, questionId) {
    const questions = await getExamQuestions(examId);
    const q = questions.find(x => x.id === questionId);
    if (!q) return;

    const modal   = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    modal.classList.add('active');

    const isMultiOpt = q.question_type === 'mcq' || q.question_type === 'true_false';
    const optionsStr = Array.isArray(q.options) ? q.options.join('\n') : '';

    content.innerHTML = `
        <div class="modal-header">
            <h2>✏️ Edit Question</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="edit-q-form" class="wizard-form" style="display:grid;gap:18px;">
            <div class="form-group">
                <label>Question Type</label>
                <select id="eq-type" onchange="updateEditQuestionType()" required>
                    <option value="mcq"        ${q.question_type==='mcq'        ? 'selected':''}>Multiple Choice</option>
                    <option value="true_false" ${q.question_type==='true_false' ? 'selected':''}>True / False</option>
                    <option value="text_input" ${q.question_type==='text_input' ? 'selected':''}>Text Input</option>
                </select>
            </div>
            <div class="form-group">
                <label>Question Text</label>
                <textarea id="eq-content" required>${q.content}</textarea>
            </div>
            <div id="eq-mcq-options" style="display:${q.question_type==='mcq' ? 'block':'none'};">
                <div class="form-group">
                    <label>Options (one per line)</label>
                    <textarea id="eq-options" style="font-family:monospace;font-size:12px;">${optionsStr}</textarea>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Correct Answer</label>
                    <input type="text" id="eq-answer" value="${q.correct_answer}" required>
                </div>
                <div class="form-group">
                    <label>Points</label>
                    <input type="number" id="eq-points" value="${q.points}" min="1" required>
                </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button type="button" class="btn btn-secondary" onclick="openQuestionBuilder('${examId}')">Back</button>
                <button type="submit" class="btn btn-success"><i class="fas fa-save"></i> Save</button>
            </div>
        </form>`;

    document.getElementById('edit-q-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type    = document.getElementById('eq-type')?.value;
        const content = document.getElementById('eq-content')?.value?.trim();
        const answer  = document.getElementById('eq-answer')?.value?.trim();
        const points  = parseInt(document.getElementById('eq-points')?.value) || 1;

        let options = q.options;
        if (type === 'mcq') {
            const optsText = document.getElementById('eq-options')?.value?.trim();
            if (optsText) options = optsText.split('\n').map(o => o.trim()).filter(o => o);
            if (!options.includes(answer)) {
                showNotification('⚠️ Answer must be one of the options!', 'warning');
                return;
            }
        } else if (type === 'true_false') {
            options = ['صح', 'خطأ'];
        } else {
            options = null;
        }

        showNotification('⏳ Updating question…', 'info');
        const { error } = await updateQuestion(questionId, {
            question_type: type, content, correct_answer: answer, points, options
        });
        if (!error) {
            showNotification('✅ Question updated', 'success');
            window.openQuestionBuilder(examId);
        } else {
            showNotification(`❌ Error: ${error.message}`, 'error');
        }
    });
};

window.updateEditQuestionType = function() {
    const type = document.getElementById('eq-type')?.value;
    const el   = document.getElementById('eq-mcq-options');
    if (el) el.style.display = type === 'mcq' ? 'block' : 'none';
};

window.deleteQuestionConfirm = async function(questionId, examId) {
    if (!confirm('Delete this question?')) return;
    showNotification('⏳ Deleting…', 'info');
    const { error } = await deleteQuestion(questionId);
    if (!error) {
        showNotification('✅ Question deleted', 'success');
        window.openQuestionBuilder(examId);
    } else {
        showNotification('❌ Delete failed', 'error');
    }
};

/* ===================================================
   GLOBAL HELPERS
   =================================================== */
window.togglePublish = async function(examId, publishState) {
    const { error } = await updateExam(examId, { is_published: publishState });
    if (!error) {
        showNotification(publishState ? '📢 Exam published' : '🔒 Exam hidden', 'success');
        await loadExamsList();
    }
};

window.deleteExamConfirm = async function(examId) {
    if (!confirm('⚠️ Delete this exam? All questions and submissions will be deleted!')) return;
    showNotification('⏳ Deleting…', 'info');
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
    if (e.target.id === 'modal-overlay') closeModal();
});