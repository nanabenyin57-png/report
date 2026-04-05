// 1. ALL NECESSARY IMPORTS
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
import { firebaseConfig, validateEmail, validatePassword, validateIndexNumber, sanitizeInput, showNotification, MESSAGES } from "./config.js";

// 3. INITIALIZE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. UI FUNCTIONS (Attached to 'window' so HTML buttons can see them)

window.signin_page = function() {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signin-container">
        <h3>Staff & Student Sign In</h3>
        <input type="email" placeholder="Email Address" id="email" class="email">
        <input type="password" placeholder="Password" id="password" class="pass">
        <button onclick="handlesignin()" class="signin-button">Sign In</button>
    </div>`;
};

window.signup_page = function() {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signup-container">
        <h3>Create Account</h3>
        
        <select id="userRole" onchange="toggleIndexField()" class="role-select">
            <option value="student">Student Account</option>
            <option value="teacher">Teacher Account</option>
        </select>

        <div id="indexFieldWrapper">
            <p>Enter your Index Number to sync with records.</p>
            <input type="text" placeholder="Index Number" id="indexno" class="indexno">
        </div>

        <input type="text" placeholder="First Name" id="firstname" required>
        <input type="text" placeholder="Last Name" id="lastname" required>
        <input type="email" placeholder="Email" id="email" required>
        <input type="password" placeholder="Password" id="password" required>
        <input type="password" placeholder="Confirm Password" id="confirmpassword" required>
        
        <button onclick="handlesignup()" class="signup-button">Register Account</button>
    </div>`;
};

// This function handles the "Magic" of hiding/showing the Index field
window.toggleIndexField = function() {
    const role = document.getElementById('userRole').value;
    const indexWrapper = document.getElementById('indexFieldWrapper');
    
    if (role === 'teacher') {
        indexWrapper.style.display = 'none';
    } else {
        indexWrapper.style.display = 'block';
    }
};

// 5. FIREBASE LOGIC FUNCTIONS

window.handlesignin = async function() {
    const email = sanitizeInput(document.getElementById('email').value);
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showNotification("Please fill in all fields", "error");
        return;
    }

    if (!validateEmail(email)) {
        showNotification("Please enter a valid email address", "error");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("Login successful!", "success");
        window.location.href = "report.html";
    } catch (error) {
        console.error("Login Error:", error);
        let message = MESSAGES.errors.auth;
        if (error.code === 'auth/user-not-found') {
            message = "No account found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            message = "Incorrect password.";
        } else if (error.code === 'auth/too-many-requests') {
            message = "Too many failed attempts. Please try again later.";
        }
        showNotification(message, "error");
    }
};

window.handlesignup = async function() {
    const indexNo = sanitizeInput(document.getElementById('indexno').value.trim());
    const fname = sanitizeInput(document.getElementById('firstname').value.trim());
    const lname = sanitizeInput(document.getElementById('lastname').value.trim());
    const email = sanitizeInput(document.getElementById('email').value.trim());
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmpassword').value;
    const userRole = document.getElementById('userRole').value;

    // Validation
    if (!fname || !lname || !email || !password || !confirm) {
        showNotification("Please fill in all required fields", "error");
        return;
    }

    if (userRole === 'student' && !indexNo) {
        showNotification("Please enter your Index Number", "error");
        return;
    }

    if (!validateEmail(email)) {
        showNotification("Please enter a valid email address", "error");
        return;
    }

    if (!validatePassword(password)) {
        showNotification("Password must be at least 6 characters and contain uppercase, lowercase, and numbers", "error");
        return;
    }

    if (password !== confirm) {
        showNotification("Passwords do not match", "error");
        return;
    }

    if (userRole === 'student' && !validateIndexNumber(indexNo)) {
        showNotification("Index Number must be in format KT-001", "error");
        return;
    }

    try {
        // Step A: Create the Login account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (userRole === 'student') {
            // Step B: THE SYNC - Look for the Index Number the teacher added
            const userRef = doc(db, "users", indexNo);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                // Found it! Link the new account to the teacher's data
                await updateDoc(userRef, {
                    uid: user.uid,
                    email: email,
                    firstName: fname,
                    lastName: lname,
                    accountStatus: "active"
                });
                showNotification("Success! Your account is linked to your school records.", "success");
            } else {
                // No record found: Create a fresh profile
                await setDoc(doc(db, "users", user.uid), {
                    indexNo: indexNo,
                    firstName: fname,
                    lastName: lname,
                    email: email,
                    role: "student",
                    accountStatus: "active"
                });
                showNotification("Account created! (No existing teacher record found).", "success");
            }
        } else {
            // Teacher account
            await setDoc(doc(db, "users", user.uid), {
                firstName: fname,
                lastName: lname,
                email: email,
                role: "teacher",
                accountStatus: "active"
            });
            showNotification("Teacher account created successfully!", "success");
        }

        window.location.href = "report.html";
    } catch (error) {
        console.error("Signup Error:", error);
        let message = MESSAGES.errors.auth;
        if (error.code === 'auth/email-already-in-use') {
            message = "An account with this email already exists.";
        } else if (error.code === 'auth/weak-password') {
            message = "Password is too weak.";
        }
        showNotification(message, "error");
    }
};