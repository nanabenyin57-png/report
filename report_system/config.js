// config.js - Centralized configuration for the K_Tawiah Student Report System

// Firebase Configuration
export const firebaseConfig = {
    apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
    authDomain: "reportbase-669ff.firebaseapp.com",
    projectId: "reportbase-669ff",
    storageBucket: "reportbase-669ff.firebasestorage.app",
    messagingSenderId: "244941864396",
    appId: "1:244941864396:web:aebc946e160a0172edf169",
    measurementId: "G-KBTRR8YZFJ"
};

// Department and Class Data
export const DEPARTMENTS = {
    "Preschool": ["Numeracy", "Literacy", "Creative Arts", "Our World"],
    "LowerPrimary": ["English", "Maths", "Science", "History", "Our World", "RME", "Twi"],
    "UpperPrimary": ["English", "Maths", "Science", "History", "Computing", "RME", "Twi"],
    "JuniorHigh": ["English", "Maths", "Science", "Social Studies", "Computing", "Pre-Tech", "RME", "Twi"]
};

// Department and Classes
export const CLASSES = {
    "Preschool": ["Nursery", "Kindergarten1", "Kindergarten2"],
    "LowerPrimary": ["Basic1", "Basic2", "Basic3"],
    "UpperPrimary": ["Basic4", "Basic5", "Basic6"],
    "JuniorHigh": ["JHS1", "JHS2", "JHS3"]
};

// Stream name patterns for each class
export const STREAM_PATTERNS = {
    "Nursery": "N",
    "Kindergarten1": "K1",
    "Kindergarten2": "K2",
    "Basic1": "B1",
    "Basic2": "B2",
    "Basic3": "B3",
    "Basic4": "B4",
    "Basic5": "B5",
    "Basic6": "B6",
    "JHS1": "J1",
    "JHS2": "J2",
    "JHS3": "J3"
};

// Function to generate streams based on class and number of streams
export function generateStreams(className, numStreams) {
    const pattern = STREAM_PATTERNS[className];
    if (!pattern || !numStreams) return [];
    
    const streams = [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    for (let i = 0; i < Math.min(numStreams, 8); i++) {
        streams.push(`${pattern}-${letters[i]}`);
    }
    return streams;
}

// Grading Scale
export const GRADING_SCALE = {
    A1: { min: 80, label: "A1 (Excellent)" },
    B2: { min: 70, label: "B2 (Very Good)" },
    B3: { min: 60, label: "B3 (Good)" },
    C4: { min: 55, label: "C4 (Credit)" },
    C5: { min: 50, label: "C5 (Credit)" },
    C6: { min: 45, label: "C6 (Pass)" },
    D7: { min: 40, label: "D7 (Pass)" },
    F9: { min: 0, label: "F9 (Fail)" }
};

// Validation Rules
export const VALIDATION = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    password: {
        minLength: 6,
        hasUppercase: /[A-Z]/,
        hasLowercase: /[a-z]/,
        hasNumber: /\d/
    },
    indexNumber: /^KT-\d{3}$/
};

// UI Messages
export const MESSAGES = {
    errors: {
        network: "Network error. Please check your connection.",
        auth: "Authentication failed. Please try again.",
        permission: "You don't have permission to perform this action.",
        validation: "Please check your input and try again.",
        save: "Failed to save data. Please try again."
    },
    success: {
        saved: "Data saved successfully!",
        published: "Report published to students!",
        registered: "Student registered successfully!"
    },
    loading: {
        saving: "Saving...",
        loading: "Loading...",
        publishing: "Publishing..."
    }
};

// Utility Functions
export function calculateGrade(score) {
    for (const [key, grade] of Object.entries(GRADING_SCALE)) {
        if (score >= grade.min) {
            return grade.label;
        }
    }
    return GRADING_SCALE.F9.label;
}

export function validateEmail(email) {
    return VALIDATION.email.test(email);
}

export function validatePassword(password) {
    return password.length >= VALIDATION.password.minLength &&
           VALIDATION.password.hasUppercase.test(password) &&
           VALIDATION.password.hasLowercase.test(password) &&
           VALIDATION.password.hasNumber.test(password);
}

export function validateIndexNumber(index) {
    return VALIDATION.indexNumber.test(index);
}

export function sanitizeInput(input) {
    return input.trim().replace(/[<>]/g, '');
}

export function showNotification(message, type = 'info') {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Set background color based on type
    let backgroundColor = '#4444ff'; // default info
    if (type === 'error') backgroundColor = '#ff4444';
    else if (type === 'success') backgroundColor = '#44ff44';

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${backgroundColor};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}