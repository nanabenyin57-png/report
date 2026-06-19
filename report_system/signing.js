// ============================================================
//  signing.js — K_Tawiah Student Report System
//  Sign In (Email + Password), Teacher Sign Up, Role Redirect
//  NOTE: No onclick handlers in HTML — all wired via addEventListener
// ============================================================

// 1. IMPORTS
import { initializeApp }             from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         sendEmailVerification }     from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore,
         doc, getDoc, setDoc }       from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig,
         validateEmail,
         validatePassword,
         validatePhone,
         sanitizeInput,
         showNotification,
         sendEmailNotification,
         MESSAGES }                  from "./config.js";

// 2. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ──────────────────────────────────────────────────
let signedInUser = null;

// ============================================================
//  UI STATE SWITCHERS
// ============================================================
function showDefault() {
    document.getElementById("state-default").style.display        = "block";
    document.getElementById("state-signin").style.display         = "none";
    document.getElementById("state-teacher-signup").style.display = "none";
}

function showSignIn() {
    document.getElementById("state-default").style.display        = "none";
    document.getElementById("state-signin").style.display         = "block";
}

function showTeacherSignUp() {
    document.getElementById("state-default").style.display        = "none";
    document.getElementById("state-teacher-signup").style.display = "block";
}

// ============================================================
//  SIGN IN — Email + Password
// ============================================================
async function handleSignIn() {
    const email    = sanitizeInput(document.getElementById("signin-email").value);
    const password = document.getElementById("signin-password").value;

    if (!email || !password) {
        showNotification("Please fill in all fields.", "error"); return;
    }
    if (!validateEmail(email)) {
        showNotification("Please enter a valid email address.", "error"); return;
    }

    try {
        showNotification("Signing in...", "info");

        // Step 1: Authenticate with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        signedInUser = userCredential.user;

        // Step 2: Read Firestore profile data
        const userSnap = await getDoc(doc(db, "users", signedInUser.uid));

        if (!userSnap.exists()) {
            showNotification("No profile found. Contact your administrator.", "error");
            auth.signOut();
            return;
        }

        const data   = userSnap.data();
        const status = data.accountStatus;

        // Normalize string roles or arrays into a clean, lowercased array
        let rolesArray = [];
        if (Array.isArray(data.role)) {
            rolesArray = data.role.map(r => String(r).toLowerCase());
        } else if (typeof data.role === "string") {
            rolesArray = [data.role.toLowerCase()];
        }

        // Catch empty roles or missing arrays
        if (rolesArray.length === 0) {
            showNotification("No roles assigned. Contact your administrator.", "warning");
            auth.signOut();
            return;
        }

        // Step 3: Admins always bypass status limitations
        if (rolesArray.includes("admin")) {
            redirectByRole(rolesArray);
            return;
        }

        // Step 4: Block suspended accounts
        if (status === "suspended") {
            showNotification("Your account has been suspended. Contact the administrator.", "error");
            auth.signOut();
            return;
        }

        // Step 5: Route pending accounts
        if (status === "pending") {
            window.location.href = "pending.html";
            return;
        }

        // Step 6: Active accounts bypass SMS and route immediately based on role priority
        redirectByRole(rolesArray);

    } catch (error) {
        console.error("Sign In error:", error);
        const msgs = {
            "auth/user-not-found":         "No account found with this email.",
            "auth/wrong-password":         "Incorrect password.",
            "auth/invalid-credential":     "Invalid email or password.",
            "auth/too-many-requests":      "Too many attempts. Please try again later.",
            "auth/network-request-failed": "Network error. Check your connection."
        };
        showNotification(msgs[error.code] || MESSAGES.errors.auth, "error");
    }
}

// ============================================================
//  ROLE-BASED REDIRECT
// ============================================================
function redirectByRole(rolesArray) {
    // Priority checklist routing: Admin -> Teacher -> Student
    let dest = null;

    if (rolesArray.includes("admin")) {
        dest = "report_system/admin.html";
    } else if (rolesArray.includes("teacher")) {
        dest = "report_system/teacher.html";
    } else if (rolesArray.includes("student")) {
        dest = "report_system/student.html";
    }

    if (dest) {
        showNotification("Welcome back!", "success");
        window.location.href = dest;
    } else {
        showNotification("Unknown role profile. Contact your administrator.", "warning");
        auth.signOut();
    }
}

// ============================================================
//  TEACHER SIGN UP
// ============================================================
async function handleTeacherSignUp() {
    const fname   = sanitizeInput(document.getElementById("t-firstname").value.trim());
    const lname   = sanitizeInput(document.getElementById("t-lastname").value.trim());
    const email   = sanitizeInput(document.getElementById("t-email").value.trim());
    const phone   = sanitizeInput(document.getElementById("t-phone").value.trim());
    const pass    = document.getElementById("t-password").value;
    const confirm = document.getElementById("t-confirmpassword").value;

    if (!fname || !lname || !email || !phone || !pass || !confirm) {
        showNotification("Please fill in all fields.", "error"); return;
    }
    if (!validateEmail(email)) {
        showNotification("Invalid email address.", "error"); return;
    }
    if (!validatePhone(phone)) {
        showNotification("Phone must be in format +233XXXXXXXXX or 0XXXXXXXXX.", "error"); return;
    }
    if (!validatePassword(pass)) {
        showNotification("Password must be 6+ characters with uppercase and numbers.", "error"); return;
    }
    if (pass !== confirm) {
        showNotification("Passwords do not match.", "error"); return;
    }

    try {
        showNotification("Creating account...", "info");

        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const user = cred.user;

        // Send email verification link via Firebase
        await sendEmailVerification(user);

        // Save account state to Firestore as pending
        await setDoc(doc(db, "users", user.uid), {
            firstName:     fname,
            lastName:      lname,
            email:         email,
            phone:         phone,
            role:          "pending",
            accountStatus: "pending",
            createdAt:     new Date()
        });

        // Notify admin by email
        await sendEmailNotification(db, setDoc, doc, {
            to:      "admin@ktawiah.com",
            subject: "New Teacher Account Pending Approval",
            text:    `New teacher account requires approval.\nName: ${fname} ${lname}\nEmail: ${email}`,
            html:    `<h2>New Teacher Account Pending Approval</h2>
                      <p><strong>Name:</strong> ${fname} ${lname}</p>
                      <p><strong>Email:</strong> ${email}</p>
                      <p>Log in to the <a href="report_system/admin.html">Admin Dashboard</a> to approve or reject.</p>`
        });

        showNotification("Account created! Awaiting admin approval.", "success");
        setTimeout(() => { window.location.href = "report_system/pending.html"; }, 2000);

    } catch (error) {
        console.error("Teacher Sign Up error:", error);
        const msgs = {
            "auth/email-already-in-use": "An account with this email already exists.",
            "auth/weak-password":        "Password is too weak.",
            "auth/invalid-email":        "Invalid email address."
        };
        showNotification(msgs[error.code] || MESSAGES.errors.auth, "error");
    }
}

// ============================================================
//  WIRE UP ALL BUTTONS via addEventListener
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-signin")
        ?.addEventListener("click", showSignIn);
    document.getElementById("btn-teacher-signup")
        ?.addEventListener("click", showTeacherSignUp);
    document.getElementById("btn-handle-signin")
        ?.addEventListener("click", handleSignIn);
    document.getElementById("btn-back-signin")
        ?.addEventListener("click", showDefault);
    document.getElementById("btn-teacher-register")
        ?.addEventListener("click", handleTeacherSignUp);
    document.getElementById("btn-back-signup")
        ?.addEventListener("click", showDefault);

    // Enter key on password field triggers sign in
    document.getElementById("signin-password")
        ?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleSignIn();
        });
});