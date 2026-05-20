// ============================================================
//  config.js — K_Tawiah Student Report System
//  Shared Firebase config, utilities, and constants
// ============================================================

// 1. FIREBASE CONFIG
export const firebaseConfig = {
    apiKey:            "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
    authDomain:        "reportbase-669ff.firebaseapp.com",
    projectId:         "reportbase-669ff",
    storageBucket:     "reportbase-669ff.firebasestorage.app",
    messagingSenderId: "244941864396",
    appId:             "1:244941864396:web:aebc946e160a0172edf169",
    measurementId:     "G-KBTRR8YZFJ"
};

// 2. SUBJECTS PER DEPARTMENT
// Used by teacher.js (SBA, Exams, Reports) and admin.js
export const DEPARTMENT_SUBJECTS = {
    Preschool:    ["LITERACY", "NUMERACY", "CREATIVE ARTS", "WRITING"],
    LowerPrimary: ["ENGLISH", "MATHS", "SCIENCE", "HISTORY", "RELIGIOUS EDUCATION", "CREATIVE ARTS", "FRENCH", "TWI"],
    UpperPrimary: ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "HISTORY", "RELIGIOUS EDUCATION", "CREATIVE ARTS", "FRENCH", "TWI"],
    JuniorHigh:   ["ENGLISH", "MATHS", "SCIENCE", "COMPUTING", "SOCIAL STUDIES", "RELIGIOUS EDUCATION", "CREATIVE ARTS", "FRENCH", "TWI", "CAREER TECHNOLOGY"]
};

// Department a class code belongs to — derived from prefix
export function getDepartment(classCode) {
    const code = classCode.toUpperCase();
    if (code.startsWith("N"))   return "Preschool";
    if (code.startsWith("KG"))  return "Preschool";
    if (code.match(/^B[123]/))  return "LowerPrimary";
    if (code.match(/^B[456]/))  return "UpperPrimary";
    if (code.startsWith("JHS")) return "JuniorHigh";
    return "Unknown";
}

// 3. GRADING
export function getGrade(score) {
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    if (score >= 40) return "E";
    return "F";
}

export function getRemarks(score) {
    if (score >= 80) return "Excellent";
    if (score >= 70) return "Very Good";
    if (score >= 60) return "Good";
    if (score >= 50) return "Average";
    if (score >= 40) return "Below Average";
    return "Unsatisfactory";
}

// 4. INDEX NUMBER GENERATOR
// Format: KT-[ClassCode]-[001]
export async function generateIndexNumber(db, classCode, getDocs, collection, query, where) {
    try {
        const q = query(
            collection(db, "users"),
            where("classCode", "==", classCode),
            where("role", "==", "student")
        );
        const snap = await getDocs(q);
        const count = snap.size + 1;
        const padded = String(count).padStart(3, "0");
        return `KT-${classCode}-${padded}`;
    } catch (err) {
        console.error("Error generating index number:", err);
        return null;
    }
}

// 5. VALIDATION
export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
    // Min 6 chars, at least one uppercase, one lowercase, one number
    return password.length >= 6 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password);
}

export function validatePhone(phone) {
    // Accepts formats: +233XXXXXXXXX, 0XXXXXXXXX (Ghana numbers)
    return /^(\+233|0)[0-9]{9}$/.test(phone.replace(/\s/g, ""));
}

export function validateIndexNumber(indexNo) {
    // Format: KT-[ClassCode]-[001..999]
    return /^KT-[A-Z0-9]+-\d{3}$/.test(indexNo.toUpperCase());
}

export function sanitizeInput(value) {
    return value.trim().replace(/[<>]/g, "");
}

// 6. NOTIFICATIONS — Firebase Trigger Email Extension
// Writes to the "mail" collection which the extension reads automatically
export async function sendEmailNotification(db, setDoc, doc, { to, subject, text, html }) {
    try {
        const id = `mail_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await setDoc(doc(db, "mail", id), {
            to,
            message: { subject, text, html: html || text }
        });
        console.log("Email queued for:", to);
        return true;
    } catch (err) {
        console.error("Email notification error:", err);
        return false;
    }
}

// SMS via Firebase Phone Auth OTP — used for verification only
// For result notifications, we log them and use email as primary
export async function logSMSNotification(db, addDoc, collection, { phone, message, type }) {
    try {
        await addDoc(collection(db, "notifications"), {
            type:      type || "sms",
            recipient: phone,
            message,
            status:    "queued",
            sentAt:    new Date()
        });
        return true;
    } catch (err) {
        console.error("SMS log error:", err);
        return false;
    }
}

// 7. UI — Toast Notifications (used across all pages)
export function showNotification(message, type = "info") {
    // Remove any existing toast
    const existing = document.getElementById("kt-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "kt-toast";
    toast.className = `kt-toast kt-toast--${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add("kt-toast--show"), 10);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.remove("kt-toast--show");
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// 8. ROLE RESOLVER — handles both string "admin" and array ["admin","teacher"]
export function resolveRole(rawRole) {
    if (Array.isArray(rawRole)) {
        if (rawRole.includes("admin"))   return "admin";
        if (rawRole.includes("teacher")) return "teacher";
        if (rawRole.includes("student")) return "student";
        return "unknown";
    }
    return rawRole || "unknown";
}

// 9. MESSAGES
export const MESSAGES = {
    errors: {
        auth:        "Authentication failed. Please try again.",
        permission:  "You do not have permission to do that.",
        notFound:    "Record not found.",
        network:     "Network error. Please check your connection."
    },
    success: {
        saved:       "Changes saved successfully.",
        created:     "Account created successfully.",
        published:   "Results published and students notified.",
        deleted:     "Record deleted successfully."
    }
};