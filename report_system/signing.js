// ============================================================
//  signing.js — K_Tawiah Student Report System
//  Sign In (email + SMS OTP), Teacher Sign Up, Role Redirect
// ============================================================

// 1. IMPORTS
import { initializeApp }                        from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         RecaptchaVerifier,
         signInWithPhoneNumber,
         sendEmailVerification }                from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore,
         doc, getDoc, setDoc }                  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig,
         validateEmail,
         validatePassword,
         validatePhone,
         sanitizeInput,
         showNotification,
         resolveRole,
         sendEmailNotification,
         MESSAGES }                             from "./config.js";

// 2. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ──────────────────────────────────────────────────
let confirmationResult = null;  // holds Firebase SMS confirmation
let signedInUser       = null;  // holds user after email login, before OTP

// ============================================================
//  UI STATE SWITCHERS
// ============================================================
window.showDefault = function () {
    document.getElementById("state-default").style.display        = "block";
    document.getElementById("state-signin").style.display         = "none";
    document.getElementById("state-teacher-signup").style.display = "none";
};

window.showSignIn = function () {
    document.getElementById("state-default").style.display        = "none";
    document.getElementById("state-signin").style.display         = "block";
    document.getElementById("signin-step1").style.display         = "block";
    document.getElementById("signin-step2").style.display         = "none";
};

window.showTeacherSignUp = function () {
    document.getElementById("state-default").style.display        = "none";
    document.getElementById("state-teacher-signup").style.display = "block";
};

// ============================================================
//  RECAPTCHA SETUP (required for Phone Auth)
// ============================================================
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
            auth,
            "recaptcha-container",
            { size: "invisible" }
        );
    }
}

// ============================================================
//  SIGN IN — Step 1: Email + Password
// ============================================================
window.handleSignIn = async function () {
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

        // Authenticate
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        signedInUser = userCredential.user;

        // Read Firestore profile
        const userSnap = await getDoc(doc(db, "users", signedInUser.uid));

        if (!userSnap.exists()) {
            showNotification("No profile found. Contact your administrator.", "error");
            return;
        }

        const data   = userSnap.data();
        const role   = resolveRole(data.role);
        const status = data.accountStatus;
        const phone  = data.phone;

        // Block pending teachers
        if (status === "pending") {
            window.location.href = "pending.html"; return;
        }

        // Block suspended accounts
        if (status === "suspended") {
            showNotification("Your account has been suspended. Contact the administrator.", "error");
            auth.signOut();
            return;
        }

        // If user has a phone number — require SMS OTP verification
        if (phone) {
            setupRecaptcha();
            await sendSMSOTP(phone);
            // Show step 2
            document.getElementById("signin-step1").style.display = "none";
            document.getElementById("signin-step2").style.display = "block";
        } else {
            // No phone number — skip OTP, redirect by role
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
};

// ============================================================
//  SIGN IN — Step 2: SMS OTP
// ============================================================
async function sendSMSOTP(phone) {
    try {
        // Normalize phone to E.164 format for Firebase
        let normalized = phone.replace(/\s/g, "");
        if (normalized.startsWith("0")) {
            normalized = "+233" + normalized.slice(1); // Ghana prefix
        }
        confirmationResult = await signInWithPhoneNumber(
            auth, normalized, window.recaptchaVerifier
        );
        showNotification("Verification code sent to your phone.", "success");
    } catch (error) {
        console.error("SMS OTP error:", error);
        showNotification("Could not send SMS code. Check your phone number.", "error");
    }
}

window.verifySMSOTP = async function () {
    const code = document.getElementById("signin-otp").value.trim();

    if (!code || code.length < 6) {
        showNotification("Please enter the 6-digit code.", "error"); return;
    }
    if (!confirmationResult) {
        showNotification("Session expired. Please sign in again.", "error"); return;
    }

    try {
        await confirmationResult.confirm(code);

        // Read role again after OTP confirmed
        const userSnap = await getDoc(doc(db, "users", signedInUser.uid));
        const role     = resolveRole(userSnap.data()?.role);
        redirectByRole(role);

    } catch (error) {
        console.error("OTP verify error:", error);
        showNotification("Incorrect code. Please try again.", "error");
    }
};

window.resendOTP = async function () {
    if (!signedInUser) {
        showNotification("Session expired. Please sign in again.", "error"); return;
    }
    const userSnap = await getDoc(doc(db, "users", signedInUser.uid));
    const phone    = userSnap.data()?.phone;
    if (phone) {
        setupRecaptcha();
        await sendSMSOTP(phone);
    }
};

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
window.handleTeacherSignUp = async function () {
    const fname   = sanitizeInput(document.getElementById("t-firstname").value.trim());
    const lname   = sanitizeInput(document.getElementById("t-lastname").value.trim());
    const email   = sanitizeInput(document.getElementById("t-email").value.trim());
    const phone   = sanitizeInput(document.getElementById("t-phone").value.trim());
    const pass    = document.getElementById("t-password").value;
    const confirm = document.getElementById("t-confirmpassword").value;

    // Validation
    if (!fname || !lname || !email || !phone || !pass || !confirm) {
        showNotification("Please fill in all fields.", "error"); return;
    }
    if (!validateEmail(email)) {
        showNotification("Invalid email address.", "error"); return;
    }
    if (!validatePhone(phone)) {
        showNotification("Phone number must be in format +233XXXXXXXXX or 0XXXXXXXXX.", "error"); return;
    }
    if (!validatePassword(pass)) {
        showNotification("Password must be 6+ characters with uppercase and numbers.", "error"); return;
    }
    if (pass !== confirm) {
        showNotification("Passwords do not match.", "error"); return;
    }

    try {
        showNotification("Creating account...", "info");

        // Create Firebase Auth account
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const user = cred.user;

        // Send email verification
        await sendEmailVerification(user);

        // Write Firestore document — role: "pending" until admin approves
        await setDoc(doc(db, "users", user.uid), {
            firstName:     fname,
            lastName:      lname,
            email:         email,
            phone:         phone,
            role:          "pending",
            accountStatus: "pending",
            createdAt:     new Date()
        });

        // Notify admin via email (Trigger Email Extension)
        await sendEmailNotification(db, setDoc, doc, {
            to:      "admin@ktawiah.com", // replace with real admin email
            subject: "New Teacher Account Pending Approval",
            text:    `A new teacher account has been created and requires your approval.\n\nName: ${fname} ${lname}\nEmail: ${email}\n\nPlease log in to the admin dashboard to approve or reject this account.`,
            html:    `<h2>New Teacher Account Pending Approval</h2>
                      <p><strong>Name:</strong> ${fname} ${lname}</p>
                      <p><strong>Email:</strong> ${email}</p>
                      <p>Please log in to the <a href="https://ktawiah.com/admin.html">Admin Dashboard</a> to approve or reject this account.</p>`
        });

        showNotification("Account created! Awaiting admin approval. Check your email.", "success");

        // Redirect to pending page
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
};