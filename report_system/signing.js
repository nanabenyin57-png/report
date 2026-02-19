// 1. ALWAYS PUT IMPORTS AT THE TOP
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. PASTE YOUR FIREBASE CONFIG HERE
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169",
  measurementId: "G-KBTRR8YZFJ"
};

// 3. INITIALIZE
const app = initializeApp(firebaseConfig);
window.auth = getAuth(app);
window.db = getFirestore(app);

// --- UI FUNCTIONS ---

window.signin_page = function() {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signin-container">
        <input type="email" placeholder="User's email" id="email" class="email">
        <input type="password" placeholder="Password" id="password" class="pass">
        <button onclick="handlesignin()" class="signin-button">Sign In</button>
    </div>`;
};

window.signup_page = function() {
    const sign = document.getElementById("signingpage");
    sign.innerHTML = `
    <div class="signup-container">
        <input type="text" placeholder="First Name" id="firstname" class="firstname">
        <input type="text" placeholder="Last Name" id="lastname" class="lastname">
        <input type="email" placeholder="Email" id="email" class="email">
        <p>Password must be 8+ chars (Upper, Lower, Number).</p>
        <input type="password" placeholder="Password" id="password" class="pass">
        <input type="password" placeholder="Confirm Password" id="confirmpassword" class="confirmpass">
        <button onclick="handlesignup()" class="signup-button">Create Account</button>
    </div>`;
};

// --- FIREBASE LOGIC FUNCTIONS ---

window.handlesignin = async function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        window.location.href = "assessment.html";
    } catch (error) {
        alert("Login Error: " + error.message);
    }
};

window.handlesignup = async function() {
    const fname = document.getElementById('firstname').value;
    const lname = document.getElementById('lastname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmpassword').value;

    // Validation
    if (password !== confirm) { return alert("Passwords do not match!"); }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return alert("Password is too weak!");
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;

        // Create the user document in Firestore
        await setDoc(doc(window.db, "users", user.uid), {
            firstName: fname,
            lastName: lname,
            email: email,
            role: "student"
        });

        alert("Success!");
        window.location.href = "assessment.html";
    } catch (error) {
        alert("Sign Up Error: " + error.message);
    }
};