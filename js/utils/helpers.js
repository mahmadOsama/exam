/* =====================================
   UTILITY HELPER FUNCTIONS
   ===================================== */

/* ===== DATE & TIME ===== */
export function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-JO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

export function formatTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('ar-JO', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return `${formatDate(d)} ${formatTime(d)}`;
}

export function getTimeRemaining(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;

    if (diff <= 0) return '00:00';

    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    const hours = Math.floor(diff / 1000 / 60 / 60);

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* ===== VALIDATION ===== */
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export function validateUsername(username) {
    return username.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(username);
}

export function validatePassword(password) {
    return password.length >= 6;
}

export function validateExamPassword(password) {
    return password.length === 6 && /^\d+$/.test(password);
}

/* ===== FORMATTING ===== */
export function formatScore(score, maxScore) {
    if (!score || !maxScore) return '0%';
    return `${Math.round((score / maxScore) * 100)}%`;
}

export function formatPercentage(value, total) {
    if (!value || !total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
}

export function truncateText(text, length = 50) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

export function capitalizeFirst(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ===== ARRAYS & OBJECTS ===== */
export function groupBy(array, key) {
    return array.reduce((result, obj) => {
        const group = obj[key];
        if (!result[group]) {
            result[group] = [];
        }
        result[group].push(obj);
        return result;
    }, {});
}

export function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];

        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

export function filterArray(array, key, value) {
    return array.filter(item => item[key] === value);
}

export function removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
        const val = item[key];
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
    });
}

/* ===== STORAGE ===== */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Storage error:', error);
        return false;
    }
}

export function getFromStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Storage error:', error);
        return null;
    }
}

export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Storage error:', error);
        return false;
    }
}

/* ===== MATH & CALCULATIONS ===== */
export function calculateAverage(numbers) {
    if (!numbers.length) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

export function calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculatePercentile(value, array) {
    const sorted = [...array].sort((a, b) => a - b);
    const index = sorted.indexOf(value);
    return Math.round((index / sorted.length) * 100);
}

/* ===== RANDOM ===== */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generatePassword(length = 6) {
    return Math.random().toString(36).substr(2, length);
}

export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/* ===== DEBOUNCE & THROTTLE ===== */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/* ===== DOM ===== */
export function addClass(element, className) {
    element?.classList.add(className);
}

export function removeClass(element, className) {
    element?.classList.remove(className);
}

export function toggleClass(element, className) {
    element?.classList.toggle(className);
}

export function hasClass(element, className) {
    return element?.classList.contains(className) || false;
}

export function setAttributes(element, attributes) {
    Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
    });
}

export function removeElement(element) {
    element?.remove();
}

export function clearElement(element) {
    if (element) {
        element.innerHTML = '';
    }
}