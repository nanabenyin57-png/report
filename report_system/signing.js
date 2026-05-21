// ============================================================
//  signing.js — K_Tawiah Student Report System
//  Sign In (email + SMS OTP), Teacher Sign Up, Role Redirect
//  NOTE: No onclick handlers in HTML — all wired via addEventListener
// ============================================================

// 1. IMPORTS
import { initializeApp }             from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         RecaptchaVerifier,
         signInWithPhoneNumber,
         sendEmailVerification }     from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore,
         doc, getDoc, setDoc }       from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig,
         validateEmail,
         validatePassword,
         validatePhone,
         sanitizeInput,
         showNotification,
         resolveRole,
         sendEmailNotification,
         MESSAGES }                  from "./config.js";

// 2. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ──────────────────────────────────────────────────
let confirmationResult = null;
let signedInUser       = null;

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
    document.getElementById("signin-step1").style.display         = "block";
    document.getElementById("signin-step2").style.display         = "none";
}

function showTeacherSignUp() {
    document.getElementById("state-default").style.display        = "none";
    document.getElementById("state-teacher-signup").style.display = "block";
}

// ============================================================
//  RECAPTCHA (required for Phone Auth)
// ============================================================
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
            auth, "recaptcha-container", { size: "invisible" }
        );
    }
}

// ============================================================
//  SIGN IN — Step 1: Email + Password
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

        // Step 1: Authenticate with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        signedInUser = userCredential.user;

        // Step 2: Read Firestore profile
        const userSnap = await getDoc(doc(db, "users", signedInUser.uid));

        if (!userSnap.exists()) {
            showNotification("No profile found. Contact your administrator.", "error");
            auth.signOut();
            return;
        }

        const data   = userSnap.data();
        const role   = resolveRole(data.role);
        const status = data.accountStatus;
        const phone  = data.phone;

        // Step 3: Admins always get through — no status or OTP block
        if (role === "admin") {
            redirectByRole("admin");
            return;
        }

        // Step 4: Block suspended accounts
        if (status === "suspended") {
            showNotification("Your account has been suspended. Contact the administrator.", "error");
            auth.signOut();
            return;
        }

        // Step 5: Block pending accounts (non-admins only)
        if (status === "pending") {
            window.location.href = "pending.html";
            return;
        }

        // Step 6: Active account — require SMS OTP if phone exists
        if (phone) {
            setupRecaptcha();
            await sendSMSOTP(phone);
            document.getElementById("signin-step1").style.display = "none";
            document.getElementById("signin-step2").style.display = "block";
        } else {
            // No phone number — redirect directly by role
            redirectByRole(role);
        }

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
//  SIGN IN — Step 2: SMS OTP
// ============================================================
async function sendSMSOTP(phone) {
    try {
        let normalized = phone.replace(/\s/g, "");
        if (normalized.startsWith("0")) normalized = "+233" + normalized.slice(1);
        confirmationResult = await signInWithPhoneNumber(
            auth, normalized, window.recaptchaVerifier
        );
        showNotification("Verification code sent to your phone.", "success");
    } catch (error) {
        console.error("SMS OTP error:", error);
        showNotification("Could not send SMS code. Check your phone number.", "error");
    }
}

async function verifySMSOTP() {
    const code = document.getElementById("signin-otp").value.trim();
    if (!code || code.length < 6) {
        showNotification("Please enter the 6-digit code.", "error"); return;
    }
    if (!confirmationResult) {
        showNotification("Session expired. Please sign in again.", "error"); return;
    }
    try {
        await confirmationResult.confirm(code);
        const userSnap = await getDoc(doc(db, "users", signedInUser.uid));
        const role     = resolveRole(userSnap.data()?.role);
        redirectByRole(role);
    } catch (error) {
        console.error("OTP verify error:", error);
        showNotification("Incorrect code. Please try again.", "error");
    }
}

async function resendOTP() {
    if (!signedInUser) {
        showNotification("Session expired. Please sign in again.", "error"); return;
    }
    const userSnap = await getDoc(doc(db, "users", signedInUser.uid));
    const phone    = userSnap.data()?.phone;
    if (phone) { setupRecaptcha(); await sendSMSOTP(phone); }
}

// ============================================================
//  ROLE-BASED REDIRECT
// ============================================================
function redirectByRole(role) {
    const routes = {
        admin:   "admin.html",
        teacher: "teacher.html",
        student: "student.html"
    };
    const dest = routes[role];
    if (dest) {
        showNotification("Welcome back!", "success");
        window.location.href = dest;
    } else {
        showNotification("Unknown role. Contact your administrator.", "warning");
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

        // Send email verification
        await sendEmailVerification(user);

        // Save to Firestore as pending
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
                      <p>Log in to the <a href="admin.html">Admin Dashboard</a> to approve or reject.</p>`
        });

        showNotification("Account created! Awaiting admin approval.", "success");
        setTimeout(() => { window.location.href = "pending.html"; }, 2000);

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
    document.getElementById("btn-verify-otp")
        ?.addEventListener("click", verifySMSOTP);
    document.getElementById("btn-resend-otp")
        ?.addEventListener("click", resendOTP);
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