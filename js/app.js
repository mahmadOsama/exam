/* =====================================
   MAIN APPLICATION ENTRY POINT
   ===================================== */

import { initAuth, logout } from './auth.js';
import { initAdminDashboard } from './admin/dashboard.js';
import { initStudentDashboard } from './student/dashboard.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Exam Management System...');
    
    try {
        // Initialize authentication system
        await initAuth();
        
        console.log('✅ System initialized successfully');
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
});

// Handle logout globally
document.getElementById('logout-btn')?.addEventListener('click', logout);
document.getElementById('student-logout-btn')?.addEventListener('click', logout);

// Prevent accidental page exits during exam
let isExamActive = false;

window.addEventListener('beforeunload', (e) => {
    const examTaker = document.getElementById('exam-taker');
    
    if (examTaker?.classList.contains('active')) {
        // Try to save the current answer before the page unloads
        if (window.saveCurrentAnswer) {
            window.saveCurrentAnswer();
        }
        e.preventDefault();
        e.returnValue = 'You have an exam in progress. Are you sure you want to leave?';
        return 'You have an exam in progress. Are you sure you want to leave?';
    }
});

// Also try to save when tab becomes hidden (mobile app switch, tab close, etc.)
document.addEventListener('visibilitychange', () => {
    const examTaker = document.getElementById('exam-taker');
    if (document.visibilityState === 'hidden' && examTaker?.classList.contains('active')) {
        if (window.saveCurrentAnswer) {
            window.saveCurrentAnswer();
        }
    }
});

// Track exam state
window.setExamActive = (active) => {
    isExamActive = active;
};
// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});