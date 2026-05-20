// ============================================================
//  signing.js — K_Tawiah Student Report System
//  Handles: Sign In (with role-based redirect), Sign Up
//           (student index sync + teacher registration)
// ============================================================

// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
    firebaseConfig,
    validateEmail,
    validatePassword,
    validateIndexNumber,
    sanitizeInput,
    showNotification,
    MESSAGES
} from "./config.js";

// 2. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ============================================================
//  UI — Show Sign In Form
// ============================================================
window.signin_page = function () {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signin-container">
        <h3>Staff & Student Sign In</h3>
        <input type="email"     placeholder="Email Address" id="email"    class="email">
        <input type="password"  placeholder="Password"      id="password" class="pass">
        <button onclick="handlesignin()" class="signin-button">Sign In</button>
    </div>`;
};

// ============================================================
//  UI — Show Sign Up Form
// ============================================================
window.signup_page = function () {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signup-container">
        <h3>Create Account</h3>

        <select id="userRole" onchange="toggleIndexField()" class="role-select">
            <option value="student">Student Account</option>
            <option value="teacher">Teacher Account</option>
        </select>

        <div id="indexFieldWrapper">
            <p>Enter your Index Number to sync with your school records.</p>
            <input type="text" placeholder="Index Number (e.g. KT-001)" id="indexno" class="indexno">
        </div>

        <input type="text"     placeholder="First Name"        id="firstname"       required>
        <input type="text"     placeholder="Last Name"         id="lastname"        required>
        <input type="email"    placeholder="Email"             id="email"           required>
        <input type="password" placeholder="Password"          id="password"        required>
        <input type="password" placeholder="Confirm Password"  id="confirmpassword" required>

        <button onclick="handlesignup()" class="signup-button">Register Account</button>
    </div>`;
};

// ============================================================
//  UI — Toggle Index Number field based on role selection
// ============================================================
window.toggleIndexField = function () {
    const role         = document.getElementById("userRole").value;
    const indexWrapper = document.getElementById("indexFieldWrapper");
    indexWrapper.style.display = (role === "teacher") ? "none" : "block";
};

// ============================================================
//  FIREBASE — Sign In (with role-based redirect)
// ============================================================
window.handlesignin = async function () {
    const email    = sanitizeInput(document.getElementById("email").value);
    const password = document.getElementById("password").value;

    // Basic validation
    if (!email || !password) {
        showNotification("Please fill in all fields.", "error");
        return;
    }
    if (!validateEmail(email)) {
        showNotification("Please enter a valid email address.", "error");
        return;
    }

    try {
        // Step 1: Authenticate with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Read their Firestore document to get their role
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            const role = data.role;

            // Step 3: Redirect based on role
            if (role === "admin") {
                showNotification("Welcome, Admin!", "success");
                window.location.href = "admin.html";

            } else if (role === "teacher") {
                showNotification("Welcome back!", "success");
                window.location.href = "report.html";

            } else if (role === "student") {
                showNotification("Welcome back!", "success");
                window.location.href = "student_view.html";

            } else {
                // Unknown role — safe fallback
                showNotification("Login successful. Role not recognised.", "warning");
                window.location.href = "report.html";
            }

        } else {
            // Auth account exists but no Firestore document — edge case
            console.warn("No Firestore user document found for UID:", user.uid);
            showNotification("Account found but no profile exists. Contact your administrator.", "error");
        }

    } catch (error) {
        console.error("Login Error:", error);

        const errorMessages = {
            "auth/user-not-found":      "No account found with this email.",
            "auth/wrong-password":      "Incorrect password. Please try again.",
            "auth/invalid-credential":  "Invalid email or password.",
            "auth/too-many-requests":   "Too many failed attempts. Please try again later.",
            "auth/network-request-failed": "Network error. Check your connection."
        };

        const message = errorMessages[error.code] || MESSAGES.errors.auth || "Login failed. Please try again.";
        showNotification(message, "error");
    }
};

// ============================================================
//  FIREBASE — Sign Up (Student index sync + Teacher registration)
// ============================================================
window.handlesignup = async function () {
    const userRole = document.getElementById("userRole").value;
    const indexNo  = sanitizeInput(document.getElementById("indexno")?.value.trim() || "");
    const fname    = sanitizeInput(document.getElementById("firstname").value.trim());
    const lname    = sanitizeInput(document.getElementById("lastname").value.trim());
    const email    = sanitizeInput(document.getElementById("email").value.trim());
    const password = document.getElementById("password").value;
    const confirm  = document.getElementById("confirmpassword").value;

    // ── Validation ────────────────────────────────────────────
    if (!fname || !lname || !email || !password || !confirm) {
        showNotification("Please fill in all required fields.", "error");
        return;
    }
    if (userRole === "student" && !indexNo) {
        showNotification("Please enter your Index Number.", "error");
        return;
    }
    if (!validateEmail(email)) {
        showNotification("Please enter a valid email address.", "error");
        return;
    }
    if (!validatePassword(password)) {
        showNotification(
            "Password must be at least 6 characters and contain uppercase, lowercase, and numbers.",
            "error"
        );
        return;
    }
    if (password !== confirm) {
        showNotification("Passwords do not match.", "error");
        return;
    }
    if (userRole === "student" && !validateIndexNumber(indexNo)) {
        showNotification("Index Number must be in the format KT-001.", "error");
        return;
    }

    // ── Create Firebase Auth account ──────────────────────────
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ── STUDENT FLOW ──────────────────────────────────────
        if (userRole === "student") {
            // Try to find a pre-existing school record using the Index Number
            const existingRecordRef  = doc(db, "users", indexNo);
            const existingRecordSnap = await getDoc(existingRecordRef);

            if (existingRecordSnap.exists()) {
                // Record found — link this Auth account to the teacher's pre-made entry
                await updateDoc(existingRecordRef, {
                    uid:           user.uid,
                    email:         email,
                    firstName:     fname,
                    lastName:      lname,
                    accountStatus: "active"
                });
                showNotification(
                    "Success! Your account has been linked to your school records.",
                    "success"
                );
            } else {
                // No pre-existing record — create a fresh student profile
                await setDoc(doc(db, "users", user.uid), {
                    indexNo:       indexNo,
                    firstName:     fname,
                    lastName:      lname,
                    email:         email,
                    role:          "student",
                    accountStatus: "active"
                });
                showNotification(
                    "Account created! No existing school record was found for that Index Number.",
                    "success"
                );
            }

            window.location.href = "student_view.html";

        // ── TEACHER FLOW ──────────────────────────────────────
        } else if (userRole === "teacher") {
            await setDoc(doc(db, "users", user.uid), {
                firstName:     fname,
                lastName:      lname,
                email:         email,
                role:          "teacher",   // NOTE: Admin role can only be set
                accountStatus: "active"     //       manually in Firebase Console
            });
            showNotification("Teacher account created successfully!", "success");
            window.location.href = "report.html";
        }

    } catch (error) {
        console.error("Signup Error:", error);

        const errorMessages = {
            "auth/email-already-in-use": "An account with this email already exists.",
            "auth/weak-password":        "Password is too weak.",
            "auth/invalid-email":        "Invalid email address.",
            "auth/network-request-failed": "Network error. Check your connection."
        };

        const message = errorMessages[error.code] || MESSAGES.errors.auth || "Sign up failed. Please try again.";
        showNotification(message, "error");
    }
};