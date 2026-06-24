// ============================================================
//  signing.js — K_Tawiah Student Report System
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

let signedInUser = null;

// ============================================================
//  ROLE SELECTION CHANGE LISTENER
// ============================================================
document.getElementById("role_select").addEventListener("change", function() {
    const selectedRole = this.value;
    const studentSigninSection = document.getElementById("student_signin");
    const teacherSigninSection = document.getElementById("signin-step1");
    
    if (selectedRole === "teacher") {
        studentSigninSection.style.display = "none";
        teacherSigninSection.style.display = "block";
    } else if (selectedRole === "student") {
        studentSigninSection.style.display = "block";
        teacherSigninSection.style.display = "none";
    } else {
        studentSigninSection.style.display = "none";
        teacherSigninSection.style.display = "none";
    }
});

// ============================================================
//  UI VISIBILITY STATE FUNCTIONS
// ============================================================
function showSignIn() {
    document.getElementById("state-default").style.display = "none";
    document.getElementById("state-signin").style.display  = "block";
    
    // Clear and force default layout structure states
    document.getElementById("role_select").value = "choice";
    document.getElementById("student_signin").style.display = "none";
    document.getElementById("signin-step1").style.display = "none";
}

function showTeacherSignUp() {
    document.getElementById("state-default").style.display        = "none";
    document.getElementById("state-signin").style.display         = "none";
    document.getElementById("state-teacher-signup").style.display = "block";
}

function showDefault() {
    document.getElementById("state-default").style.display        = "block";
    document.getElementById("state-signin").style.display         = "none";
    document.getElementById("state-teacher-signup").style.display = "none";
}

// ============================================================
//  AUTHENTICATION CONTROLLER LOGIC
// ============================================================
async function handleSignIn() {
    const role = document.getElementById("role_select").value;
    let email = "";
    let password = "";

    if (role === "choice" || !role) {
        showNotification("Please select your role first.", "error");
        return;
    }

    if (role === "student") {
        const indexNumber = sanitizeInput(document.getElementById("student_index").value.trim());
        const studentEmailPass = document.getElementById("student_password").value.trim();

        if (!indexNumber || !studentEmailPass) {
            showNotification("Please enter your index number and registered email.", "error");
            return;
        }

        // Standardize account mappings: Converts local index identifiers to database layout lookups
        email = `${indexNumber.toLowerCase()}@school.com`; 
        password = studentEmailPass;

    } else if (role === "teacher") {
        email = sanitizeInput(document.getElementById("signin-email").value.trim());
        password = document.getElementById("signin-password").value;

        if (!email || !password) {
            showNotification("Please fill in all layout credentials.", "error");
            return;
        }
        if (!validateEmail(email)) {
            showNotification("Please enter a valid email address.", "error");
            return;
        }
    }

    try {
        showNotification("Signing in...", "info");

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        signedInUser = userCredential.user;

        // Verify registration profile role documents from Firestore
        const userSnap = await getDoc(doc(db, "users", signedInUser.uid));

        if (!userSnap.exists()) {
            showNotification("No profile records discovered. Contact Administrator.", "error");
            auth.signOut();
            return;
        }

        const data   = userSnap.data();
        const status = data.accountStatus;

        let rolesArray = [];
        if (Array.isArray(data.role)) {
            rolesArray = data.role.map(r => String(r).toLowerCase());
        } else if (typeof data.role === "string") {
            rolesArray = [data.role.toLowerCase()];
        }

        if (rolesArray.length === 0) {
            showNotification("No system access profiles assigned.", "warning");
            auth.signOut();
            return;
        }

        if (rolesArray.includes("admin")) {
            redirectByRole(rolesArray);
            return;
        }

        if (status === "suspended") {
            showNotification("Your account has been suspended.", "error");
            auth.signOut();
            return;
        }

        if (status === "pending") {
            window.location.href = "pending.html";
            return;
        }

        redirectByRole(rolesArray);

    } catch (error) {
        console.error("Sign In error:", error);
        const msgs = {
            "auth/user-not-found":         "No account matches these configurations.",
            "auth/wrong-password":         "Incorrect validation security criteria.",
            "auth/invalid-credential":     "Invalid authorization profile credentials.",
            "auth/too-many-requests":      "Too many attempts. Locked out temporarily.",
            "auth/network-request-failed": "Network failure. Check connection settings."
        };
        showNotification(msgs[error.code] || MESSAGES.errors.auth, "error");
    }
}

async function handleTeacherSignUp() {
    const firstName = sanitizeInput(document.getElementById("t-firstname").value.trim());
    const lastName  = sanitizeInput(document.getElementById("t-lastname").value.trim());
    const email     = sanitizeInput(document.getElementById("t-email").value.trim());
    const phone     = sanitizeInput(document.getElementById("t-phone").value.trim());
    const password  = document.getElementById("t-password").value;
    const confirmPw = document.getElementById("t-confirmpassword").value;

    if (!firstName || !lastName || !email || !phone || !password || !confirmPw) {
        showNotification("Please clear and fill all matching input forms.", "error");
        return;
    }
    if (!validateEmail(email)) {
        showNotification("Invalid entry structure inside Email box.", "error");
        return;
    }
    if (!validatePhone(phone)) {
        showNotification("Please fulfill an official structured validation phone layout.", "error");
        return;
    }
    if (!validatePassword(password)) {
        showNotification("Password requires minimum 6 characters, an uppercase letter, and a number.", "error");
        return;
    }
    if (password !== confirmPw) {
        showNotification("Input confirmation parameters do not match.", "error");
        return;
    }

    try {
        showNotification("Creating account records...", "info");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            firstName,
            lastName,
            email,
            phone,
            role: "teacher",
            accountStatus: "pending",
            createdAt: new Date().toISOString()
        });

        showNotification("Registration successful! Approval pending documentation verification.", "success");
        setTimeout(() => { window.location.href = "pending.html"; }, 2000);

    } catch (error) {
        console.error("Teacher Sign Up error:", error);
        const msgs = {
            "auth/email-already-in-use": "An account matching this email mapping exists.",
            "auth/weak-password":        "Password strength does not pass criteria metrics.",
            "auth/invalid-email":        "The structural formulation of the email is invalid."
        };
        showNotification(msgs[error.code] || MESSAGES.errors.auth, "error");
    }
}

function redirectByRole(roles) {
    if (roles.includes("admin")) {
        window.location.href = "report_system/admin.html";
    } else if (roles.includes("teacher")) {
        window.location.href = "report_system/teacher.html";
    } else if (roles.includes("student")) {
        window.location.href = "report_system/student.html";
    } else {
        window.location.href = "index.html";
    }
}

// ============================================================
//  EVENT ROUTER CORE INITIALIZATION
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-signin")?.addEventListener("click", showSignIn);
    document.getElementById("btn-teacher-signup")?.addEventListener("click", showTeacherSignUp);
    document.getElementById("btn-back-signin")?.addEventListener("click", showDefault);
    document.getElementById("btn-teacher-register")?.addEventListener("click", handleTeacherSignUp);
    document.getElementById("btn-back-signup")?.addEventListener("click", showDefault);

    // Dynamic routing assignments matching clean functional separation mappings
    document.getElementById("btn-submit-student-signin")?.addEventListener("click", handleSignIn);
    document.getElementById("btn-submit-teacher-signin")?.addEventListener("click", handleSignIn);
});