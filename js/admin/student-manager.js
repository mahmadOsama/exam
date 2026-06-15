/* =====================================
   STUDENT MANAGEMENT MODULE
   ===================================== */

import { 
    getStudents, createStudent, updateStudent, deleteStudent 
} from '../db.js';
import { showNotification } from '../utils/notifications.js';
import { formatDateTime } from '../utils/helpers.js';

export async function initStudentManager() {
    const content = document.getElementById('students-content');
    
    // Setup button
    const createBtn = document.getElementById('new-student-btn');
    if (createBtn) {
        createBtn.onclick = openCreateStudentModal;
    }

    await loadStudentsList();
}

/* ===== STUDENTS LIST ===== */
async function loadStudentsList() {
    const content = document.getElementById('students-content');
    content.innerHTML = '<p>Loading...</p>';

    try {
        const students = await getStudents();

        if (!students.length) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-title">No students yet</div>
                    <div class="empty-state-text">Add your first student to get started</div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="data-grid">
                ${students.map(student => createStudentCard(student)).join('')}
            </div>
        `;

    } catch (error) {
        console.error('Load students error:', error);
        showNotification('❌ Failed to load students', 'error');
    }
}

function createStudentCard(student) {
    return `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h3>${student.full_name || student.username}</h3>
                <span class="badge ${student.is_active ? 'badge-success' : 'badge-danger'}">
                    ${student.is_active ? '✓ Active' : '✗ Disabled'}
                </span>
            </div>
            <p style="color: var(--text-gray); font-size: 13px;">
                👤 ${student.username}
            </p>
            <p style="color: var(--text-gray); font-size: 12px;">
                Created: ${formatDateTime(student.created_at)}
            </p>
            <div class="card-actions" style="margin-top: 15px;">
                <button class="btn btn-primary btn-sm" onclick="openEditStudent('${student.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-${student.is_active ? 'danger' : 'success'} btn-sm" 
                    onclick="toggleStudentStatus('${student.id}', ${!student.is_active})">
                    ${student.is_active ? '⛔ Disable' : '✓ Enable'}
                </button>
            </div>
        </div>
    `;
}

/* ===== CREATE STUDENT ===== */
function openCreateStudentModal() {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>👤 Add New Student</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <form id="create-student-form" class="wizard-form" style="display: grid; gap: 18px;">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="student-fullname" placeholder="Enter full name" required>
            </div>

            <div class="form-group">
                <label>Username</label>
                <input type="text" id="student-username" placeholder="No spaces allowed" required>
            </div>

            <div class="form-group">
                <label>Password</label>
                <input type="password" id="student-password" placeholder="Minimum 6 characters" required minlength="6">
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-save"></i> Add Student
                </button>
            </div>
        </form>
    `;

    document.getElementById('create-student-form').addEventListener('submit', handleCreateStudent);
}

async function handleCreateStudent(e) {
    e.preventDefault();

    const fullName = document.getElementById('student-fullname')?.value?.trim();
    const username = document.getElementById('student-username')?.value?.trim().replace(/\s/g, '');
    const password = document.getElementById('student-password')?.value;

    if (!fullName || !username || !password) {
        showNotification('⚠️ Please fill all fields', 'warning');
        return;
    }

    if (password.length < 6) {
        showNotification('⚠️ Password must be at least 6 characters', 'warning');
        return;
    }

    showNotification('⏳ Creating student...', 'info');

    const studentData = {
        full_name: fullName,
        username: username,
        password: password
    };

    const { error } = await createStudent(studentData);

    if (!error) {
        showNotification('✅ Student created successfully!', 'success');
        closeModal();
        await loadStudentsList();
    } else {
        if (error.code === '23505') {
            showNotification('❌ Username already exists', 'error');
        } else {
            showNotification(`❌ Error: ${error.message}`, 'error');
        }
    }
}

/* ===== EDIT STUDENT ===== */
window.openEditStudent = async function(studentId) {
    const students = await getStudents();
    const student = students.find(s => s.id === studentId);

    if (!student) return;

    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    modal.classList.add('active');
    content.innerHTML = `
        <div class="modal-header">
            <h2>✏️ Edit Student</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>

        <form id="edit-student-form" class="wizard-form" style="display: grid; gap: 18px;">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="edit-fullname" value="${student.full_name || ''}" required>
            </div>

            <div class="form-group">
                <label>Username</label>
                <input type="text" id="edit-username" value="${student.username}" required>
            </div>

            <div class="form-group">
                <label>New Password (optional)</label>
                <input type="password" id="edit-password" placeholder="Leave empty to keep current">
                <small style="color: var(--text-gray); font-size: 12px;">
                    Only fill if you want to change the password
                </small>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            </div>
        </form>
    `;

    document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.getElementById('edit-fullname')?.value?.trim();
        const username = document.getElementById('edit-username')?.value?.trim();
        const newPassword = document.getElementById('edit-password')?.value;

        if (!fullName || !username) {
            showNotification('⚠️ Name and username are required', 'warning');
            return;
        }

        const updates = {
            full_name: fullName,
            username: username
        };

        if (newPassword) {
            if (newPassword.length < 6) {
                showNotification('⚠️ Password must be at least 6 characters', 'warning');
                return;
            }
            updates.password = newPassword;
        }

        showNotification('⏳ Updating student...', 'info');

        const { error } = await updateStudent(studentId, updates);

        if (!error) {
            showNotification('✅ Student updated successfully!', 'success');
            closeModal();
            await loadStudentsList();
        } else {
            if (error.code === '23505') {
                showNotification('❌ Username already exists', 'error');
            } else {
                showNotification(`❌ Error: ${error.message}`, 'error');
            }
        }
    });
};

/* ===== TOGGLE STATUS ===== */
window.toggleStudentStatus = async function(studentId, newStatus) {
    const action = newStatus ? 'enable' : 'disable';
    
    if (!confirm(`Are you sure you want to ${action} this student?`)) {
        return;
    }

    showNotification(`⏳ ${newStatus ? 'Enabling' : 'Disabling'} student...`, 'info');

    const { error } = await updateStudent(studentId, { is_active: newStatus });

    if (!error) {
        showNotification(
            newStatus ? '✅ Student enabled' : '⛔ Student disabled', 
            newStatus ? 'success' : 'warning'
        );
        await loadStudentsList();
    } else {
        showNotification('❌ Failed to update status', 'error');
    }
};

/* ===== CLOSE MODAL ===== */
window.closeModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
};