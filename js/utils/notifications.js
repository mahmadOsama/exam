/* =====================================
   NOTIFICATION SYSTEM
   ===================================== */

export function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const iconMap = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };

    notification.innerHTML = `
        <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

export function showLoadingNotification(message) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.id = 'loading-notification';

    notification.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);
    return notification;
}

export function hideLoadingNotification() {
    const notification = document.getElementById('loading-notification');
    if (notification) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }
}

export function confirmAction(message) {
    return new Promise((resolve) => {
        const result = confirm(message);
        resolve(result);
    });
}