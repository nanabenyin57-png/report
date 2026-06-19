// =============================================
//   K_Tawiah — config.js
//   Shared configuration, utilities & helpers
// =============================================

// ── FIREBASE CONFIG ───────────────────────────
export const firebaseConfig = {
  apiKey:            "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain:        "reportbase-669ff.firebaseapp.com",
  projectId:         "reportbase-669ff",
  storageBucket:     "reportbase-669ff.appspot.com",
  messagingSenderId: "244941864396",
  appId:             "1:244941864396:web:aebc946e160a0172edf169"
};

// ── DEPARTMENT / SUBJECTS ─────────────────────
export const DEPARTMENT_SUBJECTS = {
  "PreSchool":     ["Numeracy", "Literacy", "Writing", "Creative Arts"],
  "LowerPrimary":        ["Mathematics", "English", "Science", "Religious And Moral Education", "History", "Creative Arts", "French", "TWI", "Abacus"],
  "UpperPrimary":   ["Mathematics", "English", "Science", "Religious And Moral Education", "History", "Creative Arts", "French", "TWI","Computing","Abacus"], 
  "JuniorHigh":     ["Mathematics", "English", "Science", "Religious And Moral Education", "Social Studies", "Creative Arts", "French", "TWI","Computing","Career Technology"],
};

export function getDepartment(classCode) {
  if (!classCode) return "General";
  const code = classCode.toUpperCase();
  if (code.includes("SC") || code.includes("SCI")) return "Science";
  if (code.includes("AR") || code.includes("ART")) return "Arts";
  if (code.includes("BU") || code.includes("BUS")) return "Business";
  if (code.includes("TE") || code.includes("TEC")) return "Technical";
  return "General";
}

// ── GRADE COMPUTATION ─────────────────────────
export function getGrade(score) {
  if (score >= 80) return "A1";
  if (score >= 75) return "B2";
  if (score >= 70) return "B3";
  if (score >= 65) return "C4";
  if (score >= 60) return "C5";
  if (score >= 55) return "C6";
  if (score >= 50) return "D7";
  if (score >= 45) return "E8";
  return "F9";
}

// ── REMARKS LIST ──────────────────────────────
export function getRemarks() {
  return [
    "Excellent performance",
    "Very good effort",
    "Good work, keep it up",
    "Satisfactory performance",
    "Needs improvement",
    "Must work harder",
    "Below average — extra support needed",
    "Poor performance — urgent attention required",
    "Shows great potential",
    "Consistent and hardworking",
    "Easily distracted — needs focus",
    "Brilliant student",
    "Average performance",
    "Making steady progress"
  ];
}

// ── INDEX NUMBER GENERATION ───────────────────
export function generateIndexNumber(classCode, position) {
  const code    = (classCode || "XX").toUpperCase().replace(/\s+/g, "");
  const padded  = String(position).padStart(3, "0");
  return `KT-${code}-${padded}`;
}

// ── VALIDATION HELPERS ────────────────────────
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  return password && password.length >= 8;
}

export function validatePhone(phone) {
  return /^\+?[\d\s\-]{10,15}$/.test(phone);
}

export function validateIndexNumber(index) {
  return /^KT-[A-Z0-9]+-\d{3}$/.test(index);
}

export function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>'"]/g, "").trim();
}

// ── ROLE RESOLVER ─────────────────────────────
/**
 * Resolves a role value from Firestore into an array of lowercase role strings.
 * Handles:
 *   - Array:              ["admin", "teacher"]      → ["admin", "teacher"]
 *   - Comma string:       "admin, teacher"          → ["admin", "teacher"]
 *   - Single string:      "admin"                   → ["admin"]
 *   - Whitespace string:  "admin "                  → ["admin"]
 */
export function resolveRole(role) {
  if (Array.isArray(role)) {
    return role.map(r => String(r).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof role === "string") {
    if (role.includes(",")) {
      return role.split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
    }
    return [role.trim().toLowerCase()].filter(Boolean);
  }
  return ["unknown"];
}

/**
 * Check if a resolved role array includes a specific role.
 * Usage: hasRole(resolveRole(data.role), "admin")
 */
export function hasRole(roles, target) {
  if (!Array.isArray(roles)) roles = resolveRole(roles);
  return roles.includes(target.toLowerCase());
}

// ── EMAIL NOTIFICATION ────────────────────────
/**
 * Writes a document to the `mail` collection for the
 * Firebase Trigger Email extension to send.
 */
export async function sendEmailNotification(to, subject, text, db) {
  if (!db) { console.warn("sendEmailNotification: db instance required"); return; }
  try {
    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js");
    await addDoc(collection(db, "mail"), {
      to,
      message: { subject, text }
    });
  } catch (err) {
    console.error("Failed to send email notification:", err);
  }
}

// ── TOAST NOTIFICATION ────────────────────────
export function showNotification(message, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.style.cssText = `
      position:fixed; bottom:24px; right:24px;
      display:flex; flex-direction:column; gap:10px; z-index:9999;
    `;
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  const colors = {
    success: { bg: "rgba(16,185,129,0.2)",  border: "rgba(16,185,129,0.4)", color: "#10b981" },
    error:   { bg: "rgba(239,68,68,0.2)",   border: "rgba(239,68,68,0.4)",  color: "#ef4444" },
    info:    { bg: "rgba(59,130,246,0.2)",   border: "rgba(59,130,246,0.4)", color: "#3b82f6" },
    warning: { bg: "rgba(245,158,11,0.2)",   border: "rgba(245,158,11,0.4)", color: "#f59e0b" }
  };
  const c = colors[type] || colors.info;
  toast.style.cssText = `
    padding:12px 18px; border-radius:8px; font-size:13px; font-weight:500;
    backdrop-filter:blur(12px); max-width:300px; font-family:'DM Sans',sans-serif;
    background:${c.bg}; border:1px solid ${c.border}; color:${c.color};
    animation: toastIn 0.3s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── MESSAGES ──────────────────────────────────
export const MESSAGES = {
  loginSuccess:     "Welcome back!",
  loginFailed:      "Invalid email or password.",
  signupSuccess:    "Account created. Awaiting admin approval.",
  suspended:        "Your account has been suspended. Contact admin.",
  pending:          "Your account is pending approval.",
  sessionExpired:   "Session expired. Please sign in again.",
  networkError:     "Network error. Check your connection.",
  permissionDenied: "You do not have permission to perform this action.",
  saved:            "Changes saved successfully.",
  deleted:          "Record deleted.",
  submitted:        "Report submitted to admin."
};