/* =====================================
   AUTHENTICATION SYSTEM
   ===================================== */

import { supabase } from './db.js';
import { showNotification } from './utils/notifications.js';
import { initAdminDashboard } from './admin/dashboard.js';
import { initStudentDashboard } from './student/dashboard.js';

// Admin credentials
const ADMIN_USERNAME = 'mahmadosama1';
const ADMIN_PASSWORD = '20032003';

// DOM Elements
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');

let currentUser = null;

/* ===== INITIALIZATION ===== */
export async function initAuth() {
    // Check for existing session
    currentUser = JSON.parse(localStorage.getItem('examSystemUser')) || null;

    if (currentUser) {
        restoreSession();
    } else {
        showScreen('login-screen');
    }

    // Setup login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

/* ===== LOGIN HANDLER ===== */
async function handleLogin(e) {
    e.preventDefault();

    const username = usernameInput?.value?.trim() || '';
    const password = passwordInput?.value?.trim() || '';

    if (!username || !password) {
        showNotification('⚠️ Please enter username and password', 'warning');
        return;
    }

    setLoading(true);

    try {
        // Check if admin
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            currentUser = {
                id: 'admin-001',
                username: ADMIN_USERNAME,
                role: 'admin',
                full_name: 'Administrator',
                is_active: true
            };
            
            localStorage.setItem('examSystemUser', JSON.stringify(currentUser));
            restoreSession();
            showNotification('✅ Welcome to Admin Dashboard', 'success');
            return;
        }

        // Check if student in database
        const { data: student, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !student) {
            showNotification('❌ Invalid username or password', 'error');
            passwordInput.value = '';
            return;
        }

        currentUser = {
            ...student,
            role: 'student'
        };

        localStorage.setItem('examSystemUser', JSON.stringify(currentUser));
        restoreSession();
        showNotification('✅ Login successful', 'success');

    } catch (error) {
        console.error('Login error:', error);
        showNotification('❌ Login failed', 'error');
    } finally {
        setLoading(false);
    }
}

/* ===== SESSION MANAGEMENT ===== */
function restoreSession() {
    if (!currentUser) return;

    if (currentUser.role === 'admin') {
        showScreen('admin-screen');
        initAdminDashboard();
    } else if (currentUser.role === 'student') {
        document.getElementById('student-name').textContent = 
            currentUser.full_name || currentUser.username;
        showScreen('student-screen');
        initStudentDashboard();
    }
}

export async function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    currentUser = null;
    localStorage.removeItem('examSystemUser');

    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';

    showScreen('login-screen');
    showNotification('👋 You have been logged out', 'info');
}

/* ===== UTILITY FUNCTIONS ===== */
export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

export function getCurrentUser() {
    return currentUser;
}

export function isAdmin() {
    return currentUser?.role === 'admin';
}

export function isStudent() {
    return currentUser?.role === 'student';
}

function setLoading(isLoading) {
    const btn = loginForm?.querySelector('.btn');
    const btnText = btn?.querySelector('span');
    const spinner = btn?.querySelector('.fa-spinner');

    if (btn) btn.disabled = isLoading;
    if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
    if (spinner) spinner.style.display = isLoading ? 'inline' : 'none';
}